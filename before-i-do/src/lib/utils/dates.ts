// Dates are handled as local calendar days (Israel time) in "YYYY-MM-DD".

export const TIME_ZONE = "Asia/Jerusalem";

export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function diffDays(fromISO: string, toISO: string): number {
  return Math.round((asUTC(toISO).getTime() - asUTC(fromISO).getTime()) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday (Israeli week starts Sunday) */
export function weekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function startOfWeek(iso: string): string {
  return addDays(iso, -weekday(iso));
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

const dayFormatter = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortFormatter = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", timeZone: "UTC" });
const monthFormatter = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric", timeZone: "UTC" });
const weekdayShort = new Intl.DateTimeFormat("he-IL", { weekday: "short", timeZone: "UTC" });

function asUTC(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export const formatDayLong = (iso: string) => dayFormatter.format(asUTC(iso));
export const formatDayShort = (iso: string) => shortFormatter.format(asUTC(iso));
export const formatMonth = (iso: string) => monthFormatter.format(asUTC(iso));
export const formatWeekdayShort = (iso: string) => weekdayShort.format(asUTC(iso));

export function relativeDayLabel(iso: string, today: string = todayISO()): string {
  const diff = diffDays(today, iso);
  if (diff === 0) return "היום";
  if (diff === 1) return "מחר";
  if (diff === -1) return "אתמול";
  if (diff > 1 && diff < 7) return `בעוד ${diff} ימים`;
  if (diff < -1 && diff > -7) return `לפני ${-diff} ימים`;
  return formatDayShort(iso);
}

const timeFormatter = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
const dateTimeFormatter = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
export const formatTime = (isoDateTime: string) => timeFormatter.format(new Date(isoDateTime));
export const formatDateTime = (isoDateTime: string) => dateTimeFormatter.format(new Date(isoDateTime));
