import { createClient } from '@/lib/supabase/server'
import { answerableItems, getVersionTree } from '@/lib/queries/forms'
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
 * toward a standalone form's dashboard iff it is submitted AND not a case phase
 * (ADR 0020). The SQL helper is the authority for the aggregations; this is the
 * single source of the same rule for any TS-side filtering (e.g. a future
 * client-side count). Keep the two in agreement.
 */
export function isDashboardCountable(r: {
  status: ResponseStatus
  casePhaseId: string | null
}): boolean {
  return r.status === 'submitted' && r.casePhaseId == null
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

  // The five aggregation RPCs (all internally gated) plus the form title (the
  // title is RLS-readable to a member; the gating that matters is on the RPCs).
  const [dist, freeText, overTime, byMember, formRes] = await Promise.all([
    supabase.rpc('dashboard_distributions', args),
    supabase.rpc('dashboard_free_text', args),
    supabase.rpc('dashboard_submissions_over_time', args),
    supabase.rpc('dashboard_completion_by_member', args),
    supabase.from('forms').select('title').eq('id', formId).maybeSingle<{ title: string }>(),
  ])

  const formRow = formRes.data
  if (!formRow) return null

  const distributions = pivotDistributions(dist.data ?? [])
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
    freeTextSamples,
    submissionsOverTime,
    completionByMember,
  }
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
    option_value: string
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
    dist.options.push({ value: r.option_value, count: Number(r.option_count) })
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
