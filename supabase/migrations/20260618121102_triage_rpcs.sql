-- Phase 14b / B3: Patient-Safety / NSP — TRIAGE RPCs + the derived-verdict read +
-- the configurable-vocab CRUD + the PHI-free mutation-audit triggers. ADR 0030/0032.
--
-- All RPCs are SECURITY DEFINER, search_path pinned, anon/PUBLIC EXECUTE revoked, gate
-- app.assert_patient_safety_enabled(), and (the writes) set app.in_safety_rpc = 'on'
-- for the duration so the 14a guard_event_status + the B2 guard_event_triage admit the
-- legitimate change (mirror the 14a / meetings / interviews RPC pattern).
--
-- Authorization: triage is an NSP activity → save/confirm/reopen + the vocab CRUD are
-- is_pqs_member-gated (42501 otherwise). triage_disposition + the worksheet reads are
-- can_read_event-scoped (RLS). There is NO client write policy on the triage tables;
-- the DEFINER RPC is the sole write path.
--
-- Decision logic (the single SQL authority; the frontend's deriveVerdict mirrors it):
--   * Cross-field rules (save_triage): non-harmful reach (unsafe/near_miss/no_harm) →
--     harm_severity = 'none', natural_course = null; sentinel reach with harm below the
--     sentinel tier → FLOOR harm to 'severe' (KEEP a higher set value — permanent/death).
--   * sentinel_determination (app.compute_sentinel_determination): the general-criteria
--     path (reached AND severe AND natural_course = false) OR any designated flag.
--   * Disposition precedence (confirm_triage): sentinel ⇒ review_pathway = 'rca' is
--     MANDATORY and non-overridable (HC046 if an explicit non-rca pathway is given on a
--     sentinel event); a non-sentinel PSE freely chooses peer_review/mm/fmea/tracking_only.

-- ===========================================================================
-- app.compute_sentinel_determination(reach, harm, natural_course, has_designated)
-- ===========================================================================
-- The single SQL authority for the sentinel auto-compute (the SQL twin of the frontend
-- deriveVerdict isSentinel). IMMUTABLE + pgTAP-assertable per-input. reached / severe
-- mirror README_triage §1.2/§1.3.
create function app.compute_sentinel_determination(
  p_reach text,
  p_harm text,
  p_natural_course boolean,
  p_has_designated boolean
)
returns boolean
language sql
immutable
set search_path = app, pg_catalog
as $$
  select coalesce(p_has_designated, false)
    or (
      -- general-criteria path: reached the patient AND sentinel-tier harm AND
      -- unrelated to the natural course of illness (natural_course = false).
      coalesce(p_reach in ('no_harm', 'adverse', 'sentinel'), false)
      and coalesce(p_harm in ('severe', 'permanent', 'death'), false)
      and p_natural_course is false
    );
$$;

revoke all on function app.compute_sentinel_determination(text, text, boolean, boolean) from public;
grant execute on function app.compute_sentinel_determination(text, text, boolean, boolean)
  to authenticated, service_role;

-- ===========================================================================
-- save_triage(event, fields…, sentinel_criteria_ids[]) — structured upsert
-- ===========================================================================
-- is_pqs_member-gated. Requires the event be 'acknowledged' (HC045 otherwise — you
-- cannot triage a 'reported' or already-'triaged'/terminal event). Applies the
-- authoritative cross-field rules, replaces the designated-flag set (delete-then-insert
-- with a key+label snapshot), recomputes sentinel_determination, and upserts the
-- worksheet. Does NOT freeze (status stays 'acknowledged'); confirm_triage does.
create function public.save_triage(
  p_event_id uuid,
  p_is_pse boolean default null,
  p_pse_closure_reason text default null,
  p_reach text default null,
  p_harm_severity text default null,
  p_natural_course boolean default null,
  p_review_pathway text default null,
  p_disposition_notes_md text default null,
  p_sentinel_criteria_ids uuid[] default '{}'
)
returns public.event_triage
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.save_triage(uuid, boolean, text, text, text, boolean, text, text, uuid[])
  from public, anon;
grant execute on function public.save_triage(uuid, boolean, text, text, text, boolean, text, text, uuid[])
  to authenticated, service_role;

-- ===========================================================================
-- confirm_triage(event) — acknowledged -> triaged (FREEZE) + disposition + RCA shell
-- ===========================================================================
-- is_pqs_member-gated. Requires a complete worksheet (HC046). Resolves the disposition:
--   * sentinel ⇒ review_pathway = 'rca' (MANDATORY; HC046 if a non-rca pathway is set).
--   * non-sentinel PSE ⇒ keep the chosen pathway (default 'peer_review' if unset).
--   * not-a-PSE ⇒ no pathway; the event goes to 'closed' instead of 'triaged'.
-- For a 'triaged' (PSE) outcome it stamps triaged_by/at and flips the event
-- acknowledged->triaged (freezing the worksheet). For pathway = rca it mints the
-- configurable RCA due date (pqs_department.rca_default_due_days, default 45, from the
-- event's clinical date) and inserts the forward-safe rca shell (idempotent).
create function public.confirm_triage(p_event_id uuid)
returns public.event_triage
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.confirm_triage(uuid) from public, anon;
grant execute on function public.confirm_triage(uuid) to authenticated, service_role;

-- ===========================================================================
-- reopen_triage(event) — triaged -> acknowledged (unfreeze; audited)
-- ===========================================================================
-- is_pqs_member-gated. Flips the event back to 'acknowledged' (the 14a state machine
-- already permits triaged->acknowledged), which unfreezes the worksheet (guard keys on
-- the parent status). Clears triaged_by/at. The rca shell, if any, is LEFT in place
-- (re-confirming is idempotent on the unique event_id).
create function public.reopen_triage(p_event_id uuid)
returns public.event_triage
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.reopen_triage(uuid) from public, anon;
grant execute on function public.reopen_triage(uuid) to authenticated, service_role;

-- ===========================================================================
-- triage_disposition(event) — the DERIVED verdict (mirror README_triage deriveVerdict)
-- ===========================================================================
-- can_read_event-gated DEFINER read. Returns the verdict the disposition rail renders
-- (the authority; the frontend's deriveVerdict is UX-only). rca_due_date is computed
-- the same way confirm_triage mints it, so the rail can preview the date pre-confirm.
create function public.triage_disposition(p_event_id uuid)
returns table (
  event_id uuid,
  is_pse boolean,
  reached boolean,
  severe boolean,
  is_sentinel boolean,
  verdict text,
  review_pathway text,
  rca_due_date date
)
language plpgsql
stable
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.triage_disposition(uuid) from public, anon;
grant execute on function public.triage_disposition(uuid) to authenticated, service_role;

-- ===========================================================================
-- Configurable-vocab CRUD — event types + sentinel criteria (is_pqs_member-gated)
-- ===========================================================================
-- Mirror the meeting-type / case-tag vocab CRUD: is_pqs_member-gated; create appends
-- at max(position)+1; update edits label/description (key is immutable once set, like
-- a slug); reorder is a single-statement renumber against the DEFERRABLE position
-- unique; archive flips is_active (never hard-delete — events/flags reference them and
-- the flag snapshots protect the permanent record regardless).

-- ---- pqs_event_types ----
create function public.create_event_type(p_key text, p_label text, p_description text default null)
returns public.pqs_event_types
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.create_event_type(text, text, text) from public, anon;
grant execute on function public.create_event_type(text, text, text) to authenticated, service_role;

create function public.update_event_type(p_id uuid, p_label text, p_description text default null)
returns public.pqs_event_types
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.update_event_type(uuid, text, text) from public, anon;
grant execute on function public.update_event_type(uuid, text, text) to authenticated, service_role;

create function public.reorder_event_types(p_ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.reorder_event_types(uuid[]) from public, anon;
grant execute on function public.reorder_event_types(uuid[]) to authenticated, service_role;

create function public.archive_event_type(p_id uuid)
returns public.pqs_event_types
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.archive_event_type(uuid) from public, anon;
grant execute on function public.archive_event_type(uuid) to authenticated, service_role;

-- ---- pqs_sentinel_criteria ----
create function public.create_sentinel_criterion(p_key text, p_label text, p_description text default null)
returns public.pqs_sentinel_criteria
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.create_sentinel_criterion(text, text, text) from public, anon;
grant execute on function public.create_sentinel_criterion(text, text, text) to authenticated, service_role;

create function public.update_sentinel_criterion(p_id uuid, p_label text, p_description text default null)
returns public.pqs_sentinel_criteria
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.update_sentinel_criterion(uuid, text, text) from public, anon;
grant execute on function public.update_sentinel_criterion(uuid, text, text) to authenticated, service_role;

create function public.reorder_sentinel_criteria(p_ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.reorder_sentinel_criteria(uuid[]) from public, anon;
grant execute on function public.reorder_sentinel_criteria(uuid[]) to authenticated, service_role;

create function public.archive_sentinel_criterion(p_id uuid)
returns public.pqs_sentinel_criteria
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.archive_sentinel_criterion(uuid) from public, anon;
grant execute on function public.archive_sentinel_criterion(uuid) to authenticated, service_role;

-- ===========================================================================
-- set_pqs_rca_due_window(days) — edit the configurable RCA due-window (is_pqs_member)
-- ===========================================================================
-- Updates the singleton pqs_department.rca_default_due_days (the window confirm_triage
-- adds to the event date to mint an RCA due date). Validated 1–365 (HC046). Audited
-- inline (PHI-free; the value is a plain integer) — the config tables carry no AFTER
-- trigger, so we emit the row directly (global chain — NSP config is not commission-
-- scoped). Returns the new value.
create function public.set_pqs_rca_due_window(p_days integer)
returns integer
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

revoke all on function public.set_pqs_rca_due_window(integer) from public, anon;
grant execute on function public.set_pqs_rca_due_window(integer) to authenticated, service_role;

-- ===========================================================================
-- Mutation-audit trigger (Rule 11) — PHI-FREE allow-list on event_triage
-- ===========================================================================
-- AFTER INSERT/UPDATE on event_triage: diff a PHI-FREE allow-list
-- [is_pse, pse_closure_reason, reach, harm_severity, review_pathway,
--  sentinel_determination] — NEVER disposition_notes_md (free text). pse_closure_reason
-- is a BOUNDED enum, so it is audit-safe + informative (lead's call). Verbs:
-- triage.saved (INSERT / non-confirm UPDATE) / triage.confirmed (triaged_at set) /
-- triage.reopened (triaged_at cleared). The sentinel-flags table rides this diff (its
-- effect shows in sentinel_determination); it is not separately audited.
create function app.trg_audit_event_triage()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_catalog
as $$
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

create trigger audit_event_triage_trg
  after insert or update on public.event_triage
  for each row execute function app.trg_audit_event_triage();
