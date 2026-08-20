"use client";

import { useCallback } from "react";

import { RiseInGroup } from "@/components/motion/rise-in-group";
import { MOTION_EASE, getMotionDurations, type Gsap } from "@/components/motion/motion-tokens";

/**
 * The DSR request-detail motion wrapper: the shared rise-in stagger, plus a
 * count-up on the outcome record's tallies.
 *
 * ⚠ WHY THIS IS A SEPARATE CLIENT COMPONENT. `DsrOutcomeRecord` is a Server
 * Component on purpose — a legal record should render without JavaScript. GSAP
 * needs a client boundary, and `RiseInGroup.onAnimate` needs a `useCallback`-stable
 * reference, so the motion lives here and the record passes through as `children`
 * (server → client composition via the children prop, which keeps the record
 * server-rendered).
 *
 * ⛔ THE COUNT-UP ANIMATES ONLY `aria-hidden` NODES. `DsrOutcomeRecord.Tally`
 * renders the visible numeral `aria-hidden` with `data-countup`, and the true
 * value in an `sr-only` sibling that nothing here touches. These are the
 * mechanical/attested tallies of a legal record: a screen reader announcing an
 * intermediate "2" while the true figure is 7 would be a false statement in the
 * one artifact that must not make them.
 *
 * Decorative and best-effort in every other respect, per the shared motion
 * contract: `RiseInGroup` bails entirely under `prefers-reduced-motion` (leaving
 * the server-rendered numbers untouched and correct), GSAP is a dynamic import off
 * the critical path, and any failure is swallowed — the record is fully readable
 * and the page fully usable if none of this runs.
 */
export function DsrRecordMotion({
  runKey,
  className,
  children,
}: {
  runKey?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const animateTallies = useCallback((gsap: Gsap, root: HTMLElement) => {
    const targets = root.querySelectorAll<HTMLElement>("[data-countup]");
    if (!targets.length) return;
    const { durSlow } = getMotionDurations();

    targets.forEach((el) => {
      const final = Number(el.dataset.countup);
      // A non-numeric or zero target has nothing to count toward; leaving the
      // server-rendered text alone is the correct no-op.
      if (!Number.isFinite(final) || final <= 0) return;

      const counter = { value: 0 };
      gsap.to(counter, {
        value: final,
        duration: durSlow,
        ease: MOTION_EASE.outSoft,
        onUpdate: () => {
          // Safe to write: this node is `aria-hidden`, so no assistive tech reads
          // the intermediate value.
          el.textContent = String(Math.round(counter.value));
        },
        // Pin the exact final value — rounding mid-tween must never be the last
        // thing written to a legal tally.
        onComplete: () => {
          el.textContent = String(final);
        },
      });
    });
  }, []);

  return (
    <RiseInGroup runKey={runKey} className={className} onAnimate={animateTallies}>
      {children}
    </RiseInGroup>
  );
}
