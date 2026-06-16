/**
 * Case Timeline — URL search-param codec (Phase 12, F2).
 *
 * Pure, dependency-free encode/decode for the three shareable timeline params —
 * `view`, `density`, `types` — used by BOTH the server page (reads the initial
 * state from `searchParams`) and the client shell (writes the state back via
 * `router.replace`). Keeping the codec in one place guarantees the server's
 * first render and the client's hydration agree, so there is no flash.
 *
 * Encoding choices:
 *   - `view`    → "feed" | "gantt"; anything else (incl. absent) → the default "feed".
 *   - `density` → "comfortable" | "compact"; default "comfortable".
 *   - `types`   → a comma-separated subset of the 8 type slugs. ABSENT means "all
 *                 visible" (the clean default — a fully-on filter never bloats the
 *                 URL). Only a genuine subset is serialized; an all-on set clears
 *                 the param. Unknown slugs are ignored; an empty/garbage value
 *                 falls back to "all".
 */

import type { TimelineEventType } from "@/lib/timeline/event-model";

import type { TimelineDensity } from "./timeline-density-switch";
import type { TimelineView } from "./timeline-view-switch";
import { TYPE_ORDER } from "./type-meta";

/** A single search-param value as Next's `searchParams` delivers it. */
export type ParamValue = string | string[] | undefined;

function first(value: ParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseView(value: ParamValue): TimelineView {
  return first(value) === "gantt" ? "gantt" : "feed";
}

export function parseDensity(value: ParamValue): TimelineDensity {
  return first(value) === "compact" ? "compact" : "comfortable";
}

const ALL_TYPES = new Set<TimelineEventType>(TYPE_ORDER);

/**
 * Decode the `types` param into the visible-type set. Absent / empty / all-on →
 * the full set ("all visible"). A valid subset → exactly those known slugs (an
 * empty result after filtering also falls back to all, so the timeline never
 * starts blank).
 */
export function parseTypes(value: ParamValue): Set<TimelineEventType> {
  const raw = first(value);
  if (!raw) return new Set(ALL_TYPES);
  const wanted = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is TimelineEventType => ALL_TYPES.has(s as TimelineEventType));
  if (wanted.length === 0) return new Set(ALL_TYPES);
  return new Set(wanted);
}

/**
 * Serialize the current state into a query string (no leading `?`), in a stable
 * order. `view`/`density` are written only when non-default; `types` only when a
 * genuine subset — so the default state yields an EMPTY string (a clean URL).
 */
export function buildQuery(state: {
  view: TimelineView;
  density: TimelineDensity;
  types: Set<TimelineEventType>;
}): string {
  const params = new URLSearchParams();
  if (state.view !== "feed") params.set("view", state.view);
  if (state.density !== "comfortable") params.set("density", state.density);
  // Only encode a real subset; an all-on filter clears the param.
  if (state.types.size > 0 && state.types.size < ALL_TYPES.size) {
    const ordered = TYPE_ORDER.filter((t) => state.types.has(t));
    params.set("types", ordered.join(","));
  }
  return params.toString();
}
