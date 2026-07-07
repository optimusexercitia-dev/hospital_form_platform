"use client";

import { RiseInGroup } from "@/components/motion/rise-in-group";

/**
 * Rise-in choreography for the audit feed. Thin re-export shim over the
 * shared `RiseInGroup` (frontend audit #5 — this used to be a standalone
 * hand-copied GSAP wrapper; behavior is unchanged, only the implementation
 * moved). On mount (and whenever `runKey` changes — a page/filter change
 * re-runs the entrance), staggers its `[data-rise]` rows in.
 */
export function AuditMotion({
  runKey,
  className,
  children,
}: {
  /** Bumping this re-runs the entrance (e.g. the current page number). */
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
