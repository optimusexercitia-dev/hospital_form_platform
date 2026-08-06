import 'server-only'

import { getAudioJobStatus, isAudioServiceConfigured } from '@/lib/audio-jobs/client'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  ABANDONED_UPLOAD_HOURS,
  AUDIO_TTL_HOURS,
  MEETING_AUDIO_BUCKET,
  RECONCILE_AFTER_HOURS,
} from './constants'
import type { MinutesJobStatus } from './types'

/**
 * Lazy reconciliation (ADR 0099 D10). No cron, no queue: when a page loads a job that has
 * been in flight too long, the server repairs it before returning. A stale row nobody is
 * looking at harms nobody until they look.
 *
 * **Internal by decision** — `getActiveMinutesJob` and `getMinutesJobForReview` call this
 * before they return, and it is NOT exported to the frontend. Reconciliation a page has
 * to remember to invoke is reconciliation that silently stops running.
 *
 * It never throws and never blocks a render on a slow service: every failure path leaves
 * the row exactly as it was, to be retried on the next page load.
 */

export interface ReconcilableJob {
  id: string
  status: MinutesJobStatus
  createdAt: string
  audioPath: string | null
  audioDeletedAt: string | null
  serviceJobId: string | null
}

/** What the reconciler did, for the caller to re-read if the row changed. */
export type ReconcileOutcome = 'noop' | 'failed_job' | 'deleted_audio'

const HOUR_MS = 60 * 60 * 1000

export async function reconcileMinutesJob(job: ReconcilableJob): Promise<ReconcileOutcome> {
  try {
    return await run(job)
  } catch {
    // A reconciliation failure must never surface as a broken page. The row stays as it
    // was and the next page load tries again.
    return 'noop'
  }
}

async function run(job: ReconcilableJob): Promise<ReconcileOutcome> {
  const ageMs = Date.now() - new Date(job.createdAt).getTime()
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'noop'
  const ageHours = ageMs / HOUR_MS

  // ── `done` past the TTL: delete the AUDIO ONLY. ────────────────────────────
  // The job stays `done` and keeps its transcript/result/draft. D2 wants the recording
  // gone; it does not want the work destroyed. Failing a review the user can already see
  // would be a data-loss bug wearing a TTL costume — `done` is not a terminal state, it
  // is a state waiting on a person.
  if (job.status === 'done') {
    if (ageHours >= AUDIO_TTL_HOURS && job.audioPath && !job.audioDeletedAt) {
      await deleteAudio(job.id, job.audioPath)
      return 'deleted_audio'
    }
    return 'noop'
  }

  if (job.status !== 'uploading' && job.status !== 'processing') return 'noop'

  // ── Hard TTL: any job still in flight after 24 h is dead. ──────────────────
  if (ageHours >= AUDIO_TTL_HOURS) {
    await failJob(job, 'TTL_EXPIRED', 'O processamento excedeu o tempo limite de 24 horas.')
    return 'failed_job'
  }

  // ── An abandoned upload. ──────────────────────────────────────────────────
  // The browser never reported the bytes finished, so no service job exists. Left alone
  // this row sits in the active set forever and `meeting_minutes_jobs_active_uidx` blocks
  // the meeting from ever running audio again — which is why `fail_minutes_job` accepts
  // `uploading` (a processing-only latch could not express this).
  if (job.status === 'uploading') {
    if (ageHours >= ABANDONED_UPLOAD_HOURS) {
      await failJob(job, 'UPLOAD_ABANDONED', 'O envio do áudio não foi concluído.')
      return 'failed_job'
    }
    return 'noop'
  }

  // ── `processing` past the poll threshold: ask the service. ────────────────
  if (ageHours < RECONCILE_AFTER_HOURS) return 'noop'
  if (!job.serviceJobId || !isAudioServiceConfigured()) return 'noop'

  const status = await getAudioJobStatus(job.serviceJobId)

  if (!status.ok) {
    // A 404 means the service has no record of this job — it will never call back.
    if (status.status === 404) {
      await failJob(job, 'SERVICE_UNKNOWN_JOB', 'O serviço não reconhece este processamento.')
      return 'failed_job'
    }
    // Unreachable / timing out / 5xx: leave it. The service may simply be restarting, and
    // failing a live job because one poll missed would destroy work in progress.
    return 'noop'
  }

  switch (status.data.status) {
    case 'done':
      // The work IS finished and the callback was missed or is still retrying. Do NOT
      // mark it failed: the callback carries the minutes and the transcript, which this
      // poll does not, so failing here would throw away a completed job.
      return 'noop'
    case 'error':
    case 'cancelled':
      await failJob(
        job,
        status.data.error_code ?? 'SERVICE_ERROR',
        'O serviço não conseguiu processar este áudio.',
      )
      return 'failed_job'
    default:
      return 'noop'
  }
}

async function failJob(job: ReconcilableJob, code: string, message: string): Promise<void> {
  const admin = createAdminClient()
  // The RPC is service_role-only and idempotent: if a callback landed a millisecond ago
  // the row is no longer in the latch set and this is a no-op returning updated=false.
  await admin.rpc('fail_minutes_job', {
    p_job_id: job.id,
    p_error_code: code,
    p_error_message: message,
  })
  if (job.audioPath && !job.audioDeletedAt) {
    await deleteAudio(job.id, job.audioPath)
  }
}

/**
 * Remove the storage object and stamp `audio_deleted_at`.
 *
 * Storage first, then the stamp: if the delete succeeds and the stamp fails we retry a
 * harmless delete next time, whereas stamping first would leave an orphan object that no
 * later pass would ever look for.
 */
export async function deleteAudio(jobId: string, audioPath: string): Promise<void> {
  const admin = createAdminClient()
  const { error } = await admin.storage.from(MEETING_AUDIO_BUCKET).remove([audioPath])
  // A "not found" is success for our purposes — the object is gone either way.
  if (error && !/not.?found/i.test(error.message)) return
  await admin
    .from('meeting_minutes_jobs')
    .update({ audio_deleted_at: new Date().toISOString() })
    .eq('id', jobId)
}
