import type {
  DocumentDetail,
  DocumentHomeResourceType,
  DocumentListItem,
} from '@/lib/documents/types'

/**
 * Document model — READ data-access (DM2·S2 contract-first stubs; Rule 9).
 *
 * ⚠ This path previously held the Phase-17 CONTROLLED-document queries — those
 * moved to `@/lib/queries/controlled-documents` (plan amendment 06ab1ae). This
 * module reads the CORE document model (ADR 0114).
 *
 * Signatures are the CONTRACT S3 builds against — keep stable. Bodies return
 * the truthful EMPTY state (zero documents exist and `documents_wave_a` is
 * OFF), so S3 can build and render empty states before the S2 implementations
 * land; the mutating actions, by contrast, THROW (`@/lib/documents/actions`).
 *
 * Projections only: raw storage buckets/paths never leave `src/lib/documents`
 * (the DM5 exit criterion); bytes move exclusively through the audited open
 * door's short-TTL signed URL.
 */

/** Documents homed on one resource, for the Wave-A panels. RLS-scoped: the
 * caller sees only documents the kernel (incl. the D15 ceiling) admits. */
export async function listDocumentsForResource(
  _resourceType: DocumentHomeResourceType,
  _resourceId: string,
): Promise<DocumentListItem[]> {
  return []
}

/** One document with its version history, or null when absent/not readable
 * (absence and denial are indistinguishable by design). */
export async function getDocument(_documentId: string): Promise<DocumentDetail | null> {
  return null
}
