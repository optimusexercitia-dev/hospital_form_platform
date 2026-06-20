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
 * pt-BR labels for the raw entity status slugs that carry their OWN lifecycle
 * state. An entity that tracks its own status (interview, meeting, action item,
 * patient-safety event, plus the phase `nao_necessaria`/cancelled markers) must
 * show THAT status verbatim — mirroring its Detalhes view — never the calendar
 * `statusOf` derivation: a `concluida`/`agendada` interview anchored on today
 * would otherwise fall through to the temporal `active` pill and read
 * "Em andamento", contradicting the record (the bug this map closes). The
 * derived done/active/upcoming pill remains the fallback only for types with no
 * status of their own (lifecycle, document, milestone, note) and for a phase's
 * temporal `ativa`/`concluida` bar. Slugs are unique across these entities (or
 * share an identical label), so a flat map is unambiguous. Styling reuses the
 * same semantic tokens as each entity's own badge (interview-/meeting-/
 * case-extras-labels, safety `EVENT_STATUS_LABELS`) so the feed agrees with the
 * detail screens.
 */
const ACTIVE_PILL = "bg-accent text-accent-foreground";
const DONE_PILL = "bg-success/12 text-success dark:bg-success/15";
const SCHEDULED_PILL = "bg-secondary text-secondary-foreground";
const MUTED_PILL = "bg-muted text-muted-foreground";
const WARNING_PILL = "bg-warning/15 text-warning";
const CANCELLED_PILL =
  "bg-muted/70 text-muted-foreground line-through decoration-1";

const SLUG_OVERRIDE: Record<string, PillSpec> = {
  // Cancelled / not-needed markers (shared across interviews, meetings, actions,
  // safety events, phases — all read as muted, struck-through where terminal).
  cancelada: { label: "Cancelada", className: CANCELLED_PILL, dot: false },
  cancelado: { label: "Cancelado", className: CANCELLED_PILL, dot: false },
  cancelled: { label: "Cancelado", className: CANCELLED_PILL, dot: false },
  nao_necessaria: {
    label: "Não necessária",
    className: "bg-muted/60 text-muted-foreground/80",
    dot: false,
  },

  // Interview lifecycle (em_andamento/concluida shared with action/phase labels).
  rascunho: { label: "Rascunho", className: MUTED_PILL, dot: false },
  agendada: { label: "Agendada", className: SCHEDULED_PILL, dot: false },
  em_andamento: { label: "Em andamento", className: ACTIVE_PILL, dot: true },
  concluida: { label: "Concluída", className: DONE_PILL, dot: false },

  // Meeting lifecycle.
  realizada: { label: "Realizada", className: ACTIVE_PILL, dot: false },
  em_assinatura: { label: "Em assinatura", className: WARNING_PILL, dot: false },
  assinada: { label: "Assinada", className: DONE_PILL, dot: false },
  distribuida: { label: "Distribuída", className: "bg-primary/12 text-primary", dot: false },

  // Action-item lifecycle (open/in_progress/done; cancelled handled above).
  open: { label: "Aberto", className: MUTED_PILL, dot: false },
  in_progress: { label: "Em andamento", className: ACTIVE_PILL, dot: true },
  done: { label: "Concluído", className: DONE_PILL, dot: false },

  // Patient-safety event lifecycle (reported→…→closed; cancelled handled above).
  reported: { label: "Notificado", className: SCHEDULED_PILL, dot: false },
  acknowledged: { label: "Reconhecido", className: SCHEDULED_PILL, dot: false },
  triaged: { label: "Triado", className: WARNING_PILL, dot: false },
  closed: { label: "Encerrado", className: DONE_PILL, dot: false },
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
