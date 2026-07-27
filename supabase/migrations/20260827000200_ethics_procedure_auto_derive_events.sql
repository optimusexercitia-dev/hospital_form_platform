-- =============================================================================
-- ETH·E3a BE-5 — O-3 auto-derive: each of the 8 ethics procedure RPCs ALSO inserts
-- one case_events row on the matching procedural kind (plan §2.1 / O-3; ADR 0073).
--
-- Rule-12 crux. Each insert is spliced INSIDE the DEFINER body, immediately BEFORE the
-- (single) app.audit_write call — which already runs AFTER the milestone write — so a
-- failed / rolled-back / unauthorized milestone emits ZERO events (one transaction).
-- Bodies are FIXED pt-BR templates over controlled enum values / catalog display_name
-- only: no free-text *_md arg, no finding/vote value, no voter, no rationale, no
-- recipient identity. finding_recorded + vote_cast = coordinator_only; the rest =
-- case_readers. can_read_case stays the RLS floor (respondent/recused see none).
--
-- Catalog-truth rewrite: each RPC's CURRENT body is pulled from pg_get_functiondef,
-- the insert is spliced before the audit_write anchor (guarded — raises on drift), and
-- re-emitted. Body-only edits (no signature change) → grants preserved (all 8 already
-- carry authenticated + service_role; verified), so no t19 re-grant.
--
-- decision_issued's body is FIXED "Decisão emitida" WITHOUT the decision_type: that
-- column is uncontrolled free text (create_case_decision does not validate it against a
-- set), so per hard-req-2 it is excluded rather than interpolated raw.
-- =============================================================================

-- 1) decide_admissibility → admissibility_decided (case_readers; case_id = p_case_id)
do $mig$
declare
  v_def text := pg_get_functiondef('public.decide_admissibility(uuid,text,text)'::regprocedure);
  v_anchor text := $q$perform app.audit_write('ethics.admissibility_decided'$q$;
  v_insert text := $q$insert into public.case_events (case_id, kind, title, body, visibility, occurred_at, created_by)
  values (p_case_id, 'admissibility_decided', null,
          'Admissibilidade decidida: ' || (case p_status
            when 'admissible' then 'Admissível' when 'inadmissible' then 'Inadmissível'
            when 'pending' then 'Pendente' else p_status end),
          'case_readers', current_date, auth.uid());
  $q$;
begin
  if position(v_anchor in v_def) = 0 then raise exception 'decide_admissibility anchor drift'; end if;
  execute replace(v_def, v_anchor, v_insert || v_anchor);
end;
$mig$;

-- 2) add_ethics_allegation → allegation_added (case_readers; case_id = p_case_id)
do $mig$
declare
  v_def text := pg_get_functiondef('public.add_ethics_allegation(uuid,uuid,text,text,date)'::regprocedure);
  v_anchor text := $q$perform app.audit_write('ethics.allegation_added'$q$;
  v_insert text := $q$insert into public.case_events (case_id, kind, title, body, visibility, occurred_at, created_by)
  values (p_case_id, 'allegation_added', null,
          'Nova alegação registrada (categoria: '
            || (select display_name from public.ethics_allegation_categories where id = p_category_id) || ')',
          'case_readers', current_date, auth.uid());
  $q$;
begin
  if position(v_anchor in v_def) = 0 then raise exception 'add_ethics_allegation anchor drift'; end if;
  execute replace(v_def, v_anchor, v_insert || v_anchor);
end;
$mig$;

-- 3) record_ethics_finding → finding_recorded (COORDINATOR_ONLY; case_id = v_case_id)
do $mig$
declare
  v_def text := pg_get_functiondef('public.record_ethics_finding(uuid,text,text,text)'::regprocedure);
  v_anchor text := $q$perform app.audit_write('ethics.finding_recorded'$q$;
  v_insert text := $q$insert into public.case_events (case_id, kind, title, body, visibility, occurred_at, created_by)
  values (v_case_id, 'finding_recorded', null,
          'Parecer de alegação registrado',
          'coordinator_only', current_date, auth.uid());
  $q$;
begin
  if position(v_anchor in v_def) = 0 then raise exception 'record_ethics_finding anchor drift'; end if;
  execute replace(v_def, v_anchor, v_insert || v_anchor);
end;
$mig$;

-- 4) issue_ethics_notification → notification_issued (case_readers; case_id = p_case_id)
do $mig$
declare
  v_def text := pg_get_functiondef('public.issue_ethics_notification(uuid,text,text,uuid,uuid,timestamptz,uuid,text)'::regprocedure);
  v_anchor text := $q$perform app.audit_write('ethics.notification_issued'$q$;
  v_insert text := $q$insert into public.case_events (case_id, kind, title, body, visibility, occurred_at, created_by)
  values (p_case_id, 'notification_issued', null,
          'Notificação emitida: ' || (case p_notification_type
              when 'complaint_acknowledgement' then 'Ciência de denúncia'
              when 'respondent_notification' then 'Notificação ao denunciado'
              when 'request_for_response' then 'Solicitação de defesa'
              when 'hearing_notice' then 'Convocação para audiência'
              when 'decision_notice' then 'Notificação de decisão'
              when 'appeal_notice' then 'Notificação de recurso'
              when 'external_reporting_notice' then 'Comunicação a órgão externo'
              else 'Outro' end)
            || ' (' || (case p_delivery_method
              when 'email' then 'e-mail' when 'letter' then 'carta'
              when 'in_person' then 'presencial' when 'system' then 'sistema'
              when 'phone' then 'telefone' else 'outro' end) || ')',
          'case_readers', current_date, auth.uid());
  $q$;
begin
  if position(v_anchor in v_def) = 0 then raise exception 'issue_ethics_notification anchor drift'; end if;
  execute replace(v_def, v_anchor, v_insert || v_anchor);
end;
$mig$;

-- 5) schedule_ethics_hearing → hearing_scheduled (case_readers; case_id = p_case_id)
do $mig$
declare
  v_def text := pg_get_functiondef('public.schedule_ethics_hearing(uuid,text,uuid,timestamptz)'::regprocedure);
  v_anchor text := $q$perform app.audit_write('ethics.hearing_scheduled'$q$;
  v_insert text := $q$insert into public.case_events (case_id, kind, title, body, visibility, occurred_at, created_by)
  values (p_case_id, 'hearing_scheduled', null,
          'Audiência agendada: ' || (case p_hearing_type
              when 'initial_hearing' then 'Audiência inicial'
              when 'evidence_hearing' then 'Instrução'
              when 'deliberation_hearing' then 'Deliberação'
              when 'appeal_hearing' then 'Audiência de recurso'
              else 'Outra' end)
            || ' — ' || to_char(coalesce(p_scheduled_at, now()), 'DD/MM/YYYY'),
          'case_readers', current_date, auth.uid());
  $q$;
begin
  if position(v_anchor in v_def) = 0 then raise exception 'schedule_ethics_hearing anchor drift'; end if;
  execute replace(v_def, v_anchor, v_insert || v_anchor);
end;
$mig$;

-- 6) cast_case_vote → vote_cast (COORDINATOR_ONLY; case_id = v_case_id)
do $mig$
declare
  v_def text := pg_get_functiondef('public.cast_case_vote(uuid,text,text)'::regprocedure);
  v_anchor text := $q$perform app.audit_write('case.vote_cast'$q$;
  v_insert text := $q$insert into public.case_events (case_id, kind, title, body, visibility, occurred_at, created_by)
  values (v_case_id, 'vote_cast', null,
          'Voto registrado',
          'coordinator_only', current_date, auth.uid());
  $q$;
begin
  if position(v_anchor in v_def) = 0 then raise exception 'cast_case_vote anchor drift'; end if;
  execute replace(v_def, v_anchor, v_insert || v_anchor);
end;
$mig$;

-- 7) issue_decision → decision_issued (case_readers; case_id = v_case_id)
do $mig$
declare
  v_def text := pg_get_functiondef('public.issue_decision(uuid)'::regprocedure);
  v_anchor text := $q$perform app.audit_write('case.decision_issued'$q$;
  v_insert text := $q$insert into public.case_events (case_id, kind, title, body, visibility, occurred_at, created_by)
  values (v_case_id, 'decision_issued', null,
          'Decisão emitida',
          'case_readers', current_date, auth.uid());
  $q$;
begin
  if position(v_anchor in v_def) = 0 then raise exception 'issue_decision anchor drift'; end if;
  execute replace(v_def, v_anchor, v_insert || v_anchor);
end;
$mig$;

-- 8) submit_ethics_appeal → appeal_submitted (case_readers; case_id = p_case_id)
do $mig$
declare
  v_def text := pg_get_functiondef('public.submit_ethics_appeal(uuid,uuid,text,uuid)'::regprocedure);
  v_anchor text := $q$perform app.audit_write('case.appeal_submitted'$q$;
  v_insert text := $q$insert into public.case_events (case_id, kind, title, body, visibility, occurred_at, created_by)
  values (p_case_id, 'appeal_submitted', null,
          'Recurso interposto',
          'case_readers', current_date, auth.uid());
  $q$;
begin
  if position(v_anchor in v_def) = 0 then raise exception 'submit_ethics_appeal anchor drift'; end if;
  execute replace(v_def, v_anchor, v_insert || v_anchor);
end;
$mig$;
