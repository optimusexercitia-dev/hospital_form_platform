import type {
  HospitalRef,
  OrganizationRef,
  SessionContext,
} from '@/lib/queries/session'

/**
 * Pure client/server access helpers over {@link SessionContext} for the
 * hospital-admin tier (ADR 0051). These MIRROR — never replace — the DB
 * predicates (`app.is_commission_admin_of` / `app.is_hospital_admin_of`): RLS is
 * the security boundary (Architecture Rule 1); these are for UI gating and nav
 * only (which links light up, which hospital the switcher defaults to). A false
 * negative here can never grant access the DB denies, and a false positive here
 * is caught at every data door by RLS.
 *
 * They are PURE functions over the already-resolved context (no I/O), so they
 * return harmless defaults (`false` / `[]`) as A0 stubs and do NOT throw.
 */

/**
 * Whether the caller is an ADMIN of the given commission — the TS mirror of
 * `app.is_commission_admin_of(commission)` = `org_admin` of the commission's org
 * OR `hospital_admin` of the commission's hospital (ADR 0051 Decision 3). Platform
 * admins are admins of every commission. The commission is identified by its
 * denormalized `organizationId` + `hospitalId` (both NOT NULL on `commissions`).
 */
export function isCommissionAdmin(
  _ctx: SessionContext,
  _commission: { organizationId: string; hospitalId: string },
): boolean {
  // A0 stub — real derivation lands with the session wiring in A4/A5.
  return false
}

/**
 * Whether the caller is a `hospital_admin` of `hospitalId` — the TS mirror of
 * `app.is_hospital_admin_of(hospital)`. Platform admins are NOT implicitly
 * hospital_admins here (admin standing is surfaced via `ctx.isAdmin` separately).
 */
export function isHospitalAdmin(
  _ctx: SessionContext,
  _hospitalId: string,
): boolean {
  // A0 stub — real derivation lands with the session wiring in A4/A5.
  return false
}

/**
 * The hospitals under `orgId` that the caller administers as `hospital_admin`,
 * for the `/o/[org]/manage` hospital switcher (ADR 0051 Decision 7). Sorted by
 * hospital.name (pt-BR). Empty when the caller administers none in that org.
 */
export function adminedHospitals(
  _ctx: SessionContext,
  _orgId: string,
): HospitalRef[] {
  // A0 stub — real derivation lands with the session wiring in A4/A5.
  return []
}

// Re-exported for co-located consumers that only import from this module.
export type { HospitalRef, OrganizationRef, SessionContext }
