/**
 * Uniform keyset (cursor) pagination contract (WS-6 P3).
 *
 * Backend-owned; the frontend imports `Page`/`PageParams` from here. Every
 * paginating list query in `src/lib/queries/**` returns `Page<T>` and accepts an
 * optional `page?: PageParams`. The cursor is OPAQUE to callers — it is a
 * base64url-encoded JSON snapshot of the sort-tuple of the last row on the page,
 * round-tripped verbatim. Callers never construct or parse it; they pass back
 * `nextCursor` to fetch the following page.
 *
 * Decode is defensive: a malformed/tampered cursor decodes to "no cursor" (page
 * 1) rather than throwing, so a stale cursor degrades gracefully instead of 500ing.
 */

/** One page of a keyset-paginated list. */
export interface Page<T> {
  rows: T[]
  /** Opaque cursor for the NEXT page; `null` when this is the last page (or when
   * the list is capped and not cursor-paginated — e.g. the kanban board). */
  nextCursor: string | null
}

/** Pagination inputs for a list query. Both optional: omit for the first page at
 * the list's default page size. */
export interface PageParams {
  /** Opaque cursor from a previous `Page.nextCursor`; omit for the first page. */
  cursor?: string
  /** Rows per page. Each list pins its own default when omitted. */
  limit?: number
}

/** Default page size shared by the keyset lists (matches the `org-users`
 * pagination convention). */
export const DEFAULT_PAGE_SIZE = 25

/**
 * Encode a sort-tuple as an opaque cursor (base64url of its JSON). The tuple keys
 * are private to each query function; callers treat the result as opaque.
 */
export function encodeCursor(tuple: object): string {
  return Buffer.from(JSON.stringify(tuple), 'utf8').toString('base64url')
}

// ---------------------------------------------------------------------------
// Cursor-field validators (WS-6 QA MAJOR — untrusted-input hardening).
//
// A cursor is client-round-tripped, so its decoded field values are UNTRUSTED.
// The keyset lists interpolate those values into raw PostgREST `.or()` filter
// STRINGS, where the metacharacters `,` `(` `)` `.` would alter the predicate.
// Every cursor field is ONLY ever an ISO-8601 timestamp or a UUID — forms that
// STRUCTURALLY exclude those metacharacters — so we validate each decoded field
// against its expected kind BEFORE it can reach a filter string. Any field that
// fails → the whole cursor is rejected (→ page 1), preserving the "malformed →
// null, never throws" contract. (`pqsInbox` is exempt: it binds cursor values as
// typed RPC params, not into a string, so it needs no validation.)
// ---------------------------------------------------------------------------

/** The kinds a cursor field may hold. Both forms exclude `,` `(` `)`. */
export type CursorFieldKind = 'timestamp' | 'uuid'

// Anchored ISO-8601 timestamp: `YYYY-MM-DDTHH:MM:SS` with optional fractional
// seconds and an optional `Z` / `±HH:MM` offset (or a space date/time separator,
// which is what Postgres/PostgREST emit). No comma/paren/space-injection possible.
// Offset forms accepted: `Z`, `±HH`, `±HHMM`, `±HH:MM` (Postgres emits `+00`).
const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)?$/
// Canonical UUID (8-4-4-4-12 hex). Contains no PostgREST metacharacter.
const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/** Whether `v` is a string matching the ISO-8601 timestamp form. */
export function isIsoTimestamp(v: unknown): v is string {
  return typeof v === 'string' && ISO_TIMESTAMP_RE.test(v)
}

/** Whether `v` is a string matching the canonical UUID form. */
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

/** A validation schema for a cursor: the expected {@link CursorFieldKind} per key.
 * `null` is permitted for a nullable field only when the key is marked with the
 * `'timestamp'` kind AND the decoded value is `null` (e.g. submissions' `s`, which
 * is null for an in_progress row) — see {@link decodeCursor}. */
export type CursorSchema<T> = { [K in keyof T]: CursorFieldKind }

function fieldValid(value: unknown, kind: CursorFieldKind): boolean {
  // A null field passes ONLY for the timestamp kind (nullable sort columns like
  // submitted_at); a null uuid tie-breaker is never legitimate.
  if (value === null) return kind === 'timestamp'
  return kind === 'timestamp' ? isIsoTimestamp(value) : isUuid(value)
}

/**
 * Decode an opaque cursor back to its sort-tuple. Returns `null` for an
 * absent/malformed/tampered cursor (→ treated as the first page, never throws).
 *
 * When a `schema` is supplied, EVERY key it names must be present and pass its
 * {@link CursorFieldKind} validator (structurally excluding the PostgREST filter
 * metacharacters `,` `(` `)`); any failure rejects the whole cursor (→ `null` →
 * page 1). Callers that interpolate cursor fields into a raw `.or()` string MUST
 * pass a schema so no untrusted value can reach the filter.
 */
export function decodeCursor<T = Record<string, unknown>>(
  cursor: string | undefined,
  schema?: CursorSchema<T>,
): T | null {
  if (!cursor) return null
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8')
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return null
    if (schema) {
      const record = parsed as Record<string, unknown>
      for (const key of Object.keys(schema) as (keyof T)[]) {
        if (!(key in record)) return null
        if (!fieldValid(record[key as string], schema[key])) return null
      }
    }
    return parsed as T
  } catch {
    return null
  }
}
