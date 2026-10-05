import JSZip from "jszip";
import { NextResponse, type NextRequest } from "next/server";
import { getStudio } from "@/lib/auth/studio";
import { getContent } from "@/lib/content/queries";
import { getRenderContext } from "@/lib/render/context";
import { assetIdsInBody, signAssetUrls } from "@/lib/gallery/urls";
import { documentsFor, planFrames } from "@/lib/render/plan";
import { canvasSize } from "@/lib/render/document";
import { inlineFontCss, renderPngs, serverRenderAvailable } from "@/lib/render/server-render";
import { copyBundle } from "@/lib/content/copy-text";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/export/:id?frame=<key>  → one PNG
 * GET /api/export/:id              → ZIP of every frame + copy.txt (or a single PNG when there is one frame)
 * 501 when server rendering is not configured; the client then renders in the browser.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  if (!serverRenderAvailable()) return NextResponse.json({ fallback: true }, { status: 501 });

  const studio = await getStudio();
  const content = await getContent(studio, id);
  if (!content) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [render, urls] = await Promise.all([getRenderContext(studio), signAssetUrls(studio, assetIdsInBody(content.body))]);
  let frames = planFrames(content, render.templates, render.settings, (assetId) => urls[assetId]?.original ?? urls[assetId]?.preview);
  const frameKey = request.nextUrl.searchParams.get("frame");
  if (frameKey) frames = frames.filter((f) => f.key === frameKey);
  if (!frames.length) return NextResponse.json({ error: "אין מה לייצא. צריך טקסט לפחות בפריים אחד." }, { status: 422 });

  const size = canvasSize(frames[0].input.format);
  const pngs = await renderPngs(documentsFor(frames, await inlineFontCss(), false), size);
  const base = `before-i-do-${(content.calendar?.plan_day ? `day${String(content.calendar.plan_day).padStart(2, "0")}-` : "") + content.format}`;

  if (pngs.length === 1) {
    return new NextResponse(new Uint8Array(pngs[0]), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${base}${frameKey ? `-${frames[0].key.slice(0, 6)}` : ""}.png"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const zip = new JSZip();
  pngs.forEach((png, i) => zip.file(`${base}-${String(i + 1).padStart(2, "0")}.png`, png));
  zip.file("copy.txt", copyBundle(content));
  const archive = await zip.generateAsync({ type: "uint8array", compression: "STORE" });
  return new NextResponse(archive as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${base}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
