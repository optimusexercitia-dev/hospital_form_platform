-- ============================================================================
-- FBE-006: allow the reserved AGGREGATE synthetic keys in a phase result ruleset
-- at SAVE time (add_template_phase / update_template_phase →
-- app.validate_template_result_ruleset). The compute side (20260713000700)
-- injects `__total_score__` / `__flagged_count__` into the answer map, but the
-- SAVE-side validator rejected any rule whose question_key is not a real input
-- item (version_has_input_key = false → HC016), so an author could never PERSIST
-- an "Pontuação total" / "Itens marcados" rule — the feature was unusable
-- end-to-end.
--
-- FIX: whitelist the two reserved aggregate keys before the input-key existence
-- check (the same intent as the recommendation validator's synthetic-key bypass
-- for `__phase_result__`, which skips version_has_input_key for its result-source
-- branch). A reserved-key rule needs NO option-code assertion (its value is a
-- plain number compared with an ordered op), so we also skip
-- assert_condition_value_codes for it. Everything else — the result_id / default
-- vocabulary checks, and HC016 for a genuinely-unknown key — is UNCHANGED.
--
-- Collision-safe: `__…__` can never be an author question_key (slugifyLabel
-- strips leading/trailing `_`), so the allowlist can never shadow a real key.
--
-- Forward-only CREATE OR REPLACE; pre-launch reset is fine.
-- ============================================================================

create or replace function app.validate_template_result_ruleset(
  p_template_id uuid,
  p_position integer,
  p_result_ruleset jsonb
) returns boolean
    language plpgsql stable security definer
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

    -- FBE-006: the reserved AGGREGATE synthetic keys are valid rule targets that do
    -- NOT correspond to an input item (they are injected at compute time). Bypass
    -- the input-key existence check AND the option-code assertion for them; still
    -- validate the rule's result_id below. Mirrors the recommendation validator's
    -- synthetic-key handling for __phase_result__.
    if v_qkey in ('__total_score__', '__flagged_count__') then
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
      continue;
    end if;

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
