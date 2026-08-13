-- FF-1 · BE-2 — the instance-aware answer map (ADR 0087 ruling 2).
--
-- THE KEY DESIGN FACT: `app.eval_condition` is already a PURE function over an
-- answer map. So the entire instance dimension lands in map CONSTRUCTION, and the
-- evaluator — all 11 operators, both sides of Rule 3 — stays BYTE-FOR-BYTE
-- unchanged. That is deliberate: it is the difference between a new vector
-- dimension over a pure 2-argument overlay, and re-proving the whole operator ×
-- value_type matrix against a second code path.
--
-- Ruling 2, restated as data:
--   M0  = the response's TOP-LEVEL answers  (group_instance_id IS NULL)
--   MI  = ONE instance's own answers        (group_instance_id = I)
--   map used to evaluate an item inside instance I  =  M0 ⊕ MI   (MI wins)
--   map used to evaluate anything else               =  M0
--
-- "A sibling missing in I is ABSENT, never a fallback to another instance" is
-- therefore STRUCTURAL, not enforced: a repeating-group child's answers ALWAYS
-- carry an instance id, so its question_key can never appear in M0, and the ⊕
-- leaves keys present in neither map absent. There is no code path that could
-- regress it. What COULD regress is M0 itself — which is exactly the defect this
-- migration fixes, and why that gets its own keystone.
--
-- ADR 0087 §Substrate correction 5, confirmed live: `app.answer_map` has NO
-- group_instance_id filter at all. Every instance answer would be folded into the
-- TOP-LEVEL map — `jsonb_object_agg` silently last-wins for scalars, and the
-- `group by question_key` CTEs merge checkbox codes from different instances into
-- one array. Nine call sites read that map (submit_response,
-- response_required_complete, list_signoff_queue, sign_section,
-- compute_due_notifications, recompute_recommendations, get_response_for_signoff,
-- and the two case-phase aggregates). Inert today (zero instance rows); wrong for
-- all nine the moment BE-3 ships.
--
-- SECURITY POSTURE: `answer_map_scoped` / `instance_answer_map` are SECURITY
-- DEFINER because they REPLACE the body of an existing SECURITY DEFINER
-- (`app.answer_map`) and are called from `submit_response`, which is INVOKER and
-- relies on that definer to read answers. This is a refactor of one existing door,
-- not a new one: same rows, same shape, one added filter. The `app` schema is not
-- in PostgREST's exposed set (config.toml `schemas = ["public","graphql_public"]`),
-- so none of these is reachable from the API — identical to the incumbent.

-- ---------------------------------------------------------------------------
-- 1 · The pure overlay — the parity-locked seam (TS twin: `overlayAnswerMap`).
--     IMMUTABLE, no DB access, no rows: golden-vector testable on both sides.
-- ---------------------------------------------------------------------------
create or replace function app.overlay_answer_map(p_base jsonb, p_overlay jsonb)
returns jsonb
language sql
immutable
set search_path to 'pg_catalog'
as $$
  -- jsonb `||` is a SHALLOW merge with the RIGHT operand winning per key, and
  -- keys in neither operand stay absent. Both properties are load-bearing:
  -- right-wins = "a same-instance sibling wins"; absent-stays-absent = "if this
  -- instance has not answered that key, it is absent".
  select coalesce(p_base, '{}'::jsonb) || coalesce(p_overlay, '{}'::jsonb);
$$;

comment on function app.overlay_answer_map(jsonb, jsonb) is
  'FF-1 (ADR 0087 ruling 2): the 2-tier answer-map overlay — top-level ⊕ one instance, instance wins, absent stays absent. TS mirror: overlayAnswerMap in src/lib/queries/conditions.ts. Drift is phase-blocking (Rule 3); locked by instance-map-vectors.json + supabase/tests/20_conditions.sql.';

-- ---------------------------------------------------------------------------
-- 2 · The ONE map implementation, now instance-scoped.
--     p_group_instance_id NULL  → the TOP-LEVEL map (M0)
--     p_group_instance_id = I   → instance I's OWN answers (MI), nothing else
-- ---------------------------------------------------------------------------
create or replace function app.answer_map_scoped(
  p_response_id uuid,
  p_group_instance_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  with
  -- (a) Scalar answers — non-choice input items only.
  scalars as (
    select a.question_key, a.value
    from public.answers a
    join public.form_items i on i.id = a.item_id
    where a.response_id = p_response_id
      and a.group_instance_id is not distinct from p_group_instance_id
      and a.value is not null
      and i.item_type = any (array['free_text','short_text','number','date','time'])
  ),
  -- The selected option codes of this response, sourced through the parent answer
  -- (answer_id -> answers), with the item's question_key + type, ordered by
  -- option.position for the checkbox array.
  selected as (
    select i.question_key,
           i.item_type,
           o.code,
           o.position
    from public.answer_selected_options s
    join public.answers a on a.id = s.answer_id
    join public.form_items i on i.id = a.item_id
    join public.form_item_options o on o.id = s.option_id
    where a.response_id = p_response_id
      and a.group_instance_id is not distinct from p_group_instance_id
      and i.item_type = any (array['multiple_choice','dropdown','checkbox'])
  ),
  -- (b) Single-select — exactly one code per question_key as a jsonb string.
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

comment on function app.answer_map_scoped(uuid, uuid) is
  'FF-1 (ADR 0087): the single answer-map implementation, scoped by group instance. NULL = the top-level map (the shape app.answer_map has always promised); a uuid = that instance''s own answers only. `is not distinct from` is what makes one body serve both — do not split it, the two must never drift.';

-- ---------------------------------------------------------------------------
-- 3 · app.answer_map keeps its signature (9 call sites, grants preserved) and
--     becomes a thin wrapper. THIS IS THE SUBSTRATE-5 FIX: it now excludes
--     instance answers instead of silently folding them in.
-- ---------------------------------------------------------------------------
create or replace function app.answer_map(p_response_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.answer_map_scoped(p_response_id, null);
$$;

comment on function app.answer_map(uuid) is
  'The response''s TOP-LEVEL answer map (question_key -> canonical value). FF-1: now excludes repeating-group instance answers, which it previously folded in silently (ADR 0087 substrate correction 5). Delegates to app.answer_map_scoped — one body, no drift.';

-- ---------------------------------------------------------------------------
-- 4 · The resolved map for an item INSIDE an instance.
-- ---------------------------------------------------------------------------
create or replace function app.instance_answer_map(
  p_response_id uuid,
  p_group_instance_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.overlay_answer_map(
    app.answer_map_scoped(p_response_id, null),
    app.answer_map_scoped(p_response_id, p_group_instance_id)
  );
$$;

comment on function app.instance_answer_map(uuid, uuid) is
  'FF-1 (ADR 0087 ruling 2): the resolved evaluator map for an item inside repeating-group instance I — top-level ⊕ instance-I, instance wins. The ONLY map an item inside a repeating group is ever evaluated against; everything else uses app.answer_map.';
