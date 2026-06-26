-- ----------------------------------------------------------------------------
-- Result-based phase recommendation — combinable recommend_when (ADR 0043)
-- ----------------------------------------------------------------------------
-- A template phase can already be AUTO-RECOMMENDED from an EARLIER phase's
-- ANSWER (a single recommend_when = {from_phase, question_key, op, value},
-- evaluated by recompute_recommendations via the shared app.eval_condition,
-- flipping the pending case-phase's `recommended` flag — a SUGGESTION, not a
-- gate). This migration lets a phase ALSO be recommended from an EARLIER
-- phase's RESULT (the phase_results option that landed in case_phases.result_id),
-- and makes recommend_when a COMBINABLE GROUP of answer/result conditions.
--
-- recommend_when becomes a SUPERSET (no data migration; legacy single rows +
-- existing snapshots remain valid):
--   * legacy single (answer): {from_phase, question_key, op, value}  — unchanged
--   * group: {match: 'all'|'any', conditions: [ Cond, … ]} (non-empty), where
--     Cond is one of:
--       - answer:           {source?:'answer', from_phase, question_key, op, value}
--       - result, specific: {source:'result', from_phase, op, value}   (value = a
--                           phase_results id, or ids for `in`)
--       - result, adverse:  {source:'result', from_phase, adverse: bool}
-- Answer-condition ops stay the CHOICE set equals|not_equals|in (NO ordered ops
-- for recommendations). Result values are option ids (uuids — stable across
-- renames/archival). Answer + result conditions may be mixed freely in one group.
--
-- ZERO evaluator drift (ARCHITECTURE Rule 3): app.eval_condition / evalCondition
-- and the shared vector fixtures are UNTOUCHED. recompute_recommendations walks
-- the group and, per condition, evaluates the UNCHANGED app.eval_condition over a
-- synthetic single-condition map:
--   * answer          → over the source phase's submitted answer map (as today);
--   * result-specific → {__phase_result__: <result_id text>} (key ABSENT when no
--                       result), op/value over the option id;
--   * result-adverse  → {__phase_result_adverse__: <is_adverse bool>} (absent when
--                       no result), `equals` against the requested flag.
-- Fold all→AND / any→OR. No-result semantics == answers: equals/in/adverse:true →
-- false; not_equals → true (the documented footgun); adverse:false → false until a
-- real non-adverse result exists. The TS mirror is evalRecommendation() in
-- src/lib/queries/conditions.ts.
--
-- New SQLSTATEs (HC0xx, ADR 0018; HC061/HC062 are taken by phase_result_manual_mode):
--   HC063 — a result-condition references a from_phase slot that does NOT emit a
--           result (emits_result = false).
--   HC064 — a result-condition references a phase_results id that is not in the
--           source slot's allowed_result_ids (or is archived / out-of-commission).
--
-- Forward-only / additive (house style: public.* objects OWNER postgres, this
-- file carries its OWN re-stated functions via CREATE OR REPLACE; the already-
-- applied migrations are NOT edited). Latest definitions extended here:
--   * CHECK process_template_phases_recommend_when_shape / case_phases_recommend_when_shape
--                                            (20260620005000_cases.sql)
--   * app.validate_template_recommend_when   (20260620005000_cases.sql)
--   * public.recompute_recommendations       (20260620005000_cases.sql)
--   * public.set_case_phase_result_override  (20260626000000_multitenancy_rls_rewrite.sql)
--   * public.create_case_from_template       (20260624150000_phase_result_manual_mode.sql)
-- The `case_phase_results` flag governs the editor's result-source option; the
-- backend TOLERATES result-conditions when the flag is off (they no-op, since
-- result_id stays null) — no hard rejection.
-- ----------------------------------------------------------------------------

set search_path = public, pg_catalog;

set check_function_bodies = false;
set client_min_messages = warning;

-- ===========================================================================
-- 1. Shape-validation helpers (IMMUTABLE, app schema) — mirror the
--    visible_when_shape superset approach in 20260623120000_form_builder_enhancements.sql.
-- ===========================================================================

-- ONE recommend_when condition's STRUCTURAL shape (the deep reference-checks live
-- in app.validate_template_recommend_when). A condition is one of:
--   answer (no source, or source='answer'): from_phase (number) + question_key
--     (string) + op in equals|not_equals|in + value (any).
--   result-specific (source='result', has op): from_phase (number) + op in
--     equals|not_equals|in + value (any).
--   result-adverse (source='result', has adverse): from_phase (number) + adverse
--     (boolean).
create or replace function app.is_valid_recommend_cond(p jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select
    p is not null
    and jsonb_typeof(p) = 'object'
    and (p ? 'from_phase')
    and jsonb_typeof(p -> 'from_phase') = 'number'
    and (
      case
        -- Result condition (source = 'result').
        when (p ->> 'source') = 'result' then
          case
            -- Result-adverse: an `adverse` boolean (no op/value).
            when (p ? 'adverse') then
              jsonb_typeof(p -> 'adverse') = 'boolean'
            -- Result-specific: op in the choice set + a value.
            else
              (p ? 'op')
              and (p ->> 'op') = any (array['equals','not_equals','in'])
              and (p ? 'value')
          end
        -- Answer condition (source absent or 'answer').
        when (not (p ? 'source')) or (p ->> 'source') = 'answer' then
          (p ? 'question_key')
          and jsonb_typeof(p -> 'question_key') = 'string'
          and (p ? 'op')
          and (p ->> 'op') = any (array['equals','not_equals','in'])
          and (p ? 'value')
        else false
      end
    );
$$;

alter function app.is_valid_recommend_cond(jsonb) owner to postgres;

-- A stored recommend_when rule: null, OR a legacy single (answer-only, the EXACT
-- predicate of the previous *_recommend_when_shape CHECK), OR an AND/OR group
-- {match: all|any, conditions: [<cond>, ...]} (non-empty). A strict SUPERSET of
-- the previous single-shape CHECK (mirrors app.is_valid_visibility).
create or replace function app.is_valid_recommend_when(p jsonb)
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
        where not app.is_valid_recommend_cond(c.value)
      )
    )
    or (
      -- legacy single (answer-only) shape — byte-for-byte the previous CHECK.
      not (p ? 'conditions')
      and jsonb_typeof(p) = 'object'
      and (p ? 'from_phase')
      and jsonb_typeof(p -> 'from_phase') = 'number'
      and (p ? 'question_key')
      and jsonb_typeof(p -> 'question_key') = 'string'
      and (p ? 'op')
      and (p ->> 'op') = any (array['equals','not_equals','in'])
      and (p ? 'value')
    );
$$;

alter function app.is_valid_recommend_when(jsonb) owner to postgres;

-- ===========================================================================
-- 2. Widen BOTH table CHECKs to the superset (drop-if-exists / add via DO blocks).
-- ===========================================================================

alter table public.process_template_phases
  drop constraint if exists "process_template_phases_recommend_when_shape";
alter table public.process_template_phases
  add constraint "process_template_phases_recommend_when_shape"
  check (app.is_valid_recommend_when(recommend_when));

alter table public.case_phases
  drop constraint if exists "case_phases_recommend_when_shape";
alter table public.case_phases
  add constraint "case_phases_recommend_when_shape"
  check (app.is_valid_recommend_when(recommend_when));

-- ===========================================================================
-- 3. app.recommend_when_conditions(rule) — normalize single|group into the flat
--    SET of its sub-conditions (mirror app.visibility_conditions). One row per
--    sub-condition: a group yields each element; a legacy single yields itself
--    (re-tagged source='answer'); null yields zero rows.
-- ===========================================================================
create or replace function app.recommend_when_conditions(p_rule jsonb)
returns setof jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select c.value
  from jsonb_array_elements(p_rule -> 'conditions') c
  where p_rule is not null and (p_rule ? 'conditions')
  union all
  select p_rule || jsonb_build_object('source', 'answer')
  where p_rule is not null and not (p_rule ? 'conditions');
$$;

alter function app.recommend_when_conditions(jsonb) owner to postgres;

-- ===========================================================================
-- 4. validate_template_recommend_when — now GROUP-aware. Normalize single|group
--    → flat conditions; per condition: from_phase earlier (< position) + exists;
--    answer → version_has_input_key (existing); result → source slot
--    emits_result = true (HC063) AND every referenced id ∈ that slot's
--    allowed_result_ids (HC064), non-archived + in-commission. Enforced at
--    add/update/publish (the callers are unchanged — they call THIS).
--    Signature, ownership, grants UNCHANGED (in-kind replace).
-- ===========================================================================
create or replace function app.validate_template_recommend_when(
  p_template_id uuid, p_position integer, p_recommend_when jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  rc jsonb;                -- one sub-condition
  v_commission_id uuid;
  v_from_phase integer;
  v_question_key text;
  v_source_form_id uuid;
  v_source_version uuid;
  v_source_emits boolean;
  v_source_allowed jsonb;
  v_is_result boolean;
  v_id uuid;
begin
  if p_recommend_when is null then
    return true;
  end if;

  -- Resolve the template's commission once (for result-option scope checks).
  select commission_id into v_commission_id
  from public.process_templates
  where id = p_template_id;

  for rc in select cond from app.recommend_when_conditions(p_recommend_when) cond loop
    v_from_phase := (rc ->> 'from_phase')::integer;
    v_is_result := (rc ->> 'source') = 'result';

    -- from_phase must reference an EARLIER slot (1-based positions).
    if v_from_phase is null or v_from_phase < 1 or v_from_phase >= p_position then
      raise exception
        'a recomendação da fase % deve referenciar uma fase anterior (fase informada: %)',
        p_position, coalesce(v_from_phase::text, 'nula')
        using errcode = 'HC016';
    end if;

    -- Resolve the source slot's form (+ result config for result-conditions).
    select form_id, emits_result, allowed_result_ids
      into v_source_form_id, v_source_emits, v_source_allowed
    from public.process_template_phases
    where template_id = p_template_id and position = v_from_phase;

    if v_source_form_id is null then
      raise exception
        'a recomendação da fase % referencia a fase %, que não existe no processo',
        p_position, v_from_phase
        using errcode = 'HC016';
    end if;

    if v_is_result then
      -- The source slot must EMIT a result for a result-condition to be meaningful.
      if not coalesce(v_source_emits, false) then
        raise exception
          'a recomendação da fase % usa o resultado da fase %, que não emite resultado',
          p_position, v_from_phase
          using errcode = 'HC063';
      end if;

      -- A result-ADVERSE condition needs no specific id; a result-SPECIFIC one
      -- must reference only ids in the source slot's allowed set, non-archived +
      -- in-commission.
      if not (rc ? 'adverse') then
        -- Collect the referenced id(s): scalar for equals/not_equals, array for in.
        -- Normalize to an array, then read each element as text → uuid.
        for v_id in
          select (e #>> '{}')::uuid
          from jsonb_array_elements(
                 case when jsonb_typeof(rc -> 'value') = 'array'
                      then rc -> 'value'
                      else jsonb_build_array(rc -> 'value') end
               ) e
        loop
          if v_id is null then
            raise exception
              'a recomendação da fase % referencia um resultado inválido', p_position
              using errcode = 'HC064';
          end if;
          -- Must be in the source slot's allowed subset.
          if v_source_allowed is null or not exists (
            select 1 from jsonb_array_elements_text(v_source_allowed) as a(id)
            where a.id::uuid = v_id
          ) then
            raise exception
              'a recomendação da fase % referencia um resultado que não está entre as opções permitidas da fase %',
              p_position, v_from_phase
              using errcode = 'HC064';
          end if;
          -- Must resolve to a non-archived option in the template's commission.
          if not exists (
            select 1 from public.phase_results
            where id = v_id and commission_id = v_commission_id and archived = false
          ) then
            raise exception
              'a recomendação da fase % referencia uma opção de resultado inválida ou arquivada',
              p_position
              using errcode = 'HC064';
          end if;
        end loop;
      end if;
    else
      -- Answer condition: the question_key must exist as an input item in the
      -- source slot's published version (existing semantics).
      v_question_key := rc ->> 'question_key';

      v_source_version := app.published_version_of_form(v_source_form_id);
      if v_source_version is null then
        raise exception
          'o formulário da fase % (origem da recomendação) ainda não foi publicado',
          v_from_phase
          using errcode = 'HC017';
      end if;

      if not app.version_has_input_key(v_source_version, v_question_key) then
        raise exception
          'a recomendação da fase % referencia a pergunta "%", que não existe no formulário da fase %',
          p_position, v_question_key, v_from_phase
          using errcode = 'HC016';
      end if;
    end if;
  end loop;

  return true;
end;
$$;

alter function app.validate_template_recommend_when(uuid, integer, jsonb) owner to postgres;

-- ===========================================================================
-- 5. recompute_recommendations — walk the group; per condition resolve the source
--    case-phase and evaluate via the UNCHANGED app.eval_condition over a synthetic
--    map (answer / result-specific / result-adverse); fold all→AND / any→OR.
--    Signature / ownership / grants UNCHANGED (in-kind replace).
-- ===========================================================================
create or replace function public.recompute_recommendations(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  r record;                -- one pending case-phase carrying a recommend_when
  rc jsonb;                -- one sub-condition
  v_match text;            -- 'all' | 'any' (single → 'all')
  v_should boolean;
  v_cond_result boolean;
  v_source_phase_id uuid;
  v_from_phase integer;
  v_is_result boolean;
  v_answers jsonb;
  v_result_id uuid;
  v_is_adverse boolean;
  v_synth_map jsonb;
  v_synth_cond jsonb;
begin
  perform set_config('app.in_case_rpc', 'on', true);

  for r in
    select id, position, recommend_when
    from public.case_phases
    where case_id = p_case_id
      and status = 'pendente'
      and recommend_when is not null
  loop
    -- The combinator: a group's `match`, or 'all' for a legacy single (which
    -- app.recommend_when_conditions normalizes to a single answer condition).
    v_match := case
                 when (r.recommend_when ? 'conditions')
                   then coalesce(r.recommend_when ->> 'match', 'all')
                 else 'all'
               end;

    -- Fold the conditions. Start neutral for the combinator: AND → true, OR → false.
    v_should := (v_match <> 'any');

    for rc in select cond from app.recommend_when_conditions(r.recommend_when) cond loop
      v_from_phase := (rc ->> 'from_phase')::integer;
      v_is_result := (rc ->> 'source') = 'result';

      -- Resolve from_phase (a case-phase position) to the source phase id.
      select id into v_source_phase_id
      from public.case_phases
      where case_id = p_case_id and position = v_from_phase;

      if v_is_result then
        -- Effective result of the source phase + its adverse flag (null → no
        -- result, treated as the answer-style missing-value semantics).
        v_result_id := null;
        v_is_adverse := null;
        if v_source_phase_id is not null then
          select cp.result_id, pr.is_adverse
            into v_result_id, v_is_adverse
          from public.case_phases cp
          left join public.phase_results pr on pr.id = cp.result_id
          where cp.id = v_source_phase_id;
        end if;

        if rc ? 'adverse' then
          -- Result-adverse: synthetic boolean map; key absent when no result.
          if v_is_adverse is null then
            v_synth_map := '{}'::jsonb;
          else
            v_synth_map := jsonb_build_object('__phase_result_adverse__', to_jsonb(v_is_adverse));
          end if;
          v_synth_cond := jsonb_build_object(
            'question_key', '__phase_result_adverse__',
            'op', 'equals',
            'value', (rc -> 'adverse')
          );
        else
          -- Result-specific: synthetic id (text) map; key absent when no result.
          if v_result_id is null then
            v_synth_map := '{}'::jsonb;
          else
            v_synth_map := jsonb_build_object('__phase_result__', to_jsonb(v_result_id::text));
          end if;
          v_synth_cond := jsonb_build_object(
            'question_key', '__phase_result__',
            'op', (rc ->> 'op'),
            'value', (rc -> 'value')
          );
        end if;

        v_cond_result := app.eval_condition(v_synth_cond, v_synth_map);
      else
        -- Answer condition: source's submitted answer map; strip from_phase/source
        -- → a plain visible_when the UNCHANGED evaluator accepts.
        if v_source_phase_id is null then
          v_answers := '{}'::jsonb;
        else
          v_answers := app.case_phase_answer_map(v_source_phase_id);
        end if;
        v_cond_result := app.eval_condition(
          (rc - 'from_phase' - 'source'), v_answers
        );
      end if;

      if v_match = 'any' then
        v_should := v_should or v_cond_result;
      else
        v_should := v_should and v_cond_result;
      end if;
    end loop;

    update public.case_phases
    set recommended = v_should, updated_at = now()
    where id = r.id
      and recommended is distinct from v_should;
  end loop;

  perform set_config('app.in_case_rpc', 'off', true);
end;
$$;

alter function public.recompute_recommendations(uuid) owner to postgres;

-- ===========================================================================
-- 6. set_case_phase_result_override — add a recompute_recommendations(case_id)
--    after a concluded-phase result change/clear (closes the staleness gap the
--    result-source feature introduces: a corrected/cleared earlier result must
--    re-flip downstream recommendations). The 'ativa' branch only STASHES the
--    override (effective result lands at conclude) → no recompute there.
--    Re-stated VERBATIM from 20260626000000_multitenancy_rls_rewrite.sql with the
--    single added recompute call.
-- ===========================================================================
create or replace function public.set_case_phase_result_override(
  p_case_phase_id uuid, p_result_id uuid, p_reason text default null::text
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_case_id uuid;
  v_commission_id uuid;
  v_phase_status text;
  v_case_status text;
  v_assigned_to uuid;
  v_position integer;
  v_is_staff_admin boolean;
  v_allowed jsonb;
  v_ruleset jsonb;
  v_emits boolean;
  v_is_manual boolean;
begin
  perform app.assert_phase_results_enabled();

  select cp.case_id, cp.status, cp.assigned_to, cp.position, c.commission_id, c.status,
         cp.allowed_result_ids, cp.result_ruleset, cp.emits_result
    into v_case_id, v_phase_status, v_assigned_to, v_position, v_commission_id, v_case_status,
         v_allowed, v_ruleset, v_emits
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_case_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;

  v_is_staff_admin := app.is_staff_admin_of(v_commission_id) or app.is_org_admin_of_commission(v_commission_id);
  v_is_manual := coalesce(v_emits, false) and v_ruleset is null;

  if v_phase_status not in ('ativa', 'concluida') then
    raise exception 'o resultado só pode ser ajustado em uma fase ativa ou concluída'
      using errcode = 'HC057';
  end if;

  if v_phase_status = 'ativa' then
    if not (v_assigned_to = auth.uid() or v_is_staff_admin) then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
  else
    if not v_is_staff_admin then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
    if v_case_status in ('concluido', 'cancelado') then
      raise exception 'este caso está em um estado final e não pode mais ser alterado'
        using errcode = 'HC060';
    end if;
  end if;

  -- MANUAL phase: the result is the filler's pick over the ALLOWED subset, so it
  -- is MANDATORY (cannot be cleared) and must be one of the allowed options. An
  -- AUTOMATIC phase's override is a staff adjustment with full flexibility (any
  -- active result, clearable → revert to the computed result).
  if v_is_manual then
    if p_result_id is null then
      raise exception 'o resultado desta fase é obrigatório e não pode ser removido'
        using errcode = 'HC062';
    end if;
    if v_allowed is not null and not exists (
      select 1 from jsonb_array_elements_text(v_allowed) as e(id)
      where e.id::uuid = p_result_id
    ) then
      raise exception 'o resultado escolhido não está entre as opções permitidas para esta fase'
        using errcode = 'HC058';
    end if;
  end if;

  -- A non-null result must resolve to a NON-ARCHIVED option in the commission.
  if p_result_id is not null and not exists (
    select 1 from public.phase_results
    where id = p_result_id and commission_id = v_commission_id and archived = false
  ) then
    raise exception 'opção de resultado inválida para esta comissão'
      using errcode = 'HC058';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set result_override_id = p_result_id,
      result_override_by = case when p_result_id is null then null else auth.uid() end,
      result_override_at = case when p_result_id is null then null else now() end,
      result_override_reason = case when p_result_id is null then null else nullif(btrim(p_reason), '') end,
      updated_at = now()
  where id = p_case_phase_id;
  perform set_config('app.in_case_rpc', 'off', true);

  perform app.audit_write(
    'case_phase.result_override_set', 'case_phase', p_case_phase_id, v_commission_id,
    'Resultado da fase ' || v_position || ' ajustado manualmente',
    jsonb_build_object('result_override_id', p_result_id));

  if v_phase_status = 'concluida' then
    perform app.compute_case_phase_result(p_case_phase_id);
    -- ADR 0043: the concluded phase's EFFECTIVE result just changed/cleared —
    -- re-flip downstream result-based recommendations against it.
    perform public.recompute_recommendations(v_case_id);
  end if;
end;
$$;

alter function public.set_case_phase_result_override(uuid, uuid, text) owner to postgres;

-- ===========================================================================
-- 7. create_case_from_template — re-stated VERBATIM from the LATEST definition
--    (20260624150000_phase_result_manual_mode.sql), changing ONLY the inline
--    single-shape recommend re-validation block (which hard-coded
--    from_phase/question_key) into a call to the now-group-aware
--    app.validate_template_recommend_when. Everything else preserved exactly:
--    result_ruleset snapshot, offered-results freeze, narratives, patient_enabled,
--    unique-violation retry, the app.in_case_rpc GUC dance, the trailing
--    recompute_recommendations.
-- ===========================================================================
create or replace function public.create_case_from_template(
  p_template_id uuid, p_label text default null::text
)
returns public.cases
language plpgsql
security definer
set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_commission_id uuid;
  v_status text;
  v_collects boolean;
  v_case public.cases;
  r_slot record;
  v_version uuid;
  v_attempt integer := 0;
  v_narratives_on boolean := app.feature_enabled('case_narratives');
begin
  perform app.assert_cases_enabled();

  select commission_id, status, collects_patient
    into v_commission_id, v_status, v_collects
  from public.process_templates where id = p_template_id;

  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if not app.is_staff_admin_of(v_commission_id) then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if v_status <> 'active' then
    raise exception 'apenas processos publicados podem iniciar casos'
      using errcode = 'check_violation';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases (commission_id, template_id, label, created_by, patient_enabled)
      values (v_commission_id, p_template_id, nullif(btrim(p_label), ''), auth.uid(), coalesce(v_collects, false))
      returning * into v_case;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then
          raise;
        end if;
    end;
  end loop;

  for r_slot in
    select position, form_id, title, recommend_when, default_due_days, blocks,
           display_position, result_ruleset, emits_result, allowed_result_ids
    from public.process_template_phases
    where template_id = p_template_id
    order by position
  loop
    v_version := app.published_version_of_form(r_slot.form_id);
    if v_version is null then
      raise exception
        'o formulário da fase % ainda não foi publicado', r_slot.position
        using errcode = 'HC017';
    end if;

    -- Re-validate the recommend_when at materialization time against the now-
    -- published source forms (group-aware; ADR 0043). Replaces the former inline
    -- single-shape from_phase/question_key check.
    if r_slot.recommend_when is not null then
      perform app.validate_template_recommend_when(
        p_template_id, r_slot.position, r_slot.recommend_when
      );
    end if;

    insert into public.case_phases
      (case_id, position, form_id, form_version_id, title, recommend_when,
       is_ad_hoc, default_due_days, blocks, display_position, result_ruleset,
       emits_result, allowed_result_ids)
    values
      (v_case.id, r_slot.position, r_slot.form_id, v_version, r_slot.title,
       r_slot.recommend_when, false, r_slot.default_due_days, r_slot.blocks,
       coalesce(r_slot.display_position, r_slot.position), r_slot.result_ruleset,
       r_slot.emits_result, r_slot.allowed_result_ids);
  end loop;

  insert into public.case_offered_outcomes (case_id, outcome_id)
  select v_case.id, pto.outcome_id
  from public.process_template_outcomes pto
  where pto.template_id = p_template_id;

  -- Freeze the OFFERED RESULT set: every reachable result option for this case —
  -- automatic ruleset result_ids + default_result_id, PLUS every phase's allowed
  -- subset. The computed-path guard reads THIS; the override path (manual / adjust)
  -- is validated against the allowed subset + live vocabulary at set-time.
  insert into public.case_phase_offered_results (case_id, result_id)
  select distinct v_case.id, ids.rid
  from public.process_template_phases ph
  cross join lateral (
    select (r ->> 'result_id')::uuid as rid
    from jsonb_array_elements(coalesce(ph.result_ruleset -> 'rules', '[]'::jsonb)) as r
    union
    select (ph.result_ruleset ->> 'default_result_id')::uuid
    union
    select (m #>> '{}')::uuid
    from jsonb_array_elements(coalesce(ph.allowed_result_ids, '[]'::jsonb)) as m
  ) ids
  where ph.template_id = p_template_id
    and ids.rid is not null
  on conflict do nothing;

  if v_narratives_on then
    insert into public.case_narratives
      (case_id, narrative_type_id, type_label, display_position, title,
       instructions, is_expected, created_by)
    select v_case.id, ptn.narrative_type_id,
           coalesce(nullif(btrim(ptn.title), ''), cnt.label),
           ptn.display_position, ptn.title, ptn.instructions, ptn.is_expected,
           auth.uid()
    from public.process_template_narratives ptn
    join public.case_narrative_types cnt on cnt.id = ptn.narrative_type_id
    where ptn.template_id = p_template_id;
  end if;

  perform set_config('app.in_case_rpc', 'off', true);

  perform public.recompute_recommendations(v_case.id);

  return v_case;
end;
$$;

alter function public.create_case_from_template(uuid, text) owner to postgres;
