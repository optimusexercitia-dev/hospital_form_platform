'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/types/database'

/**
 * Response-fill server actions (Architecture Rules 9 & 10): start/resume a
 * draft, save a section's answers (incl. the warn-and-clear orphan delete),
 * save-and-exit, and submit. These wrap the M11 fill RPCs
 * (`start_or_resume_response`, `save_section_answers`) and the M5 submission
 * authority (`submit_response`) — the wizard never inlines supabase-js.
 *
 * All user-facing strings are pt-BR; raw Supabase/Postgres errors NEVER reach
 * the UI (CLAUDE.md §8). submit_response raises discriminated SQLSTATEs which
 * map to clear copy: P0010 (already submitted), P0011 (missing required), P0012
 * (missing sign-off — Phase 6), no_data_found (not found / not visible).
 *
 * SECURITY: RLS is the authority — every call uses the cookie (RLS-scoped)
 * client, and the M6 policies confine fills to the response's creator while
 * in_progress. On top of that, each action re-verifies server-side that the
 * caller is a MEMBER of the response's commission before writing (staff AND
 * staff_admin fill forms), so an unauthorized attempt returns a clean pt-BR
 * "forbidden" rather than leaning only on an RLS row-count of zero.
 */

export interface ActionState {
  ok: boolean
  error?: string
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  missingForm: 'Formulário não encontrado.',
  missingVersion: 'Versão não encontrada.',
  missingResponse: 'Resposta não encontrada.',
  notPublished: 'Este formulário não está disponível para preenchimento.',
  // discardResponse discriminated failures (standalone draft delete).
  discardNotDraft: 'Apenas rascunhos podem ser descartados.',
  discardCaseBound: 'Esta resposta pertence a um caso e não pode ser descartada aqui.',
  discarded: 'Rascunho descartado.',
  // supersedeResponseAction discriminated failures (SUP / ADR 0074)
  supersedeNotSubmitted: 'Apenas respostas enviadas podem ser corrigidas.',
  supersedeCaseBound: 'Esta resposta pertence a um caso; a correção é feita pela fase do caso.',
  supersedeAlreadyOpen: 'Já existe uma correção em andamento para esta resposta.',
  supersedeReasonRequired: 'Informe o motivo da correção.',
  supersedeCoherence: 'A correção deve manter a versão e a comissão da resposta original.',
  supersedeDraftInProgress:
    'Você já tem um preenchimento em andamento para esta versão do formulário; conclua ou descarte-o antes de corrigir.',
  supersedeUnavailable: 'O recurso de correção de envios não está disponível.',
  superseded: 'Correção iniciada. Revise e envie a nova versão.',
  // submit_response discriminated failures
  alreadySubmitted: 'Esta resposta já foi enviada.',
  missingRequired: 'Há perguntas obrigatórias sem resposta. Revise o formulário.',
  missingSignoff: 'Há seções pendentes de assinatura.',
  // save_section_answers cross-version guard (P0013)
  invalidData: 'Dados inválidos para este formulário.',
  // FF-2 (ADR 0089) matrix fill failures.
  riskIncomplete:
    'Informe a severidade e a probabilidade da matriz de risco.',
  matrixUnavailable: 'O recurso de matrizes não está disponível.',
  // sign_section discriminated failures
  signoffNotVisible: 'Esta seção não está disponível para assinatura.',
  signoffAlreadySigned: 'Esta seção já foi assinada.',
  // set_case_phase_result_override discriminated failures (phase-results)
  overrideNotAdjustable:
    'O resultado só pode ser ajustado enquanto a fase está ativa.',
  overrideResultInvalid: 'Opção de resultado inválida para esta comissão.',
  // phase-result-manual-mode: a MANUAL phase requires a result before submit.
  resultRequired: 'Selecione o resultado da fase antes de enviar.',
  // FF-1 repeating-group instance writers (ADR 0087; SQLSTATE lane HC0N*).
  // Static copy, per this module's rule that no raw Postgres message reaches the
  // UI — the RPCs raise their own pt-BR text (with the actual N interpolated) but
  // that stays server-side. The wizard already knows `config.maxInstances` and
  // disables the control; HC0N1 is the backstop for a stale client, not the
  // primary affordance.
  groupUnavailable: 'O recurso de blocos repetíveis não está disponível.',
  groupMaxInstances: 'Este bloco já atingiu o número máximo de itens.',
  groupInstanceMissing: 'Item do bloco não encontrado nesta resposta.',
  groupOrderInvalid: 'A nova ordem não corresponde aos itens deste bloco.',
  groupItemInvalid: 'Este item não é um bloco repetível deste formulário.',
  // success copy
  saved: 'Respostas salvas.',
  savedAndExited: 'Respostas salvas. Você pode continuar mais tarde.',
  submitted: 'Resposta enviada com sucesso.',
  signed: 'Seção assinada.',
} as const

/** Postgres / RPC SQLSTATEs we translate to friendly pt-BR copy. */
const PG_CHECK_VIOLATION = '23514'
const PG_NO_DATA_FOUND = 'P0002'
const PG_RLS_VIOLATION = '42501'
// Custom SQLSTATE class HC0xx (Hospital Commission). Was P00xx through Phase 6;
// renumbered in migration 20260613090009 so PostgREST 14 returns a 400 with the
// JSON {code,message} body (an unknown class) instead of a 500 that drops the
// body for non-ASCII messages. See docs/decisions/0018-custom-sqlstate-class.md.
const SUBMIT_ALREADY_SUBMITTED = 'HC010'
const SUBMIT_MISSING_REQUIRED = 'HC011'
const SUBMIT_MISSING_SIGNOFF = 'HC012'
/** save_section_answers cross-version guard (Phase-5 QA MINOR-2). */
const SAVE_CROSS_VERSION = 'HC013'
/** sign_section discriminated failures. */
const SIGN_NOT_VISIBLE = 'HC014'
const SIGN_ALREADY_SIGNED = 'HC015'
/** set_case_phase_result_override discriminated failures (phase-results). */
const OVERRIDE_PHASE_NOT_ADJUSTABLE = 'HC057'
const OVERRIDE_RESULT_INVALID = 'HC058'
/** phase-result-manual-mode: MANUAL phase submitted with no result (conclude). */
const SUBMIT_RESULT_REQUIRED = 'HC061'
/** phase-result-manual-mode: MANUAL phase result cleared (set-override). */
const OVERRIDE_RESULT_REQUIRED = 'HC062'
/** discard_response discriminated failures (standalone draft delete). */
const DISCARD_NOT_DRAFT = 'HC065'
const DISCARD_CASE_BOUND = 'HC066'
/** supersede_response discriminated failures (SUP / ADR 0074, SQLSTATE block HC0H0-HC0H9). */
const SUPERSEDE_NOT_SUBMITTED = 'HC0H0'
const SUPERSEDE_CASE_BOUND = 'HC0H1'
const SUPERSEDE_ALREADY_OPEN = 'HC0H2'
const SUPERSEDE_REASON_REQUIRED = 'HC0H3'
const SUPERSEDE_COHERENCE = 'HC0H4'
/** The caller already holds an in_progress draft of this form version (the
 * platform's one-draft-per-user-per-version invariant, responses_one_draft_per_user_idx). */
const SUPERSEDE_DRAFT_IN_PROGRESS = 'HC0H5'
/** FF-1 repeating-group instance writers (ADR 0087; lane HC0N*, above the live
 *  HC0M9 high-water — the HC09x digit lane is exhausted, see ADR 0087 Amdt 1). */
const GROUP_FLAG_OFF = 'HC0N0'
const GROUP_MAX_INSTANCES = 'HC0N1'
const GROUP_INSTANCE_NOT_FOUND = 'HC0N2'
const GROUP_ORDER_NOT_PERMUTATION = 'HC0N3'
const GROUP_ITEM_NOT_REPEATING = 'HC0N4'

// FF-2 (ADR 0089) — the matrix codes reachable through `save_section_answers`.
// HC0P0 (axis code immutable) and HC0P4/5/6 (draft-only / axis payload) cannot
// surface here: they belong to `upsert_matrix_axes` and to publish, which are
// builder paths in `src/lib/forms/actions.ts`.
const MATRIX_INCOHERENT_CELL = 'HC0P1'
const MATRIX_FLAG_OFF = 'HC0P2'
const MATRIX_NOT_A_MATRIX = 'HC0P3'
const MATRIX_UNKNOWN_CODE = 'HC0P7'
const MATRIX_RISK_INCOMPLETE = 'HC0P8'

/** The staff filling area — revalidated as dynamic-segment pages. */
const FORMS_LIST_PATH = '/o/[org]/c/[commission]/forms'
const RESPONDER_PATH = '/o/[org]/c/[commission]/forms/[formId]/responder/[responseId]'

function revalidateFill(): void {
  // [slug]/[formId]/[responseId] are literal Next.js dynamic-segment syntax,
  // not placeholders — 'page' scope matches every concrete path under each
  // route pattern.
  revalidatePath(FORMS_LIST_PATH, 'page')
  revalidatePath(RESPONDER_PATH, 'page')
}

/**
 * Authorize a fill action for a commission: admin, or ANY member (staff or
 * staff_admin) of that commission — both roles fill forms. RLS still backstops
 * every write; this yields the friendly pt-BR forbidden.
 */
async function authorizeMember(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.memberships.some((m) => m.commission.id === commissionId)
}

/** Resolve the commission behind a published form version (RLS-scoped read). */
async function commissionOfVersion(
  supabase: SupabaseClient<Database>,
  versionId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('form_versions')
    .select('forms(commission_id)')
    .eq('id', versionId)
    .maybeSingle<{ forms: { commission_id: string } | null }>()
  return data?.forms?.commission_id ?? null
}

/** Resolve {commissionId, formVersionId} behind a response (RLS-scoped read). */
async function contextOfResponse(
  supabase: SupabaseClient<Database>,
  responseId: string,
): Promise<{ commissionId: string; formVersionId: string } | null> {
  const { data } = await supabase
    .from('responses')
    .select('commission_id, form_version_id')
    .eq('id', responseId)
    .maybeSingle<{ commission_id: string; form_version_id: string }>()
  if (!data) return null
  return { commissionId: data.commission_id, formVersionId: data.form_version_id }
}

// ---------------------------------------------------------------------------
// start / resume
// ---------------------------------------------------------------------------

/** Result of start/resume — carries the response id to navigate the wizard to. */
export interface StartResponseState extends ActionState {
  responseId?: string
}

/**
 * Begin filling a published form, or resume the caller's existing in_progress
 * draft on that version (wraps `start_or_resume_response`; the RPC tolerates the
 * one-draft unique index under a double-click race and rejects non-published
 * versions). Returns the response id for navigation to the wizard.
 */
export async function startOrResumeResponse(
  formVersionId: string,
): Promise<StartResponseState> {
  if (!formVersionId) return { ok: false, error: MESSAGES.missingVersion }

  const supabase = await createClient()
  const commissionId = await commissionOfVersion(supabase, formVersionId)
  // A non-member cannot see the version (RLS) → null → forbidden, leaking
  // nothing about whether the version exists.
  if (!commissionId) return { ok: false, error: MESSAGES.forbidden }
  if (!(await authorizeMember(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  // start_or_resume_response returns a single responses row (not a set), so the
  // rpc data is the object directly — no .single().
  const { data, error } = await supabase.rpc('start_or_resume_response', {
    p_form_version_id: formVersionId,
  })

  if (error || !data) {
    // The RPC raises check_violation for a non-published version.
    if (error?.code === PG_CHECK_VIOLATION) {
      return { ok: false, error: MESSAGES.notPublished }
    }
    return { ok: false, error: MESSAGES.generic }
  }

  revalidateFill()
  return { ok: true, responseId: data.id }
}

// ---------------------------------------------------------------------------
// save section (+ orphan-clear)
// ---------------------------------------------------------------------------

/** The arguments shared by `saveSection` / `saveAndExit`. */
interface SaveSectionInput {
  responseId: string
  sectionId: string
  /**
   * form-model-normalization (BE-1 contract): SCALAR answers only — `number`,
   * `date`, `time`, `free_text`/`short_text`. Maps an answered scalar input
   * item's id → its jsonb value. Choice selections move to
   * {@link SaveSectionInput.selectionsByItemId}; a choice item's `value` is
   * always null now (its answer lives in `answer_selected_options`).
   */
  answersByItemId: Record<string, Json>
  /**
   * form-model-normalization (BE-1 contract): CHOICE selections — maps a choice
   * input item's id → the array of selected option **codes** (the clone-stable
   * `form_item_options.code`, NOT the row UUID and NOT the label). Single-select
   * (`multiple_choice`/`dropdown`) sends a one-element array; `checkbox` sends
   * zero-or-more. `save_section_answers` REPLACES the item's selection rows:
   * delete the item's existing rows, then insert one
   * `answer_selected_options` row per code (resolved to the option row's id,
   * validated to belong to the item). An item present here with an EMPTY array
   * clears its selections. An item absent is left untouched.
   */
  selectionsByItemId?: Record<string, string[]>
  clearItemIds?: string[]
  /**
   * form-builder-enhancements (decision #11): optional per-item observation
   * note, mapping an answered item's id → its observation text. Upserted into
   * `answers.observation` by `save_section_answers`. Optional and never blocks.
   * The evaluator/answer_map read only `value`/selections, so observations never
   * affect conditions; per Rule 11 the audit log never copies the text.
   */
  observationsByItemId?: Record<string, string>
  /**
   * "Outros" open option (form-builder-enhancements): optional per-item free-text
   * value typed when the item's reserved `__other__` option is selected, mapping a
   * multiple_choice/checkbox item's id → the typed text. Written to
   * `answers.other_text` by `save_section_answers` ONLY when that item's `__other__`
   * option is among its current selections (otherwise forced null). NON-analytic:
   * never fed to the evaluator, never aggregated. Optional and never blocks.
   */
  otherTextByItemId?: Record<string, string>
  /**
   * FF-1 (BE-0 contract, ADR 0087) — the INSTANCE-SCOPED arm: answers that belong
   * inside a repeating-group instance rather than at top level. Serialized into
   * the new `save_section_answers(p_instance_answers jsonb)` param, so a section
   * with N instances is still ONE round trip and one transaction (the ADR's
   * "save-path shape" question, settled: one payload).
   *
   * Each entry addresses an EXISTING instance by id — instances are created and
   * destroyed only by {@link addGroupInstance} / {@link removeGroupInstance}, never
   * implicitly by a save. Per-entry semantics are IDENTICAL to the top-level maps
   * above (upsert by item, REPLACE selections, `clearItemIds` deletes), only
   * scoped to that instance: `clearItemIds` here deletes the item's answer in THIS
   * instance ONLY (the top-level `clearItemIds` is likewise instance-blind by
   * design and untouched — ADR 0087 substrate correction 6 fixes its current
   * unscoped delete).
   *
   * Children of a plain `group` (ruling 6) go in the TOP-LEVEL maps, not here.
   */
  instances?: InstanceAnswersInput[]
  /**
   * FF-2 (BE contract, ADR 0089 ruling 1) — `matrix` answers: maps a matrix
   * item's id → `{ [rowCode]: colCode }`.
   *
   * Addressed by CODE on both axes, never by row/column id — codes survive
   * version clones, ids do not, exactly as {@link SaveSectionInput.selectionsByItemId}
   * carries option codes. The nested-object shape is also what makes ruling 1
   * ("each row takes exactly ONE column") unrepresentable-if-violated on the
   * wire, before `UNIQUE (answer_id, row_id)` ever has to catch it.
   *
   * REPLACE semantics per item, like selections: an item present here has its
   * WHOLE grid rewritten; an item present with `{}` is cleared; an item absent is
   * left untouched.
   */
  matrixCellsByItemId?: Record<string, Record<string, string>>
  /**
   * FF-2 (ADR 0089 ruling 2) — `risk_matrix` answers: maps a risk_matrix item's
   * id → `{ severity: <rowCode>, likelihood: <colCode> }`.
   *
   * ⚠ There is deliberately NO score field. `risk_score` is DERIVED SERVER-SIDE
   * as `severityRow.weight * likelihoodCol.weight`; a score sent by the client is
   * never read. Both halves are mandatory — sending one raises `HC0P8`.
   *
   * To DISPLAY the score/band before saving, compute it from the item's
   * `matrixRows`/`matrixColumns` weights and `config.riskBands` — never treat the
   * client-side number as authoritative.
   */
  riskMatrixByItemId?: Record<string, { severity: string; likelihood: string }>
}

/** FF-1 (BE-0 contract): one repeating-group instance's slice of a section save. */
export interface InstanceAnswersInput {
  /** An existing `response_group_instances.id` of THIS response. */
  instanceId: string
  answersByItemId: Record<string, Json>
  selectionsByItemId?: Record<string, string[]>
  clearItemIds?: string[]
  observationsByItemId?: Record<string, string>
  otherTextByItemId?: Record<string, string>
  /**
   * FF-2: a matrix that lives INSIDE this repeating-group instance. Identical
   * semantics to {@link SaveSectionInput.matrixCellsByItemId}, scoped to this
   * instance. A matrix at top level (or inside a plain `group`) goes in the
   * top-level map instead.
   */
  matrixCellsByItemId?: Record<string, Record<string, string>>
  /** FF-2: as {@link SaveSectionInput.riskMatrixByItemId}, scoped to this instance. */
  riskMatrixByItemId?: Record<string, { severity: string; likelihood: string }>
}

/**
 * Persist a section's answers and the wizard position in one atomic call (wraps
 * `save_section_answers`). `answersByItemId` maps each answered input item's id
 * to its jsonb value; `clearItemIds` (optional) is the warn-and-clear path — the
 * answered item ids of section(s) a controlling answer just hid, deleted in the
 * SAME call; `observationsByItemId` (optional) carries per-item observation
 * notes; `otherTextByItemId` (optional) carries the "Outro" free text. `sectionId`
 * is stored as `last_section_id` so resume lands here.
 *
 * Called on every section navigation, so it stays lean: authorize, then one RPC.
 */
export async function saveSection(input: SaveSectionInput): Promise<ActionState> {
  const {
    responseId,
    sectionId,
    answersByItemId,
    selectionsByItemId,
    clearItemIds,
    observationsByItemId,
    otherTextByItemId,
    instances,
    matrixCellsByItemId,
    riskMatrixByItemId,
  } = input
  if (!responseId || !sectionId) {
    return { ok: false, error: MESSAGES.missingResponse }
  }

  const supabase = await createClient()
  const ctx = await contextOfResponse(supabase, responseId)
  if (!ctx) return { ok: false, error: MESSAGES.missingResponse }
  if (!(await authorizeMember(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const hasObservations =
    observationsByItemId != null && Object.keys(observationsByItemId).length > 0
  const hasSelections =
    selectionsByItemId != null && Object.keys(selectionsByItemId).length > 0
  const hasOtherText =
    otherTextByItemId != null && Object.keys(otherTextByItemId).length > 0

  // FF-1 (BUG-FF1-005): the instance arm. This is a TRANSLATION, not a
  // pass-through — `InstanceAnswersInput` is camelCase for the TS callers while
  // `app.save_instance_answers` reads snake_case keys off each entry
  // (`instance_id`, `answers`, `selections`, `observations`, `other_text`,
  // `clear_item_ids`), mirroring the RPC's own parameter names. Forwarding the
  // objects verbatim would be just as broken as dropping them: the RPC would
  // find no `instance_id` and raise HC0N2 on every save.
  const instanceAnswers =
    instances && instances.length > 0
      ? instances.map((entry) => ({
          instance_id: entry.instanceId,
          answers: entry.answersByItemId ?? {},
          selections: entry.selectionsByItemId ?? {},
          observations: entry.observationsByItemId ?? {},
          other_text: entry.otherTextByItemId ?? {},
          clear_item_ids: entry.clearItemIds ?? [],
          // FF-2: same camelCase → snake_case translation as the five above.
          // `app.save_instance_answers` reads `matrix_cells` / `risk_matrix` off
          // the entry; a verbatim forward would silently write nothing.
          matrix_cells: entry.matrixCellsByItemId ?? {},
          risk_matrix: entry.riskMatrixByItemId ?? {},
        }))
      : undefined

  const hasMatrixCells =
    matrixCellsByItemId != null && Object.keys(matrixCellsByItemId).length > 0
  const hasRiskMatrix =
    riskMatrixByItemId != null && Object.keys(riskMatrixByItemId).length > 0

  // form-model-normalization: `save_section_answers` carries `p_selections jsonb`
  // (item_id -> array of option codes, REPLACE semantics) alongside the scalar
  // p_answers / observations / clear paths.
  const { error } = await supabase.rpc('save_section_answers', {
    p_response_id: responseId,
    p_section_id: sectionId,
    p_answers: answersByItemId as Json,
    // generated Args types p_clear_item_ids as optional string[]; omit when empty.
    p_clear_item_ids:
      clearItemIds && clearItemIds.length > 0 ? clearItemIds : undefined,
    // p_observations: per-item observation upsert; omit when none.
    p_observations: hasObservations ? (observationsByItemId as Json) : undefined,
    // p_selections: choice selections by item id; omit when none.
    p_selections: hasSelections ? (selectionsByItemId as Json) : undefined,
    // p_other_text: per-item "Outro" free text; written only when the item's
    // __other__ option is selected. Omit when none.
    p_other_text: hasOtherText ? (otherTextByItemId as Json) : undefined,
    // p_instance_answers: FF-1 repeating-group instances — one entry per touched
    // instance, so a section with N instances is still ONE round trip and one
    // transaction. Omit when none.
    p_instance_answers: instanceAnswers as Json | undefined,
    // p_matrix_cells / p_risk_matrix: FF-2 top-level matrix answers. Both are
    // written by DEFINER helpers inside the same transaction as everything above
    // (the four matrix tables are SELECT-only for `authenticated` — K9), so a
    // section holding a matrix is still ONE round trip. Omit when none.
    p_matrix_cells: hasMatrixCells ? (matrixCellsByItemId as Json) : undefined,
    p_risk_matrix: hasRiskMatrix ? (riskMatrixByItemId as Json) : undefined,
  })

  if (error) {
    // P0013 = cross-version item/section guard (a malformed client, not a legit
    // user); check_violation = the response is already submitted. Distinct codes
    // since Phase 6 (Phase-5 QA MINOR-2) so the cross-version case is no longer
    // mislabelled "Esta resposta já foi enviada."
    if (error.code === SAVE_CROSS_VERSION) {
      return { ok: false, error: MESSAGES.invalidData }
    }
    if (error.code === PG_CHECK_VIOLATION) {
      return { ok: false, error: MESSAGES.alreadySubmitted }
    }
    if (error.code === PG_NO_DATA_FOUND) {
      return { ok: false, error: MESSAGES.missingResponse }
    }
    // FF-1 (ADR 0087) — OUT-OF-PHASE FIX, ruled in by the lead during FF-2's
    // gate. `app.save_instance_answers` raises HC0N2 for both "entry with no
    // instance_id" and "that instance is not of this response", and this chain
    // dropped both into the generic retry copy — a live user-facing pt-BR defect
    // in a shipped phase. `mapGroupError` (used by the three instance RPCs)
    // already maps HC0N2; `saveSection` simply never consulted it, so this was
    // the same within-one-file inconsistency as BUG-FF2-002.
    //
    // The DB message is preferred because the two raises say DIFFERENT things
    // and the constant can only say one of them.
    if (error.code === GROUP_INSTANCE_NOT_FOUND) {
      return { ok: false, error: error.message || MESSAGES.groupInstanceMissing }
    }
    // FF-2 (ADR 0089) — the SIBLINGS of BUG-FF2-002, found by sweeping every
    // HC0P* raise site against the paths that can surface it. The matrix arms of
    // `save_section_answers` raise four codes this chain would have collapsed
    // into "Não foi possível concluir. Tente novamente."
    //
    // HC0P8 is the one that matters most: it is USER-ACTIONABLE and reachable by
    // ordinary use — a respondent who picks a severity but not a likelihood.
    // Its DB message ("informe a severidade e a probabilidade da matriz de
    // risco") is already the right pt-BR sentence, so it is preferred.
    if (error.code === MATRIX_RISK_INCOMPLETE) {
      return { ok: false, error: error.message || MESSAGES.riskIncomplete }
    }
    if (error.code === MATRIX_FLAG_OFF) {
      return { ok: false, error: MESSAGES.matrixUnavailable }
    }
    // Unknown row/column code, an item that is not a matrix of this version, or
    // the coherence trigger firing: all malformed-client states, not user error
    // — the same bucket SAVE_CROSS_VERSION already occupies.
    if (error.code === MATRIX_UNKNOWN_CODE || error.code === MATRIX_NOT_A_MATRIX) {
      return { ok: false, error: MESSAGES.invalidData }
    }
    if (error.code === MATRIX_INCOHERENT_CELL) {
      return { ok: false, error: MESSAGES.invalidData }
    }
    // `app.assert_matrix_answer_writable` is a DEFINER gate, so it raises 42501
    // rather than yielding an RLS zero-row silence. Without this the owner check
    // reads as a transient failure.
    if (error.code === PG_RLS_VIOLATION) {
      return { ok: false, error: MESSAGES.forbidden }
    }
    return { ok: false, error: MESSAGES.generic }
  }

  revalidateFill()
  return { ok: true, error: MESSAGES.saved }
}

/**
 * "Salvar e sair": save the current section, then signal the UI to leave the
 * wizard (the redirect/navigation is the caller's job). Identical persistence to
 * `saveSection`; the distinct success copy lets the UI confirm the exit.
 */
export async function saveAndExit(input: SaveSectionInput): Promise<ActionState> {
  const result = await saveSection(input)
  if (!result.ok) return result
  return { ok: true, error: MESSAGES.savedAndExited }
}

// ---------------------------------------------------------------------------
// FF-1 — repeating-group instance lifecycle (BE-0 CONTRACT-FIRST STUBS)
// ---------------------------------------------------------------------------
//
// The three instance writers (ADR 0087 ruling 5). They are **INVOKER** RPCs, not
// DEFINER doors: `response_group_instances` carries `authenticated=arwdDxtm` under
// a `FOR ALL` own-draft policy, exactly like `answers`, so **RLS stays the security
// boundary** (Rule 1) and these RPCs are CORRECTNESS doors. They exist because the
// position uniqueness is a real constraint the client cannot satisfy piecewise:
// `add` needs `max(position)+1` together with the `maxInstances` check atomically,
// and `remove`/`reorder` rewrite several positions in one statement-safe pass.
//
// Every one is draft-only and creator-only (the RLS policy).
//
// Each follows `saveSection`'s shape exactly — authorize the commission, call the
// RPC, translate the discriminated SQLSTATE to pt-BR, revalidate. The authorize
// step never REPLACES RLS; it turns an RLS zero-row silence into readable copy.
//
// Covered by `actions.test.ts`, which drives THESE functions against a mocked
// client rather than the RPCs directly. That distinction is the whole point:
// lint, typecheck, `next build`, the unit suite and 3919 pgTAP assertions were
// all green while these three were `throw new Error('not implemented')`, because
// not one of those gates crosses the seam between the UI and the database.

/** {@link addGroupInstance} result — carries the new instance so the wizard can
 * render and focus it without a refetch. */
export interface AddGroupInstanceState extends ActionState {
  /** `response_group_instances.id` of the created instance (on `ok`). */
  instanceId?: string
  /** Its 0-based position within the group (on `ok`). */
  position?: number
}

/**
 * Append one instance to a repeating group of an `in_progress` response, at
 * `max(position) + 1`. Fails with a pt-BR message when the group's
 * `config.maxInstances` is already reached, when the item is not a
 * `repeating_group` of this response's version, or when the response is not the
 * caller's own draft.
 *
 * Wraps the INVOKER RPC `public.add_group_instance(p_response_id, p_group_item_id)`.
 */
export async function addGroupInstance(input: {
  responseId: string
  groupItemId: string
}): Promise<AddGroupInstanceState> {
  const { responseId, groupItemId } = input
  if (!responseId || !groupItemId) {
    return { ok: false, error: MESSAGES.missingResponse }
  }

  const supabase = await createClient()
  const ctx = await contextOfResponse(supabase, responseId)
  if (!ctx) return { ok: false, error: MESSAGES.missingResponse }
  if (!(await authorizeMember(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  // Returns the composite `response_group_instances` row directly (not a set), so
  // `data` is the object — the `start_or_resume_response` precedent, no .single().
  const { data, error } = await supabase.rpc('add_group_instance', {
    p_response_id: responseId,
    p_group_item_id: groupItemId,
  })

  if (error || !data) {
    return { ok: false, error: mapGroupError(error) }
  }

  revalidateFill()
  return { ok: true, instanceId: data.id, position: data.position }
}

/**
 * Delete one instance and everything answered inside it (`answers` cascade via
 * `answers.group_instance_id`), then RE-PACK the group's remaining positions to
 * stay contiguous `0..n-1`. Deleting is the only way an author removes an
 * accidental blank row before submit; a blank row left behind is pruned by
 * `submit_response` anyway (ruling 3), so this never blocks a submit.
 *
 * Wraps the INVOKER RPC `public.remove_group_instance(p_response_id, p_instance_id)`.
 */
export async function removeGroupInstance(input: {
  responseId: string
  instanceId: string
}): Promise<ActionState> {
  const { responseId, instanceId } = input
  if (!responseId || !instanceId) {
    return { ok: false, error: MESSAGES.missingResponse }
  }

  const supabase = await createClient()
  const ctx = await contextOfResponse(supabase, responseId)
  if (!ctx) return { ok: false, error: MESSAGES.missingResponse }
  if (!(await authorizeMember(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('remove_group_instance', {
    p_response_id: responseId,
    p_instance_id: instanceId,
  })

  if (error) return { ok: false, error: mapGroupError(error) }

  revalidateFill()
  return { ok: true }
}

/**
 * Set the group's instance order to exactly `instanceIds` (positions `0..n-1` in
 * array order). `instanceIds` MUST be a permutation of the group's current
 * instances — a missing or foreign id is rejected in pt-BR rather than silently
 * dropping rows.
 *
 * Wraps the INVOKER RPC
 * `public.reorder_group_instances(p_response_id, p_group_item_id, p_instance_ids)`.
 */
export async function reorderGroupInstances(input: {
  responseId: string
  groupItemId: string
  instanceIds: string[]
}): Promise<ActionState> {
  const { responseId, groupItemId, instanceIds } = input
  if (!responseId || !groupItemId || !Array.isArray(instanceIds)) {
    return { ok: false, error: MESSAGES.missingResponse }
  }

  const supabase = await createClient()
  const ctx = await contextOfResponse(supabase, responseId)
  if (!ctx) return { ok: false, error: MESSAGES.missingResponse }
  if (!(await authorizeMember(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  // The RPC is the authority on "is this a permutation" (HC0N3) — deliberately
  // NOT re-derived here, where it would drift from the set the database sees.
  const { error } = await supabase.rpc('reorder_group_instances', {
    p_response_id: responseId,
    p_group_item_id: groupItemId,
    p_instance_ids: instanceIds,
  })

  if (error) return { ok: false, error: mapGroupError(error) }

  revalidateFill()
  return { ok: true }
}

/**
 * Translate a repeating-group RPC failure to pt-BR. One mapper for all three so
 * they cannot drift on what a given SQLSTATE means to the user.
 *
 * `check_violation` here is always "the response is no longer a draft" —
 * `app.assert_group_writable` raises it for exactly that, and the schema-level
 * CHECKs it could otherwise collide with are unreachable from these three RPCs.
 */
function mapGroupError(error: { code?: string } | null): string {
  switch (error?.code) {
    case GROUP_FLAG_OFF:
      return MESSAGES.groupUnavailable
    case GROUP_MAX_INSTANCES:
      return MESSAGES.groupMaxInstances
    case GROUP_INSTANCE_NOT_FOUND:
      return MESSAGES.groupInstanceMissing
    case GROUP_ORDER_NOT_PERMUTATION:
      return MESSAGES.groupOrderInvalid
    case GROUP_ITEM_NOT_REPEATING:
      return MESSAGES.groupItemInvalid
    case PG_CHECK_VIOLATION:
      return MESSAGES.alreadySubmitted
    case PG_NO_DATA_FOUND:
      return MESSAGES.missingResponse
    case PG_RLS_VIOLATION:
      return MESSAGES.forbidden
    default:
      return MESSAGES.generic
  }
}

// ---------------------------------------------------------------------------
// submit
// ---------------------------------------------------------------------------

/**
 * Submit a response through the single submission authority
 * (`submit_response`): server-side visibility eval, required-answer check,
 * stray-answer cleanup, atomic status flip (sign-off check is feature-flagged
 * OFF until Phase 6). Maps the RPC's discriminated SQLSTATEs to pt-BR; a raw PG
 * error never reaches the UI. Client-side wizard validation is UX only — this is
 * the authority (e.g. a required answer removed in a second tab is rejected
 * HERE).
 */
export async function submitResponse(responseId: string): Promise<ActionState> {
  if (!responseId) return { ok: false, error: MESSAGES.missingResponse }

  const supabase = await createClient()
  const ctx = await contextOfResponse(supabase, responseId)
  if (!ctx) return { ok: false, error: MESSAGES.missingResponse }
  if (!(await authorizeMember(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('submit_response', {
    p_response_id: responseId,
  })

  if (error) {
    switch (error.code) {
      case SUBMIT_ALREADY_SUBMITTED:
        return { ok: false, error: MESSAGES.alreadySubmitted }
      case SUBMIT_MISSING_REQUIRED:
        return { ok: false, error: MESSAGES.missingRequired }
      case SUBMIT_MISSING_SIGNOFF:
        return { ok: false, error: MESSAGES.missingSignoff }
      case SUBMIT_RESULT_REQUIRED:
        return { ok: false, error: MESSAGES.resultRequired }
      case PG_NO_DATA_FOUND:
        return { ok: false, error: MESSAGES.missingResponse }
      default:
        return { ok: false, error: MESSAGES.generic }
    }
  }

  revalidateFill()
  return { ok: true, error: MESSAGES.submitted }
}

/**
 * Submit a CASE-PHASE response with an optional per-phase result OVERRIDE
 * (phase-results feature). Used by the case-phase responder wizard's final step;
 * the standalone-form path keeps calling plain {@link submitResponse}.
 *
 * Flow (task #4 implementation):
 *   1. Authorize membership of the response's commission (existing pattern).
 *   2. If `overrideResultId` is chosen (or explicitly cleared via `null`), call
 *      `set_case_phase_result_override(casePhaseId, overrideResultId, reason)` —
 *      a deliberate write on the still-`active` phase BEFORE submit. Per Rule 11
 *      the free-text `reason` is audited as a fact only, never copied into the
 *      payload.
 *   3. Call the UNCHANGED `submit_response` RPC; its conclusion trigger
 *      computes/honors the result atomically.
 *   4. Map errors to pt-BR (reuse HC010/011/012 + new override SQLSTATEs).
 *
 * `overrideResultId === null` means "clear any stashed override → fall back to the
 * computed path"; `undefined` means "leave the override untouched". `reason` is
 * the optional override justification (ignored when no override is set).
 */
export async function submitCasePhaseResponse(
  responseId: string,
  casePhaseId: string,
  overrideResultId: string | null | undefined,
  reason: string | null,
): Promise<ActionState> {
  if (!responseId) return { ok: false, error: MESSAGES.missingResponse }

  const supabase = await createClient()
  const ctx = await contextOfResponse(supabase, responseId)
  if (!ctx) return { ok: false, error: MESSAGES.missingResponse }
  if (!(await authorizeMember(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  // Stash / clear the override on the still-`active` phase BEFORE submit. `undefined`
  // leaves any existing override untouched (skip the call entirely).
  if (overrideResultId !== undefined && casePhaseId) {
    const { error: overrideError } = await supabase.rpc(
      'set_case_phase_result_override',
      {
        p_case_phase_id: casePhaseId,
        // `null` (clear) is a valid argument — the RPC's p_result_id has DEFAULT
        // NULL — but supabase-gen typed this mid-list defaulted param as required
        // `string`. Cast to satisfy the stricter generated type while still passing
        // the real null. `??  undefined` would WRONGLY clear when caller passed null.
        p_result_id: overrideResultId as unknown as string,
        p_reason: reason ?? undefined,
      },
    )
    if (overrideError) {
      switch (overrideError.code) {
        case OVERRIDE_PHASE_NOT_ADJUSTABLE:
          return { ok: false, error: MESSAGES.overrideNotAdjustable }
        case OVERRIDE_RESULT_INVALID:
          return { ok: false, error: MESSAGES.overrideResultInvalid }
        case OVERRIDE_RESULT_REQUIRED:
          return { ok: false, error: MESSAGES.resultRequired }
        case PG_RLS_VIOLATION:
          return { ok: false, error: MESSAGES.forbidden }
        case PG_NO_DATA_FOUND:
          return { ok: false, error: MESSAGES.missingResponse }
        default:
          return { ok: false, error: MESSAGES.generic }
      }
    }
  }

  // Submit — the UNCHANGED authority; its conclusion trigger computes/honors the
  // result atomically.
  const { error } = await supabase.rpc('submit_response', {
    p_response_id: responseId,
  })

  if (error) {
    switch (error.code) {
      case SUBMIT_ALREADY_SUBMITTED:
        return { ok: false, error: MESSAGES.alreadySubmitted }
      case SUBMIT_MISSING_REQUIRED:
        return { ok: false, error: MESSAGES.missingRequired }
      case SUBMIT_MISSING_SIGNOFF:
        return { ok: false, error: MESSAGES.missingSignoff }
      case SUBMIT_RESULT_REQUIRED:
        return { ok: false, error: MESSAGES.resultRequired }
      case PG_NO_DATA_FOUND:
        return { ok: false, error: MESSAGES.missingResponse }
      default:
        return { ok: false, error: MESSAGES.generic }
    }
  }

  revalidateFill()
  return { ok: true, error: MESSAGES.submitted }
}

// ---------------------------------------------------------------------------
// discard draft (standalone forms only)
// ---------------------------------------------------------------------------

/**
 * Permanently discard the caller's OWN in_progress draft response for a
 * STANDALONE form (a response NOT linked to a case, i.e. `case_phase_id IS
 * NULL`). Wraps the `discard_response` RPC — the single authority — which
 * verifies ownership + in_progress + standalone, deletes the row (answers /
 * selections / sign-offs cascade), and emits an audit row (Rule 11: records
 * that a draft was discarded + who; never copies answer payloads).
 *
 * Submitted responses stay immutable (the `guard_submitted_response` BEFORE
 * DELETE trigger blocks deleting a submitted row). Case-bound responses are
 * refused here so a draft phase can't be discarded via the standalone path.
 *
 * Maps the RPC's discriminated SQLSTATEs to pt-BR: HC065 (not a draft), HC066
 * (case-bound), no_data_found (not found / not owned / not visible under RLS),
 * check_violation (submitted → immutable). A raw PG error never reaches the UI.
 */
export async function discardResponse(responseId: string): Promise<ActionState> {
  if (!responseId) return { ok: false, error: MESSAGES.missingResponse }

  const supabase = await createClient()

  const { error } = await supabase.rpc('discard_response', {
    p_response_id: responseId,
  })

  if (error) {
    switch (error.code) {
      case DISCARD_NOT_DRAFT:
        return { ok: false, error: MESSAGES.discardNotDraft }
      case DISCARD_CASE_BOUND:
        return { ok: false, error: MESSAGES.discardCaseBound }
      case PG_CHECK_VIOLATION:
        // guard_submitted_response fired (submitted → immutable delete).
        return { ok: false, error: MESSAGES.discardNotDraft }
      case PG_NO_DATA_FOUND:
        return { ok: false, error: MESSAGES.missingResponse }
      case PG_RLS_VIOLATION:
        return { ok: false, error: MESSAGES.forbidden }
      default:
        return { ok: false, error: MESSAGES.generic }
    }
  }

  // The discarded draft leaves the standalone forms list; revalidate it.
  revalidateFill()
  return { ok: true, error: MESSAGES.discarded }
}

// ---------------------------------------------------------------------------
// supersede (correct a standalone submitted response) — SUP / ADR 0074
// ---------------------------------------------------------------------------

/** Result of `supersedeResponseAction` — carries the new successor's id so the
 * caller routes the wizard straight into it (mirrors `StartResponseState`). */
export interface SupersedeResponseState extends ActionState {
  successorId?: string
}

/** The submitted-response detail page revalidates alongside the fill area. */
const SUBMISSIONS_DETAIL_PATH =
  '/o/[org]/c/[commission]/dashboard/submissions/[responseId]'

/**
 * Correct a standalone SUBMITTED response by creating a new `in_progress`
 * SUCCESSOR that supersedes it (wraps `supersede_response` — the single
 * authority; SUP / ADR 0074). Reads `responseId` + `reason` (mandatory) from
 * `formData` — the `useActionState`-as-prop pattern (mirrors
 * `supersedeDocument`/`SupersedeDocumentButton`), so the confirm dialog's
 * "Motivo da correção" textarea posts here.
 *
 * The RPC copies the predecessor's answers + selections into the new draft
 * (correct-in-place ergonomics — the corrector edits what was wrong rather
 * than re-keying from scratch) and pre-links `supersedes_id`; the predecessor
 * row is NEVER written. Maps the RPC's discriminated SQLSTATEs to pt-BR:
 * HC0H0 (not submitted), HC0H1 (case-bound), HC0H2 (a live successor already
 * exists), HC0H3 (blank reason), HC0H4 (coherence — should not surface for a
 * well-formed client call, but mapped defensively), 42501 (not staff_admin/
 * commission-admin of the commission), no_data_found (not visible),
 * check_violation (the `response_correction` flag is OFF — the affordance
 * must not render in that case, but the RPC refuses regardless). A raw PG
 * error never reaches the UI.
 */
export async function supersedeResponseAction(
  _prev: SupersedeResponseState | undefined,
  formData: FormData,
): Promise<SupersedeResponseState> {
  const responseId = String(formData.get('responseId') ?? '')
  const reason = String(formData.get('reason') ?? '')
  if (!responseId) return { ok: false, error: MESSAGES.missingResponse }
  if (!reason.trim()) return { ok: false, error: MESSAGES.supersedeReasonRequired }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('supersede_response', {
    p_response_id: responseId,
    p_reason: reason,
  })

  if (error || !data) {
    switch (error?.code) {
      case SUPERSEDE_NOT_SUBMITTED:
        return { ok: false, error: MESSAGES.supersedeNotSubmitted }
      case SUPERSEDE_CASE_BOUND:
        return { ok: false, error: MESSAGES.supersedeCaseBound }
      case SUPERSEDE_ALREADY_OPEN:
        return { ok: false, error: MESSAGES.supersedeAlreadyOpen }
      case SUPERSEDE_REASON_REQUIRED:
        return { ok: false, error: MESSAGES.supersedeReasonRequired }
      case SUPERSEDE_COHERENCE:
        return { ok: false, error: MESSAGES.supersedeCoherence }
      case SUPERSEDE_DRAFT_IN_PROGRESS:
        return { ok: false, error: MESSAGES.supersedeDraftInProgress }
      case PG_CHECK_VIOLATION:
        // app.assert_response_correction_enabled() fired (flag OFF).
        return { ok: false, error: MESSAGES.supersedeUnavailable }
      case PG_NO_DATA_FOUND:
        return { ok: false, error: MESSAGES.missingResponse }
      case PG_RLS_VIOLATION:
        return { ok: false, error: MESSAGES.forbidden }
      default:
        return { ok: false, error: MESSAGES.generic }
    }
  }

  revalidateFill()
  revalidatePath(SUBMISSIONS_DETAIL_PATH, 'page')
  return { ok: true, error: MESSAGES.superseded, successorId: data.id }
}

// ---------------------------------------------------------------------------
// sign section
// ---------------------------------------------------------------------------

/** The sign-off queue + review-and-sign screens revalidate alongside the fill. */
const SIGNOFF_QUEUE_PATH = '/o/[org]/c/[commission]/manage/assinaturas'
const SIGNOFF_REVIEW_PATH = '/o/[org]/c/[commission]/manage/assinaturas/[responseId]'

/**
 * Record a sign-off on a `requires_signoff` section of an in_progress response
 * (wraps the `sign_section` RPC). Backs BOTH ends:
 *   - the respondent confirms their own `respondent`-role section (wizard);
 *   - a staff_admin counter-signs a `staff_admin`-role section (queue).
 *
 * NO server-side pre-check here (deliberate — fixes P6-001). `sign_section` +
 * the `signoffs_insert` RLS policy are the COMPLETE authority for WHO may sign
 * (respondent → creator; staff_admin → is_staff_admin_of; signed_by =
 * auth.uid(); in_progress; requires_signoff; visible). A pre-resolve of the
 * commission via the RLS-scoped `responses` read would WRONGLY fail the
 * legitimate staff_admin counter-signer: `responses_select` hides another
 * member's in_progress response from a staff_admin (the Phase-7 invariant we
 * preserve), so that read returns null and the action would 404 before ever
 * calling the RPC. Instead we call the RPC directly and map its discriminated
 * failures: 42501 (the signer-role rule rejected the insert) → forbidden; P0014
 * (section hidden under the response's answers) → not-available; P0015 (unique
 * race) → already-signed; no_data_found → not found. A raw PG error never reaches
 * the UI.
 */
export async function signSection(input: {
  responseId: string
  sectionId: string
  note?: string | null
}): Promise<ActionState> {
  const { responseId, sectionId, note } = input
  if (!responseId || !sectionId) {
    return { ok: false, error: MESSAGES.missingResponse }
  }

  const supabase = await createClient()

  const { error } = await supabase.rpc('sign_section', {
    p_response_id: responseId,
    p_section_id: sectionId,
    // generated Args types p_note as optional; omit when empty.
    p_note: note && note.trim().length > 0 ? note : undefined,
  })

  if (error) {
    switch (error.code) {
      case PG_RLS_VIOLATION:
        // The signer-role rule rejected the insert (wrong role for this section).
        return { ok: false, error: MESSAGES.forbidden }
      case SIGN_NOT_VISIBLE:
        return { ok: false, error: MESSAGES.signoffNotVisible }
      case SIGN_ALREADY_SIGNED:
        return { ok: false, error: MESSAGES.signoffAlreadySigned }
      case PG_NO_DATA_FOUND:
        return { ok: false, error: MESSAGES.missingResponse }
      case PG_CHECK_VIOLATION:
        // Already submitted / section doesn't require a sign-off / wrong version.
        return { ok: false, error: MESSAGES.generic }
      default:
        return { ok: false, error: MESSAGES.generic }
    }
  }

  revalidateFill()
  revalidatePath(SIGNOFF_QUEUE_PATH, 'page')
  revalidatePath(SIGNOFF_REVIEW_PATH, 'page')
  return { ok: true, error: MESSAGES.signed }
}
