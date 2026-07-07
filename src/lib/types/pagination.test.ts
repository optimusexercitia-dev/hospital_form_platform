import { describe, expect, it } from 'vitest'

import {
  decodeCursor,
  encodeCursor,
  isIsoTimestamp,
  isUuid,
  type CursorSchema,
} from './pagination'

/**
 * Keyset-cursor validation (WS-6 QA MAJOR — untrusted-input hardening). A cursor is
 * client-round-tripped, so its decoded fields are UNTRUSTED; the flat-list keyset
 * queries interpolate them into raw PostgREST `.or()` filter STRINGS where `,` `(`
 * `)` `.` would alter the predicate. `decodeCursor(cursor, schema)` must reject ANY
 * cursor whose field is not the exact ISO-timestamp / UUID kind (both structurally
 * free of those metacharacters) → `null` → page 1, never throws. Legitimate cursors
 * built by `encodeCursor` from real timestamp+uuid values must pass unchanged.
 */

// Mirrors the submissions schema: two timestamps (one nullable) + a uuid tie-breaker.
interface SubCursor {
  s: string | null
  u: string
  id: string
}
const SUB_SCHEMA: CursorSchema<SubCursor> = { s: 'timestamp', u: 'timestamp', id: 'uuid' }

const TS = '2026-01-02T10:00:00Z'
const TS_PG = '2026-01-02 10:00:00.123456+00' // Postgres/PostgREST wire form
const UUID = '3f18672a-0e2d-40cd-b87b-a108adee8f30'

describe('isIsoTimestamp', () => {
  it('accepts ISO-8601 forms (T / space separator, offset, fractional seconds)', () => {
    expect(isIsoTimestamp(TS)).toBe(true)
    expect(isIsoTimestamp(TS_PG)).toBe(true)
    expect(isIsoTimestamp('2026-01-02T10:00:00')).toBe(true)
    expect(isIsoTimestamp('2026-01-02T10:00:00.5+05:30')).toBe(true)
  })
  it('rejects non-timestamps and anything carrying PostgREST metacharacters', () => {
    expect(isIsoTimestamp('2020-01-01,submitted_at.gt.1900-01-01')).toBe(false)
    expect(isIsoTimestamp('2026-01-02T10:00:00),and(id.gt.0')).toBe(false)
    expect(isIsoTimestamp('not-a-date')).toBe(false)
    expect(isIsoTimestamp('2026-13-45T99:99:99')).toBe(true) // shape-only, but still metachar-free
    expect(isIsoTimestamp(null)).toBe(false)
    expect(isIsoTimestamp(123)).toBe(false)
  })
})

describe('isUuid', () => {
  it('accepts a canonical UUID', () => {
    expect(isUuid(UUID)).toBe(true)
  })
  it('rejects non-UUIDs and metacharacter-bearing strings', () => {
    expect(isUuid('0),or(is_admin.eq.true')).toBe(false)
    expect(isUuid('3f18672a')).toBe(false)
    expect(isUuid(`${UUID},x`)).toBe(false)
    expect(isUuid(null)).toBe(false)
  })
})

describe('decodeCursor (schema validation)', () => {
  it('round-trips a legitimate cursor built by encodeCursor unchanged', () => {
    const original: SubCursor = { s: TS_PG, u: TS, id: UUID }
    const decoded = decodeCursor<SubCursor>(encodeCursor(original), SUB_SCHEMA)
    expect(decoded).toEqual(original)
  })

  it('permits a null nullable timestamp field (submitted_at of an in_progress row)', () => {
    const original: SubCursor = { s: null, u: TS, id: UUID }
    expect(decodeCursor<SubCursor>(encodeCursor(original), SUB_SCHEMA)).toEqual(original)
  })

  it('rejects a crafted INJECTION cursor (comma/paren in a timestamp field) → null', () => {
    const evil = encodeCursor({
      s: '2020-01-01,submitted_at.gt.1900-01-01',
      u: TS,
      id: UUID,
    })
    expect(decodeCursor<SubCursor>(evil, SUB_SCHEMA)).toBeNull()
  })

  it('rejects an injection in the uuid tie-breaker field → null', () => {
    const evil = encodeCursor({ s: TS, u: TS, id: '0),or(is_admin.eq.true' })
    expect(decodeCursor<SubCursor>(evil, SUB_SCHEMA)).toBeNull()
  })

  it('rejects a null in a non-nullable uuid field → null', () => {
    const bad = encodeCursor({ s: TS, u: TS, id: null })
    expect(decodeCursor<SubCursor>(bad, SUB_SCHEMA)).toBeNull()
  })

  it('rejects a cursor missing a schema-required field → null', () => {
    const bad = encodeCursor({ s: TS, u: TS }) // no id
    expect(decodeCursor<SubCursor>(bad, SUB_SCHEMA)).toBeNull()
  })

  it('rejects a wrong-typed field (number where a timestamp is required) → null', () => {
    const bad = encodeCursor({ s: 1234567890, u: TS, id: UUID })
    expect(decodeCursor<SubCursor>(bad, SUB_SCHEMA)).toBeNull()
  })

  it('returns null for absent / malformed base64 / non-object payloads (never throws)', () => {
    expect(decodeCursor<SubCursor>(undefined, SUB_SCHEMA)).toBeNull()
    expect(decodeCursor<SubCursor>('!!!not-base64!!!', SUB_SCHEMA)).toBeNull()
    expect(decodeCursor<SubCursor>(encodeCursor([1, 2]), SUB_SCHEMA)).toBeNull()
    // A JSON scalar (not an object) → null.
    expect(
      decodeCursor<SubCursor>(Buffer.from('42', 'utf8').toString('base64url'), SUB_SCHEMA),
    ).toBeNull()
  })

  it('without a schema, still decodes an object (back-compat) but does not validate', () => {
    const decoded = decodeCursor<{ x: string }>(encodeCursor({ x: 'anything,(' }))
    expect(decoded).toEqual({ x: 'anything,(' })
  })
})

/**
 * `pqsInbox` cursor schema (WS-6 consistency fix). `pqsInbox` binds cursor values as
 * typed RPC params (injection-safe), but now validates with this schema so a
 * well-formed-shape-but-bad-value cursor degrades to page 1 (null) rather than to an
 * empty page (RPC cast error). Mirrors the private `PQS_INBOX_CURSOR_SCHEMA`.
 */
interface PqsInboxCursor {
  r: string
  id: string
}
const PQS_SCHEMA: CursorSchema<PqsInboxCursor> = { r: 'timestamp', id: 'uuid' }

describe('decodeCursor (pqsInbox schema — empty-vs-page-1 consistency)', () => {
  it('accepts a real reported_at + uuid cursor', () => {
    const original: PqsInboxCursor = { r: TS_PG, id: UUID }
    expect(decodeCursor<PqsInboxCursor>(encodeCursor(original), PQS_SCHEMA)).toEqual(
      original,
    )
  })

  it('rejects a bad-value cursor (non-timestamp r) → null → page 1', () => {
    const bad = encodeCursor({ r: 'not-a-date', id: UUID })
    expect(decodeCursor<PqsInboxCursor>(bad, PQS_SCHEMA)).toBeNull()
  })

  it('rejects a bad-value cursor (non-uuid id) → null → page 1', () => {
    const bad = encodeCursor({ r: TS, id: 'not-a-uuid' })
    expect(decodeCursor<PqsInboxCursor>(bad, PQS_SCHEMA)).toBeNull()
  })

  it('rejects a null id tie-breaker → null → page 1', () => {
    const bad = encodeCursor({ r: TS, id: null })
    expect(decodeCursor<PqsInboxCursor>(bad, PQS_SCHEMA)).toBeNull()
  })
})
