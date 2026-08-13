-- ACT P0 follow-up (ADR 0106) — the 31-function catalog-blindness sweep.
--
-- Coordinator's own catalog sweep (any return type, comment-stripped, `memberships`
-- referenced with NO `has_role`/`active_role` anywhere in the body) found 31
-- functions beyond `list_my_nsp_hospitals` and `open_capa_plan`. Every one classified
-- by reading its body (not its name — `docs/plans/act-as-buildnotes.md` carries the
-- full 31-row table): does the raw `memberships` read authorize the CALLER, or does
-- it enumerate/validate OTHER principals?
--
-- Six are CALLER-GATING DEFECTS (this file's keystones): `capa_kpis`,
-- `commission_overview`, `list_org_people`, `open_capa_plan`, `pqs_inbox`,
-- `quality_board_summary`. The other 24 are confirmed THIRD-PARTY (rosters,
-- candidate lists, notification-recipient enumerations, business-rule/quorum reads)
-- or their OWN authorization already routes through an already-hat-gated `has_role`
-- wrapper elsewhere in the same body (`grant_role_impl`, `revoke_role_impl`,
-- `end_affiliation_impl`, etc.) — verified live, not assumed; left untouched.
-- `session_context` stays hat-blind by design (already ruled, ADR 0106 D9).
--
-- No MIXED function was found (a caller gate AND a third-party enumeration coexisting
-- in one body) — each of the 31 turned out to be cleanly one or the other.

begin;
select plan(12);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x, (v->>'comm_x')::uuid as comm_x,
         (v->>'org_b')::uuid as org_b, (v->>'hosp_b')::uuid as hosp_b from ctx;
grant select on k to authenticated;

-- sa_x (bootstrap's staff_admin@comm_x) becomes a FIVE-role principal: the SAME
-- "load one synthetic multi-hat persona, test each hat's own reach in isolation"
-- shape used throughout ACT Stage 3 -- the only fixture able to distinguish
-- "sees X because that specific hat is active" from "sees X regardless of hat".
insert into public.memberships (organization_id, principal_id, role) values
  ((select org_b from k), (select sa_x from k), 'org_admin');
insert into public.memberships (organization_id, hospital_id, principal_id, role) values
  ((select org_b from k), (select hosp_b from k), (select sa_x from k), 'nsp_coordinator'),
  ((select org_b from k), (select hosp_b from k), (select sa_x from k), 'hospital_admin'),
  ((select org_b from k), (select hosp_b from k), (select sa_x from k), 'quality_reviewer');

-- A commission under org_b/hosp_b (bootstrap creates none there) for
-- commission_overview + the pqs_inbox event's reporting_commission_id.
insert into public.commissions (name, slug, organization_id, hospital_id)
values ('Comissão B', 'comissao-b-hat-sweep', (select org_b from k), (select hosp_b from k));
create temp table cb on commit drop as
  select id from public.commissions where slug = 'comissao-b-hat-sweep';
grant select on cb to authenticated;

-- ── 1. public.commission_overview() ─────────────────────────────────────────────
select test_helpers.claims_for((select sa_x from k), false, 'org_admin');
set local role authenticated;
select ok(
  exists (select 1 from public.commission_overview() where commission_id = (select id from cb)),
  'commission_overview() D12: org_admin-hatted sa_x sees comissao-b (matching hat)');
reset role;

select test_helpers.claims_for((select sa_x from k), false, 'nsp_coordinator');
set local role authenticated;
select ok(
  not exists (select 1 from public.commission_overview() where commission_id = (select id from cb)),
  'commission_overview() D12 ⭐ DISTINGUISHING: sa_x wearing nsp_coordinator (a hat he also genuinely holds, NOT org_admin) does NOT see comissao-b');
reset role;

-- ── 2. public.list_org_people(p_org_id) ─────────────────────────────────────────
select test_helpers.claims_for((select sa_x from k), false, 'hospital_admin');
set local role authenticated;
select ok(
  exists (select 1 from public.list_org_people((select org_b from k)) where user_id = (select sa_x from k)),
  'list_org_people() D12: hospital_admin-hatted sa_x reads org_b''s directory (matching hat)');
reset role;

select test_helpers.claims_for((select sa_x from k), false, 'quality_reviewer');
set local role authenticated;
select is(
  (select count(*)::int from public.list_org_people((select org_b from k))),
  0,
  'list_org_people() D12 ⭐ DISTINGUISHING: sa_x wearing quality_reviewer (NOT hospital_admin/org_admin) reads NOTHING from org_b''s directory');
reset role;

-- ── 3. public.quality_board_summary(p_organization_id) ──────────────────────────
select test_helpers.claims_for((select sa_x from k), false, 'quality_reviewer');
set local role authenticated;
select lives_ok(
  $$ select * from public.quality_board_summary((select org_b from k)) $$,
  'quality_board_summary() D12: quality_reviewer-hatted sa_x is admitted (matching hat, 42501 NOT raised)');
reset role;

select test_helpers.claims_for((select sa_x from k), false, 'hospital_admin');
set local role authenticated;
select throws_ok(
  $$ select * from public.quality_board_summary((select org_b from k)) $$,
  '42501', null,
  'quality_board_summary() D12 ⭐ DISTINGUISHING: sa_x wearing hospital_admin (NOT quality_reviewer) is REFUSED, not silently admitted');
reset role;

-- ── 4. public.capa_kpis() (the nsp_coordinator arm of v_any) ────────────────────
update app.feature_flags set enabled = true where key = 'patient_safety';
insert into public.capa_plan (source, hospital_id, opened_by)
values ('manual', (select hosp_b from k), (select sa_x from k));

select test_helpers.claims_for((select sa_x from k), false, 'nsp_coordinator');
set local role authenticated;
select ok(
  (select open_count from public.capa_kpis()) >= 1,
  'capa_kpis() D12: nsp_coordinator-hatted sa_x counts the manual CAPA (matching hat)');
reset role;

select test_helpers.claims_for((select sa_x from k), false, 'org_admin');
set local role authenticated;
select is(
  (select open_count from public.capa_kpis()),
  0,
  'capa_kpis() D12 ⭐ DISTINGUISHING: sa_x wearing org_admin (NOT nsp_coordinator/pqs_member) counts ZERO CAPAs, not the one his un-worn hat operates');
reset role;

-- ── 5. public.pqs_inbox(...) ─────────────────────────────────────────────────────
update app.feature_flags set enabled = true where key = 'notifications';
insert into public.patient_safety_event (title, reporting_commission_id, reported_by)
values ('Evento de teste (hat sweep)', (select id from cb), (select sa_x from k));

select test_helpers.claims_for((select sa_x from k), false, 'nsp_coordinator');
set local role authenticated;
select ok(
  exists (select 1 from public.pqs_inbox() where reporting_commission_id = (select id from cb)),
  'pqs_inbox() D12: nsp_coordinator-hatted sa_x sees the event (matching hat)');
reset role;

select test_helpers.claims_for((select sa_x from k), false, 'org_admin');
set local role authenticated;
select is(
  (select count(*)::int from public.pqs_inbox() where reporting_commission_id = (select id from cb)),
  0,
  'pqs_inbox() D12 ⭐ DISTINGUISHING: sa_x wearing org_admin (NOT nsp_coordinator/pqs_member) sees ZERO events in the patient-safety inbox');
reset role;

-- ── 6. public.open_capa_plan(...) (the hospital auto-inference arm) ─────────────
-- No p_hospital_id and no source (manual + no hospital match) -> the function must
-- auto-infer FROM THE CALLER'S OWN OPERATOR HOSPITALS. Under the matching hat, sa_x
-- operates EXACTLY hosp_b -> unambiguous, no exception. Under a different hat, sa_x
-- operates ZERO hospitals as far as this call can see -> refused, never silently
-- inferring the un-worn hat's hospital.
select test_helpers.claims_for((select sa_x from k), false, 'nsp_coordinator');
set local role authenticated;
select lives_ok(
  $$ select public.open_capa_plan('manual', 'corretiva', null, null) $$,
  'open_capa_plan() D12: nsp_coordinator-hatted sa_x auto-infers hosp_b (matching hat, exactly one operator hospital)');
reset role;

-- NOTE (found while building this keystone, not assumed): the auto-infer block's
-- OWN raw union is immediately re-filtered by `where app.is_pqs_operator_of(h)`
-- (already hat-gated) BEFORE any decision is made on it -- every call shape tried
-- here denies identically whether or not the union arms themselves also carry the
-- hat condition, so no red-then-green keystone is constructible against THIS
-- specific block (a green-on-first-run would be vacuous, per this repo's own
-- standing rule). Fixed anyway, for consistency with the identical
-- pqs_member/nsp_coordinator union pattern in capa_kpis/pqs_inbox and as
-- defense-in-depth against a future refactor that drops the adjacent filter --
-- but this is a NON-REGRESSION check (still denies, no plan leaks to hosp_b under
-- the wrong hat), not a distinguishing one. See the report to the coordinator for
-- the AC-5b reconciliation question this raised.
select test_helpers.claims_for((select sa_x from k), false, 'org_admin');
set local role authenticated;
select throws_ok(
  $$ select public.open_capa_plan('manual', 'corretiva', null, null) $$,
  null, null,
  'open_capa_plan() D12: sa_x wearing org_admin (NOT nsp_coordinator/pqs_member) is refused, in whatever shape -- the raise happens before the insert, so this also proves no plan leaks to hosp_b under the un-worn hat');
reset role;

select * from finish();
rollback;
