import { describe, expect, it } from 'vitest'

import { earliestSessionStart } from '@/lib/queries/rca'

/**
 * BUG-RCA-001 — "the interview's date" for the RCA citation picker.
 *
 * An interview has MANY `interview_sessions`, so its date is a derivation someone has
 * to choose; `created_at` was a live alternative. The PO ruled (2026-08-05): the
 * EARLIEST session's `scheduled_start`. These cases pin that ruling executably, because
 * the thing it replaced — a comment plus a `.select()` naming a column that never
 * existed — typechecked, linted and shipped while silently dropping every interview
 * from the picker.
 */
describe('earliestSessionStart', () => {
  it('picks the earliest session, not the first in array order', () => {
    // The seeded interview really does carry two sessions in this shape.
    expect(
      earliestSessionStart([
        { scheduled_start: '2026-08-08T21:30:30.703701+00:00' },
        { scheduled_start: '2026-08-03T21:30:30.703701+00:00' },
      ]),
    ).toBe('2026-08-03T21:30:30.703701+00:00')
  })

  it('ignores undated sessions rather than letting one win', () => {
    expect(
      earliestSessionStart([
        { scheduled_start: null },
        { scheduled_start: '2026-08-03T00:00:00+00:00' },
        { scheduled_start: null },
      ]),
    ).toBe('2026-08-03T00:00:00+00:00')
  })

  it('is null when no session carries a date — the callers render "—"', () => {
    expect(earliestSessionStart([{ scheduled_start: null }])).toBeNull()
  })

  it('is null for an interview with no sessions at all, and for a null embed', () => {
    expect(earliestSessionStart([])).toBeNull()
    // PostgREST returns `null` (not `[]`) for an embed with no rows in some shapes;
    // the citation picker must not throw on it.
    expect(earliestSessionStart(null)).toBeNull()
  })

  it('does NOT filter by session status — a concluded interview still has a date', () => {
    // The deliberate difference from `toNextSession` in `interviews.ts`, which keeps
    // only `status = 'scheduled'`. That helper answers "what is next"; this one answers
    // "when was it", and for a concluded interview the scheduled sessions are exactly
    // the ones that no longer exist. Passing session rows with no status field at all
    // is the assertion: status is not part of this decision.
    expect(
      earliestSessionStart([{ scheduled_start: '2026-01-09T08:00:00+00:00' }]),
    ).toBe('2026-01-09T08:00:00+00:00')
  })
})
