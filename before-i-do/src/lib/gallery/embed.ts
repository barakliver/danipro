import "server-only";
import sharp from "sharp";
import type { Studio } from "@/lib/auth/studio";

/**
 * Photos for server-side export, embedded as data URIs so the headless renderer
 * never touches the network. Resized to 2160px on the long edge: enough for a
 * 1080×1920 Story without shipping 12MP originals through Chromium.
 */
export async function embedAssets({ supabase, workspace }: Studio, ids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids));
  if (!unique.length) return {};
  const { data: assets } = await supabase.from("gallery_assets").select("id, storage_path, preview_path").eq("workspace_id", workspace.id).in("id", unique);
  const out: Record<string, string> = {};
  await Promise.all(
    (assets ?? []).map(async (a) => {
      for (const path of [a.storage_path, a.preview_path].filter((p): p is string => Boolean(p))) {
        const { data } = await supabase.storage.from("gallery").download(path);
        if (!data) continue;
        try {
          const jpeg = await sharp(Buffer.from(await data.arrayBuffer()), { failOn: "none" })
            .rotate()
            .resize({ width: 2160, height: 2160, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 92, mozjpeg: true })
            .toBuffer();
          out[a.id] = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
          return;
        } catch {
          // e.g. HEIC original: fall back to the generated preview
        }
      }
    }),
  );
  return out;
}
