"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { completeOnboarding, type OnboardingResult } from "@/lib/onboarding/actions";
import { Wordmark } from "@/components/shell/wordmark";
import { Button } from "@/components/ui/button";

export function Welcome() {
  const router = useRouter();
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    completeOnboarding().then(setResult);
  }, []);

  useEffect(() => {
    if (result?.ok) {
      const timer = setTimeout(() => router.replace("/"), result.planDays ? 2600 : 1600);
      return () => clearTimeout(timer);
    }
  }, [result, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="motion-safe:animate-[rise_600ms_var(--ease-out-soft)_both]">
        <Wordmark size="lg" />
      </div>
      <p className="mt-12 font-display text-3xl leading-snug text-ink motion-safe:animate-[rise_700ms_var(--ease-out-soft)_300ms_both]">
        היי.
        <br />
        בואי נסדר לך את כל התוכן במקום אחד.
      </p>
      <div className="mt-8 min-h-24" aria-live="polite">
        {!result && <p className="text-sm text-graphite">מכינה את הסטודיו…</p>}
        {result?.ok && result.planDays > 0 && (
          <p className="text-lg text-ink motion-safe:animate-[rise_500ms_var(--ease-out-soft)_both]">
            <span className="highlighted">כבר מחכים לך כאן {result.planDays} ימי תוכן.</span>
          </p>
        )}
        {result?.ok && (
          <Button variant="primary" size="lg" className="mt-6" onClick={() => router.replace("/")}>
            למה מעלים היום
          </Button>
        )}
        {result && !result.ok && (
          <div>
            <p className="text-sm text-danger">{result.error}</p>
            <Button className="mt-4" onClick={() => { started.current = false; setResult(null); completeOnboarding().then(setResult); }}>
              לנסות שוב
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
