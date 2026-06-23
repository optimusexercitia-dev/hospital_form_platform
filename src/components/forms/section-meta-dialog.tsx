"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import type { Section } from "@/lib/queries/forms";
import { updateSection, type ActionState } from "@/lib/forms/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { SectionConditionFields } from "@/components/forms/section-condition-fields";
import { SectionSignoffFields } from "@/components/forms/section-signoff-fields";

/**
 * Rename / describe a section (`updateSection`). Works for the default section
 * too (lead refinement #2): a default section may now carry a title, so its
 * title field is OPTIONAL (clearing it stores null); for non-default sections
 * the title stays required. Because `updateSection` rebuilds the section's
 * condition and sign-off from the submitted fields (an absent field CLEARS it),
 * this dialog re-emits the section's CURRENT condition + sign-off as hidden
 * fields so a plain rename preserves them (for the default section these are
 * always null/false). Editing the condition/sign-off themselves lives in the
 * settings dialog.
 */
export function SectionMetaDialog({
  open,
  onOpenChange,
  section,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: Section;
}) {
  const [state, formAction, isPending] = useActionState<
    ActionState | undefined,
    FormData
  >(updateSection, undefined);
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
          <DialogTitle>Editar seção</DialogTitle>
          <DialogDescription>
            Altere o título e a descrição desta seção.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="sectionId" value={section.id} />
          {/* Preserve the section's current condition + sign-off unchanged. */}
          <SectionConditionFields visibleWhen={section.visibleWhen} />
          <SectionSignoffFields
            requiresSignoff={section.requiresSignoff}
            signoffRole={section.signoffRole}
          />

          {state && !state.ok && !state.fieldErrors?.title && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <Field>
            <FieldLabel htmlFor={titleField.controlProps.id}>
              Título da seção
            </FieldLabel>
            <Input
              {...titleField.controlProps}
              type="text"
              defaultValue={section.title ?? ""}
              required={!section.isDefault}
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
              defaultValue={section.description ?? ""}
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
