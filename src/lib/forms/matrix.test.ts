import { describe, expect, it } from 'vitest'

import type { MatrixAxisEntry, RiskBand } from '@/lib/queries/forms'

import {
  bandForScore,
  computeRiskScore,
  isMatrixComplete,
  isRiskComplete,
  missingMatrixRows,
  toAxisPayload,
  toBandPayload,
  validateAxes,
  validateBands,
  type AxisDraft,
} from './matrix'

/**
 * FF-2 (ADR 0089) — the pure matrix helpers.
 *
 * These cover the three rules that are easy to state and easy to get subtly
 * wrong: the score is a PRODUCT of two weights (not a sum, not a position
 * ladder), a band is the LAST threshold a score reaches (not the first), and a
 * required matrix is ROW-complete (not "at least one cell anywhere").
 */

function axis(
  code: string,
  label: string,
  weight: number | null = null,
  position = 0,
): MatrixAxisEntry {
  return { id: `id-${code}`, code, label, weight, position }
}

function draft(code: string, label: string, weight: number | null = null): AxisDraft {
  return { key: `k-${code}`, code, label, weight }
}

describe('computeRiskScore', () => {
  const rows = [axis('leve', 'Leve', 1), axis('grave', 'Grave', 9, 1)]
  const columns = [axis('rara', 'Rara', 1), axis('frequente', 'Frequente', 9, 1)]

  it('multiplies the two axis weights', () => {
    expect(
      computeRiskScore(rows, columns, { severity: 'grave', likelihood: 'frequente' }),
    ).toBe(81)
    expect(
      computeRiskScore(rows, columns, { severity: 'leve', likelihood: 'frequente' }),
    ).toBe(9)
  })

  it('is null with no selection, an unknown code, or a missing weight', () => {
    expect(computeRiskScore(rows, columns, undefined)).toBeNull()
    expect(
      computeRiskScore(rows, columns, { severity: 'nope', likelihood: 'rara' }),
    ).toBeNull()
    const unweighted = [axis('x', 'X', null)]
    expect(
      computeRiskScore(unweighted, columns, { severity: 'x', likelihood: 'rara' }),
    ).toBeNull()
  })
})

describe('bandForScore', () => {
  const bands: RiskBand[] = [
    { minScore: 0, label: 'Baixo', color: 'green' },
    { minScore: 9, label: 'Moderado', color: 'amber' },
    { minScore: 27, label: 'Alto', color: 'red' },
  ]

  it('takes the LAST band the score reaches, minScore inclusive', () => {
    expect(bandForScore(bands, 0)?.label).toBe('Baixo')
    expect(bandForScore(bands, 8)?.label).toBe('Baixo')
    expect(bandForScore(bands, 9)?.label).toBe('Moderado')
    expect(bandForScore(bands, 26)?.label).toBe('Moderado')
    expect(bandForScore(bands, 81)?.label).toBe('Alto')
  })

  it('re-sorts a mis-ordered list rather than trusting it', () => {
    const scrambled = [bands[2], bands[0], bands[1]]
    expect(bandForScore(scrambled, 9)?.label).toBe('Moderado')
  })

  it('is null with no score, no bands, or a score below every threshold', () => {
    expect(bandForScore(bands, null)).toBeNull()
    expect(bandForScore(null, 5)).toBeNull()
    expect(bandForScore([{ minScore: 10, label: 'Alto', color: null }], 5)).toBeNull()
  })
})

describe('matrix completeness (ruling 3 — row-complete)', () => {
  const rows = [axis('a', 'A'), axis('b', 'B', null, 1), axis('c', 'C', null, 2)]
  const columns = [axis('sim', 'Sim'), axis('nao', 'Não', null, 1)]

  it('one filled row does NOT satisfy a three-row matrix', () => {
    expect(isMatrixComplete(rows, columns, { a: 'sim' })).toBe(false)
    expect(missingMatrixRows(rows, columns, { a: 'sim' })).toEqual(['b', 'c'])
  })

  it('every row filled satisfies it', () => {
    expect(isMatrixComplete(rows, columns, { a: 'sim', b: 'nao', c: 'sim' })).toBe(true)
  })

  it('a cell pointing at a column that is not on the axis counts as unanswered', () => {
    // Unreachable through the coherence trigger, but treating a phantom cell as
    // an answer would let submit pass on a selection the filler cannot see.
    expect(missingMatrixRows(rows, columns, { a: 'ghost', b: 'sim', c: 'sim' })).toEqual([
      'a',
    ])
  })

  it('an axis-less matrix is vacuously complete (publish blocks it, not submit)', () => {
    expect(isMatrixComplete([], columns, undefined)).toBe(true)
  })
})

describe('isRiskComplete', () => {
  const rows = [axis('leve', 'Leve', 1)]
  const columns = [axis('rara', 'Rara', 1)]

  it('needs BOTH halves, each resolving on its axis', () => {
    expect(isRiskComplete(rows, columns, undefined)).toBe(false)
    expect(isRiskComplete(rows, columns, { severity: 'leve', likelihood: '' })).toBe(false)
    expect(isRiskComplete(rows, columns, { severity: 'leve', likelihood: 'x' })).toBe(false)
    expect(isRiskComplete(rows, columns, { severity: 'leve', likelihood: 'rara' })).toBe(
      true,
    )
  })
})

describe('validateAxes', () => {
  it('requires at least one row and one column', () => {
    expect(validateAxes([], [draft('c', 'C')], false)).toMatch(/linha/i)
    expect(validateAxes([draft('r', 'R')], [], false)).toMatch(/coluna/i)
  })

  it('rejects a blank label and a duplicate label', () => {
    expect(validateAxes([draft('r', '')], [draft('c', 'C')], false)).toMatch(/rótulo/i)
    expect(
      validateAxes([draft('r1', 'Igual'), draft('r2', 'igual')], [draft('c', 'C')], false),
    ).toMatch(/mesmo rótulo/i)
  })

  it('demands a weight on EVERY entry of BOTH axes for a risk matrix (HC0P6)', () => {
    const rows = [draft('r', 'R', 1)]
    const columns = [draft('c', 'C', null)]
    expect(validateAxes(rows, columns, true)).toMatch(/peso/i)
    expect(validateAxes(rows, [draft('c', 'C', 3)], true)).toBeNull()
    // The same gap is fine for a plain matrix, which has no use for weights.
    expect(validateAxes(rows, columns, false)).toBeNull()
  })
})

describe('toAxisPayload', () => {
  it('sends positions by index and drops weights for a plain matrix', () => {
    const entries = [draft('a', ' A ', 5), draft('b', 'B', 9)]
    expect(toAxisPayload(entries, false)).toEqual([
      { code: 'a', label: 'A', position: 0, weight: null },
      { code: 'b', label: 'B', position: 1, weight: null },
    ])
    expect(toAxisPayload(entries, true)[0].weight).toBe(5)
  })
})

describe('band serialization', () => {
  it('sorts ascending by minScore regardless of author order', () => {
    const drafts = [
      { key: '1', minScore: '27', label: 'Alto', color: null },
      { key: '2', minScore: '0', label: 'Baixo', color: null },
      { key: '3', minScore: '9', label: 'Médio', color: null },
    ]
    expect(toBandPayload(drafts).map((b) => b.label)).toEqual([
      'Baixo',
      'Médio',
      'Alto',
    ])
  })

  it('accepts a comma decimal and rejects a duplicate threshold', () => {
    expect(
      toBandPayload([{ key: '1', minScore: '1,5', label: 'X', color: null }])[0].minScore,
    ).toBe(1.5)
    expect(
      validateBands([
        { key: '1', minScore: '9', label: 'A', color: null },
        { key: '2', minScore: '9', label: 'B', color: null },
      ]),
    ).toMatch(/mesma pontuação/i)
  })

  it('rejects a blank label or a non-numeric threshold', () => {
    expect(validateBands([{ key: '1', minScore: '9', label: '', color: null }])).toMatch(
      /rótulo/i,
    )
    expect(
      validateBands([{ key: '1', minScore: 'abc', label: 'A', color: null }]),
    ).toMatch(/numérica/i)
  })
})
