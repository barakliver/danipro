import "server-only";
import { GALLERY_TAG_SEEDS, PILLARS } from "@/lib/domain/constants";
import type { Studio } from "@/lib/auth/studio";
import { BRAND_BRAIN_SEED, HIGHLIGHT_SEED, TEMPLATE_SEED } from "./defaults";

/**
 * Idempotent: creates pillars, gallery tags, templates, Brand Brain defaults and
 * highlight collections only when they are missing. Safe to call on every first run.
 */
export async function ensureWorkspaceDefaults({ supabase, workspace, userId }: Studio) {
  const ws = workspace.id;

  const pillars = PILLARS.map((p, i) => ({ workspace_id: ws, ...p, sort_order: i }));
  const { error: pillarError } = await supabase
    .from("content_pillars")
    .upsert(pillars, { onConflict: "workspace_id,key", ignoreDuplicates: true });
  if (pillarError) throw pillarError;

  const tags = GALLERY_TAG_SEEDS.map((t) => ({ workspace_id: ws, name: t.name, kind: t.kind, is_suggested: true }));
  const { error: tagError } = await supabase.from("gallery_tags").upsert(tags, { onConflict: "workspace_id,name", ignoreDuplicates: true });
  if (tagError) throw tagError;

  const { count: templateCount } = await supabase
    .from("templates")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ws);
  if (!templateCount) {
    const { error } = await supabase.from("templates").insert(
      TEMPLATE_SEED.map((t) => ({
        workspace_id: ws,
        family: t.family,
        name: t.name,
        formats: t.formats,
        best_use: t.bestUse,
        config: t.config as never,
      })),
    );
    if (error) throw error;
  }

  const { count: brandCount } = await supabase
    .from("brand_brain_entries")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ws);
  if (!brandCount) {
    const { error } = await supabase.from("brand_brain_entries").insert(
      BRAND_BRAIN_SEED.map((b, i) => ({
        workspace_id: ws,
        section: b.section,
        title: b.title ?? null,
        body: b.body,
        pinned: b.pinned ?? false,
        meta: (b.meta ?? {}) as never,
        sort_order: i,
        created_by: userId,
      })),
    );
    if (error) throw error;
  }

  const { error: hlError } = await supabase.from("highlight_collections").upsert(
    HIGHLIGHT_SEED.map((h) => ({ workspace_id: ws, key: h.key, title: h.title, purpose: h.purpose, sort_order: h.sort })),
    { onConflict: "workspace_id,key", ignoreDuplicates: true },
  );
  if (hlError) throw hlError;
}
