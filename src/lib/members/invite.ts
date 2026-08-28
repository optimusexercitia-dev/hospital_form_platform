import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { listNonVoidedOrgAffiliationsFor } from '@/lib/queries/affiliations'
import type { Database } from '@/lib/types/database'

/**
 * Shared "resolve an existing user by email, or invite a new one" helper used by
 * both the staff-invite action (`./actions`) and the staff_admin-assignment
 * action (`@/lib/admin/actions`). It runs on the SERVICE-ROLE client because
 * cross-user lookup and `auth.admin.inviteUserByEmail` inherently require
 * bypassing RLS. It performs NO authorization — the calling action is the
 * authority and must have already verified the actor server-side.
 *
 * Lookup uses the denormalized `profiles.email` (citext, M9/ADR 0010): an exact,
 * case-insensitive single-row read, no `auth.admin.listUsers` pagination. After
 * the M9 backfill, profiles.email is complete, so this reliably finds any
 * existing user.
 */

export interface ResolvedUser {
  userId: string
  /** true when this call created a brand-new invited user. */
  invited: boolean
}

/**
 * Returns the user id for `email`, inviting (and thereby creating) the user when
 * none exists. The invite email links to `redirectTo`, which should be the
 * app's `/auth/confirm` route so the invitee lands on the existing
 * `/auth/confirm` → `/convite` first-password flow.
 *
 * `organizationId` is the organisation the caller is binding the identity into. On the
 * NEW-user branch it is also seeded as `user_metadata.home_organization_id`, which
 * `handle_new_user` reads to anchor the profile — a descriptive anchor only, NOT an
 * authorization input (authz flows through memberships + RLS). ⛔ That metadata key
 * outlives this increment on purpose: the column drop owns `handle_new_user`, and
 * rewriting one function twice in one phase is what AE2.2 avoided.
 *
 * ⭐ AE2.4 INCREMENT 4 — THE TENANT CHECK NO LONGER READS `home_organization_id`.
 * QA finding M14 / ADR 0165 § Consequences: this function was classified in AE2.1's
 * census as "service-role, structurally immune", which is true of the RLS-AUDIENCE
 * question and irrelevant to the COLUMN-DROP question — which is how it fell between
 * both. It is an AUTHORITY consumer of the column and it is re-predicated here.
 *
 * ⛔ THE PREDICATE IS `app.affiliate_person_to_org_impl`'S, NOT THE PICKER'S, AND THAT
 * CHOICE IS THE WHOLE FINDING OF THIS CHANGE. The obvious re-predication — "must hold an
 * ACTIVE affiliation in this organisation", mirroring `list_addable_commission_members` —
 * is MEASURED AND WRONG HERE: neither `assignStaffAdmin` nor `assignOrgAdmin` creates an
 * org affiliation for the user it invites (verified: `handle_new_user` writes no
 * affiliation row, and neither caller calls `affiliate_person_to_org_for`). So a person
 * this very function invited has ZERO affiliations, and an active-only predicate would
 * REFUSE the second call for the same email — breaking re-provisioning, which
 * `e2e/platform-org-admin-provisioning.spec.ts:85` depends on by name.
 *
 * The predicate that holds is increment 1's, already PO-ruled and shipped in
 * `20261003005600`: refuse only when the person HAS non-voided affiliations and NONE of
 * them is in this organisation. It admits the two legitimate zero-affiliation states (a
 * freshly invited account; an ADR 0164 orphan) and refuses exactly the foreign-tenant
 * bind AFF W2 / ADR 0097 D13 exists to stop.
 *
 * ⚠ NON-VOIDED, not ACTIVE — deliberately, and it is the mirror of the SQL door: this is
 * a TENANCY question ("may this identity be bound here"), not a STAFFING question ("may
 * this person be seated here"). An ENDED-but-not-voided person of this org is still of
 * this org, which is what makes one-step rehire (ADR 0151 D5) work.
 *
 * ⛔ AND `is_admin` IS A SEPARATE ARM, NOT AN ACCIDENT OF THE OLD PREDICATE. Under the
 * column, a `platform_admin` was refused because their `home_organization_id` is NULL —
 * a refusal that fell out of the anchor rather than out of a rule. Under affiliations a
 * platform admin has ZERO non-voided rows and would be ADMITTED by the predicate above.
 * The noun rule (ADR 0078 A35: a platform_admin is not a tenant person) is now stated
 * instead of inherited. This is `app.tenant_orphan_profiles()`'s discriminator, for the
 * same reason: an orphan is shape-identical to the platform admin, and `is_admin` is the
 * one property orthogonal to affiliation-presence.
 *
 * The refusal message deliberately says nothing about the holder or their tenant (it is
 * the collision copy, verbatim in form), and BOTH arms raise the SAME message, so this
 * cannot be used as a cross-tenant existence oracle or a platform-admin oracle. The
 * caller maps thrown errors to a generic pt-BR message.
 *
 * ⚠ FAILURE ORDERING IS UNCHANGED, AND THAT IS ASSERTED RATHER THAN ARGUED. The new
 * affiliation read sits entirely BEFORE the first write, so every way it can fail —
 * refusal, or a read error — throws with NOTHING having been created. `invite.test.ts`
 * pins that `inviteUserByEmail` is not called on either path.
 *
 * Throws on an unexpected Supabase admin error; the calling action maps that to
 * a generic pt-BR message (raw errors never reach the UI).
 */
export async function resolveOrInviteUser(
  admin: SupabaseClient<Database>,
  email: string,
  redirectTo: string,
  organizationId: string,
): Promise<ResolvedUser> {
  const { data: existing, error: lookupError } = await admin
    .from('profiles')
    .select('id, is_admin')
    .eq('email', email)
    .maybeSingle()

  if (lookupError) {
    throw lookupError
  }
  if (existing) {
    // ⛔ THE NOUN-RULE ARM RUNS FIRST AND SHORT-CIRCUITS. Ordering is load-bearing twice
    // over: it keeps a platform admin's identity out of every tenant bind without
    // depending on their affiliation shape, and it is the only thing that makes the two
    // arms distinguishable to a test, since both raise the same message.
    if (existing.is_admin) {
      throw new Error('resolveOrInviteUser: identity is anchored to another organization')
    }

    const affiliations = await listNonVoidedOrgAffiliationsFor(admin, existing.id)
    if (
      affiliations.length > 0 &&
      !affiliations.some((row) => row.organizationId === organizationId)
    ) {
      throw new Error('resolveOrInviteUser: identity is anchored to another organization')
    }
    return { userId: existing.id, invited: false }
  }

  const { data: invite, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { home_organization_id: organizationId },
    })

  if (inviteError || !invite?.user) {
    throw inviteError ?? new Error('invite did not return a user')
  }

  return { userId: invite.user.id, invited: true }
}
