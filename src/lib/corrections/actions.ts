'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

/**
 * Case Correction Lifecycle WRITE side (Architecture Rules 9 & 10): thin 'use
 * server' wrappers over the eight correction DEFINER doors (file → start/save →
 * resubmit → review → approve/reject/withdraw). Each mirrors `supersedeResponseAction`
 * (src/lib/responses/actions.ts): call the RPC directly (the RPC's own authority +
 * RLS are the security boundary — no redundant server-side pre-check) and translate
 * the discriminated SQLSTATEs to pt-BR. A raw Supabase/Postgres error NEVER reaches
 * the UI (CLAUDE.md §8). Reopen lives in `@/lib/cases/actions` (reopenCase); the READ
 * side is `@/lib/queries/corrections`.
 */

export interface ActionState {
  ok: boolean
  error?: string
}

/** file returns the new request id (for the panel to focus it). */
export interface FileCorrectionState extends ActionState {
  requestId?: string
}

/** start returns the draft response id so the wizard routes straight into it. */
export interface StartCorrectionDraftState extends ActionState {
  draftResponseId?: string
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  unavailable: 'O recurso de correção de casos não está disponível.',
  // Invalid-state / stale-transition guard (bare 23514) — a race between two
  // coordinators, or acting on a page whose request already changed state.
  invalidState:
    'A solicitação mudou de estado e esta ação não é mais válida. Recarregue a página e tente novamente.',
  notFound: 'Solicitação ou alvo não encontrado.',
  caseFinal: 'Este caso está em um estado final e não pode mais ser alterado.',
  excluded: 'Você está impedido neste caso e não pode agir sobre ele.',
  inactive: 'Sua conta está inativa ou suspensa.',
  // door-discriminated (HC0M0–HC0M9)
  targetNotCompleted: 'A fase ou narrativa precisa estar concluída para ser corrigida.',
  notCorrector: 'Apenas o corretor designado pode realizar esta ação.',
  slotTaken: 'Já existe uma solicitação de correção aberta para este alvo.',
  narrativeBodyRequired: 'Escreva o texto da narrativa antes de reenviar.',
  correctorInvalid: 'O corretor precisa ser membro da comissão com acesso ao caso.',
  targetedResponse: 'Fases de resposta direcionada não podem ser corrigidas por aqui.',
  rejectReasonRequired: 'Informe o motivo da reprovação.',
  resubmittedWithdraw: 'Reprove a correção antes de retirá-la.',
  staleDraft: 'A solicitação não está pronta para esta ação; a fase pode ter mudado.',
  resultRequired: 'Defina o resultado da fase antes de aprovar.',
  reasonRequired: 'Informe o motivo da correção.',
  // success copy
  filed: 'Solicitação de correção criada.',
  draftStarted: 'Rascunho de correção iniciado.',
  draftSaved: 'Rascunho salvo.',
  resubmitted: 'Correção reenviada para revisão.',
  reviewing: 'Correção em revisão.',
  approved: 'Correção aprovada.',
  rejected: 'Correção reprovada.',
  withdrawn: 'Solicitação de correção retirada.',
} as const

// SQLSTATEs the correction doors raise (HC0Mx block + the shared gates).
const PG_CHECK_VIOLATION = '23514'
const PG_UNIQUE_VIOLATION = '23505'
const PG_NO_DATA_FOUND = 'P0002'
const PG_RLS_VIOLATION = '42501'
// Feature-off sentinel raised by app.assert_case_corrections_enabled() — the shared
// HC000 convention (mirrors assert_ethics_enabled / assert_charters_enabled and the
// HC000 handlers in src/lib/ethics, case-recusals, action-items). Distinct from the
// bare 23514 that the doors raise for invalid-state guards.
const HC_FEATURE_DISABLED = 'HC000'
const HC_CASE_FINAL = 'HC020'
const HC_RESULT_REQUIRED = 'HC061'
const HC_EXCLUDED = 'HC0F1'
const HC_INACTIVE = 'HC0F4'
const HC_TARGET_NOT_COMPLETED = 'HC0M0'
const HC_NOT_CORRECTOR = 'HC0M1'
const HC_SLOT_TAKEN = 'HC0M2'
const HC_NARRATIVE_BODY = 'HC0M3'
const HC_CORRECTOR_INVALID = 'HC0M4'
const HC_TARGETED_RESPONSE = 'HC0M5'
const HC_REJECT_REASON = 'HC0M6'
const HC_RESUBMITTED_WITHDRAW = 'HC0M7'
const HC_STALE_DRAFT = 'HC0M9'

/** Central HC-code → pt-BR map for every correction door. */
function mapCorrectionError(code: string | undefined): string {
  switch (code) {
    case HC_TARGET_NOT_COMPLETED:
      return MESSAGES.targetNotCompleted
    case HC_NOT_CORRECTOR:
      return MESSAGES.notCorrector
    case HC_SLOT_TAKEN:
    case PG_UNIQUE_VIOLATION: // the open-slot partial-unique index backstop
      return MESSAGES.slotTaken
    case HC_NARRATIVE_BODY:
      return MESSAGES.narrativeBodyRequired
    case HC_CORRECTOR_INVALID:
      return MESSAGES.correctorInvalid
    case HC_TARGETED_RESPONSE:
      return MESSAGES.targetedResponse
    case HC_REJECT_REASON:
      return MESSAGES.rejectReasonRequired
    case HC_RESUBMITTED_WITHDRAW:
      return MESSAGES.resubmittedWithdraw
    case HC_STALE_DRAFT:
      return MESSAGES.staleDraft
    case HC_CASE_FINAL:
      return MESSAGES.caseFinal
    case HC_RESULT_REQUIRED:
      return MESSAGES.resultRequired
    case HC_EXCLUDED:
      return MESSAGES.excluded
    case HC_INACTIVE:
      return MESSAGES.inactive
    case PG_RLS_VIOLATION:
      return MESSAGES.forbidden
    case PG_NO_DATA_FOUND:
      return MESSAGES.notFound
    case HC_FEATURE_DISABLED:
      // assert_case_corrections_enabled() — the `case_corrections` flag is OFF.
      return MESSAGES.unavailable
    case PG_CHECK_VIOLATION:
      // A door's invalid-state / stale-transition / shape guard (approve/reject/review
      // "não está no estado necessário", target-XOR, guard_case_phase_status). NOT
      // feature-off (that is HC000 above), so "não disponível" would misdescribe it.
      return MESSAGES.invalidState
    default:
      return MESSAGES.generic
  }
}

const CASE_MANAGE_PATH = '/o/[org]/c/[commission]/manage/cases/[caseId]'
const CASE_STAFF_PATH = '/o/[org]/c/[commission]/casos/[caseId]'
const RESPONDER_PATH = '/o/[org]/c/[commission]/forms/[formId]/responder/[responseId]'

/** Revalidate the case detail routes (both areas) + the responder (correction draft). */
function revalidateCorrection(): void {
  revalidatePath(CASE_MANAGE_PATH, 'page')
  revalidatePath(CASE_STAFF_PATH, 'page')
  revalidatePath(RESPONDER_PATH, 'page')
}

// ---------------------------------------------------------------------------
// Doors
// ---------------------------------------------------------------------------

/** Open a correction/addendum/void request against a completed phase or narrative. */
export async function fileCorrectionRequest(input: {
  kind: 'correction' | 'addendum' | 'void'
  casePhaseId?: string | null
  caseNarrativeId?: string | null
  reason: string
  classification:
    | 'clerical'
    | 'factual'
    | 'interpretative'
    | 'substantive'
    | 'compliance_related'
  permittedCorrector?: string | null
}): Promise<FileCorrectionState> {
  if (!input.reason.trim()) return { ok: false, error: MESSAGES.reasonRequired }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('file_correction_request', {
    p_kind: input.kind,
    // The RPC takes exactly one target (phase XOR narrative); the other is null.
    // gen-types model nullable rpc args as required `string`, so cast the null.
    p_case_phase_id: (input.casePhaseId ?? null) as unknown as string,
    p_case_narrative_id: (input.caseNarrativeId ?? null) as unknown as string,
    p_reason: input.reason,
    p_classification: input.classification,
    p_permitted_corrector: input.permittedCorrector ?? undefined,
  })

  if (error || !data) return { ok: false, error: mapCorrectionError(error?.code) }

  revalidateCorrection()
  return { ok: true, error: MESSAGES.filed, requestId: data }
}

/** Create/resume the phase-correction draft; returns the draft response id. */
export async function startCorrectionDraft(
  requestId: string,
): Promise<StartCorrectionDraftState> {
  if (!requestId) return { ok: false, error: MESSAGES.notFound }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('start_correction_draft', {
    p_request_id: requestId,
  })

  if (error || !data) return { ok: false, error: mapCorrectionError(error?.code) }

  revalidateCorrection()
  return { ok: true, error: MESSAGES.draftStarted, draftResponseId: data }
}

/** Save the narrative-correction draft body. */
export async function saveCorrectionDraftBody(
  requestId: string,
  bodyMd: string,
): Promise<ActionState> {
  if (!requestId) return { ok: false, error: MESSAGES.notFound }

  const supabase = await createClient()
  const { error } = await supabase.rpc('save_correction_draft_body', {
    p_request_id: requestId,
    p_body_md: bodyMd,
  })

  if (error) return { ok: false, error: mapCorrectionError(error.code) }

  revalidateCorrection()
  return { ok: true, error: MESSAGES.draftSaved }
}

/** Submit the draft for review (phase kinds go through submit_response internally). */
export async function resubmitCorrection(requestId: string): Promise<ActionState> {
  if (!requestId) return { ok: false, error: MESSAGES.notFound }

  const supabase = await createClient()
  const { error } = await supabase.rpc('resubmit_correction', {
    p_request_id: requestId,
  })

  if (error) return { ok: false, error: mapCorrectionError(error.code) }

  revalidateCorrection()
  return { ok: true, error: MESSAGES.resubmitted }
}

/** Move a resubmitted request to under_review. */
export async function reviewCorrection(requestId: string): Promise<ActionState> {
  if (!requestId) return { ok: false, error: MESSAGES.notFound }

  const supabase = await createClient()
  const { error } = await supabase.rpc('review_correction', {
    p_request_id: requestId,
  })

  if (error) return { ok: false, error: mapCorrectionError(error.code) }

  revalidateCorrection()
  return { ok: true, error: MESSAGES.reviewing }
}

/** Approve and apply the correction atomically. */
export async function approveCorrection(
  requestId: string,
  note?: string | null,
): Promise<ActionState> {
  if (!requestId) return { ok: false, error: MESSAGES.notFound }

  const supabase = await createClient()
  const { error } = await supabase.rpc('approve_correction', {
    p_request_id: requestId,
    p_note: note ?? undefined,
  })

  if (error) return { ok: false, error: mapCorrectionError(error.code) }

  revalidateCorrection()
  return { ok: true, error: MESSAGES.approved }
}

/** Reject (mandatory reason) — sends the draft back to the corrector for editing. */
export async function rejectCorrection(
  requestId: string,
  reason: string,
): Promise<ActionState> {
  if (!requestId) return { ok: false, error: MESSAGES.notFound }
  if (!reason.trim()) return { ok: false, error: MESSAGES.rejectReasonRequired }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reject_correction', {
    p_request_id: requestId,
    p_reason: reason,
  })

  if (error) return { ok: false, error: mapCorrectionError(error.code) }

  revalidateCorrection()
  return { ok: true, error: MESSAGES.rejected }
}

/** Withdraw a request (terminal); deletes an in-progress draft. */
export async function withdrawCorrection(requestId: string): Promise<ActionState> {
  if (!requestId) return { ok: false, error: MESSAGES.notFound }

  const supabase = await createClient()
  const { error } = await supabase.rpc('withdraw_correction', {
    p_request_id: requestId,
  })

  if (error) return { ok: false, error: mapCorrectionError(error.code) }

  revalidateCorrection()
  return { ok: true, error: MESSAGES.withdrawn }
}
