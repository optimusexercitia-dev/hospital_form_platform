-- ===========================================================================
-- Phase 8 — B6 follow-up: close the dashboard_export_rows anon-EXECUTE leak
-- ===========================================================================
-- dashboard_export_rows was created in 20260613090013 AFTER the B6 revoke in
-- 20260613090012, and 20260613090012's `alter default privileges ... revoke
-- execute on functions FROM anon` only suppressed the default grant to `anon` —
-- NOT the implicit grant to the PUBLIC pseudo-role. Postgres still grants EXECUTE
-- to PUBLIC on every newly-created function, and `anon` inherits it through
-- PUBLIC. So the new function re-leaked anon EXECUTE (it self-gates on
-- is_staff_admin_of / is_admin, so no data leaked — but it contradicts the B6
-- invariant "anon has zero EXECUTE on public").
--
-- This forward-only migration (does NOT rewrite the committed 090012/090013):
--   1. explicitly revokes EXECUTE on dashboard_export_rows from public + anon;
--   2. fixes the root cause durably so FUTURE functions cannot re-leak — revoke
--      the default EXECUTE-to-PUBLIC (090012 only did `from anon`).
-- authenticated + service_role keep their explicit grants (the CSV route runs as
-- the staff_admin/authenticated role), so the export path is unaffected.
-- ===========================================================================

-- 1) Immediate fix for the one leaked function.
revoke all on function public.dashboard_export_rows(uuid) from public, anon;

-- 2) Root cause: also revoke the default EXECUTE-to-PUBLIC on future public
--    functions (090012 revoked the default only `from anon`, leaving the PUBLIC
--    default intact, which is what re-leaked anon via inheritance).
alter default privileges in schema public revoke execute on functions from public;
