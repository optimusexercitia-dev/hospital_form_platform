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
 * caller is a staff_admin OF THAT SPECIFIC commission OR an org_admin of the
 * commission's ORGANIZATION, BEFORE any write — the client is never trusted. The
 * target role is hard-coded ('staff'); it is never read from formData, so a
 * tampered form cannot escalate to staff_admin via `inviteStaff`. The invite +
 * cross-user lookup use the service-role client (which bypasses RLS), so the
 * explicit check above is the ONLY authority on the service-role path; the
 * membership upsert also runs as service role for the freshly-invited
 * (session-less) profile. The platform_admin (`isAdmin`) is NOT authorized here —
 * it is walled off from tenant data and provisions org/hospital/org_admin only
 * (`@/lib/platform/actions`).
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
 * Authorize a staff-management action for a specific commission: a staff_admin of
 * THAT commission, OR an org_admin of the commission's ORGANIZATION. Returns false
 * (deny) otherwise.
 *
 * SECURITY (multi-tenancy): the platform_admin `isAdmin` short-circuit is
 * DELIBERATELY ABSENT. `inviteStaff` runs on the SERVICE-ROLE client (bypasses
 * RLS), so this TS check is the ONLY control there — a platform admin must NOT
 * invite/manage staff in any commission. (`removeStaff` is invoker/RLS-backed but
 * uses the same gate for a consistent, non-escalating policy.)
 */
async function authorizeStaffOps(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false

  // staff_admin of this exact commission.
  if (
    context.memberships.some(
      (m) => m.commission.id === commissionId && m.role === 'staff_admin',
    )
  ) {
    return true
  }

  // org_admin of the commission's organization.
  if (context.orgAdminOf.length === 0) return false
  const supabase = await createClient()
  const { data } = await supabase
    .from('commissions')
    .select('organization_id')
    .eq('id', commissionId)
    .maybeSingle()
  const orgId = data?.organization_id
  if (!orgId) return false
  return context.orgAdminOf.some((o) => o.organization.id === orgId)
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
