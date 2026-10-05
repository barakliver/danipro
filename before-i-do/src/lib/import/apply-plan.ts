import "server-only";
import type { Studio } from "@/lib/auth/studio";
import { addDays } from "@/lib/utils/dates";
import { snapshotOf } from "@/lib/content/snapshot";
import type { ImportedContent, ImportedPlan } from "./plan-parser";

export type ApplyResult = {
  created: number;
  skipped: number;
  highlightsAdded: number;
  brandAdded: number;
  startDate: string;
};

/**
 * Writes a parsed plan into the workspace. Idempotent by source_ref: running the
 * import twice never duplicates content, and pieces you already edited are left alone.
 * Day 1 lands on `startDate`.
 */
export async function applyPlan(studio: Studio, plan: ImportedPlan, startDate: string): Promise<ApplyResult> {
  const { supabase, workspace, userId } = studio;
  const ws = workspace.id;

  const { data: pillars, error: pillarError } = await supabase.from("content_pillars").select("id, key").eq("workspace_id", ws);
  if (pillarError) throw pillarError;
  const pillarId = new Map(pillars.map((p) => [p.key, p.id]));

  const { data: existing, error: existingError } = await supabase
    .from("content_items")
    .select("id, source_ref")
    .eq("workspace_id", ws)
    .like("source_ref", "plan60:%");
  if (existingError) throw existingError;
  const idByRef = new Map(existing.map((e) => [e.source_ref as string, e.id]));

  const toRow = (c: ImportedContent) => ({
    workspace_id: ws,
    format: c.format,
    pillar_id: c.pillarKey ? (pillarId.get(c.pillarKey) ?? null) : null,
    status: c.status,
    topic: c.topic,
    hook: c.hook,
    body: c.body as never,
    caption: c.caption,
    cta: c.cta,
    supporting_story: c.supportingStory,
    visual_notes: c.visualNotes,
    requires_filming: c.requiresFilming,
    requires_product: c.requiresProduct,
    requires_barak: c.requiresBarak,
    requires_couple: c.requiresCouple,
    product_presence: c.productPresence,
    prep_minutes: c.prepMinutes,
    location_category: c.locationCategory,
    topic_tags: c.topicTags,
    source: "import",
    source_ref: c.sourceRef,
    is_quick: c.slot === "story",
    created_by: userId,
  });

  let created = 0;
  // main pieces first so daily Stories can point at their parent
  for (const slot of ["main", "story"] as const) {
    const fresh = plan.content.filter((c) => c.slot === slot && !idByRef.has(c.sourceRef));
    if (fresh.length === 0) continue;
    const rows = fresh.map((c) => ({
      ...toRow(c),
      parent_id: c.parentRef ? (idByRef.get(c.parentRef) ?? null) : null,
    }));
    const { data: inserted, error } = await supabase.from("content_items").insert(rows).select("id, source_ref");
    if (error) throw error;
    for (const row of inserted) idByRef.set(row.source_ref as string, row.id);
    created += inserted.length;

    const byRef = new Map(fresh.map((c) => [c.sourceRef, c]));
    const calendar = inserted.map((row) => {
      const c = byRef.get(row.source_ref as string)!;
      return {
        workspace_id: ws,
        content_id: row.id,
        scheduled_on: addDays(startDate, c.planDay - 1),
        plan_day: c.planDay,
        slot: c.slot,
      };
    });
    const { error: calError } = await supabase.from("content_calendar").insert(calendar);
    if (calError) throw calError;

    const versions = inserted.map((row, i) => ({
      workspace_id: ws,
      content_id: row.id,
      snapshot: snapshotOf(rows[i]) as never,
      reason: "import",
      created_by: userId,
    }));
    const { error: versionError } = await supabase.from("content_versions").insert(versions);
    if (versionError) throw versionError;
  }

  // highlights: fill a collection only when it is still empty
  let highlightsAdded = 0;
  const { data: collections, error: colError } = await supabase.from("highlight_collections").select("id, key").eq("workspace_id", ws);
  if (colError) throw colError;
  const { data: existingItems } = await supabase.from("highlight_items").select("collection_id").eq("workspace_id", ws);
  const nonEmpty = new Set((existingItems ?? []).map((i) => i.collection_id));
  for (const hl of plan.highlights) {
    let collection = collections.find((c) => c.key === hl.key);
    if (!collection) {
      const { data, error } = await supabase
        .from("highlight_collections")
        .insert({ workspace_id: ws, key: hl.key, title: hl.title, purpose: hl.purpose, sort_order: collections.length + 1 })
        .select("id, key")
        .single();
      if (error) throw error;
      collection = data;
    }
    if (nonEmpty.has(collection.id)) continue;
    const { error } = await supabase.from("highlight_items").insert(
      hl.items.map((item) => ({
        workspace_id: ws,
        collection_id: collection.id,
        position: item.position,
        body: item.body,
        visual_notes: item.visualNotes,
        interaction: item.interaction,
      })),
    );
    if (error) throw error;
    highlightsAdded += hl.items.length;
  }

  // brand language: add lines that are not already in the Brand Brain
  const { data: brandRows } = await supabase.from("brand_brain_entries").select("body").eq("workspace_id", ws).is("deleted_at", null);
  const known = new Set((brandRows ?? []).map((b) => b.body.trim()));
  const newBrand = plan.brand.filter((b) => b.body && !known.has(b.body.trim()));
  if (newBrand.length) {
    const { error } = await supabase.from("brand_brain_entries").insert(
      newBrand.map((b, i) => ({
        workspace_id: ws,
        section: b.section,
        title: b.title,
        body: b.body,
        meta: { ...b.meta, source: "plan60" } as never,
        sort_order: 100 + i,
        created_by: userId,
      })),
    );
    if (error) throw error;
  }

  return {
    created,
    skipped: plan.content.length - created,
    highlightsAdded,
    brandAdded: newBrand.length,
    startDate,
  };
}
