import { describe, expect, it } from "vitest";
import { recommendAssets } from "@/lib/recommend/assets";
import type { GalleryAsset } from "@/lib/gallery/collections";

const asset = (id: string, partial: Partial<GalleryAsset>): GalleryAsset =>
  ({ id, media_type: "image", tags: [], people: [], suitable_formats: [], usageCount: 1, worked_well: false, location_category: null, ...partial }) as GalleryAsset;

describe("recommendAssets", () => {
  const assets = [
    asset("box", { tags: ["קופסה", "בית"], suitable_formats: ["story"] }),
    asset("street", { tags: ["רחוב"], suitable_formats: ["post"] }),
    asset("fresh", { tags: ["בית"], suitable_formats: ["story"], usageCount: 0 }),
    asset("used", { tags: ["בית"], suitable_formats: ["story"] }),
  ];

  it("ranks topic and format matches first, and prefers photos we have not used", () => {
    const ranked = recommendAssets(assets, { tags: ["בית"], format: "story", productPresence: "none" });
    expect(ranked[0].asset.id).toBe("fresh");
    expect(ranked.map((r) => r.asset.id)).not.toContain("street");
  });

  it("keeps the product out of pieces that are not about it", () => {
    const ranked = recommendAssets(assets, { tags: ["בית"], format: "story", productPresence: "none" });
    expect(ranked.findIndex((r) => r.asset.id === "box")).toBeGreaterThan(ranked.findIndex((r) => r.asset.id === "used"));
  });

  it("brings the game forward when the piece includes it, and avoids recent repeats", () => {
    const ranked = recommendAssets(assets, { tags: [], format: "story", productPresence: "natural", recentlyUsed: ["fresh"] });
    expect(ranked[0].asset.id).toBe("box");
  });
});
