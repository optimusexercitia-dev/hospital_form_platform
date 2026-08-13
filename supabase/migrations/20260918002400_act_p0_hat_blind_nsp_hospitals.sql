-- ACT P0 follow-up (ADR 0106) — public.list_my_nsp_hospitals() gains the
-- active-role condition.
--
-- Found auditing session_context()'s CONSUMERS per the coordinator's P0
-- directive following BUG-ACT-HATBLIND-001 (`tester` live-reproduced a
-- dual-hat principal entering `/manage` and `/qualidade` under the WRONG
-- hat; root cause: `partitionGrants` derived the TS session-context fields
-- from the hat-blind `session_context()` grants with no active-role filter
-- — fixed in the SAME deploy as this migration, in
-- `src/lib/queries/session.ts`).
--
-- That TS fix covers every consumer of `getSessionContext()`'s derived
-- fields (`orgAdminOf`, `hospitalAdminOf`, `technicalDirectionOf`,
-- `nspOrgAdminOf`, `qualityReviewerOf`, `nspOperatorOf`, `memberships`) —
-- but it cannot reach an ENTIRELY SEPARATE mechanism: a `SECURITY DEFINER`
-- RPC that queries `public.memberships` directly instead of routing through
-- `app.has_role`/`app.has_role_any` (both hat-gated since Stage 3,
-- migration 20260918002000). Auditing every RPC the session/access-resolver
-- layer calls (`src/lib/queries/session.ts`, `src/lib/queries/pqs.ts`,
-- `src/lib/pqs/org-admin.ts`) turned up exactly ONE such outlier:
--
--   public.list_my_nsp_hospitals() — the `/o/[org]/nsp` console's SOLE
--   entry gate (via `getNspAccessByOrg` -> `listMyNspHospitals` ->
--   `hospitals.length === 0 -> notFound()`, `src/lib/queries/session.ts`).
--   Its body queried `public.memberships` directly (a UNION of the
--   `pqs_member`/`nsp_coordinator` arms), with NO hat check anywhere.
--
-- Every SIBLING PQS/NSP predicate was checked against the live catalog and
-- confirmed ALREADY hat-gated (all delegate through `has_role`, so Stage
-- 3's caller-only condition already covers them for a self-check):
-- `is_pqs_member_of_for`, `is_nsp_coordinator_of_for`,
-- `is_pqs_operator_of_for`, `is_pqs_operator_in_org_for`,
-- `is_nsp_org_admin_of_for` (the last is what makes
-- `src/app/o/[org]/nsp-org/layout.tsx`'s SECOND check safe despite its
-- FIRST check reading the hat-blind-until-this-deploy `context.nspOrgAdminOf`
-- — verified live, not assumed from its comment). `list_my_nsp_hospitals`
-- is the one door that predates the `has_role`-family refactor and was
-- never folded into it — a UNION-and-roll-up shape the boolean predicates
-- don't need.
--
-- Fix: filter each arm's `memberships` row to the caller's ACTIVE hat,
-- exactly like `has_role`'s own caller-only condition. This is a pure
-- caller self-query (no `p_user_id` parameter, always `auth.uid()`
-- internally via the `me` CTE), so — unlike `has_role`, which stays
-- hat-independent for a THIRD-PARTY check — there is no third-party call
-- shape to preserve here; the hat filter applies unconditionally.
--
-- Semantics (confirmed with the coordinator, not assumed): wearing the
-- `pqs_member` hat means this function reports ONLY the caller's
-- `pqs_member` hospitals, not any `nsp_coordinator` hospitals held under a
-- DIFFERENT hat — mirrors "wearing `staff` means `memberships` lists only
-- `staff` commissions" exactly. A caller who holds BOTH roles at the SAME
-- hospital still needs the matching hat active to see it; the `rolled`
-- CTE's `bool_or(is_coord)` collapse is now vacuous within one hat (each
-- hat can only ever contribute one `is_coord` value) but is left in place
-- as the least invasive diff — a future third arm would still need it.
--
-- Keystone: `supabase/tests/315_act_stage3_hat_condition.sql` — confirmed
-- RED before this migration (a multi-role principal wearing a DIFFERENT
-- held hat still saw the `pqs_member` hospital), GREEN after.
create or replace function public.list_my_nsp_hospitals()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  with me as (
    -- QO·FUP F8: the outer activity gate, mirroring every sibling predicate. An
    -- inactive (deactivated or currently suspended) caller resolves to NO rows here,
    -- which collapses both arms below and returns the '[]' safe default.
    select (select auth.uid()) as uid
     where app.is_active((select auth.uid()))
  ),
  grants as (
    select m.hospital_id, false as is_coord
      from public.memberships m
      join me on m.principal_id = me.uid
     where m.role = 'pqs_member'
       and m.hospital_id is not null
       -- QO·FUP F8: an expired enrollment is not an enrollment. `app.has_role` has
       -- always applied this filter; this door never did.
       and (m.expires_at is null or m.expires_at > now())
       -- ACT (ADR 0106) P0: the caller's ACTIVE hat must match this row's role —
       -- the same caller-only condition `has_role` has carried since Stage 3.
       and m.role is not distinct from app.active_role()
    union all
    select m.hospital_id, true as is_coord
      from public.memberships m
      join me on m.principal_id = me.uid
     where m.role = 'nsp_coordinator'
       and m.hospital_id is not null
       and (m.expires_at is null or m.expires_at > now())
       and m.role is not distinct from app.active_role()
  ),
  rolled as (
    select hospital_id, bool_or(is_coord) as is_coord from grants group by hospital_id
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'hospitalId', h.id, 'hospitalName', h.name, 'orgId', h.organization_id,
             'role', case when r.is_coord then 'coordinator' else 'member' end
           ) order by h.name
         ), '[]'::jsonb)
  from rolled r join public.hospitals h on h.id = r.hospital_id;
$function$;
