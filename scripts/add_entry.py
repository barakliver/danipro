#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Step 3 + Step 4: download a confirmed Reel, rename it, and catalog it.

Runs only after the user has picked a description in Step 2.

    python3 scripts/add_entry.py --index 1 --url https://www.instagram.com/reel/XXXX/ \
        --desc "עובד קונדיטוריה מערבב סבון כלים מול המנהל" \
        --genre skit --ritual חשיפה --humor אירוניה --subject צוות
"""
import argparse
import csv
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import taxonomy as T
import drive_upload

FORBIDDEN = set('/\\:*?"<>|')


def sanitize(text):
    """Filename-safe Hebrew slug: strip forbidden chars, keep natural spacing."""
    cleaned = "".join(" " if ch in FORBIDDEN else ch for ch in text)
    cleaned = "".join(ch for ch in cleaned if ord(ch) >= 32)
    slug = " ".join(cleaned.split())
    # A stripped quote can leave a space sitting before punctuation.
    slug = slug.replace(" ,", ",").replace(" .", ".")
    return slug.strip(". ") or "untitled"


def download(url, dest, cookies=None):
    cmd = [
        "yt-dlp",
        "-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",
        "--merge-output-format", "mp4",
        "--no-playlist",
        "-o", dest,
        url,
    ]
    if cookies:
        cmd[1:1] = ["--cookies", cookies]
    print("$ " + " ".join(cmd), flush=True)
    return subprocess.call(cmd)


def load_rows():
    if not os.path.exists(T.CSV_PATH):
        return []
    with open(T.CSV_PATH, encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.reader(fh))
    return rows[1:] if rows else []


def write_rows(rows):
    """Rewrite the sheet with a UTF-8 BOM so Excel renders Hebrew correctly."""
    with open(T.CSV_PATH, "w", encoding="utf-8-sig", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(T.HEADERS)
        writer.writerows(rows)


def render_table(rows):
    out = ["| " + " | ".join(T.HEADERS) + " |",
           "|" + "|".join([" --- "] * len(T.HEADERS)) + "|"]
    for row in rows:
        out.append("| " + " | ".join(c.replace("|", "\\|") for c in row) + " |")
    return "\n".join(out)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--index", type=int, required=True)
    p.add_argument("--url", required=True)
    p.add_argument("--desc", required=True, help="the description confirmed in Step 2")
    p.add_argument("--genre", required=True)
    p.add_argument("--ritual", required=True)
    p.add_argument("--humor", required=True)
    p.add_argument("--subject", required=True)
    p.add_argument("--cookies", help="cookies file, if Instagram requires auth")
    p.add_argument("--no-download", action="store_true",
                   help="catalog only; use when the MP4 is already in ./videos/")
    a = p.parse_args()

    if not 1 <= a.index <= T.TOTAL:
        raise SystemExit("--index חייב להיות בין 1 ל-{}".format(T.TOTAL))

    genre = T.resolve(a.genre, T.GENRE, "ז'אנר ויזואלי")
    ritual = T.resolve(a.ritual, T.RITUAL, "סוג הטקס")
    humor = T.resolve(a.humor, T.HUMOR, "טכניקת הומור")
    subject = T.resolve(a.subject, T.SUBJECT, "מושא ההומור")

    idx = "{:03d}".format(a.index)
    desc = " ".join(a.desc.split())
    filename = "{} {}.mp4".format(idx, sanitize(desc))
    dest = os.path.join(T.VIDEO_DIR, filename)
    os.makedirs(T.VIDEO_DIR, exist_ok=True)

    if not a.no_download:
        if download(a.url, dest, a.cookies) != 0 or not os.path.exists(dest):
            raise SystemExit("ההורדה נכשלה — הרשומה לא נוספה ל-CSV.")

    rows = load_rows()
    rows = [r for r in rows if not (r and r[0] == idx)]  # re-run is idempotent
    rows.append([idx, a.url, desc, genre, ritual, humor, subject])
    rows.sort(key=lambda r: r[0])
    write_rows(rows)

    if os.path.exists(dest):
        sent = drive_upload.upload(dest)
        if sent is not None:
            print("Drive {}: {}".format("OK" if sent.get("ok") else "FAILED", sent))
    sent_csv = drive_upload.upload(T.CSV_PATH, "text/csv")
    if sent_csv is not None:
        print("Drive CSV {}: {}".format("OK" if sent_csv.get("ok") else "FAILED", sent_csv))

    size = os.path.getsize(dest) / 1e6 if os.path.exists(dest) else 0
    print("\nוידאו {}/{} — נשמר: {} ({:.1f}MB)".format(a.index, T.TOTAL, dest, size))
    print("נותרו: {} סרטונים\n".format(T.TOTAL - len(rows)))
    print(render_table(rows))


if __name__ == "__main__":
    main()
