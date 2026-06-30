-- ----------------------------------------------------------------------------
-- form-model-normalization (BE-4) — save_section_answers + submit_response for
-- the normalized selection model.
-- ----------------------------------------------------------------------------
-- save_section_answers gains `p_selections jsonb` ({ item_id: [code, ...] }). For
-- a choice item present in p_selections it REPLACES the item's selection rows
-- (delete then insert one answer_selected_options row per code, each resolved to
-- the option row of THAT item). Scalar items keep the answers.value upsert path.
-- submit_response: "answered" = scalar value present OR >= 1 selection row;
-- hidden-item/section cleanup deletes BOTH answers and answer_selected_options.
--
-- Forward-only / additive (DROP + CREATE the save signature to add the param;
-- CREATE OR REPLACE submit_response). Every prior semantic preserved verbatim:
-- HC013 cross-version guards, observation upsert, bounds (HC061), sign-off
-- checks, per-item visibility forward pass, stray-answer cleanup, the in_submit_
-- rpc / in_publish_rpc GUC dances. The evaluator (app.eval_condition /
-- eval_visibility) and the rebuilt app.answer_map (BE-3) are UNCHANGED.
--
-- SQLSTATEs: HC013 (cross-version item/section/selection), HC011 (missing
-- required), HC012 (missing sign-off), HC061 (bounds) — all reused.
-- ----------------------------------------------------------------------------

SET check_function_bodies = false;
SET client_min_messages = warning;

-- ===========================================================================
-- save_section_answers — + p_selections (DROP+CREATE the 5-arg -> 6-arg signature).
-- ===========================================================================
DROP FUNCTION IF EXISTS public.save_section_answers(uuid, uuid, jsonb, uuid[], jsonb);

CREATE OR REPLACE FUNCTION public.save_section_answers(
  p_response_id uuid,
  p_section_id uuid,
  p_answers jsonb default '{}'::jsonb,
  p_clear_item_ids uuid[] default null::uuid[],
  p_observations jsonb default null::jsonb,
  p_selections jsonb default null::jsonb
)
returns public.responses
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_version_id uuid;
  v_status text;
  v_result public.responses;
  v_bad_item uuid;
  v_section_version uuid;
  v_bad_code text;
begin
  select form_version_id, status into v_version_id, v_status
  from public.responses
  where id = p_response_id;

  if v_version_id is null then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'esta resposta já foi enviada e não pode mais ser editada'
      using errcode = 'check_violation';
  end if;

  -- Cross-version section guard (the saved section becomes last_section_id).
  select form_version_id into v_section_version
  from public.form_sections
  where id = p_section_id;

  if v_section_version is null or v_section_version <> v_version_id then
    raise exception 'a seção % não pertence a esta versão do formulário', p_section_id
      using errcode = 'HC013';
  end if;

  -- ---- Scalar answers (free_text/short_text/number/date/time). Choice items
  -- no longer ride here (their value is null); the wizard sends scalars in
  -- p_answers and choice selections in p_selections. A choice item passed in
  -- p_answers is harmless (its value upsert is overwritten/ignored by answer_map),
  -- but the cross-version guard still applies to every key. ----
  if p_answers is not null and p_answers <> '{}'::jsonb then
    select (e.key)::uuid into v_bad_item
    from jsonb_each(p_answers) e
    where not exists (
      select 1 from public.form_items i
      where i.id = (e.key)::uuid
        and i.form_version_id = v_version_id
    )
    limit 1;

    if v_bad_item is not null then
      raise exception 'o item % não pertence a esta versão do formulário', v_bad_item
        using errcode = 'HC013';
    end if;

    insert into public.answers (response_id, item_id, question_key, value)
    select p_response_id, i.id, i.question_key, e.value
    from jsonb_each(p_answers) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id)
    do update set value = excluded.value,
                  question_key = excluded.question_key;
  end if;

  -- ---- Choice selections (REPLACE semantics). p_selections is
  -- { item_id: [code, ...] }. For each item: delete its existing selection rows,
  -- then insert one row per code resolved to the option row of THAT item. An
  -- empty array clears the item's selections. Cross-version + code-existence are
  -- HC013. ----
  if p_selections is not null and p_selections <> '{}'::jsonb then
    -- Cross-version guard: every keyed item must belong to this version.
    select (e.key)::uuid into v_bad_item
    from jsonb_each(p_selections) e
    where not exists (
      select 1 from public.form_items i
      where i.id = (e.key)::uuid
        and i.form_version_id = v_version_id
    )
    limit 1;

    if v_bad_item is not null then
      raise exception 'o item % não pertence a esta versão do formulário', v_bad_item
        using errcode = 'HC013';
    end if;

    -- Code-existence guard: every code must resolve to an option of its item.
    select sel.code into v_bad_code
    from (
      select (e.key)::uuid as item_id, c.value #>> '{}' as code
      from jsonb_each(p_selections) e
      cross join lateral jsonb_array_elements(e.value) c
    ) sel
    where not exists (
      select 1 from public.form_item_options o
      where o.item_id = sel.item_id and o.code = sel.code
    )
    limit 1;

    if v_bad_code is not null then
      raise exception 'a opção "%" não pertence a este item do formulário', v_bad_code
        using errcode = 'HC013';
    end if;

    -- Replace: delete every keyed item's existing selections, then re-insert.
    delete from public.answer_selected_options s
    where s.response_id = p_response_id
      and s.item_id in (
        select (e.key)::uuid from jsonb_each(p_selections) e
      );

    insert into public.answer_selected_options (response_id, item_id, option_id)
    select p_response_id, sel.item_id, o.id
    from (
      select (e.key)::uuid as item_id, c.value #>> '{}' as code
      from jsonb_each(p_selections) e
      cross join lateral jsonb_array_elements(e.value) c
    ) sel
    join public.form_item_options o
      on o.item_id = sel.item_id and o.code = sel.code;
  end if;

  -- ---- Observation upsert (touches ONLY answers.observation). ----
  if p_observations is not null and p_observations <> '{}'::jsonb then
    select (e.key)::uuid into v_bad_item
    from jsonb_each(p_observations) e
    where not exists (
      select 1 from public.form_items i
      where i.id = (e.key)::uuid
        and i.form_version_id = v_version_id
    )
    limit 1;

    if v_bad_item is not null then
      raise exception 'o item % não pertence a esta versão do formulário', v_bad_item
        using errcode = 'HC013';
    end if;

    insert into public.answers (response_id, item_id, question_key, observation)
    select p_response_id, i.id, i.question_key,
           nullif(btrim(e.value #>> '{}'), '')
    from jsonb_each(p_observations) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id)
    do update set observation = excluded.observation;
  end if;

  -- ---- Orphan-clear (warn-and-clear): delete answers AND selections of items
  -- the wizard reported as now-hidden. ----
  if p_clear_item_ids is not null and array_length(p_clear_item_ids, 1) is not null then
    delete from public.answers
    where response_id = p_response_id
      and item_id = any (p_clear_item_ids);
    delete from public.answer_selected_options
    where response_id = p_response_id
      and item_id = any (p_clear_item_ids);
  end if;

  update public.responses
  set last_section_id = p_section_id,
      updated_at = now()
  where id = p_response_id
  returning * into v_result;

  return v_result;
end;
$$;

alter function public.save_section_answers(uuid, uuid, jsonb, uuid[], jsonb, jsonb) owner to postgres;

revoke all on function public.save_section_answers(uuid, uuid, jsonb, uuid[], jsonb, jsonb) from public;
grant all on function public.save_section_answers(uuid, uuid, jsonb, uuid[], jsonb, jsonb) to authenticated;
grant all on function public.save_section_answers(uuid, uuid, jsonb, uuid[], jsonb, jsonb) to service_role;

-- ===========================================================================
-- submit_response — "answered" = scalar value OR >= 1 selection; hidden-cleanup
-- deletes BOTH tables. Re-stated from the BE form-builder-enhancements def with
-- ONLY the answered-check + cleanup widened for selections.
-- ===========================================================================
create or replace function public.submit_response(p_response_id uuid)
returns public.responses
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_response public.responses;
  v_eff jsonb;          -- effective answer map (question_key -> value), forward pass
  r_section record;
  r_item record;
  v_visible boolean;
  v_missing boolean;
  v_signoff_exists boolean;
  v_result public.responses;
begin
  select * into v_response
  from public.responses
  where id = p_response_id;

  if v_response.id is null then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  if v_response.status = 'submitted' then
    raise exception 'esta resposta já foi enviada'
      using errcode = 'HC010';
  end if;

  perform 1 from public.responses
  where id = p_response_id and status = 'in_progress'
  for update;

  -- Effective map starts from the saved answers (rebuilt by the normalized
  -- app.answer_map — single→code, checkbox→array of codes, scalars→raw); we DROP
  -- hidden items'/sections' keys as we walk in document order.
  v_eff := app.answer_map(p_response_id);

  perform set_config('app.in_submit_rpc', 'on', true);

  for r_section in
    select s.id, s.position, s.visible_when, s.requires_signoff
    from public.form_sections s
    where s.form_version_id = v_response.form_version_id
    order by s.position
  loop
    v_visible := app.eval_visibility(r_section.visible_when, v_eff);

    if not v_visible then
      -- Stray cleanup for the whole section (answers + selections) + drop its keys.
      delete from public.answers a
      using public.form_items i
      where a.response_id = p_response_id
        and a.item_id = i.id
        and i.section_id = r_section.id;

      delete from public.answer_selected_options s
      using public.form_items i
      where s.response_id = p_response_id
        and s.item_id = i.id
        and i.section_id = r_section.id;

      v_eff := v_eff - (
        select coalesce(array_agg(i.question_key), '{}')
        from public.form_items i
        where i.section_id = r_section.id
          and i.question_key is not null
      );
      continue;
    end if;

    for r_item in
      select i.id, i.position, i.item_type, i.question_key, i.label,
             i.required, i.config, i.visible_when
      from public.form_items i
      where i.section_id = r_section.id
        and i.question_key is not null   -- input items only
      order by i.position
    loop
      if not app.eval_visibility(r_item.visible_when, v_eff) then
        -- Hidden item: clear its answer + selections + drop its key.
        delete from public.answers a
        where a.response_id = p_response_id and a.item_id = r_item.id;
        delete from public.answer_selected_options s
        where s.response_id = p_response_id and s.item_id = r_item.id;
        v_eff := v_eff - r_item.question_key;
        continue;
      end if;

      -- Visible & required: must have a non-null SCALAR answer OR >= 1 selection.
      if r_item.required then
        select not (
          exists (
            select 1 from public.answers a
            where a.response_id = p_response_id
              and a.item_id = r_item.id
              and a.value is not null
              and a.value <> 'null'::jsonb
          )
          or exists (
            select 1 from public.answer_selected_options s
            where s.response_id = p_response_id
              and s.item_id = r_item.id
          )
        ) into v_missing;

        if v_missing then
          raise exception 'há perguntas obrigatórias sem resposta'
            using errcode = 'HC011';
        end if;
      end if;

      -- Visible number/date: enforce config min/max (present answer only).
      perform app.assert_item_bounds(
        p_response_id, r_item.id, r_item.item_type, r_item.config, r_item.label
      );
    end loop;

    -- Sign-off check (feature-flagged).
    if r_section.requires_signoff and app.feature_enabled('signoff_enforcement') then
      select exists (
        select 1 from public.response_section_signoffs so
        where so.response_id = p_response_id
          and so.section_id = r_section.id
      ) into v_signoff_exists;

      if not v_signoff_exists then
        raise exception 'há seções pendentes de assinatura'
          using errcode = 'HC012';
      end if;
    end if;
  end loop;

  update public.responses
  set status = 'submitted', submitted_at = now(), updated_at = now()
  where id = p_response_id
  returning * into v_result;

  perform set_config('app.in_submit_rpc', 'off', true);

  return v_result;
end;
$$;

alter function public.submit_response(uuid) owner to postgres;

revoke all on function public.submit_response(uuid) from public;
grant all on function public.submit_response(uuid) to authenticated;
grant all on function public.submit_response(uuid) to service_role;

-- ===========================================================================
-- app.response_required_complete — used by list_signoff_queue's submit-readiness
-- gate. The "required answered" check must also count a selection (a choice item
-- now stores its answer in answer_selected_options, not answers.value), else the
-- queue under-counts ready drafts. Re-stated with the selection-aware predicate;
-- visibility is still group-aware (eval_visibility) via the rebuilt answer_map.
-- ===========================================================================
create or replace function app.response_required_complete(p_response_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_version_id uuid;
  v_answers jsonb;
  r_section record;
  v_missing integer;
begin
  select form_version_id into v_version_id
  from public.responses
  where id = p_response_id;

  if v_version_id is null then
    return false;
  end if;

  v_answers := app.answer_map(p_response_id);

  for r_section in
    select s.id, s.visible_when
    from public.form_sections s
    where s.form_version_id = v_version_id
    order by s.position
  loop
    -- Hidden sections require nothing (group-aware visibility).
    if not app.eval_visibility(r_section.visible_when, v_answers) then
      continue;
    end if;

    select count(*) into v_missing
    from public.form_items i
    where i.section_id = r_section.id
      and i.required = true
      and i.question_key is not null
      -- A per-item visibility condition can hide a required item; honour it.
      and app.eval_visibility(i.visible_when, v_answers)
      and not (
        exists (
          select 1 from public.answers a
          where a.response_id = p_response_id
            and a.item_id = i.id
            and a.value is not null
            and a.value <> 'null'::jsonb
        )
        or exists (
          select 1 from public.answer_selected_options s
          where s.response_id = p_response_id
            and s.item_id = i.id
        )
      );

    if v_missing > 0 then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

alter function app.response_required_complete(uuid) owner to postgres;

revoke all on function app.response_required_complete(uuid) from public;
grant all on function app.response_required_complete(uuid) to authenticated;
grant all on function app.response_required_complete(uuid) to service_role;
