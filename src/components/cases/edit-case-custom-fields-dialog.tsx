"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, ShieldAlert } from "lucide-react";

import type { CaseCustomFieldValue } from "@/lib/queries/cases";
import { updateCaseCustomFieldValues } from "@/lib/cases/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import {
  CustomFieldInput,
  serializeCustomField,
  type CustomFieldValueDraft,
} from "@/components/cases/custom-field-input";

/**
 * Edit a case's custom-field VALUES (ADR 0083 D7), mirroring
 * {@link EditCaseMetaDialog}. Seeds each control from the frozen value snapshot and
 * submits ALL fields (one `customField` JSON hidden input per field) through the
 * `updateCaseCustomFieldValues` action → the audited DEFINER RPC, which is the
 * authority (self-gates, freezes terminal cases, and raises HC068 on a blanked
 * REQUIRED field → the pt-BR error surfaced below).
 *
 * Rendered ONLY on an OPEN case by a caller who may edit (the parent gates), with
 * the same fill-time PHI warning as the create dialog — these values are NOT behind
 * the PHI single door.
 */
export function EditCaseCustomFieldsDialog({
  caseId,
  fields,
}: {
  caseId: string;
  /** The case's full custom-field value set (frozen def + current value). */
  fields: CaseCustomFieldValue[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, CustomFieldValueDraft>>({});

  // Seed the controlled values from the snapshot each time the dialog opens, so a
  // cancelled edit never persists (render-phase open transition).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setError(null);
      setValues(
        Object.fromEntries(fields.map((f) => [f.key, f.value])),
      );
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("caseId", caseId);
    for (const field of fields) {
      formData.append(
        "customField",
        serializeCustomField(field.key, values[field.key] ?? null),
      );
    }
    startTransition(async () => {
      const res = await updateCaseCustomFieldValues(undefined, formData);
      if (!res.ok) {
        setError(res.error ?? "Não foi possível salvar. Tente novamente.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          <Pencil aria-hidden="true" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar campos personalizados</DialogTitle>
          <DialogDescription>
            Atualize os descritores administrativos deste caso.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && <FormBanner tone="error">{error}</FormBanner>}

          <p
            role="note"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive text-pretty"
          >
            <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              Não inclua dados de paciente nos campos personalizados (nome,
              prontuário, data de nascimento ou qualquer identificador).
            </span>
          </p>

          {fields.map((field) => (
            <CustomFieldInput
              key={field.key}
              field={field}
              disabled={isPending}
              idBase="edit-case-custom"
              value={values[field.key] ?? null}
              onChange={(v) =>
                setValues((prev) => ({ ...prev, [field.key]: v }))
              }
            />
          ))}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Voltar
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
