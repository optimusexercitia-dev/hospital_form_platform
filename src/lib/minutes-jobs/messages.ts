/**
 * MIN pt-BR message catalog + SQLSTATE → friendly-text mapping (ADR 0099; Rule 10 —
 * user-facing text is pt-BR and raw Supabase/Postgres errors NEVER reach the UI).
 *
 * Mirrors `src/lib/meetings/messages.ts`'s convention deliberately: the audio feature
 * hangs off the Ata editor and shares its authority model, so it shares its error style.
 * The UI renders `ActionState.error` verbatim and never sees a code.
 *
 * ⚠ `error.message` is preferred over the constant ONLY where the RPC's own text is
 * already user-grade pt-BR (it is, for the HC0S* family — each is a written sentence).
 * Where an RPC raises a terse internal string, the constant wins unconditionally.
 */

/** MIN SQLSTATE allocation — `HC0S0`–`HC0S6`, the next free block (verified against pg_proc). */
export const HC_AUDIO_MINUTES_OFF = 'HC0S0'
export const HC_MEETING_NOT_ELIGIBLE = 'HC0S1'
export const HC_ACTIVE_JOB_EXISTS = 'HC0S2'
export const HC_JOB_WRONG_STATE = 'HC0S3'
export const HC_DRAFT_INVALID = 'HC0S4'
export const HC_ATA_HAS_HTML = 'HC0S5'
export const HC_ACTION_ITEMS_UNAVAILABLE = 'HC0S6'

/** Generic Postgres SQLSTATEs the MIN doors can surface. */
export const PG_CHECK_VIOLATION = '23514'
export const PG_FORBIDDEN = '42501'
export const PG_NO_DATA_FOUND = 'P0002'

export const MINUTES_MESSAGES = {
  // Authorization / availability. NOTE: `forbidden` is intentionally the SAME text for
  // "not found" and "not yours" — the RPCs raise one indistinguishable 42501 so there is
  // no cross-tenant existence oracle, and the UI must not reintroduce one by wording.
  forbidden: 'Você não tem permissão para esta ação.',
  unavailable: 'A geração de ata por áudio não está disponível.',
  generic: 'Não foi possível concluir. Tente novamente.',
  serviceUnavailable:
    'O serviço de transcrição está indisponível no momento. Tente novamente em alguns minutos.',
  serviceMisconfigured:
    'A geração de ata por áudio não está configurada neste ambiente.',

  // Eligibility / lifecycle
  meetingNotEligible:
    'A reunião precisa estar marcada como realizada para gerar a ata por áudio.',
  activeJobExists:
    'Já existe um processamento de áudio em andamento para esta reunião.',
  jobWrongState: 'Este processamento não está mais neste estado. Atualize a página.',

  // Draft / apply
  draftInvalid: 'Não foi possível salvar o rascunho da revisão.',
  ataHasHtml: 'O texto da ata contém HTML não permitido. Remova as marcações e tente novamente.',
  actionItemsUnavailable:
    'O módulo de itens de ação não está disponível. Os itens de ação não puderam ser criados.',
  assigneeNotMember: 'O responsável indicado não é membro da comissão.',

  // Upload
  fileTooLarge: 'O arquivo excede o limite de 500 MB.',
  fileTypeInvalid: 'Envie um arquivo de áudio em um dos formatos aceitos.',
  fileMissing: 'Selecione um arquivo de áudio.',
  uploadUrlFailed: 'Não foi possível preparar o envio do áudio. Tente novamente.',

  // Transcript door
  transcriptUnavailable: 'Não foi possível carregar a transcrição.',
} as const

// NOTE: there are deliberately no success strings here. `ActionState.error` is an ERROR
// channel — `use-minutes-action.ts` surfaces it only when `!ok` — so the former
// `jobStarted` / `jobCancelled` / `reviewApplied` entries were unreachable by
// construction (QA I5). Success copy belongs to the UI's own pt-BR labels.

/**
 * Map a PostgREST/Postgres error onto pt-BR.
 *
 * `HC000` / `HC021` ARE handled here even though nothing should ever deliver them:
 * `apply_minutes_review` catches both from `create_committee_action_item` inside its
 * transaction and re-raises `HC0S6`, and no MIN action calls that door directly.
 *
 * ⚠ They are in the switch because the safety property otherwise lives ONLY in a TS
 * comment describing SQL. Delete that `exception` block in the RPC and this file silently
 * becomes wrong — the codes would escape to the pt-BR generic, which is safe but says
 * nothing useful. Encoding them executably costs two lines and makes the escape hatch
 * behave correctly instead of merely harmlessly (QA N6; the standing "a comment is an
 * assertion that goes stale silently" lesson).
 */
export function mapMinutesError(error: { code?: string; message?: string } | null): string {
  if (!error) return MINUTES_MESSAGES.generic
  switch (error.code) {
    case HC_ACTION_ITEMS_FLAG_OFF:
      return MINUTES_MESSAGES.actionItemsUnavailable
    case HC_ASSIGNEE_NOT_MEMBER:
      return MINUTES_MESSAGES.assigneeNotMember
    case HC_AUDIO_MINUTES_OFF:
      return MINUTES_MESSAGES.unavailable
    case HC_MEETING_NOT_ELIGIBLE:
      return error.message || MINUTES_MESSAGES.meetingNotEligible
    case HC_ACTIVE_JOB_EXISTS:
      return error.message || MINUTES_MESSAGES.activeJobExists
    case HC_JOB_WRONG_STATE:
      return error.message || MINUTES_MESSAGES.jobWrongState
    case HC_DRAFT_INVALID:
      return error.message || MINUTES_MESSAGES.draftInvalid
    case HC_ATA_HAS_HTML:
      return error.message || MINUTES_MESSAGES.ataHasHtml
    case HC_ACTION_ITEMS_UNAVAILABLE:
      return error.message || MINUTES_MESSAGES.actionItemsUnavailable
    case PG_FORBIDDEN:
      // Never `error.message` here: the RPCs raise the bare string 'sem permissão'.
      return MINUTES_MESSAGES.forbidden
    case PG_NO_DATA_FOUND:
      return MINUTES_MESSAGES.forbidden
    case PG_CHECK_VIOLATION:
      return MINUTES_MESSAGES.generic
    default:
      return MINUTES_MESSAGES.generic
  }
}

/** The action-items door's codes, mapped inside `apply_minutes_review` (never seen here). */
export const HC_ACTION_ITEMS_FLAG_OFF = 'HC000'
export const HC_ASSIGNEE_NOT_MEMBER = 'HC021'
