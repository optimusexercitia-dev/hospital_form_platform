"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  addAdHocPhase,
  type AddAdHocPhaseState,
} from "@/lib/cases/actions";
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
import type { SlotForm } from "@/components/process-templates/template-builder-shell";
import type { AssigneeOption } from "@/components/cases/case-phase-list";

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Append an ad-hoc phase to an open case (not from the template). Picks a
 * published form, an optional title, and an optional initial assignee, then calls
 * {@link addAdHocPhase} (which pins the form's published version — P0017 if it has
 * none). Append-only: the new phase lands at the end and starts `pendente`.
 *
 * An ad-hoc phase does NOT offer a `recommend_when` editor — recommendation is a
 * template-design concern (template phases reference each other by position); an
 * ad-hoc phase is added late and the coordinator activates it manually.
 */
export function AddAdHocPhaseDialog({
  open,
  onOpenChange,
  caseId,
  forms,
  assignees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  forms: SlotForm[];
  assignees: AssigneeOption[];
}) {
  const [state, formAction, isPending] = useActionState<
    AddAdHocPhaseState | undefined,
    FormData
  >(addAdHocPhase, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar fase ao caso</DialogTitle>
          <DialogDescription>
            Inclua uma fase adicional neste caso, com base em um formulário
            publicado. A fase é acrescentada ao final e começa pendente.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="caseId" value={caseId} />

          {state && !state.ok && !state.fieldErrors?.formId && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Formulário da fase</span>
            <select
              name="formId"
              className={SELECT_CLASS}
              required
              defaultValue=""
              aria-invalid={state?.fieldErrors?.formId ? true : undefined}
            >
              <option value="" disabled>
                Selecione um formulário…
              </option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
            {state?.fieldErrors?.formId && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {state.fieldErrors.formId}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Título da fase{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </span>
            <input
              name="title"
              type="text"
              className={SELECT_CLASS}
              placeholder="Ex.: Reavaliação"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Responsável{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </span>
            <select name="assignedTo" className={SELECT_CLASS} defaultValue="">
              <option value="">Atribuir depois</option>
              {assignees.map((a) => (
                <option key={a.userId} value={a.userId}>
                  {a.name}
                </option>
              ))}
            </select>
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
              {isPending ? "Adicionando…" : "Adicionar fase"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
