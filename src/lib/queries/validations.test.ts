import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  VALIDATION_RULE_TYPES,
  evalValidation,
  isValidationRuleAllowed,
  itemIsRequired,
  validationValueIsEmpty,
  type ValidationContext,
  type ValidationRuleSpec,
  type ValidationRuleType,
} from './validations'
import type { AnswerMap } from './conditions'
import vectorsFile from './__fixtures__/validation-vectors.json'

interface RawVector {
  name: string
  rule_type: ValidationRuleType
  config: Record<string, unknown>
  value: unknown
  answers: AnswerMap
  peer_values: unknown[]
  expected: boolean
}

const vectors = (vectorsFile as unknown as { vectors: RawVector[] }).vectors

/**
 * The fixture is untyped JSON by necessity (the same bytes feed Postgres). This
 * is the one place the widening happens, and it is load-bearing that it happens
 * ONCE: `evalValidation` takes the discriminated `ValidationRuleSpec`, so a
 * vector naming a rule type with the wrong config shape is a runtime surprise
 * rather than a compile error. The `rule_type` round-trip below is what keeps a
 * typo in the fixture from silently exercising nothing.
 */
function toSpec(v: RawVector): ValidationRuleSpec {
  expect(VALIDATION_RULE_TYPES).toContain(v.rule_type)
  return {
    ruleType: v.rule_type,
    config: v.config,
  } as ValidationRuleSpec
}

describe('evalValidation (TS mirror of app.eval_validation)', () => {
  it.each(vectors.map((v) => [v.name, v] as const))('%s', (_name, v) => {
    const ctx: ValidationContext = {
      answers: v.answers,
      peerValues: v.peer_values as ValidationContext['peerValues'],
    }
    expect(evalValidation(toSpec(v), v.value as never, ctx)).toBe(v.expected)
  })

  it('covers every rule type — a type with no vector is untested on both sides', () => {
    const covered = new Set(vectors.map((v) => v.rule_type))
    expect([...VALIDATION_RULE_TYPES].filter((t) => !covered.has(t))).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// THE DRIFT DETECTOR (FF-1 QA's INFO-4).
//
// The condition vectors have been maintained in TWO places by hand since ADR
// 0005 — a JSON fixture and a `insert into vectors ... values` block in
// `supabase/tests/20_conditions.sql` — with nothing but discipline keeping them
// equal. FF-3 adds a SECOND evaluator pair, so this pair does it differently:
// the pgTAP file embeds the fixture's bytes inside one `$json$ … $json$` literal
// and this test asserts the embedded copy still parses to the same value.
//
// Edit either side alone and this goes red, which is the property "we must keep
// them in sync" never had.
// ---------------------------------------------------------------------------

describe('SQL<->TS vector drift detector', () => {
  const sqlPath = join(
    process.cwd(),
    'supabase',
    'tests',
    '274_ff3_validations.sql',
  )

  it('274_ff3_validations.sql embeds the SAME vectors as the fixture', () => {
    const sql = readFileSync(sqlPath, 'utf8')
    const marker = '$vectors$'
    const start = sql.indexOf(marker)
    const end = sql.indexOf(marker, start + marker.length)
    expect(start, 'the pgTAP file must embed the vectors in a $vectors$ literal').
      toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)

    const embedded = sql.slice(start + marker.length, end)
    expect(JSON.parse(embedded)).toEqual(
      JSON.parse(JSON.stringify(vectorsFile)),
    )
  })
})

// ---------------------------------------------------------------------------
// The two predicates that have no vector file because their SQL mirrors are
// trivial: coverage and required-ness. Both are pinned in pgTAP too (274 §A/§D).
// ---------------------------------------------------------------------------

describe('isValidationRuleAllowed (TS mirror of app.validation_rule_allowed)', () => {
  it('pairs each rule with its own item types', () => {
    expect(isValidationRuleAllowed('number_range', 'number', null)).toBe(true)
    expect(isValidationRuleAllowed('number_range', 'short_text', null)).toBe(false)
    expect(isValidationRuleAllowed('text_length', 'free_text', null)).toBe(true)
    expect(isValidationRuleAllowed('regex', 'short_text', null)).toBe(true)
    expect(isValidationRuleAllowed('date_range', 'time', null)).toBe(true)
    expect(isValidationRuleAllowed('datetime_order', 'date', null)).toBe(true)
  })

  it('refuses containers, display items, matrices and references', () => {
    for (const t of [
      'group',
      'repeating_group',
      'section_text',
      'image',
      'matrix',
      'risk_matrix',
      'reference',
    ]) {
      for (const rule of VALIDATION_RULE_TYPES) {
        expect(
          isValidationRuleAllowed(rule, t, 'repeating_group'),
          `${rule} must not attach to ${t}`,
        ).toBe(false)
      }
    }
  })

  it('unique_within_group needs a repeating_group parent, not just a scalar type', () => {
    expect(isValidationRuleAllowed('unique_within_group', 'short_text', 'repeating_group')).toBe(true)
    expect(isValidationRuleAllowed('unique_within_group', 'short_text', 'group')).toBe(false)
    expect(isValidationRuleAllowed('unique_within_group', 'short_text', null)).toBe(false)
  })
})

describe('itemIsRequired (TS mirror of app.item_is_required)', () => {
  it('a statically required item is required regardless of required_if', () => {
    expect(itemIsRequired(true, null, {})).toBe(true)
  })

  it('required_if true makes it required; false does not', () => {
    const cond = { question_key: 'q1', op: 'equals' as const, value: 'sim' }
    expect(itemIsRequired(false, cond, { q1: 'sim' })).toBe(true)
    expect(itemIsRequired(false, cond, { q1: 'nao' })).toBe(false)
    expect(itemIsRequired(false, cond, {})).toBe(false)
  })

  it('no required_if and not required means not required', () => {
    expect(itemIsRequired(false, null, { q1: 'sim' })).toBe(false)
  })
})

describe('validationValueIsEmpty', () => {
  it('treats absent / null / empty string / empty array as empty', () => {
    expect(validationValueIsEmpty(undefined)).toBe(true)
    expect(validationValueIsEmpty(null)).toBe(true)
    expect(validationValueIsEmpty('')).toBe(true)
    expect(validationValueIsEmpty([])).toBe(true)
  })

  it('does NOT treat 0, false, whitespace or [null] as empty', () => {
    expect(validationValueIsEmpty(0)).toBe(false)
    expect(validationValueIsEmpty(false)).toBe(false)
    expect(validationValueIsEmpty(' ')).toBe(false)
    expect(validationValueIsEmpty([null])).toBe(false)
  })
})
