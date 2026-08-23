'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { personScopeAllows, type PersonScopeCapability } from './person-scope'
// ⛔ `resolvePersonFootprint` and `authorizeOrgOps` live in `person-footprint.ts`, NOT here,
// and the reason is structural: this file is `'use server'`, so every export of it becomes a
// callable endpoint. Exporting the resolver to share it with the B6 detail read would have
// published a person's hospital footprint as an RPC. Keep them there; import, never copy.
import { authorizeOrgOps, resolvePersonFootprint } from './person-footprint'
import { isEmailVerificationEnabled } from '@/lib/config/auth'
import { isValidCpf, normalizeCpf } from '@/lib/users/cpf'

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

/**
 * `registerUser`'s state. Carries the created person's id so the wizard can redirect to
 * their new profile (ADR 0133 F3) instead of guessing the route or re-searching for them.
 *
 * A dedicated extension rather than a field on `ActionState`: eight other actions in this
 * module return `ActionState`, and widening it there would have every one of them
 * advertise an id they never set. Present ONLY when `ok` is true.
 */
export interface RegisterUserState extends ActionState {
  userId?: string
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
  /** ADR 0133 D9 (AFF2 B1). Optional at registration. ISO `yyyy-mm-dd`. */
  dateOfBirth?: string | null
  /** ADR 0133 D9 (AFF2 B1). Optional at registration. Stored digits-only. */
  phone?: string | null
  /**
   * CPF, the person key (ADR 0097 D7). Digits or formatted — normalized here.
   *
   * ⚠ Accepted from ANY authorized registrar, including a hospital_admin, while
   * EDITING it later is org_admin-only (D14). That is not an inconsistency: D14's
   * stated rationale is that "two hospital admins editing them is a silent
   * cross-hospital write", and at creation there is no other hospital's value to
   * overwrite — the person does not exist yet. D12's identifier-first flow has the
   * registrar type the CPF to search before it offers to create.
   *
   * REQUIRED (D7: "required at the action layer"). The nullable COLUMN remains the
   * documented escape for a foreign professional without a schema change, but no
   * product path may create a person without the key the whole feature is built on:
   * an admin who registers someone with no CPF makes them unfindable by the next
   * admin's lookup, and the feature is inert on exactly the population it exists for.
   */
  cpf: string
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
  /**
   * CPF (ADR 0097 D7). ⚠ org_admin-ONLY to change (D14), enforced server-side.
   * OMIT the key to leave it untouched; `null` clears it. A hospital_admin sending an
   * unchanged value is fine — the gate fires on a real change, not on presence.
   */
  cpf?: string | null
  /**
   * ADR 0133 D9/D10 (AFF2 B1). ISO `yyyy-mm-dd`. OMIT the key to leave it untouched;
   * `null` clears it — the same discipline as `cpf` above. Person-level under D3, so a
   * change is gated by the `fields` capability.
   */
  dateOfBirth?: string | null
  /**
   * ADR 0133 D9/D10 (AFF2 B1). Stored DIGITS-ONLY, no CHECK (Amdt 1 ruling 6) —
   * formatting is display-side. Same undefined-means-untouched discipline.
   */
  phone?: string | null
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
  // ADR 0097 D7/D8: the CPF collision copy reuses the email-collision FORM verbatim
  // and names neither the holder nor their tenant — the identifier is globally unique,
  // so a message that distinguished "exists elsewhere" would be a cross-tenant oracle.
  cpfCollision: 'Este CPF já está cadastrado na plataforma.',
  cpfInvalid: 'Informe um CPF válido.',
  cpfRequired: 'Informe o CPF.',
  // ADR 0097 D14 — person-level fields and the account lifecycle are org_admin-only.
  orgAdminOnly:
    'Apenas o administrador da organização pode alterar os dados pessoais e a situação da conta.',
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
  const administered = new Set(context.hospitalAdminOf.map((h) => h.hospital.id))
  if (administered.size === 0) return false

  // ⛔ SEMANTICS DELIBERATELY UNCHANGED BY THE ADR 0133 GENERALISATION: ANY intersection,
  // NO tier rule, NO subset bound. This gates the ENTRY to `updateUserProfile` and gates
  // `resendInvite` outright, and neither is person-level authority — resending an invite
  // re-sends an email the person is already entitled to. Routing this through
  // `personScopeAllows` would silently import D2 and deny a hospital_admin the ability to
  // resend an invite to, say, a technical_director at their own hospital.
  //
  // It shares `resolvePersonFootprint` rather than re-deriving the footprint beside it —
  // a second derivation of the same thing is the "same predicate twice, drifting" shape.
  // Pinned by `d14-person-level.test.ts` §7, whose cross-hospital and hospital-tier arms
  // are the only things that would notice if this acquired either bound.
  const footprint = await resolvePersonFootprint(userId)
  return footprint.hospitalIds.some((hospitalId) => administered.has(hospitalId))
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
 * ADR 0133 D1–D4 (+ Amendment 1 ruling 1) — THE person-level authority gate.
 *
 * Replaces `authorizeOrgAdminForUser`, whose blanket "org_admin only" this ADR reversed
 * for two of the four capability classes. The org_admin arm is unchanged and is NOT
 * footprint-bounded; the new hospital_admin arm is.
 *
 * ⚠ THIS IS THE ONLY AUTHORITY ON THESE PATHS. They run on the service-role client, which
 * has no RLS backstop, and the `profiles` column grants that lock `cpf`/`date_of_birth`/
 * `phone` govern PostgREST only — the service client walks straight around them. A SQL
 * twin is deliberately NOT built (D4): no policy would consume it and a dead DB predicate
 * is a census liability forever. Keystoned in `d14-person-level.test.ts` (wiring, through
 * the real actions) and `person-scope.test.ts` (the decision).
 *
 * ⚠ THE CAPABILITY ARGUMENT IS LOAD-BEARING — it selects between an INTERSECTION bound and
 * a SUBSET one. Passing the wrong one at a call site is invisible to `person-scope.test.ts`
 * however perfect that predicate is, which is why the wiring has its own keystone file.
 *
 * Deliberately NOT platform_admin either: `authorizeOrgOps` excludes it (ADR 0041 / the
 * noun rule — commission content and person records are not platform_admin's).
 */
async function authorizePersonScopedAdmin(
  userId: string,
  capability: PersonScopeCapability,
): Promise<{ ok: boolean; orgId?: string }> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('home_organization_id')
    .eq('id', userId)
    .maybeSingle()
  const orgId = data?.home_organization_id ?? undefined
  if (!orgId) return { ok: false }

  // The org_admin arm, exactly as before this ADR.
  if (await authorizeOrgOps(orgId)) return { ok: true, orgId }

  // The hospital_admin arm (D1). (a) the caller must hold hospital_admin in the TARGET'S
  // home org — a hospital administered in some other org is not a claim on this person.
  const context = await getSessionContext()
  if (!context || context.isInactive) return { ok: false, orgId }
  const administeredHospitalIds = context.hospitalAdminOf
    .filter((h) => h.organization.id === orgId)
    .map((h) => h.hospital.id)
  if (administeredHospitalIds.length === 0) return { ok: false, orgId }

  const footprint = await resolvePersonFootprint(userId)
  return {
    ok: personScopeAllows(capability, footprint, administeredHospitalIds),
    orgId,
  }
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
 * hospital — the TS mirror of `is_tenancy_admin_of`. A hospital_admin may thus
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
): Promise<RegisterUserState> {
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
  // CPF is validated by the SAME authority the database uses (Rule 3 mirrored pair),
  // so a bad check digit becomes a pt-BR field error instead of a raw 23514.
  // Kept as a plain `string` (never `string | null`) so the collision lookup and the
  // profile write below need no non-null assertion: the fieldErrors early-return above
  // is the only path past an empty value.
  const cpf = normalizeCpf(input.cpf ?? '')
  if (!cpf) fieldErrors.cpf = MESSAGES.cpfRequired
  else if (!isValidCpf(cpf)) fieldErrors.cpf = MESSAGES.cpfInvalid
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

  // CPF is the person key and is unique platform-wide (D7), so a collision must BLOCK
  // exactly as the email one does. Front-loaded here so the common case never creates
  // an auth user it then has to fail behind; the 23505 on the profile write below
  // stays as the RACE backstop, not as the primary check.
  //
  // ⚠ The copy reuses the email-collision FORM verbatim and names neither the holder
  // nor their tenant (D8). CPF is globally unique, so a message that distinguished
  // "exists in another organisation" would turn this into a cross-tenant existence
  // oracle over national IDs — the enumeration surface D7/LOW-3 already flags as the
  // widest one this platform has.
  const { data: cpfHolder, error: cpfLookupError } = await admin
    .from('profiles')
    .select('id')
    .eq('cpf', cpf)
    .maybeSingle()
  if (cpfLookupError) {
    return { ok: false, error: MESSAGES.generic }
  }
  // ADR 0097 LOW-3 / D11 — this block is the REGISTRATION half of the CPF existence
  // oracle, and D11's audit row is the compensating control for the oracle as a whole.
  // The directory half (`list_org_people`) audits itself; this one could not, because it
  // runs service-role with no auth.uid(). Emitted for BOTH outcomes, never with the
  // digits — a probe that found nothing is exactly as interesting to an auditor as one
  // that found someone.
  await admin.rpc('log_cpf_probe_for', {
    p_actor: context.userId,
    p_org_id: input.homeOrganizationId,
    p_matched: cpfHolder?.id ?? undefined,
  })

  if (cpfHolder) {
    return { ok: false, fieldErrors: { cpf: MESSAGES.cpfCollision } }
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
      cpf,
      // ADR 0133 D9 — optional at registration; `null` when not supplied. Written here on
      // the SERVICE path, which is the only path that may set them at all (D10: the
      // privileged-column guard refuses every signed-in caller).
      date_of_birth: input.dateOfBirth || null,
      phone: input.phone ? input.phone.replace(/\D/g, '') || null : null,
      // Flag-OFF path only: the admin set the initial password, so force the user
      // to rotate it at /primeiro-acesso before using the app (ADR 0049). The
      // flag-ON invite path leaves it false (the user sets their own at /convite).
      must_change_password: !emailVerification,
    })
    .eq('id', userId)
  if (profileError) {
    // Do NOT swallow: the invite happened, but the profile write failed. Surface
    // it so the operator retries (the pending profile exists and is anchored).
    return {
      ok: false,
      ...(profileError.code === '23505'
        ? { fieldErrors: { cpf: MESSAGES.cpfCollision } }
        : { error: MESSAGES.generic }),
    }
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
    // ADR 0133 F3 — the wizard redirects to the new person's profile. Returned only on
    // success, which is why `RegisterUserState.userId` is optional rather than required.
    userId,
    error: emailVerification
      ? MESSAGES.registeredInvited
      : MESSAGES.registeredActive,
  }
}

/** Edit an existing user's profile fields (name / category / hospital / matrícula). */
export async function updateUserProfile(
  input: UpdateUserProfileInput,
): Promise<ActionState> {
  // Entry authority: a hospital_admin may still reach this action, because the
  // AFFILIATION half of it is legitimately theirs (matrícula at their own hospital).
  const auth = await authorizeForUser(input.userId)
  if (!auth.ok) return { ok: false, error: MESSAGES.forbidden }

  const fullName = input.fullName.trim()
  if (!fullName) {
    return { ok: false, fieldErrors: { fullName: MESSAGES.nameRequired } }
  }

  const cpf = input.cpf === undefined ? undefined : normalizeCpf(input.cpf ?? '') || null
  if (cpf && !isValidCpf(cpf)) {
    return { ok: false, fieldErrors: { cpf: MESSAGES.cpfInvalid } }
  }

  // D14 — the person-level gate. Compared against the CURRENT row with `distinct
  // from` semantics, not applied blanket: the edit form always POSTS name and
  // category, so gating on their PRESENCE would deny a hospital admin editing only a
  // matrícula. Only an actual CHANGE is a person-level write.
  const adminClient = createAdminClient()
  const { data: current } = await adminClient
    .from('profiles')
    .select('full_name, professional_category_id, cpf, date_of_birth, phone')
    .eq('id', input.userId)
    .maybeSingle()
  if (!current) return { ok: false, error: MESSAGES.missingUser }

  // ⛔ THE CPF GRAIN IS "A REAL CHANGE", NOT "THE KEY IS PRESENT" — ruled 2026-08-23,
  // recorded as ADR 0133 Amendment 3. Amdt 1's own wording says "whenever the input
  // INCLUDES cpf", and taken literally that DEFEATS the amendment it appears in: ruling 1
  // exists to let a hospital_admin edit a cross-hospital person's fields, and presence-based
  // gating denies exactly that the moment the form posts the key. It is not weaker either —
  // a caller who may not change the CPF is refused the instant they try, and sending an
  // unchanged value accomplishes nothing, so gating presence buys no security.
  //
  // ⚠ NORMALISED ON BOTH SIDES deliberately. `profiles_cpf_valid` CHECKs `app.is_valid_cpf`
  // (`^[0-9]{11}$`), so the stored side is digits-only today and a one-sided compare would
  // also work — but only by importing an invariant declared in another file with nothing
  // pointing here. Symmetric, this is correct under either answer.
  //
  // Clearing (`null` / `''`) against a stored value IS a change and correctly hits the
  // tighter bound: erasing a person-key is a person-key identity event like rewriting one.
  const cpfChanged =
    cpf !== undefined && normalizeCpf(current.cpf ?? '') !== normalizeCpf(cpf ?? '')

  const personLevelChanged =
    current.full_name !== fullName ||
    current.professional_category_id !== input.professionalCategoryId ||
    cpfChanged ||
    // D3: the B1 columns are person-level fields, so a change to either is gated. Same
    // undefined-means-untouched discipline as `cpf`.
    (input.dateOfBirth !== undefined &&
      (current.date_of_birth ?? null) !== (input.dateOfBirth ?? null)) ||
    (input.phone !== undefined && (current.phone ?? null) !== (input.phone ?? null))

  if (personLevelChanged) {
    // Amdt 1 ruling 1 — ONE action, TWO bounds. A CPF rewrite is a person-key identity
    // event other hospitals depend on, so it keeps the SUBSET bound while every other
    // person-level field takes the widened INTERSECTION one.
    const capability: PersonScopeCapability = cpfChanged ? 'cpf_change' : 'fields'
    const personAuth = await authorizePersonScopedAdmin(input.userId, capability)
    if (!personAuth.ok) return { ok: false, error: MESSAGES.orgAdminOnly }
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

  const admin = adminClient
  const { error } = await admin
    .from('profiles')
    .update({
      full_name: fullName,
      professional_category_id: input.professionalCategoryId,
      // `cpf` is written ONLY when the caller supplied the key at all, so an edit form
      // that does not carry the field can never null it out. The two B1 columns follow
      // exactly the same rule (ADR 0133 D9/D10).
      ...(cpf === undefined ? {} : { cpf }),
      ...(input.dateOfBirth === undefined
        ? {}
        : { date_of_birth: input.dateOfBirth || null }),
      ...(input.phone === undefined
        ? {}
        : { phone: input.phone ? input.phone.replace(/\D/g, '') || null : null }),
    })
    .eq('id', input.userId)
  if (error) {
    return {
      ok: false,
      error: error.code === '23505' ? MESSAGES.cpfCollision : MESSAGES.generic,
    }
  }

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
  // ADR 0133 D3: a council registration is a fact about the PERSON, and Amdt 1 ruling 1
  // widened it to the INTERSECTION bound alongside the other person-level fields.
  const auth = await authorizePersonScopedAdmin(input.userId, 'credentials')
  if (!auth.ok) return { ok: false, error: MESSAGES.orgAdminOnly }

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

  // ADR 0133 D3 — person-level, `credentials` capability (intersection). Carries its own
  // call site rather than sharing upsert's: F6 recorded that reverting the shared gate
  // reded nothing, so removal needs its own arm and its own capability.
  const auth = await authorizePersonScopedAdmin(cred.user_id, 'credentials')
  if (!auth.ok) return { ok: false, error: MESSAGES.orgAdminOnly }

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
  // ADR 0133 D3 + Amdt 1 ruling 1 — `lifecycle`, which KEEPS THE SUBSET BOUND. `app.is_active`
  // is folded into every membership predicate, so this is a PLATFORM-WIDE kill switch: one
  // hospital's offboarding would end the person's access at every other hospital and
  // committee they hold. A hospital_admin may therefore deactivate only a person whose
  // ENTIRE footprint they administer. Offboarding from ONE hospital is `end_affiliation`.
  const auth = await authorizePersonScopedAdmin(userId, 'lifecycle')
  if (!auth.ok) return { ok: false, error: MESSAGES.orgAdminOnly }

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
  // ADR 0133 — the inverse of deactivateUser is equally platform-wide, so it carries the
  // same `lifecycle` (subset) bound: reactivating restores access everywhere at once.
  const auth = await authorizePersonScopedAdmin(userId, 'lifecycle')
  if (!auth.ok) return { ok: false, error: MESSAGES.orgAdminOnly }

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
  // ADR 0133 — suspension routes through the same `app.is_active` kill switch, so it is
  // `lifecycle` (subset) too, not a lesser act.
  const auth = await authorizePersonScopedAdmin(userId, 'lifecycle')
  if (!auth.ok) return { ok: false, error: MESSAGES.orgAdminOnly }

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
