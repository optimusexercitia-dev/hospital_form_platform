/**
 * Interviews pt-BR message catalog + SQLSTATE → friendly-text mapping
 * (Architecture Rule 9 — data access centralized; user-facing text pt-BR,
 * CLAUDE.md §8 — raw Supabase/Postgres errors NEVER reach the UI).
 *
 * Mirrors the Phase-10 meetings convention (`src/lib/meetings/messages.ts`): the
 * map is centralized here so every interviews action imports one source of truth.
 * The `HC0xx` custom class (docs/decisions/0018-custom-sqlstate-class.md) is
 * returned by the interviews RPCs; PostgREST surfaces it as a 400 + JSON
 * `{code,message}`, so the RPC's own pt-BR text is preferred, with these constants
 * as the fallback.
 */

/** Interviews SQLSTATE allocation (Phase 11; continuing after Phase-10's HC037). */
// HC021 is REUSED (a registered interviewer who is not a member of the commission).
export const HC_INTERVIEWER_NOT_MEMBER = 'HC021'
// HC038–HC041 are NEW for interviews (Phase 11).
export const HC_INTERVIEW_WRONG_STATE = 'HC038'
export const HC_NOT_ENTITLED_TO_WRITE = 'HC039'
export const HC_INVALID_ATTACHMENT = 'HC040'
export const HC_CANNOT_CONCLUDE = 'HC041'

/** Generic Postgres SQLSTATEs the interviews RPCs/policies may surface. */
export const PG_CHECK_VIOLATION = '23514'
export const PG_FORBIDDEN = '42501'
export const PG_NO_DATA_FOUND = 'P0002' // raised by `no_data_found` in PL/pgSQL

/** Centralized pt-BR strings for the interviews actions. */
export const INTERVIEW_MESSAGES = {
  // Authorization / availability
  forbidden: 'Você não tem permissão para esta ação.',
  unavailable: 'Este recurso ainda não está disponível.',
  generic: 'Não foi possível concluir. Tente novamente.',

  // Not-found
  missingInterview: 'Entrevista não encontrada.',
  missingSubject: 'Entrevistado não encontrado.',
  missingInterviewer: 'Entrevistador não encontrado.',
  missingAttachment: 'Anexo não encontrado.',
  missingCase: 'Caso não encontrado.',

  // Validation
  titleRequired: 'Informe um título para o anexo.',
  scheduleRequired: 'Informe a data e hora da entrevista.',
  scheduleRangeInvalid: 'O término deve ser posterior ao início.',
  modalityInvalid: 'Modalidade de entrevista inválida.',
  roleInvalid: 'Função do entrevistador inválida.',
  partyExclusive: 'Informe um membro OU uma pessoa externa, não os dois.',
  partyRequired: 'Selecione um membro ou informe uma pessoa externa.',
  attachmentKindInvalid: 'Tipo de anexo inválido.',
  fileRequired: 'Selecione um arquivo.',
  fileTooLarge: 'O arquivo excede o tamanho máximo de 25 MB.',
  fileTypeInvalid: 'Envie um PDF, imagem, documento Word/Excel, CSV ou texto.',
  linkInvalid: 'Informe um link que comece com https://',
  linkTitleRequired: 'Informe um título para o link.',
  uploadFailed: 'Não foi possível enviar o arquivo. Tente novamente.',

  // Lifecycle / domain (mapped from HC038–HC041 + reused HC021)
  interviewWrongState:
    'A entrevista não está no estado necessário para esta ação.',
  notEntitledToWrite: 'Você não pode editar esta entrevista.',
  invalidAttachment: 'Anexo inválido: envie um arquivo OU informe um link https.',
  cannotConclude: 'Adicione ao menos um entrevistado antes de concluir.',
  interviewerNotMember: 'O entrevistador deve ser membro da comissão.',

  // Success
  interviewCreated: 'Entrevista criada com sucesso.',
  interviewUpdated: 'Entrevista atualizada.',
  interviewScheduled: 'Entrevista agendada.',
  interviewStarted: 'Entrevista iniciada.',
  interviewConcluded: 'Entrevista concluída. O registro foi adicionado ao caso.',
  interviewReopened: 'Entrevista reaberta.',
  interviewCancelled: 'Entrevista cancelada.',
  subjectAdded: 'Entrevistado adicionado.',
  subjectUpdated: 'Entrevistado atualizado.',
  subjectRemoved: 'Entrevistado removido.',
  interviewerAdded: 'Entrevistador adicionado.',
  interviewerUpdated: 'Entrevistador atualizado.',
  interviewerRemoved: 'Entrevistador removido.',
  attachmentAdded: 'Anexo adicionado com sucesso.',
  linkAdded: 'Link adicionado com sucesso.',
  attachmentRemoved: 'Anexo removido.',
} as const

/**
 * Map an interviews RPC/Postgres error to friendly pt-BR. Prefers the RPC's own
 * `message` (raised in pt-BR by the `HC0xx` RAISEs) and falls back to the catalog
 * above; an unknown code degrades to the generic message so a raw Postgres string
 * never reaches the UI.
 */
export function mapInterviewError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return INTERVIEW_MESSAGES.generic
  switch (error.code) {
    case HC_INTERVIEW_WRONG_STATE:
      return error.message || INTERVIEW_MESSAGES.interviewWrongState
    case HC_NOT_ENTITLED_TO_WRITE:
      return error.message || INTERVIEW_MESSAGES.notEntitledToWrite
    case HC_INVALID_ATTACHMENT:
      return error.message || INTERVIEW_MESSAGES.invalidAttachment
    case HC_CANNOT_CONCLUDE:
      return error.message || INTERVIEW_MESSAGES.cannotConclude
    case HC_INTERVIEWER_NOT_MEMBER:
      return error.message || INTERVIEW_MESSAGES.interviewerNotMember
    case PG_FORBIDDEN:
      return INTERVIEW_MESSAGES.forbidden
    case PG_NO_DATA_FOUND:
      return error.message || INTERVIEW_MESSAGES.missingInterview
    case PG_CHECK_VIOLATION:
      return error.message || INTERVIEW_MESSAGES.generic
    default:
      return INTERVIEW_MESSAGES.generic
  }
}
