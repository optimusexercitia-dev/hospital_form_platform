-- ----------------------------------------------------------------------------
-- Enable the `case_patient` feature flag (THIRD PHI module; ADR 0038)
-- ----------------------------------------------------------------------------
-- Flips the flag seeded OFF by 20260620017000_case_patient.sql to ON, now that
-- the feature has passed its Phase Gate (E2E 15/15, QA APPROVED, human ✓
-- 2026-06-22). Mirrors the established flag-flip migration pattern
-- (…090008 `cases_multi_phase` → ON, …110004 `case_access` → ON). Forward-only;
-- the row already exists (…017000 seeds it OFF), so a plain UPDATE suffices.
UPDATE "app"."feature_flags" SET "enabled" = true WHERE "key" = 'case_patient';
