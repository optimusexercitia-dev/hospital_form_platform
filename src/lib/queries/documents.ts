import { createClient } from '@/lib/supabase/server'
import type {
  DocumentAvailability,
  DocumentConfidentialityLevel,
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
  document_legal_holds ( id, released_at ),
  printed_documents!printed_documents_document_fk ( id )
` as const

/**
 * ADR 0120 D18 — printed renditions are EXCLUDED from the content projections.
 *
 * D13 gives every print event its own `documents` row homed on the SOURCE's
 * securable resource, so without this filter a generated PDF would appear in
 * every case's and meeting's *Documentos* panel beside uploaded files.
 * *Documentos* keeps meaning "documents people put here"; prints stay reachable
 * through their own surface (`listPrintedDocuments` → `/api/documents/[id]`,
 * gated by `open_printed_document`).
 *
 * ⚠⚠ D18 IS PRESENTATION, NOT AN ACCESS CONTROL (Architecture Rule 1: never
 * rely on UI hiding). This filter must NEVER be cited as having narrowed
 * anyone's access. What governs a print's BYTES is the D12 conjunction inside
 * `open_printed_document`; what governs its metadata is the print arm in
 * `app.can_read_document` (migration 20260927000320), which routes a print's
 * authority to `app.can_view_printed_document` regardless of its home type —
 * precisely so that hiding the row is not load-bearing.
 *
 * ⭐ THE DISCRIMINATOR IS RELATIONAL, NOT `documents.kind`. `kind` is unchecked
 * text (0 CHECK constraints) and the two string-based directions fail
 * oppositely: `kind <> 'printed_rendition'` lets a print with a NULL or
 * misspelled kind through (fails OPEN — unacceptable), while an allowlist of
 * content kinds hides ordinary documents with an unexpected kind (fails closed,
 * but that is an availability regression). A print is instead *"a `documents`
 * row referenced by `printed_documents`"* — `printed_documents.document_id` is
 * NOT NULL + UNIQUE, so the discriminator cannot be typo'd, cannot be NULL by
 * accident and cannot drift.
 *
 * The filter is applied by PostgREST server-side, not in JS. Verified against
 * the live stack in both directions before being relied on: an embed-is-null
 * filter kept 3 of 3 rows when the embed was empty and dropped 3 of 3 when it
 * was populated — a probe that had to move in opposite directions, and did.
 * The FK is `isOneToOne: true` in the generated types, so the embed is scalar.
 *
 * ⚠ If the embed is ever removed from LIST_SELECT this filter errors loudly
 * rather than silently passing everything.
 */
const EXCLUDE_PRINTED_RENDITIONS = 'printed_documents' as const

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
  /** ADR 0120 D18 discriminator — non-null iff this row IS a printed rendition.
   * In the projection only so PostgREST can filter on it SERVER-side; never read
   * in JS, because a JS-side check would be the weaker half of the filter. */
  printed_documents: { id: string } | null
}

const SERVABLE = new Set(['clean', 'unscanned_accepted'])
const FAILED = new Set(['failed', 'rejected', 'infected', 'abandoned'])

/**
 * The ONE availability predicate, shared by Wave A and Wave B
 * (`src/lib/queries/controlled-documents.ts`) so the two projections cannot
 * drift from each other — or, more importantly, from the door.
 *
 * ⚠ THIS MUST AGREE WITH `open_document_version` EXACTLY. `available` means
 * "the door would serve these bytes right now": a `source` rendition is bound,
 * its file object is `clean`/`unscanned_accepted`, nothing is disposed, and the
 * document is `active`. Anything the door would refuse must NOT read as
 * `available` here, and anything it would serve must not read as `pending` —
 * the UI gates its submit/download affordances on this value, so a disagreement
 * is a broken affordance in one direction and a false promise in the other.
 * Pinned by pgTAP 330 DM3·X3 (projection ↔ door agreement).
 */
export function documentVersionAvailability(input: {
  documentStatus: string
  /** `file_objects.upload_state` of the bound `source` rendition; `null` when unbound. */
  sourceUploadState: string | null
  /** `file_objects.disposal_state` of that same rendition; `null` when unbound. */
  sourceDisposalState: string | null
}): DocumentAvailability {
  const { documentStatus, sourceUploadState, sourceDisposalState } = input
  if (documentStatus === 'disposal_pending' || documentStatus === 'disposed') return 'disposed'
  if (sourceUploadState === null) return 'pending'
  if (sourceDisposalState !== 'none') return 'disposed'
  if (SERVABLE.has(sourceUploadState)) {
    return documentStatus === 'active' ? 'available' : 'unavailable'
  }
  if (FAILED.has(sourceUploadState)) return 'failed'
  return 'pending'
}

function versionAvailability(v: VersionRow, docStatus: string): DocumentAvailability {
  const source = v.document_version_files.find((b) => b.rendition_kind === 'source')
  const file = source?.file_objects
  return documentVersionAvailability({
    documentStatus: docStatus,
    sourceUploadState: file?.upload_state ?? null,
    sourceDisposalState: file?.disposal_state ?? null,
  })
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
    // ADR 0120 D18 — presentation, never a boundary. See EXCLUDE_PRINTED_RENDITIONS.
    .is(EXCLUDE_PRINTED_RENDITIONS, null)
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

// FUP-DM5-DEAD-CORE-PROJECTION — a `getDocument` used to live here (the Wave-A
// core `documents` projection). DELETED 2026-08-17: it had ZERO importers, while
// a same-named export in `@/lib/queries/controlled-documents` is the one all five
// detail routes actually import (measured at every import site, not by grepping
// the symbol — a grep for the name returns hits and *looks* answered; only the
// import site discriminates).
//
// ⭐ It had already cost something. ADR 0120 D18's "exclude prints from the detail
// projection too" was implemented HERE, on the unreachable copy. Harmless — the
// reachable projection selects `from('controlled_documents')` and a print has no
// row there, so prints are excluded STRUCTURALLY, by the schema — but the ruling
// bought nothing, and the record briefly implied the detail path was protected by
// a filter when it is protected by the shape of the data.
//
// Deleted rather than kept-and-documented: keeping it preserves the trap (the next
// reader has the same 50/50 chance of editing the wrong one), and nothing named a
// route that would mount it. If a core-documents detail route is ever needed, write
// it then against that route's real requirements — including its own D18 decision.
//
// Swept while here, per the item: `getDocument` was the ONLY duplicated export name
// across `src/lib/queries/*.ts`.
