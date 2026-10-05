"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStudio } from "@/lib/auth/studio";
import { BRAND_SECTIONS } from "./sections";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: e instanceof Error ? e.message : "משהו השתבש" });
const sectionKeys = BRAND_SECTIONS.map((s) => s.key) as [string, ...string[]];

export async function addBrandEntry(input: { section: string; body: string; title?: string }): Promise<Result<{ id: string }>> {
  try {
    const clean = z.object({ section: z.enum(sectionKeys), body: z.string().trim().min(1).max(6000), title: z.string().max(200).optional() }).parse(input);
    const { supabase, workspace, userId } = await getStudio();
    const { data, error } = await supabase
      .from("brand_brain_entries")
      .insert({ workspace_id: workspace.id, section: clean.section, body: clean.body, title: clean.title || null, created_by: userId, sort_order: Date.now() % 1_000_000 })
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/brand");
    return { ok: true, data };
  } catch (error) {
    return fail(error);
  }
}

export async function updateBrandEntry(id: string, input: { body?: string; title?: string | null; pinned?: boolean }): Promise<Result> {
  try {
    z.uuid().parse(id);
    const clean = z.object({ body: z.string().trim().min(1).max(6000).optional(), title: z.string().max(200).nullable().optional(), pinned: z.boolean().optional() }).parse(input);
    const { supabase, workspace } = await getStudio();
    const { error } = await supabase.from("brand_brain_entries").update(clean).eq("workspace_id", workspace.id).eq("id", id);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteBrandEntry(id: string): Promise<Result> {
  try {
    z.uuid().parse(id);
    const { supabase, workspace } = await getStudio();
    const { error } = await supabase.from("brand_brain_entries").update({ deleted_at: new Date().toISOString() }).eq("workspace_id", workspace.id).eq("id", id);
    if (error) throw error;
    revalidatePath("/brand");
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}
