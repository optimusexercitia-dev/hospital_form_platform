import 'server-only'

import { getFeatureFlags } from '@/lib/queries/feature-flags'

/**
 * FF-1 (ADR 0087) — whether the `repeating_groups` feature is ON.
 *
 * TODO(FF-1 · swap to the typed reader): `src/lib/queries/feature-flags.ts` is
 * backend-owned and its `FeatureFlags` interface does not yet carry a
 * `repeating_groups` field, so `featureEnabled('repeating_groups')` will not
 * typecheck (`FeatureFlagKey = keyof FeatureFlags`). The DB row EXISTS
 * (`app.feature_flags`, seeded `enabled = false`), so this reads the consolidated
 * untyped map instead — no `as FeatureFlagKey` cast into someone else's type,
 * which would compile today and silently rot the moment that type changes.
 * **When backend adds the field + its `repeatingGroupsEnabled()` reader, delete
 * this module and import theirs.** Behaviour is identical either way: same RPC,
 * same request-level memoization via `getFeatureFlags`, absent key → `false`.
 *
 * While OFF the builder must not OFFER the container types (`AddBlockMenu`
 * hides the "Estrutura" group). Rendering of an already-authored container is
 * deliberately NOT gated: a form that somehow holds one must still render
 * truthfully rather than silently dropping its questions.
 */
export async function repeatingGroupsEnabled(): Promise<boolean> {
  const flags = await getFeatureFlags()
  return flags.repeating_groups === true
}
