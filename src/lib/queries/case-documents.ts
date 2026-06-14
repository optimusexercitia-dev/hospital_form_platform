import { createClient } from '@/lib/supabase/server'

/**
 * Case DOCUMENTS & manual EVENTS data-access (Cases-Extras batch, R1).
 *
 * Two independent child entities of a case (Architecture Rule 9 — reads through
 * `src/lib/queries/`):
 *   - `case_documents` — file-backed artifacts (minutes/ata, scans, registries)
 *     in the private `case-documents` Storage bucket. Objects are NEVER
 *     overwritten (Rule 6); "delete" is a SOFT delete (the row is hidden, the
 *     object stays). Reads filter `deleted_at is null` and serve files via
 *     short-lived signed URLs.
 *   - `case_events` — manual free-text working notes (meeting/decision/note).
 *     Fully editable + hard-deletable (not immutable artifacts).
 *
 * RLS on both: member-read / staff_admin-write, commission resolved via the
 * existing `app.commission_of_case`. NO state-machine guard (not part of the
 * case workflow invariant). All user-facing strings are the caller's (pt-BR).
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
  /** Short-lived signed download URL (`createSignedUrl`); `null` if it failed. */
  signedUrl: string | null
}

// ---------------------------------------------------------------------------
// Events (manual free-text)
// ---------------------------------------------------------------------------

/** Manual event kinds (ASCII slugs; pt-BR labels in the UI). */
export type CaseEventKind = 'note' | 'meeting' | 'decision' | 'other'

/** A manual free-text case event (working note / minute of a decision). */
export interface CaseEvent {
  id: string
  caseId: string
  kind: CaseEventKind
  title: string | null
  /** Required free text. */
  body: string
  occurredAt: string | null
  createdBy: string | null
  /** Author's display name (joined); `null` if unresolved. */
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Row shapes (RLS-scoped table reads)
// ---------------------------------------------------------------------------

interface CaseDocumentRow {
  id: string
  case_id: string
  doc_type: CaseDocumentType
  title: string
  description: string | null
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  occurred_at: string | null
  uploaded_by: string | null
  created_at: string
  profiles: { full_name: string | null } | null
}

interface CaseEventRow {
  id: string
  case_id: string
  kind: CaseEventKind
  title: string | null
  body: string
  occurred_at: string | null
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
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('case_documents')
    .select(
      `
      id, case_id, doc_type, title, description, storage_path, mime_type,
      size_bytes, occurred_at, uploaded_by, created_at,
      profiles:uploaded_by ( full_name )
    `,
    )
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .returns<CaseDocumentRow[]>()

  if (error || !data) return []

  // Batch-mint signed URLs for all paths in one round trip.
  const paths = data.map((r) => r.storage_path)
  const signedByPath = new Map<string, string>()
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('case-documents')
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) signedByPath.set(s.path, s.signedUrl)
    }
  }

  return data.map((r) => ({
    id: r.id,
    caseId: r.case_id,
    docType: r.doc_type,
    title: r.title,
    description: r.description,
    storagePath: r.storage_path,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    occurredAt: r.occurred_at,
    uploadedBy: r.uploaded_by,
    uploadedByName: r.profiles?.full_name ?? null,
    createdAt: r.created_at,
    signedUrl: signedByPath.get(r.storage_path) ?? null,
  }))
}

/**
 * A fresh short-lived signed download URL for a single document path. RLS-scoped
 * (the case-documents bucket's member-read policy grants it only to members of
 * the object's commission, folder[1]), so a foreign caller gets `null`. Used by
 * the per-row "download" action when a deep link needs a just-in-time URL.
 */
export async function getCaseDocumentDownloadUrl(
  storagePath: string,
): Promise<string | null> {
  if (!storagePath) return null
  const supabase = await createClient()
  const { data } = await supabase.storage
    .from('case-documents')
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
      id, case_id, kind, title, body, occurred_at, created_by, created_at,
      updated_at,
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
    occurredAt: r.occurred_at,
    createdBy: r.created_by,
    createdByName: r.profiles?.full_name ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}
