/**
 * Unit coverage for `resolveSupersessionBadge` — the pure badge-merge rule the
 * submissions LIST read uses (SUP / ADR 0074; plan §5 requires badges in
 * response lists AND the detail header). Locks the four-way truth table:
 * a submitted successor => 'substituido'; being a successor => 'atual';
 * neither => null; both => 'substituido' (precedence).
 */

import { describe, expect, it } from 'vitest'

import { resolveSupersessionBadge } from './submissions'

describe('resolveSupersessionBadge', () => {
  it("marks a row with a SUBMITTED successor as 'substituido'", () => {
    expect(
      resolveSupersessionBadge({ hasSubmittedSuccessor: true, isSuccessor: false }),
    ).toBe('substituido')
  })

  it("marks a row that IS a successor as 'atual'", () => {
    expect(
      resolveSupersessionBadge({ hasSubmittedSuccessor: false, isSuccessor: true }),
    ).toBe('atual')
  })

  it('returns null when the row is neither superseded nor a successor', () => {
    expect(
      resolveSupersessionBadge({ hasSubmittedSuccessor: false, isSuccessor: false }),
    ).toBeNull()
  })

  it("prefers 'substituido' when a row is BOTH superseded and a successor", () => {
    expect(
      resolveSupersessionBadge({ hasSubmittedSuccessor: true, isSuccessor: true }),
    ).toBe('substituido')
  })
})
