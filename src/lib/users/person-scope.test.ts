import { describe, expect, it } from 'vitest'

import {
  personScopeAllows,
  type PersonFootprint,
  type PersonScopeCapability,
} from './person-scope'

/**
 * ADR 0133 D1–D4 + Amendment 1 ruling 1 — the footprint rule, driven directly.
 *
 * This file tests the DECISION in isolation; `d14-person-level.test.ts` tests that the
 * real actions reach it. Both are needed and neither substitutes for the other: a
 * perfect predicate wired to nothing is the recorded "a correct door nothing can reach"
 * shape, and a correctly-wired action calling a wrong predicate passes every wiring test.
 *
 * ⭐ THE MATRIX IS ITS OWN VACUITY CONTROL, by construction. Every capability is asserted
 * on every fixture — so the CROSS-HOSPITAL row (§2) states `fields: allow` and
 * `lifecycle: deny` over the SAME footprint and the SAME administered set. Nothing but a
 * genuine intersection/subset split can satisfy that row. Collapse the two bounds into one
 * — in either direction, which is the single most likely regression here — and §2 reds
 * immediately. A separate "prove it can fail" control would be weaker than that, because
 * it would test a mutant instead of the property.
 */

const H1 = 'hospital-1'
const H2 = 'hospital-2'
const H3 = 'hospital-3'

const ALL: PersonScopeCapability[] = [
  'fields',
  'credentials',
  'cpf_change',
  'lifecycle',
]

function footprint(
  hospitalIds: string[],
  hasNonCommissionTierMembership = false,
): PersonFootprint {
  return { hospitalIds, hasNonCommissionTierMembership }
}

/** Assert all four capabilities at once, so no arm can be quietly left unstated. */
function expectAll(
  fp: PersonFootprint,
  administered: string[],
  expected: Record<PersonScopeCapability, boolean>,
  why: string,
): void {
  for (const cap of ALL) {
    expect(
      personScopeAllows(cap, fp, administered),
      `${why} — capability "${cap}"`,
    ).toBe(expected[cap])
  }
}

describe('§1 sole-hospital target — the founding scenario', () => {
  it('an admin of the ONLY hospital in the footprint holds all four capabilities', () => {
    expectAll(footprint([H1]), [H1], {
      fields: true,
      credentials: true,
      cpf_change: true,
      lifecycle: true,
    }, 'sole-footprint person, caller administers that hospital')
  })

  it('the footprint may come from a COMMISSION seat alone, with no affiliation', () => {
    // The resolver unions both sources; from this function's side they are one list.
    // Asserted so the "affiliations only" footprint the ADR rejected cannot creep back
    // in as an implicit assumption about what hospitalIds contains.
    expectAll(footprint([H2]), [H2], {
      fields: true,
      credentials: true,
      cpf_change: true,
      lifecycle: true,
    }, 'footprint sourced from a commission seat')
  })
})

describe('§2 ⭐ THE AMENDMENT-1 SPLIT — one target, four verdicts, two of each', () => {
  // This is the sharpest keystone in the workstream. The person serves at H1 and H2; the
  // caller administers H1 only. Amendment 1 ruling 1: the local-knowledge argument holds
  // for a name fix at EVERY hospital the person serves, but a CPF rewrite is a person-key
  // identity event and deactivation is cross-hospital denial of access — neither is local.
  const crossHospital = footprint([H1, H2])

  it('field edits and credentials are ALLOWED; CPF change and lifecycle are DENIED', () => {
    expectAll(crossHospital, [H1], {
      fields: true,
      credentials: true,
      cpf_change: false,
      lifecycle: false,
    }, 'cross-hospital person, caller administers ONE of their two hospitals')
  })

  it('the split is REAL: at least one capability disagrees with another on these inputs', () => {
    // Stated as its own assertion rather than left implicit in the row above, because
    // "all four false" and "all four true" would both be *internally consistent* answers
    // from a collapsed implementation — and a reader skimming §2 could mistake a uniform
    // row for a passing one. This cannot be satisfied by any single-bound implementation.
    const verdicts = ALL.map((c) => personScopeAllows(c, crossHospital, [H1]))
    expect(
      new Set(verdicts).size,
      'the four capabilities must NOT share one bound (Amdt 1 ruling 1)',
    ).toBe(2)
  })

  it('administering the WHOLE footprint restores the subset capabilities', () => {
    // The other side of §2's pair: the subset bound is not "cross-hospital people are
    // untouchable", it is "you must administer all of it". Without this arm, an
    // implementation that hardcoded `hospitalIds.length > 1 → deny` would pass §2.
    expectAll(crossHospital, [H1, H2], {
      fields: true,
      credentials: true,
      cpf_change: true,
      lifecycle: true,
    }, 'cross-hospital person, caller administers BOTH hospitals')
  })

  it('a superset of administered hospitals is still a superset', () => {
    expectAll(crossHospital, [H1, H2, H3], {
      fields: true,
      credentials: true,
      cpf_change: true,
      lifecycle: true,
    }, 'caller administers more hospitals than the person serves')
  })
})

describe('§3 D2 — tier pushes the person to org_admin-only, for EVERY capability', () => {
  it('an org-tier or hospital-tier membership denies all four, even inside the footprint', () => {
    // Amendment 1 ruling 2 left D2 untouched: the tier rule is NOT relaxed for the
    // intersection capabilities. Fixture is deliberately the most permissive one possible
    // — sole hospital, caller administers it — so ONLY the tier flag can produce the deny.
    expectAll(footprint([H1], true), [H1], {
      fields: false,
      credentials: false,
      cpf_change: false,
      lifecycle: false,
    }, "tiered person at the caller's OWN hospital — the sharp case (ADR 0051 D4: their appointment chain is not the hospital admin's)")
  })

  it('CONTROL: the identical fixture WITHOUT the tier flag allows all four', () => {
    // Proves §3's denies come from the tier flag and nothing else. Without this the row
    // above is satisfiable by any fixture the implementation happens to reject.
    expectAll(footprint([H1], false), [H1], {
      fields: true,
      credentials: true,
      cpf_change: true,
      lifecycle: true,
    }, 'same fixture, tier flag cleared')
  })
})

describe('§4 empty sets — where the subset bound inverts if it is derived rather than pinned', () => {
  it('⭐ a ZERO-footprint person is denied all four, subset capabilities INCLUDED', () => {
    // ∅ ⊆ anything is TRUE, so a naive subset implementation returns ALLOW here and a
    // zero-footprint person becomes MORE manageable than a sole-hospital one. D2 says the
    // opposite: an unaffiliated, uncommitteed person belongs to no hospital and is
    // org_admin-only. The intersection capabilities would deny anyway (∅ ∩ X = ∅), which
    // is exactly why this must be pinned rather than trusted to the maths — half of it
    // would be right by accident.
    expectAll(footprint([]), [H1], {
      fields: false,
      credentials: false,
      cpf_change: false,
      lifecycle: false,
    }, 'zero-footprint person')
  })

  it('a caller who administers NO hospital is denied all four', () => {
    // The other empty set. Also the reason `personScopeAllows` must never be reached for
    // an org_admin: an org_admin legitimately administers zero HOSPITALS, and answering
    // this question about them at all would be the wrong question.
    expectAll(footprint([H1]), [], {
      fields: false,
      credentials: false,
      cpf_change: false,
      lifecycle: false,
    }, 'caller administers nothing')
  })

  it('both empty is still denied (no vacuous ∅ ⊆ ∅ allow)', () => {
    expectAll(footprint([]), [], {
      fields: false,
      credentials: false,
      cpf_change: false,
      lifecycle: false,
    }, 'both sets empty')
  })
})

describe('§5 disjoint sets — the sibling hospital', () => {
  it("a sibling hospital's admin is denied all four", () => {
    expectAll(footprint([H1]), [H2], {
      fields: false,
      credentials: false,
      cpf_change: false,
      lifecycle: false,
    }, 'sibling-hospital admin, disjoint from the footprint')
  })

  it('partial overlap does NOT satisfy the subset bound', () => {
    // Person at H1+H2+H3, caller administers H1+H2. Intersection is non-empty so fields
    // pass; H3 is outside, so the subset capabilities must not.
    expectAll(footprint([H1, H2, H3]), [H1, H2], {
      fields: true,
      credentials: true,
      cpf_change: false,
      lifecycle: false,
    }, 'two of three hospitals administered')
  })
})

describe('§6 shape robustness', () => {
  it('duplicate hospital ids do not change any verdict', () => {
    // The resolver unions affiliations with commission-seat hospitals, so a person
    // affiliated to H1 AND seated on an H1 commission yields H1 twice. A subset check
    // written with counts rather than sets would break here.
    expectAll(footprint([H1, H1, H2]), [H1, H2], {
      fields: true,
      credentials: true,
      cpf_change: true,
      lifecycle: true,
    }, 'duplicate footprint entries, whole footprint administered')

    expectAll(footprint([H1, H1]), [H1], {
      fields: true,
      credentials: true,
      cpf_change: true,
      lifecycle: true,
    }, 'duplicate footprint entries, sole hospital')
  })
})
