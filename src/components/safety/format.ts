/**
 * Shared display helpers for the patient-safety / NSP UI (Phase 14a). Pure +
 * client/server-safe: only string formatting and token-name lookups (no data
 * access — that goes through `@/lib/queries/safety-events`, Rule 9). All
 * user-facing text is pt-BR (Rule 10); the storage slugs map to labels via the
 * frozen `*_LABELS` maps in the query module.
 */

import type {
  EventStatus,
  SuspectedHarmLevel,
} from "@/lib/safety/types";

/** "EV-0001" is already minted server-side; this just guards the empty case. */
export function formatEventCode(code: string | null | undefined): string {
  return code?.trim() || "Evento";
}

/** Format an ISO timestamp as a pt-BR short date (date only). */
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

/** Format an ISO timestamp as a pt-BR date + time ("18/06/2026, 14:30"). */
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
 * Semantic token classes for an event-status chip (icon + text + shape, never
 * colour alone — design system §2 accessibility). Reuses the existing status
 * tokens: `reported` = caution (awaiting receipt), `acknowledged` = primary
 * accent (active NSP work), `triaged` = info, `closed` = success, `cancelled` =
 * muted.
 */
export function eventStatusChipClass(status: EventStatus): string {
  switch (status) {
    case "reported":
      return "bg-warning/12 text-warning border-warning/30";
    case "acknowledged":
      return "bg-accent text-accent-foreground border-primary/30";
    case "triaged":
      return "bg-primary/10 text-primary border-primary/30";
    case "closed":
      return "bg-success/12 text-success border-success/30";
    case "cancelled":
      return "bg-muted text-muted-foreground border-border";
  }
}

/**
 * Severity tone for the suspected-harm chip. Climbs from neutral (`none`/
 * `unknown`) through caution to destructive (`severe`/`death`) so a scanning
 * chair reads urgency at a glance — paired with the pt-BR label, never colour
 * alone.
 */
export function suspectedHarmChipClass(level: SuspectedHarmLevel): string {
  switch (level) {
    case "none":
      return "bg-muted text-muted-foreground border-border";
    case "mild":
      return "bg-warning/10 text-warning border-warning/25";
    case "moderate":
      return "bg-warning/14 text-warning border-warning/35";
    case "severe":
    case "death":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "unknown":
      return "bg-muted text-muted-foreground border-border";
  }
}
