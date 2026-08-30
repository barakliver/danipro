# -*- coding: utf-8 -*-
"""Approved coding frame for the 107-reel corpus (Trillo; Buijzen & Valkenburg; Shifman)."""

TOTAL = 107
CSV_PATH = "research_database.csv"
VIDEO_DIR = "videos"

HEADERS = [
    "מספר סידורי ולינק",
    "תיאור קצר",
    "ז'אנר ויזואלי",
    "סוג הטקס",
    "טכניקת הומור",
    "מושא ההומור",
]

RITUAL = ["חשיפה", "צריכה", "ייעוץ"]

HUMOR = [
    "סלפסטיק",
    "אירוניה",
    "סאטירה",
    "פרודיה",
    "אי-הבנה",
    "הפתעה",
    "התנהגות ליצנית",
]

GENRE = [
    "מערכון עלילתי (Skit)",
    "POV",
    "וולוג משמרת",
    "אסתטיקת מזון",
    "הדרכה / הדגמה",
]

SUBJECT = [
    "הצוות / המסעדה (הומור עצמי)",
    "הלקוח / הלקוחות",
    "מתחרים",
    "סיטואציה כללית",
]

# Convenience aliases so a coder can type a short form on the CLI.
ALIASES = {
    "skit": "מערכון עלילתי (Skit)",
    "מערכון": "מערכון עלילתי (Skit)",
    "pov": "POV",
    "וולוג": "וולוג משמרת",
    "vlog": "וולוג משמרת",
    "אסתטיקה": "אסתטיקת מזון",
    "הדרכה": "הדרכה / הדגמה",
    "צוות": "הצוות / המסעדה (הומור עצמי)",
    "לקוח": "הלקוח / הלקוחות",
    "לקוחות": "הלקוח / הלקוחות",
    "כללי": "סיטואציה כללית",
}


def resolve(value, allowed, field):
    """Map a raw CLI value onto exactly one approved category, or fail loudly."""
    raw = " ".join(value.split())
    candidate = ALIASES.get(raw.lower(), raw)
    if candidate in allowed:
        return candidate
    # Tolerate case/spacing drift on an otherwise exact category name.
    for item in allowed:
        if item.lower() == candidate.lower():
            return item
    raise SystemExit(
        "ערך לא חוקי בשדה '{}': {!r}\nערכים מאושרים:\n  - {}".format(
            field, value, "\n  - ".join(allowed)
        )
    )
