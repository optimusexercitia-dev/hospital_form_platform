-- Action-item SATELLITES — reminders / updates / checklists
-- migration 20260720000950_action_item_satellites.sql (AI·sat, ADR 0050).
--
-- Three NEW spoke tables off public.action_items(id). Each reuses the hub's
-- scope-aware read predicate VERBATIM (app.can_read_action_item) for its single
-- SELECT policy, funnels every write through a DEFINER committee_* RPC, and emits
-- a structural-columns-only audit diff. This file proves the security posture end
-- to end against the hermetic bootstrap fixture.
--
-- Coverage (plan §7.9–7.10):
--   1. GRANTS — each of the 8 new public.* RPCs is NOT anon-executable and IS
--      authenticated-executable (t19-style).
--   2. SCOPE TRUTH-TABLE — per satellite × each visibility_scope (committee /
--      case_restricted / assignees_only): a qualifying reader sees the satellite
--      row; a disqualified reader does not (27 cells).
--   2b. DIRECT DML DENIED — each satellite has NO authenticated write policy (all
--      writes funnel through the DEFINER committee_* RPCs): a direct INSERT by a
--      parent-READER is RLS-denied (42501), and no non-SELECT policy exists.
--   3. O-1 NULL-CASE — a case_restricted item with NULL coalesce(source_case_id,
--      case_id) is invisible to EVERYONE incl. staff_admin (can_read_case(null)
--      is fail-closed), and so are its satellite rows.
--   4. WRITE AUTHORITY — HC0I0 (reminders: staff_admin/org_admin), HC0I1/HC0I2
--      (updates/checklists: reader-with-a-stake) for the unentitled caller;
--      positive lives_ok for the entitled caller.
--   5. CHECK CONSTRAINTS — reminder offset XOR (on_due⇔null), non-blank body/title.
--   6. TOGGLE — checklist done stamps completed_*, undo clears them.
--   7. AUDIT — satellite created rows emitted; the diff EXCLUDES free-text body.
--   8. FLAG-OFF — the satellite RPCs raise HC000 when action_items is OFF.
--
-- Personas (commission X unless noted):
--   sa_x   staff_admin of X — qualifies for ALL scopes; reminder-manager.
--   st_x   plain member; ASSIGNEE of the assignees_only item + PHASE assignee of
--          the case ⇒ qualifies committee + case_restricted + assignees_only.
--   st_x2  a plain member of X — NO attribution, NO grant (the boundary persona);
--          qualifies committee ONLY; a stakeless reader for the write gate.
--   sa_y   foreign coordinator (commission Y) — qualifies nothing in X.

begin;
select plan(70);

-- Master + case-source flags ON; case_access ON for the case_restricted matrix;
-- audit_trail ON for the audit assertions.
update app.feature_flags set enabled = true
  where key in ('action_items', 'cases_extras', 'cases_multi_phase', 'case_access', 'audit_trail');

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

create temp table st on commit drop as
  select (select id from public.action_item_statuses where key='open' and commission_id is null) as open_id,
         (select id from public.action_item_statuses where key='in_progress' and commission_id is null) as ip_id;
grant select on st to authenticated;

-- ===========================================================================
-- (1) GRANTS — anon must NOT execute; authenticated must (t19-style).
-- ===========================================================================
select is(has_function_privilege('anon', 'public.create_committee_action_item_reminder(uuid,text,integer)', 'EXECUTE'),
  false, 'anon cannot EXECUTE create_committee_action_item_reminder');
select is(has_function_privilege('anon', 'public.update_committee_action_item_reminder(uuid,boolean)', 'EXECUTE'),
  false, 'anon cannot EXECUTE update_committee_action_item_reminder');
select is(has_function_privilege('anon', 'public.delete_committee_action_item_reminder(uuid)', 'EXECUTE'),
  false, 'anon cannot EXECUTE delete_committee_action_item_reminder');
select is(has_function_privilege('anon', 'public.create_committee_action_item_update(uuid,text,text)', 'EXECUTE'),
  false, 'anon cannot EXECUTE create_committee_action_item_update');
select is(has_function_privilege('anon', 'public.create_committee_action_item_checklist(uuid,text,integer)', 'EXECUTE'),
  false, 'anon cannot EXECUTE create_committee_action_item_checklist');
select is(has_function_privilege('anon', 'public.toggle_committee_action_item_checklist(uuid,boolean)', 'EXECUTE'),
  false, 'anon cannot EXECUTE toggle_committee_action_item_checklist');
select is(has_function_privilege('anon', 'public.update_committee_action_item_checklist(uuid,text,integer)', 'EXECUTE'),
  false, 'anon cannot EXECUTE update_committee_action_item_checklist');
select is(has_function_privilege('anon', 'public.delete_committee_action_item_checklist(uuid)', 'EXECUTE'),
  false, 'anon cannot EXECUTE delete_committee_action_item_checklist');

select is(has_function_privilege('authenticated', 'public.create_committee_action_item_reminder(uuid,text,integer)', 'EXECUTE'),
  true, 'authenticated can EXECUTE create_committee_action_item_reminder');
select is(has_function_privilege('authenticated', 'public.update_committee_action_item_reminder(uuid,boolean)', 'EXECUTE'),
  true, 'authenticated can EXECUTE update_committee_action_item_reminder');
select is(has_function_privilege('authenticated', 'public.delete_committee_action_item_reminder(uuid)', 'EXECUTE'),
  true, 'authenticated can EXECUTE delete_committee_action_item_reminder');
select is(has_function_privilege('authenticated', 'public.create_committee_action_item_update(uuid,text,text)', 'EXECUTE'),
  true, 'authenticated can EXECUTE create_committee_action_item_update');
select is(has_function_privilege('authenticated', 'public.create_committee_action_item_checklist(uuid,text,integer)', 'EXECUTE'),
  true, 'authenticated can EXECUTE create_committee_action_item_checklist');
select is(has_function_privilege('authenticated', 'public.toggle_committee_action_item_checklist(uuid,boolean)', 'EXECUTE'),
  true, 'authenticated can EXECUTE toggle_committee_action_item_checklist');
select is(has_function_privilege('authenticated', 'public.update_committee_action_item_checklist(uuid,text,integer)', 'EXECUTE'),
  true, 'authenticated can EXECUTE update_committee_action_item_checklist');
select is(has_function_privilege('authenticated', 'public.delete_committee_action_item_checklist(uuid)', 'EXECUTE'),
  true, 'authenticated can EXECUTE delete_committee_action_item_checklist');

-- ===========================================================================
-- Fixture — one case (phase assigned st_x) + three parent items (one per scope).
-- ===========================================================================
create temp table cs on commit drop as
  select gen_random_uuid() as case_x, gen_random_uuid() as phase_x;
grant select on cs to authenticated;

insert into public.cases (id, commission_id, case_number, label, created_by)
values ((select case_x from cs), (select comm_x from k), 9401, 'Caso Satélites', (select sa_x from k));

insert into public.case_phases
  (id, case_id, position, form_id, form_version_id, status, assigned_to, blocks)
values
  ((select phase_x from cs), (select case_x from cs), 1, (select form_u from k),
   (select ver_u from k), 'active', (select st_x from k), '{}');

-- Parent items created by sa_x (staff_admin): a committee manual item, a
-- case-sourced (forced case_restricted) item, and an assignees_only item
-- assigned to st_x.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

create temp table p_comm on commit drop as
  select (public.create_committee_action_item(
            p_commission  => (select comm_x from k),
            p_source_type => 'manual',
            p_title       => 'Item comitê',
            p_visibility_scope => 'committee')).id as id;
grant select on p_comm to authenticated;

create temp table p_case on commit drop as
  select (public.create_committee_action_item(
            p_commission  => (select comm_x from k),
            p_source_type => 'case',
            p_case_id     => (select case_x from cs),
            p_title       => 'Item caso',
            p_assigned_to => (select st_x from k),
            p_source_case_phase_id => (select phase_x from cs))).id as id;
grant select on p_case to authenticated;

create temp table p_assg on commit drop as
  select (public.create_committee_action_item(
            p_commission  => (select comm_x from k),
            p_source_type => 'manual',
            p_title       => 'Item responsáveis',
            p_assigned_to => (select st_x from k),
            p_visibility_scope => 'assignees_only')).id as id;
grant select on p_assg to authenticated;

-- Seed ONE row in EACH satellite on EACH parent, all as sa_x (staff_admin
-- qualifies A0 for reminders AND the reader-with-a-stake gate for updates/
-- checklists). Capture the assignees_only checklist id for the toggle test.
select public.create_committee_action_item_reminder((select id from p_comm), 'before_due', 3);
select public.create_committee_action_item_reminder((select id from p_case), 'before_due', 3);
select public.create_committee_action_item_reminder((select id from p_assg), 'before_due', 3);

select public.create_committee_action_item_update((select id from p_comm), 'note', 'nota comitê');
select public.create_committee_action_item_update((select id from p_case), 'note', 'nota caso');
select public.create_committee_action_item_update((select id from p_assg), 'note', 'nota responsáveis');

select public.create_committee_action_item_checklist((select id from p_comm), 'sub comitê', null);
select public.create_committee_action_item_checklist((select id from p_case), 'sub caso', null);
create temp table cl_assg on commit drop as
  select (public.create_committee_action_item_checklist((select id from p_assg), 'sub responsáveis', null)).id as id;
grant select on cl_assg to authenticated;
reset role;

-- ===========================================================================
-- (2) SCOPE TRUTH-TABLE — 3 satellites × 3 scopes × {qualifying, disqualified}.
-- ===========================================================================

-- --- committee scope: st_x2 (member) sees; sa_x sees; sa_y (foreign) sees 0 ---
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.action_item_reminders where action_item_id=(select id from p_comm)),
  1, 'scope committee/reminders: a member sees the reminder row');
select is((select count(*)::int from public.action_item_updates where action_item_id=(select id from p_comm)),
  1, 'scope committee/updates: a member sees the update row');
select is((select count(*)::int from public.action_item_checklists where action_item_id=(select id from p_comm)),
  1, 'scope committee/checklists: a member sees the checklist row');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.action_item_reminders where action_item_id=(select id from p_comm)),
  1, 'scope committee/reminders: staff_admin sees the reminder row');
select is((select count(*)::int from public.action_item_updates where action_item_id=(select id from p_comm)),
  1, 'scope committee/updates: staff_admin sees the update row');
select is((select count(*)::int from public.action_item_checklists where action_item_id=(select id from p_comm)),
  1, 'scope committee/checklists: staff_admin sees the checklist row');
reset role;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select count(*)::int from public.action_item_reminders where action_item_id=(select id from p_comm)),
  0, 'scope committee/reminders: a foreign coordinator sees 0');
select is((select count(*)::int from public.action_item_updates where action_item_id=(select id from p_comm)),
  0, 'scope committee/updates: a foreign coordinator sees 0');
select is((select count(*)::int from public.action_item_checklists where action_item_id=(select id from p_comm)),
  0, 'scope committee/checklists: a foreign coordinator sees 0');
reset role;

-- --- case_restricted scope: st_x (phase-assignee) sees; sa_x sees; st_x2 sees 0 ---
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.action_item_reminders where action_item_id=(select id from p_case)),
  1, 'scope case_restricted/reminders: the phase-assignee sees the reminder row');
select is((select count(*)::int from public.action_item_updates where action_item_id=(select id from p_case)),
  1, 'scope case_restricted/updates: the phase-assignee sees the update row');
select is((select count(*)::int from public.action_item_checklists where action_item_id=(select id from p_case)),
  1, 'scope case_restricted/checklists: the phase-assignee sees the checklist row');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.action_item_reminders where action_item_id=(select id from p_case)),
  1, 'scope case_restricted/reminders: staff_admin sees the reminder row');
select is((select count(*)::int from public.action_item_updates where action_item_id=(select id from p_case)),
  1, 'scope case_restricted/updates: staff_admin sees the update row');
select is((select count(*)::int from public.action_item_checklists where action_item_id=(select id from p_case)),
  1, 'scope case_restricted/checklists: staff_admin sees the checklist row');
reset role;

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.action_item_reminders where action_item_id=(select id from p_case)),
  0, 'scope case_restricted/reminders: a plain member (no case read) sees 0');
select is((select count(*)::int from public.action_item_updates where action_item_id=(select id from p_case)),
  0, 'scope case_restricted/updates: a plain member (no case read) sees 0');
select is((select count(*)::int from public.action_item_checklists where action_item_id=(select id from p_case)),
  0, 'scope case_restricted/checklists: a plain member (no case read) sees 0');
reset role;

-- --- assignees_only scope: st_x (assignee) sees; sa_x sees; st_x2 sees 0 ---
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.action_item_reminders where action_item_id=(select id from p_assg)),
  1, 'scope assignees_only/reminders: the assignee sees the reminder row');
select is((select count(*)::int from public.action_item_updates where action_item_id=(select id from p_assg)),
  1, 'scope assignees_only/updates: the assignee sees the update row');
select is((select count(*)::int from public.action_item_checklists where action_item_id=(select id from p_assg)),
  1, 'scope assignees_only/checklists: the assignee sees the checklist row');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.action_item_reminders where action_item_id=(select id from p_assg)),
  1, 'scope assignees_only/reminders: staff_admin sees the reminder row');
select is((select count(*)::int from public.action_item_updates where action_item_id=(select id from p_assg)),
  1, 'scope assignees_only/updates: staff_admin sees the update row');
select is((select count(*)::int from public.action_item_checklists where action_item_id=(select id from p_assg)),
  1, 'scope assignees_only/checklists: staff_admin sees the checklist row');
reset role;

select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select count(*)::int from public.action_item_reminders where action_item_id=(select id from p_assg)),
  0, 'scope assignees_only/reminders: a stakeless plain member sees 0');
select is((select count(*)::int from public.action_item_updates where action_item_id=(select id from p_assg)),
  0, 'scope assignees_only/updates: a stakeless plain member sees 0');
select is((select count(*)::int from public.action_item_checklists where action_item_id=(select id from p_assg)),
  0, 'scope assignees_only/checklists: a stakeless plain member sees 0');
reset role;

-- ===========================================================================
-- (2b) DIRECT DML DENIED — no authenticated write policy; writes are DEFINER-RPC
--      only. Structural: each satellite carries ONLY a SELECT policy (RLS denies
--      any INSERT with 42501, and any UPDATE/DELETE matches no policy → 0 rows).
--      Runtime: a parent-READER (st_x2, member of comm_x, who CAN read the
--      committee item's satellites) is STILL denied a direct INSERT (42501) —
--      proving the block is the missing WRITE policy, not a SELECT filter.
--      Mirrors the 224/F1 table-level-enforcement precedent (BUG-SUP-002).
-- ===========================================================================
-- Structural (catalog, as owner): only a SELECT policy exists on each satellite.
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='action_item_reminders' and cmd <> 'SELECT'),
  0, 'DML: action_item_reminders has NO non-SELECT policy (writes are DEFINER-RPC only)');
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='action_item_updates' and cmd <> 'SELECT'),
  0, 'DML: action_item_updates has NO non-SELECT policy (writes are DEFINER-RPC only)');
select is(
  (select count(*)::int from pg_policies
   where schemaname='public' and tablename='action_item_checklists' and cmd <> 'SELECT'),
  0, 'DML: action_item_checklists has NO non-SELECT policy (writes are DEFINER-RPC only)');

-- Runtime: st_x2 CAN read p_comm's satellites (committee scope) yet a direct
-- INSERT is RLS-denied (42501) — the missing write policy, not a read block.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.action_item_reminders (action_item_id, reminder_type)
            values (%L::uuid, 'on_due') $$, (select id from p_comm)),
  '42501', null, 'DML: a parent-reader''s direct INSERT into action_item_reminders is RLS-denied (42501)');
select throws_ok(
  format($$ insert into public.action_item_updates (action_item_id, update_type, body)
            values (%L::uuid, 'note', 'x') $$, (select id from p_comm)),
  '42501', null, 'DML: a parent-reader''s direct INSERT into action_item_updates is RLS-denied (42501)');
select throws_ok(
  format($$ insert into public.action_item_checklists (action_item_id, title)
            values (%L::uuid, 'x') $$, (select id from p_comm)),
  '42501', null, 'DML: a parent-reader''s direct INSERT into action_item_checklists is RLS-denied (42501)');
reset role;

-- ===========================================================================
-- (3) O-1 NULL-CASE — a case_restricted item with NULL coalesce(source_case_id,
--     case_id) is fail-closed. can_read_case(null, uid) returns false for EVERY
--     caller (its null-commission guard returns before any admin arm), so the
--     case_restricted branch of can_read_action_item / the hub SELECT policy is
--     false for all. The general population (a plain member / non-case-reader)
--     therefore sees neither the hub row nor any satellite row — invisible, not
--     open. The ONLY reader of the HUB row is a staff_admin/org_admin, via the
--     hub's SEPARATE `action_items_staff_admin_write` policy (cmd=ALL, whose
--     USING grants commission-admins SELECT on any row regardless of scope) — the
--     "except staff_admin/org_admin folded into the predicate" exception O-1
--     explicitly allows. The SATELLITES have NO such blanket policy (writes are
--     DEFINER-RPC only), so their rows are invisible even to staff_admin — the
--     satellite closes the leak MORE tightly than the hub. All fail-closed.
-- ===========================================================================
-- Create a manual (committee) item as sa_x, then force it to case_restricted with
-- NO case link; seed a reminder directly as owner (RLS-bypassing) so a row exists.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table p_null on commit drop as
  select (public.create_committee_action_item(
            p_commission  => (select comm_x from k),
            p_source_type => 'manual',
            p_title       => 'Item órfão')).id as id;
grant select on p_null to authenticated;
reset role;

-- Force case_restricted with null case links (guard does not force/validate a
-- manual row; the visibility_scope CHECK permits case_restricted).
update public.action_items set visibility_scope = 'case_restricted' where id = (select id from p_null);
insert into public.action_item_reminders (action_item_id, reminder_type, offset_days)
  values ((select id from p_null), 'on_due', null);

-- The general population is fail-closed: a plain member / non-case-reader sees
-- neither the null-case HUB row nor its satellite reminder row.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.action_items where id=(select id from p_null)),
  0, 'O-1: a null-case case_restricted HUB row is invisible to a plain member (fail-closed)');
select is((select count(*)::int from public.action_item_reminders where action_item_id=(select id from p_null)),
  0, 'O-1: its reminder satellite row is invisible to a plain member (no leak)');
reset role;
-- The satellite closes the leak even for staff_admin: sa_x (who CAN see the hub
-- row via action_items_staff_admin_write) still sees ZERO satellite rows, because
-- the satellite SELECT policy is can_read_action_item (no admin fallback for
-- case_restricted → can_read_case(null) is false).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.action_item_reminders where action_item_id=(select id from p_null)),
  0, 'O-1: the null-case reminder satellite row is invisible even to staff_admin (tighter than the hub)');
reset role;

-- ===========================================================================
-- (4) WRITE AUTHORITY — HC0I0 (reminders), HC0I1/HC0I2 (reader-with-a-stake).
-- ===========================================================================
-- HC0I0: a plain member (st_x2) cannot create a reminder on the committee item
-- (reminders require staff_admin/org_admin, NOT mere read).
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_committee_action_item_reminder(%L::uuid, 'on_due', null) $$, (select id from p_comm)),
  'HC0I0', null, 'HC0I0: a plain member cannot manage a reminder (staff_admin/org_admin only)');
-- HC0I1: st_x2 CAN read the committee item but has NO stake → cannot post an update.
select throws_ok(
  format($$ select public.create_committee_action_item_update(%L::uuid, 'note', 'sem interesse') $$, (select id from p_comm)),
  'HC0I1', null, 'HC0I1: a stakeless committee reader cannot post an update');
-- HC0I2: same stakeless reader cannot manage a checklist row.
select throws_ok(
  format($$ select public.create_committee_action_item_checklist(%L::uuid, 'sub', null) $$, (select id from p_comm)),
  'HC0I2', null, 'HC0I2: a stakeless committee reader cannot create a checklist row');
reset role;

-- Positive: sa_x (staff_admin) manages a reminder; st_x (assignee) posts an update
-- and creates a checklist row on the assignees_only item.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.create_committee_action_item_reminder(%L::uuid, 'on_due', null) $$, (select id from p_comm)),
  'authority: staff_admin can manage a reminder (HC0I0 gate passes)');
reset role;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.create_committee_action_item_update(%L::uuid, 'progress', 'andamento') $$, (select id from p_assg)),
  'authority: the assignee can post an update (HC0I1 gate passes)');
select lives_ok(
  format($$ select public.create_committee_action_item_checklist(%L::uuid, 'nova sub', null) $$, (select id from p_assg)),
  'authority: the assignee can create a checklist row (HC0I2 gate passes)');
reset role;

-- ===========================================================================
-- (5) CHECK CONSTRAINTS — reminder offset XOR; non-blank body/title.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_committee_action_item_reminder(%L::uuid, 'on_due', 5) $$, (select id from p_comm)),
  '23514', null, 'check: on_due with a non-null offset is rejected');
select throws_ok(
  format($$ select public.create_committee_action_item_reminder(%L::uuid, 'before_due', null) $$, (select id from p_comm)),
  '23514', null, 'check: before_due without an offset is rejected');
select throws_ok(
  format($$ select public.create_committee_action_item_update(%L::uuid, 'note', '   ') $$, (select id from p_comm)),
  '23514', null, 'check: a blank update body is rejected');
select throws_ok(
  format($$ select public.create_committee_action_item_checklist(%L::uuid, '   ', null) $$, (select id from p_comm)),
  '23514', null, 'check: a blank checklist title is rejected');
reset role;

-- ===========================================================================
-- (6) TOGGLE — checklist done stamps completed_*; undo clears them.
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.toggle_committee_action_item_checklist((select id from cl_assg), true);
reset role;
select ok(
  (select completed_at is not null and completed_by = (select st_x from k)
   from public.action_item_checklists where id = (select id from cl_assg)),
  'toggle: marking a checklist row done stamps completed_at + completed_by');
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.toggle_committee_action_item_checklist((select id from cl_assg), false);
reset role;
select ok(
  (select completed_at is null and completed_by is null
   from public.action_item_checklists where id = (select id from cl_assg)),
  'toggle: un-marking a checklist row clears completed_at + completed_by');

-- ===========================================================================
-- (7) AUDIT — satellite created rows emitted; the diff EXCLUDES free-text body.
-- ===========================================================================
select is(
  (select count(*)::int from public.audit_log
   where action = 'action_item.reminder.created' and entity_id = (select id from p_comm)),
  2, 'audit: reminder creates on the committee item emit action_item.reminder.created rows');
select ok(
  (select count(*)::int from public.audit_log
   where action = 'action_item.update.created' and entity_id = (select id from p_comm)) >= 1,
  'audit: an update create emits an action_item.update.created row');
select ok(
  (select count(*)::int from public.audit_log
   where action = 'action_item.checklist.created' and entity_id = (select id from p_assg)) >= 1,
  'audit: a checklist create emits an action_item.checklist.created row');
-- Structural-only: the update.created audit metadata must NOT carry the free-text
-- body. Post a distinctively-bodied update, then sweep the audit metadata for it.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.create_committee_action_item_update((select id from p_assg), 'blocker', 'SEGREDO_CORPO_XYZ');
reset role;
select is(
  (select count(*)::int from public.audit_log
   where action = 'action_item.update.created' and metadata::text like '%SEGREDO_CORPO_XYZ%'),
  0, 'audit: the update.created diff EXCLUDES the free-text body (structural cols only)');

-- ===========================================================================
-- (8) FLAG-OFF — the satellite RPCs raise HC000 when action_items is OFF.
-- ===========================================================================
update app.feature_flags set enabled = false where key = 'action_items';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_committee_action_item_reminder(%L::uuid, 'on_due', null) $$, (select id from p_comm)),
  'HC000', null, 'flag-off: create_committee_action_item_reminder raises HC000');
select throws_ok(
  format($$ select public.create_committee_action_item_update(%L::uuid, 'note', 'x') $$, (select id from p_comm)),
  'HC000', null, 'flag-off: create_committee_action_item_update raises HC000');
reset role;
update app.feature_flags set enabled = true where key = 'action_items';

select * from finish();
rollback;
