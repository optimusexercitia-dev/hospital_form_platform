'use server'

import { revalidatePath } from 'next/cache'

import { canConfigureCommissionById, getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { PhaseResultColorToken } from '@/lib/queries/phase-results'

/**
 * Per-phase RESULT server actions (phase-results feature): manage a commission's
 * result VOCABULARY (create / update / reorder / archive) and apply a manual
 * result OVERRIDE to a case phase. Mirrors `@/lib/cases/outcomes-actions` (the
 * outcome vocabulary), but result options carry only the `isAdverse` tracking flag
 * (no `requiresActionPlan`).
 *
 * Architecture Rules 9 & 10: all mutations go through vetted RPCs; user-facing
 * strings are pt-BR; raw Postgres errors never reach the UI (CLAUDE.md §8).
 *
 * ⚠ The VOCABULARY RPCs gate on the `case_phase_results` flag + `is_staff_admin_of`.
 * `set_case_phase_result_override` does NOT: it is two branches, and its `active`
 * branch also admits the phase's own assignee. Do not describe the two as one rule —
 * that conflation is what produced FUP-CASE-PHASE-RESULT-ASSIGNEE-UNDERGRANT.
 *
 * The override flows through TWO server actions, both landing on that same RPC and
 * both membership-authorized, leaving the door as the authority: the END-OF-WIZARD
 * override is folded into `submitCasePhaseResponse` (`@/lib/responses/actions`); the
 * case-detail entry point (an `active` phase's assignee or a coordinator; a
 * `completed` phase's coordinator) is `overrideCasePhaseResult` here.
 */

export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/** A `create`/`update` result-definition input (label + presentation + flag). */
export interface PhaseResultInput {
  label: string
  colorToken: PhaseResultColorToken
  /** Adverse-signal tracking flag (non-gating; feeds a future "% por resultado" tile). */
  isAdverse: boolean
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  missingCommission: 'Comissão não encontrada.',
  missingResult: 'Resultado não encontrado.',
  missingCase: 'Caso não encontrado.',
  labelRequired: 'Informe o nome do resultado.',
  labelTaken: 'Já existe um resultado com esse nome nesta comissão.',
  // override RPC discriminated failures
  phaseNotAdjustable: 'O resultado só pode ser ajustado em uma fase ativa ou concluída.',
  // HC058 covers TWO distinct rejections; the RPC raises the precise pt-BR message
  // for each (surfaced via `error.message`), and these are the fallbacks:
  //   - the chosen option is archived / not in the commission's vocabulary;
  resultInvalid: 'Opção de resultado inválida para esta comissão.',
  //   - the chosen option is valid for the commission but NOT in THIS phase's
  //     manual subset (the subset-aware picker prevents this; a stale page can hit it).
  resultNotInPhaseSubset:
    'O resultado escolhido não está entre as opções permitidas para esta fase.',
  // HC062 — a manual phase's result is mandatory and cannot be cleared.
  resultMandatory: 'O resultado desta fase é obrigatório e não pode ser removido.',
  caseTerminal: 'Este caso está em um estado final e não pode mais ser alterado.',
  // success copy
  resultCreated: 'Resultado criado com sucesso.',
  resultUpdated: 'Resultado atualizado com sucesso.',
  resultReordered: 'Ordem dos resultados atualizada.',
  resultArchived: 'Resultado arquivado.',
  resultOverridden: 'Resultado da fase atualizado.',
  resultOverrideCleared: 'Ajuste de resultado removido.',
} as const

const PG_CHECK_VIOLATION = '23514'
const PG_UNIQUE_VIOLATION = '23505'
const PG_FORBIDDEN = '42501'
const PG_NO_DATA_FOUND = 'P0002'
const HC_PHASE_NOT_ADJUSTABLE = 'HC057'
const HC_RESULT_INVALID = 'HC058'
const HC_CASE_TERMINAL = 'HC060'
const HC_RESULT_MANDATORY = 'HC062'

const RESULT_SETTINGS_PATH = '/o/[org]/c/[commission]/manage/settings/resultados'
const TEMPLATE_PATH = '/o/[org]/c/[commission]/manage/process-templates/[templateId]'
const CASE_PATH = '/o/[org]/c/[commission]/manage/cases/[caseId]'
const CASES_LIST_PATH = '/o/[org]/c/[commission]/manage/cases'
const DASHBOARD_PATH = '/o/[org]/c/[commission]/dashboard'

function revalidateResultVocabulary(): void {
  revalidatePath(RESULT_SETTINGS_PATH, 'page')
  revalidatePath(TEMPLATE_PATH, 'page')
  revalidatePath(CASE_PATH, 'page')
  revalidatePath(CASES_LIST_PATH, 'page')
  revalidatePath(DASHBOARD_PATH, 'page')
}

function revalidateCaseResult(): void {
  revalidatePath(CASE_PATH, 'page')
  revalidatePath(CASES_LIST_PATH, 'page')
  revalidatePath(DASHBOARD_PATH, 'page')
}

/**
 * Pre-check for the CASE-CONTENT result action (overrideCasePhaseResult):
 * MEMBERSHIP of THAT commission, any role. ⛔ It is a NECESSARY condition, not the
 * authority — `set_case_phase_result_override` (DEFINER) is (Rule 1). Same shape,
 * and for the same reason, as `authorizeMember` in `src/lib/responses/actions.ts`,
 * which guards the OTHER entry point to the very same RPC (the end-of-wizard
 * override) and has always let the door decide.
 *
 * ⛔ THIS USED TO BE COORDINATOR-ONLY (`role === 'staff_admin'`), which made it a
 * SECOND, NARROWER authority that SHADOWED the door — the same defect as
 * BUG-ADM-001 in `./actions.ts`. Measured from the live catalog, the door is two
 * branches: on an `active` phase it admits `v_assigned_to = auth.uid()` OR
 * `app.is_staff_admin_of(...)`; on a `completed` one, coordinator only. The
 * coordinator-only pre-check refused the active phase's OWN assignee before the RPC
 * ever ran, so the assignee arm was unreachable from this entry point
 * (FUP-CASE-PHASE-RESULT-ASSIGNEE-UNDERGRANT). Membership is safe to keep because
 * BOTH admitted principals are necessarily members: `is_staff_admin_of` requires a
 * `staff_admin` membership, and a phase assignee is picked from the commission's
 * member list.
 *
 * ⛔ THE `isAdmin` SHORT-CIRCUIT IS GONE, DELIBERATELY. The door has NO `is_admin`
 * disjunct at all, so a hatted `platform_admin` passed here and was refused by the
 * RPC — a dead-end door. Removing it is a NARROWING (it can admit nobody the door
 * would not), it ends the dead end, and it aligns this gate with the noun rule
 * (ADR 0078 A35): a per-case result override is commission CONTENT, which a
 * platform_admin may not touch. A platform_admin who is also a member of the
 * commission still passes, on the membership arm.
 *
 * ⛔ Still deliberately NOT the config seam — that point is UNCHANGED and is about
 * the TENANCY-ADMIN / configuration axis, not about assignees. A per-case result
 * override is committee content under the ADR 0100 D12 wall
 * (`set_case_phase_result_override` is on the ratified §4.4 CUT list), so this must
 * never be routed through `canConfigureCommissionById` the way the phase-result
 * VOCABULARY actions below are. Admitting the phase's own assignee does not
 * contradict that wall; routing a tenancy admin through it would.
 */
async function authorizeCommissionMember(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  return context.memberships.some((m) => m.commission.id === commissionId)
}

/**
 * Authorize a phase-result VOCABULARY action (the phase_results CRUD): ADR 0100
 * D12 KEEP configuration (PO ruling Q7 — `phase_results` is commission
 * vocabulary, not per-case results), so this routes `canConfigureCommissionById`
 * (membership staff_admin OR tenancy admin) — mirroring the DB, where
 * `phase_results_staff_admin_write` and the CRUD probes still carry the tenancy
 * arm. The platform-admin arm is pre-existing and out of scope.
 */
async function authorizeCommissionConfig(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return canConfigureCommissionById(commissionId)
}

async function commissionOfResult(
  supabase: SupabaseClient<Database>,
  resultId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('phase_results')
    .select('commission_id')
    .eq('id', resultId)
    .maybeSingle()
  return data?.commission_id ?? null
}

async function commissionOfCasePhase(
  supabase: SupabaseClient<Database>,
  casePhaseId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('case_phases')
    .select('cases ( commission_id )')
    .eq('id', casePhaseId)
    .maybeSingle<{ cases: { commission_id: string } | null }>()
  return data?.cases?.commission_id ?? null
}

/** Map a result-vocabulary RPC error to friendly pt-BR (prefer the RPC's message). */
function mapVocabError(error: { code?: string; message?: string } | null): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case PG_UNIQUE_VIOLATION:
      return MESSAGES.labelTaken
    case PG_FORBIDDEN:
      return MESSAGES.forbidden
    case PG_NO_DATA_FOUND:
      return MESSAGES.missingResult
    case PG_CHECK_VIOLATION:
      return error.message || MESSAGES.generic
    default:
      return MESSAGES.generic
  }
}

/** Map the override RPC error to friendly pt-BR. */
function mapOverrideError(error: { code?: string; message?: string } | null): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case HC_PHASE_NOT_ADJUSTABLE:
      return error.message || MESSAGES.phaseNotAdjustable
    case HC_RESULT_INVALID:
      // The RPC raises HC058 for BOTH "archived/invalid for commission" AND "not
      // in this manual phase's allowed subset", with a distinct pt-BR message
      // each; prefer that precise message and fall back to the commission-vocab one.
      return error.message || MESSAGES.resultInvalid
    case HC_RESULT_MANDATORY:
      return error.message || MESSAGES.resultMandatory
    case HC_CASE_TERMINAL:
      return error.message || MESSAGES.caseTerminal
    case PG_FORBIDDEN:
      return MESSAGES.forbidden
    case PG_NO_DATA_FOUND:
      return MESSAGES.missingCase
    case PG_CHECK_VIOLATION:
      return error.message || MESSAGES.generic
    default:
      return MESSAGES.generic
  }
}

// ---------------------------------------------------------------------------
// Vocabulary CRUD (staff_admin settings — the `resultados de fase` manager)
// ---------------------------------------------------------------------------

/**
 * Create a new result option in a commission's vocabulary (appended at the end of
 * the order). staff_admin-only; `unique(commission_id, label)` → already-exists.
 */
export async function createPhaseResult(
  commissionId: string,
  input: PhaseResultInput,
): Promise<ActionState> {
  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (!input.label.trim()) {
    return { ok: false, fieldErrors: { label: MESSAGES.labelRequired } }
  }
  if (!(await authorizeCommissionConfig(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_phase_result', {
    p_commission_id: commissionId,
    p_label: input.label.trim(),
    p_color_token: input.colorToken,
    p_is_adverse: input.isAdverse,
  })

  if (error) return { ok: false, error: mapVocabError(error) }

  revalidateResultVocabulary()
  return { ok: true, error: MESSAGES.resultCreated }
}

/**
 * Update a result definition (label / colour / `isAdverse`). Edits propagate LIVE
 * to every case/template referencing it (shared-row vocabulary). staff_admin-only.
 */
export async function updatePhaseResult(
  resultId: string,
  input: PhaseResultInput,
): Promise<ActionState> {
  if (!resultId) return { ok: false, error: MESSAGES.missingResult }
  if (!input.label.trim()) {
    return { ok: false, fieldErrors: { label: MESSAGES.labelRequired } }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfResult(supabase, resultId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingResult }
  if (!(await authorizeCommissionConfig(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('update_phase_result', {
    p_result_id: resultId,
    p_label: input.label.trim(),
    p_color_token: input.colorToken,
    p_is_adverse: input.isAdverse,
  })

  if (error) return { ok: false, error: mapVocabError(error) }

  revalidateResultVocabulary()
  return { ok: true, error: MESSAGES.resultUpdated }
}

/**
 * Reorder result options within a commission's vocabulary (drag in the settings
 * manager). `orderedIds` is the full set of NON-archived ids in their new order.
 * staff_admin-only.
 */
export async function reorderPhaseResults(
  commissionId: string,
  orderedIds: string[],
): Promise<ActionState> {
  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (orderedIds.length === 0) return { ok: true }
  if (!(await authorizeCommissionConfig(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reorder_phase_results', {
    p_commission_id: commissionId,
    p_ordered_ids: orderedIds,
  })

  if (error) return { ok: false, error: mapVocabError(error) }

  revalidateResultVocabulary()
  return { ok: true, error: MESSAGES.resultReordered }
}

/**
 * Archive (retire) a result option: hidden from pickers but still renders cases /
 * templates that reference it (FK is `ON DELETE SET NULL`; archive, never delete).
 * staff_admin-only.
 */
export async function archivePhaseResult(
  resultId: string,
): Promise<ActionState> {
  if (!resultId) return { ok: false, error: MESSAGES.missingResult }

  const supabase = await createClient()
  const commissionId = await commissionOfResult(supabase, resultId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingResult }
  if (!(await authorizeCommissionConfig(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('archive_phase_result', {
    p_result_id: resultId,
  })

  if (error) return { ok: false, error: mapVocabError(error) }

  revalidateResultVocabulary()
  return { ok: true, error: MESSAGES.resultArchived }
}

// ---------------------------------------------------------------------------
// Post-conclusion result correction (staff_admin)
// ---------------------------------------------------------------------------

/**
 * Set a case phase's result from the CASE-DETAIL surface. Wraps
 * `set_case_phase_result_override`, which is the authority (Rule 1) and is TWO
 * BRANCHES, not one guard — measured from the live catalog:
 *
 *   - `active` phase    → the phase's OWN assignee ∨ `app.is_staff_admin_of`. The
 *     override is STASHED (no recompute) and applies when the phase concludes.
 *   - `completed` phase → coordinator only, and the case must be non-terminal
 *     (HC060). The RPC recomputes the effective result in the same transaction, so
 *     the correction applies immediately, and re-flips downstream
 *     result-based recommendations (ADR 0043). `resultId = null` clears the
 *     override → recompute from the snapshotted ruleset.
 *   - any other status  → nobody (HC057).
 *
 * ⛔ There is NO `member_can` arm and NO `is_admin` arm, so neither an
 * *administrativo* nor a hatted `platform_admin` is admitted. The RPC also
 * re-validates the option against the live vocabulary, enforces a MANUAL phase's
 * mandatory allowed-subset pick (HC062/HC058), and applies the exclusion perimeter
 * (`assert_not_case_excluded`, HC0F1). Per Rule 11 the free-text `reason` is
 * audited as a fact only, never copied into the payload.
 *
 * The pre-check below is membership only ({@link authorizeCommissionMember}) — a
 * necessary condition that cannot shadow either branch. An unauthorized caller gets
 * the door's `42501` mapped to a clean pt-BR "forbidden" by {@link mapOverrideError}.
 *
 * (The END-OF-WIZARD override, also on an `active` phase, flows through
 * `submitCasePhaseResponse` instead — same RPC, different entry point, and already
 * membership-authorized.)
 */
export async function overrideCasePhaseResult(
  casePhaseId: string,
  resultId: string | null,
  reason: string | null,
): Promise<ActionState> {
  if (!casePhaseId) return { ok: false, error: MESSAGES.missingCase }

  const supabase = await createClient()
  const commissionId = await commissionOfCasePhase(supabase, casePhaseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }
  if (!(await authorizeCommissionMember(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('set_case_phase_result_override', {
    p_case_phase_id: casePhaseId,
    // `null` (clear) is valid (RPC p_result_id has DEFAULT NULL) but supabase-gen
    // typed this mid-list defaulted param as required `string`; cast to pass the
    // real null. `?? undefined` would WRONGLY clear when the caller passed null.
    p_result_id: resultId as unknown as string,
    p_reason: reason ?? undefined,
  })

  if (error) return { ok: false, error: mapOverrideError(error) }

  revalidateCaseResult()
  return {
    ok: true,
    error: resultId ? MESSAGES.resultOverridden : MESSAGES.resultOverrideCleared,
  }
}
