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
 *    (ADR 0114 D8).
 *
 *    ⚠ What that closes, stated accurately (both paths read, neither inferred —
 *    `src/lib/queries/rca.ts:249-270` and `src/lib/queries/capa.ts:358-380`):
 *    an **over-broad-TTL + unaudited-minting** hole, NOT audit pollution. Both
 *    list paths mint `createSignedUrl(storage_path, 3600)` for every
 *    `document` row on `nsp-evidence` — a private patient-safety bucket — at
 *    **3600 s** against the PO-ruled tiers of **PHI 120 s / standard 300 s**
 *    (ADR 0114 O4; `src/lib/documents/actions.ts:38-41`). That is 12x the
 *    standard and 30x the PHI window, and a signed URL **is a bearer token**,
 *    which is precisely why the split was ruled. Neither path emits any audit,
 *    so nothing records that the token was minted — the Rule 11 gap.
 *    (`auditRcaView`, `queries/rca.ts:164`, covers the workspace DETAIL open
 *    only; it never sees the evidence-signing path.)
 */

import type { DocumentUploadCredential } from '@/lib/documents/types'

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

/**
 * Uniform result for every S2 evidence command.
 *
 * ⚠ `terminal` (amendment 1, `frontend` gap 1) mirrors
 * `FinalizeDocumentUploadResult` (`src/lib/documents/types.ts:336-346`) and
 * exists because **the error code cannot discriminate two outcomes** — DM2 QA
 * r1 MAJOR-3. `upload_incomplete` covers both:
 *   - no object landed; the reservation is intact and a retry works; and
 *   - bytes LANDED and failed byte verification, leaving `file_objects` in
 *     `failed` — a state the D9 machine has **no outbound arc from**, over
 *     bytes that are immutable — so every retry re-enters the same dead end
 *     forever.
 * Without the marker the UI can only guess (retry once, treat a second
 * consecutive `upload_incomplete` as terminal), which re-opens the closed
 * defect class whenever landed-and-failed is the common case. Present and
 * `true` = final for this reservation: offer "remover e enviar novamente",
 * never "tentar novamente". Absent = retryable.
 *
 * Optional rather than a new error code, deliberately: the pt-BR label map
 * stays closed over `NspEvidenceErrorCode`.
 */
export type NspEvidenceActionState =
  | { ok: true }
  | { ok: false; code: NspEvidenceErrorCode; terminal?: boolean }

// ---------------------------------------------------------------------------
// Projections (reads)
// ---------------------------------------------------------------------------

/**
 * Servability of the file behind a `document`-kind evidence row, projected from
 * the core upload/scan/disposal state machine. The UI renders a state, never a
 * dead link.
/**
 * Servability of the file behind a `document`-kind evidence row, projected from
 * the core upload/scan/disposal state machine. The UI renders a state, never a
 * dead link.
 *
 * ⚠ FIVE members. An earlier version of this contract dropped `unavailable` on
 * the justification that both projections filter `.is('deleted_at', null)`.
 * **That filter is on the EVIDENCE row; `unavailable` derives from the
 * DOCUMENT's status** — `soft_delete_document` reaches `status='soft_deleted'`
 * independently of the evidence row, and `app.can_write_document` has arms for
 * both `rca` and `capa_action`, so it is reachable on these homes. The stated
 * fact was true and did not support the conclusion.
 *
 * ⚠ It must NOT be collapsed into `failed`. `failed` tells the user the UPLOAD
 * did not complete and to remove the item and send the file again. For a
 * DELIBERATELY REMOVED document that is a false diagnosis pointing at a recovery
 * action that cannot work. A wrong state is worse than a missing one.
 */
export type NspEvidenceAvailability =
  | 'available' // clean | unscanned_accepted, not disposed — the status quo
  | 'pending' // reserved | uploaded | verifying | scan_pending  (NEW to this UI)
  | 'failed' // failed | abandoned | infected | rejected          (NEW to this UI)
  | 'disposed' // disposal_pending | disposed                     (NEW to this UI)
  | 'unavailable'

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

/**
 * The reservation. The bucket and path behind the credential are server-derived
 * and never exposed.
 *
 * ⚠ Amendment 1 (`frontend` gap 2): `upload` is the full
 * `DocumentUploadCredential` (`{ method, url, headers, expiresAt }`), not a
 * bare URL string. Two reasons, both concrete:
 *   - the client-safe helper `uploadDocumentFile(credential, file)`
 *     (`src/lib/documents/upload-client.ts:13`) takes exactly that shape, so a
 *     bare string forces the UI to reimplement the PUT and hardcode
 *     `method: 'PUT'` with no headers;
 *   - a string can never carry a token, `x-upsert`, or content-length if the
 *     reservation ever needs one — the shape would have to break later.
 *
 * `expiresAt` rides INSIDE the credential rather than beside it (the twin's
 * layout). It is not decoration: the RESERVATION window is 15 minutes
 * (`upload_sessions.expires_at`), so expiry is routine, and a client that cannot see
 * it cannot tell "your reservation expired, start again" from "the upload
 * failed". It is a display/timing input only, never an authorization input.
 */
export interface NspEvidenceUploadTicket {
  uploadSessionId: string
  upload: DocumentUploadCredential
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

// ---------------------------------------------------------------------------
// The availability projection — a PURE, TOTAL function over the state machine
// ---------------------------------------------------------------------------

/**
 * `file_objects.upload_state` × `file_objects.disposal_state` × `documents.status`
 * → {@link NspEvidenceAvailability}.
 *
 * Lives here, in the pure client-safe contract, rather than inline in the two
 * list projections, so the claim *"`scan_pending` projects as `pending`"* has an
 * honest home: a three-line unit test instead of an E2E that boots a browser and
 * mutates `upload_state` by direct service-role UPDATE. E2E then stays reserved
 * for what only E2E can prove.
 *
 * ⚠ TOTAL over the real domain, not a chain of `if`s with an implicit
 * fallthrough. `upload_state` has TEN CHECK-constrained values and
 * `disposal_state` THREE.
 *
 * ⚠ PRECEDENCE IS LOAD-BEARING AND IS THE PART A REFACTOR WILL INVERT:
 * disposal outranks upload. A `clean` file whose `disposal_state` is `disposed`
 * projects as **disposed**, never `available` — bytes that are gone are not
 * servable however healthy the upload looked.
 *
 * ⚠ THE DEFAULT ARM IS DELIBERATELY CONSERVATIVE. An unrecognised state must
 * NEVER become `available`: that is the failure mode designed out here. A future
 * `upload_state` this function has not been taught lands on `failed`, which is
 * visible and wrong-in-the-safe-direction, rather than promising bytes the door
 * will refuse.
 *
 * ⚠ `pending` IS NOT REACHABLE THROUGH THE REAL CORRIDOR TODAY — the evidence
 * row is created at FINALIZE, and `complete_document_upload_verification` binds
 * the rendition and moves `scan_pending → unscanned_accepted` inside ONE
 * transaction, so no reader can observe an in-flight state. It is kept because
 * ADR 0114 **O2 (scanner selection) is OPEN**: the moment a scanner lands,
 * finalize stops collapsing and `scan_pending` becomes observable. This is
 * forward-looking vocabulary, NOT covered behaviour — recorded as such in the
 * slice's NOT COVERED section.
 */
export function nspEvidenceAvailability(input: {
  uploadState: string | null
  disposalState: string | null
  documentStatus: string | null
}): NspEvidenceAvailability {
  const { uploadState, disposalState, documentStatus } = input

  // Disposal outranks everything, on either the document or the file object.
  if (disposalState === 'disposal_pending' || disposalState === 'disposed') return 'disposed'
  if (documentStatus === 'disposal_pending' || documentStatus === 'disposed') return 'disposed'

  // A soft-deleted document is permanently unservable — but it is REMOVED, not
  // broken. `failed` would tell the user to re-upload, which cannot help.
  if (documentStatus !== null && documentStatus !== 'active') return 'unavailable'

  // No binding yet: begin ran, finalize has not. Unreachable via the corridor
  // today (see the O2 note above); mapped anyway.
  if (uploadState === null) return 'pending'

  switch (uploadState) {
    case 'reserved':
    case 'uploaded':
    case 'verifying':
    case 'scan_pending':
      return 'pending'
    case 'failed':
    case 'abandoned':
    case 'infected':
    case 'rejected':
      return 'failed'
    case 'clean':
    case 'unscanned_accepted':
      return 'available'
    default:
      // CONSERVATIVE by design — never `available`.
      return 'failed'
  }
}
