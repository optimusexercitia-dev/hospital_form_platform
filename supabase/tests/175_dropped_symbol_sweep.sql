-- NSP-per-org dropped-symbol catalog sweep (ADR 0042; migration 20260630000000).
-- PERMANENT GUARD for the "dropped-symbol dangling caller" class. The migration
-- DROPPED three predicates and rebound every inventoried caller:
--   * app.is_pqs_writer()       → app.is_pqs_writer_of(org)
--   * app.is_pqs_member(uuid)   → app.is_pqs_member_of[_for](org[,uid]) / _of_any(uid)
--   * app.is_multi_org()        → (deleted; the per-org binding replaces it)
-- But a CREATE OR REPLACE that copied a STALE base could leave an OFF-INVENTORY
-- caller still referencing a dropped symbol — it then ERRORS at call time (this was
-- exactly the M2 class: capa_viewer_can_manage AND capa_kpis both crashed; a file
-- grep missed them, only a CATALOG sweep caught the second). This file asserts the
-- LIVE catalog (function bodies + RLS policy expressions) has ZERO references to any
-- dropped symbol, so the class can never silently return.
--
-- The regex uses \m (word boundary) + an immediate '(' so the BARE dropped names
-- match while the rebound names do NOT:
--   is_pqs_member(   → MATCH (dropped)        is_pqs_member_of(   → no match (the
--                                              char after 'member' is '_', not '(')
--   is_pqs_writer(   → MATCH (dropped)        is_pqs_writer_of(   → no match
--   is_multi_org(    → MATCH (dropped)
-- Pattern: \m(is_pqs_writer|is_pqs_member|is_multi_org)\(

begin;
select plan(4);

-- (1) No APPLICATION FUNCTION body references a dropped symbol. Scoped to the app +
-- public schemas (the application surface) — NOT test_helpers, whose bootstrap()
-- body legitimately mentions `app.is_multi_org()` in a PROSE COMMENT explaining why
-- it wipes the seed; that is a fixture comment, not a live call, and must not trip
-- the guard. (prosrc includes comment text, so an unscoped sweep false-positives on it.)
select is(
  (select count(*)::int from pg_proc
   where pronamespace in ('app'::regnamespace, 'public'::regnamespace)
     and prosrc ~ '\m(is_pqs_writer|is_pqs_member|is_multi_org)\('),
  0,
  'SWEEP: ZERO app/public pg_proc bodies reference a dropped symbol (is_pqs_writer/is_pqs_member/is_multi_org)');

-- (2) No RLS policy USING (qual) expression references a dropped symbol.
select is(
  (select count(*)::int from pg_policies
   where coalesce(qual, '') ~ '\m(is_pqs_writer|is_pqs_member|is_multi_org)\('),
  0,
  'SWEEP: ZERO pg_policies USING (qual) clauses reference a dropped symbol');

-- (3) No RLS policy WITH CHECK expression references a dropped symbol.
select is(
  (select count(*)::int from pg_policies
   where coalesce(with_check, '') ~ '\m(is_pqs_writer|is_pqs_member|is_multi_org)\('),
  0,
  'SWEEP: ZERO pg_policies WITH CHECK clauses reference a dropped symbol');

-- (4) Sanity: the regex is CALIBRATED — the rebound replacements DO exist in the
-- catalog (so test (1) returning 0 means "no dropped refs", not "no NSP code at all").
-- At least one function body must reference a rebound name (is_pqs_member_of /
-- is_pqs_writer_of). This fails loudly if a future refactor accidentally strips the
-- whole per-org surface (which would also make tests 1–3 vacuously pass).
select ok(
  (select count(*)::int from pg_proc
   where pronamespace in ('app'::regnamespace, 'public'::regnamespace)
     and prosrc ~ '\m(is_pqs_writer_of|is_pqs_member_of)\(') >= 1,
  'SWEEP CALIBRATION: the rebound per-org predicates ARE present (regex distinguishes bare vs _of)');

select * from finish();
rollback;
