'use server'

import { featureEnabled } from '@/lib/queries/feature-flags'
import type {
  BeginDocumentUploadInput,
  BeginDocumentUploadResult,
  DocumentActionState,
  DocumentConfidentialityLevel,
  DocumentDispositionReason,
  DocumentHoldReason,
  DocumentSensitivityTier,
  FinalizeDocumentUploadResult,
  OpenDocumentVersionResult,
} from '@/lib/documents/types'

/**
 * Document model — COMMAND-LAYER SERVER ACTIONS (DM2·S2 contract-first stubs).
 *
 * Signatures are the CONTRACT (posted to the lead 2026-08-13; S3 builds
 * against them — keep stable; a shape change goes through the lead). Bodies
 * THROW until the S2 command RPCs land: a stub that faked success would be the
 * "silent return hides a live defect" class, so unimplemented is loud.
 *
 * The implementations will follow ADR 0114 D8/D9/D10/D11 + ADR 0117:
 * server-derived buckets/paths, verify-don't-trust finalize, the single
 * audited byte corridor (authorize THROUGH `app.can_read_document` so the D15
 * ceiling applies, gate BEFORE recording — DM1 QA MINOR-2), disposal that
 * means it, and the S1-O2 audited classification change.
 *
 * A `'use server'` module may export ONLY async functions — the shared
 * contract types live in `./types` (pure, client-safe).
 */

const NOT_IMPLEMENTED = 'DM2 S2: not implemented (contract stub)'

/** Whether the Wave-A document experience is on (`documents_wave_a`). */
export async function documentsWaveAEnabled(): Promise<boolean> {
  return featureEnabled('documents_wave_a')
}

/** Reserves a file object + upload session for a server-derived path and
 * returns a short-TTL signed upload credential (D8). */
export async function beginDocumentUpload(
  _input: BeginDocumentUploadInput,
): Promise<BeginDocumentUploadResult> {
  throw new Error(NOT_IMPLEMENTED)
}

/** Verifies the uploaded object server-side (size/MIME/hash re-derived —
 * caller values were hints) and binds it as the document version's file.
 * Idempotent per session (D9). */
export async function finalizeDocumentUpload(
  _uploadSessionId: string,
): Promise<FinalizeDocumentUploadResult> {
  throw new Error(NOT_IMPLEMENTED)
}

/** THE single byte corridor (D8/D10/D11): authorizes through the kernel
 * (D15 ceiling included), refuses non-servable states, records the audit row
 * AFTER its own gate, then signs short-TTL with the service-role client. */
export async function openDocumentVersion(
  _documentVersionId: string,
): Promise<OpenDocumentVersionResult> {
  throw new Error(NOT_IMPLEMENTED)
}

/** Audited classification change (S1-O2): the enforcing labels respect the
 * S1 seam (case/interview homes only — HC0D6 otherwise). */
export async function setDocumentConfidentiality(
  _documentId: string,
  _level: DocumentConfidentialityLevel | null,
): Promise<DocumentActionState> {
  throw new Error(NOT_IMPLEMENTED)
}

/** Requests disposition (D10): reads fail closed immediately; deletion is the
 * verified disposal job, blocked by retention/holds. */
export async function requestDocumentDisposition(
  _documentId: string,
  _reason: DocumentDispositionReason,
): Promise<DocumentActionState> {
  throw new Error(NOT_IMPLEMENTED)
}

/** Places a legal hold (blocks disposal and soft-delete honors it — D10). */
export async function placeDocumentHold(
  _documentId: string,
  _reason: DocumentHoldReason,
): Promise<DocumentActionState> {
  throw new Error(NOT_IMPLEMENTED)
}

/** Releases a legal hold. */
export async function releaseDocumentHold(_holdId: string): Promise<DocumentActionState> {
  throw new Error(NOT_IMPLEMENTED)
}

/** Soft-deletes a document (status machine; honors holds). */
export async function softDeleteDocument(_documentId: string): Promise<DocumentActionState> {
  throw new Error(NOT_IMPLEMENTED)
}

/** Tier reclassification: copy -> verify -> commit -> retire-source, never a
 * pointer update (D10 / F-03). */
export async function reclassifyDocument(
  _documentId: string,
  _targetTier: DocumentSensitivityTier,
): Promise<DocumentActionState> {
  throw new Error(NOT_IMPLEMENTED)
}
