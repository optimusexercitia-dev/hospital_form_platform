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
  /**
   * The hospital to EMPLOY the person at. AFF W1 (ADR 0097 D1/D3): this no longer
   * writes a `profiles` column — it creates a `hospital_affiliations` row. The field
   * name is unchanged so the register form keeps compiling; W3/T3.1 renames it as
   * part of the identifier-first flow.
   */
  homeHospitalId?: string | null
  /** Matrícula. Rides on the affiliation created above; ignored without a hospital. */
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
  /**
   * AFF W1 (ADR 0097 D1/D3/D4): a non-null value ENSURES an active affiliation at that
   * hospital (creating it, or refreshing its matrícula). A NULL value changes nothing —
   * ENDING an affiliation is a governed act with its own refusals (D5: refused while
   * the person holds active memberships of any tier under the hospital) and belongs to
   * the W2 `end_affiliation` door, not to a profile edit that happens to omit a field.
   */
  homeHospitalId?: string | null
  /** Matrícula for the affiliation named above; ignored when it is null. */
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
 * belongs to a hospital the caller administers. "Belongs to a hospital" = an ACTIVE
 * `hospital_affiliations` row at that hospital, OR membership of any commission under
 * it (Decision 7 / Q2 scope, restated on AFF W1's substrate: employment + commission
 * membership). All reads run on the service-role client (a foreign caller could not
 * SELECT these rows under RLS, so the DB is not the authority here — this TS scope IS).
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

  // (a) an ACTIVE affiliation to an administered hospital (ADR 0097 D1/D3 — this arm
  // read profiles.home_hospital_id until that column was dropped).
  const { data: affiliations } = await admin
    .from('hospital_affiliations')
    .select('hospital_id')
    .eq('principal_id', userId)
    .is('ended_on', null)
    .returns<{ hospital_id: string }[]>()
  if ((affiliations ?? []).some((a) => adminedHospitalIds.has(a.hospital_id))) {
    return true
  }

  // (b) membership in any commission under an admined hospital. MEM: commission-scope
  // rows of `memberships` (commission_id set); resolve the hospital via the FK.
  const { data: memberships } = await admin
    .from('memberships')
    .select('commissions:commission_id(hospital_id)')
    .eq('principal_id', userId)
    .not('commission_id', 'is', null)
    .returns<{ commissions: { hospital_id: string } | null }[]>()
  return (memberships ?? []).some(
    (m) => m.commissions && adminedHospitalIds.has(m.commissions.hospital_id),
  )
}

/**
 * Ensure an ACTIVE `hospital_affiliations` row for `userId` at `hospitalId`, carrying
 * `employeeId` (ADR 0097 D1/D3).
 *
 * ⚠ THROUGH THE DOOR, NOT RAW DML (ADR 0098 W2.1). This ran raw `.insert()` in W1, and
 * that was the hole: `registerUser` runs on the SERVICE-ROLE client with no
 * `auth.uid()`, so an `auth.uid()`-only door would have been bypassed on the path that
 * creates MOST affiliations, and D13's tenant check would never have run there. The
 * `_for` twin takes the actor explicitly and re-derives its authority in PostgreSQL —
 * the same shape `grant_role_for` uses, and now enforced by the same repo gate
 * (`npm run lint:memberships-door`).
 *
 * Idempotent by (person, hospital) over the ACTIVE row; the kernel refreshes the
 * matrícula rather than duplicating. Never ENDS anything — see
 * {@link UpdateUserProfileInput.homeHospitalId}.
 *
 * `organizationId` is no longer passed: the kernel derives it from the hospital and
 * hard-fails when the person is anchored elsewhere, which is stricter than any value
 * this layer could supply.
 *
 * @returns true on success; false on an error the caller must surface.
 */
async function ensureActiveAffiliation(params: {
  userId: string
  hospitalId: string
  employeeId: string | null
  actorId: string
}): Promise<boolean> {
  const admin = createAdminClient()
  const { error } = await admin.rpc('affiliate_person_for', {
    p_actor: params.actorId,
    p_user: params.userId,
    p_hospital: params.hospitalId,
    p_employee_id: params.employeeId ?? undefined,
  })
  return !error
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

  // Patch the profile fields the trigger did not set (category). full_name +
  // home_organization_id already landed via metadata.
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name: fullName,
      professional_category_id: input.professionalCategoryId,
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

  // Employment (ADR 0097 D1/D3) — the row that used to be profiles.home_hospital_id +
  // profiles.hospital_employee_id. effectiveHomeHospitalId: for a hospital_admin this
  // is the SERVER-SET administered hospital (never the raw formData value); for an
  // org_admin it is the client-supplied input (amendment 11). A registration with no
  // hospital creates no employment row — the person exists, unaffiliated, which is a
  // legitimate state (the `novato.pendente` case D2 exists to keep visible).
  if (effectiveHomeHospitalId) {
    const affiliated = await ensureActiveAffiliation({
      userId,
      hospitalId: effectiveHomeHospitalId,
      employeeId: input.hospitalEmployeeId?.trim() || null,
      actorId: context.userId,
    })
    if (!affiliated) {
      // Same reasoning as the profile write above: the account exists, so a silent
      // failure would leave a person nobody's roster shows.
      return { ok: false, error: MESSAGES.generic }
    }
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

    // MEM (ADR 0075): service-role writer keeps a DIRECT insert into `memberships`
    // (RLS-exempt, TS-authorized above; the door needs an auth.uid() this admin
    // client lacks). Audited by trg_audit_memberships.
    //
    // ADR 0094 W3/T3.3 — committee grants go through the DOOR. This is a
    // service-role path (the admin client provisions the account and holds no
    // auth.uid()), so it uses `grant_role_for`, naming the actor explicitly. The
    // actor's authority is then re-derived from the live database inside the kernel:
    // the TypeScript checks above are no longer the only thing standing between a
    // caller and a membership row.
    //
    // The kernel also subsumes what W1 had to do by hand here. `registerUser`
    // resolves EXISTING users (`resolveOrInviteUser`), so the target may already hold
    // the OTHER role in a selected commission; the T1.0 replacement semantic handles
    // that in SQL, so the explicit "clear superseded rows" pass this action carried is
    // gone. One call per committee, because authority is per-commission.
    const actorId = (await getSessionContext())?.userId
    if (!actorId) {
      return { ok: false, error: MESSAGES.forbidden }
    }
    for (const c of committees) {
      const { error: memberError } = await admin.rpc('grant_role_for', {
        p_actor: actorId,
        p_scope_type: 'commission',
        p_scope_id: c.commissionId,
        p_role: c.role,
        p_user: userId,
      })
      if (memberError) {
        return { ok: false, error: MESSAGES.generic }
      }
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

  // Home-hospital validation (amendment 11, mirrors registerUser). For an
  // org_admin of the target's org the client value is trusted (they legitimately
  // choose any hospital in scope). For a hospital_admin caller the new
  // home_hospital_id MUST be one the caller administers — never trust the client
  // value on the service-role path (no RLS backstop).
  const effectiveHomeHospitalId: string | null = input.homeHospitalId ?? null
  const context = await getSessionContext()
  if (!context || context.isInactive) {
    return { ok: false, error: MESSAGES.forbidden }
  }
  const isOrgAdminCaller =
    auth.orgId !== undefined &&
    context.orgAdminOf.some((o) => o.organization.id === auth.orgId)
  if (!isOrgAdminCaller && effectiveHomeHospitalId !== null) {
    const administersRequested = context.hospitalAdminOf.some(
      (h) => h.hospital.id === effectiveHomeHospitalId,
    )
    if (!administersRequested) {
      return { ok: false, error: MESSAGES.forbidden }
    }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      full_name: fullName,
      professional_category_id: input.professionalCategoryId,
    })
    .eq('id', input.userId)
  if (error) return { ok: false, error: MESSAGES.generic }

  // Employment, when one was named (ADR 0097 D1/D3). A null hospital does NOT end an
  // affiliation — see UpdateUserProfileInput.homeHospitalId. The org is no longer
  // passed: the door derives it from the hospital and hard-fails on a tenant mismatch.
  if (effectiveHomeHospitalId) {
    const affiliated = await ensureActiveAffiliation({
      userId: input.userId,
      hospitalId: effectiveHomeHospitalId,
      employeeId: input.hospitalEmployeeId?.trim() || null,
      actorId: context.userId,
    })
    if (!affiliated) return { ok: false, error: MESSAGES.generic }
  }

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
  // MEM (ADR 0075): service-role writer; direct `memberships` write (RLS-exempt,
  // TS-authorized). The memberships grant-unique key INCLUDES role, so a plain upsert
  // could not CHANGE a user's role in a commission (a different role = a different
  // row) and would leave a stale row.
  //
  // ADR 0094 W3/T3.3 — through the DOOR, service path (`grant_role_for`), actor
  // named explicitly and re-validated in PostgreSQL.
  //
  // This writer previously did delete-then-insert to express "one role per user per
  // commission, role-updating". The kernel now owns that semantic (T1.0), and owning
  // it in one place fixed two things this hand-rolled version got wrong:
  //   * delete+insert DESTROYED the member's per-commission title (ADR 0051) —
  //     `title_id` lives on the membership row, so it was silently dropped on every
  //     role change made from the user directory;
  //   * it emitted `membership.revoked` + `membership.granted` for what is one act,
  //     where the trigger's UPDATE arm emits a single `membership.role_changed`
  //     naming both the old and the new role.
  const actorId = (await getSessionContext())?.userId
  if (!actorId) return { ok: false, error: MESSAGES.forbidden }
  const { error } = await admin.rpc('grant_role_for', {
    p_actor: actorId,
    p_scope_type: 'commission',
    p_scope_id: input.commissionId,
    p_role: input.role,
    p_user: userId,
  })
  if (error) return { ok: false, error: MESSAGES.generic }

  revalidateDirectory()
  return { ok: true, error: MESSAGES.committeeAssigned }
}

/** Remove a user from a committee. */
export async function removeCommittee(
  userId: string,
  commissionId: string,
): Promise<ActionState> {
  // The caller must administer BOTH the user's org AND the target commission's
  // org/hospital — mirror assignCommitteeRole exactly. Without the commission
  // check, a hospital_admin acting on a user who is a member of both an admined
  // commission AND a sibling (same-org, other-hospital) commission could delete
  // the sibling membership — a write to a commission the caller doesn't
  // administer, on the service-role client with no RLS backstop.
  const userAuth = await authorizeForUser(userId)
  if (!userAuth.ok) return { ok: false, error: MESSAGES.forbidden }
  if (!(await authorizeForCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const admin = createAdminClient()
  // ADR 0094 W3/T3.3 — through the DOOR, service path (`revoke_role_for`).
  //
  // `revoke_role` takes the role explicitly (it revokes an exact grant, never
  // "whatever they hold"), while this action is "remove them from the committee".
  // Under the W1 invariant those coincide: there is AT MOST ONE commission row per
  // principal, so reading it and revoking exactly that role removes precisely the
  // membership this action means. The read is not DML, so the raw-DML repo gate is
  // satisfied. A missing row is success — the user is not on the committee, which is
  // the requested end state.
  const actorId = (await getSessionContext())?.userId
  if (!actorId) return { ok: false, error: MESSAGES.forbidden }
  const { data: held } = await admin
    .from('memberships')
    .select('role')
    .eq('commission_id', commissionId)
    .eq('principal_id', userId)
    .maybeSingle()
  if (held) {
    const { error } = await admin.rpc('revoke_role_for', {
      p_actor: actorId,
      p_scope_type: 'commission',
      p_scope_id: commissionId,
      p_role: held.role,
      p_user: userId,
    })
    if (error) return { ok: false, error: MESSAGES.generic }
  }

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
