-- ============================================================================
-- NSP-per-hospital — re-key the PQS/NSP roster + EVERY PHI door org -> hospital,
-- add nsp_org_admin (org-level, ZERO PHI), make nsp_coordinator a full local
-- operator, widen referral PHI reads to both endpoint hospitals, land
-- dispose_referral_phi.  (Phase B; ADR 0052; partially supersedes ADR 0042.)
--
-- *** NOT ADDITIVE ***  This migration changes the PK of public.pqs_members
-- (organization_id -> hospital_id) and the tenant key of public.pqs_department.
-- It relies on the GREENFIELD RESEED (ADR 0041 dec. 9 / standing pre-launch
-- decision): the reseed truncates + repopulates both tables. There is no in-place
-- row migration.
--
-- SINGLE-HOSPITAL-PER-ORG IS BYTE-IDENTICAL: with one hospital per org the
-- per-hospital term collapses to the per-org term, so the existing 14a-d /
-- referral / patient-index pgTAP suites stay green. The reseed adds a SECOND
-- hospital to org-A only, to make per-hospital isolation provable (pgTAP 189).
--
-- SECURITY-CRITICAL MECHANICAL RE-KEY: a single un-rebound PQS term is a silent
-- cross-HOSPITAL PHI leak. The catalog sweep at the tail (ADR 0042 M2) is the
-- real safeguard: after db reset, ZERO pg_proc / pg_policies references to the
-- dropped per-org resolution symbols (org_of_event / org_of_referral /
-- org_of_capa_action) or a lingering pqs_members.organization_id survive.
--
-- ORDER (create primitives before callers; check_function_bodies off):
--   1. schema (pqs_department + pqs_members re-key)
--   2. predicate primitives + is_pqs_operator_of + is_nsp_org_admin_of
--   3. resolution helpers (hospital_of_*) ; drop org_of_event/referral/capa_action
--   4. read predicates (operator + hospital ; dual-hospital referral)
--   5. write gates / policies (can_write_capa ; lifecycle RPCs ; storage ;
--      pqs_members RLS swap)
--   6. DEFINER doors (pqs_inbox ; dispose_event_phi ; mint_event_code ;
--      patient_xref_count)
--   7. nsp_org_admin PHI-free aggregate doors
--   8. patient_index doors (org -> hospital)
--   9. roster / config + appointment RPCs (three-tier chain)
--  10. dispose_referral_phi
--  11. catalog-sweep assertion
-- ============================================================================

set local check_function_bodies = false;

-- ============================================================================
-- SECTION 1 — SCHEMA: pqs_department + pqs_members re-key org -> hospital.
-- ============================================================================

-- 1a. pqs_department: one row per HOSPITAL (was one per org). The reseed
-- repopulates with per-hospital rows (deliberately different rca_default_due_days
-- per hospital), so add the column nullable, then swap the constraints, then
-- SET NOT NULL after the reseed has run.
alter table public.pqs_department
  add column hospital_id uuid references public.hospitals(id) on delete cascade;

-- Backfill the single existing per-org row to its org's (sole, pre-reseed) hospital
-- so the DDL below is valid even before the reseed truncates. Post-reseed the seed
-- supplies per-hospital rows directly.
update public.pqs_department d
set hospital_id = (
  select h.id from public.hospitals h
  where h.organization_id = d.organization_id
  order by h.created_at, h.id
  limit 1
)
where d.hospital_id is null;

alter table public.pqs_department
  drop constraint if exists pqs_department_organization_id_key;
alter table public.pqs_department
  drop constraint if exists pqs_department_organization_id_fkey;
alter table public.pqs_department
  drop column organization_id;

alter table public.pqs_department
  alter column hospital_id set not null;
alter table public.pqs_department
  add constraint pqs_department_hospital_id_key unique (hospital_id);

-- 1b. pqs_members: PK (organization_id, user_id) -> (hospital_id, user_id). The
-- reseed truncates + repopulates per-hospital, so add nullable, backfill for DDL
-- validity, drop the old PK/FK/column, then set the new PK.
alter table public.pqs_members
  add column hospital_id uuid references public.hospitals(id) on delete cascade;

update public.pqs_members m
set hospital_id = (
  select h.id from public.hospitals h
  where h.organization_id = m.organization_id
  order by h.created_at, h.id
  limit 1
)
where m.hospital_id is null;

-- Drop the old RLS policy that references organization_id BEFORE dropping the
-- column (recreated per-hospital in section 5).
drop policy if exists pqs_members_coordinator_all on public.pqs_members;

-- These two org/commission SELECT policies call is_pqs_member_of / is_nsp_coordinator_of
-- DIRECTLY (passing an ORG id under the per-org shape). They are hard dependents that
-- block the DROP FUNCTION in section 2, so drop them here and recreate per-hospital in
-- section 5 (a per-hospital NSP operator must still resolve their org/commission for
-- navigation).
drop policy if exists organizations_select on public.organizations;
drop policy if exists commissions_select_member_or_admin on public.commissions;
-- The storage writer policy calls is_pqs_writer_of DIRECTLY -> drop before the
-- function drop in section 2 (recreated per-hospital in section 5).
drop policy if exists capa_evidence_obj_insert_writable on storage.objects;

alter table public.pqs_members
  drop constraint if exists pqs_members_pkey;
alter table public.pqs_members
  drop constraint if exists pqs_members_organization_id_fkey;
alter table public.pqs_members
  drop column organization_id;

alter table public.pqs_members
  alter column hospital_id set not null;
alter table public.pqs_members
  add constraint pqs_members_pkey primary key (hospital_id, user_id);
-- Reverse-lookup by user (nav probes, is_pqs_member_of_any, list_my_nsp_hospitals).
create index if not exists pqs_members_user_id_idx on public.pqs_members (user_id);

-- 1c. organization_members.role hospital-scope CHECK: nsp_coordinator moves from the
-- org-level group (hospital_id NULL, Phase A) to the HOSPITAL-scoped group (hospital_id
-- NOT NULL) — a per-hospital coordinator now (decision 12). org_admin + nsp_org_admin
-- stay org-level (NULL). hospital_admin unchanged. Any pre-existing nsp_coordinator
-- rows (Phase-A seed, hospital_id NULL) are repointed to the org's sole (pre-reseed)
-- hospital so the new CHECK validates; the reseed supplies per-hospital rows directly.
update public.organization_members om
set hospital_id = (
  select h.id from public.hospitals h
  where h.organization_id = om.organization_id
  order by h.created_at, h.id
  limit 1
)
where om.role = 'nsp_coordinator' and om.hospital_id is null;

alter table public.organization_members
  drop constraint if exists organization_members_hospital_scope;
alter table public.organization_members
  add constraint organization_members_hospital_scope check (
    (role in ('hospital_admin', 'nsp_coordinator') and hospital_id is not null)
    or (role in ('org_admin', 'nsp_org_admin') and hospital_id is null)
  );

-- ============================================================================
-- SECTION 2 — PREDICATE PRIMITIVES (re-key p_org_id -> p_hospital_id) +
-- is_pqs_operator_of (coordinator OR member, decision 12) + is_nsp_org_admin_of.
-- The arg NAME changes (p_org_id -> p_hospital_id) at the SAME arity, and
-- CREATE OR REPLACE cannot rename an input parameter, so DROP FUNCTION first.
-- Postgres does NOT track function-body -> function dependencies, so dropping a
-- primitive that only appears inside other function BODIES is fine; the only hard
-- dependents are POLICIES that call these directly (dropped in section 1 / recreated
-- in section 5). All new fns: STABLE SECURITY DEFINER, search_path, OWNER postgres,
-- REVOKE FROM PUBLIC + GRANT authenticated/service_role (mirror is_org_admin_of).
-- ============================================================================

-- Primitives (param p_org_id -> p_hospital_id).
drop function if exists app.is_pqs_member_of_for(uuid, uuid);
drop function if exists app.is_pqs_member_of(uuid);
drop function if exists app.is_nsp_coordinator_of_for(uuid, uuid);
drop function if exists app.is_nsp_coordinator_of(uuid);
drop function if exists app.is_pqs_writer_of(uuid);

-- Public RPCs whose arg NAME changes p_org_id -> p_hospital_id at the same arity
-- (same rename constraint). Dropped up front; recreated in their own sections. They
-- are referenced only inside other function BODIES (untracked) or via RPC — no policy
-- dependents — so an early drop is safe.
drop function if exists app.patient_trajectory_bundle(text, text, uuid);
drop function if exists public.add_pqs_member(uuid, uuid);
drop function if exists public.remove_pqs_member(uuid, uuid);
drop function if exists public.list_pqs_members(uuid);
drop function if exists public.set_pqs_rca_due_window(uuid, integer);
drop function if exists public.is_pqs_member_of_self(uuid);
drop function if exists public.is_nsp_coordinator_of_self(uuid);
drop function if exists public.search_patient_xref(text, text, uuid);
drop function if exists public.patient_access_audit(text, text, uuid);

-- is_pqs_member_of_for(hospital, uid): the workhorse. Enrollment in the HOSPITAL's
-- roster grants that hospital's PHI read.
create or replace function app.is_pqs_member_of_for(p_hospital_id uuid, p_user_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.is_active(p_user_id) and exists (
    select 1 from public.pqs_members
    where hospital_id = p_hospital_id and user_id = p_user_id
  );
$$;

create or replace function app.is_pqs_member_of(p_hospital_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.is_pqs_member_of_for(p_hospital_id, auth.uid());
$$;

-- is_nsp_coordinator_of(hospital): the role row now carries hospital_id (Phase A
-- CHECK: hospital_id set iff role in the hospital-scoped set). A coordinator is
-- appointed per hospital.
create or replace function app.is_nsp_coordinator_of_for(p_hospital_id uuid, p_user_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.is_active(p_user_id) and exists (
    select 1 from public.organization_members
    where user_id = p_user_id
      and role = 'nsp_coordinator'
      and hospital_id = p_hospital_id
  );
$$;

create or replace function app.is_nsp_coordinator_of(p_hospital_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.is_nsp_coordinator_of_for(p_hospital_id, auth.uid());
$$;

-- is_pqs_operator_of(hospital): the LOCAL operator = coordinator OR enrolled member
-- (decision 12 — the coordinator is a full local operator: implicit PHI read + NSP
-- write for their hospital). Every PHI read predicate + write gate resolves through
-- this so the OR-term is expressed ONCE (DRY + one primitive for pgTAP to assert).
create or replace function app.is_pqs_operator_of_for(p_hospital_id uuid, p_user_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.is_nsp_coordinator_of_for(p_hospital_id, p_user_id)
      or app.is_pqs_member_of_for(p_hospital_id, p_user_id);
$$;

create or replace function app.is_pqs_operator_of(p_hospital_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.is_pqs_operator_of_for(p_hospital_id, auth.uid());
$$;

-- is_pqs_writer_of(hospital): write authority = the local operator (decision 12).
create or replace function app.is_pqs_writer_of(p_hospital_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.is_pqs_operator_of(p_hospital_id);
$$;

-- is_pqs_operator_in_org(org): does the caller operate (member OR coordinator) ANY
-- hospital in the org? Used only by the org/commission-navigation SELECT policies so a
-- bare NSP operator (no commission membership) can still resolve the org row. PHI-free
-- (navigation visibility only; every PHI door re-gates per hospital).
create or replace function app.is_pqs_operator_in_org_for(p_org_id uuid, p_user_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.is_active(p_user_id) and (
    exists (
      select 1 from public.pqs_members m
      join public.hospitals h on h.id = m.hospital_id
      where h.organization_id = p_org_id and m.user_id = p_user_id
    )
    or exists (
      select 1 from public.organization_members om
      where om.organization_id = p_org_id and om.user_id = p_user_id
        and om.role = 'nsp_coordinator' and om.hospital_id is not null
    )
  );
$$;

create or replace function app.is_pqs_operator_in_org(p_org_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.is_pqs_operator_in_org_for(p_org_id, auth.uid());
$$;

-- is_pqs_member_of_any(uid): UNCHANGED name/body — the pqs_members re-key means it
-- now reads "enrolled in ANY hospital roster" for free (the non-event CAPA fallback +
-- the nav-level probe). No org/hospital arg.
create or replace function app.is_pqs_member_of_any(p_user_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.is_active(p_user_id)
     and exists (select 1 from public.pqs_members where user_id = p_user_id);
$$;

-- is_nsp_org_admin_of(org): NEW. Org-level NSP administration (decision 13) — mirror
-- is_org_admin_of exactly. Curates any hospital's roster + appoints coordinators +
-- reads PHI-FREE aggregates. GRANTS ZERO PHI READ: this predicate appears in NO
-- can_read_* / get_*_patient / PHI door (qa keystone).
create or replace function app.is_nsp_org_admin_of_for(p_org_id uuid, p_user_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.is_active(p_user_id) and exists (
    select 1 from public.organization_members
    where organization_id = p_org_id
      and user_id = p_user_id
      and role = 'nsp_org_admin'
  );
$$;

create or replace function app.is_nsp_org_admin_of(p_org_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.is_nsp_org_admin_of_for(p_org_id, auth.uid());
$$;

alter function app.is_pqs_member_of_for(uuid, uuid) owner to postgres;
alter function app.is_pqs_member_of(uuid) owner to postgres;
alter function app.is_nsp_coordinator_of_for(uuid, uuid) owner to postgres;
alter function app.is_nsp_coordinator_of(uuid) owner to postgres;
alter function app.is_pqs_operator_of_for(uuid, uuid) owner to postgres;
alter function app.is_pqs_operator_of(uuid) owner to postgres;
alter function app.is_pqs_operator_in_org_for(uuid, uuid) owner to postgres;
alter function app.is_pqs_operator_in_org(uuid) owner to postgres;
alter function app.is_pqs_writer_of(uuid) owner to postgres;
alter function app.is_pqs_member_of_any(uuid) owner to postgres;
alter function app.is_nsp_org_admin_of_for(uuid, uuid) owner to postgres;
alter function app.is_nsp_org_admin_of(uuid) owner to postgres;

revoke all on function app.is_pqs_operator_of_for(uuid, uuid) from public;
revoke all on function app.is_pqs_operator_of(uuid) from public;
revoke all on function app.is_pqs_operator_in_org_for(uuid, uuid) from public;
revoke all on function app.is_pqs_operator_in_org(uuid) from public;
revoke all on function app.is_nsp_org_admin_of_for(uuid, uuid) from public;
revoke all on function app.is_nsp_org_admin_of(uuid) from public;
grant execute on function app.is_pqs_operator_of_for(uuid, uuid) to authenticated, service_role;
grant execute on function app.is_pqs_operator_of(uuid) to authenticated, service_role;
grant execute on function app.is_pqs_operator_in_org_for(uuid, uuid) to authenticated, service_role;
grant execute on function app.is_pqs_operator_in_org(uuid) to authenticated, service_role;
grant execute on function app.is_nsp_org_admin_of_for(uuid, uuid) to authenticated, service_role;
grant execute on function app.is_nsp_org_admin_of(uuid) to authenticated, service_role;

-- ============================================================================
-- SECTION 3 — RESOLUTION HELPERS: hospital_of_* (one hop earlier than org_of_*).
-- Create the new helpers, then DROP the per-org resolution helpers that are being
-- fully replaced (org_of_event / org_of_referral / org_of_capa_action). KEEP
-- org_of_commission (used by the nsp_org_admin gate path + org_of_hospital climb).
-- ============================================================================

create or replace function app.hospital_of_commission(p_commission_id uuid)
returns uuid
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select hospital_id from public.commissions where id = p_commission_id;
$$;

create or replace function app.hospital_of_event(p_event_id uuid)
returns uuid
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select c.hospital_id
  from public.patient_safety_event e
  join public.commissions c on c.id = e.reporting_commission_id
  where e.id = p_event_id;
$$;

create or replace function app.hospital_of_referral(p_referral_id uuid)
returns uuid
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select c.hospital_id
  from public.case_referral r
  join public.commissions c on c.id = r.source_commission_id
  where r.id = p_referral_id;
$$;

create or replace function app.hospital_of_capa_action(p_action_id uuid)
returns uuid
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.hospital_of_event(app.event_of_capa(ca.capa_id))
  from public.capa_action ca
  where ca.id = p_action_id;
$$;

alter function app.hospital_of_commission(uuid) owner to postgres;
alter function app.hospital_of_event(uuid) owner to postgres;
alter function app.hospital_of_referral(uuid) owner to postgres;
alter function app.hospital_of_capa_action(uuid) owner to postgres;
revoke all on function app.hospital_of_commission(uuid) from public;
revoke all on function app.hospital_of_event(uuid) from public;
revoke all on function app.hospital_of_referral(uuid) from public;
revoke all on function app.hospital_of_capa_action(uuid) from public;
grant execute on function app.hospital_of_commission(uuid) to authenticated, service_role;
grant execute on function app.hospital_of_event(uuid) to authenticated, service_role;
grant execute on function app.hospital_of_referral(uuid) to authenticated, service_role;
grant execute on function app.hospital_of_capa_action(uuid) to authenticated, service_role;

-- ============================================================================
-- SECTION 4 — READ PREDICATES: swap the PQS term to is_pqs_operator_of + hospital
-- (decision 12), and widen the referral PHI reads to BOTH endpoint hospitals
-- (decision 14). All other arms (member/staff_admin/analyst) preserved verbatim.
-- ============================================================================

create or replace function app.can_read_event(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select exists (
    select 1
    from public.patient_safety_event e
    where e.id = p_event_id
      and (
        app.is_member_of_for(e.current_owner_commission_id, p_user_id)
        or app.is_member_of_for(e.reporting_commission_id, p_user_id)
        or app.is_pqs_operator_of_for(app.hospital_of_event(e.id), p_user_id)
      )
  );
$$;

create or replace function app.can_read_event_patient(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select exists (
    select 1
    from public.patient_safety_event e
    where e.id = p_event_id
      and (
        app.is_pqs_operator_of_for(app.hospital_of_event(e.id), p_user_id)
        or app.is_staff_admin_of_for(e.current_owner_commission_id, p_user_id)
      )
  );
$$;

create or replace function app.can_read_capa(p_capa_id uuid, p_user_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select
    app.is_pqs_operator_of_for(app.hospital_of_event(app.event_of_capa(p_capa_id)), p_user_id)
    or app.can_read_event(app.event_of_capa(p_capa_id), p_user_id);
$$;

create or replace function app.can_write_rca(p_rca_id uuid, p_uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select
    app.is_pqs_operator_of_for(app.hospital_of_event(app.event_of_rca(p_rca_id)), p_uid)
    or exists (
      select 1 from public.rca_members m
      where m.rca_id = p_rca_id and m.user_id = p_uid and m.role <> 'observer'
    );
$$;

create or replace function app.event_current_custodian(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select exists (
    select 1
    from public.patient_safety_event e
    where e.id = p_event_id
      and (
        app.is_pqs_operator_of_for(app.hospital_of_event(e.id), p_user_id)
        or (e.current_owner_kind = 'commission'
            and app.is_staff_admin_of_for(e.current_owner_commission_id, p_user_id))
      )
  );
$$;

-- Referral reads — DUAL-HOSPITAL (decision 14): either endpoint hospital's NSP
-- operator reads the referral. source/target commissions are BOTH NOT NULL at read
-- time (verified against live schema — no draft-stage null guard needed).
create or replace function app.can_read_referral(p_referral_id uuid, p_uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (
        app.is_pqs_operator_of_for(app.hospital_of_commission(r.source_commission_id), p_uid)
        or app.is_pqs_operator_of_for(app.hospital_of_commission(r.target_commission_id), p_uid)
        or app.is_member_of_for(r.source_commission_id, p_uid)
        or app.is_member_of_for(r.target_commission_id, p_uid)
      )
  );
$$;

create or replace function app.can_read_referral_phi(p_referral_id uuid, p_uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select exists (
    select 1
    from public.case_referral r
    where r.id = p_referral_id
      and (
        app.is_pqs_operator_of_for(app.hospital_of_commission(r.source_commission_id), p_uid)
        or app.is_pqs_operator_of_for(app.hospital_of_commission(r.target_commission_id), p_uid)
        or app.is_staff_admin_of_for(r.source_commission_id, p_uid)
        or app.is_staff_admin_of_for(r.target_commission_id, p_uid)
      )
  )
  or app.referral_target_analyst(p_referral_id, p_uid);
$$;

create or replace function app.can_read_xref_row(p_commission_id uuid, p_uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select p_commission_id is not null
     and app.is_pqs_operator_of_for(app.hospital_of_commission(p_commission_id), p_uid);
$$;

-- can_read_case / can_read_case_patient — rewrite ONLY the QPS macro-view term
-- (per-hospital operator); every other case-access arm is preserved verbatim.
create or replace function app.can_read_case(p_case_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  -- QPS macro-view of any referral-touched case — now per-HOSPITAL (the hospital's
  -- NSP operator).
  if app.feature_enabled('case_referrals')
     and app.is_pqs_operator_of_for(app.hospital_of_commission(v_commission), p_uid)
     and exists (
       select 1 from public.case_referral r
       where r.source_case_id = p_case_id or r.target_case_id = p_case_id
     ) then
    return true;
  end if;

  if not app.feature_enabled('case_access') then
    return app.is_member_of_for(v_commission, p_uid)
        or app.is_commission_admin_of_for(v_commission, p_uid);
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or app.is_commission_admin_of_for(v_commission, p_uid)
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid
        and (ca.expires_at is null or ca.expires_at > now())
    )
    or exists (
      select 1 from public.case_phases cp
      where cp.case_id = p_case_id and cp.assigned_to = p_uid
    )
    or exists (
      select 1 from public.case_narratives cn
      where cn.case_id = p_case_id and cn.assigned_to = p_uid
    );
end;
$$;

create or replace function app.can_read_case_patient(p_case_id uuid, p_uid uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  -- QPS macro-view of any referral-touched case — now per-HOSPITAL.
  if app.feature_enabled('case_referrals')
     and app.is_pqs_operator_of_for(app.hospital_of_commission(v_commission), p_uid)
     and exists (
       select 1 from public.case_referral r
       where r.source_case_id = p_case_id or r.target_case_id = p_case_id
     ) then
    return true;
  end if;

  if not app.feature_enabled('case_access') then
    return app.is_member_of_for(v_commission, p_uid);
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid
        and (ca.expires_at is null or ca.expires_at > now())
    )
    or exists (
      select 1 from public.case_phases cp
      where cp.case_id = p_case_id and cp.assigned_to = p_uid
    )
    or exists (
      select 1 from public.case_narratives cn
      where cn.case_id = p_case_id and cn.assigned_to = p_uid
    );
end;
$$;

-- ============================================================================
-- SECTION 5 — WRITE GATES / LIFECYCLE RPCs / STORAGE / pqs_members RLS.
-- ============================================================================

-- can_write_capa: event/rca-sourced -> operator+hospital; non-event (manual/
-- indicator/audit/meeting) -> is_pqs_member_of_any (BUG-NSP-004, unchanged). This is
-- the single consolidation the 8 capa_*_write policies + advance_capa_action_core +
-- assert_capa_writable route through (each auto-corrects — none re-implements the
-- org resolution inline).
create or replace function app.can_write_capa(p_capa_id uuid, p_uid uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select case
    when app.event_of_capa(p_capa_id) is not null
      then app.is_pqs_operator_of_for(app.hospital_of_event(app.event_of_capa(p_capa_id)), p_uid)
    else app.is_pqs_member_of_any(p_uid)
  end;
$$;

-- save_triage: gate -> operator+hospital.
create or replace function public.save_triage(p_event_id uuid, p_is_pse boolean DEFAULT NULL::boolean, p_pse_closure_reason text DEFAULT NULL::text, p_reach text DEFAULT NULL::text, p_harm_severity text DEFAULT NULL::text, p_natural_course boolean DEFAULT NULL::boolean, p_review_pathway text DEFAULT NULL::text, p_disposition_notes_md text DEFAULT NULL::text, p_sentinel_criteria_ids uuid[] DEFAULT '{}'::uuid[])
returns event_triage
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_triage public.event_triage;
  v_reach text := p_reach;
  v_harm text := p_harm_severity;
  v_natural boolean := p_natural_course;
  v_has_designated boolean := coalesce(array_length(p_sentinel_criteria_ids, 1), 0) > 0;
  v_sentinel boolean;
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  -- Triage is an NSP activity (per-hospital operator).
  if not app.is_pqs_operator_of(app.hospital_of_event(p_event_id)) then
    raise exception 'apenas o NSP pode triar eventos' using errcode = '42501';
  end if;

  if (select status from public.patient_safety_event where id = p_event_id) <> 'acknowledged' then
    raise exception 'o evento precisa estar reconhecido pelo NSP para ser triado'
      using errcode = 'HC045';
  end if;

  if v_reach is not null and v_reach not in ('unsafe', 'near_miss', 'no_harm', 'adverse', 'sentinel') then
    raise exception 'alcance inválido' using errcode = 'HC046';
  end if;
  if v_harm is not null and v_harm not in ('none', 'mild', 'moderate', 'severe', 'permanent', 'death') then
    raise exception 'gravidade de dano inválida' using errcode = 'HC046';
  end if;
  if p_review_pathway is not null
     and p_review_pathway not in ('rca', 'peer_review', 'mm', 'fmea', 'tracking_only') then
    raise exception 'desfecho inválido' using errcode = 'HC046';
  end if;

  if p_is_pse is false then
    if p_pse_closure_reason is null
       or p_pse_closure_reason not in ('natural', 'expected', 'nonclinical', 'duplicate') then
      raise exception 'selecione o motivo de encerramento (não é evento de segurança)'
        using errcode = 'HC046';
    end if;
    v_reach := null;
    v_harm := null;
    v_natural := null;
    v_has_designated := false;
    p_sentinel_criteria_ids := '{}';
  end if;

  if coalesce(p_is_pse, true) and v_reach is not null then
    if v_reach in ('unsafe', 'near_miss', 'no_harm') then
      v_harm := 'none';
      v_natural := null;
    elsif v_reach = 'sentinel' then
      if v_harm is null or v_harm in ('none', 'mild', 'moderate') then
        v_harm := 'severe';
      end if;
    end if;
  end if;

  v_sentinel := app.compute_sentinel_determination(v_reach, v_harm, v_natural, v_has_designated);

  perform set_config('app.in_safety_rpc', 'on', true);

  insert into public.event_triage (
    event_id, is_pse, pse_closure_reason, reach, harm_severity, natural_course,
    sentinel_determination, review_pathway, disposition_notes_md, updated_at
  ) values (
    p_event_id, p_is_pse,
    case when p_is_pse is false then p_pse_closure_reason else null end,
    v_reach, v_harm, v_natural, v_sentinel, p_review_pathway, p_disposition_notes_md, now()
  )
  on conflict (event_id) do update
  set is_pse = excluded.is_pse,
      pse_closure_reason = excluded.pse_closure_reason,
      reach = excluded.reach,
      harm_severity = excluded.harm_severity,
      natural_course = excluded.natural_course,
      sentinel_determination = excluded.sentinel_determination,
      review_pathway = excluded.review_pathway,
      disposition_notes_md = excluded.disposition_notes_md,
      updated_at = now()
  returning * into v_triage;

  delete from public.event_triage_sentinel_flags where event_id = p_event_id;
  if v_has_designated then
    insert into public.event_triage_sentinel_flags (event_id, criteria_id, criteria_key, criteria_label)
    select p_event_id, c.id, c.key, c.label
    from public.pqs_sentinel_criteria c
    where c.id = any (p_sentinel_criteria_ids);
  end if;

  perform set_config('app.in_safety_rpc', 'off', true);
  return v_triage;
end;
$function$;

-- confirm_triage: gate -> operator+hospital; pqs_department reader -> per-hospital.
create or replace function public.confirm_triage(p_event_id uuid)
returns event_triage
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_triage public.event_triage;
  v_event public.patient_safety_event;
  v_due_days integer;
  v_anchor date;
  v_pathway text;
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  if not app.is_pqs_operator_of(app.hospital_of_event(p_event_id)) then
    raise exception 'apenas o NSP pode triar eventos' using errcode = '42501';
  end if;

  select * into v_event from public.patient_safety_event where id = p_event_id;
  if v_event.status <> 'acknowledged' then
    raise exception 'a triagem só pode ser confirmada a partir de um evento reconhecido'
      using errcode = 'HC045';
  end if;

  select * into v_triage from public.event_triage where event_id = p_event_id;
  if not found or v_triage.is_pse is null then
    raise exception 'complete a triagem antes de confirmá-la' using errcode = 'HC046';
  end if;

  if v_triage.is_pse = false then
    if v_triage.pse_closure_reason is null then
      raise exception 'selecione o motivo de encerramento' using errcode = 'HC046';
    end if;

    perform set_config('app.in_safety_rpc', 'on', true);
    update public.event_triage
    set review_pathway = null, triaged_by = auth.uid(), triaged_at = now(), updated_at = now()
    where event_id = p_event_id
    returning * into v_triage;

    update public.patient_safety_event
    set status = 'closed', closed_by = auth.uid(), closed_at = now(), updated_at = now()
    where id = p_event_id;
    perform set_config('app.in_safety_rpc', 'off', true);

    return v_triage;
  end if;

  if v_triage.reach is null then
    raise exception 'classifique o alcance do evento antes de confirmar' using errcode = 'HC046';
  end if;

  if v_triage.sentinel_determination then
    if v_triage.review_pathway is not null and v_triage.review_pathway <> 'rca' then
      raise exception 'eventos sentinela exigem RCA — o desfecho não pode ser alterado'
        using errcode = 'HC046';
    end if;
    v_pathway := 'rca';
  else
    v_pathway := coalesce(v_triage.review_pathway, 'peer_review');
    if v_pathway = 'rca' then
      null;
    end if;
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.event_triage
  set review_pathway = v_pathway, triaged_by = auth.uid(), triaged_at = now(), updated_at = now()
  where event_id = p_event_id
  returning * into v_triage;

  update public.patient_safety_event
  set status = 'triaged', updated_at = now()
  where id = p_event_id;

  -- Pathway = rca ⇒ mint the configurable due date from THIS event's HOSPITAL config.
  if v_pathway = 'rca' then
    select rca_default_due_days into v_due_days
    from public.pqs_department where hospital_id = app.hospital_of_event(p_event_id);
    v_due_days := coalesce(v_due_days, 45);
    v_anchor := coalesce(v_event.discovered_at, v_event.reported_at::date);

    insert into public.rca (event_id, status, due_date, created_by)
    values (p_event_id, 'draft', v_anchor + v_due_days, auth.uid())
    on conflict (event_id) do nothing;
  end if;

  perform set_config('app.in_safety_rpc', 'off', true);
  return v_triage;
end;
$function$;

-- reopen_triage: gate -> operator+hospital.
create or replace function public.reopen_triage(p_event_id uuid)
returns event_triage
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_triage public.event_triage;
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  if not app.is_pqs_operator_of(app.hospital_of_event(p_event_id)) then
    raise exception 'apenas o NSP pode reabrir uma triagem' using errcode = '42501';
  end if;

  if (select status from public.patient_safety_event where id = p_event_id) <> 'triaged' then
    raise exception 'apenas uma triagem confirmada pode ser reaberta' using errcode = 'HC045';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.patient_safety_event
  set status = 'acknowledged', updated_at = now()
  where id = p_event_id;

  update public.event_triage
  set triaged_by = null, triaged_at = null, updated_at = now()
  where event_id = p_event_id
  returning * into v_triage;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_triage;
end;
$function$;

-- triage_disposition: read gate unchanged (can_read_event); pqs_department reader
-- -> per-hospital.
create or replace function public.triage_disposition(p_event_id uuid)
returns TABLE(event_id uuid, is_pse boolean, reached boolean, severe boolean, is_sentinel boolean, verdict text, review_pathway text, rca_due_date date)
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_t public.event_triage;
  v_event public.patient_safety_event;
  v_reached boolean;
  v_severe boolean;
  v_verdict text;
  v_pathway text;
  v_due date;
  v_due_days integer;
begin
  if not app.can_read_event(p_event_id, auth.uid()) then
    return;
  end if;

  select * into v_event from public.patient_safety_event where id = p_event_id;
  if not found then
    return;
  end if;

  select * into v_t from public.event_triage where event_triage.event_id = p_event_id;

  v_reached := coalesce(v_t.reach in ('no_harm', 'adverse', 'sentinel'), false);
  v_severe := coalesce(v_t.harm_severity in ('severe', 'permanent', 'death'), false);

  if v_t.is_pse is false then
    v_verdict := 'closed';
    v_pathway := null;
  elsif coalesce(v_t.sentinel_determination, false) then
    v_verdict := 'rca';
    v_pathway := 'rca';
  elsif v_t.reach is not null then
    v_verdict := 'review';
    v_pathway := coalesce(v_t.review_pathway, 'peer_review');
  else
    v_verdict := 'pending';
    v_pathway := null;
  end if;

  if v_verdict = 'rca' then
    select rca_default_due_days into v_due_days
    from public.pqs_department where hospital_id = app.hospital_of_event(p_event_id);
    v_due_days := coalesce(v_due_days, 45);
    v_due := coalesce(v_event.discovered_at, v_event.reported_at::date) + v_due_days;
  end if;

  return query select
    p_event_id, v_t.is_pse, v_reached, v_severe,
    coalesce(v_t.sentinel_determination, false), v_verdict, v_pathway, v_due;
end;
$function$;

-- add_rca_member: bootstrap gate -> operator+hospital OR existing writer.
create or replace function public.add_rca_member(p_rca_id uuid, p_role text, p_user_id uuid DEFAULT NULL::uuid, p_external_name text DEFAULT NULL::text)
returns rca_members
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row public.rca_members;
begin
  perform app.assert_patient_safety_enabled();

  if (select event_id from public.rca where id = p_rca_id) is null then
    raise exception 'análise de causa raiz não encontrada' using errcode = 'no_data_found';
  end if;
  -- Bootstrap: the hospital's NSP operator OR an existing writer may add members.
  if not (app.is_pqs_operator_of(app.hospital_of_event(app.event_of_rca(p_rca_id)))
          or app.can_write_rca(p_rca_id, auth.uid())) then
    raise exception 'você não pode editar esta análise de causa raiz' using errcode = 'HC048';
  end if;

  if p_role not in ('lead', 'facilitator', 'sme', 'reviewer', 'executive_sponsor', 'observer') then
    raise exception 'função inválida' using errcode = 'check_violation';
  end if;
  if not (
    (p_user_id is not null and (p_external_name is null or btrim(p_external_name) = ''))
    or (p_user_id is null and p_external_name is not null and btrim(p_external_name) <> '')
  ) then
    raise exception 'informe um usuário da plataforma OU um nome externo para o integrante'
      using errcode = 'check_violation';
  end if;
  if p_user_id is not null and not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'usuário não encontrado' using errcode = 'no_data_found';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform app.rca_bump_in_progress(p_rca_id);
  insert into public.rca_members (rca_id, user_id, external_name, role)
  values (p_rca_id, p_user_id, case when p_user_id is null then btrim(p_external_name) else null end, p_role)
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_row;
end;
$function$;

-- open_capa_plan: event/rca arm -> operator+hospital; non-event -> any (unchanged).
create or replace function public.open_capa_plan(p_source text, p_classification text DEFAULT 'corretiva'::text, p_source_id uuid DEFAULT NULL::uuid)
returns capa_plan
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_plan public.capa_plan;
  v_attempts int := 0;
  v_rca uuid;
  v_event uuid;
  v_meeting uuid;
  v_indicator uuid;
  v_audit uuid;
  v_src_event uuid;
  v_authorized boolean;
begin
  perform app.assert_patient_safety_enabled();

  if p_source not in ('rca', 'event', 'indicator', 'audit_finding', 'meeting', 'manual') then
    raise exception 'origem de plano inválida' using errcode = 'check_violation';
  end if;
  if coalesce(p_classification, 'corretiva') not in ('corretiva', 'preventiva', 'melhoria') then
    raise exception 'classificação inválida' using errcode = 'check_violation';
  end if;

  if p_source = 'manual' then
    if p_source_id is not null then
      raise exception 'um plano manual não tem origem vinculada' using errcode = 'check_violation';
    end if;
  elsif p_source_id is null then
    raise exception 'informe a origem do plano de ação' using errcode = 'check_violation';
  else
    case p_source
      when 'rca' then v_rca := p_source_id;
      when 'event' then v_event := p_source_id;
      when 'meeting' then v_meeting := p_source_id;
      when 'indicator' then v_indicator := p_source_id;
      when 'audit_finding' then v_audit := p_source_id;
    end case;
  end if;

  -- Authority: per-HOSPITAL operator when the source resolves to an event (event/rca);
  -- any-hospital NSP otherwise (no event PHI). Mirrors can_write_capa's branch.
  v_src_event := case
                   when p_source = 'event' then v_event
                   when p_source = 'rca' then app.event_of_rca(v_rca)
                   else null
                 end;
  if v_src_event is not null then
    v_authorized := app.is_pqs_operator_of(app.hospital_of_event(v_src_event));
  else
    v_authorized := app.is_pqs_member_of_any(auth.uid());
  end if;
  if not v_authorized then
    raise exception 'apenas o NSP pode abrir planos de ação' using errcode = '42501';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  loop
    begin
      insert into public.capa_plan (
        source, source_rca_id, source_event_id, source_meeting_id,
        source_indicator_id, source_audit_finding_id, classification, opened_by
      ) values (
        p_source, v_rca, v_event, v_meeting, v_indicator, v_audit,
        coalesce(p_classification, 'corretiva'), auth.uid()
      )
      returning * into v_plan;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts >= 5 then raise; end if;
    end;
  end loop;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_plan;
end;
$function$;

-- Storage: the one policy with a DIRECT per-org writer term -> per-hospital
-- (seg[1] = event_id). The other 4 nsp/capa evidence + referral-attachment policies
-- ride the rebound can_read_*/can_write_* predicates -> auto-correct.
drop policy if exists capa_evidence_obj_insert_writable on storage.objects;
create policy capa_evidence_obj_insert_writable on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'nsp-evidence'
    and app.is_pqs_writer_of(app.hospital_of_event(((storage.foldername(name))[1])::uuid))
  );

-- advance_capa_action_core: authority routes through can_write_capa (rebound) — NO
-- direct re-key needed. Recreated ONLY to refresh the doc comment (it named the
-- dropped org_of_event, which the catalog sweep flags as a residual per-org symbol
-- even in a comment). Body unchanged.
create or replace function app.advance_capa_action_core(p_action_id uuid, p_status text)
returns capa_action
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_assignee uuid;
  v_capa_id uuid;
  v_uid uuid := auth.uid();
  v_result public.capa_action;
begin
  if p_status not in ('pendente', 'em_andamento', 'concluida', 'cancelada') then
    raise exception 'estado de ação inválido' using errcode = 'check_violation';
  end if;

  select assignee_user_id, capa_id into v_assignee, v_capa_id
  from public.capa_action where id = p_action_id;
  if v_capa_id is null then
    raise exception 'ação % não encontrada', p_action_id using errcode = 'no_data_found';
  end if;

  -- BUG-NSP-004: the PQS arm routes through can_write_capa, which owns the non-event
  -- fallback (event/rca-sourced -> per-HOSPITAL operator; manual/indicator/audit/
  -- meeting -> any-hospital, since a non-event CAPA has no hospital to scope to).
  -- Never re-implements the hospital resolution inline (would risk drift).
  if not (
    (v_assignee is not null and v_assignee = v_uid)
    or app.can_write_capa(v_capa_id, v_uid)
  ) then
    raise exception 'você não pode alterar esta ação corretiva' using errcode = 'HC050';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.capa_action
  set status = p_status,
      completed_at = case when p_status = 'concluida' then coalesce(completed_at, now()) else null end,
      completed_by = case when p_status = 'concluida' then coalesce(completed_by, v_uid) else null end,
      updated_at = now()
  where id = p_action_id
  returning * into v_result;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_result;
end;
$function$;

-- pqs_members RLS: the per-hospital curator door. The hospital's coordinator OR the
-- org's nsp_org_admin may write the roster. (org_admin has NO direct pqs_members
-- write — it only appoints the nsp_org_admin.)
create policy pqs_members_curator_all on public.pqs_members
  for all to authenticated
  using (
    app.is_nsp_org_admin_of(app.org_of_hospital(hospital_id))
    or app.is_nsp_coordinator_of(hospital_id)
  )
  with check (
    app.is_nsp_org_admin_of(app.org_of_hospital(hospital_id))
    or app.is_nsp_coordinator_of(hospital_id)
  );

-- Recreate the org/commission navigation SELECT policies per-hospital (dropped in
-- section 1). The per-org PQS terms become per-hospital operator terms so a bare NSP
-- operator (no commission membership) still resolves their org row + hospital's
-- commissions; the nsp_org_admin resolves its org too. PHI-free navigation visibility
-- (every PHI door re-gates per hospital).
create policy organizations_select on public.organizations
  for select to authenticated
  using (
    app.is_admin()
    or app.is_org_admin_of(id)
    or app.is_org_member(id)
    or app.is_pqs_operator_in_org(id)
    or app.is_nsp_org_admin_of(id)
    or app.is_org_level_admin_within(id)
  );

create policy commissions_select_member_or_admin on public.commissions
  for select to authenticated
  using (
    app.is_member_of(id)
    or app.is_org_admin_of(organization_id)
    or app.is_hospital_admin_of(hospital_id)
    or app.is_pqs_operator_of(hospital_id)
    or app.is_nsp_org_admin_of(organization_id)
  );

-- ============================================================================
-- SECTION 6 — DEFINER DOORS: pqs_inbox (result-scoped to operator hospitals),
-- dispose_event_phi (gate -> operator+hospital), mint_event_code (per-hospital),
-- patient_xref_count (result-scoped per-hospital).
-- ============================================================================

-- pqs_inbox: result set scoped to the caller's OPERATOR hospitals (enrolled member
-- UNION appointed coordinator — decision 12). An operator of Hospital A sees only
-- Hospital A events.
create or replace function public.pqs_inbox(p_status text DEFAULT NULL::text, p_suspected_harm_level text DEFAULT NULL::text, p_reporting_commission_id uuid DEFAULT NULL::uuid)
returns TABLE(id uuid, code text, title text, status text, suspected_harm_level text, reporting_commission_id uuid, reporting_commission_name text, current_owner_kind text, current_owner_commission_id uuid, case_id uuid, case_number integer, reported_at timestamp with time zone, acknowledged_at timestamp with time zone)
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select
    e.id, e.code, e.title, e.status, e.suspected_harm_level,
    e.reporting_commission_id, rc.name,
    e.current_owner_kind, e.current_owner_commission_id,
    e.case_id, c.case_number,
    e.reported_at, e.acknowledged_at
  from public.patient_safety_event e
  join public.commissions rc on rc.id = e.reporting_commission_id
  left join public.cases c on c.id = e.case_id
  where rc.hospital_id in (
          select hospital_id from public.pqs_members where user_id = auth.uid()
          union
          select hospital_id from public.organization_members
          where user_id = auth.uid() and role = 'nsp_coordinator' and hospital_id is not null
        )
    and (p_status is null or e.status = p_status)
    and (p_suspected_harm_level is null or e.suspected_harm_level = p_suspected_harm_level)
    and (p_reporting_commission_id is null or e.reporting_commission_id = p_reporting_commission_id)
  order by e.reported_at desc;
$function$;

-- dispose_event_phi: gate -> commission-admin OR operator+hospital (was per-org PQS).
-- Body (the null-set + audit) unchanged.
create or replace function public.dispose_event_phi(p_event_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_event public.patient_safety_event;
  v_rca_id uuid;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_patient_safety_enabled();

  -- Gate: the event's-org org_admin/hospital_admin (commission-admin mirror) OR the
  -- event's-HOSPITAL NSP operator. Disposal does NOT read PHI (no
  -- can_read_event_patient). DEFINER bypasses RLS -> re-check.
  if not (app.is_commission_admin_of(app.commission_of_event(p_event_id))
          or app.is_pqs_operator_of(app.hospital_of_event(p_event_id))) then
    raise exception 'apenas um administrador da organização ou o NSP pode descartar dados do paciente'
      using errcode = '42501';
  end if;

  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;

  select * into v_event from public.patient_safety_event where id = p_event_id;
  if v_event.id is null then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;

  if v_event.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste evento já foram descartados'
      using errcode = 'HC056';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform set_config('app.phi_dispose_reason', p_reason, true);

  delete from public.event_patient where event_id = p_event_id;

  update public.patient_safety_event
     set description_md = null
   where id = p_event_id;

  update public.event_triage
     set disposition_notes_md = null
   where event_id = p_event_id;

  select id into v_rca_id from public.rca where event_id = p_event_id;
  if v_rca_id is not null then
    update public.rca
       set what_md = null, expected_md = null, summary_md = null,
           impact = null, scope = null
     where id = v_rca_id;
    update public.rca_factors          set text = v_redacted        where rca_id = v_rca_id;
    update public.rca_root_causes       set text = v_redacted        where rca_id = v_rca_id;
    update public.rca_timeline_entries  set description = v_redacted  where rca_id = v_rca_id;
  end if;

  update public.capa_plan
     set lessons_learned_md = null
   where source_event_id = p_event_id
      or (v_rca_id is not null and source_rca_id = v_rca_id);

  update public.capa_effectiveness ce
     set method_md = null
   where ce.capa_id in (
     select cp.id from public.capa_plan cp
     where cp.source_event_id = p_event_id
        or (v_rca_id is not null and cp.source_rca_id = v_rca_id)
   );

  update public.capa_measure_result cmr
     set note = null
   where cmr.measure_id in (
     select cm.id from public.capa_measure cm
     where cm.capa_id in (
       select cp.id from public.capa_plan cp
       where cp.source_event_id = p_event_id
          or (v_rca_id is not null and cp.source_rca_id = v_rca_id)
     )
   );

  update public.capa_action_task cat
     set description = v_redacted
   where cat.action_id in (
     select ca.id from public.capa_action ca
     where ca.capa_id in (
       select cp.id from public.capa_plan cp
       where cp.source_event_id = p_event_id
          or (v_rca_id is not null and cp.source_rca_id = v_rca_id)
     )
   );

  update public.patient_safety_event
     set has_patient = false,
         phi_disposed_at = now(),
         phi_disposed_by = auth.uid(),
         phi_disposed_reason = p_reason,
         updated_at = now()
   where id = p_event_id;

  perform app.audit_write(
    'event_patient.disposed',
    'event_patient',
    p_event_id,
    v_event.reporting_commission_id,
    'Dados do paciente do evento ' || v_event.code || ' descartados',
    jsonb_build_object('reason', p_reason)
  );

  perform set_config('app.in_safety_rpc', 'off', true);
end;
$function$;

-- mint_event_code: per-HOSPITAL EV-#### (advisory lock key + filter -> hospital).
create or replace function app.mint_event_code()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_next integer;
  v_hospital uuid := app.hospital_of_commission(new.reporting_commission_id);
begin
  -- Per-hospital advisory lock so two hospitals mint concurrently without serializing.
  perform pg_advisory_xact_lock(hashtextextended('pqs:event_code:' || coalesce(v_hospital::text, ''), 0));

  -- Highest existing EV-#### suffix + 1, FILTERED to this hospital's events (so a
  -- hospital cannot infer another's event volume from gaps).
  v_next := coalesce(
    (select max((substring(e.code from 4))::integer)
     from public.patient_safety_event e
     join public.commissions c on c.id = e.reporting_commission_id
     where e.code ~ '^EV-[0-9]+$'
       and c.hospital_id = v_hospital),
    0
  ) + 1;

  new.code := 'EV-' || lpad(v_next::text, 4, '0');
  return new;
end;
$function$;

-- patient_xref_count: referral arm rides can_read_referral_phi (rebound); count
-- scope -> per-hospital.
create or replace function public.patient_xref_count(p_module text, p_entity_id uuid)
returns integer
language plpgsql
stable security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_patient_key text;
  v_hospital uuid;
  v_count integer;
begin
  perform app.assert_patient_index_enabled();

  if p_module is null or p_module not in ('event', 'referral', 'case') then
    return 0;
  end if;

  if p_module = 'referral' then
    if not app.can_read_referral_phi(p_entity_id, auth.uid()) then
      return 0;
    end if;
  else
    return 0;
  end if;

  select patient_key, app.hospital_of_commission(commission_id)
    into v_patient_key, v_hospital
  from public.patient_xref
  where module = p_module and entity_id = p_entity_id;

  if v_patient_key is null then
    return 0;
  end if;

  -- HOSPITAL-SCOPE: count only OTHER non-disposed xref rows in the SAME hospital.
  select count(*)
    into v_count
  from public.patient_xref x
  where x.patient_key = v_patient_key
    and x.disposed_at is null
    and app.hospital_of_commission(x.commission_id) = v_hospital
    and not (x.module = p_module and x.entity_id = p_entity_id);

  return coalesce(v_count, 0);
end;
$function$;

-- capa_kpis: the caller's own hermetic KPI door (no-arg). Re-key the result-set scope
-- org -> HOSPITAL (M3): scope to the union of the caller's OPERATOR hospitals; non-
-- event plans included via the any-fallback (aligned with can_write_capa). Status
-- vocab (aberto/em_execucao/em_verificacao/concluido/cancelado) unchanged.
create or replace function public.capa_kpis()
returns TABLE(open_count integer, in_verification integer, overdue_actions integer, closed_ytd integer)
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_hospitals uuid[] := array(
    select hospital_id from public.pqs_members where user_id = auth.uid()
    union
    select hospital_id from public.organization_members
    where user_id = auth.uid() and role = 'nsp_coordinator' and hospital_id is not null
  );
  v_any boolean := app.is_pqs_member_of_any(auth.uid())
                   or exists (select 1 from public.organization_members
                              where user_id = auth.uid() and role = 'nsp_coordinator'
                                and hospital_id is not null);
begin
  return query
  with in_scope as (
    select p.*
    from public.capa_plan p
    where v_any  -- gate: an operator of any hospital (else empty)
      and (
        -- event/rca-sourced → must be one of the caller's operator hospitals;
        -- non-event-sourced (event-hospital NULL) → included (any-fallback, mirrors
        -- can_write_capa).
        app.hospital_of_event(app.event_of_capa(p.id)) is null
        or app.hospital_of_event(app.event_of_capa(p.id)) = any(v_hospitals)
      )
  )
  select
    coalesce(count(*) filter (where status in ('aberto', 'em_execucao', 'em_verificacao')), 0)::int,
    coalesce(count(*) filter (where status = 'em_verificacao'), 0)::int,
    coalesce((
      select count(*)
      from public.capa_action a
      join in_scope isp on isp.id = a.capa_id
      where a.due_date < current_date and a.status not in ('concluida', 'cancelada')
    ), 0)::int,
    coalesce(count(*) filter (
      where status = 'concluido' and closed_at >= date_trunc('year', current_date)
    ), 0)::int
  from in_scope;
end;
$function$;

-- ============================================================================
-- SECTION 7 — nsp_org_admin PHI-FREE aggregate doors (decision 13). New public
-- DEFINER RPCs, gated is_nsp_org_admin_of(p_org_id), result set scoped to the org's
-- hospitals (M3). Every SELECT list is PROVABLY PHI-FREE: hospital identity (staff-
-- facing) + integer counts / status buckets ONLY — never a patient column, event
-- code/title, narrative, or free text (qa keystone). REVOKE FROM PUBLIC + GRANT.
-- ============================================================================

-- Per-hospital EVENT rollup: counts by triage status + suspected-harm band. NO
-- patient column, event code, title, or narrative.
create or replace function public.nsp_org_event_rollup(p_org_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_result jsonb;
begin
  if not app.is_nsp_org_admin_of(p_org_id) then
    raise exception 'apenas o administrador de NSP da organização pode ver este relatório'
      using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_obj order by hospital_name), '[]'::jsonb)
    into v_result
  from (
    select
      jsonb_build_object(
        'hospitalId', h.id,
        'hospitalName', h.name,
        'total', count(e.id),
        'byStatus', coalesce(
          (select jsonb_object_agg(s.status, s.n)
           from (select e2.status, count(*) n
                 from public.patient_safety_event e2
                 join public.commissions c2 on c2.id = e2.reporting_commission_id
                 where c2.hospital_id = h.id
                 group by e2.status) s), '{}'::jsonb),
        'byHarm', coalesce(
          (select jsonb_object_agg(coalesce(hb.suspected_harm_level, 'unclassified'), hb.n)
           from (select e3.suspected_harm_level, count(*) n
                 from public.patient_safety_event e3
                 join public.commissions c3 on c3.id = e3.reporting_commission_id
                 where c3.hospital_id = h.id
                 group by e3.suspected_harm_level) hb), '{}'::jsonb)
      ) as row_obj,
      h.name as hospital_name
    from public.hospitals h
    left join public.commissions c on c.hospital_id = h.id
    left join public.patient_safety_event e on e.reporting_commission_id = c.id
    where h.organization_id = p_org_id  -- M3: result set scoped to the org's hospitals
    group by h.id, h.name
  ) agg;

  return v_result;
end;
$function$;

-- Per-hospital CAPA rollup: open / overdue / closed counts. NO plan id,
-- lessons-learned, or action description. Event-sourced plans resolve to a hospital;
-- non-event plans (PHI-free) are counted org-wide under an 'unscoped' pseudo-row.
create or replace function public.nsp_org_capa_rollup(p_org_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_result jsonb;
begin
  if not app.is_nsp_org_admin_of(p_org_id) then
    raise exception 'apenas o administrador de NSP da organização pode ver este relatório'
      using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'hospitalId', h.id,
             'hospitalName', h.name,
             'open', coalesce(cnt.open_n, 0),
             'overdue', coalesce(cnt.overdue_n, 0),
             'closed', coalesce(cnt.closed_n, 0)
           ) order by h.name
         ), '[]'::jsonb)
    into v_result
  from public.hospitals h
  left join lateral (
    select
      count(*) filter (where p.status in ('aberto', 'em_execucao', 'em_verificacao')) as open_n,
      count(*) filter (where p.status = 'concluido') as closed_n,
      count(*) filter (where exists (
        select 1 from public.capa_action a
        where a.capa_id = p.id
          and a.due_date < current_date
          and a.status not in ('concluida', 'cancelada')
      )) as overdue_n
    from public.capa_plan p
    where app.hospital_of_event(app.event_of_capa(p.id)) = h.id
  ) cnt on true
  where h.organization_id = p_org_id;  -- M3: scoped to the org's hospitals

  return v_result;
end;
$function$;

-- Per-hospital NSP ROSTER + coordinator: STAFF identity only (never patient). The
-- nsp_org_admin curates rosters org-wide but reads ZERO PHI.
create or replace function public.nsp_org_roster(p_org_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_result jsonb;
begin
  if not app.is_nsp_org_admin_of(p_org_id) then
    raise exception 'apenas o administrador de NSP da organização pode ver a equipe'
      using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'hospitalId', h.id,
             'hospitalName', h.name,
             'coordinator', (
               select jsonb_build_object('userId', pc.id, 'fullName', pc.full_name, 'email', pc.email)
               from public.organization_members om
               join public.profiles pc on pc.id = om.user_id
               where om.organization_id = p_org_id
                 and om.role = 'nsp_coordinator'
                 and om.hospital_id = h.id
               order by pc.full_name
               limit 1
             ),
             'members', coalesce((
               select jsonb_agg(
                        jsonb_build_object(
                          'userId', pm.user_id,
                          'fullName', pr.full_name,
                          'email', pr.email,
                          'addedAt', pm.added_at,
                          'addedBy', pm.added_by
                        ) order by pr.full_name)
               from public.pqs_members pm
               join public.profiles pr on pr.id = pm.user_id
               where pm.hospital_id = h.id
             ), '[]'::jsonb)
           ) order by h.name
         ), '[]'::jsonb)
    into v_result
  from public.hospitals h
  where h.organization_id = p_org_id;  -- M3: scoped to the org's hospitals

  return v_result;
end;
$function$;

-- The org NSP-admin console entry probe (safe-default via the FE reader).
create or replace function public.is_nsp_org_admin_of_self(p_org_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.is_nsp_org_admin_of(p_org_id);
$function$;

revoke all on function public.nsp_org_event_rollup(uuid) from public;
revoke all on function public.nsp_org_capa_rollup(uuid) from public;
revoke all on function public.nsp_org_roster(uuid) from public;
revoke all on function public.is_nsp_org_admin_of_self(uuid) from public;
grant execute on function public.nsp_org_event_rollup(uuid) to authenticated, service_role;
grant execute on function public.nsp_org_capa_rollup(uuid) to authenticated, service_role;
grant execute on function public.nsp_org_roster(uuid) to authenticated, service_role;
grant execute on function public.is_nsp_org_admin_of_self(uuid) to authenticated, service_role;

-- ============================================================================
-- SECTION 8 — patient_index doors: org -> hospital (gate = operator; result set +
-- audit tier = hospital). patient_trajectory_bundle keeps its service_role-ONLY
-- grant (M1: an internal helper; its 3 DEFINER callers gate first).
-- ============================================================================

create or replace function app.patient_trajectory_bundle(p_patient_key text, p_encounter_key text, p_hospital_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_entries jsonb;
  v_count integer;
  v_any_patient boolean;
  v_any_encounter boolean;
begin
  if p_patient_key is null and p_encounter_key is null then
    return jsonb_build_object('matchedOn', null, 'matchCount', 0, 'entries', '[]'::jsonb);
  end if;

  with matched as (
    select
      x.module,
      x.entity_id,
      x.commission_id,
      x.disposed_at,
      x.created_at,
      (p_patient_key is not null and x.patient_key = p_patient_key) as by_patient,
      (p_encounter_key is not null and x.encounter_key = p_encounter_key) as by_encounter
    from public.patient_xref x
    where ((p_patient_key is not null and x.patient_key = p_patient_key)
        or (p_encounter_key is not null and x.encounter_key = p_encounter_key))
      -- HOSPITAL SCOPE: only this hospital's xref rows (no cross-hospital union for a
      -- multi-hospital operator).
      and app.hospital_of_commission(x.commission_id) = p_hospital_id
  ),
  resolved as (
    select
      m.module,
      m.entity_id,
      m.commission_id,
      coalesce(c.name, null) as commission_name,
      app.patient_match_basis(m.by_patient, m.by_encounter) as matched_on,
      (m.disposed_at is not null) as disposed,
      m.disposed_at,
      m.created_at,
      case m.module
        when 'event' then (select e.code from public.patient_safety_event e where e.id = m.entity_id)
        when 'referral' then (select r.code from public.case_referral r where r.id = m.entity_id)
        when 'case' then (select 'Caso ' || cs.case_number::text from public.cases cs where cs.id = m.entity_id)
      end as entity_code,
      m.by_patient,
      m.by_encounter
    from matched m
    left join public.commissions c on c.id = m.commission_id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'module', module,
      'entityId', entity_id,
      'entityCode', coalesce(entity_code, '—'),
      'commissionId', commission_id,
      'commissionName', commission_name,
      'matchedOn', matched_on,
      'disposed', disposed,
      'disposedAt', disposed_at,
      'createdAt', created_at
    ) order by created_at desc), '[]'::jsonb),
    count(*),
    bool_or(by_patient),
    bool_or(by_encounter)
  into v_entries, v_count, v_any_patient, v_any_encounter
  from resolved;

  return jsonb_build_object(
    'matchedOn', app.patient_match_basis(coalesce(v_any_patient, false), coalesce(v_any_encounter, false)),
    'matchCount', coalesce(v_count, 0),
    'entries', v_entries
  );
end;
$function$;

-- Preserve the M1 grant posture: service_role ONLY (its 3 DEFINER callers gate).
revoke all on function app.patient_trajectory_bundle(text, text, uuid) from public;
revoke all on function app.patient_trajectory_bundle(text, text, uuid) from authenticated;
grant execute on function app.patient_trajectory_bundle(text, text, uuid) to service_role;

-- search_patient_xref: gate operator+hospital; audit patient.searched at the HOSPITAL
-- tier (derive org from hospital; pass hospital -> hospital chain).
create or replace function public.search_patient_xref(p_mrn text DEFAULT NULL::text, p_encounter text DEFAULT NULL::text, p_hospital_id uuid DEFAULT NULL::uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_patient_key text;
  v_encounter_key text;
  v_bundle jsonb;
  v_count integer;
  v_audit_key text;
begin
  perform app.assert_patient_index_enabled();

  -- Duty separation + HOSPITAL scope: must OPERATE this hospital's NSP (member OR
  -- coordinator). A non-operator (incl. another hospital's operator, or a non-PQS
  -- admin) gets the empty bundle.
  if p_hospital_id is null or not app.is_pqs_operator_of(p_hospital_id) then
    return jsonb_build_object('matchedOn', null, 'matchCount', 0, 'entries', '[]'::jsonb);
  end if;

  v_patient_key := app.derive_patient_key(p_mrn);
  v_encounter_key := app.derive_patient_key(p_encounter);

  if v_patient_key is null and v_encounter_key is null then
    return jsonb_build_object('matchedOn', null, 'matchCount', 0, 'entries', '[]'::jsonb);
  end if;

  v_bundle := app.patient_trajectory_bundle(v_patient_key, v_encounter_key, p_hospital_id);
  v_count := coalesce((v_bundle ->> 'matchCount')::integer, 0);

  if v_count >= 1 then
    v_audit_key := coalesce(v_patient_key, v_encounter_key);
    perform app.audit_write(
      'patient.searched', 'patient', app.patient_key_to_uuid(v_audit_key), null,
      'Pesquisa de paciente entre comissões (' || v_count::text || ' registro(s))',
      jsonb_build_object('patient_key', left(v_audit_key, 12) || '…', 'matches', v_count),
      app.org_of_hospital(p_hospital_id), p_hospital_id  -- org + hospital -> hospital chain
    );
  end if;

  return v_bundle;
end;
$function$;

-- get_patient_trajectory_for_entity: entity pins the hospital SERVER-SIDE; gate
-- operator+hospital; audit patient.viewed at the HOSPITAL tier.
create or replace function public.get_patient_trajectory_for_entity(p_module text, p_entity_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_patient_key text;
  v_encounter_key text;
  v_commission uuid;
  v_hospital uuid;
  v_bundle jsonb;
  v_count integer;
  v_audit_key text;
begin
  perform app.assert_patient_index_enabled();

  if p_module is null or p_module not in ('event', 'referral', 'case') then
    raise exception 'módulo inválido' using errcode = 'check_violation';
  end if;

  select patient_key, encounter_key, commission_id
    into v_patient_key, v_encounter_key, v_commission
  from public.patient_xref
  where module = p_module and entity_id = p_entity_id;

  if v_patient_key is null and v_encounter_key is null then
    return jsonb_build_object('matchedOn', null, 'matchCount', 0, 'entries', '[]'::jsonb);
  end if;

  v_hospital := app.hospital_of_commission(v_commission);
  -- HOSPITAL scope + duty separation: must OPERATE the pivot entity's hospital.
  if v_hospital is null or not app.is_pqs_operator_of(v_hospital) then
    return jsonb_build_object('matchedOn', null, 'matchCount', 0, 'entries', '[]'::jsonb);
  end if;

  v_bundle := app.patient_trajectory_bundle(v_patient_key, v_encounter_key, v_hospital);
  v_count := coalesce((v_bundle ->> 'matchCount')::integer, 0);

  if v_count >= 1 then
    v_audit_key := coalesce(v_patient_key, v_encounter_key);
    perform app.audit_write(
      'patient.viewed', 'patient', p_entity_id, null,
      'Trajetória de paciente aberta a partir de um registro (' || v_count::text || ' registro(s))',
      jsonb_build_object('patient_key', left(v_audit_key, 12) || '…', 'matches', v_count),
      app.org_of_hospital(v_hospital), v_hospital  -- hospital chain
    );
  end if;

  return v_bundle;
end;
$function$;

-- patient_access_audit: gate operator+hospital; entity subquery scoped per-hospital;
-- audit-row filter narrowed to audit_log.hospital_id = p_hospital_id (Q5 — the
-- Phase-A 4-tier chain stamps hospital_id on every commission-tier row, so
-- hospital-tier isolation is exact; a foreign-hospital operator gets ZERO rows).
create or replace function public.patient_access_audit(p_mrn text DEFAULT NULL::text, p_encounter text DEFAULT NULL::text, p_hospital_id uuid DEFAULT NULL::uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_patient_key text;
  v_encounter_key text;
  v_rows jsonb;
begin
  perform app.assert_patient_index_enabled();

  if p_hospital_id is null or not app.is_pqs_operator_of(p_hospital_id) then
    return '[]'::jsonb;
  end if;

  v_patient_key := app.derive_patient_key(p_mrn);
  v_encounter_key := app.derive_patient_key(p_encounter);
  if v_patient_key is null and v_encounter_key is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id,
           'occurredAt', a.occurred_at,
           'actorId', a.actor_id,
           'actorName', pr.full_name,
           'action', a.action,
           'entityType', a.entity_type,
           'entityId', a.entity_id,
           'commissionId', a.commission_id,
           'commissionName', c.name
         ) order by a.occurred_at desc), '[]'::jsonb)
    into v_rows
  from public.audit_log a
  left join public.profiles pr on pr.id = a.actor_id
  left join public.commissions c on c.id = a.commission_id
  where a.hospital_id = p_hospital_id  -- HOSPITAL scope on the audit tier (Q5)
    and a.entity_id in (
      select x.entity_id
      from public.patient_xref x
      where ((v_patient_key is not null and x.patient_key = v_patient_key)
          or (v_encounter_key is not null and x.encounter_key = v_encounter_key))
        and app.hospital_of_commission(x.commission_id) = p_hospital_id  -- HOSPITAL scope on xref
    );

  return v_rows;
end;
$function$;

-- ============================================================================
-- SECTION 9 — ROSTER / CONFIG + APPOINTMENT RPCs (three-tier chain) + nav probes.
-- Drop the old per-org (arity-identical but org-semantic) signatures then recreate
-- per-hospital. Gate: the hospital's nsp_coordinator OR the org's nsp_org_admin.
-- ============================================================================

-- add_pqs_member(hospital, user): curator gate.
create or replace function public.add_pqs_member(p_hospital_id uuid, p_user_id uuid)
returns pqs_members
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_row public.pqs_members;
begin
  if not (app.is_nsp_org_admin_of(app.org_of_hospital(p_hospital_id))
          or app.is_nsp_coordinator_of(p_hospital_id)) then
    raise exception 'apenas o coordenador do NSP do hospital ou o administrador de NSP da organização pode gerenciar a equipe'
      using errcode = '42501';
  end if;
  insert into public.pqs_members (hospital_id, user_id, added_by)
  values (p_hospital_id, p_user_id, auth.uid())
  on conflict (hospital_id, user_id) do nothing;
  select * into v_row from public.pqs_members
    where hospital_id = p_hospital_id and user_id = p_user_id;
  return v_row;
end;
$function$;

-- remove_pqs_member(hospital, user): curator gate.
create or replace function public.remove_pqs_member(p_hospital_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  if not (app.is_nsp_org_admin_of(app.org_of_hospital(p_hospital_id))
          or app.is_nsp_coordinator_of(p_hospital_id)) then
    raise exception 'apenas o coordenador do NSP do hospital ou o administrador de NSP da organização pode gerenciar a equipe'
      using errcode = '42501';
  end if;
  delete from public.pqs_members
    where hospital_id = p_hospital_id and user_id = p_user_id;
end;
$function$;

-- list_pqs_members(hospital): curator gate.
create or replace function public.list_pqs_members(p_hospital_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_result jsonb;
begin
  if not (app.is_nsp_org_admin_of(app.org_of_hospital(p_hospital_id))
          or app.is_nsp_coordinator_of(p_hospital_id)) then
    raise exception 'apenas o coordenador do NSP do hospital ou o administrador de NSP da organização pode listar a equipe'
      using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'userId', m.user_id,
             'fullName', p.full_name,
             'email', p.email,
             'addedAt', m.added_at,
             'addedBy', m.added_by
           )
           order by p.full_name
         ), '[]'::jsonb)
    into v_result
    from public.pqs_members m
    join public.profiles p on p.id = m.user_id
    where m.hospital_id = p_hospital_id;
  return v_result;
end;
$function$;

-- set_pqs_rca_due_window(hospital, days): curator gate; audit at the HOSPITAL tier
-- (Q/§R.3 — pass p_organization + p_hospital, no commission -> hospital chain).
create or replace function public.set_pqs_rca_due_window(p_hospital_id uuid, p_days integer)
returns integer
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_old integer;
  v_id uuid;
begin
  perform app.assert_patient_safety_enabled();
  if not (app.is_nsp_org_admin_of(app.org_of_hospital(p_hospital_id))
          or app.is_nsp_coordinator_of(p_hospital_id)
          or app.is_pqs_member_of(p_hospital_id)) then
    raise exception 'apenas o NSP pode configurar a janela de RCA' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'a janela de RCA deve estar entre 1 e 365 dias' using errcode = 'HC046';
  end if;

  select id, rca_default_due_days into v_id, v_old
  from public.pqs_department where hospital_id = p_hospital_id;
  if v_id is null then
    raise exception 'NSP não configurado' using errcode = 'P0002';
  end if;

  update public.pqs_department
  set rca_default_due_days = p_days, updated_at = now()
  where id = v_id;

  -- Audit at the HOSPITAL tier (Phase-A 4-tier chain). PHI-free integer.
  perform app.audit_write('pqs_config.rca_due_window_changed', 'pqs_department', v_id, null,
    'Janela de RCA do NSP definida para ' || p_days || ' dias',
    jsonb_build_object('rca_default_due_days',
      jsonb_build_object('old', v_old, 'new', p_days)),
    app.org_of_hospital(p_hospital_id), p_hospital_id);

  return p_days;
end;
$function$;

-- list_hospital_eligible_users_for_pqs(hospital): curator gate; union of the
-- hospital's org members (assembled DEFINER-side).
create or replace function public.list_hospital_eligible_users_for_pqs(p_hospital_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_result jsonb;
  v_org uuid := app.org_of_hospital(p_hospital_id);
begin
  if not (app.is_nsp_org_admin_of(v_org)
          or app.is_nsp_coordinator_of(p_hospital_id)) then
    raise exception 'apenas o coordenador do NSP ou o administrador de NSP da organização pode listar os usuários elegíveis'
      using errcode = '42501';
  end if;
  with eligible as (
    select om.user_id
    from public.organization_members om
    where om.organization_id = v_org
    union
    select cm.user_id
    from public.commission_members cm
    join public.commissions c on c.id = cm.commission_id
    where c.organization_id = v_org
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'userId', p.id,
             'fullName', p.full_name,
             'email', p.email
           )
           order by p.full_name
         ), '[]'::jsonb)
    into v_result
    from eligible e
    join public.profiles p on p.id = e.user_id;
  return v_result;
end;
$function$;

-- list_org_eligible_users(org): ORG-WIDE eligible-user pool (org-level ∪ commission
-- members of ANY hospital in the org) — the appointment-page picker for ORG-LEVEL
-- roles (nsp_org_admin, hospital_admin). Gated org_admin OR nsp_org_admin of the org.
-- Distinct from list_hospital_eligible_users_for_pqs (per-hospital roster pool): this
-- includes org-level-only users (no commission membership), which the per-hospital
-- reader would miss. DEFINER assembles the union (an org_admin can't read
-- commission_members of every commission under RLS).
create or replace function public.list_org_eligible_users(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_result jsonb;
begin
  if not (app.is_org_admin_of(p_org_id) or app.is_nsp_org_admin_of(p_org_id)) then
    raise exception 'apenas um administrador da organização pode listar os usuários elegíveis'
      using errcode = '42501';
  end if;
  with eligible as (
    select om.user_id
    from public.organization_members om
    where om.organization_id = p_org_id
    union
    select cm.user_id
    from public.commission_members cm
    join public.commissions c on c.id = cm.commission_id
    where c.organization_id = p_org_id
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'userId', p.id,
             'fullName', p.full_name,
             'email', p.email
           )
           order by p.full_name
         ), '[]'::jsonb)
    into v_result
    from eligible e
    join public.profiles p on p.id = e.user_id;
  return v_result;
end;
$function$;

-- Nav probes re-keyed to hospital (FE safe-default readers).
create or replace function public.is_pqs_member_of_self(p_hospital_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.is_pqs_member_of(p_hospital_id);
$function$;

create or replace function public.is_nsp_coordinator_of_self(p_hospital_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select app.is_nsp_coordinator_of(p_hospital_id);
$function$;

-- list_my_nsp_hospitals(): the NSP hospital switcher set (decision 12) — the caller's
-- OPERATOR hospitals (member OR coordinator), with the strongest grant. PHI-free.
create or replace function public.list_my_nsp_hospitals()
returns jsonb
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
  with grants as (
    select hospital_id, false as is_coord from public.pqs_members where user_id = auth.uid()
    union all
    select hospital_id, true as is_coord from public.organization_members
    where user_id = auth.uid() and role = 'nsp_coordinator' and hospital_id is not null
  ),
  rolled as (
    select hospital_id, bool_or(is_coord) as is_coord
    from grants group by hospital_id
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'hospitalId', h.id,
             'hospitalName', h.name,
             'orgId', h.organization_id,
             'role', case when r.is_coord then 'coordinator' else 'member' end
           ) order by h.name
         ), '[]'::jsonb)
  from rolled r
  join public.hospitals h on h.id = r.hospital_id;
$function$;

-- assign_nsp_coordinator(hospital, user): nsp_org_admin appoints a per-hospital
-- coordinator (decision 13; mirrors assign_hospital_admin). No self-delegation.
create or replace function public.assign_nsp_coordinator(p_hospital uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_org uuid;
begin
  v_org := app.org_of_hospital(p_hospital);
  if v_org is null then
    raise exception 'hospital inexistente' using errcode = 'check_violation';
  end if;
  -- Only the org's nsp_org_admin may appoint (NOT org_admin, NOT hospital_admin —
  -- decision 3). The org_admin appoints the nsp_org_admin; the nsp_org_admin appoints
  -- the per-hospital coordinator.
  if not app.is_nsp_org_admin_of(v_org) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'não é permitido nomear a si mesmo' using errcode = '42501';
  end if;

  insert into public.organization_members (organization_id, user_id, role, hospital_id)
  values (v_org, p_user, 'nsp_coordinator', p_hospital)
  on conflict (organization_id, user_id, role, hospital_id) do nothing;
end;
$function$;

create or replace function public.revoke_nsp_coordinator(p_hospital uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_org uuid;
begin
  v_org := app.org_of_hospital(p_hospital);
  if v_org is null then
    raise exception 'hospital inexistente' using errcode = 'check_violation';
  end if;
  if not app.is_nsp_org_admin_of(v_org) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  delete from public.organization_members
  where organization_id = v_org and user_id = p_user
    and role = 'nsp_coordinator' and hospital_id = p_hospital;
end;
$function$;

revoke all on function public.list_my_nsp_hospitals() from public;
revoke all on function public.list_hospital_eligible_users_for_pqs(uuid) from public;
revoke all on function public.list_org_eligible_users(uuid) from public;
revoke all on function public.assign_nsp_coordinator(uuid, uuid) from public;
revoke all on function public.revoke_nsp_coordinator(uuid, uuid) from public;
grant execute on function public.list_my_nsp_hospitals() to authenticated, service_role;
grant execute on function public.list_hospital_eligible_users_for_pqs(uuid) to authenticated, service_role;
grant execute on function public.list_org_eligible_users(uuid) to authenticated, service_role;
grant execute on function public.assign_nsp_coordinator(uuid, uuid) to authenticated, service_role;
grant execute on function public.revoke_nsp_coordinator(uuid, uuid) to authenticated, service_role;

-- ============================================================================
-- SECTION 10 — dispose_referral_phi (ADR 0052 §6). The referral module's LGPD-
-- erasure door, mirroring dispose_event_phi / dispose_case_phi. Gate: platform
-- is_admin (documented erasure exception) OR the source commission-admin OR the
-- referral's-HOSPITAL NSP operator. Nulls the FULL PHI graph (Q4) derived from the
-- referral module's *_select_phi classification; keeps the governance skeleton
-- (ENC code, structural fields, provenance, audit). Audit at the HOSPITAL tier via
-- the source commission.
-- ============================================================================

-- case_referral gains disposal-tracking columns (mirror patient_safety_event /
-- cases; case_referral had none). One-shot guard + who/when/why stamp.
alter table public.case_referral
  add column if not exists phi_disposed_at timestamptz,
  add column if not exists phi_disposed_by uuid references public.profiles(id),
  add column if not exists phi_disposed_reason text;

create or replace function public.dispose_referral_phi(p_referral_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_referral public.case_referral;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_referrals_enabled();

  -- Gate: platform is_admin (documented erasure exception, scoped through the
  -- commission) OR the source commission-admin (Phase-A hospital-scoped mirror) OR
  -- EITHER endpoint hospital's NSP operator (dual-hospital, consistent with
  -- can_read_referral_phi — decision 14). Disposal does NOT read PHI. DEFINER
  -- bypasses RLS -> re-check.
  if not (app.is_admin()
          or app.is_commission_admin_of((select source_commission_id from public.case_referral where id = p_referral_id))
          or app.is_pqs_operator_of(app.hospital_of_commission((select source_commission_id from public.case_referral where id = p_referral_id)))
          or app.is_pqs_operator_of(app.hospital_of_commission((select target_commission_id from public.case_referral where id = p_referral_id)))) then
    raise exception 'apenas um administrador da organização ou o NSP pode descartar dados do paciente'
      using errcode = '42501';
  end if;

  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;

  select * into v_referral from public.case_referral where id = p_referral_id;
  if v_referral.id is null then
    raise exception 'encaminhamento não encontrado' using errcode = 'P0002';
  end if;

  if v_referral.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste encaminhamento já foram descartados'
      using errcode = 'HC056';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  -- The referral status-guard trigger (guard_referral_status) blocks ANY field edit
  -- on a non-rascunho referral outside the referral RPCs; disposal legitimately edits
  -- the referral's PHI free-text on a sent/concluded referral, so raise the referral
  -- RPC flag too (mirrors the other referral write paths). No status change is made.
  perform set_config('app.in_referral_rpc', 'on', true);
  perform set_config('app.phi_dispose_reason', p_reason, true);

  -- Isolated PHI row.
  delete from public.referral_patient where referral_id = p_referral_id;

  -- Referral free-text carrying patient context (from the *_select_phi classification).
  -- Keep code, type_label, status, commission names (governance skeleton).
  update public.case_referral
     set subject = v_redacted,
         description_md = null,
         decline_note = null
   where id = p_referral_id;

  -- Reply narrative.
  update public.referral_reply
     set result_md = null
   where referral_id = p_referral_id;

  -- Frozen point-in-time snapshot bodies (the shared items carry PHI from the source
  -- case at freeze time). The referral_shape CHECK requires a narrative item to keep a
  -- non-null frozen_body_md, so REDACT (not null) it — mirroring how dispose_event_phi
  -- redacts constrained columns. Document items (frozen_body_md already null; body
  -- lives in immutable storage, left as-is like the event door leaves storage objects).
  update public.referral_shared_item
     set frozen_title = v_redacted,
         frozen_body_md = case when frozen_body_md is not null then v_redacted else frozen_body_md end
   where referral_id = p_referral_id;

  update public.case_referral
     set has_patient = false,
         phi_disposed_at = now(),
         phi_disposed_by = auth.uid(),
         phi_disposed_reason = p_reason,
         updated_at = now()
   where id = p_referral_id;

  -- Audit at the HOSPITAL tier (derived from the source commission).
  perform app.audit_write(
    'referral_patient.disposed',
    'referral_patient',
    p_referral_id,
    v_referral.source_commission_id,
    'Dados do paciente do encaminhamento ' || v_referral.code || ' descartados',
    jsonb_build_object('reason', p_reason)
  );

  perform set_config('app.in_safety_rpc', 'off', true);
  perform set_config('app.in_referral_rpc', 'off', true);
end;
$function$;

revoke all on function public.dispose_referral_phi(uuid, text) from public;
grant execute on function public.dispose_referral_phi(uuid, text) to authenticated, service_role;

-- ============================================================================
-- SECTION 11 — DROPS (stale per-org symbols) + CATALOG SWEEP.
-- ============================================================================

-- Drop the per-org resolution helpers fully replaced by hospital_of_*.
drop function if exists app.org_of_event(uuid);
drop function if exists app.org_of_referral(uuid);
drop function if exists app.org_of_capa_action(uuid);

-- Drop the old per-org eligible-users RPC (renamed -> list_hospital_eligible_users_for_pqs).
drop function if exists public.list_org_eligible_users_for_pqs(uuid);

-- CATALOG SWEEP (the real safeguard — ADR 0042 M2). After this migration, ZERO
-- pg_proc / pg_policies references to the DROPPED per-org resolution symbols
-- (org_of_event / org_of_referral / org_of_capa_action) or a lingering
-- pqs_members.organization_id survive. Word-boundary regex so hospital_of_* /
-- org_of_commission (kept) / org_of_hospital (kept) / is_pqs_member_of( (re-keyed in
-- place) are NOT false positives.
do $sweep$
declare
  v_bad text;
begin
  select string_agg(sig, ', ') into v_bad from (
    select n.nspname || '.' || p.proname as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('app', 'public') and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~ '[^a-z_](org_of_event|org_of_referral|org_of_capa_action)[(]'
    union all
    select schemaname || '.' || policyname
    from pg_policies
    where (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '[^a-z_](org_of_event|org_of_referral|org_of_capa_action)[(]'
       or (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ 'pqs_members[^)]*organization_id'
  ) t;
  if v_bad is not null then
    raise exception 'NSP-per-hospital catalog sweep FAILED — residual per-org PQS symbol(s): %', v_bad;
  end if;
end;
$sweep$;
