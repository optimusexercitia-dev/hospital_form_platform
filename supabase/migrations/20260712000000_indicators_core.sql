-- =============================================================================
-- Phase 15 — Quality Indicators (Indicadores de Qualidade) · task B2
-- Core schema: public.indicators + public.indicator_measurements, per-commission
-- code mint, the quality_indicators flag (OFF), RLS (posture (b): DEFINER-RPC-only
-- writes — member-read SELECT policy + grant, NO direct write grant/policy), and
-- audit AFTER-triggers (non-sensitive allow-list; NEVER description_md/note).
--
-- Plan: docs/plans/phase-15-indicators-backend.md §1 · ADR 0057 · Rules 1, 8, 11.
-- Additive, forward-only. New SQLSTATEs from HC084 (this migration allocates none;
-- the RPCs in later migrations do).
--
-- LEAD DECISIONS folded in (2026-07-05):
--   Q1 → posture (b): DEFINER-RPC-only writes (least-privilege greenfield surface;
--        value/status always RPC-computed). Authority (staff_admin OR
--        commission_admin) lives in the RPC gate, not a direct-write policy.
--   Manual `taxa` allowed: kind↔data_source coherence is TWO one-way CHECKs, not a
--        biconditional — a hand-tabulated rate (manual numerator + denominator) is
--        a common hospital case.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · public.indicators — a managed quality indicator. Commission-owned.
-- -----------------------------------------------------------------------------
create table public.indicators (
  id                uuid primary key default gen_random_uuid(),
  commission_id     uuid not null references public.commissions(id) on delete restrict,
  code              text not null,                       -- per-commission mint 'IND-####'
  name              text not null check (length(btrim(name)) > 0),
  description_md    text,                                -- sanitized Markdown (Rule 7); NEVER audited
  kind              text not null
                      check (kind in ('percentual', 'taxa', 'contagem', 'tempo_medio')),
  numerator_label   text,
  denominator_label text,
  unit              text,
  direction         text not null default 'maior_melhor'
                      check (direction in ('maior_melhor', 'menor_melhor')),
  target_value      numeric,
  target_comparator text not null default '>='
                      check (target_comparator in ('>=', '<=', '=', '>', '<')),
  lower_warn        numeric,
  upper_warn        numeric,
  frequency         text not null default 'mensal'
                      check (frequency in ('mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
  data_source       text not null default 'manual'
                      check (data_source in ('manual', 'derivado', 'hibrido')),
  derived_config    jsonb,                               -- null iff data_source='manual'
  status            text not null default 'ativo'
                      check (status in ('ativo', 'arquivado')),
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint indicators_commission_code_uq unique (commission_id, code),

  -- data_source/config coherence: manual ⇔ config null.
  constraint indicators_manual_config_ck
    check ((data_source = 'manual') = (derived_config is null)),

  -- kind ↔ data_source coherence (two one-way implications; NOT a biconditional —
  -- allows a fully MANUAL taxa). hibrido ⇒ taxa; derivado ⇒ non-taxa.
  -- Net: taxa ∈ {manual, hibrido}; percentual/contagem/tempo_medio ∈ {manual, derivado}.
  constraint indicators_hibrido_is_taxa_ck
    check (data_source <> 'hibrido' or kind = 'taxa'),
  constraint indicators_derivado_not_taxa_ck
    check (data_source <> 'derivado' or kind in ('percentual', 'contagem', 'tempo_medio'))
);

comment on table public.indicators is
  'Phase 15: a managed quality indicator (numerator/denominator, target, periodicity, '
  'direction) measured over time. Commission-owned; the hospital tier sees only the '
  'read-only hospital_indicator_rollup (no table grant). PHI-free aggregate metric. '
  'derived_config shape validated in the RPC layer via version_has_option_code.';
comment on column public.indicators.derived_config is
  'jsonb; null iff data_source=manual. percentual/contagem: {form_id, numerator:'
  '{question_key, option_codes[]}, denominator:{question_key}|"respondentes"}; '
  'tempo_medio: {form_id, value:{question_key}}; hibrido: {form_id, numerator:'
  '{question_key, option_codes[]}} (denominator supplied per measurement). References '
  'option CODEs (never labels/ids). NOT audited (may embed labels).';
comment on column public.indicators.description_md is
  'Sanitized Markdown (Rule 7). NEVER copied into the audit log (Rule 11).';

create index indicators_commission_id_idx on public.indicators (commission_id);
create index indicators_commission_status_idx
  on public.indicators (commission_id, status) where status = 'ativo';

-- -----------------------------------------------------------------------------
-- 2 · public.indicator_measurements — one measurement per (indicator, period).
-- -----------------------------------------------------------------------------
create table public.indicator_measurements (
  id            uuid primary key default gen_random_uuid(),
  indicator_id  uuid not null references public.indicators(id) on delete cascade,
  period_label  text not null check (length(btrim(period_label)) > 0),  -- e.g. '2026-06'
  period_start  date,
  period_end    date,
  numerator     numeric,
  denominator   numeric,
  value         numeric,
  status        text not null default 'sem_dados'
                  check (status in ('na_meta', 'fora_da_meta', 'sem_dados')),
  source        text not null check (source in ('manual', 'derivado')),
  note          text,
  entered_by    uuid references auth.users(id),
  entered_at    timestamptz not null default now(),

  constraint indicator_measurements_period_uq unique (indicator_id, period_label),
  -- zero-denominator belt (the RPC raises HC087 with a friendly message first).
  constraint indicator_measurements_denominator_nonzero_ck
    check (denominator is null or denominator <> 0)
);

comment on table public.indicator_measurements is
  'Phase 15: a single measurement of an indicator for one period. value/status are '
  'RPC-computed (posture (b) — no direct write path). status is STORED so KPIs/rollup '
  'aggregate without recomputing; re-derived on value/target change. Editable by '
  'staff_admin via the RPCs; every change audited (Rule 11) — corrections are '
  'contemporaneous + attributable, never silently overwritten.';
comment on column public.indicator_measurements.note is
  'Free-text; NEVER copied into the audit log (Rule 11).';

create index indicator_measurements_indicator_id_idx
  on public.indicator_measurements (indicator_id);

-- -----------------------------------------------------------------------------
-- 3 · app.mint_indicator_code() — per-commission 'IND-####' (mirrors
--     app.mint_meeting_number / app.mint_capa_code: per-commission advisory lock
--     + per-commission MAX+1).
-- -----------------------------------------------------------------------------
create or replace function app.mint_indicator_code() returns trigger
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_next integer;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('indicator_code:' || new.commission_id::text, 0));

  v_next := coalesce(
    (select max((substring(code from 5))::integer)
     from public.indicators
     where code ~ '^IND-[0-9]+$' and commission_id = new.commission_id),
    0
  ) + 1;

  new.code := 'IND-' || lpad(v_next::text, 4, '0');
  return new;
end;
$$;
alter function app.mint_indicator_code() owner to postgres;

create trigger mint_indicator_code_trg
  before insert on public.indicators
  for each row execute function app.mint_indicator_code();

-- Keep updated_at fresh on any UPDATE (mirrors the platform touch-updated pattern).
create or replace function app.touch_indicator_updated() returns trigger
  language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
alter function app.touch_indicator_updated() owner to postgres;

create trigger touch_indicator_updated_trg
  before update on public.indicators
  for each row execute function app.touch_indicator_updated();

-- -----------------------------------------------------------------------------
-- 4 · Feature flag (OFF) + assert helper + public read shim. Flips ON in B6.
-- -----------------------------------------------------------------------------
insert into app.feature_flags (key, enabled, description)
values ('quality_indicators', false, 'Indicadores de qualidade (Fase 15)')
on conflict (key) do update set description = excluded.description;

create or replace function app.assert_quality_indicators_enabled() returns void
  language plpgsql stable
  set search_path to 'app', 'public', 'pg_catalog'
as $$
begin
  if not app.feature_enabled('quality_indicators') then
    raise exception 'o recurso de indicadores de qualidade não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;
alter function app.assert_quality_indicators_enabled() owner to postgres;

-- -----------------------------------------------------------------------------
-- 5 · RLS — posture (b): member-read SELECT policy + grant; NO direct write.
--     Every write flows through the DEFINER RPCs (B3/B4). Rule 1.
-- -----------------------------------------------------------------------------
alter table public.indicators enable row level security;
alter table public.indicator_measurements enable row level security;

-- Member-read (the exact live forms_select / meetings_select shape, post-ADR-0051:
-- is_member_of OR is_commission_admin_of — the combined org_admin/hospital_admin
-- predicate that replaced is_org_admin_of_commission).
create policy "indicators_select" on public.indicators
  for select to authenticated
  using (
    app.is_member_of(commission_id) or app.is_commission_admin_of(commission_id)
  );

create policy "indicator_measurements_select" on public.indicator_measurements
  for select to authenticated
  using (
    exists (
      select 1 from public.indicators i
      where i.id = indicator_measurements.indicator_id
        and (app.is_member_of(i.commission_id)
             or app.is_commission_admin_of(i.commission_id))
    )
  );

-- No INSERT/UPDATE/DELETE policy (posture (b)). Grant SELECT only; belt-and-braces
-- revoke of any re-inherited write grant (C-2 posture — the tables are created as
-- postgres, so the revoke-default already applies; this asserts it).
grant select on public.indicators to authenticated;
grant select on public.indicator_measurements to authenticated;
revoke insert, update, delete on public.indicators from authenticated;
revoke insert, update, delete on public.indicator_measurements from authenticated;

-- -----------------------------------------------------------------------------
-- 6 · Audit AFTER-triggers (Rule 11) — non-sensitive column allow-lists; NEVER
--     description_md / note / derived_config. audit_write derives org+hospital
--     from the commission internally (8-arg fn; 6 positional args here).
-- -----------------------------------------------------------------------------
create or replace function app.trg_audit_indicators() returns trigger
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  -- Non-sensitive allow-list: definition/target/lifecycle fields only. Excludes
  -- description_md (free-text, Rule 11) and derived_config (may embed labels).
  c_cols constant text[] := array[
    'name', 'kind', 'direction', 'target_value', 'target_comparator',
    'frequency', 'data_source', 'status'
  ];
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('indicator.created', 'indicator', new.id, new.commission_id,
      'Indicador criado: ' || new.code,
      app.audit_diff(null, to_jsonb(new), c_cols));
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status and new.status = 'arquivado' then
      perform app.audit_write('indicator.archived', 'indicator', new.id, new.commission_id,
        'Indicador arquivado: ' || new.code,
        app.audit_diff(to_jsonb(old), to_jsonb(new), c_cols));
    else
      perform app.audit_write('indicator.updated', 'indicator', new.id, new.commission_id,
        'Indicador atualizado: ' || new.code,
        app.audit_diff(to_jsonb(old), to_jsonb(new), c_cols));
    end if;
  elsif tg_op = 'DELETE' then
    perform app.audit_write('indicator.deleted', 'indicator', old.id, old.commission_id,
      'Indicador removido: ' || old.code,
      app.audit_diff(to_jsonb(old), null, c_cols));
  end if;
  return null;
end;
$$;
alter function app.trg_audit_indicators() owner to postgres;

create trigger audit_indicators_trg
  after insert or update or delete on public.indicators
  for each row execute function app.trg_audit_indicators();

create or replace function app.trg_audit_indicator_measurements() returns trigger
  language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  c_cols constant text[] := array[
    'period_label', 'numerator', 'denominator', 'value', 'status', 'source'
  ];
  v_commission uuid;
  v_code text;
  v_indicator uuid := coalesce(new.indicator_id, old.indicator_id);
begin
  -- Resolve the owning commission + code for the audit attribution + summary.
  select i.commission_id, i.code into v_commission, v_code
  from public.indicators i where i.id = v_indicator;
  if v_commission is null then
    return null;  -- indicator gone (cascade delete path); nothing to attribute.
  end if;

  if tg_op = 'INSERT' then
    perform app.audit_write('indicator_measurement.recorded', 'indicator_measurement',
      new.id, v_commission,
      'Medição registrada (' || v_code || ' · ' || new.period_label || ')',
      app.audit_diff(null, to_jsonb(new), c_cols));
  elsif tg_op = 'UPDATE' then
    perform app.audit_write('indicator_measurement.updated', 'indicator_measurement',
      new.id, v_commission,
      'Medição atualizada (' || v_code || ' · ' || new.period_label || ')',
      app.audit_diff(to_jsonb(old), to_jsonb(new), c_cols));
  elsif tg_op = 'DELETE' then
    perform app.audit_write('indicator_measurement.deleted', 'indicator_measurement',
      old.id, v_commission,
      'Medição removida (' || v_code || ' · ' || old.period_label || ')',
      app.audit_diff(to_jsonb(old), null, c_cols));
  end if;
  return null;
end;
$$;
alter function app.trg_audit_indicator_measurements() owner to postgres;

create trigger audit_indicator_measurements_trg
  after insert or update or delete on public.indicator_measurements
  for each row execute function app.trg_audit_indicator_measurements();
