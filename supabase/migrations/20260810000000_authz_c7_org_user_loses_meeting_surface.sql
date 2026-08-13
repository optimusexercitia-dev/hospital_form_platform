-- ============================================================================
-- ADR 0078 Gate 2 · Stage C · C7 — Organization Users lose the meeting +
-- action-item content surface. Plan lines 437–472, Amendment 2 (A8–A11).
--
-- Removes ONLY the app.is_commission_admin_of arm from the meeting record and its
-- adjacent action-item channel. Every other arm (member, staff_admin, member_can,
-- the case-half, the exclusion term, the is_active gate) is preserved verbatim.
--
-- ⛔ THE KEEP SET IS UNTOUCHED (K20 fails if the negatives over-reach): an
-- Organization User still configures a commission (commission_meeting_types /
-- commission_meeting_settings), disposes minutes (dispose_meeting_minutes), reads
-- audit_log, and administers case access (list_case_access / grant_member_capability).
--
-- ⚠ K27 (exclusion) and K28 (is_active) on the action-item channel are ALREADY
-- LIVE (Wave-1 finding) — preserved here as regression pins, NOT re-added.
-- ⚠ can_read_case_or_admin is a STALE NAME (A4 dissolved its own org arm; the
-- case-half already equals can_read_case) — NOT touched; G1 retires the name.
--
-- Quals/bodies copied from the live catalog (pg_policies / pg_get_functiondef),
-- not migration text. LOCAL ONLY.
-- ============================================================================

-- ============================================================================
-- 1. MEETING RECORD — the five *_select policies + the C8-split write policies.
-- ============================================================================

-- meetings ------------------------------------------------------------------
drop policy if exists meetings_select on public.meetings;
create policy meetings_select on public.meetings
  for select to authenticated
  using (
    app.is_member_of(commission_id)
    and (visibility_policy = 'commission_default'
         or exists (select 1 from public.meeting_attendees a
                    where a.meeting_id = meetings.id and a.user_id = (select auth.uid())))
  );

drop policy if exists meetings_staff_admin_insert on public.meetings;
create policy meetings_staff_admin_insert on public.meetings
  for insert to authenticated
  with check (app.is_staff_admin_of(commission_id)
              or app.member_can(commission_id, 'schedule_meetings'));
drop policy if exists meetings_staff_admin_update on public.meetings;
create policy meetings_staff_admin_update on public.meetings
  for update to authenticated
  using (app.is_staff_admin_of(commission_id)
         or app.member_can(commission_id, 'schedule_meetings'))
  with check (app.is_staff_admin_of(commission_id)
              or app.member_can(commission_id, 'schedule_meetings'));
drop policy if exists meetings_staff_admin_delete on public.meetings;
create policy meetings_staff_admin_delete on public.meetings
  for delete to authenticated
  using (app.is_staff_admin_of(commission_id)
         or app.member_can(commission_id, 'schedule_meetings'));

-- meeting_agenda_items ------------------------------------------------------
drop policy if exists meeting_agenda_items_select on public.meeting_agenda_items;
create policy meeting_agenda_items_select on public.meeting_agenda_items
  for select to authenticated
  using (app.can_reach_meeting(meeting_id, (select auth.uid())));

drop policy if exists meeting_agenda_items_staff_admin_insert on public.meeting_agenda_items;
create policy meeting_agenda_items_staff_admin_insert on public.meeting_agenda_items
  for insert to authenticated
  with check (app.is_staff_admin_of(app.commission_of_meeting(meeting_id)));
drop policy if exists meeting_agenda_items_staff_admin_update on public.meeting_agenda_items;
create policy meeting_agenda_items_staff_admin_update on public.meeting_agenda_items
  for update to authenticated
  using (app.is_staff_admin_of(app.commission_of_meeting(meeting_id)))
  with check (app.is_staff_admin_of(app.commission_of_meeting(meeting_id)));
drop policy if exists meeting_agenda_items_staff_admin_delete on public.meeting_agenda_items;
create policy meeting_agenda_items_staff_admin_delete on public.meeting_agenda_items
  for delete to authenticated
  using (app.is_staff_admin_of(app.commission_of_meeting(meeting_id)));

-- meeting_attendees ---------------------------------------------------------
drop policy if exists meeting_attendees_select on public.meeting_attendees;
create policy meeting_attendees_select on public.meeting_attendees
  for select to authenticated
  using (app.can_reach_meeting(meeting_id, (select auth.uid())));

drop policy if exists meeting_attendees_staff_admin_insert on public.meeting_attendees;
create policy meeting_attendees_staff_admin_insert on public.meeting_attendees
  for insert to authenticated
  with check (app.is_staff_admin_of(app.commission_of_meeting(meeting_id)));
drop policy if exists meeting_attendees_staff_admin_update on public.meeting_attendees;
create policy meeting_attendees_staff_admin_update on public.meeting_attendees
  for update to authenticated
  using (app.is_staff_admin_of(app.commission_of_meeting(meeting_id)))
  with check (app.is_staff_admin_of(app.commission_of_meeting(meeting_id)));
drop policy if exists meeting_attendees_staff_admin_delete on public.meeting_attendees;
create policy meeting_attendees_staff_admin_delete on public.meeting_attendees
  for delete to authenticated
  using (app.is_staff_admin_of(app.commission_of_meeting(meeting_id)));

-- meeting_cases (authority-half arm only; the case-half stays) ---------------
drop policy if exists meeting_cases_select on public.meeting_cases;
create policy meeting_cases_select on public.meeting_cases
  for select to authenticated
  using (app.can_reach_meeting(meeting_id, (select auth.uid())));

drop policy if exists meeting_cases_staff_admin_insert on public.meeting_cases;
create policy meeting_cases_staff_admin_insert on public.meeting_cases
  for insert to authenticated
  with check (app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
              and app.can_read_case_or_admin(case_id, auth.uid()));
drop policy if exists meeting_cases_staff_admin_update on public.meeting_cases;
create policy meeting_cases_staff_admin_update on public.meeting_cases
  for update to authenticated
  using (app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
         and app.can_read_case_or_admin(case_id, auth.uid()))
  with check (app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
              and app.can_read_case_or_admin(case_id, auth.uid()));
drop policy if exists meeting_cases_staff_admin_delete on public.meeting_cases;
create policy meeting_cases_staff_admin_delete on public.meeting_cases
  for delete to authenticated
  using (app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
         and app.can_read_case_or_admin(case_id, auth.uid()));

-- meeting_signatures --------------------------------------------------------
drop policy if exists meeting_signatures_select on public.meeting_signatures;
create policy meeting_signatures_select on public.meeting_signatures
  for select to authenticated
  using (app.can_reach_meeting(meeting_id, (select auth.uid())));

-- ============================================================================
-- 2. STORAGE — meeting-attachments bucket policies.
-- ============================================================================
drop policy if exists meeting_attachments_select_member on storage.objects;
create policy meeting_attachments_select_member on storage.objects
  for select to authenticated
  using (bucket_id = 'meeting-attachments'
         and app.is_member_of(((storage.foldername(name))[1])::uuid));

drop policy if exists meeting_attachments_insert_staff_admin on storage.objects;
create policy meeting_attachments_insert_staff_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'meeting-attachments'
              and app.is_staff_admin_of(((storage.foldername(name))[1])::uuid));

-- ============================================================================
-- 3. FUNCTIONS — re-emitted from live pg_get_functiondef, org arm removed only.
-- ============================================================================

-- assert_meeting_staff_admin (INVOKER) — conclude/reopen/schedule lose the arm.
create or replace function app.assert_meeting_staff_admin(p_meeting_id uuid)
returns uuid language plpgsql stable set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission_id uuid;
begin
  v_commission_id := app.commission_of_meeting(p_meeting_id);
  if v_commission_id is null then
    raise exception 'reunião % não encontrada', p_meeting_id using errcode = 'no_data_found';
  end if;
  if not app.is_staff_admin_of(v_commission_id) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  return v_commission_id;
end;
$function$;

-- can_read_attachment — the 'meeting' arm loses the org arm (reverses D4·2).
create or replace function app.can_read_attachment(p_owner_type text, p_owner_id uuid, p_uid uuid)
returns boolean language plpgsql stable security definer set search_path to 'app', 'public', 'pg_catalog'
as $function$
begin
  if p_uid is null then
    return false;
  end if;
  return case p_owner_type
    when 'case' then
      app.can_read_case(p_owner_id, p_uid)
    when 'meeting' then
      app.is_member_of_for(app.commission_of_meeting(p_owner_id), p_uid)   -- C7: org arm removed (A8)
    when 'interview' then
      app.can_read_case(app.case_of_interview(p_owner_id), p_uid)
    when 'action_item' then
      app.can_read_action_item(p_owner_id, p_uid)
    else false
  end;
end;
$function$;

-- can_write_attachment — 'meeting' + 'action_item' arms lose the org arm.
create or replace function app.can_write_attachment(p_owner_type text, p_owner_id uuid, p_uid uuid)
returns boolean language plpgsql stable security definer set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission uuid;
begin
  if p_uid is null then
    return false;
  end if;
  if not app.is_active(p_uid) then                    -- M5 defect ③ outer gate (K28 pin)
    return false;
  end if;
  case p_owner_type
    when 'case' then
      if app.is_case_excluded(p_owner_id, p_uid) then
        return false;
      end if;
      v_commission := app.commission_of_case(p_owner_id);
      return app.is_staff_admin_of_for(v_commission, p_uid) or app.is_commission_admin_of_for(v_commission, p_uid);
    when 'meeting' then
      v_commission := app.commission_of_meeting(p_owner_id);
      return app.is_staff_admin_of_for(v_commission, p_uid);              -- C7: org arm removed (A8)
    when 'action_item' then
      if app.is_case_excluded(app.case_of_action_item(p_owner_id), p_uid) then   -- K27 pin
        return false;
      end if;
      v_commission := app.commission_of_action_item(p_owner_id);
      return app.is_staff_admin_of_for(v_commission, p_uid)              -- C7: org arm removed (A11)
          or exists (select 1 from public.action_items ai
                     where ai.id = p_owner_id and ai.assigned_to = p_uid)
          or exists (select 1 from public.action_item_assignments a
                     where a.action_item_id = p_owner_id and a.user_id = p_uid and a.completed_at is null);
    when 'interview' then
      return app.can_write_interview(p_owner_id, p_uid);
    else
      return false;
  end case;
end;
$function$;

-- can_read_action_item — 'committee' + 'assignees_only' scopes lose the org arm.
create or replace function app.can_read_action_item(p_action_item_id uuid, p_uid uuid)
returns boolean language plpgsql stable security definer set search_path to 'app', 'public', 'pg_catalog'
as $function$
declare
  v_commission_id uuid;
  v_scope text;
  v_source_case_id uuid;
  v_case_id uuid;
  v_assigned_to uuid;
  v_anchor_case uuid;
begin
  if not app.is_active(p_uid) then                    -- A24·5 outer gate (K28 pin)
    return false;
  end if;

  select commission_id, visibility_scope, source_case_id, case_id, assigned_to
    into v_commission_id, v_scope, v_source_case_id, v_case_id, v_assigned_to
  from public.action_items where id = p_action_item_id;
  if v_commission_id is null then
    return false;
  end if;

  v_anchor_case := coalesce(v_source_case_id, v_case_id);
  if v_anchor_case is not null and app.is_case_excluded(v_anchor_case, p_uid) then   -- K27 pin
    return false;
  end if;

  if v_scope = 'committee' then
    return app.is_member_of_for(v_commission_id, p_uid);                 -- C7: org arm removed (A11)

  elsif v_scope = 'case_restricted' then
    return app.can_read_case(v_anchor_case, p_uid);                      -- unchanged (K19: follows can_read_case)

  elsif v_scope = 'assignees_only' then
    return app.is_staff_admin_of_for(v_commission_id, p_uid)             -- C7: org arm removed (A11)
        or (v_assigned_to is not null and v_assigned_to = p_uid)
        or exists (
          select 1 from public.action_item_assignments a
          where a.action_item_id = p_action_item_id
            and a.user_id = p_uid
            and a.completed_at is null
        );
  end if;

  return false;
end;
$function$;

-- ============================================================================
-- 4. ADJACENT CHANNEL — action_items policies (A11).
-- ============================================================================

-- action_items_select — committee + assignees_only scopes lose the org arm;
-- case_restricted (can_read_case) unchanged.
drop policy if exists action_items_select on public.action_items;
create policy action_items_select on public.action_items
  for select to authenticated
  using (
    ((visibility_scope = 'committee') and app.is_member_of(commission_id))
    or ((visibility_scope = 'case_restricted')
        and app.can_read_case(coalesce(source_case_id, case_id), auth.uid()))
    or ((visibility_scope = 'assignees_only')
        and (app.is_staff_admin_of(commission_id)
             or (assigned_to is not null and assigned_to = auth.uid())
             or exists (select 1 from public.action_item_assignments a
                        where a.action_item_id = action_items.id
                          and a.user_id = auth.uid()
                          and a.completed_at is null)))
  );

-- action_items_staff_admin_write — FOR ALL, org arm removed; the exclusion term
-- (K27) is preserved verbatim.
drop policy if exists action_items_staff_admin_write on public.action_items;
create policy action_items_staff_admin_write on public.action_items
  for all to authenticated
  using (
    app.is_staff_admin_of(commission_id)
    and ((coalesce(source_case_id, case_id) is null)
         or (not app.is_case_excluded(coalesce(source_case_id, case_id), (select auth.uid()))))
  )
  with check (
    app.is_staff_admin_of(commission_id)
    and ((coalesce(source_case_id, case_id) is null)
         or (not app.is_case_excluded(coalesce(source_case_id, case_id), (select auth.uid()))))
  );
