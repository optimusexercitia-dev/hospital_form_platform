'use server'

import type { ActionState } from '@/lib/safety/types'

/**
 * NSP / PQS roster-curation + per-org config server actions (NSP-per-org, sub-phase
 * A; ADR 0042) — CONTRACT STUBS.
 *
 * The PQS roster is PER-ORG: enrollment in an org's roster (`pqs_members`, now keyed
 * `(organization_id, user_id)`) grants that org's PHI read. A dedicated per-org
 * `nsp_coordinator` grant CURATES the roster; `org_admin` only APPOINTS the
 * coordinator (via the org-members surface) and has NO direct roster write — three-way
 * duty separation. A coordinator is NOT implicitly a reader; they enroll explicitly.
 *
 * Every write routes through a SECURITY DEFINER RPC landed by migration
 * `20260630000000_nsp_per_org.sql` (A2/A3); the RPC's coordinator gate (42501 for a
 * non-coordinator) + RLS are the authority. Bodies throw until the migration lands.
 *
 * A `"use server"` module may export ONLY async functions, so the result type is
 * imported from the CLIENT-SAFE `@/lib/safety/types` (`ActionState` — the
 * `useActionState`-shaped result the FE roster UI binds to) and input shapes are
 * primitives. Keep these SIGNATURES stable once posted (contract-first). All
 * user-facing strings are pt-BR; raw Postgres errors never reach the UI.
 */

/**
 * Enroll `userId` into `orgId`'s PQS roster (grants that org's PHI read). Backed by
 * the `add_pqs_member(p_org_id, p_user_id)` DEFINER RPC, gated
 * `is_nsp_coordinator_of(p_org_id)` (42501 otherwise); idempotent (`on conflict do
 * nothing` on the `(org,user)` PK). A coordinator may enroll THEMSELVES here to
 * become a reader (explicit enrollment).
 */
export async function addPqsMember(
  orgId: string,
  userId: string,
): Promise<ActionState> {
  void orgId
  void userId
  throw new Error('not implemented: addPqsMember (NSP-per-org A2/A3)')
}

/**
 * Remove `userId` from `orgId`'s PQS roster (revokes that org's PHI read). Backed by
 * the `remove_pqs_member(p_org_id, p_user_id)` DEFINER RPC, coordinator-gated;
 * deletes by `(org, user)`.
 */
export async function removePqsMember(
  orgId: string,
  userId: string,
): Promise<ActionState> {
  void orgId
  void userId
  throw new Error('not implemented: removePqsMember (NSP-per-org A2/A3)')
}

/**
 * Set the per-org RCA due-window (`pqs_department.rca_default_due_days` for `orgId`)
 * — the days `confirm_triage` adds to the event date to mint an RCA due date. Backed
 * by the `set_pqs_rca_due_window(p_org_id, p_days)` DEFINER RPC (coordinator/member
 * gate; validated 1–365 → HC046; **audited at the ORG tier**, passing
 * `p_organization := p_org_id`). Supersedes the global `setRcaDueWindow(days)` in
 * `@/lib/safety/triage-actions`, which targeted the lone singleton.
 */
export async function setPqsRcaDueWindow(
  orgId: string,
  days: number,
): Promise<ActionState> {
  void orgId
  void days
  throw new Error('not implemented: setPqsRcaDueWindow (NSP-per-org A2/A3)')
}
