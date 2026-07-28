-- =============================================================================
-- FF-5 (ADR 0091) — Entity Reference, part 3 of 7: the SAVE PATH.
--
-- Adds the reference arm to BOTH writers, in the order the program plan §2 fixed
-- for this shared surface: `save_section_answers` (top level) and
-- `app.save_instance_answers` (per instance).
--
-- ⚠ BOTH, NOT ONE. The standing lesson from FF-2 and FF-3 is that a new answer
-- shape must inherit EVERY sibling arm, and that the enumeration's boundary is
-- never a filename: the top-level and per-instance save paths are two separate
-- functions, and a reference item inside a repeating group goes through the
-- second one only. Wiring just the top-level arm would leave the feature working
-- everywhere except inside a group — the composition FF-1 established works "by
-- construction" and that every later phase therefore has to TEST, not assume.
--
-- `save_section_answers` gains `p_references jsonb`. Adding a parameter means
-- DROP-then-CREATE (a `create or replace` with a new signature would silently
-- OVERLOAD, leaving the 10-arg version live for any caller that still names it),
-- so the grants are restored explicitly below — they do not survive the drop.
-- Live ACL read from pg_proc.proacl before dropping: authenticated=X, service_role=X.
--
-- SQLSTATE: allocates none (the arms raise the part-2 codes).
-- =============================================================================

drop function if exists public.save_section_answers(
  uuid, uuid, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
);

create function public.save_section_answers(
  p_response_id uuid,
  p_section_id uuid,
  p_answers jsonb default '{}'::jsonb,
  p_clear_item_ids uuid[] default null,
  p_observations jsonb default null,
  p_selections jsonb default null,
  p_other_text jsonb default null,
  p_instance_answers jsonb default null,
  p_matrix_cells jsonb default null,
  p_risk_matrix jsonb default null,
  p_references jsonb default null
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

  -- ---- FF-2 (ADR 0089): the TOP-LEVEL matrix arms. Both helpers are DEFINER
  -- (the answer tables are SELECT-only for `authenticated` — K9) and both
  -- early-return on an empty payload, so the flag assertion inside them only
  -- fires when a matrix payload was actually sent. ----
  perform app.save_matrix_answers(p_response_id, v_version_id, p_matrix_cells, null);
  perform app.save_risk_matrix_answers(p_response_id, v_version_id, p_risk_matrix, null);

  -- ---- FF-5 (ADR 0091): the TOP-LEVEL reference arm. Same posture as the two
  -- matrix arms above — DEFINER, early-returns empty, so `entity_refs` is only
  -- asserted when a reference payload was actually sent and a form with no
  -- reference items is unaffected while the flag is off. ----
  perform app.save_reference_answers(p_response_id, v_version_id, p_references, null);

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

-- Restored explicitly — DROP FUNCTION takes the ACL with it.
grant execute on function public.save_section_answers(
  uuid, uuid, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- The per-instance arm. `app.save_instance_answers` is INVOKER (it runs under
-- RLS, which is how it inherited the targeted-respondent arm for free); the
-- reference helper it calls is DEFINER and carries its own gate, exactly as the
-- two matrix helpers beside it do.
-- -----------------------------------------------------------------------------
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
  v_matrix_cells jsonb := coalesce(p_entry -> 'matrix_cells', '{}'::jsonb);
  v_risk_matrix jsonb := coalesce(p_entry -> 'risk_matrix', '{}'::jsonb);
  v_references jsonb := coalesce(p_entry -> 'references', '{}'::jsonb);
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
  -- The two FF-2 matrix maps and the FF-5 reference map are NOT folded in here:
  -- their helpers apply a STRICTER check of their own (version membership AND
  -- item_type), and weakening it to this one would let a `short_text` id through
  -- to a matrix or reference writer.
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

  -- ---- FF-2 (ADR 0089): the matrix arms, scoped to THIS instance. ----
  perform app.save_matrix_answers(p_response_id, p_version_id, v_matrix_cells, v_instance_id);
  perform app.save_risk_matrix_answers(p_response_id, p_version_id, v_risk_matrix, v_instance_id);

  -- ---- FF-5 (ADR 0091): the reference arm, scoped to THIS instance. This is
  -- the arm that makes a reference item inside a repeating group work; the
  -- top-level arm in save_section_answers never sees it. ----
  perform app.save_reference_answers(p_response_id, p_version_id, v_references, v_instance_id);

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
