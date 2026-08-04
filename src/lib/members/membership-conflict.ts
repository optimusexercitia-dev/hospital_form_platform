import type { PostgrestError } from '@supabase/supabase-js'

/**
 * ADR 0094 W1/T1.1 — the one-role-per-commission invariant, as seen from TypeScript.
 *
 * `memberships_one_commission_role_uq` is a partial unique index on
 * `(principal_id, commission_id) WHERE commission_id IS NOT NULL`. It is a DIFFERENT
 * constraint from `memberships_grant_uq` (which includes `role`, and is therefore the
 * one an `onConflict: 'principal_id,role,organization_id,hospital_id,commission_id'`
 * upsert targets). A writer that grants role X to a principal already holding role Y
 * in the same commission does not conflict on the grant key at all — it violates this
 * index, and the raw 23505 escapes as an unhandled error.
 *
 * Matching on the constraint NAME rather than on the bare SQLSTATE is deliberate:
 * `memberships` carries two unique indexes plus several FKs, and swallowing every
 * 23505 would hide a genuine duplicate-grant failure as if it were a benign
 * already-a-member case.
 *
 * PostgREST reports the offending constraint in `message` (and, depending on version,
 * `details`), e.g. `duplicate key value violates unique constraint
 * "memberships_one_commission_role_uq"`, so both fields are checked.
 *
 * Interim by construction: W3 (Package B) routes every one of these writers through
 * the `grant_role` kernel, which applies the replacement semantic in SQL and cannot
 * surface this violation. Delete this module with the last raw-DML caller.
 */
export const ONE_COMMISSION_ROLE_INDEX = 'memberships_one_commission_role_uq'

const PG_UNIQUE_VIOLATION = '23505'

export function isOneCommissionRoleViolation(
  error: Pick<PostgrestError, 'code' | 'message' | 'details'> | null,
): boolean {
  if (!error || error.code !== PG_UNIQUE_VIOLATION) return false
  return `${error.message ?? ''} ${error.details ?? ''}`.includes(
    ONE_COMMISSION_ROLE_INDEX,
  )
}
