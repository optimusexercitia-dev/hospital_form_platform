import 'server-only'

import { createClient } from '@/lib/supabase/server'

/**
 * Hospital affiliations — the typed read layer over `public.hospital_affiliations`
 * (ADR 0097 D1; Architecture Rule 9 — no inline supabase-js outside this directory).
 *
 * "Works at this hospital" is a ROW here, not a column on `profiles`: matrícula is a
 * property of the EMPLOYMENT, so a professional working at two hospitals of one
 * organization holds one affiliation (and one matrícula) per hospital.
 *
 * All reads below run on the ordinary cookie-wired (RLS-scoped) client. The table's
 * SELECT policy has four legs — self, org_admin of the row's org, hospital_admin of
 * the row's hospital, and hospital_admin over any hospital where the principal holds a
 * membership — so a caller outside those simply gets fewer rows, never an error.
 *
 * ⚠ WRITES ARE NOT HERE. `authenticated` holds SELECT only; affiliation mutation goes
 * through the W2 DEFINER doors (`affiliate_person` / `end_affiliation`, ADR 0097 D13),
 * because a write that grants read access to a person's profile is an authorization
 * mutation regardless of its HR clothing. Until those land, the only writer is the
 * service-role action path in `src/lib/users/actions.ts`.
 */

/** One employment row, with the hospital resolved. */
export interface HospitalAffiliation {
  id: string
  principalId: string
  organizationId: string
  hospitalId: string
  /** Resolved hospital name, or null when the hospital row is not visible to the caller. */
  hospitalName: string | null
  /** Matrícula for THIS employment (ADR 0097 D3). */
  hospitalEmployeeId: string | null
  startedOn: string
  /** null = active. A soft end; affiliation rows are never deleted (D4). */
  endedOn: string | null
}

interface AffiliationRow {
  id: string
  principal_id: string
  organization_id: string
  hospital_id: string
  hospital_employee_id: string | null
  started_on: string
  ended_on: string | null
  hospital: { name: string } | null
}

/**
 * The embed is FK-HINTED by constraint name on purpose. `hospital_affiliations` reaches
 * `hospitals` through exactly one (composite) foreign key today, but an un-hinted embed
 * is the PGRST201 shape the moment a second path appears — the recorded lesson from the
 * `profiles↔hospitals` ambiguity that crashed the user directory.
 */
const AFFILIATION_SELECT =
  'id, principal_id, organization_id, hospital_id, hospital_employee_id, started_on, ended_on, hospital:hospitals!hospital_affiliations_hospital_id_fkey(name)'

function toAffiliation(row: AffiliationRow): HospitalAffiliation {
  return {
    id: row.id,
    principalId: row.principal_id,
    organizationId: row.organization_id,
    hospitalId: row.hospital_id,
    hospitalName: row.hospital?.name ?? null,
    hospitalEmployeeId: row.hospital_employee_id,
    startedOn: row.started_on,
    endedOn: row.ended_on,
  }
}

/**
 * Active affiliations for a set of principals, grouped by principal id. Principals with
 * no visible active affiliation are simply absent from the map (callers default to an
 * empty list). Returns an empty map for an empty input — an empty `in.()` is invalid
 * PostgREST, never send one.
 */
export async function listActiveAffiliationsFor(
  principalIds: string[],
): Promise<Map<string, HospitalAffiliation[]>> {
  const grouped = new Map<string, HospitalAffiliation[]>()
  if (principalIds.length === 0) return grouped

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('hospital_affiliations')
    .select(AFFILIATION_SELECT)
    .in('principal_id', principalIds)
    .is('ended_on', null)
    .order('started_on', { ascending: true })

  if (error) throw error

  for (const row of (data ?? []) as unknown as AffiliationRow[]) {
    const affiliation = toAffiliation(row)
    const list = grouped.get(affiliation.principalId)
    if (list) list.push(affiliation)
    else grouped.set(affiliation.principalId, [affiliation])
  }
  return grouped
}

/**
 * The principal ids ACTIVELY affiliated to one hospital — the employment half of a
 * hospital's roster (ADR 0097 D2: a person affiliated with zero committees must still
 * appear, which is the entire point of the table). RLS-scoped: a caller who does not
 * administer the hospital gets an empty list rather than an error.
 */
export async function listActivePrincipalIdsForHospital(
  hospitalId: string,
): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('hospital_affiliations')
    .select('principal_id')
    .eq('hospital_id', hospitalId)
    .is('ended_on', null)
    .returns<{ principal_id: string }[]>()

  if (error) throw error
  return Array.from(new Set((data ?? []).map((r) => r.principal_id)))
}
