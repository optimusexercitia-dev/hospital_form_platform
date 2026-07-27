import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import type { Item, ItemType, Section, VersionTree } from "@/lib/queries/forms";
import type { GroupInstance } from "@/lib/queries/responses";

// `SignSectionPanel` calls `useRouter`. Mocked (the repo's existing pattern) so
// these render the REAL signer branch — the one where a coordinator actually
// signs — rather than dodging into `readOnly`, which would exercise different
// chrome than the screen the bug was reported against.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { ReviewAndSign } from "./review-and-sign";
import { toClientResponseForSignoff } from "./adapt";
import type { ClientResponseForSignoff } from "./types";

/**
 * Regression coverage for BUG-FF1-003 (Critical).
 *
 * The sign-off screen is where a staff_admin puts their name to a section's
 * content. The client layer dropped `instances` in three places at once — the
 * type had no field, the adapter did not forward it, and `SectionBody` filtered
 * `repeating_group` away — so a section containing only a repeating group
 * rendered sign-off chrome over NOTHING and could be signed blind.
 *
 * These assertions are deliberately BY VALUE. A test that checks "renders
 * without error", "the section heading appears", or "the sign button is present"
 * passes against the bug unchanged — the chrome was never missing; the content
 * was. So each case names the actual answer text that must reach the DOM.
 */

function item(
  id: string,
  over: Partial<Item> = {},
  itemType: ItemType = "short_text",
): Item {
  return {
    id,
    sectionId: "sec-1",
    position: 0,
    itemType,
    questionKey:
      itemType === "group" || itemType === "repeating_group" ? null : id,
    label: id,
    questionExplanation: null,
    options: null,
    config: null,
    visibleWhen: null,
    required: false,
    defaultValue: null,
    parentItemId: null,
    children: [],
    content: null,
    ...over,
  };
}

/** A section whose ONLY content is a repeating group — the exact shape the
 *  tester captured rendering blank. */
const MEDICAMENTO = item("medicamento", { label: "Medicamento" });
const DOSE = item("dose", { label: "Dose" });
const REP = item(
  "REP",
  { label: "Medicação administrada", children: [MEDICAMENTO, DOSE] },
  "repeating_group",
);

function section(items: Item[]): Section {
  return {
    id: "sec-1",
    position: 0,
    title: "Administração",
    description: null,
    isDefault: false,
    visibleWhen: null,
    requiresSignoff: true,
    signoffRole: "staff_admin",
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

function instance(
  id: string,
  position: number,
  answers: Record<string, string>,
): GroupInstance {
  return {
    id,
    groupItemId: "REP",
    position,
    answersByItemId: answers,
    answersByKey: {},
    observationsByItemId: {},
    otherTextByItemId: {},
  };
}

function clientData(
  over: Partial<ClientResponseForSignoff> = {},
): ClientResponseForSignoff {
  return {
    responseId: "r1",
    formId: "f1",
    commissionId: "c1",
    formTitle: "Checklist",
    respondentName: "Ana",
    startedAt: "2026-07-27T10:00:00Z",
    updatedAt: "2026-07-27T10:00:00Z",
    tree: tree([REP]),
    answersByItemId: {},
    observationsByItemId: {},
    instances: [
      instance("i1", 0, { medicamento: "Dipirona", dose: "500mg" }),
      instance("i2", 1, { medicamento: "Omeprazol", dose: "20mg" }),
    ],
    signoffsBySectionId: {},
    ...over,
  };
}

function renderScreen(data: ClientResponseForSignoff) {
  return render(
    <ReviewAndSign data={data} imageUrls={{}} onSign={vi.fn()} />,
  );
}

describe("ReviewAndSign — repeating-group content is visible to the signer", () => {
  it("renders EVERY instance's answers by value", () => {
    renderScreen(clientData());
    // The four values that were invisible before the fix. A signer must see
    // these before attesting to the section.
    expect(screen.getByText("Dipirona")).toBeInTheDocument();
    expect(screen.getByText("500mg")).toBeInTheDocument();
    expect(screen.getByText("Omeprazol")).toBeInTheDocument();
    expect(screen.getByText("20mg")).toBeInTheDocument();
  });

  it("labels each repetition so two rows are distinguishable", () => {
    renderScreen(clientData());
    expect(
      screen.getByText(/Medicação administrada 1 de 2/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Medicação administrada 2 de 2/i),
    ).toBeInTheDocument();
  });

  it("does NOT claim the section is empty when its only block repeats", () => {
    // The literal symptom: chrome plus "Esta seção não tem conteúdo."
    renderScreen(clientData());
    expect(screen.queryByText(/não tem conteúdo/i)).toBeNull();
  });

  it("still renders a plain group's children alongside (ruling 6)", () => {
    const group = item(
      "GRP",
      { label: "Dados", children: [item("setor", { label: "Setor" })] },
      "group",
    );
    renderScreen(
      clientData({
        tree: tree([group, REP]),
        answersByItemId: { setor: "UTI" },
      }),
    );
    expect(screen.getByText("UTI")).toBeInTheDocument();
    expect(screen.getByText("Dipirona")).toBeInTheDocument();
  });
});

describe("toClientResponseForSignoff — the adapter forwards instances", () => {
  it("carries instances through to the client shape", () => {
    // The adapter is the seam that dropped them; assert the payload survives,
    // not merely that the call succeeds.
    const instances = [instance("i1", 0, { medicamento: "Dipirona" })];
    const adapted = toClientResponseForSignoff({
      responseId: "r1",
      formId: "f1",
      formTitle: "Checklist",
      formVersionId: "v1",
      commissionId: "c1",
      respondentId: "u1",
      respondentName: "Ana",
      startedAt: "2026-07-27T10:00:00Z",
      updatedAt: "2026-07-27T10:00:00Z",
      tree: tree([REP]),
      answersByKey: {},
      answersByItemId: {},
      observationsByItemId: {},
      instances,
      signoffs: [],
    });
    expect(adapted.instances).toEqual(instances);
  });
});
