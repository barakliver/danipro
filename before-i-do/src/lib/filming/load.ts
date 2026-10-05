import "server-only";
import type { Studio } from "@/lib/auth/studio";
import { CONTENT_FORMATS, type ContentFormat } from "@/lib/domain/constants";
import { parseContentBody } from "@/lib/domain/content-body";
import type { FilmCandidate } from "./plan";

export type ShotDetail = { format: ContentFormat; action: string | null; onScreenText: string | null; shot: string | null; status: string };

function titleOf(row: { topic: string | null; hook: string | null }): string {
  const text = (row.topic || row.hook || "בלי שם").replace(/\s+/g, " ").trim();
  return text.length > 80 ? `${text.slice(0, 78)}…` : text;
}

function formatOf(value: string): ContentFormat {
  return (CONTENT_FORMATS as readonly string[]).includes(value) ? (value as ContentFormat) : "reel";
}

/** Everything waiting for a camera, with what the planner and the checklist need. */
export async function loadFilmCandidates({ supabase, workspace }: Studio): Promise<{ candidates: FilmCandidate[]; details: Record<string, ShotDetail> }> {
  const { data, error } = await supabase
    .from("content_items")
    .select("id, format, status, topic, hook, body, visual_notes, location_category, requires_barak, requires_couple, requires_product, calendar:content_calendar(scheduled_on)")
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .eq("requires_filming", true)
    .in("status", ["ready_to_film", "filmed"])
    .limit(300);
  if (error) throw error;

  const candidates: FilmCandidate[] = [];
  const details: Record<string, ShotDetail> = {};
  for (const row of data) {
    const body = parseContentBody(row.body);
    const calendar = Array.isArray(row.calendar) ? row.calendar[0] : row.calendar;
    const format = formatOf(row.format);
    details[row.id] = {
      format,
      status: row.status,
      action: body.pov?.action || null,
      onScreenText: body.pov?.onScreenText || null,
      shot: body.pov?.shot || null,
    };
    if (row.status !== "ready_to_film") continue;
    candidates.push({
      id: row.id,
      title: titleOf(row),
      format,
      pov: body.pov,
      visualNotes: row.visual_notes,
      locationCategory: row.location_category,
      requiresBarak: row.requires_barak,
      requiresCouple: row.requires_couple,
      requiresProduct: row.requires_product,
      scheduledOn: (calendar as { scheduled_on: string } | null)?.scheduled_on ?? null,
    });
  }
  return { candidates, details };
}
