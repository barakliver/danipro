import "server-only";
import type { Studio } from "@/lib/auth/studio";
import { parseDesignSettings, type DesignSettings } from "./design-settings";
import type { TemplateLite } from "./plan";

export type RenderContext = { templates: TemplateLite[]; settings: DesignSettings };

export async function getRenderContext(studio: Studio): Promise<RenderContext> {
  const { data, error } = await studio.supabase
    .from("templates")
    .select("id, family, name, config")
    .eq("workspace_id", studio.workspace.id)
    .is("archived_at", null)
    .order("created_at");
  if (error) throw error;
  return { templates: data, settings: parseDesignSettings(studio.workspace.design_settings) };
}
