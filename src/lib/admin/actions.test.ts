import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ADR 0167 clause 2 — `authorizeStaffAdminOps` is widened to the HOSPITAL tier.
 *
 * WHY THIS FILE EXISTS. The gate required a non-empty `orgAdminOf` and never read
 * `hospitalAdminOf`, while `/o/[org]/manage` admits a `hospital_admin` by design
 * (ADR 0051) and the DB door beneath (`app.is_tenancy_admin_of_for`) has admitted
 * them all along. A hospital admin therefore SAW the coordinator form and was
 * refused on every click — a rendered-but-refused surface, invisible to pgTAP
 * (which measures the door, and the door said yes) and to typecheck.
 *
 * ⛔ THE FUNCTION UNDER TEST IS NOT EXPORTED, DELIBERATELY DRIVEN THROUGH THE
 *    REAL SERVER ACTIONS. Exporting it to test it would test a copy of the seam
 *    rather than the seam: what matters is that BOTH coordinator actions consult
 *    it, which § "both actions" below is what proves.
 *
 * ⚠ THE REFUSAL AND THE ADMISSION ARE ASSERTED ON DIFFERENT WITNESSES, ON
 *   PURPOSE. A refused call returns `MESSAGES.forbidden` AND must not have
 *   reached the door; asserting only the message would pass on an action that
 *   refused *and* wrote. So every cell checks the `rpc` spy too.
 */

const ORG_A = 'org-a'
const ORG_B = 'org-b'
const HOSP_CENTRAL = 'hosp-central'
const HOSP_SECUNDARIO = 'hosp-secundario'
const COMMISSION = 'commission-ccih'

/** The commission under test: org A / Hospital Central. */
const commissionRow = { organization_id: ORG_A, hospital_id: HOSP_CENTRAL }

const rpc = vi.fn(async () => ({ error: null }))

const supabaseMock = {
  rpc,
  from: vi.fn(() => ({
    select: vi.fn((columns: string) => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({
          // `revalidateCommissionPages` reads `slug` from the same table; the
          // authorization read asks for organization_id + hospital_id.
          data: columns.includes('slug') ? { slug: 'ccih' } : commissionRow,
          error: null,
        })),
      })),
    })),
  })),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabaseMock),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => supabaseMock),
}))

const resolveOrInviteUser = vi.fn(async () => ({ userId: 'user-new' }))
vi.mock('@/lib/members/invite', () => ({
  resolveOrInviteUser: () => resolveOrInviteUser(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ origin: 'http://localhost:3000' }),
}))

const getSessionContext = vi.fn()
vi.mock('@/lib/queries/session', () => ({
  getSessionContext: () => getSessionContext(),
}))

import { assignStaffAdmin, removeStaffAdmin } from './actions'

const FORBIDDEN = 'Você não tem permissão para esta ação.'

function orgRef(id: string) {
  return { id, slug: id, name: id }
}

function hospitalRef(id: string, organizationId: string) {
  return { id, slug: id, name: id, organizationId }
}

/** A session context carrying exactly the two grant lists the gate reads. */
/** The signed-in actor every `contextWith()` session belongs to. */
const ACTOR = '00000000-0000-0000-0000-0000000000ac'

function contextWith(opts: {
  orgAdminOf?: string[]
  hospitalAdminOf?: [string, string][]
}) {
  return {
    // ⚠ ADDED BY ADR 0168 Amdt 3, and the omission was a fixture that did not model
    // reality: the real `getSessionContext()` has always returned `userId` (see
    // `platform/actions.ts:assignOrgAdmin`). Nothing needed it here until
    // `assignStaffAdmin` moved to the `_for` twin, which passes the actor explicitly —
    // so an incomplete fixture sat harmless for as long as no cell read the field.
    userId: ACTOR,
    isAdmin: false,
    orgAdminOf: (opts.orgAdminOf ?? []).map((id) => ({ organization: orgRef(id) })),
    hospitalAdminOf: (opts.hospitalAdminOf ?? []).map(([h, o]) => ({
      organization: orgRef(o),
      hospital: hospitalRef(h, o),
    })),
  }
}

function removeForm() {
  const fd = new FormData()
  fd.set('commissionId', COMMISSION)
  fd.set('userId', 'target-user')
  return fd
}

function assignForm() {
  const fd = new FormData()
  fd.set('commissionId', COMMISSION)
  fd.set('email', 'novo.coordenador@test.local')
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockResolvedValue({ error: null })
})

describe('authorizeStaffAdminOps — the ADR 0167 widening', () => {
  it('ADMITS a hospital_admin of the commission’s hospital', async () => {
    getSessionContext.mockResolvedValue(
      contextWith({ hospitalAdminOf: [[HOSP_CENTRAL, ORG_A]] }),
    )

    const result = await removeStaffAdmin(undefined, removeForm())

    expect(result.ok).toBe(true)
    expect(rpc).toHaveBeenCalledWith('revoke_role', {
      p_scope_type: 'commission',
      p_scope_id: COMMISSION,
      p_role: 'staff_admin',
      p_user: 'target-user',
    })
  })

  it('REFUSES a hospital_admin of another hospital in the SAME org', async () => {
    // ⭐ The sharp cell: same organisation, wrong hospital. A widening that keyed
    //    on `hospitalAdminOf.length > 0`, or on the hospital's ORG rather than its
    //    id, passes the admission cell above and fails only here.
    getSessionContext.mockResolvedValue(
      contextWith({ hospitalAdminOf: [[HOSP_SECUNDARIO, ORG_A]] }),
    )

    const result = await removeStaffAdmin(undefined, removeForm())

    expect(result).toEqual({ ok: false, error: FORBIDDEN })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('still ADMITS an org_admin of the commission’s org (no regression)', async () => {
    getSessionContext.mockResolvedValue(contextWith({ orgAdminOf: [ORG_A] }))

    const result = await removeStaffAdmin(undefined, removeForm())

    expect(result.ok).toBe(true)
    expect(rpc).toHaveBeenCalled()
  })

  it('REFUSES an org_admin of another org', async () => {
    getSessionContext.mockResolvedValue(contextWith({ orgAdminOf: [ORG_B] }))

    const result = await removeStaffAdmin(undefined, removeForm())

    expect(result).toEqual({ ok: false, error: FORBIDDEN })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('REFUSES a caller holding neither tier', async () => {
    // The floor. Without it, a gate that returned `true` unconditionally would
    // satisfy every admission cell above.
    getSessionContext.mockResolvedValue(contextWith({}))

    const result = await removeStaffAdmin(undefined, removeForm())

    expect(result).toEqual({ ok: false, error: FORBIDDEN })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('REFUSES when there is no session at all', async () => {
    getSessionContext.mockResolvedValue(null)

    const result = await removeStaffAdmin(undefined, removeForm())

    expect(result).toEqual({ ok: false, error: FORBIDDEN })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('does NOT admit a platform_admin — `isAdmin` is not a commission tier', async () => {
    // ADR 0167 clause 1 removed the matching arm from the DB door, so this TS
    // refusal is now an agreement with the kernel rather than a stricter rule.
    getSessionContext.mockResolvedValue({
      ...contextWith({}),
      isAdmin: true,
    })

    const result = await removeStaffAdmin(undefined, removeForm())

    expect(result).toEqual({ ok: false, error: FORBIDDEN })
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('both coordinator actions consult the same gate', () => {
  it('assignStaffAdmin ADMITS a hospital_admin of the commission’s hospital', async () => {
    getSessionContext.mockResolvedValue(
      contextWith({ hospitalAdminOf: [[HOSP_CENTRAL, ORG_A]] }),
    )

    const result = await assignStaffAdmin(undefined, assignForm())

    expect(result.ok).toBe(true)
    // ⭐ THE `_for` TWIN, NOT THE SESSION DOOR — ADR 0168 Amdt 3. The move is what
    // stops an `org_admin` anchoring an ANCHORLESS person (and granting them a role)
    // through `public.grant_role`, whose kernel now refuses that target. `p_actor` is
    // asserted explicitly: the whole point of the `_for` twin is that PostgreSQL
    // re-derives authority from THIS id, so a call that forgot it — or passed the
    // TARGET instead of the caller — would be an authority bypass that `result.ok`
    // alone cannot see.
    expect(rpc).toHaveBeenCalledWith('grant_role_for', {
      p_actor: ACTOR,
      p_scope_type: 'commission',
      p_scope_id: COMMISSION,
      p_role: 'staff_admin',
      p_user: 'user-new',
    })
  })

  it('assignStaffAdmin REFUSES a hospital_admin of another hospital', async () => {
    getSessionContext.mockResolvedValue(
      contextWith({ hospitalAdminOf: [[HOSP_SECUNDARIO, ORG_A]] }),
    )

    const result = await assignStaffAdmin(undefined, assignForm())

    expect(result).toEqual({ ok: false, error: FORBIDDEN })
    // ⛔ The refusal must precede the INVITE, not merely the grant: provisioning
    //    an account for an unauthorized caller is itself a side effect.
    expect(resolveOrInviteUser).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
})
