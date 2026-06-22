/**
 * Shared display helpers for the QPS cross-committee patient view (Phase 23 —
 * `patient_index`; ADR 0039). Pure + client/server-safe: only string formatting
 * and design-token-name lookups (no data access — Rule 9). All user-facing text
 * is pt-BR (Rule 10); storage slugs map to labels via the frozen `*_LABELS` maps
 * in the client-safe contract (`@/lib/patient-index/types`).
 *
 * Mirrors the Phase-22 referrals convention (`src/components/referrals/format.ts`)
 * and the Phase-14 safety convention — the codebase styles chips with inline
 * token-resolved classes rather than a `Badge` primitive, keeping the "Clinical
 * Calm" palette centralized.
 *
 * PHI-FREE by construction: nothing here ever touches a patient identifier — the
 * whole module is codes / commission names / dates / booleans (ADR 0039).
 */

/** Format an ISO timestamp as a pt-BR short date (date only). `null` → "—". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Format an ISO timestamp as a pt-BR date + time ("22/06/2026, 14:30"). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Resolve a module's design-token NAME (from
 * {@link import('@/lib/patient-index/types').PATIENT_XREF_MODULE_TOKENS}) into the
 * concrete soft-chip classes for the trajectory module pill. Quiet metadata pills
 * (not state) — mirrors `referralTypeChipClass`. The token name, not a raw colour,
 * lives in the contract so the palette stays centralized here.
 */
export function patientModuleChipClass(token: string | null | undefined): string {
  switch (token) {
    case "info":
      return "bg-primary/8 text-primary/90 border-primary/20";
    case "accent":
      return "bg-accent/60 text-accent-foreground border-primary/20";
    case "warning":
      return "bg-warning/10 text-warning border-warning/25";
    case "success":
      return "bg-success/10 text-success border-success/25";
    case "destructive":
      return "bg-destructive/8 text-destructive border-destructive/25";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

/** Base classes for an icon-free metadata pill (module chip, match-basis chip). */
export const PATIENT_META_CHIP_BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";
