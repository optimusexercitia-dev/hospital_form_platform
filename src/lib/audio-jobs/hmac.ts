import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Callback signature verification for the `minute_generator` webhook (ADR 0099 D10).
 *
 * This is the ONLY guard on `/api/webhooks/audio-jobs` — the route is publicly
 * reachable by design, so everything below is load-bearing.
 *
 * Scheme, transcribed from the service's `app/auth.py::sign_payload` (verified against
 * the deployed source, not inferred):
 *
 *     signed    = <timestamp> + "." + <raw body bytes>
 *     signature = "sha256=" + hex(HMAC-SHA256(secret, signed))
 *
 * carried as `X-Signature` / `X-Timestamp` (the service also sends `X-Job-Id`, which we
 * do not trust for routing — the job id we act on comes from the SIGNED body).
 *
 * ⚠ Three properties that are easy to lose in a refactor:
 *  1. The timestamp is signed WITH the body, not merely sent beside it. Verifying the
 *     body alone would let a captured callback be replayed forever under a fresh header.
 *  2. The signature covers the RAW BYTES. The route must read `await req.text()` BEFORE
 *     `JSON.parse` and verify against that exact string — re-serializing parsed JSON
 *     changes key order and whitespace and will never match.
 *  3. The comparison is constant-time. A byte-by-byte `===` on a hex digest leaks the
 *     correct prefix through timing.
 *
 * Pure and dependency-free (no env reads, no I/O) so it is unit-testable — the secret is
 * passed in by the caller.
 */

/** Default replay window, each side of the service's timestamp. */
export const DEFAULT_TOLERANCE_SECONDS = 300

/** Why a callback was rejected. Logged server-side; never surfaced to a user. */
export type SignatureFailure =
  | 'missing_signature'
  | 'missing_timestamp'
  | 'malformed_timestamp'
  | 'stale_timestamp'
  | 'future_timestamp'
  | 'malformed_signature'
  | 'mismatch'
  | 'missing_secret'

export type VerifyResult = { ok: true } | { ok: false; reason: SignatureFailure }

export interface VerifyOptions {
  /** Shared secret (`MINUTES_CALLBACK_HMAC_SECRET`). */
  secret: string
  /** Seconds of clock skew tolerated in each direction. Defaults to 5 min. */
  toleranceSeconds?: number
  /** Injectable clock (ms since epoch) — tests pin it; production omits it. */
  nowMs?: number
}

/**
 * Verify one callback. Returns a discriminated result rather than throwing so the route
 * can log the precise reason while answering a uniform 401.
 *
 * @param rawBody the EXACT request body string, read before any JSON parsing.
 */
export function verifyCallbackSignature(
  rawBody: string,
  signature: string | null | undefined,
  timestamp: string | null | undefined,
  options: VerifyOptions,
): VerifyResult {
  const { secret, toleranceSeconds = DEFAULT_TOLERANCE_SECONDS, nowMs = Date.now() } = options

  // A missing secret must FAIL CLOSED. Without this an unconfigured deployment would
  // compute HMAC over the empty string and happily accept anything that matched it.
  if (!secret) return { ok: false, reason: 'missing_secret' }
  if (!signature) return { ok: false, reason: 'missing_signature' }
  if (!timestamp) return { ok: false, reason: 'missing_timestamp' }

  // The service sends whole seconds as a decimal string. Anything else is not ours.
  if (!/^\d{1,15}$/.test(timestamp)) return { ok: false, reason: 'malformed_timestamp' }
  const sentSeconds = Number(timestamp)
  if (!Number.isFinite(sentSeconds)) return { ok: false, reason: 'malformed_timestamp' }

  const skewSeconds = Math.floor(nowMs / 1000) - sentSeconds
  if (skewSeconds > toleranceSeconds) return { ok: false, reason: 'stale_timestamp' }
  // A timestamp far in the FUTURE is rejected too: accepting it would let one captured
  // callback stay replayable for as long as the attacker cared to post-date it.
  if (-skewSeconds > toleranceSeconds) return { ok: false, reason: 'future_timestamp' }

  const expectedHex = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')

  // Accept the service's `sha256=` prefix; tolerate a bare hex digest so a hand-rolled
  // E2E fixture that omits the prefix is a test bug, not a mystery 401.
  const presented = signature.startsWith('sha256=') ? signature.slice('sha256='.length) : signature
  if (!/^[0-9a-fA-F]+$/.test(presented)) return { ok: false, reason: 'malformed_signature' }

  const a = Buffer.from(expectedHex, 'hex')
  const b = Buffer.from(presented.toLowerCase(), 'hex')
  // timingSafeEqual THROWS on a length mismatch, which would itself be an oracle (and a
  // 500 instead of a 401). Compare lengths first, then the bytes in constant time.
  if (a.length !== b.length) return { ok: false, reason: 'mismatch' }
  if (!timingSafeEqual(a, b)) return { ok: false, reason: 'mismatch' }

  return { ok: true }
}

/**
 * Produce a signature the way the service does. Used ONLY by tests and by the E2E
 * fixtures that POST a synthetic callback (D16) — never on a production path.
 */
export function signCallbackBody(rawBody: string, timestamp: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`
}
