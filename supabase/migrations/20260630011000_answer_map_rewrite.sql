-- ----------------------------------------------------------------------------
-- form-model-normalization (BE-3) — rewrite app.answer_map for the normalized model
-- ----------------------------------------------------------------------------
-- THE LOAD-BEARING INSULATION POINT (ARCHITECTURE Rule 3). The evaluator
-- (app.eval_condition / app.eval_visibility) and its TS mirror + the shared
-- __fixtures__ vectors stay BYTE-FOR-BYTE UNCHANGED. app.answer_map is the only
-- thing that changes: it reconstructs the SAME `question_key -> jsonb` shapes the
-- evaluator has always consumed, now sourced from the two tables:
--   * single-select (multiple_choice / dropdown) -> the selected option's CODE as
--     a jsonb STRING scalar.
--   * checkbox -> a jsonb ARRAY of the selected codes, ordered by option.position.
--   * scalar inputs (free_text / short_text / number / date / time) -> the raw
--     answers.value (unchanged path).
-- Conditions / recommend_when / result_ruleset store the option CODE (decision #8),
-- so the rebuilt map feeds the unchanged evaluator with zero drift. The shared
-- vectors use abstract string values (e.g. "Sim", "luvas") that are now CODES in
-- the real data — the evaluator cannot tell the difference, which is the point.
--
-- Forward-only / additive (CREATE OR REPLACE). The downstream consumers
-- (response_required_complete, signoff RPCs, submit_response, dashboards) call
-- app.answer_map and are unaffected by this rewrite — they see the same shapes.
-- save_section_answers / submit_response selection handling is BE-4.
-- ----------------------------------------------------------------------------

SET check_function_bodies = false;
SET client_min_messages = warning;

-- ===========================================================================
-- app.answer_map(response_id) — rebuild question_key -> code(s)/scalar.
--
-- Three disjoint sources, unioned then aggregated by question_key:
--   (a) SCALAR answers: answers.value for items whose type is NOT a choice type
--       (the old path; choice items now leave answers.value null). A choice item
--       that somehow still has a non-null value is IGNORED here (its selections
--       are authoritative) — but BE-4 never writes a choice value, so this is
--       belt-and-braces.
--   (b) SINGLE-SELECT: the one selected option's code as a jsonb string, for
--       multiple_choice / dropdown.
--   (c) CHECKBOX: a jsonb array of selected codes ordered by option.position.
-- A choice item with zero selections contributes NO key (matching the old
-- "value is not null" filter — absent vs. empty is the evaluator's missing-answer
-- semantics, exercised by the vectors).
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."answer_map"("p_response_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  with
  -- (a) Scalar answers — non-choice input items only.
  scalars as (
    select a.question_key, a.value
    from public.answers a
    join public.form_items i on i.id = a.item_id
    where a.response_id = p_response_id
      and a.value is not null
      and i.item_type = any (array['free_text','short_text','number','date','time'])
  ),
  -- The selected option codes of this response, with the parent item's
  -- question_key + type, ordered by option.position for the checkbox array.
  selected as (
    select i.question_key,
           i.item_type,
           o.code,
           o.position
    from public.answer_selected_options s
    join public.form_items i on i.id = s.item_id
    join public.form_item_options o on o.id = s.option_id
    where s.response_id = p_response_id
      and i.item_type = any (array['multiple_choice','dropdown','checkbox'])
  ),
  -- (b) Single-select — exactly one code per question_key as a jsonb string. (A
  -- well-formed single-select has one selection; min() is a defensive tiebreak.)
  single as (
    select question_key, to_jsonb(min(code)) as value
    from selected
    where item_type = any (array['multiple_choice','dropdown'])
    group by question_key
  ),
  -- (c) Checkbox — a jsonb array of codes ordered by option.position.
  multi as (
    select question_key, jsonb_agg(to_jsonb(code) order by position) as value
    from selected
    where item_type = 'checkbox'
    group by question_key
  ),
  merged as (
    select question_key, value from scalars
    union all
    select question_key, value from single
    union all
    select question_key, value from multi
  )
  select coalesce(jsonb_object_agg(question_key, value), '{}'::jsonb)
  from merged;
$$;

ALTER FUNCTION "app"."answer_map"("p_response_id" "uuid") OWNER TO "postgres";

-- Re-apply the grant surface (mirrors the original definition).
GRANT ALL ON FUNCTION "app"."answer_map"("p_response_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."answer_map"("p_response_id" "uuid") TO "service_role";

COMMENT ON FUNCTION "app"."answer_map"("p_response_id" "uuid") IS 'form-model-normalization: rebuilds question_key -> jsonb from answers (scalars) + answer_selected_options (single-select=scalar code, checkbox=array of codes ordered by option.position). The SAME shapes the unchanged evaluator (app.eval_condition/eval_visibility) consumes — codes are the clone-stable identity conditions store. Canonical spec for the TS answersByItemId/answersByKey rehydration.';
