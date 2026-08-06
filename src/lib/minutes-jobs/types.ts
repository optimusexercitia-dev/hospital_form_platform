import type { MeetingStatus } from '@/lib/queries/meetings'

/**
 * MIN domain types — the review working copy and the job summaries the UI renders
 * (ADR 0099 D4/D12; the contract in `docs/design/audio-minutes-ui.md` §3).
 *
 * `MinutesDraft` is the single most load-bearing shape in the feature: the webhook
 * normalizer produces it, F3 edits it, `save_minutes_draft` stores it verbatim, and
 * `apply_minutes_review` reads it in SQL. **The SQL side is the authority** — the field
 * names below match the draft contract documented in the `apply_minutes_review` header
 * (migration `20260910000200`) exactly. Renaming a field here without changing the RPC
 * silently makes apply a no-op: it reads `draft->'agenda'`, finds nothing, and writes
 * nothing while reporting success.
 *
 * ⚠ Two corrections against the design brief's §3.2, both forced by the SQL contract:
 *   - the agenda array is `agenda`, not `agenda_items` (that is what apply reads);
 *   - each agenda/action entry carries `ref`/`agenda_ref`, and apply resolves them —
 *     `owner_ref`, `existing_*` and `speakers` are DISPLAY-ONLY and apply ignores them.
 */

/** Mirrors `public.audio_job_status` (D18's shared vocabulary). */
export type MinutesJobStatus =
  | 'uploading'
  | 'processing'
  | 'done'
  | 'failed'
  | 'cancelled'
  | 'applied'

/** What F1's slot and F4's badge render. */
export interface MinutesJobSummary {
  id: string
  meetingId: string
  status: MinutesJobStatus
  /** ISO timestamp — F1's elapsed-time basis for the uploading/processing chip. */
  createdAt: string
  /** Already pt-BR (never a raw SQLSTATE or service string). `null` unless `failed`. */
  errorMessage: string | null
}

// --- the review working copy ------------------------------------------------

export interface MinutesDraftAgendaItem {
  /** Client-stable React key. NOT a database id. */
  key: string
  /**
   * The `meeting_agenda_items.id` this entry matches, or `null` when raised on the day.
   * A ref that has gone DANGLING (row deleted mid-review) degrades to a create, exactly
   * like `null` — the UI need not distinguish them.
   */
  ref: string | null
  /** Authoritative when `ref` is null. Apply never rewrites a matched item's title. */
  title: string
  /** Existing text, for the side-by-side overwrite view (D6). Display-only. */
  existing_discussion_notes: string | null
  existing_resolution: string | null
  discussion_notes: string
  resolution: string | null
  /** Apply skips the entry entirely when `false`. */
  include: boolean
}

export interface MinutesDraftActionItem {
  key: string
  title: string
  description: string
  /**
   * A COMMISSION-MEMBER user id, or `null`. F3's owner select offers only commission
   * members; an id that fails `app.is_member_of_for` is silently downgraded to
   * unassigned by apply (PO decision O2) rather than aborting the whole transaction.
   */
  assigned_to: string | null
  /** The attendee ref the service resolved. Display context only — apply ignores it. */
  owner_ref: string | null
  owner_text: string | null
  /** `YYYY-MM-DD` or null. */
  due_date: string | null
  deadline_text: string | null
  /** The agenda entry this action hangs off — matched against THIS meeting by apply. */
  agenda_ref: string | null
  include: boolean
}

/** Advisory only (D7): displayed post-apply, never scheduled, never read by apply. */
export interface MinutesDraftNextMeeting {
  suggested_date: string | null
  location_text: string | null
  note: string | null
}

/** Display-only (D12) — never writes attendance; the audio cannot prove presence. */
export interface MinutesDraftSpeaker {
  label: string
  /** Resolved attendee id, or `null` for an unidentified voice. */
  attendee_ref: string | null
  utterance_count: number
  /** True only for a resolved attendee the service heard speak. */
  spoke: boolean
}

/**
 * A resolution the service could not tie to an agenda item (D6).
 *
 * The service's `Resolution.agenda_item_index` is a POSITIONAL index into its own
 * `agenda_items`; when it is null or out of range the decision has no agenda home. D6
 * says such a resolution stays attachable on the review page — F3 moves its text into an
 * agenda entry's `resolution` and drops it from this array. Apply ignores the key.
 */
export interface MinutesDraftLooseResolution {
  key: string
  text: string
}

export interface MinutesDraft {
  minutes_md: string
  /** ⚠ `agenda`, not `agenda_items` — this is the key `apply_minutes_review` reads. */
  agenda: MinutesDraftAgendaItem[]
  action_items: MinutesDraftActionItem[]
  next_meeting: MinutesDraftNextMeeting | null
  speakers: MinutesDraftSpeaker[]
  /**
   * Index-less resolutions awaiting attachment (D6).
   *
   * ⚠ This lives on `MinutesDraft` — the ROUND-TRIP type — and not beside it on
   * `MinutesReviewData`, because `save_minutes_draft` is a whole-column OVERWRITE
   * (`update … set draft = p_draft`, no merge). Anything the review page holds outside
   * the draft object is destroyed by the first autosave a few seconds after the page
   * opens. Keeping it here makes the round trip safe by construction; a sibling field
   * would have to be threaded through save separately, which is the same bug one layer
   * up.
   */
  unassigned_resolutions: MinutesDraftLooseResolution[]
}

// --- the review page's server payload ---------------------------------------

export interface MinutesReviewData {
  job: {
    id: string
    meetingId: string
    status: MinutesJobStatus
    createdAt: string
  }
  meeting: {
    id: string
    commissionId: string
    status: MeetingStatus
    /** CURRENT `minutes_md` — the overwrite-warning diff (D5). */
    minutesMd: string | null
    title: string
    meetingNumber: number
  }
  draft: MinutesDraft
}

/** The counts `apply_minutes_review` returns, for the confirm dialog + success banner. */
export interface MinutesApplyCounts {
  agendaUpdated: number
  agendaCreated: number
  actionsCreated: number
  actionsUnassigned: number
}
