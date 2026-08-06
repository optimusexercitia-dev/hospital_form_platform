import { describe, expect, it } from 'vitest'

import { buildAudioJobMetadata, isUuid, parseAudioJobMetadata } from './metadata'

/**
 * T2 — the opaque metadata passthrough (ADR 0099 D18).
 *
 * This is the webhook's ONLY routing information, and it arrives from outside. Every
 * refusal below exists so a malformed value becomes a clean 200-drop instead of a
 * Postgres `22P02` surfacing as a 500 (and therefore a retry storm).
 */

const JOB_ID = '11111111-2222-3333-4444-555555555555'

describe('buildAudioJobMetadata', () => {
  it('produces the exact two string keys the service echoes back', () => {
    expect(buildAudioJobMetadata({ platform_job_id: JOB_ID, job_type: 'meeting_minutes' })).toEqual({
      platform_job_id: JOB_ID,
      job_type: 'meeting_minutes',
    })
  })

  it('round-trips through parse', () => {
    const built = buildAudioJobMetadata({ platform_job_id: JOB_ID, job_type: 'meeting_minutes' })
    expect(parseAudioJobMetadata(built)).toEqual({
      platform_job_id: JOB_ID,
      job_type: 'meeting_minutes',
    })
  })
})

describe('parseAudioJobMetadata', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'meeting_minutes'],
    ['an array', [{ platform_job_id: JOB_ID }]],
    ['an empty object', {}],
    ['a missing job_type', { platform_job_id: JOB_ID }],
    ['a missing platform_job_id', { job_type: 'meeting_minutes' }],
    ['a non-string job id', { platform_job_id: 42, job_type: 'meeting_minutes' }],
  ])('returns null for %s', (_label, input) => {
    expect(parseAudioJobMetadata(input)).toBeNull()
  })

  it('rejects a platform_job_id that is not a uuid', () => {
    // Fed straight into an RPC's `uuid` parameter. Unvalidated, `'; drop'` becomes a
    // 22P02 → 500 → the service retries forever against a request that cannot succeed.
    expect(
      parseAudioJobMetadata({ platform_job_id: 'not-a-uuid', job_type: 'meeting_minutes' }),
    ).toBeNull()
  })

  it('rejects an UNKNOWN job_type rather than casting it through', () => {
    // The D18 seam. A newer service sending `interview` to an older platform must land in
    // the route's unknown-kind branch, not be dispatched to a handler that never expected
    // it. A bare `as JobType` cast here is exactly the bug this guards.
    expect(
      parseAudioJobMetadata({ platform_job_id: JOB_ID, job_type: 'interview' }),
    ).toBeNull()
  })

  it('ignores unrelated extra keys the service may add later', () => {
    expect(
      parseAudioJobMetadata({
        platform_job_id: JOB_ID,
        job_type: 'meeting_minutes',
        tenant: 'whatever',
      }),
    ).toEqual({ platform_job_id: JOB_ID, job_type: 'meeting_minutes' })
  })
})

describe('isUuid', () => {
  it('accepts a canonical uuid in either case', () => {
    expect(isUuid(JOB_ID)).toBe(true)
    expect(isUuid(JOB_ID.toUpperCase())).toBe(true)
  })

  it.each(['', 'abc', `${JOB_ID}x`, `x${JOB_ID}`, JOB_ID.replace(/-/g, '')])(
    'rejects %j',
    (value) => expect(isUuid(value)).toBe(false),
  )
})
