-- =============================================================================
-- QO·A M10 keystones — the oversight READ-ONLY PERIMETER (QA B1/M1/M2; PO
-- ruling: exclude all three write doors, no carve-out).
--
-- ⚠⚠ THE FIXTURE IS THE WHOLE TEST. Every family below is invisible to the
-- reviewer TODAY only because of WHERE A SEEDED ROW HAPPENS TO SIT — the one
-- profile-bearing CCIH participant is on the LOCKED case; the oversight-visible
-- population has no votes, no decisions, no ethics rows. A keystone written
-- against today's data passes on that coincidence and is vacuous BY
-- CONSTRUCTION while looking identical to a real one.
--
-- So every fixture here places its row on `case_a` — a case that is
-- commission_default (not locked), in an oversight-VISIBLE commission, of a
-- hospital the reviewer reviews, i.e. a case the reviewer reads IN FULL. Each
-- assertion below would therefore FAIL if its cut were absent, and each was
-- OBSERVED RED against the pre-M10 catalog.
--
-- Every negative is twinned with the coordinator reading the SAME row, so a
-- zero can never pass as "isolation holds" when it is really "the fixture is
-- empty" (the trap that ate two probes this phase).
--
-- COVERAGE HONESTY: 6 of the 7 `ethics_*` tables are covered by the §5 CATALOG
-- invariant rather than behaviourally — they need distinct FK fixtures and share
-- ONE identical qual, so `ethics_allegations` is the behavioural representative
-- and §5 pins that all nine policies moved together. Stated, not papered over.
-- =============================================================================

begin;
select plan(24);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'sa_x')::uuid as sa_x, (v->>'st_x')::uuid as st_x,
         (v->>'comm_x')::uuid as comm_x, (v->>'org_b')::uuid as org_b,
         (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

create temp table p on commit drop as select gen_random_uuid() as qr;
grant select on p to authenticated;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', qr, 'authenticated', 'authenticated', qr||'@test', now(), now() from p;
select test_helpers.claims_for(null, false);
update public.profiles pr set home_organization_id = (select org_b from k) where pr.id = (select qr from p);
insert into public.memberships (organization_id, hospital_id, principal_id, role)
select k.org_b, k.hosp_b, p.qr, 'quality_reviewer' from k, p;

select set_config('app.in_commission_rpc', 'on', true);
update public.commissions set quality_oversight = 'visible' where id = (select comm_x from k);
select set_config('app.in_commission_rpc', 'off', true);

create temp table cs on commit drop as
  select '00000000-0000-0000-0000-0000000f1001'::uuid as case_a;
grant select on cs to authenticated;
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, status)
select cs.case_a, k.comm_x, 99920, k.sa_x, 'commission_default', 'in_review' from cs, k;

-- PRECONDITION, ASSERTED NOT INHERITED: the reviewer reads this case in full.
-- If this is false every zero below is a zero for the WRONG REASON.
select ok(app.can_read_case((select case_a from cs), (select qr from p)),
  '0.1 PRECONDITION ⭐: the reviewer reads case_a IN FULL — so every zero below is the CUT, never a missing fixture');
-- Expressed in the UNDERLYING bits, not app.is_oversight_only_reader, so this
-- file RUNS (and reds) against the pre-M10 catalog where that helper does not
-- yet exist — an abort is not a red (§7.15).
select ok(app.has_case_capability((select case_a from cs), (select qr from p), 'read_case_content')
      and not app.has_case_capability((select case_a from cs), (select qr from p), 'read_case_deliberation'),
  '0.2 PRECONDITION: ...and their reach is oversight-ONLY (content without deliberation) — the exact principal the perimeter targets');
select ok(app.has_case_capability((select case_a from cs), (select sa_x from k), 'read_case_deliberation'),
  '0.3 CONTROL: the coordinator DOES hold deliberation — the distinguishing property is real, not an artifact');

-- ── Fixtures ON THE READABLE VISIBLE CASE (this is the part that matters) ────
-- Class-2 professional identity (Rule 12 / D5). Deliberately NOT on the locked
-- case where the seed puts it — that placement is what hid the leak.
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
select '00000000-0000-0000-0000-0000000f1101', k.org_b, 'professional', 'professional_identity', 'Dra. Perímetro' from k;
insert into public.professional_profiles (id, organization_id, user_id, full_name)
select '00000000-0000-0000-0000-0000000f1102', k.org_b, null, 'Dra. Perímetro' from k;
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-0000000f1101', '00000000-0000-0000-0000-0000000f1102');
insert into public.case_participant_roles (id, organization_id, key, display_name, allowed_participant_types)
select '00000000-0000-0000-0000-0000000f1103', k.org_b, 'testemunha', 'Testemunha', array['professional'] from k;
insert into public.case_participants (id, case_id, participant_id, role_id)
select '00000000-0000-0000-0000-0000000f1104', cs.case_a,
       '00000000-0000-0000-0000-0000000f1101', '00000000-0000-0000-0000-0000000f1103' from cs;

-- Deliberation content: a decision + a vote on it.
insert into public.case_decisions (id, case_id, decision_type, summary_md, decided_by)
select '00000000-0000-0000-0000-0000000f1201', cs.case_a, 'outcome', 'Decisão do colegiado', k.sa_x from cs, k;
insert into public.case_votes (id, case_id, decision_id, voter_id, vote)
select '00000000-0000-0000-0000-0000000f1202', cs.case_a,
       '00000000-0000-0000-0000-0000000f1201', k.sa_x, 'approve' from cs, k;

-- Ethics (behavioural representative of the 7-table family). The category is
-- MINTED here: test_helpers.bootstrap() truncates organizations CASCADE, which
-- takes the org-scoped ethics vocab with it, so borrowing a seeded row yields
-- NULL and the fixture would fail closed for the wrong reason.
insert into public.ethics_allegation_categories (id, organization_id, key, display_name, is_active, position)
select '00000000-0000-0000-0000-0000000f1300', k.org_b, 'conduta', 'Conduta', true, 1 from k;
insert into public.ethics_allegations (id, case_id, allegation_category_id, description_md, created_by)
select '00000000-0000-0000-0000-0000000f1301', cs.case_a,
       '00000000-0000-0000-0000-0000000f1300', 'Alegação', k.sa_x from cs, k;

-- Interview (7 tables route can_read_interview).
insert into public.case_interviews (id, commission_id, case_id, interview_number, interview_category, title, created_by)
select '00000000-0000-0000-0000-0000000f1401', k.comm_x, cs.case_a, 1, 'witness', 'Entrevista', k.sa_x from cs, k;

-- Action item, case_restricted scope (the one arm that routes can_read_case).
insert into public.action_items (id, commission_id, source_type, source_case_id, title, status_id, visibility_scope, created_by)
select '00000000-0000-0000-0000-0000000f1501', k.comm_x, 'case', cs.case_a, 'Pendência',
       (select id from public.action_item_statuses where commission_id is null and is_initial limit 1),
       'case_restricted', k.sa_x from cs, k;

-- =============================================================================
-- §1 — CLASS-2 PROFESSIONAL IDENTITY (Rule 12 / D5). QA M1.
-- =============================================================================
select test_helpers.claims_for((select qr from p), false);
set local role authenticated;
select is((select count(*)::int from public.professional_profiles
           where id = '00000000-0000-0000-0000-0000000f1102'), 0,
  '1.1 CLASS-2 ⭐⭐ (Rule 12/D5): the reviewer reads ZERO professional_profiles for a participant on a case they read IN FULL');
select is((select count(*)::int from public.professional_participants
           where participant_id = '00000000-0000-0000-0000-0000000f1101'), 0,
  '1.2 CLASS-2: ...and zero professional_participants (the subtype satellite)');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.professional_profiles
           where id = '00000000-0000-0000-0000-0000000f1102'), 1,
  '1.3 NON-VACUITY twin: the coordinator DOES read the profile — 1.1''s zero is the cut, not an empty fixture');
reset role;

-- =============================================================================
-- §2 — DELIBERATION CONTENT (D4): votes, decisions, ethics.
-- =============================================================================
select test_helpers.claims_for((select qr from p), false);
set local role authenticated;
select is((select count(*)::int from public.case_decisions where case_id = (select case_a from cs)), 0,
  '2.1 D4 ⭐: the reviewer reads ZERO case_decisions on a case they read in full');
select is((select count(*)::int from public.case_votes where case_id = (select case_a from cs)), 0,
  '2.2 D4 ⭐: ...zero case_votes (who voted which way is deliberation, not oversight)');
select is((select count(*)::int from public.ethics_allegations where case_id = (select case_a from cs)), 0,
  '2.3 D4 ⭐: ...zero ethics_allegations (representative of the 7-table ethics family — see §5)');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.case_decisions where case_id = (select case_a from cs)), 1,
  '2.4 NON-VACUITY twin: the coordinator reads the decision');
select is((select count(*)::int from public.case_votes where case_id = (select case_a from cs)), 1,
  '2.5 NON-VACUITY twin: ...the vote');
select is((select count(*)::int from public.ethics_allegations where case_id = (select case_a from cs)), 1,
  '2.6 NON-VACUITY twin: ...and the allegation');
reset role;

-- =============================================================================
-- §3 — INTERVIEWS (QA M2) + ACTION ITEMS (case_restricted arm).
-- =============================================================================
select test_helpers.claims_for((select qr from p), false);
set local role authenticated;
select ok(not app.can_read_interview('00000000-0000-0000-0000-0000000f1401', (select qr from p)),
  '3.1 INTERVIEWS ⭐ (QA M2): can_read_interview is FALSE for the reviewer — the 7 tables routing it close together');
select is((select count(*)::int from public.case_interviews where case_id = (select case_a from cs)), 0,
  '3.2 ...and the interview row itself is invisible');
select ok(not app.can_read_action_item('00000000-0000-0000-0000-0000000f1501', (select qr from p)),
  '3.3 ACTION ITEMS: the case_restricted arm no longer admits the reviewer');
select is((select count(*)::int from public.action_items where id = '00000000-0000-0000-0000-0000000f1501'), 0,
  '3.4 ...and the row is invisible');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select ok(app.can_read_interview('00000000-0000-0000-0000-0000000f1401', (select sa_x from k)),
  '3.5 NON-VACUITY twin: the coordinator reads the interview');
select is((select count(*)::int from public.action_items where id = '00000000-0000-0000-0000-0000000f1501'), 1,
  '3.6 NON-VACUITY twin: ...and the action item');
reset role;

-- =============================================================================
-- §4 — WHAT THE REVIEWER MUST STILL REACH. A perimeter that over-cuts is the
-- narrowing failure mode (authz-handoff §7.7): the negative keystones above
-- would all pass if the cut simply denied everything.
-- =============================================================================
select test_helpers.claims_for((select qr from p), false);
set local role authenticated;
select is((select count(*)::int from public.cases where id = (select case_a from cs)), 1,
  '4.1 NOT OVER-CUT ⭐: the reviewer still reads the CASE itself (D3 — the whole point of the feature)');
select is((select count(*)::int from public.list_cases_board((select comm_x from k), 50)), 1,
  '4.2 NOT OVER-CUT: ...and the board still serves it');
select is((select count(*)::int from public.case_participants where case_id = (select case_a from cs)), 1,
  '4.3 NOT OVER-CUT: ...and the participant ROSTER row stays visible — only the Class-2 IDENTITY behind it is cut');
reset role;

-- =============================================================================
-- §5 — CATALOG INVARIANT: the nine deliberation-grade policies and the three
-- read predicates moved TOGETHER, and cases_select did NOT (re-pointing it
-- would revoke the feature). Covers the 6 ethics tables not tested above.
-- =============================================================================
select is(
  (select count(*)::int from pg_policies where schemaname='public' and qual ~ 'can_read_case_committee'
     and tablename in ('case_votes','case_decisions','ethics_allegations','ethics_appeals',
                       'ethics_case_details','ethics_decision_details','ethics_findings',
                       'ethics_hearings','ethics_notifications','action_items')),
  10,
  '5.1 CATALOG ⭐: all TEN case-content SELECT policies (9 deliberation-grade + action_items, whose case_restricted arm routes can_read_case directly) route the committee-plane predicate');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='app' and p.proname in ('can_read_professional_profile','can_read_interview','can_read_action_item')
     and regexp_replace(p.prosrc,'--[^\n]*','','g') ~ 'can_read_case_committee'),
  3,
  '5.2 CATALOG: the three read predicates route it too');
select ok(
  (select qual from pg_policies where schemaname='public' and tablename='cases' and policyname='cases_select')
    !~ 'can_read_case_committee',
  '5.3 NOT OVER-CUT (catalog): cases_select is deliberately NOT re-pointed — that would revoke the oversight read itself');

select * from finish();
rollback;
