/**
 * Inter-Committee Case Referrals — pt-BR message catalog + SQLSTATE → friendly-text
 * mapping (Phase 22 — `case_referrals`; Architecture Rule 9 — data access
 * centralized; user-facing text pt-BR, CLAUDE.md §8 — raw Supabase/Postgres errors
 * NEVER reach the UI).
 *
 * Mirrors the Phase-14 safety convention (`src/lib/safety/messages.ts`): one
 * centralized source of truth every referral action imports. The `HC0xx` custom
 * class (docs/decisions/0018-custom-sqlstate-class.md) is returned by the referral
 * RPCs; PostgREST surfaces it as a 400 + JSON `{code,message}`, so the RPC's own
 * pt-BR text is preferred, with these constants as the fallback.
 *
 * SQLSTATE allocation (ADR 0037 reserves HC070–HC07A for Phase 22; HC054/HC055 are
 * taken by cases.sql, HC056+ by the accreditation track):
 *   HC070 wrong-status, HC071 not-source-coordinator, HC072 not-target-coordinator,
 *   HC073 snapshot frozen, HC074 reply shape invalid, HC075 conclude-with-reply
 *   missing result/outcome, HC076 close blocked by pending reply, HC077 shared-item
 *   shape invalid, HC078 set_referral_patient not entitled/concluded, HC079
 *   target-case link invalid, HC07A vocab CRUD violation.
 */

/** Referral is in the wrong state for the requested lifecycle op (state machine). */
export const HC_REFERRAL_WRONG_STATE = 'HC070'
/** The caller is not a coordinator of the SOURCE commission (send/withdraw/curate). */
export const HC_NOT_SOURCE_COORDINATOR = 'HC071'
/** The caller is not a coordinator of the TARGET commission (receive/accept/reply). */
export const HC_NOT_TARGET_COORDINATOR = 'HC072'
/** The snapshot is frozen (the referral has been sent) — no more shared items. */
export const HC_SNAPSHOT_FROZEN = 'HC073'
/** The structured reply shape is invalid (outcome/result/ack inconsistency). */
export const HC_REPLY_SHAPE_INVALID = 'HC074'
/** Conclude blocked — a reply-expecting referral needs a result + outcome. */
export const HC_CONCLUDE_MISSING_REPLY = 'HC075'
/** close_case blocked — a reply-expecting referral is still in flight. */
export const HC_CLOSE_BLOCKED_BY_REFERRAL = 'HC076'
/** A shared-item one-of shape is invalid (kind vs narrative/document mismatch). */
export const HC_SHARED_ITEM_SHAPE_INVALID = 'HC077'
/** set_referral_patient: not entitled, or the referral is already concluded. */
export const HC_PATIENT_NOT_ENTITLED = 'HC078'
/** The target-case link is invalid (case is not in the target commission). */
export const HC_TARGET_CASE_INVALID = 'HC079'
/** A vocabulary (referral_types / reply_outcomes) CRUD violation. */
export const HC_VOCAB_CRUD = 'HC07A'

/** Generic Postgres SQLSTATEs the referral RPCs/policies may surface. */
export const PG_CHECK_VIOLATION = '23514'
export const PG_FORBIDDEN = '42501'
export const PG_NO_DATA_FOUND = 'P0002' // raised by `no_data_found` in PL/pgSQL
export const PG_UNIQUE_VIOLATION = '23505'

/** Centralized pt-BR strings for the referral actions. */
export const REFERRAL_MESSAGES = {
  // Authorization / availability
  forbidden: 'Você não tem permissão para esta ação.',
  unavailable: 'O recurso de encaminhamentos ainda não está disponível.',
  generic: 'Não foi possível concluir. Tente novamente.',

  // Not-found
  missingReferral: 'Encaminhamento não encontrado.',
  missingCase: 'Caso não encontrado.',
  missingCommission: 'Comissão não encontrada.',
  missingSharedItem: 'Item do encaminhamento não encontrado.',

  // Validation (client-side pre-checks before the RPC)
  subjectRequired: 'Informe um assunto para o encaminhamento.',
  targetCommissionRequired: 'Selecione a comissão de destino.',
  referralTypeRequired: 'Selecione o tipo de encaminhamento.',
  sourceCaseRequired: 'Selecione o caso a encaminhar.',
  sharedItemKindInvalid: 'Selecione uma narrativa ou um documento para anexar.',
  patientNameOrMrnRequired:
    'Informe ao menos o nome ou o prontuário do paciente.',
  replyResultRequired: 'Descreva o resultado da análise.',
  replyOutcomeRequired: 'Selecione o desfecho da análise.',
  targetCaseRequired: 'Selecione o caso a vincular.',
  attachmentTitleRequired: 'Informe um título para o anexo.',
  attachmentUploadFailed: 'Não foi possível enviar o anexo. Tente novamente.',

  // Lifecycle / domain (mapped from HC070–HC079)
  referralWrongState:
    'O encaminhamento não está no estado necessário para esta ação.',
  notSourceCoordinator:
    'Apenas a coordenação da comissão de origem pode realizar esta ação.',
  notTargetCoordinator:
    'Apenas a coordenação da comissão de destino pode realizar esta ação.',
  snapshotFrozen:
    'O encaminhamento já foi enviado; o conteúdo compartilhado não pode mais ser alterado.',
  replyShapeInvalid: 'A resposta está inconsistente. Revise o desfecho e o resultado.',
  concludeMissingReply:
    'Para concluir, registre o resultado e o desfecho da análise.',
  closeBlockedByReferral:
    'Há encaminhamentos aguardando resposta; conclua, recuse ou retire antes de encerrar o caso.',
  sharedItemShapeInvalid:
    'O item compartilhado está inconsistente com o tipo selecionado.',
  patientNotEntitled:
    'Você não pode registrar dados do paciente neste encaminhamento.',
  targetCaseInvalid:
    'O caso selecionado não pertence à comissão de destino.',
  vocabDuplicateKey: 'Já existe um item com este identificador.',
  vocabCrud: 'Não foi possível alterar o vocabulário de encaminhamentos.',

  // Success
  referralDrafted: 'Rascunho de encaminhamento criado.',
  referralUpdated: 'Encaminhamento atualizado.',
  referralSent: 'Encaminhamento enviado à comissão de destino.',
  referralWithdrawn: 'Encaminhamento retirado.',
  referralReceived: 'Encaminhamento recebido.',
  referralAccepted: 'Encaminhamento aceito.',
  referralDeclined: 'Encaminhamento recusado.',
  reviewStarted: 'Análise iniciada.',
  referralConcluded: 'Encaminhamento concluído; resposta enviada à origem.',
  caseLinked: 'Caso vinculado ao encaminhamento.',
  caseUnlinked: 'Vínculo de caso removido.',
  sharedItemAdded: 'Item adicionado ao encaminhamento.',
  sharedItemRemoved: 'Item removido do encaminhamento.',
  patientSaved: 'Dados do paciente registrados.',
  attachmentAdded: 'Anexo adicionado.',
} as const

/**
 * Map a referral RPC/Postgres error to friendly pt-BR. Prefers the RPC's own
 * `message` (raised in pt-BR by the `HC0xx` RAISEs) and falls back to the catalog
 * above; an unknown code degrades to the generic message so a raw Postgres string
 * never reaches the UI.
 *
 * Note on check-violations (23514): the referral RPCs raise shape/validation
 * check_violations with their OWN distinct pt-BR text (the Phase-5 MINOR-2 / 14c
 * lesson), so we surface `error.message` for them, falling back to the generic.
 */
export function mapReferralError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return REFERRAL_MESSAGES.generic
  switch (error.code) {
    case HC_REFERRAL_WRONG_STATE:
      return error.message || REFERRAL_MESSAGES.referralWrongState
    case HC_NOT_SOURCE_COORDINATOR:
      return error.message || REFERRAL_MESSAGES.notSourceCoordinator
    case HC_NOT_TARGET_COORDINATOR:
      return error.message || REFERRAL_MESSAGES.notTargetCoordinator
    case HC_SNAPSHOT_FROZEN:
      return error.message || REFERRAL_MESSAGES.snapshotFrozen
    case HC_REPLY_SHAPE_INVALID:
      return error.message || REFERRAL_MESSAGES.replyShapeInvalid
    case HC_CONCLUDE_MISSING_REPLY:
      return error.message || REFERRAL_MESSAGES.concludeMissingReply
    case HC_CLOSE_BLOCKED_BY_REFERRAL:
      return error.message || REFERRAL_MESSAGES.closeBlockedByReferral
    case HC_SHARED_ITEM_SHAPE_INVALID:
      return error.message || REFERRAL_MESSAGES.sharedItemShapeInvalid
    case HC_PATIENT_NOT_ENTITLED:
      return error.message || REFERRAL_MESSAGES.patientNotEntitled
    case HC_TARGET_CASE_INVALID:
      return error.message || REFERRAL_MESSAGES.targetCaseInvalid
    case HC_VOCAB_CRUD:
      return error.message || REFERRAL_MESSAGES.vocabCrud
    case PG_FORBIDDEN:
      return REFERRAL_MESSAGES.forbidden
    case PG_NO_DATA_FOUND:
      return error.message || REFERRAL_MESSAGES.missingReferral
    case PG_UNIQUE_VIOLATION:
      return REFERRAL_MESSAGES.vocabDuplicateKey
    case PG_CHECK_VIOLATION:
      // The RPC raises shape/validation check_violations with their own distinct
      // pt-BR text; prefer it, falling back to the generic.
      return error.message || REFERRAL_MESSAGES.generic
    default:
      return REFERRAL_MESSAGES.generic
  }
}
