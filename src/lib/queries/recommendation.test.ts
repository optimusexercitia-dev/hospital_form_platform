import { describe, expect, it } from 'vitest'

import {
  evalCondition,
  evalRecommendation,
  RECOMMEND_RESULT_KEY,
  RECOMMEND_RESULT_ADVERSE_KEY,
  type AnswerMap,
  type RecommendPhaseData,
  type RecommendRule,
  type VisibleWhen,
} from './conditions'
import vectorsFile from './__fixtures__/condition-vectors.json'

/**
 * Unit tests for `evalRecommendation` — the TS mirror of the SQL group-walk in
 * `public.recompute_recommendations` (ADR 0043). Three concerns:
 *   1. SHAPE handling: null → false, legacy single (answer-only) → one-condition
 *      AND, group `all`/`any` fold.
 *   2. RESULT conditions: specific (equals/not_equals/in over an option id) and
 *      adverse (true/false), including the no-result missing-value semantics that
 *      must match the answer side (equals/in/adverse:true → false; not_equals →
 *      true [the documented footgun]; adverse:false → false until a real
 *      non-adverse result exists).
 *   3. NO EVALUATOR DRIFT: every condition is decided by the UNCHANGED
 *      `evalCondition` over a synthetic map. We prove the delegation by driving a
 *      single result-condition FROM the shared `condition-vectors.json` (re-keyed
 *      onto the reserved synthetic key) and asserting `evalRecommendation` agrees
 *      with `evalCondition` for each vector — so the recommendation walk's match
 *      decision IS `evalCondition`'s.
 */

// Stable fake option ids (uuid-shaped, but treated as opaque strings).
const CONFORME = '11111111-1111-1111-1111-111111111111'
const NAO_CONFORME = '22222222-2222-2222-2222-222222222222'
const OTHER = '33333333-3333-3333-3333-333333333333'

/** Build a `resolve` from a position → phase-data map (missing → null). */
function resolver(
  byPhase: Record<number, RecommendPhaseData>,
): (fromPhase: number) => RecommendPhaseData | null {
  return (p) => byPhase[p] ?? null
}

const noResult: RecommendPhaseData = {
  answers: {},
  resultId: null,
  resultAdverse: null,
}

describe('evalRecommendation — shape handling', () => {
  it('null / undefined rule → false', () => {
    expect(evalRecommendation(null, () => noResult)).toBe(false)
    expect(evalRecommendation(undefined, () => noResult)).toBe(false)
  })

  it('legacy single (answer-only) → evaluated as a one-condition AND', () => {
    const rule: RecommendRule = {
      from_phase: 1,
      question_key: 'u_q1',
      op: 'equals',
      value: 'Sim',
    }
    const resolve = resolver({
      1: { answers: { u_q1: 'Sim' }, resultId: null, resultAdverse: null },
    })
    expect(evalRecommendation(rule, resolve)).toBe(true)
    const resolveNo = resolver({
      1: { answers: { u_q1: 'Não' }, resultId: null, resultAdverse: null },
    })
    expect(evalRecommendation(rule, resolveNo)).toBe(false)
  })

  it('a dangling from_phase (no source data) resolves to "no data"', () => {
    const rule: RecommendRule = {
      from_phase: 9,
      question_key: 'u_q1',
      op: 'equals',
      value: 'Sim',
    }
    // equals over an absent answer → false; not_equals → true.
    expect(evalRecommendation(rule, () => null)).toBe(false)
    expect(
      evalRecommendation({ ...rule, op: 'not_equals' }, () => null),
    ).toBe(true)
  })
})

describe('evalRecommendation — group fold (all / any)', () => {
  // T1 scenario (ADR 0043 handoff): phase 1 emits Conforme | NãoConforme[adverse];
  // p4 = any [ {result equals NãoConforme}, {answer u_q1 = 'Sim'} ].
  const p4: RecommendRule = {
    match: 'any',
    conditions: [
      { source: 'result', from_phase: 1, op: 'equals', value: NAO_CONFORME },
      { source: 'answer', from_phase: 1, question_key: 'u_q1', op: 'equals', value: 'Sim' },
    ],
  }

  it('any: true when EITHER condition holds (answer leg)', () => {
    const resolve = resolver({
      1: { answers: { u_q1: 'Sim' }, resultId: CONFORME, resultAdverse: false },
    })
    expect(evalRecommendation(p4, resolve)).toBe(true)
  })

  it('any: true when EITHER condition holds (result leg)', () => {
    const resolve = resolver({
      1: { answers: { u_q1: 'Não' }, resultId: NAO_CONFORME, resultAdverse: true },
    })
    expect(evalRecommendation(p4, resolve)).toBe(true)
  })

  it('any: false when NEITHER condition holds', () => {
    const resolve = resolver({
      1: { answers: { u_q1: 'Não' }, resultId: OTHER, resultAdverse: false },
    })
    expect(evalRecommendation(p4, resolve)).toBe(false)
  })

  // T2 scenario: AND group mixing a result-specific and an answer condition.
  const andRule: RecommendRule = {
    match: 'all',
    conditions: [
      { source: 'result', from_phase: 2, op: 'equals', value: CONFORME },
      { source: 'answer', from_phase: 1, question_key: 'u_q1', op: 'equals', value: 'Sim' },
    ],
  }

  it('all: true only when BOTH conditions hold', () => {
    const both = resolver({
      1: { answers: { u_q1: 'Sim' }, resultId: null, resultAdverse: null },
      2: { answers: {}, resultId: CONFORME, resultAdverse: false },
    })
    expect(evalRecommendation(andRule, both)).toBe(true)
  })

  it('all: false when one condition misses', () => {
    const onlyAnswer = resolver({
      1: { answers: { u_q1: 'Sim' }, resultId: null, resultAdverse: null },
      2: { answers: {}, resultId: NAO_CONFORME, resultAdverse: true },
    })
    expect(evalRecommendation(andRule, onlyAnswer)).toBe(false)
  })
})

describe('evalRecommendation — result conditions: specific id', () => {
  const equalsConforme: RecommendRule = {
    match: 'all',
    conditions: [{ source: 'result', from_phase: 1, op: 'equals', value: CONFORME }],
  }

  it('equals matches the landed result id', () => {
    expect(
      evalRecommendation(
        equalsConforme,
        resolver({ 1: { answers: {}, resultId: CONFORME, resultAdverse: false } }),
      ),
    ).toBe(true)
    expect(
      evalRecommendation(
        equalsConforme,
        resolver({ 1: { answers: {}, resultId: OTHER, resultAdverse: false } }),
      ),
    ).toBe(false)
  })

  it('in matches any of the listed result ids', () => {
    const inRule: RecommendRule = {
      match: 'all',
      conditions: [
        { source: 'result', from_phase: 1, op: 'in', value: [CONFORME, NAO_CONFORME] },
      ],
    }
    expect(
      evalRecommendation(
        inRule,
        resolver({ 1: { answers: {}, resultId: NAO_CONFORME, resultAdverse: true } }),
      ),
    ).toBe(true)
    expect(
      evalRecommendation(
        inRule,
        resolver({ 1: { answers: {}, resultId: OTHER, resultAdverse: false } }),
      ),
    ).toBe(false)
  })

  it('no result: equals/in → false; not_equals → true (the documented footgun)', () => {
    const r = resolver({ 1: noResult })
    expect(evalRecommendation(equalsConforme, r)).toBe(false)
    const notEquals: RecommendRule = {
      match: 'all',
      conditions: [
        { source: 'result', from_phase: 1, op: 'not_equals', value: CONFORME },
      ],
    }
    expect(evalRecommendation(notEquals, r)).toBe(true)
  })
})

describe('evalRecommendation — result conditions: adverse', () => {
  const adverseTrue: RecommendRule = {
    match: 'all',
    conditions: [{ source: 'result', from_phase: 1, adverse: true }],
  }
  const adverseFalse: RecommendRule = {
    match: 'all',
    conditions: [{ source: 'result', from_phase: 1, adverse: false }],
  }

  it('adverse:true matches an adverse result, not a non-adverse one', () => {
    expect(
      evalRecommendation(
        adverseTrue,
        resolver({ 1: { answers: {}, resultId: NAO_CONFORME, resultAdverse: true } }),
      ),
    ).toBe(true)
    expect(
      evalRecommendation(
        adverseTrue,
        resolver({ 1: { answers: {}, resultId: CONFORME, resultAdverse: false } }),
      ),
    ).toBe(false)
  })

  it('adverse:false matches a non-adverse result only', () => {
    expect(
      evalRecommendation(
        adverseFalse,
        resolver({ 1: { answers: {}, resultId: CONFORME, resultAdverse: false } }),
      ),
    ).toBe(true)
    expect(
      evalRecommendation(
        adverseFalse,
        resolver({ 1: { answers: {}, resultId: NAO_CONFORME, resultAdverse: true } }),
      ),
    ).toBe(false)
  })

  it('no result: adverse:true AND adverse:false both → false', () => {
    const r = resolver({ 1: noResult })
    expect(evalRecommendation(adverseTrue, r)).toBe(false)
    expect(evalRecommendation(adverseFalse, r)).toBe(false)
  })
})

describe('evalRecommendation — no evaluator drift (driven by the shared vectors)', () => {
  interface Vector {
    name: string
    visible_when: VisibleWhen | null
    answers: AnswerMap
    expected: boolean
  }
  const vectors = (vectorsFile as { vectors: Vector[] }).vectors

  // Re-key each choice-op vector onto the reserved RESULT_KEY and feed its target
  // value through a result-specific condition. evalRecommendation must agree with
  // evalCondition over the same synthetic map — proving the recommendation walk
  // delegates to the UNCHANGED evaluator with no drift. We restrict to the choice
  // ops a result-specific condition can carry (equals/not_equals/in).
  const RESULT_OPS = new Set(['equals', 'not_equals', 'in'])
  const choiceVectors = vectors.filter(
    (v) => v.visible_when != null && RESULT_OPS.has(v.visible_when.op),
  )

  it.each(choiceVectors.map((v) => [v.name, v] as const))(
    'result-specific condition matches evalCondition for vector: %s',
    (_name, v) => {
      const vw = v.visible_when as VisibleWhen
      // The synthetic map the SQL/TS result path builds: the option id lives under
      // RECOMMEND_RESULT_KEY. Re-key the vector's answer for that single key.
      const answer = v.answers[vw.question_key]
      const synthetic: AnswerMap =
        answer === undefined ? {} : { [RECOMMEND_RESULT_KEY]: answer }
      const expected = evalCondition(
        { question_key: RECOMMEND_RESULT_KEY, op: vw.op, value: vw.value },
        synthetic,
      )

      const rule: RecommendRule = {
        match: 'all',
        conditions: [
          {
            source: 'result',
            from_phase: 1,
            op: vw.op as 'equals' | 'not_equals' | 'in',
            value: vw.value,
          },
        ],
      }
      // resultId is whatever the vector's answer for that key was (or null absent).
      const resultId =
        typeof answer === 'string' ? answer : answer === undefined ? null : null
      const data: RecommendPhaseData = {
        answers: {},
        // When the vector answer isn't a plain string id, model it as "no result"
        // so both sides see an absent key (the synthetic map above is also empty).
        resultId,
        resultAdverse: null,
      }
      // Only assert when both sides see the SAME synthetic map (string id or absent).
      if (answer === undefined || typeof answer === 'string') {
        expect(evalRecommendation(rule, resolver({ 1: data }))).toBe(expected)
      }
    },
  )

  it('the reserved synthetic keys never collide with author-typed slugs', () => {
    expect(RECOMMEND_RESULT_KEY).toBe('__phase_result__')
    expect(RECOMMEND_RESULT_ADVERSE_KEY).toBe('__phase_result_adverse__')
  })
})
