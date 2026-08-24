import { describe, expect, it } from "vitest";

import type { CasePhaseStatus } from "@/lib/queries/cases";

import { canFillAssignedPhase, isAssignedTo } from "./assigned-work-access";

/**
 * Unit coverage for the ADR 0137 D8 attributed-work predicates.
 *
 * ⚠ THE RISK IS SYMMETRIC HERE, unlike `phase-result-access.test.ts`. The defect D8
 * closes was an UNDER-grant that emitted nothing — a `staff_admin`, an
 * *administrativo* and a plain member all saw an assigned phase they could not open,
 * and no gate could see it. So the POSITIVE cases below are load-bearing: they are
 * the only thing that reds if a future edit re-gates this on a capability. The
 * negatives guard the other side — above all the `null` viewer, where `null === null`
 * would otherwise hand every UN-assigned phase to an unidentified viewer.
 */

const VIEWER = "11111111-1111-1111-1111-111111111111";
const SOMEONE_ELSE = "22222222-2222-2222-2222-222222222222";

function phase(status: CasePhaseStatus, assignedTo: string | null = null) {
  return { status, assignedTo };
}

describe("isAssignedTo", () => {
  it("is true only for the viewer named on the row", () => {
    expect(isAssignedTo(VIEWER, VIEWER)).toBe(true);
    expect(isAssignedTo(SOMEONE_ELSE, VIEWER)).toBe(false);
  });

  it("is false for an UN-assigned row, even when the viewer is unknown", () => {
    // The footgun: `null === null` would be `true` without the explicit guard, so an
    // unidentified viewer would own every unassigned row on the page.
    expect(isAssignedTo(null, null)).toBe(false);
    expect(isAssignedTo(null, VIEWER)).toBe(false);
    expect(isAssignedTo(VIEWER, null)).toBe(false);
  });
});

describe("canFillAssignedPhase — the ADMITTED case", () => {
  it("offers the fill action on an ACTIVE phase assigned to the viewer", () => {
    expect(canFillAssignedPhase(phase("active", VIEWER), true, VIEWER)).toBe(true);
  });

  it("ignores who else is on the case — only the row's own assignee matters", () => {
    // The under-grant D8 closes was capability-shaped: `CoordinatorPhaseActions`
    // rendered nothing for a viewer who was neither coordinator nor
    // `assign_case_phases`. There is no argument here that could carry that
    // distinction, so a coordinator-assignee and a plain-member-assignee are the SAME
    // call — and both must be admitted.
    expect(canFillAssignedPhase(phase("active", VIEWER), true, VIEWER)).toBe(true);
    expect(
      canFillAssignedPhase(phase("active", SOMEONE_ELSE), true, SOMEONE_ELSE),
    ).toBe(true);
  });
});

describe("canFillAssignedPhase — the REFUSED cases", () => {
  it("refuses a phase assigned to someone else, in every status", () => {
    const statuses: CasePhaseStatus[] = [
      "pending",
      "active",
      "completed",
      "not_required",
      "voided",
    ];
    for (const status of statuses) {
      expect(canFillAssignedPhase(phase(status, SOMEONE_ELSE), true, VIEWER)).toBe(
        false,
      );
    }
  });

  it("refuses every status other than `active`, even for the assignee", () => {
    const statuses: CasePhaseStatus[] = [
      "pending",
      "completed",
      "not_required",
      "voided",
    ];
    for (const status of statuses) {
      expect(canFillAssignedPhase(phase(status, VIEWER), true, VIEWER)).toBe(false);
    }
  });

  it("refuses an UN-assigned active phase, including for an unknown viewer", () => {
    expect(canFillAssignedPhase(phase("active", null), true, VIEWER)).toBe(false);
    expect(canFillAssignedPhase(phase("active", null), true, null)).toBe(false);
  });

  it("refuses on a terminal case", () => {
    expect(canFillAssignedPhase(phase("active", VIEWER), false, VIEWER)).toBe(false);
  });
});
