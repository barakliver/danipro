import { topicLabel } from "@/lib/domain/topics";
import { diffDays } from "@/lib/utils/dates";

export type MemoryItem = {
  id: string;
  hook: string | null;
  topic_tags: string[];
  template_id: string | null;
  assetIds: string[];
  /** published date, or scheduled date for upcoming pieces */
  day: string | null;
  published: boolean;
};

export type RepetitionWarning = { code: "topic" | "hook" | "template" | "asset"; message: string };

const WINDOW_DAYS = 10;
const TOPIC_LIMIT = 2;

function words(text: string): Set<string> {
  return new Set(
    text
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

export function hookSimilarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared += 1;
  return shared / Math.min(wa.size, wb.size);
}

/**
 * Advisory only: tells you when a topic, a hook, a template or a photo has been used
 * recently. It never blocks publishing.
 */
export function repetitionWarnings(current: MemoryItem, others: MemoryItem[], referenceDay: string): RepetitionWarning[] {
  const day = current.day ?? referenceDay;
  const recent = others.filter((o) => o.id !== current.id && o.day && Math.abs(diffDays(o.day, day)) <= WINDOW_DAYS && o.published);
  const warnings: RepetitionWarning[] = [];

  for (const topic of current.topic_tags) {
    if (topic === "product") continue;
    const count = recent.filter((o) => o.topic_tags.includes(topic)).length;
    if (count >= TOPIC_LIMIT) {
      warnings.push({ code: "topic", message: `דיברנו על ${topicLabel(topic)} ${count} פעמים ב־${WINDOW_DAYS} הימים האחרונים.` });
    }
  }

  if (current.hook) {
    const similar = others.find((o) => o.id !== current.id && o.published && o.hook && hookSimilarity(current.hook!, o.hook) >= 0.6);
    if (similar) warnings.push({ code: "hook", message: `הוק דומה כבר פורסם: "${similar.hook!.slice(0, 60)}"` });
  }

  if (current.template_id) {
    const lastTwo = recent.filter((o) => o.template_id).sort((a, b) => (b.day ?? "").localeCompare(a.day ?? "")).slice(0, 2);
    if (lastTwo.length === 2 && lastTwo.every((o) => o.template_id === current.template_id)) {
      warnings.push({ code: "template", message: "אותה תבנית בשלושה פרסומים ברצף. אולי לגוון?" });
    }
  }

  for (const asset of current.assetIds) {
    if (recent.some((o) => o.assetIds.includes(asset))) {
      warnings.push({ code: "asset", message: "התמונה הזו כבר הופיעה בתוכן מהשבוע וחצי האחרונים." });
      break;
    }
  }
  return warnings;
}
