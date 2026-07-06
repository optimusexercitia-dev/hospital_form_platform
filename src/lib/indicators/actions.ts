'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/types/database'
import type {
  DataSource,
  IndicatorDirection,
  IndicatorFrequency,
  IndicatorKind,
  TargetComparator,
} from '@/lib/indicators/types'

/**
 * Quality-indicator server actions (Phase 15; Architecture Rules 9, 10, 11).
 *
 * Every write routes through a SECURITY DEFINER RPC. Indicator authoring is
 * `is_staff_admin_of OR is_commission_admin_of` (the post-ADR-0051 combined
 * predicate), enforced in the RPC — the sole authority (no client pre-check).
 * Measurement writes are AUDITED (Rule 11) — corrections are contemporaneous +
 * attributable.
 *
 * Off-target → CAPA is TWO-TIER escalation (ADR 0057):
 *  - {@link openCapaFromIndicator} — PQS operators only. Routes to `open_capa_plan`
 *    with `p_source='indicator'`; the RPC DERIVES `hospital_id` from the indicator's
 *    commission (no manual hospital). CAPA write stays PQS-operator-gated
 *    (`can_write_capa` untouched, the WS-3c posture).
 *  - Non-operator staff_admins get NO CAPA affordance; F5 calls the SHARED
 *    Action-Items Hub `createManualActionItem` (`@/lib/action-items/actions`)
 *    instead. There is NO indicator-specific action-item action.
 *
 * `useActionState`-shaped `{ ok, error?, fieldErrors? }`. pt-BR strings (Rule 10);
 * raw Postgres errors never reach the UI (§8). SQLSTATEs HC084–HC088 mapped below.
 */

/** `useActionState`-shaped result (the action-items-hub convention). */
export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/** Create returns the new indicator id so the UI can route to its detail. */
export interface CreateIndicatorState extends ActionState {
  indicatorId?: string
}

/**
 * Compute returns the resulting measurement's derived numerator/denominator/value
 * so the hybrid dialog can echo them back.
 */
export interface ComputeMeasurementState extends ActionState {
  measurementId?: string
  numerator?: number
  denominator?: number
  value?: number
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  unavailable: 'O recurso de indicadores de qualidade não está disponível.',
  generic: 'Não foi possível concluir. Tente novamente.',
  notFound: 'Indicador não encontrado.',
  nameRequired: 'Informe o nome do indicador.',
  commissionRequired: 'Comissão não encontrada.',
  periodRequired: 'Informe o período (ex.: 2026-06).',
  numeratorRequired: 'Informe o numerador.',
  numberInvalid: 'Informe um valor numérico válido.',
  dateInvalid: 'Informe uma data válida.',
  configInvalid: 'Configuração derivada inválida ou código de opção desconhecido.',
  isManual: 'Este indicador é manual; use o lançamento manual.',
  isDerived: 'Este indicador é derivado; use o cálculo automático.',
  denomZero: 'O denominador deve ser diferente de zero.',
  denomRequired: 'Informe o denominador.',
  createdIndicator: 'Indicador criado.',
  updatedIndicator: 'Indicador atualizado.',
  archivedIndicator: 'Indicador arquivado.',
  targetSet: 'Meta atualizada.',
  measurementRecorded: 'Medição registrada.',
  measurementComputed: 'Medição calculada.',
  capaOpened: 'Plano de ação (CAPA) aberto.',
  capaForbidden: 'Apenas o NSP pode abrir planos de ação.',
} as const

const PG_CHECK_VIOLATION = '23514'
const PG_FORBIDDEN = '42501'

// The exact pt-BR messages our RPCs RAISE (so we can surface a specific one
// without ever echoing an UNKNOWN — e.g. raw — Postgres message; §8, Rule 10).
// The HC084 "código de opção desconhecido: <code>" message is dynamic, so match
// its stable prefix rather than the whole string.
const KNOWN_PT_BR_HC084 = new Set<string>([
  'configuração derivada inválida',
  'um indicador manual não tem configuração derivada',
  'o formulário não possui versão publicada',
])
const HC084_UNKNOWN_CODE_PREFIX = 'código de opção desconhecido:'

/**
 * Map an indicator RPC error (SQLSTATE HC084–HC088 + generic) to a pt-BR string.
 * NEVER returns a raw `error.message` unless it is one we KNOW our own RPC set in
 * pt-BR — an unrecognized message (or any CHECK-violation message) falls back to
 * the generic pt-BR string so a raw Postgres error can never reach the UI (§8).
 */
function mapIndicatorError(error: { code?: string; message?: string } | null): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case 'HC084': {
      const msg = error.message ?? ''
      if (msg.startsWith(HC084_UNKNOWN_CODE_PREFIX)) return msg // dynamic, pt-BR, safe
      if (KNOWN_PT_BR_HC084.has(msg)) return msg
      return MESSAGES.configInvalid // unknown message → generic pt-BR (no leak)
    }
    case 'HC085':
      return MESSAGES.isManual
    case 'HC086':
      return MESSAGES.isDerived
    case 'HC087':
      return MESSAGES.denomZero
    case 'HC088':
      return MESSAGES.denomRequired
    case PG_FORBIDDEN:
      return MESSAGES.forbidden
    // A CHECK-violation (23514) message may be a raw Postgres string — NEVER echo
    // it; always fall back to the generic pt-BR string.
    case PG_CHECK_VIOLATION:
      return MESSAGES.generic
    default:
      return MESSAGES.generic
  }
}

// --- form-field parsing helpers -------------------------------------------

/** Parse a required numeric field. Returns null on empty/invalid. */
function parseNumber(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? '').trim().replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Parse an optional numeric field. `undefined` when empty, `null` when invalid. */
function parseOptionalNumber(raw: FormDataEntryValue | null): number | null | undefined {
  const s = String(raw ?? '').trim()
  if (!s) return undefined
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Parse an optional ISO date (YYYY-MM-DD). `undefined` empty, `null` invalid. */
function parseDate(raw: FormDataEntryValue | null): string | undefined | null {
  const t = String(raw ?? '').trim()
  if (!t) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
  const d = new Date(`${t}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t) return null
  return t
}

/** Parse the optional `derivedConfig` JSON blob from a form field. */
function parseDerivedConfig(raw: FormDataEntryValue | null): Json | undefined {
  const s = String(raw ?? '').trim()
  if (!s) return undefined
  try {
    return JSON.parse(s) as Json
  } catch {
    return undefined
  }
}

const INDICATORS_PATH = '/o/[org]/c/[commission]/manage/indicators'
const INDICATOR_DETAIL_PATH = '/o/[org]/c/[commission]/manage/indicators/[indicatorId]'
const DASHBOARD_PATH = '/o/[org]/c/[commission]/dashboard'

function revalidateIndicators(): void {
  revalidatePath(INDICATORS_PATH, 'page')
  revalidatePath(INDICATOR_DETAIL_PATH, 'page')
  revalidatePath(DASHBOARD_PATH, 'page')
}

// ---------------------------------------------------------------------------
// Indicator CRUD (staff_admin OR commission_admin — RPC-enforced)
// ---------------------------------------------------------------------------

/**
 * Create an indicator. `useActionState`-shaped. Fields: `commissionId`, `name`,
 * `kind`, `direction`, `dataSource`, `frequency`, `targetComparator`,
 * `targetValue`, optional labels/unit/`descriptionMd`/warning band, and (for
 * derived/hybrid) a `derivedConfig` JSON field. Routes to `create_indicator`;
 * option `code`s validated against the latest published version (HC084). Returns
 * `indicatorId`.
 */
export async function createIndicator(
  _prev: CreateIndicatorState | undefined,
  formData: FormData,
): Promise<CreateIndicatorState> {
  const commissionId = String(formData.get('commissionId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const kind = String(formData.get('kind') ?? 'percentual') as IndicatorKind
  const direction = String(formData.get('direction') ?? 'maior_melhor') as IndicatorDirection
  const dataSource = String(formData.get('dataSource') ?? 'manual') as DataSource
  const frequency = String(formData.get('frequency') ?? 'mensal') as IndicatorFrequency
  const targetComparator = String(formData.get('targetComparator') ?? '>=') as TargetComparator
  const targetValue = parseOptionalNumber(formData.get('targetValue'))
  const derivedConfig = parseDerivedConfig(formData.get('derivedConfig'))

  if (!commissionId) return { ok: false, error: MESSAGES.commissionRequired }
  if (!name) return { ok: false, fieldErrors: { name: MESSAGES.nameRequired } }
  if (targetValue === null) return { ok: false, fieldErrors: { targetValue: MESSAGES.numberInvalid } }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_indicator', {
    p_commission: commissionId,
    p_name: name,
    p_kind: kind,
    p_direction: direction,
    p_data_source: dataSource,
    p_frequency: frequency,
    p_target_comparator: targetComparator,
    p_target_value: targetValue ?? undefined,
    p_numerator_label: String(formData.get('numeratorLabel') ?? '').trim() || undefined,
    p_denominator_label: String(formData.get('denominatorLabel') ?? '').trim() || undefined,
    p_unit: String(formData.get('unit') ?? '').trim() || undefined,
    p_description_md: String(formData.get('descriptionMd') ?? '').trim() || undefined,
    p_lower_warn: parseOptionalNumber(formData.get('lowerWarn')) ?? undefined,
    p_upper_warn: parseOptionalNumber(formData.get('upperWarn')) ?? undefined,
    p_derived_config: derivedConfig ?? undefined,
  })

  if (error || !data) return { ok: false, error: mapIndicatorError(error) }

  revalidateIndicators()
  return { ok: true, error: MESSAGES.createdIndicator, indicatorId: data.id }
}

/**
 * Edit an indicator's definition. `useActionState`-shaped; expects `indicatorId`
 * plus the same definition fields as create. Routes to `update_indicator` (which
 * re-classifies existing measurements). The target is set via
 * {@link setIndicatorTarget}.
 */
export async function updateIndicator(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get('indicatorId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const targetValue = parseOptionalNumber(formData.get('targetValue'))

  if (!id) return { ok: false, error: MESSAGES.notFound }
  if (!name) return { ok: false, fieldErrors: { name: MESSAGES.nameRequired } }
  if (targetValue === null) return { ok: false, fieldErrors: { targetValue: MESSAGES.numberInvalid } }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_indicator', {
    p_id: id,
    p_name: name,
    p_kind: String(formData.get('kind') ?? 'percentual'),
    p_direction: String(formData.get('direction') ?? 'maior_melhor'),
    p_data_source: String(formData.get('dataSource') ?? 'manual'),
    p_frequency: String(formData.get('frequency') ?? 'mensal'),
    p_target_comparator: String(formData.get('targetComparator') ?? '>='),
    p_target_value: targetValue ?? undefined,
    p_numerator_label: String(formData.get('numeratorLabel') ?? '').trim() || undefined,
    p_denominator_label: String(formData.get('denominatorLabel') ?? '').trim() || undefined,
    p_unit: String(formData.get('unit') ?? '').trim() || undefined,
    p_description_md: String(formData.get('descriptionMd') ?? '').trim() || undefined,
    p_lower_warn: parseOptionalNumber(formData.get('lowerWarn')) ?? undefined,
    p_upper_warn: parseOptionalNumber(formData.get('upperWarn')) ?? undefined,
    p_derived_config: parseDerivedConfig(formData.get('derivedConfig')) ?? undefined,
  })

  if (error) return { ok: false, error: mapIndicatorError(error) }

  revalidateIndicators()
  return { ok: true, error: MESSAGES.updatedIndicator }
}

/** Archive an indicator (`ativo` → `arquivado`). Routes to `archive_indicator`. */
export async function archiveIndicator(indicatorId: string): Promise<ActionState> {
  if (!indicatorId) return { ok: false, error: MESSAGES.notFound }

  const supabase = await createClient()
  const { error } = await supabase.rpc('archive_indicator', { p_id: indicatorId })
  if (error) return { ok: false, error: mapIndicatorError(error) }

  revalidateIndicators()
  return { ok: true, error: MESSAGES.archivedIndicator }
}

/**
 * Set/replace an indicator's target (`targetValue` + `targetComparator`, optional
 * warning band). Routes to `set_indicator_target`; re-classifies existing
 * measurements against the new target (both `direction`s).
 */
export async function setIndicatorTarget(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get('indicatorId') ?? '')
  const targetValue = parseNumber(formData.get('targetValue'))
  const targetComparator = String(formData.get('targetComparator') ?? '>=') as TargetComparator

  if (!id) return { ok: false, error: MESSAGES.notFound }
  if (targetValue === null) {
    return { ok: false, fieldErrors: { targetValue: MESSAGES.numberInvalid } }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_indicator_target', {
    p_id: id,
    p_target_value: targetValue,
    p_target_comparator: targetComparator,
    p_lower_warn: parseOptionalNumber(formData.get('lowerWarn')) ?? undefined,
    p_upper_warn: parseOptionalNumber(formData.get('upperWarn')) ?? undefined,
  })

  if (error) return { ok: false, error: mapIndicatorError(error) }

  revalidateIndicators()
  return { ok: true, error: MESSAGES.targetSet }
}

// ---------------------------------------------------------------------------
// Measurements (audited)
// ---------------------------------------------------------------------------

/**
 * Record (or correct) a MANUAL measurement for a period. Fields: `indicatorId`,
 * `periodLabel`, `numerator`, `denominator?`, `note?`, `periodStart?`,
 * `periodEnd?`. Routes to `record_indicator_measurement` (computes value +
 * off-target). Upserts on `(indicatorId, periodLabel)`; audited (Rule 11).
 */
export async function recordIndicatorMeasurement(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get('indicatorId') ?? '')
  const periodLabel = String(formData.get('periodLabel') ?? '').trim()
  const numerator = parseNumber(formData.get('numerator'))
  const denominator = parseOptionalNumber(formData.get('denominator'))
  const periodStart = parseDate(formData.get('periodStart'))
  const periodEnd = parseDate(formData.get('periodEnd'))

  if (!id) return { ok: false, error: MESSAGES.notFound }
  if (!periodLabel) return { ok: false, fieldErrors: { periodLabel: MESSAGES.periodRequired } }
  if (numerator === null) return { ok: false, fieldErrors: { numerator: MESSAGES.numeratorRequired } }
  if (denominator === null) return { ok: false, fieldErrors: { denominator: MESSAGES.numberInvalid } }
  if (periodStart === null) return { ok: false, fieldErrors: { periodStart: MESSAGES.dateInvalid } }
  if (periodEnd === null) return { ok: false, fieldErrors: { periodEnd: MESSAGES.dateInvalid } }

  const supabase = await createClient()
  const { error } = await supabase.rpc('record_indicator_measurement', {
    p_indicator: id,
    p_period_label: periodLabel,
    p_numerator: numerator,
    p_denominator: denominator ?? undefined,
    p_note: String(formData.get('note') ?? '').trim() || undefined,
    p_period_start: periodStart ?? undefined,
    p_period_end: periodEnd ?? undefined,
  })

  if (error) return { ok: false, error: mapIndicatorError(error) }

  revalidateIndicators()
  return { ok: true, error: MESSAGES.measurementRecorded }
}

/**
 * Compute a DERIVED (or HYBRID) measurement for a period from submitted-form
 * aggregates. Fields: `indicatorId`, `periodLabel`, and — for a HYBRID `taxa` —
 * the manually supplied `denominator` (`periodStart?`/`periodEnd?` window the
 * aggregate). Routes to `compute_derived_measurement` (DEFINER); the value EQUALS
 * the Phase-8 dashboard aggregate (parity lock). Hybrid is ONE-STEP + born
 * complete; a recompute preserves the stored denominator unless `denominator` is
 * re-passed. Returns the numerator/denominator/value so the hybrid dialog can
 * echo them.
 */
export async function computeDerivedMeasurement(
  _prev: ComputeMeasurementState | undefined,
  formData: FormData,
): Promise<ComputeMeasurementState> {
  const id = String(formData.get('indicatorId') ?? '')
  const periodLabel = String(formData.get('periodLabel') ?? '').trim()
  const denominator = parseOptionalNumber(formData.get('denominator'))
  const periodStart = parseDate(formData.get('periodStart'))
  const periodEnd = parseDate(formData.get('periodEnd'))

  if (!id) return { ok: false, error: MESSAGES.notFound }
  if (!periodLabel) return { ok: false, fieldErrors: { periodLabel: MESSAGES.periodRequired } }
  if (denominator === null) return { ok: false, fieldErrors: { denominator: MESSAGES.numberInvalid } }
  if (periodStart === null) return { ok: false, fieldErrors: { periodStart: MESSAGES.dateInvalid } }
  if (periodEnd === null) return { ok: false, fieldErrors: { periodEnd: MESSAGES.dateInvalid } }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('compute_derived_measurement', {
    p_indicator: id,
    p_period_label: periodLabel,
    p_denominator: denominator ?? undefined,
    p_period_start: periodStart ?? undefined,
    p_period_end: periodEnd ?? undefined,
  })

  if (error || !data) return { ok: false, error: mapIndicatorError(error) }

  revalidateIndicators()
  return {
    ok: true,
    error: MESSAGES.measurementComputed,
    measurementId: data.id,
    numerator: data.numerator ?? undefined,
    denominator: data.denominator ?? undefined,
    value: data.value ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// Two-tier off-target escalation (PQS-operator arm)
// ---------------------------------------------------------------------------

/**
 * PQS-OPERATOR path: open a CAPA plan from an off-target indicator. Routes to
 * `open_capa_plan` with `p_source='indicator'` + `p_source_id` = the indicator id;
 * the RPC DERIVES `hospital_id` from the indicator's commission (B6 — no manual
 * `p_hospital_id`). CAPA write stays PQS-operator-gated (`can_write_capa`
 * untouched); a non-operator gets 42501 → the pt-BR "apenas o NSP…" message and
 * should use the Action-Items fallback (F5 gates the button on the caller's
 * operator hospitals via `Indicator.hospitalId`).
 *
 * `measurementId` is part of the posted F5 contract — the off-target measurement
 * that triggered the escalation — but `open_capa_plan` links the plan to the
 * INDICATOR, not a specific measurement, so it is intentionally not forwarded to
 * the RPC. Kept in the signature (not dropped) so the FE call site stays stable;
 * the eslint-disable documents the deliberate non-use.
 */
export async function openCapaFromIndicator(
  indicatorId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- F5 context only; the plan links to the indicator, not a measurement
  measurementId: string,
): Promise<ActionState> {
  if (!indicatorId) return { ok: false, error: MESSAGES.notFound }

  const supabase = await createClient()
  const { error } = await supabase.rpc('open_capa_plan', {
    p_source: 'indicator',
    p_classification: 'corretiva',
    p_source_id: indicatorId,
  })

  if (error) {
    if (error.code === PG_FORBIDDEN) return { ok: false, error: MESSAGES.capaForbidden }
    return { ok: false, error: mapIndicatorError(error) }
  }

  revalidateIndicators()
  return { ok: true, error: MESSAGES.capaOpened }
}

// NOTE: no type re-exports here — a `'use server'` module may export ONLY async
// server functions (the RSC action compiler rejects `export type { … }`). Consumers
// import the field-value unions (DataSource / IndicatorKind / …) directly from the
// pure `@/lib/indicators/types`.
