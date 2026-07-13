-- SUP · Supersession correction engine (Pre-Pilot Release, ADR 0074). Build
-- plan: docs/plans/supersession-correction.md §8. Covers all 13 acceptance
-- checks:
--   1. Aggregation parity (KEYSTONE) — app.submitted_form_responses excludes
--      the superseded predecessor once its successor is SUBMITTED; totals over
--      dashboard_form_totals/dashboard_submissions_over_time and a derived
--      `contagem` indicator all agree.
--   2. An in_progress successor does NOT exclude the predecessor.
--   3. commission_overview parity (the one inline counter).
--   4. Standalone-only refusal (HC0H1) on a case-wrapped predecessor.
--   5. Not-submitted refusal (HC0H0) on an in_progress predecessor.
--   6. One-chain: a second supersede while a successor is live (HC0H2).
--   7. Coherence trigger (HC0H4) on a hand-crafted cross-version/commission successor.
--   8. Authority: a non-staff_admin/non-admin member gets 42501.
--   9. Original immutable: UPDATE/DELETE on the predecessor still raises after supersede.
--  10. Audit: exactly one response.superseded row, reason + successor_id present, no payload.
--  11. Reason required (HC0H3) on blank/whitespace-only reason.
--  12. t19 guard: supersede_response has no PUBLIC execute grant.
--  12b. One-draft-per-user invariant (HC0H5): corrector already holds an
--       in_progress draft of the version → refused (pre-empts the unique-index collision).
--  14. BUG-SUP-002 write-door bypass: a non-admin member's DIRECT INSERT (14a/14b)
--       or INSERT-then-UPDATE (14c) setting supersedes_id is refused (42501); a
--       direct write with the flag OFF is refused (14d, check_violation); the
--       legitimate RPC path still succeeds + audits (14e/14f).
--  13. Flag OFF: supersede_response raises; submitted_form_responses is unaffected.
--
-- Fixtures: test_helpers.bootstrap() (comm_x/sa_x/st_x/st_x2/form_u+item_mc/
-- form_s+ver_s+it_gate). Response answers copied via test_helpers.add_selection
-- for choice items.

begin;
select plan(41);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

-- The audit trail + quality_indicators (for check #1's derived-indicator leg)
-- must be ON; response_correction starts OFF here (flipped ON per-check below,
-- and explicitly tested OFF in check #13).
update app.feature_flags set enabled = true where key in ('audit_trail', 'quality_indicators');
update app.feature_flags set enabled = true where key = 'response_correction';

-- ---------------------------------------------------------------------------
-- Fixtures: two standalone SUBMITTED responses on form_u (comm_x) — A and B —
-- both answering item_mc = 'sim'. A gets superseded through the checks below;
-- B is the untouched control that must stay counted throughout.
-- ---------------------------------------------------------------------------
create temp table r on commit drop as
  select gen_random_uuid() as resp_a, gen_random_uuid() as resp_b;
grant select on r to authenticated;

insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at)
select r.resp_a, (c.v->>'ver_u')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'submitted', now()
from r, ctx c;
insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at)
select r.resp_b, (c.v->>'ver_u')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x2')::uuid, 'submitted', now()
from r, ctx c;

-- Both fixtures are already 'submitted'; bypass guard_submitted_children for
-- this direct seed insert (the same in_submit_rpc escape the RPCs use), mirroring
-- 100_dashboard.sql's submitted-fixture convention.
select set_config('app.in_submit_rpc', 'on', true);
select test_helpers.add_selection((select resp_a from r), (select (v->>'item_mc')::uuid from ctx), array['sim']);
select test_helpers.add_selection((select resp_b from r), (select (v->>'item_mc')::uuid from ctx), array['sim']);
select set_config('app.in_submit_rpc', 'off', true);

-- ---------------------------------------------------------------------------
-- ---- 1) KEYSTONE — aggregation parity ----
-- Baseline: both A and B count everywhere before any supersede.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from app.submitted_form_responses((select (v->>'form_u')::uuid from ctx))),
  2, '1a. baseline: submitted_form_responses counts A + B (2) before any supersede'
);

-- dashboard_form_totals gates on is_staff_admin_of/is_org_admin_of_commission
-- (auth.uid()-scoped) — act as sa_x (staff_admin of comm_x) to read it.
select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
select is(
  (select total_submitted::int from public.dashboard_form_totals((select (v->>'comm_x')::uuid from ctx))
     where form_id = (select (v->>'form_u')::uuid from ctx)),
  2, '1b. baseline: dashboard_form_totals = 2'
);
reset role;

-- sa_x (staff_admin of comm_x) supersedes A, giving reason "erro de digitação".
select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
create temp table succ on commit drop as
  select (public.supersede_response((select resp_a from r), 'erro de digitação')).id as id;
grant select on succ to authenticated;
reset role;

select isnt(
  (select id from succ), null, '1c. supersede_response returns the new successor row'
);

-- The successor is in_progress and pre-linked to A.
select is(
  (select status from public.responses where id = (select id from succ)),
  'in_progress', '1d. the successor starts in_progress'
);
select is(
  (select supersedes_id from public.responses where id = (select id from succ)),
  (select resp_a from r), '1e. the successor is pre-linked via supersedes_id'
);

-- Answers + selections were pre-populated (O-1): the successor already has
-- item_mc = 'sim' copied from A, before any edit.
select is(
  (select count(*)::int from public.answer_selected_options aso
     join public.answers a on a.id = aso.answer_id
     where a.response_id = (select id from succ)
       and a.item_id = (select (v->>'item_mc')::uuid from ctx)
       and aso.option_id = (select id from public.form_item_options
                               where item_id = (select (v->>'item_mc')::uuid from ctx) and code = 'sim')),
  1, '1f. the successor is pre-populated with the predecessor''s selection (sim)'
);

-- While the successor is still in_progress, A is STILL counted (check #2,
-- proven here before check #2's own dedicated assertion below runs it again
-- post-submit) — total unchanged at 2.
select is(
  (select count(*)::int from app.submitted_form_responses((select (v->>'form_u')::uuid from ctx))),
  2, '1g. total stays 2 while the successor is still in_progress'
);

-- Submit the successor (sa_x owns the draft as its creator via the RPC's
-- created_by = auth.uid()).
select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
select public.submit_response((select id from succ));
reset role;

select is(
  (select status from public.responses where id = (select id from succ)),
  'submitted', '1h. the successor is now submitted'
);

-- NOW A is excluded; the successor A' + B are counted — total stays 2 (a
-- correction REPLACES, never adds).
select is(
  (select count(*)::int from app.submitted_form_responses((select (v->>'form_u')::uuid from ctx))),
  2, '1i. submitted_form_responses still totals 2 (A excluded, A''+B counted)'
);
select ok(
  not exists (select 1 from app.submitted_form_responses((select (v->>'form_u')::uuid from ctx))
                where id = (select resp_a from r)),
  '1j. A itself is excluded from submitted_form_responses'
);
select ok(
  exists (select 1 from app.submitted_form_responses((select (v->>'form_u')::uuid from ctx))
            where id = (select id from succ)),
  '1k. the successor A'' is included in submitted_form_responses'
);

select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
select is(
  (select total_submitted::int from public.dashboard_form_totals((select (v->>'comm_x')::uuid from ctx))
     where form_id = (select (v->>'form_u')::uuid from ctx)),
  2, '1l. dashboard_form_totals stays 2 after the correction lands'
);
select is(
  (select coalesce(sum(count),0)::int from public.dashboard_submissions_over_time((select (v->>'form_u')::uuid from ctx))),
  2, '1m. dashboard_submissions_over_time sums to 2'
);
reset role;

-- A derived `contagem` indicator over item_mc='sim' counts A'+B (2), not A+B+A' (3).
select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
create temp table ind on commit drop as
  select (public.create_indicator(
    p_commission => (select (v->>'comm_x')::uuid from ctx), p_name => 'Contagem sim',
    p_kind => 'contagem', p_data_source => 'derivado', p_target_value => 1,
    p_derived_config => jsonb_build_object(
      'form_id', (select (v->>'form_u')::uuid from ctx)::text,
      'numerator', jsonb_build_object('question_key', 'u_q1', 'option_codes', jsonb_build_array('sim')),
      'denominator', 'respondentes'))).id as id;
grant select on ind to authenticated;
select public.compute_derived_measurement((select id from ind), '2026-07');
reset role;

select is(
  (select value::int from public.indicator_measurements where indicator_id = (select id from ind)),
  2, '1n. a derived contagem over item_mc=sim counts A''+B (2), not A''+B+A (3) — the keystone'
);

-- ---------------------------------------------------------------------------
-- ---- 2) in_progress successor does NOT exclude the predecessor ----
-- Fresh pair (C submitted, its successor left in_progress).
-- ---------------------------------------------------------------------------
create temp table r2 on commit drop as select gen_random_uuid() as resp_c;
grant select on r2 to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at)
select r2.resp_c, (c.v->>'ver_u')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'submitted', now()
from r2, ctx c;
select set_config('app.in_submit_rpc', 'on', true);
select test_helpers.add_selection((select resp_c from r2), (select (v->>'item_mc')::uuid from ctx), array['nao']);
select set_config('app.in_submit_rpc', 'off', true);

select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
create temp table succ2 on commit drop as
  select (public.supersede_response((select resp_c from r2), 'revisão pendente')).id as id;
grant select on succ2 to authenticated;
reset role;

select ok(
  exists (select 1 from app.submitted_form_responses((select (v->>'form_u')::uuid from ctx))
            where id = (select resp_c from r2)),
  '2. C stays counted while its successor is still in_progress (half-finished correction never blanks the metric)'
);

-- ---------------------------------------------------------------------------
-- ---- 3) commission_overview parity ----
-- Grant org_b's org_admin role to sa_x's peer admin account (reuse `admin`,
-- which is is_admin=true but NOT necessarily org_admin) — create a dedicated
-- org_admin membership for a clean, unambiguous read.
-- ---------------------------------------------------------------------------
-- guard_profile_privileged_columns treats a caller with auth.uid() IS NULL as
-- trusted (service path); prior claims_for() calls above left a stale
-- request.jwt.claims GUC in this session even after `reset role`, so clear it
-- before this direct superuser write (mirrors bootstrap()'s own untouched-claims
-- context, which never hits this guard).
select set_config('request.jwt.claims', null, true);

create temp table oa on commit drop as select gen_random_uuid() as org_admin_id;
grant select on oa to authenticated;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', oa.org_admin_id, 'authenticated', 'authenticated',
       oa.org_admin_id || '@test', now(), now()
from oa;
update public.profiles set full_name = 'Org Admin', home_organization_id = (select (v->>'org_b')::uuid from ctx)
  where id = (select org_admin_id from oa);
insert into public.memberships (organization_id, principal_id, role)
select (c.v->>'org_b')::uuid, oa.org_admin_id, 'org_admin' from oa, ctx c;

select test_helpers.claims_for((select org_admin_id from oa), false);
set local role authenticated;
create temp table ov on commit drop as
  select * from public.commission_overview() where commission_id = (select (v->>'comm_x')::uuid from ctx);
grant select on ov to authenticated;
reset role;

-- form_u submitted-count: A excluded (superseded+submitted successor), A'
-- counted, B counted, C counted (successor still in_progress) = 3.
-- form_s has no responses in this fixture, so this is exactly form_u's tally.
select is(
  (select submitted_count::int from ov), 3,
  '3. commission_overview.submitted_count excludes A, counts A''+B+C (3)'
);

-- ---------------------------------------------------------------------------
-- ---- 4) standalone-only refusal (HC0H1) ----
-- ---------------------------------------------------------------------------
create temp table cf on commit drop as
  select gen_random_uuid() as case_id, gen_random_uuid() as phase_id, gen_random_uuid() as resp_case;
grant select on cf to authenticated;
insert into public.cases (id, commission_id, case_number, created_by, status)
select cf.case_id, (c.v->>'comm_x')::uuid, 9101, (c.v->>'sa_x')::uuid, 'in_review'
from cf, ctx c;
insert into public.case_phases (id, case_id, position, form_id, form_version_id, status)
select cf.phase_id, cf.case_id, 0, (c.v->>'form_u')::uuid, (c.v->>'ver_u')::uuid, 'active'
from cf, ctx c;
insert into public.responses (id, form_version_id, commission_id, created_by, status, case_phase_id, submitted_at)
select cf.resp_case, (c.v->>'ver_u')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'submitted', cf.phase_id, now()
from cf, ctx c;

select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.supersede_response(%L, 'motivo') $$, (select resp_case from cf)),
  'HC0H1', null,
  '4. a case-wrapped predecessor is refused (HC0H1)'
);
reset role;

-- ---------------------------------------------------------------------------
-- ---- 5) not-submitted refusal (HC0H0) ----
-- ---------------------------------------------------------------------------
create temp table r5 on commit drop as select gen_random_uuid() as resp_draft;
grant select on r5 to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status)
select r5.resp_draft, (c.v->>'ver_s')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'in_progress'
from r5, ctx c;

select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.supersede_response(%L, 'motivo') $$, (select resp_draft from r5)),
  'HC0H0', null,
  '5. an in_progress predecessor is refused (HC0H0)'
);
reset role;

-- ---------------------------------------------------------------------------
-- ---- 6) one-chain (HC0H2) ----
-- B (still submitted, untouched) is superseded once; a second attempt while
-- the successor is live must be refused. The FIRST supersede is done by
-- org_admin_id (a commission-admin of comm_x via org_b, created in check #3) —
-- NOT sa_x — because sa_x already holds an in_progress draft on ver_u from
-- check #2's successor (C'), and responses_one_draft_per_user_idx (one
-- in_progress draft per user per version) would collide with a second sa_x
-- successor on the same ver_u.
select test_helpers.claims_for((select org_admin_id from oa), false);
set local role authenticated;
select public.supersede_response((select resp_b from r), 'primeira correção');
reset role;

select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.supersede_response(%L, 'segunda correção') $$, (select resp_b from r)),
  'HC0H2', null,
  '6. a second supersede while a successor is live is refused (HC0H2)'
);
reset role;

-- ---------------------------------------------------------------------------
-- ---- 7) coherence trigger (HC0H4) ----
-- A hand-crafted successor pointed at C but carrying form_s/ver_s (a DIFFERENT
-- form_version_id than C's ver_u) must be refused by the trigger.
-- ---------------------------------------------------------------------------
select throws_ok(
  format($$
    insert into public.responses (form_version_id, commission_id, created_by, status, supersedes_id)
    values (%L, %L, %L, 'in_progress', %L)
  $$,
    (select (v->>'ver_s')::uuid from ctx), (select (v->>'comm_x')::uuid from ctx),
    (select (v->>'sa_x')::uuid from ctx), (select resp_c from r2)),
  'HC0H4', null,
  '7. a hand-crafted successor with a mismatched form_version_id raises HC0H4'
);

-- ---------------------------------------------------------------------------
-- ---- 8) authority (42501) ----
-- st_x2 is an ordinary staff member (not staff_admin/commission-admin) of
-- comm_x — must be refused.
-- ---------------------------------------------------------------------------
create temp table r8 on commit drop as select gen_random_uuid() as resp_d;
grant select on r8 to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at)
select r8.resp_d, (c.v->>'ver_u')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x2')::uuid, 'submitted', now()
from r8, ctx c;

select test_helpers.claims_for((select (v->>'st_x2')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.supersede_response(%L, 'motivo') $$, (select resp_d from r8)),
  '42501', null,
  '8. a non-staff_admin/non-admin member is refused (42501)'
);
reset role;

-- ---------------------------------------------------------------------------
-- ---- 9) original immutable ----
-- A (already superseded in check #1) still cannot be UPDATEd or DELETEd.
-- ---------------------------------------------------------------------------
select throws_ok(
  format($$ update public.responses set last_section_id = null where id = %L $$, (select resp_a from r)),
  '23514', null,
  '9a. UPDATE on the superseded predecessor still raises (guard_submitted_response, public schema)'
);
select throws_ok(
  format($$ delete from public.responses where id = %L $$, (select resp_a from r)),
  '23514', null,
  '9b. DELETE on the superseded predecessor still raises (guard_submitted_response, public schema)'
);
select throws_ok(
  format($$
    insert into public.answers (response_id, item_id, question_key, value)
    values (%L, %L, 'u_q1', '"nao"'::jsonb)
  $$, (select resp_a from r), (select (v->>'item_mc')::uuid from ctx)),
  '23514', null,
  '9c. INSERT on the superseded predecessor''s answers still raises (guard_submitted_children, public schema)'
);

-- ---------------------------------------------------------------------------
-- ---- 10) audit ----
-- Exactly one response.superseded row for A, reason + successor_id present, no payload.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.audit_log
     where action = 'response.superseded' and entity_id = (select resp_a from r)),
  1, '10a. exactly one response.superseded audit row for A'
);
select is(
  (select metadata->>'reason' from public.audit_log
     where action = 'response.superseded' and entity_id = (select resp_a from r)),
  'erro de digitação', '10b. metadata.reason is the supplied reason'
);
select is(
  (select metadata->>'successor_id' from public.audit_log
     where action = 'response.superseded' and entity_id = (select resp_a from r)),
  (select id::text from succ), '10c. metadata.successor_id is the new successor''s id'
);
select ok(
  not exists (select 1 from public.audit_log
                where action = 'response.superseded' and entity_id = (select resp_a from r)
                  and (metadata ? 'value' or metadata ? 'answers')),
  '10d. the audit row carries no answer payload (Rule 11)'
);

-- ---------------------------------------------------------------------------
-- ---- 11) reason required (HC0H3) ----
-- ---------------------------------------------------------------------------
create temp table r11 on commit drop as select gen_random_uuid() as resp_e;
grant select on r11 to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at)
select r11.resp_e, (c.v->>'ver_u')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'submitted', now()
from r11, ctx c;

select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.supersede_response(%L, '') $$, (select resp_e from r11)),
  'HC0H3', null,
  '11a. a blank reason is refused (HC0H3)'
);
select throws_ok(
  format($$ select public.supersede_response(%L, '   ') $$, (select resp_e from r11)),
  'HC0H3', null,
  '11b. a whitespace-only reason is refused (HC0H3)'
);
select throws_ok(
  format($$ select public.supersede_response(%L, null) $$, (select resp_e from r11)),
  'HC0H3', null,
  '11c. a NULL reason is refused (HC0H3)'
);
reset role;

-- ---------------------------------------------------------------------------
-- ---- 12) t19 guard: no PUBLIC execute grant ----
-- ---------------------------------------------------------------------------
select ok(
  not has_function_privilege('anon', 'public.supersede_response(uuid, text)', 'EXECUTE'),
  '12. supersede_response is NOT anon/PUBLIC-executable (t19 grant hygiene)'
);

-- ---------------------------------------------------------------------------
-- ---- 12b) one-draft-per-user invariant (HC0H5) ----
-- The corrector (org_admin_id, a commission-admin of comm_x) already holds an
-- in_progress standalone draft of ver_s; superseding another SUBMITTED standalone
-- response of the SAME ver_s would collide with responses_one_draft_per_user_idx,
-- so the RPC pre-empts it with a clean HC0H5. Self-contained on ver_s to stay
-- isolated from the ver_u fixtures above. (Flag still ON here — check #13 turns
-- it OFF afterwards.)
-- ---------------------------------------------------------------------------
create temp table r12b on commit drop as
  select gen_random_uuid() as resp_pred, gen_random_uuid() as resp_draft;
grant select on r12b to authenticated;
-- A submitted standalone predecessor on ver_s.
insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at)
select r12b.resp_pred, (c.v->>'ver_s')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'submitted', now()
from r12b, ctx c;
-- org_admin_id's OWN live in_progress standalone draft on the SAME ver_s.
insert into public.responses (id, form_version_id, commission_id, created_by, status)
select r12b.resp_draft, (c.v->>'ver_s')::uuid, (c.v->>'comm_x')::uuid, oa.org_admin_id, 'in_progress'
from r12b, ctx c, oa;

select test_helpers.claims_for((select org_admin_id from oa), false);
set local role authenticated;
select throws_ok(
  format($$ select public.supersede_response(%L, 'motivo') $$, (select resp_pred from r12b)),
  'HC0H5', null,
  '12b. a corrector already holding an in_progress draft of the version is refused (HC0H5)'
);
reset role;

-- ---------------------------------------------------------------------------
-- ---- 14) BUG-SUP-002 — direct-PostgREST write-door bypass is blocked ----
-- supersede_response gates authority, but nothing forces supersession THROUGH the
-- RPC: responses has GRANT ALL + responses_insert_own/_update_own_draft with no
-- restriction on supersedes_id. Without the guard's write-door enforcement, an
-- ordinary staff member could direct-INSERT a row pointing supersedes_id at a
-- colleague's submitted response and, once submitted, silently exclude it from
-- every dashboard/derived indicator (no audit, works flag-OFF). The tightened
-- app.guard_supersession_coherent() must now refuse these. (Flag ON here.)
-- ---------------------------------------------------------------------------
update app.feature_flags set enabled = true where key = 'response_correction';

-- A coherent submitted standalone predecessor on ver_u (owned by st_x).
create temp table r14 on commit drop as
  select gen_random_uuid() as resp_pred, gen_random_uuid() as resp_exploit, gen_random_uuid() as resp_draft;
grant select on r14 to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at)
select r14.resp_pred, (c.v->>'ver_u')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'submitted', now()
from r14, ctx c;

-- (14a) The core exploit: st_x2 (an ordinary staff member of comm_x — NOT
-- staff_admin/commission-admin) direct-INSERTs a coherent successor row.
-- responses_insert_own would allow it (own created_by + member of commission),
-- but the guard's authority check must reject it. 42501.
select test_helpers.claims_for((select (v->>'st_x2')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$
    insert into public.responses (id, form_version_id, commission_id, created_by, status, case_phase_id, supersedes_id)
    values (%L, %L, %L, %L, 'in_progress', null, %L)
  $$,
    (select resp_exploit from r14), (select (v->>'ver_u')::uuid from ctx),
    (select (v->>'comm_x')::uuid from ctx), (select (v->>'st_x2')::uuid from ctx),
    (select resp_pred from r14)),
  '42501', null,
  '14a. a non-admin staff member''s DIRECT INSERT setting supersedes_id is refused (42501) — the core exploit'
);
reset role;

-- The exploit row was never created.
select is(
  (select count(*)::int from public.responses where id = (select resp_exploit from r14)),
  0, '14b. the exploit successor row was not inserted'
);

-- (14c) The INSERT-then-UPDATE variant: st_x2 inserts a NORMAL draft (no
-- supersedes_id — allowed), then UPDATEs it to set supersedes_id. The BEFORE
-- UPDATE OF supersedes_id trigger fires and the authority check refuses it. 42501.
select test_helpers.claims_for((select (v->>'st_x2')::uuid from ctx), false);
set local role authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status)
values (
  (select resp_draft from r14), (select (v->>'ver_u')::uuid from ctx),
  (select (v->>'comm_x')::uuid from ctx), (select (v->>'st_x2')::uuid from ctx), 'in_progress'
);
select throws_ok(
  format($$ update public.responses set supersedes_id = %L where id = %L $$,
    (select resp_pred from r14), (select resp_draft from r14)),
  '42501', null,
  '14c. a member''s INSERT-then-UPDATE setting supersedes_id is refused (42501)'
);
reset role;

-- (14d) Flag OFF: even an otherwise-authorized-looking direct INSERT is refused
-- by the guard's flag gate (check_violation) — closes the flag-OFF direct path.
-- Use st_x2's INSERT so we test the flag arm specifically (it runs before the
-- authority arm's own rejection would also apply; the flag assert fires first).
update app.feature_flags set enabled = false where key = 'response_correction';
select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$
    insert into public.responses (form_version_id, commission_id, created_by, status, case_phase_id, supersedes_id)
    values (%L, %L, %L, 'in_progress', null, %L)
  $$,
    (select (v->>'ver_u')::uuid from ctx), (select (v->>'comm_x')::uuid from ctx),
    (select (v->>'sa_x')::uuid from ctx), (select resp_pred from r14)),
  '23514', null,
  '14d. a direct INSERT setting supersedes_id with the flag OFF is refused by the guard (check_violation)'
);
reset role;
update app.feature_flags set enabled = true where key = 'response_correction';

-- (14e) Regression: the LEGITIMATE supersede_response RPC path (staff_admin,
-- flag ON) still SUCCEEDS through the tightened guard and still emits the
-- response.superseded audit row. Fresh predecessor to avoid the earlier fixtures.
create temp table r14e on commit drop as select gen_random_uuid() as resp_g;
grant select on r14e to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at)
select r14e.resp_g, (c.v->>'ver_s')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x2')::uuid, 'submitted', now()
from r14e, ctx c;

select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
create temp table succ14 on commit drop as
  select (public.supersede_response((select resp_g from r14e), 'correção legítima')).id as id;
grant select on succ14 to authenticated;
reset role;

select isnt(
  (select id from succ14), null,
  '14e. the legitimate supersede_response RPC still succeeds through the tightened guard'
);
select is(
  (select count(*)::int from public.audit_log
     where action = 'response.superseded' and entity_id = (select resp_g from r14e)),
  1, '14f. the legitimate RPC path still emits exactly one response.superseded audit row'
);

-- ---------------------------------------------------------------------------
-- ---- 13) flag OFF ----
-- With response_correction OFF: the RPC raises, and submitted_form_responses
-- is unaffected (the NOT EXISTS predicate is inert — it never depends on the
-- flag; the flag only gates the RPC's write door).
-- ---------------------------------------------------------------------------
update app.feature_flags set enabled = false where key = 'response_correction';

create temp table r13 on commit drop as select gen_random_uuid() as resp_f;
grant select on r13 to authenticated;
insert into public.responses (id, form_version_id, commission_id, created_by, status, submitted_at)
select r13.resp_f, (c.v->>'ver_u')::uuid, (c.v->>'comm_x')::uuid, (c.v->>'st_x')::uuid, 'submitted', now()
from r13, ctx c;

select test_helpers.claims_for((select (v->>'sa_x')::uuid from ctx), false);
set local role authenticated;
select throws_ok(
  format($$ select public.supersede_response(%L, 'motivo') $$, (select resp_f from r13)),
  '23514', null,
  '13a. supersede_response raises with response_correction OFF'
);
reset role;

-- The retrofit predicate is a no-op with the flag OFF (no NEW successors can
-- be created, but the ones already created in earlier checks are untouched —
-- their exclusion still holds, proving the predicate itself never reads the
-- flag). submitted_form_responses keeps excluding A exactly as in check #1.
select ok(
  not exists (select 1 from app.submitted_form_responses((select (v->>'form_u')::uuid from ctx))
                where id = (select resp_a from r)),
  '13b. submitted_form_responses still excludes A with the flag OFF (predicate is unconditional/inert)'
);

select * from finish();
rollback;
