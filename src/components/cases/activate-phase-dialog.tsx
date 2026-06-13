"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  activatePhase,
  reassignPhase,
  type ActionState,
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
import type { AssigneeOption } from "@/components/cases/case-phase-list";

const SELECT_CLASS =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Assign + activate (or reassign) a phase. A single dialog backs both flows since
 * they share the assignee picker:
 *  - `mode="activate"` → {@link activatePhase} (field `assignedTo`): activates a
 *    pendente phase and assigns it. The backend enforces sequential order
 *    (P0018), pendente state (P0019), case open (P0020), assignee membership
 *    (P0021).
 *  - `mode="reassign"` → {@link reassignPhase} (field `newAssignee`): changes the
 *    assignee BEFORE any response exists (P0019 otherwise).
 *
 * Errors are kept on screen; on success the dialog closes and the route refreshes.
 */
export function ActivatePhaseDialog({
  mode,
  open,
  onOpenChange,
  casePhaseId,
  phaseLabel,
  currentAssignee,
  assignees,
}: {
  mode: "activate" | "reassign";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  casePhaseId: string;
  phaseLabel: string;
  currentAssignee: string | null;
  assignees: AssigneeOption[];
}) {
  const action = mode === "activate" ? activatePhase : reassignPhase;
  const fieldName = mode === "activate" ? "assignedTo" : "newAssignee";
  const [state, formAction, isPending] = useActionState<
    ActionState | undefined,
    FormData
  >(action, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  const fieldError =
    state?.fieldErrors?.assignedTo ?? state?.fieldErrors?.newAssignee;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "activate" ? "Ativar e atribuir fase" : "Alterar responsável"}
          </DialogTitle>
          <DialogDescription>
            {mode === "activate"
              ? `Escolha quem ficará responsável por preencher ${phaseLabel}. A fase será ativada e a pessoa poderá começar.`
              : `Escolha o novo responsável por ${phaseLabel}. Só é possível enquanto o preenchimento não tiver começado.`}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="casePhaseId" value={casePhaseId} />

          {state && !state.ok && !fieldError && (
            <FormBanner tone="error">{state.error}</FormBanner>
          )}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Responsável</span>
            <select
              name={fieldName}
              className={SELECT_CLASS}
              required
              defaultValue={mode === "reassign" ? (currentAssignee ?? "") : ""}
              aria-invalid={fieldError ? true : undefined}
            >
              <option value="" disabled>
                Selecione um responsável…
              </option>
              {assignees.map((a) => (
                <option key={a.userId} value={a.userId}>
                  {a.name}
                </option>
              ))}
            </select>
            {fieldError && (
              <span role="alert" className="text-sm font-medium text-destructive">
                {fieldError}
              </span>
            )}
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
                : mode === "activate"
                  ? "Ativar fase"
                  : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
