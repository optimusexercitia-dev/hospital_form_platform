"use client";

import { deleteAdHocPhase } from "@/lib/cases/actions";
import { ConfirmDeleteButton } from "./confirm-delete-button";

/**
 * Remove an AD-HOC case phase. Thin client wrapper that binds
 * {@link deleteAdHocPhase} to a phase id so the Server-Component phase article
 * can render the shared {@link ConfirmDeleteButton} without crossing a closure
 * over the RSC boundary (BUG-QI-001) — same idiom as {@link CaseNarrativeDelete}.
 *
 * ONLY ad-hoc ("adicional") phases are deletable; template-derived phases belong
 * to the case type and the caller renders no affordance for them (the backend
 * refuses them too). The backend ALSO refuses a phase that already has responses,
 * so the copy deliberately does not promise the removal will succeed — the pt-BR
 * refusal surfaces inline in the dialog.
 */
export function CasePhaseDelete({
  phaseId,
  phaseLabel,
}: {
  phaseId: string;
  /** The phase heading, for the accessible label + copy (e.g. "Fase 3"). */
  phaseLabel: string;
}) {
  return (
    <ConfirmDeleteButton
      action={() => deleteAdHocPhase(phaseId)}
      label={`Remover a fase adicional ${phaseLabel}`}
      title="Remover esta fase adicional?"
      description={`A fase adicional “${phaseLabel}” será removida deste caso. Fases que já possuem respostas não podem ser removidas.`}
    />
  );
}
