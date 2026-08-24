/**
 * WIRING test for the review screen's computed phase result — the layer the
 * `result-aggregates` unit tests stop short of.
 *
 * The reported bug lived entirely in the CALLER: `PhaseResultPanel` walks an
 * unchanged evaluator, and `WizardClient` handed it the bare answer map, so a
 * ruleset keyed on `__total_score__` tested an absent key and the review screen
 * showed the ruleset's DEFAULT while the concluded phase recorded the scored
 * result. A test that mirrored the wiring in a local harness would have passed
 * throughout — so this renders the REAL `WizardClient`, answers two 1-point
 * options, walks to review, and reads the badge.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import type { Item, ItemOption, Section, VersionTree } from "@/lib/queries/forms";
import { TOTAL_SCORE_KEY } from "@/lib/queries/conditions";
import type { ResolvedPhaseResult } from "@/lib/queries/phase-results";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

import { WizardClient, type WizardActions } from "./wizard-client";
import type { WizardData } from "./types";

const CONFORME: ResolvedPhaseResult = {
  id: "res-conforme",
  label: "Conforme",
  colorToken: "green",
  isAdverse: false,
  source: null,
};
const NAO_CONFORME: ResolvedPhaseResult = {
  id: "res-nao-conforme",
  label: "Não conforme",
  colorToken: "red",
  isAdverse: true,
  source: null,
};

function opt(over: Partial<ItemOption>): ItemOption {
  return {
    id: `o-${over.code}`,
    code: "sim",
    label: "Sim",
    color: null,
    score: null,
    analyticsCode: null,
    flagged: false,
    isOther: false,
    position: 0,
    ...over,
  } as unknown as ItemOption;
}

/** One multiple-choice question whose "Sim" option is worth 1 point. */
function scoredItem(id: string, questionKey: string): Item {
  return {
    id,
    sectionId: "s0",
    position: 0,
    itemType: "multiple_choice",
    questionKey,
    label: `Pergunta ${questionKey}`,
    questionExplanation: null,
    options: [
      opt({ code: "sim", label: "Sim", score: 1, position: 0 }),
      opt({ code: "nao", label: "Não", score: null, position: 1 }),
    ],
    config: null,
    visibleWhen: null,
    required: false,
    defaultValue: null,
    parentItemId: null,
    children: [],
    content: null,
  } as unknown as Item;
}

function wizardData(answered: Record<string, string>): WizardData {
  const items = [scoredItem("i1", "q1"), scoredItem("i2", "q2")];
  const section: Section = {
    id: "s0",
    position: 0,
    title: null,
    description: null,
    isDefault: true,
    visibleWhen: null,
    requiresSignoff: false,
    signoffRole: null,
    items,
  };
  const tree: VersionTree = {
    id: "v1",
    formId: "f1",
    versionNumber: 1,
    status: "published",
    publishedAt: null,
    sections: [section],
  };
  return {
    org: "org-a",
    slug: "ccih",
    formId: "f1",
    responseId: "r1",
    formTitle: "Prontuário",
    respondentName: "Responsável",
    tree,
    initialAnswers: Object.fromEntries(
      items
        .filter((it) => answered[it.id] !== undefined)
        .map((it) => [
          it.id,
          { itemId: it.id, questionKey: it.questionKey!, value: answered[it.id] },
        ]),
    ),
    lastSectionId: null,
    dynamicDefaultContext: {
      startedAt: "2026-01-01T12:00:00.000Z",
      userName: "Responsável",
      userEmail: "responsavel@test.local",
      commissionName: "CCIH",
    },
    signoffsBySectionId: {},
    // ADR 0136 — the standalone/draft lane; the deferred lane sets this true.
    deferStaffSignoff: false,
    initialInstances: [],
    initialMatrixCells: {},
    initialRiskMatrix: {},
    initialReferences: {},
    phaseResult: {
      casePhaseId: "cp-1",
      mode: "automatic",
      // The reported ruleset: "emit Conforme when the points total is >= 2".
      ruleset: {
        rules: [
          {
            when: { question_key: TOTAL_SCORE_KEY, op: "gte", value: 2 },
            result_id: CONFORME.id,
          },
        ],
        default_result_id: NAO_CONFORME.id,
      },
      options: [CONFORME, NAO_CONFORME],
      currentOverrideId: null,
    },
  } as WizardData;
}

function actionsStub(): WizardActions {
  const ok = async () => ({ ok: true as const });
  return {
    saveSection: ok,
    saveAndExit: ok,
    submitResponse: ok,
    submitCasePhaseResponse: ok,
    signSection: ok,
  } as unknown as WizardActions;
}

/** Render, then walk the flat wizard's single section to the review screen. */
async function renderAtReview(answered: Record<string, string>) {
  render(
    <WizardClient
      data={wizardData(answered)}
      imageUrls={{}}
      actions={actionsStub()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Revisar/i }));
  await waitFor(() =>
    expect(screen.getByText("Resultado calculado:")).toBeInTheDocument(),
  );
}

describe("review screen — computed phase result (points ruleset)", () => {
  it("shows the SCORED result once the points total reaches the threshold", async () => {
    await renderAtReview({ i1: "sim", i2: "sim" }); // 1 + 1 = 2, rule is `>= 2`

    expect(screen.getByText(CONFORME.label)).toBeInTheDocument();
    expect(screen.queryByText(NAO_CONFORME.label)).toBeNull();
  });

  it("shows the ruleset's default while the points total is below it", async () => {
    await renderAtReview({ i1: "sim", i2: "nao" }); // 1 + 0 = 1

    expect(screen.getByText(NAO_CONFORME.label)).toBeInTheDocument();
    expect(screen.queryByText(CONFORME.label)).toBeNull();
  });
});
