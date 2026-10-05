import { describe, expect, it } from "vitest";
import { hookSimilarity, repetitionWarnings, type MemoryItem } from "@/lib/memory/repetition";

const item = (id: string, p: Partial<MemoryItem>): MemoryItem => ({ id, hook: null, topic_tags: [], template_id: null, assetIds: [], day: null, published: true, ...p });

describe("repetitionWarnings", () => {
  it("warns when a topic appeared often in the last 10 days, in the brand's words", () => {
    const others = [item("a", { topic_tags: ["guest_list"], day: "2026-10-01" }), item("b", { topic_tags: ["guest_list"], day: "2026-10-03" }), item("c", { topic_tags: ["guest_list"], day: "2026-10-04" })];
    const warnings = repetitionWarnings(item("x", { topic_tags: ["guest_list"], day: "2026-10-05", published: false }), others, "2026-10-05");
    expect(warnings[0].message).toBe("דיברנו על רשימת מוזמנים 3 פעמים ב־10 הימים האחרונים.");
  });

  it("ignores old or unpublished pieces", () => {
    const others = [item("a", { topic_tags: ["budget"], day: "2026-09-01" }), item("b", { topic_tags: ["budget"], day: "2026-10-04", published: false })];
    expect(repetitionWarnings(item("x", { topic_tags: ["budget"], day: "2026-10-05" }), others, "2026-10-05")).toEqual([]);
  });

  it("spots a near-duplicate hook and a reused photo", () => {
    const others = [item("a", { hook: "כשאמרתם שאתם רוצים חתונה קטנה ואז גילית שאצלו קטנה זה 350 איש", day: "2026-10-02", assetIds: ["p1"] })];
    const w = repetitionWarnings(item("x", { hook: "כשאמרתם שאתם רוצים חתונה קטנה ואצלו זה 350", day: "2026-10-05", assetIds: ["p1"] }), others, "2026-10-05");
    expect(w.map((x) => x.code)).toEqual(["hook", "asset"]);
    expect(hookSimilarity("שלום עולם גדול", "משהו אחר לגמרי")).toBe(0);
  });
});

import { scrubPII } from "@/lib/audience/privacy";

describe("scrubPII", () => {
  it("removes emails, phones, handles and links from audience lines", () => {
    const out = scrubPII("כתבה לנו @noa.levi מ-054-1234567 וגם noa@gmail.com ראו https://x.co/abc");
    expect(out).not.toMatch(/noa|054|gmail|https/);
    expect(out).toContain("[טלפון]");
    expect(scrubPII("חשבתי שרק אנחנו רבים על הרשימת מוזמנים")).toBe("חשבתי שרק אנחנו רבים על הרשימת מוזמנים");
  });
});
