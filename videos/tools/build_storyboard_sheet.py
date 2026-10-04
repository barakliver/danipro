#!/usr/bin/env python3
"""Build a self-contained storyboard.html sketch sheet for a Before I Do reel project.

Usage: build_storyboard_sheet.py <project-dir> <couples|gift> <version>
Fonts and stills are inlined as data URIs so the sheet opens from file://.
"""
import base64
import pathlib
import re
import sys

proj = pathlib.Path(sys.argv[1]).resolve()
variant = sys.argv[2]
version = sys.argv[3] if len(sys.argv) > 3 else "v1"
root = proj.parent / "before-i-do-couples"  # stills + fonts live here


def data_uri(path: pathlib.Path) -> str:
    mime = {".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".svg": "image/svg+xml"}[path.suffix]
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


frame_md = (root / "frame.md").read_text().splitlines()
start = frame_md.index("<style>")
end = frame_md.index("</style>", start)
font_css = "\n".join(frame_md[start + 1:end])
font_css = re.sub(r'url\("(assets/fonts/[^"]+)"\)', lambda m: f'url("{data_uri(root / m.group(1))}")', font_css)

S = {k: data_uri(root / "assets/stills" / f) for k, f in {
    "7319": "7319.jpg", "7317": "7317.jpg", "7318": "7318.jpg", "7298": "7298.jpg",
    "box": "box.jpg", "dog": "card-dog.png", "back": "card-back.png"}.items()}

HEART = '<svg viewBox="0 0 24 22" class="heart"><path d="M12 21.6 10.3 20C4.2 14.5.2 10.9.2 6.5.2 2.9 3 .1 6.6.1c2 0 4 .9 5.4 2.4C13.4 1 15.4.1 17.4.1 21 .1 23.8 2.9 23.8 6.5c0 4.4-4 8-10.1 13.5L12 21.6Z" fill="#EF453D"/></svg>'
MIC = '<svg viewBox="0 0 24 24" class="mic"><rect x="8" y="2" width="8" height="13" rx="4" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4" stroke="currentColor" stroke-width="2" fill="none"/></svg>'
CAPTION = '<div class="capband">כתוביות · אזור קבוע</div>'

CSS = """
:root{--blue:#4F6BA5;--deep:#1F2C4A;--muted:#3E568A;--red:#EF453D;--tint:#DDE7F5;--alt:#F1F4F9;--ink:#000}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#E9EDF4;color:var(--deep);font-family:Assistant,system-ui,sans-serif;padding:32px 28px 48px}
header{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:22px;direction:rtl}
header h1{font-size:30px;font-weight:700}
header h1 .wm{font-family:Caveat;font-weight:600;color:var(--blue);font-size:38px}
header p{font-size:16px;color:var(--muted);margin-top:4px}
.tag{direction:ltr;background:var(--blue);color:#fff;border-radius:100px;padding:6px 14px;font-size:13px;white-space:nowrap}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:22px;direction:rtl}
.item{display:flex;flex-direction:column;gap:8px}
.cell{aspect-ratio:9/16;container-type:inline-size;position:relative;overflow:hidden;border-radius:12px;background:#fff;box-shadow:0 1px 0 rgba(31,44,74,.08);direction:rtl}
.lbl{display:flex;justify-content:space-between;font-size:12px;font-weight:700;letter-spacing:.04em;color:var(--deep)}
.lbl span:last-child{color:var(--muted);font-weight:500;direction:ltr}
.note{font-size:13px;line-height:1.45;color:#2F3F63}
.note b{color:var(--deep)}
.chip{align-self:flex-start;font-size:11px;direction:ltr;background:var(--tint);color:var(--blue);border-radius:100px;padding:3px 10px;font-weight:600}
.bg{position:absolute;inset:0;background-size:cover;background-position:center}
.shade{position:absolute;inset:0}
.safe{position:absolute;left:5.5cqw;right:5.5cqw;top:10cqh}
.capband{position:absolute;left:6cqw;right:12cqw;top:110cqw;height:15cqw;border:.4cqw dashed rgba(255,255,255,.75);border-radius:2cqw;display:flex;align-items:center;justify-content:center;font-size:3.6cqw;color:rgba(255,255,255,.9);background:rgba(31,44,74,.35)}
.light .capband{border-color:rgba(79,107,165,.45);color:var(--muted);background:rgba(221,231,245,.55)}
.iggutter{position:absolute;right:0;top:95cqw;width:10cqw;bottom:20cqw;background:repeating-linear-gradient(45deg,rgba(239,69,61,.10) 0 1cqw,transparent 1cqw 2.4cqw)}
.h1{font-weight:700;line-height:1.05;letter-spacing:-.02em}
.wm{font-family:Caveat;font-weight:600;direction:ltr;unicode-bidi:isolate}
.heart{width:1em;height:.92em;vertical-align:-.08em}
.mic{width:1em;height:1em;vertical-align:-.12em}
.pill{display:inline-block;border-radius:100px;padding:1.6cqw 4.2cqw;font-weight:600}
.ul{background:linear-gradient(transparent 78%,var(--red) 78% 92%,transparent 92%)}
.strike{position:relative;display:inline-block}
.strike:after{content:"";position:absolute;left:-2%;right:-2%;top:52%;height:1.3cqw;background:var(--red);transform:rotate(-4deg);border-radius:1cqw}
.ph{position:absolute;border:.4cqw dashed rgba(255,255,255,.8);border-radius:2cqw;display:flex;align-items:center;justify-content:center;color:#fff;font-size:3.4cqw;text-align:center;padding:2cqw}
.seam{grid-column:span 2;background:#fff;border-radius:12px;padding:18px 18px 16px;direction:rtl}
.seam h3,.tokens h3{font-size:14px;margin-bottom:10px}
.strip{display:flex;align-items:center;gap:6px;flex-wrap:wrap;direction:rtl}
.strip .f{background:var(--alt);border-radius:8px;padding:6px 9px;font-size:12px;font-weight:700}
.strip .t{font-size:11px;color:var(--muted);direction:ltr}
.tokens{grid-column:span 2;background:#fff;border-radius:12px;padding:18px;direction:rtl}
.sw{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.sw div{width:64px;font-size:10px;color:var(--muted);direction:ltr}
.sw i{display:block;height:34px;border-radius:8px;margin-bottom:4px;border:1px solid rgba(0,0,0,.06)}
.tokens p{font-size:12.5px;line-height:1.5;margin-top:6px}
"""


def item(n, name, times, note, seam, body, light=False, captions=True):
    return f"""<div class="item">
<div class="cell{' light' if light else ''}" id="frame-{n:02d}">{body}<div class="iggutter"></div>{CAPTION if captions else ""}</div>
<div class="lbl"><span>{n:02d} · {name}</span><span>{times}</span></div>
<div class="note">{note}</div>
<span class="chip">{seam}</span></div>"""


def couples():
    cells = [
        item(1, "פתיחה", "0.0–4.5s",
             "<b>נע ראשון:</b> השורה הראשונה נכנסת מלמטה ב-0.1s מעל צילום השולחן המעומעם; ב-“פשוט...” עצירה, ואז “דיברו” מקבלת קו אדום שנמשך מימין לשמאל.",
             "in: cut",
             f"""<div class="bg" style="background-image:url({S['7319']})"></div>
<div class="shade" style="background:linear-gradient(180deg,rgba(31,44,74,.82) 0%,rgba(31,44,74,.62) 55%,rgba(31,44,74,.35) 100%)"></div>
<div class="safe" style="top:22cqw;color:#fff">
 <div class="h1" style="font-size:10.5cqw">רוב הזוגות<br>לא רבים<br>על החתונה.</div>
 <div class="h1" style="font-size:10.5cqw;margin-top:7cqw;color:#DDE7F5">הם פשוט אף פעם<br>לא <span class="ul" style="color:#fff">דיברו</span> עליה.</div>
</div>"""),
        item(2, "הבעיה", "4.5–10.0s",
             "<b>נע ראשון:</b> “כמה אורחים?” קופצת עם overshoot קטן, ואחריה עוד שתיים על המילה שמזכירה אותן. ב-“ופתאום” שלוש הפילולות רועדות ונופלות, והשורה התחתונה נשארת.",
             "in: zoom-through",
             """<div class="bg" style="background:#fff"></div>
<div class="safe" style="top:18cqw">
 <div class="pill" style="background:var(--tint);color:var(--blue);font-size:6.6cqw;margin-bottom:3.6cqw">כמה אורחים?</div><br>
 <div class="pill" style="background:var(--tint);color:var(--blue);font-size:6.6cqw;margin:0 9cqw 3.6cqw 0">מי מהעבודה?</div><br>
 <div class="pill" style="background:var(--tint);color:var(--blue);font-size:6.6cqw;margin-right:3cqw">איפה ההורים נכנסים?</div>
 <div class="h1" style="font-size:9.6cqw;margin-top:10cqw;color:var(--deep)">ופתאום,<br>כל החלטה היא<br><span class="ul">משא ומתן.</span></div>
</div>""", light=True),
        item(3, "הקופסה", "10.0–15.0s",
             "<b>נע ראשון:</b> הצילום שלך מתנגן (יד פותחת את המכסה). “Before I Do” נכתב בכתב יד בדיוק כשהוא נאמר; כרטיס “70 שאלות” עולה מלמטה על “שבעים”.",
             "in: blur-crossfade",
             f"""<div class="bg" style="background-image:url({S['7317']})"></div>
<div class="shade" style="background:linear-gradient(180deg,rgba(31,44,74,.75) 0%,rgba(31,44,74,0) 38%)"></div>
<div class="safe" style="top:12cqw;color:#fff;text-align:center">
 <div class="wm" style="font-size:16cqw;line-height:1">Before I Do {HEART}</div>
 <div style="font-size:5.4cqw;font-weight:600;margin-top:1cqw">משחק קלפים לזוגות מאורסים</div>
</div>
<div style="position:absolute;left:8cqw;right:8cqw;top:80cqw;background:rgba(255,255,255,.94);border-radius:3cqw;padding:4cqw 5cqw;display:flex;align-items:center;gap:4cqw">
 <div style="font-size:17cqw;font-weight:700;color:var(--blue);line-height:.9">70</div>
 <div style="font-size:5.4cqw;font-weight:600;line-height:1.2;color:var(--deep)">שאלות שחובה לשאול<br>לפני החתונה</div>
</div>"""),
        item(4, "איך משחקים", "15.0–20.5s",
             "<b>נע ראשון:</b> קאט לצילום של שליפת הקלף (7318), ובאמצע קאט לקלף ביד (7298). שלושת השלבים נכנסים מימין, כל אחד על המילה שלו; “ועל מה אתם לא מוותרים” נשאר.",
             "in: crossfade",
             f"""<div class="bg" style="background-image:url({S['7298']})"></div>
<div class="shade" style="background:linear-gradient(180deg,rgba(31,44,74,.7) 0%,rgba(31,44,74,0) 45%)"></div>
<div class="safe" style="top:14cqw">
 <div class="pill" style="background:#fff;color:var(--blue);font-size:6cqw;margin-bottom:2.6cqw">01 · פותחים בקבוק</div><br>
 <div class="pill" style="background:#fff;color:var(--blue);font-size:6cqw;margin-bottom:2.6cqw">02 · שולפים קלף</div><br>
 <div class="pill" style="background:var(--red);color:#fff;font-size:6cqw">03 · מדברים</div>
</div>
<div style="position:absolute;left:4cqw;top:56cqw;width:30cqw;aspect-ratio:9/16;border-radius:2cqw;overflow:hidden;border:.6cqw solid #fff;background:url({S['7318']}) center/cover"></div>
<div style="position:absolute;left:4cqw;top:51cqw;font-size:3cqw;color:#fff;opacity:.9">חצי ראשון: 7318</div>"""),
        item(5, "סיום · פריים מוחזק", "20.5–24.5s",
             "<b>נע ראשון:</b> push-in איטי על תמונת הקופסה, והלב פועם פעם אחת. המשפט נשאר בלי תזוזה, זה הפריים המוחזק. בסוף ה-URL נכנס כפילולה כחולה. <b>בלי כתוביות כאן</b>, כי הטקסט על המסך הוא כבר הקריינות.",
             "in: crossfade · end",
             f"""<div class="bg" style="background-image:url({S['box']});background-position:center 70%"></div>
<div class="shade" style="background:linear-gradient(180deg,rgba(255,255,255,.88) 0%,rgba(255,255,255,.55) 32%,rgba(255,255,255,0) 50%)"></div>
<div class="safe" style="top:16cqw;text-align:center">
 <div class="h1" style="font-size:11cqw;color:var(--deep)">שיחה אחת,<br>לפני כל השאר.</div>
</div>
<div style="position:absolute;left:14cqw;right:14cqw;top:104cqw;text-align:center;background:rgba(255,255,255,.93);border-radius:3cqw;padding:3cqw 0 4cqw">
 <div class="wm" style="font-size:13cqw;color:var(--blue)">Before I Do {HEART}</div>
 <div class="pill" style="background:var(--blue);color:#fff;font-size:5.6cqw;margin-top:2cqw;direction:ltr">beforeido.co.il</div>
</div>""", light=True, captions=False),
    ]
    seams = [("01", "cut"), ("02", "zoom-through"), ("03", "blur-crossfade"), ("04", "crossfade"), ("05", "crossfade")]
    return ("רוב הזוגות לא רבים על החתונה. הם פשוט אף פעם לא דיברו עליה.",
            "גרסה 1 · לזוגות מאורסים", "1080×1920 · ~24s · 5 פריימים", cells, seams)


def gift():
    cells = [
        item(1, "פתיחה", "0.0–5.0s",
             "<b>נע ראשון:</b> “החברים התארסו” נכנסת ב-0.1s. משבצת אחת מחליפה מתנות בנאליות בקצב הקול, וכל אחת נמחקת בקו אדום שנמתח.",
             "in: cut",
             f"""<div class="bg" style="background:var(--blue)"></div>
<div class="safe" style="top:16cqw;color:#fff">
 <div style="font-size:7cqw;font-weight:600">החברים התארסו {HEART}</div>
 <div style="font-size:5.4cqw;opacity:.85;margin-top:1cqw">מגיעה להם מתנה. אז...</div>
 <div style="margin-top:12cqw;font-size:8cqw;font-weight:700;opacity:.28">מגבות עם רקמה?</div>
 <div class="h1" style="font-size:12.5cqw;margin:3cqw 0"><span class="strike">עוד סט מצעים?</span></div>
 <div style="font-size:8cqw;font-weight:700;opacity:.28">מסגרת עם השמות?</div>
</div>"""),
        item(2, "הטוויסט", "5.0–9.5s",
             "<b>נע ראשון:</b> zoom-through אל הצילום שלך (פתיחת הקופסה). “עם כל הכבוד למצעים...” קטנה למעלה, ו“אשכרה” מקבלת קו אדום על המילה.",
             "in: zoom-through",
             f"""<div class="bg" style="background-image:url({S['7317']})"></div>
<div class="shade" style="background:linear-gradient(180deg,rgba(31,44,74,.85) 0%,rgba(31,44,74,.55) 42%,rgba(31,44,74,0) 62%)"></div>
<div class="safe" style="top:16cqw;color:#fff">
 <div style="font-size:6cqw;font-weight:600;opacity:.9">עם כל הכבוד למצעים...</div>
 <div class="h1" style="font-size:11cqw;margin-top:4cqw">זו המתנה שהם<br><span class="ul">אשכרה</span> צריכים<br>עכשיו.</div>
</div>"""),
        item(3, "הקלפים", "9.5–15.5s",
             "<b>נע ראשון:</b> גב הקלף מתהפך ונחשף “להביא את הכלב או להשאיר אותו בבית” בדיוק כשזה נאמר. המונה “70” עולה, ובחצי השני קאט לקלף ביד (7298).",
             "in: crossfade",
             f"""<div class="bg" style="background:var(--alt)"></div>
<div class="safe" style="top:12cqw;display:flex;align-items:baseline;gap:2.4cqw">
 <div style="font-size:15cqw;font-weight:700;color:var(--blue);line-height:1">70</div>
 <div style="font-size:6cqw;font-weight:600;color:var(--deep)">קלפים כאלה</div>
</div>
<img src="{S['back']}" style="position:absolute;width:44cqw;left:12cqw;top:44cqw;transform:rotate(-10deg);border-radius:2cqw;box-shadow:0 1cqw 3cqw rgba(31,44,74,.18)">
<img src="{S['dog']}" style="position:absolute;width:50cqw;left:32cqw;top:38cqw;transform:rotate(5deg);border-radius:2cqw;box-shadow:0 1.4cqw 4cqw rgba(31,44,74,.22)">""", light=True),
        item(4, "הבונוס", "15.5–19.5s",
             "<b>נע ראשון:</b> “והבונוס שלכם?” נכנסת מימין. בועות של הודעות קוליות נערמות מהר, כל אחת עם “פופ”, ועל “פחות” כולן נמחקות שמאלה. השורה התחתונה נשארת.",
             "in: push-slide LEFT",
             f"""<div class="bg" style="background:#fff"></div>
<div class="safe" style="top:12cqw">
 <div class="pill" style="background:var(--red);color:#fff;font-size:6cqw">והבונוס שלכם?</div>
 <div style="margin-top:7cqw;display:flex;flex-direction:column;gap:3cqw;align-items:flex-start">
  <div style="background:var(--tint);color:var(--deep);border-radius:4cqw 4cqw 4cqw 1cqw;padding:3cqw 4.4cqw;font-size:5cqw;font-weight:600">{MIC} 0:47 · סידורי הושבה</div>
  <div style="background:var(--tint);color:var(--deep);border-radius:4cqw 4cqw 4cqw 1cqw;padding:3cqw 4.4cqw;font-size:5cqw;font-weight:600;margin-right:6cqw">{MIC} 1:32 · השולחן של הדודים</div>
  <div style="background:var(--tint);color:var(--deep);border-radius:4cqw 4cqw 4cqw 1cqw;padding:3cqw 4.4cqw;font-size:5cqw;font-weight:600;opacity:.6">{MIC} 2:05 · ובן הדוד מחו״ל?</div>
 </div>
 <div class="h1" style="font-size:9.6cqw;margin-top:9cqw;color:var(--deep)">פחות הודעות קוליות<br>על <span class="ul">סידורי הושבה.</span></div>
</div>""", light=True),
        item(5, "סיום", "19.5–23.0s",
             "<b>נע ראשון:</b> push-in על תמונת הקופסה ותגית “מגיע ארוז ומוכן למסירה” נתלית. הלוגו וה-URL נכנסים, ואז הקריצה הקטנה, שנשארת על המסך עד הסוף. <b>בלי כתוביות כאן</b>, כי הטקסט על המסך הוא כבר הקריינות.",
             "in: crossfade · end",
             f"""<div class="bg" style="background-image:url({S['box']});background-position:center 70%"></div>
<div class="shade" style="background:linear-gradient(180deg,rgba(255,255,255,.9) 0%,rgba(255,255,255,.55) 34%,rgba(255,255,255,0) 52%)"></div>
<div class="safe" style="top:14cqw;text-align:center">
 <div class="wm" style="font-size:15cqw;color:var(--blue);line-height:1">Before I Do {HEART}</div>
 <div class="pill" style="background:var(--red);color:#fff;font-size:5.6cqw;margin-top:3cqw">מגיע ארוז ומוכן למסירה</div>
 <div style="font-size:4.6cqw;color:var(--deep);margin-top:4cqw;font-weight:600">אחד לזוג. אלא אם אתם מכירים<br>עוד זוג שמתחתן.</div>
</div>
<div style="position:absolute;left:0;right:0;top:112cqw;text-align:center">
 <div class="pill" style="background:var(--blue);color:#fff;font-size:5.6cqw;direction:ltr">beforeido.co.il</div>
</div>""", light=True, captions=False),
    ]
    seams = [("01", "cut"), ("02", "zoom-through"), ("03", "crossfade"), ("04", "push-slide LEFT"), ("05", "crossfade")]
    return ("עם כל הכבוד לעוד סט מצעים, זו המתנה היחידה שהם אשכרה צריכים עכשיו.",
            "גרסה 2 · לחברים שקונים מתנה", "1080×1920 · ~23s · 5 פריימים", cells, seams)


dek, title, tag, cells, seams = couples() if variant == "couples" else gift()
seam_cell = f"""<div class="seam"><h3>מפת מעברים</h3><div class="strip">{"".join(f'<span class="t">{t}</span><span class="f">{n}</span>' for n, t in seams)}</div>
<p class="note" style="margin-top:12px"><b>חוט מקשר:</b> הקופסה הכחולה. היא מופיעה בצילומים, נפתחת באמצע ונסגרת בסוף (callback). כיוון התנועה בכל הסרט: מימין לשמאל, כמו קריאה בעברית.</p>
<p class="note" style="margin-top:8px"><b>אזורים בטוחים:</b> הפס המקווקו הוא הכתוביות (קבוע, 62%–70% מהגובה). הפס המקווקו האדום בצד ימין שמור לכפתורים של אינסטגרם. הטקסט החשוב נמצא מעל הכתוביות.</p></div>"""
tokens_cell = """<div class="tokens"><h3>טוקנים (מהאתר)</h3>
<div class="sw"><div><i style="background:#4F6BA5"></i>#4F6BA5 blue</div><div><i style="background:#1F2C4A"></i>#1F2C4A deep</div><div><i style="background:#3E568A"></i>#3E568A muted</div><div><i style="background:#EF453D"></i>#EF453D heart</div><div><i style="background:#DDE7F5"></i>#DDE7F5 tint</div><div><i style="background:#F1F4F9"></i>#F1F4F9 alt</div></div>
<p><b>טיפוגרפיה:</b> Assistant 700 לכותרות, Assistant 600 לפילולות, ו-<span style="font-family:Caveat;font-size:17px;color:#4F6BA5">Before I Do</span> בכתב יד (Caveat) רק ללוגו.</p>
<p><b>לא עושים:</b> בלי גלואו, בלי צלליות כבדות, בלי UI מזויף של המוצר, בלי "סליידשואו" (כל פריים כרטיס חדש) ובלי "שומר מסך" (תנועה שלא אומרת כלום).</p></div>"""

html = f"""<!doctype html><html lang="he"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Before I Do · storyboard {version}</title><style>{font_css}
{CSS}</style></head><body>
<header><div><h1><span class="wm">Before I Do</span> · {title} <span style="font-size:16px;color:#3E568A">{version}</span></h1><p>{dek}</p></div><span class="tag">{tag}</span></header>
<div class="grid">{''.join(cells)}{seam_cell}{tokens_cell}</div></body></html>"""
(proj / "storyboard.html").write_text(html)
print(proj / "storyboard.html", len(html) // 1024, "KB")
