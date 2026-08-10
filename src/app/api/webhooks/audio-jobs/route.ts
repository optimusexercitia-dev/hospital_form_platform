import { NextResponse } from 'next/server'

import { verifyCallbackSignature } from '@/lib/audio-jobs/hmac'
import { parseAudioJobMetadata } from '@/lib/audio-jobs/metadata'
import type { CallbackPayload } from '@/lib/audio-jobs/types'
import { featureEnabledServerOnly } from '@/lib/queries/feature-flags'
import { handleMeetingMinutesCallback } from '@/lib/minutes-jobs/webhook'

/**
 * The audio-jobs callback endpoint (ADR 0099 D10/D18).
 *
 * PUBLICLY REACHABLE BY DESIGN — it is excluded from the session gate in `src/proxy.ts`
 * because the caller is a machine with no cookie. Its ONLY authorization is the HMAC
 * signature over the raw body, so `verifyCallbackSignature` is the security boundary here
 * and nothing below it may run before that check passes.
 *
 * Status-code policy, which is a contract with the service's retry logic rather than a
 * style choice:
 *   - **401** — signature/timestamp rejected. The service SHOULD retry; a genuine
 *     signature failure will keep failing, and a real replay attempt must not be told
 *     anything more specific than "no".
 *   - **200** — everything else, INCLUDING unusable payloads, unknown job kinds, an
 *     unknown job id, a flag that is off, and a re-delivery for an already-terminal job.
 *     Each of those is permanent: retrying cannot change the outcome, and answering 4xx
 *     would earn a retry storm from a service that is not at fault.
 *   - **503** — a TRANSIENT inability to decide, today only "the feature flags could not
 *     be read at all". The service SHOULD retry, because the next attempt may well
 *     succeed. This arm exists because the alternative — folding an unreadable flag into
 *     "off" and answering 200 — silently and permanently discards a delivery whose job is
 *     then unrecoverable (see the flag gate below).
 *   - **500** — never deliberately. A 500 is a bug in this handler.
 *
 * `dispatch on metadata.job_type` is what makes this ONE endpoint for every future audio
 * kind (D18): a `job_type` this platform version does not know is logged and 200-dropped,
 * so a newer service can never retry-storm an older platform.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

/** A uniform refusal. Deliberately says nothing about which check failed. */
function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}

/** A 200 that carries WHY we did nothing, for the server log and the E2E fixtures. */
function accepted(note: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, note, ...extra }, { status: 200 })
}

/** "I could not decide — ask again." The service's tenacity retry acts on this. */
function retryLater(note: string) {
  return NextResponse.json({ ok: false, note }, { status: 503 })
}

export async function POST(request: Request): Promise<Response> {
  // ⚠ The raw body FIRST, before any parsing. The signature covers the exact bytes the
  // service sent; `JSON.stringify(await request.json())` re-serializes with different key
  // order and whitespace and would never verify.
  const rawBody = await request.text()

  const verdict = verifyCallbackSignature(
    rawBody,
    request.headers.get('x-signature'),
    request.headers.get('x-timestamp'),
    { secret: process.env.MINUTES_CALLBACK_HMAC_SECRET ?? '' },
  )
  if (!verdict.ok) {
    console.warn('[audio-jobs] rejected callback:', verdict.reason)
    return unauthorized()
  }

  let payload: CallbackPayload
  try {
    payload = JSON.parse(rawBody) as CallbackPayload
  } catch {
    // Signed but unparseable: whoever sent it holds the secret, so this is a contract
    // break, not an attack. Retrying will not fix it.
    console.error('[audio-jobs] signed payload was not valid JSON')
    return accepted('unparseable body')
  }

  const metadata = parseAudioJobMetadata(payload?.metadata)
  if (!metadata) {
    console.error('[audio-jobs] payload carried no usable metadata')
    return accepted('missing or unknown metadata')
  }

  // The flag gate lives AFTER signature + parse so a flag-off deployment still logs which
  // job was dropped. The service is not at fault, so 200 — never a retry.
  //
  // ⚠ `featureEnabledServerOnly`, NOT `featureEnabled`. This caller is a MACHINE with no
  // cookie, so the ordinary reader's cookie client resolves as `anon` — where
  // `get_feature_flags` has no EXECUTE. It errored, safe-defaulted every flag to OFF, and
  // this route 200-dropped every real callback in production while the E2E suite stayed
  // green, because `page.request` posts with the browser's session attached. A flag read
  // on an unauthenticated surface must not go through the session client.
  const audioMinutesOn = await featureEnabledServerOnly('audio_minutes')
  if (audioMinutesOn === null) {
    // Unreadable ≠ off. Dropping here would be permanent, and the callback is the ONLY
    // carrier of the minutes + transcript: reconciliation polls status alone and will not
    // reconstruct them, so a 200 here loses the job for good.
    console.error(
      '[audio-jobs] could not read feature flags; asking the service to retry',
      metadata.platform_job_id,
    )
    return retryLater('flag read unavailable')
  }
  if (!audioMinutesOn) {
    console.warn('[audio-jobs] audio_minutes is OFF; dropping callback', metadata.platform_job_id)
    return accepted('feature disabled')
  }

  switch (metadata.job_type) {
    case 'meeting_minutes': {
      const outcome = await handleMeetingMinutesCallback(metadata.platform_job_id, payload)
      // Idempotency is the RPCs' status latch: a no-op is a success from the service's
      // point of view, so both branches answer 200 and the retry stops.
      return accepted(outcome.note, { updated: outcome.updated })
    }
    default:
      // Unreachable today (`parseAudioJobMetadata` validates against KNOWN_JOB_TYPES), and
      // kept as the D18 seam: a newer service sending `interview` lands here, is logged,
      // and is dropped — not retried forever against a platform that cannot handle it.
      console.warn('[audio-jobs] unknown job_type; dropping')
      return accepted('unknown job_type')
  }
}

/** Anything but POST. The service only ever POSTs; a GET here is a probe. */
export function GET() {
  return NextResponse.json({ error: 'method not allowed' }, { status: 405 })
}
