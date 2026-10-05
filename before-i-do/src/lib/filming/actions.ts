"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStudio } from "@/lib/auth/studio";
import { FILMING_RESOURCES } from "@/lib/domain/constants";
import { loadFilmCandidates } from "./load";
import { planFilmingDay } from "./plan";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const fail = (error: unknown): { ok: false; error: string } => ({
  ok: false,
  error: error instanceof z.ZodError ? (error.issues[0]?.message ?? "בדקי את הקלט") : error instanceof Error ? error.message : "משהו השתבש",
});

const startSchema = z.object({
  minutes: z.number().int().min(5).max(480),
  available: z.array(z.enum(FILMING_RESOURCES.map((r) => r.key) as [string, ...string[]])).min(1, "סמני מה יש לך היום"),
});

/** Plans on the server from the live list (never trusts a plan sent by the browser) and saves it. */
export async function startFilmingSession(input: z.input<typeof startSchema>): Promise<Result<{ id: string }>> {
  try {
    const clean = startSchema.parse(input);
    const studio = await getStudio();
    const { supabase, workspace, userId } = studio;
    const { candidates } = await loadFilmCandidates(studio);
    const plan = planFilmingDay(candidates, clean.minutes, clean.available as never);
    if (!plan.looks.length) return { ok: false, error: "עם מה שסימנת אין מה לצלם. נסי להוסיף זמן או מקום." };

    // one open session at a time: an unfinished one is closed, not deleted
    await supabase.from("filming_sessions").update({ completed_at: new Date().toISOString() }).eq("workspace_id", workspace.id).is("completed_at", null);
    const { data, error } = await supabase
      .from("filming_sessions")
      .insert({ workspace_id: workspace.id, minutes: clean.minutes, available: clean.available, plan: plan.looks as never, created_by: userId })
      .select("id")
      .single();
    if (error) throw error;
    const items = plan.looks.flatMap((look) => look.shots.map((shot, position) => ({ workspace_id: workspace.id, session_id: data.id, content_id: shot.id, look_number: look.number, position })));
    const { error: itemsError } = await supabase.from("filming_session_items").insert(items);
    if (itemsError) throw itemsError;
    revalidatePath("/filming");
    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return fail(error);
  }
}

/** Checking a shot marks the content as filmed; unchecking puts it back in line. */
export async function markShot(sessionId: string, contentId: string, done: boolean): Promise<Result> {
  try {
    z.uuid().parse(sessionId);
    z.uuid().parse(contentId);
    const { supabase, workspace } = await getStudio();
    const { error } = await supabase
      .from("filming_session_items")
      .update({ done_at: done ? new Date().toISOString() : null })
      .eq("workspace_id", workspace.id)
      .eq("session_id", sessionId)
      .eq("content_id", contentId);
    if (error) throw error;
    const { error: statusError } = await supabase
      .from("content_items")
      .update({ status: done ? "filmed" : "ready_to_film" })
      .eq("workspace_id", workspace.id)
      .eq("id", contentId)
      .in("status", done ? ["ready_to_film"] : ["filmed"]);
    if (statusError) throw statusError;
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function finishFilmingSession(sessionId: string): Promise<Result> {
  try {
    z.uuid().parse(sessionId);
    const { supabase, workspace } = await getStudio();
    const { error } = await supabase.from("filming_sessions").update({ completed_at: new Date().toISOString() }).eq("workspace_id", workspace.id).eq("id", sessionId);
    if (error) throw error;
    revalidatePath("/filming");
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}
