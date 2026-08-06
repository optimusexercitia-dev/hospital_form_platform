import 'server-only'

import type { CallbackPayload, MeetingMinutesResult } from '@/lib/audio-jobs/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { MEETING_AUDIO_BUCKET } from './constants'
import { defaultMakeKey, normalizeMinutesResult } from './normalize'
import { deleteAudio } from './reconcile'
import { sweepStaleAudio } from './sweep'

/**
 * The `meeting_minutes` arm of the audio-jobs webhook (ADR 0099 D10/D18).
 *
 * Split out of the route handler so the dispatch (signature → parse → kind) stays
 * readable and so THIS — the part with the state transitions — is unit-testable without
 * constructing a `Request`.
 *
 * Everything runs on the service-role client: the caller is the service, there is no user
 * session, and `complete_minutes_job`/`fail_minutes_job` are `service_role`-only by
 * design. Idempotency is the RPCs' status latch, not a check here — a re-delivery is a
 * no-op that returns `updated: false`, which the route answers 200 to so the service
 * stops retrying.
 */

export interface HandlerOutcome {
  handled: boolean
  updated: boolean
  note: string
}

interface JobMutationResult {
  updated?: boolean
  status?: string | null
  meeting_id?: string | null
  commission_id?: string | null
  requested_by?: string | null
  audio_path?: string | null
}

export async function handleMeetingMinutesCallback(
  platformJobId: string,
  payload: CallbackPayload,
): Promise<HandlerOutcome> {
  // The O3 sweep's other trigger, and the better of the two: a callback is machine-driven
  // and regular, so reclamation does not wait for a human to open a page. Throttled
  // in-process, fire-and-forget — it must never delay or fail the 200 this route owes the
  // service.
  void sweepStaleAudio()

  const admin = createAdminClient()

  if (payload.status === 'done') {
    const result = payload.result as MeetingMinutesResult | null | undefined
    if (!result?.minutes) {
      // `status=done` with no result is a contract violation. Treat it as a failure
      // rather than writing an empty draft the reviewer would have to puzzle over.
      return failJob(platformJobId, 'MALFORMED_RESULT', 'O serviço devolveu um resultado vazio.')
    }

    const draft = await buildDraft(platformJobId, result)

    const { data, error } = await admin.rpc('complete_minutes_job', {
      p_job_id: platformJobId,
      p_result: payload.result as never,
      p_transcript: result.transcript ?? '',
      p_draft: draft as never,
    })
    if (error) return { handled: true, updated: false, note: `complete failed: ${error.code}` }

    const outcome = (data ?? {}) as JobMutationResult
    if (!outcome.updated) {
      return { handled: true, updated: false, note: `no-op (status=${outcome.status ?? 'missing'})` }
    }

    // D2/service ADR 0003: the audio may only be deleted once the service says so. While
    // the shadow comparison still needs it, `audio_release` is false and the 24h TTL
    // sweep in `./reconcile.ts` becomes the backstop.
    if (payload.audio_release && outcome.audio_path) {
      await deleteAudio(platformJobId, outcome.audio_path)
    }
    return { handled: true, updated: true, note: 'done' }
  }

  if (payload.status === 'error') {
    return failJob(
      platformJobId,
      payload.error_code ?? 'SERVICE_ERROR',
      // NEVER surface `payload.error` — it is the service's internal English text and
      // would reach the user's chip verbatim (Rule 10). The code goes to the audit row.
      'Não foi possível gerar a ata a partir deste áudio.',
      payload.audio_release,
    )
  }

  // `queued` / `processing` / `cancelled` callbacks are not part of the contract's
  // delivery model (the service calls back exactly once, terminally). Drop them.
  return { handled: false, updated: false, note: `ignored status ${payload.status}` }
}

async function failJob(
  platformJobId: string,
  code: string,
  message: string,
  releaseAudio = true,
): Promise<HandlerOutcome> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('fail_minutes_job', {
    p_job_id: platformJobId,
    p_error_code: code,
    p_error_message: message,
  })
  if (error) return { handled: true, updated: false, note: `fail failed: ${error.code}` }

  const outcome = (data ?? {}) as JobMutationResult
  if (!outcome.updated) {
    return { handled: true, updated: false, note: `no-op (status=${outcome.status ?? 'missing'})` }
  }
  if (releaseAudio && outcome.audio_path) {
    await deleteAudio(platformJobId, outcome.audio_path)
  }
  return { handled: true, updated: true, note: 'failed' }
}

/**
 * Normalize the service payload into the review draft.
 *
 * Owner refs resolve to platform user ids ONLY for attendees who are commission members
 * (B0 §4 R2): the action-items door rejects anyone else with HC021, and although apply
 * downgrades rather than aborting, pre-assigning a guest would show the reviewer an owner
 * that silently disappears at "Concluir".
 */
async function buildDraft(platformJobId: string, result: MeetingMinutesResult) {
  const admin = createAdminClient()

  const { data: job } = await admin
    .from('meeting_minutes_jobs')
    .select('meeting_id')
    .eq('id', platformJobId)
    .maybeSingle<{ meeting_id: string }>()

  const userIds = new Map<string, string>()
  const names = new Map<string, string>()

  if (job?.meeting_id) {
    const { data: meeting } = await admin
      .from('meetings')
      .select('commission_id')
      .eq('id', job.meeting_id)
      .maybeSingle<{ commission_id: string }>()

    const { data: attendees } = await admin
      .from('meeting_attendees')
      .select('id, user_id, external_name, profiles:user_id ( full_name )')
      .eq('meeting_id', job.meeting_id)
      .returns<
        {
          id: string
          user_id: string | null
          external_name: string | null
          profiles: { full_name: string | null } | null
        }[]
      >()

    const memberIds = await resolveCommissionMembers(
      meeting?.commission_id ?? null,
      (attendees ?? []).map((a) => a.user_id).filter((id): id is string => typeof id === 'string'),
    )

    for (const attendee of attendees ?? []) {
      if (attendee.user_id && memberIds.has(attendee.user_id)) {
        userIds.set(attendee.id, attendee.user_id)
      }
      const name = (attendee.profiles?.full_name ?? attendee.external_name ?? '').trim()
      if (name) names.set(attendee.id, name)
    }
  }

  return normalizeMinutesResult(result, {
    resolveOwnerUserId: (ref) => userIds.get(ref) ?? null,
    resolveAttendeeName: (ref) => names.get(ref) ?? null,
    makeKey: defaultMakeKey,
  })
}

/**
 * Which of these users are active members of the commission?
 *
 * ⚠ This MIRRORS `app.is_member_of_for` = `app.is_active(u) AND app.has_role_any(
 * 'commission', c, u)`, transcribed from the live catalog:
 *   - `memberships` has NO `scope_type`/`scope_id` pair — the scopes are three separate
 *     nullable FK columns (`organization_id` / `hospital_id` / `commission_id`) under an
 *     exclusivity CHECK, and the row is keyed `principal_id`, not `user_id`;
 *   - a membership counts only while `expires_at is null or expires_at > now()`;
 *   - "active" is `profiles.is_active AND (suspended_until is null or now() >= it)`.
 *
 * This is a PRE-FILL, not an authorization decision. `apply_minutes_review` re-checks
 * every assignee with the real predicate and downgrades a non-member to unassigned (PO
 * decision O2), so drift here costs the reviewer one manual pick — never a wrong write.
 * Duplicating the predicate at all is justified only because the alternative is showing a
 * pre-assigned owner that silently vanishes at "Concluir".
 */
async function resolveCommissionMembers(
  commissionId: string | null,
  candidateUserIds: readonly string[],
): Promise<Set<string>> {
  const members = new Set<string>()
  if (!commissionId || candidateUserIds.length === 0) return members
  const admin = createAdminClient()
  const ids = [...new Set(candidateUserIds)]

  const nowIso = new Date().toISOString()
  const { data: memberships } = await admin
    .from('memberships')
    .select('principal_id')
    .eq('commission_id', commissionId)
    .in('principal_id', ids)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .returns<{ principal_id: string }[]>()

  const seated = new Set((memberships ?? []).map((m) => m.principal_id))
  if (seated.size === 0) return members

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, is_active, suspended_until')
    .in('id', [...seated])
    .returns<{ id: string; is_active: boolean; suspended_until: string | null }[]>()

  for (const profile of profiles ?? []) {
    const suspended = profile.suspended_until !== null && new Date(profile.suspended_until) > new Date()
    if (profile.is_active && !suspended) members.add(profile.id)
  }
  return members
}

export { MEETING_AUDIO_BUCKET }
