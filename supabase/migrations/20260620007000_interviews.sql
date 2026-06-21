-- ----------------------------------------------------------------------------
-- Consolidated baseline — interviews
-- ----------------------------------------------------------------------------
SET check_function_bodies = false;
SET client_min_messages = warning;

CREATE OR REPLACE FUNCTION "app"."assert_interview_writable"("p_interview_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
begin
  select commission_id into v_commission_id
  from public.case_interviews where id = p_interview_id;
  if v_commission_id is null then
    raise exception 'entrevista % não encontrada', p_interview_id using errcode = 'no_data_found';
  end if;
  if not app.can_write_interview(p_interview_id, auth.uid()) then
    raise exception 'você não pode editar esta entrevista' using errcode = 'HC039';
  end if;
  return v_commission_id;
end;
$$;

ALTER FUNCTION "app"."assert_interview_writable"("p_interview_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."assert_interviews_enabled"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not app.feature_enabled('interviews') then
    raise exception 'o recurso de entrevistas não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

ALTER FUNCTION "app"."assert_interviews_enabled"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."can_write_interview"("p_interview_id" "uuid", "p_uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.case_interviews i
    where i.id = p_interview_id
      and (
        app.is_staff_admin_of_for(i.commission_id, p_uid)
        or app.is_admin_for(p_uid)
        or exists (
          select 1 from public.case_interview_interviewers iv
          where iv.interview_id = i.id and iv.user_id = p_uid
        )
      )
  );
$$;

ALTER FUNCTION "app"."can_write_interview"("p_interview_id" "uuid", "p_uid" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."commission_of_interview"("p_interview_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select commission_id from public.case_interviews where id = p_interview_id;
$$;

ALTER FUNCTION "app"."commission_of_interview"("p_interview_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_interview_child_lock"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_interview_id uuid;
  v_status text;
begin
  v_interview_id := case when tg_op = 'DELETE' then old.interview_id else new.interview_id end;
  select status into v_status from public.case_interviews where id = v_interview_id;

  if v_status is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if v_status in ('concluida', 'cancelada') then
    raise exception 'o conteúdo desta entrevista está bloqueado (%)', v_status
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

ALTER FUNCTION "app"."guard_interview_child_lock"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_interview_links"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_case_commission uuid;
  v_phase_case uuid;
begin
  select commission_id into v_case_commission
  from public.cases where id = new.case_id;
  if v_case_commission is null then
    raise exception 'caso não encontrado' using errcode = 'no_data_found';
  end if;
  if new.commission_id <> v_case_commission then
    raise exception 'a comissão da entrevista não corresponde ao caso'
      using errcode = 'check_violation';
  end if;

  if new.case_phase_id is not null then
    select case_id into v_phase_case
    from public.case_phases where id = new.case_phase_id;
    if v_phase_case is distinct from new.case_id then
      raise exception 'a fase selecionada não pertence a este caso'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

ALTER FUNCTION "app"."guard_interview_links"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_interview_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_interview_rpc', true), 'off') = 'on';
begin
  if tg_op = 'DELETE' then
    -- A locked interview (concluida/cancelada) cannot be deleted outside an RPC.
    -- (Cascade deletes from the case/commission run as the owner and bypass this.)
    if not v_in_rpc and old.status in ('concluida', 'cancelada') then
      raise exception 'entrevistas concluídas ou canceladas não podem ser excluídas'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- Status transition.
  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'mudanças de estado da entrevista devem passar pelas RPCs de entrevista'
        using errcode = 'check_violation';
    end if;

    if not (
      (old.status = 'rascunho' and new.status in ('agendada', 'cancelada'))
      or (old.status = 'agendada' and new.status in ('em_andamento', 'cancelada'))
      or (old.status = 'em_andamento' and new.status in ('concluida', 'cancelada'))
      or (old.status = 'concluida' and new.status = 'em_andamento')
    ) then
      raise exception 'transição de estado de entrevista inválida: % -> %', old.status, new.status
        using errcode = 'HC038';
    end if;

    return new;
  end if;

  -- No status change. Under the flag any field edit is allowed (the RPCs are the
  -- authority). Outside the flag, freeze a LOCKED interview (concluida/cancelada).
  if v_in_rpc then
    return new;
  end if;

  if old.status in ('concluida', 'cancelada') then
    raise exception 'entrevistas concluídas ou canceladas são imutáveis (edição bloqueada)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "app"."guard_interview_status"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."mint_interview_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.commission_id::text, 0));

  new.interview_number := coalesce(
    (select max(interview_number) from public.case_interviews where commission_id = new.commission_id),
    0
  ) + 1;

  return new;
end;
$$;

ALTER FUNCTION "app"."mint_interview_number"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."touch_interview_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;

ALTER FUNCTION "app"."touch_interview_updated_at"() OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."case_interview_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "interview_id" "uuid" NOT NULL,
    "kind" "text" DEFAULT 'outro'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "storage_path" "text",
    "external_url" "text",
    "mime_type" "text",
    "size_bytes" bigint,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "case_interview_attachments_kind_check" CHECK (("kind" = ANY (ARRAY['gravacao_audio'::"text", 'transcricao_assinada'::"text", 'evidencia'::"text", 'outro'::"text"]))),
    CONSTRAINT "case_interview_attachments_link_https" CHECK ((("external_url" IS NULL) OR ("external_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "case_interview_attachments_size_nonneg" CHECK ((("size_bytes" IS NULL) OR ("size_bytes" >= 0))),
    CONSTRAINT "case_interview_attachments_source_xor" CHECK (((("storage_path" IS NOT NULL) AND ("external_url" IS NULL)) OR (("storage_path" IS NULL) AND ("external_url" IS NOT NULL)))),
    CONSTRAINT "case_interview_attachments_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);

ALTER TABLE "public"."case_interview_attachments" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_interview_attachment"("p_interview_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text" DEFAULT NULL::"text", "p_external_url" "text" DEFAULT NULL::"text", "p_mime_type" "text" DEFAULT NULL::"text", "p_size_bytes" bigint DEFAULT NULL::bigint) RETURNS "public"."case_interview_attachments"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_has_path boolean := nullif(btrim(p_storage_path), '') is not null;
  v_has_link boolean := nullif(btrim(p_external_url), '') is not null;
  v_result public.case_interview_attachments;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  if nullif(btrim(p_title), '') is null then
    raise exception 'informe um título para o anexo' using errcode = 'check_violation';
  end if;
  -- Exactly one source (HC040; the table CHECK backstops this).
  if v_has_path = v_has_link then
    raise exception 'envie um arquivo OU informe um link, não os dois' using errcode = 'HC040';
  end if;
  if v_has_link and p_external_url not like 'https://%' then
    raise exception 'o link deve começar com https://' using errcode = 'HC040';
  end if;

  insert into public.case_interview_attachments
    (interview_id, kind, title, storage_path, external_url, mime_type, size_bytes, uploaded_by)
  values
    (p_interview_id, coalesce(p_kind, 'outro'), btrim(p_title),
     nullif(btrim(p_storage_path), ''), nullif(btrim(p_external_url), ''),
     case when v_has_path then p_mime_type else null end,
     case when v_has_path then p_size_bytes else null end,
     auth.uid())
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."add_interview_attachment"("p_interview_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text", "p_external_url" "text", "p_mime_type" "text", "p_size_bytes" bigint) OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."case_interview_interviewers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "interview_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "external_name" "text",
    "external_org" "text",
    "role" "text" DEFAULT 'entrevistador'::"text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "case_interview_interviewers_identity_xor" CHECK (((("user_id" IS NOT NULL) AND ("external_name" IS NULL)) OR (("user_id" IS NULL) AND (NULLIF("btrim"("external_name"), ''::"text") IS NOT NULL)))),
    CONSTRAINT "case_interview_interviewers_role_check" CHECK (("role" = ANY (ARRAY['entrevistador_principal'::"text", 'entrevistador'::"text", 'observador'::"text", 'anotador'::"text"])))
);

ALTER TABLE "public"."case_interview_interviewers" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_interview_interviewer"("p_interview_id" "uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_external_name" "text" DEFAULT NULL::"text", "p_external_org" "text" DEFAULT NULL::"text", "p_role" "text" DEFAULT 'entrevistador'::"text", "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."case_interview_interviewers"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.case_interview_interviewers;
begin
  perform app.assert_interviews_enabled();
  v_commission_id := app.assert_interview_writable(p_interview_id);

  if (p_user_id is not null and nullif(btrim(p_external_name), '') is not null)
     or (p_user_id is null and nullif(btrim(p_external_name), '') is null) then
    raise exception 'informe um membro OU um entrevistador externo, não os dois'
      using errcode = 'check_violation';
  end if;
  -- A REGISTERED interviewer must be a member of the commission (resolved decision 6).
  if p_user_id is not null and not app.is_member_of_for(v_commission_id, p_user_id) then
    raise exception 'o entrevistador deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  insert into public.case_interview_interviewers
    (interview_id, user_id, external_name, external_org, role, note)
  values
    (p_interview_id, p_user_id, nullif(btrim(p_external_name), ''),
     nullif(btrim(p_external_org), ''), coalesce(p_role, 'entrevistador'),
     nullif(btrim(p_note), ''))
  returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."add_interview_interviewer"("p_interview_id" "uuid", "p_user_id" "uuid", "p_external_name" "text", "p_external_org" "text", "p_role" "text", "p_note" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."case_interview_subjects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "interview_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "external_name" "text",
    "external_org" "text",
    "clinical_role" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "case_interview_subjects_identity_xor" CHECK (((("user_id" IS NOT NULL) AND ("external_name" IS NULL)) OR (("user_id" IS NULL) AND (NULLIF("btrim"("external_name"), ''::"text") IS NOT NULL))))
);

ALTER TABLE "public"."case_interview_subjects" OWNER TO "postgres";

-- WS B addendum (ADR 0030/0031): the interview-subject free-text note is
-- PHI-BEARING — a note about an interviewee can name/describe patients. Read-audited
-- via interview.viewed at the interview detail-open (getInterviewDetail +
-- listInterviewSubjects); never copied into the audit log (Rule 11); treat as PHI on
-- surveyor/evidence export (Phase 19). (`clinical_role` stays PHI-free governance
-- metadata — it describes the STAFF interviewee's role, not a patient.)
COMMENT ON COLUMN "public"."case_interview_subjects"."note" IS 'PHI-BEARING free text (WS B; Rule 11/12). Free-text note about an interview subject; audited via interview.viewed; never copied into the audit log.';

CREATE OR REPLACE FUNCTION "public"."add_interview_subject"("p_interview_id" "uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_external_name" "text" DEFAULT NULL::"text", "p_clinical_role" "text" DEFAULT NULL::"text", "p_external_org" "text" DEFAULT NULL::"text", "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."case_interview_subjects"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_result public.case_interview_subjects;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  -- A platform user XOR an external person (the table CHECK also enforces this).
  if (p_user_id is not null and nullif(btrim(p_external_name), '') is not null)
     or (p_user_id is null and nullif(btrim(p_external_name), '') is null) then
    raise exception 'informe um membro OU uma pessoa externa, não os dois'
      using errcode = 'check_violation';
  end if;
  -- An interviewee may be ANY platform user (not restricted to commission members).

  perform set_config('app.in_interview_rpc', 'on', true);
  insert into public.case_interview_subjects
    (interview_id, user_id, external_name, external_org, clinical_role, note)
  values
    (p_interview_id, p_user_id, nullif(btrim(p_external_name), ''),
     nullif(btrim(p_external_org), ''), nullif(btrim(p_clinical_role), ''),
     nullif(btrim(p_note), ''))
  returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."add_interview_subject"("p_interview_id" "uuid", "p_user_id" "uuid", "p_external_name" "text", "p_clinical_role" "text", "p_external_org" "text", "p_note" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."case_interviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "commission_id" "uuid" NOT NULL,
    "case_id" "uuid" NOT NULL,
    "case_phase_id" "uuid",
    "interview_number" integer NOT NULL,
    "title" "text",
    "status" "text" DEFAULT 'rascunho'::"text" NOT NULL,
    "modality" "text" DEFAULT 'presencial'::"text" NOT NULL,
    "location_text" "text",
    "meeting_url" "text",
    "scheduled_start" timestamp with time zone,
    "scheduled_end" timestamp with time zone,
    "conducted_at" timestamp with time zone,
    "summary_md" "text",
    "form_version_id" "uuid",
    "registry_event_id" "uuid",
    "concluded_at" timestamp with time zone,
    "concluded_by" "uuid",
    "cancelled_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "case_interviews_modality_check" CHECK (("modality" = ANY (ARRAY['presencial'::"text", 'remoto'::"text", 'hibrido'::"text"]))),
    CONSTRAINT "case_interviews_schedule_range" CHECK ((("scheduled_end" IS NULL) OR ("scheduled_start" IS NULL) OR ("scheduled_end" >= "scheduled_start"))),
    CONSTRAINT "case_interviews_status_check" CHECK (("status" = ANY (ARRAY['rascunho'::"text", 'agendada'::"text", 'em_andamento'::"text", 'concluida'::"text", 'cancelada'::"text"])))
);

ALTER TABLE "public"."case_interviews" OWNER TO "postgres";

-- WS B (ADR 0030/0031): the interview summary is PHI-BEARING free text — a clinical
-- interview write-up can name/describe patients. RLS-scoped read; audited at
-- detail-open via interview.viewed; never copied into the audit log (Rule 11);
-- treat as PHI on surveyor/evidence export (Phase 19).
COMMENT ON COLUMN "public"."case_interviews"."summary_md" IS 'PHI-BEARING free text (WS B; Rule 11/12). Interview summary write-up (sanitized Markdown, Rule 7); audited via interview.viewed; never copied into the audit log.';

CREATE OR REPLACE FUNCTION "public"."cancel_interview"("p_interview_id" "uuid") RETURNS "public"."case_interviews"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_result public.case_interviews;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  select status into v_status from public.case_interviews where id = p_interview_id;
  if v_status in ('concluida', 'cancelada') then
    raise exception 'esta entrevista não pode ser cancelada neste estado' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interviews
  set status = 'cancelada', cancelled_at = now()
  where id = p_interview_id
  returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."cancel_interview"("p_interview_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."conclude_interview"("p_interview_id" "uuid") RETURNS "public"."case_interviews"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_status text;
  v_case_id uuid;
  v_number integer;
  v_summary text;
  v_conducted timestamptz;
  v_existing_event uuid;
  v_subject_count integer;
  v_subjects text;
  v_title text;
  v_body text;
  v_event_id uuid;
  v_result public.case_interviews;
begin
  perform app.assert_interviews_enabled();
  v_commission_id := app.assert_interview_writable(p_interview_id);

  select status, case_id, interview_number, summary_md, conducted_at, registry_event_id
    into v_status, v_case_id, v_number, v_summary, v_conducted, v_existing_event
  from public.case_interviews where id = p_interview_id;

  if v_status <> 'em_andamento' then
    raise exception 'apenas entrevistas em andamento podem ser concluídas' using errcode = 'HC038';
  end if;

  -- Require >= 1 interviewee (resolved decision; HC041).
  select count(*) into v_subject_count
  from public.case_interview_subjects where interview_id = p_interview_id;
  if v_subject_count < 1 then
    raise exception 'adicione ao menos um entrevistado antes de concluir' using errcode = 'HC041';
  end if;

  -- Compose the timeline entry. Subjects roster = resolved display names.
  select string_agg(coalesce(p.full_name, s.external_name, 'Entrevistado'), ', ')
    into v_subjects
  from public.case_interview_subjects s
  left join public.profiles p on p.id = s.user_id
  where s.interview_id = p_interview_id;

  v_title := 'Entrevista nº ' || v_number
    || coalesce(': ' || nullif(btrim(v_subjects), ''), '');
  v_body := coalesce(nullif(btrim(v_summary), ''), 'Entrevista concluída.');

  perform set_config('app.in_interview_rpc', 'on', true);

  if v_existing_event is null then
    insert into public.case_events (case_id, kind, title, body, occurred_at, created_by)
    values (v_case_id, 'interview', v_title, v_body,
            coalesce(v_conducted::date, current_date), auth.uid())
    returning id into v_event_id;
  else
    -- Re-conclude after a reopen: UPDATE the same row (no duplicate timeline entry).
    update public.case_events
    set title = v_title, body = v_body,
        occurred_at = coalesce(v_conducted::date, current_date),
        updated_at = now()
    where id = v_existing_event;
    v_event_id := v_existing_event;
  end if;

  update public.case_interviews
  set status = 'concluida', concluded_at = now(), concluded_by = auth.uid(),
      registry_event_id = v_event_id
  where id = p_interview_id
  returning * into v_result;

  perform set_config('app.in_interview_rpc', 'off', true);
  return v_result;
end;
$$;

ALTER FUNCTION "public"."conclude_interview"("p_interview_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_interview"("p_case_id" "uuid", "p_title" "text" DEFAULT NULL::"text", "p_case_phase_id" "uuid" DEFAULT NULL::"uuid", "p_modality" "text" DEFAULT 'presencial'::"text", "p_scheduled_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_scheduled_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_location_text" "text" DEFAULT NULL::"text", "p_meeting_url" "text" DEFAULT NULL::"text") RETURNS "public"."case_interviews"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.case_interviews;
  v_attempt integer := 0;
begin
  perform app.assert_interviews_enabled();

  select commission_id into v_commission_id from public.cases where id = p_case_id;
  if v_commission_id is null then
    raise exception 'caso % não encontrado', p_case_id using errcode = 'no_data_found';
  end if;
  -- Bootstrap is staff_admin/admin only (resolved decision 14).
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.case_interviews
        (commission_id, case_id, case_phase_id, title, modality,
         scheduled_start, scheduled_end, location_text, meeting_url, created_by)
      values
        (v_commission_id, p_case_id, p_case_phase_id, nullif(btrim(p_title), ''),
         coalesce(p_modality, 'presencial'), p_scheduled_start, p_scheduled_end,
         nullif(btrim(p_location_text), ''), nullif(btrim(p_meeting_url), ''), auth.uid())
      returning * into v_result;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then raise; end if;
    end;
  end loop;

  perform set_config('app.in_interview_rpc', 'off', true);
  return v_result;
end;
$$;

ALTER FUNCTION "public"."create_interview"("p_case_id" "uuid", "p_title" "text", "p_case_phase_id" "uuid", "p_modality" "text", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone, "p_location_text" "text", "p_meeting_url" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."delete_interview_attachment"("p_attachment_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_interview_id uuid;
begin
  perform app.assert_interviews_enabled();
  select interview_id into v_interview_id
  from public.case_interview_attachments where id = p_attachment_id and deleted_at is null;
  if v_interview_id is null then
    raise exception 'anexo não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_interview_writable(v_interview_id);

  -- SOFT delete (Rule 6: the Storage object is retained).
  update public.case_interview_attachments
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_attachment_id;
end;
$$;

ALTER FUNCTION "public"."delete_interview_attachment"("p_attachment_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."interview_viewer_can_write"("p_interview_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.can_write_interview(p_interview_id, auth.uid());
$$;

ALTER FUNCTION "public"."interview_viewer_can_write"("p_interview_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."interviews_enabled"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.feature_enabled('interviews');
$$;

ALTER FUNCTION "public"."interviews_enabled"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."remove_interview_interviewer"("p_interviewer_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_interview_id uuid;
begin
  perform app.assert_interviews_enabled();
  select interview_id into v_interview_id
  from public.case_interview_interviewers where id = p_interviewer_id;
  if v_interview_id is null then
    raise exception 'entrevistador não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_interview_writable(v_interview_id);

  perform set_config('app.in_interview_rpc', 'on', true);
  delete from public.case_interview_interviewers where id = p_interviewer_id;
  perform set_config('app.in_interview_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."remove_interview_interviewer"("p_interviewer_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."remove_interview_subject"("p_subject_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_interview_id uuid;
begin
  perform app.assert_interviews_enabled();
  select interview_id into v_interview_id
  from public.case_interview_subjects where id = p_subject_id;
  if v_interview_id is null then
    raise exception 'entrevistado não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_interview_writable(v_interview_id);

  perform set_config('app.in_interview_rpc', 'on', true);
  delete from public.case_interview_subjects where id = p_subject_id;
  perform set_config('app.in_interview_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."remove_interview_subject"("p_subject_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reopen_interview"("p_interview_id" "uuid") RETURNS "public"."case_interviews"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_result public.case_interviews;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  select status into v_status from public.case_interviews where id = p_interview_id;
  if v_status <> 'concluida' then
    raise exception 'apenas entrevistas concluídas podem ser reabertas' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interviews
  set status = 'em_andamento', concluded_at = null, concluded_by = null
  where id = p_interview_id
  returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."reopen_interview"("p_interview_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."schedule_interview"("p_interview_id" "uuid", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "public"."case_interviews"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_result public.case_interviews;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  if p_scheduled_start is null then
    raise exception 'informe a data e hora da entrevista' using errcode = 'check_violation';
  end if;

  select status into v_status from public.case_interviews where id = p_interview_id;
  if v_status <> 'rascunho' then
    raise exception 'apenas entrevistas em rascunho podem ser agendadas' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interviews
  set status = 'agendada', scheduled_start = p_scheduled_start, scheduled_end = p_scheduled_end
  where id = p_interview_id
  returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."schedule_interview"("p_interview_id" "uuid", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."start_interview"("p_interview_id" "uuid") RETURNS "public"."case_interviews"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_result public.case_interviews;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  select status into v_status from public.case_interviews where id = p_interview_id;
  if v_status <> 'agendada' then
    raise exception 'apenas entrevistas agendadas podem ser iniciadas' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interviews
  set status = 'em_andamento', conducted_at = coalesce(conducted_at, now())
  where id = p_interview_id
  returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."start_interview"("p_interview_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_interview"("p_interview_id" "uuid", "p_title" "text" DEFAULT NULL::"text", "p_case_phase_id" "uuid" DEFAULT NULL::"uuid", "p_modality" "text" DEFAULT 'presencial'::"text", "p_scheduled_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_scheduled_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_location_text" "text" DEFAULT NULL::"text", "p_meeting_url" "text" DEFAULT NULL::"text") RETURNS "public"."case_interviews"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_result public.case_interviews;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  select status into v_status from public.case_interviews where id = p_interview_id;
  if v_status in ('concluida', 'cancelada') then
    raise exception 'a entrevista não pode ser editada neste estado' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interviews
  set title = nullif(btrim(p_title), ''),
      case_phase_id = p_case_phase_id,
      modality = coalesce(p_modality, modality),
      scheduled_start = p_scheduled_start,
      scheduled_end = p_scheduled_end,
      location_text = nullif(btrim(p_location_text), ''),
      meeting_url = nullif(btrim(p_meeting_url), '')
  where id = p_interview_id
  returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_interview"("p_interview_id" "uuid", "p_title" "text", "p_case_phase_id" "uuid", "p_modality" "text", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone, "p_location_text" "text", "p_meeting_url" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_interview_interviewer"("p_interviewer_id" "uuid", "p_role" "text", "p_note" "text" DEFAULT NULL::"text", "p_external_name" "text" DEFAULT NULL::"text", "p_external_org" "text" DEFAULT NULL::"text") RETURNS "public"."case_interview_interviewers"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_interview_id uuid;
  v_user_id uuid;
  v_result public.case_interview_interviewers;
begin
  perform app.assert_interviews_enabled();
  select interview_id, user_id into v_interview_id, v_user_id
  from public.case_interview_interviewers where id = p_interviewer_id;
  if v_interview_id is null then
    raise exception 'entrevistador não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_interview_writable(v_interview_id);

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interview_interviewers
  set role = coalesce(p_role, role),
      note = nullif(btrim(p_note), ''),
      external_name = case when v_user_id is null
                           then coalesce(nullif(btrim(p_external_name), ''), external_name)
                           else external_name end,
      external_org = case when v_user_id is null
                          then nullif(btrim(p_external_org), '')
                          else external_org end
  where id = p_interviewer_id returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_interview_interviewer"("p_interviewer_id" "uuid", "p_role" "text", "p_note" "text", "p_external_name" "text", "p_external_org" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_interview_subject"("p_subject_id" "uuid", "p_clinical_role" "text" DEFAULT NULL::"text", "p_note" "text" DEFAULT NULL::"text", "p_external_name" "text" DEFAULT NULL::"text", "p_external_org" "text" DEFAULT NULL::"text") RETURNS "public"."case_interview_subjects"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_interview_id uuid;
  v_user_id uuid;
  v_result public.case_interview_subjects;
begin
  perform app.assert_interviews_enabled();
  select interview_id, user_id into v_interview_id, v_user_id
  from public.case_interview_subjects where id = p_subject_id;
  if v_interview_id is null then
    raise exception 'entrevistado não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_interview_writable(v_interview_id);

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interview_subjects
  set clinical_role = nullif(btrim(p_clinical_role), ''),
      note = nullif(btrim(p_note), ''),
      external_name = case when v_user_id is null
                           then coalesce(nullif(btrim(p_external_name), ''), external_name)
                           else external_name end,
      external_org = case when v_user_id is null
                          then nullif(btrim(p_external_org), '')
                          else external_org end
  where id = p_subject_id returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_interview_subject"("p_subject_id" "uuid", "p_clinical_role" "text", "p_note" "text", "p_external_name" "text", "p_external_org" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_interview_summary"("p_interview_id" "uuid", "p_summary_md" "text") RETURNS "public"."case_interviews"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_result public.case_interviews;
begin
  perform app.assert_interviews_enabled();
  perform app.assert_interview_writable(p_interview_id);

  select status into v_status from public.case_interviews where id = p_interview_id;
  if v_status in ('concluida', 'cancelada') then
    raise exception 'o resumo não pode ser editado neste estado' using errcode = 'HC038';
  end if;

  perform set_config('app.in_interview_rpc', 'on', true);
  update public.case_interviews set summary_md = p_summary_md where id = p_interview_id
  returning * into v_result;
  perform set_config('app.in_interview_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_interview_summary"("p_interview_id" "uuid", "p_summary_md" "text") OWNER TO "postgres";

ALTER TABLE ONLY "public"."case_interview_attachments"
    ADD CONSTRAINT "case_interview_attachments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."case_interview_attachments"
    ADD CONSTRAINT "case_interview_attachments_storage_path_key" UNIQUE ("storage_path");

ALTER TABLE ONLY "public"."case_interview_interviewers"
    ADD CONSTRAINT "case_interview_interviewers_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."case_interview_subjects"
    ADD CONSTRAINT "case_interview_subjects_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."case_interviews"
    ADD CONSTRAINT "case_interviews_commission_number_key" UNIQUE ("commission_id", "interview_number");

ALTER TABLE ONLY "public"."case_interviews"
    ADD CONSTRAINT "case_interviews_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."case_interview_attachments"
    ADD CONSTRAINT "case_interview_attachments_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."case_interview_attachments"
    ADD CONSTRAINT "case_interview_attachments_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "public"."case_interviews"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."case_interview_attachments"
    ADD CONSTRAINT "case_interview_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."case_interview_interviewers"
    ADD CONSTRAINT "case_interview_interviewers_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "public"."case_interviews"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."case_interview_interviewers"
    ADD CONSTRAINT "case_interview_interviewers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."case_interview_subjects"
    ADD CONSTRAINT "case_interview_subjects_interview_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "public"."case_interviews"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."case_interview_subjects"
    ADD CONSTRAINT "case_interview_subjects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."case_interviews"
    ADD CONSTRAINT "case_interviews_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."case_interviews"
    ADD CONSTRAINT "case_interviews_case_phase_id_fkey" FOREIGN KEY ("case_phase_id") REFERENCES "public"."case_phases"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."case_interviews"
    ADD CONSTRAINT "case_interviews_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."case_interviews"
    ADD CONSTRAINT "case_interviews_concluded_by_fkey" FOREIGN KEY ("concluded_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."case_interviews"
    ADD CONSTRAINT "case_interviews_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."case_interviews"
    ADD CONSTRAINT "case_interviews_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "public"."form_versions"("id");

ALTER TABLE ONLY "public"."case_interviews"
    ADD CONSTRAINT "case_interviews_registry_event_id_fkey" FOREIGN KEY ("registry_event_id") REFERENCES "public"."case_events"("id") ON DELETE SET NULL;

CREATE INDEX "case_interview_attachments_interview_idx" ON "public"."case_interview_attachments" USING "btree" ("interview_id");

CREATE INDEX "case_interview_attachments_interview_live_idx" ON "public"."case_interview_attachments" USING "btree" ("interview_id") WHERE ("deleted_at" IS NULL);

CREATE INDEX "case_interview_interviewers_interview_idx" ON "public"."case_interview_interviewers" USING "btree" ("interview_id");

CREATE UNIQUE INDEX "case_interview_interviewers_interview_user_key" ON "public"."case_interview_interviewers" USING "btree" ("interview_id", "user_id") WHERE ("user_id" IS NOT NULL);

CREATE INDEX "case_interview_interviewers_user_idx" ON "public"."case_interview_interviewers" USING "btree" ("user_id");

CREATE INDEX "case_interview_subjects_interview_idx" ON "public"."case_interview_subjects" USING "btree" ("interview_id");

CREATE UNIQUE INDEX "case_interview_subjects_interview_user_key" ON "public"."case_interview_subjects" USING "btree" ("interview_id", "user_id") WHERE ("user_id" IS NOT NULL);

CREATE INDEX "case_interviews_case_idx" ON "public"."case_interviews" USING "btree" ("case_id");

CREATE INDEX "case_interviews_case_phase_idx" ON "public"."case_interviews" USING "btree" ("case_phase_id");

CREATE INDEX "case_interviews_commission_idx" ON "public"."case_interviews" USING "btree" ("commission_id");

CREATE INDEX "case_interviews_status_idx" ON "public"."case_interviews" USING "btree" ("commission_id", "status");

CREATE OR REPLACE TRIGGER "guard_interview_child_lock_interviewers_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."case_interview_interviewers" FOR EACH ROW EXECUTE FUNCTION "app"."guard_interview_child_lock"();

CREATE OR REPLACE TRIGGER "guard_interview_child_lock_subjects_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."case_interview_subjects" FOR EACH ROW EXECUTE FUNCTION "app"."guard_interview_child_lock"();

CREATE OR REPLACE TRIGGER "guard_interview_links_trg" BEFORE INSERT OR UPDATE ON "public"."case_interviews" FOR EACH ROW EXECUTE FUNCTION "app"."guard_interview_links"();

CREATE OR REPLACE TRIGGER "guard_interview_status_trg" BEFORE DELETE OR UPDATE ON "public"."case_interviews" FOR EACH ROW EXECUTE FUNCTION "app"."guard_interview_status"();

CREATE OR REPLACE TRIGGER "mint_interview_number_trg" BEFORE INSERT ON "public"."case_interviews" FOR EACH ROW EXECUTE FUNCTION "app"."mint_interview_number"();

CREATE OR REPLACE TRIGGER "touch_case_interview_interviewers_updated_at" BEFORE UPDATE ON "public"."case_interview_interviewers" FOR EACH ROW EXECUTE FUNCTION "app"."touch_interview_updated_at"();

CREATE OR REPLACE TRIGGER "touch_case_interview_subjects_updated_at" BEFORE UPDATE ON "public"."case_interview_subjects" FOR EACH ROW EXECUTE FUNCTION "app"."touch_interview_updated_at"();

CREATE OR REPLACE TRIGGER "touch_case_interviews_updated_at" BEFORE UPDATE ON "public"."case_interviews" FOR EACH ROW EXECUTE FUNCTION "app"."touch_interview_updated_at"();

ALTER TABLE "public"."case_interview_attachments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."case_interview_interviewers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."case_interview_subjects" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."case_interviews" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_interview_attachments_select" ON "public"."case_interview_attachments" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_interview"("interview_id")) OR "app"."is_admin"()));

CREATE POLICY "case_interview_attachments_write" ON "public"."case_interview_attachments" TO "authenticated" USING (("app"."can_write_interview"("interview_id", "auth"."uid"()) OR "app"."is_admin"())) WITH CHECK (("app"."can_write_interview"("interview_id", "auth"."uid"()) OR "app"."is_admin"()));

CREATE POLICY "case_interview_interviewers_select" ON "public"."case_interview_interviewers" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_interview"("interview_id")) OR "app"."is_admin"()));

CREATE POLICY "case_interview_interviewers_write" ON "public"."case_interview_interviewers" TO "authenticated" USING (("app"."can_write_interview"("interview_id", "auth"."uid"()) OR "app"."is_admin"())) WITH CHECK (("app"."can_write_interview"("interview_id", "auth"."uid"()) OR "app"."is_admin"()));

CREATE POLICY "case_interview_subjects_select" ON "public"."case_interview_subjects" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_interview"("interview_id")) OR "app"."is_admin"()));

CREATE POLICY "case_interview_subjects_write" ON "public"."case_interview_subjects" TO "authenticated" USING (("app"."can_write_interview"("interview_id", "auth"."uid"()) OR "app"."is_admin"())) WITH CHECK (("app"."can_write_interview"("interview_id", "auth"."uid"()) OR "app"."is_admin"()));

CREATE POLICY "case_interviews_delete" ON "public"."case_interviews" FOR DELETE TO "authenticated" USING (("app"."can_write_interview"("id", "auth"."uid"()) OR "app"."is_admin"()));

CREATE POLICY "case_interviews_insert" ON "public"."case_interviews" FOR INSERT TO "authenticated" WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "case_interviews_select" ON "public"."case_interviews" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "case_interviews_update" ON "public"."case_interviews" FOR UPDATE TO "authenticated" USING (("app"."can_write_interview"("id", "auth"."uid"()) OR "app"."is_admin"())) WITH CHECK (("app"."can_write_interview"("id", "auth"."uid"()) OR "app"."is_admin"()));

REVOKE ALL ON FUNCTION "app"."assert_interview_writable"("p_interview_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."assert_interview_writable"("p_interview_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."assert_interview_writable"("p_interview_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."assert_interviews_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."assert_interviews_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "app"."assert_interviews_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "app"."can_write_interview"("p_interview_id" "uuid", "p_uid" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."can_write_interview"("p_interview_id" "uuid", "p_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."can_write_interview"("p_interview_id" "uuid", "p_uid" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."commission_of_interview"("p_interview_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."commission_of_interview"("p_interview_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."commission_of_interview"("p_interview_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."case_interview_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."case_interview_attachments" TO "service_role";

REVOKE ALL ON FUNCTION "public"."add_interview_attachment"("p_interview_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text", "p_external_url" "text", "p_mime_type" "text", "p_size_bytes" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_interview_attachment"("p_interview_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text", "p_external_url" "text", "p_mime_type" "text", "p_size_bytes" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_interview_attachment"("p_interview_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text", "p_external_url" "text", "p_mime_type" "text", "p_size_bytes" bigint) TO "service_role";

GRANT ALL ON TABLE "public"."case_interview_interviewers" TO "authenticated";
GRANT ALL ON TABLE "public"."case_interview_interviewers" TO "service_role";

REVOKE ALL ON FUNCTION "public"."add_interview_interviewer"("p_interview_id" "uuid", "p_user_id" "uuid", "p_external_name" "text", "p_external_org" "text", "p_role" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_interview_interviewer"("p_interview_id" "uuid", "p_user_id" "uuid", "p_external_name" "text", "p_external_org" "text", "p_role" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_interview_interviewer"("p_interview_id" "uuid", "p_user_id" "uuid", "p_external_name" "text", "p_external_org" "text", "p_role" "text", "p_note" "text") TO "service_role";

GRANT ALL ON TABLE "public"."case_interview_subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."case_interview_subjects" TO "service_role";

REVOKE ALL ON FUNCTION "public"."add_interview_subject"("p_interview_id" "uuid", "p_user_id" "uuid", "p_external_name" "text", "p_clinical_role" "text", "p_external_org" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_interview_subject"("p_interview_id" "uuid", "p_user_id" "uuid", "p_external_name" "text", "p_clinical_role" "text", "p_external_org" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_interview_subject"("p_interview_id" "uuid", "p_user_id" "uuid", "p_external_name" "text", "p_clinical_role" "text", "p_external_org" "text", "p_note" "text") TO "service_role";

GRANT ALL ON TABLE "public"."case_interviews" TO "authenticated";
GRANT ALL ON TABLE "public"."case_interviews" TO "service_role";

REVOKE ALL ON FUNCTION "public"."cancel_interview"("p_interview_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_interview"("p_interview_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_interview"("p_interview_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."conclude_interview"("p_interview_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."conclude_interview"("p_interview_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."conclude_interview"("p_interview_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_interview"("p_case_id" "uuid", "p_title" "text", "p_case_phase_id" "uuid", "p_modality" "text", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone, "p_location_text" "text", "p_meeting_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_interview"("p_case_id" "uuid", "p_title" "text", "p_case_phase_id" "uuid", "p_modality" "text", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone, "p_location_text" "text", "p_meeting_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_interview"("p_case_id" "uuid", "p_title" "text", "p_case_phase_id" "uuid", "p_modality" "text", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone, "p_location_text" "text", "p_meeting_url" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."delete_interview_attachment"("p_attachment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_interview_attachment"("p_attachment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_interview_attachment"("p_attachment_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."interview_viewer_can_write"("p_interview_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."interview_viewer_can_write"("p_interview_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."interview_viewer_can_write"("p_interview_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."interviews_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."interviews_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."interviews_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."remove_interview_interviewer"("p_interviewer_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_interview_interviewer"("p_interviewer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_interview_interviewer"("p_interviewer_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."remove_interview_subject"("p_subject_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_interview_subject"("p_subject_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_interview_subject"("p_subject_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."reopen_interview"("p_interview_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reopen_interview"("p_interview_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reopen_interview"("p_interview_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."schedule_interview"("p_interview_id" "uuid", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."schedule_interview"("p_interview_id" "uuid", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."schedule_interview"("p_interview_id" "uuid", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone) TO "service_role";

REVOKE ALL ON FUNCTION "public"."start_interview"("p_interview_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_interview"("p_interview_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_interview"("p_interview_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_interview"("p_interview_id" "uuid", "p_title" "text", "p_case_phase_id" "uuid", "p_modality" "text", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone, "p_location_text" "text", "p_meeting_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_interview"("p_interview_id" "uuid", "p_title" "text", "p_case_phase_id" "uuid", "p_modality" "text", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone, "p_location_text" "text", "p_meeting_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_interview"("p_interview_id" "uuid", "p_title" "text", "p_case_phase_id" "uuid", "p_modality" "text", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone, "p_location_text" "text", "p_meeting_url" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_interview_interviewer"("p_interviewer_id" "uuid", "p_role" "text", "p_note" "text", "p_external_name" "text", "p_external_org" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_interview_interviewer"("p_interviewer_id" "uuid", "p_role" "text", "p_note" "text", "p_external_name" "text", "p_external_org" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_interview_interviewer"("p_interviewer_id" "uuid", "p_role" "text", "p_note" "text", "p_external_name" "text", "p_external_org" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_interview_subject"("p_subject_id" "uuid", "p_clinical_role" "text", "p_note" "text", "p_external_name" "text", "p_external_org" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_interview_subject"("p_subject_id" "uuid", "p_clinical_role" "text", "p_note" "text", "p_external_name" "text", "p_external_org" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_interview_subject"("p_subject_id" "uuid", "p_clinical_role" "text", "p_note" "text", "p_external_name" "text", "p_external_org" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_interview_summary"("p_interview_id" "uuid", "p_summary_md" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_interview_summary"("p_interview_id" "uuid", "p_summary_md" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_interview_summary"("p_interview_id" "uuid", "p_summary_md" "text") TO "service_role";
