-- =============================================================================
-- QO·A keystones — the S7 quality_reviewer arm of app._case_caps (M4;
-- ADR 0100 D3/D4/D5/D6/D7) + its row-level and board propagation.
--
-- THE keystone is 1.1: an EXACT-bitmask equality (= 5), not a bit test — the
-- deliberate ABSENCES (deliberation D4, PHI D5, write D7) are asserted in the
-- same number as the presences, so an arm that quietly over-confers reds this
-- file, not a review.
--
-- Permissive-sibling audit (authz-handoff §7.1·6) for §4's row assertions:
-- public.cases carries exactly cases_select (routes can_read_case -> the
-- resolver) and cases_staff_admin_write (FOR ALL, staff_admin AND NOT
-- excluded). The reviewer principals here hold NO staff_admin membership, so
-- the write policy cannot admit them — the resolver is the only path. Proven
-- non-vacuous by q1 case strip_s7 (this file's positives go red).
--
-- RED-FIRST record: pre-M4 the qr bitmask reads 0 and 1.1/1.2/4.x abort or
-- red; the §2/§3 zeros alone would be green-for-the-wrong-reason, which is why
-- 3.3 re-proves reach AFTER every deny fixture is removed.
-- =============================================================================

begin;
-- 27 → 30: the §5.2 SENTINEL (QA r1 P0-1 closure) — the prose obligation at
-- §5 became three live assertions; this file now REDS if the byte cut is
-- ever removed from open_document_version, instead of running green over an
-- unmet obligation (the tombstone did exactly that all phase — a finding).
select plan(30);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'oa_b')::uuid   as oa_b,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'org_b')::uuid  as org_b,
         (v->>'hosp_b')::uuid as hosp_b
  from ctx;
grant select on k to authenticated;

-- Personas: qr = reviewer of hosp_b (the arm under test) · qr_h2 = reviewer of
-- a SECOND hospital of the SAME org (hospital-scope proof, D1) · qr_f =
-- reviewer in a FOREIGN org (tenancy proof).
create temp table p on commit drop as
  select gen_random_uuid() as qr, gen_random_uuid() as qr_h2, gen_random_uuid() as qr_f,
         gen_random_uuid() as hosp2b,
         gen_random_uuid() as org2, gen_random_uuid() as hosp3;
grant select on p to authenticated;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.id || '@test', now(), now()
from (select qr as id from p union all select qr_h2 from p union all select qr_f from p) u;

insert into public.hospitals (id, organization_id, name, slug)
select p.hosp2b, k.org_b, 'Hosp QO Second', 'hosp-qo3-' || substr(p.hosp2b::text, 1, 8) from p, k;
insert into public.organizations (id, name, slug)
select org2, 'Org QO3 Foreign', 'org-qo3-' || substr(org2::text, 1, 8) from p;
insert into public.hospitals (id, organization_id, name, slug)
select hosp3, org2, 'Hosp QO3 Foreign', 'hosp-qo4-' || substr(hosp3::text, 1, 8) from p;

insert into public.memberships (organization_id, hospital_id, principal_id, role)
select k.org_b, k.hosp_b,  p.qr,    'quality_reviewer' from k, p union all
select k.org_b, p.hosp2b,  p.qr_h2, 'quality_reviewer' from k, p union all
select p.org2,  p.hosp3,   p.qr_f,  'quality_reviewer' from p;

-- comm_x -> visible (the GUC bracket — the guard is live in this suite);
-- comm_y (SAME hospital) stays 'excluded' — the sharp same-hospital denial.
select set_config('app.in_commission_rpc', 'on', true);
update public.commissions set quality_oversight = 'visible'
  where id = (select comm_x from k);
select set_config('app.in_commission_rpc', 'off', true);

create temp table cs on commit drop as
  select '00000000-0000-0000-0000-0000000d8001'::uuid as case_a,
         '00000000-0000-0000-0000-0000000d8002'::uuid as case_eg,
         '00000000-0000-0000-0000-0000000d8003'::uuid as case_y;
grant select on cs to authenticated;

insert into public.cases (id, commission_id, case_number, created_by, visibility_policy)
select cs.case_a,  k.comm_x, 99801, k.sa_x, 'commission_default'   from cs, k union all
select cs.case_eg, k.comm_x, 99802, k.sa_x, 'explicit_grants_only' from cs, k union all
select cs.case_y,  k.comm_y, 99803, k.sa_x, 'commission_default'   from cs, k;

-- =============================================================================
-- §1 — THE EXACT BITMASK (D3) and its projections.
-- =============================================================================

select is(
  app._case_caps((select case_a from cs), (select qr from p)),
  app._cap_bit('read_case_content') | app._cap_bit('view_case_overview'),
  '1.1 EXACT MASK ⭐⭐: reviewer = read_case_content | view_case_overview (5) and NOTHING else — absences (D4/D5/D7) asserted in the same equality as presences');

select ok(
  app.can_read_case((select case_a from cs), (select qr from p)),
  '1.2 can_read_case projects the arm (cases_select + list_cases_board inherit)');

select ok(
  not app.can_read_case_patient((select case_a from cs), (select qr from p)),
  '1.3 PHI STAYS CLOSED ⭐ (D5/Rule 12): the reviewer never reaches read_standard_phi');

-- ⚠ 1.4 WAS THE PHASE'S SHARPEST ARTIFACT and is kept only as the bit-level
-- half. It asserted `not can_write_case_content` and READ like the D7 pin —
-- but the three authenticated write doors that admitted the reviewer
-- (declare_conflict, file_correction_request, record_recusal) gate on
-- `can_read_case` and NEVER CONSULT that bit, so it certified nothing about the
-- actual write surface. A present test that certifies the wrong thing is worse
-- than an absent one. The real pin is §6, enumerated per door.
select ok(
  not app.can_write_case_content((select case_a from cs), (select qr from p)),
  '1.4 no write BIT (necessary, NOT sufficient — the D7 door pin is §6; this bit is consulted by no admitting door)');

select ok(
  not app.has_case_capability((select case_a from cs), (select qr from p), 'read_case_deliberation'),
  '1.5 DELIBERATION EXCLUDED (D4): the S3/S4 read-closure rung is deliberately NOT applied to S7');

select is(
  app._case_caps((select case_a from cs), (select sa_x from k)),
  app._cap_bit('view_case_overview') | app._cap_bit('read_case_deliberation')
    | app._cap_bit('read_case_content') | app._cap_bit('read_standard_phi')
    | app._cap_bit('write_case_content') | app._cap_bit('manage_case_access'),
  '1.6 NON-VACUITY: the coordinator mask on the same case is the full S1 set — the probe discriminates arms');

-- =============================================================================
-- §2 — THE ZERO SURFACE: every boundary of the arm resolves to bitmask 0.
-- =============================================================================

select is(
  app._case_caps((select case_eg from cs), (select qr from p)),
  0,
  '2.1 LOCKED CASE ⭐ (D6): explicit_grants_only is fully invisible to the arm');

select is(
  app._case_caps((select case_y from cs), (select qr from p)),
  0,
  '2.2 EXCLUDED COMMISSION ⭐ (D8): same hospital, not opted in — nothing');

select is(
  app._case_caps((select case_a from cs), (select qr_h2 from p)),
  0,
  '2.3 HOSPITAL SCOPE (D1): a reviewer of ANOTHER hospital of the SAME org gets nothing');

select is(
  app._case_caps((select case_a from cs), (select qr_f from p)),
  0,
  '2.4 TENANCY: a foreign-org reviewer gets nothing');

update public.memberships m set expires_at = now() - interval '1 hour'
  where m.principal_id = (select qr from p) and m.role = 'quality_reviewer';
select is(
  app._case_caps((select case_a from cs), (select qr from p)),
  0,
  '2.5 EXPIRED: the has_role expiry filter reaches S7');
update public.memberships m set expires_at = null
  where m.principal_id = (select qr from p) and m.role = 'quality_reviewer';

update public.profiles set is_active = false where id = (select qr from p);
select is(
  app._case_caps((select case_a from cs), (select qr from p)),
  0,
  '2.6 DEACTIVATED: the STEP-2 outer gate precedes the arm');
update public.profiles set is_active = true where id = (select qr from p);

select set_config('app.in_commission_rpc', 'on', true);
update public.commissions set quality_oversight = 'excluded' where id = (select comm_x from k);
select set_config('app.in_commission_rpc', 'off', true);
select is(
  app._case_caps((select case_a from cs), (select qr from p)),
  0,
  '2.7 LIVE CLASSIFICATION: opting the commission back out closes the arm immediately');
select set_config('app.in_commission_rpc', 'on', true);
update public.commissions set quality_oversight = 'visible' where id = (select comm_x from k);
select set_config('app.in_commission_rpc', 'off', true);

-- =============================================================================
-- §3 — HARD-DENY INHERITANCE (STEP 4 precedes S7 by position — proven, both
-- arms, then reach is re-proven so the §2 zeros can't ride a leftover deny.
-- =============================================================================

insert into public.case_recusals (case_id, user_id, source)
values ((select case_a from cs), (select qr from p), 'coordinator');
select is(
  app._case_caps((select case_a from cs), (select qr from p)),
  0,
  '3.1 RECUSED ⭐: the hard deny out-votes the reviewer arm');
delete from public.case_recusals
  where case_id = (select case_a from cs) and user_id = (select qr from p);

-- Respondent leg: the full participants machinery, aimed at qr.
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
values ('00000000-0000-0000-0000-0000000d8101', (select org_b from k), 'professional',
        'professional_identity', 'Dra. Revisora Ré');
insert into public.professional_profiles (id, organization_id, user_id, full_name)
values ('00000000-0000-0000-0000-0000000d8102', (select org_b from k), (select qr from p), 'Dra. Revisora Ré');
insert into public.professional_participants (participant_id, professional_profile_id)
values ('00000000-0000-0000-0000-0000000d8101', '00000000-0000-0000-0000-0000000d8102');
insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
values ('00000000-0000-0000-0000-0000000d8103', (select org_b from k), 'respondent_doctor',
        'Médico denunciado', array['professional'], true);
insert into public.case_participants (id, case_id, participant_id, role_id, is_primary_subject)
values ('00000000-0000-0000-0000-0000000d8104', (select case_a from cs),
        '00000000-0000-0000-0000-0000000d8101', '00000000-0000-0000-0000-0000000d8103', true);

select is(
  app._case_caps((select case_a from cs), (select qr from p)),
  0,
  '3.2 RESPONDENT ⭐ (Rule 12 adjacency): a reviewer who is the case respondent is denied outright');
delete from public.case_participants where id = '00000000-0000-0000-0000-0000000d8104';

select is(
  app._case_caps((select case_a from cs), (select qr from p)),
  app._cap_bit('read_case_content') | app._cap_bit('view_case_overview'),
  '3.3 FIXTURE HYGIENE ⭐ (§7.1·1): with every deny removed, reach returns — the §2/§3 zeros were the denies, not a broken arm');

-- =============================================================================
-- §4 — ROW-LEVEL + BOARD PROPAGATION, and the D6 grant exception.
-- =============================================================================

select test_helpers.claims_for((select qr from p), false);
set local role authenticated;

select is(
  (select count(*)::int from public.cases),
  1,
  '4.1 RLS: the reviewer''s whole cases universe is exactly case_a (locked + excluded-commission rows invisible)');

select is(
  (select count(*)::int from public.cases c, cs where c.id in (cs.case_eg, cs.case_y)),
  0,
  '4.2 ...and neither boundary row leaks by direct id');

select is(
  (select count(*)::int from public.list_cases_board((select comm_x from k), 50)),
  1,
  '4.3 list_cases_board serves the reviewer exactly the readable row (per-row can_read_case — no short-circuit)');

select is(
  (select count(*)::int from public.list_cases_board((select comm_y from k), 50)),
  0,
  '4.4 ...and the excluded commission''s board is empty for them');
reset role;

insert into public.case_access_grants
  (case_id, principal_id, source, read_case_content, read_case_deliberation,
   read_standard_phi, read_restricted_phi, write_case_content, reason_code, granted_by)
values ((select case_eg from cs), (select qr from p), 'manual_grant',
        true, false, false, false, false, 'coordinator_grant', (select sa_x from k));

select is(
  app._case_caps((select case_eg from cs), (select qr from p)),
  app._cap_bit('read_case_content') | app._cap_bit('read_case_deliberation'),
  '4.5 D6 EXCEPTION PATH: an explicit grant on a locked case admits via S3 (content + S3''s read closure), NOT via S7 — no overview bit, so the mask discriminates the arm');

-- =============================================================================
-- §5 — THE BYTES LAYER (M8, lead ruling 2026-08-06). Live-probed before the cut:
-- the reviewer READ standard-tier case bytes through
-- attachments_obj_select_readable -> can_read_case -> S7 — an un-audited,
-- PHI-capable path no threading list named. The cut: case/interview BYTES
-- additionally require read_case_deliberation — which every content source
-- except S7 confers (the load-bearing lattice invariant; q1 `open_bytes_cut`
-- proves 5.2 can fail). Metadata stays reviewer-visible (the panel renders
-- names, links stay dead by DB fact, not UI choice — Rule 1).
-- =============================================================================

-- DM1 (ADR 0114 D5/D8): the probe attachments became case-HOMED documents.
-- 5.1 (metadata stays reviewer-visible) is PRESERVED on the successor —
-- can_read_document's case arm is can_read_case, exactly what S7 confers.
insert into public.documents (id, home_resource_id, title, created_by)
select '00000000-0000-0000-0000-0000000d8201'::uuid, cs.case_a, 'Doc QO', k.sa_x
from cs, k
union all
select '00000000-0000-0000-0000-0000000d8202'::uuid, cs.case_eg, 'Doc QO EG', k.sa_x
from cs, k;

select test_helpers.claims_for((select qr from p), false);
set local role authenticated;

select is(
  (select count(*)::int from public.documents d, cs
    where d.home_resource_id = cs.case_a),
  1,
  '5.1 METADATA stays reviewer-visible: the documents panel renders the file NAME (can_read_document''s case arm = can_read_case, S7''s reach)');
reset role;

-- ---------------------------------------------------------------------------
-- 5.2–5.7 — RETIRED WITH THEIR LAYER (DM1, ADR 0114 D8). The M8 storage-policy
-- cut and the M9 open_attachment resolve door BOTH died with the substrate,
-- and the capability-shaped byte discrimination they pinned (reviewer zero /
-- S3-grantee reads / coordinator non-vacuity twin) is no longer expressible at
-- the storage layer BY DESIGN: the document buckets carry NO SELECT policy for
-- ANY principal (D8 — pinned by 328 K6b), so byte discrimination lives INSIDE
-- DM2's open_document_version. That door's keystones re-express all six pins
-- as 329 P0a–P0f (falsifiability proven by three catalog-restored mutations —
-- record in the phase file). This comment once carried the obligation as
-- PROSE ALONE and ran green all phase while it was unmet — so 5.2's core is
-- now a LIVE SENTINEL here (below): this file cannot pass while the byte cut
-- is absent from the door.
-- ---------------------------------------------------------------------------

-- 5.2s — THE SENTINEL. A version row on the case-homed Doc QO; the reviewer
-- must be refused BYTES at the door (metadata reach was just proven at 5.1 —
-- same document, same principal, one layer apart). Differential control: a
-- deliberation-holder passes the cut and fails only LATER, at file-absence
-- (HC0D8) — so 5.2s's refusal is the capability cut, not fixture rot.
-- Under cut-removal both callers reach HC0D8 and 5.2s REDS.
update app.feature_flags set enabled = true where key = 'documents_foundation';
insert into public.document_versions (id, document_id, version_number, created_by)
select '00000000-0000-0000-0000-0000000d8204'::uuid,
       '00000000-0000-0000-0000-0000000d8201'::uuid, 1, k.sa_x from k;

select ok(
  (select app.has_case_capability(cs.case_a, k.sa_x, 'read_case_deliberation') from cs, k),
  '5.2c1 fixture: the staff_admin holds deliberation (the control below cannot be refused by the cut)');

select test_helpers.claims_for((select qr from p), false);
select throws_ok(
  $q$ select public.open_document_version('00000000-0000-0000-0000-0000000d8204') $q$,
  '42501', 'sem autorização para baixar este documento',
  '5.2s SENTINEL: the reviewer is refused BYTES at the door (metadata at 5.1, bytes never — M8/M9)');

select test_helpers.claims_for((select sa_x from k), false, 'staff_admin');
select throws_ok(
  $q$ select public.open_document_version('00000000-0000-0000-0000-0000000d8204') $q$,
  'HC0D8', 'arquivo ainda não disponível',
  '5.2c2 control: the deliberation-holder passes the cut and dies only at file-absence — the 5.2s refusal IS the cut');

-- =============================================================================
-- §6 — THE D7 WRITE PIN, PER DOOR (M10; replaces 1.4's vacuous claim).
--
-- Derived by PROPERTY: the closure over prosrc + pg_policies from
-- `can_read_case(` / 'read_case_content' / 'view_case_overview' gave 14
-- authenticated DML doors; per-door gate reading narrowed the admitting set to
-- these THREE (the other 11 gate on can_write_case_content,
-- can_write_action_item_stake, or is_staff_admin_of FIRST).
--
-- ⚠⚠ ORDER IS LOAD-BEARING, and getting it wrong made the FIRST version of 6.1
-- VACUOUS. `record_recusal` SUCCEEDED pre-cut and recused the reviewer FROM THIS
-- CASE — which flips `is_case_excluded`, so every later assertion refused
-- through the EXCLUSION arm instead of the D7 gate, returning the same 42501 and
-- reading as a pass. The correction door therefore runs FIRST, and the
-- self-excluding door LAST. (Tell that exposed it: `open_write_doors` reddened
-- the other two but never this one — a keystone that does not red when its own
-- cut is neutralised is not pinning that cut.)
--
-- ⚠ file_correction_request raises 42501 at TWO sites: the D7 authority gate
-- ("você não pode solicitar correções neste caso") and corrector designation
-- ("apenas administradores podem designar o corretor", reachable only when
-- p_permitted_corrector is non-NULL). SAME SQLSTATE, DIFFERENT FAILURE CLASS —
-- so each assertion below pins the MESSAGE, not just the code, and 6.5 pins the
-- other raise so the two paths cannot collapse unnoticed.
-- =============================================================================
create temp table wd on commit drop as
  select '00000000-0000-0000-0000-0000000d8301'::uuid as narrative_id;
grant select on wd to authenticated;

-- The target must be COMPLETED and carry an assignee: with p_permitted_corrector
-- NULL the door defaults the corrector to the assignee, and a NULL one raises
-- HC0M4 — refusing for a WORKFLOW reason and never reaching the D7 gate. The
-- assignee must itself hold case CONTENT (a plain member holds deliberation
-- only), so the coordinator is the valid choice.
insert into public.case_narratives (id, case_id, title, display_label, display_position, status, assigned_to, created_by)
select wd.narrative_id, cs.case_a, 'Narrativa', 'Relato', 1, 'completed', k.sa_x, k.sa_x from wd, cs, k;

select test_helpers.claims_for((select qr from p), false);
set local role authenticated;
select throws_ok(
  format($$select public.file_correction_request('correction', null, %L, 'motivo', 'factual')$$,
         (select narrative_id from wd)),
  '42501', 'você não pode solicitar correções neste caso',
  '6.1 D7 DOOR ⭐⭐: the reviewer CANNOT file_correction_request — pinned on the AUTHORITY message, not the ambiguous 42501 (its own comment read "any case-content reader may file")');
select throws_ok(
  format($$select public.declare_conflict(%L, 'financial_interest', 'motivo')$$, (select case_a from cs)),
  'P0002', null,
  '6.2 D7 DOOR ⭐⭐: ...cannot declare_conflict on a case they read in full');
select throws_ok(
  format($$select public.record_recusal(%L, %L, 'motivo')$$,
         (select case_a from cs), (select qr from p)),
  'P0002', null,
  '6.3 D7 DOOR ⭐⭐: ...cannot record_recusal (self-service, closed by PO ruling — a recusal from a principal excluded from deliberation has no consumer). RUNS LAST: succeeding here would self-exclude and mask 6.1/6.2');
reset role;

-- ⚠ TWIN CHOICE IS LOAD-BEARING: a plain member (S5) holds read_case_deliberation
-- but NOT read_case_content, so can_read_case is false for them and the door
-- refuses for a reason unrelated to the cut (§7.1 trap 1 — the wrong-arm fixture).
-- The coordinator holds content AND deliberation, so it isolates the cut exactly.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$select public.declare_conflict(%L, 'financial_interest', 'motivo')$$, (select case_a from cs)),
  '6.4 NON-VACUITY twin: a deliberation-holding reader (coordinator) STILL declares a conflict — 6.2 is the reviewer cut, not a dead door');
reset role;

-- 6.5 — the OTHER 42501. st_x gets case CONTENT through an explicit grant (S3),
-- so it passes the D7 authority gate but is not a staff_admin: passing an
-- explicit corrector must still hit the DESIGNATION raise. Pins the two 42501
-- sites apart, so a future change cannot collapse them silently.
insert into public.case_access_grants
  (case_id, principal_id, source, read_case_content, read_case_deliberation,
   read_standard_phi, read_restricted_phi, write_case_content, reason_code, granted_by)
select cs.case_a, k.st_x, 'manual_grant', true, true, false, false, false, 'coordinator_grant', k.sa_x
from cs, k;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$select public.file_correction_request('correction', null, %L, 'motivo', 'factual', %L)$$,
         (select narrative_id from wd), (select sa_x from k)),
  '42501', 'apenas administradores podem designar o corretor',
  '6.5 THE OTHER 42501 ⭐: a non-admin content-reader passing an explicit corrector hits the DESIGNATION raise — same code, different failure class, pinned apart from 6.1');
reset role;

select * from finish();
rollback;
