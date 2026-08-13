-- =============================================================================
-- ADR 0033 D2 fast-follow (QA INFO-N1) — case-scope the interview read policies.
-- =============================================================================
-- The restrictive case-access boundary (ADR 0033) tightened `cases` + its child
-- tables from commission-MEMBER read to `app.can_read_case` (attribution- or
-- grant-derived per-case access). `case_interviews` and its three child tables
-- (`case_interview_subjects` / `case_interview_interviewers` /
-- `case_interview_attachments`) were left on the older `is_member_of` MEMBER-read
-- to bound blast radius at the time. This completes the boundary: the interview
-- graph now follows `can_read_case` exactly like the sibling case-child tables
-- (`case_documents` / `case_events` / `case_narratives` / `case_phases` / …).
--
-- SELECT policies ONLY. INSERT/UPDATE/DELETE + every write predicate
-- (`can_write_interview`, `is_staff_admin_of`, the child `_write` policies) are
-- UNTOUCHED. Additive/forward-only; no table-type change (RLS + a helper fn only).
-- Reset-OK (pre-launch). Architecture Rule 1.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Minimal resolver: interview -> its case. Mirrors `app.commission_of_interview`
-- (STABLE / SECURITY DEFINER / pinned search_path). The children key on
-- `interview_id`, so they resolve the case through this before gating on
-- `can_read_case`. `case_interviews.case_id` is NOT NULL, so this never yields a
-- null case id for an existing interview row.
-- -----------------------------------------------------------------------------
create or replace function app.case_of_interview(p_interview_id uuid)
  returns uuid
  language sql
  stable
  security definer
  set search_path to 'app', 'public', 'pg_catalog'
as $$
  select case_id from public.case_interviews where id = p_interview_id;
$$;
alter function app.case_of_interview(uuid) owner to postgres;
revoke all on function app.case_of_interview(uuid) from public;
grant execute on function app.case_of_interview(uuid) to authenticated;
grant execute on function app.case_of_interview(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Parent: case_interviews SELECT -> can_read_case (mirrors the sibling
-- case-child tables). `case_id` is NOT NULL. Uses the `(select auth.uid())`
-- InitPlan-wrapped form (WS-5 perf convention for policies).
-- -----------------------------------------------------------------------------
drop policy "case_interviews_select" on public.case_interviews;
create policy "case_interviews_select" on public.case_interviews
  for select to authenticated
  using (
    app.can_read_case(case_id, (select auth.uid()))
    or app.is_commission_admin_of(app.commission_of_case(case_id))
  );

-- -----------------------------------------------------------------------------
-- Children: subjects / interviewers / attachments SELECT -> can_read_case via
-- the interview's case. The org-admin arm keeps the existing
-- `commission_of_interview(interview_id)` resolver.
-- -----------------------------------------------------------------------------
drop policy "case_interview_subjects_select" on public.case_interview_subjects;
create policy "case_interview_subjects_select" on public.case_interview_subjects
  for select to authenticated
  using (
    app.can_read_case(app.case_of_interview(interview_id), (select auth.uid()))
    or app.is_commission_admin_of(app.commission_of_interview(interview_id))
  );

drop policy "case_interview_interviewers_select" on public.case_interview_interviewers;
create policy "case_interview_interviewers_select" on public.case_interview_interviewers
  for select to authenticated
  using (
    app.can_read_case(app.case_of_interview(interview_id), (select auth.uid()))
    or app.is_commission_admin_of(app.commission_of_interview(interview_id))
  );

drop policy "case_interview_attachments_select" on public.case_interview_attachments;
create policy "case_interview_attachments_select" on public.case_interview_attachments
  for select to authenticated
  using (
    app.can_read_case(app.case_of_interview(interview_id), (select auth.uid()))
    or app.is_commission_admin_of(app.commission_of_interview(interview_id))
  );
