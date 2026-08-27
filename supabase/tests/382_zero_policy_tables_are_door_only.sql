-- AE1.6 (docs/plans/authz-evolution.md, ADR 0155 D9) — the security advisor's
-- RLS-enabled / zero-policy findings, pinned so an accidental future policy or
-- grant reds a test instead of silently widening access.
--
-- Subject — the seven `public` tables measured (2026-08-27, live catalog) to have
-- RLS ENABLED and CARRY NO POLICY AT ALL (pg_class.relrowsecurity = true, zero
-- rows in pg_policies):
--   case_print_revisions · meeting_closed_session_item_readers ·
--   meeting_closed_session_items · patient_identifiers · patient_participants ·
--   referral_patient · verification_lookups.
-- Three of these are Rule 12 Class-1 patient-PHI tables (patient_identifiers,
-- patient_participants, referral_patient) and get the deepest coverage here (§C).
--
-- ⚠ MEASURED, NOT ASSUMED (the task's own trap). On every one of these seven,
-- `authenticated` ALSO holds ZERO table-level or column-level grant for
-- SELECT/INSERT/UPDATE/DELETE — confirmed via has_table_privilege (which correctly
-- folds in column-list grants and PUBLIC-via-NULL-acl; never inferred from an
-- empty-looking relacl). So on THESE SEVEN, two INDEPENDENT layers deny access,
-- and this suite names which is which — conflating them would claim more than
-- either layer alone proves:
--   - §B (GRANT layer, static catalog check). `has_table_privilege` reads the
--     ACL. Table-privilege is what Postgres checks FIRST, before RLS is ever
--     evaluated — so the runtime 42501 observed in §C, for every one of these
--     seven tables and every verb, comes from the GRANT layer, not from RLS.
--   - §A (RLS layer, structural). relrowsecurity = true + zero pg_policies rows.
--     Today this is a REDUNDANT backstop (the grant layer already blocks
--     everything before RLS runs) — but it is the layer this task exists to pin:
--     if a future migration ever GRANTs one of these verbs to `authenticated`
--     without ALSO adding a policy, §A stays green while §B/§C go red; if a
--     policy is added with no grant change, §A goes red while §B/§C stay green.
--     Neither assertion implies the other; both are asserted per table.
-- §D is the vacuity / positive control the task demands: the SAME detector
-- shapes used in §A/§B/§C, shown (a) passing on a table `authenticated`
-- genuinely reads (`public.commissions`) and (b) walking one ephemeral table
-- through grant/revoke and policy add/drop live, so a reader can trust that a
-- red here is a real regression, not a query that can never observe an allow.
--
-- Doors — the ONLY access path for each table (full per-table rationale:
-- docs/backend-state.md § "Zero-policy tables -- door-only by design"; verified
-- against pg_proc/prosecdef + has_function_privilege, never against migration text):
--   case_print_revisions                    -> app.bump_case_print_revision (write,
--                                               DEFINER, no authenticated EXECUTE --
--                                               internal only) / app.print_source_revision,
--                                               app.print_source_head (read, same posture)
--   meeting_closed_session_items (+readers) -> public.add_reserved_item (write) /
--                                               public.get_reserved_session_items (read) /
--                                               public.dispose_meeting_minutes (disposal;
--                                               items only, not readers)
--   patient_identifiers                     -> public.set_participant_patient (write,
--                                               coordinator-gated) / public.get_case_patient,
--                                               public.get_case_patients,
--                                               public.get_participant_patient (read)
--   patient_participants                    -> read only as a JOIN through the same doors
--                                               (no standalone reader); app.can_read_case_patient
--                                               (read predicate) + app.guard_case_patient_required
--                                               (trigger)
--   referral_patient                        -> public.save_referral_patient (write) /
--                                               public.get_referral_patient (read)
--   verification_lookups                    -> public.lookup_printed_document — the ONLY
--                                               consumer, and `authenticated` has NO EXECUTE
--                                               on it at all (service_role only, measured)
--
-- pgTAP runs inside a rolled-back transaction; §D's ephemeral `_zpt_control` table is
-- created and dropped within it (never touches seed data; nothing is cleaned up
-- positionally).

begin;
select plan(71);

-- ============================================================================
-- SS A - RLS layer: relrowsecurity = true AND zero pg_policies rows, all 7 tables.
-- Structural / catalog-only. This is the layer a lone "no policy => safe" reading
-- would stop at; §B proves it is not doing the work alone here.
-- ============================================================================

select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'case_print_revisions'),
  'A1: case_print_revisions has RLS ENABLED');
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'case_print_revisions'),
  0, 'A2: case_print_revisions carries ZERO policies');

select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'meeting_closed_session_items'),
  'A3: meeting_closed_session_items has RLS ENABLED');
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'meeting_closed_session_items'),
  0, 'A4: meeting_closed_session_items carries ZERO policies');

select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'meeting_closed_session_item_readers'),
  'A5: meeting_closed_session_item_readers has RLS ENABLED');
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'meeting_closed_session_item_readers'),
  0, 'A6: meeting_closed_session_item_readers carries ZERO policies');

select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'patient_identifiers'),
  'A7: patient_identifiers has RLS ENABLED');
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'patient_identifiers'),
  0, 'A8: patient_identifiers carries ZERO policies');

select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'patient_participants'),
  'A9: patient_participants has RLS ENABLED');
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'patient_participants'),
  0, 'A10: patient_participants carries ZERO policies');

select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'referral_patient'),
  'A11: referral_patient has RLS ENABLED');
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'referral_patient'),
  0, 'A12: referral_patient carries ZERO policies');

select ok(
  (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'verification_lookups'),
  'A13: verification_lookups has RLS ENABLED');
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'verification_lookups'),
  0, 'A14: verification_lookups carries ZERO policies');

-- ============================================================================
-- SS B - GRANT layer: has_table_privilege('authenticated', ..., verb) = false,
-- all four DML verbs, all 7 tables. Positive assertion (has_table_privilege),
-- never an inference from an empty-looking relacl (NULL proacl includes PUBLIC;
-- these relacls are NOT null -- see the report -- but the discipline holds
-- regardless of which shape a table happens to have).
-- ============================================================================

select ok(not has_table_privilege('authenticated', 'public.case_print_revisions', 'SELECT'), 'B1: authenticated has NO SELECT on case_print_revisions');
select ok(not has_table_privilege('authenticated', 'public.case_print_revisions', 'INSERT'), 'B2: authenticated has NO INSERT on case_print_revisions');
select ok(not has_table_privilege('authenticated', 'public.case_print_revisions', 'UPDATE'), 'B3: authenticated has NO UPDATE on case_print_revisions');
select ok(not has_table_privilege('authenticated', 'public.case_print_revisions', 'DELETE'), 'B4: authenticated has NO DELETE on case_print_revisions');

select ok(not has_table_privilege('authenticated', 'public.meeting_closed_session_items', 'SELECT'), 'B5: authenticated has NO SELECT on meeting_closed_session_items');
select ok(not has_table_privilege('authenticated', 'public.meeting_closed_session_items', 'INSERT'), 'B6: authenticated has NO INSERT on meeting_closed_session_items');
select ok(not has_table_privilege('authenticated', 'public.meeting_closed_session_items', 'UPDATE'), 'B7: authenticated has NO UPDATE on meeting_closed_session_items');
select ok(not has_table_privilege('authenticated', 'public.meeting_closed_session_items', 'DELETE'), 'B8: authenticated has NO DELETE on meeting_closed_session_items');

select ok(not has_table_privilege('authenticated', 'public.meeting_closed_session_item_readers', 'SELECT'), 'B9: authenticated has NO SELECT on meeting_closed_session_item_readers');
select ok(not has_table_privilege('authenticated', 'public.meeting_closed_session_item_readers', 'INSERT'), 'B10: authenticated has NO INSERT on meeting_closed_session_item_readers');
select ok(not has_table_privilege('authenticated', 'public.meeting_closed_session_item_readers', 'UPDATE'), 'B11: authenticated has NO UPDATE on meeting_closed_session_item_readers');
select ok(not has_table_privilege('authenticated', 'public.meeting_closed_session_item_readers', 'DELETE'), 'B12: authenticated has NO DELETE on meeting_closed_session_item_readers');

select ok(not has_table_privilege('authenticated', 'public.patient_identifiers', 'SELECT'), 'B13: authenticated has NO SELECT on patient_identifiers (PHI)');
select ok(not has_table_privilege('authenticated', 'public.patient_identifiers', 'INSERT'), 'B14: authenticated has NO INSERT on patient_identifiers (PHI)');
select ok(not has_table_privilege('authenticated', 'public.patient_identifiers', 'UPDATE'), 'B15: authenticated has NO UPDATE on patient_identifiers (PHI)');
select ok(not has_table_privilege('authenticated', 'public.patient_identifiers', 'DELETE'), 'B16: authenticated has NO DELETE on patient_identifiers (PHI)');

select ok(not has_table_privilege('authenticated', 'public.patient_participants', 'SELECT'), 'B17: authenticated has NO SELECT on patient_participants (PHI)');
select ok(not has_table_privilege('authenticated', 'public.patient_participants', 'INSERT'), 'B18: authenticated has NO INSERT on patient_participants (PHI)');
select ok(not has_table_privilege('authenticated', 'public.patient_participants', 'UPDATE'), 'B19: authenticated has NO UPDATE on patient_participants (PHI)');
select ok(not has_table_privilege('authenticated', 'public.patient_participants', 'DELETE'), 'B20: authenticated has NO DELETE on patient_participants (PHI)');

select ok(not has_table_privilege('authenticated', 'public.referral_patient', 'SELECT'), 'B21: authenticated has NO SELECT on referral_patient (PHI)');
select ok(not has_table_privilege('authenticated', 'public.referral_patient', 'INSERT'), 'B22: authenticated has NO INSERT on referral_patient (PHI)');
select ok(not has_table_privilege('authenticated', 'public.referral_patient', 'UPDATE'), 'B23: authenticated has NO UPDATE on referral_patient (PHI)');
select ok(not has_table_privilege('authenticated', 'public.referral_patient', 'DELETE'), 'B24: authenticated has NO DELETE on referral_patient (PHI)');

select ok(not has_table_privilege('authenticated', 'public.verification_lookups', 'SELECT'), 'B25: authenticated has NO SELECT on verification_lookups');
select ok(not has_table_privilege('authenticated', 'public.verification_lookups', 'INSERT'), 'B26: authenticated has NO INSERT on verification_lookups');
select ok(not has_table_privilege('authenticated', 'public.verification_lookups', 'UPDATE'), 'B27: authenticated has NO UPDATE on verification_lookups');
select ok(not has_table_privilege('authenticated', 'public.verification_lookups', 'DELETE'), 'B28: authenticated has NO DELETE on verification_lookups');

-- ============================================================================
-- SS C - RUNTIME proof: a live query AS `authenticated` raises 42501 (permission
-- denied) for every verb attempted. This is exercising the GRANT layer (§B) at
-- runtime -- table privilege is checked before RLS ever runs, so on these seven
-- tables RLS's own 0-policy default-deny is never the thing actually observed
-- here; it is the redundant backstop §A pins statically. Full 4-verb coverage
-- for the three Class-1 PHI tables (highest-value per the task); one
-- representative verb (SELECT) for the remaining four, since the ACL layer
-- already fully covers all four verbs for them in §B.
--
-- INSERT probes use `DEFAULT VALUES` (no column names needed -- parses against
-- any table shape; permission is checked before any NOT NULL/constraint check
-- runs, so this never risks masking a 42501 behind a different SQLSTATE).
-- DELETE probes use a bare `DELETE FROM` (no WHERE, no columns needed).
-- UPDATE probes reference one real column (`col = col`), the one case that
-- needs a column name to parse.
-- ============================================================================

-- --- patient_identifiers (PHI) ---
set local role authenticated;
select throws_ok($$ select count(*) from public.patient_identifiers $$, '42501', null,
  'C1: SELECT on patient_identifiers raises 42501 as authenticated');
select throws_ok($$ insert into public.patient_identifiers default values $$, '42501', null,
  'C2: INSERT into patient_identifiers raises 42501 as authenticated');
select throws_ok($$ update public.patient_identifiers set updated_at = updated_at $$, '42501', null,
  'C3: UPDATE on patient_identifiers raises 42501 as authenticated');
select throws_ok($$ delete from public.patient_identifiers $$, '42501', null,
  'C4: DELETE on patient_identifiers raises 42501 as authenticated');
reset role;

-- --- patient_participants (PHI) ---
set local role authenticated;
select throws_ok($$ select count(*) from public.patient_participants $$, '42501', null,
  'C5: SELECT on patient_participants raises 42501 as authenticated');
select throws_ok($$ insert into public.patient_participants default values $$, '42501', null,
  'C6: INSERT into patient_participants raises 42501 as authenticated');
select throws_ok($$ update public.patient_participants set created_at = created_at $$, '42501', null,
  'C7: UPDATE on patient_participants raises 42501 as authenticated');
select throws_ok($$ delete from public.patient_participants $$, '42501', null,
  'C8: DELETE on patient_participants raises 42501 as authenticated');
reset role;

-- --- referral_patient (PHI) ---
set local role authenticated;
select throws_ok($$ select count(*) from public.referral_patient $$, '42501', null,
  'C9: SELECT on referral_patient raises 42501 as authenticated');
select throws_ok($$ insert into public.referral_patient default values $$, '42501', null,
  'C10: INSERT into referral_patient raises 42501 as authenticated');
select throws_ok($$ update public.referral_patient set updated_at = updated_at $$, '42501', null,
  'C11: UPDATE on referral_patient raises 42501 as authenticated');
select throws_ok($$ delete from public.referral_patient $$, '42501', null,
  'C12: DELETE on referral_patient raises 42501 as authenticated');
reset role;

-- --- the remaining four: one representative verb each (SELECT) ---
set local role authenticated;
select throws_ok($$ select count(*) from public.case_print_revisions $$, '42501', null,
  'C13: SELECT on case_print_revisions raises 42501 as authenticated');
select throws_ok($$ select count(*) from public.meeting_closed_session_items $$, '42501', null,
  'C14: SELECT on meeting_closed_session_items raises 42501 as authenticated');
select throws_ok($$ select count(*) from public.meeting_closed_session_item_readers $$, '42501', null,
  'C15: SELECT on meeting_closed_session_item_readers raises 42501 as authenticated');
select throws_ok($$ select count(*) from public.verification_lookups $$, '42501', null,
  'C16: SELECT on verification_lookups raises 42501 as authenticated');
reset role;

-- ============================================================================
-- SS D - VACUITY / POSITIVE CONTROL. Every assertion above is an absence
-- (no policy, no grant, an error). An absence-only suite passes just as
-- happily when its own detector is broken. Prove each detector shape can
-- ALSO report an allow, using (a) a real table `authenticated` genuinely
-- reads, and (b) one ephemeral table walked through both states live.
-- ============================================================================

-- (a) `public.commissions` is a genuine, granted, RLS+policy table --
-- authenticated really can read it. Same has_table_privilege call as §B,
-- opposite table, opposite (true) result.
select ok(has_table_privilege('authenticated', 'public.commissions', 'SELECT'),
  'D1: CONTROL -- authenticated genuinely HAS SELECT on public.commissions (has_table_privilege can report true)');

-- Same throws_ok/lives_ok machinery as §C: on a genuinely granted table, the
-- identical SELECT shape does NOT raise 42501.
set local role authenticated;
select lives_ok($$ select count(*) from public.commissions $$,
  'D2: CONTROL -- SELECT on public.commissions as authenticated does NOT raise (same probe shape as SS C, opposite outcome)');
reset role;

-- (b) one ephemeral table, walked through both states for BOTH detectors.
create table public._zpt_control (id uuid primary key default gen_random_uuid(), note text);

select ok(not (select relrowsecurity from pg_class where oid = 'public._zpt_control'::regclass),
  'D3: CONTROL -- a freshly created table has RLS DISABLED by default (relrowsecurity detector at false)');
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = '_zpt_control'),
  0, 'D4: CONTROL -- the fresh table starts with zero policies (same shape as SS A)');
select ok(not has_table_privilege('authenticated', 'public._zpt_control', 'SELECT'),
  'D5: CONTROL -- the fresh table starts with NO authenticated grant (same shape as SS B)');

grant select on public._zpt_control to authenticated;
select ok(has_table_privilege('authenticated', 'public._zpt_control', 'SELECT'),
  'D6: CONTROL -- granting SELECT flips the SAME has_table_privilege call to true (detector is falsifiable)');
revoke select on public._zpt_control from authenticated;
select ok(not has_table_privilege('authenticated', 'public._zpt_control', 'SELECT'),
  'D7: CONTROL -- revoking it returns the detector to false (both directions move)');

alter table public._zpt_control enable row level security;
select ok((select relrowsecurity from pg_class where oid = 'public._zpt_control'::regclass),
  'D8: CONTROL -- enabling RLS flips relrowsecurity to true (structural detector is falsifiable)');

create policy _zpt_control_select on public._zpt_control for select to authenticated using (true);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = '_zpt_control'),
  1, 'D9: CONTROL -- adding a policy flips the SAME pg_policies count to 1 (SS A''s detector is falsifiable)');
drop policy _zpt_control_select on public._zpt_control;
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = '_zpt_control'),
  0, 'D10: CONTROL -- dropping it returns the count to 0 (both directions move)');

drop table public._zpt_control;


-- ── §5 NO POLICY IN `public` IS `TO public` (AE1 close condition #6 / AE0 F-AE0-4) ──
-- Migration: 20261003005200_normalize_to_public_policies.sql, which normalized 11 policies
-- over 6 tables. ⚠ The unit is the PROPERTY ("roles contains public"), not the feature:
-- F-AE0-4 scoped itself to `process_template_*` and so could not see the eleventh, a DELETE
-- policy on the Rule 12 PHI table `case_referral`. Asserting the property is what makes the
-- next one visible too.

select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and 'public' = any(roles)),
  0,
  '5.1: no policy in schema public is TO public — the role bound is DECLARED by every '
  'policy, not left to the grant layer to supply');

-- 5.2 VACUITY CONTROL. §5.1 is a count-is-zero assertion, and a zero can mean "clean" or
-- "the query cannot see anything". Build a policy that SHOULD trip it and confirm it does.
create table public._topub_control (id int);
alter table public._topub_control enable row level security;
create policy _topub_control_p on public._topub_control for select to public using (true);

select ok(
  exists (select 1 from pg_policies
           where schemaname = 'public' and 'public' = any(roles)
             and tablename = '_topub_control'),
  '5.2 [VACUITY CONTROL]: a deliberately TO public policy IS matched by 5.1''s exact '
  'predicate — so 5.1''s zero is an observation about the catalog, not a query that '
  'cannot match. Asserts the probe is FOUND rather than that the total equals a number, '
  'so the control does not silently depend on 5.1''s own baseline being zero');

drop table public._topub_control;

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public'
      and tablename in ('process_template_custom_fields','process_template_narratives',
                        'process_template_outcomes','process_template_phases',
                        'process_template_versions','case_referral')
      and roles <> '{authenticated}'),
  0,
  '5.3: all 11 normalized policies on the 6 affected tables are exactly {authenticated} — '
  'not merely "no longer public", which a TO anon policy would also satisfy');

select * from finish();
rollback;
