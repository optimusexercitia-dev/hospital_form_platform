-- Phase 7 / P7-002 fix: move the custom SQLSTATE class P00xx -> HC0xx.
--
-- ROOT CAUSE (see docs/decisions/0018-custom-sqlstate-class.md). PostgREST 14
-- maps the user-defined SQLSTATE class P0002–P0999 to HTTP 500 (only P0001 ->
-- 400). On a 500, when the error MESSAGE contains non-ASCII UTF-8 (our accented
-- pt-BR), PostgREST 14.5 drops the JSON body and returns text/plain
-- "Something went wrong" — so supabase-js can no longer read error.code, and the
-- data-layer switch(error.code) falls through to the generic message. Our custom
-- codes P0010–P0022 are all in that 500 range AND carry accented messages, so
-- ALL of them regressed (phases 5/6/7) when the local stack bumped to PostgREST
-- 14.5.
--
-- FIX. Re-raise those errors with an arbitrary custom SQLSTATE class HC0xx
-- ("Hospital Commission"): PostgREST maps unknown classes to HTTP 400 WITH the
-- JSON {code,message} body preserved, even with accented text, so error.code is
-- extractable again. Version-agnostic (HC0xx -> 400/JSON on PostgREST 12/13/14),
-- so no config pinning; worst case prod keeps today's behaviour with no
-- regression. The DB messages stay human pt-BR; the action layer still maps
-- code -> friendly copy (no raw PG text leaks, CLAUDE.md §8).
--
-- 1:1 renumber of the CUSTOM codes only — P0010..P0015 in this migration (the
-- committed Phase 5/6 functions, re-stated below verbatim except the errcode),
-- and P0016..P0022 in the Phase-7 migrations (090005/090006), edited in place
-- there as they were not yet shipped. The standard codes (P0002 no_data_found ->
-- 404, 23505, 23514, 42501) are UNCHANGED — they already surface correctly.
--
--   P0010 -> HC010 already_submitted        P0011 -> HC011 missing_required
--   P0012 -> HC012 missing_signoff          P0013 -> HC013 invalid_cross_version
--   P0014 -> HC014 section_not_visible      P0015 -> HC015 already_signed
--   (P0016 -> HC016 .. P0022 -> HC022 are in 090005/090006.)
--
-- CREATE OR REPLACE keeps each signature + grants; ONLY the errcode strings
-- change. The bodies are reproduced from migrations 100005 (submit_response),
-- 090001 (save_section_answers) and 090002 (sign_section); any future edit to
-- those functions must land in a LATER migration, not here.

-- ---------------------------------------------------------------------------
-- public.submit_response(uuid)
-- ---------------------------------------------------------------------------
create or replace function public.submit_response(p_response_id uuid)
 RETURNS responses
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
      using errcode = 'HC010';
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
        using errcode = 'HC011';
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
          using errcode = 'HC012';
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
$function$;


-- ---------------------------------------------------------------------------
-- public.save_section_answers(uuid,uuid,jsonb,uuid[])
-- ---------------------------------------------------------------------------
create or replace function public.save_section_answers(p_response_id uuid, p_section_id uuid, p_answers jsonb DEFAULT '{}'::jsonb, p_clear_item_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS responses
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_version_id uuid;
  v_status text;
  v_result public.responses;
  v_bad_item uuid;
  v_section_version uuid;
begin
  -- Existence + status guard. RLS already confines this SELECT to rows the
  -- caller may read (their own response, or a submitted one in their commission
  -- if staff_admin) — so a foreign in_progress draft reads as "not found".
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

  -- Cross-version section guard (Phase-5 QA MINOR-1): the saved section (which
  -- becomes last_section_id) must belong to this response's version. The FK
  -- guarantees the section EXISTS; this rejects a section from a DIFFERENT
  -- version of the same (or any) form. Distinct SQLSTATE P0013 so the action
  -- layer no longer mislabels it "já enviada".
  select form_version_id into v_section_version
  from public.form_sections
  where id = p_section_id;

  if v_section_version is null or v_section_version <> v_version_id then
    raise exception 'a seção % não pertence a esta versão do formulário', p_section_id
      using errcode = 'HC013';
  end if;

  -- Cross-version item guard: reject any answered item that does not belong to
  -- this response's version. (Display items are rejected separately by the M4
  -- trigger on insert.) Distinct SQLSTATE P0013 (Phase-5 QA MINOR-2).
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

    -- Upsert one answer row per input item. question_key is taken from the
    -- target item; value is stored as provided (the wizard sends only answered
    -- inputs — clearing is done via p_clear_item_ids, not by sending nulls).
    insert into public.answers (response_id, item_id, question_key, value)
    select p_response_id, i.id, i.question_key, e.value
    from jsonb_each(p_answers) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id)
    do update set value = excluded.value,
                  question_key = excluded.question_key;
  end if;

  -- Orphan-clear (warn-and-clear): delete answers of items the wizard reported
  -- as now-hidden. RLS (answers_write_own_draft) confines this to the caller's
  -- own in_progress response.
  if p_clear_item_ids is not null and array_length(p_clear_item_ids, 1) is not null then
    delete from public.answers
    where response_id = p_response_id
      and item_id = any (p_clear_item_ids);
  end if;

  -- Persist wizard position + touch updated_at (resume lands here).
  update public.responses
  set last_section_id = p_section_id,
      updated_at = now()
  where id = p_response_id
  returning * into v_result;

  return v_result;
end;
$function$;


-- ---------------------------------------------------------------------------
-- public.sign_section(uuid,uuid,text)
-- ---------------------------------------------------------------------------
create or replace function public.sign_section(p_response_id uuid, p_section_id uuid, p_note text DEFAULT NULL::text)
 RETURNS response_section_signoffs
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_status text;
  v_version_id uuid;
  v_requires_signoff boolean;
  v_visible_when jsonb;
  v_found boolean := false;
  v_answers jsonb;
  v_result public.response_section_signoffs;
begin
  -- Definer-rights metadata read (see header). No row -> response not found.
  for v_status, v_version_id, v_requires_signoff, v_visible_when in
    select t.status, t.version_id, t.requires_signoff, t.visible_when
    from app.signoff_target(p_response_id, p_section_id) t
  loop
    v_found := true;
  end loop;

  if not v_found then
    raise exception 'resposta % não encontrada', p_response_id
      using errcode = 'no_data_found';
  end if;

  if v_status <> 'in_progress' then
    raise exception 'esta resposta já foi enviada e não pode mais ser assinada'
      using errcode = 'check_violation';
  end if;

  -- requires_signoff null means the section does not belong to this response's
  -- version (the LEFT JOIN found no matching section).
  if v_requires_signoff is null then
    raise exception 'seção % não pertence a esta resposta', p_section_id
      using errcode = 'check_violation';
  end if;

  if not v_requires_signoff then
    raise exception 'esta seção não exige assinatura'
      using errcode = 'check_violation';
  end if;

  -- Visibility precondition (Architecture Rule 4): a section hidden under the
  -- response's saved answers collects no sign-off. RLS cannot cheaply evaluate
  -- this (it would have to read answers from within a signoffs policy), so the
  -- RPC owns it.
  v_answers := app.answer_map(p_response_id);
  if not app.eval_condition(v_visible_when, v_answers) then
    raise exception 'esta seção não está disponível para assinatura'
      using errcode = 'HC014';
  end if;

  -- The insert is the authority for WHO may sign (signoffs_insert WITH CHECK:
  -- respondent -> creator, staff_admin -> is_staff_admin_of, signed_by =
  -- auth.uid(), in_progress). The unique(response_id, section_id) index turns a
  -- double-sign race into a discriminated "already signed".
  begin
    insert into public.response_section_signoffs (response_id, section_id, signed_by, note)
    values (p_response_id, p_section_id, auth.uid(), nullif(btrim(p_note), ''))
    returning * into v_result;
  exception
    when unique_violation then
      raise exception 'esta seção já foi assinada'
        using errcode = 'HC015';
  end;

  return v_result;
end;
$function$;


-- Grants are preserved across CREATE OR REPLACE, re-stated here for clarity.
grant execute on function public.submit_response(uuid) to authenticated, service_role;
grant execute on function public.save_section_answers(uuid, uuid, jsonb, uuid[]) to authenticated, service_role;
grant execute on function public.sign_section(uuid, uuid, text) to authenticated, service_role;
