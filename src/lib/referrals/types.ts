/**
 * Inter-Committee Case Referrals — CLIENT-SAFE domain types + label maps
 * (Phase 22 — `case_referrals`; ADR 0037).
 *
 * **Purity contract (the Phase-12 `event-model.ts` / Phase-14 `safety/types.ts`
 * discipline).** This module imports exactly TWO things — the type of the shared
 * Registro vocabulary from `@/lib/cases/registro-kinds`, and (since DM4 / ADR 0114
 * Wave C) the shared document-contract types from `@/lib/documents/types` — both
 * themselves pure, side-effect-free, client-safe modules with zero server
 * imports — and must otherwise stay import-free, because it has to
 * remain importable from CLIENT components (the send wizard, the hub tables, the
 * B-side detail, the QPS dashboard). It must NEVER import `@/lib/supabase/*`,
 * `next/headers`, `server-only`, or any data-access/action module. The server-only query
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
 * RV2 R3 adds the `answered → resolved` resolution split + `parent_referral_id`
 * lineage (ADR 0037 D4/D5/D15); the PHI-bearing resolution narrative
 * ({@link ReferralResolution.summaryMd}) arrives only via the audited detail door.
 *
 * **PHI posture (Rule 12 / ADR 0037).** The list/hub/dashboard shapes
 * ({@link ReferralListItem}) are PHI-FREE by construction. Patient identifiers
 * live ONLY on {@link ReferralPatient}, loaded through the audited
 * `getReferralPatient` door; the frozen narrative/reply bodies
 * ({@link SharedItem.frozenBodyMd}, {@link ReferralReply.resultMd}) are
 * PHI-bearing clinical free text and arrive only via the audited detail door.
 */

import type { CaseEventKind } from '@/lib/cases/registro-kinds'
import type {
  DocumentAvailability,
  DocumentUploadCredential,
} from '@/lib/documents/types'

// ---------------------------------------------------------------------------
// Domain unions — the FROZEN vocabulary (stored slugs; pt-BR via labels)
// ---------------------------------------------------------------------------

/**
 * The referral lifecycle (Decision 4). A drives `draft → sent` and the
 * `→ withdrawn` withdrawal; B drives `received → accepted/rejected → in_review`.
 * RV2 R3 (ADR 0037 D4/D5) splits the conclusion: a reply-expecting referral
 * concludes to `answered` (B delivered the formal response; A owes the next move),
 * then the SOURCE committee `resolve`s it to `resolved`; a no-reply acknowledgment
 * still concludes straight to `completed`. A `resolved` referral may be reopened
 * (`→ in_review`). The pt-BR slugs are the stored `case_referral.status` values;
 * DB-enforced by `app.guard_referral_status` (HC070 wrong-state). The RESOLVED set
 * (a referral no longer "in flight" for the close-case gate) is
 * `completed / resolved / rejected / withdrawn` — `answered` still BLOCKS.
 */
export type ReferralStatus =
  | 'draft'
  | 'sent'
  | 'received'
  | 'accepted'
  | 'rejected'
  | 'in_review'
  | 'awaiting_information'
  | 'answered'
  | 'resolved'
  | 'completed'
  | 'withdrawn'

/**
 * A thread message kind (RV2 R1). `general` = a free-form comment; the
 * `information_request` / `information_response` pair is the two-way clarification
 * exchange (posted by the dedicated RPCs, which also flip
 * `awaiting_information`); `clarification` is a follow-up note. Stored verbatim in
 * `referral_messages.message_type`.
 */
export type MessageType =
  | 'general'
  | 'information_request'
  | 'information_response'
  | 'clarification'

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

/**
 * Triage priority (RV2 R2). PHI-free metadata stored verbatim in
 * `case_referral.priority` (DB CHECK-enforced; default `routine`). Drives the
 * hub/inbox/QPS priority badge + aging sort.
 */
export type ReferralPriority = 'routine' | 'high' | 'urgent' | 'critical'

/**
 * ADR 0094 W4/D7 — which arm of the referral's TARGET sum type a row is on. Mirrors
 * `case_referral.target_type`, whose CHECK is the authority; the DB pins it in
 * agreement with which target id is non-null, so this discriminator and
 * `targetCommissionId` / `targetHospitalId` can never disagree.
 *
 * `technical_director` means the destination is a hospital's Diretor Técnico — the
 * OFFICE, resolved live (D4), not a person captured at send time.
 */
export type ReferralTargetType = 'commission' | 'technical_director'

/**
 * A PHI-FREE structured decline reason (RV2 R2), stored in
 * `case_referral.decline_reason_code` (DB CHECK-enforced). DISTINCT from the
 * PHI free-text {@link DeclineReferralInput.note} (`decline_note`, column-REVOKED)
 * — this code is visible to metadata-tier readers; the note is PHI-gated.
 */
export type ReferralDeclineReasonCode =
  | 'outside_jurisdiction'
  | 'duplicate'
  | 'wrong_committee'
  | 'insufficient_information'
  | 'conflict_of_interest'
  | 'other'

/**
 * RV2 R4: the role a reviewer holds on a referral assignment (`referral_assignments
 * .assignment_role`, DB CHECK-enforced). PHI-free governance metadata.
 */
export type ReferralAssignmentRole =
  | 'referral_coordinator'
  | 'primary_reviewer'
  | 'secondary_reviewer'
  | 'clinical_reviewer'
  | 'legal_reviewer'
  | 'committee_chair'

/**
 * RV2 R4: an assignment's workflow status (`referral_assignments.status`, DB
 * CHECK-enforced; default `pending`). PHI-free. DISTINCT from {@link ReferralStatus}
 * (the referral lifecycle) — an assignment tracks ONE reviewer's task, not the
 * referral.
 */
export type ReferralAssignmentStatus =
  | 'pending'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

/**
 * RV2 R4: the typed relationship of a related-case pointer
 * (`referral_case_links.relationship_type`, DB CHECK-enforced). PHI-free. The link
 * is a POINTER ONLY — it grants NO access to the linked case.
 */
export type ReferralCaseRelationship =
  | 'related_case'
  | 'follow_up_case'
  | 'escalated_case'
  | 'duplicate_case'

/**
 * RDR (ADR 0109): the minimal lifecycle of a "Registro interno"
 * (`referral_internal_notes.status`, DB CHECK-enforced; default `open`). Mirrors
 * the case-narrative model minus the correction/revision flow: conclusion is
 * ONE-WAY and freezes the note — there is no reopen RPC, and redaction stays the
 * only post-conclusion correction (plan D10).
 */
export type ReferralNoteStatus = 'open' | 'concluded'

// ---------------------------------------------------------------------------
// pt-BR display labels (Rule 10) — UI maps the stored slug → label
// ---------------------------------------------------------------------------

/** pt-BR labels for the referral status chip / filter. */
export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  draft: 'Rascunho',
  sent: 'Enviada',
  received: 'Recebida',
  accepted: 'Aceita',
  rejected: 'Recusada',
  in_review: 'Em análise',
  awaiting_information: 'Aguardando informação',
  answered: 'Respondida',
  resolved: 'Resolvida',
  completed: 'Concluída',
  withdrawn: 'Retirada',
}

/**
 * Status → design-token name (Rule 10). The UI resolves a chip/badge variant
 * from this map rather than hard-coding a colour per status, keeping the
 * "Clinical Calm" palette centralized. Values are token keys the frontend maps
 * to its `Badge` variants — NOT raw colours.
 */
export const REFERRAL_STATUS_TOKENS: Record<ReferralStatus, string> = {
  draft: 'muted',
  sent: 'info',
  received: 'info',
  accepted: 'accent',
  rejected: 'destructive',
  in_review: 'warning',
  awaiting_information: 'warning',
  answered: 'info',
  resolved: 'success',
  completed: 'success',
  withdrawn: 'muted',
}

/** pt-BR labels for the message-type badge on the thread. */
export const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  general: 'Comentário',
  information_request: 'Solicitação de informação',
  information_response: 'Resposta',
  clarification: 'Esclarecimento',
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

/** pt-BR labels for the triage-priority badge / selector (RV2 R2). */
export const REFERRAL_PRIORITY_LABELS: Record<ReferralPriority, string> = {
  routine: 'Rotina',
  high: 'Alta',
  urgent: 'Urgente',
  critical: 'Crítica',
}

/** Priority → design-token name (Rule 10); the UI maps it to a `Badge` variant. */
export const REFERRAL_PRIORITY_TOKENS: Record<ReferralPriority, string> = {
  routine: 'muted',
  high: 'info',
  urgent: 'warning',
  critical: 'destructive',
}

/** pt-BR labels for the PHI-free structured decline reason (RV2 R2). */
export const REFERRAL_DECLINE_REASON_LABELS: Record<
  ReferralDeclineReasonCode,
  string
> = {
  outside_jurisdiction: 'Fora da competência da comissão',
  duplicate: 'Encaminhamento duplicado',
  wrong_committee: 'Comissão incorreta',
  insufficient_information: 'Informações insuficientes',
  conflict_of_interest: 'Conflito de interesse',
  other: 'Outro motivo',
}

/** pt-BR labels for the assignment-role badge / selector (RV2 R4). */
export const REFERRAL_ASSIGNMENT_ROLE_LABELS: Record<
  ReferralAssignmentRole,
  string
> = {
  referral_coordinator: 'Coordenação do encaminhamento',
  primary_reviewer: 'Revisor(a) principal',
  secondary_reviewer: 'Revisor(a) secundário(a)',
  clinical_reviewer: 'Revisor(a) clínico(a)',
  legal_reviewer: 'Revisor(a) jurídico(a)',
  committee_chair: 'Presidência da comissão',
}

/** pt-BR labels for the assignment-status badge (RV2 R4). */
export const REFERRAL_ASSIGNMENT_STATUS_LABELS: Record<
  ReferralAssignmentStatus,
  string
> = {
  pending: 'Pendente',
  accepted: 'Aceita',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
}

/** Assignment-status → design-token name (Rule 10); the UI maps it to a `Badge`
 * variant rather than hard-coding a colour. */
export const REFERRAL_ASSIGNMENT_STATUS_TOKENS: Record<
  ReferralAssignmentStatus,
  string
> = {
  pending: 'muted',
  accepted: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'muted',
}

/** pt-BR labels for the typed related-case relationship (RV2 R4). */
export const REFERRAL_CASE_RELATIONSHIP_LABELS: Record<
  ReferralCaseRelationship,
  string
> = {
  related_case: 'Caso relacionado',
  follow_up_case: 'Caso de acompanhamento',
  escalated_case: 'Caso escalado',
  duplicate_case: 'Caso duplicado',
}

/** pt-BR labels for the internal-registro status pill (RDR; ADR 0109). */
export const REFERRAL_NOTE_STATUS_LABELS: Record<ReferralNoteStatus, string> = {
  open: 'Aberto',
  concluded: 'Concluído',
}

/** Registro status → design-token name (Rule 10); the UI maps it to a pill variant. */
export const REFERRAL_NOTE_STATUS_TOKENS: Record<ReferralNoteStatus, string> = {
  open: 'warning',
  concluded: 'success',
}

/** The set of statuses that do NOT block source-case conclusion (Decision 5; RV2
 * R3 adds `resolved`). Mirrors the `close_case` HC076 gate's release set — the
 * block set is every OTHER reply-expected status, INCLUDING `answered` (A must
 * resolve first). Exported so the UI can label which in-flight referrals block. */
export const RESOLVED_REFERRAL_STATUSES: ReadonlySet<ReferralStatus> = new Set<
  ReferralStatus
>(['completed', 'resolved', 'rejected', 'withdrawn'])

/**
 * The statuses for which an SLA deadline can NEVER be overdue (RV2 R2; RV2 R3
 * adds the terminal `resolved`): a pre-flight `draft` (no deadline in play yet) OR
 * any terminal state. `answered` is NOT excluded — A still owes the resolution, so
 * a late confirmation is meaningfully overdue. The MIRROR of the SQL
 * `app.referral_is_overdue` exclusion set — keep the two in agreement.
 */
const OVERDUE_EXCLUDED_STATUSES: ReadonlySet<ReferralStatus> = new Set<
  ReferralStatus
>(['draft', 'completed', 'rejected', 'withdrawn', 'resolved'])

/**
 * Whether a referral's SLA deadline is overdue (RV2 R2). The TS mirror of the SQL
 * predicate `app.referral_is_overdue(response_due_at, status)`: a deadline strictly
 * in the past AND a status that is neither pre-flight nor terminal. A null deadline,
 * an unparseable one, or an excluded status is never overdue. PHI-free.
 *
 * NB the platform's phase-level `isOverdue` (`src/components/cases/format.ts`) is a
 * DATE-ONLY, `CasePhaseStatus`-typed helper — its signature does not fit a referral
 * `timestamptz` deadline + {@link ReferralStatus}, so this is a dedicated referral
 * helper carrying the same "overdue" concept, kept byte-for-byte in step with the SQL.
 */
export function isReferralOverdue(
  dueAt: string | null,
  status: ReferralStatus,
): boolean {
  if (!dueAt) return false
  if (OVERDUE_EXCLUDED_STATUSES.has(status)) return false
  const due = Date.parse(dueAt)
  if (Number.isNaN(due)) return false
  return due < Date.now()
}

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

/**
 * One `referral_requested_actions` row (RV2 R2) — the seeded, admin-managed
 * "what is asked of the target committee" vocabulary. PHI-FREE. The source
 * coordinator picks one when opening/editing a referral; the label is snapshotted
 * onto `case_referral.requested_action_label` so a later vocab edit never rewrites
 * history.
 */
export interface ReferralRequestedAction {
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
  /** RV2 R2: triage priority (PHI-free) — drives the priority badge + aging sort. */
  priority: ReferralPriority
  /** RV2 R2: snapshot of the requested-action label (PHI-free); `null` if none. */
  requestedActionLabel: string | null
  /** RV2 R2: the SLA deadline (PHI-free); `null` if none set. */
  responseDueAt: string | null
  /** RV2 R2: whether the deadline is overdue NOW (computed via
   * {@link isReferralOverdue}; never a stored flag). */
  overdue: boolean
  sourceCommissionId: string
  sourceCommissionName: string | null
  /** ADR 0094 W4 — `null` when {@link targetType} is `technical_director`. */
  targetCommissionId: string | null
  /** The destination's display name, already composed by the query layer (D5): a
   * commission's name, or `Direção Técnica — <hospital>`. */
  targetCommissionName: string | null
  targetType: ReferralTargetType
  /** ADR 0094 W4 — set iff {@link targetType} is `technical_director`. */
  targetHospitalId: string | null
  /** The source case's human number (for the read-back / linkage UI). */
  sourceCaseId: string
  sourceCaseNumber: number | null
  /** B's optional linked case (`null` until B links one). */
  targetCaseId: string | null
  targetCaseNumber: number | null
  /** Denormalized: an isolated PHI record exists (panel affordance gate). */
  hasPatient: boolean
  /** Whether a reply has been delivered (`completed`); the card shows it. */
  hasReply: boolean
  sentAt: string | null
  /** RV2 R1: last thread activity (PHI-free metadata) for the hub's
   * last-activity column; `null` if no message yet. Never a body preview. */
  lastMessageAt: string | null
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
  /** RV2 R2: triage priority (PHI-free metadata). */
  priority: ReferralPriority
  /** RV2 R2: the picked requested-action id (PHI-free); `null` if none. */
  requestedActionId: string | null
  /** RV2 R2: snapshot of the requested-action label (PHI-free); `null` if none. */
  requestedActionLabel: string | null
  /** RV2 R2: the SLA deadline (PHI-free); `null` if none set. */
  responseDueAt: string | null
  /** RV2 R2: whether the deadline is overdue NOW (computed, never stored). */
  overdue: boolean
  /** RV2 R2: PHI-FREE structured decline reason (distinct from the PHI
   * `declineNote`); set only on a `rejected` referral, `null` otherwise. */
  declineReasonCode: ReferralDeclineReasonCode | null
  /** RV2 R3: PHI-FREE lineage back-pointer to the referral this one was forwarded
   * from ("Encaminhar adiante"); `null` if not a child. D15 — a child shares
   * NOTHING from its parent automatically. */
  parentReferralId: string | null
  sourceCommissionId: string
  sourceCommissionName: string | null
  /** ADR 0094 W4 — `null` when {@link targetType} is `technical_director`. */
  targetCommissionId: string | null
  /** The destination's display name, already composed by the query layer (D5). */
  targetCommissionName: string | null
  targetType: ReferralTargetType
  /** ADR 0094 W4 — set iff {@link targetType} is `technical_director`. */
  targetHospitalId: string | null
  sourceCaseId: string
  sourceCaseNumber: number | null
  targetCaseId: string | null
  targetCaseNumber: number | null
  hasPatient: boolean
  createdById: string | null
  createdByName: string | null
  /** RV2 R1: the committee the referral is waiting on while `awaiting_information`
   * (= source or target); `null` otherwise. PHI-free metadata. */
  waitingOnCommitteeId: string | null
  /** ADR 0094 W4/D9: the DT-side counterpart of {@link waitingOnCommitteeId}. Exactly
   * one of the two is ever set — without this column "the technical direction is
   * holding this" was written as a NULL committee and read as "nobody is waiting". */
  waitingOnHospitalId: string | null
  /** RV2 R1: last thread activity (PHI-free); `null` if no message yet. */
  lastMessageAt: string | null
  /** RV2 R1: whether THIS viewer may compose as the SOURCE (= source coordinator).
   * Computed by the door with the exact `provide_referral_information` authority.
   * The composer gates "Responder" / source "Comentar" on this. PHI-free. */
  canComposeAsSource: boolean
  /** RV2 R1: whether THIS viewer may compose as the TARGET (= target coordinator OR
   * the assigned target analyst). Computed with the exact `post`/`request` authority.
   * The composer gates "Solicitar informação" / target "Comentar" on this. PHI-free. */
  canComposeAsTarget: boolean
  /** The frozen snapshot rows B reads (narratives + documents). */
  sharedItems: SharedItem[]
  /** RV2 R1: the ordered dialogue thread. Message `body` is PHI-bearing and is
   * `null` for a metadata-only reader (the audited door nulls it). */
  messages: ReferralMessage[]
  /** The delivered reply, or `null` until `answered`/`completed`. */
  reply: ReferralReply | null
  /** RV2 R3: the append-only resolution history (ordered by `resolutionNumber`);
   * empty until the source first `resolve`s. The non-PHI history is visible to
   * every metadata-tier reader; each row's PHI `summaryMd` is `null` unless the
   * viewer is a PHI reader. */
  resolutions: ReferralResolution[]
  /** RV2 R4: WHO is responsible on either side (PHI-free). Visible to every
   * metadata-tier reader; a row grants NO access — it is a task pointer only. */
  assignments: ReferralAssignment[]
  /** RV2 R4: TYPED related-case pointers (PHI-free). Each is a pointer ONLY — it
   * grants NO access to the linked case. */
  links: ReferralCaseLink[]
  /** RV2 R5: PHI-FREE read receipts (delivery/read/ack per message + user), visible to
   * every metadata-tier reader. Internal notes are NOT here — they are side-private and
   * loaded only via {@link listReferralInternalNotes}. */
  readReceipts: ReferralReadReceipt[]
  sentAt: string | null
  receivedAt: string | null
  decidedAt: string | null
  concludedAt: string | null
  withdrawnAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * One thread message (`referral_messages`), RV2 R1. Ordered by
 * {@link sequenceNumber}. The metadata (sender committee/user, type, timestamp) is
 * always present; {@link body} is PHI-bearing and arrives ONLY through the audited
 * detail door — `null` for a metadata-only reader.
 */
export interface ReferralMessage {
  id: string
  referralId: string
  sequenceNumber: number
  /** Which committee sent it (= source or target). */
  senderCommissionId: string
  senderCommissionName: string | null
  senderUserId: string | null
  senderUserName: string | null
  messageType: MessageType
  /** PHI-bearing message text; `null` for a metadata-only reader. RV2 R5: once the
   * message is redacted this is the literal string `'[redigido]'` (rendered by the
   * door to EVERY reader — the real body stays server-side, audited who/why). */
  body: string | null
  /** RV2 R5: when a coordinator redacted this message (append-only); `null` if not
   * redacted. PHI-free — drives the `[redigido]` badge. */
  redactedAt: string | null
  createdAt: string
}

/**
 * One private per-committee internal note (`referral_internal_notes`), RV2 R5. The
 * SECURITY KEYSTONE: a note is owned by exactly ONE committee side ({@link committeeId})
 * and is readable ONLY by a member of THAT side — source members never read a
 * target-owned note and vice-versa, and QPS reads NEITHER (K-R5-1, enforced by
 * `app.can_read_referral_internal_note` + column-REVOKED `body`). Loaded ONLY via the
 * audited {@link listReferralInternalNotes} door. {@link bodyMd} is PHI-bearing; once
 * redacted it renders `'[redigido]'` (the real body stays, append-only + audited).
 *
 * RDR (ADR 0109) promoted the note to a "Registro interno": it gains a title, a
 * type, an assignee and a one-way `open → concluded` lifecycle, and its body column
 * was renamed `body` → `body_md` (so the door's returned JSON key moved with it).
 * The type is now the SHARED case-Registro {@link CaseEventKind} vocabulary — the
 * per-commission `referral_note_types` table it originally pointed at is gone.
 */
export interface ReferralInternalNote {
  id: string
  referralId: string
  /** The OWNING committee side (source OR target). Only its members read this note. */
  committeeId: string
  authorUserId: string | null
  authorName: string | null
  /** Optional short heading; `null` for an untitled (or legacy) registro. */
  title: string | null
  /** The registro kind — the SAME six-value vocabulary as the case timeline's
   * `case_events.kind`. Required (DB default `note`); resolve the pt-BR label via
   * `CASE_EVENT_KIND_LABELS`. No snapshot column exists any more: the vocabulary is
   * fixed platform-wide, so there is nothing a later edit could rewrite. */
  kind: CaseEventKind
  /** PHI-bearing note text (sanitized Markdown — Rule 7); `'[redigido]'` once redacted. */
  bodyMd: string
  /** The member responsible for this registro; `null` when unassigned. */
  assignedTo: string | null
  assignedToName: string | null
  /** One-way lifecycle; `concluded` freezes the registro (no reopen — D10). */
  status: ReferralNoteStatus
  concludedAt: string | null
  concludedById: string | null
  concludedByName: string | null
  createdAt: string
  updatedAt: string
  /** When a coordinator redacted this note (append-only); `null` if not redacted. */
  redactedAt: string | null
  redactedById: string | null
  redactedByName: string | null
  /** PHI-free governance reason for the redaction; `null` if not redacted. */
  redactedReason: string | null
}

/**
 * "Who can read the case linked to this referral" — the payload of the audited
 * `get_referral_case_access_summary` door (ADR 0109 D3/D4). PHI-FREE: full names
 * only, never a reason, an expiry or a patient identifier.
 *
 * The case is SIDE-DERIVED from the `commissionId` the caller names (source →
 * `source_case_id`, target → `target_case_id`), never caller-chosen; the whole
 * summary is `null` when that side has no linked case yet.
 *
 * Group membership is decided by calling `app.has_case_capability(…,
 * 'read_case_content')` per candidate — so the roster is *definitionally* "the
 * people for whom `can_read_case` is true", grouped and de-duped into the highest
 * group in the order below. FIVE groups, not three (amendment A7): plain members
 * and org_admins confer other capability bits and therefore never appear.
 */
export interface ReferralCaseAccessSummary {
  /** The side-derived case this summary describes. */
  caseId: string
  /** Whether THIS viewer may open the case right now (their hat, ADR 0106 — a
   * person in the roster who is not currently wearing the role still appears
   * there while their own `canRead` reads false). */
  canRead: boolean
  /** S1 — staff_admins of the case's own commission. */
  coordinators: string[]
  /** S3 — live per-case grants (`case_access_grants`). */
  grantees: string[]
  /** S4 — phase + narrative assignees. */
  assignees: string[]
  /** S6 — patient-safety (PQS/NSP) operators of the case's hospital. */
  patientSafety: string[]
  /** S7 — quality reviewers of the case's hospital. */
  quality: string[]
}

// ---------------------------------------------------------------------------
// Synthesized thread events (RDR plan D7) — derived, never stored
// ---------------------------------------------------------------------------

/**
 * The discriminator of a synthesized system event on the Diálogo timeline (plan
 * D7). These rows are DERIVED from {@link ReferralDetail} fields the platform
 * already stores — there is no `referral_events` table and this phase adds none.
 */
export type ReferralThreadEventKind =
  | 'sent'
  | 'received'
  | 'decided_accepted'
  | 'decided_declined'
  | 'assignment'
  | 'case_linked'
  | 'resolution'
  | 'concluded'
  | 'withdrawn'

/** Fields every synthesized event carries. */
interface ReferralThreadEventBase {
  /** Stable, derivation-deterministic key (e.g. `sent`, `assignment:<id>`) — safe
   * as a React key and as an E2E anchor; NOT a database id. */
  id: string
  /** ISO timestamp the event is placed at. Exact for every kind except
   * `case_linked`, which is APPROXIMATE — see {@link ReferralCaseLinkedEvent}. */
  at: string
  /** Emission index within one synthesis run. Sorting is `(at, seq)`, so events
   * sharing a timestamp keep a fixed, reproducible order across runs instead of
   * depending on `Array.prototype.sort` stability. */
  seq: number
}

/** A pointed the referral at its destination (`sent_at`). */
export interface ReferralSentEvent extends ReferralThreadEventBase {
  kind: 'sent'
  /** The destination's display name (a composed Diretor Técnico name on a
   * `technical_director` referral, where `targetCommissionId` is null). */
  targetName: string | null
}

/** B acknowledged delivery (`received_at`). */
export interface ReferralReceivedEvent extends ReferralThreadEventBase {
  kind: 'received'
  targetName: string | null
}

/** B accepted (`decided_at` with a non-`rejected` status). */
export interface ReferralAcceptedEvent extends ReferralThreadEventBase {
  kind: 'decided_accepted'
}

/** B declined (`decided_at` + `status === 'rejected'`). PHI-free reason only —
 * the free-text `decline_note` is column-REVOKED and never reaches this module. */
export interface ReferralDeclinedEvent extends ReferralThreadEventBase {
  kind: 'decided_declined'
  reasonCode: ReferralDeclineReasonCode | null
  /** Pre-resolved pt-BR label for {@link reasonCode}; `null` when unset. */
  reasonLabel: string | null
}

/** Someone was made responsible on one side (`referral_assignments.assignedAt`). */
export interface ReferralAssignmentEvent extends ReferralThreadEventBase {
  kind: 'assignment'
  assignmentId: string
  assigneeName: string | null
  commissionId: string
  /** Which side the assignment sits on; `unknown` when the commission matches
   * neither (a DT referral leaves `targetCommissionId` null, so a match against
   * it can never be asserted). */
  side: 'source' | 'target' | 'unknown'
  role: ReferralAssignmentRole
  status: ReferralAssignmentStatus
}

/**
 * B linked one of its own cases to the referral (`target_case_id`).
 *
 * ⚠ APPROXIMATE TIMESTAMP. `case_referral` stores no `target_case_linked_at`, and
 * this phase deliberately does NOT invent one. The event is anchored at the latest
 * milestone the link provably FOLLOWS — `decidedAt ?? receivedAt ?? sentAt ??
 * createdAt` — so it can never sort before the referral existed, but it may sort
 * earlier than the link truly happened. {@link approximate} is always `true` so the
 * UI can render it as "em algum momento após …" rather than as a precise moment.
 */
export interface ReferralCaseLinkedEvent extends ReferralThreadEventBase {
  kind: 'case_linked'
  caseId: string
  caseNumber: number | null
  /** Always `true` — the anchor is derived, not stored. */
  approximate: true
}

/** A source-side resolution cycle was recorded (`referral_resolutions.resolvedAt`). */
export interface ReferralResolutionEvent extends ReferralThreadEventBase {
  kind: 'resolution'
  resolutionId: string
  resolutionNumber: number
  resolvedByName: string | null
  followUpRequired: boolean
}

/** The referral reached its terminal conclusion (`concluded_at`). */
export interface ReferralConcludedEvent extends ReferralThreadEventBase {
  kind: 'concluded'
}

/** A withdrew the referral (`withdrawn_at`). */
export interface ReferralWithdrawnEvent extends ReferralThreadEventBase {
  kind: 'withdrawn'
}

/**
 * One synthesized system row interleaved into the Diálogo thread (plan D7).
 * Produced ONLY by `synthesizeThreadEvents` in `@/lib/referrals/thread-events`,
 * from fields the audited detail door already returned — so an event can never
 * disclose more than its reader already holds.
 */
export type ReferralThreadEvent =
  | ReferralSentEvent
  | ReferralReceivedEvent
  | ReferralAcceptedEvent
  | ReferralDeclinedEvent
  | ReferralAssignmentEvent
  | ReferralCaseLinkedEvent
  | ReferralResolutionEvent
  | ReferralConcludedEvent
  | ReferralWithdrawnEvent

/**
 * One read receipt (`referral_read_receipts`) for a (message, user) pair, RV2 R5.
 * PHI-FREE — delivery/read/ack timestamps only. A user records ONLY their OWN receipt
 * (never forgeable — K-R5-5). Projected on {@link ReferralDetail.readReceipts} to every
 * metadata-tier reader; the UI derives per-message read/ack indicators from these.
 */
export interface ReferralReadReceipt {
  messageId: string
  userId: string
  userName: string | null
  deliveredAt: string | null
  readAt: string | null
  acknowledgedAt: string | null
}

/** The receipt event a reader records on a message (RV2 R5). `delivered` = the message
 * reached the reader's client; `read` = opened; `acknowledged` = explicitly confirmed. */
export type ReferralReceiptEvent = 'delivered' | 'read' | 'acknowledged'

/**
 * One frozen snapshot row (`referral_shared_item`). For a `narrative`,
 * {@link frozenBodyMd} holds the point-in-time `body_md` copy (PHI-bearing,
 * sanitized Markdown). For a `document` (DM4 / ADR 0114 Wave C), the freeze is a
 * binding to one immutable document VERSION on the core document model
 * ({@link frozenDocumentVersionId}); bytes are served only through the audited
 * `openReferralSnapshotDocument` action — no storage coordinate ever reaches
 * the client.
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
  frozenMimeType: string | null
  frozenSizeBytes: number | null
  /**
   * DM4: the immutable `document_versions` binding frozen at share time.
   * PHI-GATED in the projection (the 197 §4 asymmetry pin): a metadata-tier
   * reader receives `null` even when a binding exists. Never derive the open
   * affordance from this field — that is {@link canOpen}'s job.
   */
  frozenDocumentVersionId: string | null
  /**
   * DM4 (lane-consistency ruling): SERVER-computed — the audited snapshot door
   * (`openReferralSnapshotDocument`) would serve this item to the CURRENT
   * caller (PHI tier AND binding present AND not tombstoned AND source
   * servable). The exact twin of {@link ReferralReplyDocument.canOpen}: render
   * the open affordance iff `true`; render "indisponível" iff
   * {@link frozenTombstonedAt} is set. Always `false` for a `narrative`.
   * Never derive this client-side.
   */
  canOpen: boolean
  /**
   * DM4: set when the snapshot was reconciled away (legacy dangling row) or its
   * PHI was disposed — the snapshot row survives as a governance record but its
   * bytes are permanently unservable.
   */
  frozenTombstonedAt: string | null
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
  /**
   * @deprecated DM4 (ADR 0114 Wave C / PO ruling R1): the legacy
   * `referral_reply_attachment` lane. Zero rows exist and the table is dropped
   * in S3; always `[]` from then on. Render {@link replyDocuments} instead —
   * removed once S4 lands.
   */
  attachments: ReferralReplyAttachment[]
  /**
   * DM4: B-side reply attachments as referral-homed documents on the core
   * document model. Populated by `listReferralReplyDocuments`; bytes open via
   * `openReferralReplyAttachment` (audited door, short-TTL PHI credential).
   */
  replyDocuments: ReferralReplyDocument[]
  repliedById: string | null
  repliedByName: string | null
  repliedAt: string | null
}

/**
 * @deprecated DM4 (ADR 0114 Wave C): the legacy `referral_reply_attachment`
 * projection — the table is dropped in S3 and this type goes with it once S4
 * stops rendering it. Successor: {@link ReferralReplyDocument}.
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
 * One resolution-cycle row (`referral_resolutions`), RV2 R3. Append-only: each
 * source `resolve` inserts a row with the next {@link resolutionNumber}; a
 * `reopen` marks the active row ({@link reopenedAt}) and the next resolve appends
 * another. The non-PHI history (number, timestamps, follow-up, reopen info) is
 * visible to metadata-tier readers; {@link summaryMd} is PHI-bearing clinical free
 * text served ONLY through the audited detail door — `null` for a metadata reader.
 */
export interface ReferralResolution {
  id: string
  referralId: string
  /** 1-based, monotonically increasing per referral (append-only). */
  resolutionNumber: number
  /** The SOURCE commission that resolved (always the referral's source). */
  resolvedByCommissionId: string
  resolvedByUserId: string | null
  resolvedByName: string | null
  /** PHI-bearing resolution narrative (sanitized Markdown); `null` for a
   * metadata-only reader or when the source resolved without a summary. */
  summaryMd: string | null
  followUpRequired: boolean
  /** The `referral_reply` this resolution confirmed (`null` if none). */
  finalReplyId: string | null
  resolvedAt: string
  /** Set when this resolution was later reopened; `null` while it is the active
   * (current) resolution. */
  reopenedAt: string | null
  reopenedById: string | null
  reopenedReason: string | null
}

/**
 * One responsibility assignment on a referral (`referral_assignments`), RV2 R4.
 * PHI-FREE governance metadata — WHO is responsible on the source OR target side.
 * ASSIGNMENT ≠ ACCESS: holding this row grants NO read of the referral (the read
 * predicates do not consult it). Visible to any metadata-tier reader of the referral.
 */
export interface ReferralAssignment {
  id: string
  referralId: string
  /** The referral's source OR target commission (RPC-enforced). */
  commissionId: string
  assigneeUserId: string
  assigneeName: string | null
  assignmentRole: ReferralAssignmentRole
  status: ReferralAssignmentStatus
  /** Optional per-assignment due date (PHI-free); `null` if none. */
  dueAt: string | null
  assignedById: string | null
  assignedByName: string | null
  assignedAt: string
  completedAt: string | null
  cancelledAt: string | null
}

/**
 * One TYPED related-case pointer on a referral (`referral_case_links`), RV2 R4.
 * PHI-FREE. A POINTER ONLY — it grants NO access to {@link caseId}; the primary
 * target link remains `case_referral.target_case_id`. Visible to any metadata-tier
 * reader of the referral.
 */
export interface ReferralCaseLink {
  id: string
  referralId: string
  caseId: string
  /** The linked case's human number, if the reader may resolve it; `null` otherwise. */
  caseNumber: number | null
  /** The acting coordinator's side (source or target) that recorded the link. */
  commissionId: string
  relationshipType: ReferralCaseRelationship
  createdById: string | null
  createdByName: string | null
  createdAt: string
}

/**
 * One row of the CALLER's own assignments list ({@link listMyReferralAssignments},
 * RV2 R4) — an assignment joined to its referral's NON-PHI pointer metadata. Task
 * pointers ONLY: never any PHI (no bodies, no patient identifiers). Backs the
 * "Minhas atribuições de encaminhamento" list.
 */
export interface MyReferralAssignment {
  id: string
  referralId: string
  commissionId: string
  assignmentRole: ReferralAssignmentRole
  status: ReferralAssignmentStatus
  dueAt: string | null
  assignedById: string | null
  assignedAt: string
  completedAt: string | null
  cancelledAt: string | null
  /** PHI-free referral pointers (the task's referral, for the list row + link). */
  referralCode: string
  referralSubject: string
  referralStatus: ReferralStatus
  referralPriority: ReferralPriority
  referralResponseDueAt: string | null
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
  /** Not yet in a resolved state (`completed/rejected/withdrawn`). */
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
  /**
   * The committee B the case is referred to. `null` iff {@link targetHospitalId} is
   * set — the destination is a SUM TYPE (ADR 0094 W4 D7), and the RPC states the rule
   * two-sidedly so neither "both" nor "neither" can slip through.
   */
  targetCommissionId: string | null
  /**
   * ADR 0094 W4 — the hospital whose DIREÇÃO TÉCNICA is the destination. Set iff
   * {@link targetCommissionId} is null; the RPC then stamps
   * `target_type = 'technical_director'`.
   *
   * ⚠ Must be the SOURCE commission's own hospital (HC071 otherwise). A Diretor
   * Técnico is technically responsible for ONE hospital's committees; admitting a
   * committee of another hospital would hand that DT the PHI of a hospital they are
   * not responsible for. So this is never a free choice in the UI — it is the source
   * commission's hospital or nothing.
   */
  targetHospitalId?: string | null
  /** The chosen referral type (drives `type_label` snapshot + default reply). */
  referralTypeId: string
  /** PHI-free one-line subject. */
  subject: string
  /** Optional PHI-bearing free-text description (sanitized Markdown). */
  descriptionMd: string | null
  /** Whether a structured reply is expected (defaults from the type). */
  responseExpected: boolean
  /** RV2 R2: triage priority (PHI-free). OPTIONAL/additive — the RPC defaults to
   * `routine` when omitted, so pre-R2 FE callers keep compiling. */
  priority?: ReferralPriority
  /** RV2 R2: the picked requested-action id (PHI-free); omit/`null` for none. */
  requestedActionId?: string | null
  /** RV2 R2: an optional SLA deadline (ISO timestamp; PHI-free). A past date is
   * rejected by the RPC (HC0A4). */
  responseDueAt?: string | null
  /** RV2 R3: OPTIONAL parent-referral lineage ("Encaminhar adiante"). Additive —
   * omit/`null` for a root referral. The RPC validates the parent exists, is
   * same-organization, and is readable by the creator (HC0A6 otherwise); D15 — the
   * child shares NOTHING from the parent automatically. */
  parentReferralId?: string | null
}

/** Resolve a referral: the SOURCE coordinator formally confirms closure
 * (`answered → resolved`), appending a resolution row (RV2 R3). Authority-gated
 * (42501 for a non-source actor); requires `answered` (HC0A5 otherwise). */
export interface ResolveReferralInput {
  referralId: string
  /** OPTIONAL PHI-bearing resolution narrative (sanitized Markdown). */
  summaryMd?: string | null
  /** Whether a follow-up is still required (defaults false). */
  followUpRequired?: boolean
}

/** Reopen a resolved referral (`resolved → in_review`), marking the active
 * resolution reopened (RV2 R3). Authority-gated (42501); requires `resolved`
 * (HC0A5 otherwise). The reason is required. */
export interface ReopenReferralInput {
  referralId: string
  /** Required pt-BR reason for reopening (governance metadata, non-PHI). */
  reason: string
}

/** Editable draft fields (only while `draft`; HC070 otherwise). */
export interface UpdateReferralInput {
  referralTypeId: string
  subject: string
  descriptionMd: string | null
  responseExpected: boolean
  /** RV2 R2: triage priority (PHI-free; defaults `routine` when omitted). */
  priority?: ReferralPriority
  /** RV2 R2: the picked requested-action id (PHI-free); omit/`null` for none. */
  requestedActionId?: string | null
  /** RV2 R2: an optional SLA deadline (ISO timestamp; PHI-free). Past → HC0A4. */
  responseDueAt?: string | null
}

/** Set/update the SLA deadline on an in-flight referral (RV2 R2). Either
 * coordinator (source or target); non-terminal only; a past date → HC0A4. */
export interface SetReferralDeadlineInput {
  referralId: string
  /** ISO timestamp; `null` clears the deadline. */
  responseDueAt: string | null
}

/** Create one `referral_requested_actions` vocabulary row (RV2 R2; admin only —
 * HC0A3 otherwise). PHI-free. */
export interface CreateRequestedActionInput {
  key: string
  label: string
  description: string | null
  colorToken: string | null
  position: number
}

/** Edit one `referral_requested_actions` vocabulary row (RV2 R2; admin only —
 * HC0A3 otherwise). `isActive: false` soft-retires it. PHI-free. */
export interface UpdateRequestedActionInput {
  id: string
  label: string
  description: string | null
  colorToken: string | null
  position: number | null
  isActive: boolean | null
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
  /** Optional short pt-BR note shown to the source (PHI-bearing free text). */
  note: string | null
  /** RV2 R2: optional PHI-FREE structured decline reason (shown to metadata-tier
   * readers; distinct from the PHI-gated {@link note}). OPTIONAL/additive. */
  declineReasonCode?: ReferralDeclineReasonCode | null
}

/** Post a free-form thread message (RV2 R1 — "Comentar"). The RPC gates a PHI
 * reader who resolves to the source/target side (HC0A0) + a non-terminal status. */
export interface PostReferralMessageInput {
  referralId: string
  messageType: MessageType
  /** PHI-bearing message text (required, non-blank). */
  body: string
}

/** Target coordinator/analyst asks the source a clarifying question (RV2 R1 —
 * "Solicitar informação"). Sets `awaiting_information`, waiting-on = source. The
 * RPC requires `in_review` (HC0A1). */
export interface RequestReferralInfoInput {
  referralId: string
  /** PHI-bearing request text (required, non-blank). */
  body: string
}

/** Source coordinator answers a pending request (RV2 R1 — "Responder"). Sets
 * waiting-on = target and resumes `in_review`. The RPC requires
 * `awaiting_information` (HC0A1). */
export interface ProvideReferralInfoInput {
  referralId: string
  /** PHI-bearing response text (required, non-blank). */
  body: string
}

/** Assign a reviewer to a referral on one side (RV2 R4). The actor must be a
 * coordinator of `commissionId`'s side (source or target) — the RPC raises 42501
 * for any other actor (checked FIRST), and HC0A7 for an invalid commission/role or
 * a non-member assignee. `commissionId` must be the referral's source OR target. */
export interface AssignReferralReviewerInput {
  referralId: string
  /** The referral's source OR target commission (the assignee's side). */
  commissionId: string
  assigneeUserId: string
  assignmentRole: ReferralAssignmentRole
  /** Optional per-assignment due date (ISO timestamp; PHI-free). */
  dueAt?: string | null
}

/** Edit an assignment's status / due / role (RV2 R4). Coordinator of the
 * assignment's commission side only (42501 otherwise, checked FIRST); an invalid
 * status/role is HC0A7. All fields optional — omit to leave unchanged. */
export interface UpdateReferralAssignmentInput {
  assignmentId: string
  status?: ReferralAssignmentStatus | null
  dueAt?: string | null
  assignmentRole?: ReferralAssignmentRole | null
}

/** Record a TYPED related-case pointer on a referral (RV2 R4). The actor must be a
 * coordinator of EITHER side (42501 otherwise); the relationship must be valid, the
 * case must exist, and the (referral, case, relationship) triple must be unique
 * (HC0A8 otherwise). Grants NO access to `caseId` — a pointer only. */
export interface LinkReferralRelatedCaseInput {
  referralId: string
  caseId: string
  relationshipType: ReferralCaseRelationship
}

/** Create a private internal note on ONE committee side (RV2 R5). The actor must be a
 * member of `committeeId` (which must be the referral's source OR target) — the RPC
 * raises 42501 for any other actor (checked FIRST); a blank body raises HC0A9. The
 * note is readable ONLY by members of `committeeId` (K-R5-1). */
export interface CreateReferralInternalNoteInput {
  referralId: string
  /** The OWNING committee side (referral source OR target); the actor must be a member. */
  committeeId: string
  /** PHI-bearing note text (required, non-blank; sanitized Markdown — Rule 7). */
  bodyMd: string
  /** Optional short heading; blank/`null` stores NULL. */
  title?: string | null
  /** The registro kind (shared case vocabulary). Omitted/blank defaults to `note`;
   * a value outside the six raises HC0A9. */
  kind?: CaseEventKind
  /** Optional responsible member; must be an ACTIVE member of `committeeId` (HC0A9). */
  assignedTo?: string | null
}

/**
 * Edit an OPEN registro in place (RDR; ADR 0109). The actor must be the author,
 * the assignee, or a coordinator of the note's OWN side (42501 otherwise, checked
 * FIRST); a concluded or redacted registro refuses with HC0A9.
 *
 * `title` is a CLEARING field — a blank/`null` title stores NULL. `kind` is NOT:
 * it is required, so an omitted value falls back to `note` rather than clearing.
 */
export interface UpdateReferralInternalNoteInput {
  noteId: string
  /** New heading; blank/`null` clears it. */
  title: string | null
  /** New PHI-bearing body (required, non-blank). */
  bodyMd: string
  /** New registro kind (shared case vocabulary); omitted/blank falls back to `note`. */
  kind: CaseEventKind
}

/** Redact a private internal note (RV2 R5 — append-only). The actor must be a
 * coordinator of the note's OWNING side (42501 otherwise, checked FIRST); an
 * already-redacted note raises HC0A9. Sets who/why + renders `[redigido]`; the real
 * body is retained server-side, distinct from disposal (which purges). */
export interface RedactReferralNoteInput {
  noteId: string
  /** PHI-free governance reason for the redaction. */
  reason: string
}

/** Redact a thread message (RV2 R5 — append-only). The actor must be a coordinator of
 * EITHER side (42501 otherwise, checked FIRST); an already-redacted message raises
 * HC0A9. Renders `[redigido]` via the detail door; the real body is retained. */
export interface RedactReferralMessageInput {
  messageId: string
  /** PHI-free governance reason for the redaction. */
  reason: string
}

/** Record the caller's OWN receipt on a message (RV2 R5). The actor must be a
 * metadata-tier reader of the message's referral (42501 otherwise). Self-scoped — a
 * user can never forge another's receipt (K-R5-5). */
export interface RecordReferralReceiptInput {
  messageId: string
  event: ReferralReceiptEvent
}

// ---------------------------------------------------------------------------
// DM4 (ADR 0114 Wave C) — referral documents on the core document model
// ---------------------------------------------------------------------------

/**
 * Machine-readable failure codes for the DM4 referral-document surface
 * (`beginReferralReplyAttachmentUpload` / `finalizeReferralReplyAttachmentUpload` /
 * `openReferralReplyAttachment` / `openReferralSnapshotDocument`).
 *
 * The DM2 contract discipline (`DocumentActionErrorCode` precedent): the server
 * maps SQLSTATEs to these codes ON CODE ALONE — never message text — and the UI
 * owns the pt-BR wording. Raw Postgres/Supabase errors never reach the UI
 * (Rule 10). The legacy referral actions' pt-BR-string `ReferralActionState`
 * pattern is NOT extended to this surface.
 */
export type ReferralDocumentErrorCode =
  | 'module_disabled' // a gating flag is off (documents / documents_wave_c / case_referrals)
  | 'not_found' // absence ≡ denial, deliberately indistinguishable
  | 'forbidden' // authenticated but not authorized (incl. metadata-tier reader denied bytes)
  | 'referral_wrong_state' // the referral's status refuses this action (e.g. upload after conclusion)
  | 'not_target_coordinator' // reply attachments are B-side only
  | 'snapshot_unavailable' // frozen snapshot tombstoned / legacy-dangling / never bound
  | 'upload_expired' // the reservation lapsed; begin again
  | 'upload_incomplete' // no verified object behind the session; retry the PUT
  | 'file_too_large'
  | 'file_type_not_allowed'
  | 'invalid_input' // vocabulary/validation refusals
  | 'unavailable' // the version is not servable right now
  | 'disposed' // disposition requested/completed (file- or referral-PHI disposal)
  | 'unknown'

/**
 * One B-side reply attachment as a referral-homed document (DM4 / PO ruling
 * R1). Projection only — NO storage coordinates (ADR 0114 D8); bytes move
 * exclusively through the short-TTL credential minted by
 * `openReferralReplyAttachment`.
 */
export interface ReferralReplyDocument {
  documentId: string
  /** The version the open action serves (reply attachments are single-version
   * by product shape; a re-upload is a NEW document). */
  documentVersionId: string
  title: string
  mimeType: string | null
  sizeBytes: number | null
  availability: DocumentAvailability
  /**
   * SERVER-computed: the audited open door would serve this version to the
   * CURRENT caller. This is where the two-tier referral asymmetry becomes
   * visible in the UI: a metadata-tier reader sees the row with
   * `canOpen: false`; only a `can_read_referral_phi` reader gets `true`.
   * Never derive this client-side.
   */
  canOpen: boolean
  uploadedById: string | null
  uploadedByName: string | null
  createdAt: string
}

/**
 * Input to `beginReferralReplyAttachmentUpload`. Note the ABSENT fields —
 * bucket, path, tier, hash, home resource type/id — ALL server-derived
 * (ADR 0114 D8/D9): the home is resolved FROM the referral id server-side and
 * the tier is pinned `phi`. Size/MIME caps mirror the document module —
 * clients pre-check against `DOCUMENT_MAX_SIZE_BYTES` /
 * `DOCUMENT_ACCEPTED_MIME_TYPES` from `@/lib/documents/types`.
 */
export interface BeginReferralReplyUploadInput {
  referralId: string
  /** Contractually non-PHI (ADR 0114 D12) — show the naming guidance. */
  title: string
  /** HINTS for validation caps only; finalize re-derives server-side (D9). */
  declaredFileName: string
  declaredMimeType: string
  declaredSizeBytes: number
}

/** Result of `beginReferralReplyAttachmentUpload`. The credential contract is
 * the document module's (`DocumentUploadCredential`): the client island PUTs
 * the bytes via `uploadDocumentFile` from `@/lib/documents/upload-client`. */
export type BeginReferralReplyUploadResult =
  | {
      ok: true
      uploadSessionId: string
      documentId: string
      documentVersionId: string
      upload: DocumentUploadCredential
    }
  | { ok: false; error: ReferralDocumentErrorCode }

/** Result of `finalizeReferralReplyAttachmentUpload`. `terminal: true` mirrors
 * the document module's MAJOR-3 contract: the object landed but failed byte
 * verification — never offer "Tentar novamente"; only a new upload recovers. */
export type FinalizeReferralReplyUploadResult =
  | {
      ok: true
      documentId: string
      documentVersionId: string
      availability: DocumentAvailability
    }
  | { ok: false; error: ReferralDocumentErrorCode; terminal?: true }

/**
 * Result of the two DM4 byte doors (`openReferralReplyAttachment` /
 * `openReferralSnapshotDocument`): a short-TTL signed download URL (PHI tier,
 * 120 s — ADR 0114 O4), minted ONLY after the audited DEFINER door authorized
 * the caller. Invoke at CLICK time — a render-time URL is expired before the
 * user reaches it.
 */
export type OpenReferralFileResult =
  | { ok: true; url: string; expiresAt: string; fileName: string | null }
  | { ok: false; error: ReferralDocumentErrorCode }
