'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/types/database'

/**
 * Form-builder server actions (Architecture Rules 9 & 10): form metadata +
 * section mutations (this file's B3 block) and item mutations (B4 block).
 * `useActionState`-shaped (`(prevState, formData) => ActionState`), mirroring
 * `src/lib/admin/actions.ts` / `src/lib/members/actions.ts`. All user-facing
 * strings are pt-BR; raw Supabase/Postgres errors NEVER reach the UI
 * (CLAUDE.md §8).
 *
 * SECURITY: RLS is the authority — every write uses the cookie (RLS-scoped)
 * client, and the *_staff_admin_write policies (M6) already restrict writes to
 * staff_admins of the commission (+ admins) and the immutability triggers (M4)
 * freeze published/archived versions. On top of that, each action re-verifies,
 * COMMISSION-SCOPED and server-side, that the caller is admin OR a staff_admin
 * of THAT commission BEFORE writing, so an unauthorized attempt returns a clean
 * pt-BR "forbidden" instead of leaning only on an RLS row-count of zero. A write
 * that targets a non-draft version is caught by the immutability trigger
 * (SQLSTATE 23514) and surfaced as a clear pt-BR message, never the raw error.
 */

export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  notDraft:
    'Esta versão já foi publicada e não pode ser editada. Crie um rascunho para editar.',
  missingForm: 'Formulário não encontrado.',
  missingVersion: 'Versão não encontrada.',
  missingSection: 'Seção não encontrada.',
  titleRequired: 'Informe o título do formulário.',
  sectionTitleRequired: 'Informe o título da seção.',
  signoffRoleRequired: 'Selecione quem deve assinar a seção.',
  signoffRoleInvalid: 'Papel de assinatura inválido.',
  conditionInvalid: 'Condição de visibilidade inválida.',
  cannotDeleteOnlyDefault: 'Não é possível excluir a única seção do formulário.',
  formMetaUpdated: 'Formulário atualizado com sucesso.',
  sectionAdded: 'Seção adicionada com sucesso.',
  sectionUpdated: 'Seção atualizada com sucesso.',
  sectionRemoved: 'Seção removida com sucesso.',
  sectionMoved: 'Ordem das seções atualizada.',
  missingItem: 'Item não encontrado.',
  itemTypeInvalid: 'Tipo de item inválido.',
  labelRequired: 'Informe o enunciado da pergunta.',
  optionsRequired: 'Informe ao menos uma opção de resposta.',
  markdownRequired: 'Informe o texto a ser exibido.',
  altRequired: 'Informe um texto alternativo para a imagem.',
  imagePathRequired: 'Envie uma imagem antes de salvar.',
  sameVersionRequired:
    'Só é possível mover o item para uma seção do mesmo formulário.',
  itemAdded: 'Item adicionado com sucesso.',
  itemUpdated: 'Item atualizado com sucesso.',
  itemRemoved: 'Item removido com sucesso.',
  itemMoved: 'Item movido com sucesso.',
  missingCommission: 'Comissão não encontrada.',
  formCreated: 'Formulário criado com sucesso.',
  versionPublished: 'Formulário publicado com sucesso.',
  draftStarted: 'Rascunho criado para edição.',
  // publish-validation failures (validate_visible_when) → friendly pt-BR. The
  // RPC already raises pt-BR text; these are the safety net if the message is
  // absent. The RPC's own message (when present) is preferred.
  publishConditionError:
    'Há uma condição de visibilidade inválida. Verifique as seções condicionais.',
  notDraftPublish: 'Apenas versões em rascunho podem ser publicadas.',
  uploadFailed: 'Não foi possível enviar a imagem. Tente novamente.',
  fileRequired: 'Selecione uma imagem.',
  fileTooLarge: 'A imagem excede o tamanho máximo de 5 MB.',
  fileTypeInvalid: 'Envie uma imagem PNG, JPEG, WebP ou GIF.',
} as const

/** Postgres SQLSTATEs we translate to friendly pt-BR copy. */
const PG_CHECK_VIOLATION = '23514'
const PG_UNIQUE_VIOLATION = '23505'

/** The input item types (mirrors INPUT_ITEM_TYPES in queries/forms.ts). */
const INPUT_TYPES = ['multiple_choice', 'dropdown', 'checkbox', 'free_text']
const CHOICE_TYPES = ['multiple_choice', 'dropdown', 'checkbox']
const DISPLAY_TYPES = ['section_text', 'image']
const ALL_ITEM_TYPES = [...INPUT_TYPES, ...DISPLAY_TYPES]

/**
 * Derive a stable, URL-safe slug base from a question label. question_keys are
 * auto-generated (hidden from the user) and unique per VERSION; a short random
 * suffix (added at insert) disambiguates collisions. Empty/diacritic-only
 * labels fall back to 'pergunta'.
 */
function slugifyLabel(label: string): string {
  // NFD decomposes accented letters into base + combining mark; lowercasing
  // then collapsing any non-[a-z0-9] run (which includes the now-separate
  // combining marks and all punctuation/whitespace) to '_' yields an ASCII slug.
  const base = label
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return base || 'pergunta'
}

/** A short random suffix for question_key disambiguation. */
function shortSuffix(): string {
  return Math.random().toString(36).slice(2, 8)
}

/** The builder route family — revalidated as dynamic-segment pages. */
const BUILDER_FORM_PATH = '/c/[slug]/manage/forms/[formId]'
const FORMS_LIST_PATH = '/c/[slug]/manage/forms'

function revalidateBuilder(): void {
  // Intentional: [slug] and [formId] are literal Next.js dynamic-segment syntax,
  // not placeholders — revalidatePath with 'page' scope matches all concrete paths
  // under this route pattern (https://nextjs.org/docs/app/api-reference/functions/revalidatePath).
  revalidatePath(BUILDER_FORM_PATH, 'page')
  revalidatePath(FORMS_LIST_PATH, 'page')
}

/**
 * Authorize a builder action for a commission: admin, or a staff_admin of THAT
 * commission. Mirrors `authorizeStaffOps` in members/actions.ts. RLS still
 * backstops every write; this yields the friendly pt-BR forbidden.
 */
async function authorizeCommission(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.memberships.some(
    (m) => m.commission.id === commissionId && m.role === 'staff_admin',
  )
}

/** Map a write error to user-facing pt-BR copy (immutability vs generic). */
function mapWriteError(error: { code?: string } | null): string {
  if (error?.code === PG_CHECK_VIOLATION) return MESSAGES.notDraft
  return MESSAGES.generic
}

// ---------------------------------------------------------------------------
// Commission resolvers (for authz + revalidation)
// ---------------------------------------------------------------------------
// These read through the cookie (RLS-scoped) client, so a caller who cannot see
// the entity gets null → forbidden, leaking nothing.

async function commissionOfForm(
  supabase: SupabaseClient<Database>,
  formId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('forms')
    .select('commission_id')
    .eq('id', formId)
    .maybeSingle()
  return data?.commission_id ?? null
}

/** Resolve {commissionId, versionId} for a version's parent form. */
async function contextOfVersion(
  supabase: SupabaseClient<Database>,
  versionId: string,
): Promise<{ commissionId: string; formId: string } | null> {
  const { data } = await supabase
    .from('form_versions')
    .select('form_id, forms(commission_id)')
    .eq('id', versionId)
    .maybeSingle<{ form_id: string; forms: { commission_id: string } | null }>()
  if (!data?.forms) return null
  return { commissionId: data.forms.commission_id, formId: data.form_id }
}

/** Resolve {commissionId, versionId} for a section's parent version. */
async function contextOfSection(
  supabase: SupabaseClient<Database>,
  sectionId: string,
): Promise<{ commissionId: string; versionId: string } | null> {
  const { data } = await supabase
    .from('form_sections')
    .select('form_version_id, form_versions(forms(commission_id))')
    .eq('id', sectionId)
    .maybeSingle<{
      form_version_id: string
      form_versions: { forms: { commission_id: string } | null } | null
    }>()
  const commissionId = data?.form_versions?.forms?.commission_id
  if (!commissionId || !data) return null
  return { commissionId, versionId: data.form_version_id }
}

/** Resolve {commissionId, sectionId} for an item's parent section/version. */
async function contextOfItem(
  supabase: SupabaseClient<Database>,
  itemId: string,
): Promise<{ commissionId: string; sectionId: string } | null> {
  // PostgREST FK embedding hops: form_items.form_version_id → form_versions.id,
  // then form_versions.form_id → forms.id (to reach forms.commission_id).
  // Any migration that renames or drops either FK must update this embed path.
  const { data } = await supabase
    .from('form_items')
    .select(
      'section_id, form_versions(forms(commission_id))',
    )
    .eq('id', itemId)
    .maybeSingle<{
      section_id: string
      form_versions: { forms: { commission_id: string } | null } | null
    }>()
  const commissionId = data?.form_versions?.forms?.commission_id
  if (!commissionId || !data) return null
  return { commissionId, sectionId: data.section_id }
}

// ===========================================================================
// B3 — Form metadata + section mutations
// ===========================================================================

/**
 * Update a form's title/description. Always editable — even when a version is
 * published — because `forms` rows are not subject to the version-immutability
 * triggers (only the version's structure is frozen).
 */
export async function updateFormMeta(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const formId = String(formData.get('formId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  if (!formId) return { ok: false, error: MESSAGES.missingForm }

  const supabase = await createClient()
  const commissionId = await commissionOfForm(supabase, formId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingForm }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  if (!title) {
    return { ok: false, fieldErrors: { title: MESSAGES.titleRequired } }
  }

  const { error } = await supabase
    .from('forms')
    .update({ title, description: description || null })
    .eq('id', formId)

  if (error) return { ok: false, error: mapWriteError(error) }

  revalidateBuilder()
  return { ok: true, error: MESSAGES.formMetaUpdated }
}

/**
 * Add a new (non-default) section to a draft version, appended at the end. The
 * default section is created with the form (create_form RPC) and is never added
 * here. Title is optional at creation (it can be set later), so a blank title is
 * allowed — the section is a plain container until named.
 */
export async function addSection(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const versionId = String(formData.get('versionId') ?? '')
  const title = String(formData.get('title') ?? '').trim()

  if (!versionId) return { ok: false, error: MESSAGES.missingVersion }

  const supabase = await createClient()
  const ctx = await contextOfVersion(supabase, versionId)
  if (!ctx) return { ok: false, error: MESSAGES.missingVersion }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  // Append after the current max position.
  const { data: last } = await supabase
    .from('form_sections')
    .select('position')
    .eq('form_version_id', versionId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPosition = (last?.position ?? -1) + 1

  const { error } = await supabase.from('form_sections').insert({
    form_version_id: versionId,
    position: nextPosition,
    title: title || null,
    is_default: false,
  })

  if (error) return { ok: false, error: mapWriteError(error) }

  revalidateBuilder()
  return { ok: true, error: MESSAGES.sectionAdded }
}

/**
 * Update a section's editable fields. Respects the `form_sections` CHECK shapes:
 *   - the DEFAULT (anchor) section may carry a title + description, but never a
 *     visibility condition or a sign-off requirement (it is always first, so it
 *     cannot reference an earlier answer, and sign-off on the anchor is out of
 *     scope). Its title is OPTIONAL — a blank title clears it to null and is
 *     NOT an error (unlike non-default sections, which require a title);
 *   - non-default sections take title (required), description, visible_when
 *     condition, and sign-off settings, where requires_signoff implies a
 *     signoff_role and vice versa.
 * visible_when is parsed from the discrete fields the condition editor submits
 * (questionKey/op/value) or cleared when absent. Publish-time validation
 * (validate_visible_when) remains the authority on forward/missing references —
 * this only enforces the column SHAPE.
 */
export async function updateSection(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const sectionId = String(formData.get('sectionId') ?? '')
  if (!sectionId) return { ok: false, error: MESSAGES.missingSection }

  const supabase = await createClient()
  const ctx = await contextOfSection(supabase, sectionId)
  if (!ctx) return { ok: false, error: MESSAGES.missingSection }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { data: section } = await supabase
    .from('form_sections')
    .select('is_default')
    .eq('id', sectionId)
    .maybeSingle()
  if (!section) return { ok: false, error: MESSAGES.missingSection }

  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  // The default (anchor) section may carry a title + description but never a
  // condition or sign-off (the CHECK still forbids those). Its title is
  // optional: a blank title clears it to null without raising the
  // sectionTitleRequired error. visible_when / requires_signoff are left
  // untouched (they stay null / false).
  if (section.is_default) {
    const { error } = await supabase
      .from('form_sections')
      .update({ title: title || null, description: description || null })
      .eq('id', sectionId)
    if (error) return { ok: false, error: mapWriteError(error) }
    revalidateBuilder()
    return { ok: true, error: MESSAGES.sectionUpdated }
  }

  if (!title) {
    return { ok: false, fieldErrors: { title: MESSAGES.sectionTitleRequired } }
  }

  // visible_when: build from the editor's discrete fields, or clear it.
  const conditionKey = String(formData.get('conditionKey') ?? '').trim()
  let visibleWhen: Json = null
  if (conditionKey) {
    const op = String(formData.get('conditionOp') ?? '').trim()
    if (!['equals', 'not_equals', 'in'].includes(op)) {
      return { ok: false, error: MESSAGES.conditionInvalid }
    }
    const rawValue = String(formData.get('conditionValue') ?? '')
    // 'in' carries a JSON array of selected options; equals/not_equals a scalar.
    let value: Json = rawValue
    if (op === 'in') {
      try {
        const parsed: unknown = JSON.parse(rawValue)
        if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === 'string')) {
          return { ok: false, error: MESSAGES.conditionInvalid }
        }
        value = parsed as string[]
      } catch {
        return { ok: false, error: MESSAGES.conditionInvalid }
      }
    }
    visibleWhen = { question_key: conditionKey, op, value }
  }

  // Sign-off settings: requires_signoff iff a valid signoff_role is set.
  const requiresSignoff = String(formData.get('requiresSignoff') ?? '') === 'on'
  let signoffRole: string | null = null
  if (requiresSignoff) {
    signoffRole = String(formData.get('signoffRole') ?? '').trim()
    if (!signoffRole) {
      return {
        ok: false,
        fieldErrors: { signoffRole: MESSAGES.signoffRoleRequired },
      }
    }
    if (!['respondent', 'staff_admin'].includes(signoffRole)) {
      return { ok: false, error: MESSAGES.signoffRoleInvalid }
    }
  }

  const { error } = await supabase
    .from('form_sections')
    .update({
      title,
      description: description || null,
      visible_when: visibleWhen,
      requires_signoff: requiresSignoff,
      signoff_role: signoffRole,
    })
    .eq('id', sectionId)

  if (error) return { ok: false, error: mapWriteError(error) }

  revalidateBuilder()
  return { ok: true, error: MESSAGES.sectionUpdated }
}

/**
 * Delete a section (the caller confirms in the UI). PHASES.md §Phase 4: delete
 * "moves OR deletes its items".
 *   - MOVE branch (optional `moveItemsToSectionId` field present): reassign the
 *     section's items to that target (same version, appended at end) and delete
 *     the now-empty section — atomically, via the delete_section_moving_items
 *     RPC (no partial move-then-fail).
 *   - DELETE branch (field absent): the section's items cascade-delete with it
 *     (form_items.section_id ON DELETE CASCADE).
 * The DB guard (guard_default_section_delete) blocks deleting the only default
 * section either way; that surfaces as a clean pt-BR message.
 */
export async function deleteSection(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const sectionId = String(formData.get('sectionId') ?? '')
  const moveItemsToSectionId = String(
    formData.get('moveItemsToSectionId') ?? '',
  ).trim()
  if (!sectionId) return { ok: false, error: MESSAGES.missingSection }

  const supabase = await createClient()
  const ctx = await contextOfSection(supabase, sectionId)
  if (!ctx) return { ok: false, error: MESSAGES.missingSection }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  // MOVE branch: reassign items to the target, then delete — atomic in the RPC.
  if (moveItemsToSectionId) {
    if (moveItemsToSectionId === sectionId) {
      return { ok: false, error: MESSAGES.missingSection }
    }
    // The target must belong to the same version (else it is not a valid move
    // destination within this form).
    const targetCtx = await contextOfSection(supabase, moveItemsToSectionId)
    if (!targetCtx) return { ok: false, error: MESSAGES.missingSection }
    if (targetCtx.versionId !== ctx.versionId) {
      return { ok: false, error: MESSAGES.sameVersionRequired }
    }

    const { error } = await supabase.rpc('delete_section_moving_items', {
      p_section_id: sectionId,
      p_target_section_id: moveItemsToSectionId,
    })
    if (error) {
      if (error.code === PG_CHECK_VIOLATION) {
        return {
          ok: false,
          error: error.message.includes('default')
            ? MESSAGES.cannotDeleteOnlyDefault
            : MESSAGES.notDraft,
        }
      }
      return { ok: false, error: MESSAGES.generic }
    }
    revalidateBuilder()
    return { ok: true, error: MESSAGES.sectionRemoved }
  }

  // DELETE branch: items cascade with the section.
  const { error } = await supabase
    .from('form_sections')
    .delete()
    .eq('id', sectionId)

  if (error) {
    // The default-section guard raises check_violation; the published-structure
    // guard also raises check_violation. Disambiguate by message: the default
    // guard's message contains 'default', else it is the immutability guard.
    if (error.code === PG_CHECK_VIOLATION) {
      return {
        ok: false,
        error: error.message.includes('default')
          ? MESSAGES.cannotDeleteOnlyDefault
          : MESSAGES.notDraft,
      }
    }
    return { ok: false, error: MESSAGES.generic }
  }

  revalidateBuilder()
  return { ok: true, error: MESSAGES.sectionRemoved }
}

/**
 * Move a section up or down within its version. The atomic swap is the
 * reorder_section SQL RPC (ADR 0011) — supabase-js cannot express the
 * single-statement CASE swap the deferrable unique constraint requires.
 */
export async function moveSection(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const sectionId = String(formData.get('sectionId') ?? '')
  const direction = String(formData.get('direction') ?? '')
  if (!sectionId) return { ok: false, error: MESSAGES.missingSection }
  if (direction !== 'up' && direction !== 'down') {
    return { ok: false, error: MESSAGES.generic }
  }

  const supabase = await createClient()
  const ctx = await contextOfSection(supabase, sectionId)
  if (!ctx) return { ok: false, error: MESSAGES.missingSection }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('reorder_section', {
    p_section_id: sectionId,
    p_direction: direction,
  })

  if (error) return { ok: false, error: mapWriteError(error) }

  revalidateBuilder()
  return { ok: true, error: MESSAGES.sectionMoved }
}

// ===========================================================================
// B4 — Item mutations
// ===========================================================================

/**
 * Parse + validate the type-specific fields of an item from the form payload.
 * Returns either a validation error (to surface as ActionState) or the columns
 * to write. question_key is NOT set here — addItem generates it; updateItem
 * never changes it (it is stable across edits and versions).
 */
type ItemColumns = {
  label: string | null
  question_explanation: string | null
  options: Json
  required: boolean
  content: Json
}

function parseItemFields(
  itemType: string,
  formData: FormData,
): { error: ActionState } | { columns: ItemColumns } {
  if (INPUT_TYPES.includes(itemType)) {
    const label = String(formData.get('label') ?? '').trim()
    if (!label) {
      return { error: { ok: false, fieldErrors: { label: MESSAGES.labelRequired } } }
    }
    const explanation = String(formData.get('questionExplanation') ?? '').trim()
    const required = String(formData.get('required') ?? '') === 'on'

    let options: Json = null
    if (CHOICE_TYPES.includes(itemType)) {
      // Options arrive as repeated 'option' fields; keep non-empty, in order.
      const parsed = formData
        .getAll('option')
        .map((o) => String(o).trim())
        .filter((o) => o.length > 0)
      if (parsed.length === 0) {
        return { error: { ok: false, error: MESSAGES.optionsRequired } }
      }
      options = parsed
    }
    // free_text: options stays null (enforced by the form_items CHECK too).

    return {
      columns: {
        label,
        question_explanation: explanation || null,
        options,
        required,
        content: null,
      },
    }
  }

  if (itemType === 'section_text') {
    const markdown = String(formData.get('markdown') ?? '').trim()
    if (!markdown) {
      return { error: { ok: false, error: MESSAGES.markdownRequired } }
    }
    return {
      columns: {
        label: null,
        question_explanation: null,
        options: null,
        required: false,
        content: { markdown },
      },
    }
  }

  if (itemType === 'image') {
    const storagePath = String(formData.get('storagePath') ?? '').trim()
    const alt = String(formData.get('alt') ?? '').trim()
    const caption = String(formData.get('caption') ?? '').trim()
    if (!storagePath) {
      return { error: { ok: false, error: MESSAGES.imagePathRequired } }
    }
    if (!alt) {
      return { error: { ok: false, fieldErrors: { alt: MESSAGES.altRequired } } }
    }
    return {
      columns: {
        label: null,
        question_explanation: null,
        options: null,
        required: false,
        content: { storage_path: storagePath, alt, caption: caption || null },
      },
    }
  }

  return { error: { ok: false, error: MESSAGES.itemTypeInvalid } }
}

/**
 * Add an item to a section (appended at the end). Input items get an
 * auto-generated, per-version-unique question_key (slug(label) + short suffix,
 * retried on the unique index); display items carry `content` and never a key.
 * Server-side validation enforces: choice types need ≥1 option, free_text has
 * null options, image content has a non-empty alt.
 */
export async function addItem(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const sectionId = String(formData.get('sectionId') ?? '')
  const itemType = String(formData.get('itemType') ?? '')
  if (!sectionId) return { ok: false, error: MESSAGES.missingSection }
  if (!ALL_ITEM_TYPES.includes(itemType)) {
    return { ok: false, error: MESSAGES.itemTypeInvalid }
  }

  const supabase = await createClient()
  const ctx = await contextOfSection(supabase, sectionId)
  if (!ctx) return { ok: false, error: MESSAGES.missingSection }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const parsed = parseItemFields(itemType, formData)
  if ('error' in parsed) return parsed.error
  const columns = parsed.columns

  // Append after the current max position in the section.
  const { data: last } = await supabase
    .from('form_items')
    .select('position')
    .eq('section_id', sectionId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPosition = (last?.position ?? -1) + 1

  const isInput = INPUT_TYPES.includes(itemType)
  const keyBase = isInput ? slugifyLabel(columns.label ?? '') : null

  // Insert; for input items retry on a per-version question_key collision with a
  // fresh suffix. form_version_id is omitted — the sync trigger fills it.
  const MAX_ATTEMPTS = 5
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const questionKey = isInput ? `${keyBase}_${shortSuffix()}` : null
    const { error } = await supabase.from('form_items').insert({
      section_id: sectionId,
      // The form_items_sync_version trigger derives form_version_id from the
      // section; we pass the resolved value (same id) only to satisfy the typed
      // Insert, which marks the NOT-NULL column required.
      form_version_id: ctx.versionId,
      position: nextPosition,
      item_type: itemType,
      question_key: questionKey,
      label: columns.label,
      question_explanation: columns.question_explanation,
      options: columns.options,
      required: columns.required,
      content: columns.content,
    })

    if (!error) {
      revalidateBuilder()
      return { ok: true, error: MESSAGES.itemAdded }
    }
    // Only a question_key collision is retryable; anything else is terminal.
    if (error.code === PG_UNIQUE_VIOLATION && isInput) continue
    return { ok: false, error: mapWriteError(error) }
  }

  // Exhausted retries (astronomically unlikely) — fail cleanly.
  return { ok: false, error: MESSAGES.generic }
}

/**
 * Update an item's editable fields (same type-specific validation as addItem).
 * The item's type and its question_key are NOT changed: question_key is stable
 * so dashboards aggregate across versions, and changing item_type would break
 * the input-vs-display column invariants (the UI deletes + re-adds to change a
 * type).
 */
export async function updateItem(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const itemId = String(formData.get('itemId') ?? '')
  if (!itemId) return { ok: false, error: MESSAGES.missingItem }

  const supabase = await createClient()
  const ctx = await contextOfItem(supabase, itemId)
  if (!ctx) return { ok: false, error: MESSAGES.missingItem }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { data: existing } = await supabase
    .from('form_items')
    .select('item_type')
    .eq('id', itemId)
    .maybeSingle()
  if (!existing) return { ok: false, error: MESSAGES.missingItem }

  const parsed = parseItemFields(existing.item_type, formData)
  if ('error' in parsed) return parsed.error
  const columns = parsed.columns

  const { error } = await supabase
    .from('form_items')
    .update({
      label: columns.label,
      question_explanation: columns.question_explanation,
      options: columns.options,
      required: columns.required,
      content: columns.content,
    })
    .eq('id', itemId)

  if (error) return { ok: false, error: mapWriteError(error) }

  revalidateBuilder()
  return { ok: true, error: MESSAGES.itemUpdated }
}

/** Delete an item (the caller confirms). */
export async function deleteItem(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const itemId = String(formData.get('itemId') ?? '')
  if (!itemId) return { ok: false, error: MESSAGES.missingItem }

  const supabase = await createClient()
  const ctx = await contextOfItem(supabase, itemId)
  if (!ctx) return { ok: false, error: MESSAGES.missingItem }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.from('form_items').delete().eq('id', itemId)
  if (error) return { ok: false, error: mapWriteError(error) }

  revalidateBuilder()
  return { ok: true, error: MESSAGES.itemRemoved }
}

/**
 * Move an item up or down within its section. The atomic swap is the
 * reorder_item SQL RPC (ADR 0011).
 */
export async function moveItem(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const itemId = String(formData.get('itemId') ?? '')
  const direction = String(formData.get('direction') ?? '')
  if (!itemId) return { ok: false, error: MESSAGES.missingItem }
  if (direction !== 'up' && direction !== 'down') {
    return { ok: false, error: MESSAGES.generic }
  }

  const supabase = await createClient()
  const ctx = await contextOfItem(supabase, itemId)
  if (!ctx) return { ok: false, error: MESSAGES.missingItem }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('reorder_item', {
    p_item_id: itemId,
    p_direction: direction,
  })

  if (error) return { ok: false, error: mapWriteError(error) }

  revalidateBuilder()
  return { ok: true, error: MESSAGES.itemMoved }
}

/**
 * Move an item to another section of the SAME version, appended at the end of
 * the target. Cross-version moves are rejected (that would be a clone, not an
 * edit — and the form_items sync trigger forbids it at the DB level anyway).
 */
export async function moveItemToSection(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const itemId = String(formData.get('itemId') ?? '')
  const targetSectionId = String(formData.get('targetSectionId') ?? '')
  if (!itemId) return { ok: false, error: MESSAGES.missingItem }
  if (!targetSectionId) return { ok: false, error: MESSAGES.missingSection }

  const supabase = await createClient()
  const itemCtx = await contextOfItem(supabase, itemId)
  if (!itemCtx) return { ok: false, error: MESSAGES.missingItem }
  if (!(await authorizeCommission(itemCtx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  // Both sections must belong to the same version. Resolve each section's
  // version and compare.
  const sourceCtx = await contextOfSection(supabase, itemCtx.sectionId)
  const targetCtx = await contextOfSection(supabase, targetSectionId)
  if (!sourceCtx || !targetCtx) {
    return { ok: false, error: MESSAGES.missingSection }
  }
  if (sourceCtx.versionId !== targetCtx.versionId) {
    return { ok: false, error: MESSAGES.sameVersionRequired }
  }

  // Append at the end of the target section.
  const { data: last } = await supabase
    .from('form_items')
    .select('position')
    .eq('section_id', targetSectionId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPosition = (last?.position ?? -1) + 1

  const { error } = await supabase
    .from('form_items')
    .update({ section_id: targetSectionId, position: nextPosition })
    .eq('id', itemId)

  if (error) return { ok: false, error: mapWriteError(error) }

  revalidateBuilder()
  return { ok: true, error: MESSAGES.itemMoved }
}

// ===========================================================================
// B5 — Lifecycle (create / publish / edit-published) + image upload
// ===========================================================================

/** Result of the create flow — carries the ids the UI navigates to. */
export interface CreateFormState extends ActionState {
  formId?: string
  versionId?: string
}

/**
 * Create a form (+ v1 draft + default section) via the create_form RPC, from
 * the form-list create flow. `useActionState`-shaped. The RPC is
 * security-invoker so RLS authorizes it; we also re-check authz for a friendly
 * pt-BR forbidden. On success the UI navigates to the builder using the returned
 * ids.
 */
export async function createForm(
  _prev: CreateFormState | undefined,
  formData: FormData,
): Promise<CreateFormState> {
  const commissionId = String(formData.get('commissionId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }
  if (!title) {
    return { ok: false, fieldErrors: { title: MESSAGES.titleRequired } }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('create_form', {
      p_commission_id: commissionId,
      p_title: title,
      // generated Args types p_description as optional string; omit when blank.
      p_description: description || undefined,
    })
    .single()

  if (error || !data) return { ok: false, error: MESSAGES.generic }

  revalidateBuilder()
  return {
    ok: true,
    error: MESSAGES.formCreated,
    formId: data.form_id,
    versionId: data.version_id,
  }
}

/**
 * Publish a draft version via publish_form_version (validates conditions,
 * archives the prior published version, flips to published). Maps the RPC's
 * failures to clear pt-BR: forward/missing/first-section condition errors and
 * the "only drafts may be published" lifecycle error. The RPC raises pt-BR text
 * itself, so we surface its message when present and fall back to our copy
 * otherwise.
 */
export async function publishVersion(versionId: string): Promise<ActionState> {
  if (!versionId) return { ok: false, error: MESSAGES.missingVersion }

  const supabase = await createClient()
  const ctx = await contextOfVersion(supabase, versionId)
  if (!ctx) return { ok: false, error: MESSAGES.missingVersion }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('publish_form_version', {
    p_form_version_id: versionId,
  })

  if (error) {
    // validate_visible_when raises check_violation with a descriptive pt-BR
    // message; the lifecycle "not a draft" check too. Prefer the DB message when
    // it is the user-facing pt-BR text (it always is here), else a safe default.
    if (error.code === PG_CHECK_VIOLATION) {
      return { ok: false, error: error.message || MESSAGES.publishConditionError }
    }
    return { ok: false, error: MESSAGES.generic }
  }

  revalidateBuilder()
  return { ok: true, error: MESSAGES.versionPublished }
}

/** Result of the edit-published flow — carries the draft id to navigate to. */
export interface StartEditState extends ActionState {
  draftVersionId?: string
}

/**
 * Begin editing a published version: clone it into a new draft (or return the
 * existing draft — ADR 0012) via clone_form_version, and hand back the draft id
 * for navigation.
 */
export async function startEditFromPublished(
  sourceVersionId: string,
): Promise<StartEditState> {
  if (!sourceVersionId) return { ok: false, error: MESSAGES.missingVersion }

  const supabase = await createClient()
  const ctx = await contextOfVersion(supabase, sourceVersionId)
  if (!ctx) return { ok: false, error: MESSAGES.missingVersion }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { data, error } = await supabase.rpc('clone_form_version', {
    p_source_version_id: sourceVersionId,
  })

  if (error || !data) return { ok: false, error: MESSAGES.generic }

  revalidateBuilder()
  return { ok: true, error: MESSAGES.draftStarted, draftVersionId: data ?? undefined }
}

/** Result of a draft deletion — tells the client whether to navigate to the forms list. */
export interface DeleteDraftState extends ActionState {
  redirectToForms?: boolean
}

/**
 * Delete a draft version. If it is the form's only version (never published),
 * the entire form is deleted; otherwise only the draft is removed.
 * Returns `redirectToForms: true` when the form itself was deleted (client
 * navigates to the commission forms list), or `false` to send the client to
 * the form page (which will render the published version read-only).
 */
export async function deleteDraftVersion(
  versionId: string,
): Promise<DeleteDraftState> {
  if (!versionId) return { ok: false, error: MESSAGES.missingVersion }

  const supabase = await createClient()
  const ctx = await contextOfVersion(supabase, versionId)
  if (!ctx) return { ok: false, error: MESSAGES.missingVersion }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { data: version } = await supabase
    .from('form_versions')
    .select('status')
    .eq('id', versionId)
    .maybeSingle()
  if (!version) return { ok: false, error: MESSAGES.missingVersion }
  if (version.status !== 'draft') return { ok: false, error: MESSAGES.notDraft }

  const { count } = await supabase
    .from('form_versions')
    .select('id', { count: 'exact', head: true })
    .eq('form_id', ctx.formId)
    .eq('status', 'published')

  const hasPublished = (count ?? 0) > 0

  if (hasPublished) {
    const { error } = await supabase
      .from('form_versions')
      .delete()
      .eq('id', versionId)
    if (error) return { ok: false, error: MESSAGES.generic }
    revalidateBuilder()
    return { ok: true, redirectToForms: false }
  }

  // No published version — delete the whole form (cascades to versions).
  const { error } = await supabase
    .from('forms')
    .delete()
    .eq('id', ctx.formId)
  if (error) return { ok: false, error: MESSAGES.generic }
  revalidatePath(FORMS_LIST_PATH, 'page')
  return { ok: true, redirectToForms: true }
}

/** Result of an image upload — carries the immutable storage_path. */
export interface UploadState {
  ok: boolean
  error?: string
  storagePath?: string
}

const MAX_ASSET_BYTES = 5 * 1024 * 1024 // mirrors the bucket's 5 MiB limit
const ALLOWED_IMAGE_MIME = new Map<string, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
])

/**
 * Upload an image to `form-assets/{commissionId}/{immutable-name}`. The
 * RLS-scoped cookie client is used (NOT the service role): the
 * form_assets_insert_staff_admin policy (folder[1] = commission_id) authorizes
 * a staff_admin of the commission. We also re-check authz for the friendly
 * pt-BR forbidden.
 *
 * Storage objects are NEVER overwritten (Architecture Rule 6): every upload gets
 * a fresh, immutable path = `{timestamp}-{sha256(content).slice}.{ext}`, so a
 * re-uploaded image lands at a new path and any version still referencing the
 * old path renders the old object.
 */
export async function uploadFormAsset(
  commissionId: string,
  file: File,
): Promise<UploadState> {
  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }
  if (!file || file.size === 0) {
    return { ok: false, error: MESSAGES.fileRequired }
  }
  if (file.size > MAX_ASSET_BYTES) {
    return { ok: false, error: MESSAGES.fileTooLarge }
  }
  const ext = ALLOWED_IMAGE_MIME.get(file.type)
  if (!ext) {
    return { ok: false, error: MESSAGES.fileTypeInvalid }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
  // Immutable path: commission folder (for the RLS policy) + timestamp + content
  // hash so re-uploads never collide and never overwrite.
  const path = `${commissionId}/${Date.now()}-${hash}.${ext}`

  const supabase = await createClient()
  const { error } = await supabase.storage
    .from('form-assets')
    .upload(path, bytes, { contentType: file.type, upsert: false })

  if (error) return { ok: false, error: MESSAGES.uploadFailed }

  return { ok: true, storagePath: path }
}
