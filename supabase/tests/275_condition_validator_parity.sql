-- BUG-FF3-002 — the VALIDATOR pair, asserted against the SQL engine.
--
-- `app.is_valid_condition` <-> `isValidCondition` (src/lib/forms/condition-shape.ts)
-- is a MIRRORED PAIR, and until this file existed it had no vectors — while the
-- EVALUATOR pair beside it has had them since ADR 0005. That asymmetry is exactly
-- how B5 widened SQL to eleven operators and left the TS twin at seven: pgTAP
-- passed (SQL was right), tsc and lint passed (the TS was well-formed), and the
-- server action refused every unary condition the pickers offered before the
-- database ever saw it.
--
-- ARCHITECTURE Rule 3 names the evaluator pair as mirrored and drift as
-- phase-blocking. This file asserts the same of the validator pair.
--
-- The JSON below is the LITERAL CONTENT of
-- src/lib/queries/__fixtures__/condition-validator-vectors.json, embedded in a
-- dollar-quoted literal; `src/lib/forms/condition-shape.test.ts` asserts the two
-- still parse EQUAL, so neither side can be edited alone.
--
-- Every vector here is a MIRROR fact. The three places the TS twin is
-- deliberately STRICTER are NOT in this file — they are enumerated in the
-- `TS-only narrowings` block of the Vitest file, so an unintended divergence
-- cannot hide among the intended ones.

begin;

select plan(3);

create temp table cv on commit drop as
select (e.value ->> 'name') as name,
       (e.value -> 'condition') as cond,
       (e.value ->> 'expected')::boolean as expected
from jsonb_array_elements(
  ($vectors${
  "_comment": [
    "BUG-FF3-002 — the golden vectors for the VALIDATOR pair:",
    "SQL app.is_valid_condition  <->  TS isValidCondition (src/lib/forms/actions.ts).",
    "",
    "The evaluator pair (eval_condition <-> evalCondition) has had vectors since ADR",
    "0005. The VALIDATOR pair had none, and that is how B5 widened SQL to eleven",
    "operators while the TS twin stayed at seven — pgTAP passed (SQL was right), tsc",
    "and lint passed (the TS was well-formed), and the only path the UI can reach was",
    "refused by the server action before the database ever saw it.",
    "",
    "The matrix is OPERATOR x VALUE-PRESENCE, because that is the axis the two sides",
    "disagreed on. `expected` is: may this be STORED?",
    "",
    "Run by Vitest (src/lib/forms/condition-validator-parity.test.ts) and by pgTAP",
    "(supabase/tests/275_condition_validator_parity.sql). Drift is phase-blocking",
    "under ARCHITECTURE Rule 3 — which names the evaluator pair, and which this bug",
    "proved applies to the validator pair identically.",
    "",
    "EVERY vector here is a MIRROR fact: both engines must return `expected`. Cases",
    "where the TS twin is deliberately STRICTER than SQL are deliberately NOT here —",
    "they live in the `TS-only narrowings` block of the Vitest file, enumerated and",
    "justified, so that this file can never quietly absorb a divergence. There is",
    "currently ONE such case (a blank question_key: SQL stores it, TS refuses it",
    "because publish would reject it anyway and an authoring-time message is better",
    "than a publish-time one)."
  ],
  "vectors": [
    { "name": "equals with a value", "condition": { "question_key": "q", "op": "equals", "value": "a" }, "expected": true },
    { "name": "equals with NO value key", "condition": { "question_key": "q", "op": "equals" }, "expected": false },
    { "name": "equals with an explicit null value", "condition": { "question_key": "q", "op": "equals", "value": null }, "expected": true },
    { "name": "not_equals with a value", "condition": { "question_key": "q", "op": "not_equals", "value": "a" }, "expected": true },
    { "name": "not_equals with NO value key", "condition": { "question_key": "q", "op": "not_equals" }, "expected": false },
    { "name": "in with an array value", "condition": { "question_key": "q", "op": "in", "value": ["a", "b"] }, "expected": true },
    { "name": "in with NO value key", "condition": { "question_key": "q", "op": "in" }, "expected": false },
    { "name": "gt with a number", "condition": { "question_key": "q", "op": "gt", "value": 5 }, "expected": true },
    { "name": "gte with a number", "condition": { "question_key": "q", "op": "gte", "value": 5 }, "expected": true },
    { "name": "lt with a number", "condition": { "question_key": "q", "op": "lt", "value": 5 }, "expected": true },
    { "name": "lte with a number", "condition": { "question_key": "q", "op": "lte", "value": 5 }, "expected": true },
    { "name": "lte with NO value key", "condition": { "question_key": "q", "op": "lte" }, "expected": false },

    { "name": "F3: contains with a value", "condition": { "question_key": "q", "op": "contains", "value": "a" }, "expected": true },
    { "name": "F3: contains with NO value key", "condition": { "question_key": "q", "op": "contains" }, "expected": false },
    { "name": "F3: not_contains with a value", "condition": { "question_key": "q", "op": "not_contains", "value": "a" }, "expected": true },
    { "name": "F3: not_contains with NO value key", "condition": { "question_key": "q", "op": "not_contains" }, "expected": false },

    { "name": "UNARY: is_empty with NO value key", "condition": { "question_key": "q", "op": "is_empty" }, "expected": true },
    { "name": "UNARY: is_empty with an explicit null value (what the builder emits)", "condition": { "question_key": "q", "op": "is_empty", "value": null }, "expected": true },
    { "name": "UNARY: is_empty with a stray value (ignored, not rejected)", "condition": { "question_key": "q", "op": "is_empty", "value": "x" }, "expected": true },
    { "name": "UNARY: is_not_empty with NO value key", "condition": { "question_key": "q", "op": "is_not_empty" }, "expected": true },
    { "name": "UNARY: is_not_empty with an explicit null value", "condition": { "question_key": "q", "op": "is_not_empty", "value": null }, "expected": true },

    { "name": "an unknown operator is refused", "condition": { "question_key": "q", "op": "nonsense", "value": "a" }, "expected": false },
    { "name": "a TYPO on a real operator is refused", "condition": { "question_key": "q", "op": "is_emty" }, "expected": false },
    { "name": "no question_key is refused", "condition": { "op": "equals", "value": "a" }, "expected": false },
    { "name": "a non-string question_key is refused", "condition": { "question_key": 7, "op": "equals", "value": "a" }, "expected": false },
    { "name": "no op is refused", "condition": { "question_key": "q", "value": "a" }, "expected": false },
    { "name": "an empty object is refused", "condition": {}, "expected": false }
  ]
}$vectors$::jsonb) -> 'vectors'
) e;

-- MUTATION: drop any operator from app.is_valid_condition's allowlist, or remove
--   its `(p ->> 'op') in ('is_empty','is_not_empty') or (p ? 'value')` exemption
--   -> the matching vectors go red HERE and in Vitest. One fixture, two engines.
select is(
  (select count(*)::int from cv
    where app.is_valid_condition(cond) is distinct from expected),
  0,
  'V1. every validator vector agrees with app.is_valid_condition');

-- A vector table that silently failed to load would make V1 vacuously true.
select cmp_ok((select count(*)::int from cv), '>=', 25,
  'V2. the vector table actually loaded — V1 is not 0 rows agreeing with nothing');

-- The operator coverage assertion, mirrored from the Vitest side: an operator
-- with no vector is an operator whose two halves are free to disagree.
select is(
  (select count(*)::int from (
     select unnest(array['equals','not_equals','in','gt','gte','lt','lte',
                         'contains','not_contains','is_empty','is_not_empty']) as op
     except
     select cond ->> 'op' from cv
   ) missing),
  0, 'V3. every operator the mirror accepts has at least one vector');

select * from finish();
rollback;
