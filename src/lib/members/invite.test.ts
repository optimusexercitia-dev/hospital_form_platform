import type { SupabaseClient } from '@supabase/supabase-js'

import { describe, expect, it, vi } from 'vitest'

import { resolveOrInviteUser } from './invite'
import type { Database } from '@/lib/types/database'

/**
 * AFF W2 / ADR 0097 D13 — the tenant check `resolveOrInviteUser`'s existing-user branch
 * was missing, verified live by the external audit.
 *
 * ⚠ WHY THIS FILE EXISTS AT ALL. The fix is TypeScript, on a service-role path, so no
 * pgTAP keystone reaches it and no RLS policy backstops it — the recorded shape of an
 * "un-keystoned deviation", where a fix the engineer was right to make gets no test
 * because nobody was owed one, and an unasserted fix is indistinguishable from no fix.
 *
 * The hazard is real and specific: `profiles.email` is GLOBALLY unique, so this lookup
 * crosses tenants. Without the check, `assignStaffAdmin` / `assignOrgAdmin` resolve a
 * foreign-org identity and hand it to the membership door — which authorises the ACTOR
 * and never re-derives which tenant the SUBJECT belongs to.
 *
 * ⭐⭐ AE2.4 INCREMENT 4 — THE CHECK IS RE-PREDICATED, AND THE OBVIOUS PREDICATE IS WRONG.
 * `home_organization_id` is going away, so the tenant check has to come from
 * `organization_affiliations`. The obvious move — "must hold an ACTIVE affiliation in
 * this org", mirroring `list_addable_commission_members` — BREAKS RE-PROVISIONING, and
 * the reason is measurable rather than stylistic: `resolveOrInviteUser` itself creates no
 * org affiliation for the user it invites, and `handle_new_user` writes none either. So a
 * person THIS FUNCTION invited has zero affiliations until a later grant lands, and an
 * active-only predicate refuses the second call for the same e-mail in that window.
 * § "an invited-but-unaffiliated person" is that cell, and it would be RED under the
 * obvious predicate.
 *
 * ⛔ THE OLD REASON STOPPED ONE CLAUSE TOO LATE AND WAS FALSE. It read "…and neither
 * `assignStaffAdmin` nor `assignOrgAdmin` calls `affiliate_person_to_org_for`" — true of
 * the TYPESCRIPT CALL SITES and false of the OUTCOME: ADR 0166 moved that write one layer
 * down, into `app.grant_role_impl`, which calls `app.ensure_provisioned_org_affiliation`
 * for `(organization, org_admin)` and `(commission, staff_admin)` (catalog-verified). A
 * comment naming a call-site absence read as an outcome, and no gate could contradict it.
 *
 * ⭐ THE REASON THAT SURVIVES is a failure state, not a happy path: if the invite succeeds
 * and the role grant then fails, the profile exists with ZERO affiliations, and a
 * narrowed predicate would make that e-mail PERMANENTLY unprovisionable —
 * `guard_profile_no_delete` forbids deleting the profile, so nothing can clear it.
 *
 * The predicate that holds is the **CREATION** door's — `app.affiliate_new_person_to_org_impl`
 * (ADR 0168 Amdt 1/2), which kept the predicate shipped in `20261003005600`: refuse only
 * when the person HAS non-voided affiliations and NONE of them is in this organisation.
 * ⚠ NOT `app.affiliate_person_to_org_impl`, which narrowed to "already known here" in the
 * same increment. This is a provisioning path, so the creation door is the right mirror.
 *
 * ⛔ AND THAT PREDICATE ADMITS THE PLATFORM ADMIN, WHICH THE COLUMN USED TO REFUSE BY
 * ACCIDENT. Under `home_organization_id` a platform admin was refused because their
 * anchor is NULL — a refusal that fell out of the anchor, not out of a rule. Under
 * affiliations they have zero non-voided rows and the predicate above ADMITS them. The
 * noun rule is now a separate, stated arm (`is_admin`), which is the same discriminator
 * `app.tenant_orphan_profiles()` uses and for the same reason: an orphan is
 * shape-identical to the platform admin, and `is_admin` is the one property orthogonal
 * to affiliation-presence.
 */

const ORG_A = '0c000000-0000-0000-0000-00000000000a'
const ORG_B = '0c000000-0000-0000-0000-00000000000b'

type ProfileRow = { id: string; is_admin: boolean } | null
type AffRow = { organization_id: string; ended_on: string | null }

interface Recorded {
  table: string
  method: string
  args: unknown[]
}

/**
 * A supabase-js stand-in whose `profiles` lookup returns `profile` and whose
 * `organization_affiliations` read returns `affiliations`.
 *
 * ⚠ IT RECORDS WHAT WAS ASKED, NOT ONLY WHAT IT RETURNED. A query-level filter is
 * INVISIBLE to any assertion about the rows that come back — the mock decides those, so
 * a test inspecting the result passes just as happily with `.is('voided_at', null)`
 * deleted. The only witness to a filter is the call log. (Same discipline, same reason,
 * as `src/lib/queries/org-roster-predicate.test.ts`.)
 *
 * `affiliationsError` makes the affiliation read fail, which is how the partial-failure
 * ordering is asserted rather than argued.
 */
function fakeAdmin(opts: {
  profile: ProfileRow
  affiliations?: AffRow[]
  affiliationsError?: { message: string }
}) {
  const calls: Recorded[] = []
  const inviteUserByEmail = vi.fn().mockResolvedValue({
    data: { user: { id: 'newly-invited' } },
    error: null,
  })

  function builder(table: string) {
    const chain: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve(
          table === 'organization_affiliations'
            ? {
                data: opts.affiliationsError ? null : (opts.affiliations ?? []),
                error: opts.affiliationsError ?? null,
              }
            : { data: opts.profile, error: null },
        ).then(resolve),
      maybeSingle: async () => ({ data: opts.profile, error: null }),
    }
    for (const method of ['select', 'eq', 'is', 'limit', 'returns']) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ table, method, args })
        return chain
      }
    }
    return chain
  }

  const client = { from: (table: string) => builder(table), auth: { admin: { inviteUserByEmail } } }
  // The fake models only the call surface under test; a full SupabaseClient shape would
  // be hundreds of unused members and would hide which surface this actually depends on.
  return {
    client: client as unknown as SupabaseClient<Database>,
    inviteUserByEmail,
    calls,
    asked: (table: string, method: string, ...args: unknown[]) =>
      calls.some(
        (c) =>
          c.table === table &&
          c.method === method &&
          args.every((a, i) => JSON.stringify(c.args[i]) === JSON.stringify(a)),
      ),
  }
}

const REDIRECT = 'https://app/auth/confirm'

describe('resolveOrInviteUser — the D13 tenant check, re-predicated onto affiliations', () => {
  it('resolves an existing user ACTIVELY affiliated to the SAME organization', async () => {
    const { client, inviteUserByEmail } = fakeAdmin({
      profile: { id: 'user-in-org-a', is_admin: false },
      affiliations: [{ organization_id: ORG_A, ended_on: null }],
    })

    await expect(
      resolveOrInviteUser(client, 'someone@test.local', REDIRECT, ORG_A),
    ).resolves.toEqual({ userId: 'user-in-org-a', invited: false })

    expect(inviteUserByEmail, 'an existing user must not be re-invited').not.toHaveBeenCalled()
  })

  it('⭐⭐ REFUSES an existing user whose non-voided affiliations are ALL in another organization', async () => {
    // The keystone. Before AFF W2 this returned { userId, invited: false } and the caller
    // went on to seat a foreign-org identity in its own tenant. AE2.4 moved the FACT the
    // check reads; the property it protects is unchanged.
    const { client, inviteUserByEmail } = fakeAdmin({
      profile: { id: 'user-in-org-b', is_admin: false },
      affiliations: [{ organization_id: ORG_B, ended_on: null }],
    })

    await expect(
      resolveOrInviteUser(client, 'someone@test.local', REDIRECT, ORG_A),
    ).rejects.toThrow(/another organization/i)
    expect(
      inviteUserByEmail,
      'a refusal must not fall through to creating an account',
    ).not.toHaveBeenCalled()
  })

  it('resolves when ONE of several non-voided affiliations is in this organization', async () => {
    // The `some` arm, and the control on the test above: a predicate written as
    // "the FIRST affiliation must be this org" passes the refusal cell and fails here.
    const { client } = fakeAdmin({
      profile: { id: 'dual', is_admin: false },
      affiliations: [
        { organization_id: ORG_B, ended_on: null },
        { organization_id: ORG_A, ended_on: null },
      ],
    })

    await expect(
      resolveOrInviteUser(client, 'dual@test.local', REDIRECT, ORG_A),
    ).resolves.toEqual({ userId: 'dual', invited: false })
  })

  it('⭐ resolves an OFFBOARDED person of this organization — non-voided, not active', async () => {
    // ADR 0151 D5's one-step rehire, and the deliberate divergence from the STAFFING
    // predicate: this is a TENANCY question ("may this identity be bound here"), and an
    // ended-but-not-voided person of this org is still of this org. The picker
    // (`list_addable_commission_members`, `listLinkableOrgUsers`) answers the other
    // question and correctly excludes them.
    const { client } = fakeAdmin({
      profile: { id: 'offboarded', is_admin: false },
      affiliations: [{ organization_id: ORG_A, ended_on: '2026-01-10' }],
    })

    await expect(
      resolveOrInviteUser(client, 'offboarded@test.local', REDIRECT, ORG_A),
    ).resolves.toEqual({ userId: 'offboarded', invited: false })
  })

  it('⭐⭐ resolves an INVITED-BUT-UNAFFILIATED person — the cell the obvious predicate breaks', async () => {
    // `resolveOrInviteUser` creates no org affiliation for the user it invites — but NOT
    // because neither caller ever does: ADR 0166 moved that write into
    // `app.grant_role_impl` (`app.ensure_provisioned_org_affiliation`), one layer below
    // this function. So this is the state a SECOND `assignStaffAdmin` / `assignOrgAdmin`
    // for the same e-mail lands in during the window BEFORE that later grant — the one
    // `e2e/platform-org-admin-provisioning.spec.ts:85` depends on by name. An "ACTIVE
    // affiliation in this org" predicate refuses here.
    //
    // ⚠ ADMITTING IT IS DELIBERATE, BUT NO LONGER FOR THE REASON THIS COMMENT GAVE. It
    // cited ADR 0165 D1's "re-affiliation is the recovery path"; ADR 0168 REPLACED that
    // with `public.recover_orphan_person_to_org` (platform_admin-only, own audit verb).
    // What keeps this cell wide is the aborted-grant wedge: invite succeeds, grant fails,
    // and `guard_profile_no_delete` means nothing can ever clear that e-mail again.
    const { client } = fakeAdmin({ profile: { id: 'invited-earlier', is_admin: false }, affiliations: [] })

    await expect(
      resolveOrInviteUser(client, 'invited.earlier@test.local', REDIRECT, ORG_A),
    ).resolves.toEqual({ userId: 'invited-earlier', invited: false })
  })

  it('⭐ REFUSES a platform_admin, and does so WITHOUT reaching the affiliation read', async () => {
    // The noun rule (ADR 0078 A35), now a stated arm rather than a side effect of a NULL
    // column. ⛔ THE SECOND HALF OF THIS ASSERTION IS THE POINT: both arms raise the same
    // message on purpose (a distinguishable one would be a platform-admin oracle), so the
    // message alone cannot tell which arm fired. The un-issued affiliation query is what
    // makes this cell a statement about `is_admin` and not about the affiliation set —
    // seed it with a perfectly acceptable ORG_A affiliation so that, if the noun-rule arm
    // were deleted, this test would go GREEN-as-resolved and fail on the throw.
    const { client, calls, inviteUserByEmail } = fakeAdmin({
      profile: { id: 'platform-admin', is_admin: true },
      affiliations: [{ organization_id: ORG_A, ended_on: null }],
    })

    await expect(
      resolveOrInviteUser(client, 'platform@test.local', REDIRECT, ORG_A),
    ).rejects.toThrow(/another organization/i)
    expect(
      calls.some((c) => c.table === 'organization_affiliations'),
      'the noun-rule arm must short-circuit before the affiliation read',
    ).toBe(false)
    expect(inviteUserByEmail).not.toHaveBeenCalled()
  })

  it('⭐ asks the database to EXCLUDE VOIDED rows — a filter no returned-shape assertion can witness', async () => {
    // A void says the employment never should have existed (ADR 0151 D7/D8). Drop
    // `.is('voided_at', null)` from `listNonVoidedOrgAffiliationsFor` and every cell above
    // still passes, because the mock supplies the rows. This is the only arm that fails.
    const { client, asked } = fakeAdmin({
      profile: { id: 'user-in-org-a', is_admin: false },
      affiliations: [{ organization_id: ORG_A, ended_on: null }],
    })
    await resolveOrInviteUser(client, 'someone@test.local', REDIRECT, ORG_A)

    expect(asked('organization_affiliations', 'is', 'voided_at', null)).toBe(true)
    expect(asked('organization_affiliations', 'eq', 'principal_id', 'user-in-org-a')).toBe(true)
    // The control: it must NOT pre-filter to ACTIVE rows, or the offboarded cell above
    // would be passing for the wrong reason and one-step rehire would be broken.
    expect(asked('organization_affiliations', 'is', 'ended_on', null)).toBe(false)
  })

  it('⛔ THE PARTIAL-FAILURE ORDER: a failed affiliation read throws with NOTHING created', async () => {
    // The new read sits entirely BEFORE the first write, so every way it can fail leaves
    // no account behind. Asserted rather than argued, because "I put it before the write"
    // is exactly the kind of claim that survives a later reorder unnoticed.
    const { client, inviteUserByEmail } = fakeAdmin({
      profile: { id: 'user-x', is_admin: false },
      affiliationsError: { message: 'connection reset' },
    })

    await expect(
      resolveOrInviteUser(client, 'someone@test.local', REDIRECT, ORG_A),
    ).rejects.toThrow(/organization_affiliations read failed/i)
    expect(
      inviteUserByEmail,
      'a read outage must not be laundered into "no such user, invite one"',
    ).not.toHaveBeenCalled()
  })

  it('still invites when no profile exists (the fix did not fail closed)', async () => {
    // The positive twin. A tenant check that refuses EVERYTHING passes every deny above
    // by construction — a narrowing's danger is that it binds too much.
    const { client, inviteUserByEmail, calls } = fakeAdmin({ profile: null })

    await expect(
      resolveOrInviteUser(client, 'brand.new@test.local', REDIRECT, ORG_A),
    ).resolves.toEqual({ userId: 'newly-invited', invited: true })

    expect(inviteUserByEmail).toHaveBeenCalledOnce()
    expect(
      calls.some((c) => c.table === 'organization_affiliations'),
      'no profile means no person to check — the affiliation read must not run at all',
    ).toBe(false)
  })
})
