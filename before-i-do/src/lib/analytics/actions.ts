"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStudio } from "@/lib/auth/studio";
import { METRICS } from "./patterns";

const count = z.number().int().min(0).max(100_000_000).nullable();
const schema = z.object({
  contentId: z.uuid(),
  recordedOn: z.iso.date(),
  metrics: z.object(Object.fromEntries(METRICS.map((m) => [m.key, count.optional()])) as Record<(typeof METRICS)[number]["key"], z.ZodOptional<typeof count>>),
  notes: z.string().trim().max(2000).nullable().optional(),
});

/** Manual numbers for one published piece on one day (re-entering the same day updates it). */
export async function saveAnalytics(input: z.input<typeof schema>): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const clean = schema.parse(input);
    const { supabase, workspace } = await getStudio();
    const { error } = await supabase.from("analytics_entries").upsert(
      { workspace_id: workspace.id, content_id: clean.contentId, recorded_on: clean.recordedOn, ...clean.metrics, notes: clean.notes || null },
      { onConflict: "content_id,recorded_on" },
    );
    if (error) throw error;
    revalidatePath("/analytics");
    return { ok: true };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: "בדקי שהמספרים תקינים" };
    return { ok: false, error: error instanceof Error ? error.message : "השמירה נכשלה" };
  }
}
