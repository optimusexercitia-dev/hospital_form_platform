-- ============================================================================
-- Flip `case_corrections` ON permanently (same convention as the ADR-0084
-- cases_bulk_create flip 20260824000000, the ADR-0083 case_custom_fields flip
-- 20260822000000, and the Phase-17 controlled_docs flip 20260713000400). The
-- Case Correction Lifecycle (ADR 0085) — the 9 request/reopen doors, the
-- guard_supersession_coherent corrector arm, case_correction_requests /
-- case_narrative_revisions / case_reopenings, and the current_response_id
-- reader sweep — are all live and gate-passed (QA APPROVED). Seeded OFF in
-- 20260825000000; this is the deliberate permanent go-live flip (PO decision,
-- 2026-07-24). seed.sql additionally forces it ON for local/E2E (redundant
-- here, keeps the two paths honest).
-- ============================================================================

update app.feature_flags set enabled = true where key = 'case_corrections';
