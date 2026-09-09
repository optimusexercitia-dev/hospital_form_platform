# Backend State — the `app` helper surface (GENERATED)

> Part of `docs/backend-state/`. **Start at [`README.md`](README.md)** — it routes you to the one
> file you need, and carries the maintenance rules in full.
>
> This is a **map, not the authority.** `ARCHITECTURE.md` is the spec and the **live catalog** is
> the truth (`pg_proc` incl. **`prosecdef`**, `pg_policies`, `pg_constraint`, `pg_trigger`, the
> ACLs). ⚠ **Not the migration files** — some rewrite live function bodies at runtime, so their
> text is stale by design (CLAUDE.md § graphify).
>
> ⛔ **A posted section is frozen.** Corrections are APPENDED, never edited into the statement they
> correct, and a correction leaves a forward marker at the statement it supersedes: a
> `⚠ **Superseded** — …` line directly under that heading, naming where the correction lives.
>
> ⛔ **A new phase EXTENDS its seam file.** It never opens a phase-named file, and the fix for an
> over-cap file is never to raise the cap nor to delete a posted section.

<!-- DATA-ACCESS-ANCHOR kind=helper schema=app rows=526 definer=415 invoker=111 trigger=176 aclnull=228 digest=5a4a5161f9c3830e7e267ab3f930ea5d -->

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

**526 functions** in schema `app` — 415 `SECURITY DEFINER`, 111 invoker, 176 trigger functions, 228 with a NULL `proacl`.

⚠ **A NULL `proacl` is rendered `<NULL=PUBLIC>` and means PUBLIC MAY EXECUTE** — it is the default, not an absence of grants. Reading it as "no grants" inverts the fact (the same trap `scripts/catalog-fingerprint.sql` names). ⚠ **A `definer` row's gate REPLACES RLS**, so its EXECUTE list is the whole boundary: `prosecdef` belongs beside `pg_policies`, never read alone (ADR 0078, ADR 0079).

## The generated function registry

| Function | Args | Returns | Security | Volatility | EXECUTE |
| --- | --- | --- | --- | --- | --- |
| `app._audit_access_authorized` | `p_action text, p_entity_id uuid, p_commission uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app._cap_bit` | `p_cap text` | `integer` | invoker | immutable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app._case_caps` | `p_case_id uuid, p_uid uuid` | `integer` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app._deny_self_grant` | `p_principal uuid` | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app._grant_case_access_unchecked` | `p_case uuid, p_user uuid, p_level text, p_expires_at timestamp with time zone, p_reason text, p_reason_code text, p_read_standard_phi boolean, p_read_restricted_phi boolean` | `void` | invoker | volatile | `postgres=X/postgres` |
| `app._insert_block_child_rows` | `p_item_id uuid, p_version_id uuid, p_snapshot_item jsonb` | `void` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app._project_case_referral` | `p case_referral` | `case_referral_public` | invoker | immutable | `<NULL=PUBLIC>` |
| `app._project_meeting_agenda_item` | `r meeting_agenda_items, p_uid uuid` | `meeting_agenda_items` | **definer** | stable | `postgres=X/postgres` |
| `app._project_meeting_case` | `r meeting_cases, p_uid uuid` | `meeting_cases` | **definer** | stable | `postgres=X/postgres` |
| `app._project_referral_internal_note` | `p referral_internal_notes` | `referral_internal_note_public` | invoker | immutable | `<NULL=PUBLIC>` |
| `app._project_referral_message` | `p referral_messages` | `referral_message_public` | invoker | immutable | `<NULL=PUBLIC>` |
| `app._referral_reply_documents` | `p_referral_id uuid, p_can_phi boolean` | `jsonb` | **definer** | stable | `postgres=X/postgres` |
| `app._set_participant_patient_unchecked` | `p_case_id uuid, p_participant_id uuid, p_name text, p_mrn text, p_date_of_birth date, p_age_years integer, p_sex text, p_encounter_ref text, p_unit text, p_attending text, p_role_id uuid` | `uuid` | invoker | volatile | `postgres=X/postgres` |
| `app.action_item_initial_status` | `p_commission_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.action_item_status_by_key` | `p_commission_id uuid, p_key text` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.active_role` | — | `text` | invoker | stable | `<NULL=PUBLIC>` |
| `app.advance_capa_action_core` | `p_action_id uuid, p_status text` | `capa_action` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.affiliate_new_person_impl` | `p_actor uuid, p_user uuid, p_hospital uuid, p_employee_id text, p_started_on date, p_job_title text, p_work_email text, p_work_phone text` | `uuid` | **definer** | volatile | `postgres=X/postgres` |
| `app.affiliate_new_person_to_org_impl` | `p_actor uuid, p_user uuid, p_organization uuid, p_started_on date` | `uuid` | **definer** | volatile | `postgres=X/postgres` |
| `app.affiliate_person_impl` | `p_actor uuid, p_user uuid, p_hospital uuid, p_employee_id text, p_started_on date, p_job_title text, p_work_email text, p_work_phone text` | `uuid` | **definer** | volatile | `postgres=X/postgres` |
| `app.affiliate_person_to_org_impl` | `p_actor uuid, p_user uuid, p_organization uuid, p_started_on date` | `uuid` | **definer** | volatile | `postgres=X/postgres` |
| `app.answer_map_by_item_scoped` | `p_response_id uuid, p_group_instance_id uuid` | `jsonb` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.answer_map_by_item` | `p_response_id uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.answer_map_scoped` | `p_response_id uuid, p_group_instance_id uuid` | `jsonb` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.answer_map` | `p_response_id uuid` | `jsonb` | **definer** | stable | `=X/postgres,authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.artifact_belongs_to_commission` | `p_kind text, p_artifact uuid, p_commission uuid` | `boolean` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.assert_accreditation_enabled` | — | `void` | invoker | stable | `<NULL=PUBLIC>` |
| `app.assert_administrativo_enabled` | — | `void` | invoker | stable | `<NULL=PUBLIC>` |
| `app.assert_audio_minutes_enabled` | — | `void` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_audit_enabled` | — | `void` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_bulk_create_enabled` | — | `void` | invoker | stable | `<NULL=PUBLIC>` |
| `app.assert_capa_writable` | `p_capa_id uuid` | `void` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_case_corrections_enabled` | — | `void` | invoker | stable | `<NULL=PUBLIC>` |
| `app.assert_case_participants_enabled` | — | `void` | invoker | stable | `<NULL=PUBLIC>` |
| `app.assert_case_patient_enabled` | — | `void` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_cases_enabled` | — | `void` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_charters_enabled` | — | `void` | invoker | stable | `<NULL=PUBLIC>` |
| `app.assert_condition_op_target` | `p_op text, p_target_type text, p_value jsonb, p_context text` | `void` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.assert_condition_value_codes` | `p_version_id uuid, p_question_key text, p_target_type text, p_value jsonb, p_context text, p_op text` | `void` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.assert_controlled_docs_enabled` | — | `void` | invoker | stable | `<NULL=PUBLIC>` |
| `app.assert_document_printing_enabled` | — | `void` | invoker | stable | `<NULL=PUBLIC>` |
| `app.assert_documents_enabled` | — | `void` | invoker | stable | `postgres=X/postgres` |
| `app.assert_documents_wave_b_enabled` | — | `void` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_documents_wave_c_enabled` | — | `void` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_documents_wave_d_enabled` | — | `void` | invoker | stable | `<NULL=PUBLIC>` |
| `app.assert_ethics_coordinator` | `p_case_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_ethics_enabled` | — | `void` | invoker | stable | `<NULL=PUBLIC>` |
| `app.assert_ethics_typed` | `p_case_id uuid` | `void` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_extras_enabled` | — | `void` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_group_writable` | `p_response_id uuid, p_group_item_id uuid` | `jsonb` | invoker | stable | `<NULL=PUBLIC>` |
| `app.assert_hospital_affiliation_has_org` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.assert_interview_writable` | `p_interview_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_interviews_enabled` | — | `void` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_item_bounds` | `p_response_id uuid, p_item_id uuid, p_item_type text, p_config jsonb, p_label text, p_group_instance_id uuid` | `void` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.assert_matrix_answer_writable` | `p_response_id uuid` | `void` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.assert_meeting_roster_nonempty` | `p_meeting_id uuid` | `void` | **definer** | volatile | `postgres=X/postgres` |
| `app.assert_meeting_staff_admin` | `p_meeting_id uuid` | `uuid` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_meetings_enabled` | — | `void` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_narratives_enabled` | — | `void` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_not_case_excluded` | `p_case_id uuid` | `void` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.assert_notifications_enabled` | — | `void` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_participant_same_org_as_case` *(trigger)* | — | `trigger` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.assert_patient_index_enabled` | — | `void` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_patient_required_fields` | `p_mode text, p_required text[], p_patient jsonb` | `void` | invoker | immutable | `postgres=X/postgres` |
| `app.assert_patient_safety_enabled` | — | `void` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_phase_result_ready` | `p_case_phase_id uuid` | `void` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_phase_results_enabled` | — | `void` | invoker | stable | `<NULL=PUBLIC>` |
| `app.assert_processless_cases_enabled` | — | `void` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_quality_indicators_enabled` | — | `void` | invoker | stable | `<NULL=PUBLIC>` |
| `app.assert_rca_writable` | `p_rca_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_reference_answer_writable` | `p_response_id uuid` | `void` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.assert_referral_draft_writable` | `p_referral_id uuid` | `case_referral` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_referral_due_future` | `p_due timestamp with time zone` | `void` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.assert_referral_target_acts` | `p_referral_id uuid, p_expected text[]` | `case_referral` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_referrals_enabled` | — | `void` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_respondent_linkage_resolved` | `p_participant_id uuid, p_role_id uuid` | `void` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.assert_response_correction_enabled` | — | `void` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_session_writable` | `p_session_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.assert_technical_director_enabled` | — | `void` | invoker | stable | `<NULL=PUBLIC>` |
| `app.audit_canonical` | `p_seq bigint, p_occurred_at timestamp with time zone, p_actor_id uuid, p_actor_is_admin boolean, p_commission_id uuid, p_action text, p_entity_type text, p_entity_id uuid, p_summary text, p_metadata jsonb, p_organization_id uuid, p_hospital_id uuid` | `text` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.audit_case_participant_role` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.audit_case_type_terminology` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.audit_diff` | `p_old jsonb, p_new jsonb, p_cols text[]` | `jsonb` | invoker | immutable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.audit_write` | `p_action text, p_entity_type text, p_entity_id uuid, p_commission uuid, p_summary text, p_metadata jsonb, p_organization uuid, p_hospital uuid` | `void` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.backfill_patient_keys` | — | `void` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `app.bump_case_print_revision` | `p_case_id uuid` | `void` | **definer** | volatile | `postgres=X/postgres` |
| `app.cadence_status_of` | `p_meeting_frequency text, p_last_held_at timestamp with time zone` | `text` | invoker | stable | `postgres=X/postgres` |
| `app.can_access_targeted_response` | `p_response_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_access_targeted_version` | `p_form_version_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_administer_person_for` | `p_capability text, p_user uuid, p_actor uuid` | `boolean` | **definer** | stable | `postgres=X/postgres` |
| `app.can_administer_person_via_affiliation` | `p_person uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_amend_referral_phi_snapshot` | `p_referral_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_create_professional` | `p_org uuid, p_uid uuid` | `boolean` | **definer** | stable | `postgres=X/postgres` |
| `app.can_curate_pqs_vocab` | `p_hospital_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_edit_commission_forms` | `p_commission_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_edit_referral_internal_note` | `p_note_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres` |
| `app.can_execute_dsr_task` | `p_hospital_id uuid, p_commission_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_manage_case_vocabulary` | `p_org uuid, p_uid uuid` | `boolean` | **definer** | stable | `postgres=X/postgres` |
| `app.can_manage_external_participant` | `p_org uuid, p_uid uuid` | `boolean` | **definer** | stable | `postgres=X/postgres` |
| `app.can_manage_professional` | `p_org uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_manage_referral_internal_note` | `p_note_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres` |
| `app.can_manage_referral_phi_disclosure` | `p_referral_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_manage_referral_source` | `p_referral_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_manage_referral_target` | `p_referral_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_reach_case_on_member_surface` | `p_case_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_reach_meeting` | `p_meeting_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_action_item` | `p_action_item_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_capa` | `p_capa_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_case_committee` | `p_case_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_case_patient` | `p_case_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_case` | `p_case_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_correction_response` | `p_response_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `=X/postgres,authenticated=X/postgres,postgres=X/postgres` |
| `app.can_read_document_hold` | `p_document_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_document_of_version` | `p_version_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_document_version` | `p_version_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_document` | `p_document_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_event_patient` | `p_event_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.can_read_event` | `p_event_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_file_object` | `p_file_object_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_full_case_content` | `p_case_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `postgres=X/postgres` |
| `app.can_read_full_meeting_content` | `p_meeting_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_interview` | `p_interview_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_minutes_transcript` | `p_job_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_professional_profile` | `p_profile_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_quality_dashboards` | `p_commission_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_referral_internal_notes` | `p_referral_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.can_read_referral_internal_note` | `p_note_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.can_read_referral_metadata` | `p_referral_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_referral_phi` | `p_referral_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_referral` | `p_referral_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_signoff` | `p_response_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_read_xref_row` | `p_commission_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_sign_meeting` | `p_attendee_id uuid, p_signer uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_sign_section` | `p_response_id uuid, p_section_id uuid, p_signer uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_view_printed_document` | `p_source_kind text, p_source_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_write_action_item_stake` | `p_action_item_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_write_capa` | `p_capa_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_write_case_content` | `p_case_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_write_case_narrative` | `p_narrative_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_write_document` | `p_document_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_write_interview` | `p_interview_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_write_rca` | `p_rca_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_write_referral_response` | `p_referral_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.can_write_targeted_response` | `p_response_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.case_capabilities` | `p_case_id uuid, p_uid uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.case_is_terminal` | `p_case_id uuid` | `boolean` | **definer** | stable | `postgres=X/postgres` |
| `app.case_of_action_item` | `p_action_item_id uuid` | `uuid` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.case_of_case_phase` | `p_phase_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.case_of_interview` | `p_interview_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.case_of_patient_participant` | `p_participant_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.case_phase_answer_map` | `p_case_phase_id uuid` | `jsonb` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.case_phase_option_aggregates` | `p_case_phase_id uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.commission_of_action_item` | `p_action_item_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.commission_of_case` | `p_case_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.commission_of_document_version` | `p_version_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.commission_of_document` | `p_document_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.commission_of_event` | `p_event_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.commission_of_interview` | `p_interview_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.commission_of_meeting` | `p_meeting_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.commission_of_referral` | `p_referral_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.commission_of_session` | `p_session_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.commission_of_template_phase` | `p_phase_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.commission_of_template_version` | `p_version_id uuid` | `uuid` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.commission_of_template` | `p_template_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.commission_of_version` | `p_form_version_id uuid` | `uuid` | **definer** | stable | `=X/postgres,authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.commission_staff_admin_of_case` | `p_case_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.compute_case_phase_result` | `p_case_phase_id uuid` | `void` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.compute_due_charter_notifications` | — | `integer` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.compute_due_document_review_notifications` | — | `integer` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.compute_due_ethics_notifications` | — | `integer` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.compute_sentinel_determination` | `p_reach text, p_harm text, p_natural_course boolean, p_has_designated boolean` | `boolean` | invoker | immutable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.confidentiality_clearance_ok` | `p_case_id uuid, p_label text, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.confidentiality_rank` | `p_label text` | `integer` | invoker | immutable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.controlled_version_source_path` | `p_version_id uuid` | `text` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.copy_response_answers` | `p_src_response_id uuid, p_dst_response_id uuid` | `void` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.copy_template_version_children` | `p_source_version_id uuid, p_target_version_id uuid` | `void` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.copy_version_children` | `p_source_version_id uuid, p_target_version_id uuid` | `void` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.current_professional_read_organizations` | — | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.decide_document_approval_core` | `p_version_id uuid, p_decision text, p_note text` | `document_approvals` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.delete_credential_impl` | `p_actor uuid, p_credential uuid` | `void` | **definer** | volatile | `postgres=X/postgres` |
| `app.department_belongs_to_commission` | `p_department_id uuid, p_commission_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.derive_answer_version` *(trigger)* | — | `trigger` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.derive_capa_hospital` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.derive_patient_key` | `p_value text` | `text` | **definer** | stable | `postgres=X/postgres,service_role=X/postgres` |
| `app.draft_version_of_template` | `p_template_id uuid` | `uuid` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.drop_securable_resource` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.eligible_voters` | `p_case_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.end_affiliation_impl` | `p_actor uuid, p_user uuid, p_hospital uuid, p_ended_on date` | `uuid` | **definer** | volatile | `postgres=X/postgres` |
| `app.end_org_affiliation_impl` | `p_actor uuid, p_user uuid, p_organization uuid, p_ended_on date` | `uuid` | **definer** | volatile | `postgres=X/postgres` |
| `app.enqueue_notification` | `p_user_id uuid, p_commission_id uuid, p_kind text, p_milestone text, p_is_reminder boolean, p_entity_type text, p_entity_id uuid, p_title text, p_body text, p_dedup_key text` | `boolean` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.ensure_answer_rows` | `p_response_id uuid, p_item_ids uuid[], p_instance_id uuid` | `void` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.ensure_matrix_answer_rows` | `p_response_id uuid, p_item_ids uuid[], p_instance_id uuid` | `void` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.ensure_provisioned_org_affiliation` | `p_actor uuid, p_user uuid, p_organization uuid, p_started_on date, p_allow_anchorless boolean` | `uuid` | **definer** | volatile | `postgres=X/postgres` |
| `app.ensure_securable_resource_capa_action` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.ensure_securable_resource_rca` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.ensure_securable_resource_referral` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.ensure_securable_resource` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.eval_condition` | `p_visible_when jsonb, p_answers jsonb` | `boolean` | invoker | immutable | `=X/postgres,authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.eval_validation` | `p_rule_type text, p_config jsonb, p_value jsonb, p_answers jsonb, p_peer_values jsonb` | `boolean` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.eval_visibility` | `p_rule jsonb, p_answers jsonb` | `boolean` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.event_capa_fully_settled` | `p_event_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.event_current_custodian` | `p_event_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.event_of_capa` | `p_capa_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.event_of_rca` | `p_rca_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.evidence_label_of` | `p_kind text, p_artifact uuid` | `text` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.evidence_status_of` | `p_kind text, p_artifact uuid` | `text` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.feature_enabled` | `p_key text` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.finalize_invited_person_impl` | `p_actor uuid, p_user uuid, p_full_name text, p_professional_category_id uuid, p_cpf text, p_date_of_birth date, p_phone text, p_must_change_password boolean` | `void` | **definer** | volatile | `postgres=X/postgres` |
| `app.grant_role_impl` | `p_actor uuid, p_scope_type text, p_scope_id uuid, p_role text, p_user uuid, p_title_id uuid, p_expires_at timestamp with time zone, p_allow_anchorless boolean` | `void` | **definer** | volatile | `postgres=X/postgres` |
| `app.guard_action_item` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_affiliation_no_delete` *(trigger)* | — | `trigger` | invoker | volatile | `postgres=X/postgres` |
| `app.guard_audit_immutable` *(trigger)* | — | `trigger` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.guard_audit_truncate` *(trigger)* | — | `trigger` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.guard_capa_child_lock` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_capa_status` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_case_correction_request_write` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_case_narrative_frozen` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_case_narrative_type_coherent` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_case_offered_outcome_coherent` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_case_org_matches_commission` *(trigger)* | — | `trigger` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.guard_case_outcome_coherent` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_case_participant_role_key` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_case_patient_mode_immutable` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.guard_case_patient_required` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.guard_case_phase_blocks_referenced` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_case_phase_blocks_refs` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_case_phase_refs_coherent` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_case_phase_status` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_case_reopening_write` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_case_result_link_coherent` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_case_status` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_case_tag_assignment` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_case_visibility` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_commission_oversight` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_controlled_core_binding` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.guard_controlled_document_status` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_document_confidentiality` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.guard_document_transition` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.guard_document_version_immutable` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.guard_ethics_document_case_scope` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.guard_event_custody` *(trigger)* | — | `trigger` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.guard_event_status` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_event_triage` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_file_object_transition` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.guard_frozen_approver_set` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_hospital_org_repoint` *(trigger)* | — | `trigger` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.guard_interview_child_lock` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_interview_links` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_interview_status` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_item_type_vs_validations` *(trigger)* | — | `trigger` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.guard_item_validation_row` *(trigger)* | — | `trigger` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.guard_matrix_axis_code_immutable` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_matrix_cell_coherent` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_meeting_active_print` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.guard_meeting_cases` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_meeting_child_lock` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_meeting_status` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_narrative_revision_append_only` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_org_affiliation_no_delete` *(trigger)* | — | `trigger` | invoker | volatile | `postgres=X/postgres` |
| `app.guard_phase_blocks_shape` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_printed_document_binding` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.guard_printed_document_version` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.guard_process_template_case_type` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_process_template_outcome` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_professional_linkage` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_published_template_version` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_rca_child_lock` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_rca_status` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_reference_coherent` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_referral_message` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_referral_reply_lock` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.guard_referral_snapshot_lock` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.guard_referral_status` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.guard_reserved_child_lock` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_response_active_print` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.guard_risk_matrix_coherent` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_standard_ownership_hospital` *(trigger)* | — | `trigger` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.guard_submitted_selections` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.guard_supersedes_id_frozen` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.guard_supersession_coherent` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.guard_template_narrative_type` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_template_phase_form_coherent` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.guard_template_phase_ruleset_content` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.has_case_capability` | `p_case_id uuid, p_uid uuid, p_cap text` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.has_role_any` | `p_scope_type text, p_scope_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.has_role` | `p_scope_type text, p_scope_id uuid, p_role text, p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.hospital_of_capa_action` | `p_action_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.hospital_of_commission` | `p_commission_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.hospital_of_event` | `p_event_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.hospital_of_referral` | `p_referral_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.indicator_classify` | `p_value numeric, p_target numeric, p_comparator text` | `text` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.indicator_compute_value` | `p_kind text, p_numerator numeric, p_denominator numeric` | `numeric` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.instance_answer_map` | `p_response_id uuid, p_group_instance_id uuid` | `jsonb` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.instance_is_empty` | `p_response_id uuid, p_instance_id uuid` | `boolean` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.is_active` | `p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_admin_for` | `p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_admin` | — | `boolean` | **definer** | stable | `=X/postgres,authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_affiliated_with_hospital_for` | `p_hospital_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_affiliated_with_hospital` | `p_hospital_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_case_excluded` | `p_case_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_case_respondent` | `p_case_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_client_role` | — | `boolean` | invoker | stable | `<NULL=PUBLIC>` |
| `app.is_document_approver_of` | `p_document_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_document_version_approver` | `p_version_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_dpo_of_for` | `p_hospital_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_dpo_of` | `p_hospital_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_entitled_document_approver` | `p_hospital uuid, p_user uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_hospital_admin_of_for` | `p_hospital_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_hospital_admin_of` | `p_hospital_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_hospital_member_of` | `p_hospital_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_manual_case_event_kind` | `p_kind text` | `boolean` | invoker | immutable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_member_of_for` | `p_commission_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_member_of` | `p_commission_id uuid` | `boolean` | **definer** | stable | `=X/postgres,authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_nsp_coordinator_of_for` | `p_hospital_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.is_nsp_coordinator_of` | `p_hospital_id uuid` | `boolean` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.is_nsp_org_admin_of_for` | `p_org_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_nsp_org_admin_of` | `p_org_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_org_admin_of_for` | `p_org_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_org_admin_of` | `p_org_id uuid` | `boolean` | **definer** | stable | `=X/postgres,authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_org_commission_staff_admin` | `p_org uuid, p_uid uuid` | `boolean` | **definer** | stable | `postgres=X/postgres` |
| `app.is_org_level_admin_within` | `p_org_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_org_member` | `p_org_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_oversight_only_reader` | `p_case_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_pqs_member_of_any` | `p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_pqs_member_of_for` | `p_hospital_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.is_pqs_member_of` | `p_hospital_id uuid` | `boolean` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.is_pqs_operator_in_org_for` | `p_org_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_pqs_operator_in_org` | `p_org_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_pqs_operator_of_for` | `p_hospital_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_pqs_operator_of` | `p_hospital_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_pqs_writer_of` | `p_hospital_id uuid` | `boolean` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.is_quality_reviewer_in_org` | `p_org_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_quality_reviewer_of_for` | `p_hospital_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_quality_reviewer_of` | `p_hospital_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_recused_from_case` | `p_case_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_signoff_deferral_open` | `p_response_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_staff_admin_of_for` | `p_commission_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_staff_admin_of` | `p_commission_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_technical_director_of_for` | `p_hospital_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `postgres=X/postgres` |
| `app.is_tenancy_admin_of_for` | `p_commission_id uuid, p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_tenancy_admin_of` | `p_commission_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_valid_condition` | `p jsonb` | `boolean` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.is_valid_cpf` | `p_cpf text` | `boolean` | invoker | immutable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_valid_flagged_when` | `p_config jsonb, p_item_type text` | `boolean` | invoker | immutable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.is_valid_recommend_cond` | `p jsonb` | `boolean` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.is_valid_recommend_when` | `p jsonb` | `boolean` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.is_valid_validation_config` | `p_rule_type text, p_config jsonb` | `boolean` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.is_valid_visibility` | `p jsonb` | `boolean` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.item_bound_violations` | `p_item_type text, p_config jsonb, p_label text, p_value jsonb` | `record` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.item_cardinality` | `p_config jsonb, p_key text` | `integer` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.item_is_required` | `p_required boolean, p_required_if jsonb, p_answers jsonb` | `boolean` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.item_question_type` | `p_version_id uuid, p_question_key text` | `text` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.item_required_satisfied` | `p_response_id uuid, p_item_id uuid, p_item_type text, p_instance_id uuid` | `boolean` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.jsonb_canonical` | `p_value jsonb` | `text` | invoker | immutable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.latest_published_version` | `p_form_id uuid` | `uuid` | **definer** | stable | `=X/postgres,authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.matrix_axis_entries` | `p_payload jsonb` | `record` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.matrix_cells_by_item` | `p_response_id uuid, p_instance_id uuid` | `jsonb` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.member_can_for` | `p_commission_id uuid, p_capability text, p_user_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.member_can` | `p_commission_id uuid, p_capability text` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.mint_capa_code` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.mint_case_number` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.mint_controlled_document_code` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.mint_controlled_document_resource` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.mint_event_code` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.mint_indicator_code` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.mint_interview_number` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.mint_meeting_number` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.normalize_identifier` | `p_value text` | `text` | invoker | immutable | `postgres=X/postgres,service_role=X/postgres` |
| `app.normalize_interview_confidentiality` *(trigger)* | — | `trigger` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.org_of_commission` | `p_commission_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.org_of_hospital` | `p_hospital_id uuid` | `uuid` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.overlay_answer_map` | `p_base jsonb, p_overlay jsonb` | `jsonb` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.participant_type_label` | `p_type text` | `text` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.patient_key_to_uuid` | `p_key text` | `uuid` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.patient_match_basis` | `p_by_patient boolean, p_by_encounter boolean` | `text` | invoker | immutable | `postgres=X/postgres,service_role=X/postgres` |
| `app.patient_required_missing` | `p_mode text, p_required text[], p_patient jsonb` | `text[]` | invoker | immutable | `postgres=X/postgres` |
| `app.patient_trajectory_bundle` | `p_patient_key text, p_encounter_key text, p_hospital_id uuid` | `jsonb` | **definer** | stable | `postgres=X/postgres,service_role=X/postgres` |
| `app.pending_staff_signoffs` | `p_response_id uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.person_audit_organization` | `p_actor uuid, p_user uuid` | `uuid` | **definer** | stable | `postgres=X/postgres` |
| `app.person_authority_orgs` | `p_person uuid` | `uuid` | **definer** | stable | `postgres=X/postgres` |
| `app.person_has_active_org_affiliation` | `p_person uuid, p_organization uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.person_is_anchorless` | `p_user uuid` | `boolean` | **definer** | stable | `postgres=X/postgres` |
| `app.person_known_to_org` | `p_user uuid, p_organization uuid` | `boolean` | **definer** | stable | `postgres=X/postgres` |
| `app.print_source_head` | `p_source_kind text, p_source_id uuid, p_source_revision integer` | `boolean` | **definer** | stable | `postgres=X/postgres` |
| `app.print_source_registers` | `p_source_kind text, p_source_id uuid` | `boolean` | **definer** | stable | `postgres=X/postgres` |
| `app.print_source_revision` | `p_source_kind text, p_source_id uuid` | `integer` | **definer** | stable | `postgres=X/postgres` |
| `app.print_source_series` | `p_source_kind text, p_source_id uuid` | `uuid` | **definer** | stable | `postgres=X/postgres` |
| `app.print_source_watermark` | `p_source_kind text, p_source_id uuid` | `text` | **definer** | stable | `postgres=X/postgres` |
| `app.printed_document_is_current` | `p_id uuid` | `boolean` | **definer** | stable | `postgres=X/postgres` |
| `app.printed_rendition_storage_bucket` | `p_contains_phi boolean` | `text` | invoker | immutable | `postgres=X/postgres` |
| `app.printed_rendition_storage_path` | `p_id uuid` | `text` | invoker | immutable | `postgres=X/postgres` |
| `app.published_version_of_form` | `p_form_id uuid` | `uuid` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.published_version_of_template` | `p_template_id uuid` | `uuid` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.rca_bump_in_progress` | `p_rca_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.reclassify_indicator_measurements` | `p_indicator uuid` | `void` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.recommend_when_conditions` | `p_rule jsonb` | `jsonb` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.recompute_case_status` | `p_case_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.recompute_template_phase_offered_results` | `p_phase_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.recover_orphan_person_to_org_impl` | `p_actor uuid, p_user uuid, p_organization uuid, p_started_on date` | `uuid` | **definer** | volatile | `postgres=X/postgres` |
| `app.references_by_item` | `p_response_id uuid, p_instance_id uuid` | `jsonb` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.referral_is_overdue` | `p_due timestamp with time zone, p_status text` | `boolean` | invoker | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.referral_target_analyst` | `p_referral_id uuid, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.resolve_default_source` | `p_source text, p_actor uuid, p_commission_id uuid` | `jsonb` | invoker | stable | `<NULL=PUBLIC>` |
| `app.resolve_document_version_bytes` | `p_document_version_id uuid, p_rendition_kind text, p_uid uuid` | `record` | **definer** | stable | `postgres=X/postgres` |
| `app.resolve_notifications_for` | `p_entity_type text, p_entity_id uuid` | `void` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.resolve_print_source_state` | `p_source_kind text, p_source_id uuid, OUT o_found boolean, OUT o_status text, OUT o_correction_open boolean, OUT o_phase_voided boolean, OUT o_meeting_disposed boolean, OUT o_case_disposed boolean` | `record` | **definer** | stable | `postgres=X/postgres` |
| `app.resolve_requested_action_label` | `p_action_id uuid` | `text` | invoker | stable | `<NULL=PUBLIC>` |
| `app.response_required_complete` | `p_response_id uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.response_validation_errors` | `p_response_id uuid` | `record` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.revoke_role_impl` | `p_actor uuid, p_scope_type text, p_scope_id uuid, p_role text, p_user uuid` | `void` | **definer** | volatile | `postgres=X/postgres` |
| `app.rewrite_condition_keys` | `p_condition jsonb, p_map jsonb` | `jsonb` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.risk_matrix_by_item` | `p_response_id uuid, p_instance_id uuid` | `jsonb` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.save_instance_answers` | `p_response_id uuid, p_version_id uuid, p_entry jsonb` | `void` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.save_matrix_answers` | `p_response_id uuid, p_version_id uuid, p_payload jsonb, p_instance_id uuid` | `void` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.save_reference_answers` | `p_response_id uuid, p_version_id uuid, p_payload jsonb, p_instance_id uuid` | `void` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.save_risk_matrix_answers` | `p_response_id uuid, p_version_id uuid, p_payload jsonb, p_instance_id uuid` | `void` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.seed_default_answers` | `p_response_id uuid, p_form_version_id uuid, p_commission_id uuid, p_actor uuid` | `void` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.seed_default_meeting_types` | `p_commission_id uuid` | `void` | **definer** | volatile | `postgres=X/postgres,service_role=X/postgres` |
| `app.seed_default_member_titles` | `p_commission_id uuid` | `void` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.seed_meetings_on_commission_insert` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.seed_member_titles_on_commission_insert` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.set_person_active_impl` | `p_actor uuid, p_user uuid, p_active boolean` | `void` | **definer** | volatile | `postgres=X/postgres` |
| `app.set_referral_code` *(trigger)* | — | `trigger` | invoker | volatile | `postgres=X/postgres` |
| `app.signoff_target` | `p_response_id uuid, p_section_id uuid` | `record` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.storage_upload_reserved` | `p_bucket text, p_name text, p_uid uuid` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.submitted_form_responses` | `p_form_id uuid` | `responses` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.suspend_person_impl` | `p_actor uuid, p_user uuid, p_suspended_until timestamp with time zone` | `void` | **definer** | volatile | `postgres=X/postgres` |
| `app.sync_answer_typed_values` *(trigger)* | — | `trigger` | invoker | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.tenant_orphan_profiles` | — | `record` | **definer** | stable | `postgres=X/postgres` |
| `app.touch_case_correction_request_updated_at` *(trigger)* | — | `trigger` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.touch_case_narrative_updated_at` *(trigger)* | — | `trigger` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.touch_controlled_updated` *(trigger)* | — | `trigger` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.touch_hospital_department_updated_at` *(trigger)* | — | `trigger` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.touch_indicator_updated` *(trigger)* | — | `trigger` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.touch_interview_updated_at` *(trigger)* | — | `trigger` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.touch_referral_note_updated_at` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.touch_updated_at` *(trigger)* | — | `trigger` | invoker | volatile | `<NULL=PUBLIC>` |
| `app.trg_attendee_roster` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_accreditation_frameworks` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_accreditation_standards` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_action_item_checklists` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_action_item_reminders` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_action_item_status_history` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_action_item_updates` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_action_items` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_administrativo_capabilities` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_administrativo` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_capa_effectiveness` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_capa_plan` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_case_access` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_case_child` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_case_narrative_types` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_case_narratives` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_case_patient` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.trg_audit_case_phases` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_cases` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_commissions` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_controlled_document_versions` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_controlled_documents` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_document_approvals` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_event_custody` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_event_patient` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_event_triage` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_evidence_links` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_form_items` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_form_sections` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_form_versions` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_forms` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_hospital_affiliations` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.trg_audit_hospital_updated` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_indicator_measurements` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_indicators` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_interviews` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_meeting_signatures` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_meetings` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_memberships` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_organization_affiliations` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.trg_audit_patient_identifiers` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_rca` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_referral_patient` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.trg_audit_referral` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.trg_audit_responses` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_safety_event` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_signoffs` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_standard_assessments` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_standard_ownerships` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_template_narratives` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_audit_template_versions` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_bump_case_revision_answers_new` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.trg_bump_case_revision_answers_old` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.trg_bump_case_revision_case_type` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.trg_bump_case_revision_documents` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.trg_bump_case_revision_narrative_type` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.trg_bump_case_revision_outcome` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.trg_bump_case_revision_participant_role` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.trg_bump_case_revision_self` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.trg_bump_case_revision_tag` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.trg_bump_case_revision_via_interview` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.trg_bump_case_revision_via_participant` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.trg_bump_case_revision` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.trg_complete_phase_on_signoff` *(trigger)* | — | `trigger` | **definer** | volatile | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.trg_derive_patient_keys` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.trg_meetings_roster` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_pin_respondent_retention` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_recompute_case_status` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_xref_maintain_patient_identifiers` *(trigger)* | — | `trigger` | **definer** | volatile | `<NULL=PUBLIC>` |
| `app.trg_xref_maintain` *(trigger)* | — | `trigger` | **definer** | volatile | `postgres=X/postgres` |
| `app.update_affiliation_impl` | `p_actor uuid, p_user uuid, p_hospital uuid, p_employee_id text, p_started_on date, p_clear_employee_id boolean, p_job_title text, p_work_email text, p_work_phone text, p_clear_job_title boolean, p_clear_work_email boolean, p_clear_work_phone boolean` | `uuid` | **definer** | volatile | `postgres=X/postgres` |
| `app.update_org_affiliation_impl` | `p_actor uuid, p_user uuid, p_organization uuid, p_started_on date` | `uuid` | **definer** | volatile | `postgres=X/postgres` |
| `app.update_person_fields_impl` | `p_actor uuid, p_user uuid, p_full_name text, p_professional_category_id uuid, p_set_cpf boolean, p_cpf text, p_set_date_of_birth boolean, p_date_of_birth date, p_set_phone boolean, p_phone text` | `void` | **definer** | volatile | `postgres=X/postgres` |
| `app.upsert_credential_impl` | `p_actor uuid, p_user uuid, p_id uuid, p_issuing_country text, p_issuing_state text, p_issuing_authority text, p_registration_number text, p_expires_on date` | `uuid` | **definer** | volatile | `postgres=X/postgres` |
| `app.validate_group_layout` | `p_form_version_id uuid` | `boolean` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.validate_indicator_derived_config` | `p_commission uuid, p_kind text, p_data_source text, p_config jsonb` | `void` | invoker | stable | `<NULL=PUBLIC>` |
| `app.validate_matrix_axes` | `p_form_version_id uuid` | `void` | invoker | stable | `<NULL=PUBLIC>` |
| `app.validate_template_allowed_results` | `p_template_version_id uuid, p_position integer, p_allowed_result_ids jsonb` | `boolean` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.validate_template_phase_blocks` | `p_template_version_id uuid, p_position integer, p_blocks integer[]` | `boolean` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.validate_template_phase_result` | `p_template_version_id uuid, p_position integer` | `boolean` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.validate_template_recommend_when` | `p_template_version_id uuid, p_position integer, p_recommend_when jsonb` | `boolean` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.validate_template_result_ruleset` | `p_template_version_id uuid, p_position integer, p_result_ruleset jsonb` | `boolean` | **definer** | stable | `<NULL=PUBLIC>` |
| `app.validation_rule_allowed` | `p_rule_type text, p_item_type text, p_parent_item_type text` | `boolean` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.validation_value_is_empty` | `p_value jsonb` | `boolean` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.version_has_input_key` | `p_version_id uuid, p_question_key text` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.version_has_option_code` | `p_version_id uuid, p_question_key text, p_code text` | `boolean` | **definer** | stable | `authenticated=X/postgres,postgres=X/postgres,service_role=X/postgres` |
| `app.visibility_conditions` | `p_rule jsonb` | `jsonb` | invoker | immutable | `<NULL=PUBLIC>` |
| `app.void_affiliation_impl` | `p_actor uuid, p_affiliation uuid, p_reason text` | `uuid` | **definer** | volatile | `postgres=X/postgres` |
| `app.void_org_affiliation_impl` | `p_actor uuid, p_org_affiliation uuid, p_reason text` | `uuid` | **definer** | volatile | `postgres=X/postgres` |
