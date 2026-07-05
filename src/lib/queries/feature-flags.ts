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
