-- ----------------------------------------------------------------------------
-- form-model-normalization (BE-5) — clone copies option rows; publish-time
-- ">= 1 option" + condition/rule code-existence validation.
-- ----------------------------------------------------------------------------
-- 1. clone_form_version: copy form_item_options into the remapped items,
--    preserving code/label/color_token/score/analytics_code/position VERBATIM
--    (codes survive the clone — the cross-version analytics identity).
-- 2. publish_form_version: a choice item must have >= 1 option (the invariant
--    relocated from the dropped form_items_options_shape CHECK to publish time).
-- 3. app.version_has_option_code + code-existence checks in
--    validate_visible_when (item/section conditions), validate_template_recommend_when
--    (answer conditions), validate_template_result_ruleset (rule `when`): a
--    referenced option CODE must actually exist on the target choice item
--    (previously the label value was unvalidated).
--
-- Forward-only / additive (CREATE OR REPLACE). The evaluator and app.answer_map
-- are UNCHANGED.
-- ----------------------------------------------------------------------------

SET check_function_bodies = false;
SET client_min_messages = warning;

-- ===========================================================================
-- app.version_has_option_code — does a choice question in this version have an
-- option with this CODE? (sibling of version_has_input_key.) Used by the
-- condition/rule validators to reject a stale/typo'd code reference.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."version_has_option_code"(
  "p_version_id" "uuid", "p_question_key" "text", "p_code" "text"
) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.form_items i
    join public.form_item_options o on o.item_id = i.id
    where i.form_version_id = p_version_id
      and i.question_key = p_question_key
      and o.code = p_code
  );
$$;

ALTER FUNCTION "app"."version_has_option_code"("p_version_id" "uuid", "p_question_key" "text", "p_code" "text") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "app"."version_has_option_code"("p_version_id" "uuid", "p_question_key" "text", "p_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."version_has_option_code"("p_version_id" "uuid", "p_question_key" "text", "p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."version_has_option_code"("p_version_id" "uuid", "p_question_key" "text", "p_code" "text") TO "service_role";

-- app.item_question_type(version, question_key) — the item_type of a question_key
-- in a version (null if absent). Lets the condition validator know whether a
-- referenced target is a choice type (so it should code-check the value).
CREATE OR REPLACE FUNCTION "app"."item_question_type"(
  "p_version_id" "uuid", "p_question_key" "text"
) RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select max(item_type)
  from public.form_items
  where form_version_id = p_version_id
    and question_key = p_question_key;
$$;

ALTER FUNCTION "app"."item_question_type"("p_version_id" "uuid", "p_question_key" "text") OWNER TO "postgres";

REVOKE ALL ON FUNCTION "app"."item_question_type"("p_version_id" "uuid", "p_question_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."item_question_type"("p_version_id" "uuid", "p_question_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."item_question_type"("p_version_id" "uuid", "p_question_key" "text") TO "service_role";

-- ===========================================================================
-- clone_form_version — copy form_item_options into the remapped items.
-- Re-stated from the form-builder-enhancements def, adding an item-id remap +
-- the option copy. Sections/items copy logic is verbatim.
-- ===========================================================================
create or replace function public.clone_form_version(p_source_version_id uuid)
returns uuid
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_form_id uuid;
  v_next_number integer;
  v_new_version_id uuid;
  v_uid uuid := auth.uid();
  v_existing_draft uuid;
begin
  select form_id into v_form_id
  from public.form_versions
  where id = p_source_version_id;

  if v_form_id is null then
    raise exception 'versão % não encontrada', p_source_version_id
      using errcode = 'no_data_found';
  end if;

  -- ADR 0012: at most one draft per form — return the existing draft if present.
  select id into v_existing_draft
  from public.form_versions
  where form_id = v_form_id and status = 'draft'
  limit 1;

  if v_existing_draft is not null then
    return v_existing_draft;
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next_number
  from public.form_versions
  where form_id = v_form_id;

  insert into public.form_versions (form_id, version_number, status, created_by)
  values (v_form_id, v_next_number, 'draft', v_uid)
  returning id into v_new_version_id;

  create temp table _clone_section_map (old_id uuid, new_id uuid) on commit drop;
  create temp table _clone_item_map (old_id uuid, new_id uuid) on commit drop;

  with src as (
    select id, position, title, description, is_default,
           visible_when, requires_signoff, signoff_role
    from public.form_sections
    where form_version_id = p_source_version_id
  ),
  ins as (
    insert into public.form_sections (
      form_version_id, position, title, description, is_default,
      visible_when, requires_signoff, signoff_role
    )
    select v_new_version_id, position, title, description, is_default,
           visible_when, requires_signoff, signoff_role
    from src
    order by position
    returning id, position
  )
  insert into _clone_section_map (old_id, new_id)
  select src.id, ins.id
  from src
  join ins on ins.position = src.position;

  -- Copy items into the remapped sections, capturing the old->new item id map
  -- (keyed by the remapped section + position, which is unique per version) so
  -- the option copy can rewrite item_id. config + visible_when copy verbatim
  -- (visible_when references question_key + option code, both preserved).
  with src as (
    select i.id, m.new_id as new_section_id, i.position, i.item_type,
           i.question_key, i.label, i.question_explanation, i.config,
           i.visible_when, i.required, i.content
    from public.form_items i
    join public.form_sections s on s.id = i.section_id
    join _clone_section_map m on m.old_id = i.section_id
    where s.form_version_id = p_source_version_id
  ),
  ins as (
    insert into public.form_items (
      section_id, position, item_type,
      question_key, label, question_explanation, config, visible_when,
      required, content
    )
    select new_section_id, position, item_type,
           question_key, label, question_explanation, config, visible_when,
           required, content
    from src
    returning id, section_id, position
  )
  insert into _clone_item_map (old_id, new_id)
  select src.id, ins.id
  from src
  join ins on ins.section_id = src.new_section_id and ins.position = src.position;

  -- Copy option rows into the remapped items, preserving code/label/color_token/
  -- score/analytics_code/position VERBATIM (the code is the cross-version
  -- analytics identity; the sync trigger refills form_version_id from the item).
  insert into public.form_item_options (
    item_id, position, code, label, color_token, score, analytics_code
  )
  select m.new_id, o.position, o.code, o.label, o.color_token, o.score, o.analytics_code
  from public.form_item_options o
  join _clone_item_map m on m.old_id = o.item_id;

  drop table _clone_section_map;
  drop table _clone_item_map;

  return v_new_version_id;
end;
$$;

alter function public.clone_form_version(uuid) owner to postgres;

-- ===========================================================================
-- publish_form_version — + a "choice item must have >= 1 option" gate. Re-stated
-- from 20260620004000_responses.sql verbatim, adding the option check before the
-- status flip (the in_publish_rpc GUC dance + archive-prior + flip are unchanged).
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."publish_form_version"("p_form_version_id" "uuid") RETURNS "public"."form_versions"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_form_id uuid;
  v_status text;
  v_result public.form_versions;
  v_bad_item text;
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

  -- form-model-normalization: every CHOICE item must carry >= 1 option (the
  -- invariant moved from the dropped jsonb-shape CHECK to publish time).
  select coalesce(i.label, i.question_key) into v_bad_item
  from public.form_items i
  where i.form_version_id = p_form_version_id
    and i.item_type in ('multiple_choice', 'dropdown', 'checkbox')
    and not exists (
      select 1 from public.form_item_options o where o.item_id = i.id
    )
  limit 1;

  if v_bad_item is not null then
    raise exception
      'a pergunta "%" precisa de ao menos uma opção de resposta', v_bad_item
      using errcode = 'check_violation';
  end if;

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

ALTER FUNCTION "public"."publish_form_version"("p_form_version_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- app.assert_condition_value_codes — for a condition targeting a CHOICE question,
-- assert every code in its `value` exists as an option of that question in the
-- version. No-op for non-choice targets (number/date/time/free_text — their value
-- is a scalar/bound, not a code) or a null target type. Raises check_violation
-- with a pt-BR message prefixed by p_context.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."assert_condition_value_codes"(
  p_version_id uuid, p_question_key text, p_target_type text,
  p_value jsonb, p_context text
) RETURNS void
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_code text;
begin
  -- Only choice targets carry codes; others compare a scalar/bound.
  if p_target_type is null
     or p_target_type <> all (array['multiple_choice','dropdown','checkbox']) then
    return;
  end if;

  -- Normalize the value to an array of candidate codes (scalar -> 1-element).
  for v_code in
    select e #>> '{}'
    from jsonb_array_elements(
           case when jsonb_typeof(p_value) = 'array'
                then p_value else jsonb_build_array(p_value) end
         ) e
  loop
    if v_code is null or not app.version_has_option_code(p_version_id, p_question_key, v_code) then
      raise exception
        '% referencia a opção "%", que não existe nesta pergunta',
        p_context, coalesce(v_code, 'nula')
        using errcode = 'check_violation';
    end if;
  end loop;
end;
$$;

ALTER FUNCTION "app"."assert_condition_value_codes"(uuid, text, text, jsonb, text) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "app"."assert_condition_value_codes"(uuid, text, text, jsonb, text) FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."assert_condition_value_codes"(uuid, text, text, jsonb, text) TO "authenticated";
GRANT ALL ON FUNCTION "app"."assert_condition_value_codes"(uuid, text, text, jsonb, text) TO "service_role";

-- ===========================================================================
-- validate_visible_when — re-stated from form-builder-enhancements, adding a
-- code-existence check for choice targets in BOTH the section and item condition
-- loops. Everything else (first-section ban, forward/self-ref order, op<->type
-- compatibility) is verbatim. Authoritative publish gate.
-- ===========================================================================
create or replace function public.validate_visible_when(p_form_version_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  r record;            -- section with a condition
  ri record;           -- item with a condition
  rc record;           -- one sub-condition (jsonb)
  v_first_position integer;
  v_ref_min_position integer;
  v_op text;
  v_target_type text;  -- the referenced input's item_type
  v_dep_section integer;
  v_dep_item integer;
  v_ref_section integer;
  v_ref_item integer;
  v_ref_key text;
begin
  select min(position) into v_first_position
  from public.form_sections
  where form_version_id = p_form_version_id;

  -- ---- SECTION conditions (single OR group). ----
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

    for rc in select cond from app.visibility_conditions(r.visible_when) cond loop
      v_op := rc.cond ->> 'op';
      v_ref_key := rc.cond ->> 'question_key';

      select min(s.position), max(i.item_type)
        into v_ref_min_position, v_target_type
      from public.form_items i
      join public.form_sections s on s.id = i.section_id
      where i.form_version_id = p_form_version_id
        and i.question_key = v_ref_key;

      if v_ref_min_position is null then
        raise exception
          'a condição da seção "%" referencia a pergunta "%", que não existe nesta versão',
          coalesce(r.title, '(padrão)'), v_ref_key
          using errcode = 'check_violation';
      end if;

      if v_ref_min_position >= r.position then
        raise exception
          'a condição da seção "%" deve referenciar uma pergunta de uma seção anterior',
          coalesce(r.title, '(padrão)')
          using errcode = 'check_violation';
      end if;

      perform app.assert_condition_op_target(
        v_op, v_target_type, rc.cond -> 'value',
        format('a condição da seção "%s"', coalesce(r.title, '(padrão)'))
      );

      -- form-model-normalization: choice-target value codes must exist.
      perform app.assert_condition_value_codes(
        p_form_version_id, v_ref_key, v_target_type, rc.cond -> 'value',
        format('a condição da seção "%s"', coalesce(r.title, '(padrão)'))
      );
    end loop;
  end loop;

  -- ---- ITEM conditions (single OR group). ----
  for ri in
    select i.id, i.label, i.question_key, i.visible_when,
           s.position as section_position, i.position as item_position
    from public.form_items i
    join public.form_sections s on s.id = i.section_id
    where i.form_version_id = p_form_version_id
      and i.visible_when is not null
    order by s.position, i.position
  loop
    v_dep_section := ri.section_position;
    v_dep_item := ri.item_position;

    for rc in select cond from app.visibility_conditions(ri.visible_when) cond loop
      v_op := rc.cond ->> 'op';
      v_ref_key := rc.cond ->> 'question_key';

      select s.position, i.position, i.item_type
        into v_ref_section, v_ref_item, v_target_type
      from public.form_items i
      join public.form_sections s on s.id = i.section_id
      where i.form_version_id = p_form_version_id
        and i.question_key = v_ref_key
      order by s.position, i.position
      limit 1;

      if v_ref_section is null then
        raise exception
          'a condição da pergunta "%" referencia a pergunta "%", que não existe nesta versão',
          coalesce(ri.label, '(sem rótulo)'), v_ref_key
          using errcode = 'check_violation';
      end if;

      if not (v_ref_section < v_dep_section
              or (v_ref_section = v_dep_section and v_ref_item < v_dep_item)) then
        raise exception
          'a condição da pergunta "%" deve referenciar uma pergunta anterior no formulário',
          coalesce(ri.label, '(sem rótulo)')
          using errcode = 'check_violation';
      end if;

      perform app.assert_condition_op_target(
        v_op, v_target_type, rc.cond -> 'value',
        format('a condição da pergunta "%s"', coalesce(ri.label, '(sem rótulo)'))
      );

      -- form-model-normalization: choice-target value codes must exist.
      perform app.assert_condition_value_codes(
        p_form_version_id, v_ref_key, v_target_type, rc.cond -> 'value',
        format('a condição da pergunta "%s"', coalesce(ri.label, '(sem rótulo)'))
      );
    end loop;
  end loop;

  return true;
end;
$$;

alter function public.validate_visible_when(uuid) owner to postgres;
