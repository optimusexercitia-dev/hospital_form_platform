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
 * Pure derivation of the app-facing status from the raw profile lifecycle
 * columns. Ordering is deliberate and MUST match the SQL derivation used by the
 * directory query (a shared vector test keeps them in agreement, mirroring the
 * condition-evaluator discipline):
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
   * The hospital(s) this person ACTIVELY works at, joined by ', ' — derived from
   * `hospital_affiliations` since AFF W1 (ADR 0097 D1/D3); it was a single
   * `profiles.home_hospital_id` name before. Null when there is no visible active
   * affiliation. One affiliation renders exactly as the old value did.
   */
  homeHospitalName: string | null
  /** Number of committees the user belongs to (directory badge). */
  committeeCount: number
}

/**
 * Full per-user detail (`getOrgUser`) — profile + credentials + committee roster.
 *
 * ⚠ AFF W1 (ADR 0097 D3): `homeHospitalId` / `homeHospitalName` / `hospitalEmployeeId`
 * are no longer `profiles` columns — they are DERIVED from the person's active
 * `hospital_affiliations`. The two id-shaped fields describe the PRIMARY (earliest
 * active) affiliation, because this surface still renders one hospital. That is a
 * transitional shape: W3/T3.3 replaces all three with an affiliation LIST, which is
 * the shape a professional working at two hospitals of one org actually needs. Do not
 * build new behaviour on the singular fields.
 */
export interface OrgUserDetail {
  id: string
  fullName: string | null
  email: string | null
  homeOrganizationId: string
  /** Primary (earliest active) affiliation's hospital; null when unaffiliated. */
  homeHospitalId: string | null
  /** All active affiliations' hospital names, joined by ', '. */
  homeHospitalName: string | null
  /** Matrícula of the PRIMARY affiliation — per employment, not per person (D3). */
  hospitalEmployeeId: string | null
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

/** A page of directory rows plus the total count (for pager UI). */
export interface OrgUserPage {
  rows: OrgUserListItem[]
  total: number
}
