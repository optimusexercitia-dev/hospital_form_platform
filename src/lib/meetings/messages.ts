/**
 * Meetings pt-BR message catalog + SQLSTATE → friendly-text mapping
 * (Architecture Rule 9 — data access is centralized; user-facing text is pt-BR,
 * CLAUDE.md §8 — raw Supabase/Postgres errors NEVER reach the UI).
 *
 * CONVENTION NOTE (flagged for reviewers): the cases feature keeps its SQLSTATE
 * map INLINE in each `actions.ts`. Per the Phase 10 plan, meetings instead
 * centralizes the map here so every meetings action imports one source of truth.
 * The `HC0xx` custom class (see docs/decisions/0018-custom-sqlstate-class.md) is
 * returned by the meetings RPCs; PostgREST surfaces it as a 400 + JSON
 * `{code,message}` so the RPC's own pt-BR text is preferred, with these
 * constants as the fallback.
 */

/** Meetings SQLSTATE allocation (next free after the cases batch was HC032). */
// HC021 is REUSED from the cases batch (assignee not a member of the commission).
export const HC_ASSIGNEE_NOT_MEMBER = 'HC021'
// HC032–HC037 are NEW for meetings (Phase 10).
export const HC_COMMISSION_MISMATCH = 'HC032'
export const HC_MEETING_WRONG_STATE = 'HC033'
export const HC_CANNOT_CONCLUDE = 'HC034'
export const HC_ALREADY_SIGNED = 'HC035'
export const HC_NOT_ENTITLED_TO_SIGN = 'HC036'
export const HC_NOT_ENTITLED_ACTION_ITEM = 'HC037'

/** Generic Postgres SQLSTATEs the meetings RPCs/policies may surface. */
export const PG_CHECK_VIOLATION = '23514'
export const PG_FORBIDDEN = '42501'
export const PG_NO_DATA_FOUND = 'P0002' // raised by `no_data_found` in PL/pgSQL

/**
 * Centralized pt-BR strings for the meetings actions. Keys are stable; the UI
 * may also localize labels for the union types (status/role/etc.) separately.
 */
export const MEETING_MESSAGES = {
  // Authorization / availability
  forbidden: 'Você não tem permissão para esta ação.',
  unavailable: 'Este recurso ainda não está disponível.',
  generic: 'Não foi possível concluir. Tente novamente.',

  // Not-found
  missingMeeting: 'Reunião não encontrada.',
  missingAgendaItem: 'Item de pauta não encontrado.',
  missingAttendee: 'Participante não encontrado.',
  missingCaseLink: 'Vínculo de caso não encontrado.',
  missingAttachment: 'Anexo não encontrado.',
  missingActionItem: 'Item de ação não encontrado.',
  missingCase: 'Caso não encontrado.',
  missingType: 'Tipo de reunião não encontrado.',

  // Validation
  titleRequired: 'Informe um título para a reunião.',
  agendaTitleRequired: 'Informe um título para o item de pauta.',
  actionItemTitleRequired: 'Informe o título do item de ação.',
  attendeeRequired: 'Selecione um membro ou informe um convidado externo.',
  attendeeExclusive:
    'Informe um membro OU um convidado externo, não os dois.',
  typeRequired: 'Selecione o tipo de reunião.',
  caseRequired: 'Selecione um caso.',
  scheduleInvalid: 'Informe uma data e hora válidas para a reunião.',
  scheduleRangeInvalid: 'O término deve ser posterior ao início.',
  modalityInvalid: 'Modalidade de reunião inválida.',
  roleInvalid: 'Função do participante inválida.',
  attendanceInvalid: 'Situação de presença inválida.',
  attachmentKindInvalid: 'Tipo de anexo inválido.',
  statusInvalid: 'Estado de item inválido.',
  dateInvalid: 'Informe uma data válida.',
  quorumRuleInvalid: 'Regra de quórum inválida.',
  quorumValueInvalid: 'Informe um valor de quórum válido para a regra escolhida.',
  fileRequired: 'Selecione um arquivo.',
  fileTooLarge: 'O arquivo excede o tamanho máximo de 25 MB.',
  fileTypeInvalid: 'Envie um PDF, imagem, documento Word/Excel, CSV ou texto.',
  uploadFailed: 'Não foi possível enviar o arquivo. Tente novamente.',

  // Lifecycle / domain (mapped from HC032–HC037)
  commissionMismatch:
    'O caso selecionado pertence a outra comissão.',
  meetingWrongState:
    'A reunião não está no estado necessário para esta ação.',
  cannotConclude:
    'Registre ao menos um participante presente antes de concluir a reunião.',
  alreadySigned: 'Você já assinou esta ata.',
  notEntitledToSign:
    'Apenas participantes presentes desta reunião podem assinar a ata.',
  notEntitledActionItem: 'Você não pode alterar este item de ação.',
  assigneeNotMember: 'O responsável deve ser membro da comissão.',

  // Success
  meetingCreated: 'Reunião agendada com sucesso.',
  meetingUpdated: 'Reunião atualizada.',
  meetingHeld: 'Reunião marcada como realizada.',
  meetingConcluded: 'Reunião concluída. A ata está pronta para assinatura.',
  meetingReopened: 'Reunião reaberta. As assinaturas foram revogadas.',
  meetingDistributed: 'Ata distribuída.',
  meetingCancelled: 'Reunião cancelada.',
  agendaItemAdded: 'Item de pauta adicionado.',
  agendaItemUpdated: 'Item de pauta atualizado.',
  agendaItemRemoved: 'Item de pauta removido.',
  agendaReordered: 'Pauta reordenada.',
  attendeeAdded: 'Participante adicionado.',
  attendeeUpdated: 'Participante atualizado.',
  attendeeRemoved: 'Participante removido.',
  attendeesSeeded: 'Membros da comissão adicionados como participantes.',
  caseLinked: 'Caso vinculado à reunião.',
  caseUnlinked: 'Vínculo de caso removido.',
  attachmentAdded: 'Anexo adicionado com sucesso.',
  attachmentRemoved: 'Anexo removido.',
  meetingSigned: 'Ata assinada com sucesso.',
  actionItemCreated: 'Item de ação criado.',
  actionItemUpdated: 'Item de ação atualizado.',
  actionItemAdvanced: 'Item de ação atualizado.',
  actionItemCompleted: 'Item de ação concluído.',
  actionItemRemoved: 'Item de ação removido.',
} as const

/**
 * Map a meetings RPC/Postgres error to friendly pt-BR. Prefers the RPC's own
 * `message` (raised in pt-BR by the `HC0xx` RAISEs) and falls back to the
 * catalog above; an unknown code degrades to the generic message so a raw
 * Postgres string never reaches the UI.
 */
export function mapMeetingError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return MEETING_MESSAGES.generic
  switch (error.code) {
    case HC_COMMISSION_MISMATCH:
      return error.message || MEETING_MESSAGES.commissionMismatch
    case HC_MEETING_WRONG_STATE:
      return error.message || MEETING_MESSAGES.meetingWrongState
    case HC_CANNOT_CONCLUDE:
      return error.message || MEETING_MESSAGES.cannotConclude
    case HC_ALREADY_SIGNED:
      return error.message || MEETING_MESSAGES.alreadySigned
    case HC_NOT_ENTITLED_TO_SIGN:
      return error.message || MEETING_MESSAGES.notEntitledToSign
    case HC_NOT_ENTITLED_ACTION_ITEM:
      return error.message || MEETING_MESSAGES.notEntitledActionItem
    case HC_ASSIGNEE_NOT_MEMBER:
      return error.message || MEETING_MESSAGES.assigneeNotMember
    case PG_FORBIDDEN:
      return MEETING_MESSAGES.forbidden
    case PG_NO_DATA_FOUND:
      return error.message || MEETING_MESSAGES.missingMeeting
    case PG_CHECK_VIOLATION:
      return error.message || MEETING_MESSAGES.generic
    default:
      return MEETING_MESSAGES.generic
  }
}
