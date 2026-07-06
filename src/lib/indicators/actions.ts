'use server'

/**
 * Quality-indicator server actions (Phase 15; Architecture Rules 9, 10, 11).
 *
 * Every write routes through a SECURITY DEFINER RPC (filled in B3/B4/B6). Indicator
 * authoring is `is_staff_admin_of OR is_commission_admin_of` (the post-ADR-0051
 * combined predicate), enforced in the RPC — the sole authority. Measurement edits
 * are staff_admin-write and AUDITED (Rule 11) — corrections are contemporaneous +
 * attributable, never silently overwritten.
 *
 * Off-target → CAPA is TWO-TIER escalation (ADR 0057):
 *  - {@link openCapaFromIndicator} — PQS operators only. Routes to `open_capa_plan`
 *    with `p_source='indicator'`; the RPC DERIVES `hospital_id` from the indicator's
 *    commission (no manual hospital). CAPA write stays PQS-operator-gated
 *    (`can_write_capa` untouched, the WS-3c posture).
 *  - Non-operator staff_admins get NO CAPA affordance; they call the SHARED
 *    Action-Items Hub instead — {@link createActionItem} from
 *    `@/lib/cases/action-items-actions` (there is NO indicator-specific action).
 *    F5 wires the "Criar item de ação" button to that existing action; this module
 *    intentionally does NOT re-implement it.
 *
 * `useActionState`-shaped `{ ok, error?, fieldErrors? }` (the action-items-hub
 * convention). All user-facing strings are pt-BR (Rule 10); raw Postgres errors
 * never reach the UI (§8). SQLSTATEs are mapped from `HC084`+ (B3/B4).
 *
 * ⚠ STUBS — signatures are the FROZEN contract (task B1); bodies land in B3/B4/B6.
 */

import type {
  DataSource,
  IndicatorDirection,
  IndicatorFrequency,
  IndicatorKind,
  TargetComparator,
} from '@/lib/indicators/types'

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
 * Compute returns the resulting measurement id + the derived numerator so the
 * hybrid dialog can echo it back before the denominator is confirmed.
 */
export interface ComputeMeasurementState extends ActionState {
  measurementId?: string
  numerator?: number
  denominator?: number
  value?: number
}

const NOT_IMPLEMENTED = 'not implemented — B3/B4/B6'

// ---------------------------------------------------------------------------
// Indicator CRUD (staff_admin OR commission_admin — RPC-enforced)
// ---------------------------------------------------------------------------

/**
 * Create an indicator. `useActionState`-shaped. Fields: `commissionId`, `name`,
 * `kind`, `direction`, `dataSource`, `frequency`, `targetComparator`,
 * `targetValue`, and (for derived/hybrid) the `derivedConfig` fields
 * (`formId`, numerator `questionKey` + `optionCodes[]`, denominator ref).
 * Routes to `create_indicator`; option `code`s are validated against the form's
 * latest published version (HC084 on an unknown code). Returns `indicatorId`.
 */
export async function createIndicator(
  _prev: CreateIndicatorState | undefined,
  _formData: FormData,
): Promise<CreateIndicatorState> {
  throw new Error(NOT_IMPLEMENTED)
}

/**
 * Edit an indicator's definition (`name`/`descriptionMd`/labels/`unit`/
 * `derivedConfig`/`direction`/`frequency`/warning band). `useActionState`-shaped;
 * expects `indicatorId`. Routes to `update_indicator`. (The target is set via
 * {@link setIndicatorTarget}.)
 */
export async function updateIndicator(
  _prev: ActionState | undefined,
  _formData: FormData,
): Promise<ActionState> {
  throw new Error(NOT_IMPLEMENTED)
}

/** Archive an indicator (`ativo` → `arquivado`, read-only). Routes to `archive_indicator`. */
export async function archiveIndicator(_indicatorId: string): Promise<ActionState> {
  throw new Error(NOT_IMPLEMENTED)
}

/**
 * Set/replace an indicator's target (`targetValue` + `targetComparator`,
 * optionally the warning band). Routes to `set_indicator_target`; re-classifies
 * existing measurements against the new target (across both `direction`s).
 */
export async function setIndicatorTarget(
  _prev: ActionState | undefined,
  _formData: FormData,
): Promise<ActionState> {
  throw new Error(NOT_IMPLEMENTED)
}

// ---------------------------------------------------------------------------
// Measurements (staff_admin-write; every change audited)
// ---------------------------------------------------------------------------

/**
 * Record (or correct) a MANUAL measurement for a period. Fields: `indicatorId`,
 * `periodLabel`, `numerator`, `denominator`, `note?`. Routes to
 * `record_indicator_measurement`, which computes `value` + off-target detection.
 * Upserts on `(indicatorId, periodLabel)`; every change is audited (Rule 11).
 */
export async function recordIndicatorMeasurement(
  _prev: ActionState | undefined,
  _formData: FormData,
): Promise<ActionState> {
  throw new Error(NOT_IMPLEMENTED)
}

/**
 * Compute a DERIVED (or HYBRID) measurement for a period from submitted-form
 * aggregates. Fields: `indicatorId`, `periodLabel`, and — for a HYBRID `taxa` —
 * the manually supplied `denominator`. Routes to `compute_derived_measurement`
 * (DEFINER); the derived value EQUALS the Phase-8 dashboard aggregate for the
 * same window (the parity lock). Hybrid is ONE-STEP (denominator inline; the row
 * is born complete); a recompute re-derives the numerator and PRESERVES the
 * stored denominator unless `denominator` is re-passed. Returns the numerator +
 * value so the hybrid dialog can echo them.
 */
export async function computeDerivedMeasurement(
  _prev: ComputeMeasurementState | undefined,
  _formData: FormData,
): Promise<ComputeMeasurementState> {
  throw new Error(NOT_IMPLEMENTED)
}

// ---------------------------------------------------------------------------
// Two-tier off-target escalation
// ---------------------------------------------------------------------------

/**
 * PQS-OPERATOR path: open a CAPA plan from an off-target indicator measurement.
 * Routes to `open_capa_plan` with `p_source='indicator'` + `p_source_id` = the
 * indicator id; the RPC DERIVES `hospital_id` from the indicator's commission
 * (B6 — no manual `p_hospital_id` for this source). CAPA write stays
 * PQS-operator-gated (`can_write_capa` untouched); a non-operator gets 42501
 * mapped to a pt-BR "apenas o NSP…" message and should use the Action-Items
 * fallback instead.
 *
 * NOTE for F5 (non-operator fallback): there is NO indicator-specific action for
 * "Criar item de ação" — call the SHARED
 * `createActionItem` from `@/lib/cases/action-items-actions` with the indicator
 * context pre-filled (ADR 0057; no schema change). This action is PQS-only.
 */
export async function openCapaFromIndicator(
  _indicatorId: string,
  _measurementId: string,
): Promise<ActionState> {
  throw new Error(NOT_IMPLEMENTED)
}

// Re-export the field-value unions the builder form binds to, so F1 imports its
// select-option vocabulary from one place.
export type {
  DataSource,
  IndicatorDirection,
  IndicatorFrequency,
  IndicatorKind,
  TargetComparator,
}
