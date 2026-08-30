#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Re-upload any local video the Drive folder is missing, then resync the sheet.

Apps Script occasionally drops a request, which leaves a row in the sheet with
no file behind it. Run this to close the gap.
"""
import csv
import glob
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import taxonomy as T
import drive_upload

listed = set()
if len(sys.argv) > 1:            # optional file of Drive titles, one per line
    with open(sys.argv[1], encoding="utf-8") as fh:
        listed = {l.strip() for l in fh if l.strip()}

missing = []
for path in sorted(glob.glob(os.path.join(T.VIDEO_DIR, "*.mp4"))):
    if os.path.basename(path) not in listed:
        missing.append(path)

print("קבצים מקומיים: {} | חסרים בדרייב: {}".format(
    len(glob.glob(os.path.join(T.VIDEO_DIR, '*.mp4'))), len(missing)))

for path in missing:
    r = drive_upload.upload(path)
    print("{}  ->  {}".format(os.path.basename(path)[:60],
                              "OK" if r and r.get("ok") else r))

with open(T.CSV_PATH, encoding="utf-8-sig", newline="") as fh:
    rows = list(csv.reader(fh))
rows = [r + [""] * (len(T.HEADERS) - len(r)) for r in rows[1:]]
res = drive_upload.upload_sheet([T.HEADERS] + rows)
print("סנכרון גיליון ({} שורות): {}".format(len(rows), res.get("ok") if res else None))
