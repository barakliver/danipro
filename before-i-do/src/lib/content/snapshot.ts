import type { ContentItemRow } from "@/lib/supabase/database.types";

/** Fields a person edits. Versions store exactly these, so a restore never touches ids or status history. */
export const EDITABLE_FIELDS = [
  "format",
  "pillar_id",
  "topic",
  "hook",
  "body",
  "caption",
  "cta",
  "supporting_story",
  "visual_notes",
  "notes",
  "requires_filming",
  "requires_product",
  "requires_barak",
  "requires_couple",
  "product_presence",
  "prep_minutes",
  "location_category",
  "template_id",
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];
export type ContentSnapshot = Pick<ContentItemRow, EditableField>;

export function snapshotOf(row: Partial<ContentItemRow>): Partial<ContentSnapshot> {
  const out: Partial<ContentSnapshot> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in row) (out as Record<string, unknown>)[field] = row[field];
  }
  return out;
}
