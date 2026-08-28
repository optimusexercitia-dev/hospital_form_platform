-- ============================================================================
-- AE0.2 — EXPLAIN (ANALYZE, BUFFERS) baselines for the named authorization
--         hot paths.  Authority: ADR 0155; plan docs/plans/authz-evolution.md.
--
-- Recorded output:  docs/design/authz-evolution-baselines-ae0.md
--
-- RUN IT (from the repo root, on a FRESH `supabase db reset --local`):
--
--   docker exec -i supabase_db_azkbbhskturikxpgmafq \
--     psql -U postgres -d postgres -X -f - \
--     < scripts/authz-explain-baselines-ae0.sql
--
-- ============================================================================
-- WHAT THIS FILE IS FOR
-- ----------------------------------------------------------------------------
-- These baselines exist to detect PLAN-SHAPE REGRESSIONS across later AE
-- phases — index scan degrading to seq scan, an InitPlan (evaluated once)
-- becoming a per-row function invocation, a hoisted predicate un-hoisting.
-- They are taken on LOCAL, SEED-SIZED data and are NOT production latency
-- figures.  A seq scan here may be the correct plan at 8 rows and the wrong
-- one at 8 000; rows flagged SEQ-SCAN-AT-SEED-SIZE in the recorded doc must
-- not be read as clean baselines.
--
-- ----------------------------------------------------------------------------
-- THE TRAP THIS FILE IS BUILT AROUND
-- ----------------------------------------------------------------------------
-- A plan captured as `postgres` is worthless: RLS is not applied to a
-- superuser, so it baselines a query that does not exist in production.
-- Every path below is interesting *because* of its RLS predicates and its
-- SECURITY DEFINER gates.  So every measured statement runs under a real
-- `authenticated` session context, and section 1 is a POSITIVE CONTROL that
-- must show the contexts discriminate before any baseline is trusted.
--
-- ----------------------------------------------------------------------------
-- HOW THE SESSION CONTEXT IS ESTABLISHED
-- ----------------------------------------------------------------------------
-- The pgTAP suites use `test_helpers.claims_for(uuid, boolean, text)` +
-- `set local role authenticated` (supabase/tests/00_setup.sql:392-428).  That
-- schema is created by 00_setup.sql when pg_prove runs — it does NOT exist on
-- a bare `db reset`, and creating it here would leave a committed schema
-- behind.  So this file inlines the claims payload `claims_for` mints, key for
-- key:
--
--     {"sub": <uuid>, "role": "authenticated", "is_admin": <bool>
--      [, "active_role": <role>] }
--
-- `active_role` is LOAD-BEARING, not decoration.  `app.has_role` /
-- `app.has_role_any` end in
--     and (p_user_id is distinct from auth.uid()
--          or m.role is not distinct from app.active_role())
-- so for a self-query every `app.is_*_of()` returns FALSE without it and every
-- ALLOW arm fails for the wrong reason.  Section 1 proves this empirically.
--
-- `session_id` is minted only where a door needs it (none of the paths here
-- do; `public.assume_role` would).
--
-- ----------------------------------------------------------------------------
-- THE STACK MUST BE UNMUTATED WHEN THIS FINISHES
-- ----------------------------------------------------------------------------
-- `EXPLAIN ANALYZE` EXECUTES the statement.  For the grant and revoke doors
-- that is a real `memberships` write plus an `audit_log` row.  Every mutating
-- rep therefore lives in its OWN `begin; … rollback;` — its own, so that all
-- three reps start from an identical state (a shared transaction would make
-- rep 1 an INSERT and reps 2-3 an ON CONFLICT DO UPDATE, i.e. three reps of
-- three different statements).  Sections 0 and 9 take the same row-count
-- census before and after; they must agree, and section 9 raises if they do
-- not.  Read-only paths keep their three reps inside one transaction so rep 1
-- pays the cold-cache cost and reps 2-3 are warm — that difference is signal,
-- and the recorded doc reports all three.
--
-- ----------------------------------------------------------------------------
-- SHAPE-OPAQUE PATHS (stated, not worked around)
-- ----------------------------------------------------------------------------
-- A `SECURITY DEFINER` function is never inlined, so `EXPLAIN` of a call to
-- one yields a bare `Result` / `Function Scan` node: total time, accumulated
-- buffers and row count are real (nested SPI buffers DO accumulate into the
-- calling node), but the BODY's plan shape is invisible.  That affects P1,
-- P2c, P4, P6 and P7.  For those, PASS B below re-runs the same statement
-- under `auto_explain` with `log_nested_statements = on`, which prints the
-- body plans.  ⛔ PASS B is OPT-IN (`-v NESTED=1`) because for a per-row
-- predicate it explodes: `list_cases_board` emits ~4 200 log lines, a plain
-- `select * from public.cases` ~5 400.  Never substitute a different query
-- for a named path — a missing baseline is honest, a mislabelled one poisons
-- every later comparison.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off
\pset pager off

-- Fixture identifiers (all from supabase/seed.sql; see the recorded doc's
-- principal table for why each was chosen).
\set ORG_A            '0c000000-0000-0000-0000-00000000000a'
\set HOSP_A1          '05000000-0000-0000-0000-00000000000a'
\set CCIH             'a0000000-0000-0000-0000-0000000000a1'
\set FORM_CCIH        'f0000000-0000-0000-0000-00000000a001'

-- ⛔ psql's \set swallows the rest of the line, comment included — a trailing
--    `-- ...` becomes part of the VALUE.  Keep these lines bare.
--      P_STAFF3_CCIH = staff3.ccih@test.local  (staff of CCIH; P7 revoke target)
--      P_STAFF1_FARM = staff1.farm@test.local  (staff of Farmacia, Rede A;
--                      holds NO CCIH membership, so P6 always takes the INSERT arm)
\set P_STAFF3_CCIH    '00000000-0000-0000-0000-000000000009'
\set P_STAFF1_FARM    '00000000-0000-0000-0000-000000000006'

-- Claims payloads, one per principal.  Kept on ONE line each so a CRLF
-- checkout cannot smuggle a \r into a literal, and bare (no trailing comment)
-- because \set swallows the rest of the line.
--   C_CHEFE_CCIH   chefe.ccih@test.local        ...0002  staff_admin of CCIH
--   C_STAFF1_CCIH  staff1.ccih@test.local       ...0003  staff of CCIH
--   C_MULTI        multi@test.local             ...0008  staff of TWO commissions, Rede A
--   C_ORGADMIN_A   orgadmin.a@test.local        ...00b1  org_admin of Rede A
--   C_ORGADMIN_B   orgadmin.b@test.local        ...00b2  org_admin of Rede B (foreign-org control)
--   C_HOSPADMIN_A1 hospitaladmin.a1@test.local  ...00e1  hospital_admin of Hospital A1
\set C_CHEFE_CCIH   '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","is_admin":false,"active_role":"staff_admin"}'
\set C_STAFF1_CCIH  '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","is_admin":false,"active_role":"staff"}'
\set C_MULTI        '{"sub":"00000000-0000-0000-0000-000000000008","role":"authenticated","is_admin":false,"active_role":"staff"}'
\set C_ORGADMIN_A   '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated","is_admin":false,"active_role":"org_admin"}'
\set C_ORGADMIN_B   '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated","is_admin":false,"active_role":"org_admin"}'
\set C_HOSPADMIN_A1 '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated","is_admin":false,"active_role":"hospital_admin"}'
-- Control variant: the SAME principal as C_CHEFE_CCIH with the active_role key
-- absent.  Used only in section 1.
\set C_CHEFE_NOHAT  '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","is_admin":false}'


\echo '################################################################'
\echo '## SECTION 0 — PREFLIGHT CENSUS (compared again in section 9)  ##'
\echo '################################################################'

drop table if exists pg_temp.ae0_census_before;
create temp table ae0_census_before as
select 'schema_migrations'         as t, count(*)::bigint n from supabase_migrations.schema_migrations
union all select 'memberships',               count(*) from public.memberships
union all select 'audit_log',                 count(*) from public.audit_log
union all select 'profiles',                  count(*) from public.profiles
union all select 'cases',                     count(*) from public.cases
union all select 'meetings',                  count(*) from public.meetings
union all select 'commissions',               count(*) from public.commissions
union all select 'organization_affiliations', count(*) from public.organization_affiliations
union all select 'hospital_affiliations',     count(*) from public.hospital_affiliations
union all select 'responses',                 count(*) from public.responses;

select t, n from pg_temp.ae0_census_before order by t;

select 'migration head' as k, max(version) as v from supabase_migrations.schema_migrations;
select 'server_version' as k, current_setting('server_version') as v;


\echo ''
\echo '################################################################'
\echo '## SECTION 1 — POSITIVE CONTROL                               ##'
\echo '##  Nothing below section 1 is trustworthy unless these five  ##'
\echo '##  readings DIFFER.  If they agree, the session context is   ##'
\echo '##  not being applied and every baseline in this file is      ##'
\echo '##  vacuous.                                                  ##'
\echo '################################################################'

drop table if exists pg_temp.ae0_control;
create temp table ae0_control(arm text, cases bigint, meetings bigint, profiles bigint, memberships bigint, is_member_ccih boolean);
-- The control rows are written from inside the persona blocks, so the temp
-- table needs its own grant — otherwise the insert fails on PERMISSIONS and
-- the control would look broken for a reason that has nothing to do with RLS
-- (the lesson pinned in supabase/tests/381_containment_actor_dimension.sql:45).
grant insert, select on ae0_control to authenticated;

-- 1a — the INTENDED principal for the case-list baseline.
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_CHEFE_CCIH';
  insert into pg_temp.ae0_control
  select '1a chefe.ccih / hat=staff_admin (INTENDED)',
         (select count(*) from public.cases),
         (select count(*) from public.meetings),
         (select count(*) from public.profiles),
         (select count(*) from public.memberships),
         app.is_member_of(:'CCIH');
  reset role;
commit;

-- 1b — a principal that must see (almost) nothing of Rede A: Rede B's org admin.
--      ⛔ Note this is a DIFFERENT-ORG principal, not a "cross-org persona":
--      no seeded persona holds anything outside its home org, and none is
--      claimed to here.
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_ORGADMIN_B';
  insert into pg_temp.ae0_control
  select '1b orgadmin.b / hat=org_admin (FOREIGN ORG)',
         (select count(*) from public.cases),
         (select count(*) from public.meetings),
         (select count(*) from public.profiles),
         (select count(*) from public.memberships),
         app.is_member_of(:'CCIH');
  reset role;
commit;

-- 1c — the SAME principal as 1a with the active_role claim ABSENT.  This is
--      the sharpest control: it proves the hat, not merely the sub, is what
--      the policies read.  If 1c equals 1a, the claims GUC is not reaching
--      app.active_role().
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_CHEFE_NOHAT';
  insert into pg_temp.ae0_control
  select '1c chefe.ccih / NO active_role claim',
         (select count(*) from public.cases),
         (select count(*) from public.meetings),
         (select count(*) from public.profiles),
         (select count(*) from public.memberships),
         app.is_member_of(:'CCIH');
  reset role;
commit;

-- 1d — authenticated with no claims at all.
begin;
  set local role authenticated;
  insert into pg_temp.ae0_control
  select '1d authenticated / NO claims',
         (select count(*) from public.cases),
         (select count(*) from public.meetings),
         (select count(*) from public.profiles),
         (select count(*) from public.memberships),
         app.is_member_of(:'CCIH');
  reset role;
commit;

-- 1e — THE TRAP, made visible: postgres, RLS bypassed.  These are the numbers
--      a naive baseline would have measured.
insert into pg_temp.ae0_control
select '1e postgres / RLS BYPASSED (the trap)',
       (select count(*) from public.cases),
       (select count(*) from public.meetings),
       (select count(*) from public.profiles),
       (select count(*) from public.memberships),
       null::boolean;

select * from pg_temp.ae0_control order by arm;

-- Fail loudly rather than record vacuous baselines.
do $$
declare v_distinct int;
begin
  select count(distinct (cases, meetings, profiles, memberships))
    into v_distinct from pg_temp.ae0_control;
  if v_distinct < 4 then
    raise exception
      'AE0.2 POSITIVE CONTROL FAILED: only % distinct readings across 5 arms — session context is not being applied; every baseline below would be vacuous',
      v_distinct;
  end if;
  raise notice 'AE0.2 positive control OK: % distinct readings across 5 arms', v_distinct;
end $$;


\echo ''
\echo '################################################################'
\echo '## PASS A — EXPLAIN (ANALYZE, BUFFERS), 3 reps per path       ##'
\echo '################################################################'

-- ---------------------------------------------------------------------------
-- P1 — SESSION-CONTEXT RPC.  public.session_context() — DEFINER, STABLE,
--      hat-BLIND by design (ADR 0106 D9): it returns the caller's full grant
--      list regardless of the active hat, because the role picker needs the
--      hats there are to switch TO.
--      Principal: multi@test.local — the richest grants payload in the seed
--      (staff of two commissions, both Rede A).
--      SHAPE-OPAQUE under Pass A (DEFINER ⇒ not inlined).  Pass B has the body.
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== P1 session_context() — principal multi@test.local, hat=staff ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_MULTI';
\echo '--- P1 rep 1 ---'
  explain (analyze, buffers, verbose) select public.session_context();
\echo '--- P1 rep 2 ---'
  explain (analyze, buffers, verbose) select public.session_context();
\echo '--- P1 rep 3 ---'
  explain (analyze, buffers, verbose) select public.session_context();
  reset role;
rollback;


-- ---------------------------------------------------------------------------
-- P2a — CASE LIST, the `cases` table under RLS, as a plain MEMBER.
--       This is the path that actually pays `app.can_read_case` →
--       `app._case_caps` per row: the staff_admin arm of the permissive
--       sibling policy `cases_staff_admin_write` (FOR ALL) short-circuits for
--       a coordinator, so a coordinator-only baseline would measure a
--       different query.  Both arms are baselined; this is the expensive one.
--       Principal: staff1.ccih (staff, CCIH).
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== P2a cases under RLS — principal staff1.ccih, hat=staff (MEMBER arm) ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_STAFF1_CCIH';
\echo '--- P2a rep 1 ---'
  explain (analyze, buffers) select * from public.cases;
\echo '--- P2a rep 2 ---'
  explain (analyze, buffers) select * from public.cases;
\echo '--- P2a rep 3 ---'
  explain (analyze, buffers) select * from public.cases;
  reset role;
rollback;

-- ---------------------------------------------------------------------------
-- P2b — CASE LIST, the `cases` table under RLS, as the COORDINATOR.
--       Principal: chefe.ccih (staff_admin, CCIH).
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== P2b cases under RLS — principal chefe.ccih, hat=staff_admin (COORDINATOR arm) ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_CHEFE_CCIH';
\echo '--- P2b rep 1 ---'
  explain (analyze, buffers) select * from public.cases;
\echo '--- P2b rep 2 ---'
  explain (analyze, buffers) select * from public.cases;
\echo '--- P2b rep 3 ---'
  explain (analyze, buffers) select * from public.cases;
  reset role;
rollback;

-- ---------------------------------------------------------------------------
-- P2c — CASE LIST, the product surface: listCasesBoard()
--       (src/lib/queries/cases.ts:1581) calls
--       `list_cases_board(p_commission_id, p_limit)` with p_limit =
--       CASES_BOARD_CAP = 200 (cases.ts:1338).
--       SHAPE-OPAQUE under Pass A; Pass B is impractical here (~4 200 nested
--       log lines from the per-row resolver) — recorded as such.
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== P2c list_cases_board(CCIH, 200) — principal chefe.ccih, hat=staff_admin ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_CHEFE_CCIH';
\echo '--- P2c rep 1 ---'
  explain (analyze, buffers) select * from public.list_cases_board(:'CCIH', 200);
\echo '--- P2c rep 2 ---'
  explain (analyze, buffers) select * from public.list_cases_board(:'CCIH', 200);
\echo '--- P2c rep 3 ---'
  explain (analyze, buffers) select * from public.list_cases_board(:'CCIH', 200);
  reset role;
rollback;


-- ---------------------------------------------------------------------------
-- P3 — MEETING LIST.  listMeetings() (src/lib/queries/meetings.ts:536) is a
--      direct keyset read of `meetings` under RLS — no RPC.  Projection =
--      MEETING_LIST_COLUMNS (meetings.ts:500), embed
--      `commission_meeting_types:meeting_type_id(name,color_token)` rendered
--      here as the left join PostgREST issues.  First page: no cursor,
--      limit = DEFAULT_PAGE_SIZE (25, src/lib/types/pagination.ts:34) + 1
--      over-fetch.
--      Principal: chefe.ccih (staff_admin, CCIH).
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== P3 meetings first page — principal chefe.ccih, hat=staff_admin ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_CHEFE_CCIH';
\echo '--- P3 rep 1 ---'
  explain (analyze, buffers)
  select m.id, m.commission_id, m.meeting_number, m.title, m.status, m.modality,
         m.meeting_type_id, m.scheduled_start, m.scheduled_end, m.location_text,
         m.meeting_url, m.quorum_met, m.created_by, m.created_at, m.updated_at,
         mt.name, mt.color_token
    from public.meetings m
    left join public.commission_meeting_types mt on mt.id = m.meeting_type_id
   where m.commission_id = :'CCIH'
   order by m.scheduled_start desc, m.id desc
   limit 26;
\echo '--- P3 rep 2 ---'
  explain (analyze, buffers)
  select m.id, m.commission_id, m.meeting_number, m.title, m.status, m.modality,
         m.meeting_type_id, m.scheduled_start, m.scheduled_end, m.location_text,
         m.meeting_url, m.quorum_met, m.created_by, m.created_at, m.updated_at,
         mt.name, mt.color_token
    from public.meetings m
    left join public.commission_meeting_types mt on mt.id = m.meeting_type_id
   where m.commission_id = :'CCIH'
   order by m.scheduled_start desc, m.id desc
   limit 26;
\echo '--- P3 rep 3 ---'
  explain (analyze, buffers)
  select m.id, m.commission_id, m.meeting_number, m.title, m.status, m.modality,
         m.meeting_type_id, m.scheduled_start, m.scheduled_end, m.location_text,
         m.meeting_url, m.quorum_met, m.created_by, m.created_at, m.updated_at,
         mt.name, mt.color_token
    from public.meetings m
    left join public.commission_meeting_types mt on mt.id = m.meeting_type_id
   where m.commission_id = :'CCIH'
   order by m.scheduled_start desc, m.id desc
   limit 26;
  reset role;
rollback;


-- ---------------------------------------------------------------------------
-- P4 — COMMISSION DASHBOARD AGGREGATES.
--      The dashboard page issues `dashboard_form_totals(p_commission_id,
--      p_from, p_to)` for the form picker (dashboard.ts:355) and then seven
--      `p_form_id`-scoped RPCs in one Promise.all (dashboard.ts:384).
--      Two are baselined: the commission-scoped picker (P4a) and the largest
--      of the seven, `dashboard_distributions` (P4b).  Range = the page
--      default (no ?from/?to ⇒ both NULL).
--      ⛔ `commission_overview()` is NOT this path — it is org_admin-scoped
--      and backs /manage/painel.  It is baselined separately as P4c so the
--      label stays honest.
--      SHAPE-OPAQUE under Pass A; Pass B has the bodies.
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== P4a dashboard_form_totals(CCIH, null, null) — principal chefe.ccih, hat=staff_admin ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_CHEFE_CCIH';
\echo '--- P4a rep 1 ---'
  explain (analyze, buffers) select * from public.dashboard_form_totals(:'CCIH', null, null);
\echo '--- P4a rep 2 ---'
  explain (analyze, buffers) select * from public.dashboard_form_totals(:'CCIH', null, null);
\echo '--- P4a rep 3 ---'
  explain (analyze, buffers) select * from public.dashboard_form_totals(:'CCIH', null, null);
  reset role;
rollback;

\echo ''
\echo '=== P4b dashboard_distributions(FORM_CCIH, null, null) — principal chefe.ccih, hat=staff_admin ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_CHEFE_CCIH';
\echo '--- P4b rep 1 ---'
  explain (analyze, buffers) select * from public.dashboard_distributions(:'FORM_CCIH', null, null);
\echo '--- P4b rep 2 ---'
  explain (analyze, buffers) select * from public.dashboard_distributions(:'FORM_CCIH', null, null);
\echo '--- P4b rep 3 ---'
  explain (analyze, buffers) select * from public.dashboard_distributions(:'FORM_CCIH', null, null);
  reset role;
rollback;

\echo ''
\echo '=== P4c commission_overview() — principal orgadmin.a, hat=org_admin (ORG panel, not the commission dashboard) ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_ORGADMIN_A';
\echo '--- P4c rep 1 ---'
  explain (analyze, buffers) select * from public.commission_overview();
\echo '--- P4c rep 2 ---'
  explain (analyze, buffers) select * from public.commission_overview();
\echo '--- P4c rep 3 ---'
  explain (analyze, buffers) select * from public.commission_overview();
  reset role;
rollback;


-- ---------------------------------------------------------------------------
-- P5a — PERSON ROSTER, listOrgUsers (src/lib/queries/org-users.ts:447).
--       ⛔ It does NOT call list_org_people (ADR 0154 rejected that: the RPC
--       emits a person.cpf_lookup audit row per call).  It is a TWO-STEP read:
--         (i)  organization_affiliations → the id scope
--              (affiliations.ts:245 listOrgAffiliationTenses)
--         (ii) profiles .in('id', scope) + PROFILE_SELECT (org-users.ts:54),
--              ordered by full_name, .range(0, 19)  [PAGE_SIZE = 20,
--              src/app/o/[org]/manage/usuarios/page.tsx:25]
--       The id set is materialised into a literal uuid[] with \gset so the
--       page read carries the same `= ANY (array)` shape PostgREST sends,
--       while the file stays reset-stable.
--       Principal: orgadmin.a (org_admin, Rede A).
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== P5a listOrgUsers — principal orgadmin.a, hat=org_admin ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_ORGADMIN_A';

\echo '--- P5a step (i) organization_affiliations scope read — rep 1 ---'
  explain (analyze, buffers)
  select principal_id, ended_on from public.organization_affiliations
   where organization_id = :'ORG_A' and voided_at is null and ended_on is null;
\echo '--- P5a step (i) rep 2 ---'
  explain (analyze, buffers)
  select principal_id, ended_on from public.organization_affiliations
   where organization_id = :'ORG_A' and voided_at is null and ended_on is null;
\echo '--- P5a step (i) rep 3 ---'
  explain (analyze, buffers)
  select principal_id, ended_on from public.organization_affiliations
   where organization_id = :'ORG_A' and voided_at is null and ended_on is null;

  select ('{' || string_agg(principal_id::text, ',') || '}') as org_scope
    from public.organization_affiliations
   where organization_id = :'ORG_A' and voided_at is null and ended_on is null
  \gset

\echo '--- P5a step (ii) profiles page read — rep 1 ---'
  explain (analyze, buffers)
  select pr.id, pr.full_name, pr.email,
         pr.professional_category_id, pr.is_active, pr.suspended_until,
         pr.email_confirmed_at, pr.created_at, pc.label_pt
    from public.profiles pr
    left join public.professional_categories pc on pc.id = pr.professional_category_id
   where pr.id = any (:'org_scope'::uuid[])
   order by pr.full_name asc nulls last
   offset 0 limit 20;
\echo '--- P5a step (ii) rep 2 ---'
  explain (analyze, buffers)
  select pr.id, pr.full_name, pr.email,
         pr.professional_category_id, pr.is_active, pr.suspended_until,
         pr.email_confirmed_at, pr.created_at, pc.label_pt
    from public.profiles pr
    left join public.professional_categories pc on pc.id = pr.professional_category_id
   where pr.id = any (:'org_scope'::uuid[])
   order by pr.full_name asc nulls last
   offset 0 limit 20;
\echo '--- P5a step (ii) rep 3 ---'
  explain (analyze, buffers)
  select pr.id, pr.full_name, pr.email,
         pr.professional_category_id, pr.is_active, pr.suspended_until,
         pr.email_confirmed_at, pr.created_at, pc.label_pt
    from public.profiles pr
    left join public.professional_categories pc on pc.id = pr.professional_category_id
   where pr.id = any (:'org_scope'::uuid[])
   order by pr.full_name asc nulls last
   offset 0 limit 20;

\echo '--- P5a step (iii) countByStatus head-count, bucket=active — rep 1 ---'
  explain (analyze, buffers)
  select count(*) from public.profiles pr
   where pr.id = any (:'org_scope'::uuid[])
     and pr.is_active = true
     and pr.email_confirmed_at is not null
     and (pr.suspended_until is null or pr.suspended_until <= now());
\echo '--- P5a step (iii) rep 2 ---'
  explain (analyze, buffers)
  select count(*) from public.profiles pr
   where pr.id = any (:'org_scope'::uuid[])
     and pr.is_active = true
     and pr.email_confirmed_at is not null
     and (pr.suspended_until is null or pr.suspended_until <= now());
\echo '--- P5a step (iii) rep 3 ---'
  explain (analyze, buffers)
  select count(*) from public.profiles pr
   where pr.id = any (:'org_scope'::uuid[])
     and pr.is_active = true
     and pr.email_confirmed_at is not null
     and (pr.suspended_until is null or pr.suspended_until <= now());

  reset role;
rollback;

-- ---------------------------------------------------------------------------
-- P5b — PERSON ROSTER, listHospitalUsers (org-users.ts:591).  Scope is the
--       union of hospital_affiliations(active) and memberships of the
--       hospital's commissions (org-users.ts:182 hospitalPeopleIds); the page
--       read is the same profiles projection.  `includeEnded` is ignored on
--       this path by design — a hospital_admin cannot read
--       organization_affiliations.
--       Principal: hospitaladmin.a1 (hospital_admin, Hospital A1).
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== P5b listHospitalUsers — principal hospitaladmin.a1, hat=hospital_admin ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_HOSPADMIN_A1';

\echo '--- P5b step (i) commissions of hospital — rep 1 ---'
  explain (analyze, buffers)
  select id from public.commissions where hospital_id = :'HOSP_A1';
\echo '--- P5b step (i) rep 2 ---'
  explain (analyze, buffers)
  select id from public.commissions where hospital_id = :'HOSP_A1';
\echo '--- P5b step (i) rep 3 ---'
  explain (analyze, buffers)
  select id from public.commissions where hospital_id = :'HOSP_A1';

\echo '--- P5b step (ii) hospital_affiliations(active) — rep 1 ---'
  explain (analyze, buffers)
  select principal_id from public.hospital_affiliations
   where hospital_id = :'HOSP_A1' and ended_on is null and voided_at is null;
\echo '--- P5b step (ii) rep 2 ---'
  explain (analyze, buffers)
  select principal_id from public.hospital_affiliations
   where hospital_id = :'HOSP_A1' and ended_on is null and voided_at is null;
\echo '--- P5b step (ii) rep 3 ---'
  explain (analyze, buffers)
  select principal_id from public.hospital_affiliations
   where hospital_id = :'HOSP_A1' and ended_on is null and voided_at is null;

\echo '--- P5b step (iii) memberships of those commissions — rep 1 ---'
  explain (analyze, buffers)
  select principal_id from public.memberships
   where commission_id in (select id from public.commissions where hospital_id = :'HOSP_A1');
\echo '--- P5b step (iii) rep 2 ---'
  explain (analyze, buffers)
  select principal_id from public.memberships
   where commission_id in (select id from public.commissions where hospital_id = :'HOSP_A1');
\echo '--- P5b step (iii) rep 3 ---'
  explain (analyze, buffers)
  select principal_id from public.memberships
   where commission_id in (select id from public.commissions where hospital_id = :'HOSP_A1');

  select ('{' || string_agg(distinct pid::text, ',') || '}') as hosp_scope from (
    select principal_id as pid from public.hospital_affiliations
     where hospital_id = :'HOSP_A1' and ended_on is null and voided_at is null
    union
    select principal_id from public.memberships
     where commission_id in (select id from public.commissions where hospital_id = :'HOSP_A1')
  ) s
  \gset

\echo '--- P5b step (iv) profiles page read — rep 1 ---'
  explain (analyze, buffers)
  select pr.id, pr.full_name, pr.email,
         pr.professional_category_id, pr.is_active, pr.suspended_until,
         pr.email_confirmed_at, pr.created_at, pc.label_pt
    from public.profiles pr
    left join public.professional_categories pc on pc.id = pr.professional_category_id
   where pr.id = any (:'hosp_scope'::uuid[])
   order by pr.full_name asc nulls last
   offset 0 limit 20;
\echo '--- P5b step (iv) rep 2 ---'
  explain (analyze, buffers)
  select pr.id, pr.full_name, pr.email,
         pr.professional_category_id, pr.is_active, pr.suspended_until,
         pr.email_confirmed_at, pr.created_at, pc.label_pt
    from public.profiles pr
    left join public.professional_categories pc on pc.id = pr.professional_category_id
   where pr.id = any (:'hosp_scope'::uuid[])
   order by pr.full_name asc nulls last
   offset 0 limit 20;
\echo '--- P5b step (iv) rep 3 ---'
  explain (analyze, buffers)
  select pr.id, pr.full_name, pr.email,
         pr.professional_category_id, pr.is_active, pr.suspended_until,
         pr.email_confirmed_at, pr.created_at, pc.label_pt
    from public.profiles pr
    left join public.professional_categories pc on pc.id = pr.professional_category_id
   where pr.id = any (:'hosp_scope'::uuid[])
   order by pr.full_name asc nulls last
   offset 0 limit 20;

  reset role;
rollback;


-- ---------------------------------------------------------------------------
-- P6 — GRANT DOOR.  public.grant_role → app.grant_role_impl (DEFINER).
--      Actor: chefe.ccih (staff_admin of CCIH ⇒ may seat `staff`).
--      Target: staff1.farm — a Rede A person with NO CCIH membership, so
--      every rep takes the INSERT arm, not the ON CONFLICT DO UPDATE arm.
--      ⚠ MUTATING.  Each rep has its own transaction and each is rolled back.
--      SHAPE-OPAQUE under Pass A; Pass B has the body.
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== P6 grant_role(commission, CCIH, staff, staff1.farm) — actor chefe.ccih, hat=staff_admin ==='
\echo '--- P6 rep 1 (own transaction, rolled back) ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_CHEFE_CCIH';
  explain (analyze, buffers)
  select public.grant_role('commission', :'CCIH', 'staff', :'P_STAFF1_FARM'::uuid);
  reset role;
  -- Prove the write LANDED: a door that silently no-ops would EXPLAIN just as
  -- cheaply and the baseline would be of nothing.
  select 'P6 landed (expect 1)' as k, count(*) as n from public.memberships
   where principal_id = :'P_STAFF1_FARM'::uuid and commission_id = :'CCIH';
rollback;
\echo '--- P6 rep 2 (own transaction, rolled back) ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_CHEFE_CCIH';
  explain (analyze, buffers)
  select public.grant_role('commission', :'CCIH', 'staff', :'P_STAFF1_FARM'::uuid);
  reset role;
rollback;
\echo '--- P6 rep 3 (own transaction, rolled back) ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_CHEFE_CCIH';
  explain (analyze, buffers)
  select public.grant_role('commission', :'CCIH', 'staff', :'P_STAFF1_FARM'::uuid);
  reset role;
rollback;


-- ---------------------------------------------------------------------------
-- P7 — REVOKE DOOR.  public.revoke_role → app.revoke_role_impl (DEFINER).
--      Actor: chefe.ccih.  Target: staff3.ccih (staff of CCIH).
--      ⚠ MUTATING.  Each rep has its own transaction and each is rolled back.
--      SHAPE-OPAQUE under Pass A; Pass B has the body.
-- ---------------------------------------------------------------------------
\echo ''
\echo '=== P7 revoke_role(commission, CCIH, staff, staff3.ccih) — actor chefe.ccih, hat=staff_admin ==='
\echo '--- P7 rep 1 (own transaction, rolled back) ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_CHEFE_CCIH';
  explain (analyze, buffers)
  select public.revoke_role('commission', :'CCIH', 'staff', :'P_STAFF3_CCIH'::uuid);
  reset role;
  select 'P7 landed (expect 0)' as k, count(*) as n from public.memberships
   where principal_id = :'P_STAFF3_CCIH'::uuid and commission_id = :'CCIH';
rollback;
\echo '--- P7 rep 2 (own transaction, rolled back) ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_CHEFE_CCIH';
  explain (analyze, buffers)
  select public.revoke_role('commission', :'CCIH', 'staff', :'P_STAFF3_CCIH'::uuid);
  reset role;
rollback;
\echo '--- P7 rep 3 (own transaction, rolled back) ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_CHEFE_CCIH';
  explain (analyze, buffers)
  select public.revoke_role('commission', :'CCIH', 'staff', :'P_STAFF3_CCIH'::uuid);
  reset role;
rollback;


\echo ''
\echo '################################################################'
\echo '## PASS B — nested body plans for the SHAPE-OPAQUE doors       ##'
\echo '##  OPT-IN:  add  -v NESTED=1  to the psql invocation.         ##'
\echo '##  Omitted for list_cases_board (~4 200 nested log lines).    ##'
\echo '################################################################'

\if :{?NESTED}
set auto_explain.log_min_duration = 0;
set auto_explain.log_nested_statements = on;
set auto_explain.log_analyze = on;
set auto_explain.log_buffers = on;
set auto_explain.log_timing = off;
set auto_explain.log_format = 'text';
set client_min_messages = log;

\echo '=== PASS B / P1 session_context() body ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_MULTI';
  select jsonb_typeof(public.session_context());
  reset role;
rollback;

\echo '=== PASS B / P4a dashboard_form_totals body ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_CHEFE_CCIH';
  select count(*) from public.dashboard_form_totals(:'CCIH', null, null);
  reset role;
rollback;

\echo '=== PASS B / P4b dashboard_distributions body ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_CHEFE_CCIH';
  select count(*) from public.dashboard_distributions(:'FORM_CCIH', null, null);
  reset role;
rollback;

\echo '=== PASS B / P4c commission_overview body ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_ORGADMIN_A';
  select count(*) from public.commission_overview();
  reset role;
rollback;

\echo '=== PASS B / P6 grant_role body (rolled back) ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_CHEFE_CCIH';
  select public.grant_role('commission', :'CCIH', 'staff', :'P_STAFF1_FARM'::uuid);
  reset role;
rollback;

\echo '=== PASS B / P7 revoke_role body (rolled back) ==='
begin;
  set local role authenticated;
  set local request.jwt.claims = :'C_CHEFE_CCIH';
  select public.revoke_role('commission', :'CCIH', 'staff', :'P_STAFF3_CCIH'::uuid);
  reset role;
rollback;

reset auto_explain.log_min_duration;
reset auto_explain.log_nested_statements;
reset auto_explain.log_analyze;
reset auto_explain.log_buffers;
reset auto_explain.log_timing;
reset client_min_messages;
\else
\echo '(Pass B skipped — re-run with  -v NESTED=1  to capture nested body plans.)'
\endif


\echo ''
\echo '################################################################'
\echo '## SECTION 9 — POSTFLIGHT CENSUS.  Must equal section 0.      ##'
\echo '################################################################'

drop table if exists pg_temp.ae0_census_after;
create temp table ae0_census_after as
select 'schema_migrations'         as t, count(*)::bigint n from supabase_migrations.schema_migrations
union all select 'memberships',               count(*) from public.memberships
union all select 'audit_log',                 count(*) from public.audit_log
union all select 'profiles',                  count(*) from public.profiles
union all select 'cases',                     count(*) from public.cases
union all select 'meetings',                  count(*) from public.meetings
union all select 'commissions',               count(*) from public.commissions
union all select 'organization_affiliations', count(*) from public.organization_affiliations
union all select 'hospital_affiliations',     count(*) from public.hospital_affiliations
union all select 'responses',                 count(*) from public.responses;

select b.t, b.n as before, a.n as after, (b.n = a.n) as unchanged
  from pg_temp.ae0_census_before b
  join pg_temp.ae0_census_after  a using (t)
 order by b.t;

do $$
declare v_bad text;
begin
  select string_agg(format('%s: %s -> %s', b.t, b.n, a.n), '; ')
    into v_bad
    from pg_temp.ae0_census_before b
    join pg_temp.ae0_census_after  a using (t)
   where b.n <> a.n;
  if v_bad is not null then
    raise exception 'AE0.2 LEFT THE STACK MUTATED: %', v_bad;
  end if;
  raise notice 'AE0.2 stack unmutated: all 10 census rows identical before and after';
end $$;

\echo ''
\echo '=== AE0.2 harness complete ==='
