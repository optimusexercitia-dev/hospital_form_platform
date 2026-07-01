-- ----------------------------------------------------------------------------
-- form-model-normalization (BUG-FMN-002) — canonical by-item_id answer map +
-- fix get_response_for_signoff.
-- ----------------------------------------------------------------------------
-- app.answer_map is keyed by question_key (for the evaluator). The sign-off
-- review surface (get_response_for_signoff.answers_by_item) needs the SAME
-- reconstructed values keyed by item_id::text. Before this, answers_by_item read
-- answers.value directly, so every CHOICE answer (now in answer_selected_options)
-- was omitted from the review — the MC/checkbox label never rendered (FBE AC-14).
--
-- This introduces app.answer_map_by_item(response_id) as the ONE canonical SQL
-- home for the by-item materialization (the SQL twin of TS buildAnswerMaps'
-- answersByItemId), mirroring how app.answer_map is the by-question_key home. Then
-- get_response_for_signoff uses it. Same value shapes as app.answer_map:
--   * scalar inputs -> raw answers.value
--   * single-select (multiple_choice/dropdown) -> scalar option code
--   * checkbox -> array of codes ordered by option.position
-- Evaluator UNCHANGED. Forward-only / additive (CREATE OR REPLACE).
-- ----------------------------------------------------------------------------

SET check_function_bodies = false;
SET client_min_messages = warning;

-- ===========================================================================
-- app.answer_map_by_item(response_id) — item_id::text -> value (same shapes as
-- app.answer_map, keyed by item_id instead of question_key).
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."answer_map_by_item"("p_response_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  with
  -- Scalar answers — non-choice input items only.
  scalars as (
    select a.item_id, a.value
    from public.answers a
    join public.form_items i on i.id = a.item_id
    where a.response_id = p_response_id
      and a.value is not null
      and i.item_type = any (array['free_text','short_text','number','date','time'])
  ),
  selected as (
    select s.item_id, i.item_type, o.code, o.position
    from public.answer_selected_options s
    join public.form_items i on i.id = s.item_id
    join public.form_item_options o on o.id = s.option_id
    where s.response_id = p_response_id
      and i.item_type = any (array['multiple_choice','dropdown','checkbox'])
  ),
  single as (
    select item_id, to_jsonb(min(code)) as value
    from selected
    where item_type = any (array['multiple_choice','dropdown'])
    group by item_id
  ),
  multi as (
    select item_id, jsonb_agg(to_jsonb(code) order by position) as value
    from selected
    where item_type = 'checkbox'
    group by item_id
  ),
  merged as (
    select item_id, value from scalars
    union all select item_id, value from single
    union all select item_id, value from multi
  )
  select coalesce(jsonb_object_agg(item_id::text, value), '{}'::jsonb)
  from merged;
$$;

ALTER FUNCTION "app"."answer_map_by_item"("p_response_id" "uuid") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "app"."answer_map_by_item"("p_response_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."answer_map_by_item"("p_response_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."answer_map_by_item"("p_response_id" "uuid") TO "service_role";

COMMENT ON FUNCTION "app"."answer_map_by_item"("p_response_id" "uuid") IS 'form-model-normalization: item_id::text -> value, SAME shapes as app.answer_map (single-select=scalar code, checkbox=array of codes by position, scalars=raw value), sourced from answers + answer_selected_options. The canonical SQL home for by-item_id materialization (twin of TS buildAnswerMaps'' answersByItemId).';

-- ===========================================================================
-- get_response_for_signoff — answers_by_item now uses app.answer_map_by_item so
-- CHOICE answers appear on the review-and-sign surface. Re-stated from
-- 20260623130000_signoff_observations.sql; the 3 access gates + answers +
-- observations_by_item + signoffs are BYTE-FOR-BYTE unchanged — ONLY the
-- answers_by_item source changes.
-- ===========================================================================
create or replace function public.get_response_for_signoff(p_response_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_response public.responses;
  v_answers jsonb;
  v_has_pending boolean;
  v_result jsonb;
begin
  select * into v_response
  from public.responses
  where id = p_response_id;

  -- Gate 1: exists + in_progress. (unchanged)
  if v_response.id is null or v_response.status <> 'in_progress' then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  -- Gate 2: caller is a staff_admin of the response's commission. (unchanged)
  if not app.is_staff_admin_of(v_response.commission_id) then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  v_answers := app.answer_map(p_response_id);

  -- Gate 3: there is a pending (visible + unsigned) staff_admin sign-off
  -- section. The read right is scoped to the act of signing. (unchanged)
  select exists (
    select 1
    from public.form_sections s
    where s.form_version_id = v_response.form_version_id
      and s.requires_signoff = true
      and s.signoff_role = 'staff_admin'
      and app.eval_condition(s.visible_when, v_answers)
      and not exists (
        select 1 from public.response_section_signoffs so
        where so.response_id = p_response_id
          and so.section_id = s.id
      )
  ) into v_has_pending;

  if not v_has_pending then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  select jsonb_build_object(
    'response_id', v_response.id,
    'form_version_id', v_response.form_version_id,
    'commission_id', v_response.commission_id,
    'status', v_response.status,
    'form_id', (select fv.form_id from public.form_versions fv where fv.id = v_response.form_version_id),
    'form_title', (
      select f.title from public.forms f
      join public.form_versions fv on fv.form_id = f.id
      where fv.id = v_response.form_version_id),
    'respondent_id', v_response.created_by,
    'respondent_name', (select full_name from public.profiles where id = v_response.created_by),
    'started_at', v_response.started_at,
    'updated_at', v_response.updated_at,
    'answers', v_answers,
    -- form-model-normalization: by-item_id map now includes CHOICE selections
    -- (single-select -> scalar code, checkbox -> array of codes), via the
    -- canonical app.answer_map_by_item. Was answers.value-only (bug FMN-002).
    'answers_by_item', app.answer_map_by_item(p_response_id),
    -- per-item observation notes (non-null, non-blank), keyed by item_id.
    'observations_by_item', coalesce(
      (select jsonb_object_agg(a.item_id::text, a.observation)
       from public.answers a
       where a.response_id = p_response_id
         and a.observation is not null
         and btrim(a.observation) <> ''),
      '{}'::jsonb),
    'signoffs', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'section_id', so.section_id,
          'signed_by', so.signed_by,
          'signed_by_name', sp.full_name,
          'signed_at', so.signed_at,
          'note', so.note
        ) order by so.signed_at)
       from public.response_section_signoffs so
       join public.profiles sp on sp.id = so.signed_by
       where so.response_id = p_response_id),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

alter function public.get_response_for_signoff(uuid) owner to postgres;
