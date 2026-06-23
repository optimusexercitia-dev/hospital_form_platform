import { describe, expect, it } from 'vitest'

import {
  evalCondition,
  evalVisibility,
  type AnswerMap,
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
