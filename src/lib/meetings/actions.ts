'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { MEETING_MESSAGES, mapMeetingError } from '@/lib/meetings/messages'
import type {
  AttendanceStatus,
  AttendeeRole,
  MeetingModality,
} from '@/lib/queries/meetings'
import type { MeetingActionItemStatus } from '@/lib/queries/meeting-action-items'

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

const MEETINGS_LIST_PATH = '/c/[slug]/meetings'
const MEETING_PATH = '/c/[slug]/meetings/[meetingId]'

function revalidateMeetings(): void {
  revalidatePath(MEETINGS_LIST_PATH, 'page')
  revalidatePath(MEETING_PATH, 'page')
}

/** Authorize: admin, or a staff_admin of THAT commission. */
async function authorizeCommission(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.memberships.some(
    (m) => m.commission.id === commissionId && m.role === 'staff_admin',
  )
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
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('meetings_enabled')
  if (error) return false
  return data === true
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
 * Schedule a new meeting (`status='agendada'`, `meeting_number` minted).
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
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MEETING_MESSAGES.forbidden }
  }

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
 * Edit a meeting header (only while `agendada`/`realizada` — locked thereafter).
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
 * Mark a scheduled meeting as held (`agendada → realizada`), the explicit step
 * into the `realizada` resting state (e.g. to record discussion/attendance over
 * several sessions before sending the ata to signature). staff_admin-only.
 * `concludeMeeting` still accepts `agendada` directly as a one-step shortcut.
 */
export async function markMeetingHeld(meetingId: string): Promise<ActionState> {
  return runLifecycle(
    meetingId,
    'mark_meeting_held',
    MEETING_MESSAGES.meetingHeld,
  )
}

/**
 * Conclude a meeting (`agendada`/`realizada → em_assinatura`): validates ≥1
 * present attendee (HC034), snapshots the quorum rule + counts, writes a
 * `case_events` row per linked case, and locks the minutes/agenda/attendees/
 * case-links. staff_admin-only.
 */
export async function concludeMeeting(meetingId: string): Promise<ActionState> {
  return runLifecycle(
    meetingId,
    'conclude_meeting',
    MEETING_MESSAGES.meetingConcluded,
  )
}

/**
 * Re-open a meeting (`em_assinatura`/`assinada → realizada`): REVOKES all active
 * signatures (rows kept, `status='revoked'`) and unlocks content. staff_admin-only.
 */
export async function reopenMeeting(meetingId: string): Promise<ActionState> {
  return runLifecycle(
    meetingId,
    'reopen_meeting',
    MEETING_MESSAGES.meetingReopened,
  )
}

/** Distribute the signed ata (`assinada → distribuida`, terminal). staff_admin-only. */
export async function distributeMeeting(
  meetingId: string,
): Promise<ActionState> {
  return runLifecycle(
    meetingId,
    'distribute_meeting',
    MEETING_MESSAGES.meetingDistributed,
  )
}

/** Cancel a meeting (→ `cancelada`, terminal) from any non-terminal state. staff_admin-only. */
export async function cancelMeeting(meetingId: string): Promise<ActionState> {
  return runLifecycle(
    meetingId,
    'cancel_meeting',
    MEETING_MESSAGES.meetingCancelled,
  )
}

/**
 * Persist the minutes narrative (`minutes_md`, sanitized Markdown — Architecture
 * Rule 7). Editable only while `agendada`/`realizada`; rejected once locked.
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
    agendaItemId: data.id,
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
 * Override the computed quorum verdict (`quorum_met`) — the secretary's call.
 * Allowed while `em_assinatura`. staff_admin-only.
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
  return { ok: true, error: MEETING_MESSAGES.caseLinked, caseLinkId: data.id }
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
 * the `add_meeting_attachment` RPC — objects are never overwritten (Rule 6).
 * staff_admin-only.
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

  const supabase = await createClient()
  const commissionId = await commissionOfMeeting(supabase, meetingId)
  if (!commissionId) return { ok: false, error: MEETING_MESSAGES.missingMeeting }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MEETING_MESSAGES.forbidden }
  }

  // Immutable path: commission folder (RLS boundary) / meeting folder / uuid.ext.
  const path = `${commissionId}/${meetingId}/${crypto.randomUUID()}.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('meeting-attachments')
    .upload(path, bytes, { contentType: file.type, upsert: false })
  if (uploadError) return { ok: false, error: MEETING_MESSAGES.uploadFailed }

  const { data, error } = await supabase.rpc('add_meeting_attachment', {
    p_meeting_id: meetingId,
    p_kind: kind,
    p_title: title,
    p_storage_path: path,
    p_mime_type: file.type,
    p_size_bytes: file.size,
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

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_meeting_attachment', {
    p_attachment_id: attachmentId,
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
 * present-attendee row of an `em_assinatura` meeting (HC036 if not entitled,
 * HC035 if already signed). Routed through the SECURITY DEFINER `sign_meeting`
 * RPC, which computes the `content_hash` and count-and-flips to `assinada` when
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

  const { data, error } = await supabase.rpc('create_meeting_action_item', {
    p_meeting_id: meetingId,
    p_title: input.title.trim(),
    p_description: input.description ?? undefined,
    p_assigned_to: input.assignedTo ?? undefined,
    p_due_date: dueDate ?? undefined,
    p_source_agenda_item_id: input.sourceAgendaItemId ?? undefined,
    p_case_id: input.caseId ?? undefined,
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
  const { error } = await supabase.rpc('update_meeting_action_item', {
    p_action_item_id: actionItemId,
    p_title: input.title.trim(),
    p_description: input.description ?? undefined,
    p_assigned_to: input.assignedTo ?? undefined,
    p_due_date: dueDate ?? undefined,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.actionItemUpdated }
}

/**
 * Advance an action item to another lifecycle `status`. Routed through
 * `advance_meeting_action_item`: the caller must be the assignee OR a staff_admin
 * of the meeting's commission (HC037 otherwise). No commission-scoped pre-check
 * here — a plain assignee must be allowed through (mirrors `advanceActionItem`).
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
  const { error } = await supabase.rpc('advance_meeting_action_item', {
    p_action_item_id: actionItemId,
    p_status: status,
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
  const { error } = await supabase.rpc('complete_meeting_action_item', {
    p_action_item_id: actionItemId,
  })

  if (error) return { ok: false, error: mapMeetingError(error) }

  revalidateMeetings()
  return { ok: true, error: MEETING_MESSAGES.actionItemCompleted }
}

/**
 * HARD-delete an action item (remove a mistakenly-created row). staff_admin-only
 * — authorized by the staff_admin-write RLS policy + an explicit authz check. To
 * CANCEL (keep the row), use `advanceMeetingActionItem(id, 'cancelled')`.
 */
export async function deleteMeetingActionItem(
  actionItemId: string,
): Promise<ActionState> {
  if (!actionItemId) return { ok: false, error: MEETING_MESSAGES.missingActionItem }
  if (!(await meetingsEnabled())) {
    return { ok: false, error: MEETING_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { data: item } = await supabase
    .from('meeting_action_items')
    .select('commission_id')
    .eq('id', actionItemId)
    .maybeSingle()
  const commissionId = item?.commission_id
  if (!commissionId) {
    return { ok: false, error: MEETING_MESSAGES.missingActionItem }
  }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MEETING_MESSAGES.forbidden }
  }

  const { error } = await supabase
    .from('meeting_action_items')
    .delete()
    .eq('id', actionItemId)

  if (error) return { ok: false, error: MEETING_MESSAGES.generic }

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
  if (!(await authorizeCommission(commissionId))) {
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
  if (!(await authorizeCommission(commissionId))) {
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
