import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { signCallbackBody } from '@/lib/audio-jobs/hmac'

/**
 * T2 — the webhook route (ADR 0099 D10/D18), driven with REAL `Request` objects.
 *
 * The route is publicly reachable and its only guard is the HMAC, so the 401 arm is a
 * security test. The 200 arms are a contract with the service's retry logic: anything
 * permanent must answer 200, or a service that is not at fault retry-storms us.
 */

const SECRET = 'route-test-secret'
const JOB_ID = '11111111-2222-3333-4444-555555555555'

const handleMeetingMinutesCallback = vi.fn()
const featureEnabledServerOnly = vi.fn()

vi.mock('@/lib/minutes-jobs/webhook', () => ({
  handleMeetingMinutesCallback: (...args: unknown[]) => handleMeetingMinutesCallback(...args),
}))
// ⚠ The route must read flags through the SESSION-LESS reader: its caller is a machine
// with no cookie, and `get_feature_flags` has no anon EXECUTE. Mocking `featureEnabled`
// here (as this file used to) is what let the production bug through — the mock made the
// session-dependent read look like it worked. Naming the server-only reader is therefore
// part of the assertion: if the route reverts to `featureEnabled`, the real one runs, the
// admin client is never stubbed, and these tests fail rather than passing vacuously.
vi.mock('@/lib/queries/feature-flags', () => ({
  featureEnabledServerOnly: (...args: unknown[]) => featureEnabledServerOnly(...args),
}))

function body(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schema_version: '2.1',
    job_id: 'svc-1',
    job_type: 'meeting_minutes',
    status: 'done',
    metadata: { platform_job_id: JOB_ID, job_type: 'meeting_minutes' },
    audio_release: true,
    result: { minutes: { committee: 'CCIH' }, transcript: 'fala' },
    ...overrides,
  })
}

function post(raw: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/webhooks/audio-jobs', {
    method: 'POST',
    body: raw,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function signedHeaders(raw: string, secret = SECRET) {
  const ts = String(Math.floor(Date.now() / 1000))
  return { 'x-signature': signCallbackBody(raw, ts, secret), 'x-timestamp': ts }
}

async function POST(request: Request) {
  const mod = await import('./route')
  return mod.POST(request)
}

beforeEach(() => {
  vi.resetModules()
  handleMeetingMinutesCallback.mockReset()
  featureEnabledServerOnly.mockReset()
  featureEnabledServerOnly.mockResolvedValue(true)
  handleMeetingMinutesCallback.mockResolvedValue({ handled: true, updated: true, note: 'done' })
  process.env.MINUTES_CALLBACK_HMAC_SECRET = SECRET
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.MINUTES_CALLBACK_HMAC_SECRET
})

describe('401 — the signature is the security boundary', () => {
  it('rejects an unsigned request', async () => {
    const res = await POST(post(body()))
    expect(res.status).toBe(401)
    expect(handleMeetingMinutesCallback).not.toHaveBeenCalled()
  })

  it('rejects a signature made with the wrong secret', async () => {
    const raw = body()
    const res = await POST(post(raw, signedHeaders(raw, 'attacker-secret')))
    expect(res.status).toBe(401)
    expect(handleMeetingMinutesCallback).not.toHaveBeenCalled()
  })

  it('rejects a body TAMPERED after signing', async () => {
    const raw = body()
    const headers = signedHeaders(raw)
    const tampered = raw.replace(JOB_ID, '99999999-2222-3333-4444-555555555555')
    const res = await POST(post(tampered, headers))
    expect(res.status).toBe(401)
    expect(handleMeetingMinutesCallback).not.toHaveBeenCalled()
  })

  it('rejects a stale replay', async () => {
    const raw = body()
    const old = String(Math.floor(Date.now() / 1000) - 3600)
    const res = await POST(
      post(raw, { 'x-signature': signCallbackBody(raw, old, SECRET), 'x-timestamp': old }),
    )
    expect(res.status).toBe(401)
  })

  it('FAILS CLOSED when the platform has no secret configured', async () => {
    delete process.env.MINUTES_CALLBACK_HMAC_SECRET
    const raw = body()
    const res = await POST(post(raw, signedHeaders(raw, '')))
    expect(res.status).toBe(401)
    expect(handleMeetingMinutesCallback).not.toHaveBeenCalled()
  })

  it('never reveals WHICH check failed', async () => {
    const raw = body()
    const unsigned = await (await POST(post(raw))).json()
    const wrongSecret = await (await POST(post(raw, signedHeaders(raw, 'nope')))).json()
    expect(unsigned).toEqual(wrongSecret)
  })
})

describe('200 — permanent conditions must never earn a retry', () => {
  it('drops a signed body that is not JSON', async () => {
    const raw = 'not json at all'
    const res = await POST(post(raw, signedHeaders(raw)))
    expect(res.status).toBe(200)
    expect(handleMeetingMinutesCallback).not.toHaveBeenCalled()
  })

  it('drops a payload with no usable metadata', async () => {
    const raw = body({ metadata: {} })
    const res = await POST(post(raw, signedHeaders(raw)))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ note: expect.stringContaining('metadata') })
    expect(handleMeetingMinutesCallback).not.toHaveBeenCalled()
  })

  it('drops a non-uuid platform_job_id instead of feeding it to an RPC', async () => {
    const raw = body({ metadata: { platform_job_id: 'nope', job_type: 'meeting_minutes' } })
    const res = await POST(post(raw, signedHeaders(raw)))
    expect(res.status).toBe(200)
    expect(handleMeetingMinutesCallback).not.toHaveBeenCalled()
  })

  it('drops an UNKNOWN job_type — a newer service must not retry-storm us (D18)', async () => {
    const raw = body({
      job_type: 'interview',
      metadata: { platform_job_id: JOB_ID, job_type: 'interview' },
    })
    const res = await POST(post(raw, signedHeaders(raw)))
    expect(res.status).toBe(200)
    expect(handleMeetingMinutesCallback).not.toHaveBeenCalled()
  })

  it('drops the callback when the flag is OFF — the service is not at fault', async () => {
    featureEnabledServerOnly.mockResolvedValue(false)
    const raw = body()
    const res = await POST(post(raw, signedHeaders(raw)))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ note: 'feature disabled' })
    expect(handleMeetingMinutesCallback).not.toHaveBeenCalled()
  })

  it('checks the flag only AFTER the signature — an unsigned probe is still 401', async () => {
    featureEnabledServerOnly.mockResolvedValue(false)
    expect((await POST(post(body()))).status).toBe(401)
  })
})

describe('503 — an UNREADABLE flag is not an OFF flag', () => {
  // The production incident this guards: the route read the flag through the session
  // client, the machine caller had no cookie, the read errored, it safe-defaulted to OFF,
  // and every real callback was 200-dropped. 200 is unrecoverable here — the callback is
  // the only carrier of the minutes and transcript, and reconciliation polls status only.
  it('asks the service to retry when the flags cannot be read', async () => {
    featureEnabledServerOnly.mockResolvedValue(null)
    const raw = body()
    const res = await POST(post(raw, signedHeaders(raw)))
    expect(res.status).toBe(503)
    expect(handleMeetingMinutesCallback).not.toHaveBeenCalled()
  })

  it('does NOT answer 200 for an unreadable flag — a 200 stops the retry forever', async () => {
    featureEnabledServerOnly.mockResolvedValue(null)
    const raw = body()
    expect((await POST(post(raw, signedHeaders(raw)))).status).not.toBe(200)
  })

  it('still refuses an unsigned request before it ever reads a flag', async () => {
    featureEnabledServerOnly.mockResolvedValue(null)
    expect((await POST(post(body()))).status).toBe(401)
    expect(featureEnabledServerOnly).not.toHaveBeenCalled()
  })
})

describe('dispatch and idempotency', () => {
  it('routes a meeting_minutes callback to its handler with the SIGNED job id', async () => {
    const raw = body()
    const res = await POST(post(raw, signedHeaders(raw)))
    expect(res.status).toBe(200)
    expect(handleMeetingMinutesCallback).toHaveBeenCalledTimes(1)
    const [jobId, payload] = handleMeetingMinutesCallback.mock.calls[0]
    expect(jobId).toBe(JOB_ID)
    expect(payload).toMatchObject({ status: 'done' })
  })

  it('ignores the X-Job-Id HEADER and trusts only the signed body', async () => {
    // The header is unauthenticated. Routing on it would let anyone who can reach the
    // endpoint redirect a legitimately signed payload onto someone else's job row.
    const raw = body()
    const res = await POST(
      post(raw, {
        ...signedHeaders(raw),
        'x-job-id': '00000000-0000-0000-0000-000000000000',
      }),
    )
    expect(res.status).toBe(200)
    expect(handleMeetingMinutesCallback.mock.calls[0][0]).toBe(JOB_ID)
  })

  it('answers 200 for a re-delivery the handler no-ops', async () => {
    handleMeetingMinutesCallback.mockResolvedValue({
      handled: true,
      updated: false,
      note: 'no-op (status=applied)',
    })
    const raw = body()
    const res = await POST(post(raw, signedHeaders(raw)))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, updated: false })
  })

  it('answers 200 for an error callback too', async () => {
    handleMeetingMinutesCallback.mockResolvedValue({ handled: true, updated: true, note: 'failed' })
    const raw = body({ status: 'error', result: null, error_code: 'audio_unreadable' })
    const res = await POST(post(raw, signedHeaders(raw)))
    expect(res.status).toBe(200)
    expect(handleMeetingMinutesCallback.mock.calls[0][1]).toMatchObject({ status: 'error' })
  })
})

describe('method handling', () => {
  it('answers 405 to GET', async () => {
    const mod = await import('./route')
    expect(mod.GET().status).toBe(405)
  })
})
