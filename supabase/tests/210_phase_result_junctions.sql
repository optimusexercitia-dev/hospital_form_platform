-- pgTAP — F-cleanup · D3: phase-result junctions (20260719000000_phase_result_junctions.sql).
--
-- Keystone: deleting a phase_results row is VISIBLE to the DB (FK CASCADE) — no
-- dangling UUID remains in any allowed/offered junction, at BOTH template and case
-- grain, including a ruleset-ONLY result ref (the exact hole D3 closes). Plus: the
-- allowed junction read-back preserves author order; the offered shadow = allowed ∪
-- ruleset ∪ default; update_template_phase rewires the junction (replace/keep/clear);
-- reorder_template_phase (blocks untouched) still validates.
--
-- The compute/override/offered-set PARITY is locked by 160_phase_results.sql, which
-- exercises the same (now junction-backed) RPCs end-to-end.
--
-- Also (F-cleanup Minor / HC067): the dropped *_result_emits allowed-arm CHECK is
-- re-enforced in the RPCs — a NON-emitting phase carries NO allowed results at both
-- template (add/update_template_phase reject) and case (create_case_from_template
-- snapshot gate) grain.
--
-- Assertion count: 25

begin;
select plan(25);

-- Feature flags (mirror 160).
update app.feature_flags set enabled = true
  where key in ('case_phase_results', 'cases_multi_phase', 'cases_extras', 'audit_trail');
update app.feature_flags set enabled = false where key = 'case_access';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'form_u')::uuid as form_u
  from ctx;
grant select on k to authenticated;

-- Result vocabulary in comm_x.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table vocab on commit drop as
  select
    (public.create_phase_result((select comm_x from k), 'Conforme',     'green', false)).id as conforme_id,
    (public.create_phase_result((select comm_x from k), 'Não-conforme', 'red',   true)).id  as nao_id;
grant select on vocab to authenticated;
reset role;

-- Template T1: phase1 MANUAL allowed=[nao, conforme] (order matters, no ruleset);
--              phase2 AUTOMATIC allowed=[conforme] + ruleset default=nao (a
--              ruleset-ONLY ref not present in allowed).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Proc D3', null)).id as tid, null::uuid as vid;
-- ADR 0096: resolve the v1 draft in a SEPARATE statement. The helper is
-- STABLE, so inside the CREATE ... AS above it would see the pre-statement
-- snapshot and return NULL.
update tpl set vid = app.draft_version_of_template(tid);
grant select on tpl to authenticated;

select public.add_template_phase(
  (select vid from tpl), (select form_u from k), 'Fase 1',
  null, null, '{}'::integer[],
  null,             -- no ruleset (MANUAL)
  true,             -- emits
  jsonb_build_array((select nao_id from vocab)::text, (select conforme_id from vocab)::text)
);
select public.add_template_phase(
  (select vid from tpl), (select form_u from k), 'Fase 2',
  null, null, '{}'::integer[],
  jsonb_build_object(
    'rules', jsonb_build_array(
      jsonb_build_object('when', jsonb_build_object('question_key','u_q1','op','equals','value','sim'),
                         'result_id', (select conforme_id from vocab)::text)),
    'default_result_id', (select nao_id from vocab)::text),   -- ruleset-only ref
  true,
  jsonb_build_array((select conforme_id from vocab)::text)     -- allowed = [conforme] only
);
reset role;

create temp table p1 on commit drop as
  select id from public.process_template_phases where template_id = (select tid from tpl) and position = 1;
create temp table p2 on commit drop as
  select id from public.process_template_phases where template_id = (select tid from tpl) and position = 2;
grant select on p1 to authenticated;
grant select on p2 to authenticated;

-- 1) template allowed junction (phase1) has 2 rows
select is(
  (select count(*)::int from public.process_template_phase_allowed_results
   where template_phase_id = (select id from p1)),
  2, 'add_template_phase: allowed subset → 2 junction rows (was allowed_result_ids jsonb)');

-- 2) allowed junction preserves author order (first-by-position = nao)
select is(
  (select result_id from public.process_template_phase_allowed_results
   where template_phase_id = (select id from p1) order by position limit 1),
  (select nao_id from vocab),
  'allowed junction: first-by-position = nao_conforme (author order preserved for read-back)');

-- 3) offered shadow (phase1, no ruleset) = allowed = 2
select is(
  (select count(*)::int from public.process_template_phase_offered_results
   where template_phase_id = (select id from p1)),
  2, 'offered shadow (phase1): = allowed subset when no ruleset');

-- 4) allowed junction (phase2) = 1 (conforme only)
select is(
  (select count(*)::int from public.process_template_phase_allowed_results
   where template_phase_id = (select id from p2)),
  1, 'allowed junction (phase2) = [conforme]');

-- 5) offered shadow (phase2) = 2 (conforme ∪ ruleset-only default nao) — the
--    ruleset-only ref is now FK-covered (the hole D3 closes)
select is(
  (select count(*)::int from public.process_template_phase_offered_results
   where template_phase_id = (select id from p2)),
  2, 'offered shadow (phase2): allowed ∪ ruleset default → includes the ruleset-only ref');

-- Publish T1, then create case C1 (snapshot).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.publish_process_template((select tid from tpl));
create temp table c1 on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso D3')).id as cid;
grant select on c1 to authenticated;
reset role;

create temp table cp1 on commit drop as
  select id from public.case_phases where case_id = (select cid from c1) and position = 1;
create temp table cp2 on commit drop as
  select id from public.case_phases where case_id = (select cid from c1) and position = 2;
grant select on cp1 to authenticated;
grant select on cp2 to authenticated;

-- 6) case allowed junction (phase1) snapshotted = 2
select is(
  (select count(*)::int from public.case_phase_allowed_results
   where case_phase_id = (select id from cp1)),
  2, 'create_case_from_template: case allowed junction (phase1) snapshotted from template = 2');

-- 7) case allowed junction preserves order (first = nao)
select is(
  (select result_id from public.case_phase_allowed_results
   where case_phase_id = (select id from cp1) order by position limit 1),
  (select nao_id from vocab),
  'case allowed junction: author order preserved through the snapshot');

-- 8) case_phase_offered_results (case) = 2 distinct (conforme, nao)
select is(
  (select count(*)::int from public.case_phase_offered_results where case_id = (select cid from c1)),
  2, 'create_case_from_template: offered result set frozen = 2 (allowed ∪ ruleset ∪ default, dedup)');

-- 9) case allowed junction (phase2) = 1
select is(
  (select count(*)::int from public.case_phase_allowed_results
   where case_phase_id = (select id from cp2)),
  1, 'case allowed junction (phase2) = [conforme]');

-- ===========================================================================
-- KEYSTONE: delete a phase_results row → FK CASCADE removes every junction ref
-- (template + case grain, incl. the ruleset-only ref). No dangling UUID.
-- ===========================================================================
delete from public.phase_results where id = (select nao_id from vocab);

-- 10) template phase1 allowed junction cascaded 2 → 1
select is(
  (select count(*)::int from public.process_template_phase_allowed_results
   where template_phase_id = (select id from p1)),
  1, 'keystone (template): deleting a phase_results row cascades the allowed junction (2 → 1)');

-- 11) template phase1 offered shadow cascaded 2 → 1
select is(
  (select count(*)::int from public.process_template_phase_offered_results
   where template_phase_id = (select id from p1)),
  1, 'keystone (template): the offered shadow cascaded (2 → 1)');

-- 12) template phase2 offered shadow cascaded 2 → 1 (the RULESET-ONLY ref is gone —
--     the dangling-UUID hole is closed)
select is(
  (select count(*)::int from public.process_template_phase_offered_results
   where template_phase_id = (select id from p2)),
  1, 'keystone: a ruleset-ONLY result ref cascades from the offered shadow — no dangling UUID');

-- 13) case phase1 allowed junction cascaded 2 → 1
select is(
  (select count(*)::int from public.case_phase_allowed_results
   where case_phase_id = (select id from cp1)),
  1, 'keystone (case): the case allowed junction cascaded (2 → 1)');

-- 14) case_phase_offered_results cascaded 2 → 1
select is(
  (select count(*)::int from public.case_phase_offered_results where case_id = (select cid from c1)),
  1, 'keystone (case): case_phase_offered_results cascaded (2 → 1)');

-- 15) NO DANGLING: zero references to the deleted result across ALL four tables
select is(
  ( (select count(*) from public.process_template_phase_allowed_results where result_id = (select nao_id from vocab))
  + (select count(*) from public.process_template_phase_offered_results where result_id = (select nao_id from vocab))
  + (select count(*) from public.case_phase_allowed_results         where result_id = (select nao_id from vocab))
  + (select count(*) from public.case_phase_offered_results         where result_id = (select nao_id from vocab)) )::int,
  0, 'keystone: ZERO dangling references to the deleted result across all 4 junction tables');

-- ===========================================================================
-- update_template_phase rewires the allowed junction (replace / keep / clear) on a
-- separate DRAFT template T2; reorder_template_phase (blocks untouched) validates.
-- (conforme survives the keystone delete; nao does not.)
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl2 on commit drop as
  select (public.create_process_template((select comm_x from k), 'Proc D3 draft', null)).id as tid, null::uuid as vid;
-- ADR 0096: resolve the v1 draft in a SEPARATE statement. The helper is
-- STABLE, so inside the CREATE ... AS above it would see the pre-statement
-- snapshot and return NULL.
update tpl2 set vid = app.draft_version_of_template(tid);
grant select on tpl2 to authenticated;
select public.add_template_phase((select vid from tpl2), (select form_u from k), 'F1',
  null, null, '{}'::integer[], null, true,
  jsonb_build_array((select conforme_id from vocab)::text));
select public.add_template_phase((select vid from tpl2), (select form_u from k), 'F2');
reset role;

create temp table q1 on commit drop as
  select id from public.process_template_phases where template_id = (select tid from tpl2) and position = 1;
create temp table q2 on commit drop as
  select id from public.process_template_phases where template_id = (select tid from tpl2) and position = 2;
grant select on q1 to authenticated;
grant select on q2 to authenticated;

-- replace q1 allowed → [conforme]
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.update_template_phase(
  (select id from q1), null, null, null, false, null, false, null, false,
  null, false, null,
  jsonb_build_array((select conforme_id from vocab)::text), false);
reset role;

-- 16) replace: allowed junction now = [conforme] (1 row)
select is(
  (select count(*)::int from public.process_template_phase_allowed_results
   where template_phase_id = (select id from q1)),
  1, 'update_template_phase (replace): allowed junction rewired to [conforme]');

-- keep (title-only update; p_allowed null, no clear) → junction unchanged
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.update_template_phase(
  (select id from q1), null, 'F1 renomeada', null, false, null, false, null, false,
  null, false, null, null, false);
reset role;

-- 17) keep: allowed junction still = 1 (reconstructed-from-junction keep path)
select is(
  (select count(*)::int from public.process_template_phase_allowed_results
   where template_phase_id = (select id from q1)),
  1, 'update_template_phase (keep): allowed junction preserved on a title-only update');

-- reorder still validates (blocks path untouched by D3): move q2 up
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.reorder_template_phase(%L, 'up') $$, (select id from q2)),
  'reorder_template_phase still validates after D3 (blocks kept as integer[])');

-- clear allowed → junction empty
select public.update_template_phase(
  (select id from q1), null, null, null, false, null, false, null, false,
  null, false, null, null, true);   -- p_clear_allowed_result_ids = true
reset role;

-- 18) clear: allowed junction emptied
select is(
  (select count(*)::int from public.process_template_phase_allowed_results
   where template_phase_id = (select id from q1)),
  0, 'update_template_phase (clear): allowed junction emptied');

-- ===========================================================================
-- HC067 — re-enforced *_result_emits invariant: a NON-emitting phase must carry
-- NO allowed results (the arm dropped from the table CHECK, now in the RPCs).
-- conforme survives the keystone delete; nao does not — use conforme for allowed.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl3 on commit drop as
  select (public.create_process_template((select comm_x from k), 'Proc HC067', null)).id as tid, null::uuid as vid;
-- ADR 0096: resolve the v1 draft in a SEPARATE statement. The helper is
-- STABLE, so inside the CREATE ... AS above it would see the pre-statement
-- snapshot and return NULL.
update tpl3 set vid = app.draft_version_of_template(tid);
grant select on tpl3 to authenticated;

-- 19) NEG add: non-emitting (emits=false) + non-empty allowed → HC067 (rejected)
select throws_ok(
  format(
    $$ select public.add_template_phase(%L, %L, 'NE', null, null, '{}'::integer[], null, false, jsonb_build_array(%L::text)) $$,
    (select tid from tpl3), (select form_u from k), (select conforme_id from vocab)),
  'HC067', null,
  'add_template_phase: non-emitting phase + non-empty allowed is REJECTED (HC067)');

-- 20) POS add: emitting (emits=true) + allowed → succeeds (does not throw)
select lives_ok(
  format(
    $$ select public.add_template_phase(%L, %L, 'EM', null, null, '{}'::integer[], null, true, jsonb_build_array(%L::text)) $$,
    (select tid from tpl3), (select form_u from k), (select conforme_id from vocab)),
  'add_template_phase: emitting phase + allowed still succeeds (POS)');

-- 21) POS readback: the emitting phase's allowed junction = [conforme] (1 row)
select is(
  (select count(*)::int from public.process_template_phase_allowed_results
   where template_phase_id = (select id from public.process_template_phases
                              where template_id = (select tid from tpl3) and position = 1)),
  1, 'emitting phase allowed subset reads back = 1 after the HC067 guard (POS)');

-- 22) NEG update (transition): flip the emitting phase to non-emitting WITHOUT
--     clearing allowed → HC067 (the keep-path reconstruct would retain the rows)
select throws_ok(
  format(
    $$ select public.update_template_phase(%L, null, null, null, false, null, false, null, false, null, false, false, null, false) $$,
    (select id from public.process_template_phases
     where template_id = (select tid from tpl3) and position = 1)),
  'HC067', null,
  'update_template_phase: emitting→non-emitting while retaining allowed is REJECTED (HC067)');

-- Add a valid non-emitting phase (no allowed) so T3 can publish + be cased.
select public.add_template_phase((select vid from tpl3), (select form_u from k), 'NE-ok');

-- Publish T3 + create case C3 (snapshot). Phase1 emitting+allowed; phase2 non-emitting.
select public.publish_process_template((select tid from tpl3));
create temp table c3 on commit drop as
  select (public.create_case_from_template((select tid from tpl3), 'Caso HC067')).id as cid;
grant select on c3 to authenticated;
reset role;

-- 23) case-side: the NON-emitting case phase carries NO allowed rows after snapshot
--     (create_case_from_template gates the snapshot on emits_result — mirrors the
--     old case_phases *_result_emits allowed arm).
select is(
  (select count(*)::int
   from public.case_phase_allowed_results cpar
   join public.case_phases cp on cp.id = cpar.case_phase_id
   where cp.case_id = (select cid from c3) and cp.emits_result = false),
  0, 'create_case_from_template: a non-emitting case phase snapshots ZERO allowed rows');

-- 24) case-side sanity: the EMITTING case phase DID snapshot its allowed row (1)
select is(
  (select count(*)::int
   from public.case_phase_allowed_results cpar
   join public.case_phases cp on cp.id = cpar.case_phase_id
   where cp.case_id = (select cid from c3) and cp.emits_result = true),
  1, 'create_case_from_template: the emitting case phase still snapshots its allowed row');

select * from finish();
rollback;
