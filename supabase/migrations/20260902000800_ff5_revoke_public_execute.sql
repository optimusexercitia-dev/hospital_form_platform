-- =============================================================================
-- FF-5 — FIX: two public functions became ANON-EXECUTABLE.
--
-- Caught by the standing keystone in `100_dashboard.sql` ("no public function is
-- anon-executable (catches any future PUBLIC re-leak)"), which reported 2 where
-- it wants 0. Both are FF-5's doing, and they got there by different routes:
--
--   1. `public.reference_candidates` — NEW in 20260902000100, granted to
--      `authenticated` but never revoked from PUBLIC. A function's default ACL
--      grants EXECUTE to PUBLIC, so "grant to authenticated" ADDS a grant and
--      removes nothing. Every other public RPC in this codebase pairs the grant
--      with a revoke (see `dashboard_matrix_cells` / `dashboard_risk_scores`);
--      this one did not.
--
--   2. `public.save_section_answers` — a REGRESSION, and the more interesting
--      one. 20260902000200 added the 11th parameter, which requires DROP + CREATE
--      rather than `create or replace`. That migration correctly restored the
--      grants it had read from `pg_proc.proacl` beforehand
--      ("authenticated=X, service_role=X") — but an ACL read that way shows only
--      what IS granted, never what was REVOKED. DROP FUNCTION discards the whole
--      ACL including the revoke, and CREATE hands PUBLIC the default EXECUTE
--      back. So restoring the observed grants faithfully still widened the
--      function, and the widening is INVISIBLE in a diff of the grant lines.
--
--      ⚠ The rule this produces, for the next DROP+CREATE: restoring an ACL means
--      restoring the REVOKES too. `proacl` does not record them — an absent PUBLIC
--      entry means "PUBLIC was revoked", and that absence is exactly what a
--      re-CREATE undoes.
--
-- Neither is a data leak: both are INVOKER-rights and RLS-gated, and `anon`
-- carries no `auth.uid()`, so the response lookup in each returns nothing and
-- raises. The point is that nobody should have to re-derive that. The invariant
-- is "anon executes nothing in `public`", and it is a boundary precisely so it
-- can be checked instead of reasoned about.
--
-- SQLSTATE: allocates none.
-- =============================================================================

revoke all on function public.reference_candidates(uuid, uuid, text) from public;
grant execute on function public.reference_candidates(uuid, uuid, text) to authenticated;

revoke all on function public.save_section_answers(
  uuid, uuid, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public;
grant execute on function public.save_section_answers(
  uuid, uuid, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to authenticated, service_role;
