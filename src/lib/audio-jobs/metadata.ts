import type { JobType } from './types'

/**
 * The opaque `metadata` passthrough every service job carries (ADR 0099 D18).
 *
 * The service never reads it — it echoes it back on the callback. That makes it the
 * platform's ONLY routing information: `job_type` selects the owning module's handler,
 * and `platform_job_id` names the row to write. Both come from the SIGNED body, never
 * from a header (`X-Job-Id` is the service's id, not ours, and is unauthenticated for
 * our purposes).
 *
 * The service types this as `dict[str, str]`, so every value must be a string.
 */

export const KNOWN_JOB_TYPES: readonly JobType[] = ['meeting_minutes'] as const

export interface AudioJobMetadata {
  /** OUR job row's uuid (e.g. `meeting_minutes_jobs.id`). */
  platform_job_id: string
  job_type: JobType
}

export function buildAudioJobMetadata(meta: AudioJobMetadata): Record<string, string> {
  return { platform_job_id: meta.platform_job_id, job_type: meta.job_type }
}

/**
 * Parse the echoed metadata back.
 *
 * Returns `null` for anything unusable rather than throwing: an unparseable callback is
 * answered 200-and-dropped, not retried (a newer service must never retry-storm an older
 * platform), and the route needs a plain branch for that.
 *
 * `job_type` is validated against {@link KNOWN_JOB_TYPES} rather than cast, so a future
 * `interview` job arriving at a platform that cannot handle it is a clean unknown-kind
 * drop instead of a handler dispatched on a string it never expected.
 */
export function parseAudioJobMetadata(
  metadata: unknown,
): { platform_job_id: string; job_type: JobType } | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const record = metadata as Record<string, unknown>

  const jobId = record.platform_job_id
  const jobType = record.job_type
  if (typeof jobId !== 'string' || !isUuid(jobId)) return null
  if (typeof jobType !== 'string') return null
  if (!KNOWN_JOB_TYPES.includes(jobType as JobType)) return null

  return { platform_job_id: jobId, job_type: jobType as JobType }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The job id is fed straight into an RPC's `uuid` parameter. Validating the shape here
 * means a malformed value is a clean 200-drop instead of a Postgres `22P02` surfacing as
 * a 500 (and a retry storm).
 */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}
