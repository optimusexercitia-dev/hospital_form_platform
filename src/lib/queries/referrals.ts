/**
 * Inter-Committee Case Referrals data-access (Phase 22 — `case_referrals`;
 * Architecture Rule 9 — all reads go through `src/lib/queries/`; Rule 12 —
 * PHI/HIPAA handling; ADR 0037). Backs the per-commission "Encaminhamentos" hub
 * (`c/[slug]/encaminhamentos`), the case-detail outbound-referrals card, the
 * B-side referral detail, the QPS `/o/[org]/nsp/encaminhamentos` dashboard (per-org,
 * ADR 0042), and the Phase-12 case timeline.
 *
 * The domain TYPES are the FROZEN contract the frontend builds against; they live
 * in the CLIENT-SAFE `@/lib/referrals/types` (ZERO imports) and are re-exported
 * here so existing `import … from '@/lib/queries/referrals'` consumers resolve
 * unchanged WITHOUT a `"use client"` component dragging this server-only module
 * (→ `@/lib/supabase/server` → `next/headers`) into the client bundle.
 *
 * RLS / PHI (the security boundary — Rule 1 + Rule 12):
 *  - The metadata + snapshot reads are RLS-scoped via `app.can_read_referral`
 *    (source member OR target member OR QPS) — a foreign committee reads NOTHING,
 *    so the list/detail reads go through the ordinary RLS-scoped cookie client.
 *  - {@link getReferralPatient} is the AUDITED PHI door: direct SELECT on
 *    `referral_patient` is REVOKED, so it routes through the `get_referral_patient`
 *    SECURITY DEFINER RPC, which re-gates with the TIGHT `can_read_referral_phi`
 *    predicate and emits a `referral_patient.read` audit row server-side.
 *  - Snapshot documents reference A's existing `case-documents` object (Rule 6).
 *    B is not a member of A's commission, so the `case-documents` SELECT policy
 *    grants B the read ONLY via the flag-gated snapshot OR-term keyed on
 *    `can_read_referral_phi`. {@link getReferralDocumentUrl} re-gates + audits via
 *    the DEFINER path-authorizer RPC, then signs with the NORMAL cookie client
 *    (no service-role; RLS stays the boundary — lead decision).
 *  - The QPS aggregate ({@link listAllReferrals} / {@link referralFlowMetrics}) is
 *    gated on `is_pqs_member_self()` (duty separation, ADR 0030/0031): a non-PQS
 *    admin gets NOTHING from them even though the dashboard URL is admin-gated.
 */

import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { getEventPatient } from '@/lib/queries/safety-events'
import { getCasePatient } from '@/lib/queries/cases'
import { featureEnabled } from '@/lib/queries/feature-flags'
import type { Page, PageParams, CursorSchema } from '@/lib/types/pagination'
import {
  DEFAULT_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
} from '@/lib/types/pagination'
import {
  isReferralOverdue,
} from '@/lib/referrals/types'
import type {
  MessageType,
  MyReferralAssignment,
  ReferralAssignment,
  ReferralAssignmentRole,
  ReferralAssignmentStatus,
  ReferralCaseLink,
  ReferralCaseRelationship,
  ReferralDashboardFilters,
  ReferralDeclineReasonCode,
  ReferralDetail,
  ReferralDirection,
  ReferralFlowMetrics,
  ReferralInternalNote,
  ReferralListItem,
  ReferralMessage,
  ReferralPatient,
  ReferralPatientSex,
  ReferralPriority,
  ReferralReadReceipt,
  ReferralReply,
  ReferralRequestedAction,
  ReferralResolution,
  ReferralStatus,
  ReferralTargetType,
  ReferralType,
  ReplyOutcome,
  SharedItem,
  SharedItemKind,
} from '@/lib/referrals/types'

// Re-export the CLIENT-SAFE domain types + label maps so server callers and
// `"use client"` components share one import surface (the safety-events pattern).
export type {
  ReferralStatus,
  ReferralTargetType,
  SharedItemKind,
  ReferralPatientSex,
  ReferralDirection,
  ReferralPriority,
  ReferralDeclineReasonCode,
  ReferralType,
  ReplyOutcome,
  ReferralRequestedAction,
  ReferralListItem,
  ReferralDetail,
  SharedItem,
  ReferralReply,
  ReferralReplyAttachment,
  ReferralResolution,
  ReferralAssignment,
  ReferralAssignmentRole,
  ReferralAssignmentStatus,
  ReferralCaseLink,
  ReferralCaseRelationship,
  MyReferralAssignment,
  ReferralPatient,
  ReferralDashboardFilters,
  ReferralFlowMetrics,
} from '@/lib/referrals/types'
export {
  REFERRAL_STATUS_LABELS,
  REFERRAL_STATUS_TOKENS,
  REFERRAL_PRIORITY_LABELS,
  REFERRAL_PRIORITY_TOKENS,
  REFERRAL_DECLINE_REASON_LABELS,
  REFERRAL_ASSIGNMENT_ROLE_LABELS,
  REFERRAL_ASSIGNMENT_STATUS_LABELS,
  REFERRAL_ASSIGNMENT_STATUS_TOKENS,
  REFERRAL_CASE_RELATIONSHIP_LABELS,
  SHARED_ITEM_KIND_LABELS,
  REFERRAL_PATIENT_SEX_LABELS,
  REFERRAL_DIRECTION_LABELS,
  RESOLVED_REFERRAL_STATUSES,
  isReferralOverdue,
} from '@/lib/referrals/types'

const SIGNED_URL_TTL_SECONDS = 3600

// ---------------------------------------------------------------------------
// Row shapes (PostgREST embeds) + mappers — PHI-FREE on the list path
// ---------------------------------------------------------------------------

/** The PHI-free list/card select: governance metadata + denormalized flags. NOTE:
 * `hasReply` is derived from `status === 'completed'` (PHI-free, on case_referral),
 * NOT from a `referral_reply` embed — that table's SELECT policy is tightened to
 * `can_read_referral_phi` (Phase-22 body lockdown, migration …015000), so a plain
 * member's embed would return empty and mis-report the reply existence. `status` is
 * the correct PHI-free signal every reader sees (a reply exists iff `completed`). */
const REFERRAL_LIST_SELECT =
  'id, code, status, subject, type_label, response_expected, ' +
  'priority, requested_action_label, response_due_at, ' +
  'source_commission_id, target_commission_id, source_case_id, target_case_id, ' +
  'has_patient, sent_at, last_message_at, created_at, referral_type_id, ' +
  'source_commission_name, target_commission_name, ' +
  // ADR 0094 W4 — the target sum type. `authenticated` holds COLUMN-level SELECT on
  // case_referral, so each of these needs its own GRANT server-side or the whole
  // select reads 42501 at runtime (the migration grants them).
  'target_type, target_hospital_id, target_hospital_name, ' +
  'source_case:source_case_id(case_number), ' +
  'target_case:target_case_id(case_number), ' +
  'referral_type:referral_type_id(color_token)'

interface ReferralListRow {
  id: string
  code: string
  status: string
  subject: string
  type_label: string
  response_expected: boolean
  priority: string
  requested_action_label: string | null
  response_due_at: string | null
  source_commission_id: string
  /** NULL on a `technical_director` row — the target is a hospital's office. */
  target_commission_id: string | null
  source_case_id: string
  target_case_id: string | null
  has_patient: boolean
  sent_at: string | null
  last_message_at: string | null
  created_at: string
  referral_type_id: string | null
  source_commission_name: string | null
  target_commission_name: string | null
  target_type: ReferralTargetType
  target_hospital_id: string | null
  target_hospital_name: string | null
  source_case: { case_number: number } | null
  target_case: { case_number: number } | null
  referral_type: { color_token: string | null } | null
}

/**
 * ADR 0094 W4/D5 — THE one place a referral's target renders as a name (Rule 9).
 *
 * A DT referral's destination is an OFFICE, so the DB snapshots the hospital's name
 * (`target_hospital_name`) and nothing else: not the commission-name column, which
 * would then be a column holding a hospital name, and not the director's own name,
 * which is Class-2 professional identity and goes stale the instant the office changes
 * (D4). Composing the pt-BR label is presentation, so it happens here rather than in
 * SQL — and here ONLY, because every reader (case card, hub, QPS dashboard, flow
 * charts) goes through this mapper. Without it the QPS dashboard renders "—" for the
 * destination of every DT referral, which is precisely the trajectory D5 exists to
 * keep visible.
 */
function referralTargetName(r: {
  target_type: ReferralTargetType
  target_commission_name: string | null
  target_hospital_name: string | null
}): string | null {
  if (r.target_type !== 'technical_director') return r.target_commission_name
  return r.target_hospital_name
    ? `Direção Técnica — ${r.target_hospital_name}`
    : 'Direção Técnica'
}

/** Map a list row → {@link ReferralListItem}, computing `direction` per the
 * viewing commission (`null` viewer = QPS dashboard, where direction is shown as
 * source→target, defaulting to `outgoing`). */
function mapReferralListItem(
  r: ReferralListRow,
  viewerCommissionId: string | null,
): ReferralListItem {
  const direction: ReferralDirection =
    viewerCommissionId !== null && r.target_commission_id === viewerCommissionId
      ? 'incoming'
      : 'outgoing'
  return {
    id: r.id,
    code: r.code,
    direction,
    status: r.status as ReferralStatus,
    subject: r.subject,
    typeLabel: r.type_label,
    typeColorToken: r.referral_type?.color_token ?? null,
    responseExpected: r.response_expected,
    priority: r.priority as ReferralPriority,
    requestedActionLabel: r.requested_action_label,
    responseDueAt: r.response_due_at,
    // Overdue is COMPUTED (never a stored flag) — the TS mirror of the SQL
    // app.referral_is_overdue predicate.
    overdue: isReferralOverdue(r.response_due_at, r.status as ReferralStatus),
    sourceCommissionId: r.source_commission_id,
    sourceCommissionName: r.source_commission_name,
    targetCommissionId: r.target_commission_id,
    targetCommissionName: referralTargetName(r),
    targetType: r.target_type,
    targetHospitalId: r.target_hospital_id,
    sourceCaseId: r.source_case_id,
    sourceCaseNumber: r.source_case?.case_number ?? null,
    targetCaseId: r.target_case_id,
    targetCaseNumber: r.target_case?.case_number ?? null,
    hasPatient: r.has_patient,
    // A delivered reply exists iff the referral concluded (PHI-free signal); the
    // referral_reply table is now PHI-gated so we must NOT rely on an embed here.
    hasReply: r.status === 'completed',
    sentAt: r.sent_at,
    lastMessageAt: r.last_message_at,
    createdAt: r.created_at,
  }
}

// ---------------------------------------------------------------------------
// Feature-flag probe
// ---------------------------------------------------------------------------

/** Whether the `case_referrals` feature flag is ON (probes `referrals_enabled`).
 * Gates every referral surface; `false` on any error (fail-closed). */
export async function referralsEnabled(): Promise<boolean> {
  // P4 (WS-6): delegate to the consolidated, request-memoized flag read. NB the
  // flag KEY is `case_referrals` (the RPC was `referrals_enabled`).
  return featureEnabled('case_referrals')
}

// ---------------------------------------------------------------------------
// Hub + case-card lists (PHI-FREE)
// ---------------------------------------------------------------------------

/**
 * The per-commission hub list — referrals this commission SENT (`outgoing`) OR
 * RECEIVED (`incoming`), newest-first, each tagged with its direction. RLS-scoped
 * (the `case_referral` SELECT policy = source/target member OR QPS); we additionally
 * bound to the source/target commission so a QPS member browsing a commission hub
 * sees that commission's referrals, not the whole org. PHI-free.
 */
/** The keyset sort-tuple encoded in a `listCommissionReferrals` cursor. Private; opaque. */
interface ReferralCursor {
  /** `created_at` of the last row. */
  c: string
  /** `id` of the last row (tie-breaker). */
  id: string
}

/** Validation schema for the cursor fields (WS-6 QA hardening): timestamp + uuid,
 * structurally excluding the `.or()` metacharacters. Tampered → cursor rejected. */
const REFERRAL_CURSOR_SCHEMA: CursorSchema<ReferralCursor> = {
  c: 'timestamp',
  id: 'uuid',
}

export async function listCommissionReferrals(
  commissionId: string,
  page?: PageParams,
): Promise<Page<ReferralListItem>> {
  const supabase = await createClient()

  const limit = page?.limit ?? DEFAULT_PAGE_SIZE
  const cursor = decodeCursor<ReferralCursor>(page?.cursor, REFERRAL_CURSOR_SCHEMA)

  // Keyset (WS-6 P3): (created_at DESC, id DESC). The commission-membership OR-group
  // and the cursor OR-group are two separate `.or()` calls → PostgREST ANDs them, so
  // the result is (source OR target) AND (after-cursor) — the intended semantics.
  //
  // Drafts are EXCLUDED in BOTH directions: an unsent draft belongs only to the
  // authoring case's detail card ({@link listCaseOutboundReferrals} is the sole
  // legitimate draft surface). The hub lists referrals that are actually in flight.
  // (RLS now also hides another committee's drafts — this is the product rule, not
  // the security boundary.)
  let query = supabase
    .from('case_referral')
    .select(REFERRAL_LIST_SELECT)
    .neq('status', 'draft')
    .or(
      `source_commission_id.eq.${commissionId},target_commission_id.eq.${commissionId}`,
    )

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.c},` +
        `and(created_at.eq.${cursor.c},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)
    .returns<ReferralListRow[]>()

  if (error) {
    console.error('[listCommissionReferrals] query failed', {
      commissionId,
      code: error.code,
      message: error.message,
    })
    return { rows: [], nextCursor: null }
  }

  const fetched = data ?? []
  const hasMore = fetched.length > limit
  const pageRows = hasMore ? fetched.slice(0, limit) : fetched

  const rows = pageRows.map((r) => mapReferralListItem(r, commissionId))

  const last = pageRows[pageRows.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeCursor({ c: last.created_at, id: last.id } satisfies ReferralCursor)
      : null

  return { rows, nextCursor }
}

/**
 * The technical-direction inbox for ONE hospital (ADR 0094 W4 / FUP-MEM-3b) —
 * every non-draft referral addressed to that hospital's Diretor Técnico,
 * newest-first. PHI-free (the same governance-metadata projection as the commission
 * hub).
 *
 * Always `incoming`: the office is a destination only. It cannot appear as a source,
 * because `create_referral_draft` gates the send on coordinating the SOURCE
 * COMMISSION — an office with no commission can never author one. So the direction is
 * set here rather than derived, and {@link mapReferralListItem}'s viewer argument is
 * `null` because its commission comparison has nothing to compare against.
 *
 * RLS is the authority: `case_referral`'s SELECT policy admits the technical direction
 * of `target_hospital_id` (titular AND deputy — D1) once the referral is past `draft`.
 * The `target_type` / `target_hospital_id` filters below are the PRODUCT scope, not
 * the security boundary — a DT of another hospital gets `[]` from RLS regardless.
 */
export async function listTechnicalDirectionReferrals(
  hospitalId: string,
  page?: PageParams,
): Promise<Page<ReferralListItem>> {
  const supabase = await createClient()

  const limit = page?.limit ?? DEFAULT_PAGE_SIZE
  const cursor = decodeCursor<ReferralCursor>(page?.cursor, REFERRAL_CURSOR_SCHEMA)

  let query = supabase
    .from('case_referral')
    .select(REFERRAL_LIST_SELECT)
    .neq('status', 'draft')
    .eq('target_type', 'technical_director')
    .eq('target_hospital_id', hospitalId)

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.c},` +
        `and(created_at.eq.${cursor.c},id.lt.${cursor.id})`,
    )
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)
    .returns<ReferralListRow[]>()

  if (error) {
    console.error('[listTechnicalDirectionReferrals] query failed', {
      hospitalId,
      code: error.code,
      message: error.message,
    })
    return { rows: [], nextCursor: null }
  }

  const fetched = data ?? []
  const hasMore = fetched.length > limit
  const pageRows = hasMore ? fetched.slice(0, limit) : fetched

  const rows = pageRows.map((r) => ({
    ...mapReferralListItem(r, null),
    direction: 'incoming' as const,
  }))

  const last = pageRows[pageRows.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeCursor({ c: last.created_at, id: last.id } satisfies ReferralCursor)
      : null

  return { rows, nextCursor }
}

/**
 * The outbound referrals OF one source case (the case-detail card), newest-first.
 * Always `direction: 'outgoing'`. RLS-scoped; PHI-free.
 */
export async function listCaseOutboundReferrals(
  caseId: string,
): Promise<ReferralListItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('case_referral')
    .select(REFERRAL_LIST_SELECT)
    .eq('source_case_id', caseId)
    .order('created_at', { ascending: false })
    .returns<ReferralListRow[]>()

  if (error) {
    // A failed list read must be diagnosable — without this the card silently shows
    // zero referrals (the swallowed-error anti-pattern). Surfaces e.g. a stale
    // PostgREST schema cache after a migration (PGRST204) or an RLS denial.
    console.error('[listCaseOutboundReferrals] query failed', {
      caseId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
  }

  // The viewer is the source commission here (the case's own commission), so every
  // row is outgoing — pass each row's source id so direction resolves to 'outgoing'.
  return (data ?? []).map((r) => mapReferralListItem(r, r.source_commission_id))
}

/**
 * The actionable-count badge for the commission's nav. Counts referrals needing
 * this commission's attention: incoming awaiting receive/accept/reply
 * (`sent/received/accepted/in_review` where this commission is the target).
 * PHI-free.
 *
 * The former outgoing-DRAFTS arm was dropped: drafts no longer surface in the
 * encaminhamentos hub at all (they live only on the authoring case's detail card),
 * so counting them here badged a number the hub could not explain.
 */
export async function countCommissionReferralActionable(
  commissionId: string,
): Promise<number> {
  const supabase = await createClient()
  // Incoming, awaiting this committee's action.
  const incoming = await supabase
    .from('case_referral')
    .select('id', { count: 'exact', head: true })
    .eq('target_commission_id', commissionId)
    .in('status', ['sent', 'received', 'accepted', 'in_review'])

  return incoming.count ?? 0
}

// ---------------------------------------------------------------------------
// Audited detail doors
// ---------------------------------------------------------------------------

interface ReferralDetailJson {
  id: string
  code: string
  status: string
  subject: string
  description_md: string | null
  referral_type_id: string | null
  type_label: string
  response_expected: boolean
  priority: string
  requested_action_id: string | null
  requested_action_label: string | null
  response_due_at: string | null
  decline_reason_code: string | null
  parent_referral_id: string | null
  source_commission_id: string
  source_commission_name: string | null
  /** NULL on a `technical_director` row — the target is a hospital's office. */
  target_commission_id: string | null
  target_commission_name: string | null
  target_type: ReferralTargetType
  target_hospital_id: string | null
  target_hospital_name: string | null
  source_case_id: string
  source_case_number: number | null
  target_case_id: string | null
  target_case_number: number | null
  has_patient: boolean
  created_by: string | null
  created_by_name: string | null
  decline_note: string | null
  waiting_on_committee_id: string | null
  /** ADR 0094 W4/D9 — the DT-side counterpart; "the DT is holding this". */
  waiting_on_hospital_id: string | null
  last_message_at: string | null
  can_compose_as_source: boolean
  can_compose_as_target: boolean
  messages: {
    id: string
    referral_id: string
    sequence_number: number
    sender_commission_id: string
    sender_commission_name: string | null
    sender_user_id: string | null
    sender_user_name: string | null
    message_type: string
    body: string | null
    redacted_at: string | null
    created_at: string
  }[]
  shared_items: {
    id: string
    referral_id: string
    kind: string
    source_narrative_id: string | null
    source_document_id: string | null
    frozen_title: string | null
    frozen_body_md: string | null
    frozen_storage_path: string | null
    frozen_mime_type: string | null
    frozen_size_bytes: number | null
    position: number
  }[]
  resolutions: {
    id: string
    referral_id: string
    resolution_number: number
    resolved_by_commission_id: string
    resolved_by_user_id: string | null
    resolved_by_name: string | null
    summary_md: string | null
    follow_up_required: boolean
    final_reply_id: string | null
    resolved_at: string
    reopened_at: string | null
    reopened_by: string | null
    reopened_reason: string | null
  }[]
  assignments: {
    id: string
    referral_id: string
    commission_id: string
    assignee_user_id: string
    assignee_name: string | null
    assignment_role: string
    status: string
    due_at: string | null
    assigned_by: string | null
    assigned_by_name: string | null
    assigned_at: string
    completed_at: string | null
    cancelled_at: string | null
  }[]
  links: {
    id: string
    referral_id: string
    case_id: string
    case_number: number | null
    commission_id: string
    relationship_type: string
    created_by: string | null
    created_by_name: string | null
    created_at: string
  }[]
  read_receipts: {
    message_id: string
    user_id: string
    user_name: string | null
    delivered_at: string | null
    read_at: string | null
    acknowledged_at: string | null
  }[]
  reply: {
    referral_id: string
    reply_outcome_id: string | null
    outcome_label: string | null
    result_md: string | null
    acknowledged_only: boolean
    replied_by: string | null
    replied_by_name: string | null
    replied_at: string | null
    attachments: {
      id: string
      referral_id: string
      title: string
      storage_path: string
      mime_type: string | null
      size_bytes: number | null
      uploaded_by: string | null
      uploaded_by_name: string | null
      created_at: string
    }[]
  } | null
  sent_at: string | null
  received_at: string | null
  decided_at: string | null
  concluded_at: string | null
  withdrawn_at: string | null
  created_at: string
  updated_at: string
}

/**
 * One referral's full detail (header + frozen snapshot + delivered reply) via the
 * audited `get_referral_detail` door. Re-gates `can_read_referral`; a PHI open by a
 * non-source-coordinator/non-QPS reader emits a `referral.viewed` audit row.
 * `direction` is computed for the supplied `viewerCommissionId` (the commission
 * whose hub the reader came from; `null` for the QPS drill-down). Returns `null`
 * when the referral does not exist or the caller is out of scope.
 */
export async function getReferralDetail(
  referralId: string,
  viewerCommissionId: string | null = null,
): Promise<ReferralDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_referral_detail', {
    p_referral_id: referralId,
  })
  if (error || !data) return null
  const d = data as unknown as ReferralDetailJson

  const direction: ReferralDirection =
    viewerCommissionId !== null && d.target_commission_id === viewerCommissionId
      ? 'incoming'
      : 'outgoing'

  const sharedItems: SharedItem[] = (d.shared_items ?? []).map((s) => ({
    id: s.id,
    referralId: s.referral_id,
    kind: s.kind as SharedItemKind,
    sourceNarrativeId: s.source_narrative_id,
    sourceDocumentId: s.source_document_id,
    frozenTitle: s.frozen_title,
    frozenBodyMd: s.frozen_body_md,
    frozenStoragePath: s.frozen_storage_path,
    frozenMimeType: s.frozen_mime_type,
    frozenSizeBytes: s.frozen_size_bytes,
    position: s.position,
  }))

  const reply: ReferralReply | null = d.reply
    ? {
        referralId: d.reply.referral_id,
        replyOutcomeId: d.reply.reply_outcome_id,
        outcomeLabel: d.reply.outcome_label,
        resultMd: d.reply.result_md,
        acknowledgedOnly: d.reply.acknowledged_only,
        repliedById: d.reply.replied_by,
        repliedByName: d.reply.replied_by_name,
        repliedAt: d.reply.replied_at,
        attachments: (d.reply.attachments ?? []).map((a) => ({
          id: a.id,
          referralId: a.referral_id,
          title: a.title,
          storagePath: a.storage_path,
          mimeType: a.mime_type,
          sizeBytes: a.size_bytes,
          uploadedById: a.uploaded_by,
          uploadedByName: a.uploaded_by_name,
          createdAt: a.created_at,
        })),
      }
    : null

  const messages: ReferralMessage[] = (d.messages ?? []).map((m) => ({
    id: m.id,
    referralId: m.referral_id,
    sequenceNumber: m.sequence_number,
    senderCommissionId: m.sender_commission_id,
    senderCommissionName: m.sender_commission_name,
    senderUserId: m.sender_user_id,
    senderUserName: m.sender_user_name,
    messageType: m.message_type as MessageType,
    body: m.body,
    redactedAt: m.redacted_at,
    createdAt: m.created_at,
  }))

  const readReceipts: ReferralReadReceipt[] = (d.read_receipts ?? []).map((rc) => ({
    messageId: rc.message_id,
    userId: rc.user_id,
    userName: rc.user_name,
    deliveredAt: rc.delivered_at,
    readAt: rc.read_at,
    acknowledgedAt: rc.acknowledged_at,
  }))

  const resolutions: ReferralResolution[] = (d.resolutions ?? []).map((rr) => ({
    id: rr.id,
    referralId: rr.referral_id,
    resolutionNumber: rr.resolution_number,
    resolvedByCommissionId: rr.resolved_by_commission_id,
    resolvedByUserId: rr.resolved_by_user_id,
    resolvedByName: rr.resolved_by_name,
    summaryMd: rr.summary_md,
    followUpRequired: rr.follow_up_required,
    finalReplyId: rr.final_reply_id,
    resolvedAt: rr.resolved_at,
    reopenedAt: rr.reopened_at,
    reopenedById: rr.reopened_by,
    reopenedReason: rr.reopened_reason,
  }))

  const assignments: ReferralAssignment[] = (d.assignments ?? []).map((a) => ({
    id: a.id,
    referralId: a.referral_id,
    commissionId: a.commission_id,
    assigneeUserId: a.assignee_user_id,
    assigneeName: a.assignee_name,
    assignmentRole: a.assignment_role as ReferralAssignmentRole,
    status: a.status as ReferralAssignmentStatus,
    dueAt: a.due_at,
    assignedById: a.assigned_by,
    assignedByName: a.assigned_by_name,
    assignedAt: a.assigned_at,
    completedAt: a.completed_at,
    cancelledAt: a.cancelled_at,
  }))

  const links: ReferralCaseLink[] = (d.links ?? []).map((l) => ({
    id: l.id,
    referralId: l.referral_id,
    caseId: l.case_id,
    caseNumber: l.case_number,
    commissionId: l.commission_id,
    relationshipType: l.relationship_type as ReferralCaseRelationship,
    createdById: l.created_by,
    createdByName: l.created_by_name,
    createdAt: l.created_at,
  }))

  return {
    id: d.id,
    code: d.code,
    direction,
    status: d.status as ReferralStatus,
    subject: d.subject,
    descriptionMd: d.description_md,
    referralTypeId: d.referral_type_id,
    typeLabel: d.type_label,
    typeColorToken: null,
    responseExpected: d.response_expected,
    priority: d.priority as ReferralPriority,
    requestedActionId: d.requested_action_id,
    requestedActionLabel: d.requested_action_label,
    responseDueAt: d.response_due_at,
    overdue: isReferralOverdue(d.response_due_at, d.status as ReferralStatus),
    declineReasonCode: d.decline_reason_code as ReferralDeclineReasonCode | null,
    parentReferralId: d.parent_referral_id,
    sourceCommissionId: d.source_commission_id,
    sourceCommissionName: d.source_commission_name,
    targetCommissionId: d.target_commission_id,
    targetCommissionName: referralTargetName(d),
    targetType: d.target_type,
    targetHospitalId: d.target_hospital_id,
    sourceCaseId: d.source_case_id,
    sourceCaseNumber: d.source_case_number,
    targetCaseId: d.target_case_id,
    targetCaseNumber: d.target_case_number,
    hasPatient: d.has_patient,
    createdById: d.created_by,
    createdByName: d.created_by_name,
    waitingOnCommitteeId: d.waiting_on_committee_id,
    waitingOnHospitalId: d.waiting_on_hospital_id,
    lastMessageAt: d.last_message_at,
    canComposeAsSource: d.can_compose_as_source,
    canComposeAsTarget: d.can_compose_as_target,
    sharedItems,
    messages,
    resolutions,
    assignments,
    links,
    readReceipts,
    reply,
    sentAt: d.sent_at,
    receivedAt: d.received_at,
    decidedAt: d.decided_at,
    concludedAt: d.concluded_at,
    withdrawnAt: d.withdrawn_at,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Responsibility (RV2 R4) — the caller's own assignments (task pointers, PHI-free)
// ---------------------------------------------------------------------------

interface MyReferralAssignmentJson {
  id: string
  referral_id: string
  commission_id: string
  assignment_role: string
  status: string
  due_at: string | null
  assigned_by: string | null
  assigned_at: string
  completed_at: string | null
  cancelled_at: string | null
  referral_code: string
  referral_subject: string
  referral_status: string
  referral_priority: string
  referral_response_due_at: string | null
}

/**
 * The CALLER's own referral assignments (RV2 R4) — the "Minhas atribuições de
 * encaminhamento" list. Routes through the `list_my_referral_assignments` DEFINER
 * RPC, which filters on `auth.uid()` and joins ONLY PHI-free referral pointer
 * metadata (code, subject, status, priority, due). Task pointers only — never PHI.
 * `[]` on any error (fail-safe).
 */
export async function listMyReferralAssignments(): Promise<MyReferralAssignment[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_my_referral_assignments')
  if (error || !data) return []

  const rows = data as unknown as MyReferralAssignmentJson[]
  return rows.map((r) => ({
    id: r.id,
    referralId: r.referral_id,
    commissionId: r.commission_id,
    assignmentRole: r.assignment_role as ReferralAssignmentRole,
    status: r.status as ReferralAssignmentStatus,
    dueAt: r.due_at,
    assignedById: r.assigned_by,
    assignedAt: r.assigned_at,
    completedAt: r.completed_at,
    cancelledAt: r.cancelled_at,
    referralCode: r.referral_code,
    referralSubject: r.referral_subject,
    referralStatus: r.referral_status as ReferralStatus,
    referralPriority: r.referral_priority as ReferralPriority,
    referralResponseDueAt: r.referral_response_due_at,
  }))
}

// ---------------------------------------------------------------------------
// Private internal notes (RV2 R5) — side-private; the K-R5-1 security keystone
// ---------------------------------------------------------------------------

interface ReferralInternalNoteJson {
  id: string
  referral_id: string
  committee_id: string
  author_user_id: string | null
  author_name: string | null
  body: string
  created_at: string
  redacted_at: string | null
  redacted_by: string | null
  redacted_by_name: string | null
  redacted_reason: string | null
}

/**
 * The private internal notes THIS caller may read (RV2 R5) — their committee side
 * ONLY. Routes through the `list_referral_internal_notes` DEFINER door, which
 * re-applies `app.can_read_referral_internal_note` per row (source members see source
 * notes; target members see target notes; QPS sees NEITHER — the K-R5-1 keystone).
 * The PHI `body` is column-REVOKED from direct SELECT, so this door is the ONLY read
 * path; a redacted note's body arrives as `'[redigido]'`. `[]` on any error.
 */
export async function listReferralInternalNotes(
  referralId: string,
): Promise<ReferralInternalNote[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_referral_internal_notes', {
    p_referral_id: referralId,
  })
  if (error || !data) return []

  const rows = data as unknown as ReferralInternalNoteJson[]
  return rows.map((n) => ({
    id: n.id,
    referralId: n.referral_id,
    committeeId: n.committee_id,
    authorUserId: n.author_user_id,
    authorName: n.author_name,
    body: n.body,
    createdAt: n.created_at,
    redactedAt: n.redacted_at,
    redactedById: n.redacted_by,
    redactedByName: n.redacted_by_name,
    redactedReason: n.redacted_reason,
  }))
}

interface ReferralPatientJson {
  referral_id: string
  name: string | null
  mrn: string | null
  date_of_birth: string | null
  age_years: number | null
  sex: string
  encounter_ref: string | null
  unit: string | null
  attending: string | null
  updated_at: string
}

/**
 * The ISOLATED patient PHI for one referral — THE AUDITED READ (Rule 12). Routes
 * through the `get_referral_patient` SECURITY DEFINER RPC (direct SELECT on
 * `referral_patient` is revoked); the RPC re-gates with the tight
 * `can_read_referral_phi` predicate and emits `referral_patient.read`. Returns
 * `null` when no PHI exists OR the caller is out of scope (no audit row then).
 */
export async function getReferralPatient(
  referralId: string,
): Promise<ReferralPatient | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_referral_patient', {
    p_referral_id: referralId,
  })
  if (!data) return null
  const row = data as unknown as ReferralPatientJson

  return {
    referralId: row.referral_id,
    name: row.name,
    mrn: row.mrn,
    dateOfBirth: row.date_of_birth,
    ageYears: row.age_years,
    sex: row.sex as ReferralPatientSex,
    encounterRef: row.encounter_ref,
    unit: row.unit,
    attending: row.attending,
    updatedAt: row.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Signed-URL doors (DEFINER-authorized + audited, signed with the cookie client)
// ---------------------------------------------------------------------------

/**
 * A fresh short-lived signed URL for a frozen snapshot DOCUMENT item. The document
 * references A's existing `case-documents` object (Rule 6). The DEFINER
 * `get_referral_snapshot_document_path` RPC re-gates `can_read_referral_phi`,
 * audits the access (`referral.viewed`), and returns the authorized path; we then
 * sign it with the NORMAL cookie client — the `case-documents` SELECT policy's
 * flag-gated snapshot OR-term grants the read (no service-role; RLS stays the
 * boundary). `null` when out of scope.
 */
export async function getReferralDocumentUrl(
  sharedItemId: string,
): Promise<string | null> {
  const supabase = await createClient()
  const { data: path } = await supabase.rpc('get_referral_snapshot_document_path', {
    p_shared_item_id: sharedItemId,
  })
  if (!path) return null

  const { data: signed } = await supabase.storage
    .from('case-documents')
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  return signed?.signedUrl ?? null
}

/**
 * A fresh short-lived signed URL for a B-side reply ATTACHMENT (the
 * `referral-attachments` bucket). The DEFINER `get_referral_attachment_path` RPC
 * re-gates `can_read_referral_phi` + audits, returns the path; the bucket's own
 * SELECT policy also keys on `can_read_referral_phi`, so the cookie client signs it.
 * `null` when out of scope.
 */
export async function getReferralAttachmentUrl(
  attachmentId: string,
): Promise<string | null> {
  const supabase = await createClient()
  const { data: path } = await supabase.rpc('get_referral_attachment_path', {
    p_attachment_id: attachmentId,
  })
  if (!path) return null

  const { data: signed } = await supabase.storage
    .from('referral-attachments')
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  return signed?.signedUrl ?? null
}

// ---------------------------------------------------------------------------
// Configurable vocabularies (PHI-FREE; any-auth READ)
// ---------------------------------------------------------------------------

interface ReferralTypeRow {
  id: string
  key: string
  label: string
  description: string | null
  color_token: string | null
  default_response_expected: boolean
  position: number
  is_active: boolean
}

/** The active referral-type vocabulary, ordered by `position`. Drives the wizard's
 * type select. PHI-free; any authenticated caller reads it. */
export async function listReferralTypes(): Promise<ReferralType[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('referral_types')
    .select('id, key, label, description, color_token, default_response_expected, position, is_active')
    .eq('is_active', true)
    .order('position', { ascending: true })
    .returns<ReferralTypeRow[]>()

  return (data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    description: r.description,
    colorToken: r.color_token,
    defaultResponseExpected: r.default_response_expected,
    position: r.position,
    isActive: r.is_active,
  }))
}

interface ReplyOutcomeRow {
  id: string
  key: string
  label: string
  description: string | null
  color_token: string | null
  position: number
  is_active: boolean
}

/** The active reply-outcome vocabulary, ordered by `position`. Drives the reply
 * form's outcome select. PHI-free. */
export async function listReplyOutcomes(): Promise<ReplyOutcome[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('reply_outcomes')
    .select('id, key, label, description, color_token, position, is_active')
    .eq('is_active', true)
    .order('position', { ascending: true })
    .returns<ReplyOutcomeRow[]>()

  return (data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    description: r.description,
    colorToken: r.color_token,
    position: r.position,
    isActive: r.is_active,
  }))
}

interface RequestedActionRow {
  id: string
  key: string
  label: string
  description: string | null
  color_token: string | null
  position: number
  is_active: boolean
}

/** The active requested-action vocabulary (RV2 R2), ordered by `position`. Drives
 * the wizard's "o que se pede" picker. PHI-free; any authenticated caller reads it. */
export async function listReferralRequestedActions(): Promise<
  ReferralRequestedAction[]
> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('referral_requested_actions')
    .select('id, key, label, description, color_token, position, is_active')
    .eq('is_active', true)
    .order('position', { ascending: true })
    .returns<RequestedActionRow[]>()

  return (data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    description: r.description,
    colorToken: r.color_token,
    position: r.position,
    isActive: r.is_active,
  }))
}

/**
 * GAP 1 — the commissions a source coordinator may refer TO (every hospital
 * commission EXCEPT the source). id + name only, PHI-free. Backs the wizard target
 * picker. Routes through the `list_referral_target_commissions` DEFINER RPC so a
 * source `staff_admin` who is NOT a global admin can list other commissions'
 * names WITHOUT the base `commissions` RLS being widened. `[]` when unauthorized.
 */
export async function listReferralTargetCommissions(
  sourceCommissionId: string,
): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_referral_target_commissions', {
    p_source_commission_id: sourceCommissionId,
  })
  if (error || !data) return []
  return (data as { id: string; name: string }[]).map((r) => ({
    id: r.id,
    name: r.name,
  }))
}

/**
 * The precedence-aware patient pre-fill result (ADR 0038). A STRUCTURAL SUPERSET of
 * the wizard's prior `{ eventId; patient }` prefill shape — it only ADDS `source`,
 * so existing consumers keep compiling and FE adoption (the "a partir do caso"
 * caption) is purely additive.
 *   - `source`  — which origin the identifiers were copied from: `'case'` (the
 *                 case's own `case_patient`) or `'event'` (a linked safety event's
 *                 `event_patient`). The wizard captions accordingly.
 *   - `eventId` — an opaque PROVENANCE id (never surfaced as a code): the source
 *                 case id when `source === 'case'`, the linked event id when
 *                 `source === 'event'`. Kept non-nullable for back-compat.
 *   - `patient` — the {@link ReferralPatient} draft (sans `referralId`, which the
 *                 wizard fills once the draft exists).
 */
export interface CaseSafetyPrefill {
  source: 'case' | 'event'
  eventId: string
  patient: ReferralPatient
}

/**
 * The precedence-aware patient pre-fill for a source case. PRECEDENCE (ADR 0038):
 * prefer the case's OWN `case_patient` identifiers (the THIRD PHI module — the
 * working "headwater"), falling back to a linked patient-safety event's
 * `event_patient`. Both reads go THROUGH their respective EXISTING audited doors:
 *   - `getCasePatient` → `case_patient.read`, gated by the BROAD `can_read_case`;
 *   - `getEventPatient` → `event_patient.read`, gated by `can_read_event_patient`.
 * No new PHI read path is introduced; each source stays independently isolated +
 * audited (value copy, never an FK link). Returns `null` when the case has neither
 * source with PHI OR the caller is not entitled to whichever exists. `source` tells
 * the wizard which origin to caption ("a partir do caso" vs "do evento vinculado").
 * The returned `patient` is mapped to the {@link ReferralPatient} shape (sans
 * `referralId`, which the wizard fills once the draft exists).
 */
export async function getCaseSafetyEventPatientPrefill(
  caseId: string,
): Promise<CaseSafetyPrefill | null> {
  if (!caseId) return null

  // (1) Prefer the case's own identifiers. Emits only case_patient.read.
  const casePatient = await getCasePatient(caseId)
  if (casePatient) {
    return {
      source: 'case',
      // Opaque provenance id (never surfaced): the source case id for a case-sourced
      // prefill. Keeps the shape a back-compat superset of the wizard's prior prefill.
      eventId: caseId,
      patient: {
        referralId: '', // filled by the wizard once the draft is created
        name: casePatient.name,
        mrn: casePatient.mrn,
        dateOfBirth: casePatient.dateOfBirth,
        ageYears: casePatient.ageYears,
        sex: casePatient.sex as ReferralPatientSex,
        encounterRef: casePatient.encounterRef,
        unit: casePatient.unit,
        attending: casePatient.attending,
        updatedAt: casePatient.updatedAt,
      },
    }
  }

  // (2) Fall back to the case's linked safety event (RLS-scoped; PHI-free metadata).
  const supabase = await createClient()
  const { data: event } = await supabase
    .from('patient_safety_event')
    .select('id, has_patient')
    .eq('case_id', caseId)
    .eq('has_patient', true)
    .order('reported_at', { ascending: false })
    .limit(1)
    .maybeSingle()
    .returns<{ id: string; has_patient: boolean } | null>()
  if (!event) return null

  // Reuse the audited NSP door (emits event_patient.read; gated by
  // can_read_event_patient). A non-entitled caller gets null here.
  const eventPatient = await getEventPatient(event.id)
  if (!eventPatient) return null

  return {
    source: 'event',
    eventId: event.id,
    patient: {
      referralId: '', // filled by the wizard once the draft is created
      name: eventPatient.name,
      mrn: eventPatient.mrn,
      dateOfBirth: eventPatient.dateOfBirth,
      ageYears: eventPatient.ageYears,
      sex: eventPatient.sex as ReferralPatientSex,
      encounterRef: eventPatient.encounterRef,
      unit: eventPatient.unit,
      attending: eventPatient.attending,
      updatedAt: eventPatient.updatedAt,
    },
  }
}

// ---------------------------------------------------------------------------
// QPS cross-commission dashboard (PHI-FREE aggregate; is_pqs_member gated)
// ---------------------------------------------------------------------------

/** Duty separation (ADR 0030/0031): the QPS aggregate reads must return NOTHING to
 * a non-PQS caller (incl. a non-PQS platform admin), so the data layer gates on
 * `is_pqs_member_self()` rather than trusting the URL-level admin gate. */
async function isPqsMemberSelf(): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('is_pqs_member_self')
  if (error) return false
  return data === true
}

/**
 * The QPS macro list of referrals (Decision 6/13), filtered + newest-first. Gated on
 * `is_pqs_member_self()` (any-org NSP membership) as a render-gate; the ROWS are
 * RLS-bounded per-org by `can_read_referral` (the invoker/cookie client — NSP-per-org,
 * ADR 0042), so a QPS member sees only their own org's referrals (a non-PQS caller
 * gets `[]`). PHI-free. Backs the per-org QPS dashboard `/o/[org]/nsp/encaminhamentos`
 * (the FE filters the result to the route's org for display).
 */
export async function listAllReferrals(
  filters: ReferralDashboardFilters = {},
): Promise<ReferralListItem[]> {
  if (!(await isPqsMemberSelf())) return []

  const supabase = await createClient()
  // Drafts excluded: the QPS dashboard is outside the authoring case, and an unsent
  // draft is not yet a referral in flight (PQS CAN read drafts — ADR 0037 D6 — this
  // is the dashboard's product rule, deliberately narrower than its read reach).
  let query = supabase
    .from('case_referral')
    .select(REFERRAL_LIST_SELECT)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.sourceCommissionId)
    query = query.eq('source_commission_id', filters.sourceCommissionId)
  if (filters.targetCommissionId)
    query = query.eq('target_commission_id', filters.targetCommissionId)
  if (filters.referralTypeId)
    query = query.eq('referral_type_id', filters.referralTypeId)
  if (filters.responseExpected !== undefined)
    query = query.eq('response_expected', filters.responseExpected)

  const { data, error } = await query.returns<ReferralListRow[]>()
  if (error) {
    console.error('[listAllReferrals] query failed', {
      code: error.code,
      message: error.message,
    })
  }
  // QPS drill-down: no single viewing commission, so direction defaults to
  // source→target ('outgoing') — the dashboard renders source/target columns.
  return (data ?? []).map((r) => mapReferralListItem(r, null))
}

/**
 * QPS macro flow metrics (open / awaiting-reply / concluded / declined / withdrawn
 * counts) for the dashboard headline + charts. Gated on `is_pqs_member_self()`
 * (zeros for a non-PQS caller). PHI-free aggregate.
 *
 * Drafts are EXCLUDED, matching {@link listAllReferrals}: an unsent draft is not a
 * referral in flight, and counting it inflated `open` (which is
 * "not resolved" — a draft is neither). Keeps the headline consistent with the list
 * the user can actually drill into.
 */
export async function referralFlowMetrics(): Promise<ReferralFlowMetrics> {
  const empty: ReferralFlowMetrics = {
    total: 0,
    open: 0,
    awaitingReply: 0,
    concluded: 0,
    declined: 0,
    withdrawn: 0,
  }
  if (!(await isPqsMemberSelf())) return empty

  const supabase = await createClient()
  const { data } = await supabase
    .from('case_referral')
    .select('status, response_expected')
    .neq('status', 'draft')
    .returns<{ status: string; response_expected: boolean }[]>()

  const rows = data ?? []
  const resolved = new Set(['completed', 'rejected', 'withdrawn'])
  const inFlight = new Set(['sent', 'received', 'accepted', 'in_review'])
  return {
    total: rows.length,
    open: rows.filter((r) => !resolved.has(r.status)).length,
    awaitingReply: rows.filter(
      (r) => r.response_expected && inFlight.has(r.status),
    ).length,
    concluded: rows.filter((r) => r.status === 'completed').length,
    declined: rows.filter((r) => r.status === 'rejected').length,
    withdrawn: rows.filter((r) => r.status === 'withdrawn').length,
  }
}

/**
 * Whether the CURRENT caller is entitled to invoke {@link disposeReferralPhi} for
 * `referralId` — i.e. the FE gates the destructive "descartar dados do paciente"
 * affordance to entitled callers only, instead of dangling a control the RPC rejects
 * (BUG-NPH-002; ADR 0052 §6). Mirrors the `dispose_referral_phi` gate EXACTLY:
 * `is_commission_admin_of(source) OR is_pqs_operator_of(either endpoint hospital)`.
 * A plain commission `staff_admin` is intentionally NOT entitled — PHI erasure is an
 * org-admin / NSP-operator action. The platform_admin arm was REMOVED by ADR 0078 M2
 * (A35): it could destroy referral PHI it cannot read. Backed by the read-only DEFINER probe
 * `can_dispose_referral_phi(referral)` (reads/mutates NO PHI); safe-default `false`
 * (called at render time, never throws). */
export async function canDisposeReferralPhi(referralId: string): Promise<boolean> {
  if (!referralId) return false
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('can_dispose_referral_phi', {
    p_referral_id: referralId,
  })
  if (error) return false
  return data === true
}
