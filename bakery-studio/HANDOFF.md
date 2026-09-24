# סיכום פרויקט: צילום סטודיו למאפים באמצעות AI

> להדביק את כל המסמך בתחילת צ'אט חדש, יחד עם תמונת ההשראה ועם 1–2 תמונות שלי.

## 1. המטרה
אני רוצה להפוך תמונות שלי של לחמים ומאפים לתמונות שנראות כאילו צולמו בסט צילום מקצועי,
**בסגנון אחד מדויק** (תמונת ההשראה, מתואר בסעיף 3). התאורה צריכה להשתפר, והתוצאה צריכה להיות
איכותית ומגרה, בלי לשנות את המאפה עצמו.

- **שימוש:** אישי, בערך 10 תמונות. אין צורך בפלטפורמה מסחרית.
- **כלי מומלץ:** Google AI Studio (aistudio.google.com), במודל עריכת התמונות של Gemini
  ("Nano Banana" / `gemini-2.5-flash-image`, או גרסה חדשה יותר אם יש). חינם או כמעט חינם
  בהיקף כזה.
- **שיטת עבודה:** מעלים 2 תמונות: קודם את התמונה שלי, אחריה את תמונת ההשראה. אז מדביקים את ההנחיה.

## 2. מה אני רוצה ומה לא (ההערות שלי עד עכשיו)
- ✅ המאפה או הכיכר **מוצגים במלואם**, במרכז, עם הרבה שטח ריק סביבם.
- ❌ **בלי תקריבים ובלי חיתוך** של המוצר.
- ❌ **בלי פירורים**, קמח, כתמים או אביזרים. ניקיון מוחלט כמו בהשראה.
- ⚠️ **גוון הרקע** לא יצא נכון בניסיון הראשון (יצא צהוב/קראפט מדי).
- ⚠️ **חסר עומק** לעומת תמונת ההשראה (התוצאה נראתה שטוחה).

## 3. ניתוח תמונת ההשראה
תמונת ההשראה היא קולאז' של 12 מאפים מרובדים (קרואסונים, רולים, טארטים, דניש עם פירות).
כולם צולמו באותו סט:

| מאפיין | תיאור |
| --- | --- |
| רקע | נייר מט רציף בלי קו אופק. הגוון **חול־טאופ אפרפר, לא צהוב ולא כתום**. |
| צבע מדוד (דגימת פיקסלים) | כ־`#C9B8A6` בחלק העליון, מתכהה בהדרגה לכ־`#B3A390` בחלק התחתון. |
| קומפוזיציה | מוצר אחד במרכז, קטן יחסית (בערך 30–45% מרוחב הפריים), הרבה שטח ריק. |
| זווית | בגובה המוצר או מעט מעליו (10–15°), מבט מהצד. |
| תאורה | אור רך ומפוזר יחיד מקדימה־שמאל, כמו חלון ביום מעונן. |
| צל | צל מגע רך מתחת למוצר וצל עדין שנופל ימינה. |
| עומק | נוצר מהדרגתיות בגוון הרקע, מצל המגע ומטשטוש עדין של הרקע, כשהמוצר חד. |
| צבעוניות | שקטה, חמה־ניטרלית, מראה של פילם. הרקע בגוון "גרז'" (אפור־בז') לא רווי, והמאפה בגוון זהב־קרמל עשיר. |
| אווירה | מינימליסטית, עריכתית, מאפייה יוקרתית, סדרה אחידה. |

## 4. ההנחיה העדכנית (הגרסה האחרונה, עדיין לא נבדקה מול תוצאה)

```
Re-photograph the bread from the FIRST image in the exact photographic style of the SECOND image (style reference only - do not copy its pastries).

PRODUCT: keep my bread exactly as it is - same shape, scoring, crust color and texture, toppings. Show the ENTIRE loaf, fully visible and uncropped, centered, taking about 40% of the frame width with generous even empty space on all sides. Not a close-up.

BACKGROUND: seamless matte paper sweep in a muted greyish sand-taupe - NOT yellow, NOT orange, NOT brown kraft. About #C9B8A6 at the top softly darkening to about #B3A390 at the bottom, no horizon line, fine paper grain. Perfectly clean and empty: no crumbs, no flour, no seeds, no specks, no props, no board, no cloth.

LIGHT & DEPTH: one large soft diffused light from the front-left, like overcast window light. Gentle light falloff so the backdrop has a subtle gradient. A soft grounded contact shadow right under the loaf and a gentle soft shadow falling to the right. 100mm lens at f/4, eye-level to slightly elevated: the whole loaf sharp, the backdrop softly out of focus for a three-dimensional look.

GRADE: quiet minimalist editorial look, muted warm-neutral tones, soft film-like grade with slightly lifted blacks. Background stays low-saturation greige; the bread keeps rich golden-brown crust. Photorealistic, no text, no hands.
```

### תיקונים מהירים (לכתוב באותה שיחה אחרי תוצאה)
- רקע צהוב או כתום מדי: `Make the background cooler and greyer, less yellow, like #C4B5A5`
- המוצר חתוך או גדול: `Zoom out - show the whole loaf with more empty space around it`
- נשארו פירורים: `Remove every crumb and speck from the paper, keep it perfectly clean`
- נראה שטוח: `Add more depth: softer, more blurred background and a clearer soft shadow under the loaf`
- אחידות בין תמונות: `Match the background tone and brightness of the previous image`

### טיפים
- להשתמש **באותה הנחיה בדיוק** לכל 10 התמונות, ובאותו יחס תמונה (1:1 או 4:5).
- הכי טוב שהתמונה המקורית תצולם מהצד, בגובה המאפה, בפוקוס, והמאפה במלואו בתוך הפריים.
- ההנחיות עובדות טוב יותר באנגלית.

## 5. מה נבנה עד עכשיו (קוד, לא חובה לשימוש אישי)
ב־GitHub: `barakliver/danipro`, ענף `claude/awesome-allen-uhorjx`, תיקייה `bakery-studio/`.
- אפליקציית FastAPI עם ממשק בעברית: העלאת כמה תמונות, בחירה או עריכה של סגנון, סליידר לפני/אחרי, הורדה, היסטוריה.
- מנועים: Gemini (`GEMINI_API_KEY`), OpenAI gpt-image-1 (`OPENAI_API_KEY`), ושיפור מקומי בלי AI
  (תאורה וצבע בלבד, לא מחליף רקע).
- `styles.json` כולל את הסגנון "מינימליסטי על נייר קראפט" עם כל הפרמטרים שלמעלה, ועוד 5 סגנונות.
- הרצה: `cd bakery-studio && pip install -r requirements.txt && export GEMINI_API_KEY=... && uvicorn app:app`
- **מגבלה:** האפליקציה עדיין לא תומכת בהעלאת תמונת השראה כרפרנס (רק טקסט). זה השיפור הראשון שכדאי להוסיף בגרסה הבאה.
- **לא נבדק:** המנועים עם AI (Gemini ו־OpenAI) לא הורצו מול API אמיתי, כי לא היה מפתח. נבדק רק מצב השיפור המקומי.

## 6. מה לבקש בצ'אט החדש
1. לבדוק את התוצאה שיצאה לי מול תמונת ההשראה ולכוון את ההנחיה (גוון, עומק, גודל המוצר).
2. אופציונלי: להתאים את ההנחיה לכל סוג מאפה (כיכר גדולה, מאפה קטן, מאפה עם פירות או קרם).
3. אופציונלי: לשדרג את האפליקציה כך שתתמוך בתמונת השראה, בכמה גרסאות לכל תמונה ובעיבוד של כל 10 התמונות בבת אחת.
