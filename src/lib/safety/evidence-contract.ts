/**
 * DM5 S2 — NSP RCA/CAPA evidence on the document substrate: the CONTRACT.
 *
 * CLIENT-SAFE, pure module (types + a SQLSTATE map). No server imports, no
 * supabase client — the `lint:client-server-imports` gate depends on that, and
 * a client value-import from a server module aborts `next build` while tsc,
 * lint and vitest all stay green (BUG-FBE-005).
 *
 * Posted BEFORE implementation (contract-first, CLAUDE.md §4) so `frontend`
 * builds against real types instead of a provisional shape. DM2 found 10 gaps
 * that way, three of them visible regressions. **These signatures are stable
 * once posted** — if a shape must change I tell the lead so frontend adapts.
 *
 * Executes ADR 0120 D1/D2/D10/D14/D15/D16 under ADR 0114 D8/D9.
 *
 * ## What changes, and why the old shape cannot survive
 *
 * Today an evidence file is a caller-minted string: the client uploads straight
 * to the `nsp-evidence` bucket and passes the path it invented into
 * `add_rca_evidence(p_storage_path …)`, which stores it with **no bucket check,
 * no existence check, and no size / MIME / hash** — the exact inversion ADR 0114
 * D8/D9 exists to end ("buckets and paths derived server-side; caller-supplied
 * bucket/path/size/MIME/hash are never trusted"). S2 removes `p_storage_path`.
 *
 * Consequences the UI feels, both deliberate:
 *
 * 1. **Uploading becomes two server round-trips, not one.** The reserve →
 *    PUT → finalize flow is the existing `src/lib/documents/` command layer,
 *    reused rather than reimplemented; NSP evidence gets an `rca` /
 *    `capa_action` home, not a parallel mechanism.
 * 2. **Listing no longer returns a signed URL.** `openUrl` is GONE. The list
 *    projection carries `documentId` + `availability` + a server-computed
 *    `canOpen`, and bytes resolve on demand through the single audited door
 *    (ADR 0114 D8). Eagerly signing every row in a list both leaks reach and
 *    emits a `document.opened` audit row for files nobody opened.
 */

// ---------------------------------------------------------------------------
// Failure codes — SQLSTATE-keyed, CODE ALONE, never message text
// ---------------------------------------------------------------------------

/**
 * Machine-readable command failure codes. The UI owns the pt-BR wording; this
 * module maps SQLSTATEs to these codes **on code alone**, never on message
 * text. Raw Postgres/Supabase messages never reach the UI (Rule 10).
 *
 * Mirrors `DocumentActionErrorCode` deliberately: NSP evidence rides the same
 * command layer, so a divergent vocabulary would be two names for one failure.
 */
export type NspEvidenceErrorCode =
  | 'module_disabled' // patient_safety OR documents_wave_d is off
  | 'not_found' // absence ≡ denial, deliberately indistinguishable
  | 'forbidden' // authenticated, not authorized for this RCA/CAPA
  | 'rca_not_writable' // RCA is completed/locked (HC048)
  | 'under_legal_hold'
  | 'upload_expired' // the reservation lapsed; begin again
  | 'upload_incomplete' // no verified object behind the session; retry the PUT
  | 'file_too_large'
  | 'file_type_not_allowed'
  | 'invalid_input' // vocabulary/shape refusals (incl. the 23514 table CHECKs)
  | 'unavailable' // open door: not servable right now
  | 'disposed' // open door: disposition requested or completed
  | 'retention_blocked'
  | 'unknown'

/**
 * SQLSTATE → contract code.
 *
 * ⚠ `HC0DM` is deliberately ABSENT. It is the parked-citation refusal that S2
 * removes; a map entry for it would outlive the code that raises it and read as
 * live behaviour. If it ever appears again it must surface as `unknown` — loud —
 * rather than as a friendly banner for a state that should no longer exist.
 *
 * ⚠ `23514` maps to `invalid_input`: after S2 the table CHECKs (`rca_evidence_shape`,
 * `capa_action_evidence_shape`) are the backstop that holds against DIRECT
 * PostgREST DML, which the RPC's flag assert cannot (FUP-DM5-GRANTS). A 23514
 * reaching here means the shape rule fired, not that the RPC misvalidated.
 */
export function mapNspEvidenceErrorCode(
  sqlstate: string | null | undefined,
): NspEvidenceErrorCode {
  switch (sqlstate) {
    case 'HC0D7':
      return 'module_disabled'
    case 'P0002':
    case 'no_data_found':
      return 'not_found'
    case '42501':
      return 'forbidden'
    case 'HC048':
      return 'rca_not_writable'
    case 'HC0D3':
      return 'under_legal_hold'
    case 'HC0DE':
      return 'upload_expired'
    case 'HC0D9':
      return 'upload_incomplete'
    case 'HC0DF':
      return 'file_too_large'
    case 'HC0DG':
      return 'file_type_not_allowed'
    case '23514':
    case 'check_violation':
      return 'invalid_input'
    case 'HC0D8':
      return 'unavailable'
    case 'HC0DD':
      return 'disposed'
    case 'HC0DR':
      return 'retention_blocked'
    default:
      return 'unknown'
  }
}

/** Uniform result for every S2 evidence command. */
export type NspEvidenceActionState =
  | { ok: true }
  | { ok: false; code: NspEvidenceErrorCode }

// ---------------------------------------------------------------------------
// Projections (reads)
// ---------------------------------------------------------------------------

/**
 * Servability of the file behind a `document`-kind evidence row, projected from
 * the core upload/scan/disposal state machine. The UI renders a state, never a
 * dead link.
 */
export type NspEvidenceAvailability =
  | 'available' // clean | unscanned_accepted, not disposed
  | 'pending' // reserved | uploaded | verifying | scan_pending
  | 'failed' // failed | abandoned | infected | rejected
  | 'disposed' // disposal_pending | disposed

/**
 * One RCA evidence row, S2 shape.
 *
 * ⚠ REPLACES `RcaEvidence` (`src/lib/safety/rca-types.ts:200`). Field-level diff
 * for frontend:
 *   - REMOVED `openUrl`      → use `canOpen` + `openRcaEvidence(id)` on demand
 *   - ADDED   `documentId`   → the backing core document (`kind = 'document'`)
 *   - ADDED   `availability` / `canOpen`
 *   - ADDED   `citedDocumentId` → the UN-PARKED citation seam (ADR 0120; the
 *     `cited_document_id` slot, which is `kind = 'citation'` and mutually
 *     exclusive with the uploaded byte — two INDEPENDENT seams, not one)
 */
export interface RcaEvidenceView {
  id: string
  rcaId: string
  kind: 'document' | 'link' | 'citation'
  title: string
  /** Backing core document for `kind = 'document'`; null otherwise. */
  documentId: string | null
  /** Null unless `kind = 'document'`. */
  availability: NspEvidenceAvailability | null
  /** Server-computed affordance (the `canOpen` principle, ADR 0118 §11). */
  canOpen: boolean
  externalUrl: string | null
  citationTarget: 'interview' | 'meeting' | 'document' | null
  citationLabel: string | null
  /** Cited interview/meeting id; null when the citation targets a document. */
  citedEntityId: string | null
  /** Cited core document id when `citationTarget = 'document'`. */
  citedDocumentId: string | null
  createdAt: string
}

/** One CAPA implementation-evidence row, S2 shape. Same diff as above, minus
 *  the citation seam — `capa_action_evidence.kind` is only `document | link`. */
export interface CapaActionEvidenceView {
  id: string
  actionId: string
  kind: 'document' | 'link'
  title: string
  documentId: string | null
  availability: NspEvidenceAvailability | null
  canOpen: boolean
  externalUrl: string | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// Command inputs
// ---------------------------------------------------------------------------

/** What the client may declare at reserve time. Every value is a DECLARATION
 *  re-derived and re-verified server-side at finalize — never trusted (D9). */
export interface NspEvidenceUploadRequest {
  title: string
  declaredFileName: string
  declaredMime: string
  declaredSize: number
}

/** The reservation. `uploadUrl` is a short-TTL signed PUT target; the bucket and
 *  path behind it are server-derived and never exposed. */
export interface NspEvidenceUploadTicket {
  uploadSessionId: string
  uploadUrl: string
  /** Echoed for the client's own progress UI only — NOT an authorization input. */
  expiresAt: string
}

/** Add a `link` evidence row (no bytes, no substrate involvement). */
export interface NspEvidenceLinkInput {
  title: string
  externalUrl: string
}

/** Add a `citation` evidence row (RCA only). `citedDocumentId` is the seam S2
 *  un-parks; the other two targets were always live. */
export interface RcaEvidenceCitationInput {
  title: string
  citationTarget: 'interview' | 'meeting' | 'document'
  citedEntityId: string
  citationLabel: string
}
