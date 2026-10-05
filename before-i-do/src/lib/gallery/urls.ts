import "server-only";
import type { Studio } from "@/lib/auth/studio";

export type AssetUrls = Record<string, { thumb: string | null; preview: string | null; original: string | null }>;

/**
 * App URLs for Gallery media. Files stay in a private bucket and are streamed by
 * /api/media/:id after a membership check, so the browser never holds a shareable link.
 */
export async function signAssetUrls({ supabase, workspace }: Studio, assetIds: string[]): Promise<AssetUrls> {
  const ids = Array.from(new Set(assetIds.filter(Boolean)));
  if (!ids.length) return {};
  const { data: assets, error } = await supabase
    .from("gallery_assets")
    .select("id, thumb_path, preview_path, updated_at")
    .eq("workspace_id", workspace.id)
    .in("id", ids);
  if (error) throw error;
  const out: AssetUrls = {};
  for (const a of assets) {
    const v = encodeURIComponent(a.updated_at);
    const original = `/api/media/${a.id}?size=original&v=${v}`;
    const preview = a.preview_path ? `/api/media/${a.id}?size=preview&v=${v}` : original;
    out[a.id] = { thumb: a.thumb_path ? `/api/media/${a.id}?size=thumb&v=${v}` : preview, preview, original };
  }
  return out;
}

export function assetIdsInBody(body: { frames?: Array<{ assetId?: string }>; slides?: Array<{ assetId?: string }> }): string[] {
  return [...(body.frames ?? []), ...(body.slides ?? [])].map((f) => f.assetId).filter((id): id is string => Boolean(id));
}
