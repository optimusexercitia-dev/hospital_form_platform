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
 * ⛔ EVERY `MemberCapability` VALUE MUST APPEAR HERE. A value missing from this
 * list is silently untested — `lint:vacuous` cannot see an assertion that was
 * never written, and `gen:types` is blind to this vocabulary (the DB column is
 * `text` + CHECK, so `database.ts` types it `string`). This list is the fourth of
 * four TypeScript hand-lists of the vocabulary; see `MemberCapability`'s docblock.
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
const ALL: MemberCapability[] = [
  'schedule_meetings',
  'create_cases',
  'assign_case_phases',
  'view_signoffs',
  'read_cases',
]

const access = (
  role: CommissionAccess['role'],
  capabilities: MemberCapability[],
): Pick<CommissionAccess, 'role' | 'capabilities'> => ({ role, capabilities })

describe('canInCommission mirrors is_staff_admin_of OR member_can', () => {
  it('admits the membership coordinator for every capability, granted or not', () => {
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
    for (const cap of ALL) {
      expect(canInCommission(access('staff', []), cap)).toBe(false)
    }
  })

  // ⛔ THE REGRESSION ROW. `role: null` with a FULL capability array is the orphan:
  // the membership is gone, the capability rows survived. Before the fix this
  // returned `true` for all four while `app.member_can` returned false for all four.
  it('refuses an ORPHAN — capabilities present, membership gone (role === null)', () => {
    for (const cap of ALL) {
      expect(canInCommission(access(null, ALL), cap)).toBe(false)
    }
  })

  // A bare tenancy admin and a quality reviewer both carry `role: null` and are
  // FLAGS, never member roles (ADR 0100 D10/D12). They are the two standings that
  // let an orphan read the commission row and reach a route at all, so their
  // `role: null` shape is exactly the orphan's — one predicate covers both.
  it('refuses role === null even when the capability array is empty', () => {
    for (const cap of ALL) {
      expect(canInCommission(access(null, []), cap)).toBe(false)
    }
  })
})
