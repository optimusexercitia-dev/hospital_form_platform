'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import type { MemberCapability } from '@/lib/queries/members'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * Commission member-management server actions (Architecture Rules 9 & 10):
 * add/remove STAFF. `useActionState`-shaped. All user-facing strings pt-BR;
 * raw Supabase/Postgres errors NEVER reach the UI (CLAUDE.md §8).
 *
 * A coordinator may only add users ALREADY registered on the platform — brand-new
 * users are registered by an org_admin (`@/lib/users/actions` → `registerUser`),
 * so `addStaff` takes a `userId` chosen from the coordinator-gated addable roster,
 * never an arbitrary e-mail that would provision a new account.
 *
 * SECURITY: each action re-verifies, server-side and COMMISSION-SCOPED, that the
 * caller is a staff_admin OF THAT SPECIFIC commission OR an org_admin of the
 * commission's ORGANIZATION, BEFORE any write — the client is never trusted. The
 * target role is hard-coded ('staff'); it is never read from formData, so a
 * tampered form cannot escalate to staff_admin via `addStaff`, and `addStaff`
 * re-verifies the target is an ADDABLE org user (active, same org, not already a
 * member) before the service-role membership upsert. The platform_admin
 * (`isAdmin`) is NOT authorized here — it is walled off from tenant data and
 * provisions org/hospital/org_admin only (`@/lib/platform/actions`).
 */

export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  missingCommission: 'Comissão não encontrada.',
  missingUser: 'Usuário não encontrado.',
  userRequired: 'Selecione uma pessoa cadastrada para adicionar.',
  userNotAddable:
    'Esta pessoa não está disponível para adicionar a esta comissão.',
  staffAdded: 'Usuário adicionado à comissão com sucesso.',
  staffRemoved: 'Usuário removido da comissão com sucesso.',
  administrativoAppointed: 'Membro tornado Administrativo com sucesso.',
  administrativoRevoked: 'Delegação de Administrativo removida com sucesso.',
  capabilityGranted: 'Permissão concedida com sucesso.',
  capabilityRevoked: 'Permissão removida com sucesso.',
  invalidCapability: 'Permissão inválida.',
} as const

/** The finite Administrativo capability menu (ADR 0061) — mirrors the DB CHECK. */
const CAPABILITIES: readonly MemberCapability[] = [
  'schedule_meetings',
  'create_cases',
  'assign_case_phases',
  'view_signoffs',
]

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

/**
 * Add an ALREADY-REGISTERED user as STAFF of a commission, by user id. The
 * coordinator picks from the platform's registered users (the picker is backed by
 * the coordinator-gated `list_addable_commission_members` RPC); brand-new users
 * are registered separately by an org_admin. Role is hard-coded — never read from
 * formData. Idempotent on already-a-member.
 *
 * SECURITY: after authorizing the caller, RE-VERIFY server-side (service role,
 * exact — not the capped picker list) that `userId` is an ADDABLE user of this
 * commission's org: active, anchored to the commission's organization. The
 * client's userId is never trusted, so a tampered form cannot attach a foreign-
 * org or deactivated account.
 */
export async function addStaff(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const commissionId = String(formData.get('commissionId') ?? '')
  const userId = String(formData.get('userId') ?? '')

  if (!commissionId) {
    return { ok: false, error: MESSAGES.missingCommission }
  }
  // Authorize BEFORE any service-role work.
  if (!(await authorizeStaffOps(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }
  if (!userId) {
    return { ok: false, fieldErrors: { user: MESSAGES.userRequired } }
  }

  const admin = createAdminClient()

  // Resolve the commission's denormalized (non-drifting) organization.
  const { data: commission } = await admin
    .from('commissions')
    .select('organization_id')
    .eq('id', commissionId)
    .maybeSingle()
  const orgId = commission?.organization_id
  if (!orgId) {
    return { ok: false, error: MESSAGES.missingCommission }
  }

  // Defense in depth: the target must be a registered, ACTIVE user anchored to
  // THIS organization. Mirrors the picker's addable-set gate, exactly (no cap).
  const { data: profile } = await admin
    .from('profiles')
    .select('id, home_organization_id, is_active')
    .eq('id', userId)
    .maybeSingle()
  if (
    !profile ||
    profile.home_organization_id !== orgId ||
    !profile.is_active
  ) {
    return { ok: false, fieldErrors: { user: MESSAGES.userNotAddable } }
  }

  // Hard-coded role: 'staff'. A tampered form cannot escalate here. Upsert is
  // idempotent on unique(commission_id, user_id); DO NOTHING so adding an existing
  // member (incl. a staff_admin) never silently demotes them.
  const { error } = await admin.from('commission_members').upsert(
    { commission_id: commissionId, user_id: userId, role: 'staff' },
    { onConflict: 'commission_id,user_id', ignoreDuplicates: true },
  )
  if (error) {
    return { ok: false, error: MESSAGES.generic }
  }

  revalidatePath(`/o/[org]/c/[commission]/manage/members`, 'page')
  return { ok: true, error: MESSAGES.staffAdded }
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

/**
 * Administrativo delegation (ADR 0061) — the coordinator's per-member controls in
 * the member manager. Each action re-verifies the caller is a coordinator/commission
 * -admin of THIS commission ({@link authorizeStaffOps}) before the write, then routes
 * through a guarded SECURITY DEFINER RPC that carries its OWN escalation gate (a
 * capability holder can never appoint or grant). The RLS-scoped cookie client is used
 * so `auth.uid()` is the caller; raw Postgres errors are mapped to pt-BR messages and
 * NEVER surface (CLAUDE.md §8). Appoint/grant/revoke are audited in the DB.
 */

/** Appoint a `staff` member of the commission as an Administrativo. */
export async function appointAdministrativo(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const commissionId = String(formData.get('commissionId') ?? '')
  const userId = String(formData.get('userId') ?? '')

  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (!(await authorizeStaffOps(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }
  if (!userId) return { ok: false, error: MESSAGES.missingUser }

  const supabase = await createClient()
  const { error } = await supabase.rpc('appoint_administrativo', {
    p_commission_id: commissionId,
    p_user_id: userId,
  })
  if (error) return { ok: false, error: MESSAGES.generic }

  revalidatePath(`/o/[org]/c/[commission]/manage/members`, 'page')
  return { ok: true, error: MESSAGES.administrativoAppointed }
}

/** Revoke an Administrativo appointment (cascades its capabilities in the DB). */
export async function revokeAdministrativo(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const commissionId = String(formData.get('commissionId') ?? '')
  const userId = String(formData.get('userId') ?? '')

  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (!(await authorizeStaffOps(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }
  if (!userId) return { ok: false, error: MESSAGES.missingUser }

  const supabase = await createClient()
  const { error } = await supabase.rpc('revoke_administrativo', {
    p_commission_id: commissionId,
    p_user_id: userId,
  })
  if (error) return { ok: false, error: MESSAGES.generic }

  revalidatePath(`/o/[org]/c/[commission]/manage/members`, 'page')
  return { ok: true, error: MESSAGES.administrativoRevoked }
}

/** Grant one capability from the finite menu to an appointed Administrativo. */
export async function grantMemberCapability(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const commissionId = String(formData.get('commissionId') ?? '')
  const userId = String(formData.get('userId') ?? '')
  const capability = String(formData.get('capability') ?? '')

  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (!(await authorizeStaffOps(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }
  if (!userId) return { ok: false, error: MESSAGES.missingUser }
  if (!CAPABILITIES.includes(capability as MemberCapability)) {
    return { ok: false, error: MESSAGES.invalidCapability }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('grant_member_capability', {
    p_commission_id: commissionId,
    p_user_id: userId,
    p_capability: capability,
  })
  if (error) return { ok: false, error: MESSAGES.generic }

  revalidatePath(`/o/[org]/c/[commission]/manage/members`, 'page')
  return { ok: true, error: MESSAGES.capabilityGranted }
}

/** Revoke one capability from an appointed Administrativo (idempotent). */
export async function revokeMemberCapability(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const commissionId = String(formData.get('commissionId') ?? '')
  const userId = String(formData.get('userId') ?? '')
  const capability = String(formData.get('capability') ?? '')

  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (!(await authorizeStaffOps(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }
  if (!userId) return { ok: false, error: MESSAGES.missingUser }
  if (!CAPABILITIES.includes(capability as MemberCapability)) {
    return { ok: false, error: MESSAGES.invalidCapability }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('revoke_member_capability', {
    p_commission_id: commissionId,
    p_user_id: userId,
    p_capability: capability,
  })
  if (error) return { ok: false, error: MESSAGES.generic }

  revalidatePath(`/o/[org]/c/[commission]/manage/members`, 'page')
  return { ok: true, error: MESSAGES.capabilityRevoked }
}
