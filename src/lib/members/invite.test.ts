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
 */

const ORG_A = '0c000000-0000-0000-0000-00000000000a'
const ORG_B = '0c000000-0000-0000-0000-00000000000b'

/**
 * A supabase-js stand-in whose `profiles` lookup returns `row`. Only the surface
 * `resolveOrInviteUser` touches is modelled; anything else throwing is the point.
 */
function fakeAdmin(row: { id: string; home_organization_id: string | null } | null) {
  const inviteUserByEmail = vi.fn().mockResolvedValue({
    data: { user: { id: 'newly-invited' } },
    error: null,
  })
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: null }),
        }),
      }),
    }),
    auth: { admin: { inviteUserByEmail } },
  }
  // The fake models only the call surface under test; a full SupabaseClient shape would
  // be hundreds of unused members and would hide which surface this actually depends on.
  return { client: client as unknown as SupabaseClient<Database>, inviteUserByEmail }
}

describe('resolveOrInviteUser — the D13 tenant check', () => {
  it('resolves an existing user anchored to the SAME organization', async () => {
    const { client, inviteUserByEmail } = fakeAdmin({
      id: 'user-in-org-a',
      home_organization_id: ORG_A,
    })

    await expect(
      resolveOrInviteUser(client, 'someone@test.local', 'https://app/auth/confirm', ORG_A),
    ).resolves.toEqual({ userId: 'user-in-org-a', invited: false })

    expect(inviteUserByEmail, 'an existing user must not be re-invited').not.toHaveBeenCalled()
  })

  it('REFUSES an existing user anchored to ANOTHER organization', async () => {
    // The keystone. Before the fix this returned { userId, invited: false } and the
    // caller went on to seat a foreign-org identity in its own tenant.
    const { client } = fakeAdmin({
      id: 'user-in-org-b',
      home_organization_id: ORG_B,
    })

    await expect(
      resolveOrInviteUser(client, 'someone@test.local', 'https://app/auth/confirm', ORG_A),
    ).rejects.toThrow(/another organization/i)
  })

  it('REFUSES an existing user with NO organization anchor', async () => {
    // A platform admin (or any un-anchored profile) must not be bindable either —
    // `null !== ORG_A` has to refuse rather than fall through.
    const { client } = fakeAdmin({ id: 'platform-admin', home_organization_id: null })

    await expect(
      resolveOrInviteUser(client, 'platform@test.local', 'https://app/auth/confirm', ORG_A),
    ).rejects.toThrow(/another organization/i)
  })

  it('still invites when no profile exists (the fix did not fail closed)', async () => {
    // The positive twin. A tenant check that refuses EVERYTHING passes the two denies
    // above by construction — a narrowing's danger is that it binds too much.
    const { client, inviteUserByEmail } = fakeAdmin(null)

    await expect(
      resolveOrInviteUser(client, 'brand.new@test.local', 'https://app/auth/confirm', ORG_A),
    ).resolves.toEqual({ userId: 'newly-invited', invited: true })

    expect(inviteUserByEmail).toHaveBeenCalledOnce()
  })
})
