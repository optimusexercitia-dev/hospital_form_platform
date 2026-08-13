-- FF-1 · BE-4 — save_section_answers gains the instance arm, and its
--                p_clear_item_ids delete stops reaching across instances.
--
-- ADR 0087 §Substrate correction 6, confirmed live: `save_section_answers`
-- mentions `group_instance_id` ONLY as hardcoded `null` literals with
-- `on conflict … where group_instance_id is null`. There is no instance arm at
-- all, and `p_clear_item_ids` deletes by `item_id` UNSCOPED — so the first clear
-- of an item would wipe that item across EVERY instance.
--
-- SHAPE (the ADR's "save-path shape" question, settled: ONE payload).
-- `p_instance_answers` is a jsonb ARRAY, one entry per instance touched:
--   [{ "instance_id": uuid,
--      "answers":        { item_id: <scalar jsonb>, … },
--      "selections":     { item_id: [option_code, …], … },
--      "observations":   { item_id: "texto", … },
--      "other_text":     { item_id: "texto", … },
--      "clear_item_ids": [ item_id, … ] }, … ]
-- The inner key names deliberately mirror this RPC's own parameter names rather
-- than the TS `InstanceAnswersInput` field names; `src/lib/responses/actions.ts`
-- does the translation, which is where naming translation already lives
-- (`answersByItemId` → `p_answers`). A section with N instances is still ONE
-- round trip and ONE transaction.
--
-- Per-entry semantics are IDENTICAL to the top-level maps, only instance-scoped:
-- upsert by item (`answers_uq_inst`, the partial unique index that ALREADY
-- exists — F3 shipped both), REPLACE selections, and a delete list. Children of a
-- PLAIN `group` (ruling 6) answer at top level and belong in the top-level maps,
-- never here.
--
-- The signature GAINS a parameter, so this is DROP + CREATE, not CREATE OR
-- REPLACE: two PostgREST-visible overloads where one argument-name set is a
-- prefix of the other risks a 300 Multiple Choices on every call. Grants are
-- re-issued below.

-- ---------------------------------------------------------------------------
-- 1 · The per-instance writer. One entry, one instance. Factored out so
--     save_section_answers stays readable and so the four sub-arms cannot drift
--     between the top-level and instance paths.
--     INVOKER (no SECURITY clause) — it runs under the caller's role, so the
--     `answers` RLS policy is the boundary here exactly as it is for the
--     top-level arm. RLS remains the security boundary (Rule 1).
-- ---------------------------------------------------------------------------
create or replace function app.save_instance_answers(
  p_response_id uuid,
  p_version_id uuid,
  p_entry jsonb
)
returns void
language plpgsql
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_instance_id uuid;
  v_answers jsonb := coalesce(p_entry -> 'answers', '{}'::jsonb);
  v_selections jsonb := coalesce(p_entry -> 'selections', '{}'::jsonb);
  v_observations jsonb := coalesce(p_entry -> 'observations', '{}'::jsonb);
  v_other_text jsonb := coalesce(p_entry -> 'other_text', '{}'::jsonb);
  v_clear uuid[];
  v_bad_item uuid;
  v_bad_code text;
begin
  v_instance_id := nullif(p_entry ->> 'instance_id', '')::uuid;

  if v_instance_id is null then
    raise exception 'entrada de bloco repetível sem identificador'
      using errcode = 'HC0N2';
  end if;

  -- The instance must belong to THIS response. Without this an authenticated
  -- caller could address another response's instance id and rely on the answers
  -- policy alone; RLS would still deny, but a discriminated pt-BR error beats a
  -- zero-row silence, and the check is what makes the negative testable.
  if not exists (
    select 1 from public.response_group_instances gi
    where gi.id = v_instance_id and gi.response_id = p_response_id
  ) then
    raise exception 'item do bloco não encontrado nesta resposta'
      using errcode = 'HC0N2';
  end if;

  -- Every addressed item must belong to this version — the same HC013 guard the
  -- top-level arms apply, over the union of all four maps plus the clear list.
  select (e.key)::uuid into v_bad_item
  from (
    select key from jsonb_each(v_answers)
    union all select key from jsonb_each(v_selections)
    union all select key from jsonb_each(v_observations)
    union all select key from jsonb_each(v_other_text)
  ) e
  where not exists (
    select 1 from public.form_items i
    where i.id = (e.key)::uuid and i.form_version_id = p_version_id
  )
  limit 1;

  if v_bad_item is not null then
    raise exception 'o item % não pertence a esta versão do formulário', v_bad_item
      using errcode = 'HC013';
  end if;

  -- ---- scalar answers ----
  if v_answers <> '{}'::jsonb then
    insert into public.answers
      (response_id, item_id, question_key, value, group_instance_id, answered_at)
    select p_response_id, i.id, i.question_key, e.value, v_instance_id, now()
    from jsonb_each(v_answers) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id, group_instance_id)
      where group_instance_id is not null
    do update set value = excluded.value,
                  question_key = excluded.question_key,
                  answered_at = now();
  end if;

  -- ---- choice selections (REPLACE semantics, scoped to this instance) ----
  if v_selections <> '{}'::jsonb then
    select sel.code into v_bad_code
    from (
      select (e.key)::uuid as item_id, c.value #>> '{}' as code
      from jsonb_each(v_selections) e
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

    insert into public.answers
      (response_id, item_id, question_key, value, group_instance_id, answered_at)
    select p_response_id, i.id, i.question_key, null, v_instance_id, now()
    from jsonb_each(v_selections) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id, group_instance_id)
      where group_instance_id is not null
    do update set answered_at = now();

    delete from public.answer_selected_options s
    using public.answers a
    where s.answer_id = a.id
      and a.response_id = p_response_id
      and a.group_instance_id = v_instance_id
      and a.item_id in (select (e.key)::uuid from jsonb_each(v_selections) e);

    insert into public.answer_selected_options (answer_id, option_id)
    select a.id, o.id
    from (
      select (e.key)::uuid as item_id, c.value #>> '{}' as code
      from jsonb_each(v_selections) e
      cross join lateral jsonb_array_elements(e.value) c
    ) sel
    join public.answers a
      on a.response_id = p_response_id
     and a.group_instance_id = v_instance_id
     and a.item_id = sel.item_id
    join public.form_item_options o
      on o.item_id = sel.item_id and o.code = sel.code;
  end if;

  -- ---- observations ----
  if v_observations <> '{}'::jsonb then
    insert into public.answers
      (response_id, item_id, question_key, observation, group_instance_id)
    select p_response_id, i.id, i.question_key,
           nullif(btrim(e.value #>> '{}'), ''), v_instance_id
    from jsonb_each(v_observations) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id, group_instance_id)
      where group_instance_id is not null
    do update set observation = excluded.observation;
  end if;

  -- ---- "Outros" open text (only when the item's __other__ option is selected) ----
  if v_other_text <> '{}'::jsonb then
    insert into public.answers
      (response_id, item_id, question_key, group_instance_id, answered_at)
    select p_response_id, i.id, i.question_key, v_instance_id, now()
    from jsonb_each(v_other_text) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id, group_instance_id)
      where group_instance_id is not null
    do update set answered_at = now();

    update public.answers a
    set other_text = case
      when exists (
        select 1
        from public.answer_selected_options s
        join public.form_item_options o on o.id = s.option_id
        where s.answer_id = a.id and o.is_other = true
      )
      then nullif(btrim(src.txt), '')
      else null
    end
    from (
      select (e.key)::uuid as item_id, e.value #>> '{}' as txt
      from jsonb_each(v_other_text) e
    ) src
    where a.response_id = p_response_id
      and a.group_instance_id = v_instance_id
      and a.item_id = src.item_id;
  end if;

  -- ---- clear (THIS instance only) ----
  select array_agg((c.value #>> '{}')::uuid) into v_clear
  from jsonb_array_elements(coalesce(p_entry -> 'clear_item_ids', '[]'::jsonb)) c;

  if v_clear is not null and array_length(v_clear, 1) is not null then
    delete from public.answers
    where response_id = p_response_id
      and group_instance_id = v_instance_id
      and item_id = any (v_clear);
  end if;
end;
$$;

comment on function app.save_instance_answers(uuid, uuid, jsonb) is
  'FF-1 (ADR 0087): write ONE repeating-group instance''s slice of a section save. Same four sub-arms as the top-level path, scoped to group_instance_id via the existing answers_uq_inst partial unique. INVOKER — RLS on answers is the boundary.';

-- ---------------------------------------------------------------------------
-- 2 · save_section_answers — signature gains p_instance_answers, so DROP+CREATE.
--     Everything else is the shipped body verbatim, with ONE correction: the
--     p_clear_item_ids delete is now scoped to `group_instance_id is null`.
-- ---------------------------------------------------------------------------
drop function if exists public.save_section_answers(uuid, uuid, jsonb, uuid[], jsonb, jsonb, jsonb);

create function public.save_section_answers(
  p_response_id uuid,
  p_section_id uuid,
  p_answers jsonb default '{}'::jsonb,
  p_clear_item_ids uuid[] default null::uuid[],
  p_observations jsonb default null::jsonb,
  p_selections jsonb default null::jsonb,
  p_other_text jsonb default null::jsonb,
  p_instance_answers jsonb default null::jsonb
)
returns public.responses
language plpgsql
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_version_id uuid;
  v_status text;
  v_commission_id uuid;
  v_result public.responses;
  v_bad_item uuid;
  v_section_version uuid;
  v_bad_code text;
  v_pending_section_id uuid;
  v_pending_section_title text;
  v_signer uuid;
  v_entry jsonb;
begin
  select form_version_id, status, commission_id into v_version_id, v_status, v_commission_id
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

  select form_version_id into v_section_version
  from public.form_sections
  where id = p_section_id;

  if v_section_version is null or v_section_version <> v_version_id then
    raise exception 'a seção % não pertence a esta versão do formulário', p_section_id
      using errcode = 'HC013';
  end if;

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

    insert into public.answers (response_id, item_id, question_key, value, group_instance_id, answered_at)
    select p_response_id, i.id, i.question_key, e.value, null, now()
    from jsonb_each(p_answers) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id) where group_instance_id is null
    do update set value = excluded.value,
                  question_key = excluded.question_key,
                  answered_at = now();
  end if;

  if p_selections is not null and p_selections <> '{}'::jsonb then
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

    insert into public.answers (response_id, item_id, question_key, value, group_instance_id, answered_at)
    select p_response_id, i.id, i.question_key, null, null, now()
    from jsonb_each(p_selections) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id) where group_instance_id is null
    do update set answered_at = now();

    delete from public.answer_selected_options s
    using public.answers a
    where s.answer_id = a.id
      and a.response_id = p_response_id
      and a.group_instance_id is null
      and a.item_id in (select (e.key)::uuid from jsonb_each(p_selections) e);

    insert into public.answer_selected_options (answer_id, option_id)
    select a.id, o.id
    from (
      select (e.key)::uuid as item_id, c.value #>> '{}' as code
      from jsonb_each(p_selections) e
      cross join lateral jsonb_array_elements(e.value) c
    ) sel
    join public.answers a
      on a.response_id = p_response_id
     and a.group_instance_id is null
     and a.item_id = sel.item_id
    join public.form_item_options o
      on o.item_id = sel.item_id and o.code = sel.code;
  end if;

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

    insert into public.answers (response_id, item_id, question_key, observation, group_instance_id)
    select p_response_id, i.id, i.question_key,
           nullif(btrim(e.value #>> '{}'), ''), null
    from jsonb_each(p_observations) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id) where group_instance_id is null
    do update set observation = excluded.observation;
  end if;

  -- ---- "Outros" open text. Upsert the parent answer row, then set other_text
  -- ONLY when the item's reserved __other__ option is among that item's CURRENT
  -- selections (post-selection-write above); otherwise force NULL (no stray text
  -- on an item whose Outro is not selected). ----
  if p_other_text is not null and p_other_text <> '{}'::jsonb then
    select (e.key)::uuid into v_bad_item
    from jsonb_each(p_other_text) e
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

    insert into public.answers (response_id, item_id, question_key, group_instance_id, answered_at)
    select p_response_id, i.id, i.question_key, null, now()
    from jsonb_each(p_other_text) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id) where group_instance_id is null
    do update set answered_at = now();

    update public.answers a
    set other_text = case
      when exists (
        select 1
        from public.answer_selected_options s
        join public.form_item_options o on o.id = s.option_id
        where s.answer_id = a.id and o.is_other = true
      )
      then nullif(btrim(src.txt), '')
      else null
    end
    from (
      select (e.key)::uuid as item_id, e.value #>> '{}' as txt
      from jsonb_each(p_other_text) e
    ) src
    where a.response_id = p_response_id
      and a.group_instance_id is null
      and a.item_id = src.item_id;
  end if;

  -- ---- FF-1: the instance arm. One entry per touched instance, in payload
  -- order. Runs AFTER the top-level arms so a same-call top-level write is
  -- already visible to anything an instance entry reads. ----
  if p_instance_answers is not null and jsonb_typeof(p_instance_answers) = 'array' then
    for v_entry in select value from jsonb_array_elements(p_instance_answers)
    loop
      perform app.save_instance_answers(p_response_id, v_version_id, v_entry);
    end loop;
  end if;

  -- ---- FF-1 (ADR 0087 substrate correction 6): `group_instance_id is null` is
  -- the FIX. This delete was unscoped, so clearing an item at top level wiped
  -- that item's answer in EVERY instance of every repeating group. An
  -- instance-scoped clear goes through the entry's own `clear_item_ids`. ----
  if p_clear_item_ids is not null and array_length(p_clear_item_ids, 1) is not null then
    delete from public.answers
    where response_id = p_response_id
      and group_instance_id is null
      and item_id = any (p_clear_item_ids);
  end if;

  update public.responses
  set last_section_id = p_section_id,
      updated_at = now()
  where id = p_response_id
  returning * into v_result;

  -- S1·N (ADR 0076): event-driven "signoff/requested" — fires once per
  -- response (not per section) the first time a visible, unsigned
  -- staff_admin-role sign-off section exists AND the response is otherwise
  -- submit-ready (mirrors list_signoff_queue's own submit-readiness filter,
  -- so the notification never fires for a draft that couldn't be submitted
  -- yet even with the sign-off). respondent-role sections are excluded — that
  -- signer is the response's own creator, already in the wizard synchronously.
  -- Idempotent via app.enqueue_notification's dedup; safe to re-attempt on
  -- every save.
  if app.response_required_complete(p_response_id) then
    select s.id, s.title into v_pending_section_id, v_pending_section_title
    from public.form_sections s
    where s.form_version_id = v_version_id
      and s.requires_signoff = true and s.signoff_role = 'staff_admin'
      and app.eval_condition(s.visible_when, app.answer_map(p_response_id))
      and not exists (
        select 1 from public.response_section_signoffs so
        where so.response_id = p_response_id and so.section_id = s.id
      )
    order by s.position
    limit 1;

    if v_pending_section_id is not null then
      for v_signer in
        select principal_id from public.memberships
        where commission_id = v_commission_id and role = 'staff_admin'
      loop
        perform app.enqueue_notification(
          v_signer, v_commission_id, 'signoff', 'requested', false,
          'response_section_signoff', p_response_id,
          'Assinatura solicitada', coalesce(v_pending_section_title, ''),
          'signoff:' || p_response_id || ':requested'
        );
      end loop;
    end if;
  end if;

  return v_result;
end;
$$;

revoke all on function public.save_section_answers(uuid, uuid, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.save_section_answers(uuid, uuid, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb)
  to authenticated, service_role;

comment on function public.save_section_answers(uuid, uuid, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb) is
  'Persist a section''s answers + wizard position in one call. FF-1 adds p_instance_answers (a jsonb array, one entry per repeating-group instance — one payload, one transaction) and scopes the p_clear_item_ids delete to group_instance_id is null, which previously wiped an item across every instance.';
