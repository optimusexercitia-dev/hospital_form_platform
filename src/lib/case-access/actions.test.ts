import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ADR 0205 D12 (PO ruling, 2026-09-10) — `authorizeCommission` is re-aligned onto the
 * DOOR's authority disjunction, in BOTH directions.
 *
 * WHY THIS FILE EXISTS. The gate returned `true` for `context.isAdmin` — a
 * platform_admin, whom `public.grant_case_access` REFUSES with 42501 (ADR 0078 A35's
 * noun rule) — and it omitted the tenancy-admin arm the door ACCEPTS (the B6
 * single-coordinator deadlock exit, stamped `org_admin_deadlock_exit`). So the same
 * line both over-admitted and under-admitted, and neither half is visible to pgTAP
 * (which measures the door, and the door was right) or to typecheck. The same defect
 * class, one module over, is `src/lib/admin/actions.test.ts` (ADR 0167 clause 2).
 *
 * ⛔ THE FUNCTION UNDER TEST IS NOT EXPORTED, DELIBERATELY DRIVEN THROUGH THE REAL
 *    SERVER ACTIONS. What matters is that BOTH case-access actions consult it — the
 *    § "both actions" block is what proves that, and exporting a copy would not.
 *
 * ⚠ REFUSAL AND ADMISSION ARE ASSERTED ON DIFFERENT WITNESSES, ON PURPOSE. A refused
 *   call must return `MESSAGES.forbidden` AND must not have reached the RPC; checking
 *   only the message would pass on an action that refused *and* wrote.
 */

const ORG_A = 'org-a'
const ORG_B = 'org-b'
const HOSP_CENTRAL = 'hosp-central'
const HOSP_SECUNDARIO = 'hosp-secundario'
const COMMISSION = 'commission-ccih'
const OTHER_COMMISSION = 'commission-farmacia'
const CASE_ID = 'case-0001'
const TARGET = 'target-member'

const rpc = vi.fn(async () => ({ error: null as { code?: string } | null }))

/** The row shape read from either `cases` or `commissions` on this path. */
type CaseOrCommissionRow =
  | { commission_id: string }
  | { organization_id: string; hospital_id: string }

/** The `maybeSingle()` resolution shape — widened so a failing-read override
 * (MINOR-2's "unavailable" cell) type-checks as a `mockImplementationOnce`. */
type MaybeSingleResult = {
  data: CaseOrCommissionRow | null
  error: { message: string } | null
}

/**
 * One `from()` mock serving both reads on this path, dispatched by TABLE:
 * `cases` → the case's commission; `commissions` → its tenancy coordinates.
 */
const supabaseMock = {
  rpc,
  from: vi.fn(
    (
      table: string,
    ): {
      select: () => { eq: () => { maybeSingle: () => Promise<MaybeSingleResult> } }
    } => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data:
              table === 'cases'
                ? { commission_id: COMMISSION }
                : { organization_id: ORG_A, hospital_id: HOSP_CENTRAL },
            error: null,
          })),
        })),
      })),
    }),
  ),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => supabaseMock),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const getSessionContext = vi.fn()
vi.mock('@/lib/queries/session', () => ({
  getSessionContext: () => getSessionContext(),
}))

import { grantCaseAccess, revokeCaseAccess } from './actions'

const FORBIDDEN = 'Você não tem permissão para esta ação.'
const TERMINAL_WRITE = 'Não é possível conceder edição em um caso encerrado.'

function orgRef(id: string) {
  return { id, slug: id, name: id }
}
function hospitalRef(id: string, organizationId: string) {
  return { id, slug: id, name: id, organizationId }
}

/** A session context carrying exactly the three grant lists this gate reads. */
function contextWith(opts: {
  isAdmin?: boolean
  memberships?: [string, 'staff' | 'staff_admin'][]
  orgAdminOf?: string[]
  hospitalAdminOf?: [string, string][]
  isInactive?: boolean
}) {
  return {
    userId: '00000000-0000-0000-0000-0000000000ac',
    isAdmin: opts.isAdmin ?? false,
    memberships: (opts.memberships ?? []).map(([id, role]) => ({
      commission: { id, name: id, slug: id, organization: orgRef(ORG_A) },
      role,
    })),
    orgAdminOf: (opts.orgAdminOf ?? []).map((id) => ({ organization: orgRef(id) })),
    hospitalAdminOf: (opts.hospitalAdminOf ?? []).map(([h, o]) => ({
      organization: orgRef(o),
      hospital: hospitalRef(h, o),
    })),
    isInactive: opts.isInactive ?? false,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockResolvedValue({ error: null })
})

describe('authorizeCommission — the ADR 0205 D12 re-alignment', () => {
  it('ADMITS a staff_admin of THAT commission (no regression)', async () => {
    getSessionContext.mockResolvedValue(
      contextWith({ memberships: [[COMMISSION, 'staff_admin']] }),
    )

    const result = await grantCaseAccess(CASE_ID, TARGET, 'read')

    expect(result.ok).toBe(true)
    expect(rpc).toHaveBeenCalledWith('grant_case_access', expect.anything())
  })

  it('ADMITS an org_admin of the commission’s ORG — the arm the door has and this gate lacked', async () => {
    getSessionContext.mockResolvedValue(contextWith({ orgAdminOf: [ORG_A] }))

    const result = await grantCaseAccess(CASE_ID, TARGET, 'read')

    expect(result.ok).toBe(true)
    expect(rpc).toHaveBeenCalled()
  })

  it('ADMITS a hospital_admin of the commission’s HOSPITAL', async () => {
    getSessionContext.mockResolvedValue(
      contextWith({ hospitalAdminOf: [[HOSP_CENTRAL, ORG_A]] }),
    )

    const result = await grantCaseAccess(CASE_ID, TARGET, 'read')

    expect(result.ok).toBe(true)
    expect(rpc).toHaveBeenCalled()
  })

  it('REFUSES a platform_admin — `isAdmin` is NOT an arm of the door (ADR 0078 A35)', async () => {
    // ⭐ THE HEADLINE. Before D12 this returned true here and 42501 from the door:
    // a rendered, clickable affordance that could never succeed.
    getSessionContext.mockResolvedValue(contextWith({ isAdmin: true }))

    const result = await grantCaseAccess(CASE_ID, TARGET, 'read')

    expect(result).toEqual({ ok: false, error: FORBIDDEN })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('REFUSES a hospital_admin of ANOTHER hospital in the same org', async () => {
    // The sharp cell: an arm keyed on `hospitalAdminOf.length > 0`, or on the
    // hospital's ORG rather than its id, passes the admission cell and fails here.
    getSessionContext.mockResolvedValue(
      contextWith({ hospitalAdminOf: [[HOSP_SECUNDARIO, ORG_A]] }),
    )

    const result = await grantCaseAccess(CASE_ID, TARGET, 'read')

    expect(result).toEqual({ ok: false, error: FORBIDDEN })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('REFUSES an org_admin of ANOTHER org', async () => {
    getSessionContext.mockResolvedValue(contextWith({ orgAdminOf: [ORG_B] }))

    const result = await grantCaseAccess(CASE_ID, TARGET, 'read')

    expect(result).toEqual({ ok: false, error: FORBIDDEN })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('REFUSES a plain `staff` of that commission', async () => {
    getSessionContext.mockResolvedValue(
      contextWith({ memberships: [[COMMISSION, 'staff']] }),
    )

    const result = await grantCaseAccess(CASE_ID, TARGET, 'read')

    expect(result).toEqual({ ok: false, error: FORBIDDEN })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('REFUSES a staff_admin of a DIFFERENT commission', async () => {
    getSessionContext.mockResolvedValue(
      contextWith({ memberships: [[OTHER_COMMISSION, 'staff_admin']] }),
    )

    const result = await grantCaseAccess(CASE_ID, TARGET, 'read')

    expect(result).toEqual({ ok: false, error: FORBIDDEN })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('REFUSES a caller holding no tier at all', async () => {
    // The floor. Without it, a gate returning `true` unconditionally would satisfy
    // every admission cell above.
    getSessionContext.mockResolvedValue(contextWith({}))

    const result = await grantCaseAccess(CASE_ID, TARGET, 'read')

    expect(result).toEqual({ ok: false, error: FORBIDDEN })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('REFUSES when there is no session at all', async () => {
    getSessionContext.mockResolvedValue(null)

    const result = await grantCaseAccess(CASE_ID, TARGET, 'read')

    expect(result).toEqual({ ok: false, error: FORBIDDEN })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('REFUSES an INACTIVE staff_admin of that commission (both DB arms open with is_active)', async () => {
    getSessionContext.mockResolvedValue(
      contextWith({ memberships: [[COMMISSION, 'staff_admin']], isInactive: true }),
    )

    const result = await grantCaseAccess(CASE_ID, TARGET, 'read')

    expect(result.ok).toBe(false)
    expect(result.error).toBe(FORBIDDEN)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('REFUSES an INACTIVE org_admin of the commission’s org', async () => {
    getSessionContext.mockResolvedValue(
      contextWith({ orgAdminOf: [ORG_A], isInactive: true }),
    )

    const result = await grantCaseAccess(CASE_ID, TARGET, 'read')

    expect(result.ok).toBe(false)
    expect(result.error).toBe(FORBIDDEN)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns the pt-BR "unavailable" error, never throws, when the tenancy read fails', async () => {
    // Call order on this path: `commissionOfCase` reads `cases` first (succeeds),
    // then `authorizeCommission`'s tenancy arm reads `commissions` (fails here) —
    // QA MINOR-2: the throw from `getCommissionTenancy` must not escape as an
    // unhandled rejection, nor be mapped to "forbidden".
    getSessionContext.mockResolvedValue(contextWith({ orgAdminOf: [ORG_A] }))
    supabaseMock.from
      .mockImplementationOnce(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { commission_id: COMMISSION },
              error: null,
            })),
          })),
        })),
      }))
      .mockImplementationOnce(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: null,
              error: { message: 'boom' },
            })),
          })),
        })),
      }))

    await expect(grantCaseAccess(CASE_ID, TARGET, 'read')).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error: 'O controle de acesso ao caso não está disponível.',
      }),
    )
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('both actions consult the same gate', () => {
  it('revokeCaseAccess ADMITS the tenancy tier too', async () => {
    getSessionContext.mockResolvedValue(contextWith({ orgAdminOf: [ORG_A] }))

    const result = await revokeCaseAccess(CASE_ID, TARGET)

    expect(result.ok).toBe(true)
    expect(rpc).toHaveBeenCalledWith('revoke_case_access', expect.anything())
  })

  it('revokeCaseAccess REFUSES a platform_admin', async () => {
    getSessionContext.mockResolvedValue(contextWith({ isAdmin: true }))

    const result = await revokeCaseAccess(CASE_ID, TARGET)

    expect(result).toEqual({ ok: false, error: FORBIDDEN })
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('HC0U0 — the terminal-case write refusal reaches the UI in pt-BR', () => {
  it('maps the door’s new SQLSTATE to its own message, not the generic one', async () => {
    // ADR 0205 D9. An unmapped code renders "Não foi possível concluir." — a domain
    // refusal disguised as a transient failure (the FF-5 HC0Q3 lesson, one door over).
    getSessionContext.mockResolvedValue(
      contextWith({ memberships: [[COMMISSION, 'staff_admin']] }),
    )
    rpc.mockResolvedValue({ error: { code: 'HC0U0' } })

    const result = await grantCaseAccess(CASE_ID, TARGET, 'write')

    expect(result).toEqual({ ok: false, error: TERMINAL_WRITE })
  })

  it('does NOT swallow it into the generic message', async () => {
    // The discrimination half: assert the mapping is not merely "some pt-BR string".
    getSessionContext.mockResolvedValue(
      contextWith({ memberships: [[COMMISSION, 'staff_admin']] }),
    )
    rpc.mockResolvedValue({ error: { code: 'HC0U0' } })

    const result = await grantCaseAccess(CASE_ID, TARGET, 'write')

    expect(result.error).not.toBe('Não foi possível concluir. Tente novamente.')
  })
})
