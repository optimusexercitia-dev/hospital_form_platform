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
import { NativeSelect } from "@/components/ui/native-select";
import { FormBanner } from "@/components/auth/form-banner";

import type { OrgOption } from "./hospital-create-form";

/**
 * Seats an org_admin on an organization BY EMAIL (platform_admin / vendor). The
 * action resolves an existing user or invites a new one, then grants the role through
 * the `public.grant_role_for` service door (ADR 0094 W3/T3.3 — no raw `memberships`
 * DML anywhere in `src/`). Mirrors the staff-admin assign-by-email pattern. The email
 * input clears after a successful assignment so the form is ready for the next one.
 *
 * ⚠ This comment said "upserts the `organization_members` row" until 2026-08-04. That
 * table has never existed under that name (it is `memberships`), and the direct write
 * it described had already been replaced by the door — a stale assertion nothing
 * type-checks. E2E: `e2e/platform-org-admin-provisioning.spec.ts`.
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

  // ⚠ Distinct DOM id, same form key. `HospitalCreateForm` renders ABOVE this one on
  // /admin and also uses the field name `organizationId`; with `name` doubling as the
  // id that put two `id="organizationId"` elements on one page, and `htmlFor` resolves
  // to the FIRST in document order — so this section's "Organização" label pointed at
  // the HOSPITAL form's select. Clicking it moved focus into the wrong form, and a
  // screen reader announced the wrong field. `formData.get("organizationId")` in
  // `assignOrgAdmin` is unaffected: only the id changes, not the submitted name.
  const orgField = useFieldIds("organizationId", {
    hasError: Boolean(state?.fieldErrors?.organizationId),
    id: "orgAdminOrganizationId",
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
        <NativeSelect
          {...orgField.controlProps}
          required
          defaultValue=""
          className="h-10"
        >
          <option value="" disabled>
            Selecione uma organização
          </option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </NativeSelect>
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
