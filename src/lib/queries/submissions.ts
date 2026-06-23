import { createClient } from '@/lib/supabase/server'
import { getVersionTree } from '@/lib/queries/forms'
import { getResponseSignoffs } from '@/lib/queries/signoffs'
import { getSessionContext } from '@/lib/queries/session'
import { logAuditAccess } from '@/lib/audit/access'
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
  /** Saved per-item observation notes keyed by item_id (form-builder
   * enhancements, decision #11), non-null only. The read-only renderer shows
   * them as a muted secondary line under the answer. */
  observationsByItemId: Record<string, string>
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
// Row shapes (PostgREST embeds)
// ---------------------------------------------------------------------------

interface SubmissionListRow {
  id: string
  form_version_id: string
  status: string
  started_at: string
  updated_at: string
  submitted_at: string | null
  case_phase_id: string | null
  created_by: string
  profiles: { full_name: string | null } | null
  form_versions: {
    form_id: string
    version_number: number
    forms: { title: string }
  }
}

interface DetailResponseRow {
  id: string
  form_version_id: string
  commission_id: string
  status: string
  started_at: string
  submitted_at: string | null
  case_phase_id: string | null
  created_by: string
  profiles: { full_name: string | null } | null
  form_versions: {
    form_id: string
    version_number: number
    forms: { title: string }
  }
}

interface DetailAnswerRow {
  item_id: string
  question_key: string
  value: Json | null
  observation: string | null
}

// ---------------------------------------------------------------------------
// Queries — all RLS-scoped (cookie-wired client). `responses_select` grants a
// staff_admin SELECT on SUBMITTED responses of their commission and denies
// another member's in_progress rows; `answers_select` mirrors it. So the list +
// detail need no definer RPC, and the Phase-7 in_progress-answers invariant is
// preserved by construction (see the module header).
// ---------------------------------------------------------------------------

/**
 * The commission's SUBMITTED responses (standalone + case-phase, badged via
 * `isCasePhase`), filtered by member/form/date, newest-submitted first. When
 * `filters.includeInProgress` is true, also lists the caller-visible in_progress
 * responses METADATA-ONLY (this read never touches `answers`, so no in_progress
 * answers can leak). Returns `[]` for a caller with no readable responses (RLS).
 *
 * Note: a staff_admin only sees SUBMITTED rows of other members; the in_progress
 * rows surfaced by the opt-in filter are limited by `responses_select` to ones
 * they may read (their own), so the metadata-only list cannot expose another
 * member's draft — and never its answers regardless.
 */
export async function listSubmissions(
  commissionId: string,
  filters: SubmissionFilters,
): Promise<SubmissionRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from('responses')
    .select(
      'id, form_version_id, status, started_at, updated_at, submitted_at, ' +
        'case_phase_id, created_by, profiles:created_by(full_name), ' +
        'form_versions(form_id, version_number, forms(title))',
    )
    .eq('commission_id', commissionId)

  query = filters.includeInProgress
    ? query.in('status', ['submitted', 'in_progress'])
    : query.eq('status', 'submitted')

  if (filters.memberId) query = query.eq('created_by', filters.memberId)
  // The form filter resolves through the version's form_id.
  if (filters.from) query = query.gte('submitted_at', filters.from)
  if (filters.to) query = query.lte('submitted_at', `${filters.to}T23:59:59.999Z`)

  const { data } = await query
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .returns<SubmissionListRow[]>()

  let rows = (data ?? []).map(
    (r): SubmissionRow => ({
      responseId: r.id,
      formId: r.form_versions.form_id,
      formTitle: r.form_versions.forms.title,
      formVersionId: r.form_version_id,
      versionNumber: r.form_versions.version_number,
      memberId: r.created_by,
      memberName: r.profiles?.full_name ?? null,
      status: r.status as ResponseStatus,
      startedAt: r.started_at,
      updatedAt: r.updated_at,
      submittedAt: r.submitted_at,
      isCasePhase: r.case_phase_id != null,
    }),
  )

  // Form filter is applied client-side on the resolved form_id (the column lives
  // on the embedded version, not filterable inline via PostgREST `.eq`).
  if (filters.formId) rows = rows.filter((r) => r.formId === filters.formId)

  return rows
}

/**
 * The version-faithful read-only detail of one response. Driven by the response's
 * OWN version tree (`getVersionTree`) plus a `answers` read keyed by item_id and
 * question_key, so the structure is complete even where answers are absent
 * (the renderer leaves unanswered items blank) and the condition evaluator can
 * mark hidden conditional sections "não aplicável". Sign-off metadata is read
 * via `getResponseSignoffs`. Returns `null` when the response is not visible to
 * the caller — by RLS, a foreign in_progress response (Phase-7 invariant), a
 * foreign-commission response, or a missing id all surface as a clean `null`
 * (→ friendly pt-BR 404, no data leak).
 */
export async function getSubmissionDetail(
  responseId: string,
): Promise<SubmissionDetail | null> {
  const supabase = await createClient()

  const { data: response } = await supabase
    .from('responses')
    .select(
      'id, form_version_id, commission_id, status, started_at, submitted_at, ' +
        'case_phase_id, created_by, profiles:created_by(full_name), ' +
        'form_versions(form_id, version_number, forms(title))',
    )
    .eq('id', responseId)
    .maybeSingle<DetailResponseRow>()

  if (!response) return null

  // The response's own version tree (version-faithful — v1 stays v1 after v2).
  const tree = await getVersionTree(response.form_version_id)
  if (!tree) return null

  // answers_select returns answers only for responses the caller may read; for a
  // submitted response that's the structure-complete answer set. (No row leaks
  // for in_progress foreign responses — `response` above would already be null.)
  const { data: answers } = await supabase
    .from('answers')
    .select('item_id, question_key, value, observation')
    .eq('response_id', responseId)
    .returns<DetailAnswerRow[]>()

  const answersByItemId: Record<string, Json> = {}
  const answersByKey: Record<string, Json> = {}
  const observationsByItemId: Record<string, string> = {}
  for (const a of answers ?? []) {
    // Collect observations independently of the value guard (an observation can
    // accompany a null value via an observation-only upsert).
    if (a.observation !== null && a.observation !== '') {
      observationsByItemId[a.item_id] = a.observation
    }
    if (a.value === null) continue
    answersByItemId[a.item_id] = a.value
    answersByKey[a.question_key] = a.value
  }

  const signoffs = await getResponseSignoffs(responseId)

  // Sensitive-READ audit (Phase 13 / ADR 0029 §6): a staff_admin opening ANOTHER
  // member's SUBMITTED response emits a `response.opened_foreign` row. Guard:
  //  - SUBMITTED only (a foreign in_progress response never reaches here — RLS
  //    returns null above; the caller's OWN in_progress draft is self-access);
  //  - actor != created_by (no self-read spam).
  // Best-effort + once per access (this route is dynamic/uncached, so the write
  // fires once per actual fetch and never blocks the read on failure).
  if (response.status === 'submitted') {
    const session = await getSessionContext()
    if (session && session.userId !== response.created_by) {
      await logAuditAccess({
        action: 'response.opened_foreign',
        entityType: 'response',
        entityId: response.id,
        commissionId: response.commission_id,
        summary: 'Resposta de terceiro visualizada',
        metadata: { form_version_id: response.form_version_id },
      })
    }
  }

  return {
    responseId: response.id,
    formId: response.form_versions.form_id,
    formTitle: response.form_versions.forms.title,
    formVersionId: response.form_version_id,
    versionNumber: response.form_versions.version_number,
    commissionId: response.commission_id,
    memberId: response.created_by,
    memberName: response.profiles?.full_name ?? null,
    status: response.status as ResponseStatus,
    startedAt: response.started_at,
    submittedAt: response.submitted_at,
    isCasePhase: response.case_phase_id != null,
    tree,
    answersByItemId,
    answersByKey,
    observationsByItemId,
    signoffs,
  }
}

/** The member options for the submissions list's member filter: distinct
 * respondents of the commission's responses the caller may read. `[]` when none
 * are readable. */
export async function listSubmissionFilterMembers(
  commissionId: string,
): Promise<SubmissionFilterMember[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('responses')
    .select('created_by, profiles:created_by(full_name)')
    .eq('commission_id', commissionId)
    .eq('status', 'submitted')
    .returns<{ created_by: string; profiles: { full_name: string | null } | null }[]>()

  const byId = new Map<string, SubmissionFilterMember>()
  for (const r of data ?? []) {
    if (!byId.has(r.created_by)) {
      byId.set(r.created_by, { memberId: r.created_by, name: r.profiles?.full_name ?? null })
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '', 'pt-BR'),
  )
}

/** The form options for the submissions list's form filter: distinct forms with
 * ≥1 submitted response the caller may read. `[]` when none are readable. */
export async function listSubmissionFilterForms(
  commissionId: string,
): Promise<SubmissionFilterForm[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('responses')
    .select('form_versions(form_id, forms(title))')
    .eq('commission_id', commissionId)
    .eq('status', 'submitted')
    .returns<{ form_versions: { form_id: string; forms: { title: string } } }[]>()

  const byId = new Map<string, SubmissionFilterForm>()
  for (const r of data ?? []) {
    const fid = r.form_versions.form_id
    if (!byId.has(fid)) {
      byId.set(fid, { formId: fid, title: r.form_versions.forms.title })
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
}
