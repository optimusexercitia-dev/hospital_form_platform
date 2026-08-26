/**
 * AFF4 B2 — the blocker list names what it is refusing to let go of.
 *
 * ⛔ THE DEFECT, as the string it actually rendered. `parseBlockers` kept only the
 * INTERSECTION of the shapes its three doors emit — `{role, commission}` — so HC0R6's
 * `kind` and `hospital` were discarded before any component saw them. A
 * `kind: 'hospital_affiliation'` blocker has `role: null` by construction (it is not a
 * seat, it has no role), so both render sites produced:
 *
 *     " — cargo do hospital"
 *
 * A bare suffix. No hospital name, an empty label where the noun should be, and the
 * generic phrase asserting it is a POST at the hospital when it is the EMPLOYMENT ITSELF.
 * And it is the most common blocker kind: it is what an org admin hits every time they try
 * to offboard someone who still works at a hospital.
 *
 * ⚠ THE NO-REGRESSION TWIN IS HALF THIS FILE, and that is deliberate. `kind` is emitted by
 * ONE of the three producing doors; HC0R1 and HC0R9 send `kind: null` and their blockers
 * are all memberships, which the pre-existing role path named correctly. A `kind`-driven
 * repair that did not pin those would fix the broken door by breaking the two working ones
 * — so every `kind: null` case below asserts the EXACT pre-repair string, character for
 * character. If one of them changes, that is a regression, not an improvement.
 *
 * ⚠ WHAT THIS FILE CANNOT SEE. It does not observe the database. The claim "HC0R1 emits no
 * `kind`" is `AffiliationBlocker`'s, derived from `pg_proc.prosrc`; if a door starts
 * emitting a different payload, nothing here reds — the fixtures below would simply be
 * describing a shape that no longer occurs. What this file does pin is that GIVEN each
 * documented payload, the rendered pt-BR is right.
 */

import { describe, expect, it } from 'vitest'

import type { AffiliationBlocker } from '@/lib/affiliations/actions'
import {
  ROLE_LABELS,
  blockerKey,
  blockerLabel,
} from '@/components/users/affiliation-blocker-label'

function blocker(overrides: Partial<AffiliationBlocker> = {}): AffiliationBlocker {
  return { kind: null, role: null, hospital: null, commission: null, ...overrides }
}

describe('blockerLabel — HC0R6, the door that emits `kind`', () => {
  it('⭐ THE DEFECT: a hospital-affiliation blocker is NAMED, and names its hospital', () => {
    const label = blockerLabel(
      blocker({ kind: 'hospital_affiliation', hospital: 'Hospital Central' }),
    )

    expect(label).toBe('Vínculo hospitalar — Hospital Central')
    // The three properties of the old output, asserted as absences so this cannot go
    // green on a string that merely CONTAINS the right words.
    expect(label).not.toMatch(/^\s*—/) // no longer starts with a bare em dash
    expect(label).not.toContain('cargo do hospital') // no longer claims to be a post
    expect(label).toContain('Hospital Central') // the name is no longer discarded
  })

  it('a membership blocker in another hospital says WHICH hospital the post is at', () => {
    // HC0R6's `membership` arm: role set, hospital named, no commission — a hospital-tier
    // seat. Before the repair the hospital name was dropped and this read
    // "Coordenação do NSP — cargo do hospital", which hospital being the admin's problem.
    expect(
      blockerLabel(
        blocker({
          kind: 'membership',
          role: 'nsp_coordinator',
          hospital: 'Hospital Norte',
        }),
      ),
    ).toBe('Coordenação do NSP — cargo no Hospital Norte')
  })

  it('a committee seat names the committee, not the hospital it sits under', () => {
    // The commission is the actionable location — it is the page the admin must visit —
    // so it wins over the hospital name even when the door emits both.
    expect(
      blockerLabel(
        blocker({
          kind: 'membership',
          role: 'staff_admin',
          hospital: 'Hospital Central',
          commission: 'CCIH',
        }),
      ),
    ).toBe('Coordenação — CCIH')
  })

  it('says nothing rather than something untrue when an affiliation has no name', () => {
    // Fail-soft. "cargo do hospital" would be false here: there is no post involved.
    expect(blockerLabel(blocker({ kind: 'hospital_affiliation' }))).toBe(
      'Vínculo hospitalar',
    )
  })

  it('labels an org-tier affiliation with the vocabulary the actions already use', () => {
    // No door emits this today; it is a fail-soft branch, present so an added `kind`
    // degrades into a named row rather than into the role path's "Função".
    expect(blockerLabel(blocker({ kind: 'org_affiliation' }))).toBe(
      'Vínculo organizacional',
    )
  })
})

describe('blockerLabel — HC0R1 / HC0R9, the doors that emit NO `kind`', () => {
  // ⛔ Every expectation in this block is the EXACT pre-repair string. These doors were
  // never broken; the point of asserting them is that the `kind` repair left them alone.

  it('⭐ NO REGRESSION: a committee seat renders exactly as it did before', () => {
    expect(blockerLabel(blocker({ role: 'staff', commission: 'CCIH' }))).toBe(
      'Membro — CCIH',
    )
  })

  it('⭐ NO REGRESSION: a hospital-tier seat still says "cargo do hospital"', () => {
    // The generic phrase is CORRECT here and must survive: this door emits no hospital
    // name, and a hospital-tier seat has no committee to point at — saying so is what
    // tells the admin to look outside the committee pages.
    expect(blockerLabel(blocker({ role: 'technical_director' }))).toBe(
      'Direção técnica — cargo do hospital',
    )
  })

  it('falls back to a nameable noun for a seat with no role at all', () => {
    // Unreachable from these doors (a membership always has a role) and kept as a
    // fail-soft: an unnamed row is worse than a generically-named one.
    expect(blockerLabel(blocker({ commission: 'Farmácia' }))).toBe('Função — Farmácia')
  })

  it('renders a raw role identifier rather than nothing, if a label is ever missing', () => {
    // The `?? role` fail-soft. `affiliations-panel.test.ts` is what keeps this
    // unreachable; this asserts what happens on the day it is not.
    expect('cargo_inventado' in ROLE_LABELS).toBe(false)
    expect(blockerLabel(blocker({ role: 'cargo_inventado' }))).toBe(
      'cargo_inventado — cargo do hospital',
    )
  })
})

describe('blockerLabel — HC0RA, a blocker that is ONLY a hospital name', () => {
  /**
   * ⛔ THIS ARM ARRIVES WITHOUT `kind` AND WITHOUT `role`. `void_org_affiliation` refused
   * because hospital ties remain emits `[{hospital}]` and nothing else. Dispatching on
   * `kind` alone would send it down the role path and render "Função — cargo no Hospital
   * Central" — a nameless role at a hospital, which is the SAME defect this module exists
   * to fix, reached from a different door.
   *
   * ⚠ WRITTEN AHEAD OF THE ARM THAT PRODUCES IT. `toState`'s HC0RA case discards
   * `error.details` today, so this payload cannot reach a render site yet; backend is
   * passing it through. The test is here now because the render side must not be the thing
   * that has to be discovered later — the same reason `toState` carries SQLSTATE arms
   * before the doors that raise them.
   */
  it('⭐ is named as an employment, not as a role that is missing', () => {
    const label = blockerLabel(blocker({ hospital: 'Hospital Central' }))

    expect(label).toBe('Vínculo hospitalar — Hospital Central')
    // The failure this arm would otherwise reproduce, asserted as an absence.
    expect(label).not.toContain('Função')
    expect(label).not.toContain('cargo')
  })

  it('a seat at a named hospital is still a seat — the inference does not over-reach', () => {
    // The differential for `isEmploymentTie`'s structural clause: same `hospital`, one
    // variable changed (a role present). `memberships.role` is NOT NULL, so a role is
    // exactly what separates a post from an employment, and this pins that it is read
    // that way rather than the hospital name alone deciding.
    expect(
      blockerLabel(blocker({ role: 'hospital_admin', hospital: 'Hospital Central' })),
    ).toBe('Administração do hospital — cargo no Hospital Central')
  })
})

describe('blockerKey', () => {
  it('⭐ keeps TWO IDENTICAL blockers distinct, so neither row is dropped', () => {
    // Two seats can be identical in every field the DETAIL carries — same role, two
    // commissions sharing a name. A colliding key silently renders one of them, and the
    // admin then clears the one they can see and cannot understand why the refusal stands.
    const b = blocker({ role: 'staff', commission: 'CCIH' })
    expect(blockerKey(b, 0)).not.toBe(blockerKey(b, 1))
  })

  it('distinguishes blockers that differ only in a field the old key ignored', () => {
    // The pre-repair key was `${role}-${commission ?? "hospital"}-${i}`, which could not
    // see `kind` or `hospital` — the two fields the whole bug was about.
    const a = blocker({ kind: 'hospital_affiliation', hospital: 'Hospital Central' })
    const c = blocker({ kind: 'hospital_affiliation', hospital: 'Hospital Norte' })
    expect(blockerKey(a, 0)).not.toBe(blockerKey(c, 0))
  })
})
