'use server'

import { createHash } from 'node:crypto'

import { renderDocumentHtml } from '@/lib/pdf/render'
import type { PrintedDocumentSourceKind } from '@/lib/pdf/types'
import { featureEnabled } from '@/lib/queries/feature-flags'
import {
  getViewerDisplayName,
  type PrintedDocumentSummary,
} from '@/lib/queries/printed-documents'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database'

import {
  mintDocumentId,
  mintVerificationShortCode,
  mintVerificationToken,
} from './credentials'
import { renderPdfViaGotenberg } from './gotenberg'
import { PDF_PROVIDERS } from './providers'
import { mintSemaphore } from './semaphore'

/**
 * PDF minting write actions (PDF·P1; ADR 0104 D5/D6/D11 + lead Amendment A).
 *
 * `src/lib/pdf-mint/` is the IMPURE orchestration half — providers map, mint
 * pipeline, sidecar client — which is exactly why it lives OUTSIDE the pure
 * `src/lib/pdf/` (ADR 0104 D14; enforced by the ESLint purity gate).
 *
 * The mint is synchronous and ALL-OR-NOTHING (D5): upload happens BEFORE the
 * registry RPC and the object is deleted when the RPC fails; on timeout
 * nothing is minted. Authority lives in the DB doors, never here — this
 * pipeline only orchestrates.
 */

// ---------------------------------------------------------------------------
// Result shapes (the shared `useActionState`-shaped contract)
// ---------------------------------------------------------------------------

/** The shared result shape for the printing mutations (house `ActionState` mirror). */
export interface PrintedDocumentActionState {
  ok: boolean
  /** User-readable pt-BR message; raw Supabase/Postgres errors never reach the UI. */
  error?: string
  fieldErrors?: Record<string, string>
}

/** Successful mints return the fresh registry row (already `active`). */
export interface MintPrintedDocumentState extends PrintedDocumentActionState {
  document?: PrintedDocumentSummary
}

/** Input for {@link mintPrintedDocument}. */
export interface MintPrintedDocumentInput {
  sourceKind: PrintedDocumentSourceKind
  sourceId: string
  /**
   * Per-mint PHI choice (ADR 0104 D9): explicit, default OFF, no memory of the
   * choice. P1/P2 kinds are PHI-incapable — passing `true` for them FAILS the
   * mint (fail closed); the option only renders for provider-declared
   * PHI-capable kinds (P3+).
   */
  includePhi?: boolean
}

/** Input for {@link revokePrintedDocument}. */
export interface RevokePrintedDocumentInput {
  documentId: string
  /** Constrained reason class (a closed vocabulary — never free text alone). */
  reasonClass: string
  /** Mandatory free-text reason (D6). MUST be PHI-free — governance text about
   * the record, not source content; the dialog instructs this inline. */
  reason: string
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type PrintedDocumentRow =
  Database['public']['Tables']['printed_documents']['Row']

const GENERIC_MINT_ERROR =
  'Não foi possível emitir o documento. Tente novamente.'
const FLAG_OFF_ERROR = 'A emissão de documentos em PDF não está disponível.'

/** SQLSTATEs whose message is OURS BY CONSTRUCTION and safe to surface verbatim.
 *
 * Only the custom `HC*` class qualifies. A code is surfaceable when NOTHING BUT
 * our own `raise` can produce it — not merely when our doors happen to raise it
 * today, because the message we would be forwarding is written by whoever raised
 * it, and Postgres writes in English (CLAUDE.md §8: raw Postgres errors never
 * reach the UI).
 *
 * Three entries were removed here (FUP-PDF-2), each verified against the LIVE
 * catalog rather than migration text:
 *  - `P0002` — DEAD. No PDF door raises it (`no_data_found` was designed out in
 *    `20260913000400`); it could only ever have forwarded Postgres's own text.
 *  - `23514` — never raised by any door either. `check_violation` comes from
 *    Postgres alone, and its message NAMES THE CONSTRAINT in English. QA walked
 *    every CHECK and found no reachable path today, so this was latent — but
 *    there is no house message behind this code at all, so it can only leak.
 *  - `42501` — the genuine hazard, and the reason this is a mapping and not just
 *    a shorter list. Both doors DO raise it with pt-BR text, but `42501` is also
 *    Postgres's own `insufficient_privilege` for an RLS/grant denial ("permission
 *    denied for table printed_documents"). Sharing one code between our text and
 *    Postgres's means the code cannot certify the message. So each call site now
 *    supplies its OWN pt-BR authorization message and the DB's text is discarded
 *    — the distinction between "cannot mint" and "cannot revoke" is preserved by
 *    the CALLER, which knows which door it opened, instead of by trusting a
 *    string that Postgres may have written.
 */
const SURFACEABLE_CODES = new Set(['HC0D1', 'HC0D2', 'HC0D3', 'HC0D5'])

/** House pt-BR text for the doors' own `42501` raises, per door. */
const UNAUTHORIZED_MINT_ERROR =
  'Sem autorização para emitir um documento deste registro.'
const UNAUTHORIZED_REVOKE_ERROR =
  'Apenas a coordenação da comissão ou um administrador da organização pode anular um documento emitido.'

function mapDoorError(
  error: { code?: string; message?: string },
  unauthorizedError: string,
): string {
  if (error.code === '42501') return unauthorizedError
  if (error.code && SURFACEABLE_CODES.has(error.code) && error.message) {
    return error.message
  }
  return GENERIC_MINT_ERROR
}

const sha256Hex = (bytes: Buffer) =>
  createHash('sha256').update(bytes).digest('hex')

function toSummary(
  row: PrintedDocumentRow,
  mintedByDisplay: string,
): PrintedDocumentSummary {
  return {
    id: row.id,
    sourceKind: row.source_kind as PrintedDocumentSourceKind,
    sourceId: row.source_id,
    templateKey: row.template_key,
    templateVersion: row.template_version,
    status: row.status as PrintedDocumentSummary['status'],
    containsPhi: row.contains_phi,
    mintedAt: row.minted_at,
    mintedByDisplay,
    verificationShortCode: row.verification_short_code,
    revokedAt: row.revoked_at,
    revokedReasonClass: row.revoked_reason_class,
    downloadPath: `/api/documents/${row.id}`,
  }
}

/** The QR must encode an ABSOLUTE public URL (D10) — configured, never derived
 * from request headers (a spoofable Host would end up printed on paper). */
function verificationBaseUrl(): string | null {
  const base = process.env.PDF_VERIFICATION_BASE_URL
  return base ? base.replace(/\/+$/, '') : null
}

/** Amendment A: an `HC0D4` collision means the short code is already minted —
 * the credential is IN the bytes, so the whole mint re-renders with fresh
 * credentials. 50-bit codes make a second collision negligible. */
const MAX_MINT_ATTEMPTS = 3

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Mint a printed document from a source artifact (D1 — a RECORD, not a view).
 * Authority: anyone who can VIEW the source artifact (D11) — enforced by the
 * `mint_printed_document` door via the same dispatch the registry RLS uses;
 * this action only orchestrates.
 */
export async function mintPrintedDocument(
  input: MintPrintedDocumentInput,
): Promise<MintPrintedDocumentState> {
  if (!(await featureEnabled('document_printing'))) {
    return { ok: false, error: FLAG_OFF_ERROR }
  }

  const provider = PDF_PROVIDERS[input.sourceKind]
  if (!provider) {
    // TS mirror of the SQL fail-closed ELSE (D3): unregistered kind, no mint.
    return {
      ok: false,
      error: 'Este tipo de registro ainda não permite emissão em PDF.',
    }
  }
  if (input.includePhi && !provider.phiCapable) {
    return {
      ok: false,
      error: 'Este tipo de documento não permite emissão com dados de paciente.',
    }
  }

  const base = verificationBaseUrl()
  if (!base) {
    return {
      ok: false,
      error:
        'A emissão está indisponível: endereço de verificação não configurado.',
    }
  }

  const supabase = await createClient()
  const admin = createAdminClient()
  const byDisplay = await getViewerDisplayName()

  for (let attempt = 1; attempt <= MAX_MINT_ATTEMPTS; attempt++) {
    // Amendment A: credentials BEFORE payload build — the QR carries the final
    // verification URL inside the canonical bytes.
    const id = mintDocumentId()
    const token = mintVerificationToken()
    const shortCode = mintVerificationShortCode()

    let pdf: Buffer
    let containsPhi: boolean
    try {
      const payload = await provider.build(input.sourceId, {
        qr: { token, shortCode, url: `${base}/verificar/${token}` },
        emission: { at: new Date().toISOString(), byDisplay },
      })
      // A8 (ADR 0104): `containsPhi` is PRESENCE-DERIVED by the provider —
      // conservative labeling of masked-class content, never a user choice.
      // Distinct from `input.includePhi` (the D9 per-mint patient-identifier
      // choice, gated on `provider.phiCapable` above and absent until P3).
      containsPhi = payload.containsPhi
      const html = renderDocumentHtml(payload)
      // D5: semaphore-bounded render; over capacity waits briefly then fails
      // pt-BR — never queues to disk. A timeout mints NOTHING (no upload yet).
      pdf = await mintSemaphore.run(() => renderPdfViaGotenberg(html))
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : GENERIC_MINT_ERROR,
      }
    }
    // The A4 derived path: the phi/ prefix keys off the SAME flag the door
    // CHECK-pins (storage bifurcation, D9.4).
    const storagePath = `${containsPhi ? 'phi' : 'std'}/${id}.pdf`

    // Upload BEFORE the registry RPC (Amendment B: the door verifies the
    // object exists); `upsert: false` — Rule 6, a path is written exactly once.
    const { error: uploadError } = await admin.storage
      .from('printed-documents')
      .upload(storagePath, pdf, {
        contentType: 'application/pdf',
        upsert: false,
      })
    if (uploadError) {
      return { ok: false, error: GENERIC_MINT_ERROR }
    }

    const { data, error: rpcError } = await supabase.rpc(
      'mint_printed_document',
      {
        p_id: id,
        p_source_kind: input.sourceKind,
        p_source_id: input.sourceId,
        p_template_key: provider.templateKey,
        p_template_version: provider.templateVersion,
        p_content_hash: sha256Hex(pdf),
        p_verification_token: token,
        p_verification_short_code: shortCode,
        p_contains_phi: containsPhi,
      },
    )

    if (!rpcError && data) {
      const row = data as unknown as PrintedDocumentRow
      return { ok: true, document: toSummary(row, byDisplay) }
    }

    // ALL-OR-NOTHING (D5): the registry refused — the orphan object goes.
    await admin.storage.from('printed-documents').remove([storagePath])

    if (rpcError?.code === 'HC0D4') {
      // Short-code collision: full-loop retry with fresh credentials.
      continue
    }
    return { ok: false, error: mapDoorError(rpcError ?? {}, UNAUTHORIZED_MINT_ERROR) }
  }
  return { ok: false, error: GENERIC_MINT_ERROR }
}

/**
 * Revoke a printed document (D6 — manual, rare, audited; for minted-from-
 * wrong-data cases). Authority: `staff_admin` of the owning commission + the
 * admin chain — NOT the minter (revocation is a governance act, not undo).
 * Nothing is deleted: verification starts answering "revogado" and downloads
 * gain the ANULADO overlay (D8).
 */
export async function revokePrintedDocument(
  input: RevokePrintedDocumentInput,
): Promise<PrintedDocumentActionState> {
  if (!(await featureEnabled('document_printing'))) {
    return { ok: false, error: FLAG_OFF_ERROR }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('revoke_printed_document', {
    p_id: input.documentId,
    p_reason_class: input.reasonClass,
    p_reason: input.reason,
  })
  if (error) {
    return { ok: false, error: mapDoorError(error, UNAUTHORIZED_REVOKE_ERROR) }
  }
  return { ok: true }
}
