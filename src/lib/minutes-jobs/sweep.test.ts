import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * T2 — the O3 stale-audio sweep (QA M1).
 *
 * The sweep runs on a webhook delivery and on a page load, so two properties matter as
 * much as correctness: it must never throw (it sits beside a 200 the route owes the
 * service and beside a render), and it must not stamp `audio_deleted_at` for an object
 * storage did not actually remove — a false stamp is worse than no stamp, because every
 * later pass then skips the object forever.
 */

const rpc = vi.fn()
const remove = vi.fn()
const update = vi.fn()
const inFilter = vi.fn()
const from = vi.fn()
const storageFrom = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc,
    storage: { from: storageFrom },
    from,
  }),
}))

async function load() {
  const mod = await import('./sweep')
  mod.resetSweepThrottleForTests()
  return mod
}

beforeEach(() => {
  vi.resetModules()
  rpc.mockReset()
  remove.mockReset()
  update.mockReset()
  inFilter.mockReset()
  from.mockReset()
  storageFrom.mockReset()

  storageFrom.mockReturnValue({ remove })
  inFilter.mockResolvedValue({ error: null })
  update.mockReturnValue({ in: inFilter })
  from.mockReturnValue({ update })
})

afterEach(() => vi.restoreAllMocks())

const STALE = [
  { object_path: 'm1/j1/a.m4a', job_id: 'job-1' },
  { object_path: 'orphan/x/b.m4a', job_id: null },
]

describe('sweepStaleAudio — the happy path', () => {
  it('deletes every path the reader returned, in ONE storage call', async () => {
    rpc.mockResolvedValue({ data: STALE, error: null })
    remove.mockResolvedValue({
      data: [{ name: 'm1/j1/a.m4a' }, { name: 'orphan/x/b.m4a' }],
      error: null,
    })

    const { sweepStaleAudio } = await load()
    const outcome = await sweepStaleAudio()

    expect(outcome).toEqual({ deleted: 2, skipped: false })
    // One call, one array — the "bounded, cheap" budget. A per-object loop would be an
    // N-round-trip latency bug on the webhook hot path.
    expect(remove).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith(['m1/j1/a.m4a', 'orphan/x/b.m4a'])
  })

  it('asks for the TTL window and a bounded batch', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    const { sweepStaleAudio } = await load()
    await sweepStaleAudio()

    expect(rpc).toHaveBeenCalledWith('list_stale_meeting_audio', {
      p_older_than_hours: 24,
      p_limit: 200,
    })
  })

  it('stamps audio_deleted_at ONLY for jobs whose object was confirmed removed', async () => {
    // The orphan has no job row to stamp; the confirmed one does.
    rpc.mockResolvedValue({ data: STALE, error: null })
    remove.mockResolvedValue({ data: [{ name: 'm1/j1/a.m4a' }], error: null })

    const { sweepStaleAudio } = await load()
    await sweepStaleAudio()

    expect(from).toHaveBeenCalledWith('meeting_minutes_jobs')
    expect(inFilter).toHaveBeenCalledWith('id', ['job-1'])
  })

  it('does NOT stamp a job whose object storage failed to remove', async () => {
    // A false stamp is unrecoverable in practice: every later pass sees audio_deleted_at
    // set and skips the object, so it is retained forever while the row claims otherwise.
    rpc.mockResolvedValue({ data: [{ object_path: 'm1/j1/a.m4a', job_id: 'job-1' }], error: null })
    remove.mockResolvedValue({ data: [], error: null })

    const { sweepStaleAudio } = await load()
    const outcome = await sweepStaleAudio()

    expect(outcome.deleted).toBe(0)
    expect(inFilter).not.toHaveBeenCalled()
  })

  it('does nothing when the backlog is empty (the steady state)', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    const { sweepStaleAudio } = await load()
    expect(await sweepStaleAudio()).toEqual({ deleted: 0, skipped: false })
    expect(remove).not.toHaveBeenCalled()
  })
})

describe('throttle', () => {
  it('skips a second call inside the window', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    const { sweepStaleAudio } = await load()

    const first = await sweepStaleAudio({ nowMs: 1_000_000 })
    const second = await sweepStaleAudio({ nowMs: 1_000_000 + 60_000 })

    expect(first.skipped).toBe(false)
    expect(second.skipped).toBe(true)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('runs again once the window has passed', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    const { sweepStaleAudio } = await load()

    await sweepStaleAudio({ nowMs: 1_000_000 })
    const later = await sweepStaleAudio({ nowMs: 1_000_000 + 11 * 60 * 1000 })

    expect(later.skipped).toBe(false)
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it('claims the window BEFORE awaiting, so concurrent callers cannot both pass', async () => {
    // Two requests landing together in one instance must not both issue the delete batch.
    let release: (v: unknown) => void = () => {}
    rpc.mockReturnValue(new Promise((r) => { release = r }))

    const { sweepStaleAudio } = await load()
    const a = sweepStaleAudio({ nowMs: 2_000_000 })
    const b = await sweepStaleAudio({ nowMs: 2_000_000 })

    expect(b.skipped).toBe(true)
    release({ data: [], error: null })
    await a
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('force bypasses the throttle', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    const { sweepStaleAudio } = await load()
    await sweepStaleAudio({ nowMs: 3_000_000 })
    const forced = await sweepStaleAudio({ nowMs: 3_000_001, force: true })
    expect(forced.skipped).toBe(false)
  })
})

describe('it never throws — it runs beside a render and beside a webhook 200', () => {
  it('swallows a reader error', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { sweepStaleAudio } = await load()
    await expect(sweepStaleAudio()).resolves.toEqual({ deleted: 0, skipped: false })
  })

  it('swallows a storage error', async () => {
    rpc.mockResolvedValue({ data: STALE, error: null })
    remove.mockResolvedValue({ data: null, error: { message: 'nope' } })
    const { sweepStaleAudio } = await load()
    await expect(sweepStaleAudio()).resolves.toEqual({ deleted: 0, skipped: false })
    expect(inFilter).not.toHaveBeenCalled()
  })

  it('swallows a thrown client error', async () => {
    rpc.mockImplementation(() => { throw new Error('client exploded') })
    const { sweepStaleAudio } = await load()
    await expect(sweepStaleAudio()).resolves.toEqual({ deleted: 0, skipped: false })
  })
})
