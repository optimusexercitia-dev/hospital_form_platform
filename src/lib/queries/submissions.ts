import { createClient } from '@/lib/supabase/server'
import { getVersionTree } from '@/lib/queries/forms'
import { getResponseSignoffs } from '@/lib/queries/signoffs'
import { getSessionContext } from '@/lib/queries/session'
import { logAuditAccess } from '@/lib/audit/access'
import { responseCorrectionEnabled } from '@/lib/queries/feature-flags'
import type { Json } from '@/lib/types/database'
import type { Page, PageParams, CursorSchema } from '@/lib/types/pagination'
import {
  DEFAULT_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
} from '@/lib/types/pagination'
import type { VersionTree } from '@/lib/queries/forms'
import {
  TOP_LEVEL_SCOPE,
  buildAnswerMaps,
  buildGroupInstances,
  buildMatrixAnswers,
  buildReferenceAnswers,
} from '@/lib/queries/responses'
import type {
  GroupInstance,
  GroupInstanceRow,
  ReferenceAnswer,
  ResponseStatus,
  RiskMatrixAnswer,
  ScopedAnswerRow,
  ScopedMatrixCellRow,
  ScopedReferenceRow,
  ScopedRiskMatrixRow,
  ScopedSelectionRow,
} from '@/lib/queries/responses'
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
  /** SUP (ADR 0074): the supersession badge for this row (plan §5 — badges show
   * in response lists AND the detail header). Resolved via a single batched
   * lookup in {@link listSubmissions}, never N+1. See {@link SupersessionBadge}. */
  badge: SupersessionBadge
}

/**
 * SUP (ADR 0074): a response's supersession badge for display in lists + the
 * detail header. `'substituido'` — this response IS a predecessor that has
 * been superseded (a submitted successor points at it); `'atual'` — this
 * response IS a successor (it supersedes an earlier one); `null` — no
 * supersession relationship either way.
 */
export type SupersessionBadge = 'substituido' | 'atual' | null

/**
 * SUP (ADR 0074): the pure badge-merge rule shared by the list read
 * ({@link listSubmissions}) — extracted so it is unit-testable in isolation
 * (Rule 3-adjacent: one place decides the badge). A row is `'substituido'` when
 * it has a SUBMITTED successor (`hasSubmittedSuccessor` — the "latest-in-chain"
 * signal, mirroring the aggregation exclusion); `'atual'` when the row IS a
 * successor (`isSuccessor`, i.e. its own `supersedes_id` is non-null); otherwise
 * `null`. `'substituido'` takes precedence in the rare case a row is both.
 */
export function resolveSupersessionBadge(input: {
  hasSubmittedSuccessor: boolean
  isSuccessor: boolean
}): SupersessionBadge {
  if (input.hasSubmittedSuccessor) return 'substituido'
  if (input.isSuccessor) return 'atual'
  return null
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
 *
 * SUP (ADR 0074) additions: `supersedesId`/`supersededById`/`badge` surface the
 * correction chain; `canCorrect` gates the "Corrigir envio" affordance
 * (flag ON && staff_admin/commission-admin of the commission && standalone &&
 * submitted && no live successor) — computed server-side so the frontend never
 * re-derives authority.
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
  /** SUP: the predecessor this response supersedes, if it IS a successor. */
  supersedesId: string | null
  /** SUP: the successor that supersedes this response, if any (regardless of
   * that successor's status — in_progress or submitted). */
  supersededById: string | null
  /** SUP: the display badge — see {@link SupersessionBadge}. */
  badge: SupersessionBadge
  /** SUP: whether the caller may correct THIS response via `supersede_response`
   * right now (flag ON && staff_admin/commission-admin of the commission &&
   * standalone && submitted && no live successor). */
  canCorrect: boolean
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
  /** Saved per-item "Outros" free text keyed by item_id ("Outros" open option),
   * non-null only. The renderer shows it next to the selected "Outro" option
   * ("Outro: <valor>"). */
  otherTextByItemId: Record<string, string>
  /**
   * FF-1 (BE-0 contract, ADR 0087): the response's repeating-group instances,
   * ordered by (groupItemId, position) — the SAME shape the fill wizard consumes,
   * so the read-only renderer groups instances identically. `[]` until a form
   * authors a container. The four maps above stay TOP-LEVEL-only.
   *
   * Submitted instances are frozen with the response
   * (`guard_submitted_group_instances_trg`), and a zero-answer instance is pruned
   * by `submit_response` (ruling 3), so what appears here is exactly what was
   * filled — never a phantom blank row.
   */
  /**
   * FF-2 (ADR 0089): the response's TOP-LEVEL matrix grids and risk answers,
   * `{ itemId: { rowCode: colCode } }` / `{ itemId: RiskMatrixAnswer }`. Same
   * shape the wizard and the sign-off view use, so one renderer serves all three.
   */
  matrixCellsByItemId: Record<string, Record<string, string>>
  riskMatrixByItemId: Record<string, RiskMatrixAnswer>
  /**
   * FF-5 (ADR 0091): the response's TOP-LEVEL references, resolved to a readable
   * label by live join at read time. Same shape the wizard and the sign-off view
   * consume, so one renderer serves all three.
   *
   * Because the label is resolved live and never snapshotted (ruling 4), a
   * submitted response shows the target's CURRENT name — the answer's identity
   * (`targetId`) is frozen with the submission, its presentation is not. That is
   * deliberate: the alternative freezes a patient surrogate or a pre-rename
   * commission into an immutable row.
   */
  referencesByItemId: Record<string, ReferenceAnswer>
  instances: GroupInstance[]
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
  /** SUP: non-null when THIS row is a successor → `'atual'`. */
  supersedes_id: string | null
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
  /** SUP: the predecessor this response supersedes (null unless this row IS a
   * successor). */
  supersedes_id: string | null
  profiles: { full_name: string | null } | null
  form_versions: {
    form_id: string
    version_number: number
    forms: { title: string }
  }
  /** SUP: the commission's org/hospital ids. (Formerly fed the `isCommissionAdmin`
   * mirror in `canCorrect`; QO·B M5 cut that arm — ADR 0100 D12. Kept in the
   * select for shape stability.) */
  commissions: { organization_id: string; hospital_id: string }
}

interface DetailAnswerRow {
  item_id: string
  question_key: string
  value: Json | null
  observation: string | null
  /** "Outros" open option: the typed Outro value (null unless `__other__` selected). */
  other_text: string | null
  /** FF-1: the repeating-group instance, or `null` for a top-level answer. */
  group_instance_id: string | null
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
/** The keyset sort-tuple encoded in a `listSubmissions` cursor. Private to this
 * function; callers treat the cursor as opaque. */
interface SubmissionCursor {
  /** `submitted_at` of the last row (null for an in_progress row). */
  s: string | null
  /** `updated_at` of the last row. */
  u: string
  /** `id` of the last row (final tie-breaker). */
  id: string
}

/** Validation schema for the cursor fields (WS-6 QA hardening): every field is an
 * ISO timestamp or a UUID, structurally excluding the `.or()` metacharacters. A
 * tampered value → the cursor is rejected (→ page 1). */
const SUBMISSION_CURSOR_SCHEMA: CursorSchema<SubmissionCursor> = {
  s: 'timestamp',
  u: 'timestamp',
  id: 'uuid',
}

export async function listSubmissions(
  commissionId: string,
  filters: SubmissionFilters,
  page?: PageParams,
): Promise<Page<SubmissionRow>> {
  const supabase = await createClient()

  const limit = page?.limit ?? DEFAULT_PAGE_SIZE
  const cursor = decodeCursor<SubmissionCursor>(
    page?.cursor,
    SUBMISSION_CURSOR_SCHEMA,
  )

  // `!inner` on the version/form embeds: a response whose form_version (or its
  // form) is no longer readable — e.g. the form was deleted, orphaning the
  // version — cannot render a title and is dropped here rather than resolving to
  // a null embed that would crash the whole page. Keeps the embed types non-null.
  let query = supabase
    .from('responses')
    .select(
      'id, form_version_id, status, started_at, updated_at, submitted_at, ' +
        'case_phase_id, created_by, supersedes_id, profiles:created_by(full_name), ' +
        'form_versions!inner(form_id, version_number, forms!inner(title))',
    )
    .eq('commission_id', commissionId)

  query = filters.includeInProgress
    ? query.in('status', ['submitted', 'in_progress'])
    : query.eq('status', 'submitted')

  if (filters.memberId) query = query.eq('created_by', filters.memberId)
  // P5 (WS-6): the form filter is pushed to the DB through the `!inner` version
  // embed — filtering an embedded column via the dotted `.eq` path (the embed is
  // already `!inner`, so this is a real join filter, not a null-embed drop). The
  // former "not filterable inline" comment + client-side `.filter` were wrong.
  if (filters.formId) query = query.eq('form_versions.form_id', filters.formId)
  if (filters.from) query = query.gte('submitted_at', filters.from)
  if (filters.to) query = query.lte('submitted_at', `${filters.to}T23:59:59.999Z`)

  // Keyset (WS-6 P3): rows strictly AFTER the cursor in
  // (submitted_at DESC NULLS LAST, updated_at DESC, id DESC) order. Applied only
  // to `submitted` rows (they always carry submitted_at); the opt-in in_progress
  // rows (submitted_at null, nullsFirst:false → they sort last) are a bounded tail
  // the caller reaches on the final page — this list is dominated by submitted rows,
  // so a submitted-anchored cursor is the correct keyset. `.or` expresses the
  // 3-column tuple comparison PostgREST cannot do as a row-value.
  if (cursor && cursor.s !== null) {
    const s = cursor.s
    query = query.or(
      `submitted_at.lt.${s},` +
        `and(submitted_at.eq.${s},updated_at.lt.${cursor.u}),` +
        `and(submitted_at.eq.${s},updated_at.eq.${cursor.u},id.lt.${cursor.id})`,
    )
  }

  // Over-fetch by one to detect a next page without a separate count.
  const { data } = await query
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)
    .returns<SubmissionListRow[]>()

  const fetched = data ?? []
  const hasMore = fetched.length > limit
  const pageRows = hasMore ? fetched.slice(0, limit) : fetched

  // SUP (ADR 0074): resolve each row's supersession badge in ONE batched lookup
  // (never N+1). A row is `'substituido'` when a SUBMITTED successor points at it
  // (the same "latest-in-chain" exclusion the aggregation uses — an in_progress
  // successor doesn't yet mark the predecessor superseded); `'atual'` when the row
  // IS a successor (its own supersedes_id is non-null, already fetched above);
  // otherwise `null`. `'substituido'` takes precedence in the rare chain where a
  // row is both. RLS-scoped via the same cookie client — a caller who can't read
  // a successor simply doesn't get the `'substituido'` mark (safe under-badging,
  // never a leak). The keyset/cursor shape is untouched — badge is purely additive.
  const supersededIds = new Set<string>()
  if (pageRows.length > 0) {
    const { data: successors } = await supabase
      .from('responses')
      .select('supersedes_id')
      .in('supersedes_id', pageRows.map((r) => r.id))
      .eq('status', 'submitted')
      .returns<{ supersedes_id: string | null }[]>()
    for (const s of successors ?? []) {
      if (s.supersedes_id != null) supersededIds.add(s.supersedes_id)
    }
  }

  const badgeFor = (r: SubmissionListRow): SupersessionBadge =>
    resolveSupersessionBadge({
      hasSubmittedSuccessor: supersededIds.has(r.id),
      isSuccessor: r.supersedes_id != null,
    })

  const rows = pageRows.map(
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
      badge: badgeFor(r),
    }),
  )

  const last = pageRows[pageRows.length - 1]
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          s: last.submitted_at,
          u: last.updated_at,
          id: last.id,
        } satisfies SubmissionCursor)
      : null

  return { rows, nextCursor }
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
        'case_phase_id, created_by, supersedes_id, profiles:created_by(full_name), ' +
        // `!inner`: an orphaned response (its form deleted) resolves to no row
        // here → clean null → friendly 404, never a null-embed crash.
        'form_versions!inner(form_id, version_number, forms!inner(title)), ' +
        // SUP: the commission's org/hospital ids, to mirror is_tenancy_admin_of.
        'commissions:commission_id!inner(organization_id, hospital_id)',
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
  // answer-model-v2: selections hang off the parent answers row (answer_id); embed
  // the parent answer to recover item_id, then flatten to the twin's unchanged
  // { item_id, option_id } input shape.
  // FF-1: `group_instance_id` on both sides + the instance rows. Without the
  // scope every instance answer folds into the top-level maps and the last one
  // wins per key (the TS twin of ADR 0087 substrate correction 5).
  // FF-2 (ADR 0089): the two matrix tables join the fan-out for the SAME reason
  // FF-1 added the instance rows — a reader of a submitted response was shown
  // every answer shape except the grids, which rendered empty.
  const [
    { data: answers },
    { data: selectionRows },
    { data: instanceRows },
    { data: cellRows },
    { data: riskRows },
    { data: referenceRows },
  ] =
    await Promise.all([
      supabase
        .from('answers')
        .select(
          'item_id, question_key, value, observation, other_text, group_instance_id',
        )
        .eq('response_id', responseId)
        .returns<DetailAnswerRow[]>(),
      supabase
        .from('answer_selected_options')
        .select('option_id, answers!inner(item_id, response_id, group_instance_id)')
        .eq('answers.response_id', responseId)
        .returns<
          {
            option_id: string
            answers: {
              item_id: string
              response_id: string
              group_instance_id: string | null
            }
          }[]
        >(),
      supabase
        .from('response_group_instances')
        .select('id, group_item_id, position')
        .eq('response_id', responseId)
        .returns<GroupInstanceRow[]>(),
      supabase
        .from('answer_matrix_cells')
        .select('row_id, col_id, answers!inner(item_id, response_id, group_instance_id)')
        .eq('answers.response_id', responseId)
        .returns<ScopedMatrixCellRow[]>(),
      supabase
        .from('answer_risk_matrix')
        .select(
          'severity_row_id, likelihood_col_id, risk_score, ' +
            'answers!inner(item_id, response_id, group_instance_id)',
        )
        .eq('answers.response_id', responseId)
        .returns<ScopedRiskMatrixRow[]>(),
      // FF-5 (ADR 0091): the reference targets. FK-hinted embeds for the same
      // reason as in getResponseForFill — an un-hinted embed resolves by table
      // name and answers PGRST201 the day a second FK path to one of these
      // tables appears anywhere reachable.
      supabase
        .from('answer_references')
        .select(
          'reference_kind, participant_id, commission_id, profile_id, ' +
            'answers!inner(item_id, response_id, group_instance_id), ' +
            'participants!answer_references_participant_id_fkey(display_name, participant_type), ' +
            'commissions!answer_references_commission_id_fkey(name), ' +
            'profiles!answer_references_profile_id_fkey(full_name, email)',
        )
        .eq('answers.response_id', responseId)
        .returns<ScopedReferenceRow[]>(),
    ])

  const selections: ScopedSelectionRow[] = (selectionRows ?? []).map((s) => ({
    item_id: s.answers.item_id,
    option_id: s.option_id,
    group_instance_id: s.answers.group_instance_id,
  }))

  const scopedAnswers: ScopedAnswerRow[] = answers ?? []
  const topLevelAnswers = scopedAnswers.filter(
    (a) => a.group_instance_id === null,
  )
  const topLevelSelections = selections.filter(
    (s) => s.group_instance_id === null,
  )

  // form-model-normalization: canonical maps (single→scalar code, checkbox→code
  // array, scalars→raw) via the shared app.answer_map sibling — top-level only.
  const { answersByItemId, answersByKey } = buildAnswerMaps(
    tree,
    topLevelAnswers,
    topLevelSelections,
  )

  const observationsByItemId: Record<string, string> = {}
  const otherTextByItemId: Record<string, string> = {}
  for (const a of topLevelAnswers) {
    if (a.observation != null && a.observation !== '') {
      observationsByItemId[a.item_id] = a.observation
    }
    if (a.other_text != null && a.other_text !== '') {
      otherTextByItemId[a.item_id] = a.other_text
    }
  }

  const signoffs = await getResponseSignoffs(responseId)

  // SUP (ADR 0074): resolve the successor that points at THIS response (if
  // any) — a live successor exists regardless of its own status (in_progress
  // OR submitted); `canCorrect` only needs "does one exist at all" (mirrors
  // the RPC's HC0H2 check), and the badge distinguishes further by the
  // successor's status only for cosmetic labeling (both non-null cases show
  // "substituído" — the predecessor reads the same whether the fix is still
  // being drafted or already landed).
  const { data: successor } = await supabase
    .from('responses')
    .select('id, status')
    .eq('supersedes_id', responseId)
    .maybeSingle<{ id: string; status: string }>()

  const supersededById = successor?.id ?? null
  const supersedesId = response.supersedes_id

  const badge: SupersessionBadge = supersededById != null
    ? 'substituido'
    : supersedesId != null
      ? 'atual'
      : null

  // canCorrect: flag ON && staff_admin/commission-admin of the commission &&
  // standalone && submitted && no live successor. Computed server-side so the
  // frontend never re-derives authority (Rule 1 — RLS is the boundary; this is
  // UI gating only, mirroring the RPC's own preconditions so the affordance
  // never renders when the RPC would refuse it).
  let canCorrect = false
  if (
    (await responseCorrectionEnabled()) &&
    response.status === 'submitted' &&
    response.case_phase_id == null &&
    supersededById == null
  ) {
    const session = await getSessionContext()
    if (session) {
      // Mirrors the RPC's authority gate EXACTLY: is_staff_admin_of ONLY.
      // ⛔ QO·B M5 (ADR 0100 D12) CUT the is_tenancy_admin_of arm from
      // `supersede_response` — response correction is committee CONTENT, walled
      // off from the tenancy admins. The former `isCommissionAdmin(...)` arm
      // here was this mirror gone stale: it rendered "Corrigir" to an org_admin
      // whose RPC call then raised 42501. No is_admin() fallback either
      // (platform admins are walled off from tenant data by design, ADR 0041).
      canCorrect = session.memberships.some(
        (m) => m.commission.id === response.commission_id && m.role === 'staff_admin',
      )
    }
  }

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

  // FF-2: resolve axis ids to CODES through the tree, exactly as
  // getResponseForFill does, so both readers shape the grid identically.
  const matrixByScope = buildMatrixAnswers(tree, cellRows ?? [], riskRows ?? [])
  const topLevelMatrix = matrixByScope.get(TOP_LEVEL_SCOPE)
  // FF-5: same scoping, same shared pure builder as getResponseForFill.
  const referencesByScope = buildReferenceAnswers(referenceRows ?? [])

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
    supersedesId,
    supersededById,
    badge,
    canCorrect,
    tree,
    answersByItemId,
    answersByKey,
    observationsByItemId,
    otherTextByItemId,
    matrixCellsByItemId: topLevelMatrix?.matrixCellsByItemId ?? {},
    riskMatrixByItemId: topLevelMatrix?.riskMatrixByItemId ?? {},
    referencesByItemId: referencesByScope.get(TOP_LEVEL_SCOPE) ?? {},
    instances: buildGroupInstances(
      tree,
      instanceRows ?? [],
      scopedAnswers,
      selections,
      answersByKey,
    ).map((instance) => {
      const ownMatrix = matrixByScope.get(instance.id)
      const ownReferences = referencesByScope.get(instance.id)
      return {
        ...instance,
        ...(ownMatrix ?? {}),
        ...(ownReferences ? { referencesByItemId: ownReferences } : {}),
      }
    }),
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
    // `!inner` drops responses whose form/version is no longer readable (e.g. an
    // orphaned response left by a deleted form) so the filter never crashes.
    .select('form_versions!inner(form_id, forms!inner(title))')
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
