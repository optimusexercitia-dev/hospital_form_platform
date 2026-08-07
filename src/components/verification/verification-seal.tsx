"use client";

import { useEffect, useRef } from "react";

import {
  getMotionDurations,
  MOTION_EASE,
} from "@/components/motion/motion-tokens";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";
import { cn } from "@/lib/utils";

/** Visual tone of the verification answer. Never the only carrier of meaning —
 * the heading text and the icon say the same thing (design system §6). */
export type SealTone = "success" | "warning" | "danger" | "neutral";

const TONE_STYLES: Record<SealTone, { ring: string; face: string }> = {
  success: { ring: "text-success", face: "bg-success/12 text-success" },
  warning: { ring: "text-warning", face: "bg-warning/12 text-warning" },
  danger: {
    ring: "text-destructive",
    face: "bg-destructive/10 text-destructive",
  },
  neutral: {
    ring: "text-muted-foreground",
    face: "bg-muted text-muted-foreground",
  },
};

/** Radius of the ring in the 72×72 viewBox, and its circumference — the dash
 * length GSAP animates to "draw" the seal. */
const RING_RADIUS = 33;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * The verification answer's seal: a status icon inside a ring that draws itself
 * once on arrival (PDF·P1 / ADR 0104 D10).
 *
 * The motion earns its place here rather than decorating: this page's entire
 * job is to deliver one verdict to someone holding paper, and the ring closing
 * around the mark is the verdict landing. It is also the module's whole
 * micro-animation budget on the public surface — deliberately one gesture, not
 * a sequence, because the audience may be reading it in a corridor.
 *
 * Strictly best-effort, per the design system §5:
 * - the seal renders COMPLETE without JavaScript (GSAP only animates `from`, so
 *   a visitor with JS disabled — plausible on this surface — sees the final
 *   state, not a blank circle);
 * - it no-ops under `prefers-reduced-motion`;
 * - GSAP is a dynamic import off the critical path and every failure is
 *   swallowed. A motion failure can never withhold the verdict.
 */
export function VerificationSeal({
  tone,
  children,
}: {
  tone: SealTone;
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const styles = TONE_STYLES[tone];

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;

    let cancelled = false;
    let ctx: { revert: () => void } | undefined;

    (async () => {
      try {
        const { gsap } = await import("gsap");
        if (cancelled || !rootRef.current) return;
        const { durBase, durSlow } = getMotionDurations();

        ctx = gsap.context(() => {
          const ring = rootRef.current?.querySelector("[data-seal-ring]");
          const face = rootRef.current?.querySelector("[data-seal-face]");

          if (ring) {
            gsap.fromTo(
              ring,
              {
                strokeDasharray: RING_CIRCUMFERENCE,
                strokeDashoffset: RING_CIRCUMFERENCE,
              },
              {
                strokeDashoffset: 0,
                duration: durSlow,
                ease: MOTION_EASE.outSoft,
                clearProps: "strokeDasharray,strokeDashoffset",
              },
            );
          }

          if (face) {
            gsap.from(face, {
              opacity: 0,
              scale: 0.72,
              duration: durBase,
              ease: MOTION_EASE.outSoft,
              delay: durBase / 2,
              clearProps: "opacity,transform",
            });
          }
        }, root);
      } catch {
        // Decorative only — a GSAP load/animation failure leaves the seal in its
        // natural, fully-visible state.
      }
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [reduced]);

  return (
    <div ref={rootRef} className="relative size-18 shrink-0">
      <svg
        viewBox="0 0 72 72"
        className={cn("absolute inset-0 size-full -rotate-90", styles.ring)}
        aria-hidden="true"
      >
        <circle
          data-seal-ring
          cx="36"
          cy="36"
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="opacity-35"
        />
      </svg>
      <div
        data-seal-face
        className={cn(
          "absolute inset-1.5 flex items-center justify-center rounded-full",
          styles.face,
        )}
      >
        {children}
      </div>
    </div>
  );
}
