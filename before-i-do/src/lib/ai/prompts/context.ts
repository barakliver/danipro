import "server-only";
import type { Studio } from "@/lib/auth/studio";
import { BRAND_SECTIONS } from "@/lib/brand/sections";
import { FEEDBACK_LABEL, type FeedbackKind } from "@/lib/domain/constants";
import { detectTopics, topicLabel } from "@/lib/domain/topics";
import { addDays, todayISO } from "@/lib/utils/dates";

export type BrandContext = { text: string; summary: Record<string, number | string[]> };

const SECTION_LABEL = new Map<string, string>(BRAND_SECTIONS.map((s) => [s.key, s.label]));
const ORDER = [
  "permanent_rules",
  "who_we_are",
  "audience",
  "tone",
  "good_examples",
  "bad_examples",
  "words_we_use",
  "words_we_avoid",
  "product",
  "product_facts",
  "founder_story",
  "personal_context",
  "visual_principles",
  "recurring_topics",
];

/**
 * The context a generation needs, and only that: Brand Brain, pillars, what we
 * recently published (to avoid repeats), taste signals from feedback, and the few
 * audience lines that match this topic. Never the whole database.
 */
export async function buildBrandContext(studio: Studio, focusText: string): Promise<BrandContext> {
  const { supabase, workspace } = studio;
  const ws = workspace.id;
  const since = addDays(todayISO(), -14);
  const topics = detectTopics(focusText);

  const [brand, pillars, feedback, recent, audience, tags] = await Promise.all([
    supabase.from("brand_brain_entries").select("section, title, body, meta").eq("workspace_id", ws).is("deleted_at", null).order("sort_order"),
    supabase.from("content_pillars").select("key, name, description, ratio_group").eq("workspace_id", ws).order("sort_order"),
    supabase.from("content_feedback").select("kind, text_snapshot").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(14),
    supabase
      .from("content_items")
      .select("hook, topic_tags, published_at")
      .eq("workspace_id", ws)
      .eq("status", "published")
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(20),
    supabase.from("audience_entries").select("original_text, topic").eq("workspace_id", ws).is("deleted_at", null).order("created_at", { ascending: false }).limit(60),
    supabase.from("gallery_tags").select("name").eq("workspace_id", ws),
  ]);

  const parts: string[] = [];
  const bySection = new Map<string, string[]>();
  for (const e of brand.data ?? []) {
    const avoid = typeof e.meta === "object" && e.meta && !Array.isArray(e.meta) ? (e.meta as Record<string, unknown>).avoid : undefined;
    const line = [e.title ? `${e.title}: ` : "", e.body, typeof avoid === "string" && avoid ? ` (להימנע: ${avoid})` : ""].join("");
    if (!bySection.has(e.section)) bySection.set(e.section, []);
    bySection.get(e.section)!.push(line);
  }
  for (const key of ORDER) {
    const lines = bySection.get(key);
    if (lines?.length) parts.push(`## ${SECTION_LABEL.get(key) ?? key}\n${lines.map((l) => `- ${l}`).join("\n")}`);
  }

  parts.push(
    `## עמודי תוכן (pillarKey)\n${(pillars.data ?? []).map((p) => `- ${p.key}: ${p.name} | ${p.description ?? ""}`).join("\n")}\nיחס מכוון: בערך 70% חיי הקהל, 20% המשחק בטבעיות, 10% מוצר ישיר. הנחיה, לא מכסה.`,
  );

  const liked = (feedback.data ?? []).filter((f) => f.kind === "this_is_us" && f.text_snapshot).slice(0, 4);
  const disliked = (feedback.data ?? []).filter((f) => f.kind === "not_us" && f.text_snapshot).slice(0, 3);
  const asks = (feedback.data ?? []).filter((f) => !["this_is_us", "not_us"].includes(f.kind));
  if (liked.length || disliked.length || asks.length) {
    const askCounts = new Map<string, number>();
    for (const a of asks) askCounts.set(a.kind, (askCounts.get(a.kind) ?? 0) + 1);
    parts.push(
      [
        "## מה למדנו מהמשוב שלנו",
        ...liked.map((f) => `- סימנו "זה אנחנו": ${f.text_snapshot!.slice(0, 220)}`),
        ...disliked.map((f) => `- סימנו "לא אנחנו": ${f.text_snapshot!.slice(0, 220)}`),
        askCounts.size ? `- בקשות חוזרות לאחרונה: ${Array.from(askCounts).map(([k, n]) => `${FEEDBACK_LABEL[k as FeedbackKind]} (${n})`).join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const recentTopics = new Map<string, number>();
  for (const r of recent.data ?? []) for (const t of r.topic_tags) recentTopics.set(t, (recentTopics.get(t) ?? 0) + 1);
  if (recentTopics.size || recent.data?.length) {
    parts.push(
      `## מה פרסמנו בשבועיים האחרונים (לא לחזור על אותם הוקים)\n${(recent.data ?? [])
        .slice(0, 8)
        .map((r) => `- ${r.hook ?? ""}`)
        .join("\n")}\nנושאים: ${Array.from(recentTopics).map(([t, n]) => `${topicLabel(t)} ×${n}`).join(", ")}`,
    );
  }

  const relevantAudience = (audience.data ?? [])
    .filter((a) => topics.length === 0 || detectTopics(a.original_text, a.topic).some((t) => topics.includes(t)))
    .slice(0, 6);
  if (relevantAudience.length) {
    parts.push(`## איך הקהל מדבר על זה (אנונימי, אפשר לשאול שפה, לא לצטט פרטים מזהים)\n${relevantAudience.map((a) => `- "${a.original_text}"`).join("\n")}`);
  }

  parts.push(`## תגיות בגלריה\n${(tags.data ?? []).map((t) => t.name).join(", ")}`);

  return {
    text: parts.join("\n\n"),
    summary: {
      brandEntries: brand.data?.length ?? 0,
      feedbackSignals: feedback.data?.length ?? 0,
      recentPublished: recent.data?.length ?? 0,
      audienceLines: relevantAudience.length,
      topics,
    },
  };
}
