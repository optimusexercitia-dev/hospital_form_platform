import { createClient } from '@/lib/supabase/server'

/**
 * Hospital Departments data-access (Architecture Rule 9 — reads go through
 * `src/lib/`). Departments are a HOSPITAL-SCOPED vocabulary ("Unidade / setor"),
 * managed by the org_admin (any hospital in the org) + hospital_admin (own
 * hospital only), and READ by any member of the hospital (case creators need the
 * dropdown). They are NON-PHI, case-level (the case's `department_id` lives on
 * `public.cases`, never on the PHI `case_patient` table).
 *
 * RLS is the authority (migration `20260713000500_hospital_departments.sql`):
 *   SELECT = is_admin OR org_admin(org-of-hospital) OR hospital_admin(hospital)
 *            OR pqs_operator(hospital) OR hospital_member(hospital).
 *   WRITE  = org_admin(org-of-hospital) OR hospital_admin(hospital).
 *
 * CONTRACT-FIRST STUB: the domain type + signature are FROZEN so `frontend` can
 * build the Departments UI (task #2) + the Novo-caso dropdown against real types.
 * Body filled in immediately after. Keep the SIGNATURE stable once posted.
 */

/** A hospital-scoped department ("Unidade / setor"). NON-PHI. */
export interface Department {
  id: string
  hospitalId: string
  /** Display name (never blank). */
  name: string
  /** Explicit ordering within the hospital (ascending). */
  position: number
  /** Soft-deleted: hidden from the picker but preserved for existing references. */
  archived: boolean
}

/**
 * List a hospital's departments, ordered by `position` then `name`. RLS-scoped
 * (any member of the hospital sees them); a caller with no hospital access gets
 * `[]`. Non-archived only unless `opts.includeArchived` (the management page wants
 * archived rows too). Safe-default `[]` (never throws at render).
 */
export async function listDepartmentsForHospital(
  hospitalId: string,
  opts?: { includeArchived?: boolean },
): Promise<Department[]> {
  if (!hospitalId) return []
  const supabase = await createClient()
  let query = supabase
    .from('hospital_departments')
    .select('id, hospital_id, name, position, archived')
    .eq('hospital_id', hospitalId)
  if (!opts?.includeArchived) {
    query = query.eq('archived', false)
  }
  const { data, error } = await query
    .order('position', { ascending: true })
    .order('name', { ascending: true })
  if (error || !data) return []
  return data.map((r) => ({
    id: r.id,
    hospitalId: r.hospital_id,
    name: r.name,
    position: r.position,
    archived: r.archived,
  }))
}
