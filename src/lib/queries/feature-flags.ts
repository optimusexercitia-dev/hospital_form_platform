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
 * Whether the Bulk Case Creation ("Múltiplos casos") feature is ON. Thin per-flag
 * wrapper over {@link featureEnabled} (consistent with the other per-flag
 * `*Enabled()` readers), so callers avoid an `as FeatureFlagKey` cast.
 * Request-memoized via {@link getFeatureFlags}. Seeded OFF in the bulk-create
 * migration; flips ON at the feature gate; `seed.sql` forces it ON for local/E2E.
 */
export async function casesBulkCreateEnabled(): Promise<boolean> {
  return featureEnabled('cases_bulk_create')
}
