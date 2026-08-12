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
select plan(218);

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

-- NSP-per-org (ADR 0042): pqs_members has composite PK (organization_id, user_id).
insert into public.memberships (organization_id, hospital_id, principal_id, role, granted_by)
  select (select organization_id from public.hospitals where id = (v->>'hosp_b')::uuid),
         (v->>'hosp_b')::uuid, (v->>'admin')::uuid, 'pqs_member', (v->>'admin')::uuid
  from ctx;
insert into public.pqs_department (hospital_id, name, rca_default_due_days)
  select (v->>'hosp_b')::uuid, 'NSP Bootstrap', 30 from ctx
  on conflict (hospital_id) do nothing;

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
-- DM1 (ADR 0114 D5): the attachments substrate was dropped, so there is no
-- source document row to share — the document arm of add_referral_shared_item
-- is PARKED (HC0DM) until DM4 re-points it at the document model. The frozen
-- document ITEM below is inserted directly (source_document_id NULL — exactly
-- the DM4 reconciliation shape) so the snapshot fixtures keep their two items.

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
select is((select status from r1), 'draft', 'new referral starts draft');
select is((select response_expected from r1), true, 'response_expected seeded from type');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_referral_shared_item(
  (select id from r1), 'narrative', (select narr from cs), null);
-- DM1: the parked document arm refuses IN-FLOW (authority passes first — the
-- caller is the source coordinator; 328 K8a is the sibling pin).
select throws_ok(
  format($$ select public.add_referral_shared_item(%L, 'document', null, %L) $$,
         (select id from r1), (select doc from cs)),
  'HC0DM', null,
  'DM1: the document share arm is PARKED (HC0DM) until DM4');
reset role;
select set_config('app.in_referral_rpc', 'on', true);
insert into public.referral_shared_item
  (referral_id, kind, source_document_id, frozen_title, frozen_storage_path, frozen_mime_type, position)
values ((select id from r1), 'document', null, 'Laudo',
        (select comm_x from k) || '/' || (select src_case from cs) || '/laudo.pdf',
        'application/pdf', 1);
select set_config('app.in_referral_rpc', 'off', true);
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
-- ADR 0078 D7/F1: set_referral_patient left the public API; the SOURCE coordinator
-- writes the snapshot through the save_referral_patient door.
select public.save_referral_patient(
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
  $$ update public.case_referral set status = 'sent' where id = (select id from r1) $$,
  'HC070', null, 'a direct status change outside an RPC is rejected (HC070)');

-- Send it (source coordinator).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.send_referral((select id from r1));
reset role;
select is(
  (select status from public.case_referral where id = (select id from r1)),
  'sent', 'send_referral moves draft -> sent');

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
-- RV2 R1 (case-referral-column-grants guard): the two NEW PHI-free columns must be
-- authenticated-SELECTable, else the direct-select referrals hub 42501s. This is the
-- guard the suite was missing when 20260720000900 added the columns.
select is(
  has_column_privilege('authenticated', 'public.case_referral', 'last_message_at', 'SELECT'),
  true, 'authenticated CAN directly SELECT case_referral.last_message_at (hub column)');
select is(
  has_column_privilege('authenticated', 'public.case_referral', 'waiting_on_committee_id', 'SELECT'),
  true, 'authenticated CAN directly SELECT case_referral.waiting_on_committee_id (hub column)');
-- Positive hub-shaped select: a member reads the new columns directly (no 42501).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select last_message_at, waiting_on_committee_id from public.case_referral where id = (select id from r1) $$,
  'the direct-select hub path (new columns) works for an authenticated member (no 42501)');
reset role;

-- =========================================================================
-- get_referral_detail body-gating + referral.viewed audit.
-- REGRESSION GUARD (BUG-NSP-002): get_referral_detail gates ALL THREE PHI bodies
-- (description_md, shared_items[].frozen_body_md, reply.result_md) on
-- can_read_referral_phi — NOT just frozen_body_md. The NSP-per-org migration had
-- reverted the …015000 lockdown and served the bodies UNCONDITIONALLY to a
-- metadata-only reader; this block asserts the within-referral metadata-reader-vs-
-- PHI-reader distinction across every body so the leak cannot silently return.
--
-- Seed the two bodies the bootstrap r1 lacks (description_md was dropped by the
-- 5-arg create_referral_draft; r1 has no reply). Direct writes under the
-- in_referral_rpc guard flag (the seed's pattern) so the snapshot-lock/status
-- guards permit them on an already-sent referral; reverts with the rollback.
select set_config('app.in_referral_rpc', 'on', true);
update public.case_referral
  set description_md = 'DESCRICAO-SENSIVEL-DO-PACIENTE'
  where id = (select id from r1);
insert into public.referral_reply
  (referral_id, reply_outcome_id, outcome_label, result_md, acknowledged_only, replied_by, replied_at)
values
  ((select id from r1), (select outcome_procede from voc), 'Procede',
   'PARECER-SENSIVEL-DO-PACIENTE', false, (select sa_y from k), now());
select set_config('app.in_referral_rpc', 'off', true);

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
-- BUG-NSP-002 GUARD: the OTHER two PHI bodies must ALSO be NULL for a metadata-only
-- reader (the leak served these unconditionally).
select ok((select j->>'description_md' from d_staff) is null,
  'BUG-NSP-002 GUARD: metadata-only reader gets description_md = NULL');
select ok((select j->'reply'->>'result_md' from d_staff) is null,
  'BUG-NSP-002 GUARD: metadata-only reader gets reply.result_md = NULL');
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
-- BUG-NSP-002 GUARD: the OTHER two PHI bodies must be POPULATED for a PHI reader —
-- proves the gate serves (not just nulls) and pins the metadata/PHI distinction.
select is((select d_coord.j->>'description_md' from d_coord),
  'DESCRICAO-SENSIVEL-DO-PACIENTE',
  'BUG-NSP-002 GUARD: PHI reader (target coord) gets the populated description_md');
select is((select d_coord.j->'reply'->>'result_md' from d_coord),
  'PARECER-SENSIVEL-DO-PACIENTE',
  'BUG-NSP-002 GUARD: PHI reader (target coord) gets the populated reply.result_md');
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

-- The referral_patient.updated mutation-audit row carries NO identifier.
-- ACT Stage 3 (ADR 0106 D8): audit_write now always stamps metadata.acting_as
-- from the writer's active hat (staff_admin, per this section's actor) — the
-- assertion is updated to the new expected shape, not weakened; NO identifier
-- (PHI) key is added, which is what this test actually guards.
select is(
  (select metadata from public.audit_log
   where action = 'referral_patient.updated' and entity_id = (select id from r1)
   order by occurred_at desc limit 1),
  '{"acting_as": "staff_admin"}'::jsonb, 'referral_patient.updated audit metadata carries NO identifier (only the D8 acting_as stamp)');

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
-- RV2 R1 fast-follow: get_referral_detail compose-authority flags (PHI-free),
-- matching the EXACT post/request/provide RPC gates (incl. the target ANALYST arm).
-- r1 is linked to tgt_case (status accepted), so referral_target_analyst is testable.
-- =========================================================================
-- Make st_y (plain target staff, NOT a coordinator) a TARGET ANALYST via a
-- case_access grant on B's target case.
select test_helpers.grant_ca((select tgt_case from cs), (select st_y from k), 'read', (select sa_y from k));

-- Source coordinator: compose-as-source true, compose-as-target false.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cf_src on commit drop as select public.get_referral_detail((select id from r1)) as j;
reset role;
grant select on cf_src to authenticated;
select is((select (j->>'can_compose_as_source')::boolean from cf_src), true,
  'source coordinator gets can_compose_as_source = true');
select is((select (j->>'can_compose_as_target')::boolean from cf_src), false,
  'source coordinator gets can_compose_as_target = false');

-- Target ANALYST (st_y via case_access, NOT a coordinator): compose-as-target true.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
create temp table cf_analyst on commit drop as select public.get_referral_detail((select id from r1)) as j;
reset role;
grant select on cf_analyst to authenticated;
select is((select (j->>'can_compose_as_target')::boolean from cf_analyst), true,
  'target ANALYST (case_access, not coordinator) gets can_compose_as_target = true (analyst arm)');

-- Plain source member (st_x, no analyst): both false.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table cf_plain on commit drop as select public.get_referral_detail((select id from r1)) as j;
reset role;
grant select on cf_plain to authenticated;
select is((select (j->>'can_compose_as_source')::boolean from cf_plain), false,
  'plain source member gets can_compose_as_source = false');
select is((select (j->>'can_compose_as_target')::boolean from cf_plain), false,
  'plain source member gets can_compose_as_target = false');

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
-- DM1: r2 just needs ≥1 snapshot item to send — share the NARRATIVE (the
-- document arm is parked until DM4; the arm choice is incidental here).
select public.add_referral_shared_item((select id from r2), 'narrative', (select narr from cs), null);
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
select is((select status from closed), 'completed',
  'close_case succeeds with only a response_expected=false referral in flight');

-- =========================================================================
-- RV2 R1 — Dialogue core (ADR 0037 Amendment 1). A fresh OPEN source case (src2)
-- + a referral r3 driven to in_review to exercise the thread + the waiting state.
-- =========================================================================
create temp table cs2 on commit drop as
  select gen_random_uuid() as src2, gen_random_uuid() as narr2;
grant select on cs2 to authenticated;
insert into public.cases (id, commission_id, case_number, label, created_by)
values ((select src2 from cs2), (select comm_x from k), 9203, 'Caso A2', (select sa_x from k));
insert into public.case_narratives (id, case_id, type_label, display_position, title, body_md, created_by)
values ((select narr2 from cs2), (select src2 from cs2), 'Resumo', 0, 'Resumo', 'CORPO-A2', (select sa_x from k));

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r3 on commit drop as
  select * from public.create_referral_draft(
    (select src2 from cs2), (select comm_y from k),
    (select type_parecer from voc), 'Diálogo R1', true);
reset role;
grant select on r3 to authenticated;

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.add_referral_shared_item((select id from r3), 'narrative', (select narr2 from cs2), null);
select public.send_referral((select id from r3));
reset role;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select public.receive_referral((select id from r3));
select public.accept_referral((select id from r3));
select public.start_referral_review((select id from r3));
reset role;

-- ---- post_referral_message: entitlement (HC0A0) + sequence allocation ----
-- QPS (a PHI reader) cannot resolve to a sender side → cannot post.
select test_helpers.claims_for((select admin from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.post_referral_message((select id from r3), 'general', 'oi') $$,
  'HC0A0', null, 'a QPS reader cannot post (no source/target side to resolve) — HC0A0');
reset role;
-- A plain (non-PHI) member cannot post.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.post_referral_message((select id from r3), 'general', 'oi') $$,
  'HC0A0', null, 'a non-PHI member cannot post — HC0A0');
reset role;
-- Source + target coordinators each post → two distinct sequence numbers.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.post_referral_message((select id from r3), 'general', 'MENSAGEM-A') $$,
  'source coordinator posts a message (seq 1)');
reset role;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.post_referral_message((select id from r3), 'general', 'MENSAGEM-B') $$,
  'target coordinator posts a message (seq 2)');
reset role;
select is((select count(*)::int from public.referral_messages where referral_id = (select id from r3)),
  2, 'two posts create two message rows');
select is((select count(distinct sequence_number)::int from public.referral_messages where referral_id = (select id from r3)),
  2, 'concurrent-safe: the two posts get DISTINCT sequence_number');

-- ---- t19 REVOKE guards ----
select is(has_function_privilege('public',
  'public.post_referral_message(uuid,text,text)', 'execute'), false,
  't19: PUBLIC cannot execute post_referral_message');
select is(has_function_privilege('public',
  'public.request_referral_information(uuid,text)', 'execute'), false,
  't19: PUBLIC cannot execute request_referral_information');
select is(has_function_privilege('public',
  'public.provide_referral_information(uuid,text)', 'execute'), false,
  't19: PUBLIC cannot execute provide_referral_information');

-- ---- Option B: body column-lockdown + DML-revoked ----
select is(has_column_privilege('authenticated', 'public.referral_messages', 'body', 'SELECT'),
  false, 'Option B: authenticated has NO direct SELECT on referral_messages.body');
select is(has_column_privilege('authenticated', 'public.referral_messages', 'sequence_number', 'SELECT'),
  true, 'authenticated CAN directly SELECT the PHI-free referral_messages.sequence_number');
-- A PHI-cleared reader (target coord) still cannot direct-SELECT body (only the door):
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  $$ select body from public.referral_messages where referral_id = (select id from r3) $$,
  '42501', null, 'Option B: even a PHI reader''s direct SELECT body is denied (door only)');
-- Direct INSERT is revoked (writes are DEFINER-RPC only):
select throws_ok(
  format($$ insert into public.referral_messages (referral_id, sequence_number, sender_commission_id, message_type, body)
            values (%L, 99, %L, 'general', 'x') $$, (select id from r3), (select comm_y from k)),
  '42501', null, 'direct INSERT into referral_messages is denied (DML revoked)');
-- ...but the PHI reader DOES see the rows (metadata) via the row policy.
select is((select count(*)::int from public.referral_messages where referral_id = (select id from r3)),
  2, 'a PHI reader sees the message rows (metadata) under the row policy');
reset role;
-- A non-PHI member sees ZERO message rows on a direct SELECT (row policy = can_read_referral_phi).
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select count(*)::int from public.referral_messages where referral_id = (select id from r3)),
  0, 'a non-PHI member sees 0 message rows directly (row RLS = can_read_referral_phi)');
reset role;

-- ---- get_referral_detail: metadata reader → body NULL; PHI reader → body + one referral.viewed ----
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table md_msgs on commit drop as
  select public.get_referral_detail((select id from r3)) as j;
reset role;
grant select on md_msgs to authenticated;
select is((select jsonb_array_length(j->'messages') from md_msgs), 2,
  'metadata-only reader gets the message thread metadata (2 messages)');
select ok((select j->'messages'->0->>'body' from md_msgs) is null,
  'metadata-only reader gets message body = NULL');

create temp table vb3 on commit drop as
  select (select count(*) from public.audit_log where action = 'referral.viewed') as before;
grant select on vb3 to authenticated;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table phi_msgs on commit drop as
  select public.get_referral_detail((select id from r3)) as j;
reset role;
grant select on phi_msgs to authenticated;
select is((select phi_msgs.j->'messages'->0->>'body' from phi_msgs), 'MENSAGEM-A',
  'PHI reader gets the populated message body via the door');
select is(
  (select count(*) from public.audit_log where action = 'referral.viewed') - (select before from vb3),
  1::bigint, 'a message-body serve to the target coordinator writes one referral.viewed row');

-- ---- request / provide: waiting_on + status transitions, entitlement, wrong-status ----
-- Source coordinator cannot REQUEST (target-only) — HC0A0. (status = in_review)
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.request_referral_information((select id from r3), 'preciso de X') $$,
  'HC0A0', null, 'the source cannot request information (target-only) — HC0A0');
reset role;
-- Target coordinator requests → awaiting_information, waiting_on = source.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select public.request_referral_information((select id from r3), 'Preciso de mais detalhes');
reset role;
select is((select status from public.case_referral where id = (select id from r3)),
  'awaiting_information', 'request_referral_information → awaiting_information');
select is((select waiting_on_committee_id from public.case_referral where id = (select id from r3)),
  (select comm_x from k), 'request sets waiting_on = source committee');
-- Request again from awaiting_information → wrong status (HC0A1).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.request_referral_information((select id from r3), 'de novo') $$,
  'HC0A1', null, 'request from a non-in_review status is rejected (HC0A1)');
-- Target cannot PROVIDE (source-only) — HC0A0.
select throws_ok(
  $$ select public.provide_referral_information((select id from r3), 'resposta') $$,
  'HC0A0', null, 'the target cannot provide the response (source-only) — HC0A0');
reset role;
-- close_case is BLOCKED while the child referral is awaiting_information (Flag A fix).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.close_case((select src2 from cs2)) $$,
  'HC076', null, 'close_case is blocked while a referral is awaiting_information (gate fix)');
-- Source coordinator provides → in_review, waiting_on = target.
select public.provide_referral_information((select id from r3), 'Aqui estão os detalhes');
reset role;
select is((select status from public.case_referral where id = (select id from r3)),
  'in_review', 'provide_referral_information → in_review');
select is((select waiting_on_committee_id from public.case_referral where id = (select id from r3)),
  (select comm_y from k), 'provide sets waiting_on = target committee');
-- Provide again from in_review → wrong status (HC0A1).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.provide_referral_information((select id from r3), 'de novo') $$,
  'HC0A1', null, 'provide from a non-awaiting_information status is rejected (HC0A1)');
reset role;

-- QA M-1: post_referral_message may NOT mint the state-driving types (those come
-- only from Solicitar/Responder); {general, clarification} still post. (r3 is
-- in_review — postable.)
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.post_referral_message((select id from r3), 'information_request', 'x') $$,
  'HC0A0', null, 'M-1: post_referral_message rejects the state-driving information_request type (HC0A0)');
select lives_ok(
  $$ select public.post_referral_message((select id from r3), 'clarification', 'um esclarecimento') $$,
  'M-1: post_referral_message still accepts a clarification message');
reset role;

-- =========================================================================
-- RV2 R2 — Triage, SLA & requested-action (ALL PHI-free metadata; plan §3 R2).
-- The keystone: the PHI-free triage fields (priority / requested_action /
-- response_due_at / decline_reason_code) are visible to a METADATA-tier reader
-- (the current metadata predicate can_read_referral_metadata) with NO PHI leak,
-- while decline_note stays PHI-gated (column-REVOKED). Overdue predicate ==
-- isReferralOverdue. Vocab CRUD HC0A3; past deadline HC0A4.
-- =========================================================================

-- ---- PHI-free column grants: the five triage columns are directly SELECTable by
--      authenticated; the PHI decline_note stays column-REVOKED. ----
select is(has_column_privilege('authenticated', 'public.case_referral', 'priority', 'SELECT'),
  true, 'R2: authenticated CAN direct-SELECT the PHI-free case_referral.priority');
select is(has_column_privilege('authenticated', 'public.case_referral', 'requested_action_id', 'SELECT'),
  true, 'R2: authenticated CAN direct-SELECT requested_action_id');
select is(has_column_privilege('authenticated', 'public.case_referral', 'requested_action_label', 'SELECT'),
  true, 'R2: authenticated CAN direct-SELECT requested_action_label');
select is(has_column_privilege('authenticated', 'public.case_referral', 'response_due_at', 'SELECT'),
  true, 'R2: authenticated CAN direct-SELECT response_due_at');
select is(has_column_privilege('authenticated', 'public.case_referral', 'decline_reason_code', 'SELECT'),
  true, 'R2: authenticated CAN direct-SELECT the PHI-free decline_reason_code');
-- BOUNDARY KEYSTONE (mutation-provable): decline_note stays column-REVOKED. Neutralize
-- it (`grant select (decline_note) on public.case_referral to authenticated;`) and the
-- direct-SELECT assertion below (and this) flip RED — the REVOKE is load-bearing.
select is(has_column_privilege('authenticated', 'public.case_referral', 'decline_note', 'SELECT'),
  false, 'R2 keystone: the PHI decline_note is NOT directly SELECTable (column-REVOKED)');

-- ---- t19 REVOKE guards for the new public.* RPCs ----
select is(has_function_privilege('public',
  'public.create_referral_requested_action(text,text,text,text,integer)', 'execute'), false,
  't19: PUBLIC cannot execute create_referral_requested_action');
select is(has_function_privilege('public',
  'public.update_referral_requested_action(uuid,text,text,text,integer,boolean)', 'execute'), false,
  't19: PUBLIC cannot execute update_referral_requested_action');
select is(has_function_privilege('public',
  'public.set_referral_deadline(uuid,timestamptz)', 'execute'), false,
  't19: PUBLIC cannot execute set_referral_deadline');

-- ---- Overdue predicate == isReferralOverdue (past + non-terminal = overdue) ----
select is(app.referral_is_overdue(now() - interval '1 day', 'in_review'), true,
  'R2 overdue: a past deadline on a non-terminal referral is overdue');
select is(app.referral_is_overdue(now() + interval '1 day', 'in_review'), false,
  'R2 overdue: a future deadline is NOT overdue');
select is(app.referral_is_overdue(now() - interval '1 day', 'completed'), false,
  'R2 overdue: a past deadline on a TERMINAL referral is not overdue');
select is(app.referral_is_overdue(null, 'in_review'), false,
  'R2 overdue: a null deadline is never overdue');

-- ---- A draft carrying triage (priority + requested-action + future due) ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r4 on commit drop as
  select * from public.create_referral_draft(
    (select src_case from cs), (select comm_y from k),
    (select type_parecer from voc), 'Triagem R2',
    true, null, 'urgent',
    (select id from public.referral_requested_actions where key = 'review'),
    now() + interval '7 days');
reset role;
grant select on r4 to authenticated;
select is((select priority from r4), 'urgent', 'R2: create_referral_draft stores the priority');
select is((select requested_action_label from r4), 'Emitir parecer',
  'R2: create_referral_draft snapshots the requested_action_label');

-- ---- Metadata-tier reader (plain staff of source A; NON-PHI) sees the triage
--      fields directly, but the PHI decline_note is denied (42501). ----
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select priority from public.case_referral where id = (select id from r4)),
  'urgent', 'R2 keystone: a metadata-tier reader sees priority (PHI-free) on a direct SELECT');
select throws_ok(
  $$ select decline_note from public.case_referral where id = (select id from r4) $$,
  '42501', null,
  'R2 keystone: a metadata-tier reader''s direct SELECT of decline_note is DENIED (PHI column-REVOKED)');
-- The audited door projects the PHI-free triage to a metadata reader too.
create temp table md_r4 on commit drop as
  select public.get_referral_detail((select id from r4)) as j;
reset role;
grant select on md_r4 to authenticated;
select is((select md_r4.j->>'priority' from md_r4), 'urgent',
  'R2: the audited door projects priority to a metadata-tier reader');

-- ---- decline_reason_code (PHI-free) vs decline_note (PHI): a declined referral ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r5 on commit drop as
  select * from public.create_referral_draft(
    (select src_case from cs), (select comm_y from k),
    (select type_parecer from voc), 'Recusa R2', true,
    'Motivo do encaminhamento para exercício da recusa.');
select public.send_referral((select id from r5));
reset role;
grant select on r5 to authenticated;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select public.receive_referral((select id from r5));
-- Decline with BOTH the PHI note and the PHI-free structured reason.
select public.decline_referral((select id from r5), 'NOTA-SENSIVEL', 'wrong_committee');
reset role;
select is((select decline_reason_code from public.case_referral where id = (select id from r5)),
  'wrong_committee', 'R2: decline_referral stores the PHI-free decline_reason_code');

-- Metadata reader via the door → decline_reason_code populated, decline_note NULL.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
create temp table md_r5 on commit drop as
  select public.get_referral_detail((select id from r5)) as j;
reset role;
grant select on md_r5 to authenticated;
select is((select md_r5.j->>'decline_reason_code' from md_r5), 'wrong_committee',
  'R2 keystone: a metadata-tier reader gets the PHI-free decline_reason_code via the door');
select ok((select md_r5.j->>'decline_note' from md_r5) is null,
  'R2 keystone: a metadata-tier reader gets decline_note = NULL (PHI stays gated)');

-- PHI reader (target coordinator) via the door → BOTH populated.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table phi_r5 on commit drop as
  select public.get_referral_detail((select id from r5)) as j;
reset role;
grant select on phi_r5 to authenticated;
select is((select phi_r5.j->>'decline_note' from phi_r5), 'NOTA-SENSIVEL',
  'R2: a PHI reader gets the populated decline_note via the door');
select is((select phi_r5.j->>'decline_reason_code' from phi_r5), 'wrong_committee',
  'R2: a PHI reader also gets the PHI-free decline_reason_code');

-- ---- Requested-action vocab CRUD (HC0A3): admin only ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_referral_requested_action('custom_x', 'Ação X') $$,
  'HC0A3', null, 'R2: a non-admin cannot create a requested-action (HC0A3)');
reset role;
select test_helpers.claims_for((select admin from k), true, 'platform_admin');
set local role authenticated;
select lives_ok(
  $$ select public.create_referral_requested_action('custom_x', 'Ação X') $$,
  'R2: an admin (is_admin claim) can create a requested-action');
reset role;

-- ---- SLA deadline (set_referral_deadline): coordinator-gated (HC072), past → HC0A4 ----
-- r3 is in_review (non-terminal). A plain staff member cannot set a deadline.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_referral_deadline((select id from r3), now() + interval '3 days') $$,
  'HC072', null, 'R2: a non-coordinator cannot set the SLA deadline (HC072)');
reset role;
-- The target coordinator: a past date is rejected (HC0A4); a future date lands.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.set_referral_deadline((select id from r3), now() - interval '1 day') $$,
  'HC0A4', null, 'R2: a past SLA deadline is rejected (HC0A4)');
select lives_ok(
  $$ select public.set_referral_deadline((select id from r3), now() + interval '5 days') $$,
  'R2: the coordinator sets a future SLA deadline');
reset role;
select ok((select response_due_at from public.case_referral where id = (select id from r3)) is not null,
  'R2: set_referral_deadline persists response_due_at');

-- =========================================================================
-- RV2 R3 — Resolution cycles, reopening & parent lineage (ADR 0037 D4/D5/D15).
--   * conclude (reply-expected) → answered (not completed); waiting_on = source.
--   * close_case: answered BLOCKS (K1), resolved RELEASES (K2).
--   * resolve authority is checked FIRST → 42501, never HC0A5 (K3 non-vacuity).
--   * summary_md is PHI (column-REVOKED); non-PHI history visible (K4).
--   * one active resolution + append-only across reopen (K5).
--   * a child referral shares NOTHING from its parent (D15, K6).
-- =========================================================================
-- A fresh BARE source case in A (no phases/outcomes → close_case can succeed) +
-- a reply-expecting referral driven to `answered`.
create temp table cs3 on commit drop as select gen_random_uuid() as src3;
grant select on cs3 to authenticated;
insert into public.cases (id, commission_id, case_number, label, created_by)
values ((select src3 from cs3), (select comm_x from k), 9301, 'Caso A3', (select sa_x from k));

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r6 on commit drop as
  select * from public.create_referral_draft(
    (select src3 from cs3), (select comm_y from k),
    (select type_parecer from voc), 'Resolução R3', true,
    'Descrição para viabilizar o envio.');
select public.send_referral((select id from r6));
reset role;
grant select on r6 to authenticated;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select public.receive_referral((select id from r6));
select public.accept_referral((select id from r6));
select public.start_referral_review((select id from r6));
-- conclude (reply-expected) → answered (NOT completed); waiting_on = source (A owes).
select public.conclude_referral((select id from r6), (select outcome_procede from voc), 'Parecer emitido');
reset role;

select is((select status from public.case_referral where id = (select id from r6)),
  'answered', 'R3: conclude (reply-expected) lands answered (not completed)');
select is((select waiting_on_committee_id from public.case_referral where id = (select id from r6)),
  (select comm_x from k), 'R3: answered sets waiting_on = source commission (A owes the resolution)');

-- ---- K1: answered BLOCKS close_case (HC076) ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.close_case((select src3 from cs3)) $$,
  'HC076', null,
  'R3·K1: an answered reply-expecting referral BLOCKS close_case (HC076)');
reset role;

-- ---- K3: resolve authority is NON-VACUOUS (referral IS state-valid = answered) ----
-- A target coordinator resolving an answered referral is denied 42501 (AUTHORITY,
-- checked FIRST), NOT HC0A5 (which would be the state error).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.resolve_referral((select id from r6)) $$,
  '42501', null,
  'R3·K3: a TARGET coordinator resolving an ANSWERED referral is denied 42501 (authority, not state)');
reset role;
-- A plain SOURCE staff member (not the coordinator) is likewise denied 42501.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.resolve_referral((select id from r6)) $$,
  '42501', null,
  'R3·K3: a plain SOURCE staff resolving an ANSWERED referral is denied 42501 (authority)');
reset role;

-- ---- K2: resolve → resolved RELEASES the close-gate ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.resolve_referral((select id from r6), 'Resumo da resolução SENSIVEL', false);
reset role;
select is((select status from public.case_referral where id = (select id from r6)),
  'resolved', 'R3·K2: resolve_referral moves answered → resolved');
select ok((select waiting_on_committee_id from public.case_referral where id = (select id from r6)) is null,
  'R3·K2: resolve clears waiting_on');
select is((select count(*)::int from public.referral_resolutions where referral_id = (select id from r6)),
  1, 'R3·K2: resolve appends exactly one resolution row');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  $$ select public.close_case((select src3 from cs3)) $$,
  'R3·K2: with the referral resolved, close_case succeeds (resolved releases the gate)');
reset role;

-- ---- K4: summary_md is PHI (column-REVOKED); non-PHI history is visible ----
-- A metadata-tier reader (plain source staff) sees the row's non-PHI columns but a
-- direct SELECT of summary_md is DENIED (42501); the door nulls it. A PHI reader
-- (source coordinator) gets summary_md via the audited door.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select is((select resolution_number from public.referral_resolutions
           where referral_id = (select id from r6) order by resolution_number limit 1),
  1, 'R3·K4: a metadata-tier reader sees the resolution row non-PHI cols (resolution_number)');
select throws_ok(
  $$ select summary_md from public.referral_resolutions where referral_id = (select id from r6) $$,
  '42501', null,
  'R3·K4: a metadata-tier reader''s direct SELECT of summary_md is DENIED (PHI column-REVOKED)');
create temp table md_r6 on commit drop as
  select public.get_referral_detail((select id from r6)) as j;
reset role;
grant select on md_r6 to authenticated;
select ok((select (md_r6.j->'resolutions'->0->>'summary_md') from md_r6) is null,
  'R3·K4: the audited door serves summary_md = NULL to a metadata-tier reader');
select is((select (md_r6.j->'resolutions'->0->>'resolution_number') from md_r6), '1',
  'R3·K4: the door still serves the non-PHI resolution history to a metadata-tier reader');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table phi_r6 on commit drop as
  select public.get_referral_detail((select id from r6)) as j;
reset role;
grant select on phi_r6 to authenticated;
select is((select (phi_r6.j->'resolutions'->0->>'summary_md') from phi_r6),
  'Resumo da resolução SENSIVEL', 'R3·K4: a PHI reader gets summary_md via the audited door');

-- ---- K5: one active resolution + append-only across reopen ----
-- The partial-unique index rejects a 2nd ACTIVE (reopened_at IS NULL) resolution.
-- (Run as the test owner — bypasses RLS/grants — to exercise the INDEX directly.)
select throws_ok(
  format($$ insert into public.referral_resolutions
    (referral_id, resolution_number, resolved_by_commission_id, resolved_by_user_id, resolved_at)
    values (%L, 99, %L, %L, now()) $$,
    (select id from r6), (select comm_x from k), (select sa_x from k)),
  '23505', null,
  'R3·K5: a 2nd ACTIVE resolution (reopened_at IS NULL) violates the partial-unique index (23505)');
-- Through the RPC, a 2nd resolve without reopen is blocked by the state guard first (HC0A5).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.resolve_referral((select id from r6)) $$,
  'HC0A5', null,
  'R3·K5: a 2nd resolve without reopen is blocked (HC0A5 — status resolved, not answered)');
-- Reopen (source coordinator) → in_review; the prior resolution row is preserved.
select public.reopen_referral((select id from r6), 'Reabertura para nova análise');
reset role;
select is((select status from public.case_referral where id = (select id from r6)),
  'in_review', 'R3·K5: reopen moves resolved → in_review');
select is((select waiting_on_committee_id from public.case_referral where id = (select id from r6)),
  (select comm_y from k), 'R3·K5: reopen sets waiting_on = target');
select ok((select reopened_at from public.referral_resolutions
           where referral_id = (select id from r6) and resolution_number = 1) is not null,
  'R3·K5: reopen marks the prior resolution row reopened (append-only; row preserved)');
-- Re-conclude → answered, then resolve → resolution_number 2 (append-only).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select public.conclude_referral((select id from r6), (select outcome_procede from voc), 'Novo parecer');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.resolve_referral((select id from r6), 'Segunda resolução', false);
reset role;
select is((select max(resolution_number)::int from public.referral_resolutions where referral_id = (select id from r6)),
  2, 'R3·K5: after reopen, the next resolve appends resolution_number 2');
select is((select count(*)::int from public.referral_resolutions where referral_id = (select id from r6)),
  2, 'R3·K5: append-only — both resolution rows are preserved');

-- ---- K6: parent lineage shares NOTHING automatically (ADR 0037 D15) ----
-- r3 (from the R1 block) has exactly one frozen shared item — the parent.
select is((select count(*)::int from public.referral_shared_item where referral_id = (select id from r3)),
  1, 'R3·K6 (non-vacuity): the PARENT r3 has exactly one shared item');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r7 on commit drop as
  select * from public.create_referral_draft(
    (select src2 from cs2), (select comm_y from k),
    (select type_parecer from voc), 'Filho (lineage)', true,
    null, 'routine', null, null,
    (select id from r3));  -- p_parent_referral_id
reset role;
grant select on r7 to authenticated;
select is((select parent_referral_id from r7), (select id from r3),
  'R3·K6: the child stores parent_referral_id');
select is((select count(*)::int from public.referral_shared_item where referral_id = (select id from r7)),
  0, 'R3·K6 (D15): the child has ZERO shared items — nothing copied from the parent');
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table cd_r7 on commit drop as
  select public.get_referral_detail((select id from r7)) as j;
reset role;
grant select on cd_r7 to authenticated;
select is((select jsonb_array_length(cd_r7.j->'shared_items') from cd_r7), 0,
  'R3·K6 (D15): the child detail door exposes NO shared items from the parent');
select is((select cd_r7.j->>'parent_referral_id' from cd_r7), (select id from r3)::text,
  'R3·K6: the child detail door exposes parent_referral_id');

-- ---- HC0A6: an invalid parent_referral_id is rejected ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  $$ select public.create_referral_draft(
       (select src2 from cs2), (select comm_y from k),
       (select type_parecer from voc), 'Filho inválido', true,
       null, 'routine', null, null, gen_random_uuid()) $$,
  'HC0A6', null,
  'R3: create_referral_draft rejects a non-existent parent_referral_id (HC0A6)');
reset role;

-- ---- No-reply acknowledgment still concludes straight to completed (terminal) ----
create temp table cs4 on commit drop as select gen_random_uuid() as src4;
grant select on cs4 to authenticated;
insert into public.cases (id, commission_id, case_number, label, created_by)
values ((select src4 from cs4), (select comm_x from k), 9302, 'Caso A4', (select sa_x from k));
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r8 on commit drop as
  select * from public.create_referral_draft(
    (select src4 from cs4), (select comm_y from k),
    (select type_ciencia from voc), 'Ciência R3', false,
    'Descrição para viabilizar o envio.');
select public.send_referral((select id from r8));
reset role;
grant select on r8 to authenticated;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select public.receive_referral((select id from r8));
select public.accept_referral((select id from r8));
select public.start_referral_review((select id from r8));
select public.conclude_referral((select id from r8), null, null, true);
reset role;
select is((select status from public.case_referral where id = (select id from r8)),
  'completed', 'R3: a no-reply acknowledgment concludes straight to completed (terminal)');

-- =========================================================================
-- RV2 R4 — Responsibility & multi-linkage (ADR 0037 D-R4). ADDITIVE tables:
--   referral_assignments (WHO is responsible) + referral_case_links (typed
--   related-case pointers). The core guarantees:
--   * assign/link authority is checked FIRST → 42501, never HC0A7/HC0A8 (K-R4-3
--     non-vacuity); domain errors are HC0A7 (assignment) / HC0A8 (link).
--   * ASSIGNMENT ≠ ACCESS: an assignment row grants NO referral read (K-R4-1).
--   * LINK ≠ CASE ACCESS: a referral_case_link grants NO read of the linked case
--     (K-R4-2).
--   * list_my_referral_assignments is self-scoped + PHI-free (K-R4-4).
-- =========================================================================
-- A fresh source case in A + a DRAFT referral A→B (assign/link do not gate on
-- status). st_x2 (a member of A) is the source reviewer; org_b for the stranger.
create temp table k4 on commit drop as
  select (v->>'st_x2')::uuid as st_x2, (v->>'org_b')::uuid as org_b from ctx;
grant select on k4 to authenticated;

create temp table cs5 on commit drop as select gen_random_uuid() as src5;
grant select on cs5 to authenticated;
insert into public.cases (id, commission_id, case_number, label, created_by)
values ((select src5 from cs5), (select comm_x from k), 9401, 'Caso A5', (select sa_x from k));

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r9 on commit drop as
  select * from public.create_referral_draft(
    (select src5 from cs5), (select comm_y from k),
    (select type_parecer from voc), 'Responsabilidade R4', true,
    'Descrição para viabilizar o envio.');
reset role;
grant select on r9 to authenticated;

-- ---- K-R4-3: assign authority is NON-VACUOUS (referral valid, role valid,
--      assignee IS a member of the side — so the ONLY failure is authority) ----
-- A plain SOURCE staff assigning on the SOURCE side is denied 42501 (authority),
-- NOT HC0A7. st_x2 is a genuine member of A, so the domain checks would pass.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.assign_referral_reviewer(%L, %L, %L, 'primary_reviewer') $$,
    (select id from r9), (select comm_x from k), (select st_x2 from k4)),
  '42501', null,
  'R4·K-R4-3: a plain SOURCE staff assigning on the source side is denied 42501 (authority, not HC0A7)');
reset role;
-- The coordinator of the OTHER side (target) assigning on the SOURCE side → 42501.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.assign_referral_reviewer(%L, %L, %L, 'primary_reviewer') $$,
    (select id from r9), (select comm_x from k), (select st_x2 from k4)),
  '42501', null,
  'R4·K-R4-3: the coordinator of the OTHER (target) side assigning on the source side is denied 42501');
reset role;

-- ---- Happy path: the source coordinator assigns a member of A ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table asg1 on commit drop as
  select * from public.assign_referral_reviewer(
    (select id from r9), (select comm_x from k), (select st_x2 from k4), 'primary_reviewer');
reset role;
grant select on asg1 to authenticated;
select is((select status from asg1), 'pending', 'R4: assign creates a pending assignment');
select is((select commission_id from asg1), (select comm_x from k),
  'R4: the assignment is attributed to the source commission');

-- The TARGET coordinator assigns a member of B (either side works independently).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table asg2 on commit drop as
  select * from public.assign_referral_reviewer(
    (select id from r9), (select comm_y from k), (select st_y from k), 'clinical_reviewer');
reset role;
grant select on asg2 to authenticated;
select is((select status from asg2), 'pending', 'R4: the target coordinator assigns on the target side');

-- ---- HC0A7 domain errors (checked AFTER authority) ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.assign_referral_reviewer(%L, %L, %L, 'bogus_role') $$,
    (select id from r9), (select comm_x from k), (select st_x2 from k4)),
  'HC0A7', null, 'R4: an invalid assignment_role is rejected (HC0A7)');
select throws_ok(
  format($$ select public.assign_referral_reviewer(%L, %L, %L, 'primary_reviewer') $$,
    (select id from r9), (select comm_x from k), (select st_y from k)),
  'HC0A7', null, 'R4: an assignee who is not a member of the commission is rejected (HC0A7)');
select throws_ok(
  format($$ select public.assign_referral_reviewer(%L, %L, %L, 'primary_reviewer') $$,
    (select id from r9), gen_random_uuid(), (select st_x2 from k4)),
  'HC0A7', null, 'R4: a commission that is neither side of the referral is rejected (HC0A7)');
reset role;

-- ---- update_referral_assignment: authority-first + status transitions ----
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.update_referral_assignment(%L, 'in_progress') $$, (select id from asg1)),
  '42501', null, 'R4: a non-coordinator cannot update an assignment (42501)');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.update_referral_assignment(%L, 'bogus_status') $$, (select id from asg1)),
  'HC0A7', null, 'R4: an invalid assignment status is rejected (HC0A7)');
select lives_ok(
  format($$ select public.update_referral_assignment(%L, 'in_progress') $$, (select id from asg1)),
  'R4: the source coordinator advances the assignment to in_progress');
select is((select status from public.referral_assignments where id = (select id from asg1)),
  'in_progress', 'R4: the assignment status is updated');
select public.update_referral_assignment((select id from asg1), 'completed');
reset role;
select ok((select completed_at from public.referral_assignments where id = (select id from asg1)) is not null,
  'R4: →completed sets completed_at');

-- ---- cancel_referral_assignment: authority-first ----
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.cancel_referral_assignment(%L) $$, (select id from asg2)),
  '42501', null, 'R4: a non-coordinator cannot cancel an assignment (42501)');
reset role;
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select public.cancel_referral_assignment((select id from asg2));
reset role;
select is((select status from public.referral_assignments where id = (select id from asg2)),
  'cancelled', 'R4: cancel sets status = cancelled');
select ok((select cancelled_at from public.referral_assignments where id = (select id from asg2)) is not null,
  'R4: cancel sets cancelled_at');

-- ---- link_referral_related_case: authority-first + HC0A8 domain ----
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.link_referral_related_case(%L, %L, 'related_case') $$,
    (select id from r9), (select tgt_case from cs)),
  '42501', null, 'R4: a non-coordinator cannot link a related case (42501)');
reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table link1 on commit drop as
  select * from public.link_referral_related_case(
    (select id from r9), (select tgt_case from cs), 'related_case');
reset role;
grant select on link1 to authenticated;
select is((select relationship_type from link1), 'related_case', 'R4: link stores the relationship type');
select is((select commission_id from link1), (select comm_x from k),
  'R4: the link is attributed to the acting (source) coordinator''s side');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.link_referral_related_case(%L, %L, 'bogus_rel') $$,
    (select id from r9), (select tgt_case from cs)),
  'HC0A8', null, 'R4: an invalid relationship type is rejected (HC0A8)');
select throws_ok(
  format($$ select public.link_referral_related_case(%L, %L, 'related_case') $$,
    (select id from r9), gen_random_uuid()),
  'HC0A8', null, 'R4: a non-existent related case is rejected (HC0A8)');
select throws_ok(
  format($$ select public.link_referral_related_case(%L, %L, 'related_case') $$,
    (select id from r9), (select tgt_case from cs)),
  'HC0A8', null, 'R4: a duplicate (referral, case, relationship) link is rejected (HC0A8)');
reset role;
-- The TARGET coordinator can also link (either side).
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.link_referral_related_case(%L, %L, 'follow_up_case') $$,
    (select id from r9), (select tgt_case from cs)),
  'R4: the target coordinator can also link a related case (either side)');
reset role;

-- ---- K-R4-2: a referral_case_link grants NO access to the linked case ----
-- st_x is a plain member of A (source) → reads r9 metadata (non-vacuity), but has
-- NO case ACL on case B — the link from r9 to case B does NOT let st_x read it.
select ok(app.can_read_referral_metadata((select id from r9), (select st_x from k)),
  'R4·K-R4-2 (non-vacuity): st_x CAN read the referral metadata');
select ok(not app.can_read_case((select tgt_case from cs), (select st_x from k)),
  'R4·K-R4-2: the referral_case_link grants st_x NO read of the linked case B');

-- ---- K-R4-1: an assignment row grants NO referral read ----
-- A stranger (no membership/coordinator/analyst/QPS anywhere) with an assignment
-- row on r9 is still DENIED by can_read_referral_metadata AND can_read_referral_phi.
create temp table strg on commit drop as select gen_random_uuid() as uid;
grant select on strg to authenticated;
-- The on_auth_user_created trigger auto-creates the matching profiles row (FK
-- target); no profile update is needed (the tenant-org check is deferred to COMMIT,
-- which never runs — this suite rolls back).
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', (select uid from strg),
        'authenticated', 'authenticated', (select uid from strg) || '@test', now(), now());
-- Direct insert (as the test owner — bypasses RLS/grants) so we isolate exactly the
-- "assignment exists but no access" condition.
insert into public.referral_assignments (referral_id, commission_id, assignee_user_id, assignment_role, status)
values ((select id from r9), (select comm_x from k), (select uid from strg), 'primary_reviewer', 'pending');
select is((select count(*)::int from public.referral_assignments
           where referral_id = (select id from r9) and assignee_user_id = (select uid from strg)),
  1, 'R4·K-R4-1 (non-vacuity): the stranger DOES have an assignment row on r9');
select ok(not app.can_read_referral_metadata((select id from r9), (select uid from strg)),
  'R4·K-R4-1: an assignment row grants the stranger NO referral METADATA read');
select ok(not app.can_read_referral_phi((select id from r9), (select uid from strg)),
  'R4·K-R4-1: an assignment row grants the stranger NO referral PHI read');

-- ---- K-R4-4: list_my_referral_assignments is self-scoped + PHI-free ----
-- st_x2 holds asg1 (source reviewer). The list returns ONLY st_x2's assignment;
-- st_y's asg2 (target) is absent; and no PHI key leaks (task pointers only).
select test_helpers.claims_for((select st_x2 from k4), false);
set local role authenticated;
create temp table mylist on commit drop as
  select public.list_my_referral_assignments() as j;
reset role;
grant select on mylist to authenticated;
select is((select jsonb_array_length(mylist.j) from mylist), 1,
  'R4·K-R4-4: the caller sees exactly their own assignment (1)');
select is((select mylist.j->0->>'id' from mylist), (select id from asg1)::text,
  'R4·K-R4-4: the returned assignment is the caller''s own (asg1)');
select ok((select not (mylist.j @> jsonb_build_array(jsonb_build_object('id', (select id from asg2)))) from mylist),
  'R4·K-R4-4: another user''s assignment (asg2) is absent from the caller''s list');
select ok((select not (mylist.j->0 ? 'referral_description_md') and not (mylist.j->0 ? 'summary_md') from mylist),
  'R4·K-R4-4: the list carries NO PHI keys (task pointers only)');
select is((select mylist.j->0->>'referral_code' from mylist), (select code from r9),
  'R4·K-R4-4: the list carries the PHI-free referral code pointer');

-- ---- get_referral_detail exposes the PHI-free assignments + links arrays ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table det_r9 on commit drop as
  select public.get_referral_detail((select id from r9)) as j;
reset role;
grant select on det_r9 to authenticated;
-- 3 rows: asg1 (st_x2) + asg2 (st_y, cancelled) + the K-R4-1 stranger row inserted
-- directly above. All are metadata-visible (an assignment row grants no access, but
-- IS visible to a metadata-tier reader of the referral).
select is((select jsonb_array_length(det_r9.j->'assignments') from det_r9), 3,
  'R4: the detail door exposes all assignment rows (metadata-visible)');
select is((select jsonb_array_length(det_r9.j->'links') from det_r9), 2,
  'R4: the detail door exposes both typed case-links');

-- =========================================================================
-- RV2 R5 — Private internal notes, read receipts & redaction (ADR 0037 D-R5).
--   * K-R5-1 (THE security keystone): an internal note is readable ONLY by a
--     member of its OWNING committee side — source↔target NEVER cross, QPS reads
--     NEITHER (no QPS arm on can_read_referral_internal_note).
--   * K-R5-2: the note body is column-REVOKED from authenticated (door-only).
--   * K-R5-3: redaction is append-only + renders [redigido] (row not deleted).
--   * K-R5-4: redact authority is checked FIRST → 42501, never HC0A9 (non-vacuity).
--   * K-R5-5: a receipt is self-scoped (user_id = auth.uid(), never forgeable).
-- =========================================================================

-- ---- Fixture: a SENT + in_review referral (r10) with a note on EACH side ----
create temp table cs6 on commit drop as select gen_random_uuid() as src6;
grant select on cs6 to authenticated;
insert into public.cases (id, commission_id, case_number, label, created_by)
values ((select src6 from cs6), (select comm_x from k), 9501, 'Caso A6', (select sa_x from k));

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table r10 on commit drop as
  select * from public.create_referral_draft(
    (select src6 from cs6), (select comm_y from k),
    (select type_parecer from voc), 'Notas internas R5', true,
    'Descrição para viabilizar o envio.');
select public.send_referral((select id from r10));
reset role;
grant select on r10 to authenticated;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select public.receive_referral((select id from r10));
select public.accept_referral((select id from r10));
select public.start_referral_review((select id from r10));
reset role;
select is((select status from public.case_referral where id = (select id from r10)),
  'in_review', 'R5 fixture: r10 reaches in_review (target-side notes become readable)');

-- ---- create_referral_internal_note authority (42501 FIRST) + domain (HC0A9) ----
-- A QPS operator (admin — member of NEITHER committee) cannot author a note.
select test_helpers.claims_for((select admin from k), true);
set local role authenticated;
select throws_ok(
  format($$ select public.create_referral_internal_note(%L, %L, 'nota do QPS') $$,
    (select id from r10), (select comm_x from k)),
  '42501', null,
  'R5: a QPS operator (member of neither side) cannot author an internal note (42501)');
reset role;
-- A member of the WRONG side (st_y, target) cannot author on the SOURCE side.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_referral_internal_note(%L, %L, 'nota do lado errado') $$,
    (select id from r10), (select comm_x from k)),
  '42501', null,
  'R5: a member of the other side cannot author on the source side (42501)');
reset role;
-- A valid owning-side member with a BLANK body → HC0A9 (domain AFTER authority).
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.create_referral_internal_note(%L, %L, '   ') $$,
    (select id from r10), (select comm_x from k)),
  'HC0A9', null,
  'R5: a blank internal-note body is rejected (HC0A9, checked after authority)');
-- Happy: the SOURCE coordinator authors a source-side note.
create temp table note_src on commit drop as
  select * from public.create_referral_internal_note(
    (select id from r10), (select comm_x from k), 'CORPO-NOTA-ORIGEM');
reset role;
grant select on note_src to authenticated;
select is((select committee_id from note_src), (select comm_x from k),
  'R5: a source-side note is owned by the source committee');
-- The TARGET coordinator authors a target-side note.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
create temp table note_tgt on commit drop as
  select * from public.create_referral_internal_note(
    (select id from r10), (select comm_y from k), 'CORPO-NOTA-DESTINO');
reset role;
grant select on note_tgt to authenticated;
select is((select committee_id from note_tgt), (select comm_y from k),
  'R5: a target-side note is owned by the target committee');

-- ---- K-R5-1: source ≠ target ≠ QPS (THE security keystone) ----
-- Owning-side reads OK.
select ok(app.can_read_referral_internal_note((select id from note_src), (select sa_x from k)),
  'R5·K-R5-1: the owning SOURCE coordinator reads their source note (OK)');
select ok(app.can_read_referral_internal_note((select id from note_src), (select st_x from k)),
  'R5·K-R5-1 (non-vacuity): a plain SOURCE member reads the source note (membership suffices)');
select ok(app.can_read_referral_internal_note((select id from note_tgt), (select sa_y from k)),
  'R5·K-R5-1: the owning TARGET coordinator reads their target note (OK)');
-- Cross-side reads DENIED.
select ok(not app.can_read_referral_internal_note((select id from note_tgt), (select sa_x from k)),
  'R5·K-R5-1: a SOURCE member is DENIED the TARGET-owned note (cross-side)');
select ok(not app.can_read_referral_internal_note((select id from note_src), (select sa_y from k)),
  'R5·K-R5-1: a TARGET member is DENIED the SOURCE-owned note (cross-side)');
-- QPS reads NEITHER — with non-vacuity that QPS genuinely reads the referral metadata.
select ok(app.can_read_referral_metadata((select id from r10), (select admin from k)),
  'R5·K-R5-1 (non-vacuity): the QPS operator CAN read the referral metadata');
select ok(not app.can_read_referral_internal_note((select id from note_src), (select admin from k)),
  'R5·K-R5-1: the QPS operator is DENIED the SOURCE note (no QPS arm)');
select ok(not app.can_read_referral_internal_note((select id from note_tgt), (select admin from k)),
  'R5·K-R5-1: the QPS operator is DENIED the TARGET note (no QPS arm)');

-- ---- K-R5-2: the note body is column-REVOKED (door-only) ----
select ok(not has_column_privilege('authenticated', 'public.referral_internal_notes', 'body_md', 'SELECT'),
  'R5·K-R5-2: authenticated has NO direct SELECT on referral_internal_notes.body_md');
select ok(has_column_privilege('authenticated', 'public.referral_internal_notes', 'committee_id', 'SELECT'),
  'R5·K-R5-2 (non-vacuity): the PHI-free columns ARE selectable');

-- ---- list_referral_internal_notes: door renders the body; side-scoped ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table notes_src on commit drop as
  select public.list_referral_internal_notes((select id from r10)) as j;
reset role;
grant select on notes_src to authenticated;
select is((select jsonb_array_length(notes_src.j) from notes_src), 1,
  'R5·K-R5-1: the source coordinator''s note list carries ONLY the source note (1)');
select is((select notes_src.j->0->>'body_md' from notes_src), 'CORPO-NOTA-ORIGEM',
  'R5: the audited door serves the (non-redacted) note body to the owning side');

-- ---- K-R5-4: redact authority is checked FIRST (42501, not HC0A9) ----
-- st_y is a plain TARGET member (NOT coordinator); note_tgt is valid + non-redacted,
-- so if authority were dropped the redact would proceed — the ONLY failure is authority.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.redact_referral_note(%L, 'motivo') $$, (select id from note_tgt)),
  '42501', null,
  'R5·K-R5-4: a plain owning-side member redacting a note is denied 42501 (authority, not HC0A9)');
reset role;

-- ---- K-R5-3: redaction is append-only + renders [redigido] ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.redact_referral_note(%L, 'contém dados sensíveis') $$, (select id from note_src)),
  'R5·K-R5-3: the source coordinator redacts the source note');
-- A second redaction is rejected (append-only).
select throws_ok(
  format($$ select public.redact_referral_note(%L, 'de novo') $$, (select id from note_src)),
  'HC0A9', null,
  'R5·K-R5-3: a second redaction of the same note is rejected (HC0A9)');
-- The door now renders [redigido] to the owning side; the row is NOT deleted.
create temp table notes_src2 on commit drop as
  select public.list_referral_internal_notes((select id from r10)) as j;
reset role;
grant select on notes_src2 to authenticated;
select is((select notes_src2.j->0->>'body_md' from notes_src2), '[redigido]',
  'R5·K-R5-3: a redacted note renders [redigido] via the door (even to the owning side)');
select is((select count(*)::int from public.referral_internal_notes where id = (select id from note_src)),
  1, 'R5·K-R5-3: the redacted row is NOT deleted (append-only)');
select ok((select redacted_by from public.referral_internal_notes where id = (select id from note_src)) = (select sa_x from k),
  'R5·K-R5-3: redacted_by records the coordinator');
select is((select redacted_reason from public.referral_internal_notes where id = (select id from note_src)),
  'contém dados sensíveis', 'R5·K-R5-3: redacted_reason is recorded');
-- The real body STAYS in the table (append-only; distinct from disposal's purge).
select is((select body_md from public.referral_internal_notes where id = (select id from note_src)),
  'CORPO-NOTA-ORIGEM', 'R5·K-R5-3: the real body is retained server-side (audited who/why)');

-- ---- Message redaction: authority (42501) + append-only ([redigido]) ----
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table msg1 on commit drop as
  select * from public.post_referral_message((select id from r10), 'general', 'MENSAGEM-ORIGINAL');
reset role;
grant select on msg1 to authenticated;
-- A plain member (non-coordinator) cannot redact a message.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  format($$ select public.redact_referral_message(%L, 'motivo') $$, (select id from msg1)),
  '42501', null,
  'R5: a non-coordinator cannot redact a thread message (42501)');
reset role;
-- A coordinator of either side redacts it; a second redaction is rejected.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.redact_referral_message(%L, 'contém PHI') $$, (select id from msg1)),
  'R5: a coordinator redacts a thread message');
select throws_ok(
  format($$ select public.redact_referral_message(%L, 'de novo') $$, (select id from msg1)),
  'HC0A9', null,
  'R5: a second message redaction is rejected (HC0A9)');
create temp table det_r10 on commit drop as
  select public.get_referral_detail((select id from r10)) as j;
reset role;
grant select on det_r10 to authenticated;
select is((select det_r10.j->'messages'->0->>'body' from det_r10), '[redigido]',
  'R5: the detail door renders a redacted message body as [redigido]');
select is((select body from public.referral_messages where id = (select id from msg1)),
  'MENSAGEM-ORIGINAL', 'R5: the redacted message''s real body is retained server-side');

-- ---- K-R5-5: read receipts are self-scoped (never forgeable) ----
-- st_y (a target member = metadata reader) records their OWN receipt on msg1.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;
select lives_ok(
  format($$ select public.record_referral_message_receipt(%L, 'read') $$, (select id from msg1)),
  'R5·K-R5-5: a metadata-tier reader records their own receipt');
-- An invalid event is rejected (HC0A9).
select throws_ok(
  format($$ select public.record_referral_message_receipt(%L, 'bogus') $$, (select id from msg1)),
  'HC0A9', null,
  'R5: an invalid receipt event is rejected (HC0A9)');
reset role;
-- The receipt is keyed to st_y — and to NO other user (self-scope).
select is((select count(*)::int from public.referral_read_receipts where message_id = (select id from msg1)),
  1, 'R5·K-R5-5: exactly one receipt row exists for the message');
select ok((select user_id from public.referral_read_receipts where message_id = (select id from msg1)) = (select st_y from k),
  'R5·K-R5-5: the receipt is keyed to the caller (st_y) — never forgeable');
select ok((select read_at from public.referral_read_receipts
           where message_id = (select id from msg1) and user_id = (select st_y from k)) is not null,
  'R5·K-R5-5: the read_at timestamp was recorded');
-- A non-reader (the R4 stranger — no membership on r10) cannot record a receipt.
select test_helpers.claims_for((select uid from strg), false);
set local role authenticated;
select throws_ok(
  format($$ select public.record_referral_message_receipt(%L, 'read') $$, (select id from msg1)),
  '42501', null,
  'R5·K-R5-5: a non-reader of the referral cannot record a receipt (42501)');
reset role;
-- The detail door exposes the PHI-free read_receipts array.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
create temp table det_r10b on commit drop as
  select public.get_referral_detail((select id from r10)) as j;
reset role;
grant select on det_r10b to authenticated;
select is((select jsonb_array_length(det_r10b.j->'read_receipts') from det_r10b), 1,
  'R5: the detail door exposes the PHI-free read_receipts array');

-- ---- Rule 11: list_referral_internal_notes AUDITS internal-note reads --------
-- QA MAJOR-1. The PHI note body is served ONLY through this DEFINER door, so the
-- door must emit `referral.note_viewed` (PHI-free: referral_id + note_count; WHO =
-- actor_id column) whenever it serves ≥1 note — and NOTHING when it serves 0.
--   (a) an authorized note read emits EXACTLY ONE PHI-free note_viewed row.
--   (b) a cross-side / unauthorized reader (0 notes) emits ZERO note_viewed rows.
-- MUTATION-PROOF: delete the log_audit_access call in list_referral_internal_notes
-- → assertion (a) delta flips 1→0 and goes RED; restore → green.

-- (a) sa_y (target coordinator) reads note_tgt (never redacted) → 1 note served.
create temp table nv_base on commit drop as
  select count(*)::int as c from public.audit_log
   where action = 'referral.note_viewed' and entity_id = (select id from r10);
grant select on nv_base to authenticated;

select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select public.list_referral_internal_notes((select id from r10));
reset role;

select is(
  (select count(*)::int from public.audit_log
     where action = 'referral.note_viewed' and entity_id = (select id from r10))
    - (select c from nv_base),
  1,
  'R5·Rule11(a): an authorized internal-note read emits EXACTLY ONE referral.note_viewed row');

create temp table nv_row on commit drop as
  select metadata, summary, actor_id
  from public.audit_log
  where action = 'referral.note_viewed' and entity_id = (select id from r10)
  order by seq desc limit 1;
grant select on nv_row to authenticated;

select ok(
  (select metadata ? 'referral_id' and metadata ? 'note_count' from nv_row)
  and (select (metadata->>'referral_id') = (select id from r10)::text from nv_row)
  and (select (metadata->>'note_count')::int >= 1 from nv_row)
  and (select metadata::text not like '%CORPO-NOTA%' from nv_row)
  and (select summary not like '%CORPO-NOTA%' from nv_row),
  'R5·Rule11(a): the note_viewed payload is PHI-FREE (referral_id + note_count; no body)');

select ok((select actor_id from nv_row) = (select sa_y from k),
  'R5·Rule11(a): the note_viewed audit records WHO read (actor_id = caller)');

-- (b) the R4 stranger (member of NEITHER side) is served 0 notes → NO audit row.
create temp table nv_base2 on commit drop as
  select count(*)::int as c from public.audit_log
   where action = 'referral.note_viewed' and entity_id = (select id from r10);
grant select on nv_base2 to authenticated;

select test_helpers.claims_for((select uid from strg), false);
set local role authenticated;
create temp table notes_none on commit drop as
  select public.list_referral_internal_notes((select id from r10)) as j;
reset role;
grant select on notes_none to authenticated;

select is((select jsonb_array_length(notes_none.j) from notes_none), 0,
  'R5·Rule11(b): a stranger (member of neither side) is served 0 internal notes');
select is(
  (select count(*)::int from public.audit_log
     where action = 'referral.note_viewed' and entity_id = (select id from r10))
    - (select c from nv_base2),
  0,
  'R5·Rule11(b): a 0-note read emits ZERO referral.note_viewed rows (no PHI read → no audit)');

select * from finish();
rollback;
