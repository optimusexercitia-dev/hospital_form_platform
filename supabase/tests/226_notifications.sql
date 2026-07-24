-- S1·N · Notifications engine (Phase 20; ADR 0076). Build plan:
-- docs/plans/notifications-s1.md §1. Covers:
--   1.  Own-row RLS: notifications SELECT scoping + UPDATE(read_at) own-row.
--   2.  notifications: NO authenticated INSERT at all — direct INSERT as self
--       AND as another user both rejected (BUG-SUP-002 pattern; the DEFINER
--       helper is the only write door).
--   3.  notification_preferences: own-row RLS; direct INSERT as ANOTHER user
--       rejected, own-row direct INSERT succeeds (no DEFINER-only door needed
--       here — a forged own-row preference has no security impact).
--   4.  set_notification_preferences: valid upsert + HC0C0 invalid surface.
--   5.  mark_notification_read: own success, not-found/not-owned HC0C1,
--       already-read is an idempotent success (not an error).
--   6.  mark_all_notifications_read clears every unread row for the caller.
--   7.  CAPA event hooks: add_capa_action enqueues capa/assigned (non-
--       suppressible); update_capa_action enqueues on reassignment;
--       app.advance_capa_action_core auto-resolves reminders on
--       completed/cancelled (assignment persists unresolved).
--   8.  Sign-off event hook: save_section_answers enqueues signoff/requested
--       (staff_admin-role only) exactly once submit-ready; sign_section
--       auto-resolves the scan-driven reminders once no staff_admin-role
--       pending section remains (the event row itself, is_reminder=false,
--       is untouched — it persists as history).
--   9.  Meeting event hooks: add_meeting_attendee enqueues meeting/convoked
--       (non-suppressible, platform attendees only); conclude_meeting
--       auto-resolves 'upcoming' reminders (convoked persists).
--  10. compute_due_notifications: CAPA due_soon/overdue/still_open select
--      exactly the due set (assignee + open status + due_date required;
--      no-assignee / closed / out-of-window rows produce nothing);
--      preference suppression (reminders only, assignment still delivers);
--      idempotent — a second run over saturated fixtures adds zero rows.
--  11. t19: mark_notification_read / mark_all_notifications_read /
--      set_notification_preferences / compute_due_notifications all reject
--      anon; compute_due_notifications is additionally service_role-only (a
--      deliberate deviation from the uniform authenticated+service_role
--      grant — ADR 0076 decision 8, no manual "run now").
--
-- Fixtures: test_helpers.bootstrap() (comm_x/sa_x/st_x/st_x2/hosp_b, form_s
-- with its gate + conditional + respondent-signoff + staff_admin-signoff
-- sections already wired — reused as-is for the sign-off fixture). CAPA needs
-- patient_safety ON + admin enrolled as pqs_member of hosp_b (143_capa.sql
-- precedent). Meetings need the meetings flag ON.

begin;
select plan(69);

update app.feature_flags set enabled = true where key = 'notifications';
update app.feature_flags set enabled = true where key = 'patient_safety';
update app.feature_flags set enabled = true where key = 'meetings';
update app.feature_flags set enabled = true where key = 'action_items';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid   as admin,
         (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'st_x2')::uuid   as st_x2,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'hosp_b')::uuid  as hosp_b,
         (v->>'ver_s')::uuid   as ver_s,
         (v->>'sec_s1')::uuid  as sec_s1,
         (v->>'sec_signoff_r')::uuid as sec_signoff_r,
         (v->>'sec_signoff_a')::uuid as sec_signoff_a,
         (v->>'it_gate')::uuid as it_gate,
         (v->>'it_req')::uuid  as it_req
  from ctx;
grant select on k to authenticated;

insert into public.memberships (organization_id, hospital_id, principal_id, role, granted_by)
  select (select organization_id from public.hospitals where id = (select hosp_b from k)),
         (select hosp_b from k), (select admin from k), 'pqs_member', (select admin from k);

-- ---------------------------------------------------------------------------
-- ---- 1) CAPA event hooks: add_capa_action -> capa/assigned ----
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
create temp table capa1 on commit drop as
  select (public.open_capa_plan('manual', 'corretiva', null, (select hosp_b from k))).id as capa_id;
reset role;
grant select on capa1 to authenticated;

select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
create temp table act1 on commit drop as
  select (public.add_capa_action(
    (select capa_id from capa1), 'Ação Teste 1', null, (select st_x from k), current_date - 1
  )).id as action_id;
reset role;
grant select on act1 to authenticated;

select is(
  (select count(*)::int from public.notifications
     where user_id = (select st_x from k) and kind = 'capa' and milestone = 'assigned'
       and entity_type = 'capa_action' and entity_id = (select action_id from act1)),
  1, '1a. add_capa_action enqueues exactly one capa/assigned for the assignee'
);
select is(
  (select is_reminder from public.notifications
     where user_id = (select st_x from k) and kind = 'capa' and milestone = 'assigned'
       and entity_id = (select action_id from act1)),
  false, '1b. capa/assigned is non-suppressible (is_reminder = false)'
);
select is(
  (select commission_id from public.notifications
     where user_id = (select st_x from k) and entity_id = (select action_id from act1) limit 1),
  null, '1c. CAPA notifications carry commission_id = NULL (capa_action has no commission)'
);

-- Captured explicitly: st_x accumulates SEVERAL capa/assigned notifications
-- later in this file (capa2/capa3/capa5 are also assigned to st_x as due-set
-- control fixtures), so a later `where user_id = st_x and kind = 'capa' and
-- milestone = 'assigned' limit 1` would be ambiguous. Pin THIS row (act1's
-- original assignment, unique by entity_id at this point) for the
-- mark_notification_read checks in §14.
create temp table st_x_notif1 on commit drop as
  select id from public.notifications
  where user_id = (select st_x from k) and kind = 'capa' and milestone = 'assigned'
    and entity_id = (select action_id from act1);
grant select on st_x_notif1 to authenticated;

-- ---------------------------------------------------------------------------
-- ---- 2) update_capa_action -> capa/assigned on reassignment ----
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select public.update_capa_action(
  (select action_id from act1), 'Ação Teste 1', null, (select st_x2 from k), current_date - 1
);
reset role;

select is(
  (select count(*)::int from public.notifications
     where user_id = (select st_x2 from k) and kind = 'capa' and milestone = 'assigned'
       and entity_id = (select action_id from act1)),
  1, '2. reassignment enqueues capa/assigned for the NEW assignee (st_x2)'
);

-- ---------------------------------------------------------------------------
-- ---- 3) CAPA scan: due_soon / overdue / still_open select exactly the due
-- set (assignee + open status + due_date required). act1 is now overdue,
-- assigned to st_x2. ----
-- ---------------------------------------------------------------------------
-- capa2..capa5 built directly as admin (authenticated) so add_capa_action's
-- own assignment enqueue fires too (already covered by check #1) — reuse the
-- same flow for each control fixture.
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
create temp table capa2 on commit drop as
  select (public.add_capa_action(
    (select capa_id from capa1), 'Ação Teste 2 (due soon)', null, (select st_x from k), current_date + 2
  )).id as action_id;
create temp table capa3 on commit drop as
  select (public.add_capa_action(
    (select capa_id from capa1), 'Ação Teste 3 (fora da janela)', null, (select st_x from k), current_date + 10
  )).id as action_id;
create temp table capa4 on commit drop as
  select (public.add_capa_action(
    (select capa_id from capa1), 'Ação Teste 4 (sem responsável)', null, null, current_date - 1
  )).id as action_id;
create temp table capa5 on commit drop as
  select (public.add_capa_action(
    (select capa_id from capa1), 'Ação Teste 5 (concluída)', null, (select st_x from k), current_date - 1
  )).id as action_id;
reset role;
grant select on capa2 to authenticated;
grant select on capa3 to authenticated;
grant select on capa4 to authenticated;
grant select on capa5 to authenticated;

update public.capa_action set status = 'completed' where id = (select action_id from capa5);

select public.compute_due_notifications();

select is(
  (select count(*)::int from public.notifications
     where entity_id = (select action_id from act1) and kind = 'capa' and milestone = 'overdue'),
  1, '3a. overdue selects the assigned + open + past-due action'
);
select is(
  (select count(*)::int from public.notifications
     where entity_id = (select action_id from act1) and kind = 'capa' and milestone = 'still_open'),
  1, '3b. still_open fires alongside overdue (same week)'
);
select is(
  (select count(*)::int from public.notifications
     where entity_id = (select action_id from capa2) and kind = 'capa' and milestone = 'due_soon'),
  1, '3c. due_soon selects an action due within 3 days'
);
select is(
  (select count(*)::int from public.notifications
     where entity_id = (select action_id from capa3) and is_reminder = true),
  0, '3d. an action due in 10 days is excluded (out of window)'
);
select is(
  (select count(*)::int from public.notifications
     where entity_id = (select action_id from capa4) and is_reminder = true),
  0, '3e. an unassigned overdue action is excluded (no recipient)'
);
select is(
  (select count(*)::int from public.notifications
     where entity_id = (select action_id from capa5) and is_reminder = true),
  0, '3f. a completed overdue action is excluded (closed status)'
);

-- ---------------------------------------------------------------------------
-- ---- 4) idempotency: a second scan over saturated fixtures adds zero rows
-- (checked broadly across the CAPA cohort so far; the meeting/sign-off arms
-- add their own fixtures below and are covered by the SAME two calls). ----
-- ---------------------------------------------------------------------------
create temp table before_count on commit drop as
  select count(*)::int as n from public.notifications;
select public.compute_due_notifications();
select is(
  (select count(*)::int from public.notifications),
  (select n from before_count),
  '4. re-running compute_due_notifications over an unchanged due set adds zero rows (idempotent)'
);

-- ---------------------------------------------------------------------------
-- ---- 5) CAPA close auto-resolve: completing st_x2's action resolves its
-- overdue/still_open reminders; the (now-historical) assignment rows for
-- BOTH st_x and st_x2 stay unresolved (assignments persist, decision 9). ----
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select public.complete_capa_action((select action_id from act1));
reset role;

select is(
  (select count(*)::int from public.notifications
     where entity_id = (select action_id from act1) and is_reminder = true and resolved_at is null),
  0, '5a. CAPA close resolves every open reminder on the action'
);
select is(
  (select count(*)::int from public.notifications
     where entity_id = (select action_id from act1) and is_reminder = false and resolved_at is not null),
  0, '5b. the assignment notifications are NOT touched by auto-resolve (persist as history)'
);

-- ---------------------------------------------------------------------------
-- ---- 6) preference suppression: st_x2 disables capa reminders; a fresh
-- overdue assignment still delivers (non-suppressible) but the scan enqueues
-- NO reminder for st_x2 on it. ----
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select public.set_notification_preferences('capa', false);
reset role;

select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
create temp table capa6 on commit drop as
  select (public.add_capa_action(
    (select capa_id from capa1), 'Ação Teste 6 (prefs)', null, (select st_x2 from k), current_date - 1
  )).id as action_id;
reset role;
grant select on capa6 to authenticated;

select public.compute_due_notifications();

select is(
  (select count(*)::int from public.notifications
     where user_id = (select st_x2 from k) and entity_id = (select action_id from capa6)
       and kind = 'capa' and milestone = 'assigned'),
  1, '6a. the assignment notification still delivers with capa reminders disabled (non-suppressible)'
);
select is(
  (select count(*)::int from public.notifications
     where user_id = (select st_x2 from k) and entity_id = (select action_id from capa6) and is_reminder = true),
  0, '6b. the overdue/still_open reminders are suppressed for st_x2 on this action'
);

-- ---------------------------------------------------------------------------
-- ---- 7) HC0C0: invalid surface ----
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_notification_preferences('bogus', false) $$,
  'HC0C0', null,
  '7. set_notification_preferences rejects an invalid surface (HC0C0)'
);
reset role;

-- ---------------------------------------------------------------------------
-- ---- 8) Sign-off event hooks (form_s: sec_s1 gate + sec_signoff_r
-- (respondent) + sec_signoff_a (staff_admin, no visible_when -> always
-- visible)). st_x fills the two required sections; the notification fires
-- once the response is submit-ready (both required saves done), targeting
-- sa_x (the commission's only staff_admin). ----
-- ---------------------------------------------------------------------------
create temp table resp1 on commit drop as select gen_random_uuid() as response_id;
grant select on resp1 to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status)
select resp1.response_id, k.ver_s, k.comm_x, k.st_x, 'in_progress'
from resp1, k;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.save_section_answers(
  (select response_id from resp1), (select sec_s1 from k),
  '{}'::jsonb, null, null,
  jsonb_build_object((select it_gate::text from k), jsonb_build_array('nao'))
);
reset role;

select is(
  (select count(*)::int from public.notifications
     where entity_type = 'response_section_signoff' and entity_id = (select response_id from resp1)),
  0, '8a. no signoff/requested yet — the response is not submit-ready (it_req unanswered)'
);

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.save_section_answers(
  (select response_id from resp1), (select sec_signoff_r from k),
  '{}'::jsonb, null, null,
  jsonb_build_object((select it_req::text from k), jsonb_build_array('sim'))
);
reset role;

select is(
  (select count(*)::int from public.notifications
     where user_id = (select sa_x from k) and kind = 'signoff' and milestone = 'requested'
       and entity_type = 'response_section_signoff' and entity_id = (select response_id from resp1)),
  1, '8b. save_section_answers enqueues signoff/requested for sa_x once submit-ready'
);
select is(
  (select is_reminder from public.notifications
     where user_id = (select sa_x from k) and kind = 'signoff' and milestone = 'requested'
       and entity_id = (select response_id from resp1)),
  false, '8c. signoff/requested is an event notification (is_reminder = false)'
);

-- Re-saving (unrelated no-op edit) must not duplicate the notification.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.save_section_answers(
  (select response_id from resp1), (select sec_signoff_r from k),
  '{}'::jsonb, null, null,
  jsonb_build_object((select it_req::text from k), jsonb_build_array('sim'))
);
reset role;
select is(
  (select count(*)::int from public.notifications
     where user_id = (select sa_x from k) and kind = 'signoff' and milestone = 'requested'
       and entity_id = (select response_id from resp1)),
  1, '8d. a repeated save is idempotent (dedup_key), still exactly one requested row'
);

-- Backdate the requested notification 4 days so the pending/still_open scan
-- arm has an anchor to fire from (S1 anchors "became pending" on our own
-- event-notification history — see compute_due_notifications header).
update public.notifications
set created_at = now() - interval '4 days'
where user_id = (select sa_x from k) and kind = 'signoff' and milestone = 'requested'
  and entity_id = (select response_id from resp1);

select public.compute_due_notifications();

select is(
  (select count(*)::int from public.notifications
     where user_id = (select sa_x from k) and kind = 'signoff' and milestone = 'pending'
       and entity_id = (select response_id from resp1)),
  1, '8e. sign-off scan enqueues pending (>=3 days since first requested)'
);
select is(
  (select count(*)::int from public.notifications
     where user_id = (select sa_x from k) and kind = 'signoff' and milestone = 'still_open'
       and entity_id = (select response_id from resp1)),
  1, '8f. sign-off scan enqueues the weekly still_open alongside pending'
);

-- ---------------------------------------------------------------------------
-- ---- 9) sign_section auto-resolve: signing the ONLY staff_admin-role
-- section resolves the scan-driven reminders; the event row (is_reminder =
-- false) is untouched. ----
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.sign_section((select response_id from resp1), (select sec_signoff_a from k));
reset role;

select is(
  (select count(*)::int from public.notifications
     where entity_id = (select response_id from resp1) and is_reminder = true and resolved_at is null),
  0, '9a. sign_section resolves the pending/still_open reminders'
);
select is(
  (select count(*)::int from public.notifications
     where entity_id = (select response_id from resp1) and kind = 'signoff' and milestone = 'requested'
       and resolved_at is not null),
  0, '9b. the requested EVENT row is untouched (is_reminder = false, persists as history)'
);

-- ---------------------------------------------------------------------------
-- ---- 10) Meeting event hooks + scan + auto-resolve ----
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table meet1 on commit drop as
  select (public.create_meeting(
    (select comm_x from k), 'Reunião Amanhã', null, now() + interval '1 day', null, 'presencial', null, null
  )).id as meeting_id;
reset role;
grant select on meet1 to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_meeting_attendee((select meeting_id from meet1), (select st_x from k), null, null, 'membro', 'present', null);
reset role;

select is(
  (select count(*)::int from public.notifications
     where user_id = (select st_x from k) and kind = 'meeting' and milestone = 'convoked'
       and entity_type = 'meeting' and entity_id = (select meeting_id from meet1)),
  1, '10a. add_meeting_attendee enqueues meeting/convoked for the platform attendee'
);
select is(
  (select is_reminder from public.notifications
     where user_id = (select st_x from k) and kind = 'meeting' and milestone = 'convoked'
       and entity_id = (select meeting_id from meet1)),
  false, '10b. meeting/convoked is non-suppressible (is_reminder = false)'
);

select public.compute_due_notifications();

select is(
  (select count(*)::int from public.notifications
     where user_id = (select st_x from k) and kind = 'meeting' and milestone = 'upcoming'
       and entity_id = (select meeting_id from meet1)),
  1, '10c. the scan enqueues upcoming for a meeting scheduled tomorrow'
);

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.conclude_meeting((select meeting_id from meet1));
reset role;

select is(
  (select count(*)::int from public.notifications
     where entity_id = (select meeting_id from meet1) and kind = 'meeting' and milestone = 'upcoming'
       and resolved_at is not null),
  1, '10d. conclude_meeting resolves the upcoming reminder'
);
select is(
  (select count(*)::int from public.notifications
     where entity_id = (select meeting_id from meet1) and kind = 'meeting' and milestone = 'convoked'
       and resolved_at is not null),
  0, '10e. the convoked EVENT row is untouched by auto-resolve (persists as history)'
);

-- ---------------------------------------------------------------------------
-- ---- 11) Own-row RLS ----
-- ---------------------------------------------------------------------------
create temp table sa_notif on commit drop as
  select id from public.notifications where user_id = (select sa_x from k) limit 1;
grant select on sa_notif to authenticated;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.notifications where id = (select id from sa_notif)),
  0, '11a. RLS: st_x cannot read sa_x''s notification by id'
);
select is(
  (select count(*)::int from public.notifications where user_id = (select st_x from k)) > 0,
  true, '11b. RLS: st_x reads their own notifications'
);
reset role;

-- ---------------------------------------------------------------------------
-- ---- 12) notifications: NO authenticated INSERT at all (BUG-SUP-002 pattern
-- — even an own-user_id INSERT is rejected; the only write door is
-- app.enqueue_notification). ----
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.notifications (user_id, kind, milestone, is_reminder, entity_type, entity_id, title, dedup_key)
            values (%L, 'capa', 'assigned', false, 'capa_action', gen_random_uuid(), 'forjado', 'forge:self') $$,
         (select st_x from k)),
  '42501', null,
  '12a. direct INSERT as SELF is rejected (no authenticated INSERT grant at all)'
);
select throws_ok(
  format($$ insert into public.notifications (user_id, kind, milestone, is_reminder, entity_type, entity_id, title, dedup_key)
            values (%L, 'capa', 'assigned', false, 'capa_action', gen_random_uuid(), 'forjado', 'forge:other') $$,
         (select sa_x from k)),
  '42501', null,
  '12b. direct INSERT impersonating ANOTHER user is rejected (BUG-SUP-002 pattern)'
);
reset role;

-- ---------------------------------------------------------------------------
-- ---- 13) notification_preferences: own-row RLS ----
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ insert into public.notification_preferences (user_id, surface) values (%L, 'meeting') $$,
         (select sa_x from k)),
  '42501', null,
  '13a. notification_preferences: direct INSERT impersonating another user is rejected'
);
select lives_ok(
  $$ insert into public.notification_preferences (user_id, surface, reminders_enabled) values (auth.uid(), 'meeting', false) $$,
  '13b. notification_preferences: own-row direct INSERT succeeds'
);
reset role;

select is(
  (select reminders_enabled from public.notification_preferences
     where user_id = (select st_x from k) and surface = 'meeting'),
  false, '13c. the own-row insert persisted with the given value'
);

-- ---------------------------------------------------------------------------
-- ---- 14) mark_notification_read / mark_all_notifications_read ----
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.mark_notification_read((select id from st_x_notif1));
reset role;

select is(
  (select read_at is not null from public.notifications where id = (select id from st_x_notif1)),
  true, '14a. mark_notification_read sets read_at on the caller''s own row'
);

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.mark_notification_read(%L) $$, (select id from sa_notif)),
  'HC0C1', null,
  '14b. marking another user''s notification as read raises HC0C1'
);
select throws_ok(
  format($$ select public.mark_notification_read(%L) $$, gen_random_uuid()),
  'HC0C1', null,
  '14c. marking a nonexistent notification raises HC0C1'
);
select lives_ok(
  format($$ select public.mark_notification_read(%L) $$, (select id from st_x_notif1)),
  '14d. marking an already-read notification again is an idempotent success'
);
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.mark_all_notifications_read();
reset role;

select is(
  (select count(*)::int from public.notifications where user_id = (select st_x from k) and read_at is null),
  0, '15. mark_all_notifications_read clears every unread row for the caller'
);

-- ---------------------------------------------------------------------------
-- ---- 16) t19 guard: grants on every new public RPC ----
-- ---------------------------------------------------------------------------
select ok(
  not has_function_privilege('anon', 'public.mark_notification_read(uuid)', 'EXECUTE'),
  '16a. mark_notification_read is NOT anon-executable'
);
select ok(
  not has_function_privilege('anon', 'public.mark_all_notifications_read()', 'EXECUTE'),
  '16b. mark_all_notifications_read is NOT anon-executable'
);
select ok(
  not has_function_privilege('anon', 'public.set_notification_preferences(text, boolean)', 'EXECUTE'),
  '16c. set_notification_preferences is NOT anon-executable'
);
select ok(
  not has_function_privilege('anon', 'public.compute_due_notifications()', 'EXECUTE'),
  '16d. compute_due_notifications is NOT anon-executable'
);
select ok(
  not has_function_privilege('authenticated', 'public.compute_due_notifications()', 'EXECUTE'),
  '16e. compute_due_notifications is service_role-only (deliberate deviation from the uniform grant — ADR 0076 decision 8, no manual run-now)'
);

-- ---------------------------------------------------------------------------
-- ---- 17) BUG-N-001: list_my_assigned_capa_actions (the non-PQS assignee's
-- global personal surface). Self-scoped on assignee_user_id = auth.uid().
-- By now several capa_action rows are assigned to st_x (capa2/capa3/capa5) and
-- others to st_x2 (act1 after reassignment, capa6). ----
-- ---------------------------------------------------------------------------
-- Ground truth computed as postgres (no RLS) — st_x is a PLAIN staff member
-- who cannot SELECT capa_action directly (that is the whole point of the
-- DEFINER RPC), so the expected count must be captured OUTSIDE the
-- authenticated role. Capture st_x's OWN assigned actions + one row that is
-- assigned to st_x2 (must NOT appear when st_x calls the RPC).
create temp table capa_expect on commit drop as
  select count(*)::int as st_x_count from public.capa_action where assignee_user_id = (select st_x from k);
grant select on capa_expect to authenticated;
create temp table st_x2_action on commit drop as
  select id from public.capa_action where assignee_user_id = (select st_x2 from k) limit 1;
grant select on st_x2_action to authenticated;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.list_my_assigned_capa_actions()),
  (select st_x_count from capa_expect),
  '17a. list_my_assigned_capa_actions returns exactly the caller''s assigned actions'
);
select ok(
  not exists (
    select 1 from public.list_my_assigned_capa_actions() m
    where m.id = (select id from st_x2_action)
  ),
  '17b. an action assigned to ANOTHER user (st_x2) never appears for st_x'
);
reset role;

-- A user assigned to NO capa_action gets an empty set.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.list_my_assigned_capa_actions()),
  0, '17c. a non-assignee gets zero rows'
);
reset role;

-- PHI-free by construction (Rule 12): the RPC body touches ONLY capa_action and
-- selects config-level columns — no rca/root-cause/event/patient join or column.
select ok(
  pg_get_functiondef('public.list_my_assigned_capa_actions()'::regprocedure) !~*
    '(root_cause|success_measure|\yrca\y|event_patient|\ypatient\y|capa_plan)',
  '17d. the RPC body references no RCA/root-cause/event/patient/plan source (PHI-free, Rule 12)'
);

-- ---------------------------------------------------------------------------
-- ---- 18) t19 grants on the new public RPC ----
-- ---------------------------------------------------------------------------
select ok(
  not has_function_privilege('anon', 'public.list_my_assigned_capa_actions()', 'EXECUTE'),
  '18a. list_my_assigned_capa_actions is NOT anon-executable'
);
select ok(
  has_function_privilege('authenticated', 'public.list_my_assigned_capa_actions()', 'EXECUTE'),
  '18b. list_my_assigned_capa_actions IS authenticated-executable (t19 grant present)'
);

-- ---------------------------------------------------------------------------
-- ---- 19) BE-6·N: action-item reminder scan arm (AI·sat × S1·N; plan §3 X-ζ;
-- Open #3). Fixtures inserted directly as the test superuser (bypasses RLS) in
-- comm_x: st_x is a plain staff member, sa_x is staff_admin. case_access is
-- enabled so a case_restricted item's read gate is STRICT (staff_admin/grant,
-- not flat membership) — the Open-#3 leak test needs that. ----
-- ---------------------------------------------------------------------------
update app.feature_flags set enabled = true where key = 'case_access';

-- A real case in comm_x for the case_restricted security fixtures.
create temp table ai_case on commit drop as select gen_random_uuid() as case_id;
grant select on ai_case to authenticated;
insert into public.cases (id, commission_id, case_number, label, created_by)
  select (select case_id from ai_case), (select comm_x from k),
         990001, 'Caso segurança AI', (select admin from k);

-- Pre-generate item ids so assertions can reference them by name.
create temp table aik on commit drop as select
  gen_random_uuid() as before_ok, gen_random_uuid() as before_wrong,
  gen_random_uuid() as onday, gen_random_uuid() as after_ok,
  gen_random_uuid() as after_wrong, gen_random_uuid() as owner_fb,
  gen_random_uuid() as unassigned, gen_random_uuid() as terminal,
  gen_random_uuid() as case_noread, gen_random_uuid() as case_canread,
  gen_random_uuid() as complete_it;
grant select on aik to authenticated;

-- Items (all manual, comm_x). status = global 'open' (non-terminal) except the
-- terminal one which uses 'done'.
insert into public.action_items
  (id, commission_id, source_type, title, status_id, visibility_scope, linked_case_id, assigned_to, due_date)
select v.id, (select comm_x from k), 'manual', v.title,
       app.action_item_status_by_key((select comm_x from k), v.status_key),
       v.scope, v.case_id, v.assigned_to, v.due_date
from (
  values
    ((select before_ok    from aik), 'AI antes (ok)',        'open',      'committee',       null::uuid,                      (select st_x from k), current_date + 3),
    ((select before_wrong from aik), 'AI antes (data errada)','open',     'committee',       null,                            (select st_x from k), current_date + 5),
    ((select onday        from aik), 'AI no dia',             'open',      'committee',       null,                            (select st_x from k), current_date),
    ((select after_ok     from aik), 'AI depois (ok)',        'open',      'committee',       null,                            (select st_x from k), current_date - 2),
    ((select after_wrong  from aik), 'AI depois (data errada)','open',    'committee',       null,                            (select st_x from k), current_date - 1),
    ((select owner_fb     from aik), 'AI fallback dono',      'open',      'committee',       null,                            null,                 current_date),
    ((select unassigned   from aik), 'AI sem responsável',    'open',      'committee',       null,                            null,                 current_date),
    ((select terminal     from aik), 'AI concluído',          'done',      'committee',       null,                            (select st_x from k), current_date - 1),
    ((select case_noread  from aik), 'AI caso sem leitura',   'open',      'case_restricted', (select case_id from ai_case),   (select st_x from k), current_date),
    ((select case_canread from aik), 'AI caso com leitura',   'open',      'case_restricted', (select case_id from ai_case),   (select sa_x from k), current_date),
    ((select complete_it  from aik), 'AI a concluir',         'open',      'committee',       null,                            (select st_x from k), current_date)
) as v(id, title, status_key, scope, case_id, assigned_to, due_date);

-- Active owner assignment for the fallback item (assigned_to is NULL there).
insert into public.action_item_assignments (action_item_id, user_id, role)
  select (select owner_fb from aik), (select st_x from k), 'owner';

-- Reminder rules: before_due offset 3, on_due, after_due offset 2.
insert into public.action_item_reminders (action_item_id, reminder_type, offset_days)
values
  ((select before_ok    from aik), 'before_due', 3),
  ((select before_wrong from aik), 'before_due', 3),
  ((select onday        from aik), 'on_due',     null),
  ((select after_ok     from aik), 'after_due',  2),
  ((select after_wrong  from aik), 'after_due',  2),
  ((select owner_fb     from aik), 'on_due',     null),
  ((select unassigned   from aik), 'on_due',     null),
  ((select terminal     from aik), 'after_due',  1),
  ((select case_noread  from aik), 'on_due',     null),
  ((select case_canread from aik), 'on_due',     null),
  ((select complete_it  from aik), 'on_due',     null);

select public.compute_due_notifications();

select is(
  (select count(*)::int from public.notifications
     where entity_type = 'action_item' and entity_id = (select before_ok from aik)
       and user_id = (select st_x from k) and milestone = 'due_soon'),
  1, '19a. before_due fires due_soon on due_date = today + offset_days'
);
select is(
  (select count(*)::int from public.notifications
     where entity_type = 'action_item' and entity_id = (select before_wrong from aik)),
  0, '19b. before_due does NOT fire on a non-matching date'
);
select is(
  (select count(*)::int from public.notifications
     where entity_type = 'action_item' and entity_id = (select onday from aik)
       and user_id = (select st_x from k) and milestone = 'due_soon'),
  1, '19c. on_due fires due_soon on due_date = today'
);
select is(
  (select count(*)::int from public.notifications
     where entity_type = 'action_item' and entity_id = (select after_ok from aik)
       and user_id = (select st_x from k) and milestone = 'overdue'),
  1, '19d. after_due fires overdue on due_date = today - offset_days'
);
select is(
  (select count(*)::int from public.notifications
     where entity_type = 'action_item' and entity_id = (select after_wrong from aik)),
  0, '19e. after_due does NOT fire on a non-matching date'
);
select is(
  (select count(*)::int from public.notifications
     where entity_type = 'action_item' and entity_id = (select owner_fb from aik)
       and user_id = (select st_x from k)),
  1, '19f. recipient falls back to the active owner assignment when assigned_to is NULL'
);
select is(
  (select count(*)::int from public.notifications
     where entity_type = 'action_item' and entity_id = (select unassigned from aik)),
  0, '19g. an unassigned item with no owner emits nothing (no null-user row)'
);
select is(
  (select count(*)::int from public.notifications
     where entity_type = 'action_item' and entity_id = (select terminal from aik)),
  0, '19h. a terminal (done) item never fires, even with an active matching reminder'
);
select is(
  (select milestone || '|' || title from public.notifications
     where entity_type = 'action_item' and entity_id = (select after_ok from aik) limit 1),
  'overdue|Item de ação atrasado',
  '19i. after_due carries milestone=overdue + the pt-BR overdue heading'
);
select is(
  (select kind || '|' || body from public.notifications
     where entity_type = 'action_item' and entity_id = (select before_ok from aik) limit 1),
  'action_item|AI antes (ok)',
  '19j. PHI-free: kind=action_item and body is the item''s own (config-level) title'
);
select is(
  (select count(*)::int from public.notifications
     where entity_type = 'action_item' and entity_id = (select case_noread from aik)),
  0, '19k. Open #3: a case_restricted item whose recipient CANNOT read the case is NOT notified'
);
select is(
  (select count(*)::int from public.notifications
     where entity_type = 'action_item' and entity_id = (select case_canread from aik)
       and user_id = (select sa_x from k)),
  1, '19l. a case_restricted item whose recipient CAN read the case IS notified'
);

-- Idempotency: a second same-day scan adds no duplicate.
select public.compute_due_notifications();
select is(
  (select count(*)::int from public.notifications
     where entity_type = 'action_item' and entity_id = (select onday from aik)),
  1, '19m. a second same-day scan is idempotent (one row per item/milestone/day)'
);

-- Resolve-on-complete (decision 9): completing an item with an open reminder
-- stamps resolved_at. Proves the choke point fires on the COMPLETE path
-- (complete_committee_action_item -> advance_committee_action_item). st_x is
-- the assignee, so the HC037 authority gate passes.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select public.complete_committee_action_item((select complete_it from aik));
reset role;
select is(
  (select count(*)::int from public.notifications
     where entity_type = 'action_item' and entity_id = (select complete_it from aik)
       and is_reminder = true and resolved_at is not null),
  1, '19o. completing an item resolves its open reminder (drops out of the unresolved set)'
);

-- Arm flag gate: a fresh item created now (not seen by the scans above). With
-- action_items OFF the arm emits nothing; ON, it fires.
create temp table ai_flagoff on commit drop as select gen_random_uuid() as id;
grant select on ai_flagoff to authenticated;
insert into public.action_items
  (id, commission_id, source_type, title, status_id, assigned_to, due_date)
  select (select id from ai_flagoff), (select comm_x from k), 'manual', 'AI flag gate',
         app.action_item_status_by_key((select comm_x from k), 'open'),
         (select st_x from k), current_date;
insert into public.action_item_reminders (action_item_id, reminder_type, offset_days)
  values ((select id from ai_flagoff), 'on_due', null);

update app.feature_flags set enabled = false where key = 'action_items';
select public.compute_due_notifications();
select is(
  (select count(*)::int from public.notifications
     where entity_type = 'action_item' and entity_id = (select id from ai_flagoff)),
  0, '19p. with the action_items flag OFF the reminder arm emits nothing'
);
update app.feature_flags set enabled = true where key = 'action_items';
select public.compute_due_notifications();
select is(
  (select count(*)::int from public.notifications
     where entity_type = 'action_item' and entity_id = (select id from ai_flagoff)),
  1, '19q. with the action_items flag back ON the reminder arm fires'
);

-- Engine gate: notifications OFF -> compute_due_notifications returns 0.
update app.feature_flags set enabled = false where key = 'notifications';
select is(
  public.compute_due_notifications(), 0,
  '19r. with the notifications flag OFF compute_due_notifications returns 0'
);
update app.feature_flags set enabled = true where key = 'notifications';

select * from finish();
rollback;
