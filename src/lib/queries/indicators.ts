/**
 * Quality-indicators data-access (Phase 15 — Indicadores de Qualidade;
 * Architecture Rule 9 — all reads go through `src/lib/queries/`). Backs the
 * `manage/indicators/**` builder, the measurement grid, the run chart, and the
 * commission-dashboard "Indicadores" panel + hospital scorecard.
 *
 * The domain TYPES are the FROZEN contract the frontend builds against; they live
 * in the import-free, client-safe `@/lib/indicators/types` (re-exported here for
 * convenience, mirroring the `queries/capa.ts` re-export pattern).
 *
 * RLS (the security boundary — Rule 1):
 *  - `indicators` + `indicator_measurements`: member-READ (RLS SELECT policy) /
 *    DEFINER-RPC-only WRITE (posture (b) — no direct write grant). Foreign-
 *    commission users read nothing.
 *  - The hospital tier reads ONLY via `hospital_indicator_rollup` (a PHI-free
 *    DEFINER scorecard — counts + names), never the row (no table grant).
 *  - KPIs / series come from DEFINER RPCs gated `is_staff_admin_of OR
 *    is_commission_admin_of` (kpis) / member (series); a non-privileged caller
 *    gets zeros / an empty list.
 *
 * PHI-FREE: indicators are aggregate process/quality metrics (ADR 0057).
 */

import { createClient } from '@/lib/supabase/server'
import type {
  DataSource,
  DerivedConfig,
  HospitalIndicatorRollupRow,
  HybridDerivedConfig,
  Indicator,
  IndicatorDirection,
  IndicatorFrequency,
  IndicatorKind,
  IndicatorKpis,
  IndicatorListItem,
  IndicatorMeasurement,
  IndicatorSeriesPoint,
  IndicatorStatus,
  MeasurementSource,
  MeasurementStatus,
  PercentualDerivedConfig,
  TargetComparator,
  TempoMedioDerivedConfig,
} from '@/lib/indicators/types'
import type { CapaPlan } from '@/lib/safety/capa-types'

// Re-export the client-safe contract so consumers can import types/labels from
// the query module too (mirrors queries/capa.ts).
export type {
  DataSource,
  DerivedConfig,
  HospitalIndicatorRollupRow,
  Indicator,
  IndicatorDirection,
  IndicatorFrequency,
  IndicatorKind,
  IndicatorKpis,
  IndicatorListItem,
  IndicatorMeasurement,
  IndicatorSeriesPoint,
  IndicatorStatus,
  MeasurementStatus,
  TargetComparator,
} from '@/lib/indicators/types'
export {
  DATA_SOURCE_LABELS,
  INDICATOR_DIRECTION_LABELS,
  INDICATOR_FREQUENCY_LABELS,
  INDICATOR_KIND_LABELS,
  INDICATOR_STATUS_LABELS,
  MEASUREMENT_STATUS_LABELS,
} from '@/lib/indicators/types'

// ---------------------------------------------------------------------------
// Row shapes + mappers
// ---------------------------------------------------------------------------

interface IndicatorRow {
  id: string
  commission_id: string
  code: string
  name: string
  description_md: string | null
  kind: string
  numerator_label: string | null
  denominator_label: string | null
  unit: string | null
  direction: string
  target_value: number | null
  target_comparator: string
  lower_warn: number | null
  upper_warn: number | null
  frequency: string
  data_source: string
  derived_config: unknown
  status: string
  created_at: string
  updated_at: string
  commission?: { hospital_id: string | null } | null
}

const INDICATOR_SELECT =
  'id, commission_id, code, name, description_md, kind, numerator_label, ' +
  'denominator_label, unit, direction, target_value, target_comparator, ' +
  'lower_warn, upper_warn, frequency, data_source, derived_config, status, ' +
  'created_at, updated_at, commission:commissions!indicators_commission_id_fkey(hospital_id)'

// List select: the same columns PLUS the embedded measurements (status/value/
// period, newest first) so the list can derive each indicator's latest-measurement
// summary in ONE query — no per-row getIndicatorSeries N+1.
const INDICATOR_LIST_SELECT =
  INDICATOR_SELECT +
  ', indicator_measurements(status, value, period_label, period_start)'

interface IndicatorListRow extends IndicatorRow {
  indicator_measurements?: {
    status: string
    value: number | null
    period_label: string
    period_start: string | null
  }[]
}

/**
 * Map the stored (snake_case) `derived_config` jsonb to the camelCase
 * {@link DerivedConfig} discriminated union. `null` for a manual indicator or a
 * malformed blob (defensive — the DB validator guarantees shape on write).
 */
function mapDerivedConfig(kind: string, raw: unknown): DerivedConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>
  const formId = typeof c.form_id === 'string' ? c.form_id : null
  if (!formId) return null

  if (kind === 'tempo_medio') {
    const value = c.value as Record<string, unknown> | undefined
    const questionKey = value && typeof value.question_key === 'string' ? value.question_key : null
    if (!questionKey) return null
    return { formId, value: { questionKey } } satisfies TempoMedioDerivedConfig
  }

  const num = c.numerator as Record<string, unknown> | undefined
  const questionKey = num && typeof num.question_key === 'string' ? num.question_key : null
  const optionCodes =
    num && Array.isArray(num.option_codes)
      ? (num.option_codes.filter((x) => typeof x === 'string') as string[])
      : null
  if (!questionKey || !optionCodes) return null
  const numerator = { questionKey, optionCodes }

  if (kind === 'taxa') {
    return { formId, numerator } satisfies HybridDerivedConfig
  }

  // percentual / contagem: a denominator ref ({question_key} | 'respondentes').
  const den = c.denominator
  if (den === 'respondentes') {
    return { formId, numerator, denominator: 'respondentes' } satisfies PercentualDerivedConfig
  }
  const denObj = den as Record<string, unknown> | undefined
  const denQk = denObj && typeof denObj.question_key === 'string' ? denObj.question_key : null
  if (!denQk) return null
  return {
    formId,
    numerator,
    denominator: { questionKey: denQk },
  } satisfies PercentualDerivedConfig
}

function mapIndicator(r: IndicatorRow): Indicator {
  return {
    id: r.id,
    commissionId: r.commission_id,
    hospitalId: r.commission?.hospital_id ?? '',
    code: r.code,
    name: r.name,
    descriptionMd: r.description_md,
    kind: r.kind as IndicatorKind,
    numeratorLabel: r.numerator_label,
    denominatorLabel: r.denominator_label,
    unit: r.unit,
    direction: r.direction as IndicatorDirection,
    targetValue: r.target_value,
    targetComparator: r.target_comparator as TargetComparator,
    lowerWarn: r.lower_warn,
    upperWarn: r.upper_warn,
    frequency: r.frequency as IndicatorFrequency,
    dataSource: r.data_source as DataSource,
    derivedConfig: mapDerivedConfig(r.kind, r.derived_config),
    status: r.status as IndicatorStatus,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Indicator reads
// ---------------------------------------------------------------------------

/**
 * All indicators of a commission, newest-first, each with its LATEST-measurement
 * summary (`latestStatus`/`latestValue`/`latestPeriodLabel`) so the list renders
 * the status chip WITHOUT a per-row `getIndicatorSeries` call. `[]` when out of
 * scope. `hospitalId` comes from the commission → hospital embed (display-only).
 * One query: the measurements are embedded and the latest is picked per row.
 */
export async function listIndicators(commissionId: string): Promise<IndicatorListItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('indicators')
    .select(INDICATOR_LIST_SELECT)
    .eq('commission_id', commissionId)
    .order('created_at', { ascending: false })
    .returns<IndicatorListRow[]>()

  return (data ?? []).map((r) => {
    // Pick the latest measurement: highest period_start (nulls last), then
    // period_label — the same order indicator_series / the KPIs RPC use.
    const latest = [...(r.indicator_measurements ?? [])].sort((a, b) => {
      const sa = a.period_start ?? ''
      const sb = b.period_start ?? ''
      if (sa !== sb) return sb.localeCompare(sa)
      return b.period_label.localeCompare(a.period_label)
    })[0]
    return {
      ...mapIndicator(r),
      latestStatus: (latest?.status as MeasurementStatus) ?? 'sem_dados',
      latestValue: latest?.value ?? null,
      latestPeriodLabel: latest?.period_label ?? null,
    }
  })
}

/**
 * One indicator by id (with its `derivedConfig` + `hospitalId`). `null` when out
 * of scope.
 */
export async function getIndicator(id: string): Promise<Indicator | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('indicators')
    .select(INDICATOR_SELECT)
    .eq('id', id)
    .maybeSingle()
    .returns<IndicatorRow | null>()

  return data ? mapIndicator(data) : null
}

interface MeasurementRow {
  id: string
  indicator_id: string
  period_label: string
  period_start: string | null
  period_end: string | null
  numerator: number | null
  denominator: number | null
  value: number | null
  status: string
  source: string
  note: string | null
  entered_at: string
  profiles: { full_name: string | null } | null
}

/** An indicator's measurements, newest period first. */
export async function listIndicatorMeasurements(
  indicatorId: string,
): Promise<IndicatorMeasurement[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('indicator_measurements')
    .select(
      'id, indicator_id, period_label, period_start, period_end, numerator, ' +
        'denominator, value, status, source, note, entered_at, ' +
        'profiles:entered_by(full_name)',
    )
    .eq('indicator_id', indicatorId)
    .order('period_start', { ascending: false, nullsFirst: false })
    .order('period_label', { ascending: false })
    .returns<MeasurementRow[]>()

  return (data ?? []).map((m) => ({
    id: m.id,
    indicatorId: m.indicator_id,
    periodLabel: m.period_label,
    periodStart: m.period_start,
    periodEnd: m.period_end,
    numerator: m.numerator,
    denominator: m.denominator,
    value: m.value,
    status: m.status as MeasurementStatus,
    source: m.source as MeasurementSource,
    enteredByName: m.profiles?.full_name ?? null,
    enteredAt: m.entered_at,
    note: m.note,
  }))
}

interface SeriesRow {
  period_label: string
  period_start: string | null
  value: number | null
  target: number | null
  status: string
}

/**
 * The chart-ready trend series for an indicator (points + the target line),
 * optionally windowed by period label bounds. Backed by the `indicator_series`
 * DEFINER RPC.
 */
export async function getIndicatorSeries(
  id: string,
  from?: string,
  to?: string,
): Promise<IndicatorSeriesPoint[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .rpc('indicator_series', { p_indicator: id, p_from: from ?? undefined, p_to: to ?? undefined })
    .returns<SeriesRow[]>()

  return (data ?? []).map((p) => ({
    periodLabel: p.period_label,
    periodStart: p.period_start,
    value: p.value,
    target: p.target,
    status: p.status as MeasurementStatus,
  }))
}

interface KpisRow {
  total: number
  na_meta: number
  fora_da_meta: number
  sem_dados: number
}

/**
 * Commission indicator KPIs for the dashboard panel. Backed by the
 * `indicator_kpis` DEFINER RPC; zeros for a non-privileged caller.
 */
export async function getIndicatorKpis(commissionId: string): Promise<IndicatorKpis> {
  const supabase = await createClient()
  const { data } = await supabase
    .rpc('indicator_kpis', { p_commission: commissionId })
    .returns<KpisRow[]>()

  const r = data?.[0]
  return {
    total: r?.total ?? 0,
    naMeta: r?.na_meta ?? 0,
    foraDaMeta: r?.fora_da_meta ?? 0,
    semDados: r?.sem_dados ?? 0,
  }
}

interface RollupRow {
  commission_id: string
  commission_name: string
  total: number
  na_meta: number
  fora_da_meta: number
  sem_dados: number
}

/**
 * The PHI-FREE per-commission scorecard for a hospital (counts + names only).
 * Backed by the `hospital_indicator_rollup` DEFINER RPC (admin / hospital_admin /
 * org_admin-gated); `[]` for a foreign hospital_admin.
 */
export async function getHospitalIndicatorRollup(
  hospitalId: string,
): Promise<HospitalIndicatorRollupRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .rpc('hospital_indicator_rollup', { p_hospital: hospitalId })
    .returns<RollupRow[]>()

  return (data ?? []).map((r) => ({
    commissionId: r.commission_id,
    commissionName: r.commission_name,
    total: r.total,
    naMeta: r.na_meta,
    foraDaMeta: r.fora_da_meta,
    semDados: r.sem_dados,
  }))
}

// ---------------------------------------------------------------------------
// Indicator → CAPA read arm (the two-tier escalation)
// ---------------------------------------------------------------------------

interface CapaPlanRow {
  id: string
  code: string
  source: string
  source_indicator_id: string | null
  classification: string
  status: string
  lessons_learned_md: string | null
  created_at: string
  closed_at: string | null
}

/**
 * The CAPA plans opened from an indicator (the two-tier escalation read arm),
 * newest-first. Visible to the indicator's commission members via the
 * `can_read_capa` indicator arm (B6). `[]` when none / out of scope. Returns the
 * plan header shape frontend consumes (a subset of `CapaPlan`; event fields are
 * null — an indicator-sourced plan has no event).
 */
export async function listCapaPlansForIndicator(
  indicatorId: string,
): Promise<CapaPlan[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('capa_plan')
    .select(
      'id, code, source, source_indicator_id, classification, status, ' +
        'lessons_learned_md, created_at, closed_at',
    )
    .eq('source', 'indicator')
    .eq('source_indicator_id', indicatorId)
    .order('created_at', { ascending: false })
    .returns<CapaPlanRow[]>()

  return (data ?? []).map((r) => ({
    id: r.id,
    code: r.code,
    source: 'indicator',
    sourceId: r.source_indicator_id,
    eventId: null,
    eventCode: null,
    classification: r.classification as CapaPlan['classification'],
    status: r.status as CapaPlan['status'],
    lessonsLearnedMd: r.lessons_learned_md,
    openedAt: r.created_at,
    closedAt: r.closed_at,
    viewerCanManage: false,
  }))
}
