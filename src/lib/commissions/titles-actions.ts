'use server'

import type { ActionState as MutationActionState } from '@/lib/safety/types'

/**
 * Committee member-title mutations (ADR 0051 Decision 6) — a fifth per-commission
 * vocabulary (Presidente / Vice-Presidente / Secretário(a) …), DISPLAY-ONLY with
 * zero RLS/access semantics. Managed by the commission's `staff_admin` (admins
 * inherit via `is_commission_admin_of`, ADR 0051 Decision 1). The DB authority is
 * the A4 titles CRUD RPCs; these `'use server'` actions call them and shape the
 * pt-BR result. A0 stubs — impl in A4.
 *
 * Split out of `titles.ts` because a `'use server'` module may export only async
 * functions (no types); `titles.ts` re-exports these so FE imports one path.
 */

/** Create a title (`name`) in `commissionId`, appended at the end of the list. */
export async function createMemberTitle(
  _commissionId: string,
  _name: string,
): Promise<MutationActionState> {
  throw new Error('not implemented')
}

/** Rename an existing title. */
export async function renameMemberTitle(
  _titleId: string,
  _name: string,
): Promise<MutationActionState> {
  throw new Error('not implemented')
}

/** Reorder a commission's titles to match `orderedIds` (drag-reorder). */
export async function reorderMemberTitles(
  _commissionId: string,
  _orderedIds: string[],
): Promise<MutationActionState> {
  throw new Error('not implemented')
}

/** Delete a title; assignments referencing it are `SET NULL` (ADR 0051). */
export async function deleteMemberTitle(
  _titleId: string,
): Promise<MutationActionState> {
  throw new Error('not implemented')
}

/**
 * Assign `titleId` to `memberId` (or clear when `titleId` is `null`). One title
 * per member; the title must belong to the member's commission (DB-enforced).
 */
export async function assignMemberTitle(
  _memberId: string,
  _titleId: string | null,
): Promise<MutationActionState> {
  throw new Error('not implemented')
}
