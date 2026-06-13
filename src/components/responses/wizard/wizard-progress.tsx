"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Wizard progress indicator over the VISIBLE sections only (F2). Recomputes
 * from the live step list, so a section hidden by a conditional answer drops
 * out of the count immediately. The bar width is GSAP-tweened when the step
 * changes; under `prefers-reduced-motion` (or if GSAP fails to load) it snaps —
 * motion is strictly decorative and never gates correctness.
 *
 * `stepCount` = number of visible sections. The review screen is step
 * `stepCount + 1`; when `isReview`, the bar reads full.
 */
export function WizardProgress({
  currentStepIndex,
  stepCount,
  isReview,
}: {
  currentStepIndex: number;
  stepCount: number;
  isReview: boolean;
}) {
  const barRef = useRef<HTMLDivElement | null>(null);
  // total steps including the review screen
  const totalSteps = stepCount + 1;
  const currentStep = isReview ? totalSteps : currentStepIndex + 1;
  const ratio = totalSteps > 0 ? currentStep / totalSteps : 0;
  const pct = Math.round(ratio * 100);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const target = `${pct}%`;

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      el.style.width = target;
      return;
    }

    let cancelled = false;
    void import("gsap")
      .then((mod) => {
        if (cancelled || !el) return;
        const gsap = mod.gsap ?? mod.default;
        gsap?.to(el, {
          width: target,
          duration: 0.45,
          ease: "power2.out",
        });
      })
      .catch(() => {
        if (el) el.style.width = target;
      });

    return () => {
      cancelled = true;
    };
  }, [pct]);

  const label = isReview
    ? "Revisão"
    : `Seção ${Math.min(currentStep, stepCount)} de ${stepCount}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <span aria-hidden="true">{pct}%</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-valuenow={currentStep}
        aria-label={`Progresso do preenchimento: ${label}`}
      >
        <div
          ref={barRef}
          className={cn("h-full rounded-full bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
