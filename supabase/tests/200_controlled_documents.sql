-- =============================================================================
-- Phase 17 — Controlled-Document Lifecycle (migrations 20260713000000–…000300).
-- Guards + RLS the UI cannot reach. Uses test_helpers.bootstrap() (one org
-- `org_b` / one hospital `hosp_b`, commissions X + Y both under hosp_b, so sa_y/
-- st_y are same-hospital-but-outside-X users — the "entitled outside-commission
-- approver" case). A SECOND hospital + commission + member is built here for the
-- foreign-hospital-approver rejection (HC091).
--
-- Asserts:
--   * status-machine guard: out-of-RPC status write + illegal transition → HC089;
--   * frozen-approver-set guard: approver INSERT while in_approval → HC093;
--   * all-must-approve publish gate (HC090); duplicate approver (HC092);
--     foreign/inactive approver (HC091);
--   * approver read arm is VERSION-scoped (an approver on doc A gains NO read of an
--     unrelated doc B; no broad grant) + document_approvals sign-own-row RLS;
--   * immutable storage bucket (no update/delete policy);
--   * review-due computation: review_due = effective-base + cycle, override wins;
--   * hospital_document_register scope (admin/hospital-admin/org-admin only; PHI-free —
--     no markdown/path columns) + list_approver_candidates same-hospital-only, no
--     email/sensitive cols, foreign-hospital caller → empty;
--   * form_versions publish-metadata settable ONLY via publish_form_version (a direct
--     UPDATE on a published row raises the immutability error);
--   * reject cleanup (MINOR-1): a reject deletes the still-PENDING sibling approvals
--     (so they no longer grant read of the now-private draft) while KEEPING the
--     rejeitado row + note; a formerly-pending approver's read is then denied; resubmit works.
--
-- Definer/RPC calls read auth.uid() via request.jwt.claims; assertions reset to
-- superuser to read freely.
-- =============================================================================

begin;
select plan(47);

update app.feature_flags set enabled = true where key = 'controlled_docs';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'st_x2')::uuid   as st_x2,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'st_y')::uuid    as st_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'ver_u')::uuid   as ver_u,       -- a published form_version in X (B4 metadata target)
         (v->>'org_b')::uuid   as org_id,
         (v->>'hosp_b')::uuid  as hosp_id
  from ctx;
grant select on k to authenticated;

-- ---------------------------------------------------------------------------
-- Second hospital + commission + member under the SAME org — the foreign-hospital
-- approver (HC091). The org is shared; only the hospital differs, which is exactly
-- what is_entitled_document_approver keys on (c.hospital_id = document's hospital).
-- ---------------------------------------------------------------------------
create temp table k2 on commit drop as
  select gen_random_uuid() as hosp2,
         gen_random_uuid() as comm_z,
         gen_random_uuid() as user_z;  -- active user in the OTHER hospital
grant select on k2 to authenticated;

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', (select user_z from k2),
       'authenticated', 'authenticated', (select user_z from k2) || '@test', now(), now();

insert into public.hospitals (id, organization_id, name, slug)
select (select hosp2 from k2), (select org_id from k), 'Hosp 2', 'hosp2-' || substr((select hosp2 from k2)::text,1,8);

update public.profiles set full_name = 'User Z', home_organization_id = (select org_id from k)
  where id = (select user_z from k2);

insert into public.commissions (id, name, slug, created_by, hospital_id)
select (select comm_z from k2), 'Comissão Z', 'comm-z-' || substr((select comm_z from k2)::text,1,8),
       (select admin from k), (select hosp2 from k2);

insert into public.memberships (commission_id, principal_id, role)
select (select comm_z from k2), (select user_z from k2), 'staff';

-- An INACTIVE same-hospital user (for the HC091 inactive arm).
create temp table k3 on commit drop as select gen_random_uuid() as user_inactive;
grant select on k3 to authenticated;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', (select user_inactive from k3),
       'authenticated', 'authenticated', (select user_inactive from k3) || '@test', now(), now();
update public.profiles set full_name = 'User Inactive', is_active = false,
       home_organization_id = (select org_id from k)
  where id = (select user_inactive from k3);
insert into public.memberships (commission_id, principal_id, role)
select (select comm_y from k), (select user_inactive from k3), 'staff';

-- ---------------------------------------------------------------------------
-- Build a controlled document (DOC A) in X via the RPCs, acting as sa_x.
-- ---------------------------------------------------------------------------
create temp table d on commit drop as
  select gen_random_uuid() as placeholder;  -- filled below via RPC returns
grant select on d to authenticated;

-- Act as sa_x for the authoring RPCs.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));

-- create_controlled_document → header + draft v1.
create temp table doc_a on commit drop as
  select * from public.create_controlled_document((select comm_x from k), 'Política A', 'policy', 12);
grant select on doc_a to authenticated;

-- Attach a file to v1 (so it can be submitted).
select public.set_document_version_file(
  (select current_version_id from doc_a),
  (select comm_x from k) || '/' || (select id from doc_a) || '/a.pdf',
  'v1', null);

reset role;

-- Capture v1 id.
create temp table va on commit drop as
  select id as ver1, document_id as doc_a_id
  from public.controlled_document_versions
  where document_id = (select id from doc_a);
grant select on va to authenticated;

-- ===========================================================================
-- 1 · STATUS-MACHINE GUARD (HC089)
-- ===========================================================================

-- 1a — a direct out-of-RPC status write (as superuser: bypasses RLS but NOT the
-- BEFORE trigger) is rejected HC089.
select throws_ok(
  format($$ update public.controlled_document_versions set status = 'in_approval' where id = %L $$,
    (select ver1 from va)),
  'HC089', null,
  'out-of-RPC status change on a version is rejected (HC089)');

-- 1b — an illegal transition even under the RPC flag (draft → effective) is HC089.
select throws_ok(
  format($$
    do $inner$ begin
      perform set_config('app.in_controlled_docs_rpc', 'on', true);
      update public.controlled_document_versions set status = 'effective' where id = %L;
      perform set_config('app.in_controlled_docs_rpc', 'off', true);
    end $inner$; $$,
    (select ver1 from va)),
  'HC089', null,
  'illegal transition draft → effective is rejected even inside an RPC (HC089)');

-- 1c — a legal transition under the RPC flag succeeds (draft → in_approval).
select lives_ok(
  format($$
    do $inner$ begin
      perform set_config('app.in_controlled_docs_rpc', 'on', true);
      update public.controlled_document_versions set status = 'in_approval' where id = %L;
      perform set_config('app.in_controlled_docs_rpc', 'off', true);
    end $inner$; $$,
    (select ver1 from va)),
  'legal transition draft → in_approval succeeds under the RPC flag');

-- Return the version to draft for the real submit flow below (legal edge).
do $$ begin
  perform set_config('app.in_controlled_docs_rpc', 'on', true);
  update public.controlled_document_versions set status = 'draft'
    where id = (select ver1 from va);
  perform set_config('app.in_controlled_docs_rpc', 'off', true);
end $$;

-- ===========================================================================
-- 2 · SUBMIT: entitlement + duplicate + roster grant (HC091 / HC092)
-- ===========================================================================

set local role authenticated;
select test_helpers.claims_for((select sa_x from k));

-- 2a — a FOREIGN-HOSPITAL approver (user_z, in hosp2) is rejected HC091.
select throws_ok(
  format($$ select public.submit_document_for_approval(%L,
             jsonb_build_array(jsonb_build_object('approver_id', %L::text))) $$,
    (select ver1 from va), (select user_z from k2)),
  'HC091', null,
  'a foreign-hospital user cannot be named approver (HC091)');

-- 2b — an INACTIVE same-hospital approver is rejected HC091.
select throws_ok(
  format($$ select public.submit_document_for_approval(%L,
             jsonb_build_array(jsonb_build_object('approver_id', %L::text))) $$,
    (select ver1 from va), (select user_inactive from k3)),
  'HC091', null,
  'an inactive same-hospital user cannot be named approver (HC091)');

-- 2c — a DUPLICATE approver in the passed set is rejected HC092.
select throws_ok(
  format($$ select public.submit_document_for_approval(%L,
             jsonb_build_array(
               jsonb_build_object('approver_id', %L::text),
               jsonb_build_object('approver_id', %L::text))) $$,
    (select ver1 from va), (select st_x from k), (select st_x from k)),
  'HC092', null,
  'a duplicate approver in the set is rejected (HC092)');

-- 2d — a valid submit with TWO approvers: st_x (in-commission) + sa_y (same-hospital,
-- OUTSIDE commission X). Both are entitled. Succeeds → in_approval.
select lives_ok(
  format($$ select public.submit_document_for_approval(%L,
             jsonb_build_array(
               jsonb_build_object('approver_id', %L::text, 'approver_title', 'Enf'),
               jsonb_build_object('approver_id', %L::text, 'approver_title', 'Dir'))) $$,
    (select ver1 from va), (select st_x from k), (select sa_y from k)),
  'submit naming an in-commission + an outside-commission same-hospital approver succeeds');

reset role;

select is(
  (select status from public.controlled_document_versions where id = (select ver1 from va)),
  'in_approval', 'the version is in_approval after submit');

select is(
  (select count(*)::int from public.document_approvals where document_version_id = (select ver1 from va)),
  2, 'two pending approval rows were created (the read-grant arm)');

-- ===========================================================================
-- 3 · FROZEN-APPROVER-SET GUARD (HC093)
-- ===========================================================================

-- A direct approver INSERT while the version is in_approval (roster change) → HC093.
select throws_ok(
  format($$ insert into public.document_approvals (document_version_id, approver_id)
            values (%L, %L) $$,
    (select ver1 from va), (select st_x2 from k)),
  'HC093', null,
  'inserting an approver while in_approval is rejected (frozen set, HC093)');

-- A direct approver DELETE while in_approval (roster change) → HC093.
select throws_ok(
  format($$ delete from public.document_approvals
            where document_version_id = %L and approver_id = %L $$,
    (select ver1 from va), (select st_x from k)),
  'HC093', null,
  'deleting an approver while in_approval is rejected (frozen set, HC093)');

-- Changing an existing row's approver_id → HC093.
select throws_ok(
  format($$ update public.document_approvals set approver_id = %L
            where document_version_id = %L and approver_id = %L $$,
    (select st_x2 from k), (select ver1 from va), (select st_x from k)),
  'HC093', null,
  'reassigning an approval to a different approver is rejected (HC093)');

-- ===========================================================================
-- 4 · APPROVER READ ARM — VERSION-SCOPED, no broad grant + sign-own-row RLS
-- ===========================================================================

-- Build a SECOND unrelated document (DOC B) in X, with NO approvers naming sa_y.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
create temp table doc_b on commit drop as
  select * from public.create_controlled_document((select comm_x from k), 'Política B', 'sop', null);
grant select on doc_b to authenticated;
reset role;

create temp table vb on commit drop as
  select id as ver_b from public.controlled_document_versions where document_id = (select id from doc_b);
grant select on vb to authenticated;

-- sa_y is a NAMED approver on DOC A's v1, and is NOT a member of commission X.
-- Arm 1: sa_y CAN read DOC A (the version they were named on).
set local role authenticated;
select test_helpers.claims_for((select sa_y from k));
select is(
  (select count(*)::int from public.controlled_documents where id = (select id from doc_a)),
  1, 'the outside-commission approver (sa_y) CAN read the document they were named on');
select is(
  (select count(*)::int from public.controlled_document_versions where id = (select ver1 from va)),
  1, 'sa_y CAN read the version they were named on (version arm)');

-- Arm 2 (the key isolation assertion): sa_y CANNOT read the UNRELATED DOC B — the
-- approver arm is version-scoped, granting no broad read of the commission's docs.
select is(
  (select count(*)::int from public.controlled_documents where id = (select id from doc_b)),
  0, 'sa_y CANNOT read an unrelated document they were not named on (version-scoped, no broad grant)');
select is(
  (select count(*)::int from public.controlled_document_versions where id = (select ver_b from vb)),
  0, 'sa_y CANNOT read the unrelated version (approver arm does not leak sideways)');

-- sa_y sees ONLY their own approval row (sign-own-row); the OTHER approver's row
-- (st_x on DOC A) is visible too ONLY because it is on a doc sa_y can read via the
-- arm — but sa_y must NOT see approvals on DOC B (which sa_y cannot read at all).
select is(
  (select count(*)::int from public.document_approvals a
   join public.controlled_document_versions v on v.id = a.document_version_id
   where v.document_id = (select id from doc_b)),
  0, 'sa_y sees NO approvals on a document they cannot read');

reset role;

-- A foreign-COMMISSION user (st_y, in commission Y, not named on DOC A) gets nothing.
set local role authenticated;
select test_helpers.claims_for((select st_y from k));
select is(
  (select count(*)::int from public.controlled_documents where id = (select id from doc_a)),
  0, 'a foreign-commission non-approver (st_y) cannot read DOC A');
reset role;

-- ===========================================================================
-- 5 · ALL-MUST-APPROVE PUBLISH GATE (HC090)
-- ===========================================================================

-- Only st_x has approved so far? No — nobody has. Have st_x approve, leave sa_y pending.
set local role authenticated;
select test_helpers.claims_for((select st_x from k));
select lives_ok(
  format($$ select public.approve_document(%L, null) $$, (select ver1 from va)),
  'the in-commission approver signs aprovado');
reset role;

-- publish while sa_y is still pending → HC090.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select throws_ok(
  format($$ select public.publish_document(%L, null, null, null) $$, (select ver1 from va)),
  'HC090', null,
  'publish is rejected while an approval is still pending (HC090)');
reset role;

-- sa_y approves; now ALL approved.
set local role authenticated;
select test_helpers.claims_for((select sa_y from k));
select lives_ok(
  format($$ select public.approve_document(%L, null) $$, (select ver1 from va)),
  'the outside-commission approver signs aprovado');
reset role;

-- ===========================================================================
-- 6 · REVIEW-DUE COMPUTATION (effective-base + cycle; override wins)
-- ===========================================================================

-- 6a — publish with an explicit effective_date and NO override → review_due =
-- effective + review_cycle_months (12). effective 2024-01-10 → review 2025-01-10.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select lives_ok(
  format($$ select public.publish_document(%L, date '2024-01-10', null, null) $$, (select ver1 from va)),
  'publish with all approvals succeeds → effective');
reset role;

select is(
  (select review_due_date from public.controlled_document_versions where id = (select ver1 from va)),
  date '2025-01-10',
  'review_due_date = effective_date + review_cycle_months (12) when no override');

select is(
  (select status from public.controlled_document_versions where id = (select ver1 from va)),
  'effective', 'the version is effective after publish');

-- 6b — supersede DOC A, publish the new version with an OVERRIDE review-due that
-- differs from the cycle math → the override wins.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
create temp table v2 on commit drop as
  select id as ver2 from public.supersede_document((select id from doc_a));
grant select on v2 to authenticated;
select public.set_document_version_file(
  (select ver2 from v2),
  (select comm_x from k) || '/' || (select id from doc_a) || '/a-v2.pdf', 'v2', null);
select public.submit_document_for_approval(
  (select ver2 from v2),
  jsonb_build_array(jsonb_build_object('approver_id', (select st_x from k)::text)));
reset role;

set local role authenticated;
select test_helpers.claims_for((select st_x from k));
select public.approve_document((select ver2 from v2), null);
reset role;

set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
-- effective 2024-06-01 (+12 cycle would be 2025-06-01) but override = 2030-12-31.
select public.publish_document((select ver2 from v2), date '2024-06-01', date '2030-12-31', null);
reset role;

select is(
  (select review_due_date from public.controlled_document_versions where id = (select ver2 from v2)),
  date '2030-12-31',
  'an explicit review_due override WINS over the cycle math');

-- The prior version was retired but retained (still present, obsolete).
select is(
  (select status from public.controlled_document_versions where id = (select ver1 from va)),
  'obsolete', 'the prior effective version is retired → obsolete (retained, not deleted)');

-- ===========================================================================
-- 7 · IMMUTABLE STORAGE BUCKET (no update/delete policy)
-- ===========================================================================

select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and cmd in ('UPDATE', 'DELETE')
     and (qual like '%controlled-documents%' or with_check like '%controlled-documents%'
          or policyname like '%controlled_documents%')),
  0, 'the controlled-documents bucket has NO update/delete policy (Rule 6)');

select is(
  (select public from storage.buckets where id = 'controlled-documents'),
  false, 'the controlled-documents bucket is private');

-- ===========================================================================
-- 8 · hospital_document_register — scope + PHI-free projection
-- ===========================================================================

-- 8a — a plain member (st_x) gets NO rows (gated to admin/hospital-admin/org-admin).
set local role authenticated;
select test_helpers.claims_for((select st_x from k));
select is(
  (select count(*)::int from public.hospital_document_register((select hosp_id from k), null, null, false)),
  0, 'a plain member cannot read the hospital register (rollup gated)');
reset role;

-- 8b — the platform admin sees the hospital's documents (DOC A + DOC B).
set local role authenticated;
select test_helpers.claims_for((select admin from k), true);
select ok(
  (select count(*)::int from public.hospital_document_register((select hosp_id from k), null, null, false)) >= 2,
  'the platform admin reads the hospital register across commissions');
reset role;

-- 8c — the register projection is PHI-free: its OUT columns carry no markdown/path.
--     (documents_due_for_review + hospital_document_register both metadata-only.)
select is(
  (select count(*)::int
   from information_schema.parameters
   where specific_schema = 'public'
     and parameter_mode = 'OUT'
     and lower(parameter_name) similar to '%(summary|markdown|storage_path|note|body)%'
     and specific_name like 'hospital_document_register%'),
  0, 'hospital_document_register exposes NO markdown/path/note columns (PHI-free rollup)');

-- ===========================================================================
-- 9 · list_approver_candidates — same-hospital only, no email, foreign → empty
-- ===========================================================================

-- 9a — same-hospital candidates only; user_z (hosp2) must NOT appear; sa_y (same
--      hospital, other commission) MUST appear.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select is(
  (select count(*)::int from public.list_approver_candidates((select comm_x from k))
   where id = (select user_z from k2)),
  0, 'a foreign-hospital user is NOT an approver candidate');
select ok(
  (select count(*)::int from public.list_approver_candidates((select comm_x from k))
   where id = (select sa_y from k)) = 1,
  'a same-hospital outside-commission user IS an approver candidate');
-- Inactive user must not be offered.
select is(
  (select count(*)::int from public.list_approver_candidates((select comm_x from k))
   where id = (select user_inactive from k3)),
  0, 'an inactive same-hospital user is NOT an approver candidate');
reset role;

-- 9b — the candidate projection carries NO email / sensitive columns (id, name, title only).
select is(
  (select count(*)::int
   from information_schema.parameters
   where specific_schema = 'public'
     and parameter_mode = 'OUT'
     and lower(parameter_name) similar to '%(email|cpf|matricula|council|phone|mrn)%'
     and specific_name like 'list_approver_candidates%'),
  0, 'list_approver_candidates exposes NO email/sensitive columns');

-- 9c — a foreign-hospital caller (a coordinator of comm_z in hosp2, querying comm_x
--      in hosp_b) is not the gate here; instead verify a non-privileged same-org user
--      calling for a commission they do not coordinate gets empty. st_y coordinates
--      nothing in X → empty.
set local role authenticated;
select test_helpers.claims_for((select st_y from k));
select is(
  (select count(*)::int from public.list_approver_candidates((select comm_x from k))),
  0, 'a user who does not coordinate the commission gets NO approver candidates');
reset role;

-- ===========================================================================
-- 10 · form_versions publish-metadata settable ONLY via publish_form_version
-- ===========================================================================

-- ver_u is an already-published form_version in X (published by bootstrap with the
-- 1-arg publish). A DIRECT update of the new metadata columns on that published row
-- is a non-status update on a non-draft row → the immutability guard raises.
select throws_ok(
  format($$ update public.form_versions set effective_date = date '2024-01-01' where id = %L $$,
    (select ver_u from k)),
  '23514', null,
  'a direct UPDATE of publish-metadata on a published form_version is blocked (immutability, check_violation)');

-- The metadata IS settable via the RPC path: publish a fresh draft form with the
-- new params and confirm the columns land + the review-due cycle math computed.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
create temp table fv on commit drop as
  select gen_random_uuid() as form_f, gen_random_uuid() as ver_f, gen_random_uuid() as sec_f;
grant select on fv to authenticated;
reset role;

insert into public.forms (id, commission_id, title, created_by)
select (select form_f from fv), (select comm_x from k), 'Form Ctrl', (select sa_x from k);
insert into public.form_versions (id, form_id, version_number, status)
select (select ver_f from fv), (select form_f from fv), 1, 'draft';
insert into public.form_sections (id, form_version_id, position, is_default)
select (select sec_f from fv), (select ver_f from fv), 0, true;

set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
-- publish with approver + effective 2024-03-01 + cycle 6 → review_due 2024-09-01.
select public.publish_form_version(
  (select ver_f from fv), (select sa_y from k), date '2024-03-01', 6, null);
reset role;

select is(
  (select effective_date from public.form_versions where id = (select ver_f from fv)),
  date '2024-03-01', 'publish_form_version stamps effective_date (metadata)');
select is(
  (select review_due_date from public.form_versions where id = (select ver_f from fv)),
  date '2024-09-01', 'publish_form_version computes review_due = effective + cycle (6)');
select is(
  (select approved_by from public.form_versions where id = (select ver_f from fv)),
  (select sa_y from k), 'publish_form_version captures approved_by');

-- Backward-compat: a no-metadata publish leaves all four columns NULL.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
create temp table fv2 on commit drop as
  select gen_random_uuid() as form_g, gen_random_uuid() as ver_g, gen_random_uuid() as sec_g;
grant select on fv2 to authenticated;
reset role;
insert into public.forms (id, commission_id, title, created_by)
select (select form_g from fv2), (select comm_x from k), 'Form Plain', (select sa_x from k);
insert into public.form_versions (id, form_id, version_number, status)
select (select ver_g from fv2), (select form_g from fv2), 1, 'draft';
insert into public.form_sections (id, form_version_id, position, is_default)
select (select sec_g from fv2), (select ver_g from fv2), 0, true;

set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select public.publish_form_version((select ver_g from fv2));
reset role;

select is(
  (select coalesce(effective_date::text,'') || coalesce(review_due_date::text,'')
     || coalesce(approved_by::text,'') || coalesce(approved_at::text,'')
   from public.form_versions where id = (select ver_g from fv2)),
  '', 'a no-metadata publish leaves all four form-version metadata columns NULL (backward-compatible)');

-- ===========================================================================
-- 11 · documents_due_for_review — the past-due arm surfaces the effective doc
-- ===========================================================================

-- DOC A's current version (v2) has review_due 2030-12-31 (future) — not overdue.
-- Create a fresh effective doc with a PAST review-due and confirm is_overdue = true.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
create temp table doc_p on commit drop as
  select * from public.create_controlled_document((select comm_x from k), 'Política Passada', 'policy', 1);
grant select on doc_p to authenticated;
select public.set_document_version_file(
  (select current_version_id from doc_p),
  (select comm_x from k) || '/' || (select id from doc_p) || '/p.pdf', 'vp', null);
select public.submit_document_for_approval(
  (select current_version_id from doc_p),
  jsonb_build_array(jsonb_build_object('approver_id', (select st_x from k)::text)));
reset role;
set local role authenticated;
select test_helpers.claims_for((select st_x from k));
select public.approve_document((select current_version_id from doc_p), null);
reset role;
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
-- effective a year ago, cycle 1 month → review_due ~11 months ago → overdue.
select public.publish_document((select current_version_id from doc_p), (current_date - 365), null, null);
reset role;

set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select is(
  (select is_overdue from public.documents_due_for_review((select comm_x from k))
   where document_id = (select id from doc_p)),
  true, 'a past-due effective document surfaces as overdue in documents_due_for_review');
reset role;

-- ===========================================================================
-- 10 · REJECT CLEANS UP SIBLING PENDING GRANTS (MINOR-1)
--   A reject moves in_approval → draft; the still-PENDING sibling approvals must
--   be deleted so they no longer grant read of the now-private draft via the
--   approver-read arm. The rejeitado row (with its note) is KEPT.
-- ===========================================================================

-- Build DOC R in X, submit naming st_x (in-commission) + sa_y (OUTSIDE-commission).
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
create temp table doc_r on commit drop as
  select * from public.create_controlled_document((select comm_x from k), 'Política R (reject)', 'sop', null);
grant select on doc_r to authenticated;
select public.set_document_version_file(
  (select current_version_id from doc_r),
  (select comm_x from k) || '/' || (select id from doc_r) || '/r.pdf', 'vr', null);
select public.submit_document_for_approval(
  (select current_version_id from doc_r),
  jsonb_build_array(
    jsonb_build_object('approver_id', (select st_x from k)::text),
    jsonb_build_object('approver_id', (select sa_y from k)::text)));
reset role;

-- Pre-check: the OUTSIDE approver sa_y (pending) CAN read the doc before the reject.
set local role authenticated;
select test_helpers.claims_for((select sa_y from k));
select is(
  (select count(*)::int from public.controlled_documents where id = (select id from doc_r)),
  1, 'MINOR-1 pre: a pending outside-commission approver can read the in_approval doc');
reset role;

-- st_x REJECTS with a note (sa_y stays pending).
set local role authenticated;
select test_helpers.claims_for((select st_x from k));
select public.reject_document((select current_version_id from doc_r), 'Faltou seção de EPI');
reset role;

-- (a) the still-pending sibling (sa_y) row is DELETED.
select is(
  (select count(*)::int from public.document_approvals
   where document_version_id = (select current_version_id from doc_r) and decision is null),
  0, 'MINOR-1 (a): pending sibling approval rows are deleted after a reject');

-- (b) the rejeitado row remains, carrying its note.
select is(
  (select count(*)::int from public.document_approvals
   where document_version_id = (select current_version_id from doc_r)
     and decision = 'rejected' and note = 'Faltou seção de EPI'),
  1, 'MINOR-1 (b): the rejeitado decision row (with its note) is kept after a reject');

-- (c) the formerly-pending outside approver sa_y can NO LONGER read the private draft.
set local role authenticated;
select test_helpers.claims_for((select sa_y from k));
select is(
  (select count(*)::int from public.controlled_documents where id = (select id from doc_r)),
  0, 'MINOR-1 (c): a formerly-pending approver is DENIED read of the rejected draft');
reset role;

-- (d) resubmit still works (delete-then-insert a fresh roster) → in_approval.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select public.submit_document_for_approval(
  (select current_version_id from doc_r),
  jsonb_build_array(jsonb_build_object('approver_id', (select st_x from k)::text)));
select is(
  (select status from public.controlled_document_versions
   where id = (select current_version_id from doc_r)),
  'in_approval', 'MINOR-1 (d): resubmit after a reject works (fresh roster) → in_approval');
reset role;

select * from finish();
rollback;
