"use client";

import { useEffect, useRef } from "react";

/**
 * Best-effort entrance choreography for the case-detail layout. Renders a plain
 * container and, on mount, staggers its [data-rise] blocks in (fade + 12px rise)
 * via a dynamically-imported GSAP timeline. Decorative only: uses gsap.from so the
 * natural (visible) state is the no-JS baseline, bails under reduced-motion, and
 * never blocks content. Mirrors the design tokens (--dur-base 320ms, ease-out-soft)
 * — see frontend-design §5.
 */
export function CaseDetailMotion({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const blocks = root.querySelectorAll<HTMLElement>("[data-rise]");
    if (blocks.length === 0) return;

    let cancelled = false;
    let ctx: { revert: () => void } | undefined;
    (async () => {
      try {
        const { gsap } = await import("gsap");
        if (cancelled) return;
        ctx = gsap.context(() => {
          gsap.from(blocks, {
            opacity: 0,
            y: 12,
            duration: 0.32, // ≈ --dur-base (320ms)
            ease: "power3.out", // ≈ --ease-out-soft
            stagger: 0.06, // 60ms, matches the --rise-delay convention
            clearProps: "opacity,transform",
          });
        }, root);
      } catch {
        // best-effort; ignore load/animation failure
      }
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
