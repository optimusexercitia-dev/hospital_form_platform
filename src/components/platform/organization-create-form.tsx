"use client";

import { useActionState, useState } from "react";

import { createOrganization } from "@/lib/platform/actions";
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
 * "Nova organização" create form (platform_admin / vendor only), wired to the
 * `createOrganization` server action via `useActionState`. Two fields: name and
 * slug. The slug is the globally-unique `/o/[org]` route key and is
 * auto-suggested from the name until the user edits it — pure UX; the server
 * re-validates uniqueness + shape and is the authority. On success the action
 * revalidates the registry, so we render only pending + error state.
 */
export function OrganizationCreateForm() {
  const [state, formAction, isPending] = useActionState(
    createOrganization,
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
          placeholder="Ex.: Rede Hospitalar Santa Casa"
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
          placeholder="santa-casa"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
        />
        <FieldDescription id={slugField.descriptionId}>
          Usado no endereço da organização ({"/o/"}
          {slug || "identificador"}). Apenas letras minúsculas, números e
          hífens. Único em toda a plataforma.
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
        {isPending ? "Criando…" : "Criar organização"}
      </Button>
    </form>
  );
}

/**
 * Normalizes free text into a URL-safe slug — mirrors the server's expected slug
 * shape so the suggestion is usually accepted as-is. The server remains the
 * validator.
 */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
