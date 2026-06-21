-- Phase 22: Inter-Committee Case Referrals. ADR 0037.
-- Focus of THIS file (the lead-required PHI-body tightening + the core access /
-- lifecycle / close-gate guarantees):
--   * can_read_referral (broad: source/target member OR QPS) vs can_read_referral_phi
--     (tight: coordinators + assigned target analyst + QPS) scoping.
--   * The PHI-BODY lockdown (migration 20260620015000): frozen_body_md / result_md
--     follow can_read_referral_phi — direct SELECT on referral_shared_item /
--     referral_reply is denied to a plain member; get_referral_detail nulls the
--     bodies for a metadata-only reader and serves them to a PHI reader.
--   * referral_patient REVOKE + the audited single-door get_referral_patient
--     (tight + NULL-out-of-scope-no-audit).
--   * The can_read_case QPS term (referral-touched source + target only; B never
--     reaches A's live case).
--   * The close_case HC076 gate across response_expected true/false.
--   * The status state-machine guard (HC070) + the snapshot-lock guard (HC073).
--   * PHI-free mutation-audit metadata (referral status diff carries no body; the
--     referral_patient.updated row carries NO identifier).
--
-- The `.read` / `.viewed` AUDIT rows emitted by the DEFINER read doors are asserted
-- here directly (unlike the safety module, the referral doors emit them INSIDE the
-- SECURITY DEFINER RPC, so a DB-side test can observe them).

begin;
select plan(40);

-- Flags ON for the whole test (hermetic; must not depend on migration order).
update app.feature_flags set enabled = true where key = 'case_referrals';
update app.feature_flags set enabled = true where key = 'case_access';
update app.feature_flags set enabled = true where key = 'audit_trail';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid   as sa_x,   -- source coordinator (commission X = A)
         (v->>'st_x')::uuid   as st_x,   -- plain staff of A
         (v->>'sa_y')::uuid   as sa_y,   -- target coordinator (commission Y = B)
         (v->>'st_y')::uuid   as st_y,   -- plain staff of B
         (v->>'comm_x')::uuid as comm_x, -- A
         (v->>'comm_y')::uuid as comm_y  -- B
  from ctx;
grant select on k to authenticated;

-- The bootstrap admin is the QPS/PQS operator in this file (is_pqs_member is real).
insert into public.pqs_members (user_id) select admin from k;

-- Vocab ids (seeded by the migration; present in every environment).
create temp table voc on commit drop as
  select (select id from public.referral_types where key = 'parecer')  as type_parecer,
         (select id from public.referral_types where key = 'ciencia')  as type_ciencia,
         (select id from public.reply_outcomes where key = 'procede')  as outcome_procede;
grant select on voc to authenticated;

-- A SOURCE case in A with a narrative + a document (to freeze into the snapshot),
-- and a TARGET case in B (for the link + the can_read_case QPS-term test).
create temp table cs on commit drop as
  select gen_random_uuid() as src_case, gen_random_uuid() as tgt_case,
         gen_random_uuid() as narr, gen_random_uuid() as doc;
grant select on cs to authenticated;

insert into public.cases (id, commission_id, case_number, label, created_by) values
  ((select src_case from cs), (select comm_x from k), 9201, 'Caso A', (select sa_x from k)),
  ((select tgt_case from cs), (select comm_y from k), 9202, 'Caso B', (select sa_y from k));
insert into public.case_narratives (id, case_id, type_label, display_position, title, body_md, created_by)
values ((select narr from cs), (select src_case from cs), 'Resumo', 0, 'Resumo',
        'CORPO-SENSIVEL-DO-PACIENTE', (select sa_x from k));
insert into public.case_documents (id, case_id, title, storage_path, mime_type, uploaded_by)
values ((select doc from cs), (select src_case from cs), 'Laudo',
        (select comm_x from k) || '/' || (select src_case from cs) || '/laudo.pdf',
        'application/pdf', (select sa_x from k));

-- =========================================================================
-- create_referral_draft: source coordinator only (HC071).
-- =========================================================================
-- A plain staff of A cannot open a draft.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_referral_draft(
       (select src_case from cs), (select comm_y from k),
       (select type_parecer from voc), 'tentativa', true) $$,
  'HC071', null, 'plain staff of A cannot create a referral draft (HC071)');
reset role;

-- The source coordinator opens a draft, assembles, sets PHI, sends.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r1 on commit drop as
  select * from public.create_referral_draft(
    (select src_case from cs), (select comm_y from k),
    (select type_parecer from voc), 'Solicitação de parecer', true);
reset role;
grant select on r1 to authenticated;

select matches((select code from r1), '^ENC-[0-9]+$', 'draft mints an ENC-#### code');
select is((select status from r1), 'rascunho', 'new referral starts rascunho');
select is((select response_expected from r1), true, 'response_expected seeded from type');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_referral_shared_item(
  (select id from r1), 'narrative', (select narr from cs), null);
select public.add_referral_shared_item(
  (select id from r1), 'document', null, (select doc from cs));
select public.set_referral_patient(
  (select id from r1), 'Paciente Teste', 'MRN-9', null, 70, 'male', null, 'UTI', 'Dr X');
reset role;

select is(
  (select count(*)::int from public.referral_shared_item where referral_id = (select id from r1)),
  2, 'two snapshot items frozen (narrative + document)');
select is(
  (select frozen_body_md from public.referral_shared_item
   where referral_id = (select id from r1) and kind = 'narrative'),
  'CORPO-SENSIVEL-DO-PACIENTE', 'narrative snapshot froze a copy of body_md');

-- Decouple proof: edit the SOURCE narrative; the frozen copy is unchanged.
update public.case_narratives set body_md = 'EDITADO-DEPOIS'
  where id = (select narr from cs);
select is(
  (select frozen_body_md from public.referral_shared_item
   where referral_id = (select id from r1) and kind = 'narrative'),
  'CORPO-SENSIVEL-DO-PACIENTE',
  'snapshot is decoupled from later source-narrative edits');

-- =========================================================================
-- Snapshot-lock + status guards: outside an RPC, status cannot change (HC070)
-- and a shared item cannot be added once non-draft (HC073).
-- =========================================================================
select throws_ok(
  $$ update public.case_referral set status = 'enviada' where id = (select id from r1) $$,
  'HC070', null, 'a direct status change outside an RPC is rejected (HC070)');

-- Send it (source coordinator).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.send_referral((select id from r1));
reset role;
select is(
  (select status from public.case_referral where id = (select id from r1)),
  'enviada', 'send_referral moves rascunho -> enviada');

-- After send, a direct shared-item insert is blocked by the snapshot-lock (HC073).
select throws_ok(
  $$ insert into public.referral_shared_item (referral_id, kind, source_narrative_id, frozen_title, frozen_body_md, position)
     values ((select id from r1), 'narrative', (select narr from cs), 't', 'x', 9) $$,
  'HC073', null, 'a shared-item insert after send is rejected by the snapshot-lock (HC073)');

-- The add_referral_shared_item RPC after send is rejected by the draft-writable
-- pre-check (HC070 fires before the row-level HC073 — both block it).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.add_referral_shared_item((select id from r1), 'narrative', (select narr from cs), null) $$,
  'HC070', null, 'add_referral_shared_item after send is rejected (HC070 pre-check)');
reset role;

-- =========================================================================
-- close_case HC076 gate: a reply-expecting referral in flight blocks the close.
-- =========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.close_case((select src_case from cs)) $$,
  'HC076', null, 'close_case is blocked while a reply-expecting referral is in flight (HC076)');
reset role;

-- =========================================================================
-- can_read_referral (broad) vs can_read_referral_phi (tight) — predicate scoping.
-- =========================================================================
select is(app.can_read_referral((select id from r1), (select st_x from k)), true,
  'plain staff of A (source member) CAN read referral metadata');
select is(app.can_read_referral((select id from r1), (select st_y from k)), true,
  'plain staff of B (target member) CAN read referral metadata');
select is(app.can_read_referral((select id from r1), (select admin from k)), true,
  'QPS member CAN read referral metadata');

select is(app.can_read_referral_phi((select id from r1), (select st_x from k)), false,
  'plain staff of A CANNOT read referral PHI bodies');
select is(app.can_read_referral_phi((select id from r1), (select st_y from k)), false,
  'plain staff of B CANNOT read referral PHI bodies');
select is(app.can_read_referral_phi((select id from r1), (select sa_x from k)), true,
  'source coordinator CAN read referral PHI bodies');
select is(app.can_read_referral_phi((select id from r1), (select sa_y from k)), true,
  'target coordinator CAN read referral PHI bodies');
select is(app.can_read_referral_phi((select id from r1), (select admin from k)), true,
  'QPS member CAN read referral PHI bodies');

-- =========================================================================
-- PHI-body lockdown: direct SELECT on the body-bearing tables is PHI-gated.
-- =========================================================================
-- Plain staff of B (target member, broad-read) sees 0 shared-item rows directly.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.referral_shared_item where referral_id = (select id from r1)),
  0, 'plain target member sees 0 rows on a DIRECT referral_shared_item SELECT (PHI-gated)');
reset role;
-- Target coordinator sees them.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.referral_shared_item where referral_id = (select id from r1)),
  2, 'target coordinator sees the shared items on a direct SELECT');
reset role;

-- =========================================================================
-- case_referral column-level lockdown (migration 20260620016000): the PHI-bearing
-- free-text columns are NOT directly selectable by authenticated; the PHI-free
-- columns are.
-- =========================================================================
select is(
  has_column_privilege('authenticated', 'public.case_referral', 'description_md', 'SELECT'),
  false, 'authenticated has NO direct SELECT on case_referral.description_md');
select is(
  has_column_privilege('authenticated', 'public.case_referral', 'decline_note', 'SELECT'),
  false, 'authenticated has NO direct SELECT on case_referral.decline_note');
select is(
  has_column_privilege('authenticated', 'public.case_referral', 'subject', 'SELECT'),
  true, 'authenticated CAN directly SELECT the PHI-free case_referral.subject');

-- =========================================================================
-- get_referral_detail body-gating + referral.viewed audit.
-- =========================================================================
-- Plain staff of A: metadata flows, bodies NULL, NO referral.viewed row.
create temp table vb on commit drop as
  select (select count(*) from public.audit_log where action = 'referral.viewed') as before;
grant select on vb to authenticated;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table d_staff on commit drop as
  select public.get_referral_detail((select id from r1)) as j;
reset role;
grant select on d_staff to authenticated;
select is((select j->>'subject' from d_staff), 'Solicitação de parecer',
  'metadata-only reader still gets the subject');
select ok((select j->'shared_items'->0->>'frozen_body_md' from d_staff) is null,
  'metadata-only reader gets frozen_body_md = NULL');
select is(
  (select count(*) from public.audit_log where action = 'referral.viewed') - (select before from vb),
  0::bigint, 'a metadata-only open writes NO referral.viewed row');

-- Target coordinator: bodies present + exactly one referral.viewed row.
create temp table vb2 on commit drop as
  select (select count(*) from public.audit_log where action = 'referral.viewed') as before;
grant select on vb2 to authenticated;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table d_coord on commit drop as
  select public.get_referral_detail((select id from r1)) as j;
reset role;
grant select on d_coord to authenticated;
select is((select d_coord.j->'shared_items'->0->>'frozen_body_md' from d_coord),
  'CORPO-SENSIVEL-DO-PACIENTE', 'PHI reader (target coord) gets the frozen narrative body');
select is(
  (select count(*) from public.audit_log where action = 'referral.viewed') - (select before from vb2),
  1::bigint, 'a body-serve to the target coordinator writes one referral.viewed row');

-- =========================================================================
-- referral_patient: REVOKE + the audited single-door get_referral_patient.
-- =========================================================================
-- Direct SELECT on referral_patient is REVOKED from authenticated.
select is(
  has_table_privilege('authenticated', 'public.referral_patient', 'SELECT'),
  false, 'authenticated has NO direct SELECT on referral_patient (REVOKE)');

-- Plain staff of A: the door returns NULL and writes NO referral_patient.read row.
create temp table pr on commit drop as
  select (select count(*) from public.audit_log where action = 'referral_patient.read') as before;
grant select on pr to authenticated;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table p_staff on commit drop as
  select public.get_referral_patient((select id from r1)) as j;
reset role;
grant select on p_staff to authenticated;
select ok((select j from p_staff) is null, 'get_referral_patient returns NULL to an unentitled reader');
select is(
  (select count(*) from public.audit_log where action = 'referral_patient.read') - (select before from pr),
  0::bigint, 'an unentitled PHI read writes NO referral_patient.read row');

-- Source coordinator: the door returns the identifiers + writes one read row.
create temp table pr2 on commit drop as
  select (select count(*) from public.audit_log where action = 'referral_patient.read') as before;
grant select on pr2 to authenticated;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table p_coord on commit drop as
  select public.get_referral_patient((select id from r1)) as j;
reset role;
grant select on p_coord to authenticated;
select is((select p_coord.j->>'name' from p_coord), 'Paciente Teste',
  'get_referral_patient returns the identifiers to the source coordinator');
select is(
  (select count(*) from public.audit_log where action = 'referral_patient.read') - (select before from pr2),
  1::bigint, 'an entitled PHI read writes exactly one referral_patient.read row');

-- The referral_patient.updated mutation-audit row carries NO identifier (metadata = {}).
select is(
  (select metadata from public.audit_log
   where action = 'referral_patient.updated' and entity_id = (select id from r1)
   order by occurred_at desc limit 1),
  '{}'::jsonb, 'referral_patient.updated audit metadata carries NO identifier');

-- =========================================================================
-- can_read_case QPS term: QPS reads the referral-touched source (A) AND target (B)
-- live cases; B never reaches A's live case.
-- =========================================================================
-- First link B's case so target_case_id is set (the QPS term covers both ends).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select public.receive_referral((select id from r1));
select public.accept_referral((select id from r1));
select public.link_referral_case((select id from r1), (select tgt_case from cs));
reset role;

select is(app.can_read_case((select src_case from cs), (select admin from k)), true,
  'QPS reads the referral-touched SOURCE (A) live case');
select is(app.can_read_case((select tgt_case from cs), (select admin from k)), true,
  'QPS reads the referral-touched TARGET (B) live case');
select is(app.can_read_case((select src_case from cs), (select sa_y from k)), false,
  'B coordinator CANNOT read A''s live source case (no target-commission term)');

-- =========================================================================
-- close_case with a response_expected=false referral never blocks.
-- =========================================================================
-- A 'ciencia' (notification) referral from A; it should never block the close.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r2 on commit drop as
  select * from public.create_referral_draft(
    (select src_case from cs), (select comm_y from k),
    (select type_ciencia from voc), 'Apenas ciência', false);
select public.add_referral_shared_item((select id from r2), 'document', null, (select doc from cs));
select public.send_referral((select id from r2));
reset role;
grant select on r2 to authenticated;

-- Withdraw r1 (the reply-expecting one) so only the no-reply r2 is in flight, then
-- close must succeed (r2 has response_expected = false).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.withdraw_referral((select id from r1));
create temp table closed on commit drop as
  select * from public.close_case((select src_case from cs));
reset role;
grant select on closed to authenticated;
select is((select status from closed), 'concluido',
  'close_case succeeds with only a response_expected=false referral in flight');

select * from finish();
rollback;
