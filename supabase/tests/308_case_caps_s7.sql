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
select plan(28);

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

update public.profiles pr set home_organization_id = (select org_b from k)
  where pr.id in (select qr from p union all select qr_h2 from p);
update public.profiles pr set home_organization_id = (select org2 from p)
  where pr.id = (select qr_f from p);

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

select ok(
  not app.can_write_case_content((select case_a from cs), (select qr from p)),
  '1.4 strictly read-only (D7): no write bit');

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

insert into storage.objects (bucket_id, name)
select 'attachments', 'case/' || cs.case_a || '/probe-bytes.pdf' from cs
union all
select 'attachments', 'case/' || cs.case_eg || '/probe-bytes-eg.pdf' from cs;

insert into public.attachments
  (id, owner_type, owner_id, kind, title, storage_bucket, storage_path, sensitivity_tier, uploaded_by)
select '00000000-0000-0000-0000-0000000d8201'::uuid, 'case', cs.case_a, 'documento', 'Doc QO',
       'attachments', 'case/' || cs.case_a || '/probe-bytes.pdf', 'standard', k.sa_x
from cs, k
union all
select '00000000-0000-0000-0000-0000000d8202'::uuid, 'case', cs.case_eg, 'documento', 'Doc QO EG',
       'attachments', 'case/' || cs.case_eg || '/probe-bytes-eg.pdf', 'standard', k.sa_x
from cs, k;

select test_helpers.claims_for((select qr from p), false);
set local role authenticated;

select is(
  (select count(*)::int from public.attachments a, cs
    where a.owner_type = 'case' and a.owner_id = cs.case_a),
  1,
  '5.1 METADATA stays reviewer-visible: the documents panel renders the file NAME (can_read_attachment untouched)');

select is(
  (select count(*)::int from storage.objects o, cs
    where o.bucket_id = 'attachments' and o.name = 'case/' || cs.case_a || '/probe-bytes.pdf'),
  0,
  '5.2 BYTES CUT ⭐⭐ (M8): the reviewer reaches ZERO object rows of a case they read in full — the DB is the boundary, not the missing link');

select is(
  (select count(*)::int from storage.objects o, cs
    where o.bucket_id = 'attachments' and o.name = 'case/' || cs.case_eg || '/probe-bytes-eg.pdf'),
  1,
  '5.3 GRANT PATH INTACT ⭐: the S3-granted reviewer on the LOCKED case reads its bytes (grant closure confers deliberation) — the cut is capability-shaped, not identity-shaped');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from storage.objects where bucket_id = 'attachments'),
  2,
  '5.4 NON-VACUITY twin: the coordinator reads BOTH probe objects — 5.2''s zero is the cut, not an empty bucket');
reset role;

-- ---------------------------------------------------------------------------
-- 5.5–5.7 — THE RESOLVE DOOR (M9). The storage policy is not the whole bytes
-- layer: public.open_attachment (prosecdef) resolves bucket+path and the app
-- signs it with the SERVICE ROLE — storage RLS never runs on that mint (the
-- BUG-AUTHZ-001 shape, caught by frontend). The door must carry the SAME cut,
-- or M8 is a boundary with a door-shaped hole beside it. q1 `open_resolver_door`
-- proves 5.5 can fail.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select qr from p), false);
set local role authenticated;
select is(
  (select count(*)::int from public.open_attachment('00000000-0000-0000-0000-0000000d8201')),
  0,
  '5.5 RESOLVE DOOR ⭐⭐ (M9): the reviewer calling open_attachment on a standard-tier case document resolves NOTHING — no path, no service-role URL');

select is(
  (select count(*)::int from public.open_attachment('00000000-0000-0000-0000-0000000d8202')),
  1,
  '5.6 GRANT PATH through the door: the S3-granted reviewer on the LOCKED case still resolves its document (capability-shaped, like 5.3)');
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.open_attachment('00000000-0000-0000-0000-0000000d8201')),
  1,
  '5.7 NON-VACUITY twin: the coordinator resolves the same document — 5.5''s zero is the door''s cut, not a broken door');
reset role;

select * from finish();
rollback;
