-- =============================================================================
-- QO·B keystones — the org_admin / hospital_admin CONTENT WALL
-- (ADR 0100 D12; PO rulings Q1–Q9, 2026-08-08; migrations 20260915000000..000300).
--
-- ⚠⚠ THE PERSONA IS THE WHOLE TEST. Every denial below is meaningless unless the
-- principal REALLY IS the tenancy admin of the fixture's commission — a denial
-- against a principal who never had reach is vacuous and looks identical to a real
-- one. §0 therefore asserts the predicate directly, in both directions, BEFORE any
-- assertion depends on it. That is not ceremony: this program has already been bitten
-- by a "coordinator" twin (229 M1·4) whose principal was actually an org_admin, and by
-- a `sa_y` named for a role it does not hold.
--
-- ⚠ THE NAMING TRAP, pinned by 0.3: app.is_commission_admin_of is NOT the commission's
-- own admin. It is the TENANCY admin (org_admin OR hospital_admin) and it returns
-- FALSE for staff_admin. Every policy in the estate reads
-- `is_staff_admin_of(...) OR is_commission_admin_of(...)`, which is why removing the
-- second disjunct subtracts exactly the tenancy roles and leaves the committee alone.
--
-- ⭐ EVERY NEGATIVE IS TWINNED. A zero here must never be able to mean "the fixture is
-- empty" — each denial is paired with a principal who reads or writes the SAME row.
--
-- ⭐ THE WALL IS A SPLIT, NOT A SWEEP, so §5 also carries OVER-CUT guards: the five
-- ratified KEEP doors and indicators_select must STILL admit the tenancy admin. A
-- future over-zealous cut reds this file rather than surfacing as a support ticket.
--
-- COVERAGE HONESTY: printed_documents, answer_matrix_cells, answer_references,
-- answer_risk_matrix and response_group_instances hold ZERO rows in a clean seed, so
-- the A/B equivalence matrix cannot observe their cuts at all. §2.3 covers the printed
-- path behaviourally through the helper, and §5 pins the remainder as a CATALOG
-- invariant. Stated, not papered over.
-- =============================================================================

begin;
select plan(33);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;
create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'oa_b')::uuid   as oa_b,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'org_b')::uuid  as org_b,
         (v->>'hosp_b')::uuid as hosp_b,
         (v->>'ver_u')::uuid  as ver_u
  from ctx;
grant select on k to authenticated;

-- A hospital_admin persona — bootstrap has none, and the wall must be probed at BOTH
-- admin tiers (PO ruling Q4: same wall). Mirrors 313's fixture.
create temp table ha on commit drop as
  select '00000000-0000-0000-0000-00000000f001'::uuid as ha_b;
grant select on ha to authenticated;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', ha_b, 'authenticated', 'authenticated', ha_b || '@test', now(), now() from ha;
update public.profiles set full_name = 'HospAdmin QOB', home_organization_id = (select org_b from k)
 where id = (select ha_b from ha);
insert into public.memberships (organization_id, hospital_id, principal_id, role)
select k.org_b, k.hosp_b, ha.ha_b, 'hospital_admin' from k, ha;

-- ── Fixtures, all in comm_x, all authored by st_x (a plain member) ───────────
create temp table f on commit drop as
  select '00000000-0000-0000-0000-00000000f101'::uuid as resp_sub,
         '00000000-0000-0000-0000-00000000f102'::uuid as resp_prog,
         '00000000-0000-0000-0000-00000000f201'::uuid as doc1,
         '00000000-0000-0000-0000-00000000f202'::uuid as docver1,
         '00000000-0000-0000-0000-00000000f301'::uuid as ind1,
         '00000000-0000-0000-0000-00000000f302'::uuid as meas1,
         '00000000-0000-0000-0000-00000000f401'::uuid as case1;
grant select on f to authenticated;

insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at, submitted_at)
select f.resp_sub, k.ver_u, k.comm_x, k.st_x, 'submitted', now(), now() from f, k;
insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at)
select f.resp_prog, k.ver_u, k.comm_x, k.st_x, 'in_progress', now() from f, k;

-- ⚠ ANSWERS ARE PART OF THE FIXTURE, not an afterthought. Without a row here 1.2 counts
-- zero no matter what any policy says — a keystone that cannot fail. The b1 mutation
-- audit caught exactly that: restoring the tenancy arm to answers_select left 1.2 GREEN,
-- and the empty fixture, not the wall, was the reason.
-- It hangs off the IN-PROGRESS response: a submitted one is immutable (the insert is
-- blocked outright), and draft content is the more sensitive half anyway.
insert into public.answers (response_id, item_id, question_key, form_version_id, value)
select f.resp_prog, i.id, i.question_key, k.ver_u, to_jsonb('resposta QO·B'::text)
from f, k, public.form_items i
where i.form_version_id = k.ver_u and i.question_key is not null
limit 1;

-- doc_type / kind values are CHECK-constrained; taken from pg_constraint, not guessed.
insert into public.controlled_documents (id, commission_id, code, title, doc_type)
select f.doc1, k.comm_x, 'QOB-DOC-1', 'Documento QO·B', 'sop' from f, k;
insert into public.controlled_document_versions (id, document_id, version_number)
select f.docver1, f.doc1, 1 from f;

insert into public.indicators (id, commission_id, code, name, kind)
select f.ind1, k.comm_x, 'QOB-IND-1', 'Indicador QO·B', 'contagem' from f, k;
insert into public.indicator_measurements (id, indicator_id, period_label, source)
select f.meas1, f.ind1, '2026-08', 'manual' from f;

insert into public.cases (id, commission_id, organization_id, case_number, label, created_by)
select f.case1, k.comm_x, k.org_b, 990314, 'Caso QO·B', k.sa_x from f, k;

-- =============================================================================
-- §0 — THE PERSONAS ARE REAL (every denial below rests on these three)
-- =============================================================================
select is(app.is_commission_admin_of_for((select comm_x from k), (select oa_b from k)), true,
  '0.1 PRECONDITION ⭐: oa_b IS the tenancy admin of comm_x — without this every §1–§4 zero is vacuous');
select is(app.is_commission_admin_of_for((select comm_x from k), (select ha_b from ha)), true,
  '0.2 PRECONDITION ⭐: ha_b too (Q4 — hospital_admin gets the SAME wall)');
select is(app.is_commission_admin_of_for((select comm_x from k), (select sa_x from k)), false,
  '0.3 ⭐ THE NAMING TRAP: is_commission_admin_of is FALSE for the commission''s own staff_admin — it is the TENANCY admin, which is why the cut leaves the committee untouched');

-- =============================================================================
-- §1 — RESPONSE PLANE (M1). Includes the BUG-QOB-001 destructive-delete keystone.
-- =============================================================================
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select is((select count(*)::int from public.responses where id in (select resp_sub from f) or id in (select resp_prog from f)), 0,
  '1.1 ⭐ WALL: org_admin reads ZERO of the fixture responses (D12)');
select is((select count(*)::int from public.answers a join public.responses r on r.id=a.response_id
           where r.id = (select resp_prog from f)), 0,
  '1.2 ⭐ WALL: ...and zero of their answers');
select is((select count(*)::int from public.responses where id = (select resp_prog from f) and status='in_progress'), 0,
  '1.3 BUG-QOB-001: the in-progress draft it used to be able to DELETE is not even visible');
-- ATTEMPT THE BUG. 1.3 only proves invisibility; the filed defect was a DESTRUCTIVE
-- `FOR ALL` grant, and a visibility check would still pass if some future policy
-- re-opened DELETE without re-opening SELECT. Pre-M1 this exact statement removed 6
-- in-progress drafts belonging to other users. The verdict is asserted by 1.3b below,
-- as st_x — the victim must be read by someone who CAN see him, or "it survived" would
-- just be org_admin's own blindness reported back.
delete from public.responses
 where status = 'in_progress' and created_by <> (select oa_b from k);
reset role;

select test_helpers.claims_for((select ha_b from ha), false);
set local role authenticated;
select is((select count(*)::int from public.responses where id in (select resp_sub from f) or id in (select resp_prog from f)), 0,
  '1.4 ⭐ WALL (Q4): hospital_admin reads ZERO too — the wall is not org_admin-only');
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.responses where id in (select resp_sub from f) or id in (select resp_prog from f)), 2,
  '1.5 NON-VACUITY TWIN ⭐: the CREATOR still reads both — 1.1/1.4''s zero is the wall, not an empty fixture');
select is((select count(*)::int from public.responses where id = (select resp_prog from f)), 1,
  '1.3b ⭐⭐ BUG-QOB-001 KEYSTONE: the victim''s in-progress draft SURVIVED org_admin''s DELETE above (pre-M1 that statement removed 6 such rows). Asserted as st_x, who can actually SEE the row — asking org_admin would only report his own blindness back');
select is((select count(*)::int from public.answers a join public.responses r on r.id=a.response_id
           where r.id = (select resp_prog from f)), 1,
  '1.2b NON-VACUITY TWIN ⭐: the creator DOES read an answer on that response — 1.2''s zero is the wall. 1.2 shipped WITHOUT this twin and the mutation audit proved it unfalsifiable; the twin is the fix');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.responses where id = (select resp_sub from f)), 1,
  '1.6 NO-REGRESSION TWIN ⭐: the committee''s own staff_admin still reads the SUBMITTED response (its arm was never touched)');
select is((select count(*)::int from public.responses where id = (select resp_prog from f)), 0,
  '1.7 ...and still does NOT read the in-progress draft — the pre-existing submitted-only boundary is unchanged by QO·B');
reset role;

-- =============================================================================
-- §2 — DOCUMENT PLANE (M2), including the two wrapper functions
-- =============================================================================
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select is((select count(*)::int from public.controlled_documents where id = (select doc1 from f)), 0,
  '2.1 ⭐ WALL: org_admin reads ZERO controlled_documents');
select is((select count(*)::int from public.controlled_document_versions where id = (select docver1 from f)), 0,
  '2.2 ⭐ WALL: ...and zero versions');
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.controlled_documents where id = (select doc1 from f)), 1,
  '2.3 NON-VACUITY TWIN ⭐: a committee MEMBER still reads the document');
reset role;

select is(app.can_read_document_of_version((select docver1 from f), (select oa_b from k)), false,
  '2.4 ⭐ WRAPPER (A4 K2 lesson): can_read_document_of_version denies the tenancy admin — narrowing the POLICY alone would have been a no-op, since document_approvals_select routes this');
select is(app.can_read_document_of_version((select docver1 from f), (select st_x from k)), true,
  '2.5 NON-VACUITY TWIN: ...and still admits a member');
select is(app.can_view_printed_document('form_response', (select resp_sub from f), (select oa_b from k)), false,
  '2.6 ⭐ WRAPPER: can_view_printed_document''s form_response arm denies the tenancy admin — its mirror of responses_admin_all moved when M1 deleted that policy (printed_documents has 0 seed rows, so ONLY this behavioural probe covers it)');
select is(app.can_view_printed_document('form_response', (select resp_sub from f), (select st_x from k)), true,
  '2.7 NON-VACUITY TWIN: ...and still admits the response''s creator');

-- =============================================================================
-- §3 — INDICATORS: the ruling is a SPLIT (Q3). Both halves asserted.
-- =============================================================================
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select is((select count(*)::int from public.indicator_measurements where id = (select meas1 from f)), 0,
  '3.1 ⭐ WALL (Q3 cut half): org_admin reads ZERO indicator MEASUREMENTS — the recorded quality data');
select is((select count(*)::int from public.indicators where id = (select ind1 from f)), 1,
  '3.2 ⭐ OVER-CUT GUARD (Q3 keep half): ...but STILL reads the indicator DEFINITION. Q3 ratified keeping it; if a later sweep cuts this too, that is an over-cut of a PO ruling and it reds HERE');
reset role;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.indicator_measurements where id = (select meas1 from f)), 1,
  '3.3 NON-VACUITY TWIN ⭐: a committee member still reads the measurement — 3.1 is the wall, not an empty fixture');
reset role;

-- =============================================================================
-- §4 — CASE-PLANE WRITE DOORS (M4). BUG-QOB-002: write-without-read.
-- =============================================================================
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.update_case_meta((select case1 from f), 'QOB-PROBE', null, null) $$,
  '42501', null,
  '4.1 ⭐⭐ BUG-QOB-002 KEYSTONE: org_admin can no longer WRITE case content. Pre-M4 this SUCCEEDED while get_case_detail denied and cases returned 0 rows — the two planes disagreed');
reset role;

select test_helpers.claims_for((select ha_b from ha), false);
set local role authenticated;
select throws_ok(
  $$ select public.update_case_meta((select case1 from f), 'QOB-PROBE-HA', null, null) $$,
  '42501', null,
  '4.2 ⭐ ...and neither can hospital_admin (Q4)');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.update_case_meta((select case1 from f), 'COORDINATOR-STILL-WRITES', null, null) $$,
  '4.3 NO-REGRESSION TWIN ⭐: the coordinator STILL writes. Without this, 4.1/4.2 would also pass if M4 had broken the door for everyone');
reset role;

select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.set_case_confidentiality((select case1 from f), 'non_phi_internal') $$,
  '4.4 ⭐ KEEP DOOR (Q9): classification still works for the tenancy admin — it shapes the container, mirroring set_commission_oversight');
select throws_ok(
  $$ select public.dispose_case_phi((select case1 from f), 'subject_request') $$,
  '42501', null,
  '4.5 ⭐ CUT DOOR (Q9): ...but PHI DISPOSAL does not — a principal with zero PHI bits (D5) does not destroy Rule 12 data');
reset role;

-- =============================================================================
-- §5 — CATALOG INVARIANTS, DERIVED. These cover what no fixture can reach: the
-- empty-in-seed tables, and every door added in future. Each is paired with an
-- OVER-CUT guard, because the wall is a ratified SPLIT and over-cutting is the
-- failure mode a "did we remove enough?" check cannot see.
-- =============================================================================
select is(
  (select count(*)::int from pg_policies
    where schemaname='public'
      and tablename in ('responses','answers','answer_selected_options','answer_references',
                        'answer_matrix_cells','answer_risk_matrix','response_group_instances',
                        'controlled_documents','controlled_document_versions','indicator_measurements')
      and coalesce(qual,'')||' '||coalesce(with_check,'') ~ '\yis_commission_admin_of\y'),
  0,
  '5.1 ⭐ CATALOG: not one policy on the ratified CUT tables carries the tenancy arm — this is what covers answer_matrix_cells / answer_references / answer_risk_matrix / response_group_instances, which hold ZERO rows in a clean seed and are invisible to the A/B matrix');
select cmp_ok(
  (select count(*)::int from pg_policies
    where schemaname='public'
      and tablename in ('responses','answers','answer_selected_options','answer_references',
                        'answer_matrix_cells','answer_risk_matrix','response_group_instances',
                        'controlled_documents','controlled_document_versions','indicator_measurements')),
  '>=', 15,
  '5.2 NON-VACUITY TWIN ⭐: ...over a population that is genuinely non-empty, so 5.1''s zero cannot mean "no such policies exist"');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace='app'::regnamespace
      and p.proname in ('can_read_document_of_version','can_read_document_object','can_view_printed_document')
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ '\yis_commission_admin_of(_for)?\y'),
  0,
  '5.3 ⭐ CATALOG (A4 K2): none of the three document/print WRAPPERS routes the tenancy admin either — the half a policy-only sweep cannot see');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace='public'::regnamespace and p.prokind='f'
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g') ~ 'assert_not_case_excluded'
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g') ~ '\yis_commission_admin_of\y'
      and p.proname <> all (array['grant_case_access','revoke_case_access','list_case_access',
                                  'set_case_visibility','set_case_confidentiality'])),
  0,
  '5.4 ⭐ CATALOG: no case-content mutator outside the ratified KEEP set admits the tenancy admin. The population is DERIVED from A4-Unit-2''s exclusion guard, so a door added later inherits this assertion instead of being forgotten');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace='public'::regnamespace and p.prokind='f'
      and p.proname = any(array['grant_case_access','revoke_case_access','list_case_access',
                                'set_case_visibility','set_case_confidentiality'])
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ '\yis_commission_admin_of\y'),
  5,
  '5.5 ⭐ OVER-CUT GUARD (Q8/Q9): all FIVE ratified KEEP doors must STILL admit the tenancy admin. grant_case_access is safe because self-escalation is independently blocked — org_admin is not a commission member — not because nobody checked');

select isnt(
  (select coalesce(qual,'') from pg_policies
    where schemaname='public' and tablename='indicators' and policyname='indicators_select'),
  '',
  '5.6 OVER-CUT GUARD (Q3): indicators_select still exists — its tenancy arm is asserted behaviourally by 3.2, and the definition half of the split must never be swept away with the measurement half');

select * from finish();
rollback;
