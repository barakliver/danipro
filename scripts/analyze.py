#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""כלי ניתוח מתמטי: הצלבת סוג הטקס × טכניקת הומור מול מדד המעורבות.

קורא את research_database.csv ומפיק:
  1. טבלת הצלבה (טקס × טכניקה) עם מדד מעורבות משוקלל ממוצע/חציוני.
  2. דירוג כל השילובים מהגבוה לנמוך.
  3. ניתוח שוליים לכל מימד בנפרד (טקס, טכניקה, ז'אנר, מושא).
  4. מסקנות סטטיסטיות מנומקות.

מדד המעורבות המשוקלל = (לייקים + 5·תגובות) / צפיות · 100
(משקל התגובה פי 5 מהלייק, לפי הגדרת המשתמש), מנורמל לכל צפייה כך שאינו מוטה
לטובת סרטונים ויראליים בערכים מוחלטים.

הרצה:
  python3 scripts/analyze.py                 # דוח טקסט למסך
  python3 scripts/analyze.py --csv out.csv   # גם טבלת הצלבה כ-CSV
  python3 scripts/analyze.py --json out.json # גם פלט מובנה ל-JSON
"""
import argparse
import csv
import json
import math
import statistics as st
from collections import defaultdict

CSV_PATH = "research_database.csv"
RITUAL_COL = "סוג הטקס"
HUMOR_COL = "טכניקת הומור"
GENRE_COL = "ז'אנר ויזואלי"
SUBJECT_COL = "מושא ההומור"


def num(s):
    """המרת מחרוזת (עם % או פסיקי אלפים) למספר, או None אם ריק/לא-מספרי."""
    s = (s or "").replace("%", "").replace(",", "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def load(path=CSV_PATH):
    """טעינת השורות עם חישוב-מחדש של מדד המעורבות מהנתונים הגולמיים."""
    rows = []
    for r in csv.DictReader(open(path, encoding="utf-8-sig")):
        likes = num(r.get("לייקים")) or 0.0
        plays = num(r.get("צפיות (Plays)")) or 0.0
        comments = num(r.get("תגובות")) or 0.0
        if plays <= 0:
            continue  # ללא צפיות אין ממה לגזור אחוזים
        weighted = (likes + 5 * comments) / plays * 100.0
        plain = (likes + comments) / plays * 100.0
        rows.append({
            "idx": r.get("מספר סידורי", "").strip(),
            "ritual": r.get(RITUAL_COL, "").strip(),
            "humor": r.get(HUMOR_COL, "").strip(),
            "genre": r.get(GENRE_COL, "").strip(),
            "subject": r.get(SUBJECT_COL, "").strip(),
            "likes": likes,
            "plays": plays,
            "comments": comments,
            "likes_pct": likes / plays * 100.0,
            "comments_pct": comments / plays * 100.0,
            "weighted": weighted,
            "plain": plain,
        })
    return rows


def agg(values):
    """סטטיסטיקה מסכמת לרשימת ערכים."""
    values = [v for v in values if v is not None]
    n = len(values)
    if n == 0:
        return dict(n=0, mean=0, median=0, sd=0, mn=0, mx=0)
    mean = st.mean(values)
    return dict(
        n=n,
        mean=mean,
        median=st.median(values),
        sd=st.pstdev(values) if n > 1 else 0.0,
        mn=min(values),
        mx=max(values),
    )


def group_by(rows, key):
    g = defaultdict(list)
    for r in rows:
        g[r[key]].append(r)
    return g


def fmt(x, p=2):
    return f"{x:.{p}f}"


def bar(x, xmax, width=28):
    if xmax <= 0:
        return ""
    return "█" * max(1, round(x / xmax * width)) if x > 0 else ""


# ---------------------------------------------------------------- ניתוח שוליים
def marginal_report(rows, key, title, lines):
    lines.append("")
    lines.append(f"### {title}")
    lines.append(f"{'קטגוריה':<26}{'n':>4}{'מדד משוקלל ממוצע':>20}{'חציון':>9}{'לייקים%':>10}{'תגובות%':>10}")
    lines.append("-" * 88)
    g = group_by(rows, key)
    stats = []
    for name, grp in g.items():
        w = agg([r["weighted"] for r in grp])
        lk = agg([r["likes_pct"] for r in grp])
        cm = agg([r["comments_pct"] for r in grp])
        stats.append((name, w, lk, cm))
    stats.sort(key=lambda t: t[1]["mean"], reverse=True)
    wmax = max((s[1]["mean"] for s in stats), default=1)
    for name, w, lk, cm in stats:
        lines.append(
            f"{name:<26}{w['n']:>4}{fmt(w['mean']):>18}%{fmt(w['median']):>8}%"
            f"{fmt(lk['mean']):>9}%{fmt(cm['mean'],3):>9}%  {bar(w['mean'], wmax)}"
        )
    return stats


# ------------------------------------------------------------- טבלת הצלבה
def cross_table(rows):
    cells = defaultdict(list)
    rituals, humors = set(), set()
    for r in rows:
        cells[(r["ritual"], r["humor"])].append(r)
        rituals.add(r["ritual"])
        humors.add(r["humor"])
    combos = []
    for (ri, hu), grp in cells.items():
        w = agg([r["weighted"] for r in grp])
        pl = agg([r["plays"] for r in grp])
        cm = agg([r["comments_pct"] for r in grp])
        lk = agg([r["likes_pct"] for r in grp])
        combos.append({
            "ritual": ri, "humor": hu, "n": w["n"],
            "w_mean": w["mean"], "w_median": w["median"], "w_sd": w["sd"],
            "plays_median": pl["median"], "likes_pct": lk["mean"],
            "comments_pct": cm["mean"],
            "examples": sorted(grp, key=lambda r: r["weighted"], reverse=True)[:3],
        })
    combos.sort(key=lambda c: c["w_mean"], reverse=True)
    return combos, sorted(rituals), sorted(humors)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", help="כתיבת טבלת ההצלבה ל-CSV")
    ap.add_argument("--json", help="כתיבת פלט מובנה ל-JSON")
    ap.add_argument("--min-n", type=int, default=3,
                    help="סף מדגם ל'שילוב מבוסס' (ברירת מחדל 3)")
    args = ap.parse_args()

    rows = load()
    N = len(rows)
    lines = []
    lines.append("=" * 88)
    lines.append("ניתוח מתמטי: הצלבת סוג הטקס × טכניקת הומור מול מדד המעורבות")
    lines.append(f"מדגם: {N} סרטונים · מדד = (לייקים + 5·תגובות) / צפיות · 100")
    lines.append("=" * 88)

    # -- בסיס להשוואה: מדד כלל-מדגמי
    all_w = agg([r["weighted"] for r in rows])
    lines.append("")
    lines.append(f"מדד מעורבות משוקלל כלל-מדגמי:  ממוצע {fmt(all_w['mean'])}%  ·  "
                 f"חציון {fmt(all_w['median'])}%  ·  ס\"ת {fmt(all_w['sd'])}%  ·  "
                 f"טווח {fmt(all_w['mn'])}%–{fmt(all_w['mx'])}%")

    # -- טבלת הצלבה מלאה, מדורגת
    combos, rituals, humors = cross_table(rows)
    lines.append("")
    lines.append("=" * 88)
    lines.append("דירוג שילובי טקס × טכניקה (מהמעורבות הגבוהה לנמוכה)")
    lines.append("=" * 88)
    lines.append(f"{'#':>3}  {'טקס':<8}{'טכניקה':<26}{'n':>3}{'משוקלל ממוצע':>15}{'חציון':>9}{'צפיות(חציון)':>15}")
    lines.append("-" * 88)
    wmax = max((c["w_mean"] for c in combos), default=1)
    for i, c in enumerate(combos, 1):
        flag = "" if c["n"] >= args.min_n else "  ⚠"  # מדגם קטן
        lines.append(
            f"{i:>3}  {c['ritual']:<8}{c['humor']:<26}{c['n']:>3}"
            f"{fmt(c['w_mean']):>13}%{fmt(c['w_median']):>8}%"
            f"{int(c['plays_median']):>15,}{flag}"
        )
    lines.append("")
    lines.append(f"⚠ = מדגם קטן (n<{args.min_n}); הממוצע רגיש לתצפית בודדת ומובא בזהירות.")

    # -- מטריצת הצלבה חזותית (טקס בשורות, טכניקה בעמודות)
    lines.append("")
    lines.append("=" * 88)
    lines.append("מטריצת הצלבה — מדד משוקלל ממוצע (%)  [n בסוגריים]")
    lines.append("=" * 88)
    cellmap = {(c["ritual"], c["humor"]): c for c in combos}
    colw = 16
    corner = "טקס \\ טכניקה"
    abbr = {"התנהגות ליצנית / הפתעה": "ליצנית/הפתעה"}
    header = f"{corner:<10}" + "".join(f"{abbr.get(h, h)[:14]:>{colw}}" for h in humors)
    lines.append(header)
    for ri in rituals:
        cells = []
        for hu in humors:
            c = cellmap.get((ri, hu))
            cells.append(f"{fmt(c['w_mean'])}({c['n']})" if c else "·")
        lines.append(f"{ri:<10}" + "".join(f"{x:>{colw}}" for x in cells))

    # -- ניתוח שוליים
    lines.append("")
    lines.append("=" * 88)
    lines.append("ניתוח שוליים — כל מימד בנפרד")
    lines.append("=" * 88)
    ritual_stats = marginal_report(rows, "ritual", "לפי סוג הטקס", lines)
    humor_stats = marginal_report(rows, "humor", "לפי טכניקת הומור", lines)
    genre_stats = marginal_report(rows, "genre", "לפי ז'אנר ויזואלי", lines)
    subject_stats = marginal_report(rows, "subject", "לפי מושא ההומור", lines)

    # -- מסקנות
    lines.append("")
    lines.append("=" * 88)
    lines.append("מסקנות")
    lines.append("=" * 88)
    concl = derive_conclusions(rows, combos, ritual_stats, humor_stats,
                               genre_stats, subject_stats, all_w, args.min_n)
    for i, c in enumerate(concl, 1):
        lines.append(f"{i}. {c}")

    report = "\n".join(lines)
    print(report)

    if args.csv:
        with open(args.csv, "w", encoding="utf-8-sig", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["דירוג", "סוג הטקס", "טכניקת הומור", "מספר סרטונים",
                        "מדד משוקלל ממוצע (%)", "מדד משוקלל חציוני (%)",
                        "סטיית תקן (%)", "צפיות חציון", "לייקים% ממוצע",
                        "תגובות% ממוצע"])
            for i, c in enumerate(combos, 1):
                w.writerow([i, c["ritual"], c["humor"], c["n"],
                            fmt(c["w_mean"]), fmt(c["w_median"]), fmt(c["w_sd"]),
                            int(c["plays_median"]), fmt(c["likes_pct"]),
                            fmt(c["comments_pct"], 3)])
        print(f"\n[נכתב] טבלת הצלבה → {args.csv}")

    if args.json:
        def marg(stats):
            return [{"name": s[0], "n": s[1]["n"], "mean": s[1]["mean"],
                     "median": s[1]["median"], "likes_pct": s[2]["mean"],
                     "comments_pct": s[3]["mean"]} for s in stats]
        payload = {
            "n": N,
            "overall_weighted": all_w,
            "rituals": rituals,
            "humors": humors,
            "combos": [{k: v for k, v in c.items() if k != "examples"}
                       for c in combos],
            "marginals": {
                "ritual": marg(ritual_stats),
                "humor": marg(humor_stats),
                "genre": marg(genre_stats),
                "subject": marg(subject_stats),
            },
            "conclusions": concl,
        }
        json.dump(payload, open(args.json, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)
        print(f"[נכתב] פלט מובנה → {args.json}")


def derive_conclusions(rows, combos, ritual_stats, humor_stats, genre_stats,
                       subject_stats, all_w, min_n):
    """גזירת מסקנות כמותיות מהנתונים."""
    out = []
    robust = [c for c in combos if c["n"] >= min_n]

    # 1. השילוב המנצח (מבוסס)
    if robust:
        top = robust[0]
        lift = (top["w_mean"] / all_w["mean"] - 1) * 100
        out.append(
            f"השילוב המנצח מבין המבוססים (n≥{min_n}) הוא «{top['ritual']} × "
            f"{top['humor']}» — מדד משוקלל ממוצע {fmt(top['w_mean'])}% "
            f"(n={top['n']}), גבוה ב-{fmt(lift,0)}% מהממוצע הכלל-מדגמי "
            f"({fmt(all_w['mean'])}%)."
        )
        bottom = robust[-1]
        out.append(
            f"השילוב החלש ביותר מבין המבוססים הוא «{bottom['ritual']} × "
            f"{bottom['humor']}» — {fmt(bottom['w_mean'])}% (n={bottom['n']}); "
            f"פער של פי {fmt(top['w_mean']/bottom['w_mean'],1)} בין המנצח לחלש."
        )

    # 2. מימד מסביר יותר: טקס מול טכניקה (טווח השונות בין הקטגוריות)
    def spread(stats):
        means = [s[1]["mean"] for s in stats if s[1]["n"] >= min_n]
        return (max(means) - min(means)) if len(means) > 1 else 0
    sr, sh = spread(ritual_stats), spread(humor_stats)
    if sr and sh:
        stronger = "טכניקת ההומור" if sh > sr else "סוג הטקס"
        out.append(
            f"בין שני המימדים, {stronger} מסביר יותר את פיזור המעורבות: "
            f"טווח הממוצעים בין הטכניקות הוא {fmt(sh)} נק' אחוז לעומת "
            f"{fmt(sr)} נק' בין סוגי הטקס — כלומר בחירת סוג ההומור משפיעה "
            f"על המעורבות יותר מבחירת אופי הטקס."
        )

    # 3. טכניקה מובילה (שוליים)
    top_h = [s for s in humor_stats if s[1]["n"] >= min_n]
    if top_h:
        h = top_h[0]
        out.append(
            f"טכניקת ההומור עם המעורבות הגבוהה ביותר (בבידוד) היא «{h[0]}» — "
            f"ממוצע {fmt(h[1]['mean'])}% על פני {h[1]['n']} סרטונים; "
            f"הטכניקה החלשה היא «{top_h[-1][0]}» ({fmt(top_h[-1][1]['mean'])}%)."
        )

    # 4. תרומת התגובות אל מול הלייקים (עקב המשקל פי 5)
    hi_comment = sorted(rows, key=lambda r: r["comments_pct"], reverse=True)[:10]
    from collections import Counter
    hc_humor = Counter(r["humor"] for r in hi_comment).most_common(1)[0]
    out.append(
        f"מאחר שהתגובה שוקללה פי 5, הסרטונים מעוררי-הדיון קופצים בדירוג: "
        f"ב-10 הסרטונים עם יחס התגובות/צפיות הגבוה ביותר, הטכניקה הנפוצה "
        f"ביותר היא «{hc_humor[0]}» ({hc_humor[1]} מתוך 10) — כלומר טכניקה זו "
        f"מייצרת אינטראקציה פעילה (תגובות) ולא רק צפייה פסיבית."
    )

    # 5. ז'אנר מוביל
    top_g = [s for s in genre_stats if s[1]["n"] >= min_n]
    if top_g:
        out.append(
            f"ברמת הז'אנר הוויזואלי, «{top_g[0][0]}» מוביל במעורבות "
            f"({fmt(top_g[0][1]['mean'])}%, n={top_g[0][1]['n']}) ו«{top_g[-1][0]}» "
            f"סוגר ({fmt(top_g[-1][1]['mean'])}%)."
        )

    # 6. מושא ההומור
    top_s = [s for s in subject_stats if s[1]["n"] >= min_n]
    if top_s:
        out.append(
            f"לפי מושא ההומור, הכי מעורבים סרטונים שמושאם «{top_s[0][0]}» "
            f"({fmt(top_s[0][1]['mean'])}%); הכי פחות «{top_s[-1][0]}» "
            f"({fmt(top_s[-1][1]['mean'])}%)."
        )

    # 7. פיזור וזהירות סטטיסטית
    small = [c for c in combos if c["n"] < min_n]
    out.append(
        f"מבחינה מתודולוגית: מתוך {len(combos)} השילובים שנצפו בפועל, "
        f"{len(small)} מבוססים על פחות מ-{min_n} סרטונים ולכן אינם מובהקים; "
        f"סוג הטקס «חשיפה» שולט במדגם ({sum(1 for r in rows if r['ritual']=='חשיפה')} "
        f"מתוך {len(rows)}), כך שהשוואות בתוך «חשיפה» אמינות יותר מהשוואות "
        f"בין סוגי טקס נדירים."
    )

    # 8. קורלציה: האם ויראליות (צפיות) הולכת עם מעורבות?
    xs = [math.log10(r["plays"]) for r in rows]
    ys = [r["weighted"] for r in rows]
    r_pearson = pearson(xs, ys)
    if abs(r_pearson) < 0.1:
        out.append(
            f"קורלציה בין היקף החשיפה (log צפיות) למדד המעורבות: r={fmt(r_pearson)} "
            f"— אין קשר ליניארי משמעותי: מדד המעורבות המשוקלל אינו נגזר מהיקף "
            f"הצפיות אלא מאיכות התוכן, ולכן ההשוואה בין השילובים תקפה גם כשהם "
            f"נבדלים מאוד בהיקף החשיפה."
        )
    else:
        direction = "שלילי" if r_pearson < 0 else "חיובי"
        out.append(
            f"קורלציה בין היקף החשיפה (log צפיות) למדד המעורבות: r={fmt(r_pearson)} "
            f"({direction}) — ככל שסרטון ויראלי יותר בצפיות, אחוז המעורבות שלו "
            f"{'נוטה לרדת (הקהל הרחב פחות מגיב יחסית)' if r_pearson < 0 else 'נוטה לעלות'}."
        )

    return out


def pearson(xs, ys):
    n = len(xs)
    if n < 2:
        return 0.0
    mx, my = sum(xs) / n, sum(ys) / n
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    vx = sum((x - mx) ** 2 for x in xs)
    vy = sum((y - my) ** 2 for y in ys)
    if vx <= 0 or vy <= 0:
        return 0.0
    return cov / math.sqrt(vx * vy)


if __name__ == "__main__":
    main()
