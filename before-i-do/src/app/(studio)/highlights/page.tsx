import type { Metadata } from "next";
import { getStudio } from "@/lib/auth/studio";
import { HighlightsView, type Collection } from "./highlights-view";

export const metadata: Metadata = { title: "היילייטס" };

export default async function HighlightsPage() {
  const { supabase, workspace } = await getStudio();
  const { data, error } = await supabase
    .from("highlight_collections")
    .select("id, key, title, purpose, sort_order, items:highlight_items(id, position, body, visual_notes, interaction, content_id)")
    .eq("workspace_id", workspace.id)
    .order("sort_order");
  if (error) throw error;
  const collections: Collection[] = data.map((c) => ({ ...c, items: [...c.items].sort((a, b) => a.position - b.position) }));
  return <HighlightsView collections={collections} />;
}
