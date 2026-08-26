import { describe, expect, it } from 'vitest'

import { parseBlockers } from './blockers'

/**
 * ⭐ AFF4 B2 — THE D3 BLOCKER ENUMERATION MUST SURVIVE THE TS BOUNDARY.
 *
 * `app.end_org_affiliation_impl` emits FOUR fields per blocker; `parseBlockers` kept two.
 * A `hospital_affiliation` blocker — the MOST COMMON kind — carries its identity in
 * `hospital` and has `role IS NULL`, so the wizard rendered the bare string
 * " — cargo do hospital": no name, and mislabelled as a role.
 *
 * ⛔ ON THE SHAPE OF THESE ASSERTIONS. The E2E that was supposed to cover this asserted
 * `not.toHaveCount(0)` on the `<li>` while its title claimed it checked "the active hospital
 * affiliation NAMED" — a list item is rendered by the DEFECTIVE code too, so the test could
 * not fail for the defect it was named for. Every assertion here therefore names a VALUE the
 * defect destroys, never a container's existence.
 *
 * ⚠ THE FIXTURES ARE TRANSCRIBED FROM THE LIVE CATALOG (`pg_proc.prosrc`), not from the
 * migration text and not from the TS type — the whole defect was TS disagreeing with the
 * door about what a blocker is, so the TS type cannot be this test's oracle.
 */

/** HC0R6 `app.end_org_affiliation_impl`, `kind = 'hospital_affiliation'` arm. */
const HOSPITAL_AFFILIATION_BLOCKER = JSON.stringify([
  {
    kind: 'hospital_affiliation',
    role: null,
    hospital: 'Hospital Central Rede A',
    commission: null,
  },
])

/** HC0R6, `kind = 'membership'` arm — commission-tier seat. */
const MEMBERSHIP_BLOCKER = JSON.stringify([
  {
    kind: 'membership',
    role: 'staff_admin',
    hospital: 'Hospital Central Rede A',
    commission: 'CCIH',
  },
])

/** HC0R1 `app.end_affiliation_impl` — a two-field payload, no `kind`, no `hospital`. */
const HOSPITAL_TIER_SEAT = JSON.stringify([{ role: 'hospital_admin', commission: null }])

describe('parseBlockers — the door payload crossing into TS', () => {
  it('⭐ KEEPS THE HOSPITAL NAME of a hospital-affiliation blocker', () => {
    const [blocker] = parseBlockers(HOSPITAL_AFFILIATION_BLOCKER) ?? []
    // The value the defect destroyed. Not "a blocker was produced" — the NAME.
    expect(blocker?.hospital).toBe('Hospital Central Rede A')
  })

  it('⭐ KEEPS `kind`, so the row can be labelled as an affiliation rather than a role', () => {
    const [blocker] = parseBlockers(HOSPITAL_AFFILIATION_BLOCKER) ?? []
    expect(blocker?.kind).toBe('hospital_affiliation')
  })

  it('⭐ reports a hospital-affiliation blocker as having NO role — not an empty-string one', () => {
    // The old parse coerced the door's SQL `null` to `''`, which reads as "a role whose name
    // we failed to fetch". `null` is the fact: this blocker has no role, it is an employment.
    const [blocker] = parseBlockers(HOSPITAL_AFFILIATION_BLOCKER) ?? []
    expect(blocker?.role).toBeNull()
  })

  it('keeps all four fields of a membership blocker', () => {
    const [blocker] = parseBlockers(MEMBERSHIP_BLOCKER) ?? []
    expect(blocker).toEqual({
      kind: 'membership',
      role: 'staff_admin',
      hospital: 'Hospital Central Rede A',
      commission: 'CCIH',
    })
  })

  it('carries the narrower HC0R1 payload without inventing values', () => {
    // `end_affiliation` emits only {role, commission}. The absent fields must read as
    // absent — a fabricated `kind` would be worse than a missing one.
    const [blocker] = parseBlockers(HOSPITAL_TIER_SEAT) ?? []
    expect(blocker).toEqual({
      kind: null,
      role: 'hospital_admin',
      hospital: null,
      commission: null,
    })
  })

  it('⭐ KEEPS THE HOSPITAL NAME of an HC0RA payload — the sibling arm found while fixing B2', () => {
    // `app.void_org_affiliation_impl` emits `[{hospital}]` and NOTHING else. `toState`'s
    // HC0RA arm discarded `error.details` entirely, so this never reached the parser: the
    // user was told they had blocking hospital links and never told which.
    const [blocker] = parseBlockers(JSON.stringify([{ hospital: 'Hospital Norte' }])) ?? []
    expect(blocker?.hospital).toBe('Hospital Norte')
    expect(blocker?.role, 'HC0RA emits no role — inventing one would be worse than none').toBeNull()
  })

  it('survives a malformed DETAIL without throwing — the refusal still stands', () => {
    expect(parseBlockers('not json at all')).toBeUndefined()
    expect(parseBlockers('{"not":"an array"}')).toBeUndefined()
    expect(parseBlockers(null)).toBeUndefined()
    expect(parseBlockers(undefined)).toBeUndefined()
  })
})
