/**
 * Patient-safety / NSP pt-BR message catalog + SQLSTATE → friendly-text mapping
 * (Architecture Rule 9 — data access centralized; user-facing text pt-BR,
 * CLAUDE.md §8 — raw Supabase/Postgres errors NEVER reach the UI).
 *
 * Mirrors the Phase-10/11 meetings & interviews convention
 * (`src/lib/{meetings,interviews}/messages.ts`): one centralized source of truth
 * every safety action imports. The `HC0xx` custom class
 * (docs/decisions/0018-custom-sqlstate-class.md) is returned by the safety RPCs;
 * PostgREST surfaces it as a 400 + JSON `{code,message}`, so the RPC's own pt-BR
 * text is preferred, with these constants as the fallback.
 *
 * SQLSTATE allocation (Phase 14, ADR 0030 reserves HC043–HC053 for 14a–14d):
 * 14a takes HC043/HC044; 14b takes HC045/HC046; 14c takes HC047/HC048; 14d takes
 * HC049–HC053 (the full reserved range is now consumed).
 */

/** Event is in the wrong state for the requested lifecycle op (state machine). */
export const HC_EVENT_WRONG_STATE = 'HC043'
/** The caller is not the current custodian and so cannot act on the event. */
export const HC_NOT_CURRENT_CUSTODIAN = 'HC044'
/** Triage worksheet is in the wrong state / frozen (Phase 14b). */
export const HC_TRIAGE_WRONG_STATE = 'HC045'
/** Invalid disposition — reach/harm/pathway/PSE inconsistency (Phase 14b). */
export const HC_TRIAGE_INVALID_DISPOSITION = 'HC046'
/** RCA is in the wrong state / frozen (Phase 14c). */
export const HC_RCA_WRONG_STATE = 'HC047'
/** The caller is not entitled to write this RCA (Phase 14c). */
export const HC_RCA_NOT_WRITABLE = 'HC048'
/** CAPA plan is in the wrong state / frozen (Phase 14d). */
export const HC_CAPA_WRONG_STATE = 'HC049'
/** Not entitled to advance this CAPA action (assignee-or-PQS) (Phase 14d). */
export const HC_CAPA_ADVANCE_NOT_ENTITLED = 'HC050'
/** Close blocked — unsettled (non-terminal) actions remain (Phase 14d). */
export const HC_CAPA_UNSETTLED_ACTIONS = 'HC051'
/** Close blocked — no effectiveness verdict recorded (Phase 14d). */
export const HC_CAPA_NO_EFFECTIVENESS = 'HC052'
/** Cancel blocked — the plan is already terminal (Phase 14d). */
export const HC_CAPA_ALREADY_TERMINAL = 'HC053'

/** Generic Postgres SQLSTATEs the safety RPCs/policies may surface. */
export const PG_CHECK_VIOLATION = '23514'
export const PG_FORBIDDEN = '42501'
export const PG_NO_DATA_FOUND = 'P0002' // raised by `no_data_found` in PL/pgSQL
export const PG_UNIQUE_VIOLATION = '23505'

/** Centralized pt-BR strings for the safety/NSP actions. */
export const SAFETY_MESSAGES = {
  // Authorization / availability
  forbidden: 'Você não tem permissão para esta ação.',
  unavailable: 'Este recurso ainda não está disponível.',
  generic: 'Não foi possível concluir. Tente novamente.',

  // Not-found
  missingEvent: 'Evento não encontrado.',
  missingCase: 'Caso não encontrado.',
  missingCommission: 'Comissão não encontrada.',

  // Validation
  titleRequired: 'Informe um título para o evento.',
  descriptionRequired: 'Descreva o evento.',
  harmLevelInvalid: 'Nível de dano suspeito inválido.',
  ownerInvalid: 'Destino de custódia inválido.',
  transferTargetRequired: 'Selecione para quem transferir a custódia.',
  patientNameOrMrnRequired:
    'Informe ao menos o nome ou o prontuário do paciente.',

  // Lifecycle / domain (mapped from HC043/HC044)
  eventWrongState: 'O evento não está no estado necessário para esta ação.',
  notCurrentCustodian:
    'Apenas quem detém a custódia do evento pode realizar esta ação.',

  // Triage (Phase 14b) — validation + lifecycle (mapped from HC045/HC046)
  triageForbidden: 'Apenas o NSP pode triar eventos.',
  triageWrongState:
    'A triagem não está no estado necessário para esta ação (ou está congelada).',
  triageInvalidDisposition:
    'A classificação está inconsistente. Revise alcance, dano e desfecho.',
  triageNotAcknowledged:
    'O evento precisa estar reconhecido pelo NSP para ser triado.',
  pseReasonRequired: 'Selecione o motivo de encerramento (não é evento de segurança).',
  vocabKeyRequired: 'Informe um identificador e um rótulo.',
  vocabDuplicateKey: 'Já existe um item com este identificador.',

  // RCA (Phase 14c) — validation + lifecycle (mapped from HC047/HC048)
  rcaWrongState: 'Esta análise não está no estado necessário para esta ação (ou está concluída).',
  rcaNotWritable: 'Você não pode editar esta análise de causa raiz.',
  rcaNeedsRootCause: 'Conclua a análise com ao menos uma causa raiz identificada.',
  rcaMissing: 'Análise de causa raiz não encontrada.',
  rcaMemberShapeInvalid:
    'Informe um usuário da plataforma OU um nome externo para o integrante.',
  rcaEvidenceShapeInvalid:
    'Informe exatamente um tipo de evidência: arquivo, link ou citação.',
  rcaEvidenceTitleRequired: 'Informe um título para a evidência.',
  rcaUploadFailed: 'Não foi possível enviar o arquivo. Tente novamente.',
  rcaTimelineDescriptionRequired: 'Descreva o que ocorreu neste ponto da linha do tempo.',
  rcaFactorTextRequired: 'Descreva o fator.',
  rcaRootCauseTextRequired: 'Descreva a causa raiz.',

  // CAPA (Phase 14d) — validation + lifecycle (mapped from HC049–HC053)
  capaWrongState: 'Este plano não está no estado necessário para esta ação (ou está concluído).',
  capaAdvanceNotEntitled: 'Você não pode alterar esta ação corretiva.',
  capaUnsettledActions: 'Conclua ou cancele todas as ações antes de encerrar o plano.',
  capaNoEffectiveness: 'Registre a verificação de eficácia antes de encerrar o plano.',
  capaAlreadyTerminal: 'Este plano já está em um estado final.',
  capaMissing: 'Plano de ação não encontrado.',
  capaSourceShapeInvalid: 'A origem do plano está inconsistente.',
  capaActionTitleRequired: 'Informe um título para a ação corretiva.',
  capaMeasureNameRequired: 'Informe um nome para o indicador de medida.',
  capaEvidenceTitleRequired: 'Informe um título para a evidência.',
  capaUploadFailed: 'Não foi possível enviar o arquivo. Tente novamente.',
  capaTaskDescriptionRequired: 'Descreva a etapa de execução.',
  capaLessonsRequired: 'Registre as lições aprendidas ao encerrar o plano.',

  // Success
  eventNotified: 'Evento notificado ao NSP.',
  eventAcknowledged: 'Evento reconhecido pelo NSP.',
  eventUpdated: 'Evento atualizado.',
  eventCancelled: 'Evento cancelado.',
  custodyTransferred: 'Custódia do evento transferida.',
  patientSaved: 'Dados do paciente registrados.',
  triageSaved: 'Triagem salva.',
  triageConfirmed: 'Triagem confirmada.',
  triageReopened: 'Triagem reaberta.',
  vocabSaved: 'Item salvo.',
  vocabArchived: 'Item arquivado.',
  vocabReordered: 'Ordem atualizada.',
  rcaUpdated: 'Análise atualizada.',
  rcaSubmitted: 'Análise enviada para revisão.',
  rcaCompleted: 'Análise concluída.',
  rcaReopened: 'Análise reaberta.',
  rcaMemberAdded: 'Integrante adicionado à equipe.',
  rcaMemberUpdated: 'Função do integrante atualizada.',
  rcaMemberRemoved: 'Integrante removido.',
  rcaTimelineSaved: 'Linha do tempo atualizada.',
  rcaEvidenceAdded: 'Evidência adicionada.',
  rcaEvidenceRemoved: 'Evidência removida.',
  rcaFactorSaved: 'Fator salvo.',
  rcaWhySaved: 'Análise dos 5 porquês salva.',
  rcaRootCauseSaved: 'Causa raiz salva.',
  capaOpened: 'Plano de ação aberto.',
  capaUpdated: 'Plano de ação atualizado.',
  capaClosed: 'Plano de ação encerrado.',
  capaCancelled: 'Plano de ação cancelado.',
  capaReopened: 'Plano de ação reaberto.',
  capaActionSaved: 'Ação corretiva salva.',
  capaActionRemoved: 'Ação corretiva removida.',
  capaActionAdvanced: 'Ação corretiva atualizada.',
  capaTaskSaved: 'Etapa salva.',
  capaEvidenceAdded: 'Evidência adicionada.',
  capaEvidenceRemoved: 'Evidência removida.',
  capaMeasureSaved: 'Medida salva.',
  capaMeasureRemoved: 'Medida removida.',
  capaResultRecorded: 'Resultado registrado.',
  capaEffectivenessRecorded: 'Verificação de eficácia registrada.',
} as const

/**
 * Map a safety RPC/Postgres error to friendly pt-BR. Prefers the RPC's own
 * `message` (raised in pt-BR by the `HC0xx` RAISEs) and falls back to the catalog
 * above; an unknown code degrades to the generic message so a raw Postgres string
 * never reaches the UI.
 */
export function mapSafetyError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return SAFETY_MESSAGES.generic
  switch (error.code) {
    case HC_EVENT_WRONG_STATE:
      return error.message || SAFETY_MESSAGES.eventWrongState
    case HC_NOT_CURRENT_CUSTODIAN:
      return error.message || SAFETY_MESSAGES.notCurrentCustodian
    case PG_FORBIDDEN:
      return SAFETY_MESSAGES.forbidden
    case PG_NO_DATA_FOUND:
      return error.message || SAFETY_MESSAGES.missingEvent
    case PG_CHECK_VIOLATION:
      return error.message || SAFETY_MESSAGES.generic
    default:
      return SAFETY_MESSAGES.generic
  }
}

/**
 * Map a TRIAGE RPC/Postgres error to friendly pt-BR (Phase 14b). Adds HC045/HC046
 * and the vocab-CRUD codes (42501 → "only the NSP", 23505 → duplicate key) on top
 * of the base safety mapping; an unknown code degrades to the generic message.
 */
export function mapTriageError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return SAFETY_MESSAGES.generic
  switch (error.code) {
    case HC_TRIAGE_WRONG_STATE:
      return error.message || SAFETY_MESSAGES.triageWrongState
    case HC_TRIAGE_INVALID_DISPOSITION:
      return error.message || SAFETY_MESSAGES.triageInvalidDisposition
    case HC_EVENT_WRONG_STATE:
      return error.message || SAFETY_MESSAGES.eventWrongState
    case PG_FORBIDDEN:
      return SAFETY_MESSAGES.triageForbidden
    case PG_UNIQUE_VIOLATION:
      return SAFETY_MESSAGES.vocabDuplicateKey
    case PG_NO_DATA_FOUND:
      return error.message || SAFETY_MESSAGES.missingEvent
    case PG_CHECK_VIOLATION:
      return error.message || SAFETY_MESSAGES.generic
    default:
      return SAFETY_MESSAGES.generic
  }
}

/**
 * Map an RCA RPC/Postgres error to friendly pt-BR (Phase 14c). Adds HC047 (wrong
 * state / frozen / no-root-cause complete-gate) + HC048 (not entitled to write).
 * The evidence-shape violation is a `check_violation` (23514) raised with a DISTINCT
 * pt-BR message by the RPC's pre-validation, so we surface `error.message` for
 * check-violations (the RPC's explicit text disambiguates it from any raw constraint
 * — the Phase-5 MINOR-2 lesson); an unknown code degrades to the generic message.
 */
export function mapRcaError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return SAFETY_MESSAGES.generic
  switch (error.code) {
    case HC_RCA_WRONG_STATE:
      return error.message || SAFETY_MESSAGES.rcaWrongState
    case HC_RCA_NOT_WRITABLE:
      return error.message || SAFETY_MESSAGES.rcaNotWritable
    case PG_FORBIDDEN:
      return SAFETY_MESSAGES.rcaNotWritable
    case PG_NO_DATA_FOUND:
      return error.message || SAFETY_MESSAGES.rcaMissing
    case PG_CHECK_VIOLATION:
      // The RPC raises evidence-shape / member-shape check_violations with their
      // own distinct pt-BR text; prefer it, falling back to the generic.
      return error.message || SAFETY_MESSAGES.generic
    default:
      return SAFETY_MESSAGES.generic
  }
}

/**
 * Map a CAPA RPC/Postgres error to friendly pt-BR (Phase 14d). HC049 wrong-state/
 * frozen; HC050 advance-not-entitled (assignee-or-PQS); HC051 close blocked by
 * unsettled actions; HC052 close blocked by no effectiveness verdict; HC053 cancel
 * already-terminal. 42501 → not entitled (CAPA write is PQS/admin). The source-shape /
 * evidence-shape violations are check_violations with their own distinct pt-BR text
 * (prefer `error.message`). Unknown → generic.
 */
export function mapCapaError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return SAFETY_MESSAGES.generic
  switch (error.code) {
    case HC_CAPA_WRONG_STATE:
      return error.message || SAFETY_MESSAGES.capaWrongState
    case HC_CAPA_ADVANCE_NOT_ENTITLED:
      return error.message || SAFETY_MESSAGES.capaAdvanceNotEntitled
    case HC_CAPA_UNSETTLED_ACTIONS:
      return error.message || SAFETY_MESSAGES.capaUnsettledActions
    case HC_CAPA_NO_EFFECTIVENESS:
      return error.message || SAFETY_MESSAGES.capaNoEffectiveness
    case HC_CAPA_ALREADY_TERMINAL:
      return error.message || SAFETY_MESSAGES.capaAlreadyTerminal
    case PG_FORBIDDEN:
      return SAFETY_MESSAGES.capaAdvanceNotEntitled
    case PG_NO_DATA_FOUND:
      return error.message || SAFETY_MESSAGES.capaMissing
    case PG_CHECK_VIOLATION:
      return error.message || SAFETY_MESSAGES.generic
    default:
      return SAFETY_MESSAGES.generic
  }
}
