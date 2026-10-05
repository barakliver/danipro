import { describe, expect, it } from "vitest";
import { planFilmingDay, type FilmCandidate } from "@/lib/filming/plan";

const c = (id: string, p: Partial<FilmCandidate>): FilmCandidate => ({
  id, title: id, format: "pov_reel", visualNotes: null, locationCategory: null, requiresBarak: false, requiresCouple: false, requiresProduct: false, scheduledOn: null, ...p,
});

describe("planFilmingDay", () => {
  const candidates = [
    c("kitchen1", { pov: { onScreenText: "", shot: "טלפון על חצובה במטבח", action: "", length: "", location: "מטבח", props: [], gameAppears: false }, scheduledOn: "2026-10-08" }),
    c("kitchen2", { pov: { onScreenText: "", shot: "חצובה, מטבח", action: "", length: "", location: "מטבח", props: ["כוס"], gameAppears: false }, scheduledOn: "2026-10-06" }),
    c("table-product", { locationCategory: "בית", requiresProduct: true, pov: { onScreenText: "", shot: "שולחן", action: "", length: "", location: "בית", props: [], gameAppears: true }, scheduledOn: "2026-10-07" }),
    c("with-barak", { requiresBarak: true, locationCategory: "בית" }),
    c("restaurant", { locationCategory: "מסעדה", format: "post" }),
  ];

  it("groups shots that share a setup into one look, soonest first", () => {
    const plan = planFilmingDay(candidates, 60, ["me", "home", "product"]);
    expect(plan.looks[0].shots.map((s) => s.id)).toEqual(["kitchen2", "kitchen1"]);
    expect(plan.looks.find((l) => l.product)?.shots.map((s) => s.id)).toEqual(["table-product"]);
  });

  it("explains why concepts were left out", () => {
    const plan = planFilmingDay(candidates, 60, ["me", "home"]);
    const reasons = Object.fromEntries(plan.skipped.map((s) => [s.id, s.reason]));
    expect(reasons["with-barak"]).toBe("צריך את ברק");
    expect(reasons["table-product"]).toBe("צריך את המשחק");
    expect(reasons["restaurant"]).toBe("צריך מסעדה / קפה");
  });

  it("respects the time available", () => {
    const plan = planFilmingDay(candidates, 15, ["me", "home", "product"]);
    expect(plan.usedMinutes).toBeLessThanOrEqual(15);
    expect(plan.skipped.some((s) => s.reason === "לא נכנס בזמן")).toBe(true);
  });
});
