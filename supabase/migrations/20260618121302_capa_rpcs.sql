-- Phase 14d / B3: Patient-Safety / NSP — CAPA RPCs + the KPI read + the PHI-free
-- mutation-audit trigger. ADR 0030/0034.
--
-- All write RPCs are SECURITY DEFINER, search_path pinned, anon/PUBLIC EXECUTE revoked,
-- gate app.assert_patient_safety_enabled(), and set app.in_safety_rpc = 'on' for the
-- duration so app.guard_capa_status / app.guard_capa_child_lock admit the legitimate
-- writes (mirror the 14a/b/c RPC family). The child-lock keys on the parent plan status,
-- so a terminal plan's children stay frozen even inside an RPC — reopen is the escape.
--
-- AUTHORIZATION: CAPA management is PQS/admin (app.assert_capa_writable → 42501). The
-- ONE exception is the action ADVANCE path (advance/complete_capa_action), which is
-- assignee-OR-PQS via app.advance_capa_action_core (→ HC050) — a plain-`staff` assignee
-- advances their action's status but cannot otherwise edit the plan.
--
-- SQLSTATEs (Phase 14d): HC049 wrong CAPA state / frozen; HC050 advance not entitled;
-- HC051 close — unsettled actions; HC052 close — no effectiveness; HC053 cancel —
-- already terminal. Source-shape / evidence-shape violations raise check_violation with
-- a DISTINCT pt-BR message. no_data_found (P0002) missing.

-- ===========================================================================
-- app.assert_capa_writable(capa_id) — PQS/admin gate for plan management
-- ===========================================================================
create function app.assert_capa_writable(p_capa_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if (select id from public.capa_plan where id = p_capa_id) is null then
    raise exception 'plano de ação não encontrado' using errcode = 'no_data_found';
  end if;
  if not app.is_pqs_writer() then
    raise exception 'apenas o NSP pode gerenciar planos de ação' using errcode = '42501';
  end if;
end;
$$;

revoke all on function app.assert_capa_writable(uuid) from public;
grant execute on function app.assert_capa_writable(uuid) to authenticated, service_role;

-- public.capa_viewer_can_manage(capa_id) -> boolean — the query layer's "can the
-- CURRENT user manage this plan?" signal (PQS/admin; mirror rca_writer_can_write). The
-- app helper is not PostgREST-callable, so this thin wrapper exposes it.
create function public.capa_viewer_can_manage(p_capa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  -- The plan must be readable (scope) AND the viewer a PQS/admin writer.
  select app.can_read_capa(p_capa_id, auth.uid()) and app.is_pqs_writer();
$$;

grant execute on function public.capa_viewer_can_manage(uuid) to authenticated, service_role;
revoke all on function public.capa_viewer_can_manage(uuid) from public, anon;

-- ===========================================================================
-- open_capa_plan(source, classification, source_id) — mint a plan (PQS/admin)
-- ===========================================================================
-- Pre-validates the source shape with a DISTINCT pt-BR message, then inserts with a
-- bounded unique_violation retry over the minted code (mirror notify_safety_event).
create function public.open_capa_plan(
  p_source text,
  p_classification text default 'corretiva',
  p_source_id uuid default null
)
returns public.capa_plan
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.open_capa_plan(text, text, uuid) from public, anon;
grant execute on function public.open_capa_plan(text, text, uuid) to authenticated, service_role;

-- ===========================================================================
-- update_capa_plan(capa, classification) — edit classification (also bumps aberto->em_execucao)
-- ===========================================================================
create function public.update_capa_plan(p_capa_id uuid, p_classification text)
returns public.capa_plan
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.update_capa_plan(uuid, text) from public, anon;
grant execute on function public.update_capa_plan(uuid, text) to authenticated, service_role;

-- ===========================================================================
-- Corrective actions
-- ===========================================================================
create function public.add_capa_action(
  p_capa_id uuid,
  p_title text,
  p_owner text default null,
  p_assignee_user_id uuid default null,
  p_due_date date default null,
  p_action_strength text default 'intermediaria',
  p_success_measure text default null,
  p_root_cause_id uuid default null
)
returns public.capa_action
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.add_capa_action(uuid, text, text, uuid, date, text, text, uuid) from public, anon;
grant execute on function public.add_capa_action(uuid, text, text, uuid, date, text, text, uuid) to authenticated, service_role;

create function public.update_capa_action(
  p_action_id uuid,
  p_title text,
  p_owner text default null,
  p_assignee_user_id uuid default null,
  p_due_date date default null,
  p_action_strength text default 'intermediaria',
  p_success_measure text default null,
  p_root_cause_id uuid default null
)
returns public.capa_action
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.update_capa_action(uuid, text, text, uuid, date, text, text, uuid) from public, anon;
grant execute on function public.update_capa_action(uuid, text, text, uuid, date, text, text, uuid) to authenticated, service_role;

create function public.remove_capa_action(p_action_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.remove_capa_action(uuid) from public, anon;
grant execute on function public.remove_capa_action(uuid) to authenticated, service_role;

-- advance/complete_capa_action — the assignee-OR-PQS narrow path (wraps the core).
create function public.advance_capa_action(p_action_id uuid, p_status text)
returns public.capa_action
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  perform app.assert_patient_safety_enabled();
  return app.advance_capa_action_core(p_action_id, p_status);
end;
$$;

revoke all on function public.advance_capa_action(uuid, text) from public, anon;
grant execute on function public.advance_capa_action(uuid, text) to authenticated, service_role;

create function public.complete_capa_action(p_action_id uuid)
returns public.capa_action
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  perform app.assert_patient_safety_enabled();
  return app.advance_capa_action_core(p_action_id, 'concluida');
end;
$$;

revoke all on function public.complete_capa_action(uuid) from public, anon;
grant execute on function public.complete_capa_action(uuid) to authenticated, service_role;

-- ===========================================================================
-- Execution tasks
-- ===========================================================================
create function public.add_capa_action_task(p_action_id uuid, p_description text)
returns public.capa_action_task
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.add_capa_action_task(uuid, text) from public, anon;
grant execute on function public.add_capa_action_task(uuid, text) to authenticated, service_role;

create function public.set_capa_action_task_done(p_task_id uuid, p_is_done boolean)
returns public.capa_action_task
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.set_capa_action_task_done(uuid, boolean) from public, anon;
grant execute on function public.set_capa_action_task_done(uuid, boolean) to authenticated, service_role;

create function public.remove_capa_action_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.remove_capa_action_task(uuid) from public, anon;
grant execute on function public.remove_capa_action_task(uuid) to authenticated, service_role;

-- ===========================================================================
-- Implementation evidence (file XOR link; soft-delete)
-- ===========================================================================
create function public.add_capa_action_evidence(
  p_action_id uuid, p_kind text, p_title text,
  p_storage_path text default null, p_external_url text default null
)
returns public.capa_action_evidence
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.add_capa_action_evidence(uuid, text, text, text, text) from public, anon;
grant execute on function public.add_capa_action_evidence(uuid, text, text, text, text) to authenticated, service_role;

create function public.delete_capa_action_evidence(p_evidence_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.delete_capa_action_evidence(uuid) from public, anon;
grant execute on function public.delete_capa_action_evidence(uuid) to authenticated, service_role;

-- ===========================================================================
-- Measures -> results
-- ===========================================================================
create function public.add_capa_measure(
  p_capa_id uuid, p_name text, p_target text default null, p_definition text default null
)
returns public.capa_measure
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.add_capa_measure(uuid, text, text, text) from public, anon;
grant execute on function public.add_capa_measure(uuid, text, text, text) to authenticated, service_role;

create function public.update_capa_measure(
  p_measure_id uuid, p_name text, p_target text default null, p_definition text default null
)
returns public.capa_measure
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.update_capa_measure(uuid, text, text, text) from public, anon;
grant execute on function public.update_capa_measure(uuid, text, text, text) to authenticated, service_role;

create function public.remove_capa_measure(p_measure_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.remove_capa_measure(uuid) from public, anon;
grant execute on function public.remove_capa_measure(uuid) to authenticated, service_role;

create function public.record_capa_measure_result(
  p_measure_id uuid, p_period text, p_value numeric default null, p_note text default null
)
returns public.capa_measure_result
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.record_capa_measure_result(uuid, text, numeric, text) from public, anon;
grant execute on function public.record_capa_measure_result(uuid, text, numeric, text) to authenticated, service_role;

-- ===========================================================================
-- Effectiveness (the close precondition) — upsert; moves em_execucao -> em_verificacao
-- ===========================================================================
create function public.record_capa_effectiveness(
  p_capa_id uuid, p_verdict text, p_method_md text default null
)
returns public.capa_effectiveness
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.record_capa_effectiveness(uuid, text, text) from public, anon;
grant execute on function public.record_capa_effectiveness(uuid, text, text) to authenticated, service_role;

-- ===========================================================================
-- close_capa_plan — the CONCLUDE GATE + the close->event-closure side effect
-- ===========================================================================
-- From em_verificacao (or em_execucao) -> concluido. Rejects unsettled actions (HC051),
-- requires an effectiveness verdict (HC052), writes lessons_learned_md. Terminal-first
-- flip. Then, best-effort: if the plan is event/rca-scoped and the event is fully settled
-- (app.event_capa_fully_settled) and still 'triaged', auto-close the event.
create function public.close_capa_plan(p_capa_id uuid, p_lessons_learned_md text default null)
returns public.capa_plan
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.close_capa_plan(uuid, text) from public, anon;
grant execute on function public.close_capa_plan(uuid, text) to authenticated, service_role;

-- ===========================================================================
-- cancel_capa_plan / reopen_capa_plan
-- ===========================================================================
create function public.cancel_capa_plan(p_capa_id uuid)
returns public.capa_plan
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.cancel_capa_plan(uuid) from public, anon;
grant execute on function public.cancel_capa_plan(uuid) to authenticated, service_role;

-- reopen_capa_plan — concluido -> em_execucao; REVOKES the effectiveness row (so the
-- next close re-requires a verdict). Clears closure stamps.
create function public.reopen_capa_plan(p_capa_id uuid)
returns public.capa_plan
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.reopen_capa_plan(uuid) from public, anon;
grant execute on function public.reopen_capa_plan(uuid) to authenticated, service_role;

-- ===========================================================================
-- capa_kpis() — the NSP-wide CAPA dashboard (DEFINER, PQS/admin-gated)
-- ===========================================================================
create function public.capa_kpis()
returns table (open_count int, in_verification int, overdue_actions int, closed_ytd int)
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.capa_kpis() from public, anon;
grant execute on function public.capa_kpis() to authenticated, service_role;

-- ===========================================================================
-- Mutation-audit trigger (Rule 11) — PHI-FREE allow-list on capa_plan
-- ===========================================================================
-- AFTER INSERT/UPDATE on capa_plan: allow-list [status, classification, source] —
-- NEVER lessons_learned_md (free text). Verbs by status transition. A separate
-- capa.effectiveness_recorded row (allow-list [verdict] — a bounded enum) fires from
-- the capa_effectiveness trigger; method_md is NEVER copied.
create function app.trg_audit_capa_plan()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

create trigger audit_capa_plan_trg
  after insert or update on public.capa_plan
  for each row execute function app.trg_audit_capa_plan();

-- AFTER INSERT/UPDATE on capa_effectiveness: log capa.effectiveness_recorded + the
-- bounded `verdict` enum ONLY — NEVER method_md (free text).
create function app.trg_audit_capa_effectiveness()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

create trigger audit_capa_effectiveness_trg
  after insert or update on public.capa_effectiveness
  for each row execute function app.trg_audit_capa_effectiveness();
