-- =============================================================================
-- DM5 S2 · M1 — securable resource types `rca` + `capa_action`
--
-- Executes ADR 0120 D1 / D2 / D14 / D16, under ADR 0114 D4 (the securable
-- resource registry holds identity + type + tenant anchors ONLY — never domain
-- payload).
--
-- ⭐ THE COUPLING THIS MIGRATION EXISTS TO RESPECT (ADR 0120 D1).
-- `securable_resources` carries TWO constraints that each enumerate the type
-- set: `securable_resources_type_check` and `securable_resources_tenant_shape`.
-- Widening only the first leaves `tenant_shape` false for the new type and
-- EVERY insert is rejected — fail-closed, but silently and confusingly. They
-- are therefore widened in ONE edit here, and pgTAP 341 keystones the coupling
-- in BOTH directions so a future seventh type cannot be half-added.
--
-- ⭐ TENANCY (ADR 0120 D2 + D14) — two different answers, deliberately:
--   `rca`         → the event's REPORTING commission. Stable for the row's
--                   life. Custody (`current_owner_commission_id`) MOVES, so it
--                   is a READ-TIME input resolved through `app.can_read_event`,
--                   never a tenancy key. A moving tenancy key is a
--                   tenant-isolation hazard.
--   `capa_action` → org + hospital ONLY; `commission_id` stays NULL.
--                   `capa_plan.source` admits six values and a commission is
--                   underivable for `manual` and `audit_finding` (whose table
--                   does not exist yet — internal audit / mock tracer is a
--                   roadmap module, so the value is anticipatory, not dead).
--                   The commission costs nothing here: `audit_log.commission_id`
--                   is already nullable and ZERO `documents` policies read the
--                   registry commission, so it is not a tenant-isolation input.
--                   Reads resolve through `app.can_read_capa` regardless.
--                   It is left NULL for EVERY capa_action, including the four
--                   sources where it could be derived — a half-populated column
--                   invites a future reader to treat it as authoritative.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. The two coupled CHECKs, widened together.
-- -----------------------------------------------------------------------------
alter table public.securable_resources
  drop constraint securable_resources_type_check,
  drop constraint securable_resources_tenant_shape;

alter table public.securable_resources
  add constraint securable_resources_type_check
  check (resource_type = any (array[
    'case', 'meeting', 'interview', 'action_item',
    'controlled_document', 'case_referral',
    'rca', 'capa_action'
  ]));

-- TWO shapes now (D14). Shape A is the original six PLUS `rca`; shape B is
-- `capa_action` alone. Note shape B still REQUIRES org + hospital — the
-- relaxation is exactly one column, on exactly one type.
alter table public.securable_resources
  add constraint securable_resources_tenant_shape
  check (
    (
      resource_type = any (array[
        'case', 'meeting', 'interview', 'action_item',
        'controlled_document', 'case_referral', 'rca'
      ])
      and organization_id is not null
      and hospital_id is not null
      and commission_id is not null
    )
    or (
      resource_type = 'capa_action'
      and organization_id is not null
      and hospital_id is not null
      -- commission_id deliberately unconstrained (D14)
    )
  );

-- -----------------------------------------------------------------------------
-- 2. Shared-PK links (the participants-registry technique, as used by every
--    existing type: a pinned `securable_type` column + a typed composite FK).
-- -----------------------------------------------------------------------------
alter table public.rca
  add column securable_type text not null default 'rca',
  add constraint rca_securable_type_pin check (securable_type = 'rca');

alter table public.capa_action
  add column securable_type text not null default 'capa_action',
  add constraint capa_action_securable_type_pin check (securable_type = 'capa_action');

-- -----------------------------------------------------------------------------
-- 3. Mint triggers. One per type, mirroring app.ensure_securable_resource_referral.
--    BEFORE INSERT so the registry row exists before the composite FK is checked.
-- -----------------------------------------------------------------------------
create or replace function app.ensure_securable_resource_rca()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_org uuid;
  v_hospital uuid;
  v_commission uuid;
begin
  -- D2: the REPORTING commission, never current_owner_commission_id.
  select e.reporting_commission_id, c.organization_id, c.hospital_id
    into v_commission, v_org, v_hospital
  from public.patient_safety_event e
  join public.commissions c on c.id = e.reporting_commission_id
  where e.id = new.event_id;
  if v_org is null then
    raise exception 'securable_resources: evento % sem comissão notificante', new.event_id
      using errcode = 'foreign_key_violation';
  end if;
  insert into public.securable_resources
    (id, resource_type, organization_id, hospital_id, commission_id)
  values (new.id, 'rca', v_org, v_hospital, v_commission)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function app.ensure_securable_resource_capa_action()
returns trigger
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_org uuid;
  v_hospital uuid;
begin
  -- D14/D16: hospital comes from capa_plan.hospital_id (NOT NULL for every
  -- source), NOT through the event — 4 of 6 sources have no event at all.
  select p.hospital_id, h.organization_id
    into v_hospital, v_org
  from public.capa_plan p
  join public.hospitals h on h.id = p.hospital_id
  where p.id = new.capa_id;
  if v_hospital is null then
    raise exception 'securable_resources: plano CAPA % sem hospital', new.capa_id
      using errcode = 'foreign_key_violation';
  end if;
  insert into public.securable_resources
    (id, resource_type, organization_id, hospital_id, commission_id)
  values (new.id, 'capa_action', v_org, v_hospital, null)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_ensure_securable_resource
  before insert on public.rca
  for each row execute function app.ensure_securable_resource_rca();
create trigger trg_drop_securable_resource
  after delete on public.rca
  for each row execute function app.drop_securable_resource();

create trigger trg_ensure_securable_resource
  before insert on public.capa_action
  for each row execute function app.ensure_securable_resource_capa_action();
create trigger trg_drop_securable_resource
  after delete on public.capa_action
  for each row execute function app.drop_securable_resource();

-- -----------------------------------------------------------------------------
-- 4. Backfill existing rows, THEN add the composite FKs.
--    Order matters: the FK is only satisfiable once every row has its registry
--    row. Done as one statement per type so a missing anchor fails loudly here
--    rather than as an opaque FK violation.
-- -----------------------------------------------------------------------------
insert into public.securable_resources
  (id, resource_type, organization_id, hospital_id, commission_id)
select r.id, 'rca', c.organization_id, c.hospital_id, e.reporting_commission_id
from public.rca r
join public.patient_safety_event e on e.id = r.event_id
join public.commissions c on c.id = e.reporting_commission_id
on conflict (id) do nothing;

insert into public.securable_resources
  (id, resource_type, organization_id, hospital_id, commission_id)
select a.id, 'capa_action', h.organization_id, p.hospital_id, null
from public.capa_action a
join public.capa_plan p on p.id = a.capa_id
join public.hospitals h on h.id = p.hospital_id
on conflict (id) do nothing;

do $$
declare
  v_missing int;
begin
  select count(*) into v_missing
  from public.rca r
  where not exists (select 1 from public.securable_resources s
                     where s.id = r.id and s.resource_type = 'rca');
  if v_missing > 0 then
    raise exception 'backfill incompleto: % RCA(s) sem securable_resources', v_missing;
  end if;
  select count(*) into v_missing
  from public.capa_action a
  where not exists (select 1 from public.securable_resources s
                     where s.id = a.id and s.resource_type = 'capa_action');
  if v_missing > 0 then
    raise exception 'backfill incompleto: % ação(ões) CAPA sem securable_resources', v_missing;
  end if;
end $$;

alter table public.rca
  add constraint rca_securable_resource_fk
  foreign key (id, securable_type) references public.securable_resources(id, resource_type);

alter table public.capa_action
  add constraint capa_action_securable_resource_fk
  foreign key (id, securable_type) references public.securable_resources(id, resource_type);

-- -----------------------------------------------------------------------------
-- 5. D16 — app.hospital_of_capa_action corrected.
--
-- It resolved `hospital_of_event(event_of_capa(...))`, and `event_of_capa`
-- returns NULL for 4 of `capa_plan.source`'s 6 values (`indicator`, `meeting`,
-- `audit_finding`, `manual`), so the function was NULL for those — despite
-- `capa_plan.hospital_id` being NOT NULL and directly available.
--
-- Folded into THIS migration rather than given its own step, deliberately:
-- it has zero callers today, so there is no behavioural red available for it
-- either way, and D14 makes the hospital LOAD-BEARING for `capa_action`
-- tenancy the moment section 2 above lands. Separating them would leave one
-- migration in which the resolver is wrong AND newly reachable. Its assurance
-- is a direct catalog assertion (341): non-NULL for all six sources.
-- -----------------------------------------------------------------------------
create or replace function app.hospital_of_capa_action(p_action_id uuid)
returns uuid
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select p.hospital_id
  from public.capa_action a
  join public.capa_plan p on p.id = a.capa_id
  where a.id = p_action_id;
$$;

commit;
