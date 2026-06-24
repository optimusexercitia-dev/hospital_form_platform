-- Feature flags: default ON.
--
-- Until now every feature flag shipped OFF (column default `false`; each seeded
-- flag explicitly OFF until its phase completed). All shipped phases are complete,
-- so this migration makes the platform default to fully-enabled:
--   1. Flip the `enabled` column default to `true`, so any future flag inserted
--      without an explicit value ships ON.
--   2. Turn every existing flag ON, so a `supabase db reset` (which re-runs the
--      historical seed INSERTs, some of which set `enabled = false`) ends with all
--      flags ON instead of needing a manual flip afterward.
--
-- NOTE: `app.feature_enabled()` keeps its `coalesce(..., false)` fallback — an
-- UNKNOWN flag key still reads as OFF (a mistyped flag check must never silently
-- enable a surface). This migration only affects rows that actually exist.

ALTER TABLE "app"."feature_flags" ALTER COLUMN "enabled" SET DEFAULT true;

UPDATE "app"."feature_flags" SET "enabled" = true WHERE "enabled" = false;
