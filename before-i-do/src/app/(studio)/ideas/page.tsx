import type { Metadata } from "next";
import { getStudio } from "@/lib/auth/studio";
import { signAssetUrls } from "@/lib/gallery/urls";
import { IdeasView } from "./ideas-view";

export const metadata: Metadata = { title: "רעיונות" };

export default async function IdeasPage() {
  const studio = await getStudio();
  const { data, error } = await studio.supabase
    .from("ideas")
    .select("id, body, kind, asset_id, tags, status, created_at")
    .eq("workspace_id", studio.workspace.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  const urls = await signAssetUrls(studio, data.map((i) => i.asset_id).filter((x): x is string => Boolean(x)));
  return <IdeasView ideas={data} urls={urls} workspaceId={studio.workspace.id} />;
}
