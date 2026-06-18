/**
 * Audit-trail — shared pt-BR display helpers (Phase 13).
 *
 * Pure + client-safe (NO server imports — `@/lib/queries/audit` value-imports
 * `@/lib/supabase/server`/`next/headers`, so a client component must never
 * value-import it; the recurring server-in-client-bundle bug). The action/entity
 * LABEL MAPS are passed in as plain props from the Server Component pages (which
 * may value-import them freely) and resolved here with a GRACEFUL FALLBACK so a
 * slug the backend adds additively (e.g. a new `.export` action) never renders
 * blank before its label map ships.
 */

import type { Json } from "@/lib/types/database";

/** A pt-BR label map (action or entity), passed from the server as plain data. */
export type AuditLabelMap = Record<string, string>;

/**
 * Resolve a pt-BR action label from a passed-in map, with a humanized fallback
 * for any unmapped slug (additive backend growth). `'foo.bar_baz'` →
 * `'foo · bar baz'` so an unknown action is still legible rather than blank.
 */
export function actionLabel(action: string, labels: AuditLabelMap): string {
  const mapped = labels[action];
  if (mapped) return mapped;
  return action
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" · ");
}

/** Resolve a pt-BR entity-type label, with a humanized fallback for unmapped slugs. */
export function entityLabel(entity: string, labels: AuditLabelMap): string {
  const mapped = labels[entity];
  if (mapped) return mapped;
  return entity.replace(/_/g, " ");
}

const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const RELATIVE = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/** Absolute timestamp, e.g. "16 de jun. de 2026, 14:32". `''` for an unparseable
 * value (defensive — never throw on bad data). */
export function formatAbsolute(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_TIME.format(date);
}

/**
 * A compact relative timestamp, e.g. "há 3 horas" / "ontem". Computed against
 * `now` (passed in so the value is stable per render and SSR-safe). Falls back to
 * the absolute string for far-past dates (> ~30 days) where "relative" stops
 * helping.
 */
export function formatRelative(iso: string, now: number): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = date.getTime() - now;
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);

  if (absSec < 45) return "agora mesmo";
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return RELATIVE.format(diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return RELATIVE.format(diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) <= 30) return RELATIVE.format(diffDay, "day");
  // Far past — the absolute date reads better than "há 3 meses".
  return formatAbsolute(iso);
}

/** A short, human entity reference: the first 8 chars of a uuid, prefixed `#`.
 * The full id is never user-meaningful; a short ref is enough to correlate. */
export function shortEntityRef(entityId: string): string {
  if (!entityId) return "—";
  const head = entityId.replace(/-/g, "").slice(0, 8);
  return `#${head}`;
}

/** One rendered diff field: the column key plus its before/after display values. */
export interface MetadataDiffField {
  key: string;
  before: string;
  after: string;
}

/**
 * Render a single `Json` leaf value as short display text. Defensive: handles
 * null/undefined, primitives, and nested objects/arrays (stringified compactly,
 * truncated) so a loosely-shaped diff never throws.
 */
function displayValue(value: Json | undefined): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string") return value === "" ? '""' : value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  // Object / array — compact JSON, truncated.
  try {
    const text = JSON.stringify(value);
    return text.length > 80 ? `${text.slice(0, 79)}…` : text;
  } catch {
    return "—";
  }
}

/**
 * Parse the loosely-shaped `metadata` (`{ col: { old, new } }`) into an ordered
 * list of before/after fields, DEFENSIVELY: the diff is `Json`, so we accept only
 * object entries that look like `{ old?, new? }` and skip anything else (the
 * writer may also stash non-diff scalars). Returns `[]` when there is nothing
 * diff-shaped to show — the caller hides the diff block entirely.
 */
export function parseMetadataDiff(metadata: Json): MetadataDiffField[] {
  if (
    metadata === null ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    return [];
  }

  const fields: MetadataDiffField[] = [];
  for (const [key, raw] of Object.entries(metadata)) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      // Not a `{ old, new }` cell — skip (non-diff metadata, defensively ignored).
      continue;
    }
    const cell = raw as Record<string, Json | undefined>;
    if (!("old" in cell) && !("new" in cell)) continue;
    fields.push({
      key,
      before: displayValue(cell.old),
      after: displayValue(cell.new),
    });
  }
  return fields;
}
