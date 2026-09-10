-- =============================================================================
-- GRANT-PLANE-CONVENTION — the grant door refuses a WRITE grant on a TERMINAL case.
-- ADR 0205 D9 (PO ruling, 2026-09-10).
--
-- WHAT THIS PROVES. `public.grant_case_access` had NO lifecycle check: the UI greyed
-- out "Edição" on a closed case, and the door stored the write grant anyway — inert
-- only because the CONTENT tables refuse writes on a terminal case. The refusal now
-- lives in the door, as a new SQLSTATE `HC0U0`.
--
-- ⛔ SCOPE, stated so a reader does not infer more than is asserted:
--   · the refusal is on the DOOR, not on `app._case_caps` (ADR 0078 A24·3 — no
--     lifecycle step in the resolver) and not on `app._grant_case_access_unchecked`
--     (the creator self-grant path). Neither is touched, and neither is asserted here.
--   · READ grants on a terminal case STAY LEGAL (ADR 0033 D6; e2e `case-access`
--     AC-3d depends on it) — K3 is that paired positive (§7.7): a narrowing that
--     refused everyone would pass K1/K2 by construction.
--
-- ⭐ THE FIXTURE IS THE TRAP. Every precondition the door checks BEFORE the new one
-- (authority → exclusion → self-grant `HC0U1` [since 20261003007380, pgTAP 417] → level →
-- grantee membership → future expiry) is asserted
-- to hold before the arm runs, so a red is the STATUS refusal and never a coincidence:
-- the coordinator really is a coordinator, the grantee really is a member, and the
-- coordinator really is not recused. Without P4–P7 a wrong-arm fixture would raise
-- 42501 / HC0F1 / HC021 and `throws_ok` would report a different code, not a pass —
-- but the pre-flight is what makes the diagnosis immediate.
--
-- ⚠ RED-FIRST HONESTY (§7.1). Against the PRE-migration catalog K1 and K2 are RED
-- (the door lived, no exception). K5/K5b are GREEN before AND after: they pin the
-- ORDERING (authority still wins), and ordering cannot be violated by a check that
-- does not exist yet. They are declared CONTROLS, not keystones — their discriminating
-- twin is K1, which is the identical (case, level) pair asked by a COORDINATOR.
-- =============================================================================
begin;
select plan(23);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,     -- coordinator (staff_admin) of comm_x
         (v->>'st_x')::uuid   as st_x,     -- plain member of comm_x
         (v->>'st_x2')::uuid  as st_x2,    -- plain member of comm_x
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- ── FIXTURE: three cases in comm_x — completed, cancelled, and open. ─────────
-- `cases_closed_at_paired` forces closed_at non-null on a terminal status, so the
-- terminal rows are constructed exactly as a real close/cancel leaves them.
insert into public.cases (id, commission_id, case_number, created_by, status, closed_at)
values ('00000000-0000-0000-0000-000000416001', (select comm_x from k), 96001,
        (select sa_x from k), 'completed', now()),
       ('00000000-0000-0000-0000-000000416002', (select comm_x from k), 96002,
        (select sa_x from k), 'cancelled', now());

insert into public.cases (id, commission_id, case_number, created_by)
values ('00000000-0000-0000-0000-000000416003', (select comm_x from k), 96003,
        (select sa_x from k));

-- ===========================================================================
-- ⭐ PRE-FLIGHT — every gate UPSTREAM of the new one is asserted to hold.
-- ===========================================================================
select is(app.case_is_terminal('00000000-0000-0000-0000-000000416001'), true,
  'P1 ⭐: the completed case IS terminal — a K1 red is the status refusal, not a mis-built fixture');
select is(app.case_is_terminal('00000000-0000-0000-0000-000000416002'), true,
  'P2 ⭐: the cancelled case IS terminal');
select is(app.case_is_terminal('00000000-0000-0000-0000-000000416003'), false,
  'P3 ⭐: the control case is NOT terminal — K4 measures the open lane');
select is(app.is_staff_admin_of_for((select comm_x from k), (select sa_x from k)), true,
  'P4 ⭐: sa_x IS a coordinator of comm_x — a failure below is the status gate, not authority (42501)');
select is(app.is_member_of_for((select comm_x from k), (select st_x from k)), true,
  'P5 ⭐: st_x IS a member of comm_x — the grantee-membership gate (HC021) cannot pre-empt');
select is(app.is_member_of_for((select comm_x from k), (select st_x2 from k)), true,
  'P6 ⭐: st_x2 IS a member of comm_x');
select is(app.is_case_excluded('00000000-0000-0000-0000-000000416001', (select sa_x from k)), false,
  'P7 ⭐: the coordinator is NOT excluded from the case — the U1 exclusion (HC0F1) cannot pre-empt');
select is(app.is_staff_admin_of_for((select comm_x from k), (select st_x from k)), false,
  'P8 ⭐ (K5): st_x holds NO coordinator authority — the 42501 below is genuine');
select is(app.is_tenancy_admin_of_for((select comm_x from k), (select st_x from k)), false,
  'P9 ⭐ (K5): …nor the tenancy-admin arm — the door''s authority disjunction is fully denied for st_x');

-- ===========================================================================
-- K1 · THE HEADLINE — a WRITE grant on a COMPLETED case is refused (HC0U0).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-000000416001',
      (select st_x from k), 'write')$$,
  'HC0U0', null,
  'K1 ⭐ ADR 0205 D9: a WRITE grant on a COMPLETED case is refused by the door (HC0U0)');
reset role;

select is(
  (select count(*)::int from public.case_access_grants
    where case_id = '00000000-0000-0000-0000-000000416001'
      and principal_id = (select st_x from k)),
  0,
  'K1b ⭐: …and NOTHING was written — the refusal precedes the kernel, it does not undo it');

-- ===========================================================================
-- K2 · The second terminal status. `cancelled` is not a synonym reachable by
-- accident: app.case_is_terminal names both, and both must refuse.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-000000416002',
      (select st_x from k), 'write')$$,
  'HC0U0', null,
  'K2 ⭐: a WRITE grant on a CANCELLED case is refused too (both terminal statuses)');
reset role;

-- ===========================================================================
-- K3 · PAIRED POSITIVE (§7.7) — READ on a terminal case STAYS legal (ADR 0033 D6).
-- Without this, a door that refused every grant on a closed case would pass K1+K2.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-000000416001',
      (select st_x from k), 'read')$$,
  'K3 ⭐ POSITIVE TWIN: a READ grant on a TERMINAL case still LIVES (ADR 0033 D6; e2e AC-3d)');
reset role;

select is(
  (select write_case_content from public.case_access_grants
    where case_id = '00000000-0000-0000-0000-000000416001'
      and principal_id = (select st_x from k) and revoked_at is null),
  false,
  'K3b: the surviving grant is READ — write_case_content is false on the stored row');
select is(app.has_case_capability('00000000-0000-0000-0000-000000416001',
        (select st_x from k), 'read_case_content'), true,
  'K3c ⭐: …and it confers REAL reach — "lives_ok" alone would pass on a grant that landed inert');

-- ===========================================================================
-- K4 · CONTROL — the OPEN lane is untouched: a write grant still succeeds.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-000000416003',
      (select st_x2 from k), 'write')$$,
  'K4 ⭐ CONTROL: a WRITE grant on an OPEN case still LIVES — the refusal is status-scoped');
reset role;

select is(
  (select write_case_content from public.case_access_grants
    where case_id = '00000000-0000-0000-0000-000000416003'
      and principal_id = (select st_x2 from k) and revoked_at is null),
  true,
  'K4b: …and the open-case grant really carries write_case_content');

-- ===========================================================================
-- K5 · ORDERING PIN (a CONTROL, green before and after — see the header). The new
-- refusal sits AFTER authority: a non-coordinator on a terminal case must still be
-- told 42501, never HC0U0. Placing the status check first would leak "this case is
-- closed" to a principal with no standing on the case at all.
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-000000416001',
      (select st_x2 from k), 'write')$$,
  '42501', null,
  'K5 ⭐ ORDERING: a NON-coordinator asking for WRITE on a terminal case gets 42501, not HC0U0');
select throws_ok(
  $$select public.grant_case_access('00000000-0000-0000-0000-000000416001',
      (select st_x2 from k), 'read')$$,
  '42501', null,
  'K5b: …and the same at level READ — authority precedes every later validation');
reset role;

-- ===========================================================================
-- K6 · SCOPE PIN — REVOKE on a terminal case is NOT affected. The ruling narrows
-- one level of one door; a reader must be able to see that the rest is unchanged.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$select public.revoke_case_access('00000000-0000-0000-0000-000000416001',
      (select st_x from k))$$,
  'K6 ⭐ SCOPE: revoke_case_access on a TERMINAL case still LIVES — only grant/write is narrowed');
reset role;

-- ===========================================================================
-- K7 · THE DOOR'S SHAPE DID NOT MOVE. A `create or replace` cannot change these,
-- but a re-emitted body written from stale text could — so they are measured from
-- the catalog rather than assumed (ADR 0078: the catalog is the sole truth).
-- ===========================================================================
select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'grant_case_access'),
  true,
  'K7a ⭐: grant_case_access is still SECURITY DEFINER (its gate REPLACES RLS — LEARN-074)');
select ok(
  has_function_privilege('authenticated',
    'public.grant_case_access(uuid,uuid,text,timestamp with time zone,text,boolean,boolean)'::regprocedure,
    'EXECUTE')
  and has_function_privilege('service_role',
    'public.grant_case_access(uuid,uuid,text,timestamp with time zone,text,boolean,boolean)'::regprocedure,
    'EXECUTE'),
  'K7b: the EXECUTE grants to authenticated + service_role survive the replace');
select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace,
          lateral unnest(coalesce(p.proacl, '{}'::aclitem[])) a
    where n.nspname = 'public' and p.proname = 'grant_case_access'
      and a::text like '=%'),
  0,
  'K7c ⭐: PUBLIC still holds NO EXECUTE on the door (the REVOKE ALL FROM PUBLIC posture)');

select * from finish();
rollback;
