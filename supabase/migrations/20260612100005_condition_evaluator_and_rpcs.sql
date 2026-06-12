-- Phase 1 / M5: Condition evaluator + publish validation + RPCs.
--
-- The condition evaluator is the single SQL authority for section visibility.
-- It is mirrored by a TypeScript function in src/lib/queries/conditions.ts;
-- a shared test-vector file keeps the two in agreement (ARCHITECTURE Rule 3).
-- submit_response and publish_form_version are the only mutating entry points
-- for, respectively, submission and the version lifecycle.

-- ---------------------------------------------------------------------------
-- app.eval_condition(visible_when, answers) -> boolean
-- ---------------------------------------------------------------------------
-- `answers` is a flat jsonb object mapping question_key -> answer value.
-- A null visible_when means "always visible". Supported ops: equals,
-- not_equals, in. Comparison semantics (must match the TS mirror exactly):
--   - equals:     the answer equals the condition value (jsonb equality). For
--                 a checkbox answer (array), true if the value is among the
--                 selected options.
--   - not_equals: logical negation of equals.
--   - in:         condition value is an array; true if the answer (scalar) is
--                 one of its elements, or (checkbox) if any selected option is.
-- A missing/absent answer is treated as "no value": equals -> false,
-- not_equals -> true, in -> false.
create function app.eval_condition(p_visible_when jsonb, p_answers jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  v_key text;
  v_op text;
  v_target jsonb;
  v_answer jsonb;
  v_present boolean;
  v_match boolean;
begin
  if p_visible_when is null then
    return true;
  end if;

  v_key := p_visible_when ->> 'question_key';
  v_op := p_visible_when ->> 'op';
  v_target := p_visible_when -> 'value';

  v_present := (p_answers ? v_key);
  v_answer := p_answers -> v_key;

  -- Compute "the answer matches the target value" (the equals relation),
  -- accounting for checkbox answers stored as arrays.
  if not v_present or v_answer is null or v_answer = 'null'::jsonb then
    v_match := false;
  elsif jsonb_typeof(v_answer) = 'array' then
    v_match := v_answer @> jsonb_build_array(v_target);
  else
    v_match := (v_answer = v_target);
  end if;

  if v_op = 'equals' then
    return v_match;
  elsif v_op = 'not_equals' then
    return not v_match;
  elsif v_op = 'in' then
    if not v_present or v_answer is null or jsonb_typeof(v_target) <> 'array' then
      return false;
    end if;
    if jsonb_typeof(v_answer) = 'array' then
      -- any selected option appears in the target list
      return exists (
        select 1
        from jsonb_array_elements(v_answer) sel
        where v_target @> jsonb_build_array(sel.value)
      );
    else
      return v_target @> jsonb_build_array(v_answer);
    end if;
  else
    raise exception 'unknown condition op: %', v_op;
  end if;
end;
$$;

grant execute on function app.eval_condition(jsonb, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- app.answer_map(response_id) -> jsonb  (question_key -> value)
-- ---------------------------------------------------------------------------
create function app.answer_map(p_response_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select coalesce(jsonb_object_agg(question_key, value), '{}'::jsonb)
  from public.answers
  where response_id = p_response_id
    and value is not null;
$$;

grant execute on function app.answer_map(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- validate_visible_when(form_version_id)
-- ---------------------------------------------------------------------------
-- Publish-time structural validation of every section's condition:
--   * no condition on the first section (lowest position);
--   * the referenced question_key must belong to an INPUT item that lives in a
--     section with a STRICTLY LOWER position (no forward/self/circular refs).
-- Raises with a clear message naming the offending section. Returns true when
-- all conditions are valid (or there are none).
create function public.validate_visible_when(p_form_version_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  r record;
  v_first_position integer;
  v_ref_min_position integer;
begin
  select min(position) into v_first_position
  from public.form_sections
  where form_version_id = p_form_version_id;

  for r in
    select id, position, title, visible_when
    from public.form_sections
    where form_version_id = p_form_version_id
      and visible_when is not null
    order by position
  loop
    if r.position = v_first_position then
      raise exception
        'a primeira seção não pode ter condição de visibilidade (seção "%")',
        coalesce(r.title, '(padrão)')
        using errcode = 'check_violation';
    end if;

    -- The referenced key must exist as an input item in some EARLIER section.
    select min(s.position) into v_ref_min_position
    from public.form_items i
    join public.form_sections s on s.id = i.section_id
    where i.form_version_id = p_form_version_id
      and i.question_key = (r.visible_when ->> 'question_key');

    if v_ref_min_position is null then
      raise exception
        'a condição da seção "%" referencia a pergunta "%", que não existe nesta versão',
        coalesce(r.title, '(padrão)'), (r.visible_when ->> 'question_key')
        using errcode = 'check_violation';
    end if;

    if v_ref_min_position >= r.position then
      raise exception
        'a condição da seção "%" deve referenciar uma pergunta de uma seção anterior',
        coalesce(r.title, '(padrão)')
        using errcode = 'check_violation';
    end if;
  end loop;

  return true;
end;
$$;

grant execute on function public.validate_visible_when(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- publish_form_version(form_version_id)
-- ---------------------------------------------------------------------------
-- Validates conditions, archives the currently-published version of the same
-- form, and flips this draft to published. SECURITY INVOKER: the caller must
-- pass RLS to update the version (staff_admin of the commission / admin).
-- The status transitions run under the app.in_publish_rpc guard so the
-- published-immutability trigger permits them.
create function public.publish_form_version(p_form_version_id uuid)
returns public.form_versions
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_form_id uuid;
  v_status text;
  v_result public.form_versions;
begin
  select form_id, status into v_form_id, v_status
  from public.form_versions
  where id = p_form_version_id
  for update;

  if v_form_id is null then
    raise exception 'versão % não encontrada', p_form_version_id
      using errcode = 'no_data_found';
  end if;

  if v_status <> 'draft' then
    raise exception 'apenas versões em rascunho podem ser publicadas'
      using errcode = 'check_violation';
  end if;

  perform public.validate_visible_when(p_form_version_id);

  perform set_config('app.in_publish_rpc', 'on', true);

  update public.form_versions
  set status = 'archived'
  where form_id = v_form_id
    and status = 'published';

  update public.form_versions
  set status = 'published', published_at = now()
  where id = p_form_version_id
  returning * into v_result;

  perform set_config('app.in_publish_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.publish_form_version(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- submit_response(response_id)
-- ---------------------------------------------------------------------------
-- The single authority for submission. SECURITY INVOKER so RLS confirms the
-- caller owns the (in_progress) response. Atomically:
--   1. evaluate section visibility from saved answers (position order);
--   2. verify every required input in every VISIBLE section is answered;
--   3. (feature-flagged) verify every visible requires_signoff section has a
--      sign-off row;
--   4. delete stray answers belonging to sections hidden under final
--      visibility;
--   5. flip status -> submitted, stamp submitted_at.
-- Raises typed exceptions the data layer maps to pt-BR messages, discriminated
-- by custom SQLSTATEs in the user-defined class:
--   P0010 already_submitted, P0011 missing_required, P0012 missing_signoff.
create function public.submit_response(p_response_id uuid)
returns public.responses
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_response public.responses;
  v_answers jsonb;
  r_section record;
  v_visible boolean;
  v_missing_count integer;
  v_signoff_exists boolean;
  v_result public.responses;
begin
  -- Read without FOR UPDATE first: a submitted response is readable by its
  -- creator (responses_select) but is NOT lockable under the in_progress-only
  -- update policy, so a FOR UPDATE here would hide an already-submitted row and
  -- mask the double-submit case as "not found".
  select * into v_response
  from public.responses
  where id = p_response_id;

  if v_response.id is null then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  if v_response.status = 'submitted' then
    raise exception 'esta resposta já foi enviada'
      using errcode = 'P0010';
  end if;

  -- Lock the in_progress row for the duration of the submission.
  perform 1 from public.responses
  where id = p_response_id and status = 'in_progress'
  for update;

  v_answers := app.answer_map(p_response_id);

  -- Walk sections in position order; a hidden section requires nothing and its
  -- answers are stray.
  for r_section in
    select s.id, s.position, s.visible_when, s.requires_signoff
    from public.form_sections s
    where s.form_version_id = v_response.form_version_id
    order by s.position
  loop
    v_visible := app.eval_condition(r_section.visible_when, v_answers);

    if not v_visible then
      -- Stray-answer cleanup: remove any answers saved while the section was
      -- visible but now hidden under final answers.
      perform set_config('app.in_submit_rpc', 'on', true);
      delete from public.answers a
      using public.form_items i
      where a.response_id = p_response_id
        and a.item_id = i.id
        and i.section_id = r_section.id;
      perform set_config('app.in_submit_rpc', 'off', true);
      continue;
    end if;

    -- Required-answer check: every required input item must have a non-null
    -- answer.
    select count(*) into v_missing_count
    from public.form_items i
    where i.section_id = r_section.id
      and i.required = true
      and i.question_key is not null
      and not exists (
        select 1 from public.answers a
        where a.response_id = p_response_id
          and a.item_id = i.id
          and a.value is not null
          and a.value <> 'null'::jsonb
      );

    if v_missing_count > 0 then
      raise exception 'há perguntas obrigatórias sem resposta'
        using errcode = 'P0011';
    end if;

    -- Sign-off check (feature-flagged; OFF until Phase 6).
    if r_section.requires_signoff and app.feature_enabled('signoff_enforcement') then
      select exists (
        select 1 from public.response_section_signoffs so
        where so.response_id = p_response_id
          and so.section_id = r_section.id
      ) into v_signoff_exists;

      if not v_signoff_exists then
        raise exception 'há seções pendentes de assinatura'
          using errcode = 'P0012';
      end if;
    end if;
  end loop;

  -- Atomic status flip (permitted by the submitted-immutability guard).
  perform set_config('app.in_submit_rpc', 'on', true);
  update public.responses
  set status = 'submitted', submitted_at = now(), updated_at = now()
  where id = p_response_id
  returning * into v_result;
  perform set_config('app.in_submit_rpc', 'off', true);

  return v_result;
end;
$$;

grant execute on function public.submit_response(uuid) to authenticated, service_role;
