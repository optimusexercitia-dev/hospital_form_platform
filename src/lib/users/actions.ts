'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { isEmailVerificationEnabled } from '@/lib/config/auth'

/**
 * User Registration & Identity Management — server actions.
 *
 * All writes run on the SERVICE-ROLE client (`createAdminClient()`), because
 * registering a user (invite + cross-user profile/credential/committee write) and
 * managing another user's lifecycle inherently require bypassing RLS. Each action
 * therefore re-verifies, server-side and ORG-SCOPED, that the caller is an
 * `org_admin` of the target's `home_organization_id` BEFORE any write — the
 * service-role path has no RLS backstop, so this TS check is the only authority
 * (mirrors `@/lib/members/actions`). The platform_admin (`isAdmin`) is NOT
 * authorized here — it is walled off from tenant data (ADR 0041).
 *
 * All user-facing strings are pt-BR; raw Supabase/Postgres errors NEVER reach the
 * UI (CLAUDE.md §8). Mutations are audit-logged by the DB triggers (Rule 11).
 *
 * Signatures + input types are STABLE (frontend built against them).
 */

export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

// ---------------------------------------------------------------------------
// Input DTOs — the shapes the frontend forms build and submit.
// ---------------------------------------------------------------------------

/** A single professional-credential row as entered in the register/edit form. */
export interface CredentialInput {
  issuingCountry: string
  issuingState: string
  issuingAuthority: string
  registrationNumber: string
  /** Optional expiry. */
  expiresOn?: string | null
}

/** One committee + role assignment (0..N per user; plan Q8). */
export interface CommitteeAssignmentInput {
  commissionId: string
  role: 'staff' | 'staff_admin'
}

/**
 * Register-user payload. Required: `fullName`, `email`, `professionalCategoryId`
 * (plan Q10). Everything else optional. `homeOrganizationId` anchors the user and
 * scopes the caller's authorization. The whole write (invite + profile +
 * credentials + committees) is ATOMIC in one action; an email collision BLOCKS
 * with a clear pt-BR error (plan Q11); a failed write is never swallowed
 * ([[phi-write-atomic-with-create]]).
 */
export interface RegisterUserInput {
  homeOrganizationId: string
  fullName: string
  email: string
  professionalCategoryId: string
  homeHospitalId?: string | null
  hospitalEmployeeId?: string | null
  credentials?: CredentialInput[]
  committees?: CommitteeAssignmentInput[]
  /**
   * Initial password set by the org admin at registration. REQUIRED only when
   * email verification is OFF (the default admin-sets-initial-password path;
   * see `@/lib/config/auth`) — the account is then created ACTIVE and the
   * credential is relayed to the user out-of-band. IGNORED when email
   * verification is ON (the user sets their own password via the invite link).
   * Minimum length 8.
   */
  password?: string
}

/** Editable profile fields on the per-user page (identity email is immutable here). */
export interface UpdateUserProfileInput {
  userId: string
  fullName: string
  professionalCategoryId: string | null
  homeHospitalId?: string | null
  hospitalEmployeeId?: string | null
}

/** Create-or-update a single credential. `id` present ⇒ update (which CLEARS `verified_at`). */
export interface UpsertCredentialInput extends CredentialInput {
  userId: string
  /** Present when editing an existing credential; absent when adding a new one. */
  id?: string
}

// ---------------------------------------------------------------------------
// pt-BR copy + shared helpers.
// ---------------------------------------------------------------------------

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  nameRequired: 'Informe o nome completo.',
  emailRequired: 'Informe o e-mail.',
  emailInvalid: 'Informe um e-mail válido.',
  categoryRequired: 'Selecione a categoria profissional.',
  passwordRequired: 'Informe a senha inicial.',
  passwordTooShort: 'A senha deve ter pelo menos 8 caracteres.',
  emailCollision: 'Este e-mail já está cadastrado na plataforma.',
  credentialCollision:
    'Este registro profissional já está cadastrado (órgão, UF e número).',
  missingUser: 'Usuário não encontrado.',
  missingCommission: 'Comissão não encontrada.',
  missingHospital: 'Selecione o hospital do novo usuário.',
  // ON (email-verification) path: the user activates via an emailed link.
  registeredInvited:
    'Pessoa registrada. Um e-mail foi enviado para ativar a conta.',
  // OFF (default) path: the account is created ACTIVE with the admin-set initial
  // password, relayed to the user out-of-band.
  registeredActive:
    'Pessoa registrada e ativada. Informe a senha inicial ao usuário.',
  profileUpdated: 'Dados atualizados com sucesso.',
  credentialSaved: 'Registro profissional salvo.',
  credentialRemoved: 'Registro profissional removido.',
  committeeAssigned: 'Comissão atribuída com sucesso.',
  committeeRemoved: 'Comissão removida com sucesso.',
  deactivated: 'Conta desativada.',
  reactivated: 'Conta reativada.',
  suspended: 'Conta suspensa.',
  inviteResent: 'Convite reenviado.',
} as const

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const USUARIOS_PATH = '/o/[org]/manage/usuarios'

async function appOrigin(): Promise<string> {
  const h = await headers()
  const origin = h.get('origin')
  if (origin) return origin
  const host = h.get('host') ?? '127.0.0.1:3000'
  const proto = h.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

/**
 * Authorize an org-scoped user-management action: the caller must be an
 * `org_admin` of `orgId`. Returns false (deny) otherwise. The platform_admin is
 * DELIBERATELY not admitted (vendor isolation; ADR 0041). This is the ONLY
 * authority on the service-role path — the client is never trusted.
 */
async function authorizeOrgOps(orgId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isInactive) return false
  return context.orgAdminOf.some((o) => o.organization.id === orgId)
}

/**
 * Authorize a HOSPITAL-scoped user-management action (ADR 0051 Decision 7): the
 * caller must be a `hospital_admin` of `hospitalId`. Returns false otherwise.
 * Amendment 11: the service-role path has NO RLS backstop, so this TS check is
 * the only authority — the client is never trusted.
 */
async function authorizeHospitalOps(hospitalId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isInactive) return false
  return context.hospitalAdminOf.some((h) => h.hospital.id === hospitalId)
}

/**
 * Whether the caller (as a `hospital_admin`) may manage `userId` — i.e. the user
 * belongs to a hospital the caller administers. "Belongs to a hospital" =
 * `home_hospital_id` matches, OR the user is a member of any commission under
 * that hospital (Decision 7 / Q2 scope: home hospital + commission membership).
 * All reads run on the service-role client (a foreign caller could not SELECT
 * these rows under RLS, so the DB is not the authority here — this TS scope IS).
 */
async function callerHospitalAdminMayManageUser(
  userId: string,
): Promise<boolean> {
  const context = await getSessionContext()
  if (!context || context.isInactive) return false
  const adminedHospitalIds = new Set(
    context.hospitalAdminOf.map((h) => h.hospital.id),
  )
  if (adminedHospitalIds.size === 0) return false

  const admin = createAdminClient()

  // (a) home_hospital_id match.
  const { data: profile } = await admin
    .from('profiles')
    .select('home_hospital_id')
    .eq('id', userId)
    .maybeSingle()
  if (profile?.home_hospital_id && adminedHospitalIds.has(profile.home_hospital_id)) {
    return true
  }

  // (b) membership in any commission under an admined hospital.
  const { data: memberships } = await admin
    .from('commission_members')
    .select('commissions:commission_id(hospital_id)')
    .eq('user_id', userId)
    .returns<{ commissions: { hospital_id: string } | null }[]>()
  return (memberships ?? []).some(
    (m) => m.commissions && adminedHospitalIds.has(m.commissions.hospital_id),
  )
}

/**
 * Resolve the target user's home org, then authorize the caller — as an
 * `org_admin` of that org OR (ADR 0051) as a `hospital_admin` who may manage the
 * user (its home hospital / a commission of that hospital). Used by the per-user
 * lifecycle/credential/committee actions, which take a `userId` rather than an
 * org id. Reads the profile on the service-role client so a foreign caller (who
 * could not SELECT the row) still gets a correct deny.
 */
async function authorizeForUser(
  userId: string,
): Promise<{ ok: boolean; orgId?: string }> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('home_organization_id')
    .eq('id', userId)
    .maybeSingle()
  const orgId = data?.home_organization_id ?? undefined
  if (!orgId) return { ok: false }
  if (await authorizeOrgOps(orgId)) return { ok: true, orgId }
  // ADR 0051 hospital arm: a hospital_admin may manage its own hospital's users.
  if (await callerHospitalAdminMayManageUser(userId)) return { ok: true, orgId }
  return { ok: false, orgId }
}

/**
 * Resolve the target commission's org + hospital, then authorize the caller as an
 * `org_admin` of the org OR (ADR 0051) a `hospital_admin` of the commission's
 * hospital — the TS mirror of `is_commission_admin_of`. A hospital_admin may thus
 * assign staff only to commissions of ITS OWN hospital; a sibling hospital's
 * commission resolves to a different hospital_id and denies.
 */
async function authorizeForCommission(
  commissionId: string,
): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('commissions')
    .select('organization_id, hospital_id')
    .eq('id', commissionId)
    .maybeSingle()
  const orgId = data?.organization_id ?? undefined
  const hospitalId = data?.hospital_id ?? undefined
  if (!orgId) return false
  if (await authorizeOrgOps(orgId)) return true
  if (hospitalId && (await authorizeHospitalOps(hospitalId))) return true
  return false
}

function revalidateDirectory(): void {
  revalidatePath(USUARIOS_PATH, 'page')
  revalidatePath(`${USUARIOS_PATH}/[userId]`, 'page')
}

// ---------------------------------------------------------------------------
// Actions.
// ---------------------------------------------------------------------------

/**
 * Register a new user, then write the profile fields + credential rows +
 * committee memberships — all on the service-role client. Blocks an email
 * collision with a clear pt-BR error (never absorbs/overwrites another
 * identity). A write failure after user creation is surfaced, never swallowed.
 *
 * The user-creation step branches on the email-verification flag
 * (`isEmailVerificationEnabled`, default OFF):
 *   - OFF — `createUser` with the admin-supplied initial `password` and
 *     `email_confirm: true`, so the account is ACTIVE immediately (the denorm
 *     trigger propagates email_confirmed_at → status `active`).
 *   - ON — the historical `inviteUserByEmail` path (user sets their own password
 *     via the emailed link).
 * Both paths seed `full_name` + `home_organization_id` in user_metadata, which
 * `handle_new_user` reads identically to anchor the profile at creation.
 */
export async function registerUser(
  input: RegisterUserInput,
): Promise<ActionState> {
  const fullName = input.fullName.trim()
  const email = input.email.trim().toLowerCase()

  // Authorize the caller as EITHER an org_admin of the target org OR (ADR 0051
  // Decision 7) a hospital_admin onboarding into ITS OWN hospital. Amendment 11:
  // the service-role path has no RLS backstop — this TS gate is the sole
  // authority, and the client is never trusted for the home-hospital anchor.
  const context = await getSessionContext()
  if (!context || context.isInactive) {
    return { ok: false, error: MESSAGES.forbidden }
  }
  const isOrgAdminCaller = context.orgAdminOf.some(
    (o) => o.organization.id === input.homeOrganizationId,
  )

  // effectiveHomeHospitalId is what we WILL write. For an org_admin it is the
  // (client-supplied) input value; for a hospital_admin it is HARD-SET server-side
  // to the caller's administered hospital — never trusted from formData.
  let effectiveHomeHospitalId: string | null = input.homeHospitalId ?? null

  if (!isOrgAdminCaller) {
    // Hospital-admin path. The caller must administer a hospital IN the target org.
    const orgHospitals = context.hospitalAdminOf.filter(
      (h) => h.organization.id === input.homeOrganizationId,
    )
    if (orgHospitals.length === 0) {
      return { ok: false, error: MESSAGES.forbidden }
    }
    // Resolve the ONE target hospital. If the client supplied a home hospital, it
    // MUST be one the caller administers (reject a different hospital — amendment
    // 11). If omitted, only a single-hospital admin is unambiguous.
    if (input.homeHospitalId) {
      const administersRequested = orgHospitals.some(
        (h) => h.hospital.id === input.homeHospitalId,
      )
      if (!administersRequested) {
        return { ok: false, error: MESSAGES.forbidden }
      }
      effectiveHomeHospitalId = input.homeHospitalId
    } else if (orgHospitals.length === 1) {
      effectiveHomeHospitalId = orgHospitals[0].hospital.id
    } else {
      // Ambiguous: a multi-hospital admin must name which hospital to onboard into.
      return { ok: false, fieldErrors: { homeHospitalId: MESSAGES.missingHospital } }
    }
    // A hospital_admin may only seed committees of ITS OWN hospital (checked below,
    // per committee). It cannot grant org roles — this path never writes
    // organization_members.
  }

  const emailVerification = isEmailVerificationEnabled()

  const fieldErrors: Record<string, string> = {}
  if (!fullName) fieldErrors.fullName = MESSAGES.nameRequired
  if (!email) fieldErrors.email = MESSAGES.emailRequired
  else if (!EMAIL_PATTERN.test(email)) fieldErrors.email = MESSAGES.emailInvalid
  if (!input.professionalCategoryId)
    fieldErrors.professionalCategoryId = MESSAGES.categoryRequired
  // When email verification is OFF, the admin sets the initial password now.
  if (!emailVerification) {
    if (!input.password) fieldErrors.password = MESSAGES.passwordRequired
    else if (input.password.length < 8)
      fieldErrors.password = MESSAGES.passwordTooShort
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors }
  }

  const admin = createAdminClient()

  // Email is a global identity — a collision must BLOCK (never overwrite). Check
  // the denormalized profiles.email (citext, exact case-insensitive match).
  const { data: existing, error: lookupError } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (lookupError) {
    return { ok: false, error: MESSAGES.generic }
  }
  if (existing) {
    return { ok: false, fieldErrors: { email: MESSAGES.emailCollision } }
  }

  // metadata seeds full_name + the org anchor (service-role-set-once;
  // handle_new_user reads both keys identically for createUser and
  // inviteUserByEmail — NOT an authz input). A duplicate-email race surfaces
  // from either admin call; treat "already"/"registered" as a collision.
  const metadata = {
    full_name: fullName,
    home_organization_id: input.homeOrganizationId,
  }

  let userId: string
  if (emailVerification) {
    // ON: invite mail links to /auth/confirm → /convite (the activation flow;
    // the user sets their own password there).
    const origin = await appOrigin()
    const { data: invite, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/auth/confirm`,
        data: metadata,
      })
    if (inviteError || !invite?.user) {
      const msg = inviteError?.message?.toLowerCase() ?? ''
      if (msg.includes('already') || msg.includes('registered')) {
        return { ok: false, fieldErrors: { email: MESSAGES.emailCollision } }
      }
      return { ok: false, error: MESSAGES.generic }
    }
    userId = invite.user.id
  } else {
    // OFF (default): create the user ACTIVE with the admin-set initial password.
    // email_confirm:true stamps auth.users.email_confirmed_at, which the denorm
    // trigger propagates to profiles → status derives to `active`.
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        // Validated non-empty (min 8) above when the flag is OFF.
        password: input.password!,
        email_confirm: true,
        user_metadata: metadata,
      })
    if (createError || !created?.user) {
      const msg = createError?.message?.toLowerCase() ?? ''
      if (msg.includes('already') || msg.includes('registered')) {
        return { ok: false, fieldErrors: { email: MESSAGES.emailCollision } }
      }
      return { ok: false, error: MESSAGES.generic }
    }
    userId = created.user.id
  }

  // Patch the profile fields the trigger did not set (category / hospital /
  // matrícula). full_name + home_organization_id already landed via metadata.
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name: fullName,
      professional_category_id: input.professionalCategoryId,
      // effectiveHomeHospitalId: for a hospital_admin this is the SERVER-SET
      // administered hospital (never the raw formData value); for an org_admin it
      // is the client-supplied input (amendment 11).
      home_hospital_id: effectiveHomeHospitalId,
      hospital_employee_id: input.hospitalEmployeeId ?? null,
      // Flag-OFF path only: the admin set the initial password, so force the user
      // to rotate it at /primeiro-acesso before using the app (ADR 0049). The
      // flag-ON invite path leaves it false (the user sets their own at /convite).
      must_change_password: !emailVerification,
    })
    .eq('id', userId)
  if (profileError) {
    // Do NOT swallow: the invite happened, but the profile write failed. Surface
    // it so the operator retries (the pending profile exists and is anchored).
    return { ok: false, error: MESSAGES.generic }
  }

  // Credentials (optional). A duplicate 4-tuple (23505) is reported, not hidden.
  const credentials = (input.credentials ?? []).filter(
    (c) => c.registrationNumber.trim() !== '',
  )
  if (credentials.length > 0) {
    const { error: credError } = await admin
      .from('professional_credentials')
      .insert(
        credentials.map((c) => ({
          user_id: userId,
          issuing_country: c.issuingCountry.trim(),
          issuing_state: c.issuingState.trim(),
          issuing_authority: c.issuingAuthority.trim(),
          registration_number: c.registrationNumber.trim(),
          expires_on: c.expiresOn ?? null,
        })),
      )
    if (credError) {
      return {
        ok: false,
        error:
          credError.code === '23505'
            ? MESSAGES.credentialCollision
            : MESSAGES.generic,
      }
    }
  }

  // Committee memberships (optional). Idempotent per (commission, user).
  const committees = input.committees ?? []
  if (committees.length > 0) {
    // A hospital_admin may only seed committees of ITS OWN hospital (amendment
    // 11 — a sibling hospital's / other org's commission is rejected). An
    // org_admin may seed any commission in its org (existing behavior). Verify
    // every requested commission's hospital server-side against the admined set.
    if (!isOrgAdminCaller) {
      const adminedHospitalIds = new Set(
        context.hospitalAdminOf.map((h) => h.hospital.id),
      )
      const { data: commRows } = await admin
        .from('commissions')
        .select('id, hospital_id')
        .in(
          'id',
          committees.map((c) => c.commissionId),
        )
        .returns<{ id: string; hospital_id: string }[]>()
      const hospitalByCommission = new Map(
        (commRows ?? []).map((r) => [r.id, r.hospital_id]),
      )
      const allWithinHospital = committees.every((c) => {
        const h = hospitalByCommission.get(c.commissionId)
        return h !== undefined && adminedHospitalIds.has(h)
      })
      if (!allWithinHospital) {
        return { ok: false, error: MESSAGES.forbidden }
      }
    }

    const { error: memberError } = await admin
      .from('commission_members')
      .upsert(
        committees.map((c) => ({
          commission_id: c.commissionId,
          user_id: userId,
          role: c.role,
        })),
        { onConflict: 'commission_id,user_id' },
      )
    if (memberError) {
      return { ok: false, error: MESSAGES.generic }
    }
  }

  revalidateDirectory()
  return {
    ok: true,
    error: emailVerification
      ? MESSAGES.registeredInvited
      : MESSAGES.registeredActive,
  }
}

/** Edit an existing user's profile fields (name / category / hospital / matrícula). */
export async function updateUserProfile(
  input: UpdateUserProfileInput,
): Promise<ActionState> {
  const auth = await authorizeForUser(input.userId)
  if (!auth.ok) return { ok: false, error: MESSAGES.forbidden }

  const fullName = input.fullName.trim()
  if (!fullName) {
    return { ok: false, fieldErrors: { fullName: MESSAGES.nameRequired } }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      full_name: fullName,
      professional_category_id: input.professionalCategoryId,
      home_hospital_id: input.homeHospitalId ?? null,
      hospital_employee_id: input.hospitalEmployeeId ?? null,
    })
    .eq('id', input.userId)
  if (error) return { ok: false, error: MESSAGES.generic }

  revalidateDirectory()
  return { ok: true, error: MESSAGES.profileUpdated }
}

/** Add or edit a professional credential. Editing ALWAYS clears `verified_at`. */
export async function upsertCredential(
  input: UpsertCredentialInput,
): Promise<ActionState> {
  const auth = await authorizeForUser(input.userId)
  if (!auth.ok) return { ok: false, error: MESSAGES.forbidden }

  const row = {
    user_id: input.userId,
    issuing_country: input.issuingCountry.trim(),
    issuing_state: input.issuingState.trim(),
    issuing_authority: input.issuingAuthority.trim(),
    registration_number: input.registrationNumber.trim(),
    expires_on: input.expiresOn ?? null,
  }
  if (!row.registration_number) {
    return { ok: false, error: MESSAGES.generic }
  }

  const admin = createAdminClient()
  if (input.id) {
    // Editing clears verified_at (tamper-visible) + stamps updated_at.
    const { error } = await admin
      .from('professional_credentials')
      .update({ ...row, verified_at: null, updated_at: new Date().toISOString() })
      .eq('id', input.id)
      .eq('user_id', input.userId)
    if (error) {
      return {
        ok: false,
        error:
          error.code === '23505'
            ? MESSAGES.credentialCollision
            : MESSAGES.generic,
      }
    }
  } else {
    const { error } = await admin
      .from('professional_credentials')
      .insert(row)
    if (error) {
      return {
        ok: false,
        error:
          error.code === '23505'
            ? MESSAGES.credentialCollision
            : MESSAGES.generic,
      }
    }
  }

  revalidateDirectory()
  return { ok: true, error: MESSAGES.credentialSaved }
}

/** Remove a professional credential. */
export async function removeCredential(
  credentialId: string,
): Promise<ActionState> {
  const admin = createAdminClient()
  const { data: cred } = await admin
    .from('professional_credentials')
    .select('user_id')
    .eq('id', credentialId)
    .maybeSingle()
  if (!cred) return { ok: false, error: MESSAGES.generic }

  const auth = await authorizeForUser(cred.user_id)
  if (!auth.ok) return { ok: false, error: MESSAGES.forbidden }

  const { error } = await admin
    .from('professional_credentials')
    .delete()
    .eq('id', credentialId)
  if (error) return { ok: false, error: MESSAGES.generic }

  revalidateDirectory()
  return { ok: true, error: MESSAGES.credentialRemoved }
}

/** Assign a committee + role to a user (idempotent on the membership PK; updates role). */
export async function assignCommitteeRole(
  userId: string,
  input: CommitteeAssignmentInput,
): Promise<ActionState> {
  // The caller must administer BOTH the user's org AND the target commission's
  // org (they are the same org in practice; check both for safety).
  const userAuth = await authorizeForUser(userId)
  if (!userAuth.ok) return { ok: false, error: MESSAGES.forbidden }
  if (!(await authorizeForCommission(input.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('commission_members').upsert(
    { commission_id: input.commissionId, user_id: userId, role: input.role },
    { onConflict: 'commission_id,user_id' },
  )
  if (error) return { ok: false, error: MESSAGES.generic }

  revalidateDirectory()
  return { ok: true, error: MESSAGES.committeeAssigned }
}

/** Remove a user from a committee. */
export async function removeCommittee(
  userId: string,
  commissionId: string,
): Promise<ActionState> {
  const userAuth = await authorizeForUser(userId)
  if (!userAuth.ok) return { ok: false, error: MESSAGES.forbidden }

  const admin = createAdminClient()
  const { error } = await admin
    .from('commission_members')
    .delete()
    .eq('commission_id', commissionId)
    .eq('user_id', userId)
  if (error) return { ok: false, error: MESSAGES.generic }

  revalidateDirectory()
  return { ok: true, error: MESSAGES.committeeRemoved }
}

/** Deactivate a user (master switch off). Next-request logout via the gate. */
export async function deactivateUser(userId: string): Promise<ActionState> {
  const auth = await authorizeForUser(userId)
  if (!auth.ok) return { ok: false, error: MESSAGES.forbidden }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ is_active: false })
    .eq('id', userId)
  if (error) return { ok: false, error: MESSAGES.generic }

  revalidateDirectory()
  return { ok: true, error: MESSAGES.deactivated }
}

/** Reactivate a deactivated user (is_active=true; also clears any residual suspension). */
export async function reactivateUser(userId: string): Promise<ActionState> {
  const auth = await authorizeForUser(userId)
  if (!auth.ok) return { ok: false, error: MESSAGES.forbidden }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ is_active: true, suspended_until: null })
    .eq('id', userId)
  if (error) return { ok: false, error: MESSAGES.generic }

  revalidateDirectory()
  return { ok: true, error: MESSAGES.reactivated }
}

/**
 * Suspend a user until `suspendedUntil` (temporary, auto-reinstating). `null`
 * means an indefinite suspension. A past instant reads as active again
 * immediately (the derivation handles it) — the DB stores exactly what is given.
 */
export async function suspendUser(
  userId: string,
  suspendedUntil: string | null,
): Promise<ActionState> {
  const auth = await authorizeForUser(userId)
  if (!auth.ok) return { ok: false, error: MESSAGES.forbidden }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ suspended_until: suspendedUntil })
    .eq('id', userId)
  if (error) return { ok: false, error: MESSAGES.generic }

  revalidateDirectory()
  return { ok: true, error: MESSAGES.suspended }
}

/** Resend the invite/activation email for a still-`pending` user (expired-link recovery). */
export async function resendInvite(userId: string): Promise<ActionState> {
  const auth = await authorizeForUser(userId)
  if (!auth.ok) return { ok: false, error: MESSAGES.forbidden }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle()
  const email = profile?.email
  if (!email) return { ok: false, error: MESSAGES.missingUser }

  const origin = await appOrigin()
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/confirm`,
  })
  if (error) return { ok: false, error: MESSAGES.generic }

  return { ok: true, error: MESSAGES.inviteResent }
}
