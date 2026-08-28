import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * BUG-AFF-1 — the `authorizeStaffOps` mirror must be neither weaker NOR STRONGER than
 * the six doors it fronts (ADR 0098 §W3.7).
 *
 * ⚠ WHY THIS SURVIVED, and therefore what this file has to assert. The mirror was
 * STRICTER than its doors: a hospital admin passed the read gate (the candidate picker
 * is org-scoped — ADR 0097 finding 1), passed every write door
 * (`is_tenancy_admin_of` carries a `hospital_admin` leg), and was refused only by the
 * TypeScript pre-check. A mirror that is too strict fails CLOSED, and a refusal always
 * looks like the system working — no test, no policy sweep and no error log distinguishes
 * "correctly denied" from "denied by a drifted mirror".
 *
 * So the ALLOW arm is the regression test, and the DENY arm is the one that keeps the fix
 * honest: a keystone proving only the ALLOW passes a BLANKET widening by construction.
 * The sibling-hospital denial is what proves the new leg is scoped to
 * `commissions.hospital_id` and not to "any hospital admin, anywhere".
 */

const ORG_A = '0c000000-0000-0000-0000-00000000000a'
const CENTRAL_A = '05000000-0000-0000-0000-00000000000a'
const SECUNDARIO_A = '05000000-0000-0000-0000-0000000000a2'
/** CCIH — a commission of CENTRAL_A. */
const COMMISSION = 'a0000000-0000-0000-0000-0000000000a1'
const TARGET_USER = '00000000-0000-0000-0000-0000000000d1'

interface Ctx {
  userId: string
  isInactive: boolean
  isAdmin: boolean
  memberships: { commission: { id: string }; role: string }[]
  orgAdminOf: { organization: { id: string } }[]
  hospitalAdminOf: { hospital: { id: string }; organization: { id: string } }[]
}

const base: Ctx = {
  userId: '00000000-0000-0000-0000-0000000000e1',
  isInactive: false,
  isAdmin: false,
  memberships: [],
  orgAdminOf: [],
  hospitalAdminOf: [],
}

const hospitalAdminOfCentralA: Ctx = {
  ...base,
  hospitalAdminOf: [{ hospital: { id: CENTRAL_A }, organization: { id: ORG_A } }],
}
const hospitalAdminOfSibling: Ctx = {
  ...base,
  userId: '00000000-0000-0000-0000-0000000000e9',
  hospitalAdminOf: [{ hospital: { id: SECUNDARIO_A }, organization: { id: ORG_A } }],
}
const orgAdmin: Ctx = {
  ...base,
  userId: '00000000-0000-0000-0000-0000000000b1',
  orgAdminOf: [{ organization: { id: ORG_A } }],
}
const staffAdmin: Ctx = {
  ...base,
  userId: '00000000-0000-0000-0000-000000000002',
  memberships: [{ commission: { id: COMMISSION }, role: 'staff_admin' }],
}
const plainStaff: Ctx = {
  ...base,
  userId: '00000000-0000-0000-0000-000000000003',
  memberships: [{ commission: { id: COMMISSION }, role: 'staff' }],
}

let session: Ctx = orgAdmin
/** Every door call the action reaches — an ALLOW must actually get there. */
let rpcCalls: { fn: string; args: unknown }[] = []

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/headers', () => ({ headers: async () => new Map() }))
vi.mock('@/lib/queries/session', () => ({ getSessionContext: async () => session }))

/**
 * The RLS-scoped read `authorizeStaffOps` makes; also serves the action's own reads.
 *
 * ⭐⭐ THE TARGET'S TENANCY IS AN `organization_affiliations` ROW, NOT A COLUMN — and the
 * `profiles` fixture DELIBERATELY NO LONGER CARRIES `home_organization_id`. AE2.4
 * increment 4 re-predicated `addStaff`'s re-verify (QA finding B1), and when it did, all
 * three ALLOW arms in this file went RED: the fixture had built its world out of the
 * column under test — it anchored the target with `home_organization_id` and never
 * seeded an affiliation row. That is pgTAP `360` § 5.2's shape, in TypeScript, for the
 * third time in this phase.
 *
 * ⛔ Fixed by mirroring the REAL SUBSTRATE, never by relaxing an assertion. And the
 * column is REMOVED rather than left beside the new row: with both present the arms
 * would pass whichever fact the action read, so the fixture would have stopped being
 * evidence that it moved. This is the state the database will hold after the drop.
 */
function table(name: string) {
  const rows: Record<string, unknown> = {
    commissions: { organization_id: ORG_A, hospital_id: CENTRAL_A },
    profiles: { id: TARGET_USER, is_active: true },
    memberships: null,
  }
  /** List-shaped reads. The target holds ONE active org affiliation in ORG_A. */
  const lists: Record<string, unknown[]> = {
    organization_affiliations: [{ id: 'aff-1' }],
  }
  const self: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is', 'in', 'not', 'order', 'limit', 'returns']) {
    self[m] = () => self
  }
  self.maybeSingle = async () => ({ data: rows[name] ?? null, error: null })
  self.then = (resolve: (v: { data: unknown; error: null }) => unknown) =>
    resolve({ data: lists[name] ?? [], error: null })
  for (const op of ['insert', 'update', 'upsert', 'delete']) self[op] = () => self
  return self
}

const client = {
  from: (name: string) => table(name),
  rpc: async (fn: string, args: unknown) => {
    rpcCalls.push({ fn, args })
    return { data: null, error: null }
  },
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => client }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => client }))

function form(): FormData {
  const fd = new FormData()
  fd.set('commissionId', COMMISSION)
  fd.set('userId', TARGET_USER)
  return fd
}

beforeEach(() => {
  rpcCalls = []
})

describe('BUG-AFF-1 — a hospital_admin can seat staff at THEIR OWN hospital', () => {
  it('ALLOW: addStaff completes end to end and reaches the door', async () => {
    // The AFF headline scenario: Municipal's admin seats Dr. John on a committee at
    // their own hospital. Before the fix this returned the generic refusal AFTER the
    // picker had already offered the candidate.
    session = hospitalAdminOfCentralA
    const { addStaff } = await import('./actions')
    const result = await addStaff(undefined, form())

    expect(result.ok, result.error).toBe(true)
    expect(
      rpcCalls.map((c) => c.fn),
      'the action must actually reach grant_role — "ok" without a door call is a no-op',
    ).toContain('grant_role')
  })

  it('DENY: ... and NOT for a commission at a SIBLING hospital', async () => {
    // ⭐ The arm that keeps the fix from being a blanket widening. The new leg is scoped
    // to `commissions.hospital_id`; a hospital admin of secundário-a administers no
    // commission of central-a.
    session = hospitalAdminOfSibling
    const { addStaff } = await import('./actions')
    const result = await addStaff(undefined, form())

    expect(result.ok).toBe(false)
    expect(rpcCalls, 'a refused action must not have called any door').toHaveLength(0)
  })

  it('DENY: a plain staff member of the very same commission is still refused', async () => {
    session = plainStaff
    const { addStaff } = await import('./actions')
    expect((await addStaff(undefined, form())).ok).toBe(false)
    expect(rpcCalls).toHaveLength(0)
  })

  it('DENY: a suspended/deactivated hospital_admin is refused (is_active parity)', async () => {
    // `is_tenancy_admin_of_for` folds `app.is_active`, but getSessionContext reports
    // `isInactive` separately and does NOT empty the grant lists — so the mirror had to
    // check it explicitly. Second instance of the same drift, found while fixing the first.
    session = { ...hospitalAdminOfCentralA, isInactive: true }
    const { addStaff } = await import('./actions')
    expect((await addStaff(undefined, form())).ok).toBe(false)
    expect(rpcCalls).toHaveLength(0)
  })
})

describe('BUG-AFF-1 — the pre-existing arms are untouched (this ADDED a leg)', () => {
  it('an org_admin of the commission org still passes', async () => {
    session = orgAdmin
    const { addStaff } = await import('./actions')
    expect((await addStaff(undefined, form())).ok).toBe(true)
  })

  it('a staff_admin of the commission still passes', async () => {
    session = staffAdmin
    const { addStaff } = await import('./actions')
    expect((await addStaff(undefined, form())).ok).toBe(true)
  })

  it('an anonymous caller is still refused', async () => {
    session = null as unknown as Ctx
    const { addStaff } = await import('./actions')
    expect((await addStaff(undefined, form())).ok).toBe(false)
    expect(rpcCalls).toHaveLength(0)
  })
})
