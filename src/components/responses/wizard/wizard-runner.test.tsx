/**
 * Adapter-forwarding contract test (BUG-FBE-008 / FBE-004 recurrence guard).
 *
 * The wizard calls the `actions` object built by `WizardRunner`'s `useMemo`
 * adapter — NOT the server action directly. Both prior fixes (iter-2 upsert,
 * iter-3 latest-state ref) were UPSTREAM of the real drop: the adapter hand-listed
 * its forwarded fields and OMITTED `otherTextByItemId`. Because that field is
 * OPTIONAL on the server action's input, the omission was tsc-invisible and Next
 * stripped the resulting `undefined` from the wire.
 *
 * This test asserts the adapter forwards `otherTextByItemId` (and every field it
 * is given) to the underlying `saveSection`/`saveAndExit` server actions — the
 * layer every prior unit test stopped short of. A hand-listed literal that drops
 * a field would fail here; the spread forward passes.
 */

import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const saveSection = vi.fn(async (..._args: unknown[]) => ({ ok: true }));
const saveAndExit = vi.fn(async (..._args: unknown[]) => ({ ok: true }));
const submitResponse = vi.fn(async (..._args: unknown[]) => ({ ok: true }));
const submitCasePhaseResponse = vi.fn(async (..._args: unknown[]) => ({ ok: true }));
const signSection = vi.fn(async (..._args: unknown[]) => ({ ok: true }));

// The runner imports the `'use server'` actions module (pulls next/headers) —
// stub it; we assert the adapter forwards to these spies.
vi.mock("@/lib/responses/actions", () => ({
  saveSection: (...a: unknown[]) => saveSection(...a),
  saveAndExit: (...a: unknown[]) => saveAndExit(...a),
  submitResponse: (...a: unknown[]) => submitResponse(...a),
  submitCasePhaseResponse: (...a: unknown[]) => submitCasePhaseResponse(...a),
  signSection: (...a: unknown[]) => signSection(...a),
}));

// Capture the `actions` prop the runner passes to WizardClient, without rendering
// the whole wizard tree.
let capturedActions: import("./wizard-client").WizardActions | null = null;
vi.mock("./wizard-client", () => ({
  WizardClient: (props: { actions: import("./wizard-client").WizardActions }) => {
    capturedActions = props.actions;
    return null;
  },
}));

import { WizardRunner } from "./wizard-runner";
import type { WizardData } from "./types";

function wizardData(): WizardData {
  return {
    org: "org-a",
    slug: "ccih",
    formId: "f1",
    responseId: "resp-1",
    formTitle: "Formulário",
    respondentName: "Responsável",
    tree: {
      id: "v1",
      formId: "f1",
      versionNumber: 1,
      status: "published",
      publishedAt: null,
      sections: [],
    },
    initialAnswers: {},
    lastSectionId: null,
    signoffsBySectionId: {},
    // FF-1: repeating-group instances (none in these fixtures).
    initialInstances: [],
  };
}

beforeEach(() => {
  saveSection.mockClear();
  saveAndExit.mockClear();
  capturedActions = null;
});

describe("WizardRunner adapter — forwards every field (FBE-008 guard)", () => {
  it("saveSection forwards otherTextByItemId (+ responseId, selections, observations, clearItemIds)", async () => {
    render(<WizardRunner data={wizardData()} imageUrls={{}} />);
    expect(capturedActions).not.toBeNull();

    await capturedActions!.saveSection({
      sectionId: "s0",
      answersByItemId: {},
      selectionsByItemId: { mc: ["__other__"] },
      clearItemIds: [],
      observationsByItemId: { mc: "nota" },
      otherTextByItemId: { mc: "Reação alérgica" },
    });

    expect(saveSection).toHaveBeenCalledTimes(1);
    const forwarded = saveSection.mock.calls[0][0] as Record<string, unknown>;
    expect(forwarded).toMatchObject({
      responseId: "resp-1",
      sectionId: "s0",
      selectionsByItemId: { mc: ["__other__"] },
      observationsByItemId: { mc: "nota" },
      // The field that was silently dropped for 3 iterations:
      otherTextByItemId: { mc: "Reação alérgica" },
    });
  });

  it("saveAndExit forwards otherTextByItemId (with a real section)", async () => {
    render(<WizardRunner data={wizardData()} imageUrls={{}} />);

    await capturedActions!.saveAndExit({
      sectionId: "s0",
      answersByItemId: {},
      selectionsByItemId: { mc: ["__other__"] },
      observationsByItemId: {},
      otherTextByItemId: { mc: "detalhe" },
    });

    expect(saveAndExit).toHaveBeenCalledTimes(1);
    const forwarded = saveAndExit.mock.calls[0][0] as Record<string, unknown>;
    expect(forwarded).toMatchObject({
      responseId: "resp-1",
      sectionId: "s0",
      otherTextByItemId: { mc: "detalhe" },
    });
  });

  it("saveAndExit with no section resolves ok WITHOUT calling the server action", async () => {
    render(<WizardRunner data={wizardData()} imageUrls={{}} />);
    const res = await capturedActions!.saveAndExit({
      sectionId: null,
      answersByItemId: {},
    });
    expect(res).toEqual({ ok: true });
    expect(saveAndExit).not.toHaveBeenCalled();
  });
});
