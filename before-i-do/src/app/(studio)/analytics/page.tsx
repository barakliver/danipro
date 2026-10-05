import type { Metadata } from "next";
import { getStudio } from "@/lib/auth/studio";
import { findPatterns, parseSeconds, ratioShares, METRICS, type MeasuredContent, type Metrics } from "@/lib/analytics/patterns";
import { CONTENT_FORMATS, FORMAT_LABEL, type ContentFormat, type RatioGroup } from "@/lib/domain/constants";
import { parseContentBody } from "@/lib/domain/content-body";
import { topicLabel } from "@/lib/domain/topics";
import { addDays, todayISO } from "@/lib/utils/dates";
import { AnalyticsView, type PublishedRow } from "./analytics-view";

export const metadata: Metadata = { title: "מה עבד" };

const formatOf = (v: string): ContentFormat => ((CONTENT_FORMATS as readonly string[]).includes(v) ? (v as ContentFormat) : "post");

export default async function AnalyticsPage() {
  const studio = await getStudio();
  const { supabase, workspace } = studio;
  const [{ data: content, error }, { data: entries, error: entriesError }] = await Promise.all([
    supabase
      .from("content_items")
      .select("id, format, topic, hook, body, topic_tags, published_at, pillar:content_pillars(name, ratio_group)")
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(500),
    supabase.from("analytics_entries").select("*").eq("workspace_id", workspace.id).order("recorded_on", { ascending: false }).limit(2000),
  ]);
  if (error) throw error;
  if (entriesError) throw entriesError;

  // numbers are cumulative: the most recent entry per piece is the one that counts
  const latest = new Map<string, (typeof entries)[number]>();
  for (const e of entries) if (!latest.has(e.content_id)) latest.set(e.content_id, e);

  const rows: PublishedRow[] = content.map((c) => {
    const pillar = (Array.isArray(c.pillar) ? c.pillar[0] : c.pillar) as { name: string; ratio_group: RatioGroup } | null;
    const entry = latest.get(c.id);
    const metrics: Metrics = entry ? Object.fromEntries(METRICS.map((m) => [m.key, entry[m.key]])) : {};
    const title = (c.topic || c.hook || "בלי שם").replace(/\s+/g, " ").trim();
    return {
      id: c.id,
      title: title.length > 90 ? `${title.slice(0, 88)}…` : title,
      format: formatOf(c.format),
      pillarName: pillar?.name ?? null,
      ratioGroup: pillar?.ratio_group ?? null,
      topics: c.topic_tags,
      povSeconds: parseSeconds(parseContentBody(c.body).pov?.length),
      publishedAt: c.published_at,
      metrics,
      recordedOn: entry?.recorded_on ?? null,
      notes: entry?.notes ?? null,
    };
  });

  const measured: MeasuredContent[] = rows.filter((r) => r.recordedOn);
  const patterns = findPatterns(measured, (kind, key) =>
    kind === "topic" ? `תוכן על ${topicLabel(key)}` : kind === "pillar" ? `"${key}"` : kind === "format" ? FORMAT_LABEL[key as ContentFormat] : key === "short" ? "POV קצר מ־8 שניות" : "POV של 8 שניות ומעלה",
  );
  const since = addDays(todayISO(), -30);
  const recent = rows.filter((r) => r.publishedAt && r.publishedAt.slice(0, 10) >= since);

  return <AnalyticsView rows={rows} patterns={patterns} ratio={ratioShares(recent.map((r) => r.ratioGroup))} recentCount={recent.length} />;
}
