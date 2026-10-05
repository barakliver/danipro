import "server-only";
import type { Studio } from "@/lib/auth/studio";
import { parseContentBody } from "@/lib/domain/content-body";
import { isStatus } from "@/lib/domain/status";
import { CONTENT_FORMATS, type ContentFormat } from "@/lib/domain/constants";
import type { Content, CalendarRef, PillarRef } from "./types";

export const CONTENT_SELECT =
  "*, pillar:content_pillars(id, key, name, ratio_group), calendar:content_calendar(scheduled_on, scheduled_time, plan_day, slot)";

type RawContent = Record<string, unknown> & {
  format: string;
  status: string;
  body: unknown;
  pillar: unknown;
  calendar: unknown;
};

export function toContent(raw: RawContent): Content {
  const calendar = Array.isArray(raw.calendar) ? raw.calendar[0] : raw.calendar;
  return {
    ...(raw as unknown as Content),
    format: (CONTENT_FORMATS as readonly string[]).includes(raw.format) ? (raw.format as ContentFormat) : "post",
    status: isStatus(raw.status) ? raw.status : "idea",
    body: parseContentBody(raw.body),
    pillar: (raw.pillar as PillarRef | null) ?? null,
    calendar: (calendar as CalendarRef | null) ?? null,
  };
}

export async function listContent(
  { supabase, workspace }: Studio,
  options: { from?: string; to?: string; includeUnscheduled?: boolean } = {},
): Promise<Content[]> {
  const { data, error } = await supabase
    .from("content_items")
    .select(CONTENT_SELECT)
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const items = (data as unknown as RawContent[]).map(toContent);
  if (!options.from && !options.to) return items;
  return items.filter((item) => {
    const day = item.calendar?.scheduled_on;
    if (!day) return Boolean(options.includeUnscheduled);
    return (!options.from || day >= options.from) && (!options.to || day <= options.to);
  });
}

export async function getContent({ supabase, workspace }: Studio, id: string): Promise<Content | null> {
  const { data, error } = await supabase
    .from("content_items")
    .select(CONTENT_SELECT)
    .eq("workspace_id", workspace.id)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ? toContent(data as unknown as RawContent) : null;
}

export async function listPillars({ supabase, workspace }: Studio): Promise<PillarRef[]> {
  const { data, error } = await supabase
    .from("content_pillars")
    .select("id, key, name, ratio_group")
    .eq("workspace_id", workspace.id)
    .order("sort_order");
  if (error) throw error;
  return data as PillarRef[];
}
