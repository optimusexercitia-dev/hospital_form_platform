import { createClient } from '@/lib/supabase/server'
import { listAttachments } from '@/lib/queries/attachments'

/**
 * Case DOCUMENTS & manual EVENTS data-access (Cases-Extras batch, R1).
 *
 * Two independent child entities of a case (Architecture Rule 9 — reads through
 * `src/lib/queries/`):
 *   - documents — file-backed artifacts (minutes/ata, scans, registries). As of
 *     Phase F2 (ADR 0063) these are `public.attachments` rows with
 *     `owner_type='case'` (the old `case_documents` table was folded in). This
 *     module is a THIN ADAPTER over `listAttachments('case', …)` that preserves the
 *     `CaseDocument` shape so existing callers keep compiling. NOTE: case documents
 *     default to the PHI tier, so their blob lives in `attachments-phi` (no direct
 *     signed URL) — `signedUrl` is `null` and `containsPhi` is `true`; download via
 *     the audited `openAttachment(attachmentId)` door (`src/lib/attachments/actions`).
 *   - `case_events` — manual free-text working notes (meeting/decision/note).
 *     Fully editable + hard-deletable (not immutable artifacts).
 *
 * RLS: member-read / staff_admin-write, commission resolved via the existing
 * `app.commission_of_case` (documents now via `app.can_read_attachment`). All
 * user-facing strings are the caller's (pt-BR).
 */

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/** File-backed document kinds (ASCII slugs; pt-BR labels resolved in the UI). */
export type CaseDocumentType = 'ata' | 'digitalizacao' | 'registro' | 'other'

/** A file-backed case document (metadata; the file lives in Storage). */
export interface CaseDocument {
  id: string
  caseId: string
  docType: CaseDocumentType
  title: string
  description: string | null
  /** Immutable Storage path `{commissionId}/{caseId}/{uuid}.{ext}` (unique). */
  storagePath: string
  mimeType: string | null
  sizeBytes: number | null
  /** Real-world date of the document (distinct from upload time); `null` ok. */
  occurredAt: string | null
  uploadedBy: string | null
  /** Uploader's display name (joined); `null` if unresolved. */
  uploadedByName: string | null
  createdAt: string
}

/** A {@link CaseDocument} plus a freshly-minted signed URL for download. */
export interface CaseDocumentWithUrl extends CaseDocument {
  /** Short-lived signed download URL for a STANDARD-tier blob; `null` for a
   * PHI-tier blob (the common case for case documents) — open it via the audited
   * `openAttachment({@link attachmentId})` door instead. */
  signedUrl: string | null
  /** The underlying attachment id (Phase F2) — pass to `openAttachment` for the
   * audited PHI download. Optional so existing callers keep compiling. */
  attachmentId?: string
  /** `true` when the blob is PHI-tiered (`signedUrl` is then `null`). */
  containsPhi?: boolean
}

// ---------------------------------------------------------------------------
// Events (manual free-text)
// ---------------------------------------------------------------------------

/**
 * Manual case-event kinds the UI authors + labels (ASCII slugs; pt-BR labels in
 * the UI). The DB `case_events_kind_check` additionally allows system "registry
 * echo" kinds (`interview` — Phase 11; `safety_event` — Phase 14a) written by
 * conclusion/notify RPCs; those are deduped OFF the case timeline against their
 * authoritative source event and are never surfaced as a manual event, so they
 * stay out of this user-facing union (the timeline compares the raw `kind` string
 * to drop them — see `case-timeline.ts`). `meeting` predates this and remains.
 */
export type CaseEventKind = 'note' | 'meeting' | 'decision' | 'other'

/**
 * System / auto-derived event kinds — NEVER manually creatable (so they stay OUT of
 * `CaseEventKind`, the manual create-select + `EVENT_KIND_LABEL` union). `interview`
 * and `safety_event` are the pre-existing DB-only "registry echo" kinds (deduped off
 * the timeline against their authoritative source — see `case-timeline.ts`). The
 * eight ethics procedural kinds are NEW in E3a and, unlike the echoes, DO surface on
 * the timeline: under O-3 = auto-derive each is emitted by the matching E2 procedure
 * RPC (BE-2..BE-6), never authored by hand.
 */
export type ProceduralCaseEventKind =
  | 'interview'
  | 'safety_event'
  | 'admissibility_decided'
  | 'allegation_added'
  | 'finding_recorded'
  | 'notification_issued'
  | 'hearing_scheduled'
  | 'vote_cast'
  | 'decision_issued'
  | 'appeal_submitted'

/**
 * Every kind the DB `case_events_kind_check` allows. `CaseEvent.kind` is widened to
 * this in BE-5 — deferred here so BE-1 stays typecheck-clean: `EVENT_KIND_LABEL`
 * (frontend-owned, `case-extras-labels.ts`) is an exhaustive `Record<CaseEventKind,…>`
 * and the timeline indexes it with `ev.kind`, so the in-place widen must land in
 * lockstep with the frontend label growth (O-4). See the E3a design note.
 */
export type AnyCaseEventKind = CaseEventKind | ProceduralCaseEventKind

/**
 * Per-event visibility (E3a). `case_readers` (default) = today's behavior byte-for-
 * byte (every `can_read_case`-eligible reader sees it). `coordinator_only` is an
 * ADDITIONAL narrowing on top of `can_read_case` (an RLS AND-condition), NEVER a
 * widening — a respondent/recused reader is still denied by the `can_read_case` floor
 * regardless of visibility. Auto-derived deliberation-sensitive events (votes,
 * findings) are written `coordinator_only`; plain notes stay `case_readers`.
 */
export type CaseEventVisibility = 'case_readers' | 'coordinator_only'

/** A manual free-text case event (working note / minute of a decision). */
export interface CaseEvent {
  id: string
  caseId: string
  // NOTE: BE-5 widens this to `AnyCaseEventKind` (see the type doc above) once the
  // frontend `EVENT_KIND_LABEL` covers the procedural kinds (O-4).
  kind: CaseEventKind
  title: string | null
  /** Required free text. */
  body: string
  /**
   * Per-event visibility (E3a). Defaults to `case_readers` (today's behavior) until
   * the `case_events.visibility` column lands (BE-3) and BE-5 projects it.
   */
  visibility: CaseEventVisibility
  occurredAt: string | null
  /**
   * Optional wall-clock time companion to {@link occurredAt}, as `"HH:mm"`, or
   * `null` when none was recorded. Stored in the `time` column `occurred_time`
   * (Postgres returns `HH:mm:ss`); normalized to `HH:mm` here for the UI.
   */
  occurredTime: string | null
  createdBy: string | null
  /** Author's display name (joined); `null` if unresolved. */
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Row shapes (RLS-scoped table reads)
// ---------------------------------------------------------------------------

interface CaseEventRow {
  id: string
  case_id: string
  kind: CaseEventKind
  title: string | null
  body: string
  visibility: CaseEventVisibility
  occurred_at: string | null
  occurred_time: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  profiles: { full_name: string | null } | null
}

const SIGNED_URL_TTL_SECONDS = 3600

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * The case's NON-deleted documents, newest-first (by `occurredAt` then
 * `createdAt`), each with a signed download URL. RLS-scoped (members read);
 * returns `[]` when the caller may not read the case. Soft-deleted rows are
 * excluded here (the `deleted_at is null` filter; the Storage object survives).
 * Signed URLs are batch-minted (`createSignedUrls`) under the same RLS-scoped
 * cookie client, so a foreign caller gets neither rows nor URLs.
 */
export async function listCaseDocuments(
  caseId: string,
): Promise<CaseDocumentWithUrl[]> {
  // Phase F2: case documents are `attachments` (owner_type='case'). Delegate to the
  // tier-split reader and adapt to the CaseDocument shape (kind→docType,
  // occurredOn→occurredAt). PHI-tier rows carry signedUrl=null + containsPhi=true.
  const rows = await listAttachments('case', caseId)
  return rows.map((a) => ({
    id: a.id,
    caseId: a.ownerId,
    docType: a.kind as CaseDocumentType,
    title: a.title,
    description: a.description,
    storagePath: a.storagePath,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    occurredAt: a.occurredOn,
    uploadedBy: a.uploadedBy,
    uploadedByName: a.uploadedByName,
    createdAt: a.createdAt,
    signedUrl: a.signedUrl,
    attachmentId: a.id,
    containsPhi: a.containsPhi,
  }))
}

/**
 * A fresh short-lived signed download URL for a single STANDARD-tier document path
 * (Phase F2: the `attachments` bucket). Returns `null` for a PHI-tier path (the
 * `attachments-phi` bucket has no authenticated SELECT) — use the audited
 * `openAttachment(attachmentId)` door for those. Preserved for the per-row download
 * of standard-tier artifacts.
 */
export async function getCaseDocumentDownloadUrl(
  storagePath: string,
): Promise<string | null> {
  if (!storagePath) return null
  const supabase = await createClient()
  const { data } = await supabase.storage
    .from('attachments')
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)
  return data?.signedUrl ?? null
}

/**
 * The case's manual events, newest-first (by `occurredAt` then `createdAt`).
 * RLS-scoped (members read); returns `[]` when unreadable.
 */
export async function listCaseEvents(caseId: string): Promise<CaseEvent[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('case_events')
    .select(
      `
      id, case_id, kind, title, body, visibility, occurred_at, occurred_time, created_by,
      created_at, updated_at,
      profiles:created_by ( full_name )
    `,
    )
    .eq('case_id', caseId)
    .order('occurred_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .returns<CaseEventRow[]>()

  if (error || !data) return []

  return data.map((r) => ({
    id: r.id,
    caseId: r.case_id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    visibility: r.visibility,
    occurredAt: r.occurred_at,
    // Postgres `time` serializes as `HH:mm:ss`; the UI wants `HH:mm`.
    occurredTime: r.occurred_time ? r.occurred_time.slice(0, 5) : null,
    createdBy: r.created_by,
    createdByName: r.profiles?.full_name ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}
