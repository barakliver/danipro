#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Push a file into the researcher's Drive folder via their Apps Script endpoint.

The endpoint URL lives in drive_endpoint.txt at the repo root (gitignored:
anyone holding the URL can add files to the folder). When that file is
missing, upload() is a quiet no-op so the catalog pipeline works unchanged.
"""
import base64
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENDPOINT_FILE = os.path.join(ROOT, "drive_endpoint.txt")


def endpoint():
    try:
        with open(ENDPOINT_FILE) as fh:
            return fh.read().strip() or None
    except FileNotFoundError:
        return None


def upload(path, mime="video/mp4"):
    """Returns the endpoint's JSON reply, or None when no endpoint is configured."""
    url = endpoint()
    if not url:
        return None
    display_name = os.path.basename(path)
    # Apps Script rejects POSTs over ~50MB, and base64 costs 1.37x: shrink
    # anything above ~33MB to 720p for the Drive copy (local file untouched).
    if os.path.getsize(path) > 33 * 1024 * 1024 and mime == "video/mp4":
        small = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False).name
        rc = subprocess.call(
            ["ffmpeg", "-v", "error", "-y", "-i", path,
             "-vf", "scale=-2:720", "-c:v", "libx264", "-crf", "28",
             "-preset", "veryfast", "-c:a", "aac", "-b:a", "128k", small])
        if rc == 0 and 0 < os.path.getsize(small) < os.path.getsize(path):
            path = small
    with open(path, "rb") as fh:
        b64 = base64.b64encode(fh.read()).decode("ascii")
    # Build the whole form body ourselves: curl's --data-urlencode buffers the
    # encode in memory and dies on multi-MB videos. Base64 only needs three
    # characters escaped for x-www-form-urlencoded.
    from urllib.parse import quote
    body = "name={}&type={}&data={}".format(
        quote(display_name), quote(mime),
        b64.replace("+", "%2B").replace("/", "%2F").replace("=", "%3D"))
    tmp = tempfile.NamedTemporaryFile("w", suffix=".form", delete=False)
    try:
        tmp.write(body)
        tmp.close()
        out = subprocess.run(
            ["curl", "-sS", "-L", "--max-time", "600",
             "--data", "@" + tmp.name,
             url],
            capture_output=True, text=True, timeout=630)
        try:
            return json.loads(out.stdout.strip())
        except json.JSONDecodeError:
            err = (out.stdout or out.stderr or "").strip()
            return {"ok": False, "error": err[:300] or "empty response"}
    finally:
        os.unlink(tmp.name)


def upload_sheet(rows):
    """Upsert rows (rows[0] = headers) into the Google Sheet in the folder."""
    url = endpoint()
    if not url:
        return None
    tmp = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False,
                                      encoding="utf-8")
    try:
        json.dump(rows, tmp, ensure_ascii=False)
        tmp.close()
        out = subprocess.run(
            ["curl", "-sS", "-L", "--max-time", "120",
             "--data-urlencode", "action=sheet",
             "--data-urlencode", "rows@" + tmp.name,
             url],
            capture_output=True, text=True, timeout=150)
        try:
            return json.loads(out.stdout.strip())
        except json.JSONDecodeError:
            err = (out.stdout or out.stderr or "").strip()
            return {"ok": False, "error": err[:300] or "empty response"}
    finally:
        os.unlink(tmp.name)


def mime_for(path):
    return "text/csv" if path.endswith(".csv") else "video/mp4"


if __name__ == "__main__":
    if not endpoint():
        raise SystemExit("drive_endpoint.txt חסר — הדבק לתוכו את כתובת ה-/exec")
    for p in sys.argv[1:]:
        r = upload(p, mime_for(p))
        status = "OK" if r and r.get("ok") else str(r)
        print("{} -> {}".format(os.path.basename(p), status))
