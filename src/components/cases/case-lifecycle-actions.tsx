"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Plus, XCircle } from "lucide-react";

import type { CaseDetail, OfferedCaseOutcome } from "@/lib/queries/cases";
import { closeCase, cancelCase } from "@/lib/cases/actions";
import { setCaseOutcome } from "@/lib/cases/outcomes-actions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormBanner } from "@/components/auth/form-banner";
import { NativeSelect } from "@/components/ui/native-select";
import { useCaseAction } from "@/components/cases/use-case-action";
import { AddAdHocPhaseDialog } from "@/components/cases/add-ad-hoc-phase-dialog";
import { AddAdHocNarrativeDialog } from "@/components/cases/add-ad-hoc-narrative-dialog";
import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import type { AssigneeOption } from "@/components/cases/case-phase-list";
import type { SlotForm } from "@/components/process-templates/template-builder-shell";


/**
 * Case-level coordinator actions in the detail header (non-terminal case only —
 * a terminal case is frozen, HC025). The MANUAL status picker is GONE: status is
 * auto-computed from phase state (D6/D12), so the only lifecycle actions are the
 * two MANUAL terminal transitions:
 *  - **Concluir** — opens a dialog. When the case offers outcomes (D15) the
 *    coordinator must pick one (it is captured via `setCaseOutcome` first, then
 *    `closeCase`); the server also enforces this (HC028). When the process offers
 *    none, it is a plain confirm → `closeCase`.
 *  - **Cancelar** — a confirm → `cancelCase` (no outcome needed, A6).
 *
 * "Adicionar fase" (ad-hoc) stays. Both terminal actions flip remaining open
 * phases to "não necessária" server-side.
 */
export function CaseLifecycleActions({
  caseId,
  offeredOutcomes,
  currentOutcomeId,
  forms,
  phases,
  assignees,
  expectedEmptyNarrativeLabels = [],
  pendingCorrectionLabels = [],
  narrativeTypes = [],
  narrativesEnabled = false,
}: {
  caseId: string;
  /** The case's FROZEN offered outcomes (D15); `[]` = process offers none. */
  offeredOutcomes: OfferedCaseOutcome[];
  /** The currently-assigned outcome id (pre-selects the conclude dialog). */
  currentOutcomeId: string | null;
  forms: SlotForm[];
  phases: CaseDetail["phases"];
  assignees: AssigneeOption[];
  /**
   * Labels of EXPECTED narratives (ADR 0032, decision 7) still empty — shown as a
   * NON-BLOCKING advisory in the conclude dialog. `[]` = none / feature off; the
   * dialog renders no warning then. Conclusion is never gated on this.
   */
  expectedEmptyNarrativeLabels?: string[];
  /**
   * Target labels of the case's OPEN correction requests — a **BLOCKING** gate, and
   * the counterpart of `expectedEmptyNarrativeLabels` above, which is advisory. The
   * `close_case` door refuses while any request is open (HC0T0), so the dialog states
   * the reason and disables the confirm rather than letting the coordinator submit
   * into a certain error. `[]` = none / feature off, and the dialog is unaffected.
   *
   * A hidden button is not a control (Rule 1) — the door is the boundary; this only
   * spares the round-trip and names the phases to resolve.
   */
  pendingCorrectionLabels?: string[];
  /**
   * The commission's non-archived narrative-type vocabulary — seeds the ad-hoc
   * narrative dialog's type picker. `[]` is a valid state: the dialog's inline
   * "Criar novo tipo" covers an empty vocabulary, so the button is NOT disabled
   * on `[]` (only hidden when the feature is off).
   */
  narrativeTypes?: { id: string; label: string }[];
  /** Whether the `case_narratives` feature is on — gates the "Adicionar narrativa" button. */
  narrativesEnabled?: boolean;
}) {
  const [adHocOpen, setAdHocOpen] = useState(false);
  const [narrativeOpen, setNarrativeOpen] = useState(false);
  const [concludeOpen, setConcludeOpen] = useState(false);

  const hasOpenPhases = phases.some(
    (p) => p.status === "pending" || p.status === "active",
  );

  return (
    <div className="flex shrink-0 flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => setAdHocOpen(true)}
          disabled={forms.length === 0}
        >
          <Plus aria-hidden="true" />
          Adicionar fase
        </Button>

        {narrativesEnabled && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setNarrativeOpen(true)}
          >
            <Plus aria-hidden="true" />
            Adicionar narrativa
          </Button>
        )}

        <Button type="button" size="lg" onClick={() => setConcludeOpen(true)}>
          <CheckCircle2 aria-hidden="true" />
          Concluir
        </Button>

        <CancelCaseButton caseId={caseId} hasOpenPhases={hasOpenPhases} />
      </div>

      <AddAdHocPhaseDialog
        open={adHocOpen}
        onOpenChange={setAdHocOpen}
        caseId={caseId}
        forms={forms}
        assignees={assignees}
      />

      {narrativesEnabled && (
        <AddAdHocNarrativeDialog
          open={narrativeOpen}
          onOpenChange={setNarrativeOpen}
          caseId={caseId}
          narrativeTypes={narrativeTypes}
          assignees={assignees}
        />
      )}

      <ConcludeCaseDialog
        open={concludeOpen}
        onOpenChange={setConcludeOpen}
        caseId={caseId}
        offeredOutcomes={offeredOutcomes}
        currentOutcomeId={currentOutcomeId}
        hasOpenPhases={hasOpenPhases}
        expectedEmptyNarrativeLabels={expectedEmptyNarrativeLabels}
        pendingCorrectionLabels={pendingCorrectionLabels}
      />
    </div>
  );
}

/**
 * The "Concluir" dialog. When the case offers outcomes the coordinator must
 * choose one (pre-selected to the current outcome); on confirm it calls
 * `setCaseOutcome` then `closeCase`. When none are offered it is a plain confirm
 * → `closeCase`. Errors stay on screen; the route refreshes on success.
 */
function ConcludeCaseDialog({
  open,
  onOpenChange,
  caseId,
  offeredOutcomes,
  currentOutcomeId,
  hasOpenPhases,
  expectedEmptyNarrativeLabels,
  pendingCorrectionLabels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  offeredOutcomes: OfferedCaseOutcome[];
  currentOutcomeId: string | null;
  hasOpenPhases: boolean;
  /** Expected-but-empty narrative labels — a NON-BLOCKING advisory (decision 7). */
  expectedEmptyNarrativeLabels: string[];
  /** Open-correction target labels — BLOCKING (HC0T0); `[]` = nothing to resolve. */
  pendingCorrectionLabels: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(currentOutcomeId ?? "");

  const offersOutcomes = offeredOutcomes.length > 0;

  // Reset local state each time the dialog opens (render-phase open transition).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setError(null);
      setSelected(currentOutcomeId ?? "");
    }
  }

  const selectedOutcome =
    offeredOutcomes.find((o) => o.id === selected) ?? null;
  const blockedByCorrections = pendingCorrectionLabels.length > 0;
  // When outcomes are offered, a choice is required (mirrors the server HC028 gate);
  // an open correction blocks outright (mirrors HC0T0).
  const canConfirm =
    (!offersOutcomes || selected !== "") && !blockedByCorrections;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      // Capture/confirm the outcome first when offered (and when it changed).
      if (offersOutcomes && selected && selected !== currentOutcomeId) {
        const res = await setCaseOutcome(caseId, selected);
        if (!res.ok) {
          setError(res.error ?? "Não foi possível concluir. Tente novamente.");
          return;
        }
      }
      const res = await closeCase(caseId);
      if (!res.ok) {
        setError(res.error ?? "Não foi possível concluir. Tente novamente.");
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Concluir o caso?</DialogTitle>
          <DialogDescription>
            {offersOutcomes
              ? "Escolha o desfecho deste caso para concluí-lo."
              : "O caso passará para o estado final “Concluído”."}{" "}
            {hasOpenPhases
              ? "As fases ainda abertas serão marcadas como não necessárias."
              : ""}{" "}
            Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {error && <FormBanner tone="error">{error}</FormBanner>}

          {/* BLOCKING, unlike the advisory below it: `close_case` refuses with HC0T0
              while any correction request is open, so the dialog names what has to be
              resolved and disables the confirm. The two exits are the two the door
              accepts — approve the correction, or withdraw the request ("Retirar"). */}
          {blockedByCorrections && (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-foreground"
            >
              <p className="flex items-center gap-2 font-medium text-destructive">
                <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
                {pendingCorrectionLabels.length === 1
                  ? "Há uma correção pendente"
                  : "Há correções pendentes"}
              </p>
              <ul className="ml-6 list-disc text-muted-foreground">
                {pendingCorrectionLabels.map((label, i) => (
                  <li key={`${label}-${i}`}>{label}</li>
                ))}
              </ul>
              <p className="text-muted-foreground">
                Aprove a correção ou retire a solicitação antes de concluir o caso.
              </p>
            </div>
          )}

          {expectedEmptyNarrativeLabels.length > 0 && (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/12 px-3.5 py-3 text-sm text-foreground"
            >
              <p className="flex items-center gap-2 font-medium text-warning">
                <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
                {expectedEmptyNarrativeLabels.length === 1
                  ? "Uma narrativa esperada está sem conteúdo"
                  : "Há narrativas esperadas sem conteúdo"}
              </p>
              <ul className="ml-6 list-disc text-muted-foreground">
                {expectedEmptyNarrativeLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
              <p className="text-muted-foreground">Você ainda pode concluir o caso.</p>
            </div>
          )}

          {offersOutcomes && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">Desfecho</span>
              <NativeSelect
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                required
                className="h-10"
                aria-invalid={!canConfirm ? true : undefined}
              >
                <option value="">Selecione um desfecho…</option>
                {offeredOutcomes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
              {selectedOutcome && (
                <span className="mt-1 flex flex-wrap items-center gap-2">
                  <CaseStatusBadge
                    label={selectedOutcome.label}
                    colorToken={selectedOutcome.colorToken}
                  />
                  {selectedOutcome.requiresActionPlan && (
                    <span className="text-[0.7rem] font-medium text-warning">
                      Requer plano de ação
                    </span>
                  )}
                  {selectedOutcome.isAdverse && (
                    <span className="text-[0.7rem] font-medium text-destructive">
                      Evento adverso
                    </span>
                  )}
                </span>
              )}
            </label>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Voltar
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={handleConfirm}
            disabled={isPending || !canConfirm}
          >
            {isPending ? "Concluindo…" : "Concluir caso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Cancelar" — a confirm dialog → `cancelCase` (anytime; no outcome needed). */
function CancelCaseButton({
  caseId,
  hasOpenPhases,
}: {
  caseId: string;
  hasOpenPhases: boolean;
}) {
  const { run, isPending, error } = useCaseAction();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="text-destructive hover:text-destructive"
        >
          <XCircle aria-hidden="true" />
          Cancelar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar o caso?</AlertDialogTitle>
          <AlertDialogDescription>
            O caso passará para o estado final “Cancelado”.{" "}
            {hasOpenPhases
              ? "As fases ainda abertas serão marcadas como não necessárias."
              : ""}{" "}
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={() => run(() => cancelCase(caseId))}
          >
            Cancelar caso
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
