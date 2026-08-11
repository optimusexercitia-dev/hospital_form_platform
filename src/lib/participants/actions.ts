'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { searchParticipants } from '@/lib/queries/participants'
import type { ParticipantSearchResult } from '@/lib/queries/participants'
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
 * The BE-1 signatures below are the FROZEN contract the E2/E3/E4 ethics UI binds to;
 * ETH·E4 implements the bodies without changing any of them. All user-facing strings
 * are pt-BR (Rule 10); raw Postgres errors never reach the UI (CLAUDE.md §8). Reads
 * live in `src/lib/queries/cases.ts` and `src/lib/queries/participants.ts` (Rule 9).
 *
 * ETH·E4 adds two exports, both additive:
 *   - `createExternalParticipant` — the external/institutional mint lane (ADR 0108 D8).
 *   - `searchParticipantCandidates` — the typeahead transport for the client dialog,
 *     mirroring `searchReferenceCandidates` in `src/lib/responses/actions.ts`. A
 *     NAMED action from a `'use server'` module, deliberately: passing a server
 *     function down as a prop to a Client Component is the shape that produced
 *     BUG-QI-001 twice.
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
  /**
   * `participants.id` — the registry identity to link. Required UNLESS
   * `professionalProfileId` is given (ETH·E4), in which case the registry identity
   * is resolved from the profile.
   */
  participantId?: string
  /**
   * ETH·E4 (ADR 0108 D1): `professional_profiles.id` for the professional lane.
   *
   * A professional profile has NO `participants` row until it is first seated, so
   * the picker can only ever hand back a profile id for an unseated professional.
   * When this is set, the action calls `ensure_professional_participant` to
   * get-or-create the registry identity and seats THAT — which is why the two
   * lanes share one action instead of two.
   */
  professionalProfileId?: string | null
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
// pt-BR error mapping (locator contract §6). RAW POSTGRES ERRORS NEVER REACH THE
// UI (CLAUDE.md §8) — every RPC below funnels through `mapParticipantError`.
//
// Each RPC raises its own pt-BR message, which is more specific than the generic
// constant, so the message is preferred and the constant is the fallback for the
// case where PostgREST hands back an empty message.
//
// ⚠ WHICH ARMS MAY PREFER `error.message` IS A MEASURED PROPERTY, NOT A STYLE
// CHOICE — and it was re-derived FROM THE CATALOG (`pg_proc.prosrc`), because QA
// r2 filed the opposite conclusion from a premise the catalog contradicts. The
// rule is: prefer `error.message` only where the SQLSTATE cannot also be raised
// by the ENGINE, because every engine message is English and CLAUDE.md §8 forbids
// raw Postgres text in the UI.
//
//   HC* (custom SQLSTATEs) — SAFE to prefer. A custom code cannot originate in the
//     engine; only our own `raise … using errcode` produces it. Always pt-BR.
//   P0002            — SAFE to prefer. Six doors raise it deliberately in pt-BR
//     (`set_primary_subject`, `set_case_participant_role` ×2,
//     `update_professional_profile`, `set_professional_link_state`,
//     `ensure_professional_participant`, `create_external_participant`) with text
//     strictly better than `notFound` ("papel inválido", "organização não
//     informada"). The engine raises P0002 only via `SELECT … INTO STRICT`, of
//     which `public`/`app` contain ZERO occurrences.
//   42501 and 23514  — NOT safe. MIXED: our doors raise them in pt-BR *and* the
//     engine raises them in English on the very same code, so the message alone
//     cannot tell them apart. Both therefore return the constant. See below.
// ---------------------------------------------------------------------------

const MESSAGES = {
  generic: 'Não foi possível concluir a operação. Tente novamente.',
  forbidden: 'Você não tem permissão para esta ação.',
  roleTypeMismatch: 'Papel inválido para o tipo de participante.',
  primaryExists: 'Já existe um sujeito principal ativo neste caso.',
  linkageUnresolved:
    'Resolva o vínculo de conta deste profissional antes de indicá-lo como denunciado.',
  caseExcluded: 'Você está impedido neste caso e não pode exercer a coordenação sobre ele.',
  linkageFrozen:
    'O vínculo deste profissional está congelado enquanto ele for denunciado em um caso ativo.',
  notFound: 'Registro não encontrado.',
  missingParticipant: 'Selecione um participante.',
  missingRole: 'Selecione um papel.',
  missingProfile: 'Profissional não informado.',
  missingOrg: 'Organização não informada.',
  nameRequired: 'Informe o nome.',
  linkedNeedsUser: 'Selecione o usuário da plataforma para vincular este profissional.',
  unlinkedTakesNoUser:
    'Um profissional sem conta na plataforma não pode ser vinculado a um usuário.',
} as const

/** SQLSTATEs the participant/professional doors raise (ADR 0072 D6 · 0078 M1 · 0108). */
const HC_ROLE_TYPE_MISMATCH = 'HC0E3'
const HC_NOT_COORDINATOR = 'HC0E4'
const HC_PRIMARY_EXISTS = 'HC0E7'
const HC_LINKAGE_UNRESOLVED = 'HC0F0'
const HC_CASE_EXCLUDED = 'HC0F1'
const HC_LINKAGE_FROZEN = 'HC0F2'
const PG_INSUFFICIENT_PRIVILEGE = '42501'
const PG_CHECK_VIOLATION = '23514'
const PG_NO_DATA_FOUND = 'P0002'

function mapParticipantError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case HC_ROLE_TYPE_MISMATCH:
      return error.message || MESSAGES.roleTypeMismatch
    case HC_NOT_COORDINATOR:
      return error.message || MESSAGES.forbidden
    case HC_PRIMARY_EXISTS:
      return error.message || MESSAGES.primaryExists
    case HC_LINKAGE_UNRESOLVED:
      return error.message || MESSAGES.linkageUnresolved
    case HC_CASE_EXCLUDED:
      return error.message || MESSAGES.caseExcluded
    case HC_LINKAGE_FROZEN:
      return error.message || MESSAGES.linkageFrozen
    case PG_NO_DATA_FOUND:
      // SAFE — see the header: deliberately raised in pt-BR by six doors, and
      // unreachable from the engine (no `INTO STRICT` in `public`/`app`).
      return error.message || MESSAGES.notFound
    case PG_INSUFFICIENT_PRIVILEGE:
      // MIXED, so the constant ALWAYS. Three doors raise 42501 in pt-BR
      // ("apenas a coordenação … pode registrar profissionais"), but the engine
      // raises it too — measured: `new row violates row-level security policy for
      // table "organizations"`, plus `permission denied for …` from the GRANT
      // layer. Preferring the message would leak that English into the UI.
      // (The previous comment here described a "prefer the constant only when the
      // message looks like one" test that the code never implemented.)
      return MESSAGES.forbidden
    case PG_CHECK_VIOLATION:
      // MIXED, so the constant ALWAYS — this arm was the one real §8 leak.
      // `create_professional_profile` / `create_external_participant` raise 23514
      // in pt-BR, but a genuine CHECK violation on any table they write yields
      // the engine's English `new row for relation "…" violates check constraint
      // "…"` (measured). Nothing user-visible is lost: the two pt-BR raises are
      // "informe o nome …" / "tipo … inválido", which `createProfessionalProfile`
      // and `createExternalParticipant` already reject BEFORE the RPC with
      // `MESSAGES.nameRequired` + a `fieldErrors` entry, so the door's raise is a
      // defence-in-depth backstop a user does not reach.
      return MESSAGES.generic
    default:
      return MESSAGES.generic
  }
}

const CASES_LIST_PATH = '/o/[org]/c/[commission]/manage/cases'
const CASE_PATH = '/o/[org]/c/[commission]/manage/cases/[caseId]'

function revalidateCases() {
  revalidatePath(CASES_LIST_PATH, 'page')
  revalidatePath(CASE_PATH, 'page')
}

// ---------------------------------------------------------------------------
// Participant write authority (D6) — DEFINER RPCs, coordinator-gated
// ---------------------------------------------------------------------------

/**
 * Link a participant to a case in a role (`add_case_participant`). Returns the new
 * `case_participants.id`. Coordinator-gated; `HC0E3` on a type/role mismatch.
 *
 * ETH·E4: when handed `professionalProfileId` it first calls
 * `ensure_professional_participant` to get-or-create the registry identity — the
 * professional lane's only path, since an unseated professional has no
 * `participants` row for the picker to return.
 */
export async function addCaseParticipant(
  caseId: string,
  input: CaseParticipantInput,
): Promise<AddParticipantState> {
  if (!caseId) return { ok: false, error: MESSAGES.notFound }
  if (!input.roleId) {
    return { ok: false, error: MESSAGES.missingRole, fieldErrors: { roleId: MESSAGES.missingRole } }
  }
  if (!input.participantId && !input.professionalProfileId) {
    return {
      ok: false,
      error: MESSAGES.missingParticipant,
      fieldErrors: { participantId: MESSAGES.missingParticipant },
    }
  }

  const supabase = await createClient()

  let participantId = input.participantId ?? ''
  if (input.professionalProfileId) {
    const { data: minted, error: mintError } = await supabase.rpc(
      'ensure_professional_participant',
      { p_profile_id: input.professionalProfileId },
    )
    if (mintError) return { ok: false, error: mapParticipantError(mintError) }
    if (!minted) return { ok: false, error: MESSAGES.generic }
    participantId = minted
  }

  const { data, error } = await supabase.rpc('add_case_participant', {
    p_case_id: caseId,
    p_participant_id: participantId,
    p_role_id: input.roleId,
    p_is_primary_subject: input.isPrimarySubject ?? false,
    // The generated arg type is `string | undefined`; the RPC applies
    // `nullif(btrim(...), '')`, so an omitted summary lands as SQL NULL anyway.
    p_involvement_summary: input.involvementSummary ?? undefined,
  })
  if (error) return { ok: false, error: mapParticipantError(error) }

  revalidateCases()
  return { ok: true, caseParticipantId: data ?? undefined }
}

/** Soft-remove a case participant (`remove_case_participant`; sets `removed_at`). */
export async function removeCaseParticipant(
  caseParticipantId: string,
): Promise<ActionState> {
  if (!caseParticipantId) return { ok: false, error: MESSAGES.notFound }

  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_case_participant', {
    p_case_participant_id: caseParticipantId,
  })
  if (error) return { ok: false, error: mapParticipantError(error) }

  revalidateCases()
  return { ok: true }
}

/**
 * Designate a participant as the case's primary subject (`set_primary_subject`).
 *
 * ETH·E4 (ADR 0108 D2) made this door MOVE the designation off any incumbent, so
 * `HC0E7` is no longer the normal outcome of re-designating — it survives only as
 * the partial-unique backstop. `HC0F0` is now reachable here too: a promotion is a
 * respondent designation, and an unresolved linkage is refused.
 */
export async function setPrimarySubject(
  caseParticipantId: string,
): Promise<ActionState> {
  if (!caseParticipantId) return { ok: false, error: MESSAGES.notFound }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_primary_subject', {
    p_case_participant_id: caseParticipantId,
  })
  if (error) return { ok: false, error: mapParticipantError(error) }

  revalidateCases()
  return { ok: true }
}

/** Change a participant's role (`set_case_participant_role`; `HC0E3` on mismatch). */
export async function setCaseParticipantRole(
  caseParticipantId: string,
  roleId: string,
): Promise<ActionState> {
  if (!caseParticipantId) return { ok: false, error: MESSAGES.notFound }
  if (!roleId) {
    return { ok: false, error: MESSAGES.missingRole, fieldErrors: { roleId: MESSAGES.missingRole } }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_case_participant_role', {
    p_case_participant_id: caseParticipantId,
    p_role_id: roleId,
  })
  if (error) return { ok: false, error: mapParticipantError(error) }

  revalidateCases()
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Registry mint lanes (ETH·E4 · ADR 0108 D1 / D8)
// ---------------------------------------------------------------------------

/**
 * Mint a non-sensitive EXTERNAL participant (`create_external_participant`).
 * Returns the new `participants.id`.
 *
 * CREATE-ALWAYS by design (ADR 0108 D8): an external person has no natural key,
 * and deduplicating on display name would silently merge two distinct same-named
 * people. The dialog searches existing external participants first — reuse is a
 * human choice, not an inferred one.
 */
export async function createExternalParticipant(
  organizationId: string,
  participantType: string,
  displayName: string,
): Promise<ActionState & { participantId?: string }> {
  if (!organizationId) return { ok: false, error: MESSAGES.missingOrg }
  const name = displayName?.trim() ?? ''
  if (!name) {
    return {
      ok: false,
      error: MESSAGES.nameRequired,
      fieldErrors: { displayName: MESSAGES.nameRequired },
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_external_participant', {
    p_org: organizationId,
    p_type: participantType,
    p_display_name: name,
  })
  if (error) return { ok: false, error: mapParticipantError(error) }

  revalidateCases()
  return { ok: true, participantId: data ?? undefined }
}

/**
 * Typeahead transport for the add-participant dialog's client island.
 *
 * A thin wrapper over the RLS-scoped `searchParticipants` query (Rule 9 keeps the
 * data access there, not here). Never throws at the UI: a failed search returns an
 * empty candidate list plus a pt-BR message.
 */
export async function searchParticipantCandidates(
  organizationId: string,
  query: string,
  participantTypes: ParticipantType[],
): Promise<ActionState & { candidates: ParticipantSearchResult[] }> {
  if (!organizationId) return { ok: false, error: MESSAGES.missingOrg, candidates: [] }
  try {
    const candidates = await searchParticipants(organizationId, query, participantTypes)
    return { ok: true, candidates }
  } catch {
    return { ok: false, error: MESSAGES.generic, candidates: [] }
  }
}

// ---------------------------------------------------------------------------
// Professional-profile writers (D6) — E0 shipped only readers
// ---------------------------------------------------------------------------

/** Create a Class-2 professional profile (`create_professional_profile`). Returns id. */
export async function createProfessionalProfile(
  input: ProfessionalProfileInput,
): Promise<CreateProfessionalProfileState> {
  if (!input.organizationId) return { ok: false, error: MESSAGES.missingOrg }
  const fullName = input.fullName?.trim() ?? ''
  if (!fullName) {
    return {
      ok: false,
      error: MESSAGES.nameRequired,
      fieldErrors: { fullName: MESSAGES.nameRequired },
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_professional_profile', {
    p_org: input.organizationId,
    p_full_name: fullName,
    p_professional_type: input.professionalType ?? undefined,
    p_license_number: input.licenseNumber ?? undefined,
    p_license_region: input.licenseRegion ?? undefined,
    p_specialty: input.specialty ?? undefined,
    p_affiliation_status: input.affiliationStatus ?? undefined,
    p_user_id: input.userId ?? undefined,
  })
  if (error) return { ok: false, error: mapParticipantError(error) }

  revalidateCases()
  return { ok: true, profileId: data ?? undefined }
}

/** Correct a professional profile (`update_professional_profile`; audited
 * `professional_profile.updated`). LGPD Art. 18 CORRECTION only — no erasure at E1
 * (retention-pinned; ADR 0072 §7). */
export async function updateProfessionalProfile(
  profileId: string,
  patch: ProfessionalProfilePatch,
): Promise<ActionState> {
  if (!profileId) return { ok: false, error: MESSAGES.missingProfile }

  const supabase = await createClient()
  // `update_professional_profile` has NO `p_user_id` parameter by design (ADR 0078
  // M1·1 / A31·5): the linkage plane is `setProfessionalLinkState`'s alone, so a
  // routine LGPD Art. 18 correction can never move a case exclusion. `patch.userId`
  // is therefore deliberately NOT forwarded here.
  const { error } = await supabase.rpc('update_professional_profile', {
    p_profile_id: profileId,
    p_full_name: patch.fullName?.trim() || undefined,
    p_professional_type: patch.professionalType ?? undefined,
    p_license_number: patch.licenseNumber ?? undefined,
    p_license_region: patch.licenseRegion ?? undefined,
    p_specialty: patch.specialty ?? undefined,
    p_affiliation_status: patch.affiliationStatus ?? undefined,
  })
  if (error) return { ok: false, error: mapParticipantError(error) }

  revalidateCases()
  return { ok: true }
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
  if (!profileId) return { ok: false, error: MESSAGES.missingProfile }

  // Mirror the two schema CHECKs client-side so the user gets a field-level pt-BR
  // message instead of a 23514 the mapper can only render generically:
  //   (link_state = 'linked') = (user_id is not null)
  if (linkState === 'linked' && !userId) {
    return {
      ok: false,
      error: MESSAGES.linkedNeedsUser,
      fieldErrors: { userId: MESSAGES.linkedNeedsUser },
    }
  }
  if (linkState !== 'linked' && userId) {
    return { ok: false, error: MESSAGES.unlinkedTakesNoUser }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_professional_link_state', {
    p_profile_id: profileId,
    p_link_state: linkState,
    p_user_id: userId ?? undefined,
  })
  if (error) return { ok: false, error: mapParticipantError(error) }

  revalidateCases()
  return { ok: true }
}

// Re-export the union type the participant forms bind to, so a form importing an
// action also gets its enum from one module.
export type { ParticipantType }
