'use server'

import { revalidatePath } from 'next/cache'

import { submitAudioJob, cancelAudioJob } from '@/lib/audio-jobs/client'
import { buildAudioJobMetadata } from '@/lib/audio-jobs/metadata'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { featureEnabled } from '@/lib/queries/feature-flags'
import {
  AUDIO_DOWNLOAD_URL_TTL_SECONDS,
  MAX_AUDIO_BYTES,
  MEETING_AUDIO_BUCKET,
  isAllowedAudioType,
} from './constants'
import { buildCallbackUrl } from './callback-url'
import { composeMeetingMinutesContext } from './context'
import { MINUTES_MESSAGES, mapMinutesError } from './messages'
import { foldVerbatimIntoDescription } from './normalize'
import { deleteAudio } from './reconcile'
import { stripHtmlTags } from './sanitize'
import type { MinutesApplyCounts, MinutesDraft } from './types'

/**
 * MIN server actions (ADR 0099; Architecture Rules 9 & 10).
 *
 * Authority is the DATABASE: every mutation goes through a `SECURITY DEFINER` RPC whose
 * gate is `app.is_staff_admin_of(app.commission_of_meeting(...))` — the same predicate the
 * Ata editor already uses. Nothing here re-implements that check; the actions map the
 * RPC's coded error onto pt-BR and stop.
 *
 * The service-role client appears in exactly three places, all of them genuinely
 * unable to use the user's session: minting the signed upload URL and the signed download
 * URL (the `meeting-audio` bucket has NO `authenticated` storage policies, by design —
 * B1), and deleting the object. Each is preceded by an RPC call that already enforced the
 * caller's authority, so RLS is not the thing being bypassed — the storage ACL is.
 */

export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

export interface StartMinutesJobState extends ActionState {
  jobId?: string
  /**
   * The FULL signed upload URL, token already in the query string.
   *
   * ⚠ F2 cannot use `supabase.storage.uploadToSignedUrl` — verified against the installed
   * `@supabase/storage-js` 2.108.1, its `FileOptions` has no `onUploadProgress` and the
   * implementation is fetch-based, which cannot report upload progress at all. TUS is not
   * available against a signed URL either. So F2 hand-rolls an `XMLHttpRequest` PUT, and a
   * return shape carrying only `{path, token}` would force it to re-derive this URL from
   * `NEXT_PUBLIC_SUPABASE_URL` + bucket + path.
   *
   * VERIFIED RECIPE (probed against the running stack, not inferred):
   *
   *     const form = new FormData()
   *     form.append('cacheControl', '3600')
   *     form.append('', file)              // note: EMPTY field name, as storage-js does
   *     xhr.open('PUT', uploadUrl)         // NO apikey, NO authorization header
   *     xhr.upload.onprogress = …
   *     xhr.send(form)                     // do NOT set Content-Type: the browser must
   *                                        // set the multipart boundary itself
   *
   * A PUT shaped exactly like that returned HTTP 200 with no auth headers at all — the
   * token in the URL is the entire authorization.
   */
  uploadUrl?: string
  /** Object path inside the `meeting-audio` bucket. */
  path?: string
  /** The bare token, for a caller that prefers `uploadToSignedUrl` (no progress). */
  token?: string
}

const MEETINGS_LIST_PATH = '/o/[org]/c/[commission]/meetings'
const MEETING_PATH = '/o/[org]/c/[commission]/meetings/[meetingId]'
const REVIEW_PATH = '/o/[org]/c/[commission]/meetings/[meetingId]/revisao-ata'

function revalidateMinutes(): void {
  revalidatePath(MEETINGS_LIST_PATH, 'page')
  revalidatePath(MEETING_PATH, 'page')
  revalidatePath(REVIEW_PATH, 'page')
}

/**
 * F2 step 2, on file selection: mint the job row and the signed upload URL.
 *
 * Order matters. The RPC runs FIRST so an unauthorized caller never causes a storage
 * object to be signed for, and the job id it returns is what composes the object path
 * server-side (the client never supplies a storage path).
 */
export async function startMinutesJob(
  meetingId: string,
  filename: string,
  contentType: string,
  size: number,
): Promise<StartMinutesJobState> {
  if (!(await featureEnabled('audio_minutes'))) {
    return { ok: false, error: MINUTES_MESSAGES.unavailable }
  }
  // Client-side mirrors of the bucket's own ceilings — a courtesy, never the control.
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: MINUTES_MESSAGES.fileMissing }
  }
  if (size > MAX_AUDIO_BYTES) {
    return { ok: false, error: MINUTES_MESSAGES.fileTooLarge }
  }
  if (!isAllowedAudioType(contentType)) {
    return { ok: false, error: MINUTES_MESSAGES.fileTypeInvalid }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_minutes_job', {
    p_meeting_id: meetingId,
    p_filename: filename,
  })
  if (error) return { ok: false, error: mapMinutesError(error) }

  const created = data as { job_id?: string; audio_path?: string } | null
  if (!created?.job_id || !created.audio_path) {
    return { ok: false, error: MINUTES_MESSAGES.generic }
  }

  // Service-role: the bucket has no `authenticated` INSERT policy, so the user's own
  // client cannot sign for its own upload. The RPC above already proved authority.
  const admin = createAdminClient()
  const { data: signed, error: signError } = await admin.storage
    .from(MEETING_AUDIO_BUCKET)
    .createSignedUploadUrl(created.audio_path)

  if (signError || !signed) {
    // Leave no half-open job blocking the meeting's one-active-job slot.
    await supabase.rpc('cancel_minutes_job', { p_job_id: created.job_id })
    return { ok: false, error: MINUTES_MESSAGES.uploadUrlFailed }
  }

  return {
    ok: true,
    jobId: created.job_id,
    uploadUrl: signed.signedUrl,
    path: created.audio_path,
    token: signed.token,
  }
}

/**
 * F2, after the browser reports the direct upload finished: compose the D14 context, hand
 * the job to the service, and latch the row to `processing`.
 */
export async function submitMinutesJob(jobId: string): Promise<ActionState> {
  if (!(await featureEnabled('audio_minutes'))) {
    return { ok: false, error: MINUTES_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  // RLS-scoped: a non-canEdit caller reads no row and gets the same refusal the RPCs give.
  const { data: job } = await supabase
    .from('meeting_minutes_jobs')
    .select('id, meeting_id, status, audio_path')
    .eq('id', jobId)
    .maybeSingle<{ id: string; meeting_id: string; status: string; audio_path: string | null }>()

  if (!job) return { ok: false, error: MINUTES_MESSAGES.forbidden }
  if (job.status !== 'uploading') return { ok: false, error: MINUTES_MESSAGES.jobWrongState }
  if (!job.audio_path) return { ok: false, error: MINUTES_MESSAGES.generic }

  const composed = await composeMeetingMinutesContext(supabase, job.meeting_id)
  if (!composed) return { ok: false, error: MINUTES_MESSAGES.generic }

  const admin = createAdminClient()
  const { data: signedDownload, error: signError } = await admin.storage
    .from(MEETING_AUDIO_BUCKET)
    .createSignedUrl(job.audio_path, AUDIO_DOWNLOAD_URL_TTL_SECONDS)

  if (signError || !signedDownload?.signedUrl) {
    return failAndCleanUp(job.id, job.audio_path, 'SIGN_FAILED', MINUTES_MESSAGES.generic)
  }

  const callbackUrl = await buildCallbackUrl()
  if (!callbackUrl) {
    return failAndCleanUp(job.id, job.audio_path, 'NO_CALLBACK_URL', MINUTES_MESSAGES.serviceMisconfigured)
  }

  const submitted = await submitAudioJob({
    job_type: 'meeting_minutes',
    audio_url: signedDownload.signedUrl,
    callback_url: callbackUrl,
    context: composed.context,
    metadata: buildAudioJobMetadata({ platform_job_id: job.id, job_type: 'meeting_minutes' }),
  })

  if (!submitted.ok) {
    // The service never took the job, so no callback will ever arrive. Terminate the row
    // and drop the audio now rather than leaving the meeting blocked for 24 h.
    return failAndCleanUp(
      job.id,
      job.audio_path,
      submitted.failure.toUpperCase(),
      submitted.failure === 'not_configured'
        ? MINUTES_MESSAGES.serviceMisconfigured
        : MINUTES_MESSAGES.serviceUnavailable,
    )
  }

  const { error: submitError } = await supabase.rpc('submit_minutes_job', {
    p_job_id: job.id,
    p_service_job_id: submitted.data.job_id,
  })
  if (submitError) return { ok: false, error: mapMinutesError(submitError) }

  revalidateMinutes()
  return { ok: true, error: MINUTES_MESSAGES.jobStarted }
}

async function failAndCleanUp(
  jobId: string,
  audioPath: string | null,
  code: string,
  message: string,
): Promise<ActionState> {
  const admin = createAdminClient()
  await admin.rpc('fail_minutes_job', {
    p_job_id: jobId,
    p_error_code: code,
    p_error_message: message,
  })
  if (audioPath) await deleteAudio(jobId, audioPath)
  revalidateMinutes()
  return { ok: false, error: message }
}

/**
 * F1's cancel. The platform's own row is marked cancelled IMMEDIATELY (D9) — the service
 * call and the object delete are best-effort afterwards, so cancel works with the service
 * down.
 */
export async function cancelMinutesJob(jobId: string): Promise<ActionState> {
  if (!(await featureEnabled('audio_minutes'))) {
    return { ok: false, error: MINUTES_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('cancel_minutes_job', { p_job_id: jobId })
  if (error) return { ok: false, error: mapMinutesError(error) }

  const cancelled = data as { audio_path?: string | null; service_job_id?: string | null } | null

  if (cancelled?.service_job_id) {
    // Best effort, and a 404 already counts as success inside the client (D9).
    await cancelAudioJob(cancelled.service_job_id)
  }
  if (cancelled?.audio_path) {
    await deleteAudio(jobId, cancelled.audio_path)
  }

  revalidateMinutes()
  return { ok: true, error: MINUTES_MESSAGES.jobCancelled }
}

/** F3's debounced autosave. */
export async function saveMinutesDraft(jobId: string, draft: MinutesDraft): Promise<ActionState> {
  if (!(await featureEnabled('audio_minutes'))) {
    return { ok: false, error: MINUTES_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('save_minutes_draft', {
    p_job_id: jobId,
    p_draft: sanitizeDraft(draft) as never,
  })
  if (error) return { ok: false, error: mapMinutesError(error) }
  return { ok: true }
}

export interface ApplyMinutesReviewState extends ActionState {
  counts?: MinutesApplyCounts
}

/**
 * F3's "Concluir revisão".
 *
 * Two RPCs, in this order, on purpose. `apply_minutes_review` reads the draft FROM THE
 * ROW, so the verbatim owner/deadline fold (D7) cannot be applied in flight — the folded
 * copy is saved first, then applied. The mutation is invisible: apply purges the draft in
 * the same transaction. Folding on every autosave instead would keep re-writing a hint
 * into a description the reviewer had just cleaned up.
 */
export async function applyMinutesReview(
  jobId: string,
  draft: MinutesDraft,
): Promise<ApplyMinutesReviewState> {
  if (!(await featureEnabled('audio_minutes'))) {
    return { ok: false, error: MINUTES_MESSAGES.unavailable }
  }

  const folded: MinutesDraft = {
    ...sanitizeDraft(draft),
    action_items: draft.action_items.map((item) => ({
      ...item,
      description: foldVerbatimIntoDescription(item),
    })),
  }

  const supabase = await createClient()
  const { error: saveError } = await supabase.rpc('save_minutes_draft', {
    p_job_id: jobId,
    p_draft: folded as never,
  })
  if (saveError) return { ok: false, error: mapMinutesError(saveError) }

  const { data, error } = await supabase.rpc('apply_minutes_review', { p_job_id: jobId })
  if (error) return { ok: false, error: mapMinutesError(error) }

  const counts = data as Record<string, number> | null
  revalidateMinutes()
  return {
    ok: true,
    error: MINUTES_MESSAGES.reviewApplied,
    counts: {
      agendaUpdated: counts?.agenda_updated ?? 0,
      agendaCreated: counts?.agenda_created ?? 0,
      actionsCreated: counts?.actions_created ?? 0,
      actionsUnassigned: counts?.actions_unassigned ?? 0,
    },
  }
}

export type ReadTranscriptResult = { ok: true; transcript: string } | { ok: false; error: string }

/**
 * The audited single door (D8/D15). Called ONCE per page visit, on the transcript panel's
 * first expand. Every call writes exactly one `minutes_transcript.read` audit row; a
 * refusal writes none, because the RPC gates itself before it records.
 */
export async function readMinutesTranscript(jobId: string): Promise<ReadTranscriptResult> {
  if (!(await featureEnabled('audio_minutes'))) {
    return { ok: false, error: MINUTES_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('read_minutes_transcript', { p_job_id: jobId })
  if (error) return { ok: false, error: mapMinutesError(error) }
  if (typeof data !== 'string') return { ok: false, error: MINUTES_MESSAGES.transcriptUnavailable }
  return { ok: true, transcript: data }
}

/**
 * Clean the ata before it is stored (Rule 7). See `./sanitize.ts` for why a bare `<`
 * survives and why this runs on the way IN rather than only at apply time.
 */
function sanitizeDraft(draft: MinutesDraft): MinutesDraft {
  return { ...draft, minutes_md: stripHtmlTags(draft.minutes_md ?? '') }
}
