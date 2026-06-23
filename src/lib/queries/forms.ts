import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/types/database'
import type { Visibility } from '@/lib/queries/conditions'
import type { CaseStatusColorToken } from '@/lib/cases/case-status'

// Re-export the condition shapes so the builder can import every form type from
// this one module (the live wizard imports them from ./conditions directly).
export type {
  VisibleWhen,
  ConditionOp,
  ConditionGroup,
  Visibility,
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
 * Gate the calling page on staff_admin/admin via `getCommissionAccess` before
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
export type ItemType = InputItemType | DisplayItemType

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
 * One choice option: a display `label` (the answer still STORES this label
 * string — decision #4) plus an optional colour `token`. Colours are authored on
 * `multiple_choice` + `checkbox` only (dropdown excluded — a native `<select>`
 * can't render colour), but the shape is uniform; a colourless option is
 * `{ label, color: null }`. Persisted inside the existing `options` jsonb as
 * `{ "label": "...", "color": "<token>"|null }`; legacy bare-string options are
 * normalized to `{ label, color: null }` at read by {@link toOptions}.
 */
export interface ItemOption {
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
 */
export interface ConditionTarget {
  questionKey: string
  label: string
  sectionPosition: number
  /** The target input's type — drives operator filtering + the value control. */
  type: InputItemType
  /** Choice options (label strings); `[]` for number/date/time targets. */
  options: string[]
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

interface ItemRow {
  id: string
  section_id: string
  position: number
  item_type: string
  question_key: string | null
  label: string | null
  question_explanation: string | null
  options: Json | null
  config: Json | null
  visible_when: Json | null
  required: boolean
  content: Json | null
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

/** The set of valid colour tokens, for normalizing the persisted colour. */
const COLOR_TOKENS: ReadonlySet<string> = new Set<ColorToken>([
  'muted',
  'slate',
  'blue',
  'amber',
  'green',
  'red',
  'violet',
])

/**
 * Narrow a jsonb `options` column to `ItemOption[]` (or `null` for non-choice
 * inputs). form-builder-enhancements: each element is EITHER a legacy bare
 * string OR `{ label, color }`. Legacy strings normalize to
 * `{ label, color: null }`; an object's `color` is kept only when it is a known
 * token (else null). This is the single read-side normalizer — the clone path
 * copies the raw jsonb, so colours survive a clone untouched.
 */
export function toOptions(raw: Json | null): ItemOption[] | null {
  if (!Array.isArray(raw)) return null
  return raw.map((o): ItemOption => {
    if (o !== null && typeof o === 'object' && !Array.isArray(o)) {
      const rec = o as Record<string, Json>
      const label = typeof rec.label === 'string' ? rec.label : String(rec.label ?? '')
      const color =
        typeof rec.color === 'string' && COLOR_TOKENS.has(rec.color)
          ? (rec.color as ColorToken)
          : null
      return { label, color }
    }
    // Legacy bare-string (or any scalar) option.
    return { label: String(o), color: null }
  })
}

/** Narrow the per-type `config` jsonb to {@link ItemConfig} (or null). */
function toConfig(raw: Json | null): ItemConfig | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const rec = raw as Record<string, Json>
  const min = rec.min
  const max = rec.max
  return {
    min: typeof min === 'number' || typeof min === 'string' ? min : null,
    max: typeof max === 'number' || typeof max === 'string' ? max : null,
  }
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
    options: toOptions(row.options),
    config: toConfig(row.config),
    // visible_when is the stored legacy-single OR AND/OR group shape.
    visibleWhen: (row.visible_when as Visibility | null) ?? null,
    required: row.required,
    // content is a plain jsonb object for display items, null for inputs.
    content: (row.content as Item['content']) ?? null,
  }
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
    items: [...row.form_items]
      .sort((a, b) => a.position - b.position)
      .map(toItem),
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

const VERSION_TREE_SELECT =
  'id, form_id, version_number, status, published_at, ' +
  'form_sections(id, position, title, description, is_default, visible_when, ' +
  'requires_signoff, signoff_role, ' +
  'form_items(id, section_id, position, item_type, question_key, label, ' +
  'question_explanation, options, config, visible_when, required, content))'

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

  const { data } = await supabase
    .from('form_versions')
    .select(VERSION_TREE_SELECT)
    .eq('form_id', formId)
    .eq('status', 'draft')
    .maybeSingle<VersionRow>()

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
    .flatMap((section) => section.items)
    .filter((item): item is Item =>
      INPUT_ITEM_TYPES.includes(item.itemType as InputItemType),
    )
}

/** Map an Item to a ConditionTarget (label strings out of `ItemOption[]`). */
function toConditionTarget(item: Item, sectionPosition: number): ConditionTarget {
  return {
    questionKey: item.questionKey as string,
    label: item.label ?? '',
    sectionPosition,
    type: item.itemType as InputItemType,
    // Choice options expose their LABEL strings (the answer stores the label);
    // number/date/time inputs have no options → [].
    options: (item.options ?? []).map((o) => o.label),
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
