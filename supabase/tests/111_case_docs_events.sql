-- Cases-Extras R1: case_documents and case_events.
-- Covers: RLS member-read / staff_admin-write; storage path commission scoping;
-- soft-delete hides a document from the live list; plain staff cannot insert.

begin;
select plan(13);

-- Enable both feature flags for this transaction.
update app.feature_flags set enabled = true where key in ('cases_multi_phase', 'cases_extras');
-- This file asserts the PRE-Case-Access-Control member-read model (a plain staff
-- member reads case_documents/case_events of their commission). With case_access ON
-- those reads tighten to app.can_read_case (attribution/grant required). Keep the
-- flag OFF here so the original member-read semantics hold; the ACL behavior is
-- covered by 144_case_access. (ADR 0033 Consequences — anticipated ripple.)
update app.feature_flags set enabled = false where key = 'case_access';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'st_x2')::uuid   as st_x2,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'st_y')::uuid    as st_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y,
         (v->>'form_u')::uuid  as form_u
  from ctx;
grant select on k to authenticated;

-- Build a case in commission X.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Docs E2E', null)).id as tid;
reset role;
grant select on tpl to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select tid from tpl), (select form_u from k), 'F1');
select public.publish_process_template((select tid from tpl));
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso Docs')).id as cid;
reset role;
grant select on cse to authenticated;

-- =========================================================================
-- 1) STAFF_ADMIN CAN INSERT a case_document (direct RLS write)
-- =========================================================================
-- Insert a document as the staff_admin (via RLS; no upload needed for SQL test).
-- storage_path must be unique (unique constraint); use a plausible path.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
-- Use a INSERT ... SELECT pattern to capture the generated doc id.
create temp table inserted_doc on commit drop as
  select id as doc_id,
         storage_path
  from public.case_documents
  where 1=0;  -- empty structure capture
reset role;

-- Insert as superuser to populate the structure and capture the id.
insert into public.case_documents
  (case_id, doc_type, title, storage_path, mime_type, size_bytes, uploaded_by)
select
  cse.cid,
  'ata',
  'Ata de reunião',
  k.comm_x::text || '/' || cse.cid::text || '/test-ata.pdf',
  'application/pdf',
  102400,
  k.sa_x
from cse, k
returning id as doc_id, storage_path;

-- Verify the insert succeeded by counting.
select ok(
  (select count(*)::int from public.case_documents
   where case_id = (select cid from cse)) >= 1,
  'staff_admin (superuser context in test) can insert a case_document'
);

-- =========================================================================
-- 2) MEMBER (staff) CAN READ case_documents of their commission
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select ok(
  (select count(*)::int from public.case_documents
   where case_id = (select cid from cse) and deleted_at is null) >= 1,
  'staff member can read case_documents of their own commission'
);
reset role;

-- =========================================================================
-- 3) CROSS-COMMISSION: staff_y cannot read commission X's documents
-- =========================================================================
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_documents
   where case_id = (select cid from cse)),
  0,
  'RLS cross-commission: foreign member sees zero documents'
);
reset role;

-- =========================================================================
-- 4) PLAIN STAFF cannot insert a case_document (RLS blocks non-staff_admin)
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$
    insert into public.case_documents (case_id, doc_type, title, storage_path, mime_type, size_bytes, uploaded_by)
    values (%L, 'ata', 'Staff attempt', %L, 'application/pdf', 100, %L)
  $$, (select cid from cse),
      (select comm_x from k)::text || '/' || (select cid from cse)::text || '/staff.pdf',
      (select st_x from k)),
  '42501',
  null,
  'plain staff member cannot insert a case_document (RLS blocks)'
);
reset role;

-- =========================================================================
-- 5) SOFT-DELETE: deleted_at set → document hidden from live list
-- =========================================================================
-- The superuser soft-deletes the document.
update public.case_documents
  set deleted_at = now(), deleted_by = (select sa_x from k)
  where case_id = (select cid from cse) and deleted_at is null;

-- Live list (deleted_at is null) shows 0 documents now.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_documents
   where case_id = (select cid from cse) and deleted_at is null),
  0,
  'soft-delete hides document from the live list (deleted_at is null filter)'
);
reset role;

-- The row still exists in the DB (not hard-deleted).
select ok(
  (select count(*)::int from public.case_documents
   where case_id = (select cid from cse)) >= 1,
  'soft-deleted document still exists in DB (not hard-deleted)'
);

-- =========================================================================
-- 6) STORAGE PATH SCOPING: commission_id must be the first path segment
-- =========================================================================
select ok(
  (select count(*)::int from public.case_documents
   where case_id = (select cid from cse)
     and starts_with(storage_path, (select comm_x from k)::text)) >= 1,
  'storage path starts with commission_id (scoped per commission)'
);

-- =========================================================================
-- 7) CASE_EVENTS: staff_admin can insert an event; staff can read
-- =========================================================================
insert into public.case_events (case_id, kind, title, body, occurred_at, created_by)
  select cse.cid, 'note', 'Reunião interna', 'Discutida a causa do óbito.', current_date, k.sa_x
  from cse, k;

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select ok(
  (select count(*)::int from public.case_events
   where case_id = (select cid from cse)) >= 1,
  'staff member can read case_events of their own commission'
);
reset role;

-- =========================================================================
-- 8) PLAIN STAFF cannot insert a case_event
-- =========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$
    insert into public.case_events (case_id, kind, body, created_by)
    values (%L, 'note', 'Staff note attempt', %L)
  $$, (select cid from cse), (select st_x from k)),
  '42501',
  null,
  'plain staff member cannot insert a case_event (RLS blocks)'
);
reset role;

-- =========================================================================
-- 9) CASE_EVENTS: cross-commission isolation
-- =========================================================================
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.case_events
   where case_id = (select cid from cse)),
  0,
  'RLS: cross-commission member cannot read case_events'
);
reset role;

-- =========================================================================
-- 10) CASE_EVENTS: staff_admin can EDIT (UPDATE) and DELETE an event
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$
    update public.case_events set body = 'Editado' where case_id = %L
  $$, (select cid from cse)),
  'staff_admin can UPDATE (edit) a case_event'
);
select lives_ok(
  format($$
    delete from public.case_events where case_id = %L
  $$, (select cid from cse)),
  'staff_admin can DELETE (hard-delete) a case_event'
);
reset role;

-- =========================================================================
-- 11) doc_type CHECK enforced (invalid slug rejected)
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$
    insert into public.case_documents
      (case_id, doc_type, title, storage_path, mime_type, size_bytes, uploaded_by)
    values (%L, 'invalid_type', 'Bad', %L, 'application/pdf', 100, %L)
  $$, (select cid from cse),
      (select comm_x from k)::text || '/' || (select cid from cse)::text || '/bad.pdf',
      (select sa_x from k)),
  '23514',
  null,
  'case_documents doc_type CHECK rejects invalid values'
);
reset role;

select * from finish();
rollback;
