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
import {
  administeredHospitalsIn,
  authorizeOrgOps,
  personAuthorityOrgs,
  resolvePersonFootprint,
} from './person-footprint'
import { isEmailVerificationEnabled } from '@/lib/config/auth'
import { isValidCpf, normalizeCpf } from '@/lib/users/cpf'
import { callDoor } from '@/lib/types/rpc-args'

/**
 * User Registration & Identity Management — server actions.
 *
 * All writes run on the SERVICE-ROLE client (`createAdminClient()`), because
 * registering a user (invite + cross-user profile/credential/committee write) and
 * managing another user's lifecycle inherently require bypassing RLS. Each action
 * therefore re-verifies, server-side and ORG-SCOPED, that the caller may act on the
 * target BEFORE any write. The platform_admin (`isAdmin`) is NOT authorized here — it is
 * walled off from tenant data (ADR 0041).
 *
 * ⭐ AE1.3 (ADR 0161): the TS check is NO LONGER THE ONLY AUTHORITY. All nine person-level
 * writes — five on `profiles`, four on `professional_credentials` — now run through
 * `public.*_for` doors that re-derive their own authority in PostgreSQL, so a forgotten
 * gate on a future call path, a wrong `capability` argument, or a new raw `.from()` write
 * no longer means an unguarded write. ⛔ There are ZERO raw `insert/update/delete` calls on
 * `profiles` or `professional_credentials` left in this file; the remaining `.from()` uses
 * are all `.select(` reads and are deliberately unchanged. Do not add one back.
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
  /**
   * AFF4 (ADR 0151 D13) — when the employment BEGAN. ISO `yyyy-mm-dd`; omitted/blank
   * means today, which is the right default for someone being registered now.
   *
   * ⚠ It reaches BOTH affiliation rows, not just the hospital one. `affiliatePerson`
   * (the existing-person path) has accepted a start date since AFF2 while this action
   * did not, and the asymmetry — not the default — is what
   * `FUP-AFF2-REGISTRATION-HAS-NO-START-DATE` was filed about: the two sibling actions
   * disagreed about whether the fact was even expressible.
   */
  affiliationStartedOn?: string | null
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

/**
 * Editable PERSON-LEVEL profile fields on the per-user page (identity email is immutable
 * here).
 *
 * ⛔ AFF4 (ADR 0151 D15) REMOVED `homeHospitalId` + `hospitalEmployeeId`. They described
 * an employment write no caller ever asked for, and their presence was the entire
 * justification for a looser entry gate than this action needs. Employment is
 * `AffiliationsPanel`'s, through its own doors. Do not re-add them here: the point of the
 * removal is that the shape can no longer express an employment change at all.
 */
export interface UpdateUserProfileInput {
  userId: string
  fullName: string
  professionalCategoryId: string | null
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
  // ⚠ THE COMMENT WAS STALE, THE STRING IS NOT — and the pairing is why it survived six
  // reviews, a QA pass and eight lint gates. It read "ADR 0097 D14 — person-level fields and
  // the account lifecycle are org_admin-only", which ADR 0133 Amdt 1 ruling 1 REVERSED for
  // person-level fields and credentials (they take the intersection bound); only CPF-change
  // and lifecycle kept the subset bound.
  //
  // The MESSAGE stays exactly as it is. It renders only when a caller was genuinely refused,
  // and in every such case the org admin really is the only one who can act — a conditional
  // truth that still holds. Do not "fix" the copy to match the old comment.
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
  passwordResetSent: 'E-mail de redefinição de senha enviado.',
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
  startedOn?: string | null
}): Promise<boolean> {
  const admin = createAdminClient()
  const { error } = await admin.rpc('affiliate_person_for', {
    p_actor: params.actorId,
    p_user: params.userId,
    p_hospital: params.hospitalId,
    p_employee_id: params.employeeId ?? undefined,
    // AFF4 (ADR 0151 D13). `undefined` omits the key so the kernel's own
    // `coalesce(p_started_on, current_date)` decides — passing `null` explicitly would
    // work identically today and would break the day that default is ever narrowed.
    //
    // ⚠ The kernel IGNORES this on its idempotent branch (an ACTIVE row already exists):
    // `affiliate_person_impl` is the CREATE door and changing an existing employment's
    // dates is `update_affiliation`'s job, which has the audit arm for it. That is a
    // deliberate DB-side ruling pinned by pgTAP `304`, not a gap in this layer.
    p_started_on: params.startedOn ?? undefined,
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
 * ⭐ NO LONGER THE ONLY AUTHORITY ON THESE PATHS — AE1.3 changed that, and the change is
 * the point of this gate's continued existence rather than a reason to delete it. Every
 * person-level write now goes through a `public.*_for` door that re-derives the SAME rule
 * in PostgreSQL via `app.can_administer_person_for` (ADR 0161, retiring D4's "no SQL twin";
 * the twin's own header in `person-scope.ts` carries the mirroring obligation).
 *
 * This gate STAYS as defense in depth and for the pt-BR message: a door refusal surfaces
 * as a bare `42501` that the UI must render generically, whereas this one can say
 * `MESSAGES.orgAdminOnly`. ⚠ A `42501` reaching a call site therefore means TS and SQL
 * DISAGREE — a drift event, not a legitimate deny.
 *
 * Keystoned in `d14-person-level.test.ts` (wiring, through the real actions),
 * `person-scope.test.ts` (the decision) and `person-scope-vectors.test.ts` (the mirror).
 *
 * ⚠ THE CAPABILITY ARGUMENT IS LOAD-BEARING — it selects between an INTERSECTION bound and
 * a SUBSET one. Passing the wrong one at a call site is invisible to `person-scope.test.ts`
 * however perfect that predicate is, which is why the wiring has its own keystone file.
 *
 * Deliberately NOT platform_admin either: `authorizeOrgOps` excludes it (ADR 0041 / the
 * noun rule — commission content and person records are not platform_admin's).
 *
 * ⭐ AE2.4 INCREMENT 3 — THE ORGANIZATION IS NO LONGER `profiles.home_organization_id`.
 * It is now LOCATED from `organization_affiliations` via {@link personAuthorityOrgs}, the
 * TS mirror of `app.person_authority_orgs`, which implements ADR 0163's last-org
 * retention. Until this change the ADR was live on the READ side only — and the four
 * capabilities this gate decides are exactly what the six person doors enforce, so the
 * ruling was not in force where its own subject matter is enforced (ADR 0164).
 *
 * ⛔ THE RETURNED `orgId` WAS REMOVED, MEASURED RATHER THAN ASSUMED: no caller read it.
 * Keeping it would have meant picking one of several located organizations and handing a
 * future reader an arbitrary value that looks authoritative.
 */
async function authorizePersonScopedAdmin(
  userId: string,
  capability: PersonScopeCapability,
): Promise<{ ok: boolean }> {
  // LOCATE (Architecture Rule 13) — no caller term; this cannot grant.
  const orgIds = await personAuthorityOrgs(userId)
  // ⚠ COMPOSITION CHECK: the empty result must land on the RESTRICTIVE answer, exactly as
  // the NULL column did. A person with no non-voided affiliation becomes administrable by
  // nobody — an accepted narrowing (pgTAP 394 § 5, cells CA×P9 / CA×P3), never a fail-open.
  // Their recovery path is re-affiliation, which increment 1 deliberately left open to any
  // org admin (ADR 0165 W5/W6/W7) and which does not route through this gate.
  if (orgIds.length === 0) return { ok: false }

  // GRANT, arm 1 — the org_admin arm, NOT footprint-bounded. It returns before the
  // capability is ever consulted, which is why the capability axis is inert here.
  for (const orgId of orgIds) {
    if (await authorizeOrgOps(orgId)) return { ok: true }
  }

  // GRANT, arm 2 — the hospital_admin arm (ADR 0133 D1(a)): the caller must hold
  // hospital_admin in an organization that LOCATES this person. A hospital administered
  // in some other organization is not a claim on them.
  const administeredHospitalIds = await administeredHospitalsIn(orgIds)
  if (administeredHospitalIds === null) return { ok: false }
  if (administeredHospitalIds.length === 0) return { ok: false }

  const footprint = await resolvePersonFootprint(userId)
  return { ok: personScopeAllows(capability, footprint, administeredHospitalIds) }
}

/**
 * Locate the target user's organizations, then authorize the caller — as an
 * `org_admin` of one of them OR (ADR 0051) as a `hospital_admin` who may manage the
 * user (its home hospital / a commission of that hospital). Used by the per-user
 * committee-assignment, invite-resend and password-reset actions, which take a `userId`
 * rather than an org id. Every read runs on the service-role client so a foreign caller
 * (who could not SELECT the rows) still gets a correct deny rather than an empty result
 * that reads as "no organization".
 *
 * ⭐ AE2.4 INCREMENT 3 — moved off `profiles.home_organization_id` onto
 * {@link personAuthorityOrgs}, in the SAME commit as `authorizePersonScopedAdmin` and
 * `getPersonAdminView`. ⛔ THE THREE MOVE TOGETHER OR THEY DISAGREE: they carried three
 * verbatim copies of the same resolution, and that duplication is the mechanism by which
 * "one axis swept, its sibling not" kept recurring in this phase. This function was named
 * by no increment's target list and would have fallen through exactly as
 * `resolveOrInviteUser` did; lead ruling 2026-08-28 assigned it here, and the enumerating
 * property is *"an authorization preamble that resolves the column"*, never a list.
 *
 * ⚠ ONLY THE ORGANIZATION RESOLUTION MOVED. The hospital arm below is ADR 0051's — ANY
 * intersection with the caller's administered hospitals, no tier rule, no subset bound,
 * and NO organization scoping either before or after this change. It is deliberately NOT
 * `personScopeAllows` (see the note on {@link sendPasswordResetForUser}), so this function
 * does not use `administeredHospitalsIn` and must not be "unified" with the person-scoped
 * gate: the two answer different questions.
 */
async function authorizeForUser(userId: string): Promise<{ ok: boolean }> {
  const orgIds = await personAuthorityOrgs(userId)
  if (orgIds.length === 0) return { ok: false }
  for (const orgId of orgIds) {
    if (await authorizeOrgOps(orgId)) return { ok: true }
  }
  // ADR 0051 hospital arm: a hospital_admin may manage its own hospital's users.
  if (await callerHospitalAdminMayManageUser(userId)) return { ok: true }
  return { ok: false }
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
  // AFF4 (ADR 0151 D13). Blank means "the box was empty", which is not a date — the
  // same `nullif(btrim(...))` discipline the kernels apply to `p_employee_id`. `null`
  // then rides through both doors as an omitted key and each defaults to today.
  const affiliationStartedOn = input.affiliationStartedOn?.trim() || null

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

  // ⭐⭐ THE AFFILIATIONS ARE WRITTEN **BEFORE** THE PROFILE PATCH, AND THE ORDER IS NOW
  // LOAD-BEARING AUTHORITY, NOT TASTE (AE1.3, ADR 0161; design F-A, ruled Option A).
  //
  // The profile patch is no longer raw DML — it is `finalize_invited_person_for`, which
  // re-derives the registrar's authority in PostgreSQL through
  // `app.can_administer_person_for('cpf_change', …)`. That predicate is FOOTPRINT-BOUNDED,
  // and a person who has just been created has NO affiliation and NO membership, i.e. an
  // EMPTY footprint — which it denies for every capability, deliberately (an unaffiliated
  // person belongs to no hospital, so no hospital admin has a claim on them).
  //
  // ⛔ SO PATCHING THE PROFILE FIRST WOULD 42501 EVERY hospital_admin REGISTRATION — a
  // total outage of a supported product path, presenting as TS↔SQL drift. Do not "restore
  // the original order" for tidiness. Its failure state was strictly worse too: a failure
  // between createUser and the affiliation left a person on NOBODY'S ROSTER (the state the
  // comment below names as the one to avoid), whereas under this order the same failure
  // leaves them roster-visible and correctable through the ordinary person-edit UI.

  // ORG AFFILIATION (AFF4, ADR 0151 D1/D13) — created BEFORE the hospital row, because
  // it is that row's parent under D4's containment invariant.
  //
  // ⚠ ONLY ON THE org_admin PATH, and that is not an oversight. The org door is
  // org_admin-ONLY by D2 (no hospital_admin arm at the organisation tier), so calling it
  // for a hospital_admin registrar would raise 42501 and fail a registration the product
  // permits. The hospital_admin path gets its org affiliation from D5's org-parent ensure
  // inside `affiliate_person_impl` instead — which is precisely what makes a hospital
  // admin's onboarding one step rather than a wait on an org_admin ticket.
  //
  // ⛔ WITHOUT THIS CALL A HOSPITAL-LESS REGISTRATION CREATES NO ORG AFFILIATION AT ALL,
  // and since B6b re-predicated the directory roster onto `organization_affiliations`,
  // that person would exist and appear on nobody's roster. Only an org_admin can reach
  // that state: the branch above forces a hospital_admin registrar to resolve exactly one
  // administered hospital or refuse, so the two conditions coincide.
  //
  // Passing the start date HERE (and not only to the hospital door) is what keeps the two
  // rows agreeing about when the employment began: D5's ensure inside the hospital kernel
  // takes no date and defaults to today.
  if (isOrgAdminCaller) {
    const { error: orgAffiliationError } = await admin.rpc('affiliate_person_to_org_for', {
      p_actor: context.userId,
      p_user: userId,
      p_organization: input.homeOrganizationId,
      p_started_on: affiliationStartedOn ?? undefined,
    })
    if (orgAffiliationError) {
      // Same reasoning as the profile write above: the account already exists, and a
      // swallowed failure here is the roster-invisibility state described above.
      return { ok: false, error: MESSAGES.generic }
    }
  }

  // Employment (ADR 0097 D1/D3) — the row that used to be profiles.home_hospital_id +
  // profiles.hospital_employee_id. effectiveHomeHospitalId: for a hospital_admin this
  // is the SERVER-SET administered hospital (never the raw formData value); for an
  // org_admin it is the client-supplied input (amendment 11). A registration with no
  // hospital creates no employment row — the person exists, unaffiliated, which is a
  // legitimate state (the `novato.pendente` case D2 exists to keep visible) and, since
  // the block above, one that still carries an org affiliation.
  if (effectiveHomeHospitalId) {
    const affiliated = await ensureActiveAffiliation({
      userId,
      hospitalId: effectiveHomeHospitalId,
      employeeId: input.hospitalEmployeeId?.trim() || null,
      actorId: context.userId,
      startedOn: affiliationStartedOn,
    })
    if (!affiliated) {
      // Same reasoning as the profile write above: the account exists, so a silent
      // failure would leave a person nobody's roster shows.
      return { ok: false, error: MESSAGES.generic }
    }
  }

  // THE PROFILE PATCH — now `finalize_invited_person_for`, and it runs HERE, after the
  // affiliations, for the reason stated at the top of this block. Column list unchanged
  // from the `.update({…})` it replaces. ⛔ `home_organization_id` is deliberately NOT in
  // it: it is seeded by `handle_new_user` from user metadata, and the door has no business
  // rewriting a person's tenancy anchor.
  //
  // ⚠ CORRECTED IN AE2.4 INCREMENT 3. This comment used to say the omission was because
  // writing the column "would fire the deferred constraint trigger
  // `profiles_tenant_has_org_trg`". ⛔ THAT TRIGGER NO LONGER EXISTS: increment 1 (ADR
  // 0164) moved tenant containment off `profiles` INSERT entirely and onto
  // `org_affiliation_tenant_containment_trg`, which fires on organization-affiliation
  // void/delete. Nothing fires on a `profiles` write now. The omission is still correct;
  // the REASON given for it had gone false, which is how a stale comment ships a bug —
  // the next reader adds the column back on the strength of a guard that is gone.
  const { error: profileError } = await callDoor(admin, 'finalize_invited_person_for', {
    p_actor: context.userId,
    p_user: userId,
    p_full_name: fullName,
    p_professional_category_id: input.professionalCategoryId,
    p_cpf: cpf,
    // ADR 0133 D9 — optional at registration; `null` when not supplied. The door writes
    // them on the SERVICE path, the only path that may set them at all (D10: the
    // privileged-column guard refuses every signed-in caller).
    p_date_of_birth: input.dateOfBirth || null,
    p_phone: input.phone ? input.phone.replace(/\D/g, '') || null : null,
    // Flag-OFF path only: the admin set the initial password, so force the user to rotate
    // it at /primeiro-acesso before using the app (ADR 0049). The flag-ON invite path
    // leaves it false (the user sets their own at /convite).
    p_must_change_password: !emailVerification,
  })
  if (profileError) {
    // Do NOT swallow: the invite happened, but the profile write failed. Surface it so
    // the operator retries (the pending profile exists, is anchored, and — since the
    // reorder — is on the roster).
    //
    // ⚠ A `42501` ON THIS PATH IS NOT A LEGITIMATE DENY. The caller already cleared this
    // action's TS entry gate, so a door refusal here means the TS and SQL halves DISAGREE.
    // Reporting "sem permissão" to an operator who was just allowed to reach the form
    // would be a lie about what happened, so it takes the generic message — surfaced,
    // never swallowed.
    return {
      ok: false,
      ...(profileError.code === '23505'
        ? { fieldErrors: { cpf: MESSAGES.cpfCollision } }
        : { error: MESSAGES.generic }),
    }
  }

  // Credentials (optional). A duplicate 4-tuple (23505) is reported, not hidden.
  //
  // ⚠ ONE DOOR CALL PER CREDENTIAL, replacing a single bulk `.insert([…])`. The door takes
  // one row, so the batch is no longer one statement: a failure on the third credential
  // leaves the first two written. That is the same partial-state model the rest of this
  // action already has (the account, affiliations and profile are all committed by now)
  // and every failure is still surfaced rather than swallowed — but it is a real change
  // and is stated rather than left to be discovered.
  const credentials = (input.credentials ?? []).filter(
    (c) => c.registrationNumber.trim() !== '',
  )
  for (const c of credentials) {
    const { error: credError } = await callDoor(admin, 'upsert_credential_for', {
      p_actor: context.userId,
      p_user: userId,
      p_id: null,
      p_issuing_country: c.issuingCountry.trim(),
      p_issuing_state: c.issuingState.trim(),
      p_issuing_authority: c.issuingAuthority.trim(),
      p_registration_number: c.registrationNumber.trim(),
      p_expires_on: c.expiresOn ?? null,
    })
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

/**
 * Edit an existing user's PERSON-LEVEL profile fields (name / category / CPF / date of
 * birth / phone).
 *
 * ⭐ AFF4 (ADR 0151 D15) — THE ENTRY GATE IS THE PERSON-LEVEL ONE, and the affiliation
 * half this action used to carry is gone. It previously took `authorizeForUser` — the
 * no-tier, no-subset gate — justified in a comment that read *"a hospital_admin may still
 * reach this action, because the AFFILIATION half of it is legitimately theirs"*. QA R5
 * measured that no caller exercised that half: AFF2's F2 moved every employment fact to
 * `AffiliationsPanel`, which goes through its own door, so the home-hospital validation
 * and the `ensureActiveAffiliation` call here were reachable only by a hand-crafted
 * server-action call. With the justification dead, the loose gate was a live over-grant
 * surface with no purpose — the R1 class survives exactly by a permissive entry gate over
 * a real bound sitting deeper.
 *
 * Everything this action can now write is person-level, so `fields` is the entry bound and
 * `cpf_change` still escalates it. ⚠ Two consequences, stated rather than discovered:
 *  · The "is it an ACTUAL change?" test that used to decide whether the person gate ran at
 *    all is gone with it. It existed solely so a hospital_admin who fails `fields` could
 *    still reach the affiliation half; nothing reaches past this gate now. The `cpf`
 *    comparison stays, because it selects between two bounds rather than gating entry.
 *  · A non-existent `userId` now answers the person-scope refusal instead of "user not
 *    found" — the gate resolves the same `profiles` row and denies first. Strictly better:
 *    it stops the action distinguishing "not yours" from "does not exist".
 */
export async function updateUserProfile(
  input: UpdateUserProfileInput,
): Promise<ActionState> {
  const auth = await authorizePersonScopedAdmin(input.userId, 'fields')
  if (!auth.ok) return { ok: false, error: MESSAGES.orgAdminOnly }

  const fullName = input.fullName.trim()
  if (!fullName) {
    return { ok: false, fieldErrors: { fullName: MESSAGES.nameRequired } }
  }

  const cpf = input.cpf === undefined ? undefined : normalizeCpf(input.cpf ?? '') || null
  if (cpf && !isValidCpf(cpf)) {
    return { ok: false, fieldErrors: { cpf: MESSAGES.cpfInvalid } }
  }

  // The CURRENT row, read to decide whether the CPF is actually changing (below) and to
  // supply the normalisers their stored side.
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

  // QA R4 — NORMALISE BOTH SIDES FOR THE B1 COLUMNS TOO, exactly as `cpf` does above.
  //
  // Amdt 3's symmetry ruling was applied to `cpf` and not to its two siblings: these
  // compared RAW while the write path normalises. `phone: '(11) 98765-4321'` against a
  // stored `'11987654321'` read as a CHANGE and gated a person-level write that would have
  // stored byte-identical digits; `dateOfBirth: ''` against a stored `null` did the same,
  // because the write path coerces `''` to null and the comparison did not.
  //
  // ⚠ IT FAILED CLOSED — over-gating, never under — and it is latent behind the current
  // form, which is precisely what makes it the "trap for the next author" Amdt 3 was ruled
  // on, one field over. The normalisers are the SAME expressions the write path uses; a
  // comparison that disagrees with its own writer is the defect, not the formatting.
  //
  // ⚠ AFF4 (D15) MOVED WHAT THESE GOVERN. They no longer feed a change-detector that
  // decided whether the person gate ran — that gate is now the entry gate. They remain
  // the WRITE path's coercions below, so the symmetry lesson is preserved where it can
  // still be violated; the comparison arms that pinned it were retired with the
  // detector (see this action's docstring).
  const normalizePhone = (v: string | null | undefined): string | null =>
    v ? v.replace(/\D/g, '') || null : null
  const normalizeDob = (v: string | null | undefined): string | null => v || null

  if (cpfChanged) {
    // Amdt 1 ruling 1 — ONE action, TWO bounds. A CPF rewrite is a person-key identity
    // event other hospitals depend on, so it keeps the SUBSET bound while every other
    // person-level field takes the widened INTERSECTION one the entry gate applied.
    const personAuth = await authorizePersonScopedAdmin(input.userId, 'cpf_change')
    if (!personAuth.ok) return { ok: false, error: MESSAGES.orgAdminOnly }
  }

  const actorId = (await getSessionContext())?.userId
  if (!actorId) return { ok: false, error: MESSAGES.forbidden }

  const admin = adminClient
  // AE1.3 — through the door, not raw DML. The door re-derives BOTH bounds in PostgreSQL
  // (`fields` INTERSECTION always, `cpf_change` SUBSET only when the CPF actually
  // changes), so the TS gates above are now defense in depth and a friendlier pt-BR
  // message rather than the only authority on a service-role path.
  //
  // ⚠ THE `p_set_*` BOOLEANS CARRY THE ABSENT-KEY / EXPLICIT-NULL DISTINCTION that the
  // spread form (`...(cpf === undefined ? {} : { cpf })`) carried before. A nullable
  // parameter alone cannot express it, and collapsing the pair would let an edit form
  // that does not carry the field NULL IT OUT (ADR 0133 D9/D10). Pinned by pgTAP 385 §1.7.
  const { error } = await callDoor(admin, 'update_person_fields_for', {
    p_actor: actorId,
    p_user: input.userId,
    p_full_name: fullName,
    p_professional_category_id: input.professionalCategoryId,
    p_set_cpf: cpf !== undefined,
    p_cpf: cpf ?? null,
    // The normalisers declared above. The door normalises again on its own side — not
    // redundancy but the mirror: a writer that disagrees with its own comparison is the
    // defect (pgTAP 385 §1.5 caught exactly that).
    p_set_date_of_birth: input.dateOfBirth !== undefined,
    p_date_of_birth:
      input.dateOfBirth === undefined ? null : normalizeDob(input.dateOfBirth),
    p_set_phone: input.phone !== undefined,
    p_phone: input.phone === undefined ? null : normalizePhone(input.phone),
  })
  if (error) {
    return {
      ok: false,
      error: error.code === '23505' ? MESSAGES.cpfCollision : MESSAGES.generic,
    }
  }

  // ⛔ NO EMPLOYMENT WRITE HERE — AFF4 (D15) removed it, and re-adding one would restore
  // the over-grant this action's docstring describes. Employment facts belong to
  // `AffiliationsPanel` and its doors (`affiliate_person` / `update_affiliation` /
  // `end_affiliation` / `void_affiliation`), each of which re-derives its own authority
  // in PostgreSQL. `UpdateUserProfileInput` no longer carries `homeHospitalId` or
  // `hospitalEmployeeId`, so this is a type error to reintroduce by accident.
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

  const actorId = (await getSessionContext())?.userId
  if (!actorId) return { ok: false, error: MESSAGES.forbidden }

  // AE1.3 — ONE door for both branches; `p_id` null means insert. The door clears
  // `verified_at` and stamps `updated_at` on the update branch (tamper-visible), and
  // re-derives `credentials` (INTERSECTION) authority in PostgreSQL.
  //
  // ⭐ THE ZERO-ROW FAILURE MODE IS GONE, not merely still handled. The cross-person guard
  // used to be `.eq('user_id', …)`, whose whole purpose was to match ZERO rows for a
  // forged id — and a zero-row UPDATE is not an error, so the UI once reported "Registro
  // profissional salvo." for a write that never happened. The door RAISES `HC0T6` instead,
  // so there is no silent-success shape left to forget to check.
  const admin = createAdminClient()
  const { error } = await callDoor(admin, 'upsert_credential_for', {
    p_actor: actorId,
    p_user: input.userId,
    p_id: input.id ?? null,
    p_issuing_country: row.issuing_country,
    p_issuing_state: row.issuing_state,
    p_issuing_authority: row.issuing_authority,
    p_registration_number: row.registration_number,
    p_expires_on: row.expires_on,
  })
  if (error) {
    return {
      ok: false,
      error:
        error.code === '23505'
          ? MESSAGES.credentialCollision
          : MESSAGES.generic,
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

  const actorId = (await getSessionContext())?.userId
  if (!actorId) return { ok: false, error: MESSAGES.forbidden }

  // AE1.3 — through the door. ⚠ The door takes the CREDENTIAL id and resolves the person
  // itself, and it answers an unknown id with the SAME `42501` and the SAME message as a
  // denial. That is deliberate and is the OPPOSITE of `upsert_credential_for`'s update
  // branch, where authority over `p_user` is proven first so `HC0T6` gives away nothing:
  // here the id IS the input, so a distinguishable not-found would be a credential-id
  // ORACLE. Pinned by pgTAP 385 §6.3, which compares the two errors byte for byte.
  const { error } = await admin.rpc('delete_credential_for', {
    p_actor: actorId,
    p_credential: credentialId,
  })
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

  const actorId = (await getSessionContext())?.userId
  if (!actorId) return { ok: false, error: MESSAGES.forbidden }

  // AE1.3 — ONE door serves both directions; see `reactivateUser`.
  const admin = createAdminClient()
  const { error } = await admin.rpc('set_person_active_for', {
    p_actor: actorId,
    p_user: userId,
    p_active: false,
  })
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

  const actorId = (await getSessionContext())?.userId
  if (!actorId) return { ok: false, error: MESSAGES.forbidden }

  // AE1.3 — the SAME door as `deactivateUser`, which is why the residual-suspension clear
  // cannot drift between the two: `set_person_active_for` nulls `suspended_until` on the
  // reactivating direction only, in one place. Two doors would be two places to forget it.
  const admin = createAdminClient()
  const { error } = await admin.rpc('set_person_active_for', {
    p_actor: actorId,
    p_user: userId,
    p_active: true,
  })
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

  const actorId = (await getSessionContext())?.userId
  if (!actorId) return { ok: false, error: MESSAGES.forbidden }

  // AE1.3 — a SEPARATE door from `set_person_active_for`, deliberately: the two write
  // DISJOINT columns, and merging them into one `p_active` + `p_until` door would create a
  // call shape where the wrong combination silently REACTIVATES a suspended person. This
  // door writes `suspended_until` and nothing else — pgTAP 385 §3.2 asserts `is_active` is
  // untouched, because a door that "helpfully" also flipped it would silently widen what
  // suspension MEANS.
  const admin = createAdminClient()
  const { error } = await callDoor(admin, 'suspend_person_for', {
    p_actor: actorId,
    p_user: userId,
    p_suspended_until: suspendedUntil,
  })
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

/**
 * Send a password-reset email to `userId`'s own address, on an administrator's behalf —
 * the "Enviar redefinição de senha" affordance on the person detail page.
 *
 * ⚠ THE BOUND IS `authorizeForUser`, DELIBERATELY, NOT `authorizePersonScopedAdmin`.
 * This action's structural twin is {@link resendInvite}, not `updateUserProfile`: it
 * changes NOTHING, and it sends a link to an address the person already controls, so an
 * administrator who may manage this person at all may trigger it. Routing it through
 * `personScopeAllows` would import ADR 0133 D2 and deny a hospital_admin the ability to
 * help, say, a technical_director at their own hospital recover a login — the exact case
 * the note on `callerHospitalAdminMayManageUser` exists to preserve. It is not the
 * lifecycle capability either: nothing here touches the `app.is_active` kill switch.
 *
 * ⛔ NOT AN ENUMERATION ORACLE. Both "no such person" and "not permitted" return the SAME
 * pt-BR refusal, and the authorizer resolves the profile on the service client so an
 * unauthorized caller is refused identically whether or not the id exists. Note this is
 * the OPPOSITE of `requestPasswordReset` in `@/lib/auth/actions`, which is anonymous and
 * therefore must report success unconditionally; here the caller is an authenticated
 * administrator who is entitled to know their own action failed, and the id comes from a
 * directory they can already read.
 *
 * The email itself goes through the SAME mechanism the self-service flow uses
 * (`resetPasswordForEmail` → `/auth/confirm`), so one recovery path exists, not two.
 * Sent from the service-role client because the target's address is resolved on it — the
 * caller is not the subject, and no cookie-client read of another person's email is
 * guaranteed by RLS.
 */
export async function sendPasswordResetForUser(
  userId: string,
): Promise<ActionState> {
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
  const { error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm`,
  })
  // Raw Supabase/Postgres errors never reach the UI (CLAUDE.md §8).
  if (error) return { ok: false, error: MESSAGES.generic }

  return { ok: true, error: MESSAGES.passwordResetSent }
}
