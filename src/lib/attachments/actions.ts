'use server'

import { featureEnabled } from '@/lib/queries/feature-flags'
import type {
  AttachmentActionState,
  AttachmentTier,
  ConfidentialityLabel,
  OpenAttachmentResult,
  PhiDisposalReason,
  UploadAttachmentState,
} from '@/lib/attachments/constants'

/**
 * Centralized-attachments SERVER ACTIONS — PARKED (DM1, ADR 0114 D5 / ADR 0116).
 *
 * The F2 substrate these actions drove (`attachments` tables, RPCs, storage
 * policies) was DROPPED by migration `20260923000100`. Every exported signature
 * is kept STABLE so the UI compiles unchanged and renders its flag-off state
 * (the `attachments` flag is false everywhere — production since 2026-08-11,
 * local since the DM1 seed change); every body now returns the module's
 * "indisponível" result. Wave A (DM2) rebuilds the experience on the document
 * model (`documents_foundation` / `documents_wave_a`) and retires this module.
 *
 * A `'use server'` module may export ONLY async functions — shared result types
 * live in `./constants` (a pure module safe for client import).
 */

const MESSAGES = {
  unavailable: 'O recurso de anexos ainda não está disponível.',
} as const

/** Whether the `attachments` feature flag is on. Permanently false in DM1
 * (the key survives, verbless, until DM2 retires it). */
export async function attachmentsEnabled(): Promise<boolean> {
  return featureEnabled('attachments')
}

/** PARKED (DM1): always unavailable until Wave A rebuilds uploads on the
 * document model. Signature kept for the `useActionState` call sites. */
export async function createAttachment(
  _prev: UploadAttachmentState | undefined,
  _formData: FormData,
): Promise<UploadAttachmentState> {
  return { ok: false, error: MESSAGES.unavailable }
}

/** PARKED (DM1): the audited open door returns null-out-of-scope for every
 * caller until DM2's `open_document_version` replaces it. */
export async function openAttachment(_id: string): Promise<OpenAttachmentResult> {
  return { signedUrl: null }
}

/** PARKED (DM1): reclassification returns unavailable until the document
 * model's copy→verify→commit→retire flow (ADR 0114 D10) lands. */
export async function reclassifyAttachment(
  _id: string,
  _newTier: AttachmentTier,
  _newLabel?: ConfidentialityLabel,
): Promise<AttachmentActionState> {
  return { ok: false, error: MESSAGES.unavailable }
}

/** PARKED (DM1): always unavailable until Wave A. */
export async function softDeleteAttachment(_id: string): Promise<AttachmentActionState> {
  return { ok: false, error: MESSAGES.unavailable }
}

/** PARKED (DM1): always unavailable until Wave A; document disposal is the
 * D10 machine (`file_objects.disposal_state`), not a row redaction. */
export async function disposeAttachmentPhi(
  _id: string,
  _reason: PhiDisposalReason,
): Promise<AttachmentActionState> {
  return { ok: false, error: MESSAGES.unavailable }
}
