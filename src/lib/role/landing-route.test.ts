import { describe, expect, it } from 'vitest'

import {
  ROLE_BRANCH,
  ROLE_ORDER,
  landingRouteForRole,
  type PlatformRole,
} from '@/lib/role/role-catalog'
import { partitionGrants, type SessionGrant } from '@/lib/queries/session-grants'

/**
 * ⭐ AE4.8 — THE DIFFERENTIAL FOR THE LANDING REFACTOR.
 *
 * ⛔ WHY THIS FILE EXISTS. `landingRouteForRole` had **zero** tests when AE4.8 rewrote it
 * from eight hand-mirrored `switch` arms into a walk over the shared manifest. The
 * FUP-QO-2 guard covers `src/app/page.tsx` — the OTHER consumer — so the whole suite was
 * green while the function four components actually call for the role switcher was
 * refactored uncovered. A green bar that misses the wired seam is the failure this file
 * closes.
 *
 * ⛔ EVERY EXPECTED VALUE BELOW IS DERIVED FROM THE PRE-REFACTOR IMPLEMENTATION, READ
 * FROM THE OLD CODE — never from running the new one. A pin transcribed from the new
 * implementation would record whatever it does, including a regression, and pass forever.
 * The old arms, for the record:
 *   org_admin        uniqueById(orgs).length === 1 ? orgHref(slug,'manage') : '/o'
 *   hospital_admin   Set(orgSlugs).size === 1 ? orgHref(orgs[0].slug,'manage') : '/o'
 *   nsp_org_admin    sortByName(uniqueById(orgs))[0] ? orgHref(slug,'nsp-org') : '/'
 *   nsp_* / pqs      sortByName(byHospitalName)[0] ? nspHref(org.slug) : '/'
 *   technical_*      sortByName(byHospitalName)[0] ? orgHref(slug,'direcao-tecnica') : '/'
 *   quality_reviewer sortByName(byHospitalName)[0] ? qualidadeHref(slug) : '/'
 *   staff / staff_admin  commissionGrants.length === 1 ? commissionHref(...) : '/c'
 *   platform_admin   '/admin'   ·   default '/'
 *
 * ⚠ The zero-grant rows are UNREACHABLE through the picker (it only offers roles the
 * caller holds) and are pinned anyway — "unreachable" is a claim about today's four
 * callers, and the fallbacks are the least obvious part of the old behaviour.
 */

const org = (n: string) => ({ id: `org-${n}`, slug: `org-${n}`, name: `Org ${n}` })
const hospital = (n: string, orgN: string) => ({
  id: `hosp-${n}`,
  slug: `hosp-${n}`,
  name: `Hospital ${n}`,
  organization_id: `org-${orgN}`,
})
const commission = (n: string, orgN: string) => ({
  id: `com-${n}`,
  name: `Comissão ${n}`,
  slug: `com-${n}`,
  organization: org(orgN),
})

const grant = (
  role: string,
  parts: Partial<Omit<SessionGrant, 'role'>> = {},
): SessionGrant => ({
  role,
  organization: parts.organization ?? null,
  hospital: parts.hospital ?? null,
  commission: parts.commission ?? null,
})

const orgGrant = (role: string, n: string) =>
  grant(role, { organization: org(n) })
const hospitalGrant = (role: string, hospN: string, orgN: string) =>
  grant(role, { organization: org(orgN), hospital: hospital(hospN, orgN) })
const commissionGrant = (role: string, comN: string, orgN: string) =>
  grant(role, { commission: commission(comN, orgN) })

describe('landingRouteForRole — behaviour pinned against the pre-AE4.8 implementation', () => {
  it.each([
    // role, grants, expected
    ['platform_admin', [], '/admin'],
    ['platform_admin', [orgGrant('platform_admin', 'a')], '/admin'],

    ['org_admin', [], '/o'],
    ['org_admin', [orgGrant('org_admin', 'a')], '/o/org-a/manage'],
    ['org_admin', [orgGrant('org_admin', 'a'), orgGrant('org_admin', 'b')], '/o'],
    // Two grants on the SAME org collapse to one distinct org.
    ['org_admin', [orgGrant('org_admin', 'a'), orgGrant('org_admin', 'a')], '/o/org-a/manage'],

    ['hospital_admin', [], '/o'],
    ['hospital_admin', [hospitalGrant('hospital_admin', '1', 'a')], '/o/org-a/manage'],
    // Two hospitals, ONE org → still that org's manage area.
    [
      'hospital_admin',
      [hospitalGrant('hospital_admin', '1', 'a'), hospitalGrant('hospital_admin', '2', 'a')],
      '/o/org-a/manage',
    ],
    // Hospitals across TWO orgs → the org picker.
    [
      'hospital_admin',
      [hospitalGrant('hospital_admin', '1', 'a'), hospitalGrant('hospital_admin', '2', 'b')],
      '/o',
    ],

    ['nsp_org_admin', [], '/'],
    ['nsp_org_admin', [orgGrant('nsp_org_admin', 'a')], '/o/org-a/nsp-org'],

    ['nsp_coordinator', [], '/'],
    ['nsp_coordinator', [hospitalGrant('nsp_coordinator', '1', 'a')], '/o/org-a/nsp'],
    ['pqs_member', [], '/'],
    ['pqs_member', [hospitalGrant('pqs_member', '1', 'a')], '/o/org-a/nsp'],

    ['technical_director', [], '/'],
    [
      'technical_director',
      [hospitalGrant('technical_director', '1', 'a')],
      '/o/org-a/direcao-tecnica',
    ],
    [
      'technical_director_deputy',
      [hospitalGrant('technical_director_deputy', '1', 'a')],
      '/o/org-a/direcao-tecnica',
    ],

    ['quality_reviewer', [], '/'],
    ['quality_reviewer', [hospitalGrant('quality_reviewer', '1', 'a')], '/o/org-a/qualidade'],

    ['staff', [], '/c'],
    ['staff', [commissionGrant('staff', '1', 'a')], '/o/org-a/c/com-1'],
    ['staff', [commissionGrant('staff', '1', 'a'), commissionGrant('staff', '2', 'a')], '/c'],
    ['staff_admin', [], '/c'],
    ['staff_admin', [commissionGrant('staff_admin', '1', 'a')], '/o/org-a/c/com-1'],

    // Not a platform_role at all — the old `default` arm.
    ['administrativo', [], '/'],
    ['not_a_role', [], '/'],
  ])('%s with %j → %s', (role, grants, expected) => {
    expect(landingRouteForRole(role as string, grants as SessionGrant[])).toBe(expected)
  })

  it('resolves a role against ONLY its own grants — the reason it is not page.tsx', () => {
    // A caller holding staff_admin in one commission and staff in another must land on
    // the commission carrying the hat they PICKED, not on the merged /c picker that
    // page.tsx would produce from the same grant list. This is the whole reason the
    // per-role resolver exists alongside the precedence walk.
    const grants = [
      commissionGrant('staff_admin', '1', 'a'),
      commissionGrant('staff', '2', 'a'),
    ]
    expect(landingRouteForRole('staff_admin', grants)).toBe('/o/org-a/c/com-1')
    expect(landingRouteForRole('staff', grants)).toBe('/o/org-a/c/com-2')
  })

  it('partitionGrants routes every role into exactly the branch ROLE_BRANCH declares', () => {
    // ⭐ AE4.8's "the session partition keys off the manifest" bullet, as MEASURED rather
    // than as written. The plan said the partition keys off the manifest's SCOPE
    // declarations — it cannot: `org_admin` and `nsp_org_admin` share a scope
    // (`organization`) and land in DIFFERENT lists, as do `hospital_admin`,
    // `nsp_coordinator` and `quality_reviewer` (all `hospital`). The partition is by
    // BRANCH, and branch is not derivable from scope.
    //
    // ⛔ And it is bound here rather than by rewriting `partitionGrants`. Each of its
    // filters carries a hand-written type predicate that narrows the element type per
    // list (Membership vs OrgAdminMembership vs NspOperatorMembership …); a generic
    // manifest-driven loop would erase those and trade a compile-time guarantee for a
    // runtime one. Binding the OUTPUT gets the same "cannot drift" property, in both
    // directions, at no cost to the types.
    //
    // Each role is fed a MAXIMALLY-populated grant (org + hospital + commission all
    // present), so a role landing in no list has no filter at all — never a missing
    // scope ref. Same construction as the FUP-QO-2 guard's `maximalGrantFor`.
    const mismatches: string[] = []
    for (const code of ROLE_ORDER) {
      if (code === 'platform_admin') continue // its branch is a flag, not a grant list
      const lists = partitionGrants([
        grant(code, {
          organization: org('a'),
          hospital: hospital('1', 'a'),
          commission: commission('1', 'a'),
        }),
      ])
      const populated = (
        Object.keys(lists) as Array<keyof typeof lists>
      ).filter((key) => lists[key].length > 0)
      const expected = ROLE_BRANCH[code]
      if (populated.length !== 1 || populated[0] !== expected) {
        mismatches.push(
          `${code}: ROLE_BRANCH says ${expected}, partitionGrants populated [${populated.join(', ')}]`,
        )
      }
    }
    expect(mismatches).toEqual([])
  })

  it('every role in the manifest resolves to a route — none falls through to "/"', () => {
    // ⛔ The BUG-HAT-001 class, from this side. `session-grants.test.ts` asserts it for
    // page.tsx; nothing asserted it for the role switcher, which is the surface a user
    // reaches AFTER being told they have the role. A role with no branch would silently
    // send them to the root.
    const unrouted: PlatformRole[] = []
    for (const code of ROLE_ORDER) {
      const scoped = [
        orgGrant(code, 'a'),
        hospitalGrant(code, '1', 'a'),
        commissionGrant(code, '1', 'a'),
      ]
      if (landingRouteForRole(code, scoped) === '/') unrouted.push(code)
    }
    expect(unrouted).toEqual([])
  })
})
