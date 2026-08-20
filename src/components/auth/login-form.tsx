"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

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
 *
 * Motion: the banner + fields reveal with a staggered CSS entrance
 * (`animate-rise-in` + `--rise-delay`), which collapses under
 * `prefers-reduced-motion` via the global rule. All motion is decorative;
 * the form is fully interactive from first paint.
 */
export function LoginForm({ redirect }: { redirect?: string }) {
  const [state, formAction, isPending] = useActionState(signIn, undefined);
  const [showPassword, setShowPassword] = useState(false);

  const emailField = useFieldIds("email", {
    nameRequiredFor: "formData",
    hasError: Boolean(state?.fieldErrors?.email),
  });
  const passwordField = useFieldIds("password", {
    nameRequiredFor: "formData",
    hasError: Boolean(state?.fieldErrors?.password),
  });

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {/* Forwarded to the action and re-validated server-side (open-redirect
          guard); only same-origin paths survive. */}
      {redirect ? <input type="hidden" name="redirect" value={redirect} /> : null}

      {state?.error ? (
        <div
          className="animate-rise-in"
          style={{ ["--rise-delay" as string]: "0ms" }}
        >
          <FormBanner tone="error">{state.error}</FormBanner>
        </div>
      ) : null}

      <Field
        className="animate-rise-in"
        style={{ ["--rise-delay" as string]: "120ms" }}
      >
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

      <Field
        className="animate-rise-in"
        style={{ ["--rise-delay" as string]: "200ms" }}
      >
        <div className="flex items-baseline justify-between gap-2">
          <FieldLabel htmlFor={passwordField.controlProps.id}>Senha</FieldLabel>
          <Link
            href="/recuperar-senha"
            className="rounded-sm text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            Esqueci minha senha
          </Link>
        </div>
        {/* Password + inline reveal toggle. The toggle sits inside the field so
            the visible focus ring still wraps the whole control. */}
        <div className="relative">
          <Input
            {...passwordField.controlProps}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="pr-11"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        <FieldError id={passwordField.errorId}>
          {state?.fieldErrors?.password}
        </FieldError>
      </Field>

      <Button
        type="submit"
        size="lg"
        className="animate-rise-in mt-1 h-11 w-full text-base shadow-xs transition-all hover:shadow-sm active:translate-y-px"
        style={{ ["--rise-delay" as string]: "280ms" }}
        disabled={isPending}
      >
        {isPending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

/** Eye — "show password". Decorative; the button carries the accessible label. */
function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4.5"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Eye-off — "hide password". */
function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4.5"
      aria-hidden="true"
    >
      <path d="M10.7 5.1A9.9 9.9 0 0 1 12 5c6.5 0 10 7 10 7a15.8 15.8 0 0 1-3.4 4.3M6.6 6.6A15.8 15.8 0 0 0 2 12s3.5 7 10 7a9.9 9.9 0 0 0 4.2-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m2 2 20 20" />
    </svg>
  );
}
