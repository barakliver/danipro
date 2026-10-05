import type { Content } from "./types";
import { addDays, diffDays } from "@/lib/utils/dates";

export type TodayPick =
  | { kind: "scheduled"; item: Content }
  | { kind: "carried_over"; item: Content; daysLate: number }
  | { kind: "ready"; item: Content }
  | { kind: "idea"; ideaId: string; text: string }
  | { kind: "prompt"; pillarName: string; prompt: string };

export type TodayPlan = {
  main: TodayPick;
  /** other main pieces also scheduled for today */
  alsoToday: Content[];
  /** "יש לך עוד 10 דקות?" */
  quickStory: Content | null;
  publishedToday: Content[];
};

const isMain = (c: Content) => c.calendar?.slot !== "story" && !c.is_quick;
const open = (c: Content) => c.status !== "published";

/** Conversation prompts used when there is literally nothing else. */
export const PILLAR_PROMPTS: ReadonlyArray<{ pillarName: string; prompt: string }> = [
  { pillarName: "רגע, דיברתם על זה?", prompt: "על מה בתכנון החתונה עוד לא דיברתם, ושניכם יודעים שצריך?" },
  { pillarName: "חחח אנחנו", prompt: "מה קרה השבוע שגרם לך להגיד \"טוב, זה כל כך אנחנו\"?" },
  { pillarName: "אף אחד לא סיפר לנו", prompt: "מה גילית בתכנון שאף אחד לא הזהיר אותך ממנו?" },
  { pillarName: "של מי הצד?", prompt: "איזו דילמה קטנה הייתם שמחים שמישהו אחר יכריע בה?" },
  { pillarName: "מאחורי הקלעים", prompt: "מה קרה היום עם הקופסאות, האריזות או המשלוחים?" },
];

/**
 * The app always offers one step forward:
 * scheduled for today → carried over from earlier days → ready → an idea → a pillar prompt.
 */
export function planToday(
  items: Content[],
  today: string,
  ideas: Array<{ id: string; body: string }> = [],
  promptSeed = 0,
): TodayPlan {
  const todays = items.filter((c) => c.calendar?.scheduled_on === today);
  const todaysMain = todays.filter(isMain);
  const openToday = todaysMain.filter(open);
  const publishedToday = todays.filter((c) => c.status === "published");

  let main: TodayPick;
  if (openToday.length) {
    main = { kind: "scheduled", item: openToday[0] };
  } else {
    const late = items
      .filter((c) => isMain(c) && open(c) && c.calendar && c.calendar.scheduled_on < today && c.calendar.scheduled_on >= addDays(today, -7))
      .sort((a, b) => b.calendar!.scheduled_on.localeCompare(a.calendar!.scheduled_on));
    const ready = items
      .filter((c) => isMain(c) && c.status === "ready")
      .sort((a, b) => (a.calendar?.scheduled_on ?? "9999").localeCompare(b.calendar?.scheduled_on ?? "9999"));
    if (todaysMain.length === 0 && late.length) {
      main = { kind: "carried_over", item: late[0], daysLate: diffDays(late[0].calendar!.scheduled_on, today) };
    } else if (ready.length && todaysMain.length === 0) {
      main = { kind: "ready", item: ready[0] };
    } else if (todaysMain.length) {
      // today's piece is already published: still show it, marked done
      main = { kind: "scheduled", item: todaysMain[0] };
    } else if (ideas.length) {
      main = { kind: "idea", ideaId: ideas[0].id, text: ideas[0].body };
    } else {
      const p = PILLAR_PROMPTS[Math.abs(promptSeed) % PILLAR_PROMPTS.length];
      main = { kind: "prompt", ...p };
    }
  }

  const mainId = "item" in main ? main.item.id : null;
  const quickCandidates = items.filter(
    (c) => (c.calendar?.slot === "story" || c.is_quick) && open(c) && c.id !== mainId && c.status !== "writing" && c.status !== "idea",
  );
  const quickStory =
    quickCandidates.find((c) => c.calendar?.scheduled_on === today) ??
    quickCandidates
      .filter((c) => (c.calendar?.scheduled_on ?? "") >= today)
      .sort((a, b) => (a.calendar?.scheduled_on ?? "").localeCompare(b.calendar?.scheduled_on ?? ""))[0] ??
    null;

  return {
    main,
    alsoToday: openToday.slice(1),
    quickStory,
    publishedToday,
  };
}
