import { createClient } from '@/lib/supabase/server'
import {
  ANSWERABLE_ITEM_TYPES,
  MATRIX_ITEM_TYPES,
  containerByChildId,
  flattenItem,
  isRepeatingGroup,
  repeatingGroupOf,
  toDefaultSource,
} from '@/lib/forms/item-tree'
import type { DefaultSource } from '@/lib/forms/item-tree'
import { isConditionTargetInScope } from '@/lib/queries/conditions'
import {
  toParticipantTypes,
  toReferenceKind,
} from '@/lib/forms/reference-constants'
import type { Json } from '@/lib/types/database'
import type {
  ParticipantType,
  ReferenceKind,
} from '@/lib/forms/reference-constants'
import type { Visibility, FlaggedWhen } from '@/lib/queries/conditions'
import type {
  ItemValidationRule,
  RequiredIf,
} from '@/lib/forms/validation-rules'
import type { CaseStatusColorToken } from '@/lib/cases/case-status'

// Re-export the condition shapes so the builder can import every form type from
// this one module (the live wizard imports them from ./conditions directly).
export type {
  VisibleWhen,
  ConditionOp,
  ConditionGroup,
  Visibility,
  FlaggedWhen,
} from '@/lib/queries/conditions'

// FF-3: the validation shapes travel with the item tree, so re-export them here
// too. The IMPLEMENTATION stays in the pure module — a value re-export from this
// server module would drag `server-only` into any client that imported it.
export type {
  ItemValidationRule,
  ValidationRuleType,
  ValidationSeverity,
  ValidationConfig,
  ValidationRuleSpec,
  RequiredIf,
} from '@/lib/forms/validation-rules'

/**
 * The constrained colour-token palette for per-option colours (decision #4),
 * REUSED from the case-outcome/tag/status palette so the builder shares the one
 * `ColorTokenPicker` + 7-token vocabulary. Aliased here as `ColorToken` so the
 * form builder imports it from this one module; it is the SAME underlying union
 * as {@link CaseStatusColorToken} (`muted`/`slate`/`blue`/`amber`/`green`/`red`/
 * `violet`).
 */
export type ColorToken = CaseStatusColorToken

/**
 * Form builder data-access (Architecture Rule 9 — all reads go through
 * `src/lib/queries/`). Backs the per-commission form list, the two-level
 * builder (`src/app/c/[slug]/manage/forms/**`), and read-only version/history
 * views. Every read uses the cookie-wired (RLS-scoped) client:
 *   - `forms_select` / `form_versions_select` / `form_sections_select` /
 *     `form_items_select` (M6) return rows only to members of the commission
 *     (+ admins);
 *   - draft versions are visible to staff_admins of the commission (+ admins),
 *     published/archived to any member.
 * Gate the calling page on staff_admin/admin via `getCommissionAccessByOrg` before
 * rendering the builder — RLS returns no rows to a plain staff member, but a
 * friendly pt-BR 404/forbidden is the page's job, not this layer's.
 *
 * Domain interfaces (Section, Item, DraftTree, etc.) are exported so the
 * frontend imports them directly and the builder's shapes cannot drift from the
 * database. The generated Row types expose `item_type` / `status` /
 * `signoff_role` as bare `string`; here they are narrowed to the domain unions
 * and the jsonb columns (`visible_when`, `options`, `content`) are given their
 * real shapes.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/**
 * Input items collect answers; display items only render. The
 * form-builder-enhancements set adds four input types:
 *   - `short_text` — single-line free text ("Resposta curta"); `free_text` stays
 *     the multi-line "Resposta longa".
 *   - `number` — decimals + negatives, optional min/max (`config`).
 *   - `date` — date-only `YYYY-MM-DD`, optional min/max (`config`).
 *   - `time` — 24h `HH:mm`, no bounds.
 * None of the four carry `options` (only the choice types do).
 */
export type InputItemType =
  | 'multiple_choice'
  | 'dropdown'
  | 'checkbox'
  | 'free_text'
  | 'short_text'
  | 'number'
  | 'date'
  | 'time'
export type DisplayItemType = 'section_text' | 'image'

/**
 * FF-1 (BE-0 contract, ADR 0087) — the two CONTAINER types. A container collects
 * NO answer of its own: it owns child items via `form_items.parent_item_id`, and
 * per ADR 0087 it carries `question_key = null` (so it is invisible to every
 * question_key-keyed path — dashboards, conditions, completeness) and
 * `required = false` (a repeating group's required-ness is `config.minInstances`,
 * not the flag).
 *   - `repeating_group` — N answer instances (`response_group_instances`); each
 *     child answer carries `answers.group_instance_id`. Conditions on its children
 *     resolve inside-out (ruling 2); nothing OUTSIDE it may reference a child key.
 *   - `group` — a purely VISUAL nested sub-section (ruling 6): no instance rows,
 *     children store answers TOP-LEVEL exactly like flat items, and their keys stay
 *     legal condition targets everywhere.
 * Nesting is capped at depth 1 (ruling 1): a container may not contain a container.
 */
export type ContainerItemType = 'group' | 'repeating_group'

/**
 * FF-2 (BE contract, ADR 0089) — the two MATRIX types. Both are ANSWERABLE (they
 * carry a `question_key` and feed dashboards) but neither stores its answer in
 * `answers.value`:
 *   - `matrix` — a RADIO GRID (ruling 1). Each row takes exactly ONE column; the
 *     cell row IS the selection and carries no payload of its own. Rows are the
 *     criteria, columns the shared scale. Enforced by `UNIQUE (answer_id, row_id)`
 *     on `answer_matrix_cells`, not only by the writer.
 *   - `risk_matrix` — one severity row x one likelihood column, producing a
 *     single `answer_risk_matrix` row whose `risk_score` is DERIVED SERVER-SIDE
 *     (ruling 2). Never send a score; it is not read.
 * The aggregation unit is `(question_key, row_code, col_code)`, resolved through
 * `code` and never through the per-version `row_id`/`col_id`.
 */
export type MatrixItemType = 'matrix' | 'risk_matrix'

/**
 * FF-5 (BE contract, ADR 0091) — the ENTITY REFERENCE type. Answerable (it
 * carries a `question_key` and feeds dashboards) but, like the two matrix types,
 * its payload is NOT in `answers.value`: a reference stores one row in
 * `answer_references` pointing at exactly one of three lanes — a `participant`,
 * a `commission`, or a `user` (`profiles`) — selected by
 * `config.referenceKind`.
 *
 * ⚠ `reference` was already legal in the DB (`form_items_item_type_check` has
 * carried it since F3 froze the table on 2026-07-12) while being ABSENT from
 * this union. That gap is what FF-5 closes: the substrate existed and was
 * write-inert, so nothing on this side could name it.
 *
 * The aggregation unit is `(question_key, reference_kind, target_id)` — the
 * TARGET ID, never the label, which is resolved by live join and would fork
 * every historical series the day a participant or commission is renamed (ADR
 * 0091 ruling 4).
 *
 * NOT a condition target (ruling 5, deferred post-pilot): the evaluator reads
 * `answers.value`, which is null for a reference, so `reference` stays out of
 * {@link CONDITION_TARGET_TYPES} exactly as the two matrix types do.
 */
export type ReferenceItemType = 'reference'

export type ItemType =
  | InputItemType
  | DisplayItemType
  | ContainerItemType
  | MatrixItemType
  | ReferenceItemType

// The container VALUES + the tree walkers live in a PURE, client-safe module and
// are re-exported here, exactly as the reserved "Outros" code is: this module
// value-imports the server Supabase client at top level, so a Client Component
// that value-imported them from here would drag `next/headers` into the browser
// bundle and abort `next build` (BUG-FBE-005). One implementation, two
// specifiers — never two implementations, which is the drift this phase exists
// to prevent.
export {
  CONTAINER_ITEM_TYPES,
  MATRIX_ITEM_TYPES,
  flattenItem,
} from '@/lib/forms/item-tree'

// FF-5 (ADR 0091): the reference lane's vocabulary, for the same reason and by
// the same mechanism — a PURE module the builder dialog and the wizard
// typeahead can value-import without dragging this module's server client into
// the browser bundle (BUG-FBE-005). Re-exported here so server-side importers
// keep the `@/lib/queries/forms` specifier.
export {
  REFERENCE_KINDS,
  REFERENCE_KIND_LABELS,
  PARTICIPANT_TYPES,
  PARTICIPANT_TYPE_LABELS,
  CASE_SCOPED_PARTICIPANT_TYPES,
  isReferenceItem,
  toReferenceKind,
  toParticipantTypes,
} from '@/lib/forms/reference-constants'
export type { ReferenceKind, ParticipantType } from '@/lib/forms/reference-constants'

// INPUT_ITEM_TYPES / ANSWERABLE_ITEM_TYPES are DEFINED in the pure
// `@/lib/forms/item-tree` and re-exported here (BUG-FF5-001). They used to be
// spelled out in this module AND again, by hand, in `src/lib/forms/actions.ts` —
// and the copy drifted twice, dropping `matrix` in FF-2 and `reference` in FF-5.
// One implementation, two specifiers: every existing `@/lib/queries/forms`
// importer is unaffected, and the builder now consumes the same array this
// module does instead of its own transcription.
export {
  INPUT_ITEM_TYPES,
  DISPLAY_ITEM_TYPES,
  REFERENCE_ITEM_TYPES,
  ANSWERABLE_ITEM_TYPES,
  ALL_ITEM_TYPES,
  ITEM_TYPE_AUTHORITY,
} from '@/lib/forms/item-tree'

// FF-4 (ADR 0092): the dynamic-default token vocabulary, defined in the same
// PURE module and for the same BUG-FBE-005 reason as the item-type sets above
// — the authoring picker (FE-3) is a Client Component. Re-exported here so
// every server-side importer keeps the `@/lib/queries/forms` specifier.
export {
  DEFAULT_SOURCE_TOKENS,
  DEFAULT_SOURCE_LABELS,
  DEFAULT_SOURCE_ELIGIBLE_TYPES,
  isDefaultSourceEligible,
  toDefaultSource,
} from '@/lib/forms/item-tree'
export type { DefaultSource } from '@/lib/forms/item-tree'
/** Choice inputs carry an `options` array (used by the condition editor). */
export const CHOICE_ITEM_TYPES: readonly InputItemType[] = [
  'multiple_choice',
  'dropdown',
  'checkbox',
]


/**
 * One choice option — the NORMALIZED row shape (form-model-normalization).
 *
 * CONTRACT (BE-1, posted for frontend): options are no longer a JSONB blob on
 * `form_items.options`. Each option of a choice item is a row in the new
 * `form_item_options` table, version-scoped, cloned + frozen with the version.
 * The domain object the frontend consumes is:
 *   - `id`           — the option-row UUID. Instance identity; the answer's
 *     `answer_selected_options.option_id` is a HARD FK to it. Wizard emits CODES,
 *     not ids (codes survive clones; the FK ids do not), but the builder needs
 *     `id` to address an existing row for update/delete.
 *   - `code`         — auto-generated (slug(label)+suffix), immutable, hidden,
 *     `unique(item_id, code)`. The ANALYTICS / CONDITION identity: conditions,
 *     `recommend_when`, and `result_ruleset` store this code; dashboards group by
 *     it; it is copied verbatim on clone so analytics aggregate across versions.
 *   - `label`        — canonical pt-BR display text (renameable WITHOUT breaking
 *     analytics, since identity is `code`, not `label` — the whole point of the
 *     refactor).
 *   - `color`        — optional colour token (7-token palette). Authored on
 *     `multiple_choice` + `checkbox` only (dropdown excluded — a native
 *     `<select>` can't render colour); `null` = no colour.
 *   - `score`        — optional numeric, stored-only (no scoring engine yet).
 *   - `analyticsCode`— optional free-text cross-form tagging hook (greenfield
 *     indicator engine); `null` = untagged.
 *   - `position`     — order within the item (`unique(item_id, position)`).
 *
 * Translations are deferred (decision #5) — no column now; adding one later is
 * additive and does not change this shape.
 */
export interface ItemOption {
  id: string
  code: string
  label: string
  color: ColorToken | null
  score: number | null
  analyticsCode: string | null
  /** Flagged-scoring: a selected flagged option contributes +1 to __flagged_count__. */
  flagged: boolean
  /**
   * "Outros" reserved option: true ONLY for the auto-managed `__other__` row
   * (code {@link OTHER_OPTION_CODE}, always last). The OptionsEditor hides these
   * from the editable list; the wizard reveals a text input when it is selected.
   * Never author-editable — managed entirely by `reconcile_item_options`.
   */
  isOther: boolean
  position: number
}

// The reserved "Outros" open-option code + label live in a PURE, client-safe
// module so Client Components can value-import them WITHOUT pulling forms.ts's
// server supabase client into the client bundle (FBE-005). Re-exported here so
// existing server-side importers keep the `@/lib/queries/forms` specifier.
export {
  OTHER_OPTION_CODE,
  OTHER_OPTION_LABEL,
} from '@/lib/forms/option-constants'

/**
 * FF-2 (BE contract, ADR 0089) — one entry of a matrix axis: a row of
 * `form_matrix_rows` or of `form_matrix_columns`. The two tables have identical
 * shapes, so one domain type serves both.
 *
 *   - `id`       — the axis-row UUID. Per-VERSION and NOT stable across clones;
 *     the builder needs it to address an existing row, nothing else should.
 *   - `code`     — the stable, hidden, IMMUTABLE identity. It is the
 *     cross-version aggregation key, exactly as `ItemOption.code` is: the
 *     dashboard's cell unit is `(question_key, row_code, col_code)`, the wizard
 *     addresses cells by code, and `clone_form_version` copies it verbatim.
 *     ⚠ A `code` can NEVER be changed once the row exists (ruling 4, enforced by
 *     a BEFORE UPDATE trigger on both tables, on draft AND published alike). The
 *     builder must offer "remove + add", never "rename the code". Codes are
 *     MINTED CLIENT-SIDE and honoured verbatim by `upsertMatrixAxes` — the same
 *     contract `form_item_options` settled.
 *   - `label`    — pt-BR display text; freely renameable, since identity is
 *     `code`.
 *   - `weight`   — `risk_matrix` ONLY, and REQUIRED on every entry of both axes
 *     for that type (rejected at save with `HC0P6`, re-checked at publish).
 *     `risk_score = severityRow.weight * likelihoodColumn.weight`, computed by
 *     the server. `null` for a plain `matrix`, which has no use for it.
 *     Not a 1..N ladder: real ONA/NBR scales are 1/3/9/27.
 *   - `position` — order within the axis; unique within the payload.
 */
export interface MatrixAxisEntry {
  id: string
  code: string
  label: string
  weight: number | null
  position: number
}

/**
 * FF-2 — one score band of a `risk_matrix`, held in `form_items.config.riskBands`
 * as an ordered list. The band is DERIVED FOR DISPLAY from `risk_score` and is
 * NOT stored on the answer: the score is the durable fact, the band is a
 * presentation of it, so re-banding a form never rewrites history.
 *
 * `minScore` is inclusive; a score falls in the LAST band whose `minScore` it
 * reaches.
 */
export interface RiskBand {
  minScore: number
  label: string
  color: ColorToken | null
}

/**
 * Per-type settings (form-builder-enhancements). Today: optional `min`/`max`
 * bounds for `number` (numeric) and `date` (ISO `YYYY-MM-DD`); `null`/absent for
 * every other type. Stored as the `form_items.config` jsonb; bounds are
 * validated client-side AND in `submit_response`. `number`/`string` because a
 * numeric bound is a JSON number while a date bound is an ISO string.
 */
export interface ItemConfig {
  min?: number | string | null
  max?: number | string | null
  /**
   * "Flagged If" (number/date/time only): a single self-referential condition; a
   * satisfied `flaggedWhen` contributes +1 to the phase's `__flagged_count__`
   * aggregate. `null`/absent = the item never flags via a threshold.
   */
  flaggedWhen?: FlaggedWhen | null
  /**
   * Character-length limits for `free_text`/`short_text` (integers ≥ 0). Validated
   * live while filling AND at submit (`assert_item_bounds`). `null`/absent = no limit.
   */
  minLength?: number | null
  maxLength?: number | null
  /**
   * "Outros" open option (multiple_choice/checkbox only): when true, the item offers
   * a reserved `__other__` option (managed by `reconcile_item_options`) that reveals
   * a free-text input in the wizard. `null`/absent = no "Outros" option.
   */
  allowOther?: boolean | null
  /**
   * FF-1 (BE-0 contract, ADR 0087 substrate correction 1) — repeating-group
   * cardinality, on the CONTAINER item's `form_items.config` (NOT
   * `form_versions.behavior_config`, which is a per-VERSION bag and is not this).
   * Integers ≥ 0, `maxInstances >= minInstances`. `null`/absent = unbounded.
   *   - `minInstances` — enforced by `submit_response` AFTER empty instances are
   *     pruned (ruling 3), with a pt-BR "adicione ao menos N" error; it is the
   *     ONLY required-ness mechanism a repeating group has.
   *   - `maxInstances` — enforced by the `add_group_instance` RPC.
   * Ignored for every non-`repeating_group` type (a plain `group` has no instances).
   */
  minInstances?: number | null
  maxInstances?: number | null
  /**
   * FF-2 (ADR 0089 ruling 2) — `risk_matrix` only: the ordered score→band
   * mapping used to colour and label a derived `riskScore`. `null`/absent = no
   * banding (the raw score is shown). Ignored for every other type.
   */
  riskBands?: RiskBand[] | null
  /**
   * FF-5 (ADR 0091) — `reference` only: WHICH LANE this item targets. Absent
   * defaults to `'participant'` server-side (`app.save_reference_answers` and
   * `public.reference_candidates` both `coalesce(config->>'referenceKind',
   * 'participant')`), which is what keeps the F3-era one-lane rows valid.
   *
   * ⚠ The lane is read from HERE and never from the save payload. A caller who
   * could name the kind on the wire could pair a `commission` item with a
   * participant target and satisfy the XOR CHECK anyway; deriving it from the
   * authoring config makes that combination UNREPRESENTABLE rather than merely
   * rejected.
   */
  referenceKind?: ReferenceKind | null
  /**
   * FF-5 — `reference` on the PARTICIPANT lane only: narrows the candidate set
   * to these `participants.participant_type` values. `null`/absent = all types.
   *
   * ⚠ `'patient'` behaves differently from every other type (ADR 0091 ruling 2):
   * it is CASE-scoped, so on a standalone (non-case) response the candidate set
   * is EMPTY — at both layers, the search and the coherence trigger. An author
   * who pins `['patient']` on a standalone checklist has built a field nobody
   * can answer; the builder warns rather than the wizard failing silently.
   */
  participantTypes?: ParticipantType[] | null
}

export type VersionStatus = 'draft' | 'published' | 'archived'
export type SignoffRole = 'respondent' | 'staff_admin'

/** Display-item content shapes (Architecture Rule 2 / Rule 7). */
export interface SectionTextContent {
  markdown: string
}
export interface ImageContent {
  storage_path: string
  alt: string
  caption?: string | null
}

/**
 * One form item, narrowed from the generated Row. Input items carry
 * `questionKey`/`label`/`options`/`required` and null `content`; display items
 * carry `content` and null input columns. The kind is discriminated by
 * `itemType`.
 *
 * form-builder-enhancements: `options` is now `ItemOption[]` (was `string[]`;
 * {@link toOptions} normalizes legacy bare strings); `config` carries per-type
 * settings (number/date min/max); `visibleWhen` is the per-question conditional
 * appearance ({@link Visibility} — legacy single OR AND/OR group). A conditional
 * question can never be `required` (UI + DB CHECK).
 */
export interface Item {
  id: string
  sectionId: string
  position: number
  itemType: ItemType
  // input-only
  questionKey: string | null
  label: string | null
  questionExplanation: string | null
  options: ItemOption[] | null
  config: ItemConfig | null
  visibleWhen: Visibility | null
  required: boolean
  /**
   * answer-model-v2 (BE-0 contract, ADR 0046 / P2.4): the per-input **default
   * value** used to pre-fill an unanswered VISIBLE item in the wizard.
   *   - scalar inputs (`free_text`/`short_text`/`number`/`date`/`time`) → the raw
   *     scalar (`"texto"`, `12`, `"2026-01-01"`, `"08:30"`);
   *   - single-select (`multiple_choice`/`dropdown`) → the option **code**
   *     (scalar string — mirroring the `answer_map` shape);
   *   - `checkbox` → an ARRAY of option codes;
   *   - display items (`section_text`/`image`) → always `null` (DB CHECK).
   * `null` = no default. Copied verbatim by `clone_form_version` and validated by
   * `publish_form_version` (BE-4). Persisted in the new `form_items.default_value`
   * jsonb; until BE-1 lands the column this reads `null`.
   */
  defaultValue: Json | null
  /**
   * FF-4 (BE contract, ADR 0092 ruling 5) — the dynamic-default TOKEN, or
   * `null`/absent for a plain literal `defaultValue` (or no default at all).
   * `defaultSource` and `defaultValue` are XOR (ruling 6, a DB CHECK): an item
   * carries a literal default, a dynamic one, or neither, never both. Resolved
   * server-side at DRAFT START into the same seeding slot `defaultValue`
   * already fills — idempotent, never overwriting an answered or
   * since-cleared item (BE-6).
   *
   * OPTIONAL in the type, ALWAYS populated by the query layer — read it as
   * `item.defaultSource ?? null`, exactly like {@link Item.matrixRows}. `?`
   * exists so the many hand-built `Item` fixtures across the component test
   * suite need not enumerate a field irrelevant to them; this is NOT required
   * like `defaultValue` above, because unlike a write payload (BUG-FF5-002),
   * an absent `defaultSource` on a READ-side fixture cannot blank a durable
   * record — it just reads as "no dynamic default," which is what most items
   * genuinely have.
   */
  defaultSource?: DefaultSource | null
  /**
   * The CONTAINER item that owns this item, or `null` for a top-level item
   * (answer-model-v2 / ADR 0046 scaffolding, ACTIVATED by FF-1). `clone_form_version`
   * already remaps it to the cloned container's new id. Depth is capped at 1
   * (ADR 0087 ruling 1), so a child never owns children of its own.
   */
  parentItemId: string | null
  /**
   * FF-1 (BE-0 contract, ADR 0087) — the ordered child items of a CONTAINER,
   * `[]` for every non-container. **Children appear HERE and NOT in
   * `Section.items`**, so `Section.items` stays the top-level render list it has
   * always been (no consumer breaks: no form contains a container yet, so this is
   * `[]` everywhere until FF-1's builder ships).
   *
   * Children live in the SAME section as their parent and, per ADR 0087, occupy
   * `form_items.position` slots contiguously immediately after it — that flat
   * ordinal space is what keeps `validate_visible_when`'s "pergunta anterior"
   * rule working across the container boundary.
   */
  children: Item[]
  /**
   * FF-2 (BE contract, ADR 0089) — the axes of a `matrix` / `risk_matrix`, in
   * `position` order. `null` for every other item type (an empty array would
   * read as "a matrix whose grid is empty", which is a different and
   * publish-blocking state — see `HC0P5`).
   *
   * For a `risk_matrix`, `matrixRows` are the SEVERITY axis and `matrixColumns`
   * the LIKELIHOOD axis, and every entry carries a `weight`.
   *
   * OPTIONAL in the type, ALWAYS populated by the query layer — read them as
   * `item.matrixRows ?? []`. The `?` exists so the dozen hand-built `Item`
   * fixtures in the component tests need not enumerate a field irrelevant to
   * them, exactly as `ItemRow.default_value?` was introduced by answer-model-v2.
   * This is NOT the `children` case: forgetting `children` silently skips
   * container items, whereas a fixture without axes is simply a non-matrix item.
   */
  matrixRows?: MatrixAxisEntry[] | null
  matrixColumns?: MatrixAxisEntry[] | null
  /**
   * FF-3 (ADR 0090 ruling 4) — the item's conditional-requirement rule, or null.
   * A SINGLE condition (`app.is_valid_condition`), never the `{match,
   * conditions[]}` group `visibleWhen` accepts.
   *
   * Read alongside `required`: the item is required when `required` is true OR
   * this evaluates true against the map in scope — `itemIsRequired` in
   * `@/lib/forms/validation-rules` is the one predicate for that, mirrored in SQL
   * as `app.item_is_required`. Visibility still wins over both.
   */
  requiredIf?: RequiredIf | null
  /**
   * FF-3 — the item's validation rules, in `position` order. `[]` for an item
   * with none.
   *
   * UNLIKE `matrixRows`, the empty array is NOT a distinct state here: an item
   * with no rules and a matrix with no axes are different kinds of thing (the
   * latter blocks publish, the former is the norm), so `[]` is the honest empty.
   *
   * ⚠ THE BUILDER MUST HYDRATE FROM THIS BEFORE SAVING. `setItemValidations` has
   * REPLACE semantics — the payload is the complete desired list — so an editor
   * that opens without these rows and then saves would DELETE every rule on the
   * item. That is the data-loss path this field exists to close.
   */
  validations?: ItemValidationRule[]
  // display-only
  content: SectionTextContent | ImageContent | null
}

/** One section with its ordered items. */
export interface Section {
  id: string
  position: number
  title: string | null
  description: string | null
  isDefault: boolean
  /**
   * Section visibility — legacy single OR AND/OR group ({@link Visibility}).
   * form-builder-enhancements: sections share the one condition builder with
   * questions, so they accept the group shape too; a legacy single condition
   * round-trips unchanged.
   */
  visibleWhen: Visibility | null
  requiresSignoff: boolean
  signoffRole: SignoffRole | null
  items: Item[]
}

/** A version (meta) plus its ordered sections — the builder/read tree. */
export interface VersionTree {
  id: string
  formId: string
  versionNumber: number
  status: VersionStatus
  publishedAt: string | null
  sections: Section[]
}

/** Just the version metadata, for history lists. */
export interface VersionSummary {
  id: string
  versionNumber: number
  status: VersionStatus
  publishedAt: string | null
}

/** One row in the per-commission form list. */
export interface FormListItem {
  id: string
  title: string
  description: string | null
  /** version_number of the current published version, or null if none. */
  publishedVersionNumber: number | null
  /** true when an editable draft exists (so the UI shows "continuar edição"). */
  hasDraft: boolean
  /** the editable draft's version id, or null. */
  draftVersionId: string | null
}

/**
 * A valid target for a per-question/section `visible_when` condition: an input
 * question strictly EARLIER in document order whose answer the condition reads.
 *
 * form-builder-enhancements (plan decision #7) WIDENS this beyond choice-only:
 * conditions may now target `number`/`date`/`time` inputs too (with the new
 * ordered ops gt/gte/lt/lte), so the editor needs the target's `type` to filter
 * the operator list and pick the right value control. This INTENTIONALLY
 * supersedes the prior "conditionTargets is choice-types only" rule (which was a
 * UI value-picker contract, not a schema rule).
 *   - CHOICE targets (`multiple_choice`/`dropdown`/`checkbox`) carry `options`
 *     (label strings — the answer stores the label) for the equals/in picker.
 *   - number/date/time targets carry `options: []` (they have none); the editor
 *     renders a number/date/time value control instead.
 * `free_text`/`short_text` are still excluded (no discrete or ordered value to
 * compare). Publish-time `validate_visible_when` remains the authority on
 * forward/self refs and operator↔type compatibility.
 *
 * form-model-normalization (BE-1): conditions now STORE the option **code**, not
 * the label (the code is the clone-stable identity the evaluator keys on). The
 * picker therefore needs BOTH — the `value` to store (`code`) and the human
 * `label` to show. `options` carries `{ code, label }` per choice option
 * (`[]` for number/date/time targets, which have none).
 */
export interface ConditionTargetOption {
  /** The value stored in the condition (`equals`/`in` value). */
  code: string
  /** The display label shown in the picker. */
  label: string
}

export interface ConditionTarget {
  questionKey: string
  label: string
  sectionPosition: number
  /** The target input's type — drives operator filtering + the value control. */
  type: InputItemType
  /** Choice options (`{code,label}`); `[]` for number/date/time targets. */
  options: ConditionTargetOption[]
}

/**
 * The input types a condition may TARGET (decision #7): the choice types plus
 * number/date/time. `free_text`/`short_text` are excluded — there is no discrete
 * set to pick from nor a meaningful ordering to compare against.
 */
export const CONDITION_TARGET_TYPES: readonly InputItemType[] = [
  'multiple_choice',
  'dropdown',
  'checkbox',
  'number',
  'date',
  'time',
]

// ---------------------------------------------------------------------------
// Row → domain mappers
// ---------------------------------------------------------------------------

/** One embedded `form_item_options` row (form-model-normalization). */
interface OptionRow {
  id: string
  code: string
  label: string
  color_token: string | null
  score: number | null
  analytics_code: string | null
  flagged: boolean
  is_other: boolean
  position: number
}

/** FF-2: one embedded `form_matrix_rows` / `form_matrix_columns` row. The two
 *  tables are column-identical, so one row shape serves both. */
interface AxisRow {
  id: string
  code: string
  label: string
  weight: number | null
  position: number
}

/** FF-3: one embedded `form_item_validations` row, as PostgREST returns it. */
interface ValidationRuleRow {
  id: string
  item_id: string
  form_version_id: string
  position: number
  rule_type: string
  config: Json | null
  severity: string
  message: string | null
}

interface ItemRow {
  id: string
  section_id: string
  position: number
  item_type: string
  question_key: string | null
  label: string | null
  question_explanation: string | null
  /**
   * form-model-normalization: the embedded `form_item_options` rows (replaces the
   * old `options` jsonb blob). Null/empty for non-choice items.
   */
  form_item_options: OptionRow[] | null
  /** FF-2: the embedded axis rows. Empty for every non-matrix item. */
  form_matrix_rows?: AxisRow[] | null
  form_matrix_columns?: AxisRow[] | null
  /** FF-3: the embedded validation rules. Empty for an item with none. */
  form_item_validations?: ValidationRuleRow[] | null
  config: Json | null
  visible_when: Json | null
  required_if?: Json | null
  required: boolean
  content: Json | null
  // answer-model-v2 (BE-0): new columns, selected by VERSION_TREE_SELECT once
  // BE-1 lands them. Optional here so the mapper is safe before the migration.
  default_value?: Json | null
  parent_item_id?: string | null
  // FF-4 (ADR 0092, BE-3): selected by VERSION_TREE_SELECT. Optional here for
  // the same defensive reason `default_value` is — a nonexistent select alias
  // or a stale embed would read as `undefined` rather than crash the mapper.
  default_source?: string | null
}

interface SectionRow {
  id: string
  position: number
  title: string | null
  description: string | null
  is_default: boolean
  visible_when: Json | null
  requires_signoff: boolean
  signoff_role: string | null
  form_items: ItemRow[]
}

interface VersionRow {
  id: string
  form_id: string
  version_number: number
  status: string
  published_at: string | null
  form_sections: SectionRow[]
}

/**
 * The set of valid colour tokens, for normalizing the persisted `color_token`.
 * Exported so the {@link toOptions} normalizer body (BE-2) and the builder share
 * one palette guard; referenced by `toOptions` once implemented.
 */
export const COLOR_TOKENS: ReadonlySet<string> = new Set<ColorToken>([
  'muted',
  'slate',
  'blue',
  'amber',
  'green',
  'red',
  'violet',
])

/**
 * Map the embedded `form_item_options` rows to `ItemOption[]`, sorted by
 * `position`. form-model-normalization: replaces the old jsonb-blob normalizer —
 * options are normalized rows, so this is a field rename + sort, no
 * shape-guessing. `color_token` is kept only when it is a known token (defence;
 * the DB CHECK already constrains it). `null`/absent embed → `null` (non-choice
 * items carry no rows); an empty array (a choice item with no options yet) → `[]`.
 */
export function toOptions(rows: OptionRow[] | null): ItemOption[] | null {
  if (rows == null) return null
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map((r): ItemOption => ({
      id: r.id,
      code: r.code,
      label: r.label,
      color:
        r.color_token != null && COLOR_TOKENS.has(r.color_token)
          ? (r.color_token as ColorToken)
          : null,
      score: typeof r.score === 'number' ? r.score : null,
      analyticsCode: r.analytics_code,
      flagged: r.flagged === true,
      isOther: r.is_other === true,
      position: r.position,
    }))
}

/**
 * FF-2: map embedded axis rows to {@link MatrixAxisEntry}[], sorted by
 * `position`. PostgREST returns `[]` for the nested embed on EVERY item, so the
 * caller ({@link toItem}) decides `null`-vs-array by item type — an empty array
 * here would otherwise be indistinguishable from "a matrix with no rows yet",
 * which is a real and publish-blocking state (`HC0P5`).
 */
function toAxis(rows: AxisRow[] | null | undefined): MatrixAxisEntry[] {
  if (rows == null) return []
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map((r): MatrixAxisEntry => ({
      id: r.id,
      code: r.code,
      label: r.label,
      weight: typeof r.weight === 'number' ? r.weight : null,
      position: r.position,
    }))
}

const FLAGGED_WHEN_OPS = new Set<FlaggedWhen['op']>([
  'gt',
  'gte',
  'lt',
  'lte',
  'equals',
  'not_equals',
])

/** Narrow `config.flaggedWhen` to {@link FlaggedWhen} (or null) — a single
 * `{op, value}` with a known op and a scalar value; anything else → null. */
function toFlaggedWhen(raw: Json | undefined): FlaggedWhen | null {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }
  const rec = raw as Record<string, Json>
  const op = rec.op
  const value = rec.value
  if (typeof op !== 'string' || !FLAGGED_WHEN_OPS.has(op as FlaggedWhen['op'])) {
    return null
  }
  if (value === undefined || typeof value === 'object') return null
  return { op: op as FlaggedWhen['op'], value }
}

/**
 * FF-2: narrow `config.riskBands` to an ordered {@link RiskBand}[] (or null).
 * Strict, like {@link toCardinality}: no DB CHECK constrains `config`'s inner
 * shape, so a malformed entry must become "no banding" here rather than reach a
 * renderer as garbage. Sorted ascending by `minScore` so the consumer can take
 * the LAST band a score reaches without re-sorting.
 */
function toRiskBands(raw: Json | undefined): RiskBand[] | null {
  if (!Array.isArray(raw)) return null
  const bands = raw.flatMap((entry): RiskBand[] => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return []
    const rec = entry as Record<string, Json>
    const minScore = rec.minScore
    const label = rec.label
    if (typeof minScore !== 'number' || typeof label !== 'string' || label === '') {
      return []
    }
    const color = rec.color
    return [
      {
        minScore,
        label,
        color:
          typeof color === 'string' && COLOR_TOKENS.has(color)
            ? (color as ColorToken)
            : null,
      },
    ]
  })
  return bands.length > 0 ? bands.sort((a, b) => a.minScore - b.minScore) : null
}

/** Narrow the per-type `config` jsonb to {@link ItemConfig} (or null). */
function toConfig(raw: Json | null): ItemConfig | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rec = raw as Record<string, Json>
  const min = rec.min
  const max = rec.max
  const minLength = rec.minLength
  const maxLength = rec.maxLength
  return {
    min: typeof min === 'number' || typeof min === 'string' ? min : null,
    max: typeof max === 'number' || typeof max === 'string' ? max : null,
    flaggedWhen: toFlaggedWhen(rec.flaggedWhen),
    minLength: typeof minLength === 'number' ? minLength : null,
    maxLength: typeof maxLength === 'number' ? maxLength : null,
    allowOther: rec.allowOther === true ? true : null,
    // FF-1: repeating-group cardinality. This parser builds its result
    // FIELD-BY-FIELD, so a key absent here round-trips to nothing no matter what
    // the builder wrote — which is exactly how `minInstances`/`maxInstances` were
    // silently dropped between BE-0's interface and this function.
    minInstances: toCardinality(rec.minInstances),
    maxInstances: toCardinality(rec.maxInstances),
    // FF-2: risk_matrix score->band display mapping.
    riskBands: toRiskBands(rec.riskBands),
    // FF-5 (ADR 0091): the reference lane + its participant-type narrowing.
    // Heeding the FIELD-BY-FIELD warning above literally: omitting either line
    // here would make `Item.config.referenceKind` read `null` for every item
    // while the DB row holds the real value, so the builder would render the
    // wrong lane and the wizard would query the wrong candidate set — with the
    // save path still writing the CORRECT lane, because the server reads
    // `config->>'referenceKind'` and never this object. Exactly how FF-1 lost
    // minInstances/maxInstances between its interface and this function.
    referenceKind: toReferenceKind(rec.referenceKind),
    participantTypes: toParticipantTypes(rec.participantTypes),
  }
}

/**
 * Narrow a repeating-group cardinality to a non-negative integer, or null.
 * Strict on purpose: no DB CHECK constrains `config`'s inner shape, so a
 * malformed value must become "unbounded" here rather than reaching
 * `add_group_instance` / `submit_response` as garbage. The SQL side is defensive
 * in the same way (`jsonb_typeof(...) = 'number'`), mirroring `assert_item_bounds`.
 */
function toCardinality(raw: Json | undefined): number | null {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : null
}

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    sectionId: row.section_id,
    position: row.position,
    itemType: row.item_type as ItemType,
    questionKey: row.question_key,
    label: row.label,
    questionExplanation: row.question_explanation,
    // Only choice items carry option rows; for every other type force `null`
    // (PostgREST returns an empty array for the nested embed even on non-choice
    // items, but the domain contract is `null` for non-choice).
    options: CHOICE_ITEM_TYPES.includes(row.item_type as InputItemType)
      ? (toOptions(row.form_item_options) ?? [])
      : null,
    config: toConfig(row.config),
    // visible_when is the stored legacy-single OR AND/OR group shape.
    visibleWhen: (row.visible_when as Visibility | null) ?? null,
    required: row.required,
    // answer-model-v2 (BE-0): default_value / parent_item_id.
    // TODO(answer-model-v2 BE-1/BE-5): the columns land in BE-1 and are added to
    // VERSION_TREE_SELECT in BE-5; until then `row.default_value`/`parent_item_id`
    // are undefined and these safely default to null (no behavior change).
    defaultValue: row.default_value ?? null,
    // FF-4 (ADR 0092, BE-3): toDefaultSource narrows both `undefined` (a
    // defensive fallback, see ItemRow.default_source) and an unrecognized
    // string to `null`.
    defaultSource: toDefaultSource(row.default_source),
    parentItemId: row.parent_item_id ?? null,
    // FF-1: filled by `nestChildren`; a container's children are attached there.
    children: [],
    // FF-2: the axes, but only for the two types that have them. PostgREST
    // returns `[]` for the embed on every row, so the type check is what keeps
    // "not a matrix" (null) distinguishable from "a matrix with an empty axis"
    // ([]) — the latter is a real state that blocks publish.
    matrixRows: MATRIX_ITEM_TYPES.includes(row.item_type as ItemType)
      ? toAxis(row.form_matrix_rows)
      : null,
    matrixColumns: MATRIX_ITEM_TYPES.includes(row.item_type as ItemType)
      ? toAxis(row.form_matrix_columns)
      : null,
    // FF-3: the conditional requirement + the validation rules. Both are plain
    // reads — no item_type gate, because the CHECK already forbids them on the
    // types that may not carry them, so a gate here could only ever HIDE a row
    // the database accepted.
    requiredIf: (row.required_if as RequiredIf | null) ?? null,
    validations: toValidations(row.form_item_validations),
    // content is a plain jsonb object for display items, null for inputs.
    content: (row.content as Item['content']) ?? null,
  }
}

/**
 * FF-3: map the embedded validation rows to {@link ItemValidationRule}[], sorted
 * by `position`. Returns `[]` (never null) — an item with no rules is the norm.
 *
 * `message` is non-null at the database (`form_item_validations_message_present`),
 * so the coalesce is a type bridge, not a real case.
 */
function toValidations(
  rows: ValidationRuleRow[] | null | undefined,
): ItemValidationRule[] {
  if (!rows || rows.length === 0) return []
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map((r): ItemValidationRule => ({
      id: r.id,
      itemId: r.item_id,
      formVersionId: r.form_version_id,
      position: r.position,
      ruleType: r.rule_type as ItemValidationRule['ruleType'],
      config: (r.config ?? {}) as ItemValidationRule['config'],
      severity: r.severity as ItemValidationRule['severity'],
      message: r.message ?? '',
    }))
}

/**
 * FF-1 (BE-0): fold the FLAT, position-ordered item rows of one section into the
 * container tree the builder + wizard consume — children move onto their
 * container's {@link Item.children} and OUT of the returned top-level list, both
 * sides keeping their `position` order. Depth is capped at 1 (ADR 0087 ruling 1),
 * so one pass suffices. A child whose parent is missing from this section (never
 * expected — the DB pins parent and child to the same version) degrades to
 * top-level rather than disappearing.
 */
function nestChildren(ordered: Item[]): Item[] {
  const byId = new Map(ordered.map((item) => [item.id, item]))
  return ordered.filter((item) => {
    const parent = item.parentItemId ? byId.get(item.parentItemId) : undefined
    if (!parent) return true
    parent.children.push(item)
    return false
  })
}

function toSection(row: SectionRow): Section {
  return {
    id: row.id,
    position: row.position,
    title: row.title,
    description: row.description,
    isDefault: row.is_default,
    visibleWhen: (row.visible_when as Visibility | null) ?? null,
    requiresSignoff: row.requires_signoff,
    signoffRole: (row.signoff_role as SignoffRole | null) ?? null,
    items: nestChildren(
      [...row.form_items].sort((a, b) => a.position - b.position).map(toItem),
    ),
  }
}

function toVersionTree(row: VersionRow): VersionTree {
  return {
    id: row.id,
    formId: row.form_id,
    versionNumber: row.version_number,
    status: row.status as VersionStatus,
    publishedAt: row.published_at,
    sections: [...row.form_sections]
      .sort((a, b) => a.position - b.position)
      .map(toSection),
  }
}

// form-model-normalization: `form_items.options` jsonb is gone; options embed as
// the related `form_item_options` rows (PostgREST nested select). The rows are
// sorted by `position` in `toOptions` (PostgREST nested ordering is not relied
// on). Every option column the domain shape needs is selected here.
//
// PGRST201 DISAMBIGUATION (BUG-FMN-001): `answer_selected_options` adds a SECOND
// relationship path between form_items and form_item_options (the direct FK plus
// an inferred M2M through answer_selected_options), so a bare
// `form_item_options(...)` embed is ambiguous. Pin it to the direct FK with the
// `!form_item_options_item_id_fkey` hint so PostgREST resolves the item→options
// path unambiguously.
const VERSION_TREE_SELECT =
  'id, form_id, version_number, status, published_at, ' +
  'form_sections(id, position, title, description, is_default, visible_when, ' +
  'requires_signoff, signoff_role, ' +
  'form_items(id, section_id, position, item_type, question_key, label, ' +
  'question_explanation, config, visible_when, required, content, ' +
  'default_value, parent_item_id, required_if, default_source, ' +
  'form_item_options!form_item_options_item_id_fkey(id, code, label, color_token, score, analytics_code, flagged, is_other, position), ' +
  // FF-2: the matrix axes. Both embeds are FK-HINTED for the same reason the
  // options embed is — `answer_matrix_cells` adds a second inferred path between
  // form_items and each axis table (item -> answers -> answer_matrix_cells ->
  // form_matrix_rows/columns), which makes a bare embed ambiguous (PGRST201).
  'form_matrix_rows!form_matrix_rows_item_id_fkey(id, code, label, weight, position), ' +
  'form_matrix_columns!form_matrix_columns_item_id_fkey(id, code, label, weight, position), ' +
  // FF-3: the validation rules. FK-HINTED like its neighbours — form_item_validations
  // carries FKs to BOTH form_items and form_versions, and an un-hinted embed on a
  // table reachable by more than one path is the PGRST201 shape this repo has
  // already eaten once (pqs_members -> hospitals, BUG-NPH-003).
  'form_item_validations!form_item_validations_item_id_fkey(id, item_id, form_version_id, position, rule_type, config, severity, message)))'

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * The commission's forms, each with its current published version number (or
 * null) and whether an editable draft exists (+ its id). Sorted by title
 * (pt-BR). Returns `[]` when the caller may not read the commission (RLS yields
 * no rows).
 */
export async function listForms(commissionId: string): Promise<FormListItem[]> {
  const supabase = await createClient()

  const { data } = await supabase
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

  return (data ?? [])
    .map((form) => {
      const published = form.form_versions.find((v) => v.status === 'published')
      const draft = form.form_versions.find((v) => v.status === 'draft')
      return {
        id: form.id,
        title: form.title,
        description: form.description,
        publishedVersionNumber: published?.version_number ?? null,
        hasDraft: draft != null,
        draftVersionId: draft?.id ?? null,
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
}

/**
 * The single editable draft version of a form, with its ordered sections and
 * items, or `null` when the form has no draft. There is at most one draft per
 * form (ADR 0012).
 */
export async function getEditableDraftTree(
  formId: string,
): Promise<VersionTree | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('form_versions')
    .select(VERSION_TREE_SELECT)
    .eq('form_id', formId)
    .eq('status', 'draft')
    .maybeSingle<VersionRow>()

  if (error) console.error('[getEditableDraftTree]', error)
  return data ? toVersionTree(data) : null
}

/**
 * A full read-only tree for any version (history / view). Any member reads a
 * published/archived version; staff_admins (+ admins) also read drafts (RLS).
 * `null` when not visible / not found.
 */
export async function getVersionTree(
  versionId: string,
): Promise<VersionTree | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('form_versions')
    .select(VERSION_TREE_SELECT)
    .eq('id', versionId)
    .maybeSingle<VersionRow>()

  return data ? toVersionTree(data) : null
}

/** A form's versions (metadata only), newest first. */
export async function listVersions(formId: string): Promise<VersionSummary[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('form_versions')
    .select('id, version_number, status, published_at')
    .eq('form_id', formId)
    .order('version_number', { ascending: false })
    .returns<
      {
        id: string
        version_number: number
        status: string
        published_at: string | null
      }[]
    >()

  return (data ?? []).map((v) => ({
    id: v.id,
    versionNumber: v.version_number,
    status: v.status as VersionStatus,
    publishedAt: v.published_at,
  }))
}

// ---------------------------------------------------------------------------
// Canonical filters (Architecture Rule 9)
// ---------------------------------------------------------------------------

/**
 * CANONICAL "answerable questions of a version" filter (Architecture Rule 9):
 * the items that PRODUCE AN ANSWER (item_type ∈ {@link ANSWERABLE_ITEM_TYPES} —
 * the choice types, free_text/short_text, number, date, time, and as of FF-2
 * matrix/risk_matrix) of a version, ordered by section position then item
 * position. Reused by the dashboards — keep this the single source of the filter.
 *
 * FF-2 widened this from {@link INPUT_ITEM_TYPES} to
 * {@link ANSWERABLE_ITEM_TYPES}. Callers that specifically need "items whose
 * answer is a scalar in `answers.value`" must NOT use this — a matrix has a
 * `question_key` and belongs in a dashboard's question inventory, but its answer
 * lives in `answer_matrix_cells`. The widening is inert for every form authored
 * before FF-2, since none contains a matrix.
 */
export function answerableItems(tree: VersionTree): Item[] {
  return tree.sections
    .flatMap((section) => section.items.flatMap(flattenItem))
    .filter((item): item is Item =>
      ANSWERABLE_ITEM_TYPES.includes(item.itemType),
    )
}

/**
 * Map an Item to a ConditionTarget. form-model-normalization: a choice target
 * exposes `{ code, label }` per option — the condition stores the `code`
 * (clone-stable identity) while the picker shows the `label`. number/date/time
 * inputs have no options → [].
 */
function toConditionTarget(item: Item, sectionPosition: number): ConditionTarget {
  return {
    questionKey: item.questionKey as string,
    label: item.label ?? '',
    sectionPosition,
    type: item.itemType as InputItemType,
    options: (item.options ?? []).map((o) => ({ code: o.code, label: o.label })),
  }
}

/**
 * Valid SECTION `visible_when` targets: input questions in strictly-earlier
 * sections (lower position), as {questionKey, label, sectionPosition, type,
 * options}. form-builder-enhancements (decision #7): the eligible set is now
 * {@link CONDITION_TARGET_TYPES} — choice types PLUS number/date/time —
 * widening the prior choice-only set; `free_text`/`short_text` stay excluded.
 * Feeds the shared condition builder so it only offers selectable targets and
 * can filter operators by `type`.
 *
 * Reads the section's version tree to find earlier sections; returns `[]` when
 * the section is the first one (nothing earlier) or is not visible to the
 * caller.
 */
export async function conditionTargets(
  sectionId: string,
  forItemId?: string,
): Promise<ConditionTarget[]> {
  const supabase = await createClient()

  // Resolve the section's version + position with a single round trip.
  const { data: section } = await supabase
    .from('form_sections')
    .select('form_version_id, position')
    .eq('id', sectionId)
    .maybeSingle<{ form_version_id: string; position: number }>()

  if (!section) return []

  const tree = await getVersionTree(section.form_version_id)
  if (!tree) return []

  // FF-1: "is this item inside a repeating group?" — the question ruling 2's
  // scoping turns on, for the REFERENCING side and for every candidate target.
  // `flattenItem` is mandatory throughout: `Section.items` holds only top-level
  // items now, so a flat walk would silently hide every container child from the
  // picker, including the plain-`group` children that ARE legal targets.
  const containers = containerByChildId(tree.sections)
  const refParent = forItemId ? containers.get(forItemId) : undefined
  const refGroupId =
    refParent && isRepeatingGroup(refParent.itemType) ? refParent.id : null

  // The referencing item's document position, so we can offer only STRICTLY
  // EARLIER targets — the same (section.position, item.position) ordinal
  // comparison `validate_visible_when` applies. Contiguity (children immediately
  // after their parent, enforced by app.validate_group_layout) is what makes one
  // flat ordinal space correct across a container boundary.
  let refSectionPos = section.position
  let refItemPos = Number.POSITIVE_INFINITY // a NEW item appends at the end
  if (forItemId) {
    for (const s of tree.sections) {
      const found = s.items.flatMap(flattenItem).find((i) => i.id === forItemId)
      if (found) {
        refSectionPos = s.position
        refItemPos = found.position
        break
      }
    }
  }

  return tree.sections
    .filter((s) => s.position <= refSectionPos)
    .flatMap((s) =>
      s.items
        .flatMap(flattenItem)
        .filter(
          (item) =>
            // Strictly earlier in document order (no forward or self refs).
            (s.position < refSectionPos || item.position < refItemPos) &&
            CONDITION_TARGET_TYPES.includes(item.itemType as InputItemType) &&
            item.questionKey != null &&
            // FF-1 (ruling 2): drop REPEATING-group children unless authoring
            // from inside that same group. `repeatingGroupOf` returns null for a
            // plain-`group` child, so those stay legal everywhere — the same
            // distinction the SQL gate makes.
            isConditionTargetInScope(
              repeatingGroupOf(item, containers)?.id ?? null,
              refGroupId,
            ),
        )
        .map((item) => toConditionTarget(item, s.position)),
    )
}

/**
 * A short-lived signed URL for a private `form-assets` object, for rendering an
 * `image` display item. Uses the RLS-scoped cookie client: the
 * form_assets_select_member policy (M7) grants the signed URL only to members of
 * the object's commission (folder[1]) + admins, so a foreign user gets null.
 * Returns `null` on any failure (missing object / no access) — the caller shows
 * a placeholder.
 */
export async function getSignedAssetUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!storagePath) return null
  const supabase = await createClient()
  const { data } = await supabase.storage
    .from('form-assets')
    .createSignedUrl(storagePath, expiresInSeconds)
  return data?.signedUrl ?? null
}
