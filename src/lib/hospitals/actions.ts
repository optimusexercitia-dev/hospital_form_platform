'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

/**
 * Hospital Departments CRUD server actions (Architecture Rules 9 & 10). Departments
 * are a HOSPITAL-SCOPED, NON-PHI vocabulary ("Unidade / setor") managed nested under
 * each hospital. WRITE authority is RLS (migration
 * `20260713000500_hospital_departments.sql`): org_admin(org-of-hospital) OR
 * hospital_admin(hospital). A caller outside that set hits the RLS boundary (0 rows
 * affected / 42501) → the shared pt-BR `forbidden`.
 *
 * create / rename / archive write DIRECTLY against the RLS-gated table via the cookie
 * (RLS-scoped) client — the WRITE policy is the authority, so no in-body role check is
 * duplicated. reorder routes through the `reorder_departments(hospital_id,
 * ordered_ids[])` DEFINER RPC for ATOMICITY (a single transactional position rewrite
 * instead of N racy PostgREST updates).
 *
 * All user-facing strings are pt-BR; raw Supabase/Postgres errors NEVER reach the UI.
 */

/** `useActionState`-shaped result; `departmentId` echoed on a successful create. */
export interface DepartmentActionState {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
  departmentId?: string
}

const MESSAGES = {
  forbidden: 'Você não tem permissão para gerenciar os setores deste hospital.',
  generic: 'Não foi possível concluir. Tente novamente.',
  nameRequired: 'Informe o nome do setor.',
  duplicateName: 'Já existe um setor com esse nome neste hospital.',
  missingHospital: 'Hospital não encontrado.',
  missingDepartment: 'Setor não encontrado.',
  created: 'Setor criado.',
  renamed: 'Setor atualizado.',
  reordered: 'Ordem dos setores atualizada.',
  archived: 'Setor arquivado.',
  unarchived: 'Setor reativado.',
} as const

const PG_UNIQUE_VIOLATION = '23505'
const PG_RLS_DENIED = '42501'
const PG_CHECK_VIOLATION = '23514'

/** Revalidate the hospital detail page (where departments are managed). The
 * management surface lives under the org/hospital area; 'layout' covers the nested
 * department views. */
function revalidateHospital(): void {
  revalidatePath('/o/[org]/hospitals/[hospitalId]', 'layout')
}

/** Map a departments write error to friendly pt-BR (never leak raw Postgres). */
function mapDepartmentError(
  error: { code?: string; message?: string } | null,
): string {
  if (!error) return MESSAGES.generic
  switch (error.code) {
    case PG_UNIQUE_VIOLATION:
      return MESSAGES.duplicateName
    case PG_RLS_DENIED:
      return MESSAGES.forbidden
    case PG_CHECK_VIOLATION:
      return error.message || MESSAGES.generic
    default:
      return MESSAGES.generic
  }
}

/**
 * Create a department in `hospitalId`. RLS gates the INSERT to org_admin /
 * hospital_admin (else the row is rejected). `name` is trimmed + required; a
 * duplicate (non-archived) name surfaces a clear pt-BR error. `position` defaults to
 * the end of the current list. Returns the new `departmentId`.
 */
export async function createDepartment(
  hospitalId: string,
  name: string,
): Promise<DepartmentActionState> {
  if (!hospitalId) return { ok: false, error: MESSAGES.missingHospital }
  const trimmed = name.trim()
  if (!trimmed) {
    return { ok: false, fieldErrors: { name: MESSAGES.nameRequired } }
  }

  const supabase = await createClient()

  // Append to the end: read the current max position (RLS-scoped) and +1. A concurrent
  // create could collide on position, but position is not unique — ordering ties break
  // on name, and a later reorder normalizes. Minimum-necessary, no lock needed.
  const { data: last } = await supabase
    .from('hospital_departments')
    .select('position')
    .eq('hospital_id', hospitalId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPosition = (last?.position ?? -1) + 1

  const { data, error } = await supabase
    .from('hospital_departments')
    .insert({ hospital_id: hospitalId, name: trimmed, position: nextPosition })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: mapDepartmentError(error) }

  revalidateHospital()
  return { ok: true, error: MESSAGES.created, departmentId: data.id }
}

/**
 * Rename a department. RLS gates the UPDATE to org_admin / hospital_admin of the
 * department's hospital. Trimmed + required; duplicate names surface pt-BR.
 */
export async function renameDepartment(
  departmentId: string,
  name: string,
): Promise<DepartmentActionState> {
  if (!departmentId) return { ok: false, error: MESSAGES.missingDepartment }
  const trimmed = name.trim()
  if (!trimmed) {
    return { ok: false, fieldErrors: { name: MESSAGES.nameRequired } }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('hospital_departments')
    .update({ name: trimmed })
    .eq('id', departmentId)
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, error: mapDepartmentError(error) }
  // 0 rows updated = RLS denied (out of the caller's hospital scope).
  if (!data) return { ok: false, error: MESSAGES.forbidden }

  revalidateHospital()
  return { ok: true, error: MESSAGES.renamed }
}

/**
 * Reorder a hospital's departments: `orderedIds` is the FULL desired order; the RPC
 * rewrites `position` = array index atomically (a single transaction, gated to
 * org_admin / hospital_admin of the hospital). Ids not belonging to the hospital are
 * ignored by the RPC.
 */
export async function reorderDepartments(
  hospitalId: string,
  orderedIds: string[],
): Promise<DepartmentActionState> {
  if (!hospitalId) return { ok: false, error: MESSAGES.missingHospital }

  const supabase = await createClient()
  const { error } = await supabase.rpc('reorder_departments', {
    p_hospital_id: hospitalId,
    p_ordered_ids: orderedIds,
  })

  if (error) return { ok: false, error: mapDepartmentError(error) }

  revalidateHospital()
  return { ok: true, error: MESSAGES.reordered }
}

/**
 * Archive or reactivate a department (soft delete). RLS gates the UPDATE to
 * org_admin / hospital_admin. Archived departments drop out of the Novo-caso picker
 * but existing case references are preserved. Idempotent.
 */
export async function archiveDepartment(
  departmentId: string,
  archived: boolean,
): Promise<DepartmentActionState> {
  if (!departmentId) return { ok: false, error: MESSAGES.missingDepartment }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('hospital_departments')
    .update({ archived })
    .eq('id', departmentId)
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, error: mapDepartmentError(error) }
  if (!data) return { ok: false, error: MESSAGES.forbidden }

  revalidateHospital()
  return {
    ok: true,
    error: archived ? MESSAGES.archived : MESSAGES.unarchived,
  }
}
