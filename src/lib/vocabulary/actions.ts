'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import type { CaseTypeTermKey } from '@/lib/cases/terminology'
import type { ParticipantType } from '@/lib/queries/cases'

/**
 * Org-level vocabulary admin (ETH·E4 §4): `case_participant_roles` and
 * `case_type_terminology`.
 *
 * NO DEFINER RPC, by the same reasoning as `src/lib/case-types/actions.ts`: both
 * tables already carry an org-admin `FOR ALL` policy plus the matching
 * `authenticated` grants, so an RLS-scoped write IS the door (Architecture Rule 1).
 * Each action still re-checks org-admin server-side first, so a refusal reads as a
 * clean pt-BR message rather than a bare PostgREST 42501 (Rule 10 / CLAUDE.md §8).
 *
 * ⚠ AUDIT (Rule 11). `case_participant_roles` has carried
 * `trg_audit_case_participant_role` since it shipped. `case_type_terminology` had
 * NO trigger at all, and no function anywhere wrote it — these actions are its first
 * write path, so migration `20260919000500` adds the mirror trigger. Plan §4's
 * "frontend-only — no substrate work" was true for authorization and false for
 * auditability; without that migration this module would be an unaudited mutation
 * surface on org vocabulary.
 *
 * ⚠ `getCaseTypeTerminology(null)` must keep resolving BYTE-FOR-BYTE to the platform
 * defaults — every non-Ethics case depends on that fallback. Nothing here can reach
 * it: a `case_type_terminology` row is keyed to a real `case_type_id` (NOT NULL), so
 * the null-type path never reads this table.
 */

export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/** The five non-patient registry types a role may accept, plus `patient`. */
const PARTICIPANT_TYPES: readonly ParticipantType[] = [
  'patient',
  'professional',
  'external_person',
  'department',
  'institution',
  'regulatory_body',
  'other',
] as const

const TERM_KEYS: readonly CaseTypeTermKey[] = [
  'case',
  'primary_subject',
  'timeline',
  'document',
  'decision',
] as const

const MESSAGES = {
  forbidden: 'Apenas a administração da organização pode editar o vocabulário.',
  missingOrg: 'Organização não informada.',
  missingCaseType: 'Tipo de caso não informado.',
  keyRequired: 'Informe a chave do papel.',
  keyFormat: 'A chave deve conter apenas letras minúsculas, números e underscore.',
  labelRequired: 'Informe o nome exibido.',
  typesRequired: 'Selecione ao menos um tipo de participante.',
  typeInvalid: 'Tipo de participante inválido.',
  termKeyInvalid: 'Slot de terminologia inválido.',
  singularRequired: 'Informe o rótulo no singular.',
  duplicateKey: 'Já existe um papel com esta chave nesta organização.',
  keyImmutable:
    'A chave do papel não pode ser alterada. Desative este papel e crie outro.',
  created: 'Papel criado.',
  updated: 'Papel atualizado.',
  activated: 'Papel reativado.',
  deactivated: 'Papel desativado.',
  termSaved: 'Terminologia atualizada.',
  generic: 'Não foi possível concluir a operação. Tente novamente.',
} as const

const KEY_RE = /^[a-z][a-z0-9_]*$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A create/update input for one `case_participant_roles` row. */
export interface CaseParticipantRoleInput {
  /** Stable key (`respondent_doctor`, `complainant`, …); immutable once in use. */
  key: string
  /** pt-BR label shown in every role select. */
  displayName: string
  /** The participant types this role accepts; `add_case_participant` enforces it. */
  allowedParticipantTypes: ParticipantType[]
  isPrimarySubjectCandidate: boolean
  /** `null` = an org-wide role; set to scope it to one case type. */
  caseTypeId?: string | null
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

/** One overridable terminology slot for a case type. */
export interface CaseTypeTerminologyInput {
  singularLabel: string
  pluralLabel?: string | null
  helpText?: string | null
}

async function authorizeOrg(organizationId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.orgAdminOf.some((o) => o.organization.id === organizationId)
}

function revalidateVocabulary() {
  revalidatePath('/o/[org]/manage/tipos-de-caso', 'page')
  revalidatePath('/o/[org]/c/[commission]/manage/cases', 'layout')
}

function mapVocabularyError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case '23505':
      return MESSAGES.duplicateKey
    case '42501':
      return MESSAGES.forbidden
    // `trg_guard_case_participant_role_key` (BEFORE UPDATE) refuses ANY key change —
    // catalog-verified: the predicate is `new.key is distinct from old.key`, with no
    // in-use test, because `app.is_case_respondent` resolves the exclusion through
    // `key = 'respondent_doctor'`. A rename would silently dissolve a live deny.
    case 'HC0F3':
      return error.message || MESSAGES.keyImmutable
    default:
      return error.message || MESSAGES.generic
  }
}

function validateRole(input: CaseParticipantRoleInput): Record<string, string> | null {
  const errors: Record<string, string> = {}
  const key = input.key?.trim() ?? ''
  if (!key) errors.key = MESSAGES.keyRequired
  else if (!KEY_RE.test(key)) errors.key = MESSAGES.keyFormat
  if (!input.displayName?.trim()) errors.displayName = MESSAGES.labelRequired
  const types = input.allowedParticipantTypes ?? []
  if (types.length === 0) errors.allowedParticipantTypes = MESSAGES.typesRequired
  else if (types.some((t) => !PARTICIPANT_TYPES.includes(t))) {
    errors.allowedParticipantTypes = MESSAGES.typeInvalid
  }
  return Object.keys(errors).length > 0 ? errors : null
}

// ---------------------------------------------------------------------------
// `case_participant_roles`
// ---------------------------------------------------------------------------

/**
 * The ADMIN-side role list: active AND inactive, so a deactivated role stays
 * visible and reactivatable.
 *
 * Deliberately NOT the same read as `listCaseParticipantRoles` in
 * `src/lib/queries/participants.ts`, which is `is_active`-only and case-type-scoped
 * because it feeds the `Papel` SELECT. Two consumers, two questions.
 */
export async function listCaseParticipantRolesForAdmin(
  organizationId: string,
): Promise<CaseParticipantRoleAdminRow[]> {
  if (!organizationId || !UUID_RE.test(organizationId)) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('case_participant_roles')
    .select(
      'id, key, display_name, allowed_participant_types, is_primary_subject_candidate, is_active, case_type_id',
    )
    .eq('organization_id', organizationId)
    .order('is_active', { ascending: false })
    .order('display_name')

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

export async function createCaseParticipantRole(
  organizationId: string,
  input: CaseParticipantRoleInput,
): Promise<ActionState> {
  if (!organizationId) return { ok: false, error: MESSAGES.missingOrg }
  const fieldErrors = validateRole(input)
  if (fieldErrors) return { ok: false, fieldErrors }
  if (!(await authorizeOrg(organizationId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('case_participant_roles').insert({
    organization_id: organizationId,
    case_type_id: input.caseTypeId ?? null,
    key: input.key.trim(),
    display_name: input.displayName.trim(),
    allowed_participant_types: input.allowedParticipantTypes,
    is_primary_subject_candidate: input.isPrimarySubjectCandidate,
  })
  if (error) return { ok: false, error: mapVocabularyError(error) }

  revalidateVocabulary()
  return { ok: true, error: MESSAGES.created }
}

/**
 * Update a role.
 *
 * `key` IS sent, deliberately. `trg_guard_case_participant_role_key` refuses any
 * change to it (`HC0F3`) — the key is load-bearing for the case exclusion, which
 * resolves through `key = 'respondent_doctor'`. Dropping the field here instead
 * would make a rename look like it succeeded while nothing changed, which is the
 * worse failure; sending it surfaces the refusal as a pt-BR message.
 */
export async function updateCaseParticipantRole(
  organizationId: string,
  roleId: string,
  input: CaseParticipantRoleInput,
): Promise<ActionState> {
  if (!organizationId) return { ok: false, error: MESSAGES.missingOrg }
  if (!roleId) return { ok: false, error: MESSAGES.generic }
  const fieldErrors = validateRole(input)
  if (fieldErrors) return { ok: false, fieldErrors }
  if (!(await authorizeOrg(organizationId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('case_participant_roles')
    .update({
      key: input.key.trim(),
      display_name: input.displayName.trim(),
      allowed_participant_types: input.allowedParticipantTypes,
      is_primary_subject_candidate: input.isPrimarySubjectCandidate,
      case_type_id: input.caseTypeId ?? null,
    })
    .eq('id', roleId)
    .eq('organization_id', organizationId)
  if (error) return { ok: false, error: mapVocabularyError(error) }

  revalidateVocabulary()
  return { ok: true, error: MESSAGES.updated }
}

/**
 * Retire / reinstate a role. Deactivation is the ONLY removal offered: a role id is
 * referenced by `case_participants.role_id`, so deleting one would either fail on the
 * FK or orphan seated participants. `is_active = false` hides it from the pickers
 * while every historical seating keeps its label.
 */
export async function setCaseParticipantRoleActive(
  organizationId: string,
  roleId: string,
  isActive: boolean,
): Promise<ActionState> {
  if (!organizationId) return { ok: false, error: MESSAGES.missingOrg }
  if (!roleId) return { ok: false, error: MESSAGES.generic }
  if (!(await authorizeOrg(organizationId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('case_participant_roles')
    .update({ is_active: isActive })
    .eq('id', roleId)
    .eq('organization_id', organizationId)
  if (error) return { ok: false, error: mapVocabularyError(error) }

  revalidateVocabulary()
  return { ok: true, error: isActive ? MESSAGES.activated : MESSAGES.deactivated }
}

// ---------------------------------------------------------------------------
// `case_type_terminology`
// ---------------------------------------------------------------------------

/**
 * Upsert ONE terminology slot for a case type.
 *
 * One slot at a time, matching how the table is keyed and how
 * `getCaseTypeTerminology` merges: it resolves PER `term_key`, so a missing row falls
 * back to the platform default for THAT key alone. Writing the whole bundle would
 * turn "leave this slot at the default" into "pin the default", and a later change to
 * the platform default would then silently not reach these types.
 *
 * `organizationId` is taken (not derived) so the server-side org-admin re-check can
 * run before the write; RLS re-derives it through `case_types` regardless, so a
 * mismatched pair is refused by the policy, not trusted from the caller.
 */
export async function upsertCaseTypeTerminology(
  organizationId: string,
  caseTypeId: string,
  termKey: CaseTypeTermKey,
  input: CaseTypeTerminologyInput,
): Promise<ActionState> {
  if (!organizationId) return { ok: false, error: MESSAGES.missingOrg }
  if (!caseTypeId) return { ok: false, error: MESSAGES.missingCaseType }
  if (!TERM_KEYS.includes(termKey)) {
    return { ok: false, error: MESSAGES.termKeyInvalid }
  }
  const singular = input.singularLabel?.trim() ?? ''
  if (!singular) {
    return {
      ok: false,
      error: MESSAGES.singularRequired,
      fieldErrors: { singularLabel: MESSAGES.singularRequired },
    }
  }
  if (!(await authorizeOrg(organizationId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('case_type_terminology').upsert(
    {
      case_type_id: caseTypeId,
      term_key: termKey,
      singular_label: singular,
      plural_label: input.pluralLabel?.trim() || null,
      help_text: input.helpText?.trim() || null,
    },
    { onConflict: 'case_type_id,term_key' },
  )
  if (error) return { ok: false, error: mapVocabularyError(error) }

  revalidateVocabulary()
  return { ok: true, error: MESSAGES.termSaved }
}

/**
 * Clear one slot so it falls back to the platform default. A DELETE, not a write of
 * the default string: pinning the default would silently freeze the slot against any
 * future change to `DEFAULT_CASE_TERMINOLOGY`.
 */
export async function clearCaseTypeTerminology(
  organizationId: string,
  caseTypeId: string,
  termKey: CaseTypeTermKey,
): Promise<ActionState> {
  if (!organizationId) return { ok: false, error: MESSAGES.missingOrg }
  if (!caseTypeId) return { ok: false, error: MESSAGES.missingCaseType }
  if (!TERM_KEYS.includes(termKey)) {
    return { ok: false, error: MESSAGES.termKeyInvalid }
  }
  if (!(await authorizeOrg(organizationId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('case_type_terminology')
    .delete()
    .eq('case_type_id', caseTypeId)
    .eq('term_key', termKey)
  if (error) return { ok: false, error: mapVocabularyError(error) }

  revalidateVocabulary()
  return { ok: true, error: MESSAGES.termSaved }
}
