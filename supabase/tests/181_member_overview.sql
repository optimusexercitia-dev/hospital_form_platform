-- Member overview + unified "my action items" —
-- migration 20260704000000_member_overview_action_items.sql.
--
-- Proves the two self-scoped SECURITY DEFINER read RPCs (post shared-hub
-- unification: the meeting arm now reads public.action_items, emitting
-- source='meeting' + source='manual'):
--   public.list_my_action_items(p_commission)  — the caller's case + shared
--     (meeting|manual) action items (assigned_to = auth.uid()), ALL statuses,
--     each source flag-gated (case arm: cases_extras; shared arm: action_items)
--     and OMITTED when off;
--   public.get_member_overview(p_commission)   — 5 self-scoped counts + 2 hints,
--     flag-dependent counts return 0/null when off (never raise).
--
-- Key assertions:
--   * grant posture: anon CANNOT execute either RPC (t19-style guard);
--     authenticated CAN;
--   * list_my_action_items returns ONLY the caller's assigned rows, with the
--     right source discriminator + label material (case number/label, meeting
--     number/scheduled_start, created_by name);
--   * a source whose flag is OFF is omitted from the union (no error);
--   * overview counts: pending action items (open+in_progress) + overdue subset,
--     meetings-not-concluded (attendee-scoped) + next start, pending signatures
--     (attendance=presente, em_assinatura, unsigned), in_progress drafts;
--   * CASE-ACCESS-OFF ATTRIBUTION: a phase-assignee (no case_access grant) IS
--     counted in cases_not_concluded even with the `case_access` flag OFF (the
--     minhas-fases reality), while the grant leg drops.

begin;
select plan(19);

update app.feature_flags set enabled = true
  where key in ('cases_extras', 'cases_multi_phase', 'meetings');
update app.feature_flags set enabled = true where key = 'case_access';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'st_x2')::uuid   as st_x2,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'form_u')::uuid  as form_u,
         (v->>'ver_u')::uuid   as ver_u
  from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures (as staff_admin X — the coordinator authoring path).
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

-- (form_u / ver_u is already published by test_helpers.bootstrap, so the ad-hoc
-- phase can bind its published version directly.)

-- A process-less, non-terminal case in commission X, with an ad-hoc phase
-- ASSIGNED TO st_x (the attribution leg) — no case_access grant.
create temp table cse on commit drop as
  select (public.create_case((select comm_x from k), 'Caso visão geral')).id as cid;
grant select on cse to authenticated;

create temp table ph on commit drop as
  select (public.add_ad_hoc_phase(
            p_case_id      => (select cid from cse),
            p_form_id      => (select form_u from k),
            p_title        => 'Fase atribuída',
            p_assigned_to  => (select st_x from k))).id as pid;
grant select on ph to authenticated;

-- A case action item assigned to st_x (open). Case action items were folded into
-- the shared action_items hub (migration 20260707; source_type='case'): the old
-- create_action_item RPC is dropped, so author it via create_committee_action_item.
create temp table cai on commit drop as
  select (public.create_committee_action_item(
            p_commission  => (select comm_x from k),
            p_source_type => 'case',
            p_case_id     => (select cid from cse),
            p_title       => 'Item de caso',
            p_description => 'desc caso',
            p_assigned_to => (select st_x from k),
            p_due_date    => (current_date + 5))).id as aid;
grant select on cai to authenticated;

-- A meeting in commission X with st_x as a PRESENTE attendee, one action item
-- assigned to st_x (open, overdue), and status em_assinatura (so a signature is
-- pending for st_x).
create temp table mtg on commit drop as
  select (public.create_meeting(
            p_commission_id  => (select comm_x from k),
            p_title          => 'Reunião visão geral',
            p_scheduled_start => (now() + interval '3 days'))).id as mid;
grant select on mtg to authenticated;

create temp table att on commit drop as
  select (public.add_meeting_attendee(
            (select mid from mtg), (select st_x from k), null, null,
            'membro', 'present', null)).id as attid;
grant select on att to authenticated;

create temp table mai on commit drop as
  select (public.create_committee_action_item(
            p_commission  => (select comm_x from k),
            p_source_type => 'meeting',
            p_meeting_id  => (select mid from mtg),
            p_title       => 'Item de reunião',
            p_description => 'desc reuniao',
            p_assigned_to => (select st_x from k),
            p_due_date    => (current_date - 2))).id as maid;
grant select on mai to authenticated;

-- A MANUAL-source shared action item assigned to st_x (open, future deadline).
-- Exercises the new manual arm of list_my_action_items / get_member_overview:
-- it must appear with source='manual' and NULL meeting labels, and count toward
-- pending_action_items (non-terminal), but NOT toward overdue (future due).
create temp table man on commit drop as
  select (public.create_committee_action_item(
            p_commission  => (select comm_x from k),
            p_source_type => 'manual',
            p_title       => 'Item avulso',
            p_description => 'tarefa autônoma',
            p_assigned_to => (select st_x from k),
            p_due_date    => (current_date + 7))).id as manid;
grant select on man to authenticated;

-- Conclude the meeting (agendada -> realizada -> em_assinatura) via the
-- lifecycle RPC — direct status UPDATEs are guarded (guard_meeting_status). With
-- st_x present and a member, quorum is met, so this lands em_assinatura and a
-- signature becomes pending for st_x.
select public.conclude_meeting((select mid from mtg));

reset role;

-- An in_progress draft response by st_x in commission X.
insert into public.responses (form_version_id, commission_id, created_by, status)
  values ((select ver_u from k), (select comm_x from k), (select st_x from k), 'in_progress');

-- ===========================================================================
-- Grant posture — anon must NOT execute; authenticated must.
-- ===========================================================================
select is(
  has_function_privilege('anon', 'public.list_my_action_items(uuid)', 'EXECUTE'),
  false,
  'anon cannot EXECUTE list_my_action_items');
select is(
  has_function_privilege('anon', 'public.get_member_overview(uuid)', 'EXECUTE'),
  false,
  'anon cannot EXECUTE get_member_overview');
select is(
  has_function_privilege('authenticated', 'public.list_my_action_items(uuid)', 'EXECUTE'),
  true,
  'authenticated can EXECUTE list_my_action_items');
select is(
  has_function_privilege('authenticated', 'public.get_member_overview(uuid)', 'EXECUTE'),
  true,
  'authenticated can EXECUTE get_member_overview');

-- ===========================================================================
-- list_my_action_items — st_x sees exactly their 2 assigned items (1 case, 1 mtg).
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;

create temp table items on commit drop as
  select jsonb_array_elements(
           public.list_my_action_items((select comm_x from k))) as it;
grant select on items to authenticated;

select is(
  (select count(*)::int from items),
  3,
  'st_x sees exactly 3 assigned action items (1 case + 1 meeting + 1 manual)');

select is(
  (select count(*)::int from items where it->>'source' = 'case'),
  1,
  'one item has source = case');
select is(
  (select count(*)::int from items where it->>'source' = 'meeting'),
  1,
  'one item has source = meeting');
select is(
  (select count(*)::int from items where it->>'source' = 'manual'),
  1,
  'one item has source = manual (shared hub)');

-- The manual item carries NO meeting/case label material (all null) and its own
-- title — proving the manual arm returns null labels.
select ok(
  (select (it->>'meeting_id') is null
     and (it->>'meeting_number') is null
     and (it->>'meeting_scheduled_start') is null
     and (it->>'case_id') is null
     and (it->>'title') = 'Item avulso'
     from items where it->>'source' = 'manual'),
  'the manual item carries null meeting+case labels and its own title');

-- The case item carries case number/label + created_by name; no meeting fields.
select is(
  (select it->>'case_number' from items where it->>'source' = 'case'),
  (select case_number::text from public.cases where id = (select cid from cse)),
  'the case item carries the case_number label material');
select is(
  (select it->>'created_by_name' from items where it->>'source' = 'case'),
  'StaffAdmin X',
  'the case item resolves created_by to the creator display name');

-- The meeting item carries meeting number/scheduled_start; no case fields.
select ok(
  (select (it->>'meeting_number') is not null
     and (it->>'meeting_scheduled_start') is not null
     and (it->>'case_id') is null
     from items where it->>'source' = 'meeting'),
  'the meeting item carries meeting label material and null case fields');

reset role;

-- ===========================================================================
-- list_my_action_items — a source whose flag is OFF is OMITTED (no error).
-- The SHARED arm (meeting + manual) is gated by `action_items` (NOT `meetings`
-- anymore — the meeting arm reads the shared hub post-unification). Turn
-- `action_items` OFF: BOTH the meeting AND manual shared rows drop, leaving only
-- the case item.
-- ===========================================================================
update app.feature_flags set enabled = false where key = 'action_items';

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select jsonb_array_length(
            public.list_my_action_items((select comm_x from k)))),
  1,
  'with `action_items` OFF the union omits the shared meeting+manual items (case item remains)');
reset role;

update app.feature_flags set enabled = true where key = 'action_items';

-- ===========================================================================
-- get_member_overview — the five counts + hints for st_x.
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;

create temp table ov on commit drop as
  select public.get_member_overview((select comm_x from k)) as o;
grant select on ov to authenticated;

select is(
  ((select o from ov)->>'pending_action_items')::int,
  3,
  'pending_action_items counts all three non-terminal items (case + meeting + manual)');
select is(
  ((select o from ov)->>'pending_action_items_overdue')::int,
  1,
  'pending_action_items_overdue counts the one past-due item (the meeting item, due -2)');
select is(
  ((select o from ov)->>'meetings_not_concluded')::int,
  1,
  'meetings_not_concluded counts the attended non-concluded meeting');
select is(
  ((select o from ov)->>'pending_signatures')::int,
  1,
  'pending_signatures counts the presente/em_assinatura unsigned attendee row');
select is(
  ((select o from ov)->>'in_progress_responses')::int,
  1,
  'in_progress_responses counts st_x''s own draft');

reset role;

-- ===========================================================================
-- CASE-ACCESS-OFF ATTRIBUTION — st_x is a PHASE assignee (no grant); the case
-- must STILL count with the `case_access` flag OFF.
-- ===========================================================================
update app.feature_flags set enabled = false where key = 'case_access';

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  ((select public.get_member_overview((select comm_x from k)))->>'cases_not_concluded')::int,
  1,
  'cases_not_concluded counts a phase-attributed case even with case_access OFF');
reset role;

select * from finish();
rollback;
