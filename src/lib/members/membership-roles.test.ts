import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import rolesFixture from './__fixtures__/membership-roles.json'

/**
 * BUG-AFF-N1 — the membership-role fixture's drift detector.
 *
 * ⚠ THE PROBLEM THIS SOLVES, stated precisely so nobody credits this file with more than
 * it does. `memberships_role_check` is a **CHECK over `text`, not a Postgres enum**, so
 * the role list appears NOWHERE in `src/lib/types/database.ts`
 * (`grep technical_director_deputy` → no hits). No unit test can reach the authority. A UI
 * test that transcribes the list therefore cannot notice a widening; it silently ships an
 * English identifier into pt-BR copy, which is exactly what BUG-AFF-F1 was — and a header
 * claiming "if backend widens that CHECK, this test goes red" was false, because Vitest
 * cannot see the database at all.
 *
 * So this is the CPF-vectors pattern: ONE authority, a committed fixture, a gate at EACH
 * end of the chain.
 *
 *   authority   `memberships_role_check`  (pg_constraint — the only truth)
 *      │
 *      ├─ pgTAP `304` §10 : fixture set == live CHECK set, exact, both directions
 *      ├─ THIS FILE       : the JSON file == the copy embedded in `304`
 *      └─ the UI test     : every role in the JSON has a pt-BR label (frontend-owned)
 *
 * Widen the CHECK and the loop runs: `304` reds (fixture stale) → the author regenerates
 * the fixture → the UI test reds (missing label). Break any single link and one of the
 * three gates reds.
 *
 * ⚠ WHAT IT DOES NOT DO: it does not observe the database, it does not fire at runtime,
 * and it does not fire until the suites run. It is a build-time gate, not a guard. The
 * defect being fixed here was a comment that claimed a power the code lacked, so this
 * paragraph exists to keep that from happening twice.
 */

interface RolesFixture {
  authority: string
  generatedFrom: string
  roles: string[]
}

const fixture = rolesFixture as RolesFixture

describe('membership-roles fixture', () => {
  it('names its authority, so a reader knows what to regenerate it from', () => {
    expect(fixture.authority).toBe('memberships_role_check')
    expect(fixture.generatedFrom).toBe('pg_constraint')
  })

  it('carries a plausible, duplicate-free role set', () => {
    // A trivially-empty fixture would satisfy the pgTAP set-equality assertion only if the
    // live set were empty too — but it would satisfy the UI's label check vacuously, so the
    // shape is pinned here rather than assumed.
    expect(fixture.roles.length).toBeGreaterThan(5)
    expect(new Set(fixture.roles).size, 'duplicate role in the fixture').toBe(
      fixture.roles.length,
    )
    for (const role of fixture.roles) expect(role).toMatch(/^[a-z][a-z_]*$/)
  })

  it('⭐ pgTAP 304 embeds the SAME fixture (neither side can be edited alone)', () => {
    // The link that makes the loop real. `304` cannot read this file — the database runs
    // in a container — so it embeds a copy between `$roles$` markers, and this asserts the
    // two still parse equal. Same mechanism as the CPF vectors.
    const sql = readFileSync(
      join(process.cwd(), 'supabase', 'tests', '304_affiliation_lifecycle.sql'),
      'utf8',
    )
    const marker = '$roles$'
    const start = sql.indexOf(marker)
    const end = sql.indexOf(marker, start + marker.length)
    expect(start, 'pgTAP 304 must embed the role fixture').toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    expect(JSON.parse(sql.slice(start + marker.length, end))).toEqual(
      JSON.parse(JSON.stringify(fixture)),
    )
  })
})
