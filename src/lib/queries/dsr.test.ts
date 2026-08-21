import { describe, expect, it, vi } from 'vitest'

/**
 * Pins `DsrOutcomeRecord.meetingMinutesDisposed` — the flag that gates the
 * meeting-lane retention disclosure (`DSR_MEETING_RESIDUE_RETAINED`) on the OUTCOME
 * RECORD, the artifact handed to the data subject.
 *
 * ⭐ WHY IT NEEDS BOTH ARMS. The disclosure is only honest when a meeting disposal
 * actually happened. Rendered unconditionally it asserts a retention that never
 * occurred — the over-claim's mirror image, and the exact defect the constant's own
 * docblock warns about ("a retention disclosure that outlives the retention"). So
 * "shows it when it happened" and "does NOT show it when it did not" are two separate
 * claims and both are pinned here. A file asserting only the true arm would pass
 * against `meetingMinutesDisposed: true` hardcoded.
 *
 * ⛔ THE SHARP CASE IS `blocked`, NOT `pending`. A `dispose_meeting` task that was
 * RETIRED erased nothing, so it must not trigger the disclosure — and it is the case a
 * naive `rows.some(t => t.kind === 'dispose_meeting')` gets wrong while every other
 * case here still passes. `blocked` has two writers and ADR 0130 Amendment 3's
 * correction forbids naming a retirement's CAUSE from `status` alone; this predicate
 * needs no cause, only the positive completion signal, which is why it reads `'done'`
 * rather than "not blocked".
 *
 * Non-vacuity is by mutation, not assumption — MEASURED, with the unmutated run pinned
 * as a positive control first (exit 0). Mutating the predicate in `dsr.ts` gives:
 *   - drop `&& t.status === 'done'`       → 2 red ("retired", "pending")
 *   - drop `t.kind === 'dispose_meeting'` → 2 red ("no meeting task", "another lane")
 *   - hardcode `true`                     → 4 red (every FALSE arm)
 *   - hardcode `false`                    → 2 red (both TRUE arms)
 * Every case is red under at least one mutation, so none is decorative.
 */

const maybeSingle = vi.fn()
const tasksResult = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) =>
      table === 'dsr_requests'
        ? { select: () => ({ eq: () => ({ maybeSingle }) }) }
        : { select: () => ({ eq: tasksResult }) },
  }),
}))

import { getDsrOutcomeRecord } from './dsr'

const REQUEST = {
  id: 'req-1',
  hospital_id: 'hosp-1',
  file_ref: 'GED-42',
  status: 'closed',
  outcome: 'granted',
  outcome_basis: null,
  legal_consultation_ref: null,
  received_at: '2026-08-01T00:00:00Z',
  due_date: '2026-08-16',
  adjudicated_at: '2026-08-05T00:00:00Z',
  closed_at: '2026-08-10T00:00:00Z',
}

type Task = { kind: string; status: string }

async function recordWith(tasks: Task[]) {
  maybeSingle.mockResolvedValue({ data: REQUEST, error: null })
  tasksResult.mockResolvedValue({
    data: tasks.map((t) => ({
      ...t,
      attested_by_name: null,
      attested_redactions: null,
    })),
  })
  const record = await getDsrOutcomeRecord('req-1')
  if (!record) throw new Error('fixture built no record — the arms below would be vacuous')
  return record
}

describe('getDsrOutcomeRecord — meetingMinutesDisposed', () => {
  it('is TRUE when a meeting-minutes disposal completed', async () => {
    const record = await recordWith([{ kind: 'dispose_meeting', status: 'done' }])
    expect(record.meetingMinutesDisposed).toBe(true)
  })

  it('is FALSE when the request disposed no meeting at all', async () => {
    const record = await recordWith([
      { kind: 'dispose_case', status: 'done' },
      { kind: 'attest_review', status: 'done' },
    ])
    expect(record.meetingMinutesDisposed).toBe(false)
  })

  it('is FALSE when the meeting disposal was RETIRED — a blocked task erased nothing', async () => {
    const record = await recordWith([{ kind: 'dispose_meeting', status: 'blocked' }])
    expect(record.meetingMinutesDisposed).toBe(false)
  })

  it('is FALSE while the meeting disposal is still pending', async () => {
    const record = await recordWith([{ kind: 'dispose_meeting', status: 'pending' }])
    expect(record.meetingMinutesDisposed).toBe(false)
  })

  it('is FALSE when another lane completed — a disposed case says nothing about minutes', async () => {
    const record = await recordWith([
      { kind: 'dispose_referral', status: 'done' },
      { kind: 'dispose_event', status: 'done' },
    ])
    expect(record.meetingMinutesDisposed).toBe(false)
  })

  it('is TRUE when one of several meeting disposals completed', async () => {
    const record = await recordWith([
      { kind: 'dispose_meeting', status: 'blocked' },
      { kind: 'dispose_meeting', status: 'done' },
    ])
    expect(record.meetingMinutesDisposed).toBe(true)
  })
})
