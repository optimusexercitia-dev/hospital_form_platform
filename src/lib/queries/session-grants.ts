import type {
  CommissionRole,
  HospitalAdminMembership,
  HospitalRef,
  Membership,
  OrgAdminMembership,
  OrganizationRef,
  QualityReviewMembership,
  SessionContext,
  TechnicalDirectionMembership,
} from '@/lib/queries/session'

/**
 * The ROLE-PARTITIONING half of `getSessionContext`, extracted as a PURE function.
 *
 * WHY IT LIVES IN ITS OWN MODULE. `public.session_context()` is generic over roles —
 * it returns every effective grant with its scope references and lets the caller
 * partition. That partition is the first of TWO seams a new role has to cross before
 * a signed-in user lands anywhere: the grant must become a `SessionContext` field
 * here, and `src/app/page.tsx` must then branch on that field. FUP-QO-2 records three
 * separate occasions on which a hospital-/org-scoped role (`commission_id NULL`)
 * crossed neither and its holder saw "Você ainda não tem acesso" while being fully
 * provisioned — BUG-HAT-001, then the Diretor Técnico, then `quality_reviewer`.
 *
 * Splitting the partition out of `session.ts` is what makes the guard possible:
 * `session-grants.test.ts` enumerates the role vocabulary FROM THE LIVE CATALOG
 * (`memberships_role_check`), runs each role through THIS function and then through
 * the REAL `src/app/page.tsx`, and requires a landing route. Nothing about the
 * derivation is re-implemented in the test — a re-implementation would pass while the
 * product failed.
 *
 * ⚠ Import graph: this module type-imports `session.ts`, which value-imports this
 * one. Type-only imports are erased, so there is no runtime cycle — and the erasure
 * is load-bearing for the test, which must be able to load this module WITHOUT
 * dragging in `next/headers` and the Supabase server client.
 */

/**
 * One row of `public.session_context()`'s `grants` array. This is the RPC's
 * documented wire shape (see migration `20260905000200`'s header) — snake_cased on
 * the embedded hospital, because that is what PostgREST emits.
 */
export interface SessionGrant {
  role: string
  organization: OrganizationRef | null
  hospital:
    | (Omit<HospitalRef, 'organizationId'> & { organization_id: string })
    | null
  commission: {
    id: string
    name: string
    slug: string
    organization: OrganizationRef
  } | null
}

/** The role-derived half of a `SessionContext` — everything `page.tsx` branches on. */
export type SessionRoleLists = Pick<
  SessionContext,
  | 'memberships'
  | 'orgAdminOf'
  | 'hospitalAdminOf'
  | 'technicalDirectionOf'
  | 'nspOrgAdminOf'
  | 'qualityReviewerOf'
>

const camelHospital = (h: NonNullable<SessionGrant['hospital']>): HospitalRef => ({
  id: h.id,
  slug: h.slug,
  name: h.name,
  organizationId: h.organization_id,
})

/**
 * Partition the RPC's generic grant list into the role-specific lists the shell
 * routes on. Adding a role means adding a filter HERE (or deliberately not, if the
 * shell does not surface it) — never a new query.
 */
export function partitionGrants(grants: SessionGrant[]): SessionRoleLists {
  const memberships: Membership[] = grants
    .filter(
      (
        g,
      ): g is SessionGrant & {
        role: CommissionRole
        commission: NonNullable<SessionGrant['commission']>
      } =>
        g.commission !== null &&
        g.commission.organization !== null &&
        (g.role === 'staff' || g.role === 'staff_admin'),
    )
    .map((g) => ({ commission: g.commission, role: g.role }))
    .sort((a, b) =>
      a.commission.name.localeCompare(b.commission.name, 'pt-BR'),
    )

  const orgsForRole = (role: string): OrgAdminMembership[] =>
    grants
      .filter(
        (g): g is SessionGrant & { organization: OrganizationRef } =>
          g.role === role && g.organization !== null,
      )
      .map((g) => ({ organization: g.organization }))
      .sort((a, b) =>
        a.organization.name.localeCompare(b.organization.name, 'pt-BR'),
      )

  const orgAdminOf: OrgAdminMembership[] = orgsForRole('org_admin')
  // ADR 0051; inert until Phase B, shape now.
  const nspOrgAdminOf: OrgAdminMembership[] = orgsForRole('nsp_org_admin')

  // Hospitals the caller is hospital_admin of (ADR 0051). Each grant carries the org
  // + hospital so `adminedHospitals`/`isHospitalAdmin` resolve without a second hop.
  const hospitalAdminOf: HospitalAdminMembership[] = grants
    .filter(
      (
        g,
      ): g is SessionGrant & {
        organization: OrganizationRef
        hospital: NonNullable<SessionGrant['hospital']>
      } =>
        g.role === 'hospital_admin' &&
        g.organization !== null &&
        g.hospital !== null,
    )
    .map((g) => ({
      organization: g.organization,
      hospital: camelHospital(g.hospital),
    }))
    .sort((a, b) => a.hospital.name.localeCompare(b.hospital.name, 'pt-BR'))

  // ADR 0094 W4 — technical direction. Both roles land in ONE list because D1 makes
  // them one authority.
  const technicalDirectionOf: TechnicalDirectionMembership[] = grants
    .filter(
      (
        g,
      ): g is SessionGrant & {
        role: 'technical_director' | 'technical_director_deputy'
        organization: OrganizationRef
        hospital: NonNullable<SessionGrant['hospital']>
      } =>
        (g.role === 'technical_director' ||
          g.role === 'technical_director_deputy') &&
        g.organization !== null &&
        g.hospital !== null,
    )
    .map((g) => ({
      organization: g.organization,
      hospital: camelHospital(g.hospital),
      role: g.role,
    }))
    .sort((a, b) => a.hospital.name.localeCompare(b.hospital.name, 'pt-BR'))

  // ADR 0100 QO·A — quality review. Same seam as the technical direction above.
  const qualityReviewerOf: QualityReviewMembership[] = grants
    .filter(
      (
        g,
      ): g is SessionGrant & {
        organization: OrganizationRef
        hospital: NonNullable<SessionGrant['hospital']>
      } =>
        g.role === 'quality_reviewer' &&
        g.organization !== null &&
        g.hospital !== null,
    )
    .map((g) => ({
      organization: g.organization,
      hospital: camelHospital(g.hospital),
    }))
    .sort((a, b) => a.hospital.name.localeCompare(b.hospital.name, 'pt-BR'))

  return {
    memberships,
    orgAdminOf,
    hospitalAdminOf,
    technicalDirectionOf,
    nspOrgAdminOf,
    qualityReviewerOf,
  }
}
