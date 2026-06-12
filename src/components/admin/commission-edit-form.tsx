"use client";

import { useActionState } from "react";

import { updateCommission } from "@/lib/admin/actions";
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
 * Edit a commission's name. The slug is immutable after creation
 * (`updateCommission` is name-only), so it's shown as a read-only field to make
 * that explicit. Wired to `updateCommission` via `useActionState`; the hidden
 * `commissionId` identifies the target server-side (the visible `slug` is for
 * display only). On success the action revalidates, showing a confirmation
 * banner.
 */
export function CommissionEditForm({
  commissionId,
  slug,
  name,
}: {
  commissionId: string;
  slug: string;
  name: string;
}) {
  const [state, formAction, isPending] = useActionState(
    updateCommission,
    undefined,
  );

  const nameField = useFieldIds("name", {
    hasError: Boolean(state?.fieldErrors?.name),
  });
  const slugField = useFieldIds("slug-display", { hasDescription: true });

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {/* Identifies the commission server-side; never editable here. */}
      <input type="hidden" name="commissionId" value={commissionId} />

      {/* On success the action returns { ok: true, error: <pt-BR success
          message> } — prefer that authoritative copy, falling back to a default. */}
      {state?.ok ? (
        <FormBanner tone="success">
          {state.error ?? "Alterações salvas."}
        </FormBanner>
      ) : (
        <FormBanner tone="error">{state?.error}</FormBanner>
      )}

      <Field>
        <FieldLabel htmlFor={nameField.controlProps.id}>Nome</FieldLabel>
        <Input
          {...nameField.controlProps}
          type="text"
          autoComplete="off"
          required
          defaultValue={name}
        />
        <FieldError id={nameField.errorId}>
          {state?.fieldErrors?.name}
        </FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor={slugField.controlProps.id}>
          Identificador (slug)
        </FieldLabel>
        <Input
          id={slugField.controlProps.id}
          aria-describedby={slugField.controlProps["aria-describedby"]}
          type="text"
          value={slug}
          readOnly
          disabled
          className="opacity-70"
        />
        <FieldDescription id={slugField.descriptionId}>
          O identificador não pode ser alterado após a criação.
        </FieldDescription>
      </Field>

      <Button
        type="submit"
        size="lg"
        className="mt-1 self-start"
        disabled={isPending}
      >
        {isPending ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}
