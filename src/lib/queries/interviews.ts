import { createClient } from '@/lib/supabase/server'
import { logAuditAccess } from '@/lib/audit/access'
import { featureEnabled } from '@/lib/queries/feature-flags'
import { listAttachments } from '@/lib/queries/attachments'

/**
 * Interviews data-access (Phase 11 — Interviews; Architecture Rule 9 — all reads
 * go through `src/lib/queries/`). Interviews are a CASE-SCOPED sibling of the
 * Phase 10 Meetings feature: a committee interviews healthcare professionals
 * about a specific case (e.g. M&M interviewing the staff involved in a patient's
 * care). An interview is scheduled FROM WITHIN an open case, has its own
 * lifecycle (`rascunho → agendada → em_andamento → concluida`, plus `cancelada`),
 * optionally links to a case phase, records multiple INTERVIEWEES (subjects) and
 * INTERVIEWERS (registered platform user XOR external fallback, each with a role),
 * and carries evidence attachments (uploaded documents + external audio-recording
 * URLs). On conclusion it writes/updates a single `case_events kind='interview'`
 * row (the case "registry"). **No patient data.**
 *
 * RLS is the security boundary: every read below uses the RLS-scoped cookie server
 * client, so a non-member of the interview's commission gets `[]`/`null` (never a
 * leak). Commission is resolved in the DB via `app.commission_of_interview` and the
 * per-table policies; these reads add no extra authz of their own. The NEW Phase-11
 * write shape (member SELECT; write = staff_admin/admin OR a registered interviewer
 * of that interview, via `app.can_write_interview`) is surfaced to the UI as
 * {@link InterviewDetail.viewerCanWrite}. All user-facing strings are pt-BR and
 * resolved in the UI — the ASCII union slugs below are stable storage values.
 */

// ---------------------------------------------------------------------------
// Union types (stable ASCII slugs; pt-BR labels resolved in the UI)
// ---------------------------------------------------------------------------

/**
 * Interview lifecycle. `rascunho` is the initial draft (created, not yet
 * scheduled); `agendada` once a date is set; `em_andamento` while it is being
 * conducted; `concluida` once finalized (writes the registry event). `cancelada`
 * is TERMINAL (not reopenable); only `concluida` reopens back to `em_andamento`.
 */
export type InterviewStatus =
  | 'rascunho'
  | 'agendada'
  | 'em_andamento'
  | 'concluida'
  | 'cancelada'

/**
 * An interviewer's fixed committee role on the interview (fixed-enum CHECK in the
 * DB). Distinct from a SUBJECT's clinical role, which is FREE TEXT.
 */
export type InterviewerRole =
  | 'entrevistador_principal'
  | 'entrevistador'
  | 'observador'
  | 'anotador'

/** How the interview is held (mirror of the meetings modality). */
export type InterviewModality = 'presencial' | 'remoto' | 'hibrido'

/**
 * An attachment's EVIDENCE category (fixed CHECK in the DB). ORTHOGONAL to
 * file-vs-link: any kind may be a stored file (`storagePath`) OR an external link
 * (`externalUrl`) — the storage/link distinction is enforced by a separate XOR
 * CHECK, not by `kind`. `gravacao_audio` (audio recording) is typically a `link`
 * since audio BYTES are never stored in the bucket; `transcricao_assinada` (signed
 * transcript) is typically a stored PDF.
 */
export type InterviewAttachmentKind =
  | 'gravacao_audio'
  | 'transcricao_assinada'
  | 'evidencia'
  | 'outro'

// ---------------------------------------------------------------------------
// Domain interfaces (camelCase) — the frozen frontend contract
// ---------------------------------------------------------------------------

/** An interview as it appears in the case's "Entrevistas" panel list. */
export interface InterviewListItem {
  id: string
  commissionId: string
  caseId: string
  /** The case phase this interview is attached to; `null` if free-standing. */
  casePhaseId: string | null
  /** Per-commission sequential number, minted on insert. */
  interviewNumber: number
  /** Optional free-text title; the UI falls back to "Entrevista nº N" when `null`. */
  title: string | null
  status: InterviewStatus
  /** How the interview is held. */
  modality: InterviewModality
  /** ISO timestamp; the planned start. `null` while `rascunho` (set at `agendada`). */
  scheduledStart: string | null
  /** ISO timestamp; the planned end (`null` if open-ended). */
  scheduledEnd: string | null
  /** ISO timestamp the interview was actually conducted (set by `startInterview`); `null` before. */
  conductedAt: string | null
  locationText: string | null
  /** Video-call URL for a remote/hybrid interview; `null` if absent. */
  meetingUrl: string | null
  /** ISO timestamp the interview was concluded; `null` otherwise. */
  concludedAt: string | null
  /** Number of interviewees on this interview (for the list-row subtitle). */
  subjectCount: number
  /**
   * Comma-joined interviewee display names for the list-row subtitle (e.g.
   * "Ana Lima, Carlos Pereira"); `''` if none yet.
   */
  subjectSummary: string
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/** Full interview detail (the detail-page hub). Superset of {@link InterviewListItem}. */
export interface InterviewDetail extends InterviewListItem {
  /** Free-form summary narrative (sanitized Markdown, Architecture Rule 7); `null` if empty. */
  summaryMd: string | null
  /**
   * Optional forward hook: a form version that may back a structured interview
   * script in a future iteration; `null` in v1.
   */
  formVersionId: string | null
  /** The `case_events` row written at conclusion (the registry link); `null` before. */
  registryEventId: string | null
  /** The case's per-commission number (joined), for the header breadcrumb + URL-consistency guards. */
  caseNumber: number | null
  /** The case's NON-identifying label (joined); `null` if the case has none. */
  caseLabel: string | null
  concludedBy: string | null
  cancelledAt: string | null
  /**
   * `app.can_write_interview(id, auth.uid())` — whether the CURRENT viewer may
   * write this interview (staff_admin/admin OR a registered interviewer of it).
   * The SINGLE signal the detail UI gates every write control on: a plain-`staff`
   * registered interviewer gets `true`; a non-interviewer `staff` gets `false`.
   */
  viewerCanWrite: boolean
}

/**
 * An interviewee (the professional being interviewed). A platform user
 * (`userId`) XOR an external person (`externalName`). The clinical role is FREE
 * TEXT (e.g. "Enfermeira da UTI") — deliberately not an enum, since clinical
 * roles vary widely. **No patient data** — subjects are staff, never patients.
 */
export interface InterviewSubject {
  id: string
  interviewId: string
  /** The platform user, when this is a member subject; `null` for external people. */
  userId: string | null
  /** External person's name; `null` when `userId` is set. */
  externalName: string | null
  /** External person's organization; `null` when `userId` is set or unknown. */
  externalOrg: string | null
  /** Free-text clinical role/title; `null` if unspecified. */
  clinicalRole: string | null
  note: string | null
  /**
   * Resolved label: the joined platform user's `full_name` for member subjects,
   * else `externalName`; `null` only if a member's profile is unresolved.
   */
  displayName: string | null
}

/**
 * An interviewer (a committee member conducting the interview). A platform user
 * (`userId`) XOR an external fallback (`externalName`), each with a fixed
 * committee {@link InterviewerRole}. A REGISTERED (platform-user) interviewer
 * gains row-level WRITE on the interview (the new RLS shape) and must be a member
 * of the commission (HC021).
 */
export interface InterviewInterviewer {
  id: string
  interviewId: string
  /** The platform user, when this is a registered interviewer; `null` for external. */
  userId: string | null
  /** External interviewer's name; `null` when `userId` is set. */
  externalName: string | null
  /** External interviewer's organization; `null` when `userId` is set or unknown. */
  externalOrg: string | null
  role: InterviewerRole
  note: string | null
  /**
   * Resolved label: the joined platform user's `full_name` for registered
   * interviewers, else `externalName`; `null` only if a member's profile is
   * unresolved.
   */
  displayName: string | null
}

/**
 * An attachment's metadata. A stored attachment has a `storagePath` (in the
 * private `interview-attachments` bucket); a linked attachment has an
 * `externalUrl` (https-only) — exactly one is non-null. Soft-deleted rows are
 * excluded from reads.
 */
export interface InterviewAttachment {
  id: string
  interviewId: string
  kind: InterviewAttachmentKind
  title: string
  /** Immutable Storage path `{commissionId}/{interviewId}/{uuid}.{ext}` (unique); `null` for links. */
  storagePath: string | null
  /** External https URL (e.g. an audio-recording URL); `null` for stored files. */
  externalUrl: string | null
  mimeType: string | null
  sizeBytes: number | null
  uploadedBy: string | null
  /** Uploader's display name (joined); `null` if unresolved. */
  uploadedByName: string | null
  createdAt: string
}

/**
 * An {@link InterviewAttachment} resolved for display. The UI discriminates
 * file-vs-link WITHOUT guessing: exactly one of `openUrl`/`externalUrl` is
 * non-null. A stored file gets a freshly-minted short-lived signed `openUrl`
 * (and `externalUrl` is `null`); a link exposes its `externalUrl` (and `openUrl`
 * is `null`).
 */
export interface InterviewAttachmentWithUrl extends InterviewAttachment {
  /** Short-lived signed download URL for a STORED file; `null` for links (or if minting failed). */
  openUrl: string | null
}

// ---------------------------------------------------------------------------
// Row shapes (RLS-scoped table reads)
// ---------------------------------------------------------------------------

interface InterviewRow {
  id: string
  commission_id: string
  case_id: string
  case_phase_id: string | null
  interview_number: number
  title: string | null
  status: InterviewStatus
  modality: InterviewModality
  scheduled_start: string | null
  scheduled_end: string | null
  conducted_at: string | null
  location_text: string | null
  meeting_url: string | null
  concluded_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

interface InterviewDetailRow extends InterviewRow {
  summary_md: string | null
  form_version_id: string | null
  registry_event_id: string | null
  concluded_by: string | null
  cancelled_at: string | null
  cases: { case_number: number; label: string | null } | null
}

interface SubjectRow {
  id: string
  interview_id: string
  user_id: string | null
  external_name: string | null
  external_org: string | null
  clinical_role: string | null
  note: string | null
  profiles: { full_name: string | null } | null
}

interface InterviewerRow {
  id: string
  interview_id: string
  user_id: string | null
  external_name: string | null
  external_org: string | null
  role: InterviewerRole
  note: string | null
  profiles: { full_name: string | null } | null
}

/** Phase F2: interview external LINKS now live in `case_interview_links` (interview
 * FILE rows moved to `public.attachments`, owner_type='interview'). */
interface InterviewLinkRow {
  id: string
  interview_id: string
  title: string
  external_url: string
  created_by: string | null
  created_at: string
  profiles: { full_name: string | null } | null
}

/** Subset of {@link InterviewRow} + a joined subject roster for the list subtitle. */
interface InterviewListRow extends InterviewRow {
  case_interview_subjects: {
    external_name: string | null
    profiles: { full_name: string | null } | null
  }[]
}

function subjectName(s: {
  external_name: string | null
  profiles: { full_name: string | null } | null
}): string {
  return s.profiles?.full_name ?? s.external_name ?? 'Entrevistado'
}

// ---------------------------------------------------------------------------
// Reads — RLS-scoped (members read their commission's interviews; `[]`/`null`
// when unreadable).
// ---------------------------------------------------------------------------

/** Every interview of a case, newest-first, for the "Entrevistas" panel. */
export async function listCaseInterviews(
  caseId: string,
): Promise<InterviewListItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('case_interviews')
    .select(
      `id, commission_id, case_id, case_phase_id, interview_number, title, status,
       modality, scheduled_start, scheduled_end, conducted_at, location_text,
       meeting_url, concluded_at, created_by, created_at, updated_at,
       case_interview_subjects ( external_name, profiles:user_id ( full_name ) )`,
    )
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .returns<InterviewListRow[]>()

  if (error || !data) return []

  return data.map((r) => {
    const names = (r.case_interview_subjects ?? []).map(subjectName)
    return {
      id: r.id,
      commissionId: r.commission_id,
      caseId: r.case_id,
      casePhaseId: r.case_phase_id,
      interviewNumber: r.interview_number,
      title: r.title,
      status: r.status,
      modality: r.modality,
      scheduledStart: r.scheduled_start,
      scheduledEnd: r.scheduled_end,
      conductedAt: r.conducted_at,
      locationText: r.location_text,
      meetingUrl: r.meeting_url,
      concludedAt: r.concluded_at,
      subjectCount: names.length,
      subjectSummary: names.join(', '),
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  })
}

/**
 * Full detail for one interview (the detail-page hub), or `null` if
 * unreadable/absent. Resolves {@link InterviewDetail.viewerCanWrite} via the
 * `interview_viewer_can_write` RPC so the UI can gate write controls on the new
 * participant-write rule.
 */
export async function getInterviewDetail(
  interviewId: string,
): Promise<InterviewDetail | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('case_interviews')
    .select(
      `id, commission_id, case_id, case_phase_id, interview_number, title, status,
       modality, scheduled_start, scheduled_end, conducted_at, location_text,
       meeting_url, concluded_at, created_by, created_at, updated_at,
       summary_md, form_version_id, registry_event_id, concluded_by, cancelled_at,
       cases:case_id ( case_number, label )`,
    )
    .eq('id', interviewId)
    .maybeSingle<InterviewDetailRow>()

  if (error || !data) return null

  // WS B (Rule 11/12): audit an interview detail-open (free-text summary_md). Best-
  // effort, app-layer on the RLS-scoped read; commission-scoped attribution.
  await logAuditAccess({
    action: 'interview.viewed',
    entityType: 'interview',
    entityId: interviewId,
    commissionId: data.commission_id,
    summary: 'Detalhe da entrevista visualizado',
  })

  // The participant-write signal for the current viewer (separate RPC; a stored
  // function in the locked-down app schema is not directly callable).
  const { data: canWrite } = await supabase.rpc('interview_viewer_can_write', {
    p_interview_id: interviewId,
  })

  return {
    id: data.id,
    commissionId: data.commission_id,
    caseId: data.case_id,
    casePhaseId: data.case_phase_id,
    interviewNumber: data.interview_number,
    title: data.title,
    status: data.status,
    modality: data.modality,
    scheduledStart: data.scheduled_start,
    scheduledEnd: data.scheduled_end,
    conductedAt: data.conducted_at,
    locationText: data.location_text,
    meetingUrl: data.meeting_url,
    concludedAt: data.concluded_at,
    subjectCount: 0,
    subjectSummary: '',
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    summaryMd: data.summary_md,
    formVersionId: data.form_version_id,
    registryEventId: data.registry_event_id,
    caseNumber: data.cases?.case_number ?? null,
    caseLabel: data.cases?.label ?? null,
    concludedBy: data.concluded_by,
    cancelledAt: data.cancelled_at,
    viewerCanWrite: canWrite === true,
  }
}

/** The interview's interviewees (subjects), ordered by creation. */
export async function listInterviewSubjects(
  interviewId: string,
): Promise<InterviewSubject[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('case_interview_subjects')
    .select(
      `id, interview_id, user_id, external_name, external_org, clinical_role,
       note, profiles:user_id ( full_name )`,
    )
    .eq('interview_id', interviewId)
    .order('created_at', { ascending: true })
    .returns<SubjectRow[]>()

  if (error || !data) return []

  return data.map((r) => ({
    id: r.id,
    interviewId: r.interview_id,
    userId: r.user_id,
    externalName: r.external_name,
    externalOrg: r.external_org,
    clinicalRole: r.clinical_role,
    note: r.note,
    displayName: r.profiles?.full_name ?? r.external_name ?? null,
  }))
}

/** The interview's interviewers (registered members + external fallbacks). */
export async function listInterviewInterviewers(
  interviewId: string,
): Promise<InterviewInterviewer[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('case_interview_interviewers')
    .select(
      `id, interview_id, user_id, external_name, external_org, role, note,
       profiles:user_id ( full_name )`,
    )
    .eq('interview_id', interviewId)
    .order('role', { ascending: true })
    .order('created_at', { ascending: true })
    .returns<InterviewerRow[]>()

  if (error || !data) return []

  return data.map((r) => ({
    id: r.id,
    interviewId: r.interview_id,
    userId: r.user_id,
    externalName: r.external_name,
    externalOrg: r.external_org,
    role: r.role,
    note: r.note,
    displayName: r.profiles?.full_name ?? r.external_name ?? null,
  }))
}

/**
 * The interview's NON-deleted attachments, each resolved for display. Stored
 * `file` rows get a batch-minted short-lived signed `openUrl` (one round trip);
 * `link` rows expose their `external_url` and have `openUrl = null`. Soft-deleted
 * rows are excluded. Batch-minted under the same RLS-scoped client, so a foreign
 * caller gets neither rows nor URLs.
 */
export async function listInterviewAttachments(
  interviewId: string,
): Promise<InterviewAttachmentWithUrl[]> {
  const supabase = await createClient()

  // FILE rows: attachments (owner_type='interview'). Interviews default to the PHI
  // tier, so the blob is opened via the audited door — openUrl is null here (a
  // standard-tier file would carry a direct URL). externalUrl is null for files.
  const files = await listAttachments('interview', interviewId)
  const fileItems: InterviewAttachmentWithUrl[] = files.map((a) => ({
    id: a.id,
    interviewId: a.ownerId,
    kind: a.kind as InterviewAttachmentKind,
    title: a.title,
    storagePath: a.storagePath,
    externalUrl: null,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    uploadedBy: a.uploadedBy,
    uploadedByName: a.uploadedByName,
    createdAt: a.createdAt,
    openUrl: a.signedUrl,
  }))

  // LINK rows: case_interview_links (external https URLs). Links carry no kind in the
  // folded model (F2) → 'outro'; no blob, so openUrl/storagePath are null.
  const { data: links } = await supabase
    .from('case_interview_links')
    .select(
      `id, interview_id, title, external_url, created_by, created_at,
       profiles:created_by ( full_name )`,
    )
    .eq('interview_id', interviewId)
    .is('deleted_at', null)
    .returns<InterviewLinkRow[]>()
  const linkItems: InterviewAttachmentWithUrl[] = (links ?? []).map((l) => ({
    id: l.id,
    interviewId: l.interview_id,
    kind: 'outro' as InterviewAttachmentKind,
    title: l.title,
    storagePath: null,
    externalUrl: l.external_url,
    mimeType: null,
    sizeBytes: null,
    uploadedBy: l.created_by,
    uploadedByName: l.profiles?.full_name ?? null,
    createdAt: l.created_at,
    openUrl: null,
  }))

  // Newest-first (both sources are ISO-8601 timestamps).
  return [...fileItems, ...linkItems].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
}

/**
 * Feature-flag gate for the interviews surface (mirror of `meetingsEnabled` /
 * `casesExtrasEnabled`). Backed by the SECURITY DEFINER `public.interviews_enabled()`
 * read (the flag lives in the locked-down `app` schema). Fails closed.
 */
export async function interviewsEnabled(): Promise<boolean> {
  // P4 (WS-6): delegate to the consolidated, request-memoized flag read.
  return featureEnabled('interviews')
}
