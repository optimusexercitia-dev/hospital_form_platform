/**
 * Centralized-attachments SHARED CONSTANTS + domain vocabulary (Phase F2; ADR 0063).
 *
 * PURE module — NO server imports (no supabase client, no `server-only`). This is the
 * safe surface a Client Component may value-import: importing a `src/lib/queries/*`
 * server module into a client component drags the server supabase client into the
 * client bundle and ABORTS `next build` (memory `client-import-server-query-module-
 * breaks-build`). Keep every client-shared const here and re-export from the server
 * modules, never the reverse.
 *
 * These sets MIRROR the DB CHECK constraints + the create_attachment validation
 * (migrations `20260717000000` / `20260717000200`). Keep them in agreement.
 */

/** Shared server-action result shape (mirrors the platform `ActionState`). A
 * `'use server'` module can export only async functions, so these types live here. */
export interface AttachmentActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/** {@link AttachmentActionState} plus the new attachment id on a successful upload. */
export interface UploadAttachmentState extends AttachmentActionState {
  attachmentId?: string
}

/** The audited-open result: a signed URL, or `null` (NULL-out-of-scope / phi-blocked). */
export interface OpenAttachmentResult {
  signedUrl: string | null
}

/** The five authorizing owner kinds (dialect 2). `form_upload` is reserved-inert. */
export type AttachmentOwnerType =
  | 'case'
  | 'meeting'
  | 'interview'
  | 'action_item'
  | 'form_upload'

/** Physical PHI segregation → picks the storage bucket. */
export type AttachmentTier = 'phi' | 'standard'

/** Semantic access regime (orthogonal to tier; §F). */
export type ConfidentialityLabel =
  | 'non_phi_internal'
  | 'phi_standard'
  | 'phi_restricted'
  | 'peer_review_confidential'
  | 'legal_privileged'
  | 'ethics_investigation'
  | 'credentialing_sensitive'

/** Malware-scan state (no scanner in v1; default `skipped`). */
export type AttachmentScanStatus = 'skipped' | 'pending' | 'clean' | 'infected'

/** Constrained disposal reason categories (never free text; Rule 11 + LGPD). */
export type PhiDisposalReason =
  | 'retention_expired'
  | 'subject_request'
  | 'entered_in_error'
  | 'duplicate'
  | 'other'

/* ⛔ RETIRED by DM5·S4 (migration 20260927000400): `ATTACHMENTS_BUCKET`,
 * `ATTACHMENTS_PHI_BUCKET` and `bucketForTier()` lived here until the
 * `attachments` / `attachments-phi` bucket ROWS were retired. They had been
 * dead since DM1 dropped the substrate — verified zero callers across `src/`,
 * `e2e/`, `scripts/` and the catalog before removal.
 *
 * Do not reintroduce a tier→bucket helper here. Bucket choice is now a
 * SERVER-SIDE derivation on the core substrate: `file_objects_bucket_from_tier`
 * CHECK-pins `file_objects.sensitivity_tier` to `documents-standard` /
 * `documents-phi`, and `begin_document_upload` is the only thing that names a
 * bucket. A client-side constant naming a bucket is how the tier and the
 * storage location drift apart. */

/**
 * Allowed `kind` values per owner_type — the union of today's per-table CHECKs,
 * preserved on fold-in (Q6). Enforced in `create_attachment`.
 */
export const ATTACHMENT_KINDS: Record<AttachmentOwnerType, readonly string[]> = {
  case: ['ata', 'digitalizacao', 'registro', 'other'],
  meeting: ['pauta', 'apresentacao', 'literatura', 'lista_presenca', 'ata_assinada', 'outro'],
  interview: ['gravacao_audio', 'transcricao_assinada', 'evidencia', 'outro'],
  action_item: ['evidencia', 'outro'],
  form_upload: [], // reserved-inert
}

/** Default `kind` for a new upload of each owner_type (`create_attachment`). */
export function defaultKind(ownerType: AttachmentOwnerType): string {
  return ownerType === 'case' ? 'other' : 'outro'
}

/**
 * Default (tier, label) per owner_type (§F): case/interview ⇒ phi/phi_standard;
 * meeting/action_item ⇒ standard/non_phi_internal. Mirrors `create_attachment`.
 */
export function defaultClassification(ownerType: AttachmentOwnerType): {
  tier: AttachmentTier
  label: ConfidentialityLabel
} {
  if (ownerType === 'case' || ownerType === 'interview') {
    return { tier: 'phi', label: 'phi_standard' }
  }
  return { tier: 'standard', label: 'non_phi_internal' }
}

/**
 * Effective tier given an optional label: the two patient-PHI labels FORCE the phi
 * tier (mirrors the `attachments_phi_label_tier_ck` CHECK + create_attachment). Used
 * to pick the upload bucket BEFORE calling create_attachment.
 */
export function effectiveTier(
  ownerType: AttachmentOwnerType,
  label?: ConfidentialityLabel | null,
  requestedTier?: AttachmentTier | null,
): AttachmentTier {
  const base = requestedTier ?? defaultClassification(ownerType).tier
  if (label === 'phi_standard' || label === 'phi_restricted') return 'phi'
  return base
}
