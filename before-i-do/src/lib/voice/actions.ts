"use server";

import { z } from "zod";
import { getStudio } from "@/lib/auth/studio";
import { FEEDBACK_KINDS, type FeedbackKind } from "@/lib/domain/constants";

/** Every "זה אנחנו" / "לא אנחנו" / "יותר אישי" tap is kept, so future generations learn our taste. */
export async function recordFeedback(input: { contentId?: string; generationId?: string; kind: FeedbackKind; text?: string; note?: string }) {
  try {
    const clean = z
      .object({
        contentId: z.uuid().optional(),
        generationId: z.uuid().optional(),
        kind: z.enum(FEEDBACK_KINDS),
        text: z.string().max(4000).optional(),
        note: z.string().max(500).optional(),
      })
      .parse(input);
    const { supabase, workspace, userId } = await getStudio();
    const { error } = await supabase.from("content_feedback").insert({
      workspace_id: workspace.id,
      content_id: clean.contentId ?? null,
      generation_id: clean.generationId ?? null,
      kind: clean.kind,
      text_snapshot: clean.text ?? null,
      note: clean.note ?? null,
      created_by: userId,
    });
    if (error) throw error;
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "לא נשמר" };
  }
}
