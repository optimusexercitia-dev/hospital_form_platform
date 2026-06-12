"use client";

import { useActionState, useEffect, useRef } from "react";

import { assignStaffAdmin, removeStaffAdmin } from "@/lib/admin/actions";
import type { StaffAdminSummary } from "@/lib/queries/commissions";
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

import { ConfirmRemoveButton } from "./confirm-remove-button";

/**
 * Manages a commission's coordinators (staff_admins): an assign-by-email form
 * (existing user, or a new one invited by the action server-side) plus the
 * current roster, each row with a guarded "remover" control.
 *
 * Both mutations are `useActionState`-shaped server actions. The roster itself
 * is passed in (read on the server, RLS-scoped); on success the actions
 * revalidate the page and the props refresh.
 */
export function StaffAdminManager({
  commissionId,
  staffAdmins,
}: {
  commissionId: string;
  staffAdmins: StaffAdminSummary[];
}) {
  const [state, formAction, isPending] = useActionState(
    assignStaffAdmin,
    undefined,
  );
  const formRef = useRef<HTMLFormElement | null>(null);

  // Clear the email input after a successful assignment so the form is ready
  // for the next one and doesn't re-show the just-added address.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state?.ok]);

  const emailField = useFieldIds("email", {
    hasError: Boolean(state?.fieldErrors?.email),
    hasDescription: true,
  });

  return (
    <div className="flex flex-col gap-6">
      <form
        ref={formRef}
        action={formAction}
        className="flex flex-col gap-4"
        noValidate
      >
        <input type="hidden" name="commissionId" value={commissionId} />

        {/* On success the action returns { ok: true, error: <pt-BR success
            message> } — prefer that authoritative copy, falling back to a
            default that also notes the invite-if-new behavior. */}
        {state?.ok ? (
          <FormBanner tone="success">
            {state.error ??
              "Coordenação atualizada. Se a pessoa ainda não tinha conta, enviamos um convite por e-mail."}
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
              placeholder="coordenador@hospital.org.br"
              required
              className="sm:flex-1"
            />
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Atribuindo…" : "Atribuir coordenação"}
            </Button>
          </div>
          <FieldDescription id={emailField.descriptionId}>
            Se a pessoa ainda não tiver conta, ela receberá um convite por
            e-mail.
          </FieldDescription>
          <FieldError id={emailField.errorId}>
            {state?.fieldErrors?.email}
          </FieldError>
        </Field>
      </form>

      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Coordenadores atuais
        </h3>
        {staffAdmins.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            Esta comissão ainda não tem coordenadores.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {staffAdmins.map((person) => {
              const displayName =
                person.fullName?.trim() || person.email || "Sem identificação";
              // Show the e-mail as a secondary line only when it isn't already
              // the primary display name.
              const showEmail = Boolean(
                person.email && person.fullName?.trim(),
              );
              return (
                <li
                  key={person.userId}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {displayName}
                    </p>
                    {showEmail ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {person.email}
                      </p>
                    ) : null}
                  </div>
                  <ConfirmRemoveButton
                    action={removeStaffAdmin}
                    hiddenFields={{ commissionId, userId: person.userId }}
                    triggerLabel="Remover"
                    triggerAriaLabel={`Remover ${displayName} da coordenação`}
                    title="Remover coordenação?"
                    description={`${displayName} deixará de coordenar esta comissão. Esta ação pode ser refeita atribuindo a coordenação novamente.`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
