'use server'

import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database'

/**
 * ACT Stage 3 (ADR 0106) — the "act as" role picker's server action.
 *
 * Wraps `public.assume_role(p_role)` (DEFINER RPC — validates the submitted
 * role against LIVE memberships, upserts `app.active_role_selections` by
 * session, audits `active_role.assumed`) and the session refresh the new
 * claim needs to actually reach the client: `assume_role` writes the
 * selection row, but the CURRENT request's JWT was already minted before
 * this call — the caller must `refreshSession()` (or an equivalent re-mint)
 * to pick up the new `active_role` claim from `custom_access_token_hook`
 * before the redirect target's own guards evaluate it. Doing the refresh
 * HERE (not left to the client) keeps "assume a role" a single, auditable,
 * server-side action per D8 (`audit_write` stamps `metadata.acting_as` from
 * whatever hat — or lack of one — is active on THIS request, before the
 * switch takes effect on the next one).
 *
 * `p_role` is a `public.platform_role` value (the same enum
 * `getSelectableRoles` reads its `role` field from) — passed as the raw
 * string the picker's radio group already carries; the RPC itself is the
 * validating boundary (a value outside the enum, or a role the caller does
 * not hold, is rejected there — never assume client input is authoritative).
 */
export interface AssumeRoleState {
  ok: boolean
  error?: string
}

const MESSAGES = {
  generic: 'Não foi possível concluir. Tente novamente.',
  notAvailable: 'Este papel não está mais disponível para você.',
} as const

/**
 * Assumes `role` for the current session and redirects to `landingPath`
 * (the caller — the picker page, per the role→route table in
 * `docs/design/act-role-picker.md` §1 — resolves which path that is; this
 * action does not re-derive it, matching the "one partition, not two"
 * discipline the Stage 3 destination sweep is built on).
 */
export async function assumeRole(
  role: Database['public']['Enums']['platform_role'],
  landingPath: string,
): Promise<AssumeRoleState> {
  const supabase = await createClient()

  const { error } = await supabase.rpc('assume_role', { p_role: role })
  if (error) {
    const message =
      error.code === '42501' ? MESSAGES.notAvailable : MESSAGES.generic
    return { ok: false, error: message }
  }

  // Re-mint the JWT so the new active_role claim is live for the redirect
  // target's own guards (custom_access_token_hook runs again on refresh).
  const { error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError) {
    return { ok: false, error: MESSAGES.generic }
  }

  redirect(landingPath)
}
