import { createClient } from '@/lib/supabase/server'
import type {
  DocumentAvailability,
  DocumentConfidentialityLevel,
  DocumentDetail,
  DocumentHomeResourceType,
  DocumentListItem,
  DocumentStatus,
  DocumentVersionSummary,
} from '@/lib/documents/types'

/**
 * Document model — READ data-access (DM2·S2; Rule 9).
 *
 * ⚠ This path previously held the Phase-17 CONTROLLED-document queries — those
 * moved to `@/lib/queries/controlled-documents`. This module reads the CORE
 * document model (ADR 0114).
 *
 * RLS is the authority on every row here: `documents_select` routes the
 * kernel (incl. the D15 ceiling), the version/file rows route the chain
 * doors, and `document_legal_holds` its own narrower audience. `canOpen`
 * therefore needs NO door call — a version row being VISIBLE at all already
 * proves the kernel admitted the caller; availability alone decides.
 *
 * Contract guarantees: `createdAt` DESC; excludes `soft_deleted`; disposal
 * states remain listed (redacted titles — the D12 governance record).
 * `underLegalHold`: `true` when a live hold row is visible to the caller;
 * `null` otherwise (no hold, or not entitled — RLS makes the two
 * indistinguishable here; flagged in the S2 record).
 */

const LIST_SELECT = `
  id, home_resource_id, title, description, kind, occurred_on, status,
  confidentiality_level, created_by, created_at,
  securable_resources!documents_home_resource_id_fkey ( resource_type ),
  profiles!documents_created_by_fkey ( full_name ),
  document_versions (
    id, version_number, created_at,
    profiles!document_versions_created_by_fkey ( full_name ),
    document_version_files (
      rendition_kind,
      file_objects ( sensitivity_tier, upload_state, disposal_state )
    )
  ),
  document_legal_holds ( id, released_at )
` as const

type VersionRow = {
  id: string
  version_number: number
  created_at: string
  profiles: { full_name: string | null } | null
  document_version_files: Array<{
    rendition_kind: string
    file_objects: {
      sensitivity_tier: string
      upload_state: string
      disposal_state: string
    } | null
  }>
}

type DocumentRow = {
  id: string
  home_resource_id: string
  title: string
  description: string | null
  kind: string | null
  occurred_on: string | null
  status: string
  confidentiality_level: string | null
  created_by: string
  created_at: string
  securable_resources: { resource_type: string } | null
  profiles: { full_name: string | null } | null
  document_versions: VersionRow[]
  document_legal_holds: Array<{ id: string; released_at: string | null }>
}

const SERVABLE = new Set(['clean', 'unscanned_accepted'])
const FAILED = new Set(['failed', 'rejected', 'infected', 'abandoned'])

function versionAvailability(v: VersionRow, docStatus: string): DocumentAvailability {
  if (docStatus === 'disposal_pending' || docStatus === 'disposed') return 'disposed'
  const source = v.document_version_files.find((b) => b.rendition_kind === 'source')
  const file = source?.file_objects
  if (!file) return 'pending'
  if (file.disposal_state !== 'none') return 'disposed'
  if (SERVABLE.has(file.upload_state)) {
    return docStatus === 'active' ? 'available' : 'unavailable'
  }
  if (FAILED.has(file.upload_state)) return 'failed'
  return 'pending'
}

function toVersionSummary(v: VersionRow, docStatus: string): DocumentVersionSummary {
  const availability = versionAvailability(v, docStatus)
  return {
    id: v.id,
    versionNumber: v.version_number,
    availability,
    // Row visibility IS the kernel (incl. the D15 ceiling) — no door call.
    canOpen: availability === 'available',
    createdAt: v.created_at,
    createdByName: v.profiles?.full_name ?? null,
  }
}

function toListItem(row: DocumentRow, canDelete: boolean): DocumentListItem {
  const versions = [...row.document_versions].sort((a, b) => b.version_number - a.version_number)
  const latest = versions[0]
  const latestSummary = latest ? toVersionSummary(latest, row.status) : null
  const latestFile = latest?.document_version_files.find((b) => b.rendition_kind === 'source')
    ?.file_objects
  const homeType = (row.securable_resources?.resource_type ?? 'case') as DocumentHomeResourceType
  const liveHold = row.document_legal_holds.some((h) => h.released_at === null)
  return {
    id: row.id,
    homeResourceType: homeType,
    homeResourceId: row.home_resource_id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    occurredAt: row.occurred_on,
    status: row.status as DocumentStatus,
    confidentialityLevel: row.confidentiality_level as DocumentConfidentialityLevel | null,
    // File tier when known; else the home rule (case/interview → phi bucket).
    containsPhi: latestFile
      ? latestFile.sensitivity_tier === 'phi'
      : homeType === 'case' || homeType === 'interview',
    latestVersion: latestSummary,
    canDelete,
    underLegalHold: liveHold ? true : null,
    createdBy: row.created_by,
    createdByName: row.profiles?.full_name ?? null,
    createdAt: row.created_at,
  }
}

/** One batched call to the server-computed delete-affordance door (the
 * canOpen principle: never derived UI-side; holds accounted WITHOUT
 * disclosure). Fail-closed: an error yields no affordances. */
async function deleteAffordances(
  supabase: Awaited<ReturnType<typeof createClient>>,
  documentIds: string[],
): Promise<Map<string, boolean>> {
  if (documentIds.length === 0) return new Map()
  const { data, error } = await supabase.rpc('document_delete_affordances', {
    p_document_ids: documentIds,
  })
  if (error || !data) return new Map()
  return new Map(
    (data as Array<{ document_id: string; can_delete: boolean }>).map((r) => [
      r.document_id,
      r.can_delete,
    ]),
  )
}

/** Documents homed on one resource, for the Wave-A panels. */
export async function listDocumentsForResource(
  resourceType: DocumentHomeResourceType,
  resourceId: string,
): Promise<DocumentListItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documents')
    .select(LIST_SELECT)
    .eq('home_resource_id', resourceId)
    .neq('status', 'soft_deleted')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  const rows = (data as unknown as DocumentRow[]).filter(
    (row) => (row.securable_resources?.resource_type ?? resourceType) === resourceType,
  )
  const affordances = await deleteAffordances(
    supabase,
    rows.map((r) => r.id),
  )
  return rows.map((row) => toListItem(row, affordances.get(row.id) ?? false))
}

/** One document with its version history (versionNumber DESC), or null when
 * absent/not readable (absence and denial are indistinguishable by design). */
export async function getDocument(documentId: string): Promise<DocumentDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documents')
    .select(LIST_SELECT)
    .eq('id', documentId)
    .maybeSingle()
  if (error || !data) return null
  const row = data as unknown as DocumentRow
  const affordances = await deleteAffordances(supabase, [row.id])
  const item = toListItem(row, affordances.get(row.id) ?? false)
  const versions = [...row.document_versions]
    .sort((a, b) => b.version_number - a.version_number)
    .map((v) => toVersionSummary(v, row.status))
  return { ...item, versions }
}
