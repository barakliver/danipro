import type { ContentFormat, ContentStatus, RatioGroup } from "@/lib/domain/constants";
import type { ContentBody } from "@/lib/domain/content-body";
import type { ContentItemRow } from "@/lib/supabase/database.types";

export type PillarRef = { id: string; key: string; name: string; ratio_group: RatioGroup };
export type CalendarRef = { scheduled_on: string; scheduled_time: string | null; plan_day: number | null; slot: "main" | "story" | "extra" };

/** A content item as screens use it: typed enums, parsed body, pillar and schedule joined. */
export type Content = Omit<ContentItemRow, "format" | "status" | "body"> & {
  format: ContentFormat;
  status: ContentStatus;
  body: ContentBody;
  pillar: PillarRef | null;
  calendar: CalendarRef | null;
};
