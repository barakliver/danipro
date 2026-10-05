import type { GalleryAssetRow } from "@/lib/supabase/database.types";

export type GalleryAsset = GalleryAssetRow & { tags: string[]; usageCount: number };

export const SMART_COLLECTIONS = [
  { key: "story", label: "מתאים לסטורי" },
  { key: "carousel", label: "מתאים לקרוסלה" },
  { key: "barak", label: "עם ברק" },
  { key: "game", label: "עם המשחק" },
  { key: "bts", label: "מאחורי הקלעים" },
  { key: "unused", label: "עוד לא השתמשנו" },
  { key: "worked", label: "עבד טוב בעבר" },
] as const;
export type SmartCollection = (typeof SMART_COLLECTIONS)[number]["key"];

export type GalleryFilter = { collection?: SmartCollection; tag?: string; mediaType?: "image" | "video"; q?: string };

const GAME_TAGS = new Set(["מוצר", "קופסה", "קלפים"]);

export function matchesCollection(asset: GalleryAsset, collection: SmartCollection): boolean {
  switch (collection) {
    case "story":
      return asset.suitable_formats.includes("story") || asset.orientation === "portrait";
    case "carousel":
      return asset.suitable_formats.includes("carousel");
    case "barak":
      return asset.people.includes("ברק") || asset.tags.includes("ברק");
    case "game":
      return asset.tags.some((t) => GAME_TAGS.has(t));
    case "bts":
      return asset.tags.some((t) => t === "מאחורי הקלעים" || t === "בית דפוס" || t === "אריזה" || t === "משלוחים");
    case "unused":
      return asset.usageCount === 0;
    case "worked":
      return asset.worked_well;
  }
}

