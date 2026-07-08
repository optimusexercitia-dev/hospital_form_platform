"use client";

import { RiseInGroup } from "@/components/motion/rise-in-group";

/**
 * Rise-in choreography for the patient-safety / NSP surfaces (the inbox queue
 * and the event detail). Thin re-export shim over the shared `RiseInGroup`
 * (frontend audit #5 — this used to be a standalone hand-copied GSAP wrapper;
 * behavior is unchanged, only the implementation moved). On mount (and
 * whenever `runKey` changes — a filter/page change re-runs the entrance),
 * staggers its `[data-rise]` children in.
 */
export function SafetyMotion({
  runKey,
  className,
  children,
}: {
  /** Bumping this re-runs the entrance (e.g. the active filter signature). */
  runKey: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <RiseInGroup runKey={runKey} className={className}>
      {children}
    </RiseInGroup>
  );
}
