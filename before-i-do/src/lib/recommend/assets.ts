import type { GalleryAsset } from "@/lib/gallery/collections";

export type AssetSignals = {
  /** tags the content suggests (from the generator or topic mapping) */
  tags: string[];
  format: string;
  productPresence: "none" | "natural" | "direct";
  location?: string | null;
  /** asset ids used in the last couple of weeks */
  recentlyUsed?: string[];
};

const PRODUCT_TAGS = ["מוצר", "קופסה", "קלפים"];

/**
 * Ranks real Gallery photos for a piece. Real photos always beat generic visuals;
 * fresh photos beat ones we just used; photos that worked before get a nudge.
 */
export function recommendAssets(assets: GalleryAsset[], signals: AssetSignals, limit = 6): Array<{ asset: GalleryAsset; score: number; why: string }> {
  const wanted = new Set(signals.tags);
  if (signals.productPresence !== "none") PRODUCT_TAGS.forEach((t) => wanted.add(t));
  const formatKey = signals.format === "carousel" ? "carousel" : signals.format.includes("reel") ? "reel" : signals.format === "post" ? "post" : "story";
  const recent = new Set(signals.recentlyUsed ?? []);

  return assets
    .filter((a) => a.media_type === "image" || formatKey === "reel")
    .map((asset) => {
      let score = 0;
      const reasons: string[] = [];
      const overlap = asset.tags.filter((t) => wanted.has(t)).length + asset.people.filter((p) => wanted.has(p)).length;
      if (overlap) {
        score += overlap * 20;
        reasons.push("מתאים לנושא");
      }
      if (asset.suitable_formats.includes(formatKey)) {
        score += 15;
        reasons.push(formatKey === "story" ? "בפורמט של סטורי" : formatKey === "carousel" ? "בפורמט של קרוסלה" : "בפורמט מתאים");
      }
      if (signals.location && asset.location_category === signals.location) score += 10;
      if (signals.productPresence === "none" && asset.tags.some((t) => PRODUCT_TAGS.includes(t))) score -= 12;
      if (asset.usageCount === 0) {
        score += 8;
        reasons.push("עוד לא השתמשנו");
      }
      if (asset.worked_well) {
        score += 10;
        reasons.push("עבד טוב בעבר");
      }
      if (recent.has(asset.id)) {
        score -= 25;
        reasons.push("השתמשנו לאחרונה");
      }
      return { asset, score, why: reasons.slice(0, 2).join(", ") };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Gallery tags that fit a topic, for when no model suggested tags. */
export const TOPIC_TO_TAGS: Record<string, string[]> = {
  guest_list: ["בית", "לא מבוים"],
  budget: ["בית", "לא מבוים"],
  family: ["אנחנו"],
  product: PRODUCT_TAGS,
  behind_scenes: ["מאחורי הקלעים", "אריזה", "משלוחים", "בית דפוס"],
  food: ["מסעדה"],
  planning_fatigue: ["בית", "ערב"],
};
