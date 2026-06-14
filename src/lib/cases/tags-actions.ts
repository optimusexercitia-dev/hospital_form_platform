'use server'

import { revalidatePath } from 'next/cache'

import { getSessionContext } from '@/lib/queries/session'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { CaseTagColorToken } from '@/lib/queries/case-tags'

/**
 * Case TAG server actions (Cases-Extras batch, R3): manage a commission's tag
 * vocabulary and assign/unassign tags on a case.
 *
 * Architecture Rules 9 & 10. All mutations go through the R3 RPCs (which gate
 * cases_extras + is_staff_admin_of server-side); each action also re-verifies
 * commission-scoped authz for a clean pt-BR forbidden. Strings pt-BR; raw
 * Postgres errors never reach the UI. Assignment is guarded so a tag and case
 * share a commission (HC026).
 */

export interface ActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para esta ação.',
  generic: 'Não foi possível concluir. Tente novamente.',
  missingCase: 'Caso não encontrado.',
  missingCommission: 'Comissão não encontrada.',
  missingTag: 'Etiqueta não encontrada.',
  nameRequired: 'Informe o nome da etiqueta.',
  nameTaken: 'Já existe uma etiqueta com esse nome nesta comissão.',
  commissionMismatch: 'Esta etiqueta não pertence à comissão deste caso.',
  tagCreated: 'Etiqueta criada com sucesso.',
  tagUpdated: 'Etiqueta atualizada com sucesso.',
  tagArchived: 'Etiqueta arquivada.',
  tagAssigned: 'Etiqueta aplicada ao caso.',
  tagUnassigned: 'Etiqueta removida do caso.',
} as const

const PG_CHECK_VIOLATION = '23514'
const PG_UNIQUE_VIOLATION = '23505'
const PG_FORBIDDEN = '42501'
const HC_COMMISSION_MISMATCH = 'HC026'

const CASE_PATH = '/c/[slug]/manage/cases/[caseId]'
const CASES_LIST_PATH = '/c/[slug]/manage/cases'
const TAG_SETTINGS_PATH = '/c/[slug]/manage/settings/tags'
const DASHBOARD_PATH = '/c/[slug]/dashboard'

function revalidateTagVocabulary(): void {
  revalidatePath(TAG_SETTINGS_PATH, 'page')
  revalidatePath(DASHBOARD_PATH, 'page')
  revalidatePath(CASE_PATH, 'page')
}

function revalidateAssignments(): void {
  revalidatePath(CASE_PATH, 'page')
  revalidatePath(CASES_LIST_PATH, 'page')
  revalidatePath(DASHBOARD_PATH, 'page')
}

async function authorizeCommission(commissionId: string): Promise<boolean> {
  const context = await getSessionContext()
  if (!context) return false
  if (context.isAdmin) return true
  return context.memberships.some(
    (m) => m.commission.id === commissionId && m.role === 'staff_admin',
  )
}

async function commissionOfCase(
  supabase: SupabaseClient<Database>,
  caseId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('cases')
    .select('commission_id')
    .eq('id', caseId)
    .maybeSingle()
  return data?.commission_id ?? null
}

async function commissionOfTag(
  supabase: SupabaseClient<Database>,
  tagId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('case_tags')
    .select('commission_id')
    .eq('id', tagId)
    .maybeSingle()
  return data?.commission_id ?? null
}

function mapTagError(error: { code?: string; message?: string } | null): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case HC_COMMISSION_MISMATCH:
      return error.message || MESSAGES.commissionMismatch
    case PG_UNIQUE_VIOLATION:
      return MESSAGES.nameTaken
    case PG_FORBIDDEN:
      return MESSAGES.forbidden
    case PG_CHECK_VIOLATION:
      return error.message || MESSAGES.generic
    default:
      return MESSAGES.generic
  }
}

// ---------------------------------------------------------------------------
// Vocabulary CRUD
// ---------------------------------------------------------------------------

/** Create a tag in a commission's vocabulary. staff_admin-only. */
export async function createCaseTag(
  commissionId: string,
  name: string,
  colorToken: CaseTagColorToken,
): Promise<ActionState> {
  if (!commissionId) return { ok: false, error: MESSAGES.missingCommission }
  if (!name.trim()) {
    return { ok: false, fieldErrors: { name: MESSAGES.nameRequired } }
  }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_case_tag', {
    p_commission_id: commissionId,
    p_name: name.trim(),
    p_color_token: colorToken,
  })

  if (error) return { ok: false, error: mapTagError(error) }

  revalidateTagVocabulary()
  return { ok: true, error: MESSAGES.tagCreated }
}

/** Rename / recolour a tag. staff_admin-only. */
export async function renameCaseTag(
  tagId: string,
  name: string,
  colorToken: CaseTagColorToken,
): Promise<ActionState> {
  if (!tagId) return { ok: false, error: MESSAGES.missingTag }
  if (!name.trim()) {
    return { ok: false, fieldErrors: { name: MESSAGES.nameRequired } }
  }

  const supabase = await createClient()
  const commissionId = await commissionOfTag(supabase, tagId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingTag }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('rename_case_tag', {
    p_tag_id: tagId,
    p_name: name.trim(),
    p_color_token: colorToken,
  })

  if (error) return { ok: false, error: mapTagError(error) }

  revalidateTagVocabulary()
  return { ok: true, error: MESSAGES.tagUpdated }
}

/**
 * Archive (retire) a tag: hidden from the picker but still shown on existing
 * cases that carry it. staff_admin-only.
 */
export async function archiveCaseTag(tagId: string): Promise<ActionState> {
  if (!tagId) return { ok: false, error: MESSAGES.missingTag }

  const supabase = await createClient()
  const commissionId = await commissionOfTag(supabase, tagId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingTag }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('archive_case_tag', { p_tag_id: tagId })

  if (error) return { ok: false, error: mapTagError(error) }

  revalidateTagVocabulary()
  return { ok: true, error: MESSAGES.tagArchived }
}

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

/**
 * Assign a tag to a case (the tag and case must share a commission — HC026).
 * Idempotent on the `(case_id, tag_id)` PK. staff_admin-only.
 */
export async function assignCaseTag(
  caseId: string,
  tagId: string,
): Promise<ActionState> {
  if (!caseId) return { ok: false, error: MESSAGES.missingCase }
  if (!tagId) return { ok: false, error: MESSAGES.missingTag }

  const supabase = await createClient()
  const commissionId = await commissionOfCase(supabase, caseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('assign_case_tag', {
    p_case_id: caseId,
    p_tag_id: tagId,
  })

  if (error) return { ok: false, error: mapTagError(error) }

  revalidateAssignments()
  return { ok: true, error: MESSAGES.tagAssigned }
}

/** Remove a tag assignment from a case. staff_admin-only. */
export async function unassignCaseTag(
  caseId: string,
  tagId: string,
): Promise<ActionState> {
  if (!caseId) return { ok: false, error: MESSAGES.missingCase }
  if (!tagId) return { ok: false, error: MESSAGES.missingTag }

  const supabase = await createClient()
  const commissionId = await commissionOfCase(supabase, caseId)
  if (!commissionId) return { ok: false, error: MESSAGES.missingCase }
  if (!(await authorizeCommission(commissionId))) {
    return { ok: false, error: MESSAGES.forbidden }
  }

  const { error } = await supabase.rpc('unassign_case_tag', {
    p_case_id: caseId,
    p_tag_id: tagId,
  })

  if (error) return { ok: false, error: mapTagError(error) }

  revalidateAssignments()
  return { ok: true, error: MESSAGES.tagUnassigned }
}
