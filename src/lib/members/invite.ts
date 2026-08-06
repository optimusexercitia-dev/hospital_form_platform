import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

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
 * `homeOrganizationId` MUST be supplied when inviting a NEW user (any tenant
 * user): `handle_new_user` reads it from `user_metadata` and anchors the profile,
 * satisfying the deferred `profiles_tenant_has_org_trg` invariant (a non-admin
 * profile must be org-anchored). Without it the profile insert is rejected at
 * COMMIT (23514) and the invite fails. The existing-user branch does NOT need it
 * (that profile is already anchored). It is set as `user_metadata` — a descriptive
 * anchor only, NOT an authorization input (authz flows through memberships + RLS).
 *
 * Throws on an unexpected Supabase admin error; the calling action maps that to
 * a generic pt-BR message (raw errors never reach the UI).
 */
export async function resolveOrInviteUser(
  admin: SupabaseClient<Database>,
  email: string,
  redirectTo: string,
  homeOrganizationId: string,
): Promise<ResolvedUser> {
  const { data: existing, error: lookupError } = await admin
    .from('profiles')
    .select('id, home_organization_id')
    .eq('email', email)
    .maybeSingle()

  if (lookupError) {
    throw lookupError
  }
  if (existing) {
    // AFF W2 / ADR 0097 D13 — THE TENANT CHECK THIS BRANCH WAS MISSING. `profiles.email`
    // is globally unique, so this lookup crosses tenants: without the check,
    // `assignStaffAdmin` / `assignOrgAdmin` would bind a FOREIGN-ORG identity into the
    // caller's organisation, and the membership door downstream authorises the ACTOR,
    // not the subject — it never re-derives which tenant the subject belongs to.
    // Verified live by the external audit; a real gap, not a theoretical one.
    //
    // The message deliberately says nothing about the holder or their tenant (it is the
    // collision copy, verbatim in form), so this cannot be used as a cross-tenant
    // existence oracle. The caller maps thrown errors to a generic pt-BR message.
    if (existing.home_organization_id !== homeOrganizationId) {
      throw new Error('resolveOrInviteUser: identity is anchored to another organization')
    }
    return { userId: existing.id, invited: false }
  }

  const { data: invite, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { home_organization_id: homeOrganizationId },
    })

  if (inviteError || !invite?.user) {
    throw inviteError ?? new Error('invite did not return a user')
  }

  return { userId: invite.user.id, invited: true }
}
