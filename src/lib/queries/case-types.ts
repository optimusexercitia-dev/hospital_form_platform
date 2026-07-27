import 'server-only'

import { createClient } from '@/lib/supabase/server'
import {
  DEFAULT_CASE_TERMINOLOGY,
  mergeCaseTypeTerminology,
  type CaseTypeTerminology,
  type CaseTypeTerminologyRow,
} from '@/lib/cases/terminology'
import type {
  CaseConfidentialityLevel,
  CaseType,
  CaseVisibilityPolicy,
  PrimarySubjectKind,
} from '@/lib/cases/case-types'

/**
 * Case-type terminology resolution (ADR 0064 Decision 4; ETH·E3a BE-6).
 *
 * The RLS-backed reader for `case_type_terminology`. The terminology TYPES + the
 * platform-default bundle + the pure merge live in the client-safe module
 * `@/lib/cases/terminology` (re-exported below for back-compat with the BE-1 contract
 * path); Client Components must value-import them from THERE, never from this
 * server-only module (BUG-FBE-005).
 */

export { DEFAULT_CASE_TERMINOLOGY } from '@/lib/cases/terminology'
export type {
  CaseTypeTerm,
  CaseTypeTerminology,
  CaseTypeTermKey,
} from '@/lib/cases/terminology'

/**
 * Lists an organization's case types (ADR 0064 D4) — the source for the process-template
 * "Tipo de caso" picker, the create-case dialog's processless picker, and the org-admin
 * manager. Ordinary RLS read: `case_types_select` gates on `app.is_org_member`, so a
 * non-member simply gets `[]`.
 *
 * `activeOnly` (the default) hides retired types from the PICKERS while the manager
 * passes `false` to list everything — a retired type keeps rendering wherever it is
 * already referenced (no cascade).
 */
export async function listCaseTypes(
  organizationId: string,
  { activeOnly = true }: { activeOnly?: boolean } = {},
): Promise<CaseType[]> {
  if (!organizationId) return []

  const supabase = await createClient()
  let query = supabase
    .from('case_types')
    .select(
      'id, organization_id, key, display_name, primary_subject_kind, ' +
        'default_visibility_policy, default_confidentiality_level, default_case_label, is_active',
    )
    .eq('organization_id', organizationId)

  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query
    .order('display_name', { ascending: true })
    .returns<CaseTypeRow[]>()

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    key: row.key,
    displayName: row.display_name,
    primarySubjectKind: row.primary_subject_kind as PrimarySubjectKind,
    defaultVisibilityPolicy: row.default_visibility_policy as CaseVisibilityPolicy,
    defaultConfidentialityLevel:
      row.default_confidentiality_level as CaseConfidentialityLevel,
    defaultCaseLabel: row.default_case_label,
    isActive: row.is_active,
  }))
}

/** The raw `case_types` row shape as selected above. */
interface CaseTypeRow {
  id: string
  organization_id: string
  key: string
  display_name: string
  primary_subject_kind: string
  default_visibility_policy: string
  default_confidentiality_level: string
  default_case_label: string | null
  is_active: boolean
}

/**
 * Resolves a case type's terminology bundle, merging its `case_type_terminology` rows
 * over {@link DEFAULT_CASE_TERMINOLOGY} per `term_key`. A null `caseTypeId`, an unknown
 * type, OR a type missing a given `term_key` all fall back deterministically to the
 * platform default (for that key). NEVER throws / NEVER returns null.
 *
 * Ordinary authenticated RLS read (NOT service-role / DEFINER): `case_type_terminology`
 * + `case_types` are SELECT-able by org members (verified — `case_type_terminology_select`
 * / `case_types_select` gate on `app.is_org_member`). A caller who cannot read the type's
 * rows simply gets the default bundle (fail-safe), never an error.
 */
export async function getCaseTypeTerminology(
  caseTypeId: string | null,
): Promise<CaseTypeTerminology> {
  if (!caseTypeId) return DEFAULT_CASE_TERMINOLOGY

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_type_terminology')
    .select('term_key, singular_label, plural_label, help_text')
    .eq('case_type_id', caseTypeId)
    .returns<CaseTypeTerminologyRow[]>()

  if (error || !data || data.length === 0) {
    // Type resolved but has no override rows (or unreadable) → default bundle, carrying
    // the id so callers still know the case is typed.
    return { ...DEFAULT_CASE_TERMINOLOGY, caseTypeId }
  }

  return mergeCaseTypeTerminology(caseTypeId, data)
}
