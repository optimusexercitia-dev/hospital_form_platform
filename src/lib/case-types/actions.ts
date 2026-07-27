'use server'

import { revalidatePath } from 'next/cache'

import {
  type CaseConfidentialityLevel,
  type CaseVisibilityPolicy,
  type PrimarySubjectKind,
  CONFIDENTIALITY_LEVELS,
  PRIMARY_SUBJECT_KINDS,
  VISIBILITY_POLICIES,
} from '@/lib/cases/case-types'
import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'

/**
 * Case-type server actions (ADR 0064 Decision 4) — the org-admin CRUD for the
 * `case_types` vocabulary a process template declares and a case snapshots.
 *
 * Unlike most catalogs here, these need NO DEFINER RPC: `case_types` already carries
 * `case_types_admin_write` (`FOR ALL`, gated on `app.is_admin() OR
 * app.is_org_admin_of(organization_id)`) plus the matching `authenticated` grants, so an
 * RLS-scoped write IS the door (Architecture Rule 1). Each action still re-checks
 * org-admin server-side first so a refusal reads as a clean pt-BR message instead of a
 * bare PostgREST 42501 (Rule 10 / CLAUDE.md §8).
 *
 * ⚠ These rows are ACCESS configuration, not decoration:
 * `default_visibility_policy` / `default_confidentiality_level` are inherited by every
 * case created from a template declaring the type. Widening a type's policy widens the
 * posture of cases created AFTERWARDS (existing cases keep their snapshot — no
 * retro-active change, matching the `case_outcomes` D11 propagation rule).
 */

export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/** A `create` / `update` case-type input. */
export interface CaseTypeInput {
  key: string
  displayName: string
  primarySubjectKind: PrimarySubjectKind
  defaultVisibilityPolicy: CaseVisibilityPolicy
  defaultConfidentialityLevel: CaseConfidentialityLevel
  defaultCaseLabel: string | null
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  missingOrg: 'Organização não encontrada.',
  missingType: 'Tipo de caso não encontrado.',
  keyRequired: 'Informe a chave do tipo de caso.',
  keyInvalid: 'Use apenas letras minúsculas, números e underscore (ex.: etica).',
  keyTaken: 'Já existe um tipo de caso com essa chave nesta organização.',
  nameRequired: 'Informe o nome do tipo de caso.',
  kindInvalid: 'Selecione um sujeito principal válido.',
  visibilityInvalid: 'Selecione uma visibilidade padrão válida.',
  confidentialityInvalid: 'Selecione um nível de confidencialidade válido.',
  created: 'Tipo de caso criado com sucesso.',
  updated: 'Tipo de caso atualizado.',
  archived: 'Tipo de caso desativado.',
  restored: 'Tipo de caso reativado.',
} as const

const PG_UNIQUE_VIOLATION = '23505'
const PG_INSUFFICIENT_PRIVILEGE = '42501'

/** Lowercase machine key: letters, digits, underscore; must start with a letter. */
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/

async function authorizeOrg(organizationId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.orgAdminOf.some((o) => o.organization.id === organizationId)
}

function mapCaseTypeError(error: { code?: string; message?: string } | null): string {
  if (!error) return MESSAGES.generic
  if (error.code === PG_UNIQUE_VIOLATION) return MESSAGES.keyTaken
  if (error.code === PG_INSUFFICIENT_PRIVILEGE) return MESSAGES.forbidden
  return MESSAGES.generic
}

/** Shared field validation for create + update. */
function validate(input: CaseTypeInput): Record<string, string> | null {
  const fieldErrors: Record<string, string> = {}
  const key = input.key.trim()

  if (!key) fieldErrors.key = MESSAGES.keyRequired
  else if (!KEY_PATTERN.test(key)) fieldErrors.key = MESSAGES.keyInvalid

  if (!input.displayName.trim()) fieldErrors.displayName = MESSAGES.nameRequired

  if (!PRIMARY_SUBJECT_KINDS.includes(input.primarySubjectKind)) {
    fieldErrors.primarySubjectKind = MESSAGES.kindInvalid
  }
  if (!VISIBILITY_POLICIES.includes(input.defaultVisibilityPolicy)) {
    fieldErrors.defaultVisibilityPolicy = MESSAGES.visibilityInvalid
  }
  if (!CONFIDENTIALITY_LEVELS.includes(input.defaultConfidentialityLevel)) {
    fieldErrors.defaultConfidentialityLevel = MESSAGES.confidentialityInvalid
  }

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null
}

function revalidateCaseTypes() {
  // The manager, plus every surface whose picker or inherited posture depends on the
  // vocabulary (template editor, create-case dialog).
  revalidatePath('/o/[org]/manage/tipos-de-caso', 'page')
  revalidatePath('/o/[org]/c/[commission]/manage/process-templates', 'layout')
  revalidatePath('/o/[org]/c/[commission]/manage/cases', 'layout')
}

/** Create an org-scoped case type. Org-admin only. */
export async function createCaseType(
  organizationId: string,
  input: CaseTypeInput,
): Promise<ActionState> {
  if (!organizationId) return { ok: false, error: MESSAGES.missingOrg }

  const fieldErrors = validate(input)
  if (fieldErrors) return { ok: false, fieldErrors }

  if (!(await authorizeOrg(organizationId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('case_types').insert({
    organization_id: organizationId,
    key: input.key.trim(),
    display_name: input.displayName.trim(),
    primary_subject_kind: input.primarySubjectKind,
    default_visibility_policy: input.defaultVisibilityPolicy,
    default_confidentiality_level: input.defaultConfidentialityLevel,
    default_case_label: input.defaultCaseLabel?.trim() || null,
  })

  if (error) return { ok: false, error: mapCaseTypeError(error) }

  revalidateCaseTypes()
  return { ok: true, error: MESSAGES.created }
}

/**
 * Update a case type. Org-admin only.
 *
 * The org is re-read from the ROW (not taken from the caller) so the authz check can't
 * be steered by a forged organizationId; RLS would refuse anyway, but this keeps the
 * refusal a clean pt-BR message.
 */
export async function updateCaseType(
  caseTypeId: string,
  input: CaseTypeInput,
): Promise<ActionState> {
  if (!caseTypeId) return { ok: false, error: MESSAGES.missingType }

  const fieldErrors = validate(input)
  if (fieldErrors) return { ok: false, fieldErrors }

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('case_types')
    .select('organization_id')
    .eq('id', caseTypeId)
    .maybeSingle<{ organization_id: string }>()

  if (!row) return { ok: false, error: MESSAGES.missingType }
  if (!(await authorizeOrg(row.organization_id))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase
    .from('case_types')
    .update({
      key: input.key.trim(),
      display_name: input.displayName.trim(),
      primary_subject_kind: input.primarySubjectKind,
      default_visibility_policy: input.defaultVisibilityPolicy,
      default_confidentiality_level: input.defaultConfidentialityLevel,
      default_case_label: input.defaultCaseLabel?.trim() || null,
    })
    .eq('id', caseTypeId)

  if (error) return { ok: false, error: mapCaseTypeError(error) }

  revalidateCaseTypes()
  return { ok: true, error: MESSAGES.updated }
}

/**
 * Retire / restore a case type (`is_active`). Retiring hides it from the pickers but
 * does NOT touch templates or cases already referencing it — an existing case keeps the
 * posture it snapshotted at creation, and a template keeps its declaration until an
 * admin clears it.
 */
export async function setCaseTypeActive(
  caseTypeId: string,
  isActive: boolean,
): Promise<ActionState> {
  if (!caseTypeId) return { ok: false, error: MESSAGES.missingType }

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('case_types')
    .select('organization_id')
    .eq('id', caseTypeId)
    .maybeSingle<{ organization_id: string }>()

  if (!row) return { ok: false, error: MESSAGES.missingType }
  if (!(await authorizeOrg(row.organization_id))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase
    .from('case_types')
    .update({ is_active: isActive })
    .eq('id', caseTypeId)

  if (error) return { ok: false, error: mapCaseTypeError(error) }

  revalidateCaseTypes()
  return { ok: true, error: isActive ? MESSAGES.restored : MESSAGES.archived }
}
