/**
 * Inter-Committee Case Referrals — CLIENT-SAFE domain types + label maps
 * (Phase 22 — `case_referrals`; ADR 0037).
 *
 * **Purity contract (the Phase-12 `event-model.ts` / Phase-14 `safety/types.ts`
 * discipline).** This module has ZERO imports — it must remain importable from
 * CLIENT components (the send wizard, the hub tables, the B-side detail, the QPS
 * dashboard). It must NEVER import `@/lib/supabase/*`, `next/headers`,
 * `server-only`, or any data-access/action module. The server-only query
 * functions (`@/lib/queries/referrals`) and the `"use server"` actions
 * (`@/lib/referrals/actions`) IMPORT their types from here — so a `"use client"`
 * component that needs a type/label never transitively drags
 * `@/lib/supabase/server` (→ `next/headers`) into the client bundle. (A
 * `"use server"` module also cannot export types at all, which is the other
 * reason the action INPUT types live here.)
 *
 * Stable ASCII / pt-BR-slug union values are storage/logic values; the
 * status/kind slugs are stored verbatim in `case_referral.status` /
 * `referral_shared_item.kind`. All user-facing strings are pt-BR, resolved via
 * the label maps below (Rule 10).
 *
 * **PHI posture (Rule 12 / ADR 0037).** The list/hub/dashboard shapes
 * ({@link ReferralListItem}) are PHI-FREE by construction. Patient identifiers
 * live ONLY on {@link ReferralPatient}, loaded through the audited
 * `getReferralPatient` door; the frozen narrative/reply bodies
 * ({@link SharedItem.frozenBodyMd}, {@link ReferralReply.resultMd}) are
 * PHI-bearing clinical free text and arrive only via the audited detail door.
 */

// ---------------------------------------------------------------------------
// Domain unions — the FROZEN vocabulary (stored slugs; pt-BR via labels)
// ---------------------------------------------------------------------------

/**
 * The referral lifecycle (Decision 4). A drives `rascunho → enviada` and the
 * `→ retirada` withdrawal; B drives `recebida → aceita/recusada → em_analise →
 * concluida` (conclusion delivers the reply). The pt-BR slugs are the stored
 * `case_referral.status` values; DB-enforced by `app.guard_referral_status`
 * (HC070 wrong-state). The RESOLVED set (a referral no longer "in flight" for
 * the close-case gate) is `concluida / recusada / retirada`.
 */
export type ReferralStatus =
  | 'rascunho'
  | 'enviada'
  | 'recebida'
  | 'aceita'
  | 'recusada'
  | 'em_analise'
  | 'concluida'
  | 'retirada'

/** The two kinds of frozen snapshot row B reads (Decision 9). A `narrative`
 * freezes a `body_md` copy; a `document` freezes the storage REFERENCE (Rule 6,
 * never the object). Stored verbatim in `referral_shared_item.kind`. */
export type SharedItemKind = 'narrative' | 'document'

/** Patient biological sex on the isolated PHI record (minimum-necessary).
 * Mirrors `event_patient` / {@link PatientSex} from the safety module. */
export type ReferralPatientSex = 'female' | 'male' | 'other' | 'unknown'

/** The direction of a referral relative to the commission viewing the hub: a
 * referral this commission SENT (`outgoing`, it is the source) vs one it
 * RECEIVED (`incoming`, it is the target). Derived in the query layer; not a
 * stored column. */
export type ReferralDirection = 'incoming' | 'outgoing'

// ---------------------------------------------------------------------------
// pt-BR display labels (Rule 10) — UI maps the stored slug → label
// ---------------------------------------------------------------------------

/** pt-BR labels for the referral status chip / filter. */
export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  recebida: 'Recebida',
  aceita: 'Aceita',
  recusada: 'Recusada',
  em_analise: 'Em análise',
  concluida: 'Concluída',
  retirada: 'Retirada',
}

/**
 * Status → design-token name (Rule 10). The UI resolves a chip/badge variant
 * from this map rather than hard-coding a colour per status, keeping the
 * "Clinical Calm" palette centralized. Values are token keys the frontend maps
 * to its `Badge` variants — NOT raw colours.
 */
export const REFERRAL_STATUS_TOKENS: Record<ReferralStatus, string> = {
  rascunho: 'muted',
  enviada: 'info',
  recebida: 'info',
  aceita: 'accent',
  recusada: 'destructive',
  em_analise: 'warning',
  concluida: 'success',
  retirada: 'muted',
}

/** pt-BR labels for the snapshot shared-item kind. */
export const SHARED_ITEM_KIND_LABELS: Record<SharedItemKind, string> = {
  narrative: 'Narrativa',
  document: 'Documento',
}

/** pt-BR labels for patient sex on the PHI panel (mirrors the safety module). */
export const REFERRAL_PATIENT_SEX_LABELS: Record<ReferralPatientSex, string> = {
  female: 'Feminino',
  male: 'Masculino',
  other: 'Outro',
  unknown: 'Não informado',
}

/** pt-BR labels for the hub direction segment / chip. */
export const REFERRAL_DIRECTION_LABELS: Record<ReferralDirection, string> = {
  incoming: 'Recebidos',
  outgoing: 'Enviados',
}

/** The set of statuses that do NOT block source-case conclusion (Decision 5).
 * Mirrors the `close_case` HC076 gate's resolved set; exported so the UI can
 * label which in-flight referrals are blocking. */
export const RESOLVED_REFERRAL_STATUSES: ReadonlySet<ReferralStatus> = new Set<
  ReferralStatus
>(['concluida', 'recusada', 'retirada'])

// ---------------------------------------------------------------------------
// Configurable vocabularies (seeded, admin-managed; Decisions 8 & 10)
// ---------------------------------------------------------------------------

/**
 * One `referral_types` row — the seeded, admin-managed, hospital-wide referral
 * type vocabulary (Decision 8). PHI-FREE. `defaultResponseExpected` pre-fills
 * the wizard's "reply expected?" toggle when the type is chosen.
 */
export interface ReferralType {
  id: string
  key: string
  label: string
  description: string | null
  /** Optional design-token name for the type chip; `null` = default. */
  colorToken: string | null
  /** Pre-fills `response_expected` when this type is selected in the wizard. */
  defaultResponseExpected: boolean
  position: number
  isActive: boolean
}

/**
 * One `reply_outcomes` row — the seeded, admin-managed structured-reply
 * disposition vocabulary (Decision 10). PHI-FREE. Seeds:
 * `procede / nao_procede / requer_acao / inconclusivo`.
 */
export interface ReplyOutcome {
  id: string
  key: string
  label: string
  description: string | null
  colorToken: string | null
  position: number
  isActive: boolean
}

// ---------------------------------------------------------------------------
// Domain types — the referral / snapshot / reply / PHI contract
// ---------------------------------------------------------------------------

/**
 * One referral as the hub / case-card / dashboard LIST consumes it. PHI-FREE by
 * construction (Decision 16) — the subject, status, commission names and dates
 * never leak patient context, so this is safe on every list/inbox/dashboard
 * path. `direction` is computed per the viewing commission. `hasPatient` is the
 * denormalized boolean flag (a boolean is not PHI); the panel affordance reads
 * it WITHOUT loading any identifier.
 */
export interface ReferralListItem {
  id: string
  /** Human code (`ENC-NNNN`, global sequence), stable for the referral's life. */
  code: string
  /** Whether this commission is the source (`outgoing`) or target (`incoming`). */
  direction: ReferralDirection
  status: ReferralStatus
  /** PHI-free one-line subject (not-blank). */
  subject: string
  /** Snapshotted type label (stable across later vocab edits). */
  typeLabel: string
  /** Optional design-token name for the type chip; `null` = default. */
  typeColorToken: string | null
  responseExpected: boolean
  sourceCommissionId: string
  sourceCommissionName: string | null
  targetCommissionId: string
  targetCommissionName: string | null
  /** The source case's human number (for the read-back / linkage UI). */
  sourceCaseId: string
  sourceCaseNumber: number | null
  /** B's optional linked case (`null` until B links one). */
  targetCaseId: string | null
  targetCaseNumber: number | null
  /** Denormalized: an isolated PHI record exists (panel affordance gate). */
  hasPatient: boolean
  /** Whether a reply has been delivered (`concluida`); the card shows it. */
  hasReply: boolean
  sentAt: string | null
  createdAt: string
}

/**
 * One referral's full detail as the audited detail door
 * ({@link getReferralDetail}) assembles it. The header is PHI-FREE; the
 * `sharedItems` may carry PHI-bearing frozen narrative bodies and the `reply`
 * may carry a PHI-bearing `resultMd` — both surface ONLY to entitled readers
 * (the RPC re-gates) and a PHI-open by a non-source-coordinator/non-QPS reader
 * emits a `referral.viewed` audit row.
 */
export interface ReferralDetail {
  id: string
  code: string
  direction: ReferralDirection
  status: ReferralStatus
  subject: string
  /** PHI-bearing free-text description A wrote on the referral (sanitized
   * Markdown; never copied into the audit log). */
  descriptionMd: string | null
  referralTypeId: string | null
  typeLabel: string
  typeColorToken: string | null
  responseExpected: boolean
  sourceCommissionId: string
  sourceCommissionName: string | null
  targetCommissionId: string
  targetCommissionName: string | null
  sourceCaseId: string
  sourceCaseNumber: number | null
  targetCaseId: string | null
  targetCaseNumber: number | null
  hasPatient: boolean
  createdById: string | null
  createdByName: string | null
  /** The frozen snapshot rows B reads (narratives + documents). */
  sharedItems: SharedItem[]
  /** The delivered reply, or `null` until `concluida`. */
  reply: ReferralReply | null
  sentAt: string | null
  receivedAt: string | null
  decidedAt: string | null
  concludedAt: string | null
  withdrawnAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * One frozen snapshot row (`referral_shared_item`). For a `narrative`,
 * {@link frozenBodyMd} holds the point-in-time `body_md` copy (PHI-bearing,
 * sanitized Markdown). For a `document`, the storage REFERENCE is frozen
 * (Rule 6) and the actual object is fetched via {@link getReferralDocumentUrl}
 * — the `frozenStoragePath` is never exposed to the client directly as a URL.
 */
export interface SharedItem {
  id: string
  referralId: string
  kind: SharedItemKind
  /** Provenance back-pointer (`null` if the source row was later deleted). */
  sourceNarrativeId: string | null
  sourceDocumentId: string | null
  frozenTitle: string | null
  /** Narrative copy (PHI-bearing); `null` for a `document`. */
  frozenBodyMd: string | null
  /** Document reference (Rule 6); `null` for a `narrative`. Resolved to a signed
   * URL only via the DEFINER door — not a directly-usable client value. */
  frozenStoragePath: string | null
  frozenMimeType: string | null
  frozenSizeBytes: number | null
  position: number
}

/**
 * The structured reply B delivers (`referral_reply`, 0..1 per referral). Frozen
 * once `repliedAt` is set (Decision 10). {@link resultMd} is PHI-bearing
 * clinical free text; a no-reply-expected referral may conclude with an
 * acknowledgment only ({@link acknowledgedOnly} = true, `resultMd` null).
 */
export interface ReferralReply {
  referralId: string
  replyOutcomeId: string | null
  /** Snapshotted outcome label (stable across later vocab edits). */
  outcomeLabel: string | null
  /** PHI-bearing result narrative (sanitized Markdown); required when the
   * referral expects a reply, `null` on an acknowledgment-only conclusion. */
  resultMd: string | null
  acknowledgedOnly: boolean
  /** Optional B-side reply attachments (downloaded via the DEFINER door). */
  attachments: ReferralReplyAttachment[]
  repliedById: string | null
  repliedByName: string | null
  repliedAt: string | null
}

/**
 * One B-side reply attachment (`referral_reply_attachment`). PHI-bearing.
 * Immutable, new path per upload (Rule 6); the object is fetched via
 * {@link getReferralAttachmentUrl}.
 */
export interface ReferralReplyAttachment {
  id: string
  referralId: string
  title: string
  /** Reference only; resolved to a signed URL via the DEFINER door. */
  storagePath: string
  mimeType: string | null
  sizeBytes: number | null
  uploadedById: string | null
  uploadedByName: string | null
  createdAt: string
}

/**
 * The isolated PHI satellite (0..1 per referral), modeled exactly on
 * {@link EventPatient}. LOADED ONLY via the audited {@link getReferralPatient};
 * every successful, entitled load emits a `referral_patient.read` audit row
 * (Rule 12). Minimum-necessary identifiers only.
 */
export interface ReferralPatient {
  referralId: string
  /** Patient full name (PHI). */
  name: string | null
  /** Medical record number / prontuário (PHI). */
  mrn: string | null
  /** Date of birth (PHI); the UI prefers DOB, falling back to `ageYears`. */
  dateOfBirth: string | null
  /** Age in years when DOB is unavailable/withheld (less-identifying fallback). */
  ageYears: number | null
  sex: ReferralPatientSex
  /** Admission / encounter reference in the EHR (PHI). */
  encounterRef: string | null
  /** Care unit / ward at the time (free text). */
  unit: string | null
  /** Attending physician (free text). */
  attending: string | null
  updatedAt: string
}

/**
 * Filters for the QPS cross-commission dashboard ({@link listAllReferrals}). All
 * optional; PHI-free (the dashboard never filters on patient identifiers).
 */
export interface ReferralDashboardFilters {
  status?: ReferralStatus
  sourceCommissionId?: string
  targetCommissionId?: string
  referralTypeId?: string
  responseExpected?: boolean
}

/**
 * QPS macro metrics for the dashboard ({@link referralFlowMetrics}). PHI-free
 * aggregate counts only.
 */
export interface ReferralFlowMetrics {
  total: number
  /** Not yet in a resolved state (`concluida/recusada/retirada`). */
  open: number
  /** Reply-expecting + still in flight (the close-case blockers across the org). */
  awaitingReply: number
  concluded: number
  declined: number
  withdrawn: number
}

// ---------------------------------------------------------------------------
// Action result + input shapes (a `"use server"` module cannot export types, so
// the shapes the client binds its forms to + the result state live here)
// ---------------------------------------------------------------------------

/** The shared `useActionState`-shaped result for every referral mutation.
 * Mirrors the safety module's `ActionState`: `error` read only when `!ok`,
 * `message` only when `ok` (success text never overloads `error`). */
export interface ReferralActionState {
  ok: boolean
  error?: string
  message?: string
  fieldErrors?: Record<string, string>
}

/** A create-draft action that returns the new referral's id (+ code). */
export interface CreateReferralState extends ReferralActionState {
  referralId?: string
  /** The minted code (`ENC-NNNN`) for the success toast. */
  code?: string
}

/** Fields accepted when a source coordinator opens a referral draft (Decision
 * 1/7). The actor must be a `staff_admin` of the source case's commission —
 * RPC-enforced (HC071 otherwise). */
export interface CreateReferralInput {
  /** The source case A is referring (the actor must coordinate its commission). */
  sourceCaseId: string
  /** The committee B the case is referred to. */
  targetCommissionId: string
  /** The chosen referral type (drives `type_label` snapshot + default reply). */
  referralTypeId: string
  /** PHI-free one-line subject. */
  subject: string
  /** Optional PHI-bearing free-text description (sanitized Markdown). */
  descriptionMd: string | null
  /** Whether a structured reply is expected (defaults from the type). */
  responseExpected: boolean
}

/** Editable draft fields (only while `rascunho`; HC070 otherwise). */
export interface UpdateReferralInput {
  referralTypeId: string
  subject: string
  descriptionMd: string | null
  responseExpected: boolean
}

/** Add one frozen snapshot item to a draft (Decision 3/9). Exactly one of
 * `sourceNarrativeId` / `sourceDocumentId` is set, matching `kind`; the RPC
 * freezes the copy (HC077 on a shape mismatch, HC073 once sent). */
export interface AddSharedItemInput {
  referralId: string
  kind: SharedItemKind
  /** Set when `kind = 'narrative'`; the source case narrative to freeze. */
  sourceNarrativeId: string | null
  /** Set when `kind = 'document'`; the source case document to freeze. */
  sourceDocumentId: string | null
}

/** The isolated PHI write (Rule 12), same 9-arg shape as `SetEventPatientInput`.
 * Minimum-necessary identifiers; entitlement is source-coordinator/QPS while the
 * referral is not yet concluded (HC078 otherwise). */
export interface SetReferralPatientInput {
  name: string | null
  mrn: string | null
  /** `YYYY-MM-DD`; prefer DOB, fall back to {@link ageYears}. */
  dateOfBirth: string | null
  ageYears: number | null
  sex: ReferralPatientSex
  encounterRef: string | null
  unit: string | null
  attending: string | null
}

/** B links a case it created in its own commission (Decision 1). The RPC
 * validates the case belongs to the target commission (HC079 otherwise). */
export interface LinkReferralCaseInput {
  referralId: string
  /** The case in B's commission to link (or `null` to clear an earlier link). */
  targetCaseId: string | null
}

/** Add one B-side reply attachment (Decision 10). The file is uploaded to a
 * fresh immutable path (Rule 6) before this records the reference. */
export interface AddReplyAttachmentInput {
  referralId: string
  title: string
  /** The pre-uploaded immutable storage path. */
  storagePath: string
  mimeType: string | null
  sizeBytes: number | null
}

/** Conclude a referral, delivering + freezing the reply (Decision 10). When the
 * referral expects a reply, `replyOutcomeId` + `resultMd` are REQUIRED (HC075
 * otherwise); a no-reply-expected referral may conclude with
 * `acknowledgedOnly = true`. */
export interface ConcludeReferralInput {
  referralId: string
  /** The structured disposition (required when a reply is expected). */
  replyOutcomeId: string | null
  /** PHI-bearing result narrative (required when a reply is expected). */
  resultMd: string | null
  /** Conclude with an acknowledgment only (no-reply-expected referrals). */
  acknowledgedOnly: boolean
}

/** Decline a referral with an optional note (Decision 4). */
export interface DeclineReferralInput {
  referralId: string
  /** Optional short pt-BR note shown to the source (free text). */
  note: string | null
}
