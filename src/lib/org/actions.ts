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
// NSP-coordinator appointment (NSP-per-hospital, ADR 0052) — the `nsp_org_admin`'s
// appointment of a PER-HOSPITAL NSP head. Three-tier chain: org_admin APPOINTS the
// nsp_org_admin; the nsp_org_admin APPOINTS a hospital's nsp_coordinator; the
// coordinator (a full local operator) curates that hospital's pqs_members + reads
// PHI. `hospital_admin` has NO NSP appointment power (decision 3). Backed by the
// `assign_nsp_coordinator` / `revoke_nsp_coordinator` DEFINER RPCs (gated
// `is_nsp_org_admin_of(org_of_hospital)`, no self-delegation).
// ===========================================================================

const COORD_MESSAGES = {
  forbidden:
    'Apenas o administrador de NSP da organização pode nomear o coordenador do NSP de um hospital.',
  generic: 'Não foi possível concluir. Tente novamente.',
  self: 'Não é possível nomear a si mesmo.',
  appointed: 'Coordenador(a) do NSP nomeado(a).',
  revoked: 'Coordenação do NSP removida.',
} as const

/**
 * Authorize: the caller is `nsp_org_admin` of `orgId` (or a platform admin — the
 * documented erasure/administration exception). The `assign_nsp_coordinator` RPC's
 * `is_nsp_org_admin_of` gate is the DB authority; this is the defense-in-depth
 * re-check for a friendly forbidden message.
 */
async function authorizeNspOrgAdmin(orgId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.nspOrgAdminOf.some((o) => o.organization.id === orgId)
}

/**
 * Appoint `userId` as the `nsp_coordinator` of `hospitalId` (ADR 0052, decision 12).
 * Backed by the `assign_nsp_coordinator(p_hospital, p_user)` DEFINER RPC — gated
 * `is_nsp_org_admin_of(org_of_hospital(hospitalId))`, no self-delegation, idempotent
 * on the `(org, user, 'nsp_coordinator', hospital)` identity. We resolve the
 * hospital's org to re-check `nsp_org_admin` server-side (defense in depth) + reject
 * self-delegation with a friendly pt-BR message before the RPC.
 */
export async function assignNspCoordinator(
  hospitalId: string,
  userId: string,
): Promise<MutationActionState> {
  if (!hospitalId || !userId) {
    return { ok: false, error: COORD_MESSAGES.generic }
  }
  const context = await getSessionContext()
  if (!context) return { ok: false, error: COORD_MESSAGES.forbidden }
  if (context.userId === userId) {
    return { ok: false, error: COORD_MESSAGES.self }
  }

  const supabase = await createClient()
  // Resolve the hospital's org (RLS lets an nsp_org_admin read its org's hospitals)
  // to authorize + revalidate. A foreign/unknown hospital yields no row → forbidden.
  const { data: hospital } = await supabase
    .from('hospitals')
    .select('organization_id')
    .eq('id', hospitalId)
    .maybeSingle<{ organization_id: string }>()
  if (!hospital || !(await authorizeNspOrgAdmin(hospital.organization_id))) {
    return { ok: false, error: COORD_MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('assign_nsp_coordinator', {
    p_hospital: hospitalId,
    p_user: userId,
  })
  if (error) return { ok: false, error: COORD_MESSAGES.generic }

  const orgSlug = context.nspOrgAdminOf.find(
    (o) => o.organization.id === hospital.organization_id,
  )?.organization.slug
  if (orgSlug) revalidatePath(orgHref(orgSlug, 'manage'))
  return { ok: true, message: COORD_MESSAGES.appointed }
}

// ===========================================================================
// Hospital-admin + nsp_org_admin appointment (ADR 0051 Decision 4) — org_admin
// ONLY grants/revokes these roles (no self-delegation: appointer ≠ holder). The
// DB authority is the A4 appointment RPCs (`assign_hospital_admin` etc.); these
// server actions call them and shape the result. Behavior lands in A4; A0 posts
// the signatures so FE (A7) builds the appointment UI against real types.
// ===========================================================================

const APPOINT_MESSAGES = {
  forbidden: 'Apenas um administrador da organização pode gerenciar esta função.',
  generic: 'Não foi possível concluir. Tente novamente.',
  self: 'Não é possível nomear a si mesmo.',
  hospitalAdminGranted: 'Administrador(a) de hospital nomeado(a).',
  hospitalAdminRevoked: 'Administração de hospital removida.',
  nspOrgAdminGranted: 'Administrador(a) de NSP da organização nomeado(a).',
  nspOrgAdminRevoked: 'Administração de NSP da organização removida.',
  // WS-1 anti-lockout: revoke_org_admin raises SQLSTATE HC081 when removing the
  // org's LAST org_admin (org_admin is the org's root authority). The future
  // org-member-management UI's revokeOrgAdmin action maps error.code === 'HC081'
  // to this string. The RPC also carries the pt-BR text on the exception, but the
  // action layer should surface this friendly message rather than the raw error.
  lastOrgAdmin: 'Não é possível remover o último administrador da organização.',
} as const

/**
 * Revalidate the org-manage area after an appointment write, resolving the org
 * slug from the caller's org_admin memberships.
 */
async function revalidateOrgManage(orgId: string): Promise<void> {
  const context = await getSessionContext()
  const orgSlug = context?.orgAdminOf.find(
    (o) => o.organization.id === orgId,
  )?.organization.slug
  if (orgSlug) revalidatePath(orgHref(orgSlug, 'manage'))
}

/**
 * Appoint `userId` as a `hospital_admin` of `hospitalId` (ADR 0051). The
 * `assign_hospital_admin` DEFINER RPC is the authority (gated
 * `is_org_admin_of(org-of-hospital)`, no self-delegation, idempotent; the
 * hospital-tier audit row is emitted by the A3 trigger). We resolve the hospital's
 * org to re-check org_admin server-side (defense in depth) + reject self-delegation
 * with a friendly pt-BR message before the RPC.
 */
export async function assignHospitalAdmin(
  hospitalId: string,
  userId: string,
): Promise<MutationActionState> {
  if (!hospitalId || !userId) {
    return { ok: false, error: APPOINT_MESSAGES.generic }
  }
  const context = await getSessionContext()
  if (!context) return { ok: false, error: APPOINT_MESSAGES.forbidden }
  if (context.userId === userId) {
    return { ok: false, error: APPOINT_MESSAGES.self }
  }

  const supabase = await createClient()
  // Resolve the hospital's org (RLS lets an org_admin read its hospitals) to
  // authorize + revalidate. A foreign/unknown hospital yields no row → forbidden.
  const { data: hospital } = await supabase
    .from('hospitals')
    .select('organization_id')
    .eq('id', hospitalId)
    .maybeSingle<{ organization_id: string }>()
  if (!hospital || !(await authorizeOrgAdmin(hospital.organization_id))) {
    return { ok: false, error: APPOINT_MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('assign_hospital_admin', {
    p_hospital: hospitalId,
    p_user: userId,
  })
  if (error) return { ok: false, error: APPOINT_MESSAGES.generic }

  await revalidateOrgManage(hospital.organization_id)
  return { ok: true, message: APPOINT_MESSAGES.hospitalAdminGranted }
}

/**
 * Revoke `userId`'s `hospital_admin` role on `hospitalId` (ADR 0051). Backed by
 * the `revoke_hospital_admin` DEFINER RPC (org_admin-gated, idempotent; the
 * hospital-tier audit row is emitted by the A3 DELETE trigger).
 */
export async function revokeHospitalAdmin(
  hospitalId: string,
  userId: string,
): Promise<MutationActionState> {
  if (!hospitalId || !userId) {
    return { ok: false, error: APPOINT_MESSAGES.generic }
  }
  const supabase = await createClient()
  const { data: hospital } = await supabase
    .from('hospitals')
    .select('organization_id')
    .eq('id', hospitalId)
    .maybeSingle<{ organization_id: string }>()
  if (!hospital || !(await authorizeOrgAdmin(hospital.organization_id))) {
    return { ok: false, error: APPOINT_MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('revoke_hospital_admin', {
    p_hospital: hospitalId,
    p_user: userId,
  })
  if (error) return { ok: false, error: APPOINT_MESSAGES.generic }

  await revalidateOrgManage(hospital.organization_id)
  return { ok: true, message: APPOINT_MESSAGES.hospitalAdminRevoked }
}

/**
 * Appoint `userId` as an `nsp_org_admin` of `orgId` (ADR 0051). Backed by the
 * `assign_nsp_org_admin` DEFINER RPC (org_admin-gated, no self-delegation,
 * idempotent). The role row exists in Phase A but is INERT — its behavior ships
 * in Phase B.
 */
export async function assignNspOrgAdmin(
  orgId: string,
  userId: string,
): Promise<MutationActionState> {
  if (!orgId || !userId) {
    return { ok: false, error: APPOINT_MESSAGES.generic }
  }
  const context = await getSessionContext()
  if (!context) return { ok: false, error: APPOINT_MESSAGES.forbidden }
  if (context.userId === userId) {
    return { ok: false, error: APPOINT_MESSAGES.self }
  }
  if (!(await authorizeOrgAdmin(orgId))) {
    return { ok: false, error: APPOINT_MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('assign_nsp_org_admin', {
    p_org: orgId,
    p_user: userId,
  })
  if (error) return { ok: false, error: APPOINT_MESSAGES.generic }

  await revalidateOrgManage(orgId)
  return { ok: true, message: APPOINT_MESSAGES.nspOrgAdminGranted }
}

/**
 * Revoke `userId`'s `nsp_org_admin` role in `orgId` (ADR 0051). Backed by the
 * `revoke_nsp_org_admin` DEFINER RPC (org_admin-gated, idempotent).
 */
export async function revokeNspOrgAdmin(
  orgId: string,
  userId: string,
): Promise<MutationActionState> {
  if (!orgId || !userId) {
    return { ok: false, error: APPOINT_MESSAGES.generic }
  }
  if (!(await authorizeOrgAdmin(orgId))) {
    return { ok: false, error: APPOINT_MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('revoke_nsp_org_admin', {
    p_org: orgId,
    p_user: userId,
  })
  if (error) return { ok: false, error: APPOINT_MESSAGES.generic }

  await revalidateOrgManage(orgId)
  return { ok: true, message: APPOINT_MESSAGES.nspOrgAdminRevoked }
}

/**
 * Revoke `userId`'s `nsp_coordinator` role on `hospitalId` (ADR 0052). Backed by the
 * `revoke_nsp_coordinator(p_hospital, p_user)` DEFINER RPC — gated
 * `is_nsp_org_admin_of(org_of_hospital(hospitalId))`, deletes ONLY the
 * `(org, user, 'nsp_coordinator', hospital)` row. Idempotent (a no-op if the user
 * isn't the hospital's coordinator). Note: this does NOT touch the user's
 * `pqs_members` enrollment — a coordinator who self-enrolled stays a PHI reader until
 * removed from that hospital's roster (separate concern; the coordinator role governs
 * the local-operator grant + curation rights).
 */
export async function revokeNspCoordinator(
  hospitalId: string,
  userId: string,
): Promise<MutationActionState> {
  if (!hospitalId || !userId) {
    return { ok: false, error: COORD_MESSAGES.generic }
  }

  const supabase = await createClient()
  const { data: hospital } = await supabase
    .from('hospitals')
    .select('organization_id')
    .eq('id', hospitalId)
    .maybeSingle<{ organization_id: string }>()
  if (!hospital || !(await authorizeNspOrgAdmin(hospital.organization_id))) {
    return { ok: false, error: COORD_MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('revoke_nsp_coordinator', {
    p_hospital: hospitalId,
    p_user: userId,
  })
  if (error) return { ok: false, error: COORD_MESSAGES.generic }

  const context = await getSessionContext()
  const orgSlug = context?.nspOrgAdminOf.find(
    (o) => o.organization.id === hospital.organization_id,
  )?.organization.slug
  if (orgSlug) revalidatePath(orgHref(orgSlug, 'manage'))
  return { ok: true, message: COORD_MESSAGES.revoked }
}
