-- AE1.5 (docs/plans/authz-evolution.md § AE1.5 step 1; ADR 0155 D9) —
-- hoist `auth.uid()` to an InitPlan across the measured-hot subset of the
-- `auth_rls_initplan` advisor findings.
-- Triage record + before/after plan diffs: docs/design/authz-ae1-initplan-triage.md
-- Keystone: supabase/tests/387_initplan_wrap_and_profiles_arm_identity.sql
--
-- ============================================================================
-- SCOPE — 52 of the 113 flagged policies, and the boundary is PLAN-DERIVED
-- ============================================================================
-- The advisor's `auth_rls_initplan` rule flags 113 policies.  That count is
-- reproducible locally, exactly, and this migration's scope was derived from
-- the local instrument rather than from the advisor's list (they were then
-- diffed against each other: 113 vs 113, EMPTY diff — triage doc § 1):
--
--   select ... from pg_policies where schemaname = 'public'
--    and coalesce(qual,'') || ' ' || coalesce(with_check,'')
--        ~ '(?<!SELECT )auth\.(uid|jwt|role|email)\(\)';
--
-- The 52 taken here are exactly the six table groups the plan itself names as
-- the hot set (case_* · the responses family · the meetings family · the person
-- roster · the targeted-read form path · the memberships-adjacent pair), so the
-- cut is the plan's, not the author's.  The remaining 61 (`rca_*` 15, `capa_*`
-- 15, `ethics_*` 7, `action_item*` 6, `referral_*` 5, `event_*` 4,
-- `interview_*` 4, `controlled_document*` 2, plus `document_approvals`,
-- `patient_safety_event`, `patient_xref`) are the SAME mechanical transform and
-- are named in the triage doc § 5 so nobody has to re-derive them.
--
-- ============================================================================
-- WHY THE SUBSTITUTION IS UNCONDITIONALLY IDENTITY
-- ============================================================================
-- `auth.uid()` is STABLE, takes no arguments, references no `Var`, and reads
-- only the `request.jwt.claims` GUC.  `( select auth.uid() )` is therefore an
-- UNCORRELATED subquery: the planner turns it into an InitPlan evaluated once
-- per statement.  It cannot become a correlated SubPlan, and it is unaffected
-- by `SET ROLE` inside a SECURITY DEFINER body (it reads a GUC, not the current
-- role).  The value is identical; only the number of times it is computed moves.
--
-- ⛔ WHAT WAS DELIBERATELY *NOT* WRAPPED, because it would NOT be identity:
--    the ~95 occurrences here are the second argument of `app.can_*(<row
--    column>, auth.uid())`.  The OUTER call takes a `Var` and is genuinely
--    row-dependent — wrapping IT as `( select app.can_read_case(case_id, ...) )`
--    produces a CORRELATED SubPlan evaluated once per row anyway: no gain, and
--    a plan-shape change for nothing.  Only the Var-free ARGUMENT is wrapped.
--    This is the plan's "a caller-dependent function must not be hoisted across
--    a lateral boundary", and here it is structural rather than a judgement.
--
-- ⛔ For the same reason `cases`, `commissions`, `memberships` and `meetings`
--    are ABSENT from this migration: they carry ZERO initplan warnings, because
--    their predicates are `app.is_*_of(<column>)` — correctly not hoistable.
--    The four tables the plan names first are already clean on this rule.
--
-- VERIFIED, not assumed (EXPLAIN, local stack, before writing this file):
--    unwrapped -> Filter: app.can_read_case(case_id, (COALESCE(NULLIF(
--                   current_setting('request.jwt.claim.sub',true),''), ...
--                   ->> 'sub'))::uuid)          <- inlined, evaluated PER ROW
--    wrapped   -> Filter: app.can_read_case(case_id, (InitPlan 1).col1)
--                 InitPlan 1 -> Result           <- evaluated ONCE
--
-- ============================================================================
-- HOW THIS FILE WAS PRODUCED, and why it is static text
-- ============================================================================
-- The 52 statements below were GENERATED from the live catalog at authoring
-- time and committed as literal SQL.  They are NOT produced at apply time.
-- ⛔ This repo already carries migrations that rewrite function bodies during
--    apply via pg_get_functiondef() + replace() + execute, which is precisely
--    why "migration file text is stale by design" is a standing rule of this
--    codebase (ADR 0078 METHODOLOGY FINDING).  Adding another such migration
--    would make that rule truer.  Generation happened once, here, off-line;
--    the artifact is static, and this file's text IS what it sets.
--
-- ⚠ `ALTER POLICY` is used throughout, never DROP+CREATE.  It is incapable of
--    changing `cmd`, `permissive` or `roles`, so this migration structurally
--    cannot alter which command a policy gates or who it applies to.  Test 387
--    § D4 asserts that anyway rather than trusting it.
-- ============================================================================

alter policy answers_insert_targeted on public.answers
  with check (app.can_write_targeted_response(response_id, ( select auth.uid() )));
alter policy answers_select_targeted on public.answers
  using (app.can_access_targeted_response(response_id, ( select auth.uid() )));
alter policy answers_update_targeted on public.answers
  using (app.can_write_targeted_response(response_id, ( select auth.uid() )))
  with check (app.can_write_targeted_response(response_id, ( select auth.uid() )));
alter policy case_conflict_declarations_select on public.case_conflict_declarations
  using (app.can_read_case(case_id, ( select auth.uid() )));
alter policy case_correction_requests_select on public.case_correction_requests
  using (app.can_read_case(case_id, ( select auth.uid() )));
alter policy case_decisions_select on public.case_decisions
  using (app.can_read_case_committee(case_id, ( select auth.uid() )));
alter policy case_events_select on public.case_events
  using ((app.can_read_case(case_id, ( select auth.uid() )) AND ((visibility = 'case_readers'::text) OR app.is_staff_admin_of(app.commission_of_case(case_id)))));
alter policy case_events_staff_admin_delete on public.case_events
  using ((app.is_staff_admin_of(app.commission_of_case(case_id)) AND (NOT app.is_case_excluded(case_id, ( select auth.uid() )))));
alter policy case_events_staff_admin_insert on public.case_events
  with check ((app.is_staff_admin_of(app.commission_of_case(case_id)) AND (NOT app.is_case_excluded(case_id, ( select auth.uid() ))) AND app.is_manual_case_event_kind(kind)));
alter policy case_events_staff_admin_update on public.case_events
  using ((app.is_staff_admin_of(app.commission_of_case(case_id)) AND (NOT app.is_case_excluded(case_id, ( select auth.uid() )))))
  with check ((app.is_staff_admin_of(app.commission_of_case(case_id)) AND (NOT app.is_case_excluded(case_id, ( select auth.uid() ))) AND app.is_manual_case_event_kind(kind)));
alter policy case_events_writer_delete on public.case_events
  using (app.can_write_case_content(case_id, ( select auth.uid() )));
alter policy case_events_writer_insert on public.case_events
  with check ((app.can_write_case_content(case_id, ( select auth.uid() )) AND ((visibility = 'case_readers'::text) OR app.is_staff_admin_of(app.commission_of_case(case_id))) AND app.is_manual_case_event_kind(kind)));
alter policy case_events_writer_update on public.case_events
  using (app.can_write_case_content(case_id, ( select auth.uid() )))
  with check ((app.can_write_case_content(case_id, ( select auth.uid() )) AND ((visibility = 'case_readers'::text) OR app.is_staff_admin_of(app.commission_of_case(case_id))) AND app.is_manual_case_event_kind(kind)));
alter policy case_interview_interviewers_select on public.case_interview_interviewers
  using (app.can_read_interview(interview_id, ( select auth.uid() )));
alter policy case_interview_interviewers_write on public.case_interview_interviewers
  using ((app.can_write_interview(interview_id, ( select auth.uid() )) AND (NOT app.is_case_excluded(app.case_of_interview(interview_id), ( select auth.uid() )))))
  with check ((app.can_write_interview(interview_id, ( select auth.uid() )) AND (NOT app.is_case_excluded(app.case_of_interview(interview_id), ( select auth.uid() )))));
alter policy case_interview_links_select on public.case_interview_links
  using (app.can_read_case_committee(app.case_of_interview(interview_id), ( select auth.uid() )));
alter policy case_interview_links_write on public.case_interview_links
  using ((app.can_write_interview(interview_id, ( select auth.uid() )) AND (NOT app.is_case_excluded(app.case_of_interview(interview_id), ( select auth.uid() )))))
  with check ((app.can_write_interview(interview_id, ( select auth.uid() )) AND (NOT app.is_case_excluded(app.case_of_interview(interview_id), ( select auth.uid() )))));
alter policy case_interview_subjects_select on public.case_interview_subjects
  using (app.can_read_interview(interview_id, ( select auth.uid() )));
alter policy case_interview_subjects_write on public.case_interview_subjects
  using ((app.can_write_interview(interview_id, ( select auth.uid() )) AND (NOT app.is_case_excluded(app.case_of_interview(interview_id), ( select auth.uid() )))))
  with check ((app.can_write_interview(interview_id, ( select auth.uid() )) AND (NOT app.is_case_excluded(app.case_of_interview(interview_id), ( select auth.uid() )))));
alter policy case_interviews_delete on public.case_interviews
  using (app.can_write_interview(id, ( select auth.uid() )));
alter policy case_interviews_insert on public.case_interviews
  with check ((app.is_staff_admin_of(commission_id) AND (NOT app.is_case_excluded(case_id, ( select auth.uid() )))));
alter policy case_interviews_select on public.case_interviews
  using (app.can_read_interview(id, ( select auth.uid() )));
alter policy case_interviews_update on public.case_interviews
  using (app.can_write_interview(id, ( select auth.uid() )))
  with check (app.can_write_interview(id, ( select auth.uid() )));
alter policy case_participants_select on public.case_participants
  using (app.can_read_case(case_id, ( select auth.uid() )));
alter policy case_recusals_select on public.case_recusals
  using ((app.can_read_case(case_id, ( select auth.uid() )) OR (user_id = ( select auth.uid() )) OR app.is_staff_admin_of_for(app.commission_of_case(case_id), ( select auth.uid() ))));
alter policy case_referral_delete_draft_source on public.case_referral
  using (((status = 'draft'::text) AND app.can_manage_referral_source(id, ( select auth.uid() ))));
alter policy case_referral_insert_source_coord on public.case_referral
  with check (app.is_staff_admin_of_for(source_commission_id, ( select auth.uid() )));
alter policy case_referral_select_readable on public.case_referral
  using (app.can_read_referral_metadata(id, ( select auth.uid() )));
alter policy case_referral_update_coord on public.case_referral
  using ((app.can_manage_referral_source(id, ( select auth.uid() )) OR app.can_manage_referral_target(id, ( select auth.uid() ))))
  with check ((app.can_manage_referral_source(id, ( select auth.uid() )) OR app.can_manage_referral_target(id, ( select auth.uid() ))));
alter policy case_reopenings_select on public.case_reopenings
  using (app.can_read_case(case_id, ( select auth.uid() )));
alter policy case_tag_assignments_select on public.case_tag_assignments
  using (app.can_read_case(case_id, ( select auth.uid() )));
alter policy case_tag_assignments_staff_admin_write on public.case_tag_assignments
  using ((app.is_staff_admin_of(app.commission_of_case(case_id)) AND (NOT app.is_case_excluded(case_id, ( select auth.uid() )))))
  with check ((app.is_staff_admin_of(app.commission_of_case(case_id)) AND (NOT app.is_case_excluded(case_id, ( select auth.uid() )))));
alter policy case_votes_select on public.case_votes
  using (app.can_read_case_committee(case_id, ( select auth.uid() )));
alter policy commission_administrativo_capabilities_select on public.commission_administrativo_capabilities
  using ((app.is_staff_admin_of(commission_id) OR app.is_tenancy_admin_of(commission_id) OR (user_id = ( select auth.uid() ))));
alter policy commission_administrativos_select on public.commission_administrativos
  using ((app.is_staff_admin_of(commission_id) OR app.is_tenancy_admin_of(commission_id) OR (user_id = ( select auth.uid() ))));
alter policy form_items_select_targeted on public.form_items
  using (app.can_access_targeted_version(form_version_id, ( select auth.uid() )));
alter policy form_sections_select_targeted on public.form_sections
  using (app.can_access_targeted_version(form_version_id, ( select auth.uid() )));
alter policy form_versions_select_targeted on public.form_versions
  using (app.can_access_targeted_version(id, ( select auth.uid() )));
alter policy meeting_cases_staff_admin_delete on public.meeting_cases
  using ((app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) AND app.can_read_case(case_id, ( select auth.uid() ))));
alter policy meeting_cases_staff_admin_insert on public.meeting_cases
  with check ((app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) AND app.can_read_case(case_id, ( select auth.uid() ))));
alter policy meeting_cases_staff_admin_update on public.meeting_cases
  using ((app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) AND app.can_read_case(case_id, ( select auth.uid() ))))
  with check ((app.is_staff_admin_of(app.commission_of_meeting(meeting_id)) AND app.can_read_case(case_id, ( select auth.uid() ))));
alter policy meeting_signatures_insert on public.meeting_signatures
  with check (((signer_id = ( select auth.uid() )) AND app.can_sign_meeting(attendee_id, ( select auth.uid() ))));
alter policy professional_credentials_select on public.professional_credentials
  using (((user_id = ( select auth.uid() )) OR app.is_admin() OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = professional_credentials.user_id) AND (p.home_organization_id IS NOT NULL) AND app.is_org_admin_of(p.home_organization_id)))) OR (EXISTS ( SELECT 1
   FROM hospital_affiliations ha
  WHERE ((ha.principal_id = professional_credentials.user_id) AND (ha.voided_at IS NULL) AND app.is_hospital_admin_of(ha.hospital_id)))) OR (EXISTS ( SELECT 1
   FROM (memberships hm
     LEFT JOIN commissions hc ON ((hc.id = hm.commission_id)))
  WHERE ((hm.principal_id = professional_credentials.user_id) AND (COALESCE(hm.hospital_id, hc.hospital_id) IS NOT NULL) AND app.is_hospital_admin_of(COALESCE(hm.hospital_id, hc.hospital_id)))))));
alter policy professional_participants_select on public.professional_participants
  using (app.can_read_professional_profile(professional_profile_id, ( select auth.uid() )));
alter policy professional_profiles_select on public.professional_profiles
  using (app.can_read_professional_profile(id, ( select auth.uid() )));
alter policy profiles_update_self on public.profiles
  using ((id = ( select auth.uid() )))
  with check ((id = ( select auth.uid() )));
alter policy response_group_instances_select on public.response_group_instances
  using ((EXISTS ( SELECT 1
   FROM responses r
  WHERE ((r.id = response_group_instances.response_id) AND ((r.created_by = ( select auth.uid() )) OR ((r.status = 'submitted'::text) AND app.is_staff_admin_of(r.commission_id)))))));
alter policy response_group_instances_write_own_draft on public.response_group_instances
  using ((EXISTS ( SELECT 1
   FROM responses r
  WHERE ((r.id = response_group_instances.response_id) AND (r.created_by = ( select auth.uid() )) AND (r.status = 'in_progress'::text)))))
  with check ((EXISTS ( SELECT 1
   FROM responses r
  WHERE ((r.id = response_group_instances.response_id) AND (r.created_by = ( select auth.uid() )) AND (r.status = 'in_progress'::text)))));
alter policy signoffs_insert on public.response_section_signoffs
  with check (((signed_by = ( select auth.uid() )) AND app.can_sign_section(response_id, section_id, ( select auth.uid() ))));
alter policy responses_delete_own_draft on public.responses
  using (((created_by = ( select auth.uid() )) AND (status = 'in_progress'::text)));
alter policy responses_select_targeted on public.responses
  using (app.can_access_targeted_response(id, ( select auth.uid() )));
alter policy responses_update_targeted on public.responses
  using (app.can_write_targeted_response(id, ( select auth.uid() )))
  with check (app.can_access_targeted_response(id, ( select auth.uid() )));
