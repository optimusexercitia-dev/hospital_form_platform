import { createClient } from '@/lib/supabase/server'
import { getSessionContext } from '@/lib/queries/session'
import type { RecommendWhen } from '@/lib/queries/conditions'

/**
 * Cases data-access (Architecture Rule 9 — all reads go through
 * `src/lib/queries/`). Backs the **cases board** + **per-case detail**
 * (`/c/[slug]/manage/cases/**`) and the assignee's **phase-fill landing**
 * (`/c/[slug]/cases/[caseId]/phase/...`).
 *
 * A case groups responses into an ordered sequence of phases; `case_phases` is
 * the authority and carries STATUS + ASSIGNEE + RECOMMENDED ONLY — never answers
 * (the Phase-7 in_progress-answers invariant, ADR 0016). Two reads are SECURITY
 * DEFINER RPCs (B3), internally `is_staff_admin_of`-gated, the same narrow
 * envelope pattern as the sign-off queue:
 *   - `list_cases_board(commission_id)` — one row per case + aggregated phase
 *     STATUS (no answers).
 *   - `get_case_detail(case_id)` — case header + phases; `responseId`/`submittedAt`
 *     populated ONLY for SUBMITTED (concluida) phases, so the coordinator can
 *     deep-link a completed phase's answers via the existing staff_admin
 *     submitted-response read path — never an in-progress answer.
 *
 * `getCasePhaseForFill` is the assignee's RLS-scoped landing read (status +
 * metadata only). Mutations live in `src/lib/cases/actions.ts`. All user-facing
 * strings are the caller's (pt-BR). CONTRACT-FIRST stub module: signatures +
 * domain types are stable; bodies are filled in B5.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type CaseStatus = 'aberto' | 'concluido' | 'cancelado'

export type CasePhaseStatus =
  | 'pendente'
  | 'ativa'
  | 'concluida'
  | 'nao_necessaria'

/** A case header (no phases). */
export interface Case {
  id: string
  commissionId: string
  /** `null` once detached from its blueprint (template archived/deleted). */
  templateId: string | null
  /** Per-commission counter ("Caso 0042" is `caseNumber = 42`). */
  caseNumber: number
  /** Optional NON-IDENTIFYING label (never a patient name/MRN). */
  label: string | null
  status: CaseStatus
  createdAt: string
  closedAt: string | null
}

/** One phase of a case (the authority row — status/assignee/recommended only). */
export interface CasePhase {
  id: string
  caseId: string
  /** 1-based phase order within the case. */
  position: number
  formId: string
  /** The PINNED published form version this phase fills (snapshot). */
  formVersionId: string
  /** Title of the bound form (joined for display); `null` if unresolved. */
  formTitle: string | null
  /** Optional per-phase label. */
  title: string | null
  status: CasePhaseStatus
  /** `true` when `recommendWhen` evaluated true; independent of `status`. */
  recommended: boolean
  /** The member assigned to fill this phase (its response's creator). */
  assignedTo: string | null
  /** Assignee's display name (joined); `null` if unassigned/unresolved. */
  assigneeName: string | null
  /** `true` when appended ad-hoc to this case (not from the template). */
  isAdHoc: boolean
  recommendWhen: RecommendWhen | null
}

/** One row of the cases board: a case header + its phases' STATUS summary. */
export interface CaseBoardRow {
  case: Case
  /** Phase status only — NEVER answers (the Phase-7 invariant). */
  phases: Array<
    Pick<
      CasePhase,
      'position' | 'title' | 'status' | 'recommended' | 'assignedTo' | 'assigneeName'
    >
  >
}

/**
 * Full per-case detail: the case header + every phase. For each phase,
 * `responseId`/`submittedAt` are non-null ONLY when the phase is SUBMITTED
 * (concluida) — the coordinator deep-links those to the existing staff_admin
 * submitted-response detail view. In-progress phases expose status only.
 */
export interface CaseDetail {
  case: Case
  phases: Array<
    CasePhase & {
      responseId: string | null
      submittedAt: string | null
    }
  >
}

/** The assignee's phase-fill landing: the phase + its parent case (metadata). */
export interface CasePhaseForFill {
  phase: CasePhase
  case: Case
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// RPC / row payload shapes
// ---------------------------------------------------------------------------

/** One phase entry inside a `list_cases_board` row's `phases` jsonb array. */
interface BoardPhaseJson {
  position: number
  title: string | null
  status: CasePhaseStatus
  recommended: boolean
  assigned_to: string | null
  assignee_name: string | null
}

/** One row of `list_cases_board`. */
interface BoardRowJson {
  case_id: string
  case_number: number
  label: string | null
  status: CaseStatus
  created_at: string
  closed_at: string | null
  phases: BoardPhaseJson[]
}

/** One phase entry inside the `get_case_detail` jsonb envelope. */
interface DetailPhaseJson {
  id: string
  position: number
  form_id: string
  form_version_id: string
  form_title: string | null
  title: string | null
  status: CasePhaseStatus
  recommended: boolean
  assigned_to: string | null
  assignee_name: string | null
  is_ad_hoc: boolean
  recommend_when: RecommendWhen | null
  response_id: string | null
  submitted_at: string | null
}

/** The `get_case_detail` jsonb envelope. */
interface CaseDetailJson {
  id: string
  commission_id: string
  template_id: string | null
  case_number: number
  label: string | null
  status: CaseStatus
  created_at: string
  closed_at: string | null
  phases: DetailPhaseJson[]
}

/**
 * The cases board for a commission: one row per case + each case's phases'
 * STATUS summary (no answers). Backed by the SECURITY DEFINER
 * `list_cases_board`, internally gated by `is_staff_admin_of`, so it returns
 * `[]` for non-staff_admins (no leak). Ordered by the RPC (most recent first).
 */
export async function listCasesBoard(
  commissionId: string,
): Promise<CaseBoardRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('list_cases_board', {
    p_commission_id: commissionId,
  })

  if (error || !data) return []

  return (data as unknown as BoardRowJson[]).map((r) => ({
    case: {
      id: r.case_id,
      commissionId,
      // The board row does not echo templateId (not needed for the board);
      // detail carries it.
      templateId: null,
      caseNumber: r.case_number,
      label: r.label,
      status: r.status,
      createdAt: r.created_at,
      closedAt: r.closed_at,
    },
    phases: (r.phases ?? []).map((p) => ({
      position: p.position,
      title: p.title,
      status: p.status,
      recommended: p.recommended,
      assignedTo: p.assigned_to,
      assigneeName: p.assignee_name,
    })),
  }))
}

/**
 * Full detail for one case. Backed by the SECURITY DEFINER `get_case_detail`
 * (internally `is_staff_admin_of`-gated): case header + phases, with
 * `responseId`/`submittedAt` only for SUBMITTED phases. `null` when the caller
 * is not a staff_admin of the case's commission or the case does not exist (the
 * RPC raises, surfaced here as null).
 */
export async function getCaseDetail(
  caseId: string,
): Promise<CaseDetail | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_case_detail', {
    p_case_id: caseId,
  })

  if (error || !data) return null

  const env = data as unknown as CaseDetailJson

  return {
    case: {
      id: env.id,
      commissionId: env.commission_id,
      templateId: env.template_id,
      caseNumber: env.case_number,
      label: env.label,
      status: env.status,
      createdAt: env.created_at,
      closedAt: env.closed_at,
    },
    phases: (env.phases ?? []).map((p) => ({
      id: p.id,
      caseId: env.id,
      position: p.position,
      formId: p.form_id,
      formVersionId: p.form_version_id,
      formTitle: p.form_title,
      title: p.title,
      status: p.status,
      recommended: p.recommended,
      assignedTo: p.assigned_to,
      assigneeName: p.assignee_name,
      isAdHoc: p.is_ad_hoc,
      recommendWhen: p.recommend_when,
      responseId: p.response_id,
      submittedAt: p.submitted_at,
    })),
  }
}

// ---------------------------------------------------------------------------
// Phase-fill landing (RLS-scoped table reads — no answers)
// ---------------------------------------------------------------------------

interface PhaseFillRow {
  id: string
  case_id: string
  position: number
  form_id: string
  form_version_id: string
  title: string | null
  status: CasePhaseStatus
  recommended: boolean
  assigned_to: string | null
  is_ad_hoc: boolean
  recommend_when: RecommendWhen | null
  forms: { title: string | null } | null
  cases: {
    id: string
    commission_id: string
    template_id: string | null
    case_number: number
    label: string | null
    status: CaseStatus
    created_at: string
    closed_at: string | null
  } | null
}

/**
 * The assignee's phase-fill landing read: the phase row + its parent case
 * (status + metadata, no answers), RLS-scoped (members read). `null` when the
 * caller may not read it or it does not exist. The actual fill happens through
 * `startOrResumePhase` (cases/actions) → the unchanged wizard.
 */
export async function getCasePhaseForFill(
  casePhaseId: string,
): Promise<CasePhaseForFill | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('case_phases')
    .select(
      `
      id, case_id, position, form_id, form_version_id, title, status,
      recommended, assigned_to, is_ad_hoc, recommend_when,
      forms ( title ),
      cases (
        id, commission_id, template_id, case_number, label, status,
        created_at, closed_at
      )
    `,
    )
    .eq('id', casePhaseId)
    .maybeSingle<PhaseFillRow>()

  if (error || !data || !data.cases) return null

  const c = data.cases
  return {
    phase: {
      id: data.id,
      caseId: data.case_id,
      position: data.position,
      formId: data.form_id,
      formVersionId: data.form_version_id,
      formTitle: data.forms?.title ?? null,
      title: data.title,
      status: data.status,
      recommended: data.recommended,
      assignedTo: data.assigned_to,
      // The fill landing does not need the assignee's name (it IS the caller).
      assigneeName: null,
      isAdHoc: data.is_ad_hoc,
      recommendWhen: data.recommend_when,
    },
    case: {
      id: c.id,
      commissionId: c.commission_id,
      templateId: c.template_id,
      caseNumber: c.case_number,
      label: c.label,
      status: c.status,
      createdAt: c.created_at,
      closedAt: c.closed_at,
    },
  }
}

// ---------------------------------------------------------------------------
// Member-scoped "my active phases"
// ---------------------------------------------------------------------------

/** One ativa phase assigned to the caller, with its case context (no answers). */
export interface MyAssignedPhase {
  caseId: string
  caseNumber: number
  caseLabel: string | null
  phaseId: string
  position: number
  phaseTitle: string | null
  formTitle: string
}

interface MyAssignedPhaseRow {
  id: string
  position: number
  title: string | null
  updated_at: string
  forms: { title: string | null } | null
  cases: {
    id: string
    case_number: number
    label: string | null
    commission_id: string
  } | null
}

/**
 * The caller's ACTIVE phases in a commission: `case_phases` where
 * `assigned_to = auth.uid()` AND `status = 'ativa'`, joined to the case. This is
 * the MEMBER-scoped "my work" read — a plain `staff` assignee cannot use
 * `getCaseDetail` (staff_admin-only), so this RLS-scoped read lets them find the
 * phases they must fill (the acceptance criterion: an assignee fills only their
 * own phase). Newest-activity-first (by the phase's `updated_at`, bumped at
 * activation). Returns `[]` when not signed in or none are assigned.
 *
 * RLS: `case_phases_select` / `cases_select` already let a member read the
 * phases + cases of their commission; the `assigned_to = userId` filter narrows
 * to the caller's own work. No new policy needed.
 */
export async function listMyAssignedPhases(
  commissionId: string,
): Promise<MyAssignedPhase[]> {
  const context = await getSessionContext()
  if (!context) return []

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('case_phases')
    .select(
      `
      id, position, title, updated_at,
      forms ( title ),
      cases!inner ( id, case_number, label, commission_id )
    `,
    )
    .eq('assigned_to', context.userId)
    .eq('status', 'ativa')
    .eq('cases.commission_id', commissionId)
    .order('updated_at', { ascending: false })
    .returns<MyAssignedPhaseRow[]>()

  if (error || !data) return []

  return data
    .filter((r): r is MyAssignedPhaseRow & { cases: NonNullable<MyAssignedPhaseRow['cases']> } =>
      r.cases != null,
    )
    .map((r) => ({
      caseId: r.cases.id,
      caseNumber: r.cases.case_number,
      caseLabel: r.cases.label,
      phaseId: r.id,
      position: r.position,
      phaseTitle: r.title,
      formTitle: r.forms?.title ?? '',
    }))
}
