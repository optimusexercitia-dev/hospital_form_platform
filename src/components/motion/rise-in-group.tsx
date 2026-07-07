"use client";

import { useEffect, useRef } from "react";

import { getMotionDurations, MOTION_EASE, type Gsap } from "@/components/motion/motion-tokens";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";

export interface RiseInGroupProps {
  /** Bumping this re-runs the entrance (e.g. the current page/filter/view). */
  runKey?: string | number;
  className?: string;
  children: React.ReactNode;
  /**
   * Selector for the built-in rise animation (fade + `y`-rise, staggered).
   * Pass `null` to skip the built-in animation entirely and drive everything
   * via `onAnimate` (e.g. `TimelineMotion`'s bespoke rise+bars+marker sequence).
   * @default "[data-rise]"
   */
  selector?: string | null;
  /** Stagger (seconds) between each matched element's start. @default 0.04 */
  stagger?: number;
  /** Vertical rise distance (px). @default 10 */
  y?: number;
  /**
   * Escape hatch for callers that layer extra GSAP animation onto the same
   * mount/reduced-motion/dynamic-import/cleanup lifecycle (e.g. `TimelineMotion`'s
   * phase bars and marker). Runs inside the same `gsap.context`, after the
   * built-in rise animation (if any). Failures are swallowed like the rise
   * animation — this is decorative, best-effort motion only.
   */
  onAnimate?: (gsap: Gsap, root: HTMLElement) => void;
}

/**
 * Best-effort rise-in choreography, shared by the audit feed, patient-safety
 * surfaces, case-detail layout, and timeline (frontend audit #5 — these were
 * four near-identical copies). Renders a plain wrapper and, on mount (and
 * whenever `runKey` changes), staggers the `selector`-matched children in via
 * a dynamically-imported GSAP timeline, reading duration/easing from the
 * shared motion tokens (`motion-tokens.ts`) instead of hand-approximated
 * magic numbers.
 *
 * Decorative ONLY — the natural (visible) state is the no-JS baseline (paired
 * with `.animate-rise-in` for the CSS-only fallback), it bails under
 * reduced-motion, GSAP is a dynamic import off the critical path, and a
 * load/animation failure can NEVER block render (content is fully usable
 * without it).
 */
export function RiseInGroup({
  runKey,
  className,
  children,
  selector = "[data-rise]",
  stagger = 0.04,
  y = 10,
  onAnimate,
}: RiseInGroupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (reduced) return;

    let cancelled = false;
    let ctx: { revert: () => void } | undefined;

    (async () => {
      try {
        const { gsap } = await import("gsap");
        if (cancelled || !ref.current) return;
        const { durBase } = getMotionDurations();
        ctx = gsap.context(() => {
          if (selector) {
            const targets = ref.current?.querySelectorAll<HTMLElement>(selector);
            if (targets && targets.length) {
              gsap.from(Array.from(targets), {
                opacity: 0,
                y,
                duration: durBase,
                ease: MOTION_EASE.outSoft,
                stagger,
                clearProps: "opacity,transform",
              });
            }
          }
          if (ref.current) onAnimate?.(gsap, ref.current);
        }, root);
      } catch {
        // best-effort; ignore load/animation failure
      }
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
    // `onAnimate` callers pass a `useCallback`-stable reference; selector/stagger/y
    // are effectively static per-instance constants.
  }, [runKey, reduced, selector, stagger, y, onAnimate]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
