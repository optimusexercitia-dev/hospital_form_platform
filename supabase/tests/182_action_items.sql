-- Shared (non-PHI) action_items hub — migration 20260706000000_shared_action_items.sql.
--
-- Option A unification: the two membership-gated, non-PHI action-item sources
-- (meetings + manual) collapse onto ONE shared public.action_items hub with a
-- normalized status/urgency vocabulary, multi-role assignments (one active
-- owner), an append-only status-history log, and the 5 committee_* DEFINER RPCs.
-- case_action_items + CAPA are deliberately left alone. This file proves the
-- security posture + behaviour end-to-end against the hermetic bootstrap fixture.
--
-- Coverage (task brief 1–9):
--   1. GRANTS   — each new public.* RPC is NOT anon-executable and IS
--                 authenticated-executable (t19-style, mirrors 181).
--   2. HUB RLS  — a member SELECTs the commission's meeting+manual items; a
--                 non-member + cross-org user get NONE; a plain member cannot
--                 direct-write the hub; staff_admin/org_admin can.
--   3. CREATE   — staff_admin creates a meeting + a manual item; initial status
--                 set; an owner assignment mirrors assigned_to; a non-member
--                 assignee is rejected (HC021).
--   4. ADVANCE  — assignee OR staff_admin advances; a status_history row is
--                 written; completed_*/terminal stamped on `done`; unauthorized
--                 caller rejected (HC037).
--   5. OWNER    — the one-active-owner partial unique rejects a 2nd active owner;
--                 a new owner is allowed after the prior owner is completed.
--   6. GUARD    — meeting-source requires a same-commission meeting; a cross-
--                 commission case_id cross-link is rejected (HC032); status/
--                 urgency must be global or of the commission.
--   7. DELETE   — staff_admin hard-deletes; a non-staff caller is rejected.
--   8. READERS  — list_my_action_items self-scopes to assigned_to = auth.uid()
--                 and returns meeting (labels present) + manual (labels null)
--                 with the status KEY; get_member_overview pending = non-terminal
--                 assigned rows, overdue = those with due_date < today.
--   9. AUDIT    — action_item.{created,status_changed,deleted} rows emitted when
--                 audit_trail is ON.

begin;
select plan(54);

-- Feature flags this file exercises. audit_trail ON for the audit assertions.
update app.feature_flags set enabled = true
  where key in ('action_items', 'meetings', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid   as admin,
         (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'st_x2')::uuid   as st_x2,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'st_y')::uuid    as st_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y
  from ctx;
grant select on k to authenticated;

-- Shared global status ids (comm_x has no per-commission overrides).
create temp table st on commit drop as
  select (select id from public.action_item_statuses where key='open' and commission_id is null)        as open_id,
         (select id from public.action_item_statuses where key='in_progress' and commission_id is null) as ip_id,
         (select id from public.action_item_statuses where key='done' and commission_id is null)         as done_id,
         (select id from public.action_item_statuses where key='cancelled' and commission_id is null)    as cancelled_id;
grant select on st to authenticated;

-- ===========================================================================
-- (1) GRANTS — anon must NOT execute; authenticated must (t19-style).
-- ===========================================================================
select is(
  has_function_privilege('anon', 'public.create_committee_action_item(uuid,text,uuid,uuid,uuid,text,text,uuid,uuid,date,uuid,text)', 'EXECUTE'),
  false, 'anon cannot EXECUTE create_committee_action_item');
select is(
  has_function_privilege('anon', 'public.update_committee_action_item(uuid,text,text,uuid,uuid,date,text)', 'EXECUTE'),
  false, 'anon cannot EXECUTE update_committee_action_item');
select is(
  has_function_privilege('anon', 'public.advance_committee_action_item(uuid,uuid,text)', 'EXECUTE'),
  false, 'anon cannot EXECUTE advance_committee_action_item');
select is(
  has_function_privilege('anon', 'public.complete_committee_action_item(uuid)', 'EXECUTE'),
  false, 'anon cannot EXECUTE complete_committee_action_item');
select is(
  has_function_privilege('anon', 'public.delete_committee_action_item(uuid)', 'EXECUTE'),
  false, 'anon cannot EXECUTE delete_committee_action_item');
select is(
  has_function_privilege('anon', 'public.action_items_enabled()', 'EXECUTE'),
  false, 'anon cannot EXECUTE action_items_enabled');

select is(
  has_function_privilege('authenticated', 'public.create_committee_action_item(uuid,text,uuid,uuid,uuid,text,text,uuid,uuid,date,uuid,text)', 'EXECUTE'),
  true, 'authenticated can EXECUTE create_committee_action_item');
select is(
  has_function_privilege('authenticated', 'public.update_committee_action_item(uuid,text,text,uuid,uuid,date,text)', 'EXECUTE'),
  true, 'authenticated can EXECUTE update_committee_action_item');
select is(
  has_function_privilege('authenticated', 'public.advance_committee_action_item(uuid,uuid,text)', 'EXECUTE'),
  true, 'authenticated can EXECUTE advance_committee_action_item');
select is(
  has_function_privilege('authenticated', 'public.complete_committee_action_item(uuid)', 'EXECUTE'),
  true, 'authenticated can EXECUTE complete_committee_action_item');
select is(
  has_function_privilege('authenticated', 'public.delete_committee_action_item(uuid)', 'EXECUTE'),
  true, 'authenticated can EXECUTE delete_committee_action_item');
select is(
  has_function_privilege('authenticated', 'public.action_items_enabled()', 'EXECUTE'),
  true, 'authenticated can EXECUTE action_items_enabled');

-- ===========================================================================
-- (3) CREATE — staff_admin creates a meeting + a manual item.
-- ===========================================================================
-- A meeting in comm_x for the meeting-source item (staff_admin authoring).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table mtg on commit drop as
  select (public.create_meeting(
            p_commission_id  => (select comm_x from k),
            p_title          => 'Reunião itens',
            p_scheduled_start => (now() + interval '2 days'))).id as mid;
grant select on mtg to authenticated;

-- Meeting-source item assigned to st_x (a comm_x member).
create temp table ai_m on commit drop as
  select (public.create_committee_action_item(
            p_commission  => (select comm_x from k),
            p_source_type => 'meeting',
            p_meeting_id  => (select mid from mtg),
            p_title       => 'Item de reunião',
            p_description => 'desc reuniao',
            p_assigned_to => (select st_x from k),
            p_due_date    => (current_date - 1))).id as id;  -- overdue
grant select on ai_m to authenticated;

-- Manual-source item assigned to st_x (future due).
create temp table ai_a on commit drop as
  select (public.create_committee_action_item(
            p_commission  => (select comm_x from k),
            p_source_type => 'manual',
            p_title       => 'Item avulso',
            p_assigned_to => (select st_x from k),
            p_due_date    => (current_date + 5))).id as id;
grant select on ai_a to authenticated;
reset role;

select is(
  (select source_type from public.action_items where id = (select id from ai_m)),
  'meeting', 'create: meeting-source item lands source_type=meeting');
select is(
  (select source_type from public.action_items where id = (select id from ai_a)),
  'manual', 'create: manual-source item lands source_type=manual (no meeting)');
select is(
  (select st.key from public.action_items a join public.action_item_statuses st on st.id = a.status_id
   where a.id = (select id from ai_m)),
  'open', 'create: initial status resolves to the global initial (open)');
-- The owner assignment mirrors assigned_to.
select is(
  (select count(*)::int from public.action_item_assignments
   where action_item_id = (select id from ai_m) and role='owner'
     and user_id = (select st_x from k) and completed_at is null),
  1, 'create: an active owner assignment mirrors assigned_to');

-- A non-member assignee is rejected (HC021).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_committee_action_item(
              %L::uuid, 'manual', null, null, null, 'nope', null, %L::uuid, null, null) $$,
         (select comm_x from k), (select st_y from k)),  -- st_y is a comm_y member
  'HC021', null, 'create: a non-member assignee is rejected (HC021)');
reset role;

-- ===========================================================================
-- (2) HUB RLS — member reads meeting+manual; non-member + cross-org read none;
--     plain member cannot direct-write; staff_admin/org_admin can.
-- ===========================================================================
-- st_x (member of comm_x) sees BOTH comm_x items.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.action_items where commission_id = (select comm_x from k)),
  2, 'RLS: a comm_x member reads both comm_x items (meeting + manual)');
-- A plain member cannot direct-INSERT the hub (write policy = staff_admin/org_admin).
select throws_ok(
  format($$ insert into public.action_items (commission_id, source_type, title, status_id)
            values (%L::uuid, 'manual', 'direct', %L::uuid) $$,
         (select comm_x from k), (select open_id from st)),
  '42501', null, 'RLS: a plain member cannot direct-INSERT the hub (42501)');
reset role;

-- st_y (member of comm_y, NOT comm_x) sees ZERO comm_x items.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.action_items where commission_id = (select comm_x from k)),
  0, 'RLS: a non-member (comm_y staff) reads 0 comm_x items');
reset role;

-- The platform admin (no commission membership) sees ZERO — the cross-org wall.
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select is(
  (select count(*)::int from public.action_items),
  0, 'RLS: the platform admin (no membership) reads 0 action_items (wall)');
reset role;

-- staff_admin of comm_x CAN direct-INSERT (write policy holds) — and the guard
-- lets a clean manual row through. (Cleaned up implicitly by rollback.)
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ insert into public.action_items (commission_id, source_type, title, status_id)
            values (%L::uuid, 'manual', 'sa direct ok', %L::uuid) $$,
         (select comm_x from k), (select open_id from st)),
  'RLS: staff_admin CAN direct-INSERT a clean manual row');
-- Remove it so downstream counts stay deterministic.
delete from public.action_items where title = 'sa direct ok';
reset role;

-- ===========================================================================
-- (6) GUARD — same-commission integrity.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

-- A meeting-source create with NO meeting id is rejected (check_violation).
select throws_ok(
  format($$ select public.create_committee_action_item(
              %L::uuid, 'meeting', null, null, null, 'sem reunião', null, null, null, null) $$,
         (select comm_x from k)),
  '23514', null, 'guard: meeting-source create without a meeting id is rejected');

-- A case_id cross-link to ANOTHER commission's case is rejected (HC032).
-- Build a comm_y case (as sa_y), then try to hang a comm_x manual item off it.
reset role;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table cy on commit drop as
  select (public.create_case((select comm_y from k), 'Caso Y')).id as cid;
grant select on cy to authenticated;
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_committee_action_item(
              %L::uuid, 'manual', null, null, %L::uuid, 'cross case', null, null, null, null) $$,
         (select comm_x from k), (select cid from cy)),
  'HC032', null, 'guard: a cross-commission case_id cross-link is rejected (HC032)');

-- A status_id belonging to ANOTHER commission is rejected. Create a comm_y-scoped
-- status, then try to stamp a comm_x direct-insert with it.
reset role;
insert into public.action_item_statuses (commission_id, key, label, category, is_initial, is_terminal, sort_order)
  values ((select comm_y from k), 'y_only', 'Só Y', 'open', false, false, 9);
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.action_items (commission_id, source_type, title, status_id)
            values (%L::uuid, 'manual', 'bad status', %L::uuid) $$,
         (select comm_x from k),
         (select id from public.action_item_statuses where commission_id=(select comm_y from k) and key='y_only')),
  '23514', null, 'guard: a status of another commission is rejected');
reset role;

-- ===========================================================================
-- (4) ADVANCE — assignee OR staff_admin; status_history row; completed_* on done.
-- ===========================================================================
-- st_x2 (not assignee, not staff_admin) cannot advance ai_m -> HC037.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.advance_committee_action_item(%L::uuid, %L::uuid, null) $$,
         (select id from ai_m), (select ip_id from st)),
  'HC037', null, 'advance: a non-assignee non-admin is rejected (HC037)');
reset role;

-- st_x (the assignee) advances open -> in_progress; a history row is written.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.advance_committee_action_item((select id from ai_m), (select ip_id from st), 'começando');
reset role;
select is(
  (select st.key from public.action_items a join public.action_item_statuses st on st.id=a.status_id
   where a.id = (select id from ai_m)),
  'in_progress', 'advance: assignee moves open -> in_progress');
select is(
  (select count(*)::int from public.action_item_status_history
   where action_item_id = (select id from ai_m)
     and to_status_id = (select ip_id from st) and changed_by = (select st_x from k)),
  1, 'advance: a status_history row is written (from->to, changed_by)');
-- Not terminal yet: completed_* still null.
select ok(
  (select completed_at is null and completed_by is null from public.action_items where id = (select id from ai_m)),
  'advance: completed_* stay null on a non-terminal status');

-- staff_admin completes -> done: terminal stamps completed_at + completed_by.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.advance_committee_action_item((select id from ai_m), (select done_id from st), null);
reset role;
select is(
  (select st.key from public.action_items a join public.action_item_statuses st on st.id=a.status_id
   where a.id = (select id from ai_m)),
  'done', 'advance: staff_admin moves it to the terminal done status');
select ok(
  (select completed_at is not null and completed_by = (select sa_x from k)
   from public.action_items where id = (select id from ai_m)),
  'advance: completed_at + completed_by stamped on a terminal (done) status');

-- complete_committee_action_item is the convenience wrapper (resolves `done`).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.complete_committee_action_item((select id from ai_a));
reset role;
select is(
  (select st.key from public.action_items a join public.action_item_statuses st on st.id=a.status_id
   where a.id = (select id from ai_a)),
  'done', 'complete: the wrapper advances a manual item to done');

-- ===========================================================================
-- (5) ONE-ACTIVE-OWNER — the partial unique rejects a 2nd active owner; a new
--     owner is allowed after the prior owner is completed.
-- ===========================================================================
-- Fresh manual item assigned to st_x (writes one active owner).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table ai_o on commit drop as
  select (public.create_committee_action_item(
            p_commission  => (select comm_x from k),
            p_source_type => 'manual',
            p_title       => 'Item dono',
            p_assigned_to => (select st_x from k))).id as id;
grant select on ai_o to authenticated;
reset role;

-- A 2nd ACTIVE owner (different user, completed_at null) is rejected by the
-- partial unique index.
select throws_ok(
  format($$ insert into public.action_item_assignments (action_item_id, user_id, role)
            values (%L::uuid, %L::uuid, 'owner') $$,
         (select id from ai_o), (select st_x2 from k)),
  '23505', null, 'owner: a 2nd ACTIVE owner assignment is rejected (partial unique 23505)');

-- Complete the current owner, THEN a new active owner is accepted.
update public.action_item_assignments set completed_at = now()
  where action_item_id = (select id from ai_o) and role='owner' and completed_at is null;
select lives_ok(
  format($$ insert into public.action_item_assignments (action_item_id, user_id, role)
            values (%L::uuid, %L::uuid, 'owner') $$,
         (select id from ai_o), (select st_x2 from k)),
  'owner: a new active owner is allowed after the prior owner is completed');

-- ===========================================================================
-- (7) DELETE — staff_admin hard-deletes; a non-staff caller is rejected.
-- ===========================================================================
-- A fresh throwaway item to delete.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table ai_d on commit drop as
  select (public.create_committee_action_item(
            p_commission  => (select comm_x from k),
            p_source_type => 'manual',
            p_title       => 'Item para apagar',
            p_assigned_to => (select st_x from k))).id as id;
grant select on ai_d to authenticated;
reset role;

-- st_x (plain member, even though assignee) cannot delete -> 42501.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.delete_committee_action_item(%L::uuid) $$, (select id from ai_d)),
  '42501', null, 'delete: a non-staff caller (even the assignee) is rejected (42501)');
reset role;

-- staff_admin hard-deletes; the row (and its cascaded satellites) are gone.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.delete_committee_action_item((select id from ai_d));
reset role;
select is(
  (select count(*)::int from public.action_items where id = (select id from ai_d)),
  0, 'delete: staff_admin hard-deletes the item');
select is(
  (select count(*)::int from public.action_item_assignments where action_item_id = (select id from ai_d)),
  0, 'delete: the owner assignment cascades away with the item');

-- ===========================================================================
-- (8) READERS — list_my_action_items self-scopes + returns meeting/manual with
--     status KEY; get_member_overview pending/overdue.
-- ===========================================================================
-- Reset ai_m + ai_a back to non-terminal so the reader/overview counts are
-- meaningful (they were driven to `done` above). Reopen them as their assignee.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.advance_committee_action_item((select id from ai_m), (select ip_id from st), null); -- overdue, active
select public.advance_committee_action_item((select id from ai_a), (select open_id from st), null); -- future, active
reset role;

-- st_x sees exactly their assigned SHARED items (the meeting + the manual + the
-- ai_o owner item [also assigned st_x]). No case items in this fixture.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table items on commit drop as
  select jsonb_array_elements(public.list_my_action_items((select comm_x from k))) as it;
grant select on items to authenticated;
reset role;

select is(
  (select count(*)::int from items where it->>'source' = 'meeting'),
  1, 'readers: list_my_action_items returns the meeting-source item (source=meeting)');
select is(
  (select count(*)::int from items where it->>'source' = 'manual'),
  2, 'readers: list_my_action_items returns the manual-source items (source=manual)');
-- Meeting row: labels present, status is the KEY.
select ok(
  (select (it->>'meeting_id') is not null and (it->>'meeting_number') is not null
     and (it->>'status') = 'in_progress' and (it->>'case_id') is null
     from items where it->>'source'='meeting'),
  'readers: the meeting row carries meeting labels + the status KEY, null case fields');
-- Manual row: labels null, status is the KEY.
select ok(
  (select bool_and(
            (it->>'meeting_id') is null and (it->>'meeting_number') is null
            and (it->>'case_id') is null and (it->>'status') in ('open','done'))
     from items where it->>'source'='manual'),
  'readers: manual rows carry NULL meeting+case labels + the status KEY');
-- Self-scoping: an item assigned to st_x2 is NOT in st_x's list.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table ai_other on commit drop as
  select (public.create_committee_action_item(
            p_commission  => (select comm_x from k),
            p_source_type => 'manual',
            p_title       => 'De outro',
            p_assigned_to => (select st_x2 from k))).id as id;
grant select on ai_other to authenticated;
reset role;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int
   from jsonb_array_elements(public.list_my_action_items((select comm_x from k))) e
   where (e->>'id')::uuid = (select id from ai_other)),
  0, 'readers: list_my_action_items self-scopes (st_x2''s item absent from st_x''s list)');
reset role;

-- get_member_overview: pending = non-terminal assigned rows; overdue = due < today.
-- st_x now holds: ai_m (in_progress, due -1 → overdue), ai_a (open, due +5),
-- ai_o (open, no due). => pending 3, overdue 1.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table ov on commit drop as
  select public.get_member_overview((select comm_x from k)) as o;
grant select on ov to authenticated;
reset role;
select is(
  ((select o from ov)->>'pending_action_items')::int,
  3, 'overview: pending_action_items counts the 3 non-terminal assigned rows');
select is(
  ((select o from ov)->>'pending_action_items_overdue')::int,
  1, 'overview: pending_action_items_overdue counts the one past-due row (ai_m)');

-- ===========================================================================
-- (9) AUDIT — action_item.{created,status_changed,deleted} rows on mutations.
-- ===========================================================================
-- created: ai_m generated exactly one action_item.created row on its entity.
select is(
  (select count(*)::int from public.audit_log
   where action = 'action_item.created' and entity_type = 'action_item'
     and entity_id = (select id from ai_m)),
  1, 'audit: create emits exactly one action_item.created row');
-- status_changed: ai_m went open->in_progress->done->in_progress = 3 transitions.
select is(
  (select count(*)::int from public.audit_log
   where action = 'action_item.status_changed' and entity_id = (select id from ai_m)),
  3, 'audit: each status transition emits an action_item.status_changed row');
-- deleted: ai_d (hard-deleted above) emitted one action_item.deleted row.
select is(
  (select count(*)::int from public.audit_log
   where action = 'action_item.deleted' and entity_id = (select id from ai_d)),
  1, 'audit: delete emits exactly one action_item.deleted row');
-- The audit rows are commission-scoped to comm_x (never leak the entity elsewhere).
select is(
  (select count(*)::int from public.audit_log
   where entity_type = 'action_item' and entity_id = (select id from ai_m)
     and commission_id <> (select comm_x from k)),
  0, 'audit: action_item rows are stamped with the item''s own commission');

-- ===========================================================================
-- (10) FOLD DROP-INVARIANTS — the OLD case-action-item surface is GONE.
-- Migration 20260707 dropped the parallel case_action_items table, its 4 RPCs,
-- and app.advance_action_item_core (folded into the hub). A CATALOG sweep makes
-- the "dropped-symbol dangling caller" class impossible to reintroduce silently.
-- ===========================================================================
select is(
  (select count(*)::int from pg_class
   where relname = 'case_action_items' and relnamespace = 'public'::regnamespace),
  0, 'drop: the parallel public.case_action_items table is GONE');
select is(
  (select count(*)::int from pg_proc
   where pronamespace = 'public'::regnamespace and proname = 'create_action_item'),
  0, 'drop: the old public.create_action_item RPC is GONE');
select is(
  (select count(*)::int from pg_proc
   where pronamespace = 'public'::regnamespace and proname = 'update_action_item'),
  0, 'drop: the old public.update_action_item RPC is GONE');
select is(
  (select count(*)::int from pg_proc
   where pronamespace = 'public'::regnamespace and proname = 'advance_action_item'),
  0, 'drop: the old public.advance_action_item RPC is GONE');
select is(
  (select count(*)::int from pg_proc
   where pronamespace = 'public'::regnamespace and proname = 'complete_action_item'),
  0, 'drop: the old public.complete_action_item RPC is GONE');
select is(
  (select count(*)::int from pg_proc
   where pronamespace = 'app'::regnamespace and proname = 'advance_action_item_core'),
  0, 'drop: app.advance_action_item_core is GONE (folded into advance_committee_action_item)');

select * from finish();
rollback;
