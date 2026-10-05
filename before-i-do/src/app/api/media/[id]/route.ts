import { NextResponse, type NextRequest } from "next/server";
import { getStudio } from "@/lib/auth/studio";

export const runtime = "nodejs";

/** Streams a private Gallery file to a signed-in workspace member. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse(null, { status: 400 });
  const size = request.nextUrl.searchParams.get("size") ?? "thumb";

  const { supabase, workspace } = await getStudio();
  const { data: asset } = await supabase
    .from("gallery_assets")
    .select("storage_path, thumb_path, preview_path, mime_type")
    .eq("workspace_id", workspace.id)
    .eq("id", id)
    .maybeSingle();
  if (!asset) return new NextResponse(null, { status: 404 });

  const path = size === "original" ? asset.storage_path : size === "preview" ? (asset.preview_path ?? asset.storage_path) : (asset.thumb_path ?? asset.preview_path ?? asset.storage_path);
  const { data, error } = await supabase.storage.from("gallery").download(path);
  if (error || !data) return new NextResponse(null, { status: 404 });

  const type = path.endsWith(".webp") ? "image/webp" : path.endsWith(".jpg") && path.includes("poster") ? "image/jpeg" : (asset.mime_type ?? data.type ?? "application/octet-stream");
  return new NextResponse(data.stream(), {
    headers: {
      "Content-Type": type,
      // the URL carries the asset version, so a private browser cache is safe
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
