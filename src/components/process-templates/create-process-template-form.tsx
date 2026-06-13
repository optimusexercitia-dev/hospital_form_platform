"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  createProcessTemplate,
  type CreateTemplateState,
} from "@/lib/process-templates/actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormBanner } from "@/components/auth/form-banner";

/**
 * "Novo processo" create flow. Wires the `createProcessTemplate` server action
 * via `useActionState`; on success the action returns the new `{ templateId }`,
 * and we navigate straight into the builder. Authorization is re-verified
 * server-side in the action. Mirrors {@link CreateFormForm}.
 */
export function CreateProcessTemplateForm({
  commissionId,
}: {
  commissionId: string;
}) {
  const [state, formAction, isPending] = useActionState<
    CreateTemplateState | undefined,
    FormData
  >(createProcessTemplate, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok && state.templateId) {
      router.push(`./process-templates/${state.templateId}`);
    }
  }, [state, router]);

  const titleField = useFieldIds("title", {
    hasError: Boolean(state?.fieldErrors?.title),
  });
  const descriptionField = useFieldIds("description", { hasDescription: true });

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="commissionId" value={commissionId} />

      {state && !state.ok && !state.fieldErrors?.title && (
        <FormBanner tone="error">{state.error}</FormBanner>
      )}

      <Field>
        <FieldLabel htmlFor={titleField.controlProps.id}>
          Título do processo
        </FieldLabel>
        <Input
          {...titleField.controlProps}
          type="text"
          placeholder="Ex.: Investigação de Óbito (M&M)"
          required
          autoFocus
        />
        <FieldError id={titleField.errorId}>
          {state?.fieldErrors?.title}
        </FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor={descriptionField.controlProps.id}>
          Descrição{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </FieldLabel>
        <Textarea
          {...descriptionField.controlProps}
          placeholder="Para que serve este processo? Não inclua dados de paciente."
          className="min-h-20"
        />
        <FieldDescription id={descriptionField.descriptionId}>
          Você poderá editar o título e a descrição depois.
        </FieldDescription>
      </Field>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Criando…" : "Criar processo"}
        </Button>
      </div>
    </form>
  );
}
