-- ============================================================================
-- ADR 0078 Gate 2 · Stage C · C8 — re-cut the four meeting `FOR ALL` write
-- policies to WRITE-ONLY, so their `USING` no longer side-doors SELECT past the
-- `*_select` authorization boundary.
--
-- WHY (A13, plan lines 473–483): a `FOR ALL` PERMISSIVE policy's `USING` applies
-- to SELECT, and permissive policies OR together. So each `*_staff_admin_write`
-- policy is silently ALSO a read grant that bypasses its sibling `*_select`.
-- Without this re-cut, C2 (agenda-item column gating) and C3 (`participants_only`)
-- are no-ops: rows return through the write side-door while the tightened
-- `*_select` tests green. C8 is therefore a HARD PREREQUISITE, sequenced before
-- C2/C3.
--
-- SCOPE OF THIS MIGRATION: STRUCTURAL ONLY. Each policy is replaced by three
-- write-only policies (INSERT / UPDATE / DELETE) carrying the *identical*
-- predicate. No predicate/arm changes here — the `is_commission_admin_of` and
-- `member_can('schedule_meetings')` arm removals belong to C7 (Wave 4), kept
-- separate for clean attribution. After C8, SELECT on each table flows ONLY
-- through its `*_select` policy.
--
-- Predicates are copied verbatim from the live catalog (pg_policies), NOT from
-- migration text (ADR 0078 A28). Verified 2026-07-16 at 123 migrations = HEAD.
-- LOCAL ONLY — no remote/pilot (ADR 0078 authorizes no remote migration).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. meetings  (predicate: staff_admin OR commission_admin OR schedule_meetings)
--    The third arm — member_can('schedule_meetings') — is why C8 has a live-ish
--    read-delta even pre-C3: a `schedule_meetings` delegate who is not otherwise
--    a member is admitted by this USING but denied by meetings_select. ADR 0078
--    keystone 18. (Arm itself stays here; C7 removes commission_admin, C3-era
--    work addresses the participants_only over-grant.)
-- ----------------------------------------------------------------------------
drop policy if exists meetings_staff_admin_write on public.meetings;

create policy meetings_staff_admin_insert on public.meetings
  for insert to authenticated
  with check (
    app.is_staff_admin_of(commission_id)
    or app.is_commission_admin_of(commission_id)
    or app.member_can(commission_id, 'schedule_meetings')
  );

create policy meetings_staff_admin_update on public.meetings
  for update to authenticated
  using (
    app.is_staff_admin_of(commission_id)
    or app.is_commission_admin_of(commission_id)
    or app.member_can(commission_id, 'schedule_meetings')
  )
  with check (
    app.is_staff_admin_of(commission_id)
    or app.is_commission_admin_of(commission_id)
    or app.member_can(commission_id, 'schedule_meetings')
  );

create policy meetings_staff_admin_delete on public.meetings
  for delete to authenticated
  using (
    app.is_staff_admin_of(commission_id)
    or app.is_commission_admin_of(commission_id)
    or app.member_can(commission_id, 'schedule_meetings')
  );

-- ----------------------------------------------------------------------------
-- 2. meeting_agenda_items  (predicate: staff_admin OR commission_admin, via
--    commission_of_meeting)
-- ----------------------------------------------------------------------------
drop policy if exists meeting_agenda_items_staff_admin_write on public.meeting_agenda_items;

create policy meeting_agenda_items_staff_admin_insert on public.meeting_agenda_items
  for insert to authenticated
  with check (
    app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
    or app.is_commission_admin_of(app.commission_of_meeting(meeting_id))
  );

create policy meeting_agenda_items_staff_admin_update on public.meeting_agenda_items
  for update to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
    or app.is_commission_admin_of(app.commission_of_meeting(meeting_id))
  )
  with check (
    app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
    or app.is_commission_admin_of(app.commission_of_meeting(meeting_id))
  );

create policy meeting_agenda_items_staff_admin_delete on public.meeting_agenda_items
  for delete to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
    or app.is_commission_admin_of(app.commission_of_meeting(meeting_id))
  );

-- ----------------------------------------------------------------------------
-- 3. meeting_attendees  (predicate: staff_admin OR commission_admin, via
--    commission_of_meeting)
-- ----------------------------------------------------------------------------
drop policy if exists meeting_attendees_staff_admin_write on public.meeting_attendees;

create policy meeting_attendees_staff_admin_insert on public.meeting_attendees
  for insert to authenticated
  with check (
    app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
    or app.is_commission_admin_of(app.commission_of_meeting(meeting_id))
  );

create policy meeting_attendees_staff_admin_update on public.meeting_attendees
  for update to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
    or app.is_commission_admin_of(app.commission_of_meeting(meeting_id))
  )
  with check (
    app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
    or app.is_commission_admin_of(app.commission_of_meeting(meeting_id))
  );

create policy meeting_attendees_staff_admin_delete on public.meeting_attendees
  for delete to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
    or app.is_commission_admin_of(app.commission_of_meeting(meeting_id))
  );

-- ----------------------------------------------------------------------------
-- 4. meeting_cases  (predicate: (staff_admin OR commission_admin) AND
--    can_read_case_or_admin(case_id) — the case-half already carries the
--    exclusion deny; A4 dissolved can_read_case_or_admin's own org arm, so the
--    case-half now equals can_read_case. The authority-half commission_admin arm
--    is removed by C7.)
-- ----------------------------------------------------------------------------
drop policy if exists meeting_cases_staff_admin_write on public.meeting_cases;

create policy meeting_cases_staff_admin_insert on public.meeting_cases
  for insert to authenticated
  with check (
    (app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
     or app.is_commission_admin_of(app.commission_of_meeting(meeting_id)))
    and app.can_read_case_or_admin(case_id, auth.uid())
  );

create policy meeting_cases_staff_admin_update on public.meeting_cases
  for update to authenticated
  using (
    (app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
     or app.is_commission_admin_of(app.commission_of_meeting(meeting_id)))
    and app.can_read_case_or_admin(case_id, auth.uid())
  )
  with check (
    (app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
     or app.is_commission_admin_of(app.commission_of_meeting(meeting_id)))
    and app.can_read_case_or_admin(case_id, auth.uid())
  );

create policy meeting_cases_staff_admin_delete on public.meeting_cases
  for delete to authenticated
  using (
    (app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
     or app.is_commission_admin_of(app.commission_of_meeting(meeting_id)))
    and app.can_read_case_or_admin(case_id, auth.uid())
  );
