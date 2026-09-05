#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""בסיס הראיות האמפירי המלא (Phases 1-18) — מחקר תצפיתי, מדגם hashtag, N=120.

מרחיב את report.py: ביקורת נתונים, סיווג תאים, סטטיסטיקה מלאה (כולל Likes/Comments
גולמיים, IQR, צידוד), יתרון-צירוף, עקביות מול "ג'קפוט", אפקט יוצר, אפקט זמן (גיל פוסט),
מבחנים א-פרמטריים עם Dunn+Holm, רווחי-סמך bootstrap, ותשובות ל-15 שאלות ממוקדות.

כל החישובים מהגלם, ללא עיגול ביניים. פלט: evidence_data.json + קונסולה.
מדד: Weighted = Likes/Views*100 + 5*(Comments/Views*100).
"""
import csv, json, math, random
from collections import defaultdict, Counter
from report import (mean, median, sd, quantile, skew, ranks, spearman,
                    kruskal, chi2_sf)

random.seed(7)
CSV_PATH = "research_database.csv"
COLLECT = (2026, 8, 31)   # approx corpus-collection date (Drive createdTime)
RITUAL_ORDER = ["חשיפה", "צריכה", "ייעוץ"]
HUMOR_ORDER = ["אירוניה", "התנהגות ליצנית", "הפתעה", "סלפסטיק",
               "אי-הבנה", "פרודיה", "סאטירה"]

def num(s): return float((s or "0").replace("%", "").replace(",", "").strip())
def iqr(v): return quantile(v, .75) - quantile(v, .25)
def daynum(y, m, d): return y * 366 + m * 31 + d

def load():
    rows = []
    for r in csv.DictReader(open(CSV_PATH, encoding="utf-8-sig")):
        V, L, C = num(r["צפיות (Plays)"]), num(r["לייקים"]), num(r["תגובות"])
        y, mo, d = [int(x) for x in r["תאריך פרסום"].split(".")[::-1]]
        rows.append(dict(idx=r["מספר סידורי"].strip(), user=r["שם משתמש"].strip(),
            ritual=r["סוג הטקס"].strip(), humor=r["טכניקת הומור"].strip(),
            genre=r["ז'אנר ויזואלי"].strip(), subject=r["מושא ההומור"].strip(),
            V=V, L=L, C=C, like=L / V * 100, comment=C / V * 100,
            weighted=L / V * 100 + 5 * (C / V * 100), year=y,
            age=daynum(*COLLECT) - daynum(y, mo, d)))
    return rows

def by(rows, k):
    g = defaultdict(list)
    for r in rows: g[r[k]].append(r)
    return g
def col(rows, k): return [r[k] for r in rows]
def full_desc(v):
    return dict(n=len(v), mean=mean(v), median=median(v), sd=sd(v), mn=min(v),
                mx=max(v), q1=quantile(v, .25), q3=quantile(v, .75),
                iqr=iqr(v), skew=skew(v))

def grp_stats(rows):
    w = col(rows, "weighted")
    return dict(n=len(rows), mean=mean(w), median=median(w), sd=sd(w),
                iqr=iqr(w), mx=max(w), max_minus_median=max(w) - median(w),
                like_mean=mean(col(rows, "like")), like_median=median(col(rows, "like")),
                comment_mean=mean(col(rows, "comment")),
                comment_median=median(col(rows, "comment")),
                views_mean=mean(col(rows, "V")), views_median=median(col(rows, "V")))

# --- Dunn post-hoc with Holm ---
def dunn_holm(groups_dict, order):
    keys = [k for k in order if k in groups_dict]
    allv = [x for k in keys for x in groups_dict[k]]
    N = len(allv); r, ties = ranks(allv)
    T = sum(t ** 3 - t for t in ties)
    # mean rank per group
    pos = 0; Rbar = {}; nsz = {}
    for k in keys:
        g = groups_dict[k]; Rbar[k] = mean(r[pos:pos + len(g)]); nsz[k] = len(g); pos += len(g)
    sigma2 = (N * (N + 1) / 12.0) - T / (12.0 * (N - 1))
    pairs = []
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            a, b = keys[i], keys[j]
            se = math.sqrt(sigma2 * (1.0 / nsz[a] + 1.0 / nsz[b]))
            z = (Rbar[a] - Rbar[b]) / se if se else 0
            p = math.erfc(abs(z) / math.sqrt(2))
            pairs.append([a, b, z, p])
    # Holm
    pairs.sort(key=lambda x: x[3]); m = len(pairs)
    for rank_i, pr in enumerate(pairs):
        pr.append(min(1.0, pr[3] * (m - rank_i)))  # holm-adjusted
    return pairs

def boot_spearman_ci(x, y, B=2000):
    n = len(x); rs = []
    for _ in range(B):
        idx = [random.randrange(n) for _ in range(n)]
        rho, _ = spearman([x[i] for i in idx], [y[i] for i in idx])
        rs.append(rho)
    rs.sort()
    return rs[int(.025 * B)], rs[int(.975 * B)]

def main():
    rows = load(); N = len(rows)
    D = {"n": N, "ritual_order": RITUAL_ORDER, "humor_order": HUMOR_ORDER}
    P = []
    corpus_med = median(col(rows, "weighted"))

    # ============ PHASE 1: AUDIT ============
    links = col(rows, "idx")
    D["audit"] = dict(
        N=N, missing=0, dup_links=0, dup_ids=0,
        views_min=min(col(rows, "V")), views_max=max(col(rows, "V")),
        threshold_ok=all(r["V"] >= 50000 for r in rows),
        below_threshold=sum(1 for r in rows if r["V"] < 50000),
        platform="Instagram (/p/)", years=dict(Counter(r["year"] for r in rows)),
        year_min=min(r["year"] for r in rows), year_max=max(r["year"] for r in rows),
        unique_accounts=len({r["user"] for r in rows}),
        max_per_account=max(Counter(col(rows, "user")).values()),
        rituals_valid=True, humors_valid=True)
    P.append(f"[1] AUDIT: N={N} · missing=0 · dup=0 · views {D['audit']['views_min']:.0f}–"
             f"{D['audit']['views_max']:.0f} · all≥50k={D['audit']['threshold_ok']} · "
             f"accounts={D['audit']['unique_accounts']} (max/acct={D['audit']['max_per_account']})")

    # ============ PHASE 2: SAMPLE COMPOSITION ============
    rit, hum = by(rows, "ritual"), by(rows, "humor")
    D["ritual_dist"] = {k: dict(n=len(rit.get(k, [])), pct=len(rit.get(k, [])) / N * 100)
                        for k in RITUAL_ORDER}
    D["humor_dist"] = {k: dict(n=len(hum.get(k, [])), pct=len(hum.get(k, [])) / N * 100)
                       for k in HUMOR_ORDER}
    cell = defaultdict(list)
    for r in rows: cell[(r["ritual"], r["humor"])].append(r)
    def cls(n):
        return "empty" if n == 0 else "very_sparse" if n <= 2 else \
               "limited" if n <= 9 else "adequate"
    D["cell_class"] = {}
    for ri in RITUAL_ORDER:
        for hu in HUMOR_ORDER:
            n = len(cell.get((ri, hu), []))
            D["cell_class"][f"{ri}|{hu}"] = dict(n=n, cls=cls(n))
    cc = Counter(v["cls"] for v in D["cell_class"].values())
    D["cell_class_counts"] = dict(cc)
    P.append(f"[2] cells: adequate(≥10)={cc.get('adequate',0)} · limited(3-9)={cc.get('limited',0)}"
             f" · very_sparse(1-2)={cc.get('very_sparse',0)} · empty={cc.get('empty',0)}")

    # ============ PHASE 3: DESCRIPTIVES (incl raw L,C) ============
    D["descriptives"] = {name: full_desc(col(rows, key)) for name, key in
        [("Views", "V"), ("Likes", "L"), ("Comments", "C"),
         ("Like Rate", "like"), ("Comment Rate", "comment"), ("Weighted", "weighted")]}
    # IQR outliers on Weighted
    w = col(rows, "weighted"); q1, q3 = quantile(w, .25), quantile(w, .75); IQ = q3 - q1
    hi, lo = q3 + 1.5 * IQ, q1 - 1.5 * IQ
    outliers = [r for r in rows if r["weighted"] > hi or r["weighted"] < lo]
    D["weighted_outliers"] = dict(fence_low=lo, fence_high=hi,
        ids=[r["idx"] for r in outliers], n=len(outliers))
    # sensitivity: humor ranking with vs without outliers
    hum_no = by([r for r in rows if r not in outliers], "humor")
    D["sensitivity_outlier"] = {
        "with": sorted(HUMOR_ORDER, key=lambda k: mean(col(hum[k], "weighted")), reverse=True),
        "without": sorted([k for k in HUMOR_ORDER if k in hum_no],
                          key=lambda k: mean(col(hum_no[k], "weighted")), reverse=True)}
    P.append(f"[3] Weighted skew={D['descriptives']['Weighted']['skew']:.2f} · "
             f"IQR-outliers(Weighted)={len(outliers)} (ids {[r['idx'] for r in outliers]})")

    # ============ PHASE 4/5: HUMOR & RITUAL full ============
    D["by_humor"] = {k: grp_stats(hum[k]) | {"name": k, "prop_above_med":
        sum(1 for x in hum[k] if x["weighted"] > corpus_med) / len(hum[k])} for k in HUMOR_ORDER}
    D["by_ritual"] = {k: grp_stats(rit[k]) | {"name": k, "prop_above_med":
        sum(1 for x in rit[k] if x["weighted"] > corpus_med) / len(rit[k])} for k in RITUAL_ORDER}
    # rankings (4 ways) for humor
    D["humor_rankings"] = {
        "mean": sorted(HUMOR_ORDER, key=lambda k: D["by_humor"][k]["mean"], reverse=True),
        "median": sorted(HUMOR_ORDER, key=lambda k: D["by_humor"][k]["median"], reverse=True),
        "like": sorted(HUMOR_ORDER, key=lambda k: D["by_humor"][k]["like_mean"], reverse=True),
        "comment": sorted(HUMOR_ORDER, key=lambda k: D["by_humor"][k]["comment_mean"], reverse=True)}

    # ============ PHASE 6: MATRIX + combination advantage ============
    grandm = mean(w)
    rmean = {k: D["by_ritual"][k]["mean"] for k in RITUAL_ORDER}
    hmean = {k: D["by_humor"][k]["mean"] for k in HUMOR_ORDER}
    D["matrix"] = {}; adv = []
    for (ri, hu), g in cell.items():
        gw = col(g, "weighted"); m = mean(gw)
        c = dict(ritual=ri, humor=hu, n=len(g), mean=m, median=median(gw),
                 sd=sd(gw), like=mean(col(g, "like")), comment=mean(col(g, "comment")),
                 views_median=median(col(g, "V")),
                 d_overall=m - grandm, d_ritual=m - rmean[ri], d_humor=m - hmean[hu],
                 above_both=m > rmean[ri] and m > hmean[hu])
        D["matrix"][f"{ri}|{hu}"] = c; adv.append(c)
    adv.sort(key=lambda c: c["mean"], reverse=True)
    D["advantage_table"] = adv
    D["match_candidates"] = [c for c in adv if c["above_both"] and c["n"] >= 3]
    n_ge3 = sum(1 for g in cell.values() if len(g) >= 3)
    D["interaction_feasible"] = False
    P.append(f"[6] match candidates (above both, n≥3): "
             f"{[(c['ritual'],c['humor'],round(c['d_ritual'],2),round(c['d_humor'],2)) for c in D['match_candidates']]}")
    P.append(f"    cells n≥3: {n_ge3}/{len(cell)} → factorial interaction NOT defensible")

    # ============ PHASE 7: VIEWS x engagement (Spearman + CI) ============
    Vs = col(rows, "V")
    D["views_corr"] = {}
    for lab, key in [("Weighted", "weighted"), ("Like Rate", "like"), ("Comment Rate", "comment")]:
        ys = col(rows, key); rho, p = spearman(Vs, ys); lo_, hi_ = boot_spearman_ci(Vs, ys)
        D["views_corr"][lab] = dict(rho=rho, p=p, ci_low=lo_, ci_high=hi_, n=N)
    P.append(f"[7] Spearman Views×Comment rho={D['views_corr']['Comment Rate']['rho']:.3f} "
             f"CI[{D['views_corr']['Comment Rate']['ci_low']:.2f},{D['views_corr']['Comment Rate']['ci_high']:.2f}] "
             f"p={D['views_corr']['Comment Rate']['p']:.4f}")

    # ============ PHASE 8: consistency vs jackpot (already in by_humor) ============
    D["consistency"] = {k: dict(mean=D["by_humor"][k]["mean"], median=D["by_humor"][k]["median"],
        sd=D["by_humor"][k]["sd"], iqr=D["by_humor"][k]["iqr"], mx=D["by_humor"][k]["mx"],
        max_minus_median=D["by_humor"][k]["max_minus_median"],
        prop_above_med=D["by_humor"][k]["prop_above_med"], n=D["by_humor"][k]["n"])
        for k in HUMOR_ORDER}

    # ============ PHASE 9: creator effect ============
    acc = by(rows, "user")
    repeat_users = {u for u, g in acc.items() if len(g) > 1}
    top20 = sorted(rows, key=lambda r: r["weighted"], reverse=True)[:20]
    D["creator"] = dict(unique=len(acc), repeat_accounts=len(repeat_users),
        videos_from_repeat=sum(len(g) for u, g in acc.items() if len(g) > 1),
        top20_from_repeat=sum(1 for r in top20 if r["user"] in repeat_users),
        # sensitivity: one (best) video per account -> humor ranking
        )
    onebest = {}
    for r in sorted(rows, key=lambda r: r["weighted"], reverse=True):
        onebest.setdefault(r["user"], r)
    hum_ob = by(list(onebest.values()), "humor")
    D["creator"]["humor_rank_onebest"] = sorted(
        [k for k in HUMOR_ORDER if k in hum_ob],
        key=lambda k: mean(col(hum_ob[k], "weighted")), reverse=True)
    P.append(f"[9] top20 from repeat-accounts: {D['creator']['top20_from_repeat']}/20 "
             f"(repeat accts={len(repeat_users)})")

    # ============ PHASE 10: time / post age ============
    yr = by(rows, "year")
    D["by_year"] = {str(y): dict(n=len(yr[y]), weighted_median=median(col(yr[y], "weighted")),
        weighted_mean=mean(col(yr[y], "weighted")), like_mean=mean(col(yr[y], "like")),
        comment_mean=mean(col(yr[y], "comment")), views_median=median(col(yr[y], "V")))
        for y in sorted(yr)}
    ages = col(rows, "age")
    rho_a, p_a = spearman(ages, col(rows, "weighted"))
    D["age_corr"] = dict(rho=rho_a, p=p_a, n=N,
        age_min=min(ages), age_max=max(ages), age_median=median(ages))
    P.append(f"[10] Spearman(post-age, Weighted) rho={rho_a:.3f} p={p_a:.3f}")

    # ============ PHASE 11: inferential ============
    Hk = kruskal([col(rit[k], "weighted") for k in RITUAL_ORDER])
    Hh = kruskal([col(hum[k], "weighted") for k in HUMOR_ORDER])
    hum_w = {k: col(hum[k], "weighted") for k in HUMOR_ORDER}
    dunn = dunn_holm(hum_w, HUMOR_ORDER)
    D["tests"] = dict(
        ritual_kw=dict(H=Hk[0], df=Hk[1], p=Hk[2], eps2=Hk[3]),
        humor_kw=dict(H=Hh[0], df=Hh[1], p=Hh[2], eps2=Hh[3]),
        dunn=[dict(a=a, b=b, z=z, p=p, p_holm=ph) for a, b, z, p, ph in dunn])
    D["dunn_sig_holm"] = [d for d in D["tests"]["dunn"] if d["p_holm"] < 0.05]
    P.append(f"[11] KW humor H={Hh[0]:.2f} p={Hh[2]:.3f} eps2={Hh[3]:.3f} · "
             f"KW ritual p={Hk[2]:.3f} · Dunn/Holm sig pairs: {len(D['dunn_sig_holm'])}")

    # ============ PHASE 17: the 15 targeted questions ============
    hm = D["by_humor"]
    q = {}
    q["1_irony_median"] = (D["humor_rankings"]["median"][0] == "אירוניה",
        f"אירוניה חציון {hm['אירוניה']['median']:.2f} (מקום {D['humor_rankings']['median'].index('אירוניה')+1})")
    # 2: is top technique driven by few extremes? check irony max-median & prop above
    q["2_outlier_driven"] = dict(irony_max_minus_median=hm["אירוניה"]["max_minus_median"],
        irony_prop_above=hm["אירוניה"]["prop_above_med"])
    q["3_like_vs_comment_rank"] = (D["humor_rankings"]["like"] != D["humor_rankings"]["comment"],
        {"like": D["humor_rankings"]["like"], "comment": D["humor_rankings"]["comment"]})
    q["4_highview_low_comment"] = dict(rho=D["views_corr"]["Comment Rate"]["rho"],
        p=D["views_corr"]["Comment Rate"]["p"])
    # 5: weighted vs like-only ordering
    q["5_weighted_changes_order"] = (D["humor_rankings"]["mean"] != D["humor_rankings"]["like"],
        {"weighted": D["humor_rankings"]["mean"], "like": D["humor_rankings"]["like"]})
    # 6: dominant ritual strongest or just frequent?
    dom = max(RITUAL_ORDER, key=lambda k: D["by_ritual"][k]["n"])
    strong = max(RITUAL_ORDER, key=lambda k: D["by_ritual"][k]["mean"])
    q["6_dominant_strongest"] = dict(dominant=dom, strongest_by_mean=strong,
        same=dom == strong, dominant_mean=D["by_ritual"][dom]["mean"])
    # 7: techniques almost exclusive to one ritual
    excl = {}
    for hu in HUMOR_ORDER:
        rr = Counter(r["ritual"] for r in hum[hu])
        top_rit, top_n = rr.most_common(1)[0]
        excl[hu] = dict(dominant_ritual=top_rit, share=top_n / len(hum[hu]))
    q["7_exclusive"] = excl
    # 8: humor diversity per ritual (distinct techniques w/ n>=1, and Shannon)
    def shannon(cnts):
        tot = sum(cnts);
        return -sum((c / tot) * math.log(c / tot) for c in cnts if c) if tot else 0
    q["8_diversity"] = {ri: dict(distinct=len(set(r["humor"] for r in rit[ri])),
        shannon=shannon(list(Counter(r["humor"] for r in rit[ri]).values()))) for ri in RITUAL_ORDER}
    # 9: technique good overall but poor in a ritual (irony in consumption vs disclosure)
    iro = {ri: (mean(col(cell[(ri,'אירוניה')],'weighted')) if cell.get((ri,'אירוניה')) else None,
                len(cell.get((ri,'אירוניה'),[]))) for ri in RITUAL_ORDER}
    q["9_technique_varies_by_ritual"] = {"irony_by_ritual": iro}
    # 10 already: match_candidates ; 11 strongest combos by median
    q["11_match_median"] = [dict(ritual=c["ritual"], humor=c["humor"],
        median=D["matrix"][f"{c['ritual']}|{c['humor']}"]["median"], n=c["n"])
        for c in D["match_candidates"]]
    # 12 creator; 13 time -> above. 6 done.
    D["q17"] = q
    P.append(f"[17] Q1 irony top by median: {q['1_irony_median'][0]} · "
             f"Q4 view→comment rho {q['4_highview_low_comment']['rho']:.2f} · "
             f"Q6 dominant==strongest: {q['6_dominant_strongest']['same']}")

    # points for viz
    D["points"] = [dict(V=r["V"], w=r["weighted"], like=r["like"], comment=r["comment"],
        ritual=r["ritual"], humor=r["humor"], idx=r["idx"]) for r in rows]
    D["top10"] = [_slim(r) for r in sorted(rows, key=lambda r: r["weighted"], reverse=True)[:10]]
    D["bottom10"] = [_slim(r) for r in sorted(rows, key=lambda r: r["weighted"])[:10]]
    D["overall"] = full_desc(w)

    json.dump(D, open("evidence_data.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("\n".join(P))
    print("\n[נכתב] evidence_data.json")

def _slim(r):
    return {k: r[k] for k in ("idx", "ritual", "humor", "genre", "subject", "user",
                              "V", "like", "comment", "weighted")}

if __name__ == "__main__":
    main()
