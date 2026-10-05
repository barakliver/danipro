"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStudio } from "@/lib/auth/studio";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: unknown): { ok: false; error: string } => ({
  ok: false,
  error: error instanceof z.ZodError ? (error.issues[0]?.message ?? "בדקי את הקלט") : error instanceof Error ? error.message : "משהו השתבש",
});

// only the knobs the renderer actually reads; anything else is dropped
const configSchema = z
  .object({
    align: z.enum(["start", "center"]).optional(),
    background: z.enum(["ink", "pen", "paper"]).optional(),
    paper: z.enum(["lined", "plain"]).optional(),
    leftLabel: z.string().trim().max(30).optional(),
    rightLabel: z.string().trim().max(30).optional(),
    textPosition: z.enum(["top", "bottom"]).optional(),
    scrim: z.enum(["none", "soft", "strong"]).optional(),
    numbering: z.boolean().optional(),
  })
  .strip();

const patchSchema = z.object({
  name: z.string().trim().min(1, "צריך שם").max(80).optional(),
  best_use: z.string().trim().max(500).nullable().optional(),
  formats: z.array(z.enum(["story", "carousel"])).min(1, "לפחות פורמט אחד").optional(),
  config: configSchema.optional(),
  is_favorite: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export async function updateTemplate(id: string, patch: z.input<typeof patchSchema>): Promise<Result> {
  try {
    z.uuid().parse(id);
    const { archived, ...rest } = patchSchema.parse(patch);
    const { supabase, workspace } = await getStudio();
    const update = { ...rest, ...(archived === undefined ? {} : { archived_at: archived ? new Date().toISOString() : null }) };
    const { error } = await supabase.from("templates").update(update).eq("workspace_id", workspace.id).eq("id", id);
    if (error) throw error;
    revalidatePath("/templates");
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function duplicateTemplate(id: string): Promise<Result<{ id: string }>> {
  try {
    z.uuid().parse(id);
    const { supabase, workspace } = await getStudio();
    const { data: source, error } = await supabase.from("templates").select("family, name, formats, best_use, config").eq("workspace_id", workspace.id).eq("id", id).single();
    if (error) throw error;
    const { data, error: insertError } = await supabase
      .from("templates")
      .insert({ workspace_id: workspace.id, family: source.family, name: `${source.name} (עותק)`, formats: source.formats, best_use: source.best_use, config: source.config })
      .select("id")
      .single();
    if (insertError) throw insertError;
    revalidatePath("/templates");
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return fail(error);
  }
}
