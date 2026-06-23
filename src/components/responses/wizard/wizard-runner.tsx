"use client";

import { useMemo } from "react";

import {
  saveSection,
  saveAndExit,
  submitResponse,
  submitCasePhaseResponse,
  signSection,
} from "@/lib/responses/actions";

import type { WizardData } from "./types";
import { WizardClient, type WizardActions } from "./wizard-client";

/**
 * Thin client wrapper that binds the response id into B3's server actions and
 * adapts them to the wizard's `WizardActions` surface. Server actions are
 * importable from a client component (Next.js wires the RPC), so this keeps the
 * `responseId` plumbing in one place and the orchestrator (`WizardClient`)
 * decoupled from the exact action signatures.
 */
export function WizardRunner({
  data,
  imageUrls,
}: {
  data: WizardData;
  imageUrls: Record<string, string>;
}) {
  const actions: WizardActions = useMemo(
    () => ({
      // The input types reuse `WizardActions`'s own member parameter types
      // (`Parameters<...>`) rather than re-declaring a narrower literal here —
      // that narrower literal is exactly what silently dropped
      // `observationsByItemId` (BUG-FBE-004). Bound to the source of truth, any
      // future field added to `WizardActions.saveSection`/`saveAndExit` is a
      // compile error here until it's forwarded.
      saveSection: (input: Parameters<WizardActions["saveSection"]>[0]) =>
        saveSection({
          responseId: data.responseId,
          sectionId: input.sectionId,
          answersByItemId: input.answersByItemId,
          clearItemIds: input.clearItemIds,
          observationsByItemId: input.observationsByItemId,
        }),
      saveAndExit: (input: Parameters<WizardActions["saveAndExit"]>[0]) => {
        // `saveAndExit` persists the current section; with no active section
        // (already on review) there's nothing to persist — resolve ok so the
        // navigation proceeds.
        if (!input.sectionId) return Promise.resolve({ ok: true });
        return saveAndExit({
          responseId: data.responseId,
          sectionId: input.sectionId,
          answersByItemId: input.answersByItemId,
          observationsByItemId: input.observationsByItemId,
        });
      },
      // Case-phase fills (phase-results feature) route to `submitCasePhaseResponse`
      // so an optional per-phase result override is stashed on the still-`ativa`
      // phase before the conclusion trigger honors it; standalone fills keep the
      // plain `submitResponse` (no case-phase / no override).
      submit: (override) => {
        const phaseResult = data.phaseResult;
        if (phaseResult) {
          return submitCasePhaseResponse(
            data.responseId,
            phaseResult.casePhaseId,
            override?.overrideResultId,
            override?.reason ?? null,
          );
        }
        return submitResponse(data.responseId);
      },
      signSection: (input: { sectionId: string; note: string | null }) =>
        signSection({
          responseId: data.responseId,
          sectionId: input.sectionId,
          note: input.note,
        }),
    }),
    [data.responseId, data.phaseResult],
  );

  return <WizardClient data={data} imageUrls={imageUrls} actions={actions} />;
}
