import { describe, expect, it } from "vitest";
import { findPatterns, parseSeconds, ratioShares, type MeasuredContent } from "@/lib/analytics/patterns";

const label = (_: string, key: string) => key;
function item(id: string, topics: string[], shares: number, extra: Partial<MeasuredContent> = {}): MeasuredContent {
  return { id, title: id, format: "post", pillarName: null, topics, povSeconds: null, metrics: { shares }, ...extra };
}

describe("findPatterns", () => {
  it("says nothing from a tiny sample", () => {
    expect(findPatterns([item("a", ["guests"], 50), item("b", [], 1)], label)).toEqual([]);
  });

  it("finds a group that is shared far more, with honest confidence", () => {
    const items = [
      item("g1", ["guests"], 40),
      item("g2", ["guests"], 35),
      item("g3", ["guests"], 30),
      item("o1", ["budget"], 5),
      item("o2", ["budget"], 6),
      item("o3", ["venue"], 4),
    ];
    const patterns = findPatterns(items, label);
    const guests = patterns.find((p) => p.group === "topic:guests");
    expect(guests?.signal).toBe("shares");
    expect(guests?.confidence).toBe("early");
    expect(guests?.text).toContain("שותף");
  });

  it("one viral post does not make a pattern (medians)", () => {
    const items = [item("g1", ["guests"], 500), item("g2", ["guests"], 4), item("g3", ["guests"], 5), item("o1", [], 5), item("o2", [], 6), item("o3", [], 4)];
    expect(findPatterns(items, label).find((p) => p.group === "topic:guests")).toBeUndefined();
  });

  it("buckets POV length", () => {
    const pov = (id: string, s: number, shares: number) => item(id, [], shares, { format: "pov_reel", povSeconds: s });
    const items = [pov("a", 5, 30), pov("b", 6, 28), pov("c", 7, 40), pov("d", 15, 3), pov("e", 12, 4), pov("f", 20, 2)];
    expect(findPatterns(items, label).some((p) => p.group === "pov:short")).toBe(true);
  });
});

describe("helpers", () => {
  it("parses seconds", () => {
    expect(parseSeconds("5-7 שניות")).toBe(5);
    expect(parseSeconds("")).toBeNull();
  });
  it("computes ratio shares", () => {
    const shares = ratioShares(["audience", "audience", "direct_product", null]);
    expect(shares[0]).toMatchObject({ group: "audience", count: 2 });
    expect(shares[2].share).toBeCloseTo(1 / 3);
  });
});
