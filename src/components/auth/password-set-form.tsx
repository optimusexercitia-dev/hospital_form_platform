"use client";

import { useActionState, useState } from "react";

import { updatePassword } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { FormBanner } from "./form-banner";

const MIN_LENGTH = 8;

/**
 * Set-a-new-password form, wired to the `updatePassword` server action. Used by
 * both the recovery (`/redefinir-senha`) and invite (`/convite`) flows — they
 * differ only in copy, handled by the page, not here. On success the action
 * redirects to `/`, so this only renders pending + error state.
 *
 * The client-side match/length hints are pure UX; the server action is the
 * authority and re-validates everything.
 */
export function PasswordSetForm({ submitLabel }: { submitLabel: string }) {
  const [state, formAction, isPending] = useActionState(
    updatePassword,
    undefined,
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // Live hint only — never blocks submit; the server decides.
  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;

  const passwordField = useFieldIds("password", {
    hasError: Boolean(state?.fieldErrors?.password),
    hasDescription: true,
  });
  const confirmField = useFieldIds("confirmPassword", {
    hasError: Boolean(state?.fieldErrors?.confirmPassword) || mismatch,
  });

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormBanner tone="error">{state?.error}</FormBanner>

      <Field>
        <FieldLabel htmlFor={passwordField.controlProps.id}>
          Nova senha
        </FieldLabel>
        <Input
          {...passwordField.controlProps}
          type="password"
          autoComplete="new-password"
          autoFocus
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FieldDescription id={passwordField.descriptionId}>
          Use ao menos {MIN_LENGTH} caracteres.
        </FieldDescription>
        <FieldError id={passwordField.errorId}>
          {state?.fieldErrors?.password ??
            (tooShort
              ? `A senha deve ter pelo menos ${MIN_LENGTH} caracteres.`
              : undefined)}
        </FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor={confirmField.controlProps.id}>
          Confirme a nova senha
        </FieldLabel>
        <Input
          {...confirmField.controlProps}
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <FieldError id={confirmField.errorId}>
          {state?.fieldErrors?.confirmPassword ??
            (mismatch ? "As senhas não coincidem." : undefined)}
        </FieldError>
      </Field>

      <Button
        type="submit"
        size="lg"
        className="mt-1 w-full"
        disabled={isPending}
      >
        {isPending ? "Salvando…" : submitLabel}
      </Button>
    </form>
  );
}
