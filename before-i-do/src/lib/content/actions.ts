"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStudio } from "@/lib/auth/studio";
import { CONTENT_FORMATS, CONTENT_STATUSES } from "@/lib/domain/constants";
import { collectCopy, contentBodySchema } from "@/lib/domain/content-body";
import { statusChangePatch } from "@/lib/domain/status";
import { detectTopics } from "@/lib/domain/topics";
import { snapshotOf } from "./snapshot";
import { scoreVoice } from "@/lib/voice/score";
import { loadAvoidList } from "@/lib/voice/brand-words";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const uuid = z.uuid();
const nullableText = z.string().max(5000).nullable();

const patchSchema = z
  .object({
    format: z.enum(CONTENT_FORMATS),
    pillar_id: uuid.nullable(),
    topic: z.string().max(300).nullable(),
    hook: nullableText,
    body: contentBodySchema,
    caption: nullableText,
    cta: z.string().max(500).nullable(),
    supporting_story: nullableText,
    visual_notes: nullableText,
    notes: nullableText,
    requires_filming: z.boolean(),
    requires_product: z.boolean(),
    requires_barak: z.boolean(),
    requires_couple: z.boolean(),
    product_presence: z.enum(["none", "natural", "direct"]),
    prep_minutes: z.number().int().min(0).max(600).nullable(),
    location_category: z.string().max(80).nullable(),
    template_id: uuid.nullable(),
  })
  .partial();
export type ContentPatch = z.infer<typeof patchSchema>;

/** A new version at most every 3 minutes of continuous editing. */
const VERSION_INTERVAL_MS = 3 * 60 * 1000;

/** content_assets mirrors which Gallery photos a piece uses (usage history, "not used yet"). */
async function syncContentAssets(
  supabase: Awaited<ReturnType<typeof getStudio>>["supabase"],
  workspaceId: string,
  contentId: string,
  body: z.infer<typeof contentBodySchema>,
) {
  const wanted = [...(body.frames ?? []), ...(body.slides ?? [])]
    .map((f, position) => ({ asset_id: f.assetId, role: f.id, position }))
    .filter((r): r is { asset_id: string; role: string; position: number } => Boolean(r.asset_id));
  const { data: existing } = await supabase.from("content_assets").select("id, asset_id, role").eq("content_id", contentId);
  const key = (r: { asset_id: string; role: string }) => `${r.asset_id}:${r.role}`;
  const wantedKeys = new Set(wanted.map(key));
  const stale = (existing ?? []).filter((r) => !wantedKeys.has(key(r))).map((r) => r.id);
  if (stale.length) await supabase.from("content_assets").delete().in("id", stale);
  const have = new Set((existing ?? []).map(key));
  const fresh = wanted.filter((r) => !have.has(key(r)));
  if (fresh.length) {
    await supabase.from("content_assets").insert(fresh.map((r) => ({ ...r, workspace_id: workspaceId, content_id: contentId })));
  }
}

function fail(error: unknown): { ok: false; error: string } {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "משהו השתבש";
  return { ok: false, error: message };
}

export async function saveContent(id: string, patch: ContentPatch, reason: "autosave" | "manual" = "autosave"): Promise<ActionResult<{ savedAt: string }>> {
  try {
    uuid.parse(id);
    const clean = patchSchema.parse(patch);
    const studio = await getStudio();
    const { supabase, workspace, userId } = studio;

    const { data: current, error: readError } = await supabase
      .from("content_items")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("id", id)
      .single();
    if (readError) throw readError;

    const merged = { ...current, ...clean };
    const update: Record<string, unknown> = { ...clean };
    // keep topic memory in sync with the copy
    if ("hook" in clean || "body" in clean || "topic" in clean || "caption" in clean) {
      const body = contentBodySchema.safeParse(merged.body);
      const copy = collectCopy({ hook: merged.hook, caption: merged.caption, cta: merged.cta, body: body.success ? body.data : {} });
      update.topic_tags = detectTopics(merged.topic, ...copy);
      const voice = scoreVoice(copy, { avoid: await loadAvoidList(studio), productIntent: merged.product_presence as "none" | "natural" | "direct" });
      update.sounds_like_us = voice.score;
      update.score_breakdown = { source: voice.source, dimensions: voice.dimensions, flags: voice.flags.map((f) => f.code) };
    }

    const { data: saved, error } = await supabase
      .from("content_items")
      .update(update as never)
      .eq("workspace_id", workspace.id)
      .eq("id", id)
      .select("updated_at")
      .single();
    if (error) throw error;

    if ("body" in clean && clean.body) await syncContentAssets(supabase, workspace.id, id, clean.body);

    const { data: lastVersion } = await supabase
      .from("content_versions")
      .select("created_at")
      .eq("content_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const stale = !lastVersion || Date.now() - new Date(lastVersion.created_at).getTime() > VERSION_INTERVAL_MS;
    if (reason === "manual" || stale) {
      await supabase.from("content_versions").insert({
        workspace_id: workspace.id,
        content_id: id,
        snapshot: snapshotOf(merged) as never,
        reason,
        created_by: userId,
      });
    }
    return { ok: true, data: { savedAt: saved.updated_at } };
  } catch (error) {
    return fail(error);
  }
}

export async function setContentStatus(id: string, status: (typeof CONTENT_STATUSES)[number]): Promise<ActionResult<{ status: string; published_at: string | null }>> {
  try {
    uuid.parse(id);
    z.enum(CONTENT_STATUSES).parse(status);
    const { supabase, workspace } = await getStudio();
    const { data: current, error: readError } = await supabase
      .from("content_items")
      .select("status, published_at")
      .eq("workspace_id", workspace.id)
      .eq("id", id)
      .single();
    if (readError) throw readError;
    const patch = statusChangePatch(current as { status: never; published_at: string | null }, status);
    const { error } = await supabase.from("content_items").update(patch).eq("workspace_id", workspace.id).eq("id", id);
    if (error) throw error;

    // the template that shipped gets credit when a piece is published
    if (status === "published" && current.status !== "published") {
      const { data: item } = await supabase.from("content_items").select("template_id").eq("id", id).single();
      if (item?.template_id) {
        const { data: tpl } = await supabase.from("templates").select("usage_count").eq("id", item.template_id).single();
        await supabase
          .from("templates")
          .update({ usage_count: (tpl?.usage_count ?? 0) + 1, last_used_at: new Date().toISOString() })
          .eq("id", item.template_id);
      }
    }
    revalidatePath("/", "layout");
    return { ok: true, data: { status: patch.status, published_at: patch.published_at ?? current.published_at } };
  } catch (error) {
    return fail(error);
  }
}

export async function scheduleContent(id: string, date: string | null, time: string | null = null): Promise<ActionResult> {
  try {
    uuid.parse(id);
    const { supabase, workspace } = await getStudio();
    if (date === null) {
      const { error } = await supabase.from("content_calendar").delete().eq("workspace_id", workspace.id).eq("content_id", id);
      if (error) throw error;
    } else {
      z.iso.date().parse(date);
      if (time) z.string().regex(/^\d{2}:\d{2}$/).parse(time);
      const { data: existing } = await supabase.from("content_calendar").select("id, slot").eq("content_id", id).maybeSingle();
      const row = { workspace_id: workspace.id, content_id: id, scheduled_on: date, scheduled_time: time, slot: existing?.slot ?? "main" };
      const { error } = existing
        ? await supabase.from("content_calendar").update({ scheduled_on: date, scheduled_time: time }).eq("id", existing.id)
        : await supabase.from("content_calendar").insert(row);
      if (error) throw error;
    }
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

/** Moves a piece to another day from the calendar (drag and drop). Keeps its time. */
export async function moveContent(id: string, date: string): Promise<ActionResult> {
  try {
    uuid.parse(id);
    z.iso.date().parse(date);
    const { supabase, workspace } = await getStudio();
    const { data: existing } = await supabase.from("content_calendar").select("id").eq("content_id", id).maybeSingle();
    const { error } = existing
      ? await supabase.from("content_calendar").update({ scheduled_on: date }).eq("id", existing.id)
      : await supabase.from("content_calendar").insert({ workspace_id: workspace.id, content_id: id, scheduled_on: date });
    if (error) throw error;
    revalidatePath("/calendar");
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function duplicateContent(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    uuid.parse(id);
    const { supabase, workspace, userId } = await getStudio();
    const { data: source, error: readError } = await supabase.from("content_items").select("*").eq("workspace_id", workspace.id).eq("id", id).single();
    if (readError) throw readError;
    const copy = {
      ...snapshotOf(source),
      workspace_id: workspace.id,
      status: source.status === "published" || source.status === "scheduled" ? "ready" : source.status,
      topic: source.topic ? `${source.topic} (עותק)` : "עותק",
      topic_tags: source.topic_tags,
      source: "manual",
      parent_id: source.parent_id,
      is_quick: source.is_quick,
      created_by: userId,
    };
    const { data, error } = await supabase.from("content_items").insert(copy as never).select("id").single();
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteContent(id: string): Promise<ActionResult> {
  try {
    uuid.parse(id);
    const { supabase, workspace } = await getStudio();
    const { error } = await supabase
      .from("content_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("workspace_id", workspace.id)
      .eq("id", id);
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function restoreVersion(contentId: string, versionId: string): Promise<ActionResult> {
  try {
    uuid.parse(contentId);
    uuid.parse(versionId);
    const { supabase, workspace, userId } = await getStudio();
    const { data: version, error: vError } = await supabase
      .from("content_versions")
      .select("snapshot")
      .eq("workspace_id", workspace.id)
      .eq("content_id", contentId)
      .eq("id", versionId)
      .single();
    if (vError) throw vError;
    const { data: current } = await supabase.from("content_items").select("*").eq("id", contentId).single();
    // keep what we are about to overwrite, so a restore can itself be undone
    if (current) {
      await supabase.from("content_versions").insert({
        workspace_id: workspace.id,
        content_id: contentId,
        snapshot: snapshotOf(current) as never,
        reason: "manual",
        created_by: userId,
      });
    }
    const snapshot = patchSchema.parse(version.snapshot);
    const { error } = await supabase.from("content_items").update(snapshot as never).eq("workspace_id", workspace.id).eq("id", contentId);
    if (error) throw error;
    await supabase.from("content_versions").insert({
      workspace_id: workspace.id,
      content_id: contentId,
      snapshot: version.snapshot,
      reason: "restore",
      created_by: userId,
    });
    revalidatePath(`/content/${contentId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function listVersions(contentId: string): Promise<ActionResult<Array<{ id: string; reason: string; created_at: string; hook: string | null }>>> {
  try {
    uuid.parse(contentId);
    const { supabase, workspace } = await getStudio();
    const { data, error } = await supabase
      .from("content_versions")
      .select("id, reason, created_at, snapshot")
      .eq("workspace_id", workspace.id)
      .eq("content_id", contentId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw error;
    return {
      ok: true,
      data: data.map((v) => ({
        id: v.id,
        reason: v.reason,
        created_at: v.created_at,
        hook: ((v.snapshot as Record<string, unknown> | null)?.hook as string | null) ?? null,
      })),
    };
  } catch (error) {
    return fail(error);
  }
}

const createSchema = z.object({
  format: z.enum(CONTENT_FORMATS),
  topic: z.string().max(300).optional(),
  hook: z.string().max(5000).optional(),
  pillar_id: uuid.optional(),
  body: contentBodySchema.optional(),
  caption: z.string().max(5000).optional(),
  cta: z.string().max(500).optional(),
  idea_id: uuid.optional(),
  audience_entry_id: uuid.optional(),
  source: z.enum(["manual", "generated", "idea", "audience"]).default("manual"),
  scheduled_on: z.iso.date().optional(),
});

export async function createContent(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const clean = createSchema.parse(input);
    const { supabase, workspace, userId } = await getStudio();
    const body = clean.body ?? {};
    const copy = collectCopy({ hook: clean.hook, caption: clean.caption, cta: clean.cta, body });
    const { data, error } = await supabase
      .from("content_items")
      .insert({
        workspace_id: workspace.id,
        format: clean.format,
        topic: clean.topic ?? null,
        hook: clean.hook ?? null,
        pillar_id: clean.pillar_id ?? null,
        body: body as never,
        caption: clean.caption ?? null,
        cta: clean.cta ?? null,
        idea_id: clean.idea_id ?? null,
        audience_entry_id: clean.audience_entry_id ?? null,
        source: clean.source,
        status: "writing",
        requires_filming: ["pov_reel", "talking_reel", "reel"].includes(clean.format),
        topic_tags: detectTopics(clean.topic, ...copy),
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    if (clean.scheduled_on) {
      await supabase.from("content_calendar").insert({ workspace_id: workspace.id, content_id: data.id, scheduled_on: clean.scheduled_on });
    }
    if (clean.idea_id) {
      await supabase.from("ideas").update({ status: "developed" }).eq("workspace_id", workspace.id).eq("id", clean.idea_id);
    }
    revalidatePath("/", "layout");
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return fail(error);
  }
}
