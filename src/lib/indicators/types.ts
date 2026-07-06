/**
 * Quality Indicators (Phase 15 — Indicadores de Qualidade) — CLIENT-SAFE domain
 * types + label maps.
 *
 * **Purity contract** (the `event-model.ts` / `safety/capa-types.ts` discipline).
 * This module has ZERO runtime imports of server-only code — it stays importable
 * from CLIENT components (the indicator builder, the measurement grid, the run
 * chart). It must NEVER import `@/lib/supabase/*`, `next/headers`, `server-only`,
 * or any data-access/action module. The server-only readers
 * (`@/lib/queries/indicators`) and the `"use server"` actions
 * (`@/lib/indicators/actions`) import their types FROM here.
 *
 * A quality indicator is a managed metric (numerator/denominator, target,
 * periodicity, direction) measured over time and tracked vs its target. Values
 * are entered MANUALLY or DERIVED from submitted-form aggregates via option
 * `code`s / typed answers (the Phase-8 dashboard spine). The classic per-1000
 * `taxa` is a HYBRID: a derived numerator with a manually supplied denominator.
 * PHI-FREE by design — indicators are aggregate process/quality metrics
 * (ADR 0057, ARCHITECTURE.md Rule 12).
 *
 * Stable ASCII union slugs are the storage/logic values; user-facing strings are
 * pt-BR (via the label maps below). The `description_md` body is sanitized
 * Markdown (Rule 7) and is NEVER copied into the audit log (Rule 11).
 */

// ---------------------------------------------------------------------------
// Domain unions — the FIXED vocabulary (ASCII storage values; pt-BR via labels)
// ---------------------------------------------------------------------------

/**
 * The indicator kind. `percentual` (a %), `taxa` (a rate, e.g. per-1000 — the
 * HYBRID mode: derived numerator + manual denominator), `contagem` (a raw count),
 * `tempo_medio` (an average of a numeric answer — e.g. mean length of stay).
 */
export type IndicatorKind = 'percentual' | 'taxa' | 'contagem' | 'tempo_medio'

/**
 * Which direction is "good". `maior_melhor` (higher is better — e.g. adherence);
 * `menor_melhor` (lower is better — e.g. infection rate). Drives off-target
 * detection together with `targetComparator`.
 */
export type IndicatorDirection = 'maior_melhor' | 'menor_melhor'

/**
 * How a measurement's value is produced. `manual` (staff enter numerator +
 * denominator by hand), `derivado` (fully computed from submitted-form
 * aggregates), `hibrido` (derived numerator + manually supplied denominator —
 * the `taxa` mode).
 */
export type DataSource = 'manual' | 'derivado' | 'hibrido'

/** The target comparison operator (measurement `value` vs `targetValue`). */
export type TargetComparator = '>=' | '<=' | '=' | '>' | '<'

/** The measurement cadence. */
export type IndicatorFrequency =
  | 'mensal'
  | 'bimestral'
  | 'trimestral'
  | 'semestral'
  | 'anual'

/** The indicator lifecycle. `ativo` (measured) → `arquivado` (retired, read-only). */
export type IndicatorStatus = 'ativo' | 'arquivado'

/**
 * A single measurement's target classification. `na_meta` (on target),
 * `fora_da_meta` (off target), `sem_dados` (no value yet — the ONLY empty state;
 * a hybrid row is born complete, so there is no partial-measurement status).
 */
export type MeasurementStatus = 'na_meta' | 'fora_da_meta' | 'sem_dados'

/** Where a measurement's value came from (a single measurement row). */
export type MeasurementSource = 'manual' | 'derivado'

// ---------------------------------------------------------------------------
// Derived config — the discriminated union describing HOW a value is computed
// ---------------------------------------------------------------------------

/**
 * A numerator reference: a choice `question_key` plus the option `code`s that
 * count toward the numerator. `optionCodes` reference the immutable option `code`
 * (never labels or option-row ids — the normalized cross-version identity), and
 * are validated on save against the form's latest published version.
 */
export interface DerivedNumeratorRef {
  questionKey: string
  optionCodes: string[]
}

/**
 * A denominator reference for a percentual/contagem derived indicator. Either
 * another choice `question_key` (distinct responses that answered it, section-
 * scoped — the `dashboard_distributions` denominator), OR the literal
 * `'respondentes'` (the count of submitted responses in the window).
 */
export type DerivedDenominatorRef = { questionKey: string } | 'respondentes'

/**
 * `percentual` / `contagem` derived config: numerator via option `code`s over a
 * choice question, denominator via another choice question OR `'respondentes'`.
 * A `contagem` reports the raw numerator; a `percentual` reports
 * numerator/denominator × 100.
 */
export interface PercentualDerivedConfig {
  formId: string
  numerator: DerivedNumeratorRef
  denominator: DerivedDenominatorRef
}

/**
 * `tempo_medio` derived config: the average of a numeric item's typed answers
 * (`answers.value_number`) over submitted responses.
 */
export interface TempoMedioDerivedConfig {
  formId: string
  value: { questionKey: string }
}

/**
 * `hibrido` (taxa) derived config: the percentual NUMERATOR shape (option `code`s
 * over a choice question); the denominator is supplied MANUALLY per measurement
 * (there is no denominator ref here — it is passed inline to
 * `computeDerivedMeasurement`).
 */
export interface HybridDerivedConfig {
  formId: string
  numerator: DerivedNumeratorRef
}

/**
 * The `derived_config` discriminated union, keyed by the indicator `kind`. A
 * `manual` indicator has `null` config. `percentual`/`contagem` share the shape;
 * `taxa` uses {@link HybridDerivedConfig}; `tempo_medio` uses
 * {@link TempoMedioDerivedConfig}.
 */
export type DerivedConfig =
  | PercentualDerivedConfig
  | TempoMedioDerivedConfig
  | HybridDerivedConfig

// ---------------------------------------------------------------------------
// Row-shaped domain objects (camelCase; the query layer maps snake_case rows)
// ---------------------------------------------------------------------------

/**
 * A managed quality indicator. Commission-owned (`commissionId`); the hospital
 * tier sees only the read-only rollup, never the row (ADR 0057). `derivedConfig`
 * is present iff `dataSource !== 'manual'`.
 */
export interface Indicator {
  id: string
  commissionId: string
  /**
   * The hospital the indicator's commission belongs to (`hospital_of_commission`).
   * DISPLAY-ONLY — lets the UI decide whether to render the "Abrir CAPA" button
   * (match against the caller's PQS-operator hospitals) without provoking a 42501.
   * The real authority boundary stays the `open_capa_plan` operator check.
   */
  hospitalId: string
  code: string
  name: string
  descriptionMd: string | null
  kind: IndicatorKind
  numeratorLabel: string | null
  denominatorLabel: string | null
  unit: string | null
  direction: IndicatorDirection
  targetValue: number | null
  targetComparator: TargetComparator
  lowerWarn: number | null
  upperWarn: number | null
  frequency: IndicatorFrequency
  dataSource: DataSource
  derivedConfig: DerivedConfig | null
  status: IndicatorStatus
  createdAt: string
  updatedAt: string
}

/**
 * A single measurement of an indicator for one period. `value` is computed from
 * `numerator`/`denominator` per the indicator kind. `status` is the target
 * classification at this value (`sem_dados` when `value` is null).
 */
export interface IndicatorMeasurement {
  id: string
  indicatorId: string
  periodLabel: string
  periodStart: string | null
  periodEnd: string | null
  numerator: number | null
  denominator: number | null
  value: number | null
  status: MeasurementStatus
  source: MeasurementSource
  enteredByName: string | null
  enteredAt: string
  note: string | null
}

/**
 * One point on an indicator's trend series (chart-ready). `target` echoes the
 * indicator target so the run chart can draw the target line without a second
 * fetch; `status` classifies the point.
 */
export interface IndicatorSeriesPoint {
  periodLabel: string
  periodStart: string | null
  value: number | null
  target: number | null
  status: MeasurementStatus
}

/**
 * Commission-level indicator KPIs (the dashboard "Indicadores" panel).
 * `naMeta`/`foraDaMeta`/`semDados` count indicators by their LATEST measurement's
 * classification; `total` = active indicators.
 */
export interface IndicatorKpis {
  total: number
  naMeta: number
  foraDaMeta: number
  semDados: number
}

/**
 * One row of the PHI-FREE hospital rollup scorecard: per-commission indicator
 * counts + status (counts only — NO indicator names, definitions, or values that
 * would exceed the hospital tier's minimum-necessary read; mirrors `nsp_org_*`).
 */
export interface HospitalIndicatorRollupRow {
  commissionId: string
  commissionName: string
  total: number
  naMeta: number
  foraDaMeta: number
  semDados: number
}

// ---------------------------------------------------------------------------
// pt-BR label maps (user-facing strings; storage stays ASCII)
// ---------------------------------------------------------------------------

export const INDICATOR_KIND_LABELS: Record<IndicatorKind, string> = {
  percentual: 'Percentual',
  taxa: 'Taxa',
  contagem: 'Contagem',
  tempo_medio: 'Tempo médio',
}

export const INDICATOR_DIRECTION_LABELS: Record<IndicatorDirection, string> = {
  maior_melhor: 'Maior é melhor',
  menor_melhor: 'Menor é melhor',
}

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  manual: 'Manual',
  derivado: 'Derivado',
  hibrido: 'Híbrido (numerador derivado)',
}

export const INDICATOR_FREQUENCY_LABELS: Record<IndicatorFrequency, string> = {
  mensal: 'Mensal',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
}

export const INDICATOR_STATUS_LABELS: Record<IndicatorStatus, string> = {
  ativo: 'Ativo',
  arquivado: 'Arquivado',
}

export const MEASUREMENT_STATUS_LABELS: Record<MeasurementStatus, string> = {
  na_meta: 'Na meta',
  fora_da_meta: 'Fora da meta',
  sem_dados: 'Sem dados',
}
