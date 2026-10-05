import type { Metadata } from "next";
import { Wordmark } from "@/components/shell/wordmark";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "כניסה" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <Wordmark size="lg" className="mb-10" />
      <h1 className="font-display text-2xl text-ink">היי, טוב שחזרת.</h1>
      <p className="mt-1 text-sm text-graphite">הסטודיו פרטי. נכנסים עם המייל והסיסמה.</p>
      <LoginForm next={next} />
    </main>
  );
}
