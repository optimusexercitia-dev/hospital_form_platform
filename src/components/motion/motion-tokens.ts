"use client";

/**
 * Shared GSAP-facing motion tokens (frontend audit #5). The design system
 * (`globals.css` §5, "Motion system") defines the canonical
 * `--dur-fast` / `--dur-base` / `--dur-slow` durations and
 * `--ease-out-soft` / `--ease-in-out-soft` easings, consumed by CSS keyframes
 * directly. GSAP timelines can't consume a CSS custom property, and can't
 * consume an arbitrary `cubic-bezier()` string without the (unlicensed)
 * CustomEase plugin — so durations are read from the live CSS custom
 * properties (single source of truth, no drift), and easings are named GSAP
 * built-ins chosen to approximate the CSS cubic-bezier tokens, defined once
 * here instead of re-approximated per file.
 */

const FALLBACK_MS = {
  durFast: 180,
  durBase: 320,
  durSlow: 560,
} as const;

function readDurationMs(varName: string, fallbackMs: number): number {
  if (typeof window === "undefined") return fallbackMs;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const match = /^([\d.]+)(ms|s)?$/.exec(raw);
  if (!match) return fallbackMs;
  const value = parseFloat(match[1]);
  if (Number.isNaN(value)) return fallbackMs;
  return match[2] === "s" ? value * 1000 : value;
}

let cachedDurations: { durFast: number; durBase: number; durSlow: number } | null = null;

/**
 * The `--dur-*` tokens in GSAP's unit (seconds), read from the live CSS custom
 * properties once and cached — a design-system duration tweak in `globals.css`
 * flows through automatically instead of drifting from a hand-copied number.
 */
export function getMotionDurations(): { durFast: number; durBase: number; durSlow: number } {
  if (!cachedDurations) {
    cachedDurations = {
      durFast: readDurationMs("--dur-fast", FALLBACK_MS.durFast) / 1000,
      durBase: readDurationMs("--dur-base", FALLBACK_MS.durBase) / 1000,
      durSlow: readDurationMs("--dur-slow", FALLBACK_MS.durSlow) / 1000,
    };
  }
  return cachedDurations;
}

/** GSAP-named easings approximating the CSS cubic-bezier tokens (globals.css §5). */
export const MOTION_EASE = {
  /** ≈ `--ease-out-soft` (`cubic-bezier(0.22, 1, 0.36, 1)`) */
  outSoft: "power3.out",
  /** ≈ `--ease-in-out-soft` (`cubic-bezier(0.65, 0, 0.35, 1)`) */
  inOutSoft: "power2.inOut",
} as const;

/** The `gsap` export's type, for callers that layer extra animation on a `RiseInGroup` (avoids a value-import of the package just for typing). */
export type Gsap = typeof import("gsap").gsap;
