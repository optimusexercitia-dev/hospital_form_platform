/**
 * Unit coverage for `isDashboardCountable` — the TS twin of the SQL helper
 * `app.submitted_form_responses` (Architecture Rule 3 / Rule 9 parity). SUP
 * (ADR 0074) extended its input with `hasSubmittedSuccessor`; this truth table
 * locks the four cases the plan (§8 Vitest) requires: submitted + standalone +
 * no successor => true; a submitted successor => false; in_progress => false;
 * case-phase => false.
 */

import { describe, expect, it } from 'vitest'

import { isDashboardCountable } from './dashboard'

describe('isDashboardCountable', () => {
  it('counts a submitted, standalone response with no submitted successor', () => {
    expect(
      isDashboardCountable({
        status: 'submitted',
        casePhaseId: null,
        hasSubmittedSuccessor: false,
      }),
    ).toBe(true)
  })

  it('excludes a submitted response that has a SUBMITTED successor (SUP correction)', () => {
    expect(
      isDashboardCountable({
        status: 'submitted',
        casePhaseId: null,
        hasSubmittedSuccessor: true,
      }),
    ).toBe(false)
  })

  it('excludes an in_progress response regardless of hasSubmittedSuccessor', () => {
    expect(
      isDashboardCountable({
        status: 'in_progress',
        casePhaseId: null,
        hasSubmittedSuccessor: false,
      }),
    ).toBe(false)
  })

  it('excludes a case-phase response even when submitted with no successor', () => {
    expect(
      isDashboardCountable({
        status: 'submitted',
        casePhaseId: 'phase-1',
        hasSubmittedSuccessor: false,
      }),
    ).toBe(false)
  })
})
