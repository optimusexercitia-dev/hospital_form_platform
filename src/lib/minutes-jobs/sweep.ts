import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { AUDIO_TTL_HOURS, MEETING_AUDIO_BUCKET } from './constants'

/**
 * The stale-audio sweep (ADR 0099 D2's hard TTL; PO decision O3).
 *
 * O3 committed to "the 24 h TTL sweep, extended to cover objects with no live job", and
 * two documents stated it existed. It did not: every deletion path started from a JOB ROW,
 * and `meeting_minutes_jobs.meeting_id` is `ON DELETE CASCADE`, so deleting a meeting
 * destroyed the only pointer to its recording. This is that sweep.
 *
 * **Predicate: every `meeting-audio` object older than 24 h is garbage.** Simpler than
 * "objects with no live job", and deliberately so — D2's hard TTL admits no exception, and
 * one rule with no per-status branching cannot be got wrong the way a branch can. It
 * subsumes the cascade orphan, a delete that failed or timed out, a crashed request, and
 * whatever we have not thought of. (Narrowing it to "no live job" would have left the
 * failed-delete case unswept, which is exactly how the apply-path blocker survived.)
 *
 * **Lazy, no cron** — D10's locked decision. Triggered from two places, chosen so the
 * sweep does not depend on a human:
 *   - the webhook handler, on every callback delivery (machine-driven and regular); and
 *   - `reconcileMinutesJob`, on a page load.
 * Both are throttled in-process so a busy tenant does not re-run it per request.
 *
 * ⚠ The residual is recorded as an ACCEPTED DEVIATION in ADR 0099 (Amendment 1): in a
 * tenant where nothing happens at all — no callbacks, nobody opening a page — nothing
 * triggers, and an object can outlive 24 h. This module is why that residual is small;
 * it is not why it is zero.
 */

/** Minimum wall-clock gap between sweeps in one process. */
const SWEEP_THROTTLE_MS = 10 * 60 * 1000

/** Objects removed per pass. Bounded so a single call stays cheap. */
const SWEEP_BATCH = 200

/**
 * Module-level, therefore PER INSTANCE. On a multi-instance deploy each instance keeps
 * its own clock, so the sweep may run more often than the throttle suggests — never less.
 * That is the safe direction for a best-effort reclaimer, and it needs no shared state.
 */
let lastSweepAtMs = 0

export interface SweepOutcome {
  /** Objects successfully removed from the bucket. */
  deleted: number
  /** True when the throttle skipped this call. */
  skipped: boolean
}

/**
 * Delete every `meeting-audio` object past the TTL and stamp the owning job rows.
 *
 * Never throws: it runs beside a page render and beside a webhook that must answer 200.
 * A failure leaves the objects for the next trigger.
 */
export async function sweepStaleAudio(
  options: { force?: boolean; nowMs?: number } = {},
): Promise<SweepOutcome> {
  const now = options.nowMs ?? Date.now()
  if (!options.force && now - lastSweepAtMs < SWEEP_THROTTLE_MS) {
    return { deleted: 0, skipped: true }
  }
  // Claim the window BEFORE the awaits, so two concurrent requests in the same instance
  // cannot both get past the throttle and issue duplicate deletes.
  lastSweepAtMs = now

  try {
    const admin = createAdminClient()

    const { data: stale, error } = await admin.rpc('list_stale_meeting_audio', {
      p_older_than_hours: AUDIO_TTL_HOURS,
      p_limit: SWEEP_BATCH,
    })
    if (error || !stale || stale.length === 0) return { deleted: 0, skipped: false }

    const rows = stale as { object_path: string; job_id: string | null }[]
    const paths = rows.map((row) => row.object_path).filter((p): p is string => Boolean(p))
    if (paths.length === 0) return { deleted: 0, skipped: false }

    // ONE remove call for the whole batch — the bounded "one list call" budget.
    const { data: removed, error: removeError } = await admin.storage
      .from(MEETING_AUDIO_BUCKET)
      .remove(paths)
    if (removeError) return { deleted: 0, skipped: false }

    // Stamp only the jobs whose object the storage API confirmed it removed. Stamping
    // optimistically would record a deletion that may not have happened — the same
    // mistake as stamping before the delete in `deleteAudio`.
    const removedPaths = new Set((removed ?? []).map((object) => object.name))
    const stampable = rows
      .filter((row) => row.job_id && removedPaths.has(row.object_path))
      .map((row) => row.job_id as string)

    if (stampable.length > 0) {
      await admin
        .from('meeting_minutes_jobs')
        .update({ audio_deleted_at: new Date(now).toISOString() })
        .in('id', [...new Set(stampable)])
    }

    return { deleted: removedPaths.size, skipped: false }
  } catch {
    return { deleted: 0, skipped: false }
  }
}

/** Test seam: reset the in-process throttle. */
export function resetSweepThrottleForTests(): void {
  lastSweepAtMs = 0
}
