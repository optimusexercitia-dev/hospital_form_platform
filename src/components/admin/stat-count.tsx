"use client";

import { useEffect, useState } from "react";

/**
 * A number that counts up from 0 to `value` once when it mounts — a small,
 * purely decorative flourish for the commission stat figures (member counts).
 *
 * Constraints (mirrors the auth-hero motion policy):
 *  - GSAP drives the tween, dynamically imported so it never sits on the
 *    critical path; if the import fails we simply show the final value.
 *  - `prefers-reduced-motion`: render the final value immediately, start no
 *    tween.
 *  - The animation is decorative only; the final value is always the real one.
 *
 * The displayed number is `animated ?? value`: it falls back to the true
 * `value` for SSR, the no-JS path, reduced motion, and an import failure, and is
 * only ever set from GSAP's tween callbacks (an external system) — so no
 * setState fires synchronously inside the effect body.
 */
export function StatCount({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const [animated, setAnimated] = useState<number | null>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // Nothing to animate — render the true value via the `?? value` fallback.
    if (reduceMotion || value <= 0) return;

    let cancelled = false;
    const counter = { n: 0 }; // GSAP mutates this; we read .n on each tick.
    type GsapTween = { kill: () => void };
    let tween: GsapTween | null = null;

    import("gsap")
      .then(({ gsap }) => {
        if (cancelled) return;
        tween = gsap.to(counter, {
          n: value,
          duration: Math.min(0.4 + value * 0.04, 1.1),
          ease: "power2.out",
          onUpdate: () => setAnimated(Math.round(counter.n)),
          onComplete: () => setAnimated(value),
        }) as unknown as GsapTween;
      })
      .catch(() => {
        // Import failed — the `?? value` fallback already shows the real value.
      });

    return () => {
      cancelled = true;
      if (tween) tween.kill();
    };
  }, [value]);

  return <span className={className}>{animated ?? value}</span>;
}
