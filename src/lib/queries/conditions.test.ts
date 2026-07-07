import { describe, expect, it } from 'vitest'

import {
  evalCondition,
  evalVisibility,
  computeAggregateKeys,
  walkResultRuleset,
  TOTAL_SCORE_KEY,
  FLAGGED_COUNT_KEY,
  type AnswerMap,
  type ResultRuleset,
  type Visibility,
  type VisibleWhen,
} from './conditions'
import vectorsFile from './__fixtures__/condition-vectors.json'
import visibilityVectorsFile from './__fixtures__/visibility-vectors.json'

interface Vector {
  name: string
  visible_when: VisibleWhen | null
  answers: AnswerMap
  expected: boolean
}

const vectors = (vectorsFile as { vectors: Vector[] }).vectors

describe('evalCondition (TS mirror of app.eval_condition)', () => {
  it.each(vectors.map((v) => [v.name, v] as const))('%s', (_name, v) => {
    expect(evalCondition(v.visible_when, v.answers)).toBe(v.expected)
  })
})

interface VisibilityVector {
  name: string
  rule: Visibility | null
  answers: AnswerMap
  expected: boolean
}

const visibilityVectors = (
  visibilityVectorsFile as { vectors: VisibilityVector[] }
).vectors

describe('evalVisibility (TS mirror of app.eval_visibility)', () => {
  it.each(visibilityVectors.map((v) => [v.name, v] as const))(
    '%s',
    (_name, v) => {
      expect(evalVisibility(v.rule, v.answers)).toBe(v.expected)
    },
  )
})

// ---------------------------------------------------------------------------
// Flagged + aggregate result criteria — the TS mirror of the SQL aggregate
// injection in app.compute_case_phase_result. These assert computeAggregateKeys
// matches what the pgTAP suite (2xx) expects, so the BUILDER PREVIEW that feeds
// these synthetic keys into walkResultRuleset lands on the same result the backend
// computes. The SHARED condition vectors above are UNCHANGED.
// ---------------------------------------------------------------------------

describe('computeAggregateKeys (__total_score__ / __flagged_count__)', () => {
  it('sums selected option scores; nulls/absent treated as 0 by the caller', () => {
    const keys = computeAggregateKeys({
      selectedOptionScores: [3, 5, 0],
      selectedFlaggedCount: 0,
      flaggedWhenInputs: [],
    })
    expect(keys[TOTAL_SCORE_KEY]).toBe(8)
    expect(keys[FLAGGED_COUNT_KEY]).toBe(0)
  })

  it('empty selection → 0/0', () => {
    const keys = computeAggregateKeys({
      selectedOptionScores: [],
      selectedFlaggedCount: 0,
      flaggedWhenInputs: [],
    })
    expect(keys[TOTAL_SCORE_KEY]).toBe(0)
    expect(keys[FLAGGED_COUNT_KEY]).toBe(0)
  })

  it('counts selected flagged options (per-option)', () => {
    const keys = computeAggregateKeys({
      selectedOptionScores: [1, 2],
      selectedFlaggedCount: 2,
      flaggedWhenInputs: [],
    })
    expect(keys[FLAGGED_COUNT_KEY]).toBe(2)
  })

  it('adds number/date/time items whose flaggedWhen holds against their own answer', () => {
    const keys = computeAggregateKeys({
      selectedOptionScores: [],
      selectedFlaggedCount: 1,
      flaggedWhenInputs: [
        { answer: 10, flaggedWhen: { op: 'gt', value: 5 } }, // hit
        { answer: 3, flaggedWhen: { op: 'gt', value: 5 } }, // miss
        { answer: '2026-07-10', flaggedWhen: { op: 'gte', value: '2026-07-01' } }, // hit
        { answer: '08:30', flaggedWhen: { op: 'lt', value: '09:00' } }, // hit
        { answer: undefined, flaggedWhen: { op: 'gt', value: 0 } }, // no answer → miss
        { answer: 99, flaggedWhen: null }, // no flaggedWhen → skipped
      ],
    })
    // 1 selected-flagged + 3 flaggedWhen hits = 4
    expect(keys[FLAGGED_COUNT_KEY]).toBe(4)
  })

  it('flaggedWhen ops mirror evalCondition (equals / not_equals / lte)', () => {
    const eq = computeAggregateKeys({
      selectedOptionScores: [],
      selectedFlaggedCount: 0,
      flaggedWhenInputs: [{ answer: 7, flaggedWhen: { op: 'equals', value: 7 } }],
    })
    expect(eq[FLAGGED_COUNT_KEY]).toBe(1)
    const ne = computeAggregateKeys({
      selectedOptionScores: [],
      selectedFlaggedCount: 0,
      flaggedWhenInputs: [{ answer: 7, flaggedWhen: { op: 'not_equals', value: 7 } }],
    })
    expect(ne[FLAGGED_COUNT_KEY]).toBe(0)
    const lte = computeAggregateKeys({
      selectedOptionScores: [],
      selectedFlaggedCount: 0,
      flaggedWhenInputs: [{ answer: 5, flaggedWhen: { op: 'lte', value: 5 } }],
    })
    expect(lte[FLAGGED_COUNT_KEY]).toBe(1)
  })
})

describe('walkResultRuleset over injected aggregate keys (preview == backend)', () => {
  // Mirrors the SQL rule-walk: the ruleset keys on the reserved synthetic keys;
  // the preview merges computeAggregateKeys(...) into previewAnswers first.
  const ruleset: ResultRuleset = {
    rules: [
      { when: { question_key: FLAGGED_COUNT_KEY, op: 'gte', value: 2 }, result_id: 'high' },
      { when: { question_key: TOTAL_SCORE_KEY, op: 'gt', value: 5 }, result_id: 'mid' },
    ],
    default_result_id: 'low',
  }

  it('first-match on __flagged_count__ >= 2', () => {
    const answers: AnswerMap = {
      ...computeAggregateKeys({
        selectedOptionScores: [1, 1],
        selectedFlaggedCount: 2,
        flaggedWhenInputs: [],
      }),
    }
    expect(walkResultRuleset(ruleset, answers)).toBe('high')
  })

  it('falls through to __total_score__ > 5 when not enough flags', () => {
    const answers: AnswerMap = {
      ...computeAggregateKeys({
        selectedOptionScores: [4, 4],
        selectedFlaggedCount: 0,
        flaggedWhenInputs: [],
      }),
    }
    expect(walkResultRuleset(ruleset, answers)).toBe('mid')
  })

  it('default when neither aggregate rule fires', () => {
    const answers: AnswerMap = {
      ...computeAggregateKeys({
        selectedOptionScores: [1],
        selectedFlaggedCount: 0,
        flaggedWhenInputs: [],
      }),
    }
    expect(walkResultRuleset(ruleset, answers)).toBe('low')
  })
})
