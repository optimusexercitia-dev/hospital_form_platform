-- ----------------------------------------------------------------------------
-- form-model-normalization (BE-5 cont.) — option-code existence in the template
-- recommend_when / result_ruleset validators.
-- ----------------------------------------------------------------------------
-- The cross-phase recommend_when ANSWER conditions and the per-phase
-- result_ruleset rule `when`s store the option CODE (the answer_map is
-- code-keyed). Extend both validators so a referenced choice-question value code
-- must actually exist on that question in the relevant published version — the
-- analogue of the form-level validate_visible_when code check (BE-5). Previously
-- the value was unvalidated against the option set.
--
-- Both functions are re-stated VERBATIM from their latest definitions
-- (recommend_when: 20260630000004; result_ruleset: 20260620020000) with ONLY the
-- code-existence check added. The evaluator is unchanged.
-- ----------------------------------------------------------------------------

SET check_function_bodies = false;
SET client_min_messages = warning;

-- ===========================================================================
-- validate_template_recommend_when — answer branch now also asserts the value
-- codes exist on the referenced choice question (HC016, like the missing-key case).
-- ===========================================================================
create or replace function app.validate_template_recommend_when(
  p_template_id uuid, p_position integer, p_recommend_when jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  rc jsonb;                -- one sub-condition
  v_commission_id uuid;
  v_from_phase integer;
  v_question_key text;
  v_source_form_id uuid;
  v_source_version uuid;
  v_source_emits boolean;
  v_source_allowed jsonb;
  v_is_result boolean;
  v_id uuid;
  v_target_type text;
begin
  if p_recommend_when is null then
    return true;
  end if;

  select commission_id into v_commission_id
  from public.process_templates
  where id = p_template_id;

  for rc in select cond from app.recommend_when_conditions(p_recommend_when) cond loop
    v_from_phase := (rc ->> 'from_phase')::integer;
    v_is_result := (rc ->> 'source') = 'result';

    if v_from_phase is null or v_from_phase < 1 or v_from_phase >= p_position then
      raise exception
        'a recomendação da fase % deve referenciar uma fase anterior (fase informada: %)',
        p_position, coalesce(v_from_phase::text, 'nula')
        using errcode = 'HC016';
    end if;

    select form_id, emits_result, allowed_result_ids
      into v_source_form_id, v_source_emits, v_source_allowed
    from public.process_template_phases
    where template_id = p_template_id and position = v_from_phase;

    if v_source_form_id is null then
      raise exception
        'a recomendação da fase % referencia a fase %, que não existe no processo',
        p_position, v_from_phase
        using errcode = 'HC016';
    end if;

    if v_is_result then
      if not coalesce(v_source_emits, false) then
        raise exception
          'a recomendação da fase % usa o resultado da fase %, que não emite resultado',
          p_position, v_from_phase
          using errcode = 'HC063';
      end if;

      if not (rc ? 'adverse') then
        for v_id in
          select (e #>> '{}')::uuid
          from jsonb_array_elements(
                 case when jsonb_typeof(rc -> 'value') = 'array'
                      then rc -> 'value'
                      else jsonb_build_array(rc -> 'value') end
               ) e
        loop
          if v_id is null then
            raise exception
              'a recomendação da fase % referencia um resultado inválido', p_position
              using errcode = 'HC064';
          end if;
          if v_source_allowed is null or not exists (
            select 1 from jsonb_array_elements_text(v_source_allowed) as a(id)
            where a.id::uuid = v_id
          ) then
            raise exception
              'a recomendação da fase % referencia um resultado que não está entre as opções permitidas da fase %',
              p_position, v_from_phase
              using errcode = 'HC064';
          end if;
          if not exists (
            select 1 from public.phase_results
            where id = v_id and commission_id = v_commission_id and archived = false
          ) then
            raise exception
              'a recomendação da fase % referencia uma opção de resultado inválida ou arquivada',
              p_position
              using errcode = 'HC064';
          end if;
        end loop;
      end if;
    else
      -- Answer condition: question_key must exist as an input item; and (NEW) the
      -- value codes must exist on it when it is a choice question.
      v_question_key := rc ->> 'question_key';

      v_source_version := app.published_version_of_form(v_source_form_id);
      if v_source_version is null then
        raise exception
          'o formulário da fase % (origem da recomendação) ainda não foi publicado',
          v_from_phase
          using errcode = 'HC017';
      end if;

      if not app.version_has_input_key(v_source_version, v_question_key) then
        raise exception
          'a recomendação da fase % referencia a pergunta "%", que não existe no formulário da fase %',
          p_position, v_question_key, v_from_phase
          using errcode = 'HC016';
      end if;

      -- form-model-normalization: the answer value(s) are option CODES; assert
      -- they exist on the choice question (no-op for non-choice targets).
      v_target_type := app.item_question_type(v_source_version, v_question_key);
      perform app.assert_condition_value_codes(
        v_source_version, v_question_key, v_target_type, rc -> 'value',
        format('a recomendação da fase %s', p_position)
      );
    end if;
  end loop;

  return true;
end;
$$;

alter function app.validate_template_recommend_when(uuid, integer, jsonb) owner to postgres;

-- ===========================================================================
-- validate_template_result_ruleset — each rule's `when` references THIS phase's
-- pinned published version; assert the when value codes exist on the choice
-- question (HC016), in addition to the existing key-exists + result-id checks.
-- Re-stated from 20260620020000_phase_results.sql with ONLY the code check added.
-- ===========================================================================
create or replace function app.validate_template_result_ruleset(
  p_template_id uuid, p_position integer, p_result_ruleset jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission_id uuid;
  v_form_id uuid;
  v_version uuid;
  r_rule jsonb;
  v_qkey text;
  v_result_id uuid;
  v_default_id uuid;
  v_target_type text;
begin
  if p_result_ruleset is null then
    return true;
  end if;

  select t.commission_id, ph.form_id
    into v_commission_id, v_form_id
  from public.process_template_phases ph
  join public.process_templates t on t.id = ph.template_id
  where ph.template_id = p_template_id and ph.position = p_position;

  if v_form_id is null then
    raise exception 'fase % não encontrada no processo', p_position
      using errcode = 'no_data_found';
  end if;

  v_version := app.published_version_of_form(v_form_id);
  if v_version is null then
    raise exception 'o formulário da fase % ainda não foi publicado', p_position
      using errcode = 'HC017';
  end if;

  for r_rule in select * from jsonb_array_elements(p_result_ruleset -> 'rules')
  loop
    v_qkey := r_rule -> 'when' ->> 'question_key';
    if v_qkey is null or not app.version_has_input_key(v_version, v_qkey) then
      raise exception
        'o resultado da fase % referencia a pergunta "%", que não existe no formulário publicado',
        p_position, coalesce(v_qkey, 'nula')
        using errcode = 'HC016';
    end if;

    -- form-model-normalization: the when value(s) are option CODES; assert they
    -- exist on the choice question (no-op for non-choice targets).
    v_target_type := app.item_question_type(v_version, v_qkey);
    perform app.assert_condition_value_codes(
      v_version, v_qkey, v_target_type, r_rule -> 'when' -> 'value',
      format('o resultado da fase %s', p_position)
    );

    v_result_id := (r_rule ->> 'result_id')::uuid;
    if v_result_id is null or not exists (
      select 1 from public.phase_results
      where id = v_result_id and commission_id = v_commission_id and archived = false
    ) then
      raise exception
        'o resultado da fase % referencia uma opção de resultado inválida ou arquivada',
        p_position
        using errcode = 'HC059';
    end if;
  end loop;

  v_default_id := (p_result_ruleset ->> 'default_result_id')::uuid;
  if v_default_id is not null and not exists (
    select 1 from public.phase_results
    where id = v_default_id and commission_id = v_commission_id and archived = false
  ) then
    raise exception
      'o resultado padrão da fase % é uma opção inválida ou arquivada', p_position
      using errcode = 'HC059';
  end if;

  return true;
end;
$$;

alter function app.validate_template_result_ruleset(uuid, integer, jsonb) owner to postgres;
