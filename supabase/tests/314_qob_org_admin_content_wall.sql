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
select plan(76);

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
         (v->>'ver_u')::uuid  as ver_u,
         (v->>'form_u')::uuid as form_u
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

-- resp_sub is born IN_PROGRESS, answered, then transitioned to submitted. A response
-- inserted as 'submitted' cannot be answered afterwards (the immutability guard blocks
-- it), and §7's dashboard keystones need a SUBMITTED free-text answer or their zeros are
-- vacuous — the doors return empty rather than raising, so "0 rows" from an empty form
-- is indistinguishable from "0 rows because the wall held".
insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at)
select f.resp_sub, k.ver_u, k.comm_x, k.st_x, 'in_progress', now() from f, k;
insert into public.answers (response_id, item_id, question_key, form_version_id, value)
select f.resp_sub, i.id, i.question_key, k.ver_u, to_jsonb('texto livre QO·B'::text)
from f, k, public.form_items i
where i.form_version_id = k.ver_u and i.item_type = 'free_text' and i.question_key is not null
limit 1;
update public.responses set status = 'submitted', submitted_at = now() where id = (select resp_sub from f);
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

-- ── MATRIX SATELLITES ────────────────────────────────────────────────────────
-- ⛔ ADDED AFTER THE DIFF-SCOPED DOOR SWEEP RETURNED **BLIND** for
-- answer_matrix_cells_select and answer_risk_matrix_select. Both tables hold ZERO rows
-- in a clean seed, so neutralizing their policies to `using(true)` reddened NOTHING in
-- the whole suite — no keystone was asserting through them. §5.1's CATALOG invariant
-- does not cover this: it greps the qual for the tenancy arm, and a policy opened to
-- `true` has no such text, so it passes. A structural assertion cannot substitute for a
-- behavioural one. These fixtures make the two policies observable.
--
-- ⚠ They need their OWN form version: the bootstrap's ver_u is PUBLISHED, and Rule 5
-- makes a published version's structure immutable (the insert is refused outright).
-- It stays a DRAFT — status changes must go through a door, and [CAT] the only
-- version-related trigger on `responses` (guard_response_version_commission) checks the
-- COMMISSION matches, never the status, so a draft version is a valid anchor here. The
-- policies under test join answers -> responses and never look at version status.
insert into public.forms (id, commission_id, title)
select '00000000-0000-0000-0000-00000000f540', k.comm_x, 'Formulário QO·B (matriz)' from k;
insert into public.form_versions (id, form_id, version_number, status)
values ('00000000-0000-0000-0000-00000000f541', '00000000-0000-0000-0000-00000000f540', 1, 'draft');
insert into public.form_sections (id, form_version_id, position, title, is_default)
values ('00000000-0000-0000-0000-00000000f542', '00000000-0000-0000-0000-00000000f541', 0, 'Seção QO·B', true);

insert into public.form_items (id, section_id, form_version_id, item_type, position, question_key, label)
values ('00000000-0000-0000-0000-00000000f501', '00000000-0000-0000-0000-00000000f542', '00000000-0000-0000-0000-00000000f541', 'matrix', 0, 'qob_matrix', 'Matriz QO·B'),
       ('00000000-0000-0000-0000-00000000f502', '00000000-0000-0000-0000-00000000f542', '00000000-0000-0000-0000-00000000f541', 'risk_matrix', 1, 'qob_risk', 'Risco QO·B'),
       -- §7's dashboard doors filter item_type = 'free_text' AND value IS NOT NULL on a
       -- SUBMITTED response. Owning the item here (rather than hoping the bootstrap
       -- version has one) is what makes 7.5's twin real — and without a real twin the
       -- whole section's zeros are unfalsifiable, which is how M5's hole survived.
       ('00000000-0000-0000-0000-00000000f503', '00000000-0000-0000-0000-00000000f542', '00000000-0000-0000-0000-00000000f541', 'free_text', 2, 'qob_texto', 'Texto livre QO·B');

insert into public.form_matrix_rows (id, item_id, form_version_id, position, code, label) values
  ('00000000-0000-0000-0000-00000000f511','00000000-0000-0000-0000-00000000f501','00000000-0000-0000-0000-00000000f541',0,'r1','Linha 1'),
  ('00000000-0000-0000-0000-00000000f521','00000000-0000-0000-0000-00000000f502','00000000-0000-0000-0000-00000000f541',0,'s1','Severidade 1');
insert into public.form_matrix_columns (id, item_id, form_version_id, position, code, label) values
  ('00000000-0000-0000-0000-00000000f512','00000000-0000-0000-0000-00000000f501','00000000-0000-0000-0000-00000000f541',0,'c1','Coluna 1'),
  ('00000000-0000-0000-0000-00000000f522','00000000-0000-0000-0000-00000000f502','00000000-0000-0000-0000-00000000f541',0,'p1','Probabilidade 1');


insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at)
select '00000000-0000-0000-0000-00000000f543', '00000000-0000-0000-0000-00000000f541', k.comm_x, k.st_x, 'in_progress', now() from k;

insert into public.answers (id, response_id, item_id, question_key, form_version_id) values
  ('00000000-0000-0000-0000-00000000f531','00000000-0000-0000-0000-00000000f543','00000000-0000-0000-0000-00000000f501','qob_matrix','00000000-0000-0000-0000-00000000f541'),
  ('00000000-0000-0000-0000-00000000f532','00000000-0000-0000-0000-00000000f543','00000000-0000-0000-0000-00000000f502','qob_risk','00000000-0000-0000-0000-00000000f541');

-- A SECOND response on the same version, answered with free text and then submitted —
-- the fixture §7's dashboard doors actually read. Authored by st_x2, NOT st_x:
-- responses_one_draft_per_user_idx allows one in_progress draft per user per version,
-- and st_x already holds f543 on this version.
insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at)
select '00000000-0000-0000-0000-00000000f544', '00000000-0000-0000-0000-00000000f541', k.comm_x, k.st_x2, 'in_progress', now() from k;
insert into public.answers (id, response_id, item_id, question_key, form_version_id, value)
values ('00000000-0000-0000-0000-00000000f533','00000000-0000-0000-0000-00000000f544','00000000-0000-0000-0000-00000000f503','qob_texto','00000000-0000-0000-0000-00000000f541', to_jsonb('texto livre QO·B'::text));
update public.responses set status='submitted', submitted_at=now() where id='00000000-0000-0000-0000-00000000f544';

insert into public.answer_matrix_cells (answer_id, row_id, col_id)
values ('00000000-0000-0000-0000-00000000f531','00000000-0000-0000-0000-00000000f511','00000000-0000-0000-0000-00000000f512');
insert into public.answer_risk_matrix (answer_id, severity_row_id, likelihood_col_id)
values ('00000000-0000-0000-0000-00000000f532','00000000-0000-0000-0000-00000000f521','00000000-0000-0000-0000-00000000f522');

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
-- ⛔ 1.2c/1.2d ADDED AFTER THE DOOR SWEEP RETURNED **BLIND** for both satellites.
select is((select count(*)::int from public.answer_matrix_cells), 0,
  '1.2c ⭐ WALL (was BLIND): org_admin reads ZERO answer_matrix_cells — behavioural, because §5.1''s catalog grep still passes on a policy opened to `true`');
select is((select count(*)::int from public.answer_risk_matrix), 0,
  '1.2d ⭐ WALL (was BLIND): ...and ZERO answer_risk_matrix');
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
select is((select count(*)::int from public.answer_matrix_cells), 1,
  '1.2e NON-VACUITY TWIN ⭐: the creator DOES read the matrix cell — 1.2c''s zero is the wall, not the empty-in-seed table that made the sweep call it BLIND');
select is((select count(*)::int from public.answer_risk_matrix), 1,
  '1.2f NON-VACUITY TWIN ⭐: ...and the risk-matrix row');
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

-- ⛔ 2.8/2.9 ADDED AFTER THE DOOR SWEEP RETURNED **BLIND** for can_read_document_object.
-- Its sibling can_read_document_of_version came back COVERED (2.4/2.5), which is exactly
-- what made the gap precise: I keystoned one wrapper of a pair and assumed the other was
-- carried along. It is not — it gates the controlled-document STORAGE BYTES, a content
-- boundary, so §6 says keystone it, never allowlist it. The object name's folder shape is
-- [1] = commission_id, [2] = document_id (read from the function body, not guessed).
select is(app.can_read_document_object(
            (select comm_x from k)::text || '/' || (select doc1 from f)::text || '/arquivo.pdf',
            (select oa_b from k)), false,
  '2.8 ⭐ WRAPPER (was BLIND): can_read_document_object denies the tenancy admin the document BYTES');
select is(app.can_read_document_object(
            (select comm_x from k)::text || '/' || (select doc1 from f)::text || '/arquivo.pdf',
            (select st_x from k)), true,
  '2.9 NON-VACUITY TWIN: ...and still admits a committee member, so 2.8 is the wall and not a malformed object name');

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

-- =============================================================================
-- §7 — RESPONSE-PLANE DOORS (M5). ⛔ THIS SECTION EXISTS BECAUSE M1–M4 LEFT A HOLE.
-- Six §4.1-ratified doors were never cut, and DEFINER doors bypass RLS entirely: the
-- tenancy admin could still read every free-text answer in the commission while the
-- table it came from returned zero. Nothing caught it — the A/B matrix measures TABLE
-- visibility, the ADR 0079 sweep neutralizes BOOLEAN gates (these return SETOF), and
-- ARM=floor asks only whether a door is CALLED. Four green gates, each blind to it in a
-- different way. These keystones are the coverage that was missing.
-- =============================================================================
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select is((select count(*)::int from public.dashboard_free_text('00000000-0000-0000-0000-00000000f540')), 0,
  '7.1 ⭐⭐ WALL (M5): org_admin reads ZERO free-text answers through the door — pre-M5 this returned 6 while the responses table returned 0');
select is((select count(*)::int from public.dashboard_export_rows('00000000-0000-0000-0000-00000000f540')), 0,
  '7.2 ⭐ WALL (M5): ...and zero export rows');
select is((select count(*)::int from public.dashboard_completion_by_member('00000000-0000-0000-0000-00000000f540')), 0,
  '7.3 ⭐ WALL (M5): ...and zero completion-by-member rows');
select cmp_ok((select count(*)::int from public.dashboard_form_totals((select comm_x from k))), '>', 0,
  '7.4 ⭐ OVER-CUT GUARD (D12 (6)): the AGGREGATE doors are KEPT — the nine dashboard_* doors split six-to-three, and a follow-up that sweeps all nine reds HERE rather than reaching a customer');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select cmp_ok((select count(*)::int from public.dashboard_free_text('00000000-0000-0000-0000-00000000f540')), '>', 0,
  '7.5 NON-VACUITY TWIN ⭐: the coordinator DOES read free text through the same door on the same form — 7.1''s zero is the wall, not an empty form. Without this the whole section is unfalsifiable, which is exactly how the hole survived four gates');
reset role;

-- =============================================================================
-- §8 — CONTROLLED-DOCUMENT DOORS + the attachment write arm (M6). Same class of hole
-- as §7, one plane over: M2 cut the document POLICIES and read WRAPPERS and went green,
-- while ten §4.2-ratified DOORS kept the tenancy arm and bypassed RLS entirely.
-- =============================================================================
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select is((select count(*)::int from public.list_commission_documents((select comm_x from k))), 0,
  '8.1 ⭐⭐ WALL (M6): org_admin lists ZERO controlled documents through the door — pre-M6 this returned the commission''s documents while the table returned zero');
reset role;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select cmp_ok((select count(*)::int from public.list_commission_documents((select comm_x from k))), '>', 0,
  '8.2 NON-VACUITY TWIN ⭐: a committee MEMBER still lists them through the same door — 8.1''s zero is the wall, not an empty commission');
reset role;
select is(app.can_write_attachment('case', (select case1 from f), (select oa_b from k)), false,
  '8.3 ⭐ WALL (M6, §4.3): the tenancy admin can no longer WRITE case attachments');
select is(app.can_write_attachment('case', (select case1 from f), (select sa_x from k)), true,
  '8.4 NON-VACUITY TWIN ⭐: the committee''s own coordinator still can');
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace='public'::regnamespace and p.proname='revoke_printed_document'
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'is_commission_admin_of'),
  1,
  '8.5 ⭐ RULING GUARD: revoke_printed_document KEEPS its tenancy arm — ADR 0104 D11 rules revocation a GOVERNANCE act that reveals no content. A "finish the printed-doc wall" sweep must red HERE rather than silently reverse a ruling it never read');

-- =============================================================================
-- §9 — RESPONSE-PLANE DOORS, the BEHAVIOURAL half M5 shipped without (self-audit
-- risk #1). §7 pinned the three dashboards; the other three M5 doors — and 7.3's
-- own non-vacuity twin — rested ONLY on the migration's structural postconditions,
-- and this phase proved twice that a structural assertion cannot substitute for a
-- behavioural one (§5.1 passes happily on a policy neutralized to `using(true)`).
-- Every denial here is red-proven by the b1 mutation audit (restore the pre-M5
-- arm → the assertion below must red → byte-identical restore).
--
-- ⭐ THE TWIN DISCIPLINE FOR RPC DOORS (authz-handoff §7.1): authority raises a
-- DISTINCT SQLSTATE (42501 / HC0J1 / P0002-at-gate-2) and is checked BEFORE the
-- state gates, so a twin that reaches a LATER gate (or succeeds outright) proves
-- the deny fired on AUTHORITY for the same fixture, not on a missing precondition.
-- =============================================================================

-- ── §9 fixtures (as postgres) ────────────────────────────────────────────────
create temp table f9 on commit drop as
  select '00000000-0000-0000-0000-00000000f601'::uuid as phase1,
         '00000000-0000-0000-0000-00000000f602'::uuid as resp_phase,
         '00000000-0000-0000-0000-00000000f603'::uuid as pt1,
         '00000000-0000-0000-0000-00000000f604'::uuid as role1,
         '00000000-0000-0000-0000-00000000f605'::uuid as cp1,
         '00000000-0000-0000-0000-00000000f606'::uuid as sec_sign;
grant select on f9 to authenticated;

-- A pending staff_admin SIGN-OFF section on the DRAFT version f541 (structure is
-- mutable pre-publish, Rule 5 binds published only). f543 (in_progress, st_x) then
-- has a visible+unsigned staff_admin section, so get_response_for_signoff's gate 3
-- passes and the sa_x twin isolates gate 2 (authority) as the ONLY discriminator.
insert into public.form_sections (id, form_version_id, position, title, requires_signoff, signoff_role)
select f9.sec_sign, '00000000-0000-0000-0000-00000000f541', 1, 'Assinatura QO·B', true, 'staff_admin' from f9;

-- A CASE-PHASE response for target_case_response: phase on case1 (144's proven
-- direct-insert pattern — guard_case_phase_status fires on UPDATE/DELETE only),
-- response by st_x2 (the one-draft index is standalone-scoped, but st_x2 holds no
-- ver_u draft anyway). The target participant chain is minimal-but-real: an
-- 'other'-typed participant (no professional chain needed), an org-scoped role
-- allowing it, a LIVE case_participants row, and ethics_case_details so the sa_x
-- twin passes the ethics-typed gate and SUCCEEDS rather than merely failing later.
insert into public.case_phases (id, case_id, position, title, form_id, form_version_id, status)
select f9.phase1, f.case1, 1, 'Fase QO·B', k.form_u, k.ver_u, 'active' from f9, f, k;
insert into public.responses (id, form_version_id, commission_id, created_by, status, started_at, case_phase_id)
select f9.resp_phase, k.ver_u, k.comm_x, k.st_x2, 'in_progress', now(), f9.phase1 from f9, k;
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
select f9.pt1, k.org_b, 'other', 'non_sensitive', 'Alvo QO·B' from f9, k;
insert into public.case_participant_roles (id, organization_id, key, display_name, allowed_participant_types)
select f9.role1, k.org_b, 'qob_alvo', 'Alvo QO·B', array['other'] from f9, k;
insert into public.case_participants (id, case_id, participant_id, role_id)
select f9.cp1, f.case1, f9.pt1, f9.role1 from f9, f;
insert into public.ethics_case_details (case_id) select f.case1 from f;

-- ── the tenancy admin is DENIED at every M5 door ─────────────────────────────
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.get_response_for_signoff('00000000-0000-0000-0000-00000000f543') $$,
  'P0002', null,
  '9.1 ⭐ WALL (M5): get_response_for_signoff refuses the tenancy admin on f543 — the response 9.5''s coordinator twin SUCCEEDS on, so gates 1+3 pass and the only discriminator is gate 2 (authority). ⚠ Probing a response WITHOUT a pending section here would be vacuous: gate 3 raises the same P0002');
select throws_ok(
  $$ select public.supersede_response((select resp_sub from f), 'motivo QO·B') $$,
  '42501', null,
  '9.2 ⭐ WALL (M5): supersede_response refuses the tenancy admin on AUTHORITY (42501 precedes every state gate)');
select throws_ok(
  $$ select public.target_case_response((select resp_phase from f9), (select cp1 from f9)) $$,
  'HC0J1', null,
  '9.3 ⭐ WALL (M5): target_case_response refuses the tenancy admin on AUTHORITY (HC0J1, distinct from the HC0J0 state code)');
reset role;

select test_helpers.claims_for((select ha_b from ha), false);
set local role authenticated;
select throws_ok(
  $$ select public.get_response_for_signoff('00000000-0000-0000-0000-00000000f543') $$,
  'P0002', null,
  '9.4 ⭐ (Q4 spot check): hospital_admin is refused on the same f543 by the same shared predicate — the wall is not org_admin-only');
reset role;

-- ── the committee''s own coordinator still passes every door (non-vacuity) ────
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select isnt(
  (select public.get_response_for_signoff('00000000-0000-0000-0000-00000000f543')),
  null,
  '9.5 NON-VACUITY TWIN ⭐: the coordinator receives the sign-off payload for f543 — gates 1+3 pass, so 9.5b''s raise was gate 2 (authority)');
select lives_ok(
  $$ select public.supersede_response((select resp_sub from f), 'motivo QO·B') $$,
  '9.6 NON-VACUITY TWIN ⭐: the coordinator SUPERSEDES the same submitted response 9.2 was refused on — same fixture, authority is the discriminator');
select lives_ok(
  $$ select public.target_case_response((select resp_phase from f9), (select cp1 from f9)) $$,
  '9.7 NON-VACUITY TWIN ⭐: the coordinator TARGETS the same case-phase response to the same live participant — the full chain (ethics-typed, live participant) is real');
select cmp_ok(
  (select count(*)::int from public.dashboard_completion_by_member('00000000-0000-0000-0000-00000000f540')),
  '>', 0,
  '9.8 NON-VACUITY TWIN ⭐ for 7.3: the coordinator DOES read completion rows on the same form — 7.3''s zero is the wall, not an empty form (7.3 shipped with no twin of its own)');
reset role;

-- =============================================================================
-- §10 — CONTROLLED-DOCUMENT DOORS, the behavioural half M6 shipped without.
-- 8.1/8.2 pinned list_commission_documents; the other NINE §4.2-ratified doors
-- rested only on M6''s structural postconditions. Same twin discipline as §9:
-- every door checks authority (42501) BEFORE its state gates, so an sa_x twin
-- that succeeds — or raises a LATER distinct code — attributes the oa_b denial
-- to authority on the same fixture.
-- =============================================================================

-- ── §10 fixtures (as postgres) ───────────────────────────────────────────────
create temp table f10 on commit drop as
  select '00000000-0000-0000-0000-00000000f701'::uuid as doca,
         '00000000-0000-0000-0000-00000000f702'::uuid as dva,
         '00000000-0000-0000-0000-00000000f703'::uuid as docb,
         '00000000-0000-0000-0000-00000000f704'::uuid as dvb;
grant select on f10 to authenticated;

-- docA: a draft document whose CURRENT version is its draft v1 (doc1''s fixture
-- never set current_version_id, which HC089s update_controlled_document even for
-- the coordinator — the missing-precondition trap, §7.1 shape 3).
insert into public.controlled_documents (id, commission_id, title, doc_type)
select f10.doca, k.comm_x, 'Documento QO·B A', 'sop' from f10, k;
insert into public.controlled_document_versions (id, document_id, version_number)
select f10.dva, f10.doca, 1 from f10;
update public.controlled_documents set current_version_id = (select dva from f10)
 where id = (select doca from f10);

-- docB: born EFFECTIVE with an OVERDUE review date (the status guard fires on
-- UPDATE/DELETE only — read from pg_trigger, not guessed — so an INSERT may carry
-- the terminal state directly; no GUC theater). This is what makes 10.9''s zero
-- falsifiable: documents_due_for_review genuinely has a row to withhold.
insert into public.controlled_documents (id, commission_id, title, doc_type, status)
select f10.docb, k.comm_x, 'Documento QO·B B', 'sop', 'effective' from f10, k;
insert into public.controlled_document_versions (id, document_id, version_number, status, effective_date, review_due_date)
select f10.dvb, f10.docb, 1, 'effective', current_date - 30, current_date - 1 from f10;
update public.controlled_documents set current_version_id = (select dvb from f10)
 where id = (select docb from f10);

-- ── the tenancy admin is DENIED at every M6 door (authority precedes state) ──
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_controlled_document((select comm_x from k), 'Documento QO·B X', 'sop') $$,
  '42501', null,
  '10.1 ⭐ WALL (M6): create_controlled_document refuses the tenancy admin');
select throws_ok(
  $$ select public.update_controlled_document((select doca from f10), 'Documento QO·B A', 'sop') $$,
  '42501', null,
  '10.2 ⭐ WALL (M6): update_controlled_document refuses the tenancy admin');
select throws_ok(
  $$ select public.set_document_version_file((select dva from f10), 'controlled/qob-a.pdf') $$,
  '42501', null,
  '10.3 ⭐ WALL (M6): set_document_version_file refuses the tenancy admin');
select throws_ok(
  $$ select public.submit_document_for_approval((select dva from f10), '[]'::jsonb) $$,
  '42501', null,
  '10.4 ⭐ WALL (M6): submit_document_for_approval refuses the tenancy admin (authority precedes the approver-array validation)');
select throws_ok(
  $$ select public.remind_document_approver((select dva from f10), (select sa_x from k)) $$,
  '42501', null,
  '10.5 ⭐ WALL (M6): remind_document_approver refuses the tenancy admin');
select throws_ok(
  $$ select public.publish_document((select dva from f10)) $$,
  '42501', null,
  '10.6 ⭐ WALL (M6): publish_document refuses the tenancy admin');
select throws_ok(
  $$ select public.supersede_document((select docb from f10)) $$,
  '42501', null,
  '10.7 ⭐ WALL (M6): supersede_document refuses the tenancy admin (docB IS vigente, so the state gate would pass — authority is what raised)');
select throws_ok(
  $$ select public.mark_document_obsolete((select docb from f10)) $$,
  '42501', null,
  '10.8 ⭐ WALL (M6): mark_document_obsolete refuses the tenancy admin (same: the state gate would pass)');
select is(
  (select count(*)::int from public.documents_due_for_review((select comm_x from k))),
  0,
  '10.9 ⭐ WALL (M6): documents_due_for_review returns ZERO rows to the tenancy admin — while docB sits vigente and OVERDUE, so the zero is the wall (10.11 proves it)');
reset role;

select test_helpers.claims_for((select ha_b from ha), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_controlled_document((select comm_x from k), 'Documento QO·B Y', 'sop') $$,
  '42501', null,
  '10.10 ⭐ (Q4 spot check): hospital_admin is refused by the same shared predicate');
reset role;

-- ── members and the coordinator still pass (non-vacuity, lifecycle order) ────
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select cmp_ok(
  (select count(*)::int from public.documents_due_for_review((select comm_x from k))),
  '>', 0,
  '10.11 NON-VACUITY TWIN ⭐: a committee MEMBER reads the overdue docB through the same door — 10.9''s zero is the wall, not an empty review queue');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.create_controlled_document((select comm_x from k), 'Documento QO·B C', 'sop') $$,
  '10.12 NO-REGRESSION TWIN ⭐: the coordinator still CREATES a document');
select lives_ok(
  $$ select public.update_controlled_document((select doca from f10), 'Documento QO·B A2', 'sop') $$,
  '10.13 NO-REGRESSION TWIN ⭐: ...still EDITS the draft header');
select lives_ok(
  $$ select public.set_document_version_file((select dva from f10), 'controlled/qob-a.pdf') $$,
  '10.14 NO-REGRESSION TWIN ⭐: ...still SETS the draft version file');
select lives_ok(
  $$ select public.submit_document_for_approval(
       (select dva from f10),
       jsonb_build_array(jsonb_build_object('approver_id', (select sa_x from k)::text))) $$,
  '10.15 NO-REGRESSION TWIN ⭐: ...still SUBMITS for approval (sa_x is an entitled approver of this hospital)');
select lives_ok(
  $$ select public.remind_document_approver((select dva from f10), (select sa_x from k)) $$,
  '10.16 NO-REGRESSION TWIN ⭐: ...still REMINDS the pending approver');
select throws_ok(
  $$ select public.publish_document((select dva from f10)) $$,
  'HC090', null,
  '10.17 TWIN (distinct-gate) ⭐: the coordinator reaches publish''s APPROVALS gate (HC090, approver still pending) — so 10.6''s 42501 was authority, not state');
select lives_ok(
  $$ select public.supersede_document((select docb from f10)) $$,
  '10.18 NO-REGRESSION TWIN ⭐: ...still SUPERSEDES the vigente document (opens draft v2)');
select lives_ok(
  $$ select public.mark_document_obsolete((select docb from f10)) $$,
  '10.19 NO-REGRESSION TWIN ⭐: ...still RETIRES the vigente document');
reset role;

select * from finish();
rollback;
