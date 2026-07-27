-- FF-2 (ADR 0089) — Matrix & Risk Matrix keystones.
--
-- EVERY assertion here is MUTATION-PROVEN: the comment above each section names
-- the exact change that makes it go red. A keystone that cannot fail is not a
-- keystone (ADR 0079), and this repo has shipped five vacuous ones, twice past
-- QA. `qa` should be able to re-run any proof from the note alone.
--
-- The two the ADR marks as MUST-BE-MUTATION-PROVEN are §J
-- (`instance_not_empty_with_matrix_only`) and §K
-- (`correction_copies_matrix_answers`). Both were reverted, re-run and observed
-- RED during authoring; the observed output is recorded in each section's note.
--
-- ⚠ `supersession_matrix_excluded` (ADR 0089 §Consequences) is NOT here. The
-- cell-unit aggregation it would guard lives in `dashboard.ts` (TypeScript) and
-- is deliberately deferred with that aggregation — see the FF-2 follow-ups in
-- PROGRESS.md. Recording it as absent beats writing an assertion that passes
-- because the thing it tests does not exist yet.

begin;

select plan(90);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'comm_x')::uuid as comm_x,
         (v->>'org_b')::uuid  as org_b
  from ctx;
grant select on k to authenticated;

-- ===========================================================================
-- §0 · THE FLAGS. Asserted, never forced.
--   A fixture that silently leaves `matrix_fields` OFF makes every RPC below
--   raise HC0P2 instead of testing anything, while the suite still reports a
--   total (the pgtap-fixture-flag-gaps scar). Forcing the flag here would make
--   the assertion vacuous, so it asserts the SEED.
--   MUTATION: remove the `matrix_fields` line from supabase/seed.sql -> 0a red.
-- ===========================================================================
select ok(
  app.feature_enabled('matrix_fields'),
  '0a. flag matrix_fields is ON (seed.sql) — every keystone below depends on it'
);
select ok(
  app.feature_enabled('response_correction'),
  '0b. flag response_correction is ON — §K supersede_response depends on it'
);
select ok(
  app.feature_enabled('repeating_groups'),
  '0c. flag repeating_groups is ON — §J/§K instance scoping depends on it'
);

-- ---------------------------------------------------------------------------
-- Fixture. Section 0 holds the gate; section 1 holds every matrix; section 2 is
-- conditional. Item conditions reference a question in an EARLIER section, so
-- validate_visible_when is satisfied under any reading of its ordering rule.
--
-- The gate is deliberately left UNANSWERED for most of the suite, which is what
-- makes the three conditional required matrices (item / plain group / section)
-- hidden — the deadlock-negative in §G.
-- ---------------------------------------------------------------------------
insert into public.forms (id, commission_id, title, created_by)
  values ('ff200000-0000-0000-0000-000000000001', (select comm_x from k), 'FF2', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('ff200000-0000-0000-0000-000000000002', 'ff200000-0000-0000-0000-000000000001', 1, 'draft');

insert into public.form_sections (id, form_version_id, position, is_default)
  values ('ff200000-0000-0000-0000-000000000003', 'ff200000-0000-0000-0000-000000000002', 0, true);
insert into public.form_sections (id, form_version_id, position, title)
  values ('ff200000-0000-0000-0000-000000000004', 'ff200000-0000-0000-0000-000000000002', 1, 'Matrizes');
insert into public.form_sections (id, form_version_id, position, title, visible_when)
  values ('ff200000-0000-0000-0000-000000000005', 'ff200000-0000-0000-0000-000000000002', 2, 'Condicional',
          '{"question_key":"mx_porta","op":"equals","value":"sim"}'::jsonb);

-- sec 0 / pos 0 — the gate.
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff200000-0000-0000-0000-000000000010', 'ff200000-0000-0000-0000-000000000003', 0, 'short_text', 'mx_porta', 'Porta');

-- sec 1 / pos 0 — the REQUIRED matrix: 3 rows x 2 columns.
insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
  values ('ff200000-0000-0000-0000-000000000011', 'ff200000-0000-0000-0000-000000000004', 0, 'matrix', 'matriz', 'Matriz', true);
insert into public.form_matrix_rows (item_id, form_version_id, position, code, label) values
  ('ff200000-0000-0000-0000-000000000011', 'ff200000-0000-0000-0000-000000000002', 0, 'r1', 'Critério 1'),
  ('ff200000-0000-0000-0000-000000000011', 'ff200000-0000-0000-0000-000000000002', 1, 'r2', 'Critério 2'),
  ('ff200000-0000-0000-0000-000000000011', 'ff200000-0000-0000-0000-000000000002', 2, 'r3', 'Critério 3');
insert into public.form_matrix_columns (item_id, form_version_id, position, code, label) values
  ('ff200000-0000-0000-0000-000000000011', 'ff200000-0000-0000-0000-000000000002', 0, 'c_ok', 'Conforme'),
  ('ff200000-0000-0000-0000-000000000011', 'ff200000-0000-0000-0000-000000000002', 1, 'c_nok', 'Não conforme');

-- sec 1 / pos 1 — the risk matrix. 9 x 3 = 27 and 9 x 1 = 9 are the two products
-- §E asserts; they are distinct from every other number in the fixture on purpose.
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff200000-0000-0000-0000-000000000012', 'ff200000-0000-0000-0000-000000000004', 1, 'risk_matrix', 'risco', 'Risco');
insert into public.form_matrix_rows (item_id, form_version_id, position, code, label, weight) values
  ('ff200000-0000-0000-0000-000000000012', 'ff200000-0000-0000-0000-000000000002', 0, 'grave', 'Grave', 9),
  ('ff200000-0000-0000-0000-000000000012', 'ff200000-0000-0000-0000-000000000002', 1, 'moderada', 'Moderada', 3);
insert into public.form_matrix_columns (item_id, form_version_id, position, code, label, weight) values
  ('ff200000-0000-0000-0000-000000000012', 'ff200000-0000-0000-0000-000000000002', 0, 'provavel', 'Provável', 3),
  ('ff200000-0000-0000-0000-000000000012', 'ff200000-0000-0000-0000-000000000002', 1, 'rara', 'Rara', 1);

-- sec 1 / pos 2,3 — a repeating group whose ONLY child is a matrix. That is what
-- makes §J's "instance holding only a matrix" constructible at all.
insert into public.form_items (id, section_id, position, item_type, label)
  values ('ff200000-0000-0000-0000-000000000013', 'ff200000-0000-0000-0000-000000000004', 2, 'repeating_group', 'Blocos');
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id)
  values ('ff200000-0000-0000-0000-000000000014', 'ff200000-0000-0000-0000-000000000004', 3, 'matrix', 'matriz_inst', 'Matriz do bloco', 'ff200000-0000-0000-0000-000000000013');
insert into public.form_matrix_rows (item_id, form_version_id, position, code, label) values
  ('ff200000-0000-0000-0000-000000000014', 'ff200000-0000-0000-0000-000000000002', 0, 'i1', 'Linha A'),
  ('ff200000-0000-0000-0000-000000000014', 'ff200000-0000-0000-0000-000000000002', 1, 'i2', 'Linha B');
insert into public.form_matrix_columns (item_id, form_version_id, position, code, label) values
  ('ff200000-0000-0000-0000-000000000014', 'ff200000-0000-0000-0000-000000000002', 0, 'ic_a', 'A'),
  ('ff200000-0000-0000-0000-000000000014', 'ff200000-0000-0000-0000-000000000002', 1, 'ic_b', 'B');

-- sec 1 / pos 4 — REQUIRED + CONDITIONAL matrix (hidden while the gate is blank).
insert into public.form_items (id, section_id, position, item_type, question_key, label, required, visible_when)
  values ('ff200000-0000-0000-0000-000000000015', 'ff200000-0000-0000-0000-000000000004', 4, 'matrix', 'matriz_cond', 'Matriz condicional', true,
          '{"question_key":"mx_porta","op":"equals","value":"sim"}'::jsonb);
insert into public.form_matrix_rows (item_id, form_version_id, position, code, label)
  values ('ff200000-0000-0000-0000-000000000015', 'ff200000-0000-0000-0000-000000000002', 0, 'k1', 'K1');
insert into public.form_matrix_columns (item_id, form_version_id, position, code, label)
  values ('ff200000-0000-0000-0000-000000000015', 'ff200000-0000-0000-0000-000000000002', 0, 'kc1', 'KC1');

-- sec 1 / pos 5,6 — a CONDITIONAL plain group whose child matrix is REQUIRED.
insert into public.form_items (id, section_id, position, item_type, label, visible_when)
  values ('ff200000-0000-0000-0000-000000000016', 'ff200000-0000-0000-0000-000000000004', 5, 'group', 'Grupo condicional',
          '{"question_key":"mx_porta","op":"equals","value":"sim"}'::jsonb);
insert into public.form_items (id, section_id, position, item_type, question_key, label, required, parent_item_id)
  values ('ff200000-0000-0000-0000-000000000017', 'ff200000-0000-0000-0000-000000000004', 6, 'matrix', 'matriz_grp', 'Matriz do grupo', true, 'ff200000-0000-0000-0000-000000000016');
insert into public.form_matrix_rows (item_id, form_version_id, position, code, label)
  values ('ff200000-0000-0000-0000-000000000017', 'ff200000-0000-0000-0000-000000000002', 0, 'g1', 'G1');
insert into public.form_matrix_columns (item_id, form_version_id, position, code, label)
  values ('ff200000-0000-0000-0000-000000000017', 'ff200000-0000-0000-0000-000000000002', 0, 'gc1', 'GC1');

-- sec 1 / pos 7 — a choice item; §L needs a genuine choice path through the
-- collapsed predicate, and a matrix-only fixture could not exercise it.
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff200000-0000-0000-0000-000000000019', 'ff200000-0000-0000-0000-000000000004', 7, 'multiple_choice', 'mx_escolha', 'Escolha');
insert into public.form_item_options (item_id, position, code, label) values
  ('ff200000-0000-0000-0000-000000000019', 0, 'sim', 'Sim'),
  ('ff200000-0000-0000-0000-000000000019', 1, 'nao', 'Não');

-- sec 1 / pos 8 — the item §A drives through the RPC (kept apart from the
-- fixture matrices so the RPC call cannot perturb anything else).
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff200000-0000-0000-0000-00000000001a', 'ff200000-0000-0000-0000-000000000004', 8, 'matrix', 'matriz_rpc', 'Matriz RPC');

-- sec 1 / pos 9 — a SECOND matrix, used by §D to supply a foreign row/column.
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff200000-0000-0000-0000-00000000001b', 'ff200000-0000-0000-0000-000000000004', 9, 'matrix', 'matriz_outra', 'Outra matriz');
insert into public.form_matrix_rows (id, item_id, form_version_id, position, code, label)
  values ('ff200000-0000-0000-0000-0000000000f1', 'ff200000-0000-0000-0000-00000000001b', 'ff200000-0000-0000-0000-000000000002', 0, 'x1', 'X1');
insert into public.form_matrix_columns (id, item_id, form_version_id, position, code, label)
  values ('ff200000-0000-0000-0000-0000000000f2', 'ff200000-0000-0000-0000-00000000001b', 'ff200000-0000-0000-0000-000000000002', 0, 'xc1', 'XC1');

-- sec 2 / pos 0 — REQUIRED matrix inside the CONDITIONAL section.
insert into public.form_items (id, section_id, position, item_type, question_key, label, required)
  values ('ff200000-0000-0000-0000-000000000018', 'ff200000-0000-0000-0000-000000000005', 0, 'matrix', 'matriz_sec', 'Matriz da seção', true);
insert into public.form_matrix_rows (item_id, form_version_id, position, code, label)
  values ('ff200000-0000-0000-0000-000000000018', 'ff200000-0000-0000-0000-000000000002', 0, 's1', 'S1');
insert into public.form_matrix_columns (item_id, form_version_id, position, code, label)
  values ('ff200000-0000-0000-0000-000000000018', 'ff200000-0000-0000-0000-000000000002', 0, 'sc1', 'SC1');

-- ===========================================================================
-- §A · K9 — the reader-non-writer posture SURVIVES the writers (ADR 0089 §E).
--   A writer landing is exactly when a write-inert table quietly becomes a
--   writable one. 209_flexible_forms.sql §C asserted this while the tables were
--   inert; the point here is that it still holds AFTER the RPCs exist.
--   MUTATION: `grant insert on public.form_matrix_rows to authenticated`
--     -> A1 and A5 go red.
--   A7 is the other half: if everything were simply denied, A1-A6 would pass on
--   a broken feature. A7 requires the sanctioned door to WORK.
-- ===========================================================================
select ok(not has_table_privilege('authenticated', 'public.form_matrix_rows', 'INSERT'),
  'A1. no INSERT grant on form_matrix_rows after the writers shipped (K9)');
select ok(not has_table_privilege('authenticated', 'public.form_matrix_columns', 'INSERT'),
  'A2. no INSERT grant on form_matrix_columns after the writers shipped (K9)');
select ok(not has_table_privilege('authenticated', 'public.answer_matrix_cells', 'INSERT'),
  'A3. no INSERT grant on answer_matrix_cells after the writers shipped (K9)');
select ok(not has_table_privilege('authenticated', 'public.answer_risk_matrix', 'INSERT'),
  'A4. no INSERT grant on answer_risk_matrix after the writers shipped (K9)');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

-- A staff_admin — the persona that MAY author this form — still cannot write the
-- axis table directly. This is the reader-non-writer proof: the same user
-- succeeds through the door in A7.
select throws_ok(
  $$insert into public.form_matrix_rows (item_id, form_version_id, position, code, label)
    values ('ff200000-0000-0000-0000-000000000011','ff200000-0000-0000-0000-000000000002', 9, 'hack', 'Hack')$$,
  '42501', null,
  'A5. a staff_admin cannot INSERT an axis row directly — only through the DEFINER door');

select throws_ok(
  $$update public.form_matrix_rows set label = 'hack' where code = 'r1'$$,
  '42501', null,
  'A6. …nor UPDATE one directly');

select lives_ok(
  $$select public.upsert_matrix_axes(
      'ff200000-0000-0000-0000-00000000001a',
      '[{"code":"a1","label":"A1","position":0}]'::jsonb,
      '[{"code":"ac1","label":"AC1","position":0}]'::jsonb)$$,
  'A7. …while the SAME staff_admin CAN write them through upsert_matrix_axes (the door works)');

select is(
  (select count(*)::int from public.form_matrix_rows
    where item_id = 'ff200000-0000-0000-0000-00000000001a'),
  1, 'A8. the RPC really persisted the axis row (A7 is not a silent no-op)');

-- REPLACE semantics: the payload is the whole desired axis, not a patch.
select lives_ok(
  $$select public.upsert_matrix_axes(
      'ff200000-0000-0000-0000-00000000001a',
      '[{"code":"a1","label":"A1 renomeada","position":0},{"code":"a2","label":"A2","position":1}]'::jsonb,
      '[{"code":"ac1","label":"AC1","position":0}]'::jsonb)$$,
  'A9. a second call with an added entry succeeds');

select is(
  (select string_agg(code || ':' || label, ',' order by position)
    from public.form_matrix_rows where item_id = 'ff200000-0000-0000-0000-00000000001a'),
  'a1:A1 renomeada,a2:A2',
  'A10. …relabelling an existing code and adding a new one both land (REPLACE, keyed on code)');

select lives_ok(
  $$select public.upsert_matrix_axes(
      'ff200000-0000-0000-0000-00000000001a',
      '[{"code":"a2","label":"A2","position":0}]'::jsonb,
      '[{"code":"ac1","label":"AC1","position":0}]'::jsonb)$$,
  'A11. a call OMITTING an existing code succeeds');

select is(
  (select string_agg(code, ',' order by position)
    from public.form_matrix_rows where item_id = 'ff200000-0000-0000-0000-00000000001a'),
  'a2', 'A12. …and the omitted entry is DELETED (REPLACE, not patch)');

-- A risk_matrix demands a weight on every entry of both axes — a cross-row
-- invariant no CHECK can express.
-- MUTATION: delete the HC0P6 block from upsert_matrix_axes -> A13 red.
select throws_ok(
  $$select public.upsert_matrix_axes(
      'ff200000-0000-0000-0000-000000000012',
      '[{"code":"grave","label":"Grave","position":0}]'::jsonb,
      '[{"code":"provavel","label":"Provável","position":0,"weight":3}]'::jsonb)$$,
  'HC0P6', null,
  'A13. a risk_matrix axis entry without a weight is rejected');

-- MUTATION: delete the duplicate-code block -> A14 red (or a raw 23505).
select throws_ok(
  $$select public.upsert_matrix_axes(
      'ff200000-0000-0000-0000-00000000001a',
      '[{"code":"dup","label":"D1","position":0},{"code":"dup","label":"D2","position":1}]'::jsonb,
      '[{"code":"ac1","label":"AC1","position":0}]'::jsonb)$$,
  'HC0P5', null,
  'A14. a duplicate axis code is rejected with a pt-BR error, not a raw 23505');

reset role;
select set_config('request.jwt.claims', null, true);

-- An ordinary staff member is not an author at all.
-- MUTATION: drop the authority check from upsert_matrix_axes -> A15 red.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$select public.upsert_matrix_axes(
      'ff200000-0000-0000-0000-00000000001a',
      '[{"code":"z","label":"Z","position":0}]'::jsonb,
      '[{"code":"zc","label":"ZC","position":0}]'::jsonb)$$,
  '42501', null,
  'A15. an ordinary staff member cannot author axes — authority is 42501, distinct from every HC0P*');
reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §B · ruling 4 — axis codes are immutable, DRAFT and PUBLISHED alike.
--   Run as the table OWNER on purpose: `authenticated` is stopped by the grant
--   (§A5) long before the trigger, so only the owner can actually reach it. A
--   keystone that ran as `authenticated` would pass on the GRANT's strength and
--   say nothing about the trigger — the vacuity trap.
--   MUTATION: drop guard_matrix_row_code_trg -> B1 goes red.
-- ===========================================================================
select throws_ok(
  $$update public.form_matrix_rows set code = 'rekeyed' where code = 'r1'$$,
  'HC0P0', null,
  'B1. re-keying an axis ROW is refused on a DRAFT version');

select throws_ok(
  $$update public.form_matrix_columns set code = 'rekeyed' where code = 'c_ok'$$,
  'HC0P0', null,
  'B2. re-keying an axis COLUMN is refused on a DRAFT version');

select lives_ok(
  $$update public.form_matrix_rows set label = 'Critério 1 renomeado' where code = 'r1'$$,
  'B3. …while RELABELLING the same row is allowed (relabel/reorder/add/remove stay legal)');

-- ---------------------------------------------------------------------------
-- Publish. This also exercises app.validate_matrix_axes: every matrix has both
-- axes and every risk_matrix entry carries a weight, or publish would fail here
-- and the rest of the suite could not run.
-- ---------------------------------------------------------------------------
-- An INCOMPLETE grid must block publish. A draft is allowed to be half-built —
-- the author is mid-edit — so this is a publish-time gate, not a CHECK.
-- MUTATION: remove the `perform app.validate_matrix_axes(...)` call from
--   publish_form_version -> B4 goes red (it would publish happily).
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff200000-0000-0000-0000-0000000000e1', 'ff200000-0000-0000-0000-000000000004', 20, 'matrix', 'matriz_vazia', 'Matriz vazia');

select throws_ok(
  $$select public.publish_form_version('ff200000-0000-0000-0000-000000000002')$$,
  'HC0P5', null,
  'B4. a matrix with NO axes blocks publish (app.validate_matrix_axes is wired into the RPC)');

delete from public.form_items where id = 'ff200000-0000-0000-0000-0000000000e1';

select lives_ok(
  $$select public.publish_form_version('ff200000-0000-0000-0000-000000000002')$$,
  'B5. …and the complete fixture publishes');

-- ===========================================================================
-- §C · ruling 1 — one column per row, true of the TABLE.
--   MUTATION: drop answer_matrix_cells_answer_id_row_id_key -> C2 red.
-- ===========================================================================
select ok(
  exists (select 1 from pg_constraint
          where conrelid = 'public.answer_matrix_cells'::regclass
            and conname = 'answer_matrix_cells_answer_id_row_id_key'),
  'C1. UNIQUE (answer_id, row_id) exists');

select ok(
  exists (select 1 from pg_constraint
          where conrelid = 'public.answer_matrix_cells'::regclass
            and conname = 'answer_matrix_cells_answer_id_row_id_col_id_key'),
  'C2. …and the original triple-uniqueness is KEPT (typed cells stay a constraint drop away)');

-- ---------------------------------------------------------------------------
-- The fill fixture: st_x's response on the published version.
-- ---------------------------------------------------------------------------
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;

insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ('ff200000-0000-0000-0000-000000000030', 'ff200000-0000-0000-0000-000000000002',
          (select comm_x from k), (select st_x from k), 'in_progress');

-- Two of three rows — deliberately incomplete for §F.
select lives_ok(
  $$select public.save_section_answers(
      'ff200000-0000-0000-0000-000000000030', 'ff200000-0000-0000-0000-000000000004',
      p_matrix_cells => '{"ff200000-0000-0000-0000-000000000011":{"r1":"c_ok","r2":"c_nok"}}'::jsonb)$$,
  'C3. a partial grid saves through the matrix arm of save_section_answers');

select is(
  (select count(*)::int from public.answer_matrix_cells c
   join public.answers a on a.id = c.answer_id
   where a.response_id = 'ff200000-0000-0000-0000-000000000030'),
  2, 'C4. two cells persisted');

-- REPLACE semantics + ruling 1 through the door: re-sending r1 under a DIFFERENT
-- column must MOVE the selection, never add a second cell on that row.
-- MUTATION: remove the `delete from public.answer_matrix_cells` block from
--   app.save_matrix_answers -> C5 red with a 23505 (the constraint catches it),
--   which is exactly the belt-and-braces ruling 1 asks for.
select lives_ok(
  $$select public.save_section_answers(
      'ff200000-0000-0000-0000-000000000030', 'ff200000-0000-0000-0000-000000000004',
      p_matrix_cells => '{"ff200000-0000-0000-0000-000000000011":{"r1":"c_nok","r2":"c_nok"}}'::jsonb)$$,
  'C5. re-sending the same row under another column succeeds (REPLACE)');

select is(
  (select col.code from public.answer_matrix_cells c
   join public.answers a on a.id = c.answer_id
   join public.form_matrix_rows r on r.id = c.row_id
   join public.form_matrix_columns col on col.id = c.col_id
   where a.response_id = 'ff200000-0000-0000-0000-000000000030'
     and a.item_id = 'ff200000-0000-0000-0000-000000000011' and r.code = 'r1'),
  'c_nok', 'C6. …and the row now holds exactly ONE column, the new one');

-- ===========================================================================
-- §D · INFO-4 — cross-item coherence. The FKs prove the row/col EXIST; they do
--   not prove they belong to the item the answer is for. Without this a grid
--   could be stapled onto another item's answer and the
--   (question_key, row_code, col_code) aggregation unit would silently mix.
--   MUTATION: drop guard_matrix_cell_coherent_trg -> D1/D2 red.
-- ===========================================================================
select throws_ok(
  $$select public.save_section_answers(
      'ff200000-0000-0000-0000-000000000030', 'ff200000-0000-0000-0000-000000000004',
      p_matrix_cells => '{"ff200000-0000-0000-0000-000000000011":{"x1":"c_ok"}}'::jsonb)$$,
  'HC0P7', null,
  'D1. a row code belonging to ANOTHER matrix is refused by the writer');

select throws_ok(
  $$select public.save_section_answers(
      'ff200000-0000-0000-0000-000000000030', 'ff200000-0000-0000-0000-000000000004',
      p_matrix_cells => '{"ff200000-0000-0000-0000-000000000011":{"r1":"xc1"}}'::jsonb)$$,
  'HC0P7', null,
  'D2. a column code belonging to ANOTHER matrix is refused by the writer');

-- The writer resolves codes per item, so the trigger is the LAST line — reach it
-- directly, as the owner, with a foreign row id the writer would never mint.
reset role;
select set_config('request.jwt.claims', null, true);

select throws_ok(
  format($$insert into public.answer_matrix_cells (answer_id, row_id, col_id, value)
           values (%L, 'ff200000-0000-0000-0000-0000000000f1',
                   (select id from public.form_matrix_columns where item_id = 'ff200000-0000-0000-0000-000000000011' and code = 'c_ok'),
                   'true'::jsonb)$$,
         (select a.id from public.answers a
           where a.response_id = 'ff200000-0000-0000-0000-000000000030'
             and a.item_id = 'ff200000-0000-0000-0000-000000000011')),
  'HC0P1', null,
  'D3. …and the TRIGGER refuses a foreign row even for a caller who bypasses the writer');

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;

-- ===========================================================================
-- §E · ruling 2 — risk_score is DERIVED, never accepted from the client.
--   The payload below carries "risk_score": 999. If the writer ever read a
--   client score, E1 would report 999.
--   MUTATION: change `r.weight * col.weight` to a value read from the payload
--     -> E1 red.
-- ===========================================================================
select lives_ok(
  $$select public.save_section_answers(
      'ff200000-0000-0000-0000-000000000030', 'ff200000-0000-0000-0000-000000000004',
      p_risk_matrix => '{"ff200000-0000-0000-0000-000000000012":{"severity":"grave","likelihood":"provavel","risk_score":999}}'::jsonb)$$,
  'E1. a risk answer carrying a client-supplied risk_score saves');

select is(
  (select rm.risk_score from public.answer_risk_matrix rm
   join public.answers a on a.id = rm.answer_id
   where a.response_id = 'ff200000-0000-0000-0000-000000000030'),
  9 * 3::numeric,
  'E2. …and the STORED score is severity.weight * likelihood.weight (27), not the client''s 999');

select lives_ok(
  $$select public.save_section_answers(
      'ff200000-0000-0000-0000-000000000030', 'ff200000-0000-0000-0000-000000000004',
      p_risk_matrix => '{"ff200000-0000-0000-0000-000000000012":{"severity":"grave","likelihood":"rara"}}'::jsonb)$$,
  'E3. re-answering the risk matrix succeeds (UNIQUE(answer_id) upsert)');

select is(
  (select rm.risk_score from public.answer_risk_matrix rm
   join public.answers a on a.id = rm.answer_id
   where a.response_id = 'ff200000-0000-0000-0000-000000000030'),
  9::numeric,
  'E4. …and the score is RECOMPUTED from the new axis pair (9 x 1)');

-- MUTATION: delete the HC0P8 both-halves block -> E5 red with a raw 23502.
select throws_ok(
  $$select public.save_section_answers(
      'ff200000-0000-0000-0000-000000000030', 'ff200000-0000-0000-0000-000000000004',
      p_risk_matrix => '{"ff200000-0000-0000-0000-000000000012":{"severity":"grave"}}'::jsonb)$$,
  'HC0P8', null,
  'E5. a risk answer missing the likelihood half is refused with a pt-BR error, not a raw NOT NULL');

-- ===========================================================================
-- §F · ruling 3 — `required` on a matrix means ROW-COMPLETE.
--   The response currently has 2 of 3 rows on the required `matriz`.
--   MUTATION: replace the `matrix` arm of app.item_required_satisfied with the
--     `else` (scalar) branch -> F1 goes GREEN when it must be red (a matrix has
--     no answers.value, so the scalar branch would report it unanswered) —
--     and F3 goes red. Both directions are asserted for that reason.
-- ===========================================================================
select ok(
  not app.item_required_satisfied(
    'ff200000-0000-0000-0000-000000000030', 'ff200000-0000-0000-0000-000000000011', 'matrix', null),
  'F1. a 2-of-3 grid is NOT required-satisfied (row-complete, not "any cell")');

select throws_ok(
  $$select public.submit_response('ff200000-0000-0000-0000-000000000030')$$,
  'HC011', null,
  'F2. …and submit_response refuses it — the RPC is the authority, not just the predicate');

select lives_ok(
  $$select public.save_section_answers(
      'ff200000-0000-0000-0000-000000000030', 'ff200000-0000-0000-0000-000000000004',
      p_matrix_cells => '{"ff200000-0000-0000-0000-000000000011":{"r1":"c_ok","r2":"c_nok","r3":"c_ok"}}'::jsonb)$$,
  'F3. completing the third row saves');

select ok(
  app.item_required_satisfied(
    'ff200000-0000-0000-0000-000000000030', 'ff200000-0000-0000-0000-000000000011', 'matrix', null),
  'F4. …and the grid is now required-satisfied');

-- ===========================================================================
-- §G · the deadlock-negative (ruling 3). Three REQUIRED matrices are hidden —
--   one by an item condition, one by a plain-group condition, one by a section
--   condition — and none of them may block submit.
--
--   ⚠ G1 alone would be VACUOUS: it also passes if those three items were
--   simply inert. G3 is the anti-vacuity twin — answering the gate makes them
--   visible and submit MUST then fail. Without G3, "hidden requires nothing"
--   and "nothing requires anything" are indistinguishable.
-- ===========================================================================
select is(
  (select count(*)::int from public.form_items
    where form_version_id = 'ff200000-0000-0000-0000-000000000002'
      and item_type = 'matrix' and required = true),
  4, 'G0. the fixture really holds four REQUIRED matrices (one visible, three hidden)');

select lives_ok(
  $$select public.submit_response('ff200000-0000-0000-0000-000000000030')$$,
  'G1. submit SUCCEEDS while three required matrices are hidden (item / plain group / section)');

select is(
  (select status from public.responses where id = 'ff200000-0000-0000-0000-000000000030'),
  'submitted', 'G2. …and the response really flipped to submitted');

-- The anti-vacuity twin, on a fresh draft with the gate ANSWERED.
insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ('ff200000-0000-0000-0000-000000000033', 'ff200000-0000-0000-0000-000000000002',
          (select comm_x from k), (select st_x from k), 'in_progress');
select public.save_section_answers(
  'ff200000-0000-0000-0000-000000000033', 'ff200000-0000-0000-0000-000000000003',
  p_answers => '{"ff200000-0000-0000-0000-000000000010":"sim"}'::jsonb);
select public.save_section_answers(
  'ff200000-0000-0000-0000-000000000033', 'ff200000-0000-0000-0000-000000000004',
  p_matrix_cells => '{"ff200000-0000-0000-0000-000000000011":{"r1":"c_ok","r2":"c_ok","r3":"c_ok"}}'::jsonb);

select throws_ok(
  $$select public.submit_response('ff200000-0000-0000-0000-000000000033')$$,
  'HC011', null,
  'G3. ANTI-VACUITY: with the gate answered the same three matrices become visible and DO block submit');

-- ===========================================================================
-- §I · submitted-response immutability for the two matrix answer tables.
--   Beyond the ADR's table — the guard was added because a writer landing is
--   when "nobody can write it anyway" stops covering a table. Unasked-for and
--   correct is not a reason to leave it untested.
--   MUTATION: drop guard_submitted_matrix_cells_trg -> I1/I2/I3 red.
--   Response ...0030 is submitted as of G1.
-- ===========================================================================
reset role;
select set_config('request.jwt.claims', null, true);

select throws_ok(
  format($$insert into public.answer_matrix_cells (answer_id, row_id, col_id, value)
           values (%L,
                   (select id from public.form_matrix_rows where item_id = 'ff200000-0000-0000-0000-000000000011' and code = 'r1'),
                   (select id from public.form_matrix_columns where item_id = 'ff200000-0000-0000-0000-000000000011' and code = 'c_ok'),
                   'true'::jsonb)$$,
         (select a.id from public.answers a
           where a.response_id = 'ff200000-0000-0000-0000-000000000030'
             and a.item_id = 'ff200000-0000-0000-0000-000000000011')),
  '23514', null,
  'I1. INSERTing a cell into a SUBMITTED response is blocked (immutable)');

select throws_ok(
  $$update public.answer_matrix_cells set value = 'false'::jsonb
    where answer_id in (select id from public.answers where response_id = 'ff200000-0000-0000-0000-000000000030')$$,
  '23514', null,
  'I2. …UPDATE is blocked');

select throws_ok(
  $$delete from public.answer_matrix_cells
    where answer_id in (select id from public.answers where response_id = 'ff200000-0000-0000-0000-000000000030')$$,
  '23514', null,
  'I3. …and DELETE is blocked');

select throws_ok(
  $$update public.answer_risk_matrix set risk_score = 1
    where answer_id in (select id from public.answers where response_id = 'ff200000-0000-0000-0000-000000000030')$$,
  '23514', null,
  'I4. the same guard covers answer_risk_matrix');

-- ===========================================================================
-- §H · INFO-1 — clone_form_version carries the axes through
--   app.copy_version_children.
--   MUTATION: delete the two matrix INSERTs from app.copy_version_children
--     -> H1/H2/H3 red. Before FF-2 this was live: publishing a matrix and then
--     editing it produced a draft whose grid had silently vanished.
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

select lives_ok(
  $$select public.clone_form_version('ff200000-0000-0000-0000-000000000002')$$,
  'H0. the published version clones');

select is(
  (select string_agg(r.code, ',' order by r.position)
   from public.form_matrix_rows r
   join public.form_items i on i.id = r.item_id
   join public.form_versions v on v.id = i.form_version_id
   where v.form_id = 'ff200000-0000-0000-0000-000000000001' and v.status = 'draft'
     and i.question_key = 'matriz'),
  'r1,r2,r3',
  'H1. the clone carries the row axis with its codes VERBATIM (the cross-version aggregation key)');

select is(
  (select string_agg(c.code || '=' || c.weight::text, ',' order by c.position)
   from public.form_matrix_columns c
   join public.form_items i on i.id = c.item_id
   join public.form_versions v on v.id = i.form_version_id
   where v.form_id = 'ff200000-0000-0000-0000-000000000001' and v.status = 'draft'
     and i.question_key = 'risco'),
  'provavel=3,rara=1',
  'H2. …and the risk WEIGHTS, so a cloned risk_matrix still scores');

select isnt(
  (select r.id from public.form_matrix_rows r
   join public.form_items i on i.id = r.item_id
   join public.form_versions v on v.id = i.form_version_id
   where v.form_id = 'ff200000-0000-0000-0000-000000000001' and v.status = 'draft'
     and i.question_key = 'matriz' and r.code = 'r1'),
  (select id from public.form_matrix_rows
    where item_id = 'ff200000-0000-0000-0000-000000000011' and code = 'r1'),
  'H3. the cloned axis rows are NEW rows — same code, different id (ids are per-version)');

select is(
  (select count(*)::int from public.form_matrix_rows
    where item_id = 'ff200000-0000-0000-0000-000000000011'),
  3, 'H4. the SOURCE version''s axes are untouched by the clone (Rule 5)');

reset role;
select set_config('request.jwt.claims', null, true);

-- A spare draft to copy INTO, so H5/H6 exercise the helper directly rather than
-- clone_form_version's existing-draft early return.
insert into public.forms (id, commission_id, title, created_by)
  values ('ff200000-0000-0000-0000-0000000000d1', (select comm_x from k), 'FF2 alvo', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('ff200000-0000-0000-0000-0000000000d2', 'ff200000-0000-0000-0000-0000000000d1', 1, 'draft');

-- H5/H6 are the TWO ARMS of one rule: the DEFINER helper's gate must be neither
-- weaker NOR STRONGER than the RLS it replaces. An unconditional check shipped in
-- Wave 1 and broke 61_answer_model_v2 / 203_others_and_length / 209_flexible_forms,
-- all of which drive clone_form_version with NO JWT (as the owner, for whom RLS
-- is bypassed). H6 is the regression guard; H5 keeps H6 from becoming a licence
-- to drop the gate entirely.
--   MUTATION: drop the `v_actor is not null and` scoping -> H6 red.
--   MUTATION: drop the whole authority check          -> H5 red.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;
select throws_ok(
  $$select app.copy_version_children(
      'ff200000-0000-0000-0000-000000000002', 'ff200000-0000-0000-0000-0000000000d2')$$,
  '42501', null,
  'H5. an ordinary staff member cannot drive the deep-copy helper (the gate is LIVE)');
reset role;
select set_config('request.jwt.claims', null, true);

select lives_ok(
  $$select app.copy_version_children(
      'ff200000-0000-0000-0000-000000000002', 'ff200000-0000-0000-0000-0000000000d2')$$,
  'H6. …while a NO-JWT caller (owner/service_role, whom RLS never gated) still can');

-- ===========================================================================
-- §J · MUTATION-PROVEN — `instance_not_empty_with_matrix_only` (ADR 0089 §A).
--
--   app.instance_is_empty decided presence from `answers.value` and
--   `answer_selected_options` ONLY. A matrix answer's payload lives in
--   answer_matrix_cells with answers.value NULL, so an instance holding ONLY a
--   filled matrix was judged empty, DELETED by submit_response, and its cells
--   cascaded away. Silent destruction of a saved answer.
--
--   MUTATION PERFORMED (both arms removed from app.instance_is_empty, suite
--   re-run): J1 red — "app.instance_is_empty returns TRUE"; J3 red — the
--   instance count dropped 1 -> 0; J4 red — 2 cells -> 0. Restored after.
--
--   The fixture's repeating group has EXACTLY ONE child, a matrix. There is no
--   scalar answer available to make the instance non-empty by accident.
-- ===========================================================================
-- G3's draft is still in_progress BY DESIGN (it must never be submittable), and
-- responses_one_draft_per_user_idx allows one per (version, user) — so retire it
-- before st_x opens §J's. Done as the owner: discarding it through the app path
-- would add an assertion this section does not own.
reset role;
select set_config('request.jwt.claims', null, true);
delete from public.responses where id = 'ff200000-0000-0000-0000-000000000033';

select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;

insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ('ff200000-0000-0000-0000-000000000034', 'ff200000-0000-0000-0000-000000000002',
          (select comm_x from k), (select st_x from k), 'in_progress');
insert into public.response_group_instances (id, response_id, group_item_id, position)
  values ('ff200000-0000-0000-0000-000000000035', 'ff200000-0000-0000-0000-000000000034',
          'ff200000-0000-0000-0000-000000000013', 0);

select public.save_section_answers(
  'ff200000-0000-0000-0000-000000000034', 'ff200000-0000-0000-0000-000000000004',
  p_matrix_cells => '{"ff200000-0000-0000-0000-000000000011":{"r1":"c_ok","r2":"c_ok","r3":"c_ok"}}'::jsonb,
  p_instance_answers => '[{"instance_id":"ff200000-0000-0000-0000-000000000035",
                           "matrix_cells":{"ff200000-0000-0000-0000-000000000014":{"i1":"ic_a","i2":"ic_b"}}}]'::jsonb);

select ok(
  not app.instance_is_empty('ff200000-0000-0000-0000-000000000034', 'ff200000-0000-0000-0000-000000000035'),
  'J1. an instance whose ONLY content is a filled matrix is NOT empty');

select is(
  (select count(*)::int from public.answers
    where response_id = 'ff200000-0000-0000-0000-000000000034'
      and group_instance_id = 'ff200000-0000-0000-0000-000000000035'
      and value is not null and value <> 'null'::jsonb),
  0, 'J2. …and it holds NO scalar value — J1 cannot be passing on the old arms');

select lives_ok(
  $$select public.submit_response('ff200000-0000-0000-0000-000000000034')$$,
  'J3. the response submits');

select is(
  (select count(*)::int from public.response_group_instances
    where response_id = 'ff200000-0000-0000-0000-000000000034'),
  1, 'J4. …and submit_response did NOT prune the matrix-only instance');

select is(
  (select string_agg(r.code || '->' || col.code, ',' order by r.position)
   from public.answer_matrix_cells c
   join public.answers a on a.id = c.answer_id
   join public.form_matrix_rows r on r.id = c.row_id
   join public.form_matrix_columns col on col.id = c.col_id
   where a.response_id = 'ff200000-0000-0000-0000-000000000034'
     and a.group_instance_id = 'ff200000-0000-0000-0000-000000000035'),
  'i1->ic_a,i2->ic_b',
  'J5. …and the cells survived BY VALUE (the cascade never fired)');

reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §K · MUTATION-PROVEN — `correction_copies_matrix_answers` (ADR 0089 §B).
--
--   A correction gives the successor its OWN response_group_instances rows (ADR
--   0087 Amendment 1.3), so a join matching new.group_instance_id to
--   old.group_instance_id is UNSATISFIABLE BY CONSTRUCTION and inserts zero rows
--   SILENTLY. That exact bug shipped in FF-1 as a P0.
--
--   MUTATION PERFORMED (the instance-resolving subquery in supersede_response's
--   answer_matrix_cells block replaced with
--   `new_a.group_instance_id is not distinct from old_a.group_instance_id`,
--   suite re-run): K4 red — expected 'i1->ic_a' got NULL; K5 red — expected
--   'i2->ic_b' got NULL. K2/K3 stayed GREEN throughout, which is precisely why
--   the instance assertions must exist: a top-level-only keystone is blind to
--   this defect. Restored after.
--
--   TWO instances with DIFFERENT cell values, because with one instance a
--   cross-instance mix-up is indistinguishable from a correct copy — the
--   generalisation of FF-1 K4's blindness (it counted rows on a short_text-only
--   fixture).
--
--   Everything is asserted by READING ROWS under `set local role`, never from a
--   predicate's return value (the ETH·E1 lesson).
-- ===========================================================================
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ('ff200000-0000-0000-0000-000000000040', 'ff200000-0000-0000-0000-000000000002',
          (select comm_x from k), (select sa_x from k), 'in_progress');
insert into public.response_group_instances (id, response_id, group_item_id, position) values
  ('ff200000-0000-0000-0000-000000000041', 'ff200000-0000-0000-0000-000000000040', 'ff200000-0000-0000-0000-000000000013', 0),
  ('ff200000-0000-0000-0000-000000000042', 'ff200000-0000-0000-0000-000000000040', 'ff200000-0000-0000-0000-000000000013', 1);

select public.save_section_answers(
  'ff200000-0000-0000-0000-000000000040', 'ff200000-0000-0000-0000-000000000004',
  p_matrix_cells => '{"ff200000-0000-0000-0000-000000000011":{"r1":"c_ok","r2":"c_nok","r3":"c_ok"}}'::jsonb,
  p_risk_matrix  => '{"ff200000-0000-0000-0000-000000000012":{"severity":"grave","likelihood":"provavel"}}'::jsonb,
  p_instance_answers => '[
     {"instance_id":"ff200000-0000-0000-0000-000000000041",
      "matrix_cells":{"ff200000-0000-0000-0000-000000000014":{"i1":"ic_a"}}},
     {"instance_id":"ff200000-0000-0000-0000-000000000042",
      "matrix_cells":{"ff200000-0000-0000-0000-000000000014":{"i2":"ic_b"}}}]'::jsonb);

select public.submit_response('ff200000-0000-0000-0000-000000000040');

select lives_ok(
  $$select public.supersede_response('ff200000-0000-0000-0000-000000000040', 'correção de teste')$$,
  'K0. supersede_response creates the correction draft');

-- The precondition the whole section turns on.
select ok(
  not exists (
    select 1
    from public.response_group_instances new_gi
    join public.response_group_instances old_gi on old_gi.id = new_gi.id
    where new_gi.response_id = (select id from public.responses where supersedes_id = 'ff200000-0000-0000-0000-000000000040')
      and old_gi.response_id = 'ff200000-0000-0000-0000-000000000040'),
  'K1. the successor''s instance ids are DISJOINT from the predecessor''s (Amendment 1.3)');

select is(
  (select string_agg(r.code || '->' || col.code, ',' order by r.position)
   from public.answer_matrix_cells c
   join public.answers a on a.id = c.answer_id
   join public.form_matrix_rows r on r.id = c.row_id
   join public.form_matrix_columns col on col.id = c.col_id
   where a.response_id = (select id from public.responses where supersedes_id = 'ff200000-0000-0000-0000-000000000040')
     and a.group_instance_id is null),
  'r1->c_ok,r2->c_nok,r3->c_ok',
  'K2. the TOP-LEVEL grid survives the correction BY VALUE');

select is(
  (select rm.risk_score::text || ':' || r.code || ':' || col.code
   from public.answer_risk_matrix rm
   join public.answers a on a.id = rm.answer_id
   join public.form_matrix_rows r on r.id = rm.severity_row_id
   join public.form_matrix_columns col on col.id = rm.likelihood_col_id
   where a.response_id = (select id from public.responses where supersedes_id = 'ff200000-0000-0000-0000-000000000040')),
  '27:grave:provavel',
  'K3. the risk answer survives with risk_score copied VERBATIM (not recomputed)');

select is(
  (select string_agg(r.code || '->' || col.code, ',')
   from public.answer_matrix_cells c
   join public.answers a on a.id = c.answer_id
   join public.response_group_instances gi on gi.id = a.group_instance_id
   join public.form_matrix_rows r on r.id = c.row_id
   join public.form_matrix_columns col on col.id = c.col_id
   where a.response_id = (select id from public.responses where supersedes_id = 'ff200000-0000-0000-0000-000000000040')
     and gi.position = 0),
  'i1->ic_a',
  'K4. instance at POSITION 0 carries the cell its predecessor counterpart held');

select is(
  (select string_agg(r.code || '->' || col.code, ',')
   from public.answer_matrix_cells c
   join public.answers a on a.id = c.answer_id
   join public.response_group_instances gi on gi.id = a.group_instance_id
   join public.form_matrix_rows r on r.id = c.row_id
   join public.form_matrix_columns col on col.id = c.col_id
   where a.response_id = (select id from public.responses where supersedes_id = 'ff200000-0000-0000-0000-000000000040')
     and gi.position = 1),
  'i2->ic_b',
  'K5. …and position 1 carries ITS OWN, different cell (no cross-instance mix-up)');

select is(
  (select count(*)::int from public.answer_matrix_cells c
   join public.answers a on a.id = c.answer_id
   where a.response_id = 'ff200000-0000-0000-0000-000000000040'),
  5, 'K6. the PREDECESSOR keeps its own cells (a correction copies, never moves)');

reset role;
select set_config('request.jwt.claims', null, true);

-- ===========================================================================
-- §L · app.item_required_satisfied — the single point of failure.
--   Four inlined presence tests (flat + per-instance in submit_response, flat +
--   per-instance in app.response_required_complete) collapsed into ONE
--   predicate. That is the right call AND it means one regression here silently
--   breaks required-ness for EVERY item type on the platform.
--   Each path is asserted in BOTH directions: a one-directional assertion
--   passes for a predicate hard-wired to that answer.
--   MUTATION: make the function `select true` -> every "not …" here goes red;
--             make it `select false` -> every positive here goes red.
-- ===========================================================================
-- st_x2, NOT sa_x: sa_x already owns §K's correction successor, which is an
-- in_progress response on THIS version, and responses_one_draft_per_user_idx
-- allows exactly one per (form_version_id, created_by).
select test_helpers.claims_for((select st_x2 from k), false);
set local role authenticated;

insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ('ff200000-0000-0000-0000-000000000050', 'ff200000-0000-0000-0000-000000000002',
          (select comm_x from k), (select st_x2 from k), 'in_progress');
insert into public.response_group_instances (id, response_id, group_item_id, position)
  values ('ff200000-0000-0000-0000-000000000051', 'ff200000-0000-0000-0000-000000000050',
          'ff200000-0000-0000-0000-000000000013', 0);

-- --- path 1: SCALAR ---
select ok(not app.item_required_satisfied(
    'ff200000-0000-0000-0000-000000000050', 'ff200000-0000-0000-0000-000000000010', 'short_text', null),
  'L1. scalar path — unanswered is NOT satisfied');
select public.save_section_answers(
  'ff200000-0000-0000-0000-000000000050', 'ff200000-0000-0000-0000-000000000003',
  p_answers => '{"ff200000-0000-0000-0000-000000000010":"nao"}'::jsonb);
select ok(app.item_required_satisfied(
    'ff200000-0000-0000-0000-000000000050', 'ff200000-0000-0000-0000-000000000010', 'short_text', null),
  'L2. scalar path — a non-null value IS satisfied');

-- --- path 2: CHOICE (answers.value is null; the proof lives in a selection row) ---
select ok(not app.item_required_satisfied(
    'ff200000-0000-0000-0000-000000000050', 'ff200000-0000-0000-0000-000000000019', 'multiple_choice', null),
  'L3. choice path — no selection is NOT satisfied');
select public.save_section_answers(
  'ff200000-0000-0000-0000-000000000050', 'ff200000-0000-0000-0000-000000000004',
  p_selections => '{"ff200000-0000-0000-0000-000000000019":["sim"]}'::jsonb);
select ok(app.item_required_satisfied(
    'ff200000-0000-0000-0000-000000000050', 'ff200000-0000-0000-0000-000000000019', 'multiple_choice', null),
  'L4. choice path — one selection IS satisfied, with answers.value still NULL');

-- --- path 3: GROUP CHILD (instance-scoped; the p_instance_id argument) ---
select ok(not app.item_required_satisfied(
    'ff200000-0000-0000-0000-000000000050', 'ff200000-0000-0000-0000-000000000014', 'matrix',
    'ff200000-0000-0000-0000-000000000051'),
  'L5. group-child path — an empty instance grid is NOT satisfied');
select public.save_section_answers(
  'ff200000-0000-0000-0000-000000000050', 'ff200000-0000-0000-0000-000000000004',
  p_instance_answers => '[{"instance_id":"ff200000-0000-0000-0000-000000000051",
                          "matrix_cells":{"ff200000-0000-0000-0000-000000000014":{"i1":"ic_a","i2":"ic_b"}}}]'::jsonb);
select ok(app.item_required_satisfied(
    'ff200000-0000-0000-0000-000000000050', 'ff200000-0000-0000-0000-000000000014', 'matrix',
    'ff200000-0000-0000-0000-000000000051'),
  'L6. group-child path — a complete instance grid IS satisfied');

-- The scope argument is load-bearing: the SAME item at TOP level is untouched.
-- MUTATION: drop `is not distinct from p_instance_id` from the matrix arm -> L7 red.
select ok(not app.item_required_satisfied(
    'ff200000-0000-0000-0000-000000000050', 'ff200000-0000-0000-0000-000000000014', 'matrix', null),
  'L7. …and the same item at TOP level stays unsatisfied — instance scope is honoured');

-- --- path 4: RISK MATRIX (its own arm; presence of the single answer row) ---
select ok(not app.item_required_satisfied(
    'ff200000-0000-0000-0000-000000000050', 'ff200000-0000-0000-0000-000000000012', 'risk_matrix', null),
  'L8. risk path — no answer row is NOT satisfied');
select public.save_section_answers(
  'ff200000-0000-0000-0000-000000000050', 'ff200000-0000-0000-0000-000000000004',
  p_risk_matrix => '{"ff200000-0000-0000-0000-000000000012":{"severity":"moderada","likelihood":"rara"}}'::jsonb);
select ok(app.item_required_satisfied(
    'ff200000-0000-0000-0000-000000000050', 'ff200000-0000-0000-0000-000000000012', 'risk_matrix', null),
  'L9. risk path — the answer row IS satisfied');

-- An empty GRID can never be vacuously complete (`not exists(missing row)` is
-- true for zero rows). matriz_rpc has one row and no cells.
-- MUTATION: drop the `exists (rows)` guard from the matrix arm -> L10 red.
select ok(not app.item_required_satisfied(
    'ff200000-0000-0000-0000-000000000050', 'ff200000-0000-0000-0000-00000000001a', 'matrix', null),
  'L10. a grid with rows but no cells is NOT vacuously satisfied');

-- app.response_required_complete is the OTHER caller; prove the dispatch is
-- wired there too, not only in submit_response (F2).
-- MUTATION: revert the flat arm of response_required_complete to the inlined
--   value/selection test -> L11 goes GREEN when it must be red.
select ok(
  not app.response_required_complete('ff200000-0000-0000-0000-000000000050'),
  'L11. response_required_complete sees the incomplete required matrix (dispatch wired on BOTH callers)');

reset role;
select set_config('request.jwt.claims', null, true);


-- ===========================================================================
-- §M · `supersession_matrix_excluded` (ADR 0089 §Consequences).
--
--   Deliberately absent until FUP-FF2-2 landed: with no cell aggregation there
--   was nothing for a superseded revision to drop OUT of, and a keystone written
--   against a non-existent path is vacuous by construction.
--
--   ⚠ ASSERTS THE PROPERTY, NOT THE NUMBER. The naive form ("the count is 1")
--   passes for the wrong reason in two directions: it is also 1 if the SUCCESSOR
--   were the row excluded, and also 1 if neither response registered. So every
--   assertion below pins WHICH VALUE SURVIVES — the predecessor and the successor
--   are given DIFFERENT columns and DIFFERENT weights on purpose, so "27
--   disappeared and 3 remained" is only satisfiable by the correct rule.
--
--   Its own form, so no earlier section's submitted responses pollute the
--   aggregate.
--
--   MUTATION: drop the `not exists (... succ.status = 'submitted')` arm from
--     app.submitted_form_responses -> M3/M4/M5/M6 go red.
-- ===========================================================================
-- Fixture built as the OWNER: K9 denies direct axis DML to `authenticated`
-- (§A5), so the role switch comes AFTER the grid exists.
insert into public.forms (id, commission_id, title, created_by)
  values ('ff200000-0000-0000-0000-0000000000b1', (select comm_x from k), 'FF2 supersessao', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('ff200000-0000-0000-0000-0000000000b2', 'ff200000-0000-0000-0000-0000000000b1', 1, 'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
  values ('ff200000-0000-0000-0000-0000000000b3', 'ff200000-0000-0000-0000-0000000000b2', 0, true);

insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff200000-0000-0000-0000-0000000000b4', 'ff200000-0000-0000-0000-0000000000b3', 0, 'matrix', 'sup_matriz', 'Matriz');
insert into public.form_matrix_rows (item_id, form_version_id, position, code, label)
  values ('ff200000-0000-0000-0000-0000000000b4', 'ff200000-0000-0000-0000-0000000000b2', 0, 'mr1', 'Linha 1');
insert into public.form_matrix_columns (item_id, form_version_id, position, code, label) values
  ('ff200000-0000-0000-0000-0000000000b4', 'ff200000-0000-0000-0000-0000000000b2', 0, 'mc_yes', 'Sim'),
  ('ff200000-0000-0000-0000-0000000000b4', 'ff200000-0000-0000-0000-0000000000b2', 1, 'mc_no', 'Nao');

insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff200000-0000-0000-0000-0000000000b5', 'ff200000-0000-0000-0000-0000000000b3', 1, 'risk_matrix', 'sup_risco', 'Risco');
insert into public.form_matrix_rows (item_id, form_version_id, position, code, label, weight) values
  ('ff200000-0000-0000-0000-0000000000b5', 'ff200000-0000-0000-0000-0000000000b2', 0, 'alta', 'Alta', 9),
  ('ff200000-0000-0000-0000-0000000000b5', 'ff200000-0000-0000-0000-0000000000b2', 1, 'baixa', 'Baixa', 3);
insert into public.form_matrix_columns (item_id, form_version_id, position, code, label, weight) values
  ('ff200000-0000-0000-0000-0000000000b5', 'ff200000-0000-0000-0000-0000000000b2', 0, 'freq', 'Frequente', 3),
  ('ff200000-0000-0000-0000-0000000000b5', 'ff200000-0000-0000-0000-0000000000b2', 1, 'raro', 'Raro', 1);

select public.publish_form_version('ff200000-0000-0000-0000-0000000000b2');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

-- The PREDECESSOR: mr1 -> mc_yes, risk alta x freq = 27.
insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ('ff200000-0000-0000-0000-0000000000b6', 'ff200000-0000-0000-0000-0000000000b2',
          (select comm_x from k), (select sa_x from k), 'in_progress');
select public.save_section_answers(
  'ff200000-0000-0000-0000-0000000000b6', 'ff200000-0000-0000-0000-0000000000b3',
  p_matrix_cells => '{"ff200000-0000-0000-0000-0000000000b4":{"mr1":"mc_yes"}}'::jsonb,
  p_risk_matrix  => '{"ff200000-0000-0000-0000-0000000000b5":{"severity":"alta","likelihood":"freq"}}'::jsonb);
select public.submit_response('ff200000-0000-0000-0000-0000000000b6');

select public.supersede_response('ff200000-0000-0000-0000-0000000000b6', 'motivo supersessao');

-- ---- while the successor is merely IN_PROGRESS ----
-- "A half-finished correction never blanks the metric" is a RULE of
-- app.submitted_form_responses, not an accident; assert it before the exclusion.
select is(
  (select string_agg(c.col_code, ',' order by c.col_code)
   from public.dashboard_matrix_cells('ff200000-0000-0000-0000-0000000000b1') c
   where c.question_key = 'sup_matriz' and c.row_code = 'mr1'),
  'mc_yes',
  'M1. an IN_PROGRESS successor does NOT exclude the predecessor - its column still counts');

select is(
  (select max(r.maximum) from public.dashboard_risk_scores('ff200000-0000-0000-0000-0000000000b1') r
   where r.question_key = 'sup_risco'),
  27::numeric,
  'M2. ...and its risk score is still the aggregate maximum');

-- ---- the successor answers DIFFERENTLY and is submitted ----
select public.save_section_answers(
  (select id from public.responses where supersedes_id = 'ff200000-0000-0000-0000-0000000000b6'),
  'ff200000-0000-0000-0000-0000000000b3',
  p_matrix_cells => '{"ff200000-0000-0000-0000-0000000000b4":{"mr1":"mc_no"}}'::jsonb,
  p_risk_matrix  => '{"ff200000-0000-0000-0000-0000000000b5":{"severity":"baixa","likelihood":"raro"}}'::jsonb);
select public.submit_response(
  (select id from public.responses where supersedes_id = 'ff200000-0000-0000-0000-0000000000b6'));

select is(
  (select string_agg(c.col_code, ',' order by c.col_code)
   from public.dashboard_matrix_cells('ff200000-0000-0000-0000-0000000000b1') c
   where c.question_key = 'sup_matriz' and c.row_code = 'mr1'),
  'mc_no',
  'M3. once the successor is SUBMITTED the predecessor column is GONE and only the successor remains');

select is(
  (select max(c.n) from public.dashboard_matrix_cells('ff200000-0000-0000-0000-0000000000b1') c
   where c.question_key = 'sup_matriz'),
  1::bigint,
  'M4. ...and n counts ONE answered grid, not both revisions');

select is(
  (select max(r.maximum) from public.dashboard_risk_scores('ff200000-0000-0000-0000-0000000000b1') r
   where r.question_key = 'sup_risco'),
  3::numeric,
  'M5. the superseded revision score 27 drops out of the risk aggregate (max is now 3)');

select is(
  (select string_agg(r.severity_code || 'x' || r.likelihood_code || '=' || r.score::text, ',')
   from public.dashboard_risk_scores('ff200000-0000-0000-0000-0000000000b1') r
   where r.question_key = 'sup_risco'),
  'baixaxraro=3',
  'M6. ...and exactly one (severity, likelihood) pair survives - the successor one');

-- Aggregation resolves through CODE, never through the per-version axis id
-- (ADR 0089 ruling 4). A clone mints NEW axis rows with the SAME codes, so an
-- id-keyed aggregation would split the series; a code-keyed one does not.
-- MUTATION: key dashboard_matrix_cells on r.id/c.id instead of r.code/c.code
--   -> M7 goes red (the codes become uuids).
select is(
  (select string_agg(distinct c.row_code, ',')
   from public.dashboard_matrix_cells('ff200000-0000-0000-0000-0000000000b1') c
   where c.question_key = 'sup_matriz'),
  'mr1',
  'M7. the aggregation unit is the CODE, not the per-version axis id');

reset role;
select set_config('request.jwt.claims', null, true);


-- ===========================================================================
-- §N · OUT-OF-PHASE (FF-1, ADR 0087) — the sign-off payload's per-instance
--   observation/other_text filters compared against `''''`, which in SQL source
--   is a literal ONE APOSTROPHE. They therefore excluded an observation equal to
--   `'` and let EMPTY-STRING observations through — the opposite of the intent,
--   and inconsistent with the top-level filter three lines away.
--
--   Asserts BOTH directions: an empty observation must be ABSENT from the
--   payload and a real one must be PRESENT. One direction alone is satisfied by
--   a filter that drops everything (or nothing).
--
--   MUTATION: restore `<> ''''` in the two per-instance filters of
--     get_response_for_signoff -> N2 and N4 go red (the empty string reappears).
-- ===========================================================================

-- A signable fixture: a section that REQUIRES a staff_admin signature, holding a
-- repeating group, so `get_response_for_signoff` reaches its instance block.
insert into public.forms (id, commission_id, title, created_by)
  values ('ff200000-0000-0000-0000-0000000000c1', (select comm_x from k), 'FF1 obs', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('ff200000-0000-0000-0000-0000000000c2', 'ff200000-0000-0000-0000-0000000000c1', 1, 'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
  values ('ff200000-0000-0000-0000-0000000000c3', 'ff200000-0000-0000-0000-0000000000c2', 0, true);
insert into public.form_sections (id, form_version_id, position, title, requires_signoff, signoff_role)
  values ('ff200000-0000-0000-0000-0000000000c4', 'ff200000-0000-0000-0000-0000000000c2', 1, 'Assinatura', true, 'staff_admin');

insert into public.form_items (id, section_id, position, item_type, label)
  values ('ff200000-0000-0000-0000-0000000000c5', 'ff200000-0000-0000-0000-0000000000c3', 0, 'repeating_group', 'Blocos');
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id)
  values ('ff200000-0000-0000-0000-0000000000c6', 'ff200000-0000-0000-0000-0000000000c3', 1, 'short_text', 'obs_campo', 'Campo', 'ff200000-0000-0000-0000-0000000000c5');
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff200000-0000-0000-0000-0000000000c7', 'ff200000-0000-0000-0000-0000000000c4', 0, 'short_text', 'obs_nota', 'Nota');

select public.publish_form_version('ff200000-0000-0000-0000-0000000000c2');

-- st_x fills it: two instances, one carrying an EMPTY observation and the other
-- a real one. The RPC is only reachable while a staff_admin sign-off is pending.
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;

insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ('ff200000-0000-0000-0000-0000000000c8', 'ff200000-0000-0000-0000-0000000000c2',
          (select comm_x from k), (select st_x from k), 'in_progress');
insert into public.response_group_instances (id, response_id, group_item_id, position) values
  ('ff200000-0000-0000-0000-0000000000c9', 'ff200000-0000-0000-0000-0000000000c8', 'ff200000-0000-0000-0000-0000000000c5', 0),
  ('ff200000-0000-0000-0000-0000000000ca', 'ff200000-0000-0000-0000-0000000000c8', 'ff200000-0000-0000-0000-0000000000c5', 1);

select public.save_section_answers(
  'ff200000-0000-0000-0000-0000000000c8', 'ff200000-0000-0000-0000-0000000000c3',
  p_instance_answers => '[
    {"instance_id":"ff200000-0000-0000-0000-0000000000c9",
     "answers":{"ff200000-0000-0000-0000-0000000000c6":"A"},
     "observations":{"ff200000-0000-0000-0000-0000000000c6":"observacao real"}},
    {"instance_id":"ff200000-0000-0000-0000-0000000000ca",
     "answers":{"ff200000-0000-0000-0000-0000000000c6":"B"}}]'::jsonb);

reset role;
select set_config('request.jwt.claims', null, true);

-- Force the EMPTY string directly: save_section_answers nullifies a blank
-- observation on the way in, so the only way to construct the row this filter
-- exists to reject is to write it as the owner. That is the point — the filter
-- is the LAST line of defence for data that predates or bypasses that nullify.
update public.answers set observation = ''
  where response_id = 'ff200000-0000-0000-0000-0000000000c8'
    and group_instance_id = 'ff200000-0000-0000-0000-0000000000ca';

select is(
  (select count(*)::int from public.answers
   where response_id = 'ff200000-0000-0000-0000-0000000000c8'
     and group_instance_id = 'ff200000-0000-0000-0000-0000000000ca'
     and observation = ''),
  1, 'N1. the fixture really holds an EMPTY-STRING observation (N2 is not vacuous)');

-- Read the door as the signer.
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

select is(
  (select (i.value -> 'observations_by_item') ->> 'ff200000-0000-0000-0000-0000000000c6'
   from jsonb_array_elements(
          public.get_response_for_signoff('ff200000-0000-0000-0000-0000000000c8') -> 'instances') i
   where (i.value ->> 'id') = 'ff200000-0000-0000-0000-0000000000ca'),
  null,
  'N2. an EMPTY observation is filtered OUT of the instance payload');

select is(
  (select (i.value -> 'observations_by_item') ->> 'ff200000-0000-0000-0000-0000000000c6'
   from jsonb_array_elements(
          public.get_response_for_signoff('ff200000-0000-0000-0000-0000000000c8') -> 'instances') i
   where (i.value ->> 'id') = 'ff200000-0000-0000-0000-0000000000c9'),
  'observacao real',
  'N3. …while a real observation is still PRESENT (the filter did not drop everything)');

reset role;
select set_config('request.jwt.claims', null, true);

update public.answers set other_text = ''
  where response_id = 'ff200000-0000-0000-0000-0000000000c8'
    and group_instance_id = 'ff200000-0000-0000-0000-0000000000ca';

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

select is(
  (select (i.value -> 'other_text_by_item') ->> 'ff200000-0000-0000-0000-0000000000c6'
   from jsonb_array_elements(
          public.get_response_for_signoff('ff200000-0000-0000-0000-0000000000c8') -> 'instances') i
   where (i.value ->> 'id') = 'ff200000-0000-0000-0000-0000000000ca'),
  null,
  'N4. the SAME slip in the other_text filter is fixed too (both sites, one copy-paste)');

reset role;
select set_config('request.jwt.claims', null, true);

select * from finish();
rollback;
