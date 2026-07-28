import type { Json } from '@/lib/types/database'

/**
 * The SHAPE gate for a single condition — the TypeScript half of the
 * `app.is_valid_condition` MIRROR, extracted from `forms/actions.ts` so it can be
 * unit-tested directly (a `'use server'` module may only export async functions,
 * which is why this predicate was previously untestable and therefore untested).
 *
 * ⚠ THIS IS A MIRRORED PAIR, exactly like `eval_condition` <-> `evalCondition`.
 * ARCHITECTURE Rule 3 names the EVALUATOR pair; BUG-FF3-002 proved the VALIDATOR
 * pair is equally mirrored and equally phase-blocking. B5 widened the SQL side to
 * eleven operators and this side stayed at seven, so every unary condition the
 * pickers offered was refused by the server action before the database saw it —
 * and nothing caught it: pgTAP passed (SQL was right), tsc and lint passed (this
 * was well-formed), and the DB-level verification never crossed the seam the UI
 * actually uses.
 *
 * Drift is locked by `src/lib/queries/__fixtures__/condition-validator-vectors.json`,
 * asserted against BOTH engines — Vitest in `condition-shape.test.ts`, pgTAP in
 * `supabase/tests/275_condition_validator_parity.sql`.
 */

/**
 * BUG-FF3-002. The TS half of the `app.is_valid_condition` MIRROR — the storage
 * gate for `visible_when` and `required_if`. It must list exactly what the SQL
 * function lists; this array was left at the pre-F3 seven while B5 widened SQL to
 * eleven, so every unary/`contains` condition the pickers offered was refused by
 * the server action BEFORE the database ever saw it.
 *
 * ⚠ THIS IS A MIRRORED PAIR, exactly like `eval_condition` <-> `evalCondition`.
 * ARCHITECTURE Rule 3 names the EVALUATOR pair; this phase proved the VALIDATOR
 * pair is equally mirrored and equally phase-blocking. Drift is locked by
 * `__fixtures__/condition-validator-vectors.json`, asserted against BOTH engines
 * (Vitest here, pgTAP in `275_condition_validator_parity.sql`). Add an operator
 * to one side and the vectors go red until the other side follows.
 */
const CONDITION_OPS = [
  'equals',
  'not_equals',
  'in',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'not_contains',
  'is_empty',
  'is_not_empty',
]

/**
 * The two UNARY operators: they ask only "was this answered?", so they carry no
 * operand. `app.is_valid_condition` exempts them BY NAME from its `p ? 'value'`
 * requirement, and this mirror does the same — by name, never by making `value`
 * optional for everything, which would also admit `{"op":"equals"}`.
 */
const UNARY_OPS = ['is_empty', 'is_not_empty']

/** The ordered comparisons. Used only by narrowing 3 below. */
const ORDERED_OPS = ['gt', 'gte', 'lt', 'lte']
/**
 * Does this condition have a storable SHAPE? Mirrors `app.is_valid_condition`.
 *
 * THREE DELIBERATE NARROWINGS make this stricter than SQL. Each is safe because
 * it rejects something the PUBLISH authority (`public.validate_visible_when` and
 * `app.assert_condition_op_target`) would reject anyway — so the author gets an
 * authoring-time message instead of a publish-time dead end. They are enumerated
 * in the `TS-only narrowings` block of the test file, and they are the reason the
 * shared vector file contains only mirror facts:
 *   1. a BLANK `question_key` (SQL stores it; it can never resolve);
 *   2. `in` whose value is not an array;
 *   3. an ordered op (gt/gte/lt/lte) whose value IS an array.
 * Adding a fourth without recording it there is how this pair drifts again.
 */
export function isValidCondition(c: unknown): c is { question_key: string; op: string; value: Json } {
  if (c === null || typeof c !== 'object') return false
  const rec = c as Record<string, unknown>
  if (typeof rec.question_key !== 'string' || !rec.question_key) return false
  if (typeof rec.op !== 'string' || !CONDITION_OPS.includes(rec.op)) return false
  // A unary op needs no `value`. The builder currently sends `value: null` for
  // these (a PRESENT key), so this branch is not what BUG-FF3-002 tripped on —
  // the operator allowlist above was. It is mirrored anyway, because SQL accepts
  // an ABSENT key for exactly these two ops and any client that omits it must not
  // be refused by a stricter twin. Divergence in EITHER direction is the bug.
  if (!UNARY_OPS.includes(rec.op) && !('value' in rec)) return false
  // `in` carries an array; the ordered ops carry a scalar; equals/not_equals
  // either. We only check the array-ness of `in` here (the deep value↔target
  // type check is the publish-time validator's job, BE-3).
  if (rec.op === 'in' && !Array.isArray(rec.value)) return false
  if (ORDERED_OPS.includes(rec.op) && Array.isArray(rec.value)) return false
  return true
}
