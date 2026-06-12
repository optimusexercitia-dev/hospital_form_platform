import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/types/database'
import type { VisibleWhen } from '@/lib/queries/conditions'

// Re-export the condition shape so the builder can import every form type from
// this one module (the live wizard imports it from ./conditions directly).
export type { VisibleWhen, ConditionOp } from '@/lib/queries/conditions'

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

/** Input items collect answers; display items only render. */
export type InputItemType = 'multiple_choice' | 'dropdown' | 'checkbox' | 'free_text'
export type DisplayItemType = 'section_text' | 'image'
export type ItemType = InputItemType | DisplayItemType

export const INPUT_ITEM_TYPES: readonly InputItemType[] = [
  'multiple_choice',
  'dropdown',
  'checkbox',
  'free_text',
]
/** Choice inputs carry an `options` array (used by the condition editor). */
export const CHOICE_ITEM_TYPES: readonly InputItemType[] = [
  'multiple_choice',
  'dropdown',
  'checkbox',
]

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
  options: string[] | null
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
  visibleWhen: VisibleWhen | null
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
 * A valid target for a `visible_when` condition: a CHOICE-type input question
 * in a strictly-earlier section. free_text is intentionally excluded — the
 * condition editor offers a discrete value picker from `options`, which
 * free_text has none of (UI contract, not a schema rule; publish validation
 * still allows any earlier input key).
 */
export interface ConditionTarget {
  questionKey: string
  label: string
  sectionPosition: number
  options: string[]
}

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

/** Narrow a jsonb options column to a string[] (or null for non-choice inputs). */
function toOptions(raw: Json | null): string[] | null {
  if (!Array.isArray(raw)) return null
  return raw.map((o) => String(o))
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
    visibleWhen: (row.visible_when as VisibleWhen | null) ?? null,
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
  'question_explanation, options, required, content))'

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
 * the input items (item_type ∈ {multiple_choice, dropdown, checkbox, free_text})
 * of a version, ordered by section position then item position. Reused by the
 * dashboards later — keep this the single source of the input-type filter.
 */
export function answerableItems(tree: VersionTree): Item[] {
  return tree.sections
    .flatMap((section) => section.items)
    .filter((item): item is Item =>
      INPUT_ITEM_TYPES.includes(item.itemType as InputItemType),
    )
}

/**
 * Valid `visible_when` targets for a section: CHOICE-type input questions in
 * strictly-earlier sections (lower position), as {questionKey, label,
 * sectionPosition, options}. free_text is excluded (see ConditionTarget).
 * Feeds the frontend condition editor so it only offers selectable targets.
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
            CHOICE_ITEM_TYPES.includes(item.itemType as InputItemType) &&
            item.questionKey != null,
        )
        .map((item) => ({
          questionKey: item.questionKey as string,
          label: item.label ?? '',
          sectionPosition: s.position,
          options: item.options ?? [],
        })),
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
