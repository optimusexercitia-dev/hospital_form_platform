import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { caseTypesEnabled } from '@/lib/queries/feature-flags'
import { getSessionContext } from '@/lib/queries/session'
import type { ParticipantType } from '@/lib/queries/cases'
import type { ProfessionalLinkState } from '@/lib/participants/actions'

/**
 * Participant-registry reads (ETH·E4 · ADR 0108 D4; Architecture Rule 9).
 *
 * BOTH lanes of the add-participant picker read through here, and BOTH are plain
 * **invoker-rights, RLS-scoped** queries — never a SECURITY DEFINER search door
 * (ADR 0091 Decision 3: a DEFINER search *replaces* RLS and re-derives the
 * perimeter by hand for no capability). The perimeters that apply, unchanged:
 *
 *   - `participants_select` — `app.is_org_member(organization_id) ∨ app.is_admin()`.
 *     Org-scoped for every non-patient type (ADR 0091 Decision 2). Backs the
 *     EXTERNAL lane.
 *   - `professional_profiles_select` — `app.can_read_professional_profile(id, auth.uid())`.
 *     Backs the PROFESSIONAL lane. ETH·E4 §1.4 widens that predicate with an
 *     org-manager disjunct; without it the picker is unusable, because today the
 *     gate resolves true only for a platform admin or for a professional ALREADY
 *     seated on a case the caller can read (ADR 0108 D5).
 *
 * ⚠ The professional lane searches `professional_profiles`, NOT `participants`.
 * A profile minted by `create_professional_profile` has **no registry row** until
 * it is first seated — `ensure_professional_participant` mints it lazily — so a
 * picker reading `participants` could never find an unseated professional and the
 * mint door's get-branch would be unreachable from the UI. That is why
 * `ParticipantSearchResult.participantId` is nullable on this lane: `null` means
 * "profile exists, registry identity not minted yet"; `addCaseParticipant`
 * resolves it via the mint door.
 *
 * The professional lane also matches on the LIVE `full_name` / `license_number`,
 * which is the accuracy ADR 0108 D5 exists for — two "João Silva" must be
 * distinguishable at the moment a coordinator seats a respondent.
 */

export type { ParticipantType, ProfessionalLinkState }

/**
 * One picker candidate. `participantType` says which lane produced it and which
 * of the professional-only fields are populated.
 */
export interface ParticipantSearchResult {
  /**
   * `participants.id` — the registry identity `add_case_participant` seats.
   *
   * `null` ONLY on the professional lane, for a profile that has never been
   * seated (no `professional_participants` row yet). `addCaseParticipant` mints
   * it through `ensure_professional_participant` when handed
   * `professionalProfileId`. Never `null` on the external lane.
   */
  participantId: string | null
  /**
   * The label to render. Professional lane: the LIVE
   * `professional_profiles.full_name`. External lane: `participants.display_name`.
   */
  displayName: string
  participantType: ParticipantType
  /** Professional lane only; `null` on the external lane. */
  professionalProfileId: string | null
  /** Professional lane only — the council registration (CRM). */
  licenseNumber: string | null
  /** Professional lane only — the CRM's UF. */
  licenseRegion: string | null
  /** Professional lane only. */
  specialty: string | null
  /** Professional lane only (`medico`, `enfermeiro`, …). */
  professionalType: string | null
  /**
   * Professional lane only — the platform-account linkage (ADR 0078 M1·1).
   * `unknown` cannot be seated as `respondent_doctor` (`HC0F0`); the picker
   * surfaces it so the coordinator resolves it inline instead of dead-ending.
   */
  linkState: ProfessionalLinkState | null
}

/** One selectable role for the `Papel` select (`case_participant_roles`). */
export interface CaseParticipantRoleOption {
  id: string
  /** Stable key (`respondent_doctor`, `complainant`, …). */
  key: string
  /** pt-BR label (`Médico denunciado`, `Denunciante`, …). */
  displayName: string
  /**
   * The participant types this role accepts. The UI filters the select to roles
   * matching the chosen participant's type, so `HC0E3` is unreachable in normal
   * use; `add_case_participant` enforces it regardless.
   */
  allowedParticipantTypes: ParticipantType[]
  isPrimarySubjectCandidate: boolean
  /** `null` for an org-wide role; set for a role scoped to one case type. */
  caseTypeId: string | null
}

// ⚠ `EXTERNAL_PARTICIPANT_TYPES` deliberately does NOT live here, and must not be
// re-exported from here either — a re-export still drags this module (and with it
// `@/lib/supabase/server`) into any client graph that touches it. It is a RUNTIME
// const consumed by the add-participant dialog, which is a Client Component, so its
// home is the client-safe `@/lib/forms/reference-constants` alongside
// `PARTICIPANT_TYPES` / `PARTICIPANT_TYPE_LABELS`. This module is `server-only`;
// everything it exports beyond that is a TYPE, which erases.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** PostgREST `ilike` pattern escape — `%`, `_` and `\` are wildcards there. */
function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

/**
 * Search participant candidates for the add-participant picker.
 *
 * Serves both lanes off one signature: pass `['professional']` for the
 * respondent/relator typeahead, or the non-sensitive types for the
 * external-reuse search. `patient` is never searchable here — patient identity
 * lives behind the audited PHI door (Rule 12), and `set_participant_patient` is
 * its only writer.
 *
 * Returns `[]` for a blank query rather than the whole org.
 */
export async function searchParticipants(
  organizationId: string,
  query: string,
  participantTypes: ParticipantType[],
): Promise<ParticipantSearchResult[]> {
  const term = query.trim()
  if (!organizationId || !UUID_RE.test(organizationId)) return []
  if (term.length < 2) return []

  const types = participantTypes.filter((t) => t !== 'patient')
  if (types.length === 0) return []

  const supabase = await createClient()
  const results: ParticipantSearchResult[] = []
  const pattern = likePattern(term)

  // ── Professional lane: profiles first (see the module header on why). ──────
  if (types.includes('professional')) {
    const { data: profiles, error } = await supabase
      .from('professional_profiles')
      .select(
        'id, full_name, professional_type, license_number, license_region, specialty, link_state',
      )
      .eq('organization_id', organizationId)
      .is('redacted_at', null)
      .or(`full_name.ilike.${pattern},license_number.ilike.${pattern}`)
      .order('full_name')
      .limit(20)

    // ⚠ THROW, never swallow. A discarded error returned `[]`, which the picker
    // renders identically to "no such professional" — and the coordinator's next
    // step from there is `não possui conta`, an audited human assertion that makes
    // the case exclusion VACUOUSLY SATISFIED (ADR 0108 D6). A failed search that
    // looks like an empty search silently disarms the impedimento. The caller
    // (`searchParticipantCandidates`) turns this into `ok: false`, so the UI can say
    // "a busca falhou" — a different sentence from "não encontrado".
    if (error) throw error

    const profileIds = (profiles ?? []).map((p) => p.id)
    const mintedByProfile = new Map<string, string>()
    if (profileIds.length > 0) {
      // Single-FK embed (`professional_participants → professional_profiles`) —
      // deliberately NOT an embed off `participants`, whose only FK here is the
      // COMPOSITE `(participant_id, participant_type)` one (PGRST201 shape).
      const { data: links, error: linkError } = await supabase
        .from('professional_participants')
        .select('participant_id, professional_profile_id')
        .in('professional_profile_id', profileIds)
      // Swallowing this would silently null every `participantId`, sending an
      // already-minted professional back down the create-new path and duplicating
      // the profile.
      if (linkError) throw linkError
      for (const l of links ?? []) {
        mintedByProfile.set(l.professional_profile_id, l.participant_id)
      }
    }

    for (const p of profiles ?? []) {
      results.push({
        participantId: mintedByProfile.get(p.id) ?? null,
        displayName: p.full_name,
        participantType: 'professional',
        professionalProfileId: p.id,
        licenseNumber: p.license_number,
        licenseRegion: p.license_region,
        specialty: p.specialty,
        professionalType: p.professional_type,
        linkState: (p.link_state as ProfessionalLinkState | null) ?? null,
      })
    }
  }

  // ── External lane: the registry itself, org-scoped by `participants_select`. ─
  const externalTypes = types.filter((t) => t !== 'professional')
  if (externalTypes.length > 0) {
    const { data: rows, error: externalError } = await supabase
      .from('participants')
      .select('id, display_name, participant_type')
      .eq('organization_id', organizationId)
      .in('participant_type', externalTypes)
      .ilike('display_name', pattern)
      .order('display_name')
      .limit(20)

    // Same reasoning as the professional lane: on the external lane a failed search
    // that renders as "no results" pushes the coordinator into create-always, which
    // duplicates a person already in the registry. ADR 0108 D8 accepts duplicates
    // from HUMAN CHOICE — not from a swallowed error.
    if (externalError) throw externalError

    for (const r of rows ?? []) {
      results.push({
        participantId: r.id,
        displayName: r.display_name,
        participantType: r.participant_type as ParticipantType,
        professionalProfileId: null,
        licenseNumber: null,
        licenseRegion: null,
        specialty: null,
        professionalType: null,
        linkState: null,
      })
    }
  }

  return results
}

/** One row of the admin-side role list (unlike the picker's, this includes inactive). */
export interface CaseParticipantRoleAdminRow {
  id: string
  key: string
  displayName: string
  allowedParticipantTypes: ParticipantType[]
  isPrimarySubjectCandidate: boolean
  isActive: boolean
  caseTypeId: string | null
}

/**
 * The ADMIN-side role list: active AND inactive, so a deactivated role stays
 * visible and reactivatable.
 *
 * Deliberately NOT the same read as {@link listCaseParticipantRoles} below, which
 * is `is_active`-only and case-type-scoped because it feeds the `Papel` SELECT.
 * Two consumers, two questions.
 *
 * Lives HERE, not in `src/lib/vocabulary/actions.ts` where it was written (QA m1):
 * it is a pure read, so Architecture Rule 9 puts it in `queries/`. The move is not
 * cosmetic — an exported async function in a `'use server'` module is published as
 * a callable Server-Action endpoint, and this one (alone among that file's exports)
 * never called `authorizeOrg`. It was bounded by RLS `is_org_member` so nothing
 * leaked across tenants, but it was reachable surface that had no reason to exist.
 */
export async function listCaseParticipantRolesForAdmin(
  organizationId: string,
): Promise<CaseParticipantRoleAdminRow[]> {
  if (!organizationId || !UUID_RE.test(organizationId)) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_participant_roles')
    .select(
      'id, key, display_name, allowed_participant_types, is_primary_subject_candidate, is_active, case_type_id',
    )
    .eq('organization_id', organizationId)
    .order('is_active', { ascending: false })
    .order('display_name')

  // ⚠ THROW. Swallowed, a failed read renders as "this org has no roles", which reads
  // as a clean empty state and invites an admin to re-create roles that already exist.
  if (error) throw error

  return (data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    displayName: r.display_name,
    allowedParticipantTypes: (r.allowed_participant_types ?? []) as ParticipantType[],
    isPrimarySubjectCandidate: r.is_primary_subject_candidate,
    isActive: r.is_active,
    caseTypeId: r.case_type_id,
  }))
}

/**
 * The active role vocabulary for a case: the org-wide roles plus the ones scoped
 * to this case's type. `case_participant_roles` is org-readable
 * (`is_org_member`), so this is a plain RLS-scoped read.
 */
export async function listCaseParticipantRoles(
  organizationId: string,
  caseTypeId: string | null,
): Promise<CaseParticipantRoleOption[]> {
  if (!organizationId || !UUID_RE.test(organizationId)) return []

  const supabase = await createClient()
  let q = supabase
    .from('case_participant_roles')
    .select(
      'id, key, display_name, allowed_participant_types, is_primary_subject_candidate, case_type_id',
    )
    .eq('organization_id', organizationId)
    .eq('is_active', true)

  // The raw `.or()` cursor value is interpolated into a PostgREST filter string —
  // validate it as a UUID first rather than trusting the caller (W1/W2 hardening).
  if (caseTypeId && UUID_RE.test(caseTypeId)) {
    q = q.or(`case_type_id.is.null,case_type_id.eq.${caseTypeId}`)
  } else {
    q = q.is('case_type_id', null)
  }

  const { data, error } = await q.order('display_name')
  // An empty role list disables the whole add-participant flow; it must not be
  // indistinguishable from a failed read.
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    displayName: r.display_name,
    allowedParticipantTypes: (r.allowed_participant_types ??
      []) as ParticipantType[],
    isPrimarySubjectCandidate: r.is_primary_subject_candidate,
    caseTypeId: r.case_type_id,
  }))
}

/**
 * The href of the org's participant-role vocabulary admin for THIS viewer, or
 * `null` when they cannot reach it. Feeds the add-participant dialog's "no role
 * accepts this type" empty state (PO ruling 2026-08-11).
 *
 * ⚠ It returns `null` far more often than "not an admin" suggests, and that is the
 * point: `/o/[org]/manage/tipos-de-caso` calls `notFound()` on **two** independent
 * gates — org_admin of this org (a hospital_admin does NOT reach it, ADR 0051 D1)
 * **and** the `case_types` flag — so both are re-evaluated here. Mirroring only one
 * ships a link that 404s. If that page's gates change, this function changes with
 * them; it is the only place in the case surfaces that predicts them.
 *
 * Deliberately NOT a capability check on `case_participant_roles` itself: the write
 * policy would admit a caller the *page* still refuses.
 */
export async function getParticipantRoleVocabularyHref(
  orgSlug: string,
): Promise<string | null> {
  if (!orgSlug) return null
  const [context, caseTypesOn] = await Promise.all([
    getSessionContext(),
    caseTypesEnabled(),
  ])
  if (!caseTypesOn) return null
  const isOrgAdminHere = (context?.orgAdminOf ?? []).some(
    (o) => o.organization.slug === orgSlug,
  )
  if (!isOrgAdminHere) return null
  return `/o/${encodeURIComponent(orgSlug)}/manage/tipos-de-caso`
}
