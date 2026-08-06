import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'

import { signCallbackBody, verifyCallbackSignature } from './hmac'

/**
 * T2 — callback signature verification (ADR 0099 D10).
 *
 * This is the ONLY guard on a publicly reachable route, so these are security tests, not
 * unit hygiene. Each one names the attack it prevents.
 */

const SECRET = 'test-secret-value'
// Deliberately carries insignificant whitespace: it is what makes the
// "re-serialized body" case below observable, and a real HTTP body is whatever
// bytes the sender chose, not whatever `JSON.stringify` would have produced.
const BODY = '{"job_id": "abc", "status": "done", "metadata": {"platform_job_id": "x"}}'
const NOW_MS = 1_800_000_000_000
const NOW_S = String(Math.floor(NOW_MS / 1000))

const opts = (extra: Partial<Parameters<typeof verifyCallbackSignature>[3]> = {}) => ({
  secret: SECRET,
  nowMs: NOW_MS,
  ...extra,
})

describe('verifyCallbackSignature — the happy path', () => {
  it('accepts a signature produced exactly as the service produces it', () => {
    const signature = signCallbackBody(BODY, NOW_S, SECRET)
    expect(verifyCallbackSignature(BODY, signature, NOW_S, opts())).toEqual({ ok: true })
  })

  it("matches the service's documented scheme byte-for-byte", () => {
    // Transcribed from `minute_generator/app/auth.py::sign_payload`:
    //   signed = timestamp.encode() + b"." + body ; "sha256=" + hexdigest
    // Recomputed here INDEPENDENTLY of our own signer, so this test would still fail if
    // signCallbackBody and verifyCallbackSignature drifted together.
    const expected =
      'sha256=' + createHmac('sha256', SECRET).update(`${NOW_S}.${BODY}`).digest('hex')
    expect(signCallbackBody(BODY, NOW_S, SECRET)).toBe(expected)
    expect(verifyCallbackSignature(BODY, expected, NOW_S, opts())).toEqual({ ok: true })
  })

  it('accepts a bare hex digest without the sha256= prefix', () => {
    const bare = createHmac('sha256', SECRET).update(`${NOW_S}.${BODY}`).digest('hex')
    expect(verifyCallbackSignature(BODY, bare, NOW_S, opts())).toEqual({ ok: true })
  })
})

describe('verifyCallbackSignature — refusals', () => {
  it('FAILS CLOSED when the secret is unset', () => {
    // The deployment hazard: with no secret an implementation that HMACs the empty
    // string would accept anything matching it. Unconfigured must mean closed.
    const signature = signCallbackBody(BODY, NOW_S, '')
    expect(verifyCallbackSignature(BODY, signature, NOW_S, opts({ secret: '' }))).toEqual({
      ok: false,
      reason: 'missing_secret',
    })
  })

  it('rejects a missing signature or timestamp', () => {
    expect(verifyCallbackSignature(BODY, null, NOW_S, opts())).toEqual({
      ok: false,
      reason: 'missing_signature',
    })
    expect(verifyCallbackSignature(BODY, signCallbackBody(BODY, NOW_S, SECRET), null, opts())).toEqual(
      { ok: false, reason: 'missing_timestamp' },
    )
  })

  it('rejects a garbled signature without throwing', () => {
    expect(verifyCallbackSignature(BODY, 'sha256=not-hex-at-all', NOW_S, opts())).toEqual({
      ok: false,
      reason: 'malformed_signature',
    })
  })

  it('rejects a WRONG-LENGTH digest as a mismatch, never as a crash', () => {
    // timingSafeEqual THROWS on unequal lengths. Un-guarded that is a 500 instead of a
    // 401 — and a 500-vs-401 split is itself an oracle.
    expect(verifyCallbackSignature(BODY, 'sha256=abcd', NOW_S, opts())).toEqual({
      ok: false,
      reason: 'mismatch',
    })
  })

  it('rejects a signature made with a different secret', () => {
    const forged = signCallbackBody(BODY, NOW_S, 'some-other-secret')
    expect(verifyCallbackSignature(BODY, forged, NOW_S, opts())).toEqual({
      ok: false,
      reason: 'mismatch',
    })
  })

  it('rejects a non-numeric timestamp', () => {
    const signature = signCallbackBody(BODY, 'yesterday', SECRET)
    expect(verifyCallbackSignature(BODY, signature, 'yesterday', opts())).toEqual({
      ok: false,
      reason: 'malformed_timestamp',
    })
  })
})

describe('verifyCallbackSignature — replay resistance', () => {
  it('rejects a STALE timestamp beyond the window', () => {
    const old = String(Math.floor(NOW_MS / 1000) - 3600)
    const signature = signCallbackBody(BODY, old, SECRET)
    expect(verifyCallbackSignature(BODY, signature, old, opts())).toEqual({
      ok: false,
      reason: 'stale_timestamp',
    })
  })

  it('rejects a FUTURE timestamp beyond the window', () => {
    // Without this arm one captured callback stays replayable for as long as the
    // attacker cares to post-date it — the stale check alone does not close that.
    const future = String(Math.floor(NOW_MS / 1000) + 3600)
    const signature = signCallbackBody(BODY, future, SECRET)
    expect(verifyCallbackSignature(BODY, signature, future, opts())).toEqual({
      ok: false,
      reason: 'future_timestamp',
    })
  })

  it('accepts a timestamp at the edges of the window and rejects just outside', () => {
    const at = (offset: number) => {
      const ts = String(Math.floor(NOW_MS / 1000) + offset)
      return verifyCallbackSignature(BODY, signCallbackBody(BODY, ts, SECRET), ts, opts())
    }
    expect(at(-300)).toEqual({ ok: true })
    expect(at(300)).toEqual({ ok: true })
    expect(at(-301)).toEqual({ ok: false, reason: 'stale_timestamp' })
    expect(at(301)).toEqual({ ok: false, reason: 'future_timestamp' })
  })

  it('a replayed body+signature under a FRESH timestamp header does NOT verify', () => {
    // THE reason the timestamp is signed with the body rather than merely sent beside it.
    // An attacker who captured a valid callback swaps in a current timestamp to defeat
    // the staleness check; the signature must then stop matching.
    const captured = signCallbackBody(BODY, String(Math.floor(NOW_MS / 1000) - 10_000), SECRET)
    expect(verifyCallbackSignature(BODY, captured, NOW_S, opts())).toEqual({
      ok: false,
      reason: 'mismatch',
    })
  })
})

describe('verifyCallbackSignature — byte-exact body sensitivity', () => {
  const signature = signCallbackBody(BODY, NOW_S, SECRET)

  it.each([
    ['one flipped character', BODY.replace('done', 'dane')],
    ['a trailing newline', `${BODY}\n`],
    ['inserted whitespace', BODY.replace('{"job_id"', '{ "job_id"')],
    ['an empty body', ''],
  ])('rejects %s', (_label, tampered) => {
    expect(verifyCallbackSignature(tampered, signature, NOW_S, opts())).toEqual({
      ok: false,
      reason: 'mismatch',
    })
  })

  it('rejects a body that is semantically identical but re-serialized', () => {
    // The route MUST verify against `await request.text()`. This is what happens if
    // someone "cleans up" by verifying `JSON.stringify(await request.json())`: same
    // meaning, different bytes, never verifies.
    const reserialized = JSON.stringify(JSON.parse(BODY))
    expect(reserialized).not.toBe(BODY)
    expect(verifyCallbackSignature(reserialized, signature, NOW_S, opts())).toEqual({
      ok: false,
      reason: 'mismatch',
    })
  })
})
