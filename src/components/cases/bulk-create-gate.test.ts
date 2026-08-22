/**
 * The bulk-creation affordance gate (ADR 0134 Amendment 7).
 *
 * ⭐ WHAT THIS COVERS, AND WHAT IT DOES NOT. It pins the PREDICATE the two surfaces
 * share — the `multiplos` route's own gate and the board's "Múltiplos casos" link.
 * It does NOT drive either route; no test in this repo renders them, so a regression
 * that stops calling `canBulkCreateCases` is invisible here. The value is that the
 * predicate cannot drift from the door, and that the two surfaces cannot drift from
 * each other, because there is only one of it.
 *
 * ⛔ THE TWO-KEY PROPERTY IS THE POINT. `create_cases` alone passing this gate is the
 * exact defect the amendment exists to prevent: bulk is a composition whose per-row
 * loop calls `activate_phase`, so a one-key delegate is admitted by the outer gate and
 * refused inside the loop, rolling back up to 200 rows. The `create_cases`-only case
 * below is therefore a REQUIRED red, not an edge case.
 *
 * ⭐ NEUTRALIZATION RECORD (run 2026-08-22): relaxing the predicate to a single key
 * (`return canInCommission(access, "create_cases")`) turns the "refuses a delegate
 * holding only create_cases" test RED. Widening is what this file exists to catch.
 */

import { describe, expect, it } from "vitest";

import {
  canBulkCreateCases,
  canUseAllPhasesScope,
} from "./bulk-create-gate";
import type { MemberCapability } from "@/lib/queries/members";

function access(
  role: "staff_admin" | "staff" | null,
  capabilities: MemberCapability[] = [],
) {
  return { role, capabilities } as const;
}

const BOTH_KEYS: MemberCapability[] = ["create_cases", "assign_case_phases"];

describe("canBulkCreateCases — the TS mirror of bulk_create_cases' gate", () => {
  it("admits the commission coordinator", () => {
    expect(canBulkCreateCases(access("staff_admin"))).toBe(true);
  });

  it("admits a delegate holding BOTH keys", () => {
    expect(canBulkCreateCases(access("staff", BOTH_KEYS))).toBe(true);
  });

  it("refuses a delegate holding only create_cases", () => {
    // ⛔ The door would admit them at the outer gate and refuse them inside the
    // per-row loop. A one-key mirror offers a wizard the DB always rejects.
    expect(canBulkCreateCases(access("staff", ["create_cases"]))).toBe(false);
  });

  it("refuses a delegate holding only assign_case_phases", () => {
    expect(canBulkCreateCases(access("staff", ["assign_case_phases"]))).toBe(false);
  });

  it("refuses a plain member with neither key", () => {
    expect(canBulkCreateCases(access("staff"))).toBe(false);
  });

  it("refuses a non-member even when capabilities are present", () => {
    // The membership arm: a quality-office reader arrives with `role: null` and a
    // populated capabilities array. The door is membership-aware; so is this.
    expect(canBulkCreateCases(access(null, BOTH_KEYS))).toBe(false);
  });
});

describe("canUseAllPhasesScope — mirrors a refusal the door makes at its gate", () => {
  it("admits only the coordinator", () => {
    expect(canUseAllPhasesScope(access("staff_admin"))).toBe(true);
  });

  it("refuses a delegate who may otherwise bulk-create", () => {
    // Holding both bulk keys does NOT confer the scope: the door's per-row loop calls
    // `assign_narrative`, gated on `is_staff_admin_of` alone, which no ADR-0061
    // capability can satisfy.
    expect(canBulkCreateCases(access("staff", BOTH_KEYS))).toBe(true);
    expect(canUseAllPhasesScope(access("staff", BOTH_KEYS))).toBe(false);
  });

  it("refuses a non-member", () => {
    expect(canUseAllPhasesScope(access(null))).toBe(false);
  });
});
