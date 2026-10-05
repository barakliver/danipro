"use server";

import { getStudio } from "@/lib/auth/studio";
import { ensureWorkspaceDefaults } from "@/lib/seed/bootstrap";
import { readBundledPlan } from "@/lib/import/bundled-plan";
import { readWorkbook } from "@/lib/import/read-workbook";
import { parsePlan } from "@/lib/import/plan-parser";
import { applyPlan } from "@/lib/import/apply-plan";
import { todayISO } from "@/lib/utils/dates";

export type OnboardingResult = { ok: true; planDays: number } | { ok: false; error: string };

/** First run: seed the workspace, import the bundled 60-day plan (day 1 = today), mark onboarded. */
export async function completeOnboarding(): Promise<OnboardingResult> {
  try {
    const studio = await getStudio();
    await ensureWorkspaceDefaults(studio);

    let planDays = 0;
    const file = await readBundledPlan();
    if (file) {
      const plan = parsePlan(await readWorkbook(file));
      await applyPlan(studio, plan, todayISO());
      planDays = plan.report.days;
    }

    const { error } = await studio.supabase
      .from("workspaces")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", studio.workspace.id);
    if (error) throw error;
    return { ok: true, planDays };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "משהו השתבש בהכנת הסטודיו" };
  }
}
