"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff } from "lucide-react";

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
 * `today + days` formatted as `YYYY-MM-DD` from LOCAL date parts (never
 * `toISOString`, which would shift a day across the UTC boundary). Used to
 * pre-fill the due-date input from the slot's default window.
 */
function defaultDueDateValue(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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
  defaultDueDays,
  currentDueDate,
}: {
  mode: "activate" | "reassign";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  casePhaseId: string;
  phaseLabel: string;
  currentAssignee: string | null;
  assignees: AssigneeOption[];
  /**
   * The phase's default due-window in days (the template-slot snapshot). When
   * present, the activate flow pre-fills the due date as today + this many days;
   * `null` starts the field empty. Ignored in `reassign` mode.
   */
  defaultDueDays: number | null;
  /**
   * The phase's current due date (`YYYY-MM-DD`). Pre-fills the date picker in
   * `reassign` mode so the coordinator sees (and can edit or clear) the existing
   * deadline. Ignored in `activate` mode.
   */
  currentDueDate?: string | null;
}) {
  const action = mode === "activate" ? activatePhase : reassignPhase;
  const fieldName = mode === "activate" ? "assignedTo" : "newAssignee";
  const [state, formAction, isPending] = useActionState<
    ActionState | undefined,
    FormData
  >(action, undefined);
  const router = useRouter();

  // Controlled due date: pre-filled from the slot's default window (activate) or
  // the current value (reassign); explicitly cleared via "Remover prazo".
  const [dueDate, setDueDate] = useState<string>("");
  // Re-apply the suggested due date each time the dialog OPENS, so reopening
  // after a cancel restores the default rather than the last edited value. This
  // is React's "adjust state when a prop changes" pattern (done during render,
  // not in an effect) — keyed on the open transition via the previous value.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      if (mode === "activate") {
        setDueDate(defaultDueDays != null ? defaultDueDateValue(defaultDueDays) : "");
      } else {
        setDueDate(currentDueDate ?? "");
      }
    }
  }

  useEffect(() => {
    if (state?.ok) {
      onOpenChange(false);
      router.refresh();
    }
  }, [state, onOpenChange, router]);

  const prefilledFromDefault = mode === "activate" && defaultDueDays != null;
  const dueDateHint =
    mode === "activate"
      ? prefilledFromDefault
        ? "Sugerido a partir do prazo padrão da fase."
        : "Deixe em branco para não definir prazo."
      : "Deixe em branco para remover o prazo.";

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

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="flex items-center justify-between gap-2">
              <span className="font-medium">
                Prazo{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </span>
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate("")}
                  className="inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  <CalendarOff aria-hidden="true" className="size-3.5" />
                  Remover prazo
                </button>
              )}
            </span>
            <input
              name="dueDate"
              type="date"
              className={SELECT_CLASS}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              {dueDateHint}
            </span>
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
