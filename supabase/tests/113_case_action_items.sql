-- Case action items — FOLDED into the shared action_items hub (migration
-- 20260707000000_fold_case_action_items.sql; ADR 0050).
--
-- The parallel `case_action_items` table + its 4 RPCs (create/update/advance/
-- complete_action_item) + app.advance_action_item_core are DROPPED. Case action
-- items are now `source_type = 'case'` rows on `public.action_items`, linked via
-- source_case_id (+ optional source_case_phase_id), hard-forced to
-- visibility_scope = 'case_restricted' by the guard, and driven through the
-- unified committee_* RPCs. This file proves the CASE-source posture end-to-end:
--
--   1. CREATE authority — create_committee_action_item(source_type='case') honors
--      app.can_write_case_content (ADR 0033 D4): staff_admin YES, a write-grantee
--      YES, a plain member / read-grantee 42501. Missing p_case_id → check_violation.
--   2. GUARD — a case row is force-corrected to case_restricted even if the caller
--      asks for 'committee'; the link CHECK rejects a case row missing source_case_id
--      and a manual row carrying source_case_id.
--   3. SCOPE MATRIX (hub + BOTH satellites) — a case_restricted row is INVISIBLE to
--      a plain commission member with no attribution/grant (and so are its
--      action_item_assignments + action_item_status_history rows); VISIBLE to the
--      phase-assignee, a case_access grantee, and staff_admin/org_admin.
--   4. ADVANCE/COMPLETE authority — the assignee OR a content-writer of the case
--      (HC027); a plain member (even a read-grantee) is rejected.
--   5. DELETE — staff_admin/org_admin only (42501 otherwise), all sources.
--   6. KPIs — case_action_items_kpis returns hub-derived open/overdue/completed_ytd
--      from the case-sourced rows; zeroed to a non-staff_admin.
--
-- The action_items flag is the master gate; the case-source arms are additionally
-- gated by cases_extras (Q8). Both ON here. case_access ON (the scope matrix uses
-- can_read_case). The bootstrap builds the case + phase + grants directly as table
-- owner (mirrors 144_case_access): the predicates are read-only and the
-- case_phases/case_access INSERTs are unguarded on INSERT.
--
-- Personas (all commission X unless noted):
--   sa_x   coordinator (staff_admin of X) — content-writer + full read
--   st_x   PHASE assignee of the case's one phase → attribution-derived read
--   st_x2  a plain member of X — NO attribution, NO grant (the boundary persona)
--   gx_r   granted READ  (case_access level 'read')
--   gx_w   granted WRITE (case_access level 'write') — a content-writer
--   sa_y   foreign coordinator (commission Y) — sees nothing

begin;
select plan(36);

-- Master + case-source flags ON; case_access ON for the scope matrix.
update app.feature_flags set enabled = true
  where key in ('action_items', 'cases_extras', 'cases_multi_phase', 'case_access');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'form_u')::uuid as form_u,
         (v->>'ver_u')::uuid  as ver_u
  from ctx;
grant select on k to authenticated;

-- Global status ids (comm_x has no per-commission overrides).
create temp table st on commit drop as
  select (select id from public.action_item_statuses where key='open' and commission_id is null)        as open_id,
         (select id from public.action_item_statuses where key='in_progress' and commission_id is null) as ip_id,
         (select id from public.action_item_statuses where key='done' and commission_id is null)         as done_id;
grant select on st to authenticated;

-- Two extra plain-staff members of X: gx_r/gx_w receive grants.
create temp table p on commit drop as
  select gen_random_uuid() as gx_r, gen_random_uuid() as gx_w;
grant select on p to authenticated;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated',
       u || '@test', now(), now()
from (select gx_r as u from p union all select gx_w from p) s;

update public.profiles set full_name = 'Granted Read X'  where id = (select gx_r from p);
update public.profiles set full_name = 'Granted Write X' where id = (select gx_w from p);

insert into public.commission_members (commission_id, user_id, role)
select (select comm_x from k), u, 'staff'
from (select gx_r as u from p union all select gx_w from p) s;

-- One case in X with ONE phase assigned to st_x (the phase-assignee). Built as
-- table owner; grants gx_r read + gx_w write.
create temp table cs on commit drop as
  select gen_random_uuid() as case_x, gen_random_uuid() as phase_x;
grant select on cs to authenticated;

insert into public.cases (id, commission_id, case_number, label, created_by)
values ((select case_x from cs), (select comm_x from k), 9301, 'Caso Itens', (select sa_x from k));

insert into public.case_phases
  (id, case_id, position, form_id, form_version_id, status, assigned_to, blocks)
values
  ((select phase_x from cs), (select case_x from cs), 1, (select form_u from k),
   (select ver_u from k), 'active', (select st_x from k), '{}');

insert into public.case_access (case_id, user_id, level, granted_by)
values
  ((select case_x from cs), (select gx_r from p), 'read',  (select sa_x from k)),
  ((select case_x from cs), (select gx_w from p), 'write', (select sa_x from k));

-- ===========================================================================
-- (1) CREATE authority — can_write_case_content (ADR 0033 D4)
-- ===========================================================================
-- A missing source case is check_violation (informe o caso de origem).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_committee_action_item(
              %L::uuid, 'case', null, null, null, 'sem caso', null, null, null, null, null, null) $$,
         (select comm_x from k)),
  '23514', null, 'create(case): a missing source case is rejected (check_violation)');

-- The coordinator (content-writer) creates a case item assigned to st_x. Returns
-- a case_restricted row (proven below).
create temp table ai_c on commit drop as
  select (public.create_committee_action_item(
            p_commission  => (select comm_x from k),
            p_source_type => 'case',
            p_case_id     => (select case_x from cs),
            p_title       => 'Item de caso',
            p_description => 'desc',
            p_assigned_to => (select st_x from k),
            p_due_date    => (current_date - 1),          -- overdue
            p_source_case_phase_id => (select phase_x from cs))).id as id;
grant select on ai_c to authenticated;
reset role;

select is(
  (select source_type from public.action_items where id = (select id from ai_c)),
  'case', 'create(case): the item lands source_type=case');
select is(
  (select source_case_id from public.action_items where id = (select id from ai_c)),
  (select case_x from cs), 'create(case): source_case_id is the origin case');
select is(
  (select source_case_phase_id from public.action_items where id = (select id from ai_c)),
  (select phase_x from cs), 'create(case): source_case_phase_id is recorded');

-- A write-GRANTEE (not staff_admin) can also create (ADR 0033 D4 preserved).
select test_helpers.claims_for((select gx_w from p), false);
set local role authenticated;
select lives_ok(
  format($$ select public.create_committee_action_item(
              %L::uuid, 'case', null, null, %L::uuid, 'de grantee', null, null, null, null, null, null) $$,
         (select comm_x from k), (select case_x from cs)),
  'create(case): a write-grantee (content-writer) can create (ADR 0033 D4)');
reset role;

-- A plain member (st_x2 — attributed nowhere, no grant) CANNOT create → 42501.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_committee_action_item(
              %L::uuid, 'case', null, null, %L::uuid, 'de plain', null, null, null, null, null, null) $$,
         (select comm_x from k), (select case_x from cs)),
  '42501', null, 'create(case): a plain member (no content-write) is rejected (42501)');
reset role;

-- A read-GRANTEE (read ≠ write) CANNOT create → 42501.
select test_helpers.claims_for((select gx_r from p), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_committee_action_item(
              %L::uuid, 'case', null, null, %L::uuid, 'de read grantee', null, null, null, null, null, null) $$,
         (select comm_x from k), (select case_x from cs)),
  '42501', null, 'create(case): a READ-grantee cannot create (read ≠ content-write)');
reset role;

-- ===========================================================================
-- (2) GUARD — case rows are hard-forced case_restricted; link CHECKs
-- ===========================================================================
-- The coordinator asks for visibility_scope='committee' on a case row; the guard
-- HARD-FORCES case_restricted regardless.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table ai_force on commit drop as
  select (public.create_committee_action_item(
            p_commission  => (select comm_x from k),
            p_source_type => 'case',
            p_case_id     => (select case_x from cs),
            p_title       => 'força restrição',
            p_visibility_scope => 'committee')).id as id;   -- asked committee…
grant select on ai_force to authenticated;
reset role;
select is(
  (select visibility_scope from public.action_items where id = (select id from ai_force)),
  'case_restricted',
  'guard: a case row asked for ''committee'' is HARD-FORCED to case_restricted');
select is(
  (select visibility_scope from public.action_items where id = (select id from ai_c)),
  'case_restricted', 'guard: every case-sourced row is case_restricted');

-- A case row missing source_case_id is rejected (direct insert as owner). The
-- BEFORE guard trigger fires first: with a NULL source_case_id its case lookup
-- returns nothing → P0002 (caso de origem não encontrado). The link CHECK would
-- also reject it, but the guard intercepts before the constraint is evaluated —
-- either way the row is unrepresentable, which is what we prove here.
select throws_ok(
  format($$ insert into public.action_items (commission_id, source_type, title, status_id, visibility_scope)
            values (%L::uuid, 'case', 'sem source_case', %L::uuid, 'case_restricted') $$,
         (select comm_x from k), (select open_id from st)),
  'P0002', null, 'guard: a case row missing source_case_id is rejected (no source case found)');
-- Link CHECK: a MANUAL row carrying source_case_id is rejected.
select throws_ok(
  format($$ insert into public.action_items (commission_id, source_type, title, status_id, source_case_id)
            values (%L::uuid, 'manual', 'manual com caso', %L::uuid, %L::uuid) $$,
         (select comm_x from k), (select open_id from st), (select case_x from cs)),
  '23514', null, 'guard: a manual row carrying source_case_id is rejected (link CHECK)');

-- ===========================================================================
-- (3) SCOPE MATRIX — hub + BOTH satellites follow can_read_case
-- ===========================================================================
-- Seed a status_history row + confirm the owner assignment exists on ai_c so the
-- satellites have rows to (in)visibly leak. Advance open→in_progress as the
-- assignee to write a history row.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.advance_committee_action_item((select id from ai_c), (select ip_id from st), 'iniciando');
reset role;

-- st_x2 (plain member, no attribution/grant) sees ZERO — the hub row is dark.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.action_items where id = (select id from ai_c)),
  0, 'scope: a plain member CANNOT see the case_restricted hub row');
select is(
  (select count(*)::int from public.action_item_assignments where action_item_id = (select id from ai_c)),
  0, 'scope: a plain member CANNOT see the row''s action_item_assignments (satellite)');
select is(
  (select count(*)::int from public.action_item_status_history where action_item_id = (select id from ai_c)),
  0, 'scope: a plain member CANNOT see the row''s action_item_status_history (satellite)');
reset role;

-- The foreign coordinator (comm_y) also sees ZERO (cross-commission wall).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.action_items where id = (select id from ai_c)),
  0, 'scope: a foreign coordinator CANNOT see the case_restricted row');
reset role;

-- st_x (the PHASE assignee) CAN see the row + both satellites (attribution-read).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.action_items where id = (select id from ai_c)),
  1, 'scope: the PHASE assignee CAN see the case_restricted row (attribution)');
select is(
  (select count(*)::int from public.action_item_assignments where action_item_id = (select id from ai_c)),
  1, 'scope: the phase assignee CAN see the owner assignment (satellite)');
select ok(
  (select count(*)::int from public.action_item_status_history where action_item_id = (select id from ai_c)) >= 1,
  'scope: the phase assignee CAN see the status history (satellite)');
reset role;

-- gx_r (case_access READ grantee) CAN see the row (grant-derived read).
select test_helpers.claims_for((select gx_r from p), false);
set local role authenticated;
select is(
  (select count(*)::int from public.action_items where id = (select id from ai_c)),
  1, 'scope: a case_access read-grantee CAN see the case_restricted row');
reset role;

-- staff_admin CAN see the row.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.action_items where id = (select id from ai_c)),
  1, 'scope: staff_admin CAN see the case_restricted row');
reset role;

-- A committee row (a MANUAL item) is visible to ANY member — proving the scope
-- disjunct is per-row, not a blanket case gate.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table ai_comm on commit drop as
  select (public.create_committee_action_item(
            p_commission  => (select comm_x from k),
            p_source_type => 'manual',
            p_title       => 'item de comissão')).id as id;
grant select on ai_comm to authenticated;
reset role;
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.action_items where id = (select id from ai_comm)),
  1, 'scope: a committee (manual) row IS visible to any member (per-row scope)');
reset role;

-- ===========================================================================
-- (3b) assignees_only — set directly (no RPC); visible to assignee + staff_admin
-- ===========================================================================
-- Flip ai_comm to assignees_only + assign st_x (owner already synced by RPC? No —
-- created without assignee, so set assigned_to too). Done as table owner.
update public.action_items set visibility_scope = 'assignees_only', assigned_to = (select st_x from k)
  where id = (select id from ai_comm);

-- st_x2 (a plain member, NOT the assignee, NOT staff_admin) now CANNOT see it.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.action_items where id = (select id from ai_comm)),
  0, 'scope(assignees_only): a non-assignee plain member CANNOT see it');
reset role;
-- st_x (the assignee) CAN.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.action_items where id = (select id from ai_comm)),
  1, 'scope(assignees_only): the assignee CAN see it');
reset role;
-- staff_admin CAN (always).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.action_items where id = (select id from ai_comm)),
  1, 'scope(assignees_only): staff_admin CAN see it (always)');
reset role;

-- ===========================================================================
-- (4) ADVANCE / COMPLETE authority — assignee OR content-writer (HC027)
-- ===========================================================================
-- st_x2 (plain member, not assignee, not content-writer) cannot advance ai_c → HC027.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.advance_committee_action_item(%L::uuid, %L::uuid, null) $$,
         (select id from ai_c), (select done_id from st)),
  'HC027', null, 'advance(case): a plain member (no attribution) is rejected (HC027)');
reset role;

-- A read-GRANTEE (read ≠ content-write, and not the assignee) also cannot → HC027.
select test_helpers.claims_for((select gx_r from p), false);
set local role authenticated;
select throws_ok(
  format($$ select public.advance_committee_action_item(%L::uuid, %L::uuid, null) $$,
         (select id from ai_c), (select done_id from st)),
  'HC027', null, 'advance(case): a READ-grantee (not assignee) is rejected (HC027)');
reset role;

-- The write-GRANTEE (content-writer) CAN advance even though not the assignee.
select test_helpers.claims_for((select gx_w from p), false);
set local role authenticated;
select lives_ok(
  format($$ select public.advance_committee_action_item(%L::uuid, %L::uuid, null) $$,
         (select id from ai_c), (select ip_id from st)),
  'advance(case): a WRITE-grantee (content-writer) CAN advance (HC027 branch)');
reset role;

-- The ASSIGNEE (st_x) can complete their own item.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.complete_committee_action_item(%L::uuid) $$, (select id from ai_c)),
  'complete(case): the assignee completes their own item');
reset role;
select is(
  (select st.key from public.action_items a join public.action_item_statuses st on st.id=a.status_id
   where a.id = (select id from ai_c)),
  'done', 'complete(case): the item is done + stamped');

-- ===========================================================================
-- (5) DELETE — staff_admin/org_admin only
-- ===========================================================================
-- The assignee (a plain member) cannot delete a case item → 42501.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.delete_committee_action_item(%L::uuid) $$, (select id from ai_c)),
  '42501', null, 'delete(case): a non-staff caller (even the assignee) is rejected (42501)');
reset role;
-- A write-grantee (content-writer, not staff_admin) also cannot delete → 42501.
select test_helpers.claims_for((select gx_w from p), false);
set local role authenticated;
select throws_ok(
  format($$ select public.delete_committee_action_item(%L::uuid) $$, (select id from ai_c)),
  '42501', null, 'delete(case): a write-grantee (not staff_admin) is rejected (42501)');
reset role;
-- staff_admin deletes it.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.delete_committee_action_item((select id from ai_c));
reset role;
select is(
  (select count(*)::int from public.action_items where id = (select id from ai_c)),
  0, 'delete(case): staff_admin hard-deletes the case item');

-- ===========================================================================
-- (6) KPIs — case_action_items_kpis reads the hub (source_type='case')
-- ===========================================================================
-- Reset to a known state: clear ALL case-sourced rows on this case (earlier
-- sections left `ai_force` + the write-grantee's item open), then create exactly
-- THREE: open + overdue (past due), in_progress (no due), done (this year). Done
-- as table owner so the count is deterministic.
delete from public.action_items
  where source_type = 'case' and source_case_id = (select case_x from cs);

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.create_committee_action_item(
  (select comm_x from k), 'case', null, null, (select case_x from cs),
  'kpi aberto vencido', null, null, null, (current_date - 7), null, null);   -- open, overdue
create temp table ai_ip on commit drop as
  select (public.create_committee_action_item(
            (select comm_x from k), 'case', null, null, (select case_x from cs),
            'kpi em progresso', null, null, null, null, null, null)).id as id;   -- open→in_progress
grant select on ai_ip to authenticated;
select public.advance_committee_action_item((select id from ai_ip), (select ip_id from st), null);
create temp table ai_done on commit drop as
  select (public.create_committee_action_item(
            (select comm_x from k), 'case', null, null, (select case_x from cs),
            'kpi concluído', null, null, null, null, null, null)).id as id;
grant select on ai_done to authenticated;
select public.advance_committee_action_item((select id from ai_done), (select done_id from st), null);  -- done, this year

create temp table kpi on commit drop as
  select * from public.case_action_items_kpis((select comm_x from k));
reset role;
grant select on kpi to authenticated;

-- open = non-terminal (the overdue-open + the in_progress) = 2.
select is((select open from kpi), 2::bigint,
  'kpi: open counts the 2 non-terminal case rows (overdue-open + in_progress)');
-- overdue = non-terminal + past due = 1 (the overdue-open only).
select is((select overdue from kpi), 1::bigint,
  'kpi: overdue counts the 1 past-due non-terminal case row');
-- completed_ytd = category completed this year = 1 (the done row).
select is((select completed_ytd from kpi), 1::bigint,
  'kpi: completed_ytd counts the 1 case row completed this year');

-- A non-staff_admin gets a zeroed row (gated; no leak).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table kpi_staff on commit drop as
  select * from public.case_action_items_kpis((select comm_x from k));
reset role;
grant select on kpi_staff to authenticated;
select is((select open from kpi_staff), 0::bigint,
  'kpi: a plain member gets a zeroed row (staff_admin-gated, no leak)');

select * from finish();
rollback;
