-- Phase result MODES: none / automatic / manual, over a shared ALLOWED-results set.
--
-- Until now a phase either emitted NO result (result_ruleset IS NULL) or an
-- AUTOMATIC one (result_ruleset = {rules, default_result_id}). This adds a third
-- mode — MANUAL: the phase emits a result the person filling the form CHOOSES at
-- the end of the wizard (mandatory before submit) — and makes the author-selected
-- ALLOWED result subset a first-class, ALWAYS-persisted concept for BOTH modes.
--
-- Encoding (process_template_phases, snapshotted onto case_phases):
--   - emits_result = false                                  → NONE
--   - emits_result = true  + result_ruleset IS NOT NULL     → AUTOMATIC (rules pick a
--                                                             result; rules may only
--                                                             reference allowed_result_ids)
--   - emits_result = true  + result_ruleset IS NULL         → MANUAL (the filler picks
--                                                             from allowed_result_ids)
--   allowed_result_ids is a NON-EMPTY jsonb array of phase_results uuids, present
--   whenever the phase emits a result (BOTH modes). An emitting phase with no
--   allowed set yet is a legal DRAFT state, blocked at publish by
--   app.validate_template_phase_result.
--
-- Manual selection reuses the existing pre-submit OVERRIDE plumbing: the filler's
-- choice is stashed as result_override_id on the still-`ativa` phase
-- (set_case_phase_result_override 'ativa'), and the conclude trigger honors it. The
-- mandatory-selection rule is enforced server-side in compute_case_phase_result
-- (manual phase + no override at conclude → raise), so a bypassed client cannot
-- submit a manual phase with no result.

-- ===========================================================================
-- 1. Template + case columns + CHECKs.
-- ===========================================================================
ALTER TABLE "public"."process_template_phases"
  ADD COLUMN IF NOT EXISTS "emits_result" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "allowed_result_ids" "jsonb";

ALTER TABLE "public"."case_phases"
  ADD COLUMN IF NOT EXISTS "emits_result" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "allowed_result_ids" "jsonb";

-- Back-fill: every phase that already carries an automatic ruleset emits a result;
-- seed its allowed set from the result options the ruleset can produce.
UPDATE "public"."process_template_phases"
  SET "emits_result" = true
  WHERE "result_ruleset" IS NOT NULL AND "emits_result" = false;
UPDATE "public"."process_template_phases" ph
  SET "allowed_result_ids" = sub.ids
  FROM (
    select p.id,
           jsonb_agg(distinct rid) as ids
    from public.process_template_phases p
    cross join lateral (
      select (r ->> 'result_id') as rid
      from jsonb_array_elements(coalesce(p.result_ruleset -> 'rules', '[]'::jsonb)) as r
      union
      select (p.result_ruleset ->> 'default_result_id')
    ) x(rid)
    where p.result_ruleset is not null and rid is not null
    group by p.id
  ) sub
  WHERE ph.id = sub.id AND ph.allowed_result_ids IS NULL;

-- case_phases is guarded (guard_case_phase_status): direct writes must ride the
-- app.in_case_rpc flag, so wrap the back-fill in a DO block that sets it.
DO $backfill$
BEGIN
  PERFORM set_config('app.in_case_rpc', 'on', true);

  -- Defensive `EXISTS (cases)` guard: skip any orphaned case_phase (a dangling
  -- case_id) so the back-fill never trips the case_id FK on corrupt rows.
  UPDATE "public"."case_phases" cp
    SET "emits_result" = true
    WHERE cp."result_ruleset" IS NOT NULL AND cp."emits_result" = false
      AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = cp."case_id");

  UPDATE "public"."case_phases" cp
    SET "allowed_result_ids" = sub.ids
    FROM (
      select p.id,
             jsonb_agg(distinct rid) as ids
      from public.case_phases p
      cross join lateral (
        select (r ->> 'result_id') as rid
        from jsonb_array_elements(coalesce(p.result_ruleset -> 'rules', '[]'::jsonb)) as r
        union
        select (p.result_ruleset ->> 'default_result_id')
      ) x(rid)
      where p.result_ruleset is not null and rid is not null
      group by p.id
    ) sub
    WHERE cp.id = sub.id AND cp.allowed_result_ids IS NULL
      AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = cp."case_id");

  PERFORM set_config('app.in_case_rpc', 'off', true);
END
$backfill$;

-- Result config requires emits_result (a non-emitting phase carries neither). The
-- two columns may COEXIST: an automatic phase keeps both its ruleset AND the allowed
-- subset that constrains the rules. (No automatic-XOR-manual constraint.)
ALTER TABLE "public"."process_template_phases"
  ADD CONSTRAINT "process_template_phases_result_emits"
  CHECK ("emits_result" OR ("result_ruleset" IS NULL AND "allowed_result_ids" IS NULL));
ALTER TABLE "public"."case_phases"
  ADD CONSTRAINT "case_phases_result_emits"
  CHECK ("emits_result" OR ("result_ruleset" IS NULL AND "allowed_result_ids" IS NULL));

-- allowed_result_ids, when present, is a non-empty JSON array (of uuid strings —
-- referential validity is enforced by app.validate_template_allowed_results, the
-- same way result_ruleset's result_ids are validated, since they live in jsonb).
-- The ">= 2" rule is a client-side authoring gate (not enforced here).
ALTER TABLE "public"."process_template_phases"
  ADD CONSTRAINT "process_template_phases_allowed_shape"
  CHECK (
    "allowed_result_ids" IS NULL OR (
      jsonb_typeof("allowed_result_ids") = 'array'
      AND jsonb_array_length("allowed_result_ids") >= 1
    )
  );
ALTER TABLE "public"."case_phases"
  ADD CONSTRAINT "case_phases_allowed_shape"
  CHECK (
    "allowed_result_ids" IS NULL OR (
      jsonb_typeof("allowed_result_ids") = 'array'
      AND jsonb_array_length("allowed_result_ids") >= 1
    )
  );

COMMENT ON COLUMN "public"."process_template_phases"."emits_result" IS
  'Whether this phase emits a result at all. false → NONE; true + result_ruleset → AUTOMATIC; true + no result_ruleset → MANUAL.';
COMMENT ON COLUMN "public"."process_template_phases"."allowed_result_ids" IS
  'The author-selected allowed result subset (a non-empty jsonb array of phase_results uuids), present whenever the phase emits a result. MANUAL: the options the filler picks from. AUTOMATIC: the options the rules/default may reference. NULL when the phase emits no result.';

-- ===========================================================================
-- 2. validate_template_allowed_results — each id in allowed_result_ids must
--    resolve to a NON-ARCHIVED phase_results row in the template's commission.
--    Plus validate_template_phase_result, the publish-grade coherence rule.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."validate_template_allowed_results"("p_template_id" "uuid", "p_position" integer, "p_allowed_result_ids" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
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
  join public.process_templates t on t.id = ph.template_id
  where ph.template_id = p_template_id and ph.position = p_position;

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

ALTER FUNCTION "app"."validate_template_allowed_results"("p_template_id" "uuid", "p_position" integer, "p_allowed_result_ids" "jsonb") OWNER TO "postgres";

-- Publish-grade coherence: an EMITTING phase must have a non-empty allowed subset.
-- (An automatic ruleset and/or a manual selection then operate over that subset.)
-- Called from publish_process_template (the authoritative gate).
CREATE OR REPLACE FUNCTION "app"."validate_template_phase_result"("p_template_id" "uuid", "p_position" integer) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_emits boolean;
  v_ruleset jsonb;
  v_allowed jsonb;
begin
  select emits_result, result_ruleset, allowed_result_ids
    into v_emits, v_ruleset, v_allowed
  from public.process_template_phases
  where template_id = p_template_id and position = p_position;

  if v_emits and v_allowed is null then
    raise exception
      'a fase % emite um resultado, mas nenhum resultado permitido foi selecionado', p_position
      using errcode = 'HC059';
  end if;

  perform app.validate_template_result_ruleset(p_template_id, p_position, v_ruleset);
  perform app.validate_template_allowed_results(p_template_id, p_position, v_allowed);
  return true;
end;
$$;

ALTER FUNCTION "app"."validate_template_phase_result"("p_template_id" "uuid", "p_position" integer) OWNER TO "postgres";

-- ===========================================================================
-- 3. add_template_phase — additive p_emits_result + p_allowed_result_ids.
--    DROP the prior 7-arg signature (arg-count change; see existing notes).
-- ===========================================================================
DROP FUNCTION IF EXISTS "public"."add_template_phase"("uuid", "uuid", "text", "jsonb", integer, integer[], "jsonb");
CREATE OR REPLACE FUNCTION "public"."add_template_phase"("p_template_id" "uuid", "p_form_id" "uuid", "p_title" "text" DEFAULT NULL::"text", "p_recommend_when" "jsonb" DEFAULT NULL::"jsonb", "p_default_due_days" integer DEFAULT NULL::integer, "p_blocks" integer[] DEFAULT '{}'::integer[], "p_result_ruleset" "jsonb" DEFAULT NULL::"jsonb", "p_emits_result" boolean DEFAULT false, "p_allowed_result_ids" "jsonb" DEFAULT NULL::"jsonb") RETURNS "public"."process_template_phases"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_commission_id uuid;
  v_position integer;
  v_blocks integer[];
  v_result public.process_template_phases;
begin
  perform app.assert_cases_enabled();

  select status, commission_id into v_status, v_commission_id
  from public.process_templates
  where id = p_template_id;

  if v_status is null then
    raise exception 'processo % não encontrado', p_template_id
      using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.forms
    where id = p_form_id and commission_id = v_commission_id
  ) then
    raise exception 'o formulário não pertence a esta comissão'
      using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.process_template_phases
  where template_id = p_template_id;

  v_blocks := coalesce(
    (select array_agg(distinct b order by b)
     from unnest(p_blocks) as b
     where b is not null),
    '{}');

  insert into public.process_template_phases
    (template_id, position, form_id, title, recommend_when, default_due_days,
     blocks, result_ruleset, emits_result, allowed_result_ids)
  values
    (p_template_id, v_position, p_form_id, nullif(btrim(p_title), ''),
     p_recommend_when, p_default_due_days, v_blocks,
     p_result_ruleset, p_emits_result, p_allowed_result_ids)
  returning * into v_result;

  perform app.validate_template_recommend_when(p_template_id, v_position, p_recommend_when);
  perform app.validate_template_phase_blocks(p_template_id, v_position, v_blocks);
  perform app.validate_template_result_ruleset(p_template_id, v_position, p_result_ruleset);
  perform app.validate_template_allowed_results(p_template_id, v_position, p_allowed_result_ids);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."add_template_phase"("p_template_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_default_due_days" integer, "p_blocks" integer[], "p_result_ruleset" "jsonb", "p_emits_result" boolean, "p_allowed_result_ids" "jsonb") OWNER TO "postgres";

-- ===========================================================================
-- 4. update_template_phase — additive p_emits_result + p_allowed_result_ids /
--    p_clear_allowed_result_ids (same clear/replace/keep machinery). DROP prior
--    11-arg signature.
-- ===========================================================================
DROP FUNCTION IF EXISTS "public"."update_template_phase"("uuid", "uuid", "text", "jsonb", boolean, integer, boolean, integer[], boolean, "jsonb", boolean);
CREATE OR REPLACE FUNCTION "public"."update_template_phase"("p_phase_id" "uuid", "p_form_id" "uuid" DEFAULT NULL::"uuid", "p_title" "text" DEFAULT NULL::"text", "p_recommend_when" "jsonb" DEFAULT NULL::"jsonb", "p_clear_recommend_when" boolean DEFAULT false, "p_default_due_days" integer DEFAULT NULL::integer, "p_clear_default_due_days" boolean DEFAULT false, "p_blocks" integer[] DEFAULT NULL::integer[], "p_clear_blocks" boolean DEFAULT false, "p_result_ruleset" "jsonb" DEFAULT NULL::"jsonb", "p_clear_result_ruleset" boolean DEFAULT false, "p_emits_result" boolean DEFAULT NULL::boolean, "p_allowed_result_ids" "jsonb" DEFAULT NULL::"jsonb", "p_clear_allowed_result_ids" boolean DEFAULT false) RETURNS "public"."process_template_phases"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_template_id uuid;
  v_position integer;
  v_status text;
  v_commission_id uuid;
  v_new_recommend jsonb;
  v_new_due_days integer;
  v_new_blocks integer[];
  v_new_ruleset jsonb;
  v_new_emits boolean;
  v_new_allowed jsonb;
  v_result public.process_template_phases;
begin
  perform app.assert_cases_enabled();

  select ph.template_id, ph.position, t.status, t.commission_id
    into v_template_id, v_position, v_status, v_commission_id
  from public.process_template_phases ph
  join public.process_templates t on t.id = ph.template_id
  where ph.id = p_phase_id;

  if v_template_id is null then
    raise exception 'fase % não encontrada', p_phase_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  if p_form_id is not null and not exists (
    select 1 from public.forms where id = p_form_id and commission_id = v_commission_id
  ) then
    raise exception 'o formulário não pertence a esta comissão'
      using errcode = 'check_violation';
  end if;

  if p_clear_recommend_when then
    v_new_recommend := null;
  elsif p_recommend_when is not null then
    v_new_recommend := p_recommend_when;
  else
    select recommend_when into v_new_recommend
    from public.process_template_phases where id = p_phase_id;
  end if;

  if p_clear_default_due_days then
    v_new_due_days := null;
  elsif p_default_due_days is not null then
    v_new_due_days := p_default_due_days;
  else
    select default_due_days into v_new_due_days
    from public.process_template_phases where id = p_phase_id;
  end if;

  if p_clear_blocks then
    v_new_blocks := '{}';
  elsif p_blocks is not null then
    v_new_blocks := coalesce(
      (select array_agg(distinct b order by b)
       from unnest(p_blocks) as b
       where b is not null),
      '{}');
  else
    select blocks into v_new_blocks
    from public.process_template_phases where id = p_phase_id;
  end if;

  -- result_ruleset (automatic): clear/replace/keep.
  if p_clear_result_ruleset then
    v_new_ruleset := null;
  elsif p_result_ruleset is not null then
    v_new_ruleset := p_result_ruleset;
  else
    select result_ruleset into v_new_ruleset
    from public.process_template_phases where id = p_phase_id;
  end if;

  -- allowed_result_ids: clear/replace/keep.
  if p_clear_allowed_result_ids then
    v_new_allowed := null;
  elsif p_allowed_result_ids is not null then
    v_new_allowed := p_allowed_result_ids;
  else
    select allowed_result_ids into v_new_allowed
    from public.process_template_phases where id = p_phase_id;
  end if;

  -- emits_result: explicit boolean when provided, else keep.
  if p_emits_result is not null then
    v_new_emits := p_emits_result;
  else
    select emits_result into v_new_emits
    from public.process_template_phases where id = p_phase_id;
  end if;

  update public.process_template_phases
  set form_id = coalesce(p_form_id, form_id),
      title = case when p_title is null then title else nullif(btrim(p_title), '') end,
      recommend_when = v_new_recommend,
      default_due_days = v_new_due_days,
      blocks = v_new_blocks,
      result_ruleset = v_new_ruleset,
      emits_result = v_new_emits,
      allowed_result_ids = v_new_allowed
  where id = p_phase_id
  returning * into v_result;

  perform app.validate_template_recommend_when(v_template_id, v_position, v_new_recommend);
  perform app.validate_template_phase_blocks(v_template_id, v_position, v_new_blocks);
  perform app.validate_template_result_ruleset(v_template_id, v_position, v_new_ruleset);
  perform app.validate_template_allowed_results(v_template_id, v_position, v_new_allowed);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_template_phase"("p_phase_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_clear_recommend_when" boolean, "p_default_due_days" integer, "p_clear_default_due_days" boolean, "p_blocks" integer[], "p_clear_blocks" boolean, "p_result_ruleset" "jsonb", "p_clear_result_ruleset" boolean, "p_emits_result" boolean, "p_allowed_result_ids" "jsonb", "p_clear_allowed_result_ids" boolean) OWNER TO "postgres";

-- ===========================================================================
-- 5. publish_process_template — validate EVERY emitting phase's result config
--    (allowed subset present + refs; automatic ruleset refs).
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."publish_process_template"("p_template_id" "uuid") RETURNS "public"."process_templates"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_phase_count integer;
  r record;
  v_result public.process_templates;
begin
  perform app.assert_cases_enabled();

  select status into v_status from public.process_templates where id = p_template_id;
  if v_status is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser publicados'
      using errcode = 'check_violation';
  end if;

  select count(*) into v_phase_count
  from public.process_template_phases where template_id = p_template_id;
  if v_phase_count < 1 then
    raise exception 'um processo precisa de ao menos uma fase para ser publicado'
      using errcode = 'HC016';
  end if;

  for r in
    select position, recommend_when
    from public.process_template_phases
    where template_id = p_template_id and recommend_when is not null
  loop
    perform app.validate_template_recommend_when(p_template_id, r.position, r.recommend_when);
  end loop;

  -- Validate the result configuration of every EMITTING phase: the allowed subset
  -- is present + refs valid, and any automatic ruleset's refs are valid.
  for r in
    select position
    from public.process_template_phases
    where template_id = p_template_id and emits_result
  loop
    perform app.validate_template_phase_result(p_template_id, r.position);
  end loop;

  update public.process_templates
  set status = 'active', updated_at = now()
  where id = p_template_id
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."publish_process_template"("p_template_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- 6. create_case_from_template — snapshot emits_result + allowed_result_ids onto
--    case_phases, and add the allowed subset to the frozen offered set.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."create_case_from_template"("p_template_id" "uuid", "p_label" "text" DEFAULT NULL::"text") RETURNS "public"."cases"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_status text;
  v_collects boolean;
  v_case public.cases;
  r_slot record;
  v_version uuid;
  v_from_phase integer;
  v_source_version uuid;
  v_qkey text;
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

    if r_slot.recommend_when is not null then
      v_from_phase := (r_slot.recommend_when ->> 'from_phase')::integer;
      v_qkey := r_slot.recommend_when ->> 'question_key';

      v_source_version := app.published_version_of_form(
        (select form_id from public.process_template_phases
         where template_id = p_template_id and position = v_from_phase)
      );
      if v_source_version is null then
        raise exception
          'o formulário da fase % (origem da recomendação) não está publicado',
          v_from_phase using errcode = 'HC017';
      end if;
      if not app.version_has_input_key(v_source_version, v_qkey) then
        raise exception
          'a recomendação da fase % referencia a pergunta "%", ausente no formulário publicado',
          r_slot.position, v_qkey using errcode = 'HC016';
      end if;
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

ALTER FUNCTION "public"."create_case_from_template"("p_template_id" "uuid", "p_label" "text") OWNER TO "postgres";

-- ===========================================================================
-- 7. compute_case_phase_result — enforce MANDATORY manual selection.
--    A MANUAL phase (emits_result AND result_ruleset IS NULL) MUST have an override
--    at conclude (the filler's pick, stashed pre-submit); else raise — which, since
--    this runs in the conclude trigger inside the submit txn, rolls the submit back.
-- ===========================================================================
CREATE OR REPLACE FUNCTION "app"."compute_case_phase_result"("p_case_phase_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
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

  -- MANUAL mode = emits a result but has no automatic ruleset. The result is the
  -- filler's stashed pick — MANDATORY. No override at conclude → reject.
  v_is_manual := coalesce(v_emits, false) and v_ruleset is null;
  if v_is_manual and v_override_id is null then
    raise exception
      'selecione o resultado da fase % antes de enviar', v_position
      using errcode = 'HC061';
  end if;

  -- Override path: honor a stashed override verbatim (validated at set-time
  -- against the allowed subset + live vocabulary).
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

  -- Computed path. No override AND no ruleset: clear the effective result.
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

ALTER FUNCTION "app"."compute_case_phase_result"("p_case_phase_id" "uuid") OWNER TO "postgres";

-- ===========================================================================
-- 8. set_case_phase_result_override — for a MANUAL phase the chosen result is
--    mandatory (cannot be cleared) and must be in the phase's ALLOWED subset. An
--    AUTOMATIC phase's override stays a full-flexibility staff adjustment (any
--    active result, clearable → revert to the computed result).
-- ===========================================================================
CREATE OR REPLACE FUNCTION "public"."set_case_phase_result_override"("p_case_phase_id" "uuid", "p_result_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
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

  v_is_staff_admin := app.is_staff_admin_of(v_commission_id) or app.is_admin();
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
  end if;
end;
$$;

ALTER FUNCTION "public"."set_case_phase_result_override"("p_case_phase_id" "uuid", "p_result_id" "uuid", "p_reason" "text") OWNER TO "postgres";
