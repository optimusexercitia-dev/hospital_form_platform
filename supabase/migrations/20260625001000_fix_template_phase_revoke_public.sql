-- ----------------------------------------------------------------------------
-- Baseline security fix — re-REVOKE PUBLIC on add/update_template_phase
--
-- 20260624150000_phase_result_manual_mode.sql DROPped + re-CREATEd
-- public.add_template_phase / public.update_template_phase with NEW, WIDER
-- signatures (added p_emits_result / p_allowed_result_ids / p_clear_*). A
-- DROP+CREATE yields a FRESH function identity that re-acquires the default
-- PUBLIC EXECUTE grant, and that migration did NOT re-issue the REVOKE — so both
-- RPCs are currently EXECUTE-able by PUBLIC (incl. the `anon` web role), a real
-- PostgREST exposure. (The generic anon-leak sweep, tests/100_dashboard.sql
-- test 19, catches this.)
--
-- Forward-only fix: re-state the standard REVOKE PUBLIC / GRANT authenticated,
-- service_role block for BOTH functions at their CURRENT (full, widened)
-- signatures. Mirrors the original grant block in
-- 20260620020000_phase_results.sql. No behavior change — privileges only.
-- ----------------------------------------------------------------------------
SET check_function_bodies = false;
SET client_min_messages = warning;

REVOKE ALL ON FUNCTION "public"."add_template_phase"("p_template_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_default_due_days" integer, "p_blocks" integer[], "p_result_ruleset" "jsonb", "p_emits_result" boolean, "p_allowed_result_ids" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_template_phase"("p_template_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_default_due_days" integer, "p_blocks" integer[], "p_result_ruleset" "jsonb", "p_emits_result" boolean, "p_allowed_result_ids" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_template_phase"("p_template_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_default_due_days" integer, "p_blocks" integer[], "p_result_ruleset" "jsonb", "p_emits_result" boolean, "p_allowed_result_ids" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."update_template_phase"("p_phase_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_clear_recommend_when" boolean, "p_default_due_days" integer, "p_clear_default_due_days" boolean, "p_blocks" integer[], "p_clear_blocks" boolean, "p_result_ruleset" "jsonb", "p_clear_result_ruleset" boolean, "p_emits_result" boolean, "p_allowed_result_ids" "jsonb", "p_clear_allowed_result_ids" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_template_phase"("p_phase_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_clear_recommend_when" boolean, "p_default_due_days" integer, "p_clear_default_due_days" boolean, "p_blocks" integer[], "p_clear_blocks" boolean, "p_result_ruleset" "jsonb", "p_clear_result_ruleset" boolean, "p_emits_result" boolean, "p_allowed_result_ids" "jsonb", "p_clear_allowed_result_ids" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_template_phase"("p_phase_id" "uuid", "p_form_id" "uuid", "p_title" "text", "p_recommend_when" "jsonb", "p_clear_recommend_when" boolean, "p_default_due_days" integer, "p_clear_default_due_days" boolean, "p_blocks" integer[], "p_clear_blocks" boolean, "p_result_ruleset" "jsonb", "p_clear_result_ruleset" boolean, "p_emits_result" boolean, "p_allowed_result_ids" "jsonb", "p_clear_allowed_result_ids" boolean) TO "service_role";
