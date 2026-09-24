"""Image backends that turn a raw bakery photo into a studio shot.

Each provider takes the original image bytes plus a composed prompt (and
optionally a style-reference image sent as a second image) and returns
PNG/JPEG bytes. `gemini` and `openai` re-shoot the product in the
chosen set; `local` needs no API key and only re-grades the existing photo
(light, color, sharpness) without changing the background.
"""

import base64
import io
import os

import httpx
from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageStat

GEMINI_MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
OPENAI_MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")
TIMEOUT = httpx.Timeout(180.0)

# Aspect ratio key -> (gemini aspectRatio, openai size)
ASPECTS = {
    "original": (None, "auto"),
    "1:1": ("1:1", "1024x1024"),
    "4:5": ("4:5", "1024x1536"),
    "3:2": ("3:2", "1536x1024"),
    "16:9": ("16:9", "1536x1024"),
    "9:16": ("9:16", "1024x1536"),
}


class ProviderError(RuntimeError):
    pass


def available():
    return {
        "gemini": bool(os.environ.get("GEMINI_API_KEY")),
        "openai": bool(os.environ.get("OPENAI_API_KEY")),
        "local": True,
    }


def run(provider, image_bytes, mime, prompt, aspect="original", reference=None):
    """`reference` is optional JPEG bytes of a style reference; the local
    provider ignores it."""
    if provider == "gemini":
        return _gemini(image_bytes, mime, prompt, aspect, reference)
    if provider == "openai":
        return _openai(image_bytes, mime, prompt, aspect, reference)
    if provider == "local":
        return _local(image_bytes)
    raise ProviderError(f"ספק לא מוכר: {provider}")


def _inline(data, mime):
    return {"inline_data": {"mime_type": mime, "data": base64.b64encode(data).decode()}}


def _gemini(image_bytes, mime, prompt, aspect, reference=None):
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise ProviderError("חסר GEMINI_API_KEY")
    config = {"responseModalities": ["TEXT", "IMAGE"]}
    ratio = ASPECTS.get(aspect, ASPECTS["original"])[0]
    if ratio:
        config["imageConfig"] = {"aspectRatio": ratio}
    # Images first (product, then reference) so "FIRST/SECOND image" in the
    # prompt matches their order.
    parts = [_inline(image_bytes, mime)]
    if reference:
        parts.append(_inline(reference, "image/jpeg"))
    parts.append({"text": prompt})
    body = {
        "contents": [{"parts": parts}],
        "generationConfig": config,
    }
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"{GEMINI_MODEL}:generateContent")
    r = httpx.post(url, json=body, headers={"x-goog-api-key": key}, timeout=TIMEOUT)
    if r.status_code != 200:
        raise ProviderError(f"Gemini {r.status_code}: {r.text[:300]}")
    for cand in r.json().get("candidates", []):
        for part in cand.get("content", {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                return base64.b64decode(inline["data"])
    raise ProviderError("Gemini לא החזיר תמונה (ייתכן שהבקשה נחסמה)")


def _openai(image_bytes, mime, prompt, aspect, reference=None):
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise ProviderError("חסר OPENAI_API_KEY")
    ext = "png" if mime == "image/png" else "jpg"
    data = {
        "model": OPENAI_MODEL,
        "prompt": prompt,
        "size": ASPECTS.get(aspect, ASPECTS["original"])[1],
        "quality": "high",
        "input_fidelity": "high",
    }
    files = [("image[]", (f"input.{ext}", image_bytes, mime))]
    if reference:
        files.append(("image[]", ("reference.jpg", reference, "image/jpeg")))
    r = httpx.post(
        "https://api.openai.com/v1/images/edits",
        headers={"Authorization": f"Bearer {key}"},
        data=data,
        files=files,
        timeout=TIMEOUT,
    )
    if r.status_code != 200:
        raise ProviderError(f"OpenAI {r.status_code}: {r.text[:300]}")
    items = r.json().get("data") or []
    if not items or not items[0].get("b64_json"):
        raise ProviderError("OpenAI לא החזיר תמונה")
    return base64.b64decode(items[0]["b64_json"])


def _local(image_bytes):
    """Studio-style regrade: neutralize cast, lift light, warm, sharpen, vignette."""
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(image_bytes))).convert("RGB")

    # Half-strength gray-world white balance (full strength over-corrects food,
    # which is naturally warm), then a gentle warm shift that flatters crusts.
    means = ImageStat.Stat(img).mean
    gray = sum(means) / 3
    gains = [1 + ((gray / m if m else 1) - 1) * 0.5 for m in means]
    gains = [gains[0] * 1.04, gains[1] * 1.01, gains[2] * 0.95]
    bands = [ch.point(lambda v, k=k: min(255, int(v * k)))
             for ch, k in zip(img.split(), gains)]
    img = Image.merge("RGB", bands)

    # Levels stretch on luminance, one curve for all channels so it cannot add
    # a color cast; black/white points are capped so flat photos are not blown out.
    hist = img.convert("L").histogram()
    total, acc, lo, hi = sum(hist), 0, 0, 255
    for i, n in enumerate(hist):
        acc += n
        if acc <= total * 0.01:
            lo = i
        if acc <= total * 0.99:
            hi = i
    lo, hi = min(lo, 28), max(hi, 228)
    img = img.point(lambda v: max(0, min(255, round((v - lo) * 255 / (hi - lo)))))
    img = ImageEnhance.Brightness(img).enhance(1.06)
    img = ImageEnhance.Contrast(img).enhance(1.10)
    img = ImageEnhance.Color(img).enhance(1.12)
    img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=90, threshold=2))

    # Soft vignette to pull the eye to the product.
    w, h = img.size
    mask = Image.radial_gradient("L").resize((w, h))
    mask = ImageOps.invert(mask).point(lambda v: int(150 + v * 105 / 255))
    dark = ImageEnhance.Brightness(img).enhance(0.72)
    img = Image.composite(img, dark, mask)

    out = io.BytesIO()
    img.save(out, "JPEG", quality=93)
    return out.getvalue()
