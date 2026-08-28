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
-- ⚠ THE NAMING TRAP, pinned by 0.3: app.is_tenancy_admin_of is NOT the commission's
-- own admin. It is the TENANCY admin (org_admin OR hospital_admin) and it returns
-- FALSE for staff_admin. Every policy in the estate reads
-- `is_staff_admin_of(...) OR is_tenancy_admin_of(...)`, which is why removing the
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
-- 120 → 122 (2026-08-22): §11f pins the OTHER half of the same wall — the A35 noun rule
-- for platform_admin across the three case-creation doors, twinned with its detector
-- positive control. New coverage; nothing pinned that predicate before.
select plan(122);

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
update public.profiles set full_name = 'HospAdmin QOB'
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
select is(app.is_tenancy_admin_of_for((select comm_x from k), (select oa_b from k)), true,
  '0.1 PRECONDITION ⭐: oa_b IS the tenancy admin of comm_x — without this every §1–§4 zero is vacuous');
select is(app.is_tenancy_admin_of_for((select comm_x from k), (select ha_b from ha)), true,
  '0.2 PRECONDITION ⭐: ha_b too (Q4 — hospital_admin gets the SAME wall)');
select is(app.is_tenancy_admin_of_for((select comm_x from k), (select sa_x from k)), false,
  '0.3 ⭐ THE NAMING TRAP: is_tenancy_admin_of is FALSE for the commission''s own staff_admin — it is the TENANCY admin, which is why the cut leaves the committee untouched');

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
-- ⚠ REWIRED BY DM3, NOT DELETED. `app.can_read_document_object` was the
-- `controlled-documents` bucket's SELECT predicate; DM3 M5 dropped both the
-- policy and the predicate, and byte access moved to the audited
-- `open_document_version` door via the `app.can_read_document` kernel arm
-- (member OR entitled approver). The QO·B PROPERTY these two pin — a tenancy
-- admin gets document METADATA but never document BYTES — is unchanged and must
-- outlive the mechanism that used to carry it, so they are re-expressed against
-- the kernel rather than retired with the predicate.
-- Make doc1 byte-capable first: the fixture inserted `controlled_documents`
-- DIRECTLY, so the M9 trigger gave it a registry row but no core document (the
-- trigger cannot attribute one — see 00_setup). Without this the assertions
-- below would compare against a NULL document id and pass for the wrong reason.
select test_helpers.attach_stub_file((select docver1 from f));

select is(app.can_read_document(
            (select core_document_id from public.controlled_documents
              where id = (select doc1 from f)),
            (select oa_b from k)), false,
  '2.8 ⭐ WRAPPER (was BLIND): the tenancy admin is denied the document BYTES (now via the can_read_document kernel arm)');
select is(app.can_read_document(
            (select core_document_id from public.controlled_documents
              where id = (select doc1 from f)),
            (select st_x from k)), true,
  '2.9 NON-VACUITY TWIN: ...and a committee member IS admitted, so 2.8 is the wall and not a missing/!null document');

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
      and coalesce(qual,'')||' '||coalesce(with_check,'') ~ '\yis_tenancy_admin_of\y'),
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
          ~ '\yis_tenancy_admin_of(_for)?\y'),
  0,
  '5.3 ⭐ CATALOG (A4 K2): none of the three document/print WRAPPERS routes the tenancy admin either — the half a policy-only sweep cannot see');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace='public'::regnamespace and p.prokind='f'
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g') ~ 'assert_not_case_excluded'
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g') ~ '\yis_tenancy_admin_of\y'
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
          ~ '\yis_tenancy_admin_of\y'),
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
-- DM1 (ADR 0114 D5): can_write_attachment died with the substrate; its
-- successor app.can_write_document carries the SAME wall (case arm = home
-- staff_admin only, NO tenancy arm) — asserted on a document homed on case1.
insert into public.documents (id, home_resource_id, title, created_by)
values ('31400000-0000-0000-0000-0000000000d1', (select case1 from f),
        'Documento (wall 8.3)', (select sa_x from k));
select is(app.can_write_document('31400000-0000-0000-0000-0000000000d1', (select oa_b from k)), false,
  '8.3 ⭐ WALL (M6→DM1, §4.3): the tenancy admin can no longer WRITE case documents');
select is(app.can_write_document('31400000-0000-0000-0000-0000000000d1', (select sa_x from k)), true,
  '8.4 NON-VACUITY TWIN ⭐: the committee''s own coordinator still can');
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace='public'::regnamespace and p.proname='revoke_printed_document'
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'is_tenancy_admin_of'),
  1,
  '8.5 ⭐ RULING GUARD: revoke_printed_document KEEPS its tenancy arm — ADR 0104 D11 rules revocation a GOVERNANCE act that reveals no content. A "finish the printed-doc wall" sweep must red HERE rather than silently reverse a ruling it never read');

-- ⭐ 8.6/8.7 — THE SAME GUARD, for the disposal family (PO ruling 2026-08-09, FUP-QOB-3).
-- `dispose_event_phi` and `dispose_referral_phi` KEEP a tenancy arm alongside the NSP arm.
-- The reasoning is 8.5's, applied consistently: disposal DISCLOSES NOTHING — it destroys —
-- so it is a governance act, not a content read. Two facts decided it:
--   · a hospital can have ZERO NSP operators (`Hospital Unico C` in the seed), and
--     NSP-only disposal would leave such a hospital unable to honour an LGPD Art. 18
--     erasure request — an obligation that sits with the ORGANIZATION (the *controlador*);
--   · this platform already keeps the tenancy arm on the identically-shaped
--     `revoke_printed_document`.
-- ⚠ These exist because BUG-QOB-004 cut the referral arm on 2026-08-09 and the ruling was
-- revisited the SAME DAY once those facts surfaced. Without a guard, the next "finish the
-- disposal wall" sweep re-cuts it by symmetry and re-opens the compliance gap silently.
-- The comment/whitespace stripping mirrors 8.5's: `prosrc` includes comments, and the
-- headers of both doors DISCUSS the arms.
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace='public'::regnamespace
      and p.proname in ('dispose_event_phi', 'dispose_referral_phi', 'can_dispose_referral_phi')
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'is_tenancy_admin_of'),
  3,
  '8.6 ⭐ RULING GUARD (FUP-QOB-3): all THREE referral/event disposal doors KEEP a tenancy arm — disposal reveals no content (8.5''s reasoning) and an unstaffed-NSP hospital would otherwise have nobody able to honour an erasure request');
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace='public'::regnamespace and p.proname='create_referral_draft'
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'is_tenancy_admin_of'),
  0,
  '8.7 ⭐ SCOPE GUARD for 8.6: DRAFTING a referral stays CUT. The backstop is disposal-only — without this, "restore the referral arm" reads as restoring the whole pre-QOB-004 reach');

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
-- DM3: `set_document_version_file` was replaced by
-- `attach_controlled_document_version_file` (ADR 0114 D8). The WALL property is
-- unchanged — a tenancy admin cannot attach a file — so it is re-expressed
-- against the new door rather than retired with the old one. A null core version
-- is fine here: authority is checked BEFORE the pointer is looked at, which is
-- exactly what makes this an authority assertion and not a state one.
select throws_ok(
  $$ select public.attach_controlled_document_version_file((select dva from f10), null) $$,
  '42501', null,
  '10.3 ⭐ WALL (M6): attach_controlled_document_version_file refuses the tenancy admin');
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
  $$ select test_helpers.attach_stub_file((select dva from f10)) $$,
  '10.14 NO-REGRESSION TWIN ⭐: ...still ATTACHES the draft version file');
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

-- =============================================================================
-- §11 — CASE-PLANE WRITE DOORS (M7). ⛔ THIS SECTION EXISTS BECAUSE M4 CUT A
-- PROXY POPULATION AND LEFT THE §4.4 LIST UNFULFILLED (QA r1 BLOCKER-1). M4's
-- premise — "case-content mutators = the functions carrying assert_not_case_excluded"
-- — was false: that guard came from A4-Unit-2's OWN enumeration, so every §4.4 door
-- without it stayed armed. QA reproduced live writes at BOTH tenancy tiers
-- (remove_case_participant set removed_at; record_recusal wrote a row;
-- case_viewer_capabilities advertised can_manage_lifecycle over an unreadable case).
--
-- Same twin discipline as §9/§10: authority raises a DISTINCT SQLSTATE
-- (HC0E4 / HC0J1 / 42501 / P0002-at-not-found) BEFORE the state/validation gates,
-- so a coordinator twin that succeeds or reaches a LATER code attributes the oa_b
-- denial to authority on the same fixture. These are the keystones M4 never wrote.
-- =============================================================================

-- ── §11 fixtures (as postgres — role was reset at the end of §10) ─────────────
create temp table f11 on commit drop as
  select '00000000-0000-0000-0000-00000000fb01'::uuid as case_d,   -- clean case in comm_x
         '00000000-0000-0000-0000-00000000fb02'::uuid as pt_d,     -- a participant of case_d
         '00000000-0000-0000-0000-00000000fb03'::uuid as role_d,
         '00000000-0000-0000-0000-00000000fb04'::uuid as cp_d,     -- case_participants row
         '00000000-0000-0000-0000-00000000fb05'::uuid as narr_ah,  -- an AD-HOC narrative
         '00000000-0000-0000-0000-00000000fb06'::uuid as rec_live, -- a live recusal (st_x) to lift
         '00000000-0000-0000-0000-00000000fb07'::uuid as tag_d,
         '00000000-0000-0000-0000-00000000fb08'::uuid as case_e,   -- case_e: sa_x RECUSED (MAJOR-1)
         '00000000-0000-0000-0000-00000000fb09'::uuid as narr_e,
         '00000000-0000-0000-0000-00000000fb10'::uuid as phase_ah; -- an AD-HOC phase
grant select on f11 to authenticated;

insert into public.cases (id, commission_id, organization_id, case_number, label, created_by)
select f11.case_d, k.comm_x, k.org_b, 990911, 'Caso M7 D', k.sa_x from f11, k;
insert into public.cases (id, commission_id, organization_id, case_number, label, created_by)
select f11.case_e, k.comm_x, k.org_b, 990912, 'Caso M7 E', k.sa_x from f11, k;

insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
select f11.pt_d, k.org_b, 'other', 'non_sensitive', 'Alvo M7 D' from f11, k;
insert into public.case_participant_roles (id, organization_id, key, display_name, allowed_participant_types)
select f11.role_d, k.org_b, 'm7d_alvo', 'Alvo M7 D', array['other'] from f11, k;
insert into public.case_participants (id, case_id, participant_id, role_id)
select f11.cp_d, f11.case_d, f11.pt_d, f11.role_d from f11;

-- An AD-HOC narrative + AD-HOC phase on case_d (the delete doors reject a
-- template-derived one before authority is even relevant, so the twin needs a
-- genuinely ad-hoc row to reach past the authority gate).
insert into public.case_narratives (id, case_id, display_label, display_position, status, is_ad_hoc)
select f11.narr_ah, f11.case_d, 'Avulsa M7', 1, 'open', true from f11;
insert into public.case_phases (id, case_id, position, title, form_id, form_version_id, status, is_ad_hoc)
select f11.phase_ah, f11.case_d, 1, 'Fase avulsa M7', k.form_u, k.ver_u, 'pending', true from f11, k;

-- A live recusal of st_x on case_d — lift_recusal's twin lifts it.
insert into public.case_recusals (id, case_id, user_id, reason_md, source, recused_by)
select f11.rec_live, f11.case_d, k.st_x, 'fixture', 'coordinator', k.sa_x from f11, k;

insert into public.case_tags (id, commission_id, name)
select f11.tag_d, k.comm_x, 'Tag M7 D' from f11, k;
insert into public.case_tag_assignments (case_id, tag_id)
select f11.case_d, f11.tag_d from f11;

-- A narrative on case_e (for the MAJOR-1 zero-row narrative probe).
insert into public.case_narratives (id, case_id, display_label, display_position, status)
select f11.narr_e, f11.case_e, 'Resumo M7 E', 1, 'open' from f11;
-- case_e: recuse sa_x from it, so sa_x passes authority (staff arm) but RLS hides
-- the row — the exact MAJOR-1 shape the four INVOKER doors returned SUCCESS on.
insert into public.case_recusals (case_id, user_id, reason_md, source, recused_by)
select f11.case_e, k.sa_x, 'exclusão M7', 'coordinator', k.sa_x from f11, k;

-- ── §11a — the tenancy admin is DENIED at every M7 door ───────────────────────
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.remove_case_participant((select cp_d from f11)) $$, 'HC0E4', null,
  '11.1 ⭐⭐ WALL (M7): remove_case_participant refuses the tenancy admin on AUTHORITY (pre-M7 this SET removed_at — QA r1 BLOCKER-1)');
select throws_ok(
  $$ select public.set_case_participant_role((select cp_d from f11), (select role_d from f11)) $$, 'HC0E4', null,
  '11.2 ⭐ WALL (M7): set_case_participant_role refuses on AUTHORITY (HC0E4, before the HC0E3 validation 11.19 reaches)');
select throws_ok(
  $$ select public.set_primary_subject((select cp_d from f11)) $$, 'HC0E4', null,
  '11.3 ⭐ WALL (M7): set_primary_subject refuses the tenancy admin');
select throws_ok(
  $$ select public.add_case_participant((select case_d from f11), (select pt_d from f11), (select role_d from f11)) $$, 'HC0E4', null,
  '11.4 ⭐ WALL (M7): add_case_participant refuses the tenancy admin (the §4.4 sibling M4''s text omitted)');
select throws_ok(
  $$ select public.record_recusal((select case_d from f11), (select st_x2 from k), 'x') $$, 'P0002', null,
  '11.5 ⭐⭐ WALL (M7): record_recusal refuses the tenancy admin (pre-M7 it WROTE a case_recusals row — QA r1 BLOCKER-1). Raw not-found posture: authority failure = the no-reach not-found');
select throws_ok(
  $$ select public.lift_recusal((select rec_live from f11), 'x') $$, 'HC0E4', null,
  '11.6 ⭐ WALL (M7): lift_recusal refuses the tenancy admin (QA r1 INFO-2 resolved: it was a LIVE leak, ADMITTED pre-M7 on a live recusal)');
select throws_ok(
  $$ select public.schedule_ethics_hearing((select case_d from f11), 'initial_hearing') $$, 'HC0J1', null,
  '11.7 ⭐ WALL (M7): schedule_ethics_hearing refuses on AUTHORITY (HC0J1, before the HC0J0 ethics-state gate 11.20 reaches)');
select throws_ok(
  $$ select public.delete_ad_hoc_case_narrative((select narr_ah from f11)) $$, '42501', null,
  '11.8 ⭐ WALL (M7): delete_ad_hoc_case_narrative refuses the tenancy admin');
select throws_ok(
  $$ select public.delete_ad_hoc_case_phase((select phase_ah from f11)) $$, '42501', null,
  '11.9 ⭐ WALL (M7): delete_ad_hoc_case_phase refuses the tenancy admin');
select throws_ok(
  $$ select public.cancel_case((select case_d from f11)) $$, '42501', null,
  '11.10 ⭐ WALL (M7): cancel_case refuses the tenancy admin on AUTHORITY (pre-M7 it returned SUCCESS writing nothing — MAJOR-1)');
select throws_ok(
  $$ select public.close_case((select case_d from f11)) $$, '42501', null,
  '11.11 ⭐ WALL (M7): close_case refuses the tenancy admin on AUTHORITY');
select throws_ok(
  $$ select public.set_case_outcome((select case_d from f11), null) $$, 'P0002', null,
  '11.12 ⭐ WALL (M7): set_case_outcome refuses the tenancy admin. INVOKER: its lookup reads public.cases directly under RLS, which A4 walls, so the deny is the RLS not-found (P0002) BEFORE the arm-cut authority gate — it never had the silent-success shape (measured)');
select throws_ok(
  $$ select public.update_case_narrative_body((select narr_ah from f11), 'M7-HACK') $$, 'P0002', null,
  '11.13 ⭐ WALL (M7): update_case_narrative_body refuses the tenancy admin (§4.4-listed; the false TS comment cited this). INVOKER lookup joins case_narratives→cases under RLS → not-found P0002 before authority');
select throws_ok(
  $$ select public.bulk_create_cases((select ver_u from k)::uuid, null, 'todas', '[]'::jsonb) $$, null, null,
  '11.14 ⭐ WALL (M7): bulk_create_cases refuses the tenancy admin (raises — not-found or 42501; the door is closed either way)');
select is((select count(*)::int from public.case_tag_report((select comm_x from k))), 0,
  '11.15 ⭐ WALL (M7): case_tag_report returns ZERO rows to the tenancy admin (pre-M7 it reported the commission''s tags)');
select is(
  ((select public.case_viewer_capabilities((select case_d from f11)))->>'can_manage_lifecycle')::boolean, false,
  '11.16 ⭐⭐ WALL (M7): case_viewer_capabilities reports can_manage_lifecycle=FALSE for the tenancy admin (pre-M7 it advertised lifecycle authority over an unreadable case — the BUG-QOB-002 shape stated by the platform about itself, QA r1)');
reset role;

-- ── §11b — Q4 spot check: hospital_admin gets the same wall ──────────────────
select test_helpers.claims_for((select ha_b from ha), false);
set local role authenticated;
select throws_ok(
  $$ select public.remove_case_participant((select cp_d from f11)) $$, 'HC0E4', null,
  '11.17 ⭐ (Q4): hospital_admin is refused by the same shared predicate — the case wall is not org_admin-only (QA r1 measured hospitaladmin.a1 writing pre-M7)');
select is(
  ((select public.case_viewer_capabilities((select case_d from f11)))->>'can_manage_lifecycle')::boolean, false,
  '11.18 ⭐ (Q4): ...and case_viewer_capabilities denies hospital_admin lifecycle authority too');
reset role;

-- ── §11c — the coordinator twins (non-vacuity; each shares 11.x''s fixture) ───
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.set_case_participant_role((select cp_d from f11), (select role_d from f11)) $$,
  '11.19 NON-VACUITY TWIN ⭐: the coordinator SETS the participant role (idempotent to role_d) — so 11.2''s HC0E4 was authority, not a dead door');
select throws_ok(
  $$ select public.schedule_ethics_hearing((select case_d from f11), 'initial_hearing') $$, 'HC0J0', null,
  '11.20 TWIN (distinct-gate) ⭐: the coordinator REACHES schedule_ethics_hearing''s ethics-typed gate (HC0J0, case is not ethics) — so 11.7''s HC0J1 was authority');
select throws_ok(
  $$ select public.bulk_create_cases((select ver_u from k)::uuid, null, 'todas', '[]'::jsonb) $$, null, null,
  '11.21 TWIN ⭐: the coordinator REACHES bulk_create_cases past authority (raises at template/scope validation, a DIFFERENT gate than 11.14''s) — non-vacuity of the door''s reachability');
select cmp_ok((select count(*)::int from public.case_tag_report((select comm_x from k))), '>', 0,
  '11.22 NON-VACUITY TWIN ⭐: the coordinator reads tag_report rows on the same commission — 11.15''s zero is the wall, not an empty commission');
select is(
  ((select public.case_viewer_capabilities((select case_d from f11)))->>'can_manage_lifecycle')::boolean, true,
  '11.23 NON-VACUITY TWIN ⭐: the coordinator DOES hold can_manage_lifecycle on the same case — 11.16''s false is the wall');
select lives_ok(
  $$ select public.record_recusal((select case_d from f11), (select st_x2 from k), 'twin') $$,
  '11.24 NON-VACUITY TWIN ⭐: the coordinator WRITES the recusal 11.5 was refused (same case, same target) — authority is the discriminator');
select lives_ok(
  $$ select public.lift_recusal((select rec_live from f11), 'twin') $$,
  '11.25 NON-VACUITY TWIN ⭐: the coordinator LIFTS the live recusal 11.6 was refused');
select lives_ok(
  $$ select public.remove_case_participant((select cp_d from f11)) $$,
  '11.26 NON-VACUITY TWIN ⭐: the coordinator REMOVES the participant 11.1/11.17 were refused (removed_at set) — the pre-M7 leak, now coordinator-only');
reset role;

-- ── §11d — MAJOR-1: the two silent-success INVOKER doors now RAISE ────────────
-- An EXCLUDED staff_admin (sa_x, recused from case_e) resolves the commission via
-- the DEFINER helper app.commission_of_case (RLS-exempt), passes the staff-arm
-- authority gate, then the terminal DML runs under RLS and touches ZERO rows.
-- ⚠ MEASURED, and it corrects QA r1's set of four: ONLY cancel_case and close_case
-- had the silent-success shape (pre-M7 both returned SUCCESS with the case
-- unchanged). set_case_outcome and update_case_narrative_body read cases /
-- case_narratives DIRECTLY under RLS at their own lookup, so an excluded principal
-- is denied there (P0002) and never reached the DML — they never silently
-- succeeded (11.29/11.30 assert that denial; their zero-row guard is a defensive
-- backstop, NOT the load-bearing gate, so the b1 audit red-proves the guard on
-- cancel_case/close_case only). 11.31 is the positive control: the SAME
-- coordinator cancels the case they are NOT excluded from.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.cancel_case((select case_e from f11)) $$, 'P0002', null,
  '11.27 ⭐⭐ MAJOR-1: cancel_case RAISES not-found for the excluded coordinator via the NEW zero-row guard (pre-M7 it reported SUCCESS on a zero-row update — the silent no-op QA r1 measured; the b1 audit reverts the guard and this reds)');
select throws_ok(
  $$ select public.close_case((select case_e from f11)) $$, 'P0002', null,
  '11.28 ⭐ MAJOR-1: close_case RAISES not-found via the zero-row guard (also no longer SKIPS the HC031 phase gate over RLS-invisible phases)');
select throws_ok(
  $$ select public.set_case_outcome((select case_e from f11), null) $$, 'P0002', null,
  '11.29 MAJOR-1 (denies at LOOKUP, not silent): set_case_outcome''s RLS lookup already refuses the excluded coordinator — it never had the silent-success shape; asserted so the record is honest');
select throws_ok(
  $$ select public.update_case_narrative_body((select narr_e from f11), 'X') $$, 'P0002', null,
  '11.30 MAJOR-1 (denies at LOOKUP, not silent): update_case_narrative_body''s RLS join already refuses the excluded coordinator');
select lives_ok(
  $$ select public.cancel_case((select case_d from f11)) $$,
  '11.31 NON-VACUITY TWIN ⭐: the SAME coordinator cancels the case they are NOT excluded from (case_d) — so 11.27''s raise is the zero-row guard, not a broken door');
reset role;

-- ── §11e — CATALOG invariants: masked strips + the ratified-list correspondence ─
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace='public'::regnamespace and p.prokind='f'
      and p.proname in ('get_case_detail','list_my_cases')
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'is_tenancy_admin_of'),
  0,
  '11.32 ⭐ CATALOG (MINOR-1): get_case_detail + list_my_cases no longer NAME the tenancy admin — the masked tokens are stripped, so a future outer-predicate widening cannot silently arm them');
select is(
  (select count(*)::int from pg_policies
    where schemaname='public' and tablename='case_events'
      and coalesce(qual,'')||' '||coalesce(with_check,'') ~ 'is_tenancy_admin_of'),
  0,
  '11.33 ⭐ CATALOG (MINOR-1): not one case_events policy still carries the masked tenancy arm');
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace='public'::regnamespace and p.prokind='f'
      and p.proname = any(array[
        'update_case_meta','create_case','create_case_from_template','close_case','cancel_case',
        'reopen_case','update_case_custom_field_values','conclude_narrative','unassign_narrative',
        'update_case_narrative_body','delete_ad_hoc_case_narrative','delete_ad_hoc_case_phase',
        'reassign_phase','set_case_phase_result_override','set_case_participant_role',
        'remove_case_participant','set_primary_subject','set_case_outcome','record_recusal',
        'lift_recusal','create_interview','schedule_ethics_hearing','get_case_detail','list_my_cases',
        'case_viewer_capabilities','case_tag_report','dispose_case_phi','add_case_participant','bulk_create_cases'])
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'is_tenancy_admin_of'),
  0,
  '11.34 ⭐ CATALOG (BLOCKER-1 CORRESPONDENCE): every one of the 29 ratified §4.4 CUT-side doors is armless — the population is the LIST, checked item by item, not M4''s proxy');
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace='public'::regnamespace
      and p.proname = any(array['grant_case_access','revoke_case_access','list_case_access',
                                'set_case_visibility','set_case_confidentiality'])
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'is_tenancy_admin_of'),
  5,
  '11.35 ⭐ OVER-CUT GUARD (Q8/Q9): all FIVE ratified case-access/classification KEEP doors still admit the tenancy admin — M7 cut the list MINUS these, not the whole plane');

-- ── §11f — THE OTHER HALF OF THE SAME WALL: the PLATFORM admin (ADR 0078 A35) ──
--
-- ⚠ NEW COVERAGE, NOT A RESTORATION — say so, because "we already had this" is exactly how
-- the gap survived. Everything above this line pins `is_tenancy_admin_of` (org_admin /
-- hospital_admin). NOTHING in this repo pinned `app.is_admin()` (platform_admin) anywhere,
-- on any door — grepped across supabase/tests, zero hits. The `bulk_create_cases` body
-- nonetheless carried a comment reading "NO app.is_admin() DISJUNCT AND NO TENANCY ARM.
-- Test 314 §11.34 is a CATALOG assertion…", which claims §11.34 covers both halves. It does
-- not: 11.34 checks the tenancy predicate and only that. So the platform-admin half was
-- asserted in prose, believed, and pinned nowhere — and on `create_case` the arm was
-- actually PRESENT the whole time (QA B1, then the PO ruling of 2026-08-22 that removed
-- it). The comment is corrected by migration 20261003000900; these two pins are the
-- coverage it now points at.
--
-- ⛔ SAME WALL, DIFFERENT PREDICATE. A35's noun rule and QO·B's content wall say the same
-- thing about two different principal classes: administration may shape CONTAINERS, never
-- committee CONTENT. A case is content. That is why this lives here rather than beside one
-- door — a per-door pin is what let two of the three creation doors agree while the third
-- silently disagreed.
--
-- ⭐ TWINNED, because a zero from a regexp is worthless until the regexp is shown able to
-- return non-zero. 11.37 is that proof, on the SAME predicate, the SAME comment-stripping,
-- and the SAME query shape.
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace='public'::regnamespace and p.prokind='f'
      and p.proname = any(array['create_case','create_case_from_template','bulk_create_cases'])
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'app\.is_admin\s*\('),
  0,
  '11.36 ⭐ CATALOG (A35 noun rule): not ONE of the three case-creation doors names the platform-admin predicate. The population is the LIST — all three checked item by item — because the defect this replaces was precisely a family whose members disagreed: create_case carried the arm while create_case_from_template and bulk_create_cases never did');
select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace='public'::regnamespace and p.prokind='f'
      and p.proname = any(array['create_framework','update_framework','set_framework_status',
                                'upsert_standard','delete_standard','verify_audit_chain'])
      and regexp_replace(regexp_replace(p.prosrc,'/\*.*?\*/',' ','gs'),'--[^'||chr(10)||']*',' ','g')
          ~ 'app\.is_admin\s*\('),
  6,
  '11.37 ⭐ DETECTOR POSITIVE CONTROL for 11.36: these six vocabulary/catalog/audit doors DO still name it, so 11.36''s zero means "the arm is absent", not "the regexp matches nothing" or "the comment strip ate the body". ⚠ NOT A RULING that they should — A35 explicitly ALLOWS platform_admin to administer vocabulary and audit, so today''s state is the honest anchor; if the PO ever rules on these, change this number deliberately rather than treating a red as noise');

-- =============================================================================
-- §12 — Q2 KEEP: the process-template DEFINER doors (`20260917000100`).
--
-- Q2 puts `process_template_*` on the KEEP side — a template is a CONTAINER the admin
-- shapes. All 16 process_template POLICIES already carried the tenancy arm, but two
-- SECURITY DEFINER doors gated on `is_staff_admin_of` alone, and a DEFINER's gate
-- REPLACES RLS. Measured before the fix: a bare tenancy admin could write both target
-- columns by direct DML through the FOR ALL write policy while both doors answered
-- 42501 — so the doors were refusing an authorization that was already live, which is
-- why closing the gap is not a widening.
--
-- ⚠ TWO doors, not one. The follow-up named only `set_template_case_type`;
-- `set_template_patient_mode` (ADR 0137 D1; formerly `set_template_collects_patient`)
-- is the identical shape on the identical table and was
-- found by sweeping the plane BY PROPERTY. Both are pinned here so a future "finish the
-- template wall" sweep cannot silently reverse the ruling on either.
-- =============================================================================
-- Flag explicitly, never by inheritance: set_template_patient_mode calls
-- assert_case_patient_enabled() FIRST, so a flag-off fixture would make 12.3 raise
-- check_violation and report a PASS-shaped skip of the authority it means to test.
update app.feature_flags set enabled = true where key = 'case_patient';

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tq2 on commit drop as
  select (public.create_process_template((select comm_x from k), 'QOB Q2 Template', null)).id as tid,
         null::uuid as vid;
update tq2 set vid = app.draft_version_of_template(tid);
grant select on tq2 to authenticated;
reset role;

select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.set_template_case_type((select vid from tq2), null) $$,
  '12.1 ⭐ KEEP DOOR (Q2): the tenancy admin declares a template''s case type — it shapes the container. Pre-20260917000100 this answered 42501 while the same principal could write the column by direct DML');
select lives_ok(
  $$ select public.set_template_patient_mode((select vid from tq2), 'optional') $$,
  '12.2 ⭐ KEEP DOOR (Q2) — THE TWIN THE FOLLOW-UP DID NOT NAME: same shape, same table, same defect. Fixing only its sibling would have left the plane half-consistent');
reset role;

select test_helpers.claims_for((select ha_b from ha), false);
set local role authenticated;
select lives_ok(
  $$ select public.set_template_case_type((select vid from tq2), null) $$,
  '12.3 ⭐ Q4 SAME WALL: hospital_admin reaches it too — walling or opening only org_admin leaves a documented bypass');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.set_template_case_type((select vid from tq2), null) $$,
  '12.4 NO-REGRESSION TWIN ⭐: the coordinator STILL reaches it. Without this, 12.1/12.3 would also pass if the edit had broken the door open for everyone');
reset role;

-- ⭐ THE OVER-GRANT TWIN. A no-regression claim passes BY CONSTRUCTION when an arm is
-- widened; only a negative can show the widening stopped where it was meant to.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_template_case_type((select vid from tq2), null) $$,
  '42501', null,
  '12.5 ⭐⭐ OVER-GRANT TWIN: a PLAIN MEMBER of the very same commission is still REFUSED — the Q2 arm admits the tenancy tier, it did not become a blanket allow');
reset role;

-- ⭐ THE CONTROL ON THE OTHER SIDE OF THE D12 LINE. create_case_from_template lives on
-- the same plane and must NOT have inherited the arm: it creates a CASE, which is
-- content. This is the behavioural half of the migration's catalog postcondition.
--
-- ⚠ TWO fixture traps here, both hit while writing this and both recorded so the next
-- author does not re-learn them:
--   (a) the first argument is a TEMPLATE id, not a version id — passing `vid` makes the
--       door raise `no_data_found` at step 1 (template unknown), which LOOKS like the
--       denial being asserted and measures nothing;
--   (b) the not-permitted branch deliberately raises `no_data_found` (P0002), NOT 42501,
--       so an unauthorized caller cannot use the error to probe template existence.
--       Asserting 42501 here fails for a reason that has nothing to do with authority.
--   (c) pass the 5-char SQLSTATE, never the condition NAME: throws_ok treats a second
--       argument that is not exactly 5 characters as the expected MESSAGE, so
--       'no_data_found' silently became a message comparison against pt-BR text and
--       red-flagged a door that was behaving correctly.
-- Because tq2 is DRAFT-ONLY, an AUTHORIZED caller stops one gate later at
-- `check_violation` ("apenas processos publicados") — which is what makes 12.6
-- non-vacuous: the two principals are separated by WHICH gate stops them, not by
-- whether something raised.
select test_helpers.claims_for((select oa_b from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_case_from_template((select tid from tq2), 'QOB Q2 CASO', null, null) $$,
  'P0002', null,
  '12.6 ⭐ D12 LINE CONTROL: the SAME tenancy admin that just configured the template is stopped AT AUTHORITY when creating a case FROM it — shaping the container is KEEP, filling it is CUT');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_case_from_template((select tid from tq2), 'QOB Q2 CASO', null, null) $$,
  '23514', null,
  '12.7 ⭐ NON-VACUITY TWIN for 12.6: the coordinator passes authority and reaches the LATER published-version gate — so 12.6 measures the authority arm, not a template that nobody can use');
reset role;

select * from finish();
rollback;
