import "server-only";
import type { Studio } from "@/lib/auth/studio";
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

export async function listGallery({ supabase, workspace }: Studio, filter: GalleryFilter = {}): Promise<GalleryAsset[]> {
  const { data, error } = await supabase
    .from("gallery_assets")
    .select("*, tag_links:asset_tags(tag:gallery_tags(name)), usage:content_assets(count)")
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(600);
  if (error) throw error;

  const assets: GalleryAsset[] = (data as unknown as Array<GalleryAssetRow & { tag_links: Array<{ tag: { name: string } | null }>; usage: Array<{ count: number }> }>).map(
    ({ tag_links, usage, ...row }) => ({
      ...row,
      tags: tag_links.map((l) => l.tag?.name).filter((n): n is string => Boolean(n)),
      usageCount: usage[0]?.count ?? 0,
    }),
  );

  const q = filter.q?.trim();
  return assets.filter(
    (a) =>
      (!filter.collection || matchesCollection(a, filter.collection)) &&
      (!filter.tag || a.tags.includes(filter.tag)) &&
      (!filter.mediaType || a.media_type === filter.mediaType) &&
      (!q || [a.notes, a.original_filename, a.mood, a.location_category, ...a.tags, ...a.people].some((v) => v?.includes(q))),
  );
}

export async function listTags({ supabase, workspace }: Studio): Promise<Array<{ name: string; kind: string }>> {
  const { data, error } = await supabase.from("gallery_tags").select("name, kind").eq("workspace_id", workspace.id).order("created_at");
  if (error) throw error;
  return data;
}
