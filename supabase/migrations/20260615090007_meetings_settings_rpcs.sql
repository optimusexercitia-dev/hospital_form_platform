-- Phase 10 / B4 (F5 support): meeting-type vocabulary CRUD + quorum settings.
--
-- The manage/ settings screen needs to author the per-commission meeting-type
-- vocabulary and configure the quorum rule. These follow the ALREADY-APPROVED
-- case_outcomes vocabulary-CRUD pattern (20260614093003) exactly: SECURITY
-- INVOKER, RLS staff_admin-write is the authority + an explicit is_staff_admin_of
-- gate, gate app.assert_meetings_enabled(). archive (not delete) retires a type.
--
-- The quorum settings UPSERT writes the single commission_meeting_settings row;
-- the value-shape CHECK (…090000) enforces the per-rule quorum_value shape, so a
-- bad combination is rejected with check_violation -> a clean pt-BR in the action.

-- ===========================================================================
-- create_meeting_type(commission, name, color_token)
-- ===========================================================================
create function public.create_meeting_type(
  p_commission_id uuid,
  p_name text,
  p_color_token text default 'slate'
)
returns public.commission_meeting_types
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
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

grant execute on function public.create_meeting_type(uuid, text, text) to authenticated, service_role;

-- ===========================================================================
-- rename_meeting_type(type_id, name, color_token)
-- ===========================================================================
create function public.rename_meeting_type(
  p_type_id uuid,
  p_name text,
  p_color_token text
)
returns public.commission_meeting_types
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
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

grant execute on function public.rename_meeting_type(uuid, text, text) to authenticated, service_role;

-- ===========================================================================
-- archive_meeting_type(type_id)
-- ===========================================================================
create function public.archive_meeting_type(p_type_id uuid)
returns public.commission_meeting_types
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
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

grant execute on function public.archive_meeting_type(uuid) to authenticated, service_role;

-- ===========================================================================
-- update_meeting_settings(commission, rule, value) — UPSERT the single row
-- ===========================================================================
create function public.update_meeting_settings(
  p_commission_id uuid,
  p_quorum_rule_type text,
  p_quorum_value numeric default null
)
returns public.commission_meeting_settings
language plpgsql
security invoker
set search_path = app, public, pg_catalog
as $$
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

grant execute on function public.update_meeting_settings(uuid, text, numeric) to authenticated, service_role;

-- ===========================================================================
-- Re-revoke anon/PUBLIC EXECUTE
-- ===========================================================================
revoke execute on function public.create_meeting_type(uuid, text, text) from anon, public;
revoke execute on function public.rename_meeting_type(uuid, text, text) from anon, public;
revoke execute on function public.archive_meeting_type(uuid) from anon, public;
revoke execute on function public.update_meeting_settings(uuid, text, numeric) from anon, public;
