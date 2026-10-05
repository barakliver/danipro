import type { Metadata } from "next";
import { getStudio } from "@/lib/auth/studio";
import { listGallery, listTags } from "@/lib/gallery/queries";
import { signAssetUrls } from "@/lib/gallery/urls";
import { GalleryView } from "./gallery-view";

export const metadata: Metadata = { title: "גלריה" };

export default async function GalleryPage() {
  const studio = await getStudio();
  const [assets, tags] = await Promise.all([listGallery(studio), listTags(studio)]);
  const urls = await signAssetUrls(studio, assets.map((a) => a.id));
  return <GalleryView assets={assets} urls={urls} tags={tags} workspaceId={studio.workspace.id} />;
}
