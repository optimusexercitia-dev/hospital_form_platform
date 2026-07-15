'use server'

import type { ParticipantType } from '@/lib/queries/cases'

/**
 * Case-participant + professional-profile write authority (ADR 0072 D6 · ETH·E1).
 *
 * E0 (ADR 0064) shipped `case_participants` / `professional_profiles` SELECT-ONLY —
 * gating a write on the READ predicate (`can_read_case`) would let any case reader
 * write participants (0064 QA MINOR-1). E1 supplies the REAL write authority as
 * coordinator/staff-admin-gated, audited SECURITY DEFINER RPCs (the meetings /
 * interviews / case-access door pattern): every write funnels through an RPC that
 * REVOKEs PUBLIC then GRANTs `authenticated, service_role` (t19), asserts the
 * `case_participants` / `case_types` flag, and authorizes coordinator-only — a plain
 * reader calling one gets `42501` / `HC0E4`.
 *
 * CONTRACT-FIRST STUB (BE-1): signatures + input shapes are the frozen contract the
 * E2/E3 ethics UI binds to. Bodies land in BE-5 (participant/professional writers).
 * All user-facing strings will be pt-BR (Rule 10); raw Postgres errors never reach the
 * UI (CLAUDE.md §8). Reads live in `src/lib/queries/cases.ts` (Rule 9).
 */

// ---------------------------------------------------------------------------
// Result shapes (the shared `useActionState`-shaped contract)
// ---------------------------------------------------------------------------

/** The shared `useActionState`-shaped result for every participant mutation. */
export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/** An add action that returns the new `case_participants.id` on success. */
export interface AddParticipantState extends ActionState {
  caseParticipantId?: string
}

/**
 * B7 (ADR 0078 M1·1) — whether a professional's platform account is RESOLVED.
 *
 * `unknown` is the fail-closed default: the account is unresolved, so
 * `app.is_case_respondent` cannot resolve and the case exclusion would be
 * decorative. Such a profile CANNOT be seated as `respondent_doctor` (`HC0F0`).
 * `linked` = the account is known. `no_account` = affirmed to have none, which
 * makes the exclusion vacuously satisfied.
 */
export type ProfessionalLinkState = 'linked' | 'no_account' | 'unknown'

/** A create action that returns the new `professional_profiles.id` on success. */
export interface CreateProfessionalProfileState extends ActionState {
  profileId?: string
}

// ---------------------------------------------------------------------------
// Input shapes (camelCase; the forms bind to these)
// ---------------------------------------------------------------------------

/** Fields accepted when linking a participant to a case in a role (ADR 0072 D6). */
export interface CaseParticipantInput {
  /** `participants.id` — the registry identity to link. */
  participantId: string
  /** `case_participant_roles.id` — the role to assign (type/role mismatch → `HC0E3`). */
  roleId: string
  /** Mark as the case's primary subject (≤1 live per case; `HC0E7`). Defaults false. */
  isPrimarySubject?: boolean
  /** Optional free-text involvement note; `null`/omitted = none. */
  involvementSummary?: string | null
}

/** Fields accepted when creating a Class-2 professional profile (ADR 0064 / 0072 D6). */
export interface ProfessionalProfileInput {
  /** Owning organization. */
  organizationId: string
  /** The professional's full name (LGPD personal data — Class 2, NOT patient PHI). */
  fullName: string
  professionalType?: string | null
  /** Council registration (CRM); `null` if unknown / account-less. */
  licenseNumber?: string | null
  licenseRegion?: string | null
  specialty?: string | null
  affiliationStatus?: string | null
  /**
   * The platform user behind this professional, when they have an account (the m2
   * respondent-self-read hook). `null` for external / former / account-less.
   */
  userId?: string | null
}

/** Fields accepted when correcting a professional profile (LGPD Art. 18 correction;
 * ADR 0072 §7 — a `dispose_*`/erasure path is deliberately NOT provided at E1). */
export type ProfessionalProfilePatch = Partial<
  Omit<ProfessionalProfileInput, 'organizationId'>
>

// ---------------------------------------------------------------------------
// Not-implemented stub helper (BE-1). References every arg so the frozen param
// names stay lint-clean; BE-5 replaces each body with the real RPC call.
// ---------------------------------------------------------------------------

function notImplemented(fn: string, ..._args: unknown[]): never {
  throw new Error(`${fn} not implemented (ETH·E1 BE-5 — contract stub)`)
}

// ---------------------------------------------------------------------------
// Participant write authority (D6) — DEFINER RPCs, coordinator-gated
// ---------------------------------------------------------------------------

/** Link a participant to a case in a role (`add_case_participant`). Returns the new
 * `case_participants.id`. Coordinator-gated; `HC0E3` on a type/role mismatch. */
export async function addCaseParticipant(
  caseId: string,
  input: CaseParticipantInput,
): Promise<AddParticipantState> {
  return notImplemented('addCaseParticipant', caseId, input)
}

/** Soft-remove a case participant (`remove_case_participant`; sets `removed_at`). */
export async function removeCaseParticipant(
  caseParticipantId: string,
): Promise<ActionState> {
  return notImplemented('removeCaseParticipant', caseParticipantId)
}

/** Flip a participant to the case's primary subject (`set_primary_subject`; `HC0E7`). */
export async function setPrimarySubject(
  caseParticipantId: string,
): Promise<ActionState> {
  return notImplemented('setPrimarySubject', caseParticipantId)
}

/** Change a participant's role (`set_case_participant_role`; `HC0E3` on mismatch). */
export async function setCaseParticipantRole(
  caseParticipantId: string,
  roleId: string,
): Promise<ActionState> {
  return notImplemented('setCaseParticipantRole', caseParticipantId, roleId)
}

// ---------------------------------------------------------------------------
// Professional-profile writers (D6) — E0 shipped only readers
// ---------------------------------------------------------------------------

/** Create a Class-2 professional profile (`create_professional_profile`). Returns id. */
export async function createProfessionalProfile(
  input: ProfessionalProfileInput,
): Promise<CreateProfessionalProfileState> {
  return notImplemented('createProfessionalProfile', input)
}

/** Correct a professional profile (`update_professional_profile`; audited
 * `professional_profile.updated`). LGPD Art. 18 CORRECTION only — no erasure at E1
 * (retention-pinned; ADR 0072 §7). */
export async function updateProfessionalProfile(
  profileId: string,
  patch: ProfessionalProfilePatch,
): Promise<ActionState> {
  return notImplemented('updateProfessionalProfile', profileId, patch)
}

/**
 * B7 — resolve a professional's platform-account linkage
 * (`set_professional_link_state`; audited `professional_profile.link_state_changed`).
 *
 * Deliberately NOT folded into `updateProfessionalProfile`: this is the only write
 * that touches the case-exclusion plane, so it keeps its own audited door while
 * routine LGPD Art. 18 corrections stay clear of it.
 *
 * Why the UI needs this (ADR 0078 M1·1): `app.is_case_respondent` matches on
 * `professional_profiles.user_id`, so a profile whose linkage is `unknown` is
 * silently NOT excluded from its own case. `add_case_participant` /
 * `setCaseParticipantRole` therefore REJECT an `unknown` profile as
 * `respondent_doctor` with `HC0F0` — and this action is the coordinator's only
 * remedy for that rejection. A seating flow that cannot reach it is a dead end.
 *
 * - `linked` requires `userId`; `no_account` / `unknown` require it to be absent.
 * - `no_account` is an AUDITED HUMAN ASSERTION that no platform account exists —
 *   it makes the exclusion vacuously satisfied, so it must never be a default.
 * - Frozen once the professional is a live respondent on any case (`HC0F2`): the
 *   linkage cannot be dissolved out from under an active exclusion.
 */
export async function setProfessionalLinkState(
  profileId: string,
  linkState: ProfessionalLinkState,
  userId?: string,
): Promise<ActionState> {
  return notImplemented('setProfessionalLinkState', profileId, linkState, userId)
}

// Re-export the union type the participant forms bind to, so a form importing an
// action also gets its enum from one module.
export type { ParticipantType }
