import type {
  PrintedDocumentSourceKind,
  PrintedDocumentStatus,
} from '@/lib/pdf/types'

/**
 * Printed-documents READ data-access (PDF·P1; ADR 0104; Architecture Rule 9 — all
 * reads through `src/lib/queries/`).
 *
 * ⛔ CONTRACT-FIRST STUBS — signatures are the frozen contract `frontend` compiles
 * against (posted at PDF·P1 task B1); bodies land with the B2 migrations. Keep
 * signatures stable; a shape change goes through the lead.
 *
 * Access model (ADR 0104 D3/D11): `printed_documents` rows are RLS-scoped through the
 * per-kind dispatch door `app.can_view_printed_document(source_kind, source_id, uid)`
 * — the module never grants sight of anything; a caller who cannot view the SOURCE
 * artifact gets `[]`, evaluated at read time (mint is not a permanent self-grant).
 * Downloads NEVER surface a Storage URL (D8): the only byte path is the serving route
 * `/api/documents/[id]`, which authorizes + audits via the `open_printed_document`
 * door and streams (overlaying `SUBSTITUÍDO`/`ANULADO` on non-active documents).
 */

// ---------------------------------------------------------------------------
// Domain shapes
// ---------------------------------------------------------------------------

/** One registry row as listed on a source artifact's "Documentos emitidos" panel.
 * Zero PHI by construction (D3): pointers + metadata only, no titles, no free text. */
export interface PrintedDocumentSummary {
  id: string
  sourceKind: PrintedDocumentSourceKind
  sourceId: string
  templateKey: string
  templateVersion: number
  status: PrintedDocumentStatus
  containsPhi: boolean
  /** ISO-8601 mint timestamp. */
  mintedAt: string
  /** Minter display name (resolved from the profile; pt-BR fallback when absent). */
  mintedByDisplay: string
  /** Human-typable verification fallback code (printed beside the QR). */
  verificationShortCode: string
  /** Set only when `status = 'revoked'`. */
  revokedAt: string | null
  /** Constrained reason class (never free text here). */
  revokedReasonClass: string | null
  /** The ONLY sanctioned byte path: the serving route (D8). Never a Storage URL. */
  downloadPath: string
}

/**
 * The deliberately anemic public verification answer (ADR 0104 D10): authentic
 * yes/no · status · mint date · document kind · hospital name. NEVER patient
 * anything, case numbers, actor names, or bytes.
 */
export interface PrintedDocumentVerification {
  status: PrintedDocumentStatus
  /** ISO-8601 mint timestamp. */
  mintedAt: string
  sourceKind: PrintedDocumentSourceKind
  hospitalName: string
  /** Registry id — non-null ONLY when the caller is authenticated AND passes the
   * source-visibility door (server-enforced in the lookup RPC via `p_viewer`).
   * Anonymous callers ALWAYS receive null (D10: no anonymous download, no oracle).
   * Feeds the logged-in-viewer link to `/api/documents/<id>`. */
  documentId: string | null
}

/** Lookup key for a verification: the QR token or the typed short code. */
export type VerificationLookupKey =
  | { token: string }
  | { shortCode: string }

// ---------------------------------------------------------------------------
// Queries (stubs — bodies land with the B2 migrations)
// ---------------------------------------------------------------------------

/**
 * List every printed document minted from one source artifact, newest first, under
 * the caller's session (RLS delegates to source visibility — D11). Callers who
 * cannot view the source receive `[]`.
 */
export async function listPrintedDocuments(
  _sourceKind: PrintedDocumentSourceKind,
  _sourceId: string,
): Promise<PrintedDocumentSummary[]> {
  throw new Error('listPrintedDocuments: not implemented (PDF·P1 B1 contract stub)')
}

/**
 * Resolve a verification token or short code to the anemic public tuple (D10), or
 * `null` when nothing matches (the page renders "documento não reconhecido" —
 * indistinguishable from never-existed, deliberately).
 *
 * SERVER-ONLY caller path: the `/verificar` pages call this from the server; the
 * lookup is rate-limited and minimally logged (kind + token + timestamp — never an
 * `audit_log` row, D12). Anonymous callers never receive bytes or a download link.
 */
export async function lookupPrintedDocumentVerification(
  _key: VerificationLookupKey,
): Promise<PrintedDocumentVerification | null> {
  throw new Error(
    'lookupPrintedDocumentVerification: not implemented (PDF·P1 B1 contract stub)',
  )
}
