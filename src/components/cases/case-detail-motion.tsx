"use client";

import { RiseInGroup } from "@/components/motion/rise-in-group";

/**
 * Rise-in choreography for the case-detail layout. Thin re-export shim over
 * the shared `RiseInGroup` (frontend audit #5 — this used to be a standalone
 * hand-copied GSAP wrapper; behavior is unchanged, only the implementation
 * moved). On mount, staggers its `[data-rise]` blocks in (fade + 12px rise,
 * 60ms stagger — matching the `--rise-delay` convention).
 */
export function CaseDetailMotion({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <RiseInGroup className={className} y={12} stagger={0.06}>
      {children}
    </RiseInGroup>
  );
}
