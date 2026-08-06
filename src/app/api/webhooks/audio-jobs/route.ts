import { NextResponse } from 'next/server'

import { verifyCallbackSignature } from '@/lib/audio-jobs/hmac'
import { parseAudioJobMetadata } from '@/lib/audio-jobs/metadata'
import type { CallbackPayload } from '@/lib/audio-jobs/types'
import { featureEnabled } from '@/lib/queries/feature-flags'
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
  if (!(await featureEnabled('audio_minutes'))) {
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
