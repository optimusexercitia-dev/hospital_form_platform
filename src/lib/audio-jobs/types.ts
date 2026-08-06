/**
 * The `minute_generator` service contract, mirrored in TypeScript (ADR 0099 D18;
 * service ADR 0006 — the job-type-discriminated contract v2).
 *
 * SOURCE OF TRUTH is the service's `app/schemas.py`. Everything here was transcribed
 * from it on 2026-08-06 at **`SCHEMA_VERSION = "2.1"`**.
 *
 * ⚠ The platform plan says the contract is `2.0`. It is **2.1** — the service's ADR 0007
 * added the `metrics` block (numbers only, no meeting content) additively. Minor is
 * additive by the service's own versioning rule, so a 2.0 consumer keeps working; this
 * mirror simply carries `metrics` as optional rather than pretending it does not exist.
 *
 * This module is KIND-AGNOSTIC by design (D18): it knows about `job_type` and the
 * envelope, never about meetings. The meeting-specific normalization lives in
 * `src/lib/minutes-jobs/`. Adding a kind here means one enum member plus a
 * context/result pair — never a new field on the envelope.
 */

/** The `schema_version` this mirror was transcribed against. */
export const MIRRORED_SCHEMA_VERSION = '2.1'

/** Discriminator. Only `meeting_minutes` exists today (service `JobType`). */
export type JobType = 'meeting_minutes'

/** Service-side lifecycle (`JobStatus`). Distinct from our own `audio_job_status`. */
export type ServiceJobStatus = 'queued' | 'processing' | 'done' | 'error' | 'cancelled'

/**
 * Coarse failure kind (`ErrorCode`). Everything except `transient` is terminal on the
 * first attempt — retrying cannot change the outcome.
 */
export type ServiceErrorCode =
  | 'audio_unreachable'
  | 'audio_unreadable'
  | 'llm_output_invalid'
  | 'unsupported_job_type'
  | 'transient'

// --- request side -----------------------------------------------------------

/** Someone we expect at the meeting. `ref` is opaque to the service (service ADR 0001). */
export interface ServiceAttendee {
  ref: string
  name: string
  role?: string | null
}

/**
 * An agenda item authored before the meeting.
 *
 * ⚠ `description` EXISTS in the service's `AgendaRef` and we deliberately **never send
 * it** (D14, minimum-necessary: titles only — the substance tier stays home). It is
 * declared here as `never` rather than omitted so that a future edit which tries to
 * populate it fails to compile instead of silently exfiltrating agenda substance.
 */
export interface ServiceAgendaRef {
  ref: string
  title: string
  description?: never
}

/** `job_type = meeting_minutes`'s inbound context (`MeetingMinutesContext`). */
export interface MeetingMinutesContext {
  committee_name: string
  /** ISO 8601. Anchors relative deadlines ("em duas semanas"). */
  meeting_date: string | null
  attendees: ServiceAttendee[]
  agenda: ServiceAgendaRef[]
  template_sections?: string[] | null
}

/** The inbound context union — one member per {@link JobType}. */
export type JobContext = MeetingMinutesContext

export interface AudioJobRequest<TContext = JobContext> {
  job_type: JobType
  audio_url: string
  callback_url: string
  context: TContext
  /** Opaque passthrough, echoed on the callback. See `./metadata.ts`. */
  metadata: Record<string, string>
}

/** `POST /jobs` → 202. */
export interface JobAccepted {
  job_id: string
  status: ServiceJobStatus
}

/** `POST /jobs/{id}/cancel` → 202. `status` is null for a job the service never saw. */
export interface JobCancellation {
  job_id: string
  status: ServiceJobStatus | null
}

/** `GET /jobs/{id}` — coarse status for reconciliation. The callback stays the authority. */
export interface JobState {
  job_id: string
  status: ServiceJobStatus
  stage?: string | null
  error?: string | null
  error_code?: ServiceErrorCode | null
}

// --- result side ------------------------------------------------------------

/**
 * What the audio supports about one expected attendee. `spoke` is the ONLY claim —
 * the service deliberately says nothing about presence, which is quorum-bearing
 * (service ADR 0002 / D12).
 */
export interface SpeakerAttribution {
  ref: string
  spoke: boolean
  confidence?: number | null
  evidence?: string | null
}

/** A separated voice the service could not tie to any attendee ref. */
export interface UnidentifiedSpeaker {
  label: string
  utterances: number
}

/** `ref` is null exactly when the topic was raised on the day. */
export interface MinutesAgendaItem {
  ref?: string | null
  title: string
  /** NOTE the field name: `discussion`, not `discussion_notes` (which is OUR column). */
  discussion: string
}

/**
 * One decision.
 *
 * ⚠ `agenda_item_index` is an **INDEX into `Minutes.agenda_items`**, not a ref and not
 * our `meeting_agenda_items.id`. The service already nulls a dangling index before
 * sending. Folding resolutions back onto agenda items is the normalizer's job.
 */
export interface Resolution {
  text: string
  agenda_item_index?: number | null
}

export interface ServiceActionItem {
  title: string
  description?: string | null
  owner_ref?: string | null
  owner_text?: string | null
  /** `YYYY-MM-DD`, or null when unparseable — `deadline_text` survives either way. */
  due_date?: string | null
  deadline_text?: string | null
}

/** Advisory only (D7). The platform pre-fills a form with this; it never schedules. */
export interface NextMeeting {
  starts_at?: string | null
  location_text?: string | null
  raw?: string | null
}

/** The service's one deliverable. */
export interface Minutes {
  committee: string
  attendees: SpeakerAttribution[]
  unidentified_speakers: UnidentifiedSpeaker[]
  agenda_items: MinutesAgendaItem[]
  resolutions: Resolution[]
  action_items: ServiceActionItem[]
  next_meeting?: NextMeeting | null
  summary?: string | null
  /**
   * The formal ata as Markdown (service ADR 0004).
   *
   * ⚠ **Optional on purpose, service-side**: a missing narrative must not fail an hour
   * of transcription when every structured part is good. The platform's plan and UI
   * brief both read as if it is always present — it is not, and the normalizer falls
   * back rather than writing `"undefined"` into the ata.
   */
  minutes_md?: string | null
}

export interface MeetingMinutesResult {
  minutes: Minutes
  transcript: string
}

/** The outbound result union — one member per {@link JobType}. */
export type JobResult = MeetingMinutesResult

/** Per-job timings and token spend (service ADR 0007). Numbers only, never content. */
export interface JobMetrics {
  total_seconds?: number
  audio_seconds?: number | null
  stage_seconds?: Record<string, number>
  llm_total?: Record<string, number>
  asr_backend?: string | null
  llm_model?: string | null
  transcript_words?: number | null
  transcript_segments?: number | null
  speaker_count?: number | null
  failed_stage?: string | null
  error_code?: ServiceErrorCode | null
}

/** The signed callback envelope. */
export interface CallbackPayload {
  schema_version: string
  job_id: string
  job_type: JobType
  status: ServiceJobStatus
  metadata: Record<string, string>
  /**
   * False while something downstream (the service's shadow comparison) still needs the
   * audio: the platform must NOT delete the object until this is true (service ADR 0003).
   */
  audio_release: boolean
  /** Present exactly when `status` is `done`; its shape follows `job_type`. */
  result?: JobResult | null
  metrics?: JobMetrics | null
  error?: string | null
  error_code?: ServiceErrorCode | null
}
