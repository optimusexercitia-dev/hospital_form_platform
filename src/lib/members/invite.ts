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
 * `organizationId` is the organisation the caller is binding the identity into. It is
 * used ONLY by the tenant check below.
 *
 * ⛔ IT IS NO LONGER SEEDED INTO `user_metadata` (AE2 drop). This doc used to say the
 * `home_organization_id` key "outlives this increment on purpose: the column drop owns
 * `handle_new_user`" — that increment is THIS one, so the key goes with it. ⚠ Leaving it
 * would have been SILENT: `handle_new_user` simply stops reading it, nothing errors, and
 * a metadata field that looks authoritative is read by nobody.
 *
 * ⭐ AE2.4 INCREMENT 4 — THE TENANT CHECK NO LONGER READS `home_organization_id`.
 * QA finding M14 / ADR 0165 § Consequences: this function was classified in AE2.1's
 * census as "service-role, structurally immune", which is true of the RLS-AUDIENCE
 * question and irrelevant to the COLUMN-DROP question — which is how it fell between
 * both. It is an AUTHORITY consumer of the column and it is re-predicated here.
 *
 * ⛔ THE PREDICATE IS THE **CREATION** DOOR'S — `app.affiliate_new_person_to_org_impl`,
 * NOT `app.affiliate_person_to_org_impl` AND NOT THE PICKER'S. ADR 0168 Amdt 1/2 split
 * that one door into three, and this path is a PROVISIONING path: it invites people. So
 * the door it mirrors is the one that admits a person with no tenancy yet, and mirroring
 * is preserved by leaving the predicate alone and re-pointing the name. The ORDINARY door
 * narrowed to "known here" in the same increment; this did not, deliberately.
 *
 * The obvious re-predication — "must hold an ACTIVE affiliation in this organisation",
 * mirroring `list_addable_commission_members` — stays MEASURED AND WRONG HERE, for a
 * reason that has itself changed and is restated rather than inherited:
 *  · ⛔ THE OLD REASON IS NOW FALSE. It read "neither `assignStaffAdmin` nor
 *    `assignOrgAdmin` creates an org affiliation for the user it invites … neither caller
 *    calls `affiliate_person_to_org_for`". That is true of the TYPESCRIPT CALL SITES and
 *    false of the OUTCOME: ADR 0166 moved the write one layer down, into
 *    `app.grant_role_impl`, which calls `app.ensure_provisioned_org_affiliation` for
 *    `(organization, org_admin)` and `(commission, staff_admin)` — catalog-verified. A
 *    comment naming a call-site absence read as an outcome, and no gate could contradict
 *    it.
 *  · ⭐ THE REASON THAT SURVIVES is a failure state, not a happy path: if the invite
 *    succeeds and the role grant then fails, the profile exists with ZERO affiliations and
 *    an ACTIVE-only (or "known here"-only) predicate makes that e-mail PERMANENTLY
 *    unprovisionable — `guard_profile_no_delete` forbids deleting the profile, so nothing
 *    can clear it. Today's predicate self-heals from that state. Narrowing here would buy
 *    symmetry and sell a wedge.
 *
 * The predicate itself is unchanged from increment 1 (`20261003005600`): refuse only when
 * the person HAS non-voided affiliations and NONE of them is in this organisation. It
 * admits the two legitimate zero-affiliation states — a freshly invited account, and the
 * aborted-grant wedge above — and refuses exactly the foreign-tenant bind AFF W2 / ADR
 * 0097 D13 exists to stop.
 *
 * ⚠ AN ADR 0164 ORPHAN IS NO LONGER ONE OF THOSE STATES' JUSTIFICATIONS. ADR 0165 D1 made
 * re-affiliation the orphan recovery path; ADR 0168 REPLACED that with a door of its own,
 * `public.recover_orphan_person_to_org` (platform_admin, own audit verb). Recovery is not
 * a side effect of this function, and citing it here would re-open what that ADR closed.
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
    await admin.auth.admin.inviteUserByEmail(email, { redirectTo })

  if (inviteError || !invite?.user) {
    throw inviteError ?? new Error('invite did not return a user')
  }

  return { userId: invite.user.id, invited: true }
}
