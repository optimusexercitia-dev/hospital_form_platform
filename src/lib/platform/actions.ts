'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { resolveOrInviteUser } from '@/lib/members/invite'
import type { ActionState } from '@/lib/admin/actions'

/**
 * PLATFORM-admin (vendor) provisioning server actions — multi-tenancy Phase C
 * (Architecture Rules 9 & 10). These run behind a `requireAdmin()`
 * (platform_admin / `is_admin`) gate; provisioning a new organization is a
 * vendor-only operation. platform_admin is walled off from all tenant data/PHI
 * (Phase B) — its ONLY tenant-adjacent reach is this provisioning surface
 * (create org, create the org's first hospital, seat the org's first org_admin).
 * All subsequent in-org administration is the org_admin's job (`@/lib/org/actions`).
 *
 * `useActionState`-shaped (`(prevState, formData) => ActionState`). All
 * user-facing strings are pt-BR; raw Supabase/Postgres errors NEVER reach the UI.
 * The org/hospital create writes use the org_admin-or-admin RLS (the actor is a
 * platform_admin, so the policy's `is_admin()` term authorizes); `assignOrgAdmin`
 * uses the service-role client for the cross-user lookup/invite + membership write,
 * so the explicit `requireAdmin()` check is the authority, not RLS.
 */

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  nameRequired: 'Informe o nome.',
  slugRequired: 'Informe o identificador (slug).',
  slugInvalid:
    'Use apenas letras minúsculas, números e hífens (ex.: hospital-central).',
  orgSlugTaken: 'Já existe uma organização com esse identificador.',
  hospitalSlugTaken: 'Já existe um hospital com esse identificador nesta organização.',
  emailRequired: 'Informe o e-mail.',
  emailInvalid: 'Informe um e-mail válido.',
  missingOrg: 'Organização não encontrada.',
  orgCreated: 'Organização criada com sucesso.',
  hospitalCreated: 'Hospital criado com sucesso.',
  orgAdminAssigned: 'Administrador(a) da organização atribuído(a) com sucesso.',
} as const

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PG_UNIQUE_VIOLATION = '23505'

async function requireAdmin(): Promise<boolean> {
  const context = await getSessionContext()
  return context?.isAdmin === true
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
 * Create an organization (top-level tenant). Platform-admin only. Validates
 * `name` + `slug`; the globally-unique `organizations_slug_key` citext constraint
 * is the uniqueness authority (a conflict maps to a friendly pt-BR field error).
 * formData: `name`, `slug`.
 */
export async function createOrganization(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireAdmin())) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const name = String(formData.get('name') ?? '').trim()
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase()

  const fieldErrors: Record<string, string> = {}
  if (!name) fieldErrors.name = MESSAGES.nameRequired
  if (!slug) fieldErrors.slug = MESSAGES.slugRequired
  else if (!SLUG_PATTERN.test(slug)) fieldErrors.slug = MESSAGES.slugInvalid
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('organizations').insert({ name, slug })

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      return { ok: false, fieldErrors: { slug: MESSAGES.orgSlugTaken } }
    }
    return { ok: false, error: MESSAGES.generic }
  }

  revalidatePath('/admin')
  return { ok: true, error: MESSAGES.orgCreated }
}

/**
 * Create a hospital under an organization. Platform-admin only at this seam (the
 * org_admin gets its own `createHospital` in `@/lib/org/actions`). Slug is unique
 * per org (`hospitals_org_slug_key`).
 * formData: `organizationId`, `name`, `slug`.
 */
export async function createHospital(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireAdmin())) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const organizationId = String(formData.get('organizationId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase()

  if (!organizationId) {
    return { ok: false, error: MESSAGES.missingOrg }
  }
  const fieldErrors: Record<string, string> = {}
  if (!name) fieldErrors.name = MESSAGES.nameRequired
  if (!slug) fieldErrors.slug = MESSAGES.slugRequired
  else if (!SLUG_PATTERN.test(slug)) fieldErrors.slug = MESSAGES.slugInvalid
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('hospitals')
    .insert({ organization_id: organizationId, name, slug })

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      return { ok: false, fieldErrors: { slug: MESSAGES.hospitalSlugTaken } }
    }
    return { ok: false, error: MESSAGES.generic }
  }

  revalidatePath('/admin')
  return { ok: true, error: MESSAGES.hospitalCreated }
}

/**
 * Seat an org_admin on an organization BY EMAIL: resolve the existing user or
 * invite a new one, then upsert their `organization_members` row with
 * `role = 'org_admin'` HARD-CODED (never read from formData). Platform-admin only.
 * A verbatim clone of `assignStaffAdmin` targeting `organization_members`.
 * Idempotent on `(organization_id, user_id)`.
 * formData: `organizationId`, `email`.
 */
export async function assignOrgAdmin(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  if (!(await requireAdmin())) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const organizationId = String(formData.get('organizationId') ?? '')
  const email = String(formData.get('email') ?? '').trim().toLowerCase()

  if (!organizationId) {
    return { ok: false, error: MESSAGES.missingOrg }
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

    // Hard-coded role: 'org_admin'. Upsert is idempotent on
    // unique(organization_id, user_id).
    const { error } = await admin.from('organization_members').upsert(
      { organization_id: organizationId, user_id: userId, role: 'org_admin' },
      { onConflict: 'organization_id,user_id' },
    )
    if (error) {
      return { ok: false, error: MESSAGES.generic }
    }
  } catch {
    return { ok: false, error: MESSAGES.generic }
  }

  revalidatePath('/admin')
  return { ok: true, error: MESSAGES.orgAdminAssigned }
}
