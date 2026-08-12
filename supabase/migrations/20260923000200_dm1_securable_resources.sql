-- =============================================================================
-- DM1 / M2 — the securable-resource registry (ADR 0114 D4; plan
-- docs/plans/dm1-substrate-cutover-plan.md §3 step 2; decisions ADR 0116).
--
-- Dialect: the participants typed-identity registry (Appendix A dialect 3),
-- copied constraint-for-constraint — anchor UNIQUE(id, type) + a constant
-- typed column on each satellite pinned by composite FK + CHECK — with the
-- roles INVERTED: here the four pre-existing DOMAIN tables play the satellite
-- role and share their PK with the registry row. NOT a fourth dialect.
--
-- ⚠ The interview table is `case_interviews` — ADR 0114 D4 says "interviews";
-- no such relation exists (same scar class as `commission_members` /
-- `case_patient`; verify against the catalog, never the ADR's noun).
--
-- Registry rows are minted two ways that MUST converge:
--   * BACKFILL (this migration) for rows that already exist — data-dependent,
--     so it is a no-op on a fresh `db reset` (empty DB) and only provable on a
--     populated stack; the K3 anti-join in pgTAP 328 is asserted on BOTH paths.
--   * a BEFORE INSERT trigger for every future row (deliberate divergence from
--     the participants precedent, whose anchors are command-created: documents
--     must attach to rows minted by ~a dozen pre-existing RPCs, and the
--     trigger keeps DM1 out of all of them — ADR 0116).
-- =============================================================================

-- 1. The registry. Identity + type + tenant anchors ONLY (anti-EAV, D4).
--    Columns are nullable with a NAMED tenant-shape CHECK (the memberships
--    scope-exclusivity dialect) so a future org-/hospital-scoped resource type
--    widens the CHECK instead of fighting a NOT NULL.
create table public.securable_resources (
  id              uuid primary key,
  resource_type   text not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  hospital_id     uuid references public.hospitals(id) on delete cascade,
  commission_id   uuid references public.commissions(id) on delete cascade,
  created_at      timestamptz not null default now(),
  constraint securable_resources_id_type_uniq unique (id, resource_type),
  constraint securable_resources_type_check
    check (resource_type in ('case', 'meeting', 'interview', 'action_item')),
  -- All four initial types are commission-anchored: the full tenant trio is
  -- required. A future type adds its own OR-arm here.
  constraint securable_resources_tenant_shape check (
    (resource_type in ('case', 'meeting', 'interview', 'action_item')
      and organization_id is not null
      and hospital_id is not null
      and commission_id is not null)
  )
);

comment on table public.securable_resources is
  'ADR 0114 D4 registry: one row per document-bearing domain row (shared PK). Identity + type + tenant anchors ONLY — never domain payload (anti-EAV). Tenant FKs CASCADE deliberately: a tenant delete may sweep registry rows, but documents.home_resource_id (ON DELETE RESTRICT, M3) blocks the sweep for any resource that still owns documents.';

alter table public.securable_resources enable row level security;
revoke all on public.securable_resources from anon, authenticated;
grant select on public.securable_resources to authenticated;

-- Registry metadata is tenant-visible (member or tenancy admin of the
-- commission); it carries no domain payload. Single policy, deliberately —
-- a permissive sibling would un-falsify the keystones (authz-handoff §7.1-6).
create policy securable_resources_select on public.securable_resources
  for select to authenticated
  using (app.is_member_of(commission_id) or app.is_tenancy_admin_of(commission_id));

-- 2. Backfill the registry for every existing domain row (tenant trio resolved
--    through commissions — the single source for all four types).
insert into public.securable_resources (id, resource_type, organization_id, hospital_id, commission_id)
select x.id, x.rtype, c.organization_id, c.hospital_id, x.commission_id
from (
  select id, 'case'::text as rtype, commission_id from public.cases
  union all
  select id, 'meeting', commission_id from public.meetings
  union all
  select id, 'interview', commission_id from public.case_interviews
  union all
  select id, 'action_item', commission_id from public.action_items
) x
join public.commissions c on c.id = x.commission_id;

-- 3. The typed pins on the four domain tables (constant column + CHECK +
--    composite FK — the patient_participants shape, roles inverted).
alter table public.cases
  add column securable_type text not null default 'case'
    constraint cases_securable_type_check check (securable_type = 'case'),
  add constraint cases_securable_resource_fk
    foreign key (id, securable_type)
    references public.securable_resources (id, resource_type);

alter table public.meetings
  add column securable_type text not null default 'meeting'
    constraint meetings_securable_type_check check (securable_type = 'meeting'),
  add constraint meetings_securable_resource_fk
    foreign key (id, securable_type)
    references public.securable_resources (id, resource_type);

alter table public.case_interviews
  add column securable_type text not null default 'interview'
    constraint case_interviews_securable_type_check check (securable_type = 'interview'),
  add constraint case_interviews_securable_resource_fk
    foreign key (id, securable_type)
    references public.securable_resources (id, resource_type);

alter table public.action_items
  add column securable_type text not null default 'action_item'
    constraint action_items_securable_type_check check (securable_type = 'action_item'),
  add constraint action_items_securable_resource_fk
    foreign key (id, securable_type)
    references public.securable_resources (id, resource_type);

-- 4. Population trigger: BEFORE INSERT mints the registry row so the composite
--    FK is satisfiable without touching any of the existing creation RPCs.
--    DEFINER + pinned search_path (house convention); no client EXECUTE.
create function app.ensure_securable_resource() returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_type text := tg_argv[0];
  v_org uuid;
  v_hospital uuid;
begin
  select c.organization_id, c.hospital_id into v_org, v_hospital
  from public.commissions c where c.id = new.commission_id;
  if v_org is null then
    raise exception 'securable_resources: comissão % inexistente', new.commission_id
      using errcode = 'foreign_key_violation';
  end if;
  -- Targeted ON CONFLICT (the PK), required by trigger semantics: BEFORE
  -- INSERT fires before an outer "on conflict do nothing" resolves, so a
  -- seed-style idempotent re-insert of an existing domain row must not fail
  -- here. Targeted at (id) deliberately — an untargeted DO NOTHING would
  -- swallow future unique violations it was never meant to.
  insert into public.securable_resources (id, resource_type, organization_id, hospital_id, commission_id)
  values (new.id, v_type, v_org, v_hospital, new.commission_id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function app.ensure_securable_resource() from public, anon, authenticated;

-- 5. Cleanup trigger: AFTER DELETE removes the registry row. Interaction with
--    documents.home_resource_id (M3, ON DELETE RESTRICT) is the DELIBERATE
--    fail-safe: deleting a domain row that still owns documents raises 23503
--    and rolls the whole delete back (witnessed in pgTAP 328 K3e with a
--    hand-planted document — it cannot fire on live data in DM1).
create function app.drop_securable_resource() returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  delete from public.securable_resources where id = old.id;
  return old;
end;
$$;

revoke all on function app.drop_securable_resource() from public, anon, authenticated;

create trigger trg_ensure_securable_resource
  before insert on public.cases
  for each row execute function app.ensure_securable_resource('case');
create trigger trg_drop_securable_resource
  after delete on public.cases
  for each row execute function app.drop_securable_resource();

create trigger trg_ensure_securable_resource
  before insert on public.meetings
  for each row execute function app.ensure_securable_resource('meeting');
create trigger trg_drop_securable_resource
  after delete on public.meetings
  for each row execute function app.drop_securable_resource();

create trigger trg_ensure_securable_resource
  before insert on public.case_interviews
  for each row execute function app.ensure_securable_resource('interview');
create trigger trg_drop_securable_resource
  after delete on public.case_interviews
  for each row execute function app.drop_securable_resource();

create trigger trg_ensure_securable_resource
  before insert on public.action_items
  for each row execute function app.ensure_securable_resource('action_item');
create trigger trg_drop_securable_resource
  after delete on public.action_items
  for each row execute function app.drop_securable_resource();
