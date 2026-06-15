-- Case data-model adjustments: case OUTCOMES (decisions D8–D11, D15) —
-- migration 093003.
--
-- A per-commission outcome vocabulary (case_outcomes); each process selects which
-- it OFFERS (process_template_outcomes, HC030 same-commission guard); each case
-- snapshots the offered set (case_offered_outcomes) and is assigned at most one
-- (cases.outcome_id). Two flags are SIGNALS not gates (D10): requires_action_plan,
-- is_adverse. Vocabulary edits propagate everywhere (D11). Outcomes optional (D15).
--
-- Covers: vocab CRUD + RLS isolation (mirror 112_case_tags); HC030 mismatch guard;
-- the offered snapshot into case_offered_outcomes; set_case_outcome HC029 (not
-- offered) + clear-to-null + HC025 (terminal); the D3 conclude gate HC028 (offered
-- + none chosen) and NO requirement when none offered (D15); D11 propagation (a
-- rename shows on an already-assigned concluded case); D10 non-gating (a
-- requires_action_plan outcome still concludes with no action plan).
-- Both feature flags ON for the txn.

begin;
select plan(18);

update app.feature_flags set enabled = true where key in ('cases_multi_phase', 'cases_extras');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'st_y')::uuid    as st_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'form_u')::uuid  as form_u,
         (v->>'form_y')::uuid  as form_y
  from ctx;
grant select on k to authenticated;

-- =========================================================================
-- 1) CREATE OUTCOME in commission X (one adverse + action-plan, one plain).
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table oc on commit drop as
  select (public.create_case_outcome((select comm_x from k), 'Óbito evitável', 'red', true, true)).id as adverse_id;
grant select on oc to authenticated;
create temp table oc2 on commit drop as
  select (public.create_case_outcome((select comm_x from k), 'Sem intercorrências', 'green', false, false)).id as plain_id;
grant select on oc2 to authenticated;
reset role;

select ok(
  (select adverse_id from oc) is not null and (select plain_id from oc2) is not null,
  'create_case_outcome succeeds for staff_admin (adverse + plain outcomes created)'
);

-- The adverse outcome carries both flags.
select ok(
  (select is_adverse and requires_action_plan from public.case_outcomes
   where id = (select adverse_id from oc)),
  'create_case_outcome persists is_adverse + requires_action_plan flags'
);

-- =========================================================================
-- 2) UNIQUE per commission; same label allowed in a different commission.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case_outcome(%L, 'Óbito evitável', 'amber', false, false) $$,
         (select comm_x from k)),
  '23505',
  null,
  'create_case_outcome rejects a duplicate label in the same commission (23505)'
);
reset role;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table oc_y on commit drop as
  select (public.create_case_outcome((select comm_y from k), 'Óbito evitável', 'red', false, true)).id as oid;
grant select on oc_y to authenticated;
reset role;
select ok(
  (select oid from oc_y) is not null,
  'same outcome label is allowed in a DIFFERENT commission'
);

-- =========================================================================
-- 3) PLAIN STAFF cannot create an outcome (staff_admin-gated).
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_case_outcome(%L, 'Staff outcome', 'blue', false, false) $$,
         (select comm_x from k)),
  '42501',
  null,
  'plain staff cannot create an outcome (RPC is staff_admin-gated)'
);
reset role;

-- =========================================================================
-- 4) RLS: member reads own commission's outcomes; cross-commission member cannot.
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select ok(
  (select count(*)::int from public.case_outcomes
   where commission_id = (select comm_x from k)) >= 2,
  'a staff member can read case_outcomes of their own commission'
);
reset role;

select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_outcomes
   where commission_id = (select comm_x from k)),
  0,
  'RLS: a cross-commission member cannot read another commission''s outcomes'
);
reset role;

-- =========================================================================
-- Build a template in X that OFFERS both X outcomes, publish, create a case.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Proc Desfechos', null)).id as tid;
reset role;
grant select on tpl to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select tid from tpl), (select form_u from k), 'F1');
-- Offer both X outcomes.
select public.set_process_outcomes((select tid from tpl),
  array[(select adverse_id from oc), (select plain_id from oc2)]);
reset role;

-- =========================================================================
-- 5) HC030: set_process_outcomes rejects an outcome from ANOTHER commission.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_process_outcomes(%L, array[%L]::uuid[]) $$,
         (select tid from tpl), (select oid from oc_y)),
  'HC030',
  null,
  'set_process_outcomes rejects an outcome that belongs to a different commission (HC030)'
);
reset role;

-- Publish + create a case (snapshots the offered set).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.publish_process_template((select tid from tpl));
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso Desfecho')).id as cid;
reset role;
grant select on cse to authenticated;

-- =========================================================================
-- 6) SNAPSHOT: the offered set is frozen into case_offered_outcomes (2 rows).
-- =========================================================================
select is(
  (select count(*)::int from public.case_offered_outcomes where case_id = (select cid from cse)),
  2,
  'create_case_from_template snapshots the offered outcomes into case_offered_outcomes'
);

-- =========================================================================
-- 7) CONCLUDE GATE HC028: a case whose process offers outcomes cannot conclude
-- with no outcome chosen. (Settle the single phase first so HC031 is not the
-- blocker.)
-- =========================================================================
create temp table cp on commit drop as
  select id, position from public.case_phases where case_id = (select cid from cse);
grant select on cp to authenticated;

-- Skip the only phase so all phases are settled.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.skip_phase((select id from cp where position = 1));
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.close_case(%L) $$, (select cid from cse)),
  'HC028',
  null,
  'close_case rejects a settled case with offered outcomes but none chosen (HC028)'
);
reset role;

-- =========================================================================
-- 8) HC029: set_case_outcome rejects an outcome NOT in the case's offered set.
-- =========================================================================
-- The Y outcome (oc_y) is not offered by this case. (Use it via a fresh X outcome
-- that is NOT offered, to avoid the cross-commission guard masking HC029.)
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table oc3 on commit drop as
  select (public.create_case_outcome((select comm_x from k), 'Não ofertado', 'amber', false, false)).id as oid;
grant select on oc3 to authenticated;
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_outcome(%L, %L) $$,
         (select cid from cse), (select oid from oc3)),
  'HC029',
  null,
  'set_case_outcome rejects an outcome not in the case''s frozen offered set (HC029)'
);
reset role;

-- =========================================================================
-- 9) SET + CLEAR: choose an offered outcome, then clear it (null).
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.set_case_outcome((select cid from cse), (select adverse_id from oc))).outcome_id,
  (select adverse_id from oc),
  'set_case_outcome assigns an offered outcome (writes cases.outcome_id)'
);
reset role;

-- Clear it (null).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (public.set_case_outcome((select cid from cse), null)).outcome_id,
  null,
  'set_case_outcome(null) clears the case outcome'
);
reset role;

-- =========================================================================
-- 10) CONCLUDE succeeds once an offered outcome is chosen. Then D11 + HC025.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.set_case_outcome((select cid from cse), (select adverse_id from oc));
select is(
  (public.close_case((select cid from cse))).status,
  'concluido',
  'close_case succeeds once all phases are settled AND an offered outcome is chosen'
);
reset role;

-- =========================================================================
-- 11) D11 PROPAGATION: renaming the outcome shows on the already-concluded case.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.update_case_outcome((select adverse_id from oc), 'Óbito evitável (revisado)', 'red', true, true);
reset role;

-- The concluded case's outcome resolves to the NEW label (shared row, no snapshot).
select is(
  (select o.label from public.cases c
     join public.case_outcomes o on o.id = c.outcome_id
   where c.id = (select cid from cse)),
  'Óbito evitável (revisado)',
  'D11: an outcome rename propagates to an already-assigned, concluded case (shared row)'
);

-- =========================================================================
-- 12) HC025: set_case_outcome is rejected on a terminal (concluido) case.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.set_case_outcome(%L, %L) $$,
         (select cid from cse), (select plain_id from oc2)),
  'HC025',
  null,
  'set_case_outcome rejects a terminal case (HC025)'
);
reset role;

-- =========================================================================
-- 13) D15 + D10: a process offering NO outcomes concludes with no outcome, even
-- when... there is nothing to require. (And D10: requires_action_plan never gates
-- — the concluded case above carried an action-plan outcome with NO action items.)
-- =========================================================================
-- Build a template that offers NO outcomes; its case concludes without one.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl0 on commit drop as
  select (public.create_process_template((select comm_x from k), 'Sem desfechos', null)).id as tid;
reset role;
grant select on tpl0 to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select tid from tpl0), (select form_u from k), 'F1');
select public.publish_process_template((select tid from tpl0));
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse0 on commit drop as
  select (public.create_case_from_template((select tid from tpl0), 'Caso sem desfecho')).id as cid;
reset role;
grant select on cse0 to authenticated;

-- Settle its phase + conclude (no outcome required — D15).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.skip_phase((select id from public.case_phases
  where case_id = (select cid from cse0) and position = 1));
select is(
  (public.close_case((select cid from cse0))).status,
  'concluido',
  'D15: a case whose process offers NO outcomes concludes with no outcome (no HC028)'
);
reset role;

-- D10 (non-gating) is demonstrated by test 10: the concluded case (cse) used an
-- outcome with requires_action_plan=true and concluded with ZERO action items —
-- the flag is advisory, never a gate. Assert that explicitly here.
select is(
  (select count(*)::int from public.case_action_items where case_id = (select cid from cse)),
  0,
  'D10: a requires_action_plan outcome concluded with no action items (flag is advisory, not a gate)'
);

select * from finish();
rollback;
