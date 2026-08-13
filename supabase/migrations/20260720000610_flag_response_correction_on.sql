-- ============================================================================
-- SUP · Flip `response_correction` ON (SUP gate — same convention as the
-- Phase-15 quality_indicators flip). Prod ships ON from this migration; local/
-- E2E additionally forces it ON via seed.sql (db reset re-applies migrations
-- then seed, so this line is redundant there but keeps the two paths honest).
-- ============================================================================

update app.feature_flags set enabled = true where key = 'response_correction';
