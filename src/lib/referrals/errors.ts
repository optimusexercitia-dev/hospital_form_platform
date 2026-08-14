import type { DocumentActionErrorCode } from '@/lib/documents/types'
import type { ReferralDocumentErrorCode } from '@/lib/referrals/types'

/**
 * DM4 (ADR 0119) — SQLSTATE → `ReferralDocumentErrorCode`, CODE ALONE, never
 * message text (the DM2 `mapDocumentErrorCode` precedent). Pure module
 * (client-safe). The referral-specific codes:
 * - HC070 wrong referral state (also the target-acts window refusal)
 * - HC071 not the source coordinator · HC072 not the target coordinator
 * - HC077 invalid share shape / source document not in this case
 * - HC0DC enforcing confidentiality label refuses the freeze (ADR 0119 D4)
 * - HC0DS snapshot tombstoned/unbound (ADR 0119 D5)
 */
export function mapReferralDocumentError(
  sqlstate: string | null | undefined,
): ReferralDocumentErrorCode {
  switch (sqlstate) {
    case 'HC0D7':
      return 'module_disabled'
    case 'P0002':
    case 'PGRST116':
      return 'not_found'
    case '42501':
      return 'forbidden'
    case 'HC070':
      return 'referral_wrong_state'
    case 'HC071': // freeze: source-coordinator-only — forbidden to everyone else
      return 'forbidden'
    case 'HC072':
      return 'not_target_coordinator'
    case 'HC0DS':
      return 'snapshot_unavailable'
    case 'HC0DE':
      return 'upload_expired'
    case 'HC0D9':
      return 'upload_incomplete'
    case 'HC0DF':
      return 'file_too_large'
    case 'HC0DG':
      return 'file_type_not_allowed'
    case 'HC077':
    case 'HC0DC':
    case '23514':
      return 'invalid_input'
    case 'HC0D8':
      return 'unavailable'
    case 'HC0DD':
      return 'disposed'
    default:
      return 'unknown'
  }
}

/**
 * Narrow a document-module failure code to the referral union — the reply
 * corridor reuses the DM2 begin/finalize/open actions, whose codes carry the
 * same meanings; members absent from the referral union collapse to their
 * closest honest bucket.
 */
export function narrowDocumentError(code: DocumentActionErrorCode): ReferralDocumentErrorCode {
  switch (code) {
    case 'module_disabled':
    case 'not_found':
    case 'forbidden':
    case 'upload_expired':
    case 'upload_incomplete':
    case 'file_too_large':
    case 'file_type_not_allowed':
    case 'invalid_input':
    case 'unavailable':
    case 'disposed':
    case 'unknown':
      return code
    case 'confidentiality_home_rejected':
      return 'invalid_input'
    case 'under_legal_hold':
    case 'retention_blocked':
      return 'forbidden'
    default:
      return 'unknown'
  }
}
