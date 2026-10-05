import type { Metadata } from "next";
import { getStudio } from "@/lib/auth/studio";
import { getRenderContext } from "@/lib/render/context";
import { CONTENT_FORMATS, type ContentFormat } from "@/lib/domain/constants";
import { scrubPII } from "@/lib/audience/privacy";
import { CreateView } from "./create-view";

export const metadata: Metadata = { title: "יצירה" };

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ idea?: string; prompt?: string; format?: string; audience?: string }> }) {
  const params = await searchParams;
  const studio = await getStudio();
  const ws = studio.workspace.id;
  let initialText = params.prompt?.slice(0, 2000) ?? "";
  let ideaId: string | null = null;
  let audienceEntryId: string | null = null;
  if (params.idea && /^[0-9a-f-]{36}$/.test(params.idea)) {
    const { data } = await studio.supabase.from("ideas").select("id, body").eq("workspace_id", ws).eq("id", params.idea).maybeSingle();
    if (data) {
      initialText = data.body;
      ideaId = data.id;
    }
  }
  if (params.audience && /^[0-9a-f-]{36}$/.test(params.audience)) {
    const { data } = await studio.supabase.from("audience_entries").select("id, original_text").eq("workspace_id", ws).eq("id", params.audience).maybeSingle();
    if (data) {
      initialText = scrubPII(data.original_text);
      audienceEntryId = data.id;
    }
  }
  const format = (CONTENT_FORMATS as readonly string[]).includes(params.format ?? "") ? (params.format as ContentFormat) : null;
  const render = await getRenderContext(studio);
  return (
    <CreateView
      initialText={initialText}
      initialFormat={format}
      ideaId={ideaId}
      audienceEntryId={audienceEntryId}
      providerAvailable={Boolean(process.env.ANTHROPIC_API_KEY?.trim())}
      render={render}
    />
  );
}
