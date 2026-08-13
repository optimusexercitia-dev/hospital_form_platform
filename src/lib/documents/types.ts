/**
 * Document model — SHARED CONTRACT TYPES (DM2·S2 contract-first stubs).
 *
 * Pure, client-safe module (no server imports): the server actions
 * (`@/lib/documents/actions`) and queries (`@/lib/queries/documents`) import
 * their types FROM here, and client components may import it directly.
 *
 * ⚠ This path previously held the Phase-17 CONTROLLED-document module — that
 * moved to `@/lib/controlled-documents` (plan amendment 06ab1ae). This module
 * is the CORE document model (ADR 0114): documents / document_versions /
 * document_version_files / file_objects over `securable_resources` homes.
 *
 * Trust boundary, visible in the types (ADR 0114 D8/D9):
 * - Storage bucket, path, sensitivity tier, and content hash are SERVER-DERIVED
 *   and never appear as inputs. `declared*` fields are hints for validation
 *   caps only; finalize re-derives and verifies them server-side.
 * - Projections carry NO raw storage coordinates. Bytes move only through
 *   short-TTL signed credentials minted by the audited open door.
 * - Union vocabularies mirror the live CHECK constraints (catalog-read
 *   2026-08-13); the DATABASE is the authority, these are projections.
 */

/** The four Wave-A home resource types (`securable_resources.resource_type`). */
export type DocumentHomeResourceType = 'case' | 'meeting' | 'interview' | 'action_item'

/** Physical sensitivity tier (`file_objects.sensitivity_tier`). SERVER-derived
 * from the home resource + module rules — never a caller input. */
export type DocumentSensitivityTier = 'standard' | 'phi'

/** The platform's single 7-value confidentiality vocabulary (ADR 0072 D1). */
export type DocumentConfidentialityLevel =
  | 'non_phi_internal'
  | 'phi_standard'
  | 'phi_restricted'
  | 'peer_review_confidential'
  | 'legal_privileged'
  | 'ethics_investigation'
  | 'credentialing_sensitive'

/**
 * The two ENFORCING labels (D15 ceiling — gate ABOVE home-resource read).
 * DISPLAY/affordance aid only: the DB (kernel arm + HC0D6 seam guard) is the
 * authority. ⚠ Never reorder or "complete" this list from the display order —
 * the E1 CONFIDENTIALITY_ORDER scar.
 */
export const ENFORCING_CONFIDENTIALITY_LEVELS: readonly DocumentConfidentialityLevel[] = [
  'legal_privileged',
  'credentialing_sensitive',
]

/** `documents.status` (CHECK-mirrored). */
export type DocumentStatus = 'active' | 'soft_deleted' | 'disposal_pending' | 'disposed'

/**
 * The UI-facing availability projection of a version's underlying upload /
 * scan / disposal state (D9/D10). A real union, not optional booleans —
 * S3 renders each member in pt-BR:
 * - `available`   — servable (`clean` / `unscanned_accepted`, not disposed).
 * - `pending`     — upload/verification/scan still in flight.
 * - `failed`      — upload failed / rejected / infected / abandoned.
 * - `unavailable` — exists but not servable to this caller right now
 *                   (e.g. soft-deleted document).
 * - `disposed`    — disposition requested or completed; never servable again.
 */
export type DocumentAvailability =
  | 'available'
  | 'pending'
  | 'failed'
  | 'unavailable'
  | 'disposed'

/** Disposition reason category (`file_objects.disposal_reason_category`). */
export type DocumentDispositionReason =
  | 'retention_expired'
  | 'subject_request'
  | 'entered_in_error'
  | 'duplicate'
  | 'other'

/** Legal-hold reason category (`document_legal_holds.reason_category`). */
export type DocumentHoldReason =
  | 'litigation'
  | 'regulatory'
  | 'audit'
  | 'investigation'
  | 'other'

// ---------------------------------------------------------------------------
// Projections (reads)
// ---------------------------------------------------------------------------

/** One version of a document, as the UI may know it. No storage coordinates. */
export interface DocumentVersionSummary {
  id: string
  versionNumber: number
  availability: DocumentAvailability
  /** Server-computed: the audited open door would serve this version to the
   * current caller (home access + D15 ceiling + servable state). */
  canOpen: boolean
  createdAt: string
  createdByName: string | null
}

/** A document row for the Wave-A panels. */
export interface DocumentListItem {
  id: string
  homeResourceType: DocumentHomeResourceType
  homeResourceId: string
  title: string
  description: string | null
  kind: string | null
  status: DocumentStatus
  confidentialityLevel: DocumentConfidentialityLevel | null
  /** Tier projection: the bytes live in the PHI bucket. */
  containsPhi: boolean
  latestVersion: DocumentVersionSummary | null
  createdBy: string
  createdByName: string | null
  createdAt: string
}

/** Detail view: the list item plus its version history. */
export interface DocumentDetail extends DocumentListItem {
  versions: DocumentVersionSummary[]
  /** `null` = the caller is not entitled to hold visibility (hold existence is
   * write-authority governance metadata — `can_read_document_hold`); a boolean
   * only for entitled readers. */
  underLegalHold: boolean | null
}

// ---------------------------------------------------------------------------
// Command inputs / results (actions)
// ---------------------------------------------------------------------------

/** Input to `beginDocumentUpload`. Note the ABSENT fields — bucket, path,
 * tier, hash — all server-derived (D8/D9). */
export interface BeginDocumentUploadInput {
  homeResourceType: DocumentHomeResourceType
  homeResourceId: string
  /** Contractually non-PHI (ADR 0114 D12) — the UI shows the naming guidance. */
  title: string
  description?: string
  /** Omitted/undefined = unclassified (non-enforcing). Enforcing labels are
   * legal only on case / interview homes — the DB refuses others (HC0D6);
   * the UI must not offer them elsewhere. */
  confidentialityLevel?: DocumentConfidentialityLevel
  /** HINTS for validation caps only; finalize re-derives server-side (D9). */
  declaredFileName: string
  declaredMimeType: string
  declaredSizeBytes: number
}

export type BeginDocumentUploadResult =
  | {
      ok: true
      uploadSessionId: string
      /** Short-TTL signed upload credential: the client PUTs the file bytes to
       * this URL directly. Opaque — carries no reusable path authority. */
      uploadUrl: string
      expiresAt: string
    }
  | { ok: false; error: string }

export type FinalizeDocumentUploadResult =
  | {
      ok: true
      documentId: string
      documentVersionId: string
      availability: DocumentAvailability
    }
  | { ok: false; error: string }

export type OpenDocumentVersionResult =
  | {
      ok: true
      /** Short-TTL signed download URL (the ONLY byte corridor — D8). */
      url: string
      expiresAt: string
      fileName: string | null
    }
  | { ok: false; error: string }

/** Generic mutation result for the remaining commands. */
export type DocumentActionState = { ok: true } | { ok: false; error: string }
