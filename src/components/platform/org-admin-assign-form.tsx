"use client";

import { useActionState, useEffect, useRef } from "react";

import { assignOrgAdmin } from "@/lib/platform/actions";
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

import type { OrgOption } from "./hospital-create-form";

/**
 * Seats an org_admin on an organization BY EMAIL (platform_admin / vendor). The
 * action resolves an existing user or invites a new one, then upserts the
 * `organization_members` row with `role = 'org_admin'`. Mirrors the
 * staff-admin assign-by-email pattern. The email input clears after a successful
 * assignment so the form is ready for the next one.
 */
export function OrgAdminAssignForm({
  organizations,
}: {
  organizations: OrgOption[];
}) {
  const [state, formAction, isPending] = useActionState(
    assignOrgAdmin,
    undefined,
  );
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state?.ok]);

  const orgField = useFieldIds("organizationId", {
    hasError: Boolean(state?.fieldErrors?.organizationId),
  });
  const emailField = useFieldIds("email", {
    hasError: Boolean(state?.fieldErrors?.email),
    hasDescription: true,
  });

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-5"
      noValidate
    >
      {state?.ok && state.error ? (
        <FormBanner tone="success">{state.error}</FormBanner>
      ) : (
        <FormBanner tone="error">{state?.error}</FormBanner>
      )}

      <Field>
        <FieldLabel htmlFor={orgField.controlProps.id}>Organização</FieldLabel>
        <select
          {...orgField.controlProps}
          required
          defaultValue=""
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          <option value="" disabled>
            Selecione uma organização
          </option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <FieldError id={orgField.errorId}>
          {state?.fieldErrors?.organizationId}
        </FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor={emailField.controlProps.id}>E-mail</FieldLabel>
        <Input
          {...emailField.controlProps}
          type="email"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="pessoa@hospital.org"
          required
        />
        <FieldDescription id={emailField.descriptionId}>
          Se ainda não houver conta, um convite será enviado para este e-mail.
        </FieldDescription>
        <FieldError id={emailField.errorId}>
          {state?.fieldErrors?.email}
        </FieldError>
      </Field>

      <Button
        type="submit"
        size="lg"
        className="mt-1 self-start"
        disabled={isPending || organizations.length === 0}
      >
        {isPending ? "Atribuindo…" : "Atribuir administrador"}
      </Button>
    </form>
  );
}
