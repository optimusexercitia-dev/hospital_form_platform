'use server'

import type { PrintedDocumentSourceKind } from '@/lib/pdf/types'
import type { PrintedDocumentSummary } from '@/lib/queries/printed-documents'

/**
 * PDF minting write actions (PDF·P1; ADR 0104 D5/D6/D11).
 *
 * `src/lib/pdf-mint/` is the IMPURE orchestration half of the module — providers map,
 * mint pipeline, sidecar client. It imports domain queries and the supabase clients,
 * which is exactly why it lives OUTSIDE `src/lib/pdf/` (the pure renderer — ADR 0104
 * D14; enforced by the §6 lint gate).
 *
 * ⛔ CONTRACT-FIRST STUBS — signatures are the frozen contract `frontend` compiles
 * against (posted at PDF·P1 task B1); bodies land after the B2 migrations. Keep
 * signatures stable; a shape change goes through the lead.
 *
 * Mint pipeline when implemented (D5 — synchronous, all-or-nothing, ~3-permit
 * semaphore, 30 s budget): flag check → provider lookup → payload build under the
 * caller's session → render HTML → Gotenberg POST → sha-256 → Storage upload →
 * `mint_printed_document` RPC (supersedes prior active mints of the same
 * (kind, source, template) inside one transaction, emits `document.minted`) → on RPC
 * failure the uploaded object is deleted. On timeout nothing is minted.
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
   * choice. P1/P2 kinds are PHI-incapable — passing `true` for them FAILS the mint
   * (fail closed); the option only renders for provider-declared PHI-capable kinds
   * (P3+). PHI authorization is the source domain's existing door, never a new one.
   */
  includePhi?: boolean
}

/** Input for {@link revokePrintedDocument}. */
export interface RevokePrintedDocumentInput {
  documentId: string
  /** Constrained reason class (a closed vocabulary — never free text alone). */
  reasonClass: string
  /** Mandatory free-text reason (D6). MUST be PHI-free — governance text about the
   * record, not source content; the dialog instructs this inline. */
  reason: string
}

// ---------------------------------------------------------------------------
// Actions (stubs — bodies land after the B2 migrations)
// ---------------------------------------------------------------------------

/**
 * Mint a printed document from a source artifact (D1 — a RECORD, not a view).
 * Authority: anyone who can VIEW the source artifact (D11; the same
 * `can_view_printed_document` dispatch the registry RLS uses — not admin-gated).
 * Re-minting the same (kind, source, template) marks prior mints `superseded`.
 */
export async function mintPrintedDocument(
  _input: MintPrintedDocumentInput,
): Promise<MintPrintedDocumentState> {
  throw new Error('mintPrintedDocument: not implemented (PDF·P1 B1 contract stub)')
}

/**
 * Revoke a printed document (D6 — manual, rare, audited; for minted-from-wrong-data
 * cases). Authority: `staff_admin` of the owning commission + the admin chain — NOT
 * the minter (revocation is a governance act, not undo). Nothing is deleted: bytes
 * and rows are permanent; verification starts answering `revogado` and downloads
 * gain the `ANULADO` overlay (D8).
 */
export async function revokePrintedDocument(
  _input: RevokePrintedDocumentInput,
): Promise<PrintedDocumentActionState> {
  throw new Error('revokePrintedDocument: not implemented (PDF·P1 B1 contract stub)')
}
