import { describe, it, expect } from 'vitest'

import { canInCommission } from './session'
import type { CommissionAccess } from './session'
import type { MemberCapability } from './members'

/**
 * `canInCommission` is the ONE seam the UI gates every delegated-capability
 * affordance through, and it must mirror the DB gate
 * `app.is_staff_admin_of(c) OR app.member_can(c, cap)` exactly. `app.member_can`
 * is (measured from `pg_proc`, ADR 0134 Amdt 2 M8):
 *
 *     feature_enabled('administrativo') ∧ is_active(uid)
 *       ∧ app.is_member_of(c) ∧ ∃ capability row
 *
 * The first two conjuncts are applied upstream by the resolver (it zeroes
 * `capabilities` to `[]` when the flag is off, and an inactive account never
 * resolves an access object). The one this helper owns is **`is_member_of`**, and
 * `access.role !== null` is it — `role` is populated ONLY from the caller's own
 * hat-filtered, non-expired `memberships` row.
 *
 * ⭐ WHY A TABLE TEST AND NOT A COMMENT. The membership conjunct was MISSING here
 * for the whole life of ADR 0061, and a docblock in this file asserted the door's
 * OPPOSITE for weeks (QA F-3). The orphan rows are the regression: an
 * Administrativo whose membership was deleted keeps their appointment and
 * capability rows (nothing revokes them — no FK, no cascade trigger) and still
 * READS them (`user_id = auth.uid()`, hat-blind), so `capabilities` stays
 * populated while the DB refuses every gate. Measured 2026-08-22: such a
 * principal, composed with tenancy-admin or quality-reviewer standing, REACHED
 * `/manage/cases` and was offered "Novo caso" behind that refusing door
 * (`e2e/orphan-administrativo-reachability.spec.ts` pins the reachability half;
 * this file pins the predicate).
 */

/**
 * ⛔ EVERY `MemberCapability` VALUE MUST APPEAR HERE — and the COMPILER enforces
 * it, because this docblock could not. `gen:types` is blind to this vocabulary
 * (the DB column is `text` + CHECK, so `database.ts` types it `string`) and
 * `lint:vacuous` cannot see an assertion that was never written, so a capability
 * omitted here was silently untested by all five tests below, including the
 * orphan-regression row.
 *
 * ⭐ WHY A KEYSET AND NOT AN ARRAY (QA case-surface-split-increment-2-review.md
 * M-14). The previous form was `const ALL: MemberCapability[] = [...]`, which
 * accepts ANY SUBSET — a sixth capability would have compiled clean here and been
 * skipped everywhere. `satisfies Record<MemberCapability, true>` closes it in BOTH
 * directions on an object literal:
 *   · a MISSING key  → TS2741 "Property 'x' is missing … but required in type
 *                      'Record<MemberCapability, true>'"
 *   · an EXTRA key   → TS1360/TS2353 excess-property error (a value that is not a
 *                      `MemberCapability`, e.g. one left behind by a rename)
 * Proven, not asserted: adding a sixth member to the `MemberCapability` union in
 * `src/lib/queries/members.ts` makes `npm run typecheck` FAIL here (measured
 * 2026-08-22); removing it restores green. That is the whole point — this is the
 * fourth of four TypeScript hand-lists of the vocabulary (see `MemberCapability`'s
 * docblock) and the only one currently gated by the compiler.
 *
 * ⚠ WHAT THE `read_cases` ROWS DO AND DO NOT CLAIM (ADR 0134 D6). The rows below
 * are about the PREDICATE `canInCommission`, which is vocabulary-agnostic, so they
 * hold for `read_cases` exactly as for the other four. They are NOT a claim that
 * `read_cases` is gated through this seam: unlike the other four, its DB consumer
 * is the S8 arm inside `app._case_caps` — case REACH is resolved in the database
 * and arrives through `can_read_case` / `list_cases_board`, never through a UI
 * capability check. The row that carries real weight for `read_cases` is the
 * ORPHAN one: `app.member_can` requires `app.is_member_of` for EVERY capability,
 * so a membership-less appointee must be refused here too.
 */
const ALL_CAPABILITIES = {
  schedule_meetings: true,
  create_cases: true,
  assign_case_phases: true,
  view_signoffs: true,
  read_cases: true,
} satisfies Record<MemberCapability, true>

const ALL = Object.keys(ALL_CAPABILITIES) as MemberCapability[]

const access = (
  role: CommissionAccess['role'],
  capabilities: MemberCapability[],
): Pick<CommissionAccess, 'role' | 'capabilities'> => ({ role, capabilities })

describe('canInCommission mirrors is_staff_admin_of OR member_can', () => {
  // ⛔ THE VACUITY GUARD. Every test below is `for (const cap of ALL) expect(...)`,
  // so an `ALL` that came out EMPTY would make all five pass having asserted
  // nothing at all — the exact failure family the keyset above exists to close, and
  // one the keyset alone does NOT cover (`satisfies` constrains the object literal,
  // it says nothing about what `Object.keys` returned at runtime). The literal 5 is
  // deliberate: the `satisfies` makes the omission of a sixth capability a COMPILE
  // error, and this line makes the resulting count change a visible, deliberate
  // edit rather than a silent one.
  it('the capability keyset is non-empty and matches the declared vocabulary', () => {
    expect(ALL).toEqual([
      'schedule_meetings',
      'create_cases',
      'assign_case_phases',
      'view_signoffs',
      'read_cases',
    ])
    expect(ALL.length).toBe(5)
  })

  // ⚠ EACH TEST BELOW OPENS WITH AN UNCONDITIONAL ROW, and it is not linter
  // appeasement. Deriving `ALL` from the keyset made it OPAQUE to
  // `lint:vacuous` — a literal array let the checker prove non-emptiness, and
  // `Object.keys()` does not — so it flagged four tests whose every assertion sat
  // inside `for (const cap of ALL)`. The flag was CORRECT: those tests could always
  // have passed on an empty `ALL`; the literal merely hid it. The anchor makes each
  // test fail on its own rather than depending on the census guard above.
  it('admits the membership coordinator for every capability, granted or not', () => {
    expect(canInCommission(access('staff_admin', []), 'read_cases')).toBe(true)
    for (const cap of ALL) {
      expect(canInCommission(access('staff_admin', []), cap)).toBe(true)
    }
  })

  it('admits a MEMBER administrativo on exactly the capability they hold', () => {
    const a = access('staff', ['create_cases'])
    expect(canInCommission(a, 'create_cases')).toBe(true)
    for (const cap of ALL.filter((c) => c !== 'create_cases')) {
      expect(canInCommission(a, cap)).toBe(false)
    }
  })

  it('refuses a plain member holding no capability', () => {
    expect(canInCommission(access('staff', []), 'read_cases')).toBe(false)
    for (const cap of ALL) {
      expect(canInCommission(access('staff', []), cap)).toBe(false)
    }
  })

  // ⛔ THE REGRESSION ROW. `role: null` with a FULL capability array is the orphan:
  // the membership is gone, the capability rows survived. Before the fix this
  // returned `true` for all four while `app.member_can` returned false for all four.
  it('refuses an ORPHAN — capabilities present, membership gone (role === null)', () => {
    // The unconditional row is `read_cases` deliberately: per the keyset docblock it
    // is the capability for which THIS row carries the real weight, since
    // `app.member_can` requires `app.is_member_of` for every capability alike.
    expect(canInCommission(access(null, ALL), 'read_cases')).toBe(false)
    for (const cap of ALL) {
      expect(canInCommission(access(null, ALL), cap)).toBe(false)
    }
  })

  // A bare tenancy admin and a quality reviewer both carry `role: null` and are
  // FLAGS, never member roles (ADR 0100 D10/D12). They are the two standings that
  // let an orphan read the commission row and reach a route at all, so their
  // `role: null` shape is exactly the orphan's — one predicate covers both.
  it('refuses role === null even when the capability array is empty', () => {
    expect(canInCommission(access(null, []), 'read_cases')).toBe(false)
    for (const cap of ALL) {
      expect(canInCommission(access(null, []), cap)).toBe(false)
    }
  })
})
