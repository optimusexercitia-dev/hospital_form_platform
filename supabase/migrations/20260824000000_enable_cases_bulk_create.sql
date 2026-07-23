-- ============================================================================
-- Flip `cases_bulk_create` ON permanently (same convention as the ADR-0083
-- case_custom_fields flip 20260822000000, the Phase-17 controlled_docs flip
-- 20260713000400, and the S1·N notifications flip 20260720000720). The
-- bulk_create_cases RPC + assert_bulk_create_enabled guard + the "Múltiplos casos"
-- wizard/action are all live. Seeded OFF in 20260823000000; this is the deliberate
-- permanent prod flip (PO decision). seed.sql additionally forces it ON for
-- local/E2E (redundant here, keeps the two paths honest).
-- ============================================================================

update app.feature_flags set enabled = true where key = 'cases_bulk_create';
