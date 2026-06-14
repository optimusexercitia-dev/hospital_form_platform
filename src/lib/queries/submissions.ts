import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/types/database'
import type { VersionTree } from '@/lib/queries/forms'
import type { ResponseStatus } from '@/lib/queries/responses'
import type { SignoffRecord } from '@/lib/queries/signoffs'

/**
 * Submissions-browser data-access (Architecture Rule 9 — all reads go through
 * `src/lib/queries/`). Backs the staff_admin submissions browser
 * (`/c/[slug]/dashboard/submissions`) and the read-only, version-faithful
 * detail view.
 *
 * ============================ CONTRACT-FIRST STUB ============================
 * Typed SIGNATURES the frontend builds against (Phase 8 B1). Bodies
 * `throw new Error('not implemented')` until B3 lands. The exported return
 * SHAPES are the stable contract.
 *
 * RLS (resolved — no new policy needed, see the B3 plan):
 *  - `responses_select` ALREADY grants a staff_admin SELECT on SUBMITTED
 *    responses of their commission; `answers_select` mirrors it. So the
 *    submitted list + the version-faithful detail read through the ordinary
 *    cookie-wired (RLS-scoped) client — no definer RPC for the submitted path.
 *  - The OPT-IN "em andamento" filter lists in_progress responses
 *    METADATA-ONLY. A staff_admin still CANNOT read another member's
 *    in_progress ANSWERS (the Phase-7 invariant): the list never embeds answers,
 *    and `getSubmissionDetail` returns the full tree+answers ONLY for a
 *    SUBMITTED response (or the caller's OWN in_progress one) — for a foreign
 *    in_progress id it returns `null` (→ friendly 404).
 * ===========================================================================
 */

// ---------------------------------------------------------------------------
// Domain types — the submissions-browser contract
// ---------------------------------------------------------------------------

/** Filters for the submissions list. All optional except `includeInProgress`,
 * which is the explicit opt-in that surfaces in_progress rows (metadata-only).
 * `from`/`to` are inclusive ISO dates (`YYYY-MM-DD`) on `submitted_at` for
 * submitted rows (and `updated_at` for in_progress rows). */
export interface SubmissionFilters {
  memberId?: string
  formId?: string
  from?: string
  to?: string
  includeInProgress: boolean
}

/**
 * One row in the submissions list. Deliberately METADATA-ONLY — no answers
 * field — so an in_progress row can never carry another member's answers. The
 * detail view (`getSubmissionDetail`) is the only place answers are read, and
 * only for permitted responses.
 */
export interface SubmissionRow {
  responseId: string
  formId: string
  formTitle: string
  formVersionId: string
  versionNumber: number
  /** The respondent. */
  memberId: string
  memberName: string | null
  status: ResponseStatus
  startedAt: string
  updatedAt: string
  /** Null for in_progress rows. */
  submittedAt: string | null
  /** True when this submitted response is a case PHASE (Phase-7) rather than a
   * standalone form-fill — lets the UI badge/segregate it. */
  isCasePhase: boolean
}

/**
 * The read-only, version-faithful detail of one response. Reuses the same
 * version tree the wizard renders (`VersionTree`) plus the saved answers keyed
 * two ways, so the frontend reuses the wizard's read-only renderer
 * (`read-only-tree` / `answer-summary`):
 *  - `answersByItemId` rehydrates each control's value (blank where unanswered);
 *  - `answersByKey` drives the TS condition evaluator so sections hidden under
 *    the response's OWN answers render as "não aplicável".
 * `signoffs` carries the per-section sign-off metadata for display.
 *
 * This is structurally the read-only twin of `ResponseForFill` (responses.ts) —
 * intentionally the SAME tree+answers contract so the renderer is shared.
 */
export interface SubmissionDetail {
  responseId: string
  formId: string
  formTitle: string
  formVersionId: string
  versionNumber: number
  commissionId: string
  memberId: string
  memberName: string | null
  status: ResponseStatus
  startedAt: string
  submittedAt: string | null
  /** True when the response is a case phase (Phase-7). */
  isCasePhase: boolean
  /** The response's OWN version tree (version-faithful — v1 stays v1 after v2
   * is published). */
  tree: VersionTree
  /** Saved answers keyed by item_id (drives the read-only renderer; blank where
   * absent via the sections → items LEFT JOIN answers structure). */
  answersByItemId: Record<string, Json>
  /** Saved answers keyed by question_key (drives the condition evaluator for
   * "não aplicável" sections). */
  answersByKey: Record<string, Json>
  /** Per-section sign-off rows (who/when/note), for the detail view. */
  signoffs: SignoffRecord[]
}

/** A member option for the submissions list's member filter (members of the
 * commission who have ≥1 response). */
export interface SubmissionFilterMember {
  memberId: string
  name: string | null
}

/** A form option for the submissions list's form filter (forms with ≥1
 * response). */
export interface SubmissionFilterForm {
  formId: string
  title: string
}

// ---------------------------------------------------------------------------
// Queries (STUBS — bodies land in B3)
// ---------------------------------------------------------------------------

/**
 * The commission's SUBMITTED responses (standalone + case-phase, badged via
 * `isCasePhase`), filtered by member/form/date, newest-submitted first. When
 * `filters.includeInProgress` is true, also lists in_progress responses
 * METADATA-ONLY (no answers). Returns `[]` for a non-staff_admin caller.
 * Read through `responses_select` (submitted cross-member; own in_progress).
 */
export async function listSubmissions(
  _commissionId: string,
  _filters: SubmissionFilters,
): Promise<SubmissionRow[]> {
  void _commissionId
  void _filters
  await createClient()
  throw new Error('not implemented')
}

/**
 * The version-faithful read-only detail of one response. Driven by a
 * sections → `form_items` LEFT JOIN `answers` read so the structure is complete
 * even where answers are absent. Returns `null` when the response is not visible
 * to the caller — which, by RLS, means: a foreign in_progress response (Phase-7
 * invariant), a foreign-commission response, or a missing id all surface as a
 * clean `null` (→ the page renders a friendly pt-BR 404, no data leak).
 */
export async function getSubmissionDetail(
  _responseId: string,
): Promise<SubmissionDetail | null> {
  void _responseId
  await createClient()
  throw new Error('not implemented')
}

/** The member options for the submissions list's member filter. `[]` for a
 * non-staff_admin caller. */
export async function listSubmissionFilterMembers(
  _commissionId: string,
): Promise<SubmissionFilterMember[]> {
  void _commissionId
  await createClient()
  throw new Error('not implemented')
}

/** The form options for the submissions list's form filter. `[]` for a
 * non-staff_admin caller. */
export async function listSubmissionFilterForms(
  _commissionId: string,
): Promise<SubmissionFilterForm[]> {
  void _commissionId
  await createClient()
  throw new Error('not implemented')
}
