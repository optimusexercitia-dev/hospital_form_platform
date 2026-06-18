/**
 * Visual-token mapping for the triage workstation (Phase 14b). PURE +
 * client-safe: maps each spec visual ROLE (README_triage §2) to an EXISTING
 * project token — no hard-coded colors/radii/fonts. The reach spectrum and harm
 * scale must read as ordered green→red ramps; we build those from the semantic
 * status tokens (`success` → `primary` → `warning` → `destructive`).
 *
 * Status is always conveyed by icon + text + shape too (design system §2) — these
 * classes are the colour layer, never the sole signal.
 */

import type { HarmSeverity, TriageReach } from "@/lib/safety/triage-types";

/** Selected-stop classes for the reach spectrum (the escalation ramp). */
export const REACH_TONE: Record<
  TriageReach,
  { bar: string; selected: string; chip: string }
> = {
  // level 0 — neutral / slate
  unsafe: {
    bar: "bg-muted-foreground/60",
    selected: "border-border bg-muted/60",
    chip: "border-border bg-muted text-muted-foreground",
  },
  // level 1 — success / green (caught before reaching the patient)
  near_miss: {
    bar: "bg-success",
    selected: "border-success/40 bg-success/10",
    chip: "border-success/30 bg-success/12 text-success",
  },
  // level 2 — info / blue (reached, no harm) → the platform's blue accent
  no_harm: {
    bar: "bg-primary",
    selected: "border-primary/40 bg-primary/10",
    chip: "border-primary/30 bg-primary/10 text-primary",
  },
  // level 3 — warning / orange (adverse)
  adverse: {
    bar: "bg-warning",
    selected: "border-warning/40 bg-warning/10",
    chip: "border-warning/35 bg-warning/14 text-warning",
  },
  // level 4 — danger / red (sentinel)
  sentinel: {
    bar: "bg-destructive",
    selected: "border-destructive/40 bg-destructive/10",
    chip: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

/** Selected-tile classes for the harm scale (none→death, growing severity). */
export const HARM_TONE: Record<
  HarmSeverity,
  { bar: string; selected: string; chip: string }
> = {
  none: {
    bar: "bg-success",
    selected: "border-success/40 bg-success/10",
    chip: "border-success/30 bg-success/12 text-success",
  },
  mild: {
    bar: "bg-warning/70",
    selected: "border-warning/35 bg-warning/8",
    chip: "border-warning/25 bg-warning/10 text-warning",
  },
  moderate: {
    bar: "bg-warning/85",
    selected: "border-warning/40 bg-warning/10",
    chip: "border-warning/30 bg-warning/12 text-warning",
  },
  severe: {
    bar: "bg-warning",
    selected: "border-warning/45 bg-warning/12",
    chip: "border-warning/40 bg-warning/16 text-warning",
  },
  permanent: {
    bar: "bg-destructive/80",
    selected: "border-destructive/35 bg-destructive/8",
    chip: "border-destructive/25 bg-destructive/8 text-destructive",
  },
  death: {
    bar: "bg-destructive",
    selected: "border-destructive/45 bg-destructive/12",
    chip: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

/**
 * A deterministic categorical chip class for a reporting-committee SOURCE chip,
 * keyed off the commission id so the same committee always reads the same hue
 * (README_triage §1.6 maps 6 fixed sources; here sources are real commissions, so
 * we hash onto the existing chart ramp instead). Paired with the committee name —
 * never colour alone.
 */
const SOURCE_TONES = [
  "border-[var(--chart-1)]/30 bg-[var(--chart-1)]/12 text-foreground",
  "border-[var(--chart-2)]/30 bg-[var(--chart-2)]/12 text-foreground",
  "border-[var(--chart-3)]/30 bg-[var(--chart-3)]/12 text-foreground",
  "border-[var(--chart-4)]/30 bg-[var(--chart-4)]/12 text-foreground",
  "border-[var(--chart-5)]/30 bg-[var(--chart-5)]/12 text-foreground",
];

export function sourceChipClass(commissionId: string | null | undefined): string {
  if (!commissionId) return "border-border bg-muted text-muted-foreground";
  let hash = 0;
  for (let i = 0; i < commissionId.length; i++) {
    hash = (hash * 31 + commissionId.charCodeAt(i)) >>> 0;
  }
  return SOURCE_TONES[hash % SOURCE_TONES.length];
}

/** Priority dot tone from the reporter's suspected harm (queue scan signal). */
export function priorityDotClass(
  level: "high" | "medium" | "low",
): string {
  switch (level) {
    case "high":
      return "bg-destructive";
    case "medium":
      return "bg-warning";
    case "low":
      return "bg-muted-foreground/50";
  }
}
