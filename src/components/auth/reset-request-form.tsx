"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestPasswordReset } from "@/lib/auth/actions";
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
 * Request-a-password-reset form. The `requestPasswordReset` action ALWAYS
 * returns `{ ok: true, error: <neutral message> }` (account-enumeration guard) —
 * so on a successful submit we show that neutral confirmation as an info banner,
 * never revealing whether the e-mail maps to an account. Field-level validation
 * (empty/invalid e-mail) comes back as `fieldErrors.email`.
 */
export function ResetRequestForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordReset,
    undefined,
  );

  const sent = state?.ok === true;
  const emailField = useFieldIds("email", {
    hasError: Boolean(state?.fieldErrors?.email),
  });

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {sent ? <FormBanner tone="info">{state?.error}</FormBanner> : null}

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

      <Button
        type="submit"
        size="lg"
        className="mt-1 w-full"
        disabled={isPending}
      >
        {isPending ? "Enviando…" : "Enviar instruções"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          Voltar para o login
        </Link>
      </p>
    </form>
  );
}
