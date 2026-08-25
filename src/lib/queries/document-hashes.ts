import { createClient } from '@/lib/supabase/server'

/**
 * Content hashes for documents, under the CALLER'S OWN SESSION (PDF·P3;
 * ADR 0144 D2's manifest line).
 *
 * ⛔ **NO NEW DOOR, NO `SECURITY DEFINER`, NO ACL CHANGE — and that is a
 * deliberate boundary, not an omission.** The hash was reported "unavailable"
 * because no existing READ QUERY surfaces it (`sha256Hex` lives only in the
 * write path, computed at finalize under the service role). But the DATA is
 * already reachable: measured on the live catalog 2026-08-25, every table on the
 * join path carries an `authenticated` SELECT grant plus an RLS SELECT policy —
 *
 *   documents               authenticated=r  + documents_select
 *   document_versions       authenticated=r  + document_versions_select
 *   document_version_files  authenticated=r  + document_version_files_select
 *   file_objects            authenticated=r  + file_objects_select
 *                                              → app.can_read_file_object(id, auth.uid())
 *
 * ⚠ "The data is reachable under the caller's session" and "a reader exists that
 * surfaces it" are DIFFERENT CLAIMS, and conflating them is what nearly removed
 * the hash from the manifest. This file closes the second gap without touching
 * the first.
 *
 * ⇒ A file the caller may not reach simply yields NO ROW, the hash is absent,
 * and the manifest renders "—". Fail-closed, through the shipped policy, with
 * nothing new to audit.
 *
 * ⭐ Why the hash matters enough to add a query for it: ADR 0144 D2's entire
 * argument for a manifest line INSTEAD of an embedded copy is that *"a manifest
 * line carrying a content hash is stronger evidence than a re-encoded copy"* —
 * it lets an accreditation tracer verify the artifact they were handed
 * separately. Without the hash the manifest is a filename list and D2's
 * rationale evaporates.
 */

interface HashRow {
  id: string
  document_versions: {
    document_version_files: {
      file_objects: { sha256: string | null } | null
    }[]
  }[]
}

/**
 * Map of `documents.id` → sha-256 hex of its latest bound file, for the ids the
 * caller can read. Ids the caller cannot reach are simply ABSENT from the map —
 * callers must treat absence as "no hash to print", never as an error.
 */
export async function listCaseDocumentHashes(
  documentIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (documentIds.length === 0) return out

  const supabase = await createClient()
  const { data } = await supabase
    .from('documents')
    .select(
      'id, document_versions(document_version_files(file_objects(sha256)))',
    )
    .in('id', documentIds)
    .overrideTypes<HashRow[]>()

  for (const row of data ?? []) {
    // The newest non-null hash across the document's versions. ⚠ Deliberately
    // tolerant: a version with no bound file, or a file whose hash has not been
    // written yet (the upload state machine sets `sha256` at the
    // `scan_pending` transition), contributes nothing rather than a null entry
    // the caller would have to distinguish from a missing id.
    const hash = row.document_versions
      .flatMap((v) => v.document_version_files)
      .map((f) => f.file_objects?.sha256 ?? null)
      .find((h): h is string => typeof h === 'string' && h.length > 0)
    if (hash) out.set(row.id, hash)
  }
  return out
}
