import type { MeetingMinutesResult, Minutes } from '@/lib/audio-jobs/types'
import type {
  MinutesDraft,
  MinutesDraftActionItem,
  MinutesDraftAgendaItem,
  MinutesDraftLooseResolution,
  MinutesDraftSpeaker,
} from './types'

/**
 * Service `Minutes` → the review working copy (`MinutesDraft`).
 *
 * Pure and dependency-free (every lookup is injected) so T2 can exercise it without a
 * database. Called once, by the webhook, to seed `draft` — after that the draft belongs
 * to the reviewer.
 *
 * The four shape mismatches this bridges, all confirmed against the service's
 * `app/schemas.py` at `schema_version` 2.1:
 *
 *  1. **`minutes_md` is OPTIONAL service-side.** A missing narrative must not fail an
 *     hour of transcription, so the service sends `null` rather than erroring. We fall
 *     back to `summary`, then to empty — never to the string `"undefined"`, which is
 *     what a naive `String(minutes.minutes_md)` would write into the ata.
 *  2. **Resolutions are a SEPARATE list keyed by `agenda_item_index`** — a positional
 *     index into `agenda_items`, not a ref and not our `meeting_agenda_items.id`. They
 *     are folded onto their agenda entry here.
 *  3. **An index-less resolution has no home.** D6 says it stays attachable on the
 *     review page; dropping it loses a recorded decision. It is carried in
 *     `unassigned_resolutions` for F3 to attach (apply ignores that key).
 *  4. **Speakers come from two lists** — `attendees` (`SpeakerAttribution`) and
 *     `unidentified_speakers` — merged into one display-only array (D12).
 */

export interface NormalizeContext {
  /**
   * Attendee ref → the platform user id to pre-assign, or `null`.
   *
   * The caller passes ONLY attendees who are commission members (B0 §4 R2): the
   * action-items door rejects anyone else with HC021, and though apply downgrades rather
   * than aborting, seeding a non-member here would show the reviewer an owner that
   * silently vanishes on apply.
   */
  resolveOwnerUserId: (attendeeRef: string) => string | null
  /** Attendee ref → display name, for the speakers panel. */
  resolveAttendeeName: (attendeeRef: string) => string | null
  /** Stable key factory. Injected so tests get deterministic keys. */
  makeKey: (prefix: string, index: number) => string
}

export const defaultMakeKey = (prefix: string, index: number): string => `${prefix}-${index}`

/**
 * A resolution the service could not tie to an agenda item (D6).
 *
 * Re-exported from `./types` rather than declared here. It used to be a WRITE-SIDE LOCAL
 * type, which is precisely how `unassigned_resolutions` came to be missing from
 * `MinutesDraft`: the normalizer produced it, the column stored it, and the read side —
 * which only knew `MinutesDraft` — rebuilt the draft without it. Since
 * `save_minutes_draft` overwrites the whole column, the first autosave then destroyed it.
 * A round-tripped field must live on the round-trip type.
 */
export type LooseResolution = MinutesDraftLooseResolution

/**
 * What the normalizer produces. Now exactly `MinutesDraft` — the alias is kept because
 * callers name it, and because it documents that the normalizer owes the FULL draft
 * shape, not a subset the read side has to re-derive.
 */
export type NormalizedDraft = MinutesDraft

export function normalizeMinutesResult(
  result: MeetingMinutesResult,
  context: NormalizeContext,
): NormalizedDraft {
  const minutes = result.minutes
  return normalizeMinutes(minutes, context)
}

export function normalizeMinutes(minutes: Minutes, context: NormalizeContext): NormalizedDraft {
  const { resolveOwnerUserId, resolveAttendeeName, makeKey } = context

  const agendaItems = Array.isArray(minutes.agenda_items) ? minutes.agenda_items : []
  const resolutions = Array.isArray(minutes.resolutions) ? minutes.resolutions : []

  // (2) Fold resolutions onto their agenda entry by INDEX. Several resolutions may point
  // at one item; they are joined rather than last-write-wins, because each is a decision.
  const byIndex = new Map<number, string[]>()
  const loose: LooseResolution[] = []
  resolutions.forEach((resolution, i) => {
    const text = (resolution?.text ?? '').trim()
    if (!text) return
    const index = resolution.agenda_item_index
    if (typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < agendaItems.length) {
      const bucket = byIndex.get(index)
      if (bucket) bucket.push(text)
      else byIndex.set(index, [text])
    } else {
      // (3) No home — carried, never dropped.
      loose.push({ key: makeKey('res', i), text })
    }
  })

  const agenda: MinutesDraftAgendaItem[] = agendaItems.map((item, i) => ({
    key: makeKey('agenda', i),
    ref: typeof item?.ref === 'string' && item.ref.length > 0 ? item.ref : null,
    title: (item?.title ?? '').trim(),
    // Filled at READ time by `getMinutesJobForReview` from the LIVE agenda rows, not
    // frozen here: the meeting's own text can change between the callback and the
    // review, and the overwrite warning must show what is actually about to be replaced.
    existing_discussion_notes: null,
    existing_resolution: null,
    discussion_notes: (item?.discussion ?? '').trim(),
    resolution: byIndex.get(i)?.join('\n\n') ?? null,
    include: true,
  }))

  const serviceActions = Array.isArray(minutes.action_items) ? minutes.action_items : []
  const action_items: MinutesDraftActionItem[] = serviceActions
    .filter((item) => (item?.title ?? '').trim().length > 0)
    .map((item, i) => {
      const ownerRef = typeof item.owner_ref === 'string' && item.owner_ref ? item.owner_ref : null
      return {
        key: makeKey('action', i),
        title: (item.title ?? '').trim(),
        description: (item.description ?? '').trim(),
        assigned_to: ownerRef ? resolveOwnerUserId(ownerRef) : null,
        owner_ref: ownerRef,
        owner_text: nullIfBlank(item.owner_text),
        due_date: normalizeDate(item.due_date),
        deadline_text: nullIfBlank(item.deadline_text),
        // The service's ActionItem carries NO agenda back-reference (verified against
        // `app/schemas.py`) — F3 lets the reviewer attach one.
        agenda_ref: null,
        include: true,
      }
    })

  // (4) Merge the two speaker lists. Display-only: this never writes attendance, because
  // a member who sat silently is indistinguishable from one who never arrived (D12).
  const attributions = Array.isArray(minutes.attendees) ? minutes.attendees : []
  const unidentified = Array.isArray(minutes.unidentified_speakers)
    ? minutes.unidentified_speakers
    : []
  const speakers: MinutesDraftSpeaker[] = [
    ...attributions.map((a) => ({
      label: resolveAttendeeName(a.ref) ?? a.ref,
      attendee_ref: a.ref,
      utterance_count: 0,
      spoke: a.spoke === true,
    })),
    ...unidentified.map((u) => ({
      label: (u?.label ?? '').trim() || 'Voz não identificada',
      attendee_ref: null,
      utterance_count: Number.isFinite(u?.utterances) ? Number(u.utterances) : 0,
      spoke: true,
    })),
  ]

  const next = minutes.next_meeting
  return {
    // (1) Fall back rather than stringifying null.
    minutes_md: (minutes.minutes_md ?? minutes.summary ?? '').trim(),
    agenda,
    action_items,
    next_meeting: next
      ? {
          suggested_date: nullIfBlank(next.starts_at),
          location_text: nullIfBlank(next.location_text),
          note: nullIfBlank(next.raw),
        }
      : null,
    speakers,
    unassigned_resolutions: loose,
  }
}

function nullIfBlank(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}

/** The service sends `YYYY-MM-DD` or null. Anything else is treated as unparsed. */
function normalizeDate(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

/**
 * Fold the verbatim owner/deadline text into an action item's description when the
 * machine-readable half did not resolve (D7).
 *
 * Applied ONLY at apply time (see `applyMinutesReview`), never on autosave: folding
 * earlier would bake a hint into the description that the reviewer then has to delete
 * after assigning a real owner. By apply time the reviewer's choices are final, so the
 * fold reflects them.
 */
export function foldVerbatimIntoDescription(item: MinutesDraftActionItem): string {
  const parts = [item.description.trim()].filter(Boolean)
  if (!item.assigned_to && item.owner_text) {
    parts.push(`Responsável indicado em reunião: ${item.owner_text}`)
  }
  if (!item.due_date && item.deadline_text) {
    parts.push(`Prazo indicado em reunião: ${item.deadline_text}`)
  }
  return parts.join('\n\n')
}
