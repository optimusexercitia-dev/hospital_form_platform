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
    // The invited org_admin is a tenant user → anchor their profile to the
    // target org (the deferred anchor invariant requires a home org).
    const { userId } = await resolveOrInviteUser(
      admin,
      email,
      `${origin}/auth/confirm`,
      organizationId,
    )

    // Hard-coded role: 'org_admin'. ADR 0094 W3/T3.3 — through the DOOR, service
    // path (`grant_role_for`). ADR 0075 kept this a direct insert because "the
    // grant_role door would fail here since the admin client has no auth.uid()";
    // W3 untied the door's authority from the session, so that reason is gone and
    // this provisioning path is now governed by the same kernel as every other grant.
    //
    // The actor is the platform_admin `requireAdmin()` already authorized above.
    // `grant_role_impl`'s org_admin arm admits `app.is_admin_for(p_actor)`, which is
    // the tenancy arm of the noun rule (CLAUDE.md §1) — bootstrapping an
    // organization's FIRST administrator is exactly the case where no tenant admin
    // can exist yet, so platform_admin is the only possible actor.
    //
    // ORG-TIER row (`commission_id` NULL), so `memberships_one_commission_role_uq`
    // (partial, `WHERE commission_id IS NOT NULL`) does not apply: a principal may
    // legitimately hold org_admin AND nsp_org_admin of the same organization. The
    // kernel's `on conflict do nothing` keeps a repeat provision idempotent.
    const actorId = (await getSessionContext())?.userId
    if (!actorId) {
      return { ok: false, error: MESSAGES.forbidden }
    }
    const { error } = await admin.rpc('grant_role_for', {
      p_actor: actorId,
      p_scope_type: 'organization',
      p_scope_id: organizationId,
      p_role: 'org_admin',
      p_user: userId,
    })
    if (error) {
      return { ok: false, error: MESSAGES.generic }
    }

    // ── AFF W3 / T3.4 — SINGLE-HOSPITAL PROVISIONING (ADR 0097 D16/D17) ──────────
    // A one-hospital tenant with one administrator is the common shape, and until
    // now it was UNSEATABLE: `grant_role_impl` denies `p_user = p_actor` on every
    // path including the service path, so the new org_admin could not grant
    // themselves `hospital_admin`; and the branch required
    // `is_org_admin_of_for(org, p_actor)` with no `is_admin_for` arm, so the
    // provisioning platform admin was denied 42501 too. There was no working path
    // at all (external audit BLOCKER-1). T2.5 (`20260909000900`) added the arm; this
    // is the caller it was added for, and pgTAP `302` §6.1 is its keystone.
    //
    // ⚠ The actor is the PLATFORM ADMIN, never the new org_admin. That sidesteps the
    // self-grant guard WITHOUT weakening it — the guard stays exactly as it is, and
    // `302` §6.4 pins that it still fires.
    //
    // Exactly ONE hospital, or nothing: with two or more there is no unambiguous
    // choice, and D16 keeps the explicit appointment step for multi-hospital orgs.
    // A repeat provision is idempotent (the kernel's targeted `on conflict do
    // nothing`), and `ADR 0097` finding 8 confirms one principal may legitimately
    // hold `org_admin` + `hospital_admin` of the same org.
    const { data: hospitals } = await admin
      .from('hospitals')
      .select('id')
      .eq('organization_id', organizationId)
      .returns<{ id: string }[]>()

    if ((hospitals ?? []).length === 1) {
      const { error: hospitalError } = await admin.rpc('grant_role_for', {
        p_actor: actorId,
        p_scope_type: 'hospital',
        p_scope_id: hospitals![0].id,
        p_role: 'hospital_admin',
        p_user: userId,
      })
      // Do NOT swallow: the org_admin grant landed, so a silent failure here leaves a
      // tenant whose only administrator cannot manage its only hospital — the exact
      // half-provisioned state this task exists to prevent.
      if (hospitalError) {
        return { ok: false, error: MESSAGES.generic }
      }
    }
  } catch {
    return { ok: false, error: MESSAGES.generic }
  }

  revalidatePath('/admin')
  return { ok: true, error: MESSAGES.orgAdminAssigned }
}
