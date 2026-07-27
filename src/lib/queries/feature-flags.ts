import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Feature-flags data-access (WS-6 P4 — consolidated flag read; Architecture
 * Rule 9). Replaces the N separate per-flag `*_enabled()` DEFINER round trips
 * (7 in `c/[commission]/layout.tsx` alone) with ONE `get_feature_flags()` call,
 * memoized per request via React `cache()` (same pattern as the Wave-1 P1
 * `getSessionContext` fix). The thin per-flag readers across the query layer
 * delegate here, so a render tree resolves all flags in a single round trip.
 */

/**
 * The known feature flags, as booleans. HAND-MAINTAINED (lead decision, not
 * build-generated): when a new flag key is added to `app.feature_flags`, add its
 * field here. A key present in the DB but absent from this interface is simply
 * ignored by typed callers; a key absent from the DB reads as `false` (safe
 * default) via {@link featureEnabled}.
 */
export interface FeatureFlags {
  audit_trail: boolean
  case_access: boolean
  case_narratives: boolean
  case_patient: boolean
  cases_extras: boolean
  cases_multi_phase: boolean
  interviews: boolean
  meetings: boolean
  patient_index: boolean
  patient_safety: boolean
  case_phase_results: boolean
  processless_cases: boolean
  case_referrals: boolean
  signoff_enforcement: boolean
  action_items: boolean
  quality_indicators: boolean
  controlled_docs: boolean
  administrativo: boolean
  attachments: boolean
  response_correction: boolean
  notifications: boolean
  // ETH·E1 (ADR 0072 D10): the m2 gate — the generalized-subject participant registry
  // + case-type config. Flipped ON at E1 (BE-8) once respondent-exclusion RLS landed.
  case_participants: boolean
  case_types: boolean
  // ETH·E2 (ADR 0073): the ethics procedure engine (allegations/findings/votes/decisions/
  // hearings/appeals + auto-derived timeline). Seeded ON local/E2E; remote OFF till pilot.
  ethics: boolean
  // S4·CH (ADR 0080): committee charters + meeting cadence. Seeded OFF in the CH-BE-2
  // migration; flipped ON at the CH gate; `seed.sql` forces ON for local/E2E.
  charters: boolean
  // ADR 0083: template-defined case custom fields (administrative descriptors).
  // Seeded OFF in the case-custom-fields migration; `seed.sql` forces ON for local/E2E.
  case_custom_fields: boolean
  // Bulk case creation ("Múltiplos casos"): the bulk_create_cases RPC deals many
  // cases across members in one atomic transaction. Seeded OFF in the bulk-create
  // migration; `seed.sql` forces ON for local/E2E.
  cases_bulk_create: boolean
  // Case Correction Lifecycle: phase/narrative correction + void requests and
  // reopen_case. Seeded OFF in the correction-schema migration; flips ON at the
  // feature gate; `seed.sql` forces it ON for local/E2E.
  case_corrections: boolean
  // FF-1 (ADR 0087): repeating groups + the plain `group` container — the
  // container item types in the builder, the response_group_instances write RPCs,
  // and instance-aware condition evaluation. Seeded OFF in
  // 20260828000000_ff1_repeating_groups_schema; flipped by
  // 20260828000900_enable_repeating_groups at the FF-1 gate; `seed.sql` forces it
  // ON for local/E2E.
  repeating_groups: boolean
  // FF-2 (ADR 0089): matrix + risk_matrix items — the two item types in the
  // builder, `upsert_matrix_axes`, the matrix arms of `save_section_answers`,
  // and row-complete required-ness. Seeded OFF in
  // 20260830000100_ff2_matrix_flag; `seed.sql` forces it ON for local/E2E.
  // ⚠ CURRENT TRUTH: the production gate-flip migration is NOT WRITTEN YET (the
  // FF-1 twin above names `20260828000900`; FF-2 has no counterpart). So outside
  // local/E2E this flag is OFF. Resolve the VALUE in `app.feature_flags.enabled`,
  // never this comment.
  matrix_fields: boolean
}

/** A flag key. */
export type FeatureFlagKey = keyof FeatureFlags

/**
 * All feature flags in one round trip, memoized per request. Backed by the
 * `get_feature_flags()` DEFINER RPC (returns `{ key: enabled, ... }`). Safe-defaults
 * to all-false on any error — a flag read is called at render time (layouts) and
 * must never throw.
 */
export const getFeatureFlags = cache(async (): Promise<Record<string, boolean>> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_feature_flags')
  if (error || !data || typeof data !== 'object') return {}
  return data as Record<string, boolean>
})

/**
 * Whether a single flag is ON. Reads the consolidated {@link getFeatureFlags}
 * (request-memoized), so many `featureEnabled(...)` calls in one render collapse
 * to a single round trip. Absent key → `false` (safe default), matching the
 * former per-flag `*_enabled()` semantics.
 */
export async function featureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const flags = await getFeatureFlags()
  return flags[key] === true
}

/**
 * Whether the Phase-15 Quality Indicators feature is ON. Thin per-flag wrapper
 * over {@link featureEnabled} (consistent with the other per-flag `*Enabled()`
 * readers), so callers avoid an `as FeatureFlagKey` cast. Request-memoized via
 * {@link getFeatureFlags}. Seeded OFF in B2; flips ON at the end of Phase 15 (B6).
 */
export async function qualityIndicatorsEnabled(): Promise<boolean> {
  return featureEnabled('quality_indicators')
}

/**
 * Whether the Phase-17 Controlled Documents feature is ON. Thin per-flag wrapper
 * over {@link featureEnabled} (consistent with the other per-flag `*Enabled()`
 * readers), so callers avoid an `as FeatureFlagKey` cast. Request-memoized via
 * {@link getFeatureFlags}. Seeded OFF in B1; flips ON at the end of Phase 17 (B-final).
 */
export async function controlledDocsEnabled(): Promise<boolean> {
  return featureEnabled('controlled_docs')
}

/**
 * Whether the SUP · Supersession correction engine (Pre-Pilot Release, ADR
 * 0074) is ON. Thin per-flag wrapper over {@link featureEnabled} (consistent
 * with the other per-flag `*Enabled()` readers), so callers avoid an `as
 * FeatureFlagKey` cast. Request-memoized via {@link getFeatureFlags}. Seeded
 * OFF in the SUP core migration; flips ON via a companion one-line migration
 * at the SUP gate; `seed.sql` forces it ON for local/E2E.
 */
export async function responseCorrectionEnabled(): Promise<boolean> {
  return featureEnabled('response_correction')
}

/**
 * Whether the S1·N Notifications engine (Phase 20, ADR 0076) is ON. Thin
 * per-flag wrapper over {@link featureEnabled} (consistent with the other
 * per-flag `*Enabled()` readers), so callers avoid an `as FeatureFlagKey`
 * cast. Request-memoized via {@link getFeatureFlags}. Seeded OFF in the
 * notifications core migration; flips ON via a companion one-line migration
 * at the S1·N gate; `seed.sql` forces it ON for local/E2E.
 */
export async function notificationsEnabled(): Promise<boolean> {
  return featureEnabled('notifications')
}

/**
 * Whether the S4·CH Committee Charters & Meeting Cadence feature (Phase 21, ADR
 * 0080) is ON. Thin per-flag wrapper over {@link featureEnabled} (consistent with
 * the other per-flag `*Enabled()` readers), so callers avoid an `as FeatureFlagKey`
 * cast. Request-memoized via {@link getFeatureFlags}. Seeded OFF in the CH-BE-2 core
 * migration; flips ON at the CH gate; `seed.sql` forces it ON for local/E2E. The
 * flag ROW does not exist until CH-BE-2 lands, so this reads `false` until then.
 */
export async function chartersEnabled(): Promise<boolean> {
  return featureEnabled('charters')
}

/**
 * Whether the ADR-0083 Case Custom Fields feature is ON. Thin per-flag wrapper
 * over {@link featureEnabled} (consistent with the other per-flag `*Enabled()`
 * readers), so callers avoid an `as FeatureFlagKey` cast. Request-memoized via
 * {@link getFeatureFlags}. Seeded OFF in the case-custom-fields migration; flips
 * ON at the feature gate; `seed.sql` forces it ON for local/E2E.
 */
export async function caseCustomFieldsEnabled(): Promise<boolean> {
  return featureEnabled('case_custom_fields')
}

/**
 * Whether the case-TYPE vocabulary is ON (ADR 0064 Decision 4). Gates the
 * process-template "Tipo de caso" picker, the create-case dialog's process-less
 * picker, and the org-admin manager. Also gates the type's default-visibility
 * inheritance inside `create_case` / `create_case_from_template`, so a screen that
 * offers the picker while the flag is off would silently drop the selection.
 */
export async function caseTypesEnabled(): Promise<boolean> {
  return featureEnabled('case_types')
}

/**
 * Whether the Bulk Case Creation ("Múltiplos casos") feature is ON. Thin per-flag
 * wrapper over {@link featureEnabled} (consistent with the other per-flag
 * `*Enabled()` readers), so callers avoid an `as FeatureFlagKey` cast.
 * Request-memoized via {@link getFeatureFlags}. Seeded OFF in the bulk-create
 * migration; flips ON at the feature gate; `seed.sql` forces it ON for local/E2E.
 */
export async function casesBulkCreateEnabled(): Promise<boolean> {
  return featureEnabled('cases_bulk_create')
}

/**
 * Whether the Case Correction Lifecycle feature is ON. Thin per-flag wrapper over
 * {@link featureEnabled} (consistent with the other per-flag `*Enabled()` readers),
 * so callers avoid an `as FeatureFlagKey` cast. Request-memoized via
 * {@link getFeatureFlags}. Seeded OFF in the correction-schema migration; flips ON
 * at the feature gate; `seed.sql` forces it ON for local/E2E.
 */
export async function caseCorrectionsEnabled(): Promise<boolean> {
  return featureEnabled('case_corrections')
}

/**
 * Whether repeating groups (FF-1, ADR 0087) are ON. Thin per-flag wrapper over
 * {@link featureEnabled} (consistent with the other per-flag `*Enabled()` readers),
 * so callers avoid an `as FeatureFlagKey` cast. Request-memoized via
 * {@link getFeatureFlags}. Seeded OFF in
 * `20260828000000_ff1_repeating_groups_schema`; flipped by
 * `20260828000900_enable_repeating_groups` at the FF-1 gate; `seed.sql` forces it
 * ON for local/E2E.
 *
 * Gates the BUILDER's container types. The three instance RPCs check the SAME
 * flag server-side (`app.feature_enabled('repeating_groups')` → `HC0N0`), so the
 * feature is dark on both sides of the boundary and hiding the UI is never the
 * control (Rule 1).
 */
export async function repeatingGroupsEnabled(): Promise<boolean> {
  return featureEnabled('repeating_groups')
}

/**
 * Whether matrix + risk-matrix items (FF-2, ADR 0089) are ON. Thin per-flag
 * wrapper over {@link featureEnabled} (consistent with the other per-flag
 * `*Enabled()` readers), so callers avoid an `as FeatureFlagKey` cast.
 * Request-memoized via {@link getFeatureFlags}.
 *
 * Seeded OFF in `20260830000100_ff2_matrix_flag`; `seed.sql` forces it ON for
 * local/E2E. **The production gate-flip migration is not written yet** — unlike
 * `repeating_groups`, which `20260828000900` flipped at the FF-1 gate — so this
 * reads false anywhere but local/E2E until the FF-2 gate lands.
 *
 * Gates the BUILDER's matrix item types and the wizard's grid. The server checks
 * the SAME flag (`app.feature_enabled('matrix_fields')` → `HC0P2` from
 * `upsert_matrix_axes` and from the two answer writers), so the feature is dark
 * on both sides of the boundary and hiding the UI is never the control (Rule 1).
 */
export async function matrixFieldsEnabled(): Promise<boolean> {
  return featureEnabled('matrix_fields')
}
