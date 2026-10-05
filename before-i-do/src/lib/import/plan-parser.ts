import type { ContentFormat, ContentStatus } from "@/lib/domain/constants";
import { newId, type CarouselSlide, type ContentBody, type Pov, type StoryFrame } from "@/lib/domain/content-body";
import { detectTopics, type TopicKey } from "@/lib/domain/topics";

// Pure mapping from the "Before I Do 60 Day Content System" workbook into
// typed records. No database or file access here, so it is unit-testable.
//
// Sheets (matched by name, columns matched by header text, not position):
//   לוח 60 יום   → one main content item per day + its calendar slot
//   בנק סטוריז   → one daily supporting Story per day
//   POV          → shot / length / sound details merged into POV days
//   קרוסלות      → slides merged into carousel days
//   היילייטס     → highlight collections + ordered items
//   שפת המותג    → Brand Brain entries (principle / how we sound / what we avoid)
//   דשבורד       → summary only, used for the import report

export type Cell = string | number | boolean | Date | null | undefined;
export type SheetRows = Cell[][];
export type WorkbookData = Record<string, SheetRows>;

export type ImportedContent = {
  sourceRef: string;
  planDay: number;
  slot: "main" | "story";
  format: ContentFormat;
  pillarKey: string | null;
  productPresence: "none" | "natural" | "direct";
  status: ContentStatus;
  topic: string | null;
  hook: string | null;
  caption: string | null;
  cta: string | null;
  supportingStory: string | null;
  visualNotes: string | null;
  body: ContentBody;
  requiresFilming: boolean;
  requiresProduct: boolean;
  requiresBarak: boolean;
  requiresCouple: boolean;
  prepMinutes: number;
  locationCategory: string | null;
  topicTags: TopicKey[];
  /** for daily stories: the sourceRef of the main piece of the same day */
  parentRef: string | null;
};

export type ImportedHighlight = {
  key: string;
  title: string;
  purpose: string;
  items: Array<{ position: number; body: string; visualNotes: string | null; interaction: string | null }>;
};

export type ImportedBrandEntry = {
  section:
    | "tone"
    | "good_examples"
    | "bad_examples"
    | "visual_principles"
    | "permanent_rules"
    | "words_we_use"
    | "words_we_avoid";
  title: string | null;
  body: string;
  meta: Record<string, string>;
};

export type ImportReport = {
  sheetsFound: string[];
  sheetsMissing: string[];
  days: number;
  dailyStories: number;
  povMerged: number;
  carouselsMerged: number;
  highlights: number;
  brandEntries: number;
  warnings: string[];
};

export type ImportedPlan = {
  content: ImportedContent[];
  highlights: ImportedHighlight[];
  brand: ImportedBrandEntry[];
  report: ImportReport;
};

export const SHEETS = {
  calendar: "לוח 60 יום",
  stories: "בנק סטוריז",
  pov: "POV",
  carousels: "קרוסלות",
  highlights: "היילייטס",
  brand: "שפת המותג",
  dashboard: "דשבורד",
} as const;

// ---------------------------------------------------------------------------
// cell helpers

export function cellText(value: Cell): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).replace(/\r\n/g, "\n").trim();
  return text.length ? text : null;
}

function cellNumber(value: Cell): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = cellText(value);
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

type Table = { header: string[]; rows: Cell[][] };

function toTable(rows: SheetRows | undefined): Table | null {
  if (!rows || rows.length === 0) return null;
  const nonEmpty = rows.filter((r) => r.some((c) => cellText(c) !== null));
  if (nonEmpty.length === 0) return null;
  const [headerRow, ...rest] = nonEmpty;
  return { header: headerRow.map((c) => cellText(c) ?? ""), rows: rest };
}

/** Column accessor by header name (first header that includes any of the needles). */
function column(table: Table, ...needles: string[]): (row: Cell[]) => Cell {
  const index = table.header.findIndex((h) => needles.some((n) => h === n || h.includes(n)));
  return (row) => (index === -1 ? null : row[index]);
}

// ---------------------------------------------------------------------------
// vocabulary mapping

const FORMAT_MAP: Record<string, { format: ContentFormat; product: "none" | "natural" | "direct" }> = {
  POV: { format: "pov_reel", product: "none" },
  סטורי: { format: "story", product: "none" },
  קרוסלה: { format: "carousel", product: "none" },
  "ריל דיבור": { format: "talking_reel", product: "none" },
  "ריל אישי": { format: "reel", product: "none" },
  "מוצר טבעי": { format: "post", product: "natural" },
  "מוצר ישיר": { format: "reel", product: "direct" },
};

const PILLAR_MAP: Record<string, string> = {
  "רגע, דיברתם על זה?": "talk_about_it",
  "חחח אנחנו": "so_us",
  "אף אחד לא סיפר לנו": "nobody_told_us",
  "של מי הצד?": "whose_side",
  "Before I Do בחיים": "in_life",
  "Before I Do בחיים עצמם": "in_life",
  "מאחורי הקלעים": "behind_scenes",
  "אתם אמרתם": "you_said",
  המשחק: "the_game",
};

export function mapFormat(raw: string | null): { format: ContentFormat; product: "none" | "natural" | "direct" } | null {
  if (!raw) return null;
  return FORMAT_MAP[raw.trim()] ?? null;
}

export function mapPillar(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.trim();
  if (PILLAR_MAP[key]) return PILLAR_MAP[key];
  const loose = Object.entries(PILLAR_MAP).find(([name]) => key.includes(name) || name.includes(key));
  return loose ? loose[1] : null;
}

const PREP_MINUTES: Record<ContentFormat, number> = {
  story: 5,
  story_sequence: 10,
  question: 5,
  poll: 5,
  carousel: 25,
  pov_reel: 15,
  talking_reel: 20,
  reel: 30,
  post: 15,
};

const LOCATION_HINTS: Array<[RegExp, string]> = [
  [/מסעדה|המבורגר/, "מסעדה"],
  [/קפה/, "קפה"],
  [/רכב|אוטו/, "רכב"],
  [/רחוב|בחוץ/, "בחוץ"],
  [/בית הדפוס/, "בית דפוס"],
  [/בבית|ספה|שולחן ערב|מטבח|טייק אוויי/, "בית"],
  [/שולחן|מחשב|קטלוג|מסך/, "בית"],
];

function guessLocation(...texts: Array<string | null>): string | null {
  const text = texts.filter(Boolean).join(" ");
  for (const [pattern, location] of LOCATION_HINTS) if (pattern.test(text)) return location;
  return null;
}

function needsBarak(text: string): boolean {
  if (/ברק אם מתאים/.test(text)) return false;
  return /ברק|אחד לשני|שניכם|שנינו/.test(text);
}

function needsCouple(text: string): boolean {
  return /זוג אחר|זוגות שמשחקים|זוג משחק/.test(text);
}

function needsProduct(text: string): boolean {
  return /קופס|קלפים|קלף|המשחק|מוצר/.test(text);
}

// ---------------------------------------------------------------------------
// story parsing

/** Lines that describe what to make rather than the words to publish. */
const BRIEF_STARTERS = [/^וידאו/, /^סטורי המשך/, /^לשתף/, /^מונטאז/, /^צילום/, /^שאלות נפוצות/, /^סטורי\s(?!:)/, /^בחרו טופ/];
const VIDEO_BRIEF = /^וידאו|^מונטאז|^צילום/;
const WH_WORDS = /^(מה|מי|איך|למה|כמה|איזה|איזו|אילו|איפה|מאיפה|על מה|מתי|באיזה|באיזו|לאן|ממה|עם מי|למי|מהו|מהי)(\s|$)/;

function lastSentence(text: string): string {
  const sentences = text.split(/(?<=[.?!])\s+/).filter(Boolean);
  return (sentences[sentences.length - 1] ?? text).trim();
}

/** "יש לכם תקציב סגור?" is yes/no; "כמה ספקים כבר סגרתם?" is open. */
export function isYesNoQuestion(text: string): boolean {
  const last = lastSentence(text).replace(/^(ו|אז\s)/, "");
  return last.endsWith("?") && !WH_WORDS.test(last);
}

/** "מה יותר קשה, להזמין או לקבל תשובה?" → ["להזמין", "לקבל תשובה"] */
export function splitOrOptions(text: string): string[] | null {
  const last = lastSentence(text).replace(/\?$/, "");
  const parts = last.split(/\s+או\s+/);
  if (parts.length !== 2) return null;
  const first = parts[0].includes(",") ? parts[0].slice(parts[0].lastIndexOf(",") + 1) : parts[0];
  const options = [first, parts[1]].map((o) => o.replace(/^אז\s+/, "").trim());
  if (options.some((o) => o.length === 0 || o.length > 40)) return null;
  // a leading question word means the first half is a question, not an option
  if (WH_WORDS.test(options[0])) return null;
  return options;
}

/**
 * Turns a Story line from the sheet into frames.
 *   "סקר: כמה אנשים זו חתונה קטנה? עד 150 / 150 עד 250 / 250 ומעלה" → poll with three options
 *   "... משלמים יותר או בוחרים יום אחר?" + "בחרו" → poll with two options
 *   "סקר: יש לכם תקציב סגור?" (no options) → yes/no poll
 *   "סקר: על מה הוא הפתיע עם דעה?" (open question) → question box
 *   "שאלה: ..." / "תיבת תשובות: ..." / "ענו בתיבה" → question box
 *   "וידאו קצר של ערבוב הקלפים", "סטורי צ'קליסט קצר" → a brief, not copy
 * A vote that has no usable options stays a poll without options; the editor asks for them.
 */
export function parseStoryLine(
  rawText: string,
  interaction: string | null,
): { frames: StoryFrame[]; instruction: string | null } {
  let text = rawText.trim();
  if (BRIEF_STARTERS.some((p) => p.test(text))) {
    const kind = VIDEO_BRIEF.test(text) ? "video" : "text";
    return { frames: [{ id: newId(), kind, text: "", notes: text }], instruction: text };
  }

  let kindHint: "poll" | "question" | null = null;
  const prefix = text.match(/^(סקר|שאלה פתוחה|שאלה|סטורי|תיבת שאלה|תיבת תשובות)\s*:\s*/);
  if (prefix) {
    kindHint = prefix[1] === "סקר" ? "poll" : prefix[1] === "סטורי" ? null : "question";
    text = text.slice(prefix[0].length).trim();
  }

  // "question? A / B / C"
  const qIndex = text.lastIndexOf("?");
  if (qIndex !== -1 && qIndex < text.length - 1) {
    const question = text.slice(0, qIndex + 1).trim();
    const options = text.slice(qIndex + 1).split("/").map((o) => o.trim()).filter(Boolean);
    if (options.length >= 2) {
      return { frames: [{ id: newId(), kind: "poll", text: question, options: options.slice(0, 4) }], instruction: null };
    }
  }

  const interactionText = interaction ?? "";
  const wantsAnswer = kindHint === "question" || /ענו|כתבו|תיבה/.test(interactionText);
  const wantsVote = !wantsAnswer && (kindHint === "poll" || /מצביעים|בחרו|סקר/.test(interactionText));

  if (wantsVote) {
    const options = splitOrOptions(text);
    if (options) return { frames: [{ id: newId(), kind: "poll", text, options }], instruction: null };
    if (isYesNoQuestion(text)) return { frames: [{ id: newId(), kind: "poll", text, options: ["כן", "לא"] }], instruction: null };
    // a dilemma that asks "what do you do?": keep it a poll, the options are written in the editor
    if (/של מי|מה עושים|מי מנצח|מה בוחרים/.test(text) || /מצביעים|בחרו צד/.test(interactionText)) {
      return { frames: [{ id: newId(), kind: "poll", text }], instruction: null };
    }
    return { frames: [{ id: newId(), kind: "question", text }], instruction: null };
  }
  if (wantsAnswer || text.endsWith("?")) {
    return { frames: [{ id: newId(), kind: "question", text }], instruction: null };
  }
  return { frames: [{ id: newId(), kind: "text", text }], instruction: null };
}

// ---------------------------------------------------------------------------
// main

export function parsePlan(workbook: WorkbookData): ImportedPlan {
  const warnings: string[] = [];
  const sheetNames = Object.keys(workbook);
  const found = (Object.values(SHEETS) as string[]).filter((name) => sheetNames.includes(name));
  const missing = (Object.values(SHEETS) as string[]).filter((name) => !sheetNames.includes(name));
  for (const extra of sheetNames.filter((n) => !(Object.values(SHEETS) as string[]).includes(n))) {
    warnings.push(`גיליון "${extra}" לא מוכר ולכן לא יובא.`);
  }

  // --- POV details by day
  const povByDay = new Map<number, { shot: string | null; length: string | null; sound: string | null; text: string | null }>();
  const povTable = toTable(workbook[SHEETS.pov]);
  if (povTable) {
    const day = column(povTable, "יום");
    const text = column(povTable, "טקסט על המסך");
    const shot = column(povTable, "שוט");
    const length = column(povTable, "משך");
    const sound = column(povTable, "סאונד");
    for (const row of povTable.rows) {
      const d = cellNumber(day(row));
      if (d === null) continue;
      povByDay.set(d, {
        shot: cellText(shot(row)),
        length: cellText(length(row)),
        sound: cellText(sound(row)),
        text: cellText(text(row)),
      });
    }
  }

  // --- carousel slides by day
  const slidesByDay = new Map<number, { title: string; slides: string[]; caption: string | null; cta: string | null }>();
  const carTable = toTable(workbook[SHEETS.carousels]);
  if (carTable) {
    const day = column(carTable, "יום");
    const title = column(carTable, "כותרת");
    const caption = column(carTable, "Caption");
    const cta = column(carTable, "CTA");
    const slideColumns = carTable.header
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => /^שקופית\s*\d+/.test(h))
      .sort((a, b) => Number(a.h.match(/\d+/)?.[0]) - Number(b.h.match(/\d+/)?.[0]));
    for (const row of carTable.rows) {
      const d = cellNumber(day(row));
      const t = cellText(title(row));
      if (d === null || !t) continue;
      const slides = slideColumns.map(({ i }) => cellText(row[i])).filter((s): s is string => Boolean(s));
      slidesByDay.set(d, { title: t, slides, caption: cellText(caption(row)), cta: cellText(cta(row)) });
    }
  }

  // --- main calendar
  const content: ImportedContent[] = [];
  const calTable = toTable(workbook[SHEETS.calendar]);
  let povMerged = 0;
  let carouselsMerged = 0;
  if (!calTable) {
    warnings.push(`הגיליון "${SHEETS.calendar}" חסר או ריק, לא יובאו ימי תוכן.`);
  } else {
    const day = column(calTable, "יום");
    const formatCol = column(calTable, "פורמט");
    const pillarCol = column(calTable, "עמוד תוכן");
    const topicCol = column(calTable, "נושא");
    const hookCol = column(calTable, "הוק", "טקסט ראשי");
    const visualCol = column(calTable, "מה לצלם", "לעצב");
    const captionCol = column(calTable, "כיתוב");
    const ctaCol = column(calTable, "CTA");
    const followCol = column(calTable, "סטורי המשך");

    for (const row of calTable.rows) {
      const d = cellNumber(day(row));
      if (d === null) continue;
      const rawFormat = cellText(formatCol(row));
      const mapped = mapFormat(rawFormat);
      if (!mapped) {
        warnings.push(`יום ${d}: פורמט "${rawFormat ?? ""}" לא מוכר, נשמר כפוסט.`);
      }
      const format = mapped?.format ?? "post";
      const productPresence = mapped?.product ?? "none";
      const rawPillar = cellText(pillarCol(row));
      const pillarKey = mapPillar(rawPillar);
      if (rawPillar && !pillarKey) warnings.push(`יום ${d}: עמוד תוכן "${rawPillar}" לא מוכר.`);

      const topic = cellText(topicCol(row));
      const hook = cellText(hookCol(row));
      const visual = cellText(visualCol(row));
      let caption = cellText(captionCol(row));
      let cta = cellText(ctaCol(row));
      const follow = cellText(followCol(row));
      const body: ContentBody = {};

      if (format === "pov_reel") {
        const pov = povByDay.get(d);
        if (pov) povMerged += 1;
        const povBody: Pov = {
          onScreenText: pov?.text ?? hook ?? "",
          shot: pov?.shot ?? visual ?? "",
          action: pov?.shot ?? visual ?? "",
          length: pov?.length ?? "",
          location: guessLocation(pov?.shot ?? null, visual) ?? "",
          props: [],
          gameAppears: false,
          sound: pov?.sound ?? undefined,
        };
        body.pov = povBody;
      } else if (format === "talking_reel" || format === "reel") {
        body.pov = {
          onScreenText: hook ?? "",
          shot: visual ?? "",
          action: visual ?? "",
          length: visual?.match(/(\d+)\s*שניות/)?.[0] ?? "",
          location: guessLocation(visual) ?? "",
          props: productPresence === "none" ? [] : ["Before I Do"],
          gameAppears: productPresence !== "none",
        };
      } else if (format === "carousel") {
        const car = slidesByDay.get(d);
        if (car) carouselsMerged += 1;
        else warnings.push(`יום ${d}: קרוסלה בלי שקופיות בגיליון הקרוסלות.`);
        const texts = car ? [car.title, ...car.slides] : hook ? [hook] : [];
        const slides: CarouselSlide[] = texts.map((text, i) => ({
          id: newId(),
          role: i === 0 ? "cover" : i === texts.length - 1 && texts.length > 1 ? "final" : "body",
          text,
        }));
        body.slides = slides;
        caption = caption ?? car?.caption ?? null;
        cta = cta ?? car?.cta ?? null;
      } else if (format === "story") {
        body.frames = parseStoryLine(hook ?? "", cta).frames;
      } else if (format === "post") {
        body.frames = [{ id: newId(), kind: productPresence === "none" ? "text" : "product", text: hook ?? "" }];
      }

      const allText = [visual, hook, caption].filter(Boolean).join(" ");
      const requiresFilming =
        format === "pov_reel" || format === "talking_reel" || format === "reel" || (format === "post" && /צילום|וידאו/.test(visual ?? ""));

      content.push({
        sourceRef: `plan60:day:${d}`,
        planDay: d,
        slot: "main",
        format,
        pillarKey,
        productPresence,
        status: initialStatus(format),
        topic,
        hook,
        caption,
        cta,
        supportingStory: follow,
        visualNotes: visual,
        body,
        requiresFilming,
        requiresProduct: productPresence !== "none" || needsProduct(visual ?? ""),
        requiresBarak: needsBarak(visual ?? ""),
        requiresCouple: needsCouple(visual ?? ""),
        prepMinutes: PREP_MINUTES[format],
        locationCategory: guessLocation(visual),
        topicTags: detectTopics(topic, hook, allText),
        parentRef: null,
      });
    }
  }

  // --- daily story bank
  let dailyStories = 0;
  const storyTable = toTable(workbook[SHEETS.stories]);
  if (storyTable) {
    const day = column(storyTable, "יום");
    const topicCol = column(storyTable, "נושא");
    const textCol = column(storyTable, "נוסח");
    const interactionCol = column(storyTable, "אינטראקציה");
    const mainDays = new Set(content.map((c) => c.planDay));
    for (const row of storyTable.rows) {
      const d = cellNumber(day(row));
      const text = cellText(textCol(row));
      if (d === null || !text) continue;
      const interaction = cellText(interactionCol(row));
      const { frames, instruction } = parseStoryLine(text, interaction === "סקר / תיבת תשובות לפי הנוסח" ? null : interaction);
      const topic = cellText(topicCol(row));
      dailyStories += 1;
      content.push({
        sourceRef: `plan60:story:${d}`,
        planDay: d,
        slot: "story",
        format: "story",
        pillarKey: null,
        productPresence: /קלפים|קופס|משחק/.test(text) ? "natural" : "none",
        status: instruction ? (VIDEO_BRIEF.test(instruction) ? "ready_to_film" : "writing") : "ready",
        topic,
        hook: instruction ? null : frames[0]?.text ?? null,
        caption: null,
        cta: interaction,
        supportingStory: null,
        visualNotes: instruction,
        body: { frames },
        requiresFilming: Boolean(instruction && VIDEO_BRIEF.test(instruction)),
        requiresProduct: /קלפים|קופס|משחק/.test(text),
        requiresBarak: false,
        requiresCouple: false,
        prepMinutes: 5,
        locationCategory: null,
        topicTags: detectTopics(topic, text),
        parentRef: mainDays.has(d) ? `plan60:day:${d}` : null,
      });
    }
  }

  // --- highlights
  const highlights: ImportedHighlight[] = [];
  const hlTable = toTable(workbook[SHEETS.highlights]);
  if (hlTable) {
    const name = column(hlTable, "היילייט");
    const order = column(hlTable, "סדר");
    const text = column(hlTable, "נוסח");
    const visual = column(hlTable, "ויזואל");
    const interaction = column(hlTable, "אינטראקציה");
    const byName = new Map<string, ImportedHighlight>();
    for (const row of hlTable.rows) {
      const title = cellText(name(row));
      const bodyText = cellText(text(row));
      if (!title || !bodyText) continue;
      let hl = byName.get(title);
      if (!hl) {
        hl = { key: highlightKey(title), title, purpose: HIGHLIGHT_PURPOSE[highlightKey(title)] ?? "", items: [] };
        byName.set(title, hl);
        highlights.push(hl);
      }
      hl.items.push({
        position: cellNumber(order(row)) ?? hl.items.length + 1,
        body: bodyText,
        visualNotes: cellText(visual(row)),
        interaction: cellText(interaction(row)),
      });
    }
    for (const hl of highlights) hl.items.sort((a, b) => a.position - b.position);
  }

  // --- brand language
  const brand: ImportedBrandEntry[] = [];
  const brandTable = toTable(workbook[SHEETS.brand]);
  if (brandTable) {
    const principle = column(brandTable, "עיקרון");
    const how = column(brandTable, "איך נשמעים");
    const avoid = column(brandTable, "ממה נמנעים");
    for (const row of brandTable.rows) {
      const p = cellText(principle(row));
      const yes = cellText(how(row));
      const no = cellText(avoid(row));
      if (!p) continue;
      if (p === "משפט כן") {
        if (yes) brand.push({ section: "good_examples", title: null, body: yes, meta: { source: "plan60" } });
        if (no) brand.push({ section: "bad_examples", title: null, body: no, meta: { source: "plan60" } });
      } else if (p === "בדיקת תוכן") {
        if (yes) brand.push({ section: "permanent_rules", title: "בדיקת תוכן", body: yes, meta: { avoid: no ?? "" } });
      } else if (p === "צילום" || p === "מוצר") {
        brand.push({ section: "visual_principles", title: p, body: yes ?? "", meta: { avoid: no ?? "" } });
      } else {
        brand.push({ section: "tone", title: p, body: yes ?? "", meta: { avoid: no ?? "" } });
      }
    }
  }

  return {
    content,
    highlights,
    brand,
    report: {
      sheetsFound: found,
      sheetsMissing: missing,
      days: content.filter((c) => c.slot === "main").length,
      dailyStories,
      povMerged,
      carouselsMerged,
      highlights: highlights.length,
      brandEntries: brand.length,
      warnings,
    },
  };
}

function initialStatus(format: ContentFormat): ContentStatus {
  switch (format) {
    case "pov_reel":
    case "talking_reel":
    case "reel":
      return "ready_to_film";
    case "carousel":
      return "writing";
    case "post":
      return "ready_to_film";
    default:
      return "ready";
  }
}

const HIGHLIGHT_KEYS: Record<string, string> = {
  "תתחילו פה": "start_here",
  "דיברתם על זה?": "talked_about_it",
  המשחק: "the_game",
};

const HIGHLIGHT_PURPOSE: Record<string, string> = {
  start_here: "להכיר את הרעיון בלי למכור מיד.",
  talked_about_it: "השאלות והשיחות הכי חזקות, כולל שאלות מהקהל.",
  the_game: "למי שרוצה מידע על המוצר: מה זה, איך משחקים, למי זה מתאים, תמונות אמיתיות, תגובות, הזמנה ומשלוח.",
};

function highlightKey(title: string): string {
  return HIGHLIGHT_KEYS[title] ?? `hl_${Array.from(title).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36)}`;
}
