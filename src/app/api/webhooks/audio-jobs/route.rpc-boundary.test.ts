import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { signCallbackBody } from '@/lib/audio-jobs/hmac'

/**
 * FUP-MINUTES-WEBHOOK-HMAC-DENY-TEST — rider R2 of the AE1.4 `.rpc()` rulings.
 *
 * WHY THIS FILE EXISTS BESIDE `route.test.ts`. That suite mocks
 * `handleMeetingMinutesCallback` out, so its 401 arms assert "the HANDLER was not
 * called" — a proxy for the thing the ruling actually protects. The invariant the
 * ruling states is narrower and stronger: `complete_minutes_job` / `fail_minutes_job`
 * are `service_role`-only RPCs whose SOLE caller is this HMAC-verified route, so a
 * forged callback must not reach the RPC. With the handler mocked, the route→RPC edge
 * does not exist in that test at all: it would keep passing if the handler were
 * renamed, if a second call path to the RPC were added, or if the handler's body
 * stopped being the only way there.
 *
 * So here the handler is REAL and the stub sits one layer lower, at
 * `createAdminClient` — the service-role client. `rpc` is a spy, and the assertion is
 * the literal one the ruling wants: `expect(rpc).not.toHaveBeenCalled()`.
 *
 * Both directions, because the deny half alone goes green on a route that refuses
 * everything: the §2 positive control proves a well-signed callback DOES reach the RPC,
 * which is what makes the §1 refusals evidence about the signature rather than about
 * the route being broken.
 *
 * What is still mocked, and why none of it is on the gate path:
 *   - `featureEnabledServerOnly` — the flag gate sits DOWNSTREAM of the signature
 *     check; the positive control needs it ON, and §1 asserts it is never even reached.
 *   - `sweepStaleAudio` / `deleteAudio` — storage side effects the handler fires
 *     alongside the RPC. Unrelated to authorization, and left real they would drive the
 *     stub client into paths this file has no reason to model.
 */

const SECRET = 'rpc-boundary-secret'
const JOB_ID = '11111111-2222-3333-4444-555555555555'

/** The shape supabase-js hands back; `error: null` throughout — nothing here fails. */
interface StubResult {
  data: unknown
  error: null
}

/**
 * THE ASSERTION SUBJECT. Every `complete_minutes_job` / `fail_minutes_job` call in the
 * handler goes through this spy, and nothing else can reach those RPCs.
 */
const rpc = vi.fn(
  async (_name: string, _args: Record<string, unknown>): Promise<StubResult> => ({
    data: { updated: true, status: 'ready_for_review', audio_path: null },
    error: null,
  }),
)

const featureEnabledServerOnly = vi.fn()

/**
 * A permissive PostgREST chain. `buildDraft` walks jobs → meetings → attendees →
 * memberships → profiles before the RPC; every hop resolves empty, which sends the
 * draft down its "no attendees to resolve" path and leaves the RPC call intact.
 */
interface QueryChain {
  select: () => QueryChain
  eq: () => QueryChain
  in: () => QueryChain
  or: () => QueryChain
  returns: () => QueryChain
  maybeSingle: () => Promise<StubResult>
  then: (onFulfilled: (value: StubResult) => unknown) => Promise<unknown>
}

function queryChain(): QueryChain {
  const chain: QueryChain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    or: () => chain,
    returns: () => chain,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (onFulfilled) => Promise.resolve(onFulfilled({ data: [], error: null })),
  }
  return chain
}

const adminStub = { rpc, from: () => queryChain() }

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => adminStub }))
vi.mock('@/lib/queries/feature-flags', () => ({
  featureEnabledServerOnly: (...args: unknown[]) => featureEnabledServerOnly(...args),
}))
vi.mock('@/lib/minutes-jobs/sweep', () => ({
  sweepStaleAudio: () => Promise.resolve({ deleted: 0, skipped: true }),
}))
vi.mock('@/lib/minutes-jobs/reconcile', () => ({ deleteAudio: () => Promise.resolve(false) }))

function body(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schema_version: '2.1',
    job_id: 'svc-1',
    job_type: 'meeting_minutes',
    status: 'done',
    metadata: { platform_job_id: JOB_ID, job_type: 'meeting_minutes' },
    audio_release: true,
    result: {
      minutes: { committee: 'CCIH', agenda_items: [], resolutions: [] },
      transcript: 'fala',
    },
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

/** Which RPCs did this request actually reach? */
function rpcNames(): string[] {
  return rpc.mock.calls.map((call) => call[0])
}

beforeEach(() => {
  vi.resetModules()
  rpc.mockClear()
  featureEnabledServerOnly.mockReset()
  featureEnabledServerOnly.mockResolvedValue(true)
  process.env.MINUTES_CALLBACK_HMAC_SECRET = SECRET
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.MINUTES_CALLBACK_HMAC_SECRET
})

describe('R2 deny — a callback that fails the HMAC never reaches the service-role RPCs', () => {
  it('an ABSENT signature does not reach complete_minutes_job or fail_minutes_job', async () => {
    const res = await POST(post(body()))
    expect(rpc).not.toHaveBeenCalled()
    expect(res.status).toBe(401)
  })

  it('an absent signature stops at the gate — the flag is never even read', async () => {
    // Not decoration: it pins WHERE the refusal happened. A route that reached the flag
    // gate and dropped there would also answer 401-free-of-RPCs on a flag-off day, and
    // would look identical to a working HMAC check.
    await POST(post(body()))
    expect(featureEnabledServerOnly).not.toHaveBeenCalled()
  })

  it('a BAD signature (attacker secret) does not reach either RPC', async () => {
    const raw = body()
    const res = await POST(post(raw, signedHeaders(raw, 'attacker-secret')))
    expect(rpc).not.toHaveBeenCalled()
    expect(res.status).toBe(401)
  })

  it('a body TAMPERED after signing does not reach either RPC', async () => {
    // The content-injection shape the ruling names: a valid signature harvested from a
    // real delivery, replayed over a forged ata draft.
    const raw = body()
    const headers = signedHeaders(raw)
    const tampered = raw.replace('CCIH', 'FORJADO')
    const res = await POST(post(tampered, headers))
    expect(rpc).not.toHaveBeenCalled()
    expect(res.status).toBe(401)
  })

  it('a STALE replay does not reach either RPC', async () => {
    const raw = body()
    const old = String(Math.floor(Date.now() / 1000) - 3600)
    const res = await POST(
      post(raw, { 'x-signature': signCallbackBody(raw, old, SECRET), 'x-timestamp': old }),
    )
    expect(rpc).not.toHaveBeenCalled()
    expect(res.status).toBe(401)
  })

  it('an unconfigured platform secret FAILS CLOSED — no RPC on the error arm either', async () => {
    // `status: 'error'` is the arm that reaches `fail_minutes_job`, so the deny half has
    // to be measured on it too and not inferred from the `done` arm.
    delete process.env.MINUTES_CALLBACK_HMAC_SECRET
    const raw = body({ status: 'error', result: null, error_code: 'audio_unreadable' })
    const res = await POST(post(raw, signedHeaders(raw, '')))
    expect(rpc).not.toHaveBeenCalled()
    expect(res.status).toBe(401)
  })

  it('a forged ERROR callback cannot fail another tenant job', async () => {
    const raw = body({ status: 'error', result: null, error_code: 'audio_unreadable' })
    const res = await POST(post(raw, signedHeaders(raw, 'attacker-secret')))
    expect(rpcNames()).toEqual([])
    expect(res.status).toBe(401)
  })
})

describe('R2 allow — the positive control, without which the deny half proves nothing', () => {
  it('a WELL-SIGNED done callback DOES reach complete_minutes_job with the signed job id', async () => {
    const raw = body()
    const res = await POST(post(raw, signedHeaders(raw)))
    expect(res.status).toBe(200)
    expect(rpcNames()).toEqual(['complete_minutes_job'])
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_job_id: JOB_ID })
  })

  it('a WELL-SIGNED error callback DOES reach fail_minutes_job', async () => {
    const raw = body({ status: 'error', result: null, error_code: 'audio_unreadable' })
    const res = await POST(post(raw, signedHeaders(raw)))
    expect(res.status).toBe(200)
    expect(rpcNames()).toEqual(['fail_minutes_job'])
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_job_id: JOB_ID })
  })

  it('the RPC path is reachable through the REAL handler, not a mock of it', async () => {
    // The whole point of this file. If `@/lib/minutes-jobs/webhook` were mocked the way
    // `route.test.ts` mocks it, this call count would be 0 and this test would fail —
    // which is what stops the deny assertions above from silently becoming vacuous.
    const raw = body()
    await POST(post(raw, signedHeaders(raw)))
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
