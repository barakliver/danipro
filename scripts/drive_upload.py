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
    with open(path, "rb") as fh:
        b64 = base64.b64encode(fh.read())
    # curl reads the base64 from a temp file; a multi-MB argv would overflow.
    tmp = tempfile.NamedTemporaryFile("wb", suffix=".b64", delete=False)
    try:
        tmp.write(b64)
        tmp.close()
        out = subprocess.run(
            ["curl", "-sS", "-L", "--max-time", "300",
             "--data-urlencode", "name=" + os.path.basename(path),
             "--data-urlencode", "type=" + mime,
             "--data-urlencode", "data@" + tmp.name,
             url],
            capture_output=True, text=True, timeout=330)
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
