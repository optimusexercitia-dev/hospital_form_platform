-- =============================================================================
-- Phase 15 — Quality Indicators · task B3
-- CRUD RPCs (create/update/archive_indicator, set_indicator_target) +
-- record_indicator_measurement (manual), plus the shared value/classification
-- helpers and the derived_config save-time validator. All writes flow through
-- these SECURITY DEFINER RPCs (posture (b) — the tables have no direct write
-- grant); each enforces is_staff_admin_of OR is_commission_admin_of and computes
-- value/status.
--
-- Plan: docs/plans/phase-15-indicators-backend.md §2.1/§2.2/§3.1/§3.5.
-- SQLSTATEs: HC084 (invalid/unknown derived config or option code),
--            HC086 (manual RPC on a derived/hybrid indicator),
--            HC087 (zero/invalid denominator when the kind needs one).
-- Additive, forward-only.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Shared helpers: compute_value + classify_measurement (used by both the
--     manual record path [B3] and the derived compute path [B4]).
-- -----------------------------------------------------------------------------

-- Compute the reported value from (kind, numerator, denominator):
--   percentual → num/den*100 ; taxa → num/den*1000 ; contagem/tempo_medio → num.
-- Null when a needed denominator is null or zero (the caller raises HC087 first
-- for the friendly message; this is the arithmetic belt).
create or replace function app.indicator_compute_value(
  p_kind text, p_numerator numeric, p_denominator numeric)
  returns numeric language sql immutable
  set search_path to 'app', 'pg_catalog'
as $$
  select case
    when p_numerator is null then null
    when p_kind = 'percentual' then
      case when p_denominator is null or p_denominator = 0 then null
           else round(p_numerator / p_denominator * 100, 4) end
    when p_kind = 'taxa' then
      case when p_denominator is null or p_denominator = 0 then null
           else round(p_numerator / p_denominator * 1000, 4) end
    else p_numerator   -- contagem / tempo_medio: the numerator IS the value
  end;
$$;
alter function app.indicator_compute_value(text, numeric, numeric) owner to postgres;

-- Classify a value against (target, comparator). Comparator-driven — direction
-- does NOT flip the on/off decision (the comparator already encodes the pass
-- condition, e.g. >=90 for maior_melhor, <=2 for menor_melhor). sem_dados when
-- value or target is null.
create or replace function app.indicator_classify(
  p_value numeric, p_target numeric, p_comparator text)
  returns text language sql immutable
  set search_path to 'app', 'pg_catalog'
as $$
  select case
    when p_value is null or p_target is null then 'sem_dados'
    when (p_comparator = '>=' and p_value >= p_target)
      or (p_comparator = '<=' and p_value <= p_target)
      or (p_comparator = '='  and p_value =  p_target)
      or (p_comparator = '>'  and p_value >  p_target)
      or (p_comparator = '<'  and p_value <  p_target)
      then 'na_meta'
    else 'fora_da_meta'
  end;
$$;
alter function app.indicator_classify(numeric, numeric, text) owner to postgres;

-- -----------------------------------------------------------------------------
-- 2 · derived_config save-time validator. Checks shape-per-kind and that every
--     referenced option CODE (+ denominator question_key) exists in the form's
--     LATEST PUBLISHED version. Raises HC084 on any shape/code problem. Called by
--     create/update_indicator when data_source <> 'manual'.
-- -----------------------------------------------------------------------------
create or replace function app.validate_indicator_derived_config(
  p_commission uuid, p_kind text, p_data_source text, p_config jsonb)
  returns void language plpgsql stable
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_form uuid;
  v_version uuid;
  v_qk text;
  v_code text;
  v_den jsonb;
  v_codes jsonb;
begin
  if p_data_source = 'manual' then
    if p_config is not null then
      raise exception 'um indicador manual não tem configuração derivada'
        using errcode = 'HC084';
    end if;
    return;
  end if;

  if p_config is null then
    raise exception 'configuração derivada inválida' using errcode = 'HC084';
  end if;

  -- form_id must be a real form of THIS commission.
  v_form := nullif(p_config ->> 'form_id', '')::uuid;
  if v_form is null then
    raise exception 'configuração derivada inválida' using errcode = 'HC084';
  end if;
  if not exists (select 1 from public.forms f
                 where f.id = v_form and f.commission_id = p_commission) then
    raise exception 'configuração derivada inválida' using errcode = 'HC084';
  end if;

  v_version := app.latest_published_version(v_form);
  if v_version is null then
    raise exception 'o formulário não possui versão publicada' using errcode = 'HC084';
  end if;

  if p_kind = 'tempo_medio' then
    -- {form_id, value:{question_key}} over a numeric item.
    v_qk := nullif(p_config #>> '{value,question_key}', '');
    if v_qk is null then
      raise exception 'configuração derivada inválida' using errcode = 'HC084';
    end if;
    if not exists (select 1 from public.form_items i
                   where i.form_version_id = v_version and i.question_key = v_qk
                     and i.item_type = 'number') then
      raise exception 'configuração derivada inválida' using errcode = 'HC084';
    end if;
    return;
  end if;

  -- percentual / contagem / hibrido share the numerator shape:
  -- {question_key, option_codes[]} over a choice item.
  v_qk := nullif(p_config #>> '{numerator,question_key}', '');
  v_codes := p_config #> '{numerator,option_codes}';
  if v_qk is null or v_codes is null or jsonb_typeof(v_codes) <> 'array'
     or jsonb_array_length(v_codes) = 0 then
    raise exception 'configuração derivada inválida' using errcode = 'HC084';
  end if;
  for v_code in select jsonb_array_elements_text(v_codes) loop
    if not app.version_has_option_code(v_version, v_qk, v_code) then
      raise exception 'código de opção desconhecido: %', v_code using errcode = 'HC084';
    end if;
  end loop;

  -- hibrido stops here (denominator is supplied per measurement). percentual /
  -- contagem carry a denominator ref: {question_key} or the literal 'respondentes'.
  if p_data_source = 'derivado' then
    v_den := p_config -> 'denominator';
    if v_den is null then
      raise exception 'configuração derivada inválida' using errcode = 'HC084';
    end if;
    if jsonb_typeof(v_den) = 'string' then
      if (v_den #>> '{}') <> 'respondentes' then
        raise exception 'configuração derivada inválida' using errcode = 'HC084';
      end if;
    else
      v_qk := nullif(v_den ->> 'question_key', '');
      if v_qk is null then
        raise exception 'configuração derivada inválida' using errcode = 'HC084';
      end if;
      if not exists (select 1 from public.form_items i
                     where i.form_version_id = v_version and i.question_key = v_qk
                       and i.item_type in ('multiple_choice', 'dropdown', 'checkbox')) then
        raise exception 'configuração derivada inválida' using errcode = 'HC084';
      end if;
    end if;
  end if;
end;
$$;
alter function app.validate_indicator_derived_config(uuid, text, text, jsonb) owner to postgres;

-- -----------------------------------------------------------------------------
-- 3 · CRUD RPCs (gate: is_staff_admin_of OR is_commission_admin_of).
-- -----------------------------------------------------------------------------
create or replace function public.create_indicator(
  p_commission uuid,
  p_name text,
  p_kind text,
  p_direction text default 'maior_melhor',
  p_data_source text default 'manual',
  p_frequency text default 'mensal',
  p_target_comparator text default '>=',
  p_target_value numeric default null,
  p_numerator_label text default null,
  p_denominator_label text default null,
  p_unit text default null,
  p_description_md text default null,
  p_lower_warn numeric default null,
  p_upper_warn numeric default null,
  p_derived_config jsonb default null)
  returns public.indicators language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_row public.indicators;
begin
  perform app.assert_quality_indicators_enabled();
  if not (app.is_staff_admin_of(p_commission) or app.is_commission_admin_of(p_commission)) then
    raise exception 'você não pode gerenciar indicadores nesta comissão' using errcode = '42501';
  end if;

  perform app.validate_indicator_derived_config(
    p_commission, p_kind, p_data_source, p_derived_config);

  insert into public.indicators (
    commission_id, name, kind, direction, data_source, frequency,
    target_comparator, target_value, numerator_label, denominator_label, unit,
    description_md, lower_warn, upper_warn, derived_config, created_by
  ) values (
    p_commission, btrim(p_name), p_kind, p_direction, p_data_source, p_frequency,
    p_target_comparator, p_target_value, p_numerator_label, p_denominator_label, p_unit,
    p_description_md, p_lower_warn, p_upper_warn, p_derived_config, auth.uid()
  )
  returning * into v_row;

  return v_row;
end;
$$;
alter function public.create_indicator(uuid, text, text, text, text, text, text, numeric,
  text, text, text, text, numeric, numeric, jsonb) owner to postgres;

create or replace function public.update_indicator(
  p_id uuid,
  p_name text,
  p_kind text,
  p_direction text,
  p_data_source text,
  p_frequency text,
  p_target_comparator text,
  p_target_value numeric default null,
  p_numerator_label text default null,
  p_denominator_label text default null,
  p_unit text default null,
  p_description_md text default null,
  p_lower_warn numeric default null,
  p_upper_warn numeric default null,
  p_derived_config jsonb default null)
  returns public.indicators language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_row public.indicators;
  v_commission uuid;
begin
  perform app.assert_quality_indicators_enabled();
  select commission_id into v_commission from public.indicators where id = p_id;
  if v_commission is null then
    raise exception 'indicador não encontrado' using errcode = 'check_violation';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'você não pode gerenciar indicadores nesta comissão' using errcode = '42501';
  end if;

  perform app.validate_indicator_derived_config(
    v_commission, p_kind, p_data_source, p_derived_config);

  update public.indicators set
    name = btrim(p_name), kind = p_kind, direction = p_direction,
    data_source = p_data_source, frequency = p_frequency,
    target_comparator = p_target_comparator, target_value = p_target_value,
    numerator_label = p_numerator_label, denominator_label = p_denominator_label,
    unit = p_unit, description_md = p_description_md,
    lower_warn = p_lower_warn, upper_warn = p_upper_warn,
    derived_config = p_derived_config
  where id = p_id
  returning * into v_row;

  -- Re-classify existing measurements against the (possibly changed) target/kind.
  perform app.reclassify_indicator_measurements(p_id);
  return v_row;
end;
$$;
alter function public.update_indicator(uuid, text, text, text, text, text, text, numeric,
  text, text, text, text, numeric, numeric, jsonb) owner to postgres;

create or replace function public.archive_indicator(p_id uuid)
  returns public.indicators language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_row public.indicators;
  v_commission uuid;
begin
  perform app.assert_quality_indicators_enabled();
  select commission_id into v_commission from public.indicators where id = p_id;
  if v_commission is null then
    raise exception 'indicador não encontrado' using errcode = 'check_violation';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'você não pode gerenciar indicadores nesta comissão' using errcode = '42501';
  end if;

  update public.indicators set status = 'arquivado' where id = p_id
  returning * into v_row;
  return v_row;
end;
$$;
alter function public.archive_indicator(uuid) owner to postgres;

-- Re-classify all measurements of an indicator against its current target/kind.
-- Internal (app) — called by update_indicator / set_indicator_target.
create or replace function app.reclassify_indicator_measurements(p_indicator uuid)
  returns void language plpgsql
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_ind public.indicators;
begin
  select * into v_ind from public.indicators where id = p_indicator;
  if v_ind is null then return; end if;

  update public.indicator_measurements m set
    status = app.indicator_classify(m.value, v_ind.target_value, v_ind.target_comparator)
  where m.indicator_id = p_indicator
    and m.status is distinct from
        app.indicator_classify(m.value, v_ind.target_value, v_ind.target_comparator);
end;
$$;
alter function app.reclassify_indicator_measurements(uuid) owner to postgres;

create or replace function public.set_indicator_target(
  p_id uuid,
  p_target_value numeric,
  p_target_comparator text,
  p_lower_warn numeric default null,
  p_upper_warn numeric default null)
  returns public.indicators language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_row public.indicators;
  v_commission uuid;
begin
  perform app.assert_quality_indicators_enabled();
  select commission_id into v_commission from public.indicators where id = p_id;
  if v_commission is null then
    raise exception 'indicador não encontrado' using errcode = 'check_violation';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_commission_admin_of(v_commission)) then
    raise exception 'você não pode gerenciar indicadores nesta comissão' using errcode = '42501';
  end if;

  update public.indicators set
    target_value = p_target_value, target_comparator = p_target_comparator,
    lower_warn = p_lower_warn, upper_warn = p_upper_warn
  where id = p_id
  returning * into v_row;

  perform app.reclassify_indicator_measurements(p_id);
  return v_row;
end;
$$;
alter function public.set_indicator_target(uuid, numeric, text, numeric, numeric) owner to postgres;

-- -----------------------------------------------------------------------------
-- 4 · record_indicator_measurement (MANUAL). Upsert on (indicator, period);
--     computes value + status. HC086 keys on data_source (a manual taxa is valid
--     here); HC087 on zero/invalid denominator when the kind needs one.
-- -----------------------------------------------------------------------------
create or replace function public.record_indicator_measurement(
  p_indicator uuid,
  p_period_label text,
  p_numerator numeric,
  p_denominator numeric default null,
  p_note text default null,
  p_period_start date default null,
  p_period_end date default null)
  returns public.indicator_measurements language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_ind public.indicators;
  v_value numeric;
  v_status text;
  v_row public.indicator_measurements;
begin
  perform app.assert_quality_indicators_enabled();
  select * into v_ind from public.indicators where id = p_indicator;
  if v_ind is null then
    raise exception 'indicador não encontrado' using errcode = 'check_violation';
  end if;
  if not (app.is_staff_admin_of(v_ind.commission_id)
          or app.is_commission_admin_of(v_ind.commission_id)) then
    raise exception 'você não pode lançar medições nesta comissão' using errcode = '42501';
  end if;

  -- Route on data_source, NOT kind: a MANUAL taxa is valid here; derivado/hibrido
  -- must use compute_derived_measurement.
  if v_ind.data_source <> 'manual' then
    raise exception 'este indicador é derivado; use o cálculo automático'
      using errcode = 'HC086';
  end if;

  -- Percentual + taxa need a non-zero denominator.
  if v_ind.kind in ('percentual', 'taxa')
     and (p_denominator is null or p_denominator = 0) then
    raise exception 'o denominador deve ser diferente de zero' using errcode = 'HC087';
  end if;

  v_value := app.indicator_compute_value(v_ind.kind, p_numerator, p_denominator);
  v_status := app.indicator_classify(v_value, v_ind.target_value, v_ind.target_comparator);

  insert into public.indicator_measurements (
    indicator_id, period_label, period_start, period_end,
    numerator, denominator, value, status, source, note, entered_by
  ) values (
    p_indicator, btrim(p_period_label), p_period_start, p_period_end,
    p_numerator, p_denominator, v_value, v_status, 'manual', p_note, auth.uid()
  )
  on conflict (indicator_id, period_label) do update set
    period_start = excluded.period_start,
    period_end = excluded.period_end,
    numerator = excluded.numerator,
    denominator = excluded.denominator,
    value = excluded.value,
    status = excluded.status,
    source = 'manual',
    note = excluded.note,
    entered_by = excluded.entered_by,
    entered_at = now()
  returning * into v_row;

  return v_row;
end;
$$;
alter function public.record_indicator_measurement(uuid, text, numeric, numeric, text, date, date)
  owner to postgres;

-- -----------------------------------------------------------------------------
-- 5 · t19 grant hygiene — new public.* RPCs are PUBLIC-executable by default;
--     revoke + grant authenticated/service_role only (C-2 posture).
-- -----------------------------------------------------------------------------
do $$
declare
  v_fn text;
  v_sigs text[] := array[
    'public.create_indicator(uuid, text, text, text, text, text, text, numeric, text, text, text, text, numeric, numeric, jsonb)',
    'public.update_indicator(uuid, text, text, text, text, text, text, numeric, text, text, text, text, numeric, numeric, jsonb)',
    'public.archive_indicator(uuid)',
    'public.set_indicator_target(uuid, numeric, text, numeric, numeric)',
    'public.record_indicator_measurement(uuid, text, numeric, numeric, text, date, date)'
  ];
begin
  foreach v_fn in array v_sigs loop
    execute format('revoke all on function %s from public', v_fn);
    execute format('grant execute on function %s to authenticated, service_role', v_fn);
  end loop;
end $$;
