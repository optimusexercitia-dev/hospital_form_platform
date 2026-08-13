-- ============================================================================
-- Flagged + aggregate result criteria (Architecture Rule 3 — rides the
-- synthetic-reserved-key precedent, NO evaluator edit).
--
-- Adds a per-option `flagged` flag + a self-referential `config.flaggedWhen`
-- condition for number/date/time items, then teaches
-- `app.compute_case_phase_result` to inject two RESERVED aggregate keys into the
-- answer map BEFORE the (byte-unchanged) rule-walk:
--   __total_score__   = Σ selected options' score (null -> 0)
--   __flagged_count__ = (Σ selected flagged options, per-option)
--                       + (Σ number/date/time items whose flaggedWhen is satisfied)
-- The unchanged app.eval_condition then handles `> 5` etc. over these numbers.
--
-- RESERVED NAMESPACE SAFETY: `__…__` keys can never collide with an author
-- question_key. question_keys are auto-generated only (never author-typed) via
-- slugifyLabel, which strips leading/trailing `_` (^_+|_+$ -> ''), so a real key
-- can never begin/end with `_`. Same protection __phase_result__
-- (RECOMMEND_RESULT_KEY) already relies on — no new guard needed.
--
-- EVALUATOR UNCHANGED: app.eval_condition / app.eval_visibility and the shared
-- condition/visibility vector fixtures are byte-for-byte untouched by this
-- migration. Gated behind the existing `case_phase_results` flag.
--
-- flaggedWhen NORMALIZATION INVARIANT (lead refinement): each item's flaggedWhen
-- is evaluated against the SAME normalized answer-map value the rest of the
-- evaluator sees (v_answers -> question_key), NOT a raw answers.value join — so a
-- number/date/time item's own flaggedWhen can never disagree with how a result
-- rule reading that same question_key sees the value. The flaggedWhen tally is
-- therefore INLINED in compute_case_phase_result over v_answers; only the
-- score/flagged-OPTION tally (which legitimately joins answer_selected_options)
-- lives in the helper.
--
-- ORDER: 1. column  2. clone + reconcile (persist/copy flagged)
--        3. flaggedWhen validator + publish validation  4. option-tally helper
--        5. compute_case_phase_result injection
-- ============================================================================

-- ============================================================================
-- SECTION 1 — form_item_options.flagged
-- ============================================================================

alter table public.form_item_options
  add column if not exists flagged boolean not null default false;

comment on column public.form_item_options.flagged is
  'Flagged-scoring (form-builder-enhancements): a selected flagged option contributes +1 to the phase''s __flagged_count__ aggregate (per-option, across multiple_choice/dropdown/checkbox). Cloned + frozen with the version, like score. NON-analytic to the evaluator (never a condition value directly).';

-- ============================================================================
-- SECTION 2 — persist + clone `flagged`.
-- ============================================================================

-- 2a. reconcile_item_options: thread `flagged` through the temp working set +
-- the UPDATE (kept rows) + the INSERT (new rows). Body otherwise byte-identical.
create or replace function public.reconcile_item_options(p_item_id uuid, p_options jsonb)
returns void
language plpgsql
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_dup text;
begin
  if p_options is null or jsonb_typeof(p_options) <> 'array' then
    raise exception 'lista de opções inválida' using errcode = 'check_violation';
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

  delete from public.form_item_options o
  where o.item_id = p_item_id
    and not exists (select 1 from _reconcile_opts r where r.code = o.code);

  update public.form_item_options o
  set label = r.label,
      color_token = r.color_token,
      score = r.score,
      analytics_code = r.analytics_code,
      flagged = r.flagged
  from _reconcile_opts r
  where o.item_id = p_item_id and o.code = r.code;

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

  update public.form_item_options o
  set position = r.position
  from _reconcile_opts r
  where o.item_id = p_item_id and o.code = r.code;

  drop table _reconcile_opts;
end;
$$;
alter function public.reconcile_item_options(uuid, jsonb) owner to postgres;

-- 2b. clone_form_version: copy `flagged` verbatim with the other option columns.
-- Re-created faithfully with the ONE change (config — which holds flaggedWhen —
-- already copies verbatim, so flaggedWhen survives clone with no change).
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

  -- Copy option rows into the remapped items, preserving code/label/color_token/
  -- score/analytics_code/FLAGGED/position VERBATIM.
  insert into public.form_item_options (
    item_id, position, code, label, color_token, score, analytics_code, flagged
  )
  select m.new_id, o.position, o.code, o.label, o.color_token, o.score,
         o.analytics_code, o.flagged
  from public.form_item_options o
  join _clone_item_map m on m.old_id = o.item_id;

  drop table _clone_section_map;
  drop table _clone_item_map;

  return v_new_version_id;
end;
$$;
alter function public.clone_form_version(uuid) owner to postgres;

-- ============================================================================
-- SECTION 3 — flaggedWhen shape validator + publish-time validation.
-- ============================================================================

-- app.is_valid_flagged_when(config, item_type): true when config has NO
-- flaggedWhen (absent = valid), OR flaggedWhen is a well-shaped single condition
-- for the item type: op in the ordered/equality set, value type matching the item
-- (number -> JSON number; date -> ISO YYYY-MM-DD; time -> HH:mm 24h). Mirrors the
-- min/max bound-shape discipline. STABLE, no DB access.
create or replace function app.is_valid_flagged_when(p_config jsonb, p_item_type text)
returns boolean
language sql
immutable
set search_path to 'app', 'public', 'pg_catalog'
as $$
  select case
    when p_config is null or not (p_config ? 'flaggedWhen') then true
    when p_item_type not in ('number', 'date', 'time') then false
    else (
      with fw as (select p_config -> 'flaggedWhen' as w)
      select
        jsonb_typeof((select w from fw)) = 'object'
        and ((select w from fw) ? 'op')
        and ((select w from fw) ? 'value')
        and ((select w ->> 'op' from fw)
              in ('gt', 'gte', 'lt', 'lte', 'equals', 'not_equals'))
        and case p_item_type
              when 'number' then
                jsonb_typeof((select w -> 'value' from fw)) = 'number'
              when 'date' then
                jsonb_typeof((select w -> 'value' from fw)) = 'string'
                and (select w ->> 'value' from fw) ~ '^\d{4}-\d{2}-\d{2}$'
              when 'time' then
                jsonb_typeof((select w -> 'value' from fw)) = 'string'
                and (select w ->> 'value' from fw) ~ '^([01]\d|2[0-3]):[0-5]\d$'
            end
    )
  end;
$$;
alter function app.is_valid_flagged_when(jsonb, text) owner to postgres;
revoke all on function app.is_valid_flagged_when(jsonb, text) from public;
grant execute on function app.is_valid_flagged_when(jsonb, text) to authenticated, service_role;
comment on function app.is_valid_flagged_when(jsonb, text) is
  'Publish-time shape check for form_items.config.flaggedWhen (form-builder-enhancements). Valid when absent, or a single {op,value} whose op is ordered/equality and whose value type matches the item type (number/date/time only). Mirrors the min/max bound checks.';

-- Re-create publish_form_version (current 5-arg signature) adding a flaggedWhen
-- validation block. Body otherwise IDENTICAL to 20260713000300.
create or replace function public.publish_form_version(
  p_form_version_id uuid,
  p_approved_by uuid default null,
  p_effective_date date default null,
  p_review_cycle_months integer default null,
  p_review_due_date date default null)
  returns public.form_versions
  language plpgsql
  set search_path to 'public', 'pg_catalog'
as $$
declare
  v_form_id uuid;
  v_status text;
  v_result public.form_versions;
  v_bad_item text;
  v_bad_default text;
  v_bad_flagged text;
  v_review_due date;
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

  select coalesce(i.label, i.question_key) into v_bad_default
  from public.form_items i
  where i.form_version_id = p_form_version_id
    and i.default_value is not null
    and (
      case
        when i.item_type in ('multiple_choice','dropdown') then
          jsonb_typeof(i.default_value) <> 'string'
          or not app.version_has_option_code(
               p_form_version_id, i.question_key, i.default_value #>> '{}')
        when i.item_type = 'checkbox' then
          jsonb_typeof(i.default_value) <> 'array'
          or exists (
            select 1
            from jsonb_array_elements(i.default_value) c
            where jsonb_typeof(c) <> 'string'
               or not app.version_has_option_code(
                    p_form_version_id, i.question_key, c #>> '{}')
          )
        when i.item_type = 'number' then
          jsonb_typeof(i.default_value) <> 'number'
        when i.item_type in ('date','time','short_text','free_text') then
          jsonb_typeof(i.default_value) <> 'string'
        else true
      end
    )
  limit 1;

  if v_bad_default is not null then
    raise exception 'o valor padrão da pergunta "%" é inválido', v_bad_default
      using errcode = 'HC080';
  end if;

  -- flagged-scoring (form-builder-enhancements): every item carrying a
  -- config.flaggedWhen must be a well-shaped single condition for its type.
  select coalesce(i.label, i.question_key) into v_bad_flagged
  from public.form_items i
  where i.form_version_id = p_form_version_id
    and i.config is not null
    and (i.config ? 'flaggedWhen')
    and not app.is_valid_flagged_when(i.config, i.item_type)
  limit 1;

  if v_bad_flagged is not null then
    raise exception
      'a condição "marcado se" da pergunta "%" é inválida', v_bad_flagged
      using errcode = 'HC046';
  end if;

  v_review_due := coalesce(
    p_review_due_date,
    case when p_review_cycle_months is not null
         then (coalesce(p_effective_date, current_date) + make_interval(months => p_review_cycle_months))::date
         else null end);

  perform set_config('app.in_publish_rpc', 'on', true);

  update public.form_versions
  set status = 'archived'
  where form_id = v_form_id
    and status = 'published';

  update public.form_versions
  set status = 'published',
      published_at = now(),
      approved_by = p_approved_by,
      approved_at = case when p_approved_by is not null then now() else null end,
      effective_date = p_effective_date,
      review_due_date = v_review_due
  where id = p_form_version_id
  returning * into v_result;

  perform set_config('app.in_publish_rpc', 'off', true);

  return v_result;
end;
$$;
alter function public.publish_form_version(uuid, uuid, date, integer, date) owner to postgres;
revoke all on function public.publish_form_version(uuid, uuid, date, integer, date) from public;
grant execute on function public.publish_form_version(uuid, uuid, date, integer, date)
  to authenticated, service_role;

-- ============================================================================
-- SECTION 4 — score + flagged-OPTION tally helper.
-- ============================================================================

-- app.case_phase_option_aggregates(p_case_phase_id) -> (total_score, flagged_options):
-- the two aggregates that come from the SUBMITTED response's SELECTED options
-- (joining answer_selected_options -> form_item_options). Same `resp` scoping as
-- case_phase_answer_map (in-progress -> nothing). The flaggedWhen tally is NOT here
-- (it needs the normalized v_answers map — inlined in compute).
create or replace function app.case_phase_option_aggregates(p_case_phase_id uuid)
returns table (total_score numeric, flagged_options integer)
language sql
stable security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
  with resp as (
    select r.id
    from public.responses r
    where r.case_phase_id = p_case_phase_id
      and r.status = 'submitted'
  ),
  sel as (
    select o.score, o.flagged
    from public.answer_selected_options s
    join public.answers a on a.id = s.answer_id
    join resp on resp.id = a.response_id
    join public.form_items i on i.id = a.item_id
    join public.form_item_options o on o.id = s.option_id
    where i.item_type = any (array['multiple_choice','dropdown','checkbox'])
  )
  select
    coalesce(sum(coalesce(score, 0)), 0)::numeric as total_score,
    coalesce(count(*) filter (where flagged), 0)::int as flagged_options
  from sel;
$$;
alter function app.case_phase_option_aggregates(uuid) owner to postgres;
revoke all on function app.case_phase_option_aggregates(uuid) from public;
grant execute on function app.case_phase_option_aggregates(uuid) to authenticated, service_role;
comment on function app.case_phase_option_aggregates(uuid) is
  'flagged-scoring: the SELECTED-OPTION half of the phase aggregates — Σ option.score (null->0) as total_score, count of selected flagged options as flagged_options. Scoped to the phase''s SUBMITTED response (same as case_phase_answer_map). The flaggedWhen (number/date/time) half is inlined in compute_case_phase_result over the normalized answer map.';

-- ============================================================================
-- SECTION 5 — compute_case_phase_result: inject the two reserved aggregate keys
-- into the normalized answer map before the (byte-unchanged) rule-walk.
-- ============================================================================

create or replace function app.compute_case_phase_result(p_case_phase_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case_id uuid;
  v_ruleset jsonb;
  v_override_id uuid;
  v_emits boolean;
  v_position integer;
  v_is_manual boolean;
  v_answers jsonb;
  r_rule jsonb;
  v_chosen uuid;
  v_total_score numeric;
  v_flagged_options integer;
  v_flagged_conditions integer;
  v_flagged_count integer;
begin
  if not app.feature_enabled('case_phase_results') then
    return;
  end if;

  select case_id, result_ruleset, result_override_id, emits_result, position
    into v_case_id, v_ruleset, v_override_id, v_emits, v_position
  from public.case_phases where id = p_case_phase_id;

  if v_case_id is null then
    return;
  end if;

  v_is_manual := coalesce(v_emits, false) and v_ruleset is null;
  if v_is_manual and v_override_id is null then
    raise exception
      'selecione o resultado da fase % antes de enviar', v_position
      using errcode = 'HC061';
  end if;

  if v_override_id is not null then
    perform set_config('app.in_case_rpc', 'on', true);
    update public.case_phases
    set result_id = v_override_id,
        result_source = 'manual',
        result_computed_at = now(),
        updated_at = now()
    where id = p_case_phase_id;
    perform set_config('app.in_case_rpc', 'off', true);
    return;
  end if;

  if v_ruleset is null then
    perform set_config('app.in_case_rpc', 'on', true);
    update public.case_phases
    set result_id = null, result_source = null, result_computed_at = null,
        updated_at = now()
    where id = p_case_phase_id
      and (result_id is not null or result_source is not null);
    perform set_config('app.in_case_rpc', 'off', true);
    return;
  end if;

  v_answers := app.case_phase_answer_map(p_case_phase_id);

  -- Compute the two reserved aggregates and INJECT them into the normalized answer
  -- map (rides the synthetic-reserved-key precedent — the evaluator is UNCHANGED).
  --   __total_score__   = Σ selected options' score (null -> 0)
  --   __flagged_count__ = (Σ selected flagged options) + (Σ number/date/time items
  --                        whose flaggedWhen holds against their OWN normalized value)
  select total_score, flagged_options
    into v_total_score, v_flagged_options
  from app.case_phase_option_aggregates(p_case_phase_id);

  -- flaggedWhen half — evaluate each number/date/time item's condition against the
  -- SAME normalized answer-map value (v_answers -> question_key) the rest of the
  -- evaluator sees (lead refinement: identical value representation, no drift). A
  -- missing/null answer -> eval_condition returns false -> not counted.
  select coalesce(count(*) filter (where
           app.eval_condition(
             jsonb_build_object(
               'question_key', i.question_key,
               'op', i.config -> 'flaggedWhen' ->> 'op',
               'value', i.config -> 'flaggedWhen' -> 'value'
             ),
             jsonb_build_object(i.question_key, v_answers -> i.question_key)
           )
         ), 0)::int
    into v_flagged_conditions
  from public.case_phases cp
  join public.form_items i on i.form_version_id = cp.form_version_id
  where cp.id = p_case_phase_id
    and i.item_type = any (array['number','date','time'])
    and i.config is not null
    and (i.config ? 'flaggedWhen');

  v_flagged_count := coalesce(v_flagged_options, 0) + coalesce(v_flagged_conditions, 0);

  v_answers := v_answers
    || jsonb_build_object('__total_score__', to_jsonb(coalesce(v_total_score, 0)))
    || jsonb_build_object('__flagged_count__', to_jsonb(v_flagged_count));

  v_chosen := null;
  for r_rule in select * from jsonb_array_elements(v_ruleset -> 'rules')
  loop
    if app.eval_condition(r_rule -> 'when', v_answers) then
      v_chosen := (r_rule ->> 'result_id')::uuid;
      exit;
    end if;
  end loop;

  if v_chosen is null then
    v_chosen := (v_ruleset ->> 'default_result_id')::uuid;
  end if;

  if v_chosen is not null and not exists (
    select 1 from public.case_phase_offered_results
    where case_id = v_case_id and result_id = v_chosen
  ) then
    v_chosen := null;
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  if v_chosen is null then
    update public.case_phases
    set result_id = null, result_source = null, result_computed_at = null,
        updated_at = now()
    where id = p_case_phase_id
      and (result_id is not null or result_source is not null);
  else
    update public.case_phases
    set result_id = v_chosen,
        result_source = 'computed',
        result_computed_at = now(),
        updated_at = now()
    where id = p_case_phase_id;
  end if;
  perform set_config('app.in_case_rpc', 'off', true);
end;
$$;
alter function app.compute_case_phase_result(uuid) owner to postgres;
