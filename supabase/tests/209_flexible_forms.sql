-- F3 (ADR 0060 / ADR 0065 / Program §3) — Flexible-Forms Foundation keystones.
--
-- The lock: this suite fails if the item_type enum stops accepting the five reserved
-- types (or stops rejecting garbage), if a `required` new-type item becomes insertable
-- (the Flag-5 completeness invariant), if any inert table gains an authenticated write
-- grant (write-inert) or loses its scoped-read grant/policy (K9), if repeating-group
-- position-uniqueness (incl. the NULLS NOT DISTINCT top-level case) regresses, or if
-- clone_form_version stops carrying behavior_config (Rule 5 / Flag 4).
--
-- The dual-evaluator operator parity (contains/not_contains/is_empty/is_not_empty) is
-- locked separately by the shared golden vectors in 20_conditions.sql (SQL side) and
-- src/lib/queries/conditions.test.ts (TS side) — Rule 3, phase-blocking on drift.

begin;
select plan(44);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid    as sa_x,
         (v->>'st_x')::uuid    as st_x,
         (v->>'comm_x')::uuid  as comm_x,
         (v->>'ver_u')::uuid   as ver_u,
         (v->>'item_mc')::uuid as item_mc
  from ctx;

-- ---------------------------------------------------------------------------
-- Fixtures (fixed uuids for the objects this suite creates).
-- ---------------------------------------------------------------------------
-- A draft form/version/section in comm_x to exercise the widened item_type CHECK
-- (a published version would trip guard_published_version).
insert into public.forms (id, commission_id, title, created_by)
  values ('aaaa0000-0000-0000-0000-000000000001', (select comm_x from k), 'F3 Draft', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('aaaa0000-0000-0000-0000-000000000002', 'aaaa0000-0000-0000-0000-000000000001', 1, 'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
  values ('aaaa0000-0000-0000-0000-000000000003', 'aaaa0000-0000-0000-0000-000000000002', 0, true);

-- A choice item + one option in the draft (E: option column defaults). form_version_id
-- is trigger-derived on both (bootstrap precedent — omitted here too).
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('aaaa0000-0000-0000-0000-000000000004', 'aaaa0000-0000-0000-0000-000000000003', 20, 'multiple_choice', 'c1', 'Escolha');
insert into public.form_item_options (item_id, position, code, label)
  values ('aaaa0000-0000-0000-0000-000000000004', 0, 'op1', 'Opção 1');

-- An in_progress response in comm_x against the published ver_u (D: instance uniqueness).
insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ('aaaa0000-0000-0000-0000-000000000005', (select ver_u from k), (select comm_x from k), (select st_x from k), 'in_progress');

-- A clean minimal published form carrying behavior_config, no lingering draft (F: clone).
insert into public.forms (id, commission_id, title, created_by)
  values ('aaaa0000-0000-0000-0000-000000000007', (select comm_x from k), 'BC', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status, behavior_config)
  values ('aaaa0000-0000-0000-0000-000000000008', 'aaaa0000-0000-0000-0000-000000000007', 1, 'draft', '{"probe":true}'::jsonb);
insert into public.form_sections (id, form_version_id, position, is_default)
  values ('aaaa0000-0000-0000-0000-00000000000a', 'aaaa0000-0000-0000-0000-000000000008', 0, true);
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('aaaa0000-0000-0000-0000-000000000009', 'aaaa0000-0000-0000-0000-00000000000a', 0, 'multiple_choice', 'bc1', 'Q');
insert into public.form_item_options (item_id, position, code, label)
  values ('aaaa0000-0000-0000-0000-000000000009', 0, 'sim', 'Sim'), ('aaaa0000-0000-0000-0000-000000000009', 1, 'nao', 'Não');
select public.publish_form_version('aaaa0000-0000-0000-0000-000000000008'::uuid);
create temp table cloned on commit drop as
  select public.clone_form_version('aaaa0000-0000-0000-0000-000000000008'::uuid) as new_ver;

-- ===========================================================================
-- A · item_type CHECK accepts the 5 reserved types, rejects garbage (both the
--     value enum AND the input-vs-display shape arms must admit them).
-- ===========================================================================
select lives_ok(
  $$ insert into public.form_items (section_id, position, item_type, label)
     values ('aaaa0000-0000-0000-0000-000000000003', 10, 'group', 'Grupo') $$,
  'A1: group container accepted (no question_key required)');
-- FF-1 RE-PIN (ADR 0087 / BE-1): a container now REQUIRES question_key IS NULL.
-- F3 admitted a container carrying a key; FF-1 forbids it, because a key would
-- put the container into every question_key-driven path (app.answer_map, the
-- dashboard explode, condition-target resolution, submit_response's item loop).
-- Pinning it to NULL makes containers invisible to all of them by construction.
-- The matching NEGATIVE ("a container may NOT carry a question_key") lives in
-- 270_ff1_repeating_groups.sql §B.
select lives_ok(
  $$ insert into public.form_items (section_id, position, item_type, label)
     values ('aaaa0000-0000-0000-0000-000000000003', 11, 'repeating_group', 'Grupo repetível') $$,
  'A2: repeating_group container accepted (question_key must be NULL — FF-1)');
select lives_ok(
  $$ insert into public.form_items (section_id, position, item_type, question_key, label)
     values ('aaaa0000-0000-0000-0000-000000000003', 12, 'matrix', 'mx1', 'Matriz') $$,
  'A3: matrix accepted (answerable arm)');
select lives_ok(
  $$ insert into public.form_items (section_id, position, item_type, question_key, label)
     values ('aaaa0000-0000-0000-0000-000000000003', 13, 'risk_matrix', 'rk1', 'Matriz de risco') $$,
  'A4: risk_matrix accepted (answerable arm)');
select lives_ok(
  $$ insert into public.form_items (section_id, position, item_type, question_key, label)
     values ('aaaa0000-0000-0000-0000-000000000003', 14, 'reference', 'rf1', 'Referência') $$,
  'A5: reference accepted (answerable arm)');
select throws_ok(
  $$ insert into public.form_items (section_id, position, item_type, question_key, label)
     values ('aaaa0000-0000-0000-0000-000000000003', 15, 'bogus', 'bg1', 'X') $$,
  '23514', null, 'A6: an unlisted item_type is still rejected (value enum + ELSE false)');

-- ===========================================================================
-- B · Flag-5 invariant BY CONSTRUCTION: a `required` new-type item cannot be
--     authored (it would deadlock app.response_required_complete — its answers
--     live in the F3 answer-shape tables, not answers.value).
--
--     ⚠ FF-2 (ADR 0089 ruling 3) RETIRED this pin for matrix/risk_matrix, and
--     FF-5 (ADR 0091 ruling 6) NOW RETIRES IT FOR `reference` TOO. The invariant
--     was never "these types may not be required" — it was "a type whose
--     required-ness NOTHING CHECKS may not be required". FF-5 gives `reference`
--     both missing arms (`app.item_required_satisfied`: at least one
--     `answer_references` row; and the matching `app.instance_is_empty` arm,
--     without which submit would prune a reference-only instance and cascade the
--     answer away), so the deadlock is gone for it as well.
--
--     B1c/B3c are therefore now POSITIVE assertions. They have not been deleted,
--     and that is the point: flipping them is the record that the freeze was
--     lifted DELIBERATELY and only after the arms landed. The freeze itself is
--     NOT retired — B2/B3a/B3b still pin every type that genuinely has no
--     completeness arm (the two containers and the two display types), so this
--     section still goes red if someone relaxes one of those.
--
--     The real enforcement of the reference arms moved to
--     276_ff5_references.sql §H, which drives them end to end (required blocks
--     submit; hidden+required never blocks; the per-instance arm) rather than
--     asserting a CHECK can be written.
-- ===========================================================================
select lives_ok(
  $$ insert into public.form_items (section_id, position, item_type, question_key, label, required)
     values ('aaaa0000-0000-0000-0000-000000000003', 16, 'matrix', 'mx2', 'M2', true) $$,
  'B1a: required=true matrix ACCEPTED (FF-2 relaxed the arm; row-complete now checks it)');
select lives_ok(
  $$ insert into public.form_items (section_id, position, item_type, question_key, label, required)
     values ('aaaa0000-0000-0000-0000-000000000003', 18, 'risk_matrix', 'rk2', 'R2', true) $$,
  'B1b: required=true risk_matrix ACCEPTED (FF-2)');
select lives_ok(
  $$ insert into public.form_items (section_id, position, item_type, question_key, label, required)
     values ('aaaa0000-0000-0000-0000-000000000003', 19, 'reference', 'rf2', 'F2', true) $$,
  'B1c: required=true reference ACCEPTED (FF-5 wired both completeness arms; see 276 §H)');
select throws_ok(
  $$ insert into public.form_items (section_id, position, item_type, label, required)
     values ('aaaa0000-0000-0000-0000-000000000003', 17, 'repeating_group', 'RG2', true) $$,
  '23514', null, 'B2: required=true repeating_group rejected by the shape CHECK (Flag-5)');

-- FF-3 (ADR 0090 ruling 4) EXTENDS this freeze to `required_if`. The reasoning is
-- the same one B1c rests on: a type whose required-ness nothing checks may not be
-- made required — and `required_if` is a second door to exactly that. Without
-- these arms an author could not set `required = true` on a container but could
-- give it a `required_if` that evaluates true, arriving at the same deadlock by a
-- different route.
--
-- B3d is the POSITIVE TWIN and is load-bearing: B3a/B3b/B3c would all pass if
-- `required_if` were rejected on EVERY item type (a CHECK typo, or the column
-- never being writable at all), which is a widening-shaped vacuity the negatives
-- alone cannot see.
select throws_ok(
  $$ insert into public.form_items (section_id, position, item_type, label, required_if)
     values ('aaaa0000-0000-0000-0000-000000000003', 20, 'repeating_group', 'RG3',
             '{"question_key":"q1","op":"equals","value":"x"}') $$,
  '23514', null, 'B3a: required_if on a CONTAINER rejected (FF-3 — the second door to the Flag-5 deadlock)');
select throws_ok(
  $$ insert into public.form_items (section_id, position, item_type, content, required_if)
     values ('aaaa0000-0000-0000-0000-000000000003', 21, 'section_text', '{"markdown":"oi"}',
             '{"question_key":"q1","op":"equals","value":"x"}') $$,
  '23514', null, 'B3b: required_if on a DISPLAY item rejected (FF-3)');
select lives_ok(
  $$ insert into public.form_items (section_id, position, item_type, question_key, label, required_if)
     values ('aaaa0000-0000-0000-0000-000000000003', 22, 'reference', 'rf3', 'F3',
             '{"question_key":"q1","op":"equals","value":"x"}') $$,
  'B3c: required_if on a `reference` ACCEPTED (FF-5, with B1c — the completeness arm covers both doors)');
select lives_ok(
  $$ insert into public.form_items (section_id, position, item_type, question_key, label, required_if)
     values ('aaaa0000-0000-0000-0000-000000000003', 23, 'short_text', 'st_ri', 'RI',
             '{"question_key":"q1","op":"equals","value":"x"}') $$,
  'B3d: POSITIVE TWIN — an INPUT item accepts required_if (so B3a-B3c are not passing vacuously)');

-- ===========================================================================
-- C · Write-inert + K9 on the six inert tables: authenticated has SELECT grant +
--     a `to authenticated` SELECT policy, but NO INSERT grant (writes are DEFINER-
--     only, landed by the FF phase). A policy without a grant is an inert boundary.
-- ===========================================================================
-- form_matrix_rows
select ok(has_table_privilege('authenticated', 'public.form_matrix_rows', 'SELECT'),
  'C1: authenticated SELECT grant on form_matrix_rows (K9)');
select ok(not has_table_privilege('authenticated', 'public.form_matrix_rows', 'INSERT'),
  'C2: authenticated NO INSERT grant on form_matrix_rows (write-inert)');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='form_matrix_rows'
    and cmd='SELECT' and 'authenticated' = any(roles)),
  'C3: form_matrix_rows has a SELECT policy TO authenticated');
-- form_matrix_columns
select ok(has_table_privilege('authenticated', 'public.form_matrix_columns', 'SELECT'),
  'C4: authenticated SELECT grant on form_matrix_columns (K9)');
select ok(not has_table_privilege('authenticated', 'public.form_matrix_columns', 'INSERT'),
  'C5: authenticated NO INSERT grant on form_matrix_columns (write-inert)');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='form_matrix_columns'
    and cmd='SELECT' and 'authenticated' = any(roles)),
  'C6: form_matrix_columns has a SELECT policy TO authenticated');
-- answer_matrix_cells
select ok(has_table_privilege('authenticated', 'public.answer_matrix_cells', 'SELECT'),
  'C7: authenticated SELECT grant on answer_matrix_cells (K9)');
select ok(not has_table_privilege('authenticated', 'public.answer_matrix_cells', 'INSERT'),
  'C8: authenticated NO INSERT grant on answer_matrix_cells (write-inert)');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='answer_matrix_cells'
    and cmd='SELECT' and 'authenticated' = any(roles)),
  'C9: answer_matrix_cells has a SELECT policy TO authenticated');
-- answer_risk_matrix
select ok(has_table_privilege('authenticated', 'public.answer_risk_matrix', 'SELECT'),
  'C10: authenticated SELECT grant on answer_risk_matrix (K9)');
select ok(not has_table_privilege('authenticated', 'public.answer_risk_matrix', 'INSERT'),
  'C11: authenticated NO INSERT grant on answer_risk_matrix (write-inert)');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='answer_risk_matrix'
    and cmd='SELECT' and 'authenticated' = any(roles)),
  'C12: answer_risk_matrix has a SELECT policy TO authenticated');
-- answer_references
select ok(has_table_privilege('authenticated', 'public.answer_references', 'SELECT'),
  'C13: authenticated SELECT grant on answer_references (K9)');
select ok(not has_table_privilege('authenticated', 'public.answer_references', 'INSERT'),
  'C14: authenticated NO INSERT grant on answer_references (write-inert)');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='answer_references'
    and cmd='SELECT' and 'authenticated' = any(roles)),
  'C15: answer_references has a SELECT policy TO authenticated');
-- form_item_validations
select ok(has_table_privilege('authenticated', 'public.form_item_validations', 'SELECT'),
  'C16: authenticated SELECT grant on form_item_validations (K9)');
select ok(not has_table_privilege('authenticated', 'public.form_item_validations', 'INSERT'),
  'C17: authenticated NO INSERT grant on form_item_validations (write-inert)');
select ok(exists (select 1 from pg_policies where schemaname='public' and tablename='form_item_validations'
    and cmd='SELECT' and 'authenticated' = any(roles)),
  'C18: form_item_validations has a SELECT policy TO authenticated');
-- Representative full write-denial (UPDATE/DELETE) on one answer-shape table.
select ok(not has_table_privilege('authenticated', 'public.answer_matrix_cells', 'UPDATE'),
  'C19: authenticated NO UPDATE grant on answer_matrix_cells (write-inert)');
select ok(not has_table_privilege('authenticated', 'public.answer_matrix_cells', 'DELETE'),
  'C20: authenticated NO DELETE grant on answer_matrix_cells (write-inert)');

-- ===========================================================================
-- D · response_group_instances position-uniqueness within a parent (incl. the
--     NULLS NOT DISTINCT top-level case). group_item_id references item_mc.
-- ===========================================================================
select lives_ok(
  $$ insert into public.response_group_instances (id, response_id, group_item_id, parent_instance_id, position)
     values ('aaaa0000-0000-0000-0000-000000000006', 'aaaa0000-0000-0000-0000-000000000005',
             (select item_mc from k), null, 0) $$,
  'D1: top-level instance at position 0 inserts');
select throws_ok(
  format($$ insert into public.response_group_instances (response_id, group_item_id, parent_instance_id, position)
            values ('aaaa0000-0000-0000-0000-000000000005', %L, null, 0) $$, (select item_mc from k)),
  '23505', null, 'D2: duplicate top-level position rejected (NULLS NOT DISTINCT)');
select lives_ok(
  format($$ insert into public.response_group_instances (response_id, group_item_id, parent_instance_id, position)
            values ('aaaa0000-0000-0000-0000-000000000005', %L, null, 1) $$, (select item_mc from k)),
  'D3: a different top-level position inserts');
select lives_ok(
  format($$ insert into public.response_group_instances (response_id, group_item_id, parent_instance_id, position)
            values ('aaaa0000-0000-0000-0000-000000000005', %L, 'aaaa0000-0000-0000-0000-000000000006', 0) $$, (select item_mc from k)),
  'D4: position 0 under a non-null parent inserts (distinct sibling scope)');
select throws_ok(
  format($$ insert into public.response_group_instances (response_id, group_item_id, parent_instance_id, position)
            values ('aaaa0000-0000-0000-0000-000000000005', %L, 'aaaa0000-0000-0000-0000-000000000006', 0) $$, (select item_mc from k)),
  '23505', null, 'D5: duplicate position under the same parent rejected');

-- ===========================================================================
-- E · Option columns + behavior_config shape.
-- ===========================================================================
select is(
  (select is_exclusive from public.form_item_options
   where item_id = 'aaaa0000-0000-0000-0000-000000000004' and code = 'op1'),
  false, 'E1: form_item_options.is_exclusive defaults false');
select ok(
  (select risk_weight from public.form_item_options
   where item_id = 'aaaa0000-0000-0000-0000-000000000004' and code = 'op1') is null,
  'E2: form_item_options.risk_weight is nullable (defaults null)');
select throws_ok(
  $$ update public.form_versions set behavior_config = '[]'::jsonb
     where id = 'aaaa0000-0000-0000-0000-000000000002' $$,
  '23514', null, 'E3: behavior_config must be an object (array rejected)');
select lives_ok(
  $$ update public.form_versions set behavior_config = '{"k":1}'::jsonb
     where id = 'aaaa0000-0000-0000-0000-000000000002' $$,
  'E4: behavior_config accepts a jsonb object');

-- ===========================================================================
-- F · clone_form_version carries behavior_config forward (Rule 5 / Flag 4).
-- ===========================================================================
select is(
  (select behavior_config from public.form_versions where id = (select new_ver from cloned)),
  '{"probe":true}'::jsonb,
  'F1: clone_form_version preserves behavior_config on the new draft');

select * from finish();
rollback;
