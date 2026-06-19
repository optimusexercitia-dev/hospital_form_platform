import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getSessionContext } from '@/lib/queries/session'
import type { RecommendWhen } from '@/lib/queries/conditions'
import type {
  CaseStatus,
  CaseStatusColorToken,
} from '@/lib/cases/case-status'

export type { CaseStatus } from '@/lib/cases/case-status'

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
  /**
   * The id of the assigned outcome (D9 — at most one per case), or `null` if
   * none chosen yet / the process offers no outcomes (D15). Resolve to label +
   * flags via {@link CaseDetail.outcome} / {@link CaseBoardRow.outcome}.
   */
  outcomeId: string | null
  createdAt: string
  closedAt: string | null
}

/**
 * A case's assigned outcome RESOLVED for display (D9–D11): the vocabulary row
 * read LIVE (so label/flag edits propagate, D11), joined to the case via
 * `cases.outcome_id`. Present on the board row + detail; `null` when no outcome
 * is assigned. A trimmed projection of {@link CaseOutcome} (no commission /
 * archived / position — the case views don't need them).
 */
export interface ResolvedCaseOutcome {
  id: string
  /** pt-BR label (resolved LIVE — propagates per D11). */
  label: string
  colorToken: CaseStatusColorToken
  /** Advisory: show a "requires action plan" reminder (D10, non-gating). */
  requiresActionPlan: boolean
  /** Adverse-event tracking flag (D10, non-gating; feeds the % adverse KPI). */
  isAdverse: boolean
}

/**
 * One outcome a case OFFERS — its FROZEN offered set (`case_offered_outcomes`,
 * snapshotted at creation), resolved to label + flags for the conclude dialog and
 * the case-detail selector. The same trimmed projection as
 * {@link ResolvedCaseOutcome}.
 */
export type OfferedCaseOutcome = ResolvedCaseOutcome

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
  /**
   * The 1-based positions of EARLIER phases that BLOCK this one (D1/D4): this
   * phase cannot be activated until every listed phase is `concluida` or
   * `nao_necessaria`. Snapshot-copied from the template slot at case creation;
   * `[]` = no blockers (always activatable). References earlier positions only.
   */
  blocks: number[]
  recommendWhen: RecommendWhen | null
  /**
   * The phase's due date (ISO `YYYY-MM-DD`), set/edited/removed by the
   * coordinator on activation. `null` = no due date. A past date on an open
   * phase renders as overdue.
   */
  dueDate: string | null
  /**
   * The SNAPSHOT of the template slot's default number of days (ADR 0017),
   * copied at case creation; pre-fills the activation due-date picker. `null` =
   * no default. Never changes after creation (template edits don't reach it).
   */
  defaultDueDays: number | null
  /**
   * The phase's order in the MERGED case layout (phases interleaved with
   * narratives; Case Narratives increment, ADR 0032). Distinct from `position`,
   * which stays the immutable phase NUMBER (referenced by `blocks` /
   * `recommendWhen.fromPhase`). `null` only for legacy rows pre-backfill; the
   * merge falls back to `position`. Snapshot-copied at case creation.
   */
  displayPosition: number | null
}

/**
 * One per-case NARRATIVE (`case_narratives`; Case Narratives increment, ADR
 * 0032): a snapshot of a template narrative-slot plus the authored prose. The
 * analogue of {@link CasePhase} on the narrative side. `typeLabel` is the
 * effective label SNAPSHOTTED at case creation (so later vocabulary edits do not
 * rewrite an opened case); `bodyMd` is the de-identified sanitized-Markdown body
 * (Rule 7), authored inline by the coordinator and frozen once the case is
 * concluído/cancelado.
 */
export interface CaseNarrative {
  id: string
  caseId: string
  /** Provenance link to the vocabulary row (`set null` on type delete); `null` if detached. */
  narrativeTypeId: string | null
  /** The effective label SNAPSHOTTED at creation (never rewritten by vocab edits). */
  typeLabel: string
  /** Order in the merged case layout (interleaved with phases by `displayPosition`). */
  displayPosition: number
  /** Optional per-slot label override snapshotted from the template; `null` if none. */
  title: string | null
  /** Optional authoring guidance snapshotted from the template; `null` if none. */
  instructions: string | null
  /** Advisory close flag (decision 7): a soft warning if left empty at conclude. */
  isExpected: boolean
  /** The authored de-identified Markdown body (Rule 7); `null`/empty when unwritten. */
  bodyMd: string | null
  /**
   * The member assigned to author this narrative (Case Access Control, ADR 0033
   * D5; mirrors {@link CasePhase.assignedTo}), or `null` when un-assigned. The
   * assignee gains full-case read automatically and is the sole non-coordinator who
   * may write an ATTRIBUTED narrative (Q14). Existing rows pre-BE-4 are `null`.
   */
  assignedTo: string | null
  /** The assignee's display name (joined); `null` if unassigned/unresolved. */
  assigneeName: string | null
  /**
   * The narrative's lifecycle status (ADR 0033 D5): `aberta` (editable by the
   * assignee / un-attributed write-grantee) → `concluida` (body frozen). A
   * coordinator can reopen. Defaults to `aberta` for existing rows.
   */
  status: 'aberta' | 'concluida'
  /** When it was concluded (ISO), or `null` while `aberta`. */
  concludedAt: string | null
  /** Who concluded it (profile id), or `null` while `aberta`. */
  concludedBy: string | null
  updatedAt: string
}

/** One row of the cases board: a case header + its phases' STATUS summary. */
export interface CaseBoardRow {
  case: Case
  /**
   * The case's assigned outcome resolved for display (label/flags), or `null` if
   * none assigned. Lets the table render the outcome column + the outcome /
   * adverse filters (D14) without a second fetch.
   */
  outcome: ResolvedCaseOutcome | null
  /** Phase status only — NEVER answers (the Phase-7 invariant). */
  phases: Array<
    Pick<
      CasePhase,
      | 'position'
      | 'title'
      | 'status'
      | 'recommended'
      | 'assignedTo'
      | 'assigneeName'
      | 'dueDate'
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
  /**
   * The case's assigned outcome resolved for display (label/flags + the advisory
   * `requiresActionPlan` / `isAdverse` markers, D10), or `null` if none assigned.
   * Resolved LIVE from the vocabulary so edits propagate (D11).
   */
  outcome: ResolvedCaseOutcome | null
  /**
   * The outcomes this case OFFERS — its FROZEN offered set
   * (`case_offered_outcomes`, snapshotted at creation, D15), resolved to
   * label/flags. The outcome SELECTOR and the conclude dialog choose from THIS.
   * `[]` when the case's process offered none (conclude needs no outcome then).
   */
  offeredOutcomes: OfferedCaseOutcome[]
  phases: Array<
    CasePhase & {
      responseId: string | null
      submittedAt: string | null
    }
  >
  /**
   * The case's NARRATIVES (`case_narratives`; ADR 0032), ordered by
   * `displayPosition`, interleaved with `phases` for the merged render via
   * {@link import('@/lib/queries/case-narratives').mergeCaseLayout}. `[]` when the
   * `case_narratives` feature is off or the case has none. `bodyMd` IS present
   * here (de-identified governance prose for the coordinator); only the audit log
   * excludes it.
   */
  narratives: CaseNarrative[]
  /**
   * The CURRENT viewer's capability descriptor for this case (Case Access Control
   * increment, ADR 0033). The capability-gated detail component reads this to show
   * lifecycle/assignment only for `canManageLifecycle`, content editors for
   * `canWriteContent`, and read-only otherwise. With the `case_access` flag OFF
   * the payload is only reachable by a coordinator (today's behavior), so this is
   * `{ canRead: true, canWriteContent: true, canManageLifecycle: true }`. A
   * capability signal, NOT the security boundary (RLS is — Rule 1).
   */
  viewerCapabilities: CaseViewerCapabilities
}

/** The assignee's phase-fill landing: the phase + its parent case (metadata). */
export interface CasePhaseForFill {
  phase: CasePhase
  case: Case
}

// ---------------------------------------------------------------------------
// Case Access Control (ADR 0033) — viewer capabilities + "Meus Casos"
// ---------------------------------------------------------------------------

/**
 * The CURRENT viewer's capability descriptor for ONE case (ADR 0033 D7). Drives
 * the single capability-gated detail component (generalizing the interviews
 * `viewerCanWrite` signal): the page renders the lifecycle/assignment controls
 * only when `canManageLifecycle`, the content editors when `canWriteContent`, and
 * read-only otherwise. Computed server-side from `app.can_read_case` /
 * `app.can_write_case_content` (+ the staff_admin/admin lifecycle gate) for
 * `auth.uid()`; this is a CAPABILITY signal, NOT the security boundary — RLS is
 * (Rule 1).
 *
 *   - `canRead`            — the viewer may open the full case (attributed or
 *                            granted, or coordinator). Always `true` on a detail
 *                            payload the viewer actually received.
 *   - `canWriteContent`    — the viewer may author UN-attributed narratives and
 *                            manage non-identity-bound content (action items,
 *                            documents, tags, events): `staff_admin`/admin OR a
 *                            `case_access` row at level `write`. Does NOT grant
 *                            phase-fill (identity-bound) nor lifecycle.
 *   - `canManageLifecycle` — the viewer may run lifecycle + assignment (activate /
 *                            skip / reassign / close / cancel / add-ad-hoc / grant /
 *                            assign-narrative): `staff_admin`/admin only.
 */
export interface CaseViewerCapabilities {
  canRead: boolean
  canWriteContent: boolean
  canManageLifecycle: boolean
}

/**
 * The viewer's relationship to a case in "Meus Casos" (ADR 0033 D7), surfaced as
 * a role chip on the card:
 *   - `coordinator`  — `staff_admin`/admin of the case's commission.
 *   - `collaborator` — holds a `case_access` row at level `write` (case-wide
 *                      content author; not a coordinator).
 *   - `viewer`       — read-only access: a `case_access` `read` grant OR
 *                      attribution-derived read (a phase/narrative assignee) with
 *                      no write grant.
 */
export type MyCaseRole = 'viewer' | 'collaborator' | 'coordinator'

/**
 * One ITEM the viewer is personally attributed on within a "Meus Casos" card
 * (ADR 0033 D7): a phase they must fill OR a narrative they must author. Rendered
 * inline on the card with a direct action (Preencher / Abrir / Concluir); the
 * card always also offers "Ver caso completo".
 */
export interface MyCaseItem {
  /** Which attributed kind this is. */
  kind: 'phase' | 'narrative'
  /** The `case_phases.id` / `case_narratives.id`. */
  id: string
  /** Display title (phase: title|form|"Fase N"; narrative: `type_label`/title). */
  title: string
  /**
   * The item's own status slug — a {@link CasePhaseStatus} for a phase, a
   * narrative status (`'aberta' | 'concluida'`) for a narrative. A stable ASCII
   * union the card maps to a pt-BR pill; not itself a label.
   */
  status: string
  /** The item's order in the merged case layout (interleave; phases ∪ narratives). */
  displayPosition: number
  /**
   * `true` when the viewer can act on it RIGHT NOW — a phase that is `ativa` AND
   * assigned to the viewer (drives "Preencher"); a narrative that is `aberta` AND
   * assigned to the viewer (drives "Abrir"/"Concluir"). `false` renders the item
   * as context only (e.g. a concluded narrative, a not-yet-active phase).
   */
  actionable: boolean
}

/**
 * One card of "Meus Casos" (ADR 0033 D7) — every case the member can access
 * (attributed OR granted), one per card, replacing "Minhas fases". The member's
 * own attributed items are listed inline (`items`) with direct actions; the card
 * always offers "Ver caso completo" (the capability-gated detail page). A case the
 * member can only READ (a pure read grant, no attribution) still appears, with an
 * empty `items` array. Never carries answers (Phase-7 invariant) — status only.
 */
export interface MyCase {
  caseId: string
  /** Per-commission counter ("Caso 0042" is `caseNumber = 42`). */
  caseNumber: number
  /** Optional NON-IDENTIFYING label; `null` if none. */
  label: string | null
  status: CaseStatus
  /** The viewer's role chip for this card. */
  myRole: MyCaseRole
  /**
   * The viewer's personally-attributed items in this case (phases + narratives),
   * ordered by `displayPosition`. `[]` when the viewer only has a read/write GRANT
   * and is attributed on nothing (the card still shows "Ver caso completo").
   */
  items: MyCaseItem[]
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
  due_date: string | null
}

/** A resolved outcome inside a board row / detail envelope (label + flags). */
interface OutcomeJson {
  id: string
  label: string
  color_token: CaseStatusColorToken
  requires_action_plan: boolean
  is_adverse: boolean
}

/** Map a resolved-outcome envelope object to its domain shape (`null`-safe). */
function mapOutcomeJson(o: OutcomeJson | null): ResolvedCaseOutcome | null {
  if (!o) return null
  return {
    id: o.id,
    label: o.label,
    colorToken: o.color_token,
    requiresActionPlan: o.requires_action_plan,
    isAdverse: o.is_adverse,
  }
}

/** One row of `list_cases_board`. */
interface BoardRowJson {
  case_id: string
  case_number: number
  label: string | null
  status: CaseStatus
  outcome_id: string | null
  /** The resolved assigned-outcome object, or `null` if none. */
  outcome: OutcomeJson | null
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
  blocks: number[] | null
  recommend_when: RecommendWhen | null
  due_date: string | null
  default_due_days: number | null
  display_position: number | null
  response_id: string | null
  submitted_at: string | null
}

/**
 * One narrative entry inside the `get_case_detail` jsonb envelope's `narratives`
 * array (Case Narratives increment, ADR 0032). `body_md` IS present — the
 * coordinator read path; only the audit log excludes it.
 */
interface DetailNarrativeJson {
  id: string
  narrative_type_id: string | null
  type_label: string
  display_position: number
  title: string | null
  instructions: string | null
  is_expected: boolean
  body_md: string | null
  /**
   * Narrative attribution + lifecycle (ADR 0033 D5), added to `get_case_detail` in
   * BE-4. Absent on a pre-BE-4 envelope → the mapper defaults to un-assigned /
   * `aberta` (the correct state for existing rows).
   */
  assigned_to?: string | null
  assignee_name?: string | null
  status?: 'aberta' | 'concluida' | null
  concluded_at?: string | null
  concluded_by?: string | null
  updated_at: string
}

/** Map a `get_case_detail` narrative envelope object to its domain shape. */
function mapNarrativeJson(n: DetailNarrativeJson, caseId: string): CaseNarrative {
  return {
    id: n.id,
    caseId,
    narrativeTypeId: n.narrative_type_id ?? null,
    typeLabel: n.type_label,
    displayPosition: n.display_position,
    title: n.title,
    instructions: n.instructions,
    isExpected: n.is_expected,
    bodyMd: n.body_md,
    // Attribution + lifecycle (ADR 0033). Pre-BE-4 the RPC omits these → un-assigned
    // / aberta, which is exactly the state of an existing narrative row.
    assignedTo: n.assigned_to ?? null,
    assigneeName: n.assignee_name ?? null,
    status: n.status ?? 'aberta',
    concludedAt: n.concluded_at ?? null,
    concludedBy: n.concluded_by ?? null,
    updatedAt: n.updated_at,
  }
}

/** The `get_case_detail` jsonb envelope. */
interface CaseDetailJson {
  id: string
  commission_id: string
  template_id: string | null
  case_number: number
  label: string | null
  status: CaseStatus
  outcome_id: string | null
  /** The resolved assigned-outcome object, or `null` if none. */
  outcome: OutcomeJson | null
  /** The frozen offered-outcome set, resolved to label/flags (`[]` if none). */
  offered_outcomes: OutcomeJson[] | null
  created_at: string
  closed_at: string | null
  phases: DetailPhaseJson[]
  /** The case's narratives, ordered by `display_position` (`[]` if none / flag off). */
  narratives: DetailNarrativeJson[] | null
  /**
   * The viewer's capability descriptor (ADR 0033), added by `get_case_detail` in
   * BE-4. Absent on a pre-BE-4 envelope → the mapper defaults to coordinator-grade
   * (the only way the current `is_staff_admin_of`-gated RPC returns at all).
   */
  viewer_capabilities?: {
    can_read: boolean
    can_write_content: boolean
    can_manage_lifecycle: boolean
  } | null
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
      outcomeId: r.outcome_id ?? null,
      createdAt: r.created_at,
      closedAt: r.closed_at,
    },
    outcome: mapOutcomeJson(r.outcome ?? null),
    phases: (r.phases ?? []).map((p) => ({
      position: p.position,
      title: p.title,
      status: p.status,
      recommended: p.recommended,
      assignedTo: p.assigned_to,
      assigneeName: p.assignee_name,
      dueDate: p.due_date,
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
/**
 * Request-scoped memoized read of {@link getCaseDetail} (React `cache()`): the
 * Phase-12 case route fetches it from BOTH the shared `layout.tsx` (header spine)
 * AND its child (the Detalhes / Timeline tabs), so memoizing by `caseId`
 * collapses that to a single RPC per request. `cache()` is per-request and the
 * RPC is RLS-scoped, so this changes nothing about authorization or freshness —
 * only the number of round trips. Existing single-call sites are unaffected.
 */
export const getCaseDetail = cache(
  async (caseId: string): Promise<CaseDetail | null> => {
    return getCaseDetailUncached(caseId)
  },
)

async function getCaseDetailUncached(
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
      outcomeId: env.outcome_id ?? null,
      createdAt: env.created_at,
      closedAt: env.closed_at,
    },
    outcome: mapOutcomeJson(env.outcome ?? null),
    offeredOutcomes: (env.offered_outcomes ?? [])
      .map(mapOutcomeJson)
      .filter((o): o is OfferedCaseOutcome => o != null),
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
      blocks: p.blocks ?? [],
      recommendWhen: p.recommend_when,
      dueDate: p.due_date,
      defaultDueDays: p.default_due_days,
      displayPosition: p.display_position ?? null,
      responseId: p.response_id,
      submittedAt: p.submitted_at,
    })),
    narratives: (env.narratives ?? []).map((n) => mapNarrativeJson(n, env.id)),
    // Until BE-4 adds `viewer_capabilities` to the RPC, default to coordinator-
    // grade: today's `get_case_detail` is `is_staff_admin_of`-gated, so any
    // non-null envelope was returned to a coordinator. BE-4 replaces this with the
    // RPC-computed descriptor (read/write/lifecycle for the actual viewer).
    viewerCapabilities: env.viewer_capabilities
      ? {
          canRead: env.viewer_capabilities.can_read,
          canWriteContent: env.viewer_capabilities.can_write_content,
          canManageLifecycle: env.viewer_capabilities.can_manage_lifecycle,
        }
      : { canRead: true, canWriteContent: true, canManageLifecycle: true },
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
  blocks: number[] | null
  recommend_when: RecommendWhen | null
  due_date: string | null
  default_due_days: number | null
  forms: { title: string | null } | null
  cases: {
    id: string
    commission_id: string
    template_id: string | null
    case_number: number
    label: string | null
    status: CaseStatus
    outcome_id: string | null
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
      recommended, assigned_to, is_ad_hoc, blocks, recommend_when, due_date,
      default_due_days,
      forms ( title ),
      cases (
        id, commission_id, template_id, case_number, label, status, outcome_id,
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
      blocks: data.blocks ?? [],
      recommendWhen: data.recommend_when,
      dueDate: data.due_date,
      defaultDueDays: data.default_due_days,
      // The fill landing renders one phase, not the merged layout — no display order needed.
      displayPosition: null,
    },
    case: {
      id: c.id,
      commissionId: c.commission_id,
      templateId: c.template_id,
      caseNumber: c.case_number,
      label: c.label,
      status: c.status,
      outcomeId: c.outcome_id ?? null,
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
  /** The phase's due date (ISO `YYYY-MM-DD`); `null` = none. */
  dueDate: string | null
}

interface MyAssignedPhaseRow {
  id: string
  position: number
  title: string | null
  updated_at: string
  due_date: string | null
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
      id, position, title, updated_at, due_date,
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
      dueDate: r.due_date,
    }))
}

// ---------------------------------------------------------------------------
// "Meus Casos" — the unified attributed-or-granted case list (ADR 0033 D7)
// ---------------------------------------------------------------------------

/** One attributed item inside a `list_my_cases` row's `items` jsonb array. */
interface MyCaseItemJson {
  kind: 'phase' | 'narrative'
  id: string
  title: string
  status: string
  display_position: number
  actionable: boolean
}

/** One row of the `list_my_cases` jsonb array. */
interface MyCaseJson {
  case_id: string
  case_number: number
  label: string | null
  status: CaseStatus
  my_role: MyCaseRole
  items: MyCaseItemJson[]
}

/**
 * The caller's "Meus Casos" for a commission (ADR 0033 D7): every case the member
 * can access — personally ATTRIBUTED (a phase or narrative assignee) OR GRANTED a
 * `case_access` row — one {@link MyCase} per card, replacing the old "Minhas
 * fases". Each card carries the member's own attributed items inline (with direct
 * Preencher/Abrir/Concluir actions) plus context for "Ver caso completo".
 *
 * Backed by the SECURITY DEFINER `list_my_cases` (BE-4), gated by the
 * `case_access` flag and self-scoped to `auth.uid()` — so it NEVER leaks a case
 * the caller cannot access, and returns `[]` for a non-member. Carries STATUS
 * only, never answers (the Phase-7 invariant). Ordered by the RPC.
 *
 * CONTRACT-FIRST STUB: signature + return type are frozen for `frontend`; the body
 * is wired to the RPC in BE-4 (after the migration + `gen:types`).
 */
export async function listMyCases(commissionId: string): Promise<MyCase[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('list_my_cases', {
    p_commission: commissionId,
  })

  if (error || !data) return []

  return (data as unknown as MyCaseJson[]).map((r) => ({
    caseId: r.case_id,
    caseNumber: r.case_number,
    label: r.label,
    status: r.status,
    myRole: r.my_role,
    items: (r.items ?? []).map((it) => ({
      kind: it.kind,
      id: it.id,
      title: it.title,
      status: it.status,
      displayPosition: it.display_position,
      actionable: it.actionable,
    })),
  }))
}
