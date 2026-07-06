-- =============================================================================
-- Phase 15 — Quality Indicators · task B4  (ADR 0058 — the parity lock)
-- compute_derived_measurement(indicator, period, p_denominator := null) DEFINER.
-- Derived kinds compute fully from submitted-form aggregates; the value EQUALS
-- public.dashboard_distributions for the same form + window BY CONSTRUCTION — the
-- compute re-uses the SAME submitted spine (app.submitted_form_responses), the
-- SAME option-code join chain, and the SAME window predicate (submitted_at::date),
-- so it does NOT call the dashboard RPC (whose gate + row shape differ).
--
--   percentual/contagem: numerator = COUNT(selections) over the config's option
--     codes for the numerator question_key; denominator = the dashboard `denom`
--     (distinct responses that answered ANY question in that key's SECTION) OR
--     count(*) of windowed responses ('respondentes').
--   tempo_medio: value = avg(answers.value_number) over the numeric question_key.
--   hibrido (taxa): derived numerator + MANUAL denominator, ONE-STEP, born
--     complete; recompute preserves the stored denominator unless re-passed.
--
-- Plan §3 · ADR 0058. SQLSTATEs: HC084 (config), HC085 (compute on a MANUAL
-- indicator, incl. a manual taxa), HC087 (zero/invalid denom), HC088 (hybrid
-- denominator required + none stored to reuse).
-- =============================================================================

create or replace function public.compute_derived_measurement(
  p_indicator uuid,
  p_period_label text,
  p_denominator numeric default null,
  p_period_start date default null,
  p_period_end date default null)
  returns public.indicator_measurements language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_ind        public.indicators;
  v_form       uuid;
  v_qk         text;
  v_codes      text[];
  v_num        numeric;
  v_den        numeric;
  v_value      numeric;
  v_status     text;
  v_from       date := p_period_start;
  v_to         date := p_period_end;
  v_den_ref    jsonb;
  v_den_qk     text;
  v_existing   numeric;   -- stored denominator (hybrid preserve rule)
  v_row        public.indicator_measurements;
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

  -- Route on data_source: a MANUAL indicator (incl. a manual taxa) uses the manual
  -- path, not this one.
  if v_ind.data_source = 'manual' then
    raise exception 'este indicador é manual; use o lançamento manual'
      using errcode = 'HC085';
  end if;

  v_form := nullif(v_ind.derived_config ->> 'form_id', '')::uuid;

  -- ---------------------------------------------------------------------------
  -- tempo_medio: avg(answers.value_number) over the numeric question_key.
  -- ---------------------------------------------------------------------------
  if v_ind.kind = 'tempo_medio' then
    v_qk := v_ind.derived_config #>> '{value,question_key}';
    select round(avg(a.value_number), 4), count(*)
      into v_value, v_num
    from app.submitted_form_responses(v_form) sr
    join public.answers a on a.response_id = sr.id
    join public.form_items fi on fi.id = a.item_id
    where fi.question_key = v_qk
      and a.value_number is not null
      and (v_from is null or sr.submitted_at::date >= v_from)
      and (v_to   is null or sr.submitted_at::date <= v_to);

    v_den := v_num;               -- n averaged (provenance)
    -- value = the average; numerator carries the average too (single scalar).
    v_num := v_value;
    v_status := app.indicator_classify(v_value, v_ind.target_value, v_ind.target_comparator);

  else
    -- -------------------------------------------------------------------------
    -- percentual / contagem / hibrido: numerator = selection count over the
    -- config's option codes (the dashboard `tally` restricted to those codes).
    -- -------------------------------------------------------------------------
    v_qk := v_ind.derived_config #>> '{numerator,question_key}';
    select array_agg(x) into v_codes
    from jsonb_array_elements_text(v_ind.derived_config #> '{numerator,option_codes}') x;

    -- COUNT of choice selections (answer_selected_options -> answers) over the
    -- windowed submitted responses whose item has this question_key + a selected
    -- option code in the config set. Mirrors dashboard_distributions.sel/tally.
    select count(*) into v_num
    from app.submitted_form_responses(v_form) sr
    join public.answers a on a.response_id = sr.id
    join public.form_items fi on fi.id = a.item_id
    join public.answer_selected_options s on s.answer_id = a.id
    join public.form_item_options o on o.id = s.option_id
    where fi.question_key = v_qk
      and fi.item_type in ('multiple_choice', 'dropdown', 'checkbox')
      and o.code = any(v_codes)
      and (v_from is null or sr.submitted_at::date >= v_from)
      and (v_to   is null or sr.submitted_at::date <= v_to);

    v_num := coalesce(v_num, 0);

    -- Denominator.
    if v_ind.data_source = 'hibrido' then
      -- Manual denominator, one-step + preserve rule.
      if p_denominator is not null then
        v_den := p_denominator;
      else
        select denominator into v_existing
        from public.indicator_measurements
        where indicator_id = p_indicator and period_label = btrim(p_period_label);
        if v_existing is not null then
          v_den := v_existing;          -- reuse stored denominator (numerator re-derived)
        else
          raise exception 'informe o denominador' using errcode = 'HC088';
        end if;
      end if;
      if v_den = 0 then
        raise exception 'o denominador deve ser diferente de zero' using errcode = 'HC087';
      end if;

    else
      -- derivado (percentual/contagem): denominator from the config ref.
      v_den_ref := v_ind.derived_config -> 'denominator';
      if jsonb_typeof(v_den_ref) = 'string' and (v_den_ref #>> '{}') = 'respondentes' then
        -- count(*) of windowed submitted responses.
        select count(*) into v_den
        from app.submitted_form_responses(v_form) sr
        where (v_from is null or sr.submitted_at::date >= v_from)
          and (v_to   is null or sr.submitted_at::date <= v_to);
      else
        -- {question_key}: distinct responses that answered ANY question in that
        -- key's SECTION (the dashboard `denom` semantics exactly).
        v_den_qk := v_den_ref ->> 'question_key';
        select count(distinct sr.id) into v_den
        from app.submitted_form_responses(v_form) sr
        join public.answers a2 on a2.response_id = sr.id
        join public.form_items fi2 on fi2.id = a2.item_id
        where fi2.item_type in ('multiple_choice', 'dropdown', 'checkbox')
          and fi2.section_id = (
            -- the section of the denominator question in the latest published version
            select fi3.section_id from public.form_items fi3
            where fi3.form_version_id = app.latest_published_version(v_form)
              and fi3.question_key = v_den_qk
            limit 1)
          and exists (
            select 1 from public.answer_selected_options s2 where s2.answer_id = a2.id)
          and (v_from is null or sr.submitted_at::date >= v_from)
          and (v_to   is null or sr.submitted_at::date <= v_to);
      end if;
    end if;

    -- Value: contagem reports the raw numerator; percentual/taxa use the ratio.
    if v_ind.kind = 'contagem' then
      v_value := v_num;
    else
      v_value := app.indicator_compute_value(v_ind.kind, v_num, v_den);
    end if;
    v_status := app.indicator_classify(v_value, v_ind.target_value, v_ind.target_comparator);
  end if;

  -- Upsert; source='derivado'. Born complete (no partial-measurement state).
  insert into public.indicator_measurements (
    indicator_id, period_label, period_start, period_end,
    numerator, denominator, value, status, source, entered_by
  ) values (
    p_indicator, btrim(p_period_label), p_period_start, p_period_end,
    v_num, v_den, v_value, v_status, 'derivado', auth.uid()
  )
  on conflict (indicator_id, period_label) do update set
    period_start = coalesce(excluded.period_start, indicator_measurements.period_start),
    period_end   = coalesce(excluded.period_end, indicator_measurements.period_end),
    numerator = excluded.numerator,
    denominator = excluded.denominator,
    value = excluded.value,
    status = excluded.status,
    source = 'derivado',
    entered_by = excluded.entered_by,
    entered_at = now()
  returning * into v_row;

  return v_row;
end;
$$;
alter function public.compute_derived_measurement(uuid, text, numeric, date, date)
  owner to postgres;

revoke all on function public.compute_derived_measurement(uuid, text, numeric, date, date)
  from public;
grant execute on function public.compute_derived_measurement(uuid, text, numeric, date, date)
  to authenticated, service_role;
