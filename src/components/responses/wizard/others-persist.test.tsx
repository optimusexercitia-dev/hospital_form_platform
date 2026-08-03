/**
 * BUG-FBE-008 reproduction: the "Outro" free text must be on the wizard answer
 * record (and thus in the save payload) after the REAL browser sequence —
 * select `__other__` → type into the revealed field. This renders the actual
 * `SectionStep` wired to a real `useWizard` through the SAME orphan-aware
 * `onChange` the `WizardClient` uses, so it exercises the runtime event path the
 * hook-only tests skipped.
 */

import { useCallback } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import type { Json } from "@/lib/types/database";
import type { Item, Section, VersionTree } from "@/lib/queries/forms";
import { OTHER_OPTION_CODE, OTHER_OPTION_LABEL } from "@/lib/forms/option-constants";

import { useWizard } from "./use-wizard";
import { SectionStep } from "./section-step";
import type { WizardData } from "./types";

function choiceItem(): Item {
  return {
    id: "mc",
    sectionId: "s0",
    position: 0,
    itemType: "multiple_choice",
    questionKey: "mc",
    label: "Motivo",
    questionExplanation: null,
    options: [
      { id: "o-a", code: "a", label: "Infecção", color: null, score: null, analyticsCode: null, flagged: false, isOther: false, position: 0 },
      { id: "o-other", code: OTHER_OPTION_CODE, label: OTHER_OPTION_LABEL, color: null, score: null, analyticsCode: null, flagged: false, isOther: true, position: 1 },
    ],
    config: { allowOther: true },
    visibleWhen: null,
    required: false,
    defaultValue: null,
    parentItemId: null,
    children: [],
    content: null,
  };
}

function section(): Section {
  return {
    id: "s0",
    position: 0,
    title: null,
    description: null,
    isDefault: true,
    visibleWhen: null,
    requiresSignoff: false,
    signoffRole: null,
    items: [choiceItem()],
  };
}

function wizardData(): WizardData {
  const tree: VersionTree = {
    id: "v1",
    formId: "f1",
    versionNumber: 1,
    status: "published",
    publishedAt: null,
    sections: [section()],
  };
  return {
    org: "org-a",
    slug: "ccih",
    formId: "f1",
    responseId: "r1",
    formTitle: "Formulário",
    respondentName: "Responsável",
    tree,
    initialAnswers: {},
    lastSectionId: null,
    // FF-4: REQUIRED on WizardData (BUG-FF5-002 discipline) — a fixture with
    // no dynamic-default item still declares the context.
    dynamicDefaultContext: {
      startedAt: "2026-01-01T12:00:00.000Z",
      userName: "Responsável",
      userEmail: "responsavel@test.local",
      commissionName: "CCIH",
    },
    signoffsBySectionId: {},
    // FF-1: repeating-group instances (none in these fixtures).
    initialInstances: [],
    // FF-2: a fixture with no matrix still declares the slices — they are
    // REQUIRED on WizardData so a new answer kind can never be silently absent.
    initialMatrixCells: {},
    initialRiskMatrix: {},
    // FF-5: likewise for the reference slice — REQUIRED on WizardData so a
    // fixture cannot omit the newest answer kind and quietly stop exercising it.
    initialReferences: {},
  };
}

/**
 * A minimal harness mirroring `WizardClient`'s wiring: a real `useWizard`, the
 * SAME orphan-aware `onChange`, and the SAME `otherTextForSection` collector.
 * Exposes the collected other-text payload for assertion.
 */
function Harness({ onCollect }: { onCollect: (m: Record<string, string>) => void }) {
  const wizard = useWizard(wizardData());
  const {
    currentSection,
    answers,
    visibleItemIds,
    getLatestSnapshot,
    setAnswer,
    setObservation,
    setOtherText,
    previewAnswerChange,
    detectOrphans,
    commitAnswerChange,
  } = wizard;

  // Mirror WizardClient.onChange (no-orphan branch → setAnswer; same-section
  // orphans → commitAnswerChange). Simplified: single flat section, no cross-page.
  const onChange = useCallback(
    (item: { id: string; questionKey: string }, value: Json) => {
      const prospective = previewAnswerChange(item, value);
      const orphans = detectOrphans(prospective).filter(
        (o) => o.section.id === currentSection?.id,
      );
      const clearIds = orphans.flatMap((o) => o.itemIds);
      if (clearIds.length > 0) commitAnswerChange(item, value, clearIds);
      else setAnswer(item, value);
    },
    [previewAnswerChange, detectOrphans, currentSection?.id, setAnswer, commitAnswerChange],
  );

  // Mirror WizardClient.otherTextForSection — reads the LATEST committed state via
  // getLatestSnapshot (the FBE-008 stale-closure fix), not the closed-over render
  // snapshot.
  function collect() {
    const out: Record<string, string> = {};
    if (!currentSection) return out;
    const { answers: latest, visibleItemIds: visible } = getLatestSnapshot();
    for (const item of currentSection.items) {
      if (!visible.has(item.id)) continue;
      const rec = latest[item.id];
      if (rec?.otherText != null) out[item.id] = rec.otherText;
    }
    return out;
  }

  return (
    <div>
      {currentSection && (
        <SectionStep
          section={currentSection}
          index={0}
          imageUrls={{}}
          answers={answers}
          errors={{}}
          onChange={onChange}
          visibleItemIds={visibleItemIds}
          onObservationChange={setObservation}
          onOtherTextChange={setOtherText}
        />
      )}
      <button type="button" onClick={() => onCollect(collect())}>
        collect
      </button>
    </div>
  );
}

describe("BUG-FBE-008 — Outro text persists after select+type (real components)", () => {
  it("carries otherTextByItemId in the collected save payload", () => {
    let collected: Record<string, string> = {};
    render(<Harness onCollect={(m) => (collected = m)} />);

    // 1. Select "Outro" (the reserved __other__ radio).
    fireEvent.click(screen.getByLabelText(OTHER_OPTION_LABEL));
    // The "Especifique…" field is now revealed.
    const otherInput = screen.getByPlaceholderText("Especifique…");
    // 2. Type into it.
    fireEvent.change(otherInput, { target: { value: "Reação alérgica" } });
    // 3. Collect (what saveAndExit sends).
    fireEvent.click(screen.getByRole("button", { name: "collect" }));

    expect(collected).toEqual({ mc: "Reação alérgica" });
  });

  it("keeps the text when typed character-by-character (separate keystrokes)", () => {
    let collected: Record<string, string> = {};
    render(<Harness onCollect={(m) => (collected = m)} />);
    fireEvent.click(screen.getByLabelText(OTHER_OPTION_LABEL));
    const input = screen.getByPlaceholderText("Especifique…");
    // Each keystroke is a separate change event (separate render cycle), mirroring
    // real typing more closely than one bulk change.
    fireEvent.change(input, { target: { value: "R" } });
    fireEvent.change(input, { target: { value: "Re" } });
    fireEvent.change(input, { target: { value: "Rea" } });
    fireEvent.click(screen.getByRole("button", { name: "collect" }));
    expect(collected).toEqual({ mc: "Rea" });
    // The controlled input actually holds the value (not reset to "").
    expect((input as HTMLInputElement).value).toBe("Rea");
  });
});
