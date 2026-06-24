'use server'

import type { ActionState } from '@/lib/admin/actions'

/**
 * PLATFORM-admin (vendor) provisioning server actions — multi-tenancy Phase A
 * CONTRACT STUBS. Bodies land in Phase C.
 *
 * These run with the service-role client behind a `requireAdmin()` (platform_admin
 * / `is_admin`) gate, NOT an org-scoped one — provisioning a new organization is a
 * vendor-only operation. `platform_admin` is walled off from all tenant data/PHI;
 * its ONLY tenant-adjacent reach is this provisioning surface (create org, create
 * the org's first hospital, seat the org's first org_admin). All subsequent
 * in-org administration is the org_admin's job (see `src/lib/org/actions.ts`).
 *
 * Shapes are frozen here so `frontend` builds the platform admin UI against real
 * types from day one (contract-first). Each is `useActionState`-shaped:
 * `(prevState, formData) => Promise<ActionState>`. All user-facing strings will be
 * pt-BR; raw Postgres errors never reach the UI.
 */

const NOT_IMPLEMENTED = 'not implemented'

/**
 * Create an organization (the top-level tenant / customer). Platform-admin only.
 * Validates `name` + `slug` (slug is globally unique — it is the /o/[org] route
 * key). The `organizations_slug_key` citext constraint is the uniqueness
 * authority; a conflict maps to a pt-BR field error in Phase C.
 *
 * formData: `name`, `slug`.
 */
export async function createOrganization(
  _prev: ActionState | undefined,
  _formData: FormData,
): Promise<ActionState> {
  throw new Error(NOT_IMPLEMENTED)
}

/**
 * Create a hospital under an organization. Platform-admin only at this seam (the
 * org_admin gets their own `createHospital` in `src/lib/org/actions.ts`). Slug is
 * unique per org (`hospitals_org_slug_key`).
 *
 * formData: `organizationId`, `name`, `slug`.
 */
export async function createHospital(
  _prev: ActionState | undefined,
  _formData: FormData,
): Promise<ActionState> {
  throw new Error(NOT_IMPLEMENTED)
}

/**
 * Seat an org_admin on an organization BY EMAIL: resolve the existing user or
 * invite a new one (reuses `resolveOrInviteUser`), then upsert their
 * `organization_members` row with `role = 'org_admin'` HARD-CODED (never read
 * from formData). Platform-admin only. A verbatim clone of `assignStaffAdmin`
 * targeting `organization_members`. Idempotent on `(organization_id, user_id)`.
 *
 * formData: `organizationId`, `email`.
 */
export async function assignOrgAdmin(
  _prev: ActionState | undefined,
  _formData: FormData,
): Promise<ActionState> {
  throw new Error(NOT_IMPLEMENTED)
}
