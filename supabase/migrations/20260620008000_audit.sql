-- ----------------------------------------------------------------------------
-- Consolidated baseline — audit
-- ----------------------------------------------------------------------------
SET check_function_bodies = false;
SET client_min_messages = warning;

CREATE OR REPLACE FUNCTION "app"."assert_audit_enabled"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if not app.feature_enabled('audit_trail') then
    raise exception 'a trilha de auditoria não está disponível'
      using errcode = 'check_violation';
  end if;
end;
$$;

ALTER FUNCTION "app"."assert_audit_enabled"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."audit_canonical"("p_seq" bigint, "p_occurred_at" timestamp with time zone, "p_actor_id" "uuid", "p_actor_is_admin" boolean, "p_commission_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_summary" "text", "p_metadata" "jsonb") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'app', 'pg_catalog'
    AS $$
  select concat_ws(
    chr(30),  -- U+001E record separator
    p_seq::text,
    to_char(p_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    coalesce(p_actor_id::text, ''),
    case when p_actor_is_admin then 'true' else 'false' end,
    coalesce(p_commission_id::text, ''),
    p_action,
    p_entity_type,
    p_entity_id::text,
    p_summary,
    app.jsonb_canonical(p_metadata)
  );
$$;

ALTER FUNCTION "app"."audit_canonical"("p_seq" bigint, "p_occurred_at" timestamp with time zone, "p_actor_id" "uuid", "p_actor_is_admin" boolean, "p_commission_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_summary" "text", "p_metadata" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."audit_diff"("p_old" "jsonb", "p_new" "jsonb", "p_cols" "text"[]) RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'app', 'pg_catalog'
    AS $$
  select coalesce(jsonb_object_agg(col, jsonb_build_object('old', ov, 'new', nv)), '{}'::jsonb)
  from (
    select c as col,
           case when p_old is null then null else p_old -> c end as ov,
           case when p_new is null then null else p_new -> c end as nv
    from unnest(p_cols) as c
  ) d
  where ov is distinct from nv;
$$;

ALTER FUNCTION "app"."audit_diff"("p_old" "jsonb", "p_new" "jsonb", "p_cols" "text"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."audit_write"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_actor uuid := auth.uid();
  v_actor_is_admin boolean := false;
  v_seq bigint;
  v_prev_hash text;
  v_occurred timestamptz := now();
  v_lock_key text;
  v_row_hash text;
begin
  -- Dark until the feature is ON (the chain starts cleanly at the in-phase flip).
  if not app.feature_enabled('audit_trail') then
    return;
  end if;

  if v_actor is not null then
    v_actor_is_admin := coalesce(app.is_admin(), false);
  end if;

  -- Serialize this CHAIN (per-commission, or the global chain).
  v_lock_key := 'audit:' || coalesce(p_commission::text, '__global__');
  perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  -- The chain tail: highest seq + its row_hash. `is not distinct from` matches the
  -- NULL (global) chain correctly.
  select seq, row_hash into v_seq, v_prev_hash
  from public.audit_log
  where commission_id is not distinct from p_commission
  order by seq desc
  limit 1;

  v_seq := coalesce(v_seq, 0) + 1;  -- v_prev_hash stays NULL for the first row.

  v_row_hash := encode(
    extensions.digest(
      coalesce(v_prev_hash, '') || app.audit_canonical(
        v_seq, v_occurred, v_actor, v_actor_is_admin, p_commission,
        p_action, p_entity_type, p_entity_id, p_summary,
        coalesce(p_metadata, '{}'::jsonb)
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.audit_log (
    occurred_at, commission_id, actor_id, actor_is_admin,
    action, entity_type, entity_id, summary, metadata,
    seq, prev_hash, row_hash
  ) values (
    v_occurred, p_commission, v_actor, v_actor_is_admin,
    p_action, p_entity_type, p_entity_id, p_summary,
    coalesce(p_metadata, '{}'::jsonb),
    v_seq, v_prev_hash, v_row_hash
  );
end;
$$;

ALTER FUNCTION "app"."audit_write"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."guard_audit_immutable"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'app', 'pg_catalog'
    AS $$
begin
  raise exception 'os registros de auditoria são imutáveis (somente inserção)'
    using errcode = 'HC042';
end;
$$;

ALTER FUNCTION "app"."guard_audit_immutable"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."jsonb_canonical"("p_value" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'app', 'pg_catalog'
    AS $$
declare
  v_type text := jsonb_typeof(p_value);
begin
  if p_value is null or v_type = 'null' then
    return 'null';
  elsif v_type = 'object' then
    return '{' || coalesce((
      select string_agg(to_json(kv.key)::text || ':' || app.jsonb_canonical(kv.value), ','
                        order by kv.key)
      from jsonb_each(p_value) as kv(key, value)
    ), '') || '}';
  elsif v_type = 'array' then
    return '[' || coalesce((
      select string_agg(app.jsonb_canonical(elem), ',' order by ord)
      from jsonb_array_elements(p_value) with ordinality as a(elem, ord)
    ), '') || ']';
  else
    -- string / number / boolean — jsonb's text form is already canonical.
    return p_value::text;
  end if;
end;
$$;

ALTER FUNCTION "app"."jsonb_canonical"("p_value" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_case_access"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_cols constant text[] := array['level'];
  v_case uuid;
  v_user uuid;
  v_action text;
  v_meta jsonb;
begin
  if tg_op = 'DELETE' then
    v_case := old.case_id; v_user := old.user_id; v_action := 'case_access.revoked';
    v_meta := app.audit_diff(to_jsonb(old), null, v_cols);
  elsif tg_op = 'INSERT' then
    v_case := new.case_id; v_user := new.user_id; v_action := 'case_access.granted';
    v_meta := app.audit_diff(null, to_jsonb(new), v_cols);
  else
    v_case := new.case_id; v_user := new.user_id; v_action := 'case_access.updated';
    v_meta := app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols);
  end if;

  perform app.audit_write(v_action, 'case_access', v_case,
    app.commission_of_case(v_case),
    'Acesso ao caso ' || tg_op || ' (membro ' || coalesce(v_user::text, '?') || ')',
    v_meta);
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_case_access"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_case_narrative_types"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_cols constant text[] := array['label', 'position', 'archived'];
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('case_narrative_type.created', 'case_narrative_type', new.id,
      new.commission_id, 'Tipo de narrativa criado: ' || coalesce(new.label, ''),
      app.audit_diff(null, to_jsonb(new), v_cols));
  else
    perform app.audit_write('case_narrative_type.updated', 'case_narrative_type', new.id,
      new.commission_id, 'Tipo de narrativa atualizado: ' || coalesce(new.label, ''),
      app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  end if;
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_case_narrative_types"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_case_narratives"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_cols constant text[] := array['type_label', 'display_position', 'is_expected',
                                  'status', 'assigned_to'];
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('case_narrative.created', 'case_narrative', new.id,
      app.commission_of_case(new.case_id),
      'Narrativa do caso criada: ' || coalesce(new.type_label, ''),
      app.audit_diff(null, to_jsonb(new), v_cols));
  else
    perform app.audit_write('case_narrative.updated', 'case_narrative', new.id,
      app.commission_of_case(new.case_id),
      'Narrativa do caso atualizada: ' || coalesce(new.type_label, ''),
      app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  end if;
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_case_narratives"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_case_phases"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_comm uuid;
begin
  if new.status is distinct from old.status then
    v_comm := app.commission_of_case(new.case_id);
    perform app.audit_write('case_phase.status_changed', 'case_phase', new.id, v_comm,
      'Status da fase ' || new.position || ': ' || old.status || ' → ' || new.status,
      app.audit_diff(to_jsonb(old), to_jsonb(new), array['status', 'position']));
  end if;
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_case_phases"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_cases"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_cols constant text[] := array['status', 'outcome_id'];
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('case.created', 'case', new.id, new.commission_id,
      'Caso criado nº ' || new.case_number,
      app.audit_diff(null, to_jsonb(new), v_cols));
  elsif new.status is distinct from old.status then
    perform app.audit_write('case.status_changed', 'case', new.id, new.commission_id,
      'Status do caso nº ' || new.case_number || ': ' || old.status || ' → ' || new.status,
      app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  end if;
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_cases"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_commission_members"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_cols constant text[] := array['role', 'user_id'];
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('commission_member.added', 'commission_member', new.id,
      new.commission_id, 'Membro adicionado (' || new.role || ')',
      app.audit_diff(null, to_jsonb(new), v_cols));
  elsif tg_op = 'UPDATE' then
    -- Only the role change is meaningful here.
    if new.role is distinct from old.role then
      perform app.audit_write('commission_member.role_changed', 'commission_member', new.id,
        new.commission_id, 'Função alterada: ' || old.role || ' → ' || new.role,
        app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
    end if;
  else
    perform app.audit_write('commission_member.removed', 'commission_member', old.id,
      old.commission_id, 'Membro removido (' || old.role || ')',
      app.audit_diff(to_jsonb(old), null, v_cols));
  end if;
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_commission_members"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_commissions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_cols constant text[] := array['name', 'slug'];
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('commission.created', 'commission', new.id, new.id,
      'Comissão criada: ' || coalesce(new.name, ''),
      app.audit_diff(null, to_jsonb(new), v_cols));
  else
    perform app.audit_write('commission.updated', 'commission', new.id, new.id,
      'Comissão atualizada: ' || coalesce(new.name, ''),
      app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  end if;
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_commissions"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_form_items"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_cols constant text[] := array['position', 'item_type', 'question_key', 'required'];
  v_id uuid;
  v_action text;
  v_meta jsonb;
  v_ver uuid;
begin
  if tg_op = 'DELETE' then
    v_ver := old.form_version_id; v_id := old.id; v_action := 'form_item.deleted';
    v_meta := app.audit_diff(to_jsonb(old), null, v_cols);
  elsif tg_op = 'INSERT' then
    v_ver := new.form_version_id; v_id := new.id; v_action := 'form_item.created';
    v_meta := app.audit_diff(null, to_jsonb(new), v_cols);
  else
    v_ver := new.form_version_id; v_id := new.id; v_action := 'form_item.updated';
    v_meta := app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols);
  end if;
  perform app.audit_write(v_action, 'form_item', v_id, app.commission_of_version(v_ver),
    'Item ' || tg_op || ' (' || coalesce(
      case when tg_op = 'DELETE' then old.item_type else new.item_type end, '?') || ')',
    v_meta);
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_form_items"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_form_sections"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_cols constant text[] := array['position', 'title', 'requires_signoff', 'signoff_role', 'is_default'];
  v_comm uuid;
  v_id uuid;
  v_action text;
  v_summary text;
  v_meta jsonb;
  v_ver uuid;
begin
  if tg_op = 'DELETE' then
    v_ver := old.form_version_id; v_id := old.id; v_action := 'form_section.deleted';
    v_summary := 'Seção excluída';
    v_meta := app.audit_diff(to_jsonb(old), null, v_cols);
  elsif tg_op = 'INSERT' then
    v_ver := new.form_version_id; v_id := new.id; v_action := 'form_section.created';
    v_summary := 'Seção criada: ' || coalesce(new.title, 'sem título');
    v_meta := app.audit_diff(null, to_jsonb(new), v_cols);
  else
    v_ver := new.form_version_id; v_id := new.id; v_action := 'form_section.updated';
    v_summary := 'Seção atualizada: ' || coalesce(new.title, 'sem título');
    v_meta := app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols);
  end if;
  perform app.audit_write(v_action, 'form_section', v_id, app.commission_of_version(v_ver), v_summary, v_meta);
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_form_sections"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_form_versions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_cols constant text[] := array['status', 'version_number', 'published_at'];
  v_comm uuid;
  v_action text;
  v_summary text;
  v_meta jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    v_comm := app.commission_of_version(new.id);
    perform app.audit_write('form_version.created', 'form_version', new.id, v_comm,
      'Versão ' || new.version_number || ' criada',
      app.audit_diff(null, to_jsonb(new), v_cols));
    return null;
  end if;

  -- UPDATE: only emit on a status flip (the meaningful lifecycle event).
  if new.status is distinct from old.status then
    v_comm := app.commission_of_version(new.id);
    v_meta := app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols);
    if new.status = 'published' then
      v_action := 'form_version.published';
      v_summary := 'Versão ' || new.version_number || ' publicada';
    elsif new.status = 'archived' then
      v_action := 'form_version.archived';
      v_summary := 'Versão ' || new.version_number || ' arquivada';
    else
      v_action := 'form_version.updated';
      v_summary := 'Versão ' || new.version_number || ' atualizada';
    end if;
    perform app.audit_write(v_action, 'form_version', new.id, v_comm, v_summary, v_meta);
  end if;
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_form_versions"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_forms"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_cols constant text[] := array['title', 'description'];
  v_comm uuid;
  v_id uuid;
  v_action text;
  v_summary text;
  v_meta jsonb;
begin
  if tg_op = 'INSERT' then
    v_comm := new.commission_id; v_id := new.id; v_action := 'form.created';
    v_summary := 'Formulário criado: ' || coalesce(new.title, '');
    v_meta := app.audit_diff(null, to_jsonb(new), v_cols);
  elsif tg_op = 'UPDATE' then
    v_comm := new.commission_id; v_id := new.id; v_action := 'form.updated';
    v_summary := 'Formulário atualizado: ' || coalesce(new.title, '');
    v_meta := app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols);
  else
    v_comm := old.commission_id; v_id := old.id; v_action := 'form.deleted';
    v_summary := 'Formulário excluído: ' || coalesce(old.title, '');
    v_meta := app.audit_diff(to_jsonb(old), null, v_cols);
  end if;
  perform app.audit_write(v_action, 'form', v_id, v_comm, v_summary, v_meta);
  return null;  -- AFTER trigger.
end;
$$;

ALTER FUNCTION "app"."trg_audit_forms"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_interviews"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('interview.created', 'interview', new.id, new.commission_id,
      'Entrevista criada nº ' || new.interview_number,
      app.audit_diff(null, to_jsonb(new), array['status']));
  elsif new.status is distinct from old.status then
    perform app.audit_write('interview.status_changed', 'interview', new.id, new.commission_id,
      'Status da entrevista nº ' || new.interview_number || ': ' || old.status || ' → ' || new.status,
      app.audit_diff(to_jsonb(old), to_jsonb(new), array['status']));
  end if;
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_interviews"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_meeting_signatures"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_cols constant text[] := array['attendee_id', 'signer_id', 'status'];
  v_comm uuid;
begin
  if tg_op = 'INSERT' and new.status = 'signed' then
    v_comm := app.commission_of_meeting(new.meeting_id);
    perform app.audit_write('meeting.signed', 'meeting_signature', new.id, v_comm,
      'Ata assinada', app.audit_diff(null, to_jsonb(new), v_cols));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'signed' then
    v_comm := app.commission_of_meeting(new.meeting_id);
    perform app.audit_write('meeting.signed', 'meeting_signature', new.id, v_comm,
      'Ata assinada', app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols));
  end if;
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_meeting_signatures"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_meetings"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if tg_op = 'INSERT' then
    perform app.audit_write('meeting.created', 'meeting', new.id, new.commission_id,
      'Reunião criada nº ' || new.meeting_number,
      app.audit_diff(null, to_jsonb(new), array['status']));
  elsif new.status is distinct from old.status then
    perform app.audit_write('meeting.status_changed', 'meeting', new.id, new.commission_id,
      'Status da reunião nº ' || new.meeting_number || ': ' || old.status || ' → ' || new.status,
      app.audit_diff(to_jsonb(old), to_jsonb(new), array['status']));
  end if;
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_meetings"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_responses"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  if new.status is distinct from old.status and new.status = 'submitted' then
    perform app.audit_write('response.submitted', 'response', new.id, new.commission_id,
      'Resposta enviada',
      app.audit_diff(to_jsonb(old), to_jsonb(new), array['status']));
  end if;
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_responses"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_signoffs"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_comm uuid;
begin
  select commission_id into v_comm from public.responses where id = new.response_id;
  perform app.audit_write('signoff.recorded', 'signoff', new.id, v_comm,
    'Seção assinada',
    app.audit_diff(null, to_jsonb(new), array['section_id', 'signed_by']));
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_signoffs"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "app"."trg_audit_template_narratives"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_cols constant text[] := array['display_position', 'narrative_type_id', 'is_expected'];
  v_id uuid;
  v_template uuid;
  v_action text;
  v_meta jsonb;
begin
  if tg_op = 'DELETE' then
    v_template := old.template_id; v_id := old.id; v_action := 'case_template_narrative.deleted';
    v_meta := app.audit_diff(to_jsonb(old), null, v_cols);
  elsif tg_op = 'INSERT' then
    v_template := new.template_id; v_id := new.id; v_action := 'case_template_narrative.created';
    v_meta := app.audit_diff(null, to_jsonb(new), v_cols);
  else
    v_template := new.template_id; v_id := new.id; v_action := 'case_template_narrative.updated';
    v_meta := app.audit_diff(to_jsonb(old), to_jsonb(new), v_cols);
  end if;
  perform app.audit_write(v_action, 'case_template_narrative', v_id,
    app.commission_of_template(v_template), 'Narrativa do processo ' || tg_op, v_meta);
  return null;
end;
$$;

ALTER FUNCTION "app"."trg_audit_template_narratives"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."audit_trail_enabled"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
  select app.feature_enabled('audit_trail');
$$;

ALTER FUNCTION "public"."audit_trail_enabled"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."log_audit_access"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
begin
  -- Positive allow-list (exact actions). A caller cannot forge a mutation row
  -- through this surface. The `.viewed` verbs (WS B; ADR 0030/0031) audit a
  -- detail-open of a PHI-bearing clinical record on the existing RLS-scoped read
  -- path (a `.viewed` suffix keeps them distinct from mutation verbs).
  if p_action not in (
    'response.opened_foreign', 'response.exported', 'audit.exported',
    'event_patient.read', 'case.opened',
    'safety_event.viewed', 'triage.viewed', 'rca.viewed', 'capa.viewed',
    'meeting.viewed', 'interview.viewed'
  ) then
    raise exception 'log_audit_access: ação de acesso não permitida (%)', p_action
      using errcode = 'check_violation';
  end if;
  perform app.audit_write(p_action, p_entity_type, p_entity_id, p_commission, p_summary, p_metadata);
end;
$$;

ALTER FUNCTION "public"."log_audit_access"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."verify_audit_chain"("p_commission" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("ok" boolean, "broken_seq" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app', 'public', 'pg_catalog'
    AS $$
declare
  v_rec record;
  v_prev_hash text;
  v_expected text;
  v_chain uuid;
begin
  perform app.assert_audit_enabled();

  -- Authorization.
  if p_commission is null then
    if not app.is_admin() then
      raise exception 'não autorizado' using errcode = '42501';
    end if;
  else
    if not (app.is_admin() or app.is_staff_admin_of(p_commission)) then
      raise exception 'não autorizado' using errcode = '42501';
    end if;
  end if;

  -- Build the set of chains to verify. For a single commission, just that chain.
  -- For the admin sweep (NULL), the global chain (NULL) plus every commission
  -- that has at least one audit row.
  for v_chain in
    select c from (
      select p_commission as c where p_commission is not null
      union all
      select null::uuid where p_commission is null
      union all
      select distinct commission_id from public.audit_log
        where p_commission is null and commission_id is not null
    ) chains
  loop
    v_prev_hash := null;
    for v_rec in
      select * from public.audit_log
      where commission_id is not distinct from v_chain
      order by seq asc
    loop
      v_expected := encode(
        extensions.digest(
          coalesce(v_prev_hash, '') || app.audit_canonical(
            v_rec.seq, v_rec.occurred_at, v_rec.actor_id, v_rec.actor_is_admin,
            v_rec.commission_id, v_rec.action, v_rec.entity_type, v_rec.entity_id,
            v_rec.summary, v_rec.metadata
          ),
          'sha256'
        ),
        'hex'
      );
      -- prev_hash link OR the row hash itself mismatching => tamper at this seq.
      if v_rec.prev_hash is distinct from v_prev_hash or v_rec.row_hash <> v_expected then
        ok := false;
        broken_seq := v_rec.seq;
        return next;
        return;
      end if;
      v_prev_hash := v_rec.row_hash;
    end loop;
  end loop;

  ok := true;
  broken_seq := null;
  return next;
end;
$$;

ALTER FUNCTION "public"."verify_audit_chain"("p_commission" "uuid") OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "commission_id" "uuid",
    "actor_id" "uuid",
    "actor_is_admin" boolean DEFAULT false NOT NULL,
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "summary" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "seq" bigint NOT NULL,
    "prev_hash" "text",
    "row_hash" "text" NOT NULL,
    CONSTRAINT "audit_log_action_shape" CHECK ((POSITION(('.'::"text") IN ("action")) > 1)),
    CONSTRAINT "audit_log_entity_type_not_blank" CHECK (("btrim"("entity_type") <> ''::"text")),
    CONSTRAINT "audit_log_seq_positive" CHECK (("seq" >= 1)),
    CONSTRAINT "audit_log_summary_not_blank" CHECK (("btrim"("summary") <> ''::"text"))
);

ALTER TABLE "public"."audit_log" OWNER TO "postgres";

COMMENT ON COLUMN "public"."audit_log"."commission_id" IS 'NULL = the global chain (admin/system/cross-commission). ON DELETE NO ACTION: commissions are archived, not dropped; audit rows are never deleted (ADR 0029).';

COMMENT ON COLUMN "public"."audit_log"."metadata" IS 'Curated old->new diff over a NON-SENSITIVE column allow-list ONLY. NEVER answer payloads or *_md/free-text/Markdown bodies (Rule 1 + Rule 11).';

ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_commission_id_fkey" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id");

CREATE INDEX "audit_log_action_idx" ON "public"."audit_log" USING "btree" ("commission_id", "action");

CREATE INDEX "audit_log_actor_idx" ON "public"."audit_log" USING "btree" ("commission_id", "actor_id");

CREATE INDEX "audit_log_commission_occurred_idx" ON "public"."audit_log" USING "btree" ("commission_id", "occurred_at" DESC);

CREATE UNIQUE INDEX "audit_log_commission_seq_key" ON "public"."audit_log" USING "btree" ("commission_id", "seq") WHERE ("commission_id" IS NOT NULL);

CREATE INDEX "audit_log_entity_idx" ON "public"."audit_log" USING "btree" ("entity_type", "entity_id");

CREATE UNIQUE INDEX "audit_log_global_seq_key" ON "public"."audit_log" USING "btree" ("seq") WHERE ("commission_id" IS NULL);

CREATE OR REPLACE TRIGGER "audit_case_access_trg" AFTER INSERT OR DELETE OR UPDATE ON "public"."case_access" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_case_access"();

CREATE OR REPLACE TRIGGER "audit_case_narrative_types_trg" AFTER INSERT OR UPDATE ON "public"."case_narrative_types" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_case_narrative_types"();

CREATE OR REPLACE TRIGGER "audit_case_narratives_trg" AFTER INSERT OR UPDATE ON "public"."case_narratives" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_case_narratives"();

CREATE OR REPLACE TRIGGER "audit_case_phases_trg" AFTER UPDATE ON "public"."case_phases" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_case_phases"();

CREATE OR REPLACE TRIGGER "audit_cases_trg" AFTER INSERT OR UPDATE ON "public"."cases" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_cases"();

CREATE OR REPLACE TRIGGER "audit_commission_members_trg" AFTER INSERT OR DELETE OR UPDATE ON "public"."commission_members" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_commission_members"();

CREATE OR REPLACE TRIGGER "audit_commissions_trg" AFTER INSERT OR UPDATE ON "public"."commissions" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_commissions"();

CREATE OR REPLACE TRIGGER "audit_form_items_trg" AFTER INSERT OR DELETE OR UPDATE ON "public"."form_items" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_form_items"();

CREATE OR REPLACE TRIGGER "audit_form_sections_trg" AFTER INSERT OR DELETE OR UPDATE ON "public"."form_sections" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_form_sections"();

CREATE OR REPLACE TRIGGER "audit_form_versions_trg" AFTER INSERT OR UPDATE ON "public"."form_versions" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_form_versions"();

CREATE OR REPLACE TRIGGER "audit_forms_trg" AFTER INSERT OR DELETE OR UPDATE ON "public"."forms" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_forms"();

CREATE OR REPLACE TRIGGER "audit_interviews_trg" AFTER INSERT OR UPDATE ON "public"."case_interviews" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_interviews"();

CREATE OR REPLACE TRIGGER "audit_meeting_signatures_trg" AFTER INSERT OR UPDATE ON "public"."meeting_signatures" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_meeting_signatures"();

CREATE OR REPLACE TRIGGER "audit_meetings_trg" AFTER INSERT OR UPDATE ON "public"."meetings" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_meetings"();

CREATE OR REPLACE TRIGGER "audit_responses_trg" AFTER UPDATE ON "public"."responses" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_responses"();

CREATE OR REPLACE TRIGGER "audit_signoffs_trg" AFTER INSERT ON "public"."response_section_signoffs" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_signoffs"();

CREATE OR REPLACE TRIGGER "audit_template_narratives_trg" AFTER INSERT OR DELETE OR UPDATE ON "public"."process_template_narratives" FOR EACH ROW EXECUTE FUNCTION "app"."trg_audit_template_narratives"();

CREATE OR REPLACE TRIGGER "guard_audit_immutable_trg" BEFORE DELETE OR UPDATE ON "public"."audit_log" FOR EACH ROW EXECUTE FUNCTION "app"."guard_audit_immutable"();

ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select" ON "public"."audit_log" FOR SELECT TO "authenticated" USING (("app"."is_admin"() OR "app"."is_staff_admin_of"("commission_id")));

REVOKE ALL ON FUNCTION "app"."assert_audit_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."assert_audit_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "app"."assert_audit_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "app"."audit_canonical"("p_seq" bigint, "p_occurred_at" timestamp with time zone, "p_actor_id" "uuid", "p_actor_is_admin" boolean, "p_commission_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_summary" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."audit_canonical"("p_seq" bigint, "p_occurred_at" timestamp with time zone, "p_actor_id" "uuid", "p_actor_is_admin" boolean, "p_commission_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_summary" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "app"."audit_canonical"("p_seq" bigint, "p_occurred_at" timestamp with time zone, "p_actor_id" "uuid", "p_actor_is_admin" boolean, "p_commission_id" "uuid", "p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_summary" "text", "p_metadata" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "app"."audit_diff"("p_old" "jsonb", "p_new" "jsonb", "p_cols" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."audit_diff"("p_old" "jsonb", "p_new" "jsonb", "p_cols" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "app"."audit_diff"("p_old" "jsonb", "p_new" "jsonb", "p_cols" "text"[]) TO "service_role";

REVOKE ALL ON FUNCTION "app"."audit_write"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."audit_write"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "app"."audit_write"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "app"."jsonb_canonical"("p_value" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "app"."jsonb_canonical"("p_value" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "app"."jsonb_canonical"("p_value" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."audit_trail_enabled"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."audit_trail_enabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_trail_enabled"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."log_audit_access"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_audit_access"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_audit_access"("p_action" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_commission" "uuid", "p_summary" "text", "p_metadata" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."verify_audit_chain"("p_commission" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."verify_audit_chain"("p_commission" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_audit_chain"("p_commission" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";
