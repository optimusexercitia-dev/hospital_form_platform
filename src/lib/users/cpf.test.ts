import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { isValidCpf, normalizeCpf } from './cpf'
import vectorsFile from './__fixtures__/cpf-vectors.json'

interface Vector {
  name: string
  cpf: string
  expected: boolean
}

const vectors = (vectorsFile as unknown as { vectors: Vector[] }).vectors

// ---------------------------------------------------------------------------
// ADR 0097 D7 — the CPF pair, vectored like the condition evaluator/validator pairs.
//
// The SQL half is an integrity boundary (a CHECK on profiles.cpf), so a TS half that
// drifts LOOSE lets the UI offer a value the database will refuse with a raw 23514,
// and a TS half that drifts STRICT refuses a CPF the database would have accepted.
// Neither is visible to tsc, lint, or pgTAP alone — only to a shared vector file.
// ---------------------------------------------------------------------------
describe('isValidCpf (TS mirror of app.is_valid_cpf)', () => {
  it.each(vectors.map((v) => [v.name, v] as const))('%s', (_name, v) => {
    expect(isValidCpf(v.cpf)).toBe(v.expected)
  })

  it('exercises both arms of the r < 2 rule on BOTH check digits', () => {
    // A vector set that only ever took the `11 - r` arm would leave the zero arm
    // free to disagree between the two engines — the shape that let the validator
    // pair drift by four operators (BUG-FF3-002).
    const valid = vectors.filter((v) => v.expected).map((v) => v.cpf)
    expect(valid, 'no vector takes the zero arm on the FIRST check digit').toContain(
      '12345678909',
    )
    expect(valid, 'no vector takes the zero arm on BOTH check digits').toContain(
      '98765432100',
    )
  })
})

describe('normalizeCpf', () => {
  it('strips punctuation to the storage form', () => {
    expect(normalizeCpf('111.444.777-35')).toBe('11144477735')
    expect(normalizeCpf(' 111 444 777 35 ')).toBe('11144477735')
  })

  it('does NOT validate — normalization and validation are separate steps', () => {
    // Normalizing junk yields junk; the caller must still validate. Pinned because
    // "it normalized, so it must be fine" is how a 23514 reaches the UI.
    expect(normalizeCpf('abc')).toBe('')
    expect(isValidCpf(normalizeCpf('abc'))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// The drift detector, same shape as the condition-validator pair's: the pgTAP file
// embeds the fixture's bytes, and this asserts the embedded copy still parses equal.
// Edit either side alone and this goes red.
// ---------------------------------------------------------------------------
describe('SQL<->TS CPF vector drift detector', () => {
  it('301_hospital_affiliation_substrate.sql embeds the SAME vectors', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase',
        'tests',
        '301_hospital_affiliation_substrate.sql',
      ),
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
