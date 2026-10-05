"use client";

import { createBrowserSupabase } from "@/lib/supabase/browser";
import { registerUploadedAsset } from "./actions";

const BUCKET = "gallery";
const ACCEPTED = /^(image\/(jpeg|png|webp|heic|heif|avif|gif)|video\/(mp4|quicktime|webm))$/;
const MAX_BYTES = 200 * 1024 * 1024;

/** Phones drop connections; a stalled upload should fail (or retry) instead of spinning forever. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ההעלאה נתקעה")), ms);
    promise.then(
      (value) => (clearTimeout(timer), resolve(value)),
      (error) => (clearTimeout(timer), reject(error)),
    );
  });
}

// generous for slow mobile data: 30s plus ~50KB/s
const uploadBudget = (bytes: number) => 30_000 + bytes / 50;

export type UploadProgress = { done: number; total: number; failed: string[] };

function extension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  return file.type.split("/")[1] ?? "bin";
}

/** First frame of a video as a JPEG poster (the server cannot decode video). */
async function videoPoster(file: File): Promise<{ blob: Blob; width: number; height: number; duration: number } | null> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("video"));
    });
    video.currentTime = Math.min(0.5, video.duration / 2 || 0);
    await new Promise<void>((resolve) => (video.onseeked = () => resolve()));
    const scale = Math.min(1, 1080 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? { blob, width: video.videoWidth, height: video.videoHeight, duration: video.duration } : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Uploads straight from the phone to the private bucket (the file never passes
 * through our server), then registers it so thumbnails and tags are created.
 */
export async function uploadToGallery(
  files: File[],
  workspaceId: string,
  options: { tags?: string[]; onProgress?: (p: UploadProgress) => void } = {},
): Promise<{ ids: string[]; failed: string[] }> {
  const supabase = createBrowserSupabase();
  const ids: string[] = [];
  const failed: string[] = [];
  const queue = [...files];
  let done = 0;

  const worker = async () => {
    while (queue.length) {
      const file = queue.shift()!;
      try {
        if (!ACCEPTED.test(file.type)) throw new Error("סוג קובץ לא נתמך");
        if (file.size > MAX_BYTES) throw new Error("קובץ גדול מדי");
        const id = crypto.randomUUID();
        const storagePath = `${workspaceId}/${id}/original.${extension(file)}`;
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            // a retry may overwrite a half-finished first attempt at the same path
            const { error } = await withTimeout(supabase.storage.from(BUCKET).upload(storagePath, file, { contentType: file.type, upsert: attempt > 0 }), uploadBudget(file.size));
            if (error) throw error;
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
          }
        }
        if (lastError) throw lastError;

        const isVideo = file.type.startsWith("video/");
        let posterPath: string | undefined;
        let dims: { width?: number; height?: number; durationSeconds?: number } = {};
        if (isVideo) {
          const poster = await videoPoster(file);
          if (poster) {
            posterPath = `${workspaceId}/${id}/poster.jpg`;
            const { error: posterError } = await supabase.storage.from(BUCKET).upload(posterPath, poster.blob, { contentType: "image/jpeg" });
            if (posterError) posterPath = undefined;
            dims = { width: poster.width, height: poster.height, durationSeconds: Math.round(poster.duration * 10) / 10 };
          }
        }
        const result = await registerUploadedAsset({
          id,
          storagePath,
          mediaType: isVideo ? "video" : "image",
          mimeType: file.type,
          filename: file.name.slice(0, 240),
          byteSize: file.size,
          takenAt: file.lastModified ? new Date(file.lastModified).toISOString() : undefined,
          posterPath,
          tags: options.tags ?? [],
          ...dims,
        });
        if (!result.ok) throw new Error(result.error);
        ids.push(id);
      } catch (error) {
        failed.push(`${file.name}: ${error instanceof Error ? error.message : "נכשל"}`);
      } finally {
        done += 1;
        options.onProgress?.({ done, total: files.length, failed });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
  return { ids, failed };
}
