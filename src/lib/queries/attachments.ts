import { createClient } from '@/lib/supabase/server'
import type {
  AttachmentOwnerType,
  AttachmentScanStatus,
  AttachmentTier,
  ConfidentialityLabel,
} from '@/lib/attachments/constants'
import { ATTACHMENTS_BUCKET } from '@/lib/attachments/constants'

/**
 * Centralized-attachments READ data-access (Phase F2; ADR 0063; Architecture Rule 9 —
 * all reads through `src/lib/queries/`). Reads go through the ordinary RLS-scoped
 * cookie client: `attachments_select` grants a row iff `app.can_read_attachment`
 * (owner-dispatch) is true, so a foreign caller simply gets `[]` — no DEFINER read.
 *
 * URL minting is TIER-SPLIT (the PHI door, §C):
 *  - `standard` tier lives in the `attachments` bucket, whose authenticated SELECT
 *    policy is the same owner-dispatch — so the cookie client mints a signed URL
 *    directly (no audit, exactly as a case-document / narrative read is unaudited).
 *  - `phi` tier lives in `attachments-phi`, which has NO authenticated SELECT policy
 *    at all (the hard door). Its blob is reachable ONLY via the audited
 *    `openAttachment` server action (`open_attachment` RPC → service-role signed URL).
 *    So list rows for phi attachments carry `signedUrl: null` + `containsPhi: true`;
 *    the UI opens them through the audited door on demand.
 */

// ---------------------------------------------------------------------------
// Domain shapes
// ---------------------------------------------------------------------------

/** An attachment's metadata (the blob lives in a tiered Storage bucket). */
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
  /** `true` when the blob is phi-tiered — download via {@link openAttachment}, never
   * a direct signed URL. */
  containsPhi: boolean
  /** A direct short-lived signed URL for a `standard`-tier blob; ALWAYS `null` for a
   * `phi`-tier blob (use the audited open door). */
  signedUrl: string | null
}

interface AttachmentRow {
  id: string
  owner_type: AttachmentOwnerType
  owner_id: string
  kind: string
  title: string
  description: string | null
  occurred_on: string | null
  storage_bucket: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  sensitivity_tier: AttachmentTier
  confidentiality_label: ConfidentialityLabel | null
  scan_status: AttachmentScanStatus
  legal_hold: boolean
  phi_disposed_at: string | null
  uploaded_by: string | null
  created_at: string
  profiles: { full_name: string | null } | null
}

const SIGNED_URL_TTL_SECONDS = 3600

const ATTACHMENT_COLUMNS = `
  id, owner_type, owner_id, kind, title, description, occurred_on,
  storage_bucket, storage_path, mime_type, size_bytes, sensitivity_tier,
  confidentiality_label, scan_status, legal_hold, phi_disposed_at, uploaded_by,
  created_at, profiles:uploaded_by ( full_name )
`

function toAttachment(r: AttachmentRow): Attachment {
  return {
    id: r.id,
    ownerType: r.owner_type,
    ownerId: r.owner_id,
    kind: r.kind,
    title: r.title,
    description: r.description,
    occurredOn: r.occurred_on,
    storageBucket: r.storage_bucket,
    storagePath: r.storage_path,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    sensitivityTier: r.sensitivity_tier,
    confidentialityLabel: r.confidentiality_label,
    scanStatus: r.scan_status,
    legalHold: r.legal_hold,
    phiDisposedAt: r.phi_disposed_at,
    uploadedBy: r.uploaded_by,
    uploadedByName: r.profiles?.full_name ?? null,
    createdAt: r.created_at,
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * An owner's NON-deleted, NON-infected attachments, newest-first (by `occurredOn`
 * then `createdAt`), each with its tier-split download affordance. RLS-scoped
 * (`app.can_read_attachment`); returns `[]` when the caller may not read the owner.
 * Standard-tier rows get a directly-signed URL (batch-minted from `attachments`);
 * phi-tier rows get `signedUrl: null` + `containsPhi: true`.
 */
export async function listAttachments(
  ownerType: AttachmentOwnerType,
  ownerId: string,
): Promise<AttachmentWithUrl[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('attachments')
    .select(ATTACHMENT_COLUMNS)
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .neq('scan_status', 'infected')
    .order('occurred_on', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .returns<AttachmentRow[]>()

  if (error || !data) return []

  // Batch-mint signed URLs for the STANDARD-tier paths only (the phi bucket has no
  // authenticated SELECT — those are opened through the audited door).
  const standardPaths = data
    .filter((r) => r.sensitivity_tier === 'standard')
    .map((r) => r.storage_path)
  const signedByPath = new Map<string, string>()
  if (standardPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrls(standardPaths, SIGNED_URL_TTL_SECONDS)
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) signedByPath.set(s.path, s.signedUrl)
    }
  }

  return data.map((r) => {
    const base = toAttachment(r)
    const containsPhi = r.sensitivity_tier === 'phi'
    return {
      ...base,
      containsPhi,
      signedUrl: containsPhi ? null : (signedByPath.get(r.storage_path) ?? null),
    }
  })
}

/**
 * A single attachment's metadata by id (RLS-scoped; `null` when unreadable / missing).
 * Does NOT mint a URL — use {@link openAttachment} (the audited door) for the blob.
 */
export async function getAttachment(id: string): Promise<Attachment | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('attachments')
    .select(ATTACHMENT_COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
    .returns<AttachmentRow | null>()
  return data ? toAttachment(data) : null
}
