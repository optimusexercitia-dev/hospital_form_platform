-- Phase 10 / B2 (3 of 3): Meetings RLS — all policies + app.can_sign_meeting.
--
-- RLS is the security boundary (Architecture Rule 1). Every meetings table had
-- RLS ENABLED at creation (…090000/…090001/…090002) and is deny-by-default; this
-- migration adds the explicit policies. The uniform shape mirrors the cases
-- family: MEMBERS READ their commission's meetings + children; STAFF_ADMIN
-- WRITES (authoring); admin everywhere. Commission is resolved via
-- app.commission_of_meeting for child tables; meeting_action_items uses its
-- DENORMALIZED commission_id directly.
--
-- The ONE exception to "staff_admin writes" is meeting_signatures: a MEMBER
-- signs their OWN attendee row (sign-own-row INSERT), modelled on
-- signoffs_insert (20260613090003) — the role/eligibility rule lives in a
-- SECURITY DEFINER predicate (app.can_sign_meeting) so it is not re-filtered by
-- the caller's RLS. Lifecycle/content correctness is trigger-enforced (the
-- guards in …090000/…090001), NOT RLS — RLS only answers "who may touch a row
-- of this commission at all".

-- ===========================================================================
-- commission_meeting_types — members read, staff_admin write
-- ===========================================================================
create policy meeting_types_select on public.commission_meeting_types
  for select to authenticated
  using (app.is_member_of(commission_id) or app.is_admin());

create policy meeting_types_staff_admin_write on public.commission_meeting_types
  for all to authenticated
  using (app.is_staff_admin_of(commission_id) or app.is_admin())
  with check (app.is_staff_admin_of(commission_id) or app.is_admin());

-- ===========================================================================
-- commission_meeting_settings — members read, staff_admin write
-- ===========================================================================
create policy meeting_settings_select on public.commission_meeting_settings
  for select to authenticated
  using (app.is_member_of(commission_id) or app.is_admin());

create policy meeting_settings_staff_admin_write on public.commission_meeting_settings
  for all to authenticated
  using (app.is_staff_admin_of(commission_id) or app.is_admin())
  with check (app.is_staff_admin_of(commission_id) or app.is_admin());

-- ===========================================================================
-- meetings — members read, staff_admin write
-- ===========================================================================
create policy meetings_select on public.meetings
  for select to authenticated
  using (app.is_member_of(commission_id) or app.is_admin());

create policy meetings_staff_admin_write on public.meetings
  for all to authenticated
  using (app.is_staff_admin_of(commission_id) or app.is_admin())
  with check (app.is_staff_admin_of(commission_id) or app.is_admin());

-- ===========================================================================
-- meeting_agenda_items — scoped through the parent meeting's commission
-- ===========================================================================
create policy meeting_agenda_items_select on public.meeting_agenda_items
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_meeting(meeting_id)) or app.is_admin()
  );

create policy meeting_agenda_items_staff_admin_write on public.meeting_agenda_items
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) or app.is_admin()
  )
  with check (
    app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) or app.is_admin()
  );

-- ===========================================================================
-- meeting_attendees — scoped through the parent meeting's commission
-- ===========================================================================
create policy meeting_attendees_select on public.meeting_attendees
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_meeting(meeting_id)) or app.is_admin()
  );

create policy meeting_attendees_staff_admin_write on public.meeting_attendees
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) or app.is_admin()
  )
  with check (
    app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) or app.is_admin()
  );

-- ===========================================================================
-- meeting_cases — scoped through the parent meeting's commission
-- ===========================================================================
create policy meeting_cases_select on public.meeting_cases
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_meeting(meeting_id)) or app.is_admin()
  );

create policy meeting_cases_staff_admin_write on public.meeting_cases
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) or app.is_admin()
  )
  with check (
    app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) or app.is_admin()
  );

-- ===========================================================================
-- meeting_action_items — DENORMALIZED commission_id (direct predicate)
-- ===========================================================================
-- Members READ (the per-meeting panel + the assignee seeing their own items).
-- The broad WRITE policy is staff_admin-only; an ASSIGNEE who is a plain member
-- does NOT get UPDATE here — they advance their item through the narrow definer
-- RPC (advance_meeting_action_item, its own assigned_to/staff_admin gate, HC037)
-- — mirrors case_action_items.
create policy meeting_action_items_select on public.meeting_action_items
  for select to authenticated
  using (app.is_member_of(commission_id) or app.is_admin());

create policy meeting_action_items_staff_admin_write on public.meeting_action_items
  for all to authenticated
  using (app.is_staff_admin_of(commission_id) or app.is_admin())
  with check (app.is_staff_admin_of(commission_id) or app.is_admin());

-- ===========================================================================
-- app.can_sign_meeting(attendee_id, signer) -> boolean    (sign-own-row rule)
-- ===========================================================================
-- The eligibility rule for the sign-own-row INSERT, in a SECURITY DEFINER
-- predicate (modelled on app.can_sign_section) so it is NOT re-filtered by the
-- caller's RLS. Asserts the signer may record an ACTIVE signature for this
-- attendee row:
--   * the attendee is a PLATFORM member (user_id not null) AND that user is the
--     signer (an attendee signs only their OWN row — no signing on behalf),
--   * the attendee is PRESENT (attendance = 'presente'),
--   * the parent meeting is currently em_assinatura (the only signable state),
--   * the signer is a MEMBER of the meeting's commission (defence in depth;
--     a present attendee is already a member, but this blocks a stale row).
-- WHO may sign is thus fully in the DB (RLS remains the authority). Double-sign
-- (HC035) is caught by the active partial-unique; an ineligible signer is
-- rejected here (the action maps the 42501 to HC036's pt-BR).
create function app.can_sign_meeting(
  p_attendee_id uuid,
  p_signer uuid
)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select exists (
    select 1
    from public.meeting_attendees a
    join public.meetings m on m.id = a.meeting_id
    where a.id = p_attendee_id
      and a.user_id is not null
      and a.user_id = p_signer
      and a.attendance = 'presente'
      and m.status = 'em_assinatura'
      and app.is_member_of_for(m.commission_id, p_signer)
  );
$$;

revoke all on function app.can_sign_meeting(uuid, uuid) from public;
grant execute on function app.can_sign_meeting(uuid, uuid) to authenticated, service_role;

-- ===========================================================================
-- meeting_signatures — member SELECT; sign-own-row INSERT
-- ===========================================================================
-- SELECT: any member of the meeting's commission reads the signatures roster
-- (signed/pending/revoked status of the present attendees). No staff_admin-only
-- gate — the roster is part of the read-only meeting view for every member.
create policy meeting_signatures_select on public.meeting_signatures
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_meeting(meeting_id)) or app.is_admin()
  );

-- INSERT: sign-own-row. signer_id must be the acting user AND the eligibility
-- predicate must hold (present platform attendee of an em_assinatura meeting in
-- the caller's commission). The sign_meeting RPC inserts THROUGH this policy
-- (SECURITY INVOKER for the insert leg), so this is the authority for WHO signs.
create policy meeting_signatures_insert on public.meeting_signatures
  for insert to authenticated
  with check (
    signer_id = auth.uid()
    and app.can_sign_meeting(attendee_id, auth.uid())
  );

-- NO broad UPDATE/DELETE policy: a signature is never edited or deleted by a
-- member. REVOCATION (status -> 'revoked' on reopen) is performed by the
-- reopen_meeting RPC, which is SECURITY DEFINER and updates the rows directly,
-- bypassing this policy set (rows are kept for the audit trail).
