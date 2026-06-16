/**
 * Case Timeline — shared pt-BR display helpers (Phase 12).
 *
 * Small presentational helpers used by both layouts, the Sheet and the legend so
 * date/range/status text reads identically everywhere. Pure + client-safe (no
 * server imports). Dates are ISO `YYYY-MM-DD`; parsed as LOCAL dates (never
 * `new Date(iso)`, which is UTC midnight and shifts a day in BR) — mirrors the
 * cases `formatDueDate` lesson.
 */

import type {
  CaseTimelineEvent,
  TimelineStatus,
} from "@/lib/timeline/event-model";

/** Parse an ISO `YYYY-MM-DD` (taking the date part) as a LOCAL Date, or null. */
function parseLocal(iso: string): Date | null {
  const [y, m, d] = iso.slice(0, 10).split("-").map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

const DAY_MONTH = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

const FULL = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

/** "16 de jun." — short day + month, the meta-row date. */
export function formatShort(iso: string): string {
  const date = parseLocal(iso);
  if (!date) return iso;
  return DAY_MONTH.format(date).replace(/\.$/, ".");
}

/** "16 de junho de 2026" — the long form for the today divider + the Sheet. */
export function formatFull(iso: string): string {
  const date = parseLocal(iso);
  if (!date) return iso;
  return FULL.format(date);
}

/**
 * The meta-row date text for an event: a single short date for single-day
 * events; a "16 de jun. – 20 de jun." range for phases (an active phase whose
 * `end` is null shows "16 de jun. – em andamento").
 */
export function formatEventDate(event: CaseTimelineEvent): string {
  if (event.day != null) return formatShort(event.day);
  const start = event.start ? formatShort(event.start) : "";
  if (event.end == null) return `${start} – em andamento`;
  return `${start} – ${formatShort(event.end)}`;
}

/** "· 7 dias" duration suffix for phases (Feed text only); "" for single-day. */
export function durationSuffix(days: number, isPhase: boolean): string {
  if (!isPhase) return "";
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

// ---------------------------------------------------------------------------
// Status pill — derived state (done/active/upcoming) + the entity status slug
// ---------------------------------------------------------------------------

export interface PillSpec {
  label: string;
  /** Tailwind classes resolving to existing semantic tokens (no raw colour). */
  className: string;
  /** Whether to render the small leading dot (active state). */
  dot: boolean;
}

const DERIVED_PILL: Record<TimelineStatus, PillSpec> = {
  done: {
    label: "Concluído",
    className: "bg-success/12 text-success dark:bg-success/15",
    dot: false,
  },
  active: {
    label: "Em andamento",
    className: "bg-accent text-accent-foreground",
    dot: true,
  },
  upcoming: {
    label: "Previsto",
    className: "bg-muted text-muted-foreground",
    dot: false,
  },
};

/**
 * pt-BR labels for the raw entity status slugs that carry their own state
 * (interview `cancelada`, meeting `realizada`/`cancelada`, action `done`, phase
 * `nao_necessaria`, …). Falls back to the derived status pill when a slug has no
 * explicit override.
 */
const SLUG_OVERRIDE: Record<string, PillSpec> = {
  cancelada: {
    label: "Cancelada",
    className: "bg-muted/70 text-muted-foreground line-through decoration-1",
    dot: false,
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-muted/70 text-muted-foreground line-through decoration-1",
    dot: false,
  },
  nao_necessaria: {
    label: "Não necessária",
    className: "bg-muted/60 text-muted-foreground/80",
    dot: false,
  },
};

/**
 * Resolve the status pill for an event: a muted "cancelada"/"não necessária"
 * override when the entity status says so, otherwise the derived
 * done/active/upcoming pill. The pill conveys state by TEXT + SHAPE (+ a dot for
 * active), never colour alone (a11y).
 */
export function pillFor(
  event: CaseTimelineEvent,
  status: TimelineStatus,
): PillSpec {
  if (event.statusSlug && SLUG_OVERRIDE[event.statusSlug]) {
    return SLUG_OVERRIDE[event.statusSlug];
  }
  return DERIVED_PILL[status];
}
