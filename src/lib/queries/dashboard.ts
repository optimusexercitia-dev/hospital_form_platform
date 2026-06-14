import { createClient } from '@/lib/supabase/server'
import type { InputItemType } from '@/lib/queries/forms'

/**
 * Dashboard aggregation data-access (Architecture Rule 9 — all reads go through
 * `src/lib/queries/`). Backs the per-commission dashboard
 * (`/c/[slug]/dashboard`) and the admin cross-commission overview
 * (`/admin` variant).
 *
 * ============================ CONTRACT-FIRST STUB ============================
 * These are the typed SIGNATURES the frontend builds against (Phase 8 B1).
 * The bodies `throw new Error('not implemented')` until B2/B5 land. The
 * exported return-SHAPE types are the stable contract — do NOT change them
 * without telling the lead so the frontend can adapt.
 *
 * Backing surface (B2/B5, all SECURITY DEFINER, internally `is_staff_admin_of`-
 * gated, mirroring ADR 0016): the aggregations read SUBMITTED responses only
 * (the canonical "dashboard-countable responses" filter, Rule 9) and are keyed
 * by `question_key` so a distribution spans form versions. Choice questions are
 * the only ones charted; `free_text` is surfaced as a capped sample list, not a
 * distribution (see `FreeTextSample`).
 *
 * DECISION (lead-approved): standalone-form dashboards count ONLY direct
 * form-fills (`responses.case_phase_id IS NULL`). A submitted response that is a
 * case PHASE (Phase-7) shares the form's version but belongs to a case workflow,
 * so it is EXCLUDED from the form's standalone dashboard to keep the form's own
 * statistics clean. (Case analytics live on the cases board, not here.)
 * ===========================================================================
 */

// ---------------------------------------------------------------------------
// Domain types — the dashboard contract
// ---------------------------------------------------------------------------

/** Charted question kinds. `free_text` is excluded from distributions. */
export type ChartableInputType = Exclude<InputItemType, 'free_text'>

/** One option's tally within a question's distribution. */
export interface DistributionOption {
  /** The option label exactly as authored (the answer value). */
  value: string
  /** How many submitted responses selected this option. For `checkbox`,
   * values are unnested (`jsonb_array_elements_text`) so each selected option
   * counts individually; a single response may contribute to several options. */
  count: number
}

/**
 * A per-`question_key` answer distribution for ONE choice question, aggregated
 * across every submitted response (any version) in scope.
 *
 *  - `denominator` is THIS question's own applicability base: the count of
 *    DISTINCT submitted responses that have ≥1 answer in the question's SECTION
 *    (so a question in a conditional section reports the smaller denominator of
 *    only the responses for which that section was visible). The frontend
 *    renders it as "n de N respostas em que a pergunta era aplicável".
 *  - `n` is the count of distinct submitted responses that answered THIS
 *    question specifically (n ≤ denominator).
 */
export interface QuestionDistribution {
  questionKey: string
  /** The question label (most recent version's wording). */
  label: string
  /** The section title the question belongs to (null for the default/flat
   * section), used to group charts by section. */
  sectionTitle: string | null
  /** Section position, for stable section grouping/ordering in the UI. */
  sectionPosition: number
  /** Item position within its section, for stable ordering. */
  itemPosition: number
  type: ChartableInputType
  options: DistributionOption[]
  /** Applicability base — distinct submitted responses with any answer in this
   * question's section. */
  denominator: number
  /** Distinct submitted responses that answered this question. */
  n: number
}

/** A capped sample of free-text answers for one `free_text` question (free-text
 * is not charted; the UI shows a short read-only list with a total count). */
export interface FreeTextSample {
  questionKey: string
  label: string
  sectionTitle: string | null
  sectionPosition: number
  itemPosition: number
  /** Total submitted answers to this question (n). */
  total: number
  /** A capped sample of the actual answers (server caps the size). */
  samples: string[]
}

/** One day's submitted-response volume (UTC day, `YYYY-MM-DD`). */
export interface SubmissionsOverTimePoint {
  /** ISO date, `YYYY-MM-DD`. */
  day: string
  count: number
}

/** Completion volume per member (who submitted how many in scope). */
export interface CompletionByMember {
  memberId: string
  name: string | null
  count: number
}

/**
 * The full dashboard payload for ONE form (all its versions aggregated by
 * `question_key`). `totalSubmitted` is the headline count of standalone
 * submitted responses (case-phase responses excluded — see DECISION above).
 */
export interface FormDashboard {
  formId: string
  formTitle: string
  totalSubmitted: number
  /** Choice-question distributions, grouped/ordered by section then item. */
  distributions: QuestionDistribution[]
  /** Free-text samples, same ordering. */
  freeTextSamples: FreeTextSample[]
  submissionsOverTime: SubmissionsOverTimePoint[]
  completionByMember: CompletionByMember[]
}

/** Date-range scope shared by the dashboard reads (ISO `YYYY-MM-DD`, inclusive;
 * both optional — omit for "all time"). Filters on `submitted_at`. */
export interface DashboardRange {
  from?: string
  to?: string
}

/** One row in the admin cross-commission overview (B5): volume per commission. */
export interface CommissionOverviewRow {
  commissionId: string
  commissionName: string
  slug: string
  /** Distinct forms that have ≥1 published version. */
  formCount: number
  /** Total standalone submitted responses across all the commission's forms. */
  submittedCount: number
  /** Submitted responses in the trailing 30 days (recent activity signal). */
  submittedLast30Days: number
}

// ---------------------------------------------------------------------------
// Queries (STUBS — bodies land in B2/B5)
// ---------------------------------------------------------------------------

/**
 * The list of forms in a commission that have any submitted responses, for the
 * dashboard's form picker. Newest-activity first. Returns `[]` for a
 * non-staff_admin (the backing read is gated).
 */
export async function listDashboardForms(
  _commissionId: string,
): Promise<{ formId: string; title: string; totalSubmitted: number }[]> {
  void _commissionId
  await createClient()
  throw new Error('not implemented')
}

/**
 * The full aggregated dashboard for one form, optionally scoped to a
 * `submitted_at` date range. `null` when the caller is not a staff_admin of the
 * form's commission, or the form is not found. SUBMITTED + standalone only.
 */
export async function getFormDashboard(
  _formId: string,
  _range?: DashboardRange,
): Promise<FormDashboard | null> {
  void _formId
  void _range
  await createClient()
  throw new Error('not implemented')
}

/**
 * The admin cross-commission overview (B5): one row per commission with form
 * and submission volumes. Returns `[]` for a non-admin caller. Admin-only.
 */
export async function getCommissionOverview(): Promise<CommissionOverviewRow[]> {
  await createClient()
  throw new Error('not implemented')
}
