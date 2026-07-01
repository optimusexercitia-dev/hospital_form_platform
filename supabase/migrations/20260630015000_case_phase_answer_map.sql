-- ----------------------------------------------------------------------------
-- form-model-normalization (BE-5 fix) — case_phase_answer_map for the normalized
-- selection model.
-- ----------------------------------------------------------------------------
-- app.case_phase_answer_map feeds the cross-phase recommendation engine
-- (recompute_recommendations) and the per-phase result_ruleset evaluator
-- (compute_case_phase_result) via the UNCHANGED app.eval_condition. It must
-- reconstruct the SAME question_key -> code(s)/scalar shapes as app.answer_map
-- (BE-3), now sourced from answers (scalars) + answer_selected_options
-- (single-select -> scalar code, checkbox -> array of codes by option.position),
-- scoped to the case phase's SUBMITTED response (the Phase-7 submitted-only
-- invariant is preserved). Before this, choice answers (now in
-- answer_selected_options) were invisible to it, so result/recommendation
-- conditions over choice questions never matched.
--
-- The evaluator is UNCHANGED; this only changes how the map is built.
-- ----------------------------------------------------------------------------

SET check_function_bodies = false;
SET client_min_messages = warning;

CREATE OR REPLACE FUNCTION "app"."case_phase_answer_map"("p_case_phase_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  with
  -- The case phase's SUBMITTED response (Phase-7 invariant: in-progress -> {}).
  resp as (
    select r.id
    from public.responses r
    where r.case_phase_id = p_case_phase_id
      and r.status = 'submitted'
  ),
  scalars as (
    select a.question_key, a.value
    from public.answers a
    join resp on resp.id = a.response_id
    join public.form_items i on i.id = a.item_id
    where a.value is not null
      and i.item_type = any (array['free_text','short_text','number','date','time'])
  ),
  selected as (
    select i.question_key, i.item_type, o.code, o.position
    from public.answer_selected_options s
    join resp on resp.id = s.response_id
    join public.form_items i on i.id = s.item_id
    join public.form_item_options o on o.id = s.option_id
    where i.item_type = any (array['multiple_choice','dropdown','checkbox'])
  ),
  single as (
    select question_key, to_jsonb(min(code)) as value
    from selected
    where item_type = any (array['multiple_choice','dropdown'])
    group by question_key
  ),
  multi as (
    select question_key, jsonb_agg(to_jsonb(code) order by position) as value
    from selected
    where item_type = 'checkbox'
    group by question_key
  ),
  merged as (
    select question_key, value from scalars
    union all select question_key, value from single
    union all select question_key, value from multi
  )
  select coalesce(jsonb_object_agg(question_key, value), '{}'::jsonb)
  from merged;
$$;

ALTER FUNCTION "app"."case_phase_answer_map"("p_case_phase_id" "uuid") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "app"."case_phase_answer_map"("p_case_phase_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."case_phase_answer_map"("p_case_phase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."case_phase_answer_map"("p_case_phase_id" "uuid") TO "service_role";
