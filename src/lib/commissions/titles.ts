import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { MemberTitle } from '@/lib/commissions/titles-types'

/**
 * Committee member titles (ADR 0051 Decision 6) — a fifth per-commission
 * vocabulary. DISPLAY-ONLY: a title carries ZERO access semantics (a titled
 * `staff` gains no extra rights). Backs the member-management page, member
 * overview, meeting attendee lists, and signature blocks / exported atas.
 *
 * SERVER-ONLY: this module wires the RLS-scoped server client, so importing it
 * from a Client Component fails fast at the import site (`server-only`) rather
 * than leaking the server read into the client bundle (frontend hit this at
 * `npm run build`). The CANONICAL type-import path for `MemberTitle` — safe from
 * a Client Component — is `@/lib/commissions/titles-types`; it is re-exported here
 * for server callers' convenience. The mutations are re-exported from the
 * co-located `'use server'` module (`titles-actions.ts`) so a server caller still
 * imports everything from `@/lib/commissions/titles`.
 *
 * RLS (the authority): member-read for the commission; commission-admin write
 * (`is_staff_admin_of OR is_commission_admin_of`). These reads run on the ordinary
 * cookie-wired (RLS-scoped) client — a foreign caller gets `[]`.
 */

/** A commission's member titles, ordered by `position`. RLS-scoped (`[]` for a
 * caller who cannot read the commission's `member_titles_select`). */
export async function listMemberTitles(
  commissionId: string,
): Promise<MemberTitle[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('commission_member_titles')
    .select('id, commission_id, name, position')
    .eq('commission_id', commissionId)
    .order('position', { ascending: true })
    .returns<
      { id: string; commission_id: string; name: string; position: number }[]
    >()

  if (error || !data) return []
  return data.map((t) => ({
    id: t.id,
    commissionId: t.commission_id,
    name: t.name,
    position: t.position,
  }))
}

// Re-export the canonical type (client-safe source) + the mutations so a SERVER
// caller can import everything from `@/lib/commissions/titles`. A CLIENT
// Component must import the type from `@/lib/commissions/titles-types` instead.
export type { MemberTitle }
export {
  createMemberTitle,
  renameMemberTitle,
  reorderMemberTitles,
  deleteMemberTitle,
  assignMemberTitle,
} from '@/lib/commissions/titles-actions'
