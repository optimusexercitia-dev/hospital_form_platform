import type { Json } from '@/lib/types/database'

/**
 * Section-visibility condition evaluation — the TypeScript mirror of the SQL
 * `app.eval_condition` function (ARCHITECTURE Rule 3). The wizard uses this for
 * live show/skip; the SQL function is the authority at submission time. The two
 * MUST agree: a shared vector file
 * (`src/lib/queries/__fixtures__/condition-vectors.json`) is exercised against
 * both, and drift is a phase-blocking bug. Any change here must be mirrored in
 * `supabase/migrations/*_condition_evaluator_and_rpcs.sql` and vice versa.
 *
 * v1 shape (ADR 0005): a single condition, no AND/OR trees.
 */

export type ConditionOp = 'equals' | 'not_equals' | 'in'

export interface VisibleWhen {
  question_key: string
  op: ConditionOp
  value: Json
}

/**
 * A cross-phase recommendation condition (Phase 7, ADR 0017). A strict superset
 * of `VisibleWhen`: it adds `from_phase` — the position of the EARLIER case-phase
 * whose answers the condition reads. The backend strips `from_phase`
 * (`recommend_when - 'from_phase'`) and feeds the remaining `VisibleWhen` to the
 * UNCHANGED `eval_condition`/`evalCondition` against that source phase's
 * (submitted-only) answer map, so the evaluator + its mirror + the shared vector
 * file stay untouched (no drift). The template builder can preview a
 * recommendation by calling `evalCondition({ question_key, op, value }, answers)`
 * (i.e. the `RecommendWhen` minus `from_phase`).
 */
export type RecommendWhen = { from_phase: number } & VisibleWhen

/**
 * One rule of a per-phase result ruleset (phase-results feature). The `when` is a
 * PLAIN `VisibleWhen` over the phase's OWN answers (NO `from_phase`) so the
 * UNCHANGED `evalCondition` evaluates it directly — no qualifier-stripping, no
 * evaluator drift, shared vectors untouched. `result_id` is the result option
 * emitted when this rule is the FIRST to match (first-match-wins).
 */
export interface ResultRule {
  when: VisibleWhen
  result_id: string
}

/**
 * The ordered result ruleset authored on a template phase and snapshotted onto the
 * case phase. Walked top-to-bottom; the first `rule.when` that evaluates true wins
 * its `result_id`; if none match, `default_result_id` is the fallback (may be
 * `null` → no result). The TS mirror of the SQL rule-walk in
 * `app.compute_case_phase_result`; both reuse the shared `evalCondition` /
 * `app.eval_condition`.
 */
export interface ResultRuleset {
  rules: ResultRule[]
  default_result_id: string | null
}

/** A flat map of question_key -> saved answer value. */
export type AnswerMap = Record<string, Json | undefined>

/** Deep structural equality matching Postgres jsonb equality for our values. */
function jsonEquals(a: Json | undefined, b: Json | undefined): boolean {
  if (a === b) return true
  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false
    }
    return a.every((el, i) => jsonEquals(el, b[i]))
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a)
    const bk = Object.keys(b)
    if (ak.length !== bk.length) return false
    return ak.every((k) =>
      jsonEquals(
        (a as Record<string, Json>)[k],
        (b as Record<string, Json>)[k],
      ),
    )
  }
  return false
}

/**
 * The "equals" relation, accounting for checkbox answers stored as arrays:
 * when the answer is an array, it matches the target if the target is one of
 * the selected options.
 */
function answerMatchesValue(answer: Json | undefined, target: Json): boolean {
  if (answer === undefined || answer === null) return false
  if (Array.isArray(answer)) {
    return answer.some((sel) => jsonEquals(sel, target))
  }
  return jsonEquals(answer, target)
}

/**
 * Evaluate whether a section is visible given the current answers.
 * A null/undefined condition means "always visible".
 */
export function evalCondition(
  visibleWhen: VisibleWhen | null | undefined,
  answers: AnswerMap,
): boolean {
  if (visibleWhen == null) return true

  const { question_key: key, op, value: target } = visibleWhen
  const present = Object.prototype.hasOwnProperty.call(answers, key)
  const answer = answers[key]

  const match = answerMatchesValue(present ? answer : undefined, target)

  switch (op) {
    case 'equals':
      return match
    case 'not_equals':
      return !match
    case 'in': {
      if (
        !present ||
        answer === undefined ||
        answer === null ||
        !Array.isArray(target)
      ) {
        return false
      }
      if (Array.isArray(answer)) {
        return answer.some((sel) => target.some((t) => jsonEquals(sel, t)))
      }
      return target.some((t) => jsonEquals(answer, t))
    }
    default: {
      // Exhaustiveness guard: a new op must be added to both evaluators.
      const _never: never = op
      throw new Error(`unknown condition op: ${String(_never)}`)
    }
  }
}

/**
 * Walk a per-phase `ResultRuleset` over the phase's own answers and return the
 * winning `result_id` (or `null` when nothing matches and there is no default).
 * The TypeScript MIRROR of the SQL rule-walk in `app.compute_case_phase_result`:
 * iterate `rules` in order, return the FIRST rule whose `when` is true (reusing
 * {@link evalCondition} unchanged), else fall back to `default_result_id`, else
 * `null`. A `null` ruleset yields `null`. Used by the builder preview + the
 * end-of-wizard live computed preview; the SQL function is the authority at
 * conclude time. Drift between the two is a phase-blocking bug.
 *
 * NOTE: stub — implementation lands in task #4 (contract-first signature only).
 */
export function walkResultRuleset(
  ruleset: ResultRuleset | null | undefined,
  answers: AnswerMap,
): string | null {
  void ruleset
  void answers
  throw new Error('not implemented')
}
