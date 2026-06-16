"use client";

import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/components/dashboard/use-reduced-motion";

/**
 * Best-effort entrance choreography for a timeline layout. Mirrors
 * `case-detail-motion.tsx`: renders a plain wrapper and, on mount (and on every
 * `view` change — the crossfade between Feed/Duration), staggers its motion
 * targets in via a dynamically-imported GSAP timeline. Decorative ONLY — the
 * natural (visible) state is the no-JS baseline, it bails under reduced-motion,
 * and a load/animation failure never blocks render.
 *
 * Beyond the shared rise-in stagger it adds two timeline-specific touches:
 *   - phase bars (`[data-bar]`) grow from zero width (scaleX 0 → 1, left origin);
 *   - the today/closed marker (`[data-marker]`) draws in (scaleY 0 → 1, top origin).
 * Both are layered after the rise so they read as "the timeline assembling".
 *
 * `view` is part of the key/dep so switching layouts re-runs the entrance, giving
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
        ctx = gsap.context(() => {
          const rows = ref.current?.querySelectorAll<HTMLElement>("[data-rise]");
          const bars = ref.current?.querySelectorAll<HTMLElement>("[data-bar]");
          const pins = ref.current?.querySelectorAll<HTMLElement>("[data-pin]");
          const marker = ref.current?.querySelector<HTMLElement>("[data-marker]");

          // Feed rows + Gantt pins: the shared rise-in stagger.
          const riseTargets = [
            ...(rows ? Array.from(rows) : []),
            ...(pins ? Array.from(pins) : []),
          ];
          if (riseTargets.length) {
            gsap.from(riseTargets, {
              opacity: 0,
              y: 10,
              duration: 0.32, // ≈ --dur-base
              ease: "power3.out", // ≈ --ease-out-soft
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
        }, root);
      } catch {
        // best-effort; ignore load/animation failure
      }
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [view, reduced]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
