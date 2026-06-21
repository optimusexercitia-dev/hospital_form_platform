-- ----------------------------------------------------------------------------
-- Consolidated baseline — patient_safety
-- ----------------------------------------------------------------------------
SET check_function_bodies = false;
SET client_min_messages = warning;

-- ===========================================================================
-- public.pqs_members — real NSP/PQS staff roster (WS A; ADR 0030/0031)
-- ===========================================================================
-- Replaces the "PQS membership == platform admin" placeholder. app.is_pqs_member
-- now reads this table; an admin is in the NSP only if enrolled here. Admin-
-- managed read/write (the predicates use the DEFINER app.is_pqs_member which
-- bypasses RLS, so PQS staff need no SELECT policy of their own). No PHI.
-- Created FIRST in this file because add_pqs_member RETURNS public.pqs_members
-- (the composite row type must exist when that function is defined).
CREATE TABLE IF NOT EXISTS "public"."pqs_members" (
    "user_id" "uuid" NOT NULL,
    "added_by" "uuid",
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pqs_members_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "pqs_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
    CONSTRAINT "pqs_members_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id")
);

ALTER TABLE "public"."pqs_members" OWNER TO "postgres";

COMMENT ON TABLE "public"."pqs_members" IS 'NSP/PQS staff roster (WS A; ADR 0030/0031). app.is_pqs_member reads this; enrollment is the ONLY route a platform admin gets NSP/PHI access (duty separation). Admin-managed via add/remove/list_pqs_members. No PHI.';

ALTER TABLE "public"."pqs_members" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pqs_members_admin_all" ON "public"."pqs_members" TO "authenticated" USING ("app"."is_admin"()) WITH CHECK ("app"."is_admin"());

CREATE TABLE IF NOT EXISTS "public"."capa_action" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "capa_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "owner" "text",
    "assignee_user_id" "uuid",
    "due_date" "date",
    "action_strength" "text" DEFAULT 'intermediaria'::"text" NOT NULL,
    "success_measure" "text",
    "root_cause_id" "uuid",
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "position" integer NOT NULL,
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "capa_action_action_strength_check" CHECK (("action_strength" = ANY (ARRAY['forte'::"text", 'intermediaria'::"text", 'fraca'::"text"]))),
    CONSTRAINT "capa_action_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'em_andamento'::"text", 'concluida'::"text", 'cancelada'::"text"]))),
    CONSTRAINT "capa_action_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);

ALTER TABLE "public"."capa_action" OWNER TO "postgres";

COMMENT ON TABLE "public"."capa_action" IS 'CAPA corrective actions (Phase 14d). owner = displayed free-text party; assignee_user_id = the platform user the narrow advance gate keys on. root_cause_id FKs the 14c rca_root_causes(id).';

CREATE OR REPLACE FUNCTION "app"."advance_capa_action_core"("p_action_id" "uuid", "p_status" "text") RETURNS "public"."capa_action"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_assignee uuid;
  v_capa_id uuid;
  v_uid uuid := auth.uid();
  v_result public.capa_action;
begin
  if p_status not in ('pendente', 'em_andamento', 'concluida', 'cancelada') then
    raise exception 'estado de ação inválido' using errcode = 'check_violation';
  end if;

  select assignee_user_id, capa_id into v_assignee, v_capa_id
  from public.capa_action where id = p_action_id;
  if v_capa_id is null then
    raise exception 'ação % não encontrada', p_action_id using errcode = 'no_data_found';
  end if;

  if not (
    (v_assignee is not null and v_assignee = v_uid)
    or app.is_pqs_member(v_uid)
  ) then
    raise exception 'você não pode alterar esta ação corretiva' using errcode = 'HC050';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.capa_action
  set status = p_status,
      completed_at = case when p_status = 'concluida' then coalesce(completed_at, now()) else null end,
      completed_by = case when p_status = 'concluida' then coalesce(completed_by, v_uid) else null end,
      updated_at = now()
  where id = p_action_id
  returning * into v_result;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "app"."advance_capa_action_core"("p_action_id" "uuid", "p_status" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."assert_capa_writable"("p_capa_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if (select id from public.capa_plan where id = p_capa_id) is null then
    raise exception 'plano de ação não encontrado' using errcode = 'no_data_found';
  end if;
  if not app.is_pqs_writer() then
    raise exception 'apenas o NSP pode gerenciar planos de ação' using errcode = '42501';
  end if;
end;
$$;

ALTER FUNCTION "app"."assert_capa_writable"("p_capa_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."assert_patient_safety_enabled"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not app.feature_enabled('patient_safety') then
    raise exception 'o módulo de segurança do paciente não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

ALTER FUNCTION "app"."assert_patient_safety_enabled"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."assert_rca_writable"("p_rca_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_event_id uuid;
begin
  select event_id into v_event_id from public.rca where id = p_rca_id;
  if v_event_id is null then
    raise exception 'análise de causa raiz não encontrada' using errcode = 'no_data_found';
  end if;
  if not app.can_write_rca(p_rca_id, auth.uid()) then
    raise exception 'você não pode editar esta análise de causa raiz' using errcode = 'HC048';
  end if;
  return v_event_id;
end;
$$;

ALTER FUNCTION "app"."assert_rca_writable"("p_rca_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."can_read_capa"("p_capa_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select
    app.is_pqs_member(p_user_id)
    or app.can_read_event(app.event_of_capa(p_capa_id), p_user_id);
$$;

ALTER FUNCTION "app"."can_read_capa"("p_capa_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."can_read_event"("p_event_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.patient_safety_event e
    where e.id = p_event_id
      and (
        app.is_member_of_for(e.current_owner_commission_id, p_user_id)
        or app.is_member_of_for(e.reporting_commission_id, p_user_id)
        or app.is_pqs_member(p_user_id)
      )
  );
$$;

ALTER FUNCTION "app"."can_read_event"("p_event_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."can_read_event_patient"("p_event_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  -- WS A: the PHI-identifier read predicate is TIGHTER than can_read_event — it
  -- drops the reporting-commission-provenance term and any admin fallback. Only a
  -- PQS member OR a staff_admin of the event's CURRENT custodian commission may
  -- read the isolated identifiers (minimum-necessary; ADR 0030/0031). For a
  -- PQS-held event current_owner_commission_id IS NULL, and
  -- is_staff_admin_of_for(NULL, uid) is false, so the panel is PQS-only.
  -- Access-follows-custody: the staff_admin term moves with current_owner_*.
  select exists (
    select 1
    from public.patient_safety_event e
    where e.id = p_event_id
      and (
        app.is_pqs_member(p_user_id)
        or app.is_staff_admin_of_for(e.current_owner_commission_id, p_user_id)
      )
  );
$$;

ALTER FUNCTION "app"."can_read_event_patient"("p_event_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."can_write_rca"("p_rca_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.rca r
    where r.id = p_rca_id
      and (
        app.is_pqs_member(p_uid)
        or exists (
          select 1 from public.rca_members m
          where m.rca_id = r.id
            and m.user_id = p_uid
            and m.role <> 'observer'
        )
      )
  );
$$;

ALTER FUNCTION "app"."can_write_rca"("p_rca_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."commission_of_event"("p_event_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select reporting_commission_id from public.patient_safety_event where id = p_event_id;
$$;

ALTER FUNCTION "app"."commission_of_event"("p_event_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."compute_sentinel_determination"("p_reach" "text", "p_harm" "text", "p_natural_course" boolean, "p_has_designated" boolean) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'app', 'pg_catalog'
    AS $$
  select coalesce(p_has_designated, false)
    or (
      -- general-criteria path: reached the patient AND sentinel-tier harm AND
      -- unrelated to the natural course of illness (natural_course = false).
      coalesce(p_reach in ('no_harm', 'adverse', 'sentinel'), false)
      and coalesce(p_harm in ('severe', 'permanent', 'death'), false)
      and p_natural_course is false
    );
$$;

ALTER FUNCTION "app"."compute_sentinel_determination"("p_reach" "text", "p_harm" "text", "p_natural_course" boolean, "p_has_designated" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."event_capa_fully_settled"("p_event_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select
    -- RCA (if any) must be completed.
    not exists (
      select 1 from public.rca r
      where r.event_id = p_event_id and r.status <> 'completed'
    )
    -- and no non-terminal CAPA plan scoped to this event remains.
    and not exists (
      select 1 from public.capa_plan p
      where app.event_of_capa(p.id) = p_event_id
        and p.status not in ('concluido', 'cancelado')
    );
$$;

ALTER FUNCTION "app"."event_capa_fully_settled"("p_event_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."event_current_custodian"("p_event_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.patient_safety_event e
    where e.id = p_event_id
      and (
        app.is_pqs_member(p_user_id)
        or (e.current_owner_kind = 'commission'
            and app.is_staff_admin_of_for(e.current_owner_commission_id, p_user_id))
      )
  );
$$;

ALTER FUNCTION "app"."event_current_custodian"("p_event_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."event_of_capa"("p_capa_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select case
    when p.source = 'event' then p.source_event_id
    when p.source = 'rca' then app.event_of_rca(p.source_rca_id)
    else null
  end
  from public.capa_plan p
  where p.id = p_capa_id;
$$;

ALTER FUNCTION "app"."event_of_capa"("p_capa_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."event_of_rca"("p_rca_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select event_id from public.rca where id = p_rca_id;
$$;

ALTER FUNCTION "app"."event_of_rca"("p_rca_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_capa_child_lock"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_capa_id uuid;
  v_action_id uuid;
  v_measure_id uuid;
  v_status text;
begin
  -- Resolve the owning plan id from whichever child fired.
  if tg_table_name = 'capa_action' then
    v_capa_id := case when tg_op = 'DELETE' then old.capa_id else new.capa_id end;
  elsif tg_table_name = 'capa_measure' then
    v_capa_id := case when tg_op = 'DELETE' then old.capa_id else new.capa_id end;
  elsif tg_table_name = 'capa_effectiveness' then
    v_capa_id := case when tg_op = 'DELETE' then old.capa_id else new.capa_id end;
  elsif tg_table_name = 'capa_action_task' then
    v_action_id := case when tg_op = 'DELETE' then old.action_id else new.action_id end;
    select capa_id into v_capa_id from public.capa_action where id = v_action_id;
  elsif tg_table_name = 'capa_action_evidence' then
    v_action_id := case when tg_op = 'DELETE' then old.action_id else new.action_id end;
    select capa_id into v_capa_id from public.capa_action where id = v_action_id;
  elsif tg_table_name = 'capa_measure_result' then
    v_measure_id := case when tg_op = 'DELETE' then old.measure_id else new.measure_id end;
    select capa_id into v_capa_id from public.capa_measure where id = v_measure_id;
  end if;

  select status into v_status from public.capa_plan where id = v_capa_id;
  if v_status is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if v_status in ('concluido', 'cancelado') then
    raise exception 'o conteúdo deste plano de ação está bloqueado (%)' , v_status
      using errcode = 'HC049';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

ALTER FUNCTION "app"."guard_capa_child_lock"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_capa_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_safety_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    if not v_in_rpc and old.status in ('concluido', 'cancelado') then
      raise exception 'um plano de ação encerrado ou cancelado não pode ser excluído'
        using errcode = 'HC049';
    end if;
    return old;
  end if;

  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'mudanças de estado do plano devem passar pelas RPCs do NSP'
        using errcode = 'HC049';
    end if;
    if not (
      (old.status = 'aberto' and new.status in ('em_execucao', 'cancelado'))
      or (old.status = 'em_execucao' and new.status in ('em_verificacao', 'cancelado'))
      or (old.status = 'em_verificacao' and new.status in ('concluido', 'em_execucao', 'cancelado'))
      or (old.status = 'concluido' and new.status = 'em_execucao')
    ) then
      raise exception 'transição de estado de plano inválida: % -> %', old.status, new.status
        using errcode = 'HC049';
    end if;
    return new;
  end if;

  if v_in_rpc then
    return new;
  end if;
  if old.status in ('concluido', 'cancelado') then
    raise exception 'um plano de ação em estado final é imutável (reabra para editar)'
      using errcode = 'HC049';
  end if;
  return new;
end;
$$;

ALTER FUNCTION "app"."guard_capa_status"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_event_custody"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'pg_catalog'
    AS $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_safety_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    raise exception 'o histórico de custódia do evento é imutável (não pode ser excluído)'
      using errcode = 'HC043';
  end if;

  -- UPDATE: only the one-time close of the open interval, only under the flag.
  if not v_in_rpc then
    raise exception 'o histórico de custódia do evento é imutável (somente inserção)'
      using errcode = 'HC043';
  end if;

  if old.held_until is not null then
    raise exception 'um intervalo de custódia já encerrado não pode ser alterado'
      using errcode = 'HC043';
  end if;

  if new.held_until is null then
    raise exception 'a única alteração permitida é encerrar o intervalo de custódia atual'
      using errcode = 'HC043';
  end if;

  -- Every other column must be unchanged (only held_until may move NULL->non-null).
  if new.id is distinct from old.id
     or new.event_id is distinct from old.event_id
     or new.owner_kind is distinct from old.owner_kind
     or new.owner_commission_id is distinct from old.owner_commission_id
     or new.held_from is distinct from old.held_from
     or new.assigned_by is distinct from old.assigned_by
     or new.note is distinct from old.note
     or new.created_at is distinct from old.created_at then
    raise exception 'apenas o encerramento (held_until) de um intervalo de custódia pode ser alterado'
      using errcode = 'HC043';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "app"."guard_event_custody"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_event_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_safety_rpc', true), 'off') = 'on';
  v_locked_rank constant int := 3;  -- triaged and beyond are "locked"
  v_old_rank int;
begin
  v_old_rank := case old.status
    when 'reported' then 1
    when 'acknowledged' then 2
    when 'triaged' then 3
    when 'closed' then 4
    when 'cancelled' then 4
    else 0
  end;

  if tg_op = 'DELETE' then
    -- A triaged/closed/cancelled event cannot be deleted outside an RPC. (A commission
    -- cascade cannot reach this table — the FKs are ON DELETE NO ACTION / SET NULL.)
    if not v_in_rpc and old.status in ('triaged', 'closed', 'cancelled') then
      raise exception 'eventos triados ou encerrados não podem ser excluídos'
        using errcode = 'HC043';
    end if;
    return old;
  end if;

  -- Status transition.
  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'mudanças de estado do evento devem passar pelas RPCs do NSP'
        using errcode = 'HC043';
    end if;

    if not (
      (old.status = 'reported' and new.status in ('acknowledged', 'cancelled'))
      or (old.status = 'acknowledged' and new.status in ('triaged', 'closed', 'cancelled'))
      or (old.status = 'triaged' and new.status in ('closed', 'acknowledged', 'cancelled'))
    ) then
      raise exception 'transição de estado de evento inválida: % -> %', old.status, new.status
        using errcode = 'HC043';
    end if;

    return new;
  end if;

  -- No status change. Under the flag any field edit is allowed (the RPCs are the
  -- authority). Outside the flag, freeze a LOCKED event (>= triaged).
  if v_in_rpc then
    return new;
  end if;

  if v_old_rank >= v_locked_rank then
    raise exception 'eventos a partir de "triado" são imutáveis (edição bloqueada)'
      using errcode = 'HC043';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "app"."guard_event_status"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_event_triage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_safety_rpc', true), 'off') = 'on';
  v_event_id uuid := case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  v_event_status text;
begin
  -- Under the flag the triage RPCs are the authority — admit the write.
  if v_in_rpc then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select status into v_event_status
  from public.patient_safety_event
  where id = v_event_id;

  if v_event_status in ('triaged', 'closed', 'cancelled') then
    raise exception 'a triagem confirmada é imutável (reabra a triagem para editar)'
      using errcode = 'HC045';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

ALTER FUNCTION "app"."guard_event_triage"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_rca_child_lock"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rca_id uuid := case when tg_op = 'DELETE' then old.rca_id else new.rca_id end;
  v_status text;
begin
  select status into v_status from public.rca where id = v_rca_id;
  if v_status is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if v_status = 'completed' then
    raise exception 'o conteúdo desta análise está bloqueado (concluída)'
      using errcode = 'HC047';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

ALTER FUNCTION "app"."guard_rca_child_lock"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_rca_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_safety_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    if not v_in_rpc and old.status = 'completed' then
      raise exception 'uma análise concluída não pode ser excluída' using errcode = 'HC047';
    end if;
    return old;
  end if;

  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'mudanças de estado da análise devem passar pelas RPCs do NSP'
        using errcode = 'HC047';
    end if;
    if not (
      (old.status = 'draft' and new.status = 'in_progress')
      or (old.status = 'in_progress' and new.status = 'in_review')
      or (old.status = 'in_review' and new.status in ('completed', 'in_progress'))
      or (old.status = 'completed' and new.status = 'in_progress')
    ) then
      raise exception 'transição de estado de análise inválida: % -> %', old.status, new.status
        using errcode = 'HC047';
    end if;
    return new;
  end if;

  -- No status change. Under the flag any field edit is allowed (the RPCs are the
  -- authority). Outside the flag, a 'completed' RCA's header is frozen.
  if v_in_rpc then
    return new;
  end if;
  if old.status = 'completed' then
    raise exception 'uma análise concluída é imutável (reabra para editar)'
      using errcode = 'HC047';
  end if;
  return new;
end;
$$;

ALTER FUNCTION "app"."guard_rca_status"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."is_pqs_member"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  -- PQS membership is now REAL (public.pqs_members), not "platform admin"
  -- (WS A / ADR 0030/0031). The is_admin_for fallback is dropped: a platform
  -- admin reaches NSP content ONLY by being enrolled in pqs_members (duty
  -- separation). SECURITY DEFINER so the lookup bypasses RLS — it is called from
  -- inside other predicates and from non-admin contexts.
  select exists (select 1 from public.pqs_members where user_id = p_user_id);
$$;

ALTER FUNCTION "app"."is_pqs_member"("p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."is_pqs_writer"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  -- WS A: drop the `or app.is_admin()` term — CAPA/NSP write authority is real
  -- PQS membership only (a non-PQS admin cannot write NSP content).
  select app.is_pqs_member(auth.uid());
$$;

ALTER FUNCTION "app"."is_pqs_writer"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."mint_capa_code"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $_$
declare
  v_next integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('pqs:capa_code', 0));

  v_next := coalesce(
    (select max((substring(code from 6))::integer)
     from public.capa_plan
     where code ~ '^CAPA-[0-9]+$'),
    0
  ) + 1;

  new.code := 'CAPA-' || lpad(v_next::text, 4, '0');
  return new;
end;
$_$;

ALTER FUNCTION "app"."mint_capa_code"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."mint_event_code"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $_$
declare
  v_next integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('pqs:event_code', 0));

  -- Highest existing EV-#### suffix + 1 (substring after the 'EV-' prefix).
  v_next := coalesce(
    (select max((substring(code from 4))::integer)
     from public.patient_safety_event
     where code ~ '^EV-[0-9]+$'),
    0
  ) + 1;

  new.code := 'EV-' || lpad(v_next::text, 4, '0');
  return new;
end;
$_$;

ALTER FUNCTION "app"."mint_event_code"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."rca_bump_in_progress"("p_rca_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  update public.rca set status = 'in_progress', updated_at = now()
  where id = p_rca_id and status = 'draft';
$$;

ALTER FUNCTION "app"."rca_bump_in_progress"("p_rca_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_capa_effectiveness"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_event uuid;
  v_comm uuid;
  v_code text;
begin
  v_event := app.event_of_capa(new.capa_id);
  v_comm := case when v_event is not null then app.commission_of_event(v_event) else null end;
  select code into v_code from public.capa_plan where id = new.capa_id;
  perform app.audit_write('capa.effectiveness_recorded', 'capa_plan', new.capa_id, v_comm,
    'Eficácia do plano ' || coalesce(v_code, '') || ' verificada: ' || new.verdict,
    jsonb_build_object('verdict', jsonb_build_object('old', null, 'new', new.verdict)));
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_capa_effectiveness"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_capa_plan"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_cols constant text[] := array['status', 'classification', 'source'];
  v_comm uuid;
  v_event uuid;
  v_action text;
  v_summary text;
begin
  v_event := app.event_of_capa(new.id);
  v_comm := case when v_event is not null then app.commission_of_event(v_event) else null end;

  if tg_op = 'INSERT' then
    perform app.audit_write('capa.opened', 'capa_plan', new.id, v_comm,
      'Plano de ação ' || new.code || ' aberto',
      app.audit_diff(null, to_jsonb(new), v_cols));
    return null;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'concluido' then
      v_action := 'capa.closed';
      v_summary := 'Plano de ação ' || new.code || ' encerrado';
    elsif new.status = 'cancelado' then
      v_action := 'capa.cancelled';
      v_summary := 'Plano de ação ' || new.code || ' cancelado';
    elsif old.status = 'concluido' and new.status = 'em_execucao' then
      v_action := 'capa.reopened';
      v_summary := 'Plano de ação ' || new.code || ' reaberto';
    else
      v_action := 'capa.status_changed';
      v_summary := 'Plano de ação ' || new.code || ': ' || old.status || ' → ' || new.status;
    end if;
    perform app.audit_write(v_action, 'capa_plan', new.id, v_comm,
      v_summary, app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  end if;
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_capa_plan"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_event_custody"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_cols constant text[] := array['owner_kind', 'owner_commission_id', 'held_until'];
  v_comm uuid;
begin
  if tg_op = 'INSERT' then
    v_comm := app.commission_of_event(new.event_id);
    perform app.audit_write('event_custody.transferred', 'event_custody', new.id, v_comm,
      'Custódia do evento atribuída a ' ||
        case new.owner_kind when 'pqs' then 'NSP' else 'comissão' end,
      app.audit_diff(null, to_jsonb(new), v_cols));
  end if;
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_event_custody"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_event_patient"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_comm uuid;
begin
  v_comm := app.commission_of_event(new.event_id);
  perform app.audit_write('event_patient.updated', 'event_patient', new.event_id, v_comm,
    'Dados do paciente do evento atualizados', '{}'::jsonb);
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_event_patient"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_event_triage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_cols constant text[] := array['is_pse', 'pse_closure_reason', 'reach',
                                  'harm_severity', 'review_pathway', 'sentinel_determination'];
  v_comm uuid;
  v_code text;
  v_action text;
  v_summary text;
begin
  v_comm := app.commission_of_event(new.event_id);
  select code into v_code from public.patient_safety_event where id = new.event_id;

  if tg_op = 'INSERT' then
    perform app.audit_write('triage.saved', 'event_triage', new.event_id, v_comm,
      'Triagem do evento ' || coalesce(v_code, '') || ' iniciada',
      app.audit_diff(null, to_jsonb(new), v_cols));
    return null;
  end if;

  -- UPDATE: classify confirm / reopen / save by the triaged_at transition.
  if old.triaged_at is null and new.triaged_at is not null then
    v_action := 'triage.confirmed';
    v_summary := 'Triagem do evento ' || coalesce(v_code, '') || ' confirmada';
  elsif old.triaged_at is not null and new.triaged_at is null then
    v_action := 'triage.reopened';
    v_summary := 'Triagem do evento ' || coalesce(v_code, '') || ' reaberta';
  else
    v_action := 'triage.saved';
    v_summary := 'Triagem do evento ' || coalesce(v_code, '') || ' atualizada';
  end if;

  perform app.audit_write(v_action, 'event_triage', new.event_id, v_comm,
    v_summary, app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_event_triage"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_rca"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_cols constant text[] := array['status'];
  v_comm uuid;
  v_code text;
  v_action text;
  v_summary text;
begin
  v_comm := app.commission_of_event(new.event_id);
  select code into v_code from public.patient_safety_event where id = new.event_id;

  if tg_op = 'INSERT' then
    perform app.audit_write('rca.created', 'rca', new.id, v_comm,
      'Análise de causa raiz aberta para o evento ' || coalesce(v_code, ''),
      app.audit_diff(null, to_jsonb(new), v_cols));
    return null;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'in_review' then
      v_action := 'rca.submitted';
      v_summary := 'Análise do evento ' || coalesce(v_code, '') || ' enviada para revisão';
    elsif new.status = 'completed' then
      v_action := 'rca.completed';
      v_summary := 'Análise do evento ' || coalesce(v_code, '') || ' concluída';
    elsif old.status = 'completed' and new.status = 'in_progress' then
      v_action := 'rca.reopened';
      v_summary := 'Análise do evento ' || coalesce(v_code, '') || ' reaberta';
    else
      v_action := 'rca.status_changed';
      v_summary := 'Análise do evento ' || coalesce(v_code, '') || ': ' || old.status || ' → ' || new.status;
    end if;
    perform app.audit_write(v_action, 'rca', new.id, v_comm,
      v_summary, app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  end if;
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_rca"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_safety_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_cols constant text[] := array['status', 'suspected_harm_level',
                                  'current_owner_kind', 'current_owner_commission_id'];
  v_action text;
  v_summary text;
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('safety_event.reported', 'safety_event', new.id,
      new.reporting_commission_id,
      'Evento de segurança ' || new.code || ' notificado ao NSP',
      app.audit_diff(null, to_jsonb(new), v_cols));
    return null;
  end if;

  -- UPDATE: only emit on a status flip (the meaningful lifecycle event).
  if new.status is distinct from old.status then
    if new.status = 'acknowledged' then
      v_action := 'safety_event.acknowledged';
      v_summary := 'Evento ' || new.code || ' reconhecido pelo NSP';
    elsif new.status = 'cancelled' then
      v_action := 'safety_event.cancelled';
      v_summary := 'Evento ' || new.code || ' cancelado';
    else
      v_action := 'safety_event.status_changed';
      v_summary := 'Evento ' || new.code || ': ' || old.status || ' → ' || new.status;
    end if;
    perform app.audit_write(v_action, 'safety_event', new.id, new.reporting_commission_id,
      v_summary, app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  end if;
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_safety_event"() OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."patient_safety_event" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "reporting_commission_id" "uuid" NOT NULL,
    "case_id" "uuid",
    "discovered_at" "date",
    "reported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "location" "text",
    "reported_by" "uuid",
    "event_type_id" "uuid",
    "suspected_harm_level" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "description_md" "text",
    "status" "text" DEFAULT 'reported'::"text" NOT NULL,
    "current_owner_kind" "text" DEFAULT 'pqs'::"text" NOT NULL,
    "current_owner_commission_id" "uuid",
    "acknowledged_by" "uuid",
    "acknowledged_at" timestamp with time zone,
    "closed_by" "uuid",
    "closed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "has_patient" boolean DEFAULT false NOT NULL,
    "phi_disposed_at" timestamp with time zone,
    "phi_disposed_by" "uuid",
    "phi_disposed_reason" "text",
    CONSTRAINT "patient_safety_event_current_owner_kind_check" CHECK (("current_owner_kind" = ANY (ARRAY['pqs'::"text", 'commission'::"text"]))),
    CONSTRAINT "patient_safety_event_owner_shape" CHECK (((("current_owner_kind" = 'pqs'::"text") AND ("current_owner_commission_id" IS NULL)) OR (("current_owner_kind" = 'commission'::"text") AND ("current_owner_commission_id" IS NOT NULL)))),
    CONSTRAINT "patient_safety_event_status_check" CHECK (("status" = ANY (ARRAY['reported'::"text", 'acknowledged'::"text", 'triaged'::"text", 'closed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "patient_safety_event_suspected_harm_level_check" CHECK (("suspected_harm_level" = ANY (ARRAY['none'::"text", 'mild'::"text", 'moderate'::"text", 'severe'::"text", 'death'::"text", 'unknown'::"text"]))),
    CONSTRAINT "patient_safety_event_title_not_blank" CHECK (("btrim"("title") <> ''::"text")),
    -- WS C: PHI disposal is one-shot and its justification is a CONSTRAINED CATEGORY
    -- (PHI-safe, LGPD Art. 18 accountability) — never free text. NULL until disposed.
    CONSTRAINT "patient_safety_event_phi_disposed_reason_check" CHECK (("phi_disposed_reason" IS NULL OR "phi_disposed_reason" = ANY (ARRAY['retention_expired'::"text", 'subject_request'::"text", 'entered_in_error'::"text", 'duplicate'::"text", 'other'::"text"])))
);

ALTER TABLE "public"."patient_safety_event" OWNER TO "postgres";

COMMENT ON TABLE "public"."patient_safety_event" IS 'Patient-safety event GOVERNANCE METADATA — no patient identifiers (those are isolated on public.event_patient, B3). current_owner_* is the denormalized head of the public.event_custody ledger and drives access-follows-custody RLS (ADR 0031).';

COMMENT ON COLUMN "public"."patient_safety_event"."description_md" IS 'Reporter narrative — SANITIZED Markdown (Rule 7). Clinical free text; NEVER copied into the audit log (Rule 11).';

COMMENT ON COLUMN "public"."patient_safety_event"."has_patient" IS 'Denormalized "an isolated event_patient (PHI) row exists" flag (WS A). Set true by set_event_patient, false by PHI disposal (WS C). Lets governance/list reads derive hasPatient WITHOUT the event_patient(event_id) embed, which breaks once direct SELECT on event_patient is revoked.';

COMMENT ON COLUMN "public"."patient_safety_event"."phi_disposed_at" IS 'WS C: when the event PHI was disposed (NULL until disposal). PHI-safe accountability stamp set by dispose_event_phi; one-shot.';
COMMENT ON COLUMN "public"."patient_safety_event"."phi_disposed_by" IS 'WS C: who disposed the event PHI (NULL until disposal). PHI-safe accountability stamp set by dispose_event_phi.';
COMMENT ON COLUMN "public"."patient_safety_event"."phi_disposed_reason" IS 'WS C: WHY the PHI was disposed — a CONSTRAINED CATEGORY (retention_expired/subject_request/entered_in_error/duplicate/other), NEVER free text (Rule 11 + LGPD Art. 18). NULL until disposal.';

CREATE OR REPLACE FUNCTION "public"."acknowledge_event"("p_event_id" "uuid") RETURNS "public"."patient_safety_event"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_event public.patient_safety_event;
  v_status text;
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  if not app.event_current_custodian(p_event_id, auth.uid()) then
    raise exception 'apenas quem detém a custódia do evento pode reconhecê-lo'
      using errcode = 'HC044';
  end if;

  select status into v_status from public.patient_safety_event where id = p_event_id;
  if v_status <> 'reported' then
    raise exception 'apenas eventos notificados podem ser reconhecidos' using errcode = 'HC043';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.patient_safety_event
  set status = 'acknowledged', acknowledged_by = auth.uid(), acknowledged_at = now(),
      updated_at = now()
  where id = p_event_id
  returning * into v_event;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_event;
end;
$$;

ALTER FUNCTION "public"."acknowledge_event"("p_event_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_capa_action"("p_capa_id" "uuid", "p_title" "text", "p_owner" "text" DEFAULT NULL::"text", "p_assignee_user_id" "uuid" DEFAULT NULL::"uuid", "p_due_date" "date" DEFAULT NULL::"date", "p_action_strength" "text" DEFAULT 'intermediaria'::"text", "p_success_measure" "text" DEFAULT NULL::"text", "p_root_cause_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."capa_action"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.capa_action;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_capa_writable(p_capa_id);
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe um título para a ação corretiva' using errcode = 'check_violation';
  end if;
  if coalesce(p_action_strength, 'intermediaria') not in ('forte', 'intermediaria', 'fraca') then
    raise exception 'força da ação inválida' using errcode = 'check_violation';
  end if;
  if p_assignee_user_id is not null
     and not exists (select 1 from public.profiles where id = p_assignee_user_id) then
    raise exception 'responsável não encontrado' using errcode = 'no_data_found';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.capa_plan set status = 'em_execucao', updated_at = now()
  where id = p_capa_id and status = 'aberto';
  insert into public.capa_action (
    capa_id, title, owner, assignee_user_id, due_date, action_strength,
    success_measure, root_cause_id, position
  ) values (
    p_capa_id, btrim(p_title), p_owner, p_assignee_user_id, p_due_date,
    coalesce(p_action_strength, 'intermediaria'), p_success_measure, p_root_cause_id,
    coalesce((select max(position) from public.capa_action where capa_id = p_capa_id), 0) + 1
  )
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."add_capa_action"("p_capa_id" "uuid", "p_title" "text", "p_owner" "text", "p_assignee_user_id" "uuid", "p_due_date" "date", "p_action_strength" "text", "p_success_measure" "text", "p_root_cause_id" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."capa_action_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "storage_path" "text",
    "external_url" "text",
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "capa_action_evidence_https" CHECK ((("external_url" IS NULL) OR ("external_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "capa_action_evidence_kind_check" CHECK (("kind" = ANY (ARRAY['document'::"text", 'link'::"text"]))),
    CONSTRAINT "capa_action_evidence_shape" CHECK (((("kind" = 'document'::"text") AND ("storage_path" IS NOT NULL) AND ("external_url" IS NULL)) OR (("kind" = 'link'::"text") AND ("external_url" IS NOT NULL) AND ("storage_path" IS NULL)))),
    CONSTRAINT "capa_action_evidence_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);

ALTER TABLE "public"."capa_action_evidence" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_capa_action_evidence"("p_action_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text" DEFAULT NULL::"text", "p_external_url" "text" DEFAULT NULL::"text") RETURNS "public"."capa_action_evidence"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_capa_id uuid;
  v_row public.capa_action_evidence;
begin
  perform app.assert_patient_safety_enabled();
  select capa_id into v_capa_id from public.capa_action where id = p_action_id;
  if v_capa_id is null then
    raise exception 'ação não encontrada' using errcode = 'no_data_found';
  end if;
  perform app.assert_capa_writable(v_capa_id);
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe um título para a evidência' using errcode = 'check_violation';
  end if;
  if p_kind = 'document' then
    if p_storage_path is null or p_external_url is not null then
      raise exception 'informe um arquivo OU um link para a evidência' using errcode = 'check_violation';
    end if;
  elsif p_kind = 'link' then
    if p_external_url is null or p_storage_path is not null then
      raise exception 'informe um arquivo OU um link para a evidência' using errcode = 'check_violation';
    end if;
    if p_external_url not like 'https://%' then
      raise exception 'o link deve começar com https://' using errcode = 'check_violation';
    end if;
  else
    raise exception 'tipo de evidência inválido' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  insert into public.capa_action_evidence (action_id, kind, title, storage_path, external_url, created_by)
  values (p_action_id, p_kind, btrim(p_title), p_storage_path, p_external_url, auth.uid())
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."add_capa_action_evidence"("p_action_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text", "p_external_url" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."capa_action_task" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "is_done" boolean DEFAULT false NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "capa_action_task_desc_not_blank" CHECK (("btrim"("description") <> ''::"text"))
);

ALTER TABLE "public"."capa_action_task" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_capa_action_task"("p_action_id" "uuid", "p_description" "text") RETURNS "public"."capa_action_task"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_capa_id uuid;
  v_row public.capa_action_task;
begin
  perform app.assert_patient_safety_enabled();
  select capa_id into v_capa_id from public.capa_action where id = p_action_id;
  if v_capa_id is null then
    raise exception 'ação não encontrada' using errcode = 'no_data_found';
  end if;
  perform app.assert_capa_writable(v_capa_id);
  if btrim(coalesce(p_description, '')) = '' then
    raise exception 'descreva a etapa de execução' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  insert into public.capa_action_task (action_id, description, position)
  values (p_action_id, p_description,
          coalesce((select max(position) from public.capa_action_task where action_id = p_action_id), 0) + 1)
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."add_capa_action_task"("p_action_id" "uuid", "p_description" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."capa_measure" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "capa_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "target" "text",
    "definition" "text",
    "indicator_id" "uuid",
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "capa_measure_name_not_blank" CHECK (("btrim"("name") <> ''::"text"))
);

ALTER TABLE "public"."capa_measure" OWNER TO "postgres";

COMMENT ON COLUMN "public"."capa_measure"."indicator_id" IS 'FK-LESS forward hook (Phase 15 — public.indicators). Add the FK then.';

CREATE OR REPLACE FUNCTION "public"."add_capa_measure"("p_capa_id" "uuid", "p_name" "text", "p_target" "text" DEFAULT NULL::"text", "p_definition" "text" DEFAULT NULL::"text") RETURNS "public"."capa_measure"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.capa_measure;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_capa_writable(p_capa_id);
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'informe um nome para o indicador de medida' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  insert into public.capa_measure (capa_id, name, target, definition, position)
  values (p_capa_id, p_name, p_target, p_definition,
          coalesce((select max(position) from public.capa_measure where capa_id = p_capa_id), 0) + 1)
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."add_capa_measure"("p_capa_id" "uuid", "p_name" "text", "p_target" "text", "p_definition" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."rca_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rca_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "title" "text" NOT NULL,
    "storage_path" "text",
    "external_url" "text",
    "cited_interview_id" "uuid",
    "cited_meeting_id" "uuid",
    "cited_document_id" "uuid",
    "citation_label" "text",
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rca_evidence_https" CHECK ((("external_url" IS NULL) OR ("external_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "rca_evidence_kind_check" CHECK (("kind" = ANY (ARRAY['document'::"text", 'link'::"text", 'citation'::"text"]))),
    CONSTRAINT "rca_evidence_shape" CHECK (((("kind" = 'document'::"text") AND ("storage_path" IS NOT NULL) AND ("external_url" IS NULL) AND ("cited_interview_id" IS NULL) AND ("cited_meeting_id" IS NULL) AND ("cited_document_id" IS NULL)) OR (("kind" = 'link'::"text") AND ("external_url" IS NOT NULL) AND ("storage_path" IS NULL) AND ("cited_interview_id" IS NULL) AND ("cited_meeting_id" IS NULL) AND ("cited_document_id" IS NULL)) OR (("kind" = 'citation'::"text") AND ("storage_path" IS NULL) AND ("external_url" IS NULL) AND ("citation_label" IS NOT NULL) AND ((((("cited_interview_id" IS NOT NULL))::integer + (("cited_meeting_id" IS NOT NULL))::integer) + (("cited_document_id" IS NOT NULL))::integer) = 1)))),
    CONSTRAINT "rca_evidence_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);

ALTER TABLE "public"."rca_evidence" OWNER TO "postgres";

COMMENT ON TABLE "public"."rca_evidence" IS 'RCA evidence (Phase 14c): an uploaded file (immutable nsp-evidence bucket) XOR an https link XOR a citation (snapshot label) to an existing interview/meeting/document. Soft-delete only; objects are never removed (Rule 6).';

CREATE OR REPLACE FUNCTION "public"."add_rca_evidence"("p_rca_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text" DEFAULT NULL::"text", "p_external_url" "text" DEFAULT NULL::"text", "p_citation_target" "text" DEFAULT NULL::"text", "p_cited_entity_id" "uuid" DEFAULT NULL::"uuid", "p_citation_label" "text" DEFAULT NULL::"text") RETURNS "public"."rca_evidence"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.rca_evidence;
  v_interview uuid;
  v_meeting uuid;
  v_document uuid;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_rca_writable(p_rca_id);

  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe um título para a evidência' using errcode = 'check_violation';
  end if;
  if p_kind not in ('document', 'link', 'citation') then
    raise exception 'tipo de evidência inválido' using errcode = 'check_violation';
  end if;

  -- Pre-validate the three-way shape (DISTINCT message; the table CHECK is the backstop).
  if p_kind = 'document' then
    if p_storage_path is null or p_external_url is not null or p_cited_entity_id is not null then
      raise exception 'informe exatamente um tipo de evidência: arquivo, link ou citação'
        using errcode = 'check_violation';
    end if;
  elsif p_kind = 'link' then
    if p_external_url is null or p_storage_path is not null or p_cited_entity_id is not null then
      raise exception 'informe exatamente um tipo de evidência: arquivo, link ou citação'
        using errcode = 'check_violation';
    end if;
    if p_external_url not like 'https://%' then
      raise exception 'o link deve começar com https://' using errcode = 'check_violation';
    end if;
  else -- citation
    if p_citation_target not in ('interview', 'meeting', 'document')
       or p_cited_entity_id is null or p_storage_path is not null or p_external_url is not null then
      raise exception 'informe exatamente um tipo de evidência: arquivo, link ou citação'
        using errcode = 'check_violation';
    end if;
    if btrim(coalesce(p_citation_label, '')) = '' then
      raise exception 'informe um rótulo para a citação' using errcode = 'check_violation';
    end if;
    -- Route the entity id to the matching typed column.
    if p_citation_target = 'interview' then v_interview := p_cited_entity_id;
    elsif p_citation_target = 'meeting' then v_meeting := p_cited_entity_id;
    else v_document := p_cited_entity_id;
    end if;
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform app.rca_bump_in_progress(p_rca_id);
  insert into public.rca_evidence (
    rca_id, kind, title, storage_path, external_url,
    cited_interview_id, cited_meeting_id, cited_document_id, citation_label, created_by
  ) values (
    p_rca_id, p_kind, btrim(p_title),
    p_storage_path, p_external_url,
    v_interview, v_meeting, v_document,
    case when p_kind = 'citation' then btrim(p_citation_label) else null end,
    auth.uid()
  )
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."add_rca_evidence"("p_rca_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text", "p_external_url" "text", "p_citation_target" "text", "p_cited_entity_id" "uuid", "p_citation_label" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."rca_factors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rca_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "text" "text" NOT NULL,
    "is_key" boolean DEFAULT false NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rca_factors_category_check" CHECK (("category" = ANY (ARRAY['people'::"text", 'communication'::"text", 'process'::"text", 'equipment'::"text", 'environment'::"text", 'policy'::"text"]))),
    CONSTRAINT "rca_factors_text_not_blank" CHECK (("btrim"("text") <> ''::"text"))
);

ALTER TABLE "public"."rca_factors" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_rca_factor"("p_rca_id" "uuid", "p_category" "text", "p_text" "text") RETURNS "public"."rca_factors"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.rca_factors;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_rca_writable(p_rca_id);
  if p_category not in ('people', 'communication', 'process', 'equipment', 'environment', 'policy') then
    raise exception 'categoria inválida' using errcode = 'check_violation';
  end if;
  if btrim(coalesce(p_text, '')) = '' then
    raise exception 'descreva o fator' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform app.rca_bump_in_progress(p_rca_id);
  insert into public.rca_factors (rca_id, category, text, position)
  values (p_rca_id, p_category, p_text,
          coalesce((select max(position) from public.rca_factors where rca_id = p_rca_id), 0) + 1)
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."add_rca_factor"("p_rca_id" "uuid", "p_category" "text", "p_text" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."rca_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rca_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "external_name" "text",
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rca_members_identity_shape" CHECK (((("user_id" IS NOT NULL) AND ("external_name" IS NULL)) OR (("user_id" IS NULL) AND ("external_name" IS NOT NULL) AND ("btrim"("external_name") <> ''::"text")))),
    CONSTRAINT "rca_members_role_check" CHECK (("role" = ANY (ARRAY['lead'::"text", 'facilitator'::"text", 'sme'::"text", 'reviewer'::"text", 'executive_sponsor'::"text", 'observer'::"text"])))
);

ALTER TABLE "public"."rca_members" OWNER TO "postgres";

COMMENT ON TABLE "public"."rca_members" IS 'RCA team (Phase 14c). user_id XOR external_name; a non-observer platform-user member gains row-level write via app.can_write_rca (the interviews participant grant).';

CREATE OR REPLACE FUNCTION "public"."add_rca_member"("p_rca_id" "uuid", "p_role" "text", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_external_name" "text" DEFAULT NULL::"text") RETURNS "public"."rca_members"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.rca_members;
begin
  perform app.assert_patient_safety_enabled();

  if (select event_id from public.rca where id = p_rca_id) is null then
    raise exception 'análise de causa raiz não encontrada' using errcode = 'no_data_found';
  end if;
  -- Bootstrap: PQS/admin OR an existing writer may add members.
  if not (app.is_pqs_member(auth.uid()) or app.can_write_rca(p_rca_id, auth.uid())) then
    raise exception 'você não pode editar esta análise de causa raiz' using errcode = 'HC048';
  end if;

  if p_role not in ('lead', 'facilitator', 'sme', 'reviewer', 'executive_sponsor', 'observer') then
    raise exception 'função inválida' using errcode = 'check_violation';
  end if;
  -- Pre-validate the user-XOR-external shape with a DISTINCT message.
  if not (
    (p_user_id is not null and (p_external_name is null or btrim(p_external_name) = ''))
    or (p_user_id is null and p_external_name is not null and btrim(p_external_name) <> '')
  ) then
    raise exception 'informe um usuário da plataforma OU um nome externo para o integrante'
      using errcode = 'check_violation';
  end if;
  if p_user_id is not null and not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'usuário não encontrado' using errcode = 'no_data_found';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform app.rca_bump_in_progress(p_rca_id);
  insert into public.rca_members (rca_id, user_id, external_name, role)
  values (p_rca_id, p_user_id, case when p_user_id is null then btrim(p_external_name) else null end, p_role)
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_row;
end;
$$;

ALTER FUNCTION "public"."add_rca_member"("p_rca_id" "uuid", "p_role" "text", "p_user_id" "uuid", "p_external_name" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."rca_root_causes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rca_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "category" "text",
    "classification" "text" DEFAULT 'system'::"text" NOT NULL,
    "type" "text" DEFAULT 'root'::"text" NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rca_root_causes_category_check" CHECK ((("category" IS NULL) OR ("category" = ANY (ARRAY['people'::"text", 'communication'::"text", 'process'::"text", 'equipment'::"text", 'environment'::"text", 'policy'::"text"])))),
    CONSTRAINT "rca_root_causes_classification_check" CHECK (("classification" = ANY (ARRAY['system'::"text", 'human'::"text", 'environment'::"text", 'external'::"text"]))),
    CONSTRAINT "rca_root_causes_text_not_blank" CHECK (("btrim"("text") <> ''::"text")),
    CONSTRAINT "rca_root_causes_type_check" CHECK (("type" = ANY (ARRAY['root'::"text", 'contributing'::"text"])))
);

ALTER TABLE "public"."rca_root_causes" OWNER TO "postgres";

COMMENT ON TABLE "public"."rca_root_causes" IS 'Distilled RCA root causes (Phase 14c, stage 3). The `id` PK is the STABLE FK target for Phase-14d capa_action.root_cause_id — do not repurpose it.';

CREATE OR REPLACE FUNCTION "public"."add_rca_root_cause"("p_rca_id" "uuid", "p_text" "text", "p_category" "text" DEFAULT NULL::"text", "p_classification" "text" DEFAULT 'system'::"text", "p_type" "text" DEFAULT 'root'::"text") RETURNS "public"."rca_root_causes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.rca_root_causes;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_rca_writable(p_rca_id);
  if btrim(coalesce(p_text, '')) = '' then
    raise exception 'descreva a causa raiz' using errcode = 'check_violation';
  end if;
  if p_category is not null
     and p_category not in ('people', 'communication', 'process', 'equipment', 'environment', 'policy') then
    raise exception 'categoria inválida' using errcode = 'check_violation';
  end if;
  if coalesce(p_classification, 'system') not in ('system', 'human', 'environment', 'external') then
    raise exception 'classificação inválida' using errcode = 'check_violation';
  end if;
  if coalesce(p_type, 'root') not in ('root', 'contributing') then
    raise exception 'tipo inválido' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform app.rca_bump_in_progress(p_rca_id);
  insert into public.rca_root_causes (rca_id, text, category, classification, type, position)
  values (p_rca_id, p_text, p_category, coalesce(p_classification, 'system'), coalesce(p_type, 'root'),
          coalesce((select max(position) from public.rca_root_causes where rca_id = p_rca_id), 0) + 1)
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."add_rca_root_cause"("p_rca_id" "uuid", "p_text" "text", "p_category" "text", "p_classification" "text", "p_type" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."rca_timeline_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rca_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "description" "text" NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rca_timeline_description_not_blank" CHECK (("btrim"("description") <> ''::"text"))
);

ALTER TABLE "public"."rca_timeline_entries" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_rca_timeline_entry"("p_rca_id" "uuid", "p_occurred_at" timestamp with time zone, "p_description" "text") RETURNS "public"."rca_timeline_entries"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.rca_timeline_entries;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_rca_writable(p_rca_id);
  if btrim(coalesce(p_description, '')) = '' then
    raise exception 'descreva o que ocorreu neste ponto da linha do tempo' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  perform app.rca_bump_in_progress(p_rca_id);
  insert into public.rca_timeline_entries (rca_id, occurred_at, description, position)
  values (p_rca_id, p_occurred_at, p_description,
          coalesce((select max(position) from public.rca_timeline_entries where rca_id = p_rca_id), 0) + 1)
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."add_rca_timeline_entry"("p_rca_id" "uuid", "p_occurred_at" timestamp with time zone, "p_description" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."advance_capa_action"("p_action_id" "uuid", "p_status" "text") RETURNS "public"."capa_action"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_patient_safety_enabled();
  return app.advance_capa_action_core(p_action_id, p_status);
end;
$$;

ALTER FUNCTION "public"."advance_capa_action"("p_action_id" "uuid", "p_status" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pqs_event_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "position" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pqs_event_types_key_not_blank" CHECK (("btrim"("key") <> ''::"text")),
    CONSTRAINT "pqs_event_types_label_not_blank" CHECK (("btrim"("label") <> ''::"text"))
);

ALTER TABLE "public"."pqs_event_types" OWNER TO "postgres";

COMMENT ON TABLE "public"."pqs_event_types" IS 'Configurable event-type vocabulary (Phase 14b). Non-PHI; any-authenticated READ, is_pqs_member-gated CRUD. FK target of patient_safety_event.event_type_id.';

CREATE OR REPLACE FUNCTION "public"."archive_event_type"("p_id" "uuid") RETURNS "public"."pqs_event_types"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.pqs_event_types;
begin
  perform app.assert_patient_safety_enabled();
  if not app.is_pqs_member(auth.uid()) then
    raise exception 'apenas o NSP pode gerenciar tipos de evento' using errcode = '42501';
  end if;
  update public.pqs_event_types
  set is_active = false, updated_at = now()
  where id = p_id
  returning * into v_row;
  if not found then
    raise exception 'tipo de evento não encontrado' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

ALTER FUNCTION "public"."archive_event_type"("p_id" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pqs_sentinel_criteria" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "position" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pqs_sentinel_criteria_key_not_blank" CHECK (("btrim"("key") <> ''::"text")),
    CONSTRAINT "pqs_sentinel_criteria_label_not_blank" CHECK (("btrim"("label") <> ''::"text"))
);

ALTER TABLE "public"."pqs_sentinel_criteria" OWNER TO "postgres";

COMMENT ON TABLE "public"."pqs_sentinel_criteria" IS 'Configurable always-review sentinel checklist (Phase 14b; JC designated categories). Any active criterion flagged on a worksheet auto-qualifies the event as sentinel.';

CREATE OR REPLACE FUNCTION "public"."archive_sentinel_criterion"("p_id" "uuid") RETURNS "public"."pqs_sentinel_criteria"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.pqs_sentinel_criteria;
begin
  perform app.assert_patient_safety_enabled();
  if not app.is_pqs_member(auth.uid()) then
    raise exception 'apenas o NSP pode gerenciar critérios de evento sentinela' using errcode = '42501';
  end if;
  update public.pqs_sentinel_criteria
  set is_active = false, updated_at = now()
  where id = p_id
  returning * into v_row;
  if not found then
    raise exception 'critério não encontrado' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

ALTER FUNCTION "public"."archive_sentinel_criterion"("p_id" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."capa_plan" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "source" "text" NOT NULL,
    "source_rca_id" "uuid",
    "source_event_id" "uuid",
    "source_meeting_id" "uuid",
    "source_indicator_id" "uuid",
    "source_audit_finding_id" "uuid",
    "classification" "text" DEFAULT 'corretiva'::"text" NOT NULL,
    "status" "text" DEFAULT 'aberto'::"text" NOT NULL,
    "lessons_learned_md" "text",
    "opened_by" "uuid",
    "closed_by" "uuid",
    "closed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "capa_plan_classification_check" CHECK (("classification" = ANY (ARRAY['corretiva'::"text", 'preventiva'::"text", 'melhoria'::"text"]))),
    CONSTRAINT "capa_plan_source_check" CHECK (("source" = ANY (ARRAY['rca'::"text", 'event'::"text", 'indicator'::"text", 'audit_finding'::"text", 'meeting'::"text", 'manual'::"text"]))),
    CONSTRAINT "capa_plan_source_shape" CHECK (((("source" = 'rca'::"text") AND ("source_rca_id" IS NOT NULL) AND ("source_event_id" IS NULL) AND ("source_meeting_id" IS NULL) AND ("source_indicator_id" IS NULL) AND ("source_audit_finding_id" IS NULL)) OR (("source" = 'event'::"text") AND ("source_event_id" IS NOT NULL) AND ("source_rca_id" IS NULL) AND ("source_meeting_id" IS NULL) AND ("source_indicator_id" IS NULL) AND ("source_audit_finding_id" IS NULL)) OR (("source" = 'meeting'::"text") AND ("source_meeting_id" IS NOT NULL) AND ("source_rca_id" IS NULL) AND ("source_event_id" IS NULL) AND ("source_indicator_id" IS NULL) AND ("source_audit_finding_id" IS NULL)) OR (("source" = 'indicator'::"text") AND ("source_indicator_id" IS NOT NULL) AND ("source_rca_id" IS NULL) AND ("source_event_id" IS NULL) AND ("source_meeting_id" IS NULL) AND ("source_audit_finding_id" IS NULL)) OR (("source" = 'audit_finding'::"text") AND ("source_audit_finding_id" IS NOT NULL) AND ("source_rca_id" IS NULL) AND ("source_event_id" IS NULL) AND ("source_meeting_id" IS NULL) AND ("source_indicator_id" IS NULL)) OR (("source" = 'manual'::"text") AND ("source_rca_id" IS NULL) AND ("source_event_id" IS NULL) AND ("source_meeting_id" IS NULL) AND ("source_indicator_id" IS NULL) AND ("source_audit_finding_id" IS NULL)))),
    CONSTRAINT "capa_plan_status_check" CHECK (("status" = ANY (ARRAY['aberto'::"text", 'em_execucao'::"text", 'em_verificacao'::"text", 'concluido'::"text", 'cancelado'::"text"])))
);

ALTER TABLE "public"."capa_plan" OWNER TO "postgres";

COMMENT ON TABLE "public"."capa_plan" IS 'The reusable CAPA primitive (Phase 14d; ADR 0034). source polymorphism: rca/event/meeting have real FKs; indicator (Phase 15) / audit_finding (Phase 18) are FK-less forward hooks. lessons_learned_md is sanitized Markdown — NEVER audited (Rule 11).';

-- WS E / M4 (efficiency note, no change): the source polymorphism is encoded as a
-- single growing `capa_plan_source_shape` CHECK — every new source kind adds one
-- exactly-one-source-FK branch (already 6: rca/event/meeting/indicator/audit_finding/
-- manual), and each new source FK column widens every branch. This is acceptable
-- while sources are few, but if the set keeps growing the cleaner model is a
-- satellite link table per source (or a single (source_kind, source_id) pair without
-- per-kind FKs). REVISIT before Phase 18 (audit_finding) lands a 6th real FK.
COMMENT ON COLUMN "public"."capa_plan"."source" IS 'CAPA source-kind discriminator (rca/event/meeting/indicator/audit_finding/manual). Exactly-one matching source_*_id enforced by capa_plan_source_shape — see the table-level WS E/M4 note on the per-source CHECK growth cost + the satellite-table alternative to revisit before Phase 18.';

COMMENT ON COLUMN "public"."capa_plan"."source_indicator_id" IS 'FK-LESS forward hook (Phase 15 — public.indicators). Add the FK then (cf. 14a event_type_id).';

COMMENT ON COLUMN "public"."capa_plan"."source_audit_finding_id" IS 'FK-LESS forward hook (Phase 18 — public.audit_findings). Add the FK then.';

CREATE OR REPLACE FUNCTION "public"."cancel_capa_plan"("p_capa_id" "uuid") RETURNS "public"."capa_plan"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_plan public.capa_plan;
  v_status text;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_capa_writable(p_capa_id);
  select status into v_status from public.capa_plan where id = p_capa_id;
  if v_status in ('concluido', 'cancelado') then
    raise exception 'este plano já está em um estado final' using errcode = 'HC053';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.capa_plan set status = 'cancelado', closed_by = auth.uid(), closed_at = now(), updated_at = now()
  where id = p_capa_id
  returning * into v_plan;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_plan;
end;
$$;

ALTER FUNCTION "public"."cancel_capa_plan"("p_capa_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."cancel_event"("p_event_id" "uuid") RETURNS "public"."patient_safety_event"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_event public.patient_safety_event;
  v_status text;
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  if not app.event_current_custodian(p_event_id, auth.uid()) then
    raise exception 'apenas quem detém a custódia do evento pode cancelá-lo'
      using errcode = 'HC044';
  end if;

  select status into v_status from public.patient_safety_event where id = p_event_id;
  if v_status in ('closed', 'cancelled') then
    raise exception 'este evento já está em um estado final' using errcode = 'HC043';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.patient_safety_event
  set status = 'cancelled', closed_by = auth.uid(), closed_at = now(), updated_at = now()
  where id = p_event_id
  returning * into v_event;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_event;
end;
$$;

ALTER FUNCTION "public"."cancel_event"("p_event_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."capa_kpis"() RETURNS TABLE("open_count" integer, "in_verification" integer, "overdue_actions" integer, "closed_ytd" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select
    coalesce(count(*) filter (where p.status in ('aberto', 'em_execucao', 'em_verificacao')), 0)::int,
    coalesce(count(*) filter (where p.status = 'em_verificacao'), 0)::int,
    coalesce((
      select count(*) from public.capa_action a
      where a.due_date < current_date and a.status not in ('concluida', 'cancelada')
    ), 0)::int,
    coalesce(count(*) filter (
      where p.status = 'concluido' and p.closed_at >= date_trunc('year', current_date)
    ), 0)::int
  from public.capa_plan p
  where app.is_pqs_member(auth.uid());
$$;

ALTER FUNCTION "public"."capa_kpis"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."capa_viewer_can_manage"("p_capa_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  -- The plan must be readable (scope) AND the viewer a PQS/admin writer.
  select app.can_read_capa(p_capa_id, auth.uid()) and app.is_pqs_writer();
$$;

ALTER FUNCTION "public"."capa_viewer_can_manage"("p_capa_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."close_capa_plan"("p_capa_id" "uuid", "p_lessons_learned_md" "text" DEFAULT NULL::"text") RETURNS "public"."capa_plan"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_plan public.capa_plan;
  v_status text;
  v_event uuid;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_capa_writable(p_capa_id);

  select status into v_status from public.capa_plan where id = p_capa_id;
  if v_status not in ('em_execucao', 'em_verificacao') then
    raise exception 'apenas um plano em execução ou verificação pode ser encerrado'
      using errcode = 'HC049';
  end if;
  -- Conclude gate: no unsettled (non-terminal) action.
  if exists (
    select 1 from public.capa_action
    where capa_id = p_capa_id and status not in ('concluida', 'cancelada')
  ) then
    raise exception 'conclua ou cancele todas as ações antes de encerrar o plano'
      using errcode = 'HC051';
  end if;
  -- Conclude gate: an effectiveness verdict is required.
  if not exists (select 1 from public.capa_effectiveness where capa_id = p_capa_id) then
    raise exception 'registre a verificação de eficácia antes de encerrar o plano'
      using errcode = 'HC052';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.capa_plan
  set status = 'concluido', lessons_learned_md = p_lessons_learned_md,
      closed_by = auth.uid(), closed_at = now(), updated_at = now()
  where id = p_capa_id
  returning * into v_plan;

  -- Close->event side effect (best-effort): if the event is fully settled + triaged.
  v_event := app.event_of_capa(p_capa_id);
  if v_event is not null and app.event_capa_fully_settled(v_event) then
    update public.patient_safety_event
    set status = 'closed', closed_by = auth.uid(), closed_at = now(), updated_at = now()
    where id = v_event and status = 'triaged';
  end if;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_plan;
end;
$$;

ALTER FUNCTION "public"."close_capa_plan"("p_capa_id" "uuid", "p_lessons_learned_md" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."complete_capa_action"("p_action_id" "uuid") RETURNS "public"."capa_action"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_patient_safety_enabled();
  return app.advance_capa_action_core(p_action_id, 'concluida');
end;
$$;

ALTER FUNCTION "public"."complete_capa_action"("p_action_id" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."rca" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "due_date" "date",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "what_md" "text",
    "expected_md" "text",
    "detected" "text",
    "impact" "text",
    "scope" "text",
    "summary_md" "text",
    "submitted_by" "uuid",
    "submitted_at" timestamp with time zone,
    "completed_by" "uuid",
    "completed_at" timestamp with time zone,
    CONSTRAINT "rca_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'in_progress'::"text", 'in_review'::"text", 'completed'::"text"])))
);

ALTER TABLE "public"."rca" OWNER TO "postgres";

COMMENT ON TABLE "public"."rca" IS 'FORWARD-SAFE RCA shell (Phase 14b seam; ADR 0032). Created by confirm_triage when pathway = rca, with the configurable 45-day due_date. Phase 14c EXTENDS this table (its ALTERs must tolerate pre-existing rows: nullable/defaulted columns only).';

COMMENT ON COLUMN "public"."rca"."what_md" IS 'Problem statement (what happened) — SANITIZED Markdown (Rule 7). Clinical free text; NEVER copied into the audit log (Rule 11).';

COMMENT ON COLUMN "public"."rca"."summary_md" IS 'Findings narrative — SANITIZED Markdown (Rule 7). NEVER audited as a body.';

CREATE OR REPLACE FUNCTION "public"."complete_rca"("p_rca_id" "uuid") RETURNS "public"."rca"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rca public.rca;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_rca_writable(p_rca_id);

  if (select status from public.rca where id = p_rca_id) <> 'in_review' then
    raise exception 'apenas uma análise em revisão pode ser concluída' using errcode = 'HC047';
  end if;
  if not exists (select 1 from public.rca_root_causes where rca_id = p_rca_id) then
    raise exception 'conclua a análise com ao menos uma causa raiz identificada'
      using errcode = 'HC047';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.rca
  set status = 'completed', completed_by = auth.uid(), completed_at = now(), updated_at = now()
  where id = p_rca_id
  returning * into v_rca;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_rca;
end;
$$;

ALTER FUNCTION "public"."complete_rca"("p_rca_id" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."event_triage" (
    "event_id" "uuid" NOT NULL,
    "is_pse" boolean,
    "pse_closure_reason" "text",
    "reach" "text",
    "harm_severity" "text",
    "natural_course" boolean,
    "sentinel_determination" boolean DEFAULT false NOT NULL,
    "review_pathway" "text",
    "disposition_notes_md" "text",
    "triaged_by" "uuid",
    "triaged_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_triage_harm_severity_check" CHECK (("harm_severity" = ANY (ARRAY['none'::"text", 'mild'::"text", 'moderate'::"text", 'severe'::"text", 'permanent'::"text", 'death'::"text"]))),
    CONSTRAINT "event_triage_pse_closure_reason_check" CHECK (("pse_closure_reason" = ANY (ARRAY['natural'::"text", 'expected'::"text", 'nonclinical'::"text", 'duplicate'::"text"]))),
    CONSTRAINT "event_triage_pse_shape" CHECK ((("is_pse" IS NULL) OR (("is_pse" = false) AND ("pse_closure_reason" IS NOT NULL) AND ("reach" IS NULL) AND ("harm_severity" IS NULL)) OR (("is_pse" = true) AND ("pse_closure_reason" IS NULL)))),
    CONSTRAINT "event_triage_reach_check" CHECK (("reach" = ANY (ARRAY['unsafe'::"text", 'near_miss'::"text", 'no_harm'::"text", 'adverse'::"text", 'sentinel'::"text"]))),
    CONSTRAINT "event_triage_review_pathway_check" CHECK (("review_pathway" = ANY (ARRAY['rca'::"text", 'peer_review'::"text", 'mm'::"text", 'fmea'::"text", 'tracking_only'::"text"])))
);

ALTER TABLE "public"."event_triage" OWNER TO "postgres";

COMMENT ON TABLE "public"."event_triage" IS 'The 1:1 triage worksheet (Phase 14b). PHI-FREE governance metadata. Reach/harm are FIXED CHECK enums; sentinel_determination is auto-computed. Frozen once the parent event reaches "triaged" (app.guard_event_triage). disposition_notes_md is clinical free text — NEVER copied into the audit log (Rule 11).';

COMMENT ON COLUMN "public"."event_triage"."disposition_notes_md" IS 'Disposition notes — SANITIZED Markdown (Rule 7). Clinical free text; NEVER audited.';

CREATE OR REPLACE FUNCTION "public"."confirm_triage"("p_event_id" "uuid") RETURNS "public"."event_triage"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_triage public.event_triage;
  v_event public.patient_safety_event;
  v_due_days integer;
  v_anchor date;
  v_pathway text;
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  if not app.is_pqs_member(auth.uid()) then
    raise exception 'apenas o NSP pode triar eventos' using errcode = '42501';
  end if;

  select * into v_event from public.patient_safety_event where id = p_event_id;
  if v_event.status <> 'acknowledged' then
    raise exception 'a triagem só pode ser confirmada a partir de um evento reconhecido'
      using errcode = 'HC045';
  end if;

  select * into v_triage from public.event_triage where event_id = p_event_id;
  if not found or v_triage.is_pse is null then
    raise exception 'complete a triagem antes de confirmá-la' using errcode = 'HC046';
  end if;

  -- ---- not-a-PSE: record the closure reason, route the event to 'closed' ----
  if v_triage.is_pse = false then
    if v_triage.pse_closure_reason is null then
      raise exception 'selecione o motivo de encerramento' using errcode = 'HC046';
    end if;

    perform set_config('app.in_safety_rpc', 'on', true);
    update public.event_triage
    set review_pathway = null, triaged_by = auth.uid(), triaged_at = now(), updated_at = now()
    where event_id = p_event_id
    returning * into v_triage;

    update public.patient_safety_event
    set status = 'closed', closed_by = auth.uid(), closed_at = now(), updated_at = now()
    where id = p_event_id;
    perform set_config('app.in_safety_rpc', 'off', true);

    return v_triage;
  end if;

  -- ---- a PSE: require a reach; resolve the pathway under the sentinel rule ----
  if v_triage.reach is null then
    raise exception 'classifique o alcance do evento antes de confirmar' using errcode = 'HC046';
  end if;

  if v_triage.sentinel_determination then
    -- Sentinel ⇒ RCA is mandatory and non-overridable.
    if v_triage.review_pathway is not null and v_triage.review_pathway <> 'rca' then
      raise exception 'eventos sentinela exigem RCA — o desfecho não pode ser alterado'
        using errcode = 'HC046';
    end if;
    v_pathway := 'rca';
  else
    -- Non-sentinel PSE: keep the chosen pathway, default to peer review.
    v_pathway := coalesce(v_triage.review_pathway, 'peer_review');
    if v_pathway = 'rca' then
      -- Allowing a manual RCA on a non-sentinel PSE is fine (the NSP may escalate).
      null;
    end if;
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.event_triage
  set review_pathway = v_pathway, triaged_by = auth.uid(), triaged_at = now(), updated_at = now()
  where event_id = p_event_id
  returning * into v_triage;

  update public.patient_safety_event
  set status = 'triaged', updated_at = now()
  where id = p_event_id;

  -- Pathway = rca ⇒ mint the configurable due date + insert the forward-safe shell.
  if v_pathway = 'rca' then
    select rca_default_due_days into v_due_days
    from public.pqs_department order by created_at limit 1;
    v_due_days := coalesce(v_due_days, 45);
    v_anchor := coalesce(v_event.discovered_at, v_event.reported_at::date);

    insert into public.rca (event_id, status, due_date, created_by)
    values (p_event_id, 'draft', v_anchor + v_due_days, auth.uid())
    on conflict (event_id) do nothing;
  end if;

  perform set_config('app.in_safety_rpc', 'off', true);
  return v_triage;
end;
$$;

ALTER FUNCTION "public"."confirm_triage"("p_event_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_event_type"("p_key" "text", "p_label" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS "public"."pqs_event_types"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.pqs_event_types;
begin
  perform app.assert_patient_safety_enabled();
  if not app.is_pqs_member(auth.uid()) then
    raise exception 'apenas o NSP pode gerenciar tipos de evento' using errcode = '42501';
  end if;
  if btrim(coalesce(p_key, '')) = '' or btrim(coalesce(p_label, '')) = '' then
    raise exception 'informe um identificador e um rótulo' using errcode = 'check_violation';
  end if;
  insert into public.pqs_event_types (key, label, description, position)
  values (btrim(p_key), btrim(p_label), p_description,
          coalesce((select max(position) from public.pqs_event_types), 0) + 1)
  returning * into v_row;
  return v_row;
end;
$$;

ALTER FUNCTION "public"."create_event_type"("p_key" "text", "p_label" "text", "p_description" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_sentinel_criterion"("p_key" "text", "p_label" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS "public"."pqs_sentinel_criteria"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.pqs_sentinel_criteria;
begin
  perform app.assert_patient_safety_enabled();
  if not app.is_pqs_member(auth.uid()) then
    raise exception 'apenas o NSP pode gerenciar critérios de evento sentinela' using errcode = '42501';
  end if;
  if btrim(coalesce(p_key, '')) = '' or btrim(coalesce(p_label, '')) = '' then
    raise exception 'informe um identificador e um rótulo' using errcode = 'check_violation';
  end if;
  insert into public.pqs_sentinel_criteria (key, label, description, position)
  values (btrim(p_key), btrim(p_label), p_description,
          coalesce((select max(position) from public.pqs_sentinel_criteria), 0) + 1)
  returning * into v_row;
  return v_row;
end;
$$;

ALTER FUNCTION "public"."create_sentinel_criterion"("p_key" "text", "p_label" "text", "p_description" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."delete_capa_action_evidence"("p_evidence_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_capa_id uuid;
begin
  perform app.assert_patient_safety_enabled();
  select a.capa_id into v_capa_id
  from public.capa_action_evidence e join public.capa_action a on a.id = e.action_id
  where e.id = p_evidence_id;
  if v_capa_id is null then
    raise exception 'evidência não encontrada' using errcode = 'no_data_found';
  end if;
  perform app.assert_capa_writable(v_capa_id);

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.capa_action_evidence set deleted_at = now(), deleted_by = auth.uid()
  where id = p_evidence_id and deleted_at is null;
  perform set_config('app.in_safety_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."delete_capa_action_evidence"("p_evidence_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."delete_rca_evidence"("p_evidence_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rca_id uuid;
begin
  perform app.assert_patient_safety_enabled();
  select rca_id into v_rca_id from public.rca_evidence where id = p_evidence_id;
  if v_rca_id is null then
    raise exception 'evidência não encontrada' using errcode = 'no_data_found';
  end if;
  perform app.assert_rca_writable(v_rca_id);

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.rca_evidence
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_evidence_id and deleted_at is null;
  perform set_config('app.in_safety_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."delete_rca_evidence"("p_evidence_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."notify_safety_event"("p_reporting_commission_id" "uuid", "p_title" "text", "p_description_md" "text" DEFAULT NULL::"text", "p_suspected_harm_level" "text" DEFAULT 'unknown'::"text", "p_case_id" "uuid" DEFAULT NULL::"uuid", "p_event_type_id" "uuid" DEFAULT NULL::"uuid", "p_location" "text" DEFAULT NULL::"text", "p_discovered_at" "date" DEFAULT NULL::"date") RETURNS "public"."patient_safety_event"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_event public.patient_safety_event;
  v_attempts int := 0;
  v_case_commission uuid;
begin
  perform app.assert_patient_safety_enabled();

  -- Authorize: ANY member of the reporting commission (just-culture), or admin.
  if not (app.is_member_of(p_reporting_commission_id) or app.is_admin()) then
    raise exception 'apenas membros da comissão notificante podem registrar um evento'
      using errcode = '42501';
  end if;

  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe um título para o evento' using errcode = 'check_violation';
  end if;

  -- A case-linked event's case must belong to the reporting commission (honesty).
  if p_case_id is not null then
    select commission_id into v_case_commission from public.cases where id = p_case_id;
    if v_case_commission is null then
      raise exception 'caso não encontrado' using errcode = 'P0002';
    end if;
    if v_case_commission <> p_reporting_commission_id then
      raise exception 'o caso não pertence à comissão notificante' using errcode = 'check_violation';
    end if;
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);

  -- Insert with a bounded retry over the minted code (the trigger mints it; the
  -- unique(code) backstops a rare concurrent collision).
  loop
    begin
      insert into public.patient_safety_event (
        reporting_commission_id, case_id, discovered_at, location, reported_by,
        event_type_id, suspected_harm_level, title, description_md,
        status, current_owner_kind, current_owner_commission_id
      ) values (
        p_reporting_commission_id, p_case_id, p_discovered_at, p_location, auth.uid(),
        p_event_type_id, coalesce(p_suspected_harm_level, 'unknown'), p_title, p_description_md,
        'reported', 'pqs', null
      )
      returning * into v_event;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts >= 5 then raise; end if;
    end;
  end loop;

  -- Open the initial custody interval at the NSP.
  insert into public.event_custody (event_id, owner_kind, owner_commission_id, assigned_by, note)
  values (v_event.id, 'pqs', null, auth.uid(), 'Notificação inicial ao NSP');

  -- Case-linked: write the Phase-12 timeline entry (body is NOT NULL).
  if p_case_id is not null then
    insert into public.case_events (case_id, kind, title, body, occurred_at, created_by)
    values (
      p_case_id, 'safety_event',
      'Evento de segurança ' || v_event.code,
      'Evento ' || v_event.code || ' notificado ao NSP: ' || p_title,
      coalesce(p_discovered_at, current_date), auth.uid()
    );
  end if;

  perform set_config('app.in_safety_rpc', 'off', true);
  return v_event;
end;
$$;

ALTER FUNCTION "public"."notify_safety_event"("p_reporting_commission_id" "uuid", "p_title" "text", "p_description_md" "text", "p_suspected_harm_level" "text", "p_case_id" "uuid", "p_event_type_id" "uuid", "p_location" "text", "p_discovered_at" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."open_capa_plan"("p_source" "text", "p_classification" "text" DEFAULT 'corretiva'::"text", "p_source_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."capa_plan"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_plan public.capa_plan;
  v_attempts int := 0;
  v_rca uuid;
  v_event uuid;
  v_meeting uuid;
  v_indicator uuid;
  v_audit uuid;
begin
  perform app.assert_patient_safety_enabled();
  if not app.is_pqs_writer() then
    raise exception 'apenas o NSP pode abrir planos de ação' using errcode = '42501';
  end if;

  if p_source not in ('rca', 'event', 'indicator', 'audit_finding', 'meeting', 'manual') then
    raise exception 'origem de plano inválida' using errcode = 'check_violation';
  end if;
  if coalesce(p_classification, 'corretiva') not in ('corretiva', 'preventiva', 'melhoria') then
    raise exception 'classificação inválida' using errcode = 'check_violation';
  end if;

  -- Route the source id to the matching column; require it for non-manual sources.
  if p_source = 'manual' then
    if p_source_id is not null then
      raise exception 'um plano manual não tem origem vinculada' using errcode = 'check_violation';
    end if;
  elsif p_source_id is null then
    raise exception 'informe a origem do plano de ação' using errcode = 'check_violation';
  else
    case p_source
      when 'rca' then v_rca := p_source_id;
      when 'event' then v_event := p_source_id;
      when 'meeting' then v_meeting := p_source_id;
      when 'indicator' then v_indicator := p_source_id;
      when 'audit_finding' then v_audit := p_source_id;
    end case;
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  loop
    begin
      insert into public.capa_plan (
        source, source_rca_id, source_event_id, source_meeting_id,
        source_indicator_id, source_audit_finding_id, classification, opened_by
      ) values (
        p_source, v_rca, v_event, v_meeting, v_indicator, v_audit,
        coalesce(p_classification, 'corretiva'), auth.uid()
      )
      returning * into v_plan;
      exit;
    exception when unique_violation then
      v_attempts := v_attempts + 1;
      if v_attempts >= 5 then raise; end if;
    end;
  end loop;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_plan;
end;
$$;

ALTER FUNCTION "public"."open_capa_plan"("p_source" "text", "p_classification" "text", "p_source_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."patient_safety_enabled"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.feature_enabled('patient_safety');
$$;

ALTER FUNCTION "public"."patient_safety_enabled"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pqs_inbox"("p_status" "text" DEFAULT NULL::"text", "p_suspected_harm_level" "text" DEFAULT NULL::"text", "p_reporting_commission_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "code" "text", "title" "text", "status" "text", "suspected_harm_level" "text", "reporting_commission_id" "uuid", "reporting_commission_name" "text", "current_owner_kind" "text", "current_owner_commission_id" "uuid", "case_id" "uuid", "case_number" integer, "reported_at" timestamp with time zone, "acknowledged_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select
    e.id, e.code, e.title, e.status, e.suspected_harm_level,
    e.reporting_commission_id, rc.name,
    e.current_owner_kind, e.current_owner_commission_id,
    e.case_id, c.case_number,
    e.reported_at, e.acknowledged_at
  from public.patient_safety_event e
  join public.commissions rc on rc.id = e.reporting_commission_id
  left join public.cases c on c.id = e.case_id
  where app.is_pqs_member(auth.uid())
    and (p_status is null or e.status = p_status)
    and (p_suspected_harm_level is null or e.suspected_harm_level = p_suspected_harm_level)
    and (p_reporting_commission_id is null or e.reporting_commission_id = p_reporting_commission_id)
  order by e.reported_at desc;
$$;

ALTER FUNCTION "public"."pqs_inbox"("p_status" "text", "p_suspected_harm_level" "text", "p_reporting_commission_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."rca_writer_can_write"("p_rca_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.can_write_rca(p_rca_id, auth.uid());
$$;

ALTER FUNCTION "public"."rca_writer_can_write"("p_rca_id" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."capa_effectiveness" (
    "capa_id" "uuid" NOT NULL,
    "verdict" "text" NOT NULL,
    "method_md" "text",
    "verified_by" "uuid",
    "verified_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "capa_effectiveness_verdict_check" CHECK (("verdict" = ANY (ARRAY['eficaz'::"text", 'parcial'::"text", 'ineficaz'::"text"])))
);

ALTER TABLE "public"."capa_effectiveness" OWNER TO "postgres";

COMMENT ON TABLE "public"."capa_effectiveness" IS 'The 1:1 CAPA effectiveness verdict (Phase 14d). Required before close (HC052); revoked by reopen_capa_plan. method_md is sanitized Markdown — NEVER audited.';

CREATE OR REPLACE FUNCTION "public"."record_capa_effectiveness"("p_capa_id" "uuid", "p_verdict" "text", "p_method_md" "text" DEFAULT NULL::"text") RETURNS "public"."capa_effectiveness"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.capa_effectiveness;
  v_status text;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_capa_writable(p_capa_id);
  if p_verdict not in ('eficaz', 'parcial', 'ineficaz') then
    raise exception 'veredito de eficácia inválido' using errcode = 'check_violation';
  end if;

  select status into v_status from public.capa_plan where id = p_capa_id;

  perform set_config('app.in_safety_rpc', 'on', true);
  -- Advance em_execucao -> em_verificacao when the verdict is first recorded.
  if v_status = 'em_execucao' then
    update public.capa_plan set status = 'em_verificacao', updated_at = now() where id = p_capa_id;
  end if;

  insert into public.capa_effectiveness (capa_id, verdict, method_md, verified_by)
  values (p_capa_id, p_verdict, p_method_md, auth.uid())
  on conflict (capa_id) do update
  set verdict = excluded.verdict, method_md = excluded.method_md,
      verified_by = excluded.verified_by, verified_at = now(), updated_at = now()
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."record_capa_effectiveness"("p_capa_id" "uuid", "p_verdict" "text", "p_method_md" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."capa_measure_result" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "measure_id" "uuid" NOT NULL,
    "period" "text" NOT NULL,
    "value" numeric,
    "note" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "capa_measure_result_period_not_blank" CHECK (("btrim"("period") <> ''::"text"))
);

ALTER TABLE "public"."capa_measure_result" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."record_capa_measure_result"("p_measure_id" "uuid", "p_period" "text", "p_value" numeric DEFAULT NULL::numeric, "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."capa_measure_result"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_capa_id uuid;
  v_row public.capa_measure_result;
begin
  perform app.assert_patient_safety_enabled();
  select capa_id into v_capa_id from public.capa_measure where id = p_measure_id;
  if v_capa_id is null then
    raise exception 'medida não encontrada' using errcode = 'no_data_found';
  end if;
  perform app.assert_capa_writable(v_capa_id);
  if btrim(coalesce(p_period, '')) = '' then
    raise exception 'informe o período do resultado' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  insert into public.capa_measure_result (measure_id, period, value, note, created_by)
  values (p_measure_id, p_period, p_value, p_note, auth.uid())
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."record_capa_measure_result"("p_measure_id" "uuid", "p_period" "text", "p_value" numeric, "p_note" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."remove_capa_action"("p_action_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_capa_id uuid;
begin
  perform app.assert_patient_safety_enabled();
  select capa_id into v_capa_id from public.capa_action where id = p_action_id;
  if v_capa_id is null then
    raise exception 'ação não encontrada' using errcode = 'no_data_found';
  end if;
  perform app.assert_capa_writable(v_capa_id);

  perform set_config('app.in_safety_rpc', 'on', true);
  delete from public.capa_action where id = p_action_id;
  perform set_config('app.in_safety_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."remove_capa_action"("p_action_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."remove_capa_action_task"("p_task_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_capa_id uuid;
begin
  perform app.assert_patient_safety_enabled();
  select a.capa_id into v_capa_id
  from public.capa_action_task t join public.capa_action a on a.id = t.action_id
  where t.id = p_task_id;
  if v_capa_id is null then
    raise exception 'etapa não encontrada' using errcode = 'no_data_found';
  end if;
  perform app.assert_capa_writable(v_capa_id);

  perform set_config('app.in_safety_rpc', 'on', true);
  delete from public.capa_action_task where id = p_task_id;
  perform set_config('app.in_safety_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."remove_capa_action_task"("p_task_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."remove_capa_measure"("p_measure_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_capa_id uuid;
begin
  perform app.assert_patient_safety_enabled();
  select capa_id into v_capa_id from public.capa_measure where id = p_measure_id;
  if v_capa_id is null then
    raise exception 'medida não encontrada' using errcode = 'no_data_found';
  end if;
  perform app.assert_capa_writable(v_capa_id);

  perform set_config('app.in_safety_rpc', 'on', true);
  delete from public.capa_measure where id = p_measure_id;
  perform set_config('app.in_safety_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."remove_capa_measure"("p_measure_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."remove_rca_factor"("p_factor_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rca_id uuid;
begin
  perform app.assert_patient_safety_enabled();
  select rca_id into v_rca_id from public.rca_factors where id = p_factor_id;
  if v_rca_id is null then
    raise exception 'fator não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_rca_writable(v_rca_id);

  perform set_config('app.in_safety_rpc', 'on', true);
  delete from public.rca_factors where id = p_factor_id;  -- cascades its why chain
  perform set_config('app.in_safety_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."remove_rca_factor"("p_factor_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."remove_rca_member"("p_member_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rca_id uuid;
begin
  perform app.assert_patient_safety_enabled();
  select rca_id into v_rca_id from public.rca_members where id = p_member_id;
  if v_rca_id is null then
    raise exception 'integrante não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_rca_writable(v_rca_id);

  perform set_config('app.in_safety_rpc', 'on', true);
  delete from public.rca_members where id = p_member_id;
  perform set_config('app.in_safety_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."remove_rca_member"("p_member_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."remove_rca_root_cause"("p_root_cause_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rca_id uuid;
begin
  perform app.assert_patient_safety_enabled();
  select rca_id into v_rca_id from public.rca_root_causes where id = p_root_cause_id;
  if v_rca_id is null then
    raise exception 'causa raiz não encontrada' using errcode = 'no_data_found';
  end if;
  perform app.assert_rca_writable(v_rca_id);

  perform set_config('app.in_safety_rpc', 'on', true);
  delete from public.rca_root_causes where id = p_root_cause_id;
  perform set_config('app.in_safety_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."remove_rca_root_cause"("p_root_cause_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."remove_rca_timeline_entry"("p_entry_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rca_id uuid;
begin
  perform app.assert_patient_safety_enabled();
  select rca_id into v_rca_id from public.rca_timeline_entries where id = p_entry_id;
  if v_rca_id is null then
    raise exception 'item não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_rca_writable(v_rca_id);

  perform set_config('app.in_safety_rpc', 'on', true);
  delete from public.rca_timeline_entries where id = p_entry_id;
  perform set_config('app.in_safety_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."remove_rca_timeline_entry"("p_entry_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reopen_capa_plan"("p_capa_id" "uuid") RETURNS "public"."capa_plan"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_plan public.capa_plan;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_capa_writable(p_capa_id);
  if (select status from public.capa_plan where id = p_capa_id) <> 'concluido' then
    raise exception 'apenas um plano concluído pode ser reaberto' using errcode = 'HC049';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.capa_plan
  set status = 'em_execucao', closed_by = null, closed_at = null,
      lessons_learned_md = null, updated_at = now()
  where id = p_capa_id
  returning * into v_plan;
  -- Revoke the effectiveness verdict (the plan must be re-verified before re-closing).
  delete from public.capa_effectiveness where capa_id = p_capa_id;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_plan;
end;
$$;

ALTER FUNCTION "public"."reopen_capa_plan"("p_capa_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reopen_rca"("p_rca_id" "uuid") RETURNS "public"."rca"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rca public.rca;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_rca_writable(p_rca_id);

  if (select status from public.rca where id = p_rca_id) <> 'completed' then
    raise exception 'apenas uma análise concluída pode ser reaberta' using errcode = 'HC047';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.rca
  set status = 'in_progress', completed_by = null, completed_at = null, updated_at = now()
  where id = p_rca_id
  returning * into v_rca;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_rca;
end;
$$;

ALTER FUNCTION "public"."reopen_rca"("p_rca_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reopen_triage"("p_event_id" "uuid") RETURNS "public"."event_triage"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_triage public.event_triage;
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  if not app.is_pqs_member(auth.uid()) then
    raise exception 'apenas o NSP pode reabrir uma triagem' using errcode = '42501';
  end if;

  if (select status from public.patient_safety_event where id = p_event_id) <> 'triaged' then
    raise exception 'apenas uma triagem confirmada pode ser reaberta' using errcode = 'HC045';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.patient_safety_event
  set status = 'acknowledged', updated_at = now()
  where id = p_event_id;

  update public.event_triage
  set triaged_by = null, triaged_at = null, updated_at = now()
  where event_id = p_event_id
  returning * into v_triage;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_triage;
end;
$$;

ALTER FUNCTION "public"."reopen_triage"("p_event_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reorder_event_types"("p_ordered_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_patient_safety_enabled();
  if not app.is_pqs_member(auth.uid()) then
    raise exception 'apenas o NSP pode gerenciar tipos de evento' using errcode = '42501';
  end if;
  -- Single UPDATE against the deferrable position unique (offset into negatives first
  -- to avoid transient collisions, then renumber to 1..n by array order).
  update public.pqs_event_types
  set position = -position;
  update public.pqs_event_types t
  set position = ord.rn, updated_at = now()
  from (select id, row_number() over () as rn from unnest(p_ordered_ids) as id) ord
  where t.id = ord.id;
end;
$$;

ALTER FUNCTION "public"."reorder_event_types"("p_ordered_ids" "uuid"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reorder_rca_timeline"("p_rca_id" "uuid", "p_ordered_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_rca_writable(p_rca_id);

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.rca_timeline_entries set position = -position where rca_id = p_rca_id;
  update public.rca_timeline_entries t
  set position = ord.rn
  from (select id, row_number() over () as rn from unnest(p_ordered_ids) as id) ord
  where t.id = ord.id and t.rca_id = p_rca_id;
  perform set_config('app.in_safety_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."reorder_rca_timeline"("p_rca_id" "uuid", "p_ordered_ids" "uuid"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reorder_sentinel_criteria"("p_ordered_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_patient_safety_enabled();
  if not app.is_pqs_member(auth.uid()) then
    raise exception 'apenas o NSP pode gerenciar critérios de evento sentinela' using errcode = '42501';
  end if;
  update public.pqs_sentinel_criteria
  set position = -position;
  update public.pqs_sentinel_criteria t
  set position = ord.rn, updated_at = now()
  from (select id, row_number() over () as rn from unnest(p_ordered_ids) as id) ord
  where t.id = ord.id;
end;
$$;

ALTER FUNCTION "public"."reorder_sentinel_criteria"("p_ordered_ids" "uuid"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."save_triage"("p_event_id" "uuid", "p_is_pse" boolean DEFAULT NULL::boolean, "p_pse_closure_reason" "text" DEFAULT NULL::"text", "p_reach" "text" DEFAULT NULL::"text", "p_harm_severity" "text" DEFAULT NULL::"text", "p_natural_course" boolean DEFAULT NULL::boolean, "p_review_pathway" "text" DEFAULT NULL::"text", "p_disposition_notes_md" "text" DEFAULT NULL::"text", "p_sentinel_criteria_ids" "uuid"[] DEFAULT '{}'::"uuid"[]) RETURNS "public"."event_triage"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_triage public.event_triage;
  v_reach text := p_reach;
  v_harm text := p_harm_severity;
  v_natural boolean := p_natural_course;
  v_has_designated boolean := coalesce(array_length(p_sentinel_criteria_ids, 1), 0) > 0;
  v_sentinel boolean;
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  -- Triage is an NSP activity.
  if not app.is_pqs_member(auth.uid()) then
    raise exception 'apenas o NSP pode triar eventos' using errcode = '42501';
  end if;

  -- The event must be acknowledged (and not yet triaged/closed/cancelled).
  if (select status from public.patient_safety_event where id = p_event_id) <> 'acknowledged' then
    raise exception 'o evento precisa estar reconhecido pelo NSP para ser triado'
      using errcode = 'HC045';
  end if;

  -- Validate fixed enums up front (defensive — the CHECK also catches these).
  if v_reach is not null and v_reach not in ('unsafe', 'near_miss', 'no_harm', 'adverse', 'sentinel') then
    raise exception 'alcance inválido' using errcode = 'HC046';
  end if;
  if v_harm is not null and v_harm not in ('none', 'mild', 'moderate', 'severe', 'permanent', 'death') then
    raise exception 'gravidade de dano inválida' using errcode = 'HC046';
  end if;
  if p_review_pathway is not null
     and p_review_pathway not in ('rca', 'peer_review', 'mm', 'fmea', 'tracking_only') then
    raise exception 'desfecho inválido' using errcode = 'HC046';
  end if;

  -- Not-a-PSE: require a closure reason; clear the spectrum/harm/flags entirely.
  if p_is_pse is false then
    if p_pse_closure_reason is null
       or p_pse_closure_reason not in ('natural', 'expected', 'nonclinical', 'duplicate') then
      raise exception 'selecione o motivo de encerramento (não é evento de segurança)'
        using errcode = 'HC046';
    end if;
    v_reach := null;
    v_harm := null;
    v_natural := null;
    v_has_designated := false;
    p_sentinel_criteria_ids := '{}';
  end if;

  -- Cross-field rules (only meaningful on a PSE worksheet with a reach chosen).
  if coalesce(p_is_pse, true) and v_reach is not null then
    -- Non-harmful reach: no harm grading, no natural-course question.
    if v_reach in ('unsafe', 'near_miss', 'no_harm') then
      v_harm := 'none';
      v_natural := null;
    -- Sentinel reach: FLOOR harm to 'severe' (keep a higher set value).
    elsif v_reach = 'sentinel' then
      if v_harm is null or v_harm in ('none', 'mild', 'moderate') then
        v_harm := 'severe';
      end if;
    end if;
  end if;

  -- Auto-compute the sentinel determination from the normalized fields.
  v_sentinel := app.compute_sentinel_determination(v_reach, v_harm, v_natural, v_has_designated);

  perform set_config('app.in_safety_rpc', 'on', true);

  insert into public.event_triage (
    event_id, is_pse, pse_closure_reason, reach, harm_severity, natural_course,
    sentinel_determination, review_pathway, disposition_notes_md, updated_at
  ) values (
    p_event_id, p_is_pse,
    case when p_is_pse is false then p_pse_closure_reason else null end,
    v_reach, v_harm, v_natural, v_sentinel, p_review_pathway, p_disposition_notes_md, now()
  )
  on conflict (event_id) do update
  set is_pse = excluded.is_pse,
      pse_closure_reason = excluded.pse_closure_reason,
      reach = excluded.reach,
      harm_severity = excluded.harm_severity,
      natural_course = excluded.natural_course,
      sentinel_determination = excluded.sentinel_determination,
      review_pathway = excluded.review_pathway,
      disposition_notes_md = excluded.disposition_notes_md,
      updated_at = now()
  returning * into v_triage;

  -- Replace the designated-flag set (snapshot key + label for the permanent record).
  delete from public.event_triage_sentinel_flags where event_id = p_event_id;
  if v_has_designated then
    insert into public.event_triage_sentinel_flags (event_id, criteria_id, criteria_key, criteria_label)
    select p_event_id, c.id, c.key, c.label
    from public.pqs_sentinel_criteria c
    where c.id = any (p_sentinel_criteria_ids);
  end if;

  perform set_config('app.in_safety_rpc', 'off', true);
  return v_triage;
end;
$$;

ALTER FUNCTION "public"."save_triage"("p_event_id" "uuid", "p_is_pse" boolean, "p_pse_closure_reason" "text", "p_reach" "text", "p_harm_severity" "text", "p_natural_course" boolean, "p_review_pathway" "text", "p_disposition_notes_md" "text", "p_sentinel_criteria_ids" "uuid"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_capa_action_task_done"("p_task_id" "uuid", "p_is_done" boolean) RETURNS "public"."capa_action_task"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_capa_id uuid;
  v_row public.capa_action_task;
begin
  perform app.assert_patient_safety_enabled();
  select a.capa_id into v_capa_id
  from public.capa_action_task t join public.capa_action a on a.id = t.action_id
  where t.id = p_task_id;
  if v_capa_id is null then
    raise exception 'etapa não encontrada' using errcode = 'no_data_found';
  end if;
  perform app.assert_capa_writable(v_capa_id);

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.capa_action_task set is_done = coalesce(p_is_done, false), updated_at = now()
  where id = p_task_id
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."set_capa_action_task_done"("p_task_id" "uuid", "p_is_done" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_event_patient"("p_event_id" "uuid", "p_name" "text" DEFAULT NULL::"text", "p_mrn" "text" DEFAULT NULL::"text", "p_date_of_birth" "date" DEFAULT NULL::"date", "p_age_years" integer DEFAULT NULL::integer, "p_sex" "text" DEFAULT 'unknown'::"text", "p_encounter_ref" "text" DEFAULT NULL::"text", "p_unit" "text" DEFAULT NULL::"text", "p_attending" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  if not app.event_current_custodian(p_event_id, auth.uid()) then
    raise exception 'apenas quem detém a custódia do evento pode registrar dados do paciente'
      using errcode = 'HC044';
  end if;
  if p_sex is not null and p_sex not in ('female', 'male', 'other', 'unknown') then
    raise exception 'sexo inválido' using errcode = 'check_violation';
  end if;

  insert into public.event_patient (
    event_id, name, mrn, date_of_birth, age_years, sex, encounter_ref, unit, attending
  ) values (
    p_event_id, p_name, p_mrn, p_date_of_birth, p_age_years, coalesce(p_sex, 'unknown'),
    p_encounter_ref, p_unit, p_attending
  )
  on conflict (event_id) do update
  set name = excluded.name, mrn = excluded.mrn, date_of_birth = excluded.date_of_birth,
      age_years = excluded.age_years, sex = excluded.sex,
      encounter_ref = excluded.encounter_ref, unit = excluded.unit,
      attending = excluded.attending, updated_at = now();

  -- WS A: maintain the denormalized has_patient flag so list/governance reads can
  -- derive hasPatient without embedding event_patient (which is no longer directly
  -- SELECT-able). Disposal (WS C) sets it back to false.
  update public.patient_safety_event set has_patient = true where id = p_event_id;
end;
$$;

ALTER FUNCTION "public"."set_event_patient"("p_event_id" "uuid", "p_name" "text", "p_mrn" "text", "p_date_of_birth" "date", "p_age_years" integer, "p_sex" "text", "p_encounter_ref" "text", "p_unit" "text", "p_attending" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_event_patient"("p_event_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_event public.patient_safety_event;
  v_patient public.event_patient;
begin
  -- WS A: the SINGLE audited door to the isolated PHI identifiers. Direct SELECT
  -- on public.event_patient is revoked from authenticated, so this DEFINER RPC is
  -- the only read path — the Rule-11 read-audit can never be skipped. Mirrors
  -- public.get_case_detail (re-gate -> read -> audit). Returns NULL (no leak) when
  -- out of scope OR when no PHI row exists; an audit row is written ONLY on a real,
  -- entitled read of an existing row.
  select * into v_event from public.patient_safety_event where id = p_event_id;
  if v_event.id is null then
    return null;
  end if;

  -- Re-gate with the TIGHT identifier predicate (PQS member OR custodian
  -- staff_admin; NO reporting-provenance, NO admin fallback). Out of scope -> NULL,
  -- no audit row.
  if not app.can_read_event_patient(p_event_id, auth.uid()) then
    return null;
  end if;

  select * into v_patient from public.event_patient where event_id = p_event_id;
  if v_patient.event_id is null then
    -- Entitled, but no PHI on file: nothing was read, so no audit row.
    return null;
  end if;

  -- AUDIT (Rule 11/12): record THAT the identifiers were read + WHO, never the
  -- payload (empty metadata). Attributed to the reporting (provenance) commission.
  perform public.log_audit_access(
    'event_patient.read',
    'event_patient',
    p_event_id,
    v_event.reporting_commission_id,
    'Leitura dos identificadores do paciente do evento ' || v_event.code,
    '{}'::jsonb
  );

  return to_jsonb(v_patient);
end;
$$;

ALTER FUNCTION "public"."get_event_patient"("p_event_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."dispose_event_phi"("p_event_id" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_event public.patient_safety_event;
  v_rca_id uuid;
  v_redacted constant text := '[PHI removido]';
begin
  perform app.assert_patient_safety_enabled();

  -- Gate: admin OR PQS. Disposal is a compliance/erasure action — it does NOT read
  -- PHI, so it does not require can_read_event_patient. DEFINER bypasses RLS → re-check.
  if not (app.is_admin() or app.is_pqs_member(auth.uid())) then
    raise exception 'apenas um administrador ou o NSP pode descartar dados do paciente'
      using errcode = '42501';
  end if;

  -- Constrained reason category (PHI-safe, LGPD Art. 18 accountability) — never free text.
  if p_reason is null or p_reason not in
       ('retention_expired', 'subject_request', 'entered_in_error', 'duplicate', 'other') then
    raise exception 'motivo de descarte inválido' using errcode = 'check_violation';
  end if;

  select * into v_event from public.patient_safety_event where id = p_event_id;
  if v_event.id is null then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;

  -- One-shot (HC056): disposal cannot run twice on the same event.
  if v_event.phi_disposed_at is not null then
    raise exception 'os dados do paciente deste evento já foram descartados'
      using errcode = 'HC056';
  end if;

  -- Bypass the lifecycle/content-freeze guards so disposal works on a frozen/triaged/
  -- completed/closed record (same mechanism as transfer_event_custody). Txn-local.
  perform set_config('app.in_safety_rpc', 'on', true);

  -- (1) The isolated identifiers go entirely.
  delete from public.event_patient where event_id = p_event_id;

  -- (2) Event free text (nullable → NULL).
  update public.patient_safety_event
     set description_md = null
   where id = p_event_id;

  -- (3) Triage free text (1:1; nullable → NULL).
  update public.event_triage
     set disposition_notes_md = null
   where event_id = p_event_id;

  -- (4) RCA + its children (1:1 RCA per event).
  select id into v_rca_id from public.rca where event_id = p_event_id;
  if v_rca_id is not null then
    update public.rca
       set what_md = null, expected_md = null, summary_md = null,
           impact = null, scope = null
     where id = v_rca_id;
    -- NOT-NULL columns → REDACT to a sentinel (cannot NULL).
    update public.rca_factors          set text = v_redacted        where rca_id = v_rca_id;
    update public.rca_root_causes       set text = v_redacted        where rca_id = v_rca_id;
    update public.rca_timeline_entries  set description = v_redacted  where rca_id = v_rca_id;
  end if;

  -- (5) CAPA plans sourced from this event (event-sourced OR via the event's RCA),
  --     plus their PHI-bearing children. Scope by the matching plan ids.
  update public.capa_plan
     set lessons_learned_md = null
   where source_event_id = p_event_id
      or (v_rca_id is not null and source_rca_id = v_rca_id);

  update public.capa_effectiveness ce
     set method_md = null
   where ce.capa_id in (
     select cp.id from public.capa_plan cp
     where cp.source_event_id = p_event_id
        or (v_rca_id is not null and cp.source_rca_id = v_rca_id)
   );

  update public.capa_measure_result cmr
     set note = null
   where cmr.measure_id in (
     select cm.id from public.capa_measure cm
     where cm.capa_id in (
       select cp.id from public.capa_plan cp
       where cp.source_event_id = p_event_id
          or (v_rca_id is not null and cp.source_rca_id = v_rca_id)
     )
   );

  -- NOT-NULL → REDACT.
  update public.capa_action_task cat
     set description = v_redacted
   where cat.action_id in (
     select ca.id from public.capa_action ca
     where ca.capa_id in (
       select cp.id from public.capa_plan cp
       where cp.source_event_id = p_event_id
          or (v_rca_id is not null and cp.source_rca_id = v_rca_id)
     )
   );

  -- (6) Stamp the event: who/when/why + flip has_patient false (so hasPatient reads
  --     false and the panel affordance disappears). PRESERVES the governance skeleton
  --     (codes, status, custody ledger, structured non-PHI, audit chain).
  update public.patient_safety_event
     set has_patient = false,
         phi_disposed_at = now(),
         phi_disposed_by = auth.uid(),
         phi_disposed_reason = p_reason,
         updated_at = now()
   where id = p_event_id;

  -- (7) Audit MUTATION row with the enum reason ONLY (PHI-safe metadata; no free text).
  perform app.audit_write(
    'event_patient.disposed',
    'event_patient',
    p_event_id,
    v_event.reporting_commission_id,
    'Dados do paciente do evento ' || v_event.code || ' descartados',
    jsonb_build_object('reason', p_reason)
  );

  perform set_config('app.in_safety_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."dispose_event_phi"("p_event_id" "uuid", "p_reason" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_pqs_member"("p_user_id" "uuid") RETURNS "public"."pqs_members"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.pqs_members;
begin
  -- WS A: admin-only enrollment (mirrors assignStaffAdmin gating — requireAdmin in
  -- the action + this DEFINER re-checks). A DEFINER bypasses RLS, so re-assert.
  if not app.is_admin() then
    raise exception 'apenas um administrador pode gerenciar membros do NSP'
      using errcode = '42501';
  end if;
  insert into public.pqs_members (user_id, added_by)
  values (p_user_id, auth.uid())
  on conflict (user_id) do nothing;
  select * into v_row from public.pqs_members where user_id = p_user_id;
  return v_row;
end;
$$;

ALTER FUNCTION "public"."add_pqs_member"("p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."remove_pqs_member"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not app.is_admin() then
    raise exception 'apenas um administrador pode gerenciar membros do NSP'
      using errcode = '42501';
  end if;
  delete from public.pqs_members where user_id = p_user_id;
end;
$$;

ALTER FUNCTION "public"."remove_pqs_member"("p_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."list_pqs_members"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_result jsonb;
begin
  if not app.is_admin() then
    raise exception 'apenas um administrador pode listar membros do NSP'
      using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'userId', m.user_id,
             'fullName', p.full_name,
             'email', p.email,
             'addedAt', m.added_at,
             'addedBy', m.added_by
           )
           order by p.full_name
         ), '[]'::jsonb)
    into v_result
    from public.pqs_members m
    join public.profiles p on p.id = m.user_id;
  return v_result;
end;
$$;

ALTER FUNCTION "public"."list_pqs_members"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_pqs_rca_due_window"("p_days" integer) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_old integer;
  v_id uuid;
begin
  perform app.assert_patient_safety_enabled();
  if not app.is_pqs_member(auth.uid()) then
    raise exception 'apenas o NSP pode configurar a janela de RCA' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'a janela de RCA deve estar entre 1 e 365 dias' using errcode = 'HC046';
  end if;

  select id, rca_default_due_days into v_id, v_old
  from public.pqs_department order by created_at limit 1;
  if v_id is null then
    raise exception 'NSP não configurado' using errcode = 'P0002';
  end if;

  update public.pqs_department
  set rca_default_due_days = p_days, updated_at = now()
  where id = v_id;

  -- Audit (Rule 11; PHI-free — a plain integer). This is an NSP-config change on the
  -- pqs_department singleton (no event_triage row changed), so label it accurately:
  -- action pqs_config.rca_due_window_changed, entity_type pqs_department, entity_id =
  -- the pqs_department.id. Global chain (NSP config is not commission-scoped); no-ops
  -- while the audit_trail flag is OFF.
  perform app.audit_write('pqs_config.rca_due_window_changed', 'pqs_department', v_id, null,
    'Janela de RCA do NSP definida para ' || p_days || ' dias',
    jsonb_build_object('rca_default_due_days',
      jsonb_build_object('old', v_old, 'new', p_days)));

  return p_days;
end;
$$;

ALTER FUNCTION "public"."set_pqs_rca_due_window"("p_days" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_rca_factor_key"("p_factor_id" "uuid", "p_is_key" boolean) RETURNS "public"."rca_factors"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rca_id uuid;
  v_row public.rca_factors;
begin
  perform app.assert_patient_safety_enabled();
  select rca_id into v_rca_id from public.rca_factors where id = p_factor_id;
  if v_rca_id is null then
    raise exception 'fator não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_rca_writable(v_rca_id);

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.rca_factors set is_key = coalesce(p_is_key, false), updated_at = now()
  where id = p_factor_id
  returning * into v_row;
  -- Un-keying a factor drops its 5-Whys chain (it is no longer carried into the drill).
  if not coalesce(p_is_key, false) then
    delete from public.rca_why_chains where factor_id = p_factor_id;
  end if;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."set_rca_factor_key"("p_factor_id" "uuid", "p_is_key" boolean) OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."rca_why_chains" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rca_id" "uuid" NOT NULL,
    "factor_id" "uuid" NOT NULL,
    "steps" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "root_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rca_why_chains_steps_is_array" CHECK (("jsonb_typeof"("steps") = 'array'::"text")),
    CONSTRAINT "rca_why_chains_steps_max5" CHECK (("jsonb_array_length"("steps") <= 5))
);

ALTER TABLE "public"."rca_why_chains" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_rca_why_root"("p_factor_id" "uuid", "p_root_text" "text") RETURNS "public"."rca_why_chains"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rca_id uuid;
  v_row public.rca_why_chains;
begin
  perform app.assert_patient_safety_enabled();
  select rca_id into v_rca_id from public.rca_factors where id = p_factor_id;
  if v_rca_id is null then
    raise exception 'fator não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_rca_writable(v_rca_id);

  perform set_config('app.in_safety_rpc', 'on', true);
  insert into public.rca_why_chains (rca_id, factor_id, steps, root_text)
  values (v_rca_id, p_factor_id, '[]'::jsonb, p_root_text)
  on conflict (factor_id) do update set root_text = excluded.root_text, updated_at = now()
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."set_rca_why_root"("p_factor_id" "uuid", "p_root_text" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_rca_why_step"("p_factor_id" "uuid", "p_index" integer, "p_text" "text") RETURNS "public"."rca_why_chains"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rca_id uuid;
  v_row public.rca_why_chains;
  v_steps jsonb;
  i integer;
begin
  perform app.assert_patient_safety_enabled();
  select rca_id into v_rca_id from public.rca_factors where id = p_factor_id;
  if v_rca_id is null then
    raise exception 'fator não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_rca_writable(v_rca_id);
  if p_index < 0 or p_index > 4 then
    raise exception 'os 5 porquês admitem no máximo 5 etapas' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);

  -- Lazily create the chain.
  insert into public.rca_why_chains (rca_id, factor_id, steps)
  values (v_rca_id, p_factor_id, '[]'::jsonb)
  on conflict (factor_id) do nothing;

  select steps into v_steps from public.rca_why_chains where factor_id = p_factor_id;
  -- Pad the array up to p_index with empty strings.
  i := jsonb_array_length(v_steps);
  while i <= p_index loop
    v_steps := v_steps || to_jsonb(''::text);
    i := i + 1;
  end loop;
  v_steps := jsonb_set(v_steps, array[p_index::text], to_jsonb(coalesce(p_text, '')));

  update public.rca_why_chains
  set steps = v_steps, updated_at = now()
  where factor_id = p_factor_id
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."set_rca_why_step"("p_factor_id" "uuid", "p_index" integer, "p_text" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."submit_rca_for_review"("p_rca_id" "uuid") RETURNS "public"."rca"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rca public.rca;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_rca_writable(p_rca_id);

  if (select status from public.rca where id = p_rca_id) <> 'in_progress' then
    raise exception 'apenas uma análise em andamento pode ser enviada para revisão'
      using errcode = 'HC047';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.rca
  set status = 'in_review', submitted_by = auth.uid(), submitted_at = now(), updated_at = now()
  where id = p_rca_id
  returning * into v_rca;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_rca;
end;
$$;

ALTER FUNCTION "public"."submit_rca_for_review"("p_rca_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."transfer_event_custody"("p_event_id" "uuid", "p_to_owner_kind" "text", "p_to_commission_id" "uuid" DEFAULT NULL::"uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."patient_safety_event"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_event public.patient_safety_event;
  v_status text;
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  if not app.event_current_custodian(p_event_id, auth.uid()) then
    raise exception 'apenas quem detém a custódia do evento pode transferi-la'
      using errcode = 'HC044';
  end if;

  select status into v_status from public.patient_safety_event where id = p_event_id;
  if v_status in ('closed', 'cancelled') then
    raise exception 'um evento encerrado ou cancelado não pode ter a custódia transferida'
      using errcode = 'HC043';
  end if;

  if p_to_owner_kind not in ('pqs', 'commission') then
    raise exception 'destino de custódia inválido' using errcode = 'check_violation';
  end if;
  if p_to_owner_kind = 'commission' and p_to_commission_id is null then
    raise exception 'selecione a comissão de destino' using errcode = 'check_violation';
  end if;
  if p_to_owner_kind = 'pqs' then
    p_to_commission_id := null;
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);

  -- Close the open interval (the guard admits exactly this held_until move).
  update public.event_custody
  set held_until = now()
  where event_id = p_event_id and held_until is null;

  -- Append the new interval.
  insert into public.event_custody (event_id, owner_kind, owner_commission_id, assigned_by, note)
  values (p_event_id, p_to_owner_kind, p_to_commission_id, auth.uid(), p_note);

  -- Update the denormalized owner head (drives access-follows-custody RLS).
  update public.patient_safety_event
  set current_owner_kind = p_to_owner_kind,
      current_owner_commission_id = p_to_commission_id,
      updated_at = now()
  where id = p_event_id
  returning * into v_event;

  perform set_config('app.in_safety_rpc', 'off', true);
  return v_event;
end;
$$;

ALTER FUNCTION "public"."transfer_event_custody"("p_event_id" "uuid", "p_to_owner_kind" "text", "p_to_commission_id" "uuid", "p_note" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."triage_disposition"("p_event_id" "uuid") RETURNS TABLE("event_id" "uuid", "is_pse" boolean, "reached" boolean, "severe" boolean, "is_sentinel" boolean, "verdict" "text", "review_pathway" "text", "rca_due_date" "date")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_t public.event_triage;
  v_event public.patient_safety_event;
  v_reached boolean;
  v_severe boolean;
  v_verdict text;
  v_pathway text;
  v_due date;
  v_due_days integer;
begin
  if not app.can_read_event(p_event_id, auth.uid()) then
    return;  -- out of scope: no rows
  end if;

  select * into v_event from public.patient_safety_event where id = p_event_id;
  if not found then
    return;
  end if;

  -- Qualify event_id: it is also a RETURNS TABLE output column, so a bare reference
  -- here is ambiguous (42702). Table-qualify against event_triage.
  select * into v_t from public.event_triage where event_triage.event_id = p_event_id;

  v_reached := coalesce(v_t.reach in ('no_harm', 'adverse', 'sentinel'), false);
  v_severe := coalesce(v_t.harm_severity in ('severe', 'permanent', 'death'), false);

  -- Verdict (README_triage §6): not-a-PSE -> closed; sentinel -> rca; reach chosen ->
  -- review; else pending.
  if v_t.is_pse is false then
    v_verdict := 'closed';
    v_pathway := null;
  elsif coalesce(v_t.sentinel_determination, false) then
    v_verdict := 'rca';
    v_pathway := 'rca';
  elsif v_t.reach is not null then
    v_verdict := 'review';
    v_pathway := coalesce(v_t.review_pathway, 'peer_review');
  else
    v_verdict := 'pending';
    v_pathway := null;
  end if;

  -- Preview the RCA due date for an rca verdict (matches confirm_triage's mint).
  if v_verdict = 'rca' then
    select rca_default_due_days into v_due_days
    from public.pqs_department order by created_at limit 1;
    v_due_days := coalesce(v_due_days, 45);
    v_due := coalesce(v_event.discovered_at, v_event.reported_at::date) + v_due_days;
  end if;

  return query select
    p_event_id, v_t.is_pse, v_reached, v_severe,
    coalesce(v_t.sentinel_determination, false), v_verdict, v_pathway, v_due;
end;
$$;

ALTER FUNCTION "public"."triage_disposition"("p_event_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_capa_action"("p_action_id" "uuid", "p_title" "text", "p_owner" "text" DEFAULT NULL::"text", "p_assignee_user_id" "uuid" DEFAULT NULL::"uuid", "p_due_date" "date" DEFAULT NULL::"date", "p_action_strength" "text" DEFAULT 'intermediaria'::"text", "p_success_measure" "text" DEFAULT NULL::"text", "p_root_cause_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."capa_action"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_capa_id uuid;
  v_row public.capa_action;
begin
  perform app.assert_patient_safety_enabled();
  select capa_id into v_capa_id from public.capa_action where id = p_action_id;
  if v_capa_id is null then
    raise exception 'ação não encontrada' using errcode = 'no_data_found';
  end if;
  perform app.assert_capa_writable(v_capa_id);
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe um título para a ação corretiva' using errcode = 'check_violation';
  end if;
  if coalesce(p_action_strength, 'intermediaria') not in ('forte', 'intermediaria', 'fraca') then
    raise exception 'força da ação inválida' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.capa_action
  set title = btrim(p_title), owner = p_owner, assignee_user_id = p_assignee_user_id,
      due_date = p_due_date, action_strength = coalesce(p_action_strength, 'intermediaria'),
      success_measure = p_success_measure, root_cause_id = p_root_cause_id, updated_at = now()
  where id = p_action_id
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."update_capa_action"("p_action_id" "uuid", "p_title" "text", "p_owner" "text", "p_assignee_user_id" "uuid", "p_due_date" "date", "p_action_strength" "text", "p_success_measure" "text", "p_root_cause_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_capa_measure"("p_measure_id" "uuid", "p_name" "text", "p_target" "text" DEFAULT NULL::"text", "p_definition" "text" DEFAULT NULL::"text") RETURNS "public"."capa_measure"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_capa_id uuid;
  v_row public.capa_measure;
begin
  perform app.assert_patient_safety_enabled();
  select capa_id into v_capa_id from public.capa_measure where id = p_measure_id;
  if v_capa_id is null then
    raise exception 'medida não encontrada' using errcode = 'no_data_found';
  end if;
  perform app.assert_capa_writable(v_capa_id);
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'informe um nome para o indicador de medida' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.capa_measure set name = p_name, target = p_target, definition = p_definition, updated_at = now()
  where id = p_measure_id
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."update_capa_measure"("p_measure_id" "uuid", "p_name" "text", "p_target" "text", "p_definition" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_capa_plan"("p_capa_id" "uuid", "p_classification" "text") RETURNS "public"."capa_plan"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_plan public.capa_plan;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_capa_writable(p_capa_id);
  if coalesce(p_classification, 'corretiva') not in ('corretiva', 'preventiva', 'melhoria') then
    raise exception 'classificação inválida' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.capa_plan set status = 'em_execucao', updated_at = now()
  where id = p_capa_id and status = 'aberto';
  update public.capa_plan set classification = p_classification, updated_at = now()
  where id = p_capa_id
  returning * into v_plan;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_plan;
end;
$$;

ALTER FUNCTION "public"."update_capa_plan"("p_capa_id" "uuid", "p_classification" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_event"("p_event_id" "uuid", "p_title" "text", "p_description_md" "text" DEFAULT NULL::"text", "p_suspected_harm_level" "text" DEFAULT 'unknown'::"text", "p_event_type_id" "uuid" DEFAULT NULL::"uuid", "p_location" "text" DEFAULT NULL::"text", "p_discovered_at" "date" DEFAULT NULL::"date") RETURNS "public"."patient_safety_event"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_event public.patient_safety_event;
begin
  perform app.assert_patient_safety_enabled();

  if not app.can_read_event(p_event_id, auth.uid()) then
    raise exception 'evento não encontrado' using errcode = 'P0002';
  end if;
  if not app.event_current_custodian(p_event_id, auth.uid()) then
    raise exception 'apenas quem detém a custódia do evento pode editá-lo'
      using errcode = 'HC044';
  end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'informe um título para o evento' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.patient_safety_event
  set title = p_title, description_md = p_description_md,
      suspected_harm_level = coalesce(p_suspected_harm_level, 'unknown'),
      event_type_id = p_event_type_id, location = p_location, discovered_at = p_discovered_at,
      updated_at = now()
  where id = p_event_id
  returning * into v_event;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_event;
end;
$$;

ALTER FUNCTION "public"."update_event"("p_event_id" "uuid", "p_title" "text", "p_description_md" "text", "p_suspected_harm_level" "text", "p_event_type_id" "uuid", "p_location" "text", "p_discovered_at" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_event_type"("p_id" "uuid", "p_label" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS "public"."pqs_event_types"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.pqs_event_types;
begin
  perform app.assert_patient_safety_enabled();
  if not app.is_pqs_member(auth.uid()) then
    raise exception 'apenas o NSP pode gerenciar tipos de evento' using errcode = '42501';
  end if;
  if btrim(coalesce(p_label, '')) = '' then
    raise exception 'informe um rótulo' using errcode = 'check_violation';
  end if;
  update public.pqs_event_types
  set label = btrim(p_label), description = p_description, updated_at = now()
  where id = p_id
  returning * into v_row;
  if not found then
    raise exception 'tipo de evento não encontrado' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

ALTER FUNCTION "public"."update_event_type"("p_id" "uuid", "p_label" "text", "p_description" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_rca"("p_rca_id" "uuid", "p_what_md" "text" DEFAULT NULL::"text", "p_expected_md" "text" DEFAULT NULL::"text", "p_detected" "text" DEFAULT NULL::"text", "p_impact" "text" DEFAULT NULL::"text", "p_scope" "text" DEFAULT NULL::"text", "p_summary_md" "text" DEFAULT NULL::"text") RETURNS "public"."rca"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rca public.rca;
begin
  perform app.assert_patient_safety_enabled();
  perform app.assert_rca_writable(p_rca_id);

  perform set_config('app.in_safety_rpc', 'on', true);
  perform app.rca_bump_in_progress(p_rca_id);
  update public.rca
  set what_md = p_what_md, expected_md = p_expected_md, detected = p_detected,
      impact = p_impact, scope = p_scope, summary_md = p_summary_md, updated_at = now()
  where id = p_rca_id
  returning * into v_rca;
  perform set_config('app.in_safety_rpc', 'off', true);

  return v_rca;
end;
$$;

ALTER FUNCTION "public"."update_rca"("p_rca_id" "uuid", "p_what_md" "text", "p_expected_md" "text", "p_detected" "text", "p_impact" "text", "p_scope" "text", "p_summary_md" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_rca_factor"("p_factor_id" "uuid", "p_text" "text") RETURNS "public"."rca_factors"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rca_id uuid;
  v_row public.rca_factors;
begin
  perform app.assert_patient_safety_enabled();
  select rca_id into v_rca_id from public.rca_factors where id = p_factor_id;
  if v_rca_id is null then
    raise exception 'fator não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_rca_writable(v_rca_id);
  if btrim(coalesce(p_text, '')) = '' then
    raise exception 'descreva o fator' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.rca_factors set text = p_text, updated_at = now() where id = p_factor_id
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."update_rca_factor"("p_factor_id" "uuid", "p_text" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_rca_member_role"("p_member_id" "uuid", "p_role" "text") RETURNS "public"."rca_members"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rca_id uuid;
  v_row public.rca_members;
begin
  perform app.assert_patient_safety_enabled();
  select rca_id into v_rca_id from public.rca_members where id = p_member_id;
  if v_rca_id is null then
    raise exception 'integrante não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_rca_writable(v_rca_id);
  if p_role not in ('lead', 'facilitator', 'sme', 'reviewer', 'executive_sponsor', 'observer') then
    raise exception 'função inválida' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.rca_members set role = p_role where id = p_member_id
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."update_rca_member_role"("p_member_id" "uuid", "p_role" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_rca_root_cause"("p_root_cause_id" "uuid", "p_text" "text", "p_category" "text" DEFAULT NULL::"text", "p_classification" "text" DEFAULT 'system'::"text", "p_type" "text" DEFAULT 'root'::"text") RETURNS "public"."rca_root_causes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rca_id uuid;
  v_row public.rca_root_causes;
begin
  perform app.assert_patient_safety_enabled();
  select rca_id into v_rca_id from public.rca_root_causes where id = p_root_cause_id;
  if v_rca_id is null then
    raise exception 'causa raiz não encontrada' using errcode = 'no_data_found';
  end if;
  perform app.assert_rca_writable(v_rca_id);
  if btrim(coalesce(p_text, '')) = '' then
    raise exception 'descreva a causa raiz' using errcode = 'check_violation';
  end if;
  if p_category is not null
     and p_category not in ('people', 'communication', 'process', 'equipment', 'environment', 'policy') then
    raise exception 'categoria inválida' using errcode = 'check_violation';
  end if;
  if coalesce(p_classification, 'system') not in ('system', 'human', 'environment', 'external') then
    raise exception 'classificação inválida' using errcode = 'check_violation';
  end if;
  if coalesce(p_type, 'root') not in ('root', 'contributing') then
    raise exception 'tipo inválido' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.rca_root_causes
  set text = p_text, category = p_category,
      classification = coalesce(p_classification, 'system'), type = coalesce(p_type, 'root'),
      updated_at = now()
  where id = p_root_cause_id
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."update_rca_root_cause"("p_root_cause_id" "uuid", "p_text" "text", "p_category" "text", "p_classification" "text", "p_type" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_rca_timeline_entry"("p_entry_id" "uuid", "p_occurred_at" timestamp with time zone, "p_description" "text") RETURNS "public"."rca_timeline_entries"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rca_id uuid;
  v_row public.rca_timeline_entries;
begin
  perform app.assert_patient_safety_enabled();
  select rca_id into v_rca_id from public.rca_timeline_entries where id = p_entry_id;
  if v_rca_id is null then
    raise exception 'item não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_rca_writable(v_rca_id);
  if btrim(coalesce(p_description, '')) = '' then
    raise exception 'descreva o que ocorreu neste ponto da linha do tempo' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_safety_rpc', 'on', true);
  update public.rca_timeline_entries
  set occurred_at = p_occurred_at, description = p_description
  where id = p_entry_id
  returning * into v_row;
  perform set_config('app.in_safety_rpc', 'off', true);
  return v_row;
end;
$$;

ALTER FUNCTION "public"."update_rca_timeline_entry"("p_entry_id" "uuid", "p_occurred_at" timestamp with time zone, "p_description" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_sentinel_criterion"("p_id" "uuid", "p_label" "text", "p_description" "text" DEFAULT NULL::"text") RETURNS "public"."pqs_sentinel_criteria"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_row public.pqs_sentinel_criteria;
begin
  perform app.assert_patient_safety_enabled();
  if not app.is_pqs_member(auth.uid()) then
    raise exception 'apenas o NSP pode gerenciar critérios de evento sentinela' using errcode = '42501';
  end if;
  if btrim(coalesce(p_label, '')) = '' then
    raise exception 'informe um rótulo' using errcode = 'check_violation';
  end if;
  update public.pqs_sentinel_criteria
  set label = btrim(p_label), description = p_description, updated_at = now()
  where id = p_id
  returning * into v_row;
  if not found then
    raise exception 'critério não encontrado' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

ALTER FUNCTION "public"."update_sentinel_criterion"("p_id" "uuid", "p_label" "text", "p_description" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."event_custody" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "owner_kind" "text" NOT NULL,
    "owner_commission_id" "uuid",
    "held_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "held_until" timestamp with time zone,
    "assigned_by" "uuid",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_custody_interval_order" CHECK ((("held_until" IS NULL) OR ("held_until" >= "held_from"))),
    CONSTRAINT "event_custody_owner_kind_check" CHECK (("owner_kind" = ANY (ARRAY['pqs'::"text", 'commission'::"text"]))),
    CONSTRAINT "event_custody_owner_shape" CHECK (((("owner_kind" = 'pqs'::"text") AND ("owner_commission_id" IS NULL)) OR (("owner_kind" = 'commission'::"text") AND ("owner_commission_id" IS NOT NULL))))
);

ALTER TABLE "public"."event_custody" OWNER TO "postgres";

COMMENT ON TABLE "public"."event_custody" IS 'APPEND-ONLY custody ledger (ADR 0031). Current holder = the row with held_until IS NULL. Guarded: only a held_until NULL->non-null close (under app.in_safety_rpc) is permitted; no other UPDATE, no DELETE — a closed interval is permanent.';

CREATE TABLE IF NOT EXISTS "public"."event_patient" (
    "event_id" "uuid" NOT NULL,
    "name" "text",
    "mrn" "text",
    "date_of_birth" "date",
    "age_years" integer,
    "sex" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "encounter_ref" "text",
    "unit" "text",
    "attending" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_patient_age_nonneg" CHECK ((("age_years" IS NULL) OR ("age_years" >= 0))),
    CONSTRAINT "event_patient_sex_check" CHECK (("sex" = ANY (ARRAY['female'::"text", 'male'::"text", 'other'::"text", 'unknown'::"text"])))
);

ALTER TABLE "public"."event_patient" OWNER TO "postgres";

COMMENT ON TABLE "public"."event_patient" IS 'ISOLATED PHI (Rule 12) — the ONLY place patient identifiers live. 0..1 per event (PK = event_id). Read via the dedicated AUDITED path only (event_patient.read, Rule 11); NEVER selected on queue/list/aggregate paths. Encryption-ready.';

CREATE TABLE IF NOT EXISTS "public"."event_triage_sentinel_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "criteria_id" "uuid",
    "criteria_key" "text" NOT NULL,
    "criteria_label" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."event_triage_sentinel_flags" OWNER TO "postgres";

COMMENT ON TABLE "public"."event_triage_sentinel_flags" IS 'The permanent record of which designated sentinel criteria were flagged on a worksheet (Phase 14b). criteria_key/label are SNAPSHOTTED at flag time so the record stays viewable-forever across vocab edits.';

CREATE TABLE IF NOT EXISTS "public"."pqs_department" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "singleton" boolean DEFAULT true NOT NULL,
    "name" "text" DEFAULT 'Núcleo de Segurança do Paciente'::"text" NOT NULL,
    "rca_default_due_days" integer DEFAULT 45 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pqs_department_due_days_positive" CHECK (("rca_default_due_days" >= 1)),
    CONSTRAINT "pqs_department_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "pqs_department_singleton_true" CHECK (("singleton" = true))
);

ALTER TABLE "public"."pqs_department" OWNER TO "postgres";

COMMENT ON TABLE "public"."pqs_department" IS 'Singleton NSP/PQS-department configuration (one row per deployment). Holds the RCA default due-window read by triage (14b) / RCA (14c). No PHI.';

-- WS B (ADR 0030/0031): the NSP clinical FREE-TEXT columns are PHI-BEARING — a
-- reporter/investigator narrative can name or describe a patient even though the
-- structured identifiers live isolated on event_patient. They keep RLS-scoped
-- reads (two-tier decision #3), are audited at detail-open via the `.viewed`
-- verbs (safety_event/triage/rca/capa.viewed), and are NEVER copied into the audit
-- log (Rule 11). Surveyor/evidence export (Phase 19) must treat them as PHI.
-- (Placed after every NSP table is created so COMMENT ON COLUMN resolves.)
COMMENT ON COLUMN "public"."patient_safety_event"."description_md" IS 'PHI-BEARING free text (WS B; Rule 11/12). Reporter narrative (sanitized Markdown, Rule 7); audited via safety_event.viewed; never copied into the audit log.';
COMMENT ON COLUMN "public"."event_triage"."disposition_notes_md" IS 'PHI-BEARING free text (WS B; Rule 11/12). Triage disposition rationale (sanitized Markdown); audited via triage.viewed; never copied into the audit log.';
COMMENT ON COLUMN "public"."rca"."what_md" IS 'PHI-BEARING free text (WS B; Rule 11/12). RCA problem statement (what happened); audited via rca.viewed; never copied into the audit log.';
COMMENT ON COLUMN "public"."rca"."expected_md" IS 'PHI-BEARING free text (WS B; Rule 11/12). RCA expected-course narrative; audited via rca.viewed; never copied into the audit log.';
COMMENT ON COLUMN "public"."rca"."summary_md" IS 'PHI-BEARING free text (WS B; Rule 11/12). RCA summary/conclusion narrative; audited via rca.viewed; never copied into the audit log.';
COMMENT ON COLUMN "public"."rca"."impact" IS 'PHI-BEARING free text (WS B; Rule 11/12). RCA impact narrative; audited via rca.viewed; never copied into the audit log.';
COMMENT ON COLUMN "public"."rca"."scope" IS 'PHI-BEARING free text (WS B; Rule 11/12). RCA scope narrative; audited via rca.viewed; never copied into the audit log.';
COMMENT ON COLUMN "public"."rca_factors"."text" IS 'PHI-BEARING free text (WS B; Rule 11/12). Fishbone contributing-factor description; audited via rca.viewed; never copied into the audit log.';
COMMENT ON COLUMN "public"."rca_root_causes"."text" IS 'PHI-BEARING free text (WS B; Rule 11/12). Root-cause statement; audited via rca.viewed; never copied into the audit log.';
COMMENT ON COLUMN "public"."rca_timeline_entries"."description" IS 'PHI-BEARING free text (WS B; Rule 11/12). RCA timeline-entry description; audited via rca.viewed; never copied into the audit log.';
COMMENT ON COLUMN "public"."capa_plan"."lessons_learned_md" IS 'PHI-BEARING free text (WS B; Rule 11/12). CAPA lessons-learned narrative (sanitized Markdown); audited via capa.viewed; never copied into the audit log.';
COMMENT ON COLUMN "public"."capa_effectiveness"."method_md" IS 'PHI-BEARING free text (WS B; Rule 11/12). CAPA effectiveness-verification method narrative (sanitized Markdown); audited via capa.viewed; never copied into the audit log.';
COMMENT ON COLUMN "public"."capa_action_task"."description" IS 'PHI-BEARING free text (WS B; Rule 11/12). CAPA action-task description; audited via capa.viewed; never copied into the audit log.';
COMMENT ON COLUMN "public"."capa_measure_result"."note" IS 'PHI-BEARING free text (WS B; Rule 11/12). CAPA measure-result note; audited via capa.viewed; never copied into the audit log.';

ALTER TABLE ONLY "public"."capa_action_evidence"
    ADD CONSTRAINT "capa_action_evidence_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."capa_action"
    ADD CONSTRAINT "capa_action_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."capa_action"
    ADD CONSTRAINT "capa_action_position_key" UNIQUE ("capa_id", "position") DEFERRABLE;

ALTER TABLE ONLY "public"."capa_action_task"
    ADD CONSTRAINT "capa_action_task_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."capa_action_task"
    ADD CONSTRAINT "capa_action_task_position_key" UNIQUE ("action_id", "position") DEFERRABLE;

ALTER TABLE ONLY "public"."capa_effectiveness"
    ADD CONSTRAINT "capa_effectiveness_pkey" PRIMARY KEY ("capa_id");

ALTER TABLE ONLY "public"."capa_measure"
    ADD CONSTRAINT "capa_measure_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."capa_measure"
    ADD CONSTRAINT "capa_measure_position_key" UNIQUE ("capa_id", "position") DEFERRABLE;

ALTER TABLE ONLY "public"."capa_measure_result"
    ADD CONSTRAINT "capa_measure_result_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."capa_plan"
    ADD CONSTRAINT "capa_plan_code_key" UNIQUE ("code");

ALTER TABLE ONLY "public"."capa_plan"
    ADD CONSTRAINT "capa_plan_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."event_custody"
    ADD CONSTRAINT "event_custody_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."event_patient"
    ADD CONSTRAINT "event_patient_pkey" PRIMARY KEY ("event_id");

ALTER TABLE ONLY "public"."event_triage"
    ADD CONSTRAINT "event_triage_pkey" PRIMARY KEY ("event_id");

ALTER TABLE ONLY "public"."event_triage_sentinel_flags"
    ADD CONSTRAINT "event_triage_sentinel_flags_event_criteria_key" UNIQUE ("event_id", "criteria_id");

ALTER TABLE ONLY "public"."event_triage_sentinel_flags"
    ADD CONSTRAINT "event_triage_sentinel_flags_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."patient_safety_event"
    ADD CONSTRAINT "patient_safety_event_code_key" UNIQUE ("code");

ALTER TABLE ONLY "public"."patient_safety_event"
    ADD CONSTRAINT "patient_safety_event_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pqs_department"
    ADD CONSTRAINT "pqs_department_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pqs_event_types"
    ADD CONSTRAINT "pqs_event_types_key_key" UNIQUE ("key");

ALTER TABLE ONLY "public"."pqs_event_types"
    ADD CONSTRAINT "pqs_event_types_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pqs_event_types"
    ADD CONSTRAINT "pqs_event_types_position_key" UNIQUE ("position") DEFERRABLE;

ALTER TABLE ONLY "public"."pqs_sentinel_criteria"
    ADD CONSTRAINT "pqs_sentinel_criteria_key_key" UNIQUE ("key");

ALTER TABLE ONLY "public"."pqs_sentinel_criteria"
    ADD CONSTRAINT "pqs_sentinel_criteria_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pqs_sentinel_criteria"
    ADD CONSTRAINT "pqs_sentinel_criteria_position_key" UNIQUE ("position") DEFERRABLE;

ALTER TABLE ONLY "public"."rca"
    ADD CONSTRAINT "rca_event_key" UNIQUE ("event_id");

ALTER TABLE ONLY "public"."rca_evidence"
    ADD CONSTRAINT "rca_evidence_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."rca_factors"
    ADD CONSTRAINT "rca_factors_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."rca_factors"
    ADD CONSTRAINT "rca_factors_position_key" UNIQUE ("rca_id", "position") DEFERRABLE;

ALTER TABLE ONLY "public"."rca_members"
    ADD CONSTRAINT "rca_members_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."rca"
    ADD CONSTRAINT "rca_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."rca_root_causes"
    ADD CONSTRAINT "rca_root_causes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."rca_root_causes"
    ADD CONSTRAINT "rca_root_causes_position_key" UNIQUE ("rca_id", "position") DEFERRABLE;

ALTER TABLE ONLY "public"."rca_timeline_entries"
    ADD CONSTRAINT "rca_timeline_entries_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."rca_timeline_entries"
    ADD CONSTRAINT "rca_timeline_position_key" UNIQUE ("rca_id", "position") DEFERRABLE;

ALTER TABLE ONLY "public"."rca_why_chains"
    ADD CONSTRAINT "rca_why_chains_factor_key" UNIQUE ("factor_id");

ALTER TABLE ONLY "public"."rca_why_chains"
    ADD CONSTRAINT "rca_why_chains_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."capa_action"
    ADD CONSTRAINT "capa_action_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."capa_action"
    ADD CONSTRAINT "capa_action_capa_id_fkey" FOREIGN KEY ("capa_id") REFERENCES "public"."capa_plan"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."capa_action"
    ADD CONSTRAINT "capa_action_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."capa_action_evidence"
    ADD CONSTRAINT "capa_action_evidence_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "public"."capa_action"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."capa_action_evidence"
    ADD CONSTRAINT "capa_action_evidence_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."capa_action_evidence"
    ADD CONSTRAINT "capa_action_evidence_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."capa_action"
    ADD CONSTRAINT "capa_action_root_cause_id_fkey" FOREIGN KEY ("root_cause_id") REFERENCES "public"."rca_root_causes"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."capa_action_task"
    ADD CONSTRAINT "capa_action_task_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "public"."capa_action"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."capa_effectiveness"
    ADD CONSTRAINT "capa_effectiveness_capa_id_fkey" FOREIGN KEY ("capa_id") REFERENCES "public"."capa_plan"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."capa_effectiveness"
    ADD CONSTRAINT "capa_effectiveness_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."capa_measure"
    ADD CONSTRAINT "capa_measure_capa_id_fkey" FOREIGN KEY ("capa_id") REFERENCES "public"."capa_plan"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."capa_measure_result"
    ADD CONSTRAINT "capa_measure_result_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."capa_measure_result"
    ADD CONSTRAINT "capa_measure_result_measure_id_fkey" FOREIGN KEY ("measure_id") REFERENCES "public"."capa_measure"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."capa_plan"
    ADD CONSTRAINT "capa_plan_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."capa_plan"
    ADD CONSTRAINT "capa_plan_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."capa_plan"
    ADD CONSTRAINT "capa_plan_source_event_id_fkey" FOREIGN KEY ("source_event_id") REFERENCES "public"."patient_safety_event"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."capa_plan"
    ADD CONSTRAINT "capa_plan_source_meeting_id_fkey" FOREIGN KEY ("source_meeting_id") REFERENCES "public"."meetings"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."capa_plan"
    ADD CONSTRAINT "capa_plan_source_rca_id_fkey" FOREIGN KEY ("source_rca_id") REFERENCES "public"."rca"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."event_custody"
    ADD CONSTRAINT "event_custody_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."event_custody"
    ADD CONSTRAINT "event_custody_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."patient_safety_event"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."event_custody"
    ADD CONSTRAINT "event_custody_owner_commission_id_fkey" FOREIGN KEY ("owner_commission_id") REFERENCES "public"."commissions"("id");

ALTER TABLE ONLY "public"."event_patient"
    ADD CONSTRAINT "event_patient_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."patient_safety_event"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."event_triage"
    ADD CONSTRAINT "event_triage_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."patient_safety_event"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."event_triage_sentinel_flags"
    ADD CONSTRAINT "event_triage_sentinel_flags_criteria_id_fkey" FOREIGN KEY ("criteria_id") REFERENCES "public"."pqs_sentinel_criteria"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."event_triage_sentinel_flags"
    ADD CONSTRAINT "event_triage_sentinel_flags_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."event_triage"("event_id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."event_triage"
    ADD CONSTRAINT "event_triage_triaged_by_fkey" FOREIGN KEY ("triaged_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."patient_safety_event"
    ADD CONSTRAINT "patient_safety_event_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."patient_safety_event"
    ADD CONSTRAINT "patient_safety_event_phi_disposed_by_fkey" FOREIGN KEY ("phi_disposed_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."patient_safety_event"
    ADD CONSTRAINT "patient_safety_event_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."patient_safety_event"
    ADD CONSTRAINT "patient_safety_event_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."patient_safety_event"
    ADD CONSTRAINT "patient_safety_event_current_owner_commission_id_fkey" FOREIGN KEY ("current_owner_commission_id") REFERENCES "public"."commissions"("id");

ALTER TABLE ONLY "public"."patient_safety_event"
    ADD CONSTRAINT "patient_safety_event_event_type_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."pqs_event_types"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."patient_safety_event"
    ADD CONSTRAINT "patient_safety_event_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."patient_safety_event"
    ADD CONSTRAINT "patient_safety_event_reporting_commission_id_fkey" FOREIGN KEY ("reporting_commission_id") REFERENCES "public"."commissions"("id");

ALTER TABLE ONLY "public"."rca"
    ADD CONSTRAINT "rca_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."rca"
    ADD CONSTRAINT "rca_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."rca"
    ADD CONSTRAINT "rca_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."patient_safety_event"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."rca_evidence"
    ADD CONSTRAINT "rca_evidence_cited_document_id_fkey" FOREIGN KEY ("cited_document_id") REFERENCES "public"."case_documents"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."rca_evidence"
    ADD CONSTRAINT "rca_evidence_cited_interview_id_fkey" FOREIGN KEY ("cited_interview_id") REFERENCES "public"."case_interviews"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."rca_evidence"
    ADD CONSTRAINT "rca_evidence_cited_meeting_id_fkey" FOREIGN KEY ("cited_meeting_id") REFERENCES "public"."meetings"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."rca_evidence"
    ADD CONSTRAINT "rca_evidence_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."rca_evidence"
    ADD CONSTRAINT "rca_evidence_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."rca_evidence"
    ADD CONSTRAINT "rca_evidence_rca_id_fkey" FOREIGN KEY ("rca_id") REFERENCES "public"."rca"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."rca_factors"
    ADD CONSTRAINT "rca_factors_rca_id_fkey" FOREIGN KEY ("rca_id") REFERENCES "public"."rca"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."rca_members"
    ADD CONSTRAINT "rca_members_rca_id_fkey" FOREIGN KEY ("rca_id") REFERENCES "public"."rca"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."rca_members"
    ADD CONSTRAINT "rca_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."rca_root_causes"
    ADD CONSTRAINT "rca_root_causes_rca_id_fkey" FOREIGN KEY ("rca_id") REFERENCES "public"."rca"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."rca"
    ADD CONSTRAINT "rca_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."rca_timeline_entries"
    ADD CONSTRAINT "rca_timeline_entries_rca_id_fkey" FOREIGN KEY ("rca_id") REFERENCES "public"."rca"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."rca_why_chains"
    ADD CONSTRAINT "rca_why_chains_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "public"."rca_factors"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."rca_why_chains"
    ADD CONSTRAINT "rca_why_chains_rca_id_fkey" FOREIGN KEY ("rca_id") REFERENCES "public"."rca"("id") ON DELETE CASCADE;

CREATE INDEX "capa_action_assignee_idx" ON "public"."capa_action" USING "btree" ("assignee_user_id");

CREATE INDEX "capa_action_capa_idx" ON "public"."capa_action" USING "btree" ("capa_id", "position");

CREATE INDEX "capa_action_evidence_action_idx" ON "public"."capa_action_evidence" USING "btree" ("action_id");

CREATE UNIQUE INDEX "capa_action_evidence_storage_path_key" ON "public"."capa_action_evidence" USING "btree" ("storage_path") WHERE ("storage_path" IS NOT NULL);

CREATE INDEX "capa_action_root_cause_idx" ON "public"."capa_action" USING "btree" ("root_cause_id");

CREATE INDEX "capa_action_task_action_idx" ON "public"."capa_action_task" USING "btree" ("action_id", "position");

CREATE INDEX "capa_measure_capa_idx" ON "public"."capa_measure" USING "btree" ("capa_id", "position");

CREATE INDEX "capa_measure_result_measure_idx" ON "public"."capa_measure_result" USING "btree" ("measure_id");

CREATE INDEX "capa_plan_source_event_idx" ON "public"."capa_plan" USING "btree" ("source_event_id");

CREATE INDEX "capa_plan_source_rca_idx" ON "public"."capa_plan" USING "btree" ("source_rca_id");

CREATE INDEX "capa_plan_status_idx" ON "public"."capa_plan" USING "btree" ("status");

CREATE INDEX "event_custody_event_idx" ON "public"."event_custody" USING "btree" ("event_id", "held_from");

CREATE UNIQUE INDEX "event_custody_open_interval_key" ON "public"."event_custody" USING "btree" ("event_id") WHERE ("held_until" IS NULL);

CREATE INDEX "event_triage_sentinel_flags_event_idx" ON "public"."event_triage_sentinel_flags" USING "btree" ("event_id");

CREATE INDEX "patient_safety_event_case_idx" ON "public"."patient_safety_event" USING "btree" ("case_id");

CREATE INDEX "patient_safety_event_owner_idx" ON "public"."patient_safety_event" USING "btree" ("current_owner_commission_id");

CREATE INDEX "patient_safety_event_reporting_idx" ON "public"."patient_safety_event" USING "btree" ("reporting_commission_id");

CREATE INDEX "patient_safety_event_status_idx" ON "public"."patient_safety_event" USING "btree" ("status");

CREATE UNIQUE INDEX "pqs_department_singleton_key" ON "public"."pqs_department" USING "btree" ("singleton");

CREATE INDEX "rca_event_idx" ON "public"."rca" USING "btree" ("event_id");

CREATE INDEX "rca_evidence_rca_idx" ON "public"."rca_evidence" USING "btree" ("rca_id");

CREATE UNIQUE INDEX "rca_evidence_storage_path_key" ON "public"."rca_evidence" USING "btree" ("storage_path") WHERE ("storage_path" IS NOT NULL);

CREATE INDEX "rca_factors_rca_idx" ON "public"."rca_factors" USING "btree" ("rca_id", "position");

CREATE INDEX "rca_members_rca_idx" ON "public"."rca_members" USING "btree" ("rca_id");

CREATE UNIQUE INDEX "rca_members_user_key" ON "public"."rca_members" USING "btree" ("rca_id", "user_id") WHERE ("user_id" IS NOT NULL);

CREATE INDEX "rca_root_causes_rca_idx" ON "public"."rca_root_causes" USING "btree" ("rca_id", "position");

CREATE INDEX "rca_timeline_rca_idx" ON "public"."rca_timeline_entries" USING "btree" ("rca_id", "position");

CREATE INDEX "rca_why_chains_rca_idx" ON "public"."rca_why_chains" USING "btree" ("rca_id");

CREATE OR REPLACE TRIGGER "audit_capa_effectiveness_trg" AFTER INSERT OR UPDATE ON "public"."capa_effectiveness" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_capa_effectiveness"();

CREATE OR REPLACE TRIGGER "audit_capa_plan_trg" AFTER INSERT OR UPDATE ON "public"."capa_plan" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_capa_plan"();

CREATE OR REPLACE TRIGGER "audit_event_custody_trg" AFTER INSERT ON "public"."event_custody" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_event_custody"();

CREATE OR REPLACE TRIGGER "audit_event_patient_trg" AFTER INSERT OR UPDATE ON "public"."event_patient" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_event_patient"();

CREATE OR REPLACE TRIGGER "audit_event_triage_trg" AFTER INSERT OR UPDATE ON "public"."event_triage" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_event_triage"();

CREATE OR REPLACE TRIGGER "audit_rca_trg" AFTER INSERT OR UPDATE ON "public"."rca" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_rca"();

CREATE OR REPLACE TRIGGER "audit_safety_event_trg" AFTER INSERT OR UPDATE ON "public"."patient_safety_event" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_safety_event"();

CREATE OR REPLACE TRIGGER "guard_capa_child_lock_action_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."capa_action" FOR EACH ROW EXECUTE FUNCTION "app"."guard_capa_child_lock"();

CREATE OR REPLACE TRIGGER "guard_capa_child_lock_effectiveness_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."capa_effectiveness" FOR EACH ROW EXECUTE FUNCTION "app"."guard_capa_child_lock"();

CREATE OR REPLACE TRIGGER "guard_capa_child_lock_evidence_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."capa_action_evidence" FOR EACH ROW EXECUTE FUNCTION "app"."guard_capa_child_lock"();

CREATE OR REPLACE TRIGGER "guard_capa_child_lock_measure_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."capa_measure" FOR EACH ROW EXECUTE FUNCTION "app"."guard_capa_child_lock"();

CREATE OR REPLACE TRIGGER "guard_capa_child_lock_result_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."capa_measure_result" FOR EACH ROW EXECUTE FUNCTION "app"."guard_capa_child_lock"();

CREATE OR REPLACE TRIGGER "guard_capa_child_lock_task_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."capa_action_task" FOR EACH ROW EXECUTE FUNCTION "app"."guard_capa_child_lock"();

CREATE OR REPLACE TRIGGER "guard_capa_status_trg" BEFORE DELETE OR UPDATE ON "public"."capa_plan" FOR EACH ROW EXECUTE FUNCTION "app"."guard_capa_status"();

CREATE OR REPLACE TRIGGER "guard_event_custody_trg" BEFORE DELETE OR UPDATE ON "public"."event_custody" FOR EACH ROW EXECUTE FUNCTION "app"."guard_event_custody"();

CREATE OR REPLACE TRIGGER "guard_event_status_trg" BEFORE DELETE OR UPDATE ON "public"."patient_safety_event" FOR EACH ROW EXECUTE FUNCTION "app"."guard_event_status"();

CREATE OR REPLACE TRIGGER "guard_event_triage_trg" BEFORE DELETE OR UPDATE ON "public"."event_triage" FOR EACH ROW EXECUTE FUNCTION "app"."guard_event_triage"();

CREATE OR REPLACE TRIGGER "guard_rca_child_lock_evidence_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."rca_evidence" FOR EACH ROW EXECUTE FUNCTION "app"."guard_rca_child_lock"();

CREATE OR REPLACE TRIGGER "guard_rca_child_lock_factors_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."rca_factors" FOR EACH ROW EXECUTE FUNCTION "app"."guard_rca_child_lock"();

CREATE OR REPLACE TRIGGER "guard_rca_child_lock_members_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."rca_members" FOR EACH ROW EXECUTE FUNCTION "app"."guard_rca_child_lock"();

CREATE OR REPLACE TRIGGER "guard_rca_child_lock_roots_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."rca_root_causes" FOR EACH ROW EXECUTE FUNCTION "app"."guard_rca_child_lock"();

CREATE OR REPLACE TRIGGER "guard_rca_child_lock_timeline_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."rca_timeline_entries" FOR EACH ROW EXECUTE FUNCTION "app"."guard_rca_child_lock"();

CREATE OR REPLACE TRIGGER "guard_rca_child_lock_why_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."rca_why_chains" FOR EACH ROW EXECUTE FUNCTION "app"."guard_rca_child_lock"();

CREATE OR REPLACE TRIGGER "guard_rca_status_trg" BEFORE DELETE OR UPDATE ON "public"."rca" FOR EACH ROW EXECUTE FUNCTION "app"."guard_rca_status"();

CREATE OR REPLACE TRIGGER "mint_capa_code_trg" BEFORE INSERT ON "public"."capa_plan" FOR EACH ROW EXECUTE FUNCTION "app"."mint_capa_code"();

CREATE OR REPLACE TRIGGER "mint_event_code_trg" BEFORE INSERT ON "public"."patient_safety_event" FOR EACH ROW EXECUTE FUNCTION "app"."mint_event_code"();

ALTER TABLE "public"."capa_action" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."capa_action_evidence" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."capa_action_task" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."capa_effectiveness" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."capa_measure" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."capa_measure_result" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."capa_plan" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."event_custody" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."event_patient" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."event_triage" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."event_triage_sentinel_flags" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."patient_safety_event" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pqs_department" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pqs_event_types" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pqs_sentinel_criteria" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."rca" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."rca_evidence" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."rca_factors" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."rca_members" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."rca_root_causes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."rca_timeline_entries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."rca_why_chains" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capa_action_evidence_select" ON "public"."capa_action_evidence" FOR SELECT TO "authenticated" USING ("app"."can_read_capa"(( SELECT "capa_action"."capa_id"
   FROM "public"."capa_action"
  WHERE ("capa_action"."id" = "capa_action_evidence"."action_id")), "auth"."uid"()));

CREATE POLICY "capa_action_evidence_write" ON "public"."capa_action_evidence" TO "authenticated" USING ("app"."is_pqs_writer"()) WITH CHECK ("app"."is_pqs_writer"());

CREATE POLICY "capa_action_select" ON "public"."capa_action" FOR SELECT TO "authenticated" USING ("app"."can_read_capa"("capa_id", "auth"."uid"()));

CREATE POLICY "capa_action_task_select" ON "public"."capa_action_task" FOR SELECT TO "authenticated" USING ("app"."can_read_capa"(( SELECT "capa_action"."capa_id"
   FROM "public"."capa_action"
  WHERE ("capa_action"."id" = "capa_action_task"."action_id")), "auth"."uid"()));

CREATE POLICY "capa_action_task_write" ON "public"."capa_action_task" TO "authenticated" USING ("app"."is_pqs_writer"()) WITH CHECK ("app"."is_pqs_writer"());

CREATE POLICY "capa_action_write" ON "public"."capa_action" TO "authenticated" USING ("app"."is_pqs_writer"()) WITH CHECK ("app"."is_pqs_writer"());

CREATE POLICY "capa_effectiveness_select" ON "public"."capa_effectiveness" FOR SELECT TO "authenticated" USING ("app"."can_read_capa"("capa_id", "auth"."uid"()));

CREATE POLICY "capa_effectiveness_write" ON "public"."capa_effectiveness" TO "authenticated" USING ("app"."is_pqs_writer"()) WITH CHECK ("app"."is_pqs_writer"());

CREATE POLICY "capa_measure_result_select" ON "public"."capa_measure_result" FOR SELECT TO "authenticated" USING ("app"."can_read_capa"(( SELECT "capa_measure"."capa_id"
   FROM "public"."capa_measure"
  WHERE ("capa_measure"."id" = "capa_measure_result"."measure_id")), "auth"."uid"()));

CREATE POLICY "capa_measure_result_write" ON "public"."capa_measure_result" TO "authenticated" USING ("app"."is_pqs_writer"()) WITH CHECK ("app"."is_pqs_writer"());

CREATE POLICY "capa_measure_select" ON "public"."capa_measure" FOR SELECT TO "authenticated" USING ("app"."can_read_capa"("capa_id", "auth"."uid"()));

CREATE POLICY "capa_measure_write" ON "public"."capa_measure" TO "authenticated" USING ("app"."is_pqs_writer"()) WITH CHECK ("app"."is_pqs_writer"());

CREATE POLICY "capa_plan_delete" ON "public"."capa_plan" FOR DELETE TO "authenticated" USING ("app"."is_pqs_writer"());

CREATE POLICY "capa_plan_select" ON "public"."capa_plan" FOR SELECT TO "authenticated" USING ("app"."can_read_capa"("id", "auth"."uid"()));

CREATE POLICY "capa_plan_update" ON "public"."capa_plan" FOR UPDATE TO "authenticated" USING ("app"."is_pqs_writer"()) WITH CHECK ("app"."is_pqs_writer"());

CREATE POLICY "event_custody_select" ON "public"."event_custody" FOR SELECT TO "authenticated" USING ("app"."can_read_event"("event_id", "auth"."uid"()));

-- WS A: direct SELECT on event_patient is REVOKED from authenticated (see the
-- grants_revoke baseline) so the get_event_patient RPC is the only door. This
-- policy is kept as defense-in-depth with the TIGHT identifier predicate (PQS
-- member OR custodian staff_admin; NO reporting-provenance, NO admin) for any
-- future role and so the table is never policy-open.
CREATE POLICY "event_patient_select" ON "public"."event_patient" FOR SELECT TO "authenticated" USING ("app"."can_read_event_patient"("event_id", "auth"."uid"()));

CREATE POLICY "event_triage_select" ON "public"."event_triage" FOR SELECT TO "authenticated" USING ("app"."can_read_event"("event_id", "auth"."uid"()));

CREATE POLICY "event_triage_sentinel_flags_select" ON "public"."event_triage_sentinel_flags" FOR SELECT TO "authenticated" USING ("app"."can_read_event"("event_id", "auth"."uid"()));

CREATE POLICY "patient_safety_event_select" ON "public"."patient_safety_event" FOR SELECT TO "authenticated" USING ("app"."can_read_event"("id", "auth"."uid"()));

CREATE POLICY "pqs_department_select" ON "public"."pqs_department" FOR SELECT TO "authenticated" USING (true);

COMMENT ON POLICY "pqs_department_select" ON "public"."pqs_department" IS 'Non-PHI singleton NSP config (name + rca_default_due_days) is readable by any authenticated member; anon excluded. Satisfies Architecture Rule 1 and unblocks 14b direct reads. Writes stay DEFINER-only (no write policy).';

CREATE POLICY "pqs_event_types_select" ON "public"."pqs_event_types" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "pqs_sentinel_criteria_select" ON "public"."pqs_sentinel_criteria" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "rca_delete" ON "public"."rca" FOR DELETE TO "authenticated" USING ("app"."can_write_rca"("id", "auth"."uid"()));

CREATE POLICY "rca_evidence_select" ON "public"."rca_evidence" FOR SELECT TO "authenticated" USING ("app"."can_read_event"("app"."event_of_rca"("rca_id"), "auth"."uid"()));

CREATE POLICY "rca_evidence_write" ON "public"."rca_evidence" TO "authenticated" USING ("app"."can_write_rca"("rca_id", "auth"."uid"())) WITH CHECK ("app"."can_write_rca"("rca_id", "auth"."uid"()));

CREATE POLICY "rca_factors_select" ON "public"."rca_factors" FOR SELECT TO "authenticated" USING ("app"."can_read_event"("app"."event_of_rca"("rca_id"), "auth"."uid"()));

CREATE POLICY "rca_factors_write" ON "public"."rca_factors" TO "authenticated" USING ("app"."can_write_rca"("rca_id", "auth"."uid"())) WITH CHECK ("app"."can_write_rca"("rca_id", "auth"."uid"()));

CREATE POLICY "rca_members_select" ON "public"."rca_members" FOR SELECT TO "authenticated" USING ("app"."can_read_event"("app"."event_of_rca"("rca_id"), "auth"."uid"()));

CREATE POLICY "rca_members_write" ON "public"."rca_members" TO "authenticated" USING ("app"."can_write_rca"("rca_id", "auth"."uid"())) WITH CHECK ("app"."can_write_rca"("rca_id", "auth"."uid"()));

CREATE POLICY "rca_root_causes_select" ON "public"."rca_root_causes" FOR SELECT TO "authenticated" USING ("app"."can_read_event"("app"."event_of_rca"("rca_id"), "auth"."uid"()));

CREATE POLICY "rca_root_causes_write" ON "public"."rca_root_causes" TO "authenticated" USING ("app"."can_write_rca"("rca_id", "auth"."uid"())) WITH CHECK ("app"."can_write_rca"("rca_id", "auth"."uid"()));

CREATE POLICY "rca_select" ON "public"."rca" FOR SELECT TO "authenticated" USING ("app"."can_read_event"("event_id", "auth"."uid"()));

CREATE POLICY "rca_timeline_select" ON "public"."rca_timeline_entries" FOR SELECT TO "authenticated" USING ("app"."can_read_event"("app"."event_of_rca"("rca_id"), "auth"."uid"()));

CREATE POLICY "rca_timeline_write" ON "public"."rca_timeline_entries" TO "authenticated" USING ("app"."can_write_rca"("rca_id", "auth"."uid"())) WITH CHECK ("app"."can_write_rca"("rca_id", "auth"."uid"()));

CREATE POLICY "rca_update" ON "public"."rca" FOR UPDATE TO "authenticated" USING ("app"."can_write_rca"("id", "auth"."uid"())) WITH CHECK ("app"."can_write_rca"("id", "auth"."uid"()));

CREATE POLICY "rca_why_chains_select" ON "public"."rca_why_chains" FOR SELECT TO "authenticated" USING ("app"."can_read_event"("app"."event_of_rca"("rca_id"), "auth"."uid"()));

CREATE POLICY "rca_why_chains_write" ON "public"."rca_why_chains" TO "authenticated" USING ("app"."can_write_rca"("rca_id", "auth"."uid"())) WITH CHECK ("app"."can_write_rca"("rca_id", "auth"."uid"()));

GRANT ALL ON TABLE "public"."capa_action" TO "authenticated";
GRANT ALL ON TABLE "public"."capa_action" TO "service_role";

REVOKE ALL ON FUNCTION "app"."advance_capa_action_core"("p_action_id" "uuid", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."advance_capa_action_core"("p_action_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."advance_capa_action_core"("p_action_id" "uuid", "p_status" "text") TO "service_role";

REVOKE ALL ON FUNCTION "app"."assert_capa_writable"("p_capa_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."assert_capa_writable"("p_capa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."assert_capa_writable"("p_capa_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."assert_patient_safety_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."assert_patient_safety_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "app"."assert_patient_safety_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "app"."assert_rca_writable"("p_rca_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."assert_rca_writable"("p_rca_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."assert_rca_writable"("p_rca_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."can_read_capa"("p_capa_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."can_read_capa"("p_capa_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."can_read_capa"("p_capa_id" "uuid", "p_user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."can_read_event"("p_event_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."can_read_event"("p_event_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."can_read_event"("p_event_id" "uuid", "p_user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."can_write_rca"("p_rca_id" "uuid", "p_uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."can_write_rca"("p_rca_id" "uuid", "p_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."can_write_rca"("p_rca_id" "uuid", "p_uid" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."commission_of_event"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."commission_of_event"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."commission_of_event"("p_event_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."compute_sentinel_determination"("p_reach" "text", "p_harm" "text", "p_natural_course" boolean, "p_has_designated" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."compute_sentinel_determination"("p_reach" "text", "p_harm" "text", "p_natural_course" boolean, "p_has_designated" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "app"."compute_sentinel_determination"("p_reach" "text", "p_harm" "text", "p_natural_course" boolean, "p_has_designated" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "app"."event_capa_fully_settled"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."event_capa_fully_settled"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."event_capa_fully_settled"("p_event_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."event_current_custodian"("p_event_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."event_current_custodian"("p_event_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."event_current_custodian"("p_event_id" "uuid", "p_user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."event_of_capa"("p_capa_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."event_of_capa"("p_capa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."event_of_capa"("p_capa_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."event_of_rca"("p_rca_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."event_of_rca"("p_rca_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."event_of_rca"("p_rca_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."is_pqs_member"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."is_pqs_member"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."is_pqs_member"("p_user_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."is_pqs_writer"() FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."is_pqs_writer"() TO "authenticated";
GRANT ALL ON FUNCTION "app"."is_pqs_writer"() TO "service_role";

REVOKE ALL ON FUNCTION "app"."rca_bump_in_progress"("p_rca_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."rca_bump_in_progress"("p_rca_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."rca_bump_in_progress"("p_rca_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."patient_safety_event" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_safety_event" TO "service_role";

REVOKE ALL ON FUNCTION "public"."acknowledge_event"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."acknowledge_event"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."acknowledge_event"("p_event_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."add_capa_action"("p_capa_id" "uuid", "p_title" "text", "p_owner" "text", "p_assignee_user_id" "uuid", "p_due_date" "date", "p_action_strength" "text", "p_success_measure" "text", "p_root_cause_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_capa_action"("p_capa_id" "uuid", "p_title" "text", "p_owner" "text", "p_assignee_user_id" "uuid", "p_due_date" "date", "p_action_strength" "text", "p_success_measure" "text", "p_root_cause_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_capa_action"("p_capa_id" "uuid", "p_title" "text", "p_owner" "text", "p_assignee_user_id" "uuid", "p_due_date" "date", "p_action_strength" "text", "p_success_measure" "text", "p_root_cause_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."capa_action_evidence" TO "authenticated";
GRANT ALL ON TABLE "public"."capa_action_evidence" TO "service_role";

REVOKE ALL ON FUNCTION "public"."add_capa_action_evidence"("p_action_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text", "p_external_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_capa_action_evidence"("p_action_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text", "p_external_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_capa_action_evidence"("p_action_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text", "p_external_url" "text") TO "service_role";

GRANT ALL ON TABLE "public"."capa_action_task" TO "authenticated";
GRANT ALL ON TABLE "public"."capa_action_task" TO "service_role";

REVOKE ALL ON FUNCTION "public"."add_capa_action_task"("p_action_id" "uuid", "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_capa_action_task"("p_action_id" "uuid", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_capa_action_task"("p_action_id" "uuid", "p_description" "text") TO "service_role";

GRANT ALL ON TABLE "public"."capa_measure" TO "authenticated";
GRANT ALL ON TABLE "public"."capa_measure" TO "service_role";

REVOKE ALL ON FUNCTION "public"."add_capa_measure"("p_capa_id" "uuid", "p_name" "text", "p_target" "text", "p_definition" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_capa_measure"("p_capa_id" "uuid", "p_name" "text", "p_target" "text", "p_definition" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_capa_measure"("p_capa_id" "uuid", "p_name" "text", "p_target" "text", "p_definition" "text") TO "service_role";

GRANT ALL ON TABLE "public"."rca_evidence" TO "authenticated";
GRANT ALL ON TABLE "public"."rca_evidence" TO "service_role";

REVOKE ALL ON FUNCTION "public"."add_rca_evidence"("p_rca_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text", "p_external_url" "text", "p_citation_target" "text", "p_cited_entity_id" "uuid", "p_citation_label" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_rca_evidence"("p_rca_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text", "p_external_url" "text", "p_citation_target" "text", "p_cited_entity_id" "uuid", "p_citation_label" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_rca_evidence"("p_rca_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text", "p_external_url" "text", "p_citation_target" "text", "p_cited_entity_id" "uuid", "p_citation_label" "text") TO "service_role";

GRANT ALL ON TABLE "public"."rca_factors" TO "authenticated";
GRANT ALL ON TABLE "public"."rca_factors" TO "service_role";

REVOKE ALL ON FUNCTION "public"."add_rca_factor"("p_rca_id" "uuid", "p_category" "text", "p_text" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_rca_factor"("p_rca_id" "uuid", "p_category" "text", "p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_rca_factor"("p_rca_id" "uuid", "p_category" "text", "p_text" "text") TO "service_role";

GRANT ALL ON TABLE "public"."rca_members" TO "authenticated";
GRANT ALL ON TABLE "public"."rca_members" TO "service_role";

REVOKE ALL ON FUNCTION "public"."add_rca_member"("p_rca_id" "uuid", "p_role" "text", "p_user_id" "uuid", "p_external_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_rca_member"("p_rca_id" "uuid", "p_role" "text", "p_user_id" "uuid", "p_external_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_rca_member"("p_rca_id" "uuid", "p_role" "text", "p_user_id" "uuid", "p_external_name" "text") TO "service_role";

GRANT ALL ON TABLE "public"."rca_root_causes" TO "authenticated";
GRANT ALL ON TABLE "public"."rca_root_causes" TO "service_role";

REVOKE ALL ON FUNCTION "public"."add_rca_root_cause"("p_rca_id" "uuid", "p_text" "text", "p_category" "text", "p_classification" "text", "p_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_rca_root_cause"("p_rca_id" "uuid", "p_text" "text", "p_category" "text", "p_classification" "text", "p_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_rca_root_cause"("p_rca_id" "uuid", "p_text" "text", "p_category" "text", "p_classification" "text", "p_type" "text") TO "service_role";

GRANT ALL ON TABLE "public"."rca_timeline_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."rca_timeline_entries" TO "service_role";

REVOKE ALL ON FUNCTION "public"."add_rca_timeline_entry"("p_rca_id" "uuid", "p_occurred_at" timestamp with time zone, "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_rca_timeline_entry"("p_rca_id" "uuid", "p_occurred_at" timestamp with time zone, "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_rca_timeline_entry"("p_rca_id" "uuid", "p_occurred_at" timestamp with time zone, "p_description" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."advance_capa_action"("p_action_id" "uuid", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."advance_capa_action"("p_action_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."advance_capa_action"("p_action_id" "uuid", "p_status" "text") TO "service_role";

GRANT ALL ON TABLE "public"."pqs_event_types" TO "authenticated";
GRANT ALL ON TABLE "public"."pqs_event_types" TO "service_role";

REVOKE ALL ON FUNCTION "public"."archive_event_type"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_event_type"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_event_type"("p_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."pqs_sentinel_criteria" TO "authenticated";
GRANT ALL ON TABLE "public"."pqs_sentinel_criteria" TO "service_role";

REVOKE ALL ON FUNCTION "public"."archive_sentinel_criterion"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_sentinel_criterion"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_sentinel_criterion"("p_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."capa_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."capa_plan" TO "service_role";

REVOKE ALL ON FUNCTION "public"."cancel_capa_plan"("p_capa_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_capa_plan"("p_capa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_capa_plan"("p_capa_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."cancel_event"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_event"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_event"("p_event_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."capa_kpis"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."capa_kpis"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."capa_kpis"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."capa_viewer_can_manage"("p_capa_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."capa_viewer_can_manage"("p_capa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."capa_viewer_can_manage"("p_capa_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."close_capa_plan"("p_capa_id" "uuid", "p_lessons_learned_md" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."close_capa_plan"("p_capa_id" "uuid", "p_lessons_learned_md" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_capa_plan"("p_capa_id" "uuid", "p_lessons_learned_md" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."complete_capa_action"("p_action_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_capa_action"("p_action_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_capa_action"("p_action_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."rca" TO "authenticated";
GRANT ALL ON TABLE "public"."rca" TO "service_role";

REVOKE ALL ON FUNCTION "public"."complete_rca"("p_rca_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_rca"("p_rca_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_rca"("p_rca_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."event_triage" TO "authenticated";
GRANT ALL ON TABLE "public"."event_triage" TO "service_role";

REVOKE ALL ON FUNCTION "public"."confirm_triage"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_triage"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_triage"("p_event_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_event_type"("p_key" "text", "p_label" "text", "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_event_type"("p_key" "text", "p_label" "text", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_event_type"("p_key" "text", "p_label" "text", "p_description" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_sentinel_criterion"("p_key" "text", "p_label" "text", "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_sentinel_criterion"("p_key" "text", "p_label" "text", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_sentinel_criterion"("p_key" "text", "p_label" "text", "p_description" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."delete_capa_action_evidence"("p_evidence_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_capa_action_evidence"("p_evidence_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_capa_action_evidence"("p_evidence_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."delete_rca_evidence"("p_evidence_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_rca_evidence"("p_evidence_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_rca_evidence"("p_evidence_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."notify_safety_event"("p_reporting_commission_id" "uuid", "p_title" "text", "p_description_md" "text", "p_suspected_harm_level" "text", "p_case_id" "uuid", "p_event_type_id" "uuid", "p_location" "text", "p_discovered_at" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_safety_event"("p_reporting_commission_id" "uuid", "p_title" "text", "p_description_md" "text", "p_suspected_harm_level" "text", "p_case_id" "uuid", "p_event_type_id" "uuid", "p_location" "text", "p_discovered_at" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_safety_event"("p_reporting_commission_id" "uuid", "p_title" "text", "p_description_md" "text", "p_suspected_harm_level" "text", "p_case_id" "uuid", "p_event_type_id" "uuid", "p_location" "text", "p_discovered_at" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."open_capa_plan"("p_source" "text", "p_classification" "text", "p_source_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."open_capa_plan"("p_source" "text", "p_classification" "text", "p_source_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."open_capa_plan"("p_source" "text", "p_classification" "text", "p_source_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."patient_safety_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."patient_safety_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."patient_safety_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."pqs_inbox"("p_status" "text", "p_suspected_harm_level" "text", "p_reporting_commission_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pqs_inbox"("p_status" "text", "p_suspected_harm_level" "text", "p_reporting_commission_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pqs_inbox"("p_status" "text", "p_suspected_harm_level" "text", "p_reporting_commission_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."rca_writer_can_write"("p_rca_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rca_writer_can_write"("p_rca_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rca_writer_can_write"("p_rca_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."capa_effectiveness" TO "authenticated";
GRANT ALL ON TABLE "public"."capa_effectiveness" TO "service_role";

REVOKE ALL ON FUNCTION "public"."record_capa_effectiveness"("p_capa_id" "uuid", "p_verdict" "text", "p_method_md" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_capa_effectiveness"("p_capa_id" "uuid", "p_verdict" "text", "p_method_md" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_capa_effectiveness"("p_capa_id" "uuid", "p_verdict" "text", "p_method_md" "text") TO "service_role";

GRANT ALL ON TABLE "public"."capa_measure_result" TO "authenticated";
GRANT ALL ON TABLE "public"."capa_measure_result" TO "service_role";

REVOKE ALL ON FUNCTION "public"."record_capa_measure_result"("p_measure_id" "uuid", "p_period" "text", "p_value" numeric, "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_capa_measure_result"("p_measure_id" "uuid", "p_period" "text", "p_value" numeric, "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_capa_measure_result"("p_measure_id" "uuid", "p_period" "text", "p_value" numeric, "p_note" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."remove_capa_action"("p_action_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_capa_action"("p_action_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_capa_action"("p_action_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."remove_capa_action_task"("p_task_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_capa_action_task"("p_task_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_capa_action_task"("p_task_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."remove_capa_measure"("p_measure_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_capa_measure"("p_measure_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_capa_measure"("p_measure_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."remove_rca_factor"("p_factor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_rca_factor"("p_factor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_rca_factor"("p_factor_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."remove_rca_member"("p_member_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_rca_member"("p_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_rca_member"("p_member_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."remove_rca_root_cause"("p_root_cause_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_rca_root_cause"("p_root_cause_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_rca_root_cause"("p_root_cause_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."remove_rca_timeline_entry"("p_entry_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_rca_timeline_entry"("p_entry_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_rca_timeline_entry"("p_entry_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."reopen_capa_plan"("p_capa_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reopen_capa_plan"("p_capa_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reopen_capa_plan"("p_capa_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."reopen_rca"("p_rca_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reopen_rca"("p_rca_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reopen_rca"("p_rca_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."reopen_triage"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reopen_triage"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reopen_triage"("p_event_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."reorder_event_types"("p_ordered_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_event_types"("p_ordered_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_event_types"("p_ordered_ids" "uuid"[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."reorder_rca_timeline"("p_rca_id" "uuid", "p_ordered_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_rca_timeline"("p_rca_id" "uuid", "p_ordered_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_rca_timeline"("p_rca_id" "uuid", "p_ordered_ids" "uuid"[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."reorder_sentinel_criteria"("p_ordered_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_sentinel_criteria"("p_ordered_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_sentinel_criteria"("p_ordered_ids" "uuid"[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."save_triage"("p_event_id" "uuid", "p_is_pse" boolean, "p_pse_closure_reason" "text", "p_reach" "text", "p_harm_severity" "text", "p_natural_course" boolean, "p_review_pathway" "text", "p_disposition_notes_md" "text", "p_sentinel_criteria_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_triage"("p_event_id" "uuid", "p_is_pse" boolean, "p_pse_closure_reason" "text", "p_reach" "text", "p_harm_severity" "text", "p_natural_course" boolean, "p_review_pathway" "text", "p_disposition_notes_md" "text", "p_sentinel_criteria_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_triage"("p_event_id" "uuid", "p_is_pse" boolean, "p_pse_closure_reason" "text", "p_reach" "text", "p_harm_severity" "text", "p_natural_course" boolean, "p_review_pathway" "text", "p_disposition_notes_md" "text", "p_sentinel_criteria_ids" "uuid"[]) TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_capa_action_task_done"("p_task_id" "uuid", "p_is_done" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_capa_action_task_done"("p_task_id" "uuid", "p_is_done" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_capa_action_task_done"("p_task_id" "uuid", "p_is_done" boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_event_patient"("p_event_id" "uuid", "p_name" "text", "p_mrn" "text", "p_date_of_birth" "date", "p_age_years" integer, "p_sex" "text", "p_encounter_ref" "text", "p_unit" "text", "p_attending" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_event_patient"("p_event_id" "uuid", "p_name" "text", "p_mrn" "text", "p_date_of_birth" "date", "p_age_years" integer, "p_sex" "text", "p_encounter_ref" "text", "p_unit" "text", "p_attending" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_event_patient"("p_event_id" "uuid", "p_name" "text", "p_mrn" "text", "p_date_of_birth" "date", "p_age_years" integer, "p_sex" "text", "p_encounter_ref" "text", "p_unit" "text", "p_attending" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_pqs_rca_due_window"("p_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_pqs_rca_due_window"("p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_pqs_rca_due_window"("p_days" integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_rca_factor_key"("p_factor_id" "uuid", "p_is_key" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_rca_factor_key"("p_factor_id" "uuid", "p_is_key" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_rca_factor_key"("p_factor_id" "uuid", "p_is_key" boolean) TO "service_role";

GRANT ALL ON TABLE "public"."rca_why_chains" TO "authenticated";
GRANT ALL ON TABLE "public"."rca_why_chains" TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_rca_why_root"("p_factor_id" "uuid", "p_root_text" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_rca_why_root"("p_factor_id" "uuid", "p_root_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_rca_why_root"("p_factor_id" "uuid", "p_root_text" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_rca_why_step"("p_factor_id" "uuid", "p_index" integer, "p_text" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_rca_why_step"("p_factor_id" "uuid", "p_index" integer, "p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_rca_why_step"("p_factor_id" "uuid", "p_index" integer, "p_text" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."submit_rca_for_review"("p_rca_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_rca_for_review"("p_rca_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_rca_for_review"("p_rca_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."transfer_event_custody"("p_event_id" "uuid", "p_to_owner_kind" "text", "p_to_commission_id" "uuid", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transfer_event_custody"("p_event_id" "uuid", "p_to_owner_kind" "text", "p_to_commission_id" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_event_custody"("p_event_id" "uuid", "p_to_owner_kind" "text", "p_to_commission_id" "uuid", "p_note" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."triage_disposition"("p_event_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."triage_disposition"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."triage_disposition"("p_event_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_capa_action"("p_action_id" "uuid", "p_title" "text", "p_owner" "text", "p_assignee_user_id" "uuid", "p_due_date" "date", "p_action_strength" "text", "p_success_measure" "text", "p_root_cause_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_capa_action"("p_action_id" "uuid", "p_title" "text", "p_owner" "text", "p_assignee_user_id" "uuid", "p_due_date" "date", "p_action_strength" "text", "p_success_measure" "text", "p_root_cause_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_capa_action"("p_action_id" "uuid", "p_title" "text", "p_owner" "text", "p_assignee_user_id" "uuid", "p_due_date" "date", "p_action_strength" "text", "p_success_measure" "text", "p_root_cause_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_capa_measure"("p_measure_id" "uuid", "p_name" "text", "p_target" "text", "p_definition" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_capa_measure"("p_measure_id" "uuid", "p_name" "text", "p_target" "text", "p_definition" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_capa_measure"("p_measure_id" "uuid", "p_name" "text", "p_target" "text", "p_definition" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_capa_plan"("p_capa_id" "uuid", "p_classification" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_capa_plan"("p_capa_id" "uuid", "p_classification" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_capa_plan"("p_capa_id" "uuid", "p_classification" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_event"("p_event_id" "uuid", "p_title" "text", "p_description_md" "text", "p_suspected_harm_level" "text", "p_event_type_id" "uuid", "p_location" "text", "p_discovered_at" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_event"("p_event_id" "uuid", "p_title" "text", "p_description_md" "text", "p_suspected_harm_level" "text", "p_event_type_id" "uuid", "p_location" "text", "p_discovered_at" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_event"("p_event_id" "uuid", "p_title" "text", "p_description_md" "text", "p_suspected_harm_level" "text", "p_event_type_id" "uuid", "p_location" "text", "p_discovered_at" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_event_type"("p_id" "uuid", "p_label" "text", "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_event_type"("p_id" "uuid", "p_label" "text", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_event_type"("p_id" "uuid", "p_label" "text", "p_description" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_rca"("p_rca_id" "uuid", "p_what_md" "text", "p_expected_md" "text", "p_detected" "text", "p_impact" "text", "p_scope" "text", "p_summary_md" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_rca"("p_rca_id" "uuid", "p_what_md" "text", "p_expected_md" "text", "p_detected" "text", "p_impact" "text", "p_scope" "text", "p_summary_md" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_rca"("p_rca_id" "uuid", "p_what_md" "text", "p_expected_md" "text", "p_detected" "text", "p_impact" "text", "p_scope" "text", "p_summary_md" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_rca_factor"("p_factor_id" "uuid", "p_text" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_rca_factor"("p_factor_id" "uuid", "p_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_rca_factor"("p_factor_id" "uuid", "p_text" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_rca_member_role"("p_member_id" "uuid", "p_role" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_rca_member_role"("p_member_id" "uuid", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_rca_member_role"("p_member_id" "uuid", "p_role" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_rca_root_cause"("p_root_cause_id" "uuid", "p_text" "text", "p_category" "text", "p_classification" "text", "p_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_rca_root_cause"("p_root_cause_id" "uuid", "p_text" "text", "p_category" "text", "p_classification" "text", "p_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_rca_root_cause"("p_root_cause_id" "uuid", "p_text" "text", "p_category" "text", "p_classification" "text", "p_type" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_rca_timeline_entry"("p_entry_id" "uuid", "p_occurred_at" timestamp with time zone, "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_rca_timeline_entry"("p_entry_id" "uuid", "p_occurred_at" timestamp with time zone, "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_rca_timeline_entry"("p_entry_id" "uuid", "p_occurred_at" timestamp with time zone, "p_description" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_sentinel_criterion"("p_id" "uuid", "p_label" "text", "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_sentinel_criterion"("p_id" "uuid", "p_label" "text", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_sentinel_criterion"("p_id" "uuid", "p_label" "text", "p_description" "text") TO "service_role";

GRANT ALL ON TABLE "public"."event_custody" TO "authenticated";
GRANT ALL ON TABLE "public"."event_custody" TO "service_role";

GRANT ALL ON TABLE "public"."event_patient" TO "authenticated";
GRANT ALL ON TABLE "public"."event_patient" TO "service_role";

GRANT ALL ON TABLE "public"."event_triage_sentinel_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."event_triage_sentinel_flags" TO "service_role";

GRANT ALL ON TABLE "public"."pqs_department" TO "authenticated";
GRANT ALL ON TABLE "public"."pqs_department" TO "service_role";
