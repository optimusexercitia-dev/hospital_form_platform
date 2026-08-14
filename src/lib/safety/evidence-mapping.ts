/**
 * DM5 S2 — the PURE error adapter between the core document model's vocabulary
 * and the NSP evidence contract.
 *
 * CLIENT-SAFE: type-only imports, no supabase client, no server import — the
 * `lint:client-server-imports` gate depends on that (BUG-FBE-005).
 *
 * Why a module and not two private helpers: both adapters are needed by FOUR
 * files (`safety/{rca,capa}-actions.ts` and `queries/{rca,capa}.ts`), and a
 * `"use server"` module may export only async functions, so neither actions
 * file can host them.
 */

import type { DocumentActionErrorCode } from '@/lib/documents/types'
import type { NspEvidenceErrorCode } from '@/lib/safety/evidence-contract'

/**
 * `DocumentActionErrorCode` → `NspEvidenceErrorCode`.
 *
 * Needed because three of the S2 commands reuse the DM2 command layer verbatim
 * (`finalizeDocumentUpload` / `openDocumentVersion`) rather than re-deriving the
 * D9 byte verifier and the signing block — one verifier, no drift. Those helpers
 * have already mapped the SQLSTATE **on code alone** (`mapDocumentErrorCode`),
 * so this is a second hop over a closed vocabulary, never over message text.
 *
 * ⚠ LOSSLESS for this path, and the reason is executable rather than asserted:
 * the ONLY member of `DocumentActionErrorCode` absent from
 * `NspEvidenceErrorCode` is `confidentiality_home_rejected` (HC0D6), which is
 * raised exclusively by the S1 confidentiality seam guard on
 * `begin_document_upload`. `finalize_document_upload` and
 * `open_document_version` contain no confidentiality logic at all (catalog-read:
 * their bodies never touch `confidentiality_level`; the D15 ceiling lives inside
 * `app.can_read_document`, whose refusal surfaces as P0002 → `not_found`), and
 * the S2 begin path never passes `p_confidentiality_level`. If that ever
 * changes, HC0D6 must get its own contract code — it must NOT keep landing on
 * `invalid_input`.
 *
 * The switch is deliberately TOTAL (no `default`): widening
 * `DocumentActionErrorCode` must break this build rather than silently degrade
 * a new failure to `unknown`.
 */
export function narrowDocumentEvidenceError(
  code: DocumentActionErrorCode,
): NspEvidenceErrorCode {
  switch (code) {
    case 'module_disabled':
      return 'module_disabled'
    case 'not_found':
      return 'not_found'
    case 'forbidden':
      return 'forbidden'
    case 'under_legal_hold':
      return 'under_legal_hold'
    case 'upload_expired':
      return 'upload_expired'
    case 'upload_incomplete':
      return 'upload_incomplete'
    case 'file_too_large':
      return 'file_too_large'
    case 'file_type_not_allowed':
      return 'file_type_not_allowed'
    case 'invalid_input':
      return 'invalid_input'
    case 'unavailable':
      return 'unavailable'
    case 'disposed':
      return 'disposed'
    case 'retention_blocked':
      return 'retention_blocked'
    case 'confidentiality_home_rejected':
      // Unreachable from the S2 corridor (see the header) — kept explicit so
      // the total switch compiles, and mapped to the nearest honest code
      // rather than to `unknown`, which would read as "we have no idea".
      return 'invalid_input'
    case 'unknown':
      return 'unknown'
  }
}

