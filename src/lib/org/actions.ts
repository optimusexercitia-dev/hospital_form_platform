'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import { orgHref } from '@/lib/routing'
import type { ActionState } from '@/lib/admin/actions'
// The appoint/revoke-coordinator actions return the `useActionState`-shaped result
// with a success `message` (the FE coordinator-manager reads `result.message`); the
// `@/lib/admin/actions` ActionState used by the form actions above has no `message`.
import type { ActionState as MutationActionState } from '@/lib/safety/types'
import type { TablesInsert } from '@/lib/types/database'

/**
 * ORG-admin (customer) provisioning server actions — multi-tenancy Phase C
 * (Architecture Rules 9 & 10). Unlike `@/lib/platform/actions` (vendor,
 * service-role), these run with the org_admin's OWN session and RLS is the
 * authority: the `hospitals_write` / `commissions` write policies already gate on
 * `is_org_admin_of(...)`. Each action ALSO re-verifies `is_org_admin_of(orgId)`
 * server-side before any write (defense in depth + a friendly forbidden message),
 * never trusting the client.
 *
 * `useActionState`-shaped (`(prevState, formData) => ActionState`). All
 * user-facing strings are pt-BR; raw Supabase/Postgres errors never reach the UI.
 */

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  nameRequired: 'Informe o nome.',
  slugRequired: 'Informe o identificador (slug).',
  slugInvalid:
    'Use apenas letras minúsculas, números e hífens (ex.: controle-infeccao).',
  hospitalSlugTaken: 'Já existe um hospital com esse identificador nesta organização.',
  commissionSlugTaken: 'Já existe uma comissão com esse identificador nesta organização.',
  missingOrg: 'Organização não encontrada.',
  missingHospital: 'Selecione um hospital.',
  hospitalCreated: 'Hospital criado com sucesso.',
  commissionCreated: 'Comissão criada com sucesso.',
} as const

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const PG_UNIQUE_VIOLATION = '23505'

/** Authorize: the caller is org_admin of `orgId` (or a platform admin). */
async function authorizeOrgAdmin(orgId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.orgAdminOf.some((o) => o.organization.id === orgId)
}

/**
 * Create a hospital within the org_admin's own organization. Slug unique per org.
 * formData: `organizationId`, `name`, `slug`.
 */
export async function createHospital(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const organizationId = String(formData.get('organizationId') ?? '')
  if (!organizationId) {
    return { ok: false, error: MESSAGES.missingOrg }
  }
  if (!(await authorizeOrgAdmin(organizationId))) {
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
  const { error } = await supabase
    .from('hospitals')
    .insert({ organization_id: organizationId, name, slug })

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      return { ok: false, fieldErrors: { slug: MESSAGES.hospitalSlugTaken } }
    }
    return { ok: false, error: MESSAGES.generic }
  }

  const context = await getSessionContext()
  const orgSlug = context?.orgAdminOf.find(
    (o) => o.organization.id === organizationId,
  )?.organization.slug
  if (orgSlug) revalidatePath(orgHref(orgSlug, 'manage'))
  return { ok: true, error: MESSAGES.hospitalCreated }
}

/**
 * Create a commission under a hospital in the org_admin's org. The commission's
 * `organization_id` is auto-derived from `hospitalId` by the
 * `commission_derive_organization_id` trigger (never sent by the client). Slug is
 * unique per org (`commissions_org_slug_key`). The org is resolved from the
 * selected hospital for the authorization check.
 * formData: `hospitalId`, `name`, `slug`.
 */
export async function createCommission(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const hospitalId = String(formData.get('hospitalId') ?? '')
  if (!hospitalId) {
    return { ok: false, fieldErrors: { hospitalId: MESSAGES.missingHospital } }
  }

  const supabase = await createClient()

  // Resolve the hospital's org to authorize (RLS lets the org_admin read its
  // hospitals; a foreign/unknown hospital yields no row → forbidden).
  const { data: hospital } = await supabase
    .from('hospitals')
    .select('organization_id, organizations:organization_id(slug)')
    .eq('id', hospitalId)
    .maybeSingle<{
      organization_id: string
      organizations: { slug: string } | null
    }>()

  if (!hospital) {
    return { ok: false, fieldErrors: { hospitalId: MESSAGES.missingHospital } }
  }
  if (!(await authorizeOrgAdmin(hospital.organization_id))) {
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

  // organization_id is NOT sent — the BEFORE INSERT trigger derives it from
  // hospital_id (non-app-writable). RLS commissions WITH CHECK (is_org_admin_of
  // the derived org) is the final authority. The generated Insert type marks
  // organization_id required (it is NOT NULL) but the DB trigger supplies it, so
  // we omit it; the cast documents that the column is DB-populated, not app-set.
  const { error } = await supabase.from('commissions').insert({
    name,
    slug,
    hospital_id: hospitalId,
  } as TablesInsert<'commissions'>)

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      return { ok: false, fieldErrors: { slug: MESSAGES.commissionSlugTaken } }
    }
    return { ok: false, error: MESSAGES.generic }
  }

  if (hospital.organizations?.slug) {
    revalidatePath(orgHref(hospital.organizations.slug, 'manage'))
  }
  return { ok: true, error: MESSAGES.commissionCreated }
}

// ===========================================================================
// NSP-coordinator appointment (NSP-per-org, ADR 0042) — the org_admin's BOOTSTRAP of
// the per-org roster curator (three-way duty separation: org_admin APPOINTS the
// coordinator; the coordinator CURATES pqs_members; enrollment grants PHI read).
// ===========================================================================

const COORD_MESSAGES = {
  forbidden: 'Apenas um administrador da organização pode nomear o coordenador do NSP.',
  generic: 'Não foi possível concluir. Tente novamente.',
  appointed: 'Coordenador(a) do NSP nomeado(a).',
  revoked: 'Coordenação do NSP removida.',
  isOrgAdmin:
    'Este usuário é administrador da organização; um usuário tem um único papel. Não é possível torná-lo coordenador do NSP.',
} as const

/**
 * Appoint `userId` as the `nsp_coordinator` of `orgId`. Writes the `organization_members`
 * role; gated `is_org_admin_of(orgId)` — the org_admin's bootstrap action. RLS
 * (`organization_members_write` = `is_admin OR is_org_admin_of`) is the DB authority;
 * we ALSO re-check `is_org_admin_of` server-side (defense in depth — ADR 0041 amd-11:
 * never trust the client on a tenant write). Idempotent on the `(org, user)` row
 * (UNIQUE) → upserts the role to `nsp_coordinator`.
 *
 * REFUSES if the target is currently an `org_admin` of the org: `organization_members`
 * is one-row-per-(org,user) with a single role, so overwriting it would DEMOTE the
 * admin → coordinator — appoint the org's last admin and the org has zero admins
 * (only a walled-off platform_admin could recover it). Refusing makes `org_admin` and
 * `nsp_coordinator` MUTUALLY EXCLUSIVE per user, which reinforces the ADR 0042 duty
 * separation (distinct people: org_admin appoints, coordinator curates) and removes
 * the orphan-the-org footgun. (Revoke is already role-filtered, so it never touches an
 * admin row.)
 */
export async function appointNspCoordinator(
  orgId: string,
  userId: string,
): Promise<MutationActionState> {
  if (!orgId || !userId) {
    return { ok: false, error: COORD_MESSAGES.generic }
  }
  if (!(await authorizeOrgAdmin(orgId))) {
    return { ok: false, error: COORD_MESSAGES.forbidden }
  }

  const supabase = await createClient()

  // Refuse to demote a current org_admin (the orphan-the-org guard). RLS lets the
  // org_admin caller read its org's organization_members rows.
  const { data: existing } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle<{ role: string }>()

  if (existing?.role === 'org_admin') {
    return { ok: false, error: COORD_MESSAGES.isOrgAdmin }
  }

  const { error } = await supabase
    .from('organization_members')
    .upsert(
      { organization_id: orgId, user_id: userId, role: 'nsp_coordinator' },
      { onConflict: 'organization_id,user_id' },
    )

  if (error) {
    return { ok: false, error: COORD_MESSAGES.generic }
  }

  const context = await getSessionContext()
  const orgSlug = context?.orgAdminOf.find(
    (o) => o.organization.id === orgId,
  )?.organization.slug
  if (orgSlug) revalidatePath(orgHref(orgSlug, 'manage'))
  return { ok: true, message: COORD_MESSAGES.appointed }
}

/**
 * Revoke `userId`'s `nsp_coordinator` role in `orgId`. Deletes ONLY a coordinator
 * membership row (the `role = 'nsp_coordinator'` filter protects an org_admin's row
 * from accidental deletion). Gated + re-checked `is_org_admin_of(orgId)`. Idempotent
 * (a no-op if the user isn't a coordinator). Note: this does NOT touch the user's
 * `pqs_members` enrollment — a coordinator who self-enrolled stays a PHI reader until
 * removed from the roster (separate concern; the coordinator role only governs
 * curation rights).
 */
export async function revokeNspCoordinator(
  orgId: string,
  userId: string,
): Promise<MutationActionState> {
  if (!orgId || !userId) {
    return { ok: false, error: COORD_MESSAGES.generic }
  }
  if (!(await authorizeOrgAdmin(orgId))) {
    return { ok: false, error: COORD_MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .eq('role', 'nsp_coordinator')

  if (error) {
    return { ok: false, error: COORD_MESSAGES.generic }
  }

  const context = await getSessionContext()
  const orgSlug = context?.orgAdminOf.find(
    (o) => o.organization.id === orgId,
  )?.organization.slug
  if (orgSlug) revalidatePath(orgHref(orgSlug, 'manage'))
  return { ok: true, message: COORD_MESSAGES.revoked }
}
