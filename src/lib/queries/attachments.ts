import type {
  AttachmentOwnerType,
  AttachmentScanStatus,
  AttachmentTier,
  ConfidentialityLabel,
} from '@/lib/attachments/constants'

/**
 * Centralized-attachments READ data-access — PARKED (DM1, ADR 0114 D5 /
 * ADR 0116). The `public.attachments` substrate was DROPPED by migration
 * `20260923000100`; the domain shapes and both query signatures are kept
 * STABLE so the panels compile unchanged and render their empty/flag-off
 * state. Wave A (DM2) replaces this module with the document-model queries
 * (`src/lib/documents/`).
 */

// ---------------------------------------------------------------------------
// Domain shapes (kept for the UI consumers; no rows can exist in DM1)
// ---------------------------------------------------------------------------

/** An attachment's metadata (LEGACY shape — see the module header). */
export interface Attachment {
  id: string
  ownerType: AttachmentOwnerType
  ownerId: string
  kind: string
  title: string
  description: string | null
  occurredOn: string | null
  storageBucket: string
  storagePath: string
  mimeType: string | null
  sizeBytes: number | null
  sensitivityTier: AttachmentTier
  confidentialityLabel: ConfidentialityLabel | null
  scanStatus: AttachmentScanStatus
  legalHold: boolean
  phiDisposedAt: string | null
  uploadedBy: string | null
  uploadedByName: string | null
  createdAt: string
}

/** An {@link Attachment} plus its download affordance (tier-split). */
export interface AttachmentWithUrl extends Attachment {
  /** `true` when the blob is phi-tiered. */
  containsPhi: boolean
  /** Always `null` in DM1 (no substrate). */
  signedUrl: string | null
}

// ---------------------------------------------------------------------------
// Reads — PARKED: the substrate is gone; every owner has zero attachments.
// ---------------------------------------------------------------------------

/** PARKED (DM1): returns `[]` for every owner until Wave A. */
export async function listAttachments(
  _ownerType: AttachmentOwnerType,
  _ownerId: string,
): Promise<AttachmentWithUrl[]> {
  return []
}

/** PARKED (DM1): returns `null` for every id until Wave A. */
export async function getAttachment(_id: string): Promise<Attachment | null> {
  return null
}
