import type { Metadata } from "next";
import { getStudio } from "@/lib/auth/studio";
import { listContent } from "@/lib/content/queries";
import { planToday } from "@/lib/content/today";
import { getRenderContext } from "@/lib/render/context";
import { assetIdsInBody, signAssetUrls } from "@/lib/gallery/urls";
import { todayISO, formatDayLong } from "@/lib/utils/dates";
import { loadMemory } from "@/lib/memory/load";
import { repetitionWarnings } from "@/lib/memory/repetition";
import { TodayView } from "./today-view";

export const metadata: Metadata = { title: "היום" };

export default async function TodayPage() {
  const studio = await getStudio();
  const today = todayISO();
  const [items, ideas, render, memory] = await Promise.all([
    listContent(studio),
    studio.supabase
      .from("ideas")
      .select("id, body")
      .eq("workspace_id", studio.workspace.id)
      .eq("status", "inbox")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .then((r) => r.data ?? []),
    getRenderContext(studio),
    loadMemory(studio),
  ]);

  const dayOfYear = Math.floor(Date.parse(today) / 86_400_000);
  const plan = planToday(items, today, ideas, dayOfYear);
  const featured = [("item" in plan.main ? plan.main.item : null), plan.quickStory].filter((x): x is NonNullable<typeof x> => Boolean(x));
  const assetUrls = await signAssetUrls(studio, featured.flatMap((c) => assetIdsInBody(c.body)));
  const upcoming = items
    .filter((c) => c.calendar && c.calendar.scheduled_on > today && c.calendar.slot === "main" && c.status !== "published")
    .sort((a, b) => a.calendar!.scheduled_on.localeCompare(b.calendar!.scheduled_on))
    .slice(0, 3);

  const mainItem = "item" in plan.main ? plan.main.item : null;
  const warnings = mainItem
    ? repetitionWarnings(
        { id: mainItem.id, hook: mainItem.hook, topic_tags: mainItem.topic_tags, template_id: mainItem.template_id, assetIds: assetIdsInBody(mainItem.body), day: today, published: false },
        memory,
        today,
      )
    : [];

  return <TodayView warnings={warnings.map((w) => w.message)} dateLabel={formatDayLong(today)} today={today} plan={plan} upcoming={upcoming} render={render} assetUrls={assetUrls} />;
}
