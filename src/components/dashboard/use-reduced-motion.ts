"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

// Motion is opt-OUT, so the safe server/first-paint default is "not reduced"
// (animations allowed); the real value resolves on hydration.
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Tracks the user's `prefers-reduced-motion` setting, reactively, via
 * `useSyncExternalStore` (the idiomatic subscription to an external store — no
 * setState-in-effect). Mirrors the project's matchMedia guard (`auth-hero`,
 * `stat-count`, `wizard-progress`) but reusable for the dashboard charts, which
 * disable Recharts' entrance animations under reduced motion
 * (`isAnimationActive={!reduced}`).
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
