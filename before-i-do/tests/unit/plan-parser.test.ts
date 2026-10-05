import { readFile } from "node:fs/promises";
import { describe, expect, it, beforeAll } from "vitest";
import { parsePlan, parseStoryLine, mapFormat, mapPillar, type ImportedPlan } from "@/lib/import/plan-parser";
import { readWorkbook } from "@/lib/import/read-workbook";

describe("parseStoryLine", () => {
  it("turns 'סקר: question? A / B / C' into a poll with options", () => {
    const { frames } = parseStoryLine("סקר: כמה אנשים זו חתונה קטנה מבחינתכם? עד 150 / 150 עד 250 / 250 ומעלה", null);
    expect(frames).toHaveLength(1);
    expect(frames[0].kind).toBe("poll");
    expect(frames[0].text).toBe("כמה אנשים זו חתונה קטנה מבחינתכם?");
    expect(frames[0].options).toEqual(["עד 150", "150 עד 250", "250 ומעלה"]);
  });

  it("splits an 'A או B?' dilemma into two poll options when the interaction is a vote", () => {
    const { frames } = parseStoryLine("חמישי יקר יותר, אבל אחד מכם נעול עליו. משלמים יותר או בוחרים יום אחר?", "בחרו");
    expect(frames[0].kind).toBe("poll");
    expect(frames[0].options).toEqual(["משלמים יותר", "בוחרים יום אחר"]);
  });

  it("treats answer-box interactions as a question frame", () => {
    const { frames } = parseStoryLine("איזו החלטה אתם רוצים להשאיר לגמרי ביניכם?", "ענו בתיבה");
    expect(frames[0].kind).toBe("question");
  });

  it("keeps filming instructions out of the copy", () => {
    const result = parseStoryLine("וידאו קצר של ערבוב הקלפים", null);
    expect(result.instruction).toBe("וידאו קצר של ערבוב הקלפים");
    expect(result.frames[0].text).toBe("");
    expect(result.frames[0].kind).toBe("video");
  });
});

describe("vocabulary mapping", () => {
  it("maps sheet formats and pillars", () => {
    expect(mapFormat("POV")).toEqual({ format: "pov_reel", product: "none" });
    expect(mapFormat("מוצר טבעי")).toEqual({ format: "post", product: "natural" });
    expect(mapFormat("מוצר ישיר")?.product).toBe("direct");
    expect(mapPillar("Before I Do בחיים")).toBe("in_life");
    expect(mapPillar("רגע, דיברתם על זה?")).toBe("talk_about_it");
    expect(mapPillar("משהו אחר")).toBeNull();
  });
});

describe("parsePlan on the real workbook", () => {
  let plan: ImportedPlan;
  beforeAll(async () => {
    const file = await readFile(new URL("../../data/Before_I_Do_60_Day_Content_System.xlsx", import.meta.url));
    plan = parsePlan(await readWorkbook(file));
  });

  it("imports all 60 days and 60 daily stories", () => {
    expect(plan.report.days).toBe(60);
    expect(plan.report.dailyStories).toBe(60);
    expect(plan.report.sheetsMissing).toEqual([]);
  });

  it("merges every POV and carousel detail sheet row", () => {
    expect(plan.report.povMerged).toBe(17);
    expect(plan.report.carouselsMerged).toBe(9);
    const day3 = plan.content.find((c) => c.sourceRef === "plan60:day:3")!;
    expect(day3.format).toBe("carousel");
    expect(day3.body.slides?.map((s) => s.role)).toEqual(["cover", "body", "body", "body", "body", "body", "final"]);
    expect(day3.body.slides?.[0].text).toContain("6 דברים");
  });

  it("keeps POV structure instead of one text field", () => {
    const day1 = plan.content.find((c) => c.sourceRef === "plan60:day:1")!;
    expect(day1.format).toBe("pov_reel");
    expect(day1.pillarKey).toBe("so_us");
    expect(day1.body.pov?.onScreenText).toContain("350 איש");
    expect(day1.body.pov?.length).toBe("6 עד 10 שניות");
    expect(day1.requiresFilming).toBe(true);
    expect(day1.topicTags).toContain("wedding_size");
  });

  it("links daily stories to their day and keeps poll options", () => {
    const story1 = plan.content.find((c) => c.sourceRef === "plan60:story:1")!;
    expect(story1.parentRef).toBe("plan60:day:1");
    expect(story1.body.frames?.[0].options).toHaveLength(3);
  });

  it("detects when Barak is needed on camera", () => {
    const day11 = plan.content.find((c) => c.sourceRef === "plan60:day:11")!;
    expect(day11.requiresBarak).toBe(true);
    const day60 = plan.content.find((c) => c.sourceRef === "plan60:day:60")!;
    expect(day60.requiresBarak).toBe(false);
  });

  it("imports three highlights with ordered items and brand language", () => {
    expect(plan.highlights.map((h) => h.key)).toEqual(["start_here", "talked_about_it", "the_game"]);
    expect(plan.highlights.every((h) => h.items.length === 5)).toBe(true);
    expect(plan.brand.filter((b) => b.section === "good_examples")).toHaveLength(3);
    expect(plan.brand.filter((b) => b.section === "bad_examples")).toHaveLength(3);
  });

  it("roughly respects the 70/20/10 guardrail in the imported plan", () => {
    const main = plan.content.filter((c) => c.slot === "main");
    const direct = main.filter((c) => c.productPresence === "direct").length;
    expect(direct / main.length).toBeLessThanOrEqual(0.15);
  });
});

describe("story options edge cases", () => {
  it("keeps words that start with ש intact and drops the leading clause", () => {
    const a = parseStoryLine("נשאר כסף. משדרגים את החתונה או שומרים לירח הדבש?", "בחרו");
    expect(a.frames[0].options).toEqual(["משדרגים את החתונה", "שומרים לירח הדבש"]);
    const b = parseStoryLine("מה יותר קשה, להזמין או לקבל תשובה?", "בחרו");
    expect(b.frames[0].options).toEqual(["להזמין", "לקבל תשובה"]);
  });

  it("turns an open 'סקר:' question into a question box instead of a fake yes/no", () => {
    expect(parseStoryLine("סקר: כמה ספקים כבר סגרתם?", null).frames[0].kind).toBe("question");
    expect(parseStoryLine("סקר: יש לכם תקציב סגור?", null).frames[0].options).toEqual(["כן", "לא"]);
  });

  it("treats production briefs as briefs", () => {
    expect(parseStoryLine("סטורי צ'קליסט קצר", null).instruction).toBe("סטורי צ'קליסט קצר");
    expect(parseStoryLine("תיבת תשובות: מילה אחת לחתונה שלכם", null).frames[0]).toMatchObject({
      kind: "question",
      text: "מילה אחת לחתונה שלכם",
    });
  });
});
