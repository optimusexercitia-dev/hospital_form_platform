/**
 * Case-type terminology — PURE, client-safe module (ADR 0064 D4; ETH·E3a).
 *
 * Holds the terminology types + the platform-default bundle + the pure merge, with NO
 * server import, so a Client Component may value-import `DEFAULT_CASE_TERMINOLOGY` /
 * `mergeCaseTypeTerminology` without dragging the server Supabase client into the client
 * bundle (BUG-FBE-005: a client value-import from a server-tainted module aborts
 * `next build`). The RLS-backed reader lives in the server module
 * `@/lib/queries/case-types` (`getCaseTypeTerminology`), which imports this module.
 */

/** The five overridable UI label slots (`case_type_terminology.term_key`). */
export interface CaseTypeTerm {
  singular: string
  plural: string | null
  helpText: string | null
}

export interface CaseTypeTerminology {
  /** The resolved case type, or `null` for the PLATFORM-DEFAULT bundle (no type / no rows). */
  caseTypeId: string | null
  case: CaseTypeTerm
  primarySubject: CaseTypeTerm
  timeline: CaseTypeTerm
  document: CaseTypeTerm
  decision: CaseTypeTerm
}

/** The five term keys (matches `case_type_terminology.term_key`). */
export type CaseTypeTermKey =
  | 'case'
  | 'primary_subject'
  | 'timeline'
  | 'document'
  | 'decision'

/**
 * The platform-default terminology bundle — today's hardcoded pt-BR labels. What
 * `getCaseTypeTerminology(null)` (and any type with zero override rows) resolves to, so
 * every type-less case (`case_type_id` null — the overwhelming majority) renders
 * BYTE-FOR-BYTE unchanged.
 */
export const DEFAULT_CASE_TERMINOLOGY: CaseTypeTerminology = {
  caseTypeId: null,
  case: { singular: 'Caso', plural: 'Casos', helpText: null },
  primarySubject: { singular: 'Paciente', plural: 'Pacientes', helpText: null },
  timeline: { singular: 'Linha do tempo', plural: null, helpText: null },
  document: { singular: 'Documento', plural: 'Documentos', helpText: null },
  decision: { singular: 'Decisão', plural: 'Decisões', helpText: null },
}

/** A raw `case_type_terminology` row (as read from the DB). */
export interface CaseTypeTerminologyRow {
  term_key: string
  singular_label: string
  plural_label: string | null
  help_text: string | null
}

/**
 * Pure merge: overlay a type's override rows onto {@link DEFAULT_CASE_TERMINOLOGY} PER
 * `term_key`, so a missing `term_key` falls back to the platform default for THAT key
 * only. Deterministic; never throws. `caseTypeId` null (or `[]` rows) → the default
 * bundle (carrying `caseTypeId` when a type resolved but simply has no overrides).
 */
export function mergeCaseTypeTerminology(
  caseTypeId: string | null,
  rows: CaseTypeTerminologyRow[],
): CaseTypeTerminology {
  if (!caseTypeId) return DEFAULT_CASE_TERMINOLOGY

  const byKey = new Map(rows.map((r) => [r.term_key, r]))
  const term = (key: CaseTypeTermKey, dflt: CaseTypeTerm): CaseTypeTerm => {
    const row = byKey.get(key)
    return row
      ? { singular: row.singular_label, plural: row.plural_label, helpText: row.help_text }
      : dflt
  }

  return {
    caseTypeId,
    case: term('case', DEFAULT_CASE_TERMINOLOGY.case),
    primarySubject: term('primary_subject', DEFAULT_CASE_TERMINOLOGY.primarySubject),
    timeline: term('timeline', DEFAULT_CASE_TERMINOLOGY.timeline),
    document: term('document', DEFAULT_CASE_TERMINOLOGY.document),
    decision: term('decision', DEFAULT_CASE_TERMINOLOGY.decision),
  }
}
