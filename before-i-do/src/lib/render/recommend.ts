import type { ContentFormat } from "@/lib/domain/constants";
import type { ContentBody } from "@/lib/domain/content-body";
import type { TemplateFamily } from "./families";
import { isTemplateFamily } from "./families";

export type TemplateCandidate = {
  id: string;
  family: string;
  name: string;
  formats: string[];
  is_favorite: boolean;
  usage_count: number;
  last_used_at: string | null;
};

export type Recommendation = { templateId: string; family: TemplateFamily; reason: string; score: number };

type Signals = {
  format: ContentFormat;
  body: ContentBody;
  productPresence: "none" | "natural" | "direct";
  /** template ids of the most recent pieces, newest first */
  recentTemplateIds: string[];
};

function fit(family: TemplateFamily, s: Signals): { score: number; reason: string } {
  const frames = s.body.frames ?? [];
  const slides = s.body.slides ?? [];
  const interactive = frames.some((f) => f.kind === "poll" || f.kind === "question" || f.kind === "slider");
  const hasPhoto = [...frames, ...slides].some((f) => f.assetId);
  const listy = [...frames, ...slides].some((f) => f.text.split("\n").filter(Boolean).length >= 3);
  const twoVoices = [...frames, ...slides].some((f) => /^(אני|הוא|היא|מה שאמרנו|מה שהתכוונו)\s*:/m.test(f.text));
  const product = s.productPresence !== "none" || frames.some((f) => f.kind === "product");
  const isCarousel = s.format === "carousel";

  switch (family) {
    case "question":
      return interactive && !isCarousel ? { score: 90, reason: "יש כאן סקר או שאלה" } : { score: isCarousel ? 0 : 25, reason: "שאלה אחת עם הרבה מקום" };
    case "text_message":
      return { score: isCarousel ? 35 : 60, reason: "משפט אחד מוכר, בלי רעש" };
    case "notes":
      return listy ? { score: 80, reason: "זו רשימה, פתק מתאים לה" } : { score: 30, reason: "מרגיש כמו פתק אישי" };
    case "conversation":
      return twoVoices ? { score: 88, reason: "יש כאן שני קולות" } : { score: 15, reason: "שתי נקודות מבט" };
    case "real_photo":
      return hasPhoto ? { score: 85, reason: "יש תמונה אמיתית מהגלריה" } : { score: 20, reason: "צריך תמונה מהגלריה" };
    case "product_in_life":
      return product && hasPhoto ? { score: 92, reason: "המשחק בתמונה אמיתית" } : product ? { score: 40, reason: "המשחק בטבעיות, עם תמונה" } : { score: 5, reason: "המשחק בחיים" };
    case "carousel_editorial":
      return isCarousel ? { score: 82, reason: "מחשבה אחת בכל שקף" } : { score: 0, reason: "" };
  }
}

/**
 * 2–3 suitable templates. Repetition is penalized: a template used in the last
 * few pieces drops, so the feed does not turn into the same Canva look.
 */
export function recommendTemplates(templates: TemplateCandidate[], signals: Signals, limit = 3): Recommendation[] {
  const target = signals.format === "carousel" ? "carousel" : "story";
  const ranked = templates
    .filter((t) => isTemplateFamily(t.family) && t.formats.includes(target))
    .map((t) => {
      const family = t.family as TemplateFamily;
      const base = fit(family, signals);
      const recentIndex = signals.recentTemplateIds.indexOf(t.id);
      const repetition = recentIndex === -1 ? 0 : recentIndex < 2 ? 35 : recentIndex < 5 ? 15 : 0;
      const favorite = t.is_favorite ? 8 : 0;
      return { templateId: t.id, family, reason: base.reason, score: base.score - repetition + favorite };
    })
    .filter((r) => r.score > 10)
    .sort((a, b) => b.score - a.score);

  // one per family: variety beats two near-identical suggestions
  const seen = new Set<TemplateFamily>();
  const out: Recommendation[] = [];
  for (const r of ranked) {
    if (seen.has(r.family)) continue;
    seen.add(r.family);
    out.push(r);
    if (out.length === limit) break;
  }
  return out;
}
