# ADR 0075 — Memberships collapse: service-role vs RLS-scoped write-path split

**Status:** Accepted · **Date:** 2026-07-13 · **Track:** S1·MEM (ADR 0071; plan
`docs/plans/memberships-collapse-s6-1.md`). Complements ADR 0041/0051/0052 (write posture).

## Context

MEM collapses `organization_members` / `commission_members` / `pqs_members` into one
`public.memberships` table with a single `grant_role`/`revoke_role` `SECURITY DEFINER`
door and NO direct write RLS policy (WS-1 lockdown posture). The door's authority arms
reuse the incumbent predicates (`is_org_admin_of`, `is_staff_admin_of`,
`is_commission_admin_of`, …), which resolve the caller via `auth.uid()`.

Some incumbent membership writers run over a **service-role** client (`createAdminClient()`)
that deliberately bypasses RLS, having already authorized the caller in TS
(`addStaff`, `assignStaffAdmin`, `assignOrgAdmin`, `registerUser`, `assignMemberCommittee`).
Under a service-role client `auth.uid()` is NULL, so the door's `is_*_of` authority checks
would fail (42501). Other writers run over the **RLS-scoped** cookie client and today rely
on write RLS policies (`removeStaff`, `removeStaffAdmin`) — but `memberships` has no write
policy, so their direct delete would silently no-op.

## Decision

Split the write path by client, preserving byte-for-byte behavior:

1. **Service-role writers** keep a **direct service-role write into `memberships`**
   (RLS-exempt), scope-columns mapped per role, `on conflict (memberships_grant_uq) do
   nothing`. The blanket `trg_audit_memberships` trigger is role-agnostic, so these writes
   stay fully audited (Rule 11). TS-side authorization is unchanged. This is the sanctioned
   pattern the MEM spec §2.5 names for `platform/actions.ts` first-admin provisioning,
   generalized to every service-role membership writer.

2. **RLS-scoped writers** (`removeStaff`, `removeStaffAdmin`, and the already-RPC callers in
   `org/actions.ts` / `pqs/actions.ts`) route through the **`grant_role`/`revoke_role` door**
   over the cookie client, where `auth.uid()` is present and the incumbent authority
   resolves. This is the O-2 change: `removeStaff` moves from a direct RLS delete onto
   `revoke_role`; exported signatures stay frozen.

The invariant holds either way: the `authenticated` role has **no** direct DML grant on
`memberships`, so an ordinary PostgREST client cannot write it (a crafted POST/PATCH/DELETE
→ 401/403). Only (a) the `SECURITY DEFINER` door under a real session, or (b) the RLS-exempt
service-role after TS authorization, can write — and both are audited by the blanket trigger.

## Consequences

- No door authority is widened. The one deliberate **narrowing** (QA m1): `grant_role`'s
  commission arms admit `is_admin()`, but `revoke_role`'s commission arms do NOT — a
  platform_admin cannot revoke a commission membership through the door. This is safe (revoke
  is the narrowing direction; platform_admin is walled off from tenant data per CLAUDE.md §1;
  the sanctioned removers are org-admin-gated in TS), so it is a documented asymmetry, not a
  regression. No service-role writer is forced through a door that its NULL `auth.uid()` would
  fail. Audit coverage is complete regardless of path.
- The pgTAP "no write policy / no authenticated DML grant / direct write rejected" locks
  (spec §6.1/6.2) still pass; the service-role path is out of RLS scope by construction.
- A future move to make service-role writers also call the door would require the door to
  accept an explicit actor param — deliberately NOT done now (keeps the door's self-grant +
  authority model tied to the session actor).

## Addendum — CASCADE collateral (fixed in 20260720000500)

`DROP TABLE commission_members CASCADE` (MEM-5) silently dropped the two `profiles`
SELECT policies (`profiles_select_self_or_admin`, `profiles_admin_select`) because their
`USING` clauses carried a **raw `from public.commission_members` join** (not an `app.is_*`
predicate — those were repointed in place and survived). That left `profiles` with no
SELECT policy, breaking every cross-member / directory / org-hospital-admin profile read.
These are the ONLY two CASCADE victims (verified: all other membership-referencing RLS uses
the `is_*` wrappers). Migration `20260720000500_restore_profiles_select_policies.sql`
recreates both byte-for-byte with the raw joins repointed to `memberships` (commission-scope
rows). **Lesson:** when collapsing a table that other tables' policies join directly, audit
`pg_policies.qual`/`with_check` for raw references before a CASCADE drop.
