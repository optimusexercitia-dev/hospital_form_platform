-- Phase 7 / B4: RLS for the four cases tables.
--
-- RLS is the security boundary (Architecture Rule 1). All four tables had RLS
-- ENABLED at creation (20260613090004) and are therefore deny-by-default; this
-- migration adds the explicit policies. The shape mirrors the forms family:
-- MEMBERS READ, STAFF_ADMIN WRITE (+ admin everywhere). State-machine
-- correctness is trigger-enforced (the guards in 090004), not RLS — RLS only
-- answers "who may touch a row of this commission at all".
--
-- THE PHASE-7 IN_PROGRESS-ANSWERS INVARIANT (ADR 0016) is preserved WITHOUT any
-- change to responses / answers / signoffs policies:
--   * case_phases carries STATUS + ASSIGNEE + RECOMMENDED only — never answers.
--     A coordinator reads phase status here / via list_cases_board.
--   * The assignee is the phase response's created_by, so the EXISTING
--     responses_update_own_draft / answers_write_own_draft already grant exactly
--     the fill access — no new responses/answers policy is added or widened.
--   * Another member's in_progress answers reach a coordinator by NO path: the
--     responses/answers SELECT policies still expose SUBMITTED-only to a
--     staff_admin, and the only cross-member answer surface
--     (case_phase_answer_map / get_case_detail) is SUBMITTED-ONLY.
--
-- Helpers: app.commission_of_case was added in 090006 (used by get_case_detail);
-- app.commission_of_template is added here. Both mirror commission_of_version.

-- ---------------------------------------------------------------------------
-- app.commission_of_template(template_id) -> uuid
-- ---------------------------------------------------------------------------
create function app.commission_of_template(p_template_id uuid)
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_catalog
as $$
  select commission_id from public.process_templates where id = p_template_id;
$$;

revoke all on function app.commission_of_template(uuid) from public;
grant execute on function app.commission_of_template(uuid) to authenticated, service_role;

-- ===========================================================================
-- process_templates — members read, staff_admin write
-- ===========================================================================
create policy process_templates_select on public.process_templates
  for select to authenticated
  using (app.is_member_of(commission_id) or app.is_admin());

create policy process_templates_staff_admin_write on public.process_templates
  for all to authenticated
  using (app.is_staff_admin_of(commission_id) or app.is_admin())
  with check (app.is_staff_admin_of(commission_id) or app.is_admin());

-- ===========================================================================
-- process_template_phases — scoped through the parent template's commission
-- ===========================================================================
create policy process_template_phases_select on public.process_template_phases
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_template(template_id))
    or app.is_admin()
  );

create policy process_template_phases_staff_admin_write on public.process_template_phases
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_template(template_id)) or app.is_admin()
  )
  with check (
    app.is_staff_admin_of(app.commission_of_template(template_id)) or app.is_admin()
  );

-- ===========================================================================
-- cases — members read (assignee + board context), staff_admin write
-- ===========================================================================
create policy cases_select on public.cases
  for select to authenticated
  using (app.is_member_of(commission_id) or app.is_admin());

create policy cases_staff_admin_write on public.cases
  for all to authenticated
  using (app.is_staff_admin_of(commission_id) or app.is_admin())
  with check (app.is_staff_admin_of(commission_id) or app.is_admin());

-- ===========================================================================
-- case_phases — scoped through the parent case's commission
-- ===========================================================================
-- Members READ: an assignee needs to see their phase row (status + metadata,
-- never answers) and the board context. staff_admin WRITES (the coordinator).
create policy case_phases_select on public.case_phases
  for select to authenticated
  using (
    app.is_member_of(app.commission_of_case(case_id))
    or app.is_admin()
  );

create policy case_phases_staff_admin_write on public.case_phases
  for all to authenticated
  using (
    app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_admin()
  )
  with check (
    app.is_staff_admin_of(app.commission_of_case(case_id)) or app.is_admin()
  );
