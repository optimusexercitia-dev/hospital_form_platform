"use client";

import { useActionState, useState } from "react";

import { createHospital } from "@/lib/org/actions";
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
 * "Novo hospital" create form for the org-admin area, wired to the org-scoped
 * `createHospital` server action (the org_admin's own session; RLS is the
 * authority). The organization is fixed to the one in the URL — passed as a
 * hidden `organizationId` (no selector). Slug is auto-suggested from the name
 * until edited; the server re-validates (unique per org) and is the authority.
 */
export function OrgHospitalCreateForm({
  organizationId,
}: {
  organizationId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createHospital,
    undefined,
  );

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const nameField = useFieldIds("name", {
    hasError: Boolean(state?.fieldErrors?.name),
  });
  const slugField = useFieldIds("slug", {
    hasError: Boolean(state?.fieldErrors?.slug),
    hasDescription: true,
  });

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="organizationId" value={organizationId} />
      <FormBanner tone="error">{state?.error}</FormBanner>

      <Field>
        <FieldLabel htmlFor={nameField.controlProps.id}>Nome</FieldLabel>
        <Input
          {...nameField.controlProps}
          type="text"
          autoComplete="off"
          placeholder="Ex.: Hospital Central"
          required
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
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
          {...slugField.controlProps}
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="hospital-central"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
        />
        <FieldDescription id={slugField.descriptionId}>
          Apenas letras minúsculas, números e hífens. Único dentro da
          organização.
        </FieldDescription>
        <FieldError id={slugField.errorId}>
          {state?.fieldErrors?.slug}
        </FieldError>
      </Field>

      <Button
        type="submit"
        size="lg"
        className="mt-1 self-start"
        disabled={isPending}
      >
        {isPending ? "Criando…" : "Criar hospital"}
      </Button>
    </form>
  );
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
