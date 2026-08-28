import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * ⭐⭐ ADR 0164 detector logging — round-2 finding R2-m4. A MODULE PROPERTY, deliberately,
 * because the runtime path is unreachable from the unit fixtures.
 *
 * THE DEFECT THIS PINS. `isTenantOrphan` used to log the entire platform-wide orphan set
 * — every `profileId` and `reason` — on the failure branches of `registerUser`. That
 * action has exactly one entry point, `/o/[org]/manage/usuarios/novo`, driven by an
 * `org_admin` or a `hospital_admin`. So one tenant's request log received the
 * cross-tenant orphan roster: precisely the id set `app.tenant_orphan_profiles()` is
 * `postgres`-only in order to withhold, because it "enumerates people no tenant admin can
 * reach". The RPC still returns the whole set — that is its contract, and the `is_admin`
 * discrimination lives inside it. What is bounded here is what LEAVES THE PROCESS.
 *
 * ⛔ WHY A SOURCE PROPERTY AND NOT A BEHAVIOURAL TEST. `isTenantOrphan` is not exported,
 * and the shared `rpc` mock in `d14-person-level.test.ts` returns `{ error: null }`
 * unconditionally, so the failure branch that logs cannot be reached without changing a
 * fixture 55 other tests depend on. Exporting a private helper, or widening that mock, to
 * buy a witness would be a larger change than the fix. This is the same trade
 * `org-roster-predicate.test.ts` makes, in the same idiom.
 *
 * ⚠ THE BOUND, STATED RATHER THAN IMPLIED. It reads SOURCE TEXT. It cannot see an
 * enumeration built indirectly (`const ids = orphans.map(...)` on one line, interpolated
 * on another), and it says nothing about whether the log is correct — only that the
 * plural set is not spilled inline. It is a floor, and the floor is the half that scales.
 * ⭐ The self-test below is what stops it being a regex that matches nothing forever.
 */

const ACTIONS = readFileSync(join(process.cwd(), 'src/lib/users/actions.ts'), 'utf8')

/** Strip line and block comments, so a comment DESCRIBING the old shape is not a hit. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/**
 * The spill shape: a template literal that maps over the orphan collection. Positive
 * pattern, so it needs no exception list — `orphans.find(...)`, `orphans.some(...)` and a
 * bare `orphans.length` are all legitimate and unmatched.
 */
const ENUMERATES_THE_SET = /\$\{\s*orphans[\s\S]{0,80}?\.map\s*\(/

describe('ADR 0164 detector logging — the platform-wide set never reaches a tenant log', () => {
  it('⭐⭐ `actions.ts` interpolates NO mapped orphan collection into any log line', () => {
    expect(ENUMERATES_THE_SET.test(stripComments(ACTIONS))).toBe(false)
  })

  it('⛔ SELF-TEST: the pattern really does match the shape that shipped', () => {
    // Verbatim the expression removed by this increment. Without this cell the assertion
    // above is satisfied by a regex that can no longer match anything — the dominant
    // failure family in this repo, and the reason a detector that finds nothing must be
    // proven able to find something.
    const shipped =
      '`[tenant-orphan] ${orphans.length} profile(s): ${orphans.map((o) => o.profileId).join(", ")}`'
    expect(ENUMERATES_THE_SET.test(shipped)).toBe(true)
  })

  it('⛔ SELF-TEST: it does NOT match the legitimate single-subject shapes', () => {
    // The replacement, and the two collection uses that must stay allowed. A pattern that
    // also matched these would force the fix to be written around the test.
    expect(
      ENUMERATES_THE_SET.test('`[tenant-orphan] ${userId} has no affiliation (${self.reason})`'),
    ).toBe(false)
    expect(ENUMERATES_THE_SET.test('const self = orphans.find((o) => o.profileId === userId)')).toBe(
      false,
    )
    expect(ENUMERATES_THE_SET.test('return orphans.some((o) => o.profileId === userId)')).toBe(false)
  })

  it('⭐ NON-VACUITY OF THE SUBJECT: the file really does still call the detector', () => {
    // Without this, the property above goes green the day `isTenantOrphan` is deleted —
    // absence reading identically to compliance. ADR 0164's mitigation existing at all is
    // the precondition for asking what it logs.
    const src = stripComments(ACTIONS)
    expect(src).toContain('listTenantOrphans')
    expect(src).toContain('[tenant-orphan]')
  })
})
