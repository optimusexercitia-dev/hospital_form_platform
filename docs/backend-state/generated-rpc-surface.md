# Backend State — the `public` function surface (GENERATED)

> Part of `docs/backend-state/` — **start at [`README.md`](README.md)**, which routes you to the
> one file you need and carries the maintenance rules in full. ⛔ A posted section is FROZEN:
> correct it by APPENDING a `⚠ **Superseded** — … See <file> § <heading>.` marker, never in place.

<!-- DATA-ACCESS-ANCHOR kind=rpc schema=public rows=555 definer=465 invoker=90 trigger=22 aclnull=0 digest=90de15fbe48e1250668ae9516070c9aa -->

⚙ **GENERATED FILE — do not edit by hand.** Every row below is derived from the LIVE
CATALOG and from `src/` by `scripts/gen-data-access-surface.mjs`; rebuild with `npm run data-access:surface`.
`npm run lint:data-access` (gate 17) reds when this file and its pgTAP pin disagree, and
[`supabase/tests/400_data_access_census.sql`](../../supabase/tests/400_data_access_census.sql) reds when the pin and the catalog disagree.
⛔ A correction belongs in the GENERATOR or in the catalog, never in this file: an edit
here is erased by the next run and gated in the meantime.

⛔ **This file carries facts, never judgements.** What a door is FOR, which of its arms is
load-bearing, and whether a flag's flip migration was pushed to production all stay
handwritten in [`data-access.md`](data-access.md), which is frozen and posted (ADR 0196
D5). A catalog knows an ACL; it does not know that re-ordering an enum would open
legal-privileged documents.

**555 functions** in schema `public` — 465 `SECURITY DEFINER`, 90 invoker, 22 trigger functions, 0 with a NULL `proacl`.

⚠ **A NULL `proacl` is rendered `<NULL=PUBLIC>` and means PUBLIC MAY EXECUTE** — it is the default, not an absence of grants. Reading it as "no grants" inverts the fact (the same trap `scripts/catalog-fingerprint.sql` names). ⚠ **A `definer` row's gate REPLACES RLS**, so its EXECUTE list is the whole boundary: `prosecdef` belongs beside `pg_policies`, never read alone (ADR 0078, ADR 0079).

⚠ **22 of these are TRIGGER functions** — invoked only by a `CREATE TRIGGER`, never called by name. They are marked `*(trigger)*` in the Function cell and return `trigger`. This registry is the WHOLE `pg_proc` population of the schema, which is why a trigger's `prosecdef` and ACL are visible here at all; **the directly-callable count is 555 − 22 = 533**. ⛔ So this file is the `public` FUNCTION surface, not a list of RPCs: a `*(trigger)*` row is not reachable over PostgREST and is not a door. The anchor keeps `kind=rpc` as its internal key — that is the pin's join column, not a claim about any row.

## The generated function registry

| Function | Args | Returns | Security | Volatility | EXECUTE |
| --- | --- | --- | --- | --- | --- |
| `public.accept_referral` | `p_referral_id uuid` | `case_referral_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.acknowledge_ethics_notification` | `p_notification_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.acknowledge_event` | `p_event_id uuid` | `patient_safety_event` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.action_items_enabled` | — | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.activate_phase` | `p_case_phase_id uuid, p_assigned_to uuid, p_due_date date` | `case_phases` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_ad_hoc_narrative` | `p_case_id uuid, p_narrative_type_id uuid, p_new_type_label text, p_title text, p_instructions text, p_assigned_to uuid` | `case_narratives` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_ad_hoc_phase` | `p_case_id uuid, p_form_id uuid, p_title text, p_recommend_when jsonb, p_assigned_to uuid` | `case_phases` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_capa_action_evidence` | `p_action_id uuid, p_kind text, p_title text, p_document_id uuid, p_external_url text` | `capa_action_evidence` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_capa_action_task` | `p_action_id uuid, p_description text` | `capa_action_task` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_capa_action` | `p_capa_id uuid, p_title text, p_owner text, p_assignee_user_id uuid, p_due_date date, p_action_strength text, p_success_measure text, p_root_cause_id uuid` | `capa_action` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_capa_measure` | `p_capa_id uuid, p_name text, p_target text, p_definition text` | `capa_measure` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_case_participant` | `p_case_id uuid, p_participant_id uuid, p_role_id uuid, p_is_primary_subject boolean, p_involvement_summary text` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_ethics_allegation` | `p_case_id uuid, p_category_id uuid, p_description_md text, p_severity text, p_alleged_event_date date` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_group_instance` | `p_response_id uuid, p_group_item_id uuid` | `response_group_instances` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_interview_interviewer` | `p_interview_id uuid, p_user_id uuid, p_external_name text, p_external_org text, p_role text, p_note text` | `case_interview_interviewers` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_interview_subject` | `p_interview_id uuid, p_user_id uuid, p_external_name text, p_clinical_role text, p_external_org text, p_note text, p_relationship_to_case text` | `case_interview_subjects` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_meeting_attendee` | `p_meeting_id uuid, p_user_id uuid, p_external_name text, p_external_org text, p_role text, p_attendance text, p_note text` | `meeting_attendees` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_pqs_member` | `p_hospital_id uuid, p_user_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_rca_evidence` | `p_rca_id uuid, p_kind text, p_title text, p_document_id uuid, p_external_url text, p_citation_target text, p_cited_entity_id uuid, p_citation_label text` | `rca_evidence` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_rca_factor` | `p_rca_id uuid, p_category text, p_text text` | `rca_factors` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_rca_member` | `p_rca_id uuid, p_role text, p_user_id uuid, p_external_name text` | `rca_members` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_rca_root_cause` | `p_rca_id uuid, p_text text, p_category text, p_classification text, p_type text` | `rca_root_causes` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_rca_timeline_entry` | `p_rca_id uuid, p_occurred_at timestamp with time zone, p_description text` | `rca_timeline_entries` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_referral_shared_item` | `p_referral_id uuid, p_kind text, p_source_narrative_id uuid, p_source_document_id uuid` | `referral_shared_item` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_reserved_item` | `p_session_id uuid, p_case_id uuid, p_substance text, p_decision text, p_withdrawals text, p_quorum_met boolean, p_reader_uids uuid[]` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_template_narrative` | `p_template_version_id uuid, p_narrative_type_id uuid, p_title text, p_instructions text, p_is_expected boolean` | `process_template_narratives` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.add_template_phase` | `p_template_version_id uuid, p_form_id uuid, p_title text, p_recommend_when jsonb, p_default_due_days integer, p_blocks integer[], p_result_ruleset jsonb, p_emits_result boolean, p_allowed_result_ids jsonb` | `process_template_phases` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.adjudicate_dsr_request` | `p_request_id uuid, p_outcome text, p_outcome_basis text, p_legal_consultation_ref text, p_dispose_meeting_ids uuid[]` | `integer` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.advance_capa_action` | `p_action_id uuid, p_status text` | `capa_action` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.advance_committee_action_item` | `p_id uuid, p_to_status_id uuid, p_comment text` | `action_items` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.affiliate_new_person_for` | `p_actor uuid, p_user uuid, p_hospital uuid, p_employee_id text, p_started_on date, p_job_title text, p_work_email text, p_work_phone text` | `uuid` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.affiliate_new_person_to_org_for` | `p_actor uuid, p_user uuid, p_organization uuid, p_started_on date` | `uuid` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.affiliate_person_for` | `p_actor uuid, p_user uuid, p_hospital uuid, p_employee_id text, p_started_on date, p_job_title text, p_work_email text, p_work_phone text` | `uuid` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.affiliate_person_to_org_for` | `p_actor uuid, p_user uuid, p_organization uuid, p_started_on date` | `uuid` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.affiliate_person_to_org` | `p_user uuid, p_organization uuid, p_started_on date` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.affiliate_person` | `p_user uuid, p_hospital uuid, p_employee_id text, p_started_on date, p_job_title text, p_work_email text, p_work_phone text` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.apply_minutes_review` | `p_job_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.appoint_administrativo` | `p_commission_id uuid, p_user_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.appoint_hospital_dpo` | `p_hospital_id uuid, p_user_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.appoint_technical_director` | `p_hospital uuid, p_user uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.approve_correction` | `p_request_id uuid, p_note text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.approve_document` | `p_version_id uuid, p_note text` | `document_approvals` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.archive_case_assignment_role` | `p_role_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.archive_case_narrative_type` | `p_narrative_type_id uuid` | `case_narrative_types` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.archive_case_outcome` | `p_outcome_id uuid` | `case_outcomes` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.archive_case_tag` | `p_tag_id uuid` | `case_tags` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.archive_ethics_allegation_category` | `p_category_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.archive_ethics_sanction_type` | `p_type_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.archive_event_type` | `p_id uuid` | `pqs_event_types` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.archive_indicator` | `p_id uuid` | `indicators` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.archive_meeting_type` | `p_type_id uuid` | `commission_meeting_types` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.archive_phase_result` | `p_result_id uuid` | `phase_results` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.archive_process_template` | `p_template_id uuid` | `process_templates` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.archive_sentinel_criterion` | `p_id uuid` | `pqs_sentinel_criteria` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.assert_profile_tenant_has_org` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `public.assign_case_tag` | `p_case_id uuid, p_tag_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.assign_ethics_remediation` | `p_decision_id uuid, p_title text, p_description text, p_assigned_to uuid, p_due_date date` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.assign_hospital_admin` | `p_hospital uuid, p_user uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.assign_member_title` | `p_member_id uuid, p_title_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.assign_narrative` | `p_narrative uuid, p_assignee uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.assign_nsp_coordinator` | `p_hospital uuid, p_user uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.assign_nsp_org_admin` | `p_org uuid, p_user uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.assign_org_admin` | `p_org uuid, p_user uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.assign_referral_internal_note` | `p_note_id uuid, p_user_id uuid` | `referral_internal_note_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.assign_referral_reviewer` | `p_referral_id uuid, p_commission_id uuid, p_assignee_user_id uuid, p_assignment_role text, p_due_at timestamp with time zone` | `referral_assignments` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.assume_role` | `p_role platform_role` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.attach_controlled_document_version_file` | `p_version_id uuid, p_core_version_id uuid, p_summary_of_changes_md text, p_expiry_date date` | `controlled_document_versions` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.attest_dsr_task` | `p_task_id uuid, p_reviewer_name text, p_redactions integer, p_note text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.audit_trail_enabled` | — | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.begin_document_upload` | `p_resource_type text, p_resource_id uuid, p_title text, p_description text, p_confidentiality_level text, p_document_id uuid, p_declared_file_name text, p_declared_mime text, p_declared_size bigint, p_kind text, p_occurred_on date` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.bulk_create_cases` | `p_template_id uuid, p_deadline date, p_phase_scope text, p_rows jsonb` | `integer` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.can_dispose_referral_phi` | `p_referral_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.cancel_capa_plan` | `p_capa_id uuid` | `capa_plan` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.cancel_case` | `p_case_id uuid` | `cases` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.cancel_ethics_notification` | `p_notification_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.cancel_event` | `p_event_id uuid` | `patient_safety_event` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.cancel_interview` | `p_interview_id uuid` | `case_interviews` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.cancel_meeting` | `p_meeting_id uuid` | `meetings` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.cancel_minutes_job` | `p_job_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.cancel_referral_assignment` | `p_assignment_id uuid` | `referral_assignments` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.cancel_session` | `p_session_id uuid, p_reason text` | `interview_sessions` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.capa_kpis` | — | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.capa_viewer_can_manage` | `p_capa_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.case_action_items_kpis` | `p_commission_id uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.case_narratives_enabled` | — | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.case_patient_enabled` | — | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.case_phase_results_enabled` | — | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.case_tag_report` | `p_commission_id uuid, p_from date, p_to date` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.case_viewer_capabilities` | `p_case_id uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.cases_extras_enabled` | — | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.cast_case_vote` | `p_decision_id uuid, p_vote text, p_rationale_md text` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.clone_form_version` | `p_source_version_id uuid` | `uuid` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.clone_framework` | `p_framework uuid, p_commission uuid` | `accreditation_frameworks` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.clone_template_version` | `p_source_version_id uuid` | `uuid` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.close_capa_plan` | `p_capa_id uuid, p_lessons_learned_md text` | `capa_plan` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.close_case` | `p_case_id uuid` | `cases` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.close_dsr_request` | `p_request_id uuid, p_outcome text, p_outcome_basis text, p_legal_consultation_ref text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.commission_cadence_overview` | — | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.commission_derive_organization_id` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.commission_overview` | — | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.complete_capa_action` | `p_action_id uuid` | `capa_action` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.complete_committee_action_item` | `p_id uuid` | `action_items` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.complete_document_disposal` | `p_file_object_id uuid, p_byte_proof text` | `void` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.complete_document_reclassification` | `p_document_version_id uuid, p_new_file_object_id uuid, p_old_file_object_id uuid, p_sha256 text` | `jsonb` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.complete_document_upload_verification` | `p_upload_session_id uuid, p_sha256 text, p_verified boolean` | `jsonb` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.complete_dsr_task` | `p_task_id uuid, p_note text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.complete_ethics_hearing` | `p_hearing_id uuid, p_summary_md text, p_outcome_md text, p_respondent_present boolean, p_complainant_present boolean, p_legal_representative_present boolean` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.complete_evidence_upload_verification` | `p_upload_session_id uuid, p_sha256 text, p_verified boolean` | `jsonb` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.complete_minutes_job` | `p_job_id uuid, p_result jsonb, p_transcript text, p_draft jsonb` | `jsonb` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.complete_rca` | `p_rca_id uuid` | `rca` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.complete_session` | `p_session_id uuid, p_actual_end timestamp with time zone` | `interview_sessions` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.compute_derived_measurement` | `p_indicator uuid, p_period_label text, p_denominator numeric, p_period_start date, p_period_end date` | `indicator_measurements` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.compute_due_notifications` | — | `integer` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.conclude_interview` | `p_interview_id uuid` | `case_interviews` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.conclude_meeting` | `p_meeting_id uuid, p_held_at timestamp with time zone, p_held_end timestamp with time zone` | `meetings` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.conclude_narrative` | `p_narrative uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.conclude_referral_internal_note` | `p_note_id uuid` | `referral_internal_note_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.conclude_referral` | `p_referral_id uuid, p_reply_outcome_id uuid, p_result_md text, p_acknowledged_only boolean` | `case_referral_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.confirm_triage` | `p_event_id uuid` | `event_triage` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.count_open_cases_for_board` | `p_commission_id uuid` | `integer` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_case_assignment_role` | `p_org uuid, p_key text, p_display_name text` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_case_decision` | `p_case_id uuid, p_decision_type text, p_summary_md text, p_rationale_md text` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_case_from_template` | `p_template_id uuid, p_label text, p_department_id uuid, p_department_other text, p_case_type_id uuid, p_custom_fields jsonb, p_patient jsonb` | `cases` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_case_narrative_type` | `p_commission_id uuid, p_label text, p_description text` | `case_narrative_types` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_case_outcome` | `p_commission_id uuid, p_label text, p_color_token text, p_requires_action_plan boolean, p_is_adverse boolean` | `case_outcomes` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_case_tag` | `p_commission_id uuid, p_name text, p_color_token text` | `case_tags` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_case` | `p_commission_id uuid, p_label text, p_patient_enabled boolean, p_outcome_ids uuid[], p_department_id uuid, p_department_other text, p_case_type_id uuid, p_patient jsonb` | `cases` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_committee_action_item_checklist` | `p_action_item_id uuid, p_title text, p_sort_order integer` | `action_item_checklists` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_committee_action_item_reminder` | `p_action_item_id uuid, p_reminder_type text, p_offset_days integer` | `action_item_reminders` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_committee_action_item_update` | `p_action_item_id uuid, p_update_type text, p_body text` | `action_item_updates` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_committee_action_item` | `p_commission uuid, p_source_type text, p_meeting_id uuid, p_agenda_item_id uuid, p_case_id uuid, p_title text, p_description text, p_assigned_to uuid, p_urgency_id uuid, p_due_date date, p_source_case_phase_id uuid, p_visibility_scope text` | `action_items` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_controlled_document` | `p_commission uuid, p_title text, p_doc_type text, p_review_cycle_months integer, p_category text, p_tags text[], p_description text` | `controlled_documents` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_dsr_request` | `p_hospital_id uuid, p_mrn text, p_file_ref text, p_encounter text, p_due_days integer` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_ethics_allegation_category` | `p_org uuid, p_key text, p_display_name text` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_ethics_sanction_type` | `p_org uuid, p_key text, p_display_name text` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_event_type` | `p_key text, p_label text, p_description text, p_hospital_id uuid` | `pqs_event_types` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_external_participant` | `p_org uuid, p_type text, p_display_name text` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_form` | `p_commission_id uuid, p_title text, p_description text` | `record` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_framework` | `p_key text, p_name text, p_owner_commission uuid, p_version text, p_description text` | `accreditation_frameworks` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_indicator` | `p_commission uuid, p_name text, p_kind text, p_direction text, p_data_source text, p_frequency text, p_target_comparator text, p_target_value numeric, p_numerator_label text, p_denominator_label text, p_unit text, p_description_md text, p_lower_warn numeric, p_upper_warn numeric, p_derived_config jsonb` | `indicators` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_interview` | `p_case_id uuid, p_title text, p_case_phase_id uuid, p_interview_category text, p_confidentiality_level text` | `case_interviews` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_meeting_agenda_item` | `p_meeting_id uuid, p_title text, p_description text, p_discussion_notes text, p_resolution text` | `uuid` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_meeting_type` | `p_commission_id uuid, p_name text, p_color_token text` | `commission_meeting_types` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_meeting` | `p_commission_id uuid, p_title text, p_meeting_type_id uuid, p_scheduled_start timestamp with time zone, p_scheduled_end timestamp with time zone, p_modality text, p_location_text text, p_meeting_url text` | `meetings` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_member_title` | `p_commission_id uuid, p_name text` | `commission_member_titles` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_minutes_job` | `p_meeting_id uuid, p_filename text` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_phase_result` | `p_commission_id uuid, p_label text, p_color_token text, p_is_adverse boolean` | `phase_results` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_process_template` | `p_commission_id uuid, p_title text, p_description text` | `process_templates` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_professional_profile` | `p_org uuid, p_full_name text, p_professional_type text, p_license_number text, p_license_region text, p_specialty text, p_affiliation_status text, p_user_id uuid` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_referral_draft` | `p_source_case_id uuid, p_target_commission_id uuid, p_referral_type_id uuid, p_subject text, p_response_expected boolean, p_description_md text, p_priority text, p_requested_action_id uuid, p_response_due_at timestamp with time zone, p_parent_referral_id uuid, p_target_hospital_id uuid` | `case_referral_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_referral_internal_note` | `p_referral_id uuid, p_committee_id uuid, p_body_md text, p_title text, p_kind text, p_assigned_to uuid` | `referral_internal_note_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_referral_requested_action` | `p_key text, p_label text, p_description text, p_color_token text, p_position integer` | `referral_requested_actions` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.create_sentinel_criterion` | `p_key text, p_label text, p_description text, p_hospital_id uuid` | `pqs_sentinel_criteria` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.custom_access_token_hook` | `event jsonb` | `jsonb` | **definer** | stable | `postgres=X/postgres,service_role=X/postgres,supabase_auth_admin=X/postgres` |
| `public.dashboard_completion_by_member` | `p_form_id uuid, p_from date, p_to date` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.dashboard_distributions` | `p_form_id uuid, p_from date, p_to date` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.dashboard_entity_references` | `p_form_id uuid, p_from date, p_to date` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.dashboard_export_rows` | `p_form_id uuid, p_from date, p_to date` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.dashboard_form_totals` | `p_commission_id uuid, p_from date, p_to date` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.dashboard_free_text` | `p_form_id uuid, p_from date, p_to date, p_limit integer` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.dashboard_matrix_cells` | `p_form_id uuid, p_from date, p_to date` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.dashboard_risk_scores` | `p_form_id uuid, p_from date, p_to date` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.dashboard_submissions_over_time` | `p_form_id uuid, p_from date, p_to date` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.decide_admissibility` | `p_case_id uuid, p_status text, p_rationale_md text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.declare_conflict` | `p_case_id uuid, p_conflict_type text, p_description_md text` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.decline_referral` | `p_referral_id uuid, p_note text, p_decline_reason_code text` | `case_referral_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.delete_ad_hoc_case_narrative` | `p_narrative_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.delete_ad_hoc_case_phase` | `p_phase_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.delete_block_library_entry` | `p_library_entry_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.delete_capa_action_evidence` | `p_evidence_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.delete_committee_action_item_checklist` | `p_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.delete_committee_action_item_reminder` | `p_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.delete_committee_action_item` | `p_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.delete_credential_for` | `p_actor uuid, p_credential uuid` | `void` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.delete_meeting_agenda_item` | `p_agenda_item_id uuid` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.delete_member_title` | `p_title_id uuid` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.delete_rca_evidence` | `p_evidence_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.delete_section_moving_items` | `p_section_id uuid, p_target_section_id uuid` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.delete_standard` | `p_standard uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.discard_response` | `p_response_id uuid` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.discard_template_draft` | `p_template_version_id uuid` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.dispose_case_phi` | `p_case_id uuid, p_reason text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.dispose_event_phi` | `p_event_id uuid, p_reason text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.dispose_meeting_minutes` | `p_meeting_id uuid, p_reason text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.dispose_referral_phi` | `p_referral_id uuid, p_reason text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.distribute_meeting` | `p_meeting_id uuid` | `meetings` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.document_delete_affordances` | `p_document_ids uuid[]` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.documents_due_for_review` | `p_commission uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.draft_version_of_template` | `p_template_id uuid` | `uuid` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.end_affiliation_for` | `p_actor uuid, p_user uuid, p_hospital uuid, p_ended_on date` | `uuid` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.end_affiliation` | `p_user uuid, p_hospital uuid, p_ended_on date` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.end_org_affiliation_for` | `p_actor uuid, p_user uuid, p_organization uuid, p_ended_on date` | `uuid` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.end_org_affiliation` | `p_user uuid, p_organization uuid, p_ended_on date` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.ensure_professional_participant` | `p_profile_id uuid` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.evidence_candidates` | `p_commission uuid, p_kind text, p_query text` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.fail_minutes_job` | `p_job_id uuid, p_error_code text, p_error_message text` | `jsonb` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.file_correction_request` | `p_kind text, p_case_phase_id uuid, p_case_narrative_id uuid, p_reason text, p_classification text, p_permitted_corrector uuid` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.finalize_document_upload` | `p_upload_session_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.finalize_invited_person_for` | `p_actor uuid, p_user uuid, p_full_name text, p_professional_category_id uuid, p_cpf text, p_date_of_birth date, p_phone text, p_must_change_password boolean` | `void` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.form_item_options_code_immutable` *(trigger)* | — | `trigger` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.form_item_options_parent_is_choice` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.form_item_options_sync_version` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.form_items_sync_version` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_case_detail` | `p_case_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_case_meeting_links` | `p_case_id uuid` | `meeting_cases` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_case_patients` | `p_case_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_case_patient` | `p_case_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_case_professional` | `p_participant_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_ethics_case_procedure` | `p_case_id uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_event_patient` | `p_event_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_feature_flags` | — | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_meeting_agenda_items` | `p_meeting_id uuid` | `meeting_agenda_items` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_meeting_cases` | `p_meeting_id uuid` | `meeting_cases` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_member_overview` | `p_commission uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_own_person_record` | — | `record` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres` |
| `public.get_participant_patient` | `p_participant_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_patient_trajectory_for_entity` | `p_module text, p_entity_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_referral_case_access_summary` | `p_referral_id uuid, p_commission_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_referral_detail` | `p_referral_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_referral_patient` | `p_referral_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_reserved_session_items` | `p_meeting_id uuid` | `record` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_response_for_signoff` | `p_response_id uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_response_validation_errors` | `p_response_id uuid` | `record` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.get_standard_assessment` | `p_commission uuid, p_standard uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.grant_case_access` | `p_case uuid, p_user uuid, p_level text, p_expires_at timestamp with time zone, p_reason text, p_read_standard_phi boolean, p_read_restricted_phi boolean` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.grant_member_capability` | `p_commission_id uuid, p_user_id uuid, p_capability text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.grant_role_for` | `p_actor uuid, p_scope_type text, p_scope_id uuid, p_role text, p_user uuid, p_title_id uuid, p_expires_at timestamp with time zone` | `void` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.grant_role` | `p_scope_type text, p_scope_id uuid, p_role text, p_user uuid, p_title_id uuid, p_expires_at timestamp with time zone` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.guard_default_section_delete` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.guard_profile_no_delete` *(trigger)* | — | `trigger` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.guard_profile_privileged_columns` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.guard_published_structure` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.guard_published_version` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.guard_response_version_commission` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.guard_submitted_children` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.guard_submitted_response` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.guard_submitted_signoffs` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.handle_new_user` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.hospital_document_register` | `p_hospital uuid, p_doc_type text, p_status text, p_review_overdue_only boolean` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.hospital_indicator_rollup` | `p_hospital uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.hospital_readiness` | `p_hospital uuid, p_framework uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.indicator_kpis` | `p_commission uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.indicator_series` | `p_indicator uuid, p_from text, p_to text` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.insert_block_from_library` | `p_library_entry_id uuid, p_section_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.interview_viewer_can_write` | `p_interview_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.interviews_enabled` | — | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.is_nsp_coordinator_of_self` | `p_hospital_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.is_nsp_org_admin_of_self` | `p_org_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.is_pqs_member_of_self` | `p_hospital_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.is_pqs_member_self` | — | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.issue_decision` | `p_decision_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.issue_ethics_notification` | `p_case_id uuid, p_notification_type text, p_delivery_method text, p_recipient_participant_id uuid, p_recipient_user_id uuid, p_due_at timestamp with time zone, p_related_document_id uuid, p_notes_md text` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.lift_recusal` | `p_recusal_id uuid, p_reason_md text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.link_evidence` | `p_commission uuid, p_standard uuid, p_kind text, p_artifact uuid, p_note text` | `evidence_links` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.link_meeting_case` | `p_meeting_id uuid, p_case_id uuid, p_agenda_item_id uuid, p_summary text, p_decision text` | `uuid` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.link_referral_case` | `p_referral_id uuid, p_target_case_id uuid` | `case_referral_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.link_referral_related_case` | `p_referral_id uuid, p_case_id uuid, p_relationship_type text` | `referral_case_links` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_addable_commission_members` | `p_commission_id uuid, p_search text` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_approver_candidates` | `p_commission uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_audit_filter_actors` | `p_commission uuid` | `record` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_case_access` | `p_case uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_cases_board` | `p_commission_id uuid, p_limit integer` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_commission_documents` | `p_commission uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_dsr_disposable_meetings` | `p_request_id uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_hospital_eligible_users_for_pqs` | `p_hospital_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_linkable_org_users` | `p_organization uuid` | `record` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_my_action_items` | `p_commission uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_my_assigned_capa_actions` | — | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_my_cases` | `p_commission uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_my_dsr_hospitals` | — | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_my_dsr_task_commissions` | `p_hospital_id uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_my_executable_dsr_tasks` | `p_hospital_id uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_my_nsp_hospitals` | — | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_my_referral_assignments` | — | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_org_eligible_users` | `p_org_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_org_people` | `p_org_id uuid, p_search text, p_cpf text, p_include_ended boolean` | `record` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_pqs_members` | `p_hospital_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_referral_internal_notes` | `p_referral_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_referral_reply_documents` | `p_referral_id uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_referral_target_commissions` | `p_source_commission_id uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_signoff_queue` | `p_commission_id uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.list_stale_meeting_audio` | `p_older_than_hours integer, p_limit integer` | `record` | **definer** | stable | `postgres=X/postgres,service_role=X/postgres` |
| `public.log_audit_access` | `p_action text, p_entity_type text, p_entity_id uuid, p_commission uuid, p_summary text, p_metadata jsonb` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.log_cpf_probe_for` | `p_actor uuid, p_org_id uuid, p_matched uuid` | `void` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.log_document_previa` | `p_source_kind text, p_source_id uuid, p_template_key text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.lookup_printed_document` | `p_credential text, p_viewer uuid` | `record` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.mark_all_notifications_read` | — | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.mark_document_obsolete` | `p_document_id uuid` | `controlled_documents` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.mark_meeting_held` | `p_meeting_id uuid, p_held_at timestamp with time zone, p_held_end timestamp with time zone` | `meetings` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.mark_notification_read` | `p_id uuid` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.meeting_cadence_status` | `p_commission uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.meetings_enabled` | — | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.mint_printed_document` | `p_id uuid, p_source_kind text, p_source_id uuid, p_template_key text, p_template_version integer, p_content_hash text, p_verification_token text, p_verification_short_code text, p_contains_phi boolean, p_source_revision integer` | `printed_document_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.my_pending_meeting_signatures` | — | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.no_show_session` | `p_session_id uuid, p_reason text` | `interview_sessions` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.notify_safety_event` | `p_reporting_commission_id uuid, p_title text, p_description_md text, p_suspected_harm_level text, p_case_id uuid, p_event_type_id uuid, p_location text, p_discovered_at date` | `patient_safety_event` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.nsp_org_capa_rollup` | `p_org_id uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.nsp_org_event_rollup` | `p_org_id uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.nsp_org_roster` | `p_org_id uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.open_capa_plan` | `p_source text, p_classification text, p_source_id uuid, p_hospital_id uuid` | `capa_plan` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.open_document_version` | `p_document_version_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.open_ethics_external_referral` | `p_decision_id uuid, p_target_commission_id uuid, p_referral_type_id uuid, p_subject text, p_description_md text` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.open_printed_document` | `p_id uuid` | `record` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.open_referral_snapshot_document` | `p_shared_item_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.open_reserved_session` | `p_meeting_id uuid` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.patient_access_audit` | `p_mrn text, p_encounter text, p_hospital_id uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.patient_index_enabled` | — | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.patient_safety_enabled` | — | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.patient_xref_count` | `p_module text, p_entity_id uuid` | `integer` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.place_document_hold` | `p_document_id uuid, p_reason text` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.post_referral_message` | `p_referral_id uuid, p_message_type text, p_body text` | `referral_message_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.pqs_inbox` | `p_status text, p_suspected_harm_level text, p_reporting_commission_id uuid, p_cursor_reported_at timestamp with time zone, p_cursor_id uuid, p_limit integer` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.print_source_state` | `p_source_kind text, p_source_id uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.printed_document_currency` | `p_ids uuid[]` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.processless_cases_enabled` | — | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.provide_referral_information` | `p_referral_id uuid, p_body text` | `case_referral_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.publish_document` | `p_version_id uuid, p_effective_date date, p_review_due_date date, p_expiry_date date` | `controlled_document_versions` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.publish_form_version` | `p_form_version_id uuid, p_approved_by uuid, p_effective_date date, p_review_cycle_months integer, p_review_due_date date` | `form_versions` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.publish_process_template` | `p_template_id uuid` | `process_templates` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.publish_template_version` | `p_template_version_id uuid` | `process_template_versions` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.quality_board_summary` | `p_organization_id uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.rca_writer_can_write` | `p_rca_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.read_minutes_transcript` | `p_job_id uuid` | `text` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.readiness_evidence` | `p_commission uuid, p_standard uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.readiness_report` | `p_commission uuid, p_framework uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reassign_phase` | `p_case_phase_id uuid, p_new_assignee uuid, p_due_date date` | `case_phases` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.receive_referral` | `p_referral_id uuid` | `case_referral_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reclassify_document` | `p_document_id uuid, p_target_tier text` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.recompute_recommendations` | `p_case_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reconcile_item_options` | `p_item_id uuid, p_options jsonb` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.record_capa_effectiveness` | `p_capa_id uuid, p_verdict text, p_method_md text` | `capa_effectiveness` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.record_capa_measure_result` | `p_measure_id uuid, p_period text, p_value numeric, p_note text` | `capa_measure_result` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.record_ethics_finding` | `p_allegation_id uuid, p_finding text, p_rationale_md text, p_evidence_summary_md text` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.record_indicator_measurement` | `p_indicator uuid, p_period_label text, p_numerator numeric, p_denominator numeric, p_note text, p_period_start date, p_period_end date` | `indicator_measurements` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.record_recusal` | `p_case_id uuid, p_user_id uuid, p_reason_md text, p_conflict_declaration_id uuid` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.record_referral_message_receipt` | `p_message_id uuid, p_event text` | `referral_read_receipts` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.record_session_attendance` | `p_session_id uuid, p_participant_id uuid, p_attendance_status text, p_role_at_session text` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.recover_orphan_person_to_org` | `p_user uuid, p_organization uuid, p_started_on date` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres` |
| `public.redact_professional_profile` | `p_profile_id uuid, p_reason text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.redact_referral_message` | `p_message_id uuid, p_reason text` | `referral_message_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.redact_referral_note` | `p_note_id uuid, p_reason text` | `referral_internal_note_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reference_candidates` | `p_response_id uuid, p_item_id uuid, p_query text` | `record` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.referrals_enabled` | — | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reject_answer_on_display_item` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reject_correction` | `p_request_id uuid, p_reason text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reject_document` | `p_version_id uuid, p_note text` | `document_approvals` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reject_invalid_selection` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.release_document_hold` | `p_hold_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.remind_document_approver` | `p_version_id uuid, p_approver_id uuid` | `boolean` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.remove_capa_action_task` | `p_task_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.remove_capa_action` | `p_action_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.remove_capa_measure` | `p_measure_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.remove_case_participant` | `p_case_participant_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.remove_group_instance` | `p_response_id uuid, p_instance_id uuid` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.remove_interview_interviewer` | `p_interviewer_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.remove_interview_subject` | `p_subject_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.remove_meeting_attendee` | `p_attendee_id uuid` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.remove_pqs_member` | `p_hospital_id uuid, p_user_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.remove_rca_factor` | `p_factor_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.remove_rca_member` | `p_member_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.remove_rca_root_cause` | `p_root_cause_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.remove_rca_timeline_entry` | `p_entry_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.remove_referral_shared_item` | `p_shared_item_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.remove_template_narrative` | `p_narrative_id uuid` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.remove_template_phase` | `p_phase_id uuid` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.rename_case_tag` | `p_tag_id uuid, p_name text, p_color_token text` | `case_tags` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.rename_meeting_type` | `p_type_id uuid, p_name text, p_color_token text` | `commission_meeting_types` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.rename_member_title` | `p_title_id uuid, p_name text` | `commission_member_titles` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reopen_capa_plan` | `p_capa_id uuid` | `capa_plan` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reopen_case` | `p_case_id uuid, p_reason text` | `cases` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reopen_interview` | `p_interview_id uuid` | `case_interviews` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reopen_meeting` | `p_meeting_id uuid` | `meetings` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reopen_rca` | `p_rca_id uuid` | `rca` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reopen_referral` | `p_referral_id uuid, p_reason text` | `case_referral_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reopen_triage` | `p_event_id uuid` | `event_triage` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reorder_case_layout_template` | `p_template_version_id uuid, p_ordered jsonb` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reorder_case_narrative_types` | `p_commission_id uuid, p_ordered_ids uuid[]` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reorder_case_outcomes` | `p_commission_id uuid, p_ordered_ids uuid[]` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reorder_departments` | `p_hospital_id uuid, p_ordered_ids uuid[]` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reorder_event_types` | `p_ordered_ids uuid[], p_hospital_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reorder_group_instances` | `p_response_id uuid, p_group_item_id uuid, p_instance_ids uuid[]` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reorder_item` | `p_item_id uuid, p_direction text` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reorder_meeting_agenda_item` | `p_agenda_item_id uuid, p_direction text` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reorder_member_titles` | `p_commission_id uuid, p_ordered_ids uuid[]` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reorder_phase_results` | `p_commission_id uuid, p_ordered_ids uuid[]` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reorder_rca_timeline` | `p_rca_id uuid, p_ordered_ids uuid[]` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reorder_section` | `p_section_id uuid, p_direction text` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reorder_sentinel_criteria` | `p_ordered_ids uuid[], p_hospital_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.reorder_template_phase` | `p_phase_id uuid, p_direction text` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.request_document_disposition` | `p_document_id uuid, p_reason text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.request_referral_information` | `p_referral_id uuid, p_body text` | `case_referral_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.resolve_referral` | `p_referral_id uuid, p_summary_md text, p_follow_up boolean` | `case_referral_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.resubmit_correction` | `p_request_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.review_correction` | `p_request_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.review_ethics_appeal` | `p_appeal_id uuid, p_status text, p_outcome text, p_outcome_rationale_md text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.revoke_administrativo` | `p_commission_id uuid, p_user_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.revoke_case_access` | `p_case uuid, p_user uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.revoke_hospital_admin` | `p_hospital uuid, p_user uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.revoke_hospital_dpo` | `p_hospital_id uuid, p_user_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.revoke_member_capability` | `p_commission_id uuid, p_user_id uuid, p_capability text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.revoke_nsp_coordinator` | `p_hospital uuid, p_user uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.revoke_nsp_org_admin` | `p_org uuid, p_user uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.revoke_org_admin` | `p_org uuid, p_user uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.revoke_printed_document` | `p_id uuid, p_reason_class text, p_reason text` | `printed_document_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.revoke_role_for` | `p_actor uuid, p_scope_type text, p_scope_id uuid, p_role text, p_user uuid` | `void` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.revoke_role` | `p_scope_type text, p_scope_id uuid, p_role text, p_user uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.save_block_to_library` | `p_item_id uuid, p_name text, p_description text` | `form_block_library` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.save_correction_draft_body` | `p_request_id uuid, p_body_md text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.save_minutes_draft` | `p_job_id uuid, p_draft jsonb` | `timestamp with time zone` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.save_narrative_body` | `p_narrative uuid, p_body_md text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.save_referral_patient` | `p_referral_id uuid, p_name text, p_mrn text, p_date_of_birth date, p_age_years integer, p_sex text, p_encounter_ref text, p_unit text, p_attending text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.save_section_answers` | `p_response_id uuid, p_section_id uuid, p_answers jsonb, p_clear_item_ids uuid[], p_observations jsonb, p_selections jsonb, p_other_text jsonb, p_instance_answers jsonb, p_matrix_cells jsonb, p_risk_matrix jsonb, p_references jsonb` | `responses` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.save_triage` | `p_event_id uuid, p_is_pse boolean, p_pse_closure_reason text, p_reach text, p_harm_severity text, p_natural_course boolean, p_review_pathway text, p_disposition_notes_md text, p_sentinel_criteria_ids uuid[]` | `event_triage` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.schedule_ethics_hearing` | `p_case_id uuid, p_hearing_type text, p_meeting_id uuid, p_scheduled_at timestamp with time zone` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.schedule_session` | `p_interview_id uuid, p_session_type text, p_modality text, p_scheduled_start timestamp with time zone, p_scheduled_end timestamp with time zone, p_location_text text, p_meeting_url text` | `interview_sessions` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.search_patient_xref` | `p_mrn text, p_encounter text, p_hospital_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.seed_expected_meeting_attendees` | `p_meeting_id uuid` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.seed_selected_meeting_attendees` | `p_meeting_id uuid, p_user_ids uuid[]` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.send_referral` | `p_referral_id uuid` | `case_referral_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.session_context` | — | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_capa_action_task_done` | `p_task_id uuid, p_is_done boolean` | `capa_action_task` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_case_confidentiality` | `p_case_id uuid, p_level text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_case_narrative_assignment_role` | `p_narrative_id uuid, p_role_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_case_offered_outcomes` | `p_case_id uuid, p_outcome_ids uuid[]` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_case_outcome` | `p_case_id uuid, p_outcome_id uuid` | `cases` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_case_participant_role` | `p_case_participant_id uuid, p_role_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_case_patient` | `p_case_id uuid, p_name text, p_mrn text, p_date_of_birth date, p_age_years integer, p_sex text, p_encounter_ref text, p_unit text, p_attending text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_case_phase_assignment_role` | `p_phase_id uuid, p_role_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_case_phase_result_override` | `p_case_phase_id uuid, p_result_id uuid, p_reason text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_case_visibility` | `p_case_id uuid, p_policy text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_commission_oversight` | `p_commission_id uuid, p_oversight text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_document_confidentiality` | `p_document_id uuid, p_level text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_ethics_decision_details` | `p_decision_id uuid, p_sanction_type_id uuid, p_sanction_start_date date, p_sanction_end_date date, p_remediation_required boolean, p_remediation_description_md text, p_external_reporting_required boolean, p_external_reporting_target text, p_external_reporting_deadline timestamp with time zone, p_appeal_allowed boolean, p_appeal_deadline timestamp with time zone, p_decision_letter_document_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_event_patient` | `p_event_id uuid, p_name text, p_mrn text, p_date_of_birth date, p_age_years integer, p_sex text, p_encounter_ref text, p_unit text, p_attending text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_framework_status` | `p_framework uuid, p_status text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_indicator_target` | `p_id uuid, p_target_value numeric, p_target_comparator text, p_lower_warn numeric, p_upper_warn numeric` | `indicators` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_interview_confidentiality` | `p_interview_id uuid, p_level text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_interview_interviewer_participant` | `p_interviewer_id uuid, p_participant_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_interview_participant` | `p_interview_id uuid, p_participant_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_interview_subject_participant` | `p_subject_id uuid, p_participant_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_item_validations` | `p_item_id uuid, p_rules jsonb` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_meeting_held_window` | `p_meeting_id uuid, p_held_at timestamp with time zone, p_held_end timestamp with time zone` | `meetings` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_meeting_quorum_met` | `p_meeting_id uuid, p_quorum_met boolean` | `meetings` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_notification_preferences` | `p_surface text, p_enabled boolean` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_participant_patient` | `p_case_id uuid, p_participant_id uuid, p_name text, p_mrn text, p_date_of_birth date, p_age_years integer, p_sex text, p_encounter_ref text, p_unit text, p_attending text, p_role_id uuid` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_person_active_for` | `p_actor uuid, p_user uuid, p_active boolean` | `void` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.set_pqs_rca_due_window` | `p_hospital_id uuid, p_days integer` | `integer` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_primary_subject` | `p_case_participant_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_process_outcomes` | `p_template_version_id uuid, p_outcome_ids uuid[]` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_professional_link_state` | `p_profile_id uuid, p_link_state text, p_user_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_rca_factor_key` | `p_factor_id uuid, p_is_key boolean` | `rca_factors` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_rca_why_root` | `p_factor_id uuid, p_root_text text` | `rca_why_chains` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_rca_why_step` | `p_factor_id uuid, p_index integer, p_text text` | `rca_why_chains` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_referral_deadline` | `p_referral_id uuid, p_response_due_at timestamp with time zone` | `case_referral_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_referral_patient` | `p_referral_id uuid, p_name text, p_mrn text, p_date_of_birth date, p_age_years integer, p_sex text, p_encounter_ref text, p_unit text, p_attending text` | `void` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.set_standard_assessment` | `p_commission uuid, p_standard uuid, p_status text, p_note_md text` | `standard_assessments` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_standard_ownership` | `p_hospital uuid, p_standard uuid, p_commission uuid` | `standard_ownerships` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_template_case_type` | `p_template_version_id uuid, p_case_type_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_template_patient_mode` | `p_template_version_id uuid, p_mode text, p_required_fields text[]` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.set_template_phase_blocks` | `p_phase_id uuid, p_blocks integer[]` | `process_template_phases` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.sign_meeting` | `p_attendee_id uuid, p_method text, p_note text` | `meeting_signatures` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.sign_section` | `p_response_id uuid, p_section_id uuid, p_note text` | `response_section_signoffs` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.skip_phase` | `p_case_phase_id uuid` | `case_phases` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.snap_referral_commission_names` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.soft_delete_document` | `p_document_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.start_correction_draft` | `p_request_id uuid` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.start_or_resume_phase` | `p_case_phase_id uuid` | `responses` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.start_or_resume_response` | `p_form_version_id uuid` | `responses` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.start_referral_review` | `p_referral_id uuid` | `case_referral_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.start_session` | `p_session_id uuid` | `interview_sessions` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.submit_document_for_approval` | `p_version_id uuid, p_approvers jsonb, p_proposed_effective_date date, p_approval_due_date date` | `controlled_document_versions` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.submit_ethics_appeal` | `p_case_id uuid, p_decision_id uuid, p_appeal_reason_md text, p_submitted_by_participant_id uuid` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.submit_minutes_job` | `p_job_id uuid, p_service_job_id text` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.submit_rca_for_review` | `p_rca_id uuid` | `rca` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.submit_response` | `p_response_id uuid` | `responses` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.submit_targeted_case_response` | `p_response_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.suggest_carry_forward` | `p_commission uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.supersede_document` | `p_document_id uuid` | `controlled_document_versions` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.supersede_response` | `p_response_id uuid, p_reason text` | `responses` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.suspend_person_for` | `p_actor uuid, p_user uuid, p_suspended_until timestamp with time zone` | `void` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.sync_case_phase_on_submit` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.sync_profile_email_confirmed` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.sync_profile_email` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.target_case_response` | `p_response_id uuid, p_case_participant_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.tenant_orphan_profiles` | — | `record` | **definer** | stable | `postgres=X/postgres,service_role=X/postgres` |
| `public.toggle_committee_action_item_checklist` | `p_id uuid, p_is_done boolean` | `action_item_checklists` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.transfer_event_custody` | `p_event_id uuid, p_to_owner_kind text, p_to_commission_id uuid, p_note text` | `patient_safety_event` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.triage_disposition` | `p_event_id uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.unassign_case_tag` | `p_case_id uuid, p_tag_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.unassign_narrative` | `p_narrative uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.unassign_referral_internal_note` | `p_note_id uuid` | `referral_internal_note_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.unlink_evidence` | `p_link uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.unlink_meeting_case` | `p_case_link_id uuid` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.unlink_referral_case` | `p_link_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_affiliation_for` | `p_actor uuid, p_user uuid, p_hospital uuid, p_employee_id text, p_started_on date, p_clear_employee_id boolean, p_job_title text, p_work_email text, p_work_phone text, p_clear_job_title boolean, p_clear_work_email boolean, p_clear_work_phone boolean` | `uuid` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.update_affiliation` | `p_user uuid, p_hospital uuid, p_employee_id text, p_started_on date, p_clear_employee_id boolean, p_job_title text, p_work_email text, p_work_phone text, p_clear_job_title boolean, p_clear_work_email boolean, p_clear_work_phone boolean` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_block_library_entry` | `p_library_entry_id uuid, p_name text, p_description text` | `form_block_library` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_capa_action` | `p_action_id uuid, p_title text, p_owner text, p_assignee_user_id uuid, p_due_date date, p_action_strength text, p_success_measure text, p_root_cause_id uuid` | `capa_action` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_capa_measure` | `p_measure_id uuid, p_name text, p_target text, p_definition text` | `capa_measure` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_capa_plan` | `p_capa_id uuid, p_classification text` | `capa_plan` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_case_custom_field_values` | `p_case_id uuid, p_values jsonb` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_case_meta` | `p_case_id uuid, p_label text, p_department_id uuid, p_department_other text` | `cases` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_case_narrative_body` | `p_narrative_id uuid, p_body_md text` | `case_narratives` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_case_narrative_type` | `p_narrative_type_id uuid, p_label text, p_description text` | `case_narrative_types` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_case_outcome` | `p_outcome_id uuid, p_label text, p_color_token text, p_requires_action_plan boolean, p_is_adverse boolean` | `case_outcomes` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_committee_action_item_checklist` | `p_id uuid, p_title text, p_sort_order integer` | `action_item_checklists` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_committee_action_item_reminder` | `p_id uuid, p_is_active boolean` | `action_item_reminders` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_committee_action_item` | `p_id uuid, p_title text, p_description text, p_assigned_to uuid, p_urgency_id uuid, p_due_date date, p_visibility_scope text` | `action_items` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_controlled_document` | `p_id uuid, p_title text, p_doc_type text, p_review_cycle_months integer, p_category text, p_tags text[], p_description text` | `controlled_documents` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_ethics_allegation` | `p_allegation_id uuid, p_category_id uuid, p_description_md text, p_severity text, p_alleged_event_date date, p_status text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_event_type` | `p_id uuid, p_label text, p_description text` | `pqs_event_types` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_event` | `p_event_id uuid, p_title text, p_description_md text, p_suspected_harm_level text, p_event_type_id uuid, p_location text, p_discovered_at date` | `patient_safety_event` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_framework` | `p_framework uuid, p_name text, p_version text, p_description text` | `accreditation_frameworks` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_indicator` | `p_id uuid, p_name text, p_kind text, p_direction text, p_data_source text, p_frequency text, p_target_comparator text, p_target_value numeric, p_numerator_label text, p_denominator_label text, p_unit text, p_description_md text, p_lower_warn numeric, p_upper_warn numeric, p_derived_config jsonb` | `indicators` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_interview_interviewer` | `p_interviewer_id uuid, p_role text, p_note text, p_external_name text, p_external_org text` | `case_interview_interviewers` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_interview_subject` | `p_subject_id uuid, p_clinical_role text, p_note text, p_external_name text, p_external_org text, p_relationship_to_case text` | `case_interview_subjects` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_interview_summary` | `p_interview_id uuid, p_summary_md text` | `case_interviews` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_interview` | `p_interview_id uuid, p_title text, p_case_phase_id uuid, p_interview_category text, p_confidentiality_level text` | `case_interviews` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_meeting_agenda_item` | `p_agenda_item_id uuid, p_title text, p_description text, p_discussion_notes text, p_resolution text` | `uuid` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_meeting_attendee` | `p_attendee_id uuid, p_role text, p_attendance text, p_note text, p_external_name text, p_external_org text` | `meeting_attendees` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_meeting_minutes` | `p_meeting_id uuid, p_minutes_md text` | `meetings` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_meeting_settings` | `p_commission_id uuid, p_quorum_rule_type text, p_quorum_value numeric` | `commission_meeting_settings` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_meeting` | `p_meeting_id uuid, p_title text, p_scheduled_start timestamp with time zone, p_modality text, p_meeting_type_id uuid, p_scheduled_end timestamp with time zone, p_location_text text, p_meeting_url text, p_minutes_md text` | `meetings` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_org_affiliation_for` | `p_actor uuid, p_user uuid, p_organization uuid, p_started_on date` | `uuid` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.update_org_affiliation` | `p_user uuid, p_organization uuid, p_started_on date` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_person_fields_for` | `p_actor uuid, p_user uuid, p_full_name text, p_professional_category_id uuid, p_set_cpf boolean, p_cpf text, p_set_date_of_birth boolean, p_date_of_birth date, p_set_phone boolean, p_phone text` | `void` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.update_phase_result` | `p_result_id uuid, p_label text, p_color_token text, p_is_adverse boolean` | `phase_results` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_professional_profile` | `p_profile_id uuid, p_full_name text, p_professional_type text, p_license_number text, p_license_region text, p_specialty text, p_affiliation_status text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_rca_factor` | `p_factor_id uuid, p_text text` | `rca_factors` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_rca_member_role` | `p_member_id uuid, p_role text` | `rca_members` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_rca_root_cause` | `p_root_cause_id uuid, p_text text, p_category text, p_classification text, p_type text` | `rca_root_causes` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_rca_timeline_entry` | `p_entry_id uuid, p_occurred_at timestamp with time zone, p_description text` | `rca_timeline_entries` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_rca` | `p_rca_id uuid, p_what_md text, p_expected_md text, p_detected text, p_impact text, p_scope text, p_summary_md text` | `rca` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_referral_assignment` | `p_assignment_id uuid, p_status text, p_due_at timestamp with time zone, p_assignment_role text` | `referral_assignments` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_referral_draft` | `p_referral_id uuid, p_referral_type_id uuid, p_subject text, p_description_md text, p_response_expected boolean, p_priority text, p_requested_action_id uuid, p_response_due_at timestamp with time zone` | `case_referral_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_referral_internal_note` | `p_note_id uuid, p_title text, p_body_md text, p_kind text` | `referral_internal_note_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_referral_requested_action` | `p_id uuid, p_label text, p_description text, p_color_token text, p_position integer, p_is_active boolean` | `referral_requested_actions` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_sentinel_criterion` | `p_id uuid, p_label text, p_description text` | `pqs_sentinel_criteria` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_session` | `p_session_id uuid, p_session_type text, p_modality text, p_scheduled_start timestamp with time zone, p_scheduled_end timestamp with time zone, p_location_text text, p_meeting_url text` | `interview_sessions` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_template_narrative` | `p_narrative_id uuid, p_title text, p_instructions text, p_is_expected boolean, p_clear_title boolean, p_clear_instructions boolean` | `process_template_narratives` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.update_template_phase` | `p_phase_id uuid, p_form_id uuid, p_title text, p_recommend_when jsonb, p_clear_recommend_when boolean, p_default_due_days integer, p_clear_default_due_days boolean, p_blocks integer[], p_clear_blocks boolean, p_result_ruleset jsonb, p_clear_result_ruleset boolean, p_emits_result boolean, p_allowed_result_ids jsonb, p_clear_allowed_result_ids boolean` | `process_template_phases` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.upsert_commission_charter` | `p_commission uuid, p_meeting_frequency text, p_controlled_document_id uuid` | `jsonb` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.upsert_credential_for` | `p_actor uuid, p_user uuid, p_id uuid, p_issuing_country text, p_issuing_state text, p_issuing_authority text, p_registration_number text, p_expires_on date` | `uuid` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.upsert_ethics_case_details` | `p_case_id uuid, p_complaint_channel text, p_complaint_received_at timestamp with time zone, p_summary_md text` | `ethics_case_details` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.upsert_matrix_axes` | `p_item_id uuid, p_rows jsonb, p_columns jsonb` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.upsert_standard` | `p_framework uuid, p_code text, p_title text, p_id uuid, p_parent uuid, p_description_md text, p_position integer, p_level smallint` | `accreditation_standards` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.validate_visible_when` | `p_form_version_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.verify_audit_chain` | `p_commission uuid, p_organization uuid, p_hospital uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.void_affiliation_for` | `p_actor uuid, p_affiliation uuid, p_reason text` | `uuid` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.void_affiliation` | `p_affiliation uuid, p_reason text` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.void_decision` | `p_decision_id uuid, p_reason text` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.void_org_affiliation_for` | `p_actor uuid, p_org_affiliation uuid, p_reason text` | `uuid` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `public.void_org_affiliation` | `p_org_affiliation uuid, p_reason text` | `uuid` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.withdraw_correction` | `p_request_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `public.withdraw_referral` | `p_referral_id uuid` | `case_referral_public` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
