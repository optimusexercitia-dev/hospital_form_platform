import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { isValidCondition } from './condition-shape'
import vectorsFile from '@/lib/queries/__fixtures__/condition-validator-vectors.json'

interface Vector {
  name: string
  condition: unknown
  expected: boolean
}

const vectors = (vectorsFile as unknown as { vectors: Vector[] }).vectors

// ---------------------------------------------------------------------------
// BUG-FF3-002 — the VALIDATOR pair, now vectored like the evaluator pair.
//
// B5 widened `app.is_valid_condition` to eleven operators; this side stayed at
// seven. Nothing caught it, and the list of what did not catch it is the reason
// this file exists: pgTAP passed because SQL was correct, tsc and lint passed
// because the TS was well-formed, and the DB-level verification called
// `validate_visible_when` directly on a cloned draft — the layer BELOW the
// server action — so the only path the UI can reach was never exercised.
// ---------------------------------------------------------------------------
describe('isValidCondition (TS mirror of app.is_valid_condition)', () => {
  it.each(vectors.map((v) => [v.name, v] as const))('%s', (_name, v) => {
    expect(isValidCondition(v.condition)).toBe(v.expected)
  })

  it('covers every operator the mirror accepts', () => {
    // A new operator with no vector is an operator whose two halves are free to
    // disagree — exactly the state B5 left behind.
    const seen = new Set(
      vectors
        .map((v) => (v.condition as { op?: unknown })?.op)
        .filter((op): op is string => typeof op === 'string'),
    )
    for (const op of [
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
    ]) {
      expect(seen, `no vector exercises "${op}"`).toContain(op)
    }
  })

  it('accepts a unary op with the value key ABSENT and with it null', () => {
    // The builder currently emits `value: null` (a PRESENT key), so the absent
    // case is not what the bug tripped on — but SQL accepts both and a stricter
    // twin is how this class recurs. Pinned in both spellings deliberately.
    expect(isValidCondition({ question_key: 'q', op: 'is_empty' })).toBe(true)
    expect(
      isValidCondition({ question_key: 'q', op: 'is_empty', value: null }),
    ).toBe(true)
  })

  it('still requires a value for every NON-unary operator', () => {
    // The relaxation is BY NAME. Making `value` optional globally would admit
    // `{"op":"equals"}`, which SQL refuses.
    expect(isValidCondition({ question_key: 'q', op: 'equals' })).toBe(false)
    expect(isValidCondition({ question_key: 'q', op: 'contains' })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// TS-only narrowings — the THREE places this side is deliberately STRICTER than
// SQL. Enumerated here, and deliberately absent from the shared vector file, so
// the vectors can stay a pure mirror and a future divergence cannot hide among
// intentional ones.
//
// Each is safe for the same reason: it rejects something the PUBLISH authority
// would reject anyway, so the author gets an authoring-time message instead of a
// publish-time dead end. "Stricter" is not automatically wrong — unreviewed is.
// ---------------------------------------------------------------------------
describe('TS-only narrowings (stricter than SQL, by design)', () => {
  it('1 — refuses a BLANK question_key (SQL stores it; it can never resolve)', () => {
    expect(isValidCondition({ question_key: '', op: 'equals', value: 'a' })).toBe(false)
  })

  it('2 — refuses `in` whose value is not an array', () => {
    expect(isValidCondition({ question_key: 'q', op: 'in', value: 'a' })).toBe(false)
  })

  it('3 — refuses an ordered op whose value IS an array', () => {
    expect(isValidCondition({ question_key: 'q', op: 'gt', value: [1, 2] })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// The drift detector, same shape as the evaluator pair's: the pgTAP file embeds
// the fixture's bytes, and this asserts the embedded copy still parses equal.
// Edit either side alone and this goes red.
// ---------------------------------------------------------------------------
describe('SQL<->TS validator vector drift detector', () => {
  it('275_condition_validator_parity.sql embeds the SAME vectors', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase', 'tests', '275_condition_validator_parity.sql'),
      'utf8',
    )
    const marker = '$vectors$'
    const start = sql.indexOf(marker)
    const end = sql.indexOf(marker, start + marker.length)
    expect(start, 'the pgTAP file must embed the vectors').toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    expect(JSON.parse(sql.slice(start + marker.length, end))).toEqual(
      JSON.parse(JSON.stringify(vectorsFile)),
    )
  })
})
