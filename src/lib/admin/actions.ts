'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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
 * SECURITY: every action re-verifies `getSessionContext().isAdmin` server-side
 * BEFORE any write — the client is never trusted. The target role is hard-coded
 * per action (`assignStaffAdmin` always writes 'staff_admin'); it is never read
 * from formData, so a tampered form cannot change which role is granted. The
 * service-role client (used for cross-user lookup/invite + membership writes)
 * bypasses RLS, so this explicit check is the authority, not RLS.
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
 * Authorize a staff_admin-management action for a commission: platform_admin, OR
 * an org_admin of the commission's organization (multi-tenancy Phase C — the
 * org_admin owns staff_admin assignment within their org). Resolves the
 * commission's `organization_id` and checks the caller's `orgAdminOf`. Phase B
 * RLS (`commission_members_admin_all` = admin OR org_admin-of-commission) is the
 * write authority; this is the defense-in-depth server check for the service-role
 * path (`assignStaffAdmin` uses the elevated client for the invite + upsert).
 */
async function authorizeStaffAdminOps(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
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
 * Revalidate both pages a commission's staff_admin roster appears on: the
 * `/admin` list and the `/admin/comissoes/[slug]` detail (where StaffAdminManager
 * lives). The slug is resolved from `commissionId` via the given client (any
 * client that can read the commission — admin reads all via RLS / the service
 * role bypasses it). A missing slug still revalidates the list.
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
  // platform_admin OR org_admin of the commission's org (Phase C).
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

  try {
    const { userId } = await resolveOrInviteUser(
      admin,
      email,
      `${origin}/auth/confirm`,
    )

    // Hard-coded role: 'staff_admin'. Upsert is idempotent on the
    // unique(commission_id, user_id) constraint.
    const { error } = await admin.from('commission_members').upsert(
      { commission_id: commissionId, user_id: userId, role: 'staff_admin' },
      { onConflict: 'commission_id,user_id' },
    )
    if (error) {
      return { ok: false, error: MESSAGES.generic }
    }
  } catch {
    return { ok: false, error: MESSAGES.generic }
  }

  // Revalidate the list AND the detail page these actions are invoked from
  // (StaffAdminManager lives on /admin/comissoes/[slug]) so the roster is fresh
  // without a navigation. The slug read reuses the elevated client we hold.
  await revalidateCommissionPages(admin, commissionId)
  return { ok: true, error: MESSAGES.staffAdminAssigned }
}

/**
 * Remove a staff_admin from a commission (deletes the membership row).
 * platform_admin OR org_admin of the commission's org (Phase C).
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
  // Scope the delete to staff_admin rows so this action can only remove the
  // intended role; staff removal goes through the members action.
  const { error } = await supabase
    .from('commission_members')
    .delete()
    .eq('commission_id', commissionId)
    .eq('user_id', userId)
    .eq('role', 'staff_admin')

  if (error) {
    return { ok: false, error: MESSAGES.generic }
  }

  await revalidateCommissionPages(supabase, commissionId)
  return { ok: true, error: MESSAGES.staffAdminRemoved }
}
