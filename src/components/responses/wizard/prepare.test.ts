/**
 * Unit coverage for the wizard's resume adapter `toAnswerState` (task #6): it
 * hydrates each item's saved value, observation, AND "Outros" free text
 * (`otherTextByItemId`) so a resumed in_progress response keeps the typed Outro
 * value. The `server-only` import is stubbed by the vitest config alias.
 */

import { describe, expect, it } from "vitest";

import type { Item, Section, VersionTree } from "@/lib/queries/forms";
import type { ResponseForFill } from "@/lib/queries/responses";

import { toAnswerState } from "./prepare";

function inputItem(id: string): Item {
  return {
    id,
    sectionId: "s0",
    position: 0,
    itemType: "multiple_choice",
    questionKey: id,
    label: "Pergunta",
    questionExplanation: null,
    options: null,
    config: null,
    visibleWhen: null,
    required: false,
    defaultValue: null,
    parentItemId: null,
    children: [],
    content: null,
  };
}

function section(items: Item[]): Section {
  return {
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
}

function tree(items: Item[]): VersionTree {
  return {
    id: "v1",
    formId: "f1",
    versionNumber: 1,
    status: "published",
    publishedAt: null,
    sections: [section(items)],
  };
}

function response(over: Partial<ResponseForFill>): ResponseForFill {
  return {
    id: "r1",
    formVersionId: "v1",
    formId: "f1",
    formTitle: "Formulário",
    commissionId: "c1",
    status: "in_progress",
    lastSectionId: null,
    tree: tree([inputItem("q1")]),
    answersByItemId: {},
    answersByKey: {},
    observationsByItemId: {},
    otherTextByItemId: {},
    // FF-2 (ADR 0089): the grids. Required on the shared read shapes as of
    // FUP-FF2-1 — all three producers (fill, sign-off door, submission detail)
    // populate them, so an omission is now a compile error rather than a screen
    // that silently renders an empty matrix.
    matrixCellsByItemId: {},
    riskMatrixByItemId: {},
    // FF-1: repeating-group instances (none in these fixtures).
    instances: [],
    ...over,
  };
}

describe("toAnswerState — Others resume hydration (task #6)", () => {
  it("hydrates otherText from otherTextByItemId", () => {
    const state = toAnswerState(
      response({
        answersByItemId: { q1: "__other__" },
        otherTextByItemId: { q1: "Reação alérgica" },
      }),
    );
    expect(state.q1?.value).toBe("__other__");
    expect(state.q1?.otherText).toBe("Reação alérgica");
  });

  it("creates a record for an item that has ONLY otherText (defensive)", () => {
    const state = toAnswerState(
      response({ otherTextByItemId: { q1: "texto" } }),
    );
    expect(state.q1?.otherText).toBe("texto");
    // No saved value → null (the Outro chip resolves from the selection map).
    expect(state.q1?.value).toBeNull();
  });

  it("omits otherText when absent", () => {
    const state = toAnswerState(
      response({ answersByItemId: { q1: "a" } }),
    );
    expect(state.q1?.value).toBe("a");
    expect(state.q1?.otherText).toBeUndefined();
  });
});
