"use client";

import { useCallback } from "react";

import { getMotionDurations, MOTION_EASE, type Gsap } from "@/components/motion/motion-tokens";
import { RiseInGroup } from "@/components/motion/rise-in-group";

/**
 * Entrance choreography for a timeline layout. Thin wrapper over the shared
 * `RiseInGroup` (frontend audit #5 — this used to be a standalone
 * hand-copied GSAP wrapper; behavior is unchanged, only the implementation
 * moved) that layers two timeline-specific touches on top via `onAnimate`:
 *   - the shared rise-in stagger over feed rows (`[data-rise]`) AND Gantt
 *     pins (`[data-pin]`) together, in that combined order (matches the
 *     original single `gsap.from` call over the concatenated array);
 *   - phase bars (`[data-bar]`) grow from zero width (scaleX 0 → 1, left origin);
 *   - the today/closed marker (`[data-marker]`) draws in (scaleY 0 → 1, top origin).
 *
 * `RiseInGroup`'s own built-in rise is disabled (`selector={null}`) since the
 * combined rows+pins stagger needs to run as one `gsap.from` call, not two
 * separate ones keyed off different selectors.
 *
 * `view` is the `runKey` so switching layouts re-runs the entrance, giving
 * the crossfade. All targets are queried fresh each run (the active layout's DOM).
 */
export function TimelineMotion({
  view,
  className,
  children,
}: {
  view: string;
  className?: string;
  children: React.ReactNode;
}) {
  const onAnimate = useCallback((gsap: Gsap, root: HTMLElement) => {
    const rows = root.querySelectorAll<HTMLElement>("[data-rise]");
    const pins = root.querySelectorAll<HTMLElement>("[data-pin]");
    const bars = root.querySelectorAll<HTMLElement>("[data-bar]");
    const marker = root.querySelector<HTMLElement>("[data-marker]");
    const { durBase } = getMotionDurations();

    // Feed rows + Gantt pins: the shared rise-in stagger.
    const riseTargets = [...(rows ? Array.from(rows) : []), ...(pins ? Array.from(pins) : [])];
    if (riseTargets.length) {
      gsap.from(riseTargets, {
        opacity: 0,
        y: 10,
        duration: durBase,
        ease: MOTION_EASE.outSoft,
        stagger: 0.04,
        clearProps: "opacity,transform",
      });
    }

    // Phase bars grow from zero width.
    if (bars && bars.length) {
      gsap.from(bars, {
        scaleX: 0,
        transformOrigin: "left center",
        opacity: 0,
        duration: 0.42,
        ease: "power3.out",
        stagger: 0.05,
        clearProps: "transform,opacity",
      });
    }

    // Today / closed marker draws in.
    if (marker) {
      gsap.from(marker, {
        scaleY: 0,
        transformOrigin: "top center",
        opacity: 0,
        duration: 0.5,
        ease: "power2.out",
        delay: 0.1,
        clearProps: "transform,opacity",
      });
    }
  }, []);

  return (
    <RiseInGroup runKey={view} className={className} selector={null} onAnimate={onAnimate}>
      {children}
    </RiseInGroup>
  );
}
