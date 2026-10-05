import type { Metadata } from "next";
import { getStudio } from "@/lib/auth/studio";
import { AudienceView } from "./audience-view";

export const metadata: Metadata = { title: "הקהל" };

export default async function AudiencePage() {
  const studio = await getStudio();
  const ws = studio.workspace.id;
  const [entries, used] = await Promise.all([
    studio.supabase.from("audience_entries").select("id, original_text, source_type, topic, received_on, permission_status, notes, created_at").eq("workspace_id", ws).is("deleted_at", null).order("created_at", { ascending: false }),
    studio.supabase.from("content_items").select("audience_entry_id").eq("workspace_id", ws).not("audience_entry_id", "is", null).is("deleted_at", null),
  ]);
  if (entries.error) throw entries.error;
  const usage: Record<string, number> = {};
  for (const r of used.data ?? []) if (r.audience_entry_id) usage[r.audience_entry_id] = (usage[r.audience_entry_id] ?? 0) + 1;
  return <AudienceView entries={entries.data} usage={usage} providerAvailable={Boolean(process.env.ANTHROPIC_API_KEY?.trim())} />;
}
