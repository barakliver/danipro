"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email("כתובת המייל לא נראית תקינה"),
  password: z.string().min(6, "הסיסמה קצרה מדי"),
  next: z.string().optional(),
});

export type LoginState = { error: string | null; email?: string };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    next: formData.get("next") ? String(formData.get("next")) : undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "בדקי את הפרטים", email: String(formData.get("email") ?? "") };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return { error: "המייל או הסיסמה לא נכונים.", email: parsed.data.email };

  // only same-site relative paths, never an open redirect
  const next = parsed.data.next && parsed.data.next.startsWith("/") && !parsed.data.next.startsWith("//") ? parsed.data.next : "/";
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
