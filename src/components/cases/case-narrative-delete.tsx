"use client";

import { deleteAdHocNarrative } from "@/lib/case-narratives/actions";
import { ConfirmDeleteButton } from "./confirm-delete-button";

/**
 * Remove an AD-HOC case narrative. Thin client wrapper that binds
 * {@link deleteAdHocNarrative} to a narrative id, mirroring
 * {@link CaseDocumentDelete} / {@link CasePhaseDelete} so the destructive copy
 * for each entity lives next to its affordance rather than inline in a renderer.
 *
 * ONLY ad-hoc ("adicional") narratives are deletable; template-derived narrative
 * slots belong to the case type and the caller renders no affordance for them
 * (the backend refuses them too).
 *
 * `deleteAdHocNarrative` returns the narratives module's own `ActionState`, which
 * is structurally identical to the cases one `ConfirmDeleteButton` is typed
 * against ({ ok, error?, fieldErrors? }) — so this composes without widening the
 * shared button's contract.
 */
export function CaseNarrativeDelete({
  narrativeId,
  narrativeLabel,
}: {
  narrativeId: string;
  /** The narrative heading, for the accessible label + copy. */
  narrativeLabel: string;
}) {
  return (
    <ConfirmDeleteButton
      action={() => deleteAdHocNarrative(narrativeId)}
      label={`Remover a narrativa adicional ${narrativeLabel}`}
      title="Remover esta narrativa adicional?"
      description={`A narrativa adicional “${narrativeLabel}” e o seu conteúdo serão removidos deste caso. Esta ação não pode ser desfeita.`}
    />
  );
}
