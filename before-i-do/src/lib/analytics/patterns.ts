import type { ContentFormat, RatioGroup } from "@/lib/domain/constants";

export const METRICS = [
  { key: "shares", label: "שיתופים", primary: true },
  { key: "saves", label: "שמירות", primary: true },
  { key: "story_replies", label: "תגובות לסטורי", primary: true },
  { key: "comments", label: "תגובות", primary: false },
  { key: "views", label: "צפיות", primary: false },
  { key: "reach", label: "חשיפה", primary: false },
  { key: "likes", label: "לייקים", primary: false },
  { key: "poll_responses", label: "הצבעות בסקר", primary: false },
  { key: "profile_visits", label: "כניסות לפרופיל", primary: false },
  { key: "link_clicks", label: "קליקים לקישור", primary: false },
  { key: "sales", label: "מכירות", primary: false },
] as const;
export type MetricKey = (typeof METRICS)[number]["key"];
export type Metrics = Partial<Record<MetricKey, number | null>>;

/** The three signals that mean "this is us": sent to someone, kept, answered. */
export const SIGNALS = ["shares", "saves", "story_replies"] as const;
export type Signal = (typeof SIGNALS)[number];
const SIGNAL_VERB: Record<Signal, string> = { shares: "שותף", saves: "נשמר", story_replies: "קיבל תשובות" };

export type MeasuredContent = {
  id: string;
  title: string;
  format: ContentFormat;
  pillarName: string | null;
  topics: string[];
  povSeconds: number | null;
  metrics: Metrics;
};

export type Confidence = "early" | "direction" | "pattern";
export type Pattern = { id: string; text: string; signal: Signal; group: string; n: number; ratio: number; confidence: Confidence };

export const MIN_GROUP = 3;
const MIN_LIFT = 1.3;

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function confidenceOf(n: number): Confidence {
  return n >= 8 ? "pattern" : n >= 5 ? "direction" : "early";
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  early: "מוקדם לדעת",
  direction: "כיוון ראשוני",
  pattern: "חוזר על עצמו",
};

/** First number in a free-text length like "5-7 שניות" → 5. */
export function parseSeconds(length: string | null | undefined): number | null {
  const match = length?.match(/\d+/);
  return match ? Number(match[0]) : null;
}

/**
 * Groups that did noticeably better than the rest on shares/saves/replies.
 * Compares medians (one viral post can't make a pattern) and only speaks
 * about groups with enough pieces. Wording describes, never explains.
 */
export function findPatterns(items: MeasuredContent[], groupLabel: (kind: "topic" | "pillar" | "format" | "pov", key: string) => string): Pattern[] {
  const measured = items.filter((i) => SIGNALS.some((s) => typeof i.metrics[s] === "number"));
  if (measured.length < MIN_GROUP * 2) return [];

  const groups = new Map<string, { kind: "topic" | "pillar" | "format" | "pov"; key: string; items: MeasuredContent[] }>();
  const add = (kind: "topic" | "pillar" | "format" | "pov", key: string, item: MeasuredContent) => {
    const id = `${kind}:${key}`;
    if (!groups.has(id)) groups.set(id, { kind, key, items: [] });
    groups.get(id)!.items.push(item);
  };
  for (const item of measured) {
    for (const t of item.topics) add("topic", t, item);
    if (item.pillarName) add("pillar", item.pillarName, item);
    add("format", item.format, item);
    if (item.format === "pov_reel" && item.povSeconds != null) add("pov", item.povSeconds < 8 ? "short" : "long", item);
  }

  const patterns: Pattern[] = [];
  for (const signal of SIGNALS) {
    const values = (list: MeasuredContent[]) => list.map((i) => i.metrics[signal]).filter((v): v is number => typeof v === "number");
    for (const [id, group] of groups) {
      const inside = values(group.items);
      if (inside.length < MIN_GROUP) continue;
      const outside = values(measured.filter((i) => !group.items.includes(i)));
      if (outside.length < MIN_GROUP) continue;
      const base = Math.max(median(outside), 1);
      const ratio = median(inside) / base;
      if (ratio < MIN_LIFT) continue;
      const label = groupLabel(group.kind, group.key);
      patterns.push({
        id: `${id}:${signal}`,
        text: `${label} ${SIGNAL_VERB[signal]} בערך פי ${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)} מהשאר`,
        signal,
        group: id,
        n: inside.length,
        ratio,
        confidence: confidenceOf(inside.length),
      });
    }
  }
  // strongest evidence first, one line per group
  const seen = new Set<string>();
  return patterns
    .sort((a, b) => b.n - a.n || b.ratio - a.ratio)
    .filter((p) => (seen.has(p.group) ? false : (seen.add(p.group), true)))
    .slice(0, 6);
}

export type RatioShare = { group: RatioGroup; count: number; share: number };

export function ratioShares(groups: Array<RatioGroup | null>): RatioShare[] {
  const known = groups.filter((g): g is RatioGroup => Boolean(g));
  const order: RatioGroup[] = ["audience", "natural_product", "direct_product"];
  return order.map((group) => {
    const count = known.filter((g) => g === group).length;
    return { group, count, share: known.length ? count / known.length : 0 };
  });
}
