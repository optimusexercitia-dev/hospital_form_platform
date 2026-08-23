import { describe, expect, it } from 'vitest'

import vectors from './__fixtures__/status-vectors.json'
import {
  deriveUserStatus,
  statusesInFilter,
  parseUserDirectoryStatusFilter,
  type UserDirectoryStatusFilter,
  type UserStatus,
} from './types'

/**
 * AFF2 B7 — binds the directory's `?status=` buckets to the SAME fixture that pins
 * `deriveUserStatus`, so the filter and the display badge cannot drift.
 *
 * ⛔ WHY A BINDING IS NEEDED AT ALL. `status` is DERIVED, not a column, so a server-side
 * filter has to be expressed as column predicates — a second REPRESENTATION of one rule.
 * Architecture Rule 3's mechanism for that is a single shared vector fixture read by both
 * sides, and this is it, applied to a TS↔TS pair because there is deliberately no SQL side
 * (see the note on `deriveUserStatus`: building one would manufacture a parity obligation
 * between two predicates designed to disagree on `email_confirmed_at`).
 *
 * ⚠ WHAT THIS FILE DOES NOT COVER, STATED SO IT IS NOT READ AS MORE THAN IT IS. The final
 * rendering into PostgREST filter syntax (`suspended_until.gt.…`, `email_confirmed_at.is.null`)
 * is a string evaluated by PostgREST, not by Vitest — no unit test can execute it. What is
 * pinned here is the RULE: which display statuses each bucket admits, and that the buckets
 * partition. A drift between the rule and the string it is rendered into is caught by the
 * tester's directory-pill E2E (counts vs seeded statuses), not here. §4 keeps the two
 * adjacent so a reviewer reads them together.
 */

const ALL_STATUSES: UserStatus[] = ['pending', 'active', 'suspended', 'deactivated']
const ALL_FILTERS: UserDirectoryStatusFilter[] = ['active', 'attention', 'deactivated']

/**
 * ⚠ SNAKE_CASE, matching the fixture on disk. Written camelCase first, and only ONE of the
 * nine arms below caught it: every column read `undefined`, so `deriveUserStatus` returned
 * `deactivated` for all nine vectors — and §2, §3 and §4 all PASSED, because each compares
 * two things computed from the same broken input. The single arm that failed is the one
 * comparing against the fixture's own recorded `expected`. That arm is load-bearing, not
 * ceremony.
 */
interface VectorCase {
  name: string
  is_active: boolean
  suspended_until: string | null
  email_confirmed_at: string | null
  expected: UserStatus
}
const cases = vectors.cases as unknown as VectorCase[]
const now = new Date(vectors.now)

describe('§1 the fixture is fit to bind against', () => {
  it('⭐ every one of the four display statuses is REPRESENTED', () => {
    // ⛔ THE ASSERTION THAT KEEPS §2 FROM GOING HOLLOW. §2 walks the fixture and checks each
    // case lands in the right bucket — so a status with ZERO vectors is simply never
    // checked, and its predicates become unbound while every test stays green. Measured at
    // the time of writing: active 3, deactivated 3, suspended 2, and `pending` exactly ONE.
    // One edit away from unbinding the pending bucket, silently. A detector that finds
    // nothing must be proven able to find something.
    const present = new Set(cases.map((c) => c.expected))
    for (const status of ALL_STATUSES) {
      expect(present.has(status), `no vector produces "${status}" — its bucket is unbound`).toBe(true)
    }
  })

  it('every vector agrees with deriveUserStatus (the fixture is not stale)', () => {
    // If the fixture's own `expected` had drifted from the function, §2 would be binding
    // the buckets to a fiction.
    // ⛔ UNCONDITIONAL FIRST. Every other assertion here lives inside a loop over `cases`,
    // so an emptied or renamed fixture would make this test pass having asserted NOTHING —
    // caught by `lint:vacuous`, in the very file written to prevent that class. The count is
    // the floor measured at authoring time, so shrinking the fixture reds rather than
    // silently narrowing the binding.
    expect(cases.length, 'the fixture must not be empty or shrunk').toBeGreaterThanOrEqual(9)
    for (const c of cases) {
      expect(
        deriveUserStatus(c.is_active, c.suspended_until, c.email_confirmed_at, now),
        c.name,
      ).toBe(c.expected)
    }
  })
})

describe('§2 each vector lands in EXACTLY ONE bucket', () => {
  it('⭐ in its own bucket, AND IN NO OTHER', () => {
    // The "and no other" half is what makes the three buckets a PARTITION rather than
    // three independent predicates that happen to overlap. Without it, a bucket defined as
    // "everything" would pass the positive check for every case.
    // ⛔ UNCONDITIONAL FIRST. Every other assertion here lives inside a loop over `cases`,
    // so an emptied or renamed fixture would make this test pass having asserted NOTHING —
    // caught by `lint:vacuous`, in the very file written to prevent that class. The count is
    // the floor measured at authoring time, so shrinking the fixture reds rather than
    // silently narrowing the binding.
    expect(cases.length, 'the fixture must not be empty or shrunk').toBeGreaterThanOrEqual(9)
    for (const c of cases) {
      const status = deriveUserStatus(c.is_active, c.suspended_until, c.email_confirmed_at, now)
      const matching = ALL_FILTERS.filter((f) => statusesInFilter(f).includes(status))
      expect(matching, `${c.name} (${status}) must match exactly one bucket`).toHaveLength(1)
    }
  })

  it('the buckets between them cover every display status', () => {
    // The complement of the assertion above: one bucket each, and none left out. A status
    // covered by NO bucket would be invisible to every pill while still counting toward
    // `all` — the row would exist and no filter would show it.
    const covered = new Set(ALL_FILTERS.flatMap((f) => statusesInFilter(f)))
    for (const status of ALL_STATUSES) {
      expect(covered.has(status), `"${status}" belongs to no pill`).toBe(true)
    }
  })

  it('`attention` is exactly suspended ∪ pending', () => {
    expect(new Set(statusesInFilter('attention'))).toEqual(new Set(['suspended', 'pending']))
  })
})

describe('§3 the counts partition — `all` may be the SUM', () => {
  it('⭐ summing the three buckets over the fixture equals the total', () => {
    // `OrgUserPage.statusCounts.all` is computed as active + attention + deactivated rather
    // than by a fourth query. That is only valid because the buckets partition — pinned
    // here over real vectors instead of assumed from the shape of the switch statement.
    const perBucket = ALL_FILTERS.map(
      (f) =>
        cases.filter((c) =>
          statusesInFilter(f).includes(
            deriveUserStatus(c.is_active, c.suspended_until, c.email_confirmed_at, now),
          ),
        ).length,
    )
    expect(perBucket.reduce((a, b) => a + b, 0)).toBe(cases.length)
  })
})

describe('§4 the column logic the PostgREST predicates render', () => {
  /**
   * The SPECIFICATION `applyStatusFilter` implements, written over the same three columns.
   *
   * ⚠ THIS IS THE SPEC, NOT A COPY OF THE IMPLEMENTATION. It exists so the column-level
   * reasoning — "active and attention BOTH require is_active; they split on
   * suspended_until against now" — is checked against `deriveUserStatus` over real
   * vectors. `applyStatusFilter` renders the same three cases into PostgREST syntax; that
   * rendering is what a reviewer must read beside this, and what E2E exercises for real.
   */
  function specMatches(
    f: UserDirectoryStatusFilter,
    c: VectorCase,
    at: Date,
  ): boolean {
    if (f === 'deactivated') return !c.is_active
    if (!c.is_active) return false
    const suspended =
      c.suspended_until !== null && new Date(c.suspended_until).getTime() > at.getTime()
    if (f === 'active') return !suspended && c.email_confirmed_at !== null
    return suspended || c.email_confirmed_at === null // attention
  }

  it('⭐ the column spec agrees with deriveUserStatus on EVERY vector, for EVERY bucket', () => {
    // ⛔ UNCONDITIONAL FIRST. Every other assertion here lives inside a loop over `cases`,
    // so an emptied or renamed fixture would make this test pass having asserted NOTHING —
    // caught by `lint:vacuous`, in the very file written to prevent that class. The count is
    // the floor measured at authoring time, so shrinking the fixture reds rather than
    // silently narrowing the binding.
    expect(cases.length, 'the fixture must not be empty or shrunk').toBeGreaterThanOrEqual(9)
    for (const c of cases) {
      const status = deriveUserStatus(c.is_active, c.suspended_until, c.email_confirmed_at, now)
      for (const f of ALL_FILTERS) {
        expect(
          specMatches(f, c, now),
          `${c.name} (${status}) vs bucket "${f}"`,
        ).toBe(statusesInFilter(f).includes(status))
      }
    }
  })
})

describe('§5 the query-parameter parse', () => {
  it('accepts exactly the three bucket names', () => {
    for (const f of ALL_FILTERS) {
      expect(parseUserDirectoryStatusFilter(f)).toBe(f)
    }
  })

  it('degrades unknown, absent and display-status values to null (= all)', () => {
    // ⚠ `pending` and `suspended` are DISPLAY statuses, not filter buckets — a hand-edited
    // or stale-bookmark `?status=pending` must fall back to "all", never 500 a directory
    // and never silently mean `attention`.
    for (const raw of [null, undefined, '', 'ATIVOS', 'pending', 'suspended', 'all', 'Active']) {
      expect(parseUserDirectoryStatusFilter(raw), `raw=${String(raw)}`).toBeNull()
    }
  })
})
