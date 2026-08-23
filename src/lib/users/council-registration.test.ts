import { describe, expect, it } from 'vitest'

import { formatCouncilRegistration } from './types'

/**
 * AFF2 B8 — the directory's "Registro" cell composition, and the trailing-UF deduplication.
 *
 * ⚠ THIS IS NOT A COSMETIC TEST. Measured 2026-08-23: BOTH seeded `professional_credentials`
 * rows store the UF inside `registration_number` (`123456-SP` alongside
 * `issuing_state = 'SP'`), so the naive composition rendered "CRM/SP 123456-SP" for **100%
 * of the seed** — every reviewer, every E2E screenshot, and the PO. The fix lives in the
 * formatter rather than in `seed.sql` because the seed is a contract with ~900 tests, and
 * because nothing stops a real user typing the UF into the number field: only the formatter
 * protects live input.
 *
 * ⭐ THE DISCRIMINATING CASE IS §2's MISMATCH. A formatter that stripped ANY trailing
 * `-<UF>` would pass every arm in §1 and silently destroy data: `CRM/SP 123456-RJ` is a
 * number whose suffix disagrees with the credential's own state, which is a fact worth
 * showing, not noise to swallow. Without §2 this test would license the wrong fix.
 */

describe('§1 the duplicated UF is removed', () => {
  it('strips a trailing -<UF> that matches the credential state (the seeded shape)', () => {
    expect(formatCouncilRegistration('CRM', 'SP', '123456-SP')).toBe('CRM/SP 123456')
  })

  it('is case-insensitive on the suffix', () => {
    expect(formatCouncilRegistration('COREN', 'SP', '654321-sp')).toBe('COREN/SP 654321')
  })

  it('leaves a number with no suffix untouched', () => {
    expect(formatCouncilRegistration('CRM', 'SP', '152984')).toBe('CRM/SP 152984')
  })
})

describe('§2 ⭐ a MISMATCHED UF is preserved — the arm that pins the rule', () => {
  it('keeps a trailing UF that differs from the credential state', () => {
    // A registration issued in one state and recorded under another is real data. Swallowing
    // it would hide a discrepancy an admin needs to see.
    expect(formatCouncilRegistration('CRM', 'SP', '123456-RJ')).toBe('CRM/SP 123456-RJ')
  })

  it('does not strip a suffix that merely ENDS with the state letters', () => {
    // `-ESP` ends with `SP` but is not `-SP`. A `.endsWith(state)` check without the hyphen
    // would corrupt this; the guard is `endsWith('-' + state)`.
    expect(formatCouncilRegistration('CRM', 'SP', '123456-ESP')).toBe('CRM/SP 123456-ESP')
  })
})

describe('§3 shape and whitespace', () => {
  it('omits the slash when there is no state', () => {
    expect(formatCouncilRegistration('RMS', '', '99887')).toBe('RMS 99887')
  })

  it('trims all three parts', () => {
    expect(formatCouncilRegistration('  CRM ', ' SP ', ' 123456-SP ')).toBe('CRM/SP 123456')
  })

  it('never emits a dangling separator when the number is empty', () => {
    // A credential row cannot have an empty registration_number (NOT NULL + the action
    // trims and refuses), but the formatter must not produce "CRM/SP " if one arrives.
    expect(formatCouncilRegistration('CRM', 'SP', '')).toBe('CRM/SP')
  })
})
