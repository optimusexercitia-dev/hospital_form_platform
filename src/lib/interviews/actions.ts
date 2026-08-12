'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import { featureEnabled } from '@/lib/queries/feature-flags'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import {
  INTERVIEW_MESSAGES,
  mapInterviewError,
} from '@/lib/interviews/messages'
import { interviewsEnabled } from '@/lib/queries/interviews'
import type {
  InterviewCategory,
  InterviewConfidentiality,
  InterviewerRole,
  InterviewModality,
  RelationshipToCase,
  SessionType,
} from '@/lib/queries/interviews'
// ETH·E1 fold-in (ADR 0072 D7): the enforcing 7-value confidentiality taxonomy the
// interview confidentiality setter now speaks (type-only ⇒ no server-only runtime import).
import type { CaseConfidentialityLevel } from '@/lib/queries/cases'

/**
 * Interviews server actions (Phase 11 — Interviews; Architecture Rules 6, 9 & 10).
 *
 * Interviews are a CASE-SCOPED sibling of Meetings. staff_admin CREATES an
 * interview (bootstrap); thereafter a REGISTERED INTERVIEWER (a platform user
 * added as an interviewer of that interview) ALSO gains write — the new Phase-11
 * RLS shape (`app.can_write_interview`, a SECURITY DEFINER row-level participant
 * grant mirroring `app.can_sign_meeting`). RLS is the authority; every mutation
 * routes through the interviews RPCs, which set `app.in_interview_rpc` and enforce
 * the state machine + content-freeze, and authorize via `can_write_interview`.
 *
 * AUTHZ PRE-CHECKS: only {@link createInterview} does a staff_admin commission
 * pre-check (it is the staff_admin-only bootstrap). Every other action does NOT
 * pre-check staff_admin — a registered interviewer who is a plain `staff` member
 * must pass, so a staff_admin-only pre-check would wrongly reject them; the RPC's
 * `can_write_interview` gate (→ HC039) is the sole authority there.
 *
 * All user-facing strings are pt-BR (centralized in `./messages.ts`, mirroring the
 * meetings convention); raw Supabase/Postgres errors NEVER reach the UI
 * (CLAUDE.md §8). Direct writes gate the `interviews` flag via {@link interviewsEnabled}.
 */

// ---------------------------------------------------------------------------
// Result shapes (the shared `useActionState`-shaped contract)
// ---------------------------------------------------------------------------

/** The shared `useActionState`-shaped result for every interviews mutation. */
export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/** A create action that returns the new interview's id on success. */
export interface CreateInterviewState extends ActionState {
  interviewId?: string
}

/** A create action that returns the new subject's id on success. */
export interface AddSubjectState extends ActionState {
  subjectId?: string
}

/** A create action that returns the new interviewer's id on success. */
export interface AddInterviewerState extends ActionState {
  interviewerId?: string
}

/** An upload/add action that returns the new attachment's id on success. */
export interface AddAttachmentState extends ActionState {
  attachmentId?: string
}

// ---------------------------------------------------------------------------
// Input shapes (camelCase; the forms bind to these)
// ---------------------------------------------------------------------------

/** Fields accepted when creating or editing an interview header (IV2 — scheduling
 * moved to {@link SessionInput}). */
export interface InterviewInput {
  /** Optional title; the UI falls back to "Entrevista nº N" when blank. */
  title: string | null
  /** Optional case phase to attach the interview to; `null` if free-standing. */
  casePhaseId: string | null
  /** IV2: dashboard classification (required). */
  interviewCategory: InterviewCategory
  /** ENFORCING confidentiality classification (ADR 0072 D7 · E1; default
   * `non_phi_internal`): `legal_privileged` + `credentialing_sensitive` gate the
   * interview above ordinary case-read. Legacy 3-value input is normalized by the DB. */
  confidentialityLevel: InterviewConfidentiality
}

/** Fields accepted when scheduling/editing a session (IV2). */
export interface SessionInput {
  /** Session kind; `null` lets the RPC default it (`initial` for seq 1, else `follow_up`). */
  sessionType: SessionType | null
  /** How the session is held; `null` for a written/async session. */
  modality: InterviewModality | null
  /** ISO datetime; the planned start. */
  scheduledStart: string | null
  /** ISO datetime; the planned end (`null` if open-ended). */
  scheduledEnd: string | null
  locationText: string | null
  /** Video-call URL for a remote/hybrid session; `null` if absent. */
  meetingUrl: string | null
}

/** Fields accepted when adding/editing a subject (interviewee). */
export interface InterviewSubjectInput {
  /** Provide `userId` for a platform member XOR `externalName` for an external person. */
  userId: string | null
  externalName: string | null
  /**
   * External person's organization; OPTIONAL — the subject form need not collect
   * it. Omitted/`null`/`undefined` all mean "no org".
   */
  externalOrg?: string | null
  /** IV2: the subject's relationship to the case (required; staff-only enum). */
  relationshipToCase: RelationshipToCase
  /** Free-text clinical role/title (e.g. "Enfermeira da UTI"); `null` if blank. */
  clinicalRole: string | null
  note: string | null
}

/** Fields accepted when adding/editing an interviewer. */
export interface InterviewInterviewerInput {
  /** Provide `userId` for a registered (member) interviewer XOR `externalName`. */
  userId: string | null
  externalName: string | null
  externalOrg: string | null
  role: InterviewerRole
  note: string | null
}

const CASE_PATH = '/o/[org]/c/[commission]/manage/cases/[caseId]'
const INTERVIEW_PATH = '/o/[org]/c/[commission]/manage/cases/[caseId]/interviews/[interviewId]'

function revalidateInterviews(): void {
  revalidatePath(CASE_PATH, 'page')
  revalidatePath(INTERVIEW_PATH, 'page')
}

/** Authorize: admin, or a staff_admin of THAT commission (create bootstrap only). */
async function authorizeStaffAdmin(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.memberships.some(
    (m) => m.commission.id === commissionId && m.role === 'staff_admin',
  )
}

/** Resolve a case's commission via the RLS-scoped client (null = unseen). */
async function commissionOfCase(
  supabase: SupabaseClient<Database>,
  caseId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('cases')
    .select('commission_id')
    .eq('id', caseId)
    .maybeSingle()
  return data?.commission_id ?? null
}

// ---------------------------------------------------------------------------
// Interview header + lifecycle
// ---------------------------------------------------------------------------

/**
 * Create a new interview on a case (`status='draft'`, `interview_number` minted,
 * `interview_category` required). staff_admin/commission-admin bootstrap. When
 * `firstSession` is provided this is the create-then-schedule UX: it calls
 * `create_interview` then `schedule_session` (IV2 — the interview flips to
 * `scheduled`). Returns the new `interviewId` so the dialog can route into the
 * detail page (even if the follow-up schedule call fails, the interview exists).
 */
export async function createInterview(
  caseId: string,
  input: InterviewInput,
  firstSession?: SessionInput | null,
): Promise<CreateInterviewState> {
  if (!caseId) return { ok: false, error: INTERVIEW_MESSAGES.missingCase }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfCase(supabase, caseId)
  if (!commissionId) return { ok: false, error: INTERVIEW_MESSAGES.missingCase }
  if (!(await authorizeStaffAdmin(commissionId))) {
    return { ok: false, error: INTERVIEW_MESSAGES.forbidden }
  }

  const { data, error } = await supabase.rpc('create_interview', {
    p_case_id: caseId,
    p_title: input.title?.trim() || undefined,
    p_case_phase_id: input.casePhaseId ?? undefined,
    p_interview_category: input.interviewCategory,
    p_confidentiality_level: input.confidentialityLevel,
  })

  if (error || !data) return { ok: false, error: mapInterviewError(error) }

  const interviewId = data.id

  if (firstSession) {
    const { error: sessionError } = await supabase.rpc('schedule_session', {
      p_interview_id: interviewId,
      p_session_type: firstSession.sessionType ?? undefined,
      p_modality: firstSession.modality ?? undefined,
      p_scheduled_start: firstSession.scheduledStart ?? undefined,
      p_scheduled_end: firstSession.scheduledEnd ?? undefined,
      p_location_text: firstSession.locationText ?? undefined,
      p_meeting_url: firstSession.meetingUrl ?? undefined,
    })
    if (sessionError) {
      revalidateInterviews()
      return { ok: false, error: mapInterviewError(sessionError), interviewId }
    }
  }

  revalidateInterviews()
  return {
    ok: true,
    error: INTERVIEW_MESSAGES.interviewCreated,
    interviewId,
  }
}

/**
 * Edit an interview header (title/phase/category/confidentiality; IV2 — scheduling
 * lives on sessions). Routed through `update_interview`; the RPC authorizes via
 * `can_write_interview` (HC039) and rejects a locked interview (HC038). No
 * staff_admin pre-check — a registered interviewer may edit.
 */
export async function updateInterview(
  interviewId: string,
  input: InterviewInput,
): Promise<ActionState> {
  if (!interviewId) return { ok: false, error: INTERVIEW_MESSAGES.missingInterview }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_interview', {
    p_interview_id: interviewId,
    p_title: input.title?.trim() || undefined,
    p_case_phase_id: input.casePhaseId ?? undefined,
    p_interview_category: input.interviewCategory,
    p_confidentiality_level: input.confidentialityLevel,
  })

  if (error) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return { ok: true, error: INTERVIEW_MESSAGES.interviewUpdated }
}

/** Persist the summary narrative (`summary_md`, sanitized Markdown — Rule 7). Locked once concluded. */
export async function updateInterviewSummary(
  interviewId: string,
  summaryMd: string,
): Promise<ActionState> {
  if (!interviewId) return { ok: false, error: INTERVIEW_MESSAGES.missingInterview }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_interview_summary', {
    p_interview_id: interviewId,
    p_summary_md: summaryMd,
  })

  if (error) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return { ok: true, error: INTERVIEW_MESSAGES.interviewUpdated }
}

// ---------------------------------------------------------------------------
// Sessions (IV2 — the encounter children; ADR 0070 §4 state machine)
// ---------------------------------------------------------------------------

/**
 * Schedule a new session on an interview (`scheduled`; sequence auto-assigned).
 * Flips the interview `draft → scheduled`. The RPC rejects a non-schedulable
 * interview state (HC0B0) and authorizes via `can_write_interview` (HC039).
 */
export async function scheduleSession(
  interviewId: string,
  input: SessionInput,
): Promise<ActionState> {
  if (!interviewId) return { ok: false, error: INTERVIEW_MESSAGES.missingInterview }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('schedule_session', {
    p_interview_id: interviewId,
    p_session_type: input.sessionType ?? undefined,
    p_modality: input.modality ?? undefined,
    p_scheduled_start: input.scheduledStart ?? undefined,
    p_scheduled_end: input.scheduledEnd ?? undefined,
    p_location_text: input.locationText ?? undefined,
    p_meeting_url: input.meetingUrl ?? undefined,
  })

  if (error) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return { ok: true, error: INTERVIEW_MESSAGES.sessionScheduled }
}

/** Reschedule/edit a non-terminal session in place (emits an audit reschedule line
 * when the times change). HC038 if the session is terminal. */
export async function updateSession(
  sessionId: string,
  input: SessionInput,
): Promise<ActionState> {
  if (!sessionId) return { ok: false, error: INTERVIEW_MESSAGES.missingSession }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_session', {
    p_session_id: sessionId,
    p_session_type: input.sessionType ?? undefined,
    p_modality: input.modality ?? undefined,
    p_scheduled_start: input.scheduledStart ?? undefined,
    p_scheduled_end: input.scheduledEnd ?? undefined,
    p_location_text: input.locationText ?? undefined,
    p_meeting_url: input.meetingUrl ?? undefined,
  })

  if (error) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return { ok: true, error: INTERVIEW_MESSAGES.sessionUpdated }
}

/** Start a session (`scheduled → in_progress`, `actual_start=now`); flips the
 * interview `{scheduled, awaiting_follow_up} → in_progress`. HC038 otherwise. */
export async function startSession(sessionId: string): Promise<ActionState> {
  if (!sessionId) return { ok: false, error: INTERVIEW_MESSAGES.missingSession }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('start_session', { p_session_id: sessionId })
  if (error) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return { ok: true, error: INTERVIEW_MESSAGES.sessionStarted }
}

/** Complete a session (`in_progress → completed`); the interview derives
 * `awaiting_follow_up` iff another scheduled session remains. HC038 otherwise. */
export async function completeSession(
  sessionId: string,
  actualEnd?: string | null,
): Promise<ActionState> {
  if (!sessionId) return { ok: false, error: INTERVIEW_MESSAGES.missingSession }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('complete_session', {
    p_session_id: sessionId,
    p_actual_end: actualEnd ?? undefined,
  })
  if (error) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return { ok: true, error: INTERVIEW_MESSAGES.sessionCompleted }
}

/** Cancel a session (→ `cancelled`, +reason). Terminal; never hard-deleted. HC038
 * if the session is already completed. */
export async function cancelSession(
  sessionId: string,
  reason?: string | null,
): Promise<ActionState> {
  if (!sessionId) return { ok: false, error: INTERVIEW_MESSAGES.missingSession }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_session', {
    p_session_id: sessionId,
    p_reason: reason?.trim() || undefined,
  })
  if (error) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return { ok: true, error: INTERVIEW_MESSAGES.sessionCancelled }
}

/** Mark a session as no-show (→ `no_show`, +reason). Terminal; never hard-deleted.
 * HC038 if the session is already completed. */
export async function noShowSession(
  sessionId: string,
  reason?: string | null,
): Promise<ActionState> {
  if (!sessionId) return { ok: false, error: INTERVIEW_MESSAGES.missingSession }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('no_show_session', {
    p_session_id: sessionId,
    p_reason: reason?.trim() || undefined,
  })
  if (error) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return { ok: true, error: INTERVIEW_MESSAGES.sessionNoShow }
}

// ---------------------------------------------------------------------------
// Interview-level lifecycle (conclude / reopen / cancel)
// ---------------------------------------------------------------------------

/** Shared lifecycle-RPC runner (writability is the RPC's authority; flag + pt-BR mapping). */
async function runLifecycle(
  interviewId: string,
  rpc: 'conclude_interview' | 'reopen_interview' | 'cancel_interview',
  successMessage: string,
): Promise<ActionState> {
  if (!interviewId) return { ok: false, error: INTERVIEW_MESSAGES.missingInterview }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc(rpc, { p_interview_id: interviewId })
  if (error) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return { ok: true, error: successMessage }
}

/**
 * Conclude an interview (`{in_progress, awaiting_follow_up} → completed`): requires ≥1 interviewee
 * (HC041), writes/updates the single `case_events kind='interview'` registry row
 * on the case timeline (no duplicate on re-conclude), and freezes content.
 */
export async function concludeInterview(
  interviewId: string,
): Promise<ActionState> {
  return runLifecycle(
    interviewId,
    'conclude_interview',
    INTERVIEW_MESSAGES.interviewConcluded,
  )
}

/** Re-open a concluded interview (`completed → in_progress`); unlocks content, keeps the registry link. */
export async function reopenInterview(
  interviewId: string,
): Promise<ActionState> {
  return runLifecycle(
    interviewId,
    'reopen_interview',
    INTERVIEW_MESSAGES.interviewReopened,
  )
}

/** Cancel an interview (→ `cancelled`, terminal) from any non-terminal state. */
export async function cancelInterview(
  interviewId: string,
): Promise<ActionState> {
  return runLifecycle(
    interviewId,
    'cancel_interview',
    INTERVIEW_MESSAGES.interviewCancelled,
  )
}

// ---------------------------------------------------------------------------
// Subjects (interviewees) CRUD
// ---------------------------------------------------------------------------

/** Validate the member-XOR-external rule shared by subjects + interviewers. */
function partyXorError(
  userId: string | null,
  externalName: string | null,
): string | null {
  const hasUser = Boolean(userId)
  const hasExternal = Boolean(externalName?.trim())
  if (hasUser === hasExternal) {
    return hasUser
      ? INTERVIEW_MESSAGES.partyExclusive
      : INTERVIEW_MESSAGES.partyRequired
  }
  return null
}

/** Add an interviewee (platform member XOR external person). Returns the new `subjectId`. */
export async function addInterviewSubject(
  interviewId: string,
  input: InterviewSubjectInput,
): Promise<AddSubjectState> {
  if (!interviewId) return { ok: false, error: INTERVIEW_MESSAGES.missingInterview }
  const xor = partyXorError(input.userId, input.externalName)
  if (xor) return { ok: false, error: xor }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('add_interview_subject', {
    p_interview_id: interviewId,
    p_user_id: input.userId ?? undefined,
    p_external_name: input.externalName ?? undefined,
    p_clinical_role: input.clinicalRole ?? undefined,
    p_external_org: input.externalOrg ?? undefined,
    p_note: input.note ?? undefined,
    p_relationship_to_case: input.relationshipToCase,
  })

  if (error || !data) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return { ok: true, error: INTERVIEW_MESSAGES.subjectAdded, subjectId: data.id }
}

/** Edit a subject (`clinicalRole`/`note`; external also name/org). */
export async function updateInterviewSubject(
  subjectId: string,
  input: InterviewSubjectInput,
): Promise<ActionState> {
  if (!subjectId) return { ok: false, error: INTERVIEW_MESSAGES.missingSubject }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_interview_subject', {
    p_subject_id: subjectId,
    p_clinical_role: input.clinicalRole ?? undefined,
    p_note: input.note ?? undefined,
    p_external_name: input.externalName ?? undefined,
    p_external_org: input.externalOrg ?? undefined,
    p_relationship_to_case: input.relationshipToCase ?? undefined,
  })

  if (error) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return { ok: true, error: INTERVIEW_MESSAGES.subjectUpdated }
}

/** Remove a subject (only while unlocked). */
export async function removeInterviewSubject(
  subjectId: string,
): Promise<ActionState> {
  if (!subjectId) return { ok: false, error: INTERVIEW_MESSAGES.missingSubject }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_interview_subject', {
    p_subject_id: subjectId,
  })

  if (error) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return { ok: true, error: INTERVIEW_MESSAGES.subjectRemoved }
}

// ---------------------------------------------------------------------------
// Interviewers CRUD (a registered interviewer must be a commission member → HC021)
// ---------------------------------------------------------------------------

/**
 * Add an interviewer (registered member XOR external fallback). The RPC enforces
 * the member rule (HC021) and the registered interviewer GAINS row-level write.
 * Returns the new `interviewerId`.
 */
export async function addInterviewInterviewer(
  interviewId: string,
  input: InterviewInterviewerInput,
): Promise<AddInterviewerState> {
  if (!interviewId) return { ok: false, error: INTERVIEW_MESSAGES.missingInterview }
  const xor = partyXorError(input.userId, input.externalName)
  if (xor) return { ok: false, error: xor }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('add_interview_interviewer', {
    p_interview_id: interviewId,
    p_user_id: input.userId ?? undefined,
    p_external_name: input.externalName ?? undefined,
    p_external_org: input.externalOrg ?? undefined,
    p_role: input.role,
    p_note: input.note ?? undefined,
  })

  if (error || !data) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return {
    ok: true,
    error: INTERVIEW_MESSAGES.interviewerAdded,
    interviewerId: data.id,
  }
}

/** Edit an interviewer (`role`/`note`; external also name/org). */
export async function updateInterviewInterviewer(
  interviewerId: string,
  input: InterviewInterviewerInput,
): Promise<ActionState> {
  if (!interviewerId) {
    return { ok: false, error: INTERVIEW_MESSAGES.missingInterviewer }
  }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_interview_interviewer', {
    p_interviewer_id: interviewerId,
    p_role: input.role,
    p_note: input.note ?? undefined,
    p_external_name: input.externalName ?? undefined,
    p_external_org: input.externalOrg ?? undefined,
  })

  if (error) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return { ok: true, error: INTERVIEW_MESSAGES.interviewerUpdated }
}

/** Remove an interviewer (only while unlocked). */
export async function removeInterviewInterviewer(
  interviewerId: string,
): Promise<ActionState> {
  if (!interviewerId) {
    return { ok: false, error: INTERVIEW_MESSAGES.missingInterviewer }
  }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('remove_interview_interviewer', {
    p_interviewer_id: interviewerId,
  })

  if (error) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return { ok: true, error: INTERVIEW_MESSAGES.interviewerRemoved }
}

// ---------------------------------------------------------------------------
// Attachments (immutable objects, external links, soft-delete rows)
// ---------------------------------------------------------------------------

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024 // mirrors the bucket's 25 MiB limit
// MIME → file extension, mirroring the interview-attachments bucket allow-list
// (NO audio — audio is link-only).
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
  'gravacao_audio',
  'transcricao_assinada',
  'evidencia',
  'outro',
]

/**
 * Upload a FILE-backed attachment. `useActionState`-shaped (clones
 * `uploadCaseDocument` / `uploadMeetingAttachment`). Expected fields:
 * `interviewId`, `file`, `kind`, `title`. Validates the MIME allow-list (no audio)
 * + 25 MiB cap, uploads to a FRESH immutable path
 * (`{commissionId}/{interviewId}/{uuid}.{ext}`, `upsert:false`), then records the
 * metadata row via the `create_attachment` RPC (Phase F2 — owner_type='interview').
 * The bucket INSERT policy authorizes
 * the upload via `can_write_interview` keyed on the interview-id path segment, so a
 * registered interviewer (not just staff_admin) can upload — hence the path must
 * carry the interview id as the SECOND segment. Returns the new `attachmentId`.
 */
export async function uploadInterviewAttachment(
  _prev: AddAttachmentState | undefined,
  formData: FormData,
): Promise<AddAttachmentState> {
  const interviewId = String(formData.get('interviewId') ?? '')
  const kind = String(formData.get('kind') ?? 'outro')
  const title = String(formData.get('title') ?? '').trim()
  const file = formData.get('file')

  if (!interviewId) return { ok: false, error: INTERVIEW_MESSAGES.missingInterview }
  if (!ATTACHMENT_KINDS.includes(kind)) {
    return { ok: false, error: INTERVIEW_MESSAGES.attachmentKindInvalid }
  }
  if (!title) {
    return { ok: false, fieldErrors: { title: INTERVIEW_MESSAGES.titleRequired } }
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, fieldErrors: { file: INTERVIEW_MESSAGES.fileRequired } }
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, fieldErrors: { file: INTERVIEW_MESSAGES.fileTooLarge } }
  }
  const ext = ALLOWED_ATTACHMENT_MIME.get(file.type)
  if (!ext) {
    return { ok: false, fieldErrors: { file: INTERVIEW_MESSAGES.fileTypeInvalid } }
  }

  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }
  // PARKED (DM1, ADR 0114 D5): the F2 attachments substrate this uploaded into
  // was dropped by 20260923000100 and the `attachments` flag is false
  // everywhere, so this action fails closed until Wave A (DM2) rebuilds the
  // flow on the document model (documents_wave_a). Field validation above is
  // kept so the form contract stays stable.
  return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
}

/**
 * Add a LINK attachment (an external https URL — e.g. an audio-recording URL;
 * audio BYTES are never stored). Validates `https`-only. `kind` defaults to
 * `gravacao_audio` (the common case) but the caller may pass any kind. Returns the
 * new `attachmentId`.
 */
export async function addInterviewLink(
  interviewId: string,
  title: string,
  externalUrl: string,
  kind: string = 'gravacao_audio',
): Promise<AddAttachmentState> {
  if (!interviewId) return { ok: false, error: INTERVIEW_MESSAGES.missingInterview }
  if (!ATTACHMENT_KINDS.includes(kind)) {
    return { ok: false, error: INTERVIEW_MESSAGES.attachmentKindInvalid }
  }
  if (!title.trim()) {
    return {
      ok: false,
      fieldErrors: { title: INTERVIEW_MESSAGES.linkTitleRequired },
    }
  }
  const url = externalUrl.trim()
  if (!/^https:\/\/.+/.test(url)) {
    return {
      ok: false,
      fieldErrors: { externalUrl: INTERVIEW_MESSAGES.linkInvalid },
    }
  }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }
  if (!(await featureEnabled('attachments'))) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  // Phase F2: interview external links live in `case_interview_links` (thin RLS-gated
  // rows via can_write_interview). `kind` is not modeled on links anymore (folded model)
  // — the param is kept for signature compatibility but not persisted.
  const supabase = await createClient()
  const context = await getSessionContext()
  const { data, error } = await supabase
    .from('case_interview_links')
    .insert({
      interview_id: interviewId,
      title: title.trim(),
      external_url: url,
      created_by: context?.userId ?? null,
    })
    .select('id')
    .maybeSingle()

  if (error || !data) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return { ok: true, error: INTERVIEW_MESSAGES.linkAdded, attachmentId: data.id }
}

/** SOFT-delete an interview attachment — a FILE (`attachments`) or a LINK
 * (`case_interview_links`). The two id namespaces are disjoint, so we soft-delete
 * whichever the id resolves to (row hidden, storage object retained — Rule 6). */
export async function softDeleteInterviewAttachment(
  attachmentId: string,
): Promise<ActionState> {
  if (!attachmentId) return { ok: false, error: INTERVIEW_MESSAGES.missingAttachment }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }
  if (!(await featureEnabled('attachments'))) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()

  // PARKED half (DM1, ADR 0114 D5): FILE attachments' substrate was dropped by
  // 20260923000100, so every id can only be a LINK row now — soft-delete via
  // the RLS write policy (can_write_interview). Wave A restores the file half
  // on the document model.
  {
    const context = await getSessionContext()
    const { error } = await supabase
      .from('case_interview_links')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: context?.userId ?? null,
      })
      .eq('id', attachmentId)
      .is('deleted_at', null)
    if (error) return { ok: false, error: mapInterviewError(error) }
  }

  revalidateInterviews()
  return { ok: true, error: INTERVIEW_MESSAGES.attachmentRemoved }
}

// ---------------------------------------------------------------------------
// ETH·E1 fold-in (ADR 0072 D7 · X-γ) — participant-registry wiring, enforcing
// confidentiality, and per-session attendance. ADDITIVE to IV2's surface; the
// bodies land in BE-6 (the interview fold-in migration + RPCs). CONTRACT-FIRST
// STUB (BE-1) — signatures are the frozen contract the E2/E3 UI binds to.
// ---------------------------------------------------------------------------

/** Fields accepted when recording a participant's attendance at a session (ADR 0072
 * D7·3; `interview_session_attendance`). `attendanceStatus`/`roleAtSession` enums are
 * finalized against the DB CHECK in BE-6. */
export interface SessionAttendanceInput {
  /** `case_participants.id` — the unified participant row for this attendee. */
  participantId: string
  /** Attendance outcome (present / absent / excused / …); DB-CHECK-bound in BE-6. */
  attendanceStatus: string
  /** The participant's role at THIS session (optional). */
  roleAtSession?: string | null
}

function notImplementedE1(fn: string, ..._args: unknown[]): never {
  throw new Error(`${fn} not implemented (ETH·E1 BE-6 — contract stub)`)
}

/** Tie an interview to a case-level participant (`set_interview_participant`; wires the
 * BE-6 `participant_id` FK so the SAME respondent resolves the same participant across
 * sessions). `null` clears the link. Subject/interviewer variants land in BE-6. */
export async function setInterviewParticipant(
  interviewId: string,
  participantId: string | null,
): Promise<ActionState> {
  return notImplementedE1('setInterviewParticipant', interviewId, participantId)
}

/** Set an interview's confidentiality — now ENFORCING and on the 7-value taxonomy
 * (`set_interview_confidentiality`; audited `interview.confidentiality_changed`). A
 * below-clearance reader loses the interview detail. Replaces IV2's non-enforcing tag. */
export async function setInterviewConfidentiality(
  interviewId: string,
  level: CaseConfidentialityLevel,
): Promise<ActionState> {
  return notImplementedE1('setInterviewConfidentiality', interviewId, level)
}

/** Record a participant's attendance at a session (`record_session_attendance`;
 * `interview_session_attendance`). */
export async function recordSessionAttendance(
  sessionId: string,
  input: SessionAttendanceInput,
): Promise<ActionState> {
  return notImplementedE1('recordSessionAttendance', sessionId, input)
}

// Re-export the union types frontend forms bind to, so a form importing the
// action also gets its input enums from one module.
export type {
  InterviewerRole,
  InterviewModality,
  InterviewStatus,
  InterviewCategory,
  InterviewConfidentiality,
  RelationshipToCase,
  SessionType,
  SessionStatus,
  InterviewAttachmentKind,
} from '@/lib/queries/interviews'
