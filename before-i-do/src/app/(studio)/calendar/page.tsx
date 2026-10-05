import type { Metadata } from "next";
import { getStudio } from "@/lib/auth/studio";
import { listContent, listPillars } from "@/lib/content/queries";
import { todayISO } from "@/lib/utils/dates";
import { CalendarView } from "./calendar-view";

export const metadata: Metadata = { title: "לוח תוכן" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  const { view, date } = await searchParams;
  const studio = await getStudio();
  const [items, pillars] = await Promise.all([listContent(studio), listPillars(studio)]);
  const today = todayISO();
  const anchor = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
  const initialView = view === "week" || view === "list" || view === "month" ? view : "week";
  return <CalendarView items={items} pillars={pillars} today={today} anchor={anchor} initialView={initialView} />;
}
