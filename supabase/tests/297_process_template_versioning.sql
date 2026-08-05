-- TV — process-template VERSIONING keystones (ADR 0096; migrations 20260907000100..001100).
--
-- EVERY assertion here is MUTATION-PROVEN: the comment above each section names the
-- exact change that turns it red, and where a section forks, a probe per ARM
-- (ADR 0079 Amendment 2 — one mutation certifies at most one arm and reports green
-- for the other).
--
-- ⚠ THE CONTROL-PAIR RULE (inherited from 296). A deny assertion passes on a broken
-- fixture: if the write would have failed anyway — missing column, wrong commission,
-- absent parent — `throws_ok` is satisfied for the wrong reason and proves nothing.
-- So deny arms here assert the SPECIFIC SQLSTATE, never merely that something raised,
-- and every mutation deny is paired with an assertion that the ROW SURVIVED.
--
-- MUTATION LEDGER — every assertion below was observed RED under at least one
-- probe, run against the live stack, not argued for in a comment:
--
--   m1  discard: drop `get diagnostics`/42501                -> FI1a
--   m2  discard: BARE row-count (drop the not-found guard)   -> FI1c, FI1d
--   m3  discard: disambiguate via the DEFINER helper         -> FI1d
--   m4  archive: drop `get diagnostics`/42501                -> FI2a
--   m5  archive: BARE row-count (drop the HC023 guard)       -> FI2d
--   m6  archive: update matches nothing for EVERYONE         -> FI2c-control, FI2d
--   p1  RLS write policy widened to `is_member_of`           -> FI1a, FI1b, FI2a,
--                                                               FI2b, FI2c-control
--
-- ⚠ A REJECTED PROBE, recorded because it nearly passed as a result. `p2` set the
-- write policy to `using(false)` to prove FI2c-control. It reported "nothing red",
-- which reads as a vacuous keystone — but the deny-all policy stops the FIXTURE
-- from inserting v1 at all, so the suite aborted and ZERO tests ran. A harness
-- counting only `not ok` lines cannot tell 0-failed from 0-run; that is the repo's
-- "a gate summary can hide unrun tests" lesson reproduced inside the vacuity
-- harness itself. m6 replaces it with a probe narrow enough to leave the fixture
-- intact. When a probe reports green, check the DENOMINATOR before believing it.
--
-- Assertion count: 8

begin;
select plan(8);

update app.feature_flags set enabled = true
  where key in ('cases_multi_phase', 'cases_extras', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'form_u')::uuid as form_u
  from ctx;
grant select on k to authenticated;

-- A published v1 + an open v2 draft in comm_x.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'TV Proc', null)).id as tid,
         null::uuid as v1, null::uuid as v2;
-- ADR 0096: `app.draft_version_of_template` is STABLE, so resolving it inside the
-- CREATE ... AS above would read the pre-statement snapshot and return NULL.
update tpl set v1 = app.draft_version_of_template(tid);
grant select on tpl to authenticated;
select public.add_template_phase((select v1 from tpl), (select form_u from k), 'Fase 1');
select public.publish_template_version((select v1 from tpl));
update tpl set v2 = public.clone_template_version((select v1 from tpl));
reset role;

-- ===========================================================================
-- FI — FEEDBACK INTEGRITY: a door must not report success for a mutation that
-- RLS silently ate (migration 20260907001100).
--
-- Measured before the fix: `discard_template_draft` returned 204 and
-- `archive_process_template` returned 200 for a plain `staff`, having changed
-- NOTHING. RLS held in both cases — this is not a privilege leak — but the
-- caller could not distinguish "done" from "denied", and Architecture Rule 1
-- makes the DB the boundary, so the TypeScript `authorizeCommission` pre-check
-- in `src/lib/process-templates/actions.ts` does not count as the answer.
--
-- ⚠ THE FORK, and why there are three arms and not one. Zero rows changed has
-- THREE causes that must not collapse onto one SQLSTATE:
--   (a) the row is visible to the caller but the WRITE policy denied them  -> 42501
--   (b) the row is genuinely absent / already in the target state          -> P0002 / HC023
--   (c) the row exists but is INVISIBLE to the caller (another tenant)     -> P0002
-- Arm (c) is the reason the fix resolves existence through the RLS-FILTERED read
-- that already runs FIRST, and NOT through `app.commission_of_template_version`.
-- That helper is SECURITY DEFINER; measured on this stack, it returns non-null for
-- a version the caller cannot select, so using it to disambiguate would turn every
-- cross-tenant probe into an existence oracle — trading this bug for a worse one.
-- Ordering is what separates (a) from (c): control only reaches the row-count check
-- when the caller has already demonstrated it can SEE the row, and telling a reader
-- "you may not write this" discloses nothing it does not already hold.
-- ===========================================================================

-- MUTATION (arm a): drop the `get diagnostics` / 42501 raise from
-- `discard_template_draft` -> t1 goes green-with-204 and reds here.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.discard_template_draft(%L) $$, (select v2 from tpl)),
  '42501',
  null,
  'FI1a: a plain staff discarding a draft is REFUSED with 42501, not a silent 204'
);
reset role;

-- The control half. Without it, t1 passes on a fixture where v2 never existed.
select is(
  (select count(*)::int from public.process_template_versions where id = (select v2 from tpl)),
  1,
  'FI1b: the draft SURVIVED the plain-staff discard attempt'
);

-- MUTATION (arm b): map bare row_count=0 to 42501 -> this reds, because a
-- staff_admin deleting nothing would be told "sem permissão".
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.discard_template_draft('00000000-0000-0000-0000-0000000000fe'::uuid) $$,
  'P0002',
  null,
  'FI1c: discarding an ABSENT version is not-found (P0002), NOT 42501'
);
reset role;

-- MUTATION (arm c): disambiguate via app.commission_of_template_version instead of
-- the RLS-filtered read -> this reds with 42501, exposing the existence oracle.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.discard_template_draft(%L) $$, (select v2 from tpl)),
  'P0002',
  null,
  'FI1d: a FOREIGN commission admin gets not-found (P0002) — no existence oracle'
);
reset role;

-- MUTATION (arm a): drop the `get diagnostics` / 42501 raise from
-- `archive_process_template` -> t5 goes green-with-200 and reds here.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.archive_process_template(%L) $$, (select tid from tpl)),
  '42501',
  null,
  'FI2a: a plain staff archiving a template is REFUSED with 42501, not a silent 200'
);
reset role;

-- The control half: prove the versions are still live, so t5 cannot pass on a
-- template that was already archived.
select is(
  (select count(*)::int from public.process_template_versions
   where template_id = (select tid from tpl) and status <> 'archived'),
  2,
  'FI2b: BOTH versions SURVIVED the plain-staff archive attempt, unarchived'
);

-- MUTATION (arm b): as above — bare row_count=0 -> 42501 reds this, because the
-- template is legitimately already fully archived.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.archive_process_template(%L) $$, (select tid from tpl)),
  'FI2c-control: the OWNING staff_admin CAN archive (the allow arm)'
);
select throws_ok(
  format($$ select public.archive_process_template(%L) $$, (select tid from tpl)),
  'HC023',
  null,
  'FI2d: re-archiving an already-archived template is HC023, NOT 42501'
);
reset role;

select * from finish();
rollback;
