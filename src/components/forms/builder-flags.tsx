"use client";

import { createContext, use, useMemo } from "react";

/**
 * The FEATURE FLAGS the form builder branches on, provided once at the builder
 * root and read by whichever descendant actually needs one.
 *
 * ## Why a provider rather than one more prop
 *
 * `containersEnabled` (FF-1) was threaded page → `BuilderShell` → `SectionCard`
 * → `BlockList` → `BlockCard` → `AddBlockMenu`: six components, of which exactly
 * ONE reads it. FF-2 adds a second flag with the identical shape, and FF-3/FF-4
 * each queue another. Adding a boolean per phase to every level of that chain is
 * the boolean-prop proliferation the composition guidance exists to prevent —
 * and, more practically, it is four opportunities per phase to forget one link
 * and ship a flag that is silently always-false in one branch of the tree.
 *
 * A flag is ambient configuration, not data the intermediate components have any
 * opinion about, so it belongs in context: the provider is the single place that
 * knows how flags arrive, and the consumer reads exactly the one it branches on.
 *
 * The value is resolved SERVER-side (the builder page awaits the flag readers)
 * and passed into the provider as plain booleans — no client-side flag fetching,
 * no round trip.
 */
export interface BuilderFlags {
  /** FF-1 (ADR 0087) — offer the `group` / `repeating_group` container types. */
  containers: boolean;
  /**
   * FF-2 (ADR 0089) — offer the `matrix` / `risk_matrix` types. While OFF,
   * `upsert_matrix_axes` raises `HC0P2`, so offering the type would hand the
   * author a block that can never be configured.
   */
  matrix: boolean;
  /**
   * FF-3 (ADR 0090) — offer the per-item validation-rule editor. While OFF,
   * `set_item_validations` refuses the write, so showing the editor would hand
   * the author a dialog whose save can never succeed (the same reasoning as
   * `matrix` above).
   */
  validations: boolean;
}

/** All flags OFF — the safe default for any tree rendered without a provider. */
const DEFAULT_FLAGS: BuilderFlags = {
  containers: false,
  matrix: false,
  validations: false,
};

const BuilderFlagsContext = createContext<BuilderFlags>(DEFAULT_FLAGS);

export function BuilderFlagsProvider({
  containers = false,
  matrix = false,
  validations = false,
  children,
}: {
  containers?: boolean;
  matrix?: boolean;
  validations?: boolean;
  children: React.ReactNode;
}) {
  // Memoized so the context value is referentially stable across the builder's
  // frequent re-renders (every action refreshes the tree) and never invalidates
  // a consumer that did not change.
  const value = useMemo<BuilderFlags>(
    () => ({ containers, matrix, validations }),
    [containers, matrix, validations],
  );
  return <BuilderFlagsContext value={value}>{children}</BuilderFlagsContext>;
}

/**
 * The builder's feature flags. Defaults to all-OFF outside a provider, which is
 * the correct fail-closed behaviour: a builder subtree rendered without flags
 * offers no flagged type rather than offering one the backend would refuse.
 */
export function useBuilderFlags(): BuilderFlags {
  return use(BuilderFlagsContext);
}
