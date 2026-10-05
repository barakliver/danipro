"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStudio } from "@/lib/auth/studio";
import { AUDIENCE_SOURCE_TYPES } from "@/lib/domain/constants";
import { getTextProvider } from "@/lib/ai/provider";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts/system";
import { buildBrandContext } from "@/lib/ai/prompts/context";
import { audienceTask } from "@/lib/ai/prompts/tasks";
import { audienceHooksSchema } from "@/lib/ai/schemas";
import { scrubPII } from "./privacy";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; needsProvider?: boolean };
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : "משהו השתבש" });

const entrySchema = z.object({
  original_text: z.string().trim().min(2).max(4000),
  source_type: z.enum(AUDIENCE_SOURCE_TYPES),
  topic: z.string().max(120).nullable().optional(),
  received_on: z.iso.date().nullable().optional(),
  permission_status: z.enum(["not_needed", "pending", "granted", "denied"]).default("not_needed"),
  notes: z.string().max(2000).nullable().optional(),
});

export async function addAudienceEntry(input: z.input<typeof entrySchema>): Promise<Result<{ id: string }>> {
  try {
    const clean = entrySchema.parse(input);
    const { supabase, workspace, userId } = await getStudio();
    const { data, error } = await supabase.from("audience_entries").insert({ ...clean, workspace_id: workspace.id, created_by: userId }).select("id").single();
    if (error) throw error;
    revalidatePath("/audience");
    return { ok: true, data };
  } catch (error) {
    return fail(error);
  }
}

export async function updateAudienceEntry(id: string, input: Partial<z.input<typeof entrySchema>>): Promise<Result> {
  try {
    z.uuid().parse(id);
    const clean = entrySchema.partial().parse(input);
    const { supabase, workspace } = await getStudio();
    const { error } = await supabase.from("audience_entries").update(clean).eq("workspace_id", workspace.id).eq("id", id);
    if (error) throw error;
    revalidatePath("/audience");
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteAudienceEntry(id: string): Promise<Result> {
  try {
    z.uuid().parse(id);
    const { supabase, workspace } = await getStudio();
    const { error } = await supabase.from("audience_entries").update({ deleted_at: new Date().toISOString() }).eq("workspace_id", workspace.id).eq("id", id);
    if (error) throw error;
    revalidatePath("/audience");
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

/** "הפוך לרעיון תוכן": the line (scrubbed) goes into the Ideas inbox. */
export async function audienceToIdea(id: string): Promise<Result<{ ideaId: string }>> {
  try {
    z.uuid().parse(id);
    const { supabase, workspace, userId } = await getStudio();
    const { data: entry, error } = await supabase.from("audience_entries").select("original_text").eq("workspace_id", workspace.id).eq("id", id).single();
    if (error) throw error;
    const { data, error: insertError } = await supabase
      .from("ideas")
      .insert({ workspace_id: workspace.id, body: scrubPII(entry.original_text), tags: ["הודעה מלקוח"], created_by: userId })
      .select("id")
      .single();
    if (insertError) throw insertError;
    revalidatePath("/ideas");
    return { ok: true, data: { ideaId: data.id } };
  } catch (error) {
    return fail(error);
  }
}

/** Hooks in the audience's own words. Needs a writing engine. */
export async function audienceHooks(id: string): Promise<Result<Array<{ hook: string; format: string; why: string }>>> {
  try {
    z.uuid().parse(id);
    const provider = getTextProvider();
    if (!provider) return { ok: false, error: "עוד לא חובר מנוע כתיבה. אפשר לפתוח את המשפט במסך היצירה ולכתוב משם.", needsProvider: true };
    const studio = await getStudio();
    const { data: entry, error } = await studio.supabase.from("audience_entries").select("original_text").eq("workspace_id", studio.workspace.id).eq("id", id).single();
    if (error) throw error;
    const text = scrubPII(entry.original_text);
    const context = await buildBrandContext(studio, text);
    const result = await provider.generate({ system: SYSTEM_PROMPT, context: context.text, task: audienceTask(text), schema: audienceHooksSchema, effort: "low" });
    await studio.supabase.from("generation_history").insert({
      workspace_id: studio.workspace.id,
      task: "audience_transform",
      provider: provider.id,
      model: result.model,
      input: { audienceEntryId: id } as never,
      context_summary: context.summary as never,
      output: result.output as never,
      status: "ok",
      latency_ms: result.latencyMs,
      created_by: studio.userId,
    });
    return { ok: true, data: result.output.hooks };
  } catch (error) {
    return fail(error);
  }
}
