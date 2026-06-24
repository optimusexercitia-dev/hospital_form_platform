'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { resolveOrInviteUser } from '@/lib/members/invite'

/**
 * Commission member-management server actions (Architecture Rules 9 & 10):
 * invite/remove STAFF. `useActionState`-shaped. All user-facing strings pt-BR;
 * raw Supabase/Postgres errors NEVER reach the UI (CLAUDE.md §8).
 *
 * SECURITY: each action re-verifies, server-side and COMMISSION-SCOPED, that the
 * caller is admin OR a staff_admin OF THAT SPECIFIC commission, BEFORE any
 * write — the client is never trusted. The target role is hard-coded
 * ('staff'); it is never read from formData, so a tampered form cannot escalate
 * to staff_admin via `inviteStaff`. The invite + cross-user lookup use the
 * service-role client (which bypasses RLS), so the explicit check above is the
 * authority; the membership upsert itself also runs as service role for the
 * freshly-invited (session-less) profile.
 */

export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  emailRequired: 'Informe o e-mail.',
  emailInvalid: 'Informe um e-mail válido.',
  missingCommission: 'Comissão não encontrada.',
  missingUser: 'Usuário não encontrado.',
  staffInvited:
    'Convite enviado. O usuário receberá um e-mail para definir a senha.',
  staffAdded: 'Usuário adicionado à comissão com sucesso.',
  staffRemoved: 'Usuário removido da comissão com sucesso.',
} as const

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Authorize a staff-management action for a specific commission: admin, or a
 * staff_admin of THAT commission. Returns false (deny) otherwise.
 */
async function authorizeStaffOps(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.memberships.some(
    (m) => m.commission.id === commissionId && m.role === 'staff_admin',
  )
}

async function appOrigin(): Promise<string> {
  const h = await headers()
  const origin = h.get('origin')
  if (origin) return origin
  const host = h.get('host') ?? '127.0.0.1:3000'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

/**
 * Invite (or add an existing user) as STAFF of a commission, by email. Resolves
 * the existing user or invites a new one, then upserts membership as 'staff'.
 * Role is hard-coded — never read from formData. Idempotent on already-a-member.
 */
export async function inviteStaff(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const commissionId = String(formData.get('commissionId') ?? '')
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase()

  if (!commissionId) {
    return { ok: false, error: MESSAGES.missingCommission }
  }
  // Authorize BEFORE any service-role work.
  if (!(await authorizeStaffOps(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  if (!email) {
    return { ok: false, fieldErrors: { email: MESSAGES.emailRequired } }
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, fieldErrors: { email: MESSAGES.emailInvalid } }
  }

  const admin = createAdminClient()
  const origin = await appOrigin()

  let invited = false
  try {
    const resolved = await resolveOrInviteUser(
      admin,
      email,
      `${origin}/auth/confirm`,
    )
    invited = resolved.invited

    // Hard-coded role: 'staff'. A tampered form cannot escalate here. Upsert is
    // idempotent on unique(commission_id, user_id); DO NOTHING so re-inviting an
    // existing member (incl. a staff_admin) never silently demotes them.
    const { error } = await admin.from('commission_members').upsert(
      { commission_id: commissionId, user_id: resolved.userId, role: 'staff' },
      { onConflict: 'commission_id,user_id', ignoreDuplicates: true },
    )
    if (error) {
      return { ok: false, error: MESSAGES.generic }
    }
  } catch {
    return { ok: false, error: MESSAGES.generic }
  }

  revalidatePath(`/o/[org]/c/[commission]/manage/members`, 'page')
  return {
    ok: true,
    error: invited ? MESSAGES.staffInvited : MESSAGES.staffAdded,
  }
}

/**
 * Remove a STAFF member from a commission. Uses the cookie (RLS-scoped) client:
 * `commission_members_staff_admin_delete` (M6) restricts deletion to staff rows
 * of a commission the caller is staff_admin of, and `commission_members_admin_all`
 * covers admin — so RLS itself blocks removing a staff_admin or a foreign
 * commission's member. The explicit `role='staff'` filter keeps this action's
 * intent narrow regardless.
 */
export async function removeStaff(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const commissionId = String(formData.get('commissionId') ?? '')
  const userId = String(formData.get('userId') ?? '')

  if (!commissionId) {
    return { ok: false, error: MESSAGES.missingCommission }
  }
  if (!(await authorizeStaffOps(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }
  if (!userId) {
    return { ok: false, error: MESSAGES.missingUser }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('commission_members')
    .delete()
    .eq('commission_id', commissionId)
    .eq('user_id', userId)
    .eq('role', 'staff')

  if (error) {
    return { ok: false, error: MESSAGES.generic }
  }

  revalidatePath(`/o/[org]/c/[commission]/manage/members`, 'page')
  return { ok: true, error: MESSAGES.staffRemoved }
}
