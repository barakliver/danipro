import "server-only";
import type { Studio } from "@/lib/auth/studio";
import type { GalleryAssetRow } from "@/lib/supabase/database.types";
import { matchesCollection, type GalleryAsset, type GalleryFilter } from "./collections";

export { SMART_COLLECTIONS, matchesCollection, type GalleryAsset, type GalleryFilter, type SmartCollection } from "./collections";

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
