import { describe, expect, it } from "vitest";
import { escapeHtml, renderDocument, sizeStep } from "@/lib/render/document";
import { parseDesignSettings } from "@/lib/render/design-settings";

const settings = parseDesignSettings({});

describe("renderDocument", () => {
  it("escapes copy so text can never inject markup", () => {
    const html = renderDocument({
      format: "story",
      family: "text_message",
      frame: { kind: "text", text: '<img src=x onerror="alert(1)">' },
      settings,
      fontCss: "",
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("is RTL at exact Instagram sizes", () => {
    const story = renderDocument({ format: "story", family: "question", frame: { kind: "question", text: "מה עושים?" }, settings, fontCss: "" });
    expect(story).toContain('dir="rtl"');
    expect(story).toContain("width:1080px;height:1920px");
    const slide = renderDocument({ format: "carousel", family: "carousel_editorial", frame: { kind: "slide", text: "שקף", index: 1, total: 7 }, settings, fontCss: "" });
    expect(slide).toContain("width:1080px;height:1350px");
    expect(slide).toContain("2/7");
  });

  it("only shows sticker hints in preview guides", () => {
    const frame = { kind: "poll" as const, text: "מה עושים?", options: ["מוסיפים", "מדברים שוב"] };
    const exported = renderDocument({ format: "story", family: "text_message", frame, settings, fontCss: "" });
    const preview = renderDocument({ format: "story", family: "text_message", frame, settings, fontCss: "", guides: true });
    expect(exported).not.toContain("כאן מוסיפים");
    expect(preview).toContain("כאן מוסיפים את הסקר");
  });

  it("picks smaller type for longer copy", () => {
    expect(sizeStep("אמא שלו רוצה עוד 40 מוזמנים.")).toBe("xl");
    expect(sizeStep("א".repeat(120))).toBe("md");
    expect(escapeHtml(`"'&`)).toBe("&quot;&#39;&amp;");
  });
});
