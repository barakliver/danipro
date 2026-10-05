import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStudio } from "@/lib/auth/studio";
import { getContent, listPillars } from "@/lib/content/queries";
import { getRenderContext } from "@/lib/render/context";
import { assetIdsInBody, signAssetUrls } from "@/lib/gallery/urls";
import { recommendTemplates } from "@/lib/render/recommend";
import { loadAvoidList } from "@/lib/voice/brand-words";
import { EditorProvider } from "./editor-context";
import { EditorShell } from "./editor-shell";
import { EDITOR_TABS, type EditorTab } from "./tabs";

export const metadata: Metadata = { title: "עריכה" };


export default async function ContentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const studio = await getStudio();
  const content = await getContent(studio, id);
  if (!content) notFound();

  const [pillars, render, assetUrls, templates, recent, avoidWords] = await Promise.all([
    listPillars(studio),
    getRenderContext(studio),
    signAssetUrls(studio, assetIdsInBody(content.body)),
    studio.supabase
      .from("templates")
      .select("id, family, name, formats, is_favorite, usage_count, last_used_at")
      .eq("workspace_id", studio.workspace.id)
      .is("archived_at", null)
      .then((r) => r.data ?? []),
    studio.supabase
      .from("content_items")
      .select("template_id")
      .eq("workspace_id", studio.workspace.id)
      .not("template_id", "is", null)
      .neq("id", id)
      .order("updated_at", { ascending: false })
      .limit(8)
      .then((r) => (r.data ?? []).map((x) => x.template_id as string)),
    loadAvoidList(studio),
  ]);

  const recommendations = recommendTemplates(templates, {
    format: content.format,
    body: content.body,
    productPresence: content.product_presence as "none" | "natural" | "direct",
    recentTemplateIds: recent,
  });

  const initialTab: EditorTab = EDITOR_TABS.includes(tab as EditorTab) ? (tab as EditorTab) : "copy";

  return (
    <EditorProvider content={content} render={render} assetUrls={assetUrls} pillars={pillars} recommendations={recommendations} avoidWords={avoidWords}>
      <EditorShell initialTab={initialTab} title={content.topic} />
    </EditorProvider>
  );
}
