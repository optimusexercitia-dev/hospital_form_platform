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
 *  - `indicators` + `indicator_measurements`: member-READ / `is_staff_admin_of OR
 *    is_commission_admin_of` WRITE, commission-scoped. Foreign-commission users
 *    read nothing.
 *  - The hospital tier reads ONLY via `hospital_indicator_rollup` (a PHI-free
 *    DEFINER scorecard — counts + status), never the row (no table grant).
 *  - KPIs come from the `indicator_kpis` DEFINER RPC (`is_staff_admin_of OR
 *    is_commission_admin_of`-gated); a non-privileged caller gets zeros.
 *
 * PHI-FREE: indicators are aggregate process/quality metrics (ADR 0057).
 *
 * ⚠ STUBS — signatures + return shapes are the FROZEN contract (task B1). Bodies
 * are filled in B3/B5 (reads) once the migration + RPCs land. Do NOT change a
 * signature without telling the lead (frontend builds F1/F4/F6 against these).
 */

import type {
  HospitalIndicatorRollupRow,
  Indicator,
  IndicatorKpis,
  IndicatorMeasurement,
  IndicatorSeriesPoint,
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

const NOT_IMPLEMENTED = 'not implemented — B3/B5'

/**
 * All indicators of a commission, newest-first. `[]` when out of scope.
 * Populates `hospitalId` by joining the commission → its hospital
 * (`commissions.hospital_id` / `hospital_of_commission`) — display-only, for the
 * F5 "Abrir CAPA" button-visibility gate.
 */
export async function listIndicators(_commissionId: string): Promise<Indicator[]> {
  throw new Error(NOT_IMPLEMENTED)
}

/**
 * One indicator by id (with its `derivedConfig` + `hospitalId`). `null` when out
 * of scope. `hospitalId` from the commission → hospital join (display-only).
 */
export async function getIndicator(_id: string): Promise<Indicator | null> {
  throw new Error(NOT_IMPLEMENTED)
}

/** An indicator's measurements, newest period first. */
export async function listIndicatorMeasurements(
  _indicatorId: string,
): Promise<IndicatorMeasurement[]> {
  throw new Error(NOT_IMPLEMENTED)
}

/**
 * The chart-ready trend series for an indicator (points + the target line),
 * optionally windowed by period label bounds. Backed by the `indicator_series`
 * DEFINER RPC.
 */
export async function getIndicatorSeries(
  _id: string,
  _from?: string,
  _to?: string,
): Promise<IndicatorSeriesPoint[]> {
  throw new Error(NOT_IMPLEMENTED)
}

/**
 * Commission indicator KPIs for the dashboard panel (na-meta / fora-da-meta /
 * sem-dados / total). Backed by the `indicator_kpis` DEFINER RPC; zeros for a
 * non-privileged caller.
 */
export async function getIndicatorKpis(
  _commissionId: string,
): Promise<IndicatorKpis> {
  throw new Error(NOT_IMPLEMENTED)
}

/**
 * The PHI-FREE per-commission scorecard for a hospital (counts + status only).
 * Backed by the `hospital_indicator_rollup` DEFINER RPC
 * (`is_hospital_admin_of`/org-admin-gated); `[]` for a foreign hospital_admin.
 */
export async function getHospitalIndicatorRollup(
  _hospitalId: string,
): Promise<HospitalIndicatorRollupRow[]> {
  throw new Error(NOT_IMPLEMENTED)
}

/**
 * The CAPA plans opened from an indicator (the two-tier escalation read arm),
 * newest-first. Visible to the indicator's commission members via the
 * `can_read_capa` indicator arm (B6). `[]` when none / out of scope.
 */
export async function listCapaPlansForIndicator(
  _indicatorId: string,
): Promise<CapaPlan[]> {
  throw new Error(NOT_IMPLEMENTED)
}
