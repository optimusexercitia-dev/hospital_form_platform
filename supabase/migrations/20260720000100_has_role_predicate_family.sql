-- ============================================================================
-- MEM-3 · The has_role predicate family + rewrite of every membership-reading
--          predicate to delegate to it (X-β).
--
-- `app.has_role(scope_type, scope_id, role, user_id)` is the ONE source of
-- role-membership truth. Every is_*_of / _for wrapper keeps its EXACT signature
-- (owner=postgres, search_path-pinned, SECURITY DEFINER) so the ~145 call-sites +
-- ~87 policies compile verbatim. `is_active(uid)` STAYS in each wrapper (never
-- folded into has_role) so the active check is never silently dropped.
--
-- Predicates rewritten here (verified against the live catalog — the spec's
-- "27-name" list named is_org_admin_of_commission/_for which DO NOT EXIST; the real
-- combined predicate is is_commission_admin_of/_for). The membership-reading set is:
--   role-delegating wrappers (17): is_member_of(_for), is_staff_admin_of(_for),
--     is_org_admin_of(_for), is_hospital_admin_of(_for), is_nsp_org_admin_of(_for),
--     is_nsp_coordinator_of_for, is_pqs_member_of_for, is_pqs_member_of_any,
--     is_pqs_operator_in_org_for
--   composed/recomposed (also read a membership table today):
--     is_commission_admin_of(_for), is_org_level_admin_within, is_org_member,
--     is_hospital_member_of, is_entitled_document_approver  (← the "missed predicate"
--       risk: reads commission_members, NOT in the spec's wrapper list, MUST repoint)
--   pure delegators (unchanged bodies, delegate to _for): is_nsp_coordinator_of,
--     is_pqs_member_of, is_pqs_operator_of(_for), is_pqs_writer_of,
--     is_pqs_operator_in_org
--
-- Spec: docs/plans/memberships-collapse-s6-1.md §2.2. Binding: Rules 1/8; t19.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- has_role — does a live grant exist for (principal, scope, role)?
-- Carries the reserved expires_at filter (inert until a grant sets it).
-- ----------------------------------------------------------------------------
create or replace function app.has_role(p_scope_type text, p_scope_id uuid, p_role text, p_user_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select exists (
    select 1 from public.memberships m
    where m.principal_id = p_user_id
      and m.role = p_role
      and (m.expires_at is null or m.expires_at > now())
      and case p_scope_type
            when 'organization' then m.organization_id = p_scope_id
            when 'hospital'     then m.hospital_id     = p_scope_id
            when 'commission'   then m.commission_id   = p_scope_id
            else false
          end
  );
$$;

-- 3-arg convenience overload (auth.uid()). InitPlan-wrapped so it is a stable
-- sub-select in policy context (WS-5 pattern).
create or replace function app.has_role(p_scope_type text, p_scope_id uuid, p_role text)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.has_role(p_scope_type, p_scope_id, p_role, (select auth.uid()));
$$;

-- has_role_any — membership = ANY role in the scope (role-less EXISTS). Backs
-- is_member_of (staff ∪ staff_admin ∪ any future commission role).
create or replace function app.has_role_any(p_scope_type text, p_scope_id uuid, p_user_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select exists (
    select 1 from public.memberships m
    where m.principal_id = p_user_id
      and (m.expires_at is null or m.expires_at > now())
      and case p_scope_type
            when 'organization' then m.organization_id = p_scope_id
            when 'hospital'     then m.hospital_id     = p_scope_id
            when 'commission'   then m.commission_id   = p_scope_id
            else false
          end
  );
$$;

-- ============================================================================
-- A · Direct single-role wrappers → has_role 1:1. is_active(uid) STAYS.
-- (select auth.uid()) InitPlan-wrapped in the bare forms.
-- ============================================================================

-- is_member_of — membership = ANY commission role.
create or replace function app.is_member_of(p_commission_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active((select auth.uid()))
     and app.has_role_any('commission', p_commission_id, (select auth.uid()));
$$;
create or replace function app.is_member_of_for(p_commission_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id)
     and app.has_role_any('commission', p_commission_id, p_user_id);
$$;

create or replace function app.is_staff_admin_of(p_commission_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active((select auth.uid()))
     and app.has_role('commission', p_commission_id, 'staff_admin', (select auth.uid()));
$$;
create or replace function app.is_staff_admin_of_for(p_commission_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id)
     and app.has_role('commission', p_commission_id, 'staff_admin', p_user_id);
$$;

create or replace function app.is_org_admin_of(p_org_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active((select auth.uid()))
     and app.has_role('organization', p_org_id, 'org_admin', (select auth.uid()));
$$;
create or replace function app.is_org_admin_of_for(p_org_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id)
     and app.has_role('organization', p_org_id, 'org_admin', p_user_id);
$$;

create or replace function app.is_hospital_admin_of(p_hospital_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active((select auth.uid()))
     and app.has_role('hospital', p_hospital_id, 'hospital_admin', (select auth.uid()));
$$;
create or replace function app.is_hospital_admin_of_for(p_hospital_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id)
     and app.has_role('hospital', p_hospital_id, 'hospital_admin', p_user_id);
$$;

create or replace function app.is_nsp_org_admin_of(p_org_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_nsp_org_admin_of_for(p_org_id, (select auth.uid()));
$$;
create or replace function app.is_nsp_org_admin_of_for(p_org_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id)
     and app.has_role('organization', p_org_id, 'nsp_org_admin', p_user_id);
$$;

-- is_nsp_coordinator_of (bare) UNCHANGED: still delegates to _for.
create or replace function app.is_nsp_coordinator_of_for(p_hospital_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id)
     and app.has_role('hospital', p_hospital_id, 'nsp_coordinator', p_user_id);
$$;

-- is_pqs_member_of (bare) UNCHANGED: delegates to _for.
create or replace function app.is_pqs_member_of_for(p_hospital_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id)
     and app.has_role('hospital', p_hospital_id, 'pqs_member', p_user_id);
$$;

create or replace function app.is_pqs_member_of_any(p_user_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id)
     and exists (
       select 1 from public.memberships
       where principal_id = p_user_id and role = 'pqs_member'
         and (expires_at is null or expires_at > now())
     );
$$;

-- ============================================================================
-- B · Composed / recomposed wrappers. is_pqs_operator_of(_for) / is_pqs_writer_of
--     already compose over the A-wrappers → their bodies are UNCHANGED (they now
--     resolve through has_role transitively). Only the ones that TODAY query a
--     membership table directly are rewritten below.
-- ============================================================================

-- is_pqs_operator_of (bare) — InitPlan alignment (QA m2): every MEM-rewritten wrapper
-- carries the WS-5 `(select auth.uid())` InitPlan wrap; the incumbent bare form used a
-- bare auth.uid(). Behavior-identical; just makes it a stable sub-select in the
-- tightened SELECTs this predicate appears in. Owner=postgres + search_path pin
-- preserved by CREATE OR REPLACE.
create or replace function app.is_pqs_operator_of(p_hospital_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_pqs_operator_of_for(p_hospital_id, (select auth.uid()));
$$;

-- is_commission_admin_of — org_admin of the commission's org OR hospital_admin of
-- its hospital. Was a direct organization_members join; recompose over has_role via
-- the commissions FK (resolve org + hospital, then delegate).
create or replace function app.is_commission_admin_of(p_commission_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_commission_admin_of_for(p_commission_id, (select auth.uid()));
$$;
create or replace function app.is_commission_admin_of_for(p_commission_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id) and exists (
    select 1 from public.commissions c
    where c.id = p_commission_id
      and (
        app.has_role('organization', c.organization_id, 'org_admin', p_user_id)
        or app.has_role('hospital', c.hospital_id, 'hospital_admin', p_user_id)
      )
  );
$$;

-- is_org_level_admin_within — hospital_admin OR nsp_org_admin of the org, holding
-- an org-tier grant in it. Was `organization_members ... role in (...)`; note the
-- incumbent matched BOTH by organization_id (nsp_org_admin is org-scoped; but a
-- hospital_admin row carries hospital_id + organization_id). memberships preserves
-- organization_id on hospital-tier rows, so an org-scoped EXISTS reproduces it.
create or replace function app.is_org_level_admin_within(p_org_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active((select auth.uid())) and exists (
    select 1 from public.memberships m
    where m.organization_id = p_org_id
      and m.principal_id = (select auth.uid())
      and m.role in ('hospital_admin', 'nsp_org_admin')
      and (m.expires_at is null or m.expires_at > now())
  );
$$;

-- is_org_member — any commission membership within the org. Was a commission_members
-- × commissions join; recompose over memberships commission-scope rows joined to the
-- org via the commissions FK.
create or replace function app.is_org_member(p_org_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active((select auth.uid())) and exists (
    select 1
    from public.memberships m
    join public.commissions c on c.id = m.commission_id
    where m.commission_id is not null
      and c.organization_id = p_org_id
      and m.principal_id = (select auth.uid())
      and (m.expires_at is null or m.expires_at > now())
  );
$$;

-- is_hospital_member_of — hospital-tier membership probe (member of any commission
-- in the hospital). Was commission_members × commissions.
create or replace function app.is_hospital_member_of(p_hospital_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active((select auth.uid())) and exists (
    select 1
    from public.memberships m
    join public.commissions c on c.id = m.commission_id
    where m.commission_id is not null
      and c.hospital_id = p_hospital_id
      and m.principal_id = (select auth.uid())
      and (m.expires_at is null or m.expires_at > now())
  );
$$;

-- is_pqs_operator_in_org_for — pqs_member of any hospital in the org UNION
-- nsp_coordinator of any hospital in the org (nav-only, PHI-free). Was pqs_members ×
-- hospitals + organization_members; recompose over memberships (both tiers carry
-- organization_id on hospital-tier rows, so a single org-scoped scan suffices).
create or replace function app.is_pqs_operator_in_org_for(p_org_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user_id) and exists (
    select 1 from public.memberships m
    where m.organization_id = p_org_id
      and m.principal_id = p_user_id
      and m.role in ('pqs_member', 'nsp_coordinator')
      and m.hospital_id is not null
      and (m.expires_at is null or m.expires_at > now())
  );
$$;

-- is_entitled_document_approver — MISSED PREDICATE (reads commission_members today,
-- NOT in the spec's wrapper list). Entitlement = member of ANY commission in the
-- hospital. Repoint to memberships commission-scope rows joined via commissions.
create or replace function app.is_entitled_document_approver(p_hospital uuid, p_user uuid)
returns boolean language sql stable security definer
set search_path to 'app', 'public', 'pg_catalog' as $$
  select app.is_active(p_user) and exists (
    select 1
    from public.memberships m
    join public.commissions c on c.id = m.commission_id
    where m.commission_id is not null
      and c.hospital_id = p_hospital
      and m.principal_id = p_user
      and (m.expires_at is null or m.expires_at > now())
  );
$$;

-- ----------------------------------------------------------------------------
-- t19 grant posture on every new function (REVOKE ALL FROM public; GRANT EXECUTE).
-- The is_* wrappers were CREATE OR REPLACE (grants preserved), but has_role /
-- has_role_any are net-new → must set grants explicitly.
-- ----------------------------------------------------------------------------
revoke all on function app.has_role(text, uuid, text, uuid)   from public;
revoke all on function app.has_role(text, uuid, text)         from public;
revoke all on function app.has_role_any(text, uuid, uuid)     from public;
grant execute on function app.has_role(text, uuid, text, uuid) to authenticated, service_role;
grant execute on function app.has_role(text, uuid, text)       to authenticated, service_role;
grant execute on function app.has_role_any(text, uuid, uuid)   to authenticated, service_role;
