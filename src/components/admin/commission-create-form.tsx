"use client";

import { useActionState, useState } from "react";

import { createCommission } from "@/lib/admin/actions";
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
 * "Nova comissão" create form, wired to the `createCommission` server action via
 * `useActionState`. Two fields: name and slug. The slug is auto-suggested from
 * the name (lowercased, accent-stripped, hyphenated) until the user edits it
 * manually — pure UX; the server re-validates and is the authority (uniqueness,
 * shape). On success the action revalidates the list, so we render only pending
 * + error state.
 */
export function CommissionCreateForm() {
  const [state, formAction, isPending] = useActionState(
    createCommission,
    undefined,
  );

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  // Once the user types in the slug field we stop overwriting it from the name.
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
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormBanner tone="error">{state?.error}</FormBanner>

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
          hífens. Não pode ser alterado depois.
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
        {isPending ? "Criando…" : "Criar comissão"}
      </Button>
    </form>
  );
}

/**
 * Normalizes free text into a URL-safe slug: lowercased, accents stripped,
 * non-alphanumerics collapsed to single hyphens, trimmed of edge hyphens.
 * Mirrors the server's expected slug shape so the suggestion is usually
 * accepted as-is — but the server remains the validator.
 */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
