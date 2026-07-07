-- ============================================================================
-- "Outros" open option (answer-model touch) + free_text/short_text length limits.
--
-- OTHERS (decision 6; multiple_choice + checkbox ONLY):
--   * form_items.config.allowOther boolean — the builder toggle ("Incluir opção
--     'Outros'"). Frontend NEVER emits the reserved row; it only sets this flag.
--   * A RESERVED option row per allow-other item: reserved code `__other__`,
--     is_other = true, ALWAYS LAST position, fixed label "Outro". Owned ENTIRELY
--     by reconcile_item_options (mint when allowOther true, drop when false,
--     keep+reposition when present) — its absence from the author payload is NEVER
--     a deletion. Selection flows through answer_selected_options like any option,
--     so a condition can reference "Outro selected" via the stable `__other__`
--     code (survives clone/versioning). The reserved code is collision-safe:
--     slugifyLabel strips leading/trailing `_`, so an author code can never be
--     `__other__`.
--   * answers.other_text text — the typed "Outro" value (one parent answer row per
--     item covers MC-single + checkbox-multi). NEVER a code/scalar answer, so it is
--     NEVER in the answer map → NEVER fed to eval_condition (evaluator UNCHANGED);
--     dashboards ignore it. Written by save_section_answers only when the item's
--     `__other__` option is among that item's submitted selections.
--
-- LENGTH LIMITS (free_text + short_text):
--   * config.minLength / config.maxLength (integers) validated at submit
--     (char_length of the text answer) inside assert_item_bounds. min ≤ chars ≤ max.
--
-- Additive, pre-launch. reconcile_item_options + clone_form_version are re-created
-- carrying the flagged column from 20260713000700 PLUS the new is_other column
-- (forward-only: the latest definition is complete).
--
-- ORDER: 1. columns  2. reconcile (reserved-row lifecycle)  3. clone (copy is_other)
--        4. save_section_answers (p_other_text)  5. assert_item_bounds (length)
-- ============================================================================

-- ============================================================================
-- SECTION 1 — COLUMNS
-- ============================================================================

alter table public.answers
  add column if not exists other_text text;

comment on column public.answers.other_text is
  '"Outros" open option (form-builder-enhancements): the free-text value typed when the item''s reserved __other__ option is selected. One row per (response,item) covers MC-single + checkbox-multi. NON-analytic: never a code/scalar answer, never in the answer map, never fed to eval_condition, never aggregated by dashboards.';

alter table public.form_item_options
  add column if not exists is_other boolean not null default false;

comment on column public.form_item_options.is_other is
  '"Outros" reserved option (form-builder-enhancements): true ONLY for the auto-managed __other__ row (code __other__, always last, label "Outro"). Owned entirely by reconcile_item_options (minted/dropped by config.allowOther); NEVER author-editable. Selecting it reveals the other_text input. Copied verbatim on clone.';

-- Reserved sentinel code (collision-safe: author slugs strip leading/trailing `_`).
-- Kept inline (a single literal) rather than a constant fn — used in 2 sites below.

-- ============================================================================
-- SECTION 2 — reconcile_item_options: author rows + reserved __other__ lifecycle.
-- Carries `flagged` (from 20260713000700) AND now `is_other`.
-- ============================================================================

create or replace function public.reconcile_item_options(p_item_id uuid, p_options jsonb)
returns void
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_dup text;
  v_allow_other boolean;
  v_item_type text;
  v_max_pos integer;
begin
  if p_options is null or jsonb_typeof(p_options) <> 'array' then
    raise exception 'lista de opções inválida' using errcode = 'check_violation';
  end if;

  -- The AUTHOR payload must never carry the reserved code (frontend filters it);
  -- reject it defensively so an is_other row can never be author-minted.
  if exists (
    select 1 from jsonb_array_elements(p_options) e where e ->> 'code' = '__other__'
  ) then
    raise exception 'o código de opção "__other__" é reservado' using errcode = 'HC013';
  end if;

  select code into v_dup
  from (
    select e ->> 'code' as code, count(*) as n
    from jsonb_array_elements(p_options) e
    group by e ->> 'code'
    having count(*) > 1
  ) d
  limit 1;
  if v_dup is not null then
    raise exception 'código de opção duplicado: %', v_dup using errcode = 'HC013';
  end if;

  -- Resolve allowOther + type from the item (config was written BEFORE this call by
  -- addItem/updateItem). allowOther applies to multiple_choice + checkbox only.
  select coalesce((i.config ->> 'allowOther')::boolean, false), i.item_type
    into v_allow_other, v_item_type
  from public.form_items i
  where i.id = p_item_id;
  v_allow_other := v_allow_other and v_item_type in ('multiple_choice', 'checkbox');

  create temp table _reconcile_opts on commit drop as
  select (e.value ->> 'code')::text as code,
         (e.value ->> 'label')::text as label,
         nullif(e.value ->> 'color_token', '')::text as color_token,
         case when e.value -> 'score' is null or jsonb_typeof(e.value -> 'score') = 'null'
              then null else (e.value ->> 'score')::numeric end as score,
         nullif(e.value ->> 'analytics_code', '')::text as analytics_code,
         coalesce((e.value ->> 'flagged')::boolean, false) as flagged,
         (e.ordinality - 1)::integer as position
  from jsonb_array_elements(p_options) with ordinality e;

  -- 1) DELETE existing AUTHOR rows whose code is no longer in the payload. The
  -- reserved is_other row is EXCLUDED (its absence from the payload is NOT a
  -- deletion — it is managed in step 5 by allowOther).
  delete from public.form_item_options o
  where o.item_id = p_item_id
    and o.is_other = false
    and not exists (select 1 from _reconcile_opts r where r.code = o.code);

  -- 2) UPDATE kept author rows.
  update public.form_item_options o
  set label = r.label,
      color_token = r.color_token,
      score = r.score,
      analytics_code = r.analytics_code,
      flagged = r.flagged
  from _reconcile_opts r
  where o.item_id = p_item_id and o.code = r.code and o.is_other = false;

  -- 3) INSERT new author rows at a HIGH temp band.
  insert into public.form_item_options
    (item_id, position, code, label, color_token, score, analytics_code, flagged)
  select p_item_id,
         1000000 + r.position,
         r.code, r.label, r.color_token, r.score, r.analytics_code, r.flagged
  from _reconcile_opts r
  where not exists (
    select 1 from public.form_item_options o
    where o.item_id = p_item_id and o.code = r.code
  );

  -- 3.5) Park any existing reserved row at a HIGH temp position (above the author
  -- band) so the author reposition in step 4 cannot collide with its stale
  -- position (the (item_id, position) unique is deferrable-INITIALLY-IMMEDIATE, so
  -- it is checked at each statement's end — a separate reserved-row statement must
  -- not leave a duplicate at step-4-end). Step 5 places it at its final slot.
  update public.form_item_options
  set position = 2000000
  where item_id = p_item_id and is_other = true;

  -- 4) Assign ALL author positions (0..n-1) in ONE statement (DEFERRABLE-unique
  -- tolerant). The reserved row is repositioned in step 5.
  update public.form_item_options o
  set position = r.position
  from _reconcile_opts r
  where o.item_id = p_item_id and o.code = r.code and o.is_other = false;

  drop table _reconcile_opts;

  -- 5) Reserved __other__ lifecycle (deterministic, no churn):
  if v_allow_other then
    -- Ensure exactly one is_other row exists, at LAST position (max author pos + 1).
    select coalesce(max(position), -1) into v_max_pos
    from public.form_item_options
    where item_id = p_item_id and is_other = false;

    if exists (
      select 1 from public.form_item_options
      where item_id = p_item_id and is_other = true
    ) then
      update public.form_item_options
      set position = v_max_pos + 1, label = 'Outro'
      where item_id = p_item_id and is_other = true;
    else
      insert into public.form_item_options
        (item_id, position, code, label, is_other)
      values (p_item_id, v_max_pos + 1, '__other__', 'Outro', true);
    end if;
  else
    -- allowOther off → drop any reserved row (author rows untouched).
    delete from public.form_item_options
    where item_id = p_item_id and is_other = true;
  end if;
end;
$$;
alter function public.reconcile_item_options(uuid, jsonb) owner to postgres;

-- ============================================================================
-- SECTION 3 — clone_form_version: copy is_other (+ flagged, + config verbatim).
-- ============================================================================

create or replace function public.clone_form_version(p_source_version_id uuid)
returns uuid
language plpgsql
set search_path to 'public', 'pg_catalog'
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

  with src as (
    select i.id, m.new_id as new_section_id, i.position, i.item_type,
           i.question_key, i.label, i.question_explanation, i.config,
           i.visible_when, i.required, i.content, i.default_value, i.parent_item_id
    from public.form_items i
    join public.form_sections s on s.id = i.section_id
    join _clone_section_map m on m.old_id = i.section_id
    where s.form_version_id = p_source_version_id
  ),
  ins as (
    insert into public.form_items (
      section_id, position, item_type,
      question_key, label, question_explanation, config, visible_when,
      required, content, default_value
    )
    select new_section_id, position, item_type,
           question_key, label, question_explanation, config, visible_when,
           required, content, default_value
    from src
    returning id, section_id, position
  )
  insert into _clone_item_map (old_id, new_id)
  select src.id, ins.id
  from src
  join ins on ins.section_id = src.new_section_id and ins.position = src.position;

  update public.form_items c
  set parent_item_id = pm.new_id
  from public.form_items src
  join _clone_item_map im on im.old_id = src.id
  join _clone_item_map pm on pm.old_id = src.parent_item_id
  where c.id = im.new_id
    and src.parent_item_id is not null;

  -- Copy option rows preserving code/label/color_token/score/analytics_code/
  -- FLAGGED/IS_OTHER/position VERBATIM.
  insert into public.form_item_options (
    item_id, position, code, label, color_token, score, analytics_code, flagged, is_other
  )
  select m.new_id, o.position, o.code, o.label, o.color_token, o.score,
         o.analytics_code, o.flagged, o.is_other
  from public.form_item_options o
  join _clone_item_map m on m.old_id = o.item_id;

  drop table _clone_section_map;
  drop table _clone_item_map;

  return v_new_version_id;
end;
$$;
alter function public.clone_form_version(uuid) owner to postgres;

-- ============================================================================
-- SECTION 4 — save_section_answers: new p_other_text (item_id -> text). Writes
-- answers.other_text ONLY when the item's __other__ option is among the item's
-- submitted selections; forced NULL otherwise. Body otherwise byte-identical.
-- ============================================================================

create or replace function public.save_section_answers(
  p_response_id uuid,
  p_section_id uuid,
  p_answers jsonb default '{}'::jsonb,
  p_clear_item_ids uuid[] default null,
  p_observations jsonb default null,
  p_selections jsonb default null,
  p_other_text jsonb default null)
returns public.responses
language plpgsql
set search_path to 'public', 'pg_catalog'
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
alter function public.save_section_answers(uuid, uuid, jsonb, uuid[], jsonb, jsonb, jsonb) owner to postgres;
revoke all on function public.save_section_answers(uuid, uuid, jsonb, uuid[], jsonb, jsonb, jsonb) from public;
grant execute on function public.save_section_answers(uuid, uuid, jsonb, uuid[], jsonb, jsonb, jsonb)
  to authenticated, service_role;

-- Drop the OLD 6-arg signature (superseded by the 7-arg version).
drop function if exists public.save_section_answers(uuid, uuid, jsonb, uuid[], jsonb, jsonb);

-- ============================================================================
-- SECTION 5 — assert_item_bounds: extend with free_text/short_text length limits
-- (config.minLength / config.maxLength, char_length of the text answer). Body's
-- number/date arms preserved verbatim.
-- ============================================================================

create or replace function app.assert_item_bounds(
  p_response_id uuid,
  p_item_id uuid,
  p_item_type text,
  p_config jsonb,
  p_label text)
returns void
language plpgsql
set search_path to 'public', 'pg_catalog'
as $$
declare
  v_value jsonb;
  v_min jsonb;
  v_max jsonb;
  v_text text;
  v_len integer;
  v_min_len jsonb;
  v_max_len jsonb;
begin
  if p_config is null then
    return;
  end if;

  -- ---- free_text / short_text length bounds ----
  if p_item_type = any (array['free_text', 'short_text']) then
    v_min_len := p_config -> 'minLength';
    v_max_len := p_config -> 'maxLength';
    if v_min_len is null and v_max_len is null then
      return;
    end if;

    select a.value #>> '{}' into v_text
    from public.answers a
    where a.response_id = p_response_id and a.item_id = p_item_id;

    -- Only enforce when an answer is present (a blank non-required field is owned
    -- by the required check, not bounds).
    if v_text is null or btrim(v_text) = '' then
      return;
    end if;
    v_len := char_length(v_text);

    if v_min_len is not null and jsonb_typeof(v_min_len) = 'number'
       and v_len < (v_min_len)::text::integer then
      raise exception 'a pergunta "%" exige ao menos % caractere(s)',
        coalesce(p_label, '(sem rótulo)'), (v_min_len #>> '{}')
        using errcode = 'HC061';
    end if;
    if v_max_len is not null and jsonb_typeof(v_max_len) = 'number'
       and v_len > (v_max_len)::text::integer then
      raise exception 'a pergunta "%" aceita no máximo % caractere(s)',
        coalesce(p_label, '(sem rótulo)'), (v_max_len #>> '{}')
        using errcode = 'HC061';
    end if;
    return;
  end if;

  if p_item_type <> all (array['number','date']) then
    return;
  end if;

  select a.value into v_value
  from public.answers a
  where a.response_id = p_response_id and a.item_id = p_item_id;

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
