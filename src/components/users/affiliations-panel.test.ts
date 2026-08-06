import { describe, expect, it } from 'vitest'

import rolesFixture from '@/lib/members/__fixtures__/membership-roles.json'

import { ROLE_LABELS } from '@/components/users/affiliations-panel'

/**
 * BUG-AFF-N1 — the pt-BR end of the membership-role chain.
 *
 * The blockers list in `AffiliationsPanel` renders one pt-BR label per seat that is
 * preventing an affiliation from being ended (ADR 0097 D5). `role` arrives from
 * PostgreSQL as raw TEXT, so a role with no entry in `ROLE_LABELS` falls through
 * `roleLabel`'s `?? role` fallback and renders an English snake_case identifier inside a
 * pt-BR `role="alert"` — Rule 10. QA caught exactly that defect on the hospital-tier arm
 * of this list (BUG-AFF-F1); it survived lint, typecheck, the unit suite and a full E2E
 * gate because no test reaches the branch — every blockers case anyone had ever rendered
 * was a commission seat.
 *
 * ⚠ WHAT THE AUTHORITY IS, AND WHAT THIS FILE CAN ACTUALLY SEE.
 * The authority is the CHECK constraint `memberships_role_check`. It is a CHECK over
 * `text`, NOT a Postgres enum, so the role list appears nowhere in
 * `src/lib/types/database.ts` (`grep technical_director_deputy` → no hits), and
 * **Vitest cannot reach the database at all**. This file therefore does not read the
 * authority. It reads the committed fixture
 * `src/lib/members/__fixtures__/membership-roles.json`, and it is the last of three
 * gates that together keep that fixture tied to the authority:
 *
 *   authority   `memberships_role_check`  (pg_constraint — the only truth)
 *      │
 *      ├─ pgTAP `304` §10 : fixture set == live CHECK set, exact, both directions
 *      ├─ `src/lib/members/membership-roles.test.ts` : the JSON == the copy embedded in 304
 *      └─ THIS FILE       : every role in the JSON has a pt-BR label
 *
 * Widen the CHECK and the loop runs: `304` reds (fixture stale) → the author regenerates
 * the fixture → this file reds (missing label). The fixture is imported, never
 * transcribed — a second copy of the role list here would be the defect, not the fix.
 *
 * ⚠ WHAT THIS FILE DOES NOT DO. Stated because the header it replaces claimed a power the
 * code lacked, and this workstream has now shipped that mistake three times:
 *
 *  - It does not observe the database. Widening the CHECK does **not** red this file.
 *    Only pgTAP `304` §10 notices that, and only when `npm run test:db` runs against a
 *    live DB. If the CHECK is widened and the fixture is never regenerated, this file
 *    stays green over a stale list.
 *  - It is a BUILD-TIME gate, not a runtime guard. Nothing here executes at request time;
 *    the `?? role` fail-soft still renders a raw identifier if a label is ever missing in
 *    production.
 *  - It does not fire until the suites run.
 */

describe('AffiliationsPanel role labels', () => {
  it('labels every role in the membership-role fixture', () => {
    const missing = rolesFixture.roles.filter((role) => !(role in ROLE_LABELS))
    expect(missing).toEqual([])
  })

  it('carries no label for a role outside the fixture', () => {
    // The map must not drift the OTHER way either: a stale label for a removed role is
    // dead pt-BR that a reader will mistake for a live case.
    const known = new Set<string>(rolesFixture.roles)
    expect(Object.keys(ROLE_LABELS).filter((r) => !known.has(r))).toEqual([])
  })

  it('has no label that is still an untranslated identifier', () => {
    // A "label" equal to its own key means someone added the role and forgot the
    // translation — which reads as English in the UI just the same. The fixture cannot
    // catch this: a role can be present AND labelled with its own key.
    const untranslated = Object.entries(ROLE_LABELS).filter(
      ([role, label]) => label === role || /^[a-z][a-z0-9_]*$/.test(label),
    )
    expect(untranslated).toEqual([])
  })
})
