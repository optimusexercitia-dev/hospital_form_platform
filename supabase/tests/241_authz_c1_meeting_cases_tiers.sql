-- =============================================================================
-- AUTHZ · Gate 2 · Stage C · C1 — meeting_cases content, tiered projection.
-- ADR 0078 keystones 5 and 16, A15/A6. Reads go through get_meeting_cases
-- (summary/decision are REVOKE'd from direct reads).
--
-- THE SPLIT PROVEN, BOTH DIRECTIONS (§7.1):
--   • summary  — substance. NULL without read_case_deliberation (K5). Present for
--     the member arm on a commission_default case, and for a grantee.
--   • decision — outcome. Visible to any non-excluded meeting-reacher EVEN on a
--     sub-group case (K16 positive); NULL for the excluded/recused (K16 negative).
--   • the ROW SKELETON is member-wide on the meeting surface (A6) — the excluded
--     member still sees the shell.
-- Falsifiable: mutation dropping the summary mask → the member reads the sub-group
-- summary → RED.
-- =============================================================================
begin;
-- 15 → 16: Gate-2 fix wave adds K10·ROW, the base-table twin. Every assertion here
-- read through the DEFINER RPC, so the whole file was blind to meeting_cases_select.
select plan(16);

update app.feature_flags set enabled = true
  where key in ('meetings', 'case_participants', 'case_access', 'case_patient');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x,   (v->>'st_x')::uuid as st_x,
         (v->>'st_x2')::uuid as st_x2, (v->>'sa_y')::uuid as sa_y,
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- FIXTURE ---------------------------------------------------------------------
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy)
values ('00000000-0000-0000-0000-0000000c1cd1', (select comm_x from k), 9741, (select sa_x from k), 'commission_default'),
       ('00000000-0000-0000-0000-0000000c1e92', (select comm_x from k), 9742, (select sa_x from k), 'explicit_grants_only');

insert into public.meetings (id, commission_id, meeting_number, title, scheduled_start)
values ('00000000-0000-0000-0000-0000000c1a30', (select comm_x from k), 9743, 'Plenária C1', now());

insert into public.meeting_cases (meeting_id, case_id, summary, decision) values
  ('00000000-0000-0000-0000-0000000c1a30', '00000000-0000-0000-0000-0000000c1cd1', 'RESUMO_CD', 'DECISAO_CD'),
  ('00000000-0000-0000-0000-0000000c1a30', '00000000-0000-0000-0000-0000000c1e92', 'RESUMO_EG', 'DECISAO_EG');

-- st_x2 is recused from the commission_default case (excluded).
insert into public.case_recusals (case_id, user_id, source)
values ('00000000-0000-0000-0000-0000000c1cd1', (select st_x2 from k), 'conflict');

-- sa_y is MADE a plain member of comm_x (so he reaches the meeting) and gets a
-- read grant on the sub-group case — the grant is his ONLY substance arm there
-- (the member arm confers nothing on an explicit_grants_only case).
insert into public.memberships (principal_id, commission_id, role)
values ((select sa_y from k), (select comm_x from k), 'staff');
select test_helpers.grant_ca('00000000-0000-0000-0000-0000000c1e92', (select sa_y from k), 'read',
       (select sa_x from k), null, null, false);

-- PRE-FLIGHT ------------------------------------------------------------------
select is(app.has_case_capability('00000000-0000-0000-0000-0000000c1cd1', (select st_x from k), 'read_case_deliberation'), true,
  'PRE ⭐: the member HAS read_case_deliberation on the commission_default case (member arm, A15)');
select is(app.has_case_capability('00000000-0000-0000-0000-0000000c1e92', (select st_x from k), 'read_case_deliberation'), false,
  'PRE ⭐: …but NOT on the sub-group case — no member arm there');
select is(app.is_case_excluded('00000000-0000-0000-0000-0000000c1cd1', (select st_x2 from k)), true,
  'PRE ⭐: the recused member IS excluded from the commission_default case');
select is(app.has_case_capability('00000000-0000-0000-0000-0000000c1e92', (select sa_y from k), 'read_case_deliberation'), true,
  'PRE ⭐: the grantee HAS read_case_deliberation on the sub-group case (grant is his only arm)');

-- STRUCTURAL — the direct read is REVOKE'd (the leak is closed at the column).
select is((select count(*)::int from information_schema.column_privileges
           where table_name='meeting_cases' and column_name in ('summary','decision')
             and grantee='authenticated' and privilege_type='SELECT'), 0,
  'C1 STRUCTURAL: authenticated has NO direct SELECT on summary/decision — only the RPC serves them');

-- MEMBER on the SUB-GROUP case: summary masked, decision visible (K5 + K16+).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select summary from public.get_meeting_cases('00000000-0000-0000-0000-0000000c1a30')
           where case_id='00000000-0000-0000-0000-0000000c1e92'), null,
  'K5 ⭐: member without substance reach reads NULL summary on the sub-group case');
select is((select decision from public.get_meeting_cases('00000000-0000-0000-0000-0000000c1a30')
           where case_id='00000000-0000-0000-0000-0000000c1e92'), 'DECISAO_EG',
  'K16 ⭐ POSITIVE: …but still reads the DECISION on the sub-group case (member-wide outcome, A6)');
select is((select count(*)::int from public.get_meeting_cases('00000000-0000-0000-0000-0000000c1a30')
           where case_id='00000000-0000-0000-0000-0000000c1e92'), 1,
  'A6 ⭐: …and the ROW skeleton is visible (meeting surface member-wide)');
select is((select summary from public.get_meeting_cases('00000000-0000-0000-0000-0000000c1a30')
           where case_id='00000000-0000-0000-0000-0000000c1cd1'), 'RESUMO_CD',
  'K5 NO-REGRESSION: …reads the summary on the commission_default case (member arm confers deliberation)');
reset role;
select set_config('request.jwt.claims', '', true);

-- RECUSED member on the commission_default case: neither summary nor decision.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
select is((select decision from public.get_meeting_cases('00000000-0000-0000-0000-0000000c1a30')
           where case_id='00000000-0000-0000-0000-0000000c1cd1'), null,
  'K16 ⭐ NEGATIVE: the recused member reads NULL decision (is_case_excluded hard-denies)');
select is((select summary from public.get_meeting_cases('00000000-0000-0000-0000-0000000c1a30')
           where case_id='00000000-0000-0000-0000-0000000c1cd1'), null,
  'K16 ⭐ NEGATIVE: …and NULL summary');
select is((select count(*)::int from public.get_meeting_cases('00000000-0000-0000-0000-0000000c1a30')
           where case_id='00000000-0000-0000-0000-0000000c1cd1'), 1,
  'K10 ⭐: …but still sees the row SHELL (she is a meeting-reacher)');
-- ⭐⭐ K10·ROW — THE BASE-TABLE TWIN, AND THE ONLY GUARD ON THE is_case_excluded TRAP.
--
-- The K10 assertion above reads through `get_meeting_cases`, which is prosecdef = t
-- ⇒ RLS NEVER RUNS ⇒ it is STRUCTURALLY BLIND to `meeting_cases_select`. Measured:
-- mutating that policy to `AND NOT app.is_case_excluded(...)` leaves every assertion
-- above GREEN. So K10, as written, does NOT protect the asymmetry it exists for.
--
-- The Gate-2 fix added `AND NOT app.is_case_respondent(case_id, auth.uid())` to
-- meeting_cases_select. A7 warns twice, in bold, that a reader will reach for the
-- familiar `is_case_excluded` here — and `is_case_excluded` = respondent OR RECUSED
-- (catalog-verified), so that swap silently blinds every recused member to the record
-- of her own recusal. This assertion is what goes RED when someone makes it.
-- ⛔ Read the ROW at the BASE TABLE. Never re-express this through the RPC.
select is((select count(*)::int from public.meeting_cases
           where case_id='00000000-0000-0000-0000-0000000c1cd1'), 1,
  'K10·ROW ⭐⭐ TRAP GUARD: the RECUSED member still reads the meeting_cases ROW at the BASE TABLE — meeting_cases_select denies the RESPONDENT only (NOT is_case_excluded, which would blind her to her own recusal)');
reset role;
select set_config('request.jwt.claims', '', true);

-- GRANTEE on the sub-group case: summary visible (grant confers deliberation).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is((select summary from public.get_meeting_cases('00000000-0000-0000-0000-0000000c1a30')
           where case_id='00000000-0000-0000-0000-0000000c1e92'), 'RESUMO_EG',
  'K5 POSITIVE: the grantee reads the sub-group summary (read_case_deliberation via the grant)');
reset role;
select set_config('request.jwt.claims', '', true);

-- COORDINATOR: full read on both (no-regression).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select summary from public.get_meeting_cases('00000000-0000-0000-0000-0000000c1a30')
           where case_id='00000000-0000-0000-0000-0000000c1e92'), 'RESUMO_EG',
  'NO-REGRESSION: the coordinator reads the sub-group summary');
select is((select decision from public.get_meeting_cases('00000000-0000-0000-0000-0000000c1a30')
           where case_id='00000000-0000-0000-0000-0000000c1cd1'), 'DECISAO_CD',
  'NO-REGRESSION: …and the commission_default decision');
reset role;
select set_config('request.jwt.claims', '', true);

select * from finish();
rollback;
