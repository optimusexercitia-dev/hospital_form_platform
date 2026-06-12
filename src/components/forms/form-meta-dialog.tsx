"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { updateFormMeta, type ActionState } from "@/lib/forms/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldLabel,
  useFieldIds,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormBanner } from "@/components/auth/form-banner";

/**
 * Edit a form's title/description (`updateFormMeta`). Form metadata stays
 * editable even when a version is published (only the version's structure is
 * frozen). On success, closes and refreshes the builder.
 */
export function FormMetaDialog({
  open,
  onOpenChange,
  formId,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  title: string;
  description: string | null;
}) {
  const [state, formAction, isPending] = useActionState<
    ActionState | undefined,
    FormData
  >(updateFormMeta, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  const titleField = useFieldIds("title", {
    hasError: Boolean(state?.fieldErrors?.title),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar formulário</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="formId" value={formId} />
          {state && !state.ok && !state.fieldErrors?.title && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <Field>
            <FieldLabel htmlFor={titleField.controlProps.id}>Título</FieldLabel>
            <Input
              {...titleField.controlProps}
              type="text"
              defaultValue={title}
              required
              autoFocus
            />
            <FieldError id={titleField.errorId}>
              {state?.fieldErrors?.title}
            </FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor="description">
              Descrição{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </FieldLabel>
            <Textarea
              id="description"
              name="description"
              defaultValue={description ?? ""}
              className="min-h-20"
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
