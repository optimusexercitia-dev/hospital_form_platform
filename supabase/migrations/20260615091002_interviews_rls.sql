-- Phase 11 / B2 (3 of 4): Interviews RLS — all policies.
--
-- RLS is the security boundary (Architecture Rule 1). Every interviews table had
-- RLS ENABLED at creation (…091000) and is deny-by-default; this migration adds
-- the explicit policies. The SELECT shape mirrors the cases/meetings family
-- (members read their commission's interviews + children). The WRITE shape is the
-- NEW Phase-11 participant grant (resolved decision 13): write =
-- staff_admin/admin OR a REGISTERED INTERVIEWER on that interview, via the
-- SECURITY DEFINER app.can_write_interview (defined in …091000, bypasses RLS
-- internally → no recursion). The ONE exception is CREATE: inserting a new
-- interview is staff_admin/admin only (bootstrap — resolved decision 14), so
-- case_interviews splits INSERT from UPDATE/DELETE (unlike the meetings family's
-- single FOR ALL).
--
-- NOTE on the admin path: policies OR in BOTH app.can_write_interview(id,
-- auth.uid()) (which uses the uid-pure app.is_admin_for DB check) AND the
-- claim-aware app.is_admin(), so a current-session admin authenticated via the JWT
-- 'is_admin' claim (no profiles row flag) is still permitted — can_write_interview
-- alone is uid-pure for pgTAP, and the extra OR preserves the live claim path.

-- ===========================================================================
-- case_interviews — member SELECT; staff_admin INSERT; writable UPDATE/DELETE
-- ===========================================================================
create policy case_interviews_select on public.case_interviews
  for select to authenticated
  using (app.is_member_of(commission_id) or app.is_admin());

-- CREATE = staff_admin/admin only (bootstrap). The trigger app.guard_interview_links
-- also re-asserts commission honesty + phase-in-case at insert.
create policy case_interviews_insert on public.case_interviews
  for insert to authenticated
  with check (app.is_staff_admin_of(commission_id) or app.is_admin());

-- UPDATE / DELETE = the participant write grant (staff_admin/admin OR a registered
-- interviewer of this interview). The lifecycle/content correctness is
-- trigger-enforced (app.guard_interview_status), NOT RLS.
create policy case_interviews_update on public.case_interviews
  for update to authenticated
  using (app.can_write_interview(id, auth.uid()) or app.is_admin())
  with check (app.can_write_interview(id, auth.uid()) or app.is_admin());

create policy case_interviews_delete on public.case_interviews
  for delete to authenticated
  using (app.can_write_interview(id, auth.uid()) or app.is_admin());

-- ===========================================================================
-- case_interview_subjects — member SELECT; writable write
-- ===========================================================================
create policy case_interview_subjects_select on public.case_interview_subjects
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_interview(interview_id)) or app.is_admin()
  );

create policy case_interview_subjects_write on public.case_interview_subjects
  for all to authenticated
  using (app.can_write_interview(interview_id, auth.uid()) or app.is_admin())
  with check (app.can_write_interview(interview_id, auth.uid()) or app.is_admin());

-- ===========================================================================
-- case_interview_interviewers — member SELECT; writable write
-- ===========================================================================
create policy case_interview_interviewers_select on public.case_interview_interviewers
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_interview(interview_id)) or app.is_admin()
  );

create policy case_interview_interviewers_write on public.case_interview_interviewers
  for all to authenticated
  using (app.can_write_interview(interview_id, auth.uid()) or app.is_admin())
  with check (app.can_write_interview(interview_id, auth.uid()) or app.is_admin());

-- ===========================================================================
-- case_interview_attachments — member SELECT; writable write (soft-delete via RPC)
-- ===========================================================================
-- Soft-delete filtering (deleted_at is null) is a QUERY concern, not RLS — a
-- writable user could un-delete in a future iteration, so the row stays visible.
create policy case_interview_attachments_select on public.case_interview_attachments
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_interview(interview_id)) or app.is_admin()
  );

create policy case_interview_attachments_write on public.case_interview_attachments
  for all to authenticated
  using (app.can_write_interview(interview_id, auth.uid()) or app.is_admin())
  with check (app.can_write_interview(interview_id, auth.uid()) or app.is_admin());
