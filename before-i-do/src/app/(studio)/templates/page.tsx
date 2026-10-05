import type { Metadata } from "next";
import { getStudio } from "@/lib/auth/studio";
import { signAssetUrls } from "@/lib/gallery/urls";
import { parseDesignSettings } from "@/lib/render/design-settings";
import { TemplatesView } from "./templates-view";

export const metadata: Metadata = { title: "תבניות" };

export default async function TemplatesPage() {
  const studio = await getStudio();
  const { supabase, workspace } = studio;
  const [{ data: templates, error }, { data: photo }] = await Promise.all([
    supabase
      .from("templates")
      .select("id, family, name, formats, best_use, config, is_favorite, usage_count, last_used_at, archived_at, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at"),
    // a real photo from the Gallery makes the photo families' previews honest
    supabase.from("gallery_assets").select("id").eq("workspace_id", workspace.id).is("deleted_at", null).eq("media_type", "image").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (error) throw error;
  const urls = photo ? await signAssetUrls(studio, [photo.id]) : {};
  return <TemplatesView templates={templates} settings={parseDesignSettings(workspace.design_settings)} photoUrl={photo ? (urls[photo.id]?.preview ?? null) : null} />;
}
