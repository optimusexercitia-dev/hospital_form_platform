import { createClient } from '@/lib/supabase/server'
import { getVersionTree } from '@/lib/queries/forms'
import type { Json } from '@/lib/types/database'
import type { VersionTree, VersionStatus } from '@/lib/queries/forms'

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
        'form_versions(form_id, forms(title))',
    )
    .eq('id', responseId)
    .maybeSingle<ResponseRow>()

  if (!response) return null

  // The version tree (sections + items in order) — same embed as the builder.
  const tree = await getVersionTree(response.form_version_id)
  if (!tree) return null

  const { data: answers } = await supabase
    .from('answers')
    .select('item_id, question_key, value')
    .eq('response_id', responseId)
    .returns<AnswerRow[]>()

  const answersByItemId: Record<string, Json> = {}
  const answersByKey: Record<string, Json> = {}
  for (const a of answers ?? []) {
    if (a.value === null) continue
    answersByItemId[a.item_id] = a.value
    answersByKey[a.question_key] = a.value
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

  const { data } = await supabase
    .from('responses')
    .select(
      'id, form_version_id, status, started_at, updated_at, submitted_at, ' +
        'form_versions(form_id, version_number, forms(commission_id, title))',
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
