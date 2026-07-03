'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import type { ActionState as MutationActionState } from '@/lib/safety/types'

/**
 * Committee member-title mutations (ADR 0051 Decision 6) — a fifth per-commission
 * vocabulary (Presidente / Vice-Presidente / Secretário(a) …), DISPLAY-ONLY with
 * zero RLS/access semantics. Managed by the commission's `staff_admin` (admins
 * inherit via `is_commission_admin_of`, ADR 0051 Decision 1).
 *
 * The DB authority is the A4 titles CRUD RPCs (non-DEFINER, in-body-gated
 * `is_staff_admin_of OR is_commission_admin_of` + RLS on the cookie client); these
 * `'use server'` actions call them and shape the pt-BR result. A forbidden caller's
 * RPC error (42501) surfaces as the generic pt-BR message — raw Postgres errors
 * never reach the UI (CLAUDE.md §8). Split out of `titles.ts` because a
 * `'use server'` module may export only async functions (no types); `titles.ts`
 * re-exports these so a SERVER caller imports one path.
 */

const MESSAGES = {
  generic: 'Não foi possível concluir. Tente novamente.',
  nameRequired: 'Informe o nome do título.',
  created: 'Título criado.',
  renamed: 'Título atualizado.',
  reordered: 'Ordem dos títulos atualizada.',
  deleted: 'Título removido.',
  assigned: 'Título atribuído.',
  cleared: 'Título removido do membro.',
} as const

/** Revalidate the commission manage area after a title mutation. Ids (not slugs)
 * are all we have, so revalidate the manage layout broadly (covers the titles
 * settings tab + member list + meeting attendee lists that show the badge). */
function revalidateManage(): void {
  revalidatePath('/o/[org]/c/[commission]/manage', 'layout')
}

/** Create a title (`name`) in `commissionId`, appended at the end of the list. */
export async function createMemberTitle(
  commissionId: string,
  name: string,
): Promise<MutationActionState> {
  const trimmed = name.trim()
  if (!trimmed) {
    return { ok: false, fieldErrors: { name: MESSAGES.nameRequired } }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('create_member_title', {
    p_commission_id: commissionId,
    p_name: trimmed,
  })
  if (error) return { ok: false, error: MESSAGES.generic }
  revalidateManage()
  return { ok: true, message: MESSAGES.created }
}

/** Rename an existing title. */
export async function renameMemberTitle(
  titleId: string,
  name: string,
): Promise<MutationActionState> {
  const trimmed = name.trim()
  if (!trimmed) {
    return { ok: false, fieldErrors: { name: MESSAGES.nameRequired } }
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('rename_member_title', {
    p_title_id: titleId,
    p_name: trimmed,
  })
  if (error) return { ok: false, error: MESSAGES.generic }
  revalidateManage()
  return { ok: true, message: MESSAGES.renamed }
}

/** Reorder a commission's titles to match `orderedIds` (drag-reorder). */
export async function reorderMemberTitles(
  commissionId: string,
  orderedIds: string[],
): Promise<MutationActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('reorder_member_titles', {
    p_commission_id: commissionId,
    p_ordered_ids: orderedIds,
  })
  if (error) return { ok: false, error: MESSAGES.generic }
  revalidateManage()
  return { ok: true, message: MESSAGES.reordered }
}

/** Delete a title; assignments referencing it are `SET NULL` (ADR 0051). */
export async function deleteMemberTitle(
  titleId: string,
): Promise<MutationActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_member_title', {
    p_title_id: titleId,
  })
  if (error) return { ok: false, error: MESSAGES.generic }
  revalidateManage()
  return { ok: true, message: MESSAGES.deleted }
}

/**
 * Assign `titleId` to `memberId` (or clear when `titleId` is `null`). One title
 * per member; the title must belong to the member's commission (DB-enforced by
 * the A1 same-commission integrity trigger).
 */
export async function assignMemberTitle(
  memberId: string,
  titleId: string | null,
): Promise<MutationActionState> {
  const supabase = await createClient()
  // Clearing a title = OMIT p_title_id (the RPC defaults it to NULL and does
  // `set title_id = null`). The generated arg is optional-string, not nullable, so
  // map `null` → `undefined` to hit the SQL default rather than send a literal.
  const { error } = await supabase.rpc('assign_member_title', {
    p_member_id: memberId,
    p_title_id: titleId ?? undefined,
  })
  if (error) return { ok: false, error: MESSAGES.generic }
  revalidateManage()
  return { ok: true, message: titleId ? MESSAGES.assigned : MESSAGES.cleared }
}
