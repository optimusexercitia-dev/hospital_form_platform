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

select plan(89);

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
-- §M · THE MIXED SET — one call, BOTH severities, all three violation shapes.
--
--   Asked for by `frontend`: F2 badges `warn` rows in review AND places them on
--   fields after an HC0P9 refusal, so a read path that ever narrowed to errors
--   would silently strip every advisory from the UI with no type change and no
--   test red on their side.
--
--   ⚠ WHY THIS IS NOT ALREADY COVERED, stated precisely — the reason it earns a
--   section rather than a comment. Narrowing the read path to `severity='error'`
--   DOES turn E4 red today, and truncating it (`limit 1`) DOES turn I2/I5 red;
--   both were mutation-checked before writing this. What no existing assertion
--   sees is a MIXED set: E2's state holds only errors (v_txt is still blank) and
--   E4's holds only warns (v_num has been fixed by then), so a read path that
--   suppressed warns WHILE errors exist — the shape a "only report what blocks"
--   refactor would produce — passes every one of them. This is the same class as
--   the P0 in 20260901000700: a narrowing that fails invisibly downstream.
--
--   `a3` is deliberate. It is the ONLY response left in_progress after its submit
--   (J3 throws HC061), and it already carries a CONFIG-BOUND violation, so adding
--   two authored rules gives all three shapes at once: authored error, authored
--   warn, and legacy bound (`rule_id is null`).
--
--   MUTATIONS RUN, with the OBSERVED output — not the predicted output. Two of my
--   three predictions were wrong, and the corrections are the interesting part:
--
--   A · `where v.e_severity = 'error'` on the read path
--       -> E4, M1, M2 red. **M3 stays GREEN**, which I had predicted red: the
--          config-bound rows carry severity 'error', so narrowing to errors keeps
--          them. M3 is about the `rule_id is null` LANE, not about severity.
--
--   B · suppress warns only WHILE an error exists (the "only report what blocks"
--       refactor — plausible, well-intentioned, and it strips every advisory from
--       the wizard exactly when the user needs one)
--       -> **M1, M2 red and NOTHING ELSE. E2, E4, I2 and I5 all stay GREEN.**
--          This is the whole justification for §M, and it is the one prediction
--          that held. Verified in both directions on a clean catalog.
--
--   C · `where v.e_rule_id is not null`
--       -> J1, J2, M2, M3 red. I had predicted "M3 alone"; M2 also reds because it
--          pins the exact 1 warn / 2 errors split, and one of those errors IS the
--          config-bound row. Recorded so nobody reads M2 as severity-only.
-- ===========================================================================
select public.save_section_answers(
  'ff300000-0000-0000-0000-0000000000a3', 'ff300000-0000-0000-0000-000000000003',
  p_answers => '{"ff300000-0000-0000-0000-000000000011":3,
                 "ff300000-0000-0000-0000-000000000012":"ab"}'::jsonb);

select is(
  (select count(distinct severity)::int
     from public.get_response_validation_errors('ff300000-0000-0000-0000-0000000000a3')),
  2, 'M1. ONE call returns BOTH severities — an error and a warn together');

select is(
  (select count(*) filter (where severity = 'warn')::int || '/' ||
          count(*) filter (where severity = 'error')::int
     from public.get_response_validation_errors('ff300000-0000-0000-0000-0000000000a3')),
  '1/2',
  'M2. …the warn survives ALONGSIDE the errors (1 warn, 2 errors), not instead of them');

select is(
  (select count(*)::int
     from public.get_response_validation_errors('ff300000-0000-0000-0000-0000000000a3')
    where rule_id is null),
  1, 'M3. …and the legacy config-bound row (rule_id NULL) is in the SAME list');

-- ===========================================================================
-- §D-group + §I · the per-instance arms.
--   KEYSTONE 4 (group half) and KEYSTONE 8 `unique_within_group_instances`.
--   MUTATION A: pass `null` instead of `c.required_if` in the GROUP arm of
--     app.response_required_complete -> D6 red, D1..D5 stay green — which is what
--     proves the flat-arm keystones are blind to the group arm.
--   MUTATION B: pass `'[]'::jsonb` as p_peer_values in the group loop of
--     app.response_validation_errors -> I2/I3/I5 red.
--
--   ⚠ NO KEYSTONE COVERS the `and not app.instance_is_empty(...)` filter on the
--   v_maps query, and the honest reason is that it CANNOT be observed. Dropping it
--   was tried as a mutation and changed nothing: an instance that is empty holds
--   no non-null value, so it can never contribute a peer in the first place. The
--   filter is kept for parity with the instance loop in
--   app.response_required_complete, not because a test can see it. Recording that
--   beats writing an assertion that passes for a reason unrelated to its name —
--   this file lost one that way (an earlier I4 asserted the filter and stayed
--   green with the filter removed).
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

-- Empty instance 2 completely. The peers come from the ANSWER MAPS in scope, so
-- the value instance 2 used to hold stops colliding.
delete from public.answers
 where response_id = 'ff300000-0000-0000-0000-0000000000a2'
   and group_instance_id = 'ff300000-0000-0000-0000-0000000000b2';

select is(
  (select count(*)::int from public.get_response_validation_errors('ff300000-0000-0000-0000-0000000000a2')
    where rule_type = 'unique_within_group'),
  0, 'I4. emptying instance 2 removes the collision');

-- …and re-filling it with the SAME value brings the violation back. Without this
-- half, I4 would also pass if the walker had simply stopped reporting ANYTHING
-- after the delete — 0 = 0 is exactly the vacuity this pair exists to rule out.
select public.save_section_answers(
  'ff300000-0000-0000-0000-0000000000a2', 'ff300000-0000-0000-0000-000000000004',
  p_instance_answers => '[
    {"instance_id":"ff300000-0000-0000-0000-0000000000b2",
     "answers":{"ff300000-0000-0000-0000-000000000021":"AAA"}}
  ]'::jsonb);

select is(
  (select count(*)::int from public.get_response_validation_errors('ff300000-0000-0000-0000-0000000000a2')
    where rule_type = 'unique_within_group' and severity = 'error'),
  2, 'I5. re-filling instance 2 with the same value restores the violation on both');

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

-- ===========================================================================
-- §L · B5 DEFECT (found by `frontend`): the unary ops were STORABLE but
--   UNPUBLISHABLE. `app.is_valid_condition` was widened by 20260901000500;
--   `app.assert_condition_op_target` and `app.assert_condition_value_codes` —
--   both run by publish, over every condition — were not. A choice-target
--   `is_empty` raised 'referencia a opção "nula"', naming an option the author
--   never wrote.
--
--   L1/L2 are the arms that RAISED. L3/L4 are the ANTI-VACUITY TWINS: the same
--   two guards must still bite for the operators that DO carry a value, or "the
--   guard was removed" would pass this section just as well as "the guard learned
--   about unary ops".
--
--   MUTATION A: drop the `is_empty/is_not_empty` early return from
--     app.assert_condition_op_target -> L1 red, L3 green.
--   MUTATION B: drop it from app.assert_condition_value_codes -> L2 red, L4 green.
--   MUTATION C: replace either early return with `return` unconditionally ->
--     L3 or L4 red while L1/L2 stay green. That pair is what makes these
--     keystones about the EXEMPTION rather than about the guard existing.
-- ===========================================================================
select lives_ok(
  $q$select app.assert_condition_op_target('is_empty', 'number', null, 'ctx')$q$,
  'L1. is_empty on a NUMBER target passes op/target validation (no value to give)');

select lives_ok(
  $q$select app.assert_condition_value_codes(
      '00000000-0000-0000-0000-000000000000'::uuid, 'q', 'multiple_choice',
      null, 'ctx', 'is_empty')$q$,
  'L2. is_empty on a CHOICE target references no option code — the arm that raised');

select throws_ok(
  $q$select app.assert_condition_op_target('equals', 'number', '"x"'::jsonb, 'ctx')$q$,
  '23514', null,
  'L3. TWIN — equals on a number target STILL requires a numeric value');

select throws_ok(
  $q$select app.assert_condition_value_codes(
      '00000000-0000-0000-0000-000000000000'::uuid, 'q', 'multiple_choice',
      '"ghost"'::jsonb, 'ctx', 'equals')$q$,
  '23514', null,
  'L4. TWIN — equals on a choice target STILL requires the option code to exist');

-- End to end: a required_if carrying is_empty on a CHOICE question PUBLISHES.
-- That is the exact combination the defect made unreachable, and it is invisible
-- to any test that only exercises date/time targets.
insert into public.forms (id, commission_id, title, created_by)
  values ('ff300000-0000-0000-0000-000000000041', (select comm_x from k), 'FF3-L', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('ff300000-0000-0000-0000-000000000042', 'ff300000-0000-0000-0000-000000000041', 1, 'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
  values ('ff300000-0000-0000-0000-000000000043', 'ff300000-0000-0000-0000-000000000042', 0, true);
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff300000-0000-0000-0000-000000000044', 'ff300000-0000-0000-0000-000000000043', 0, 'multiple_choice', 'l_alergias', 'Alergias');
insert into public.form_item_options (item_id, position, code, label) values
  ('ff300000-0000-0000-0000-000000000044', 0, 'sim', 'Sim'),
  ('ff300000-0000-0000-0000-000000000044', 1, 'nao', 'Não');
insert into public.form_items (id, section_id, position, item_type, question_key, label, required_if)
  values ('ff300000-0000-0000-0000-000000000045', 'ff300000-0000-0000-0000-000000000043', 1, 'short_text', 'l_just', 'Justificativa',
          '{"question_key":"l_alergias","op":"is_empty"}'::jsonb);

select lives_ok(
  $q$select public.publish_form_version('ff300000-0000-0000-0000-000000000042')$q$,
  'L5. a required_if with is_empty on a CHOICE question PUBLISHES (the reported dead end)');

select is(
  (select i.required_if from public.form_items i
    where i.id = 'ff300000-0000-0000-0000-000000000045'),
  '{"op": "is_empty", "question_key": "l_alergias"}'::jsonb,
  'L6. …and it round-trips with no `value` key — the unary shape is stored as authored');

-- L7/L8 · THE SECTION ARM. `public.validate_visible_when` calls
--   app.assert_condition_value_codes TWICE — once per section condition, once per
--   item condition — and they do not share a call text. The first cut of
--   20260901000700 rewrote only the ITEM site; because plpgsql resolves calls at
--   EXECUTION time, the migration applied cleanly and publish then failed with a
--   raw 42883 for ANY form carrying a section condition — a path shipped long
--   before FF-3. The item-arm keystones above were green throughout.
--
--   `test_helpers.bootstrap()` publishes a sectioned form with a section
--   condition, so the whole suite goes red on a regression here (it did: 76/76).
--   That is a blunt net, and it only covers `equals`. L7 covers the SECTION arm
--   with the UNARY operator on a CHOICE target — the combination that has both a
--   second call site and the exemption.
--   MUTATION: remove `, v_op` from the SECTION call site -> L7 red (42883).
insert into public.forms (id, commission_id, title, created_by)
  values ('ff300000-0000-0000-0000-000000000051', (select comm_x from k), 'FF3-L7', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('ff300000-0000-0000-0000-000000000052', 'ff300000-0000-0000-0000-000000000051', 1, 'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
  values ('ff300000-0000-0000-0000-000000000053', 'ff300000-0000-0000-0000-000000000052', 0, true);
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff300000-0000-0000-0000-000000000054', 'ff300000-0000-0000-0000-000000000053', 0, 'multiple_choice', 'l7_gate', 'Alergias');
insert into public.form_item_options (item_id, position, code, label) values
  ('ff300000-0000-0000-0000-000000000054', 0, 'sim', 'Sim'),
  ('ff300000-0000-0000-0000-000000000054', 1, 'nao', 'Não');
-- The SECOND section carries the condition — a section condition must reference
-- an earlier section, and the first section may not carry one at all.
insert into public.form_sections (id, form_version_id, position, title, visible_when)
  values ('ff300000-0000-0000-0000-000000000055', 'ff300000-0000-0000-0000-000000000052', 1, 'Detalhes',
          '{"question_key":"l7_gate","op":"is_empty"}'::jsonb);
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff300000-0000-0000-0000-000000000056', 'ff300000-0000-0000-0000-000000000055', 0, 'short_text', 'l7_det', 'Detalhe');

select lives_ok(
  $q$select public.publish_form_version('ff300000-0000-0000-0000-000000000052')$q$,
  'L7. SECTION arm — a section visible_when with is_empty on a CHOICE target publishes');

select is(
  (select s.visible_when from public.form_sections s
    where s.id = 'ff300000-0000-0000-0000-000000000055'),
  '{"op": "is_empty", "question_key": "l7_gate"}'::jsonb,
  'L8. …and the section condition round-trips unchanged');

-- ===========================================================================
-- §N · `required_if` on a MATRIX - the arm I enabled and never keystoned.
--
--   `parseItemFields` lets a matrix carry `required_if` on purpose (the shape
--   CHECK excludes only `reference`, containers and display items), and
--   `app.item_is_required` is applied with NO `item_type` filter, so the flat and
--   per-instance arms both reach `app.item_required_satisfied`'s ROW-COMPLETE
--   branch. Every `required_if` assertion in §D above uses `short_text`, so the
--   whole matrix pairing was unasserted - a branch that works, that nothing
--   proves, and that no test would catch regressing.
--
--   VERIFIED BEFORE WRITING, not reasoned: a throwaway rolled-back probe drove
--   publish -> fill -> submit and observed required_complete t/f/f/t and HC011 in
--   the predicted places. It is a COVERAGE gap, not a defect.
--
--   Its own form/version, so §D-§L are untouched. Folding a required-capable
--   matrix into the shared fixture would have flipped D4 (the gate that makes
--   `v_reqif` required is the same gate) - the section would have "passed" by
--   breaking its neighbours.
--
--   MUTATIONS RUN, with the OBSERVED output. Two predictions were wrong again, and
--   the first correction is the one worth reading:
--
--   A · `and i.item_type <> 'matrix'` on the FLAT arm's `app.item_is_required`
--       conjunct in `app.response_required_complete`
--       -> N2, N3 red. **N4 stays GREEN**, which I predicted red - and that is the
--          finding: N4 goes through `submit_response`, which holds its OWN COPY of
--          the required_if logic. `response_required_complete` and
--          `submit_response` are TWO sites, so a mutation to one cannot red an
--          assertion that exercises the other. Same one-of-N-sites family as the
--          `validate_visible_when` call site in `20260901000700`. Mutation D below
--          exists only because this one revealed the second site.
--       -> **No §D assertion red**, which is the redundancy answer: §D is
--          structurally blind to the matrix pairing, so §N is not decorative.
--
--   B · the same filter on the GROUP arm
--       -> N7 red ALONE. Again no §D assertion red.
--
--   C · drop the `app.eval_visibility(i.visible_when, ...)` conjunct from the flat
--       arm
--       -> D4, N5 red (both deadlock-negatives, at two different item types) and
--          N8 as collateral. **N6 stays GREEN** - predicted red. N6 counts stored
--          cells and does not consult the predicate at all, which is exactly why
--          it is a usable anti-vacuity companion to N5 rather than a duplicate of
--          it.
--
--   D · `and r_item.item_type <> 'matrix'` on **`submit_response`'s** flat arm
--       -> N4 red with `caught: no exception / wanted: HC011`, plus 4 NOT-RUN:
--          once submit stops refusing, the response is submitted and the next
--          `save_section_answers` aborts the file. pg_prove reports that as
--          "Failed 5/89" = 1 failed + 4 never reached; the real red is N4.
-- ===========================================================================
insert into public.forms (id, commission_id, title, created_by)
  values ('ff300000-0000-0000-0000-000000000071', (select comm_x from k), 'FF3-N', (select sa_x from k));
insert into public.form_versions (id, form_id, version_number, status)
  values ('ff300000-0000-0000-0000-000000000072', 'ff300000-0000-0000-0000-000000000071', 1, 'draft');
insert into public.form_sections (id, form_version_id, position, is_default)
  values ('ff300000-0000-0000-0000-000000000073', 'ff300000-0000-0000-0000-000000000072', 0, true);
insert into public.form_sections (id, form_version_id, position, title)
  values ('ff300000-0000-0000-0000-000000000077', 'ff300000-0000-0000-0000-000000000072', 1, 'Bloco N');

-- sec 0 / pos 0 - the gate both required_ifs read.
insert into public.form_items (id, section_id, position, item_type, question_key, label)
  values ('ff300000-0000-0000-0000-000000000074', 'ff300000-0000-0000-0000-000000000073', 0, 'multiple_choice', 'n_gate', 'Porta N');
insert into public.form_item_options (item_id, position, code, label) values
  ('ff300000-0000-0000-0000-000000000074', 0, 'sim', 'Sim'),
  ('ff300000-0000-0000-0000-000000000074', 1, 'nao', 'Não');

-- sec 0 / pos 1 - a matrix required ONLY when the gate says "sim". `required` is
-- false, so every block below is required_if's doing and nothing else.
insert into public.form_items (id, section_id, position, item_type, question_key, label, required, required_if)
  values ('ff300000-0000-0000-0000-000000000075', 'ff300000-0000-0000-0000-000000000073', 1, 'matrix', 'n_mx', 'Grade', false,
          '{"question_key":"n_gate","op":"equals","value":"sim"}'::jsonb);
insert into public.form_matrix_rows (item_id, form_version_id, position, code, label) values
  ('ff300000-0000-0000-0000-000000000075', 'ff300000-0000-0000-0000-000000000072', 0, 'r1', 'Linha 1'),
  ('ff300000-0000-0000-0000-000000000075', 'ff300000-0000-0000-0000-000000000072', 1, 'r2', 'Linha 2');
insert into public.form_matrix_columns (item_id, form_version_id, position, code, label) values
  ('ff300000-0000-0000-0000-000000000075', 'ff300000-0000-0000-0000-000000000072', 0, 'ok', 'Conforme'),
  ('ff300000-0000-0000-0000-000000000075', 'ff300000-0000-0000-0000-000000000072', 1, 'nok', 'Não conforme');

-- sec 0 / pos 2 - THE DEADLOCK-NEGATIVE MATRIX: visible only when the gate says
-- "nao", required only when it says "sim". The two can never both hold, so with
-- gate = "sim" it is hidden AND required_if-true, with an empty grid.
insert into public.form_items (id, section_id, position, item_type, question_key, label, required, visible_when, required_if)
  values ('ff300000-0000-0000-0000-000000000076', 'ff300000-0000-0000-0000-000000000073', 2, 'matrix', 'n_mx_oculta', 'Grade oculta', false,
          '{"question_key":"n_gate","op":"equals","value":"nao"}'::jsonb,
          '{"question_key":"n_gate","op":"equals","value":"sim"}'::jsonb);
insert into public.form_matrix_rows (item_id, form_version_id, position, code, label) values
  ('ff300000-0000-0000-0000-000000000076', 'ff300000-0000-0000-0000-000000000072', 0, 'h1', 'Linha oculta');
insert into public.form_matrix_columns (item_id, form_version_id, position, code, label) values
  ('ff300000-0000-0000-0000-000000000076', 'ff300000-0000-0000-0000-000000000072', 0, 'hok', 'OK');

-- sec 1 - the per-instance arm. Children contiguous after the container, and the
-- matrix's required_if reads a sibling IN THE SAME instance (inside-out).
insert into public.form_items (id, section_id, position, item_type, label)
  values ('ff300000-0000-0000-0000-000000000078', 'ff300000-0000-0000-0000-000000000077', 0, 'repeating_group', 'Repetições N');
insert into public.form_items (id, section_id, position, item_type, question_key, label, parent_item_id)
  values ('ff300000-0000-0000-0000-000000000079', 'ff300000-0000-0000-0000-000000000077', 1, 'multiple_choice', 'n_c_flag', 'Grave?', 'ff300000-0000-0000-0000-000000000078');
insert into public.form_item_options (item_id, position, code, label) values
  ('ff300000-0000-0000-0000-000000000079', 0, 'sim', 'Sim'),
  ('ff300000-0000-0000-0000-000000000079', 1, 'nao', 'Não');
insert into public.form_items (id, section_id, position, item_type, question_key, label, required, parent_item_id, required_if)
  values ('ff300000-0000-0000-0000-00000000007a', 'ff300000-0000-0000-0000-000000000077', 2, 'matrix', 'n_c_mx', 'Grade do bloco', false, 'ff300000-0000-0000-0000-000000000078',
          '{"question_key":"n_c_flag","op":"equals","value":"sim"}'::jsonb);
insert into public.form_matrix_rows (item_id, form_version_id, position, code, label) values
  ('ff300000-0000-0000-0000-00000000007a', 'ff300000-0000-0000-0000-000000000072', 0, 'i1', 'Linha A');
insert into public.form_matrix_columns (item_id, form_version_id, position, code, label) values
  ('ff300000-0000-0000-0000-00000000007a', 'ff300000-0000-0000-0000-000000000072', 0, 'ia', 'A');

select public.publish_form_version('ff300000-0000-0000-0000-000000000072');

insert into public.responses (id, form_version_id, commission_id, created_by, status)
  values ('ff300000-0000-0000-0000-00000000007b', 'ff300000-0000-0000-0000-000000000072',
          (select comm_x from k), (select st_x from k), 'in_progress');

-- The FF-2 matrix write door (`app.assert_matrix_answer_writable`) checks
-- auth.uid() against the response creator, so the cell writes below need a JWT —
-- unlike every other write in this file, which RLS lets through as the owner.
select test_helpers.claims_for((select st_x from k), false);

-- gate = "nao": required_if FALSE on both matrices, both grids empty.
select public.save_section_answers(
  'ff300000-0000-0000-0000-00000000007b', 'ff300000-0000-0000-0000-000000000073',
  p_selections => '{"ff300000-0000-0000-0000-000000000074":["nao"]}'::jsonb);

select ok(app.response_required_complete('ff300000-0000-0000-0000-00000000007b'),
  'N1. required_if FALSE on a matrix requires nothing, even with an empty grid');

-- gate = "sim": the flat matrix becomes required; the other becomes hidden.
select public.save_section_answers(
  'ff300000-0000-0000-0000-00000000007b', 'ff300000-0000-0000-0000-000000000073',
  p_selections => '{"ff300000-0000-0000-0000-000000000074":["sim"]}'::jsonb);

select ok(not app.response_required_complete('ff300000-0000-0000-0000-00000000007b'),
  'N2. required_if TRUE on a matrix BLOCKS with an empty grid (no item_type filter)');

-- One of two rows: ROW-COMPLETE, not "any cell anywhere".
select public.save_section_answers(
  'ff300000-0000-0000-0000-00000000007b', 'ff300000-0000-0000-0000-000000000073',
  p_matrix_cells => '{"ff300000-0000-0000-0000-000000000075":{"r1":"ok"}}'::jsonb);

select ok(not app.response_required_complete('ff300000-0000-0000-0000-00000000007b'),
  'N3. …and ONE of two rows is still incomplete — required_if composes with row-complete');

select throws_ok(
  $q$select public.submit_response('ff300000-0000-0000-0000-00000000007b')$q$,
  'HC011', null,
  'N4. …and submit_response refuses it (the flat arm, end to end)');

-- Complete the grid. The HIDDEN matrix is still required_if-TRUE and still empty,
-- so N5 passing is the deadlock-negative for the matrix lane.
select public.save_section_answers(
  'ff300000-0000-0000-0000-00000000007b', 'ff300000-0000-0000-0000-000000000073',
  p_matrix_cells => '{"ff300000-0000-0000-0000-000000000075":{"r1":"ok","r2":"nok"}}'::jsonb);

select ok(app.response_required_complete('ff300000-0000-0000-0000-00000000007b'),
  'N5. DEADLOCK-NEGATIVE: the HIDDEN matrix is required_if-TRUE and never blocks');

select is(
  (select count(*)::int
     from public.answer_matrix_cells c
     join public.answers a on a.id = c.answer_id
    where a.response_id = 'ff300000-0000-0000-0000-00000000007b'
      and a.item_id = 'ff300000-0000-0000-0000-000000000076'),
  0, 'N6. …and that hidden grid really is empty (N5 is not passing because it got filled)');

-- ---- the PER-INSTANCE arm ----
insert into public.response_group_instances (id, response_id, group_item_id, position)
  values ('ff300000-0000-0000-0000-00000000007c', 'ff300000-0000-0000-0000-00000000007b',
          'ff300000-0000-0000-0000-000000000078', 0);

select public.save_section_answers(
  'ff300000-0000-0000-0000-00000000007b', 'ff300000-0000-0000-0000-000000000077',
  p_instance_answers => '[
    {"instance_id":"ff300000-0000-0000-0000-00000000007c",
     "selections":{"ff300000-0000-0000-0000-000000000079":["sim"]}}
  ]'::jsonb);

select ok(not app.response_required_complete('ff300000-0000-0000-0000-00000000007b'),
  'N7. GROUP ARM: required_if TRUE on a matrix CHILD blocks, per instance');

select public.save_section_answers(
  'ff300000-0000-0000-0000-00000000007b', 'ff300000-0000-0000-0000-000000000077',
  p_instance_answers => '[
    {"instance_id":"ff300000-0000-0000-0000-00000000007c",
     "matrix_cells":{"ff300000-0000-0000-0000-00000000007a":{"i1":"ia"}}}
  ]'::jsonb);

select ok(app.response_required_complete('ff300000-0000-0000-0000-00000000007b'),
  'N8. …and completing THAT instance''s grid clears it');

select set_config('request.jwt.claims', null, true);

select * from finish();
rollback;
