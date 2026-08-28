import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * ADR 0133 D1–D4 + Amendment 1 ruling 1 — the affiliation-scoped person authority rule,
 * exercised through the REAL actions.
 *
 * ⚠ THE FILENAME IS HISTORICAL. This began as the ADR 0097 D14 keystone ("person-level
 * fields are org_admin-ONLY") and ADR 0133 **reversed** that rule for two of its four
 * capability classes. The name is kept deliberately — `e2e/hospital-admin-tier.spec.ts`
 * and several comments point at it, and a rename orphans every one of those references
 * while changing nothing about what runs.
 *
 * ⚠ WHY VITEST AND NOT pgTAP, stated so nobody looks for this keystone in the database and
 * concludes it is missing: enforcement is in TypeScript on the SERVICE-ROLE path. There is
 * no RLS to assert against — the service client bypasses it — and the `profiles` column
 * grants that lock `cpf`/`date_of_birth`/`phone` govern PostgREST only, so they do not
 * constrain this layer at all. ADR 0133 D4 declines a SQL twin on purpose: no policy would
 * consume it and a dead DB predicate is a census liability forever. `authorizePersonScopedAdmin`
 * IS the boundary, and a test that cannot reach it cannot test it.
 *
 * ⛔ THIS FILE TESTS THE WIRING; `person-scope.test.ts` TESTS THE DECISION. Both are
 * required and neither substitutes for the other — a perfect predicate reached by nothing
 * is the recorded "a correct door nothing can reach" shape, and a correctly-wired action
 * passing the WRONG capability passes every wiring check. The capability each call site
 * passes is precisely where Amendment 1's split lives, so §2 below drives all four through
 * their real actions rather than through the helper.
 *
 * ⭐ RED-FIRST CONTROL (required by the lead, and the reason the arm labels are worth
 * trusting). EIGHT arms in §1 were FLIPPED from DENY to ALLOW by Amendment 1 ruling 1 —
 * they map one-to-one onto the eight refusals this file used to assert. A bulk re-label is
 * exactly the edit that can weaken an assertion into vacuity without anyone noticing, so
 * every flipped arm was run against the PRE-B4 authorizer and REQUIRED to be red there:
 * the old code denies, so an arm that passed before the change was not testing what its
 * new label claims.
 *
 * ⭐ THE CONTROL EARNED ITS KEEP IMMEDIATELY. Two arms passed pre-change — the DOB and
 * phone ones — and the reason was not that they were flips at all: those columns did not
 * exist before B1, and the arms asserted only `ok:true` plus "a write happened", which the
 * patch's other fields satisfied. They were green while the new field was silently
 * dropped. They are now payload assertions and are counted as NEW, not FLIPPED.
 *
 * ⚠ AND THE CONVERSE, which matters more than it looks: the NEW DENY arms (§3–§6) are
 * green against the pre-B4 code too — but for the WRONG REASON, because the old authorizer
 * denied a hospital_admin everything. Their discriminating power comes ENTIRELY from being
 * paired with ALLOW arms over the same fixture. Read no DENY arm here as evidence on its
 * own; read each one against its twin.
 */

const ORG_A = '0c000000-0000-0000-0000-00000000000a'
const HOSP_A = '05000000-0000-0000-0000-00000000000a'
const HOSP_B = '05000000-0000-0000-0000-0000000000a2'
const TARGET = '00000000-0000-0000-0000-000000000002'
/** The id GoTrue hands back from `createUser` — what `registerUser` must return (F3). */
const CREATED_USER_ID = '0aff2004-0000-0000-0000-000000000001'

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

/** Administers BOTH hospitals — the target's whole footprint, so the subset bound holds. */
const dualHospitalAdminSession: SessionShape = {
  userId: '00000000-0000-0000-0000-0000000000e3',
  isInactive: false,
  isAdmin: false,
  orgAdminOf: [],
  hospitalAdminOf: [
    { hospital: { id: HOSP_A }, organization: { id: ORG_A } },
    { hospital: { id: HOSP_B }, organization: { id: ORG_A } },
  ],
}

/** Administers only the SIBLING hospital — disjoint from the target's footprint. */
const siblingHospitalAdminSession: SessionShape = {
  userId: '00000000-0000-0000-0000-0000000000e4',
  isInactive: false,
  isAdmin: false,
  orgAdminOf: [],
  hospitalAdminOf: [{ hospital: { id: HOSP_B }, organization: { id: ORG_A } }],
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

/**
 * ⭐ AE1.3 (ADR 0161) — THE PERSON DOORS, MODELLED AS THE WRITES THEY PERFORM.
 *
 * All nine person-level writes moved from raw `.from('profiles').update({…})` to
 * `public.*_for` doors, so the fake's write recorder stopped seeing them and fourteen
 * assertions in this file went red at once. ⛔ NOT ONE ASSERTION WAS REWRITTEN TO PASS:
 * every matcher, expected value and message below is unchanged. What moved is the
 * OBSERVATION POINT — a fake models the effect of the thing it stands in for, and the
 * effect of `update_person_fields_for` is a `profiles` update. Restoring that is the
 * fixture's job, not the assertions'.
 *
 * ⛔ THE `p_set_*` BOOLEANS ARE HONOURED HERE, NOT FLATTENED, and that is the whole
 * difference between a faithful fake and one that hides the defect. A door call that does
 * not set a column must not put it in the modelled payload — otherwise a caller that
 * wrongly passed `p_set_cpf: false` would still look like it wrote the CPF, and the
 * absent-key/explicit-null distinction those booleans exist to carry would be untestable
 * from here.
 *
 * ⚠ The negative assertions keep their full power without any help: a DENIED action is
 * refused by the TS gate before any RPC is issued, so no call reaches this map and no
 * write is recorded.
 */
const PERSON_DOOR_WRITES: Record<
  string,
  (a: Record<string, unknown>) => { table: string; op: string; payload: Record<string, unknown> }
> = {
  finalize_invited_person_for: (a) => ({
    table: 'profiles',
    op: 'update',
    payload: {
      full_name: a.p_full_name,
      professional_category_id: a.p_professional_category_id,
      cpf: a.p_cpf,
      date_of_birth: a.p_date_of_birth,
      phone: a.p_phone,
      must_change_password: a.p_must_change_password,
    },
  }),
  update_person_fields_for: (a) => ({
    table: 'profiles',
    op: 'update',
    payload: {
      full_name: a.p_full_name,
      professional_category_id: a.p_professional_category_id,
      ...(a.p_set_cpf ? { cpf: a.p_cpf } : {}),
      ...(a.p_set_date_of_birth ? { date_of_birth: a.p_date_of_birth } : {}),
      ...(a.p_set_phone ? { phone: a.p_phone } : {}),
    },
  }),
  set_person_active_for: (a) => ({
    table: 'profiles',
    op: 'update',
    // The door clears a residual suspension on the REACTIVATING direction only.
    payload: { is_active: a.p_active, ...(a.p_active ? { suspended_until: null } : {}) },
  }),
  suspend_person_for: (a) => ({
    table: 'profiles',
    op: 'update',
    // ⛔ `suspended_until` ONLY — the door does not touch `is_active`, and a fake that
    // added it here would make a widened door look correct.
    payload: { suspended_until: a.p_suspended_until },
  }),
  upsert_credential_for: (a) => ({
    table: 'professional_credentials',
    op: a.p_id ? 'update' : 'insert',
    payload: {
      user_id: a.p_user,
      issuing_country: a.p_issuing_country,
      issuing_state: a.p_issuing_state,
      issuing_authority: a.p_issuing_authority,
      registration_number: a.p_registration_number,
      expires_on: a.p_expires_on,
      ...(a.p_id ? { verified_at: null } : {}),
    },
  }),
  delete_credential_for: (a) => ({
    table: 'professional_credentials',
    op: 'delete',
    payload: { id: a.p_credential },
  }),
}

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
 *
 * ⚠ FILTERS ARE NOT APPLIED. `.eq`/`.is`/`.not` are identity, so a fixture must contain
 * only rows that genuinely belong to the target. This is why the footprint helpers below
 * SET the arrays outright rather than appending: a leftover row from another describe
 * would silently widen the footprint and turn a subset DENY into an ALLOW.
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
      const model = PERSON_DOOR_WRITES[fn]
      if (model) writes.push(model((args ?? {}) as Record<string, unknown>))
      return { data: null, error: null }
    },
    // `resendInvite` reaches GoTrue, not PostgREST. Modelled because §7 is a REGRESSION
    // twin: without this surface the whole section fails on a missing mock and would have
    // been read as "the generalisation broke resendInvite" — a fixture gap wearing the
    // costume of the exact defect the section exists to detect.
    auth: {
      admin: {
        inviteUserByEmail: async (email: string, opts: unknown) => {
          rpcCalls.push({ fn: 'inviteUserByEmail', args: { email, opts } })
          return { data: null, error: null }
        },
        createUser: async (attrs: unknown) => {
          rpcCalls.push({ fn: 'createUser', args: attrs })
          return { data: { user: { id: CREATED_USER_ID } }, error: null }
        },
      },
    },
  }
}

/** `MESSAGES.orgAdminOnly` — refused specifically by the PERSON-SCOPE gate. */
const FORBIDDEN = /administrador da organiza/i
/**
 * Either refusal. `updateUserProfile` has TWO gates and they return DIFFERENT copy:
 * the ENTRY gate (`authorizeForUser`, any-intersection) answers `MESSAGES.forbidden`,
 * and the inner person-scope gate answers `MESSAGES.orgAdminOnly`. Measured during the
 * red-first run — arms that assumed one message were reading the other gate.
 */
const ANY_REFUSAL = /administrador da organiza|não tem permiss/i

// ---------------------------------------------------------------------------
// Footprint fixtures (ADR 0133 D1(c)). Each SETS both source arrays, never appends.
// `memberships` rows carry the shape the resolver selects: `commission_id`,
// `hospital_id`, and the embedded `commissions.hospital_id`. The TIER is derived
// structurally from `commission_id IS NULL`, matching `memberships_scope_shape` —
// never from a role name, because that vocabulary has been widened four times.
// ---------------------------------------------------------------------------

/** Sole footprint at HOSP_A, commission-tier only. The founding scenario (D3). */
function footprintSoleHospital(): void {
  rows.hospital_affiliations = [{ hospital_id: HOSP_A }]
  rows.memberships = [
    { commission_id: 'comm-a', hospital_id: null, commissions: { hospital_id: HOSP_A } },
  ]
}

/** Serves at HOSP_A **and** HOSP_B. The Amendment-1 split target. */
function footprintCrossHospital(): void {
  rows.hospital_affiliations = [{ hospital_id: HOSP_A }, { hospital_id: HOSP_B }]
  rows.memberships = [
    { commission_id: 'comm-a', hospital_id: null, commissions: { hospital_id: HOSP_A } },
  ]
}

/** Holds an ORG-tier seat (commission_id null, hospital_id null) ⇒ org_admin-only (D2). */
function footprintOrgTier(): void {
  rows.hospital_affiliations = [{ hospital_id: HOSP_A }]
  rows.memberships = [{ commission_id: null, hospital_id: null, commissions: null }]
}

/** Holds a HOSPITAL-tier seat at the CALLER'S OWN hospital ⇒ still org_admin-only (D2). */
function footprintHospitalTier(): void {
  rows.hospital_affiliations = [{ hospital_id: HOSP_A }]
  rows.memberships = [{ commission_id: null, hospital_id: HOSP_A, commissions: null }]
}

/**
 * QA R1 — the person's ONLY tie to HOSP_A is a commission seat that has EXPIRED.
 * ADR 0133 D1(c) says the footprint is the hospitals of the target's *active*
 * commission-tier memberships; an expired seat is not one.
 */
function footprintExpiredSeatOnly(): void {
  rows.hospital_affiliations = []
  rows.memberships = [
    {
      commission_id: 'comm-a',
      hospital_id: null,
      commissions: { hospital_id: HOSP_A },
      expires_at: '2020-01-01T00:00:00.000Z',
    },
  ]
}

/**
 * QA r2 — the MIXED fixture: an ACTIVE affiliation at HOSP_B plus an EXPIRED commission
 * seat at HOSP_A. The caller administers HOSP_B only.
 *
 * ⛔ THE ONLY FIXTURE THAT REACHES THE SUBSET PATH. `footprintExpiredSeatOnly` empties the
 * affiliations, so the footprint collapses to ∅ and every deny there comes from the
 * zero-footprint rule — the subset logic is never consulted, and a revert in the widened
 * direction would go unnoticed.
 */
function footprintActiveElsewherePlusExpiredHere(): void {
  rows.hospital_affiliations = [{ hospital_id: HOSP_B }]
  rows.memberships = [
    {
      commission_id: 'comm-a',
      hospital_id: null,
      commissions: { hospital_id: HOSP_A },
      expires_at: '2020-01-01T00:00:00.000Z',
    },
  ]
}

/** The CONTROL for the arm above: identical fixture, expiry still in the future. */
function footprintFutureExpirySeatOnly(): void {
  rows.hospital_affiliations = []
  rows.memberships = [
    {
      commission_id: 'comm-a',
      hospital_id: null,
      commissions: { hospital_id: HOSP_A },
      expires_at: '2099-01-01T00:00:00.000Z',
    },
  ]
}

/** No affiliation, no seat — belongs to no hospital ⇒ org_admin-only (D2). */
function footprintEmpty(): void {
  rows.hospital_affiliations = []
  rows.memberships = []
}

beforeEach(() => {
  writes = []
  rpcCalls = []
  rows = {
    profiles: {
      id: TARGET,
      home_organization_id: ORG_A,
      full_name: 'Chefe CCIH',
      // `resendInvite` reads this and bails with `missingUser` without it. Added after the
      // red-first run showed §7 failing for a FIXTURE reason while wearing the label of the
      // regression it exists to detect — the same class as the missing GoTrue mock above.
      email: 'chefe.ccih@test.local',
      professional_category_id: 'cat-1',
      // ⚠ DIGITS-ONLY AT REST IS A CONSTRAINT, NOT A CONVENTION: `profiles_cpf_valid`
      // CHECKs `app.is_valid_cpf`, which requires `^[0-9]{11}$`. A formatted value is
      // unstorable, so no fixture may seed one.
      cpf: '11144477735',
      date_of_birth: null,
      phone: null,
    },
    // ⭐ AE2.4 inc 3 — THE ANCHOR MOVED, so the fixture moved with it.
    // `authorizePersonScopedAdmin` and `authorizeForUser` no longer read
    // `profiles.home_organization_id`; both locate the target's organizations from
    // `organization_affiliations` (ADR 0163 last-org retention, ADR 0164). ⛔ Fixed by
    // MIRRORING how the real substrate anchors a person — an ACTIVE, non-voided org
    // affiliation, exactly as `seed.sql` does — never by relaxing an assertion. Same lesson
    // as pgTAP `360 § 5.2`: the fixture had built its world out of the column under test,
    // so every arm here went red for a FIXTURE reason while wearing the label of the
    // authority rule it exists to pin.
    // ⚠ `home_organization_id` is kept on the profiles row above ONLY because
    // `registerUser`'s email/CPF pre-checks still read it on a different path; it no longer
    // feeds any authority decision in this file.
    organization_affiliations: [{ organization_id: ORG_A, ended_on: null }],
    professional_credentials: { user_id: TARGET },
  }
  footprintSoleHospital()
})

// ===========================================================================
// §1 THE FLIPPED ARMS. Every one of these asserted REFUSED before ADR 0133; each
// keeps its original subject and gains the reference that reversed it. The target
// is SOLE-FOOTPRINT at the caller's hospital, which under D3 grants all four
// capabilities — including CPF, whose typo-fix on a sole-hospital person is the
// ADR's founding scenario.
// ===========================================================================
describe('§1 ADR 0133 D3 — a hospital_admin CAN manage a SOLE-FOOTPRINT person', () => {
  it.each([
    ['NAME', { fullName: 'Nome Alterado', professionalCategoryId: 'cat-1' }],
    ['CATEGORY', { fullName: 'Chefe CCIH', professionalCategoryId: 'cat-OUTRA' }],
    ['CPF', { fullName: 'Chefe CCIH', professionalCategoryId: 'cat-1', cpf: '52998224725' }],
  ])('%s is ALLOWED (was REFUSED pre-0133)', async (_label, patch) => {
    session = hospitalAdminSession
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({ userId: TARGET, ...patch } as never)

    expect(result.ok, result.error).toBe(true)
    expect(
      writes.some((w) => w.table === 'profiles' && w.op === 'update'),
      'an allowed edit must actually WRITE — ok:true with no write would be a no-op wearing a success',
    ).toBe(true)
  })

  // ⛔ THESE TWO ARE **NEW ARMS, NOT FLIPPED ONES** — the distinction matters for the
  // red-first accounting. DOB and phone did not exist before B1, so they were never
  // "REFUSED pre-0133"; labelling them as flips would have inflated the flip count.
  //
  // ⭐ AND THEY WERE VACUOUS AS FIRST WRITTEN. Asserting only `ok:true` + "some profiles
  // update happened" PASSED against pre-B4 code: the patch also carries name and category,
  // so a write occurred regardless, and `updateUserProfile` ignored the new keys entirely.
  // The arm would have gone green while the field was silently dropped. The payload
  // assertion below is the whole test — the verdict is incidental.
  it.each([
    ['date_of_birth', { dateOfBirth: '1980-01-01' }, 'date_of_birth', '1980-01-01'],
    ['phone', { phone: '11987654321' }, 'phone', '11987654321'],
  ])('%s REACHES THE WRITE PAYLOAD (new in B1, not a flip)', async (_l, patch, col, expected) => {
    session = hospitalAdminSession
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({
      userId: TARGET,
      fullName: 'Chefe CCIH',
      professionalCategoryId: 'cat-1',
      ...patch,
    } as never)
    expect(result.ok, result.error).toBe(true)
    const write = writes.find((w) => w.table === 'profiles' && w.op === 'update')
    expect(
      (write?.payload as Record<string, unknown>)?.[col],
      `${col} must be IN the update payload — ok:true proves nothing about a dropped field`,
    ).toBe(expected)
  })

  it('CREDENTIALS are ALLOWED (was REFUSED pre-0133)', async () => {
    session = hospitalAdminSession
    const { upsertCredential } = await import('./actions')
    const result = await upsertCredential({
      userId: TARGET,
      issuingCountry: 'BR',
      issuingState: 'SP',
      issuingAuthority: 'CRM',
      registrationNumber: '12345',
    })
    expect(result.ok, result.error).toBe(true)
    expect(writes.filter((w) => w.table === 'professional_credentials')).not.toHaveLength(0)
  })

  it('CREDENTIAL REMOVAL is ALLOWED (was REFUSED pre-0133)', async () => {
    // F6's original point still stands: `removeCredential` must carry its OWN arm, because
    // it shares `upsertCredential`'s gate and reverting that gate reded nothing.
    session = hospitalAdminSession
    const { removeCredential } = await import('./actions')
    const result = await removeCredential('cred-1')
    expect(result.ok, result.error).toBe(true)
    expect(writes.filter((w) => w.op === 'delete')).not.toHaveLength(0)
  })

  it.each([
    ['DEACTIVATION', 'deactivateUser'],
    ['REACTIVATION', 'reactivateUser'],
  ] as const)('%s is ALLOWED for a sole-footprint person (was REFUSED pre-0133)', async (_l, fn) => {
    session = hospitalAdminSession
    const actions = await import('./actions')
    const result = await (actions[fn] as (u: string) => Promise<{ ok: boolean; error?: string }>)(TARGET)
    expect(result.ok, result.error).toBe(true)
    expect(writes.filter((w) => w.op === 'update')).not.toHaveLength(0)
  })

  it('SUSPENSION is ALLOWED for a sole-footprint person (was REFUSED pre-0133)', async () => {
    session = hospitalAdminSession
    const { suspendUser } = await import('./actions')
    const result = await suspendUser(TARGET, null)
    expect(result.ok, result.error).toBe(true)
    expect(writes.filter((w) => w.op === 'update')).not.toHaveLength(0)
  })
})

// ===========================================================================
// §2 THE SHARPEST KEYSTONE — one cross-hospital target, four verdicts.
// ===========================================================================
describe('§2 ⭐ Amendment 1 ruling 1 — the SPLIT, on ONE cross-hospital target', () => {
  beforeEach(() => {
    footprintCrossHospital()
    session = hospitalAdminSession // administers HOSP_A only; target also serves HOSP_B
  })

  it('a FIELD edit is ALLOWED — the local-knowledge argument holds at every hospital served', async () => {
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({
      userId: TARGET,
      fullName: 'Nome Corrigido',
      professionalCategoryId: 'cat-1',
    })
    expect(result.ok, result.error).toBe(true)
  })

  it('a CREDENTIAL edit is ALLOWED — same intersection bound as fields', async () => {
    const { upsertCredential } = await import('./actions')
    const result = await upsertCredential({
      userId: TARGET,
      issuingCountry: 'BR',
      issuingState: 'SP',
      issuingAuthority: 'CRM',
      registrationNumber: '99999',
    })
    expect(result.ok, result.error).toBe(true)
  })

  it('a CPF CHANGE is DENIED — a person-key identity event other hospitals depend on', async () => {
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({
      userId: TARGET,
      fullName: 'Chefe CCIH',
      professionalCategoryId: 'cat-1',
      cpf: '52998224725', // genuinely different from the stored 11144477735
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(FORBIDDEN)
    expect(
      writes.filter((w) => w.table === 'profiles' && w.op === 'update'),
      'a refused CPF change must not have written',
    ).toHaveLength(0)
  })

  it.each([
    ['DEACTIVATION', 'deactivateUser'],
    ['REACTIVATION', 'reactivateUser'],
  ] as const)('%s is DENIED — cross-hospital denial of access is not a local fix', async (_l, fn) => {
    const actions = await import('./actions')
    const result = await (actions[fn] as (u: string) => Promise<{ ok: boolean; error?: string }>)(TARGET)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(FORBIDDEN)
    expect(writes.filter((w) => w.op === 'update')).toHaveLength(0)
  })

  it('SUSPENSION is DENIED — it routes through the same app.is_active kill switch', async () => {
    const { suspendUser } = await import('./actions')
    const result = await suspendUser(TARGET, null)
    expect(result.ok).toBe(false)
    expect(writes.filter((w) => w.op === 'update')).toHaveLength(0)
  })

  it('⭐ administering the WHOLE footprint restores CPF change and lifecycle', async () => {
    // The other half of the subset bound. Without this arm an implementation that simply
    // denied every multi-hospital person would pass every assertion above.
    session = dualHospitalAdminSession
    const { updateUserProfile, deactivateUser } = await import('./actions')
    expect(
      (await updateUserProfile({
        userId: TARGET,
        fullName: 'Chefe CCIH',
        professionalCategoryId: 'cat-1',
        cpf: '52998224725',
      })).ok,
      'CPF change with the whole footprint administered',
    ).toBe(true)
    expect((await deactivateUser(TARGET)).ok, 'deactivation likewise').toBe(true)
  })
})

// ===========================================================================
// §3 The CPF grain — ruled 2026-08-23 (recorded as ADR 0133 Amendment 3).
// ===========================================================================
describe('§3 the CPF gate fires on a CHANGE, not on the key being PRESENT', () => {
  it('⭐ a cross-hospital field edit that ECHOES the unchanged CPF is still ALLOWED', async () => {
    // ⛔ READ THIS BEFORE REBUILDING THE EDIT FORM (F2). ADR 0133 Amdt 1 says the tighter
    // bound applies "whenever the input INCLUDES cpf". Taken literally that defeats the
    // amendment it appears in: Amdt 1 ruling 1 exists to let a hospital_admin edit a
    // cross-hospital person's fields, and presence-based gating denies exactly that the
    // moment the form posts the key. Ruled change-based on 2026-08-23.
    //
    // ⚠ AND IT IS A TRAP LAID FOR THE NEXT AUTHOR, NOT A LIVE BUG: the CURRENT form omits
    // the key when untouched (`...(cpf ? { cpf } : {})`, user-profile-edit-form.tsx:86), so
    // presence-based gating would work TODAY and break when F2 is rebuilt. If you are
    // rebuilding that form, you may post `cpf` freely — this arm is what guarantees it.
    footprintCrossHospital()
    session = hospitalAdminSession
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({
      userId: TARGET,
      fullName: 'Nome Corrigido',
      professionalCategoryId: 'cat-1',
      cpf: '111.444.777-35', // the STORED value, merely reformatted
    })
    expect(result.ok, result.error).toBe(true)
  })

  it.each([
    ['the key ABSENT', {}],
    ['the stored value echoed with INPUT-SIDE formatting', { cpf: '111.444.777-35' }],
  ])('⭐ %s reach the SAME verdict — absence is not the mechanism', async (_label, cpfPatch) => {
    // ⛔ THE CLIENT CANNOT BE THE ENFORCEMENT. If "the form omits the key when untouched"
    // were what keeps the bound correct, the bound would not be enforced at all — this
    // path is service-role with no RLS backstop (D4), so the server must never infer
    // "unchanged" from ABSENCE. Absence and identity must be two paths to ONE verdict,
    // not two code paths that happen to agree today.
    //
    // ⚠ SCOPE OF THE SECOND ARM, stated precisely because it was first specified as
    // proving more than it can. It proves normalisation is applied to the **INPUT** — a raw
    // string equality would see `111.444.777-35` as a change and fire the subset bound. It
    // is NOT evidence about the stored side: `profiles_cpf_valid` CHECKs
    // `app.is_valid_cpf`, which requires `^[0-9]{11}$`, so a stored non-normalised CPF is
    // UNSTORABLE and the discriminating fixture cannot be built in Vitest at all. That
    // guarantee is tested where it lives — `359_profiles_dob_phone.sql` §6 asserts the
    // CHECK REJECTS a formatted CPF — and that pgTAP arm is what would red if anyone
    // relaxed `is_valid_cpf`, which is the only way this predicate could become wrong.
    footprintCrossHospital()
    session = hospitalAdminSession
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({
      userId: TARGET,
      fullName: 'Nome Corrigido',
      professionalCategoryId: 'cat-1',
      ...cpfPatch,
    })
    expect(result.ok, result.error).toBe(true)
  })

  it.each([
    ['null', null],
    ['an empty string', ''],
  ])('⛔ CLEARING the CPF with %s IS a change and hits the subset bound', async (_label, value) => {
    // Erasing a person-key is a person-key identity event exactly like rewriting one. A
    // hospital_admin must not be able to blank another hospital's dependency by sending an
    // empty field — which is the shape a "falsy means untouched" shortcut would allow.
    footprintCrossHospital()
    session = hospitalAdminSession
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({
      userId: TARGET,
      fullName: 'Chefe CCIH',
      professionalCategoryId: 'cat-1',
      cpf: value,
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(FORBIDDEN)
    expect(
      writes.filter((w) => w.table === 'profiles' && w.op === 'update'),
      'a refused CPF clear must not have written',
    ).toHaveLength(0)
  })

  // ⛔ THREE ARMS WERE RETIRED HERE BY AFF4 (ADR 0151 D15), 2026-08-26 — recorded rather
  // than silently deleted, because a keystone that vanishes leaves nothing behind to say
  // whether it was wrong or merely inconvenient.
  //
  // The two `⭐ QA R4` arms ("phone reformatted to the same digits / dateOfBirth empty
  // against a stored null is NOT a change, so no person-level gate is triggered") and
  // "a hospital_admin editing ONLY the matrícula is ALLOWED" all asserted the SAME
  // property: that `updateUserProfile`'s loose entry gate admitted a caller who fails
  // `fields`, so long as the edit changed nothing person-level. Their discriminating
  // fixture was a D2-TIER target — the entry gate passes on the affiliation, `fields`
  // denies on the tier — and the thing they proved was reachable was the MATRÍCULA edit
  // sitting past that gate.
  //
  // ⛔ THAT PATH CANNOT OCCUR. QA R5 measured it in AFF2 and D15 acted on it: the sole
  // caller (`PersonalDataDialog`) never sent `homeHospitalId`/`hospitalEmployeeId`, AFF2's
  // F2 had already moved every employment fact to `AffiliationsPanel` and its own doors,
  // and `UpdateUserProfileInput` no longer carries either key — so the arms' payloads no
  // longer typecheck, let alone run. With the affiliation half deleted, `fields` is the
  // ENTRY gate and "was it an actual change?" no longer decides anything.
  //
  // What survived is kept, in the two arms below: the write-path normalisers (still live,
  // and QA R4's real find) and the D15 verdict itself (the flip of the retired arms).
  it('⭐ QA R4 survives D15 — a FORMATTED phone still reaches the payload as DIGITS', async () => {
    // The half of QA R4 that outlived its own arm. `normalizePhone` no longer feeds a
    // change-detector, but it still coerces the WRITE, and §1's payload arm cannot see it:
    // that one sends `11987654321`, which is already digits, so deleting the normaliser
    // leaves it green. This arm sends formatting, so identity-instead-of-normalise reds.
    footprintCrossHospital() // `fields` ALLOWS, which is now all that is needed to enter
    session = hospitalAdminSession
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({
      userId: TARGET,
      fullName: 'Chefe CCIH',
      professionalCategoryId: 'cat-1',
      phone: '(11) 98765-4321',
    })
    expect(result.ok, result.error).toBe(true)
    const write = writes.find((w) => w.table === 'profiles' && w.op === 'update')
    expect(
      (write?.payload as Record<string, unknown>)?.phone,
      'the write path must strip formatting — a raw value here is a stored-format defect',
    ).toBe('11987654321')
  })

  it('⛔ D15 — a D2-TIER caller is now refused an edit the OLD entry gate ADMITTED', async () => {
    // ⭐ THE DIRECT FLIP OF THE RETIRED ARMS, and the reason retiring them is a tightening
    // rather than a loss. This is the same fixture and the same payload minus the two
    // deleted keys; it asserted `ok:true` until 2026-08-26 and asserts a refusal now.
    //
    // Under the old `authorizeForUser` entry gate this caller was ADMITTED (the affiliation
    // intersects) and then reached the write because nothing person-level changed. D15
    // makes `fields` the entry bound, and D2 denies a hospital_admin a tier-seat person —
    // so the caller no longer gets in at all. ⚠ The write assertion is load-bearing: a
    // refusal that still wrote would be the over-grant wearing a refusal.
    footprintHospitalTier()
    session = hospitalAdminSession
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({
      userId: TARGET,
      fullName: 'Chefe CCIH', // unchanged
      professionalCategoryId: 'cat-1', // unchanged
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(FORBIDDEN)
    expect(
      writes.filter((w) => w.table === 'profiles' && w.op === 'update'),
      'a refused edit must not have written',
    ).toHaveLength(0)
  })
})

// ===========================================================================
// §4 D2 — tier and empty footprint stay org_admin-only, for EVERY capability.
// ===========================================================================
describe('§4 ADR 0133 D2 — tier and empty footprint are org_admin-only', () => {
  it.each([
    ['an ORG-TIER seat', footprintOrgTier],
    ['a HOSPITAL-TIER seat at the caller\'s OWN hospital', footprintHospitalTier],
    ['NO footprint at all', footprintEmpty],
  ])('%s denies a hospital_admin even a FIELD edit', async (_label, setFixture) => {
    // Fields are the LOOSEST capability (intersection). Asserting the deny here rather than
    // on lifecycle is deliberate: if the loosest one denies, the subset ones cannot admit.
    setFixture()
    session = hospitalAdminSession
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({
      userId: TARGET,
      fullName: 'Nome Alterado',
      professionalCategoryId: 'cat-1',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(ANY_REFUSAL)
    expect(writes.filter((w) => w.table === 'profiles' && w.op === 'update')).toHaveLength(0)
  })

  it('the TIER fixtures are refused by the PERSON-SCOPE gate specifically, not the entry gate', async () => {
    // Pins the distinction the arm above deliberately does not: D2 is enforced by the new
    // inner gate. If the tier rule were dropped, the entry gate would happily admit these
    // (the intersection is real) and only this assertion would notice.
    footprintHospitalTier()
    session = hospitalAdminSession
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({
      userId: TARGET,
      fullName: 'Nome Alterado',
      professionalCategoryId: 'cat-1',
    })
    expect(result.error, 'must be the person-scope refusal, not the entry-gate one').toMatch(FORBIDDEN)
  })

  it.each([
    ['a FIELD edit', 'fields'],
  ])('⭐ QA R1 — an EXPIRED commission seat is not a footprint: %s is DENIED', async () => {
    // ⛔ THE BUG THIS PINS. `resolvePersonFootprint` filtered the affiliations leg
    // (`ended_on is null`) and NOT the memberships leg, so an expired seat still put
    // HOSP_A in `hospitalIds` and handed a hospital_admin person-level WRITE authority
    // over someone with no remaining tie to their hospital — on the path ADR 0133 D4
    // declares has NO RLS backstop. D1(c) says "active"; nothing implemented it.
    footprintExpiredSeatOnly()
    session = hospitalAdminSession
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({
      userId: TARGET,
      fullName: 'Nome Alterado',
      professionalCategoryId: 'cat-1',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(ANY_REFUSAL)
    expect(writes.filter((w) => w.table === 'profiles' && w.op === 'update')).toHaveLength(0)
  })

  it('⭐ QA R1 — and a CREDENTIAL write is DENIED on the same target', async () => {
    // The second intersection capability. Asserted separately because `credentials` has
    // its own call sites (`upsertCredential` / `removeCredential`) and F6 recorded that a
    // shared gate can be reverted without reddening the sibling.
    footprintExpiredSeatOnly()
    session = hospitalAdminSession
    const { upsertCredential } = await import('./actions')
    const result = await upsertCredential({
      userId: TARGET,
      issuingCountry: 'BR',
      issuingState: 'SP',
      issuingAuthority: 'CRM',
      registrationNumber: '55555',
    })
    expect(result.ok).toBe(false)
    expect(writes.filter((w) => w.table === 'professional_credentials')).toHaveLength(0)
  })

  it('⭐ CONTROL for QA R1: the SAME fixture with a FUTURE expiry is ALLOWED', async () => {
    // Without this, the two denies above are satisfied by any implementation that drops
    // every membership carrying an `expires_at` at all — or indeed by one that broke the
    // memberships leg entirely. The rule is "expired", not "has an expiry column set".
    footprintFutureExpirySeatOnly()
    session = hospitalAdminSession
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({
      userId: TARGET,
      fullName: 'Nome Alterado',
      professionalCategoryId: 'cat-1',
    })
    expect(result.ok, result.error).toBe(true)
  })

  it.each([
    ['DEACTIVATION (lifecycle)', 'lifecycle'],
    ['a CPF CHANGE (cpf_change)', 'cpf_change'],
  ])('⭐ QA r2 — dropping an expired seat WIDENS the subset capabilities: %s is ALLOWED', async (_l, capability) => {
    // ⛔ THIS ARM EXISTS BECAUSE "THE FIX IS STRICTLY STRICTER" WAS FALSE. Shrinking the
    // footprint cuts the two bounds in OPPOSITE directions: fewer intersections, but a
    // smaller set is easier to be a SUBSET of. Worked against the pure predicate —
    //   before  footprint {H1,H2} vs administered {H2}:  fields ALLOW, lifecycle DENY
    //   after   footprint {H2}    vs administered {H2}:  fields ALLOW, lifecycle ALLOW
    // So the R1 fix WIDENS `cpf_change` and `lifecycle` — the two the ADR keeps tight
    // precisely because deactivation is a platform-wide kill switch.
    //
    // ⚠ THE BEHAVIOUR IS CORRECT AND IS PINNED AS INTENDED, not tolerated. D1(c) defines the
    // footprint as the ACTIVE set; an expired seat grants no access at HOSP_A, so
    // deactivating denies nothing there and the caller does administer everywhere the person
    // still reaches. The point of the arm is that the widening must be DELIBERATE — the
    // three sibling R1 arms all collapse the footprint to ∅ and would not notice a revert.
    footprintActiveElsewherePlusExpiredHere()
    session = siblingHospitalAdminSession // administers HOSP_B only
    const actions = await import('./actions')

    if (capability === 'lifecycle') {
      const result = await actions.deactivateUser(TARGET)
      expect(result.ok, result.error).toBe(true)
    } else {
      const result = await actions.updateUserProfile({
        userId: TARGET,
        fullName: 'Chefe CCIH',
        professionalCategoryId: 'cat-1',
        cpf: '52998224725', // genuinely different from the stored 11144477735
      })
      expect(result.ok, result.error).toBe(true)
    }
  })

  it('the hospital-tier deny also blocks the lifecycle (self-deactivation is structurally impossible)', async () => {
    footprintHospitalTier()
    session = hospitalAdminSession
    const { deactivateUser } = await import('./actions')
    expect((await deactivateUser(TARGET)).ok).toBe(false)
  })
})

// ===========================================================================
// §5 The sibling hospital — disjoint from the footprint.
// ===========================================================================
describe('§5 a SIBLING hospital admin holds nothing over this person', () => {
  it('is denied a field edit despite being a hospital_admin of the same org', async () => {
    // ⚠ Refused by the ENTRY gate (`authorizeForUser`, no intersection), so the message is
    // `MESSAGES.forbidden`. That makes this a defence-in-depth regression arm rather than a
    // person-scope keystone — the person-scope gate is never reached here. Kept because the
    // entry gate is the thing that must not be loosened while generalising the resolver.
    session = siblingHospitalAdminSession // administers HOSP_B; target is at HOSP_A
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({
      userId: TARGET,
      fullName: 'Nome Alterado',
      professionalCategoryId: 'cat-1',
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(ANY_REFUSAL)
  })

  it('CONTROL: the SAME session CAN edit a person whose footprint it does administer', async () => {
    // Without this, §5's deny is indistinguishable from a broken session fixture.
    rows.hospital_affiliations = [{ hospital_id: HOSP_B }]
    rows.memberships = []
    session = siblingHospitalAdminSession
    const { updateUserProfile } = await import('./actions')
    const result = await updateUserProfile({
      userId: TARGET,
      fullName: 'Nome Alterado',
      professionalCategoryId: 'cat-1',
    })
    expect(result.ok, result.error).toBe(true)
  })
})

// ===========================================================================
// §6 The org_admin twins. A widening that admits EVERYONE passes its positive
// keystones by construction, so the org_admin arm must still be shown intact.
// ===========================================================================
describe('§6 the org_admin ALLOW twins (unchanged by ADR 0133)', () => {
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

  it('an org_admin CAN manage a CROSS-HOSPITAL person completely', async () => {
    // The org_admin is not footprint-bounded at all — the arm that keeps §2's denies from
    // reading as "nobody may do this".
    footprintCrossHospital()
    session = orgAdminSession
    const { updateUserProfile, deactivateUser } = await import('./actions')
    expect(
      (await updateUserProfile({
        userId: TARGET,
        fullName: 'Chefe CCIH',
        professionalCategoryId: 'cat-1',
        cpf: '52998224725',
      })).ok,
      'CPF change',
    ).toBe(true)
    expect((await deactivateUser(TARGET)).ok, 'deactivate').toBe(true)
  })

  it('an org_admin CAN reactivate, suspend, and remove a credential', async () => {
    session = orgAdminSession
    const { reactivateUser, suspendUser, removeCredential } = await import('./actions')
    expect((await reactivateUser(TARGET)).ok, 'reactivate').toBe(true)
    expect((await suspendUser(TARGET, null)).ok, 'suspend').toBe(true)
    expect((await removeCredential('cred-1')).ok, 'removeCredential').toBe(true)
  })
})

// ===========================================================================
// §7 `resendInvite` — the REGRESSION TWIN required by the lead. It is gated by
// `authorizeForUser`, which shares the footprint resolver B4 generalised. That
// path must behave EXACTLY as before: any-intersection, no tier rule, no subset.
// ===========================================================================
describe('§7 resendInvite is UNCHANGED by the B4 generalisation', () => {
  it('a hospital_admin of an intersecting hospital may still resend', async () => {
    session = hospitalAdminSession
    const { resendInvite } = await import('./actions')
    expect((await resendInvite(TARGET)).ok).toBe(true)
  })

  it('⭐ still works for a CROSS-HOSPITAL person — it was never subset-bounded', async () => {
    // The sharp regression: if the generalisation accidentally routed `resendInvite`
    // through the subset bound, this is the only arm that would notice.
    footprintCrossHospital()
    session = hospitalAdminSession
    const { resendInvite } = await import('./actions')
    expect((await resendInvite(TARGET)).ok).toBe(true)
  })

  it('⭐ still works for a HOSPITAL-TIER person — D2 does NOT apply to this path', async () => {
    // `authorizeForUser` has no tier rule and must not acquire one. Resending an invite is
    // not person-level authority; it re-sends an email the person is already entitled to.
    footprintHospitalTier()
    session = hospitalAdminSession
    const { resendInvite } = await import('./actions')
    expect((await resendInvite(TARGET)).ok).toBe(true)
  })

  it('CONTROL: a sibling hospital admin is still refused', async () => {
    session = siblingHospitalAdminSession
    const { resendInvite } = await import('./actions')
    expect((await resendInvite(TARGET)).ok).toBe(false)
  })
})

// ===========================================================================
// §8 registerUser — unchanged CPF rules, plus the created id F3 needs.
// ===========================================================================
describe('§8 registerUser — CPF is required, validated and normalized (ADR 0097 D7)', () => {
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

  it('⭐ returns the CREATED USER ID on success (ADR 0133 F3 needs it to redirect)', async () => {
    // `RegisterUserState.userId` is optional, which makes it exactly the kind of field that
    // can quietly stop being set with nothing to notice — the wizard would just fall back
    // to the directory and nobody would call it a bug.
    session = orgAdminSession
    rows.profiles = [null, null] // email pre-check misses, CPF pre-check misses
    const { registerUser } = await import('./actions')
    const result = await registerUser({
      homeOrganizationId: ORG_A,
      fullName: 'Novo Alguém',
      email: 'novo@test.local',
      professionalCategoryId: 'cat-1',
      cpf: '111.444.777-35',
      password: 'Test1234!',
    })
    expect(result.ok, result.error).toBe(true)
    expect(
      result.userId,
      'the created id must come back, and be the one GoTrue minted — `toBeTruthy` would pass on any stray string',
    ).toBe(CREATED_USER_ID)
  })

  it('⭐ writes date_of_birth and phone when supplied (B1 columns, service path only)', async () => {
    // The registration half of the pair asserted for updateUserProfile in §1. Payload
    // assertion, not a verdict: `ok:true` says nothing about a dropped column.
    session = orgAdminSession
    rows.profiles = [null, null]
    const { registerUser } = await import('./actions')
    await registerUser({
      homeOrganizationId: ORG_A,
      fullName: 'Novo Alguém',
      email: 'novo2@test.local',
      professionalCategoryId: 'cat-1',
      cpf: '111.444.777-35',
      password: 'Test1234!',
      dateOfBirth: '1990-05-20',
      phone: '(11) 98765-4321',
    })
    const write = writes.find((w) => w.table === 'profiles' && w.op === 'update')
    const payload = write?.payload as Record<string, unknown>
    expect(payload?.date_of_birth).toBe('1990-05-20')
    expect(payload?.phone, 'phone must be stored DIGITS-ONLY (Amdt 1 ruling 6)').toBe('11987654321')
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

// ===========================================================================
// §9 AFF4 — registerUser gains the start date (D13) and the ORG affiliation (D1/D13).
// ===========================================================================

/**
 * ⛔ A FIXED DATE IN THE PAST, AND NEVER `current_date`. Both doors coalesce a NULL
 * `p_started_on` to today, so an expected value that equals today passes identically
 * whether the parameter is threaded or silently dropped — the assertion and the bug would
 * agree. This value can only appear in a payload by having been carried there.
 */
const PAST_START = '2019-03-04'

describe('§9 AFF4 (ADR 0151 D13) — the affiliation start date and the org affiliation', () => {
  /**
   * ⭐ THE KEYSTONE THIS SECTION EXISTS FOR, and it is written as a PAYLOAD assertion for a
   * measured reason: `registerUser` has ZERO browser coverage on this path — neither
   * `register-person-wizard.tsx` nor `register-person-flow.tsx`'s date fields have a hit in
   * any spec — so nothing downstream notices the value being dropped. A verdict assertion
   * (`ok:true`) is satisfied by a registration that discards the date entirely, which is
   * exactly how the DOB and phone arms in §1 were vacuous when first written.
   *
   * BOTH doors are asserted, not just the hospital one. They are separate pass-throughs and
   * either can be dropped alone: the hospital date rides `affiliate_person_for`, and the org
   * date rides `affiliate_person_to_org_for`, because D5's org-parent ensure inside
   * `affiliate_person_impl` takes no date of its own.
   */
  it('⭐ the START DATE reaches BOTH doors — org and hospital', async () => {
    session = orgAdminSession
    rows.profiles = [null, null] // email pre-check misses, CPF pre-check misses
    const { registerUser } = await import('./actions')
    const result = await registerUser({
      homeOrganizationId: ORG_A,
      fullName: 'Novo Alguém',
      email: 'aff4.start@test.local',
      professionalCategoryId: 'cat-1',
      cpf: '111.444.777-35',
      password: 'Test1234!',
      homeHospitalId: HOSP_A,
      affiliationStartedOn: PAST_START,
    })
    expect(result.ok, result.error).toBe(true)

    const orgDoor = rpcCalls.find((c) => c.fn === 'affiliate_person_to_org_for')
    expect(orgDoor, 'the ORG door must be called on the org_admin path').toBeTruthy()
    expect(
      (orgDoor?.args as Record<string, unknown>)?.p_started_on,
      'the org affiliation must carry the supplied start date, not today',
    ).toBe(PAST_START)

    const hospitalDoor = rpcCalls.find((c) => c.fn === 'affiliate_person_for')
    expect(hospitalDoor, 'the HOSPITAL door must be called when a hospital was named').toBeTruthy()
    expect(
      (hospitalDoor?.args as Record<string, unknown>)?.p_started_on,
      'the hospital affiliation must carry the supplied start date, not today',
    ).toBe(PAST_START)
  })

  it('the ORG affiliation is created BEFORE the hospital one (D4 containment order)', async () => {
    // The parent precedes the child. `hospital_affiliation_has_org_trg` is DEFERRABLE
    // INITIALLY DEFERRED so either order commits, but writing the child first makes the
    // invariant depend on deferral rather than on ordering — and the seed's own insert
    // ordering had to be fixed for exactly this reason (plan B7).
    session = orgAdminSession
    rows.profiles = [null, null]
    const { registerUser } = await import('./actions')
    await registerUser({
      homeOrganizationId: ORG_A,
      fullName: 'Novo Alguém',
      email: 'aff4.order@test.local',
      professionalCategoryId: 'cat-1',
      cpf: '111.444.777-35',
      password: 'Test1234!',
      homeHospitalId: HOSP_A,
    })
    const orgAt = rpcCalls.findIndex((c) => c.fn === 'affiliate_person_to_org_for')
    const hospitalAt = rpcCalls.findIndex((c) => c.fn === 'affiliate_person_for')
    expect(orgAt, 'the org door must have been called').toBeGreaterThanOrEqual(0)
    expect(hospitalAt, 'the hospital door must have been called').toBeGreaterThanOrEqual(0)
    expect(orgAt).toBeLessThan(hospitalAt)
  })

  it('⛔ a HOSPITAL-LESS registration still creates the org affiliation', async () => {
    // B6b re-predicated the directory roster onto `organization_affiliations`. Without this
    // call the person would exist and appear on NOBODY's roster — a state no verdict
    // assertion anywhere would notice, because the registration itself succeeds.
    session = orgAdminSession
    rows.profiles = [null, null]
    const { registerUser } = await import('./actions')
    const result = await registerUser({
      homeOrganizationId: ORG_A,
      fullName: 'Sem Hospital',
      email: 'aff4.nohosp@test.local',
      professionalCategoryId: 'cat-1',
      cpf: '111.444.777-35',
      password: 'Test1234!',
      affiliationStartedOn: PAST_START,
    })
    expect(result.ok, result.error).toBe(true)
    const orgDoor = rpcCalls.find((c) => c.fn === 'affiliate_person_to_org_for')
    expect(orgDoor, 'an unaffiliated person must still be anchored to the org').toBeTruthy()
    expect((orgDoor?.args as Record<string, unknown>)?.p_started_on).toBe(PAST_START)
    expect(
      rpcCalls.some((c) => c.fn === 'affiliate_person_for'),
      'no hospital was named, so no employment row may be created',
    ).toBe(false)
  })

  it('⛔ a HOSPITAL_ADMIN registrar does NOT call the org door (it is org_admin-only, D2)', async () => {
    // ⭐ THE DENY TWIN, and it is the arm that keeps the ALLOW arms honest. Calling the org
    // door here would raise 42501 in PostgreSQL — `app.affiliate_person_to_org_impl` gates
    // on `is_org_admin_of_for` with no hospital_admin arm — and would fail a registration
    // the product permits. The org affiliation arrives instead through D5's org-parent
    // ensure INSIDE `affiliate_person_impl`, which is what makes hospital onboarding one
    // step. ⚠ The Vitest fake never raises, so this asymmetry is invisible to any verdict
    // assertion: only counting the calls can see it.
    session = hospitalAdminSession
    rows.profiles = [null, null]
    const { registerUser } = await import('./actions')
    const result = await registerUser({
      homeOrganizationId: ORG_A,
      fullName: 'Contratado Local',
      email: 'aff4.hospadmin@test.local',
      professionalCategoryId: 'cat-1',
      cpf: '111.444.777-35',
      password: 'Test1234!',
      homeHospitalId: HOSP_A,
      affiliationStartedOn: PAST_START,
    })
    expect(result.ok, result.error).toBe(true)
    expect(
      rpcCalls.some((c) => c.fn === 'affiliate_person_to_org_for'),
      'a hospital_admin has no authority at the organisation tier',
    ).toBe(false)
    const hospitalDoor = rpcCalls.find((c) => c.fn === 'affiliate_person_for')
    expect(
      (hospitalDoor?.args as Record<string, unknown>)?.p_started_on,
      'the start date must still reach the hospital door on this path',
    ).toBe(PAST_START)
  })

  it('an OMITTED start date sends no key, leaving the default to the kernel', async () => {
    // `undefined`, not `null`. Both behave identically against today's
    // `coalesce(p_started_on, current_date)`, but sending an explicit NULL bakes that
    // default into this layer, and the day it is ever narrowed the two stop agreeing.
    session = orgAdminSession
    rows.profiles = [null, null]
    const { registerUser } = await import('./actions')
    await registerUser({
      homeOrganizationId: ORG_A,
      fullName: 'Sem Data',
      email: 'aff4.nodate@test.local',
      professionalCategoryId: 'cat-1',
      cpf: '111.444.777-35',
      password: 'Test1234!',
      homeHospitalId: HOSP_A,
      affiliationStartedOn: '   ', // blank is "the box was empty", not a date
    })
    for (const fn of ['affiliate_person_to_org_for', 'affiliate_person_for']) {
      const call = rpcCalls.find((c) => c.fn === fn)
      expect(call, `${fn} must have been called`).toBeTruthy()
      expect(
        (call?.args as Record<string, unknown>)?.p_started_on,
        `${fn} must omit the key rather than send null`,
      ).toBeUndefined()
    }
  })
})
