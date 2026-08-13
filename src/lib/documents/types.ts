/**
 * Document model — SHARED CONTRACT TYPES (DM2·S2; amended per the frontend
 * contract review 2026-08-13, lead-routed — items 1–10).
 *
 * Pure, client-safe module (no server imports): the server actions
 * (`@/lib/documents/actions`), queries (`@/lib/queries/documents`) and client
 * islands import their types FROM here.
 *
 * ⚠ This path previously held the Phase-17 CONTROLLED-document module — that
 * moved to `@/lib/controlled-documents` (plan amendment 06ab1ae). This module
 * is the CORE document model (ADR 0114).
 *
 * Trust boundary, visible in the types (ADR 0114 D8/D9):
 * - Storage bucket, path, sensitivity tier, and content hash are SERVER-DERIVED
 *   and never appear as inputs. `declared*` fields are hints for validation
 *   caps only; finalize re-derives and verifies server-side.
 * - Projections carry NO raw storage coordinates. Bytes move only through
 *   short-TTL signed credentials minted by the audited open door.
 * - Union vocabularies mirror the live DB (catalog-read 2026-08-13); the
 *   DATABASE is the authority, these are projections.
 */

/** The four Wave-A home resource types (`securable_resources.resource_type`). */
export type DocumentHomeResourceType = 'case' | 'meeting' | 'interview' | 'action_item'

/** Physical sensitivity tier (`file_objects.sensitivity_tier`). SERVER-derived
 * from the home resource (case/interview → phi; meeting/action_item →
 * standard) — never a caller input. */
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

/**
 * The homes on which an ENFORCING label is representable (the S1 seam:
 * clearance is case-scoped, so only homes that resolve to a case). DISPLAY
 * aid — the DB guard (HC0D6) is the authority; the picker must not offer
 * enforcing labels on other homes.
 */
export const ENFORCING_LABEL_HOMES: readonly DocumentHomeResourceType[] = ['case', 'interview']

/**
 * Per-home `kind` vocabulary — the F2 sets, preserved for badge/picker
 * continuity. ⚠ The DB stores `documents.kind` as UNCHECKED text (no CHECK,
 * deliberately — this closed list is product surface, one source here for
 * both the picker and the badge). Keys are stored values; pt-BR labels live
 * in the UI layer.
 */
export const DOCUMENT_KINDS: Record<DocumentHomeResourceType, readonly string[]> = {
  case: ['ata', 'digitalizacao', 'registro', 'other'],
  meeting: ['pauta', 'apresentacao', 'literatura', 'lista_presenca', 'ata_assinada', 'outro'],
  interview: ['gravacao_audio', 'transcricao_assinada', 'evidencia', 'outro'],
  action_item: ['evidencia', 'outro'],
}

/**
 * Upload caps — mirror `storage.buckets` for `documents-standard` /
 * `documents-phi` (catalog-read 2026-08-13; both buckets identical). The DB
 * is the authority; these exist so the dialog can refuse before the wait.
 */
export const DOCUMENT_MAX_SIZE_BYTES = 26214400 // 25 MiB
export const DOCUMENT_ACCEPTED_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
]

/** `documents.status` (CHECK-mirrored). */
export type DocumentStatus = 'active' | 'soft_deleted' | 'disposal_pending' | 'disposed'

/**
 * The UI-facing availability projection of a version's underlying upload /
 * scan / disposal state (D9/D10). A real union — S3 renders each member in
 * pt-BR:
 * - `available`   — servable (`clean` / `unscanned_accepted`, not disposed).
 * - `pending`     — upload/verification in flight. A version with no visible
 *                   file binding reads as `pending` for everyone but the
 *                   uploader (whose in-flight dialog knows more from the
 *                   action results it holds).
 * - `failed`      — upload failed / rejected / infected / abandoned.
 * - `unavailable` — exists but not servable right now (e.g. soft-deleted
 *                   document).
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

/**
 * Machine-readable command failure codes (contract amendment 4). The UI owns
 * the pt-BR wording; the module maps SQLSTATEs to these codes ON CODE ALONE
 * (never message text). Raw Postgres/Supabase messages never reach the UI
 * (Rule 10).
 */
export type DocumentActionErrorCode =
  | 'module_disabled' // the documents flag is off
  | 'not_found' // absence ≡ denial, deliberately indistinguishable
  | 'forbidden' // authenticated but not authorized for this command
  | 'confidentiality_home_rejected' // enforcing label on a home with no clearance plane (HC0D6)
  | 'under_legal_hold' // disposal/soft-delete blocked by an unreleased hold
  | 'upload_expired' // the reservation lapsed; begin again
  | 'upload_incomplete' // no verified object behind the session; retry the PUT
  | 'file_too_large'
  | 'file_type_not_allowed'
  | 'invalid_input' // vocabulary/validation refusals
  | 'unavailable' // open door: the version is not servable right now
  | 'disposed' // open door: disposition requested or completed
  | 'retention_blocked' // disposal refused under an unratified retention policy
  | 'unknown'

// ---------------------------------------------------------------------------
// Projections (reads)
// ---------------------------------------------------------------------------

/** One version of a document, as the UI may know it. No storage coordinates. */
export interface DocumentVersionSummary {
  id: string
  versionNumber: number
  availability: DocumentAvailability
  /**
   * Server-computed: the audited open door would serve this version to the
   * current caller (home access + the D15 ceiling + servable state). KEEP
   * server-computed — this is what makes the ceiling observable in E2E as a
   * consequence of the contract (AC-9), never a UI rule.
   */
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
  /** One of DOCUMENT_KINDS[homeResourceType] by product convention (DB stores
   * unchecked text). */
  kind: string | null
  /** The document's real-world date (distinct from upload time). */
  occurredAt: string | null
  status: DocumentStatus
  confidentialityLevel: DocumentConfidentialityLevel | null
  /** Tier projection: the bytes live in the PHI bucket. Carries no path. */
  containsPhi: boolean
  /**
   * `null` = the document has no versions at all — NOT reachable through the
   * Wave-A upload flow (begin always mints version 1); render as an empty
   * pending-free row if it ever appears.
   */
  latestVersion: DocumentVersionSummary | null
  /**
   * Server-computed delete/dispose affordance (the `canOpen` principle, lead
   * route 2026-08-13): write authority AND no live hold — computed by the
   * batched `document_delete_affordances` door, so holds are accounted for
   * WITHOUT disclosing their existence to non-entitled writers. Disable the
   * affordance on `false`; never derive this UI-side from session context.
   */
  canDelete: boolean
  /**
   * Entitled-reader governance DISPLAY only (never an affordance input —
   * that is `canDelete`): `true` = a live hold row is visible to the caller;
   * `null` = no hold visible, which RLS makes indistinguishable between
   * "none exists" and "not entitled to hold visibility". `false` is
   * deliberately not a member — it was unreachable.
   */
  underLegalHold: true | null
  createdBy: string
  createdByName: string | null
  createdAt: string
}

/** Detail view: the list item plus its version history (versionNumber DESC). */
export interface DocumentDetail extends DocumentListItem {
  versions: DocumentVersionSummary[]
}

// ---------------------------------------------------------------------------
// Command inputs / results (actions)
// ---------------------------------------------------------------------------

/** Input to `beginDocumentUpload`. Note the ABSENT fields — bucket, path,
 * tier, hash — all server-derived (D8/D9). */
export interface BeginDocumentUploadInput {
  homeResourceType: DocumentHomeResourceType
  homeResourceId: string
  /** Omitted = a NEW document; set = upload the next version of an existing
   * document (its home must match). */
  documentId?: string
  /** Contractually non-PHI (ADR 0114 D12) — the UI shows the naming guidance. */
  title: string
  description?: string
  /** One of DOCUMENT_KINDS[homeResourceType] (product convention). */
  kind?: string
  /** The document's real-world date, ISO `yyyy-mm-dd`. */
  occurredOn?: string
  /** Omitted/undefined = unclassified (non-enforcing). Enforcing labels are
   * legal only on ENFORCING_LABEL_HOMES — the DB refuses others (HC0D6). */
  confidentialityLevel?: DocumentConfidentialityLevel
  /** HINTS for validation caps only; finalize re-derives server-side (D9). */
  declaredFileName: string
  declaredMimeType: string
  declaredSizeBytes: number
}

/**
 * The upload credential contract (contract amendment 5). The client island
 * performs, via `uploadDocumentFile` from `@/lib/documents/upload-client`:
 *
 *   PUT {upload.url}
 *   headers: { 'Content-Type': <the file's MIME type>, 'x-upsert': 'false' }
 *   body: the File/Blob bytes
 *
 * The URL is a complete short-TTL signed credential (token embedded) — no
 * browser Supabase client and no separate token are needed. Success = HTTP
 * 200. Failure (4xx/5xx, network abort, partial body) leaves NO object behind
 * the reservation: `finalizeDocumentUpload` then returns
 * `{ ok: false, error: 'upload_incomplete' }` and the reservation stays
 * retryable until it expires (`upload_expired`).
 */
export interface DocumentUploadCredential {
  method: 'PUT'
  url: string
  headers: Record<string, string>
  expiresAt: string
}

export type BeginDocumentUploadResult =
  | {
      ok: true
      uploadSessionId: string
      documentId: string
      documentVersionId: string
      upload: DocumentUploadCredential
    }
  | { ok: false; error: DocumentActionErrorCode }

export type FinalizeDocumentUploadResult =
  | {
      ok: true
      documentId: string
      documentVersionId: string
      availability: DocumentAvailability
    }
  | { ok: false; error: DocumentActionErrorCode }

export type OpenDocumentVersionResult =
  | {
      ok: true
      /** Short-TTL signed download URL (the ONLY byte corridor — D8). */
      url: string
      expiresAt: string
      fileName: string | null
    }
  | { ok: false; error: DocumentActionErrorCode }

/** Generic mutation result for the remaining commands. */
export type DocumentActionState =
  | { ok: true }
  | { ok: false; error: DocumentActionErrorCode }
