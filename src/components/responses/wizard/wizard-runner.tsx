"use client";

import { useMemo } from "react";

import type { Json } from "@/lib/types/database";
import {
  saveSection,
  saveAndExit,
  submitResponse,
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
      saveSection: (input: {
        sectionId: string;
        answersByItemId: Record<string, Json>;
        clearItemIds?: string[];
      }) =>
        saveSection({
          responseId: data.responseId,
          sectionId: input.sectionId,
          answersByItemId: input.answersByItemId,
          clearItemIds: input.clearItemIds,
        }),
      saveAndExit: (input: {
        sectionId: string | null;
        answersByItemId: Record<string, Json>;
      }) => {
        // `saveAndExit` persists the current section; with no active section
        // (already on review) there's nothing to persist — resolve ok so the
        // navigation proceeds.
        if (!input.sectionId) return Promise.resolve({ ok: true });
        return saveAndExit({
          responseId: data.responseId,
          sectionId: input.sectionId,
          answersByItemId: input.answersByItemId,
        });
      },
      submit: () => submitResponse(data.responseId),
      signSection: (input: { sectionId: string; note: string | null }) =>
        signSection({
          responseId: data.responseId,
          sectionId: input.sectionId,
          note: input.note,
        }),
    }),
    [data.responseId],
  );

  return <WizardClient data={data} imageUrls={imageUrls} actions={actions} />;
}
