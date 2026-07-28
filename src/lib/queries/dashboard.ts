import { createClient } from '@/lib/supabase/server'
import { answerableItems, getVersionTree } from '@/lib/queries/forms'
import { toReferenceKind } from '@/lib/forms/reference-constants'
import type { ReferenceKind } from '@/lib/forms/reference-constants'
import type { InputItemType, ItemType } from '@/lib/queries/forms'
import type { ResponseStatus } from '@/lib/queries/responses'

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

/**
 * One option's tally within a question's distribution.
 *
 * form-model-normalization (BE-1 contract): distributions now key on the stable
 * option **code** (`form_item_options.code`), not the label — so a renamed label
 * no longer fragments historical analytics. The `label` is resolved SERVER-SIDE
 * to the CURRENT (latest published version's) wording for that code, for display
 * only; aggregation/identity is `code`. Counts join
 * `answer_selected_options → form_item_options` and `GROUP BY code`.
 */
export interface DistributionOption {
  /** The stable option code — the aggregation/identity key. */
  code: string
  /** The option's current display label (latest published version), for the UI. */
  label: string
  /** How many submitted responses selected this option. For `checkbox`, each
   * selected option counts individually; a single response may contribute to
   * several options. */
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

/**
 * FF-2 (BE contract, ADR 0089 · FUP-FF2-2) — one CELL of a `matrix`
 * distribution. The aggregation unit is `(questionKey, rowCode, colCode)`.
 *
 * ⚠ `rowCode` / `colCode` are the identity; `rowLabel` / `colLabel` are display
 * only, resolved server-side to the LATEST published version's wording. Axis ids
 * are per-version and never appear here — that is the entire reason axis codes
 * are immutable (ADR 0089 ruling 4). Grouping by anything but the code splits
 * every series at each new version.
 */
export interface MatrixCellTally {
  rowCode: string
  rowLabel: string
  /** Axis order in the latest published version, for stable grid rendering. */
  rowPosition: number
  colCode: string
  colLabel: string
  colPosition: number
  /** How many answered grids picked this column for this row. A matrix inside a
   *  repeating group contributes one grid PER INSTANCE. */
  count: number
}

/**
 * A per-`question_key` grid distribution for ONE `matrix` question, across every
 * countable submitted response in scope.
 *
 * `n` is the number of answered GRIDS — one per (response, instance), so a
 * matrix inside a repeating group counts once per row of that group.
 * `denominator` is the applicability base: distinct responses that reached the
 * question's section, or — for a matrix inside a repeating group — the number of
 * instances that exist (the FF-1 precedent that stopped shares exceeding 100%).
 */
export interface MatrixDistribution {
  questionKey: string
  label: string
  sectionTitle: string | null
  sectionPosition: number
  itemPosition: number
  cells: MatrixCellTally[]
  denominator: number
  n: number
}

/**
 * FF-2 — one (severity, likelihood) pair of a `risk_matrix`, carrying the
 * SERVER-DERIVED `score` (severity.weight × likelihood.weight) as a number.
 *
 * Rows are the pair rather than a bare score histogram because the pair is what
 * a risk matrix renders as (a heatmap); group by `score` for the histogram.
 */
export interface RiskPairTally {
  severityCode: string
  severityLabel: string
  severityPosition: number
  likelihoodCode: string
  likelihoodLabel: string
  likelihoodPosition: number
  /** The durable numeric fact — never recomputed client-side, so a later
   *  re-weighting cannot retroactively change a historical figure. */
  score: number
  count: number
}

/** A per-`question_key` risk aggregation for ONE `risk_matrix` question. */
export interface RiskDistribution {
  questionKey: string
  label: string
  sectionTitle: string | null
  sectionPosition: number
  itemPosition: number
  pairs: RiskPairTally[]
  /** Answered risk cells — one per (response, instance). */
  n: number
  /** Numeric summaries over `risk_score`; `null` when nothing was answered. */
  average: number | null
  minimum: number | null
  maximum: number | null
}

/**
 * FF-5 (BE contract, ADR 0091 ruling 4) — one TARGET's tally within a reference
 * question's distribution.
 *
 * ⚠ `targetId` is the identity and the grouping key; `targetLabel` is display
 * only, resolved server-side by LIVE JOIN at query time. This is the same
 * discipline `DistributionOption` applies with `code` over `label` and
 * `MatrixCellTally` with `rowCode` over `rowLabel` — arrived at here from the
 * opposite direction: the id is the STABLE thing and the name is what drifts, so
 * a renamed participant, a retitled commission or a person who marries keeps one
 * unbroken series instead of forking it on the day of the change.
 */
export interface ReferenceTargetTally {
  /** Which lane this target belongs to (`participant` | `commission` | `user`). */
  kind: ReferenceKind
  /** The stable target id — the aggregation/identity key. */
  targetId: string
  /** The target's CURRENT name, for the UI. Never the aggregation key. */
  targetLabel: string
  /** How many answered references pointed at this target. A reference inside a
   *  repeating group contributes once PER INSTANCE. */
  count: number
}

/**
 * A per-`question_key` distribution for ONE `reference` question, across every
 * countable submitted response in scope.
 *
 * `n` is the number of answered references — one per (response, instance), so a
 * reference inside a repeating group counts once per row of that group.
 * `denominator` is the applicability base: distinct responses that reached the
 * question's section, or — inside a repeating group — the number of instances
 * that exist (the FF-1 precedent that stopped shares exceeding 100%).
 */
export interface ReferenceDistribution {
  questionKey: string
  label: string
  sectionTitle: string | null
  sectionPosition: number
  itemPosition: number
  targets: ReferenceTargetTally[]
  denominator: number
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
  /**
   * FF-2 — `matrix` grid distributions, same section→item ordering. `[]` when
   * the form has no matrix questions, so every existing consumer is unaffected.
   */
  matrixDistributions: MatrixDistribution[]
  /** FF-2 — `risk_matrix` aggregations, same ordering. `[]` when none. */
  riskDistributions: RiskDistribution[]
  /**
   * FF-5 — `reference` aggregations, same section→item ordering. `[]` when the
   * form has no reference questions, so every existing consumer is unaffected.
   *
   * Without this a filled reference is WRITE-ONLY — stored, immutable, carried
   * through clones and corrections, and appearing in no dashboard, on a platform
   * whose stated purpose is that statistics come from dashboards instead of
   * manual tabulation (CLAUDE.md §1).
   */
  referenceDistributions: ReferenceDistribution[]
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

/**
 * The CSV export payload (B4): a stable header row + one string-cell row per
 * standalone submitted response. The column order is: fixed metadata columns,
 * then one column per input `question_key` (in the latest published version's
 * section/item order), then one column per signed section. The route handler
 * serializes this to CSV (pt-BR headers, UTF-8 BOM). Cells are pre-rendered to
 * display text (checkbox arrays joined with "; "). `null` when the form has no
 * published version or the caller is not entitled.
 */
export interface FormExport {
  formTitle: string
  headers: string[]
  rows: string[][]
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
// Queries — every read is a SECURITY DEFINER RPC, internally is_staff_admin_of /
// is_admin gated (migration 20260613090011), so a non-entitled caller gets an
// empty set and these resolve to [] / null with no leak.
// ---------------------------------------------------------------------------

const CHARTABLE = new Set<ItemType>(['multiple_choice', 'dropdown', 'checkbox'])

/**
 * The canonical "dashboard-countable responses" predicate (Architecture Rule 9),
 * the TS twin of the SQL helper `app.submitted_form_responses`: a response counts
 * toward a standalone form's dashboard iff it is submitted, AND not a case phase
 * (ADR 0020), AND not superseded by a SUBMITTED successor (SUP / ADR 0074
 * latest-in-chain retrofit — `hasSubmittedSuccessor`). The SQL helper is the
 * authority for the aggregations; this is the single source of the same rule
 * for any TS-side filtering (e.g. a future client-side count). Keep the two in
 * agreement (Rule 3).
 */
export function isDashboardCountable(r: {
  status: ResponseStatus
  casePhaseId: string | null
  /** SUP (ADR 0074): true when a SUBMITTED successor points at this response
   * via `responses.supersedes_id`. A merely `in_progress` successor does NOT
   * exclude the predecessor — mirrors the SQL `NOT EXISTS` predicate exactly. */
  hasSubmittedSuccessor: boolean
}): boolean {
  return r.status === 'submitted' && r.casePhaseId == null && !r.hasSubmittedSuccessor
}

/**
 * The list of forms in a commission that have any standalone submitted
 * responses, for the dashboard's form picker. Newest-activity first. Returns
 * `[]` for a non-staff_admin (the backing RPC is gated).
 *
 * `range` is OPTIONAL: when passed (the active dashboard date window), each
 * form's `totalSubmitted` is bound to `submitted_at` in that window so the tab
 * badges match the date-filtered body (QA MINOR-2). Omit for all-time totals.
 */
export async function listDashboardForms(
  commissionId: string,
  range?: DashboardRange,
): Promise<{ formId: string; title: string; totalSubmitted: number }[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('dashboard_form_totals', {
    p_commission_id: commissionId,
    p_from: range?.from,
    p_to: range?.to,
  })
  if (error || !data) return []
  return data.map((r) => ({
    formId: r.form_id,
    title: r.title,
    totalSubmitted: Number(r.total_submitted),
  }))
}

/**
 * The full aggregated dashboard for one form, optionally scoped to a
 * `submitted_at` date range. `null` when the caller is not a staff_admin of the
 * form's commission, or the form has no submitted responses in scope. SUBMITTED
 * + standalone only (case-phase responses excluded — ADR 0020).
 *
 * Five RPCs run in parallel (totals, distributions, free-text, over-time,
 * completion). The flat distribution rows (one per question_key × option_value)
 * are pivoted here into `QuestionDistribution[]`, and free-text sample rows into
 * `FreeTextSample[]`. Ordering is by section then item (the RPCs already sort).
 */
export async function getFormDashboard(
  formId: string,
  range?: DashboardRange,
): Promise<FormDashboard | null> {
  const supabase = await createClient()
  const args = { p_form_id: formId, p_from: range?.from, p_to: range?.to }

  // The seven aggregation RPCs (all internally gated) plus the form title (the
  // title is RLS-readable to a member; the gating that matters is on the RPCs).
  const [
    dist,
    freeText,
    overTime,
    byMember,
    matrixCells,
    riskScores,
    entityRefs,
    formRes,
  ] = await Promise.all([
      supabase.rpc('dashboard_distributions', args),
      supabase.rpc('dashboard_free_text', args),
      supabase.rpc('dashboard_submissions_over_time', args),
      supabase.rpc('dashboard_completion_by_member', args),
      // FF-2: both are built on the SAME app.submitted_form_responses helper as
      // the four above, so the supersession rule cannot drift between charts.
      supabase.rpc('dashboard_matrix_cells', args),
      supabase.rpc('dashboard_risk_scores', args),
      // FF-5 (ADR 0091): same helper again, for the same reason — one
      // supersession predicate behind every chart on this page.
      supabase.rpc('dashboard_entity_references', args),
      supabase.from('forms').select('title').eq('id', formId).maybeSingle<{ title: string }>(),
    ])

  const formRow = formRes.data
  if (!formRow) return null

  // form-model-normalization (BE-2 wiring point): `dashboard_distributions` will
  // emit `option_code`/`option_label` (replacing `option_value`). The cast keeps
  // this compiling against the CURRENT generated RPC row type until BE-2
  // regenerates database.ts; `pivotDistributions` already reads the new columns.
  const distributions = pivotDistributions(
    (dist.data ?? []) as unknown as Parameters<typeof pivotDistributions>[0],
  )
  const freeTextSamples = pivotFreeText(freeText.data ?? [])
  const submissionsOverTime: SubmissionsOverTimePoint[] = (overTime.data ?? []).map(
    (p) => ({ day: p.day, count: Number(p.count) }),
  )
  const completionByMember: CompletionByMember[] = (byMember.data ?? []).map((m) => ({
    memberId: m.member_id,
    name: m.name,
    count: Number(m.count),
  }))

  // Headline total = the sum of the over-time series. Both come from the SAME
  // RPC (dashboard_submissions_over_time), which is built on the canonical
  // app.submitted_form_responses helper — so the headline and the trend chart
  // are derived from one source and cannot silently disagree (QA INFO-1).
  const totalSubmitted = submissionsOverTime.reduce((acc, p) => acc + p.count, 0)

  return {
    formId,
    formTitle: formRow.title,
    totalSubmitted,
    distributions,
    matrixDistributions: pivotMatrixCells(matrixCells.data ?? []),
    riskDistributions: pivotRiskScores(riskScores.data ?? []),
    referenceDistributions: pivotEntityReferences(entityRefs.data ?? []),
    freeTextSamples,
    submissionsOverTime,
    completionByMember,
  }
}

/**
 * FF-2 — pivot the flat (question_key × row_code × col_code) rows into one
 * {@link MatrixDistribution} per question_key, preserving the RPC's
 * section→item→row→col ordering.
 */
export function pivotMatrixCells(
  rows: {
    question_key: string
    label: string
    section_title: string | null
    section_position: number
    item_position: number
    row_code: string
    row_label: string
    row_position: number
    col_code: string
    col_label: string
    col_position: number
    cell_count: number
    denominator: number
    n: number
  }[],
): MatrixDistribution[] {
  const byKey = new Map<string, MatrixDistribution>()
  for (const r of rows) {
    let dist = byKey.get(r.question_key)
    if (!dist) {
      dist = {
        questionKey: r.question_key,
        label: r.label,
        sectionTitle: r.section_title,
        sectionPosition: r.section_position,
        itemPosition: r.item_position,
        cells: [],
        denominator: Number(r.denominator),
        n: Number(r.n),
      }
      byKey.set(r.question_key, dist)
    }
    dist.cells.push({
      rowCode: r.row_code,
      rowLabel: r.row_label,
      rowPosition: r.row_position,
      colCode: r.col_code,
      colLabel: r.col_label,
      colPosition: r.col_position,
      count: Number(r.cell_count),
    })
  }
  return Array.from(byKey.values())
}

/**
 * FF-5 — pivot the flat (question_key × reference_kind × target_id) rows into
 * one {@link ReferenceDistribution} per question_key, preserving the RPC's
 * section→item→count ordering.
 *
 * A row whose `reference_kind` is not a known lane is DROPPED. That is
 * unreachable today (the `reference_kind` CHECK pins the three lanes), and is
 * kept so a future fourth lane — hospital/org, deferred by ADR 0086 ruling 5 —
 * cannot render as an unlabelled slice in a client that predates it.
 */
export function pivotEntityReferences(
  rows: {
    question_key: string
    label: string
    section_title: string | null
    section_position: number
    item_position: number
    reference_kind: string
    target_id: string
    target_label: string
    ref_count: number
    denominator: number
    n: number
  }[],
): ReferenceDistribution[] {
  const byKey = new Map<string, ReferenceDistribution>()
  for (const r of rows) {
    const kind = toReferenceKind(r.reference_kind)
    if (kind === null) continue
    let dist = byKey.get(r.question_key)
    if (!dist) {
      dist = {
        questionKey: r.question_key,
        label: r.label,
        sectionTitle: r.section_title,
        sectionPosition: r.section_position,
        itemPosition: r.item_position,
        targets: [],
        denominator: Number(r.denominator),
        n: Number(r.n),
      }
      byKey.set(r.question_key, dist)
    }
    dist.targets.push({
      kind,
      targetId: r.target_id,
      targetLabel: r.target_label,
      count: Number(r.ref_count),
    })
  }
  return Array.from(byKey.values())
}

/**
 * FF-2 — pivot the flat (question_key × severity_code × likelihood_code) rows
 * into one {@link RiskDistribution} per question_key.
 *
 * The per-key statistics repeat on every row of that key (the same shape
 * `denominator`/`n` already use), so they are read from the FIRST row and not
 * re-derived — recomputing an average from the pair rows would weight each pair
 * equally instead of by its count.
 */
export function pivotRiskScores(
  rows: {
    question_key: string
    label: string
    section_title: string | null
    section_position: number
    item_position: number
    severity_code: string
    severity_label: string
    severity_position: number
    likelihood_code: string
    likelihood_label: string
    likelihood_position: number
    score: number | null
    pair_count: number
    n: number
    average: number | null
    minimum: number | null
    maximum: number | null
  }[],
): RiskDistribution[] {
  const byKey = new Map<string, RiskDistribution>()
  for (const r of rows) {
    let dist = byKey.get(r.question_key)
    if (!dist) {
      dist = {
        questionKey: r.question_key,
        label: r.label,
        sectionTitle: r.section_title,
        sectionPosition: r.section_position,
        itemPosition: r.item_position,
        pairs: [],
        n: Number(r.n),
        average: r.average == null ? null : Number(r.average),
        minimum: r.minimum == null ? null : Number(r.minimum),
        maximum: r.maximum == null ? null : Number(r.maximum),
      }
      byKey.set(r.question_key, dist)
    }
    dist.pairs.push({
      severityCode: r.severity_code,
      severityLabel: r.severity_label,
      severityPosition: r.severity_position,
      likelihoodCode: r.likelihood_code,
      likelihoodLabel: r.likelihood_label,
      likelihoodPosition: r.likelihood_position,
      score: Number(r.score ?? 0),
      count: Number(r.pair_count),
    })
  }
  return Array.from(byKey.values())
}

/** Pivot the flat (question_key × option_value) distribution rows into one
 * `QuestionDistribution` per question_key, preserving the RPC's section/item
 * ordering and skipping any non-chartable rows defensively. */
function pivotDistributions(
  rows: {
    question_key: string
    label: string
    section_title: string | null
    section_position: number
    item_position: number
    item_type: string
    // form-model-normalization: the distribution RPC now emits the stable option
    // CODE plus its current LABEL (resolved from the latest published version),
    // replacing the old label-only `option_value`.
    option_code: string
    option_label: string
    option_count: number
    denominator: number
    n: number
  }[],
): QuestionDistribution[] {
  const byKey = new Map<string, QuestionDistribution>()
  for (const r of rows) {
    if (!CHARTABLE.has(r.item_type as ItemType)) continue
    let dist = byKey.get(r.question_key)
    if (!dist) {
      dist = {
        questionKey: r.question_key,
        label: r.label,
        sectionTitle: r.section_title,
        sectionPosition: r.section_position,
        itemPosition: r.item_position,
        type: r.item_type as ChartableInputType,
        options: [],
        denominator: Number(r.denominator),
        n: Number(r.n),
      }
      byKey.set(r.question_key, dist)
    }
    dist.options.push({
      code: r.option_code,
      label: r.option_label,
      count: Number(r.option_count),
    })
  }
  return Array.from(byKey.values())
}

/** Pivot the flat free-text sample rows into one `FreeTextSample` per
 * question_key (capped sample list + total). */
function pivotFreeText(
  rows: {
    question_key: string
    label: string
    section_title: string | null
    section_position: number
    item_position: number
    total: number
    sample_value: string
  }[],
): FreeTextSample[] {
  const byKey = new Map<string, FreeTextSample>()
  for (const r of rows) {
    let s = byKey.get(r.question_key)
    if (!s) {
      s = {
        questionKey: r.question_key,
        label: r.label,
        sectionTitle: r.section_title,
        sectionPosition: r.section_position,
        itemPosition: r.item_position,
        total: Number(r.total),
        samples: [],
      }
      byKey.set(r.question_key, s)
    }
    s.samples.push(r.sample_value)
  }
  return Array.from(byKey.values())
}

/**
 * The admin cross-commission overview (B5): one row per commission with form
 * and submission volumes. Returns `[]` for a non-admin caller (the RPC is
 * `is_admin`-gated). Admin-only.
 */
export async function getCommissionOverview(): Promise<CommissionOverviewRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('commission_overview')
  if (error || !data) return []
  return data.map((r) => ({
    commissionId: r.commission_id,
    commissionName: r.commission_name,
    slug: r.slug,
    formCount: Number(r.form_count),
    submittedCount: Number(r.submitted_count),
    submittedLast30Days: Number(r.submitted_last_30_days),
  }))
}

interface ExportRpcRow {
  response_id: string
  member_name: string | null
  submitted_at: string | null
  version_number: number
  answers: Record<string, string> | null
  signoffs: Record<string, string> | null
}

/**
 * The CSV export data for one form (B4): a stable header set derived from the
 * form's latest published version (input question_keys in section/item order +
 * signed-section status columns) and one pre-rendered string row per standalone
 * submitted response (via the `dashboard_export_rows` definer RPC, ADR 0020
 * standalone-only). `null` when the caller is not entitled (the RPC returns
 * empty) or the form has no published version. The route handler serializes this
 * to CSV; it never builds SQL inline (Architecture Rule 9).
 *
 * `range` is OPTIONAL: when passed (the active dashboard date window), the
 * exported rows are bound to `submitted_at` in that window so the CSV matches
 * the date-filtered dashboard (QA MINOR-1). Omit for an all-time export.
 */
export async function getFormExport(
  formId: string,
  range?: DashboardRange,
): Promise<FormExport | null> {
  const supabase = await createClient()

  // Resolve the latest published version to fix the column set (current wording).
  const { data: ver } = await supabase
    .from('form_versions')
    .select('id, forms(title)')
    .eq('form_id', formId)
    .eq('status', 'published')
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; forms: { title: string } }>()

  if (!ver) return null

  const tree = await getVersionTree(ver.id)
  if (!tree) return null

  // Input question columns in section → item order (the canonical answerable
  // filter), plus the signed-section status columns.
  const inputItems = answerableItems(tree)
  const questionCols = inputItems
    .filter((it) => it.questionKey != null)
    .map((it) => ({ key: it.questionKey as string, label: it.label ?? (it.questionKey as string) }))

  const signedSections = tree.sections
    .filter((s) => s.requiresSignoff)
    .map((s) => s.title ?? `Seção ${s.position}`)

  const { data, error } = await supabase.rpc('dashboard_export_rows', {
    p_form_id: formId,
    p_from: range?.from,
    p_to: range?.to,
  })
  if (error) return null

  const headers = [
    'ID da resposta',
    'Respondente',
    'Enviada em',
    'Versão',
    ...questionCols.map((c) => c.label),
    ...signedSections.map((title) => `Assinatura: ${title}`),
  ]

  const rows = ((data ?? []) as ExportRpcRow[]).map((r) => {
    const answers = r.answers ?? {}
    const signoffs = r.signoffs ?? {}
    return [
      r.response_id,
      r.member_name ?? '',
      r.submitted_at ?? '',
      String(r.version_number),
      ...questionCols.map((c) => answers[c.key] ?? ''),
      ...signedSections.map((title) => signoffs[title] ?? 'N/A'),
    ]
  })

  return { formTitle: ver.forms.title, headers, rows }
}
