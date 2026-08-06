import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ADR 0097 D14 — person-level fields and the account lifecycle are `org_admin`-ONLY.
 *
 * ⚠ WHY THIS IS A VITEST FILE AND NOT A pgTAP ONE, stated so nobody looks for the
 * keystone in the database and concludes it is missing: the enforcement is in
 * TypeScript, on the SERVICE-ROLE path. There is no RLS to assert against — the service
 * client bypasses it — and the `profiles` column grants that lock `cpf` govern PostgREST
 * only, so they do not constrain this layer at all. `authorizeOrgAdminForUser` IS the
 * boundary, and a test that cannot reach it cannot test it.
 *
 * Before this file, D14 was asserted in an ADR and enforced NOWHERE:
 * `authorizeForUser`'s hospital arm admitted a `hospital_admin` to every one of these
 * actions. Every DENY below is paired with an org_admin ALLOW twin, because a
 * narrowing that denies everyone passes its negative keystones by construction.
 */

const ORG_A = '0c000000-0000-0000-0000-00000000000a'
const HOSP_A = '05000000-0000-0000-0000-00000000000a'
const TARGET = '00000000-0000-0000-0000-000000000002'

interface SessionShape {
  userId: string
  isInactive: boolean
  isAdmin: boolean
  orgAdminOf: { organization: { id: string } }[]
  hospitalAdminOf: { hospital: { id: string }; organization: { id: string } }[]
}

const hospitalAdminSession: SessionShape = {
  userId: '00000000-0000-0000-0000-0000000000e1',
  isInactive: false,
  isAdmin: false,
  orgAdminOf: [],
  hospitalAdminOf: [{ hospital: { id: HOSP_A }, organization: { id: ORG_A } }],
}

const orgAdminSession: SessionShape = {
  userId: '00000000-0000-0000-0000-0000000000b1',
  isInactive: false,
  isAdmin: false,
  orgAdminOf: [{ organization: { id: ORG_A } }],
  hospitalAdminOf: [],
}

let session: SessionShape = orgAdminSession
/** Rows the fake service client hands back, per table. */
let rows: Record<string, unknown> = {}
/** Every write the actions attempt, so a DENY can be proven to have written NOTHING. */
let writes: { table: string; op: string; payload: unknown }[] = []
/** Every RPC the actions issue — the F4 arm asserts the audit probe is among them. */
let rpcCalls: { fn: string; args: unknown }[] = []

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/headers', () => ({ headers: async () => new Map() }))
vi.mock('@/lib/queries/session', () => ({
  getSessionContext: async () => session,
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => makeAdmin(),
}))

/**
 * A chainable supabase-js stand-in. Every filter returns the builder; the terminal
 * forms resolve. Only the surface these actions touch is modelled — a fuller fake would
 * hide which surface they actually depend on.
 */
function makeAdmin() {
  const builder = (table: string) => {
    const self: Record<string, unknown> = {}
    const chain = () => self
    for (const m of ['select', 'eq', 'is', 'in', 'not', 'order', 'limit', 'returns']) {
      self[m] = chain
    }
    // A table's configured value may be an ARRAY, in which case it is a QUEUE consumed one
  // read at a time. registerUser reads `profiles` TWICE — the email pre-check, then the
  // CPF pre-check — and a single fixed row makes the first read answer for both, so the
  // email collision returns before the CPF path is ever reached.
  self.maybeSingle = async () => {
    const configured = rows[table]
    if (Array.isArray(configured)) {
      return { data: (configured.shift() as unknown) ?? null, error: null }
    }
    return { data: configured ?? null, error: null }
  }
    self.then = (resolve: (v: { data: unknown; error: null }) => unknown) =>
      resolve({ data: rows[table] ?? [], error: null })
    for (const op of ['update', 'insert', 'upsert', 'delete']) {
      self[op] = (payload: unknown) => {
        writes.push({ table, op, payload })
        return self
      }
    }
    return self
  }
  return {
    from: (table: string) => builder(table),
    rpc: async (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args })
      return { data: null, error: null }
    },
  }
}

const FORBIDDEN = /administrador da organiza/i

beforeEach(() => {
  writes = []
  rpcCalls = []
  rows = {
    profiles: {
      id: TARGET,
      home_organization_id: ORG_A,
      full_name: 'Chefe CCIH',
      professional_category_id: 'cat-1',
      cpf: '11144477735',
    },
    hospital_affiliations: [{ hospital_id: HOSP_A }],
    memberships: [],
    professional_credentials: { user_id: TARGET },
  }
})

describe('D14 — a hospital_admin cannot change person-level fields', () => {
  it.each([
    ['NAME', { fullName: 'Nome Alterado', professionalCategoryId: 'cat-1' }],
    ['CATEGORY', { fullName: 'Chefe CCIH', professionalCategoryId: 'cat-OUTRA' }],
    ['CPF', { fullName: 'Chefe CCIH', professionalCategoryId: 'cat-1', cpf: '52998224725' }],
  ])('%s is REFUSED', async (_label, patch) => {
    session = hospitalAdminSession
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({ userId: TARGET, ...patch } as never)

    expect(result.ok, 'the hospital admin must be refused').toBe(false)
    expect(result.error).toMatch(FORBIDDEN)
    // The refusal must happen BEFORE the write, not be reported after one.
    expect(
      writes.filter((w) => w.table === 'profiles' && w.op === 'update'),
      'a refused edit must not have written',
    ).toHaveLength(0)
  })

  it('CREDENTIALS are REFUSED', async () => {
    session = hospitalAdminSession
    const { upsertCredential } = await import('./actions')
    const result = await upsertCredential({
      userId: TARGET,
      issuingCountry: 'BR',
      issuingState: 'SP',
      issuingAuthority: 'CRM',
      registrationNumber: '12345',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(FORBIDDEN)
    expect(writes.filter((w) => w.table === 'professional_credentials')).toHaveLength(0)
  })

  it('CREDENTIAL REMOVAL is REFUSED', async () => {
    // F6: `removeCredential` shared `upsertCredential`'s gate but had no arm of its own —
    // reverting it reded nothing. A credential is a fact about the PERSON either way.
    session = hospitalAdminSession
    const { removeCredential } = await import('./actions')
    const result = await removeCredential('cred-1')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(FORBIDDEN)
    expect(writes.filter((w) => w.op === 'delete')).toHaveLength(0)
  })

  it('REACTIVATION is REFUSED', async () => {
    // F6. The inverse of deactivation is equally platform-wide: re-enabling an account
    // restores access at every hospital and committee it holds, not just at this one.
    session = hospitalAdminSession
    const { reactivateUser } = await import('./actions')
    const result = await reactivateUser(TARGET)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(FORBIDDEN)
    expect(writes.filter((w) => w.op === 'update')).toHaveLength(0)
  })

  it('SUSPENSION is REFUSED', async () => {
    // F6. Suspension routes through the same `app.is_active` kill switch as deactivation,
    // so a hospital admin suspending someone would lock them out platform-wide.
    session = hospitalAdminSession
    const { suspendUser } = await import('./actions')
    const result = await suspendUser(TARGET, null)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(FORBIDDEN)
    expect(writes.filter((w) => w.op === 'update')).toHaveLength(0)
  })

  it('ACCOUNT DEACTIVATION is REFUSED — it is a platform-wide kill switch', async () => {
    // `app.is_active` is folded into every membership predicate, so one hospital's
    // offboarding would end this person's access at every OTHER hospital too.
    session = hospitalAdminSession
    const { deactivateUser } = await import('./actions')
    const result = await deactivateUser(TARGET)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(FORBIDDEN)
    expect(writes.filter((w) => w.op === 'update')).toHaveLength(0)
  })
})

describe('D14 — the org_admin ALLOW twins (the narrowing does not deny everyone)', () => {
  it('an org_admin CAN change the name', async () => {
    session = orgAdminSession
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({
      userId: TARGET,
      fullName: 'Nome Alterado',
      professionalCategoryId: 'cat-1',
    })
    expect(result.ok, result.error).toBe(true)
    expect(writes.some((w) => w.table === 'profiles' && w.op === 'update')).toBe(true)
  })

  it('an org_admin CAN change the CPF', async () => {
    session = orgAdminSession
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({
      userId: TARGET,
      fullName: 'Chefe CCIH',
      professionalCategoryId: 'cat-1',
      cpf: '529.982.247-25',
    })
    expect(result.ok, result.error).toBe(true)
    const write = writes.find((w) => w.table === 'profiles' && w.op === 'update')
    expect(
      (write?.payload as { cpf?: string })?.cpf,
      'the CPF must be stored NORMALIZED (digits only), not as typed',
    ).toBe('52998224725')
  })

  it('an org_admin CAN deactivate', async () => {
    session = orgAdminSession
    const { deactivateUser } = await import('./actions')
    expect((await deactivateUser(TARGET)).ok).toBe(true)
  })

  it('an org_admin CAN reactivate, suspend, and remove a credential', async () => {
    // The twins for F6's three arms: a narrowing that denies EVERYONE passes its negative
    // keystones by construction, so each deny needs a matching allow.
    session = orgAdminSession
    const { reactivateUser, suspendUser, removeCredential } = await import('./actions')
    expect((await reactivateUser(TARGET)).ok, 'reactivate').toBe(true)
    expect((await suspendUser(TARGET, null)).ok, 'suspend').toBe(true)
    expect((await removeCredential('cred-1')).ok, 'removeCredential').toBe(true)
  })
})

describe('D14 — the gate fires on a CHANGE, not on a field being present', () => {
  it('a hospital_admin editing ONLY the matrícula is ALLOWED', async () => {
    // The edit form always POSTS name and category, so gating on their PRESENCE would
    // deny a hospital admin their own legitimate affiliation edit. This is the
    // assertion that keeps the D14 narrowing from binding too much.
    session = hospitalAdminSession
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({
      userId: TARGET,
      fullName: 'Chefe CCIH', // unchanged
      professionalCategoryId: 'cat-1', // unchanged
      homeHospitalId: HOSP_A,
      hospitalEmployeeId: 'MAT-NOVA',
    })
    expect(result.ok, result.error).toBe(true)
  })
})

describe('registerUser — CPF is required, validated and normalized (ADR 0097 D7)', () => {
  it('refuses a missing CPF', async () => {
    session = orgAdminSession
    const { registerUser } = await import('./actions')
    const result = await registerUser({
      homeOrganizationId: ORG_A,
      fullName: 'Novo Alguém',
      email: 'novo@test.local',
      professionalCategoryId: 'cat-1',
      password: 'Test1234!',
    } as never)
    expect(result.ok).toBe(false)
    expect(result.fieldErrors?.cpf).toBeTruthy()
  })

  it('AUDITS the collision probe, and refuses the duplicate (ADR 0097 LOW-3)', async () => {
    // F4: the registration block is the OTHER half of the CPF existence oracle, and D11's
    // audit row is the compensating control for the oracle as a whole. It emitted nothing.
    session = orgAdminSession
    // Queue: the EMAIL pre-check must miss (null) so execution reaches the CPF pre-check,
    // which then hits an existing holder.
    rows.profiles = [null, { id: 'someone-else', home_organization_id: ORG_A, is_active: true }]
    const { registerUser } = await import('./actions')
    const result = await registerUser({
      homeOrganizationId: ORG_A,
      fullName: 'Novo Alguém',
      email: 'novo@test.local',
      professionalCategoryId: 'cat-1',
      cpf: '111.444.777-35',
      password: 'Test1234!',
    })

    expect(result.fieldErrors?.cpf, 'the collision must still block').toBeTruthy()
    const probe = rpcCalls.find((c) => c.fn === 'log_cpf_probe_for')
    expect(probe, 'the collision path must emit an audit probe').toBeTruthy()
    expect(
      JSON.stringify(probe?.args),
      'the probe must never carry the CPF digits',
    ).not.toMatch(/11144477735/)
  })

  it('refuses an invalid check digit', async () => {
    session = orgAdminSession
    const { registerUser } = await import('./actions')
    const result = await registerUser({
      homeOrganizationId: ORG_A,
      fullName: 'Novo Alguém',
      email: 'novo@test.local',
      professionalCategoryId: 'cat-1',
      cpf: '111.444.777-36',
      password: 'Test1234!',
    })
    expect(result.ok).toBe(false)
    expect(result.fieldErrors?.cpf).toMatch(/CPF/i)
  })
})
