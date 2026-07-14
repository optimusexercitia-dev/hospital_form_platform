import { createClient } from '@/lib/supabase/server'
import { logAuditAccess } from '@/lib/audit/access'
import { featureEnabled } from '@/lib/queries/feature-flags'
import { listAttachments } from '@/lib/queries/attachments'
// The one confidentiality taxonomy (X-δ): reuse the canonical client-safe union rather
// than a parallel copy (type-only import — erased at build; no server-only coupling).
import type { ConfidentialityLabel } from '@/lib/attachments/constants'

/**
 * Interviews data-access (Phase 11 — Interviews; revised by IV2 / ADR 0070 —
 * sessions + reporting/confidentiality). Architecture Rule 9 — all reads go
 * through `src/lib/queries/`. Interviews are a CASE-SCOPED sibling of Meetings: a
 * committee interviews healthcare professionals about a specific case. Since IV2 an
 * interview is a small MULTI-ENCOUNTER aggregate: it stays the lifecycle
 * coordinator (`draft → scheduled → in_progress ⇄ awaiting_follow_up → completed`,
 * plus `cancelled`) while its 1:N {@link InterviewSession} children carry
 * scheduling + their own status. On conclusion it writes/updates a single
 * `case_events kind='interview'` row (the case "registry"). Interviews are
 * STAFF-ONLY and non-PHI (Rule 12).
 *
 * RLS is the security boundary: every read below uses the RLS-scoped cookie server
 * client, so a non-member of the interview's commission gets `[]`/`null` (never a
 * leak). Commission/case are resolved in the DB via the per-table policies; these
 * reads add no extra authz of their own. All user-facing strings are pt-BR and
 * resolved in the UI — the ASCII union slugs below are stable storage values.
 */

// ---------------------------------------------------------------------------
// Union types (stable ASCII slugs; pt-BR labels resolved in the UI)
// ---------------------------------------------------------------------------

/**
 * Interview lifecycle. `draft` (created, no session yet); `scheduled` once a
 * session is scheduled; `in_progress` while a session is being conducted;
 * `awaiting_follow_up` after a session completed AND another is still scheduled;
 * `completed` once finalized (writes the registry event). `cancelled` is TERMINAL
 * (not reopenable); only `completed` reopens back to `in_progress`.
 */
export type InterviewStatus =
  | 'draft'
  | 'scheduled'
  | 'in_progress'
  | 'awaiting_follow_up'
  | 'completed'
  | 'cancelled'

/**
 * Dashboard classification of the interview (IV2 N1; fixed-enum CHECK in the DB),
 * required at create. English key; pt-BR label in the UI.
 */
export type InterviewCategory =
  | 'witness'
  | 'subject'
  | 'clinical_team'
  | 'expert'
  | 'complainant'
  | 'respondent'
  | 'administrative'
  | 'other'

/**
 * An interview's confidentiality classification on the platform's SINGLE confidentiality
 * taxonomy (X-δ — one taxonomy, no parallel copies). IV2's inert 3-value tag
 * (`standard`/`restricted`/`highly_restricted`) was remapped to this at E1 (BE-6, O3:
 * `standard→non_phi_internal`, `restricted→peer_review_confidential`,
 * `highly_restricted→ethics_investigation`) and is now ENFORCING — `legal_privileged`
 * + `credentialing_sensitive` gate above ordinary case-read. A direct alias of the
 * canonical {@link ConfidentialityLabel} (the client-safe source of truth) so it can
 * never drift. English key; pt-BR label in the UI.
 */
export type InterviewConfidentiality = ConfidentialityLabel

/**
 * A subject's relationship to the case (IV2 N2; fixed-enum CHECK), required at add.
 * Staff-only — deliberately EXCLUDES patient/family_member (Rule 12). Distinct from
 * the free-text `clinicalRole`.
 */
export type RelationshipToCase =
  | 'attending_physician'
  | 'consulting_physician'
  | 'nurse'
  | 'other_professional'
  | 'witness'
  | 'complainant'
  | 'respondent'
  | 'subject'
  | 'expert'
  | 'committee_member'
  | 'other'

/** A session's kind (IV2; fixed-enum CHECK). */
export type SessionType =
  | 'initial'
  | 'follow_up'
  | 'clarification'
  | 'written_response'
  | 'supplementary'
  | 'closing'

/** A session's own lifecycle status (IV2; fixed-enum CHECK). */
export type SessionStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'

/**
 * An interviewer's fixed committee role on the interview (fixed-enum CHECK in the
 * DB). Distinct from a SUBJECT's clinical role, which is FREE TEXT.
 */
export type InterviewerRole =
  | 'entrevistador_principal'
  | 'entrevistador'
  | 'observador'
  | 'anotador'

/** How a session is held (mirror of the meetings modality). Nullable on a session
 * (a written_response/async session leaves it null). */
export type InterviewModality = 'presencial' | 'remoto' | 'hibrido'

/**
 * An attachment's EVIDENCE category (fixed CHECK in the DB). ORTHOGONAL to
 * file-vs-link: any kind may be a stored file (`storagePath`) OR an external link
 * (`externalUrl`) — the storage/link distinction is enforced by a separate XOR
 * CHECK, not by `kind`.
 */
export type InterviewAttachmentKind =
  | 'gravacao_audio'
  | 'transcricao_assinada'
  | 'evidencia'
  | 'outro'

// ---------------------------------------------------------------------------
// Domain interfaces (camelCase) — the frozen frontend contract
// ---------------------------------------------------------------------------

/**
 * A compact summary of the next upcoming (`scheduled`) session, for the list
 * subtitle + header (replaces the interview's old single `scheduledStart`). `null`
 * when no session is scheduled.
 */
export interface NextSessionSummary {
  id: string
  sequenceNumber: number
  sessionType: SessionType
  /** ISO timestamp of the planned start; `null` if the session has no start set yet. */
  scheduledStart: string | null
}

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
  /** IV2: dashboard classification (required at create). */
  interviewCategory: InterviewCategory
  /** ENFORCING confidentiality classification (ADR 0072 D7 · E1): `legal_privileged` +
   * `credentialing_sensitive` gate the interview above ordinary case-read. */
  confidentialityLevel: InterviewConfidentiality
  /** IV2: the earliest upcoming `scheduled` session, or `null`. */
  nextSession: NextSessionSummary | null
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
   * The SINGLE signal the detail UI gates every write control on.
   */
  viewerCanWrite: boolean
}

/**
 * A single encounter of an interview (IV2 — ADR 0070). Carries scheduling (moved
 * off the interview) + its own lifecycle status. `modality` is nullable (a
 * written_response/async session leaves it null).
 */
export interface InterviewSession {
  id: string
  interviewId: string
  /** 1-based order within the interview (unique per interview). */
  sequenceNumber: number
  sessionType: SessionType
  status: SessionStatus
  modality: InterviewModality | null
  /** ISO timestamp; the planned start. */
  scheduledStart: string | null
  /** ISO timestamp; the planned end. */
  scheduledEnd: string | null
  /** ISO timestamp the session actually started (set by `startSession`). */
  actualStart: string | null
  /** ISO timestamp the session actually ended (set by `completeSession`). */
  actualEnd: string | null
  locationText: string | null
  /** Video-call URL for a remote/hybrid session; `null` if absent. */
  meetingUrl: string | null
  /** Reason recorded on a cancelled/no_show session; `null` otherwise. */
  cancellationReason: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/**
 * An interviewee (the professional being interviewed). A platform user
 * (`userId`) XOR an external person (`externalName`). `relationshipToCase` (IV2) is
 * a fixed enum; `clinicalRole` is FREE TEXT (e.g. "Enfermeira da UTI"). **No
 * patient data** — subjects are staff, never patients.
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
  /** IV2: the subject's relationship to the case (required; staff-only enum). */
  relationshipToCase: RelationshipToCase
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
 * gains row-level WRITE on the interview and must be a member of the commission
 * (HC021).
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
 * private bucket); a linked attachment has an `externalUrl` (https-only) — exactly
 * one is non-null. Soft-deleted rows are excluded from reads.
 */
export interface InterviewAttachment {
  id: string
  interviewId: string
  kind: InterviewAttachmentKind
  title: string
  /** Immutable Storage path (unique); `null` for links. */
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
 * non-null.
 */
export interface InterviewAttachmentWithUrl extends InterviewAttachment {
  /** Short-lived signed download URL for a STORED file; `null` for links (or if minting failed). */
  openUrl: string | null
}

// ---------------------------------------------------------------------------
// Row shapes (RLS-scoped table reads)
// ---------------------------------------------------------------------------

/** Embedded session row for deriving `nextSession` on list/detail reads. */
interface NextSessionRow {
  id: string
  sequence_number: number
  session_type: SessionType
  status: SessionStatus
  scheduled_start: string | null
}

interface InterviewRow {
  id: string
  commission_id: string
  case_id: string
  case_phase_id: string | null
  interview_number: number
  title: string | null
  status: InterviewStatus
  interview_category: InterviewCategory
  confidentiality_level: InterviewConfidentiality
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
  interview_sessions: NextSessionRow[] | null
}

interface InterviewSessionRow {
  id: string
  interview_id: string
  sequence_number: number
  session_type: SessionType
  status: SessionStatus
  modality: InterviewModality | null
  scheduled_start: string | null
  scheduled_end: string | null
  actual_start: string | null
  actual_end: string | null
  location_text: string | null
  meeting_url: string | null
  cancellation_reason: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

interface SubjectRow {
  id: string
  interview_id: string
  user_id: string | null
  external_name: string | null
  external_org: string | null
  relationship_to_case: RelationshipToCase
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

/** Phase F2: interview external LINKS live in `case_interview_links`. */
interface InterviewLinkRow {
  id: string
  interview_id: string
  title: string
  external_url: string
  created_by: string | null
  created_at: string
  profiles: { full_name: string | null } | null
}

/** Subset of {@link InterviewRow} + joined subject roster + sessions for the list. */
interface InterviewListRow extends InterviewRow {
  case_interview_subjects: {
    external_name: string | null
    profiles: { full_name: string | null } | null
  }[]
  interview_sessions: NextSessionRow[] | null
}

function subjectName(s: {
  external_name: string | null
  profiles: { full_name: string | null } | null
}): string {
  return s.profiles?.full_name ?? s.external_name ?? 'Entrevistado'
}

/** Earliest upcoming `scheduled` session (by start, nulls last, then sequence). */
function toNextSession(rows: NextSessionRow[] | null): NextSessionSummary | null {
  const scheduled = (rows ?? []).filter((s) => s.status === 'scheduled')
  if (scheduled.length === 0) return null
  scheduled.sort((a, b) => {
    if (a.scheduled_start && b.scheduled_start) {
      return a.scheduled_start.localeCompare(b.scheduled_start)
    }
    if (a.scheduled_start) return -1
    if (b.scheduled_start) return 1
    return a.sequence_number - b.sequence_number
  })
  const n = scheduled[0]
  return {
    id: n.id,
    sequenceNumber: n.sequence_number,
    sessionType: n.session_type,
    scheduledStart: n.scheduled_start,
  }
}

const INTERVIEW_LIST_COLUMNS = `id, commission_id, case_id, case_phase_id, interview_number,
  title, status, interview_category, confidentiality_level, concluded_at,
  created_by, created_at, updated_at`

const SESSION_COLUMNS = `id, interview_id, sequence_number, session_type, status, modality,
  scheduled_start, scheduled_end, actual_start, actual_end, location_text, meeting_url,
  cancellation_reason, created_by, created_at, updated_at`

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
      `${INTERVIEW_LIST_COLUMNS},
       case_interview_subjects ( external_name, profiles:user_id ( full_name ) ),
       interview_sessions ( id, sequence_number, session_type, status, scheduled_start )`,
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
      interviewCategory: r.interview_category,
      confidentialityLevel: r.confidentiality_level,
      nextSession: toNextSession(r.interview_sessions),
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
 * `interview_viewer_can_write` RPC so the UI can gate write controls.
 */
export async function getInterviewDetail(
  interviewId: string,
): Promise<InterviewDetail | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('case_interviews')
    .select(
      `${INTERVIEW_LIST_COLUMNS},
       summary_md, form_version_id, registry_event_id, concluded_by, cancelled_at,
       cases:case_id ( case_number, label ),
       interview_sessions ( id, sequence_number, session_type, status, scheduled_start )`,
    )
    .eq('id', interviewId)
    .maybeSingle<InterviewDetailRow>()

  if (error || !data) return null

  // WS B (Rule 11): audit an interview detail-open. Best-effort, app-layer on the
  // RLS-scoped read; commission-scoped attribution.
  await logAuditAccess({
    action: 'interview.viewed',
    entityType: 'interview',
    entityId: interviewId,
    commissionId: data.commission_id,
    summary: 'Detalhe da entrevista visualizado',
  })

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
    interviewCategory: data.interview_category,
    confidentialityLevel: data.confidentiality_level,
    nextSession: toNextSession(data.interview_sessions),
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

/** The interview's sessions, ordered by `sequence_number`. */
export async function listInterviewSessions(
  interviewId: string,
): Promise<InterviewSession[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('interview_sessions')
    .select(SESSION_COLUMNS)
    .eq('interview_id', interviewId)
    .order('sequence_number', { ascending: true })
    .returns<InterviewSessionRow[]>()

  if (error || !data) return []

  return data.map((r) => ({
    id: r.id,
    interviewId: r.interview_id,
    sequenceNumber: r.sequence_number,
    sessionType: r.session_type,
    status: r.status,
    modality: r.modality,
    scheduledStart: r.scheduled_start,
    scheduledEnd: r.scheduled_end,
    actualStart: r.actual_start,
    actualEnd: r.actual_end,
    locationText: r.location_text,
    meetingUrl: r.meeting_url,
    cancellationReason: r.cancellation_reason,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}

/** The interview's interviewees (subjects), ordered by creation. */
export async function listInterviewSubjects(
  interviewId: string,
): Promise<InterviewSubject[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('case_interview_subjects')
    .select(
      `id, interview_id, user_id, external_name, external_org, relationship_to_case,
       clinical_role, note, profiles:user_id ( full_name )`,
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
    relationshipToCase: r.relationship_to_case,
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
 * `file` rows get a batch-minted short-lived signed `openUrl`; `link` rows expose
 * their `external_url` and have `openUrl = null`. Batch-minted under the same
 * RLS-scoped client, so a foreign caller gets neither rows nor URLs.
 */
export async function listInterviewAttachments(
  interviewId: string,
): Promise<InterviewAttachmentWithUrl[]> {
  const supabase = await createClient()

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

  return [...fileItems, ...linkItems].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
}

/**
 * Feature-flag gate for the interviews surface. Backed by the SECURITY DEFINER
 * `public.interviews_enabled()` read (the flag lives in the locked-down `app`
 * schema). Fails closed.
 */
export async function interviewsEnabled(): Promise<boolean> {
  return featureEnabled('interviews')
}
