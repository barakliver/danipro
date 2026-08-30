# Instagram Reels Dataset — Food & Restaurant Humor (n=107)

Corpus for a seminar paper on media rituals and humor typologies
(Trillò; Buijzen & Valkenburg; Shifman).

## Layout

| Path | Purpose |
| --- | --- |
| `videos/` | Downloaded MP4s, named `[Index] [Hebrew Description].mp4` |
| `research_database.csv` | The catalog, 7 columns (UTF-8 **with BOM**, for Excel Hebrew) |
| `scripts/taxonomy.py` | The approved coding frame |
| `scripts/add_entry.py` | Step 3 + 4: download, rename, catalog |
| `scripts/render_table.py` | Re-render the summary table from the CSV |

## Per-video workflow

1. **Retrieval & analysis** — fetch the Reel, propose 4 Hebrew descriptions.
2. **Confirmation** — the researcher picks one (or edits it). *Nothing is written before this.*
3. **Download & rename** — highest-quality MP4 into `videos/`.
4. **Categorization** — append a row and re-render the table.

Steps 3 and 4 are one command:

```bash
python3 scripts/add_entry.py --index 1 \
  --url https://www.instagram.com/reel/XXXX/ \
  --desc "עובד קונדיטוריה מערבב סבון כלים מול המנהל" \
  --genre skit --ritual חשיפה --humor אירוניה --subject לקוח
```

Categories are validated against `taxonomy.py`; an unapproved value aborts the
write. Re-running the same `--index` replaces that row rather than duplicating it.
Add `--cookies cookies.txt` if Instagram requires authentication, or
`--no-download` to catalog an MP4 already present in `videos/`.

## Coding frame

- **סוג הטקס:** חשיפה · צריכה · ייעוץ
- **טכניקת הומור:** סלפסטיק · אירוניה · סאטירה · פרודיה · אי-הבנה · הפתעה · התנהגות ליצנית
- **ז'אנר ויזואלי:** מערכון עלילתי (Skit) · POV · וולוג משמרת · אסתטיקת מזון · הדרכה / הדגמה
- **מושא ההומור:** הלקוח · המסעדה · הצוות · המקצוע

## Delivery

Each confirmed video is pushed straight into the researcher's Drive folder and
upserted as one row in a Google Sheet there, through an Apps Script web app
whose `/exec` URL lives in gitignored `drive_endpoint.txt`. The reference copy
of that script is `scripts/apps_script.gs`; redeploying it adds row shading
(duplicates yellow, blocked rows red) driven by the notes column.

## Corpus status

All 107 serials are coded. 86 videos downloaded; 001-080 and 101-107 carry
real files, row 005 is flagged as blocked behind an Instagram login, and rows
081-100 are flagged duplicates because the supplied link list repeats 061-080
verbatim. Replacement links for those twenty would complete the corpus.
