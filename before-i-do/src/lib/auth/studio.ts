import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import type { WorkspaceRow } from "@/lib/supabase/database.types";

export type Studio = {
  supabase: ServerSupabase;
  userId: string;
  email: string | null;
  role: "owner" | "editor";
  workspace: WorkspaceRow;
};

/**
 * The signed-in user and their workspace, once per request.
 * Identity comes from getClaims() (verified JWT), never from getSession().
 */
export const getStudio = cache(async (): Promise<Studio> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");

  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select("role, workspace:workspaces(*)")
    .eq("user_id", claims.sub)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`לא הצלחנו לטעון את הסטודיו: ${error.message}`);
  if (!membership?.workspace) redirect("/no-access");

  return {
    supabase,
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    role: membership.role === "owner" ? "owner" : "editor",
    workspace: membership.workspace as WorkspaceRow,
  };
});
