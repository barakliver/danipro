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

## Known environment constraint

`www.instagram.com:443` is denied by this session's egress policy, so Reels
cannot be fetched from inside the container. The catalog pipeline itself is
verified and unaffected.
