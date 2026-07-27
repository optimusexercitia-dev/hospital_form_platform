import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/types/database'
import type { Visibility, FlaggedWhen } from '@/lib/queries/conditions'
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

export type ItemType = InputItemType | DisplayItemType | ContainerItemType

export const CONTAINER_ITEM_TYPES: readonly ContainerItemType[] = [
  'group',
  'repeating_group',
]

export const INPUT_ITEM_TYPES: readonly InputItemType[] = [
  'multiple_choice',
  'dropdown',
  'checkbox',
  'free_text',
  'short_text',
  'number',
  'date',
  'time',
]
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
  config: Json | null
  visible_when: Json | null
  required: boolean
  content: Json | null
  // answer-model-v2 (BE-0): new columns, selected by VERSION_TREE_SELECT once
  // BE-1 lands them. Optional here so the mapper is safe before the migration.
  default_value?: Json | null
  parent_item_id?: string | null
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
    parentItemId: row.parent_item_id ?? null,
    // FF-1: filled by `nestChildren`; a container's children are attached there.
    children: [],
    // content is a plain jsonb object for display items, null for inputs.
    content: (row.content as Item['content']) ?? null,
  }
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
  'default_value, parent_item_id, ' +
  'form_item_options!form_item_options_item_id_fkey(id, code, label, color_token, score, analytics_code, flagged, is_other, position)))'

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
 * the input items (item_type ∈ {@link INPUT_ITEM_TYPES} — the choice types,
 * free_text/short_text, number, date, time) of a version, ordered by section
 * position then item position. Reused by the dashboards later — keep this the
 * single source of the input-type filter.
 */
export function answerableItems(tree: VersionTree): Item[] {
  return tree.sections
    .flatMap((section) => section.items.flatMap(flattenItem))
    .filter((item): item is Item =>
      INPUT_ITEM_TYPES.includes(item.itemType as InputItemType),
    )
}

/**
 * FF-1 (BE-0): one item followed by its children, in render order. The single
 * helper every "walk every item of this version" caller must use now that
 * `Section.items` holds only top-level items — forgetting it silently skips
 * every group child (Rule 9's "answerable questions" bug class).
 */
export function flattenItem(item: Item): Item[] {
  return item.children.length === 0 ? [item] : [item, ...item.children]
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

  return tree.sections
    .filter((s) => s.position < section.position)
    .flatMap((s) =>
      s.items
        .filter(
          (item) =>
            CONDITION_TARGET_TYPES.includes(item.itemType as InputItemType) &&
            item.questionKey != null,
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
