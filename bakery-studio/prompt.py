"""Compose the image-editing instruction from a style definition."""

BASE = (
    "Transform this photo into a professional, high-end food photograph of the same "
    "baked good, as if it were re-shot by a top commercial food photographer on a "
    "styled studio set.\n\n"
    "PRESERVE THE PRODUCT EXACTLY: keep the identical bread/pastry - same shape, size "
    "proportions, scoring pattern, crust color and texture, crumb, glaze, toppings, "
    "seeds, fillings and number of pieces. Do not invent, remove or redesign any part "
    "of the product. Only the set, lighting, camera and color grading change.\n\n"
)

QUALITY = (
    "\n\nMake it look delicious and appetizing: crisp crust texture, visible flaky "
    "layers or open crumb where present, natural glossy highlights, fresh-from-the-oven "
    "feel. Photorealistic, sharp focus on the product, natural color, clean "
    "composition, magazine / advertising quality. No text, no watermark, no logos, "
    "no hands, no people, no artificial or plastic look."
)


def build_prompt(style, notes=""):
    lines = [
        ("Set / surface", style.get("surface")),
        ("Lighting", style.get("lighting")),
        ("Props & styling", style.get("props")),
        ("Camera", style.get("camera")),
        ("Mood & color grade", style.get("mood")),
        ("Additional direction", style.get("extra")),
        ("Notes for this photo", notes),
    ]
    body = "\n".join(f"- {label}: {value.strip()}" for label, value in lines
                     if value and value.strip())
    return BASE + "STYLE:\n" + body + QUALITY
