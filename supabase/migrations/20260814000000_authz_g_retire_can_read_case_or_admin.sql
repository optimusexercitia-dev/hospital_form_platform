-- Stage-G cleanup (ADR 0078 D4 / A21): retire app.can_read_case_or_admin.
--
-- After A4 dissolved its org arm, the wrapper is byte-equivalent to can_read_case over
-- the population — its own hard-deny(respondent/recused) is redundant because _case_caps
-- STEP 4 already hard-denies both before any positive arm. Proven pre-drop across the
-- persona matrix (coordinator/member/grantee/respondent/recused): wrapper == can_read_case,
-- no divergence. This migration repoints every consumer to can_read_case and DROPs the
-- wrapper.
--
-- Consumers (catalog-verified): 12 policies + 2 functions. can_reach_case_on_member_surface
-- is KEPT (A15·2, UN-retired) — its body does NOT call the wrapper (its only reference is a
-- STALE COMMENT, the classic "prosrc regex matches a comment" trap); we re-emit it solely
-- to scrub that comment so no catalog object names the retired function. can_read_interview
-- has a REAL call, repointed. All create-or-replace re-emitted from live pg_get_functiondef.

-- ── FUNCTIONS ───────────────────────────────────────────────────────────────
-- can_read_interview: real call repointed can_read_case_or_admin -> can_read_case.
create or replace function app.can_read_interview(p_interview_id uuid, p_uid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  select p_uid is not null and exists (
    select 1 from public.case_interviews ci
    where ci.id = p_interview_id
      and app.can_read_case(ci.case_id, p_uid)
      and app.confidentiality_clearance_ok(ci.case_id, ci.confidentiality_level, p_uid)
  );
$function$;

-- can_reach_case_on_member_surface: body UNCHANGED (A15·2, kept). Comment scrubbed of the
-- retired name so pg_get_functiondef no longer references can_read_case_or_admin.
create or replace function app.can_reach_case_on_member_surface(p_case_id uuid, p_uid uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'app', 'public', 'pg_catalog'
as $function$
  -- A2: thin projection. A15·2 — this predicate's semantics **ARE**
  -- `read_case_deliberation`, exactly; ETH·E1 built the right predicate three days
  -- before the model existed. The claim that it was redundant with `read_case_content`
  -- was FALSE and its retirement is WITHDRAWN: it is consumed by exactly one policy
  -- (`meeting_cases_select`) while read_case_content gates ~12 tables. It survives as
  -- this bit's projection.
  --
  -- ⚠ It gains D3's is_active gate through the resolver, which it did not carry
  -- directly. Verified NO-OP, not assumed: every arm it had (is_member_of_for /
  -- can_read_case + is_commission_admin_of_for) is is_active-gated internally. This is
  -- M5's "pure delegation" claim, and it holds.
  select app.has_case_capability(p_case_id, p_uid, 'read_case_deliberation');
$function$;

-- ── POLICIES (12) ─ repoint can_read_case_or_admin -> can_read_case (re-emitted from live) ─
drop policy if exists cases_select on public.cases;
create policy cases_select on public.cases
  for select to authenticated
  using (app.can_read_case(id, (select auth.uid())));

drop policy if exists case_events_select on public.case_events;
create policy case_events_select on public.case_events
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));

drop policy if exists case_interview_links_select on public.case_interview_links;
create policy case_interview_links_select on public.case_interview_links
  for select to authenticated
  using (app.can_read_case(app.case_of_interview(interview_id), auth.uid()));

drop policy if exists case_narratives_select on public.case_narratives;
create policy case_narratives_select on public.case_narratives
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));

drop policy if exists case_offered_outcomes_select on public.case_offered_outcomes;
create policy case_offered_outcomes_select on public.case_offered_outcomes
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));

drop policy if exists case_phase_allowed_results_select on public.case_phase_allowed_results;
create policy case_phase_allowed_results_select on public.case_phase_allowed_results
  for select to authenticated
  using (app.can_read_case(app.case_of_case_phase(case_phase_id), auth.uid()));

drop policy if exists case_phase_offered_results_select on public.case_phase_offered_results;
create policy case_phase_offered_results_select on public.case_phase_offered_results
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));

drop policy if exists case_phases_select on public.case_phases;
create policy case_phases_select on public.case_phases
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));

drop policy if exists case_tag_assignments_select on public.case_tag_assignments;
create policy case_tag_assignments_select on public.case_tag_assignments
  for select to authenticated
  using (app.can_read_case(case_id, auth.uid()));

drop policy if exists meeting_cases_staff_admin_delete on public.meeting_cases;
create policy meeting_cases_staff_admin_delete on public.meeting_cases
  for delete to authenticated
  using (app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
         and app.can_read_case(case_id, auth.uid()));

drop policy if exists meeting_cases_staff_admin_insert on public.meeting_cases;
create policy meeting_cases_staff_admin_insert on public.meeting_cases
  for insert to authenticated
  with check (app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
              and app.can_read_case(case_id, auth.uid()));

drop policy if exists meeting_cases_staff_admin_update on public.meeting_cases;
create policy meeting_cases_staff_admin_update on public.meeting_cases
  for update to authenticated
  using (app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
         and app.can_read_case(case_id, auth.uid()))
  with check (app.is_staff_admin_of(app.commission_of_meeting(meeting_id))
              and app.can_read_case(case_id, auth.uid()));

-- ── DROP the retired wrapper (all consumers repointed above) ──────────────────
drop function app.can_read_case_or_admin(uuid, uuid);
