'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isCommissionAdmin } from '@/lib/auth/access'
import { getSessionContext } from '@/lib/queries/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { resolveOrInviteUser } from '@/lib/members/invite'
import type { Database, TablesInsert } from '@/lib/types/database'

/**
 * Admin-only server actions (Architecture Rules 9 & 10): commission CRUD and
 * staff_admin assignment/removal. `useActionState`-shaped
 * (`(prevState, formData) => ActionState`). All user-facing strings are pt-BR;
 * raw Supabase/Postgres errors NEVER reach the UI (CLAUDE.md §8).
 *
 * SECURITY: every action re-authorizes server-side BEFORE any write — the client
 * is never trusted. The commission CRUD actions check
 * `getSessionContext().isAdmin`; the coordinator actions use
 * {@link authorizeStaffAdminOps}, which is the tenancy tier, not `isAdmin`. The
 * target role is hard-coded per action (`assignStaffAdmin` always writes
 * 'staff_admin'); it is never read from formData, so a tampered form cannot
 * change which role is granted.
 *
 * ⚠ The membership writes go through `grant_role`/`revoke_role` on the COOKIE
 * client (ADR 0094 W3/T3.3), so PostgreSQL re-derives authority for the real
 * actor and the DB door — not this file — is the authority. The service-role
 * client survives only for `resolveOrInviteUser` (cross-user lookup + invite),
 * which never touches `memberships`. This paragraph used to say the opposite.
 */

export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  nameRequired: 'Informe o nome da comissão.',
  slugRequired: 'Informe o identificador (slug) da comissão.',
  slugInvalid:
    'Use apenas letras minúsculas, números e hífens (ex.: controle-infeccao).',
  slugTaken: 'Já existe uma comissão com esse identificador.',
  hospitalRequired: 'Selecione um hospital.',
  emailRequired: 'Informe o e-mail.',
  emailInvalid: 'Informe um e-mail válido.',
  missingCommission: 'Comissão não encontrada.',
  missingUser: 'Usuário não encontrado.',
  staffAdminAssigned: 'Coordenador(a) atribuído(a) com sucesso.',
  staffAdminRemoved: 'Coordenador(a) removido(a) com sucesso.',
  commissionCreated: 'Comissão criada com sucesso.',
  commissionUpdated: 'Comissão atualizada com sucesso.',
} as const

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Postgres unique-violation. */
const PG_UNIQUE_VIOLATION = '23505'

async function requireAdmin(): Promise<boolean> {
  const context = await getSessionContext()
  return context?.isAdmin === true
}

/**
 * Authorize a staff_admin-management action for a commission: an `org_admin` of
 * the commission's ORGANIZATION **or** a `hospital_admin` of its HOSPITAL (ADR
 * 0167 clause 2). Resolves the commission's `organization_id` + `hospital_id`
 * (both NOT NULL) and delegates to {@link isCommissionAdmin}.
 *
 * ⛔ THE PREDICATE IS NOT RE-DERIVED HERE. `isCommissionAdmin` already IS
 * "org_admin of the org OR hospital_admin of the hospital" — the TS mirror of
 * `app.is_tenancy_admin_of_for`, the DB door these actions call. A third copy is
 * how this repo's sibling-axis defects keep recurring, and the copy is what lets
 * one arm be widened while its twin is forgotten.
 *
 * The hospital tier was previously ABSENT here while the manage layout admitted
 * it by design (ADR 0051) and the DB door admitted it too — so a hospital admin
 * saw the coordinator form and was refused on every click. This closes that gap;
 * it opens no new authority.
 *
 * SECURITY: the platform_admin `isAdmin` short-circuit is DELIBERATELY ABSENT,
 * and it now agrees with the door rather than being stricter than it. ADR 0167
 * dropped `app.is_admin_for` from `grant_role_impl`'s commission/`staff_admin`
 * arm AND from its outgoing-role guard, so **the kernel is the control**: the
 * membership write goes through `grant_role`/`revoke_role` over the COOKIE
 * client (ADR 0094 W3/T3.3) and PostgreSQL re-derives authority for the real
 * actor. ⚠ The old reason given here — "assignStaffAdmin runs on the
 * service-role client, so this TS check is the ONLY control on that path" — was
 * false from W3/T3.3 onward: the admin client survives only for
 * `resolveOrInviteUser`, which provisions accounts and never touches
 * `memberships`. The conclusion held; the argument for it did not.
 *
 * A platform admin still provisions org/hospital/org_admin
 * (`@/lib/platform/actions`) and seats an org_admin who does this.
 */
async function authorizeStaffAdminOps(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false

  const supabase = await createClient()
  const { data } = await supabase
    .from('commissions')
    .select('organization_id, hospital_id')
    .eq('id', commissionId)
    .maybeSingle()
  if (!data?.organization_id || !data.hospital_id) return false

  return isCommissionAdmin(context, {
    organizationId: data.organization_id,
    hospitalId: data.hospital_id,
  })
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
 * Revalidate the legacy `/admin` list and `/admin/comissoes/[slug]` detail. The
 * slug is resolved from `commissionId` via the given client (any client that can
 * read the commission — admin reads all via RLS / the service role bypasses it).
 * A missing slug still revalidates the list.
 *
 * ⚠ STALE TARGETS, LEFT AS-IS DELIBERATELY (ADR 0167 corrected the prose, not the
 * behaviour): this docstring used to claim `StaffAdminManager` lives at
 * `/admin/comissoes/[slug]`. It does not — it is mounted only at
 * `/o/[org]/manage/comissoes/[commissionSlug]`, and `src/app/admin/comissoes/`
 * does not exist, so the second `revalidatePath` below matches no route. Fixing
 * which paths are revalidated is a behaviour change and is filed separately.
 */
async function revalidateCommissionPages(
  client: SupabaseClient<Database>,
  commissionId: string,
): Promise<void> {
  revalidatePath('/admin')

  const { data } = await client
    .from('commissions')
    .select('slug')
    .eq('id', commissionId)
    .maybeSingle()

  if (data?.slug) {
    revalidatePath(`/admin/comissoes/${data.slug}`)
  }
}

/**
 * Create a commission. Admin-only. Validates name + slug shape; the citext
 * unique constraint on `commissions.slug` is the authority on uniqueness (a
 * conflict maps to a friendly pt-BR field error).
 */
export async function createCommission(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireAdmin())) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const name = String(formData.get('name') ?? '').trim()
  const slug = String(formData.get('slug') ?? '')
    .trim()
    .toLowerCase()
  // Multi-tenancy (Phase C): a commission now REQUIRES a hospital (NOT NULL);
  // organization_id is auto-derived from hospital_id by the trigger. The
  // canonical create path is `@/lib/org/actions.createCommission` (org-admin
  // surface); this legacy admin action keeps working by requiring hospitalId.
  const hospitalId = String(formData.get('hospitalId') ?? '')

  const fieldErrors: Record<string, string> = {}
  if (!name) fieldErrors.name = MESSAGES.nameRequired
  if (!slug) fieldErrors.slug = MESSAGES.slugRequired
  else if (!SLUG_PATTERN.test(slug)) fieldErrors.slug = MESSAGES.slugInvalid
  if (!hospitalId) fieldErrors.hospitalId = MESSAGES.hospitalRequired
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors }
  }

  const supabase = await createClient()
  // organization_id is DB-populated by the derive trigger (NOT NULL but
  // non-app-writable); cast omits it from the app-supplied payload.
  const { error } = await supabase.from('commissions').insert({
    name,
    slug,
    hospital_id: hospitalId,
  } as TablesInsert<'commissions'>)

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      return { ok: false, fieldErrors: { slug: MESSAGES.slugTaken } }
    }
    return { ok: false, error: MESSAGES.generic }
  }

  redirect(`/admin/comissoes/${slug}`)
}

/**
 * Update a commission's NAME only. Slug is immutable after creation (it is the
 * URL key + citext unique key; editing it would break links and in-flight
 * sessions — ADR/plan decision, v1).
 */
export async function updateCommission(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireAdmin())) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const commissionId = String(formData.get('commissionId') ?? '')
  const name = String(formData.get('name') ?? '').trim()

  if (!commissionId) {
    return { ok: false, error: MESSAGES.missingCommission }
  }
  if (!name) {
    return { ok: false, fieldErrors: { name: MESSAGES.nameRequired } }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('commissions')
    .update({ name })
    .eq('id', commissionId)
    .select('slug')
    .maybeSingle()

  if (error) {
    return { ok: false, error: MESSAGES.generic }
  }
  if (!data) {
    return { ok: false, error: MESSAGES.missingCommission }
  }

  revalidatePath('/admin')
  revalidatePath(`/admin/comissoes/${data.slug}`)
  return { ok: true, error: MESSAGES.commissionUpdated }
}

/**
 * Assign a staff_admin to a commission BY EMAIL: resolve the existing user or
 * invite a new one, then upsert their membership as 'staff_admin'. Admin-only.
 * The role is hard-coded — never read from formData. Idempotent: re-assigning an
 * existing member promotes/keeps them as staff_admin.
 */
export async function assignStaffAdmin(
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
  // org_admin of the commission's org OR hospital_admin of its hospital (ADR
  // 0167 clause 2). ⚠ NOT platform_admin — this comment claimed it was, and the
  // gate has always refused one.
  if (!(await authorizeStaffAdminOps(commissionId))) {
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

  // The commission's denormalized (non-drifting) org anchors a freshly-invited
  // tenant user's profile — the deferred anchor invariant requires it.
  const { data: commission } = await admin
    .from('commissions')
    .select('organization_id')
    .eq('id', commissionId)
    .maybeSingle()
  const orgId = commission?.organization_id
  if (!orgId) {
    return { ok: false, error: MESSAGES.missingCommission }
  }

  try {
    const { userId } = await resolveOrInviteUser(
      admin,
      email,
      `${origin}/auth/confirm`,
      orgId,
    )

    // Hard-coded role: 'staff_admin'. ADR 0094 W3/T3.3 — the membership write goes
    // through the DOOR over the cookie client, so authority is re-derived in
    // PostgreSQL for the real actor rather than asserted only in TypeScript. (The
    // admin client above is still needed for `resolveOrInviteUser`, which provisions
    // accounts; it no longer touches `memberships`.)
    //
    // Unlike `addStaff`, this action's whole purpose IS the role change, so
    // `grant_role`'s T1.0 replacement semantic is exactly what is wanted: promoting
    // an existing 'staff' member updates the row in place, preserving its identity
    // and the member's per-commission title and emitting one
    // `membership.role_changed` audit event. Re-assigning an existing staff_admin is
    // idempotent inside the door.
    const supabase = await createClient()
    const { error } = await supabase.rpc('grant_role', {
      p_scope_type: 'commission',
      p_scope_id: commissionId,
      p_role: 'staff_admin',
      p_user: userId,
    })
    if (error) {
      return { ok: false, error: MESSAGES.generic }
    }
  } catch {
    return { ok: false, error: MESSAGES.generic }
  }

  // Revalidate the legacy /admin surfaces. ⚠ See revalidateCommissionPages: the
  // route StaffAdminManager actually lives on is
  // /o/[org]/manage/comissoes/[commissionSlug], which these calls do NOT reach.
  // The slug read reuses the elevated client we hold.
  await revalidateCommissionPages(admin, commissionId)
  return { ok: true, error: MESSAGES.staffAdminAssigned }
}

/**
 * Remove a staff_admin from a commission (deletes the membership row).
 * `org_admin` of the commission's org OR `hospital_admin` of its hospital (ADR
 * 0167 clause 2). ⚠ NOT platform_admin — this docstring claimed it was, and the
 * gate has always refused one; since ADR 0167 the `revoke_role` door refuses one
 * too, on the same predicate.
 */
export async function removeStaffAdmin(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const commissionId = String(formData.get('commissionId') ?? '')
  const userId = String(formData.get('userId') ?? '')

  if (!commissionId) {
    return { ok: false, error: MESSAGES.missingCommission }
  }
  if (!(await authorizeStaffAdminOps(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }
  if (!userId) {
    return { ok: false, error: MESSAGES.missingUser }
  }

  const supabase = await createClient()
  // MEM (ADR 0075): RLS-scoped removal routes through the revoke_role door (memberships
  // has no direct write policy). Scoped to the staff_admin grant so this action removes
  // only the intended role; staff removal goes through the members action.
  const { error } = await supabase.rpc('revoke_role', {
    p_scope_type: 'commission',
    p_scope_id: commissionId,
    p_role: 'staff_admin',
    p_user: userId,
  })

  if (error) {
    return { ok: false, error: MESSAGES.generic }
  }

  await revalidateCommissionPages(supabase, commissionId)
  return { ok: true, error: MESSAGES.staffAdminRemoved }
}
