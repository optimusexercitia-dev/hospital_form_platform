"use client";

import { useActionState, useEffect, useRef } from "react";

import { inviteStaff } from "@/lib/members/actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormBanner } from "@/components/auth/form-banner";

/**
 * Invite a staff member to the commission by e-mail, wired to the `inviteStaff`
 * server action via `useActionState`. The action (service-role, server-side)
 * looks up or invites the user and adds the membership; authorization is
 * re-verified server-side. On success it revalidates the member list and shows a
 * confirmation banner.
 */
export function InviteStaffForm({
  commissionId,
}: {
  commissionId: string;
}) {
  const [state, formAction, isPending] = useActionState(inviteStaff, undefined);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state?.ok]);

  const emailField = useFieldIds("email", {
    hasError: Boolean(state?.fieldErrors?.email),
    hasDescription: true,
  });

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4"
      noValidate
    >
      <input type="hidden" name="commissionId" value={commissionId} />

      {/* On success the action returns { ok: true, error: <pt-BR success
          message> } — prefer that authoritative copy, falling back to a default. */}
      {state?.ok ? (
        <FormBanner tone="success">
          {state.error ??
            "Convite enviado. A pessoa receberá um e-mail para acessar a comissão."}
        </FormBanner>
      ) : (
        <FormBanner tone="error">{state?.error}</FormBanner>
      )}

      <Field>
        <FieldLabel htmlFor={emailField.controlProps.id}>
          E-mail da pessoa
        </FieldLabel>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            {...emailField.controlProps}
            type="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="membro@hospital.org.br"
            required
            className="sm:flex-1"
          />
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? "Convidando…" : "Convidar membro"}
          </Button>
        </div>
        <FieldDescription id={emailField.descriptionId}>
          Se a pessoa ainda não tiver conta, ela receberá um convite por e-mail.
        </FieldDescription>
        <FieldError id={emailField.errorId}>
          {state?.fieldErrors?.email}
        </FieldError>
      </Field>
    </form>
  );
}
