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
import {
  printedRenditionStorageBucket,
  printedRenditionStoragePath,
} from './storage-coordinates'

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

/**
 * The doors' narrowed return surface (`public.printed_document_public`,
 * FUP-PDF-3): exactly the columns the authenticated column-list SELECT GRANT
 * exposes — `verification_token` / `storage_path` / `revoked_by` /
 * `revoked_reason` never leave the door. Derived from the table Row type so
 * column renames stay compiler-checked.
 */
type PrintedDocumentDoorRow = Pick<
  Database['public']['Tables']['printed_documents']['Row'],
  | 'id'
  | 'source_kind'
  | 'source_id'
  | 'commission_id'
  | 'template_key'
  | 'template_version'
  | 'content_hash'
  | 'contains_phi'
  | 'status'
  | 'verification_short_code'
  | 'minted_by'
  | 'minted_at'
  | 'superseded_at'
  | 'revoked_reason_class'
  | 'revoked_at'
>

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
  row: PrintedDocumentDoorRow,
  mintedByDisplay: string,
  /** Derived by the caller from `printed_document_currency`. `null` = NOT
   * EVALUATED (the door omitted the id), which is neither `true` nor `false`. */
  isCurrent: boolean | null,
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
    // ⛔ DERIVED BY THE CALLER, NEVER ASSERTED HERE. An earlier version hard-coded
    // `true` on the reasoning that a just-minted print is current by construction
    // — the door refused unless HC0DP and HC0DU both passed. That is sound for
    // MEETINGS and WRONG for form_response, measured from the catalog:
    //   • HC0DP is `app.print_source_registers` — the REGISTRATION conjunct only.
    //     It carries no head term.
    //   • HC0DU is the revision compare, which is a structural NO-OP for
    //     form_response (its revision is always 0).
    // So NEITHER gate evaluates HEAD for a response, and ADR 0126 D2 row 3 is
    // reachable: R1 submitted -> correction -> R2 APPROVED moves
    // `case_phases.current_response_id`, while R1 stays `submitted` and still
    // registers (the open-correction conjunct keys on requests whose
    // `draft_response_id` is R1, and R1 was the PREDECESSOR, not the draft).
    // Minting R1 then reports "current" on a print that is not head.
    // ⭐ And the category error underneath it: hard-coding `true` is STAMPING
    // currency at write time, which D3 forbids — currency is derived at read time
    // and never stamped.
    isCurrent,
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
    // The revision the provider OBSERVED while building the payload. Captured
    // here, beside containsPhi, because both must survive the render window and
    // reach the door — see the assignment below.
    let sourceRevision: number
    try {
      const payload = await provider.build(input.sourceId, {
        kind: 'registered',
        qr: { token, shortCode, url: `${base}/verificar/${token}` },
        emission: { at: new Date().toISOString(), byDisplay },
      })
      // A8 (ADR 0104): `containsPhi` is PRESENCE-DERIVED by the provider —
      // conservative labeling of masked-class content, never a user choice.
      // Distinct from `input.includePhi` (the D9 per-mint patient-identifier
      // choice, gated on `provider.phiCapable` above and absent until P3).
      containsPhi = payload.containsPhi
      // ⛔ ADR 0126 Consequences (compare-and-mint) — READ FROM THE PAYLOAD, and
      // never re-read from the source here. The render below is out-of-band and
      // takes seconds; `reopen_meeting` can fire inside that window. The door
      // compares this observed value against the source's current one and raises
      // HC0DU on a mismatch, which is the ONLY thing stopping a registered hash
      // from pinning bytes of a state that never coherently registered.
      //
      // ⚠ A fresh read at the mint call would hand the door its own current
      // value: the comparison would always succeed and HC0DU would go VACUOUS
      // WHILE LOOKING CORRECT. This action deliberately performs no source query
      // of its own, so there is no fresher value available to reach for.
      sourceRevision = payload.sourceRevision
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
    // DM5 S3 (ADR 0120 D7/D11): the coordinate moved onto the core document
    // substrate. The tier is now the BUCKET — CHECK-pinned by
    // `file_objects_bucket_from_tier` — instead of a `phi/`|`std/` path prefix,
    // so the path itself has no branch left.
    const bucket = printedRenditionStorageBucket(containsPhi)
    const storagePath = printedRenditionStoragePath(id)

    // Upload BEFORE the registry RPC (Amendment B: the door verifies the
    // object exists); `upsert: false` — Rule 6, a path is written exactly once.
    const { error: uploadError } = await admin.storage
      .from(bucket)
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
        // Passed UNIFORMLY for every kind — no branch on `sourceKind`. Responses
        // carry 0 and the door's kind-dispatch treats the compare as a no-op
        // there; a caller that branched here would re-create the abstraction
        // leak `mint_printed_document`'s own body forbids.
        p_source_revision: sourceRevision,
      },
    )

    if (!rpcError && data) {
      const row = data as unknown as PrintedDocumentDoorRow
      // ADR 0126 D3: currency is DERIVED AT READ TIME, so it is read here rather
      // than assumed from the mint having succeeded. Same door the panel uses, so
      // there is one derivation and not two that can disagree.
      const { data: cur } = await supabase.rpc('printed_document_currency', {
        p_ids: [row.id],
      })
      const isCurrent =
        ((cur ?? []) as { id: string; is_current: boolean | null }[]).find(
          (c) => c.id === row.id,
        )?.is_current ?? null
      return { ok: true, document: toSummary(row, byDisplay, isCurrent) }
    }

    // ALL-OR-NOTHING (D5): the registry refused — the orphan object goes.
    await admin.storage.from(bucket).remove([storagePath])

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
