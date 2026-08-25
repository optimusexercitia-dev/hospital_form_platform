import 'server-only'

import { createClient } from '@/lib/supabase/server'
import type { UserAffiliation } from '@/lib/users/types'

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

/**
 * One employment row, with the hospital resolved — the server-side view of
 * {@link UserAffiliation}, adding the scope ids the UI has no use for.
 */
export interface HospitalAffiliation extends UserAffiliation {
  principalId: string
  organizationId: string
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
 * ACTIVE **and** ENDED affiliations for a set of principals, grouped by principal id —
 * the employment HISTORY, for the person detail page's "Vínculos hospitalares" card.
 *
 * ⛔ A SIBLING OF {@link listActiveAffiliationsFor}, DELIBERATELY NOT A WIDENING OF IT.
 * Relaxing the active-only filter in place would have been one line and would have been
 * wrong: `listActiveAffiliationsFor` answers the PRESENT-TENSE question ("where does this
 * person work"), and it feeds `OrgUserListItem.hospitalNames` in BOTH directory reads
 * plus, through `hospitalPeopleIds`, the hospital-scoped roster itself. Admitting ended
 * rows there would list a person under a hospital they left — silently, with no test
 * naming the change, because both functions return the same TYPE. Two questions, two
 * functions; the type carries `endedOn` so neither caller has to guess which it got.
 *
 * ORDER IS PART OF THE CONTRACT and is applied HERE rather than at the call site: ACTIVE
 * rows first (earliest `started_on` first, matching the active-only reader), then ENDED
 * rows most-recently-ended first. A second sort beside the caller is how one surface
 * starts showing a different order from another.
 *
 * Empty map for an empty input — an empty `in.()` is invalid PostgREST, never send one.
 * RLS-scoped exactly as the active reader is: fewer rows for a foreign caller, never an
 * error, and an empty result NEVER means "not permitted".
 */
export async function listAffiliationsFor(
  principalIds: string[],
): Promise<Map<string, HospitalAffiliation[]>> {
  const grouped = new Map<string, HospitalAffiliation[]>()
  if (principalIds.length === 0) return grouped

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('hospital_affiliations')
    .select(AFFILIATION_SELECT)
    .in('principal_id', principalIds)
    .order('started_on', { ascending: true })

  if (error) throw error

  for (const row of (data ?? []) as unknown as AffiliationRow[]) {
    const affiliation = toAffiliation(row)
    const list = grouped.get(affiliation.principalId)
    if (list) list.push(affiliation)
    else grouped.set(affiliation.principalId, [affiliation])
  }

  for (const list of grouped.values()) {
    list.sort((a, b) => {
      // Active before ended. Both null → keep the started_on order the query imposed.
      if (a.endedOn === null && b.endedOn === null) return 0
      if (a.endedOn === null) return -1
      if (b.endedOn === null) return 1
      // Both ended: most recently ended first.
      if (a.endedOn === b.endedOn) return 0
      return a.endedOn < b.endedOn ? 1 : -1
    })
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

// ---------------------------------------------------------------------------
// The org people directory (ADR 0097 D10/D11) — W3's identifier-first lookup.
// ---------------------------------------------------------------------------

/** One same-org affiliation as the directory returns it. Matrícula is NOT included. */
export interface OrgPersonAffiliation {
  hospitalId: string
  hospitalName: string
  startedOn: string
}

/**
 * One person in the org directory. ⚠ `cpf` is deliberately ABSENT and must stay absent
 * (D11): it is a search INPUT only and is never returned to the client.
 */
export interface OrgPerson {
  userId: string
  fullName: string | null
  email: string | null
  /** Resolved professional-category label (pt-BR), or null. */
  professionalCategory: string | null
  /**
   * ISO `yyyy-mm-dd`, or null — AFF2 B3 / ADR 0133 D11, corrected by Amendment 1 ruling 4.
   *
   * This door is DOB's SECOND read path (the first is the profile rail behind the
   * person-scope authorizer). D11's rationale requires that reach: Brazil's homonym rate
   * makes birth date the practical human differentiator, and the colliding same-named
   * person is typically at ANOTHER hospital in the network — which is exactly the span
   * this door's gate (org_admin OR any hospital_admin of the org) covers.
   *
   * ⚠ `phone` is deliberately NOT here and must stay out: it differentiates nothing in a
   * homonym match, so it keeps a single read path (D11).
   *
   * ⚠ The generated type says `date_of_birth: string`, non-nullable. Do not believe it —
   * `supabase gen types` types EVERY `RETURNS TABLE` column as non-nullable, including
   * `email` and `full_name`, which are nullable in the catalog. The column is nullable
   * (optional at registration, D9) and this field is the honest shape.
   */
  dateOfBirth: string | null
  /**
   * Deactivated people ARE returned, flagged. The identifier-first flow must be able to
   * say "this person exists but their account is deactivated" rather than silently
   * offering to affiliate them or, worse, to create a duplicate.
   */
  isActive: boolean
  /** ACTIVE affiliations within the queried organisation only. */
  affiliations: OrgPersonAffiliation[]
}

/**
 * The org-scoped people directory (`list_org_people`, ADR 0097 D10/D11).
 *
 * ⚠ Runs on the COOKIE client, not the service client, and that is load-bearing: the
 * door resolves the caller from `auth.uid()` both to gate itself and to name the actor
 * on the CPF-lookup audit row. A service-client call would be ungated and unattributed.
 *
 * ⚠ An unauthorized caller gets an EMPTY list, never an error — the door matches
 * `list_addable_commission_members` so a probe cannot distinguish "no results" from
 * "not allowed". Callers must not translate empty into "you lack permission".
 *
 * `cpf` must be the full 11-digit storage form (use `normalizeCpf` first); it matches
 * EXACTLY or not at all, and every CPF-parameterised call emits an audit row.
 */
export async function listOrgPeople(params: {
  orgId: string
  search?: string | null
  cpf?: string | null
}): Promise<OrgPerson[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('list_org_people', {
    p_org_id: params.orgId,
    p_search: params.search ?? undefined,
    p_cpf: params.cpf ?? undefined,
  })

  if (error) throw error

  return (data ?? []).map((row) => ({
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    professionalCategory: row.professional_category,
    // `?? null` is load-bearing despite the generated type claiming non-nullable — see
    // the field's doc comment on OrgPerson.
    dateOfBirth: row.date_of_birth ?? null,
    isActive: row.is_active,
    affiliations: (
      (row.affiliations ?? []) as {
        hospital_id: string
        hospital_name: string
        started_on: string
      }[]
    ).map((a) => ({
      hospitalId: a.hospital_id,
      hospitalName: a.hospital_name,
      startedOn: a.started_on,
    })),
  }))
}
