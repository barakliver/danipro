import type { FilmingResource } from "@/lib/domain/constants";
import type { ContentFormat } from "@/lib/domain/constants";
import type { Pov } from "@/lib/domain/content-body";

export type FilmCandidate = {
  id: string;
  title: string;
  format: ContentFormat;
  pov?: Pov;
  visualNotes: string | null;
  locationCategory: string | null;
  requiresBarak: boolean;
  requiresCouple: boolean;
  requiresProduct: boolean;
  scheduledOn: string | null;
};

export type PlannedShot = { id: string; title: string; minutes: number; scheduledOn: string | null };
export type Look = {
  number: number;
  location: string;
  locationKey: FilmingResource;
  camera: string;
  product: boolean;
  people: string[];
  outfit: string | null;
  props: string[];
  shots: PlannedShot[];
  minutes: number;
};
export type FilmingPlan = { looks: Look[]; usedMinutes: number; skipped: Array<{ id: string; title: string; reason: string }> };

const SHOT_MINUTES: Partial<Record<ContentFormat, number>> = { pov_reel: 6, talking_reel: 10, reel: 12, post: 5 };
const LOOK_SETUP_MINUTES = 4;

const LOCATION_KEYS: Array<[RegExp, FilmingResource, string]> = [
  [/מסעד|קפה|בית קפה|המבורגר/, "restaurant", "מסעדה / קפה"],
  [/רכב|אוטו|במכונית/, "car", "רכב"],
  [/רחוב|בחוץ|פארק|ים/, "outside", "בחוץ"],
  [/משרד|עבודה/, "office", "משרד"],
  [/בית|מטבח|ספה|סלון|שולחן|מחשב|מיטה/, "home", "בית"],
];

export function locationOf(c: FilmCandidate): { key: FilmingResource; label: string } {
  const text = [c.locationCategory, c.pov?.location, c.pov?.shot, c.pov?.action, c.visualNotes].filter(Boolean).join(" ");
  for (const [pattern, key, label] of LOCATION_KEYS) if (pattern.test(text)) return { key, label };
  return { key: "home", label: "בית" };
}

export function cameraOf(c: FilmCandidate): string {
  const text = [c.pov?.cameraSetup, c.pov?.shot, c.visualNotes].filter(Boolean).join(" ");
  if (/סלפי/.test(text)) return "סלפי ביד";
  if (/מלמעלה|מעל/.test(text)) return "צילום מלמעלה";
  if (/מישהו מצלם|צלם/.test(text)) return "מישהו מצלם";
  return "טלפון על חצובה";
}

function peopleOf(c: FilmCandidate): string[] {
  const people = ["אני"];
  if (c.requiresBarak) people.push("ברק");
  if (c.requiresCouple) people.push("זוג");
  return people;
}

export function shotMinutes(c: FilmCandidate): number {
  return SHOT_MINUTES[c.format] ?? 6;
}

/**
 * Groups ready-to-film concepts into "looks" (same place, people, product and camera
 * setup) so a filming session is one setup after another, not running around.
 * Fits the time available, soonest-scheduled first.
 */
export function planFilmingDay(candidates: FilmCandidate[], minutes: number, available: FilmingResource[]): FilmingPlan {
  const has = new Set(available);
  const skipped: FilmingPlan["skipped"] = [];
  const feasible: Array<FilmCandidate & { loc: { key: FilmingResource; label: string } }> = [];

  for (const c of candidates) {
    const loc = locationOf(c);
    const reason =
      !has.has("me") && !has.has("barak")
        ? "אין מי שיצלם"
        : c.requiresBarak && !has.has("barak")
          ? "צריך את ברק"
          : c.requiresCouple && !has.has("couple")
            ? "צריך זוג נוסף"
            : c.requiresProduct && !has.has("product")
              ? "צריך את המשחק"
              : !has.has(loc.key)
                ? `צריך ${loc.label}`
                : null;
    if (reason) skipped.push({ id: c.id, title: c.title, reason });
    else feasible.push({ ...c, loc });
  }

  const groups = new Map<string, typeof feasible>();
  for (const c of feasible) {
    const key = [c.loc.key, peopleOf(c).join("+"), c.requiresProduct ? "product" : "", cameraOf(c)].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  const ordered = Array.from(groups.values())
    .map((items) => items.sort((a, b) => (a.scheduledOn ?? "9999").localeCompare(b.scheduledOn ?? "9999")))
    // big groups first (most shots per setup), then whatever is due soonest
    .sort((a, b) => b.length - a.length || (a[0].scheduledOn ?? "9999").localeCompare(b[0].scheduledOn ?? "9999"));

  const looks: Look[] = [];
  let used = 0;
  for (const items of ordered) {
    const shots: PlannedShot[] = [];
    let lookMinutes = LOOK_SETUP_MINUTES;
    for (const c of items) {
      const m = shotMinutes(c);
      if (used + lookMinutes + m > minutes) {
        skipped.push({ id: c.id, title: c.title, reason: "לא נכנס בזמן" });
        continue;
      }
      shots.push({ id: c.id, title: c.title, minutes: m, scheduledOn: c.scheduledOn });
      lookMinutes += m;
    }
    if (!shots.length) continue;
    used += lookMinutes;
    const first = items[0];
    looks.push({
      number: looks.length + 1,
      location: first.loc.label,
      locationKey: first.loc.key,
      camera: cameraOf(first),
      product: first.requiresProduct,
      people: peopleOf(first),
      outfit: items.find((i) => i.pov?.outfit)?.pov?.outfit ?? null,
      props: Array.from(new Set(items.flatMap((i) => i.pov?.props ?? []))).slice(0, 8),
      shots,
      minutes: lookMinutes,
    });
  }
  return { looks, usedMinutes: used, skipped };
}
