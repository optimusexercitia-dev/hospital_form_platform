'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import {
  INTERVIEW_MESSAGES,
  mapInterviewError,
} from '@/lib/interviews/messages'
import type {
  InterviewerRole,
  InterviewModality,
} from '@/lib/queries/interviews'

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

/** Fields accepted when creating or editing an interview header. */
export interface InterviewInput {
  /** Optional title; the UI falls back to "Entrevista nº N" when blank. */
  title: string | null
  /** Optional case phase to attach the interview to; `null` if free-standing. */
  casePhaseId: string | null
  /** How the interview is held. */
  modality: InterviewModality
  /** ISO datetime; `null` while still a `rascunho` draft (set when scheduling). */
  scheduledStart: string | null
  /** ISO datetime; the planned end (`null` if open-ended). */
  scheduledEnd: string | null
  locationText: string | null
  /** Video-call URL for a remote/hybrid interview; `null` if absent. */
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

const CASE_PATH = '/c/[slug]/manage/cases/[caseId]'
const INTERVIEW_PATH = '/c/[slug]/manage/cases/[caseId]/interviews/[interviewId]'

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

/**
 * Feature-flag gate for the direct interviews writes (mirror of `meetingsEnabled`).
 * Calls the SECURITY DEFINER `public.interviews_enabled()` read so the gate is
 * authoritative server-side (the flag lives in the locked-down `app` schema).
 * Fails closed.
 */
export async function interviewsEnabled(): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('interviews_enabled')
  if (error) return false
  return data === true
}

// ---------------------------------------------------------------------------
// Interview header + lifecycle
// ---------------------------------------------------------------------------

/**
 * Create a new interview on a case (`status='rascunho'`, `interview_number`
 * minted). staff_admin-only bootstrap. Returns the new `interviewId` so the
 * dialog can route into the detail page.
 */
export async function createInterview(
  caseId: string,
  input: InterviewInput,
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
    p_modality: input.modality,
    p_scheduled_start: input.scheduledStart ?? undefined,
    p_scheduled_end: input.scheduledEnd ?? undefined,
    p_location_text: input.locationText ?? undefined,
    p_meeting_url: input.meetingUrl ?? undefined,
  })

  if (error || !data) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return {
    ok: true,
    error: INTERVIEW_MESSAGES.interviewCreated,
    interviewId: data.id,
  }
}

/**
 * Edit an interview header. Routed through `update_interview`; the RPC authorizes
 * via `can_write_interview` (HC039) and rejects a locked interview (HC038). No
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
    p_modality: input.modality,
    p_scheduled_start: input.scheduledStart ?? undefined,
    p_scheduled_end: input.scheduledEnd ?? undefined,
    p_location_text: input.locationText ?? undefined,
    p_meeting_url: input.meetingUrl ?? undefined,
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

/** Schedule an interview (`rascunho → agendada`; sets `scheduled_start`, optional `scheduled_end`). */
export async function scheduleInterview(
  interviewId: string,
  scheduledStart: string,
  scheduledEnd?: string | null,
): Promise<ActionState> {
  if (!interviewId) return { ok: false, error: INTERVIEW_MESSAGES.missingInterview }
  if (!scheduledStart) {
    return {
      ok: false,
      fieldErrors: { scheduledStart: INTERVIEW_MESSAGES.scheduleRequired },
    }
  }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('schedule_interview', {
    p_interview_id: interviewId,
    p_scheduled_start: scheduledStart,
    p_scheduled_end: scheduledEnd ?? undefined,
  })

  if (error) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return { ok: true, error: INTERVIEW_MESSAGES.interviewScheduled }
}

/** Shared lifecycle-RPC runner (writability is the RPC's authority; flag + pt-BR mapping). */
async function runLifecycle(
  interviewId: string,
  rpc:
    | 'start_interview'
    | 'conclude_interview'
    | 'reopen_interview'
    | 'cancel_interview',
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

/** Start conducting an interview (`agendada → em_andamento`). */
export async function startInterview(interviewId: string): Promise<ActionState> {
  return runLifecycle(
    interviewId,
    'start_interview',
    INTERVIEW_MESSAGES.interviewStarted,
  )
}

/**
 * Conclude an interview (`em_andamento → concluida`): requires ≥1 interviewee
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

/** Re-open a concluded interview (`concluida → em_andamento`); unlocks content, keeps the registry link. */
export async function reopenInterview(
  interviewId: string,
): Promise<ActionState> {
  return runLifecycle(
    interviewId,
    'reopen_interview',
    INTERVIEW_MESSAGES.interviewReopened,
  )
}

/** Cancel an interview (→ `cancelada`, terminal) from any non-terminal state. */
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
 * metadata row via `add_interview_attachment`. The bucket INSERT policy authorizes
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

  const supabase = await createClient()
  // Resolve the commission from the interview (RLS-scoped read; null = unseen).
  // No staff_admin pre-check — a registered interviewer must be able to upload;
  // the bucket policy + add RPC (can_write_interview) are the authority.
  const { data: interview } = await supabase
    .from('case_interviews')
    .select('commission_id')
    .eq('id', interviewId)
    .maybeSingle()
  const commissionId = interview?.commission_id
  if (!commissionId) {
    return { ok: false, error: INTERVIEW_MESSAGES.missingInterview }
  }

  // Immutable path: commission folder (read boundary) / interview folder (write
  // boundary, segment [2]) / uuid.ext.
  const path = `${commissionId}/${interviewId}/${crypto.randomUUID()}.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('interview-attachments')
    .upload(path, bytes, { contentType: file.type, upsert: false })
  if (uploadError) return { ok: false, error: INTERVIEW_MESSAGES.uploadFailed }

  const { data, error } = await supabase.rpc('add_interview_attachment', {
    p_interview_id: interviewId,
    p_kind: kind,
    p_title: title,
    p_storage_path: path,
    p_mime_type: file.type,
    p_size_bytes: file.size,
  })

  if (error || !data) {
    // Metadata insert failed AFTER the object landed; the object is orphaned but
    // never overwritten (Rule 6 — orphans tolerated, no GC in v1).
    return { ok: false, error: mapInterviewError(error) }
  }

  revalidateInterviews()
  return {
    ok: true,
    error: INTERVIEW_MESSAGES.attachmentAdded,
    attachmentId: data.id,
  }
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

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('add_interview_attachment', {
    p_interview_id: interviewId,
    p_kind: kind,
    p_title: title.trim(),
    p_external_url: url,
  })

  if (error || !data) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return { ok: true, error: INTERVIEW_MESSAGES.linkAdded, attachmentId: data.id }
}

/** SOFT-delete an attachment (row hidden, Storage object retained — Rule 6). */
export async function softDeleteInterviewAttachment(
  attachmentId: string,
): Promise<ActionState> {
  if (!attachmentId) return { ok: false, error: INTERVIEW_MESSAGES.missingAttachment }
  if (!(await interviewsEnabled())) {
    return { ok: false, error: INTERVIEW_MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_interview_attachment', {
    p_attachment_id: attachmentId,
  })

  if (error) return { ok: false, error: mapInterviewError(error) }

  revalidateInterviews()
  return { ok: true, error: INTERVIEW_MESSAGES.attachmentRemoved }
}

// Re-export the union types frontend forms bind to, so a form importing the
// action also gets its input enums from one module.
export type {
  InterviewerRole,
  InterviewModality,
  InterviewStatus,
  InterviewAttachmentKind,
} from '@/lib/queries/interviews'
