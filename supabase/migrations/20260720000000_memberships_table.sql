-- ============================================================================
-- MEM-2 · Single `public.memberships` collapse — the table (structural, no flag).
--
-- Collapses the three role-carrying tables (organization_members,
-- commission_members, pqs_members) into ONE audited table, written only through
-- the grant_role/revoke_role door (MEM-4) and read through the has_role predicate
-- family (MEM-3). Dialect-1 polymorphism: column-per-scope + a discriminated shape
-- CHECK (ADR 0065 App-A) — NEVER a bare scope_id.
--
-- This migration CREATES the table only. The three legacy tables are dropped LAST
-- (MEM-5), after the predicates/door/read-fns are repointed (create-then-cutover;
-- dropping first would break every predicate mid-migration).
--
-- Spec: docs/plans/memberships-collapse-s6-1.md §2.1. Ratified: S0 §I (O-1..O-6).
-- Binding: ARCHITECTURE.md App-A dialect-1; Rules 1/8/11.
-- ============================================================================

create table public.memberships (
  id              uuid primary key default gen_random_uuid(),
  principal_id    uuid not null references public.profiles(id) on delete cascade,

  -- Column-per-scope (dialect 1 — never a bare polymorphic scope_id; ADR 0065).
  -- Exactly the columns each role legally carries are set; enforced by the
  -- memberships_scope_shape CHECK below.
  organization_id uuid references public.organizations(id) on delete cascade,
  hospital_id     uuid references public.hospitals(id)      on delete cascade,
  commission_id   uuid references public.commissions(id)    on delete cascade,
  -- case_id: DEFERRED / not added (S0 §I O-1) — no role scopes to a case;
  -- case_access stays the per-case involvement plane.

  role            text not null,

  -- Commission-scope display-only committee title (ADR 0051, O-3). Zero RLS
  -- semantics; legal ONLY on the commission shape (memberships_title_scope).
  title_id        uuid references public.commission_member_titles(id) on delete set null,

  -- Grantor + expiry (capability gain over the incumbents; inert until set).
  granted_by      uuid references public.profiles(id),
  granted_at      timestamptz not null default now(),
  expires_at      timestamptz,   -- reserved; NULL = permanent = incumbent behavior

  -- (a) role ∈ the union vocabulary (belt with the discriminated CHECK).
  constraint memberships_role_check check (role = any (array[
    'org_admin', 'nsp_org_admin', 'hospital_admin', 'nsp_coordinator',  -- org/hospital tier
    'staff_admin', 'staff',                                             -- commission tier
    'pqs_member'                                                        -- synthetic (pqs_members enrollment)
  ])),

  -- (b) DISCRIMINATED SHAPE CHECK — exactly the scope columns each role carries.
  --     Generalizes organization_members' hospital_id-iff-role CHECK (ADR 0051/0052)
  --     and mirrors the guard triggers' hospital↔org coherence intent.
  constraint memberships_scope_shape check (
    case role
      -- organization tier: org set, hospital + commission null
      when 'org_admin'       then organization_id is not null and hospital_id is null and commission_id is null
      when 'nsp_org_admin'   then organization_id is not null and hospital_id is null and commission_id is null
      -- hospital tier: org + hospital set (org denormalized for the audit chain +
      -- fast org rollups — mirrors organization_members), commission null
      when 'hospital_admin'  then organization_id is not null and hospital_id is not null and commission_id is null
      when 'nsp_coordinator' then organization_id is not null and hospital_id is not null and commission_id is null
      when 'pqs_member'      then organization_id is not null and hospital_id is not null and commission_id is null
      -- commission tier: commission set, org + hospital null (resolve up via the
      -- commissions FK when a rollup needs the org/hospital)
      when 'staff_admin'     then commission_id is not null and organization_id is null and hospital_id is null
      when 'staff'           then commission_id is not null and organization_id is null and hospital_id is null
      else false   -- unknown role rejected (belt with (a))
    end
  ),

  -- (c) title_id legal ONLY on commission-scope rows (O-3).
  constraint memberships_title_scope check (title_id is null or commission_id is not null)
);

comment on table public.memberships is
  'Single audited role-membership table (S1·MEM). Collapses organization_members / '
  'commission_members / pqs_members. Written ONLY via grant_role/revoke_role '
  '(SECURITY DEFINER door); read via the app.has_role predicate family. Dialect-1 '
  'column-per-scope + discriminated shape CHECK (ADR 0065). No direct DML grant to '
  'authenticated (Rule 1); every write audited by trg_audit_memberships (Rule 11).';

-- One grant per (principal, exact scope, role). NULLS NOT DISTINCT (PG15+; local
-- is PG17) so the NULL scope columns collapse to one logical key — matches
-- organization_members' Phase-A unique + commission_members' effective uniqueness.
create unique index memberships_grant_uq on public.memberships
  using btree (principal_id, role, organization_id, hospital_id, commission_id)
  nulls not distinct;

-- Hot RLS-predicate indexes (replace the three tables' per-table indexes; audit
-- §4 RLS-perf). Partial so each covers exactly one scope tier.
create index memberships_commission_idx   on public.memberships (commission_id, principal_id)       where commission_id   is not null;
create index memberships_hospital_idx     on public.memberships (hospital_id, principal_id, role)    where hospital_id     is not null;
create index memberships_organization_idx on public.memberships (organization_id, principal_id, role) where organization_id is not null;
create index memberships_principal_idx    on public.memberships (principal_id);
-- title_id lookup parity with the incumbent commission_members_title_idx (ADR 0051 —
-- the committee-title display join). Partial: only commission-scope rows carry a title.
create index memberships_title_idx        on public.memberships (title_id)                          where title_id        is not null;

-- ----------------------------------------------------------------------------
-- RLS: enabled from creation (Rule 1). SELECT policy only — NO INSERT/UPDATE/DELETE
-- policy and NO DML grant to `authenticated` (the WS-1 lockdown posture, carried
-- verbatim: a direct PostgREST POST/PATCH/DELETE → 401/403). service_role (seed +
-- provisioning doors) is RLS-exempt, so db reset + the service-role write paths
-- still work. Writes flow ONLY through grant_role/revoke_role (MEM-4).
-- ----------------------------------------------------------------------------
alter table public.memberships enable row level security;

-- Table-level privilege: SELECT only for `authenticated` (RLS gates the ROWS; the
-- GRANT gates the PRIVILEGE — both are needed for an RLS-scoped read to resolve).
-- Explicitly issued because the table is postgres-owned and the C-2 revoke-default
-- posture grants no privilege by default. NO INSERT/UPDATE/DELETE grant — the WS-1
-- lockdown invariant: writes flow ONLY through the door / RLS-exempt service_role.
grant select on public.memberships to authenticated;

-- The unified SELECT policy = the union of the three retired SELECT policies:
--   * self-read (any own grant), matching organization_members_select's
--     `user_id = auth.uid()` arm and giving each user their own roster.
--   * commission scope: member OR commission-admin (commission_members_select).
--   * organization scope: admin OR org_admin of the org (organization_members_select).
--   * hospital scope: admin OR org_admin/hospital_admin of the hospital's org, so an
--     org/hospital admin sees the hospital-tier roster (nsp_coordinator/pqs_member)
--     — no wider than the incumbent org/hospital admin reach.
-- pqs_members had NO SELECT policy (DEFINER-door reads only); its rows are readable
-- here only by the row owner or an org/hospital admin — a strict SUPERSET-free
-- addition, since the DEFINER readers (list_pqs_members / nsp_org_roster) bypass RLS.
create policy memberships_select on public.memberships
  for select to authenticated
  using (
    -- self-read: your own grants, every scope.
    principal_id = (select auth.uid())
    or app.is_admin()
    -- commission-scope rows.
    or (commission_id is not null and (
          app.is_member_of(commission_id) or app.is_commission_admin_of(commission_id)))
    -- organization-scope rows.
    or (organization_id is not null and commission_id is null and hospital_id is null
        and app.is_org_admin_of(organization_id))
    -- hospital-scope rows: org_admin of the hospital's org OR hospital_admin of it.
    or (hospital_id is not null and (
          app.is_org_admin_of(app.org_of_hospital(hospital_id))
          or app.is_hospital_admin_of(hospital_id)))
  );

-- ----------------------------------------------------------------------------
-- Integrity guard triggers carried from the retired tables (their two BEFORE
-- guards): title-belongs-to-commission (A1) and hospital-belongs-to-org coherence.
-- The scope-shape CHECK already pins WHICH columns are set; these pin that the set
-- FK values are mutually coherent.
-- ----------------------------------------------------------------------------
create or replace function app.guard_membership_title_commission()
returns trigger
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if new.title_id is not null then
    if (select commission_id from public.commission_member_titles where id = new.title_id)
       is distinct from new.commission_id then
      raise exception 'title % does not belong to commission %',
        new.title_id, new.commission_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create or replace function app.guard_membership_hospital_org()
returns trigger
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if new.hospital_id is not null then
    if (select organization_id from public.hospitals where id = new.hospital_id)
       is distinct from new.organization_id then
      raise exception 'hospital_id % does not belong to organization %',
        new.hospital_id, new.organization_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_membership_title_commission_trg
  before insert or update on public.memberships
  for each row execute function app.guard_membership_title_commission();

create trigger guard_membership_hospital_org_trg
  before insert or update on public.memberships
  for each row execute function app.guard_membership_hospital_org();
