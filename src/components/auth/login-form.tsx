"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signIn } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { FormBanner } from "./form-banner";

/**
 * Accessible email/password sign-in form wired to the `signIn` server action
 * via `useActionState`. On success the action performs a server redirect to the
 * (server-validated) `redirect` path, so this component only ever renders
 * pending + error state — it never receives an `ok: true`.
 */
export function LoginForm({ redirect }: { redirect?: string }) {
  const [state, formAction, isPending] = useActionState(signIn, undefined);

  const emailField = useFieldIds("email", {
    hasError: Boolean(state?.fieldErrors?.email),
  });
  const passwordField = useFieldIds("password", {
    hasError: Boolean(state?.fieldErrors?.password),
  });

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {/* Forwarded to the action and re-validated server-side (open-redirect
          guard); only same-origin paths survive. */}
      {redirect ? <input type="hidden" name="redirect" value={redirect} /> : null}

      <FormBanner tone="error">{state?.error}</FormBanner>

      <Field>
        <FieldLabel htmlFor={emailField.controlProps.id}>E-mail</FieldLabel>
        <Input
          {...emailField.controlProps}
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          placeholder="voce@hospital.org.br"
          required
        />
        <FieldError id={emailField.errorId}>
          {state?.fieldErrors?.email}
        </FieldError>
      </Field>

      <Field>
        <div className="flex items-baseline justify-between gap-2">
          <FieldLabel htmlFor={passwordField.controlProps.id}>Senha</FieldLabel>
          <Link
            href="/recuperar-senha"
            className="rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            Esqueci minha senha
          </Link>
        </div>
        <Input
          {...passwordField.controlProps}
          type="password"
          autoComplete="current-password"
          required
        />
        <FieldError id={passwordField.errorId}>
          {state?.fieldErrors?.password}
        </FieldError>
      </Field>

      <Button type="submit" size="lg" className="mt-1 w-full" disabled={isPending}>
        {isPending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
