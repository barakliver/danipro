import type { Metadata } from "next";
import { getStudio } from "@/lib/auth/studio";
import { BrandView } from "./brand-view";

export const metadata: Metadata = { title: "Brand Brain" };

export default async function BrandPage() {
  const studio = await getStudio();
  const ws = studio.workspace.id;
  const [entries, audience, successes] = await Promise.all([
    studio.supabase.from("brand_brain_entries").select("id, section, title, body, meta, pinned, sort_order").eq("workspace_id", ws).is("deleted_at", null).order("sort_order"),
    studio.supabase.from("audience_entries").select("id, original_text, source_type").eq("workspace_id", ws).is("deleted_at", null).order("created_at", { ascending: false }).limit(8),
    studio.supabase
      .from("content_feedback")
      .select("content:content_items(id, hook, topic, format, deleted_at)")
      .eq("workspace_id", ws)
      .eq("kind", "this_is_us")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (entries.error) throw entries.error;
  const liked = new Map<string, { id: string; title: string }>();
  for (const row of (successes.data ?? []) as unknown as Array<{ content: { id: string; hook: string | null; topic: string | null; deleted_at: string | null } | null }>) {
    if (row.content && !row.content.deleted_at && !liked.has(row.content.id)) liked.set(row.content.id, { id: row.content.id, title: row.content.hook || row.content.topic || "בלי כותרת" });
  }
  return <BrandView entries={entries.data} audience={audience.data ?? []} liked={Array.from(liked.values()).slice(0, 8)} />;
}
