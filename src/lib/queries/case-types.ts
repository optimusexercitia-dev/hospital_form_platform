import 'server-only'

import { createClient } from '@/lib/supabase/server'
import {
  DEFAULT_CASE_TERMINOLOGY,
  mergeCaseTypeTerminology,
  type CaseTypeTerminology,
  type CaseTypeTerminologyRow,
} from '@/lib/cases/terminology'

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
