import { describe, expect, it } from "vitest";
import { scoreVoice } from "@/lib/voice/score";

// Calibrated against the brand's own good and bad examples.
const GOOD = [
  "כשאמרתם שאתם רוצים חתונה קטנה ואז גילית שאצלו קטנה זה 350 איש",
  "אמא שלו רוצה להוסיף עוד 40 מוזמנים.\nאת לא מכירה אף אחד מהם.",
  "אם אף אחד מהמשפחה שלכם לא היה מביע דעה על החתונה, מה הייתם עושים אחרת?",
  "השבוע מגיעות הקופסאות הראשונות מבית הדפוס.\nוברק במילואים.\nתזמון מושלם כמובן 😅",
];
const BAD = [
  "הדרך לחתונה מתחילה בתקשורת טובה.",
  "צרו רגעים משמעותיים יחד.",
  "העמיקו את הקשר שלכם לפני היום הגדול.",
  "המשחק שכל זוג מאורס חייב.",
  "הגיע הזמן לקחת את הזוגיות שלכם לשלב הבא.",
  "כל חתונה מתחילה באהבה.",
];

describe("scoreVoice", () => {
  it("scores every good brand example clearly above every bad one", () => {
    const good = GOOD.map((t) => scoreVoice([t]).score);
    const bad = BAD.map((t) => scoreVoice([t]).score);
    expect(Math.min(...good)).toBeGreaterThan(Math.max(...bad) + 10);
  });

  it("puts good examples in the strong range and bad ones in the weak range", () => {
    for (const t of GOOD) expect(scoreVoice([t]).score, t).toBeGreaterThanOrEqual(64);
    for (const t of BAD) expect(scoreVoice([t]).score, t).toBeLessThan(55);
  });

  it("explains why something is off", () => {
    const result = scoreVoice(["צרו רגעים משמעותיים יחד."]);
    const codes = result.flags.map((f) => f.code);
    expect(codes).toContain("advice");
    expect(codes).toContain("therapy");
  });

  it("respects Brand Brain words to avoid", () => {
    const result = scoreVoice(["ערב בלתי רגיל עם הקלפים"], { avoid: ["בלתי רגיל"] });
    expect(result.flags.some((f) => f.code === "avoid")).toBe(true);
  });

  it("gives direct product content some slack on pressure", () => {
    const text = ["אז מה יש בתוך Before I Do? לפרטים בקישור בפרופיל"];
    expect(scoreVoice(text, { productIntent: "direct" }).dimensions.find((d) => d.key === "low_pressure")!.value).toBeGreaterThanOrEqual(
      scoreVoice(text).dimensions.find((d) => d.key === "low_pressure")!.value,
    );
  });
});
