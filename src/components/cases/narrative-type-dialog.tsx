"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { CaseNarrativeType } from "@/lib/queries/case-narratives";
import {
  createNarrativeType,
  updateNarrativeType,
  type ActionState,
} from "@/lib/case-narratives/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import { Textarea } from "@/components/ui/textarea";

const FIELD_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Create / edit a NARRATIVE-TYPE definition (ADR 0032): a pt-BR label + an
 * optional description, mirroring {@link OutcomeDefDialog} but WITHOUT a colour
 * token or advisory flags (a narrative type is a plain vocabulary entry, like
 * `case_outcomes` minus the colour/flags). FormData-shaped to match the frozen
 * `createNarrativeType` / `updateNarrativeType` actions (the shared
 * `useActionState` contract). Edits propagate to the vocabulary + template slots
 * but not to opened cases (they snapshot `type_label`).
 */
export function NarrativeTypeDialog({
  mode,
  open,
  onOpenChange,
  commissionId,
  narrativeType,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commissionId: string;
  /** Required for `edit`. */
  narrativeType?: CaseNarrativeType;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState | null>(null);

  const [label, setLabel] = useState(narrativeType?.label ?? "");
  const [description, setDescription] = useState(narrativeType?.description ?? "");

  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setState(null);
      setLabel(narrativeType?.label ?? "");
      setDescription(narrativeType?.description ?? "");
    }
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = new FormData();
    if (mode === "create") {
      form.set("commissionId", commissionId);
    } else {
      // `updateNarrativeType` reads the id from `narrativeTypeId` (not `id`).
      form.set("narrativeTypeId", narrativeType?.id ?? "");
    }
    form.set("label", label.trim());
    form.set("description", description.trim());

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createNarrativeType(undefined, form)
          : await updateNarrativeType(undefined, form);
      setState(result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nova narrativa" : "Editar narrativa"}
          </DialogTitle>
          <DialogDescription>
            As narrativas são os tipos de texto que os processos desta comissão
            podem registrar nos casos (ex.: Resumo Clínico, Conclusão do Comitê).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {state && !state.ok && !state.fieldErrors?.label && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Nome</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              className={FIELD_CLASS}
              placeholder="Ex.: Resumo Clínico"
              aria-invalid={state?.fieldErrors?.label ? true : undefined}
            />
            {state?.fieldErrors?.label && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.label}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Descrição{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </span>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explique brevemente quando esta narrativa deve ser usada."
              className="min-h-20 text-sm"
            />
          </label>

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
              {isPending
                ? "Salvando…"
                : mode === "create"
                  ? "Criar narrativa"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
