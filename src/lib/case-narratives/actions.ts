'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/types/database'

/**
 * Case NARRATIVES server actions (Case Narratives increment; ADR 0032;
 * Architecture Rules 7, 9 & 10).
 *
 * Three groups, each mirroring a settled precedent:
 *   - The per-case BODY save ({@link upsertNarrativeBody}) — mirrors
 *     `updateInterviewSummary`: an (id, value) action called from the inline
 *     editor's transition; routed through `update_case_narrative_body`, which
 *     freezes the body once the parent case is concluído/cancelado (HC054).
 *   - Library CRUD over `case_narrative_types` — mirrors the `case_outcomes`
 *     vocabulary CRUD in `@/lib/cases/outcomes-actions`.
 *   - Template-slot CRUD + the cross-table interleave reorder — mirrors the
 *     phase-slot RPCs; DRAFT-only.
 *
 * RLS is the authority; every mutation routes through a vetted RPC that gates the
 * `case_narratives` flag (`app.assert_narratives_enabled()`) and re-checks
 * `is_staff_admin_of`/admin. Each action ALSO re-verifies commission-scoped authz
 * server-side for a clean pt-BR "forbidden". All user-facing strings are pt-BR;
 * raw Supabase/Postgres errors NEVER reach the UI (CLAUDE.md §8). Direct writes
 * gate the flag via {@link narrativesEnabled}.
 *
 * SQLSTATE → pt-BR: HC054 → "As narrativas deste caso estão bloqueadas."
 */

// ---------------------------------------------------------------------------
// Result shapes (the shared `useActionState`-shaped contract)
// ---------------------------------------------------------------------------

/** The shared `useActionState`-shaped result for every narratives mutation. */
export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/** An add-slot action that returns the new template narrative-slot's id on success. */
export interface AddTemplateNarrativeState extends ActionState {
  narrativeId?: string
}

// ---------------------------------------------------------------------------
// Input shapes (camelCase; the forms bind to these)
// ---------------------------------------------------------------------------

/** A `create`/`update` narrative-TYPE definition input (the settings manager). */
export interface NarrativeTypeInput {
  label: string
  description: string | null
}

/** Fields accepted when adding/editing a template narrative-SLOT (the builder). */
export interface TemplateNarrativeInput {
  /** Optional per-slot label override; `null`/blank falls back to the type label. */
  title: string | null
  /** Optional authoring guidance shown to the coordinator; `null` if blank. */
  instructions: string | null
  /** Advisory close flag (decision 7). */
  isExpected: boolean
}

/** One entry of the cross-table interleave reorder payload, top-to-bottom. */
export interface CaseLayoutOrderItem {
  kind: 'phase' | 'narrative'
  id: string
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  unavailable: 'O recurso de narrativas não está disponível.',
  missingCase: 'Caso não encontrado.',
  missingCommission: 'Comissão não encontrada.',
  missingNarrative: 'Narrativa não encontrada.',
  missingType: 'Tipo de narrativa não encontrado.',
  missingTemplate: 'Processo não encontrado.',
  typeRequired: 'Selecione um tipo de narrativa.',
  labelRequired: 'Informe o nome da narrativa.',
  labelTaken: 'Já existe uma narrativa com esse nome nesta comissão.',
  // HC054 — the case-narrative freeze / template-mismatch / incomplete reorder.
  narrativesLocked: 'As narrativas deste caso estão bloqueadas.',
  orderInvalid: 'Não foi possível salvar a nova ordem. Recarregue e tente novamente.',
  bodySaved: 'Narrativa salva.',
  typeCreated: 'Narrativa criada com sucesso.',
  typeUpdated: 'Narrativa atualizada com sucesso.',
  typeReordered: 'Ordem das narrativas atualizada.',
  typeArchived: 'Narrativa arquivada.',
  slotAdded: 'Narrativa adicionada ao processo.',
  slotUpdated: 'Narrativa do processo atualizada.',
  slotRemoved: 'Narrativa removida do processo.',
  layoutReordered: 'Ordem do processo atualizada.',
} as const

const PG_CHECK_VIOLATION = '23514'
const PG_UNIQUE_VIOLATION = '23505'
const PG_FORBIDDEN = '42501'
// Custom SQLSTATE class HC0xx (Hospital Commission). HC054 is the Case-Narratives
// code: a frozen-case body write, a template/type commission mismatch, or an
// incomplete reorder set. See docs/decisions/0032-case-narratives.md.
const HC_NARRATIVE = 'HC054'

const CASE_PATH = '/c/[slug]/manage/cases/[caseId]'
const CASES_LIST_PATH = '/c/[slug]/manage/cases'
const NARRATIVE_SETTINGS_PATH = '/c/[slug]/manage/settings/narrativas'
const TEMPLATE_PATH = '/c/[slug]/manage/process-templates/[templateId]'

function revalidateNarrativeVocabulary(): void {
  revalidatePath(NARRATIVE_SETTINGS_PATH, 'page')
  revalidatePath(TEMPLATE_PATH, 'page')
  revalidatePath(CASE_PATH, 'page')
}

function revalidateTemplate(): void {
  revalidatePath(TEMPLATE_PATH, 'page')
}

function revalidateCase(): void {
  revalidatePath(CASE_PATH, 'page')
  revalidatePath(CASES_LIST_PATH, 'page')
}

/** Authorize a narratives action: admin, or a staff_admin of THAT commission. */
async function authorizeCommission(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.memberships.some(
    (m) => m.commission.id === commissionId && m.role === 'staff_admin',
  )
}

async function commissionOfNarrative(
  supabase: SupabaseClient<Database>,
  narrativeId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('case_narratives')
    .select('cases(commission_id)')
    .eq('id', narrativeId)
    .maybeSingle<{ cases: { commission_id: string } | null }>()
  return data?.cases?.commission_id ?? null
}

async function commissionOfType(
  supabase: SupabaseClient<Database>,
  narrativeTypeId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('case_narrative_types')
    .select('commission_id')
    .eq('id', narrativeTypeId)
    .maybeSingle()
  return data?.commission_id ?? null
}

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

async function commissionOfTemplateNarrative(
  supabase: SupabaseClient<Database>,
  narrativeSlotId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('process_template_narratives')
    .select('process_templates(commission_id)')
    .eq('id', narrativeSlotId)
    .maybeSingle<{ process_templates: { commission_id: string } | null }>()
  return data?.process_templates?.commission_id ?? null
}

/** Map a narratives RPC error to friendly pt-BR (prefer the RPC's own message). */
function mapNarrativeError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case HC_NARRATIVE:
      return error.message || MESSAGES.narrativesLocked
    case PG_UNIQUE_VIOLATION:
      return MESSAGES.labelTaken
    case PG_FORBIDDEN:
      return MESSAGES.forbidden
    case PG_CHECK_VIOLATION:
      return error.message || MESSAGES.generic
    default:
      return MESSAGES.generic
  }
}

// ---------------------------------------------------------------------------
// Feature-flag gate
// ---------------------------------------------------------------------------

/**
 * Feature-flag gate for the direct narratives writes (mirror of `interviewsEnabled`).
 * Calls the SECURITY DEFINER `public.case_narratives_enabled()` read so the gate is
 * authoritative server-side (the flag lives in the locked-down `app` schema). Fails
 * closed.
 */
export async function narrativesEnabled(): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('case_narratives_enabled')
  if (error) return false
  return data === true
}

// ---------------------------------------------------------------------------
// Per-case body (the inline Markdown editor save)
// ---------------------------------------------------------------------------

/**
 * Persist a narrative's body (`body_md`, sanitized Markdown — Rule 7). Mirrors
 * `updateInterviewSummary`: an (id, value) action bound by the inline editor's
 * transition. Routed through `update_case_narrative_body`, which authorizes
 * (staff_admin/admin → 42501 on deny) and rejects a body write once the parent
 * case is terminal (HC054). No per-case create/remove (narratives are
 * template-fixed in v1). No staff_admin pre-check is strictly required (the RPC is
 * the authority), but we resolve + re-check commission for a clean pt-BR forbidden.
 */
export async function upsertNarrativeBody(
  narrativeId: string,
  bodyMd: string,
): Promise<ActionState> {
  if (!narrativeId) return { ok: false, error: MESSAGES.missingNarrative }
  if (!(await narrativesEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfNarrative(supabase, narrativeId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingNarrative }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('update_case_narrative_body', {
    p_narrative_id: narrativeId,
    p_body_md: bodyMd,
  })

  if (error) return { ok: false, error: mapNarrativeError(error) }

  revalidateCase()
  return { ok: true, error: MESSAGES.bodySaved }
}

// ---------------------------------------------------------------------------
// Library CRUD (staff_admin settings — the `narrativas` manager)
// ---------------------------------------------------------------------------

/**
 * Create a new narrative type in a commission's vocabulary (appended at the end of
 * the order). staff_admin-only; `unique(commission_id, label)` → already-exists.
 * `FormData`-shaped: `commissionId`, `label`, `description?`.
 */
export async function createNarrativeType(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const commissionId = String(formData.get('commissionId') ?? '')
  const label = String(formData.get('label') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (!label) return { ok: false, fieldErrors: { label: MESSAGES.labelRequired } }
  if (!(await narrativesEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_case_narrative_type', {
    p_commission_id: commissionId,
    p_label: label,
    p_description: description || undefined,
  })

  if (error) return { ok: false, error: mapNarrativeError(error) }

  revalidateNarrativeVocabulary()
  return { ok: true, error: MESSAGES.typeCreated }
}

/**
 * Update a narrative-type definition (label / description). Edits propagate to the
 * vocabulary + template slots, but NOT to opened cases (they snapshot `type_label`).
 * staff_admin-only. `FormData`-shaped: `narrativeTypeId`, `label`, `description?`.
 */
export async function updateNarrativeType(
  _prev: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const narrativeTypeId = String(formData.get('narrativeTypeId') ?? '')
  const label = String(formData.get('label') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()

  if (!narrativeTypeId) return { ok: false, error: MESSAGES.missingType }
  if (!label) return { ok: false, fieldErrors: { label: MESSAGES.labelRequired } }
  if (!(await narrativesEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfType(supabase, narrativeTypeId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingType }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('update_case_narrative_type', {
    p_narrative_type_id: narrativeTypeId,
    p_label: label,
    // p_description is a required text param; the RPC nullif-trims it, so passing
    // the (already-trimmed) value — '' when blank — clears the description to NULL.
    p_description: description,
  })

  if (error) return { ok: false, error: mapNarrativeError(error) }

  revalidateNarrativeVocabulary()
  return { ok: true, error: MESSAGES.typeUpdated }
}

/**
 * Reorder narrative types within a commission's vocabulary (drag in the settings
 * manager). `orderedIds` is the full set of NON-archived ids in their new order.
 * staff_admin-only; persisted via the DEFERRABLE position-unique swap.
 */
export async function reorderNarrativeTypes(
  commissionId: string,
  orderedIds: string[],
): Promise<ActionState> {
  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (orderedIds.length === 0) return { ok: true }
  if (!(await narrativesEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reorder_case_narrative_types', {
    p_commission_id: commissionId,
    p_ordered_ids: orderedIds,
  })

  if (error) return { ok: false, error: mapNarrativeError(error) }

  revalidateNarrativeVocabulary()
  return { ok: true, error: MESSAGES.typeReordered }
}

/**
 * Archive (retire) a narrative type: hidden from the slot picker but still renders
 * template slots / cases that reference it (the snapshot keeps `type_label`).
 * Library is archive-only (no delete), matching `case_outcomes`. staff_admin-only.
 */
export async function archiveNarrativeType(
  narrativeTypeId: string,
): Promise<ActionState> {
  if (!narrativeTypeId) return { ok: false, error: MESSAGES.missingType }
  if (!(await narrativesEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfType(supabase, narrativeTypeId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingType }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('archive_case_narrative_type', {
    p_narrative_type_id: narrativeTypeId,
  })

  if (error) return { ok: false, error: mapNarrativeError(error) }

  revalidateNarrativeVocabulary()
  return { ok: true, error: MESSAGES.typeArchived }
}

// ---------------------------------------------------------------------------
// Template-slot CRUD + the cross-table interleave reorder (DRAFT-only)
// ---------------------------------------------------------------------------

/**
 * Append a narrative slot to a DRAFT template, at `max(display_position)+1` taken
 * over the UNION of the template's phase- AND narrative-slots (so it lands at the
 * bottom of the combined list). staff_admin-only. Returns the new `narrativeId`.
 * The same-commission type guard raises HC054 if the type is not in the template's
 * commission.
 */
export async function addTemplateNarrative(
  templateId: string,
  narrativeTypeId: string,
  input: TemplateNarrativeInput,
): Promise<AddTemplateNarrativeState> {
  if (!templateId) return { ok: false, error: MESSAGES.missingTemplate }
  if (!narrativeTypeId) {
    return { ok: false, fieldErrors: { narrativeTypeId: MESSAGES.typeRequired } }
  }
  if (!(await narrativesEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfTemplate(supabase, templateId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingTemplate }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { data, error } = await supabase.rpc('add_template_narrative', {
    p_template_id: templateId,
    p_narrative_type_id: narrativeTypeId,
    p_title: input.title?.trim() || undefined,
    p_instructions: input.instructions?.trim() || undefined,
    p_is_expected: input.isExpected,
  })

  if (error || !data) return { ok: false, error: mapNarrativeError(error) }

  revalidateTemplate()
  return { ok: true, error: MESSAGES.slotAdded, narrativeId: data.id }
}

/**
 * Edit a template narrative-slot in place (`title` / `instructions` / `isExpected`).
 * A blank `title`/`instructions` is sent as the explicit clear flag. DRAFT-only;
 * staff_admin-only.
 */
export async function updateTemplateNarrative(
  narrativeId: string,
  input: TemplateNarrativeInput,
): Promise<ActionState> {
  if (!narrativeId) return { ok: false, error: MESSAGES.missingNarrative }
  if (!(await narrativesEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfTemplateNarrative(supabase, narrativeId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingNarrative }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const title = input.title?.trim() ?? ''
  const instructions = input.instructions?.trim() ?? ''

  const { error } = await supabase.rpc('update_template_narrative', {
    p_narrative_id: narrativeId,
    p_title: title || undefined,
    p_instructions: instructions || undefined,
    p_is_expected: input.isExpected,
    p_clear_title: title.length === 0,
    p_clear_instructions: instructions.length === 0,
  })

  if (error) return { ok: false, error: mapNarrativeError(error) }

  revalidateTemplate()
  return { ok: true, error: MESSAGES.slotUpdated }
}

/**
 * Remove a template narrative-slot, then shift BOTH phases and narratives with a
 * higher `display_position` down by 1 (the interleave stays contiguous). A
 * narrative is never referenced by `recommend_when`/`blocks`, so removal can never
 * dangle a reference. DRAFT-only; staff_admin-only.
 */
export async function removeTemplateNarrative(
  narrativeId: string,
): Promise<ActionState> {
  if (!narrativeId) return { ok: false, error: MESSAGES.missingNarrative }
  if (!(await narrativesEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfTemplateNarrative(supabase, narrativeId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingNarrative }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('remove_template_narrative', {
    p_narrative_id: narrativeId,
  })

  if (error) return { ok: false, error: mapNarrativeError(error) }

  revalidateTemplate()
  return { ok: true, error: MESSAGES.slotRemoved }
}

/**
 * The CROSS-TABLE interleave reorder: renumber `display_position` 1..N across BOTH
 * the template's phase- and narrative-slots from a single top-to-bottom ordered
 * list. `ordered` must be COMPLETE (count = phases + narratives) else HC054. Phase
 * `position` (the immutable phase NUMBER referenced by `blocks`/`recommend_when`)
 * is NEVER touched — only `display_position`. DRAFT-only; staff_admin-only.
 */
export async function reorderCaseLayout(
  templateId: string,
  ordered: CaseLayoutOrderItem[],
): Promise<ActionState> {
  if (!templateId) return { ok: false, error: MESSAGES.missingTemplate }
  if (ordered.length === 0) return { ok: true }
  if (!(await narrativesEnabled())) {
    return { ok: false, error: MESSAGES.unavailable }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfTemplate(supabase, templateId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingTemplate }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('reorder_case_layout_template', {
    p_template_id: templateId,
    // The RPC expects a JSON array of {kind,id}; CaseLayoutOrderItem is structurally
    // valid JSON (flat string fields), but lacks the index signature `Json` wants,
    // so assert through `unknown`.
    p_ordered: ordered as unknown as Json,
  })

  if (error) {
    // An incomplete/invalid set raises HC054 → a clearer "reorder failed" message.
    if (error.code === HC_NARRATIVE) {
      return { ok: false, error: MESSAGES.orderInvalid }
    }
    return { ok: false, error: mapNarrativeError(error) }
  }

  revalidateTemplate()
  return { ok: true, error: MESSAGES.layoutReordered }
}
