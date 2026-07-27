import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { Item, ItemType, MatrixAxisEntry, Section, VersionTree } from "@/lib/queries/forms";
import type { GroupInstance } from "@/lib/queries/responses";

// `SignSectionPanel` calls `useRouter`. Mocked (the repo's existing pattern) so
// these render the REAL signer branch, which is the screen the defect was
// reported against — not the `readOnly` chrome.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { ReviewAndSign } from "./review-and-sign";
import type { ClientResponseForSignoff } from "./types";

/**
 * FF-2 · FUP-FF2-1 — the signer must SEE the grid they are attesting to.
 *
 * Before Wave 3 the sign-off door projected every answer shape except the two
 * matrix tables, and this screen's block filter used `isInputItem` — which is
 * false for a matrix. The two defects compounded: a section whose content was a
 * matrix rendered sign-off chrome over nothing, and a staff_admin signed blind.
 *
 * These tests assert the RENDERED CONTENT, not the props: they fail if either
 * half regresses — the data stops arriving, or the renderer stops dispatching.
 */

function axis(code: string, label: string, position: number, weight: number | null = null): MatrixAxisEntry {
  return { id: `id-${code}`, code, label, weight, position };
}

function item(id: string, over: Partial<Item> = {}, itemType: ItemType = "short_text"): Item {
  return {
    id,
    sectionId: "s1",
    position: 0,
    itemType,
    questionKey: id,
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

const MATRIX = item(
  "m1",
  {
    label: "Critérios de conformidade",
    matrixRows: [axis("higiene", "Higienização das mãos", 0), axis("epi", "Uso de EPI", 1)],
    matrixColumns: [axis("sim", "Conforme", 0), axis("nao", "Não conforme", 1)],
  },
  "matrix",
);

const RISK = item(
  "r1",
  {
    label: "Risco do achado",
    matrixRows: [axis("leve", "Leve", 0, 1), axis("grave", "Grave", 1, 9)],
    matrixColumns: [axis("rara", "Rara", 0, 1), axis("provavel", "Provável", 1, 3)],
    config: {
      riskBands: [
        { minScore: 0, label: "Baixo", color: null },
        { minScore: 9, label: "Alto", color: null },
      ],
    },
  },
  "risk_matrix",
);

function section(items: Item[]): Section {
  return {
    id: "s1",
    position: 0,
    title: "Conformidade",
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

function clientData(over: Partial<ClientResponseForSignoff> = {}): ClientResponseForSignoff {
  return {
    responseId: "resp1",
    formId: "f1",
    commissionId: "c1",
    formTitle: "Checklist",
    respondentName: "Ana",
    startedAt: "2026-07-27T10:00:00Z",
    updatedAt: "2026-07-27T10:00:00Z",
    tree: tree([MATRIX, RISK]),
    answersByItemId: {},
    observationsByItemId: {},
    matrixCellsByItemId: {},
    riskMatrixByItemId: {},
    instances: [],
    signoffsBySectionId: {},
    ...over,
  };
}

function renderScreen(data: ClientResponseForSignoff) {
  return render(<ReviewAndSign data={data} imageUrls={{}} onSign={vi.fn()} />);
}

/** The risk picker's live readout, as one string. */
function riskStatus(): string {
  const region = screen
    .getAllByRole("status")
    .find((el) => el.textContent?.includes("Pontuação"));
  if (!region) throw new Error("risk status region not rendered");
  return region.textContent ?? "";
}

describe("ReviewAndSign — the matrix a signer attests to", () => {
  it("renders the matrix GRID, not an empty block", () => {
    renderScreen(
      clientData({ matrixCellsByItemId: { m1: { higiene: "sim", epi: "nao" } } }),
    );
    // Row and column headers prove the grid itself rendered.
    expect(screen.getByText("Higienização das mãos")).toBeInTheDocument();
    expect(screen.getByText("Uso de EPI")).toBeInTheDocument();
    expect(screen.getAllByText("Conforme").length).toBeGreaterThan(0);
  });

  it("shows WHICH cell each row selected", () => {
    renderScreen(
      clientData({ matrixCellsByItemId: { m1: { higiene: "sim", epi: "nao" } } }),
    );
    // The read-only grid spells each cell's state out for a screen reader, so a
    // signer using one is told the selection rather than shown a coloured dot.
    expect(
      screen.getByText("Higienização das mãos, Conforme: selecionado"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Uso de EPI, Não conforme: selecionado"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Higienização das mãos, Não conforme: não selecionado"),
    ).toBeInTheDocument();
  });

  it("renders the risk grid with the STORED score, never a recomputed one", () => {
    // The stored score (99) deliberately disagrees with the product of the axis
    // weights (9 x 3 = 27). A signer must see the number the RECORD holds: if
    // this ever renders 27, the read path has started recomputing from weights
    // that a later version is free to change.
    renderScreen(
      clientData({
        riskMatrixByItemId: {
          r1: { severity: "grave", likelihood: "provavel", riskScore: 99 },
        },
      }),
    );
    // Query the STATUS REGION, not the "Pontuação:" label — the score and band
    // are sibling spans, so matching the label alone reads only the label.
    const status = riskStatus();
    expect(status).toContain("99");
    expect(status).not.toContain("27");
  });

  it("derives the band from the STORED score", () => {
    renderScreen(
      clientData({
        riskMatrixByItemId: {
          r1: { severity: "leve", likelihood: "rara", riskScore: 12 },
        },
      }),
    );
    // 12 reaches the 9 threshold -> "Alto", even though leve x rara computes 1.
    expect(riskStatus()).toContain("Alto");
  });

  it("renders a matrix answered INSIDE a repeating group, per instance", () => {
    const child = item(
      "m2",
      {
        label: "Checagem por leito",
        matrixRows: [axis("leito", "Leito ocupado", 0)],
        matrixColumns: [axis("ok", "OK", 0)],
      },
      "matrix",
    );
    const container = item("g1", { label: "Leitos", children: [child], questionKey: null }, "repeating_group");
    const instance: GroupInstance = {
      id: "i1",
      groupItemId: "g1",
      position: 0,
      answersByItemId: {},
      answersByKey: {},
      observationsByItemId: {},
      otherTextByItemId: {},
      matrixCellsByItemId: { m2: { leito: "ok" } },
      riskMatrixByItemId: {},
    };
    renderScreen(
      clientData({ tree: tree([container]), instances: [instance] }),
    );
    expect(screen.getByText("Leito ocupado, OK: selecionado")).toBeInTheDocument();
  });

  it("omits a matrix hidden by its own condition", () => {
    const controller = item("q1", { label: "Aplicável?" });
    const conditional = item(
      "m3",
      {
        label: "Grade condicional",
        visibleWhen: { question_key: "q1", op: "equals", value: "sim" },
        matrixRows: [axis("linha", "Linha oculta", 0)],
        matrixColumns: [axis("col", "Coluna", 0)],
      },
      "matrix",
    );
    renderScreen(
      clientData({
        tree: tree([controller, conditional]),
        answersByItemId: { q1: "nao" },
        matrixCellsByItemId: { m3: { linha: "col" } },
      }),
    );
    // Visibility wins: the grid is not part of what was answered, so it is not
    // part of what is signed.
    expect(screen.queryByText("Linha oculta")).not.toBeInTheDocument();
  });
});
