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
 * Throws on an unexpected Supabase admin error; the calling action maps that to
 * a generic pt-BR message (raw errors never reach the UI).
 */
export async function resolveOrInviteUser(
  admin: SupabaseClient<Database>,
  email: string,
  redirectTo: string,
): Promise<ResolvedUser> {
  const { data: existing, error: lookupError } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (lookupError) {
    throw lookupError
  }
  if (existing) {
    return { userId: existing.id, invited: false }
  }

  const { data: invite, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, { redirectTo })

  if (inviteError || !invite?.user) {
    throw inviteError ?? new Error('invite did not return a user')
  }

  return { userId: invite.user.id, invited: true }
}
