import "server-only";
import type { Studio } from "@/lib/auth/studio";

/** Phrases the Brand Brain says to avoid: "words we avoid" entries + bad examples. */
export async function loadAvoidList({ supabase, workspace }: Studio): Promise<string[]> {
  const { data } = await supabase
    .from("brand_brain_entries")
    .select("section, body")
    .eq("workspace_id", workspace.id)
    .in("section", ["words_we_avoid", "bad_examples"])
    .is("deleted_at", null);
  const out = new Set<string>();
  for (const row of data ?? []) {
    const pieces = row.section === "words_we_avoid" ? row.body.split(/[·,\n]/) : [row.body];
    for (const p of pieces) {
      const word = p.trim().replace(/[.!?]+$/, "");
      if (word.length >= 3) out.add(word);
    }
  }
  return Array.from(out);
}
