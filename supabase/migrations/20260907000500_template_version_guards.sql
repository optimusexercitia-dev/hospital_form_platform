-- ADR 0096 — Process-template versioning · M5: guards, validators, audit.
--
-- Re-keys every function that resolves a template child by `template_id`. All
-- bodies below were taken from `pg_proc` on the live catalog, NOT from migration
-- files — several migrations on this branch rewrite function bodies at runtime
-- via pg_get_functiondef() + replace() + execute, so the file text is stale by
-- design (CLAUDE.md, ADR 0078 A28).
--
-- DROP + CREATE, not CREATE OR REPLACE, wherever a parameter name changes.
-- Postgres refuses to rename an input parameter through CREATE OR REPLACE, and
-- that refusal is doing us a favour: a function still declaring `p_template_id`
-- while receiving a version id is precisely the name-that-lies-about-its-content
-- failure this phase exists to eliminate. The same reasoning drove the TS-side
-- rename of templateId -> templateVersionId (ADR 0096 Amendment A1.1 item 6).
--
-- ADR 0096 Amendment A1.4: three of these were MISSING from the ADR's re-key
-- list — guard_template_phase_ruleset_content, trg_audit_template_narratives,
-- and all five validate_template_*.

-- ---------------------------------------------------------------------------
-- 1. Phase-grain commission resolver — now two hops instead of one.
-- ---------------------------------------------------------------------------

create or replace function app.commission_of_template_phase(p_phase_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select t.commission_id
  from public.process_template_phases ph
  join public.process_template_versions v on v.id = ph.template_version_id
  join public.process_templates t on t.id = v.template_id
  where ph.id = p_phase_id;
$$;

-- ---------------------------------------------------------------------------
-- 2. Coherence guards. Each previously read
--    `select commission_id from process_templates where id = new.template_id`;
--    all three now resolve through the version.
-- ---------------------------------------------------------------------------

create or replace function app.guard_template_phase_form_coherent()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_template_commission uuid;
  v_form_commission uuid;
begin
  v_template_commission := app.commission_of_template_version(new.template_version_id);

  select commission_id into v_form_commission
  from public.forms where id = new.form_id;

  if v_template_commission is null
     or v_form_commission is distinct from v_template_commission then
    raise exception 'este formulário não pertence à comissão deste processo'
      using errcode = 'HC030';
  end if;

  return new;
end;
$$;

create or replace function app.guard_template_narrative_type()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_template_commission uuid;
  v_type_commission uuid;
begin
  v_template_commission := app.commission_of_template_version(new.template_version_id);

  select commission_id into v_type_commission
  from public.case_narrative_types where id = new.narrative_type_id;

  if v_template_commission is null or v_type_commission is null
     or v_template_commission <> v_type_commission then
    raise exception 'este tipo de narrativa não pertence à comissão deste processo'
      using errcode = 'HC054';
  end if;

  return new;
end;
$$;

create or replace function app.guard_process_template_outcome()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_template_commission uuid;
  v_outcome_commission uuid;
begin
  v_template_commission := app.commission_of_template_version(new.template_version_id);

  select commission_id into v_outcome_commission
  from public.case_outcomes where id = new.outcome_id;

  if v_template_commission is null or v_outcome_commission is null
     or v_template_commission <> v_outcome_commission then
    raise exception 'este desfecho não pertence à comissão deste processo'
      using errcode = 'HC030';
  end if;

  return new;
end;
$$;

create or replace function app.guard_template_phase_ruleset_content()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if new.result_ruleset is null then
    return null;
  end if;

  if tg_op = 'INSERT' or new.result_ruleset is distinct from old.result_ruleset then
    perform app.validate_template_result_ruleset(
      new.template_version_id, new.position, new.result_ruleset
    );
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. guard_process_template_case_type — this one CHANGES TABLE, not just column.
--
-- D1 moves case_type_id onto the version, so the guard has to move with it. The
-- body cannot simply be re-keyed: it read `new.commission_id`, and
-- process_template_versions has no such column. It must resolve the commission
-- through the identity instead. ADR 0096 Amendment A1.4.
-- ---------------------------------------------------------------------------

create or replace function app.guard_process_template_case_type()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
begin
  if new.case_type_id is null then
    return new;
  end if;

  v_commission_id := app.commission_of_template(new.template_id);

  if not exists (
    select 1
    from public.case_types ct
    where ct.id = new.case_type_id
      and ct.organization_id = app.org_of_commission(v_commission_id)
  ) then
    raise exception 'este tipo de caso não pertence à organização desta comissão'
      using errcode = 'HC0F7';
  end if;

  return new;
end;
$$;

drop trigger trg_process_template_case_type on public.process_templates;

create trigger trg_process_template_case_type
  before insert or update of case_type_id, template_id
  on public.process_template_versions
  for each row execute function app.guard_process_template_case_type();

-- ---------------------------------------------------------------------------
-- 4. Audit. The narrative trigger resolved its commission from the template id.
-- ---------------------------------------------------------------------------

create or replace function app.trg_audit_template_narratives()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_cols constant text[] := array['display_position', 'narrative_type_id', 'is_expected'];
  v_id uuid;
  v_version uuid;
  v_action text;
  v_meta jsonb;
begin
  if tg_op = 'DELETE' then
    v_version := old.template_version_id; v_id := old.id;
    v_action := 'case_template_narrative.deleted';
    v_meta := app.audit_diff(to_jsonb(old), null, v_cols);
  elsif tg_op = 'INSERT' then
    v_version := new.template_version_id; v_id := new.id;
    v_action := 'case_template_narrative.created';
    v_meta := app.audit_diff(null, to_jsonb(new), v_cols);
  else
    v_version := new.template_version_id; v_id := new.id;
    v_action := 'case_template_narrative.updated';
    v_meta := app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols);
  end if;
  perform app.audit_write(v_action, 'case_template_narrative', v_id,
    app.commission_of_template_version(v_version), 'Narrativa do processo ' || tg_op, v_meta);
  return null;
end;
$$;

-- Architecture Rule 11: every mutation emits an audit row. The new versions
-- table is governance data (who published which definition, and when), so it
-- needs its own trigger.
--
-- Deliberately created HERE and not in M1, where the table was defined: the M3
-- backfill INSERTs one version per existing template, and those rows are a
-- schema migration, not a user action. Auditing them would have attributed
-- every historical template to a null actor at migration time. By the time this
-- trigger exists, the backfill has already run.
create or replace function app.trg_audit_template_versions()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_cols constant text[] := array[
    'status', 'version_number', 'title', 'description',
    'collects_patient', 'case_type_id'
  ];
  v_id uuid;
  v_template uuid;
  v_action text;
  v_meta jsonb;
begin
  if tg_op = 'DELETE' then
    v_template := old.template_id; v_id := old.id;
    v_action := 'process_template_version.deleted';
    v_meta := app.audit_diff(to_jsonb(old), null, v_cols);
  elsif tg_op = 'INSERT' then
    v_template := new.template_id; v_id := new.id;
    v_action := 'process_template_version.created';
    v_meta := app.audit_diff(null, to_jsonb(new), v_cols);
  else
    v_template := new.template_id; v_id := new.id;
    v_action := 'process_template_version.updated';
    v_meta := app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols);
  end if;
  perform app.audit_write(v_action, 'process_template_version', v_id,
    app.commission_of_template(v_template), 'Versão do processo ' || tg_op, v_meta);
  return null;
end;
$$;

create trigger audit_template_versions_trg
  after insert or delete or update on public.process_template_versions
  for each row execute function app.trg_audit_template_versions();

-- ---------------------------------------------------------------------------
-- 5. Validators. DROP + CREATE because every one of them renames p_template_id.
--
-- Note the commission derivations below keep their JOIN form rather than calling
-- app.commission_of_template_version directly. That is deliberate: the join
-- returns NULL when the PHASE does not exist, which is what produces the
-- "fase % não encontrada" error. Resolving the commission from the version id
-- alone would always succeed and silently lose that check.
-- ---------------------------------------------------------------------------

drop function app.validate_template_allowed_results(uuid, integer, jsonb);

create function app.validate_template_allowed_results(
  p_template_version_id uuid, p_position integer, p_allowed_result_ids jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_id uuid;
  r_el jsonb;
begin
  if p_allowed_result_ids is null then
    return true;
  end if;

  select t.commission_id into v_commission_id
  from public.process_template_phases ph
  join public.process_template_versions v on v.id = ph.template_version_id
  join public.process_templates t on t.id = v.template_id
  where ph.template_version_id = p_template_version_id and ph.position = p_position;

  if v_commission_id is null then
    raise exception 'fase % não encontrada no processo', p_position
      using errcode = 'no_data_found';
  end if;

  for r_el in select * from jsonb_array_elements(p_allowed_result_ids)
  loop
    v_id := (r_el #>> '{}')::uuid;
    if v_id is null or not exists (
      select 1 from public.phase_results
      where id = v_id and commission_id = v_commission_id and archived = false
    ) then
      raise exception
        'os resultados permitidos da fase % referenciam uma opção inválida ou arquivada', p_position
        using errcode = 'HC059';
    end if;
  end loop;

  return true;
end;
$$;

drop function app.validate_template_phase_blocks(uuid, integer, integer[]);

create function app.validate_template_phase_blocks(
  p_template_version_id uuid, p_position integer, p_blocks integer[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_missing integer;
begin
  if p_blocks is null or cardinality(p_blocks) = 0 then
    return true;
  end if;

  -- Earlier-only (defensive; the column trigger also enforces it).
  select b into v_missing
  from unnest(p_blocks) as b
  where b < 1 or b >= p_position
  limit 1;
  if found then
    raise exception
      'um bloqueio da fase % deve referenciar uma fase anterior (fase informada: %)',
      p_position, v_missing
      using errcode = 'HC016';
  end if;

  -- Every referenced position must exist as a slot in THIS VERSION.
  select b into v_missing
  from unnest(p_blocks) as b
  where not exists (
    select 1 from public.process_template_phases
    where template_version_id = p_template_version_id and position = b
  )
  limit 1;
  if found then
    raise exception
      'um bloqueio da fase % referencia a fase %, que não existe no processo',
      p_position, v_missing
      using errcode = 'HC016';
  end if;

  return true;
end;
$$;

drop function app.validate_template_result_ruleset(uuid, integer, jsonb);

create function app.validate_template_result_ruleset(
  p_template_version_id uuid, p_position integer, p_result_ruleset jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_commission_id uuid;
  v_form_id uuid;
  v_version uuid;
  r_rule jsonb;
  v_qkey text;
  v_result_id uuid;
  v_default_id uuid;
  v_target_type text;
begin
  if p_result_ruleset is null then
    return true;
  end if;

  select t.commission_id, ph.form_id
    into v_commission_id, v_form_id
  from public.process_template_phases ph
  join public.process_template_versions tv on tv.id = ph.template_version_id
  join public.process_templates t on t.id = tv.template_id
  where ph.template_version_id = p_template_version_id and ph.position = p_position;

  if v_form_id is null then
    raise exception 'fase % não encontrada no processo', p_position
      using errcode = 'no_data_found';
  end if;

  v_version := app.published_version_of_form(v_form_id);
  if v_version is null then
    raise exception 'o formulário da fase % ainda não foi publicado', p_position
      using errcode = 'HC017';
  end if;

  for r_rule in select * from jsonb_array_elements(p_result_ruleset -> 'rules')
  loop
    v_qkey := r_rule -> 'when' ->> 'question_key';

    -- FBE-006: the reserved AGGREGATE synthetic keys are valid rule targets that do
    -- NOT correspond to an input item (they are injected at compute time). Bypass
    -- the input-key existence check AND the option-code assertion for them; still
    -- validate the rule's result_id below.
    if v_qkey in ('__total_score__', '__flagged_count__') then
      v_result_id := (r_rule ->> 'result_id')::uuid;
      if v_result_id is null or not exists (
        select 1 from public.phase_results
        where id = v_result_id and commission_id = v_commission_id and archived = false
      ) then
        raise exception
          'o resultado da fase % referencia uma opção de resultado inválida ou arquivada',
          p_position
          using errcode = 'HC059';
      end if;
      continue;
    end if;

    if v_qkey is null or not app.version_has_input_key(v_version, v_qkey) then
      raise exception
        'o resultado da fase % referencia a pergunta "%", que não existe no formulário publicado',
        p_position, coalesce(v_qkey, 'nula')
        using errcode = 'HC016';
    end if;

    -- form-model-normalization: the when value(s) are option CODES; assert they
    -- exist on the choice question (no-op for non-choice targets).
    v_target_type := app.item_question_type(v_version, v_qkey);
    perform app.assert_condition_value_codes(
      v_version, v_qkey, v_target_type, r_rule -> 'when' -> 'value',
      format('o resultado da fase %s', p_position), r_rule -> 'when' ->> 'op'
    );

    v_result_id := (r_rule ->> 'result_id')::uuid;
    if v_result_id is null or not exists (
      select 1 from public.phase_results
      where id = v_result_id and commission_id = v_commission_id and archived = false
    ) then
      raise exception
        'o resultado da fase % referencia uma opção de resultado inválida ou arquivada',
        p_position
        using errcode = 'HC059';
    end if;
  end loop;

  v_default_id := (p_result_ruleset ->> 'default_result_id')::uuid;
  if v_default_id is not null and not exists (
    select 1 from public.phase_results
    where id = v_default_id and commission_id = v_commission_id and archived = false
  ) then
    raise exception
      'o resultado padrão da fase % é uma opção inválida ou arquivada', p_position
      using errcode = 'HC059';
  end if;

  return true;
end;
$$;

drop function app.validate_template_phase_result(uuid, integer);

create function app.validate_template_phase_result(
  p_template_version_id uuid, p_position integer
)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  v_phase_id uuid;
  v_emits boolean;
  v_ruleset jsonb;
  v_allowed jsonb;
begin
  select id, emits_result, result_ruleset
    into v_phase_id, v_emits, v_ruleset
  from public.process_template_phases
  where template_version_id = p_template_version_id and position = p_position;

  -- D3: reconstruct the allowed subset (ordered) from the junction for re-validation.
  select case when count(*) = 0 then null
              else jsonb_agg((result_id)::text order by position) end
    into v_allowed
  from public.process_template_phase_allowed_results
  where template_phase_id = v_phase_id;

  if v_emits and v_allowed is null then
    raise exception
      'a fase % emite um resultado, mas nenhum resultado permitido foi selecionado', p_position
      using errcode = 'HC059';
  end if;

  perform app.validate_template_result_ruleset(p_template_version_id, p_position, v_ruleset);
  perform app.validate_template_allowed_results(p_template_version_id, p_position, v_allowed);
  return true;
end;
$$;

drop function app.validate_template_recommend_when(uuid, integer, jsonb);

create function app.validate_template_recommend_when(
  p_template_version_id uuid, p_position integer, p_recommend_when jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
declare
  rc jsonb;                -- one sub-condition
  v_commission_id uuid;
  v_from_phase integer;
  v_question_key text;
  v_source_phase_id uuid;
  v_source_form_id uuid;
  v_source_version uuid;
  v_source_emits boolean;
  v_is_result boolean;
  v_id uuid;
  v_target_type text;
begin
  if p_recommend_when is null then
    return true;
  end if;

  v_commission_id := app.commission_of_template_version(p_template_version_id);

  for rc in select cond from app.recommend_when_conditions(p_recommend_when) cond loop
    v_from_phase := (rc ->> 'from_phase')::integer;
    v_is_result := (rc ->> 'source') = 'result';

    if v_from_phase is null or v_from_phase < 1 or v_from_phase >= p_position then
      raise exception
        'a recomendação da fase % deve referenciar uma fase anterior (fase informada: %)',
        p_position, coalesce(v_from_phase::text, 'nula')
        using errcode = 'HC016';
    end if;

    select id, form_id, emits_result
      into v_source_phase_id, v_source_form_id, v_source_emits
    from public.process_template_phases
    where template_version_id = p_template_version_id and position = v_from_phase;

    if v_source_form_id is null then
      raise exception
        'a recomendação da fase % referencia a fase %, que não existe no processo',
        p_position, v_from_phase
        using errcode = 'HC016';
    end if;

    if v_is_result then
      if not coalesce(v_source_emits, false) then
        raise exception
          'a recomendação da fase % usa o resultado da fase %, que não emite resultado',
          p_position, v_from_phase
          using errcode = 'HC063';
      end if;

      if not (rc ? 'adverse') then
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
          -- D3: the source phase's allowed subset is now in the junction.
          if not exists (
            select 1 from public.process_template_phase_allowed_results
            where template_phase_id = v_source_phase_id and result_id = v_id
          ) then
            raise exception
              'a recomendação da fase % referencia um resultado que não está entre as opções permitidas da fase %',
              p_position, v_from_phase
              using errcode = 'HC064';
          end if;
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
      -- Answer condition: question_key must exist as an input item; and the value
      -- codes must exist on it when it is a choice question.
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

      v_target_type := app.item_question_type(v_source_version, v_question_key);
      perform app.assert_condition_value_codes(
        v_source_version, v_question_key, v_target_type, rc -> 'value',
        format('a recomendação da fase %s', p_position), rc ->> 'op'
      );
    end if;
  end loop;

  return true;
end;
$$;
