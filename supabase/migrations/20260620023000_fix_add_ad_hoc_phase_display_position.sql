-- Fix add_ad_hoc_phase: compute display_position across the merged
-- phases+narratives interleave so ad-hoc phases land at the true end
-- of the case layout instead of colliding with existing narratives.
--
-- Root cause: the original RPC computed `position` only from case_phases
-- (MAX(position)+1) and left display_position NULL, which the frontend
-- mergeCaseLayout resolves as coalesce(NULL, position) = phase number.
-- A case with Phase-1 (display_position=1) + Narrative-1 (display_position=2)
-- would give a new ad-hoc phase position=2 / display_position=2, placing it
-- BEFORE the narrative rather than after it.

CREATE OR REPLACE FUNCTION "public"."add_ad_hoc_phase"(
  "p_case_id" uuid,
  "p_form_id" uuid,
  "p_title" text DEFAULT NULL,
  "p_recommend_when" jsonb DEFAULT NULL,
  "p_assigned_to" uuid DEFAULT NULL
) RETURNS "public"."case_phases"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_case_status text;
  v_commission_id uuid;
  v_position integer;
  v_display_position integer;
  v_version uuid;
  v_from_phase integer;
  v_source_version uuid;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select status, commission_id into v_case_status, v_commission_id
  from public.cases where id = p_case_id;
  if v_case_status is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;

  if not exists (
    select 1 from public.forms where id = p_form_id and commission_id = v_commission_id
  ) then
    raise exception 'o formulário não pertence a esta comissão' using errcode = 'check_violation';
  end if;

  v_version := app.published_version_of_form(p_form_id);
  if v_version is null then
    raise exception 'este formulário ainda não foi publicado' using errcode = 'HC017';
  end if;

  -- Immutable phase number: counts only phases (referenced by blocks / recommend_when).
  select coalesce(max(position), 0) + 1 into v_position
  from public.case_phases where case_id = p_case_id;

  -- Display slot: next position in the merged phases+narratives interleave.
  -- Mirrors the add_template_narrative / get_case_detail coalesce convention:
  -- phases fall back to `position` when display_position is null.
  select coalesce(max(dp), 0) + 1 into v_display_position
  from (
    select coalesce(display_position, position) as dp
    from public.case_phases where case_id = p_case_id
    union all
    select display_position as dp
    from public.case_narratives where case_id = p_case_id
  ) s;

  -- Validate recommend_when against the existing (earlier) phases' pinned versions.
  if p_recommend_when is not null then
    v_from_phase := (p_recommend_when ->> 'from_phase')::integer;
    if v_from_phase is null or v_from_phase < 1 or v_from_phase >= v_position then
      raise exception 'a recomendação deve referenciar uma fase anterior'
        using errcode = 'HC016';
    end if;
    select form_version_id into v_source_version
    from public.case_phases where case_id = p_case_id and position = v_from_phase;
    if v_source_version is null then
      raise exception 'a recomendação referencia uma fase inexistente'
        using errcode = 'HC016';
    end if;
    if not app.version_has_input_key(v_source_version, p_recommend_when ->> 'question_key') then
      raise exception 'a recomendação referencia uma pergunta inexistente no formulário de origem'
        using errcode = 'HC016';
    end if;
  end if;

  if p_assigned_to is not null and not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  insert into public.case_phases
    (case_id, position, display_position, form_id, form_version_id, title,
     recommend_when, is_ad_hoc, assigned_to)
  values
    (p_case_id, v_position, v_display_position, p_form_id, v_version,
     nullif(btrim(p_title), ''), p_recommend_when, true, p_assigned_to)
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  perform public.recompute_recommendations(p_case_id);

  return v_result;
end;
$$;
