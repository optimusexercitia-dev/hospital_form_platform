import 'server-only'

import { createClient } from '@/lib/supabase/server'
import {
  listActiveAffiliationsFor,
  listActivePrincipalIdsForHospital,
  type HospitalAffiliation,
} from '@/lib/queries/affiliations'
import {
  deriveUserStatus,
  formatCouncilRegistration,
  statusesInFilter,
  type OrgUserDetail,
  type OrgUserListItem,
  type OrgUserPage,
  type Paging,
  type ProfessionalCategory,
  type ProfessionalCredential,
  type UserCommitteeMembership,
  type UserDirectoryStatusCounts,
  type UserDirectoryStatusFilter,
  type UserStatus,
} from '@/lib/users/types'

/**
 * Org-scoped user-directory reads (Architecture Rule 9 — all reads go through
 * `src/lib/queries/`). Backs the org_admin user directory + per-user management
 * page under `/o/[org]/manage/usuarios`.
 *
 * RLS is the authority: `profiles` SELECT has an `is_org_admin_of(home_organization_id)`
 * path so an org_admin reads EVERY user anchored to their org — including a
 * freshly-registered `pending` user with no committee yet (which the existing
 * shared-commission / member-join paths would miss). These reads therefore run on
 * the ordinary cookie-wired (RLS-scoped) client; a foreign caller gets empty.
 */

/**
 * The profile columns the directory + detail reads share.
 *
 * ⚠ AFF W1 (ADR 0097 D3): `home_hospital_id` / `hospital_employee_id` and the
 * `hospital:hospitals!profiles_home_hospital_id_fkey(name)` embed are GONE — the
 * columns and that FK were dropped by `20260909000300`. The hospital fact now comes
 * from `hospital_affiliations` (see {@link listActiveAffiliationsFor}). A `.select()`
 * string is a STRING: naming a dropped column typechecks perfectly and fails only at
 * runtime, which is why this constant is the first thing the drop touched.
 *
 * ⚠ `cpf` is deliberately absent and must stay absent: `authenticated` holds
 * COLUMN-LIST grants on `profiles` since `20260909000200` and `cpf` is not among them,
 * so naming it here would 42501 the whole directory (ADR 0097 D7 / audit HIGH-1).
 */
const PROFILE_SELECT =
  'id, full_name, email, home_organization_id, professional_category_id, is_active, suspended_until, email_confirmed_at, created_at, category:professional_categories(label_pt)'

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
  home_organization_id: string | null
  professional_category_id: string | null
  is_active: boolean
  suspended_until: string | null
  email_confirmed_at: string | null
  created_at: string
  category: { label_pt: string } | null
}

/** Row shapes for the two batched per-page reads (AFF2 B7). */
interface DirectoryCredentialRow {
  id: string
  user_id: string
  issuing_authority: string
  issuing_state: string
  registration_number: string
  verified_at: string | null
  created_at: string
}
interface DirectoryMembershipRow {
  principal_id: string
  role: string
  commission: { id: string; name: string; slug: string } | null
}

/** The hospitals a person actively works at, sorted pt-BR. `[]` is a legitimate state. */
function affiliationNames(affiliations: HospitalAffiliation[]): string[] {
  return affiliations
    .map((a) => a.hospitalName)
    .filter((n): n is string => n !== null)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/**
 * Compose the "Registro" cell ONCE, server-side (AFF2 B7).
 *
 * DETERMINISTIC PICK, because a person may hold several credentials and a directory cell
 * that changes between reloads is a bug nobody can reproduce: prefer a VERIFIED
 * credential, then the earliest `created_at`, then the lowest `id`. The last tiebreak
 * exists because `created_at` collides on bulk-inserted rows.
 */
function pickCouncilRegistration(
  credentials: DirectoryCredentialRow[],
): string | null {
  if (credentials.length === 0) return null
  const [best] = [...credentials].sort((a, b) => {
    const av = a.verified_at === null ? 1 : 0
    const bv = b.verified_at === null ? 1 : 0
    if (av !== bv) return av - bv
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1
    return a.id < b.id ? -1 : 1
  })
  return formatCouncilRegistration(
    best.issuing_authority,
    best.issuing_state,
    best.registration_number,
  )
}

/**
 * The set of people a hospital's directory covers (AFF2 B8 extraction).
 *
 * ACTIVELY AFFILIATED to the hospital UNION members of any commission under it. Both arms
 * are resolved to id sets first (RLS-scoped: a hospital_admin reads its own hospital's
 * affiliations, commissions and their members), then `profiles` is paged over the union.
 *
 * The union is an `.in()` over a resolved set rather than a raw `.or()` string: an `.or()`
 * with interpolated values is the recorded PostgREST injection/parse hazard, and the id set
 * is bounded by one hospital's roster.
 *
 * EXTRACTED SO THE RULE HAS ONE DEFINITION. `listHospitalUsers` uses it as its ENTIRE
 * scope; `listOrgUsers` INTERSECTS it with the org roster for the `?hospital=` filter.
 * Re-deriving "who works at this hospital" in the second caller is how the two would come
 * to disagree about whether a committee seat counts.
 */
async function hospitalPeopleIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  hospitalId: string,
): Promise<Set<string>> {
  const { data: commRows } = await supabase
    .from('commissions')
    .select('id')
    .eq('hospital_id', hospitalId)
    .returns<{ id: string }[]>()
  const commissionIds = (commRows ?? []).map((c) => c.id)

  const ids = new Set<string>(await listActivePrincipalIdsForHospital(hospitalId))
  if (commissionIds.length > 0) {
    const { data: memberRows } = await supabase
      .from('memberships')
      .select('principal_id')
      .in('commission_id', commissionIds)
      .returns<{ principal_id: string }[]>()
    for (const m of memberRows ?? []) ids.add(m.principal_id)
  }
  return ids
}

/**
 * The `?status=` filter, as PostgREST column predicates.
 *
 * NOT A SECOND DERIVATION - it is a second REPRESENTATION of `deriveUserStatus`, and the
 * two are bound by the SAME vector fixture (`status-vectors.json`, walked by
 * `src/lib/users/status-filter-vectors.test.ts`). There is deliberately no SQL twin of the
 * 4-way status: `app.is_active()` ignores `email_confirmed_at` on purpose, so a `pending`
 * user is app-ACTIVE for RLS and display-`pending` here. See the note on
 * `deriveUserStatus`.
 *
 * `suspended` and `active` BOTH require `is_active = true`, and they are separated by
 * `suspended_until` against NOW. The instant is taken ONCE per call and passed in, so the
 * page predicate and the three counts cannot straddle a tick and disagree.
 */
/**
 * The subset of the PostgREST fluent builder these predicates use.
 *
 * The builder is fluent but NOT `this`-typed: every method returns the wide
 * `PostgrestFilterBuilder`, so a `T extends {...}` constraint cannot express "returns the
 * same T". Modelling the three methods here and casting once inside `applyStatusFilter`
 * is what lets the predicate set be written EXACTLY ONCE. The alternative - applying the
 * predicates inline at both call sites - is a second derivation of the status rule, which
 * is the thing this whole design exists to prevent.
 */
interface FluentFilter {
  eq: (column: string, value: unknown) => FluentFilter
  not: (column: string, operator: string, value: unknown) => FluentFilter
  or: (filters: string) => FluentFilter
}

function applyStatusFilter<T>(
  query: T,
  status: UserDirectoryStatusFilter,
  nowIso: string,
): T {
  const q = query as unknown as FluentFilter
  const wanted = new Set<UserStatus>(statusesInFilter(status))

  let out: FluentFilter
  if (wanted.has('deactivated')) {
    out = q.eq('is_active', false)
  } else {
    // Everything else lives under the master switch.
    const underMasterSwitch = q.eq('is_active', true)
    out = wanted.has('active')
      // active = confirmed AND not currently suspended.
      ? underMasterSwitch
          .not('email_confirmed_at', 'is', null)
          .or('suspended_until.is.null,suspended_until.lte.' + nowIso)
      // attention = suspended UNION pending, both under is_active:
      //   suspended -> suspended_until > now ; pending -> email_confirmed_at is null
      : underMasterSwitch.or(
          'suspended_until.gt.' + nowIso + ',email_confirmed_at.is.null',
        )
  }
  return out as unknown as T
}

/**
 * Pill counts over the scoped set IGNORING `status` (AFF2 B7 / ADR 0133 D14).
 *
 * THREE HEAD-COUNTS, NOT AN UNPAGED READ. `count: 'exact', head: true` returns no rows, so
 * this is O(1) in the size of the org. The alternative - fetching the three lifecycle
 * columns for the whole scoped set and counting through `deriveUserStatus` directly - uses
 * the authority with no translation at all and is trivial at today's largest seeded org
 * (29 people), but it is unbounded, and AFF2's founding scenario is a ten-hospital
 * network. Recorded so the trade is auditable rather than assumed.
 *
 * `all` is the SUM: the four display statuses partition the set by construction of
 * `deriveUserStatus`, and that partition is PINNED by the vector test rather than trusted.
 */
async function countByStatus(
  build: () => unknown,
  nowIso: string,
): Promise<UserDirectoryStatusCounts> {
  const buckets: UserDirectoryStatusFilter[] = ['active', 'attention', 'deactivated']
  const counted = await Promise.all(
    buckets.map(async (bucket) => {
      const query = applyStatusFilter(build(), bucket, nowIso)
      const { count, error } = (await query) as {
        count: number | null
        error: { message: string } | null
      }
      if (error) throw error
      return count ?? 0
    }),
  )
  const [active, attention, deactivated] = counted
  return { all: active + attention + deactivated, active, attention, deactivated }
}

/**
 * Per-page credential + committee reads, BATCHED (AFF2 B7).
 *
 * TWO ROUND TRIPS FOR THE WHOLE PAGE, never one per row. `.in(..., pageIds)` keeps this
 * O(1) in page size; a per-row read is how a directory goes quadratic without anyone
 * noticing until a real org loads it.
 *
 * The credential read only returns rows for people the caller may see - ADR 0133 D13
 * (AFF2 B2) is what makes that non-empty for a hospital_admin. A null "Registro" therefore
 * means NO CREDENTIAL, never "not permitted"; B2 must stay landed for that to hold.
 */
async function loadPageExtras(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<{
  credentials: Map<string, DirectoryCredentialRow[]>
  committees: Map<string, UserCommitteeMembership[]>
}> {
  const credentials = new Map<string, DirectoryCredentialRow[]>()
  const committees = new Map<string, UserCommitteeMembership[]>()
  if (ids.length === 0) return { credentials, committees }

  const [credRes, memRes] = await Promise.all([
    supabase
      .from('professional_credentials')
      .select(
        'id, user_id, issuing_authority, issuing_state, registration_number, verified_at, created_at',
      )
      .in('user_id', ids)
      .returns<DirectoryCredentialRow[]>(),
    supabase
      .from('memberships')
      .select('principal_id, role, commission:commissions!inner(id, name, slug)')
      .not('commission_id', 'is', null)
      .in('principal_id', ids)
      .returns<DirectoryMembershipRow[]>(),
  ])
  if (credRes.error) throw credRes.error
  if (memRes.error) throw memRes.error

  for (const c of credRes.data ?? []) {
    const list = credentials.get(c.user_id) ?? []
    list.push(c)
    credentials.set(c.user_id, list)
  }
  for (const m of memRes.data ?? []) {
    if (!m.commission) continue
    // Only the two commission-tier roles reach the chips. `memberships_scope_shape`
    // guarantees nothing else carries a commission_id, but the narrowing is explicit
    // rather than assumed - that role vocabulary has been widened four times.
    if (m.role !== 'staff' && m.role !== 'staff_admin') continue
    const list = committees.get(m.principal_id) ?? []
    list.push({
      commissionId: m.commission.id,
      commissionName: m.commission.name,
      commissionSlug: m.commission.slug,
      role: m.role,
    })
    committees.set(m.principal_id, list)
  }
  for (const list of committees.values()) {
    list.sort((a, b) => a.commissionName.localeCompare(b.commissionName, 'pt-BR'))
  }
  return { credentials, committees }
}

/** Assemble the list rows from the page read plus its two batched extras. */
function toListItems(
  rows: ProfileRow[],
  affiliations: Map<string, HospitalAffiliation[]>,
  extras: {
    credentials: Map<string, DirectoryCredentialRow[]>
    committees: Map<string, UserCommitteeMembership[]>
  },
): OrgUserListItem[] {
  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    categoryLabel: r.category?.label_pt ?? null,
    status: deriveUserStatus(r.is_active, r.suspended_until, r.email_confirmed_at),
    hospitalNames: affiliationNames(affiliations.get(r.id) ?? []),
    committees: extras.committees.get(r.id) ?? [],
    councilRegistration: pickCouncilRegistration(extras.credentials.get(r.id) ?? []),
  }))
}

/** Options for the two directory list reads (AFF2 B7). */
export interface ListDirectoryOptions {
  search: string
  /** `null` = all. Parse the raw query value with `parseUserDirectoryStatusFilter`. */
  status: UserDirectoryStatusFilter | null
  /**
   * AFF2 B8 - narrow an ORG-wide directory to one hospital. `null` = all hospitals.
   *
   * Ignored by `listHospitalUsers`, which is hospital-scoped by construction; passing it
   * there would be a second, weaker expression of the same scope.
   */
  hospital?: string | null
  paging: Paging
}

/**
 * A page of the org's user directory.
 *
 * `search` matches **full_name OR email**, case-insensitive - and NOTHING ELSE. This
 * docblock claimed "or category label" until 2026-08-23; the query has only ever built
 * `full_name.ilike OR email.ilike`, and the false claim had propagated into the visible
 * `aria-label`, telling users they could search by something they could not. A
 * registration-number leg is deliberately NOT added: it crosses into
 * `professional_credentials` and needs a join filter, not another `.or()` clause.
 *
 * `status` filters server-side; `statusCounts` is computed over the same scoped set with
 * the status filter OMITTED. Empty when the caller is not an org_admin of `orgId`
 * (RLS-scoped) - and an empty list NEVER means "you lack permission".
 */
export async function listOrgUsers(
  orgId: string,
  options: ListDirectoryOptions,
): Promise<OrgUserPage> {
  const supabase = await createClient()
  const { search, status, hospital, paging } = options

  // ONE instant for the page predicate AND the three counts, so they cannot straddle a
  // tick and report a suspension that expired mid-request in two different buckets.
  const nowIso = new Date().toISOString()
  const term = search.trim()
  const escaped = term.replace(/[%,()]/g, '')

  // AFF2 B8 - the `?hospital=` filter NARROWS the org roster; it can never widen it.
  //
  // PO-ruled 2026-08-23. "People at hospital H" (affiliation UNION commission seat) is not
  // a subset of "people homed in org O": a person homed elsewhere could hold a seat on a
  // commission of H, and `memberships_scope_shape` does not forbid it. Intersecting keeps a
  // filter doing what a filter does - only ever removing rows - so the unfiltered directory
  // stays the superset of every filtered view of it.
  //
  // MEASURED 2026-08-23: ZERO rows currently differ. Probing
  // `memberships x commissions x profiles` for a home-org/commission-org mismatch returns
  // 0, so the two readings are indistinguishable today and NO test can tell them apart.
  // Recorded because the first such row will make this behaviour look like a bug: a person
  // visible at hospital H and absent from the org directory is INTENDED, not a dropped row.
  const hospitalScope = hospital
    ? Array.from(await hospitalPeopleIds(supabase, hospital))
    : null

  /** The scoped set, WITHOUT the status filter - shared by the page read and the counts. */
  const scoped = (head: boolean) => {
    let q = supabase
      .from('profiles')
      .select(head ? 'id' : PROFILE_SELECT, { count: 'exact', head })
      .eq('home_organization_id', orgId)
    if (hospitalScope) q = q.in('id', hospitalScope)
    if (term) {
      q = q.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`)
    }
    return q
  }

  const from = paging.page * paging.pageSize
  const to = from + paging.pageSize - 1

  let pageQuery = scoped(false)
  if (status) pageQuery = applyStatusFilter(pageQuery, status, nowIso)

  const [pageRes, statusCounts] = await Promise.all([
    pageQuery
      .order('full_name', { ascending: true, nullsFirst: false })
      .range(from, to),
    countByStatus(() => scoped(true), nowIso),
  ])

  if (pageRes.error) throw pageRes.error
  const rows = (pageRes.data ?? []) as unknown as ProfileRow[]
  const ids = rows.map((r) => r.id)

  const [affiliations, extras] = await Promise.all([
    listActiveAffiliationsFor(ids),
    loadPageExtras(supabase, ids),
  ])

  const items = toListItems(rows, affiliations, extras)
  return {
    rows: items,
    total: pageRes.count ?? items.length,
    statusCounts,
  }
}

/**
 * A page of ONE HOSPITAL's user directory, for a `hospital_admin` (ADR 0051
 * Decision 4 / Q2 — hospital-scoped directory, NO org-wide `profiles` read for a
 * hospital_admin). Same {@link OrgUserPage} shape as {@link listOrgUsers}. RLS-scoped:
 * empty for a caller who is not a `hospital_admin` of `hospitalId` (nor org_admin of
 * its org / platform_admin).
 *
 * ⚠ AFF W1 (ADR 0097 D2/D3): the scope is now "ACTIVE AFFILIATION to the hospital ∪
 * membership of one of its commissions", replacing `home_hospital_id`. A person
 * affiliated with ZERO committees must appear — that is the entire point of the
 * affiliation table, and it is the case a commission-derived roster silently drops.
 *
 * ⚠ W1 KNOWN GAP, closed by W2/T2.3: the affiliation half of this union is only as
 * visible as `profiles` RLS allows, and the `profiles` affiliation leg is a W2
 * deliverable. Until it lands, an affiliated-but-committee-less person is enumerated
 * here and then filtered out by the row policy. pgTAP `301` §5 pins that state.
 */
export async function listHospitalUsers(
  hospitalId: string,
  options: ListDirectoryOptions,
): Promise<OrgUserPage> {
  const supabase = await createClient()
  const { search, status, paging } = options
  const nowIso = new Date().toISOString()

  // The hospital's user set, from the ONE definition of it (AFF2 B8). `listOrgUsers`
  // intersects the same helper for its `?hospital=` filter.
  const scopedUserIds = await hospitalPeopleIds(supabase, hospitalId)

  // An empty `in.()` is invalid PostgREST - a hospital with no roster at all returns an
  // empty page without a round trip. The counts are all zero by construction, and are
  // returned explicitly rather than omitted: a missing pill row is not the same UI as
  // four zeroes, and "no roster" is a real answer.
  if (scopedUserIds.size === 0) {
    return {
      rows: [],
      total: 0,
      statusCounts: { all: 0, active: 0, attention: 0, deactivated: 0 },
    }
  }

  const term = search.trim()
  const escaped = term.replace(/[%,()]/g, '')
  const scopedIds = Array.from(scopedUserIds)

  const scoped = (head: boolean) => {
    let q = supabase
      .from('profiles')
      .select(head ? 'id' : PROFILE_SELECT, { count: 'exact', head })
      .in('id', scopedIds)
    if (term) {
      q = q.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`)
    }
    return q
  }

  const from = paging.page * paging.pageSize
  const to = from + paging.pageSize - 1

  let pageQuery = scoped(false)
  if (status) pageQuery = applyStatusFilter(pageQuery, status, nowIso)

  const [pageRes, statusCounts] = await Promise.all([
    pageQuery
      .order('full_name', { ascending: true, nullsFirst: false })
      .range(from, to),
    countByStatus(() => scoped(true), nowIso),
  ])

  if (pageRes.error) throw pageRes.error
  const rows = (pageRes.data ?? []) as unknown as ProfileRow[]
  const ids = rows.map((r) => r.id)

  const [affiliations, extras] = await Promise.all([
    listActiveAffiliationsFor(ids),
    loadPageExtras(supabase, ids),
  ])

  const items = toListItems(rows, affiliations, extras)
  return {
    rows: items,
    total: pageRes.count ?? items.length,
    statusCounts,
  }
}

/**
 * Full detail for one user (profile + credentials[] + committee memberships[] with
 * role). Returns `null` when the user does not exist or is not visible to the
 * caller (RLS-scoped: org_admin of the user's home org / the user themselves /
 * platform_admin).
 */
export async function getOrgUser(userId: string): Promise<OrgUserDetail | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  const profile = data as unknown as ProfileRow

  const [credentialsResult, membershipsResult] = await Promise.all([
    supabase
      .from('professional_credentials')
      .select(
        'id, user_id, issuing_country, issuing_state, issuing_authority, registration_number, verified_at, expires_on, created_at, updated_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('memberships')
      .select('role, commission:commissions(id, name, slug)')
      .eq('principal_id', userId)
      .not('commission_id', 'is', null),
  ])

  if (credentialsResult.error) throw credentialsResult.error
  if (membershipsResult.error) throw membershipsResult.error

  const credentials: ProfessionalCredential[] = (
    credentialsResult.data ?? []
  ).map((c) => ({
    id: c.id,
    userId: c.user_id,
    issuingCountry: c.issuing_country,
    issuingState: c.issuing_state,
    issuingAuthority: c.issuing_authority,
    registrationNumber: c.registration_number,
    verifiedAt: c.verified_at,
    expiresOn: c.expires_on,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }))

  const committees: UserCommitteeMembership[] = (membershipsResult.data ?? [])
    .filter(
      (
        m,
      ): m is {
        role: 'staff' | 'staff_admin'
        commission: { id: string; name: string; slug: string }
      } =>
        m.commission !== null &&
        (m.role === 'staff' || m.role === 'staff_admin'),
    )
    .map((m) => ({
      commissionId: m.commission.id,
      commissionName: m.commission.name,
      commissionSlug: m.commission.slug,
      role: m.role,
    }))
    .sort((a, b) => a.commissionName.localeCompare(b.commissionName, 'pt-BR'))

  // AFF W3/T3.2 — the detail surface carries the affiliation LIST (ADR 0097 D3). The
  // W1 shim that flattened it to a "primary" hospital is gone: a professional employed
  // by two hospitals of one org has two matrículas, and picking one silently is the
  // bug this feature exists to fix. An EMPTY list is a legitimate state.
  const activeAffiliations = (await listActiveAffiliationsFor([userId])).get(userId) ?? []

  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    homeOrganizationId: profile.home_organization_id ?? '',
    affiliations: activeAffiliations.map((a) => ({
      id: a.id,
      hospitalId: a.hospitalId,
      hospitalName: a.hospitalName,
      hospitalEmployeeId: a.hospitalEmployeeId,
      startedOn: a.startedOn,
    })),
    professionalCategoryId: profile.professional_category_id,
    categoryLabel: profile.category?.label_pt ?? null,
    status: deriveUserStatus(
      profile.is_active,
      profile.suspended_until,
      profile.email_confirmed_at,
    ),
    emailConfirmedAt: profile.email_confirmed_at,
    suspendedUntil: profile.suspended_until,
    isActive: profile.is_active,
    createdAt: profile.created_at,
    credentials,
    committees,
  }
}

/**
 * The active professional-category vocabulary (for the register/edit form select).
 * Authenticated-readable (RLS), so this runs on the cookie client.
 */
export async function listProfessionalCategories(): Promise<
  ProfessionalCategory[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('professional_categories')
    .select('id, key, label_pt, issuing_authority, is_active')
    .eq('is_active', true)
    .order('position', { ascending: true, nullsFirst: false })

  if (error) throw error

  return (data ?? []).map((c) => ({
    id: c.id,
    key: c.key,
    labelPt: c.label_pt,
    issuingAuthority: c.issuing_authority,
    isActive: c.is_active,
  }))
}
