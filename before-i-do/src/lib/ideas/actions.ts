"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStudio } from "@/lib/auth/studio";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : "משהו השתבש" });

const ideaSchema = z.object({
  body: z.string().max(4000).default(""),
  kind: z.enum(["text", "photo", "screenshot", "voice"]).default("text"),
  assetId: z.uuid().optional(),
  tags: z.array(z.string().max(40)).max(14).default([]),
});

export async function createIdea(input: z.input<typeof ideaSchema>): Promise<Result<{ id: string; created_at: string }>> {
  try {
    const clean = ideaSchema.parse(input);
    if (!clean.body.trim() && !clean.assetId) throw new Error("רעיון ריק. כתבי משפט או צרפי תמונה.");
    const { supabase, workspace, userId } = await getStudio();
    const { data, error } = await supabase
      .from("ideas")
      .insert({ workspace_id: workspace.id, body: clean.body.trim(), kind: clean.kind, asset_id: clean.assetId ?? null, tags: clean.tags, created_by: userId })
      .select("id, created_at")
      .single();
    if (error) throw error;
    revalidatePath("/ideas");
    return { ok: true, data };
  } catch (error) {
    return fail(error);
  }
}

export async function updateIdea(id: string, input: { body?: string; tags?: string[]; status?: "inbox" | "developed" | "archived" }): Promise<Result> {
  try {
    z.uuid().parse(id);
    const clean = z
      .object({ body: z.string().max(4000).optional(), tags: z.array(z.string().max(40)).max(14).optional(), status: z.enum(["inbox", "developed", "archived"]).optional() })
      .parse(input);
    const { supabase, workspace } = await getStudio();
    const { error } = await supabase.from("ideas").update(clean).eq("workspace_id", workspace.id).eq("id", id);
    if (error) throw error;
    revalidatePath("/ideas");
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteIdea(id: string): Promise<Result> {
  try {
    z.uuid().parse(id);
    const { supabase, workspace } = await getStudio();
    const { error } = await supabase.from("ideas").update({ deleted_at: new Date().toISOString() }).eq("workspace_id", workspace.id).eq("id", id);
    if (error) throw error;
    revalidatePath("/ideas");
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}
