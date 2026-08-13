-- FF-1 · BE-4b — the SIGN-OFF read path, and the second answer-map defect.
--
-- WHY THIS IS NOT COSMETIC. `get_response_for_signoff` is the DEFINER door
-- feeding the "revisar e assinar" screen. A staff_admin counter-signing a
-- response reviews exactly what that payload carries — so with no `instances`
-- key, every repeating-group answer is simply ABSENT from the review, and the
-- signer signs anyway. That is a governance artifact (Rule 4) attesting to
-- evidence the signer was never shown. It is the same class of failure as a
-- silent under-enforcement: nothing errors, the screen looks complete, and the
-- only symptom is a signature that means less than it claims.
--
-- SECOND DEFECT, same class as substrate correction 5: `app.answer_map_by_item`
-- also has NO group_instance_id filter. Keyed by item_id, two instances of the
-- same child collide and `jsonb_object_agg` silently keeps one. It is fixed here
-- exactly as `app.answer_map` was in BE-2 — one scoped body, the old signature
-- kept as a NULL-scoped wrapper so its call sites are untouched.

-- ---------------------------------------------------------------------------
-- 1 · The one by-item map body, scoped by instance.
-- ---------------------------------------------------------------------------
create or replace function app.answer_map_by_item_scoped(
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
  scalars as (
    select a.item_id, a.value
    from public.answers a
    join public.form_items i on i.id = a.item_id
    where a.response_id = p_response_id
      and a.group_instance_id is not distinct from p_group_instance_id
      and a.value is not null
      and i.item_type = any (array['free_text','short_text','number','date','time'])
  ),
  selected as (
    select a.item_id, i.item_type, o.code, o.position
    from public.answer_selected_options s
    join public.answers a on a.id = s.answer_id
    join public.form_items i on i.id = a.item_id
    join public.form_item_options o on o.id = s.option_id
    where a.response_id = p_response_id
      and a.group_instance_id is not distinct from p_group_instance_id
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

comment on function app.answer_map_by_item_scoped(uuid, uuid) is
  'FF-1: the item_id-keyed answer map, scoped by group instance. NULL = top level. Twin of app.answer_map_scoped; both had the same missing filter (ADR 0087 substrate correction 5).';

create or replace function app.answer_map_by_item(p_response_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select app.answer_map_by_item_scoped(p_response_id, null);
$$;

comment on function app.answer_map_by_item(uuid) is
  'The response''s TOP-LEVEL answers keyed by item_id. FF-1: now excludes repeating-group instance answers, which it previously collided into one entry per item_id.';

-- ---------------------------------------------------------------------------
-- 2 · get_response_for_signoff gains `instances`.
--     Signature UNCHANGED → body rewritten in place; fails loudly on drift.
--     Each entry carries the SAME four projections the top level carries, plus
--     the instance-resolved evaluator map, so the review screen can render and
--     evaluate an instance exactly as the wizard does.
-- ---------------------------------------------------------------------------
do $rewrite$
declare
  v_def text := pg_get_functiondef('public.get_response_for_signoff(uuid)'::regprocedure);
  v_from text := E'    ''answers'', v_answers,\n    ''answers_by_item'', app.answer_map_by_item(p_response_id),';
  v_to text := E'    ''answers'', v_answers,\n    ''answers_by_item'', app.answer_map_by_item(p_response_id),\n    -- FF-1 (ADR 0087): the repeating-group instances. Without these the signer\n    -- reviews a response with every instance answer missing, and signs it.\n    ''instances'', coalesce((\n      select jsonb_agg(jsonb_build_object(\n               ''id'', gi.id,\n               ''group_item_id'', gi.group_item_id,\n               ''position'', gi.position,\n               ''answers'', app.instance_answer_map(p_response_id, gi.id),\n               ''answers_by_item'', app.answer_map_by_item_scoped(p_response_id, gi.id),\n               ''observations_by_item'', coalesce((\n                 select jsonb_object_agg(a.item_id::text, a.observation)\n                 from public.answers a\n                 where a.response_id = p_response_id\n                   and a.group_instance_id = gi.id\n                   and a.observation is not null and a.observation <> ''''''''\n               ), ''{}''::jsonb),\n               ''other_text_by_item'', coalesce((\n                 select jsonb_object_agg(a.item_id::text, a.other_text)\n                 from public.answers a\n                 where a.response_id = p_response_id\n                   and a.group_instance_id = gi.id\n                   and a.other_text is not null and a.other_text <> ''''''''\n               ), ''{}''::jsonb)\n             ) order by gi.group_item_id, gi.position)\n      from public.response_group_instances gi\n      where gi.response_id = p_response_id\n    ), ''[]''::jsonb),';
begin
  if position(v_from in v_def) = 0 then
    raise exception 'get_response_for_signoff answers anchor not found — body drifted; migration must be revised';
  end if;
  execute replace(v_def, v_from, v_to);
end;
$rewrite$;

comment on function public.get_response_for_signoff(uuid) is
  'The DEFINER door feeding the review-to-sign screen. FF-1 adds `instances` — without them a staff_admin would counter-sign a response with every repeating-group answer missing from the review (Rule 4: a sign-off attests to what the signer was shown).';
