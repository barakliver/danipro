"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, { error: null });
  return (
    <form action={action} className="mt-8 flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="מייל">
        {(props) => (
          <Input {...props} name="email" type="email" inputMode="email" autoComplete="email" dir="ltr" required defaultValue={state.email} className="text-start" />
        )}
      </Field>
      <Field label="סיסמה" error={state.error}>
        {(props) => <Input {...props} name="password" type="password" autoComplete="current-password" dir="ltr" required className="text-start" />}
      </Field>
      <Button type="submit" variant="primary" size="lg" pending={pending} className="mt-2">
        {pending ? "נכנסים…" : "כניסה"}
      </Button>
    </form>
  );
}
