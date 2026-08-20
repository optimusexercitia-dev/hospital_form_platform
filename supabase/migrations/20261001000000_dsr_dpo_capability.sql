-- =============================================================================
-- DSR Slice 2, part 1 of 2 — the per-hospital `dpo` delegated capability.
--
-- ADR 0130 Decision 2 (powers are split; the Encarregado is often not the
-- hospital admin) + Amendment 2 item 1 (this grant moved from Slice 3 to Slice 2
-- because `create_dsr_request` is DPO-gated and `app.is_dpo_of` did not exist —
-- gating on a placeholder would have meant changing a live authorization gate
-- twice, each owing its own ADR-0079 sweep). Pattern: ADR 0061's
-- `administrativo` delegated capability, whose runtime predicate `app.member_can`
-- is the shape mirrored here.
--
-- ⛔ WHAT THIS MIGRATION DOES NOT DO, stated so its absence is not read as an
-- oversight: it does NOT widen `search_patient_xref`. That is ADR 0130
-- Decision 3 — the program's ONE named gate widening — and it stays in Slice 3.
-- Slice 2 needs no patient search: `create_dsr_request` derives the key itself.
--
-- Parked-arm SQLSTATE for this program (recorded in ADR 0130 Amendment 2):
--   HCDS1 DSR feature flag off · HCDS2 unroutable xref row ·
--   HCDS3 task not completable · HCDS4 close refused, work outstanding ·
--   HCDS5 illegal DSR state transition.
-- =============================================================================

-- 1. The program flag — created OFF. `seed.sql` forces it ON for local/E2E, and
--    the production flip is its own gate migration.
--    NOTE for pgTAP authors: every door here raises HCDS1 and every predicate
--    returns false when this flag is OFF, so a fixture that forgets to enable it
--    makes each flag-guarded keystone SKIP while reporting green (the
--    pgtap-fixture-flag-gaps scar). The DSR suite asserts the flag is ON before
--    it asserts anything else. Resolve the VALUE in the enabled column, never
--    this sentence.
insert into app.feature_flags (key, enabled, description) values
  ('dsr', false,
   'ADR 0130: "Direitos do Titular" — LGPD Art. 18 subject-request intake, adjudication and execution. Gates the dsr_* doors and the /o/[org]/titulares surface. Ships OFF until the DSR gate. Resolve the VALUE in the enabled column, never this sentence.');

-- 2. The grant table.
create table public.hospital_dpos (
  id           uuid primary key default gen_random_uuid(),
  hospital_id  uuid not null references public.hospitals(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  appointed_by uuid references public.profiles(id),
  appointed_at timestamptz not null default now(),
  revoked_at   timestamptz,
  revoked_by   uuid references public.profiles(id),
  constraint hospital_dpos_revoked_stamped
    check (revoked_at is null or revoked_by is not null)
);

-- One LIVE grant per (hospital, person); revoked rows accumulate as history.
create unique index hospital_dpos_active_uniq
  on public.hospital_dpos (hospital_id, user_id)
  where revoked_at is null;

create index hospital_dpos_hospital_idx on public.hospital_dpos (hospital_id);

comment on table public.hospital_dpos is
  'ADR 0130 Decision 2 / Amdt 2 item 1: the per-hospital Encarregado (DPO) delegated capability. Runtime predicate is app.is_dpo_of — verify against the catalog, never this comment.';

alter table public.hospital_dpos enable row level security;

revoke all on public.hospital_dpos from anon, authenticated;
grant select on public.hospital_dpos to authenticated;

-- 3. The predicates. ⚠ These come BEFORE the read policy below, which calls one
-- of them — a policy referencing a not-yet-created function fails at CREATE.
--
-- ⚠ SIBLING GUARD SET, stated because omitting one silently is this repo's most
-- expensive recurring defect. Mirrored from app.member_can (the ADR 0061
-- precedent), arm for arm:
--   feature flag · app.is_active (deactivated / suspended people hold nothing) ·
--   a scope-membership floor · the grant row itself.
-- The membership floor is `has_role_any` over the hospital's commissions — i.e.
-- app.is_hospital_member_of's body, inlined ONLY because that helper has no
-- `_for` variant and this predicate needs one. If a `_for` variant is ever added,
-- collapse this back onto it rather than letting two copies drift.
create or replace function app.is_dpo_of_for(p_hospital_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.feature_enabled('dsr')
     and app.is_active(p_user_id)
     and exists (
       select 1
       from public.commissions c
       where c.hospital_id = p_hospital_id
         and app.has_role_any('commission', c.id, p_user_id)
     )
     and exists (
       select 1
       from public.hospital_dpos d
       where d.hospital_id = p_hospital_id
         and d.user_id = p_user_id
         and d.revoked_at is null
     );
$$;

create or replace function app.is_dpo_of(p_hospital_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.is_dpo_of_for(p_hospital_id, (select auth.uid()));
$$;

-- A NULL proacl is the DEFAULT and it includes PUBLIC (the guards-that-fail-open
-- family). Every function this program adds is revoked from PUBLIC explicitly and
-- then granted, never left to the default.
revoke all on function app.is_dpo_of_for(uuid, uuid) from public, anon;
revoke all on function app.is_dpo_of(uuid) from public, anon;
grant execute on function app.is_dpo_of_for(uuid, uuid) to authenticated, service_role;
grant execute on function app.is_dpo_of(uuid) to authenticated, service_role;

-- 4. Read policy: the admins who may grant the office, plus the grantee, plus a
-- sitting DPO of the same hospital (they need to know who else holds it).
-- ⛔ NO platform-admin arm anywhere in this slice. ADR 0130 Decision 2 puts
-- platform_admin outside the DSR plane entirely (the ADR-0078 A35 noun rule), and
-- the grant is part of that plane, not of tenancy administration.
create policy hospital_dpos_select on public.hospital_dpos
  for select to authenticated
  using (
    app.is_org_admin_of(app.org_of_hospital(hospital_id))
    or app.is_hospital_admin_of(hospital_id)
    or user_id = (select auth.uid())
    or app.is_dpo_of(hospital_id)
  );

-- 5. The grant/revoke doors. Gate: the tenancy admins of the hospital.
create or replace function public.appoint_hospital_dpo(p_hospital_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_org uuid;
begin
  if not app.feature_enabled('dsr') then
    raise exception 'o módulo de Direitos do Titular não está habilitado'
      using errcode = 'HCDS1';
  end if;

  v_org := app.org_of_hospital(p_hospital_id);
  if v_org is null then
    raise exception 'hospital não encontrado' using errcode = 'P0002';
  end if;

  if not (app.is_org_admin_of(v_org) or app.is_hospital_admin_of(p_hospital_id)) then
    raise exception 'apenas um administrador da organização ou do hospital pode designar o Encarregado'
      using errcode = '42501';
  end if;

  perform app._deny_self_grant(p_user_id);

  -- The membership floor, enforced at grant time AND at every runtime check
  -- (app.is_dpo_of_for). Both, deliberately: the runtime arm is what survives a
  -- membership being removed later.
  if not exists (
    select 1
    from public.commissions c
    where c.hospital_id = p_hospital_id
      and app.has_role_any('commission', c.id, p_user_id)
  ) then
    raise exception 'o Encarregado deve possuir vínculo com alguma comissão deste hospital'
      using errcode = 'HC021';
  end if;

  insert into public.hospital_dpos (hospital_id, user_id, appointed_by)
  values (p_hospital_id, p_user_id, auth.uid())
  on conflict (hospital_id, user_id) where revoked_at is null do nothing;

  perform app.audit_write(
    'dsr.dpo_appointed', 'hospital_dpo', p_hospital_id, null,
    'Encarregado designado', jsonb_build_object('user_id', p_user_id),
    v_org, p_hospital_id
  );
end;
$$;

create or replace function public.revoke_hospital_dpo(p_hospital_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_org uuid;
begin
  if not app.feature_enabled('dsr') then
    raise exception 'o módulo de Direitos do Titular não está habilitado'
      using errcode = 'HCDS1';
  end if;

  v_org := app.org_of_hospital(p_hospital_id);
  if v_org is null then
    raise exception 'hospital não encontrado' using errcode = 'P0002';
  end if;

  if not (app.is_org_admin_of(v_org) or app.is_hospital_admin_of(p_hospital_id)) then
    raise exception 'apenas um administrador da organização ou do hospital pode revogar o Encarregado'
      using errcode = '42501';
  end if;

  update public.hospital_dpos
     set revoked_at = now(), revoked_by = auth.uid()
   where hospital_id = p_hospital_id
     and user_id = p_user_id
     and revoked_at is null;

  if not found then
    raise exception 'não há designação ativa de Encarregado para este usuário'
      using errcode = 'P0002';
  end if;

  perform app.audit_write(
    'dsr.dpo_revoked', 'hospital_dpo', p_hospital_id, null,
    'Encarregado revogado', jsonb_build_object('user_id', p_user_id),
    v_org, p_hospital_id
  );
end;
$$;

revoke all on function public.appoint_hospital_dpo(uuid, uuid) from public, anon;
revoke all on function public.revoke_hospital_dpo(uuid, uuid) from public, anon;
grant execute on function public.appoint_hospital_dpo(uuid, uuid) to authenticated, service_role;
grant execute on function public.revoke_hospital_dpo(uuid, uuid) to authenticated, service_role;
