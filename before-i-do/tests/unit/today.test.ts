import { describe, expect, it } from "vitest";
import { planToday } from "@/lib/content/today";
import type { Content } from "@/lib/content/types";

let n = 0;
function item(partial: Partial<Content> & { day?: string; slot?: "main" | "story" }): Content {
  n += 1;
  const { day, slot = "main", ...rest } = partial;
  return {
    id: `c${n}`,
    workspace_id: "w",
    format: "story",
    status: "ready",
    body: {},
    pillar: null,
    calendar: day ? { scheduled_on: day, scheduled_time: null, plan_day: null, slot } : null,
    is_quick: slot === "story",
    published_at: null,
    ...rest,
  } as Content;
}

const TODAY = "2026-10-05";

describe("planToday", () => {
  it("shows what is scheduled for today first", () => {
    const a = item({ day: TODAY, status: "ready_to_film", format: "pov_reel" });
    const plan = planToday([item({ day: "2026-10-06" }), a], TODAY);
    expect(plan.main).toMatchObject({ kind: "scheduled", item: { id: a.id } });
  });

  it("carries over an unpublished piece from the last week when today is empty", () => {
    const late = item({ day: "2026-10-03", status: "ready" });
    const plan = planToday([late], TODAY);
    expect(plan.main).toMatchObject({ kind: "carried_over", daysLate: 2 });
  });

  it("falls back to Ready, then an idea, then a pillar prompt", () => {
    const ready = item({ status: "ready" });
    expect(planToday([ready], TODAY).main.kind).toBe("ready");
    expect(planToday([], TODAY, [{ id: "i1", body: "משהו ששמעתי" }]).main).toMatchObject({ kind: "idea", ideaId: "i1" });
    expect(planToday([], TODAY).main.kind).toBe("prompt");
  });

  it("offers today's daily Story as the 10-minute option, never the main piece", () => {
    const main = item({ day: TODAY, format: "pov_reel" });
    const story = item({ day: TODAY, slot: "story" });
    const plan = planToday([main, story], TODAY);
    expect(plan.quickStory?.id).toBe(story.id);
  });

  it("keeps today's piece visible after it was published", () => {
    const done = item({ day: TODAY, status: "published" });
    const plan = planToday([done], TODAY);
    expect(plan.main).toMatchObject({ kind: "scheduled", item: { id: done.id } });
    expect(plan.publishedToday).toHaveLength(1);
  });
});
