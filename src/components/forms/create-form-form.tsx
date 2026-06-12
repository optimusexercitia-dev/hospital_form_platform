"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { createForm, type CreateFormState } from "@/lib/forms/actions";
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
 * "Novo formulário" create flow. Wires the `createForm` server action via
 * `useActionState`; on success the action returns the new `{ formId }`, and we
 * navigate straight into the builder (a brand-new form opens on its v1 draft +
 * default section). Authorization is re-verified server-side in the action.
 */
export function CreateFormForm({ commissionId }: { commissionId: string }) {
  const [state, formAction, isPending] = useActionState<
    CreateFormState | undefined,
    FormData
  >(createForm, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok && state.formId) {
      // The created form's builder lives under the same commission slug; the
      // server action already revalidated the list. Navigate in.
      router.push(`./forms/${state.formId}`);
    }
  }, [state, router]);

  const titleField = useFieldIds("title", {
    hasError: Boolean(state?.fieldErrors?.title),
  });
  const descriptionField = useFieldIds("description", { hasDescription: true });

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="commissionId" value={commissionId} />

      {/* On a non-field error the action returns { ok:false, error }. Success is
          handled by navigation above, so no success banner is needed here. */}
      {state && !state.ok && !state.fieldErrors?.title && (
        <FormBanner tone="error">{state.error}</FormBanner>
      )}

      <Field>
        <FieldLabel htmlFor={titleField.controlProps.id}>
          Título do formulário
        </FieldLabel>
        <Input
          {...titleField.controlProps}
          type="text"
          placeholder="Ex.: Checklist de Controle de Infecção"
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
          placeholder="Para que serve este formulário?"
          className="min-h-20"
        />
        <FieldDescription id={descriptionField.descriptionId}>
          Você poderá editar o título e a descrição depois.
        </FieldDescription>
      </Field>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Criando…" : "Criar formulário"}
        </Button>
      </div>
    </form>
  );
}
