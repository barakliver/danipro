"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { z } from "zod";
import { getStudio } from "@/lib/auth/studio";
import { signAssetUrls, type AssetUrls } from "./urls";
import { listGallery, type GalleryAsset, type GalleryFilter } from "./queries";
import { orientationOf, suitableFormats } from "./shape";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error: e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "משהו השתבש",
});

const BUCKET = "gallery";
const THUMB_WIDTH = 480;
const PREVIEW_EDGE = 1600;

const registerSchema = z.object({
  id: z.uuid(),
  storagePath: z.string().min(10).max(300),
  mediaType: z.enum(["image", "video"]),
  mimeType: z.string().max(80),
  filename: z.string().max(240),
  byteSize: z.number().int().nonnegative(),
  takenAt: z.iso.datetime().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().nonnegative().optional(),
  /** poster frame already uploaded by the browser (videos) */
  posterPath: z.string().max(300).optional(),
  tags: z.array(z.string().max(40)).max(20).default([]),
});

/**
 * Called after the browser uploaded the original to the private bucket.
 * Images get an EXIF-rotated thumbnail and preview; originals are never modified.
 */
export async function registerUploadedAsset(input: z.input<typeof registerSchema>): Promise<Result<{ id: string }>> {
  try {
    const clean = registerSchema.parse(input);
    const studio = await getStudio();
    const { supabase, workspace, userId } = studio;
    const ws = workspace.id;
    if (!clean.storagePath.startsWith(`${ws}/${clean.id}/`)) throw new Error("נתיב קובץ לא תקין");

    let width = clean.width ?? null;
    let height = clean.height ?? null;
    let thumbPath: string | null = clean.posterPath ?? null;
    let previewPath: string | null = clean.posterPath ?? null;

    if (clean.mediaType === "image") {
      try {
        const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(clean.storagePath);
        if (downloadError) throw downloadError;
        const original = Buffer.from(await blob.arrayBuffer());
        const meta = await sharp(original, { failOn: "none" }).metadata();
        // metadata() reports pre-rotation size; swap for 90° EXIF orientations
        const swap = (meta.orientation ?? 1) >= 5;
        width = (swap ? meta.height : meta.width) ?? width;
        height = (swap ? meta.width : meta.height) ?? height;

        const [thumb, preview] = await Promise.all([
          sharp(original, { failOn: "none" }).rotate().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality: 76 }).toBuffer(),
          sharp(original, { failOn: "none" })
            .rotate()
            .resize({ width: PREVIEW_EDGE, height: PREVIEW_EDGE, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 86 })
            .toBuffer(),
        ]);
        const nextThumb = `${ws}/${clean.id}/thumb.webp`;
        const nextPreview = `${ws}/${clean.id}/preview.webp`;
        const uploads = await Promise.all([
          supabase.storage.from(BUCKET).upload(nextThumb, thumb, { contentType: "image/webp", upsert: true }),
          supabase.storage.from(BUCKET).upload(nextPreview, preview, { contentType: "image/webp", upsert: true }),
        ]);
        for (const u of uploads) if (u.error) throw u.error;
        thumbPath = nextThumb;
        previewPath = nextPreview;
      } catch (processingError) {
        // e.g. HEIC without a decoder: keep the original, show it without a thumbnail
        console.warn("gallery: could not create previews", processingError);
      }
    }

    const orientation = width && height ? orientationOf(width, height) : null;
    const formats = width && height ? suitableFormats(width, height) : [];
    const { error } = await supabase.from("gallery_assets").insert({
      id: clean.id,
      workspace_id: ws,
      storage_path: clean.storagePath,
      thumb_path: thumbPath,
      preview_path: previewPath,
      media_type: clean.mediaType,
      mime_type: clean.mimeType,
      original_filename: clean.filename,
      byte_size: clean.byteSize,
      width,
      height,
      duration_seconds: clean.durationSeconds ?? null,
      orientation,
      taken_at: clean.takenAt ?? null,
      suitable_formats: formats,
      created_by: userId,
    });
    if (error) throw error;

    // orientation-based tags are a safe automatic suggestion; people/places come from a person (or vision AI)
    const autoTags = new Set(clean.tags);
    if (formats.includes("story")) autoTags.add("סטורי");
    if (formats.includes("carousel")) autoTags.add("קרוסלה");
    if (clean.mediaType === "video") autoTags.add("ריל");
    if (autoTags.size) await setTags(studio, clean.id, Array.from(autoTags), clean.tags.length ? "manual" : "auto");

    revalidatePath("/gallery");
    return { ok: true, data: { id: clean.id } };
  } catch (error) {
    return fail(error);
  }
}

async function setTags(studio: Awaited<ReturnType<typeof getStudio>>, assetId: string, names: string[], source: "manual" | "auto") {
  const { supabase, workspace } = studio;
  const clean = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  if (!clean.length) return;
  const { error: upsertError } = await supabase
    .from("gallery_tags")
    .upsert(clean.map((name) => ({ workspace_id: workspace.id, name })), { onConflict: "workspace_id,name", ignoreDuplicates: true });
  if (upsertError) throw upsertError;
  const { data: tags, error } = await supabase.from("gallery_tags").select("id, name").eq("workspace_id", workspace.id).in("name", clean);
  if (error) throw error;
  const { error: linkError } = await supabase
    .from("asset_tags")
    .upsert(tags.map((t) => ({ asset_id: assetId, tag_id: t.id, workspace_id: workspace.id, source })), { onConflict: "asset_id,tag_id", ignoreDuplicates: true });
  if (linkError) throw linkError;
}

const updateSchema = z.object({
  tags: z.array(z.string().max(40)).max(40).optional(),
  people: z.array(z.string().max(40)).max(10).optional(),
  location_category: z.string().max(60).nullable().optional(),
  mood: z.string().max(60).nullable().optional(),
  suitable_formats: z.array(z.enum(["story", "carousel", "post", "reel"])).optional(),
  notes: z.string().max(1000).nullable().optional(),
  worked_well: z.boolean().optional(),
  taken_at: z.iso.datetime().nullable().optional(),
});

export async function updateAsset(id: string, input: z.input<typeof updateSchema>): Promise<Result> {
  try {
    z.uuid().parse(id);
    const { tags, ...fields } = updateSchema.parse(input);
    const studio = await getStudio();
    const { supabase, workspace } = studio;
    if (Object.keys(fields).length) {
      const { error } = await supabase.from("gallery_assets").update(fields).eq("workspace_id", workspace.id).eq("id", id);
      if (error) throw error;
    }
    if (tags) {
      const { data: current } = await supabase.from("asset_tags").select("tag_id, tag:gallery_tags(name)").eq("asset_id", id);
      const keep = new Set(tags);
      const remove = (current ?? []).filter((r) => !keep.has((r.tag as unknown as { name: string } | null)?.name ?? "")).map((r) => r.tag_id);
      if (remove.length) await supabase.from("asset_tags").delete().eq("asset_id", id).in("tag_id", remove);
      await setTags(studio, id, tags, "manual");
    }
    revalidatePath("/gallery");
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

/** Soft delete: the file stays in private storage until cleaned up, so content that used it can be recovered. */
export async function deleteAsset(id: string): Promise<Result> {
  try {
    z.uuid().parse(id);
    const { supabase, workspace } = await getStudio();
    const { error } = await supabase.from("gallery_assets").update({ deleted_at: new Date().toISOString() }).eq("workspace_id", workspace.id).eq("id", id);
    if (error) throw error;
    revalidatePath("/gallery");
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

/** For pickers in the editor and Create: assets + thumbnail URLs. */
export async function pickerGallery(filter: GalleryFilter = {}): Promise<Result<{ assets: GalleryAsset[]; urls: AssetUrls }>> {
  try {
    const studio = await getStudio();
    const assets = await listGallery(studio, filter);
    const urls = await signAssetUrls(studio, assets.map((a) => a.id));
    return { ok: true, data: { assets, urls } };
  } catch (error) {
    return fail(error);
  }
}

export async function signAssets(ids: string[]): Promise<Result<AssetUrls>> {
  try {
    z.array(z.uuid()).max(60).parse(ids);
    return { ok: true, data: await signAssetUrls(await getStudio(), ids) };
  } catch (error) {
    return fail(error);
  }
}

/** Where an asset was used: content items with format, status and date. */
export async function assetUsage(id: string): Promise<Result<Array<{ id: string; title: string; format: string; status: string; published_at: string | null }>>> {
  try {
    z.uuid().parse(id);
    const { supabase, workspace } = await getStudio();
    const { data, error } = await supabase
      .from("content_assets")
      .select("content:content_items(id, hook, topic, format, status, published_at, deleted_at)")
      .eq("workspace_id", workspace.id)
      .eq("asset_id", id);
    if (error) throw error;
    const seen = new Set<string>();
    const rows = (data as unknown as Array<{ content: { id: string; hook: string | null; topic: string | null; format: string; status: string; published_at: string | null; deleted_at: string | null } | null }>)
      .map((r) => r.content)
      .filter((c): c is NonNullable<typeof c> => Boolean(c) && !c!.deleted_at && !seen.has(c!.id) && Boolean(seen.add(c!.id)));
    return { ok: true, data: rows.map((c) => ({ id: c.id, title: c.hook || c.topic || "בלי כותרת", format: c.format, status: c.status, published_at: c.published_at })) };
  } catch (error) {
    return fail(error);
  }
}
