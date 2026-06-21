-- ----------------------------------------------------------------------------
-- Consolidated baseline — cases
-- ----------------------------------------------------------------------------
SET check_function_bodies = false;
SET client_min_messages = warning;

CREATE TABLE IF NOT EXISTS "public"."case_action_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "source_case_phase_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "assigned_to" "uuid",
    "due_date" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    CONSTRAINT "case_action_items_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'done'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "case_action_items_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);

ALTER TABLE "public"."case_action_items" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."advance_action_item_core"("p_action_item_id" "uuid", "p_status" "text") RETURNS "public"."case_action_items"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case_id uuid;
  v_assigned_to uuid;
  v_uid uuid := auth.uid();
  v_result public.case_action_items;
begin
  if p_status not in ('open', 'in_progress', 'done', 'cancelled') then
    raise exception 'estado de item inválido' using errcode = 'check_violation';
  end if;

  select case_id, assigned_to into v_case_id, v_assigned_to
  from public.case_action_items where id = p_action_item_id;
  if v_case_id is null then
    raise exception 'item % não encontrado', p_action_item_id using errcode = 'no_data_found';
  end if;

  -- Authority: the assignee, OR a content-writer of the case (coordinator/admin or
  -- a case-write grantee — ADR 0033 D4). HC027 otherwise.
  if not (
    (v_assigned_to is not null and v_assigned_to = v_uid)
    or app.can_write_case_content(v_case_id, v_uid)
  ) then
    raise exception 'você não pode alterar este item de ação' using errcode = 'HC027';
  end if;

  update public.case_action_items
  set status = p_status,
      completed_at = case when p_status = 'done' then coalesce(completed_at, now()) else null end,
      completed_by = case when p_status = 'done' then coalesce(completed_by, v_uid) else null end,
      updated_at = now()
  where id = p_action_item_id
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "app"."advance_action_item_core"("p_action_item_id" "uuid", "p_status" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."assert_case_access_enabled"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not app.feature_enabled('case_access') then
    raise exception 'o controle de acesso ao caso não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

ALTER FUNCTION "app"."assert_case_access_enabled"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."assert_cases_enabled"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not app.feature_enabled('cases_multi_phase') then
    raise exception 'o recurso de casos multifásicos não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

ALTER FUNCTION "app"."assert_cases_enabled"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."assert_extras_enabled"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not app.feature_enabled('cases_extras') then
    raise exception 'os recursos adicionais de casos não estão disponíveis'
      using errcode = 'check_violation';
  end if;
end;
$$;

ALTER FUNCTION "app"."assert_extras_enabled"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."assert_narratives_enabled"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not app.feature_enabled('case_narratives') then
    raise exception 'o recurso de narrativas do caso não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

ALTER FUNCTION "app"."assert_narratives_enabled"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."can_read_case"("p_case_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;  -- unknown case → no access (and avoids is_member_of(NULL))
  end if;

  -- D9 permissive fallback: with the feature OFF, behave EXACTLY as today
  -- (member-read). This is what keeps "flag OFF ⇒ today's behavior" true at every
  -- tightened SELECT policy.
  if not app.feature_enabled('case_access') then
    return app.is_member_of_for(v_commission, p_uid);
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or app.is_admin_for(p_uid)
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid
    )
    or exists (
      select 1 from public.case_phases cp
      where cp.case_id = p_case_id and cp.assigned_to = p_uid
    )
    or exists (
      select 1 from public.case_narratives cn
      where cn.case_id = p_case_id and cn.assigned_to = p_uid
    );
end;
$$;

ALTER FUNCTION "app"."can_read_case"("p_case_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."can_write_case_content"("p_case_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return false;
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or app.is_admin_for(p_uid)
    or exists (
      select 1 from public.case_access ca
      where ca.case_id = p_case_id and ca.user_id = p_uid and ca.level = 'write'
    );
end;
$$;

ALTER FUNCTION "app"."can_write_case_content"("p_case_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."can_write_case_narrative"("p_narrative_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case_id     uuid;
  v_commission  uuid;
  v_assigned_to uuid;
begin
  select cn.case_id, c.commission_id, cn.assigned_to
    into v_case_id, v_commission, v_assigned_to
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative_id;

  if v_case_id is null then
    return false;
  end if;

  return
    app.is_staff_admin_of_for(v_commission, p_uid)
    or app.is_admin_for(p_uid)
    -- NULL-safe assignee check: an UN-assigned narrative (v_assigned_to IS NULL)
    -- must NOT make this term NULL (which would poison the boolean OR and yield
    -- NULL instead of a clean false). `is not distinct from` would be true for
    -- (null, null) — wrong — so require non-null explicitly.
    or (v_assigned_to is not null and v_assigned_to = p_uid)
    or (v_assigned_to is null
        and app.can_write_case_content(v_case_id, p_uid));
end;
$$;

ALTER FUNCTION "app"."can_write_case_narrative"("p_narrative_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."case_phase_answer_map"("p_case_phase_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select coalesce(jsonb_object_agg(a.question_key, a.value), '{}'::jsonb)
  from public.responses r
  join public.answers a on a.response_id = r.id
  where r.case_phase_id = p_case_phase_id
    and r.status = 'submitted'
    and a.value is not null;
$$;

ALTER FUNCTION "app"."case_phase_answer_map"("p_case_phase_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."commission_of_case"("p_case_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select commission_id from public.cases where id = p_case_id;
$$;

ALTER FUNCTION "app"."commission_of_case"("p_case_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."commission_of_template"("p_template_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select commission_id from public.process_templates where id = p_template_id;
$$;

ALTER FUNCTION "app"."commission_of_template"("p_template_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_case_narrative_frozen"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_narrative_rpc', true), 'off') = 'on';
  v_case_id uuid;
  v_status text;
begin
  v_case_id := case when tg_op = 'DELETE' then old.case_id else new.case_id end;
  select status into v_status from public.cases where id = v_case_id;

  -- Parent gone (cascade) or open → allow. The flag overrides the freeze for the
  -- vetted body-save RPC.
  if v_status is null or v_in_rpc then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if v_status in ('concluido', 'cancelado') then
    raise exception 'as narrativas deste caso estão bloqueadas'
      using errcode = 'HC054';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

ALTER FUNCTION "app"."guard_case_narrative_frozen"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_case_phase_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_case_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    -- Phases are only deleted via the case cascade (handled there) or while the
    -- case is being built under the flag; a direct terminal-phase delete is
    -- blocked.
    if not v_in_rpc and old.status in ('concluida', 'nao_necessaria') then
      raise exception 'terminal case phases are immutable (delete blocked)'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- Status transition.
  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'case phase status changes must go through the case RPCs'
        using errcode = 'check_violation';
    end if;

    if not (
      (old.status = 'pendente' and new.status in ('ativa', 'nao_necessaria'))
      or (old.status = 'ativa' and new.status in ('concluida', 'nao_necessaria'))
    ) then
      raise exception 'invalid case phase transition % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    return new;
  end if;

  -- No status change. Permit the recommended-flag toggle while pendente; permit
  -- any non-status field change under the RPC flag (activate/reassign metadata);
  -- otherwise freeze a non-pendente phase.
  if v_in_rpc then
    return new;
  end if;

  if old.status = 'pendente'
     and new.recommended is distinct from old.recommended
     and new.status = old.status
     and new.assigned_to is not distinct from old.assigned_to
     and new.activated_at is not distinct from old.activated_at
     and new.completed_at is not distinct from old.completed_at
     and new.skipped_at is not distinct from old.skipped_at then
    return new;
  end if;

  raise exception 'case phase changes must go through the case RPCs'
    using errcode = 'check_violation';
end;
$$;

ALTER FUNCTION "app"."guard_case_phase_status"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_case_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_case_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    if old.status in ('concluido', 'cancelado') then
      raise exception 'cases in a terminal state are immutable (delete blocked)'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- A status change is only permitted inside a vetted RPC / the recompute trigger.
  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'case status changes must go through the case RPCs'
        using errcode = 'check_violation';
    end if;
    -- A terminal case is frozen.
    if old.status in ('concluido', 'cancelado') then
      raise exception 'este caso está em um estado final e não pode mais ser alterado'
        using errcode = 'HC025';
    end if;
    -- Validity of the NEW value is the column CHECK's job (no transition matrix).
    return new;
  end if;

  -- A non-status update is forbidden once the case is terminal.
  if old.status in ('concluido', 'cancelado') and not v_in_rpc then
    raise exception 'cases in a terminal state are immutable (update blocked)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "app"."guard_case_status"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_case_tag_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case_commission uuid;
  v_tag_commission uuid;
begin
  select commission_id into v_case_commission from public.cases where id = new.case_id;
  select commission_id into v_tag_commission from public.case_tags where id = new.tag_id;

  if v_case_commission is null or v_tag_commission is null
     or v_case_commission <> v_tag_commission then
    raise exception 'esta etiqueta não pertence à comissão deste caso'
      using errcode = 'HC026';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "app"."guard_case_tag_assignment"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_phase_blocks_shape"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_bad integer;
begin
  if new.blocks is null then
    -- The column is NOT NULL, but be explicit: treat as empty.
    new.blocks := '{}';
    return new;
  end if;

  -- Any element that is null, < 1, or >= this row's position is illegal.
  select b into v_bad
  from unnest(new.blocks) as b
  where b is null or b < 1 or b >= new.position
  limit 1;

  if found then
    raise exception
      'um bloqueio da fase % referencia uma fase inválida (deve ser uma fase anterior)',
      new.position
      using errcode = 'HC016';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "app"."guard_phase_blocks_shape"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_process_template_outcome"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_template_commission uuid;
  v_outcome_commission uuid;
begin
  select commission_id into v_template_commission
  from public.process_templates where id = new.template_id;
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

ALTER FUNCTION "app"."guard_process_template_outcome"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_template_narrative_type"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_template_commission uuid;
  v_type_commission uuid;
begin
  select commission_id into v_template_commission
  from public.process_templates where id = new.template_id;
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

ALTER FUNCTION "app"."guard_template_narrative_type"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."mint_case_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  -- Serialize concurrent inserts for the SAME commission; other commissions are
  -- unaffected (distinct advisory-lock keys).
  perform pg_advisory_xact_lock(hashtextextended(new.commission_id::text, 0));

  new.case_number := coalesce(
    (select max(case_number) from public.cases where commission_id = new.commission_id),
    0
  ) + 1;

  return new;
end;
$$;

ALTER FUNCTION "app"."mint_case_number"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."published_version_of_form"("p_form_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select id
  from public.form_versions
  where form_id = p_form_id and status = 'published'
  order by version_number desc
  limit 1;
$$;

ALTER FUNCTION "app"."published_version_of_form"("p_form_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."recompute_case_status"("p_case_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_old_status text;
  v_new_status text;
  v_has_active boolean;
  v_has_concluded boolean;
begin
  select status into v_old_status from public.cases where id = p_case_id;
  if v_old_status is null then
    return;  -- case gone (e.g. mid-cascade); nothing to do.
  end if;

  -- Never override a manual terminal status.
  if v_old_status in ('concluido', 'cancelado') then
    return;
  end if;

  select bool_or(status = 'ativa'), bool_or(status = 'concluida')
    into v_has_active, v_has_concluded
  from public.case_phases
  where case_id = p_case_id;

  if coalesce(v_has_active, false) then
    v_new_status := 'em_revisao';
  elsif coalesce(v_has_concluded, false) then
    v_new_status := 'pendente';
  else
    v_new_status := 'nao_iniciado';
  end if;

  if v_new_status is distinct from v_old_status then
    perform set_config('app.in_case_rpc', 'on', true);
    update public.cases set status = v_new_status where id = p_case_id;
    perform set_config('app.in_case_rpc', 'off', true);
  end if;
end;
$$;

ALTER FUNCTION "app"."recompute_case_status"("p_case_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."touch_case_narrative_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;

ALTER FUNCTION "app"."touch_case_narrative_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_recompute_case_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.recompute_case_status(new.case_id);
  return new;
end;
$$;

ALTER FUNCTION "app"."trg_recompute_case_status"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."validate_template_phase_blocks"("p_template_id" "uuid", "p_position" integer, "p_blocks" integer[]) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
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

  -- Every referenced position must exist as a slot in this template.
  select b into v_missing
  from unnest(p_blocks) as b
  where not exists (
    select 1 from public.process_template_phases
    where template_id = p_template_id and position = b
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

ALTER FUNCTION "app"."validate_template_phase_blocks"("p_template_id" "uuid", "p_position" integer, "p_blocks" integer[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."validate_template_recommend_when"("p_template_id" "uuid", "p_position" integer, "p_recommend_when" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_from_phase integer;
  v_question_key text;
  v_source_form_id uuid;
  v_source_version uuid;
begin
  if p_recommend_when is null then
    return true;
  end if;

  v_from_phase := (p_recommend_when ->> 'from_phase')::integer;
  v_question_key := p_recommend_when ->> 'question_key';

  -- from_phase must reference an EARLIER slot (1-based positions).
  if v_from_phase is null or v_from_phase < 1 or v_from_phase >= p_position then
    raise exception
      'a recomendação da fase % deve referenciar uma fase anterior (fase informada: %)',
      p_position, coalesce(v_from_phase::text, 'nula')
      using errcode = 'HC016';
  end if;

  -- Resolve the source slot's form + its published version.
  select form_id into v_source_form_id
  from public.process_template_phases
  where template_id = p_template_id and position = v_from_phase;

  if v_source_form_id is null then
    raise exception
      'a recomendação da fase % referencia a fase %, que não existe no processo',
      p_position, v_from_phase
      using errcode = 'HC016';
  end if;

  v_source_version := app.published_version_of_form(v_source_form_id);
  if v_source_version is null then
    raise exception
      'o formulário da fase % (origem da recomendação) ainda não foi publicado',
      v_from_phase
      using errcode = 'HC017';
  end if;

  -- The referenced question_key must exist as an input item in that version.
  if not app.version_has_input_key(v_source_version, v_question_key) then
    raise exception
      'a recomendação da fase % referencia a pergunta "%", que não existe no formulário da fase %',
      p_position, v_question_key, v_from_phase
      using errcode = 'HC016';
  end if;

  return true;
end;
$$;

ALTER FUNCTION "app"."validate_template_recommend_when"("p_template_id" "uuid", "p_position" integer, "p_recommend_when" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."version_has_input_key"("p_version_id" "uuid", "p_question_key" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1 from public.form_items
    where form_version_id = p_version_id
      and question_key = p_question_key
      and item_type in ('multiple_choice', 'dropdown', 'checkbox', 'free_text')
  );
$$;

ALTER FUNCTION "app"."version_has_input_key"("p_version_id" "uuid", "p_question_key" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."case_phases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "form_id" "uuid" NOT NULL,
    "form_version_id" "uuid" NOT NULL,
    "title" "text",
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "recommended" boolean DEFAULT false NOT NULL,
    "recommend_when" "jsonb",
    "assigned_to" "uuid",
    "is_ad_hoc" boolean DEFAULT false NOT NULL,
    "activated_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "skipped_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "default_due_days" integer,
    "due_date" "date",
    "blocks" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "display_position" integer,
    CONSTRAINT "case_phases_default_due_days_nonneg" CHECK ((("default_due_days" IS NULL) OR ("default_due_days" >= 0))),
    CONSTRAINT "case_phases_recommend_when_shape" CHECK ((("recommend_when" IS NULL) OR (("jsonb_typeof"("recommend_when") = 'object'::"text") AND ("recommend_when" ? 'from_phase'::"text") AND ("jsonb_typeof"(("recommend_when" -> 'from_phase'::"text")) = 'number'::"text") AND ("recommend_when" ? 'question_key'::"text") AND ("jsonb_typeof"(("recommend_when" -> 'question_key'::"text")) = 'string'::"text") AND ("recommend_when" ? 'op'::"text") AND (("recommend_when" ->> 'op'::"text") = ANY (ARRAY['equals'::"text", 'not_equals'::"text", 'in'::"text"])) AND ("recommend_when" ? 'value'::"text")))),
    CONSTRAINT "case_phases_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'ativa'::"text", 'concluida'::"text", 'nao_necessaria'::"text"])))
);

ALTER TABLE "public"."case_phases" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."activate_phase"("p_case_phase_id" "uuid", "p_assigned_to" "uuid", "p_due_date" "date" DEFAULT NULL::"date") RETURNS "public"."case_phases"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_case_id uuid;
  v_status text;
  v_case_status text;
  v_commission_id uuid;
  v_blocks integer[];
  v_blocking integer;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select cp.case_id, cp.status, cp.blocks, c.status, c.commission_id
    into v_case_id, v_status, v_blocks, v_case_status, v_commission_id
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_case_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;
  if v_status <> 'pendente' then
    raise exception 'esta fase não está pendente' using errcode = 'HC019';
  end if;

  -- Blocker gate (D1/D4): a phase is blocked while ANY phase it lists is not yet
  -- concluida/nao_necessaria. Empty blocks -> never blocked (parallel-friendly).
  if v_blocks is not null and cardinality(v_blocks) > 0 then
    select count(*) into v_blocking
    from public.case_phases
    where case_id = v_case_id
      and position = any(v_blocks)
      and status not in ('concluida', 'nao_necessaria');
    if v_blocking > 0 then
      raise exception 'conclua ou marque as fases que bloqueiam esta antes de ativá-la'
        using errcode = 'HC018';
    end if;
  end if;

  if not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'ativa',
      assigned_to = p_assigned_to,
      due_date = p_due_date,
      activated_at = now(),
      updated_at = now()
  where id = p_case_phase_id
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."activate_phase"("p_case_phase_id" "uuid", "p_assigned_to" "uuid", "p_due_date" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_ad_hoc_phase"("p_case_id" "uuid", "p_form_id" "uuid", "p_title" "text" DEFAULT NULL::"text", "p_recommend_when" "jsonb" DEFAULT NULL::"jsonb", "p_assigned_to" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."case_phases"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_case_status text;
  v_commission_id uuid;
  v_position integer;
  v_version uuid;
  v_from_phase integer;
  v_source_version uuid;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select status, commission_id into v_case_status, v_commission_id
  from public.cases where id = p_case_id;
  if v_case_status is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;

  if not exists (
    select 1 from public.forms where id = p_form_id and commission_id = v_commission_id
  ) then
    raise exception 'o formulário não pertence a esta comissão' using errcode = 'check_violation';
  end if;

  v_version := app.published_version_of_form(p_form_id);
  if v_version is null then
    raise exception 'este formulário ainda não foi publicado' using errcode = 'HC017';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.case_phases where case_id = p_case_id;

  -- Validate recommend_when against the existing (earlier) phases' pinned versions.
  if p_recommend_when is not null then
    v_from_phase := (p_recommend_when ->> 'from_phase')::integer;
    if v_from_phase is null or v_from_phase < 1 or v_from_phase >= v_position then
      raise exception 'a recomendação deve referenciar uma fase anterior'
        using errcode = 'HC016';
    end if;
    select form_version_id into v_source_version
    from public.case_phases where case_id = p_case_id and position = v_from_phase;
    if v_source_version is null then
      raise exception 'a recomendação referencia uma fase inexistente'
        using errcode = 'HC016';
    end if;
    if not app.version_has_input_key(v_source_version, p_recommend_when ->> 'question_key') then
      raise exception 'a recomendação referencia uma pergunta inexistente no formulário de origem'
        using errcode = 'HC016';
    end if;
  end if;

  if p_assigned_to is not null and not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  insert into public.case_phases
    (case_id, position, form_id, form_version_id, title, recommend_when, is_ad_hoc, assigned_to)
  values
    (p_case_id, v_position, p_form_id, v_version, nullif(btrim(p_title), ''),
     p_recommend_when, true, p_assigned_to)
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  perform public.recompute_recommendations(p_case_id);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."add_ad_hoc_phase"("p_case_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_assigned_to" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."process_template_narratives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "narrative_type_id" "uuid" NOT NULL,
    "display_position" integer NOT NULL,
    "title" "text",
    "instructions" "text",
    "is_expected" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."process_template_narratives" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_template_narrative"("p_template_id" "uuid", "p_narrative_type_id" "uuid", "p_title" "text" DEFAULT NULL::"text", "p_instructions" "text" DEFAULT NULL::"text", "p_is_expected" boolean DEFAULT false) RETURNS "public"."process_template_narratives"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_commission_id uuid;
  v_position integer;
  v_result public.process_template_narratives;
begin
  perform app.assert_narratives_enabled();

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

  -- Next display_position over BOTH slot kinds (the interleave). Phases fall back
  -- to `position` when their display_position is null — a phase added to the draft
  -- by the (unmodified) add_template_phase RPC leaves display_position null, but
  -- `position` is always present and the merge treats it as the display order
  -- (coalesce(display_position, position), same as get_case_detail / mergeCaseLayout).
  select coalesce(max(dp), 0) + 1 into v_position
  from (
    select coalesce(display_position, position) as dp
    from public.process_template_phases where template_id = p_template_id
    union all
    select display_position as dp
    from public.process_template_narratives where template_id = p_template_id
  ) s;

  insert into public.process_template_narratives
    (template_id, narrative_type_id, display_position, title, instructions, is_expected)
  values
    (p_template_id, p_narrative_type_id, v_position,
     nullif(btrim(p_title), ''), nullif(btrim(p_instructions), ''),
     coalesce(p_is_expected, false))
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."add_template_narrative"("p_template_id" "uuid", "p_narrative_type_id" "uuid", "p_title" "text", "p_instructions" "text", "p_is_expected" boolean) OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."process_template_phases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "form_id" "uuid" NOT NULL,
    "title" "text",
    "recommend_when" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "default_due_days" integer,
    "blocks" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "display_position" integer,
    CONSTRAINT "process_template_phases_default_due_days_nonneg" CHECK ((("default_due_days" IS NULL) OR ("default_due_days" >= 0))),
    CONSTRAINT "process_template_phases_recommend_when_shape" CHECK ((("recommend_when" IS NULL) OR (("jsonb_typeof"("recommend_when") = 'object'::"text") AND ("recommend_when" ? 'from_phase'::"text") AND ("jsonb_typeof"(("recommend_when" -> 'from_phase'::"text")) = 'number'::"text") AND ("recommend_when" ? 'question_key'::"text") AND ("jsonb_typeof"(("recommend_when" -> 'question_key'::"text")) = 'string'::"text") AND ("recommend_when" ? 'op'::"text") AND (("recommend_when" ->> 'op'::"text") = ANY (ARRAY['equals'::"text", 'not_equals'::"text", 'in'::"text"])) AND ("recommend_when" ? 'value'::"text"))))
);

ALTER TABLE "public"."process_template_phases" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_template_phase"("p_template_id" "uuid", "p_form_id" "uuid", "p_title" "text" DEFAULT NULL::"text", "p_recommend_when" "jsonb" DEFAULT NULL::"jsonb", "p_default_due_days" integer DEFAULT NULL::integer, "p_blocks" integer[] DEFAULT '{}'::integer[]) RETURNS "public"."process_template_phases"
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

  -- The bound form must belong to the same commission.
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

  -- Insert first so validate_* can resolve this slot's position among siblings.
  insert into public.process_template_phases
    (template_id, position, form_id, title, recommend_when, default_due_days, blocks)
  values
    (p_template_id, v_position, p_form_id, nullif(btrim(p_title), ''),
     p_recommend_when, p_default_due_days, v_blocks)
  returning * into v_result;

  perform app.validate_template_recommend_when(p_template_id, v_position, p_recommend_when);
  perform app.validate_template_phase_blocks(p_template_id, v_position, v_blocks);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."add_template_phase"("p_template_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_default_due_days" integer, "p_blocks" integer[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."advance_action_item"("p_action_item_id" "uuid", "p_status" "text") RETURNS "public"."case_action_items"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_extras_enabled();
  return app.advance_action_item_core(p_action_item_id, p_status);
end;
$$;

ALTER FUNCTION "public"."advance_action_item"("p_action_item_id" "uuid", "p_status" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."case_narrative_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "commission_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "archived" boolean DEFAULT false NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "case_narrative_types_label_not_blank" CHECK (("btrim"("label") <> ''::"text"))
);

ALTER TABLE "public"."case_narrative_types" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."archive_case_narrative_type"("p_narrative_type_id" "uuid") RETURNS "public"."case_narrative_types"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.case_narrative_types;
begin
  perform app.assert_narratives_enabled();

  select commission_id into v_commission_id
  from public.case_narrative_types where id = p_narrative_type_id;
  if v_commission_id is null then
    raise exception 'narrativa não encontrada' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.case_narrative_types set archived = true
  where id = p_narrative_type_id returning * into v_result;
  return v_result;
end;
$$;

ALTER FUNCTION "public"."archive_case_narrative_type"("p_narrative_type_id" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."case_outcomes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "commission_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "color_token" "text" DEFAULT 'muted'::"text" NOT NULL,
    "requires_action_plan" boolean DEFAULT false NOT NULL,
    "is_adverse" boolean DEFAULT false NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "case_outcomes_color_token_check" CHECK (("color_token" = ANY (ARRAY['muted'::"text", 'slate'::"text", 'blue'::"text", 'amber'::"text", 'green'::"text", 'red'::"text", 'violet'::"text"]))),
    CONSTRAINT "case_outcomes_label_not_blank" CHECK (("btrim"("label") <> ''::"text"))
);

ALTER TABLE "public"."case_outcomes" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."archive_case_outcome"("p_outcome_id" "uuid") RETURNS "public"."case_outcomes"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.case_outcomes;
begin
  perform app.assert_extras_enabled();

  select commission_id into v_commission_id
  from public.case_outcomes where id = p_outcome_id;
  if v_commission_id is null then
    raise exception 'desfecho não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.case_outcomes set archived = true, updated_at = now()
  where id = p_outcome_id returning * into v_result;
  return v_result;
end;
$$;

ALTER FUNCTION "public"."archive_case_outcome"("p_outcome_id" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."case_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "commission_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color_token" "text" DEFAULT 'muted'::"text" NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "case_tags_color_token_check" CHECK (("color_token" = ANY (ARRAY['muted'::"text", 'slate'::"text", 'blue'::"text", 'amber'::"text", 'green'::"text", 'red'::"text", 'violet'::"text"]))),
    CONSTRAINT "case_tags_name_not_blank" CHECK (("btrim"("name") <> ''::"text"))
);

ALTER TABLE "public"."case_tags" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."archive_case_tag"("p_tag_id" "uuid") RETURNS "public"."case_tags"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.case_tags;
begin
  perform app.assert_extras_enabled();

  select commission_id into v_commission_id from public.case_tags where id = p_tag_id;
  if v_commission_id is null then
    raise exception 'etiqueta não encontrada' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.case_tags set archived = true where id = p_tag_id returning * into v_result;
  return v_result;
end;
$$;

ALTER FUNCTION "public"."archive_case_tag"("p_tag_id" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."process_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "commission_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "process_templates_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'archived'::"text"])))
);

ALTER TABLE "public"."process_templates" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."archive_process_template"("p_template_id" "uuid") RETURNS "public"."process_templates"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_result public.process_templates;
begin
  perform app.assert_cases_enabled();

  select status into v_status
  from public.process_templates
  where id = p_template_id;

  if v_status is null then
    raise exception 'processo % não encontrado', p_template_id
      using errcode = 'no_data_found';
  end if;

  if v_status not in ('draft', 'active') then
    raise exception 'este processo não pode ser arquivado'
      using errcode = 'HC023';
  end if;

  update public.process_templates
  set status = 'archived', updated_at = now()
  where id = p_template_id
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."archive_process_template"("p_template_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."assign_case_tag"("p_case_id" "uuid", "p_tag_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
begin
  perform app.assert_extras_enabled();

  v_commission_id := app.commission_of_case(p_case_id);
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not app.can_write_case_content(p_case_id, auth.uid()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  insert into public.case_tag_assignments (case_id, tag_id, assigned_by)
  values (p_case_id, p_tag_id, auth.uid())
  on conflict (case_id, tag_id) do nothing;
end;
$$;

ALTER FUNCTION "public"."assign_case_tag"("p_case_id" "uuid", "p_tag_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."assign_narrative"("p_narrative" "uuid", "p_assignee" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case_id uuid;
  v_commission uuid;
  v_case_status text;
  v_status text;
begin
  perform app.assert_case_access_enabled();

  select cn.case_id, c.commission_id, c.status, cn.status
    into v_case_id, v_commission, v_case_status, v_status
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_case_id is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  if v_status <> 'aberta' then
    raise exception 'a narrativa não está no estado necessário para esta ação'
      using errcode = 'HC055';
  end if;
  if not app.is_member_of_for(v_commission, p_assignee) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives set assigned_to = p_assignee, updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."assign_narrative"("p_narrative" "uuid", "p_assignee" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "commission_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "case_number" integer NOT NULL,
    "label" "text",
    "status" "text" DEFAULT 'nao_iniciado'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    "closed_by" "uuid",
    "outcome_id" "uuid",
    CONSTRAINT "cases_status_check" CHECK (("status" = ANY (ARRAY['nao_iniciado'::"text", 'pendente'::"text", 'em_revisao'::"text", 'concluido'::"text", 'cancelado'::"text"])))
);

ALTER TABLE "public"."cases" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."cancel_case"("p_case_id" "uuid") RETURNS "public"."cases"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_result public.cases;
begin
  perform app.assert_cases_enabled();

  select status into v_status from public.cases where id = p_case_id;
  if v_status is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if v_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  -- Terminal FIRST: freeze the case, then the phase flips' recompute no-ops.
  update public.cases
  set status = 'cancelado', closed_at = now(), closed_by = auth.uid()
  where id = p_case_id
  returning * into v_result;

  update public.case_phases
  set status = 'nao_necessaria', skipped_at = coalesce(skipped_at, now()), updated_at = now()
  where case_id = p_case_id and status in ('pendente', 'ativa');

  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."cancel_case"("p_case_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."case_access_enabled"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.feature_enabled('case_access');
$$;

ALTER FUNCTION "public"."case_access_enabled"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."case_action_items_kpis"("p_commission_id" "uuid") RETURNS TABLE("open" bigint, "overdue" bigint, "completed_ytd" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    return query select 0::bigint, 0::bigint, 0::bigint;
    return;
  end if;

  return query
  select
    count(*) filter (where ai.status in ('open', 'in_progress')) as open,
    count(*) filter (
      where ai.status in ('open', 'in_progress')
        and ai.due_date is not null
        and ai.due_date < current_date
    ) as overdue,
    count(*) filter (
      where ai.status = 'done'
        and ai.completed_at is not null
        and date_trunc('year', ai.completed_at) = date_trunc('year', now())
    ) as completed_ytd
  from public.case_action_items ai
  join public.cases c on c.id = ai.case_id
  where c.commission_id = p_commission_id;
end;
$$;

ALTER FUNCTION "public"."case_action_items_kpis"("p_commission_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."case_narratives_enabled"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.feature_enabled('case_narratives');
$$;

ALTER FUNCTION "public"."case_narratives_enabled"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."case_tag_report"("p_commission_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date") RETURNS TABLE("tag_id" "uuid", "name" "text", "color_token" "text", "case_count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    return;
  end if;

  return query
  select t.id,
         t.name,
         t.color_token,
         count(distinct c.id) as case_count
  from public.case_tags t
  left join public.case_tag_assignments ta on ta.tag_id = t.id
  left join public.cases c
    on c.id = ta.case_id
   and (p_from is null or c.created_at::date >= p_from)
   and (p_to   is null or c.created_at::date <= p_to)
  where t.commission_id = p_commission_id
    and not t.archived
  group by t.id, t.name, t.color_token
  order by count(distinct c.id) desc, t.name;
end;
$$;

ALTER FUNCTION "public"."case_tag_report"("p_commission_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."case_viewer_capabilities"("p_case_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_commission uuid;
begin
  select commission_id into v_commission from public.cases where id = p_case_id;
  if v_commission is null then
    return jsonb_build_object(
      'can_read', false, 'can_write_content', false, 'can_manage_lifecycle', false);
  end if;

  return jsonb_build_object(
    'can_read', app.can_read_case(p_case_id, v_uid),
    'can_write_content', app.can_write_case_content(p_case_id, v_uid),
    'can_manage_lifecycle',
      app.is_staff_admin_of_for(v_commission, v_uid) or app.is_admin_for(v_uid)
  );
end;
$$;

ALTER FUNCTION "public"."case_viewer_capabilities"("p_case_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."cases_extras_enabled"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.feature_enabled('cases_extras');
$$;

ALTER FUNCTION "public"."cases_extras_enabled"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."close_case"("p_case_id" "uuid") RETURNS "public"."cases"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_outcome_id uuid;
  v_unsettled integer;
  v_offered integer;
  v_result public.cases;
begin
  perform app.assert_cases_enabled();

  select status, outcome_id into v_status, v_outcome_id
  from public.cases where id = p_case_id;
  if v_status is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if v_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  -- D3 gate 1: every phase must be settled (concluida or nao_necessaria).
  select count(*) into v_unsettled
  from public.case_phases
  where case_id = p_case_id and status in ('pendente', 'ativa');
  if v_unsettled > 0 then
    raise exception 'conclua ou marque todas as fases antes de concluir o caso'
      using errcode = 'HC031';
  end if;

  -- D3 gate 2: a process that OFFERS outcomes requires one selected.
  select count(*) into v_offered
  from public.case_offered_outcomes where case_id = p_case_id;
  if v_offered > 0 and v_outcome_id is null then
    raise exception 'selecione um desfecho antes de concluir o caso'
      using errcode = 'HC028';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  -- Terminal FIRST: freeze the case, then any residual phase flip no-ops.
  update public.cases
  set status = 'concluido', closed_at = now(), closed_by = auth.uid()
  where id = p_case_id
  returning * into v_result;

  update public.case_phases
  set status = 'nao_necessaria', skipped_at = coalesce(skipped_at, now()), updated_at = now()
  where case_id = p_case_id and status in ('pendente', 'ativa');

  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."close_case"("p_case_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."complete_action_item"("p_action_item_id" "uuid") RETURNS "public"."case_action_items"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_extras_enabled();
  return app.advance_action_item_core(p_action_item_id, 'done');
end;
$$;

ALTER FUNCTION "public"."complete_action_item"("p_action_item_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."conclude_narrative"("p_narrative" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
  v_case_status text;
  v_status text;
  v_assigned uuid;
begin
  perform app.assert_case_access_enabled();

  select c.commission_id, c.status, cn.status, cn.assigned_to
    into v_commission, v_case_status, v_status, v_assigned
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_status is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  -- The assignee OR a coordinator/admin may conclude.
  if not (v_assigned = auth.uid()
          or app.is_staff_admin_of(v_commission) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  if v_status <> 'aberta' then
    raise exception 'a narrativa não está no estado necessário para esta ação'
      using errcode = 'HC055';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives
  set status = 'concluida', concluded_at = now(), concluded_by = auth.uid(),
      updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."conclude_narrative"("p_narrative" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_action_item"("p_case_id" "uuid", "p_title" "text", "p_description" "text" DEFAULT NULL::"text", "p_assigned_to" "uuid" DEFAULT NULL::"uuid", "p_due_date" "date" DEFAULT NULL::"date", "p_source_case_phase_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."case_action_items"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.case_action_items;
begin
  perform app.assert_extras_enabled();

  v_commission_id := app.commission_of_case(p_case_id);
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  -- Authority broadened (ADR 0033 D4): coordinator/admin OR a case-write grantee.
  if not app.can_write_case_content(p_case_id, auth.uid()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe o título do item' using errcode = 'check_violation';
  end if;
  if p_assigned_to is not null and not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;
  if p_source_case_phase_id is not null and not exists (
    select 1 from public.case_phases where id = p_source_case_phase_id and case_id = p_case_id
  ) then
    raise exception 'a fase de origem não pertence a este caso' using errcode = 'check_violation';
  end if;

  insert into public.case_action_items
    (case_id, source_case_phase_id, title, description, assigned_to, due_date, created_by)
  values
    (p_case_id, p_source_case_phase_id, btrim(p_title), nullif(btrim(p_description), ''),
     p_assigned_to, p_due_date, auth.uid())
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."create_action_item"("p_case_id" "uuid", "p_title" "text", "p_description" "text", "p_assigned_to" "uuid", "p_due_date" "date", "p_source_case_phase_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_case_from_template"("p_template_id" "uuid", "p_label" "text" DEFAULT NULL::"text") RETURNS "public"."cases"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_status text;
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

  select commission_id, status into v_commission_id, v_status
  from public.process_templates where id = p_template_id;

  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  -- Internal gate (DEFINER): only a staff_admin of the template's commission may
  -- open a case. Mirrors the definer board self-gate.
  if not app.is_staff_admin_of(v_commission_id) then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;

  if v_status <> 'active' then
    raise exception 'apenas processos publicados podem iniciar casos'
      using errcode = 'check_violation';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);

  -- Insert the case; the minting trigger sets case_number. status defaults to
  -- 'nao_iniciado' (no explicit status -> the column default applies). Bounded
  -- unique_violation retry for the per-commission number race.
  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.cases (commission_id, template_id, label, created_by)
      values (v_commission_id, p_template_id, nullif(btrim(p_label), ''), auth.uid())
      returning * into v_case;
      exit;  -- success
    exception
      when unique_violation then
        if v_attempt >= 3 then
          raise;
        end if;
        -- loop and let the minting trigger recompute on the next attempt
    end;
  end loop;

  -- Materialize the template slots into case_phases, pinning published versions
  -- and snapshotting recommend_when, default_due_days, blocks AND display_position
  -- verbatim.
  for r_slot in
    select position, form_id, title, recommend_when, default_due_days, blocks,
           display_position
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

    -- Re-validate recommend_when against the PINNED source version.
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

    -- Snapshot the slot (ADR 0017 + blocks + ADR 0032 display_position). due_date
    -- null. The blocks shape trigger re-asserts earlier-only on this insert.
    insert into public.case_phases
      (case_id, position, form_id, form_version_id, title, recommend_when,
       is_ad_hoc, default_due_days, blocks, display_position)
    values
      (v_case.id, r_slot.position, r_slot.form_id, v_version, r_slot.title,
       r_slot.recommend_when, false, r_slot.default_due_days, r_slot.blocks,
       coalesce(r_slot.display_position, r_slot.position));
  end loop;

  -- Freeze the OFFERED outcome set for this case (D15) from the template's live
  -- offering. The conclude gate + selector read THIS, not process_template_outcomes.
  insert into public.case_offered_outcomes (case_id, outcome_id)
  select v_case.id, pto.outcome_id
  from public.process_template_outcomes pto
  where pto.template_id = p_template_id;

  -- Snapshot the NARRATIVE slots (ADR 0032) — only when the feature is on. The
  -- EFFECTIVE label (coalesce(slot.title, type.label)) is frozen into type_label.
  -- Runs while the case is 'aberto', so guard_case_narrative_frozen passes.
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

  -- Initial recommendation pass (no submitted phases yet; uniform path).
  perform public.recompute_recommendations(v_case.id);

  return v_case;
end;
$$;

ALTER FUNCTION "public"."create_case_from_template"("p_template_id" "uuid", "p_label" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_case_narrative_type"("p_commission_id" "uuid", "p_label" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS "public"."case_narrative_types"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_position integer;
  v_result public.case_narrative_types;
begin
  perform app.assert_narratives_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_label), '') is null then
    raise exception 'informe o nome da narrativa' using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.case_narrative_types where commission_id = p_commission_id;

  insert into public.case_narrative_types
    (commission_id, label, description, position)
  values
    (p_commission_id, btrim(p_label), nullif(btrim(p_description), ''), v_position)
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."create_case_narrative_type"("p_commission_id" "uuid", "p_label" "text", "p_description" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_case_outcome"("p_commission_id" "uuid", "p_label" "text", "p_color_token" "text" DEFAULT 'muted'::"text", "p_requires_action_plan" boolean DEFAULT false, "p_is_adverse" boolean DEFAULT false) RETURNS "public"."case_outcomes"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_position integer;
  v_result public.case_outcomes;
begin
  perform app.assert_extras_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_label), '') is null then
    raise exception 'informe o nome do desfecho' using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.case_outcomes where commission_id = p_commission_id;

  insert into public.case_outcomes
    (commission_id, label, color_token, requires_action_plan, is_adverse, position)
  values
    (p_commission_id, btrim(p_label), p_color_token,
     coalesce(p_requires_action_plan, false), coalesce(p_is_adverse, false), v_position)
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."create_case_outcome"("p_commission_id" "uuid", "p_label" "text", "p_color_token" "text", "p_requires_action_plan" boolean, "p_is_adverse" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_case_tag"("p_commission_id" "uuid", "p_name" "text", "p_color_token" "text" DEFAULT 'muted'::"text") RETURNS "public"."case_tags"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_result public.case_tags;
begin
  perform app.assert_extras_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'informe o nome da etiqueta' using errcode = 'check_violation';
  end if;

  insert into public.case_tags (commission_id, name, color_token)
  values (p_commission_id, btrim(p_name), p_color_token)
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."create_case_tag"("p_commission_id" "uuid", "p_name" "text", "p_color_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_process_template"("p_commission_id" "uuid", "p_title" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS "public"."process_templates"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_result public.process_templates;
begin
  perform app.assert_cases_enabled();

  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe o título do processo' using errcode = 'check_violation';
  end if;

  -- RLS (process_templates staff_admin-write) authorizes the insert.
  insert into public.process_templates (commission_id, title, description, created_by)
  values (p_commission_id, btrim(p_title), nullif(btrim(p_description), ''), auth.uid())
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."create_process_template"("p_commission_id" "uuid", "p_title" "text", "p_description" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_case_detail"("p_case_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_case public.cases;
  v_outcome jsonb;
  v_is_coordinator boolean;
  v_result jsonb;
begin
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  -- Re-gate: a coordinator OR a read-grantee OR a phase/narrative assignee (ADR
  -- 0033). With the case_access flag OFF, app.can_read_case falls back to
  -- is_member_of — BUT this DEFINER read was is_staff_admin_of-gated before, so to
  -- preserve "flag OFF ⇒ today's behavior" EXACTLY we keep the coordinator gate as
  -- the floor when the feature is dark, and broaden only when it is ON.
  if app.feature_enabled('case_access') then
    if not app.can_read_case(p_case_id, auth.uid()) then
      raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
    end if;
  else
    if not app.is_staff_admin_of(v_case.commission_id) then
      raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
    end if;
  end if;

  v_is_coordinator :=
    app.is_staff_admin_of(v_case.commission_id) or app.is_admin();

  -- AUDIT (Rule 11): a non-coordinator opening a full case detail. Mirrors
  -- response.opened_foreign — records THAT + WHO, never any body/PHI. Only emitted
  -- when the feature is on (the broadened-read scenario this audits cannot occur
  -- with the flag OFF). No-ops while audit_trail is OFF.
  if app.feature_enabled('case_access') and not v_is_coordinator then
    perform public.log_audit_access(
      'case.opened', 'case', p_case_id, v_case.commission_id,
      'Caso aberto por participante/concedido', '{}'::jsonb);
  end if;

  -- The assigned outcome, resolved LIVE (or null).
  select case when o.id is null then null else jsonb_build_object(
           'id', o.id,
           'label', o.label,
           'color_token', o.color_token,
           'requires_action_plan', o.requires_action_plan,
           'is_adverse', o.is_adverse
         ) end
    into v_outcome
  from (select v_case.outcome_id as oid) s
  left join public.case_outcomes o on o.id = s.oid;

  select jsonb_build_object(
    'id', v_case.id,
    'commission_id', v_case.commission_id,
    'template_id', v_case.template_id,
    'case_number', v_case.case_number,
    'label', v_case.label,
    'status', v_case.status,
    'outcome_id', v_case.outcome_id,
    'outcome', v_outcome,
    -- The viewer's capability descriptor (ADR 0033 D7), for auth.uid().
    'viewer_capabilities', jsonb_build_object(
      'can_read', true,  -- we only reach here if the caller may read
      'can_write_content', app.can_write_case_content(p_case_id, auth.uid()),
      'can_manage_lifecycle', v_is_coordinator
    ),
    -- The FROZEN offered set (case_offered_outcomes), resolved to label/flags.
    'offered_outcomes', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', o.id,
          'label', o.label,
          'color_token', o.color_token,
          'requires_action_plan', o.requires_action_plan,
          'is_adverse', o.is_adverse
        ) order by o.position)
       from public.case_offered_outcomes coo
       join public.case_outcomes o on o.id = coo.outcome_id
       where coo.case_id = p_case_id),
      '[]'::jsonb),
    'created_at', v_case.created_at,
    'closed_at', v_case.closed_at,
    'phases', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cp.id,
          'position', cp.position,
          'form_id', cp.form_id,
          'form_version_id', cp.form_version_id,
          'form_title', f.title,
          'title', cp.title,
          'status', cp.status,
          'recommended', cp.recommended,
          'assigned_to', cp.assigned_to,
          'assignee_name', pr.full_name,
          'is_ad_hoc', cp.is_ad_hoc,
          'blocks', cp.blocks,
          'recommend_when', cp.recommend_when,
          'due_date', cp.due_date,
          'default_due_days', cp.default_due_days,
          'display_position', coalesce(cp.display_position, cp.position),
          'response_id', sub.response_id,
          'submitted_at', sub.submitted_at
        ) order by cp.position)
       from public.case_phases cp
       join public.forms f on f.id = cp.form_id
       left join public.profiles pr on pr.id = cp.assigned_to
       left join lateral (
         select r.id as response_id, r.submitted_at
         from public.responses r
         where r.case_phase_id = cp.id
           and r.status = 'submitted'
           and cp.status = 'concluida'
         limit 1
       ) sub on true
       where cp.case_id = p_case_id),
      '[]'::jsonb),
    -- The case's NARRATIVES (ADR 0032 + 0033 attribution/lifecycle), ordered by
    -- display_position. body_md IS returned (coordinator/grantee read path); only
    -- the audit log excludes it. assigned_to/status/concluded_* are the ADR-0033
    -- additions.
    'narratives', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'id', cn.id,
          'narrative_type_id', cn.narrative_type_id,
          'type_label', cn.type_label,
          'display_position', cn.display_position,
          'title', cn.title,
          'instructions', cn.instructions,
          'is_expected', cn.is_expected,
          'body_md', cn.body_md,
          'assigned_to', cn.assigned_to,
          'assignee_name', npr.full_name,
          'status', cn.status,
          'concluded_at', cn.concluded_at,
          'concluded_by', cn.concluded_by,
          'updated_at', cn.updated_at
        ) order by cn.display_position)
       from public.case_narratives cn
       left join public.profiles npr on npr.id = cn.assigned_to
       where cn.case_id = p_case_id),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."get_case_detail"("p_case_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."grant_case_access"("p_case" "uuid", "p_user" "uuid", "p_level" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
begin
  perform app.assert_case_access_enabled();

  select commission_id into v_commission from public.cases where id = p_case;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_level not in ('read', 'write') then
    raise exception 'nível de acesso inválido' using errcode = 'check_violation';
  end if;
  -- The grantee must be a current member of the case's commission (HC021).
  if not app.is_member_of_for(v_commission, p_user) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  insert into public.case_access (case_id, user_id, level, granted_by, granted_at)
  values (p_case, p_user, p_level, auth.uid(), now())
  on conflict (case_id, user_id)
  do update set level = excluded.level, granted_by = excluded.granted_by,
                granted_at = excluded.granted_at;
end;
$$;

ALTER FUNCTION "public"."grant_case_access"("p_case" "uuid", "p_user" "uuid", "p_level" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."list_cases_board"("p_commission_id" "uuid") RETURNS TABLE("case_id" "uuid", "case_number" integer, "label" "text", "status" "text", "outcome_id" "uuid", "outcome" "jsonb", "created_at" timestamp with time zone, "closed_at" timestamp with time zone, "phases" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin
  if not app.is_staff_admin_of(p_commission_id) then
    return;
  end if;

  return query
  select c.id,
         c.case_number,
         c.label,
         c.status,
         c.outcome_id,
         case when o.id is null then null else jsonb_build_object(
           'id', o.id,
           'label', o.label,
           'color_token', o.color_token,
           'requires_action_plan', o.requires_action_plan,
           'is_adverse', o.is_adverse
         ) end as outcome,
         c.created_at,
         c.closed_at,
         coalesce(
           (select jsonb_agg(jsonb_build_object(
               'position', cp.position,
               'title', cp.title,
               'status', cp.status,
               'recommended', cp.recommended,
               'assigned_to', cp.assigned_to,
               'assignee_name', pr.full_name,
               'due_date', cp.due_date
             ) order by cp.position)
            from public.case_phases cp
            left join public.profiles pr on pr.id = cp.assigned_to
            where cp.case_id = c.id),
           '[]'::jsonb) as phases
  from public.cases c
  left join public.case_outcomes o on o.id = c.outcome_id
  where c.commission_id = p_commission_id
  order by c.case_number desc;
end;
$$;

ALTER FUNCTION "public"."list_cases_board"("p_commission_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."list_my_cases"("p_commission" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  perform app.assert_case_access_enabled();

  if v_uid is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(row_obj order by created_at desc, case_number desc), '[]'::jsonb)
    into v_result
  from (
    select
      c.id,
      c.created_at,
      c.case_number,
      jsonb_build_object(
        'case_id', c.id,
        'case_number', c.case_number,
        'label', c.label,
        'status', c.status,
        'my_role',
          case
            when app.is_staff_admin_of_for(c.commission_id, v_uid)
                 or app.is_admin_for(v_uid) then 'coordinator'
            when exists (
              select 1 from public.case_access ca
              where ca.case_id = c.id and ca.user_id = v_uid and ca.level = 'write'
            ) then 'collaborator'
            else 'viewer'
          end,
        'items', (
          select coalesce(jsonb_agg(item order by display_position), '[]'::jsonb)
          from (
            -- the caller's PHASES of this case
            select
              coalesce(cp.display_position, cp.position) as display_position,
              jsonb_build_object(
                'kind', 'phase',
                'id', cp.id,
                'title', coalesce(nullif(btrim(cp.title), ''), f.title, 'Fase ' || cp.position),
                'status', cp.status,
                'display_position', coalesce(cp.display_position, cp.position),
                'actionable', (cp.status = 'ativa')
              ) as item
            from public.case_phases cp
            join public.forms f on f.id = cp.form_id
            where cp.case_id = c.id and cp.assigned_to = v_uid
            union all
            -- the caller's NARRATIVES of this case
            select
              cn.display_position,
              jsonb_build_object(
                'kind', 'narrative',
                'id', cn.id,
                'title', cn.type_label,
                'status', cn.status,
                'display_position', cn.display_position,
                'actionable', (cn.status = 'aberta')
              ) as item
            from public.case_narratives cn
            where cn.case_id = c.id and cn.assigned_to = v_uid
          ) items
        )
      ) as row_obj
    from public.cases c
    where c.commission_id = p_commission
      -- "Meus Casos" is the caller's PERSONAL list: cases they are attributed to
      -- (phase/narrative assignee) OR granted (ADR 0033 D7). A coordinator/admin is
      -- NOT auto-included for every case (the board is their management surface) —
      -- they appear here only when personally attributed/granted, and then carry the
      -- 'coordinator' role chip.
      and (
        exists (select 1 from public.case_access ca
                where ca.case_id = c.id and ca.user_id = v_uid)
        or exists (select 1 from public.case_phases cp
                   where cp.case_id = c.id and cp.assigned_to = v_uid)
        or exists (select 1 from public.case_narratives cn
                   where cn.case_id = c.id and cn.assigned_to = v_uid)
      )
  ) rows;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."list_my_cases"("p_commission" "uuid") OWNER TO "postgres";

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

  update public.process_templates
  set status = 'active', updated_at = now()
  where id = p_template_id
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."publish_process_template"("p_template_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reassign_phase"("p_case_phase_id" "uuid", "p_new_assignee" "uuid", "p_due_date" "date" DEFAULT NULL::"date") RETURNS "public"."case_phases"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_case_status text;
  v_commission_id uuid;
  v_has_response boolean;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select c.status, c.commission_id
    into v_case_status, v_commission_id
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_commission_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;

  select exists (
    select 1 from public.responses where case_phase_id = p_case_phase_id
  ) into v_has_response;
  if v_has_response then
    raise exception 'não é possível redefinir o responsável após o início do preenchimento'
      using errcode = 'HC019';
  end if;

  if not app.is_member_of_for(v_commission_id, p_new_assignee) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set assigned_to = p_new_assignee,
      due_date = p_due_date,
      updated_at = now()
  where id = p_case_phase_id
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."reassign_phase"("p_case_phase_id" "uuid", "p_new_assignee" "uuid", "p_due_date" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."recompute_recommendations"("p_case_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  r record;
  v_source_phase_id uuid;
  v_answers jsonb;
  v_should boolean;
begin
  perform set_config('app.in_case_rpc', 'on', true);

  for r in
    select id, position, recommend_when
    from public.case_phases
    where case_id = p_case_id
      and status = 'pendente'
      and recommend_when is not null
  loop
    -- Resolve from_phase (a case-phase position) to the source phase id.
    select id into v_source_phase_id
    from public.case_phases
    where case_id = p_case_id
      and position = (r.recommend_when ->> 'from_phase')::integer;

    if v_source_phase_id is null then
      -- Dangling reference (should not happen post-snapshot validation); treat
      -- as "no source data" -> empty map.
      v_answers := '{}'::jsonb;
    else
      v_answers := app.case_phase_answer_map(v_source_phase_id);
    end if;

    -- Strip the qualifier; the remainder is a plain visible_when the UNCHANGED
    -- evaluator accepts.
    v_should := app.eval_condition(r.recommend_when - 'from_phase', v_answers);

    update public.case_phases
    set recommended = v_should, updated_at = now()
    where id = r.id
      and recommended is distinct from v_should;
  end loop;

  perform set_config('app.in_case_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."recompute_recommendations"("p_case_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."remove_template_narrative"("p_narrative_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_template_id uuid;
  v_display_position integer;
  v_status text;
begin
  perform app.assert_narratives_enabled();

  select n.template_id, n.display_position, t.status
    into v_template_id, v_display_position, v_status
  from public.process_template_narratives n
  join public.process_templates t on t.id = n.template_id
  where n.id = p_narrative_id;

  if v_template_id is null then
    raise exception 'narrativa % não encontrada', p_narrative_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  delete from public.process_template_narratives where id = p_narrative_id;

  -- Shift the tail of BOTH tables down by one. The deferrable display_position
  -- uniques tolerate any transient duplicate within each statement.
  update public.process_template_narratives
  set display_position = display_position - 1
  where template_id = v_template_id and display_position > v_display_position;

  update public.process_template_phases
  set display_position = display_position - 1
  where template_id = v_template_id and display_position > v_display_position;
end;
$$;

ALTER FUNCTION "public"."remove_template_narrative"("p_narrative_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."remove_template_phase"("p_phase_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_template_id uuid;
  v_position integer;
  v_status text;
  r record;
begin
  perform app.assert_cases_enabled();

  select ph.template_id, ph.position, t.status
    into v_template_id, v_position, v_status
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

  -- A later slot recommending FROM this position would dangle.
  if exists (
    select 1 from public.process_template_phases
    where template_id = v_template_id
      and recommend_when is not null
      and (recommend_when ->> 'from_phase')::integer = v_position
  ) then
    raise exception
      'não é possível remover a fase %: outra fase a usa como condição de recomendação',
      v_position
      using errcode = 'HC016';
  end if;

  -- A slot whose blocks reference this position would dangle.
  if exists (
    select 1 from public.process_template_phases
    where template_id = v_template_id
      and blocks @> array[v_position]
  ) then
    raise exception
      'não é possível remover a fase %: outra fase a tem como bloqueio',
      v_position
      using errcode = 'HC016';
  end if;

  delete from public.process_template_phases where id = p_phase_id;

  -- Renumber the tail AND shift the blocks references in a SINGLE UPDATE per row,
  -- so the BEFORE-UPDATE shape trigger (blocks <@ [1, position-1]) always sees a
  -- CONSISTENT row: position is decremented by one and, simultaneously, every
  -- blocks element > v_position drops by one (a block at v_position can't exist —
  -- we rejected a referenced position above). Splitting these into two UPDATEs
  -- would expose a transient state (shifted position, un-shifted blocks) that the
  -- shape trigger would reject as a forward reference.
  update public.process_template_phases
  set position = position - 1,
      blocks = (
        select coalesce(array_agg(
                 (case when b > v_position then b - 1 else b end)
                 order by (case when b > v_position then b - 1 else b end)), '{}')
        from unnest(blocks) as b
      )
  where template_id = v_template_id and position > v_position;

  -- Re-validate remaining recommend_whens AND blocks against the new numbering.
  for r in
    select position, recommend_when, blocks
    from public.process_template_phases
    where template_id = v_template_id
  loop
    if r.recommend_when is not null then
      perform app.validate_template_recommend_when(v_template_id, r.position, r.recommend_when);
    end if;
    perform app.validate_template_phase_blocks(v_template_id, r.position, r.blocks);
  end loop;
end;
$$;

ALTER FUNCTION "public"."remove_template_phase"("p_phase_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."rename_case_tag"("p_tag_id" "uuid", "p_name" "text", "p_color_token" "text") RETURNS "public"."case_tags"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.case_tags;
begin
  perform app.assert_extras_enabled();

  select commission_id into v_commission_id from public.case_tags where id = p_tag_id;
  if v_commission_id is null then
    raise exception 'etiqueta não encontrada' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'informe o nome da etiqueta' using errcode = 'check_violation';
  end if;

  update public.case_tags
  set name = btrim(p_name), color_token = p_color_token
  where id = p_tag_id
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."rename_case_tag"("p_tag_id" "uuid", "p_name" "text", "p_color_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reopen_narrative"("p_narrative" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
  v_case_status text;
  v_status text;
begin
  perform app.assert_case_access_enabled();

  select c.commission_id, c.status, cn.status
    into v_commission, v_case_status, v_status
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_status is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;
  if v_status <> 'concluida' then
    raise exception 'a narrativa não está no estado necessário para esta ação'
      using errcode = 'HC055';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives
  set status = 'aberta', concluded_at = null, concluded_by = null, updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."reopen_narrative"("p_narrative" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reorder_case_layout_template"("p_template_id" "uuid", "p_ordered" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_expected integer;
  v_supplied integer;
  v_matched integer;
begin
  perform app.assert_narratives_enabled();

  select status into v_status from public.process_templates where id = p_template_id;
  if v_status is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  if p_ordered is null or jsonb_typeof(p_ordered) <> 'array' then
    raise exception 'a ordem informada é inválida' using errcode = 'HC054';
  end if;

  -- The COMPLETE set = every phase + every narrative of the template.
  select
    (select count(*) from public.process_template_phases where template_id = p_template_id)
    + (select count(*) from public.process_template_narratives where template_id = p_template_id)
    into v_expected;

  select count(*) into v_supplied
  from jsonb_array_elements(p_ordered) as e
  where e ->> 'kind' in ('phase', 'narrative') and (e ->> 'id') is not null;

  if v_supplied <> v_expected then
    raise exception
      'a ordem informada está incompleta (esperado %, recebido %)', v_expected, v_supplied
      using errcode = 'HC054';
  end if;

  -- Renumber phases 1..N from the ordinal of their {kind:'phase',id} entry. Each
  -- statement only touches rows whose id actually belongs to this template, so a
  -- spoofed id simply matches nothing.
  with ord as (
    select (e ->> 'id')::uuid as id, e ->> 'kind' as kind, n::integer as pos
    from jsonb_array_elements(p_ordered) with ordinality as t(e, n)
  )
  update public.process_template_phases ph
  set display_position = o.pos
  from ord o
  where o.kind = 'phase' and ph.id = o.id and ph.template_id = p_template_id;

  with ord as (
    select (e ->> 'id')::uuid as id, e ->> 'kind' as kind, n::integer as pos
    from jsonb_array_elements(p_ordered) with ordinality as t(e, n)
  )
  update public.process_template_narratives nr
  set display_position = o.pos
  from ord o
  where o.kind = 'narrative' and nr.id = o.id and nr.template_id = p_template_id;

  -- Belt-and-suspenders: confirm every supplied entry matched a row of this
  -- template (rejects a complete-count set that references foreign/garbage ids).
  with ord as (
    select (e ->> 'id')::uuid as id, e ->> 'kind' as kind
    from jsonb_array_elements(p_ordered) as e
    where e ->> 'kind' in ('phase', 'narrative') and (e ->> 'id') is not null
  )
  select count(*) into v_matched
  from ord o
  where exists (
    select 1 from public.process_template_phases ph
    where ph.id = o.id and ph.template_id = p_template_id and o.kind = 'phase'
  ) or exists (
    select 1 from public.process_template_narratives nr
    where nr.id = o.id and nr.template_id = p_template_id and o.kind = 'narrative'
  );

  if v_matched <> v_expected then
    raise exception 'a ordem informada referencia itens inválidos' using errcode = 'HC054';
  end if;
end;
$$;

ALTER FUNCTION "public"."reorder_case_layout_template"("p_template_id" "uuid", "p_ordered" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reorder_case_narrative_types"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_narratives_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.case_narrative_types d
  set position = o.ord
  from (
    select id, ordinality::integer as ord
    from unnest(p_ordered_ids) with ordinality as t(id, ordinality)
  ) o
  where d.commission_id = p_commission_id and d.id = o.id;
end;
$$;

ALTER FUNCTION "public"."reorder_case_narrative_types"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reorder_case_outcomes"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_extras_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.case_outcomes d
  set position = o.ord, updated_at = now()
  from (
    select id, ordinality::integer as ord
    from unnest(p_ordered_ids) with ordinality as t(id, ordinality)
  ) o
  where d.commission_id = p_commission_id and d.id = o.id;
end;
$$;

ALTER FUNCTION "public"."reorder_case_outcomes"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reorder_template_phase"("p_phase_id" "uuid", "p_direction" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_template_id uuid;
  v_position integer;
  v_status text;
  v_neighbor_id uuid;
  v_neighbor_position integer;
  r record;
begin
  perform app.assert_cases_enabled();

  if p_direction not in ('up', 'down') then
    raise exception 'direção inválida: %', p_direction using errcode = 'check_violation';
  end if;

  select ph.template_id, ph.position, t.status
    into v_template_id, v_position, v_status
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

  if p_direction = 'up' then
    select id, position into v_neighbor_id, v_neighbor_position
    from public.process_template_phases
    where template_id = v_template_id and position < v_position
    order by position desc limit 1;
  else
    select id, position into v_neighbor_id, v_neighbor_position
    from public.process_template_phases
    where template_id = v_template_id and position > v_position
    order by position asc limit 1;
  end if;

  if v_neighbor_id is null then
    return;  -- boundary
  end if;

  -- Swap the two positions AND value-swap the blocks references in a SINGLE
  -- UPDATE over EVERY row of the template, so the BEFORE-UPDATE shape trigger
  -- always sees a CONSISTENT row. A row's position is swapped only for the two
  -- moving slots (else it keeps its current position); its blocks have any element
  -- equal to one swapped position rewritten to the other (applied to all rows).
  -- Splitting position-swap and blocks-remap into two UPDATEs would expose a
  -- transient state (swapped position, un-swapped blocks) the shape trigger could
  -- reject as a forward reference.
  update public.process_template_phases
  set position = case id
                   when p_phase_id then v_neighbor_position
                   when v_neighbor_id then v_position
                   else position
                 end,
      blocks = (
        select coalesce(array_agg(
                 case b
                   when v_position then v_neighbor_position
                   when v_neighbor_position then v_position
                   else b
                 end
                 order by case b
                   when v_position then v_neighbor_position
                   when v_neighbor_position then v_position
                   else b
                 end), '{}')
        from unnest(blocks) as b
      )
  where template_id = v_template_id;

  -- Re-validate every recommend_when AND blocks after the renumber.
  for r in
    select position, recommend_when, blocks
    from public.process_template_phases
    where template_id = v_template_id
  loop
    if r.recommend_when is not null then
      perform app.validate_template_recommend_when(v_template_id, r.position, r.recommend_when);
    end if;
    perform app.validate_template_phase_blocks(v_template_id, r.position, r.blocks);
  end loop;
end;
$$;

ALTER FUNCTION "public"."reorder_template_phase"("p_phase_id" "uuid", "p_direction" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."revoke_case_access"("p_case" "uuid", "p_user" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission uuid;
begin
  perform app.assert_case_access_enabled();

  select commission_id into v_commission from public.cases where id = p_case;
  if v_commission is null then
    raise exception 'caso % não encontrado', p_case using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  delete from public.case_access where case_id = p_case and user_id = p_user;
end;
$$;

ALTER FUNCTION "public"."revoke_case_access"("p_case" "uuid", "p_user" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."save_narrative_body"("p_narrative" "uuid", "p_body_md" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case_status text;
  v_status text;
begin
  perform app.assert_case_access_enabled();

  select c.status, cn.status into v_case_status, v_status
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_status is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  -- Q14 write predicate (the authority).
  if not app.can_write_case_narrative(p_narrative, auth.uid()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'as narrativas deste caso estão bloqueadas' using errcode = 'HC054';
  end if;
  if v_status <> 'aberta' then
    raise exception 'a narrativa não está no estado necessário para esta ação'
      using errcode = 'HC055';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives set body_md = p_body_md, updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."save_narrative_body"("p_narrative" "uuid", "p_body_md" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_case_outcome"("p_case_id" "uuid", "p_outcome_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."cases"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_status text;
  v_result public.cases;
begin
  perform app.assert_extras_enabled();

  select commission_id, status into v_commission_id, v_status
  from public.cases where id = p_case_id;
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC025';
  end if;

  -- A non-null outcome must be one this case's process OFFERED (frozen set).
  if p_outcome_id is not null and not exists (
    select 1 from public.case_offered_outcomes
    where case_id = p_case_id and outcome_id = p_outcome_id
  ) then
    raise exception 'este desfecho não está disponível para este caso'
      using errcode = 'HC029';
  end if;

  update public.cases
  set outcome_id = p_outcome_id
  where id = p_case_id
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."set_case_outcome"("p_case_id" "uuid", "p_outcome_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_process_outcomes"("p_template_id" "uuid", "p_outcome_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_status text;
begin
  perform app.assert_extras_enabled();

  select commission_id, status into v_commission_id, v_status
  from public.process_templates where id = p_template_id;
  if v_commission_id is null then
    raise exception 'processo % não encontrado', p_template_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  delete from public.process_template_outcomes where template_id = p_template_id;

  insert into public.process_template_outcomes (template_id, outcome_id, position)
  select p_template_id, oid, ord::integer
  from unnest(p_outcome_ids) with ordinality as t(oid, ord);
end;
$$;

ALTER FUNCTION "public"."set_process_outcomes"("p_template_id" "uuid", "p_outcome_ids" "uuid"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_template_phase_blocks"("p_phase_id" "uuid", "p_blocks" integer[]) RETURNS "public"."process_template_phases"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_template_id uuid;
  v_position integer;
  v_status text;
  v_blocks integer[];
  v_result public.process_template_phases;
begin
  perform app.assert_cases_enabled();

  select ph.template_id, ph.position, t.status
    into v_template_id, v_position, v_status
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

  -- Normalise: drop nulls + dups, sort ascending (stable storage).
  v_blocks := coalesce(
    (select array_agg(distinct b order by b)
     from unnest(p_blocks) as b
     where b is not null),
    '{}');

  perform app.validate_template_phase_blocks(v_template_id, v_position, v_blocks);

  update public.process_template_phases
  set blocks = v_blocks
  where id = p_phase_id
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."set_template_phase_blocks"("p_phase_id" "uuid", "p_blocks" integer[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."skip_phase"("p_case_phase_id" "uuid") RETURNS "public"."case_phases"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_case_id uuid;
  v_status text;
  v_case_status text;
  v_result public.case_phases;
begin
  perform app.assert_cases_enabled();

  select cp.case_id, cp.status, c.status
    into v_case_id, v_status, v_case_status
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_case_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso não está aberto' using errcode = 'HC020';
  end if;
  if v_status <> 'pendente' then
    raise exception 'apenas fases pendentes podem ser marcadas como não necessárias'
      using errcode = 'HC019';
  end if;

  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'nao_necessaria', skipped_at = now(), updated_at = now()
  where id = p_case_phase_id
  returning * into v_result;
  perform set_config('app.in_case_rpc', 'off', true);

  perform public.recompute_recommendations(v_case_id);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."skip_phase"("p_case_phase_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."start_or_resume_phase"("p_case_phase_id" "uuid") RETURNS "public"."responses"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_assigned_to uuid;
  v_version_id uuid;
  v_commission_id uuid;
  v_uid uuid := auth.uid();
  v_result public.responses;
begin
  perform app.assert_cases_enabled();

  select cp.status, cp.assigned_to, cp.form_version_id, c.commission_id
    into v_status, v_assigned_to, v_version_id, v_commission_id
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = p_case_phase_id;

  if v_version_id is null then
    raise exception 'fase % não encontrada', p_case_phase_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'ativa' then
    raise exception 'esta fase não está ativa' using errcode = 'HC019';
  end if;
  if v_assigned_to is distinct from v_uid then
    raise exception 'apenas o responsável pode preencher esta fase' using errcode = 'HC022';
  end if;

  -- Resume the phase's existing response (any status; a submitted one is handed
  -- back read-only by the wizard).
  select * into v_result
  from public.responses where case_phase_id = p_case_phase_id;
  if v_result.id is not null then
    return v_result;
  end if;

  -- Create. NOTE: we pin v_version_id WITHOUT the published-only backstop — the
  -- snapshot may now be archived.
  begin
    insert into public.responses (form_version_id, commission_id, created_by, status, case_phase_id)
    values (v_version_id, v_commission_id, v_uid, 'in_progress', p_case_phase_id)
    returning * into v_result;
  exception
    when unique_violation then
      select * into v_result
      from public.responses where case_phase_id = p_case_phase_id;
  end;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."start_or_resume_phase"("p_case_phase_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."sync_case_phase_on_submit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_case_id uuid;
  v_case_status text;
begin
  -- Only react to a phase response transitioning to submitted.
  if new.case_phase_id is null
     or new.status <> 'submitted'
     or old.status = 'submitted' then
    return new;
  end if;

  select cp.case_id, c.status
    into v_case_id, v_case_status
  from public.case_phases cp
  join public.cases c on c.id = cp.case_id
  where cp.id = new.case_phase_id;

  -- Stranded draft on a TERMINAL case: leave the phase as-is (inert).
  if v_case_status in ('concluido', 'cancelado') then
    return new;
  end if;

  -- Advance the phase under our OWN session flag (submit_response only set
  -- app.in_submit_rpc, which the phase guard does not honour). The phase UPDATE
  -- fires recompute_case_status_trg while this flag is on -> the macro status
  -- auto-advances.
  perform set_config('app.in_case_rpc', 'on', true);
  update public.case_phases
  set status = 'concluida', completed_at = now(), updated_at = now()
  where id = new.case_phase_id and status = 'ativa';
  perform set_config('app.in_case_rpc', 'off', true);

  -- Recompute downstream recommendations against the newly-submitted answers.
  perform public.recompute_recommendations(v_case_id);

  return new;
end;
$$;

ALTER FUNCTION "public"."sync_case_phase_on_submit"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."unassign_case_tag"("p_case_id" "uuid", "p_tag_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
begin
  perform app.assert_extras_enabled();

  v_commission_id := app.commission_of_case(p_case_id);
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  if not app.can_write_case_content(p_case_id, auth.uid()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  delete from public.case_tag_assignments
  where case_id = p_case_id and tag_id = p_tag_id;
end;
$$;

ALTER FUNCTION "public"."unassign_case_tag"("p_case_id" "uuid", "p_tag_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."unassign_narrative"("p_narrative" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case_id uuid;
  v_commission uuid;
  v_case_status text;
begin
  perform app.assert_case_access_enabled();

  select cn.case_id, c.commission_id, c.status
    into v_case_id, v_commission, v_case_status
  from public.case_narratives cn
  join public.cases c on c.id = cn.case_id
  where cn.id = p_narrative;

  if v_case_id is null then
    raise exception 'narrativa % não encontrada', p_narrative using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_case_status in ('concluido', 'cancelado') then
    raise exception 'este caso está em um estado final e não pode mais ser alterado'
      using errcode = 'HC020';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives set assigned_to = null, updated_by = auth.uid()
  where id = p_narrative;
  perform set_config('app.in_narrative_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."unassign_narrative"("p_narrative" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_action_item"("p_action_item_id" "uuid", "p_title" "text", "p_description" "text" DEFAULT NULL::"text", "p_assigned_to" "uuid" DEFAULT NULL::"uuid", "p_due_date" "date" DEFAULT NULL::"date") RETURNS "public"."case_action_items"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case_id uuid;
  v_commission_id uuid;
  v_result public.case_action_items;
begin
  perform app.assert_extras_enabled();

  select case_id into v_case_id from public.case_action_items where id = p_action_item_id;
  if v_case_id is null then
    raise exception 'item % não encontrado', p_action_item_id using errcode = 'no_data_found';
  end if;
  v_commission_id := app.commission_of_case(v_case_id);
  if not app.can_write_case_content(v_case_id, auth.uid()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe o título do item' using errcode = 'check_violation';
  end if;
  if p_assigned_to is not null and not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  update public.case_action_items
  set title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      assigned_to = p_assigned_to,
      due_date = p_due_date,
      updated_at = now()
  where id = p_action_item_id
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_action_item"("p_action_item_id" "uuid", "p_title" "text", "p_description" "text", "p_assigned_to" "uuid", "p_due_date" "date") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."case_narratives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "narrative_type_id" "uuid",
    "type_label" "text" NOT NULL,
    "display_position" integer NOT NULL,
    "title" "text",
    "instructions" "text",
    "is_expected" boolean DEFAULT false NOT NULL,
    "body_md" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "assigned_to" "uuid",
    "status" "text" DEFAULT 'aberta'::"text" NOT NULL,
    "concluded_at" timestamp with time zone,
    "concluded_by" "uuid",
    CONSTRAINT "case_narratives_status_check" CHECK (("status" = ANY (ARRAY['aberta'::"text", 'concluida'::"text"]))),
    CONSTRAINT "case_narratives_type_label_not_blank" CHECK (("btrim"("type_label") <> ''::"text"))
);

ALTER TABLE "public"."case_narratives" OWNER TO "postgres";

-- WS B (ADR 0030/0031): the case narrative body is PHI-BEARING free text — a clinical
-- case narrative can name/describe patients. RLS-scoped read; the detail-open is
-- ALREADY audited via case.opened in get_case_detail (NOT a separate .viewed verb —
-- no duplication); never copied into the audit log (Rule 11); treat as PHI on
-- surveyor/evidence export (Phase 19).
COMMENT ON COLUMN "public"."case_narratives"."body_md" IS 'PHI-BEARING free text (WS B; Rule 11/12). Case narrative prose (sanitized Markdown, Rule 7); detail-open audited via case.opened; never copied into the audit log.';

CREATE OR REPLACE FUNCTION "public"."update_case_narrative_body"("p_narrative_id" "uuid", "p_body_md" "text") RETURNS "public"."case_narratives"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case_id uuid;
  v_commission_id uuid;
  v_status text;
  v_result public.case_narratives;
begin
  perform app.assert_narratives_enabled();

  select n.case_id, c.commission_id, c.status
    into v_case_id, v_commission_id, v_status
  from public.case_narratives n
  join public.cases c on c.id = n.case_id
  where n.id = p_narrative_id;

  if v_case_id is null then
    raise exception 'narrativa % não encontrada', p_narrative_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status in ('concluido', 'cancelado') then
    raise exception 'as narrativas deste caso estão bloqueadas' using errcode = 'HC054';
  end if;

  perform set_config('app.in_narrative_rpc', 'on', true);
  update public.case_narratives
  set body_md = p_body_md, updated_by = auth.uid()
  where id = p_narrative_id
  returning * into v_result;
  perform set_config('app.in_narrative_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_case_narrative_body"("p_narrative_id" "uuid", "p_body_md" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_case_narrative_type"("p_narrative_type_id" "uuid", "p_label" "text", "p_description" "text") RETURNS "public"."case_narrative_types"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.case_narrative_types;
begin
  perform app.assert_narratives_enabled();

  select commission_id into v_commission_id
  from public.case_narrative_types where id = p_narrative_type_id;
  if v_commission_id is null then
    raise exception 'narrativa não encontrada' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_label), '') is null then
    raise exception 'informe o nome da narrativa' using errcode = 'check_violation';
  end if;

  update public.case_narrative_types
  set label = btrim(p_label),
      description = nullif(btrim(p_description), '')
  where id = p_narrative_type_id
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_case_narrative_type"("p_narrative_type_id" "uuid", "p_label" "text", "p_description" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_case_outcome"("p_outcome_id" "uuid", "p_label" "text", "p_color_token" "text", "p_requires_action_plan" boolean, "p_is_adverse" boolean) RETURNS "public"."case_outcomes"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.case_outcomes;
begin
  perform app.assert_extras_enabled();

  select commission_id into v_commission_id
  from public.case_outcomes where id = p_outcome_id;
  if v_commission_id is null then
    raise exception 'desfecho não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_label), '') is null then
    raise exception 'informe o nome do desfecho' using errcode = 'check_violation';
  end if;

  update public.case_outcomes
  set label = btrim(p_label),
      color_token = p_color_token,
      requires_action_plan = coalesce(p_requires_action_plan, false),
      is_adverse = coalesce(p_is_adverse, false),
      updated_at = now()
  where id = p_outcome_id
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_case_outcome"("p_outcome_id" "uuid", "p_label" "text", "p_color_token" "text", "p_requires_action_plan" boolean, "p_is_adverse" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_template_narrative"("p_narrative_id" "uuid", "p_title" "text" DEFAULT NULL::"text", "p_instructions" "text" DEFAULT NULL::"text", "p_is_expected" boolean DEFAULT NULL::boolean, "p_clear_title" boolean DEFAULT false, "p_clear_instructions" boolean DEFAULT false) RETURNS "public"."process_template_narratives"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_template_id uuid;
  v_status text;
  v_result public.process_template_narratives;
begin
  perform app.assert_narratives_enabled();

  select n.template_id, t.status
    into v_template_id, v_status
  from public.process_template_narratives n
  join public.process_templates t on t.id = n.template_id
  where n.id = p_narrative_id;

  if v_template_id is null then
    raise exception 'narrativa % não encontrada', p_narrative_id using errcode = 'no_data_found';
  end if;
  if v_status <> 'draft' then
    raise exception 'apenas processos em rascunho podem ser editados'
      using errcode = 'check_violation';
  end if;

  update public.process_template_narratives
  set title = case
                when p_clear_title then null
                when p_title is null then title
                else nullif(btrim(p_title), '')
              end,
      instructions = case
                       when p_clear_instructions then null
                       when p_instructions is null then instructions
                       else nullif(btrim(p_instructions), '')
                     end,
      is_expected = coalesce(p_is_expected, is_expected)
  where id = p_narrative_id
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_template_narrative"("p_narrative_id" "uuid", "p_title" "text", "p_instructions" "text", "p_is_expected" boolean, "p_clear_title" boolean, "p_clear_instructions" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_template_phase"("p_phase_id" "uuid", "p_form_id" "uuid" DEFAULT NULL::"uuid", "p_title" "text" DEFAULT NULL::"text", "p_recommend_when" "jsonb" DEFAULT NULL::"jsonb", "p_clear_recommend_when" boolean DEFAULT false, "p_default_due_days" integer DEFAULT NULL::integer, "p_clear_default_due_days" boolean DEFAULT false, "p_blocks" integer[] DEFAULT NULL::integer[], "p_clear_blocks" boolean DEFAULT false) RETURNS "public"."process_template_phases"
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

  -- Determine the final recommend_when: clear, replace, or keep.
  if p_clear_recommend_when then
    v_new_recommend := null;
  elsif p_recommend_when is not null then
    v_new_recommend := p_recommend_when;
  else
    select recommend_when into v_new_recommend
    from public.process_template_phases where id = p_phase_id;
  end if;

  -- Determine the final default_due_days with the SAME clear/replace/keep logic.
  if p_clear_default_due_days then
    v_new_due_days := null;
  elsif p_default_due_days is not null then
    v_new_due_days := p_default_due_days;
  else
    select default_due_days into v_new_due_days
    from public.process_template_phases where id = p_phase_id;
  end if;

  -- Determine the final blocks with clear/replace/keep (normalise on replace).
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

  update public.process_template_phases
  set form_id = coalesce(p_form_id, form_id),
      title = case when p_title is null then title else nullif(btrim(p_title), '') end,
      recommend_when = v_new_recommend,
      default_due_days = v_new_due_days,
      blocks = v_new_blocks
  where id = p_phase_id
  returning * into v_result;

  perform app.validate_template_recommend_when(v_template_id, v_position, v_new_recommend);
  perform app.validate_template_phase_blocks(v_template_id, v_position, v_new_blocks);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_template_phase"("p_phase_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_clear_recommend_when" boolean, "p_default_due_days" integer, "p_clear_default_due_days" boolean, "p_blocks" integer[], "p_clear_blocks" boolean) OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."case_access" (
    "case_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "level" "text" NOT NULL,
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "case_access_level_check" CHECK (("level" = ANY (ARRAY['read'::"text", 'write'::"text"])))
);

ALTER TABLE "public"."case_access" OWNER TO "postgres";

COMMENT ON TABLE "public"."case_access" IS 'Per-case ACL (ADR 0033 D6). One (case,user) grant; level write implies read. Attribution-derived read is NOT stored here — it is computed in app.can_read_case. Writes via grant_case_access / revoke_case_access (DEFINER) only; no INSERT/UPDATE/DELETE policy.';

CREATE TABLE IF NOT EXISTS "public"."case_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "doc_type" "text" DEFAULT 'other'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "storage_path" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" bigint,
    "occurred_at" "date",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "case_documents_doc_type_check" CHECK (("doc_type" = ANY (ARRAY['ata'::"text", 'digitalizacao'::"text", 'registro'::"text", 'other'::"text"]))),
    CONSTRAINT "case_documents_size_nonneg" CHECK ((("size_bytes" IS NULL) OR ("size_bytes" >= 0))),
    CONSTRAINT "case_documents_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);

ALTER TABLE "public"."case_documents" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."case_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "case_id" "uuid" NOT NULL,
    "kind" "text" DEFAULT 'note'::"text" NOT NULL,
    "title" "text",
    "body" "text" NOT NULL,
    "occurred_at" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "case_events_body_not_blank" CHECK (("btrim"("body") <> ''::"text")),
    CONSTRAINT "case_events_kind_check" CHECK (("kind" = ANY (ARRAY['note'::"text", 'meeting'::"text", 'decision'::"text", 'interview'::"text", 'safety_event'::"text", 'other'::"text"])))
);

ALTER TABLE "public"."case_events" OWNER TO "postgres";

-- WS B (ADR 0030/0031): the case-event body is PHI-BEARING free text — a working note
-- can name/describe patients. RLS-scoped read; the case detail-open is ALREADY
-- audited via case.opened (listCaseEvents is read on the case page — NOT a separate
-- .viewed verb); never copied into the audit log (Rule 11); treat as PHI on
-- surveyor/evidence export (Phase 19).
COMMENT ON COLUMN "public"."case_events"."body" IS 'PHI-BEARING free text (WS B; Rule 11/12). Case-event working-note body; detail-open audited via case.opened; never copied into the audit log.';

CREATE TABLE IF NOT EXISTS "public"."case_offered_outcomes" (
    "case_id" "uuid" NOT NULL,
    "outcome_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."case_offered_outcomes" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."case_tag_assignments" (
    "case_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."case_tag_assignments" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."process_template_outcomes" (
    "template_id" "uuid" NOT NULL,
    "outcome_id" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."process_template_outcomes" OWNER TO "postgres";

ALTER TABLE ONLY "public"."case_access"
    ADD CONSTRAINT "case_access_pkey" PRIMARY KEY ("case_id", "user_id");

ALTER TABLE ONLY "public"."case_action_items"
    ADD CONSTRAINT "case_action_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."case_documents"
    ADD CONSTRAINT "case_documents_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."case_documents"
    ADD CONSTRAINT "case_documents_storage_path_key" UNIQUE ("storage_path");

ALTER TABLE ONLY "public"."case_events"
    ADD CONSTRAINT "case_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."case_narrative_types"
    ADD CONSTRAINT "case_narrative_types_commission_label_key" UNIQUE ("commission_id", "label");

ALTER TABLE ONLY "public"."case_narrative_types"
    ADD CONSTRAINT "case_narrative_types_commission_position_key" UNIQUE ("commission_id", "position") DEFERRABLE;

ALTER TABLE ONLY "public"."case_narrative_types"
    ADD CONSTRAINT "case_narrative_types_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."case_narratives"
    ADD CONSTRAINT "case_narratives_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."case_narratives"
    ADD CONSTRAINT "case_narratives_position_key" UNIQUE ("case_id", "display_position") DEFERRABLE;

ALTER TABLE ONLY "public"."case_offered_outcomes"
    ADD CONSTRAINT "case_offered_outcomes_pkey" PRIMARY KEY ("case_id", "outcome_id");

ALTER TABLE ONLY "public"."case_outcomes"
    ADD CONSTRAINT "case_outcomes_commission_label_key" UNIQUE ("commission_id", "label");

ALTER TABLE ONLY "public"."case_outcomes"
    ADD CONSTRAINT "case_outcomes_commission_position_key" UNIQUE ("commission_id", "position") DEFERRABLE;

ALTER TABLE ONLY "public"."case_outcomes"
    ADD CONSTRAINT "case_outcomes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."case_phases"
    ADD CONSTRAINT "case_phases_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."case_phases"
    ADD CONSTRAINT "case_phases_position_key" UNIQUE ("case_id", "position");

ALTER TABLE ONLY "public"."case_tag_assignments"
    ADD CONSTRAINT "case_tag_assignments_pkey" PRIMARY KEY ("case_id", "tag_id");

ALTER TABLE ONLY "public"."case_tags"
    ADD CONSTRAINT "case_tags_commission_name_key" UNIQUE ("commission_id", "name");

ALTER TABLE ONLY "public"."case_tags"
    ADD CONSTRAINT "case_tags_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_commission_number_key" UNIQUE ("commission_id", "case_number");

ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."process_template_narratives"
    ADD CONSTRAINT "process_template_narratives_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."process_template_narratives"
    ADD CONSTRAINT "process_template_narratives_position_key" UNIQUE ("template_id", "display_position") DEFERRABLE;

ALTER TABLE ONLY "public"."process_template_outcomes"
    ADD CONSTRAINT "process_template_outcomes_pkey" PRIMARY KEY ("template_id", "outcome_id");

ALTER TABLE ONLY "public"."process_template_phases"
    ADD CONSTRAINT "process_template_phases_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."process_template_phases"
    ADD CONSTRAINT "process_template_phases_position_key" UNIQUE ("template_id", "position") DEFERRABLE;

ALTER TABLE ONLY "public"."process_templates"
    ADD CONSTRAINT "process_templates_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."case_access"
    ADD CONSTRAINT "case_access_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."case_access"
    ADD CONSTRAINT "case_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."case_access"
    ADD CONSTRAINT "case_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."case_action_items"
    ADD CONSTRAINT "case_action_items_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."case_action_items"
    ADD CONSTRAINT "case_action_items_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."case_action_items"
    ADD CONSTRAINT "case_action_items_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."case_action_items"
    ADD CONSTRAINT "case_action_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."case_action_items"
    ADD CONSTRAINT "case_action_items_source_case_phase_id_fkey" FOREIGN KEY ("source_case_phase_id") REFERENCES "public"."case_phases"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."case_documents"
    ADD CONSTRAINT "case_documents_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."case_documents"
    ADD CONSTRAINT "case_documents_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."case_documents"
    ADD CONSTRAINT "case_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."case_events"
    ADD CONSTRAINT "case_events_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."case_events"
    ADD CONSTRAINT "case_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."case_narrative_types"
    ADD CONSTRAINT "case_narrative_types_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."case_narratives"
    ADD CONSTRAINT "case_narratives_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."case_narratives"
    ADD CONSTRAINT "case_narratives_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."case_narratives"
    ADD CONSTRAINT "case_narratives_concluded_by_fkey" FOREIGN KEY ("concluded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."case_narratives"
    ADD CONSTRAINT "case_narratives_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."case_narratives"
    ADD CONSTRAINT "case_narratives_narrative_type_id_fkey" FOREIGN KEY ("narrative_type_id") REFERENCES "public"."case_narrative_types"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."case_narratives"
    ADD CONSTRAINT "case_narratives_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."case_offered_outcomes"
    ADD CONSTRAINT "case_offered_outcomes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."case_offered_outcomes"
    ADD CONSTRAINT "case_offered_outcomes_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "public"."case_outcomes"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."case_outcomes"
    ADD CONSTRAINT "case_outcomes_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."case_phases"
    ADD CONSTRAINT "case_phases_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."case_phases"
    ADD CONSTRAINT "case_phases_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."case_phases"
    ADD CONSTRAINT "case_phases_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id");

ALTER TABLE ONLY "public"."case_phases"
    ADD CONSTRAINT "case_phases_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "public"."form_versions"("id");

ALTER TABLE ONLY "public"."case_tag_assignments"
    ADD CONSTRAINT "case_tag_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."case_tag_assignments"
    ADD CONSTRAINT "case_tag_assignments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."case_tag_assignments"
    ADD CONSTRAINT "case_tag_assignments_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."case_tags"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."case_tags"
    ADD CONSTRAINT "case_tags_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "public"."case_outcomes"("id");

ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."process_templates"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."process_template_narratives"
    ADD CONSTRAINT "process_template_narratives_narrative_type_id_fkey" FOREIGN KEY ("narrative_type_id") REFERENCES "public"."case_narrative_types"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."process_template_narratives"
    ADD CONSTRAINT "process_template_narratives_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."process_templates"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."process_template_outcomes"
    ADD CONSTRAINT "process_template_outcomes_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "public"."case_outcomes"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."process_template_outcomes"
    ADD CONSTRAINT "process_template_outcomes_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."process_templates"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."process_template_phases"
    ADD CONSTRAINT "process_template_phases_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id");

ALTER TABLE ONLY "public"."process_template_phases"
    ADD CONSTRAINT "process_template_phases_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."process_templates"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."process_templates"
    ADD CONSTRAINT "process_templates_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."process_templates"
    ADD CONSTRAINT "process_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_case_phase_id_fkey" FOREIGN KEY ("case_phase_id") REFERENCES "public"."case_phases"("id");

CREATE INDEX "case_access_user_idx" ON "public"."case_access" USING "btree" ("user_id");

CREATE INDEX "case_action_items_assigned_to_idx" ON "public"."case_action_items" USING "btree" ("assigned_to");

CREATE INDEX "case_action_items_case_idx" ON "public"."case_action_items" USING "btree" ("case_id");

CREATE INDEX "case_documents_case_idx" ON "public"."case_documents" USING "btree" ("case_id");

CREATE INDEX "case_documents_case_live_idx" ON "public"."case_documents" USING "btree" ("case_id") WHERE ("deleted_at" IS NULL);

CREATE INDEX "case_events_case_idx" ON "public"."case_events" USING "btree" ("case_id");

CREATE INDEX "case_narrative_types_commission_idx" ON "public"."case_narrative_types" USING "btree" ("commission_id");

CREATE INDEX "case_narratives_assigned_to_idx" ON "public"."case_narratives" USING "btree" ("assigned_to");

CREATE INDEX "case_narratives_case_idx" ON "public"."case_narratives" USING "btree" ("case_id");

CREATE INDEX "case_narratives_type_idx" ON "public"."case_narratives" USING "btree" ("narrative_type_id");

CREATE INDEX "case_offered_outcomes_outcome_idx" ON "public"."case_offered_outcomes" USING "btree" ("outcome_id");

CREATE INDEX "case_outcomes_commission_idx" ON "public"."case_outcomes" USING "btree" ("commission_id");

CREATE INDEX "case_phases_assigned_to_idx" ON "public"."case_phases" USING "btree" ("assigned_to");

CREATE INDEX "case_phases_case_idx" ON "public"."case_phases" USING "btree" ("case_id");

CREATE INDEX "case_tag_assignments_tag_idx" ON "public"."case_tag_assignments" USING "btree" ("tag_id");

CREATE INDEX "case_tags_commission_idx" ON "public"."case_tags" USING "btree" ("commission_id");

CREATE INDEX "cases_commission_idx" ON "public"."cases" USING "btree" ("commission_id");

CREATE INDEX "cases_outcome_idx" ON "public"."cases" USING "btree" ("outcome_id");

CREATE INDEX "cases_template_idx" ON "public"."cases" USING "btree" ("template_id");

CREATE INDEX "process_template_narratives_template_idx" ON "public"."process_template_narratives" USING "btree" ("template_id");

CREATE INDEX "process_template_narratives_type_idx" ON "public"."process_template_narratives" USING "btree" ("narrative_type_id");

CREATE INDEX "process_template_outcomes_outcome_idx" ON "public"."process_template_outcomes" USING "btree" ("outcome_id");

CREATE INDEX "process_template_phases_form_idx" ON "public"."process_template_phases" USING "btree" ("form_id");

CREATE INDEX "process_template_phases_template_idx" ON "public"."process_template_phases" USING "btree" ("template_id");

CREATE INDEX "process_templates_commission_idx" ON "public"."process_templates" USING "btree" ("commission_id");

CREATE OR REPLACE TRIGGER "guard_case_narrative_frozen_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."case_narratives" FOR EACH ROW EXECUTE FUNCTION "app"."guard_case_narrative_frozen"();

CREATE OR REPLACE TRIGGER "guard_case_phase_blocks_shape_trg" BEFORE INSERT OR UPDATE ON "public"."case_phases" FOR EACH ROW EXECUTE FUNCTION "app"."guard_phase_blocks_shape"();

CREATE OR REPLACE TRIGGER "guard_case_phase_status_trg" BEFORE DELETE OR UPDATE ON "public"."case_phases" FOR EACH ROW EXECUTE FUNCTION "app"."guard_case_phase_status"();

CREATE OR REPLACE TRIGGER "guard_case_status_trg" BEFORE DELETE OR UPDATE ON "public"."cases" FOR EACH ROW EXECUTE FUNCTION "app"."guard_case_status"();

CREATE OR REPLACE TRIGGER "guard_case_tag_assignment_trg" BEFORE INSERT ON "public"."case_tag_assignments" FOR EACH ROW EXECUTE FUNCTION "app"."guard_case_tag_assignment"();

CREATE OR REPLACE TRIGGER "guard_process_template_outcome_trg" BEFORE INSERT ON "public"."process_template_outcomes" FOR EACH ROW EXECUTE FUNCTION "app"."guard_process_template_outcome"();

CREATE OR REPLACE TRIGGER "guard_template_narrative_type_trg" BEFORE INSERT ON "public"."process_template_narratives" FOR EACH ROW EXECUTE FUNCTION "app"."guard_template_narrative_type"();

CREATE OR REPLACE TRIGGER "guard_template_phase_blocks_shape_trg" BEFORE INSERT OR UPDATE ON "public"."process_template_phases" FOR EACH ROW EXECUTE FUNCTION "app"."guard_phase_blocks_shape"();

CREATE OR REPLACE TRIGGER "mint_case_number_trg" BEFORE INSERT ON "public"."cases" FOR EACH ROW EXECUTE FUNCTION "app"."mint_case_number"();

CREATE OR REPLACE TRIGGER "recompute_case_status_trg" AFTER INSERT OR UPDATE OF "status" ON "public"."case_phases" FOR EACH ROW EXECUTE FUNCTION "app"."trg_recompute_case_status"();

CREATE OR REPLACE TRIGGER "sync_case_phase_on_submit_trg" AFTER UPDATE ON "public"."responses" FOR EACH ROW EXECUTE FUNCTION "public"."sync_case_phase_on_submit"();

CREATE OR REPLACE TRIGGER "touch_case_narrative_types_updated_at" BEFORE UPDATE ON "public"."case_narrative_types" FOR EACH ROW EXECUTE FUNCTION "app"."touch_case_narrative_updated_at"();

CREATE OR REPLACE TRIGGER "touch_case_narratives_updated_at" BEFORE UPDATE ON "public"."case_narratives" FOR EACH ROW EXECUTE FUNCTION "app"."touch_case_narrative_updated_at"();

ALTER TABLE "public"."case_access" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."case_action_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."case_documents" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."case_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."case_narrative_types" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."case_narratives" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."case_offered_outcomes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."case_outcomes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."case_phases" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."case_tag_assignments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."case_tags" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."cases" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."process_template_narratives" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."process_template_outcomes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."process_template_phases" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."process_templates" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_access_select" ON "public"."case_access" FOR SELECT TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_admin"() OR ("user_id" = "auth"."uid"())));

CREATE POLICY "case_action_items_select" ON "public"."case_action_items" FOR SELECT TO "authenticated" USING (("app"."can_read_case"("case_id", "auth"."uid"()) OR "app"."is_admin"()));

CREATE POLICY "case_action_items_staff_admin_write" ON "public"."case_action_items" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_admin"()));

CREATE POLICY "case_documents_select" ON "public"."case_documents" FOR SELECT TO "authenticated" USING (("app"."can_read_case"("case_id", "auth"."uid"()) OR "app"."is_admin"()));

CREATE POLICY "case_documents_staff_admin_write" ON "public"."case_documents" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_admin"()));

CREATE POLICY "case_documents_writer_write" ON "public"."case_documents" TO "authenticated" USING ("app"."can_write_case_content"("case_id", "auth"."uid"())) WITH CHECK ("app"."can_write_case_content"("case_id", "auth"."uid"()));

CREATE POLICY "case_events_select" ON "public"."case_events" FOR SELECT TO "authenticated" USING (("app"."can_read_case"("case_id", "auth"."uid"()) OR "app"."is_admin"()));

CREATE POLICY "case_events_staff_admin_write" ON "public"."case_events" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_admin"()));

CREATE POLICY "case_events_writer_write" ON "public"."case_events" TO "authenticated" USING ("app"."can_write_case_content"("case_id", "auth"."uid"())) WITH CHECK ("app"."can_write_case_content"("case_id", "auth"."uid"()));

CREATE POLICY "case_narrative_types_select" ON "public"."case_narrative_types" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "case_narrative_types_staff_admin_write" ON "public"."case_narrative_types" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "case_narratives_select" ON "public"."case_narratives" FOR SELECT TO "authenticated" USING (("app"."can_read_case"("case_id", "auth"."uid"()) OR "app"."is_admin"()));

CREATE POLICY "case_narratives_staff_admin_write" ON "public"."case_narratives" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_admin"()));

CREATE POLICY "case_offered_outcomes_select" ON "public"."case_offered_outcomes" FOR SELECT TO "authenticated" USING (("app"."can_read_case"("case_id", "auth"."uid"()) OR "app"."is_admin"()));

CREATE POLICY "case_offered_outcomes_staff_admin_write" ON "public"."case_offered_outcomes" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_admin"()));

CREATE POLICY "case_outcomes_select" ON "public"."case_outcomes" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "case_outcomes_staff_admin_write" ON "public"."case_outcomes" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "case_phases_select" ON "public"."case_phases" FOR SELECT TO "authenticated" USING (("app"."can_read_case"("case_id", "auth"."uid"()) OR "app"."is_admin"()));

CREATE POLICY "case_phases_staff_admin_write" ON "public"."case_phases" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_admin"()));

CREATE POLICY "case_tag_assignments_select" ON "public"."case_tag_assignments" FOR SELECT TO "authenticated" USING (("app"."can_read_case"("case_id", "auth"."uid"()) OR "app"."is_admin"()));

CREATE POLICY "case_tag_assignments_staff_admin_write" ON "public"."case_tag_assignments" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_case"("case_id")) OR "app"."is_admin"()));

CREATE POLICY "case_tags_select" ON "public"."case_tags" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "case_tags_staff_admin_write" ON "public"."case_tags" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "cases_select" ON "public"."cases" FOR SELECT TO "authenticated" USING (("app"."can_read_case"("id", "auth"."uid"()) OR "app"."is_admin"()));

CREATE POLICY "cases_staff_admin_write" ON "public"."cases" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "process_template_narratives_select" ON "public"."process_template_narratives" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_template"("template_id")) OR "app"."is_admin"()));

CREATE POLICY "process_template_narratives_staff_admin_write" ON "public"."process_template_narratives" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_template"("template_id")) OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_template"("template_id")) OR "app"."is_admin"()));

CREATE POLICY "process_template_outcomes_select" ON "public"."process_template_outcomes" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_template"("template_id")) OR "app"."is_admin"()));

CREATE POLICY "process_template_outcomes_staff_admin_write" ON "public"."process_template_outcomes" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_template"("template_id")) OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_template"("template_id")) OR "app"."is_admin"()));

CREATE POLICY "process_template_phases_select" ON "public"."process_template_phases" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_template"("template_id")) OR "app"."is_admin"()));

CREATE POLICY "process_template_phases_staff_admin_write" ON "public"."process_template_phases" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_template"("template_id")) OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_template"("template_id")) OR "app"."is_admin"()));

CREATE POLICY "process_templates_select" ON "public"."process_templates" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "process_templates_staff_admin_write" ON "public"."process_templates" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"()));

GRANT ALL ON TABLE "public"."case_action_items" TO "authenticated";
GRANT ALL ON TABLE "public"."case_action_items" TO "service_role";

REVOKE ALL ON FUNCTION "app"."advance_action_item_core"("p_action_item_id" "uuid", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."advance_action_item_core"("p_action_item_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."advance_action_item_core"("p_action_item_id" "uuid", "p_status" "text") TO "service_role";

REVOKE ALL ON FUNCTION "app"."assert_case_access_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."assert_case_access_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "app"."assert_case_access_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "app"."assert_cases_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."assert_cases_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "app"."assert_cases_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "app"."assert_extras_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."assert_extras_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "app"."assert_extras_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "app"."assert_narratives_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."assert_narratives_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "app"."assert_narratives_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "app"."can_read_case"("p_case_id" "uuid", "p_uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."can_read_case"("p_case_id" "uuid", "p_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."can_read_case"("p_case_id" "uuid", "p_uid" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."can_write_case_content"("p_case_id" "uuid", "p_uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."can_write_case_content"("p_case_id" "uuid", "p_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."can_write_case_content"("p_case_id" "uuid", "p_uid" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."can_write_case_narrative"("p_narrative_id" "uuid", "p_uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."can_write_case_narrative"("p_narrative_id" "uuid", "p_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."can_write_case_narrative"("p_narrative_id" "uuid", "p_uid" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."case_phase_answer_map"("p_case_phase_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."case_phase_answer_map"("p_case_phase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."case_phase_answer_map"("p_case_phase_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."commission_of_case"("p_case_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."commission_of_case"("p_case_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."commission_of_case"("p_case_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."commission_of_template"("p_template_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."commission_of_template"("p_template_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."commission_of_template"("p_template_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."published_version_of_form"("p_form_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."published_version_of_form"("p_form_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."published_version_of_form"("p_form_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."recompute_case_status"("p_case_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."recompute_case_status"("p_case_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."recompute_case_status"("p_case_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."validate_template_phase_blocks"("p_template_id" "uuid", "p_position" integer, "p_blocks" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."validate_template_phase_blocks"("p_template_id" "uuid", "p_position" integer, "p_blocks" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "app"."validate_template_phase_blocks"("p_template_id" "uuid", "p_position" integer, "p_blocks" integer[]) TO "service_role";

REVOKE ALL ON FUNCTION "app"."validate_template_recommend_when"("p_template_id" "uuid", "p_position" integer, "p_recommend_when" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."validate_template_recommend_when"("p_template_id" "uuid", "p_position" integer, "p_recommend_when" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "app"."validate_template_recommend_when"("p_template_id" "uuid", "p_position" integer, "p_recommend_when" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "app"."version_has_input_key"("p_version_id" "uuid", "p_question_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."version_has_input_key"("p_version_id" "uuid", "p_question_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."version_has_input_key"("p_version_id" "uuid", "p_question_key" "text") TO "service_role";

GRANT ALL ON TABLE "public"."case_phases" TO "authenticated";
GRANT ALL ON TABLE "public"."case_phases" TO "service_role";

REVOKE ALL ON FUNCTION "public"."activate_phase"("p_case_phase_id" "uuid", "p_assigned_to" "uuid", "p_due_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."activate_phase"("p_case_phase_id" "uuid", "p_assigned_to" "uuid", "p_due_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."activate_phase"("p_case_phase_id" "uuid", "p_assigned_to" "uuid", "p_due_date" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."add_ad_hoc_phase"("p_case_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_assigned_to" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_ad_hoc_phase"("p_case_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_assigned_to" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_ad_hoc_phase"("p_case_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_assigned_to" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."process_template_narratives" TO "authenticated";
GRANT ALL ON TABLE "public"."process_template_narratives" TO "service_role";

REVOKE ALL ON FUNCTION "public"."add_template_narrative"("p_template_id" "uuid", "p_narrative_type_id" "uuid", "p_title" "text", "p_instructions" "text", "p_is_expected" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_template_narrative"("p_template_id" "uuid", "p_narrative_type_id" "uuid", "p_title" "text", "p_instructions" "text", "p_is_expected" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_template_narrative"("p_template_id" "uuid", "p_narrative_type_id" "uuid", "p_title" "text", "p_instructions" "text", "p_is_expected" boolean) TO "service_role";

GRANT ALL ON TABLE "public"."process_template_phases" TO "authenticated";
GRANT ALL ON TABLE "public"."process_template_phases" TO "service_role";

REVOKE ALL ON FUNCTION "public"."add_template_phase"("p_template_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_default_due_days" integer, "p_blocks" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_template_phase"("p_template_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_default_due_days" integer, "p_blocks" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_template_phase"("p_template_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_default_due_days" integer, "p_blocks" integer[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."advance_action_item"("p_action_item_id" "uuid", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."advance_action_item"("p_action_item_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."advance_action_item"("p_action_item_id" "uuid", "p_status" "text") TO "service_role";

GRANT ALL ON TABLE "public"."case_narrative_types" TO "authenticated";
GRANT ALL ON TABLE "public"."case_narrative_types" TO "service_role";

REVOKE ALL ON FUNCTION "public"."archive_case_narrative_type"("p_narrative_type_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_case_narrative_type"("p_narrative_type_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_case_narrative_type"("p_narrative_type_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."case_outcomes" TO "authenticated";
GRANT ALL ON TABLE "public"."case_outcomes" TO "service_role";

REVOKE ALL ON FUNCTION "public"."archive_case_outcome"("p_outcome_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_case_outcome"("p_outcome_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_case_outcome"("p_outcome_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."case_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."case_tags" TO "service_role";

REVOKE ALL ON FUNCTION "public"."archive_case_tag"("p_tag_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_case_tag"("p_tag_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_case_tag"("p_tag_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."process_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."process_templates" TO "service_role";

REVOKE ALL ON FUNCTION "public"."archive_process_template"("p_template_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_process_template"("p_template_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_process_template"("p_template_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."assign_case_tag"("p_case_id" "uuid", "p_tag_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assign_case_tag"("p_case_id" "uuid", "p_tag_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_case_tag"("p_case_id" "uuid", "p_tag_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."assign_narrative"("p_narrative" "uuid", "p_assignee" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assign_narrative"("p_narrative" "uuid", "p_assignee" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_narrative"("p_narrative" "uuid", "p_assignee" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."cases" TO "authenticated";
GRANT ALL ON TABLE "public"."cases" TO "service_role";

REVOKE ALL ON FUNCTION "public"."cancel_case"("p_case_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_case"("p_case_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_case"("p_case_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."case_access_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."case_access_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."case_access_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."case_action_items_kpis"("p_commission_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."case_action_items_kpis"("p_commission_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."case_action_items_kpis"("p_commission_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."case_narratives_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."case_narratives_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."case_narratives_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."case_tag_report"("p_commission_id" "uuid", "p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."case_tag_report"("p_commission_id" "uuid", "p_from" "date", "p_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."case_tag_report"("p_commission_id" "uuid", "p_from" "date", "p_to" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."case_viewer_capabilities"("p_case_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."case_viewer_capabilities"("p_case_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."case_viewer_capabilities"("p_case_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."cases_extras_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cases_extras_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cases_extras_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."close_case"("p_case_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."close_case"("p_case_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_case"("p_case_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."complete_action_item"("p_action_item_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_action_item"("p_action_item_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_action_item"("p_action_item_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."conclude_narrative"("p_narrative" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."conclude_narrative"("p_narrative" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."conclude_narrative"("p_narrative" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_action_item"("p_case_id" "uuid", "p_title" "text", "p_description" "text", "p_assigned_to" "uuid", "p_due_date" "date", "p_source_case_phase_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_action_item"("p_case_id" "uuid", "p_title" "text", "p_description" "text", "p_assigned_to" "uuid", "p_due_date" "date", "p_source_case_phase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_action_item"("p_case_id" "uuid", "p_title" "text", "p_description" "text", "p_assigned_to" "uuid", "p_due_date" "date", "p_source_case_phase_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_case_from_template"("p_template_id" "uuid", "p_label" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_case_from_template"("p_template_id" "uuid", "p_label" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_case_from_template"("p_template_id" "uuid", "p_label" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_case_narrative_type"("p_commission_id" "uuid", "p_label" "text", "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_case_narrative_type"("p_commission_id" "uuid", "p_label" "text", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_case_narrative_type"("p_commission_id" "uuid", "p_label" "text", "p_description" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_case_outcome"("p_commission_id" "uuid", "p_label" "text", "p_color_token" "text", "p_requires_action_plan" boolean, "p_is_adverse" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_case_outcome"("p_commission_id" "uuid", "p_label" "text", "p_color_token" "text", "p_requires_action_plan" boolean, "p_is_adverse" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_case_outcome"("p_commission_id" "uuid", "p_label" "text", "p_color_token" "text", "p_requires_action_plan" boolean, "p_is_adverse" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_case_tag"("p_commission_id" "uuid", "p_name" "text", "p_color_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_case_tag"("p_commission_id" "uuid", "p_name" "text", "p_color_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_case_tag"("p_commission_id" "uuid", "p_name" "text", "p_color_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_process_template"("p_commission_id" "uuid", "p_title" "text", "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_process_template"("p_commission_id" "uuid", "p_title" "text", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_process_template"("p_commission_id" "uuid", "p_title" "text", "p_description" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."get_case_detail"("p_case_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_case_detail"("p_case_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_case_detail"("p_case_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."grant_case_access"("p_case" "uuid", "p_user" "uuid", "p_level" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."grant_case_access"("p_case" "uuid", "p_user" "uuid", "p_level" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_case_access"("p_case" "uuid", "p_user" "uuid", "p_level" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."list_cases_board"("p_commission_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_cases_board"("p_commission_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_cases_board"("p_commission_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."list_my_cases"("p_commission" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_my_cases"("p_commission" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_my_cases"("p_commission" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."publish_process_template"("p_template_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publish_process_template"("p_template_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."publish_process_template"("p_template_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."reassign_phase"("p_case_phase_id" "uuid", "p_new_assignee" "uuid", "p_due_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reassign_phase"("p_case_phase_id" "uuid", "p_new_assignee" "uuid", "p_due_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reassign_phase"("p_case_phase_id" "uuid", "p_new_assignee" "uuid", "p_due_date" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."recompute_recommendations"("p_case_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recompute_recommendations"("p_case_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_recommendations"("p_case_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."remove_template_narrative"("p_narrative_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_template_narrative"("p_narrative_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_template_narrative"("p_narrative_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."remove_template_phase"("p_phase_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_template_phase"("p_phase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_template_phase"("p_phase_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."rename_case_tag"("p_tag_id" "uuid", "p_name" "text", "p_color_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rename_case_tag"("p_tag_id" "uuid", "p_name" "text", "p_color_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rename_case_tag"("p_tag_id" "uuid", "p_name" "text", "p_color_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."reopen_narrative"("p_narrative" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reopen_narrative"("p_narrative" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reopen_narrative"("p_narrative" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."reorder_case_layout_template"("p_template_id" "uuid", "p_ordered" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_case_layout_template"("p_template_id" "uuid", "p_ordered" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_case_layout_template"("p_template_id" "uuid", "p_ordered" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."reorder_case_narrative_types"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_case_narrative_types"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_case_narrative_types"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."reorder_case_outcomes"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_case_outcomes"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_case_outcomes"("p_commission_id" "uuid", "p_ordered_ids" "uuid"[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."reorder_template_phase"("p_phase_id" "uuid", "p_direction" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_template_phase"("p_phase_id" "uuid", "p_direction" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_template_phase"("p_phase_id" "uuid", "p_direction" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."revoke_case_access"("p_case" "uuid", "p_user" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revoke_case_access"("p_case" "uuid", "p_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_case_access"("p_case" "uuid", "p_user" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."save_narrative_body"("p_narrative" "uuid", "p_body_md" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_narrative_body"("p_narrative" "uuid", "p_body_md" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_narrative_body"("p_narrative" "uuid", "p_body_md" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_case_outcome"("p_case_id" "uuid", "p_outcome_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_case_outcome"("p_case_id" "uuid", "p_outcome_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_case_outcome"("p_case_id" "uuid", "p_outcome_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_process_outcomes"("p_template_id" "uuid", "p_outcome_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_process_outcomes"("p_template_id" "uuid", "p_outcome_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_process_outcomes"("p_template_id" "uuid", "p_outcome_ids" "uuid"[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_template_phase_blocks"("p_phase_id" "uuid", "p_blocks" integer[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_template_phase_blocks"("p_phase_id" "uuid", "p_blocks" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_template_phase_blocks"("p_phase_id" "uuid", "p_blocks" integer[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."skip_phase"("p_case_phase_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."skip_phase"("p_case_phase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."skip_phase"("p_case_phase_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."start_or_resume_phase"("p_case_phase_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_or_resume_phase"("p_case_phase_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_or_resume_phase"("p_case_phase_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."sync_case_phase_on_submit"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_case_phase_on_submit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_case_phase_on_submit"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."unassign_case_tag"("p_case_id" "uuid", "p_tag_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."unassign_case_tag"("p_case_id" "uuid", "p_tag_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unassign_case_tag"("p_case_id" "uuid", "p_tag_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."unassign_narrative"("p_narrative" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."unassign_narrative"("p_narrative" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unassign_narrative"("p_narrative" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_action_item"("p_action_item_id" "uuid", "p_title" "text", "p_description" "text", "p_assigned_to" "uuid", "p_due_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_action_item"("p_action_item_id" "uuid", "p_title" "text", "p_description" "text", "p_assigned_to" "uuid", "p_due_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_action_item"("p_action_item_id" "uuid", "p_title" "text", "p_description" "text", "p_assigned_to" "uuid", "p_due_date" "date") TO "service_role";

GRANT ALL ON TABLE "public"."case_narratives" TO "authenticated";
GRANT ALL ON TABLE "public"."case_narratives" TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_case_narrative_body"("p_narrative_id" "uuid", "p_body_md" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_case_narrative_body"("p_narrative_id" "uuid", "p_body_md" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_case_narrative_body"("p_narrative_id" "uuid", "p_body_md" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_case_narrative_type"("p_narrative_type_id" "uuid", "p_label" "text", "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_case_narrative_type"("p_narrative_type_id" "uuid", "p_label" "text", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_case_narrative_type"("p_narrative_type_id" "uuid", "p_label" "text", "p_description" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_case_outcome"("p_outcome_id" "uuid", "p_label" "text", "p_color_token" "text", "p_requires_action_plan" boolean, "p_is_adverse" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_case_outcome"("p_outcome_id" "uuid", "p_label" "text", "p_color_token" "text", "p_requires_action_plan" boolean, "p_is_adverse" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_case_outcome"("p_outcome_id" "uuid", "p_label" "text", "p_color_token" "text", "p_requires_action_plan" boolean, "p_is_adverse" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_template_narrative"("p_narrative_id" "uuid", "p_title" "text", "p_instructions" "text", "p_is_expected" boolean, "p_clear_title" boolean, "p_clear_instructions" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_template_narrative"("p_narrative_id" "uuid", "p_title" "text", "p_instructions" "text", "p_is_expected" boolean, "p_clear_title" boolean, "p_clear_instructions" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_template_narrative"("p_narrative_id" "uuid", "p_title" "text", "p_instructions" "text", "p_is_expected" boolean, "p_clear_title" boolean, "p_clear_instructions" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_template_phase"("p_phase_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_clear_recommend_when" boolean, "p_default_due_days" integer, "p_clear_default_due_days" boolean, "p_blocks" integer[], "p_clear_blocks" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_template_phase"("p_phase_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_clear_recommend_when" boolean, "p_default_due_days" integer, "p_clear_default_due_days" boolean, "p_blocks" integer[], "p_clear_blocks" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_template_phase"("p_phase_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_clear_recommend_when" boolean, "p_default_due_days" integer, "p_clear_default_due_days" boolean, "p_blocks" integer[], "p_clear_blocks" boolean) TO "service_role";

GRANT ALL ON TABLE "public"."case_access" TO "authenticated";
GRANT ALL ON TABLE "public"."case_access" TO "service_role";

GRANT ALL ON TABLE "public"."case_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."case_documents" TO "service_role";

GRANT ALL ON TABLE "public"."case_events" TO "authenticated";
GRANT ALL ON TABLE "public"."case_events" TO "service_role";

GRANT ALL ON TABLE "public"."case_offered_outcomes" TO "authenticated";
GRANT ALL ON TABLE "public"."case_offered_outcomes" TO "service_role";

GRANT ALL ON TABLE "public"."case_tag_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."case_tag_assignments" TO "service_role";

GRANT ALL ON TABLE "public"."process_template_outcomes" TO "authenticated";
GRANT ALL ON TABLE "public"."process_template_outcomes" TO "service_role";
