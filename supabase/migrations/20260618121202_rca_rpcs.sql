-- Phase 14c / B3: Patient-Safety / NSP — RCA RPCs + the writer-can-write read + the
-- PHI-free mutation-audit trigger. ADR 0030/0033.
--
-- All write RPCs are SECURITY DEFINER, search_path pinned, anon/PUBLIC EXECUTE
-- revoked, gate app.assert_patient_safety_enabled(), authorize via
-- app.assert_rca_writable (→ HC048), and set app.in_safety_rpc = 'on' for the
-- duration so app.guard_rca_status / app.guard_rca_child_lock admit the legitimate
-- writes (mirror the interviews RPC family). The child-lock keys on the parent rca
-- status (NOT the flag), so a 'completed' RCA's children stay frozen even inside an
-- RPC — reopen_rca is the escape.
--
-- AUTHORIZATION: every write authorizes via app.can_write_rca (PQS/admin OR a
-- non-observer assigned team member). add_rca_member is the BOOTSTRAP exception
-- (someone must seed the team): it authorizes is_pqs_member OR can_write_rca, so an
-- existing writer (or PQS/admin) can add members; a non-team non-PQS user cannot.
--
-- SQLSTATEs (Phase 14c): HC047 wrong RCA state / frozen / no-root-cause complete-gate;
-- HC048 not entitled to write. Evidence-shape / member-shape violations raise
-- check_violation with a DISTINCT pt-BR message (the RPC pre-validates so the user
-- never sees a raw constraint name — the Phase-5 MINOR-2 lesson). no_data_found (P0002)
-- missing.

-- ===========================================================================
-- Helpers: authorize + the viewer-can-write read
-- ===========================================================================
-- app.assert_rca_writable(rca_id) — assert the RCA exists and the caller may WRITE it;
-- returns the event id. The write authority for every mutation except add_rca_member's
-- bootstrap branch.
create function app.assert_rca_writable(p_rca_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function app.assert_rca_writable(uuid) from public;
grant execute on function app.assert_rca_writable(uuid) to authenticated, service_role;

-- public.rca_writer_can_write(rca_id) -> boolean — the query layer's "can the CURRENT
-- user write this RCA?" signal (mirror interview_viewer_can_write).
create function public.rca_writer_can_write(p_rca_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select app.can_write_rca(p_rca_id, auth.uid());
$$;

grant execute on function public.rca_writer_can_write(uuid) to authenticated, service_role;
revoke all on function public.rca_writer_can_write(uuid) from public, anon;

-- app.rca_bump_in_progress(rca_id) — internal: a draft RCA that receives its first
-- real edit advances draft -> in_progress (mirror the interviews "first edit" bump).
-- Caller already holds app.in_safety_rpc.
create function app.rca_bump_in_progress(p_rca_id uuid)
returns void
language sql
security definer
set search_path = app, public, pg_catalog
as $$
  update public.rca set status = 'in_progress', updated_at = now()
  where id = p_rca_id and status = 'draft';
$$;

revoke all on function app.rca_bump_in_progress(uuid) from public;
grant execute on function app.rca_bump_in_progress(uuid) to authenticated, service_role;

-- ===========================================================================
-- Lifecycle
-- ===========================================================================
-- update_rca — edit the problem statement + findings summary. Also bumps
-- draft -> in_progress on the first edit.
create function public.update_rca(
  p_rca_id uuid,
  p_what_md text default null,
  p_expected_md text default null,
  p_detected text default null,
  p_impact text default null,
  p_scope text default null,
  p_summary_md text default null
)
returns public.rca
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.update_rca(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.update_rca(uuid, text, text, text, text, text, text) to authenticated, service_role;

-- submit_rca_for_review — in_progress -> in_review.
create function public.submit_rca_for_review(p_rca_id uuid)
returns public.rca
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.submit_rca_for_review(uuid) from public, anon;
grant execute on function public.submit_rca_for_review(uuid) to authenticated, service_role;

-- complete_rca — in_review -> completed (FREEZE). Conclude gate: requires >= 1 root
-- cause (a quality gate, and 14d's capa_action FKs root causes) → HC047 with a clear
-- pt-BR message.
create function public.complete_rca(p_rca_id uuid)
returns public.rca
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.complete_rca(uuid) from public, anon;
grant execute on function public.complete_rca(uuid) to authenticated, service_role;

-- reopen_rca — completed -> in_progress (unfreezes; audited). Clears completion stamps.
create function public.reopen_rca(p_rca_id uuid)
returns public.rca
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.reopen_rca(uuid) from public, anon;
grant execute on function public.reopen_rca(uuid) to authenticated, service_role;

-- ===========================================================================
-- Team members
-- ===========================================================================
-- add_rca_member — BOOTSTRAP exception: authorize is_pqs_member OR can_write_rca (so
-- the team can be seeded). user_id XOR external_name; a registered user must be a real
-- profile. Child-lock applies (cannot add to a completed RCA).
create function public.add_rca_member(
  p_rca_id uuid,
  p_role text,
  p_user_id uuid default null,
  p_external_name text default null
)
returns public.rca_members
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.add_rca_member(uuid, text, uuid, text) from public, anon;
grant execute on function public.add_rca_member(uuid, text, uuid, text) to authenticated, service_role;

-- update_rca_member_role / remove_rca_member — authorize can_write_rca (HC048).
create function public.update_rca_member_role(p_member_id uuid, p_role text)
returns public.rca_members
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.update_rca_member_role(uuid, text) from public, anon;
grant execute on function public.update_rca_member_role(uuid, text) to authenticated, service_role;

create function public.remove_rca_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.remove_rca_member(uuid) from public, anon;
grant execute on function public.remove_rca_member(uuid) to authenticated, service_role;

-- ===========================================================================
-- Incident timeline
-- ===========================================================================
create function public.add_rca_timeline_entry(
  p_rca_id uuid, p_occurred_at timestamptz, p_description text
)
returns public.rca_timeline_entries
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.add_rca_timeline_entry(uuid, timestamptz, text) from public, anon;
grant execute on function public.add_rca_timeline_entry(uuid, timestamptz, text) to authenticated, service_role;

create function public.update_rca_timeline_entry(
  p_entry_id uuid, p_occurred_at timestamptz, p_description text
)
returns public.rca_timeline_entries
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.update_rca_timeline_entry(uuid, timestamptz, text) from public, anon;
grant execute on function public.update_rca_timeline_entry(uuid, timestamptz, text) to authenticated, service_role;

create function public.remove_rca_timeline_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.remove_rca_timeline_entry(uuid) from public, anon;
grant execute on function public.remove_rca_timeline_entry(uuid) to authenticated, service_role;

-- reorder_rca_timeline — single-statement renumber against the deferrable position
-- unique (offset to negatives, then renumber by array order; mirror reorder_event_types).
create function public.reorder_rca_timeline(p_rca_id uuid, p_ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.reorder_rca_timeline(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_rca_timeline(uuid, uuid[]) to authenticated, service_role;

-- ===========================================================================
-- Evidence (upload XOR link XOR citation; soft-delete)
-- ===========================================================================
-- add_rca_evidence pre-validates the three-way shape with a DISTINCT pt-BR message
-- (check_violation) before the insert, so the user never sees a raw constraint name.
create function public.add_rca_evidence(
  p_rca_id uuid,
  p_kind text,
  p_title text,
  p_storage_path text default null,
  p_external_url text default null,
  p_citation_target text default null,
  p_cited_entity_id uuid default null,
  p_citation_label text default null
)
returns public.rca_evidence
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.add_rca_evidence(uuid, text, text, text, text, text, uuid, text) from public, anon;
grant execute on function public.add_rca_evidence(uuid, text, text, text, text, text, uuid, text) to authenticated, service_role;

create function public.delete_rca_evidence(p_evidence_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.delete_rca_evidence(uuid) from public, anon;
grant execute on function public.delete_rca_evidence(uuid) to authenticated, service_role;

-- ===========================================================================
-- Fishbone factors
-- ===========================================================================
create function public.add_rca_factor(p_rca_id uuid, p_category text, p_text text)
returns public.rca_factors
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.add_rca_factor(uuid, text, text) from public, anon;
grant execute on function public.add_rca_factor(uuid, text, text) to authenticated, service_role;

create function public.update_rca_factor(p_factor_id uuid, p_text text)
returns public.rca_factors
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.update_rca_factor(uuid, text) from public, anon;
grant execute on function public.update_rca_factor(uuid, text) to authenticated, service_role;

create function public.set_rca_factor_key(p_factor_id uuid, p_is_key boolean)
returns public.rca_factors
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.set_rca_factor_key(uuid, boolean) from public, anon;
grant execute on function public.set_rca_factor_key(uuid, boolean) to authenticated, service_role;

create function public.remove_rca_factor(p_factor_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.remove_rca_factor(uuid) from public, anon;
grant execute on function public.remove_rca_factor(uuid) to authenticated, service_role;

-- ===========================================================================
-- 5-Whys (keyed by factor; lazily create the chain)
-- ===========================================================================
-- set_rca_why_step(factor, index, text) — set the i-th step (0-based, < 5). Lazily
-- creates the chain row keyed by factor_id; pads the steps array up to index.
create function public.set_rca_why_step(p_factor_id uuid, p_index integer, p_text text)
returns public.rca_why_chains
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.set_rca_why_step(uuid, integer, text) from public, anon;
grant execute on function public.set_rca_why_step(uuid, integer, text) to authenticated, service_role;

create function public.set_rca_why_root(p_factor_id uuid, p_root_text text)
returns public.rca_why_chains
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.set_rca_why_root(uuid, text) from public, anon;
grant execute on function public.set_rca_why_root(uuid, text) to authenticated, service_role;

-- ===========================================================================
-- Root causes (stage 3) — the FK target for Phase-14d capa_action
-- ===========================================================================
create function public.add_rca_root_cause(
  p_rca_id uuid, p_text text,
  p_category text default null, p_classification text default 'system', p_type text default 'root'
)
returns public.rca_root_causes
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.add_rca_root_cause(uuid, text, text, text, text) from public, anon;
grant execute on function public.add_rca_root_cause(uuid, text, text, text, text) to authenticated, service_role;

create function public.update_rca_root_cause(
  p_root_cause_id uuid, p_text text,
  p_category text default null, p_classification text default 'system', p_type text default 'root'
)
returns public.rca_root_causes
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.update_rca_root_cause(uuid, text, text, text, text) from public, anon;
grant execute on function public.update_rca_root_cause(uuid, text, text, text, text) to authenticated, service_role;

create function public.remove_rca_root_cause(p_root_cause_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.remove_rca_root_cause(uuid) from public, anon;
grant execute on function public.remove_rca_root_cause(uuid) to authenticated, service_role;

-- ===========================================================================
-- Mutation-audit trigger (Rule 11) — PHI-FREE allow-list on rca (STATUS only)
-- ===========================================================================
-- AFTER INSERT/UPDATE on rca: report on a PHI-FREE allow-list [status] ONLY — NEVER
-- what_md/expected_md/summary_md/detected/impact/scope (free text / clinical). Verbs:
-- rca.created (INSERT — the confirm_triage shell) / rca.submitted / rca.completed /
-- rca.reopened / rca.status_changed. The structured children are NOT separately
-- audited (their effect is the analysis content, which is free text we must not copy).
create function app.trg_audit_rca()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

create trigger audit_rca_trg
  after insert or update on public.rca
  for each row execute function app.trg_audit_rca();
