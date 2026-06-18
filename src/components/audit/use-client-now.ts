"use client";

import { useSyncExternalStore } from "react";

/**
 * A stable client-side "now" (ms epoch), resolved once on hydration. Returns
 * `null` on the server / first paint so the feed renders deterministically (the
 * absolute date carries the meaning until then; the relative label fills in on
 * hydration).
 *
 * Implemented with `useSyncExternalStore` — the project's idiomatic way to read a
 * client-only value with an SSR fallback (mirrors `use-reduced-motion.ts`) — so
 * it never trips `react-hooks/purity` (no `Date.now()` in render) nor
 * `react-hooks/set-state-in-effect` (no setState-in-effect). The value is
 * captured once and frozen; relative timestamps don't tick live, which is exactly
 * right for an audit log (a static snapshot, not a live clock).
 */

// A one-shot store: subscribe is a no-op (the value never changes after the
// first client read), and the snapshot is memoized so the hook stays stable.
let cachedNow: number | null = null;

function subscribe(): () => void {
  return () => {};
}

function getSnapshot(): number {
  if (cachedNow === null) cachedNow = Date.now();
  return cachedNow;
}

function getServerSnapshot(): null {
  return null;
}

export function useClientNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
