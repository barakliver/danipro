import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

export default function NoAccessPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <Wordmark size="lg" className="mb-10" />
      <h1 className="font-display text-2xl">אין לחשבון הזה גישה לסטודיו.</h1>
      <p className="mt-2 text-sm text-graphite">הסטודיו נפתח רק למי שהוזמן. אם זו טעות, בקשי הזמנה מהבעלים של הסטודיו ואז היכנסי שוב.</p>
      <form action={signOut} className="mt-8">
        <Button type="submit">התנתקות</Button>
      </form>
    </main>
  );
}
