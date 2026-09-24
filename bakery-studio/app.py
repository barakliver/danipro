"""Bakery Studio: upload bread/pastry photos, get studio-grade shots back.

Run:  uvicorn app:app --reload   (from this directory)
"""

import io
import json
import re
import threading
import time
import uuid
import zipfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps

import providers
from prompt import FIXES, PRODUCT_TYPES, build_prompt, build_refine_prompt

ROOT = Path(__file__).parent
STYLES_FILE = ROOT / "styles.json"
DATA = ROOT / "data"
ORIGINALS, RESULTS = DATA / "originals", DATA / "results"
REFERENCES = DATA / "references"  # one style-reference image per style id
HISTORY_FILE = DATA / "history.json"
for d in (ORIGINALS, RESULTS, REFERENCES):
    d.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD = 20 * 1024 * 1024
MAX_SIDE = 2048  # downscale huge phone photos before sending to a model
JOB_ID = re.compile(r"[0-9a-f]{12}")
STYLE_FIELDS = ("name", "surface", "lighting", "props", "camera", "mood", "extra")
_lock = threading.Lock()

app = FastAPI(title="Bakery Studio")


def _load(path, default):
    return json.loads(path.read_text("utf-8")) if path.exists() else default


def _save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), "utf-8")


def _style_or_404(styles, style_id):
    for s in styles:
        if s["id"] == style_id:
            return s
    raise HTTPException(404, "סגנון לא נמצא")


def _ref_path(style_id):
    if not re.fullmatch(r"[A-Za-z0-9_-]+", style_id):
        raise HTTPException(400, "מזהה סגנון לא תקין")
    return REFERENCES / f"{style_id}.jpg"


def _with_reference(style):
    ref = _ref_path(style["id"])
    if not ref.exists():
        return style
    return {**style, "reference": f"/files/references/{ref.name}?v={int(ref.stat().st_mtime)}"}


def _clean_style(payload):
    style = {k: str(payload.get(k, "")).strip()[:1500] for k in STYLE_FIELDS}
    if not style["name"]:
        raise HTTPException(400, "חובה לתת שם לסגנון")
    return style


def _normalize(raw):
    """Fix EXIF rotation, cap resolution, return (bytes, mime)."""
    try:
        img = ImageOps.exif_transpose(Image.open(io.BytesIO(raw)))
    except Exception:
        raise HTTPException(400, "הקובץ אינו תמונה תקינה")
    img = img.convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=95)
    return out.getvalue(), "image/jpeg"


@app.get("/api/config")
def config():
    return {
        "providers": providers.available(),
        "aspects": list(providers.ASPECTS),
        "product_types": {k: label for k, (label, _) in PRODUCT_TYPES.items()},
        "fixes": {k: label for k, (label, _) in FIXES.items()},
    }


@app.get("/api/styles")
def list_styles():
    return [_with_reference(s) for s in _load(STYLES_FILE, [])]


@app.post("/api/styles")
def create_style(payload: dict):
    style = _clean_style(payload)
    slug = re.sub(r"[^a-z0-9]+", "-", style["name"].lower()).strip("-")
    style = {"id": f"{slug or 'style'}-{uuid.uuid4().hex[:6]}", **style}
    with _lock:
        styles = _load(STYLES_FILE, [])
        styles.append(style)
        _save(STYLES_FILE, styles)
    return style


@app.put("/api/styles/{style_id}")
def update_style(style_id: str, payload: dict):
    with _lock:
        styles = _load(STYLES_FILE, [])
        style = _style_or_404(styles, style_id)
        style.update(_clean_style(payload))
        _save(STYLES_FILE, styles)
    return style


@app.delete("/api/styles/{style_id}")
def delete_style(style_id: str):
    with _lock:
        styles = _load(STYLES_FILE, [])
        _style_or_404(styles, style_id)
        _save(STYLES_FILE, [s for s in styles if s["id"] != style_id])
    _ref_path(style_id).unlink(missing_ok=True)
    return {"ok": True}


@app.post("/api/styles/{style_id}/reference")
async def set_reference(style_id: str, image: UploadFile = File(...)):
    raw = await image.read()
    if len(raw) > MAX_UPLOAD:
        raise HTTPException(413, "הקובץ גדול מ-20MB")
    _style_or_404(_load(STYLES_FILE, []), style_id)
    _ref_path(style_id).write_bytes(_normalize(raw)[0])
    return {"ok": True}


@app.delete("/api/styles/{style_id}/reference")
def delete_reference(style_id: str):
    _ref_path(style_id).unlink(missing_ok=True)
    return {"ok": True}


@app.post("/api/preview-prompt")
def preview_prompt(payload: dict):
    styles = _load(STYLES_FILE, [])
    style = _style_or_404(styles, payload.get("style_id", ""))
    has_ref = bool(payload.get("use_reference")) and _ref_path(style["id"]).exists()
    return {"prompt": build_prompt(style, payload.get("notes", ""),
                                   payload.get("product_type", ""), has_ref)}


@app.post("/api/process")
async def process(
    image: UploadFile = File(...),
    style_id: str = Form(...),
    provider: str = Form("gemini"),
    aspect: str = Form("original"),
    notes: str = Form(""),
    product_type: str = Form(""),
    use_reference: bool = Form(True),
    variant: int = Form(1),
    group: str = Form(""),
):
    raw = await image.read()
    if len(raw) > MAX_UPLOAD:
        raise HTTPException(413, "הקובץ גדול מ-20MB")
    style = _style_or_404(_load(STYLES_FILE, []), style_id)
    if not providers.available().get(provider):
        raise HTTPException(400, f"הספק {provider} אינו מוגדר (חסר מפתח API)")

    if product_type not in PRODUCT_TYPES:
        raise HTTPException(400, "סוג מאפה לא מוכר")

    img_bytes, mime = _normalize(raw)
    ref = _ref_path(style_id)
    reference = ref.read_bytes() if use_reference and provider != "local" and ref.exists() else None
    prompt = build_prompt(style, notes, product_type, reference is not None)
    started = time.time()
    try:
        result = await run_in_threadpool(
            providers.run, provider, img_bytes, mime, prompt, aspect, reference)
    except providers.ProviderError as e:
        raise HTTPException(502, str(e))

    return _store(img_bytes, result, started, {
        "group": group if JOB_ID.fullmatch(group) else None,
        "filename": image.filename,
        "style_id": style_id,
        "style_name": style["name"],
        "provider": provider,
        "aspect": aspect,
        "notes": notes,
        "product_type": product_type,
        "used_reference": reference is not None,
        "variant": variant,
    })


def _store(original, result, started, fields):
    """Save original + result for a new job and prepend it to the history."""
    job = uuid.uuid4().hex[:12]
    (ORIGINALS / f"{job}.jpg").write_bytes(original)
    Image.open(io.BytesIO(result)).convert("RGB").save(RESULTS / f"{job}.jpg", "JPEG", quality=95)
    entry = {
        "id": job,
        **fields,
        "group": fields.get("group") or job,
        "created": int(time.time()),
        "seconds": round(time.time() - started, 1),
        "original": f"/files/originals/{job}.jpg",
        "result": f"/files/results/{job}.jpg",
    }
    with _lock:
        history = _load(HISTORY_FILE, [])
        history.insert(0, entry)
        _save(HISTORY_FILE, history)
    return entry


def _job_or_404(job):
    if not JOB_ID.fullmatch(job):
        raise HTTPException(400, "מזהה לא תקין")
    for h in _load(HISTORY_FILE, []):
        if h["id"] == job:
            return h
    raise HTTPException(404, "התוצאה לא נמצאה")


@app.post("/api/refine")
async def refine(payload: dict):
    """Apply a one-click fix (or free text) to an existing result, as a new job."""
    parent = _job_or_404(str(payload.get("job", "")))
    fix, custom = str(payload.get("fix", "")), str(payload.get("custom", "")).strip()[:500]
    if fix in FIXES:
        label, change = FIXES[fix]
    elif custom:
        label, change = custom, custom
    else:
        raise HTTPException(400, "לא נבחר תיקון")
    provider = parent.get("provider", "")
    if provider == "local":
        raise HTTPException(400, "תיקונים זמינים רק עם מנוע AI (Gemini או OpenAI)")
    if not providers.available().get(provider):
        raise HTTPException(400, f"הספק {provider} אינו מוגדר (חסר מפתח API)")

    result_path = RESULTS / f"{parent['id']}.jpg"
    original_path = ORIGINALS / f"{parent['id']}.jpg"
    if not result_path.exists() or not original_path.exists():
        raise HTTPException(404, "קובץ התוצאה חסר")
    ref = _ref_path(parent["style_id"]) if parent.get("style_id") else None
    reference = ref.read_bytes() if parent.get("used_reference") and ref and ref.exists() else None
    prompt = build_refine_prompt(change, reference is not None)
    started = time.time()
    try:
        result = await run_in_threadpool(
            providers.run, provider, result_path.read_bytes(), "image/jpeg", prompt,
            parent.get("aspect", "original"), reference)
    except providers.ProviderError as e:
        raise HTTPException(502, str(e))

    keep = ("filename", "style_id", "style_name", "provider", "aspect", "notes",
            "product_type", "used_reference", "variant")
    return _store(original_path.read_bytes(), result, started, {
        **{k: parent.get(k) for k in keep},
        "group": parent.get("group") or parent["id"],
        "parent": parent["id"],
        "fix": label,
    })


@app.post("/api/history/{job}/star")
def star(job: str, payload: dict):
    if not JOB_ID.fullmatch(job):
        raise HTTPException(400, "מזהה לא תקין")
    with _lock:
        history = _load(HISTORY_FILE, [])
        entry = next((h for h in history if h["id"] == job), None)
        if not entry:
            raise HTTPException(404, "התוצאה לא נמצאה")
        entry["starred"] = bool(payload.get("starred"))
        _save(HISTORY_FILE, history)
    return entry


@app.get("/api/history")
def history():
    return _load(HISTORY_FILE, [])


@app.get("/api/download")
def download(ids: str):
    """Zip the given results (comma-separated job ids) for one-click download."""
    jobs = [j for j in ids.split(",") if JOB_ID.fullmatch(j)]
    by_id = {h["id"]: h for h in _load(HISTORY_FILE, [])}
    buf, used = io.BytesIO(), set()
    with zipfile.ZipFile(buf, "w") as zf:
        for j in jobs:
            path = RESULTS / f"{j}.jpg"
            if j not in by_id or not path.exists():
                continue
            h = by_id[j]
            stem = re.sub(r"[^\w-]+", "_", Path(h.get("filename") or j).stem)[:60] or j
            name = f"{stem}-v{h.get('variant') or 1}{'-fix' if h.get('parent') else ''}.jpg"
            if name in used:
                name = f"{stem}-{j}.jpg"
            used.add(name)
            zf.write(path, name)
    if not used:
        raise HTTPException(404, "לא נמצאו תוצאות להורדה")
    return Response(buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": 'attachment; filename="bakery-studio.zip"'})


@app.delete("/api/history/{job}")
def delete_job(job: str):
    if not JOB_ID.fullmatch(job):
        raise HTTPException(400, "מזהה לא תקין")
    with _lock:
        _save(HISTORY_FILE, [h for h in _load(HISTORY_FILE, []) if h["id"] != job])
    for d in (ORIGINALS, RESULTS):
        (d / f"{job}.jpg").unlink(missing_ok=True)
    return {"ok": True}


app.mount("/files", StaticFiles(directory=DATA), name="files")
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


@app.get("/")
def index():
    return FileResponse(ROOT / "static" / "index.html")
