"use client";

import { useActionState, useState } from "react";

import { createCommission } from "@/lib/org/actions";
import type { HospitalSummary } from "@/lib/queries/org";
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
 * "Nova comissão" create form for the org-admin area, wired to the org-scoped
 * `createCommission(hospitalId, name, slug)` action — the org is auto-derived
 * from the chosen hospital by the DB trigger, so the form picks a HOSPITAL (not
 * an org). When the org has no hospitals yet, the submit is disabled with a hint
 * to create one first. Slug is auto-suggested from the name until edited; the
 * server re-validates (unique per org) and is the authority.
 */
export function OrgCommissionCreateForm({
  hospitals,
}: {
  hospitals: HospitalSummary[];
}) {
  const [state, formAction, isPending] = useActionState(
    createCommission,
    undefined,
  );

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const hospitalField = useFieldIds("hospitalId", {
    hasError: Boolean(state?.fieldErrors?.hospitalId),
    hasDescription: hospitals.length === 0,
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

  const noHospitals = hospitals.length === 0;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormBanner tone="error">{state?.error}</FormBanner>

      <Field>
        <FieldLabel htmlFor={hospitalField.controlProps.id}>
          Hospital
        </FieldLabel>
        <select
          {...hospitalField.controlProps}
          required
          defaultValue=""
          disabled={noHospitals}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-60"
        >
          <option value="" disabled>
            {noHospitals
              ? "Nenhum hospital cadastrado"
              : "Selecione um hospital"}
          </option>
          {hospitals.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        {noHospitals ? (
          <FieldDescription id={hospitalField.descriptionId}>
            Cadastre um hospital antes de criar uma comissão.
          </FieldDescription>
        ) : null}
        <FieldError id={hospitalField.errorId}>
          {state?.fieldErrors?.hospitalId}
        </FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor={nameField.controlProps.id}>Nome</FieldLabel>
        <Input
          {...nameField.controlProps}
          type="text"
          autoComplete="off"
          placeholder="Ex.: Comissão de Controle de Infecção"
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
          placeholder="controle-de-infeccao"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
        />
        <FieldDescription id={slugField.descriptionId}>
          Usado no endereço da comissão. Apenas letras minúsculas, números e
          hífens. Único dentro da organização.
        </FieldDescription>
        <FieldError id={slugField.errorId}>
          {state?.fieldErrors?.slug}
        </FieldError>
      </Field>

      <Button
        type="submit"
        size="lg"
        className="mt-1 self-start"
        disabled={isPending || noHospitals}
      >
        {isPending ? "Criando…" : "Criar comissão"}
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
