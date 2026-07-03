import { createClient } from '@/lib/supabase/server'

/**
 * Committee member titles (ADR 0051 Decision 6) — a fifth per-commission
 * vocabulary. DISPLAY-ONLY: a title carries ZERO access semantics (a titled
 * `staff` gains no extra rights). Backs the member-management page, member
 * overview, meeting attendee lists, and signature blocks / exported atas.
 *
 * This module is the single FE import path for titles: the read query lives here;
 * the mutations are re-exported from the co-located `'use server'` module
 * (`titles-actions.ts`) — a `'use server'` file may not export types, so the read
 * + `MemberTitle` interface stay in this plain module.
 *
 * RLS (the authority): member-read for the commission; commission-admin write
 * (`is_staff_admin_of OR is_commission_admin_of`). These reads run on the ordinary
 * cookie-wired (RLS-scoped) client — a foreign caller gets `[]`.
 */

/** One member title, as the UI consumes it. */
export interface MemberTitle {
  id: string
  commissionId: string
  name: string
  /** Sort order within the commission's title list (1-based). */
  position: number
}

/**
 * A commission's member titles, ordered by `position`. RLS-scoped: `[]` for a
 * caller who cannot read the commission. A0 stub — impl in A4/A5.
 */
export async function listMemberTitles(
  _commissionId: string,
): Promise<MemberTitle[]> {
  // Touch the client factory so the (server-only) import is exercised at build;
  // the real read lands in A4/A5.
  void createClient
  throw new Error('not implemented')
}

// Re-export the mutations so FE imports everything from `@/lib/commissions/titles`.
export {
  createMemberTitle,
  renameMemberTitle,
  reorderMemberTitles,
  deleteMemberTitle,
  assignMemberTitle,
} from '@/lib/commissions/titles-actions'
