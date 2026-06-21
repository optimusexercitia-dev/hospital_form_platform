/**
 * Inter-Committee Case Referrals data-access (Phase 22 — `case_referrals`;
 * Architecture Rule 9 — all reads go through `src/lib/queries/`; Rule 12 —
 * PHI/HIPAA handling; ADR 0037). Backs the per-commission "Encaminhamentos" hub
 * (`c/[slug]/encaminhamentos`), the case-detail outbound-referrals card, the
 * B-side referral detail, the QPS `/admin/nsp/encaminhamentos` dashboard, and the
 * Phase-12 case timeline.
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
import type {
  ReferralDashboardFilters,
  ReferralDetail,
  ReferralDirection,
  ReferralFlowMetrics,
  ReferralListItem,
  ReferralPatient,
  ReferralPatientSex,
  ReferralReply,
  ReferralStatus,
  ReferralType,
  ReplyOutcome,
  SharedItem,
  SharedItemKind,
} from '@/lib/referrals/types'

// Re-export the CLIENT-SAFE domain types + label maps so server callers and
// `"use client"` components share one import surface (the safety-events pattern).
export type {
  ReferralStatus,
  SharedItemKind,
  ReferralPatientSex,
  ReferralDirection,
  ReferralType,
  ReplyOutcome,
  ReferralListItem,
  ReferralDetail,
  SharedItem,
  ReferralReply,
  ReferralReplyAttachment,
  ReferralPatient,
  ReferralDashboardFilters,
  ReferralFlowMetrics,
} from '@/lib/referrals/types'
export {
  REFERRAL_STATUS_LABELS,
  REFERRAL_STATUS_TOKENS,
  SHARED_ITEM_KIND_LABELS,
  REFERRAL_PATIENT_SEX_LABELS,
  REFERRAL_DIRECTION_LABELS,
  RESOLVED_REFERRAL_STATUSES,
} from '@/lib/referrals/types'

const SIGNED_URL_TTL_SECONDS = 3600

// ---------------------------------------------------------------------------
// Row shapes (PostgREST embeds) + mappers — PHI-FREE on the list path
// ---------------------------------------------------------------------------

/** The PHI-free list/card select: governance metadata + denormalized flags. NOTE:
 * `hasReply` is derived from `status === 'concluida'` (PHI-free, on case_referral),
 * NOT from a `referral_reply` embed — that table's SELECT policy is tightened to
 * `can_read_referral_phi` (Phase-22 body lockdown, migration …015000), so a plain
 * member's embed would return empty and mis-report the reply existence. `status` is
 * the correct PHI-free signal every reader sees (a reply exists iff `concluida`). */
const REFERRAL_LIST_SELECT =
  'id, code, status, subject, type_label, response_expected, ' +
  'source_commission_id, target_commission_id, source_case_id, target_case_id, ' +
  'has_patient, sent_at, created_at, referral_type_id, ' +
  'source_commission:source_commission_id(name), ' +
  'target_commission:target_commission_id(name), ' +
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
  source_commission_id: string
  target_commission_id: string
  source_case_id: string
  target_case_id: string | null
  has_patient: boolean
  sent_at: string | null
  created_at: string
  referral_type_id: string | null
  source_commission: { name: string } | null
  target_commission: { name: string } | null
  source_case: { case_number: number } | null
  target_case: { case_number: number } | null
  referral_type: { color_token: string | null } | null
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
    sourceCommissionId: r.source_commission_id,
    sourceCommissionName: r.source_commission?.name ?? null,
    targetCommissionId: r.target_commission_id,
    targetCommissionName: r.target_commission?.name ?? null,
    sourceCaseId: r.source_case_id,
    sourceCaseNumber: r.source_case?.case_number ?? null,
    targetCaseId: r.target_case_id,
    targetCaseNumber: r.target_case?.case_number ?? null,
    hasPatient: r.has_patient,
    // A delivered reply exists iff the referral concluded (PHI-free signal); the
    // referral_reply table is now PHI-gated so we must NOT rely on an embed here.
    hasReply: r.status === 'concluida',
    sentAt: r.sent_at,
    createdAt: r.created_at,
  }
}

// ---------------------------------------------------------------------------
// Feature-flag probe
// ---------------------------------------------------------------------------

/** Whether the `case_referrals` feature flag is ON (probes `referrals_enabled`).
 * Gates every referral surface; `false` on any error (fail-closed). */
export async function referralsEnabled(): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('referrals_enabled')
  if (error) return false
  return data === true
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
export async function listCommissionReferrals(
  commissionId: string,
): Promise<ReferralListItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('case_referral')
    .select(REFERRAL_LIST_SELECT)
    .or(
      `source_commission_id.eq.${commissionId},target_commission_id.eq.${commissionId}`,
    )
    .order('created_at', { ascending: false })
    .returns<ReferralListRow[]>()

  return (data ?? []).map((r) => mapReferralListItem(r, commissionId))
}

/**
 * The outbound referrals OF one source case (the case-detail card), newest-first.
 * Always `direction: 'outgoing'`. RLS-scoped; PHI-free.
 */
export async function listCaseOutboundReferrals(
  caseId: string,
): Promise<ReferralListItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('case_referral')
    .select(REFERRAL_LIST_SELECT)
    .eq('source_case_id', caseId)
    .order('created_at', { ascending: false })
    .returns<ReferralListRow[]>()

  // The viewer is the source commission here (the case's own commission), so every
  // row is outgoing — pass each row's source id so direction resolves to 'outgoing'.
  return (data ?? []).map((r) => mapReferralListItem(r, r.source_commission_id))
}

/**
 * The actionable-count badge for the commission's nav. Counts referrals needing
 * this commission's attention: incoming awaiting receive/accept/reply
 * (`enviada/recebida/aceita/em_analise` where this commission is the target) +
 * outgoing drafts (`rascunho` where this commission is the source). PHI-free.
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
    .in('status', ['enviada', 'recebida', 'aceita', 'em_analise'])
  // Outgoing drafts this committee has not yet sent.
  const drafts = await supabase
    .from('case_referral')
    .select('id', { count: 'exact', head: true })
    .eq('source_commission_id', commissionId)
    .eq('status', 'rascunho')

  return (incoming.count ?? 0) + (drafts.count ?? 0)
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
  source_commission_id: string
  source_commission_name: string | null
  target_commission_id: string
  target_commission_name: string | null
  source_case_id: string
  source_case_number: number | null
  target_case_id: string | null
  target_case_number: number | null
  has_patient: boolean
  created_by: string | null
  created_by_name: string | null
  decline_note: string | null
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
    sourceCommissionId: d.source_commission_id,
    sourceCommissionName: d.source_commission_name,
    targetCommissionId: d.target_commission_id,
    targetCommissionName: d.target_commission_name,
    sourceCaseId: d.source_case_id,
    sourceCaseNumber: d.source_case_number,
    targetCaseId: d.target_case_id,
    targetCaseNumber: d.target_case_number,
    hasPatient: d.has_patient,
    createdById: d.created_by,
    createdByName: d.created_by_name,
    sharedItems,
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
 * GAP 2 — pre-fill the referral patient block from the source case's linked
 * patient-safety event, if any. Reads the event's PHI THROUGH the EXISTING audited
 * `get_event_patient` door (so it is gated by `can_read_event_patient` and audited
 * as `event_patient.read` — NO new PHI read path). Returns `null` when the case has
 * no linked event OR the caller is not entitled to that event's PHI. The returned
 * `patient` is mapped to the {@link ReferralPatient} shape (sans `referralId`,
 * which the wizard fills once the draft exists).
 */
export async function getCaseSafetyEventPatientPrefill(
  caseId: string,
): Promise<{ eventId: string; patient: ReferralPatient } | null> {
  const supabase = await createClient()
  // Find the case's linked safety event (RLS-scoped; PHI-free metadata).
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
 * The QPS macro list across ALL committees (Decision 6/13) — every referral,
 * filtered + newest-first. Gated on `is_pqs_member_self()` (a non-PQS caller gets
 * `[]`). PHI-free. Backs `/admin/nsp/encaminhamentos`.
 */
export async function listAllReferrals(
  filters: ReferralDashboardFilters = {},
): Promise<ReferralListItem[]> {
  if (!(await isPqsMemberSelf())) return []

  const supabase = await createClient()
  let query = supabase
    .from('case_referral')
    .select(REFERRAL_LIST_SELECT)
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

  const { data } = await query.returns<ReferralListRow[]>()
  // QPS drill-down: no single viewing commission, so direction defaults to
  // source→target ('outgoing') — the dashboard renders source/target columns.
  return (data ?? []).map((r) => mapReferralListItem(r, null))
}

/**
 * QPS macro flow metrics (open / awaiting-reply / concluded / declined / withdrawn
 * counts) for the dashboard headline + charts. Gated on `is_pqs_member_self()`
 * (zeros for a non-PQS caller). PHI-free aggregate.
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
    .returns<{ status: string; response_expected: boolean }[]>()

  const rows = data ?? []
  const resolved = new Set(['concluida', 'recusada', 'retirada'])
  const inFlight = new Set(['enviada', 'recebida', 'aceita', 'em_analise'])
  return {
    total: rows.length,
    open: rows.filter((r) => !resolved.has(r.status)).length,
    awaitingReply: rows.filter(
      (r) => r.response_expected && inFlight.has(r.status),
    ).length,
    concluded: rows.filter((r) => r.status === 'concluida').length,
    declined: rows.filter((r) => r.status === 'recusada').length,
    withdrawn: rows.filter((r) => r.status === 'retirada').length,
  }
}
