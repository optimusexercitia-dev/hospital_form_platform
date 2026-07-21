-- =============================================================================
-- Controlled-Document Redesign (ADR 0081) — B0/B1/B2 + §4 producers.
-- Complements 200_controlled_documents.sql (the base lifecycle guards). Uses the
-- same test_helpers.bootstrap() fixture (org_b / hosp_b; commissions X + Y; sa_y is
-- a same-hospital-but-outside-X entitled approver). Feature flags controlled_docs +
-- notifications are enabled so the producers fire.
--
-- Asserts:
--   * B0 anglicization NEG/POS — old pt-BR doc_type key rejected, English accepted;
--     decision CHECK rejects 'rejeitado', a full lifecycle drives to effective with
--     the English 'approved' key on every approval row.
--   * B1 category/tags set via create + ride the member-read RLS (a non-member,
--     non-approver same-hospital user still sees nothing — new columns don't leak).
--   * B2 obsolete_kind — publish stamps the retired prior 'superseded';
--     mark_document_obsolete stamps 'retired'.
--   * B2 proposed_effective_date defaulting — publish with no p_effective_date takes
--     the version's proposed date.
--   * §4 notifications — submit enqueues document_approval/requested per approver;
--     the review-due scan enqueues document_review_due/overdue to the staff_admin.
--   * §4 remind_document_approver — staff_admin authority (non-staff_admin → 42501),
--     REVOKE-FROM-PUBLIC (anon has no EXECUTE; authenticated does).
-- =============================================================================

begin;
select plan(29);

update app.feature_flags set enabled = true where key = 'controlled_docs';
update app.feature_flags set enabled = true where key = 'notifications';

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'admin')::uuid  as admin,
         (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'sa_y')::uuid    as sa_y,
         (v->>'st_y')::uuid    as st_y,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'comm_y')::uuid  as comm_y
  from ctx;
grant select on k to authenticated;

-- ===========================================================================
-- B0 · doc_type anglicization NEG/POS (at create)
-- ===========================================================================
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));

-- POS: create with the English key + category + tags.
create temp table doc_a on commit drop as
  select * from public.create_controlled_document(
    (select comm_x from k), 'Política A', 'policy', 12,
    'Higiene', array['epi', 'mao']);
grant select on doc_a to authenticated;

-- NEG: the old pt-BR key is now rejected by the CHECK.
select throws_ok(
  format($$ select public.create_controlled_document(%L, 'Política Velha', 'politica', 12) $$,
    (select comm_x from k)),
  '23514', null,
  'B0: old pt-BR doc_type key ''politica'' is rejected (23514)');

reset role;

select is((select doc_type from doc_a), 'policy', 'B0: create accepts the English doc_type key ''policy''');
select is((select category from doc_a), 'Higiene', 'B1: category is persisted by create');
select is((select tags from doc_a), array['epi', 'mao'], 'B1: tags are persisted by create');

-- ===========================================================================
-- B1 · new columns ride the existing RLS (no leak)
-- ===========================================================================
set local role authenticated;
select test_helpers.claims_for((select st_x from k));
select is(
  (select count(*)::int from public.controlled_documents where id = (select id from doc_a)),
  1, 'B1 RLS: an in-commission member reads the document (with its new columns)');
reset role;

set local role authenticated;
select test_helpers.claims_for((select st_y from k));
select is(
  (select count(*)::int from public.controlled_documents where id = (select id from doc_a)),
  0, 'B1 RLS: a same-hospital non-member/non-approver reads NOTHING (columns don''t leak)');
reset role;

-- ===========================================================================
-- Build the lifecycle: attach file → submit (proposed + approval dates) → approve → publish
-- ===========================================================================
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));

select public.set_document_version_file(
  (select current_version_id from doc_a),
  (select comm_x from k) || '/' || (select id from doc_a) || '/a.pdf',
  'v1', null);

-- submit with proposed_effective_date + approval_due_date, naming st_x + sa_y.
select public.submit_document_for_approval(
  (select current_version_id from doc_a),
  jsonb_build_array(
    jsonb_build_object('approver_id', (select st_x from k)::text),
    jsonb_build_object('approver_id', (select sa_y from k)::text)),
  date '2030-06-01',   -- proposed effective date
  date '2030-01-15');  -- approval due date
reset role;

-- §4: submit enqueued one document_approval/requested per approver → sign page.
select is(
  (select count(*)::int from public.notifications
   where entity_type = 'controlled_document_version'
     and entity_id = (select current_version_id from doc_a)
     and kind = 'document_approval' and milestone = 'requested'
     and user_id = (select st_x from k)),
  1, '§4: submit enqueues document_approval/requested for approver st_x');
select is(
  (select count(*)::int from public.notifications
   where entity_type = 'controlled_document_version'
     and entity_id = (select current_version_id from doc_a)
     and kind = 'document_approval' and milestone = 'requested'
     and user_id = (select sa_y from k)),
  1, '§4: submit enqueues document_approval/requested for approver sa_y');

-- B2: proposed_effective_date + approval_due_date persisted on the version.
select is(
  (select proposed_effective_date from public.controlled_document_versions
   where id = (select current_version_id from doc_a)),
  date '2030-06-01', 'B2: submit persists proposed_effective_date');
select is(
  (select approval_due_date from public.controlled_document_versions
   where id = (select current_version_id from doc_a)),
  date '2030-01-15', 'B2: submit persists approval_due_date (O2)');

-- Both approvers sign 'approved'.
set local role authenticated;
select test_helpers.claims_for((select st_x from k));
select public.approve_document((select current_version_id from doc_a), null);
reset role;
set local role authenticated;
select test_helpers.claims_for((select sa_y from k));
select public.approve_document((select current_version_id from doc_a), null);
reset role;

-- POS decision key: every approval row is 'approved'.
select is(
  (select count(*)::int from public.document_approvals
   where document_version_id = (select current_version_id from doc_a)
     and decision = 'approved'),
  2, 'B0: both approvals carry the English decision key ''approved''');

-- NEG decision key: a direct write of the old key is rejected by the CHECK.
select throws_ok(
  format($$ update public.document_approvals set decision = 'rejeitado'
            where document_version_id = %L and approver_id = %L $$,
    (select current_version_id from doc_a), (select st_x from k)),
  '23514', null,
  'B0: the old pt-BR decision key ''rejeitado'' is rejected (23514)');

-- Publish with NO p_effective_date → defaults from proposed_effective_date.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select public.publish_document((select current_version_id from doc_a), null, null, null);
reset role;

select is(
  (select status from public.controlled_documents where id = (select id from doc_a)),
  'effective', 'full lifecycle drives the document to effective (English keys)');
select is(
  (select effective_date from public.controlled_document_versions
   where id = (select current_version_id from doc_a)),
  date '2030-06-01', 'B2: publish defaults effective_date from proposed_effective_date');

-- ===========================================================================
-- B2 · obsolete_kind = superseded (publish over prior) vs retired (mark obsolete)
-- ===========================================================================
create temp table ver1 on commit drop as
  select (select current_version_id from doc_a) as id;
grant select on ver1 to authenticated;

set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
-- supersede → v2, attach, submit (st_x), approve, publish → v1 superseded.
create temp table doc_a_v2 on commit drop as
  select * from public.supersede_document((select id from doc_a));
grant select on doc_a_v2 to authenticated;
select public.set_document_version_file(
  (select id from doc_a_v2),
  (select comm_x from k) || '/' || (select id from doc_a) || '/a2.pdf', 'v2', null);
select public.submit_document_for_approval(
  (select id from doc_a_v2),
  jsonb_build_array(jsonb_build_object('approver_id', (select st_x from k)::text)),
  null, null);
reset role;
set local role authenticated;
select test_helpers.claims_for((select st_x from k));
select public.approve_document((select id from doc_a_v2), null);
reset role;
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
-- publish v2 with a PAST review_due so the review-due scan later fires.
select public.publish_document((select id from doc_a_v2), null, current_date - 1, null);
reset role;

select is(
  (select obsolete_kind from public.controlled_document_versions where id = (select id from ver1)),
  'superseded', 'B2: publish stamps the retired prior version obsolete_kind=''superseded''');
select is(
  (select status from public.controlled_document_versions where id = (select id from ver1)),
  'obsolete', 'B2: the superseded prior version is obsolete');

-- Second document → mark obsolete → 'retired'.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
create temp table doc_b on commit drop as
  select * from public.create_controlled_document((select comm_x from k), 'POP B', 'sop', null);
grant select on doc_b to authenticated;
select public.set_document_version_file(
  (select current_version_id from doc_b),
  (select comm_x from k) || '/' || (select id from doc_b) || '/b.pdf', 'v1', null);
select public.submit_document_for_approval(
  (select current_version_id from doc_b),
  jsonb_build_array(jsonb_build_object('approver_id', (select st_x from k)::text)),
  null, null);
reset role;
set local role authenticated;
select test_helpers.claims_for((select st_x from k));
select public.approve_document((select current_version_id from doc_b), null);
reset role;
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select public.publish_document((select current_version_id from doc_b), null, null, null);
select public.mark_document_obsolete((select id from doc_b));
reset role;

select is(
  (select obsolete_kind from public.controlled_document_versions
   where id = (select current_version_id from doc_b)),
  'retired', 'B2: mark_document_obsolete stamps obsolete_kind=''retired''');

-- ===========================================================================
-- §4 · review-due scan → staff_admin
-- ===========================================================================
select public.compute_due_notifications();  -- superuser (service-role path)

select is(
  (select count(*)::int from public.notifications
   where entity_type = 'controlled_document'
     and entity_id = (select id from doc_a)
     and kind = 'document_review_due' and milestone = 'overdue'
     and user_id = (select sa_x from k)),
  1, '§4: the review-due scan enqueues document_review_due/overdue to the staff_admin');

-- ===========================================================================
-- §4 · remind_document_approver — authority + REVOKE-FROM-PUBLIC
-- ===========================================================================
-- Build DOC C left in_approval with st_x pending.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
create temp table doc_c on commit drop as
  select * from public.create_controlled_document((select comm_x from k), 'Protocolo C', 'protocol', null);
grant select on doc_c to authenticated;
select public.set_document_version_file(
  (select current_version_id from doc_c),
  (select comm_x from k) || '/' || (select id from doc_c) || '/c.pdf', 'v1', null);
select public.submit_document_for_approval(
  (select current_version_id from doc_c),
  jsonb_build_array(jsonb_build_object('approver_id', (select st_x from k)::text)),
  null, null);

-- staff_admin sa_x may remind the pending approver (lives; returns boolean).
select lives_ok(
  format($$ select public.remind_document_approver(%L, %L) $$,
    (select current_version_id from doc_c), (select st_x from k)),
  '§4: a staff_admin can remind a pending approver');
reset role;

-- A non-staff_admin (st_x, plain member) is rejected 42501 (server-side authority).
set local role authenticated;
select test_helpers.claims_for((select st_x from k));
select throws_ok(
  format($$ select public.remind_document_approver(%L, %L) $$,
    (select current_version_id from doc_c), (select st_x from k)),
  '42501', null,
  '§4: a non-staff_admin cannot remind (authority enforced in the body, not the UI)');
reset role;

-- REVOKE-FROM-PUBLIC: anon (inherits PUBLIC) has no EXECUTE; authenticated does.
select ok(
  not has_function_privilege('anon', 'public.remind_document_approver(uuid,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.remind_document_approver(uuid,uuid)', 'EXECUTE'),
  '§4: remind_document_approver is REVOKEd from PUBLIC (anon no EXECUTE; authenticated yes)');

-- ===========================================================================
-- Wave 2.5a · description round-trip + register KPI/mini-bar fields + supersede-fail
-- ===========================================================================
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));

-- DOC D: create WITH a description; drive to effective; then supersede (open draft v2,
-- unpublished) so it is effective WITH an open revision.
create temp table doc_d on commit drop as
  select * from public.create_controlled_document(
    (select comm_x from k), 'Manual D', 'manual', 12, null, '{}'::text[], 'Descrição do Manual D');
grant select on doc_d to authenticated;
reset role;
select is((select description from doc_d), 'Descrição do Manual D',
  'Wave2.5a: create persists p_description (round-trip)');

set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select public.set_document_version_file((select current_version_id from doc_d),
  (select comm_x from k) || '/' || (select id from doc_d) || '/d.pdf', 'v1', null);
select public.submit_document_for_approval((select current_version_id from doc_d),
  jsonb_build_array(jsonb_build_object('approver_id', (select st_x from k)::text)), null, null);
reset role;
set local role authenticated;
select test_helpers.claims_for((select st_x from k));
select public.approve_document((select current_version_id from doc_d), null);
reset role;
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select public.publish_document((select current_version_id from doc_d), null, null, null);
select public.supersede_document((select id from doc_d));   -- open draft v2, unpublished
reset role;

-- list_commission_documents (as sa_x, a member): DB-side register facts.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select is(
  (select has_open_revision from public.list_commission_documents((select comm_x from k))
   where id = (select id from doc_d)),
  true, 'Wave2.5a: list.has_open_revision=true for an effective doc with an open draft');
select is(
  (select approvals_total_count from public.list_commission_documents((select comm_x from k))
   where id = (select id from doc_c)),
  1, 'Wave2.5a: list.approvals_total_count counts the in_approval version''s approvals');
select is(
  (select approvals_signed_count from public.list_commission_documents((select comm_x from k))
   where id = (select id from doc_c)),
  0, 'Wave2.5a: list.approvals_signed_count counts only ''approved'' decisions (0 pending)');
reset role;

-- DOC E: description overwrite on a draft + description-out-of-audit + supersede-fail.
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
create temp table doc_e on commit drop as
  select * from public.create_controlled_document(
    (select comm_x from k), 'Outro E', 'other', null, null, '{}'::text[], 'D1');
grant select on doc_e to authenticated;
select public.update_controlled_document(
  (select id from doc_e), 'Outro E', 'other', null, null, '{}'::text[], 'D2');
reset role;
select is(
  (select description from public.controlled_documents where id = (select id from doc_e)),
  'D2', 'Wave2.5a: update overwrites description (round-trip)');
select ok(
  exists (select 1 from public.audit_log
          where entity_id = (select id from doc_e) and action = 'document.updated'),
  'Wave2.5a: a description-only update still emits an audit row (mutation audited)');
select ok(
  not exists (select 1 from public.audit_log
             where entity_id = (select id from doc_e)
               and (metadata ? 'description' or metadata::text like '%D2%')),
  'Wave2.5a: description is NOT in the audit payload (metadata) — like title');

-- supersede on a NON-effective doc (DOC E is a draft) → HC089 (the partial-failure precondition).
set local role authenticated;
select test_helpers.claims_for((select sa_x from k));
select throws_ok(
  format($$ select public.supersede_document(%L) $$, (select id from doc_e)),
  'HC089', null,
  'Wave2.5a: supersede on a non-effective document is rejected (HC089)');
reset role;

select * from finish();
rollback;
