-- WS-6 · Performance pilot-window sweep — P2, P4, P3. Migration:
-- 20260711000900_perf_sweep_wave2.sql.
--
-- The lock: these assertions fail if a perf-sweep DB object regresses — the P2
-- distinct-actors RPC widening/narrowing the RLS-visible set, get_feature_flags
-- dropping a flag, or either paginating RPC (pqs_inbox / list_cases_board) failing
-- to honor its limit/cursor OR leaking rows past its authz gate.
--
-- Covers:
--   §1 P2  list_audit_filter_actors: returns the DISTINCT actor set, RLS-correct
--          (admin sees all; a staff_admin sees only own-commission actors; scoped
--          to a commission narrows correctly).
--   §2 P4  get_feature_flags: returns EVERY app.feature_flags row as jsonb, values
--          reflect the table, absent key = not present (caller safe-defaults false).
--   §3 P3a pqs_inbox: respects p_limit + the (reported_at,id) keyset cursor AND
--          still enforces the pqs_members org-scope gate (a non-member sees none).
--   §4 P3b list_cases_board: respects p_limit (cap) AND still enforces the
--          is_staff_admin_of gate (a non-admin sees none).
--   §5 the migration's indexes exist.

begin;
select plan(28);

-- Flags ON for the modules exercised (hermetic — do not depend on migration order).
update app.feature_flags set enabled = true where key = 'patient_safety';
update app.feature_flags set enabled = true where key = 'audit_trail';
update app.feature_flags set enabled = true where key = 'cases_multi_phase';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

-- =========================================================================
-- §1 · P2 — list_audit_filter_actors (distinct actors, RLS-correct).
-- =========================================================================
-- The RPC is SECURITY INVOKER, so the `audit_log_select` policy is the authority.
-- That policy scopes commission-tier rows to the commission's staff_admin (a
-- PLATFORM admin reads only platform-tier rows, NOT a commission's) — so the
-- realistic and RLS-correct reader of comm_x's actor set is sa_x. We seed:
--   • sa_x → TWO comm_x rows  (must DISTINCT-collapse to ONE actor option)
--   • a system (no-uid) comm_x row  (→ the null-actor option)
--   • sa_y → a comm_y row      (a DIFFERENT commission → invisible to sa_x)
-- audit_write derives the actor from auth.uid().

-- sa_x writes two comm_x rows (must collapse to a single distinct actor).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select app.audit_write('commission.updated', 'commission', (select comm_x from k),
  (select comm_x from k), 'sa_x row 1', '{}'::jsonb);
select app.audit_write('commission.updated', 'commission', (select comm_x from k),
  (select comm_x from k), 'sa_x row 2', '{}'::jsonb);
reset role;

-- sa_y writes a comm_y row (a DIFFERENT commission → not visible to sa_x).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select app.audit_write('commission.updated', 'commission', (select comm_y from k),
  (select comm_y from k), 'sa_y row', '{}'::jsonb);
reset role;

-- A system (no-uid) row in comm_x → surfaces as the null-actor option.
select set_config('request.jwt.claims', '', true);
select app.audit_write('commission.updated', 'commission', (select comm_x from k),
  (select comm_x from k), 'system row', '{}'::jsonb);

-- sa_x (staff_admin of comm_x) reads: the DISTINCT actor set of comm_x's rows.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

select is(
  (select count(*)::int from public.list_audit_filter_actors(null)
   where actor_id = (select sa_x from k)),
  1, '1.1 P2: sa_x appears exactly ONCE (SELECT DISTINCT de-dupes 2 rows)');
select is(
  (select count(*)::int from public.list_audit_filter_actors(null)
   where actor_id is null),
  1, '1.2 P2: the null/system actor surfaces as one option');
select is(
  (select count(*)::int from public.list_audit_filter_actors(null)
   where actor_id = (select sa_y from k)),
  0, '1.3 P2 RLS: sa_x does NOT see the comm_y-only actor sa_y (INVOKER RLS scope)');

-- Scoped to comm_x explicitly: same visible set for sa_x (sa_x in, sa_y out).
select is(
  (select count(*)::int from public.list_audit_filter_actors((select comm_x from k))
   where actor_id = (select sa_x from k)),
  1, '1.4 P2: p_commission=comm_x includes sa_x');
select is(
  (select count(*)::int from public.list_audit_filter_actors((select comm_x from k))
   where actor_id = (select sa_y from k)),
  0, '1.5 P2: p_commission=comm_x excludes the comm_y-only actor sa_y');
reset role;

-- A non-staff_admin of comm_x (sa_y) reads NONE of comm_x's actors — the INVOKER
-- RLS scope means a foreign reader gets an empty actor set (no leak).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.list_audit_filter_actors((select comm_x from k))
   where actor_id = (select sa_x from k)),
  0, '1.6 P2 RLS: sa_y (foreign to comm_x) sees none of comm_x''s actors');
reset role;

-- =========================================================================
-- §2 · P4 — get_feature_flags returns all flags as jsonb.
-- =========================================================================
-- Flip a known flag to a KNOWN value, then assert the object reflects the whole
-- table (key count matches) and the flipped value round-trips.
update app.feature_flags set enabled = false where key = 'interviews';
update app.feature_flags set enabled = true  where key = 'meetings';

-- Capture the flag-row count AS POSTGRES now (authenticated has NO direct grant on
-- app.feature_flags — that is exactly why get_feature_flags is SECURITY DEFINER).
create temp table ff on commit drop as select count(*)::int as n from app.feature_flags;
grant select on ff to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

select is(
  (select count(*)::int from jsonb_object_keys(public.get_feature_flags())),
  (select n from ff),
  '2.1 P4: get_feature_flags returns EVERY flag key (one object entry per row)');
select is(
  (public.get_feature_flags() ->> 'meetings')::boolean, true,
  '2.2 P4: an ON flag reads true');
select is(
  (public.get_feature_flags() ->> 'interviews')::boolean, false,
  '2.3 P4: an OFF flag reads false');
select ok(
  (public.get_feature_flags() ->> 'no_such_flag') is null,
  '2.4 P4: an absent key is null (caller safe-defaults false)');
reset role;

-- =========================================================================
-- §3 · P3a — pqs_inbox: limit + keyset cursor + org-scope gate.
-- =========================================================================
-- Enroll admin into the hospital PQS roster so pqs_inbox returns its events.
insert into public.memberships (organization_id, hospital_id, principal_id, role, granted_by)
  select (select organization_id from public.hospitals where id = (select hosp_b from k)),
         (select hosp_b from k), (select admin from k), 'pqs_member', (select admin from k);

-- Create THREE events in comm_x with DISTINCT reported_at so the keyset order is
-- deterministic. notify_safety_event stamps reported_at = now(); we override to
-- fixed, well-separated instants after creation to make the ordering assertions robust.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table ev on commit drop as
  select (public.notify_safety_event((select comm_x from k), 'E1', null, 'mild',   null, null, null, null)).id as e1,
         (public.notify_safety_event((select comm_x from k), 'E2', null, 'moderate',null, null, null, null)).id as e2,
         (public.notify_safety_event((select comm_x from k), 'E3', null, 'severe', null, null, null, null)).id as e3;
reset role;
grant select on ev to authenticated;

-- Fixed, ordered reported_at: e3 newest, then e2, then e1 (desc order = e3,e2,e1).
update public.patient_safety_event set reported_at = timestamptz '2026-01-01 10:00:00+00' where id = (select e1 from ev);
update public.patient_safety_event set reported_at = timestamptz '2026-01-02 10:00:00+00' where id = (select e2 from ev);
update public.patient_safety_event set reported_at = timestamptz '2026-01-03 10:00:00+00' where id = (select e3 from ev);

-- ACT (ADR 0106) P0: the earlier pqs_member@hosp_b enrollment (line ~149-151) makes
-- `admin` MULTI-role (platform_admin + pqs_member), so the bare claims_for(admin, true)
-- below can no longer auto-derive a single hat -- pqs_inbox() (now hat-gated, P0 fix)
-- needs the pqs_member hat active to see hosp_b's events.
select test_helpers.claims_for((select admin from k), true, 'pqs_member');
set local role authenticated;

-- Page 1, limit 2: newest two (e3, e2) in that order.
select is(
  (select count(*)::int from public.pqs_inbox(null,null,null,null,null,2)
   where id in (select e1 from ev union all select e2 from ev union all select e3 from ev)),
  2, '3.1 P3a: pqs_inbox honors p_limit=2 (returns 2 of our 3 events)');
select is(
  (select id from public.pqs_inbox(null,null,null,null,null,2)
   where id in (select e1 from ev union all select e2 from ev union all select e3 from ev)
   order by reported_at desc limit 1),
  (select e3 from ev),
  '3.2 P3a: first row of page 1 is the newest event (e3, reported_at desc)');

-- Page 2 via the keyset cursor of e2 (the 2nd row): (2026-01-02, e2). Passing that
-- cursor returns rows strictly AFTER it → e1 only (of our set).
select is(
  (select count(*)::int
   from public.pqs_inbox(null,null,null, timestamptz '2026-01-02 10:00:00+00', (select e2 from ev), 25)
   where id in (select e1 from ev union all select e2 from ev union all select e3 from ev)),
  1, '3.3 P3a: keyset cursor at e2 returns exactly the older tail (e1)');
select is(
  (select id
   from public.pqs_inbox(null,null,null, timestamptz '2026-01-02 10:00:00+00', (select e2 from ev), 25)
   where id in (select e1 from ev union all select e2 from ev union all select e3 from ev)),
  (select e1 from ev),
  '3.4 P3a: the post-cursor row is e1 (strictly older than the cursor)');
select ok(
  (select count(*) from public.pqs_inbox(null,null,null, timestamptz '2026-01-02 10:00:00+00', (select e2 from ev), 25)
   where id = (select e2 from ev)) = 0,
  '3.5 P3a: the cursor row itself (e2) is EXCLUDED (strictly-after semantics)');
reset role;

-- Org-scope gate: a non-PQS caller (sa_y — not enrolled) sees NONE of the events.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.pqs_inbox(null,null,null,null,null,25)),
  0, '3.6 P3a RLS: a non-PQS caller gets an empty inbox (org-scope gate intact)');
reset role;

-- =========================================================================
-- §4 · P3b — list_cases_board: cap (p_limit) + is_staff_admin_of gate.
-- =========================================================================
-- Three cases in comm_x. NB the mint_case_number_trg BEFORE-INSERT trigger OVERWRITES
-- any explicit case_number with (max per commission)+1, so we cannot assume literal
-- numbers — capture the actual assigned ones. They are strictly ascending in insert
-- order, so the LAST inserted (cx3) has the highest case_number and heads the board.
insert into public.cases (id, commission_id, label, created_by)
  values (gen_random_uuid(), (select comm_x from k), 'B1', (select sa_x from k));
insert into public.cases (id, commission_id, label, created_by)
  values (gen_random_uuid(), (select comm_x from k), 'B2', (select sa_x from k));
insert into public.cases (id, commission_id, label, created_by)
  values (gen_random_uuid(), (select comm_x from k), 'B3', (select sa_x from k));

create temp table cx on commit drop as
  select array_agg(case_number order by case_number) as nums,
         max(case_number) as top_num
  from public.cases
  where commission_id = (select comm_x from k) and label in ('B1','B2','B3');
grant select on cx to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

-- p_limit caps the row count: limit 2 over our 3 (+ any) returns at most 2.
select is(
  (select count(*)::int from public.list_cases_board((select comm_x from k), 2)),
  2, '4.1 P3b: list_cases_board honors p_limit=2 (caps the board)');

-- The cap keeps the MOST RECENT by case_number desc: with limit 1, the single row is
-- the highest case_number present — which is our newest seed (cx.top_num), as these
-- were the last cases created in comm_x.
select is(
  (select case_number from public.list_cases_board((select comm_x from k), 1)),
  (select top_num from cx),
  '4.2 P3b: the cap keeps the newest case (highest case_number heads the board)');

-- A larger limit returns all three of our seeded cases (all readable to sa_x).
select is(
  (select count(*)::int from public.list_cases_board((select comm_x from k), 200)
   where case_number in (select unnest(nums) from cx)),
  3, '4.3 P3b: a generous limit returns all our seeded comm_x cases');
reset role;

-- Gate: a non-staff_admin of comm_x (sa_y) gets NOTHING (is_staff_admin_of gate).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.list_cases_board((select comm_x from k), 200)),
  0, '4.4 P3b RLS: a non-staff_admin of comm_x sees an empty board (gate intact)');
reset role;

-- §4b · P4 — count_open_cases_for_board MUST equal the board's open-row count for a
--       coordinator (same is_staff_admin_of gate + commission scope + terminal filter),
--       and be 0 for a non-coordinator. Our 3 seeds (B1/B2/B3) have no phases → status
--       defaults to the open 'not_started', so all 3 are open.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

-- The counter equals the board's own non-terminal row count (the exact quantity the
-- badge derived via board.filter(open).length) — the parity that makes it a safe swap.
select is(
  public.count_open_cases_for_board((select comm_x from k)),
  (select count(*)::int from public.list_cases_board((select comm_x from k), 200)
   where status not in ('completed', 'cancelled')),
  '4.5 P4: count_open_cases_for_board == the board''s open-row count (visibility parity)');

-- And it counts our 3 open seeds (a concluding case would drop out).
select is(
  (select public.count_open_cases_for_board((select comm_x from k))
   >= 3),
  true, '4.6 P4: the counter includes our 3 open seeds (nao_iniciado)');
reset role;

-- Gate: a non-staff_admin of comm_x (sa_y) gets 0 (same is_staff_admin_of gate as the
-- board — the counter returns before counting, never leaking a cross-commission tally).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  public.count_open_cases_for_board((select comm_x from k)),
  0, '4.7 P4 RLS: a non-staff_admin of comm_x gets 0 from the counter (gate intact)');
reset role;

-- =========================================================================
-- §5 · The migration's keyset indexes exist.
-- =========================================================================
select has_index('public', 'responses', 'responses_commission_submitted_keyset_idx',
  '5.1 responses keyset index exists');
select has_index('public', 'meetings', 'meetings_commission_scheduled_keyset_idx',
  '5.2 meetings keyset index exists');
select has_index('public', 'case_referral', 'case_referral_source_created_keyset_idx',
  '5.3 case_referral source keyset index exists');
select has_index('public', 'case_referral', 'case_referral_target_created_keyset_idx',
  '5.4 case_referral target keyset index exists');
select has_index('public', 'patient_safety_event', 'patient_safety_event_reported_keyset_idx',
  '5.5 patient_safety_event keyset index exists');

select * from finish();
rollback;
