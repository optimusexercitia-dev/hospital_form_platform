import { createClient } from '@/lib/supabase/server'
import {
  CHOICE_ITEM_TYPES,
  flattenItem,
  getVersionTree,
} from '@/lib/queries/forms'
import type { Json } from '@/lib/types/database'
import type {
  Item,
  VersionTree,
  VersionStatus,
} from '@/lib/queries/forms'
import { overlayAnswerMap } from '@/lib/queries/conditions'
import type { AnswerMap } from '@/lib/queries/conditions'
// FF-5 (ADR 0091). From the PURE module, never from `@/lib/queries/forms`: the
// wizard is a Client Component and this file's shapes travel with it.
import { toReferenceKind } from '@/lib/forms/reference-constants'
import type {
  ReferenceCandidate,
  ReferenceKind,
} from '@/lib/forms/reference-constants'

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
/**
 * FF-1 (BE-0 contract, ADR 0087) — ONE repeating-group instance of a response,
 * with everything needed to render and evaluate it. Shared by the fill wizard
 * ({@link ResponseForFill}) and the read-only submission view
 * (`SubmissionDetail`), so both render instances identically.
 *
 * `answersByKey` is the RESOLVED evaluator map for items inside this instance:
 * the response's top-level map overlaid with this instance's own answers, via the
 * parity-locked `overlayAnswerMap` (Rule 3). The frontend must NEVER compose that
 * overlay itself — pass this map straight to `evalVisibility` when evaluating a
 * child's `visibleWhen`, and the response-level `answersByKey` for everything
 * outside a repeating group.
 *
 * A plain `group` (ADR 0087 ruling 6) produces NO instances: its children answer
 * at top level and appear in the response-level maps like any flat item.
 */
export interface GroupInstance {
  /** `response_group_instances.id` — the value to send back as `instanceId`. */
  id: string
  /** The owning `repeating_group` item (`response_group_instances.group_item_id`). */
  groupItemId: string
  /** 0-based order within its group; kept contiguous by the instance RPCs. */
  position: number
  /** This instance's answers keyed by item_id (drives control rehydration). */
  answersByItemId: Record<string, Json>
  /** Top-level map ⊕ this instance's answers, keyed by question_key. */
  answersByKey: AnswerMap
  /** This instance's per-item observation notes, non-null only. */
  observationsByItemId: Record<string, string>
  /** This instance's per-item "Outros" free text, non-null only. */
  otherTextByItemId: Record<string, string>
  /**
   * FF-2: this instance's saved matrix grids, `{ itemId: { rowCode: colCode } }`.
   * REQUIRED as of FUP-FF2-1. It was optional only because
   * `get_response_for_signoff` did not project the matrix tables; that door now
   * does, and `getSubmissionDetail` was wired at the same time, so ALL THREE
   * producers of a GroupInstance populate these. Optionality here would now only
   * hide a producer that forgot — the exact failure the field was documenting.
   */
  matrixCellsByItemId: Record<string, Record<string, string>>
  /** FF-2: this instance's saved risk answers, `{ itemId: RiskMatrixAnswer }`. */
  riskMatrixByItemId: Record<string, RiskMatrixAnswer>
  /**
   * FF-5 (ADR 0091): this instance's saved references, `{ itemId: ReferenceAnswer }`.
   *
   * REQUIRED, for the reason FF-2 made its two siblings required rather than
   * optional: a reference inside a repeating group reaches every read surface
   * through the per-instance path and no other, so an optional field here would
   * silently excuse a producer that forgot — which is the failure the field
   * exists to prevent.
   */
  referencesByItemId: Record<string, ReferenceAnswer>
}

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
  /**
   * FF-1 (BE-0 contract): the response's repeating-group instances, ordered by
   * (groupItemId, position). `[]` until the builder can author a container.
   * Group them by {@link GroupInstance.groupItemId} to render each container.
   * The four response-level maps above hold TOP-LEVEL answers only — an
   * instance's answers live on its {@link GroupInstance}, never in them.
   */
  instances: GroupInstance[]
  /**
   * FF-2 (BE contract, ADR 0089) — saved TOP-LEVEL matrix grids, keyed by matrix
   * item id → `{ [rowCode]: colCode }`. Send this straight back as
   * `saveSection({ matrixCellsByItemId })`; it is the same shape in both
   * directions, addressed by clone-stable CODES on both axes.
   *
   * A matrix inside a repeating group is NOT here — it lives on its
   * {@link GroupInstance.matrixCellsByItemId}, exactly as scalar answers do.
   */
  matrixCellsByItemId: Record<string, Record<string, string>>
  /**
   * FF-2 — saved TOP-LEVEL risk answers, keyed by risk_matrix item id.
   * `riskScore` is READ-ONLY (server-derived); send back only
   * `{ severity, likelihood }`.
   */
  riskMatrixByItemId: Record<string, RiskMatrixAnswer>
  /**
   * FF-5 (BE contract, ADR 0091) — saved TOP-LEVEL references, keyed by
   * reference item id.
   *
   * `targetId` is what goes back on save (`saveSection({ referencesByItemId })`);
   * `label`/`sublabel` are READ-ONLY presentation, resolved by live join on every
   * read and deliberately never snapshotted (ruling 4) — so a renamed
   * participant or retitled commission shows its CURRENT name here and keeps its
   * historical aggregation whole.
   *
   * A reference inside a repeating group is NOT here — it lives on its
   * {@link GroupInstance.referencesByItemId}, exactly as matrix answers do.
   */
  referencesByItemId: Record<string, ReferenceAnswer>
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
  /** FF-1: the repeating-group instance this answer belongs to; `null` = top
   *  level (including a plain `group`'s children, per ADR 0087 ruling 6). */
  group_instance_id: string | null
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
  answers: {
    item_id: string
    response_id: string
    /** FF-1: the instance scope, resolved through the parent answer. */
    group_instance_id: string | null
  }
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
  // FF-1: `flattenItem` is mandatory here. `Section.items` holds only TOP-LEVEL
  // items now, and per ADR 0087 ruling 6 a plain `group`'s children answer at TOP
  // LEVEL — so a flat walk would leave them out of `itemsById`, the consumer's
  // `if (!item) continue` would drop their answers from BOTH maps, and nothing
  // would throw. Wrong answers, silently.
  const itemsById = new Map<string, Item>()
  for (const section of tree.sections) {
    for (const item of section.items.flatMap(flattenItem)) {
      itemsById.set(item.id, item)
    }
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

/** One `response_group_instances` row as the readers select it. */
export interface GroupInstanceRow {
  id: string
  group_item_id: string
  position: number
}

/** An answer row carrying its instance scope. `null` = top level. */
export interface ScopedAnswerRow {
  item_id: string
  question_key: string
  value: Json | null
  observation?: string | null
  other_text?: string | null
  group_instance_id: string | null
}

/** A selection carrying its instance scope, resolved through the parent answer. */
export interface ScopedSelectionRow extends SelectionRow {
  group_instance_id: string | null
}

/**
 * FF-1 (ADR 0087) — split a response's answers into the TOP-LEVEL maps and one
 * {@link GroupInstance} per repeating-group instance. The single read-side
 * builder; `getResponseForFill`, `getSubmissionDetail` and the sign-off view all
 * go through it so none of them can drift on what "this instance's answers" means.
 *
 * Two things it fixes that are easy to get wrong, and that fail SILENTLY:
 *   1. the top-level maps are built from `group_instance_id === null` rows ONLY.
 *      Feeding every row to `buildAnswerMaps` folds instance answers into the
 *      top-level map and lets the LAST instance win per key — the exact TS twin
 *      of the defect ADR 0087 substrate correction 5 found in `app.answer_map`.
 *   2. each instance's `answersByKey` is the top-level map OVERLAID with that
 *      instance's own (ruling 2), through the parity-locked `overlayAnswerMap`,
 *      so a child inside an instance sees its same-instance siblings and the
 *      top-level answers — and a sibling this instance did not answer stays
 *      ABSENT rather than leaking in from another instance.
 */
export function buildGroupInstances(
  tree: VersionTree,
  instanceRows: GroupInstanceRow[],
  answers: ScopedAnswerRow[],
  selections: ScopedSelectionRow[],
  topLevelByKey: AnswerMap,
): GroupInstance[] {
  return instanceRows
    .slice()
    .sort(
      (a, b) =>
        a.group_item_id.localeCompare(b.group_item_id) || a.position - b.position,
    )
    .map((row) => {
      const own = answers.filter((a) => a.group_instance_id === row.id)
      const ownSelections = selections.filter(
        (s) => s.group_instance_id === row.id,
      )
      const maps = buildAnswerMaps(tree, own, ownSelections)

      const observationsByItemId: Record<string, string> = {}
      const otherTextByItemId: Record<string, string> = {}
      for (const a of own) {
        if (a.observation != null && a.observation !== '') {
          observationsByItemId[a.item_id] = a.observation
        }
        if (a.other_text != null && a.other_text !== '') {
          otherTextByItemId[a.item_id] = a.other_text
        }
      }

      return {
        id: row.id,
        groupItemId: row.group_item_id,
        position: row.position,
        answersByItemId: maps.answersByItemId,
        // Ruling 2: top-level ⊕ this instance, instance wins, absent stays absent.
        answersByKey: overlayAnswerMap(topLevelByKey, maps.answersByKey),
        observationsByItemId,
        otherTextByItemId,
        // FF-2: filled by `applyMatrixAnswers` in getResponseForFill. Left empty
        // here so this builder's signature (shared with getSubmissionDetail and
        // the sign-off view) stays unchanged.
        matrixCellsByItemId: {},
        riskMatrixByItemId: {},
        // FF-5: same posture — filled by the caller from
        // `buildReferenceAnswers`, so this shared builder's signature (used by
        // getResponseForFill AND getSubmissionDetail) stays unchanged.
        referencesByItemId: {},
      }
    })
}

/**
 * FF-2 (ADR 0089) — one saved `risk_matrix` answer, read side.
 *
 * `riskScore` is the SERVER-DERIVED product of the two axis weights, returned
 * read-only. It is never sent back on save (the writer recomputes it), so a
 * consumer must treat it as an output, never round-trip it as an input.
 */
export interface RiskMatrixAnswer {
  /** `form_matrix_rows.code` of the chosen severity row. */
  severity: string
  /** `form_matrix_columns.code` of the chosen likelihood column. */
  likelihood: string
  riskScore: number | null
}

/** One `answer_matrix_cells` row with its scope resolved through the answer. */
export interface ScopedMatrixCellRow {
  row_id: string
  col_id: string
  answers: { item_id: string; group_instance_id: string | null }
}

/** One `answer_risk_matrix` row with its scope resolved through the answer. */
export interface ScopedRiskMatrixRow {
  severity_row_id: string
  likelihood_col_id: string
  risk_score: number | null
  answers: { item_id: string; group_instance_id: string | null }
}

/** The matrix half of a response, split by instance scope (`null` = top level). */
export interface MatrixAnswerMaps {
  matrixCellsByItemId: Record<string, Record<string, string>>
  riskMatrixByItemId: Record<string, RiskMatrixAnswer>
}

/**
 * FF-2 — turn the raw cell/risk rows into the per-scope code-keyed maps the
 * wizard rehydrates from, keyed by `group_instance_id` (`null` → the top-level
 * bucket, stored under the `TOP_LEVEL_SCOPE` key).
 *
 * Axis ids are resolved to CODES through the TREE rather than through a
 * PostgREST embed on the two axis tables. Two reasons: the tree already carries
 * every `{id, code}` pair, so the embed would be a third and fourth round trip
 * for data in hand; and resolving through the same tree the renderer draws makes
 * it impossible for the rehydrated selection to reference an axis entry the grid
 * is not showing. A row/col id absent from the tree is DROPPED — the coherence
 * trigger makes that unreachable, and silently dropping beats rendering a
 * selection in a phantom cell.
 *
 * Exported and pure so the same shaping is unit-testable and reusable by the
 * submission-detail and sign-off readers when they grow a matrix view.
 */
export function buildMatrixAnswers(
  tree: VersionTree,
  cells: ScopedMatrixCellRow[],
  risks: ScopedRiskMatrixRow[],
): Map<string, MatrixAnswerMaps> {
  const codeById = new Map<string, string>()
  for (const section of tree.sections) {
    for (const item of section.items.flatMap(flattenItem)) {
      for (const entry of item.matrixRows ?? []) codeById.set(entry.id, entry.code)
      for (const entry of item.matrixColumns ?? []) codeById.set(entry.id, entry.code)
    }
  }

  const byScope = new Map<string, MatrixAnswerMaps>()
  const scopeOf = (instanceId: string | null): MatrixAnswerMaps => {
    const key = instanceId ?? TOP_LEVEL_SCOPE
    let bucket = byScope.get(key)
    if (!bucket) {
      bucket = { matrixCellsByItemId: {}, riskMatrixByItemId: {} }
      byScope.set(key, bucket)
    }
    return bucket
  }

  for (const cell of cells) {
    const rowCode = codeById.get(cell.row_id)
    const colCode = codeById.get(cell.col_id)
    if (rowCode === undefined || colCode === undefined) continue
    const bucket = scopeOf(cell.answers.group_instance_id)
    const grid = (bucket.matrixCellsByItemId[cell.answers.item_id] ??= {})
    grid[rowCode] = colCode
  }

  for (const risk of risks) {
    const severity = codeById.get(risk.severity_row_id)
    const likelihood = codeById.get(risk.likelihood_col_id)
    if (severity === undefined || likelihood === undefined) continue
    const bucket = scopeOf(risk.answers.group_instance_id)
    bucket.riskMatrixByItemId[risk.answers.item_id] = {
      severity,
      likelihood,
      riskScore: typeof risk.risk_score === 'number' ? risk.risk_score : null,
    }
  }

  return byScope
}

/** The {@link buildMatrixAnswers} bucket key for top-level (non-instance)
 *  answers. A UUID can never collide with it. */
export const TOP_LEVEL_SCOPE = '__top_level__'

// ---------------------------------------------------------------------------
// FF-5 (ADR 0091) — saved entity references, read side
// ---------------------------------------------------------------------------

/**
 * One saved `answer_references` row, resolved for display.
 *
 * `targetId` is the identity and the ONLY part that round-trips on save.
 * `label`/`sublabel` are resolved by LIVE JOIN at read time and are read-only
 * outputs — never send them back, and never persist them anywhere. Snapshotting
 * a label would freeze a patient surrogate or a pre-rename commission name into
 * an answer and would contradict the ratified aggregation contract, which keys
 * on the target id (ADR 0091 ruling 4 / ADR 0060 Gap 40).
 */
export interface ReferenceAnswer extends ReferenceCandidate {
  /** Which lane this reference targets. Authoritative on the item's `config`;
   *  echoed here so a renderer need not re-read the tree to know what it holds. */
  kind: ReferenceKind
}

/**
 * One `answer_references` row with its scope resolved through the answer, plus
 * the three lane label embeds. Only ONE of the three is ever non-null — the
 * `answer_references_kind_target_xor` CHECK makes any other state
 * unrepresentable in the table, not merely unusual.
 */
export interface ScopedReferenceRow {
  reference_kind: string
  participant_id: string | null
  commission_id: string | null
  profile_id: string | null
  answers: { item_id: string; group_instance_id: string | null }
  participants: { display_name: string | null; participant_type: string } | null
  commissions: { name: string } | null
  profiles: { full_name: string | null; email: string | null } | null
}

/**
 * FF-5 — turn raw reference rows into the per-scope maps the wizard rehydrates
 * from, keyed by `group_instance_id` (`null` → {@link TOP_LEVEL_SCOPE}).
 *
 * Exported and pure, like {@link buildMatrixAnswers}, so the shaping is
 * unit-testable and reusable by the submission-detail reader.
 *
 * A row whose `reference_kind` is not one of the three known lanes is DROPPED
 * rather than rendered with a guessed label. The kind CHECK makes that
 * unreachable today; dropping it keeps a future fourth lane (hospital/org, ADR
 * 0086 ruling 5) from rendering as a blank field in a client that predates it.
 */
export function buildReferenceAnswers(
  rows: ScopedReferenceRow[],
): Map<string, Record<string, ReferenceAnswer>> {
  const byScope = new Map<string, Record<string, ReferenceAnswer>>()

  for (const row of rows) {
    const kind = toReferenceKind(row.reference_kind)
    if (kind === null) continue

    // The XOR CHECK guarantees exactly one of these is populated, so the first
    // non-null is THE target — no per-kind branch needed to find it.
    const targetId = row.participant_id ?? row.commission_id ?? row.profile_id
    if (targetId === null) continue

    const label =
      kind === 'participant'
        ? row.participants?.display_name
        : kind === 'commission'
          ? row.commissions?.name
          : row.profiles?.full_name

    // The disambiguating second line. The patient lane's fuller form (the
    // participant's ROLE in the owning case) is resolved by the picker
    // (`reference_candidates`) and by the sign-off projection
    // (`app.references_by_item`), both of which have the case in scope; here the
    // participant TYPE is what is cheaply and always available.
    const sublabel =
      kind === 'participant'
        ? (row.participants?.participant_type ?? null)
        : kind === 'user'
          ? (row.profiles?.email ?? null)
          : null

    const key = row.answers.group_instance_id ?? TOP_LEVEL_SCOPE
    let bucket = byScope.get(key)
    if (!bucket) {
      bucket = {}
      byScope.set(key, bucket)
    }
    bucket[row.answers.item_id] = {
      kind,
      targetId,
      // `on delete restrict` on all three FKs makes a dangling target
      // impossible, so a null label means the ROW's own name column is null —
      // fall back to the id so the field is never rendered blank.
      label: label ?? targetId,
      sublabel,
    }
  }

  return byScope
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
  // FF-1: `group_instance_id` is selected on BOTH sides. Without it every
  // instance answer would land in the top-level maps and the last instance would
  // win per key — the TS twin of ADR 0087 substrate correction 5.
  // FF-2: the two matrix answer tables join the same parallel fan-out. Both hang
  // off `answer_id` (like answer_selected_options), so the scope is resolved
  // through the same `answers!inner` embed.
  // FF-5: `answer_references` joins the same fan-out on the same `answers!inner`
  // scope embed. Its three lane embeds are FK-HINTED
  // (`participants!answer_references_participant_id_fkey`, …) rather than named
  // bare: an un-hinted embed resolves by table name, and the day a second FK
  // path to one of these tables appears anywhere reachable, PostgREST answers
  // PGRST201 (ambiguous embed) instead of picking one. Pinning the FK is what
  // keeps this read from breaking because of an unrelated migration elsewhere.
  const [
    { data: answers },
    { data: selectionRows },
    { data: instanceRows },
    { data: cellRows },
    { data: riskRows },
    { data: referenceRows },
  ] = await Promise.all([
    supabase
      .from('answers')
      .select(
        'item_id, question_key, value, observation, other_text, group_instance_id',
      )
      .eq('response_id', responseId)
      .returns<AnswerRow[]>(),
    supabase
      .from('answer_selected_options')
      .select('option_id, answers!inner(item_id, response_id, group_instance_id)')
      .eq('answers.response_id', responseId)
      .returns<SelectionEmbedRow[]>(),
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

  // Flatten the answer_id embed to the twin's { item_id, option_id } input shape,
  // keeping the instance scope alongside it.
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

  // form-model-normalization: rebuild the canonical maps (single→scalar code,
  // checkbox→code array, scalars→raw) — the TS sibling of app.answer_map, which
  // as of FF-1 is likewise top-level-only.
  const { answersByItemId, answersByKey } = buildAnswerMaps(
    tree,
    topLevelAnswers,
    topLevelSelections,
  )

  // Observations are collected independently of the value guard (an observation
  // can accompany a null value via an observation-only upsert).
  const observationsByItemId: Record<string, string> = {}
  const otherTextByItemId: Record<string, string> = {}
  for (const a of topLevelAnswers) {
    // `!= null` (not `!== null`): ScopedAnswerRow makes `observation` optional,
    // so the strict form leaves `undefined` in the type.
    if (a.observation != null && a.observation !== '') {
      observationsByItemId[a.item_id] = a.observation
    }
    if (a.other_text != null && a.other_text !== '') {
      otherTextByItemId[a.item_id] = a.other_text
    }
  }

  // FF-2: resolve axis ids to codes once, then hand each scope its own slice.
  const matrixByScope = buildMatrixAnswers(tree, cellRows ?? [], riskRows ?? [])
  const topLevelMatrix = matrixByScope.get(TOP_LEVEL_SCOPE)

  // FF-5: same shape, same scoping.
  const referencesByScope = buildReferenceAnswers(referenceRows ?? [])

  const instances = buildGroupInstances(
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
  })

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
    instances,
    matrixCellsByItemId: topLevelMatrix?.matrixCellsByItemId ?? {},
    riskMatrixByItemId: topLevelMatrix?.riskMatrixByItemId ?? {},
    referencesByItemId: referencesByScope.get(TOP_LEVEL_SCOPE) ?? {},
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
