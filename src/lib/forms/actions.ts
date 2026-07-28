'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/types/database'
import { MATRIX_ITEM_TYPES } from '@/lib/forms/item-tree'
import { resolveOptionCodes, slugifyLabel, shortSuffix } from '@/lib/forms/option-code'
import { parseItemConfig } from '@/lib/forms/parse-config'
import { parseRequired } from '@/lib/forms/parse-required'
import { isValidCondition } from '@/lib/forms/condition-shape'
import type { ValidationRuleInput } from '@/lib/queries/validations'

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
  defaultSectionNoCondition:
    'A seção inicial não pode ter condição de aparência.',
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
  optionColorInvalid: 'Cor de opção inválida.',
  optionScoreInvalid: 'A pontuação da opção deve ser um número.',
  // The config-parse pt-BR messages (min/max, length, flaggedWhen) live in
  // ./parse-config now (parseItemConfig returns the string; parseConfig re-wraps).
  conditionShapeInvalid: 'Condição de aparência inválida.',
  defaultValueInvalid: 'Valor padrão inválido para este tipo de pergunta.',
  markdownRequired: 'Informe o texto a ser exibido.',
  altRequired: 'Informe um texto alternativo para a imagem.',
  imagePathRequired: 'Envie uma imagem antes de salvar.',
  sameVersionRequired:
    'Só é possível mover o item para uma seção do mesmo formulário.',
  // FF-1 (ADR 0087) container authoring.
  groupLabelRequired: 'Informe o título do grupo.',
  missingParentItem: 'Grupo não encontrado.',
  parentNotContainer: 'O bloco selecionado não é um grupo.',
  nestedContainerForbidden: 'Um grupo não pode conter outro grupo.',
  parentSectionMismatch: 'O grupo pertence a outra seção.',
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
  // FF-2 (ADR 0089) matrix authoring.
  matrixUnavailable: 'O recurso de matrizes não está disponível.',
  notAMatrix: 'Esta pergunta não é uma matriz.',
  axisInvalid:
    'Verifique as linhas e colunas da matriz: cada uma precisa de um rótulo e não pode haver duplicatas.',
  riskWeightRequired:
    'A matriz de risco exige um peso em todas as linhas e colunas.',
  matrixAxesSaved: 'Matriz atualizada com sucesso.',
  // FF-3 (ADR 0090) validation authoring.
  validationsUnavailable: 'O recurso de validações não está disponível.',
  validationNotAllowed:
    'Esta pergunta não aceita esse tipo de validação.',
  validationInvalid:
    'Verifique a validação: informe os limites e uma mensagem para quem responde.',
  validationsSaved: 'Validações atualizadas com sucesso.',
  // Two DISTINCT failures that were sharing one sentence: an author who wrote a
  // single, malformed condition was told to remove an "E/OU" they never used.
  requiredIfGroupNotAllowed:
    'A condição de obrigatoriedade deve ser uma única condição (sem E/OU).',
  requiredIfShapeInvalid: 'Condição de obrigatoriedade inválida.',
} as const

/** Postgres SQLSTATEs we translate to friendly pt-BR copy. */
const PG_CHECK_VIOLATION = '23514'
const PG_UNIQUE_VIOLATION = '23505'
/** Authority denial. Deliberately a DISTINCT SQLSTATE from every HC0P* domain
 *  precondition, so "you may not" is never mistaken for "the data is wrong"
 *  (ADR 0079). Every FF-2 RPC checks authority FIRST and raises this. */
const PG_INSUFFICIENT_PRIVILEGE = '42501'

// FF-2 (ADR 0089) — the matrix error block. HC0O is skipped on purpose (`O` vs
// `0` in a SQLSTATE); HC0N* belongs to FF-1.
//
// ⚠ TWO CODES ARE DELIBERATELY ABSENT FROM THIS FILE'S MAPPINGS, and the gap is
// intentional — do not "complete" it (BUG-FF2-002 sweep):
//   · HC0P0 (axis code immutable) is raised by a BEFORE UPDATE trigger on the
//     two axis tables. The ONLY UPDATE any app path issues is the one inside
//     `upsert_matrix_axes`, which matches rows ON `code` and never writes it;
//     direct DML is denied to `authenticated` by K9. Unreachable.
//   · HC0P4 (version is not a draft) cannot surface through
//     `startEditFromPublished`: `clone_form_version` creates the target version
//     itself, so it is always a fresh draft. It IS reachable through
//     `upsertMatrixAxes`, where it is mapped.
// A `case` for an unreachable code is not free: it reads as reachable to the
// next person, and it invites a unit test that can never fail — a vacuous
// keystone by construction (ADR 0079). Leaving the gap, with this note, is the
// honest encoding.
const MATRIX_FLAG_OFF = 'HC0P2'
const MATRIX_NOT_A_MATRIX = 'HC0P3'
const MATRIX_NOT_DRAFT = 'HC0P4'
const MATRIX_AXIS_INVALID = 'HC0P5'
const MATRIX_WEIGHT_REQUIRED = 'HC0P6'

// FF-3 (ADR 0090) — the validation-engine block. `HC0P9` is the SUBMIT gate and
// belongs to the fill path (`src/lib/responses/actions.ts`), not here; the
// authoring codes start at `HC0Q0`. Draft-state denial deliberately REUSES
// `MATRIX_NOT_DRAFT` (`HC0P4`) — it is the same condition with the same pt-BR
// copy, and a second spelling would be a second thing to keep in sync.
const VALIDATIONS_FLAG_OFF = 'HC0Q0'
const VALIDATION_NOT_ALLOWED = 'HC0Q1'
const VALIDATION_INVALID = 'HC0Q2'

/** The input item types (mirrors INPUT_ITEM_TYPES in queries/forms.ts). */
const INPUT_TYPES = [
  'multiple_choice',
  'dropdown',
  'checkbox',
  'free_text',
  'short_text',
  'number',
  'date',
  'time',
]
const CHOICE_TYPES = ['multiple_choice', 'dropdown', 'checkbox']
/** Choice types that may carry per-option COLOURS (dropdown excluded — native
 * `<select>` can't render colour; decision #4). */
const COLOR_OPTION_TYPES = ['multiple_choice', 'checkbox']
// The per-type config sets (BOUNDED / TEXT_LENGTH / ALLOW_OTHER / FLAGGED_WHEN) +
// their pt-BR messages moved into `./parse-config` (parseItemConfig) so the config
// parse is unit-testable; parseConfig below is a thin ActionState wrapper.
/** The valid colour tokens (mirrors ColorToken / the 7-token palette). */
const COLOR_TOKENS = ['muted', 'slate', 'blue', 'amber', 'green', 'red', 'violet']
/** The condition operators accepted in a `visible_when` sub-condition. */
/** Input types a condition may TARGET (decision #7). */
const DISPLAY_TYPES = ['section_text', 'image']
/**
 * FF-1 (ADR 0087) — the CONTAINER types. A container collects no answer: the
 * live `form_items_input_vs_display` arm requires
 * `content IS NULL AND required = false AND question_key IS NULL AND label IS
 * NOT NULL AND default_value IS NULL`, and `form_items_no_nested_container`
 * caps depth at 1 (ruling 1). Both invariants are asserted below rather than
 * relied on, so a malformed client gets pt-BR copy instead of a raw 23514.
 */
const CONTAINER_TYPES = ['group', 'repeating_group']
/**
 * FF-2 (ADR 0089) — the MATRIX types. Mirrors `MATRIX_ITEM_TYPES` from
 * `./item-tree` (imported, not re-spelled: a fourth hand-written copy of this
 * list is exactly the drift that let matrix fall out of `ALL_ITEM_TYPES`).
 *
 * They are ANSWERABLE — they carry a `question_key` and feed dashboards — but
 * their answer lives in `answer_matrix_cells` / `answer_risk_matrix`, not in
 * `answers.value`. That is why they are their own set rather than members of
 * `INPUT_TYPES`, which means "answer is a scalar in `answers.value`".
 */
const MATRIX_TYPES: readonly string[] = MATRIX_ITEM_TYPES
/**
 * Every type an author may create. ⚠ A type missing here is REJECTED by
 * `addItem` with `itemTypeInvalid` — matrix was omitted when FF-2 Wave 1 landed
 * the writers, so `upsert_matrix_axes` was unreachable in the product while
 * every one of its own tests passed. Fails CLOSED (no bad data), invisible to
 * lint/typecheck/unit/pgTAP. Same shape as ETH·E3a's `p_case_type_id`.
 */
const ALL_ITEM_TYPES = [
  ...INPUT_TYPES,
  ...DISPLAY_TYPES,
  ...CONTAINER_TYPES,
  ...MATRIX_TYPES,
]
/**
 * Types that get a minted `question_key`. NOT the same question as
 * `INPUT_TYPES`: the aggregation contract for a matrix is
 * `(question_key, row_code, col_code)`, so it needs a key just as much as a
 * scalar does — and `form_items_input_vs_display` REQUIRES one for both matrix
 * types. Mirrors `ANSWERABLE_ITEM_TYPES` in queries/forms.ts.
 */
const ANSWERABLE_TYPES = [...INPUT_TYPES, ...MATRIX_TYPES]

/** The builder route family — revalidated as dynamic-segment pages. */
const BUILDER_FORM_PATH = '/o/[org]/c/[commission]/manage/forms/[formId]'
const FORMS_LIST_PATH = '/o/[org]/c/[commission]/manage/forms'

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
 * visible_when is parsed from the shared `visibleWhen` JSON field (legacy single
 * OR AND/OR group — the SAME field the shared ConditionBuilder emits for both
 * sections and questions) via {@link parseVisibleWhen}, or cleared when absent.
 * Publish-time validation (validate_visible_when) remains the authority on
 * forward/missing references — this only enforces the column SHAPE.
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
  // condition or sign-off (the form_sections_default_shape CHECK forbids those).
  // Its title is optional: a blank title clears it to null without raising the
  // sectionTitleRequired error. visible_when / requires_signoff are left
  // untouched (they stay null / false). A posted `visibleWhen` for the default
  // section is rejected with a friendly pt-BR error rather than letting the raw
  // Postgres CHECK bubble up.
  if (section.is_default) {
    const rawVisible = String(formData.get('visibleWhen') ?? '').trim()
    if (rawVisible) {
      return { ok: false, error: MESSAGES.defaultSectionNoCondition }
    }
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

  // visible_when: parse the shared `visibleWhen` JSON field (legacy single OR
  // AND/OR group) via the SAME helper addItem/updateItem use, so a section
  // condition built with the shared ConditionBuilder round-trips correctly.
  // Absent/blank clears it (forms that preserve the condition re-emit it via the
  // SectionConditionFields hidden field). Publish-time validate_visible_when
  // remains the authority on forward/missing references — this only enforces the
  // column SHAPE.
  const parsedVisible = parseVisibleWhen(formData)
  if ('error' in parsedVisible) return parsedVisible.error
  const visibleWhen: Json = parsedVisible.visibleWhen

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
 *
 * form-builder-enhancements FormData contract (parsed by the helpers below):
 *   - `itemType` may be any of {@link INPUT_TYPES} (now incl. short_text /
 *     number / date / time) or {@link DISPLAY_TYPES}.
 *   - choice types: repeated `option` fields (the label), each paired with a
 *     repeated `optionColor` field at the SAME index (a token or '' for none);
 *     colours are honoured only for {@link COLOR_OPTION_TYPES}
 *     (multiple_choice + checkbox).
 *   - number/date: optional `configMin` / `configMax` (→ the `config` jsonb).
 *   - any input: optional `visibleWhen` — a JSON-encoded visibility rule (legacy
 *     single `{question_key, op, value}` OR `{match, conditions[]}` group). When PRESENT the server
 *     CLEARS `required` (defence for the form_items_conditional_not_required
 *     CHECK), regardless of the submitted `required` checkbox.
 */
type ItemColumns = {
  label: string | null
  question_explanation: string | null
  config: Json
  visible_when: Json
  required: boolean
  /**
   * FF-3 (ADR 0090 ruling 4): the conditional-requirement rule, or null. Forced
   * null for containers, display items and `reference` — the
   * `form_items_input_vs_display` CHECK forbids it there, because a type whose
   * required-ness nothing checks must not be made required by a second door.
   */
  required_if: Json
  content: Json
  /**
   * answer-model-v2 (BE-0 contract, ADR 0046 / P2.4): the parsed per-input
   * default value (scalar, or option code / code[] for choice; `null` for
   * display items). Parsed + shape-validated here from the `defaultValue`
   * FormData field; type-vs-item + choice-code-exists validation is the
   * publish-time authority (BE-4). Held on the columns object so addItem/
   * updateItem can persist it into `form_items.default_value`.
   * TODO(answer-model-v2 BE-1): the `default_value` column does not exist yet, so
   * addItem/updateItem do NOT write this field until BE-1 lands the column and
   * BE-5 regenerates the typed Insert/Update. Parsing now is inert + forward-safe.
   */
  default_value: Json
}

/** The result of parsing an item's fields: the form_items columns + (for choice
 * types) the parsed option rows to persist into form_item_options. */
type ParsedItem = { columns: ItemColumns; options: ParsedOption[] | null }

/**
 * A parsed option row (form-model-normalization). `code` carries the existing
 * option's stable code for a KEPT row (so updateItem preserves it) or '' for a
 * NEW row (addItem/updateItem generates one). `color`/`score`/`analyticsCode`
 * are the editable metadata.
 */
interface ParsedOption {
  /** Existing option code (kept rows) or '' (new rows — code generated). */
  code: string
  label: string
  color: string | null
  score: number | null
  analyticsCode: string | null
  /** Flagged-scoring: a selected flagged option contributes +1 to __flagged_count__. */
  flagged: boolean
}

/**
 * Parse the index-parallel `option` (label) / `optionCode` / `optionColor` /
 * `optionScore` / `optionAnalyticsCode` fields into {@link ParsedOption} rows.
 * Colours are kept only for {@link COLOR_OPTION_TYPES}; for other choice types
 * the colour is forced to null. Empty labels are dropped (with their metadata).
 * Position is the surviving row index. `optionScore` is the raw number string
 * ('' = none); a non-numeric non-empty value is rejected. `optionCode` is the
 * existing code for a kept row, '' for a new row.
 */
function parseOptions(
  itemType: string,
  formData: FormData,
): { error: ActionState } | { options: ParsedOption[] } {
  const labels = formData.getAll('option').map((o) => String(o))
  const codes = formData.getAll('optionCode').map((c) => String(c))
  const colors = formData.getAll('optionColor').map((c) => String(c))
  const scores = formData.getAll('optionScore').map((s) => String(s))
  const analytics = formData.getAll('optionAnalyticsCode').map((a) => String(a))
  const flags = formData.getAll('optionFlagged').map((f) => String(f))
  const colorsAllowed = COLOR_OPTION_TYPES.includes(itemType)

  const rows: ParsedOption[] = []
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i].trim()
    if (!label) continue

    const rawColor = (colors[i] ?? '').trim()
    let color: string | null = null
    if (rawColor && colorsAllowed) {
      if (!COLOR_TOKENS.includes(rawColor)) {
        return { error: { ok: false, error: MESSAGES.optionColorInvalid } }
      }
      color = rawColor
    }

    const rawScore = (scores[i] ?? '').trim()
    let score: number | null = null
    if (rawScore) {
      const n = Number(rawScore)
      if (!Number.isFinite(n)) {
        return { error: { ok: false, error: MESSAGES.optionScoreInvalid } }
      }
      score = n
    }

    const analyticsCode = (analytics[i] ?? '').trim() || null
    // Flagged is a truthy hidden field ('1' = flagged, '' = not); at the SAME
    // index as the other option-* parallel fields.
    const flagged = (flags[i] ?? '').trim() === '1'

    rows.push({
      code: (codes[i] ?? '').trim(),
      label,
      color,
      score,
      analyticsCode,
      flagged,
    })
  }
  if (rows.length === 0) {
    return { error: { ok: false, error: MESSAGES.optionsRequired } }
  }
  return { options: rows }
}

/**
 * Parse the per-type `config` jsonb from the item form. Handles, per type:
 *   - number/date  → `min`/`max` bounds (`configMin`/`configMax`);
 *   - free_text/short_text → `minLength`/`maxLength` CHARACTER limits
 *     (`configMinLength`/`configMaxLength`);
 *   - multiple_choice/checkbox → `allowOther` ("Incluir opção 'Outros'",
 *     `configAllowOther` = '1').
 * Returns `{config: null}` when the type carries no config OR nothing is set.
 * min ≤ max is enforced here (and again at submit by `assert_item_bounds`).
 *   - number/date/time → `flaggedWhen` ("Flagged If"), read from the hidden
 *     `configFlaggedWhen` field (a `JSON.stringify({op, value})` string; blank =
 *     none). Shape-validated here (op in the ordered/equality set + `value`
 *     present); the value-type-vs-item-type match is deferred to publish-time
 *     `app.is_valid_flagged_when` (mirroring how `parseVisibleWhen` checks shape
 *     only, not deep types).
 */
function parseConfig(
  itemType: string,
  formData: FormData,
): { error: ActionState } | { config: Json } {
  const res = parseItemConfig(itemType, formData)
  if ('error' in res) return { error: { ok: false, error: res.error } }
  return { config: res.config }
}

/** Validate ONE sub-condition's shape (key string, op in set, value present). */

/**
 * Parse the optional `visibleWhen` JSON field into the `visible_when` jsonb.
 * Returns `{visibleWhen: null}` when absent/blank. Validates the SHAPE only
 * (legacy single OR non-empty `{match, conditions[]}` group); forward/self-ref
 * and operator↔target-type are the publish-time `validate_visible_when`
 * authority (BE-3). Mirrors the `app.is_valid_visibility` CHECK shape (BE-2).
 */
function parseVisibleWhen(
  formData: FormData,
): { error: ActionState } | { visibleWhen: Json } {
  const raw = String(formData.get('visibleWhen') ?? '').trim()
  if (!raw) return { visibleWhen: null }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: { ok: false, error: MESSAGES.conditionShapeInvalid } }
  }
  if (parsed === null || typeof parsed !== 'object') {
    return { error: { ok: false, error: MESSAGES.conditionShapeInvalid } }
  }
  const rec = parsed as Record<string, unknown>

  // Group shape: {match: all|any, conditions: [...]}.
  if ('conditions' in rec) {
    if (rec.match !== 'all' && rec.match !== 'any') {
      return { error: { ok: false, error: MESSAGES.conditionShapeInvalid } }
    }
    if (!Array.isArray(rec.conditions) || rec.conditions.length === 0) {
      return { error: { ok: false, error: MESSAGES.conditionShapeInvalid } }
    }
    if (!rec.conditions.every(isValidCondition)) {
      return { error: { ok: false, error: MESSAGES.conditionShapeInvalid } }
    }
    return { visibleWhen: parsed as Json }
  }

  // Legacy single shape.
  if (!isValidCondition(parsed)) {
    return { error: { ok: false, error: MESSAGES.conditionShapeInvalid } }
  }
  return { visibleWhen: parsed as Json }
}

/**
 * FF-3 (ADR 0090 ruling 4): parse the optional `requiredIf` FormData field into
 * the `required_if` jsonb.
 *
 * SINGLE CONDITION ONLY — deliberately narrower than {@link parseVisibleWhen},
 * because `form_items_required_if_shape` runs `app.is_valid_condition`, which
 * requires `question_key`/`op` at the top level and therefore REJECTS the
 * `{match, conditions[]}` group shape (verified against the live catalog, not
 * inferred). Accepting a group here would hand the author a 23514 from the
 * database instead of a sentence they can act on.
 *
 * Shape only. The publish-time authority is `public.validate_visible_when`, which
 * FF-3 extended to cover `required_if`: existence of the referenced key, the
 * earlier-question rule, and FF-1's outside-in ban.
 */
function parseRequiredIf(
  formData: FormData,
): { error: ActionState } | { requiredIf: Json } {
  const raw = String(formData.get('requiredIf') ?? '').trim()
  if (!raw) return { requiredIf: null }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: { ok: false, error: MESSAGES.requiredIfShapeInvalid } }
  }
  if (parsed === null || typeof parsed !== 'object') {
    return { error: { ok: false, error: MESSAGES.requiredIfShapeInvalid } }
  }
  // The group shape is storable for `visible_when` and NOT for this column —
  // and it is the ONLY failure the "sem E/OU" sentence describes.
  if ('conditions' in (parsed as Record<string, unknown>)) {
    return { error: { ok: false, error: MESSAGES.requiredIfGroupNotAllowed } }
  }
  if (!isValidCondition(parsed)) {
    return { error: { ok: false, error: MESSAGES.requiredIfShapeInvalid } }
  }
  return { requiredIf: parsed as Json }
}

/**
 * answer-model-v2 (BE-0 contract, ADR 0046 / P2.4): parse the optional
 * `defaultValue` FormData field into the `default_value` jsonb. The field is a
 * JSON-encoded scalar (free_text/short_text/number/date/time) or option code /
 * code[] (choice). Absent/blank → `null` (no default). Only the SHAPE is checked
 * here (parseable JSON; a string/number/boolean scalar, or an array of strings
 * for a choice code-set); the type-vs-item and choice-code-existence checks are
 * the publish-time `publish_form_version` authority (BE-4). Display items never
 * reach this (parseItemFields calls it only for input types).
 */
function parseDefaultValue(
  itemType: string,
  formData: FormData,
): { error: ActionState } | { defaultValue: Json } {
  const raw = String(formData.get('defaultValue') ?? '').trim()
  if (!raw) return { defaultValue: null }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: { ok: false, error: MESSAGES.defaultValueInvalid } }
  }
  if (parsed === null) return { defaultValue: null }

  if (CHOICE_TYPES.includes(itemType)) {
    // Choice defaults store option code(s): a single code (multiple_choice/
    // dropdown) or an array of codes (checkbox). Accept either shape here; the
    // deep item-vs-shape check is the publish validator's job (BE-4).
    if (typeof parsed === 'string') return { defaultValue: parsed }
    if (Array.isArray(parsed) && parsed.every((c) => typeof c === 'string')) {
      return { defaultValue: parsed as Json }
    }
    return { error: { ok: false, error: MESSAGES.defaultValueInvalid } }
  }

  // Scalar inputs: a JSON scalar (string/number/boolean).
  if (
    typeof parsed === 'string' ||
    typeof parsed === 'number' ||
    typeof parsed === 'boolean'
  ) {
    return { defaultValue: parsed }
  }
  return { error: { ok: false, error: MESSAGES.defaultValueInvalid } }
}

function parseItemFields(
  itemType: string,
  formData: FormData,
): { error: ActionState } | ParsedItem {
  if (INPUT_TYPES.includes(itemType)) {
    const label = String(formData.get('label') ?? '').trim()
    if (!label) {
      return { error: { ok: false, fieldErrors: { label: MESSAGES.labelRequired } } }
    }
    const explanation = String(formData.get('questionExplanation') ?? '').trim()

    // form-model-normalization: options are persisted as form_item_options rows
    // by addItem/updateItem, NOT as a form_items column. Parse them here; the
    // caller does the row CRUD. free_text/short_text/number/date/time carry none.
    let options: ParsedOption[] | null = null
    if (CHOICE_TYPES.includes(itemType)) {
      const parsedOptions = parseOptions(itemType, formData)
      if ('error' in parsedOptions) return { error: parsedOptions.error }
      options = parsedOptions.options
    }

    const parsedConfig = parseConfig(itemType, formData)
    if ('error' in parsedConfig) return { error: parsedConfig.error }

    const parsedVisible = parseVisibleWhen(formData)
    if ('error' in parsedVisible) return { error: parsedVisible.error }

    // FF-3 (ADR 0090 ruling 4): the conditional-requirement rule.
    const parsedRequiredIf = parseRequiredIf(formData)
    if ('error' in parsedRequiredIf) return { error: parsedRequiredIf.error }

    // answer-model-v2 (BE-0): parse the optional per-input default value.
    const parsedDefault = parseDefaultValue(itemType, formData)
    if ('error' in parsedDefault) return { error: parsedDefault.error }

    // FF-1 (ADR 0087 ruling 4) — `required` is persisted AS SUBMITTED, including
    // alongside a visibility condition.
    //
    // This previously cleared `required` whenever `visible_when` was present,
    // defending the `form_items_conditional_not_required` CHECK. **BE-1 dropped
    // that CHECK platform-wide**, so the defence outlived the constraint: the
    // builder offered "obrigatória" beside a condition (FE-4) while this line
    // silently discarded it on save — for top-level items AND repeating-group
    // children (BUG-FF1-002). Deleting stale defensive code is the whole point of
    // ruling 4; `app.response_required_complete` already carries the branch that
    // makes the combination safe (visibility wins — a required item hidden by its
    // own condition does not block submit), which was unreachable dead code only
    // because the CHECK made the combination unconstructible.
    const required = parseRequired(formData)

    return {
      columns: {
        label,
        question_explanation: explanation || null,
        config: parsedConfig.config,
        visible_when: parsedVisible.visibleWhen,
        required,
        required_if: parsedRequiredIf.requiredIf,
        content: null,
        default_value: parsedDefault.defaultValue,
      },
      options,
    }
  }

  // FF-1 (ADR 0087) — CONTAINER (`group` / `repeating_group`). Shaped to the
  // live `form_items_input_vs_display` container arm: a label is REQUIRED, and
  // `question_key` / `required` / `default_value` / `content` are all forced
  // empty. A container's "required-ness" is `config.minInstances`, never the
  // `required` flag (BE-0 contract), and it is invisible to every
  // question_key-keyed path — dashboards, conditions, completeness.
  if (CONTAINER_TYPES.includes(itemType)) {
    const label = String(formData.get('label') ?? '').trim()
    if (!label) {
      return {
        error: { ok: false, fieldErrors: { label: MESSAGES.groupLabelRequired } },
      }
    }
    const explanation = String(formData.get('questionExplanation') ?? '').trim()

    // `repeating_group` → config.minInstances / maxInstances; a plain `group`
    // has no instances and parseItemConfig yields null for it.
    const parsedConfig = parseConfig(itemType, formData)
    if ('error' in parsedConfig) return { error: parsedConfig.error }

    // A container may carry its own visibility condition — hiding it hides every
    // child with it, and a hidden group requires nothing (ruling 3, settled by
    // the precedent `app.response_required_complete` already applies).
    const parsedVisible = parseVisibleWhen(formData)
    if ('error' in parsedVisible) return { error: parsedVisible.error }

    return {
      columns: {
        label,
        question_explanation: explanation || null,
        config: parsedConfig.config,
        visible_when: parsedVisible.visibleWhen,
        required: false,
        // A container's requirement is `config.minInstances`, never a condition.
        required_if: null,
        content: null,
        default_value: null,
      },
      options: null,
    }
  }

  // FF-2 (ADR 0089) — MATRIX (`matrix` / `risk_matrix`). Shaped to the live
  // `form_items_input_vs_display` matrix arm, which the ...000000 migration
  // relaxed: `question_key IS NOT NULL AND label IS NOT NULL AND content IS
  // NULL`, with NO `required = false` pin any more (ruling 3 made row-complete
  // required-ness real, and `app.item_required_satisfied` now checks it).
  //
  // The AXES are not parsed here. They live in their own tables and go through
  // `upsertMatrixAxes` / `upsert_matrix_axes` — a DEFINER door, because
  // `form_matrix_rows`/`form_matrix_columns` are SELECT-only for `authenticated`
  // (K9). So creating a matrix block yields an item with an EMPTY grid, which is
  // a legal draft state and a publish-blocking one (`HC0P5`).
  //
  // `options` / `default_value` are null: columns are not `form_item_options`
  // (ruling 1 — the columns ARE the options, held on the axis table), and a
  // matrix has no scalar to pre-fill.
  if (MATRIX_TYPES.includes(itemType)) {
    const label = String(formData.get('label') ?? '').trim()
    if (!label) {
      return { error: { ok: false, fieldErrors: { label: MESSAGES.labelRequired } } }
    }
    const explanation = String(formData.get('questionExplanation') ?? '').trim()

    // `risk_matrix` → config.riskBands (the score→band display mapping); a plain
    // `matrix` has none and parseItemConfig yields null for it.
    const parsedConfig = parseConfig(itemType, formData)
    if ('error' in parsedConfig) return { error: parsedConfig.error }

    const parsedVisible = parseVisibleWhen(formData)
    if ('error' in parsedVisible) return { error: parsedVisible.error }

    // FF-3 (ADR 0090 ruling 4): the conditional-requirement rule.
    const parsedRequiredIf = parseRequiredIf(formData)
    if ('error' in parsedRequiredIf) return { error: parsedRequiredIf.error }

    // ruling 3 + ruling 4: `required` is persisted AS SUBMITTED, including
    // alongside a visibility condition — a hidden matrix requires nothing, which
    // `app.item_required_satisfied`'s callers enforce by never asking about it.
    const required = parseRequired(formData)

    return {
      columns: {
        label,
        question_explanation: explanation || null,
        config: parsedConfig.config,
        visible_when: parsedVisible.visibleWhen,
        required,
        // A matrix MAY carry one: the shape CHECK allows it and
        // `app.item_required_satisfied` has a row-complete arm, so a
        // conditionally-required grid is a coherent state.
        required_if: parsedRequiredIf.requiredIf,
        content: null,
        default_value: null,
      },
      options: null,
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
        config: null,
        visible_when: null,
        required: false,
        // A display item is never required, by either door.
        required_if: null,
        content: { markdown },
        default_value: null,
      },
      options: null,
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
        config: null,
        visible_when: null,
        required: false,
        required_if: null,
        content: { storage_path: storagePath, alt, caption: caption || null },
        default_value: null,
      },
      options: null,
    }
  }

  return { error: { ok: false, error: MESSAGES.itemTypeInvalid } }
}

/**
 * Reconcile a choice item's option rows to the submitted set (addItem +
 * updateItem). Kept rows (those whose submitted `code` matches an existing row)
 * are UPDATEd (label/color/score/analytics_code/position — never the code, which
 * the DB freezes); new rows keep their client-supplied `code` (or get a fresh
 * one only when they arrive without one — see {@link resolveOptionCodes},
 * BUG-AMV2-002); existing rows whose code is absent from the submission are
 * DELETEd. This preserves the analytics-stable code across edits while letting
 * the author rename/recolour/reorder freely.
 */
async function reconcileOptionRows(
  supabase: SupabaseClient<Database>,
  itemId: string,
  options: ParsedOption[],
): Promise<{ ok: boolean }> {
  // Resolve which submitted rows are KEPT (code already on the item) vs NEW, so
  // new rows get an app-generated code (Decision 2) while kept rows preserve
  // theirs (the code is DB-frozen). The whole set is then reconciled ATOMICALLY
  // by the reconcile_item_options RPC in ONE transaction — the per-row position
  // UPDATE loop is gone (it ran in separate transactions, so a reorder into an
  // occupied slot violated the DEFERRABLE unique(item_id, position); QA MAJOR-1).
  const { data: existing } = await supabase
    .from('form_item_options')
    .select('code')
    .eq('item_id', itemId)
    .returns<{ code: string }[]>()

  const existingCodes = (existing ?? []).map((e) => e.code)

  // Build the ordered payload; every element carries a code. A row that arrives
  // with a non-empty code KEEPS it — kept rows AND brand-new client-minted rows
  // — so a choice-type "Valor padrão" set in the same dialog still references a
  // real option code after save (BUG-AMV2-002); only code-less rows are minted
  // server-side. (The prior `existingCodes.has(code)` gate regenerated every new
  // row's code, orphaning the default → HC080 "valor padrão inválido" at publish.)
  const codes = resolveOptionCodes(existingCodes, options)
  const payload = options.map((o, i) => ({
    code: codes[i],
    label: o.label,
    color_token: o.color,
    score: o.score,
    analytics_code: o.analyticsCode,
    flagged: o.flagged,
  }))

  const { error } = await supabase.rpc('reconcile_item_options', {
    p_item_id: itemId,
    p_options: payload as unknown as Json,
  })
  if (error) return { ok: false }

  return { ok: true }
}

/** One `form_items` row as the FF-1 layout helpers read it. */
interface LayoutRow {
  id: string
  position: number
  item_type: string
  parent_item_id: string | null
}

/** A section's items ordered by `position` — the flat ordinal space that
 *  `validate_visible_when`'s "pergunta anterior" rule reads. */
async function sectionLayout(
  supabase: SupabaseClient<Database>,
  sectionId: string,
): Promise<LayoutRow[]> {
  const { data } = await supabase
    .from('form_items')
    .select('id, position, item_type, parent_item_id')
    .eq('section_id', sectionId)
    .order('position', { ascending: true })
    .returns<LayoutRow[]>()
  return data ?? []
}

/**
 * FF-1 — resolve the `position` a new block takes, shifting whatever sits at or
 * after it down by one.
 *
 * A TOP-LEVEL block appends at `max(position) + 1`: nothing moves. A CHILD must
 * land contiguously immediately after its container and that container's
 * existing children, so every later row shifts by one. The shift is applied
 * HIGHEST-POSITION-FIRST, which makes each target slot vacant at the moment it
 * is written — collision-free against `form_items_section_id_position_key`
 * without needing a transaction (supabase-js has none across statements).
 *
 * Contiguity itself is a PUBLISH-time invariant (`app.validate_group_layout`),
 * not a trigger, precisely because a draft mid-edit legitimately passes through
 * non-contiguous states — so nothing here can be rejected mid-flight.
 */
async function resolveInsertPosition(
  supabase: SupabaseClient<Database>,
  sectionId: string,
  parentItemId: string | null,
): Promise<{ position: number } | { error: string }> {
  const rows = await sectionLayout(supabase, sectionId)

  if (!parentItemId) {
    const max = rows.length > 0 ? rows[rows.length - 1].position : -1
    return { position: max + 1 }
  }

  const parent = rows.find((r) => r.id === parentItemId)
  // A parent absent from THIS section's rows is either gone or in another
  // section; both are the same user-visible mistake.
  if (!parent) return { error: MESSAGES.parentSectionMismatch }
  if (!CONTAINER_TYPES.includes(parent.item_type)) {
    return { error: MESSAGES.parentNotContainer }
  }

  // The container's own children, wherever they currently sit.
  const childPositions = rows
    .filter((r) => r.parent_item_id === parentItemId)
    .map((r) => r.position)
  const target =
    (childPositions.length > 0
      ? Math.max(...childPositions)
      : parent.position) + 1

  // Shift descending so every destination slot is free when it is written.
  const toShift = rows
    .filter((r) => r.position >= target)
    .sort((a, b) => b.position - a.position)
  for (const row of toShift) {
    const { error } = await supabase
      .from('form_items')
      .update({ position: row.position + 1 })
      .eq('id', row.id)
    if (error) return { error: mapWriteError(error) }
  }

  return { position: target }
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
  // FF-1: present only when adding a block INSIDE a container.
  const parentItemId = String(formData.get('parentItemId') ?? '').trim() || null
  if (!sectionId) return { ok: false, error: MESSAGES.missingSection }
  if (!ALL_ITEM_TYPES.includes(itemType)) {
    return { ok: false, error: MESSAGES.itemTypeInvalid }
  }
  // Depth is capped at 1 (ruling 1). The DB CHECK
  // `form_items_no_nested_container` is the authority; refusing here turns a raw
  // 23514 into pt-BR copy and keeps the position shift below from running for a
  // write that could never land.
  if (parentItemId && CONTAINER_TYPES.includes(itemType)) {
    return { ok: false, error: MESSAGES.nestedContainerForbidden }
  }

  const supabase = await createClient()
  const ctx = await contextOfSection(supabase, sectionId)
  if (!ctx) return { ok: false, error: MESSAGES.missingSection }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const parsed = parseItemFields(itemType, formData)
  if ('error' in parsed) return parsed.error
  const { columns, options } = parsed

  // Where the row lands. A TOP-LEVEL block appends after the section's current
  // max position; a CHILD must sit contiguously immediately after its container
  // and that container's existing children (ADR 0087 implementation notes), so
  // everything at or after that slot shifts down by one first.
  const placement = await resolveInsertPosition(supabase, sectionId, parentItemId)
  if ('error' in placement) return { ok: false, error: placement.error }
  const nextPosition = placement.position

  // FF-2: ANSWERABLE, not "input". A matrix carries a `question_key` — the DB
  // CHECK requires one and the aggregation unit is (question_key, row_code,
  // col_code). Gating on `isInput` minted NULL, which the CHECK would have
  // rejected outright. The collision-retry at the bottom of the loop tests the
  // SAME predicate, so the two move together or a colliding key stops being
  // retried.
  const isAnswerable = ANSWERABLE_TYPES.includes(itemType)
  const keyBase = isAnswerable ? slugifyLabel(columns.label ?? '') : null

  // Insert the item; for input items retry on a per-version question_key
  // collision with a fresh suffix. form_version_id is omitted — the sync trigger
  // fills it. The insert returns the new item id so choice options can be
  // attached (form-model-normalization: options are rows, not a column).
  const MAX_ATTEMPTS = 5
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const questionKey = isAnswerable ? `${keyBase}_${shortSuffix()}` : null
    const { data: inserted, error } = await supabase
      .from('form_items')
      .insert({
        section_id: sectionId,
        // The form_items_sync_version trigger derives form_version_id from the
        // section; we pass the resolved value (same id) only to satisfy the typed
        // Insert, which marks the NOT-NULL column required.
        form_version_id: ctx.versionId,
        position: nextPosition,
        item_type: itemType,
        // FF-1: the owning container, or null for a top-level block. The
        // composite FK pins parent + child to the same version and cascades on
        // delete; `is_container` / `parent_is_container` are STORED generated
        // columns and must never be written here.
        parent_item_id: parentItemId,
        question_key: questionKey,
        label: columns.label,
        question_explanation: columns.question_explanation,
        config: columns.config,
        visible_when: columns.visible_when,
        required: columns.required,
        // FF-3 (ADR 0090 ruling 4): required = the flag OR this condition. Both
        // are persisted; `app.item_is_required` composes them, and visibility
        // still wins over the pair.
        required_if: columns.required_if,
        content: columns.content,
        // answer-model-v2: the per-input default value (scalar or option code/
        // code[]); null for display items. Validated at publish time (HC080).
        default_value: columns.default_value,
      })
      .select('id')
      .maybeSingle<{ id: string }>()

    if (!error && inserted) {
      // Attach the choice options as normalized rows. Route through
      // reconcile_item_options (NOT a raw insert) so the reserved "Outros"
      // __other__ row is minted when config.allowOther is set — the item's
      // config was just written above, so reconcile reads the correct flag. A
      // raw insert here skipped that lifecycle, so a freshly-added allowOther
      // item showed NO "Outro" choice until it happened to be edited (which ran
      // reconcile). One option-write path for add + update fixes that.
      if (options && options.length > 0) {
        const res = await reconcileOptionRows(supabase, inserted.id, options)
        if (!res.ok) {
          // Roll back the orphaned item (no option rows) so the builder stays
          // consistent; the item is a draft row, freely deletable.
          await supabase.from('form_items').delete().eq('id', inserted.id)
          return { ok: false, error: MESSAGES.generic }
        }
      }
      revalidateBuilder()
      return { ok: true, error: MESSAGES.itemAdded }
    }
    // Only a question_key collision is retryable; anything else is terminal.
    if (error?.code === PG_UNIQUE_VIOLATION && isAnswerable) continue
    return { ok: false, error: error ? mapWriteError(error) : MESSAGES.generic }
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
    .maybeSingle<{ item_type: string }>()
  if (!existing) return { ok: false, error: MESSAGES.missingItem }

  const parsed = parseItemFields(existing.item_type, formData)
  if ('error' in parsed) return parsed.error
  const { columns, options } = parsed

  const { error } = await supabase
    .from('form_items')
    .update({
      label: columns.label,
      question_explanation: columns.question_explanation,
      config: columns.config,
      visible_when: columns.visible_when,
      required: columns.required,
      required_if: columns.required_if,
      content: columns.content,
      // answer-model-v2: the per-input default value (scalar or option code/
      // code[]); null for display items. Validated at publish time (HC080).
      default_value: columns.default_value,
    })
    .eq('id', itemId)

  if (error) return { ok: false, error: mapWriteError(error) }

  // form-model-normalization: reconcile the choice options into form_item_options
  // rows (kept rows updated by code; new rows generate a code; removed rows
  // deleted) — codes stay stable across the edit.
  if (options) {
    const res = await reconcileOptionRows(supabase, itemId, options)
    if (!res.ok) return { ok: false, error: MESSAGES.generic }
  }

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
 * FF-1 — a top-level BLOCK in a section's flat ordinal space: one top-level item
 * plus, for a container, its ordered children. Reordering must move a container
 * together with its children, never through them.
 */
interface Block {
  ids: string[]
}

/** Fold a section's ordered rows into top-level blocks (a container carries its
 *  children with it). A child whose parent is missing from the section degrades
 *  to its own block rather than disappearing. */
function toBlocks(rows: LayoutRow[]): Block[] {
  const blockIndexByParent = new Map<string, number>()
  const blocks: Block[] = []
  for (const row of rows) {
    const parentIndex =
      row.parent_item_id != null
        ? blockIndexByParent.get(row.parent_item_id)
        : undefined
    if (parentIndex !== undefined) {
      blocks[parentIndex].ids.push(row.id)
      continue
    }
    blockIndexByParent.set(row.id, blocks.length)
    blocks.push({ ids: [row.id] })
  }
  return blocks
}

/**
 * Move an item up or down within its section.
 *
 * TWO CASES since FF-1:
 *   - A plain adjacent swap (`reorder_item`, ADR 0011) — used when NEITHER the
 *     moving item nor its neighbour is part of a container. One atomic RPC, two
 *     audit rows: the behaviour every pre-FF-1 form keeps.
 *   - A BLOCK move — used whenever a container is involved. `reorder_item` swaps
 *     with the nearest neighbour BY POSITION, which for a container is its own
 *     first child: the swap would put a child before its parent and strand the
 *     rest, silently breaking the contiguity `validate_group_layout` checks at
 *     publish. So a container moves together with its children, over whole
 *     blocks. A CHILD moves only among its siblings (the caller disables the
 *     control at either end; this is the server-side backstop) and, being
 *     contiguous with them, an adjacent swap is exactly right.
 *
 * The block rewrite parks every affected row at a high, unoccupied position
 * before writing final slots, so each individual UPDATE targets a vacant slot —
 * collision-free against `form_items_section_id_position_key` without a
 * transaction. Only the two swapped blocks move; the rest of the section is
 * untouched, keeping the audit trail proportionate (Rule 11).
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

  const rows = await sectionLayout(supabase, ctx.sectionId)
  const self = rows.find((r) => r.id === itemId)
  if (!self) return { ok: false, error: MESSAGES.missingItem }

  if (self.parent_item_id != null) {
    // A CHILD: siblings are contiguous, so the adjacent swap is correct — but
    // only among siblings. Refuse to swap across the container boundary.
    const siblings = rows.filter((r) => r.parent_item_id === self.parent_item_id)
    const index = siblings.findIndex((r) => r.id === itemId)
    const atEdge =
      direction === 'up' ? index <= 0 : index >= siblings.length - 1
    if (atEdge) return { ok: true, error: MESSAGES.itemMoved } // no-op, not an error
    return moveByAdjacentSwap(supabase, itemId, direction)
  }

  const blocks = toBlocks(rows)
  const index = blocks.findIndex((b) => b.ids[0] === itemId)
  if (index < 0) return { ok: false, error: MESSAGES.missingItem }
  const neighbourIndex = direction === 'up' ? index - 1 : index + 1
  if (neighbourIndex < 0 || neighbourIndex >= blocks.length) {
    return { ok: true, error: MESSAGES.itemMoved } // already at the edge
  }

  const moving = blocks[index]
  const neighbour = blocks[neighbourIndex]
  // Neither side has children → the cheap, unchanged single-RPC swap.
  if (moving.ids.length === 1 && neighbour.ids.length === 1) {
    return moveByAdjacentSwap(supabase, itemId, direction)
  }

  // Block swap. Only the two blocks move; their combined slots are exactly the
  // contiguous run they already occupy, so the rest of the section is untouched.
  const [first, second] =
    direction === 'up' ? [neighbourIndex, index] : [index, neighbourIndex]
  const affected = [...blocks[first].ids, ...blocks[second].ids]
  const slots = affected
    .map((id) => rows.find((r) => r.id === id)?.position ?? -1)
    .sort((a, b) => a - b)
  const reordered =
    direction === 'up'
      ? [...moving.ids, ...neighbour.ids]
      : [...neighbour.ids, ...moving.ids]

  // Park above every occupied slot in the section, then write the final ones.
  const parkBase = (rows[rows.length - 1]?.position ?? 0) + 1
  for (let i = 0; i < affected.length; i++) {
    const { error } = await supabase
      .from('form_items')
      .update({ position: parkBase + i })
      .eq('id', affected[i])
    if (error) return { ok: false, error: mapWriteError(error) }
  }
  for (let i = 0; i < reordered.length; i++) {
    const { error } = await supabase
      .from('form_items')
      .update({ position: slots[i] })
      .eq('id', reordered[i])
    if (error) return { ok: false, error: mapWriteError(error) }
  }

  revalidateBuilder()
  return { ok: true, error: MESSAGES.itemMoved }
}

/** The pre-FF-1 path: one atomic adjacent swap via the `reorder_item` RPC. */
async function moveByAdjacentSwap(
  supabase: SupabaseClient<Database>,
  itemId: string,
  direction: 'up' | 'down',
): Promise<ActionState> {
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
  let nextPosition = (last?.position ?? -1) + 1

  // FF-1: a CONTAINER travels with its children — moving it alone would strand
  // them in the source section, breaking both the "children live in the same
  // section as their parent" rule and publish-time contiguity. A CHILD moved out
  // of its group becomes an ordinary top-level block in the target section, so
  // its `parent_item_id` is cleared. The UI does not currently offer either move
  // (the affordance is hidden for containers and children), but the action is a
  // public server entry point and must not corrupt the tree if called.
  const sourceRows = await sectionLayout(supabase, itemCtx.sectionId)
  const self = sourceRows.find((r) => r.id === itemId)
  const childIds = sourceRows
    .filter((r) => r.parent_item_id === itemId)
    .map((r) => r.id)

  const { error } = await supabase
    .from('form_items')
    .update({
      section_id: targetSectionId,
      position: nextPosition,
      // Only clear when it actually had a parent, so an ordinary move writes the
      // same columns it always did.
      ...(self?.parent_item_id != null ? { parent_item_id: null } : {}),
    })
    .eq('id', itemId)

  if (error) return { ok: false, error: mapWriteError(error) }

  for (const childId of childIds) {
    nextPosition += 1
    const { error: childError } = await supabase
      .from('form_items')
      .update({ section_id: targetSectionId, position: nextPosition })
      .eq('id', childId)
    if (childError) return { ok: false, error: mapWriteError(childError) }
  }

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
 * Optional controlled-document metadata captured at publish (Phase 17, F7). All
 * OPTIONAL and pure pass-through — omitting them publishes byte-for-byte as before
 * (a form not treated as a controlled document acquires no effective/review date).
 * When present, `publish_form_version` stamps `approved_by`/`effective_date` and
 * computes `review_due_date = effective + reviewCycleMonths` (an explicit
 * `reviewDueDate` override wins). These columns are then immutable (settable only via
 * this RPC).
 */
export interface PublishVersionOptions {
  /** Named approver captured at publish (metadata only — forms have no e-sign). */
  approverId?: string
  /** Effective date (YYYY-MM-DD), stored verbatim; NULL when omitted. */
  effectiveDate?: string
  /** Review cycle in months — drives `review_due_date` (effective-base + cycle). */
  reviewCycleMonths?: number
  /** Explicit review-due-date override (YYYY-MM-DD) — wins over the cycle math. */
  reviewDueDate?: string
}

/**
 * Publish a draft version via publish_form_version (validates conditions,
 * archives the prior published version, flips to published). Maps the RPC's
 * failures to clear pt-BR: forward/missing/first-section condition errors and
 * the "only drafts may be published" lifecycle error. The RPC raises pt-BR text
 * itself, so we surface its message when present and fall back to our copy
 * otherwise.
 *
 * Phase 17 (F7): accepts optional controlled-document metadata ({@link
 * PublishVersionOptions}) forwarded to the widened RPC. Backward-compatible — the
 * existing `publishVersion(versionId)` call sites pass nothing and behave unchanged.
 */
export async function publishVersion(
  versionId: string,
  options?: PublishVersionOptions,
): Promise<ActionState> {
  if (!versionId) return { ok: false, error: MESSAGES.missingVersion }

  const supabase = await createClient()
  const ctx = await contextOfVersion(supabase, versionId)
  if (!ctx) return { ok: false, error: MESSAGES.missingVersion }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('publish_form_version', {
    p_form_version_id: versionId,
    p_approved_by: options?.approverId || undefined,
    p_effective_date: options?.effectiveDate || undefined,
    p_review_cycle_months: options?.reviewCycleMonths ?? undefined,
    p_review_due_date: options?.reviewDueDate || undefined,
  })

  if (error) {
    // validate_visible_when raises check_violation with a descriptive pt-BR
    // message; the lifecycle "not a draft" check too. answer-model-v2's
    // default_value validation raises the application code HC080 (not
    // check_violation) with its own descriptive pt-BR message (BUG-AMV2-001).
    // Prefer the DB message for either — it is always user-facing pt-BR text
    // here — else a safe default.
    switch (error.code) {
      case PG_CHECK_VIOLATION:
      case 'HC080':
        return { ok: false, error: error.message || MESSAGES.publishConditionError }
      // FF-2 (ADR 0089) — BUG-FF2-002. `app.validate_matrix_axes` runs inside
      // publish_form_version, and an axis-less matrix is a NORMAL authoring
      // state: `upsert_matrix_axes` is a separate call, so a matrix block exists
      // with an empty grid from the moment it is added. Falling through to
      // `generic` told the author "Não foi possível concluir. Tente novamente."
      // for a condition that is neither transient nor retryable, and named no
      // block — the only way out was to delete matrices until publish worked.
      //
      // The DB message is preferred because it NAMES the offending item
      // ('a matriz "X" precisa de ao menos uma linha e uma coluna'), which is
      // the entire difference between an actionable error and a dead end; the
      // MESSAGES constants are the fallback. `upsertMatrixAxes` maps these two
      // codes already, so this was an inconsistency WITHIN one file.
      case MATRIX_AXIS_INVALID:
        return { ok: false, error: error.message || MESSAGES.axisInvalid }
      case MATRIX_WEIGHT_REQUIRED:
        return { ok: false, error: error.message || MESSAGES.riskWeightRequired }
      default:
        return { ok: false, error: MESSAGES.generic }
    }
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

  // FF-2 (BUG-FF2-002 sweep): `clone_form_version` now delegates its children to
  // the DEFINER `app.copy_version_children`, which raises 42501 when the caller
  // is not a staff_admin / commission-admin of the form's commission. That is
  // reachable — `authorizeCommission` above short-circuits for a platform_admin,
  // who then legitimately fails the helper's check (the "noun rule": a
  // platform_admin does not edit commission content). The REFUSAL is correct;
  // reporting it as "tente novamente" is not.
  if (error?.code === PG_INSUFFICIENT_PRIVILEGE) {
    return { ok: false, error: MESSAGES.forbidden }
  }
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

// ===========================================================================
// FF-2 (ADR 0089) — matrix axis authoring
// ===========================================================================

/**
 * One axis entry as the BUILDER sends it. Mirrors {@link MatrixAxisEntry}
 * without `id`: the axis is addressed by `code`, never by row id.
 *
 * `code` is MINTED CLIENT-SIDE (use {@link slugifyLabel} + {@link shortSuffix},
 * exactly as option codes are minted) and honoured verbatim by the server. It is
 * IMMUTABLE once the row exists — a BEFORE UPDATE trigger refuses any change, on
 * draft AND published alike (ADR 0089 ruling 4). So the builder must:
 *   - mint a code ONCE, when the entry is first added;
 *   - keep sending that same code while the user renames the label;
 *   - never offer a "change the code" affordance — the fix for a typo is remove
 *     + add, which the REPLACE semantics below handle in one call.
 */
export interface MatrixAxisInput {
  code: string
  label: string
  position: number
  /**
   * REQUIRED on every entry of BOTH axes for a `risk_matrix` (the server rejects
   * a missing one with `HC0P6` → {@link MESSAGES.riskWeightRequired}); ignored
   * for a plain `matrix`. `risk_score = severityRow.weight * likelihoodCol.weight`.
   */
  weight?: number | null
}

/**
 * Persist the full row/column axes of a `matrix` / `risk_matrix` item
 * (`upsert_matrix_axes`).
 *
 * REPLACE semantics keyed on `code`, per axis: an entry whose code exists is
 * updated (label/position/weight), a new code is inserted, and an existing code
 * ABSENT from the payload is DELETED. Send the complete desired axis every time
 * — this is not a patch.
 *
 * Draft-only and staff_admin-only, enforced by the RPC itself (it is a DEFINER
 * door: the four matrix tables are SELECT-only for `authenticated`, so RLS
 * cannot gate these writes and the RPC is the boundary). The `authorizeCommission`
 * call below never REPLACES that check — it turns a server-side denial into
 * readable pt-BR before the round trip.
 */
export async function upsertMatrixAxes(input: {
  itemId: string
  rows: MatrixAxisInput[]
  columns: MatrixAxisInput[]
}): Promise<ActionState> {
  const { itemId, rows, columns } = input
  if (!itemId) return { ok: false, error: MESSAGES.missingItem }

  const supabase = await createClient()
  const ctx = await contextOfItem(supabase, itemId)
  if (!ctx) return { ok: false, error: MESSAGES.missingItem }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('upsert_matrix_axes', {
    p_item_id: itemId,
    p_rows: rows as unknown as Json,
    p_columns: columns as unknown as Json,
  })

  if (error) {
    switch (error.code) {
      case MATRIX_FLAG_OFF:
        return { ok: false, error: MESSAGES.matrixUnavailable }
      case MATRIX_NOT_A_MATRIX:
        return { ok: false, error: MESSAGES.notAMatrix }
      case MATRIX_NOT_DRAFT:
        return { ok: false, error: MESSAGES.notDraft }
      case MATRIX_AXIS_INVALID:
        return { ok: false, error: MESSAGES.axisInvalid }
      case MATRIX_WEIGHT_REQUIRED:
        return { ok: false, error: MESSAGES.riskWeightRequired }
      case PG_INSUFFICIENT_PRIVILEGE:
        return { ok: false, error: MESSAGES.forbidden }
      default:
        return { ok: false, error: mapWriteError(error) }
    }
  }

  revalidateBuilder()
  return { ok: true, error: MESSAGES.matrixAxesSaved }
}

/**
 * FF-3 (ADR 0090) — persist the COMPLETE validation-rule list of one item
 * (`set_item_validations`).
 *
 * REPLACE semantics per item: the payload is the whole desired list, so an
 * omitted rule is DELETED. Unlike matrix axes there is no author-visible key to
 * match on (a rule is not an aggregation key), so the replacement is wholesale.
 *
 * Draft-only and staff_admin-only, enforced by the RPC itself — it is a DEFINER
 * door, because `form_item_validations` is SELECT-only for `authenticated` (K9)
 * and RLS therefore cannot gate the write. The `authorizeCommission` call below
 * never REPLACES that check; it turns a server-side denial into readable pt-BR
 * before the round trip.
 */
export async function setItemValidations(input: {
  itemId: string
  rules: ValidationRuleInput[]
}): Promise<ActionState> {
  const { itemId, rules } = input
  if (!itemId) return { ok: false, error: MESSAGES.missingItem }

  const supabase = await createClient()
  const ctx = await contextOfItem(supabase, itemId)
  if (!ctx) return { ok: false, error: MESSAGES.missingItem }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('set_item_validations', {
    p_item_id: itemId,
    p_rules: rules.map((r) => ({
      rule_type: r.ruleType,
      config: r.config,
      severity: r.severity,
      message: r.message,
      position: r.position,
    })) as unknown as Json,
  })

  if (error) {
    switch (error.code) {
      case VALIDATIONS_FLAG_OFF:
        return { ok: false, error: MESSAGES.validationsUnavailable }
      case VALIDATION_NOT_ALLOWED:
        return { ok: false, error: MESSAGES.validationNotAllowed }
      case VALIDATION_INVALID:
        // Prefer the DB message: it NAMES the offending rule, which is the
        // difference between an actionable error and a dead end (BUG-FF2-002).
        return { ok: false, error: error.message || MESSAGES.validationInvalid }
      case MATRIX_NOT_DRAFT:
        return { ok: false, error: MESSAGES.notDraft }
      case PG_INSUFFICIENT_PRIVILEGE:
        return { ok: false, error: MESSAGES.forbidden }
      default:
        return { ok: false, error: mapWriteError(error) }
    }
  }

  revalidateBuilder()
  return { ok: true, error: MESSAGES.validationsSaved }
}
