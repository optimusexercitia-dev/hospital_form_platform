/**
 * Standards Crosswalk & Readiness/Gap Engine v2 (Phase 16) pt-BR message
 * catalog + SQLSTATE → friendly-text mapping (Architecture Rule 9 — data
 * access centralized; Rule 10 — user-facing text pt-BR; CLAUDE.md §8 — raw
 * Supabase/Postgres errors NEVER reach the UI).
 *
 * Mirrors the `src/lib/safety/messages.ts` / `src/lib/indicators/actions.ts`
 * convention: one centralized source of truth every accreditation action
 * imports, preferring the RPC's own pt-BR `message` where the RPC is known to
 * raise one, falling back to this catalog otherwise so an unrecognized or raw
 * Postgres string can never leak to the UI.
 *
 * SQLSTATE allocation (ADR 0093 D10 / Amendment 2 A2·1 — the live high-water
 * verified at Wave 0 is `HC0Q8`, consumed by FF-4; Phase 16 allocates from
 * `HC0Q9`):
 *   HC0Q9 — accreditation flag is off (`app.assert_accreditation_enabled()`,
 *           every RPC's first guard, including the `evidence_candidates`
 *           search path — the FF-5 HC0Q3 lesson).
 *   HC0QA — the artifact does not belong to the linking commission / is not
 *           linkable (`app.artifact_belongs_to_commission` false, or a
 *           restricted-kind read-capability check failed at link time).
 *   HC0QB — duplicate evidence link
 *           (`unique(commission_id, standard_id, artifact_kind, artifact_id)`).
 *   HC0QC — invalid target (bad parent/framework/hospital/level on a
 *           framework/standard/ownership write).
 *   HC0QD — the target framework is a global pack (read-only) — write
 *           rejected with "...clone o framework para editá-lo."
 *   HC0QE — the target framework is archived (`status = 'arquivado'`).
 */

export const HC_FLAG_OFF = 'HC0Q9'
export const HC_NOT_LINKABLE = 'HC0QA'
export const HC_DUPLICATE_LINK = 'HC0QB'
export const HC_INVALID_TARGET = 'HC0QC'
export const HC_GLOBAL_PACK_READONLY = 'HC0QD'
export const HC_FRAMEWORK_ARCHIVED = 'HC0QE'

/** Generic Postgres SQLSTATEs the accreditation RPCs/policies may surface. */
export const PG_CHECK_VIOLATION = '23514'
export const PG_FORBIDDEN = '42501'
export const PG_NO_DATA_FOUND = 'P0002'
export const PG_UNIQUE_VIOLATION = '23505'

/** Centralized pt-BR strings for the accreditation actions. */
export const ACCREDITATION_MESSAGES = {
  // Authorization / availability
  forbidden: 'Você não tem permissão para esta ação.',
  unavailable: 'O módulo de acreditação ainda não está disponível.',
  generic: 'Não foi possível concluir. Tente novamente.',

  // Not-found
  frameworkNotFound: 'Framework não encontrado.',
  standardNotFound: 'Padrão não encontrado.',
  commissionNotFound: 'Comissão não encontrada.',
  hospitalNotFound: 'Hospital não encontrado.',
  evidenceLinkNotFound: 'Vínculo de evidência não encontrado.',

  // Validation
  nameRequired: 'Informe o nome do framework.',
  keyRequired: 'Informe um identificador para o framework.',
  codeRequired: 'Informe o código do padrão.',
  titleRequired: 'Informe o título do padrão.',
  levelInvalid: 'Nível inválido — selecione Segurança, Gestão Integrada ou Excelência.',
  assessmentStatusRequired: 'Selecione o status de conformidade.',
  artifactRequired: 'Selecione um item para vincular como evidência.',
  artifactKindRequired: 'Selecione o tipo de evidência.',

  // Domain (mapped from HC0Q9–HC0QE)
  notLinkable:
    'Este item não pertence à sua comissão ou você não tem permissão para vinculá-lo como evidência.',
  duplicateLink: 'Este item já está vinculado a este padrão.',
  invalidTarget: 'Destino inválido para esta operação.',
  globalPackReadOnly:
    'Este é um framework global, somente leitura — clone o framework para editá-lo.',
  frameworkArchived: 'Este framework está arquivado e não pode ser alterado.',

  // Success
  frameworkCreated: 'Framework criado.',
  frameworkUpdated: 'Framework atualizado.',
  frameworkStatusChanged: 'Status do framework atualizado.',
  frameworkCloned: 'Framework clonado. Você já pode editar os padrões clonados.',
  standardSaved: 'Padrão salvo.',
  standardDeleted: 'Padrão removido.',
  evidenceLinked: 'Evidência vinculada.',
  evidenceUnlinked: 'Evidência removida.',
  assessmentSaved: 'Autoavaliação salva.',
  ownershipSet: 'Comissão responsável definida.',
  ownershipCleared: 'Comissão responsável removida.',
} as const

/**
 * Map an accreditation RPC/Postgres error to friendly pt-BR. Shared across
 * every action in `@/lib/accreditation/actions` (framework CRUD, evidence
 * link/unlink, assessment, ownership) the same way `mapIndicatorError` is
 * shared across `@/lib/indicators/actions`. Prefers the RPC's own pt-BR
 * `message` for the curated `HC0Q*` codes (the RPC raises them in pt-BR
 * already) and falls back to the catalog above; an unrecognized code, or any
 * bare CHECK-violation without a curated code, degrades to the generic
 * message so a raw Postgres string never reaches the UI.
 */
export function mapAccreditationError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return ACCREDITATION_MESSAGES.generic
  switch (error.code) {
    case HC_FLAG_OFF:
      return ACCREDITATION_MESSAGES.unavailable
    case HC_NOT_LINKABLE:
      return error.message || ACCREDITATION_MESSAGES.notLinkable
    case HC_DUPLICATE_LINK:
      return error.message || ACCREDITATION_MESSAGES.duplicateLink
    case HC_INVALID_TARGET:
      return error.message || ACCREDITATION_MESSAGES.invalidTarget
    case HC_GLOBAL_PACK_READONLY:
      return error.message || ACCREDITATION_MESSAGES.globalPackReadOnly
    case HC_FRAMEWORK_ARCHIVED:
      return error.message || ACCREDITATION_MESSAGES.frameworkArchived
    case PG_FORBIDDEN:
      return ACCREDITATION_MESSAGES.forbidden
    case PG_NO_DATA_FOUND:
      return ACCREDITATION_MESSAGES.frameworkNotFound
    case PG_UNIQUE_VIOLATION:
      return ACCREDITATION_MESSAGES.duplicateLink
    // A CHECK-violation (23514) message may be a raw Postgres string (e.g. the
    // standing_ownerships hospital-mismatch guard trigger, which deliberately
    // raises the generic 23514 rather than a curated HC0Q code — ADR 0093
    // Wave 2 ledger note) — NEVER echo it; always fall back to pt-BR.
    case PG_CHECK_VIOLATION:
      return ACCREDITATION_MESSAGES.invalidTarget
    default:
      return ACCREDITATION_MESSAGES.generic
  }
}
