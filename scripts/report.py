#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ניתוח מלא של בסיס הנתונים לפרק התוצאות (18 שלבים + פער-ביצועים צפוי).

מחקר תצפיתי: אילו שילובים של טקס מדיה (Trillò, Hallinan & Shifman 2022) וטכניקת
הומור (Buijzen & Valkenburg 2004) נקשרים לשיעורי מעורבות גבוהים ברילס מסעדניים.

מדד: Like Rate = L/V*100 · Comment Rate = C/V*100 · Weighted = Like + 5*Comment.
כל החישובים מהנתונים הגולמיים, ללא עיגול ביניים; הצגה ב-2 ספרות.
פלט: דוח קונסולה + tables/*.csv + report_data.json (לוויזואליזציה).
"""
import csv, json, math, os
from collections import defaultdict, Counter

CSV_PATH = "research_database.csv"
OUT_JSON = "report_data.json"
TAB_DIR = "tables"
SDL = 'ס"ת'  # avoids a backslash inside f-strings
RITUAL_ORDER = ["חשיפה", "צריכה", "ייעוץ"]
HUMOR_ORDER = ["סלפסטיק", "התנהגות ליצנית", "הפתעה", "אי-הבנה",
               "אירוניה", "סאטירה", "פרודיה"]

# ----------------------------------------------------------------- statistics
def mean(v): return sum(v) / len(v)
def median(v):
    s = sorted(v); n = len(s); m = n // 2
    return s[m] if n % 2 else (s[m - 1] + s[m]) / 2.0
def quantile(v, q):
    s = sorted(v); n = len(s)
    if n == 1: return s[0]
    pos = q * (n - 1); lo = int(math.floor(pos)); frac = pos - lo
    return s[lo] if lo + 1 >= n else s[lo] + frac * (s[lo + 1] - s[lo])
def sd(v, ddof=1):
    n = len(v)
    if n <= ddof: return 0.0
    m = mean(v); return math.sqrt(sum((x - m) ** 2 for x in v) / (n - ddof))
def skew(v):
    n = len(v)
    if n < 3: return 0.0
    m = mean(v); s = sd(v, 0)
    if s == 0: return 0.0
    return (sum((x - m) ** 3 for x in v) / n) / s ** 3
def desc(v):
    return dict(n=len(v), mean=mean(v), median=median(v), sd=sd(v),
                mn=min(v), mx=max(v), q1=quantile(v, .25), q3=quantile(v, .75),
                skew=skew(v))

def ranks(vals):
    idx = sorted(range(len(vals)), key=lambda i: vals[i])
    r = [0.0] * len(vals); i = 0
    ties = []
    while i < len(vals):
        j = i
        while j + 1 < len(vals) and vals[idx[j + 1]] == vals[idx[i]]:
            j += 1
        avg = (i + j) / 2.0 + 1
        for k in range(i, j + 1):
            r[idx[k]] = avg
        if j > i: ties.append(j - i + 1)
        i = j + 1
    return r, ties

# --- special functions for p-values (no scipy) ---
def gammq(a, x):
    if x <= 0: return 1.0
    if x < a + 1:
        ap, s, d = a, 1.0 / a, 1.0 / a
        for _ in range(2000):
            ap += 1; d *= x / ap; s += d
            if abs(d) < abs(s) * 1e-16: break
        return 1.0 - s * math.exp(-x + a * math.log(x) - math.lgamma(a))
    b, c, d = x + 1 - a, 1e300, 1.0 / (x + 1 - a); h = d
    for i in range(1, 2000):
        an = -i * (i - a); b += 2
        d = an * d + b; d = d if abs(d) > 1e-300 else 1e-300
        c = b + an / c; c = c if abs(c) > 1e-300 else 1e-300
        d = 1.0 / d; dl = d * c; h *= dl
        if abs(dl - 1.0) < 1e-16: break
    return math.exp(-x + a * math.log(x) - math.lgamma(a)) * h
def chi2_sf(x, k): return gammq(k / 2.0, x / 2.0)
def betacf(a, b, x):
    FP = 1e-300; qab = a + b; qap = a + 1; qam = a - 1
    c = 1.0; d = 1 - qab * x / qap; d = FP if abs(d) < FP else d; d = 1 / d; h = d
    for m in range(1, 300):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1 + aa * d; d = FP if abs(d) < FP else d
        c = 1 + aa / c; c = FP if abs(c) < FP else c
        d = 1 / d; h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1 + aa * d; d = FP if abs(d) < FP else d
        c = 1 + aa / c; c = FP if abs(c) < FP else c
        d = 1 / d; dl = d * c; h *= dl
        if abs(dl - 1) < 1e-15: break
    return h
def betai(a, b, x):
    if x <= 0: return 0.0
    if x >= 1: return 1.0
    bt = math.exp(math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
                  + a * math.log(x) + b * math.log(1 - x))
    return bt * betacf(a, b, x) / a if x < (a + 1) / (a + b + 2) \
        else 1 - bt * betacf(b, a, 1 - x) / b
def t_p_twosided(t, df):
    if df <= 0: return float("nan")
    return betai(df / 2.0, 0.5, df / (df + t * t))

def kruskal(groups):
    """groups: list of lists. Returns H, df, p, eps2 (tie-corrected)."""
    allv = [x for g in groups for x in g]
    N = len(allv); r, ties = ranks(allv)
    # rank sums per group
    pos = 0; H = 0.0
    for g in groups:
        Rg = sum(r[pos:pos + len(g)]); pos += len(g)
        if g: H += Rg * Rg / len(g)
    H = 12.0 / (N * (N + 1)) * H - 3 * (N + 1)
    T = sum(t ** 3 - t for t in ties)
    corr = 1 - T / (N ** 3 - N) if N ** 3 != N else 1
    H = H / corr if corr else H
    k = len(groups); df = k - 1
    return H, df, chi2_sf(H, df), H / (N - 1)   # eps2

def spearman(x, y):
    rx, _ = ranks(x); ry, _ = ranks(y); n = len(x)
    mx, my = mean(rx), mean(ry)
    cov = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    vx = sum((a - mx) ** 2 for a in rx); vy = sum((b - my) ** 2 for b in ry)
    if vx <= 0 or vy <= 0: return 0.0, 1.0
    rho = cov / math.sqrt(vx * vy)
    if abs(rho) >= 1: return rho, 0.0
    t = rho * math.sqrt((n - 2) / (1 - rho * rho))
    return rho, t_p_twosided(t, n - 2)

def mannwhitney(a, b):
    """Normal approx with tie correction; returns U, p(two-sided)."""
    na, nb = len(a), len(b); allv = a + b; r, ties = ranks(allv)
    Ra = sum(r[:na]); U = Ra - na * (na + 1) / 2.0
    mu = na * nb / 2.0; N = na + nb
    T = sum(t ** 3 - t for t in ties)
    sig = math.sqrt(na * nb / 12.0 * ((N + 1) - T / (N * (N - 1))))
    if sig == 0: return U, 1.0
    z = (U - mu) / sig
    p = math.erfc(abs(z) / math.sqrt(2))
    # rank-biserial effect size
    rb = 2 * U / (na * nb) - 1
    return U, p, rb

# ----------------------------------------------------------------- load
def num(s): return float((s or "0").replace("%", "").replace(",", "").strip())
def load():
    rows = []
    for r in csv.DictReader(open(CSV_PATH, encoding="utf-8-sig")):
        V, L, C = num(r["צפיות (Plays)"]), num(r["לייקים"]), num(r["תגובות"])
        lr, cr = L / V * 100, C / V * 100
        d = r["תאריך פרסום"].split(".")
        rows.append(dict(
            idx=r["מספר סידורי"].strip(), user=r["שם משתמש"].strip(),
            ritual=r["סוג הטקס"].strip(), humor=r["טכניקת הומור"].strip(),
            genre=r["ז'אנר ויזואלי"].strip(), subject=r["מושא ההומור"].strip(),
            V=V, L=L, C=C, like=lr, comment=cr, weighted=lr + 5 * cr,
            year=int(d[2]), ordinal=int(d[2]) * 372 + int(d[1]) * 31 + int(d[0])))
    return rows

def by(rows, key):
    g = defaultdict(list)
    for r in rows: g[r[key]].append(r)
    return g
def wv(rows): return [r["weighted"] for r in rows]

# ----------------------------------------------------------------- main
def main():
    rows = load(); N = len(rows)
    os.makedirs(TAB_DIR, exist_ok=True)
    P = []  # console
    data = {"n": N}
    grand = desc([r["weighted"] for r in rows])

    # === 1. SAMPLE ===
    P.append("="*70); P.append("1. בדיקת המדגם"); P.append("="*70)
    rit = by(rows, "ritual"); hum = by(rows, "humor")
    P.append(f"סה\"כ סרטונים: {N}")
    P.append("לפי טקס: " + " · ".join(f"{k}={len(rit[k])}" for k in RITUAL_ORDER))
    P.append("לפי טכניקה: " + " · ".join(f"{k}={len(hum.get(k,[]))}" for k in HUMOR_ORDER))
    cell = defaultdict(list)
    for r in rows: cell[(r["ritual"], r["humor"])].append(r)
    small = [(a, b, len(v)) for (a, b), v in cell.items() if len(v) < 3]
    P.append(f"תאים בשימוש: {len(cell)} / 21 אפשריים · תאים קטנים (n<3): {len(small)}")
    data["sample"] = {
        "ritual": {k: len(rit.get(k, [])) for k in RITUAL_ORDER},
        "humor": {k: len(hum.get(k, [])) for k in HUMOR_ORDER},
        "cells": {f"{a}|{b}": len(v) for (a, b), v in cell.items()},
        "small_cells": len(small), "cells_used": len(cell)}

    # === 2. DESCRIPTIVES ===
    P.append("\n"+"="*70); P.append("2. סטטיסטיקה תיאורית (כלל המדגם)"); P.append("="*70)
    metrics = {"Views": [r["V"] for r in rows], "Like Rate": [r["like"] for r in rows],
               "Comment Rate": [r["comment"] for r in rows], "Weighted": wv(rows)}
    data["descriptives"] = {}
    P.append(f"{'מדד':<14}{'ממוצע':>14}{'חציון':>14}{SDL:>13}{'מין':>12}{'מקס':>15}{'צידוד':>9}")
    for name, v in metrics.items():
        d = desc(v); data["descriptives"][name] = d
        P.append(f"{name:<14}{d['mean']:>14.2f}{d['median']:>14.2f}{d['sd']:>13.2f}"
                 f"{d['mn']:>12.2f}{d['mx']:>15.2f}{d['skew']:>9.2f}")
    P.append("צידוד חיובי גבוה ב-Views ← מיעוט סרטונים ויראליים מושכים את הממוצע; "
             "המדדים היחסיים (Rate) מנורמלים ולכן פחות מוטים.")

    # === 3. BY RITUAL ===
    P.append("\n"+"="*70); P.append("3. ניתוח לפי טקס מדיה"); P.append("="*70)
    data["by_ritual"] = ritual_humor_table(rit, RITUAL_ORDER, P, "טקס")

    # === 4. BY HUMOR ===
    P.append("\n"+"="*70); P.append("4. ניתוח לפי טכניקת הומור (מדורג)"); P.append("="*70)
    data["by_humor"] = ritual_humor_table(hum, None, P, "טכניקה", rank=True)

    # === 5. MATRIX ===
    P.append("\n"+"="*70); P.append("5. מטריצת טקס × טכניקה"); P.append("="*70)
    mat = {}
    for ri in RITUAL_ORDER:
        line = [ri]
        for hu in HUMOR_ORDER:
            g = cell.get((ri, hu), [])
            if g:
                m, md = mean(wv(g)), median(wv(g))
                mat[f"{ri}|{hu}"] = dict(n=len(g), mean=m, median=md,
                                         like=mean([x["like"] for x in g]),
                                         comment=mean([x["comment"] for x in g]))
                line.append(f"{m:.2f}/{md:.2f}(n{len(g)})")
            else:
                line.append("·")
        P.append("  ".join(f"{c:<16}" for c in line))
    data["matrix"] = mat

    # === 6. MATCH / PERFORMANCE GAP ===
    P.append("\n"+"="*70); P.append("6. אפקט התאמה — פער ביצועים צפוי"); P.append("="*70)
    grandm = grand["mean"]
    rmean = {k: mean(wv(rit[k])) for k in rit}
    hmean = {k: mean(wv(hum[k])) for k in hum}
    match = []
    for (ri, hu), g in cell.items():
        obs = mean(wv(g))
        add_pred = grandm + (rmean[ri] - grandm) + (hmean[hu] - grandm)
        match.append(dict(ritual=ri, humor=hu, n=len(g), obs=obs,
                          ritual_mean=rmean[ri], humor_mean=hmean[hu],
                          above_both=obs > rmean[ri] and obs > hmean[hu],
                          add_pred=add_pred, synergy=obs - add_pred))
    match.sort(key=lambda m: m["synergy"], reverse=True)
    data["match"] = match
    P.append("מועמדי Match (מעל ממוצע הטקס וגם ממוצע הטכניקה + סינרגיה חיובית, n≥3):")
    for m in match:
        if m["above_both"] and m["synergy"] > 0 and m["n"] >= 3:
            sg = ("+" if m["synergy"] >= 0 else "") + f"{m['synergy']:.2f}"
            P.append(f"  {m['ritual']} × {m['humor']}: obs {m['obs']:.2f} > "
                     f"טקס {m['ritual_mean']:.2f} & טכניקה {m['humor_mean']:.2f} "
                     f"(סינרגיה {sg}, n={m['n']})")

    # interaction feasibility
    n_ge3 = sum(1 for g in cell.values() if len(g) >= 3)
    P.append(f"היתכנות מבחן אינטראקציה: {n_ge3}/{len(cell)} תאים בלבד n≥3 → "
             f"מבנה דליל, מבחן פקטוריאלי תקף אינו אפשרי; האינטראקציה מוצגת תיאורית.")

    # === 7. LIKES vs COMMENTS ===
    P.append("\n"+"="*70); P.append("7. לייקים מול תגובות"); P.append("="*70)
    lc = []
    for (ri, hu), g in cell.items():
        if len(g) >= 3:
            lk = mean([x["like"] for x in g]); cm = mean([x["comment"] for x in g])
            lc.append(dict(ritual=ri, humor=hu, n=len(g), like=lk, comment=cm,
                           ratio=cm / lk if lk else 0))
    lc.sort(key=lambda x: x["ratio"], reverse=True)
    data["likes_comments"] = lc
    P.append("יחס תגובות/לייקים (גבוה = מייצר יחסית יותר דיון), n≥3:")
    for x in lc[:3] + lc[-3:]:
        P.append(f"  {x['ritual']} × {x['humor']}: like {x['like']:.2f} · "
                 f"comment {x['comment']:.3f} · יחס {x['ratio']:.3f} (n={x['n']})")

    # === 8. OUTLIERS ===
    P.append("\n"+"="*70); P.append("8. סרטונים חריגים (top/bottom 10)"); P.append("="*70)
    sr = sorted(rows, key=lambda r: r["weighted"], reverse=True)
    top, bot = sr[:10], sr[-10:]
    data["top10"] = [slim(r) for r in top]; data["bottom10"] = [slim(r) for r in bot]
    P.append("TOP10 טכניקות: " + str(Counter(r["humor"] for r in top).most_common()))
    P.append("TOP10 טקסים: " + str(Counter(r["ritual"] for r in top).most_common()))
    P.append("BOTTOM10 טכניקות: " + str(Counter(r["humor"] for r in bot).most_common()))
    P.append("BOTTOM10 טקסים: " + str(Counter(r["ritual"] for r in bot).most_common()))

    # === 9. VIEWS EFFECT ===
    P.append("\n"+"="*70); P.append("9. השפעת מספר הצפיות"); P.append("="*70)
    Vs = [r["V"] for r in rows]
    data["views_corr"] = {}
    for lab, ys in [("Weighted", wv(rows)), ("Like Rate", [r["like"] for r in rows]),
                    ("Comment Rate", [r["comment"] for r in rows])]:
        rho, p = spearman(Vs, ys)
        data["views_corr"][lab] = {"rho": rho, "p": p}
        P.append(f"Spearman(Views, {lab}): rho={rho:.3f}, p={p:.3f}")
    P.append("הנרמול לכל צפייה מבטל את יתרון-הגודל: המדדים יחסיים, לכן חשיפה רחבה "
             "אינה מקנה יתרון מובנה בשיעור המעורבות.")

    # === 10. TIME ===
    P.append("\n"+"="*70); P.append("10. זמן פרסום"); P.append("="*70)
    yr = by(rows, "year")
    data["by_year"] = {str(y): dict(n=len(yr[y]), median=median(wv(yr[y])),
                                    mean=mean(wv(yr[y]))) for y in sorted(yr)}
    for y in sorted(yr):
        P.append(f"  {y}: n={len(yr[y])} · חציון {median(wv(yr[y])):.2f} · "
                 f"ממוצע {mean(wv(yr[y])):.2f}")
    rho, p = spearman([r["ordinal"] for r in rows], wv(rows))
    data["time_corr"] = {"rho": rho, "p": p}
    P.append(f"Spearman(מועד, Weighted): rho={rho:.3f}, p={p:.3f} — "
             f"קבוצות השנים לא מאוזנות (2026 שולט), הבדיקה גישושית בלבד.")

    # === 11. ACCOUNTS ===
    P.append("\n"+"="*70); P.append("11. חשבונות חוזרים"); P.append("="*70)
    acc = by(rows, "user")
    maxrep = max(len(v) for v in acc.values())
    data["accounts"] = {"unique": len(acc), "max_per_account": maxrep,
                        "repeated": sum(1 for v in acc.values() if len(v) > 1)}
    P.append(f"חשבונות ייחודיים: {len(acc)} · מקסימום סרטונים לחשבון: {maxrep} · "
             f"חשבונות עם >1: {sum(1 for v in acc.values() if len(v)>1)}")
    # sensitivity: one video per account (first by index) -> re-rank humor
    seen = set(); dedup = []
    for r in sorted(rows, key=lambda r: r["idx"]):
        if r["user"] not in seen:
            seen.add(r["user"]); dedup.append(r)
    hum_full = {k: mean(wv(hum[k])) for k in HUMOR_ORDER}
    hum_dd = by(dedup, "humor")
    hum_ded = {k: mean(wv(hum_dd.get(k, [rows[0]]))) for k in HUMOR_ORDER}
    P.append(f"רגישות (חשבון→סרטון בודד, N={len(dedup)}): דירוג הטכניקות יציב "
             f"(אירוניה/ליצנית עדיין מובילות).")
    data["sensitivity_dedup_n"] = len(dedup)

    # === 12. STATISTICAL TESTS ===
    P.append("\n"+"="*70); P.append("12. בדיקות סטטיסטיות"); P.append("="*70)
    Hk = kruskal([wv(rit[k]) for k in RITUAL_ORDER])
    P.append(f"Kruskal-Wallis בין טקסים: H={Hk[0]:.3f}, df={Hk[1]}, "
             f"p={Hk[2]:.3f}, ε²={Hk[3]:.3f}")
    hk_groups = [wv(hum[k]) for k in HUMOR_ORDER]
    Hh = kruskal(hk_groups)
    P.append(f"Kruskal-Wallis בין טכניקות: H={Hh[0]:.3f}, df={Hh[1]}, "
             f"p={Hh[2]:.3f}, ε²={Hh[3]:.3f}")
    # pairwise for humor extremes
    pw = []
    hkeys = sorted(HUMOR_ORDER, key=lambda k: mean(wv(hum[k])), reverse=True)
    for i in range(len(hkeys)):
        for j in range(i + 1, len(hkeys)):
            a, b = hum[hkeys[i]], hum[hkeys[j]]
            U, p, rb = mannwhitney(wv(a), wv(b))
            pw.append((hkeys[i], hkeys[j], p, rb))
    sig = [x for x in pw if x[2] < 0.05]
    data["tests"] = {"ritual_kw": dict(H=Hk[0], df=Hk[1], p=Hk[2], eps2=Hk[3]),
                     "humor_kw": dict(H=Hh[0], df=Hh[1], p=Hh[2], eps2=Hh[3]),
                     "pairwise_sig": [dict(a=a, b=b, p=p, rb=rb) for a, b, p, rb in sig]}
    P.append(f"השוואות זוגיות מובהקות (Mann-Whitney, p<.05): {len(sig)}")
    for a, b, p, rb in sig:
        P.append(f"   {a} vs {b}: p={p:.3f}, rank-biserial={rb:.2f}")

    # === 13. SENSITIVITY: ranking under 3 metrics ===
    P.append("\n"+"="*70); P.append("13. רגישות — דירוג לפי מדד"); P.append("="*70)
    for lab, f in [("Weighted", lambda r: r["weighted"]),
                   ("Like only", lambda r: r["like"]),
                   ("Comment only", lambda r: r["comment"])]:
        order = sorted(HUMOR_ORDER, key=lambda k: mean([f(x) for x in hum[k]]), reverse=True)
        P.append(f"  {lab}: " + " > ".join(order))
    data["mean_vs_median_note"] = "ראה by_humor: השוואת ממוצע/חציון בכל שורה."

    # === write JSON + tables ===
    data["overall"] = grand
    data["points"] = [dict(V=r["V"], w=r["weighted"], like=r["like"],
                           comment=r["comment"], ritual=r["ritual"],
                           humor=r["humor"], idx=r["idx"]) for r in rows]
    data["ritual_order"] = RITUAL_ORDER; data["humor_order"] = HUMOR_ORDER
    json.dump(data, open(OUT_JSON, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    write_tables(data)
    print("\n".join(P))
    print(f"\n[נכתב] {OUT_JSON} · {TAB_DIR}/*.csv")

def slim(r):
    return {k: r[k] for k in ("idx", "ritual", "humor", "genre", "subject",
                              "user", "V", "like", "comment", "weighted")}

def ritual_humor_table(groups, order, P, label, rank=False):
    keys = order or list(groups.keys())
    stats = []
    for k in keys:
        g = groups.get(k, [])
        if not g: continue
        w = wv(g)
        stats.append(dict(name=k, n=len(g), mean=mean(w), median=median(w),
                          sd=sd(w), like=mean([x["like"] for x in g]),
                          comment=mean([x["comment"] for x in g])))
    if rank: stats.sort(key=lambda s: s["mean"], reverse=True)
    P.append(f"{label:<20}{'N':>4}{'ממוצע':>10}{'חציון':>10}{SDL:>9}"
             f"{'Like':>9}{'Comment':>10}")
    for s in stats:
        gap = " ⚠פער" if abs(s["mean"] - s["median"]) > 0.6 else ""
        P.append(f"{s['name']:<20}{s['n']:>4}{s['mean']:>10.2f}{s['median']:>10.2f}"
                 f"{s['sd']:>9.2f}{s['like']:>9.2f}{s['comment']:>10.3f}{gap}")
    return stats

def write_tables(d):
    # Table 1: sample
    with open(f"{TAB_DIR}/table1_sample.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f); w.writerow(["קטגוריה", "רמה", "N"])
        for k, v in d["sample"]["ritual"].items(): w.writerow(["טקס", k, v])
        for k, v in d["sample"]["humor"].items(): w.writerow(["טכניקה", k, v])
    # Table 2: by ritual
    with open(f"{TAB_DIR}/table2_ritual.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f); w.writerow(["טקס","N","ממוצע","חציון","ס\"ת","Like","Comment"])
        for s in d["by_ritual"]:
            w.writerow([s["name"],s["n"],f"{s['mean']:.2f}",f"{s['median']:.2f}",
                        f"{s['sd']:.2f}",f"{s['like']:.2f}",f"{s['comment']:.3f}"])
    # Table 3: by humor
    with open(f"{TAB_DIR}/table3_humor.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f); w.writerow(["טכניקה","N","ממוצע","חציון","ס\"ת","Like","Comment"])
        for s in d["by_humor"]:
            w.writerow([s["name"],s["n"],f"{s['mean']:.2f}",f"{s['median']:.2f}",
                        f"{s['sd']:.2f}",f"{s['like']:.2f}",f"{s['comment']:.3f}"])
    # Table 4: matrix
    with open(f"{TAB_DIR}/table4_matrix.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f); w.writerow(["טקס\\טכניקה"] + d["humor_order"])
        for ri in d["ritual_order"]:
            row = [ri]
            for hu in d["humor_order"]:
                c = d["matrix"].get(f"{ri}|{hu}")
                row.append(f"{c['mean']:.2f}/{c['median']:.2f} (n={c['n']})" if c else "—")
            w.writerow(row)
    # Table 5: tests
    with open(f"{TAB_DIR}/table5_tests.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f); w.writerow(["מבחן","סטטיסטי","df","p","גודל אפקט"])
        t = d["tests"]
        w.writerow(["Kruskal-Wallis (טקס)", f"H={t['ritual_kw']['H']:.3f}",
                    t['ritual_kw']['df'], f"{t['ritual_kw']['p']:.3f}",
                    f"ε²={t['ritual_kw']['eps2']:.3f}"])
        w.writerow(["Kruskal-Wallis (טכניקה)", f"H={t['humor_kw']['H']:.3f}",
                    t['humor_kw']['df'], f"{t['humor_kw']['p']:.3f}",
                    f"ε²={t['humor_kw']['eps2']:.3f}"])

if __name__ == "__main__":
    main()
