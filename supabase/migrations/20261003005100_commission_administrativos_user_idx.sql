-- AE1.1 follow-up (plan close condition #4; plan-audit finding PA-F15) —
-- ONE supporting index on `commission_administrativos`, and NOT for the reason PA-F15 gave.
--
-- WHAT PA-F15 CLAIMED: AE1.1's two FKs "lack supporting indexes", so a cascade from
-- `profiles(id)` full-scans this table. The AE1 handoff halved that to one index, on
-- `user_id`, because `commission_id` is the LEADING column of the PK `(commission_id,
-- user_id)` and is therefore already supported, while `user_id` is trailing and a btree on
-- a composite cannot serve a lookup by a trailing column alone.
--
-- ⛔ MEASURED 2026-08-27, AND THE CASCADE PREMISE DOES NOT HOLD AT ALL. A `profiles` row can
-- never be deleted, by TWO independent barriers:
--   1. `guard_profile_no_delete_trg` — BEFORE DELETE on `profiles`, tgenabled='O', raising
--      "profiles are never deleted; deactivate via is_active";
--   2. `profiles_id_fkey -> auth.users(id) ON DELETE RESTRICT` — so deleting the upstream
--      auth row is refused too, rather than cascading in.
-- So the ON DELETE CASCADE on `user_id` cannot fire, and neither can the RI check behind
-- `appointed_by`'s NO ACTION. An index added on cascade grounds would be an index for a code
-- path that cannot execute. (The guard is skipped under session_replication_role='replica' —
-- but FK actions are skipped there too, so the cascade still does not run.)
--
-- ✅ WHY THE INDEX IS STILL WARRANTED, on its own evidence: the RLS policy
-- `commission_administrativos_select` ends in
--     ... OR (user_id = ( SELECT auth.uid() ))
-- a SELF-READ that filters by `user_id` with NO `commission_id` beside it — exactly the
-- lookup the PK's trailing column cannot serve. Every non-admin read of this table
-- evaluates that leg.
--
-- ⛔ AND NOT ON `appointed_by`: nothing filters by it (swept `pg_policies` + comment-stripped
-- `prosrc` over app/public + `src/`), and its RI check is unreachable for the reason above.
-- Adding it "for symmetry" would be an index no query and no constraint can use. The sibling
-- convention (`memberships_granted_by_idx`) is NOT a counter-argument: conventions are
-- evidence about habits, not about this table's access paths.
--
-- Plain CREATE INDEX, not CONCURRENTLY: migrations run inside a transaction, where
-- CONCURRENTLY is not permitted, and this table is small pre-pilot.

create index if not exists commission_administrativos_user_idx
  on public.commission_administrativos (user_id);

comment on index public.commission_administrativos_user_idx is
  'Serves the commission_administrativos_select policy''s self-read leg (user_id = auth.uid()), '
  'which filters by user_id alone and so cannot use the PK (commission_id, user_id). '
  'NOT a cascade-support index: profiles rows are never deleted (guard_profile_no_delete_trg '
  '+ profiles_id_fkey ON DELETE RESTRICT), so the user_id CASCADE cannot fire. AE1.1/PA-F15.';
