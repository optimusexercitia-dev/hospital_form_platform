import { createClient } from '@/lib/supabase/server'
import { getVersionTree } from '@/lib/queries/forms'
import type { Json } from '@/lib/types/database'
import type { VersionTree } from '@/lib/queries/forms'
import { toReferenceKind } from '@/lib/forms/reference-constants'
import type {
  GroupInstance,
  ReferenceAnswer,
  RiskMatrixAnswer,
} from '@/lib/queries/responses'

/**
 * Sign-off data-access (Architecture Rule 9 — all reads go through
 * `src/lib/queries/`). Backs the staff_admin "pendentes de assinatura" queue
 * (`/c/[slug]/manage/assinaturas`), the review-to-sign screen, and the sign-off
 * status shown in the wizard review.
 *
 * Two reads are SECURITY DEFINER RPCs (see ADR 0016), the narrow exception to
 * "a staff_admin cannot read another member's in_progress answers":
 *   - `list_signoff_queue` — internally gated by is_staff_admin_of; returns
 *     submit-ready in_progress responses awaiting a staff_admin signature.
 *   - `get_response_for_signoff` — internally gated; returns the answers +
 *     sign-off rows + respondent identity of one such response, ONLY while a
 *     visible staff_admin sign-off section is pending.
 *
 * `getResponseForSignoff` composes that definer payload with the
 * member-readable `getVersionTree` (RLS-scoped) so the review screen renders the
 * version-faithful structure without widening the definer surface.
 *
 * The mutation side (`signSection`) lives in `src/lib/responses/actions.ts`;
 * this module is read-only. All user-facing strings are the caller's (pt-BR).
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type SignoffRole = 'respondent' | 'staff_admin'

/** One row in the staff_admin sign-off queue. */
export interface SignoffQueueItem {
  responseId: string
  formId: string
  formTitle: string
  versionNumber: number
  respondentId: string
  respondentName: string | null
  /** The first pending staff_admin sign-off section (by position). */
  pendingSectionId: string
  pendingSectionTitle: string | null
  /** How many staff_admin sign-off sections are pending on this response. */
  pendingCount: number
  startedAt: string
  updatedAt: string
  /**
   * ADR 0136 — the case phase this response belongs to, non-null ONLY for the
   * DEFERRED lane: a response that is already `submitted` and frozen, whose phase
   * is parked in `awaiting_signoff` waiting for this signature.
   *
   * ⚠ NOT decoration. The queue now mixes two lanes with opposite semantics — a
   * live draft the respondent can still change, and a frozen record whose
   * signature CONCLUDES a case phase and unblocks everything downstream. A
   * reviewer who cannot tell them apart is being asked to attest without knowing
   * what the attestation does.
   */
  casePhaseId: string | null
}

/** One recorded sign-off on a response (who/when/note), for read-only display. */
export interface SignoffRecord {
  sectionId: string
  signedById: string
  signedByName: string | null
  signedAt: string
  note: string | null
}

/**
 * Everything the review-to-sign screen needs for one in_progress response: the
 * version-faithful tree (member-readable), the saved answers (by question_key
 * and by item_id, for the read-only renderer), the existing sign-off rows, and
 * the respondent's identity. `null` when the caller may not review/sign it
 * (RLS/definer gate) or it is not found.
 */
export interface ResponseForSignoff {
  /**
   * ADR 0136 — this response is already SUBMITTED and frozen, and the signature
   * being collected concludes its case phase.
   *
   * Derived from the door's own `status`, and that derivation is EXACT rather
   * than a heuristic: `get_response_for_signoff` admits a `submitted` response
   * only through `app.is_signoff_deferral_open`, which requires the response's case
   * phase to be `awaiting_signoff` AND to point back at this response. So
   * `status = 'submitted'` here means the deferred lane and nothing else.
   */
  isFrozenCasePhase: boolean
  responseId: string
  formId: string
  formTitle: string
  formVersionId: string
  commissionId: string
  respondentId: string
  respondentName: string | null
  startedAt: string
  updatedAt: string
  tree: VersionTree
  /** Saved answers keyed by question_key (drives the TS condition evaluator). */
  answersByKey: Record<string, Json>
  /** Saved answers keyed by item_id (drives the read-only renderer). */
  answersByItemId: Record<string, Json>
  /** Saved per-item observation notes keyed by item_id (form-builder
   * enhancements, decision #11), non-null only. The read-only renderer shows
   * them as a muted secondary line under the answer (mirrors BE-7). */
  observationsByItemId: Record<string, string>
  /**
   * QA m-3 — the response's TOP-LEVEL "Outros" free text, keyed by item id.
   *
   * ⚠ NOT optional and NOT cosmetic. The door projected this per instance and
   * NOT at top level, so a top-level "Outros" answer reached the signer as a
   * bare chip with the respondent's typed text missing — an attestation to
   * "Outro" without ever seeing what it said. Same shape as `instances` (FF-1),
   * the matrix grids (FF-2) and `references_by_item` (FF-5): every answer shape
   * owes this projection, and this is the fourth time that debt came due.
   *
   * Identical shape to {@link ResponseForFill.otherTextByItemId}, so the review
   * screen reuses the wizard's renderer rather than growing a second one.
   */
  otherTextByItemId: Record<string, string>
  /**
   * FF-2 (ADR 0089 · FUP-FF2-1) — the response's TOP-LEVEL matrix grids,
   * `{ itemId: { rowCode: colCode } }`, and its risk answers.
   *
   * Same reasoning as `instances` below, one answer shape later: a staff_admin
   * counter-signs on the strength of THIS screen, so a matrix that renders empty
   * is a signature attesting to evidence the signer was never shown (Rule 4).
   * Before FF-2 the door projected every answer shape EXCEPT these two.
   */
  matrixCellsByItemId: Record<string, Record<string, string>>
  riskMatrixByItemId: Record<string, RiskMatrixAnswer>
  /**
   * FF-5 (ADR 0091) — the response's TOP-LEVEL reference targets, resolved to a
   * readable label by the door. Same reasoning as the two matrix maps above, one
   * answer shape later: FF-2's own migration named FF-5 as the next debtor of
   * this projection, and a reference rendering empty on the review screen is a
   * signature attesting to evidence the signer was never shown (Rule 4).
   */
  referencesByItemId: Record<string, ReferenceAnswer>
  /**
   * FF-1 (ADR 0087) — the response's repeating-group instances, ordered by
   * (groupItemId, position). Sourced from the DEFINER door, not a second query,
   * so the review screen sees exactly what the door authorised.
   *
   * NOT optional and NOT cosmetic: a staff_admin counter-signs on the strength of
   * this screen, so an omitted instance is a signature attesting to evidence the
   * signer was never shown (Rule 4). `answersByKey` on each instance is already
   * the top-level ⊕ instance overlay, so a per-instance condition evaluates on
   * the review screen exactly as it did in the wizard.
   */
  instances: GroupInstance[]
  /** Existing sign-off rows (all roles), for "assinado por X em DATA". */
  signoffs: SignoffRecord[]
}

// ---------------------------------------------------------------------------
// RPC payload shapes (the definer functions return jsonb / table rows)
// ---------------------------------------------------------------------------

interface QueueRow {
  response_id: string
  form_id: string
  form_title: string
  version_number: number
  respondent_id: string
  respondent_name: string | null
  section_id: string
  section_title: string | null
  pending_count: number
  started_at: string
  updated_at: string
  case_phase_id: string | null
}

interface SignoffJsonRow {
  section_id: string
  signed_by: string
  signed_by_name: string | null
  signed_at: string
  note: string | null
}

interface ResponseForSignoffJson {
  response_id: string
  form_id: string
  form_title: string
  form_version_id: string
  commission_id: string
  status: string
  respondent_id: string
  respondent_name: string | null
  started_at: string
  updated_at: string
  answers: Record<string, Json>
  answers_by_item: Record<string, Json>
  observations_by_item: Record<string, string>
  /** QA m-3: the TOP-LEVEL "Outros" free text. Emitted by the door only since
   *  20260902000900 — before that it existed per-instance and nowhere else. */
  other_text_by_item: Record<string, string>
  /** FF-2 (ADR 0089): the matrix grids, addressed by clone-stable CODES on both
   *  axes — the same shape the wizard reads, so the review screen reuses its
   *  renderer rather than growing a second one. */
  matrix_cells_by_item: Record<string, Record<string, string>>
  risk_matrix_by_item: Record<string, RiskMatrixJson>
  /** FF-5 (ADR 0091): the reference targets, projected by
   *  `app.references_by_item` at this scope. */
  references_by_item: Record<string, ReferenceJson>
  /** FF-1: one entry per repeating-group instance, from the DEFINER door. */
  instances: GroupInstanceJsonRow[]
  signoffs: SignoffJsonRow[]
}

/** FF-1: one instance as `get_response_for_signoff` emits it. `answers` is the
 *  ALREADY-overlaid instance map (app.instance_answer_map), so the client never
 *  recomposes ruling 2's resolution. */
interface GroupInstanceJsonRow {
  id: string
  group_item_id: string
  position: number
  answers: Record<string, Json>
  answers_by_item: Record<string, Json>
  observations_by_item: Record<string, string>
  other_text_by_item: Record<string, string>
  /** FF-2: this instance's grids, same shape as the top-level maps. */
  matrix_cells_by_item: Record<string, Record<string, string>>
  risk_matrix_by_item: Record<string, RiskMatrixJson>
  /** FF-5 (ADR 0091): the reference targets, projected by
   *  `app.references_by_item` at this scope. */
  references_by_item: Record<string, ReferenceJson>
}

/** FF-2: one risk answer as the door emits it. `risk_score` is the DURABLE fact
 *  the signer attests to — it is projected, never recomputed client-side from
 *  the axis weights, so a later re-weighting cannot retroactively change what a
 *  historical sign-off appears to say. */
interface RiskMatrixJson {
  severity: string
  likelihood: string
  risk_score: number | null
}

/**
 * FF-5: one reference as the door emits it. `target_id` is the identity;
 * `label`/`sublabel` are resolved by live join at projection time and are what
 * the signer actually reads — a reference field that renders as a bare UUID, or
 * empty, is a signature attesting to evidence the screen never showed (Rule 4),
 * which is the entire reason this projection exists.
 */
interface ReferenceJson {
  kind: string
  target_id: string
  label: string | null
  sublabel: string | null
}

/**
 * FF-5: narrow the door's `references_by_item` payload to the SAME
 * {@link ReferenceAnswer} shape `getResponseForFill` returns, so the sign-off
 * view and the wizard consume one type — the `toRiskAnswers` precedent exactly.
 *
 * An entry with an unknown `kind` or no `target_id` is DROPPED rather than
 * rendered: a half-formed reference on a signing screen is worse than an absent
 * one, and the same reasoning that governs a half-formed risk answer applies
 * unchanged here.
 */
function toReferenceAnswers(
  raw: Record<string, ReferenceJson> | null | undefined,
): Record<string, ReferenceAnswer> {
  const out: Record<string, ReferenceAnswer> = {}
  for (const [itemId, entry] of Object.entries(raw ?? {})) {
    const kind = toReferenceKind(entry?.kind)
    if (!entry || kind === null || typeof entry.target_id !== 'string') continue
    out[itemId] = {
      kind,
      targetId: entry.target_id,
      label: entry.label ?? entry.target_id,
      sublabel: entry.sublabel,
    }
  }
  return out
}

/**
 * FF-2: narrow the door's `risk_matrix_by_item` payload to the SAME
 * {@link RiskMatrixAnswer} shape `getResponseForFill` returns, so the sign-off
 * view and the wizard consume one type. Snake_case → camelCase is the only
 * transformation; a malformed entry is DROPPED rather than rendered, because a
 * half-formed risk answer on a signing screen is worse than an absent one.
 */
function toRiskAnswers(
  raw: Record<string, RiskMatrixJson> | null | undefined,
): Record<string, RiskMatrixAnswer> {
  const out: Record<string, RiskMatrixAnswer> = {}
  for (const [itemId, entry] of Object.entries(raw ?? {})) {
    if (!entry || typeof entry.severity !== 'string' || typeof entry.likelihood !== 'string') {
      continue
    }
    out[itemId] = {
      severity: entry.severity,
      likelihood: entry.likelihood,
      riskScore: typeof entry.risk_score === 'number' ? entry.risk_score : null,
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * The staff_admin "pendentes de assinatura" queue for a commission. TWO lanes
 * since ADR 0136:
 *   - the original: `in_progress` responses that are submit-ready and have a
 *     visible, unsigned, staff_admin-role sign-off section;
 *   - the DEFERRED lane: `submitted`, frozen case-phase responses whose phase is
 *     parked in `awaiting_signoff` — `casePhaseId` is non-null for exactly these.
 *
 * Returns `[]` for non-staff_admins (the RPC is internally gated by
 * `is_staff_admin_of`, so this never leaks). Already ordered by the RPC
 * (most-recent activity first).
 */
export async function listSignoffQueue(
  commissionId: string,
): Promise<SignoffQueueItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('list_signoff_queue', {
    p_commission_id: commissionId,
  })

  if (error || !data) return []

  return (data as QueueRow[]).map((r) => ({
    responseId: r.response_id,
    formId: r.form_id,
    formTitle: r.form_title,
    versionNumber: r.version_number,
    respondentId: r.respondent_id,
    respondentName: r.respondent_name,
    pendingSectionId: r.section_id,
    pendingSectionTitle: r.section_title,
    pendingCount: r.pending_count,
    startedAt: r.started_at,
    updatedAt: r.updated_at,
    casePhaseId: r.case_phase_id,
  }))
}

/**
 * One response prepared for the staff_admin review-to-sign screen — an
 * `in_progress` draft, or (ADR 0136) a `submitted` case-phase response whose
 * phase is still `awaiting_signoff`.
 * Composes the SECURITY DEFINER `get_response_for_signoff` (answers + sign-offs +
 * identity, gated on a pending staff_admin section) with the member-readable
 * `getVersionTree` (the version-faithful structure). `null` when the caller is
 * not a staff_admin of the commission, the response is not in_progress, or it has
 * no pending staff_admin sign-off section (the RPC raises, which we map to null).
 */
export async function getResponseForSignoff(
  responseId: string,
): Promise<ResponseForSignoff | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_response_for_signoff', {
    p_response_id: responseId,
  })

  // The RPC raises no_data_found when the caller is not entitled / no pending
  // staff_admin section — surfaced here as a clean null (the page renders 404).
  if (error || !data) return null

  const payload = data as unknown as ResponseForSignoffJson

  const tree = await getVersionTree(payload.form_version_id)
  if (!tree) return null

  return {
    isFrozenCasePhase: payload.status === 'submitted',
    responseId: payload.response_id,
    formId: payload.form_id,
    formTitle: payload.form_title,
    formVersionId: payload.form_version_id,
    commissionId: payload.commission_id,
    respondentId: payload.respondent_id,
    respondentName: payload.respondent_name,
    startedAt: payload.started_at,
    updatedAt: payload.updated_at,
    tree,
    answersByKey: payload.answers ?? {},
    answersByItemId: payload.answers_by_item ?? {},
    observationsByItemId: payload.observations_by_item ?? {},
    // QA m-3. `?? {}` because the key is absent from a payload produced before
    // 20260902000900, not because the data is optional — the signer must see the
    // typed "Outro" text, not a bare chip.
    otherTextByItemId: payload.other_text_by_item ?? {},
    matrixCellsByItemId: payload.matrix_cells_by_item ?? {},
    riskMatrixByItemId: toRiskAnswers(payload.risk_matrix_by_item),
    referencesByItemId: toReferenceAnswers(payload.references_by_item),
    instances: (payload.instances ?? []).map((i) => ({
      id: i.id,
      groupItemId: i.group_item_id,
      position: i.position,
      answersByItemId: i.answers_by_item ?? {},
      // Already overlaid server-side by app.instance_answer_map — the SAME
      // resolution the wizard and submit_response use (Rule 3, one evaluator).
      answersByKey: i.answers ?? {},
      observationsByItemId: i.observations_by_item ?? {},
      otherTextByItemId: i.other_text_by_item ?? {},
      // FF-2 (FUP-FF2-1): the gap is CLOSED — the door now projects both matrix
      // tables per instance, so the signer sees the same grid the respondent
      // filled. `?? {}` remains because these keys are absent from a payload
      // produced before 20260830001000, not because the data is optional.
      matrixCellsByItemId: i.matrix_cells_by_item ?? {},
      riskMatrixByItemId: toRiskAnswers(i.risk_matrix_by_item),
      // FF-5: the per-instance arm. A reference inside a repeating group reaches
      // the signer through HERE and nowhere else — wiring only the top-level key
      // above would leave the signer blind to exactly the composition the
      // per-instance writer exists for.
      referencesByItemId: toReferenceAnswers(i.references_by_item),
    })),
    signoffs: (payload.signoffs ?? []).map((s) => ({
      sectionId: s.section_id,
      signedById: s.signed_by,
      signedByName: s.signed_by_name,
      signedAt: s.signed_at,
      note: s.note,
    })),
  }
}

/**
 * The existing sign-off rows of a response (any role), for the wizard review
 * screen's "assinado por X em DATA" badges and submission gating. Scoped by
 * `signoffs_select` (creator/admin/staff_admin-of-commission), so the response's
 * own creator always sees their respondent sign-off and any counter-signs.
 * Returns `[]` when the caller may not read them or none exist.
 */
export async function getResponseSignoffs(
  responseId: string,
): Promise<SignoffRecord[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('response_section_signoffs')
    .select('section_id, signed_by, signed_at, note, profiles:signed_by(full_name)')
    .eq('response_id', responseId)
    .order('signed_at', { ascending: true })
    .returns<
      {
        section_id: string
        signed_by: string
        signed_at: string
        note: string | null
        profiles: { full_name: string | null } | null
      }[]
    >()

  return (data ?? []).map((s) => ({
    sectionId: s.section_id,
    signedById: s.signed_by,
    signedByName: s.profiles?.full_name ?? null,
    signedAt: s.signed_at,
    note: s.note,
  }))
}
