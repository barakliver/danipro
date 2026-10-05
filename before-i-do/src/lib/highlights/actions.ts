"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStudio } from "@/lib/auth/studio";
import { newFrame } from "@/lib/domain/content-body";
import { detectTopics } from "@/lib/domain/topics";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: unknown): { ok: false; error: string } => ({
  ok: false,
  error: error instanceof z.ZodError ? (error.issues[0]?.message ?? "בדקי את הקלט") : error instanceof Error ? error.message : "משהו השתבש",
});

const text = z.string().trim().max(2000);

export async function addHighlightItem(collectionId: string, body: string): Promise<Result<{ id: string }>> {
  try {
    z.uuid().parse(collectionId);
    const clean = text.min(1, "כתבי מה יהיה בסטורי").parse(body);
    const { supabase, workspace } = await getStudio();
    const { data: last } = await supabase.from("highlight_items").select("position").eq("workspace_id", workspace.id).eq("collection_id", collectionId).order("position", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await supabase
      .from("highlight_items")
      .insert({ workspace_id: workspace.id, collection_id: collectionId, body: clean, position: (last?.position ?? -1) + 1 })
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/highlights");
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return fail(error);
  }
}

const patchSchema = z.object({ body: text.min(1).optional(), visual_notes: text.nullable().optional(), interaction: text.nullable().optional() });

export async function updateHighlightItem(id: string, patch: z.input<typeof patchSchema>): Promise<Result> {
  try {
    z.uuid().parse(id);
    const clean = patchSchema.parse(patch);
    const { supabase, workspace } = await getStudio();
    const { error } = await supabase.from("highlight_items").update(clean).eq("workspace_id", workspace.id).eq("id", id);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteHighlightItem(id: string): Promise<Result> {
  try {
    z.uuid().parse(id);
    const { supabase, workspace } = await getStudio();
    const { error } = await supabase.from("highlight_items").delete().eq("workspace_id", workspace.id).eq("id", id);
    if (error) throw error;
    revalidatePath("/highlights");
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

/** Saves the full order of one collection (the client sends ids in the new order). */
export async function reorderHighlightItems(collectionId: string, ids: string[]): Promise<Result> {
  try {
    z.uuid().parse(collectionId);
    z.array(z.uuid()).max(200).parse(ids);
    const { supabase, workspace } = await getStudio();
    await Promise.all(
      ids.map((id, position) => supabase.from("highlight_items").update({ position }).eq("workspace_id", workspace.id).eq("collection_id", collectionId).eq("id", id)),
    );
    revalidatePath("/highlights");
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

/** Turns a highlight line into a real Story in the editor, linked back to the highlight. */
export async function highlightToStory(id: string): Promise<Result<{ contentId: string }>> {
  try {
    z.uuid().parse(id);
    const { supabase, workspace, userId } = await getStudio();
    const { data: item, error } = await supabase
      .from("highlight_items")
      .select("id, body, visual_notes, interaction, content_id, collection:highlight_collections(key, title)")
      .eq("workspace_id", workspace.id)
      .eq("id", id)
      .single();
    if (error) throw error;
    if (item.content_id) return { ok: true, data: { contentId: item.content_id } };

    const collection = (Array.isArray(item.collection) ? item.collection[0] : item.collection) as { key: string; title: string } | null;
    const frames = [newFrame({ text: item.body })];
    if (item.interaction?.trim()) frames.push(newFrame({ kind: "question", text: item.interaction.trim() }));
    const { data: pillar } = collection?.key === "the_game"
      ? await supabase.from("content_pillars").select("id").eq("workspace_id", workspace.id).eq("key", "the_game").maybeSingle()
      : { data: null };

    const { data, error: insertError } = await supabase
      .from("content_items")
      .insert({
        workspace_id: workspace.id,
        format: "story",
        status: "writing",
        topic: collection ? `היילייט: ${collection.title}` : "היילייט",
        hook: item.body,
        body: { frames } as never,
        visual_notes: item.visual_notes,
        pillar_id: pillar?.id ?? null,
        product_presence: collection?.key === "the_game" ? "direct" : "none",
        requires_product: collection?.key === "the_game",
        topic_tags: detectTopics(item.body),
        source: "manual",
        created_by: userId,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    await supabase.from("highlight_items").update({ content_id: data.id }).eq("workspace_id", workspace.id).eq("id", id);
    revalidatePath("/", "layout");
    return { ok: true, data: { contentId: data.id } };
  } catch (error) {
    return fail(error);
  }
}
