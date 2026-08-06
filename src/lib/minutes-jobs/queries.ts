import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { featureEnabled } from '@/lib/queries/feature-flags'
import type { MeetingStatus } from '@/lib/queries/meetings'
import { reconcileMinutesJob, type ReconcilableJob } from './reconcile'
import type {
  MinutesDraft,
  MinutesDraftAgendaItem,
  MinutesJobStatus,
  MinutesJobSummary,
  MinutesReviewData,
} from './types'

/**
 * MIN reads (Architecture Rule 9).
 *
 * Every read here uses the RLS-scoped COOKIE client, so `meeting_minutes_jobs_select`
 * (`app.is_staff_admin_of(app.commission_of_meeting(...))`) is the authority — a plain
 * commission member gets zero rows and therefore no badge, no chip and no review page,
 * without a single UI branch.
 *
 * ⚠ `transcript` and `result` are NOT in the `authenticated` SELECT grant, so they must
 * never appear in a select string here — naming either returns 42501 for the WHOLE row,
 * which reads as "no job" rather than "bad query". The transcript is reachable only
 * through the audited door in `./actions.ts`.
 */

/** Column list for a job summary. Deliberately excludes `transcript` and `result`. */
const JOB_SUMMARY_COLUMNS =
  'id, meeting_id, status, created_at, error_message, audio_path, audio_deleted_at, service_job_id'

interface JobSummaryRow {
  id: string
  meeting_id: string
  status: MinutesJobStatus
  created_at: string
  error_message: string | null
  audio_path: string | null
  audio_deleted_at: string | null
  service_job_id: string | null
}

/** Statuses F1's chip renders. `cancelled`/`applied` collapse to "no active job" (D13). */
const DISPLAYABLE: readonly MinutesJobStatus[] = ['uploading', 'processing', 'done', 'failed']

function toReconcilable(row: JobSummaryRow): ReconcilableJob {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    audioPath: row.audio_path,
    audioDeletedAt: row.audio_deleted_at,
    serviceJobId: row.service_job_id,
  }
}

function toSummary(row: JobSummaryRow): MinutesJobSummary {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    status: row.status,
    createdAt: row.created_at,
    errorMessage: row.status === 'failed' ? row.error_message : null,
  }
}

/**
 * F1's single read: the most recent job for a meeting, but only while it is worth
 * showing. A `cancelled`/`applied` most-recent row means "no active job" and returns
 * `null`, landing the slot back on the plain "Usar áudio" button (D13).
 *
 * Reconciles a stale row before returning (D10) — see `./reconcile.ts` for why that is
 * internal rather than a frontend-callable action.
 */
export async function getActiveMinutesJob(meetingId: string): Promise<MinutesJobSummary | null> {
  if (!(await featureEnabled('audio_minutes'))) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('meeting_minutes_jobs')
    .select(JOB_SUMMARY_COLUMNS)
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<JobSummaryRow>()

  if (error || !data) return null
  if (!DISPLAYABLE.includes(data.status)) return null

  const outcome = await reconcileMinutesJob(toReconcilable(data))
  if (outcome === 'failed_job') {
    // The row changed underneath us — re-read so the caller renders the failed chip
    // rather than a "processing" chip the reconciler has just invalidated.
    const { data: fresh } = await supabase
      .from('meeting_minutes_jobs')
      .select(JOB_SUMMARY_COLUMNS)
      .eq('id', data.id)
      .maybeSingle<JobSummaryRow>()
    if (fresh) return DISPLAYABLE.includes(fresh.status) ? toSummary(fresh) : null
  }

  return toSummary(data)
}

/**
 * F4's batched read — statuses for a page of meetings in ONE round trip.
 *
 * ⚠ Implemented as a scoped `.in(...)` read joined in memory, NOT as a PostgREST embed.
 * `listMeetings` already resolves its two per-meeting aggregates exactly this way; an
 * embed would add a second FK path to an already-reachable table, which is how
 * un-hinted embeds elsewhere in this codebase broke with PGRST201. One extra bounded
 * round trip per page is the cost, and there is no N+1.
 *
 * Only `processing`/`done` are returned: those are the two states worth a list badge.
 */
export async function listActiveMinutesJobStatuses(
  meetingIds: readonly string[],
): Promise<Map<string, 'processing' | 'done'>> {
  const out = new Map<string, 'processing' | 'done'>()
  if (meetingIds.length === 0) return out
  // Flag-gated: an OFF tenant never queries the jobs table from the list read at all.
  if (!(await featureEnabled('audio_minutes'))) return out

  const supabase = await createClient()
  const { data } = await supabase
    .from('meeting_minutes_jobs')
    .select('meeting_id, status')
    .in('meeting_id', [...new Set(meetingIds)])
    .in('status', ['processing', 'done'])
    .returns<{ meeting_id: string; status: 'processing' | 'done' }[]>()

  for (const row of data ?? []) {
    // `done` outranks `processing`: it is the actionable one, and the partial unique
    // index means at most one active row per meeting anyway.
    if (row.status === 'done' || !out.has(row.meeting_id)) out.set(row.meeting_id, row.status)
  }
  return out
}

interface ReviewJobRow extends JobSummaryRow {
  draft: unknown
}

interface AgendaOverlayRow {
  id: string
  discussion_notes: string | null
  resolution: string | null
}

/**
 * F3's page load. `null` means not-found OR unreadable — deliberately indistinguishable,
 * so a non-canEdit prober cannot confirm a job exists; `page.tsx` redirects either way.
 */
export async function getMinutesJobForReview(jobId: string): Promise<MinutesReviewData | null> {
  if (!(await featureEnabled('audio_minutes'))) return null

  const supabase = await createClient()
  const { data: job, error } = await supabase
    .from('meeting_minutes_jobs')
    .select(`${JOB_SUMMARY_COLUMNS}, draft`)
    .eq('id', jobId)
    .maybeSingle<ReviewJobRow>()

  if (error || !job) return null

  await reconcileMinutesJob(toReconcilable(job))
  if (job.status !== 'done') return null

  const { data: meeting } = await supabase
    .from('meetings')
    .select('id, commission_id, status, minutes_md, title, meeting_number')
    .eq('id', job.meeting_id)
    .maybeSingle<{
      id: string
      commission_id: string
      status: MeetingStatus
      minutes_md: string | null
      title: string
      meeting_number: number
    }>()

  if (!meeting) return null

  const draft = coerceDraft(job.draft)

  // Overlay the LIVE agenda text onto matched entries. The normalizer deliberately left
  // `existing_*` null instead of freezing a copy at callback time: the meeting's own
  // notes can change between the callback and the review, and the overwrite warning has
  // to show what is actually about to be replaced, not what was true an hour ago.
  const { data: agendaRows } = await supabase
    .rpc('get_meeting_agenda_items', { p_meeting_id: job.meeting_id })
    .select('id, discussion_notes, resolution')
    .returns<AgendaOverlayRow[]>()

  const live = new Map((agendaRows ?? []).map((row) => [row.id, row]))
  draft.agenda = draft.agenda.map((item) => {
    if (!item.ref) return item
    const existing = live.get(item.ref)
    return existing
      ? {
          ...item,
          existing_discussion_notes: existing.discussion_notes,
          existing_resolution: existing.resolution,
        }
      : // A ref with no live row has gone DANGLING (deleted mid-review). Apply degrades
        // it to a create, so present it as a new item rather than as a matched one.
        { ...item, ref: null, existing_discussion_notes: null, existing_resolution: null }
  })

  return {
    job: {
      id: job.id,
      meetingId: job.meeting_id,
      status: job.status,
      createdAt: job.created_at,
    },
    meeting: {
      id: meeting.id,
      commissionId: meeting.commission_id,
      status: meeting.status,
      minutesMd: meeting.minutes_md,
      title: meeting.title,
      meetingNumber: meeting.meeting_number,
    },
    draft,
  }
}

/**
 * Coerce whatever is in the `draft` jsonb into the shape F3 expects.
 *
 * The column is `jsonb`, so the generated type is `Json` — a cast would be a lie the
 * compiler happily accepts. A draft written by an older normalizer, or hand-edited, must
 * degrade to an empty-but-valid draft rather than crashing the review page.
 */
export function coerceDraft(value: unknown): MinutesDraft {
  const empty: MinutesDraft = {
    minutes_md: '',
    agenda: [],
    action_items: [],
    next_meeting: null,
    speakers: [],
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return empty
  const raw = value as Record<string, unknown>

  return {
    minutes_md: typeof raw.minutes_md === 'string' ? raw.minutes_md : '',
    agenda: Array.isArray(raw.agenda) ? (raw.agenda as MinutesDraftAgendaItem[]) : [],
    action_items: Array.isArray(raw.action_items)
      ? (raw.action_items as MinutesDraft['action_items'])
      : [],
    next_meeting:
      raw.next_meeting && typeof raw.next_meeting === 'object'
        ? (raw.next_meeting as MinutesDraft['next_meeting'])
        : null,
    speakers: Array.isArray(raw.speakers) ? (raw.speakers as MinutesDraft['speakers']) : [],
  }
}
