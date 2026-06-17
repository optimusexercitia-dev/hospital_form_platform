/**
 * Case Timeline — Duration (Gantt) axis math (Phase 12).
 *
 * Pure, client-safe geometry for the horizontal Duration layout. The README's
 * reference build used day-of-month integers in a single month; this lifts that
 * to real ISO dates with an ADAPTIVE unit (the key adaptation, plan §"View
 * geometry adaptations"): the axis span is derived from the event range, and the
 * column unit is chosen by total span — `day` (with weekend bands) for short
 * cases, `week`, then `month` for long ones — so a long case doesn't scroll
 * forever and a short one isn't a single column.
 *
 * Everything here is timezone-free calendar-day math over `YYYY-MM-DD` strings
 * (UTC epoch days), matching `event-model.ts`. No date library (the repo ships
 * none — confirmed).
 */

import type { CaseTimelineEvent } from "@/lib/timeline/event-model";
import { anchor, endDay } from "@/lib/timeline/event-model";

export type AxisUnit = "day" | "week" | "month";

export interface AxisColumn {
  /** Left offset in px from the grid origin. */
  x: number;
  /** Pixel width of this column. */
  width: number;
  /** Primary cell label (day number, ISO week start day, or month abbrev). */
  label: string;
  /** Secondary label above the primary (weekday letter for `day`, else ""). */
  sub: string;
  /** First calendar day this column covers (ISO `YYYY-MM-DD`). */
  startIso: string;
  /** Whether this column is a weekend day (only meaningful for `day` unit). */
  weekend: boolean;
  /** Whether this column contains the reference (today) day. */
  isToday: boolean;
}

export interface AxisGroup {
  /** Left offset in px. */
  x: number;
  /** Pixel width spanning the group's columns. */
  width: number;
  /** Group label (e.g. "JUNHO 2026"), uppercase. */
  label: string;
}

export interface Axis {
  unit: AxisUnit;
  /** First day shown (ISO), after lead-in padding. */
  startIso: string;
  /** Last day shown (ISO), after lead-out padding. */
  endIso: string;
  /** Total inner grid width in px (columns × column width). */
  width: number;
  /** Column pixel width for the chosen unit. */
  colWidth: number;
  columns: AxisColumn[];
  /** Month-group header cells (row 1). */
  groups: AxisGroup[];
  /** x of the today marker (center of the reference column); null if no reference. */
  todayX: number | null;
  /** x of the terminal closed marker (center of the closed column); null if open/none. */
  closedX: number | null;
  /** Map an ISO day to its left px offset (start of its column). */
  xOf: (iso: string) => number;
  /** Map an ISO day to the CENTER px of its column (for single-day pins). */
  centerOf: (iso: string) => number;
  /** Pixel width a phase bar should span from `start` to `end` (inclusive). */
  spanWidth: (startIso: string, endIso: string) => number;
}

const MS_PER_DAY = 86_400_000;
const COL_DAY = 46;
const COL_WEEK = 30;
const COL_MONTH = 26;
/** Minimum visible day-span so a 1-day case isn't a single column. */
const MIN_SPAN_DAYS = 9;

const MONTHS_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];
const MONTHS_FULL_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAY_PT = ["D", "S", "T", "Q", "Q", "S", "S"]; // Sun..Sat

function epochDay(iso: string): number {
  return Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / MS_PER_DAY);
}
function isoOf(epoch: number): string {
  return new Date(epoch * MS_PER_DAY).toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  return isoOf(epochDay(iso) + n);
}
function dowMon0(iso: string): number {
  // Monday-indexed day-of-week (0 = Mon … 6 = Sun).
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getUTCDay();
  return (d + 6) % 7;
}
function isWeekend(iso: string): boolean {
  return dowMon0(iso) >= 5;
}

/**
 * Build the adaptive axis from the event set + the reference/closed markers.
 * Pads a small lead-in/out and enforces a minimum span; picks the unit by total
 * span; lays out columns + month groups + marker positions.
 */
export function buildAxis(
  events: CaseTimelineEvent[],
  reference: string | null,
  closedAt: string | null,
): Axis {
  // 1. Raw span across all events (+ markers).
  let min = Infinity;
  let max = -Infinity;
  for (const e of events) {
    min = Math.min(min, epochDay(anchor(e)));
    max = Math.max(max, epochDay(endDay(e, reference ?? anchor(e))));
  }
  if (reference) {
    const r = epochDay(reference);
    min = Math.min(min, r);
    max = Math.max(max, r);
  }
  if (closedAt) max = Math.max(max, epochDay(closedAt));
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    const today = epochDay(reference ?? closedAt ?? isoOf(0));
    min = today;
    max = today;
  }

  // 2. Enforce a minimum span, then pad lead-in / lead-out.
  let span = max - min + 1;
  if (span < MIN_SPAN_DAYS) {
    const pad = MIN_SPAN_DAYS - span;
    min -= Math.floor(pad / 2);
    max += Math.ceil(pad / 2);
    span = max - min + 1;
  }
  // Small breathing room either side.
  min -= 1;
  max += 2;

  // 3. Choose unit by span. ≤ ~6 weeks → day; ≤ ~9 months → week; else month.
  span = max - min + 1;
  const unit: AxisUnit =
    span <= 44 ? "day" : span <= 280 ? "week" : "month";

  const startIso = isoOf(min);
  const endIso = isoOf(max);

  if (unit === "day") return buildDayAxis(startIso, endIso, reference, closedAt);
  if (unit === "week") return buildWeekAxis(startIso, endIso, reference, closedAt);
  return buildMonthAxis(startIso, endIso, reference, closedAt);
}

// ---------------------------------------------------------------------------
// Day unit — one column per calendar day, weekend bands, weekday + day-number.
// ---------------------------------------------------------------------------

function buildDayAxis(
  startIso: string,
  endIso: string,
  reference: string | null,
  closedAt: string | null,
): Axis {
  const start = epochDay(startIso);
  const end = epochDay(endIso);
  const n = end - start + 1;
  const colWidth = COL_DAY;
  const refDay = reference ? epochDay(reference) : null;

  const columns: AxisColumn[] = [];
  for (let i = 0; i < n; i++) {
    const iso = isoOf(start + i);
    columns.push({
      x: i * colWidth,
      width: colWidth,
      label: String(Number(iso.slice(8, 10))),
      sub: WEEKDAY_PT[new Date(`${iso}T00:00:00Z`).getUTCDay()],
      startIso: iso,
      weekend: isWeekend(iso),
      isToday: refDay != null && start + i === refDay,
    });
  }

  const xOf = (iso: string) => (epochDay(iso) - start) * colWidth;
  const centerOf = (iso: string) => xOf(iso) + colWidth / 2;

  return finishAxis({
    unit: "day",
    startIso,
    endIso,
    colWidth,
    columns,
    reference,
    closedAt,
    xOf,
    centerOf,
    spanWidth: (a, b) =>
      (epochDay(b) - epochDay(a) + 1) * colWidth,
  });
}

// ---------------------------------------------------------------------------
// Week unit — one column per ISO week (Mon-anchored); label = "dd/mm".
// ---------------------------------------------------------------------------

function buildWeekAxis(
  startIso: string,
  endIso: string,
  reference: string | null,
  closedAt: string | null,
): Axis {
  // Snap start back to its Monday so weeks align.
  const alignedStart = addDays(startIso, -dowMon0(startIso));
  const start = epochDay(alignedStart);
  const end = epochDay(endIso);
  const n = Math.ceil((end - start + 1) / 7);
  const colWidth = COL_WEEK;

  const columns: AxisColumn[] = [];
  for (let i = 0; i < n; i++) {
    const iso = isoOf(start + i * 7);
    columns.push({
      x: i * colWidth,
      width: colWidth,
      label: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
      sub: "",
      startIso: iso,
      weekend: false,
      isToday: false,
    });
  }

  const colIndexOf = (iso: string) =>
    Math.floor((epochDay(iso) - start) / 7);
  const xOf = (iso: string) => colIndexOf(iso) * colWidth;
  const centerOf = (iso: string) => xOf(iso) + colWidth / 2;

  return finishAxis({
    unit: "week",
    startIso: alignedStart,
    endIso,
    colWidth,
    columns,
    reference,
    closedAt,
    xOf,
    centerOf,
    spanWidth: (a, b) => {
      const cols = colIndexOf(b) - colIndexOf(a) + 1;
      return Math.max(1, cols) * colWidth;
    },
  });
}

// ---------------------------------------------------------------------------
// Month unit — one column per month; label = "mês"; group row = year.
// ---------------------------------------------------------------------------

function buildMonthAxis(
  startIso: string,
  endIso: string,
  reference: string | null,
  closedAt: string | null,
): Axis {
  const startY = Number(startIso.slice(0, 4));
  const startM = Number(startIso.slice(5, 7)) - 1;
  const endY = Number(endIso.slice(0, 4));
  const endM = Number(endIso.slice(5, 7)) - 1;
  const n = (endY - startY) * 12 + (endM - startM) + 1;
  const colWidth = COL_MONTH;

  const monthIndex = (iso: string) => {
    const y = Number(iso.slice(0, 4));
    const m = Number(iso.slice(5, 7)) - 1;
    return (y - startY) * 12 + (m - startM);
  };

  const columns: AxisColumn[] = [];
  for (let i = 0; i < n; i++) {
    const m = (startM + i) % 12;
    const y = startY + Math.floor((startM + i) / 12);
    columns.push({
      x: i * colWidth,
      width: colWidth,
      label: MONTHS_PT[m].slice(0, 1).toUpperCase(),
      sub: "",
      startIso: `${y}-${String(m + 1).padStart(2, "0")}-01`,
      weekend: false,
      isToday: false,
    });
  }

  const xOf = (iso: string) => monthIndex(iso) * colWidth;
  const centerOf = (iso: string) => xOf(iso) + colWidth / 2;

  return finishAxis({
    unit: "month",
    startIso,
    endIso,
    colWidth,
    columns,
    reference,
    closedAt,
    xOf,
    centerOf,
    spanWidth: (a, b) =>
      Math.max(1, monthIndex(b) - monthIndex(a) + 1) * colWidth,
  });
}

// ---------------------------------------------------------------------------
// Shared finalization: month-group header + marker positions + total width.
// ---------------------------------------------------------------------------

function finishAxis(args: {
  unit: AxisUnit;
  startIso: string;
  endIso: string;
  colWidth: number;
  columns: AxisColumn[];
  reference: string | null;
  closedAt: string | null;
  xOf: (iso: string) => number;
  centerOf: (iso: string) => number;
  spanWidth: (a: string, b: string) => number;
}): Axis {
  const { columns, colWidth, centerOf } = args;
  const width = columns.length * colWidth;

  // Month-group header row (row 1): one cell per distinct year-month present.
  const groups: AxisGroup[] = [];
  for (const col of columns) {
    const y = Number(col.startIso.slice(0, 4));
    const m = Number(col.startIso.slice(5, 7)) - 1;
    const label =
      args.unit === "month"
        ? String(y)
        : `${MONTHS_FULL_PT[m]} ${y}`;
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.width += colWidth;
    } else {
      groups.push({ x: col.x, width: colWidth, label: label.toUpperCase() });
    }
  }

  const todayX = args.reference ? centerOf(args.reference) : null;
  const closedX =
    args.reference == null && args.closedAt ? centerOf(args.closedAt) : null;

  return {
    unit: args.unit,
    startIso: args.startIso,
    endIso: args.endIso,
    width,
    colWidth,
    columns,
    groups,
    todayX,
    closedX,
    xOf: args.xOf,
    centerOf: args.centerOf,
    spanWidth: args.spanWidth,
  };
}

/** Whether an event's anchor sits in the last `n` columns (right-edge guard). */
export function nearRightEdge(
  axis: Axis,
  iso: string,
  n = 4,
): boolean {
  const threshold = axis.width - n * axis.colWidth;
  return axis.centerOf(iso) >= threshold;
}

/**
 * Stretch a base axis to fill `fitWidth` when the natural grid is NARROWER than
 * its container, so columns fill the available space instead of clumping left
 * with dead space on the right. When the grid is already wider (needs horizontal
 * scroll) the axis is returned unchanged. Pure linear scale: every x/width and
 * the marker/`xOf`/`centerOf`/`spanWidth` closures scale by the same factor, so
 * all geometry (incl. `nearRightEdge`) is preserved.
 */
export function fitAxis(axis: Axis, fitWidth: number): Axis {
  if (!Number.isFinite(fitWidth) || fitWidth <= axis.width) return axis;
  const factor = fitWidth / axis.width;
  return {
    ...axis,
    width: fitWidth,
    colWidth: axis.colWidth * factor,
    columns: axis.columns.map((c) => ({ ...c, x: c.x * factor, width: c.width * factor })),
    groups: axis.groups.map((g) => ({ ...g, x: g.x * factor, width: g.width * factor })),
    todayX: axis.todayX == null ? null : axis.todayX * factor,
    closedX: axis.closedX == null ? null : axis.closedX * factor,
    xOf: (iso) => axis.xOf(iso) * factor,
    centerOf: (iso) => axis.centerOf(iso) * factor,
    spanWidth: (a, b) => axis.spanWidth(a, b) * factor,
  };
}

/**
 * Center x for a title callout of width `maxW`, clamped so a max-width callout
 * never overflows the grid on either edge. The callout is centered on `cx`
 * (the column center / bar midpoint) but pulled inward near the edges so its
 * half-width stays inside `[4, axis.width − 4]`. The visual connector still
 * points at the real `cx`; only the label box shifts. Pure geometry, no DOM.
 */
export function clampCalloutCenter(axis: Axis, cx: number, maxW: number): number {
  const half = maxW / 2;
  const min = half + 4;
  const max = axis.width - half - 4;
  // Degenerate case: callout wider than the grid → center it.
  if (max < min) return axis.width / 2;
  return Math.min(Math.max(cx, min), max);
}
