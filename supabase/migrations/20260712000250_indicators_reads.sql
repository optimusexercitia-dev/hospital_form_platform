-- =============================================================================
-- Phase 15 — Quality Indicators · task B5
-- Read RPCs: indicator_series (trend points + target line), indicator_kpis
-- (commission na/fora/sem counts), hospital_indicator_rollup (PHI-free per-
-- commission scorecard for the hospital tier — counts + names ONLY, no table
-- grant; mirrors nsp_org_*). All SECURITY DEFINER, gated, search_path pinned.
--
-- Plan §2.4 · Q3 rollup gate (LEAD): is_admin OR is_hospital_admin_of OR
-- is_org_admin_of(org_of_hospital) — is_org_admin_of has NO membership caveat.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0 · Repoint indicator_measurements.entered_by FK auth.users → public.profiles
--     so the measurement grid can embed the enterer's display name
--     (profiles:entered_by(full_name)) — mirrors responses.created_by /
--     capa_action.assignee_user_id. profiles.id = auth.users.id, so every
--     entered_by already has a profile; additive + safe.
-- -----------------------------------------------------------------------------
alter table public.indicator_measurements
  drop constraint indicator_measurements_entered_by_fkey;
alter table public.indicator_measurements
  add constraint indicator_measurements_entered_by_fkey
  foreign key (entered_by) references public.profiles(id) on delete set null;

-- -----------------------------------------------------------------------------
-- 1 · indicator_series — chart-ready trend for ONE indicator (member-readable).
-- -----------------------------------------------------------------------------
create or replace function public.indicator_series(
  p_indicator uuid, p_from text default null, p_to text default null)
  returns table (
    period_label text, period_start date, value numeric, target numeric, status text)
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_ind public.indicators;
begin
  perform app.assert_quality_indicators_enabled();
  select * into v_ind from public.indicators where id = p_indicator;
  if v_ind is null then return; end if;
  if not (app.is_member_of(v_ind.commission_id)
          or app.is_commission_admin_of(v_ind.commission_id)) then
    return;
  end if;

  return query
  select m.period_label, m.period_start, m.value,
         v_ind.target_value as target, m.status
  from public.indicator_measurements m
  where m.indicator_id = p_indicator
    and (p_from is null or m.period_label >= p_from)
    and (p_to   is null or m.period_label <= p_to)
  order by m.period_start nulls last, m.period_label;
end;
$$;
alter function public.indicator_series(uuid, text, text) owner to postgres;

-- -----------------------------------------------------------------------------
-- 2 · indicator_kpis — commission scorecard counts (staff_admin/commission_admin).
--     Counts ACTIVE indicators by their LATEST measurement's status; no-measurement
--     indicators count as sem_dados.
-- -----------------------------------------------------------------------------
create or replace function public.indicator_kpis(p_commission uuid)
  returns table (total bigint, na_meta bigint, fora_da_meta bigint, sem_dados bigint)
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  perform app.assert_quality_indicators_enabled();
  if not (app.is_staff_admin_of(p_commission) or app.is_commission_admin_of(p_commission)) then
    return;
  end if;

  return query
  with latest as (
    select i.id,
           coalesce((
             select m.status from public.indicator_measurements m
             where m.indicator_id = i.id
             order by m.period_start nulls last, m.period_label desc
             limit 1
           ), 'sem_dados') as latest_status
    from public.indicators i
    where i.commission_id = p_commission and i.status = 'ativo'
  )
  select count(*)::bigint,
         count(*) filter (where latest_status = 'na_meta')::bigint,
         count(*) filter (where latest_status = 'fora_da_meta')::bigint,
         count(*) filter (where latest_status = 'sem_dados')::bigint
  from latest;
end;
$$;
alter function public.indicator_kpis(uuid) owner to postgres;

-- -----------------------------------------------------------------------------
-- 3 · hospital_indicator_rollup — PHI-free per-commission scorecard for the
--     hospital tier. Counts + commission NAME only (NO indicator name/definition/
--     value/description_md — minimum-necessary). Mirrors nsp_org_* rollups.
-- -----------------------------------------------------------------------------
create or replace function public.hospital_indicator_rollup(p_hospital uuid)
  returns table (
    commission_id uuid, commission_name text,
    total bigint, na_meta bigint, fora_da_meta bigint, sem_dados bigint)
  language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  perform app.assert_quality_indicators_enabled();
  -- Q3 gate: platform admin, hospital_admin of the hospital, or org_admin of the
  -- hospital's org (is_org_admin_of = role='org_admin', NO membership caveat).
  if not (app.is_admin()
          or app.is_hospital_admin_of(p_hospital)
          or app.is_org_admin_of(app.org_of_hospital(p_hospital))) then
    return;
  end if;

  return query
  with per_ind as (
    select i.commission_id,
           coalesce((
             select m.status from public.indicator_measurements m
             where m.indicator_id = i.id
             order by m.period_start nulls last, m.period_label desc
             limit 1
           ), 'sem_dados') as latest_status
    from public.indicators i
    join public.commissions c on c.id = i.commission_id
    where c.hospital_id = p_hospital and i.status = 'ativo'
  )
  select c.id, c.name,
         count(pi.commission_id)::bigint,
         count(*) filter (where pi.latest_status = 'na_meta')::bigint,
         count(*) filter (where pi.latest_status = 'fora_da_meta')::bigint,
         count(*) filter (where pi.latest_status = 'sem_dados')::bigint
  from public.commissions c
  left join per_ind pi on pi.commission_id = c.id
  where c.hospital_id = p_hospital
  group by c.id, c.name
  order by c.name;
end;
$$;
alter function public.hospital_indicator_rollup(uuid) owner to postgres;

-- -----------------------------------------------------------------------------
-- 4 · t19 grant hygiene.
-- -----------------------------------------------------------------------------
do $$
declare
  v_fn text;
  v_sigs text[] := array[
    'public.indicator_series(uuid, text, text)',
    'public.indicator_kpis(uuid)',
    'public.hospital_indicator_rollup(uuid)'
  ];
begin
  foreach v_fn in array v_sigs loop
    execute format('revoke all on function %s from public', v_fn);
    execute format('grant execute on function %s to authenticated, service_role', v_fn);
  end loop;
end $$;
