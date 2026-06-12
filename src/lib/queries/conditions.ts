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
