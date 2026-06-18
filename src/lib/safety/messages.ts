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
 * 14a takes the first two.
 */

/** Event is in the wrong state for the requested lifecycle op (state machine). */
export const HC_EVENT_WRONG_STATE = 'HC043'
/** The caller is not the current custodian and so cannot act on the event. */
export const HC_NOT_CURRENT_CUSTODIAN = 'HC044'

/** Generic Postgres SQLSTATEs the safety RPCs/policies may surface. */
export const PG_CHECK_VIOLATION = '23514'
export const PG_FORBIDDEN = '42501'
export const PG_NO_DATA_FOUND = 'P0002' // raised by `no_data_found` in PL/pgSQL

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

  // Success
  eventNotified: 'Evento notificado ao NSP.',
  eventAcknowledged: 'Evento reconhecido pelo NSP.',
  eventUpdated: 'Evento atualizado.',
  eventCancelled: 'Evento cancelado.',
  custodyTransferred: 'Custódia do evento transferida.',
  patientSaved: 'Dados do paciente registrados.',
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
