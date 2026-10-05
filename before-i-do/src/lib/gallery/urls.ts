import "server-only";
import type { Studio } from "@/lib/auth/studio";

const BUCKET = "gallery";
/** Signed URLs live long enough for an editing session, short enough to stay private. */
export const SIGNED_URL_SECONDS = 60 * 60 * 2;

export type AssetUrls = Record<string, { thumb: string | null; preview: string | null; original: string | null }>;

/**
 * Signs thumbnail / preview / original URLs for the given assets.
 * Assets stay in a private bucket; nothing in the Gallery has a public URL.
 */
export async function signAssetUrls({ supabase, workspace }: Studio, assetIds: string[]): Promise<AssetUrls> {
  const ids = Array.from(new Set(assetIds.filter(Boolean)));
  if (!ids.length) return {};
  const { data: assets, error } = await supabase
    .from("gallery_assets")
    .select("id, storage_path, thumb_path, preview_path")
    .eq("workspace_id", workspace.id)
    .in("id", ids);
  if (error) throw error;

  const paths = assets.flatMap((a) => [a.thumb_path, a.preview_path, a.storage_path].filter((p): p is string => Boolean(p)));
  if (!paths.length) return {};
  const { data: signed, error: signError } = await supabase.storage.from(BUCKET).createSignedUrls(Array.from(new Set(paths)), SIGNED_URL_SECONDS);
  if (signError) throw signError;
  const byPath = new Map(signed.filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));

  const out: AssetUrls = {};
  for (const a of assets) {
    const original = byPath.get(a.storage_path) ?? null;
    const preview = (a.preview_path && byPath.get(a.preview_path)) || original;
    out[a.id] = { thumb: (a.thumb_path && byPath.get(a.thumb_path)) || preview, preview, original };
  }
  return out;
}

export function assetIdsInBody(body: { frames?: Array<{ assetId?: string }>; slides?: Array<{ assetId?: string }> }): string[] {
  return [...(body.frames ?? []), ...(body.slides ?? [])].map((f) => f.assetId).filter((id): id is string => Boolean(id));
}
