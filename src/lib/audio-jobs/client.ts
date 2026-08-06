import 'server-only'

import type { AudioJobRequest, JobAccepted, JobCancellation, JobState } from './types'

/**
 * HTTP client for the `minute_generator` service (ADR 0099 D18) — kind-agnostic: it
 * knows the envelope and the three endpoints, never anything about meetings.
 *
 * Every function returns a discriminated result and NEVER throws a raw fetch/network
 * error upward: the callers are server actions and a webhook route whose job is to leave
 * a pt-BR message in `ActionState.error`, and an unhandled `TypeError: fetch failed`
 * there becomes a 500 with a stack trace in the user's face (Rule 10).
 *
 * Endpoints (service `app/main.py`, verified):
 *   POST /jobs               → 202 JobAccepted
 *   POST /jobs/{id}/cancel   → 202 JobCancellation
 *   GET  /jobs/{id}          → 200 JobState
 * all behind `Authorization: Bearer <MINUTES_SERVICE_API_KEY>`.
 */

export type AudioJobClientFailure =
  | 'not_configured'
  | 'unreachable'
  | 'timeout'
  | 'unauthorized'
  | 'rejected'
  | 'server_error'
  | 'malformed_response'

export type AudioJobResult<T> =
  | { ok: true; data: T }
  | { ok: false; failure: AudioJobClientFailure; status?: number; detail?: string }

/** Submit timeout. The service answers 202 immediately — it queues, it does not process. */
const SUBMIT_TIMEOUT_MS = 20_000
const POLL_TIMEOUT_MS = 15_000

interface ServiceConfig {
  baseUrl: string
  apiKey: string
}

/**
 * Read config at CALL time, not module load. A module-level read is evaluated during the
 * Next.js build, where these vars are absent — which would bake `undefined` into the
 * bundle and fail at runtime with no useful message.
 */
function readConfig(): ServiceConfig | null {
  const baseUrl = process.env.MINUTES_SERVICE_URL
  const apiKey = process.env.MINUTES_SERVICE_API_KEY
  if (!baseUrl || !apiKey) return null
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey }
}

async function call<T>(
  path: string,
  init: { method: 'GET' | 'POST'; body?: unknown; timeoutMs: number },
): Promise<AudioJobResult<T>> {
  const config = readConfig()
  if (!config) return { ok: false, failure: 'not_configured' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), init.timeoutMs)
  let response: Response
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
      // The service is a stateful job API; a cached 202 would be a disaster.
      cache: 'no-store',
    })
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return { ok: false, failure: aborted ? 'timeout' : 'unreachable' }
  } finally {
    clearTimeout(timer)
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, failure: 'unauthorized', status: response.status }
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    return {
      ok: false,
      failure: response.status >= 500 ? 'server_error' : 'rejected',
      status: response.status,
      // Truncated: this is for the server log, and the service's 422 bodies are verbose.
      detail: detail.slice(0, 500),
    }
  }

  try {
    return { ok: true, data: (await response.json()) as T }
  } catch {
    return { ok: false, failure: 'malformed_response', status: response.status }
  }
}

/** `POST /jobs`. The caller composes the kind-specific `context` and `metadata`. */
export async function submitAudioJob(
  request: AudioJobRequest,
): Promise<AudioJobResult<JobAccepted>> {
  return call<JobAccepted>('/jobs', {
    method: 'POST',
    body: request,
    timeoutMs: SUBMIT_TIMEOUT_MS,
  })
}

/**
 * `POST /jobs/{id}/cancel` (service ADR 0005).
 *
 * A 404 is **success**, not a failure: the platform cancels blind during reconciliation
 * and a job the service has already forgotten is exactly as cancelled as one it just
 * dequeued. Collapsing it here keeps that rule in ONE place instead of at each call site
 * (D9 — cancel must work even with the service down).
 */
export async function cancelAudioJob(
  serviceJobId: string,
): Promise<AudioJobResult<JobCancellation>> {
  const result = await call<JobCancellation>(
    `/jobs/${encodeURIComponent(serviceJobId)}/cancel`,
    { method: 'POST', timeoutMs: POLL_TIMEOUT_MS },
  )
  if (!result.ok && result.status === 404) {
    return { ok: true, data: { job_id: serviceJobId, status: null } }
  }
  return result
}

/** `GET /jobs/{id}` — the lazy-reconciliation poll (D10). */
export async function getAudioJobStatus(
  serviceJobId: string,
): Promise<AudioJobResult<JobState>> {
  return call<JobState>(`/jobs/${encodeURIComponent(serviceJobId)}`, {
    method: 'GET',
    timeoutMs: POLL_TIMEOUT_MS,
  })
}

/** Whether the service is configured at all — lets callers degrade instead of erroring. */
export function isAudioServiceConfigured(): boolean {
  return readConfig() !== null
}
