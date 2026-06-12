import { describe, expect, it } from 'vitest'

import { evalCondition, type AnswerMap, type VisibleWhen } from './conditions'
import vectorsFile from './__fixtures__/condition-vectors.json'

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
