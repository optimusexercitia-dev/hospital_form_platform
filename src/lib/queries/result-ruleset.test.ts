import { describe, expect, it } from 'vitest'

import {
  evalCondition,
  walkResultRuleset,
  type AnswerMap,
  type ResultRuleset,
  type VisibleWhen,
} from './conditions'
import vectorsFile from './__fixtures__/condition-vectors.json'

/**
 * Unit tests for `walkResultRuleset` — the TS mirror of the SQL rule-walk in
 * `app.compute_case_phase_result`. Two concerns:
 *   1. Walk SEMANTICS: first-match-wins, fall-through to default, no-match/no-default
 *      → null, null ruleset → null.
 *   2. NO EVALUATOR DRIFT: the walk must delegate to the UNCHANGED `evalCondition`
 *      (which the shared `condition-vectors.json` pins against `app.eval_condition`).
 *      We prove the delegation by driving the walk FROM the shared vectors: a
 *      single-rule ruleset whose `when` is a vector condition must return its
 *      result_id IFF the vector expects `true`, else fall to the default — i.e. the
 *      walk's match decision IS `evalCondition`'s. This survives vector additions
 *      (no brittle file hash) while still tripping if the walk stops reusing the
 *      shared evaluator.
 */

const HIT = 'result-hit'
const DEFAULT = 'result-default'

interface Vector {
  name: string
  visible_when: VisibleWhen | null
  answers: AnswerMap
  expected: boolean
}

const vectors = (vectorsFile as { vectors: Vector[] }).vectors

describe('walkResultRuleset — walk semantics', () => {
  const cond = (value: string): VisibleWhen => ({
    question_key: 'q',
    op: 'equals',
    value,
  })

  it('null ruleset → null', () => {
    expect(walkResultRuleset(null, {})).toBeNull()
    expect(walkResultRuleset(undefined, {})).toBeNull()
  })

  it('first matching rule wins (order matters)', () => {
    const ruleset: ResultRuleset = {
      rules: [
        { when: cond('a'), result_id: 'first' },
        { when: cond('a'), result_id: 'second' },
      ],
      default_result_id: DEFAULT,
    }
    expect(walkResultRuleset(ruleset, { q: 'a' })).toBe('first')
  })

  it('falls through to a later rule when earlier rules miss', () => {
    const ruleset: ResultRuleset = {
      rules: [
        { when: cond('a'), result_id: 'first' },
        { when: cond('b'), result_id: 'second' },
      ],
      default_result_id: DEFAULT,
    }
    expect(walkResultRuleset(ruleset, { q: 'b' })).toBe('second')
  })

  it('no rule matches → default_result_id', () => {
    const ruleset: ResultRuleset = {
      rules: [{ when: cond('a'), result_id: 'first' }],
      default_result_id: DEFAULT,
    }
    expect(walkResultRuleset(ruleset, { q: 'z' })).toBe(DEFAULT)
  })

  it('no rule matches and no default → null', () => {
    const ruleset: ResultRuleset = {
      rules: [{ when: cond('a'), result_id: 'first' }],
      default_result_id: null,
    }
    expect(walkResultRuleset(ruleset, { q: 'z' })).toBeNull()
  })

  it('empty rules → default (or null)', () => {
    expect(
      walkResultRuleset({ rules: [], default_result_id: DEFAULT }, {}),
    ).toBe(DEFAULT)
    expect(
      walkResultRuleset({ rules: [], default_result_id: null }, {}),
    ).toBeNull()
  })
})

describe('walkResultRuleset — no evaluator drift (driven by the shared vectors)', () => {
  it.each(
    vectors
      .filter((v) => v.visible_when != null)
      .map((v) => [v.name, v] as const),
  )('matches evalCondition for vector: %s', (_name, v) => {
    const ruleset: ResultRuleset = {
      rules: [{ when: v.visible_when as VisibleWhen, result_id: HIT }],
      default_result_id: DEFAULT,
    }
    // The single rule fires IFF evalCondition is true → HIT; else → DEFAULT.
    const expectedWinner = evalCondition(v.visible_when, v.answers)
      ? HIT
      : DEFAULT
    expect(walkResultRuleset(ruleset, v.answers)).toBe(expectedWinner)
  })
})
