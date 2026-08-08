import { expect, type Page } from '@playwright/test'

import {
  addAttendee,
  callRPC,
  firstMeetingTypeId,
  sql,
  COMM_CCIH_ID,
  CHEFE_CCIH_ID,
  ORG_SLUG,
  COMMISSION_SLUG,
} from './minutes'
import { serviceQuery } from './documents'

/**
 * Shared scaffolding for the PDF·P2 (Meetings) E2E suite (ADR 0104; plan
 * docs/plans/pdf-document-printing.md §3). Reuses the meeting RPC/auth
 * plumbing already in `./minutes` (`callRPC`/`getOwnerToken`/`addAttendee`/
 * `sql` back the audio-minutes suite; nothing here is minutes-specific)
 * rather than re-deriving it, exactly as `./pdf-printing` reuses `./documents`.
 *
 * Local Supabase stack only. Every mutation under test goes through a real
 * RPC (`create_meeting`, `conclude_meeting`, `sign_meeting`, …) — the ONE
 * exception is `setMeetingVisibilityParticipantsOnly`, documented at its
 * definition: no RPC exposes `meetings.visibility_policy` to the app layer
 * today, so setting it is fixture/flag-class scaffolding (mirrors
 * `setControlledDocsFlag`/`setAudioMinutesFlag`), never data under test.
 */

export const meetingHref = (meetingId: string) =>
  `/o/${ORG_SLUG}/c/${COMMISSION_SLUG}/meetings/${meetingId}`

async function rpcOrThrow(
  page: Page,
  token: string,
  name: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const result = await callRPC(page, token, name, body)
  if (result.status !== 200) {
    throw new Error(`${name} failed: ${result.status} ${JSON.stringify(result.body)}`)
  }
  return result.body
}

/** Create a fresh `scheduled` CCIH meeting as the given (coordinator) token. */
export async function createScheduledMeeting(
  page: Page,
  token: string,
  title: string,
): Promise<string> {
  const typeId = await firstMeetingTypeId(page)
  const body = (await rpcOrThrow(page, token, 'create_meeting', {
    p_commission_id: COMM_CCIH_ID,
    p_meeting_type_id: typeId,
    p_title: title,
    p_scheduled_start: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
    p_modality: 'presencial',
  })) as { id: string }
  return body.id
}

/** `scheduled` -> `held` (no attendee/quorum requirement). */
export async function markHeld(page: Page, token: string, meetingId: string): Promise<void> {
  await rpcOrThrow(page, token, 'mark_meeting_held', {
    p_meeting_id: meetingId,
    p_held_at: new Date(Date.now() - 24 * 3600_000).toISOString(),
  })
}

/**
 * Drives an already-`held` meeting all the way to `signed` through the REAL
 * signature flow: add one PRESENT attendee -> `conclude_meeting` (held ->
 * in_signature, requires >=1 present attendee) -> `sign_meeting` as that same
 * attendee (required=1, signed=1 -> the RPC's own auto-flip to `signed`).
 * Returns the attendee id, in case a caller wants to sign again / assert on it.
 */
export async function signMeetingToSigned(
  page: Page,
  token: string,
  meetingId: string,
  attendeeUserId: string = CHEFE_CCIH_ID,
): Promise<string> {
  const attendeeId = await addAttendee(page, token, meetingId, attendeeUserId, 'presidente')
  await rpcOrThrow(page, token, 'conclude_meeting', { p_meeting_id: meetingId })
  await rpcOrThrow(page, token, 'sign_meeting', { p_attendee_id: attendeeId })
  return attendeeId
}

/** DB-truth read of a meeting's lifecycle status (service-role, assertions only). */
export async function meetingStatus(page: Page, meetingId: string): Promise<string> {
  const rows = await serviceQuery<{ status: string }>(
    page,
    `meetings?id=eq.${meetingId}&select=status`,
  )
  expect(rows.length, `meeting ${meetingId} exists`).toBe(1)
  return rows[0].status
}

/**
 * Add an agenda item WITH free-text substance (`description`) — the A7
 * gated-content shape (`app._project_meeting_agenda_item`'s substance tier:
 * masked for anyone lacking `read_case_deliberation` on every linked case).
 * `./minutes`'s `addAgendaItem` only ever sends `p_title`; this is the same
 * RPC with `p_description` added, needed to reproduce the QA r1 BLOCKER-1
 * fixture shape (title masked for the respondent regardless; description
 * masked for anyone without the deliberation capability).
 */
export async function addAgendaItemWithDescription(
  page: Page,
  token: string,
  meetingId: string,
  title: string,
  description: string,
): Promise<string> {
  const id = await rpcOrThrow(page, token, 'create_meeting_agenda_item', {
    p_meeting_id: meetingId,
    p_title: title,
    p_description: description,
  })
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`create_meeting_agenda_item returned an unexpected shape: ${JSON.stringify(id)}`)
  }
  return id
}

/**
 * Link a meeting (agenda item) to a case — `link_meeting_case` (authority:
 * `assert_meeting_staff_admin` on the MEETING; the case just needs to exist).
 * Real RPC, no seed mutation: it inserts a `meeting_cases` row referencing an
 * EXISTING case, never touches the case or its participants.
 */
export async function linkMeetingCase(
  page: Page,
  token: string,
  meetingId: string,
  caseId: string,
  agendaItemId: string,
): Promise<void> {
  await rpcOrThrow(page, token, 'link_meeting_case', {
    p_meeting_id: meetingId,
    p_case_id: caseId,
    p_agenda_item_id: agendaItemId,
  })
}

/**
 * The seeded ETH·E1 ethics case (`supabase/seed.sql`, "Denúncia Ética
 * (fixture E1)") — CCIH-commission, `explicit_grants_only` visibility, with
 * `staff4.ccih@test.local` bound as its `respondent_doctor` (a REAL platform
 * user, professional-identity chain already wired: `participants` ->
 * `professional_profiles.user_id` -> `case_participants` role
 * `respondent_doctor`) and `chefe.ccih` holding an explicit
 * `read_case_deliberation` grant. Reused READ-ONLY here (never mutated) so
 * the A7 respondent-denial test needs no new participants-chain fixture of
 * its own — only a fresh meeting + agenda item + `link_meeting_case`, all via
 * real RPCs.
 */
export const SEED_ETHICS_CASE_ID = 'ca000000-0000-0000-0000-0000000000e1'
export const RESPONDENT_STAFF4_EMAIL = 'staff4.ccih@test.local'

/**
 * Flip a meeting to `participants_only` visibility (ADR 0078 C3 — restricted
 * to attendees + reached via the SAME `app.can_reach_meeting` predicate the
 * PDF module's `meeting` RLS arm delegates to). No product RPC sets this
 * column (verified against `pg_proc` — every `*meeting*` function catalogued,
 * none takes a visibility param); the roster-nonempty trigger
 * (`trg_meetings_roster`) requires at least one attendee already on the
 * meeting, so call this AFTER seeding one via `addAttendee`/`signMeetingToSigned`.
 */
export function setMeetingVisibilityParticipantsOnly(meetingId: string): void {
  sql(`update public.meetings set visibility_policy = 'participants_only' where id = '${meetingId}';`)
}

export { getOwnerToken, addAttendee, signInAs, CHEFE_CCIH_ID, STAFF1_CCIH_ID } from './minutes'
