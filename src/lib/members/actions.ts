'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import type { MemberCapability } from '@/lib/queries/members'
import { isOneCommissionRoleViolation } from '@/lib/members/membership-conflict'
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
 * Authorize a staff-management action for a specific commission. This is the app-layer
 * MIRROR of the authority the six doors below already enforce, and it must be neither
 * weaker NOR STRONGER than they are.
 *
 * ⚠ BUG-AFF-1 — IT WAS STRONGER, AND THAT IS WHY NOTHING CAUGHT IT. The mirror had two
 * arms (staff_admin of the commission, org_admin of its org) while every door it fronts
 * gates on `app.is_commission_admin_of[_for]`, which resolves to:
 *
 *     has_role('organization', c.organization_id, 'org_admin')
 *  OR has_role('hospital',     c.hospital_id,     'hospital_admin')
 *
 * — the HOSPITAL leg was missing here and present everywhere else. Verified against the
 * live catalog for all six doors this helper fronts, not inferred from one:
 *   `appoint_administrativo`, `revoke_administrativo`, `grant_member_capability` and
 *   `revoke_member_capability` each gate on `is_staff_admin_of OR is_commission_admin_of`;
 *   `grant_role`/`revoke_role` delegate to `app.grant_role_impl`/`app.revoke_role_impl`,
 *   whose commission-tier arms admit `is_commission_admin_of_for` for BOTH `staff` and
 *   `staff_admin` (including the T1.0 role-replacement branch).
 * The READ side already admitted them too — `list_addable_commission_members` is org-scoped
 * (ADR 0097 finding 1), which is why the picker populated. So a hospital admin got a full
 * candidate list and a generic refusal at submit, and widening this grants NOTHING the
 * database did not already grant.
 *
 * A mirror that is too STRICT fails CLOSED, and a refusal always looks like the system
 * working — which is the whole reason this survived. Recorded in ADR 0098 §W3.7; do not
 * re-narrow it "for consistency" with the other TS checks.
 *
 * ⚠ `isInactive` is checked here for the same reason, and it is a SECOND instance of the
 * same drift found while deriving this one: `is_commission_admin_of_for` folds
 * `app.is_active(p_user_id)`, but `getSessionContext` does not empty the grant lists for a
 * suspended or deactivated caller — it reports `isInactive` separately. Every sibling
 * helper checks it; this one did not. Strictly narrowing, and it makes the mirror faithful.
 *
 * SECURITY (multi-tenancy): the platform_admin `isAdmin` short-circuit remains
 * DELIBERATELY ABSENT. `inviteStaff` runs on the SERVICE-ROLE client (bypasses RLS), so
 * this TS check is the ONLY control there — a platform admin must NOT invite/manage staff
 * in any commission. That is a place where the mirror is deliberately stricter than
 * `grant_role_impl` (which carries an `is_admin_for` arm), and it is stated rather than
 * accidental: the noun rule (ADR 0078 A35) keeps platform_admin out of commission content.
 */
async function authorizeStaffOps(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isInactive) return false

  // staff_admin of this exact commission.
  if (
    context.memberships.some(
      (m) => m.commission.id === commissionId && m.role === 'staff_admin',
    )
  ) {
    return true
  }

  // The two `is_commission_admin_of` legs. Both need the commission's scope columns, so
  // they share one read — and that read is RLS-scoped on purpose: a caller who cannot
  // SELECT the commission cannot administer it either. (`commissions_select_member_or_admin`
  // carries `app.is_hospital_admin_of(hospital_id)`, so the hospital leg is reachable —
  // checked live, because a gate whose own precondition denies it is an inert fix.)
  if (context.orgAdminOf.length === 0 && context.hospitalAdminOf.length === 0) return false
  const supabase = await createClient()
  const { data } = await supabase
    .from('commissions')
    .select('organization_id, hospital_id')
    .eq('id', commissionId)
    .maybeSingle()
  if (!data) return false

  if (
    data.organization_id &&
    context.orgAdminOf.some((o) => o.organization.id === data.organization_id)
  ) {
    return true
  }
  return (
    Boolean(data.hospital_id) &&
    context.hospitalAdminOf.some((h) => h.hospital.id === data.hospital_id)
  )
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

  // ADR 0094 W3/T3.3 — the membership write goes through the DOOR. This action is
  // cookie-authenticated, so the plain `grant_role` applies: it resolves the actor
  // from auth.uid() and re-derives authority in PostgreSQL, independently of the
  // TypeScript check above. ADR 0075's "service-role writers keep direct DML because
  // the door needs an auth.uid()" no longer applies — W3 untied the door's authority
  // from the session.
  //
  // ⚠ THE PRE-CHECK IS LOAD-BEARING, and it is a PRODUCT rule, not an authorization
  // one. `grant_role` implements the T1.0 replacement semantic: granting 'staff' to
  // someone who holds 'staff_admin' REPLACES the role. That is right for
  // `assignCommitteeRole` (whose purpose is the role change) and wrong here — this
  // action is "add this person to the commission", and a coordinator must not be
  // silently demoted by it. So: already a member in ANY role => nothing to do.
  // Reads, not DML, so the raw-DML repo gate is satisfied.
  const { data: existing } = await admin
    .from('memberships')
    .select('id')
    .eq('commission_id', commissionId)
    .eq('principal_id', userId)
    .maybeSingle()

  if (!existing) {
    const supabase = await createClient()
    const { error } = await supabase.rpc('grant_role', {
      p_scope_type: 'commission',
      p_scope_id: commissionId,
      p_role: 'staff',
      p_user: userId,
    })
    // A concurrent add loses the race on memberships_one_commission_role_uq; that is
    // the same "already a member" outcome, so report success rather than a scary
    // generic error.
    if (error && !isOneCommissionRoleViolation(error)) {
      return { ok: false, error: MESSAGES.generic }
    }
  }

  revalidatePath(`/o/[org]/c/[commission]/manage/members`, 'page')
  return { ok: true, error: MESSAGES.staffAdded }
}

/**
 * Remove a STAFF member from a commission. MEM (ADR 0075 / O-2): `memberships` has
 * no direct write RLS policy, so this RLS-scoped path routes through the
 * `revoke_role` door over the cookie client (auth.uid() present → the incumbent
 * staff/commission-admin authority resolves in-door). The door revokes ONLY the
 * exact (commission, user, 'staff') grant — never a staff_admin or a foreign
 * commission's row. Exported signature frozen.
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
  const { error } = await supabase.rpc('revoke_role', {
    p_scope_type: 'commission',
    p_scope_id: commissionId,
    p_role: 'staff',
    p_user: userId,
  })

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
