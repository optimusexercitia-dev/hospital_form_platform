import { describe, expect, it } from 'vitest'

import { ROLE_LABELS } from '@/components/users/affiliations-panel'

/**
 * The blockers list in `AffiliationsPanel` renders a pt-BR label per seat that is
 * preventing an affiliation from being ended (ADR 0097 D5). The `role` value arrives
 * from PostgreSQL as the raw enum TEXT, so any role without a label here would render
 * as an English snake_case identifier inside a pt-BR `role="alert"` — Rule 10.
 *
 * ⚠ WHY THIS TEST EXISTS AT ALL. QA found exactly that class of defect on the
 * HOSPITAL-TIER arm of that list — the arm the external audit's MEDIUM-3 added so a
 * sitting technical director's seat cannot be orphaned. It survived lint, typecheck,
 * 1003 unit tests and a full E2E gate because **no test reaches the branch**: every
 * blockers case anyone had ever rendered was a commission seat. A green bar over code
 * nothing executes.
 *
 * So the completeness of the label map is asserted here rather than left to a comment.
 * The list below is transcribed from the LIVE CATALOG, which is the authority:
 *
 *   select pg_get_constraintdef(oid) from pg_constraint
 *    where conname = 'memberships_role_check';
 *
 * If `backend` widens that CHECK, this test goes red and the new role gets a pt-BR
 * label before it can ever reach a user. That is the point — it is the executable form
 * of a claim that would otherwise rot silently.
 */
const ROLES_FROM_MEMBERSHIPS_ROLE_CHECK = [
  'org_admin',
  'nsp_org_admin',
  'hospital_admin',
  'nsp_coordinator',
  'staff_admin',
  'staff',
  'pqs_member',
  'technical_director',
  'technical_director_deputy',
] as const

describe('AffiliationsPanel role labels', () => {
  it('labels every role `memberships_role_check` permits', () => {
    const missing = ROLES_FROM_MEMBERSHIPS_ROLE_CHECK.filter(
      (role) => !(role in ROLE_LABELS),
    )
    expect(missing).toEqual([])
  })

  it('carries no label for a role the CHECK does not permit', () => {
    // The map must not drift the OTHER way either: a stale label for a removed role is
    // dead pt-BR that a reader will mistake for a live case.
    const known = new Set<string>(ROLES_FROM_MEMBERSHIPS_ROLE_CHECK)
    expect(Object.keys(ROLE_LABELS).filter((r) => !known.has(r))).toEqual([])
  })

  it('has no label that is still an untranslated identifier', () => {
    // A "label" equal to its own key means someone added the role and forgot the
    // translation — which reads as English in the UI just the same.
    const untranslated = Object.entries(ROLE_LABELS).filter(
      ([role, label]) => label === role || /^[a-z][a-z0-9_]*$/.test(label),
    )
    expect(untranslated).toEqual([])
  })
})
