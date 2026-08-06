import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/types/database'
import type { MeetingMinutesContext, ServiceAgendaRef, ServiceAttendee } from '@/lib/audio-jobs/types'

/**
 * The D14 context composer — everything `job_type = meeting_minutes` sends beyond the
 * audio, and NOTHING MORE.
 *
 * ⭐ **D14 is a minimum-necessary boundary, not a convenience.** Agenda **titles** go to
 * the service; agenda **descriptions, discussion notes and resolutions never leave the
 * platform**. The substance tier stays home. Two independent mechanisms enforce that
 * here, because one of them is a string and strings rot silently:
 *
 *   1. the agenda read asks PostgREST for `id, title` only, so the substance columns are
 *      never even serialized onto the wire; and
 *   2. {@link buildAgendaRefs} constructs each ref field-by-field, so a future `select('*')`
 *      would still not put a description into the payload.
 *
 * T2 asserts both. The `ServiceAgendaRef.description` field is typed `never` upstream, so
 * a third line of defence fails the build.
 *
 * ⚠ The agenda read goes through `public.get_meeting_agenda_items`, NOT a direct table
 * select. `meeting_agenda_items` does not grant `title` to `authenticated` at all (the
 * column grant is `created_at, created_by, id, meeting_id, position, updated_at`), so a
 * direct select would fail 42501. The DEFINER door is the only reader, and it applies
 * `app._project_meeting_agenda_item`'s masking — which for the canEdit uploader (never a
 * case respondent, always deliberation-capable) leaves titles unmasked. That is the
 * plan's A7/O6 risk, resolved: the composer reads the server-side, unmasked-for-staff
 * projection, never a client-supplied payload.
 */

type Client = SupabaseClient<Database>

/** One agenda row as the composer is willing to see it. */
interface AgendaTitleRow {
  id: string
  title: string | null
}

interface AttendeeRow {
  id: string
  user_id: string | null
  external_name: string | null
  role: string | null
  profiles: { full_name: string | null } | null
}

/** The exact column list sent to PostgREST for the agenda read. Exported for T2. */
export const AGENDA_TITLE_COLUMNS = 'id, title'

/**
 * Build `ServiceAgendaRef[]` from rows. Constructs each object explicitly — this is the
 * second D14 guard, and the reason it is a named exported function is so T2 can hand it
 * a row polluted with `description` and assert the output has no such key.
 */
export function buildAgendaRefs(rows: readonly AgendaTitleRow[]): ServiceAgendaRef[] {
  return rows
    .filter((row) => (row.title ?? '').trim().length > 0)
    .map((row) => ({ ref: row.id, title: (row.title ?? '').trim() }))
}

/** Build `ServiceAttendee[]`. Guests are included — they can be attributed speech (D14). */
export function buildAttendees(rows: readonly AttendeeRow[]): ServiceAttendee[] {
  return rows
    .map((row) => ({
      ref: row.id,
      name: (row.profiles?.full_name ?? row.external_name ?? '').trim(),
      role: row.role ?? null,
    }))
    .filter((attendee) => attendee.name.length > 0)
}

export interface ComposeResult {
  context: MeetingMinutesContext
  /** Attendee ref → platform user id, for the callback normalizer's owner resolution. */
  attendeeUserIds: Map<string, string>
  /** Attendee ref → display name, for the speakers panel. */
  attendeeNames: Map<string, string>
}

/**
 * Compose the job context for one meeting.
 *
 * Returns `null` when the meeting cannot be read — the caller turns that into a pt-BR
 * error; it never throws.
 */
export async function composeMeetingMinutesContext(
  supabase: Client,
  meetingId: string,
): Promise<ComposeResult | null> {
  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .select('id, commission_id, held_at, scheduled_start, commissions:commission_id ( name )')
    .eq('id', meetingId)
    .maybeSingle<{
      id: string
      commission_id: string
      held_at: string | null
      scheduled_start: string
      commissions: { name: string } | null
    }>()

  if (meetingError || !meeting) return null

  const { data: attendeeRows, error: attendeeError } = await supabase
    .from('meeting_attendees')
    .select('id, user_id, external_name, role, profiles:user_id ( full_name )')
    .eq('meeting_id', meetingId)
    .returns<AttendeeRow[]>()

  if (attendeeError) return null

  // ⭐ D14: `.select(AGENDA_TITLE_COLUMNS)` on the RPC result. Without it the DEFINER
  // returns SETOF meeting_agenda_items — every substance column included — and the
  // descriptions would reach this process even if the composer then ignored them.
  const { data: agendaRows, error: agendaError } = await supabase
    .rpc('get_meeting_agenda_items', { p_meeting_id: meetingId })
    .select(AGENDA_TITLE_COLUMNS)
    .returns<AgendaTitleRow[]>()

  if (agendaError) return null

  const attendees = attendeeRows ?? []
  const attendeeUserIds = new Map<string, string>()
  const attendeeNames = new Map<string, string>()
  for (const row of attendees) {
    if (row.user_id) attendeeUserIds.set(row.id, row.user_id)
    const name = (row.profiles?.full_name ?? row.external_name ?? '').trim()
    if (name) attendeeNames.set(row.id, name)
  }

  return {
    context: {
      committee_name: meeting.commissions?.name ?? 'Comissão',
      // D14: held_at anchors relative deadlines ("em duas semanas"); fall back to the
      // planned start so a meeting held without a recorded window still gets an anchor.
      meeting_date: meeting.held_at ?? meeting.scheduled_start ?? null,
      attendees: buildAttendees(attendees),
      agenda: buildAgendaRefs(agendaRows ?? []),
    },
    attendeeUserIds,
    attendeeNames,
  }
}
