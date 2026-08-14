/**
 * The TS half of a printed rendition's storage coordinate (DM5 S3; ADR 0120
 * D7/D11). The SQL half is `app.printed_rendition_storage_path` /
 * `app.printed_rendition_storage_bucket`, and those two are the authority.
 *
 * ⭐ WHY A SECOND DERIVATION EXISTS AT ALL, AND WHY IT IS SAFE.
 * The mint is ALL-OR-NOTHING (ADR 0104 D5): the bytes are uploaded BEFORE the
 * registry RPC, so the uploader has to know the coordinate before the door can
 * tell it one. That is the only reason this file exists — the door itself takes
 * no path parameter, so the coordinate is never caller-CHOSEN, only
 * caller-RECOMPUTED.
 *
 * ⭐ AND THE TWO DERIVATIONS ARE PINNED TO EACH OTHER BY A RUNTIME EQUALITY, not
 * by a pair of tests. `mint_printed_document` refuses `HC0D3` unless an object
 * exists at exactly the coordinate IT derives. Because `id` is a fresh uuid
 * minted here and uploaded with `upsert: false` before the RPC, nothing else can
 * occupy that coordinate — therefore **HC0D3 fires if and only if this file
 * disagrees with the SQL authority**. One equality, evaluated on the production
 * path, on every single mint.
 *   Two independent assertions about two independent constants would have said
 *   nothing about their equality, which is exactly why the retired CHECK
 *   `pd_storage_path_derived` was replaced by this equality plus the
 *   `trg_guard_printed_document_binding` trigger, and not by "a pgTAP test and a
 *   vitest test".
 *
 * ⚠ Keep these two functions total and branch-free-ish. The path deliberately
 * has NO tier branch: the phi/standard split is carried by the BUCKET, which
 * `file_objects_bucket_from_tier` CHECK-pins to `file_objects.sensitivity_tier`.
 * That is a constraint-enforced physical boundary, where the old `phi/`|`std/`
 * prefix was a naming convention.
 */

/** The bucket a print's bytes live in. PHI prints go to the PHI-tier bucket. */
export function printedRenditionStorageBucket(
  containsPhi: boolean,
): 'documents-phi' | 'documents-standard' {
  return containsPhi ? 'documents-phi' : 'documents-standard'
}

/** The object key of a print's bytes, derived from the registry id alone. */
export function printedRenditionStoragePath(printedDocumentId: string): string {
  return `printed/${printedDocumentId}.pdf`
}
