import { describe, expect, it } from "vitest";
import { recommendTemplates, type TemplateCandidate } from "@/lib/render/recommend";

const t = (id: string, family: string, formats = ["story", "carousel"]): TemplateCandidate => ({
  id, family, name: id, formats, is_favorite: false, usage_count: 0, last_used_at: null,
});
const all = [
  t("text", "text_message"), t("photo", "real_photo"), t("notes", "notes"), t("conv", "conversation"),
  t("q", "question", ["story"]), t("life", "product_in_life"), t("edit", "carousel_editorial", ["carousel"]),
];

describe("recommendTemplates", () => {
  it("suggests the question template first for a poll Story", () => {
    const recs = recommendTemplates(all, { format: "story", body: { frames: [{ id: "1", kind: "poll", text: "מה עושים?" }] }, productPresence: "none", recentTemplateIds: [] });
    expect(recs[0].templateId).toBe("q");
    expect(recs.length).toBeGreaterThanOrEqual(2);
    expect(recs.length).toBeLessThanOrEqual(3);
  });

  it("never suggests a story-only template for a carousel", () => {
    const recs = recommendTemplates(all, { format: "carousel", body: { slides: [{ id: "1", role: "cover", text: "x" }] }, productPresence: "none", recentTemplateIds: [] });
    expect(recs.map((r) => r.templateId)).not.toContain("q");
    expect(recs[0].templateId).toBe("edit");
  });

  it("avoids picking the template that was just used", () => {
    const body = { frames: [{ id: "1", kind: "poll" as const, text: "?" }] };
    const fresh = recommendTemplates(all, { format: "story", body, productPresence: "none", recentTemplateIds: [] });
    const repeated = recommendTemplates(all, { format: "story", body, productPresence: "none", recentTemplateIds: ["q", "q"] });
    expect(fresh[0].templateId).toBe("q");
    expect(repeated[0].templateId).not.toBe("q");
  });

  it("prefers the game-in-life template only when there is a real photo", () => {
    const withPhoto = recommendTemplates(all, { format: "story", body: { frames: [{ id: "1", kind: "product", text: "ערב", assetId: "a" }] }, productPresence: "natural", recentTemplateIds: [] });
    expect(withPhoto[0].templateId).toBe("life");
  });
});
