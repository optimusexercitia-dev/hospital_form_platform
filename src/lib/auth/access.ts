import type {
  HospitalRef,
  OrganizationRef,
  SessionContext,
} from '@/lib/queries/session'

/**
 * Pure client/server access helpers over {@link SessionContext} for the
 * hospital-admin tier (ADR 0051). These MIRROR — never replace — the DB
 * predicates (`app.is_tenancy_admin_of` / `app.is_hospital_admin_of`): RLS is
 * the security boundary (Architecture Rule 1); these are for UI gating and nav
 * only (which links light up, which hospital the switcher defaults to). A false
 * negative here can never grant access the DB denies, and a false positive here
 * is caught at every data door by RLS.
 *
 * They are PURE functions over the already-resolved context (no I/O): they read
 * the `orgAdminOf` / `hospitalAdminOf` grants that `getSessionContext` resolved
 * (ADR 0051) and never throw.
 */

/**
 * Whether the caller is an ADMIN of the given commission — the TS mirror of
 * `app.is_tenancy_admin_of(commission)` = `org_admin` of the commission's org
 * OR `hospital_admin` of the commission's hospital (ADR 0051 Decision 3). The
 * commission is identified by its denormalized `organizationId` + `hospitalId`
 * (both NOT NULL on `commissions`). NOTE: platform admins are NOT treated as
 * commission admins here (vendor isolation, ADR 0041) — `ctx.isAdmin` is a
 * separate signal; the DB predicate likewise has no is_admin fallback.
 */
export function isCommissionAdmin(
  ctx: SessionContext,
  commission: { organizationId: string; hospitalId: string },
): boolean {
  return (
    ctx.orgAdminOf.some((o) => o.organization.id === commission.organizationId) ||
    ctx.hospitalAdminOf.some((h) => h.hospital.id === commission.hospitalId)
  )
}

/**
 * Whether the caller is a `hospital_admin` of `hospitalId` — the TS mirror of
 * `app.is_hospital_admin_of(hospital)`. Platform admins are NOT implicitly
 * hospital_admins here (admin standing is surfaced via `ctx.isAdmin` separately).
 */
export function isHospitalAdmin(
  ctx: SessionContext,
  hospitalId: string,
): boolean {
  return ctx.hospitalAdminOf.some((h) => h.hospital.id === hospitalId)
}

/**
 * The hospitals under `orgId` that the caller administers as `hospital_admin`,
 * for the `/o/[org]/manage` hospital switcher (ADR 0051 Decision 7). Sorted by
 * hospital.name (pt-BR) — `hospitalAdminOf` is already so sorted. Empty when the
 * caller administers none in that org.
 */
export function adminedHospitals(
  ctx: SessionContext,
  orgId: string,
): HospitalRef[] {
  return ctx.hospitalAdminOf
    .filter((h) => h.organization.id === orgId)
    .map((h) => h.hospital)
}

// Re-exported for co-located consumers that only import from this module.
export type { HospitalRef, OrganizationRef, SessionContext }
