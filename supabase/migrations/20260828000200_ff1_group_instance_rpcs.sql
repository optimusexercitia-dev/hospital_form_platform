-- FF-1 · BE-3 — the repeating-group instance writers (ADR 0087 ruling 5),
--                plus the two latent bugs FF-1 activates (Amendment 1.3).
--
-- POSTURE — these are INVOKER functions, NOT `SECURITY DEFINER` doors.
--
-- The program plan said "all writers are DEFINER doors by construction". That is
-- a K9 §C rule about the SIX write-inert tables (`answer_matrix_cells`,
-- `answer_risk_matrix`, `answer_references`, `form_matrix_rows`,
-- `form_matrix_columns`, `form_item_validations` — all `authenticated=r`). It was
-- never the FILL path's rule. `response_group_instances` carries
-- `authenticated=arwdDxtm` under a `FOR ALL` own-draft policy, exactly like
-- `answers`, whose writer `save_section_answers` is INVOKER. DEFINER-gating the
-- container while its contents stay direct-DML locks the box and leaves the lid
-- off. **RLS remains the security boundary (Rule 1).**
--
-- The ADR-0079 reader-non-writer test does not bite either: the `FOR ALL` qual
-- (`created_by = auth.uid() AND status = 'in_progress'`) is strictly NARROWER
-- than the SELECT qual, so it over-grants neither reads nor writes. The plan's
-- `rls_group_instances_reader_non_writer` keystone is therefore recorded
-- NOT-APPLICABLE with that reasoning, and replaced by
-- `group_instances_post_submit_immutable` + `group_instances_cross_user_denied`,
-- which do bite.
--
-- So what ARE these for? ATOMICITY, which the client cannot achieve piecewise:
--   · `add` must take `max(position)+1` and check `maxInstances` together;
--   · `remove`/`reorder` rewrite several positions at once, and the position
--     constraint is UNIQUE — a naive reorder 0,1,2 → 1,0,2 collides mid-statement.
--     BE-1 made that constraint DEFERRABLE (the `form_items_section_id_position_key`
--     precedent); these two are its only deferring callers.
-- They are CORRECTNESS doors. Every one still re-states the ownership check so
-- the caller gets a pt-BR message instead of an RLS zero-row silence — belt and
-- braces, never a substitute for the policy.
--
-- SQLSTATEs (lane HC0N*, per ADR 0087 Amendment 1 — the live high-water is
-- HC0M9, NOT HC098; the HC09x digit lane is exhausted):
--   HC0N0  feature flag `repeating_groups` is OFF
--   HC0N1  maxInstances reached
--   HC0N2  instance not found / not this response
--   HC0N3  reorder list is not a permutation of the group's instances
--   HC0N4  item is not a repeating_group of this response's version
--   (HC0N5 is submit-time minInstances — BE-5.)

-- ---------------------------------------------------------------------------
-- 0 · Cardinality reader. Defensive by design: `form_items.config` has no inner
--     shape CHECK, so garbage must read as "unbounded" rather than reaching the
--     comparison. Mirrors how `app.assert_item_bounds` guards min/max, and the TS
--     `toCardinality` narrowing in src/lib/queries/forms.ts.
-- ---------------------------------------------------------------------------
create or replace function app.item_cardinality(p_config jsonb, p_key text)
returns integer
language sql
immutable
set search_path to 'pg_catalog'
as $$
  select case
    when p_config is null then null
    when jsonb_typeof(p_config -> p_key) <> 'number' then null
    when (p_config ->> p_key)::numeric < 0 then null
    when (p_config ->> p_key)::numeric <> trunc((p_config ->> p_key)::numeric) then null
    else (p_config ->> p_key)::integer
  end;
$$;

comment on function app.item_cardinality(jsonb, text) is
  'FF-1 (ADR 0087): read minInstances/maxInstances off form_items.config, or NULL for absent/garbage/negative/non-integer. TS twin: toCardinality in src/lib/queries/forms.ts.';

-- ---------------------------------------------------------------------------
-- 1 · Shared preconditions. Returns the repeating-group item's config; raises
--     the discriminated pt-BR error otherwise. Keeping this in ONE place is what
--     stops the three RPCs from drifting on who may write.
-- ---------------------------------------------------------------------------
create or replace function app.assert_group_writable(
  p_response_id uuid,
  p_group_item_id uuid
)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_status text;
  v_creator uuid;
  v_version uuid;
  v_config jsonb;
  v_type text;
begin
  if not app.feature_enabled('repeating_groups') then
    raise exception 'recurso indisponível' using errcode = 'HC0N0';
  end if;

  select r.status, r.created_by, r.form_version_id
    into v_status, v_creator, v_version
  from public.responses r
  where r.id = p_response_id;

  if v_status is null then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'esta resposta já foi enviada e não pode mais ser editada'
      using errcode = 'check_violation';
  end if;

  -- RLS already confines the write to the creator's own draft; this only turns
  -- that zero-row silence into a readable pt-BR message.
  if v_creator is distinct from auth.uid() then
    raise exception 'apenas quem iniciou esta resposta pode editá-la'
      using errcode = 'HC0N2';
  end if;

  select i.item_type, i.config into v_type, v_config
  from public.form_items i
  where i.id = p_group_item_id
    and i.form_version_id = v_version;

  if v_type is distinct from 'repeating_group' then
    raise exception 'este item não é um bloco repetível deste formulário'
      using errcode = 'HC0N4';
  end if;

  return v_config;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2 · add_group_instance — append at max(position)+1, under maxInstances.
-- ---------------------------------------------------------------------------
create or replace function public.add_group_instance(
  p_response_id uuid,
  p_group_item_id uuid
)
returns public.response_group_instances
language plpgsql
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_config jsonb;
  v_max integer;
  v_count integer;
  v_next integer;
  v_row public.response_group_instances;
begin
  v_config := app.assert_group_writable(p_response_id, p_group_item_id);

  -- Serialize concurrent adds on the same response so max(position)+1 and the
  -- maxInstances check are one atomic decision (the submit_response precedent).
  perform 1 from public.responses where id = p_response_id for update;

  select count(*), coalesce(max(position), -1) + 1
    into v_count, v_next
  from public.response_group_instances
  where response_id = p_response_id
    and group_item_id = p_group_item_id
    and parent_instance_id is null;

  v_max := app.item_cardinality(v_config, 'maxInstances');
  if v_max is not null and v_count >= v_max then
    raise exception 'este bloco aceita no máximo % item(ns)', v_max
      using errcode = 'HC0N1';
  end if;

  -- parent_instance_id is always NULL: nesting is capped at depth 1 (ruling 1),
  -- enforced for definitions by form_items_no_nested_container. Un-capping later
  -- adds a parameter here and a second pass in the copy blocks below.
  insert into public.response_group_instances
    (response_id, group_item_id, parent_instance_id, position)
  values (p_response_id, p_group_item_id, null, v_next)
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3 · remove_group_instance — delete (answers cascade) + re-pack positions.
-- ---------------------------------------------------------------------------
create or replace function public.remove_group_instance(
  p_response_id uuid,
  p_instance_id uuid
)
returns void
language plpgsql
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_group_item_id uuid;
begin
  select gi.group_item_id into v_group_item_id
  from public.response_group_instances gi
  where gi.id = p_instance_id
    and gi.response_id = p_response_id;

  if v_group_item_id is null then
    raise exception 'item do bloco não encontrado nesta resposta'
      using errcode = 'HC0N2';
  end if;

  perform app.assert_group_writable(p_response_id, v_group_item_id);
  perform 1 from public.responses where id = p_response_id for update;

  -- The answers of this instance go with it (answers.group_instance_id FK is
  -- ON DELETE CASCADE), and their selections follow via answer_id.
  delete from public.response_group_instances where id = p_instance_id;

  -- Re-pack to a contiguous 0..n-1. The gap left by the delete means the shift
  -- is monotone downward, but a downward shift still transiently collides under
  -- a non-deferrable unique — so defer, then force the check back INSIDE this
  -- function so a violation surfaces as our error rather than a raw 23505 at
  -- COMMIT, in some other statement's name.
  set constraints public.response_group_instances_parent_position_uniq deferred;

  update public.response_group_instances gi
  set position = packed.new_position
  from (
    select id, (row_number() over (order by position) - 1)::integer as new_position
    from public.response_group_instances
    where response_id = p_response_id
      and group_item_id = v_group_item_id
      and parent_instance_id is null
  ) packed
  where gi.id = packed.id
    and gi.position <> packed.new_position;

  set constraints public.response_group_instances_parent_position_uniq immediate;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4 · reorder_group_instances — set the order to exactly p_instance_ids.
-- ---------------------------------------------------------------------------
create or replace function public.reorder_group_instances(
  p_response_id uuid,
  p_group_item_id uuid,
  p_instance_ids uuid[]
)
returns void
language plpgsql
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_current integer;
  v_given integer;
  v_matched integer;
begin
  perform app.assert_group_writable(p_response_id, p_group_item_id);
  perform 1 from public.responses where id = p_response_id for update;

  select count(*) into v_current
  from public.response_group_instances
  where response_id = p_response_id
    and group_item_id = p_group_item_id
    and parent_instance_id is null;

  select count(distinct u) into v_given
  from unnest(coalesce(p_instance_ids, '{}'::uuid[])) u;

  select count(*) into v_matched
  from public.response_group_instances gi
  where gi.response_id = p_response_id
    and gi.group_item_id = p_group_item_id
    and gi.parent_instance_id is null
    and gi.id = any (coalesce(p_instance_ids, '{}'::uuid[]));

  -- A PERMUTATION, not a subset: same cardinality, no duplicates, every id
  -- belonging to this group. Rejecting loudly beats silently leaving unlisted
  -- instances behind at stale positions.
  if v_given <> v_current or v_matched <> v_current
     or v_given <> coalesce(array_length(p_instance_ids, 1), 0) then
    raise exception 'a nova ordem não corresponde aos itens deste bloco'
      using errcode = 'HC0N3';
  end if;

  set constraints public.response_group_instances_parent_position_uniq deferred;

  update public.response_group_instances gi
  set position = ord.new_position
  from (
    select u.id, (u.ord - 1)::integer as new_position
    from unnest(p_instance_ids) with ordinality as u(id, ord)
  ) ord
  where gi.id = ord.id
    and gi.position <> ord.new_position;

  set constraints public.response_group_instances_parent_position_uniq immediate;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5 · Grants — mirror save_section_answers exactly (INVOKER, no PUBLIC).
-- ---------------------------------------------------------------------------
revoke all on function public.add_group_instance(uuid, uuid) from public;
revoke all on function public.remove_group_instance(uuid, uuid) from public;
revoke all on function public.reorder_group_instances(uuid, uuid, uuid[]) from public;

grant execute on function public.add_group_instance(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.remove_group_instance(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.reorder_group_instances(uuid, uuid, uuid[])
  to authenticated, service_role;

comment on function public.add_group_instance(uuid, uuid) is
  'FF-1 (ADR 0087 ruling 5): append one repeating-group instance. INVOKER — RLS is the boundary; this exists for atomicity of max(position)+1 with the maxInstances check.';
comment on function public.remove_group_instance(uuid, uuid) is
  'FF-1 (ADR 0087 ruling 5): delete one instance (its answers cascade) and re-pack positions to 0..n-1. INVOKER; defers the position unique for the re-pack.';
comment on function public.reorder_group_instances(uuid, uuid, uuid[]) is
  'FF-1 (ADR 0087 ruling 5): set a group''s instance order to exactly p_instance_ids (must be a permutation). INVOKER; defers the position unique so 0,1,2 -> 1,0,2 does not collide mid-statement.';

-- ---------------------------------------------------------------------------
-- 6 · Amendment 1.3 — the two correction paths must copy the INSTANCE ROWS.
--
--     Both copy `answers.group_instance_id` VERBATIM from the predecessor while
--     never copying `response_group_instances`. The successor's answers would
--     therefore point at the PREDECESSOR's instances — which are frozen by
--     `guard_submitted_group_instances_trg` (so the correction could not be
--     edited) and cascade-deleted with the predecessor (so it would lose them).
--     Inert today at zero instance rows; wrong the moment section 2 above ships.
--
--     The fix is one data-modifying CTE per site: copy the instances, build the
--     old→new map from the RETURNING, and remap as the answers are inserted.
--     Matching on (group_item_id, position) is exact — it is the unique key of
--     the source rows under depth-1 (parent_instance_id always NULL), the same
--     technique clone_form_version uses for its section/item maps.
--
--     Signatures UNCHANGED → bodies rewritten in place; both raise loudly if the
--     anchor has drifted.
-- ---------------------------------------------------------------------------
do $rewrite$
declare
  v_def text := pg_get_functiondef('public.start_correction_draft(uuid)'::regprocedure);
  v_from text := E'  insert into public.answers\n    (response_id, item_id, question_key, value, observation, other_text,\n     group_instance_id, confidentiality_level)\n  select v_draft, a.item_id, a.question_key, a.value, a.observation, a.other_text,\n         a.group_instance_id, a.confidentiality_level\n  from public.answers a where a.response_id = v_predecessor;';
  v_to text := E'  -- FF-1 (ADR 0087 Amendment 1.3): copy the predecessor''''s repeating-group\n  -- instances FIRST and remap the copied answers onto the NEW rows. Copying\n  -- group_instance_id verbatim would leave the successor pointing at frozen,\n  -- cascade-deleted instances of the predecessor.\n  with src as (\n    select id, group_item_id, position\n    from public.response_group_instances\n    where response_id = v_predecessor\n  ),\n  ins as (\n    insert into public.response_group_instances\n      (response_id, group_item_id, parent_instance_id, position)\n    select v_draft, src.group_item_id, null, src.position\n    from src\n    returning id, group_item_id, position\n  ),\n  map as (\n    select src.id as old_id, ins.id as new_id\n    from src\n    join ins on ins.group_item_id = src.group_item_id\n            and ins.position = src.position\n  )\n  insert into public.answers\n    (response_id, item_id, question_key, value, observation, other_text,\n     group_instance_id, confidentiality_level)\n  select v_draft, a.item_id, a.question_key, a.value, a.observation, a.other_text,\n         map.new_id, a.confidentiality_level\n  from public.answers a\n  left join map on map.old_id = a.group_instance_id\n  where a.response_id = v_predecessor;';
begin
  if position(v_from in v_def) = 0 then
    raise exception 'start_correction_draft answers-copy anchor not found — body drifted; migration must be revised';
  end if;
  execute replace(v_def, v_from, v_to);
end;
$rewrite$;

do $rewrite$
declare
  v_def text := pg_get_functiondef('public.supersede_response(uuid,text)'::regprocedure);
  v_from text := E'  insert into public.answers (\n    response_id, item_id, question_key, value, observation, other_text,\n    group_instance_id, confidentiality_level\n  )\n  select\n    v_new.id, a.item_id, a.question_key, a.value, a.observation, a.other_text,\n    a.group_instance_id, a.confidentiality_level\n  from public.answers a\n  where a.response_id = p_response_id;';
  v_to text := E'  -- FF-1 (ADR 0087 Amendment 1.3): see start_correction_draft — the instance\n  -- rows are copied first and the answers remapped onto them.\n  with src as (\n    select id, group_item_id, position\n    from public.response_group_instances\n    where response_id = p_response_id\n  ),\n  ins as (\n    insert into public.response_group_instances\n      (response_id, group_item_id, parent_instance_id, position)\n    select v_new.id, src.group_item_id, null, src.position\n    from src\n    returning id, group_item_id, position\n  ),\n  map as (\n    select src.id as old_id, ins.id as new_id\n    from src\n    join ins on ins.group_item_id = src.group_item_id\n            and ins.position = src.position\n  )\n  insert into public.answers (\n    response_id, item_id, question_key, value, observation, other_text,\n    group_instance_id, confidentiality_level\n  )\n  select\n    v_new.id, a.item_id, a.question_key, a.value, a.observation, a.other_text,\n    map.new_id, a.confidentiality_level\n  from public.answers a\n  left join map on map.old_id = a.group_instance_id\n  where a.response_id = p_response_id;';
begin
  if position(v_from in v_def) = 0 then
    raise exception 'supersede_response answers-copy anchor not found — body drifted; migration must be revised';
  end if;
  execute replace(v_def, v_from, v_to);
end;
$rewrite$;
