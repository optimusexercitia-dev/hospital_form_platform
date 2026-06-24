'use server'

import type { ActionState } from '@/lib/admin/actions'

/**
 * ORG-admin (customer) provisioning server actions — multi-tenancy Phase A
 * CONTRACT STUBS. Bodies land in Phase C.
 *
 * Unlike `src/lib/platform/actions.ts` (vendor, service-role), these run with the
 * org_admin's OWN session and RLS is the authority: the `hospitals_write` /
 * `commissions` write policies already gate on `is_org_admin_of(...)`. Each action
 * still re-verifies `is_org_admin_of(organizationId)` server-side before any write
 * (defense in depth + a friendly forbidden message), never trusting the client.
 *
 * These are the existing admin/members actions moved down a level essentially
 * unchanged — the gate flips from `isAdmin` to `is_org_admin_of(org)`. Shapes are
 * frozen here so `frontend` builds the `/o/[org]/manage` UI against real types.
 * `useActionState`-shaped: `(prevState, formData) => Promise<ActionState>`. All
 * user-facing strings will be pt-BR.
 */

const NOT_IMPLEMENTED = 'not implemented'

/**
 * Create a hospital within the org_admin's own organization. Slug unique per org.
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
 * Create a commission under a hospital in the org_admin's org. The commission's
 * `organization_id` is auto-derived from `hospitalId` by the
 * `commission_derive_organization_id` trigger (never sent by the client). Slug is
 * unique per org (`commissions_org_slug_key`).
 *
 * formData: `hospitalId`, `name`, `slug`.
 */
export async function createCommission(
  _prev: ActionState | undefined,
  _formData: FormData,
): Promise<ActionState> {
  throw new Error(NOT_IMPLEMENTED)
}
