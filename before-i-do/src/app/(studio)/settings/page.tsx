import type { Metadata } from "next";
import { getStudio } from "@/lib/auth/studio";
import { providerStatus } from "@/lib/ai/actions";
import { readBundledPlan } from "@/lib/import/bundled-plan";
import { parseDesignSettings } from "@/lib/render/design-settings";
import { todayISO } from "@/lib/utils/dates";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "הגדרות" };

export default async function SettingsPage() {
  const studio = await getStudio();
  const { supabase, workspace, userId, email, role } = studio;
  const [members, invites, plan, provider, bundled] = await Promise.all([
    supabase.from("workspace_members").select("user_id, role, created_at").eq("workspace_id", workspace.id).order("created_at"),
    supabase.from("workspace_invites").select("id, email, accepted_at, created_at").eq("workspace_id", workspace.id).order("created_at"),
    supabase.from("content_calendar").select("scheduled_on").eq("workspace_id", workspace.id).eq("plan_day", 1).order("scheduled_on").limit(1).maybeSingle(),
    providerStatus(),
    readBundledPlan(),
  ]);
  if (members.error) throw members.error;
  if (invites.error) throw invites.error;

  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", members.data.map((m) => m.user_id));
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  return (
    <SettingsView
      settings={parseDesignSettings(workspace.design_settings)}
      account={{ email, role }}
      members={members.data.map((m) => ({ id: m.user_id, name: m.user_id === userId ? "החשבון הזה" : (names.get(m.user_id) ?? "חבר/ה בסטודיו"), role: m.role }))}
      invites={invites.data}
      provider={provider}
      plan={{ startDate: plan.data?.scheduled_on ?? null, bundled: Boolean(bundled), today: todayISO() }}
    />
  );
}
