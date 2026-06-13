'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/types/database'

/**
 * Cases server actions (Architecture Rules 9 & 10): case creation, phase
 * activation / skip / ad-hoc / reassign, phase fill entry, and case
 * close / cancel. Each is `useActionState`-shaped where it backs a form, or a
 * plain id-arg action where it backs a button. All user-facing strings are
 * pt-BR; raw Supabase/Postgres errors NEVER reach the UI (CLAUDE.md §8).
 *
 * SECURITY: RLS is the authority. Coordinator actions use the cookie
 * (RLS-scoped) client and the B3 RPCs; the staff_admin-write policies + each
 * RPC's internal gate restrict them to staff_admins of the commission (+ admins),
 * and each action re-verifies server-side for a clean pt-BR "forbidden".
 * `startOrResumePhase` is the ASSIGNEE's entry point (a member action, not a
 * coordinator one): it returns the phase's `responseId` to deep-link the
 * UNCHANGED wizard. Phase completion is a DB trigger reacting to
 * `submit_response`, not an action here.
 *
 * Phase-7 SQLSTATEs mapped to pt-BR: P0016 invalid recommend_when, P0017 no
 * published version, P0018 not sequentially activatable, P0019 phase wrong
 * state, P0020 case not open, P0021 assignee not a member, P0022 caller not the
 * assignee. The RPCs raise their own pt-BR text; we prefer it and fall back.
 */

export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

export interface CreateCaseState extends ActionState {
  caseId?: string
}

export interface AddAdHocPhaseState extends ActionState {
  phaseId?: string
}

export interface StartPhaseState extends ActionState {
  responseId?: string
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  missingCase: 'Caso não encontrado.',
  missingPhase: 'Fase não encontrada.',
  missingTemplate: 'Processo não encontrado.',
  templateRequired: 'Selecione um processo.',
  formRequired: 'Selecione um formulário.',
  assigneeRequired: 'Selecione o responsável pela fase.',
  recommendInvalid:
    'A condição de recomendação é inválida. Verifique a fase de origem e a pergunta.',
  // Phase-7 codes
  noPublishedVersion:
    'O formulário desta fase ainda não foi publicado. Publique-o antes de continuar.',
  notSequential: 'Conclua ou marque as fases anteriores antes de ativar esta.',
  phaseWrongState: 'Esta fase não está no estado necessário para esta ação.',
  caseNotOpen: 'Este caso não está aberto.',
  assigneeNotMember: 'O responsável deve ser membro da comissão.',
  notAssignee: 'Apenas o responsável pode preencher esta fase.',
  caseCreated: 'Caso criado com sucesso.',
  phaseActivated: 'Fase ativada e atribuída.',
  phaseSkipped: 'Fase marcada como não necessária.',
  adHocAdded: 'Fase adicional incluída.',
  phaseReassigned: 'Responsável atualizado.',
  caseClosed: 'Caso concluído.',
  caseCancelled: 'Caso cancelado.',
} as const

const PG_CHECK_VIOLATION = '23514'
// Custom SQLSTATE class HC0xx (Hospital Commission). Renumbered from P00xx in
// migration 20260613090009 so PostgREST 14 returns 400 + JSON {code,message}
// (an unknown class) rather than a 500 that drops the body for non-ASCII
// messages. See docs/decisions/0018-custom-sqlstate-class.md.
const HC_INVALID_RECOMMEND = 'HC016'
const HC_NO_PUBLISHED_VERSION = 'HC017'
const HC_NOT_SEQUENTIAL = 'HC018'
const HC_PHASE_WRONG_STATE = 'HC019'
const HC_CASE_NOT_OPEN = 'HC020'
const HC_ASSIGNEE_NOT_MEMBER = 'HC021'
const HC_NOT_ASSIGNEE = 'HC022'

const CASES_LIST_PATH = '/c/[slug]/manage/cases'
const CASE_PATH = '/c/[slug]/manage/cases/[caseId]'

function revalidateCases() {
  revalidatePath(CASES_LIST_PATH, 'page')
  revalidatePath(CASE_PATH, 'page')
}

async function authorizeCommission(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.memberships.some(
    (m) => m.commission.id === commissionId && m.role === 'staff_admin',
  )
}

/** Resolve a case's commission via the RLS-scoped client (null = unseen). */
async function commissionOfCase(
  supabase: SupabaseClient<Database>,
  caseId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('cases')
    .select('commission_id')
    .eq('id', caseId)
    .maybeSingle()
  return data?.commission_id ?? null
}

/** Resolve a phase's {commissionId, caseId} via the RLS-scoped client. */
async function contextOfPhase(
  supabase: SupabaseClient<Database>,
  casePhaseId: string,
): Promise<{ commissionId: string; caseId: string } | null> {
  const { data } = await supabase
    .from('case_phases')
    .select('case_id, cases(commission_id)')
    .eq('id', casePhaseId)
    .maybeSingle<{
      case_id: string
      cases: { commission_id: string } | null
    }>()
  const commissionId = data?.cases?.commission_id
  if (!commissionId || !data) return null
  return { commissionId, caseId: data.case_id }
}

/** Resolve a template's commission via the RLS-scoped client. */
async function commissionOfTemplate(
  supabase: SupabaseClient<Database>,
  templateId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('process_templates')
    .select('commission_id')
    .eq('id', templateId)
    .maybeSingle()
  return data?.commission_id ?? null
}

/** Map a Phase-7 RPC error to friendly pt-BR (prefer the RPC's own message). */
function mapCaseError(error: { code?: string; message?: string } | null): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case HC_INVALID_RECOMMEND:
      return error.message || MESSAGES.recommendInvalid
    case HC_NO_PUBLISHED_VERSION:
      return error.message || MESSAGES.noPublishedVersion
    case HC_NOT_SEQUENTIAL:
      return error.message || MESSAGES.notSequential
    case HC_PHASE_WRONG_STATE:
      return error.message || MESSAGES.phaseWrongState
    case HC_CASE_NOT_OPEN:
      return error.message || MESSAGES.caseNotOpen
    case HC_ASSIGNEE_NOT_MEMBER:
      return error.message || MESSAGES.assigneeNotMember
    case HC_NOT_ASSIGNEE:
      return error.message || MESSAGES.notAssignee
    case PG_CHECK_VIOLATION:
      return error.message || MESSAGES.generic
    default:
      return MESSAGES.generic
  }
}

function parseRecommendWhen(raw: string): Json | undefined | null {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed) as Json
  } catch {
    return null
  }
}

/**
 * Create a case from a published template (snapshot: materialize phases, pin
 * each form's currently-published version, copy `recommend_when`, initial
 * recommendation pass). Fields: `templateId`, `label?` (NON-IDENTIFYING — the UI
 * warns it must not contain patient identifiers). Returns the new `caseId`.
 */
export async function createCaseFromTemplate(
  _prev: CreateCaseState | undefined,
  formData: FormData,
): Promise<CreateCaseState> {
  const templateId = String(formData.get('templateId') ?? '')
  const label = String(formData.get('label') ?? '').trim()

  if (!templateId) {
    return { ok: false, fieldErrors: { templateId: MESSAGES.templateRequired } }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfTemplate(supabase, templateId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingTemplate }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { data, error } = await supabase.rpc('create_case_from_template', {
    p_template_id: templateId,
    p_label: label || undefined,
  })

  if (error || !data) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.caseCreated, caseId: data.id }
}

/**
 * Activate a pending phase and assign it. Fields: `casePhaseId`, `assignedTo`.
 * Guards (→ pt-BR): all earlier phases concluded/skipped (P0018), the phase is
 * pendente (P0019), the case is open (P0020), the assignee is a member (P0021).
 */
export async function activatePhase(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const casePhaseId = String(formData.get('casePhaseId') ?? '')
  const assignedTo = String(formData.get('assignedTo') ?? '')

  if (!casePhaseId) return { ok: false, error: MESSAGES.missingPhase }
  if (!assignedTo) {
    return { ok: false, fieldErrors: { assignedTo: MESSAGES.assigneeRequired } }
  }

  const supabase = await createClient()
  const ctx = await contextOfPhase(supabase, casePhaseId)
  if (!ctx) return { ok: false, error: MESSAGES.missingPhase }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('activate_phase', {
    p_case_phase_id: casePhaseId,
    p_assigned_to: assignedTo,
  })

  if (error) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.phaseActivated }
}

/**
 * Skip a pending phase (`pendente → nao_necessaria`), unblocking the next phase.
 * Guards: phase pendente (P0019), case open (P0020). Then recomputes
 * recommendations.
 */
export async function skipPhase(casePhaseId: string): Promise<ActionState> {
  if (!casePhaseId) return { ok: false, error: MESSAGES.missingPhase }

  const supabase = await createClient()
  const ctx = await contextOfPhase(supabase, casePhaseId)
  if (!ctx) return { ok: false, error: MESSAGES.missingPhase }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('skip_phase', {
    p_case_phase_id: casePhaseId,
  })

  if (error) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.phaseSkipped }
}

/**
 * Append an ad-hoc phase to an open case (not from the template). Fields:
 * `caseId`, `formId`, `title?`, `recommendWhen?` (JSON), `assignedTo?`. Pins the
 * form's published version (P0017). Returns the new `phaseId`. Append-only.
 */
export async function addAdHocPhase(
  _prev: AddAdHocPhaseState | undefined,
  formData: FormData,
): Promise<AddAdHocPhaseState> {
  const caseId = String(formData.get('caseId') ?? '')
  const formId = String(formData.get('formId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const assignedTo = String(formData.get('assignedTo') ?? '').trim()
  const recommendWhen = parseRecommendWhen(
    String(formData.get('recommendWhen') ?? ''),
  )

  if (!caseId) return { ok: false, error: MESSAGES.missingCase }
  if (!formId) {
    return { ok: false, fieldErrors: { formId: MESSAGES.formRequired } }
  }
  if (recommendWhen === null) {
    return { ok: false, fieldErrors: { recommendWhen: MESSAGES.recommendInvalid } }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfCase(supabase, caseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { data, error } = await supabase.rpc('add_ad_hoc_phase', {
    p_case_id: caseId,
    p_form_id: formId,
    p_title: title || undefined,
    p_recommend_when: recommendWhen,
    p_assigned_to: assignedTo || undefined,
  })

  if (error || !data) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.adHocAdded, phaseId: data.id }
}

/**
 * Reassign a phase to another member BEFORE any response exists for it (P0019
 * otherwise — once a draft exists the assignee owns it). Fields: `casePhaseId`,
 * `newAssignee`. P0021 if the new assignee is not a member.
 */
export async function reassignPhase(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const casePhaseId = String(formData.get('casePhaseId') ?? '')
  const newAssignee = String(formData.get('newAssignee') ?? '')

  if (!casePhaseId) return { ok: false, error: MESSAGES.missingPhase }
  if (!newAssignee) {
    return { ok: false, fieldErrors: { newAssignee: MESSAGES.assigneeRequired } }
  }

  const supabase = await createClient()
  const ctx = await contextOfPhase(supabase, casePhaseId)
  if (!ctx) return { ok: false, error: MESSAGES.missingPhase }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('reassign_phase', {
    p_case_phase_id: casePhaseId,
    p_new_assignee: newAssignee,
  })

  if (error) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.phaseReassigned }
}

/**
 * The ASSIGNEE's phase entry point: start or resume the phase's response (one
 * per phase) and return its `responseId` to deep-link the unchanged wizard.
 * Guards: phase is ativa (P0019), caller is the assignee (P0022). Uses the
 * PINNED form version (skips the published-only backstop — the pin may be
 * archived). NOT a coordinator action: any member may CALL it, but the RPC
 * (P0022) lets only the assignee through, so no commission-scoped authz re-check
 * is added here (it would wrongly require staff_admin).
 */
export async function startOrResumePhase(
  casePhaseId: string,
): Promise<StartPhaseState> {
  if (!casePhaseId) return { ok: false, error: MESSAGES.missingPhase }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('start_or_resume_phase', {
    p_case_phase_id: casePhaseId,
  })

  if (error || !data) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, responseId: data.id }
}

/**
 * Close an open case (`aberto → concluido`): flips any remaining
 * pendente/ativa phases to `nao_necessaria` so the board reads cleanly; a
 * stranded in-progress draft is then inert. Guard: case open (P0020).
 */
export async function closeCase(caseId: string): Promise<ActionState> {
  if (!caseId) return { ok: false, error: MESSAGES.missingCase }

  const supabase = await createClient()
  const commissionId = await commissionOfCase(supabase, caseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('close_case', { p_case_id: caseId })

  if (error) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.caseClosed }
}

/**
 * Cancel an open case (`aberto → cancelado`), same phase cleanup as close.
 * Guard: case open (P0020).
 */
export async function cancelCase(caseId: string): Promise<ActionState> {
  if (!caseId) return { ok: false, error: MESSAGES.missingCase }

  const supabase = await createClient()
  const commissionId = await commissionOfCase(supabase, caseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('cancel_case', { p_case_id: caseId })

  if (error) return { ok: false, error: mapCaseError(error) }

  revalidateCases()
  return { ok: true, error: MESSAGES.caseCancelled }
}
