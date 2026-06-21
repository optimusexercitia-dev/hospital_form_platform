-- ----------------------------------------------------------------------------
-- Consolidated baseline — meetings
-- ----------------------------------------------------------------------------
SET check_function_bodies = false;
SET client_min_messages = warning;

CREATE TABLE IF NOT EXISTS "public"."meeting_action_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "commission_id" "uuid" NOT NULL,
    "source_agenda_item_id" "uuid",
    "case_id" "uuid",
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
    CONSTRAINT "meeting_action_items_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'done'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "meeting_action_items_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);

ALTER TABLE "public"."meeting_action_items" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."advance_meeting_action_item_core"("p_action_item_id" "uuid", "p_status" "text") RETURNS "public"."meeting_action_items"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_assigned_to uuid;
  v_uid uuid := auth.uid();
  v_result public.meeting_action_items;
begin
  if p_status not in ('open', 'in_progress', 'done', 'cancelled') then
    raise exception 'estado de item inválido' using errcode = 'check_violation';
  end if;

  select commission_id, assigned_to into v_commission_id, v_assigned_to
  from public.meeting_action_items where id = p_action_item_id;
  if v_commission_id is null then
    raise exception 'item de ação não encontrado' using errcode = 'no_data_found';
  end if;

  if not (
    (v_assigned_to is not null and v_assigned_to = v_uid)
    or app.is_staff_admin_of(v_commission_id)
    or app.is_admin()
  ) then
    raise exception 'você não pode alterar este item de ação' using errcode = 'HC037';
  end if;

  update public.meeting_action_items
  set status = p_status,
      completed_at = case when p_status = 'done' then coalesce(completed_at, now()) else null end,
      completed_by = case when p_status = 'done' then coalesce(completed_by, v_uid) else null end,
      updated_at = now()
  where id = p_action_item_id returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "app"."advance_meeting_action_item_core"("p_action_item_id" "uuid", "p_status" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."assert_meeting_staff_admin"("p_meeting_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
begin
  v_commission_id := app.commission_of_meeting(p_meeting_id);
  if v_commission_id is null then
    raise exception 'reunião % não encontrada', p_meeting_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  return v_commission_id;
end;
$$;

ALTER FUNCTION "app"."assert_meeting_staff_admin"("p_meeting_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."assert_meetings_enabled"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not app.feature_enabled('meetings') then
    raise exception 'o recurso de reuniões não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

ALTER FUNCTION "app"."assert_meetings_enabled"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."can_sign_meeting"("p_attendee_id" "uuid", "p_signer" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1
    from public.meeting_attendees a
    join public.meetings m on m.id = a.meeting_id
    where a.id = p_attendee_id
      and a.user_id is not null
      and a.user_id = p_signer
      and a.attendance = 'presente'
      and m.status = 'em_assinatura'
      and app.is_member_of_for(m.commission_id, p_signer)
  );
$$;

ALTER FUNCTION "app"."can_sign_meeting"("p_attendee_id" "uuid", "p_signer" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."commission_of_meeting"("p_meeting_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select commission_id from public.meetings where id = p_meeting_id;
$$;

ALTER FUNCTION "app"."commission_of_meeting"("p_meeting_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_meeting_action_item"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_meeting_commission uuid;
  v_case_commission uuid;
begin
  select commission_id into v_meeting_commission
  from public.meetings where id = new.meeting_id;
  if v_meeting_commission is null then
    raise exception 'reunião não encontrada' using errcode = 'no_data_found';
  end if;

  -- Keep the denormalized commission honest (the RPC sets it; defend here).
  if new.commission_id <> v_meeting_commission then
    raise exception 'a comissão do item de ação não corresponde à reunião'
      using errcode = 'check_violation';
  end if;

  -- An optional case cross-link must be in the same commission.
  if new.case_id is not null then
    select commission_id into v_case_commission
    from public.cases where id = new.case_id;
    if v_case_commission is distinct from v_meeting_commission then
      raise exception 'este caso pertence a outra comissão' using errcode = 'HC032';
    end if;
  end if;

  return new;
end;
$$;

ALTER FUNCTION "app"."guard_meeting_action_item"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_meeting_cases"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_meeting_commission uuid;
  v_case_commission uuid;
  v_agenda_meeting uuid;
begin
  select commission_id into v_meeting_commission
  from public.meetings where id = new.meeting_id;
  select commission_id into v_case_commission
  from public.cases where id = new.case_id;

  if v_meeting_commission is null or v_case_commission is null
     or v_meeting_commission <> v_case_commission then
    raise exception 'este caso pertence a outra comissão'
      using errcode = 'HC032';
  end if;

  -- An attached agenda item, if given, must belong to THIS meeting.
  if new.agenda_item_id is not null then
    select meeting_id into v_agenda_meeting
    from public.meeting_agenda_items where id = new.agenda_item_id;
    if v_agenda_meeting is distinct from new.meeting_id then
      raise exception 'o item de pauta não pertence a esta reunião'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

ALTER FUNCTION "app"."guard_meeting_cases"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_meeting_child_lock"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_meeting_id uuid;
  v_status text;
begin
  v_meeting_id := case when tg_op = 'DELETE' then old.meeting_id else new.meeting_id end;
  select status into v_status from public.meetings where id = v_meeting_id;

  -- The parent meeting may already be gone (a cascade delete of the meeting also
  -- cascades its children); nothing to lock in that case.
  if v_status is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if v_status in ('em_assinatura', 'assinada', 'distribuida', 'cancelada') then
    raise exception 'o conteúdo desta reunião está bloqueado (%)', v_status
      using errcode = 'check_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

ALTER FUNCTION "app"."guard_meeting_child_lock"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_meeting_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_in_rpc boolean := coalesce(current_setting('app.in_meeting_rpc', true), 'off') = 'on';
  v_locked_rank constant int := 3;  -- em_assinatura and beyond are "locked"
  v_old_rank int;
begin
  v_old_rank := case old.status
    when 'agendada' then 1
    when 'realizada' then 2
    when 'em_assinatura' then 3
    when 'assinada' then 4
    when 'distribuida' then 5
    when 'cancelada' then 5
    else 0
  end;

  if tg_op = 'DELETE' then
    -- A terminal / locked meeting cannot be deleted outside an RPC. (Cascade
    -- deletes from the commission run as the owner and bypass RLS/guards.)
    if not v_in_rpc and old.status in ('em_assinatura', 'assinada', 'distribuida', 'cancelada') then
      raise exception 'reuniões assinadas ou finalizadas não podem ser excluídas'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- Status transition.
  if new.status is distinct from old.status then
    if not v_in_rpc then
      raise exception 'mudanças de estado da reunião devem passar pelas RPCs de reunião'
        using errcode = 'check_violation';
    end if;

    if not (
      (old.status = 'agendada' and new.status in ('realizada', 'cancelada'))
      or (old.status = 'realizada' and new.status in ('em_assinatura', 'cancelada'))
      or (old.status = 'em_assinatura' and new.status in ('assinada', 'realizada', 'cancelada'))
      or (old.status = 'assinada' and new.status in ('distribuida', 'realizada'))
    ) then
      raise exception 'transição de estado de reunião inválida: % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    return new;
  end if;

  -- No status change. Under the flag any field edit is allowed (the RPCs are the
  -- authority). Outside the flag, freeze a LOCKED meeting (>= em_assinatura) —
  -- a direct content edit of a meeting awaiting signature / signed / distributed
  -- is rejected. An unlocked meeting (agendada/realizada) permits direct
  -- non-status edits the RLS already allows (e.g. a future direct quorum_met
  -- override) — but the B3 RPCs use the flag anyway.
  if v_in_rpc then
    return new;
  end if;

  if v_old_rank >= v_locked_rank then
    raise exception 'reuniões a partir de "em assinatura" são imutáveis (edição bloqueada)'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "app"."guard_meeting_status"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."mint_meeting_number"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.commission_id::text, 0));

  new.meeting_number := coalesce(
    (select max(meeting_number) from public.meetings where commission_id = new.commission_id),
    0
  ) + 1;

  return new;
end;
$$;

ALTER FUNCTION "app"."mint_meeting_number"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."seed_default_meeting_types"("p_commission_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  insert into public.commission_meeting_types (commission_id, name, color_token, position)
  values
    (p_commission_id, 'Ordinária', 'blue', 1),
    (p_commission_id, 'Extraordinária', 'amber', 2)
  on conflict (commission_id, name) do nothing;

  insert into public.commission_meeting_settings (commission_id, quorum_rule_type, quorum_value)
  values (p_commission_id, 'maioria_simples', null)
  on conflict (commission_id) do nothing;
end;
$$;

ALTER FUNCTION "app"."seed_default_meeting_types"("p_commission_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."seed_meetings_on_commission_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.seed_default_meeting_types(new.id);
  return new;
end;
$$;

ALTER FUNCTION "app"."seed_meetings_on_commission_insert"() OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."meeting_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "kind" "text" DEFAULT 'outro'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" bigint,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    CONSTRAINT "meeting_attachments_kind_check" CHECK (("kind" = ANY (ARRAY['pauta'::"text", 'apresentacao'::"text", 'literatura'::"text", 'lista_presenca'::"text", 'ata_assinada'::"text", 'outro'::"text"]))),
    CONSTRAINT "meeting_attachments_size_nonneg" CHECK ((("size_bytes" IS NULL) OR ("size_bytes" >= 0))),
    CONSTRAINT "meeting_attachments_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);

ALTER TABLE "public"."meeting_attachments" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_meeting_attachment"("p_meeting_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text", "p_mime_type" "text" DEFAULT NULL::"text", "p_size_bytes" bigint DEFAULT NULL::bigint) RETURNS "public"."meeting_attachments"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_result public.meeting_attachments;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe um título para o anexo' using errcode = 'check_violation';
  end if;

  insert into public.meeting_attachments
    (meeting_id, kind, title, storage_path, mime_type, size_bytes, uploaded_by)
  values
    (p_meeting_id, coalesce(p_kind, 'outro'), btrim(p_title), p_storage_path,
     p_mime_type, p_size_bytes, auth.uid())
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."add_meeting_attachment"("p_meeting_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text", "p_mime_type" "text", "p_size_bytes" bigint) OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."meeting_attendees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "external_name" "text",
    "external_org" "text",
    "role" "text" DEFAULT 'membro'::"text" NOT NULL,
    "attendance" "text" DEFAULT 'convocado'::"text" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "meeting_attendees_attendance_check" CHECK (("attendance" = ANY (ARRAY['convocado'::"text", 'presente'::"text", 'ausente'::"text", 'justificado'::"text"]))),
    CONSTRAINT "meeting_attendees_identity_xor" CHECK (((("user_id" IS NOT NULL) AND ("external_name" IS NULL)) OR (("user_id" IS NULL) AND (NULLIF("btrim"("external_name"), ''::"text") IS NOT NULL)))),
    CONSTRAINT "meeting_attendees_role_check" CHECK (("role" = ANY (ARRAY['presidente'::"text", 'secretario'::"text", 'membro'::"text", 'convidado'::"text"])))
);

ALTER TABLE "public"."meeting_attendees" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."add_meeting_attendee"("p_meeting_id" "uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_external_name" "text" DEFAULT NULL::"text", "p_external_org" "text" DEFAULT NULL::"text", "p_role" "text" DEFAULT 'membro'::"text", "p_attendance" "text" DEFAULT 'convocado'::"text", "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."meeting_attendees"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.meeting_attendees;
begin
  perform app.assert_meetings_enabled();
  v_commission_id := app.assert_meeting_staff_admin(p_meeting_id);

  -- A platform member XOR an external guest (the table CHECK also enforces this;
  -- raise a clean pt-BR here first).
  if (p_user_id is not null and nullif(btrim(p_external_name), '') is not null)
     or (p_user_id is null and nullif(btrim(p_external_name), '') is null) then
    raise exception 'informe um membro OU um convidado externo, não os dois'
      using errcode = 'check_violation';
  end if;
  -- A platform attendee must be a member of the commission.
  if p_user_id is not null and not app.is_member_of_for(v_commission_id, p_user_id) then
    raise exception 'o participante deve ser membro da comissão' using errcode = 'HC021';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  insert into public.meeting_attendees
    (meeting_id, user_id, external_name, external_org, role, attendance, note)
  values
    (p_meeting_id, p_user_id, nullif(btrim(p_external_name), ''), nullif(btrim(p_external_org), ''),
     coalesce(p_role, 'membro'), coalesce(p_attendance, 'convocado'), nullif(btrim(p_note), ''))
  returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."add_meeting_attendee"("p_meeting_id" "uuid", "p_user_id" "uuid", "p_external_name" "text", "p_external_org" "text", "p_role" "text", "p_attendance" "text", "p_note" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."advance_meeting_action_item"("p_action_item_id" "uuid", "p_status" "text") RETURNS "public"."meeting_action_items"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_meetings_enabled();
  return app.advance_meeting_action_item_core(p_action_item_id, p_status);
end;
$$;

ALTER FUNCTION "public"."advance_meeting_action_item"("p_action_item_id" "uuid", "p_status" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."commission_meeting_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "commission_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color_token" "text" DEFAULT 'slate'::"text" NOT NULL,
    "position" integer NOT NULL,
    "archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commission_meeting_types_color_token_check" CHECK (("color_token" = ANY (ARRAY['muted'::"text", 'slate'::"text", 'blue'::"text", 'amber'::"text", 'green'::"text", 'red'::"text", 'violet'::"text"]))),
    CONSTRAINT "commission_meeting_types_name_not_blank" CHECK (("btrim"("name") <> ''::"text"))
);

ALTER TABLE "public"."commission_meeting_types" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."archive_meeting_type"("p_type_id" "uuid") RETURNS "public"."commission_meeting_types"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.commission_meeting_types;
begin
  perform app.assert_meetings_enabled();
  select commission_id into v_commission_id
  from public.commission_meeting_types where id = p_type_id;
  if v_commission_id is null then
    raise exception 'tipo de reunião não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  update public.commission_meeting_types set archived = true, updated_at = now()
  where id = p_type_id returning * into v_result;
  return v_result;
end;
$$;

ALTER FUNCTION "public"."archive_meeting_type"("p_type_id" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "commission_id" "uuid" NOT NULL,
    "meeting_number" integer NOT NULL,
    "meeting_type_id" "uuid",
    "title" "text" NOT NULL,
    "status" "text" DEFAULT 'agendada'::"text" NOT NULL,
    "scheduled_start" timestamp with time zone NOT NULL,
    "scheduled_end" timestamp with time zone,
    "modality" "text" DEFAULT 'presencial'::"text" NOT NULL,
    "location_text" "text",
    "meeting_url" "text",
    "minutes_md" "text",
    "quorum_met" boolean,
    "quorum_rule_type" "text",
    "quorum_value" numeric,
    "present_count" integer,
    "eligible_member_count" integer,
    "concluded_at" timestamp with time zone,
    "concluded_by" "uuid",
    "distributed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "meetings_modality_check" CHECK (("modality" = ANY (ARRAY['presencial'::"text", 'remoto'::"text", 'hibrido'::"text"]))),
    CONSTRAINT "meetings_quorum_rule_type_check" CHECK ((("quorum_rule_type" IS NULL) OR ("quorum_rule_type" = ANY (ARRAY['maioria_simples'::"text", 'fixed_count'::"text", 'percentage'::"text"])))),
    CONSTRAINT "meetings_schedule_range" CHECK ((("scheduled_end" IS NULL) OR ("scheduled_end" >= "scheduled_start"))),
    CONSTRAINT "meetings_status_check" CHECK (("status" = ANY (ARRAY['agendada'::"text", 'realizada'::"text", 'em_assinatura'::"text", 'assinada'::"text", 'distribuida'::"text", 'cancelada'::"text"]))),
    CONSTRAINT "meetings_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);

ALTER TABLE "public"."meetings" OWNER TO "postgres";

-- WS B (ADR 0030/0031): meeting minutes are PHI-BEARING free text — a clinical
-- committee's minutes can name/describe patients. RLS-scoped read; audited at
-- detail-open via meeting.viewed; never copied into the audit log (Rule 11);
-- treat as PHI on surveyor/evidence export (Phase 19).
COMMENT ON COLUMN "public"."meetings"."minutes_md" IS 'PHI-BEARING free text (WS B; Rule 11/12). Meeting minutes/ata (sanitized Markdown, Rule 7); audited via meeting.viewed; never copied into the audit log.';

CREATE OR REPLACE FUNCTION "public"."cancel_meeting"("p_meeting_id" "uuid") RETURNS "public"."meetings"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_result public.meetings;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);

  select status into v_status from public.meetings where id = p_meeting_id;
  if v_status in ('distribuida', 'cancelada') then
    raise exception 'esta reunião está em um estado final e não pode ser cancelada'
      using errcode = 'HC033';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meetings
  set status = 'cancelada', cancelled_at = now(), updated_at = now()
  where id = p_meeting_id returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."cancel_meeting"("p_meeting_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."complete_meeting_action_item"("p_action_item_id" "uuid") RETURNS "public"."meeting_action_items"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  perform app.assert_meetings_enabled();
  return app.advance_meeting_action_item_core(p_action_item_id, 'done');
end;
$$;

ALTER FUNCTION "public"."complete_meeting_action_item"("p_action_item_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."conclude_meeting"("p_meeting_id" "uuid") RETURNS "public"."meetings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_status text;
  v_rule text;
  v_value numeric;
  v_present integer;
  v_eligible integer;
  v_quorum_met boolean;
  v_result public.meetings;
  r_link record;
begin
  perform app.assert_meetings_enabled();

  select commission_id, status into v_commission_id, v_status
  from public.meetings where id = p_meeting_id;
  if v_commission_id is null then
    raise exception 'reunião % não encontrada', p_meeting_id using errcode = 'no_data_found';
  end if;
  -- DEFINER: internal staff_admin gate (the RLS bypass is intentional, so the
  -- gate is the authority).
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  -- Conclude is reachable from agendada OR realizada. The lifecycle is
  -- agendada -> realizada -> em_assinatura; "Concluir" is the single staff action
  -- that records the meeting as HELD and sends the ata to signature, so when the
  -- meeting is still agendada it is first advanced through realizada (a guarded
  -- step) before the conclusion flip. This keeps the frozen frontend contract
  -- (concludeMeeting(meetingId), no separate "mark held" action) intact.
  if v_status not in ('agendada', 'realizada') then
    raise exception 'apenas reuniões agendadas ou realizadas podem ser concluídas'
      using errcode = 'HC033';
  end if;

  -- Quorum math (snapshot at conclusion; resolved design decision 7).
  -- present_count counts PRESENT PLATFORM attendees only: external guests
  -- (user_id is null) never count toward quorum (ADR 0025 / plan §7), and this
  -- must match the sign_meeting auto-flip's "required signers" set, which is
  -- likewise `user_id is not null and attendance = 'presente'`.
  select count(*) into v_eligible
  from public.commission_members where commission_id = v_commission_id;
  select count(*) into v_present
  from public.meeting_attendees
  where meeting_id = p_meeting_id and attendance = 'presente' and user_id is not null;

  if v_present < 1 then
    raise exception 'registre ao menos um participante presente antes de concluir'
      using errcode = 'HC034';
  end if;

  select quorum_rule_type, quorum_value into v_rule, v_value
  from public.commission_meeting_settings where commission_id = v_commission_id;
  v_rule := coalesce(v_rule, 'maioria_simples');

  v_quorum_met := case v_rule
    when 'maioria_simples' then v_present > v_eligible / 2.0
    when 'fixed_count' then v_present >= coalesce(v_value, 0)
    when 'percentage' then v_present >= ceil(v_eligible * coalesce(v_value, 0) / 100.0)
    else false
  end;

  perform set_config('app.in_meeting_rpc', 'on', true);

  -- The guard permits agendada->realizada and realizada->em_assinatura, but NOT
  -- agendada->em_assinatura directly. If still agendada, step through realizada
  -- first (under the flag) so both legal transitions are honoured.
  if v_status = 'agendada' then
    update public.meetings set status = 'realizada', updated_at = now()
    where id = p_meeting_id;
  end if;

  update public.meetings
  set status = 'em_assinatura',
      quorum_rule_type = v_rule,
      quorum_value = v_value,
      present_count = v_present,
      eligible_member_count = v_eligible,
      quorum_met = v_quorum_met,
      concluded_at = now(),
      concluded_by = auth.uid(),
      updated_at = now()
  where id = p_meeting_id
  returning * into v_result;

  -- Write a case_events (kind='meeting') row per linked case (resolved design
  -- decision 4) so the discussion shows on the case timeline.
  for r_link in
    select mc.case_id, mc.summary, mc.decision, m.meeting_number
    from public.meeting_cases mc
    join public.meetings m on m.id = mc.meeting_id
    where mc.meeting_id = p_meeting_id
  loop
    insert into public.case_events (case_id, kind, title, body, occurred_at, created_by)
    values (
      r_link.case_id,
      'meeting',
      'Discutido na Reunião nº ' || r_link.meeting_number,
      coalesce(
        nullif(btrim(concat_ws(E'\n\n',
          nullif(btrim(r_link.summary), ''),
          case when nullif(btrim(r_link.decision), '') is not null
               then 'Decisão: ' || btrim(r_link.decision) end
        )), ''),
        'Caso discutido nesta reunião.'
      ),
      current_date,
      auth.uid()
    );
  end loop;

  perform set_config('app.in_meeting_rpc', 'off', true);
  return v_result;
end;
$$;

ALTER FUNCTION "public"."conclude_meeting"("p_meeting_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_meeting"("p_commission_id" "uuid", "p_title" "text", "p_meeting_type_id" "uuid" DEFAULT NULL::"uuid", "p_scheduled_start" timestamp with time zone DEFAULT "now"(), "p_scheduled_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_modality" "text" DEFAULT 'presencial'::"text", "p_location_text" "text" DEFAULT NULL::"text", "p_meeting_url" "text" DEFAULT NULL::"text") RETURNS "public"."meetings"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_result public.meetings;
  v_attempt integer := 0;
begin
  perform app.assert_meetings_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe um título para a reunião' using errcode = 'check_violation';
  end if;
  -- A given type must belong to this commission.
  if p_meeting_type_id is not null and not exists (
    select 1 from public.commission_meeting_types
    where id = p_meeting_type_id and commission_id = p_commission_id
  ) then
    raise exception 'tipo de reunião inválido' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);

  -- Bounded unique_violation retry for the per-commission number race (mirror
  -- create_case_from_template).
  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.meetings
        (commission_id, meeting_type_id, title, scheduled_start, scheduled_end,
         modality, location_text, meeting_url, created_by)
      values
        (p_commission_id, p_meeting_type_id, btrim(p_title),
         p_scheduled_start, p_scheduled_end, coalesce(p_modality, 'presencial'),
         nullif(btrim(p_location_text), ''), nullif(btrim(p_meeting_url), ''), auth.uid())
      returning * into v_result;
      exit;
    exception
      when unique_violation then
        if v_attempt >= 3 then raise; end if;
    end;
  end loop;

  perform set_config('app.in_meeting_rpc', 'off', true);
  return v_result;
end;
$$;

ALTER FUNCTION "public"."create_meeting"("p_commission_id" "uuid", "p_title" "text", "p_meeting_type_id" "uuid", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone, "p_modality" "text", "p_location_text" "text", "p_meeting_url" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_meeting_action_item"("p_meeting_id" "uuid", "p_title" "text", "p_description" "text" DEFAULT NULL::"text", "p_assigned_to" "uuid" DEFAULT NULL::"uuid", "p_due_date" "date" DEFAULT NULL::"date", "p_source_agenda_item_id" "uuid" DEFAULT NULL::"uuid", "p_case_id" "uuid" DEFAULT NULL::"uuid") RETURNS "public"."meeting_action_items"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.meeting_action_items;
begin
  perform app.assert_meetings_enabled();
  v_commission_id := app.assert_meeting_staff_admin(p_meeting_id);
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe o título do item' using errcode = 'check_violation';
  end if;
  if p_assigned_to is not null and not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;
  -- A source agenda item, if given, must belong to THIS meeting.
  if p_source_agenda_item_id is not null and not exists (
    select 1 from public.meeting_agenda_items
    where id = p_source_agenda_item_id and meeting_id = p_meeting_id
  ) then
    raise exception 'o item de pauta de origem não pertence a esta reunião'
      using errcode = 'check_violation';
  end if;
  -- The case cross-link's same-commission is enforced by guard_meeting_action_item (HC032).

  insert into public.meeting_action_items
    (meeting_id, commission_id, source_agenda_item_id, case_id, title, description,
     assigned_to, due_date, created_by)
  values
    (p_meeting_id, v_commission_id, p_source_agenda_item_id, p_case_id,
     btrim(p_title), nullif(btrim(p_description), ''), p_assigned_to, p_due_date, auth.uid())
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."create_meeting_action_item"("p_meeting_id" "uuid", "p_title" "text", "p_description" "text", "p_assigned_to" "uuid", "p_due_date" "date", "p_source_agenda_item_id" "uuid", "p_case_id" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."meeting_agenda_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "discussion_notes" "text",
    "resolution" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "meeting_agenda_items_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);

ALTER TABLE "public"."meeting_agenda_items" OWNER TO "postgres";

-- WS B addendum (ADR 0030/0031): the agenda-item free-text fields (all three are
-- multi-line textareas: planned content, discussion notes, decision) are
-- PHI-BEARING — a clinical committee's agenda discussion can name/describe patients.
-- Read-audited via meeting.viewed at the meeting detail-open (getMeetingDetail +
-- listMeetingAgenda); never copied into the audit log (Rule 11); treat as PHI on
-- surveyor/evidence export (Phase 19). (The agenda-item `title` stays PHI-free by
-- the title invariant.)
COMMENT ON COLUMN "public"."meeting_agenda_items"."description" IS 'PHI-BEARING free text (WS B; Rule 11/12). Planned agenda-item content (multi-line); audited via meeting.viewed; never copied into the audit log.';
COMMENT ON COLUMN "public"."meeting_agenda_items"."discussion_notes" IS 'PHI-BEARING free text (WS B; Rule 11/12). Agenda-item discussion notes (multi-line); audited via meeting.viewed; never copied into the audit log.';
COMMENT ON COLUMN "public"."meeting_agenda_items"."resolution" IS 'PHI-BEARING free text (WS B; Rule 11/12). Agenda-item resolution/decision (multi-line); audited via meeting.viewed; never copied into the audit log.';

CREATE OR REPLACE FUNCTION "public"."create_meeting_agenda_item"("p_meeting_id" "uuid", "p_title" "text", "p_description" "text" DEFAULT NULL::"text", "p_discussion_notes" "text" DEFAULT NULL::"text", "p_resolution" "text" DEFAULT NULL::"text") RETURNS "public"."meeting_agenda_items"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_position integer;
  v_result public.meeting_agenda_items;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe um título para o item de pauta' using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.meeting_agenda_items where meeting_id = p_meeting_id;

  perform set_config('app.in_meeting_rpc', 'on', true);
  insert into public.meeting_agenda_items
    (meeting_id, position, title, description, discussion_notes, resolution, created_by)
  values
    (p_meeting_id, v_position, btrim(p_title), nullif(btrim(p_description), ''),
     nullif(btrim(p_discussion_notes), ''), nullif(btrim(p_resolution), ''), auth.uid())
  returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."create_meeting_agenda_item"("p_meeting_id" "uuid", "p_title" "text", "p_description" "text", "p_discussion_notes" "text", "p_resolution" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_meeting_type"("p_commission_id" "uuid", "p_name" "text", "p_color_token" "text" DEFAULT 'slate'::"text") RETURNS "public"."commission_meeting_types"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_position integer;
  v_result public.commission_meeting_types;
begin
  perform app.assert_meetings_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'informe o nome do tipo de reunião' using errcode = 'check_violation';
  end if;

  select coalesce(max(position), 0) + 1 into v_position
  from public.commission_meeting_types where commission_id = p_commission_id;

  insert into public.commission_meeting_types (commission_id, name, color_token, position)
  values (p_commission_id, btrim(p_name), coalesce(p_color_token, 'slate'), v_position)
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."create_meeting_type"("p_commission_id" "uuid", "p_name" "text", "p_color_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."delete_meeting_agenda_item"("p_agenda_item_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_meeting_id uuid;
begin
  perform app.assert_meetings_enabled();
  select meeting_id into v_meeting_id from public.meeting_agenda_items where id = p_agenda_item_id;
  if v_meeting_id is null then
    raise exception 'item de pauta não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_meeting_staff_admin(v_meeting_id);

  perform set_config('app.in_meeting_rpc', 'on', true);
  delete from public.meeting_agenda_items where id = p_agenda_item_id;
  perform set_config('app.in_meeting_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."delete_meeting_agenda_item"("p_agenda_item_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."delete_meeting_attachment"("p_attachment_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_meeting_id uuid;
begin
  perform app.assert_meetings_enabled();
  select meeting_id into v_meeting_id
  from public.meeting_attachments where id = p_attachment_id and deleted_at is null;
  if v_meeting_id is null then
    raise exception 'anexo não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_meeting_staff_admin(v_meeting_id);

  -- SOFT delete (Rule 6: the Storage object is retained).
  update public.meeting_attachments
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_attachment_id;
end;
$$;

ALTER FUNCTION "public"."delete_meeting_attachment"("p_attachment_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."distribute_meeting"("p_meeting_id" "uuid") RETURNS "public"."meetings"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_result public.meetings;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);

  select status into v_status from public.meetings where id = p_meeting_id;
  if v_status <> 'assinada' then
    raise exception 'apenas reuniões assinadas podem ser distribuídas' using errcode = 'HC033';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meetings
  set status = 'distribuida', distributed_at = now(), updated_at = now()
  where id = p_meeting_id returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."distribute_meeting"("p_meeting_id" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."meeting_cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "case_id" "uuid" NOT NULL,
    "agenda_item_id" "uuid",
    "summary" "text",
    "decision" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."meeting_cases" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."link_meeting_case"("p_meeting_id" "uuid", "p_case_id" "uuid", "p_agenda_item_id" "uuid" DEFAULT NULL::"uuid", "p_summary" "text" DEFAULT NULL::"text", "p_decision" "text" DEFAULT NULL::"text") RETURNS "public"."meeting_cases"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_result public.meeting_cases;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);
  -- The same-commission guard (HC032) + agenda-item-belongs check run in the
  -- BEFORE INSERT trigger app.guard_meeting_cases.

  perform set_config('app.in_meeting_rpc', 'on', true);
  insert into public.meeting_cases (meeting_id, case_id, agenda_item_id, summary, decision)
  values (p_meeting_id, p_case_id, p_agenda_item_id,
          nullif(btrim(p_summary), ''), nullif(btrim(p_decision), ''))
  returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."link_meeting_case"("p_meeting_id" "uuid", "p_case_id" "uuid", "p_agenda_item_id" "uuid", "p_summary" "text", "p_decision" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."mark_meeting_held"("p_meeting_id" "uuid") RETURNS "public"."meetings"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_result public.meetings;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);

  select status into v_status from public.meetings where id = p_meeting_id;
  if v_status <> 'agendada' then
    raise exception 'apenas reuniões agendadas podem ser marcadas como realizadas'
      using errcode = 'HC033';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meetings
  set status = 'realizada', updated_at = now()
  where id = p_meeting_id returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."mark_meeting_held"("p_meeting_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."meetings_enabled"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.feature_enabled('meetings');
$$;

ALTER FUNCTION "public"."meetings_enabled"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."my_pending_meeting_signatures"() RETURNS TABLE("meeting_id" "uuid", "meeting_number" integer, "title" "text", "scheduled_start" timestamp with time zone, "attendee_id" "uuid")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;

  return query
  select m.id, m.meeting_number, m.title, m.scheduled_start, a.id
  from public.meeting_attendees a
  join public.meetings m on m.id = a.meeting_id
  where a.user_id = v_uid
    and a.attendance = 'presente'
    and m.status = 'em_assinatura'
    and not exists (
      select 1 from public.meeting_signatures s
      where s.attendee_id = a.id and s.status = 'signed'
    )
  order by m.scheduled_start asc;
end;
$$;

ALTER FUNCTION "public"."my_pending_meeting_signatures"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."remove_meeting_attendee"("p_attendee_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_meeting_id uuid;
begin
  perform app.assert_meetings_enabled();
  select meeting_id into v_meeting_id from public.meeting_attendees where id = p_attendee_id;
  if v_meeting_id is null then
    raise exception 'participante não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_meeting_staff_admin(v_meeting_id);

  perform set_config('app.in_meeting_rpc', 'on', true);
  delete from public.meeting_attendees where id = p_attendee_id;
  perform set_config('app.in_meeting_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."remove_meeting_attendee"("p_attendee_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."rename_meeting_type"("p_type_id" "uuid", "p_name" "text", "p_color_token" "text") RETURNS "public"."commission_meeting_types"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.commission_meeting_types;
begin
  perform app.assert_meetings_enabled();
  select commission_id into v_commission_id
  from public.commission_meeting_types where id = p_type_id;
  if v_commission_id is null then
    raise exception 'tipo de reunião não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'informe o nome do tipo de reunião' using errcode = 'check_violation';
  end if;

  update public.commission_meeting_types
  set name = btrim(p_name),
      color_token = coalesce(p_color_token, color_token),
      updated_at = now()
  where id = p_type_id returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."rename_meeting_type"("p_type_id" "uuid", "p_name" "text", "p_color_token" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reopen_meeting"("p_meeting_id" "uuid") RETURNS "public"."meetings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_status text;
  v_result public.meetings;
begin
  perform app.assert_meetings_enabled();

  select commission_id, status into v_commission_id, v_status
  from public.meetings where id = p_meeting_id;
  if v_commission_id is null then
    raise exception 'reunião % não encontrada', p_meeting_id using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if v_status not in ('em_assinatura', 'assinada') then
    raise exception 'apenas reuniões em assinatura ou assinadas podem ser reabertas'
      using errcode = 'HC033';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);

  update public.meeting_signatures
  set status = 'revoked'
  where meeting_id = p_meeting_id and status = 'signed';

  update public.meetings
  set status = 'realizada', concluded_at = null, concluded_by = null, updated_at = now()
  where id = p_meeting_id
  returning * into v_result;

  perform set_config('app.in_meeting_rpc', 'off', true);
  return v_result;
end;
$$;

ALTER FUNCTION "public"."reopen_meeting"("p_meeting_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."reorder_meeting_agenda_item"("p_agenda_item_id" "uuid", "p_direction" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_meeting_id uuid;
  v_position integer;
  v_neighbor_id uuid;
  v_neighbor_position integer;
begin
  perform app.assert_meetings_enabled();
  if p_direction not in ('up', 'down') then
    raise exception 'direção inválida: %', p_direction using errcode = 'check_violation';
  end if;

  select meeting_id, position into v_meeting_id, v_position
  from public.meeting_agenda_items where id = p_agenda_item_id;
  if v_meeting_id is null then
    raise exception 'item de pauta não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_meeting_staff_admin(v_meeting_id);

  if p_direction = 'up' then
    select id, position into v_neighbor_id, v_neighbor_position
    from public.meeting_agenda_items
    where meeting_id = v_meeting_id and position < v_position
    order by position desc limit 1;
  else
    select id, position into v_neighbor_id, v_neighbor_position
    from public.meeting_agenda_items
    where meeting_id = v_meeting_id and position > v_position
    order by position asc limit 1;
  end if;

  if v_neighbor_id is null then
    return; -- boundary; silent no-op
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meeting_agenda_items
  set position = case id
                   when p_agenda_item_id then v_neighbor_position
                   when v_neighbor_id then v_position
                 end,
      updated_at = now()
  where id in (p_agenda_item_id, v_neighbor_id);
  perform set_config('app.in_meeting_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."reorder_meeting_agenda_item"("p_agenda_item_id" "uuid", "p_direction" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."seed_expected_meeting_attendees"("p_meeting_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
begin
  perform app.assert_meetings_enabled();
  v_commission_id := app.assert_meeting_staff_admin(p_meeting_id);

  perform set_config('app.in_meeting_rpc', 'on', true);
  insert into public.meeting_attendees (meeting_id, user_id, role, attendance)
  select p_meeting_id, cm.user_id, 'membro', 'convocado'
  from public.commission_members cm
  where cm.commission_id = v_commission_id
  on conflict (meeting_id, user_id) where user_id is not null do nothing;
  perform set_config('app.in_meeting_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."seed_expected_meeting_attendees"("p_meeting_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_meeting_quorum_met"("p_meeting_id" "uuid", "p_quorum_met" boolean) RETURNS "public"."meetings"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_result public.meetings;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);

  select status into v_status from public.meetings where id = p_meeting_id;
  if v_status <> 'em_assinatura' then
    raise exception 'o quórum só pode ser ajustado enquanto a ata aguarda assinatura'
      using errcode = 'HC033';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meetings set quorum_met = p_quorum_met, updated_at = now()
  where id = p_meeting_id returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."set_meeting_quorum_met"("p_meeting_id" "uuid", "p_quorum_met" boolean) OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."meeting_signatures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "attendee_id" "uuid" NOT NULL,
    "signer_id" "uuid" NOT NULL,
    "method" "text" DEFAULT 'internal_eauth'::"text" NOT NULL,
    "status" "text" DEFAULT 'signed'::"text" NOT NULL,
    "signed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content_hash" "text",
    "provider_ref" "text",
    "provider_payload" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "meeting_signatures_status_check" CHECK (("status" = ANY (ARRAY['signed'::"text", 'declined'::"text", 'revoked'::"text"])))
);

ALTER TABLE "public"."meeting_signatures" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."sign_meeting"("p_attendee_id" "uuid", "p_method" "text" DEFAULT 'internal_eauth'::"text", "p_note" "text" DEFAULT NULL::"text") RETURNS "public"."meeting_signatures"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_meeting_id uuid;
  v_status text;
  v_minutes text;
  v_hash text;
  v_uid uuid := auth.uid();
  v_required integer;
  v_signed integer;
  v_result public.meeting_signatures;
begin
  perform app.assert_meetings_enabled();

  select a.meeting_id, m.status, m.minutes_md
    into v_meeting_id, v_status, v_minutes
  from public.meeting_attendees a
  join public.meetings m on m.id = a.meeting_id
  where a.id = p_attendee_id;

  if v_meeting_id is null then
    raise exception 'participante não encontrado' using errcode = 'no_data_found';
  end if;
  if v_status <> 'em_assinatura' then
    raise exception 'esta reunião não está aguardando assinatura' using errcode = 'HC033';
  end if;

  v_hash := encode(extensions.digest(coalesce(v_minutes, ''), 'sha256'), 'hex');

  -- ELIGIBILITY: this function is SECURITY DEFINER (owned by a superuser), so the
  -- INSERT below BYPASSES the meeting_signatures_insert RLS policy entirely —
  -- RLS is not enforced for the table owner. We therefore re-assert the same
  -- predicate (app.can_sign_meeting) EXPLICITLY here: only a PRESENT PLATFORM
  -- attendee whose user_id = the caller, on an em_assinatura meeting in the
  -- caller's commission, may sign their OWN row. The sign-own-row RLS policy
  -- remains the authority for any DIRECT (invoker) insert path; this explicit
  -- check is the authority for THIS definer path. (HC036.)
  if not app.can_sign_meeting(p_attendee_id, v_uid) then
    raise exception 'apenas participantes presentes podem assinar a ata' using errcode = 'HC036';
  end if;

  -- Insert the signature. A double-sign collides with the active partial-unique
  -- (meeting_signatures_active_key) -> unique_violation -> HC035. signer_id MUST
  -- be the acting user (asserted by can_sign_meeting above).
  begin
    insert into public.meeting_signatures
      (meeting_id, attendee_id, signer_id, method, status, content_hash, note)
    values
      (v_meeting_id, p_attendee_id, v_uid, coalesce(p_method, 'internal_eauth'),
       'signed', v_hash, nullif(btrim(p_note), ''))
    returning * into v_result;
  exception
    when unique_violation then
      raise exception 'você já assinou esta ata' using errcode = 'HC035';
  end;

  -- Count required (present platform attendees) vs. active signatures.
  select count(*) into v_required
  from public.meeting_attendees
  where meeting_id = v_meeting_id and user_id is not null and attendance = 'presente';

  select count(*) into v_signed
  from public.meeting_signatures
  where meeting_id = v_meeting_id and status = 'signed';

  -- AUTO-FLIP em_assinatura -> assinada when the last required signature lands.
  if v_required > 0 and v_signed >= v_required then
    perform set_config('app.in_meeting_rpc', 'on', true);
    update public.meetings set status = 'assinada', updated_at = now()
    where id = v_meeting_id and status = 'em_assinatura';
    perform set_config('app.in_meeting_rpc', 'off', true);
  end if;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."sign_meeting"("p_attendee_id" "uuid", "p_method" "text", "p_note" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."unlink_meeting_case"("p_case_link_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_meeting_id uuid;
begin
  perform app.assert_meetings_enabled();
  select meeting_id into v_meeting_id from public.meeting_cases where id = p_case_link_id;
  if v_meeting_id is null then
    raise exception 'vínculo de caso não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_meeting_staff_admin(v_meeting_id);

  perform set_config('app.in_meeting_rpc', 'on', true);
  delete from public.meeting_cases where id = p_case_link_id;
  perform set_config('app.in_meeting_rpc', 'off', true);
end;
$$;

ALTER FUNCTION "public"."unlink_meeting_case"("p_case_link_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_meeting"("p_meeting_id" "uuid", "p_title" "text", "p_scheduled_start" timestamp with time zone, "p_modality" "text", "p_meeting_type_id" "uuid" DEFAULT NULL::"uuid", "p_scheduled_end" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_location_text" "text" DEFAULT NULL::"text", "p_meeting_url" "text" DEFAULT NULL::"text", "p_minutes_md" "text" DEFAULT NULL::"text") RETURNS "public"."meetings"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_status text;
  v_result public.meetings;
begin
  perform app.assert_meetings_enabled();
  v_commission_id := app.assert_meeting_staff_admin(p_meeting_id);

  select status into v_status from public.meetings where id = p_meeting_id;
  if v_status not in ('agendada', 'realizada') then
    raise exception 'a reunião não pode ser editada neste estado' using errcode = 'HC033';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe um título para a reunião' using errcode = 'check_violation';
  end if;
  if p_meeting_type_id is not null and not exists (
    select 1 from public.commission_meeting_types
    where id = p_meeting_type_id and commission_id = v_commission_id
  ) then
    raise exception 'tipo de reunião inválido' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meetings
  set title = btrim(p_title),
      meeting_type_id = p_meeting_type_id,
      scheduled_start = p_scheduled_start,
      scheduled_end = p_scheduled_end,
      modality = coalesce(p_modality, modality),
      location_text = nullif(btrim(p_location_text), ''),
      meeting_url = nullif(btrim(p_meeting_url), ''),
      minutes_md = p_minutes_md,
      updated_at = now()
  where id = p_meeting_id
  returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_meeting"("p_meeting_id" "uuid", "p_title" "text", "p_scheduled_start" timestamp with time zone, "p_modality" "text", "p_meeting_type_id" "uuid", "p_scheduled_end" timestamp with time zone, "p_location_text" "text", "p_meeting_url" "text", "p_minutes_md" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_meeting_action_item"("p_action_item_id" "uuid", "p_title" "text", "p_description" "text" DEFAULT NULL::"text", "p_assigned_to" "uuid" DEFAULT NULL::"uuid", "p_due_date" "date" DEFAULT NULL::"date") RETURNS "public"."meeting_action_items"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_commission_id uuid;
  v_result public.meeting_action_items;
begin
  perform app.assert_meetings_enabled();
  select commission_id into v_commission_id
  from public.meeting_action_items where id = p_action_item_id;
  if v_commission_id is null then
    raise exception 'item de ação não encontrado' using errcode = 'no_data_found';
  end if;
  if not (app.is_staff_admin_of(v_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe o título do item' using errcode = 'check_violation';
  end if;
  if p_assigned_to is not null and not app.is_member_of_for(v_commission_id, p_assigned_to) then
    raise exception 'o responsável deve ser membro da comissão' using errcode = 'HC021';
  end if;

  update public.meeting_action_items
  set title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      assigned_to = p_assigned_to,
      due_date = p_due_date,
      updated_at = now()
  where id = p_action_item_id returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_meeting_action_item"("p_action_item_id" "uuid", "p_title" "text", "p_description" "text", "p_assigned_to" "uuid", "p_due_date" "date") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_meeting_agenda_item"("p_agenda_item_id" "uuid", "p_title" "text", "p_description" "text" DEFAULT NULL::"text", "p_discussion_notes" "text" DEFAULT NULL::"text", "p_resolution" "text" DEFAULT NULL::"text") RETURNS "public"."meeting_agenda_items"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_meeting_id uuid;
  v_result public.meeting_agenda_items;
begin
  perform app.assert_meetings_enabled();
  select meeting_id into v_meeting_id from public.meeting_agenda_items where id = p_agenda_item_id;
  if v_meeting_id is null then
    raise exception 'item de pauta não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_meeting_staff_admin(v_meeting_id);
  if nullif(btrim(p_title), '') is null then
    raise exception 'informe um título para o item de pauta' using errcode = 'check_violation';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meeting_agenda_items
  set title = btrim(p_title),
      description = nullif(btrim(p_description), ''),
      discussion_notes = nullif(btrim(p_discussion_notes), ''),
      resolution = nullif(btrim(p_resolution), ''),
      updated_at = now()
  where id = p_agenda_item_id returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_meeting_agenda_item"("p_agenda_item_id" "uuid", "p_title" "text", "p_description" "text", "p_discussion_notes" "text", "p_resolution" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_meeting_attendee"("p_attendee_id" "uuid", "p_role" "text", "p_attendance" "text", "p_note" "text" DEFAULT NULL::"text", "p_external_name" "text" DEFAULT NULL::"text", "p_external_org" "text" DEFAULT NULL::"text") RETURNS "public"."meeting_attendees"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_meeting_id uuid;
  v_user_id uuid;
  v_result public.meeting_attendees;
begin
  perform app.assert_meetings_enabled();
  select meeting_id, user_id into v_meeting_id, v_user_id
  from public.meeting_attendees where id = p_attendee_id;
  if v_meeting_id is null then
    raise exception 'participante não encontrado' using errcode = 'no_data_found';
  end if;
  perform app.assert_meeting_staff_admin(v_meeting_id);

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meeting_attendees
  set role = coalesce(p_role, role),
      attendance = coalesce(p_attendance, attendance),
      note = nullif(btrim(p_note), ''),
      -- Guest name/org are editable only for external attendees (user_id null).
      external_name = case when v_user_id is null
                           then coalesce(nullif(btrim(p_external_name), ''), external_name)
                           else external_name end,
      external_org = case when v_user_id is null
                          then nullif(btrim(p_external_org), '')
                          else external_org end,
      updated_at = now()
  where id = p_attendee_id returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_meeting_attendee"("p_attendee_id" "uuid", "p_role" "text", "p_attendance" "text", "p_note" "text", "p_external_name" "text", "p_external_org" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_meeting_minutes"("p_meeting_id" "uuid", "p_minutes_md" "text") RETURNS "public"."meetings"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_result public.meetings;
begin
  perform app.assert_meetings_enabled();
  perform app.assert_meeting_staff_admin(p_meeting_id);

  select status into v_status from public.meetings where id = p_meeting_id;
  if v_status not in ('agendada', 'realizada') then
    raise exception 'a ata não pode ser editada neste estado' using errcode = 'HC033';
  end if;

  perform set_config('app.in_meeting_rpc', 'on', true);
  update public.meetings set minutes_md = p_minutes_md, updated_at = now()
  where id = p_meeting_id returning * into v_result;
  perform set_config('app.in_meeting_rpc', 'off', true);

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_meeting_minutes"("p_meeting_id" "uuid", "p_minutes_md" "text") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."commission_meeting_settings" (
    "commission_id" "uuid" NOT NULL,
    "quorum_rule_type" "text" DEFAULT 'maioria_simples'::"text" NOT NULL,
    "quorum_value" numeric,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commission_meeting_settings_quorum_rule_type_check" CHECK (("quorum_rule_type" = ANY (ARRAY['maioria_simples'::"text", 'fixed_count'::"text", 'percentage'::"text"]))),
    CONSTRAINT "commission_meeting_settings_value_shape" CHECK (((("quorum_rule_type" = 'maioria_simples'::"text") AND ("quorum_value" IS NULL)) OR (("quorum_rule_type" = 'fixed_count'::"text") AND ("quorum_value" IS NOT NULL) AND ("quorum_value" >= (1)::numeric) AND ("quorum_value" = "trunc"("quorum_value"))) OR (("quorum_rule_type" = 'percentage'::"text") AND ("quorum_value" IS NOT NULL) AND ("quorum_value" > (0)::numeric) AND ("quorum_value" <= (100)::numeric))))
);

ALTER TABLE "public"."commission_meeting_settings" OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_meeting_settings"("p_commission_id" "uuid", "p_quorum_rule_type" "text", "p_quorum_value" numeric DEFAULT NULL::numeric) RETURNS "public"."commission_meeting_settings"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_result public.commission_meeting_settings;
begin
  perform app.assert_meetings_enabled();
  if not (app.is_staff_admin_of(p_commission_id) or app.is_admin()) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_quorum_rule_type not in ('maioria_simples', 'fixed_count', 'percentage') then
    raise exception 'regra de quórum inválida' using errcode = 'check_violation';
  end if;

  -- The value-shape CHECK (…090000) rejects a bad rule/value combination with
  -- check_violation; normalize maioria_simples's value to null here for clarity.
  insert into public.commission_meeting_settings (commission_id, quorum_rule_type, quorum_value, updated_at)
  values (
    p_commission_id, p_quorum_rule_type,
    case when p_quorum_rule_type = 'maioria_simples' then null else p_quorum_value end,
    now()
  )
  on conflict (commission_id) do update
  set quorum_rule_type = excluded.quorum_rule_type,
      quorum_value = excluded.quorum_value,
      updated_at = now()
  returning * into v_result;

  return v_result;
end;
$$;

ALTER FUNCTION "public"."update_meeting_settings"("p_commission_id" "uuid", "p_quorum_rule_type" "text", "p_quorum_value" numeric) OWNER TO "postgres";

ALTER TABLE ONLY "public"."commission_meeting_settings"
    ADD CONSTRAINT "commission_meeting_settings_pkey" PRIMARY KEY ("commission_id");

ALTER TABLE ONLY "public"."commission_meeting_types"
    ADD CONSTRAINT "commission_meeting_types_commission_name_key" UNIQUE ("commission_id", "name");

ALTER TABLE ONLY "public"."commission_meeting_types"
    ADD CONSTRAINT "commission_meeting_types_commission_position_key" UNIQUE ("commission_id", "position") DEFERRABLE;

ALTER TABLE ONLY "public"."commission_meeting_types"
    ADD CONSTRAINT "commission_meeting_types_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."meeting_action_items"
    ADD CONSTRAINT "meeting_action_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."meeting_agenda_items"
    ADD CONSTRAINT "meeting_agenda_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."meeting_agenda_items"
    ADD CONSTRAINT "meeting_agenda_items_position_key" UNIQUE ("meeting_id", "position") DEFERRABLE;

ALTER TABLE ONLY "public"."meeting_attachments"
    ADD CONSTRAINT "meeting_attachments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."meeting_attachments"
    ADD CONSTRAINT "meeting_attachments_storage_path_key" UNIQUE ("storage_path");

ALTER TABLE ONLY "public"."meeting_attendees"
    ADD CONSTRAINT "meeting_attendees_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."meeting_cases"
    ADD CONSTRAINT "meeting_cases_meeting_case_key" UNIQUE ("meeting_id", "case_id");

ALTER TABLE ONLY "public"."meeting_cases"
    ADD CONSTRAINT "meeting_cases_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."meeting_signatures"
    ADD CONSTRAINT "meeting_signatures_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_commission_number_key" UNIQUE ("commission_id", "meeting_number");

ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."commission_meeting_settings"
    ADD CONSTRAINT "commission_meeting_settings_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."commission_meeting_types"
    ADD CONSTRAINT "commission_meeting_types_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."meeting_action_items"
    ADD CONSTRAINT "meeting_action_items_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."meeting_action_items"
    ADD CONSTRAINT "meeting_action_items_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."meeting_action_items"
    ADD CONSTRAINT "meeting_action_items_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."meeting_action_items"
    ADD CONSTRAINT "meeting_action_items_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."meeting_action_items"
    ADD CONSTRAINT "meeting_action_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."meeting_action_items"
    ADD CONSTRAINT "meeting_action_items_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."meeting_action_items"
    ADD CONSTRAINT "meeting_action_items_source_agenda_item_id_fkey" FOREIGN KEY ("source_agenda_item_id") REFERENCES "public"."meeting_agenda_items"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."meeting_agenda_items"
    ADD CONSTRAINT "meeting_agenda_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."meeting_agenda_items"
    ADD CONSTRAINT "meeting_agenda_items_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."meeting_attachments"
    ADD CONSTRAINT "meeting_attachments_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."meeting_attachments"
    ADD CONSTRAINT "meeting_attachments_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."meeting_attachments"
    ADD CONSTRAINT "meeting_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."meeting_attendees"
    ADD CONSTRAINT "meeting_attendees_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."meeting_attendees"
    ADD CONSTRAINT "meeting_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."meeting_cases"
    ADD CONSTRAINT "meeting_cases_agenda_item_id_fkey" FOREIGN KEY ("agenda_item_id") REFERENCES "public"."meeting_agenda_items"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."meeting_cases"
    ADD CONSTRAINT "meeting_cases_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."meeting_cases"
    ADD CONSTRAINT "meeting_cases_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."meeting_signatures"
    ADD CONSTRAINT "meeting_signatures_attendee_id_fkey" FOREIGN KEY ("attendee_id") REFERENCES "public"."meeting_attendees"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."meeting_signatures"
    ADD CONSTRAINT "meeting_signatures_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."meeting_signatures"
    ADD CONSTRAINT "meeting_signatures_signer_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_concluded_by_fkey" FOREIGN KEY ("concluded_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_meeting_type_id_fkey" FOREIGN KEY ("meeting_type_id") REFERENCES "public"."commission_meeting_types"("id") ON DELETE SET NULL;

CREATE INDEX "commission_meeting_types_commission_idx" ON "public"."commission_meeting_types" USING "btree" ("commission_id");

CREATE INDEX "meeting_action_items_assigned_to_idx" ON "public"."meeting_action_items" USING "btree" ("assigned_to");

CREATE INDEX "meeting_action_items_case_idx" ON "public"."meeting_action_items" USING "btree" ("case_id");

CREATE INDEX "meeting_action_items_commission_idx" ON "public"."meeting_action_items" USING "btree" ("commission_id");

CREATE INDEX "meeting_action_items_meeting_idx" ON "public"."meeting_action_items" USING "btree" ("meeting_id");

CREATE INDEX "meeting_agenda_items_meeting_idx" ON "public"."meeting_agenda_items" USING "btree" ("meeting_id");

CREATE INDEX "meeting_attachments_meeting_idx" ON "public"."meeting_attachments" USING "btree" ("meeting_id");

CREATE INDEX "meeting_attachments_meeting_live_idx" ON "public"."meeting_attachments" USING "btree" ("meeting_id") WHERE ("deleted_at" IS NULL);

CREATE INDEX "meeting_attendees_meeting_idx" ON "public"."meeting_attendees" USING "btree" ("meeting_id");

CREATE UNIQUE INDEX "meeting_attendees_meeting_user_key" ON "public"."meeting_attendees" USING "btree" ("meeting_id", "user_id") WHERE ("user_id" IS NOT NULL);

CREATE INDEX "meeting_attendees_user_idx" ON "public"."meeting_attendees" USING "btree" ("user_id");

CREATE INDEX "meeting_cases_agenda_item_idx" ON "public"."meeting_cases" USING "btree" ("agenda_item_id");

CREATE INDEX "meeting_cases_case_idx" ON "public"."meeting_cases" USING "btree" ("case_id");

CREATE INDEX "meeting_cases_meeting_idx" ON "public"."meeting_cases" USING "btree" ("meeting_id");

CREATE UNIQUE INDEX "meeting_signatures_active_key" ON "public"."meeting_signatures" USING "btree" ("meeting_id", "attendee_id") WHERE ("status" = 'signed'::"text");

CREATE INDEX "meeting_signatures_attendee_idx" ON "public"."meeting_signatures" USING "btree" ("attendee_id");

CREATE INDEX "meeting_signatures_meeting_idx" ON "public"."meeting_signatures" USING "btree" ("meeting_id");

CREATE INDEX "meeting_signatures_signer_idx" ON "public"."meeting_signatures" USING "btree" ("signer_id");

CREATE INDEX "meetings_commission_idx" ON "public"."meetings" USING "btree" ("commission_id");

CREATE INDEX "meetings_status_idx" ON "public"."meetings" USING "btree" ("commission_id", "status");

CREATE INDEX "meetings_type_idx" ON "public"."meetings" USING "btree" ("meeting_type_id");

CREATE OR REPLACE TRIGGER "guard_meeting_action_item_trg" BEFORE INSERT OR UPDATE ON "public"."meeting_action_items" FOR EACH ROW EXECUTE FUNCTION "app"."guard_meeting_action_item"();

CREATE OR REPLACE TRIGGER "guard_meeting_cases_trg" BEFORE INSERT OR UPDATE ON "public"."meeting_cases" FOR EACH ROW EXECUTE FUNCTION "app"."guard_meeting_cases"();

CREATE OR REPLACE TRIGGER "guard_meeting_child_lock_agenda_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."meeting_agenda_items" FOR EACH ROW EXECUTE FUNCTION "app"."guard_meeting_child_lock"();

CREATE OR REPLACE TRIGGER "guard_meeting_child_lock_attendees_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."meeting_attendees" FOR EACH ROW EXECUTE FUNCTION "app"."guard_meeting_child_lock"();

CREATE OR REPLACE TRIGGER "guard_meeting_child_lock_cases_trg" BEFORE INSERT OR DELETE OR UPDATE ON "public"."meeting_cases" FOR EACH ROW EXECUTE FUNCTION "app"."guard_meeting_child_lock"();

CREATE OR REPLACE TRIGGER "guard_meeting_status_trg" BEFORE DELETE OR UPDATE ON "public"."meetings" FOR EACH ROW EXECUTE FUNCTION "app"."guard_meeting_status"();

CREATE OR REPLACE TRIGGER "mint_meeting_number_trg" BEFORE INSERT ON "public"."meetings" FOR EACH ROW EXECUTE FUNCTION "app"."mint_meeting_number"();

CREATE OR REPLACE TRIGGER "seed_meetings_on_commission_insert_trg" AFTER INSERT ON "public"."commissions" FOR EACH ROW EXECUTE FUNCTION "app"."seed_meetings_on_commission_insert"();

ALTER TABLE "public"."commission_meeting_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."commission_meeting_types" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."meeting_action_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."meeting_agenda_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."meeting_attachments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."meeting_attendees" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."meeting_cases" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."meeting_signatures" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."meetings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meeting_action_items_select" ON "public"."meeting_action_items" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "meeting_action_items_staff_admin_write" ON "public"."meeting_action_items" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "meeting_agenda_items_select" ON "public"."meeting_agenda_items" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_admin"()));

CREATE POLICY "meeting_agenda_items_staff_admin_write" ON "public"."meeting_agenda_items" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_admin"()));

CREATE POLICY "meeting_attachments_select" ON "public"."meeting_attachments" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_admin"()));

CREATE POLICY "meeting_attachments_staff_admin_write" ON "public"."meeting_attachments" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_admin"()));

CREATE POLICY "meeting_attendees_select" ON "public"."meeting_attendees" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_admin"()));

CREATE POLICY "meeting_attendees_staff_admin_write" ON "public"."meeting_attendees" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_admin"()));

CREATE POLICY "meeting_cases_select" ON "public"."meeting_cases" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_admin"()));

CREATE POLICY "meeting_cases_staff_admin_write" ON "public"."meeting_cases" TO "authenticated" USING (("app"."is_staff_admin_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_admin"()));

CREATE POLICY "meeting_settings_select" ON "public"."commission_meeting_settings" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "meeting_settings_staff_admin_write" ON "public"."commission_meeting_settings" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "meeting_signatures_insert" ON "public"."meeting_signatures" FOR INSERT TO "authenticated" WITH CHECK ((("signer_id" = "auth"."uid"()) AND "app"."can_sign_meeting"("attendee_id", "auth"."uid"())));

CREATE POLICY "meeting_signatures_select" ON "public"."meeting_signatures" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("app"."commission_of_meeting"("meeting_id")) OR "app"."is_admin"()));

CREATE POLICY "meeting_types_select" ON "public"."commission_meeting_types" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "meeting_types_staff_admin_write" ON "public"."commission_meeting_types" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "meetings_select" ON "public"."meetings" FOR SELECT TO "authenticated" USING (("app"."is_member_of"("commission_id") OR "app"."is_admin"()));

CREATE POLICY "meetings_staff_admin_write" ON "public"."meetings" TO "authenticated" USING (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"())) WITH CHECK (("app"."is_staff_admin_of"("commission_id") OR "app"."is_admin"()));

GRANT ALL ON TABLE "public"."meeting_action_items" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_action_items" TO "service_role";

REVOKE ALL ON FUNCTION "app"."advance_meeting_action_item_core"("p_action_item_id" "uuid", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."advance_meeting_action_item_core"("p_action_item_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "app"."advance_meeting_action_item_core"("p_action_item_id" "uuid", "p_status" "text") TO "service_role";

REVOKE ALL ON FUNCTION "app"."assert_meeting_staff_admin"("p_meeting_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."assert_meeting_staff_admin"("p_meeting_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."assert_meeting_staff_admin"("p_meeting_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."assert_meetings_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."assert_meetings_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "app"."assert_meetings_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "app"."can_sign_meeting"("p_attendee_id" "uuid", "p_signer" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."can_sign_meeting"("p_attendee_id" "uuid", "p_signer" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."can_sign_meeting"("p_attendee_id" "uuid", "p_signer" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."commission_of_meeting"("p_meeting_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."commission_of_meeting"("p_meeting_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "app"."commission_of_meeting"("p_meeting_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "app"."seed_default_meeting_types"("p_commission_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."seed_default_meeting_types"("p_commission_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."meeting_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_attachments" TO "service_role";

REVOKE ALL ON FUNCTION "public"."add_meeting_attachment"("p_meeting_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text", "p_mime_type" "text", "p_size_bytes" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_meeting_attachment"("p_meeting_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text", "p_mime_type" "text", "p_size_bytes" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_meeting_attachment"("p_meeting_id" "uuid", "p_kind" "text", "p_title" "text", "p_storage_path" "text", "p_mime_type" "text", "p_size_bytes" bigint) TO "service_role";

GRANT ALL ON TABLE "public"."meeting_attendees" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_attendees" TO "service_role";

REVOKE ALL ON FUNCTION "public"."add_meeting_attendee"("p_meeting_id" "uuid", "p_user_id" "uuid", "p_external_name" "text", "p_external_org" "text", "p_role" "text", "p_attendance" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_meeting_attendee"("p_meeting_id" "uuid", "p_user_id" "uuid", "p_external_name" "text", "p_external_org" "text", "p_role" "text", "p_attendance" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_meeting_attendee"("p_meeting_id" "uuid", "p_user_id" "uuid", "p_external_name" "text", "p_external_org" "text", "p_role" "text", "p_attendance" "text", "p_note" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."advance_meeting_action_item"("p_action_item_id" "uuid", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."advance_meeting_action_item"("p_action_item_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."advance_meeting_action_item"("p_action_item_id" "uuid", "p_status" "text") TO "service_role";

GRANT ALL ON TABLE "public"."commission_meeting_types" TO "authenticated";
GRANT ALL ON TABLE "public"."commission_meeting_types" TO "service_role";

REVOKE ALL ON FUNCTION "public"."archive_meeting_type"("p_type_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_meeting_type"("p_type_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_meeting_type"("p_type_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."meetings" TO "service_role";

REVOKE ALL ON FUNCTION "public"."cancel_meeting"("p_meeting_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_meeting"("p_meeting_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_meeting"("p_meeting_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."complete_meeting_action_item"("p_action_item_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."complete_meeting_action_item"("p_action_item_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_meeting_action_item"("p_action_item_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."conclude_meeting"("p_meeting_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."conclude_meeting"("p_meeting_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."conclude_meeting"("p_meeting_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_meeting"("p_commission_id" "uuid", "p_title" "text", "p_meeting_type_id" "uuid", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone, "p_modality" "text", "p_location_text" "text", "p_meeting_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_meeting"("p_commission_id" "uuid", "p_title" "text", "p_meeting_type_id" "uuid", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone, "p_modality" "text", "p_location_text" "text", "p_meeting_url" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_meeting"("p_commission_id" "uuid", "p_title" "text", "p_meeting_type_id" "uuid", "p_scheduled_start" timestamp with time zone, "p_scheduled_end" timestamp with time zone, "p_modality" "text", "p_location_text" "text", "p_meeting_url" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_meeting_action_item"("p_meeting_id" "uuid", "p_title" "text", "p_description" "text", "p_assigned_to" "uuid", "p_due_date" "date", "p_source_agenda_item_id" "uuid", "p_case_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_meeting_action_item"("p_meeting_id" "uuid", "p_title" "text", "p_description" "text", "p_assigned_to" "uuid", "p_due_date" "date", "p_source_agenda_item_id" "uuid", "p_case_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_meeting_action_item"("p_meeting_id" "uuid", "p_title" "text", "p_description" "text", "p_assigned_to" "uuid", "p_due_date" "date", "p_source_agenda_item_id" "uuid", "p_case_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."meeting_agenda_items" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_agenda_items" TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_meeting_agenda_item"("p_meeting_id" "uuid", "p_title" "text", "p_description" "text", "p_discussion_notes" "text", "p_resolution" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_meeting_agenda_item"("p_meeting_id" "uuid", "p_title" "text", "p_description" "text", "p_discussion_notes" "text", "p_resolution" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_meeting_agenda_item"("p_meeting_id" "uuid", "p_title" "text", "p_description" "text", "p_discussion_notes" "text", "p_resolution" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_meeting_type"("p_commission_id" "uuid", "p_name" "text", "p_color_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_meeting_type"("p_commission_id" "uuid", "p_name" "text", "p_color_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_meeting_type"("p_commission_id" "uuid", "p_name" "text", "p_color_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."delete_meeting_agenda_item"("p_agenda_item_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_meeting_agenda_item"("p_agenda_item_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_meeting_agenda_item"("p_agenda_item_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."delete_meeting_attachment"("p_attachment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_meeting_attachment"("p_attachment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_meeting_attachment"("p_attachment_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."distribute_meeting"("p_meeting_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."distribute_meeting"("p_meeting_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."distribute_meeting"("p_meeting_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."meeting_cases" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_cases" TO "service_role";

REVOKE ALL ON FUNCTION "public"."link_meeting_case"("p_meeting_id" "uuid", "p_case_id" "uuid", "p_agenda_item_id" "uuid", "p_summary" "text", "p_decision" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."link_meeting_case"("p_meeting_id" "uuid", "p_case_id" "uuid", "p_agenda_item_id" "uuid", "p_summary" "text", "p_decision" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_meeting_case"("p_meeting_id" "uuid", "p_case_id" "uuid", "p_agenda_item_id" "uuid", "p_summary" "text", "p_decision" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."mark_meeting_held"("p_meeting_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_meeting_held"("p_meeting_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_meeting_held"("p_meeting_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."meetings_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."meetings_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."meetings_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."my_pending_meeting_signatures"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."my_pending_meeting_signatures"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_pending_meeting_signatures"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."remove_meeting_attendee"("p_attendee_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_meeting_attendee"("p_attendee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_meeting_attendee"("p_attendee_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."rename_meeting_type"("p_type_id" "uuid", "p_name" "text", "p_color_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rename_meeting_type"("p_type_id" "uuid", "p_name" "text", "p_color_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rename_meeting_type"("p_type_id" "uuid", "p_name" "text", "p_color_token" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."reopen_meeting"("p_meeting_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reopen_meeting"("p_meeting_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reopen_meeting"("p_meeting_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."reorder_meeting_agenda_item"("p_agenda_item_id" "uuid", "p_direction" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_meeting_agenda_item"("p_agenda_item_id" "uuid", "p_direction" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_meeting_agenda_item"("p_agenda_item_id" "uuid", "p_direction" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."seed_expected_meeting_attendees"("p_meeting_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."seed_expected_meeting_attendees"("p_meeting_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_expected_meeting_attendees"("p_meeting_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_meeting_quorum_met"("p_meeting_id" "uuid", "p_quorum_met" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_meeting_quorum_met"("p_meeting_id" "uuid", "p_quorum_met" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_meeting_quorum_met"("p_meeting_id" "uuid", "p_quorum_met" boolean) TO "service_role";

GRANT ALL ON TABLE "public"."meeting_signatures" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_signatures" TO "service_role";

REVOKE ALL ON FUNCTION "public"."sign_meeting"("p_attendee_id" "uuid", "p_method" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sign_meeting"("p_attendee_id" "uuid", "p_method" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sign_meeting"("p_attendee_id" "uuid", "p_method" "text", "p_note" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."unlink_meeting_case"("p_case_link_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."unlink_meeting_case"("p_case_link_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unlink_meeting_case"("p_case_link_id" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_meeting"("p_meeting_id" "uuid", "p_title" "text", "p_scheduled_start" timestamp with time zone, "p_modality" "text", "p_meeting_type_id" "uuid", "p_scheduled_end" timestamp with time zone, "p_location_text" "text", "p_meeting_url" "text", "p_minutes_md" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_meeting"("p_meeting_id" "uuid", "p_title" "text", "p_scheduled_start" timestamp with time zone, "p_modality" "text", "p_meeting_type_id" "uuid", "p_scheduled_end" timestamp with time zone, "p_location_text" "text", "p_meeting_url" "text", "p_minutes_md" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_meeting"("p_meeting_id" "uuid", "p_title" "text", "p_scheduled_start" timestamp with time zone, "p_modality" "text", "p_meeting_type_id" "uuid", "p_scheduled_end" timestamp with time zone, "p_location_text" "text", "p_meeting_url" "text", "p_minutes_md" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_meeting_action_item"("p_action_item_id" "uuid", "p_title" "text", "p_description" "text", "p_assigned_to" "uuid", "p_due_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_meeting_action_item"("p_action_item_id" "uuid", "p_title" "text", "p_description" "text", "p_assigned_to" "uuid", "p_due_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_meeting_action_item"("p_action_item_id" "uuid", "p_title" "text", "p_description" "text", "p_assigned_to" "uuid", "p_due_date" "date") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_meeting_agenda_item"("p_agenda_item_id" "uuid", "p_title" "text", "p_description" "text", "p_discussion_notes" "text", "p_resolution" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_meeting_agenda_item"("p_agenda_item_id" "uuid", "p_title" "text", "p_description" "text", "p_discussion_notes" "text", "p_resolution" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_meeting_agenda_item"("p_agenda_item_id" "uuid", "p_title" "text", "p_description" "text", "p_discussion_notes" "text", "p_resolution" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_meeting_attendee"("p_attendee_id" "uuid", "p_role" "text", "p_attendance" "text", "p_note" "text", "p_external_name" "text", "p_external_org" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_meeting_attendee"("p_attendee_id" "uuid", "p_role" "text", "p_attendance" "text", "p_note" "text", "p_external_name" "text", "p_external_org" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_meeting_attendee"("p_attendee_id" "uuid", "p_role" "text", "p_attendance" "text", "p_note" "text", "p_external_name" "text", "p_external_org" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_meeting_minutes"("p_meeting_id" "uuid", "p_minutes_md" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_meeting_minutes"("p_meeting_id" "uuid", "p_minutes_md" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_meeting_minutes"("p_meeting_id" "uuid", "p_minutes_md" "text") TO "service_role";

GRANT ALL ON TABLE "public"."commission_meeting_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."commission_meeting_settings" TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_meeting_settings"("p_commission_id" "uuid", "p_quorum_rule_type" "text", "p_quorum_value" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_meeting_settings"("p_commission_id" "uuid", "p_quorum_rule_type" "text", "p_quorum_value" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_meeting_settings"("p_commission_id" "uuid", "p_quorum_rule_type" "text", "p_quorum_value" numeric) TO "service_role";
