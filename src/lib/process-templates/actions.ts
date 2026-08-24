'use server'

import { revalidatePath } from 'next/cache'

import { canConfigureCommissionById, getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import {
  resolveOptionCodes,
  slugifyLabel,
  shortSuffix,
} from '@/lib/forms/option-code'
import type { CustomFieldType } from '@/lib/queries/process-templates'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/types/database'

/**
 * Process-template server actions (Architecture Rules 9 & 10): template
 * lifecycle (create / publish / archive) and phase-slot CRUD + reorder. Each is
 * `useActionState`-shaped (`(prevState, formData) => ActionState`), mirroring
 * `src/lib/forms/actions.ts`. All user-facing strings are pt-BR; raw
 * Supabase/Postgres errors NEVER reach the UI (CLAUDE.md §8).
 *
 * SECURITY: RLS is the authority — every write uses the cookie (RLS-scoped)
 * client, and the `process_templates`/`process_template_phases` staff_admin-write
 * policies (B4) restrict writes to staff_admins of the commission (+ admins).
 * Each action ALSO re-verifies, commission-scoped and server-side, that the
 * caller is admin OR a staff_admin of THAT commission before writing, for a
 * clean pt-BR "forbidden". The B2 RPCs raise the Phase-7 SQLSTATEs
 * (P0016 invalid recommend_when, P0017 form has no published version) which we
 * map to friendly pt-BR (the RPC's own pt-BR message is preferred when present).
 */

export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/** create_process_template returns the new template id for navigation. */
export interface CreateTemplateState extends ActionState {
  templateId?: string
}

/** add_template_phase returns the new phase-slot id. */
export interface AddPhaseState extends ActionState {
  phaseId?: string
}

/** createCustomFieldDef returns the new def id (for the builder to select it). */
export interface CustomFieldDefState extends ActionState {
  fieldId?: string
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  featureOff: 'O recurso de casos multifásicos não está disponível.',
  titleRequired: 'Informe o título do processo.',
  formRequired: 'Selecione um formulário para a fase.',
  defaultDaysInvalid: 'Informe um número inteiro de dias maior ou igual a zero.',
  missingTemplate: 'Processo não encontrado.',
  missingPhase: 'Fase não encontrada.',
  notDraft: 'Apenas processos em rascunho podem ser editados.',
  // P0016 / P0017 — recommend_when / publish validation. The RPC raises pt-BR
  // text; we prefer it and fall back to these.
  recommendInvalid:
    'A condição de recomendação é inválida. Verifique a fase de origem e a pergunta.',
  resultRulesetInvalid:
    'O resultado da fase é inválido. Verifique a pergunta e as opções de resultado.',
  allowedResultsInvalid:
    'Selecione os resultados permitidos para esta fase.',
  noPublishedVersion:
    'O formulário de origem da recomendação ainda não foi publicado.',
  needsPhase: 'Um processo precisa de ao menos uma fase para ser publicado.',
  notArchivable: 'Este processo não pode ser arquivado.',
  slotReferenced:
    'Não é possível remover esta fase: outra fase a usa como condição de recomendação.',
  // HC016 is also raised for an invalid blocker reference (earlier-only / exists).
  blocksInvalid:
    'Um bloqueio referencia uma fase inválida (deve ser uma fase anterior).',
  templateCreated: 'Processo criado com sucesso.',
  templateArchived: 'Processo arquivado.',
  templatePublished: 'Processo publicado com sucesso.',
  phaseAdded: 'Fase adicionada com sucesso.',
  phaseUpdated: 'Fase atualizada com sucesso.',
  phaseRemoved: 'Fase removida com sucesso.',
  phaseMoved: 'Ordem das fases atualizada.',
  blocksUpdated: 'Bloqueios da fase atualizados.',
  // Case custom fields (ADR 0083) — template-authored definitions.
  missingCustomField: 'Campo personalizado não encontrado.',
  customFieldLabelRequired: 'Informe o rótulo do campo.',
  customFieldTypeInvalid: 'Tipo de campo inválido.',
  customFieldOptionsRequired: 'Adicione ao menos uma opção para um campo de seleção.',
  customFieldOptionsNotAllowed: 'Este tipo de campo não aceita opções.',
  customFieldCreated: 'Campo personalizado adicionado.',
  customFieldUpdated: 'Campo personalizado atualizado.',
  customFieldRemoved: 'Campo personalizado removido.',
  customFieldReordered: 'Ordem dos campos atualizada.',
  caseTypeSaved: 'Tipo de caso do processo atualizado.',
  caseTypeCleared: 'Tipo de caso do processo removido.',
  caseTypeWrongOrg: 'Este tipo de caso não pertence à organização desta comissão.',
  // Version lifecycle (ADR 0096 D2).
  missingVersion: 'Versão do processo não encontrada.',
  versionNotDraft: 'Apenas versões em rascunho podem ser alteradas.',
  noVersionToEdit: 'Este processo não tem uma versão que possa ser editada.',
  draftReady: 'Rascunho aberto para edição.',
  versionPublished: 'Versão publicada com sucesso.',
  draftDiscarded: 'Rascunho descartado.',
} as const

const PG_CHECK_VIOLATION = '23514'
const PG_INSUFFICIENT_PRIVILEGE = '42501'
// Custom SQLSTATE class HC0xx (Hospital Commission). Renumbered from P00xx in
// migration 20260613090009 so PostgREST 14 returns 400 + JSON {code,message}
// rather than a 500 that drops the body for non-ASCII messages.
// See docs/decisions/0018-custom-sqlstate-class.md.
const HC_INVALID_RECOMMEND = 'HC016'
const HC_NO_PUBLISHED_VERSION = 'HC017'
const HC_NOT_ARCHIVABLE = 'HC023'
/**
 * `no_data_found`. The version-lifecycle RPCs raise it for an unresolvable
 * version id — which, because every one of them is RLS-gated, is ALSO what a
 * caller who may not see the version gets. Both map to the same pt-BR string on
 * purpose: distinguishing "does not exist" from "not yours" would leak the
 * existence of another commission's template.
 */
const PG_NO_DATA_FOUND = 'P0002'
/** Result ruleset references an invalid/archived result option (phase-results). */
const HC_INVALID_RESULT_OPTION = 'HC059'
/** Declared case type belongs to a different organization (ADR 0064 D4). */
const HC_CASE_TYPE_WRONG_ORG = 'HC0F7'

const TEMPLATES_LIST_PATH = '/o/[org]/c/[commission]/manage/process-templates'
const TEMPLATE_PATH = '/o/[org]/c/[commission]/manage/process-templates/[templateId]'

function revalidateTemplates() {
  revalidatePath(TEMPLATES_LIST_PATH, 'page')
  revalidatePath(TEMPLATE_PATH, 'page')
}

/**
 * Authorize a template action. Process templates are ADR 0100 D12 KEEP
 * configuration (PO ruling Q2), so this routes the `canConfigureCommissionById`
 * seam (membership staff_admin OR tenancy admin) — mirroring the DB, where the
 * whole `process_template_*` policy family still carries the tenancy arm and the
 * template RPCs are INVOKER with no in-body identity probe (RLS is the entire
 * boundary). Pre-QO·B this guard was membership-only, silently converting the
 * ratified KEEP into a CUT at the action layer (the BUG-QOB-003 class).
 * ⚠ `setTemplateCaseType` / `setTemplatePatientMode` carry no pre-check here and no
 * longer need one: `20260917000100` gave both DB doors the tenancy arm, closing the Q2
 * gap the PO approved 2026-08-09. That was NOT a widening — a bare tenancy admin could
 * already write both columns by direct DML (the `process_template_versions` FOR ALL write
 * policy carries the arm, and `authenticated` holds column UPDATE on each), so the doors
 * were refusing what RLS already granted. `create_case_from_template` deliberately keeps
 * the staff_admin-only gate: it creates a CASE, which is content, not a container.
 * The platform-admin arm is pre-existing and out of scope (recorded follow-up).
 */
async function authorizeCommission(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return canConfigureCommissionById(commissionId)
}

/** Resolve a template's commission via the RLS-scoped client (null = unseen). */
async function commissionOfTemplate(
  supabase: SupabaseClient<Database>,
  templateId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('process_templates')
    .select('commission_id')
    .eq('id', templateId)
    .maybeSingle()
  return data?.commission_id ?? null
}

/**
 * Resolve a phase's {commissionId, templateVersionId} via the RLS-scoped client.
 *
 * ADR 0096: a phase hangs off a VERSION, so the commission is two hops away. The
 * previous body selected `template_id` and embedded `process_templates` directly
 * — both removed by the re-key. It did NOT fail typecheck, because
 * `.maybeSingle<T>()` asserts a shape rather than validating the select string
 * against the generated types; it would have failed at runtime only.
 */
async function contextOfPhase(
  supabase: SupabaseClient<Database>,
  phaseId: string,
): Promise<{ commissionId: string; templateVersionId: string } | null> {
  const { data } = await supabase
    .from('process_template_phases')
    .select('template_version_id, process_template_versions(process_templates(commission_id))')
    .eq('id', phaseId)
    .maybeSingle<{
      template_version_id: string
      process_template_versions: {
        process_templates: { commission_id: string } | null
      } | null
    }>()
  const commissionId =
    data?.process_template_versions?.process_templates?.commission_id
  if (!commissionId || !data) return null
  return { commissionId, templateVersionId: data.template_version_id }
}

/** Map an RPC error to friendly pt-BR (prefer the RPC's own pt-BR message). */
function mapRpcError(error: { code?: string; message?: string } | null): string {
  if (!error) return MESSAGES.generic
  if (error.code === HC_NO_PUBLISHED_VERSION) return error.message || MESSAGES.noPublishedVersion
  if (error.code === HC_INVALID_RECOMMEND) return error.message || MESSAGES.recommendInvalid
  if (error.code === HC_NOT_ARCHIVABLE) return error.message || MESSAGES.notArchivable
  if (error.code === HC_INVALID_RESULT_OPTION) return error.message || MESSAGES.resultRulesetInvalid
  if (error.code === HC_CASE_TYPE_WRONG_ORG) return error.message || MESSAGES.caseTypeWrongOrg
  if (error.code === PG_CHECK_VIOLATION) return error.message || MESSAGES.generic
  return MESSAGES.generic
}

/**
 * Map a VERSION-lifecycle RPC error to friendly pt-BR.
 *
 * Separate from {@link mapRpcError} for one reason: `P0002` means different
 * things at the two grains. `archive_process_template` raises it for a missing
 * TEMPLATE; `clone_/publish_/discard_template_version` raise it for a missing
 * VERSION. One shared mapper would have to pick a noun and be wrong half the
 * time.
 *
 * `23514` is deliberately overloaded in the DB — `app.assert_cases_enabled()`
 * and the draft-only guards both raise `check_violation` — so the RPC's own
 * pt-BR message is preferred when PostgREST forwards it, and only the generic
 * draft-only fallback is used when it does not. The fallback is never a raw
 * Postgres string (Rule 10 / CLAUDE.md §8).
 */
function mapVersionError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return MESSAGES.generic
  if (error.code === PG_NO_DATA_FOUND) return MESSAGES.missingVersion
  if (error.code === PG_INSUFFICIENT_PRIVILEGE) return MESSAGES.forbidden
  if (error.code === PG_CHECK_VIOLATION) {
    return error.message || MESSAGES.versionNotDraft
  }
  return mapRpcError(error)
}

/**
 * Declare (or clear) the case TYPE a process template carries — ADR 0064 D4's
 * "the template declares its type; a case snapshots case_type_id".
 *
 * This is the load-bearing half of the fix for the gap ETH·E3a left open: every case
 * created from this template inherits the type, and with it the type's
 * `default_visibility_policy` / `default_confidentiality_level`. Declaring the Ethics
 * type on an ethics process is what makes its cases land `explicit_grants_only`
 * instead of being visible to the whole commission.
 *
 * `null` clears the declaration (back to untyped — today's default behaviour).
 * Existing cases are NOT retro-fitted; they keep the posture snapshotted at creation.
 * The `set_template_case_type` DEFINER is the authority (staff_admin OR tenancy admin of
 * the owning commission since `20260917000100` — Q2 KEEP; draft-only; same-org type); the
 * trigger re-checks org consistency on any write path.
 */
export async function setTemplateCaseType(
  templateVersionId: string,
  caseTypeId: string | null,
): Promise<ActionState> {
  if (!templateVersionId) return { ok: false, error: MESSAGES.missingTemplate }

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_template_case_type', {
    p_template_version_id: templateVersionId,
    p_case_type_id: caseTypeId ?? undefined,
  })

  if (error) return { ok: false, error: mapRpcError(error) }

  revalidateTemplates()
  return {
    ok: true,
    error: caseTypeId ? MESSAGES.caseTypeSaved : MESSAGES.caseTypeCleared,
  }
}

/**
 * Parse the optional `resultRuleset` JSON form field (phase-results). Same shape
 * contract as {@link parseRecommendWhen}: `undefined` when absent/blank (send SQL
 * NULL), the parsed object when valid, or `null` to signal a field error.
 */
function parseResultRuleset(raw: string): Json | undefined | null {
  return parseRecommendWhen(raw)
}

/**
 * Parse the optional `allowedResultIds` JSON form field (phase-result-manual-mode):
 * a non-empty array of result-option id strings — the author-selected allowed
 * subset, present for BOTH modes when emitting. Returns `undefined` when
 * absent/blank (send SQL NULL → not emitting), the parsed array when valid, or
 * `null` to signal a field error (malformed, empty, or non-string entries).
 */
function parseAllowedResultIds(raw: string): Json | undefined | null {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  try {
    const parsed = JSON.parse(trimmed)
    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      !parsed.every((x) => typeof x === 'string' && x.length > 0)
    ) {
      return null
    }
    return parsed as Json
  } catch {
    return null
  }
}

/**
 * Parse an optional `recommendWhen` JSON form field. Returns `undefined` when
 * absent/blank (the action then sends SQL NULL), or the parsed object. A
 * malformed value yields `null` to signal a field error.
 */
function parseRecommendWhen(raw: string): Json | undefined | null {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed) as Json
  } catch {
    return null
  }
}

/**
 * Parse an optional `defaultDays` form field. Returns `undefined` when
 * absent/blank, the parsed non-negative integer when valid, or `null` to signal
 * an invalid value (negative or non-integer).
 */
function parseDefaultDays(raw: string): number | undefined | null {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const n = Number(trimmed)
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

/**
 * Create a draft process template. Fields: `commissionId`, `title`,
 * `description?`. Returns the new `templateId` on success.
 */
export async function createProcessTemplate(
  _prev: CreateTemplateState | undefined,
  formData: FormData,
): Promise<CreateTemplateState> {
  const commissionId = String(formData.get('commissionId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  if (!commissionId) return { ok: false, error: MESSAGES.forbidden }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }
  if (!title) {
    return { ok: false, fieldErrors: { title: MESSAGES.titleRequired } }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_process_template', {
    p_commission_id: commissionId,
    p_title: title,
    p_description: description || undefined,
  })

  if (error || !data) return { ok: false, error: mapRpcError(error) }

  revalidateTemplates()
  return { ok: true, error: MESSAGES.templateCreated, templateId: data.id }
}

/**
 * Archive a template: every non-archived VERSION flips to `archived` (ADR 0096
 * A1.1 item 3 — a template is archived iff all its versions are; the
 * template-level `status` column it used to flip no longer exists). Live cases
 * are unaffected. Exposed to UI under the version-grain name
 * {@link archiveTemplateVersions}.
 */
export async function archiveProcessTemplate(
  templateId: string,
): Promise<ActionState> {
  if (!templateId) return { ok: false, error: MESSAGES.missingTemplate }

  const supabase = await createClient()
  const commissionId = await commissionOfTemplate(supabase, templateId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingTemplate }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('archive_process_template', {
    p_template_id: templateId,
  })

  if (error) return { ok: false, error: mapRpcError(error) }

  revalidateTemplates()
  return { ok: true, error: MESSAGES.templateArchived }
}

/**
 * Publish a template's open draft VERSION (`draft → published`): requires ≥1
 * phase and validates every `recommend_when` (`from_phase < position`; the
 * referenced question_key exists in the source form's published version). Maps
 * HC016/HC017 → pt-BR.
 *
 * A thin identity-grain wrapper (ADR 0096 A1.1 item 1): the RPC resolves the
 * template's draft and delegates to `publish_template_version`. UI publishes
 * through {@link publishTemplateVersion}, which names the version explicitly.
 */
export async function publishProcessTemplate(
  templateId: string,
): Promise<ActionState> {
  if (!templateId) return { ok: false, error: MESSAGES.missingTemplate }

  const supabase = await createClient()
  const commissionId = await commissionOfTemplate(supabase, templateId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingTemplate }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('publish_process_template', {
    p_template_id: templateId,
  })

  if (error) return { ok: false, error: mapRpcError(error) }

  revalidateTemplates()
  return { ok: true, error: MESSAGES.templatePublished }
}

/**
 * Append a phase-slot to a template (at `max(position)+1`). Fields:
 * `templateId`, `formId`, `title?`, `recommendWhen?` (JSON). Returns the new
 * `phaseId`. Validates `recommendWhen` when present (P0016/P0017).
 */
export async function addTemplatePhase(
  _prev: AddPhaseState | undefined,
  formData: FormData,
): Promise<AddPhaseState> {
  // Reads `templateVersionId` from the FormData (was `templateId`).
  const templateVersionId = String(formData.get('templateVersionId') ?? '')
  const formId = String(formData.get('formId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const recommendWhen = parseRecommendWhen(
    String(formData.get('recommendWhen') ?? ''),
  )
  const resultRuleset = parseResultRuleset(
    String(formData.get('resultRuleset') ?? ''),
  )
  const emitsResult = String(formData.get('emitsResult') ?? '') === 'true'
  const allowedResultIds = parseAllowedResultIds(
    String(formData.get('allowedResultIds') ?? ''),
  )
  const defaultDays = parseDefaultDays(String(formData.get('defaultDays') ?? ''))

  if (!templateVersionId) return { ok: false, error: MESSAGES.missingTemplate }
  if (!formId) {
    return { ok: false, fieldErrors: { formId: MESSAGES.formRequired } }
  }
  if (recommendWhen === null) {
    return {
      ok: false,
      fieldErrors: { recommendWhen: MESSAGES.recommendInvalid },
    }
  }
  if (resultRuleset === null) {
    return {
      ok: false,
      fieldErrors: { resultRuleset: MESSAGES.resultRulesetInvalid },
    }
  }
  if (allowedResultIds === null) {
    return {
      ok: false,
      fieldErrors: { resultRuleset: MESSAGES.allowedResultsInvalid },
    }
  }
  if (defaultDays === null) {
    return {
      ok: false,
      fieldErrors: { defaultDays: MESSAGES.defaultDaysInvalid },
    }
  }

  const supabase = await createClient()
  const ctx = await versionContext(supabase, templateVersionId)
  if (!ctx) return { ok: false, error: MESSAGES.missingTemplate }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { data, error } = await supabase.rpc('add_template_phase', {
    p_template_version_id: templateVersionId,
    p_form_id: formId,
    p_title: title || undefined,
    p_recommend_when: recommendWhen,
    p_default_due_days: defaultDays,
    p_result_ruleset: resultRuleset,
    p_emits_result: emitsResult,
    p_allowed_result_ids: allowedResultIds,
  })

  if (error || !data) return { ok: false, error: mapRpcError(error) }

  revalidateTemplates()
  return { ok: true, phaseId: (data as { id: string }).id }
}

/**
 * Update a phase-slot. Fields: `phaseId`, `formId?`, `title?`,
 * `recommendWhen?` (JSON; the explicit `clearRecommendWhen=true` field clears
 * it). Re-validates `recommendWhen`.
 */
export async function updateTemplatePhase(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const phaseId = String(formData.get('phaseId') ?? '')
  const formId = String(formData.get('formId') ?? '').trim()
  const hasTitle = formData.has('title')
  const title = String(formData.get('title') ?? '').trim()
  const clearRecommendWhen =
    String(formData.get('clearRecommendWhen') ?? '') === 'true'
  const recommendWhen = parseRecommendWhen(
    String(formData.get('recommendWhen') ?? ''),
  )
  const clearResultRuleset =
    String(formData.get('clearResultRuleset') ?? '') === 'true'
  const resultRuleset = parseResultRuleset(
    String(formData.get('resultRuleset') ?? ''),
  )
  // emits_result: the dialog always submits it when the result editor is shown
  // (phase-result-manual-mode). Present → explicit boolean; absent → undefined
  // (keep). allowedResultIds mirrors resultRuleset's clear/replace/keep contract.
  const hasEmitsResult = formData.has('emitsResult')
  const emitsResult = hasEmitsResult
    ? String(formData.get('emitsResult') ?? '') === 'true'
    : undefined
  const clearAllowedResultIds =
    String(formData.get('clearAllowedResultIds') ?? '') === 'true'
  const allowedResultIds = parseAllowedResultIds(
    String(formData.get('allowedResultIds') ?? ''),
  )

  if (!phaseId) return { ok: false, error: MESSAGES.missingPhase }
  if (recommendWhen === null) {
    return { ok: false, fieldErrors: { recommendWhen: MESSAGES.recommendInvalid } }
  }
  if (resultRuleset === null) {
    return { ok: false, fieldErrors: { resultRuleset: MESSAGES.resultRulesetInvalid } }
  }
  if (allowedResultIds === null) {
    return { ok: false, fieldErrors: { resultRuleset: MESSAGES.allowedResultsInvalid } }
  }

  // The dialog always includes `defaultDays`. Present-and-empty clears it;
  // present-and-non-empty replaces it (validated non-negative int); absent leaves
  // it untouched. We send the dedicated clear flag rather than a sentinel so the
  // RPC's clear/replace/keep branch mirrors recommend_when exactly.
  const hasDefaultDays = formData.has('defaultDays')
  const defaultDaysRaw = String(formData.get('defaultDays') ?? '').trim()
  let defaultDays: number | undefined
  let clearDefaultDays = false
  if (hasDefaultDays) {
    if (defaultDaysRaw === '') {
      clearDefaultDays = true
    } else {
      const parsed = parseDefaultDays(defaultDaysRaw)
      if (parsed === null) {
        return {
          ok: false,
          fieldErrors: { defaultDays: MESSAGES.defaultDaysInvalid },
        }
      }
      defaultDays = parsed
    }
  }

  const supabase = await createClient()
  const ctx = await contextOfPhase(supabase, phaseId)
  if (!ctx) return { ok: false, error: MESSAGES.missingPhase }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('update_template_phase', {
    p_phase_id: phaseId,
    p_form_id: formId || undefined,
    p_title: hasTitle ? title : undefined,
    p_recommend_when: recommendWhen,
    p_clear_recommend_when: clearRecommendWhen,
    p_default_due_days: defaultDays,
    p_clear_default_due_days: clearDefaultDays,
    p_result_ruleset: resultRuleset,
    p_clear_result_ruleset: clearResultRuleset,
    p_emits_result: emitsResult,
    p_allowed_result_ids: allowedResultIds,
    p_clear_allowed_result_ids: clearAllowedResultIds,
  })

  if (error) return { ok: false, error: mapRpcError(error) }

  revalidateTemplates()
  return { ok: true, error: MESSAGES.phaseUpdated }
}

/**
 * Remove a phase-slot and renumber the tail. Rejected (P0016 → pt-BR) when
 * another slot's `recommend_when.from_phase` references this position.
 */
export async function removeTemplatePhase(
  phaseId: string,
): Promise<ActionState> {
  if (!phaseId) return { ok: false, error: MESSAGES.missingPhase }

  const supabase = await createClient()
  const ctx = await contextOfPhase(supabase, phaseId)
  if (!ctx) return { ok: false, error: MESSAGES.missingPhase }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('remove_template_phase', {
    p_phase_id: phaseId,
  })

  if (error) {
    if (error.code === HC_INVALID_RECOMMEND) {
      return { ok: false, error: error.message || MESSAGES.slotReferenced }
    }
    return { ok: false, error: mapRpcError(error) }
  }

  revalidateTemplates()
  return { ok: true, error: MESSAGES.phaseRemoved }
}

/**
 * Move a phase-slot up/down (adjacent swap). After the swap, every
 * `recommend_when` in the template is re-validated (a move can break
 * `from_phase < position`) → P0016 → pt-BR.
 */
export async function moveTemplatePhase(
  phaseId: string,
  direction: 'up' | 'down',
): Promise<ActionState> {
  if (!phaseId) return { ok: false, error: MESSAGES.missingPhase }

  const supabase = await createClient()
  const ctx = await contextOfPhase(supabase, phaseId)
  if (!ctx) return { ok: false, error: MESSAGES.missingPhase }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('reorder_template_phase', {
    p_phase_id: phaseId,
    p_direction: direction,
  })

  if (error) return { ok: false, error: mapRpcError(error) }

  revalidateTemplates()
  return { ok: true, error: MESSAGES.phaseMoved }
}

/**
 * Set the EARLIER phases that BLOCK a phase-slot (D1/D4 — the "Bloqueios" editor).
 * `blocks` is the full set of 1-based earlier-phase positions (`[]` = no blockers,
 * always activatable). Draft-only; validated earlier-only + exists (HC016 → pt-BR)
 * by `set_template_phase_blocks`. Persisted as a single round-trip so the slot
 * dialog saves blockers independently of the recommend_when / due-date fields.
 */
export async function setTemplatePhaseBlocks(
  phaseId: string,
  blocks: number[],
): Promise<ActionState> {
  if (!phaseId) return { ok: false, error: MESSAGES.missingPhase }

  // Normalise: drop non-positive / non-integer values (the RPC also normalises +
  // deep-validates, but a clean client-side filter avoids a needless round-trip
  // error for obviously-bad input).
  const clean = Array.from(
    new Set(blocks.filter((b) => Number.isInteger(b) && b >= 1)),
  ).sort((a, b) => a - b)

  const supabase = await createClient()
  const ctx = await contextOfPhase(supabase, phaseId)
  if (!ctx) return { ok: false, error: MESSAGES.missingPhase }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('set_template_phase_blocks', {
    p_phase_id: phaseId,
    p_blocks: clean,
  })

  if (error) {
    if (error.code === HC_INVALID_RECOMMEND) {
      return { ok: false, error: error.message || MESSAGES.blocksInvalid }
    }
    return { ok: false, error: mapRpcError(error) }
  }

  revalidateTemplates()
  return { ok: true, error: MESSAGES.blocksUpdated }
}

// ---------------------------------------------------------------------------
// Case custom-field DEFINITION authoring (ADR 0083)
// ---------------------------------------------------------------------------
// These write `process_template_custom_fields` directly via the RLS-scoped
// client (the staff_admin/commission-admin write policy is the authority — there
// is no DEFINER RPC; the values snapshot at case creation is the only RPC path).
// DRAFT-ONLY editing is enforced HERE (ADR 0083 D5): RLS does not check template
// status (nor does the sibling `process_template_outcomes` policy), so the
// frozen-on-publish guarantee lives in these actions — a template that is not
// `draft` is rejected with a pt-BR error before any write.

/** The custom-field type subset (ADR 0083 D3), for a runtime guard on form input. */
const CUSTOM_FIELD_TYPES: readonly CustomFieldType[] = [
  'short_text',
  'number',
  'date',
  'dropdown',
  'multiple_choice',
]

function isCustomFieldType(v: string): v is CustomFieldType {
  return (CUSTOM_FIELD_TYPES as readonly string[]).includes(v)
}

/** A form checkbox/boolean field: `'true'` or `'on'` (unchecked → absent → false). */
function boolFromForm(raw: FormDataEntryValue | null): boolean {
  const v = String(raw ?? '')
  return v === 'true' || v === 'on'
}

/**
 * Parse the optional `options` JSON form field for a single-select custom field:
 * `[{ code?, label }]` (the builder mints codes client-side, like the form
 * OptionsEditor). Returns the parsed rows (`[]` when blank), or `'invalid'` on a
 * malformed payload / an option missing a label. Codes are resolved later.
 */
function parseCustomFieldOptions(
  raw: string,
): { code: string; label: string }[] | 'invalid' {
  const trimmed = raw.trim()
  if (!trimmed) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return 'invalid'
  }
  if (!Array.isArray(parsed)) return 'invalid'
  const out: { code: string; label: string }[] = []
  for (const o of parsed) {
    if (!o || typeof o !== 'object') return 'invalid'
    const rec = o as Record<string, unknown>
    const label = typeof rec.label === 'string' ? rec.label.trim() : ''
    if (!label) return 'invalid'
    const code = typeof rec.code === 'string' ? rec.code.trim() : ''
    out.push({ code, label })
  }
  return out
}

/** Map a direct-DML error on the defs table to friendly pt-BR. */
function mapCustomFieldError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return MESSAGES.generic
  if (error.code === PG_INSUFFICIENT_PRIVILEGE) return MESSAGES.forbidden
  // The options-iff-choice CHECK is pre-validated in the action; if it still
  // fires, surface a clean options message rather than the raw constraint.
  if (error.code === PG_CHECK_VIOLATION) return MESSAGES.customFieldOptionsRequired
  return MESSAGES.generic
}

/**
 * Resolve a template VERSION's {commissionId, status} via the RLS-scoped client.
 * Replaces the identity-grain `templateContext`, which read
 * `process_templates.status` — a column ADR 0096 dropped when status moved onto
 * the version.
 */
async function versionContext(
  supabase: SupabaseClient<Database>,
  templateVersionId: string,
): Promise<{ commissionId: string; status: string } | null> {
  const { data } = await supabase
    .from('process_template_versions')
    .select('status, process_templates(commission_id)')
    .eq('id', templateVersionId)
    .maybeSingle<{
      status: string
      process_templates: { commission_id: string } | null
    }>()
  const commissionId = data?.process_templates?.commission_id
  if (!data || !commissionId) return null
  return { commissionId, status: data.status }
}

/**
 * Resolve a def's {commissionId, templateVersionId, status} via the RLS-scoped
 * client. Same latent break as `contextOfPhase`: the previous body read
 * `template_id` and `process_templates.status`, both removed by ADR 0096.
 */
async function customFieldContext(
  supabase: SupabaseClient<Database>,
  fieldId: string,
): Promise<{
  commissionId: string
  templateVersionId: string
  status: string
} | null> {
  const { data } = await supabase
    .from('process_template_custom_fields')
    .select(
      'template_version_id, process_template_versions(status, process_templates(commission_id))',
    )
    .eq('id', fieldId)
    .maybeSingle<{
      template_version_id: string
      process_template_versions: {
        status: string
        process_templates: { commission_id: string } | null
      } | null
    }>()
  const commissionId =
    data?.process_template_versions?.process_templates?.commission_id
  const status = data?.process_template_versions?.status
  if (!data || !commissionId || !status) return null
  return {
    commissionId,
    templateVersionId: data.template_version_id,
    status,
  }
}

/**
 * Validate a submitted (label, fieldType, options) triple for a custom-field def
 * and resolve the final option rows. Returns the normalized parts, or an
 * `ActionState` with the field error to return verbatim.
 */
function validateCustomFieldInput(
  label: string,
  fieldType: string,
  optionsRaw: string,
):
  | { fieldType: CustomFieldType; options: { code: string; label: string }[] }
  | { error: ActionState } {
  if (!label) {
    return { error: { ok: false, fieldErrors: { label: MESSAGES.customFieldLabelRequired } } }
  }
  if (!isCustomFieldType(fieldType)) {
    return { error: { ok: false, fieldErrors: { fieldType: MESSAGES.customFieldTypeInvalid } } }
  }
  const isChoice = fieldType === 'dropdown' || fieldType === 'multiple_choice'
  const parsed = parseCustomFieldOptions(optionsRaw)
  if (parsed === 'invalid') {
    return { error: { ok: false, fieldErrors: { options: MESSAGES.customFieldOptionsRequired } } }
  }
  if (isChoice && parsed.length === 0) {
    return { error: { ok: false, fieldErrors: { options: MESSAGES.customFieldOptionsRequired } } }
  }
  if (!isChoice && parsed.length > 0) {
    return { error: { ok: false, fieldErrors: { options: MESSAGES.customFieldOptionsNotAllowed } } }
  }
  // Resolve stable codes (keep a submitted code, mint one from the label otherwise;
  // de-collide within the set) — the same authority the form OptionsEditor uses.
  const options = isChoice
    ? resolveOptionCodes([], parsed).map((code, i) => ({ code, label: parsed[i].label }))
    : []
  return { fieldType, options }
}

/**
 * Create a custom-field DEFINITION on a DRAFT template (ADR 0083). Fields:
 * `templateId`, `label`, `fieldType` (the D3 subset), `options` (JSON
 * `[{ code?, label }]` — required for the single-select types, forbidden
 * otherwise), `required` (`'true'`/`'on'`), `showInList` (`'true'`/`'on'`). The
 * `key` is generated server-side (`slugifyLabel` + `shortSuffix`), retried on the
 * `(template_id, key)` unique collision. Appended at `max(position)+1`. Returns
 * the new `fieldId`.
 */
export async function createCustomFieldDef(
  _prev: CustomFieldDefState | undefined,
  formData: FormData,
): Promise<CustomFieldDefState> {
  // Reads `templateVersionId` from the FormData (was `templateId`).
  const templateVersionId = String(formData.get('templateVersionId') ?? '')
  const label = String(formData.get('label') ?? '').trim()
  const fieldTypeRaw = String(formData.get('fieldType') ?? '').trim()
  const required = boolFromForm(formData.get('required'))
  const showInList = boolFromForm(formData.get('showInList'))
  const optionsRaw = String(formData.get('options') ?? '')

  if (!templateVersionId) return { ok: false, error: MESSAGES.missingTemplate }

  const validated = validateCustomFieldInput(label, fieldTypeRaw, optionsRaw)
  if ('error' in validated) return validated.error
  const { fieldType, options } = validated

  const supabase = await createClient()
  const ctx = await versionContext(supabase, templateVersionId)
  if (!ctx) return { ok: false, error: MESSAGES.missingTemplate }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }
  if (ctx.status !== 'draft') return { ok: false, error: MESSAGES.notDraft }

  // Append at the end.
  const { data: maxRow } = await supabase
    .from('process_template_custom_fields')
    .select('position')
    .eq('template_version_id', templateVersionId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle<{ position: number }>()
  const nextPosition = (maxRow?.position ?? -1) + 1

  // Retry on the (template_version_id, key) unique collision.
  let lastError: { code?: string; message?: string } | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    const key = `${slugifyLabel(label)}_${shortSuffix()}`
    const { data, error } = await supabase
      .from('process_template_custom_fields')
      .insert({
        template_version_id: templateVersionId,
        key,
        label,
        field_type: fieldType,
        options: options as unknown as Json,
        required,
        show_in_list: showInList,
        position: nextPosition,
      })
      .select('id')
      .single<{ id: string }>()

    if (!error && data) {
      revalidateTemplates()
      return { ok: true, error: MESSAGES.customFieldCreated, fieldId: data.id }
    }
    lastError = error
    if (error?.code !== '23505') break
  }
  return { ok: false, error: mapCustomFieldError(lastError) }
}

/**
 * Update a custom-field DEFINITION on a DRAFT template (ADR 0083). Fields:
 * `fieldId`, `label`, `fieldType`, `options` (JSON), `required`, `showInList`. The
 * `key` is STABLE (never changed). Changing `fieldType` away from a single-select
 * clears its options; changing it to one requires options (validated → pt-BR).
 */
export async function updateCustomFieldDef(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const fieldId = String(formData.get('fieldId') ?? '')
  const label = String(formData.get('label') ?? '').trim()
  const fieldTypeRaw = String(formData.get('fieldType') ?? '').trim()
  const required = boolFromForm(formData.get('required'))
  const showInList = boolFromForm(formData.get('showInList'))
  const optionsRaw = String(formData.get('options') ?? '')

  if (!fieldId) return { ok: false, error: MESSAGES.missingCustomField }

  const validated = validateCustomFieldInput(label, fieldTypeRaw, optionsRaw)
  if ('error' in validated) return validated.error
  const { fieldType, options } = validated

  const supabase = await createClient()
  const ctx = await customFieldContext(supabase, fieldId)
  if (!ctx) return { ok: false, error: MESSAGES.missingCustomField }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }
  if (ctx.status !== 'draft') return { ok: false, error: MESSAGES.notDraft }

  const { error } = await supabase
    .from('process_template_custom_fields')
    .update({
      label,
      field_type: fieldType,
      options: options as unknown as Json,
      required,
      show_in_list: showInList,
    })
    .eq('id', fieldId)

  if (error) return { ok: false, error: mapCustomFieldError(error) }

  revalidateTemplates()
  return { ok: true, error: MESSAGES.customFieldUpdated }
}

/**
 * Delete a custom-field DEFINITION from a DRAFT template (ADR 0083). Any per-case
 * snapshot keeps its frozen copy (the value row's `template_field_id` FK is
 * `ON DELETE SET NULL` — provenance only). Draft-only.
 */
export async function deleteCustomFieldDef(fieldId: string): Promise<ActionState> {
  if (!fieldId) return { ok: false, error: MESSAGES.missingCustomField }

  const supabase = await createClient()
  const ctx = await customFieldContext(supabase, fieldId)
  if (!ctx) return { ok: false, error: MESSAGES.missingCustomField }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }
  if (ctx.status !== 'draft') return { ok: false, error: MESSAGES.notDraft }

  const { error } = await supabase
    .from('process_template_custom_fields')
    .delete()
    .eq('id', fieldId)

  if (error) return { ok: false, error: mapCustomFieldError(error) }

  revalidateTemplates()
  return { ok: true, error: MESSAGES.customFieldRemoved }
}

/**
 * Reorder a template's custom-field defs (ADR 0083 — the builder's drag order).
 * `orderedIds` is the full set in the desired order; each row's `position` is set
 * to its index. Scoped to `templateId` so a stray id cannot touch another
 * template. Draft-only. Mirrors {@link reorderCaseOutcomes}'s shape.
 */
export async function reorderCustomFieldDefs(
  templateVersionId: string,
  orderedIds: string[],
): Promise<ActionState> {
  if (!templateVersionId) return { ok: false, error: MESSAGES.missingTemplate }
  if (orderedIds.length === 0) return { ok: true }

  const supabase = await createClient()
  const ctx = await versionContext(supabase, templateVersionId)
  if (!ctx) return { ok: false, error: MESSAGES.missingTemplate }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }
  if (ctx.status !== 'draft') return { ok: false, error: MESSAGES.notDraft }

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('process_template_custom_fields')
      .update({ position: i })
      .eq('id', orderedIds[i])
      .eq('template_version_id', templateVersionId)
    if (error) return { ok: false, error: mapCustomFieldError(error) }
  }

  revalidateTemplates()
  return { ok: true, error: MESSAGES.customFieldReordered }
}


// ---------------------------------------------------------------------------
// ADR 0096 — Process-template VERSIONING
//
// WIRED, 2026-08-05. These landed as contract-first stubs so `frontend` could
// build against the signatures; they threw `not implemented` for one pass while
// the substrate migrations landed. The whole UI set — publish / edit / discard /
// archive — called them, so D2's workflow was inert while lint, `tsc`, `next
// build` and 945 unit tests were all green. A stub is invisible to every static
// gate in this repo; the only thing that catches it is exercising the seam.
//
// Every one is RLS-authorized in the DB — the `authorizeCommission` re-check
// these perform, like the actions above, is a pt-BR ERROR-MESSAGE affordance,
// never the security boundary (Architecture Rule 1).
// ---------------------------------------------------------------------------


/** `clone_template_version` / `beginTemplateEdit` return the draft to navigate to. */
export interface TemplateVersionState extends ActionState {
  templateVersionId?: string
}

/**
 * Clone a template version into a NEW DRAFT (ADR 0096 D2; mirrors
 * `clone_form_version` exactly, including its idempotency contract).
 *
 * IDEMPOTENT: when the template already has an open draft this returns THAT
 * draft's id and clones nothing, so a double-submit or a retried action cannot
 * produce two drafts. That is the same guarantee the DB enforces independently —
 * at most one draft per template — so the UI never has to serialize the call.
 *
 * Copies the version's authored fields (title, description, patientMode +
 * patientRequiredFields,
 * caseTypeId) and ALL children: phases (with blocks, recommendWhen, resultRuleset,
 * emitsResult and the allowed-results junction), narrative slots, offered outcomes
 * and custom-field definitions.
 */
export async function cloneTemplateVersion(
  templateVersionId: string,
): Promise<TemplateVersionState> {
  if (!templateVersionId) return { ok: false, error: MESSAGES.missingVersion }

  const supabase = await createClient()
  const ctx = await versionContext(supabase, templateVersionId)
  if (!ctx) return { ok: false, error: MESSAGES.missingVersion }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { data, error } = await supabase.rpc('clone_template_version', {
    p_source_version_id: templateVersionId,
  })

  if (error || !data) return { ok: false, error: mapVersionError(error) }

  revalidateTemplates()
  return { ok: true, error: MESSAGES.draftReady, templateVersionId: data }
}

/**
 * The BUILDER's "Editar" entry point: resolve the template's open draft, cloning
 * its published version when there is none, and return the draft to navigate to.
 *
 * Prefer this over {@link cloneTemplateVersion} in UI: it takes a template id
 * (what a screen has) rather than a version id, and it is the action that makes
 * D2's workflow cost visible — after editing, the author MUST re-publish for the
 * change to reach new cases. Cases already running are unaffected either way.
 */
export async function beginTemplateEdit(
  templateId: string,
): Promise<TemplateVersionState> {
  if (!templateId) return { ok: false, error: MESSAGES.missingTemplate }

  const supabase = await createClient()
  const commissionId = await commissionOfTemplate(supabase, templateId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingTemplate }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  // Resolve the version to hand to the clone door: the open draft if there is
  // one, else the published version. Both rows come back in ONE RLS-scoped read
  // (`status in (draft, published)` can return at most two rows — the two
  // partial unique indexes on `process_template_versions` guarantee it).
  const { data: versions, error: readError } = await supabase
    .from('process_template_versions')
    .select('id, status')
    .eq('template_id', templateId)
    .in('status', ['draft', 'published'])

  if (readError) return { ok: false, error: MESSAGES.generic }

  const source =
    versions?.find((v) => v.status === 'draft') ??
    versions?.find((v) => v.status === 'published')
  if (!source) return { ok: false, error: MESSAGES.noVersionToEdit }

  // IDEMPOTENCY IS THE RPC'S, NOT OURS. We hand it the draft when one exists
  // rather than short-circuiting, so the single authority on "does this fork?"
  // stays in the DB: `clone_template_version` looks up the template's open
  // draft and returns it unchanged when the source IS that draft. Routing the
  // resume path around the RPC would also skip `app.assert_cases_enabled()` and
  // the RLS check, and would put a second, drifting copy of the at-most-one-
  // draft rule in TypeScript.
  const { data, error } = await supabase.rpc('clone_template_version', {
    p_source_version_id: source.id,
  })

  if (error || !data) return { ok: false, error: mapVersionError(error) }

  revalidateTemplates()
  return { ok: true, error: MESSAGES.draftReady, templateVersionId: data }
}

/**
 * Publish a DRAFT version (ADR 0096 D2; mirrors `publish_form_version`).
 *
 * Refuses a non-draft. Runs the publish-time validations the template lifecycle
 * already had — at least one phase, every `recommendWhen` resolvable against an
 * EARLIER phase whose form has a published version, and every emitting phase's
 * allowed-result subset present and referencing live, non-archived results — then
 * ARCHIVES the incumbent published version and publishes this one ATOMICALLY, so
 * a template is never momentarily unpublished and `create_case_from_template`
 * never observes zero or two published versions.
 */
export async function publishTemplateVersion(
  templateVersionId: string,
): Promise<ActionState> {
  if (!templateVersionId) return { ok: false, error: MESSAGES.missingVersion }

  const supabase = await createClient()
  const ctx = await versionContext(supabase, templateVersionId)
  if (!ctx) return { ok: false, error: MESSAGES.missingVersion }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  // No draft-only pre-check here: `publish_template_version` re-reads the status
  // `for update` and refuses a non-draft. A TypeScript pre-check would be a
  // second copy of that rule that cannot see the lock, and would go stale.
  const { error } = await supabase.rpc('publish_template_version', {
    p_template_version_id: templateVersionId,
  })

  if (error) return { ok: false, error: mapVersionError(error) }

  revalidateTemplates()
  return { ok: true, error: MESSAGES.versionPublished }
}

/**
 * Discard an open DRAFT version, deleting it and its children.
 *
 * Only ever legal for a `draft`: published and archived versions are immutable and
 * undeletable, the latter additionally protected by `cases.template_version_id`
 * `ON DELETE RESTRICT` — a version a case ran under cannot be erased, which is
 * precisely the `ON DELETE SET NULL` provenance gap this ADR closes. Never
 * unpublishes anything: discarding a draft leaves the published version in force.
 */
export async function discardTemplateDraft(
  templateVersionId: string,
): Promise<ActionState> {
  if (!templateVersionId) return { ok: false, error: MESSAGES.missingVersion }

  const supabase = await createClient()
  const ctx = await versionContext(supabase, templateVersionId)
  if (!ctx) return { ok: false, error: MESSAGES.missingVersion }
  if (!(await authorizeCommission(ctx.commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('discard_template_draft', {
    p_template_version_id: templateVersionId,
  })

  if (error) return { ok: false, error: mapVersionError(error) }

  revalidateTemplates()
  return { ok: true, error: MESSAGES.draftDiscarded }
}

/**
 * Archive the whole template: archives every non-archived version, so the
 * template stops offering case creation. Distinct from
 * {@link discardTemplateDraft}, which touches only the open draft.
 *
 * This is the VERSION-grain name for what {@link archiveProcessTemplate} does —
 * `archive_process_template` became a multi-version operation under ADR 0096
 * A1.1 item 3 (a template is archived iff ALL its versions are). It delegates
 * rather than repeating the call so the two names cannot drift apart; the
 * identity-grain name is kept because the RPC still takes a template id.
 */
export async function archiveTemplateVersions(
  templateId: string,
): Promise<ActionState> {
  return archiveProcessTemplate(templateId)
}
