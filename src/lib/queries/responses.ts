import { createClient } from '@/lib/supabase/server'
import { CHOICE_ITEM_TYPES, getVersionTree } from '@/lib/queries/forms'
import type { Json } from '@/lib/types/database'
import type {
  Item,
  VersionTree,
  VersionStatus,
} from '@/lib/queries/forms'

// Re-export the form tree shapes so the wizard can import everything it renders
// (sections, items, the answerable-questions filter) from this one module.
export type {
  VersionTree,
  Section,
  Item,
  ItemType,
  InputItemType,
  DisplayItemType,
  SignoffRole,
  SectionTextContent,
  ImageContent,
} from '@/lib/queries/forms'
export type { VisibleWhen, ConditionOp, AnswerMap } from '@/lib/queries/conditions'
export { answerableItems } from '@/lib/queries/forms'

/**
 * Response-fill data-access (Architecture Rule 9 — all reads go through
 * `src/lib/queries/`). Backs the staff form list (`/c/[slug]/forms`), the
 * wizard (render + resume), and the "minhas respostas" history. Every read uses
 * the cookie-wired (RLS-scoped) server client:
 *   - `forms_select` / `form_versions_select` (M6) expose PUBLISHED versions to
 *     any member of the commission (drafts only to staff_admins);
 *   - `responses_select` returns the caller's own responses (any status) and a
 *     staff_admin the SUBMITTED ones of their commission;
 *   - `answers_select` mirrors the parent-response visibility.
 *
 * Gate the calling page on commission membership before rendering — RLS returns
 * no rows to a non-member, but a friendly pt-BR 404/forbidden is the page's job.
 *
 * The mutation side (start/resume, save, submit) lives in
 * `src/lib/responses/actions.ts`; this module is read-only.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type ResponseStatus = 'in_progress' | 'submitted'

/**
 * One row in the staff form list: a form whose CURRENT published version is
 * fillable, plus whether the caller already has an in_progress draft on that
 * version (so the UI shows "continuar preenchimento" vs "preencher").
 */
export interface FillableForm {
  formId: string
  title: string
  description: string | null
  /** The current published version the wizard fills. */
  publishedVersionId: string
  publishedVersionNumber: number
  /** The caller's existing in_progress response on this version, if any. */
  inProgressResponseId: string | null
}

/**
 * Everything the wizard needs to render and resume a single response: the
 * version-faithful section/item tree, the saved answers (question_key → value),
 * and the lifecycle/resume metadata. `lastSectionId` lands the user back on
 * their last section; `answers` rehydrates the form controls.
 */
export interface ResponseForFill {
  id: string
  formVersionId: string
  formId: string
  formTitle: string
  commissionId: string
  status: ResponseStatus
  lastSectionId: string | null
  /** The full published-version tree (sections + items in order). */
  tree: VersionTree
  /** Saved answers keyed by item_id (drives form-control rehydration). */
  answersByItemId: Record<string, Json>
  /** Saved answers keyed by question_key (drives the TS condition evaluator). */
  answersByKey: Record<string, Json>
  /** Saved per-item observation notes keyed by item_id (form-builder
   * enhancements, decision #11), non-null only. Drives the wizard's pre-filled
   * observation affordance on resume. */
  observationsByItemId: Record<string, string>
  /** Saved per-item "Outros" free text keyed by item_id ("Outros" open option),
   * non-null only. Drives the wizard's pre-filled Outro text input on resume (shown
   * when the item's reserved `__other__` option is selected). */
  otherTextByItemId: Record<string, string>
}

/** One row in the "minhas respostas" history (submitted + in_progress). */
export interface MyResponse {
  id: string
  formId: string
  formTitle: string
  formVersionId: string
  versionNumber: number
  status: ResponseStatus
  startedAt: string
  updatedAt: string
  submittedAt: string | null
}

// ---------------------------------------------------------------------------
// Row shapes (PostgREST embeds)
// ---------------------------------------------------------------------------

interface AnswerRow {
  item_id: string
  question_key: string
  value: Json | null
  observation: string | null
  /** "Outros" open option: the typed Outro value, non-null only when the item's
   * reserved `__other__` option is selected. */
  other_text?: string | null
  // answer-model-v2 (BE-0): the uniform-answer contemporaneous timestamp.
  // Optional here so the mapper is safe before BE-2 adds the column; selected
  // once BE-2/BE-5 land it.
  answered_at?: string
}

/**
 * answer-model-v2 (BE-0 contract, ADR 0045): the public read shape for one saved
 * answer as the frontend consumes it. `value` stays the CANONICAL scalar the
 * evaluator reads (single→option code, checkbox→ordered code array, scalars→raw);
 * the typed columns (`value_number`/`value_date`/`value_time`) are read-only
 * analytics denormalizations and are intentionally NOT surfaced in fill.
 * `answeredAt` is the contemporaneous per-answer timestamp (ALCOA+), sourced from
 * the new `answers.answered_at`.
 */
export interface AnswerRecord {
  itemId: string
  questionKey: string
  value: Json | null
  observation: string | null
  /** "Outros" open option: the typed Outro value (null unless `__other__` selected). */
  otherText: string | null
  answeredAt: string
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * The commission's fillable forms — those with a CURRENT published version —
 * each annotated with the caller's in_progress response on that version (if
 * any). PUBLISHED versions only (archived/draft are not fillable). Sorted by
 * title (pt-BR). Returns `[]` when the caller may not read the commission.
 *
 * Two round trips: (1) forms + their published versions; (2) the caller's
 * in_progress responses across those versions. The second is scoped to the
 * caller by `responses_select` (own rows), so no other member's draft leaks.
 */
export async function listFillableForms(
  commissionId: string,
): Promise<FillableForm[]> {
  const supabase = await createClient()

  const { data: forms } = await supabase
    .from('forms')
    .select('id, title, description, form_versions(id, version_number, status)')
    .eq('commission_id', commissionId)
    .returns<
      {
        id: string
        title: string
        description: string | null
        form_versions: {
          id: string
          version_number: number
          status: string
        }[]
      }[]
    >()

  // Keep only forms with a current published version (the fillable target).
  const fillable = (forms ?? [])
    .map((form) => {
      const published = form.form_versions.find(
        (v) => (v.status as VersionStatus) === 'published',
      )
      return published
        ? {
            formId: form.id,
            title: form.title,
            description: form.description,
            publishedVersionId: published.id,
            publishedVersionNumber: published.version_number,
          }
        : null
    })
    .filter((f): f is Omit<FillableForm, 'inProgressResponseId'> => f != null)

  if (fillable.length === 0) return []

  // Annotate each with the caller's in_progress response on that version.
  const versionIds = fillable.map((f) => f.publishedVersionId)
  const { data: drafts } = await supabase
    .from('responses')
    .select('id, form_version_id')
    .in('form_version_id', versionIds)
    .eq('status', 'in_progress')
    .returns<{ id: string; form_version_id: string }[]>()

  const draftByVersion = new Map<string, string>()
  for (const d of drafts ?? []) draftByVersion.set(d.form_version_id, d.id)

  return fillable
    .map((f) => ({
      ...f,
      inProgressResponseId: draftByVersion.get(f.publishedVersionId) ?? null,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
}

interface ResponseRow {
  id: string
  form_version_id: string
  commission_id: string
  status: string
  last_section_id: string | null
  form_versions: {
    form_id: string
    forms: { title: string }
  }
}

/** One selection as `buildAnswerMaps` consumes it (item_id + selected option id).
 * This is the twin's INPUT contract and is intentionally UNCHANGED by
 * answer-model-v2 — the query flattens the new answer_id embed to this shape. */
export interface SelectionRow {
  item_id: string
  option_id: string
}

/**
 * answer-model-v2: the read shape from `answer_selected_options` after the
 * re-key. Selections carry `answer_id` (not item_id/response_id); we embed the
 * parent answer to recover `item_id` + the response scope, then flatten to
 * {@link SelectionRow} for the twin.
 */
interface SelectionEmbedRow {
  option_id: string
  answers: { item_id: string; response_id: string }
}

/**
 * Build the canonical `answersByItemId` + `answersByKey` maps from the normalized
 * model (form-model-normalization, BE-3) — the TS sibling of the SQL
 * `app.answer_map`, producing the IDENTICAL per-value shapes so the wizard's
 * initial map agrees with its live map and with the submit-time evaluator:
 *   - single-select (multiple_choice/dropdown) → the selected option's CODE
 *     (scalar string);
 *   - checkbox → an ARRAY of selected codes ordered by option.position;
 *   - scalar inputs (free_text/short_text/number/date/time) → the raw
 *     `answers.value`.
 * A choice item with NO selection contributes no entry (missing-answer
 * semantics). `tree` supplies each item's type + option `id → {code, position}`,
 * so no extra round-trip is needed to resolve codes.
 *
 * Both maps are keyed identically per item: `answersByItemId[item.id]` and
 * `answersByKey[item.questionKey]` hold the same value, so `prepare.ts` and the
 * read-only views (which read by item_id) and the TS evaluator (which reads by
 * question_key) both see the canonical shape.
 */
export function buildAnswerMaps(
  tree: VersionTree,
  scalarAnswers: { item_id: string; question_key: string; value: Json | null }[],
  selections: SelectionRow[],
): {
  answersByItemId: Record<string, Json>
  answersByKey: Record<string, Json>
} {
  const answersByItemId: Record<string, Json> = {}
  const answersByKey: Record<string, Json> = {}

  // Index every item once: id → the Item (type, questionKey, option rows).
  const itemsById = new Map<string, Item>()
  for (const section of tree.sections) {
    for (const item of section.items) itemsById.set(item.id, item)
  }

  // (a) Scalar answers — non-choice input items only (choice items leave
  // answers.value null in the normalized model; ignore any stray non-null value
  // on a choice item, mirroring the SQL answer_map which sources choice answers
  // solely from selections).
  for (const a of scalarAnswers) {
    if (a.value === null) continue
    const item = itemsById.get(a.item_id)
    if (!item) continue
    if (CHOICE_ITEM_TYPES.includes(item.itemType as (typeof CHOICE_ITEM_TYPES)[number])) {
      continue
    }
    answersByItemId[a.item_id] = a.value
    answersByKey[a.question_key] = a.value
  }

  // (b/c) Choice selections — group the selected option ids per item, resolve to
  // codes via the item's option rows, ordered by option.position.
  const selectedByItem = new Map<string, Set<string>>()
  for (const s of selections) {
    let set = selectedByItem.get(s.item_id)
    if (!set) {
      set = new Set<string>()
      selectedByItem.set(s.item_id, set)
    }
    set.add(s.option_id)
  }

  for (const [itemId, selectedIds] of selectedByItem) {
    const item = itemsById.get(itemId)
    if (!item || !item.questionKey) continue
    // The item's options carry { id, code, position }; sort by position then map
    // the SELECTED ones to their codes (same ordering as the SQL array).
    const codes = (item.options ?? [])
      .filter((o) => selectedIds.has(o.id))
      .sort((x, y) => x.position - y.position)
      .map((o) => o.code)
    if (codes.length === 0) continue // missing-answer semantics

    const value: Json =
      item.itemType === 'checkbox'
        ? codes
        : // single-select (multiple_choice/dropdown): one code as a scalar.
          codes[0]
    answersByItemId[item.id] = value
    answersByKey[item.questionKey] = value
  }

  return { answersByItemId, answersByKey }
}

/**
 * A single response prepared for the wizard: the published-version tree, the
 * saved answers (both by item_id and by question_key), and the resume metadata.
 * `null` when the response is not visible to the caller (RLS) or not found.
 *
 * Reuses `getVersionTree` (the same version-faithful section/item embed the
 * builder reads) so the wizard render never drifts from the stored structure.
 */
export async function getResponseForFill(
  responseId: string,
): Promise<ResponseForFill | null> {
  const supabase = await createClient()

  const { data: response } = await supabase
    .from('responses')
    .select(
      'id, form_version_id, commission_id, status, last_section_id, ' +
        // `!inner`: an orphaned response (form deleted) resolves to no row → null
        // → friendly 404, never a null-embed crash.
        'form_versions!inner(form_id, forms!inner(title))',
    )
    .eq('id', responseId)
    .maybeSingle<ResponseRow>()

  if (!response) return null

  // The version tree (sections + items in order) — same embed as the builder.
  const tree = await getVersionTree(response.form_version_id)
  if (!tree) return null

  // Scalar answers (+ observations) and choice selections in parallel.
  // answer-model-v2: selections now hang off the parent answers row (answer_id),
  // so resolve each selection's item_id/response scope through the embedded
  // answer. buildAnswerMaps still consumes the { item_id, option_id } shape (its
  // input contract is UNCHANGED) — we flatten the embed to that shape below.
  const [{ data: answers }, { data: selectionRows }] = await Promise.all([
    supabase
      .from('answers')
      .select('item_id, question_key, value, observation, other_text')
      .eq('response_id', responseId)
      .returns<AnswerRow[]>(),
    supabase
      .from('answer_selected_options')
      .select('option_id, answers!inner(item_id, response_id)')
      .eq('answers.response_id', responseId)
      .returns<SelectionEmbedRow[]>(),
  ])

  // Flatten the answer_id embed to the twin's { item_id, option_id } input shape.
  const selections: SelectionRow[] = (selectionRows ?? []).map((s) => ({
    item_id: s.answers.item_id,
    option_id: s.option_id,
  }))

  // form-model-normalization: rebuild the canonical maps (single→scalar code,
  // checkbox→code array, scalars→raw) — the TS sibling of app.answer_map.
  const { answersByItemId, answersByKey } = buildAnswerMaps(
    tree,
    answers ?? [],
    selections,
  )

  // Observations are collected independently of the value guard (an observation
  // can accompany a null value via an observation-only upsert).
  const observationsByItemId: Record<string, string> = {}
  const otherTextByItemId: Record<string, string> = {}
  for (const a of answers ?? []) {
    if (a.observation !== null && a.observation !== '') {
      observationsByItemId[a.item_id] = a.observation
    }
    if (a.other_text != null && a.other_text !== '') {
      otherTextByItemId[a.item_id] = a.other_text
    }
  }

  return {
    id: response.id,
    formVersionId: response.form_version_id,
    formId: response.form_versions.form_id,
    formTitle: response.form_versions.forms.title,
    commissionId: response.commission_id,
    status: response.status as ResponseStatus,
    lastSectionId: response.last_section_id,
    tree,
    answersByItemId,
    answersByKey,
    observationsByItemId,
    otherTextByItemId,
  }
}

interface MyResponseRow {
  id: string
  form_version_id: string
  status: string
  started_at: string
  updated_at: string
  submitted_at: string | null
  form_versions: {
    form_id: string
    version_number: number
    forms: { commission_id: string; title: string }
  }
}

/**
 * The caller's responses in a commission — submitted AND in_progress —
 * newest-activity first, for the "minhas respostas" history. Scoped to the
 * caller by `responses_select` (own rows, any status). The commission filter is
 * applied through the version's form so a single embed resolves title +
 * commission.
 */
export async function listMyResponses(
  commissionId: string,
): Promise<MyResponse[]> {
  const supabase = await createClient()

  // `!inner` on the version/form embeds: a response whose form was deleted
  // (orphaning its version) can't render a title and is dropped here rather than
  // resolving to a null embed that would crash the "minhas respostas" page.
  const { data } = await supabase
    .from('responses')
    .select(
      'id, form_version_id, status, started_at, updated_at, submitted_at, ' +
        'form_versions!inner(form_id, version_number, forms!inner(commission_id, title))',
    )
    .eq('commission_id', commissionId)
    .order('updated_at', { ascending: false })
    .returns<MyResponseRow[]>()

  return (data ?? []).map((r) => ({
    id: r.id,
    formId: r.form_versions.form_id,
    formTitle: r.form_versions.forms.title,
    formVersionId: r.form_version_id,
    versionNumber: r.form_versions.version_number,
    status: r.status as ResponseStatus,
    startedAt: r.started_at,
    updatedAt: r.updated_at,
    submittedAt: r.submitted_at,
  }))
}

// `answerableItems(tree)` (the canonical "answerable questions of a version"
// filter, Architecture Rule 9) is re-exported at the top from forms.ts; the
// wizard and review screen enumerate input items through it and never inline the
// item_type filter.
