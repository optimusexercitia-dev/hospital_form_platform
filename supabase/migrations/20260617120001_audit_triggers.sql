-- Phase 13 / B3: Audit Trail — INSTRUMENTATION triggers (path-independent capture).
-- ADR 0029. Establishes the cross-cutting Rule 11 capture over the curated set of
-- high-value tables. Each AFTER INSERT/UPDATE/DELETE trigger resolves the row's
-- commission_id and calls app.audit_write(...) with the action verb, a short pt-BR
-- summary, and a CURATED old->new diff over a NON-SENSITIVE column allow-list ONLY.
--
-- CRUX (Rule 1 + Rule 11): the metadata allow-lists below NEVER include
-- answers.value, any *_md / free-text / Markdown body (label, question_explanation,
-- content, options, description, minutes_md, summary_md, note), or clinical content.
-- `responses` logs only the status transition (in_progress->submitted), never answers.
--
-- Capture is TRIGGER-ONLY (no RPC-side writes), so:
--   * coverage is PATH-INDEPENDENT — a direct-table write the RLS allows (a
--     staff_admin editing a draft section) is logged exactly like an RPC write;
--   * there is NO double-logging — one mutation fires one trigger -> one row.
-- The service-role invite path inserts public.commission_members DIRECTLY
-- (admin.from('commission_members').upsert — verified in src/lib/members/actions.ts),
-- so its membership row is caught by the commission_members trigger; NO explicit
-- audit_write call is needed there.
--
-- The writer no-ops while the audit_trail flag is OFF, so these triggers are inert
-- until the in-phase flip (B4 tail) — the chain starts cleanly at flip.

-- ===========================================================================
-- app.audit_diff(old_row, new_row, cols[]) -> jsonb    (curated old->new diff)
-- ===========================================================================
-- Given an OLD and NEW jsonb row (to_jsonb(OLD/NEW)) and an explicit ALLOW-LIST of
-- column names, returns { col: {"old": <old>, "new": <new>} } for each allow-listed
-- column whose value CHANGED. On INSERT pass p_old = NULL (all allow-listed
-- non-null cols become {"old":null,"new":<v>}); on DELETE pass p_new = NULL.
-- Only the named columns are ever read, so a sensitive column can never leak in.
create function app.audit_diff(p_old jsonb, p_new jsonb, p_cols text[])
returns jsonb
language sql
immutable
set search_path = app, pg_catalog
as $$
  select coalesce(jsonb_object_agg(col, jsonb_build_object('old', ov, 'new', nv)), '{}'::jsonb)
  from (
    select c as col,
           case when p_old is null then null else p_old -> c end as ov,
           case when p_new is null then null else p_new -> c end as nv
    from unnest(p_cols) as c
  ) d
  where ov is distinct from nv;
$$;

revoke all on function app.audit_diff(jsonb, jsonb, text[]) from public;
grant execute on function app.audit_diff(jsonb, jsonb, text[]) to authenticated, service_role;

-- ===========================================================================
-- forms — created / updated / deleted
-- ===========================================================================
-- Allow-list: title, description. (description is a SHORT form description, not a
-- Markdown body — it is the same field the form list shows; safe to diff.)
create function app.trg_audit_forms()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

create trigger audit_forms_trg
  after insert or update or delete on public.forms
  for each row execute function app.trg_audit_forms();

-- ===========================================================================
-- form_versions — created / published / archived  (commission via the form)
-- ===========================================================================
-- INSERT -> form_version.created; status change -> .published / .archived (the
-- AC-named verbs) else a generic form_version.updated. Allow-list: status,
-- version_number, published_at. (No DELETE verb — versions are not deleted.)
create function app.trg_audit_form_versions()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

create trigger audit_form_versions_trg
  after insert or update on public.form_versions
  for each row execute function app.trg_audit_form_versions();

-- ===========================================================================
-- form_sections — created / updated / deleted  (commission via the version)
-- ===========================================================================
-- Allow-list: position, title, requires_signoff, signoff_role, is_default.
-- DELIBERATELY EXCLUDES `description` (free-text-ish — ADR 0029 Q2) and the
-- visible_when jsonb (a condition, not a state worth diffing here).
create function app.trg_audit_form_sections()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

create trigger audit_form_sections_trg
  after insert or update or delete on public.form_sections
  for each row execute function app.trg_audit_form_sections();

-- ===========================================================================
-- form_items — created / updated / deleted  (item granularity — ADR 0029 Q2)
-- ===========================================================================
-- Allow-list: position, item_type, question_key, required. NEVER label /
-- question_explanation / content / options (explanatory text, Markdown, image
-- refs, and choice option bodies — all free-text/payload, Rule 1 + Rule 11).
create function app.trg_audit_form_items()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

create trigger audit_form_items_trg
  after insert or update or delete on public.form_items
  for each row execute function app.trg_audit_form_items();

-- ===========================================================================
-- commission_members — added / role_changed / removed
-- ===========================================================================
-- Allow-list: role, user_id. (Catches the service-role invite upsert AND the
-- staff_admin add/remove + admin role changes — path-independent.)
create function app.trg_audit_commission_members()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

create trigger audit_commission_members_trg
  after insert or update or delete on public.commission_members
  for each row execute function app.trg_audit_commission_members();

-- ===========================================================================
-- commissions — created / updated   (own-commission chain — ADR 0029 Q4)
-- ===========================================================================
-- Allow-list: name, slug. A commission's lifecycle goes on ITS OWN chain
-- (commission_id = the row's own id), so its staff_admin can see it in their trail.
create function app.trg_audit_commissions()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

create trigger audit_commissions_trg
  after insert or update on public.commissions
  for each row execute function app.trg_audit_commissions();

-- ===========================================================================
-- responses — STATUS FLIP ONLY (in_progress -> submitted). NEVER answers.
-- ===========================================================================
-- Allow-list: status. The only thing logged is the status transition; the answer
-- payload is the explicit no-fly zone (Rule 1 + Rule 11).
create function app.trg_audit_responses()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
begin
  if new.status is distinct from old.status and new.status = 'submitted' then
    perform app.audit_write('response.submitted', 'response', new.id, new.commission_id,
      'Resposta enviada',
      app.audit_diff(to_jsonb(old), to_jsonb(new), array['status']));
  end if;
  return null;
end;
$$;

create trigger audit_responses_trg
  after update on public.responses
  for each row execute function app.trg_audit_responses();

-- ===========================================================================
-- response_section_signoffs — recorded   (commission via the response)
-- ===========================================================================
-- Allow-list: section_id, signed_by. NEVER `note` (free text). signoffs are
-- INSERT-only in the lifecycle (immutable once written), so INSERT is all we log.
create function app.trg_audit_signoffs()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

create trigger audit_signoffs_trg
  after insert on public.response_section_signoffs
  for each row execute function app.trg_audit_signoffs();

-- ===========================================================================
-- cases — created / status_changed
-- ===========================================================================
-- Allow-list: status, outcome_id. (label is a short free-text case label — left
-- out of the diff to stay conservative; the case_number identifies the row.)
create function app.trg_audit_cases()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

create trigger audit_cases_trg
  after insert or update on public.cases
  for each row execute function app.trg_audit_cases();

-- ===========================================================================
-- case_phases — status_changed   (commission via the case)
-- ===========================================================================
-- Allow-list: status, position. Only the status transition is logged (phase
-- creation happens in bulk at case creation; the case.created row covers that).
create function app.trg_audit_case_phases()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

create trigger audit_case_phases_trg
  after update on public.case_phases
  for each row execute function app.trg_audit_case_phases();

-- ===========================================================================
-- meetings — created / status_changed.  NEVER minutes_md.
-- ===========================================================================
-- Allow-list: status. (title/minutes/schedule are not diffed — minutes_md is the
-- Markdown body no-fly zone; status is the lifecycle signal accreditation wants.)
create function app.trg_audit_meetings()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

create trigger audit_meetings_trg
  after insert or update on public.meetings
  for each row execute function app.trg_audit_meetings();

-- ===========================================================================
-- meeting_signatures — signed   (commission via the meeting)
-- ===========================================================================
-- Allow-list: attendee_id, signer_id, status. NEVER content_hash / note /
-- provider_payload / ip_address / user_agent. A signature is the AC-named
-- meeting.signed event: log the active INSERT, and an UPDATE that flips to 'signed'
-- (defensive — the sign path inserts, but reopen flips to 'revoked' which we skip).
create function app.trg_audit_meeting_signatures()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

create trigger audit_meeting_signatures_trg
  after insert or update on public.meeting_signatures
  for each row execute function app.trg_audit_meeting_signatures();

-- ===========================================================================
-- case_interviews — created / status_changed.  NEVER summary_md.
-- ===========================================================================
-- Allow-list: status. (summary_md is the Markdown body no-fly zone.)
create function app.trg_audit_interviews()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

create trigger audit_interviews_trg
  after insert or update on public.case_interviews
  for each row execute function app.trg_audit_interviews();
