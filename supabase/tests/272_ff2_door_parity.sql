-- FF-2 — QA r1 remediation: the matrix doors match the authorization surface
-- beside them, and the two coverage gaps `qa` proved are closed.
--
-- A SEPARATE FILE from 271 on purpose. These sections need heavy fixtures 271
-- does not have (an ethics case with a targeted response; a case phase with a
-- correction request), and §Q needs a REQUIRED matrix inside a repeating group —
-- which cannot be added to 271's group without breaking §K, whose two instances
-- deliberately fill one row each.
--
-- Every section here is mutation-proven; the comment above each names the exact
-- revert that turns it red.
--
--   §O — B-1: a TARGETED respondent can save a matrix cell (and read it back).
--   §P — B-2: a designated CORRECTOR reads the predecessor's grids.
--   §Q — M-1: ruling 3's PER-INSTANCE half (a required matrix in a repeating group).
--   §R — M-2: `start_correction_draft`'s matrix copy blocks (the other of the two
--             RPCs ADR 0089 §B names; §K covers `supersede_response` only).
--   §S — FF-3: the TARGETED respondent READS `form_item_validations` ROWS. Added
--             here rather than in 274 because this is the only fixture with a real
--             targeted response — and because 274 §C can only assert the POLICY
--             EXISTS, which ETH·E1 established is not the same claim.

begin;

select plan(30);

update app.feature_flags set enabled = true where key in ('ethics', 'audit_trail');

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'st_y')::uuid   as st_y,
         (v->>'sa_y')::uuid   as sa_y,
         (v->>'comm_x')::uuid as comm_x,
         app.org_of_commission((v->>'comm_x')::uuid) as org_x
  from ctx;
grant select on k to authenticated;

-- ===========================================================================
-- §0 · flags asserted, never forced (the pgtap-fixture-flag-gaps scar).
-- ===========================================================================
select ok(app.feature_enabled('matrix_fields'),
  '0a. flag matrix_fields is ON — every section here depends on it');
select ok(app.feature_enabled('case_corrections'),
  '0b. flag case_corrections is ON — §P/§R drive the correction RPCs');

-- ---------------------------------------------------------------------------
-- Fixture (owner): one published form carrying every matrix shape the sections
-- need. Section 0 holds the gate; section 1 holds the matrices, so every item
-- condition references a question in an EARLIER section and validate_visible_when
-- is satisfied under any reading of its ordering rule.
-- ---------------------------------------------------------------------------
insert into public.forms (id, commission_id, title, created_by)
  values ('dd200000-0000-0000-0000-000000000001', (select comm_x from k), 'FF2 paridade', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('dd200000-0000-0000-0000-000000000002', 'dd200000-0000-0000-0000-000000000001', 1, 'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
  values ('dd200000-0000-0000-0000-000000000003', 'dd200000-0000-0000-0000-000000000002', 0, true);
insert into public.form_sections (id, form_version_id, position, title)
  values ('dd200000-0000-0000-0000-000000000004', 'dd200000-0000-0000-0000-000000000002', 1, 'Matrizes');

-- sec 0 / 0 — the gate, and §O's SCALAR CONTROL. Load-bearing: it is what makes
-- "the same user, same RPC, same transaction saves a scalar and is refused a
-- cell" observable rather than inferred.
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('dd200000-0000-0000-0000-000000000010', 'dd200000-0000-0000-0000-000000000003', 0, 'short_text', 'dp_gate', 'Porta');

-- sec 1 / 0 — a top-level matrix (§P reads it as the corrector).
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('dd200000-0000-0000-0000-000000000011', 'dd200000-0000-0000-0000-000000000004', 0, 'matrix', 'dp_matriz', 'Matriz');
insert into public.form_matrix_rows (item_id, form_version_id, position, code, label) values
  ('dd200000-0000-0000-0000-000000000011', 'dd200000-0000-0000-0000-000000000002', 0, 'dr1', 'L1'),
  ('dd200000-0000-0000-0000-000000000011', 'dd200000-0000-0000-0000-000000000002', 1, 'dr2', 'L2');
insert into public.form_matrix_columns (item_id, form_version_id, position, code, label) values
  ('dd200000-0000-0000-0000-000000000011', 'dd200000-0000-0000-0000-000000000002', 0, 'dc_ok', 'OK'),
  ('dd200000-0000-0000-0000-000000000011', 'dd200000-0000-0000-0000-000000000002', 1, 'dc_no', 'NOK');

-- sec 1 / 1 — a risk matrix (§P reads it too).
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('dd200000-0000-0000-0000-000000000012', 'dd200000-0000-0000-0000-000000000004', 1, 'risk_matrix', 'dp_risco', 'Risco');
insert into public.form_matrix_rows (item_id, form_version_id, position, code, label, weight) values
  ('dd200000-0000-0000-0000-000000000012', 'dd200000-0000-0000-0000-000000000002', 0, 'hi', 'Alta', 9),
  ('dd200000-0000-0000-0000-000000000012', 'dd200000-0000-0000-0000-000000000002', 1, 'lo', 'Baixa', 3);
insert into public.form_matrix_columns (item_id, form_version_id, position, code, label, weight) values
  ('dd200000-0000-0000-0000-000000000012', 'dd200000-0000-0000-0000-000000000002', 0, 'fq', 'Frequente', 3),
  ('dd200000-0000-0000-0000-000000000012', 'dd200000-0000-0000-0000-000000000002', 1, 'rr', 'Raro', 1);

-- sec 1 / 2,3 — a repeating group whose matrix child is REQUIRED. This is the
-- shape M-1 found uncovered: 271's group child is NOT required, so its
-- per-instance loop never evaluates a required matrix.
insert into public.form_items (id, section_id, position, item_type, label)
  values ('dd200000-0000-0000-0000-000000000013', 'dd200000-0000-0000-0000-000000000004', 2, 'repeating_group', 'Blocos');
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id, required)
  values ('dd200000-0000-0000-0000-000000000014', 'dd200000-0000-0000-0000-000000000004', 3, 'matrix', 'dp_matriz_inst', 'Matriz do bloco', 'dd200000-0000-0000-0000-000000000013', true);
insert into public.form_matrix_rows (item_id, form_version_id, position, code, label) values
  ('dd200000-0000-0000-0000-000000000014', 'dd200000-0000-0000-0000-000000000002', 0, 'ir1', 'A'),
  ('dd200000-0000-0000-0000-000000000014', 'dd200000-0000-0000-0000-000000000002', 1, 'ir2', 'B');
insert into public.form_matrix_columns (item_id, form_version_id, position, code, label) values
  ('dd200000-0000-0000-0000-000000000014', 'dd200000-0000-0000-0000-000000000002', 0, 'ic_a', 'A'),
  ('dd200000-0000-0000-0000-000000000014', 'dd200000-0000-0000-0000-000000000002', 1, 'ic_b', 'B');

-- sec 1 / 4,5 — a HIDDEN repeating group with a REQUIRED matrix child: the
-- deadlock-negative arm M-1 says is missing (§G covers hidden item / hidden PLAIN
-- group / hidden section, never a hidden REPEATING group).
insert into public.form_items (id, section_id, position, item_type, label, visible_when)
  values ('dd200000-0000-0000-0000-000000000015', 'dd200000-0000-0000-0000-000000000004', 4, 'repeating_group', 'Ocultos',
          '{"question_key":"dp_gate","op":"equals","value":"sim"}'::jsonb);
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id, required)
  values ('dd200000-0000-0000-0000-000000000016', 'dd200000-0000-0000-0000-000000000004', 5, 'matrix', 'dp_matriz_oculta', 'Matriz oculta', 'dd200000-0000-0000-0000-000000000015', true);
insert into public.form_matrix_rows (item_id, form_version_id, position, code, label)
  values ('dd200000-0000-0000-0000-000000000016', 'dd200000-0000-0000-0000-000000000002', 0, 'hr1', 'H1');
insert into public.form_matrix_columns (item_id, form_version_id, position, code, label)
  values ('dd200000-0000-0000-0000-000000000016', 'dd200000-0000-0000-0000-000000000002', 0, 'hc1', 'HC1');

-- FF-3: one validation rule on the gate item, so §S has a row to read. Inserted
-- directly (the fixture runs as the owner); the coverage trigger still validates
-- the pair, so a wrong item_type here would fail loudly rather than silently.
insert into public.form_item_validations
  (item_id, form_version_id, position, rule_type, config, severity, message)
values
  ('dd200000-0000-0000-0000-000000000010', 'dd200000-0000-0000-0000-000000000002', 0,
   'text_length', '{"min":2}'::jsonb, 'error', 'Informe ao menos 2 caracteres.');

select public.publish_form_version('dd200000-0000-0000-0000-000000000002');

-- ===========================================================================
-- §O · B-1 — a TARGETED respondent can save a matrix answer.
--
--   `app.save_instance_answers` is INVOKER and inherits the targeted arm from
--   RLS for free; the DEFINER matrix writers reconstructed the `answers` write
--   rule in app.assert_matrix_answer_writable and dropped that arm. So the same
--   user, in the same RPC and the same transaction, saved a scalar and was
--   refused a cell — a functional dead end on ETH·E2's targeted-submission flow.
--
--   MUTATION: delete the `if app.can_write_targeted_response(...) then return;`
--     block from app.assert_matrix_answer_writable -> O2/O3 go red with 42501.
--   MUTATION: drop the can_access_targeted_response arm from
--     answer_matrix_cells_select -> O3 alone goes red (written, then unreadable).
-- ===========================================================================
insert into public.cases (id, commission_id, case_number, created_by, visibility_policy, confidentiality_level)
  values ('dd200000-0000-0000-0000-0000000000a1', (select comm_x from k), 92901, (select sa_x from k),
          'explicit_grants_only', 'ethics_investigation');
insert into public.ethics_case_details (case_id) values ('dd200000-0000-0000-0000-0000000000a1');
insert into public.case_phases (id, case_id, position, form_id, form_version_id)
  values ('dd200000-0000-0000-0000-0000000000a2', 'dd200000-0000-0000-0000-0000000000a1', 1,
          'dd200000-0000-0000-0000-000000000001', 'dd200000-0000-0000-0000-000000000002');

insert into public.case_participant_roles
  (id, organization_id, key, display_name, allowed_participant_types, is_primary_subject_candidate)
  values ('dd200000-0000-0000-0000-0000000000a3', (select org_x from k), 'respondent_dp',
          'Respondente', array['professional'], true);
insert into public.participants (id, organization_id, participant_type, sensitivity_class, display_name)
  values ('dd200000-0000-0000-0000-0000000000a4', (select org_x from k), 'professional', 'professional_identity', 'Dr. Alvo');
insert into public.professional_profiles (id, organization_id, user_id, full_name, link_state)
  values ('dd200000-0000-0000-0000-0000000000a5', (select org_x from k), (select st_y from k), 'Dr. Alvo', 'linked');
insert into public.professional_participants (participant_id, professional_profile_id)
  values ('dd200000-0000-0000-0000-0000000000a4', 'dd200000-0000-0000-0000-0000000000a5');
insert into public.case_participants (id, case_id, participant_id, role_id)
  values ('dd200000-0000-0000-0000-0000000000a6', 'dd200000-0000-0000-0000-0000000000a1',
          'dd200000-0000-0000-0000-0000000000a4', 'dd200000-0000-0000-0000-0000000000a3');

-- The coordinator creates the response and targets it at the respondent.
insert into public.responses (id, form_version_id, commission_id, created_by, status, case_phase_id)
  values ('dd200000-0000-0000-0000-0000000000a7', 'dd200000-0000-0000-0000-000000000002',
          (select comm_x from k), (select sa_x from k), 'in_progress', 'dd200000-0000-0000-0000-0000000000a2');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.target_case_response('dd200000-0000-0000-0000-0000000000a7', 'dd200000-0000-0000-0000-0000000000a6');
reset role;
select set_config('request.jwt.claims', null, true);

-- Everything below is as the TARGETED RESPONDENT — not the creator, not an
-- admin, not a staff_admin.
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;

-- O1 is the CONTROL. Without it, O2 failing could mean the fixture is wrong
-- rather than the door being narrow.
select lives_ok(
  $$select public.save_section_answers(
      'dd200000-0000-0000-0000-0000000000a7', 'dd200000-0000-0000-0000-000000000003',
      p_answers => '{"dd200000-0000-0000-0000-000000000010":"sim"}'::jsonb)$$,
  'O1. CONTROL — the targeted respondent saves a SCALAR answer (the RLS arm fires)');

select lives_ok(
  $$select public.save_section_answers(
      'dd200000-0000-0000-0000-0000000000a7', 'dd200000-0000-0000-0000-000000000004',
      p_matrix_cells => '{"dd200000-0000-0000-0000-000000000011":{"dr1":"dc_ok"}}'::jsonb)$$,
  'O2. SUBJECT — …and a MATRIX cell through the same RPC (the DEFINER door has the same arm)');

-- The round trip, not just the write: a cell the respondent cannot read back is
-- a grid the wizard redraws empty on the next navigation.
-- Reads BOTH axis tables on purpose: the fix widened form_matrix_rows_select AND
-- form_matrix_columns_select, so a keystone touching only one of them can be
-- reverted by half and stay green (it was — the first mutation run proved the
-- assertion, not the fix).
select is(
  (select r.code || '->' || col.code
   from public.answer_matrix_cells c
   join public.answers a on a.id = c.answer_id
   join public.form_matrix_rows r on r.id = c.row_id
   join public.form_matrix_columns col on col.id = c.col_id
   where a.response_id = 'dd200000-0000-0000-0000-0000000000a7'),
  'dr1->dc_ok',
  'O3. …and READS IT BACK, through BOTH axis tables — the targeted arm reaches the grid definition too');

reset role;
select set_config('request.jwt.claims', null, true);

-- The negative. Widening a door is only safe if the widening is bounded: st_x2 is
-- an ordinary member, neither creator nor target.
-- MUTATION: replace the ARM-1 ownership test with `true` -> O4 goes green when it
--   must be red.
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;
-- The code is P0002, not 42501: the `responses` SELECT policy hides a foreign
-- case-phase response outright, so save_section_answers' own lookup returns
-- nothing and it never reaches the writer's gate. That is the STRONGER outcome
-- (no existence leak), and asserting the code that actually fires is the point —
-- expecting 42501 here would only pass if RLS had let the row through. Same
-- reasoning as FF-1's J2.
select throws_ok(
  $$select public.save_section_answers(
      'dd200000-0000-0000-0000-0000000000a7', 'dd200000-0000-0000-0000-000000000004',
      p_matrix_cells => '{"dd200000-0000-0000-0000-000000000011":{"dr2":"dc_no"}}'::jsonb)$$,
  'P0002', null,
  'O4. a NON-targeted non-creator cannot even SEE the response (no existence leak; the widening is bounded)');

-- …and the gate itself still refuses them when reached directly, so O4 is not
-- resting on the responses policy alone.
-- MUTATION: replace ARM-1's ownership test with `true` -> O5 goes green when it
--   must be red.
select throws_ok(
  $$select app.assert_matrix_answer_writable('dd200000-0000-0000-0000-0000000000a7')$$,
  '42501', null,
  'O5. …and the DEFINER gate refuses them directly with 42501 (the widening is bounded)');
reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §S · FF-3 (ADR 0090 §6) — the TARGETED respondent reads VALIDATION ROWS.
--
--   274 §C asserts the two new policy arms EXIST, against pg_policies. That is
--   what the ADR asks for, and it is NOT the same claim as "the persona reads the
--   rows": ETH·E1 produced three RLS leak shapes each invisible to the method
--   that found the last, and its standing lesson is to assert ROWS READ under
--   `set local role`, never a predicate's return value. So this section reads.
--
--   `st_y` is a member of commission Y ONLY, so the base member/admin arm cannot
--   help them here — every row they see comes from
--   `form_item_validations_select_targeted`.
--
--   MUTATION: drop policy form_item_validations_select_targeted -> S2 red while
--     S1 stays green, which is what proves S2 tests the NEW arm and not the
--     fixture.
-- ===========================================================================
select test_helpers.claims_for((select st_y from k), false);
set local role authenticated;

-- S1 is the CONTROL: form_item_options has carried the targeted arm since FF-2.
-- Without it, S2 failing could mean the targeting fixture is broken.
select cmp_ok(
  (select count(*)::int from public.form_item_options o
   join public.form_items i on i.id = o.item_id
   where i.form_version_id = 'dd200000-0000-0000-0000-000000000002'),
  '>=', 0,
  'S1. CONTROL — the targeted respondent can query the version''s option rows at all');

select is(
  (select count(*)::int from public.form_item_validations v
   where v.form_version_id = 'dd200000-0000-0000-0000-000000000002'),
  1,
  'S2. …and READS the version''s validation rules — via the targeted arm alone (member of Y only)');

reset role;
select set_config('request.jwt.claims', null, true);

-- The negative: widening a read door is only safe if the widening is bounded.
-- sa_y is a staff_admin of commission Y, NOT targeted at this response.
-- MUTATION: replace the targeted policy's USING with `true` -> S3 red.
select test_helpers.claims_for((select sa_y from k), false);
set local role authenticated;
select is(
  (select count(*)::int from public.form_item_validations v
   where v.form_version_id = 'dd200000-0000-0000-0000-000000000002'),
  0,
  'S3. a NON-targeted outsider reads ZERO validation rules (the widening is bounded)');
reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §Q · M-1 — ruling 3's PER-INSTANCE half.
--
--   ADR 0089 ruling 3 is explicit that the matrix arm lands in BOTH loops. 271
--   §L5-L7 call app.item_required_satisfied DIRECTLY with an instance id, which
--   proves the PREDICATE, not the loop that dispatches to it — so reverting the
--   per-instance arm of app.response_required_complete AND of submit_response
--   left 271/270/209/51 fully green.
--
--   MUTATION (performed; reverting BOTH per-instance arms to the pre-FF-2 inlined
--     value/selection test): **Q3 and Q4 go red**, and the file aborts there.
--     NOT Q1/Q2 — and that asymmetry is the finding, not a gap in the keystone.
--     The reverted test reports a matrix as unanswered ALWAYS (a matrix has no
--     answers.value and no selections), so the "blocks when incomplete"
--     direction still passes, for the wrong reason. Only the POSITIVE direction
--     can see the defect: the grid is complete and the form still refuses —
--     `qa`'s "permanently unsubmittable form that no test would report".
--     A keystone written only in the blocking direction would have been vacuous
--     here, which is precisely how this gap survived.
-- ===========================================================================
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;

insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ('dd200000-0000-0000-0000-0000000000b1', 'dd200000-0000-0000-0000-000000000002',
          (select comm_x from k), (select st_x from k), 'in_progress');
insert into public.response_group_instances (id, response_id, group_item_id, position)
  values ('dd200000-0000-0000-0000-0000000000b2', 'dd200000-0000-0000-0000-0000000000b1',
          'dd200000-0000-0000-0000-000000000013', 0);

-- 1 of the 2 rows: the instance is NON-EMPTY (so it is not pruned) but its
-- required grid is INCOMPLETE.
select public.save_section_answers(
  'dd200000-0000-0000-0000-0000000000b1', 'dd200000-0000-0000-0000-000000000004',
  p_instance_answers => '[{"instance_id":"dd200000-0000-0000-0000-0000000000b2",
                           "matrix_cells":{"dd200000-0000-0000-0000-000000000014":{"ir1":"ic_a"}}}]'::jsonb);

select ok(
  not app.response_required_complete('dd200000-0000-0000-0000-0000000000b1'),
  'Q1. response_required_complete sees an INCOMPLETE required matrix inside a repeating-group instance');

select throws_ok(
  $$select public.submit_response('dd200000-0000-0000-0000-0000000000b1')$$,
  'HC011', null,
  'Q2. …and submit_response refuses it — the per-instance arm is wired in the AUTHORITY too');

select public.save_section_answers(
  'dd200000-0000-0000-0000-0000000000b1', 'dd200000-0000-0000-0000-000000000004',
  p_instance_answers => '[{"instance_id":"dd200000-0000-0000-0000-0000000000b2",
                           "matrix_cells":{"dd200000-0000-0000-0000-000000000014":{"ir1":"ic_a","ir2":"ic_b"}}}]'::jsonb);

select ok(
  app.response_required_complete('dd200000-0000-0000-0000-0000000000b1'),
  'Q3. completing the instance grid satisfies the per-instance loop');

select lives_ok(
  $$select public.submit_response('dd200000-0000-0000-0000-0000000000b1')$$,
  'Q4. …and submit succeeds (the fix is not merely "always blocks")');

select is(
  (select count(*)::int from public.response_group_instances
   where response_id = 'dd200000-0000-0000-0000-0000000000b1'),
  1, 'Q5. the instance survived submit (instance_is_empty counts its matrix)');

-- The deadlock-negative arm §G never covered: a required matrix inside a HIDDEN
-- REPEATING group. The gate is unanswered on this response, so `Ocultos` is
-- hidden — and Q4 already passed, which is the proof. Q6 pins that the hidden
-- item really is required, so Q4 is not passing because it is inert.
select is(
  (select count(*)::int from public.form_items
   where id = 'dd200000-0000-0000-0000-000000000016' and required = true),
  1, 'Q6. ANTI-VACUITY: the hidden repeating group''s matrix child really is required=true');

reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §P + §R · B-2 and M-2, on one fixture.
--
--   A case phase whose submitted response carries a top-level grid, a risk
--   answer and TWO instance grids with DIFFERENT values; a correction request
--   naming st_x2 — an ordinary member who is neither the creator, nor a
--   commission admin, nor a staff_admin — as the permitted corrector.
--
--   §P (B-2): that corrector must READ the predecessor's grids. Before the fix
--     they read every text answer and every choice selection and saw every grid
--     empty — FUP-FF2-1's blank grid on the one surface a correction is compared
--     against.
--   §R (M-2): `start_correction_draft` must COPY those grids onto the successor's
--     own instances. §K covers `supersede_response` only; deleting both matrix
--     copy blocks from this RPC left 264 and 271 green.
-- ===========================================================================
insert into public.cases (id, commission_id, case_number, created_by)
  values ('dd200000-0000-0000-0000-0000000000c1', (select comm_x from k), 92902, (select sa_x from k));
-- The permitted corrector must be a commission member WITH case access
-- (file_correction_request enforces both). st_x2 is an ordinary staff member of
-- comm_x — deliberately NOT the creator, NOT a commission admin and NOT a
-- staff_admin — so §P proves the correction arm and nothing broader.
select test_helpers.grant_ca('dd200000-0000-0000-0000-0000000000c1', (select st_x2 from k), 'read', (select sa_x from k));

insert into public.case_phases (id, case_id, position, form_id, form_version_id, assigned_to, status)
  values ('dd200000-0000-0000-0000-0000000000c2', 'dd200000-0000-0000-0000-0000000000c1', 1,
          'dd200000-0000-0000-0000-000000000001', 'dd200000-0000-0000-0000-000000000002',
          (select st_x from k), 'active');

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;

insert into public.responses (id, form_version_id, commission_id, created_by, status, case_phase_id)
  values ('dd200000-0000-0000-0000-0000000000c3', 'dd200000-0000-0000-0000-000000000002',
          (select comm_x from k), (select st_x from k), 'in_progress', 'dd200000-0000-0000-0000-0000000000c2');
insert into public.response_group_instances (id, response_id, group_item_id, position) values
  ('dd200000-0000-0000-0000-0000000000c4', 'dd200000-0000-0000-0000-0000000000c3', 'dd200000-0000-0000-0000-000000000013', 0),
  ('dd200000-0000-0000-0000-0000000000c5', 'dd200000-0000-0000-0000-0000000000c3', 'dd200000-0000-0000-0000-000000000013', 1);

select public.save_section_answers(
  'dd200000-0000-0000-0000-0000000000c3', 'dd200000-0000-0000-0000-000000000004',
  p_matrix_cells => '{"dd200000-0000-0000-0000-000000000011":{"dr1":"dc_ok","dr2":"dc_no"}}'::jsonb,
  p_risk_matrix  => '{"dd200000-0000-0000-0000-000000000012":{"severity":"hi","likelihood":"fq"}}'::jsonb,
  p_instance_answers => '[
     {"instance_id":"dd200000-0000-0000-0000-0000000000c4",
      "matrix_cells":{"dd200000-0000-0000-0000-000000000014":{"ir1":"ic_a","ir2":"ic_a"}}},
     {"instance_id":"dd200000-0000-0000-0000-0000000000c5",
      "matrix_cells":{"dd200000-0000-0000-0000-000000000014":{"ir1":"ic_b","ir2":"ic_b"}}}]'::jsonb);
select public.submit_response('dd200000-0000-0000-0000-0000000000c3');

reset role;
select set_config('request.jwt.claims', null, true);
-- No manual pointer update: `submit_response`'s case-phase sync completes the
-- phase and sets current_response_id itself, and the case-phase guard refuses a
-- direct write ("case phase changes must go through the case RPCs") — which is
-- the behaviour to respect, not work around.
select is(
  (select current_response_id from public.case_phases
   where id = 'dd200000-0000-0000-0000-0000000000c2'),
  'dd200000-0000-0000-0000-0000000000c3'::uuid,
  'P0. the phase pointer was set by submit_response''s sync (fixture built through the real path)');

-- The coordinator files the request, naming st_x2 as the corrector.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;
select public.file_correction_request(
  'correction', 'dd200000-0000-0000-0000-0000000000c2', null, 'motivo', 'clerical', (select st_x2 from k));
reset role;
select set_config('request.jwt.claims', null, true);

create temp table req on commit drop as
  select id from public.case_correction_requests
  where case_phase_id = 'dd200000-0000-0000-0000-0000000000c2';
grant select on req to authenticated;

-- ---- §P (B-2): the corrector READS the predecessor's grids ----
-- MUTATION: drop the can_read_correction_response arm from
--   answer_matrix_cells_select -> P2 goes red (4 -> 0); from
--   answer_risk_matrix_select -> P3 goes red (1 -> 0).
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;

-- P1 is the control: the arm exists and fires for `answers`, so P2/P3 failing is
-- about the matrix policies and not about the fixture.
select cmp_ok(
  (select count(*)::int from public.answers where response_id = 'dd200000-0000-0000-0000-0000000000c3'),
  '>', 0,
  'P1. CONTROL — the corrector reads the predecessor''s answers rows');

select is(
  (select count(*)::int from public.answer_matrix_cells c
   join public.answers a on a.id = c.answer_id
   where a.response_id = 'dd200000-0000-0000-0000-0000000000c3'),
  6, 'P2. …and all SIX of its matrix cells (2 top-level + 2 per instance) — parity with answer_selected_options');

select is(
  (select count(*)::int from public.answer_risk_matrix rm
   join public.answers a on a.id = rm.answer_id
   where a.response_id = 'dd200000-0000-0000-0000-0000000000c3'),
  1, 'P3. …and its risk answer');

-- ---- §R (M-2): start_correction_draft copies them ----
-- MUTATION: delete the answer_matrix_cells copy block from
--   start_correction_draft -> R2/R3/R4 go red; delete the answer_risk_matrix
--   block -> R5 goes red.
create temp table draft on commit drop as
  select public.start_correction_draft((select id from req)) as id;
grant select on draft to authenticated;

select ok(
  not exists (
    select 1 from public.response_group_instances n
    join public.response_group_instances o on o.id = n.id
    where n.response_id = (select id from draft)
      and o.response_id = 'dd200000-0000-0000-0000-0000000000c3'),
  'R1. the successor''s instance ids are DISJOINT from the predecessor''s (Amendment 1.3)');

select is(
  (select string_agg(r.code || '->' || col.code, ',' order by r.position)
   from public.answer_matrix_cells c
   join public.answers a on a.id = c.answer_id
   join public.form_matrix_rows r on r.id = c.row_id
   join public.form_matrix_columns col on col.id = c.col_id
   where a.response_id = (select id from draft) and a.group_instance_id is null),
  'dr1->dc_ok,dr2->dc_no',
  'R2. the TOP-LEVEL grid is copied BY VALUE into the correction draft');

select is(
  (select string_agg(r.code || '->' || col.code, ',' order by r.position)
   from public.answer_matrix_cells c
   join public.answers a on a.id = c.answer_id
   join public.response_group_instances gi on gi.id = a.group_instance_id
   join public.form_matrix_rows r on r.id = c.row_id
   join public.form_matrix_columns col on col.id = c.col_id
   where a.response_id = (select id from draft) and gi.position = 0),
  'ir1->ic_a,ir2->ic_a',
  'R3. instance at POSITION 0 carries its own counterpart''s cells');

select is(
  (select string_agg(r.code || '->' || col.code, ',' order by r.position)
   from public.answer_matrix_cells c
   join public.answers a on a.id = c.answer_id
   join public.response_group_instances gi on gi.id = a.group_instance_id
   join public.form_matrix_rows r on r.id = c.row_id
   join public.form_matrix_columns col on col.id = c.col_id
   where a.response_id = (select id from draft) and gi.position = 1),
  'ir1->ic_b,ir2->ic_b',
  'R4. …and position 1 carries ITS OWN, different cells (no cross-instance mix-up)');

select is(
  (select rm.risk_score::text || ':' || r.code || ':' || col.code
   from public.answer_risk_matrix rm
   join public.answers a on a.id = rm.answer_id
   join public.form_matrix_rows r on r.id = rm.severity_row_id
   join public.form_matrix_columns col on col.id = rm.likelihood_col_id
   where a.response_id = (select id from draft)),
  '27:hi:fq',
  'R5. the risk answer survives with risk_score copied VERBATIM');

select is(
  (select count(*)::int from public.answer_matrix_cells c
   join public.answers a on a.id = c.answer_id
   where a.response_id = 'dd200000-0000-0000-0000-0000000000c3'),
  6, 'R6. the PREDECESSOR keeps its own cells (a correction copies, never moves)');

reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §S · K9 re-proved AFTER the B-2 policy widening. Widening a SELECT policy
--   cannot create a write path — but a phase that has now touched these policies
--   twice should say so with an assertion, not an argument.
--   MUTATION: `grant insert on public.answer_matrix_cells to authenticated` -> red.
-- ===========================================================================
select ok(not has_table_privilege('authenticated', 'public.answer_matrix_cells', 'INSERT'),
  'S1. answer_matrix_cells still has NO INSERT grant for authenticated (K9)');
select ok(not has_table_privilege('authenticated', 'public.answer_risk_matrix', 'INSERT'),
  'S2. answer_risk_matrix still has NO INSERT grant for authenticated (K9)');
select ok(not has_table_privilege('authenticated', 'public.answer_matrix_cells', 'UPDATE'),
  'S3. …nor UPDATE');
select ok(not has_table_privilege('authenticated', 'public.answer_risk_matrix', 'DELETE'),
  'S4. …nor DELETE');

select * from finish();
rollback;
