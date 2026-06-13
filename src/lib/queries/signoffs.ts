import { createClient } from '@/lib/supabase/server'
import { getVersionTree } from '@/lib/queries/forms'
import type { Json } from '@/lib/types/database'
import type { VersionTree } from '@/lib/queries/forms'

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
  signoffs: SignoffJsonRow[]
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * The staff_admin "pendentes de assinatura" queue for a commission: in_progress
 * responses that are submit-ready and have a visible, unsigned, staff_admin-role
 * sign-off section. Returns `[]` for non-staff_admins (the RPC is internally
 * gated by `is_staff_admin_of`, so this never leaks). Already ordered by the RPC
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
  }))
}

/**
 * One in_progress response prepared for the staff_admin review-to-sign screen.
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
