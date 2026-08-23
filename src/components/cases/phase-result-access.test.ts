import { describe, expect, it } from "vitest";

import type { CasePhaseStatus } from "@/lib/queries/cases";
import type { ResolvedPhaseResult } from "@/lib/queries/phase-results";

import {
  phaseResultAffordance,
  type PhaseResultGate,
} from "./phase-result-access";

/**
 * Unit coverage for {@link phaseResultAffordance} — the pure per-PHASE mirror of
 * `public.set_case_phase_result_override`.
 *
 * ⚠ THIS CHANGE'S WHOLE RISK IS OVER-GRANT. An under-grant emits nothing (which is
 * why the original defect was invisible to every §6 gate); a careless widening
 * produces a dead-end door. So the negatives below are the point of the file, not
 * its filler: administrativo, plain member, non-assignee staff, assignee of a
 * COMPLETED phase, assignee of a PENDING phase. None of them may be offered
 * anything, and each is asserted against BOTH branches of the door.
 */

const VIEWER = "11111111-1111-1111-1111-111111111111";
const SOMEONE_ELSE = "22222222-2222-2222-2222-222222222222";

const OPTIONS: ResolvedPhaseResult[] = [
  { id: "r1", label: "Conforme", colorToken: "muted", isAdverse: false, source: null },
];

/** The gate a COORDINATOR (membership `staff_admin`) arrives with. */
const COORDINATOR: PhaseResultGate = { isCoordinator: true, options: OPTIONS };

/**
 * The gate every NON-coordinator arrives with — a plain member, an
 * *administrativo*, a case write-grantee, a quality reviewer. The door has no
 * `member_can` arm, so they are all the same shape here: `isCoordinator: false`.
 * There is deliberately no third state to widen into.
 */
const NON_COORDINATOR: PhaseResultGate = { isCoordinator: false, options: OPTIONS };

function phase(status: CasePhaseStatus, assignedTo: string | null = null) {
  return { status, assignedTo };
}

describe("phaseResultAffordance — the two ADMITTED branches", () => {
  it("active phase + its OWN assignee → 'set' (the arm the under-grant hid)", () => {
    expect(
      phaseResultAffordance(phase("active", VIEWER), NON_COORDINATOR, true, VIEWER),
    ).toBe("set");
  });

  it("active phase + coordinator → 'set', assigned to someone else or nobody", () => {
    expect(
      phaseResultAffordance(phase("active", SOMEONE_ELSE), COORDINATOR, true, VIEWER),
    ).toBe("set");
    expect(
      phaseResultAffordance(phase("active", null), COORDINATOR, true, VIEWER),
    ).toBe("set");
  });

  it("completed phase + coordinator + open case → 'correct'", () => {
    expect(
      phaseResultAffordance(phase("completed", SOMEONE_ELSE), COORDINATOR, true, VIEWER),
    ).toBe("correct");
  });

  it("distinguishes the two acts — an active phase is never 'correct'", () => {
    expect(
      phaseResultAffordance(phase("active", VIEWER), COORDINATOR, true, VIEWER),
    ).not.toBe("correct");
    expect(
      phaseResultAffordance(phase("completed", VIEWER), COORDINATOR, true, VIEWER),
    ).not.toBe("set");
  });
});

describe("phaseResultAffordance — the five negatives that must be offered NOTHING", () => {
  /**
   * 1. ADMINISTRATIVO. The door has NO `member_can` arm, so a delegated-capability
   * grant is refused at the DB. It reaches this function as `isCoordinator: false`
   * and must come out `none` on EVERY phase status — including one it is assigned,
   * where only the *active* arm may fire.
   */
  it("administrativo (a non-coordinator capability holder) gets nothing anywhere", () => {
    const statuses: CasePhaseStatus[] = [
      "pending",
      "active",
      "completed",
      "not_required",
      "voided",
    ];
    for (const status of statuses) {
      // Assigned to SOMEONE ELSE — no arm of the door can admit them.
      expect(
        phaseResultAffordance(phase(status, SOMEONE_ELSE), NON_COORDINATOR, true, VIEWER),
      ).toBe("none");
    }
  });

  /** 2. PLAIN MEMBER, assigned to nothing. */
  it("plain member who is not the assignee gets nothing on any status", () => {
    const statuses: CasePhaseStatus[] = [
      "pending",
      "active",
      "completed",
      "not_required",
      "voided",
    ];
    for (const status of statuses) {
      expect(
        phaseResultAffordance(phase(status, null), NON_COORDINATOR, true, VIEWER),
      ).toBe("none");
    }
  });

  /**
   * 3. NON-ASSIGNEE STAFF on an ACTIVE phase — the arm most at risk of being
   * widened from "the phase's own assignee" to "anyone who can see the phase".
   */
  it("non-assignee staff gets nothing on an ACTIVE phase assigned to someone else", () => {
    expect(
      phaseResultAffordance(phase("active", SOMEONE_ELSE), NON_COORDINATOR, true, VIEWER),
    ).toBe("none");
  });

  /**
   * 4. ASSIGNEE OF A COMPLETED PHASE — the grain correction (QA r2 R-4) in one
   * assertion. The assignee arm lives in the `active` branch ONLY; once the phase
   * is `completed` the caller falls to the other branch, which is coordinator-only.
   */
  it("assignee of a COMPLETED phase gets nothing — the assignee arm is active-only", () => {
    expect(
      phaseResultAffordance(phase("completed", VIEWER), NON_COORDINATOR, true, VIEWER),
    ).toBe("none");
  });

  /** 5. ASSIGNEE OF A PENDING PHASE — the door's first guard (HC057). */
  it("assignee of a PENDING phase gets nothing — HC057 admits no one", () => {
    expect(
      phaseResultAffordance(phase("pending", VIEWER), NON_COORDINATOR, true, VIEWER),
    ).toBe("none");
    // …and the same guard refuses a COORDINATOR, so this is not a role narrowing.
    expect(
      phaseResultAffordance(phase("pending", VIEWER), COORDINATOR, true, VIEWER),
    ).toBe("none");
  });
});

describe("phaseResultAffordance — the gate itself", () => {
  it("gate null (flag off, or a READING surface) → nothing, even for a coordinator", () => {
    expect(
      phaseResultAffordance(phase("completed", VIEWER), null, true, VIEWER),
    ).toBe("none");
    expect(phaseResultAffordance(phase("active", VIEWER), null, true, VIEWER)).toBe(
      "none",
    );
  });

  it("a null viewerId never satisfies the assignee arm on an UNASSIGNED phase", () => {
    // The `null === null` trap: SQL's `v_assigned_to = auth.uid()` yields NULL,
    // not true, when the phase is unassigned. Without the explicit null-guard this
    // hands the affordance to an unidentified viewer on every unassigned phase.
    expect(
      phaseResultAffordance(phase("active", null), NON_COORDINATOR, true, null),
    ).toBe("none");
  });

  it("terminal case gates the COMPLETED branch (HC060) but not the ACTIVE one", () => {
    // completed + coordinator + TERMINAL case → the door raises HC060.
    expect(
      phaseResultAffordance(phase("completed", VIEWER), COORDINATOR, false, VIEWER),
    ).toBe("none");
    // active + assignee + terminal case → the door has NO case-status check on
    // this branch. Mirroring it (rather than adding a narrowing) is deliberate;
    // the composition is unreachable because close_case/cancel_case sweep active
    // phases to `not_required` in the same transaction.
    expect(
      phaseResultAffordance(phase("active", VIEWER), NON_COORDINATOR, false, VIEWER),
    ).toBe("set");
  });
});
