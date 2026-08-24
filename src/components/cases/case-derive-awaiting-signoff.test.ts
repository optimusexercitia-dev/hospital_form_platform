import { describe, expect, it } from "vitest";

import type { CaseBoardRow, CasePhaseStatus } from "@/lib/queries/cases";

import {
  activePhases,
  blockedBy,
  computeCaseKpis,
  currentPhase,
  phaseProgress,
} from "./case-derive";
import { asCasePhaseStatus } from "./phase-status-pill";

/**
 * ADR 0136 — `CasePhaseStatus` gained a sixth member, `'awaiting_signoff'`.
 *
 * ⛔ THIS FILE EXISTS BECAUSE THE COMPILER DOES NOT FIND THESE SITES. Measured
 * when the member was added: only **4 declaration sites** failed typecheck (the
 * three `Record<CasePhaseStatus, …>` maps). Every derivation below is an
 * `if`/`!==` chain that FELL THROUGH silently — two of them to the wrong answer
 * — and there is no `assertNever`/`satisfies` guard anywhere over this union to
 * turn the next addition into an error either.
 *
 * So each assertion here pins a decision that was made deliberately and would
 * otherwise be indistinguishable from a default nobody looked at.
 */

const V = "11111111-1111-1111-1111-111111111111";

type BoardPhase = CaseBoardRow["phases"][number];

function phase(
  position: number,
  status: CasePhaseStatus,
  extra: Partial<BoardPhase> = {},
): BoardPhase {
  return {
    id: `p${position}`,
    position,
    title: `Fase ${position}`,
    status,
    recommended: false,
    assignedTo: V,
    assigneeName: "Ana",
    dueDate: null,
    blocks: [],
    result: null,
    ...extra,
  } as BoardPhase;
}

function row(phases: BoardPhase[], extra: Partial<CaseBoardRow> = {}): CaseBoardRow {
  return {
    case: {
      id: "c1",
      caseNumber: 1,
      label: null,
      status: "em_revisao",
      createdAt: "2026-08-24T10:00:00Z",
    },
    phases,
    openNarrativeCount: 0,
    customFields: [],
    ...extra,
  } as unknown as CaseBoardRow;
}

describe("currentPhase — the awaiting arm is NOT a fall-through", () => {
  it("returns the awaiting phase when it is the case's only live work", () => {
    // ⭐ Without the arm this returns null and the board card renders NO current
    // phase — blank at exactly the moment the case needs a coordinator.
    const r = row([phase(1, "awaiting_signoff")]);
    expect(currentPhase(r)?.position).toBe(1);
  });

  it("still prefers an ACTIVE phase over an awaiting one", () => {
    // Someone is filling phase 2; that is the live work, not the signature owed
    // on phase 1.
    const r = row([phase(1, "awaiting_signoff"), phase(2, "active")]);
    expect(currentPhase(r)?.position).toBe(2);
  });

  it("prefers an awaiting phase over a PENDING one", () => {
    // Pending has not been released to anyone yet; awaiting is owed NOW.
    const r = row([phase(1, "awaiting_signoff"), phase(2, "pending")]);
    expect(currentPhase(r)?.position).toBe(1);
  });
});

describe("activePhases — an awaiting phase is deliberately NOT ativa", () => {
  it("excludes it", () => {
    // `start_or_resume_phase` refuses a non-`active` phase (HC019) and the
    // response is frozen, so offering it as fillable work is a dead end.
    const r = row([phase(1, "awaiting_signoff"), phase(2, "active")]);
    expect(activePhases(r).map((p) => p.position)).toEqual([2]);
  });
});

describe("phaseProgress — awaiting counts as TOTAL, never as DONE", () => {
  it("keeps the phase in the denominator and out of the numerator", () => {
    const r = row([phase(1, "completed"), phase(2, "awaiting_signoff")]);
    expect(phaseProgress(r)).toEqual({ done: 1, total: 2 });
  });
});

describe("blockedBy — an awaiting phase does NOT satisfy a blocker", () => {
  it("keeps the downstream phase blocked", () => {
    // ⭐ This is D3's entire mechanism, and the TS twin of `activate_phase`'s
    // HC018. Its settled set is ('completed','not_required','voided') — a set
    // `awaiting_signoff` is deliberately absent from.
    const all = [
      { position: 1, status: "awaiting_signoff" as CasePhaseStatus },
      { position: 2, status: "pending" as CasePhaseStatus },
    ];
    expect(blockedBy({ blocks: [1] }, all)).toEqual([1]);
  });

  it("…and releases it once the signature lands", () => {
    // The twin. A one-sided assertion cannot tell "blocks correctly" from
    // "blocks everything".
    const all = [
      { position: 1, status: "completed" as CasePhaseStatus },
      { position: 2, status: "pending" as CasePhaseStatus },
    ];
    expect(blockedBy({ blocks: [1] }, all)).toEqual([]);
  });
});

describe("computeCaseKpis — awaiting is counted as OPEN work", () => {
  it("counts it under 'Etapas pendentes'", () => {
    // ⭐ Left to fall through it is counted by NOTHING — not `fasesAtivas` (nobody
    // can fill it) and not `fasesPendentes` — so a phase parking for a signature
    // would silently REDUCE the commission's open-work KPI at the moment it grew.
    const k = computeCaseKpis([row([phase(1, "awaiting_signoff")])]);
    expect(k.fasesPendentes).toBe(1);
    expect(k.fasesAtivas).toBe(0);
  });

  it("does not double-count it as an active phase", () => {
    const k = computeCaseKpis([
      row([phase(1, "awaiting_signoff"), phase(2, "active")]),
    ]);
    expect(k.fasesAtivas).toBe(1);
    expect(k.fasesPendentes).toBe(1);
  });
});

describe("asCasePhaseStatus — the cast that used to be a runtime TypeError", () => {
  it("passes every real member through unchanged", () => {
    for (const s of [
      "pending",
      "active",
      "awaiting_signoff",
      "completed",
      "not_required",
      "voided",
    ] as const) {
      expect(asCasePhaseStatus(s)).toBe(s);
    }
  });

  it("falls back to `pending` for a status this build does not know", () => {
    // `PhaseStatusPill` does an UNGUARDED `STATUS_META[status]` lookup, so the
    // `as CasePhaseStatus` this replaces produced a blank card, not a fallback —
    // and no compiler could see it, because a cast is the promise not to check.
    expect(asCasePhaseStatus("some_future_status")).toBe("pending");
    expect(asCasePhaseStatus("")).toBe("pending");
  });

  it("is not fooled by an inherited Object.prototype key", () => {
    // `status in STATUS_META` walks the prototype chain; "constructor" is on it.
    // If this ever regresses, the pill renders `STATUS_META["constructor"]` and
    // throws on `.icon` — the exact failure the helper exists to prevent.
    expect(asCasePhaseStatus("constructor")).toBe("pending");
    expect(asCasePhaseStatus("toString")).toBe("pending");
  });
});
