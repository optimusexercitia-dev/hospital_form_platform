-- F2 (ADR 0063 / phase-14e §5) — Centralized Attachments keystones (§G.2).
--
-- VERIFIED GREEN (backend, reset-OK local pass): `supabase db reset --local` +
-- `supabase test db`, all 50 assertions pass (plan() corrected 38 -> 46 -> 50 to match
-- the actual keystone count). Fixed alongside: the seed.sql fold-in updates (case_documents /
-- case_interview_attachments -> public.attachments / case_interview_links), the
-- can_read_attachment/can_write_attachment explicit-p_uid fix (meeting/case/action_item
-- arms were reading auth.uid() implicitly instead of the passed p_uid), and this file's
-- direct action_items fixture (added the NOT NULL source_type/status_id columns).
-- QA phase-F2-review MINOR-2 fast-follow: 1.10-1.13 exercise the interview-arm
-- case-scoping under `case_access` ON (the regime where it diverges from plain
-- membership), closing the coverage gap the review flagged.
--
-- The lock (§G.2, ADR 0063): this suite fails if the phi bucket becomes authenticated-
-- readable (the hard door), if the audited open door stops NULL-out-of-scope-ing or
-- double-audits, if the immutability guard weakens, if the fold-in FK repoint regresses,
-- if the attachment_subjects→participants FK is lost, if disposal stops honoring
-- legal-hold / double-dispose, if a K9 grant is reverted (policy without a grant is
-- an inert boundary), or if the interview-arm case-scoping regresses to member-read.

begin;
select plan(50);

-- HARD REQUIREMENT (memory pgtap-fixture-flag-gaps): enable the flag or the flag-guarded
-- RPC keystones silently skip. audit_trail is needed for the open-door audit rows;
-- meetings/cases/interviews for the owner fixtures.
update app.feature_flags set enabled = true where key = 'attachments';
update app.feature_flags set enabled = true where key = 'audit_trail';
update app.feature_flags set enabled = true where key = 'meetings';
update app.feature_flags set enabled = true where key = 'interviews';
update app.feature_flags set enabled = true where key in ('cases_multi_phase', 'cases_extras');
update app.feature_flags set enabled = false where key = 'case_access';  -- member-read model

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'st_y')::uuid   as st_y,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'comm_y')::uuid as comm_y,
         (v->>'form_u')::uuid as form_u
  from ctx;
grant select on k to authenticated;

-- ============================================================================
-- Keystone 10 — K9: every attachments table has a `to authenticated` SELECT policy
-- AND a matching table GRANT (a policy without a grant is an inert boundary). Writes
-- to attachments stay DEFINER-only (NO authenticated write grant).
-- ============================================================================
select ok(has_table_privilege('authenticated', 'public.attachments', 'SELECT'),
  '10.1: authenticated has SELECT grant on attachments (K9)');
select ok(not has_table_privilege('authenticated', 'public.attachments', 'INSERT'),
  '10.2: authenticated has NO INSERT grant on attachments (writes are DEFINER-only)');
select ok(exists (select 1 from pg_policies
    where schemaname = 'public' and tablename = 'attachments'
      and policyname = 'attachments_select' and 'authenticated' = any(roles)),
  '10.3: attachments_select policy is TO authenticated');
select ok(has_table_privilege('authenticated', 'public.attachment_references', 'SELECT'),
  '10.4: authenticated SELECT grant on attachment_references (K9)');
select ok(has_table_privilege('authenticated', 'public.attachment_subjects', 'SELECT'),
  '10.5: authenticated SELECT grant on attachment_subjects (K9)');
select ok(has_table_privilege('authenticated', 'public.case_interview_links', 'SELECT'),
  '10.6: authenticated SELECT grant on case_interview_links (K9)');

-- ============================================================================
-- Keystone 5 — the phi bucket denies authenticated SELECT (the hard door): NO SELECT
-- policy on storage.objects references 'attachments-phi'; the standard bucket HAS one.
-- ============================================================================
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and cmd = 'SELECT' and (qual like '%attachments-phi%')),
  0,
  '5.1: NO authenticated SELECT policy grants the attachments-phi bucket (hard door)');
select ok(
  exists (select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'attachments_obj_select_readable'),
  '5.2: the standard attachments bucket HAS an authenticated SELECT policy');
select ok(
  exists (select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'attachments_phi_obj_insert_writable'),
  '5.3: the phi bucket HAS an INSERT policy (upload allowed, read blocked)');

-- ============================================================================
-- Keystone 7 — fold-in FK repoint integrity: rca_evidence + referral_shared_item now
-- reference attachments (preserving delete-actions); case_documents is gone.
-- ============================================================================
select ok(
  not exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'case_documents'),
  '7.1: case_documents table dropped (folded into attachments)');
select ok(
  not exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'meeting_attachments'),
  '7.2: meeting_attachments table dropped');
select ok(
  not exists (select 1 from information_schema.tables
              where table_schema = 'public' and table_name = 'case_interview_attachments'),
  '7.3: case_interview_attachments table dropped');
select is(
  (select confrelid::regclass::text from pg_constraint
   where conname = 'rca_evidence_cited_document_id_fkey'),
  'attachments',
  '7.4: rca_evidence.cited_document_id now references attachments');
select is(
  (select confdeltype from pg_constraint where conname = 'rca_evidence_cited_document_id_fkey'),
  'r',
  '7.5: rca_evidence FK keeps ON DELETE RESTRICT');
select is(
  (select confrelid::regclass::text from pg_constraint
   where conname = 'referral_shared_item_source_document_id_fkey'),
  'attachments',
  '7.6: referral_shared_item.source_document_id now references attachments');
select is(
  (select confdeltype from pg_constraint where conname = 'referral_shared_item_source_document_id_fkey'),
  'n',
  '7.7: referral_shared_item FK keeps ON DELETE SET NULL');

-- ============================================================================
-- Fixtures: a case + a meeting + an action_item in comm_x.
-- ============================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table tpl on commit drop as
  select (public.create_process_template((select comm_x from k), 'Anexos', null)).id as tid, null::uuid as vid;
-- ADR 0096: resolve the v1 draft in a SEPARATE statement. The helper is
-- STABLE, so inside the CREATE ... AS above it would see the pre-statement
-- snapshot and return NULL.
update tpl set vid = app.draft_version_of_template(tid);
reset role;
grant select on tpl to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_template_phase((select vid from tpl), (select form_u from k), 'F1');
select public.publish_process_template((select tid from tpl));
reset role;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cse on commit drop as
  select (public.create_case_from_template((select tid from tpl), 'Caso Anexo')).id as cid;
create temp table mtg on commit drop as
  select * from public.create_meeting((select comm_x from k), 'Reunião Anexo', null, now(), null, 'presencial', null, null);
reset role;
grant select on cse to authenticated;
grant select on mtg to authenticated;

-- An action_item in comm_x with committee scope + an assignee (st_x2). Inserted directly
-- (superuser) to control visibility_scope + assigned_to for the scope-arm test.
-- source_type='manual' + a global status_id (both NOT NULL; mirrors 182_action_items.sql).
create temp table ai on commit drop as select gen_random_uuid() as id;
grant select on ai to authenticated;
insert into public.action_items (id, commission_id, source_type, title, status_id, visibility_scope, assigned_to, created_by)
  select (select id from ai), (select comm_x from k), 'manual', 'Evidência',
         (select id from public.action_item_statuses where key = 'open' and commission_id is null),
         'committee', (select st_x2 from k), (select sa_x from k);

-- ============================================================================
-- Keystone 1 — RLS truth table via the dispatchers (member / foreigner / staff_admin;
-- form_upload → both false). can_read_/can_write_attachment take an explicit uid.
-- ============================================================================
-- meeting arm
select ok(app.can_read_attachment('meeting', (select id from mtg), (select st_x2 from k)),
  '1.1: comm_x member CAN read a meeting attachment');
select ok(not app.can_read_attachment('meeting', (select id from mtg), (select st_y from k)),
  '1.2: comm_y foreigner CANNOT read a meeting attachment');
select ok(app.can_write_attachment('meeting', (select id from mtg), (select sa_x from k)),
  '1.3: staff_admin CAN write a meeting attachment');
select ok(not app.can_write_attachment('meeting', (select id from mtg), (select st_x from k)),
  '1.4: plain member CANNOT write a meeting attachment');
-- case arm — Stage B: a plain member is no longer a case-reader; make st_x a grantee
-- so the positive holds (the member≠case-reader divergence is proven at 1.10-1.13).
select test_helpers.grant_ca((select cid from cse), (select st_x from k), 'read', (select sa_x from k));
select ok(app.can_read_attachment('case', (select cid from cse), (select st_x from k)),
  '1.5: a comm_x case GRANTEE CAN read a case attachment');
select ok(not app.can_read_attachment('case', (select cid from cse), (select st_y from k)),
  '1.6: comm_y foreigner CANNOT read a case attachment');
select ok(app.can_write_attachment('case', (select cid from cse), (select sa_x from k)),
  '1.7: staff_admin CAN write a case attachment');
-- form_upload reserved-inert
select ok(not app.can_read_attachment('form_upload', gen_random_uuid(), (select sa_x from k)),
  '1.8: form_upload read is always false (reserved-inert)');
select ok(not app.can_write_attachment('form_upload', gen_random_uuid(), (select sa_x from k)),
  '1.9: form_upload write is always false (reserved-inert)');

-- ============================================================================
-- Keystone 1 (MINOR-2 fast-follow, QA phase-F2-review) — interview-arm case-
-- scoping regression lock. `can_read_attachment('interview', …)` gates on
-- `can_read_case` (INFO-N1 tightening, migration 20260713001200), NOT
-- `is_member_of` — but every assertion above runs with `case_access` OFF, where
-- `can_read_case` collapses to `is_member_of` (line 29), so nothing yet can tell
-- the two apart. Flip `case_access` ON and prove the divergence: st_x2 is a
-- plain comm_x member (is_member_of = true) with NO case attribution/grant on
-- `cse`, so it is NOT a case-reader (can_read_case = false) — and the interview
-- attachment arm must follow can_read_case, denying st_x2 while still admitting
-- the coordinator (a genuine case-reader).
-- ============================================================================
create temp table ivx on commit drop as select gen_random_uuid() as iv;
grant select on ivx to authenticated;
insert into public.case_interviews (id, commission_id, case_id, interview_number, status, interview_category)
values ((select iv from ivx), (select comm_x from k), (select cid from cse), 0, 'draft', 'other');

update app.feature_flags set enabled = true where key = 'case_access';

select ok(app.is_member_of_for((select comm_x from k), (select st_x2 from k)),
  '1.10: st_x2 IS a comm_x member (contrast fixture for the negative below)');
select ok(not app.can_read_case((select cid from cse), (select st_x2 from k)),
  '1.11: st_x2 is NOT a case-reader under case_access ON (no attribution/grant on cse)');
select ok(not app.can_read_attachment('interview', (select iv from ivx), (select st_x2 from k)),
  '1.12: a comm_x MEMBER who is NOT a case-reader is DENIED the interview attachment '
  '(case_access ON) — proves the interview arm gates on can_read_case, not is_member_of');
select ok(app.can_read_attachment('interview', (select iv from ivx), (select sa_x from k)),
  '1.13: the coordinator (a genuine case-reader) CAN read the interview attachment');

update app.feature_flags set enabled = false where key = 'case_access';  -- restore member-read model

-- ============================================================================
-- Keystone 2 — action_item scope arm (Q5b assignee-write lock): committee-scope
-- attachment readable by a member; writable by staff_admin OR the assignee; a foreigner
-- can neither.
--
-- QA phase-F2-review MINOR-3: this suite only exercises the `committee` scope. The
-- other two `app.can_read_action_item` scopes — `case_restricted` (can_read_case on
-- coalesce(source_case_id, case_id)) and `assignees_only` (active assignment /
-- assigned_to, plus staff_admin/org_admin) — are already regression-locked end-to-end
-- via the `action_items` hub RLS policy (which inlines the SAME disjuncts, same
-- authority, as the helper — 20260707000000_fold_case_action_items.sql:301-327) by
-- `supabase/tests/113_case_action_items.sql` ("scope:" assertions ~L232-L324: plain
-- member denied / phase-assignee, case_access read-grantee, staff_admin admitted for
-- case_restricted; non-assignee denied / assignee + staff_admin admitted for
-- assignees_only). Not re-duplicated here — cheapest-correct per the review.
-- ============================================================================
select ok(app.can_read_attachment('action_item', (select id from ai), (select st_x from k)),
  '2.1: committee-scope action-item attachment readable by a comm_x member');
select ok(not app.can_read_attachment('action_item', (select id from ai), (select st_y from k)),
  '2.2: foreigner cannot read the action-item attachment');
select ok(app.can_write_attachment('action_item', (select id from ai), (select sa_x from k)),
  '2.3: staff_admin CAN write the action-item attachment');
select ok(app.can_write_attachment('action_item', (select id from ai), (select st_x2 from k)),
  '2.4: the ASSIGNEE (st_x2) CAN write the action-item attachment (Q5b lock)');
select ok(not app.can_write_attachment('action_item', (select id from ai), (select st_y from k)),
  '2.5: a foreigner CANNOT write the action-item attachment (Q5b lock)');

-- ============================================================================
-- Keystone 6 — immutability guard (HC096): a physical-column UPDATE outside the
-- app.in_attachments_rpc bracket raises; the seam columns are NOT frozen.
-- ============================================================================
-- A case-owned phi attachment (direct insert; superuser bypasses RLS + the flag).
create temp table catt on commit drop as select gen_random_uuid() as id;
grant select on catt to authenticated;
insert into public.attachments (id, owner_type, owner_id, title, storage_bucket, storage_path,
                                sensitivity_tier, confidentiality_label)
  select (select id from catt), 'case', (select cid from cse), 'Documento do caso',
         'attachments-phi', 'case/' || (select cid from cse)::text || '/doc.pdf',
         'phi', 'phi_standard';

select throws_ok(
  format($$ update public.attachments set storage_path = 'case/x/y.pdf' where id = %L $$,
         (select id from catt)),
  'HC096', null,
  '6.1: updating a frozen physical column (storage_path) outside the RPC bracket raises HC096');
select lives_ok(
  format($$ update public.attachments set confidentiality_label = 'phi_restricted' where id = %L $$,
         (select id from catt)),
  '6.2: a SEAM column (confidentiality_label) is NOT frozen — a plain UPDATE succeeds');

-- ============================================================================
-- Keystone 3 & 4 — the audited PHI-read door. An entitled phi open writes EXACTLY ONE
-- attachment.read; a foreigner gets NO row and writes NONE (NULL-out-of-scope).
-- ============================================================================
create temp table rc on commit drop as
  select count(*)::int as before from public.audit_log where action = 'attachment.read';
grant select on rc to authenticated;

-- (4) foreigner: 0 rows, 0 audit.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.open_attachment((select id from catt))),
  0,
  '4.1: open_attachment returns 0 rows for a foreigner (NULL-out-of-scope)');
reset role;
select is(
  (select count(*)::int from public.audit_log where action = 'attachment.read'),
  (select before from rc),
  '4.2: a denied open writes ZERO attachment.read rows');

-- (3) entitled staff_admin: exactly 1 row + exactly 1 audit.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.open_attachment((select id from catt))),
  1,
  '3.1: open_attachment returns the (bucket,path) for an entitled reader');
reset role;
select is(
  (select count(*)::int from public.audit_log where action = 'attachment.read') - (select before from rc),
  1,
  '3.2: an entitled phi open writes EXACTLY ONE attachment.read');

-- ============================================================================
-- Keystone 8 — attachment_subjects → participants FK (PHI-safe, participant-keyed).
-- ============================================================================
create temp table part on commit drop as select gen_random_uuid() as id;
grant select on part to authenticated;
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
  select (select id from part), (select organization_id from public.commissions where id = (select comm_x from k)),
         'professional', 'professional_identity', 'Dr. Teste';

select lives_ok(
  format($$ insert into public.attachment_subjects (attachment_id, participant_id)
            values (%L, %L) $$, (select id from catt), (select id from part)),
  '8.1: an attachment_subject keyed to a real participant inserts');
select throws_ok(
  format($$ insert into public.attachment_subjects (attachment_id, participant_id)
            values (%L, gen_random_uuid()) $$, (select id from catt)),
  '23503', null,
  '8.2: a bad participant_id violates the FK (23503)');

-- ============================================================================
-- Keystone 9 — disposal: dispose_attachment_phi rejects legal-hold (HC098) + double-
-- dispose (HC097); dispose_case_phi redacts a case attachment's title + stamps.
-- ============================================================================
-- A legal-held case attachment → HC098.
create temp table hatt on commit drop as select gen_random_uuid() as id;
grant select on hatt to authenticated;
insert into public.attachments (id, owner_type, owner_id, title, storage_bucket, storage_path,
                                sensitivity_tier, legal_hold)
  select (select id from hatt), 'case', (select cid from cse), 'Retido', 'attachments-phi',
         'case/' || (select cid from cse)::text || '/held.pdf', 'phi', true;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.dispose_attachment_phi(%L, 'retention_expired') $$, (select id from hatt)),
  'HC098', null,
  '9.1: dispose_attachment_phi rejects a legal-hold row (HC098)');
-- First dispose of catt succeeds; a second raises HC097.
select lives_ok(
  format($$ select public.dispose_attachment_phi(%L, 'entered_in_error') $$, (select id from catt)),
  '9.2: dispose_attachment_phi succeeds on a normal attachment');
select throws_ok(
  format($$ select public.dispose_attachment_phi(%L, 'entered_in_error') $$, (select id from catt)),
  'HC097', null,
  '9.3: dispose_attachment_phi rejects a double-dispose (HC097)');
reset role;

select is(
  (select title from public.attachments where id = (select id from catt)),
  '[PHI removido]',
  '9.4: dispose_attachment_phi redacted the title');
select ok(
  (select phi_disposed_at is not null and phi_disposed_reason = 'entered_in_error'
   from public.attachments where id = (select id from catt)),
  '9.5: dispose_attachment_phi stamped phi_disposed_at/_reason');

-- dispose_case_phi redacts the case's live, non-held attachments and stamps them; a
-- legal-held row is skipped (Q9). Re-insert a fresh live case attachment first.
create temp table datt on commit drop as select gen_random_uuid() as id;
grant select on datt to authenticated;
insert into public.attachments (id, owner_type, owner_id, title, storage_bucket, storage_path, sensitivity_tier)
  select (select id from datt), 'case', (select cid from cse), 'Anexo vivo', 'attachments-phi',
         'case/' || (select cid from cse)::text || '/live.pdf', 'phi';

update app.feature_flags set enabled = true where key = 'case_patient';
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.dispose_case_phi(%L, 'retention_expired') $$, (select cid from cse)),
  '9.6: dispose_case_phi runs with the F2 attachment-redaction line');
reset role;
select is(
  (select title from public.attachments where id = (select id from datt)),
  '[PHI removido]',
  '9.7: dispose_case_phi redacted a live case attachment (D10 seam line)');
select ok(
  (select title <> '[PHI removido]' from public.attachments where id = (select id from hatt)),
  '9.8: dispose_case_phi SKIPPED the legal-held attachment (Q9)');

select * from finish();
rollback;
