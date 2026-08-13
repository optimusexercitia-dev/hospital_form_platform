-- =============================================================================
-- ETH·E2 (ADR 0073 D5/D6/D7 + §2.3 reads) — BE-7 (N scan arm) + BE-8 (read projection
--   + hub/referral consumption). Window 20260817000600. Additive.
--
-- BE-7: an ethics arm on public.compute_due_notifications() (X-ζ), gated on the ethics
-- flag, following the AI·sat arm's contract shape. PHI-free: the title/body are the
-- notice TYPE / a fixed label, never the respondent. kind='ethics' + entity_type=
-- 'ethics_notification' (kind=domain / milestone=urgency — the established N convention;
-- the design's 'ethics_notice_due' string is reconciled to it).
--
-- BE-8: get_ethics_case_procedure(case) — a companion DEFINER read (can_read_case-gated,
-- no new RLS shape) returning the full procedure envelope; + two thin consumption RPCs
-- (sanctions/remediation → the action_items hub X-ε; CRM/CFM → the ADR-0037 referral X-§D7).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- BE-7.1 — widen N's domains for the ethics arm (N owns the CHECKs; E2 names its values).
-- -----------------------------------------------------------------------------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array['capa','signoff','meeting','action_item','ethics']));
alter table public.notifications drop constraint notifications_entity_type_check;
alter table public.notifications add constraint notifications_entity_type_check
  check (entity_type = any (array['capa_action','response_section_signoff','meeting','action_item','ethics_notification']));

-- -----------------------------------------------------------------------------
-- BE-7.2 — the coordinator-fallback recipient helper (a staff_admin of the case's
-- commission), for a notice with no platform-user recipient (a médico denunciado
-- notified by letter routes the reminder to the coordinator chasing the prazo).
-- -----------------------------------------------------------------------------
create or replace function app.commission_staff_admin_of_case(p_case_id uuid)
  returns uuid language sql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select m.principal_id
  from public.memberships m
  where m.commission_id = app.commission_of_case(p_case_id)
    and m.role = 'staff_admin'
    and (m.expires_at is null or m.expires_at > now())
  order by m.granted_at nulls last
  limit 1;
$$;
alter function app.commission_staff_admin_of_case(uuid) owner to postgres;
revoke all on function app.commission_staff_admin_of_case(uuid) from public;
grant execute on function app.commission_staff_admin_of_case(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- BE-7.3 — a standalone, idempotent ethics scan arm. Kept in its OWN DEFINER function
-- (invoked by compute_due_notifications via a wrapper below) so the arm can be unit-
-- tested + mutated in isolation. Returns the count enqueued.
-- -----------------------------------------------------------------------------
create or replace function app.compute_due_ethics_notifications()
  returns integer language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_count int := 0; v_ok boolean; r record;
begin
  if not app.feature_enabled('ethics') then return 0; end if;

  -- (a) ethics_notifications due today (the prazo de defesa / response window).
  for r in
    select n.id as notification_id, n.case_id, n.notification_type,
           coalesce(n.recipient_user_id, app.commission_staff_admin_of_case(n.case_id)) as recipient,
           app.commission_of_case(n.case_id) as commission_id
    from public.ethics_notifications n
    where n.due_at is not null
      and n.status in ('sent','pending')
      and n.acknowledged_at is null
      and n.due_at::date = current_date
  loop
    continue when r.recipient is null;
    v_ok := app.enqueue_notification(
      r.recipient, r.commission_id, 'ethics', 'due_soon', true,
      'ethics_notification', r.case_id, 'Prazo de notificação ética', r.notification_type,
      'ethics_notif:' || r.notification_id || ':due:' || current_date);
    if v_ok then v_count := v_count + 1; end if;
  end loop;

  -- (b) appeal deadlines due today.
  for r in
    select dd.decision_id, dd.case_id,
           app.commission_staff_admin_of_case(dd.case_id) as recipient,
           app.commission_of_case(dd.case_id) as commission_id
    from public.ethics_decision_details dd
    where dd.appeal_allowed and dd.appeal_deadline is not null
      and dd.appeal_deadline::date = current_date
  loop
    continue when r.recipient is null;
    v_ok := app.enqueue_notification(
      r.recipient, r.commission_id, 'ethics', 'due_soon', true,
      'ethics_notification', r.case_id, 'Prazo de recurso', 'Prazo de recurso',
      'ethics_appeal:' || r.decision_id || ':due:' || current_date);
    if v_ok then v_count := v_count + 1; end if;
  end loop;

  -- (c) external-reporting (CRM/CFM) deadlines due today.
  for r in
    select dd.decision_id, dd.case_id,
           app.commission_staff_admin_of_case(dd.case_id) as recipient,
           app.commission_of_case(dd.case_id) as commission_id
    from public.ethics_decision_details dd
    where dd.external_reporting_required and dd.external_reporting_deadline is not null
      and dd.external_reporting_completed_at is null
      and dd.external_reporting_deadline::date = current_date
  loop
    continue when r.recipient is null;
    v_ok := app.enqueue_notification(
      r.recipient, r.commission_id, 'ethics', 'due_soon', true,
      'ethics_notification', r.case_id, 'Prazo de comunicação externa', 'Prazo de comunicação externa',
      'ethics_report:' || r.decision_id || ':due:' || current_date);
    if v_ok then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end;
$$;
alter function app.compute_due_ethics_notifications() owner to postgres;
revoke all on function app.compute_due_ethics_notifications() from public;
grant execute on function app.compute_due_ethics_notifications() to authenticated, service_role;

-- Wrap the ethics arm into the engine. compute_due_notifications' body is unchanged;
-- we add ONE additive call at the tail via a re-emit that appends the ethics arm. To
-- avoid re-transcribing the large shipped body (drift risk), we instead register the arm
-- through a thin AFTER hook: replace the engine so it calls the shipped logic plus ours.
-- The shipped function returns its own count; the wrapper below re-declares it verbatim
-- EXCEPT for the final `return`, which now folds in the ethics arm's count.
create or replace function public.compute_due_notifications()
  returns integer language plpgsql security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare
  v_count integer := 0;
  v_ok boolean;
  v_week text;
  r record;
  v_signers uuid[];
  v_signer uuid;
  v_first_requested timestamptz;
begin
  if not app.feature_enabled('notifications') then
    return 0;
  end if;

  v_week := to_char(now(), 'IYYY"-W"IW');

  -- ---- CAPA: due_soon / overdue / weekly still_open ----
  for r in
    select ca.id, ca.assignee_user_id, ca.title, ca.due_date
    from public.capa_action ca
    where ca.assignee_user_id is not null
      and ca.status in ('pending', 'in_progress')
      and ca.due_date is not null
  loop
    if r.due_date < current_date then
      v_ok := app.enqueue_notification(
        r.assignee_user_id, null, 'capa', 'overdue', true, 'capa_action', r.id,
        'Ação CAPA atrasada', r.title, 'capa:' || r.id || ':overdue'
      );
      if v_ok then v_count := v_count + 1; end if;
      v_ok := app.enqueue_notification(
        r.assignee_user_id, null, 'capa', 'still_open', true, 'capa_action', r.id,
        'Ação CAPA ainda em aberto', r.title, 'capa:' || r.id || ':still_open:' || v_week
      );
      if v_ok then v_count := v_count + 1; end if;
    elsif r.due_date <= current_date + 3 then
      v_ok := app.enqueue_notification(
        r.assignee_user_id, null, 'capa', 'due_soon', true, 'capa_action', r.id,
        'Ação CAPA vence em breve', r.title, 'capa:' || r.id || ':due_soon'
      );
      if v_ok then v_count := v_count + 1; end if;
    end if;
  end loop;

  -- ---- Sign-off: pending / weekly still_open (staff_admin sections) ----
  for r in
    with candidate as (
      select c.id as response_id, c.commission_id, c.form_version_id,
             app.answer_map(c.id) as answers
      from public.responses c
      where c.status = 'in_progress'
        and app.response_required_complete(c.id)
    )
    select distinct cd.response_id, cd.commission_id
    from candidate cd
    join public.form_sections s
      on s.form_version_id = cd.form_version_id
     and s.requires_signoff = true
     and s.signoff_role = 'staff_admin'
    where app.eval_condition(s.visible_when, cd.answers)
      and not exists (
        select 1 from public.response_section_signoffs so
        where so.response_id = cd.response_id and so.section_id = s.id
      )
  loop
    select min(created_at) into v_first_requested
    from public.notifications
    where entity_type = 'response_section_signoff'
      and entity_id = r.response_id
      and milestone = 'requested';

    if v_first_requested is not null and now() - v_first_requested >= interval '3 days' then
      select coalesce(array_agg(principal_id), '{}'::uuid[]) into v_signers
      from public.memberships
      where commission_id = r.commission_id and role = 'staff_admin';

      foreach v_signer in array v_signers
      loop
        v_ok := app.enqueue_notification(
          v_signer, r.commission_id, 'signoff', 'pending', true,
          'response_section_signoff', r.response_id,
          'Assinatura pendente', null, 'signoff:' || r.response_id || ':pending'
        );
        if v_ok then v_count := v_count + 1; end if;
        v_ok := app.enqueue_notification(
          v_signer, r.commission_id, 'signoff', 'still_open', true,
          'response_section_signoff', r.response_id,
          'Assinatura ainda pendente', null, 'signoff:' || r.response_id || ':still_open:' || v_week
        );
        if v_ok then v_count := v_count + 1; end if;
      end loop;
    end if;
  end loop;

  -- ---- Meeting: upcoming (scheduled for tomorrow) ----
  for r in
    select m.id, m.commission_id, m.title, ma.user_id
    from public.meetings m
    join public.meeting_attendees ma on ma.meeting_id = m.id
    where m.status = 'scheduled'
      and m.scheduled_start::date = current_date + 1
      and ma.user_id is not null
      and ma.attendance <> 'excused'
  loop
    v_ok := app.enqueue_notification(
      r.user_id, r.commission_id, 'meeting', 'upcoming', true, 'meeting', r.id,
      'Reunião amanhã', r.title, 'meeting:' || r.id || ':upcoming'
    );
    if v_ok then v_count := v_count + 1; end if;
  end loop;

  -- ---- Action item: due_soon / overdue (AI·sat × S1·N, X-ζ) ----
  if app.feature_enabled('action_items') then
    for r in
      select
        a.id as item_id, a.commission_id as commission_id, a.title as item_title,
        coalesce(
          a.assigned_to,
          (select ja.user_id from public.action_item_assignments ja
             where ja.action_item_id = a.id and ja.role = 'owner' and ja.completed_at is null limit 1)
        ) as recipient,
        case when rem.reminder_type in ('before_due', 'on_due') then 'due_soon' else 'overdue' end as milestone,
        case when rem.reminder_type in ('before_due', 'on_due')
             then 'Item de ação vence em breve' else 'Item de ação atrasado' end as heading
      from public.action_item_reminders rem
      join public.action_items a on a.id = rem.action_item_id
      join public.action_item_statuses st on st.id = a.status_id and st.is_terminal = false
      where rem.is_active = true
        and a.due_date is not null
        and (
          (rem.reminder_type = 'before_due' and a.due_date = current_date + rem.offset_days)
          or (rem.reminder_type = 'on_due'  and a.due_date = current_date)
          or (rem.reminder_type = 'after_due' and a.due_date = current_date - rem.offset_days)
        )
    loop
      continue when r.recipient is null;
      continue when not app.can_read_action_item(r.item_id, r.recipient);
      v_ok := app.enqueue_notification(
        r.recipient, r.commission_id, 'action_item', r.milestone, true,
        'action_item', r.item_id, r.heading, r.item_title,
        'action_item:' || r.item_id || ':' || r.milestone || ':' || current_date
      );
      if v_ok then v_count := v_count + 1; end if;
    end loop;
  end if;

  -- ---- Ethics: notice / appeal / external-reporting deadlines (ETH·E2 X-ζ, ADR 0073 D5) ----
  v_count := v_count + app.compute_due_ethics_notifications();

  return v_count;
end;
$$;
alter function public.compute_due_notifications() owner to postgres;

-- =============================================================================
-- BE-8.1 — get_ethics_case_procedure: the companion read projection (can_read_case-gated).
-- =============================================================================
create or replace function public.get_ethics_case_procedure(p_case_id uuid)
  returns jsonb language plpgsql stable security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_result jsonb;
begin
  if not app.feature_enabled('ethics') then return null; end if;
  if not app.can_read_case(p_case_id, auth.uid()) then return null; end if;
  if not exists (select 1 from public.ethics_case_details d where d.case_id = p_case_id) then
    return null;
  end if;

  select jsonb_build_object(
    'caseId', p_case_id,
    'details', (
      select jsonb_build_object(
        'caseId', d.case_id, 'admissibilityStatus', d.admissibility_status,
        'admissibilityDecidedAt', d.admissibility_decided_at, 'admissibilityDecidedBy', d.admissibility_decided_by,
        'admissibilityRationaleMd', d.admissibility_rationale_md, 'complaintChannel', d.complaint_channel,
        'complaintReceivedAt', d.complaint_received_at, 'summaryMd', d.summary_md,
        'createdAt', d.created_at, 'updatedAt', d.updated_at)
      from public.ethics_case_details d where d.case_id = p_case_id),
    'allegations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'caseId', a.case_id, 'allegationCategoryId', a.allegation_category_id,
        'category', (select jsonb_build_object('id', c.id, 'organizationId', c.organization_id,
                       'key', c.key, 'displayName', c.display_name, 'isActive', c.is_active, 'position', c.position)
                     from public.ethics_allegation_categories c where c.id = a.allegation_category_id),
        'descriptionMd', a.description_md, 'allegedEventDate', a.alleged_event_date,
        'severity', a.severity, 'status', a.status, 'createdBy', a.created_by,
        'createdAt', a.created_at, 'updatedAt', a.updated_at,
        'finding', (select jsonb_build_object('id', f.id, 'allegationId', f.allegation_id, 'caseId', f.case_id,
                      'finding', f.finding, 'rationaleMd', f.rationale_md, 'evidenceSummaryMd', f.evidence_summary_md,
                      'decidedBy', f.decided_by, 'decidedAt', f.decided_at, 'createdAt', f.created_at, 'updatedAt', f.updated_at)
                    from public.ethics_findings f where f.allegation_id = a.id))
        order by a.created_at)
      from public.ethics_allegations a where a.case_id = p_case_id), '[]'::jsonb),
    'decisions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', dec.id, 'caseId', dec.case_id, 'decisionType', dec.decision_type,
        'summaryMd', dec.summary_md, 'rationaleMd', dec.rationale_md, 'status', dec.status,
        'decidedAt', dec.decided_at, 'decidedBy', dec.decided_by,
        'createdAt', dec.created_at, 'updatedAt', dec.updated_at,
        'details', (select jsonb_build_object(
            'decisionId', dd.decision_id, 'sanctionTypeId', dd.sanction_type_id,
            'sanctionType', (select jsonb_build_object('id', s.id, 'organizationId', s.organization_id,
                               'key', s.key, 'displayName', s.display_name, 'isActive', s.is_active, 'position', s.position)
                             from public.ethics_sanction_types s where s.id = dd.sanction_type_id),
            'sanctionStartDate', dd.sanction_start_date, 'sanctionEndDate', dd.sanction_end_date,
            'remediationRequired', dd.remediation_required, 'remediationDescriptionMd', dd.remediation_description_md,
            'externalReportingRequired', dd.external_reporting_required, 'externalReportingTarget', dd.external_reporting_target,
            'externalReportingReferralId', dd.external_reporting_referral_id,
            'externalReportingDeadline', dd.external_reporting_deadline, 'externalReportingCompletedAt', dd.external_reporting_completed_at,
            'appealAllowed', dd.appeal_allowed, 'appealDeadline', dd.appeal_deadline,
            'decisionLetterDocumentId', dd.decision_letter_document_id,
            'createdAt', dd.created_at, 'updatedAt', dd.updated_at)
          from public.ethics_decision_details dd where dd.decision_id = dec.id),
        'eligibleVoterCount', (select count(*)::int from app.eligible_voters(p_case_id)),
        'castVoteCount', (select count(*)::int from public.case_votes v where v.decision_id = dec.id),
        'myVote', (select jsonb_build_object('id', v.id, 'caseId', v.case_id, 'decisionId', v.decision_id,
                     'meetingId', v.meeting_id, 'voterId', v.voter_id, 'vote', v.vote,
                     'rationaleMd', v.rationale_md, 'votedAt', v.voted_at)
                   from public.case_votes v where v.decision_id = dec.id and v.voter_id = auth.uid()))
        order by dec.created_at)
      from public.case_decisions dec where dec.case_id = p_case_id), '[]'::jsonb),
    'hearings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id, 'caseId', h.case_id, 'meetingId', h.meeting_id, 'hearingType', h.hearing_type,
        'scheduledAt', h.scheduled_at, 'completedAt', h.completed_at,
        'respondentPresent', h.respondent_present, 'complainantPresent', h.complainant_present,
        'legalRepresentativePresent', h.legal_representative_present,
        'summaryMd', h.summary_md, 'outcomeMd', h.outcome_md, 'createdBy', h.created_by,
        'createdAt', h.created_at, 'updatedAt', h.updated_at)
        order by h.created_at)
      from public.ethics_hearings h where h.case_id = p_case_id), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'caseId', n.case_id, 'recipientParticipantId', n.recipient_participant_id,
        'recipientUserId', n.recipient_user_id, 'notificationType', n.notification_type,
        'deliveryMethod', n.delivery_method, 'status', n.status, 'sentAt', n.sent_at,
        'acknowledgedAt', n.acknowledged_at, 'dueAt', n.due_at, 'relatedDocumentId', n.related_document_id,
        'notesMd', n.notes_md, 'createdBy', n.created_by, 'createdAt', n.created_at, 'updatedAt', n.updated_at)
        order by n.created_at)
      from public.ethics_notifications n where n.case_id = p_case_id), '[]'::jsonb),
    'appeals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ap.id, 'caseId', ap.case_id, 'decisionId', ap.decision_id,
        'submittedByParticipantId', ap.submitted_by_participant_id, 'submittedAt', ap.submitted_at,
        'appealReasonMd', ap.appeal_reason_md, 'status', ap.status, 'reviewedBy', ap.reviewed_by,
        'reviewedAt', ap.reviewed_at, 'outcome', ap.outcome, 'outcomeRationaleMd', ap.outcome_rationale_md,
        'createdAt', ap.created_at, 'updatedAt', ap.updated_at)
        order by ap.created_at)
      from public.ethics_appeals ap where ap.case_id = p_case_id), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
alter function public.get_ethics_case_procedure(uuid) owner to postgres;
revoke all on function public.get_ethics_case_procedure(uuid) from public;
grant execute on function public.get_ethics_case_procedure(uuid) to authenticated, service_role;

-- =============================================================================
-- BE-8.2 — hub/referral consumption (thin wrappers; no hub/referral schema change).
-- =============================================================================
-- Sanctions/remediation ride the action_items hub (X-ε): source_type='case',
-- case_restricted visibility (create_committee_action_item forces it for a case source).
create or replace function public.assign_ethics_remediation(
  p_decision_id uuid, p_title text, p_description text default null,
  p_assigned_to uuid default null, p_due_date date default null
) returns uuid
  language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_case_id uuid; v_commission uuid; v_id uuid;
begin
  perform app.assert_ethics_enabled();
  select case_id into v_case_id from public.case_decisions where id = p_decision_id;
  if v_case_id is null then raise exception 'decisão não encontrada' using errcode = 'P0002'; end if;
  v_commission := app.assert_ethics_coordinator(v_case_id);   -- HC0J1
  v_id := public.create_committee_action_item(
    v_commission, 'case', null, null, v_case_id, p_title, p_description,
    p_assigned_to, null, p_due_date, null, 'case_restricted');
  perform app.audit_write('ethics.remediation_assigned', 'case', v_case_id, v_commission,
    'Ação de remediação criada', jsonb_build_object('decision_id', p_decision_id, 'action_item_id', v_id));
  return v_id;
end;
$$;
alter function public.assign_ethics_remediation(uuid, text, text, uuid, date) owner to postgres;
revoke all on function public.assign_ethics_remediation(uuid, text, text, uuid, date) from public;
grant execute on function public.assign_ethics_remediation(uuid, text, text, uuid, date) to authenticated, service_role;

-- CRM/CFM/legal hand-off reuses the ADR-0037 referral (§D7): open a draft + pin it.
create or replace function public.open_ethics_external_referral(
  p_decision_id uuid, p_target_commission_id uuid, p_referral_type_id uuid,
  p_subject text, p_description_md text
) returns uuid
  language plpgsql security definer set search_path to 'app', 'public', 'pg_catalog'
as $$
declare v_case_id uuid; v_commission uuid; v_referral_id uuid;
begin
  perform app.assert_ethics_enabled();
  select case_id into v_case_id from public.case_decisions where id = p_decision_id;
  if v_case_id is null then raise exception 'decisão não encontrada' using errcode = 'P0002'; end if;
  v_commission := app.assert_ethics_coordinator(v_case_id);   -- HC0J1
  v_referral_id := public.create_referral_draft(
    v_case_id, p_target_commission_id, p_referral_type_id, p_subject, true, p_description_md);
  update public.ethics_decision_details
    set external_reporting_referral_id = v_referral_id, updated_at = now()
  where decision_id = p_decision_id;
  perform app.audit_write('ethics.external_referral_opened', 'case', v_case_id, v_commission,
    'Encaminhamento externo aberto', jsonb_build_object('decision_id', p_decision_id, 'referral_id', v_referral_id));
  return v_referral_id;
end;
$$;
alter function public.open_ethics_external_referral(uuid, uuid, uuid, text, text) owner to postgres;
revoke all on function public.open_ethics_external_referral(uuid, uuid, uuid, text, text) from public;
grant execute on function public.open_ethics_external_referral(uuid, uuid, uuid, text, text) to authenticated, service_role;
