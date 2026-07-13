-- ============================================================================
-- S1·N · Flip `notifications` ON (S1·N gate — same convention as SUP's
-- 20260720000610 and Phase-15's quality_indicators flip). Applied locally on
-- every `db reset` like every prior gate-flip migration; the LEAD applies this
-- to prod only at the S1·N gate. seed.sql additionally forces it ON for
-- local/E2E (redundant here, keeps the two paths honest).
-- ============================================================================

update app.feature_flags set enabled = true where key = 'notifications';
