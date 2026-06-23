'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
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
} as const

const PG_CHECK_VIOLATION = '23514'
// Custom SQLSTATE class HC0xx (Hospital Commission). Renumbered from P00xx in
// migration 20260613090009 so PostgREST 14 returns 400 + JSON {code,message}
// rather than a 500 that drops the body for non-ASCII messages.
// See docs/decisions/0018-custom-sqlstate-class.md.
const HC_INVALID_RECOMMEND = 'HC016'
const HC_NO_PUBLISHED_VERSION = 'HC017'
const HC_NOT_ARCHIVABLE = 'HC023'
/** Result ruleset references an invalid/archived result option (phase-results). */
const HC_INVALID_RESULT_OPTION = 'HC059'

const TEMPLATES_LIST_PATH = '/c/[slug]/manage/process-templates'
const TEMPLATE_PATH = '/c/[slug]/manage/process-templates/[templateId]'

function revalidateTemplates() {
  revalidatePath(TEMPLATES_LIST_PATH, 'page')
  revalidatePath(TEMPLATE_PATH, 'page')
}

/** admin, or a staff_admin of THAT commission. */
async function authorizeCommission(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.memberships.some(
    (m) => m.commission.id === commissionId && m.role === 'staff_admin',
  )
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

/** Resolve a phase's {commissionId, templateId} via the RLS-scoped client. */
async function contextOfPhase(
  supabase: SupabaseClient<Database>,
  phaseId: string,
): Promise<{ commissionId: string; templateId: string } | null> {
  const { data } = await supabase
    .from('process_template_phases')
    .select('template_id, process_templates(commission_id)')
    .eq('id', phaseId)
    .maybeSingle<{
      template_id: string
      process_templates: { commission_id: string } | null
    }>()
  const commissionId = data?.process_templates?.commission_id
  if (!commissionId || !data) return null
  return { commissionId, templateId: data.template_id }
}

/** Map an RPC error to friendly pt-BR (prefer the RPC's own pt-BR message). */
function mapRpcError(error: { code?: string; message?: string } | null): string {
  if (!error) return MESSAGES.generic
  if (error.code === HC_NO_PUBLISHED_VERSION) return error.message || MESSAGES.noPublishedVersion
  if (error.code === HC_INVALID_RECOMMEND) return error.message || MESSAGES.recommendInvalid
  if (error.code === HC_NOT_ARCHIVABLE) return error.message || MESSAGES.notArchivable
  if (error.code === HC_INVALID_RESULT_OPTION) return error.message || MESSAGES.resultRulesetInvalid
  if (error.code === PG_CHECK_VIOLATION) return error.message || MESSAGES.generic
  return MESSAGES.generic
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

/** Archive a template (`draft`/`active` → `archived`). Live cases unaffected. */
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
 * Publish a draft template (`draft → active`): requires ≥1 phase and validates
 * every `recommend_when` (`from_phase < position`; the referenced question_key
 * exists in the source form's published version). Maps P0016/P0017 → pt-BR.
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
  const templateId = String(formData.get('templateId') ?? '')
  const formId = String(formData.get('formId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const recommendWhen = parseRecommendWhen(
    String(formData.get('recommendWhen') ?? ''),
  )
  const resultRuleset = parseResultRuleset(
    String(formData.get('resultRuleset') ?? ''),
  )
  const defaultDays = parseDefaultDays(String(formData.get('defaultDays') ?? ''))

  if (!templateId) return { ok: false, error: MESSAGES.missingTemplate }
  if (!formId) {
    return { ok: false, fieldErrors: { formId: MESSAGES.formRequired } }
  }
  if (recommendWhen === null) {
    return { ok: false, fieldErrors: { recommendWhen: MESSAGES.recommendInvalid } }
  }
  if (resultRuleset === null) {
    return { ok: false, fieldErrors: { resultRuleset: MESSAGES.resultRulesetInvalid } }
  }
  if (defaultDays === null) {
    return { ok: false, fieldErrors: { defaultDays: MESSAGES.defaultDaysInvalid } }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfTemplate(supabase, templateId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingTemplate }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { data, error } = await supabase.rpc('add_template_phase', {
    p_template_id: templateId,
    p_form_id: formId,
    p_title: title || undefined,
    p_recommend_when: recommendWhen,
    p_default_due_days: defaultDays,
    p_result_ruleset: resultRuleset,
  })

  if (error || !data) return { ok: false, error: mapRpcError(error) }

  revalidateTemplates()
  return { ok: true, error: MESSAGES.phaseAdded, phaseId: data.id }
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

  if (!phaseId) return { ok: false, error: MESSAGES.missingPhase }
  if (recommendWhen === null) {
    return { ok: false, fieldErrors: { recommendWhen: MESSAGES.recommendInvalid } }
  }
  if (resultRuleset === null) {
    return { ok: false, fieldErrors: { resultRuleset: MESSAGES.resultRulesetInvalid } }
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
