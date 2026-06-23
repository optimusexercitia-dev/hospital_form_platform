-- Form Builder Enhancements (mini-phase; plan docs/plans/form-builder-enhancements.md)
-- ----------------------------------------------------------------------------
-- Seven additive author/respondent capabilities, ALL backward-compatible:
--   * four new input item types: short_text, number, date, time
--   * per-option colours on multiple_choice + checkbox (inside `options` jsonb)
--   * per-question conditional appearance (visible_when) — legacy single OR
--     AND/OR group; conditional questions can never be required
--   * per-answer free-text observation (answers.observation)
--   * the condition evaluator gains ordered ops gt/gte/lt/lte (number/date/time)
--     and a group wrapper app.eval_visibility(); submit_response evaluates
--     per-item visibility (forward pass) + number/date min/max bounds
--
-- NO feature flag, NO data migration. Every relaxed CHECK is a strict SUPERSET
-- of the constraint it replaces (every existing row re-validates); the new
-- columns/constraints apply to columns that are NULL on all existing rows.
--
-- New SQLSTATE:
--   HC061 — a number/date answer violates its config min/max at submit time
--           (HC059/HC060 are taken by phase_results; HC061-HC069 free).
--
-- SQL<->TS evaluator mirror (ARCHITECTURE Rule 3): app.eval_condition mirrors
-- src/lib/queries/conditions.ts evalCondition; app.eval_visibility mirrors
-- evalVisibility. The shared vector files keep them in agreement; drift is a
-- phase-blocking bug.
-- ----------------------------------------------------------------------------

set search_path = public, pg_catalog;

-- ===========================================================================
-- BE-2 — shape-validation helpers (IMMUTABLE, app schema)
-- ===========================================================================

-- A single visible_when condition's shape: an object with question_key (string),
-- op (in the extended set), and a value key. Used by both the group validator
-- and (via app.is_valid_visibility) the table CHECKs.
create or replace function app.is_valid_condition(p jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p is not null
     and jsonb_typeof(p) = 'object'
     and (p ? 'question_key')
     and (p ? 'op')
     and (p ? 'value')
     and jsonb_typeof(p -> 'question_key') = 'string'
     and (p ->> 'op') = any (array[
       'equals','not_equals','in','gt','gte','lt','lte'
     ]);
$$;

alter function app.is_valid_condition(jsonb) owner to postgres;

-- A stored visibility rule: null, OR a legacy single condition, OR an AND/OR
-- group {match: all|any, conditions: [<condition>, ...]} (non-empty). A strict
-- SUPERSET of the previous form_sections_visible_when_shape single-shape CHECK.
create or replace function app.is_valid_visibility(p jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select
    p is null
    or (
      -- group shape
      (p ? 'conditions')
      and jsonb_typeof(p) = 'object'
      and (p ->> 'match') = any (array['all','any'])
      and jsonb_typeof(p -> 'conditions') = 'array'
      and jsonb_array_length(p -> 'conditions') > 0
      and not exists (
        select 1
        from jsonb_array_elements(p -> 'conditions') c
        where not app.is_valid_condition(c.value)
      )
    )
    or (
      -- legacy single shape
      not (p ? 'conditions')
      and app.is_valid_condition(p)
    );
$$;

alter function app.is_valid_visibility(jsonb) owner to postgres;

-- A choice item's `options` jsonb: a non-empty array whose every element is
-- EITHER a bare string (legacy) OR an object {label: string, color: <token>|null}.
-- A strict SUPERSET of the previous "array of strings, length > 0" CHECK.
create or replace function app.is_valid_options(p jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select
    p is not null
    and jsonb_typeof(p) = 'array'
    and jsonb_array_length(p) > 0
    and not exists (
      select 1
      from jsonb_array_elements(p) e
      where not (
        jsonb_typeof(e.value) = 'string'
        or (
          jsonb_typeof(e.value) = 'object'
          and (e.value ? 'label')
          and jsonb_typeof(e.value -> 'label') = 'string'
          and (
            not (e.value ? 'color')
            or jsonb_typeof(e.value -> 'color') = 'null'
            or (e.value ->> 'color') = any (array[
              'muted','slate','blue','amber','green','red','violet'
            ])
          )
        )
      )
    );
$$;

alter function app.is_valid_options(jsonb) owner to postgres;

-- ===========================================================================
-- BE-2 — form_items: new columns + relaxed/added CHECKs
-- ===========================================================================

alter table public.form_items
  add column if not exists "config" jsonb,
  add column if not exists "visible_when" jsonb;

-- item_type: add the four new input types.
alter table public.form_items drop constraint if exists "form_items_item_type_check";
alter table public.form_items add constraint "form_items_item_type_check" check (
  item_type = any (array[
    'multiple_choice','dropdown','checkbox','free_text',
    'short_text','number','date','time',
    'section_text','image'
  ])
);

-- input-vs-display: the four new types follow the INPUT branch (question_key +
-- label NOT NULL, content NULL). Display branch unchanged.
alter table public.form_items drop constraint if exists "form_items_input_vs_display";
alter table public.form_items add constraint "form_items_input_vs_display" check (
  case
    when item_type = any (array[
      'multiple_choice','dropdown','checkbox','free_text',
      'short_text','number','date','time'
    ])
      then (question_key is not null and label is not null and content is null)
    when item_type = any (array['section_text','image'])
      then (content is not null and question_key is null and label is null
            and options is null and question_explanation is null and required = false)
    else null::boolean
  end
);

-- options shape: choice types use app.is_valid_options (string OR {label,color});
-- free_text + the four new input types carry NULL options; display ELSE true.
alter table public.form_items drop constraint if exists "form_items_options_shape";
alter table public.form_items add constraint "form_items_options_shape" check (
  case
    when item_type = any (array['multiple_choice','dropdown','checkbox'])
      then app.is_valid_options(options)
    when item_type = any (array['free_text','short_text','number','date','time'])
      then options is null
    else true
  end
);

-- config: an object or null (semantic min<=max enforced in the action + submit RPC).
alter table public.form_items drop constraint if exists "form_items_config_shape";
alter table public.form_items add constraint "form_items_config_shape" check (
  config is null or jsonb_typeof(config) = 'object'
);

-- visible_when: null or a valid visibility (single or group).
alter table public.form_items drop constraint if exists "form_items_visible_when_shape";
alter table public.form_items add constraint "form_items_visible_when_shape" check (
  visible_when is null or app.is_valid_visibility(visible_when)
);

-- A conditional question can never be required (decision #9).
alter table public.form_items drop constraint if exists "form_items_conditional_not_required";
alter table public.form_items add constraint "form_items_conditional_not_required" check (
  visible_when is null or required = false
);

-- ===========================================================================
-- BE-2 — form_sections: visible_when accepts the group shape too
-- ===========================================================================

-- form_sections_default_shape (default ⇒ visible_when NULL) and
-- form_sections_signoff_role are untouched. Only the visible_when SHAPE check
-- is widened (single → single-or-group); a strict superset.
alter table public.form_sections drop constraint if exists "form_sections_visible_when_shape";
alter table public.form_sections add constraint "form_sections_visible_when_shape" check (
  visible_when is null or app.is_valid_visibility(visible_when)
);

-- ===========================================================================
-- BE-2 — answers: per-answer observation
-- ===========================================================================

alter table public.answers
  add column if not exists "observation" text;

-- ===========================================================================
-- BE-3 — condition evaluator: ordered ops + group wrapper
-- ===========================================================================

-- app.eval_condition: equals/not_equals/in unchanged byte-for-byte; add the
-- ordered ops gt/gte/lt/lte. Ordered comparison: BOTH operands JSON numbers ->
-- numeric; else text (#>> '{}') so ISO date (YYYY-MM-DD) and time (HH:mm) sort
-- correctly. Missing/null/array answer never orders -> false. Mirrors TS
-- orderedCompare() in src/lib/queries/conditions.ts.
create or replace function app.eval_condition(p_visible_when jsonb, p_answers jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_key text;
  v_op text;
  v_target jsonb;
  v_answer jsonb;
  v_present boolean;
  v_match boolean;
  v_cmp integer;
  v_a_text text;
  v_b_text text;
begin
  if p_visible_when is null then
    return true;
  end if;

  v_key := p_visible_when ->> 'question_key';
  v_op := p_visible_when ->> 'op';
  v_target := p_visible_when -> 'value';

  v_present := (p_answers ? v_key);
  v_answer := p_answers -> v_key;

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
      return exists (
        select 1
        from jsonb_array_elements(v_answer) sel
        where v_target @> jsonb_build_array(sel.value)
      );
    else
      return v_target @> jsonb_build_array(v_answer);
    end if;
  elsif v_op in ('gt','gte','lt','lte') then
    -- Ordered comparison: undefined (no order) -> false for every op.
    if not v_present or v_answer is null or v_answer = 'null'::jsonb
       or jsonb_typeof(v_answer) = 'array' or jsonb_typeof(v_target) = 'array'
       or jsonb_typeof(v_answer) = 'object' or jsonb_typeof(v_target) = 'object' then
      return false;
    end if;

    if jsonb_typeof(v_answer) = 'number' and jsonb_typeof(v_target) = 'number' then
      v_cmp := sign((v_answer)::text::numeric - (v_target)::text::numeric)::integer;
    else
      v_a_text := v_answer #>> '{}';
      v_b_text := v_target #>> '{}';
      if v_a_text < v_b_text then
        v_cmp := -1;
      elsif v_a_text > v_b_text then
        v_cmp := 1;
      else
        v_cmp := 0;
      end if;
    end if;

    if v_op = 'gt' then
      return v_cmp > 0;
    elsif v_op = 'gte' then
      return v_cmp >= 0;
    elsif v_op = 'lt' then
      return v_cmp < 0;
    else -- 'lte'
      return v_cmp <= 0;
    end if;
  else
    raise exception 'unknown condition op: %', v_op;
  end if;
end;
$$;

alter function app.eval_condition(jsonb, jsonb) owner to postgres;

-- app.eval_visibility: null -> true; group (has 'conditions') -> bool_and/bool_or
-- per match over app.eval_condition; else delegate the legacy single shape.
-- Mirrors TS evalVisibility().
create or replace function app.eval_visibility(p_rule jsonb, p_answers jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_match text;
  v_result boolean;
begin
  if p_rule is null then
    return true;
  end if;

  if p_rule ? 'conditions' then
    v_match := p_rule ->> 'match';
    if v_match = 'any' then
      select coalesce(bool_or(app.eval_condition(c.value, p_answers)), false)
        into v_result
        from jsonb_array_elements(p_rule -> 'conditions') c;
    else
      -- 'all' (AND); empty -> true (bool_and over empty), though the CHECK
      -- forbids an empty group.
      select coalesce(bool_and(app.eval_condition(c.value, p_answers)), true)
        into v_result
        from jsonb_array_elements(p_rule -> 'conditions') c;
    end if;
    return v_result;
  end if;

  -- Legacy single shape.
  return app.eval_condition(p_rule, p_answers);
end;
$$;

alter function app.eval_visibility(jsonb, jsonb) owner to postgres;

-- ===========================================================================
-- BE-3 — publish validation: walk SECTION conditions (now group-aware) AND
--        ITEM conditions, validating reference order + operator<->target-type
-- ===========================================================================

-- app.visibility_conditions(rule): normalize a visible_when (single or group)
-- into the flat SET of its sub-conditions, so the validator walks both shapes
-- uniformly. One row per sub-condition (group: each element; single: the rule
-- itself; null: zero rows).
create or replace function app.visibility_conditions(p_rule jsonb)
returns setof jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select c.value
  from jsonb_array_elements(p_rule -> 'conditions') c
  where p_rule is not null and (p_rule ? 'conditions')
  union all
  select p_rule
  where p_rule is not null and not (p_rule ? 'conditions');
$$;

alter function app.visibility_conditions(jsonb) owner to postgres;

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
begin
  select min(position) into v_first_position
  from public.form_sections
  where form_version_id = p_form_version_id;

  -- ---- SECTION conditions (single OR group). A referenced key must exist as
  -- an input item in a STRICTLY-EARLIER section; the first section may carry
  -- no condition. ----
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

      -- Referenced input item: earliest section that defines this question_key.
      select min(s.position), max(i.item_type)
        into v_ref_min_position, v_target_type
      from public.form_items i
      join public.form_sections s on s.id = i.section_id
      where i.form_version_id = p_form_version_id
        and i.question_key = (rc.cond ->> 'question_key');

      if v_ref_min_position is null then
        raise exception
          'a condição da seção "%" referencia a pergunta "%", que não existe nesta versão',
          coalesce(r.title, '(padrão)'), (rc.cond ->> 'question_key')
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
    end loop;
  end loop;

  -- ---- ITEM conditions (single OR group). A referenced key must belong to an
  -- input item STRICTLY EARLIER in document order: an earlier section, OR an
  -- earlier item in the SAME section (rejects self- and forward-refs). ----
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

      -- The referenced input's tuple (section.position, item.position) + type.
      select s.position, i.position, i.item_type
        into v_ref_section, v_ref_item, v_target_type
      from public.form_items i
      join public.form_sections s on s.id = i.section_id
      where i.form_version_id = p_form_version_id
        and i.question_key = (rc.cond ->> 'question_key')
      order by s.position, i.position
      limit 1;

      if v_ref_section is null then
        raise exception
          'a condição da pergunta "%" referencia a pergunta "%", que não existe nesta versão',
          coalesce(ri.label, '(sem rótulo)'), (rc.cond ->> 'question_key')
          using errcode = 'check_violation';
      end if;

      -- Strictly earlier in document order: earlier section, or same section +
      -- earlier item. (Tuple < dependent tuple; equality = self-ref, rejected.)
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
    end loop;
  end loop;

  return true;
end;
$$;

alter function public.validate_visible_when(uuid) owner to postgres;

-- Operator<->target-type compatibility (shared by section + item validation):
--   in            -> choice target (mc/dropdown/checkbox) + array value
--   gt/gte/lt/lte -> number/date/time target
--   equals/not_equals -> any input target
-- p_context is the pt-BR clause prefix ('a condição da seção "X"' / 'da pergunta "X"').
create or replace function app.assert_condition_op_target(
  p_op text, p_target_type text, p_value jsonb, p_context text
)
returns void
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_op = 'in' then
    if p_target_type is null
       or p_target_type <> all (array['multiple_choice','dropdown','checkbox']) then
      raise exception
        '% usa o operador "está em", que exige uma pergunta de múltipla escolha',
        p_context
        using errcode = 'check_violation';
    end if;
    if p_value is null or jsonb_typeof(p_value) <> 'array' then
      raise exception
        '% usa o operador "está em" com um valor inválido (esperada uma lista)',
        p_context
        using errcode = 'check_violation';
    end if;
  elsif p_op in ('gt','gte','lt','lte') then
    if p_target_type is null
       or p_target_type <> all (array['number','date','time']) then
      raise exception
        '% usa um operador de comparação, que exige uma pergunta de número, data ou hora',
        p_context
        using errcode = 'check_violation';
    end if;
  end if;
  -- equals / not_equals: valid against any input target.
end;
$$;

alter function app.assert_condition_op_target(text, text, jsonb, text) owner to postgres;

-- ===========================================================================
-- BE-4 — submit_response: per-item visibility forward pass + min/max bounds
-- ===========================================================================

-- A helper that enforces a number/date item's config min/max against its saved
-- answer. Raises HC061 with a parameterized pt-BR message. time has no bounds.
create or replace function app.assert_item_bounds(
  p_response_id uuid, p_item_id uuid, p_item_type text, p_config jsonb, p_label text
)
returns void
language plpgsql
set search_path = public, pg_catalog
as $$
declare
  v_value jsonb;
  v_min jsonb;
  v_max jsonb;
begin
  if p_config is null then
    return;
  end if;
  if p_item_type <> all (array['number','date']) then
    return;
  end if;

  select a.value into v_value
  from public.answers a
  where a.response_id = p_response_id and a.item_id = p_item_id;

  -- Only enforce when an answer is PRESENT (a blank non-required field is owned
  -- by the required check, not bounds).
  if v_value is null or v_value = 'null'::jsonb then
    return;
  end if;

  v_min := p_config -> 'min';
  v_max := p_config -> 'max';

  if p_item_type = 'number' then
    if v_min is not null and jsonb_typeof(v_min) = 'number'
       and jsonb_typeof(v_value) = 'number'
       and (v_value)::text::numeric < (v_min)::text::numeric then
      raise exception 'a pergunta "%" exige um valor maior ou igual a %',
        coalesce(p_label, '(sem rótulo)'), (v_min #>> '{}')
        using errcode = 'HC061';
    end if;
    if v_max is not null and jsonb_typeof(v_max) = 'number'
       and jsonb_typeof(v_value) = 'number'
       and (v_value)::text::numeric > (v_max)::text::numeric then
      raise exception 'a pergunta "%" exige um valor menor ou igual a %',
        coalesce(p_label, '(sem rótulo)'), (v_max #>> '{}')
        using errcode = 'HC061';
    end if;
  else -- 'date' — text compare on ISO YYYY-MM-DD
    if v_min is not null and jsonb_typeof(v_min) = 'string'
       and (v_value #>> '{}') < (v_min #>> '{}') then
      raise exception 'a pergunta "%" exige uma data a partir de %',
        coalesce(p_label, '(sem rótulo)'), (v_min #>> '{}')
        using errcode = 'HC061';
    end if;
    if v_max is not null and jsonb_typeof(v_max) = 'string'
       and (v_value #>> '{}') > (v_max #>> '{}') then
      raise exception 'a pergunta "%" exige uma data até %',
        coalesce(p_label, '(sem rótulo)'), (v_max #>> '{}')
        using errcode = 'HC061';
    end if;
  end if;
end;
$$;

alter function app.assert_item_bounds(uuid, uuid, text, jsonb, text) owner to postgres;

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
  -- Read without FOR UPDATE first (see the original rationale): a submitted row
  -- is readable but not lockable under the in_progress-only update policy.
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

  -- Effective map starts from the saved answers; we DROP hidden items'/sections'
  -- keys as we walk in document order, so a single forward pass resolves
  -- cascades (all refs are strictly-earlier).
  v_eff := app.answer_map(p_response_id);

  perform set_config('app.in_submit_rpc', 'on', true);

  for r_section in
    select s.id, s.position, s.visible_when, s.requires_signoff
    from public.form_sections s
    where s.form_version_id = v_response.form_version_id
    order by s.position
  loop
    -- Section visibility — group-safe.
    v_visible := app.eval_visibility(r_section.visible_when, v_eff);

    if not v_visible then
      -- Stray-answer cleanup for the whole section + drop its keys from v_eff.
      delete from public.answers a
      using public.form_items i
      where a.response_id = p_response_id
        and a.item_id = i.id
        and i.section_id = r_section.id;

      v_eff := v_eff - (
        select coalesce(array_agg(i.question_key), '{}')
        from public.form_items i
        where i.section_id = r_section.id
          and i.question_key is not null
      );
      continue;
    end if;

    -- Walk the section's items in position order, maintaining v_eff.
    for r_item in
      select i.id, i.position, i.item_type, i.question_key, i.label,
             i.required, i.config, i.visible_when
      from public.form_items i
      where i.section_id = r_section.id
        and i.question_key is not null   -- input items only
      order by i.position
    loop
      if not app.eval_visibility(r_item.visible_when, v_eff) then
        -- Hidden item: clear its answer + drop its key (downstream sees absent).
        delete from public.answers a
        where a.response_id = p_response_id and a.item_id = r_item.id;
        v_eff := v_eff - r_item.question_key;
        continue;
      end if;

      -- Visible & required: must have a non-null answer.
      if r_item.required then
        select not exists (
          select 1 from public.answers a
          where a.response_id = p_response_id
            and a.item_id = r_item.id
            and a.value is not null
            and a.value <> 'null'::jsonb
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

  -- Atomic status flip.
  update public.responses
  set status = 'submitted', submitted_at = now(), updated_at = now()
  where id = p_response_id
  returning * into v_result;

  perform set_config('app.in_submit_rpc', 'off', true);

  return v_result;
end;
$$;

alter function public.submit_response(uuid) owner to postgres;

-- ===========================================================================
-- BE-4 — clone_form_version: copy visible_when + config (colours ride options)
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

  -- Copy items into the remapped sections. config + visible_when are copied
  -- verbatim (visible_when references question_key, which is preserved, so it
  -- survives the clone unchanged); options carries its colours along for free.
  insert into public.form_items (
    section_id, position, item_type,
    question_key, label, question_explanation, options, config, visible_when,
    required, content
  )
  select m.new_id, i.position, i.item_type,
         i.question_key, i.label, i.question_explanation, i.options, i.config,
         i.visible_when, i.required, i.content
  from public.form_items i
  join public.form_sections s on s.id = i.section_id
  join _clone_section_map m on m.old_id = i.section_id
  where s.form_version_id = p_source_version_id;

  drop table _clone_section_map;

  return v_new_version_id;
end;
$$;

alter function public.clone_form_version(uuid) owner to postgres;

-- ===========================================================================
-- BE-4 — save_section_answers: + p_observations (DROP+CREATE the signature)
-- ===========================================================================

-- DROP the 4-arg signature, then CREATE the 5-arg one (avoids an ambiguous
-- overload). Every existing semantic is preserved verbatim: the HC013
-- cross-version section + item guards, last_section_id, updated_at, the
-- search_path pin, and the REVOKE/GRANT block re-applied below. The observation
-- upsert touches ONLY answers.observation (never value), and the value upsert
-- never touches observation.
drop function if exists public.save_section_answers(uuid, uuid, jsonb, uuid[]);

create or replace function public.save_section_answers(
  p_response_id uuid,
  p_section_id uuid,
  p_answers jsonb default '{}'::jsonb,
  p_clear_item_ids uuid[] default null::uuid[],
  p_observations jsonb default null::jsonb
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

    insert into public.answers (response_id, item_id, question_key, value)
    select p_response_id, i.id, i.question_key, e.value
    from jsonb_each(p_answers) e
    join public.form_items i on i.id = (e.key)::uuid
    on conflict (response_id, item_id)
    do update set value = excluded.value,
                  question_key = excluded.question_key;
  end if;

  -- Observation upsert (touches ONLY the observation column). Items must belong
  -- to this version (same guard as the answer upsert). A blank/empty string
  -- clears the observation; a value sets it. An answer row may not yet exist for
  -- a still-unanswered question, but observations are offered only after an
  -- answer in the UI, so an upsert keyed on (response, item) is safe — it stores
  -- the observation alongside whatever value is present (NULL if none).
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

  if p_clear_item_ids is not null and array_length(p_clear_item_ids, 1) is not null then
    delete from public.answers
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

alter function public.save_section_answers(uuid, uuid, jsonb, uuid[], jsonb) owner to postgres;

-- Re-apply the grant surface for the new signature (mirrors the original block).
revoke all on function public.save_section_answers(uuid, uuid, jsonb, uuid[], jsonb) from public;
grant all on function public.save_section_answers(uuid, uuid, jsonb, uuid[], jsonb) to authenticated;
grant all on function public.save_section_answers(uuid, uuid, jsonb, uuid[], jsonb) to service_role;
