# AE0.3 — Local/remote parity check (ADR 0155, Phase AE0)

- **Date measured:** 2026-08-26.
- **Task:** AE0.3 per `docs/plans/authz-evolution.md` § Phase AE0 — "`supabase migration list
  --linked` vs local head; both advisors (security + performance) on the linked project; any
  local-only or remote-only finding is explained in writing or the phase does not close."
- **Stacks:**
  - **Local** — Docker container `supabase_db_azkbbhskturikxpgmafq`, reached with
    `docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -tAc "<query>"`
    (no `psql` on host PATH). Reset fresh by the lead immediately before this phase
    (verified: 475 migrations, head `20261003004300`). PostgreSQL 17.6 (x86_64-linux).
  - **Remote (linked)** — Supabase project `azkbbhskturikxpgmafq`, reached read-only via the
    Supabase MCP tools (`list_migrations`, `execute_sql`, `get_advisors`) and, as the plan's
    named instrument only (not trusted as authority — see § Method note), `npx supabase
    migration list --linked`. PostgreSQL 17.6 (aarch64-linux). No DDL/DML was issued against
    remote — every remote call in this report is a `select`.
  - CLI: Supabase CLI `2.115.0` (`npx supabase --version`).
- **Method note (binding on this doc):** the catalog is the authority, never a CLI's summary
  and never a re-derivation whose own correctness is unverified. Every figure below states the
  exact query and which stack it ran against. Where a derived/aggregated number could not be
  independently reproduced with confidence (see § 4.3), that is stated plainly rather than
  papered over with a matching total.

---

## 1. Migration registry parity

| Figure | Value | Query / command | Stack |
| --- | --- | --- | --- |
| On-disk `.sql` files | 475 | `ls supabase/migrations/*.sql \| wc -l` | local filesystem |
| Git-tracked `.sql` files | 475 | `git ls-files supabase/migrations/*.sql \| wc -l` | local filesystem (repo) |
| Working-tree diff on migrations dir | none | `git status --porcelain supabase/migrations/` (empty output) | local filesystem |
| Registered migrations | 475 | `select count(*) from supabase_migrations.schema_migrations;` | **local** DB |
| Local head | `20261003004300` | `select max(version) from supabase_migrations.schema_migrations;` | **local** DB |
| Registered migrations | 475 | `select count(*), max(version), min(version) from supabase_migrations.schema_migrations;` (via `execute_sql`) | **remote** DB |
| Remote head | `20261003004300` | (same query) | **remote** DB |
| Remote earliest | `20260620000000` | (same query) | **remote** DB |

**Closure holds on both sides:**
- Local: registered (475) == on-disk files (475) == git-tracked files (475). No untracked or
  uncommitted migration files, no registry drift.
- Remote: registered (475) == local registered (475), same head.

**Full version-set comparison (not just counts).** Dumped `select version from
supabase_migrations.schema_migrations order by version;` from both stacks and diffed the
complete ordered list of 475 version strings against each other, and separately against the
on-disk filename-derived version list (`ls supabase/migrations/*.sql | sed -E
's#.*/([0-9]{14})_.*#\1#' | sort`). All three sets are **byte-identical** — `diff` produced no
output in any of the three pairwise comparisons. **Zero versions present on one side and absent
from the other.**

**CLI cross-check (the plan's named instrument, not trusted as authority).** `npx supabase
migration list --linked` — exit code 0. Parsed its JSON output (475 `{local, remote, time}`
entries): 0 entries with `local` set and no `remote`, 0 entries with `remote` set and no
`local`; last paired entry `{"local":"20261003004300","remote":"20261003004300"}`. This
corroborates the catalog-derived figures above but is not itself the proof — the two
`schema_migrations` queries are.

**Verdict: zero migration-registry divergence, local vs. remote, by version number.**

---

## 2. Security advisor — full findings (linked project `azkbbhskturikxpgmafq`)

Fetched via `get_advisors(project_id, type="security")`. The call returned 447 typed lint
objects across 5 distinct rule names, each carrying `title`, `level`, `description`, a
`remediation` URL, and rule-specific `metadata` — this is what confirms the advisor actually
ran and returned real content, not an empty/error result swallowed silently (an error would
have surfaced as a tool error, and a vacuous "advisor didn't run" would show 0 rows with no
rule diversity).

| Rule | Level | Count |
| --- | --- | --- |
| `rls_enabled_no_policy` | INFO | 7 |
| `function_search_path_mutable` | WARN | 6 |
| `authenticated_security_definer_function_executable` | WARN | 432 |
| `auth_leaked_password_protection` | WARN | 1 |
| `auth_insufficient_mfa_options` | WARN | 1 |
| **Total** | | **447** |

### 2.1 `rls_enabled_no_policy` (INFO, 7) — full list

| Table |
| --- |
| public.case_print_revisions |
| public.meeting_closed_session_item_readers |
| public.meeting_closed_session_items |
| public.patient_identifiers |
| public.patient_participants |
| public.referral_patient |
| public.verification_lookups |

Four of these (`patient_identifiers`, `patient_participants`, `referral_patient`, and by the
same pattern likely `case_print_revisions`/`verification_lookups`) match ARCHITECTURE.md's
documented "audited single door, zero policies" shape (Rule 1's second pattern) — a policy
there would be unreachable code. This report does not adjudicate design correctness (that is
AE1's remit); it records the finding and its parity status only.

### 2.2 `function_search_path_mutable` (WARN, 6) — full list

| Function |
| --- |
| app._cap_bit |
| app.assert_documents_wave_c_enabled |
| app.guard_affiliation_no_delete |
| app.matrix_axis_entries |
| app.participant_type_label |
| public.guard_profile_no_delete |

### 2.3 `authenticated_security_definer_function_executable` (WARN, 432) — full list

`SECURITY DEFINER` functions in `public` for which the `authenticated` role holds `EXECUTE`.
This is the expected shape of this codebase's authorization model (DEFINER-door pattern,
ARCHITECTURE.md Rule 1) — most of the platform's write/read doors are exactly this. Full list:

| Function |
| --- |
| public.accept_referral |
| public.acknowledge_ethics_notification |
| public.acknowledge_event |
| public.action_items_enabled |
| public.activate_phase |
| public.add_ad_hoc_narrative |
| public.add_capa_action_evidence |
| public.add_capa_action_task |
| public.add_capa_action |
| public.add_capa_measure |
| public.add_case_participant |
| public.add_ethics_allegation |
| public.add_interview_interviewer |
| public.add_interview_subject |
| public.add_pqs_member |
| public.add_rca_evidence |
| public.add_rca_factor |
| public.add_rca_member |
| public.add_rca_root_cause |
| public.add_rca_timeline_entry |
| public.add_referral_shared_item |
| public.add_reserved_item |
| public.adjudicate_dsr_request |
| public.advance_capa_action |
| public.advance_committee_action_item |
| public.affiliate_person_to_org |
| public.affiliate_person |
| public.apply_minutes_review |
| public.appoint_administrativo |
| public.appoint_hospital_dpo |
| public.appoint_technical_director |
| public.approve_correction |
| public.approve_document |
| public.archive_case_assignment_role |
| public.archive_ethics_allegation_category |
| public.archive_ethics_sanction_type |
| public.archive_event_type |
| public.archive_indicator |
| public.archive_sentinel_criterion |
| public.assign_case_tag |
| public.assign_ethics_remediation |
| public.assign_hospital_admin |
| public.assign_member_title |
| public.assign_narrative |
| public.assign_nsp_coordinator |
| public.assign_nsp_org_admin |
| public.assign_org_admin |
| public.assign_referral_internal_note |
| public.assign_referral_reviewer |
| public.assume_role |
| public.attach_controlled_document_version_file |
| public.attest_dsr_task |
| public.audit_trail_enabled |
| public.begin_document_upload |
| public.bulk_create_cases |
| public.can_dispose_referral_phi |
| public.cancel_capa_plan |
| public.cancel_ethics_notification |
| public.cancel_event |
| public.cancel_interview |
| public.cancel_minutes_job |
| public.cancel_referral_assignment |
| public.cancel_session |
| public.capa_kpis |
| public.capa_viewer_can_manage |
| public.case_action_items_kpis |
| public.case_narratives_enabled |
| public.case_patient_enabled |
| public.case_phase_results_enabled |
| public.case_tag_report |
| public.case_viewer_capabilities |
| public.cases_extras_enabled |
| public.cast_case_vote |
| public.clone_framework |
| public.close_capa_plan |
| public.close_dsr_request |
| public.commission_cadence_overview |
| public.commission_derive_organization_id |
| public.commission_overview |
| public.complete_capa_action |
| public.complete_committee_action_item |
| public.complete_dsr_task |
| public.complete_ethics_hearing |
| public.complete_rca |
| public.complete_session |
| public.compute_derived_measurement |
| public.conclude_interview |
| public.conclude_meeting |
| public.conclude_narrative |
| public.conclude_referral_internal_note |
| public.conclude_referral |
| public.confirm_triage |
| public.count_open_cases_for_board |
| public.create_case_assignment_role |
| public.create_case_decision |
| public.create_case_from_template |
| public.create_case |
| public.create_committee_action_item_checklist |
| public.create_committee_action_item_reminder |
| public.create_committee_action_item_update |
| public.create_committee_action_item |
| public.create_controlled_document |
| public.create_dsr_request |
| public.create_ethics_allegation_category |
| public.create_ethics_sanction_type |
| public.create_event_type |
| public.create_external_participant |
| public.create_framework |
| public.create_indicator |
| public.create_interview |
| public.create_minutes_job |
| public.create_professional_profile |
| public.create_referral_draft |
| public.create_referral_internal_note |
| public.create_referral_requested_action |
| public.create_sentinel_criterion |
| public.dashboard_completion_by_member |
| public.dashboard_distributions |
| public.dashboard_entity_references |
| public.dashboard_export_rows |
| public.dashboard_form_totals |
| public.dashboard_free_text |
| public.dashboard_matrix_cells |
| public.dashboard_risk_scores |
| public.dashboard_submissions_over_time |
| public.decide_admissibility |
| public.declare_conflict |
| public.decline_referral |
| public.delete_ad_hoc_case_narrative |
| public.delete_ad_hoc_case_phase |
| public.delete_block_library_entry |
| public.delete_capa_action_evidence |
| public.delete_committee_action_item_checklist |
| public.delete_committee_action_item_reminder |
| public.delete_committee_action_item |
| public.delete_rca_evidence |
| public.delete_standard |
| public.dispose_case_phi |
| public.dispose_event_phi |
| public.dispose_meeting_minutes |
| public.dispose_referral_phi |
| public.document_delete_affordances |
| public.documents_due_for_review |
| public.end_affiliation |
| public.end_org_affiliation |
| public.ensure_professional_participant |
| public.evidence_candidates |
| public.file_correction_request |
| public.finalize_document_upload |
| public.form_item_options_parent_is_choice |
| public.form_item_options_sync_version |
| public.form_items_sync_version |
| public.get_case_detail |
| public.get_case_meeting_links |
| public.get_case_patient |
| public.get_case_patients |
| public.get_case_professional |
| public.get_ethics_case_procedure |
| public.get_event_patient |
| public.get_feature_flags |
| public.get_meeting_agenda_items |
| public.get_meeting_cases |
| public.get_member_overview |
| public.get_own_person_record |
| public.get_participant_patient |
| public.get_patient_trajectory_for_entity |
| public.get_referral_case_access_summary |
| public.get_referral_detail |
| public.get_referral_patient |
| public.get_reserved_session_items |
| public.get_response_for_signoff |
| public.get_standard_assessment |
| public.grant_case_access |
| public.grant_member_capability |
| public.grant_role |
| public.guard_default_section_delete |
| public.guard_profile_privileged_columns |
| public.guard_published_structure |
| public.guard_published_version |
| public.guard_response_version_commission |
| public.guard_submitted_children |
| public.guard_submitted_response |
| public.guard_submitted_signoffs |
| public.handle_new_user |
| public.hospital_document_register |
| public.hospital_indicator_rollup |
| public.hospital_readiness |
| public.indicator_kpis |
| public.indicator_series |
| public.insert_block_from_library |
| public.interview_viewer_can_write |
| public.interviews_enabled |
| public.is_nsp_coordinator_of_self |
| public.is_nsp_org_admin_of_self |
| public.is_pqs_member_of_self |
| public.is_pqs_member_self |
| public.issue_decision |
| public.issue_ethics_notification |
| public.lift_recusal |
| public.link_evidence |
| public.link_referral_case |
| public.link_referral_related_case |
| public.list_addable_commission_members |
| public.list_approver_candidates |
| public.list_case_access |
| public.list_cases_board |
| public.list_commission_documents |
| public.list_dsr_disposable_meetings |
| public.list_hospital_eligible_users_for_pqs |
| public.list_my_action_items |
| public.list_my_assigned_capa_actions |
| public.list_my_cases |
| public.list_my_dsr_hospitals |
| public.list_my_dsr_task_commissions |
| public.list_my_executable_dsr_tasks |
| public.list_my_nsp_hospitals |
| public.list_my_referral_assignments |
| public.list_org_eligible_users |
| public.list_org_people |
| public.list_pqs_members |
| public.list_referral_internal_notes |
| public.list_referral_reply_documents |
| public.list_referral_target_commissions |
| public.list_signoff_queue |
| public.log_audit_access |
| public.log_document_previa |
| public.mark_document_obsolete |
| public.meeting_cadence_status |
| public.meetings_enabled |
| public.mint_printed_document |
| public.my_pending_meeting_signatures |
| public.no_show_session |
| public.notify_safety_event |
| public.nsp_org_capa_rollup |
| public.nsp_org_event_rollup |
| public.nsp_org_roster |
| public.open_capa_plan |
| public.open_document_version |
| public.open_ethics_external_referral |
| public.open_printed_document |
| public.open_referral_snapshot_document |
| public.open_reserved_session |
| public.patient_access_audit |
| public.patient_index_enabled |
| public.patient_safety_enabled |
| public.patient_xref_count |
| public.place_document_hold |
| public.post_referral_message |
| public.pqs_inbox |
| public.print_source_state |
| public.printed_document_currency |
| public.processless_cases_enabled |
| public.provide_referral_information |
| public.publish_document |
| public.quality_board_summary |
| public.rca_writer_can_write |
| public.read_minutes_transcript |
| public.readiness_evidence |
| public.readiness_report |
| public.reassign_phase |
| public.receive_referral |
| public.reclassify_document |
| public.recompute_recommendations |
| public.record_capa_effectiveness |
| public.record_capa_measure_result |
| public.record_ethics_finding |
| public.record_indicator_measurement |
| public.record_recusal |
| public.record_referral_message_receipt |
| public.record_session_attendance |
| public.redact_professional_profile |
| public.redact_referral_message |
| public.redact_referral_note |
| public.referrals_enabled |
| public.reject_answer_on_display_item |
| public.reject_correction |
| public.reject_document |
| public.reject_invalid_selection |
| public.release_document_hold |
| public.remind_document_approver |
| public.remove_capa_action_task |
| public.remove_capa_action |
| public.remove_capa_measure |
| public.remove_case_participant |
| public.remove_interview_interviewer |
| public.remove_interview_subject |
| public.remove_pqs_member |
| public.remove_rca_factor |
| public.remove_rca_member |
| public.remove_rca_root_cause |
| public.remove_rca_timeline_entry |
| public.remove_referral_shared_item |
| public.reopen_capa_plan |
| public.reopen_case |
| public.reopen_interview |
| public.reopen_meeting |
| public.reopen_rca |
| public.reopen_referral |
| public.reopen_triage |
| public.reorder_departments |
| public.reorder_event_types |
| public.reorder_rca_timeline |
| public.reorder_sentinel_criteria |
| public.request_document_disposition |
| public.request_referral_information |
| public.resolve_referral |
| public.resubmit_correction |
| public.review_correction |
| public.review_ethics_appeal |
| public.revoke_administrativo |
| public.revoke_case_access |
| public.revoke_hospital_admin |
| public.revoke_hospital_dpo |
| public.revoke_member_capability |
| public.revoke_nsp_coordinator |
| public.revoke_nsp_org_admin |
| public.revoke_org_admin |
| public.revoke_printed_document |
| public.revoke_role |
| public.save_block_to_library |
| public.save_correction_draft_body |
| public.save_minutes_draft |
| public.save_narrative_body |
| public.save_referral_patient |
| public.save_triage |
| public.schedule_ethics_hearing |
| public.schedule_session |
| public.search_patient_xref |
| public.send_referral |
| public.session_context |
| public.set_capa_action_task_done |
| public.set_case_confidentiality |
| public.set_case_narrative_assignment_role |
| public.set_case_offered_outcomes |
| public.set_case_participant_role |
| public.set_case_patient |
| public.set_case_phase_assignment_role |
| public.set_case_phase_result_override |
| public.set_case_visibility |
| public.set_commission_oversight |
| public.set_document_confidentiality |
| public.set_ethics_decision_details |
| public.set_event_patient |
| public.set_framework_status |
| public.set_indicator_target |
| public.set_interview_confidentiality |
| public.set_interview_interviewer_participant |
| public.set_interview_participant |
| public.set_interview_subject_participant |
| public.set_item_validations |
| public.set_participant_patient |
| public.set_pqs_rca_due_window |
| public.set_primary_subject |
| public.set_professional_link_state |
| public.set_rca_factor_key |
| public.set_rca_why_root |
| public.set_rca_why_step |
| public.set_referral_deadline |
| public.set_standard_assessment |
| public.set_standard_ownership |
| public.set_template_case_type |
| public.set_template_patient_mode |
| public.sign_meeting |
| public.snap_referral_commission_names |
| public.soft_delete_document |
| public.start_correction_draft |
| public.start_referral_review |
| public.start_session |
| public.submit_document_for_approval |
| public.submit_ethics_appeal |
| public.submit_minutes_job |
| public.submit_rca_for_review |
| public.submit_targeted_case_response |
| public.suggest_carry_forward |
| public.supersede_document |
| public.supersede_response |
| public.sync_case_phase_on_submit |
| public.sync_profile_email_confirmed |
| public.sync_profile_email |
| public.target_case_response |
| public.toggle_committee_action_item_checklist |
| public.transfer_event_custody |
| public.triage_disposition |
| public.unassign_case_tag |
| public.unassign_narrative |
| public.unassign_referral_internal_note |
| public.unlink_evidence |
| public.unlink_referral_case |
| public.update_affiliation |
| public.update_block_library_entry |
| public.update_capa_action |
| public.update_capa_measure |
| public.update_capa_plan |
| public.update_case_custom_field_values |
| public.update_case_meta |
| public.update_committee_action_item_checklist |
| public.update_committee_action_item_reminder |
| public.update_committee_action_item |
| public.update_controlled_document |
| public.update_ethics_allegation |
| public.update_event_type |
| public.update_event |
| public.update_framework |
| public.update_indicator |
| public.update_interview_interviewer |
| public.update_interview_subject |
| public.update_interview_summary |
| public.update_interview |
| public.update_org_affiliation |
| public.update_professional_profile |
| public.update_rca_factor |
| public.update_rca_member_role |
| public.update_rca_root_cause |
| public.update_rca_timeline_entry |
| public.update_rca |
| public.update_referral_assignment |
| public.update_referral_draft |
| public.update_referral_internal_note |
| public.update_referral_requested_action |
| public.update_sentinel_criterion |
| public.update_session |
| public.upsert_commission_charter |
| public.upsert_ethics_case_details |
| public.upsert_matrix_axes |
| public.upsert_standard |
| public.validate_visible_when |
| public.verify_audit_chain |
| public.void_affiliation |
| public.void_decision |
| public.void_org_affiliation |
| public.withdraw_correction |
| public.withdraw_referral |

### 2.4 Project-level Auth findings (2)

| Rule | Level | Detail |
| --- | --- | --- |
| `auth_leaked_password_protection` | WARN | "Supabase Auth prevents the use of compromised passwords by checking against HaveIBeenPwned.org. Enable this feature to enhance security." |
| `auth_insufficient_mfa_options` | WARN | "Your project has too few MFA options enabled, which may weaken account security. Enable more MFA methods to enhance security." |

---

## 3. Performance advisor — full findings (linked project `azkbbhskturikxpgmafq`)

Fetched via `get_advisors(project_id, type="performance")`. Returned 557 typed lint objects
across 4 distinct rule names (same "it actually ran" evidence as § 2: rule diversity,
descriptions, remediation URLs present on every row).

| Rule | Level | Count |
| --- | --- | --- |
| `unindexed_foreign_keys` | INFO | 202 |
| `auth_rls_initplan` | WARN | 113 |
| `unused_index` | INFO | 141 |
| `multiple_permissive_policies` | WARN | 101 |
| **Total** | | **557** |

### 3.1 `unindexed_foreign_keys` (INFO, 202) — full list (table, FK constraint)

| Table | FK constraint |
| --- | --- |
| public.accreditation_frameworks | accreditation_frameworks_cloned_from_framework_id_fkey |
| public.accreditation_standards | accreditation_standards_parent_fkey |
| public.action_item_checklists | action_item_checklists_completed_by_fkey |
| public.action_item_checklists | action_item_checklists_created_by_fkey |
| public.action_item_reminders | action_item_reminders_created_by_fkey |
| public.action_item_updates | action_item_updates_author_id_fkey |
| public.action_items | action_items_securable_resource_fk |
| public.answer_matrix_cells | answer_matrix_cells_col_id_fkey |
| public.answer_matrix_cells | answer_matrix_cells_row_id_fkey |
| public.answer_risk_matrix | answer_risk_matrix_likelihood_col_id_fkey |
| public.answer_risk_matrix | answer_risk_matrix_severity_row_id_fkey |
| public.audit_log | audit_log_actor_id_fkey |
| public.capa_action_evidence | capa_action_evidence_created_by_fkey |
| public.capa_action_evidence | capa_action_evidence_deleted_by_fkey |
| public.capa_action | capa_action_completed_by_fkey |
| public.capa_action | capa_action_securable_resource_fk |
| public.capa_effectiveness | capa_effectiveness_verified_by_fkey |
| public.capa_measure_result | capa_measure_result_created_by_fkey |
| public.capa_measure | capa_measure_indicator_id_fkey |
| public.capa_plan | capa_plan_closed_by_fkey |
| public.capa_plan | capa_plan_opened_by_fkey |
| public.capa_plan | capa_plan_source_indicator_id_fkey |
| public.capa_plan | capa_plan_source_meeting_id_fkey |
| public.case_access_grants | case_access_grants_granted_by_fkey |
| public.case_access_grants | case_access_grants_revoked_by_fkey |
| public.case_conflict_declarations | case_conflict_declarations_declarant_id_fkey |
| public.case_conflict_declarations | case_conflict_declarations_resolved_by_fkey |
| public.case_correction_requests | case_correction_requests_commission_id_fkey |
| public.case_correction_requests | case_correction_requests_draft_response_id_fkey |
| public.case_correction_requests | case_correction_requests_last_rejected_by_fkey |
| public.case_correction_requests | case_correction_requests_predecessor_response_id_fkey |
| public.case_correction_requests | case_correction_requests_requested_by_fkey |
| public.case_correction_requests | case_correction_requests_resolved_by_fkey |
| public.case_decisions | case_decisions_decided_by_fkey |
| public.case_events | case_events_created_by_fkey |
| public.case_interview_interviewers | case_interview_interviewers_participant_id_fkey |
| public.case_interview_links | case_interview_links_created_by_fkey |
| public.case_interview_links | case_interview_links_deleted_by_fkey |
| public.case_interview_subjects | case_interview_subjects_participant_id_fkey |
| public.case_interview_subjects | case_interview_subjects_user_id_fkey |
| public.case_interviews | case_interviews_concluded_by_fkey |
| public.case_interviews | case_interviews_created_by_fkey |
| public.case_interviews | case_interviews_form_version_id_fkey |
| public.case_interviews | case_interviews_participant_id_fkey |
| public.case_interviews | case_interviews_registry_event_id_fkey |
| public.case_interviews | case_interviews_securable_resource_fk |
| public.case_participant_roles | case_participant_roles_case_type_id_fkey |
| public.case_participants | case_participants_added_by_fkey |
| public.case_participants | case_participants_role_id_fkey |
| public.case_recusals | case_recusals_conflict_declaration_id_fkey |
| public.case_recusals | case_recusals_lifted_by_fkey |
| public.case_recusals | case_recusals_recused_by_fkey |
| public.case_recusals | case_recusals_user_id_fkey |
| public.case_referral | case_referral_created_by_fkey |
| public.case_referral | case_referral_parent_referral_id_fkey |
| public.case_referral | case_referral_phi_disposed_by_fkey |
| public.case_referral | case_referral_referral_type_id_fkey |
| public.case_referral | case_referral_requested_action_id_fkey |
| public.case_referral | case_referral_securable_resource_fk |
| public.case_referral | case_referral_waiting_on_hospital_id_fkey |
| public.case_reopenings | case_reopenings_reopened_by_fkey |
| public.case_tag_assignments | case_tag_assignments_assigned_by_fkey |
| public.case_votes | case_votes_meeting_id_fkey |
| public.case_votes | case_votes_voter_id_fkey |
| public.cases | cases_securable_resource_fk |
| public.commission_administrativo_capabilities | commission_administrativo_capabilities_granted_by_fkey |
| public.commission_administrativos | commission_administrativos_appointed_by_fkey |
| public.commission_charters | commission_charters_created_by_fkey |
| public.commissions | commissions_created_by_fkey |
| public.commissions | commissions_hospital_org_fkey |
| public.controlled_document_versions | controlled_document_versions_core_document_version_id_fkey |
| public.controlled_document_versions | controlled_document_versions_created_by_fkey |
| public.controlled_documents | controlled_documents_core_document_id_fkey |
| public.controlled_documents | controlled_documents_created_by_fkey |
| public.controlled_documents | controlled_documents_current_version_fkey |
| public.controlled_documents | controlled_documents_securable_resource_fk |
| public.document_legal_holds | document_legal_holds_document_id_fkey |
| public.document_legal_holds | document_legal_holds_issued_by_fkey |
| public.document_legal_holds | document_legal_holds_released_by_fkey |
| public.document_placements | document_placements_created_by_fkey |
| public.document_placements | document_placements_resource_id_fkey |
| public.document_versions | document_versions_created_by_fkey |
| public.documents | documents_created_by_fkey |
| public.documents | documents_home_resource_id_fkey |
| public.dsr_requests | dsr_requests_adjudicated_by_fkey |
| public.dsr_requests | dsr_requests_closed_by_fkey |
| public.dsr_requests | dsr_requests_created_by_fkey |
| public.dsr_tasks | dsr_tasks_commission_id_fkey |
| public.dsr_tasks | dsr_tasks_completed_by_fkey |
| public.ethics_allegations | ethics_allegations_created_by_fkey |
| public.ethics_appeals | ethics_appeals_reviewed_by_fkey |
| public.ethics_appeals | ethics_appeals_submitted_by_participant_id_fkey |
| public.ethics_case_details | ethics_case_details_admissibility_decided_by_fkey |
| public.ethics_decision_details | ethics_decision_details_decision_letter_document_fk |
| public.ethics_decision_details | ethics_decision_details_external_reporting_referral_id_fkey |
| public.ethics_decision_details | ethics_decision_details_sanction_type_id_fkey |
| public.ethics_findings | ethics_findings_decided_by_fkey |
| public.ethics_hearings | ethics_hearings_created_by_fkey |
| public.ethics_hearings | ethics_hearings_meeting_id_fkey |
| public.ethics_notifications | ethics_notifications_created_by_fkey |
| public.ethics_notifications | ethics_notifications_recipient_participant_id_fkey |
| public.ethics_notifications | ethics_notifications_recipient_user_id_fkey |
| public.ethics_notifications | ethics_notifications_related_document_fk |
| public.event_custody | event_custody_assigned_by_fkey |
| public.event_custody | event_custody_owner_commission_id_fkey |
| public.event_triage_sentinel_flags | event_triage_sentinel_flags_criteria_id_fkey |
| public.event_triage | event_triage_triaged_by_fkey |
| public.evidence_links | evidence_links_linked_by_fkey |
| public.file_objects | file_objects_created_by_fkey |
| public.file_objects | file_objects_disposed_by_fkey |
| public.form_items | form_items_parent_item_id_fkey |
| public.form_matrix_columns | form_matrix_columns_form_version_id_fkey |
| public.form_matrix_rows | form_matrix_rows_form_version_id_fkey |
| public.form_versions | form_versions_approved_by_fkey |
| public.form_versions | form_versions_created_by_fkey |
| public.forms | forms_created_by_fkey |
| public.hospital_affiliations | hospital_affiliations_created_by_fkey |
| public.hospital_affiliations | hospital_affiliations_ended_by_fkey |
| public.hospital_affiliations | hospital_affiliations_hospital_id_fkey |
| public.hospital_affiliations | hospital_affiliations_voided_by_fkey |
| public.hospital_dpos | hospital_dpos_appointed_by_fkey |
| public.hospital_dpos | hospital_dpos_revoked_by_fkey |
| public.hospital_dpos | hospital_dpos_user_id_fkey |
| public.indicator_measurements | indicator_measurements_entered_by_fkey |
| public.indicators | indicators_created_by_fkey |
| public.interview_session_attendance | interview_session_attendance_created_by_fkey |
| public.interview_session_attendance | interview_session_attendance_participant_id_fkey |
| public.interview_sessions | interview_sessions_created_by_fkey |
| public.interview_summaries | interview_summaries_created_by_fkey |
| public.interview_topics | interview_topics_interview_id_fkey |
| public.meeting_agenda_items | meeting_agenda_items_created_by_fkey |
| public.meeting_closed_session_item_readers | meeting_closed_session_item_readers_user_id_fkey |
| public.meeting_closed_sessions | meeting_closed_sessions_opened_by_fkey |
| public.meeting_minutes_jobs | meeting_minutes_jobs_requested_by_fkey |
| public.meetings | meetings_concluded_by_fkey |
| public.meetings | meetings_created_by_fkey |
| public.meetings | meetings_phi_disposed_by_fkey |
| public.meetings | meetings_securable_resource_fk |
| public.memberships | memberships_hospital_id_fkey |
| public.memberships | memberships_title_id_fkey |
| public.notifications | notifications_commission_id_fkey |
| public.organization_affiliations | organization_affiliations_created_by_fkey |
| public.organization_affiliations | organization_affiliations_ended_by_fkey |
| public.organization_affiliations | organization_affiliations_voided_by_fkey |
| public.organizations | organizations_created_by_fkey |
| public.participants | participants_created_by_fkey |
| public.participants | participants_organization_id_fkey |
| public.patient_participants | patient_participants_type_fk |
| public.patient_safety_event | patient_safety_event_acknowledged_by_fkey |
| public.patient_safety_event | patient_safety_event_closed_by_fkey |
| public.patient_safety_event | patient_safety_event_event_type_fk |
| public.patient_safety_event | patient_safety_event_phi_disposed_by_fkey |
| public.patient_safety_event | patient_safety_event_reported_by_fkey |
| public.printed_documents | printed_documents_minted_by_fkey |
| public.printed_documents | printed_documents_revoked_by_fkey |
| public.printed_documents | printed_documents_version_document_fk |
| public.professional_participants | professional_participants_type_fk |
| public.professional_profiles | professional_profiles_redacted_by_fkey |
| public.profiles | profiles_home_organization_id_fkey |
| public.profiles | profiles_professional_category_id_fkey |
| public.rca_evidence | rca_evidence_cited_document_id_fkey |
| public.rca_evidence | rca_evidence_cited_interview_id_fkey |
| public.rca_evidence | rca_evidence_cited_meeting_id_fkey |
| public.rca_evidence | rca_evidence_created_by_fkey |
| public.rca_evidence | rca_evidence_deleted_by_fkey |
| public.rca_members | rca_members_user_id_fkey |
| public.rca | rca_completed_by_fkey |
| public.rca | rca_created_by_fkey |
| public.rca | rca_securable_resource_fk |
| public.rca | rca_submitted_by_fkey |
| public.referral_assignments | referral_assignments_assigned_by_fkey |
| public.referral_assignments | referral_assignments_commission_id_fkey |
| public.referral_case_links | referral_case_links_case_id_fkey |
| public.referral_case_links | referral_case_links_commission_id_fkey |
| public.referral_case_links | referral_case_links_created_by_fkey |
| public.referral_internal_notes | referral_internal_notes_author_user_id_fkey |
| public.referral_internal_notes | referral_internal_notes_committee_id_fkey |
| public.referral_internal_notes | referral_internal_notes_concluded_by_fkey |
| public.referral_internal_notes | referral_internal_notes_redacted_by_fkey |
| public.referral_internal_notes | referral_internal_notes_updated_by_fkey |
| public.referral_messages | referral_messages_sender_user_id_fkey |
| public.referral_read_receipts | referral_read_receipts_user_id_fkey |
| public.referral_reply | referral_reply_replied_by_fkey |
| public.referral_reply | referral_reply_reply_outcome_id_fkey |
| public.referral_resolutions | referral_resolutions_final_reply_id_fkey |
| public.referral_resolutions | referral_resolutions_reopened_by_fkey |
| public.referral_resolutions | referral_resolutions_resolved_by_commission_id_fkey |
| public.referral_resolutions | referral_resolutions_resolved_by_user_id_fkey |
| public.referral_shared_item | referral_shared_item_frozen_document_version_id_fkey |
| public.referral_shared_item | referral_shared_item_source_document_id_fkey |
| public.referral_shared_item | referral_shared_item_source_narrative_id_fkey |
| public.response_group_instances | response_group_instances_group_item_id_fkey |
| public.response_group_instances | response_group_instances_parent_instance_id_fkey |
| public.response_section_signoffs | response_section_signoffs_section_id_fkey |
| public.response_section_signoffs | response_section_signoffs_signed_by_fkey |
| public.securable_resources | securable_resources_commission_id_fkey |
| public.securable_resources | securable_resources_hospital_id_fkey |
| public.securable_resources | securable_resources_organization_id_fkey |
| public.standard_assessments | standard_assessments_assessed_by_fkey |
| public.standard_ownerships | standard_ownerships_assigned_by_fkey |
| public.upload_sessions | upload_sessions_document_version_id_fkey |
| public.upload_sessions | upload_sessions_reserved_by_fkey |

### 3.2 `auth_rls_initplan` (WARN, 113) — full list (table, policy)

| Table | Policy |
| --- | --- |
| public.action_item_assignments | action_item_assignments_select |
| public.action_item_checklists | action_item_checklists_select |
| public.action_item_reminders | action_item_reminders_select |
| public.action_item_status_history | action_item_status_history_select |
| public.action_item_updates | action_item_updates_select |
| public.action_items | action_items_select |
| public.answers | answers_insert_targeted |
| public.answers | answers_select_targeted |
| public.answers | answers_update_targeted |
| public.capa_action_evidence | capa_action_evidence_select |
| public.capa_action_evidence | capa_action_evidence_write |
| public.capa_action_task | capa_action_task_select |
| public.capa_action_task | capa_action_task_write |
| public.capa_action | capa_action_select |
| public.capa_action | capa_action_write |
| public.capa_effectiveness | capa_effectiveness_select |
| public.capa_effectiveness | capa_effectiveness_write |
| public.capa_measure_result | capa_measure_result_select |
| public.capa_measure_result | capa_measure_result_write |
| public.capa_measure | capa_measure_select |
| public.capa_measure | capa_measure_write |
| public.capa_plan | capa_plan_delete |
| public.capa_plan | capa_plan_select |
| public.capa_plan | capa_plan_update |
| public.case_conflict_declarations | case_conflict_declarations_select |
| public.case_correction_requests | case_correction_requests_select |
| public.case_decisions | case_decisions_select |
| public.case_events | case_events_select |
| public.case_events | case_events_staff_admin_delete |
| public.case_events | case_events_staff_admin_insert |
| public.case_events | case_events_staff_admin_update |
| public.case_events | case_events_writer_delete |
| public.case_events | case_events_writer_insert |
| public.case_events | case_events_writer_update |
| public.case_interview_interviewers | case_interview_interviewers_select |
| public.case_interview_interviewers | case_interview_interviewers_write |
| public.case_interview_links | case_interview_links_select |
| public.case_interview_links | case_interview_links_write |
| public.case_interview_subjects | case_interview_subjects_select |
| public.case_interview_subjects | case_interview_subjects_write |
| public.case_interviews | case_interviews_delete |
| public.case_interviews | case_interviews_insert |
| public.case_interviews | case_interviews_select |
| public.case_interviews | case_interviews_update |
| public.case_participants | case_participants_select |
| public.case_recusals | case_recusals_select |
| public.case_referral | case_referral_delete_draft_source |
| public.case_referral | case_referral_insert_source_coord |
| public.case_referral | case_referral_select_readable |
| public.case_referral | case_referral_update_coord |
| public.case_reopenings | case_reopenings_select |
| public.case_tag_assignments | case_tag_assignments_select |
| public.case_tag_assignments | case_tag_assignments_staff_admin_write |
| public.case_votes | case_votes_select |
| public.commission_administrativo_capabilities | commission_administrativo_capabilities_select |
| public.commission_administrativos | commission_administrativos_select |
| public.controlled_document_versions | controlled_document_versions_select |
| public.controlled_documents | controlled_documents_select |
| public.document_approvals | document_approvals_select |
| public.ethics_allegations | ethics_allegations_select |
| public.ethics_appeals | ethics_appeals_select |
| public.ethics_case_details | ethics_case_details_select |
| public.ethics_decision_details | ethics_decision_details_select |
| public.ethics_findings | ethics_findings_select |
| public.ethics_hearings | ethics_hearings_select |
| public.ethics_notifications | ethics_notifications_select |
| public.event_custody | event_custody_select |
| public.event_patient | event_patient_select |
| public.event_triage_sentinel_flags | event_triage_sentinel_flags_select |
| public.event_triage | event_triage_select |
| public.form_items | form_items_select_targeted |
| public.form_sections | form_sections_select_targeted |
| public.form_versions | form_versions_select_targeted |
| public.interview_session_attendance | interview_session_attendance_select |
| public.interview_sessions | interview_sessions_select |
| public.interview_summaries | interview_summaries_select |
| public.interview_topics | interview_topics_select |
| public.meeting_cases | meeting_cases_staff_admin_delete |
| public.meeting_cases | meeting_cases_staff_admin_insert |
| public.meeting_cases | meeting_cases_staff_admin_update |
| public.meeting_signatures | meeting_signatures_insert |
| public.patient_safety_event | patient_safety_event_select |
| public.patient_xref | patient_xref_select_pqs |
| public.professional_credentials | professional_credentials_select |
| public.professional_participants | professional_participants_select |
| public.professional_profiles | professional_profiles_select |
| public.profiles | profiles_update_self |
| public.rca_evidence | rca_evidence_select |
| public.rca_evidence | rca_evidence_write |
| public.rca_factors | rca_factors_select |
| public.rca_factors | rca_factors_write |
| public.rca_members | rca_members_select |
| public.rca_members | rca_members_write |
| public.rca_root_causes | rca_root_causes_select |
| public.rca_root_causes | rca_root_causes_write |
| public.rca_timeline_entries | rca_timeline_select |
| public.rca_timeline_entries | rca_timeline_write |
| public.rca_why_chains | rca_why_chains_select |
| public.rca_why_chains | rca_why_chains_write |
| public.rca | rca_delete |
| public.rca | rca_select |
| public.rca | rca_update |
| public.referral_assignments | referral_assignments_select_metadata |
| public.referral_case_links | referral_case_links_select_metadata |
| public.referral_reply | referral_reply_select_phi |
| public.referral_resolutions | referral_resolutions_select_metadata |
| public.referral_shared_item | referral_shared_item_select_phi |
| public.response_group_instances | response_group_instances_select |
| public.response_group_instances | response_group_instances_write_own_draft |
| public.response_section_signoffs | signoffs_insert |
| public.responses | responses_delete_own_draft |
| public.responses | responses_select_targeted |
| public.responses | responses_update_targeted |

### 3.3 `unused_index` (INFO, 141) — full list (table, index)

⚠ See § 4.3 — this rule measures live `pg_stat_user_indexes` usage counters, not schema, and
is not comparable to a freshly-reset local stack. Recorded here as the remote's live-traffic
snapshot only.

| Table | Index |
| --- | --- |
| app.active_role_selections | active_role_selections_user_id_idx |
| public.accreditation_frameworks | accreditation_frameworks_owner_idx |
| public.accreditation_standards | accreditation_standards_parent_idx |
| public.action_item_assignments | action_item_assignments_assigned_by_idx |
| public.action_item_assignments | action_item_assignments_item_idx |
| public.action_item_assignments | action_item_assignments_user_idx |
| public.action_item_status_history | action_item_status_history_changed_by_idx |
| public.action_item_status_history | action_item_status_history_from_idx |
| public.action_item_status_history | action_item_status_history_item_idx |
| public.action_item_status_history | action_item_status_history_to_idx |
| public.action_item_statuses | action_item_statuses_commission_idx |
| public.action_item_urgency_levels | action_item_urgency_levels_commission_idx |
| public.action_items | action_items_active_due_idx |
| public.action_items | action_items_completed_by_idx |
| public.action_items | action_items_created_by_idx |
| public.action_items | action_items_linked_case_idx |
| public.action_items | action_items_source_agenda_item_idx |
| public.action_items | action_items_status_idx |
| public.action_items | action_items_urgency_idx |
| public.answer_references | answer_references_commission_idx |
| public.answer_references | answer_references_participant_idx |
| public.answer_references | answer_references_profile_idx |
| public.answer_selected_options | answer_selected_options_option_idx |
| public.answers | answers_form_version_idx |
| public.answers | answers_group_instance_idx |
| public.answers | answers_question_key_idx |
| public.audit_log | audit_log_action_idx |
| public.audit_log | audit_log_actor_idx |
| public.audit_log | audit_log_commission_occurred_idx |
| public.audit_log | audit_log_entity_idx |
| public.audit_log | audit_log_hospital_occurred_idx |
| public.capa_action_evidence | capa_action_evidence_action_idx |
| public.capa_action_task | capa_action_task_action_idx |
| public.capa_action | capa_action_assignee_idx |
| public.capa_action | capa_action_capa_idx |
| public.capa_action | capa_action_root_cause_idx |
| public.capa_measure_result | capa_measure_result_measure_idx |
| public.capa_measure | capa_measure_capa_idx |
| public.capa_plan | capa_plan_source_event_idx |
| public.capa_plan | capa_plan_source_rca_idx |
| public.capa_plan | capa_plan_status_idx |
| public.case_access_grants | case_access_grants_active_case_principal_idx |
| public.case_access_grants | case_access_grants_principal_expiry_idx |
| public.case_conflict_declarations | case_conflict_declarations_case_idx |
| public.case_custom_field_values | case_custom_field_values_template_field_idx |
| public.case_interviews | case_interviews_commission_idx |
| public.case_interviews | case_interviews_status_idx |
| public.case_narrative_revisions | case_narrative_revisions_correction_request_idx |
| public.case_narrative_revisions | case_narrative_revisions_narrative_idx |
| public.case_narrative_revisions | case_narrative_revisions_snapshotted_by_idx |
| public.case_narratives | case_narratives_assignment_role_idx |
| public.case_narratives | case_narratives_concluded_by_idx |
| public.case_narratives | case_narratives_created_by_idx |
| public.case_narratives | case_narratives_updated_by_idx |
| public.case_offered_outcomes | case_offered_outcomes_outcome_idx |
| public.case_phase_allowed_results | case_phase_allowed_results_result_idx |
| public.case_phase_offered_results | case_phase_offered_results_result_idx |
| public.case_phases | case_phases_assignment_role_idx |
| public.case_phases | case_phases_case_idx |
| public.case_phases | case_phases_form_idx |
| public.case_phases | case_phases_form_version_idx |
| public.case_phases | case_phases_result_idx |
| public.case_phases | case_phases_result_override_idx |
| public.case_referral | case_referral_source_commission_idx |
| public.case_referral | case_referral_status_idx |
| public.case_referral | case_referral_target_commission_idx |
| public.case_referral | case_referral_target_hospital_created_keyset_idx |
| public.case_reopenings | case_reopenings_case_id_idx |
| public.case_tag_assignments | case_tag_assignments_tag_idx |
| public.case_votes | case_votes_case_idx |
| public.case_votes | case_votes_decision_idx |
| public.cases | cases_case_type_idx |
| public.cases | cases_closed_by_idx |
| public.cases | cases_created_by_idx |
| public.cases | cases_department_idx |
| public.cases | cases_organization_idx |
| public.cases | cases_outcome_idx |
| public.commission_charters | commission_charters_controlled_document_idx |
| public.controlled_documents | controlled_documents_commission_id_idx |
| public.dsr_requests | dsr_requests_hospital_idx |
| public.dsr_requests | dsr_requests_patient_key_idx |
| public.dsr_tasks | dsr_tasks_request_idx |
| public.dsr_tasks | dsr_tasks_routing_idx |
| public.ethics_allegations | ethics_allegations_category_idx |
| public.ethics_appeals | ethics_appeals_decision_idx |
| public.ethics_decision_details | ethics_decision_details_case_idx |
| public.ethics_findings | ethics_findings_case_idx |
| public.ethics_notifications | ethics_notifications_due_idx |
| public.event_custody | event_custody_event_idx |
| public.event_triage_sentinel_flags | event_triage_sentinel_flags_event_idx |
| public.evidence_links | evidence_links_standard_idx |
| public.form_item_options | form_item_options_version_idx |
| public.form_item_validations | form_item_validations_version_idx |
| public.hospital_affiliations | hospital_affiliations_org_idx |
| public.hospital_affiliations | hospital_affiliations_principal_idx |
| public.hospital_departments | hospital_departments_hospital_position_idx |
| public.hospital_dpos | hospital_dpos_hospital_idx |
| public.meeting_agenda_items | meeting_agenda_items_meeting_idx |
| public.meeting_attendees | meeting_attendees_user_idx |
| public.meeting_closed_session_item_readers | meeting_closed_session_item_readers_item_idx |
| public.meeting_closed_session_items | meeting_closed_session_items_case_idx |
| public.meeting_closed_session_items | meeting_closed_session_items_session_idx |
| public.meeting_minutes_jobs | meeting_minutes_jobs_status_created_idx |
| public.meeting_signatures | meeting_signatures_attendee_idx |
| public.meeting_signatures | meeting_signatures_signer_idx |
| public.meetings | meetings_commission_idx |
| public.meetings | meetings_type_idx |
| public.memberships | memberships_granted_by_idx |
| public.organization_affiliations | organization_affiliations_principal_idx |
| public.patient_safety_event | patient_safety_event_owner_idx |
| public.patient_safety_event | patient_safety_event_reported_keyset_idx |
| public.patient_safety_event | patient_safety_event_status_idx |
| public.patient_xref | patient_xref_encounter_key_idx |
| public.phase_results | phase_results_commission_idx |
| public.pqs_event_types | pqs_event_types_hospital_idx |
| public.pqs_sentinel_criteria | pqs_sentinel_criteria_hospital_idx |
| public.printed_documents | printed_documents_commission_idx |
| public.process_template_narratives | process_template_narratives_type_idx |
| public.process_template_outcomes | process_template_outcomes_outcome_idx |
| public.process_template_phase_allowed_results | process_template_phase_allowed_results_result_idx |
| public.process_template_phase_offered_results | process_template_phase_offered_results_result_idx |
| public.process_template_phases | process_template_phases_form_idx |
| public.process_template_versions | process_template_versions_case_type_idx |
| public.process_template_versions | process_template_versions_created_by_idx |
| public.process_templates | process_templates_created_by_idx |
| public.professional_profiles | professional_profiles_pinned_idx |
| public.rca_evidence | rca_evidence_rca_idx |
| public.rca_factors | rca_factors_rca_idx |
| public.rca_members | rca_members_rca_idx |
| public.rca_root_causes | rca_root_causes_rca_idx |
| public.rca_timeline_entries | rca_timeline_rca_idx |
| public.rca_why_chains | rca_why_chains_rca_idx |
| public.rca | rca_event_idx |
| public.referral_assignments | referral_assignments_assignee_active |
| public.referral_internal_notes | referral_internal_notes_assigned_idx |
| public.response_group_instances | response_group_instances_response_idx |
| public.responses | responses_commission_idx |
| public.responses | responses_last_section_idx |
| public.standard_assessments | standard_assessments_standard_idx |
| public.standard_ownerships | standard_ownerships_responsible_commission_idx |
| public.standard_ownerships | standard_ownerships_standard_idx |

### 3.4 `multiple_permissive_policies` (WARN, 101) — full list (table, role/action: policies)

| Table | Role/Action: overlapping policies |
| --- | --- |
| public.action_items | authenticated/SELECT: action_items_select,action_items_staff_admin_write |
| public.answer_references | authenticated/SELECT: answer_references_select,answer_references_select_targeted |
| public.answer_selected_options | authenticated/DELETE: answer_selected_options_write_own_draft,answer_selected_options_write_targeted |
| public.answer_selected_options | authenticated/INSERT: answer_selected_options_write_own_draft,answer_selected_options_write_targeted |
| public.answer_selected_options | authenticated/SELECT: answer_selected_options_select,answer_selected_options_select_targeted,answer_selected_options_write_own_draft,answer_selected_options_write_targeted |
| public.answer_selected_options | authenticated/UPDATE: answer_selected_options_write_own_draft,answer_selected_options_write_targeted |
| public.answers | authenticated/INSERT: answers_insert_targeted,answers_write_own_draft |
| public.answers | authenticated/SELECT: answers_select,answers_select_targeted,answers_write_own_draft |
| public.answers | authenticated/UPDATE: answers_update_targeted,answers_write_own_draft |
| public.capa_action_evidence | authenticated/SELECT: capa_action_evidence_select,capa_action_evidence_write |
| public.capa_action_task | authenticated/SELECT: capa_action_task_select,capa_action_task_write |
| public.capa_action | authenticated/SELECT: capa_action_select,capa_action_write |
| public.capa_effectiveness | authenticated/SELECT: capa_effectiveness_select,capa_effectiveness_write |
| public.capa_measure_result | authenticated/SELECT: capa_measure_result_select,capa_measure_result_write |
| public.capa_measure | authenticated/SELECT: capa_measure_select,capa_measure_write |
| public.case_custom_field_values | authenticated/SELECT: case_custom_field_values_select,case_custom_field_values_staff_admin_write |
| public.case_events | authenticated/DELETE: case_events_staff_admin_delete,case_events_writer_delete |
| public.case_events | authenticated/INSERT: case_events_staff_admin_insert,case_events_writer_insert |
| public.case_events | authenticated/UPDATE: case_events_staff_admin_update,case_events_writer_update |
| public.case_interview_interviewers | authenticated/SELECT: case_interview_interviewers_select,case_interview_interviewers_write |
| public.case_interview_links | authenticated/SELECT: case_interview_links_select,case_interview_links_write |
| public.case_interview_subjects | authenticated/SELECT: case_interview_subjects_select,case_interview_subjects_write |
| public.case_narrative_types | authenticated/SELECT: case_narrative_types_select,case_narrative_types_staff_admin_write |
| public.case_narratives | authenticated/SELECT: case_narratives_select,case_narratives_staff_admin_write |
| public.case_offered_outcomes | authenticated/SELECT: case_offered_outcomes_select,case_offered_outcomes_staff_admin_write |
| public.case_outcomes | authenticated/SELECT: case_outcomes_select,case_outcomes_staff_admin_write |
| public.case_participant_roles | authenticated/SELECT: case_participant_roles_admin_write,case_participant_roles_select |
| public.case_phase_allowed_results | authenticated/SELECT: case_phase_allowed_results_select,case_phase_allowed_results_staff_admin_write |
| public.case_phase_offered_results | authenticated/SELECT: case_phase_offered_results_select,case_phase_offered_results_staff_admin_write |
| public.case_phases | authenticated/SELECT: case_phases_select,case_phases_staff_admin_write |
| public.case_tag_assignments | authenticated/SELECT: case_tag_assignments_select,case_tag_assignments_staff_admin_write |
| public.case_tags | authenticated/SELECT: case_tags_select,case_tags_staff_admin_write |
| public.case_type_terminology | authenticated/SELECT: case_type_terminology_admin_write,case_type_terminology_select |
| public.case_types | authenticated/SELECT: case_types_admin_write,case_types_select |
| public.cases | authenticated/SELECT: cases_select,cases_staff_admin_write |
| public.commission_meeting_settings | authenticated/SELECT: meeting_settings_select,meeting_settings_staff_admin_write |
| public.commission_meeting_types | authenticated/SELECT: meeting_types_select,meeting_types_staff_admin_write |
| public.commission_member_titles | authenticated/SELECT: member_titles_select,member_titles_staff_admin_write |
| public.commissions | authenticated/SELECT: commissions_admin_write,commissions_select_member_or_admin |
| public.form_item_options | authenticated/SELECT: form_item_options_select,form_item_options_select_targeted,form_item_options_staff_admin_write |
| public.form_item_validations | authenticated/SELECT: form_item_validations_select,form_item_validations_select_targeted,form_item_validations_staff_admin_write |
| public.form_items | authenticated/SELECT: form_items_select,form_items_select_targeted,form_items_staff_admin_write |
| public.form_sections | authenticated/SELECT: form_sections_select,form_sections_select_targeted,form_sections_staff_admin_write |
| public.form_versions | authenticated/SELECT: form_versions_select,form_versions_select_targeted,form_versions_staff_admin_write |
| public.forms | authenticated/SELECT: forms_select,forms_staff_admin_write |
| public.hospital_departments | authenticated/SELECT: hospital_departments_select,hospital_departments_write |
| public.hospitals | authenticated/SELECT: hospitals_select,hospitals_write |
| public.interview_sessions | authenticated/SELECT: interview_sessions_select,interview_sessions_write |
| public.organizations | authenticated/SELECT: organizations_admin_write,organizations_select |
| public.phase_results | authenticated/SELECT: phase_results_select,phase_results_staff_admin_write |
| public.process_template_custom_fields | anon/SELECT: process_template_custom_fields_select,process_template_custom_fields_staff_admin_write |
| public.process_template_custom_fields | authenticated/SELECT: process_template_custom_fields_select,process_template_custom_fields_staff_admin_write |
| public.process_template_custom_fields | authenticator/SELECT: process_template_custom_fields_select,process_template_custom_fields_staff_admin_write |
| public.process_template_custom_fields | cli_login_postgres/SELECT: process_template_custom_fields_select,process_template_custom_fields_staff_admin_write |
| public.process_template_custom_fields | dashboard_user/SELECT: process_template_custom_fields_select,process_template_custom_fields_staff_admin_write |
| public.process_template_custom_fields | supabase_privileged_role/SELECT: process_template_custom_fields_select,process_template_custom_fields_staff_admin_write |
| public.process_template_narratives | anon/SELECT: process_template_narratives_select,process_template_narratives_staff_admin_write |
| public.process_template_narratives | authenticated/SELECT: process_template_narratives_select,process_template_narratives_staff_admin_write |
| public.process_template_narratives | authenticator/SELECT: process_template_narratives_select,process_template_narratives_staff_admin_write |
| public.process_template_narratives | cli_login_postgres/SELECT: process_template_narratives_select,process_template_narratives_staff_admin_write |
| public.process_template_narratives | dashboard_user/SELECT: process_template_narratives_select,process_template_narratives_staff_admin_write |
| public.process_template_narratives | supabase_privileged_role/SELECT: process_template_narratives_select,process_template_narratives_staff_admin_write |
| public.process_template_outcomes | anon/SELECT: process_template_outcomes_select,process_template_outcomes_staff_admin_write |
| public.process_template_outcomes | authenticated/SELECT: process_template_outcomes_select,process_template_outcomes_staff_admin_write |
| public.process_template_outcomes | authenticator/SELECT: process_template_outcomes_select,process_template_outcomes_staff_admin_write |
| public.process_template_outcomes | cli_login_postgres/SELECT: process_template_outcomes_select,process_template_outcomes_staff_admin_write |
| public.process_template_outcomes | dashboard_user/SELECT: process_template_outcomes_select,process_template_outcomes_staff_admin_write |
| public.process_template_outcomes | supabase_privileged_role/SELECT: process_template_outcomes_select,process_template_outcomes_staff_admin_write |
| public.process_template_phase_allowed_results | authenticated/SELECT: process_template_phase_allowed_results_select,process_template_phase_allowed_results_staff_admin_write |
| public.process_template_phase_offered_results | authenticated/SELECT: process_template_phase_offered_results_select,process_template_phase_offered_results_staff_admin_write |
| public.process_template_phases | anon/SELECT: process_template_phases_select,process_template_phases_staff_admin_write |
| public.process_template_phases | authenticated/SELECT: process_template_phases_select,process_template_phases_staff_admin_write |
| public.process_template_phases | authenticator/SELECT: process_template_phases_select,process_template_phases_staff_admin_write |
| public.process_template_phases | cli_login_postgres/SELECT: process_template_phases_select,process_template_phases_staff_admin_write |
| public.process_template_phases | dashboard_user/SELECT: process_template_phases_select,process_template_phases_staff_admin_write |
| public.process_template_phases | supabase_privileged_role/SELECT: process_template_phases_select,process_template_phases_staff_admin_write |
| public.process_template_versions | anon/SELECT: process_template_versions_select,process_template_versions_staff_admin_write |
| public.process_template_versions | authenticated/SELECT: process_template_versions_select,process_template_versions_staff_admin_write |
| public.process_template_versions | authenticator/SELECT: process_template_versions_select,process_template_versions_staff_admin_write |
| public.process_template_versions | cli_login_postgres/SELECT: process_template_versions_select,process_template_versions_staff_admin_write |
| public.process_template_versions | dashboard_user/SELECT: process_template_versions_select,process_template_versions_staff_admin_write |
| public.process_template_versions | supabase_privileged_role/SELECT: process_template_versions_select,process_template_versions_staff_admin_write |
| public.process_templates | authenticated/SELECT: process_templates_select,process_templates_staff_admin_write |
| public.professional_categories | authenticated/SELECT: professional_categories_admin_write,professional_categories_select |
| public.profiles | authenticated/SELECT: profiles_admin_select,profiles_select_self_or_admin |
| public.profiles | authenticated/UPDATE: profiles_admin_update,profiles_update_self |
| public.rca_evidence | authenticated/SELECT: rca_evidence_select,rca_evidence_write |
| public.rca_factors | authenticated/SELECT: rca_factors_select,rca_factors_write |
| public.rca_members | authenticated/SELECT: rca_members_select,rca_members_write |
| public.rca_root_causes | authenticated/SELECT: rca_root_causes_select,rca_root_causes_write |
| public.rca_timeline_entries | authenticated/SELECT: rca_timeline_select,rca_timeline_write |
| public.rca_why_chains | authenticated/SELECT: rca_why_chains_select,rca_why_chains_write |
| public.referral_requested_actions | authenticated/SELECT: referral_requested_actions_select_all,referral_requested_actions_write_admin |
| public.referral_types | authenticated/SELECT: referral_types_select_all,referral_types_write_admin |
| public.reply_outcomes | authenticated/SELECT: reply_outcomes_select_all,reply_outcomes_write_admin |
| public.response_group_instances | authenticated/DELETE: response_group_instances_write_own_draft,response_group_instances_write_targeted |
| public.response_group_instances | authenticated/INSERT: response_group_instances_write_own_draft,response_group_instances_write_targeted |
| public.response_group_instances | authenticated/SELECT: response_group_instances_select,response_group_instances_select_targeted,response_group_instances_write_own_draft,response_group_instances_write_targeted |
| public.response_group_instances | authenticated/UPDATE: response_group_instances_write_own_draft,response_group_instances_write_targeted |
| public.responses | authenticated/SELECT: responses_select,responses_select_targeted |
| public.responses | authenticated/UPDATE: responses_update_own_draft,responses_update_targeted |

---

## 4. Explanation of every local/remote divergence

The plan's gate is explicit: **any local-only or remote-only finding must be explained in
writing, or AE0 does not close.** This section accounts for all 1004 combined advisor findings
(447 security + 557 performance) plus the migration registry.

### 4.0 What "local advisor" even means here

`get_advisors` is callable only against a linked/hosted Supabase project — there is no local
equivalent endpoint. The closest local CLI surface, `supabase db lint --local`, is a
**different tool** (`plpgsql_check` static analysis of function-body typing, e.g. "never read
variable", "routine marked IMMUTABLE but expression is STABLE", `relation ... does not exist`
inside a function body) — confirmed by running it (`npx supabase db lint --local
--output-format json`) and inspecting its output shape, which shares no rule names with the
Security/Performance Advisor (`rls_enabled_no_policy`, `auth_rls_initplan`, etc.). It is not a
substitute and was not used as one.

Given that, "local vs. remote" parity for advisor-observed facts is established by directly
querying the underlying Postgres catalog **on both stacks** for the exact predicate each rule
tests, rather than trusting that identical migrations imply identical advisor output.

### 4.1 Findings independently reproduced as byte-identical on both stacks (861 of 1004)

| Rule | Count | Local reproduction | Result |
| --- | --- | --- | --- |
| `rls_enabled_no_policy` | 7 | `select n.nspname\|\|'.'\|\|c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and c.relrowsecurity and not exists (select 1 from pg_policy p where p.polrelid=c.oid) and n.nspname='public'` | Identical 7-name set |
| `function_search_path_mutable` | 6 | `select n.nspname\|\|'.'\|\|p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('app','public') and p.prokind='f' and not exists (select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) cfg where cfg like 'search_path=%')` | Identical 6-name set |
| `authenticated_security_definer_function_executable` | 432 | `select n.nspname\|\|'.'\|\|p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prosecdef and n.nspname='public' and has_function_privilege('authenticated', p.oid, 'EXECUTE')` | Count 432=432; full sorted name-list diff clean |
| `unindexed_foreign_keys` | 202 | FK/index-coverage query over `pg_constraint` (`contype='f'`) joined to `pg_index` on the leading `conkey` columns, restricted to `n.nspname='public'` | Count 202=202; full sorted (table, fkey) list diff clean |
| `auth_rls_initplan` | 113 | see § 4.2 (proven via raw-catalog fingerprint, not re-derivation) | Proven identical |
| `multiple_permissive_policies` | 101 | see § 4.2 (same) | Proven identical |

Sum: 7 + 6 + 432 + 202 + 113 + 101 = 861.

### 4.2 `auth_rls_initplan` + `multiple_permissive_policies` — proof method (114 rows, not a re-derivation)

I first attempted to hand-reproduce Supabase's aggregation logic for these two rules directly
(expanding `roles={public}` to `{anon,authenticated}`, expanding `cmd='ALL'` to the four
specific actions, grouping by table/action/role). That attempt returned **81** and **18**
respectively against the remote's **113** and **101** — a mismatch. Rather than keep guessing
at the exact algorithm (a wrong reproduction reads exactly like a real divergence and would be
a false finding), I instead fingerprinted the complete, unaggregated input both rules are
computed from:

```sql
select count(*) as cnt, md5(string_agg(h, '' order by h)) as agg_hash from (
  select md5(tablename||'|'||policyname||'|'||permissive||'|'||roles::text||'|'||cmd||'|'
    ||coalesce(qual,'')||'|'||coalesce(with_check,'')) as h
  from pg_policies where schemaname='public'
) s;
```

Run on **local**: `278 | f42d879a6f7142e034b8c7b4cdf9953b`
Run on **remote**: `278 | f42d879a6f7142e034b8c7b4cdf9953b`

**Identical row count (278) and identical order-independent aggregate hash** over every
`public`-schema policy's table, name, permissive flag, roles, command, `qual`, and
`with_check` text. Since `auth_rls_initplan` and `multiple_permissive_policies` are both pure
deterministic functions of exactly this data, byte-identical input guarantees byte-identical
advisor output on both stacks regardless of the precise aggregation algorithm — a stronger
proof than a hand-rolled re-derivation, and the one actually used here.

### 4.3 `unused_index` (141) — not a schema fact, no local equivalent by design

`unused_index` is computed from `pg_stat_user_indexes.idx_scan` — a live, accumulating usage
counter, not anything present in a migration. The local stack was freshly reset by the lead
immediately before this phase (per the spawn brief), so its accumulated index-usage history is
near-zero by construction; running the identical predicate locally would trivially flag most or
all indexes as "unused," which would not be evidence of anything (a counter residual is not a
count; a fresh-reset artifact is not a finding). This is expected, structural non-comparability,
not an unexplained gap. The 141 rows above are recorded as the remote's live-traffic snapshot
only, per the deliverable's requirement to report the full remote list.

### 4.4 `auth_leaked_password_protection` + `auth_insufficient_mfa_options` (2) — Auth-service settings, not schema

These two are GoTrue (Auth service) **project configuration**, never written by a migration
and not visible in any table catalog — there is nothing in `pg_catalog` to fingerprint. The
MCP `get_advisors` tool is only callable against the linked project; there is no automated way
to run the identical check against the local stack.

As a secondary, non-instrumented check: `supabase/config.toml`'s `[auth]` section configures no
HaveIBeenPwned/leaked-password check and enables no additional MFA factor type beyond the
default enrollment cap (`[auth.mfa] max_enrolled_factors = 10`, no TOTP/phone-specific
`enable_*` flags set). This is **consistent in posture** with the remote finding (both stacks
default-off) but is a config-file read, not a live-instrument run — recorded as "consistent, not
independently instrument-verified," not as proven parity.

### 4.5 Verdict

- **Migration registry:** zero divergence — full 475-version-set match, by version number,
  confirmed three ways (local registry, remote registry, on-disk filenames).
- **Advisor findings:** zero local-only or remote-only findings among the 861 catalog-derived
  findings that admit a genuine local/remote comparison (§ 4.1–4.2, all independently
  reproduced or proven via raw-catalog fingerprint — not re-summarized counts).
- **The remaining 143 findings** (`unused_index` × 141, the 2 Auth-service settings) are
  structurally outside what a schema/migration parity check can measure, for the reasons stated
  in § 4.3–4.4 — not unexplained, and not treated as a regression signal for AE1.

**No unexplained local-only or remote-only finding remains. AE0.3's closing condition is met.**
