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
  // submit_response discriminated failures
  alreadySubmitted: 'Esta resposta já foi enviada.',
  missingRequired: 'Há perguntas obrigatórias sem resposta. Revise o formulário.',
  missingSignoff: 'Há seções pendentes de assinatura.',
  // save_section_answers cross-version guard (P0013)
  invalidData: 'Dados inválidos para este formulário.',
  // sign_section discriminated failures
  signoffNotVisible: 'Esta seção não está disponível para assinatura.',
  signoffAlreadySigned: 'Esta seção já foi assinada.',
  // set_case_phase_result_override discriminated failures (phase-results)
  overrideNotAdjustable:
    'O resultado só pode ser ajustado enquanto a fase está ativa.',
  overrideResultInvalid: 'Opção de resultado inválida para esta comissão.',
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

/** The staff filling area — revalidated as dynamic-segment pages. */
const FORMS_LIST_PATH = '/c/[slug]/forms'
const RESPONDER_PATH = '/c/[slug]/forms/[formId]/responder/[responseId]'

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
  answersByItemId: Record<string, Json>
  clearItemIds?: string[]
  /**
   * form-builder-enhancements (decision #11): optional per-item observation
   * note, mapping an answered NON-free-text item's id → its observation text.
   * Upserted into `answers.observation` by `save_section_answers`. Optional and
   * never blocks. The evaluator/answer_map read only `value`, so observations
   * never affect conditions; per Rule 11 the audit log never copies the text.
   */
  observationsByItemId?: Record<string, string>
}

/**
 * Persist a section's answers and the wizard position in one atomic call (wraps
 * `save_section_answers`). `answersByItemId` maps each answered input item's id
 * to its jsonb value; `clearItemIds` (optional) is the warn-and-clear path — the
 * answered item ids of section(s) a controlling answer just hid, deleted in the
 * SAME call; `observationsByItemId` (optional) carries per-item observation
 * notes. `sectionId` is stored as `last_section_id` so resume lands here.
 *
 * Called on every section navigation, so it stays lean: authorize, then one RPC.
 */
export async function saveSection(input: SaveSectionInput): Promise<ActionState> {
  const { responseId, sectionId, answersByItemId, clearItemIds, observationsByItemId } =
    input
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

  const { error } = await supabase.rpc('save_section_answers', {
    p_response_id: responseId,
    p_section_id: sectionId,
    p_answers: answersByItemId as Json,
    // generated Args types p_clear_item_ids as optional string[]; omit when empty.
    p_clear_item_ids:
      clearItemIds && clearItemIds.length > 0 ? clearItemIds : undefined,
    // p_observations (BE-4): per-item observation upsert; omit when none so the
    // common save path is unaffected.
    p_observations: hasObservations ? (observationsByItemId as Json) : undefined,
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
 *      a deliberate write on the still-`ativa` phase BEFORE submit. Per Rule 11
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

  // Stash / clear the override on the still-`ativa` phase BEFORE submit. `undefined`
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
// sign section
// ---------------------------------------------------------------------------

/** The sign-off queue + review-and-sign screens revalidate alongside the fill. */
const SIGNOFF_QUEUE_PATH = '/c/[slug]/manage/assinaturas'
const SIGNOFF_REVIEW_PATH = '/c/[slug]/manage/assinaturas/[responseId]'

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
