"use client";

import { useMemo } from "react";

import {
  saveSection,
  saveAndExit,
  submitResponse,
  submitCasePhaseResponse,
  signSection,
} from "@/lib/responses/actions";
import { resubmitCorrection } from "@/lib/corrections/actions";

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
      // RECURRENCE-PROOF FORWARDING (BUG-FBE-004 / BUG-FBE-008): forward the whole
      // `input` via SPREAD, not a hand-listed literal. A hand-listed literal is
      // exactly what silently dropped `observationsByItemId` (FBE-004) and then
      // `otherTextByItemId` (FBE-008): because those fields are OPTIONAL on the
      // server action's `SaveSectionInput`, omitting one from the literal is NOT a
      // tsc error — it just becomes `undefined` and Next strips it from the wire.
      // The spread makes every current AND future `WizardActions` field flow
      // through automatically, so a new field can never be silently dropped again.
      // (`Parameters<...>` on the arg only types the INPUT; it does nothing to force
      // the FORWARDED literal to be complete — that was the FBE-004 comment's blind
      // spot.) The server actions take exactly `SaveSectionInput`, a structural
      // superset of both `WizardActions` inputs, so the spread type-checks.
      saveSection: (input: Parameters<WizardActions["saveSection"]>[0]) =>
        saveSection({ responseId: data.responseId, ...input }),
      saveAndExit: (input: Parameters<WizardActions["saveAndExit"]>[0]) => {
        // `saveAndExit` persists the current section; with no active section
        // (already on review) there's nothing to persist — resolve ok so the
        // navigation proceeds. After the guard, `sectionId` is a non-null string.
        if (!input.sectionId) return Promise.resolve({ ok: true });
        return saveAndExit({
          responseId: data.responseId,
          ...input,
          // Narrow `sectionId` (WizardActions allows `string | null`; the server
          // input requires `string`) — the guard above proved it non-null.
          sectionId: input.sectionId,
        });
      },
      // Three submit paths (checked in order):
      //  1. CORRECTION mode (Case Correction Lifecycle, ADR 0085) — this draft is a
      //     `supersedes_id != null` successor; `resubmit_correction` sends it for
      //     review (it calls `submit_response` internally, keeping required/bounds/
      //     signoff enforcement). NEVER `set_case_phase_result_override` — the result
      //     recompute is owned by `approve_correction` (plan §Confirmed-traps). The
      //     override panel is hidden in this mode, so `override` is always undefined.
      //  2. Case-phase fills (phase-results feature) → `submitCasePhaseResponse` so an
      //     optional per-phase result override is stashed on the still-`ativa` phase.
      //  3. Standalone fills → plain `submitResponse`.
      submit: (override) => {
        const correction = data.correction;
        if (correction) {
          return resubmitCorrection(correction.requestId);
        }
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
    [data.responseId, data.phaseResult, data.correction],
  );

  return <WizardClient data={data} imageUrls={imageUrls} actions={actions} />;
}
