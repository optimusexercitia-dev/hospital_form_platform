import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { personScopeAllows, type PersonScopeCapability } from './person-scope'

/**
 * AE1.3 / ADR 0161 — the TS half of the shared person-authority vectors.
 *
 * ⭐ WHY THIS FILE EXISTS AT ALL. ADR 0133 D4 refused to build a SQL twin of
 * `personScopeAllows`, and one of its stated reasons was that a mirror is a DRIFT
 * LIABILITY. ADR 0155 G11 reversed the refusal and `app.can_administer_person_for` is now
 * live, so Architecture Rule 3 genuinely attaches to the pair. Building the mirror without
 * the drift control would accept exactly the liability the original prohibition warned
 * about — so there is ONE case list, and both halves are driven from it.
 *
 * This file is one of the two things that can red:
 *   - the JSON edited without regenerating the .psql, or the .psql hand-edited -> §1
 *   - `personScopeAllows` disagreeing with a vector                            -> §2
 * The SQL half's disagreement reds in pgTAP 384 §9, against the same rows.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const JSON_PATH = join(ROOT, 'src', 'lib', 'users', '__fixtures__', 'person-scope-vectors.json')
const PSQL_PATH = join(ROOT, 'supabase', 'tests', 'vectors', 'person_scope_vectors.psql')

interface Vector {
  shape: string
  capability: PersonScopeCapability
  footprint: string[]
  tier: boolean
  administered: string[]
  expect: boolean
}

const rawBytes = readFileSync(JSON_PATH)
const { vectors } = JSON.parse(rawBytes.toString('utf8')) as { vectors: Vector[] }

describe('person-scope shared vectors', () => {
  describe('§1 the generated SQL fixture is in sync with this file', () => {
    it('carries the sha256 of the JSON’s EXACT BYTES', () => {
      // Hashing the raw bytes rather than the parsed object is deliberate: a reformat is
      // a change worth noticing, because the .psql is generated from the bytes.
      const sha = createHash('sha256').update(rawBytes).digest('hex')
      const generated = readFileSync(PSQL_PATH, 'utf8')
      expect(generated).toContain(`-- sourceSha256: ${sha}`)
    })

    it('contains one row per vector, so the SQL half cannot silently see fewer', () => {
      const generated = readFileSync(PSQL_PATH, 'utf8')
      const rows = generated
        .split('\n')
        .filter((line) => /^\s{4}\('S\d+', '/.test(line)).length
      expect(rows).toBe(vectors.length)
    })
  })

  describe('§2 personScopeAllows agrees with every vector', () => {
    // ⛔ A CARDINALITY CONTROL FIRST. Every assertion below iterates the vector list, so an
    // empty or truncated list would make this whole describe block pass having asserted
    // nothing — the recorded "a detector that finds nothing" shape.
    it('has a non-trivial vector population covering all four capabilities', () => {
      expect(vectors.length).toBeGreaterThanOrEqual(32)
      expect(new Set(vectors.map((v) => v.capability))).toEqual(
        new Set(['fields', 'credentials', 'cpf_change', 'lifecycle']),
      )
    })

    // ⭐ AND THE ONE SHAPE THAT CAN DETECT A BOUND SWAP MUST BE PRESENT. A vector list of
    // only sole-footprint cases passes under EITHER bound; asserting the list is "big" does
    // not assert it is DISCRIMINATING. This pins that S4 exists and that its four rows do
    // not all expect the same answer.
    it('contains the spanning differential, and it actually differentiates', () => {
      const s4 = vectors.filter((v) => v.shape === 'S4')
      expect(s4).toHaveLength(4)
      expect(new Set(s4.map((v) => v.expect))).toEqual(new Set([true, false]))
    })

    it.each(vectors.map((v) => [`${v.shape} ${v.capability} fp=[${v.footprint}] tier=${v.tier} adm=[${v.administered}]`, v] as const))(
      '%s',
      (_label, v) => {
        expect(
          personScopeAllows(
            v.capability,
            { hospitalIds: v.footprint, hasNonCommissionTierMembership: v.tier },
            v.administered,
          ),
        ).toBe(v.expect)
      },
    )
  })
})
