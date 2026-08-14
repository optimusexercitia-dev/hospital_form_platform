/**
 * DM5 S2 — the projection half shared by the two NSP evidence lists
 * (`listRcaEvidenceViews` / `listCapaActionEvidenceViews`).
 *
 * Server module (it reuses the document model's availability predicate). It
 * exists so the two lists cannot drift from each other or from the door: the
 * embed shape, the "latest version → `source` rendition" walk and the
 * `availability`/`canOpen` derivation are written ONCE.
 *
 * ⚠ Nothing here signs anything. The retired projections minted
 * `createSignedUrl(storage_path, 3600)` per `document` row at list time on the
 * private `nsp-evidence` bucket, unaudited — 12x the PO-ruled standard window
 * and 30x the PHI one (ADR 0114 O4). Bytes now resolve ONE AT A TIME through
 * `open{Rca,Capa}Evidence` → `open_document_version`, the audited door. If a
 * `createSignedUrl` ever appears in this file, that hole is back.
 */

import { nspEvidenceAvailability } from '@/lib/safety/evidence-contract'
import type { NspEvidenceAvailability } from '@/lib/safety/evidence-contract'

/**
 * The availability inputs embedded from the backing core document. The FK hint
 * on the `documents` relation is the CALLER's job (`rca_evidence` carries two
 * foreign keys to `documents` — `document_id` and the un-parked
 * `cited_document_id` — so an un-hinted embed is a PGRST201 ambiguity there,
 * not a style choice); this is the tail both callers share.
 */
export const EVIDENCE_DOCUMENT_EMBED_BODY =
  '( status, document_versions ( version_number, ' +
  'document_version_files ( rendition_kind, file_objects ( upload_state, disposal_state ) ) ) )'

export interface EvidenceDocumentEmbed {
  status: string
  document_versions: Array<{
    version_number: number
    document_version_files: Array<{
      rendition_kind: string
      file_objects: { upload_state: string; disposal_state: string } | null
    }>
  }>
}

/**
 * `availability` + `canOpen` for one evidence row; `{ null, false }` for a row
 * with no backing document (`link` / `citation`).
 *
 * Derived from `documentVersionAvailability` — the ONE predicate pinned to
 * agree with `open_document_version` (pgTAP 330 DM3·X3) — never re-derived
 * here, then collapsed onto the contract's four members by
 * {@link nspEvidenceAvailability}.
 *
 * `canOpen` is TRUE only for `available`: it is the server-computed affordance
 * and the door is what decides, so a bytes-less row is never openable.
 */
export function evidenceAvailability(doc: EvidenceDocumentEmbed | null): {
  availability: NspEvidenceAvailability | null
  canOpen: boolean
} {
  if (!doc) return { availability: null, canOpen: false }
  const latest = [...doc.document_versions].sort((a, b) => b.version_number - a.version_number)[0]
  const file = latest?.document_version_files.find((b) => b.rendition_kind === 'source')
    ?.file_objects
  // ONE hop, over the raw state machine, through the pure contract function.
  const availability = nspEvidenceAvailability({
    uploadState: file?.upload_state ?? null,
    disposalState: file?.disposal_state ?? null,
    documentStatus: doc.status,
  })
  return { availability, canOpen: availability === 'available' }
}
