"use client";

import { useActionState, useState } from "react";

import { createHospital } from "@/lib/platform/actions";
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

/** Minimal org reference for the organization selector. */
export interface OrgOption {
  id: string;
  name: string;
}

/**
 * "Novo hospital" create form (platform_admin / vendor), wired to the platform
 * `createHospital` server action. Picks the parent organization, then name +
 * slug (unique per org). The slug is auto-suggested from the name until edited;
 * the server re-validates and is the authority.
 */
export function HospitalCreateForm({
  organizations,
}: {
  organizations: OrgOption[];
}) {
  const [state, formAction, isPending] = useActionState(
    createHospital,
    undefined,
  );

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const orgField = useFieldIds("organizationId", {
    hasError: Boolean(state?.fieldErrors?.organizationId),
  });
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
      <FormBanner tone="error">{state?.error}</FormBanner>

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
        disabled={isPending || organizations.length === 0}
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
