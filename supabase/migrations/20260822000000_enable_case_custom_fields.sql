-- ============================================================================
-- ADR 0083 · Flip `case_custom_fields` ON permanently (same convention as the
-- Phase-17 controlled_docs flip 20260713000400 and S1·N notifications flip
-- 20260720000720). Core tables (process_template_custom_fields +
-- case_custom_field_values), the create_case_from_template snapshot extension,
-- the update_case_custom_field_values RPC, and the builder/detail UI surfaces
-- are all live. Seeded OFF in 20260821000000; this is the deliberate permanent
-- prod flip. seed.sql additionally forces it ON for local/E2E (redundant here,
-- keeps the two paths honest).
-- ============================================================================

update app.feature_flags set enabled = true where key = 'case_custom_fields';
