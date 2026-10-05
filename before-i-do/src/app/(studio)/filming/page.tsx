import type { Metadata } from "next";
import { getStudio } from "@/lib/auth/studio";
import { loadFilmCandidates } from "@/lib/filming/load";
import type { Look } from "@/lib/filming/plan";
import { FilmingView, type ActiveSession } from "./filming-view";

export const metadata: Metadata = { title: "יום צילום" };

export default async function FilmingPage() {
  const studio = await getStudio();
  const [{ candidates, details }, { data: session, error }] = await Promise.all([
    loadFilmCandidates(studio),
    studio.supabase
      .from("filming_sessions")
      .select("id, minutes, available, plan, created_at, items:filming_session_items(content_id, done_at)")
      .eq("workspace_id", studio.workspace.id)
      .is("completed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (error) throw error;

  const active: ActiveSession | null = session
    ? {
        id: session.id,
        minutes: session.minutes,
        looks: (Array.isArray(session.plan) ? session.plan : []) as unknown as Look[],
        done: Object.fromEntries(session.items.map((i) => [i.content_id, Boolean(i.done_at)])),
      }
    : null;

  return <FilmingView candidates={candidates} details={details} active={active} />;
}
