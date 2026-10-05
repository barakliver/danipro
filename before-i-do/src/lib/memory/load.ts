import "server-only";
import type { Studio } from "@/lib/auth/studio";
import { addDays, todayISO } from "@/lib/utils/dates";
import type { MemoryItem } from "./repetition";

/** Published pieces from the last month, shaped for repetition checks. */
export async function loadMemory({ supabase, workspace }: Studio): Promise<MemoryItem[]> {
  const since = addDays(todayISO(), -30);
  const { data } = await supabase
    .from("content_items")
    .select("id, hook, topic_tags, template_id, published_at, assets:content_assets(asset_id)")
    .eq("workspace_id", workspace.id)
    .is("deleted_at", null)
    .not("published_at", "is", null)
    .gte("published_at", since);
  return ((data ?? []) as unknown as Array<{ id: string; hook: string | null; topic_tags: string[]; template_id: string | null; published_at: string; assets: Array<{ asset_id: string }> }>).map((r) => ({
    id: r.id,
    hook: r.hook,
    topic_tags: r.topic_tags,
    template_id: r.template_id,
    assetIds: r.assets.map((a) => a.asset_id),
    day: r.published_at.slice(0, 10),
    published: true,
  }));
}
