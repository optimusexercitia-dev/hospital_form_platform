-- FF-3 (ADR 0090) — Validation Engine keystones.
--
-- EVERY assertion here is MUTATION-PROVEN: the note above each section names the
-- exact change that makes it go red. A keystone that cannot fail is not a keystone
-- (ADR 0079) and this repo has shipped seven vacuous ones, twice past QA. `qa`
-- should be able to re-run any proof from the note alone.
--
-- §A is the SQL half of the phase's golden vectors. The JSON below is the LITERAL
-- CONTENT of src/lib/queries/__fixtures__/validation-vectors.json, embedded in a
-- dollar-quoted literal, and src/lib/queries/validations.test.ts asserts they still
-- parse EQUAL. That is the drift DETECTOR FF-1's QA asked for (INFO-4): the
-- condition vectors have been hand-maintained in two places since ADR 0005 with
-- nothing but discipline keeping them equal, and this second pair does not repeat
-- that. Edit either side alone and Vitest goes red.

begin;

select plan(69);

create temp table ctx on commit drop as select test_helpers.bootstrap() as v;
grant select on ctx to authenticated;

create temp table k on commit drop as
  select (v->>'sa_x')::uuid   as sa_x,
         (v->>'st_x')::uuid   as st_x,
         (v->>'st_x2')::uuid  as st_x2,
         (v->>'comm_x')::uuid as comm_x
  from ctx;
grant select on k to authenticated;

-- ===========================================================================
-- §0 · THE FLAGS. Asserted, never forced.
--   A fixture that leaves `item_validations` OFF makes set_item_validations raise
--   HC0Q0 and get_response_validation_errors return the EMPTY SET, so most of
--   this file would pass vacuously while the suite still reports a total (the
--   pgtap-fixture-flag-gaps scar).
--   MUTATION: remove the item_validations line from supabase/seed.sql -> 0a red.
-- ===========================================================================
select ok(app.feature_enabled('item_validations'),
  '0a. flag item_validations is ON (seed.sql) — every keystone below depends on it');
select ok(app.feature_enabled('repeating_groups'),
  '0b. flag repeating_groups is ON — the per-instance arms depend on it');

-- ===========================================================================
-- §A · KEYSTONE 1 `validation_parity_vectors` — the SQL <-> TS golden.
--   MUTATION: flip any single branch of app.eval_validation (e.g. `<` to `<=` in
--     the number_range min test) -> the matching vector goes red HERE and in
--     Vitest. One fixture, two engines, one verdict.
-- ===========================================================================
create temp table vv on commit drop as
select (e.value ->> 'name') as name,
       (e.value ->> 'rule_type') as rule_type,
       (e.value -> 'config') as config,
       (e.value -> 'value') as val,
       (e.value -> 'answers') as answers,
       (e.value -> 'peer_values') as peers,
       (e.value ->> 'expected')::boolean as expected
from jsonb_array_elements(
  ($vectors${
  "_comment": [
    "FF-3 (ADR 0090) golden vectors for the SECOND dual evaluator pair:",
    "SQL app.eval_validation  <->  TS evalValidation (src/lib/queries/validations.ts).",
    "The SAME vectors run in Vitest (conditions/validations test) and in pgTAP",
    "(supabase/tests/274_ff3_validations.sql). Drift between the two evaluators is a",
    "phase-blocking bug (ARCHITECTURE Rule 3).",
    "",
    "`expected` is SATISFIED: true = no violation.",
    "`value` is the value from the ANSWER MAP in scope, never a raw answers.value.",
    "`answers` is only consulted by datetime_order; `peer_values` only by",
    "unique_within_group."
  ],
  "vectors": [
    {
      "name": "empty: null value satisfies number_range",
      "rule_type": "number_range",
      "config": { "min": 5 },
      "value": null,
      "answers": {},
      "peer_values": [],
      "expected": true
    },
    {
      "name": "empty: empty string satisfies text_length min",
      "rule_type": "text_length",
      "config": { "min": 3 },
      "value": "",
      "answers": {},
      "peer_values": [],
      "expected": true
    },
    {
      "name": "empty: empty array satisfies unique_within_group",
      "rule_type": "unique_within_group",
      "config": {},
      "value": [],
      "answers": {},
      "peer_values": [[]],
      "expected": true
    },
    {
      "name": "number_range: zero is NOT empty and is checked",
      "rule_type": "number_range",
      "config": { "min": 1 },
      "value": 0,
      "answers": {},
      "peer_values": [],
      "expected": false
    },
    {
      "name": "number_range: at the min bound (inclusive)",
      "rule_type": "number_range",
      "config": { "min": 5, "max": 10 },
      "value": 5,
      "answers": {},
      "peer_values": [],
      "expected": true
    },
    {
      "name": "number_range: at the max bound (inclusive)",
      "rule_type": "number_range",
      "config": { "min": 5, "max": 10 },
      "value": 10,
      "answers": {},
      "peer_values": [],
      "expected": true
    },
    {
      "name": "number_range: below min",
      "rule_type": "number_range",
      "config": { "min": 5, "max": 10 },
      "value": 4,
      "answers": {},
      "peer_values": [],
      "expected": false
    },
    {
      "name": "number_range: above max",
      "rule_type": "number_range",
      "config": { "min": 5, "max": 10 },
      "value": 11,
      "answers": {},
      "peer_values": [],
      "expected": false
    },
    {
      "name": "number_range: max-only bound, below it",
      "rule_type": "number_range",
      "config": { "max": 100 },
      "value": 99.5,
      "answers": {},
      "peer_values": [],
      "expected": true
    },
    {
      "name": "number_range: negative below a negative min",
      "rule_type": "number_range",
      "config": { "min": -5 },
      "value": -6,
      "answers": {},
      "peer_values": [],
      "expected": false
    },
    {
      "name": "number_range: a non-number value cannot violate a range",
      "rule_type": "number_range",
      "config": { "min": 5 },
      "value": "abc",
      "answers": {},
      "peer_values": [],
      "expected": true
    },
    {
      "name": "text_length: at the min bound (inclusive)",
      "rule_type": "text_length",
      "config": { "min": 3, "max": 5 },
      "value": "abc",
      "answers": {},
      "peer_values": [],
      "expected": true
    },
    {
      "name": "text_length: at the max bound (inclusive)",
      "rule_type": "text_length",
      "config": { "min": 3, "max": 5 },
      "value": "abcde",
      "answers": {},
      "peer_values": [],
      "expected": true
    },
    {
      "name": "text_length: below min",
      "rule_type": "text_length",
      "config": { "min": 3, "max": 5 },
      "value": "ab",
      "answers": {},
      "peer_values": [],
      "expected": false
    },
    {
      "name": "text_length: above max",
      "rule_type": "text_length",
      "config": { "min": 3, "max": 5 },
      "value": "abcdef",
      "answers": {},
      "peer_values": [],
      "expected": false
    },
    {
      "name": "text_length: whitespace is NOT trimmed away",
      "rule_type": "text_length",
      "config": { "min": 3 },
      "value": "  ",
      "answers": {},
      "peer_values": [],
      "expected": false
    },
    {
      "name": "text_length: an astral character counts as ONE (char_length, not UTF-16)",
      "rule_type": "text_length",
      "config": { "max": 1 },
      "value": "😀",
      "answers": {},
      "peer_values": [],
      "expected": true
    },
    {
      "name": "text_length: accented pt-BR text counts by character",
      "rule_type": "text_length",
      "config": { "max": 9 },
      "value": "higienização",
      "answers": {},
      "peer_values": [],
      "expected": false
    },
    {
      "name": "text_length: a non-string value cannot violate a length",
      "rule_type": "text_length",
      "config": { "min": 3 },
      "value": 7,
      "answers": {},
      "peer_values": [],
      "expected": true
    },
    {
      "name": "regex: anchored digit pattern matches",
      "rule_type": "regex",
      "config": { "pattern": "^[0-9]{4}$" },
      "value": "1234",
      "answers": {},
      "peer_values": [],
      "expected": true
    },
    {
      "name": "regex: anchored digit pattern rejects",
      "rule_type": "regex",
      "config": { "pattern": "^[0-9]{4}$" },
      "value": "12a4",
      "answers": {},
      "peer_values": [],
      "expected": false
    },
    {
      "name": "regex: unanchored patterns SEARCH on both engines",
      "rule_type": "regex",
      "config": { "pattern": "abc" },
      "value": "xxabcxx",
      "answers": {},
      "peer_values": [],
      "expected": true
    },
    {
      "name": "regex: case-sensitive by default",
      "rule_type": "regex",
      "config": { "pattern": "^abc$" },
      "value": "ABC",
      "answers": {},
      "peer_values": [],
      "expected": false
    },
    {
      "name": "regex: caseInsensitive true",
      "rule_type": "regex",
      "config": { "pattern": "^abc$", "caseInsensitive": true },
      "value": "ABC",
      "answers": {},
      "peer_values": [],
      "expected": true
    },
    {
      "name": "regex: a non-string value cannot violate a pattern",
      "rule_type": "regex",
      "config": { "pattern": "^[0-9]+$" },
      "value": 12,
      "answers": {},
      "peer_values": [],
      "expected": true
    },
    {
      "name": "date_range: at the min bound (inclusive)",
      "rule_type": "date_range",
      "config": { "min": "2026-01-01", "max": "2026-12-31" },
      "value": "2026-01-01",
      "answers": {},
      "peer_values": [],
      "expected": true
    },
    {
      "name": "date_range: before the min bound",
      "rule_type": "date_range",
      "config": { "min": "2026-01-01", "max": "2026-12-31" },
      "value": "2025-12-31",
      "answers": {},
      "peer_values": [],
      "expected": false
    },
    {
      "name": "date_range: after the max bound",
      "rule_type": "date_range",
      "config": { "min": "2026-01-01", "max": "2026-12-31" },
      "value": "2027-01-01",
      "answers": {},
      "peer_values": [],
      "expected": false
    },
    {
      "name": "date_range: 24h time bounds sort lexicographically",
      "rule_type": "date_range",
      "config": { "min": "08:00", "max": "17:00" },
      "value": "07:59",
      "answers": {},
      "peer_values": [],
      "expected": false
    },
    {
      "name": "date_range: time at the min bound (inclusive)",
      "rule_type": "date_range",
      "config": { "min": "08:00", "max": "17:00" },
      "value": "08:00",
      "answers": {},
      "peer_values": [],
      "expected": true
    },
    {
      "name": "datetime_order before: earlier than the sibling",
      "rule_type": "datetime_order",
      "config": { "op": "before", "question_key": "fim" },
      "value": "2026-01-01",
      "answers": { "fim": "2026-06-01" },
      "peer_values": [],
      "expected": true
    },
    {
      "name": "datetime_order before: equal to the sibling violates",
      "rule_type": "datetime_order",
      "config": { "op": "before", "question_key": "fim" },
      "value": "2026-06-01",
      "answers": { "fim": "2026-06-01" },
      "peer_values": [],
      "expected": false
    },
    {
      "name": "datetime_order after: later than the sibling",
      "rule_type": "datetime_order",
      "config": { "op": "after", "question_key": "inicio" },
      "value": "2026-06-02",
      "answers": { "inicio": "2026-06-01" },
      "peer_values": [],
      "expected": true
    },
    {
      "name": "datetime_order after: earlier violates",
      "rule_type": "datetime_order",
      "config": { "op": "after", "question_key": "inicio" },
      "value": "2026-05-31",
      "answers": { "inicio": "2026-06-01" },
      "peer_values": [],
      "expected": false
    },
    {
      "name": "datetime_order not_before: equal satisfies",
      "rule_type": "datetime_order",
      "config": { "op": "not_before", "question_key": "inicio" },
      "value": "2026-06-01",
      "answers": { "inicio": "2026-06-01" },
      "peer_values": [],
      "expected": true
    },
    {
      "name": "datetime_order not_after: equal satisfies",
      "rule_type": "datetime_order",
      "config": { "op": "not_after", "question_key": "fim" },
      "value": "2026-06-01",
      "answers": { "fim": "2026-06-01" },
      "peer_values": [],
      "expected": true
    },
    {
      "name": "datetime_order not_after: later violates",
      "rule_type": "datetime_order",
      "config": { "op": "not_after", "question_key": "fim" },
      "value": "2026-06-02",
      "answers": { "fim": "2026-06-01" },
      "peer_values": [],
      "expected": false
    },
    {
      "name": "datetime_order: an ABSENT sibling makes the rule inert",
      "rule_type": "datetime_order",
      "config": { "op": "before", "question_key": "fim" },
      "value": "2026-06-02",
      "answers": {},
      "peer_values": [],
      "expected": true
    },
    {
      "name": "datetime_order: a NULL sibling makes the rule inert",
      "rule_type": "datetime_order",
      "config": { "op": "before", "question_key": "fim" },
      "value": "2026-06-02",
      "answers": { "fim": null },
      "peer_values": [],
      "expected": true
    },
    {
      "name": "datetime_order: times compare lexicographically too",
      "rule_type": "datetime_order",
      "config": { "op": "before", "question_key": "fim" },
      "value": "09:30",
      "answers": { "fim": "10:00" },
      "peer_values": [],
      "expected": true
    },
    {
      "name": "unique_within_group: no peer holds the value",
      "rule_type": "unique_within_group",
      "config": {},
      "value": "A1",
      "answers": {},
      "peer_values": ["B2", "C3"],
      "expected": true
    },
    {
      "name": "unique_within_group: a peer holds the same value",
      "rule_type": "unique_within_group",
      "config": {},
      "value": "A1",
      "answers": {},
      "peer_values": ["B2", "A1"],
      "expected": false
    },
    {
      "name": "unique_within_group: the only instance has no peers",
      "rule_type": "unique_within_group",
      "config": {},
      "value": "A1",
      "answers": {},
      "peer_values": [],
      "expected": true
    },
    {
      "name": "unique_within_group: numeric duplicates compare by value",
      "rule_type": "unique_within_group",
      "config": {},
      "value": 3,
      "answers": {},
      "peer_values": [1, 2, 3],
      "expected": false
    },
    {
      "name": "unique_within_group: 3 and \"3\" are different values",
      "rule_type": "unique_within_group",
      "config": {},
      "value": 3,
      "answers": {},
      "peer_values": ["3"],
      "expected": true
    },
    {
      "name": "unique_within_group: array values compare structurally",
      "rule_type": "unique_within_group",
      "config": {},
      "value": ["a", "b"],
      "answers": {},
      "peer_values": [["a", "b"]],
      "expected": false
    },
    {
      "name": "unique_within_group: array order matters",
      "rule_type": "unique_within_group",
      "config": {},
      "value": ["a", "b"],
      "answers": {},
      "peer_values": [["b", "a"]],
      "expected": true
    }
  ]
}$vectors$::jsonb) -> 'vectors'
) e;

select is(
  (select count(*)::int from vv
   where app.eval_validation(rule_type, config, val, answers, peers) is distinct from expected),
  0,
  'A1. every golden vector agrees with app.eval_validation'
);

-- A vector table that silently failed to load would make A1 vacuously true
-- (0 = 0), so pin the shape as well as the agreement.
select cmp_ok((select count(*)::int from vv), '>=', 40,
  'A2. the vector table actually loaded — A1 is not 0 rows agreeing with nothing');
select is((select count(distinct rule_type)::int from vv), 6,
  'A3. all six rule types are exercised — a type with no vector is untested on BOTH sides');

-- ===========================================================================
-- Fixture: one draft version in commission X.
--   sec A is the flat lane: a gate, a number, a text, a required_if pair, the
--   DEADLOCK-NEGATIVE hidden+required_if item, its visible TWIN, and a legacy
--   config-bound item. sec B is one repeating group carrying the two
--   instance-scoped rules.
-- ===========================================================================
insert into public.forms (id, commission_id, title, created_by)
  values ('ff300000-0000-0000-0000-000000000001', (select comm_x from k), 'FF3', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('ff300000-0000-0000-0000-000000000002', 'ff300000-0000-0000-0000-000000000001', 1, 'draft');

insert into public.form_sections (id, form_version_id, position, is_default)
  values ('ff300000-0000-0000-0000-000000000003', 'ff300000-0000-0000-0000-000000000002', 0, true);
insert into public.form_sections (id, form_version_id, position, title)
  values ('ff300000-0000-0000-0000-000000000004', 'ff300000-0000-0000-0000-000000000002', 1, 'Bloco');

insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff300000-0000-0000-0000-000000000010', 'ff300000-0000-0000-0000-000000000003', 0, 'multiple_choice', 'v_gate', 'Porta?');
insert into public.form_item_options (item_id, position, code, label) values
  ('ff300000-0000-0000-0000-000000000010', 0, 'sim', 'Sim'),
  ('ff300000-0000-0000-0000-000000000010', 1, 'nao', 'Não');

insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff300000-0000-0000-0000-000000000011', 'ff300000-0000-0000-0000-000000000003', 1, 'number', 'v_num', 'Quantidade');
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff300000-0000-0000-0000-000000000012', 'ff300000-0000-0000-0000-000000000003', 2, 'short_text', 'v_txt', 'Observação');

-- required_if, VISIBLE either way: required only when the gate says "sim".
insert into public.form_items (id, section_id, position, item_type, question_key, label, required_if)
  values ('ff300000-0000-0000-0000-000000000013', 'ff300000-0000-0000-0000-000000000003', 3, 'short_text', 'v_reqif', 'Justificativa',
          '{"question_key":"v_gate","op":"equals","value":"sim"}'::jsonb);

-- THE DEADLOCK-NEGATIVE ITEM: visible only when the gate says "nao", required
-- only when it says "sim". The two can never both hold, so with gate = "sim" it
-- is hidden AND required_if-true — and must never block.
insert into public.form_items (id, section_id, position, item_type, question_key, label, visible_when, required_if)
  values ('ff300000-0000-0000-0000-000000000014', 'ff300000-0000-0000-0000-000000000003', 4, 'short_text', 'v_hidden', 'Fantasma',
          '{"question_key":"v_gate","op":"equals","value":"nao"}'::jsonb,
          '{"question_key":"v_gate","op":"equals","value":"sim"}'::jsonb);

-- The legacy config-bound lane (predates FF-3; app.assert_item_bounds / HC061).
insert into public.form_items (id, section_id, position, item_type, question_key, label, config)
  values ('ff300000-0000-0000-0000-000000000015', 'ff300000-0000-0000-0000-000000000003', 5, 'short_text', 'v_bound', 'Limitada',
          '{"minLength": 5}'::jsonb);

-- THE ANTI-VACUITY TWIN for the deadlock-negative: same required_if, but VISIBLE
-- under the same gate value. Without it, "hidden + required_if does not block"
-- would also pass if required_if did nothing at all (a no-regression claim needs
-- an over-grant twin — and the twin has to be able to go red).
insert into public.form_items (id, section_id, position, item_type, question_key, label, visible_when, required_if)
  values ('ff300000-0000-0000-0000-000000000016', 'ff300000-0000-0000-0000-000000000003', 6, 'short_text', 'v_shown', 'Visível',
          '{"question_key":"v_gate","op":"equals","value":"sim"}'::jsonb,
          '{"question_key":"v_gate","op":"equals","value":"sim"}'::jsonb);

insert into public.form_items (id, section_id, position, item_type, label)
  values ('ff300000-0000-0000-0000-000000000020', 'ff300000-0000-0000-0000-000000000004', 0, 'repeating_group', 'Repetições');
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id)
  values ('ff300000-0000-0000-0000-000000000021', 'ff300000-0000-0000-0000-000000000004', 1, 'short_text', 'c_code', 'Código', 'ff300000-0000-0000-0000-000000000020');
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id)
  values ('ff300000-0000-0000-0000-000000000022', 'ff300000-0000-0000-0000-000000000004', 2, 'multiple_choice', 'c_flag', 'Grave?', 'ff300000-0000-0000-0000-000000000020');
insert into public.form_item_options (item_id, position, code, label) values
  ('ff300000-0000-0000-0000-000000000022', 0, 'sim', 'Sim'),
  ('ff300000-0000-0000-0000-000000000022', 1, 'nao', 'Não');
-- Per-instance required_if: reads a sibling IN THE SAME instance.
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id, required_if)
  values ('ff300000-0000-0000-0000-000000000023', 'ff300000-0000-0000-0000-000000000004', 3, 'short_text', 'c_reqif', 'Detalhe', 'ff300000-0000-0000-0000-000000000020',
          '{"question_key":"c_flag","op":"equals","value":"sim"}'::jsonb);

-- ===========================================================================
-- §B · KEYSTONE 5a `rls_validations_reader_non_writer` + THE WRITER DOOR.
--   The GRANT is the boundary: form_item_validations is SELECT-only for
--   `authenticated`, so the same staff_admin who may author this form still
--   cannot touch the table and must go through the DEFINER door.
--   MUTATION: `grant insert, update on public.form_item_validations to
--     authenticated` -> B2/B3 stop raising 42501 and go red.
-- ===========================================================================
select ok(has_table_privilege('authenticated', 'public.form_item_validations', 'SELECT'),
  'B1. authenticated keeps its SELECT grant on form_item_validations');
select ok(not has_table_privilege('authenticated', 'public.form_item_validations', 'INSERT'),
  'B2. authenticated has NO INSERT grant — the writer door is the only way in (K9)');

select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

select throws_ok(
  $q$insert into public.form_item_validations (item_id, form_version_id, position, rule_type, config, severity, message)
     values ('ff300000-0000-0000-0000-000000000011','ff300000-0000-0000-0000-000000000002',0,'number_range','{"min":1}','error','x')$q$,
  '42501', null,
  'B3. a staff_admin cannot INSERT a validation directly — reader, not writer');

reset role;
select test_helpers.claims_for((select st_x from k), false);
set local role authenticated;

-- AUTHORITY FIRST (ADR 0079). A plain `staff` of the SAME commission is refused
-- with 42501, never with an HC0Q domain code: "you may not" must not be reachable
-- through a branch that means "your data is wrong".
--   MUTATION: move the authority block below the payload-shape checks in
--     set_item_validations -> B4 red (it raises HC0Q1/HC0Q2 instead).
select throws_ok(
  $q$select public.set_item_validations('ff300000-0000-0000-0000-000000000011',
       '[{"rule_type":"number_range","config":{"min":5},"severity":"error","message":"m","position":0}]'::jsonb)$q$,
  '42501', null,
  'B4. a plain staff cannot author validations — the denial is 42501, not HC0Q*');

reset role;
select test_helpers.claims_for((select sa_x from k), false);
set local role authenticated;

-- COVERAGE (ADR 0090 ruling 2). Every refusal is HC0Q1.
--   MUTATION: make app.validation_rule_allowed `select true` -> B5..B8 all red.
select throws_ok(
  $q$select public.set_item_validations('ff300000-0000-0000-0000-000000000012',
       '[{"rule_type":"number_range","config":{"min":5},"severity":"error","message":"m","position":0}]'::jsonb)$q$,
  'HC0Q1', null, 'B5. number_range cannot attach to a short_text');

select throws_ok(
  $q$select public.set_item_validations('ff300000-0000-0000-0000-000000000011',
       '[{"rule_type":"text_length","config":{"min":5},"severity":"error","message":"m","position":0}]'::jsonb)$q$,
  'HC0Q1', null, 'B6. text_length cannot attach to a number');

select throws_ok(
  $q$select public.set_item_validations('ff300000-0000-0000-0000-000000000020',
       '[{"rule_type":"text_length","config":{"min":5},"severity":"error","message":"m","position":0}]'::jsonb)$q$,
  'HC0Q1', null, 'B7. a CONTAINER cannot carry a rule');

select throws_ok(
  $q$select public.set_item_validations('ff300000-0000-0000-0000-000000000012',
       '[{"rule_type":"unique_within_group","config":{},"severity":"error","message":"m","position":0}]'::jsonb)$q$,
  'HC0Q1', null,
  'B8. unique_within_group needs a repeating_group PARENT, not just a scalar type');

select throws_ok(
  $q$select public.set_item_validations('ff300000-0000-0000-0000-000000000011',
       '[{"rule_type":"number_rang","config":{"min":5},"severity":"error","message":"m","position":0}]'::jsonb)$q$,
  'HC0Q1', null,
  'B9. a TYPO in rule_type is refused — the exact shape that used to store as "no rule"');

-- CONFIG shape (HC0Q2). B10 is the FF-2 defect-1 shape: a key that is ABSENT must
-- be rejected by the same branch as a key of the wrong type.
--   MUTATION: drop the `(p_config ? 'min' or p_config ? 'max')` clause from
--     app.is_valid_validation_config -> B10 red.
select throws_ok(
  $q$select public.set_item_validations('ff300000-0000-0000-0000-000000000011',
       '[{"rule_type":"number_range","config":{},"severity":"error","message":"m","position":0}]'::jsonb)$q$,
  'HC0Q2', null,
  'B10. a number_range with NEITHER bound is refused (a rule that can never fire)');

select throws_ok(
  $q$select public.set_item_validations('ff300000-0000-0000-0000-000000000011',
       '[{"rule_type":"number_range","config":{"min":10,"max":5},"severity":"error","message":"m","position":0}]'::jsonb)$q$,
  'HC0Q2', null, 'B11. an inverted range (min > max) is refused');

select throws_ok(
  $q$select public.set_item_validations('ff300000-0000-0000-0000-000000000012',
       '[{"rule_type":"regex","config":{"pattern":"^[0-9"},"severity":"error","message":"m","position":0}]'::jsonb)$q$,
  'HC0Q2', null,
  'B12. a regex that does NOT COMPILE is refused at write time, not at submit');

select throws_ok(
  $q$select public.set_item_validations('ff300000-0000-0000-0000-000000000012',
       ('[{"rule_type":"regex","config":{"pattern":"' || repeat('a', 201) ||
        '"},"severity":"error","message":"m","position":0}]')::jsonb)$q$,
  'HC0Q2', null,
  'B13. a regex pattern over 200 chars is refused (the ReDoS blast-radius bound)');

select throws_ok(
  $q$select public.set_item_validations('ff300000-0000-0000-0000-000000000011',
       '[{"rule_type":"number_range","config":{"min":5},"severity":"error","message":"   ","position":0}]'::jsonb)$q$,
  'HC0Q2', null,
  'B14. a BLANK message is refused — a validation with no message is a dead end');

-- The door WORKS. A denial-only section proves nothing (ADR 0079).
select lives_ok(
  $q$select public.set_item_validations('ff300000-0000-0000-0000-000000000011',
       '[{"rule_type":"number_range","config":{"min":5,"max":10},"severity":"error",
          "message":"Informe um valor entre 5 e 10.","position":0}]'::jsonb)$q$,
  'B15. the SAME staff_admin CAN author through set_item_validations (the door works)');

select is(
  (select count(*)::int from public.form_item_validations
    where item_id = 'ff300000-0000-0000-0000-000000000011'),
  1, 'B16. the RPC really persisted the rule (B15 is not a silent no-op)');

-- REPLACE semantics: the payload is the COMPLETE list, not a patch.
select lives_ok(
  $q$select public.set_item_validations('ff300000-0000-0000-0000-000000000011',
       '[{"rule_type":"number_range","config":{"min":5,"max":10},"severity":"error",
          "message":"Informe um valor entre 5 e 10.","position":0},
         {"rule_type":"number_range","config":{"max":99},"severity":"warn",
          "message":"Valor alto.","position":1}]'::jsonb)$q$,
  'B17. a two-rule payload succeeds');
select is(
  (select count(*)::int from public.form_item_validations
    where item_id = 'ff300000-0000-0000-0000-000000000011'),
  2, 'B18. …both rows are stored');

select lives_ok(
  $q$select public.set_item_validations('ff300000-0000-0000-0000-000000000011',
       '[{"rule_type":"number_range","config":{"min":5,"max":10},"severity":"error",
          "message":"Informe um valor entre 5 e 10.","position":0}]'::jsonb)$q$,
  'B19. re-sending a ONE-rule payload succeeds');
select is(
  (select count(*)::int from public.form_item_validations
    where item_id = 'ff300000-0000-0000-0000-000000000011'),
  1, 'B20. …and the omitted rule was DELETED — REPLACE, not patch');

-- The remaining fixture rules, through the same door.
select public.set_item_validations('ff300000-0000-0000-0000-000000000012',
  '[{"rule_type":"text_length","config":{"min":5},"severity":"warn",
     "message":"Descreva com pelo menos 5 caracteres.","position":0}]'::jsonb);
select public.set_item_validations('ff300000-0000-0000-0000-000000000021',
  '[{"rule_type":"unique_within_group","config":{},"severity":"error",
     "message":"Este código já foi usado em outra repetição.","position":0}]'::jsonb);

reset role;

-- ===========================================================================
-- §C · KEYSTONE 5b `validations_door_parity` — asserted against pg_policies,
--   never in prose (ADR 0090 §6). FF-2 handed FF-3 two missing arms; C2/C3 are
--   the proof they landed, and C4/C5 pin the shape against the SIBLING so a
--   future arm added to one table is visible as missing on the other.
--   MUTATION: drop either new policy -> C2 or C3 red.
-- ===========================================================================
select ok(
  exists (select 1 from pg_policies
          where schemaname='public' and tablename='form_item_validations'
            and cmd='SELECT' and qual like '%is_member_of%'),
  'C1. the base member/admin SELECT policy is still there');

select ok(
  exists (select 1 from pg_policies
          where schemaname='public' and tablename='form_item_validations'
            and cmd='SELECT' and qual like '%can_access_targeted_version%'),
  'C2. the targeted-version SELECT arm exists (the FF-2 hand-forward, now closed)');

select ok(
  exists (select 1 from pg_policies
          where schemaname='public' and tablename='form_item_validations'
            and cmd='ALL' and qual like '%is_staff_admin_of%'
            and with_check like '%is_staff_admin_of%'),
  'C3. the staff_admin FOR-ALL write arm exists, USING and WITH CHECK both');

-- The sibling comparison, computed rather than asserted from memory: every
-- policy SHAPE form_item_options carries, form_item_validations now carries.
select is(
  (select count(*)::int from (
     select 1 from pg_policies
      where schemaname='public' and tablename='form_item_options'
        and (qual like '%can_access_targeted_version%' or qual like '%is_staff_admin_of%'
             or qual like '%is_member_of%')
     except all
     select 1 from pg_policies
      where schemaname='public' and tablename='form_item_validations'
        and (qual like '%can_access_targeted_version%' or qual like '%is_staff_admin_of%'
             or qual like '%is_member_of%')
   ) missing),
  0, 'C4. form_item_validations carries no FEWER policy arms than form_item_options');

-- …and the GRANT is still the real boundary, unlike the sibling.
select ok(
  has_table_privilege('authenticated','public.form_item_options','INSERT')
  and not has_table_privilege('authenticated','public.form_item_validations','INSERT'),
  'C5. …while keeping the STRICTER grant: options is DML-granted, validations is not');

-- ===========================================================================
-- Publish, then fill.
-- ===========================================================================
select public.publish_form_version('ff300000-0000-0000-0000-000000000002');

select throws_ok(
  $q$select public.set_item_validations('ff300000-0000-0000-0000-000000000011',
       '[{"rule_type":"number_range","config":{"min":1},"severity":"error","message":"m","position":0}]'::jsonb)$q$,
  'HC0P4', null,
  'C6. a PUBLISHED version refuses new validations (Rule 5, in the writer)');

insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ('ff300000-0000-0000-0000-0000000000a1', 'ff300000-0000-0000-0000-000000000002',
          (select comm_x from k), (select st_x from k), 'in_progress');

-- ===========================================================================
-- §D · KEYSTONE 4 `required_if_completeness`, flat arm + the deadlock-negative.
--   D3 is the OVER-GRANT TWIN: v_shown proves required_if genuinely BLOCKS under
--   the same gate value that leaves v_hidden alone. Without it D4 would also pass
--   if required_if did nothing at all.
--   MUTATION A: pass `null` instead of `i.required_if` in app.item_is_required's
--     flat call site -> D2 and D3 red (nothing blocks any more).
--   MUTATION B: drop the `app.eval_visibility(i.visible_when, ...)` conjunct from
--     the flat arm -> D4 red (the hidden item starts blocking) while D2/D3 stay
--     green — which is what proves D4 tests VISIBILITY and not required_if.
-- ===========================================================================
select ok(app.response_required_complete('ff300000-0000-0000-0000-0000000000a1'),
  'D1. with the gate unanswered nothing is required — required_if is false');

select public.save_section_answers(
  'ff300000-0000-0000-0000-0000000000a1', 'ff300000-0000-0000-0000-000000000003',
  p_selections => '{"ff300000-0000-0000-0000-000000000010":["sim"]}'::jsonb);

select ok(not app.response_required_complete('ff300000-0000-0000-0000-0000000000a1'),
  'D2. gate = "sim" makes v_reqif required — an unanswered required_if BLOCKS');

select public.save_section_answers(
  'ff300000-0000-0000-0000-0000000000a1', 'ff300000-0000-0000-0000-000000000003',
  p_answers => '{"ff300000-0000-0000-0000-000000000013":"porque sim"}'::jsonb);

select ok(not app.response_required_complete('ff300000-0000-0000-0000-0000000000a1'),
  'D3. …and the VISIBLE twin v_shown still blocks — the over-grant twin');

select public.save_section_answers(
  'ff300000-0000-0000-0000-0000000000a1', 'ff300000-0000-0000-0000-000000000003',
  p_answers => '{"ff300000-0000-0000-0000-000000000016":"visível"}'::jsonb);

select ok(app.response_required_complete('ff300000-0000-0000-0000-0000000000a1'),
  'D4. DEADLOCK-NEGATIVE: v_hidden is required_if-TRUE but HIDDEN, and never blocks');

select is(
  (select count(*)::int from public.answers
    where response_id = 'ff300000-0000-0000-0000-0000000000a1'
      and item_id = 'ff300000-0000-0000-0000-000000000014'),
  0, 'D5. …and v_hidden really is unanswered (D4 is not passing because it was filled)');

-- ===========================================================================
-- §F · KEYSTONE 3 `save_never_blocks_on_validation` — the resume contract.
--   A draft must always be saveable mid-edit; a partially typed value that failed
--   to persist on navigation would break Rule 3's resume guarantee.
--   MUTATION: add the HC0P9 gate to save_section_answers -> F1 red.
-- ===========================================================================
select lives_ok(
  $q$select public.save_section_answers(
      'ff300000-0000-0000-0000-0000000000a1', 'ff300000-0000-0000-0000-000000000003',
      p_answers => '{"ff300000-0000-0000-0000-000000000011":3}'::jsonb)$q$,
  'F1. save_section_answers persists a value that VIOLATES an error rule');
select is(
  (select a.value from public.answers a
    where a.response_id = 'ff300000-0000-0000-0000-0000000000a1'
      and a.item_id = 'ff300000-0000-0000-0000-000000000011'),
  '3'::jsonb, 'F2. …and the violating value really is stored (F1 is not a silent drop)');

-- ===========================================================================
-- §E · KEYSTONE 2 `submit_blocked_error_not_warn` + the shared error surface.
--   MUTATION A: delete the HC0P9 block from submit_response -> E1 red.
--   MUTATION B: drop the `severity = 'error'` filter in that block -> E4 red (the
--     warn-only response stops submitting), which is what proves E4 is about
--     SEVERITY and not about "no violations at all".
-- ===========================================================================
select throws_ok(
  $q$select public.submit_response('ff300000-0000-0000-0000-0000000000a1')$q$,
  'HC0P9', null,
  'E1. an error-severity rule BLOCKS submit with HC0P9');

select is(
  (select count(*)::int from public.get_response_validation_errors('ff300000-0000-0000-0000-0000000000a1')
    where item_id = 'ff300000-0000-0000-0000-000000000011'
      and severity = 'error' and rule_id is not null),
  1, 'E2. the read path reports the SAME violation the gate blocked on');

select is(
  (select message from public.get_response_validation_errors('ff300000-0000-0000-0000-0000000000a1')
    where item_id = 'ff300000-0000-0000-0000-000000000011'),
  'Informe um valor entre 5 e 10.',
  'E3. …with the author''s own pt-BR message, not a generic string');

-- Fix the error, introduce a WARN violation in the same breath.
select public.save_section_answers(
  'ff300000-0000-0000-0000-0000000000a1', 'ff300000-0000-0000-0000-000000000003',
  p_answers => '{"ff300000-0000-0000-0000-000000000011":7,
                 "ff300000-0000-0000-0000-000000000012":"abc"}'::jsonb);

select is(
  (select count(*)::int from public.get_response_validation_errors('ff300000-0000-0000-0000-0000000000a1')
    where item_id = 'ff300000-0000-0000-0000-000000000012' and severity = 'warn'),
  1, 'E4. the warn violation IS reported (the wizard can badge it)');

select lives_ok(
  $q$select public.submit_response('ff300000-0000-0000-0000-0000000000a1')$q$,
  'E5. …and a warn NEVER blocks: the same response submits');

-- ===========================================================================
-- §J · The error surface includes the LEGACY config-bound lane.
--   Without this the wizard could show an EMPTY list while submit_response
--   refuses with HC061 — the exact failure ADR 0090 §3's contract exists to
--   prevent, and the reason app.assert_item_bounds was extracted.
--   MUTATION: delete the app.item_bound_violations loop from
--     app.response_validation_errors -> J1/J2 red while J3 stays green.
-- ===========================================================================
insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ('ff300000-0000-0000-0000-0000000000a3', 'ff300000-0000-0000-0000-000000000002',
          (select comm_x from k), (select sa_x from k), 'in_progress');
select public.save_section_answers(
  'ff300000-0000-0000-0000-0000000000a3', 'ff300000-0000-0000-0000-000000000003',
  p_answers => '{"ff300000-0000-0000-0000-000000000015":"abc"}'::jsonb);

select is(
  (select count(*)::int from public.get_response_validation_errors('ff300000-0000-0000-0000-0000000000a3')
    where item_id = 'ff300000-0000-0000-0000-000000000015'
      and rule_id is null and rule_type = 'text_length' and severity = 'error'),
  1, 'J1. a config minLength violation appears in the list with rule_id NULL');

select is(
  (select message from public.get_response_validation_errors('ff300000-0000-0000-0000-0000000000a3')
    where item_id = 'ff300000-0000-0000-0000-000000000015'),
  'a pergunta "Limitada" exige ao menos 5 caractere(s)',
  'J2. …with the SAME pt-BR text app.assert_item_bounds raises (one source of truth)');

select throws_ok(
  $q$select public.submit_response('ff300000-0000-0000-0000-0000000000a3')$q$,
  'HC061', null,
  'J3. …and the legacy lane still raises HC061, not HC0P9 (no behaviour moved)');

-- ===========================================================================
-- §D-group + §I · the per-instance arms.
--   KEYSTONE 4 (group half) and KEYSTONE 8 `unique_within_group_instances`.
--   MUTATION A: pass `null` instead of `c.required_if` in the GROUP arm of
--     app.response_required_complete -> D6 red, D1..D5 stay green — which is what
--     proves the flat-arm keystones are blind to the group arm.
--   MUTATION B: pass `'[]'::jsonb` as p_peer_values in the group loop of
--     app.response_validation_errors -> I1/I2 red.
--   MUTATION C: drop `and not app.instance_is_empty(...)` from the v_maps query
--     -> I3 red (an emptied instance starts colliding again).
-- ===========================================================================
insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ('ff300000-0000-0000-0000-0000000000a2', 'ff300000-0000-0000-0000-000000000002',
          (select comm_x from k), (select st_x2 from k), 'in_progress');
insert into public.response_group_instances (id, response_id, group_item_id, position) values
  ('ff300000-0000-0000-0000-0000000000b1', 'ff300000-0000-0000-0000-0000000000a2', 'ff300000-0000-0000-0000-000000000020', 0),
  ('ff300000-0000-0000-0000-0000000000b2', 'ff300000-0000-0000-0000-0000000000a2', 'ff300000-0000-0000-0000-000000000020', 1);

-- instance 1: c_flag = sim  -> c_reqif required IN THIS INSTANCE ONLY.
-- instance 2: c_flag = nao  -> c_reqif not required there.
select public.save_section_answers(
  'ff300000-0000-0000-0000-0000000000a2', 'ff300000-0000-0000-0000-000000000004',
  p_instance_answers => '[
    {"instance_id":"ff300000-0000-0000-0000-0000000000b1",
     "answers":{"ff300000-0000-0000-0000-000000000021":"AAA"},
     "selections":{"ff300000-0000-0000-0000-000000000022":["sim"]}},
    {"instance_id":"ff300000-0000-0000-0000-0000000000b2",
     "answers":{"ff300000-0000-0000-0000-000000000021":"BBB"},
     "selections":{"ff300000-0000-0000-0000-000000000022":["nao"]}}
  ]'::jsonb);

select ok(not app.response_required_complete('ff300000-0000-0000-0000-0000000000a2'),
  'D6. GROUP ARM: required_if true in instance 1 blocks while instance 2 is fine');

select public.save_section_answers(
  'ff300000-0000-0000-0000-0000000000a2', 'ff300000-0000-0000-0000-000000000004',
  p_instance_answers => '[
    {"instance_id":"ff300000-0000-0000-0000-0000000000b1",
     "answers":{"ff300000-0000-0000-0000-000000000023":"detalhe"}}
  ]'::jsonb);

select ok(app.response_required_complete('ff300000-0000-0000-0000-0000000000a2'),
  'D7. …answering it in THAT instance clears it; instance 2 never needed it');

select is(
  (select count(*)::int from public.answers
    where response_id = 'ff300000-0000-0000-0000-0000000000a2'
      and item_id = 'ff300000-0000-0000-0000-000000000023'),
  1, 'D8. …and only ONE instance holds that answer (the map is per-instance)');

select is(
  (select count(*)::int from public.get_response_validation_errors('ff300000-0000-0000-0000-0000000000a2')
    where rule_type = 'unique_within_group'),
  0, 'I1. distinct c_code values across instances: no unique violation');

-- Make them collide.
select public.save_section_answers(
  'ff300000-0000-0000-0000-0000000000a2', 'ff300000-0000-0000-0000-000000000004',
  p_instance_answers => '[
    {"instance_id":"ff300000-0000-0000-0000-0000000000b2",
     "answers":{"ff300000-0000-0000-0000-000000000021":"AAA"}}
  ]'::jsonb);

select is(
  (select count(*)::int from public.get_response_validation_errors('ff300000-0000-0000-0000-0000000000a2')
    where rule_type = 'unique_within_group' and severity = 'error'),
  2, 'I2. a duplicate across two non-empty instances violates — on BOTH instances');

select throws_ok(
  $q$select public.submit_response('ff300000-0000-0000-0000-0000000000a2')$q$,
  'HC0P9', null, 'I3. …and it blocks the submit');

-- Empty instance 2 completely: an EMPTIED instance is not "in the group"
-- (submit_response prunes it), so the value it held cannot collide.
delete from public.answers
 where response_id = 'ff300000-0000-0000-0000-0000000000a2'
   and group_instance_id = 'ff300000-0000-0000-0000-0000000000b2';

select is(
  (select count(*)::int from public.get_response_validation_errors('ff300000-0000-0000-0000-0000000000a2')
    where rule_type = 'unique_within_group'),
  0, 'I4. the same value in an EMPTIED instance does not violate');

-- ===========================================================================
-- §G · KEYSTONE 6 `clone_copies_validations` (INFO-1 remainder closed).
--   MUTATION: delete the form_item_validations block from
--     app.copy_version_children -> G1/G3 red.
-- ===========================================================================
create temp table cl on commit drop as
  select public.clone_form_version('ff300000-0000-0000-0000-000000000002') as new_ver;

select is(
  (select count(*)::int from public.form_item_validations v
    where v.form_version_id = (select new_ver from cl)),
  (select count(*)::int from public.form_item_validations v
    where v.form_version_id = 'ff300000-0000-0000-0000-000000000002'),
  'G1. the clone carries the same NUMBER of validation rules as the source');

select cmp_ok(
  (select count(*)::int from public.form_item_validations v
    where v.form_version_id = (select new_ver from cl)),
  '>=', 2,
  'G2. …and that number is not zero-equals-zero');

select is(
  (select v.message from public.form_item_validations v
   join public.form_items i on i.id = v.item_id
   where v.form_version_id = (select new_ver from cl) and i.question_key = 'v_num'),
  'Informe um valor entre 5 e 10.',
  'G3. …with config/severity/message carried over, keyed by question_key');

select is(
  (select i.required_if from public.form_items i
    where i.form_version_id = (select new_ver from cl) and i.question_key = 'v_reqif'),
  '{"op": "equals", "value": "sim", "question_key": "v_gate"}'::jsonb,
  'G4. required_if is deep-copied too — a clone that lost it would silently drop a rule');

select is(
  (select count(*)::int from public.form_item_validations v
    where v.form_version_id = 'ff300000-0000-0000-0000-000000000002'),
  3, 'G5. the SOURCE (published) version is untouched by the clone (Rule 5)');

-- ===========================================================================
-- §H · KEYSTONE 7 `operators_authorable` — B5's widening of is_valid_condition.
--   MUTATION: revert app.is_valid_condition to the 7-operator list -> H1..H4 red.
--   MUTATION: relax `value` for ALL ops instead of the two unary ones -> H7 red.
-- ===========================================================================
select ok(app.is_valid_condition('{"question_key":"q","op":"contains","value":"x"}'::jsonb),
  'H1. `contains` is now storable');
select ok(app.is_valid_condition('{"question_key":"q","op":"not_contains","value":"x"}'::jsonb),
  'H2. `not_contains` is now storable');
select ok(app.is_valid_condition('{"question_key":"q","op":"is_empty"}'::jsonb),
  'H3. `is_empty` is storable WITHOUT a value (it is unary)');
select ok(app.is_valid_condition('{"question_key":"q","op":"is_not_empty"}'::jsonb),
  'H4. `is_not_empty` likewise');
select ok(not app.is_valid_condition('{"question_key":"q","op":"nonsense","value":"x"}'::jsonb),
  'H5. a bogus operator is still refused');
select ok(not app.is_valid_condition('{"question_key":"q","op":"equals"}'::jsonb),
  'H6. `equals` without a value is STILL refused — the relaxation is not global');
select ok(app.is_valid_condition('{"question_key":"q","op":"equals","value":"x"}'::jsonb),
  'H7. the seven pre-existing operators are unaffected');

-- ===========================================================================
-- §K · The MISSING ARM found while writing this file: publish must validate
--   required_if exactly as it validates visible_when. A required_if pointing at a
--   repeating-group child from OUTSIDE resolves against a map where that key is
--   absent, so the item is silently NEVER required — it fails OPEN, and a test
--   that only checks "does an unmet required_if block" cannot see it.
--   MUTATION: revert validate_visible_when to the visible_when-only loop
--     -> K1/K2/K3 red (all three publishes start succeeding).
-- ===========================================================================
insert into public.forms (id, commission_id, title, created_by)
  values ('ff300000-0000-0000-0000-000000000031', (select comm_x from k), 'FF3-K', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('ff300000-0000-0000-0000-000000000032', 'ff300000-0000-0000-0000-000000000031', 1, 'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
  values ('ff300000-0000-0000-0000-000000000033', 'ff300000-0000-0000-0000-000000000032', 0, true);
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff300000-0000-0000-0000-000000000034', 'ff300000-0000-0000-0000-000000000033', 0, 'short_text', 'k_gate', 'Gate');
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff300000-0000-0000-0000-000000000035', 'ff300000-0000-0000-0000-000000000033', 1, 'short_text', 'k_dep', 'Dep');
insert into public.form_items (id, section_id, position, item_type, label)
  values ('ff300000-0000-0000-0000-000000000036', 'ff300000-0000-0000-0000-000000000033', 2, 'repeating_group', 'Bloco K');
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id)
  values ('ff300000-0000-0000-0000-000000000037', 'ff300000-0000-0000-0000-000000000033', 3, 'short_text', 'k_inner', 'Interno', 'ff300000-0000-0000-0000-000000000036');

update public.form_items
   set required_if = '{"question_key":"k_missing","op":"equals","value":"x"}'::jsonb
 where id = 'ff300000-0000-0000-0000-000000000035';
select throws_ok(
  $q$select public.publish_form_version('ff300000-0000-0000-0000-000000000032')$q$,
  '23514', null,
  'K1. publish refuses a required_if referencing a question that does not exist');

update public.form_items
   set required_if = '{"question_key":"k_inner","op":"equals","value":"x"}'::jsonb
 where id = 'ff300000-0000-0000-0000-000000000035';
select throws_ok(
  $q$select public.publish_form_version('ff300000-0000-0000-0000-000000000032')$q$,
  '23514', null,
  'K2. …and one pointing INTO a repeating group from outside (the fail-open case)');

update public.form_items
   set required_if = '{"question_key":"k_dep","op":"equals","value":"x"}'::jsonb
 where id = 'ff300000-0000-0000-0000-000000000034';
update public.form_items
   set required_if = null
 where id = 'ff300000-0000-0000-0000-000000000035';
select throws_ok(
  $q$select public.publish_form_version('ff300000-0000-0000-0000-000000000032')$q$,
  '23514', null,
  'K3. …and one referencing a LATER question in the form');

-- The unary operator round-trips through the CHECK and through publish.
update public.form_items
   set required_if = '{"question_key":"k_gate","op":"is_not_empty"}'::jsonb
 where id = 'ff300000-0000-0000-0000-000000000035';
update public.form_items set required_if = null
 where id = 'ff300000-0000-0000-0000-000000000034';
select lives_ok(
  $q$select public.publish_form_version('ff300000-0000-0000-0000-000000000032')$q$,
  'K4. a legal required_if — unary operator, earlier question — publishes');

select * from finish();
rollback;
