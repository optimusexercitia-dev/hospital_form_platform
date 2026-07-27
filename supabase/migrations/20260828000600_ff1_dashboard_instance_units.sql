-- FF-1 · BE-8 — explode-by-child-question_key in the dashboards.
--
-- WHAT THE RATIFIED CONTRACT ALREADY GIVES US, FOR FREE:
--   · `docs/design/f3-question-key-aggregation.md` §1 — a repeating group's
--     CONTAINER collects no answer; its CHILD items carry the aggregating
--     `question_key`s, and `answers.group_instance_id` is NOT part of the
--     aggregation key. So N instances contribute N rows to the same key and the
--     `tally` CTE below needs no change at all. BE-1 pinning the container's
--     `question_key` to NULL is what keeps the container itself out of every one
--     of these projections.
--   · SUPERSESSION is likewise already handled, and NOT by a new predicate: the
--     dashboard RPCs draw every response from `app.submitted_form_responses`,
--     which already excludes any row with a SUBMITTED successor. Group answers
--     are rows in `answers`, not a new table, so they inherit the exclusion by
--     construction. `supersession_group_answers_excluded` therefore asserts an
--     INHERITED property — it is still mutation-proven (neutralise the exclusion
--     in submitted_form_responses and it goes red), it just needed no new code.
--
-- WHAT THE CONTRACT DID *NOT* COVER, AND IS A REAL BUG THE MOMENT FF-1 SHIPS:
--   the DENOMINATOR. `n_per_key` and `denom` both count DISTINCT RESPONSES. With
--   3 instances in 1 response answering the same child, `option_count` is 3 while
--   `n` is 1 — a 300% share on the chart. The contract's "no aggregation-shape
--   change is required" was reasoning about the TALLY only.
--
--   The fix follows straight from the contract's own words: if each instance's
--   child answer is "a distinct data point", then the denominator must count DATA
--   POINTS, not responses. So for a repeating-group child the unit becomes the
--   (response, instance) pair, and its eligible base becomes the instances that
--   exist — not the responses that reached the section.
--
-- Signature UNCHANGED → body rewritten in place via the established
-- pg_get_functiondef + replace + execute pattern, three anchored edits, each
-- failing loudly if the body has drifted.

do $rewrite$
declare
  v_def text := pg_get_functiondef(
    'public.dashboard_distributions(uuid,date,date)'::regprocedure);

  -- (1) carry group_instance_id through the selection CTE.
  v_sel_from text := E'    select a.response_id,\n           fi.question_key,\n           fi.item_type,\n           fi.section_id,\n           o.code as option_code';
  v_sel_to text := E'    select a.response_id,\n           a.group_instance_id,\n           fi.question_key,\n           fi.item_type,\n           fi.section_id,\n           o.code as option_code';

  -- (2) the eligible base. A repeating-group child''s base is the INSTANCES that
  --     exist in that group across the counted responses; every other key keeps
  --     the section-reached-response base, unchanged.
  v_denom_from text := E'  denom as (\n    select ks.question_key,\n           count(distinct sa.response_id) as denominator\n    from key_section ks\n    join section_answered sa on sa.section_id = ks.section_id\n    group by ks.question_key\n  ),';
  -- NOTE: every column reference below is QUALIFIED. `dashboard_distributions`
  -- is RETURNS TABLE(question_key text, …), so `question_key` is also a PL/pgSQL
  -- OUT variable in scope — an unqualified reference is ambiguous against it and
  -- fails at RETURN QUERY, not at CREATE. That is why the shipped body qualifies
  -- everything, and why this block must too.
  v_denom_to text := E'  -- FF-1: which keys belong to a REPEATING group (and to which container).\n  rg_key as (\n    select distinct fi.question_key, fi.parent_item_id as group_item_id\n    from public.form_items fi\n    join public.form_items p on p.id = fi.parent_item_id\n    where fi.form_version_id in (select distinct form_version_id from resp)\n      and p.item_type = ''repeating_group''\n      and fi.question_key is not null\n  ),\n  -- FF-1: a repeating-group child''''s eligible base is the INSTANCES that exist,\n  -- not the responses that reached the section. Counting responses here is what\n  -- produced shares above 100%% once one response could answer a key N times.\n  denom_rg as (\n    select rk.question_key,\n           count(*) as denominator\n    from rg_key rk\n    join public.response_group_instances gi\n      on gi.group_item_id = rk.group_item_id\n    join resp on resp.id = gi.response_id\n    group by rk.question_key\n  ),\n  denom_flat as (\n    select ks.question_key,\n           count(distinct sa.response_id) as denominator\n    from key_section ks\n    join section_answered sa on sa.section_id = ks.section_id\n    where not exists (select 1 from rg_key rk where rk.question_key = ks.question_key)\n    group by ks.question_key\n  ),\n  denom as (\n    select df.question_key, df.denominator from denom_flat df\n    union all\n    select dr.question_key, dr.denominator from denom_rg dr\n  ),';

  -- (3) n = ANSWER UNITS, not responses. DISTINCT over the row (response,
  --     instance) groups NULLs as equal, so a top-level key still counts exactly
  --     one unit per response and its value is unchanged.
  v_n_from text := E'  n_per_key as (\n    select sel.question_key as qk, count(distinct sel.response_id) as cnt\n    from sel\n    group by sel.question_key\n  ),';
  v_n_to text := E'  n_per_key as (\n    -- FF-1: the unit is the ANSWER, and a repeating group has one per instance.\n    -- Row-DISTINCT treats NULL group_instance_id as a value, so a top-level key\n    -- still yields exactly one unit per response - its n is unchanged.\n    select sel.question_key as qk,\n           count(distinct (sel.response_id, sel.group_instance_id)) as cnt\n    from sel\n    group by sel.question_key\n  ),';
begin
  if position(v_sel_from in v_def) = 0
     or position(v_denom_from in v_def) = 0
     or position(v_n_from in v_def) = 0 then
    raise exception 'dashboard_distributions anchors not found — body drifted; migration must be revised';
  end if;

  v_def := replace(v_def, v_sel_from, v_sel_to);
  v_def := replace(v_def, v_denom_from, v_denom_to);
  v_def := replace(v_def, v_n_from, v_n_to);
  execute v_def;
end;
$rewrite$;

comment on function public.dashboard_distributions(uuid, date, date) is
  'Per-question_key choice distributions for a form''s submitted responses. FF-1: repeating-group children explode by child key (N instances = N data points, per the ratified aggregation contract), and the denominator/n count ANSWER UNITS rather than responses — counting responses yielded shares above 100% once one response could answer a key N times. Supersession exclusion is inherited from app.submitted_form_responses.';
