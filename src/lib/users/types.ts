/**
 * User Registration & Identity Management — domain contract (CONTRACT-FIRST).
 *
 * NOTE: intentionally NOT `server-only`. These are pure types + the pure
 * `deriveUserStatus` helper, safe to import from both Server and Client
 * Components (e.g. a client-side status badge). The server boundary lives on the
 * data-access + action modules (`queries/org-users.ts`, `users/actions.ts`),
 * which ARE `server-only`.
 *
 * These are the typed shapes the frontend builds its directory + register form +
 * per-user management page against. Backing SQL/RLS/actions are implemented after
 * the lead approves the migration plan; until then the query/action bodies throw
 * `not implemented`, but these types are STABLE (any change is coordinated with
 * the lead so `frontend` adapts — CLAUDE.md process discipline).
 *
 * Status is DERIVED, not a stored enum (plan Q3):
 *   - `pending`     — `profiles.email_confirmed_at IS NULL` (invited, not yet verified)
 *   - `suspended`   — `is_active AND suspended_until > now()` (temporary lockout)
 *   - `deactivated` — `NOT is_active` (master switch off; wins over pending/suspended
 *                     in the app-facing derivation — see `deriveUserStatus`)
 *   - `active`      — otherwise
 *
 * The single source of the derivation lives in `deriveUserStatus` below so the
 * directory list and the detail page agree byte-for-byte.
 */

export type UserStatus = 'pending' | 'active' | 'suspended' | 'deactivated'

/**
 * Pure derivation of the app-facing status from the raw profile lifecycle columns.
 *
 * ⛔ THERE IS NO SQL TWIN, AND BUILDING ONE WOULD BE WRONG. This comment claimed until
 * 2026-08-23 that the ordering "MUST match the SQL derivation used by the directory
 * query" — there has never been such a function (measured against `pg_proc` in `app` and
 * `public`), and `status-vectors.test.ts` says the opposite in as many words. The false
 * claim was the dangerous half: it makes BUILDING a SQL derivation look like restoring
 * parity, when it would manufacture a parity obligation between two predicates that are
 * DESIGNED to disagree. The database's concern is the boolean `app.is_active()`
 * (`is_active AND (suspended_until IS NULL OR now() >= suspended_until)`), which
 * deliberately ignores `email_confirmed_at`: a `pending` user is app-ACTIVE for RLS and
 * display-`pending` here. A future reader "fixing the drift" breaks RLS or the badge.
 *
 * The server-side `?status=` filter therefore does NOT translate this into SQL. It goes
 * through {@link statusesInFilter}, whose column predicates are bound to the SAME vector
 * fixture this function is (see `status-vectors.test.ts`) — one authority, two
 * representations, machine-checked agreement.
 *
 * Ordering is deliberate:
 *   deactivated  >  suspended  >  pending  >  active
 * i.e. the master switch (`is_active`) dominates; a currently-suspended active
 * user reads `suspended`; an unconfirmed active, un-suspended user reads
 * `pending`.
 *
 * @param isActive       `profiles.is_active`
 * @param suspendedUntil `profiles.suspended_until` (ISO string) or null
 * @param emailConfirmedAt `profiles.email_confirmed_at` (ISO string) or null
 * @param now            evaluation instant (defaults to `new Date()`; injectable for tests)
 */
export function deriveUserStatus(
  isActive: boolean,
  suspendedUntil: string | null,
  emailConfirmedAt: string | null,
  now: Date = new Date(),
): UserStatus {
  if (!isActive) return 'deactivated'
  if (suspendedUntil !== null && new Date(suspendedUntil).getTime() > now.getTime()) {
    return 'suspended'
  }
  if (emailConfirmedAt === null) return 'pending'
  return 'active'
}

/**
 * The directory's `?status=` buckets (AFF2 B7 / ADR 0133 D14). English, matching the
 * `ReferralStatus` / `EventStatus` precedent; the pt-BR labels are display-side.
 *
 * ⚠ THREE BUCKETS OVER FOUR STATUSES. `attention` is `suspended ∪ pending` — both are
 * "someone must do something", and the design collapses them into one pill. Absent or
 * unrecognised means ALL, which is why the parse returns `null` rather than throwing.
 */
export type UserDirectoryStatusFilter = 'active' | 'attention' | 'deactivated'

/**
 * Parse a raw `?status=` query value.
 *
 * ⛔ THE PARSE IS OWNED HERE, deliberately, and the page must not do its own. Two parses
 * of one query parameter is how a page filters by one thing and counts by another —
 * and the counts come from a different code path entirely, so nothing would reconcile
 * them. Unknown values degrade to "all" rather than erroring: a stale bookmark or a
 * hand-edited URL must not 500 a directory.
 */
export function parseUserDirectoryStatusFilter(
  raw: string | null | undefined,
): UserDirectoryStatusFilter | null {
  if (raw === 'active' || raw === 'attention' || raw === 'deactivated') return raw
  return null
}

/**
 * Which display statuses a filter bucket admits.
 *
 * ⛔ THIS IS THE ONLY PLACE THE BUCKETS ARE DEFINED. The query layer turns the result into
 * column predicates and the pill counts use the SAME helper, so a filtered page and its
 * count can never disagree about what "attention" means. The mapping is pinned against
 * `status-vectors.json` — the same fixture that pins {@link deriveUserStatus} — so the
 * two representations cannot drift (Architecture Rule 3's mechanism, applied to a TS↔TS
 * pair because there is no SQL side here).
 */
export function statusesInFilter(f: UserDirectoryStatusFilter): UserStatus[] {
  switch (f) {
    case 'active':
      return ['active']
    case 'attention':
      return ['suspended', 'pending']
    case 'deactivated':
      return ['deactivated']
  }
}

/**
 * Pill counts for the directory.
 *
 * ⛔ ALWAYS COMPUTED OVER THE **UNFILTERED** SCOPED SET. A count that respects the active
 * filter reads "Ativos 12" while showing 12 of 12 rows and tells the user nothing; worse,
 * "Desativados 0" while filtered to Ativos looks like a fact about the org.
 */
export interface UserDirectoryStatusCounts {
  /** = active + attention + deactivated. The four display statuses partition the set. */
  all: number
  active: number
  /** suspended ∪ pending. */
  attention: number
  deactivated: number
}

/**
 * Compose the directory's "Registro" cell from a credential's three parts.
 *
 * Pure and client-safe so it can be unit-tested without the server-only query layer, but
 * it is CALLED once server-side (`org-users.ts`) so no table cell re-derives the rule.
 *
 * DEDUPLICATES A TRAILING UF. Measured 2026-08-23: BOTH seeded credentials store the UF
 * inside `registration_number` (`123456-SP` with `issuing_state = 'SP'`), so the naive
 * composition renders "CRM/SP 123456-SP" for 100% of the seed. Stripping it here rather
 * than editing `seed.sql` is deliberate on two counts: the seed is a contract with ~900
 * tests and an exact-count or positional assertion elsewhere is exactly what a casual edit
 * trips; and nothing stops a REAL user typing the UF into the number field, so the tolerant
 * formatter protects live input too, which a seed fix would not.
 *
 * Only an EXACT trailing `-<UF>` matching this credential's own state is removed, so
 * `CRM/SP 123456-RJ` keeps its suffix — a mismatched UF is data worth showing, not noise.
 */
export function formatCouncilRegistration(
  issuingAuthority: string,
  issuingState: string,
  registrationNumber: string,
): string {
  const authority = issuingAuthority.trim()
  const state = issuingState.trim()
  const number = registrationNumber.trim()

  // endsWith, not a RegExp: `state` is caller data, and building a pattern from it would
  // be a needless injection surface for a two-character comparison.
  const suffix = '-' + state
  const deduped =
    state.length > 0 && number.toUpperCase().endsWith(suffix.toUpperCase())
      ? number.slice(0, -suffix.length)
      : number

  const prefix = state ? authority + '/' + state : authority
  return (prefix + ' ' + deduped).trim()
}

/** A professional-category lookup row (managed vocabulary, `professional_categories`). */
export interface ProfessionalCategory {
  id: string
  key: string
  /** pt-BR display label. */
  labelPt: string
  /** Council/registry mapping when the category has one (e.g. 'CRM', 'COREN', 'CRF'); null otherwise. */
  issuingAuthority: string | null
  isActive: boolean
}

/** One professional council registration (`professional_credentials`; 1 user → N). */
export interface ProfessionalCredential {
  id: string
  userId: string
  issuingCountry: string
  issuingState: string
  /** e.g. 'CRM' / 'COREN' / 'CRF'. */
  issuingAuthority: string
  registrationNumber: string
  /** Set when an admin marks the credential verified; CLEARED whenever the credential is edited (tamper-visible). */
  verifiedAt: string | null
  /** Optional expiry (council registrations can lapse). */
  expiresOn: string | null
  createdAt: string
  updatedAt: string
}

/** A committee membership of a user, with the role held in it (for the detail page). */
export interface UserCommitteeMembership {
  commissionId: string
  commissionName: string
  commissionSlug: string
  role: 'staff' | 'staff_admin'
}

/**
 * One row of the org-scoped user directory (`listOrgUsers`). PHI-free, list-shaped —
 * heavier detail (credentials, committee roster) is only loaded by `getOrgUser`.
 */
export interface OrgUserListItem {
  id: string
  fullName: string | null
  email: string | null
  /** Resolved category label (pt-BR), or null when none set. */
  categoryLabel: string | null
  status: UserStatus
  /**
   * The hospitals this person ACTIVELY works at (AFF2 B7). One entry per active
   * `hospital_affiliations` row visible to the caller; `[]` is legitimate and renders
   * "Sem vínculo hospitalar", never an empty cell.
   *
   * ⛔ AN ARRAY, NOT A JOINED STRING, AND THAT IS THE POINT. "N hospitais" cannot be
   * derived from a `', '`-joined string once a hospital name contains a comma — the count
   * silently inflates. The display layer joins; the contract carries the elements.
   */
  hospitalNames: string[]
  /**
   * The person's commission-tier seats (AFF2 B7), for the directory chips — coordinator
   * accent vs member muted. `[]` renders the dashed "Sem comissão", never an empty cell.
   */
  committees: UserCommitteeMembership[]
  /**
   * The council registration for the "Registro" column, PRE-FORMATTED server-side
   * (e.g. `"CRM/SP 152.984"`), or `null` when the person holds none.
   *
   * ⛔ COMPOSED ONCE, HERE-SIDE. The authority/UF/number composition is a domain rule, not
   * a table-cell concern; duplicating it into the renderer is how two surfaces start
   * formatting the same registration differently.
   *
   * ⚠ `null` means NO CREDENTIAL, not "not permitted". A hospital_admin can read these
   * only because ADR 0133 D13 (AFF2 B2) widened `professional_credentials` SELECT — before
   * that this column was silently empty for every hospital admin, which is the
   * "empty means no-permission" state the codebase bans. B2 must stay landed.
   */
  councilRegistration: string | null
}

/**
 * One ACTIVE employment link (`hospital_affiliations`, ADR 0097 D1/D3).
 *
 * Declared HERE, in the client-safe contract module, rather than in
 * `@/lib/queries/affiliations` — that module is `server-only`, and a type declared
 * there would have to be imported across the server boundary by any Client Component
 * rendering a roster. The dependency runs the safe way: the server query module
 * imports this, never the reverse.
 */
export interface UserAffiliation {
  /** The affiliation row id — a stable React key, and what a future row-level edit targets. */
  id: string
  hospitalId: string
  /** Resolved hospital name, or null when the hospital row is not visible to the caller. */
  hospitalName: string | null
  /** Matrícula for THIS employment — a property of the job, not of the person (D3). */
  hospitalEmployeeId: string | null
  startedOn: string
}

/**
 * Full per-user detail (`getOrgUser`) — profile + affiliations + credentials +
 * committee roster.
 *
 * ⚠ AFF W3/T3.2 (ADR 0097 D3, ADR 0098 §W3.1): the transitional singular fields
 * `homeHospitalId` / `homeHospitalName` / `hospitalEmployeeId` are GONE. They were a
 * W1 compatibility shim that let the frontend keep compiling across the column drop,
 * and they lie about the domain the moment the feature works: a professional employed
 * by two hospitals of one organisation has two matrículas and two start dates, and a
 * "primary (earliest active)" field silently picks one. `affiliations` is the shape.
 */
export interface OrgUserDetail {
  id: string
  fullName: string | null
  email: string | null
  homeOrganizationId: string
  /**
   * ACTIVE affiliations, earliest first. EMPTY is a legitimate, meaningful state — a
   * registered person employed nowhere yet (the `novato.pendente` case D2 exists to
   * keep visible); render it, do not treat it as missing data.
   */
  affiliations: UserAffiliation[]
  professionalCategoryId: string | null
  categoryLabel: string | null
  status: UserStatus
  emailConfirmedAt: string | null
  suspendedUntil: string | null
  isActive: boolean
  createdAt: string
  credentials: ProfessionalCredential[]
  committees: UserCommitteeMembership[]
}

/** Paging window for the directory list. */
export interface Paging {
  /** Zero-based page index. */
  page: number
  /** Rows per page. */
  pageSize: number
}

/** A page of directory rows, the total for the pager, and the unfiltered pill counts. */
export interface OrgUserPage {
  rows: OrgUserListItem[]
  /** Rows matching the CURRENT filter + search — what the pager pages over. */
  total: number
  /**
   * Counts over the scoped set IGNORING `status` (search still applies, so the pills
   * describe the set the user is looking at). See {@link UserDirectoryStatusCounts}.
   */
  statusCounts: UserDirectoryStatusCounts
}
