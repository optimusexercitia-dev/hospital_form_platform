import type { DocumentActionErrorCode } from '@/lib/documents/types'

/**
 * SQLSTATE → contract error code (contract amendment 4). CODE ALONE, never
 * message text — the codes were minted distinct for exactly this map
 * (migrations 20260924000300/400; ADR 0118). Pure module (client-safe).
 */
export function mapDocumentErrorCode(sqlstate: string | null | undefined): DocumentActionErrorCode {
  switch (sqlstate) {
    case 'HC0D7':
      return 'module_disabled'
    case 'P0002':
      return 'not_found'
    case '42501':
      return 'forbidden'
    case 'HC0D6':
      return 'confidentiality_home_rejected'
    case 'HC0D3':
      return 'under_legal_hold'
    case 'HC0DE':
      return 'upload_expired'
    case 'HC0D9':
      return 'upload_incomplete'
    case 'HC0DF':
      return 'file_too_large'
    case 'HC0DG':
      return 'file_type_not_allowed'
    case '23514':
    case 'HC0DM':
      return 'invalid_input'
    case 'HC0D8':
      return 'unavailable'
    case 'HC0DD':
      return 'disposed'
    case 'HC0DR':
      return 'retention_blocked'
    default:
      return 'unknown'
  }
}
