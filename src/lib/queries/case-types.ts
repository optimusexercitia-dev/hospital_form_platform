/**
 * Case-type terminology resolution (ADR 0064 Decision 4; ETH·E3a).
 *
 * A `case_type` carries a per-type UI-label bundle (`case_type_terminology`) so an
 * Ethics case renders "Denúncia / Médico denunciado / Cronologia processual" while a
 * generic/M&M case renders today's platform defaults ("Caso / Paciente / Linha do
 * tempo / …"). Every label stays pt-BR (Architecture Rule 10 — the type only selects
 * WHICH pt-BR bundle renders, never introduces another language).
 *
 * This is the first-ever TS consumer of `case_type_terminology` (verified: only
 * `src/lib/types/database.ts` referenced the table name before E3a). The DB read is
 * wired in BE-5; BE-1 posts the contract + the platform-default fallback const.
 */

/** The five overridable UI label slots (`case_type_terminology.term_key`). */
export interface CaseTypeTerm {
  singular: string
  plural: string | null
  helpText: string | null
}

export interface CaseTypeTerminology {
  /**
   * The resolved case type, or `null` when this is the PLATFORM-DEFAULT bundle
   * (no `case_type_id` on the case, or the type carries no override rows). Deviates
   * from the plan §2.3 sketch (`caseTypeId: string`) because the default bundle has
   * no owning type — a nullable id is the honest as-built shape.
   */
  caseTypeId: string | null
  case: CaseTypeTerm
  primarySubject: CaseTypeTerm
  timeline: CaseTypeTerm
  document: CaseTypeTerm
  decision: CaseTypeTerm
}

/**
 * The platform-default terminology bundle — today's hardcoded pt-BR labels. This is
 * what `getCaseTypeTerminology(null)` (and any case type with zero override rows)
 * resolves to, so every EXISTING case (`case_type_id` null — the overwhelming
 * majority pre-Ethics) renders BYTE-FOR-BYTE unchanged. Same flag-OFF-fallback
 * discipline E1/E2 apply to RLS, applied here to a UI-label resolver.
 *
 * Exported so the read layer (BE-5) and every construct site share one source of
 * truth for the fallback rather than re-inlining the strings.
 */
export const DEFAULT_CASE_TERMINOLOGY: CaseTypeTerminology = {
  caseTypeId: null,
  case: { singular: 'Caso', plural: 'Casos', helpText: null },
  primarySubject: { singular: 'Paciente', plural: 'Pacientes', helpText: null },
  timeline: { singular: 'Linha do tempo', plural: null, helpText: null },
  document: { singular: 'Documento', plural: 'Documentos', helpText: null },
  decision: { singular: 'Decisão', plural: 'Decisões', helpText: null },
}

/**
 * Resolves a case type's terminology bundle, or {@link DEFAULT_CASE_TERMINOLOGY} when
 * `caseTypeId` is null or the type has no override rows. MUST never throw or return
 * `null` for a null/unknown type — the deterministic fallback is what keeps every
 * type-less case rendering today's labels (§4 acceptance A-2).
 *
 * BE-5 implements this as an RLS-scoped read of `case_type_terminology` merged over
 * the default bundle. Contract-first stub for now.
 */
export async function getCaseTypeTerminology(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stub; BE-5 wires the read
  caseTypeId: string | null,
): Promise<CaseTypeTerminology> {
  throw new Error('not implemented')
}
