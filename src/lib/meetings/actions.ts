'use server'

import { revalidatePath } from 'next/cache'

import { canConfigureCommissionById, getSessionContext } from '@/lib/queries/session'
import { featureEnabled } from '@/lib/queries/feature-flags'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { MEETING_MESSAGES, mapMeetingError } from '@/lib/meetings/messages'
import { bucketForTier, effectiveTier } from '@/lib/attachments/constants'
import type {
  AttendanceStatus,
  AttendeeRole,
  MeetingModality,
} from '@/lib/queries/meetings'
import type { MeetingActionItemStatus } from '@/lib/queries/meeting-action-items'
import type { VisibilityScope } from '@/lib/queries/action-items'

/**
 * Meetings server actions (Phase 10 — Meetings; Architecture Rules 9 & 10).
 *
 * staff_admin authors the meeting and all of its children (schedule, agenda,
 * attendees, case links, attachments, lifecycle transitions); MEMBERS sign their
 * own present-attendee row and advance action items assigned to them. RLS is the
 * authority — each action uses the RLS-scoped cookie client and routes locked or
 * lifecycle-bearing mutations through the meetings RPCs (which set the
 * `app.in_meeting_rpc` flag and enforce the state machine + sign-own-row rules).
 * Each action re-verifies commission-scoped authz server-side for a clean pt-BR
 * "forbidden" (except sign + advance-action-item, whose RPCs let a non-staff_admin
 * member through, so a pre-check would wrongly require staff_admin).
 *
 * All user-facing strings are pt-BR (centralized in `./messages.ts` per the
 * Phase 10 plan — a deliberate divergence from the cases feature's inline map);
 * raw Supabase/Postgres errors NEVER reach the UI (CLAUDE.md §8). Direct-table
 * writes also gate the `meetings` feature flag via {@link meetingsEnabled}; the
 * self-gating RPCs additionally call `app.assert_meetings_enabled()`.
 */

/** The shared `useActionState`-shaped result for every meetings mutation. */
export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/** A create action that returns the new entity's id on success. */
export interface CreateMeetingState extends ActionState {
  meetingId?: string
}

/** A create action that returns the new agenda item's id on success. */
export interface CreateAgendaItemState extends ActionState {
  agendaItemId?: string
}

/** A create action that returns the new attendee's id on success. */
export interface AddAttendeeState extends ActionState {
  attendeeId?: string
}

/** A create action that returns the new case-link id on success. */
export interface LinkCaseState extends ActionState {
  caseLinkId?: string
}

/** An upload action that returns the new attachment's id on success. */
export interface UploadAttachmentState extends ActionState {
  attachmentId?: string
}

/** A create action that returns the new action item's id on success. */
export interface CreateMeetingActionItemState extends ActionState {
  actionItemId?: string
}

const MEETINGS_LIST_PATH = '/o/[org]/c/[commission]/meetings'
const MEETING_PATH = '/o/[org]/c/[commission]/meetings/[meetingId]'

function revalidateMeetings(): void {
  revalidatePath(MEETINGS_LIST_PATH, 'page')
  revalidatePath(MEETING_PATH, 'page')
}

/**
 * Authorize a MEETING-CONTENT action: admin, or a MEMBERSHIP staff_admin of
 * THAT commission. ⛔ Deliberately NOT the config seam — meetings are committee
 * content under the ADR 0100 D12 wall (a tenancy admin reads 0 meetings), so
 * every content action in this file keeps the membership-only gate. Only the
 * meeting-TYPE/SETTINGS config actions route `authorizeCommissionConfig`.
 */
async function authorizeCommission(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.memberships.some(
    (m) => m.commission.id === commissionId && m.role === 'staff_admin',
  )
}

/**
 * Authorize a meeting-vocabulary/settings CONFIG action (createMeetingType /
 * updateMeetingSettings): ADR 0100 D12 KEEP configuration (PO ruling Q7 —
 * "org_admin shapes the containers, never reads what goes in them"), so this
 * routes `canConfigureCommissionById` (membership staff_admin OR tenancy
 * admin) — mirroring the DB, where `meeting_types_staff_admin_write` /
 * `meeting_settings_staff_admin_write` and the CRUD probes carry the tenancy
 * arm. (renameMeetingType/archiveMeetingType carry no TS pre-check at all —
 * their armed INVOKER RPCs are the gate.) The platform-admin arm is
 * pre-existing and out of scope.
 */
async function authorizeCommissionConfig(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return canConfigureCommissionById(commissionId)
}

/** Resolve a meeting's commission via the RLS-scoped client (null = unseen). */
async function commissionOfMeeting(
  supabase: SupabaseClient<Database>,
  meetingId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('meetings')
    .select('commission_id')
    .eq('id', meetingId)
    .maybeSingle()
  return data?.commission_id ?? null
}

/**
 * Validate an optional `YYYY-MM-DD` date field. `undefined` when blank, the
 * string when a real calendar date, `null` to signal invalid.
 */
function parseDate(raw: string): string | undefined | null {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const d = new Date(`${trimmed}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  if (d.toISOString().slice(0, 10) !== trimmed) return null
  return trimmed
}

/**
 * Feature-flag gate for the direct-table meetings writes (mirror of
 * `casesExtrasEnabled`). Calls the SECURITY DEFINER `public.meetings_enabled()`
 * read so the gate is authoritative server-side (the flag lives in the
 * locked-down `app` schema). Fails closed.
 */
export async function meetingsEnabled(): Promise<boolean> {
  // P4 (WS-6): delegate to the consolidated, request-memoized flag read.
  return featureEnabled('meetings')
}

// ---------------------------------------------------------------------------
// Meeting header + lifecycle (staff_admin)
// ---------------------------------------------------------------------------

/** Fields accepted when scheduling or editing a meeting header. */
export interface MeetingInput {
  title: string
  meetingTypeId: string | null
  scheduledStart: string
  scheduledEnd: string | null
  modality: MeetingModality
  locationText: string | null
  meetingUrl: string | null
}

/**
 * Schedule a new meeting (`status='scheduled'`, `meeting_number` minted).
 * staff_admin-only. Returns the new `meetingId`.
 */
export async function createMeeting(
  commissionId: string,
  input: MeetingInput,
): Promise<CreateMeetingState> {
  if (!input.title.trim()) {
    return { ok: false, fieldErrors: { title: MEETING_MESSAGES.titleRequired } }
  }
  if (!input.scheduledStart) {
    return {
      ok: false,
      fieldErrors: { scheduledStart: MEETING_MESSAGES.scheduleInvalid },
    }
  }
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }
  // The `create_meeting` RPC is the SOLE authority (coordinator/commission-admin OR a
  // `schedule_meetings` Administrativo, ADR 0061); a coordinator-only `authorizeCommission`
  // pre-gate here shadowed the widened RPC and rejected Administrativos before it
  // (BUG-ADM-001, meetings arm). Refusal still returns a clean pt-BR error — the RPC's
  // `42501` maps to `MEETING_MESSAGES.forbidden` via `mapMeetingError` (PG_FORBIDDEN).
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_meeting', {
    p_commission_id: commissionId,
    p_title: input.title.trim(),
    p_meeting_type_id: input.meetingTypeId ?? undefined,
    p_scheduled_start: input.scheduledStart,
    p_scheduled_end: input.scheduledEnd ?? undefined,
    p_modality: input.modality,
    p_location_text: input.locationText ?? undefined,
    p_meeting_url: input.meetingUrl ?? undefined,
  })

  if (error || !data) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.meetingCreated, meetingId: data.id }
}

/**
 * Edit a meeting header (only while `scheduled`/`held` — locked thereafter).
 * staff_admin-only.
 */
export async function updateMeeting(
  meetingId: string,
  input: MeetingInput,
): Promise<ActionState> {
  if (!input.title.trim()) {
    return { ok: false, fieldErrors: { title: MEETING_MESSAGES.titleRequired } }
  }
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfMeeting(supabase, meetingId)
  if (!commissionId) return { ok: false, error: MEETING_MESSAGES.missingMeeting }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MEETING_MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('update_meeting', {
    p_meeting_id: meetingId,
    p_title: input.title.trim(),
    p_scheduled_start: input.scheduledStart,
    p_modality: input.modality,
    p_meeting_type_id: input.meetingTypeId ?? undefined,
    p_scheduled_end: input.scheduledEnd ?? undefined,
    p_location_text: input.locationText ?? undefined,
    p_meeting_url: input.meetingUrl ?? undefined,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.meetingUpdated }
}

/** Shared lifecycle-RPC runner (staff_admin authz + flag + pt-BR mapping). */
async function runLifecycle(
  meetingId: string,
  rpc:
    | 'mark_meeting_held'
    | 'conclude_meeting'
    | 'reopen_meeting'
    | 'distribute_meeting'
    | 'cancel_meeting',
  successMessage: string,
): Promise<ActionState> {
  if (!meetingId) return { ok: false, error: MEETING_MESSAGES.missingMeeting }
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfMeeting(supabase, meetingId)
  if (!commissionId) return { ok: false, error: MEETING_MESSAGES.missingMeeting }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MEETING_MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc(rpc, { p_meeting_id: meetingId })
  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: successMessage }
}

/**
 * The `held`-capturing lifecycle transitions (ADR 0062): `mark_meeting_held` and
 * `conclude_meeting` are broken OUT of {@link runLifecycle} because they carry
 * the actual-occurrence window as extra params (F1). Same staff_admin authz +
 * flag + pt-BR mapping; `held` is optional (omit = legacy no-data), and a
 * null/absent `heldAt` is forwarded as `null` (allow-null, fill-later).
 */
async function runHeldTransition(
  meetingId: string,
  rpc: 'mark_meeting_held' | 'conclude_meeting',
  successMessage: string,
  held?: MeetingHeldWindow,
): Promise<ActionState> {
  if (!meetingId) return { ok: false, error: MEETING_MESSAGES.missingMeeting }
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfMeeting(supabase, meetingId)
  if (!commissionId) return { ok: false, error: MEETING_MESSAGES.missingMeeting }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MEETING_MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc(
    rpc,
    heldArgs(meetingId, held?.heldAt ?? null, held?.heldEnd ?? null),
  )
  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: successMessage }
}

/**
 * Build the RPC args for the held-window RPCs, forwarding an explicit JSON
 * `null` when a value is cleared (allow-null, ADR 0062). The generated Args
 * types model `p_held_at`/`p_held_end` as optional `string` (supabase-js does
 * not emit nullable RPC params), but the RPCs accept SQL NULL at runtime; this
 * cast is the single, contained place that reconciles that gap so callers stay
 * clean and `p_meeting_id` keeps its exact type.
 */
function heldArgs(
  meetingId: string,
  heldAt: string | null,
  heldEnd: string | null,
): { p_meeting_id: string; p_held_at?: string; p_held_end?: string } {
  return {
    p_meeting_id: meetingId,
    // `null` is intentional (not `undefined`): it CLEARS the stored value.
    p_held_at: heldAt as string | undefined,
    p_held_end: heldEnd as string | undefined,
  }
}

/**
 * Actual-occurrence window (ADR 0062). ISO 8601 strings (from a
 * `datetime-local` input, serialized to timestamptz) or `null` = not recorded.
 * `heldAt` may be null at the transition (allow-null, fill-later); the server
 * validates `heldEnd >= heldAt` and `heldAt <= now()` (HC081 / HC082).
 */
export interface MeetingHeldWindow {
  /** When the meeting actually started; `null` = not recorded now. */
  heldAt: string | null
  /** When the meeting actually ended (optional); `null` if not recorded. */
  heldEnd?: string | null
}

/**
 * Mark a scheduled meeting as held (`scheduled → held`), the explicit step
 * into the `held` resting state (e.g. to record discussion/attendance over
 * several sessions before sending the ata to signature). staff_admin-only.
 * `concludeMeeting` still accepts `scheduled` directly as a one-step shortcut.
 *
 * ADR 0062: optionally captures the actual-occurrence window (`held`) in the
 * same transition. Omit `held` to preserve the legacy no-data behaviour.
 */
export async function markMeetingHeld(
  meetingId: string,
  held?: MeetingHeldWindow,
): Promise<ActionState> {
  return runHeldTransition(
    meetingId,
    'mark_meeting_held',
    MEETING_MESSAGES.meetingHeld,
    held,
  )
}

/**
 * Conclude a meeting (`scheduled`/`held → in_signature`): validates ≥1
 * present attendee (HC034), snapshots the quorum rule + counts, writes a
 * `case_events` row per linked case, and locks the minutes/agenda/attendees/
 * case-links. staff_admin-only.
 *
 * ADR 0062: optionally captures the actual-occurrence window (`held`); `concluded_at`
 * (ata → signature) stays `now()` and is unaffected.
 */
export async function concludeMeeting(
  meetingId: string,
  held?: MeetingHeldWindow,
): Promise<ActionState> {
  return runHeldTransition(
    meetingId,
    'conclude_meeting',
    MEETING_MESSAGES.meetingConcluded,
    held,
  )
}

/**
 * Correct the actual-occurrence window (`held_at` / `held_end`) of a meeting
 * AFTER the transition. ADR 0062 + product decision: allowed ONLY while
 * `status = 'held'`; a concluded meeting (`in_signature`+) is frozen and
 * must be reopened (`reopenMeeting`) first. Writes ONLY `held_*` (never the
 * schedule). staff_admin-only; validation HC081 (heldEnd < heldAt) / HC082
 * (heldAt in future) / HC083 (wrong status). RPC `set_meeting_held_window`.
 */
export async function setMeetingHeldWindow(
  meetingId: string,
  held: MeetingHeldWindow,
): Promise<ActionState> {
  if (!meetingId) return { ok: false, error: MEETING_MESSAGES.missingMeeting }
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfMeeting(supabase, meetingId)
  if (!commissionId) return { ok: false, error: MEETING_MESSAGES.missingMeeting }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MEETING_MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('set_meeting_held_window', {
    p_meeting_id: meetingId,
    // `held_at` may be cleared to record "not held yet" (allow-null, ADR 0062).
    // The generated Args type marks `p_held_at` required `string`, but the RPC
    // accepts SQL NULL at runtime; forward `null` (never `undefined`, which
    // would drop the param) via a contained cast.
    p_held_at: (held.heldAt ?? null) as string,
    p_held_end: (held.heldEnd ?? null) as string | undefined,
  })
  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.heldWindowUpdated }
}

/**
 * Re-open a meeting (`in_signature`/`signed → held`): REVOKES all active
 * signatures (rows kept, `status='revoked'`) and unlocks content. staff_admin-only.
 */
export async function reopenMeeting(meetingId: string): Promise<ActionState> {
  return runLifecycle(
    meetingId,
    'reopen_meeting',
    MEETING_MESSAGES.meetingReopened,
  )
}

/** Distribute the signed ata (`signed → distributed`, terminal). staff_admin-only. */
export async function distributeMeeting(
  meetingId: string,
): Promise<ActionState> {
  return runLifecycle(
    meetingId,
    'distribute_meeting',
    MEETING_MESSAGES.meetingDistributed,
  )
}

/** Cancel a meeting (→ `cancelled`, terminal) from any non-terminal state. staff_admin-only. */
export async function cancelMeeting(meetingId: string): Promise<ActionState> {
  return runLifecycle(
    meetingId,
    'cancel_meeting',
    MEETING_MESSAGES.meetingCancelled,
  )
}

/**
 * Persist the minutes narrative (`minutes_md`, sanitized Markdown — Architecture
 * Rule 7). Editable only while `scheduled`/`held`; rejected once locked.
 * staff_admin-only.
 */
export async function updateMeetingMinutes(
  meetingId: string,
  minutesMd: string,
): Promise<ActionState> {
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfMeeting(supabase, meetingId)
  if (!commissionId) return { ok: false, error: MEETING_MESSAGES.missingMeeting }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MEETING_MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('update_meeting_minutes', {
    p_meeting_id: meetingId,
    p_minutes_md: minutesMd,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.meetingUpdated }
}

// ---------------------------------------------------------------------------
// Agenda items (staff_admin)
// ---------------------------------------------------------------------------

/** Fields accepted when creating or editing an agenda item. */
export interface AgendaItemInput {
  title: string
  description: string | null
  discussionNotes: string | null
  resolution: string | null
}

/** Append an agenda item to a meeting (at the end of the order). staff_admin-only. */
export async function createAgendaItem(
  meetingId: string,
  input: AgendaItemInput,
): Promise<CreateAgendaItemState> {
  if (!input.title.trim()) {
    return {
      ok: false,
      fieldErrors: { title: MEETING_MESSAGES.agendaTitleRequired },
    }
  }
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfMeeting(supabase, meetingId)
  if (!commissionId) return { ok: false, error: MEETING_MESSAGES.missingMeeting }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MEETING_MESSAGES.forbidden }
  }

  const { data, error } = await supabase.rpc('create_meeting_agenda_item', {
    p_meeting_id: meetingId,
    p_title: input.title.trim(),
    p_description: input.description ?? undefined,
    p_discussion_notes: input.discussionNotes ?? undefined,
    p_resolution: input.resolution ?? undefined,
  })

  if (error || !data) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return {
    ok: true,
    error: MEETING_MESSAGES.agendaItemAdded,
    // ADR 0078 C2: create_meeting_agenda_item now returns the id scalar (its row
    // type carried REVOKE'd columns that RETURNING * could no longer read).
    agendaItemId: data,
  }
}

/** Edit an agenda item (`title`/`description`/`discussionNotes`/`resolution`). staff_admin-only. */
export async function updateAgendaItem(
  agendaItemId: string,
  input: AgendaItemInput,
): Promise<ActionState> {
  if (!input.title.trim()) {
    return {
      ok: false,
      fieldErrors: { title: MEETING_MESSAGES.agendaTitleRequired },
    }
  }
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_meeting_agenda_item', {
    p_agenda_item_id: agendaItemId,
    p_title: input.title.trim(),
    p_description: input.description ?? undefined,
    p_discussion_notes: input.discussionNotes ?? undefined,
    p_resolution: input.resolution ?? undefined,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.agendaItemUpdated }
}

/** Remove an agenda item (only while unlocked). staff_admin-only. */
export async function deleteAgendaItem(
  agendaItemId: string,
): Promise<ActionState> {
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_meeting_agenda_item', {
    p_agenda_item_id: agendaItemId,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.agendaItemRemoved }
}

/**
 * Move an agenda item one step in the order (swap idiom, like `reorder_section`).
 * `direction` is `'up'` (toward 0) or `'down'`. staff_admin-only.
 */
export async function reorderMeetingAgendaItem(
  agendaItemId: string,
  direction: 'up' | 'down',
): Promise<ActionState> {
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reorder_meeting_agenda_item', {
    p_agenda_item_id: agendaItemId,
    p_direction: direction,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.agendaReordered }
}

// ---------------------------------------------------------------------------
// Attendees + quorum (staff_admin)
// ---------------------------------------------------------------------------

/**
 * Fields accepted when adding/editing an attendee. Provide `userId` for a
 * platform member XOR `externalName` (+ optional `externalOrg`) for a guest.
 */
export interface AttendeeInput {
  userId: string | null
  externalName: string | null
  externalOrg: string | null
  role: AttendeeRole
  attendance: AttendanceStatus
  note: string | null
}

/** Add an attendee (a platform member or an external guest). staff_admin-only. */
export async function addMeetingAttendee(
  meetingId: string,
  input: AttendeeInput,
): Promise<AddAttendeeState> {
  const hasUser = Boolean(input.userId)
  const hasGuest = Boolean(input.externalName?.trim())
  if (hasUser === hasGuest) {
    // both set or neither set → the XOR is violated
    return {
      ok: false,
      error: hasUser
        ? MEETING_MESSAGES.attendeeExclusive
        : MEETING_MESSAGES.attendeeRequired,
    }
  }
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfMeeting(supabase, meetingId)
  if (!commissionId) return { ok: false, error: MEETING_MESSAGES.missingMeeting }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MEETING_MESSAGES.forbidden }
  }

  const { data, error } = await supabase.rpc('add_meeting_attendee', {
    p_meeting_id: meetingId,
    p_user_id: input.userId ?? undefined,
    p_external_name: input.externalName ?? undefined,
    p_external_org: input.externalOrg ?? undefined,
    p_role: input.role,
    p_attendance: input.attendance,
    p_note: input.note ?? undefined,
  })

  if (error || !data) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.attendeeAdded, attendeeId: data.id }
}

/** Edit an attendee's `role`/`attendance`/`note` (guests also name/org). staff_admin-only. */
export async function updateMeetingAttendee(
  attendeeId: string,
  input: AttendeeInput,
): Promise<ActionState> {
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_meeting_attendee', {
    p_attendee_id: attendeeId,
    p_role: input.role,
    p_attendance: input.attendance,
    p_note: input.note ?? undefined,
    p_external_name: input.externalName ?? undefined,
    p_external_org: input.externalOrg ?? undefined,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.attendeeUpdated }
}

/** Remove an attendee (only while unlocked). staff_admin-only. */
export async function removeMeetingAttendee(
  attendeeId: string,
): Promise<ActionState> {
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_meeting_attendee', {
    p_attendee_id: attendeeId,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.attendeeRemoved }
}

/**
 * Seed the meeting's attendees with the current commission members
 * (`convocado`/`membro`, `ON CONFLICT DO NOTHING` so it is idempotent — the
 * "Preencher com membros" button). staff_admin-only.
 */
export async function seedExpectedAttendees(
  meetingId: string,
): Promise<ActionState> {
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfMeeting(supabase, meetingId)
  if (!commissionId) return { ok: false, error: MEETING_MESSAGES.missingMeeting }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MEETING_MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('seed_expected_meeting_attendees', {
    p_meeting_id: meetingId,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.attendeesSeeded }
}

/**
 * Seed the meeting's attendees with a chosen SUBSET of commission members
 * (`convocado`/`membro`, idempotent) — the "Participantes" picker path when a
 * subset is selected instead of "all". staff_admin-only (the RPC's gate). A
 * `userId` that is not a member of the meeting's commission is ignored by the RPC
 * (its join to `commission_members`), so a stale/foreign id never leaks in.
 */
export async function seedSelectedAttendees(
  meetingId: string,
  userIds: string[],
): Promise<ActionState> {
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfMeeting(supabase, meetingId)
  if (!commissionId) return { ok: false, error: MEETING_MESSAGES.missingMeeting }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MEETING_MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('seed_selected_meeting_attendees', {
    p_meeting_id: meetingId,
    p_user_ids: userIds,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.attendeesSeeded }
}

/**
 * Override the computed quorum verdict (`quorum_met`) — the secretary's call.
 * Allowed while `in_signature`. staff_admin-only.
 */
export async function setMeetingQuorumMet(
  meetingId: string,
  quorumMet: boolean,
): Promise<ActionState> {
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfMeeting(supabase, meetingId)
  if (!commissionId) return { ok: false, error: MEETING_MESSAGES.missingMeeting }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MEETING_MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('set_meeting_quorum_met', {
    p_meeting_id: meetingId,
    p_quorum_met: quorumMet,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.meetingUpdated }
}

// ---------------------------------------------------------------------------
// Cases discussed (staff_admin)
// ---------------------------------------------------------------------------

/** Fields accepted when linking a case to a meeting. */
export interface LinkCaseInput {
  caseId: string
  /** Optional agenda item to attach the discussion to; `null` if free-standing. */
  agendaItemId: string | null
  summary: string | null
  decision: string | null
}

/**
 * Link an existing commission case to the meeting (same-commission guard, HC032).
 * staff_admin-only. Returns the new `caseLinkId`.
 */
export async function linkMeetingCase(
  meetingId: string,
  input: LinkCaseInput,
): Promise<LinkCaseState> {
  if (!input.caseId) {
    return { ok: false, fieldErrors: { caseId: MEETING_MESSAGES.caseRequired } }
  }
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfMeeting(supabase, meetingId)
  if (!commissionId) return { ok: false, error: MEETING_MESSAGES.missingMeeting }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MEETING_MESSAGES.forbidden }
  }

  const { data, error } = await supabase.rpc('link_meeting_case', {
    p_meeting_id: meetingId,
    p_case_id: input.caseId,
    p_agenda_item_id: input.agendaItemId ?? undefined,
    p_summary: input.summary ?? undefined,
    p_decision: input.decision ?? undefined,
  })

  if (error || !data) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  // ADR 0078 C1: link_meeting_case now returns the id scalar.
  return { ok: true, error: MEETING_MESSAGES.caseLinked, caseLinkId: data }
}

/** Remove a case link (only while unlocked). staff_admin-only. */
export async function unlinkMeetingCase(
  caseLinkId: string,
): Promise<ActionState> {
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('unlink_meeting_case', {
    p_case_link_id: caseLinkId,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.caseUnlinked }
}

// ---------------------------------------------------------------------------
// Attachments (staff_admin; immutable objects, soft-delete rows)
// ---------------------------------------------------------------------------

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024 // mirrors the bucket's 25 MiB limit
// MIME → file extension, mirroring the meeting-attachments bucket allow-list.
const ALLOWED_ATTACHMENT_MIME = new Map<string, string>([
  ['application/pdf', 'pdf'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['application/msword', 'doc'],
  [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'docx',
  ],
  ['application/vnd.ms-excel', 'xls'],
  [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xlsx',
  ],
  ['application/vnd.ms-powerpoint', 'ppt'],
  [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'pptx',
  ],
  ['text/csv', 'csv'],
  ['text/plain', 'txt'],
])

const ATTACHMENT_KINDS = [
  'pauta',
  'apresentacao',
  'literatura',
  'lista_presenca',
  'ata_assinada',
  'outro',
]

/**
 * Upload a file-backed attachment. `useActionState`-shaped. Expected fields:
 * `meetingId`, `file` (the upload), `kind` ({@link MeetingAttachmentKind}),
 * `title`. Clones the case-documents flow: validates the MIME allow-list + 25
 * MiB cap, uploads to a FRESH immutable path (`upsert:false`,
 * `{commissionId}/{meetingId}/{uuid}.{ext}`), then inserts the metadata row via
 * the `create_attachment` RPC (Phase F2 — owner_type='meeting') — objects are
 * never overwritten (Rule 6). staff_admin-only.
 */
export async function uploadMeetingAttachment(
  _prev: UploadAttachmentState | undefined,
  formData: FormData,
): Promise<UploadAttachmentState> {
  const meetingId = String(formData.get('meetingId') ?? '')
  const kind = String(formData.get('kind') ?? 'outro')
  const title = String(formData.get('title') ?? '').trim()
  const file = formData.get('file')

  if (!meetingId) return { ok: false, error: MEETING_MESSAGES.missingMeeting }
  if (!ATTACHMENT_KINDS.includes(kind)) {
    return { ok: false, error: MEETING_MESSAGES.attachmentKindInvalid }
  }
  if (!title) {
    return { ok: false, fieldErrors: { title: MEETING_MESSAGES.titleRequired } }
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, fieldErrors: { file: MEETING_MESSAGES.fileRequired } }
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, fieldErrors: { file: MEETING_MESSAGES.fileTooLarge } }
  }
  const ext = ALLOWED_ATTACHMENT_MIME.get(file.type)
  if (!ext) {
    return { ok: false, fieldErrors: { file: MEETING_MESSAGES.fileTypeInvalid } }
  }

  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }
  // Phase F2 (ADR 0063): meeting attachments are `attachments` (owner_type='meeting'),
  // gated by the `attachments` flag (in addition to meetings). Inert while OFF.
  if (!(await featureEnabled('attachments'))) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfMeeting(supabase, meetingId)
  if (!commissionId) return { ok: false, error: MEETING_MESSAGES.missingMeeting }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MEETING_MESSAGES.forbidden }
  }

  // Owner-scoped immutable path `meeting/{meetingId}/{uuid}.{ext}`; meetings default to
  // the STANDARD tier → the `attachments` bucket.
  const tier = effectiveTier('meeting')
  const bucket = bucketForTier(tier)
  const path = `meeting/${meetingId}/${crypto.randomUUID()}.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: file.type, upsert: false })
  if (uploadError) return { ok: false, error: MEETING_MESSAGES.uploadFailed }

  const { data, error } = await supabase.rpc('create_attachment', {
    p_owner_type: 'meeting',
    p_owner_id: meetingId,
    p_storage_path: path,
    p_title: title,
    p_kind: kind,
    p_mime_type: file.type,
    p_size_bytes: file.size,
    p_sensitivity_tier: tier,
  })

  if (error || !data) {
    // The metadata insert failed AFTER the object landed; the object is orphaned
    // but never overwritten (Rule 6 — orphans tolerated, no GC in v1).
    return { ok: false, error: mapMeetingError(error) }
  }

  revalidateMeetings()
  return {
    ok: true,
    error: MEETING_MESSAGES.attachmentAdded,
    attachmentId: data.id,
  }
}

/** SOFT-delete an attachment (row hidden, Storage object retained — Rule 6). staff_admin-only. */
export async function deleteMeetingAttachment(
  attachmentId: string,
): Promise<ActionState> {
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }
  if (!(await featureEnabled('attachments'))) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('soft_delete_attachment', {
    p_id: attachmentId,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.attachmentRemoved }
}

// ---------------------------------------------------------------------------
// Signing (present platform attendees)
// ---------------------------------------------------------------------------

/**
 * Internal electronic signature on the ata: the CURRENT user signs for their own
 * present-attendee row of an `in_signature` meeting (HC036 if not entitled,
 * HC035 if already signed). Routed through the SECURITY DEFINER `sign_meeting`
 * RPC, which computes the `content_hash` and count-and-flips to `signed` when
 * the last required signature lands. NOT a staff_admin action — any present
 * member may sign their own row, so there is NO commission-scoped pre-check (the
 * RPC's `app.can_sign_meeting` gate is the sole authority).
 */
export async function signMeeting(
  attendeeId: string,
  note?: string,
): Promise<ActionState> {
  if (!attendeeId) return { ok: false, error: MEETING_MESSAGES.missingAttendee }
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('sign_meeting', {
    p_attendee_id: attendeeId,
    p_method: 'internal_eauth',
    p_note: note ?? undefined,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.meetingSigned }
}

// ---------------------------------------------------------------------------
// Action items (staff_admin authors; assignees advance their own — narrow RPC)
// ---------------------------------------------------------------------------

/** Fields accepted when creating or editing a meeting action item. */
export interface MeetingActionItemInput {
  title: string
  description: string | null
  assignedTo: string | null
  dueDate: string | null
  /** The agenda item that generated this, if any; `null` if free-standing. */
  sourceAgendaItemId: string | null
  /** Optional cross-link to a case; `null` if none. */
  caseId: string | null
  /**
   * Coordinator-chosen read scope (ADR 0050). `null` leaves it to the RPC's own
   * default computation (`case_restricted` when `caseId` is set, else `committee`).
   * The FE MUST NOT offer `case_restricted` without a `caseId` — the RPC does NOT
   * cross-validate that combination and would silently create an item readable by
   * no one but staff_admin/org_admin (a null-case `case_restricted` row).
   */
  visibilityScope?: VisibilityScope | null
}

/** Create an action item on a meeting. staff_admin-only. Returns the new `actionItemId`. */
export async function createMeetingActionItem(
  meetingId: string,
  input: MeetingActionItemInput,
): Promise<CreateMeetingActionItemState> {
  if (!input.title.trim()) {
    return {
      ok: false,
      fieldErrors: { title: MEETING_MESSAGES.actionItemTitleRequired },
    }
  }
  const dueDate = parseDate(input.dueDate ?? '')
  if (dueDate === null) {
    return { ok: false, fieldErrors: { dueDate: MEETING_MESSAGES.dateInvalid } }
  }
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfMeeting(supabase, meetingId)
  if (!commissionId) return { ok: false, error: MEETING_MESSAGES.missingMeeting }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MEETING_MESSAGES.forbidden }
  }

  const { data, error } = await supabase.rpc('create_committee_action_item', {
    p_commission: commissionId,
    p_source_type: 'meeting',
    p_meeting_id: meetingId,
    p_agenda_item_id: input.sourceAgendaItemId ?? undefined,
    p_case_id: input.caseId ?? undefined,
    p_title: input.title.trim(),
    p_description: input.description ?? undefined,
    p_assigned_to: input.assignedTo ?? undefined,
    p_due_date: dueDate ?? undefined,
    p_visibility_scope: input.visibilityScope ?? undefined,
  })

  if (error || !data) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return {
    ok: true,
    error: MEETING_MESSAGES.actionItemCreated,
    actionItemId: data.id,
  }
}

/**
 * Edit an action item (`title`/`description`/`assignedTo`/`dueDate`). Status
 * changes go through {@link advanceMeetingActionItem}. staff_admin-only.
 */
export async function updateMeetingActionItem(
  actionItemId: string,
  input: MeetingActionItemInput,
): Promise<ActionState> {
  if (!input.title.trim()) {
    return {
      ok: false,
      fieldErrors: { title: MEETING_MESSAGES.actionItemTitleRequired },
    }
  }
  const dueDate = parseDate(input.dueDate ?? '')
  if (dueDate === null) {
    return { ok: false, fieldErrors: { dueDate: MEETING_MESSAGES.dateInvalid } }
  }
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  // NB: update_committee_action_item exposes NO p_case_id (the case cross-link is
  // create-time only; changing it is not supported by the hub RPC and adding it
  // would alter a committee_* signature, out of scope). Only p_visibility_scope is
  // editable here. `null` leaves the scope unchanged (the RPC coalesces).
  const { error } = await supabase.rpc('update_committee_action_item', {
    p_id: actionItemId,
    p_title: input.title.trim(),
    p_description: input.description ?? undefined,
    p_assigned_to: input.assignedTo ?? undefined,
    p_due_date: dueDate ?? undefined,
    p_visibility_scope: input.visibilityScope ?? undefined,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.actionItemUpdated }
}

/**
 * Resolve the shared `action_items` status id for a lifecycle KEY, preferring a
 * per-commission override then the global default. The meetings UI still speaks
 * in status keys (`open`/`in_progress`/`done`/`cancelled`); the shared hub keys
 * status by id, so the advance action translates key -> id here. `null` when the
 * key is unknown (never happens for the four seeded keys).
 */
async function resolveActionItemStatusId(
  supabase: SupabaseClient<Database>,
  actionItemId: string,
  statusKey: MeetingActionItemStatus,
): Promise<string | null> {
  const { data: item } = await supabase
    .from('action_items')
    .select('commission_id')
    .eq('id', actionItemId)
    .maybeSingle()

  const { data: statuses } = await supabase
    .from('action_item_statuses')
    .select('id, commission_id')
    .eq('key', statusKey)
    .eq('archived', false)

  if (!statuses || statuses.length === 0) return null

  // Prefer this item's per-commission override; else the global default.
  const commissionId = item?.commission_id ?? null
  const override = commissionId
    ? statuses.find((s) => s.commission_id === commissionId)
    : undefined
  const global = statuses.find((s) => s.commission_id === null)
  return (override ?? global ?? statuses[0]).id
}

/**
 * Advance an action item to another lifecycle `status`. Routed through
 * `advance_committee_action_item` (resolving the status KEY -> the shared hub's
 * `status_id`): the caller must be the assignee OR a staff_admin of the meeting's
 * commission (HC037 otherwise). No commission-scoped pre-check here — a plain
 * assignee must be allowed through (mirrors `advanceActionItem`).
 */
export async function advanceMeetingActionItem(
  actionItemId: string,
  status: MeetingActionItemStatus,
): Promise<ActionState> {
  if (!actionItemId) return { ok: false, error: MEETING_MESSAGES.missingActionItem }
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const statusId = await resolveActionItemStatusId(supabase, actionItemId, status)
  if (!statusId) return { ok: false, error: MEETING_MESSAGES.missingActionItem }

  const { error } = await supabase.rpc('advance_committee_action_item', {
    p_id: actionItemId,
    p_to_status_id: statusId,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.actionItemAdvanced }
}

/** Mark an action item `done` (stamps completion). Same assignee-or-staff_admin gate (HC037). */
export async function completeMeetingActionItem(
  actionItemId: string,
): Promise<ActionState> {
  if (!actionItemId) return { ok: false, error: MEETING_MESSAGES.missingActionItem }
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('complete_committee_action_item', {
    p_id: actionItemId,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.actionItemCompleted }
}

/**
 * HARD-delete an action item (remove a mistakenly-created row). staff_admin-only
 * — routed through `delete_committee_action_item`, which re-checks staff_admin/
 * org_admin authority, cascades to assignments + status history, and audits the
 * delete. To CANCEL (keep the row), use `advanceMeetingActionItem(id, 'cancelled')`.
 */
export async function deleteMeetingActionItem(
  actionItemId: string,
): Promise<ActionState> {
  if (!actionItemId) return { ok: false, error: MEETING_MESSAGES.missingActionItem }
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_committee_action_item', {
    p_id: actionItemId,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.actionItemRemoved }
}

// ---------------------------------------------------------------------------
// Settings (F5): meeting-type vocabulary CRUD + quorum rule
// ---------------------------------------------------------------------------
// Added to the contract at the lead's request (the manage/ settings screen).
// These follow the case_outcomes vocabulary-CRUD pattern; the RPCs self-gate
// the flag, but the actions still gate meetingsEnabled() + a staff_admin check
// for a clean pt-BR forbidden.

/** A create action that returns the new meeting type's id on success. */
export interface CreateMeetingTypeState extends ActionState {
  typeId?: string
}

/** Create a meeting-type vocabulary entry. staff_admin-only. Returns the new `typeId`. */
export async function createMeetingType(
  commissionId: string,
  name: string,
  colorToken: string = 'slate',
): Promise<CreateMeetingTypeState> {
  if (!name.trim()) {
    return { ok: false, fieldErrors: { name: MEETING_MESSAGES.typeRequired } }
  }
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }
  if (!(await authorizeCommissionConfig(commissionId))) {
    return { ok: false, error: MEETING_MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_meeting_type', {
    p_commission_id: commissionId,
    p_name: name.trim(),
    p_color_token: colorToken,
  })

  if (error || !data) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, typeId: data.id }
}

/** Rename / recolor a meeting type (edits propagate everywhere). staff_admin-only. */
export async function renameMeetingType(
  typeId: string,
  name: string,
  colorToken: string,
): Promise<ActionState> {
  if (!name.trim()) {
    return { ok: false, fieldErrors: { name: MEETING_MESSAGES.typeRequired } }
  }
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('rename_meeting_type', {
    p_type_id: typeId,
    p_name: name.trim(),
    p_color_token: colorToken,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true }
}

/** Archive a meeting type (retire it; existing meetings keep their reference). staff_admin-only. */
export async function archiveMeetingType(typeId: string): Promise<ActionState> {
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('archive_meeting_type', {
    p_type_id: typeId,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true }
}

/** Configure the commission's quorum rule (UPSERTs the single settings row). staff_admin-only. */
export async function updateMeetingSettings(
  commissionId: string,
  quorumRuleType: 'maioria_simples' | 'fixed_count' | 'percentage',
  quorumValue: number | null,
): Promise<ActionState> {
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }
  if (!(await authorizeCommissionConfig(commissionId))) {
    return { ok: false, error: MEETING_MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_meeting_settings', {
    p_commission_id: commissionId,
    p_quorum_rule_type: quorumRuleType,
    p_quorum_value: quorumValue ?? undefined,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true }
}

// Re-export the union types frontend forms bind to, so a form importing the
// action also gets its input enums from one module.
export type {
  AttendanceStatus,
  AttendeeRole,
  MeetingAttachmentKind,
  MeetingModality,
  QuorumRuleType,
} from '@/lib/queries/meetings'
export type { MeetingActionItemStatus } from '@/lib/queries/meeting-action-items'

/** Open a reserved (closed) session on a meeting. Coordinator-only (RPC-enforced). */
export async function openReservedSession(
  meetingId: string,
): Promise<ActionState & { sessionId?: string }> {
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('open_reserved_session', {
    p_meeting_id: meetingId,
  })
  if (error || !data) return { ok: false, error: mapMeetingError(error) }
  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.reservedSessionOpened, sessionId: data }
}

/** Input for a reserved-session item; `readerUids` populates the reader list for case-less items. */
export interface ReservedItemInput {
  caseId?: string | null
  substance?: string | null
  decision?: string | null
  withdrawals?: string | null
  quorumMet?: boolean
  readerUids?: string[] | null
}

/** Add a reserved-session item. Coordinator-only; the exclusion + member-reader rules are RPC-enforced. */
export async function addReservedItem(
  sessionId: string,
  input: ReservedItemInput,
): Promise<ActionState & { itemId?: string }> {
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('add_reserved_item', {
    p_session_id: sessionId,
    p_case_id: input.caseId ?? undefined,
    p_substance: input.substance ?? undefined,
    p_decision: input.decision ?? undefined,
    p_withdrawals: input.withdrawals ?? undefined,
    p_quorum_met: input.quorumMet ?? undefined,
    p_reader_uids: input.readerUids ?? undefined,
  })
  if (error || !data) return { ok: false, error: mapMeetingError(error) }
  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.reservedItemAdded, itemId: data }
}
