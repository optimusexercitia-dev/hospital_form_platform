/**
 * MIN shared constants (ADR 0099 D2/D3).
 *
 * ⚠ The bucket's real ceilings live in the DATABASE (`storage.buckets.file_size_limit` =
 * 524288000, plus 15 `allowed_mime_types`), set by migration `20260910000100`. The values
 * here are the CLIENT-SIDE mirror used for a friendly pt-BR rejection before a 500 MB
 * upload starts — they are a courtesy, never the control (Rule 1). If they drift, the
 * bucket still refuses; the user just gets a worse message after a long wait.
 */

export const MEETING_AUDIO_BUCKET = 'meeting-audio'

/** 500 MB, matching `storage.buckets.file_size_limit` exactly. */
export const MAX_AUDIO_BYTES = 524_288_000

/**
 * Mirror of the bucket's `allowed_mime_types`. Includes `audio/x-m4a` — Windows/Chrome
 * reports that for `.m4a` from the OS registry rather than `audio/mp4`, and rejecting the
 * single most likely phone-recording container would fail on the first real recording.
 */
export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
  'audio/ogg',
  'audio/opus',
  'audio/webm',
  'audio/flac',
  'audio/x-flac',
] as const

/** The `accept` attribute for F2's file input. Extensions too: some OSes send no type. */
export const AUDIO_ACCEPT_ATTRIBUTE =
  [...ALLOWED_AUDIO_MIME_TYPES, '.m4a', '.aac', '.mp3', '.wav', '.ogg', '.opus', '.webm', '.flac'].join(',')

export function isAllowedAudioType(contentType: string): boolean {
  return (ALLOWED_AUDIO_MIME_TYPES as readonly string[]).includes(contentType.toLowerCase())
}

/**
 * Signed DOWNLOAD-URL lifetime handed to the service, in seconds (6 h).
 *
 * Must exceed the service's `JOB_TIMEOUT_SECONDS` plus queue headroom: the service
 * downloads when the worker picks the job up, which may be long after submission. Too
 * short and a queued job fails with `audio_unreachable` for no reason.
 */
export const AUDIO_DOWNLOAD_URL_TTL_SECONDS = 6 * 60 * 60

/** D2's hard TTL: audio is deleted at 24 h no matter what state the job is in. */
export const AUDIO_TTL_HOURS = 24

/** D10: a `processing` job older than this gets a reconciliation poll on the next page load. */
export const RECONCILE_AFTER_HOURS = 3

/** An `uploading` row idle this long never had its bytes finish; it blocks the meeting. */
export const ABANDONED_UPLOAD_HOURS = 2
