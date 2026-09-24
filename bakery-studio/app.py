"""Bakery Studio: upload bread/pastry photos, get studio-grade shots back.

Run:  uvicorn app:app --reload   (from this directory)
"""

import io
import json
import re
import threading
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps

import providers
from prompt import build_prompt

ROOT = Path(__file__).parent
STYLES_FILE = ROOT / "styles.json"
DATA = ROOT / "data"
ORIGINALS, RESULTS = DATA / "originals", DATA / "results"
HISTORY_FILE = DATA / "history.json"
for d in (ORIGINALS, RESULTS):
    d.mkdir(parents=True, exist_ok=True)

MAX_UPLOAD = 20 * 1024 * 1024
MAX_SIDE = 2048  # downscale huge phone photos before sending to a model
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
    return {"providers": providers.available(), "aspects": list(providers.ASPECTS)}


@app.get("/api/styles")
def list_styles():
    return _load(STYLES_FILE, [])


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
    return {"ok": True}


@app.post("/api/preview-prompt")
def preview_prompt(payload: dict):
    styles = _load(STYLES_FILE, [])
    style = _style_or_404(styles, payload.get("style_id", ""))
    return {"prompt": build_prompt(style, payload.get("notes", ""))}


@app.post("/api/process")
async def process(
    image: UploadFile = File(...),
    style_id: str = Form(...),
    provider: str = Form("gemini"),
    aspect: str = Form("original"),
    notes: str = Form(""),
):
    raw = await image.read()
    if len(raw) > MAX_UPLOAD:
        raise HTTPException(413, "הקובץ גדול מ-20MB")
    style = _style_or_404(_load(STYLES_FILE, []), style_id)
    if not providers.available().get(provider):
        raise HTTPException(400, f"הספק {provider} אינו מוגדר (חסר מפתח API)")

    img_bytes, mime = _normalize(raw)
    prompt = build_prompt(style, notes)
    started = time.time()
    try:
        result = await run_in_threadpool(
            providers.run, provider, img_bytes, mime, prompt, aspect)
    except providers.ProviderError as e:
        raise HTTPException(502, str(e))

    job = uuid.uuid4().hex[:12]
    (ORIGINALS / f"{job}.jpg").write_bytes(img_bytes)
    res_img = Image.open(io.BytesIO(result)).convert("RGB")
    res_img.save(RESULTS / f"{job}.jpg", "JPEG", quality=95)

    entry = {
        "id": job,
        "filename": image.filename,
        "style_id": style_id,
        "style_name": style["name"],
        "provider": provider,
        "aspect": aspect,
        "notes": notes,
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


@app.get("/api/history")
def history():
    return _load(HISTORY_FILE, [])


@app.delete("/api/history/{job}")
def delete_job(job: str):
    if not re.fullmatch(r"[0-9a-f]{12}", job):
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
