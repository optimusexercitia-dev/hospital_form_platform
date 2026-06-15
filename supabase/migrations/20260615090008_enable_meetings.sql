-- Phase 10 / B: enable the `meetings` feature flag.
--
-- The meetings data model + RPCs (…090000–…090007) ship dark behind the
-- `meetings` flag. This one-line migration flips it ON (mirroring the cases
-- enable migrations 20260613090008 / 20260614092006). It is applied DURING the
-- phase — same as the cases precedent — so the Playwright E2E gate exercises the
-- LIVE feature (otherwise every meetings route 404s for the tester and the
-- direct-table writes fail the `meetings_enabled()` gate). After this,
-- `supabase db reset` leaves `meetings` ON.
update app.feature_flags set enabled = true where key = 'meetings';
