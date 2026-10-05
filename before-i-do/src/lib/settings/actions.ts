"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { z } from "zod";
import { getStudio } from "@/lib/auth/studio";
import { applyPlan, type ApplyResult } from "@/lib/import/apply-plan";
import { readBundledPlan } from "@/lib/import/bundled-plan";
import { parsePlan } from "@/lib/import/plan-parser";
import { readWorkbook } from "@/lib/import/read-workbook";
import { designSettingsSchema, parseDesignSettings } from "@/lib/render/design-settings";
import { addDays } from "@/lib/utils/dates";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: unknown): { ok: false; error: string } => ({
  ok: false,
  error: error instanceof z.ZodError ? (error.issues[0]?.message ?? "בדקי את הערכים") : error instanceof Error ? error.message : "משהו השתבש",
});

async function writeSettings(next: unknown) {
  const studio = await getStudio();
  const { error } = await studio.supabase.from("workspaces").update({ design_settings: next as never }).eq("id", studio.workspace.id);
  if (error) throw error;
  revalidatePath("/", "layout");
}

/** Saves design tokens. The logo is managed separately and always kept. */
export async function saveDesignSettings(input: unknown): Promise<Result> {
  try {
    const studio = await getStudio();
    const current = parseDesignSettings(studio.workspace.design_settings);
    const next = designSettingsSchema.parse({ ...(input as object), logo: current.logo, logoPath: current.logoPath });
    await writeSettings(next);
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function resetDesignSettings(): Promise<Result> {
  try {
    const studio = await getStudio();
    const current = parseDesignSettings(studio.workspace.design_settings);
    await writeSettings(designSettingsSchema.parse({ logo: current.logo, logoPath: current.logoPath }));
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/** Any image in, a small transparent PNG out (SVGs are rasterised, so nothing executable is stored). */
export async function uploadLogo(formData: FormData): Promise<Result> {
  try {
    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "לא נבחר קובץ" };
    if (file.size > MAX_LOGO_BYTES) return { ok: false, error: "הקובץ גדול מדי (עד 5MB)" };
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) return { ok: false, error: "צריך PNG, JPG, WEBP או SVG" };
    const png = await sharp(Buffer.from(await file.arrayBuffer()), { density: 300 })
      .trim()
      .resize({ height: 160, width: 720, fit: "inside", withoutEnlargement: false })
      .png({ compressionLevel: 9 })
      .toBuffer();
    const studio = await getStudio();
    const current = parseDesignSettings(studio.workspace.design_settings);
    await writeSettings({ ...current, logo: `data:image/png;base64,${png.toString("base64")}` });
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function removeLogo(): Promise<Result> {
  try {
    const studio = await getStudio();
    await writeSettings({ ...parseDesignSettings(studio.workspace.design_settings), logo: null });
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

const MAX_WORKBOOK_BYTES = 20 * 1024 * 1024;

/** Imports the bundled plan or an uploaded workbook. Existing pieces are never duplicated or overwritten. */
export async function importPlan(formData: FormData): Promise<Result<ApplyResult & { days: number }>> {
  try {
    const startDate = z.iso.date("תאריך לא תקין").parse(formData.get("startDate"));
    const file = formData.get("file");
    let data: Uint8Array | ArrayBuffer | null;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_WORKBOOK_BYTES) return { ok: false, error: "הקובץ גדול מדי" };
      if (!file.name.toLowerCase().endsWith(".xlsx")) return { ok: false, error: "צריך קובץ xlsx" };
      data = await file.arrayBuffer();
    } else {
      data = await readBundledPlan();
      if (!data) return { ok: false, error: "קובץ התוכנית לא נמצא. אפשר להעלות אותו כאן." };
    }
    const plan = parsePlan(await readWorkbook(data));
    if (!plan.content.length) return { ok: false, error: "לא מצאתי בקובץ ימי תוכן. זה הקובץ הנכון?" };
    const result = await applyPlan(await getStudio(), plan, startDate);
    revalidatePath("/", "layout");
    return { ok: true, data: { ...result, days: plan.report.days } };
  } catch (error) {
    return fail(error);
  }
}

/** Moves the whole 60-day plan so day 1 lands on a new date. Published pieces stay where they were. */
export async function shiftPlan(startDate: string): Promise<Result<{ moved: number }>> {
  try {
    z.iso.date("תאריך לא תקין").parse(startDate);
    const { supabase, workspace } = await getStudio();
    const { data, error } = await supabase
      .from("content_calendar")
      .select("id, plan_day, content:content_items!inner(status)")
      .eq("workspace_id", workspace.id)
      .not("plan_day", "is", null);
    if (error) throw error;
    const rows = data.filter((r) => (Array.isArray(r.content) ? r.content[0] : r.content)?.status !== "published");
    for (let i = 0; i < rows.length; i += 25) {
      const batch = rows.slice(i, i + 25);
      const results = await Promise.all(
        batch.map((r) => supabase.from("content_calendar").update({ scheduled_on: addDays(startDate, (r.plan_day as number) - 1) }).eq("workspace_id", workspace.id).eq("id", r.id)),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    }
    revalidatePath("/", "layout");
    return { ok: true, data: { moved: rows.length } };
  } catch (error) {
    return fail(error);
  }
}

export async function inviteMember(email: string): Promise<Result> {
  try {
    const clean = z.email("כתובת מייל לא תקינה").parse(email.trim().toLowerCase());
    const { supabase, workspace, role, userId } = await getStudio();
    if (role !== "owner") return { ok: false, error: "רק הבעלים יכולים להזמין" };
    const { error } = await supabase.from("workspace_invites").upsert({ workspace_id: workspace.id, email: clean, role: "editor", invited_by: userId }, { onConflict: "workspace_id,email" });
    if (error) throw error;
    revalidatePath("/settings");
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function cancelInvite(id: string): Promise<Result> {
  try {
    z.uuid().parse(id);
    const { supabase, workspace, role } = await getStudio();
    if (role !== "owner") return { ok: false, error: "רק הבעלים יכולים לבטל" };
    const { error } = await supabase.from("workspace_invites").delete().eq("workspace_id", workspace.id).eq("id", id).is("accepted_at", null);
    if (error) throw error;
    revalidatePath("/settings");
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}

export async function changePassword(password: string): Promise<Result> {
  try {
    const clean = z.string().min(10, "לפחות 10 תווים").max(200).parse(password);
    const { supabase } = await getStudio();
    const { error } = await supabase.auth.updateUser({ password: clean });
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (error) {
    return fail(error);
  }
}
