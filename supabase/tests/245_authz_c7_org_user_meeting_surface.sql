-- =============================================================================
-- AUTHZ · Gate 2 · Stage C · C7 — Organization Users lose the meeting +
-- action-item content surface (Amendment 2, A8–A11). Keystones 17/19/20/21,
-- rows-read under set local role (ETH·E1 lesson — never a predicate's return).
--   K17 — org_admin/hospital_admin read 0 from the meeting tables; cannot conclude.
--   K19 — org_admin reads no committee / assignees_only action item.
--   K20 — configuration/staffing SURVIVE (negatives must not over-reach).
--   K21 — staff_admin + ordinary member unchanged (A8 removes only the Org User).
-- =============================================================================
begin;
-- 15 → 25: the Gate-2 fix wave. K17·DOOR (4) + K17·MGMT (2) + K19·DOOR (3) + the
-- aggregate no-over-reach twin (1) — because the 15 above were ALL policy-shaped
-- and this file was GREEN over a live P0. See K17·DOOR for why.
select plan(25);

update app.feature_flags set enabled = true
  where key in ('meetings', 'case_participants');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x, (v->>'st_x')::uuid as st_x, (v->>'st_y')::uuid as st_y,
         (v->>'comm_x')::uuid as comm_x, app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- FIXTURE ---------------------------------------------------------------------
-- st_y MADE an org_admin of org_x (bootstrap ships none).
insert into public.memberships (principal_id, organization_id, role)
values ((select st_y from k), (select org_x from k), 'org_admin');

insert into public.cases (id, commission_id, case_number, created_by, visibility_policy)
values ('00000000-0000-0000-0000-00000000c7c1', (select comm_x from k), 9781, (select sa_x from k), 'commission_default');
insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start)
values ('00000000-0000-0000-0000-00000000c7a0', (select comm_x from k), 9782, 'Reunião C7', now());
insert into public.meeting_agenda_items (id, meeting_id, position, title)
values ('00000000-0000-0000-0000-00000000c7b1', '00000000-0000-0000-0000-00000000c7a0', 1, 'Item');
insert into public.meeting_attendees (id, meeting_id, user_id)
values ('00000000-0000-0000-0000-00000000c7b2', '00000000-0000-0000-0000-00000000c7a0', (select sa_x from k));
insert into public.meeting_cases (meeting_id, case_id)
values ('00000000-0000-0000-0000-00000000c7a0', '00000000-0000-0000-0000-00000000c7c1');

-- committee + assignees_only action items (status is commission-scoped; make one).
insert into public.action_item_statuses (id, commission_id, key, label, category)
values ('00000000-0000-0000-0000-00000000c7e0', (select comm_x from k), 'open', 'Aberto', 'open');
insert into public.action_items (id, commission_id, source_type, title, status_id, visibility_scope)
values ('00000000-0000-0000-0000-00000000c7d1', (select comm_x from k), 'manual', 'Comitê',
        '00000000-0000-0000-0000-00000000c7e0', 'committee');
insert into public.action_items (id, commission_id, source_type, title, status_id, visibility_scope, assigned_to)
values ('00000000-0000-0000-0000-00000000c7d2', (select comm_x from k), 'manual', 'Responsável',
        '00000000-0000-0000-0000-00000000c7e0', 'assignees_only', (select sa_x from k));

-- PRE-FLIGHT ------------------------------------------------------------------
select is(app.is_commission_admin_of_for((select comm_x from k), (select st_y from k)), true,
  'PRE ⭐: st_y is an Organization admin over the commission');
select is(app.is_member_of_for((select comm_x from k), (select st_y from k)), false,
  'PRE ⭐: …and NOT a member — his cells measure the ORG arm C7 removes');

-- K17 — the Organization User reads ZERO of the meeting record + cannot conclude.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.meetings where id='00000000-0000-0000-0000-00000000c7a0'), 0,
  'K17 ⭐ ROWS: the org_admin reads ZERO meetings');
select is((select count(*)::int from public.meeting_agenda_items where meeting_id='00000000-0000-0000-0000-00000000c7a0'), 0,
  'K17 ⭐ ROWS: …ZERO agenda items');
select is((select count(*)::int from public.meeting_attendees where meeting_id='00000000-0000-0000-0000-00000000c7a0'), 0,
  'K17 ⭐ ROWS: …ZERO attendees');
select is((select count(*)::int from public.meeting_cases where meeting_id='00000000-0000-0000-0000-00000000c7a0'), 0,
  'K17 ⭐ ROWS: …ZERO meeting_cases');
select throws_ok(
  $$ insert into public.meeting_agenda_items (meeting_id, position, title)
     values ('00000000-0000-0000-0000-00000000c7a0', 9, 'x') $$,
  '42501', null, 'K17 ⭐: …and CANNOT write the meeting record (the write policies lost the org arm)');

-- =============================================================================
-- K17·DOOR — ⭐⭐ THE DEFINER DOORS, AS THE ORG ADMIN. THIS IS THE POINT.
--
-- Everything above asserts zero on the BASE TABLES — the path the product does
-- NOT use. This file was GREEN over a live P0 for exactly that reason: all three
-- RPCs are `prosecdef = t`, so RLS NEVER RUNS, and they re-added
-- `or app.is_commission_admin_of(v_comm)` underneath the policy fix. The product
-- reads through these doors (`src/lib/queries/meetings.ts`), and they are
-- PostgREST-reachable at /rest/v1/rpc/… — only a Next.js 404 stood in the way,
-- which is Architecture Rule 1 (never rely on UI hiding).
--
-- handoff §7, verbatim: `prosecdef` belongs beside `pg_policies` — a DEFINER's
-- gate REPLACES RLS, so a policy-shaped audit is structurally blind to it.
-- A policy-shaped test over a DEFINER-door surface is not a keystone.
-- ⛔ NEVER assert the org admin's meeting surface on base tables ALONE again.
-- =============================================================================
select is((select count(*)::int from public.get_meeting_agenda_items('00000000-0000-0000-0000-00000000c7a0')), 0,
  'K17·DOOR ⭐⭐ (the live P0): the org_admin reads ZERO through get_meeting_agenda_items — the DEFINER door, not the base table');
select is((select count(*)::int from public.get_meeting_cases('00000000-0000-0000-0000-00000000c7a0')), 0,
  'K17·DOOR ⭐⭐: …ZERO through get_meeting_cases (it returned the case DECISION)');
select is((select count(*)::int from public.get_reserved_session_items('00000000-0000-0000-0000-00000000c7a0')), 0,
  'K17·DOOR ⭐⭐: …ZERO through get_reserved_session_items (it returned a sub-group ethics case''s PROCESS NUMBER + OUTCOME)');
select is((select count(*)::int from public.meeting_closed_sessions where meeting_id='00000000-0000-0000-0000-00000000c7a0'), 0,
  'K17·DOOR ⭐: …ZERO meeting_closed_sessions (its _select policy carried the arm too)');

-- K17·MGMT — A8: "cannot manage meetings" (PO). A10 names the guard on
-- create_meeting / conclude_meeting / reopen_meeting explicitly.
-- ⚠ This file's HEADER claimed "cannot conclude" while NO assertion tested it
-- (§7.2 — text is not truth, in a test header). Found by the Gate-2 class sweep:
-- app.assert_meeting_staff_admin HAD lost the arm, but all three RPCs INLINE
-- their own gate and never reach it. PROVEN before the fix: this org_admin
-- concluded a `scheduled` meeting (→ in_signature) and REOPENED a `signed` one
-- (→ held), un-signing a signed ata.
select throws_ok(
  $$ select public.conclude_meeting('00000000-0000-0000-0000-00000000c7a0') $$,
  '42501', null, 'K17·MGMT ⭐: the org_admin CANNOT conclude a meeting (A8/A10 — was live: it reached in_signature)');
select throws_ok(
  $$ select public.reopen_meeting('00000000-0000-0000-0000-00000000c7a0') $$,
  '42501', null, 'K17·MGMT ⭐: …and CANNOT reopen one (was live: a signed ata went back to held)');
-- K19 — no committee / assignees_only action item.
select is((select count(*)::int from public.action_items where id='00000000-0000-0000-0000-00000000c7d1'), 0,
  'K19 ⭐ ROWS: the org_admin reads ZERO committee-scope action items');
select is((select count(*)::int from public.action_items where id='00000000-0000-0000-0000-00000000c7d2'), 0,
  'K19 ⭐ ROWS: …ZERO assignees_only action items');

-- K19·DOOR — the same class as K17·DOOR, on A11's noun. A11 removed the org arm
-- from `app.can_read_action_item` (committee + assignees_only), but NINE
-- prosecdef DEFINER write doors kept it. PROVEN before the fix: this org_admin,
-- with can_read_action_item = FALSE and ZERO rows under RLS, ran
-- update_committee_action_item and REWROTE THE TITLE. A11's own rationale — an
-- item minuted out of a reserved session must not walk out to an Organization
-- User — holds in the write direction too.
select is(app.can_read_action_item('00000000-0000-0000-0000-00000000c7d1', (select st_y from k)), false,
  'K19·DOOR PRE ⭐: the org_admin CANNOT READ the committee action item (A11) — so he must not write it');
select throws_ok(
  $$ select public.update_committee_action_item('00000000-0000-0000-0000-00000000c7d1', p_title := 'PWNED') $$,
  '42501', null, 'K19·DOOR ⭐⭐: …and CANNOT rewrite it through the DEFINER door (was live: the title became "PWNED BY ORG ADMIN")');
-- HC037 (not 42501) — advance_committee_action_item raises the action-item-specific
-- authority code. Asserted from the live catalog body, not assumed.
select throws_ok(
  $$ select public.advance_committee_action_item('00000000-0000-0000-0000-00000000c7d1',
       '00000000-0000-0000-0000-00000000c7e0') $$,
  'HC037', null, 'K19·DOOR ⭐: …nor advance it');
-- K20 — configuration SURVIVES (negatives must not over-reach).
select is((select count(*)::int from public.commission_meeting_types where commission_id=(select comm_x from k)) > 0, true,
  'K20 ⭐ NO-OVER-REACH: the org_admin STILL reads commission meeting types (configuration)');
select lives_ok(
  $$ insert into public.commission_meeting_types (commission_id, name, position)
     select comm_x, 'Extraordinária C7', 99 from k $$,
  'K20 ⭐ NO-OVER-REACH: …and STILL configures the commission (writes a meeting type)');
-- The Gate-2 class sweep cut 11 DEFINER doors. It must not have cut the aggregate:
-- D4·1 — Organization Users "keep full administrative authority AND PHI-FREE
-- AGGREGATES; they lose case content." Counts are not content. A8 likewise defers
-- the org user's meeting KPI to a purpose-built aggregate door rather than denying
-- the need. Removing this arm would be a REGRESSION, not a fix.
select lives_ok(
  $$ select * from public.case_action_items_kpis((select comm_x from k)) $$,
  'K20 ⭐ NO-OVER-REACH: …and STILL reads the PHI-free action-item AGGREGATE (D4·1 — the sweep cut doors, not aggregates)');
reset role;
select set_config('request.jwt.claims', '', true);

-- K21 — staff_admin + ordinary member are unchanged.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.meetings where id='00000000-0000-0000-0000-00000000c7a0'), 1,
  'K21: the coordinator reads the meeting (unchanged)');
select lives_ok(
  $$ insert into public.meeting_agenda_items (meeting_id, position, title)
     values ('00000000-0000-0000-0000-00000000c7a0', 2, 'Item 2') $$,
  'K21: …and still writes agenda items');
reset role;
select set_config('request.jwt.claims', '', true);

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.meetings where id='00000000-0000-0000-0000-00000000c7a0'), 1,
  'K21: the ordinary member reads the commission_default meeting (unchanged)');
select is((select count(*)::int from public.meeting_cases where meeting_id='00000000-0000-0000-0000-00000000c7a0'), 1,
  'K21: …and its meeting_case');
reset role;
select set_config('request.jwt.claims', '', true);

select * from finish();
rollback;
