import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: Promise<SupabaseClient> | null = null;

/**
 * A Supabase client signed in as the E2E user, for test setup and cleanup.
 * Row level security keeps it inside the E2E workspace, so tests can never touch real content.
 */
export function db(): Promise<SupabaseClient> {
  client ??= (async () => {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const { error } = await sb.auth.signInWithPassword({ email: process.env.E2E_EMAIL!, password: process.env.E2E_PASSWORD! });
    if (error) throw error;
    return sb;
  })();
  return client;
}

export async function workspaceId(): Promise<string> {
  const sb = await db();
  const { data, error } = await sb.from("workspace_members").select("workspace_id").limit(1).single();
  if (error) throw error;
  return data.workspace_id as string;
}

/** Remembers a content item's status and schedule so a test can put it back. */
export async function snapshotContent(id: string) {
  const sb = await db();
  const { data, error } = await sb.from("content_items").select("status, published_at, hook").eq("id", id).single();
  if (error) throw error;
  return async () => {
    await sb.from("content_items").update(data).eq("id", id);
  };
}
