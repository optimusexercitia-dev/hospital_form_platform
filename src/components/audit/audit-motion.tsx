"use client";

import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/components/dashboard/use-reduced-motion";

/**
 * Best-effort rise-in choreography for the audit feed. Mirrors
 * `timeline-motion.tsx`: renders a plain wrapper and, on mount (and whenever
 * `runKey` changes — a page/filter change re-runs the entrance), staggers its
 * `[data-rise]` rows in via a dynamically-imported GSAP timeline.
 *
 * Decorative ONLY — the natural (visible) state is the no-JS baseline, it bails
 * under reduced-motion, GSAP is a dynamic import off the critical path, and a
 * load/animation failure can NEVER block render (the feed is fully usable
 * without it). The reduced-motion fallback (`.animate-rise-in` collapsed by the
 * global media query) keeps a graceful entrance for users who keep motion on.
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
          if (rows && rows.length) {
            gsap.from(Array.from(rows), {
              opacity: 0,
              y: 10,
              duration: 0.32, // ≈ --dur-base
              ease: "power3.out", // ≈ --ease-out-soft
              stagger: 0.04,
              clearProps: "opacity,transform",
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
  }, [runKey, reduced]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
