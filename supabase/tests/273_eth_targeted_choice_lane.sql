-- ETH·E2 (ADR 0073 §D13) — the targeted respondent can actually fill the form.
--
-- OUT-OF-PHASE, ruled in by the PO during FF-2's gate. These are the CHOICE
-- lane's tables and FF-1's instance tables, not FF-2's — hence its own file, so
-- the diff and the attribution stay honest.
--
-- Every assertion asserts a ROUND TRIP, never a write alone. That is the lesson
-- from FF-2's §O3: B-1's own "the write succeeds" assertion was green while the
-- feature was still broken, because the respondent could not READ what they had
-- written. A keystone that stops at the write cannot see half the door.
--
-- Each arm is mutation-proven SEPARATELY (see the note above each), because
-- reverting one policy while the keystone reads through another proves nothing —
-- FF-2's M2 stayed green for exactly that reason.

begin;

select plan(17);

update app.feature_flags set enabled = true where key in ('ethics', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'st_y')::uuid   as st_y,
         (v->>'comm_x')::uuid as comm_x,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

select ok(app.feature_enabled('repeating_groups'),
  '0a. flag repeating_groups is ON — §C7-C9 depend on it');

-- ---------------------------------------------------------------------------
-- Fixture: a published form with a CHOICE item and a repeating group whose child
-- is also a choice item, on an ethics case phase, targeted at st_y.
-- ---------------------------------------------------------------------------
insert into public.forms (id, commission_id, title, created_by)
  values ('ee200000-0000-0000-0000-000000000001', (select comm_x from k), 'ETH alvo', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('ee200000-0000-0000-0000-000000000002', 'ee200000-0000-0000-0000-000000000001', 1, 'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
  values ('ee200000-0000-0000-0000-000000000003', 'ee200000-0000-0000-0000-000000000002', 0, true);

insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ee200000-0000-0000-0000-000000000010', 'ee200000-0000-0000-0000-000000000003', 0, 'multiple_choice', 'eth_escolha', 'Escolha');
insert into public.form_item_options (item_id, position, code, label) values
  ('ee200000-0000-0000-0000-000000000010', 0, 'sim', 'Sim'),
  ('ee200000-0000-0000-0000-000000000010', 1, 'nao', 'Não');

insert into public.form_items (id, section_id, position, item_type, label)
  values ('ee200000-0000-0000-0000-000000000011', 'ee200000-0000-0000-0000-000000000003', 1, 'repeating_group', 'Blocos');
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id)
  values ('ee200000-0000-0000-0000-000000000012', 'ee200000-0000-0000-0000-000000000003', 2, 'multiple_choice', 'eth_bloco', 'Escolha do bloco', 'ee200000-0000-0000-0000-000000000011');
insert into public.form_item_options (item_id, position, code, label) values
  ('ee200000-0000-0000-0000-000000000012', 0, 'a', 'A'),
  ('ee200000-0000-0000-0000-000000000012', 1, 'b', 'B');

select public.publish_form_version('ee200000-0000-0000-0000-000000000002');

insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, confidentiality_level)
  values ('ee200000-0000-0000-0000-0000000000a1', (select comm_x from k), 93101, (select sa_x from k),
          'explicit_grants_only', 'ethics_investigation');
insert into public.ethics_case_details (case_id) values ('ee200000-0000-0000-0000-0000000000a1');
insert into public.case_phases (id, case_id, position, form_id, form_version_id)
  values ('ee200000-0000-0000-0000-0000000000a2', 'ee200000-0000-0000-0000-0000000000a1', 1,
          'ee200000-0000-0000-0000-000000000001', 'ee200000-0000-0000-0000-000000000002');

insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
  values ('ee200000-0000-0000-0000-0000000000a3', (select org_x from k), 'respondent_eth',
          'Respondente', array['professional'], true);
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
  values ('ee200000-0000-0000-0000-0000000000a4', (select org_x from k), 'professional', 'professional_identity', 'Dr. Alvo');
insert into public.professional_profiles (id, organization_id, user_id, full_name, link_state)
  values ('ee200000-0000-0000-0000-0000000000a5', (select org_x from k), (select st_y from k), 'Dr. Alvo', 'linked');
insert into public.professional_participants (participant_id, professional_profile_id)
  values ('ee200000-0000-0000-0000-0000000000a4', 'ee200000-0000-0000-0000-0000000000a5');
insert into public.case_participants (id, case_id, participant_id, role_id)
  values ('ee200000-0000-0000-0000-0000000000a6', 'ee200000-0000-0000-0000-0000000000a1',
          'ee200000-0000-0000-0000-0000000000a4', 'ee200000-0000-0000-0000-0000000000a3');

insert into public.responses (id, form_version_id, commission_id, created_by, status, case_phase_id)
  values ('ee200000-0000-0000-0000-0000000000a7', 'ee200000-0000-0000-0000-000000000002',
          (select comm_x from k), (select sa_x from k), 'in_progress', 'ee200000-0000-0000-0000-0000000000a2');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.target_case_response('ee200000-0000-0000-0000-0000000000a7', 'ee200000-0000-0000-0000-0000000000a6');
reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- Everything below runs as the TARGETED RESPONDENT: not the creator (that is the
-- coordinator sa_x), not a member of the commission, not an admin.
-- ===========================================================================
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;

-- C1 is the CONTROL. Without it, C2 failing could mean the targeting fixture is
-- wrong rather than the options policy being absent.
select is(
  (select count(*)::int from public.form_items
   where form_version_id = 'ee200000-0000-0000-0000-000000000002'),
  3, 'C1. CONTROL — the targeted respondent reads the form ITEMS (form_items_select_targeted)');

-- MUTATION: drop form_item_options_select_targeted -> C2 red (2 -> 0).
select is(
  (select string_agg(o.code, ',' order by o.position)
   from public.form_item_options o
   where o.item_id = 'ee200000-0000-0000-0000-000000000010'),
  'sim,nao',
  'C2. …and the OPTIONS of a choice question — without these the input renders empty');

-- MUTATION: drop answer_selected_options_write_targeted -> C3 still "succeeds"
--   (save_section_answers does not raise) but C4 goes red — which is why the
--   ROUND TRIP is the assertion and the write alone is not.
select lives_ok(
  $$select public.save_section_answers(
      'ee200000-0000-0000-0000-0000000000a7', 'ee200000-0000-0000-0000-000000000003',
      p_selections => '{"ee200000-0000-0000-0000-000000000010":["sim"]}'::jsonb)$$,
  'C3. …saves a selection through the normal fill RPC');

-- MUTATION: drop answer_selected_options_select_targeted -> C4 red (NULL).
select is(
  (select o.code
   from public.answer_selected_options s
   join public.answers a on a.id = s.answer_id
   join public.form_item_options o on o.id = s.option_id
   where a.response_id = 'ee200000-0000-0000-0000-0000000000a7'
     and a.item_id = 'ee200000-0000-0000-0000-000000000010'),
  'sim',
  'C4. …and READS IT BACK — the round trip, not the write');

-- The DELETE half of the FOR ALL write policy. save_section_answers implements
-- REPLACE as delete-then-insert: without DELETE the old row is silently filtered,
-- the insert adds a second, and a single-select item ends up with TWO selections.
-- An INSERT-only widening would have turned a fail-closed defect into a
-- data-corrupting one.
-- MUTATION: narrow answer_selected_options_write_targeted to FOR INSERT -> C6 red (2).
select lives_ok(
  $$select public.save_section_answers(
      'ee200000-0000-0000-0000-0000000000a7', 'ee200000-0000-0000-0000-000000000003',
      p_selections => '{"ee200000-0000-0000-0000-000000000010":["nao"]}'::jsonb)$$,
  'C5. re-answering the same choice item succeeds');

select is(
  (select string_agg(o.code, ',')
   from public.answer_selected_options s
   join public.answers a on a.id = s.answer_id
   join public.form_item_options o on o.id = s.option_id
   where a.response_id = 'ee200000-0000-0000-0000-0000000000a7'
     and a.item_id = 'ee200000-0000-0000-0000-000000000010'),
  'nao',
  'C6. …and the item holds EXACTLY ONE selection — REPLACE really replaced');

-- ---- the repeating-group half (found by sweeping past the reported finding) ----
-- MUTATION: revert the union in app.assert_group_writable to the creator-only
--   test -> C7 red with HC0N2. Policy alone is NOT enough: the RPC has its own
--   gate, which is why this is asserted through the RPC and not by inserting.
select lives_ok(
  $$select public.add_group_instance(
      'ee200000-0000-0000-0000-0000000000a7', 'ee200000-0000-0000-0000-000000000011')$$,
  'C7. the targeted respondent can ADD a repeating-group instance (RPC gate + policy agree)');

-- MUTATION: drop response_group_instances_select_targeted -> C8 red (1 -> 0).
select is(
  (select count(*)::int from public.response_group_instances
   where response_id = 'ee200000-0000-0000-0000-0000000000a7'),
  1, 'C8. …and READS it back');

-- MUTATION: drop response_group_instances_write_targeted -> C7 red (the RPC''s
--   own INSERT is filtered by RLS even though its gate now passes).
select lives_ok(
  $$select public.save_section_answers(
      'ee200000-0000-0000-0000-0000000000a7', 'ee200000-0000-0000-0000-000000000003',
      p_instance_answers => (
        select jsonb_build_array(jsonb_build_object(
          'instance_id', gi.id,
          'selections', jsonb_build_object('ee200000-0000-0000-0000-000000000012', jsonb_build_array('a'))))
        from public.response_group_instances gi
        where gi.response_id = 'ee200000-0000-0000-0000-0000000000a7'))$$,
  'C9. …and saves a selection INSIDE that instance');

select is(
  (select o.code
   from public.answer_selected_options s
   join public.answers a on a.id = s.answer_id
   join public.form_item_options o on o.id = s.option_id
   where a.response_id = 'ee200000-0000-0000-0000-0000000000a7'
     and a.item_id = 'ee200000-0000-0000-0000-000000000012'
     and a.group_instance_id is not null),
  'a',
  'C10. …and reads THAT back too — the instance round trip');

-- ---- the POST-SUBMIT read: what the dedicated SELECT policy is actually for ----
-- Found by mutation A2 staying GREEN. `answer_selected_options_write_targeted`
-- is FOR ALL, and a FOR ALL policy's USING clause grants SELECT too — so while
-- the response is in_progress it already covers C4/C6/C10 and dropping the
-- dedicated SELECT policy changed nothing. The keystone was proving the write
-- policy twice.
--
-- The dedicated policy is NOT redundant: `can_write_targeted_response` is
-- `can_access_targeted_response AND status = 'in_progress'`, so the FOR ALL read
-- grant DIES at submit, while `answers_select_targeted` (status-free) keeps the
-- scalar answers readable. Without the dedicated policy a targeted respondent
-- would submit and instantly lose sight of every choice they had made, while
-- still seeing their text answers — the same split-brain shape as the corrector
-- reading answers-but-not-cells.
--   MUTATION: drop answer_selected_options_select_targeted -> C12 red.
select lives_ok(
  $$select public.submit_response('ee200000-0000-0000-0000-0000000000a7')$$,
  'C11. the targeted respondent SUBMITS the response');

select is(
  (select o.code
   from public.answer_selected_options s
   join public.answers a on a.id = s.answer_id
   join public.form_item_options o on o.id = s.option_id
   where a.response_id = 'ee200000-0000-0000-0000-0000000000a7'
     and a.item_id = 'ee200000-0000-0000-0000-000000000010'),
  'nao',
  'C12. …and STILL reads the selection back after submit — parity with answers_select_targeted');

-- The same FOR-ALL shadow, one table over: mutation A5 also stayed green because
-- response_group_instances_write_targeted (FOR ALL) covers the in_progress read
-- that C8 performs. The dedicated SELECT policy is what keeps the instances
-- visible AFTER submit — without it a targeted respondent's repeating-group rows
-- vanish from their own submitted response.
--   MUTATION: drop response_group_instances_select_targeted -> C13 red.
select is(
  (select count(*)::int from public.response_group_instances
   where response_id = 'ee200000-0000-0000-0000-0000000000a7'),
  1, 'C13. …and still sees its repeating-group instance after submit');

reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- The NEGATIVES. Widening is only safe if it is bounded: st_x2 is an ordinary
-- member of the commission, neither the creator nor the target.
--   MUTATION: replace can_access_targeted_version's predicate with `true` -> N1 red.
-- ===========================================================================
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;

select is(
  (select count(*)::int from public.answer_selected_options s
   join public.answers a on a.id = s.answer_id
   where a.response_id = 'ee200000-0000-0000-0000-0000000000a7'),
  0, 'N1. a NON-targeted ordinary member reads ZERO of the targeted response''s selections');

select is(
  (select count(*)::int from public.response_group_instances
   where response_id = 'ee200000-0000-0000-0000-0000000000a7'),
  0, 'N2. …and ZERO of its repeating-group instances');

select throws_ok(
  $$select public.add_group_instance(
      'ee200000-0000-0000-0000-0000000000a7', 'ee200000-0000-0000-0000-000000000011')$$,
  'P0002', null,
  'N3. …and cannot add one (the response is not even visible — no existence leak)');

reset role;
select set_config('request.jwt.claims', null, true);

select * from finish();
rollback;
