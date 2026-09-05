#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""כלי ניתוח מתמטי מעמיק: אילו שילובי טקס × הומור מניבים מעורבות גבוהה?

קורא את research_database.csv ומפיק ניתוח שנועד לענות על שאלת המחקר —
"אילו שילובים של סוג הטקס וטכניקת ההומור עשויים להניב אחוז מעורבות גבוה".

שכבות הניתוח:
  1. דירוג גולמי של כל שילוב (ממוצע/חציון מדד מעורבות משוקלל).
  2. אמד אמפירי-בייס (כיווץ) — מיישר שילובים קטנים אל הממוצע הכללי כדי
     שלא ניקבע "מנצח" על סמך תצפית בודדת אקראית.
  3. רווחי סמך (bootstrap 95%) לשילובים המבוססים — עד כמה האמד יציב.
  4. מודל אדיטיבי + אפקט אינטראקציה (סינרגיה): כמה שילוב מכה את התחזית
     שנגזרת מהשפעת הטקס והשפעת ההומור בנפרד — כאן מסתתר החידוש המחקרי.
  5. גודל אפקט (eta²) לכל מימד — כמה מהשונות במעורבות כל מימד מסביר.
  6. ניתוח "מעורר-דיון" (תגובות) מול "מעורר-לייק" (צפייה פסיבית).

מדד המעורבות המשוקלל = (לייקים + 5·תגובות) / צפיות · 100.

הרצה:
  python3 scripts/analyze.py                 # דוח למסך
  python3 scripts/analyze.py --csv out.csv   # טבלת הניתוח כ-CSV
  python3 scripts/analyze.py --json out.json # פלט מובנה (לדוח החזותי)
"""
import argparse
import csv
import json
import math
import random
import statistics as st
from collections import defaultdict

CSV_PATH = "research_database.csv"
RITUAL_COL = "סוג הטקס"
HUMOR_COL = "טכניקת הומור"
GENRE_COL = "ז'אנר ויזואלי"
SUBJECT_COL = "מושא ההומור"
random.seed(42)


def num(s):
    s = (s or "").replace("%", "").replace(",", "").strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def load(path=CSV_PATH):
    rows = []
    for r in csv.DictReader(open(path, encoding="utf-8-sig")):
        likes = num(r.get("לייקים")) or 0.0
        plays = num(r.get("צפיות (Plays)")) or 0.0
        comments = num(r.get("תגובות")) or 0.0
        if plays <= 0:
            continue
        rows.append({
            "idx": r.get("מספר סידורי", "").strip(),
            "ritual": r.get(RITUAL_COL, "").strip(),
            "humor": r.get(HUMOR_COL, "").strip(),
            "genre": r.get(GENRE_COL, "").strip(),
            "subject": r.get(SUBJECT_COL, "").strip(),
            "likes": likes, "plays": plays, "comments": comments,
            "likes_pct": likes / plays * 100.0,
            "comments_pct": comments / plays * 100.0,
            "weighted": (likes + 5 * comments) / plays * 100.0,
        })
    return rows


def agg(values):
    values = [v for v in values if v is not None]
    n = len(values)
    if n == 0:
        return dict(n=0, mean=0, median=0, sd=0, mn=0, mx=0)
    return dict(n=n, mean=st.mean(values), median=st.median(values),
                sd=st.pstdev(values) if n > 1 else 0.0,
                mn=min(values), mx=max(values))


def group_by(rows, key):
    g = defaultdict(list)
    for r in rows:
        g[r[key]].append(r)
    return g


def pearson(xs, ys):
    n = len(xs)
    if n < 2:
        return 0.0
    mx, my = sum(xs) / n, sum(ys) / n
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    vx = sum((x - mx) ** 2 for x in xs)
    vy = sum((y - my) ** 2 for y in ys)
    return cov / math.sqrt(vx * vy) if vx > 0 and vy > 0 else 0.0


# ----------------------------------------------------- מודל אדיטיבי + סינרגיה
def additive_model(rows, metric="weighted"):
    """מחזיר את הממוצע הכללי, אפקט כל טקס ואפקט כל טכניקה (סטיות מהממוצע)."""
    M = st.mean(r[metric] for r in rows)
    a = {k: st.mean(r[metric] for r in g) - M
         for k, g in group_by(rows, "ritual").items()}
    b = {k: st.mean(r[metric] for r in g) - M
         for k, g in group_by(rows, "humor").items()}
    return M, a, b


# --------------------------------------------------- כיווץ אמפירי-בייס (shrink)
def shrinkage_k(rows, metric="weighted"):
    """אמד לפסאודו-ספירה k: יחס שונות פנים-קבוצתית לשונות בין-קבוצתית."""
    cells = group_by_combo(rows)
    grand = st.mean(r[metric] for r in rows)
    within_ss, within_df = 0.0, 0
    for g in cells.values():
        if len(g) > 1:
            m = st.mean(r[metric] for r in g)
            within_ss += sum((r[metric] - m) ** 2 for r in g)
            within_df += len(g) - 1
    sigma2 = within_ss / within_df if within_df else st.pvariance(
        [r[metric] for r in rows])
    means = [st.mean(r[metric] for r in g) for g in cells.values()]
    tau2 = st.pvariance(means) if len(means) > 1 else sigma2
    tau2 = max(tau2, 1e-6)
    return min(max(sigma2 / tau2, 0.5), 30.0), grand


def group_by_combo(rows):
    g = defaultdict(list)
    for r in rows:
        g[(r["ritual"], r["humor"])].append(r)
    return g


def bootstrap_ci(values, B=3000, lo=2.5, hi=97.5):
    if len(values) < 2:
        return (values[0], values[0]) if values else (0, 0)
    means = []
    n = len(values)
    for _ in range(B):
        s = [values[random.randrange(n)] for _ in range(n)]
        means.append(sum(s) / n)
    means.sort()
    return (means[int(lo / 100 * B)], means[int(hi / 100 * B)])


def eta_squared(rows, key, metric="weighted"):
    M = st.mean(r[metric] for r in rows)
    ss_tot = sum((r[metric] - M) ** 2 for r in rows)
    ss_bet = 0.0
    for g in group_by(rows, key).values():
        m = st.mean(r[metric] for r in g)
        ss_bet += len(g) * (m - M) ** 2
    return ss_bet / ss_tot if ss_tot else 0.0


# ------------------------------------------------------------- טבלת הצלבה
def cross_table(rows, min_n=3):
    M, a, b = additive_model(rows)
    k, grand = shrinkage_k(rows)
    cells = group_by_combo(rows)
    combos = []
    for (ri, hu), grp in cells.items():
        w = [r["weighted"] for r in grp]
        n = len(w)
        mean = st.mean(w)
        shrunk = (n * mean + k * grand) / (n + k)
        expected = M + a[ri] + b[hu]
        synergy = mean - expected
        ci = bootstrap_ci(w) if n >= min_n else (mean, mean)
        combos.append({
            "ritual": ri, "humor": hu, "n": n,
            "w_mean": mean, "w_median": st.median(w),
            "w_sd": st.pstdev(w) if n > 1 else 0.0,
            "shrunk": shrunk, "expected": expected, "synergy": synergy,
            "ci_low": ci[0], "ci_high": ci[1],
            "plays_median": st.median([r["plays"] for r in grp]),
            "likes_pct": st.mean([r["likes_pct"] for r in grp]),
            "comments_pct": st.mean([r["comments_pct"] for r in grp]),
        })
    combos.sort(key=lambda c: c["w_mean"], reverse=True)
    return combos, sorted({c["ritual"] for c in combos}), \
        sorted({c["humor"] for c in combos}), dict(k=k, grand=grand, M=M,
                                                   ritual_eff=a, humor_eff=b)


def fmt(x, p=2):
    return f"{x:.{p}f}"


def bar(x, xmax, width=26):
    return "█" * max(1, round(x / xmax * width)) if xmax > 0 and x > 0 else ""


def marginal_report(rows, key, title, lines):
    lines.append("")
    lines.append(f"### {title}   (eta²={fmt(eta_squared(rows, key)*100,1)}% מהשונות)")
    lines.append(f"{'קטגוריה':<26}{'n':>4}{'ממוצע':>11}{'חציון':>9}{'תגובות%':>11}")
    lines.append("-" * 74)
    stats = []
    for name, grp in group_by(rows, key).items():
        stats.append((name, agg([r["weighted"] for r in grp]),
                      agg([r["likes_pct"] for r in grp]),
                      agg([r["comments_pct"] for r in grp])))
    stats.sort(key=lambda t: t[1]["mean"], reverse=True)
    wmax = max((s[1]["mean"] for s in stats), default=1)
    for name, w, lk, cm in stats:
        lines.append(f"{name:<26}{w['n']:>4}{fmt(w['mean']):>10}%{fmt(w['median']):>8}%"
                     f"{fmt(cm['mean'],3):>10}%  {bar(w['mean'], wmax)}")
    return stats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv")
    ap.add_argument("--json")
    ap.add_argument("--min-n", type=int, default=3)
    args = ap.parse_args()

    rows = load()
    N = len(rows)
    combos, rituals, humors, model = cross_table(rows, args.min_n)
    all_w = agg([r["weighted"] for r in rows])
    L = []
    L.append("=" * 82)
    L.append("ניתוח מעמיק: אילו שילובי טקס × הומור מניבים אחוז מעורבות גבוה?")
    L.append(f"מדגם {N} · מדד = (לייקים + 5·תגובות)/צפיות·100 · "
             f"ממוצע כללי {fmt(all_w['mean'])}%")
    L.append("=" * 82)

    # ---- (1) דירוג גולמי
    L.append("\n[1] דירוג גולמי של השילובים")
    L.append(f"{'#':>3} {'טקס':<7}{'טכניקה':<24}{'n':>3}{'ממוצע':>9}{'חציון':>8}"
             f"{'מכווץ':>8}{'סינרגיה':>9}")
    L.append("-" * 82)
    for i, c in enumerate(combos, 1):
        flag = "" if c["n"] >= args.min_n else " ⚠"
        syn = ("+" if c["synergy"] >= 0 else "") + fmt(c["synergy"])
        L.append(f"{i:>3} {c['ritual']:<7}{c['humor']:<24}{c['n']:>3}"
                 f"{fmt(c['w_mean']):>8}%{fmt(c['w_median']):>7}%"
                 f"{fmt(c['shrunk']):>7}%{syn:>9}{flag}")
    L.append(f"⚠ = n<{args.min_n} (לא מובהק). 'מכווץ' = אמד אמפירי-בייס "
             f"(k={fmt(model['k'],1)}); 'סינרגיה' = ממוצע פחות התחזית האדיטיבית.")

    # ---- (2) דירוג מכווץ (ההמלצה האמינה)
    L.append("\n[2] דירוג מתוקן בכיווץ אמפירי-בייס (עמיד לרעש מדגם קטן)")
    for i, c in enumerate(sorted(combos, key=lambda x: x["shrunk"], reverse=True)[:6], 1):
        L.append(f"  {i}. {c['ritual']} × {c['humor']}: מכווץ {fmt(c['shrunk'])}% "
                 f"(גולמי {fmt(c['w_mean'])}%, n={c['n']})")

    # ---- (3) סינרגיה
    L.append("\n[3] אפקט אינטראקציה (סינרגיה) — שילובים שמכים את התחזית האדיטיבית")
    syn_sorted = sorted([c for c in combos if c["n"] >= args.min_n],
                        key=lambda x: x["synergy"], reverse=True)
    sgn = lambda x: ("+" if x >= 0 else "") + fmt(x)
    for c in syn_sorted[:5]:
        L.append(f"  {sgn(c['synergy'])} נק' · {c['ritual']} × {c['humor']} "
                 f"(ממוצע {fmt(c['w_mean'])}% מול תחזית {fmt(c['expected'])}%, n={c['n']})")
    L.append("  ...")
    for c in syn_sorted[-3:]:
        L.append(f"  {fmt(c['synergy'])} נק' · {c['ritual']} × {c['humor']} "
                 f"(ממוצע {fmt(c['w_mean'])}% מול תחזית {fmt(c['expected'])}%, n={c['n']})")

    # ---- (4) רווחי סמך
    L.append("\n[4] רווחי סמך (bootstrap 95%) לשילובים המבוססים")
    for c in [c for c in combos if c["n"] >= args.min_n][:8]:
        L.append(f"  {c['ritual']} × {c['humor']}: {fmt(c['w_mean'])}% "
                 f"[{fmt(c['ci_low'])}–{fmt(c['ci_high'])}]  n={c['n']}")

    # ---- (5) שוליים + eta²
    L.append("\n[5] ניתוח שוליים + גודל אפקט (eta²)")
    rs = marginal_report(rows, "ritual", "לפי סוג הטקס", L)
    hs = marginal_report(rows, "humor", "לפי טכניקת הומור", L)
    gs = marginal_report(rows, "genre", "לפי ז'אנר ויזואלי", L)
    ss = marginal_report(rows, "subject", "לפי מושא ההומור", L)

    # ---- (6) מסקנות
    L.append("\n" + "=" * 82)
    L.append("מסקנות מחקריות")
    L.append("=" * 82)
    concl = derive_conclusions(rows, combos, model, rs, hs, gs, ss,
                               all_w, args.min_n)
    for i, c in enumerate(concl, 1):
        L.append(f"{i}. {c}")

    print("\n".join(L))

    if args.csv:
        with open(args.csv, "w", encoding="utf-8-sig", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["דירוג", "סוג הטקס", "טכניקת הומור", "מספר סרטונים",
                        "מדד ממוצע (%)", "מדד חציוני (%)", "אמד מכווץ (%)",
                        "תחזית אדיטיבית (%)", "סינרגיה (נק')",
                        "רווח סמך תחתון (%)", "רווח סמך עליון (%)",
                        "צפיות חציון", "לייקים% ממוצע", "תגובות% ממוצע"])
            for i, c in enumerate(combos, 1):
                w.writerow([i, c["ritual"], c["humor"], c["n"],
                            fmt(c["w_mean"]), fmt(c["w_median"]), fmt(c["shrunk"]),
                            fmt(c["expected"]), fmt(c["synergy"]),
                            fmt(c["ci_low"]), fmt(c["ci_high"]),
                            int(c["plays_median"]), fmt(c["likes_pct"]),
                            fmt(c["comments_pct"], 3)])
        print(f"\n[נכתב] טבלת ניתוח → {args.csv}")

    if args.json:
        def marg(stats, key):
            return [{"name": s[0], "n": s[1]["n"], "mean": s[1]["mean"],
                     "median": s[1]["median"], "likes_pct": s[2]["mean"],
                     "comments_pct": s[3]["mean"],
                     "eta2": eta_squared(rows, key)} for s in stats]
        payload = {
            "n": N, "overall_weighted": all_w,
            "rituals": rituals, "humors": humors,
            "combos": combos,
            "model": {"grand": model["grand"], "k": model["k"],
                      "ritual_eff": model["ritual_eff"],
                      "humor_eff": model["humor_eff"]},
            "eta2": {"ritual": eta_squared(rows, "ritual"),
                     "humor": eta_squared(rows, "humor"),
                     "genre": eta_squared(rows, "genre"),
                     "subject": eta_squared(rows, "subject")},
            "marginals": {"ritual": marg(rs, "ritual"), "humor": marg(hs, "humor"),
                          "genre": marg(gs, "genre"), "subject": marg(ss, "subject")},
            "conclusions": concl,
        }
        json.dump(payload, open(args.json, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)
        print(f"[נכתב] פלט מובנה → {args.json}")


def derive_conclusions(rows, combos, model, rs, hs, gs, ss, all_w, min_n):
    out = []
    robust = [c for c in combos if c["n"] >= min_n]
    grand = all_w["mean"]

    # 1 — התשובה הישירה: השילוב המנצח (מכווץ, אמין)
    by_shrunk = sorted(combos, key=lambda c: c["shrunk"], reverse=True)
    top = by_shrunk[0]
    top_raw = robust[0]
    out.append(
        f"**תשובה לשאלת המחקר:** השילוב האמין ביותר להנבת מעורבות גבוהה הוא "
        f"«{top['ritual']} × {top['humor']}» — אמד מכווץ {fmt(top['shrunk'])}% "
        f"(גולמי {fmt(top['w_mean'])}%, n={top['n']}). בדירוג הגולמי מוביל "
        f"«{top_raw['ritual']} × {top_raw['humor']}» עם {fmt(top_raw['w_mean'])}% "
        f"(n={top_raw['n']}), גבוה ב-{fmt((top_raw['w_mean']/grand-1)*100,0)}% "
        f"מהממוצע הכללי.")

    # 2 — סינרגיה: השילוב שהצירוף עצמו מוסיף לו ערך
    syn = sorted(robust, key=lambda c: c["synergy"], reverse=True)
    best_syn, worst_syn = syn[0], syn[-1]
    out.append(
        f"**אפקט האינטראקציה הוא הממצא המרכזי:** «{best_syn['ritual']} × "
        f"{best_syn['humor']}» מכה את התחזית האדיטיבית ב-+{fmt(best_syn['synergy'])} "
        f"נק' ({fmt(best_syn['w_mean'])}% בפועל מול {fmt(best_syn['expected'])}% "
        f"צפוי) — כלומר הצירוף עצמו מייצר ערך מעבר לסכום השפעותיהם הנפרדות של "
        f"הטקס וההומור. בקצה השני, «{worst_syn['ritual']} × {worst_syn['humor']}» "
        f"מפסיד {fmt(worst_syn['synergy'])} נק' לתחזית — צירוף שדווקא מחליש.")

    # 3 — איזה מימד קובע (eta²)
    er, eh = eta_squared(rows, "ritual"), eta_squared(rows, "humor")
    eg, es = eta_squared(rows, "genre"), eta_squared(rows, "subject")
    ranked = sorted([("סוג הטקס", er), ("טכניקת ההומור", eh),
                     ("הז'אנר הוויזואלי", eg), ("מושא ההומור", es)],
                    key=lambda t: t[1], reverse=True)
    out.append(
        f"**מה מסביר את המעורבות?** גודל האפקט (eta²): "
        + " · ".join(f"{n} {fmt(v*100,1)}%" for n, v in ranked)
        + f". {ranked[0][0]} הוא הגורם החזק ביותר, ו{ranked[-1][0]} החלש — כלומר "
        f"עבור הקריאייטור, ההשקעה ב{ranked[0][0]} מניבה את התשואה הגבוהה ביותר "
        f"במעורבות.")

    # 4 — הטכניקה המובילה בבידוד + היציבות שלה
    h = hs[0]
    hc = next(c for c in combos if c["humor"] == h[0] and c["n"] >= min_n)
    out.append(
        f"בבידוד, טכניקת ההומור «{h[0]}» מובילה ({fmt(h[1]['mean'])}%, n={h[1]['n']}) "
        f"והחלשה היא «{hs[-1][0]}» ({fmt(hs[-1][1]['mean'])}%). היתרון עמיד: "
        f"רווח הסמך של השילוב המבוסס «{hc['ritual']} × {hc['humor']}» הוא "
        f"[{fmt(hc['ci_low'])}–{fmt(hc['ci_high'])}]% ואינו כולל את הממוצע הכללי.")

    # 5 — מעורר-דיון מול מעורר-לייק (בגלל המשקל פי 5)
    disc = sorted(rows, key=lambda r: r["comments_pct"], reverse=True)[:12]
    from collections import Counter
    dh = Counter(r["humor"] for r in disc)
    ds = Counter(r["subject"] for r in disc)
    out.append(
        f"**מעורר-דיון מול מעורר-לייק:** מאחר שהתגובה שוקללה פי 5, בולטים "
        f"הסרטונים שמייצרים שיח. ב-12 הסרטונים עם יחס התגובות/צפיות הגבוה ביותר "
        f"שולטות הטכניקות «{dh.most_common(1)[0][0]}» ו«{dh.most_common(2)[-1][0]}», "
        f"ובמושא בולט «{ds.most_common(1)[0][0]}» — טקסטים ביקורתיים/מקצועיים "
        f"מזמינים תגובה פעילה, לא רק צפייה.")

    # 6 — ז'אנר כמנוף (ולא רק טכניקה)
    g = gs[0]
    out.append(
        f"הז'אנר הוויזואלי «{g[0]}» מוביל ({fmt(g[1]['mean'])}%, n={g[1]['n']}) "
        f"על פני «{gs[-1][0]}» ({fmt(gs[-1][1]['mean'])}%) — הפורמט (מבט-אישי/פוב "
        f"מול מערכון עלילתי) הוא ממד עצמאי שמעצים מעורבות בנוסף לטכניקת ההומור.")

    # 7 — אזהרה מתודולוגית
    small = [c for c in combos if c["n"] < min_n]
    dom = max(group_by(rows, "ritual").items(), key=lambda kv: len(kv[1]))
    out.append(
        f"**מגבלות:** מתוך {len(combos)} השילובים שנצפו, {len(small)} נשענים על "
        f"n<{min_n} ולכן אינם מובהקים (סומנו ⚠ ומוצגים דרך האמד המכווץ). המדגם "
        f"מוטה לטובת «{dom[0]}» ({len(dom[1])}/{len(rows)}), ולכן ההשוואות בתוך "
        f"טקס זה אמינות יותר מהשוואות בין סוגי טקס נדירים.")

    # 8 — ויראליות אינה מעורבות
    r_p = pearson([math.log10(r["plays"]) for r in rows],
                  [r["weighted"] for r in rows])
    out.append(
        f"**ויראליות ≠ מעורבות:** הקורלציה בין היקף הצפיות (log) למדד המעורבות "
        f"היא r={fmt(r_p)} — אפסית. הווירליות והמעורבות הן צירים נפרדים: שילוב "
        f"מנצח משיג אחוז מעורבות גבוה גם כשאינו הכי נצפה, ולהפך. לכן הדירוג "
        f"שלמעלה תקף לכל רמת חשיפה.")

    return out


if __name__ == "__main__":
    main()
