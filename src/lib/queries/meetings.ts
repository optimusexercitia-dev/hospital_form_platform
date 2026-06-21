import { createClient } from '@/lib/supabase/server'
import { logAuditAccess } from '@/lib/audit/access'

/**
 * Meetings data-access (Phase 10 — Meetings; Architecture Rule 9 — all reads go
 * through `src/lib/queries/`). Meetings are the committee's minutes/ata registry:
 * a header with a lifecycle (`agendada → realizada → em_assinatura → assinada →
 * distribuida`, plus `cancelada`), an ordered agenda, attendees + quorum, cases
 * discussed, internal electronic signatures, action plans, and attachments.
 *
 * RLS is the security boundary: every read below uses the RLS-scoped cookie
 * server client, so a non-member of the meeting's commission gets `[]`/`null`
 * (never a leak). Commission is resolved in the DB via the `app.commission_of_*`
 * helpers and the per-table policies; these reads add no extra authz of their
 * own. All user-facing strings are pt-BR and resolved in the UI — the ASCII
 * union slugs below are stable storage values, not labels.
 */

// ---------------------------------------------------------------------------
// Union types (stable ASCII slugs; pt-BR labels resolved in the UI)
// ---------------------------------------------------------------------------

/** Meeting lifecycle. `assinada` is auto-flipped inside the sign RPC; `distribuida` and `cancelada` are terminal. */
export type MeetingStatus =
  | 'agendada'
  | 'realizada'
  | 'em_assinatura'
  | 'assinada'
  | 'distribuida'
  | 'cancelada'

/** How the meeting is held. */
export type MeetingModality = 'presencial' | 'remoto' | 'hibrido'

/** A participant's function in the meeting. */
export type AttendeeRole = 'presidente' | 'secretario' | 'membro' | 'convidado'

/** A participant's attendance state (convocado → presente/ausente/justificado). */
export type AttendanceStatus =
  | 'convocado'
  | 'presente'
  | 'ausente'
  | 'justificado'

/** A signature's state. Re-opening a meeting flips active signatures to `revoked` (rows kept). */
export type SignatureStatus = 'signed' | 'declined' | 'revoked'

/** Attachment categories (fixed CHECK in the DB). */
export type MeetingAttachmentKind =
  | 'pauta'
  | 'apresentacao'
  | 'literatura'
  | 'lista_presenca'
  | 'ata_assinada'
  | 'outro'

/** Per-commission quorum rule. `quorum_value` is interpreted per rule (see {@link CommissionMeetingSettings}). */
export type QuorumRuleType = 'maioria_simples' | 'fixed_count' | 'percentage'

// ---------------------------------------------------------------------------
// Domain interfaces (camelCase)
// ---------------------------------------------------------------------------

/** A meeting as it appears in the list / cards view. */
export interface MeetingListItem {
  id: string
  commissionId: string
  /** Per-commission sequential number, minted on insert. */
  meetingNumber: number
  title: string
  status: MeetingStatus
  modality: MeetingModality
  /** The meeting type id (`null` once the type is deleted — FK `on delete set null`). */
  meetingTypeId: string | null
  /** The meeting type's display name (joined); `null` if unset/deleted. */
  meetingTypeName: string | null
  /** The type's palette token for chips (joined); `null` if unset/deleted. */
  meetingTypeColorToken: string | null
  /** ISO timestamp; the planned start. */
  scheduledStart: string
  /** ISO timestamp; the planned end (`null` if open-ended). */
  scheduledEnd: string | null
  locationText: string | null
  meetingUrl: string | null
  /** Secretary's quorum verdict (computed at conclusion, overridable); `null` before conclusion. */
  quorumMet: boolean | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/** Full meeting detail (the registry hub). Superset of {@link MeetingListItem}. */
export interface MeetingDetail extends MeetingListItem {
  /** Free-form minutes narrative (sanitized Markdown, Architecture Rule 7); `null` if empty. */
  minutesMd: string | null
  /** Quorum rule SNAPSHOT taken at conclusion (stable history); `null` before conclusion. */
  quorumRuleType: QuorumRuleType | null
  /** Quorum rule value SNAPSHOT (interpretation depends on `quorumRuleType`); `null` when not applicable. */
  quorumValue: number | null
  /** `count(attendees where attendance='presente')` SNAPSHOT at conclusion; `null` before. */
  presentCount: number | null
  /** `count(commission_members)` SNAPSHOT at conclusion; `null` before. */
  eligibleMemberCount: number | null
  /** ISO timestamp the meeting was concluded (→ `em_assinatura`); `null` if not concluded. */
  concludedAt: string | null
  /** User who concluded the meeting; `null` if not concluded. */
  concludedBy: string | null
  /** ISO timestamp the ata was distributed (→ `distribuida`); `null` otherwise. */
  distributedAt: string | null
  /** ISO timestamp the meeting was cancelled; `null` otherwise. */
  cancelledAt: string | null
}

/** One ordered agenda/minutes item (planned + discussion + resolution). */
export interface MeetingAgendaItem {
  id: string
  meetingId: string
  /** 0-based order within the meeting (deferrable-unique). */
  position: number
  title: string
  /** Planned description, set when scheduling; `null` if absent. */
  description: string | null
  /** What was discussed (filled during/after the meeting); `null` if absent. */
  discussionNotes: string | null
  /** The decision/outcome for this item; `null` if absent. */
  resolution: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/** A meeting participant: a platform user XOR an external guest. */
export interface MeetingAttendee {
  id: string
  meetingId: string
  /** The platform user, when this is a member attendee; `null` for external guests. */
  userId: string | null
  /** External guest name; `null` when `userId` is set. */
  externalName: string | null
  /** External guest organization; `null` when `userId` is set or unknown. */
  externalOrg: string | null
  role: AttendeeRole
  attendance: AttendanceStatus
  note: string | null
  /**
   * Resolved label for the row: the joined platform user's `full_name` for
   * member attendees, else the `externalName` for guests; `null` only if a
   * member's profile is unresolved.
   */
  displayName: string | null
}

/** A case discussed at the meeting (junction to an existing commission case). */
export interface MeetingCaseLink {
  id: string
  meetingId: string
  caseId: string
  /**
   * The case's per-commission number (joined). `null` when the viewer cannot READ
   * the linked case — see {@link MeetingCaseLink.restricted}. (Case Access Control,
   * ADR 0033: the meeting detail is visible to all commission members, but the
   * embedded `cases` join now goes through the tightened `cases_select` =
   * `can_read_case`, so a member without access to a linked case sees the linkage
   * row but not the case identity.)
   */
  caseNumber: number | null
  /** The case's NON-identifying label (joined); `null` if none OR restricted. */
  caseLabel: string | null
  /**
   * `true` when the viewer may NOT read the linked case (the embedded `cases` join
   * returned null under `can_read_case`): the junction row stays visible but the
   * case identity is withheld. The UI renders a muted "Caso restrito" chip (FE-7)
   * instead of a broken "Caso 0". `false` ⇒ `caseNumber`/`caseLabel` are populated.
   */
  restricted: boolean
  /** Optional agenda item this discussion is attached to; `null` if free-standing. */
  agendaItemId: string | null
  summary: string | null
  decision: string | null
}

/** An internal electronic signature on a meeting's ata (one per present platform attendee). */
export interface MeetingSignature {
  id: string
  meetingId: string
  /** The attendee row being signed for. */
  attendeeId: string
  /** The platform user who signed (denormalized; `= attendee.userId`). */
  signerId: string
  /** The signer's display name (joined); `null` if unresolved. */
  signerName: string | null
  status: SignatureStatus
  /** ISO timestamp the signature was recorded; `null` if not yet signed (placeholder/revoked rows). */
  signedAt: string | null
  /** Signature method (default `internal_eauth`; extensible for future providers). */
  method: string
  /** sha256 hex of the locked minutes at signing time; `null` if absent (revoked/declined). */
  contentHash: string | null
}

/** An attachment's metadata (the file lives in the private `meeting-attachments` bucket). */
export interface MeetingAttachment {
  id: string
  meetingId: string
  kind: MeetingAttachmentKind
  title: string
  /** Immutable Storage path `{commissionId}/{meetingId}/{uuid}.{ext}` (unique). */
  storagePath: string
  mimeType: string | null
  sizeBytes: number | null
  uploadedBy: string | null
  /** Uploader's display name (joined); `null` if unresolved. */
  uploadedByName: string | null
  createdAt: string
}

/** A {@link MeetingAttachment} plus a freshly-minted signed URL for download. */
export interface MeetingAttachmentWithUrl extends MeetingAttachment {
  /** Short-lived signed download URL (`createSignedUrl`); `null` if it failed. */
  signedUrl: string | null
}

/** A per-commission meeting-type vocabulary entry (mirror of case tags). */
export interface CommissionMeetingType {
  id: string
  commissionId: string
  name: string
  /** Palette token (7-token set) for the chip. */
  colorToken: string
  position: number
  archived: boolean
}

/** The per-commission quorum configuration (one row per commission). */
export interface CommissionMeetingSettings {
  commissionId: string
  quorumRuleType: QuorumRuleType
  /**
   * Rule value: `null` for `maioria_simples`, an integer member count for
   * `fixed_count`, or a 1–100 percentage for `percentage`.
   */
  quorumValue: number | null
  updatedAt: string
}

/** A meeting awaiting the current user's signature (derived read; the shell badge + queue). */
export interface PendingMeetingSignature {
  meetingId: string
  meetingNumber: number
  title: string
  /** ISO timestamp; the planned start. */
  scheduledStart: string
  /** The current user's attendee row to sign for. */
  attendeeId: string
}

// ---------------------------------------------------------------------------
// Row shapes (RLS-scoped table reads)
// ---------------------------------------------------------------------------

/**
 * The meetings-list row projection (the columns {@link MEETING_LIST_COLUMNS}
 * selects). Exported so the Case Timeline's reverse `meeting_cases → meetings`
 * read (`@/lib/queries/case-timeline`) can reuse the SAME projection + mapper
 * instead of duplicating the meeting shape.
 */
export interface MeetingRow {
  id: string
  commission_id: string
  meeting_number: number
  title: string
  status: MeetingStatus
  modality: MeetingModality
  meeting_type_id: string | null
  scheduled_start: string
  scheduled_end: string | null
  location_text: string | null
  meeting_url: string | null
  quorum_met: boolean | null
  created_by: string | null
  created_at: string
  updated_at: string
  commission_meeting_types: { name: string; color_token: string } | null
}

interface MeetingDetailRow extends MeetingRow {
  minutes_md: string | null
  quorum_rule_type: QuorumRuleType | null
  quorum_value: number | null
  present_count: number | null
  eligible_member_count: number | null
  concluded_at: string | null
  concluded_by: string | null
  distributed_at: string | null
  cancelled_at: string | null
}

interface AgendaRow {
  id: string
  meeting_id: string
  position: number
  title: string
  description: string | null
  discussion_notes: string | null
  resolution: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

interface AttendeeRow {
  id: string
  meeting_id: string
  user_id: string | null
  external_name: string | null
  external_org: string | null
  role: AttendeeRole
  attendance: AttendanceStatus
  note: string | null
  profiles: { full_name: string | null } | null
}

interface CaseLinkRow {
  id: string
  meeting_id: string
  case_id: string
  agenda_item_id: string | null
  summary: string | null
  decision: string | null
  cases: { case_number: number; label: string | null } | null
}

interface SignatureRow {
  id: string
  meeting_id: string
  attendee_id: string
  signer_id: string
  status: SignatureStatus
  signed_at: string | null
  method: string
  content_hash: string | null
  profiles: { full_name: string | null } | null
}

interface AttachmentRow {
  id: string
  meeting_id: string
  kind: MeetingAttachmentKind
  title: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_by: string | null
  created_at: string
  profiles: { full_name: string | null } | null
}

interface MeetingTypeRow {
  id: string
  commission_id: string
  name: string
  color_token: string
  position: number
  archived: boolean
}

interface MeetingSettingsRow {
  commission_id: string
  quorum_rule_type: QuorumRuleType
  quorum_value: number | null
  updated_at: string
}

interface PendingSignatureRow {
  meeting_id: string
  meeting_number: number
  title: string
  scheduled_start: string
  attendee_id: string
}

const SIGNED_URL_TTL_SECONDS = 3600

/**
 * Map a {@link MeetingRow} to the {@link MeetingListItem} domain shape. Exported
 * (as `mapMeetingListItem`) for the Case Timeline's reverse meetings read; kept
 * available under the local `mapListItem` alias for this module's own reads.
 */
export function mapMeetingListItem(r: MeetingRow): MeetingListItem {
  return {
    id: r.id,
    commissionId: r.commission_id,
    meetingNumber: r.meeting_number,
    title: r.title,
    status: r.status,
    modality: r.modality,
    meetingTypeId: r.meeting_type_id,
    meetingTypeName: r.commission_meeting_types?.name ?? null,
    meetingTypeColorToken: r.commission_meeting_types?.color_token ?? null,
    scheduledStart: r.scheduled_start,
    scheduledEnd: r.scheduled_end,
    locationText: r.location_text,
    meetingUrl: r.meeting_url,
    quorumMet: r.quorum_met,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

/** Local alias preserving this module's existing internal call-sites. */
const mapListItem = mapMeetingListItem

/**
 * The meetings-list column projection. Exported so the Case Timeline's reverse
 * `meeting_cases → meetings` read reuses the identical projection.
 */
export const MEETING_LIST_COLUMNS = `
  id, commission_id, meeting_number, title, status, modality, meeting_type_id,
  scheduled_start, scheduled_end, location_text, meeting_url, quorum_met,
  created_by, created_at, updated_at,
  commission_meeting_types:meeting_type_id ( name, color_token )
`

// ---------------------------------------------------------------------------
// Reads — RLS-scoped (members read their commission's meetings; `[]`/`null`
// when unreadable).
// ---------------------------------------------------------------------------

/** Every meeting of a commission (upcoming + past), for the list view. Newest scheduled first. */
export async function listMeetings(
  commissionId: string,
): Promise<MeetingListItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('meetings')
    .select(MEETING_LIST_COLUMNS)
    .eq('commission_id', commissionId)
    .order('scheduled_start', { ascending: false })
    .returns<MeetingRow[]>()

  if (error || !data) return []
  return data.map(mapListItem)
}

/** Full detail for one meeting (the registry hub), or `null` if unreadable/absent. */
export async function getMeetingDetail(
  meetingId: string,
): Promise<MeetingDetail | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('meetings')
    .select(
      `${MEETING_LIST_COLUMNS},
       minutes_md, quorum_rule_type, quorum_value, present_count,
       eligible_member_count, concluded_at, concluded_by, distributed_at, cancelled_at`,
    )
    .eq('id', meetingId)
    .maybeSingle<MeetingDetailRow>()

  if (error || !data) return null

  // WS B (Rule 11/12): audit a meeting detail-open (free-text minutes_md). Best-
  // effort, app-layer on the RLS-scoped read; commission-scoped attribution.
  await logAuditAccess({
    action: 'meeting.viewed',
    entityType: 'meeting',
    entityId: meetingId,
    commissionId: data.commission_id,
    summary: 'Detalhe da reunião visualizado',
  })

  return {
    ...mapListItem(data),
    minutesMd: data.minutes_md,
    quorumRuleType: data.quorum_rule_type,
    quorumValue: data.quorum_value,
    presentCount: data.present_count,
    eligibleMemberCount: data.eligible_member_count,
    concludedAt: data.concluded_at,
    concludedBy: data.concluded_by,
    distributedAt: data.distributed_at,
    cancelledAt: data.cancelled_at,
  }
}

/** The meeting's agenda items, ordered by `position`. */
export async function listMeetingAgenda(
  meetingId: string,
): Promise<MeetingAgendaItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('meeting_agenda_items')
    .select(
      `id, meeting_id, position, title, description, discussion_notes,
       resolution, created_by, created_at, updated_at`,
    )
    .eq('meeting_id', meetingId)
    .order('position', { ascending: true })
    .returns<AgendaRow[]>()

  if (error || !data) return []

  return data.map((r) => ({
    id: r.id,
    meetingId: r.meeting_id,
    position: r.position,
    title: r.title,
    description: r.description,
    discussionNotes: r.discussion_notes,
    resolution: r.resolution,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}

/** The meeting's attendees (members + external guests), for the attendance/quorum panel. */
export async function listMeetingAttendees(
  meetingId: string,
): Promise<MeetingAttendee[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('meeting_attendees')
    .select(
      `id, meeting_id, user_id, external_name, external_org, role, attendance,
       note, profiles:user_id ( full_name )`,
    )
    .eq('meeting_id', meetingId)
    .order('role', { ascending: true })
    .order('created_at', { ascending: true })
    .returns<AttendeeRow[]>()

  if (error || !data) return []

  return data.map((r) => ({
    id: r.id,
    meetingId: r.meeting_id,
    userId: r.user_id,
    externalName: r.external_name,
    externalOrg: r.external_org,
    role: r.role,
    attendance: r.attendance,
    note: r.note,
    displayName: r.profiles?.full_name ?? r.external_name ?? null,
  }))
}

/** The cases discussed at the meeting (junction rows joined to their case header). */
export async function listMeetingCases(
  meetingId: string,
): Promise<MeetingCaseLink[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('meeting_cases')
    .select(
      `id, meeting_id, case_id, agenda_item_id, summary, decision,
       cases:case_id ( case_number, label )`,
    )
    .eq('meeting_id', meetingId)
    .returns<CaseLinkRow[]>()

  if (error || !data) return []

  return data.map((r) => ({
    id: r.id,
    meetingId: r.meeting_id,
    caseId: r.case_id,
    // The embedded `cases` join is RLS-scoped (cases_select = can_read_case under
    // ADR 0033); a null embed means the viewer cannot read the linked case → the
    // linkage row stays, the case identity is withheld + flagged restricted.
    caseNumber: r.cases?.case_number ?? null,
    caseLabel: r.cases?.label ?? null,
    restricted: r.cases == null,
    agendaItemId: r.agenda_item_id,
    summary: r.summary,
    decision: r.decision,
  }))
}

/** The meeting's signatures (one per present platform attendee), for the signatures roster. */
export async function listMeetingSignatures(
  meetingId: string,
): Promise<MeetingSignature[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('meeting_signatures')
    .select(
      `id, meeting_id, attendee_id, signer_id, status, signed_at, method,
       content_hash, profiles:signer_id ( full_name )`,
    )
    .eq('meeting_id', meetingId)
    .order('signed_at', { ascending: true })
    .returns<SignatureRow[]>()

  if (error || !data) return []

  return data.map((r) => ({
    id: r.id,
    meetingId: r.meeting_id,
    attendeeId: r.attendee_id,
    signerId: r.signer_id,
    signerName: r.profiles?.full_name ?? null,
    status: r.status,
    signedAt: r.signed_at,
    method: r.method,
    contentHash: r.content_hash,
  }))
}

/**
 * The meeting's NON-deleted attachments, each with a short-lived signed download
 * URL (batch-minted under the same RLS-scoped client, so a foreign caller gets
 * neither rows nor URLs). Soft-deleted rows are excluded.
 */
export async function listMeetingAttachments(
  meetingId: string,
): Promise<MeetingAttachmentWithUrl[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('meeting_attachments')
    .select(
      `id, meeting_id, kind, title, storage_path, mime_type, size_bytes,
       uploaded_by, created_at, profiles:uploaded_by ( full_name )`,
    )
    .eq('meeting_id', meetingId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<AttachmentRow[]>()

  if (error || !data) return []

  const paths = data.map((r) => r.storage_path)
  const signedByPath = new Map<string, string>()
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('meeting-attachments')
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) signedByPath.set(s.path, s.signedUrl)
    }
  }

  return data.map((r) => ({
    id: r.id,
    meetingId: r.meeting_id,
    kind: r.kind,
    title: r.title,
    storagePath: r.storage_path,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    uploadedBy: r.uploaded_by,
    uploadedByName: r.profiles?.full_name ?? null,
    createdAt: r.created_at,
    signedUrl: signedByPath.get(r.storage_path) ?? null,
  }))
}

/** A fresh short-lived signed download URL for a single attachment path; `null` if denied. */
export async function getMeetingAttachmentDownloadUrl(
  storagePath: string,
): Promise<string | null> {
  if (!storagePath) return null
  const supabase = await createClient()
  const { data } = await supabase.storage
    .from('meeting-attachments')
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)
  return data?.signedUrl ?? null
}

/** A commission's meeting-type vocabulary (non-archived first), for chips + the schedule form. */
export async function listMeetingTypes(
  commissionId: string,
): Promise<CommissionMeetingType[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('commission_meeting_types')
    .select('id, commission_id, name, color_token, position, archived')
    .eq('commission_id', commissionId)
    .order('archived', { ascending: true })
    .order('position', { ascending: true })
    .returns<MeetingTypeRow[]>()

  if (error || !data) return []

  return data.map((r) => ({
    id: r.id,
    commissionId: r.commission_id,
    name: r.name,
    colorToken: r.color_token,
    position: r.position,
    archived: r.archived,
  }))
}

/** A commission's quorum configuration; `null` only if the settings row is unreadable/absent. */
export async function getMeetingSettings(
  commissionId: string,
): Promise<CommissionMeetingSettings | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('commission_meeting_settings')
    .select('commission_id, quorum_rule_type, quorum_value, updated_at')
    .eq('commission_id', commissionId)
    .maybeSingle<MeetingSettingsRow>()

  if (error || !data) return null

  return {
    commissionId: data.commission_id,
    quorumRuleType: data.quorum_rule_type,
    quorumValue: data.quorum_value,
    updatedAt: data.updated_at,
  }
}

/**
 * Meetings awaiting the CURRENT user's signature (the shell badge + the
 * "pending signatures" queue). Backed by the SECURITY DEFINER
 * `my_pending_meeting_signatures` RPC (mirror of `list_signoff_queue`); `[]` for
 * a user with nothing to sign.
 */
export async function myPendingMeetingSignatures(): Promise<
  PendingMeetingSignature[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_pending_meeting_signatures')

  if (error || !data) return []

  return (data as unknown as PendingSignatureRow[]).map((r) => ({
    meetingId: r.meeting_id,
    meetingNumber: r.meeting_number,
    title: r.title,
    scheduledStart: r.scheduled_start,
    attendeeId: r.attendee_id,
  }))
}
