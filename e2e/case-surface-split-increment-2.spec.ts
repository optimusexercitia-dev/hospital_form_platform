import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"

/**
 * ADR 0134 — case surface split, Increment 2 (S8 `read_cases`, the bulk two-key
 * gate, Amendment 4's `explicit_grants_only` ceiling, Amendment 5's appoint-time
 * grant). New coverage per the tester's spawn prompt; Task A's copy fix and Task
 * C's follow-up closure live in `administrativo.spec.ts` (POS-2b), not here.
 *
 * Seeded personas used (password Test1234!), all commission CCIH under org rede-a:
 *   chefe.ccih@test.local   staff_admin (coordinator)                 …02
 *   staff1.ccih@test.local  plain staff — this file's mutable persona;
 *                            appointed/re-shaped/torn-down per test via
 *                            `setCapabilities`, always from a clean slate.
 *   staff2.ccih@test.local  Administrativo — ALL FIVE capabilities (seeded),
 *                            used READ-ONLY here (never mutated — administrativo.spec.ts's
 *                            POS-1..5 rely on its capability set staying put).
 *
 * Fixtures read (never mutated): the ADR-0083 custom-fields case
 * `d0cf0000-…-c1` ("Óbito enfermaria leito 3", `commission_default`, chefe-authored,
 * 1 pending phase) and the ETH·E1 ethics case `ca000000-…-e1` ("Denúncia Ética
 * (fixture E1)", `explicit_grants_only`).
 *
 * COVERAGE (spawn-prompt Task B, priority order):
 *   B1  the bulk two-key gate at the UI — positive (create_cases + assign_case_phases)
 *       plus BOTH single-key negatives.
 *   B2  `all_phases` offered to a coordinator, withheld from a two-key administrativo
 *       (paired).
 *   B3  S8 board-fill (staff2) + the read-only boundary at a case detail, isolated to
 *       a read_cases-ONLY administrativo so no other capability can explain the result.
 *   B4  Amendment 4's `explicit_grants_only` ceiling — invisible to read_cases, visible
 *       to the coordinator (paired), with a no-leakage body check.
 *   B5  Amendment 5 — the appoint dialog renders `read_cases` CHECKED with no extra
 *       click, and unchecking it narrows the board back down.
 *
 * Every "absent" assertion below is paired against a "present" control (the
 * coordinator, or a differently-shaped administrativo) so the absence cannot be an
 * artifact of a broken fixture — see the report for the explicit neutralization
 * record per test.
 *
 * Runs against the LOCAL Supabase stack + a STANDALONE prod build. Serial — every
 * test re-shapes the SAME mutable persona (staff1.ccih). Run --workers=1.
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}

const ORG = 'rede-a'
const BASE = `/o/${ORG}/c/ccih`
const COMM_CCIH = 'a0000000-0000-0000-0000-0000000000a1'

const UID_STAFF1 = '00000000-0000-0000-0000-000000000003'
const UID_STAFF2 = '00000000-0000-0000-0000-000000000004'

const CF_CASE_ID = 'd0cf0000-0000-0000-0000-0000000000c1'
const CF_CASE_LABEL = 'Óbito enfermaria leito 3'
const ETHICS_CASE_ID = 'ca000000-0000-0000-0000-0000000000e1'
const ETHICS_CASE_LABEL = 'Denúncia Ética (fixture E1)'

const PW = 'Test1234!'

// ---------------------------------------------------------------------------
// Helpers (mirror administrativo.spec.ts's conventions)
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, pw = PW) {
  await cachedSignIn(page, email, pw)
}

async function signOut(page: Page) {
  await page.goto(`${BASE}/meus-casos`)
  await page.waitForURL(/meus-casos/)
  await page.getByRole('button', { name: /abrir menu da conta/i }).click()
  await page.getByRole('menuitem', { name: /sair/i }).click()
  await page.waitForURL(/\/login/)
}

async function getToken(req: APIRequestContext, email: string): Promise<string> {
  const resp = await req.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password: PW },
  })
  expect(resp.ok(), `login ${email}`).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

async function rpcAs(
  req: APIRequestContext,
  token: string,
  fn: string,
  body: Record<string, unknown>,
) {
  return req.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })
}

async function dbQuery<T = Record<string, unknown>>(
  req: APIRequestContext,
  table: string,
  params: Record<string, string>,
): Promise<T[]> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const res = await req.get(`${SUPABASE_URL}/rest/v1/${table}?${qs}&select=*`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  })
  if (!res.ok()) return []
  return (await res.json()) as T[]
}

/** Service-role delete of an Administrativo appointment (cascades its capabilities). */
async function clearAppointment(req: APIRequestContext, userId: string) {
  await req.delete(
    `${SUPABASE_URL}/rest/v1/commission_administrativos?commission_id=eq.${COMM_CCIH}&user_id=eq.${userId}`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  )
}

/**
 * Re-shape staff1's Administrativo standing to EXACTLY `caps`, always from a clean
 * slate (clear → appoint → adjust). A fresh appointment auto-grants `read_cases`
 * (ADR 0134 Amendment 5) and nothing else, so this explicitly REVOKES it when the
 * caller does not want it, rather than assuming a clean start.
 */
async function setCapabilities(
  req: APIRequestContext,
  chefeToken: string,
  userId: string,
  caps: readonly string[],
) {
  await clearAppointment(req, userId)
  const appointRes = await rpcAs(req, chefeToken, 'appoint_administrativo', {
    p_commission_id: COMM_CCIH,
    p_user_id: userId,
  })
  expect(appointRes.ok(), `appoint_administrativo(${userId}): ${await appointRes.text()}`).toBeTruthy()

  if (!caps.includes('read_cases')) {
    const r = await rpcAs(req, chefeToken, 'revoke_member_capability', {
      p_commission_id: COMM_CCIH,
      p_user_id: userId,
      p_capability: 'read_cases',
    })
    expect(r.ok(), `revoke auto-granted read_cases: ${await r.text()}`).toBeTruthy()
  }
  for (const cap of caps) {
    if (cap === 'read_cases') continue // already there from the fresh appointment
    const r = await rpcAs(req, chefeToken, 'grant_member_capability', {
      p_commission_id: COMM_CCIH,
      p_user_id: userId,
      p_capability: cap,
    })
    expect(r.ok(), `grant ${cap}: ${await r.text()}`).toBeTruthy()
  }
}

// ---------------------------------------------------------------------------
// B1 — the two-key bulk gate at the UI (ADR 0134 Amendment 7).
// Positive: create_cases + assign_case_phases → the board's "Múltiplos casos"
// link AND the /multiplos route. BOTH single-key negatives, separately, so
// "requires two keys" is demonstrated rather than merely asserted.
// ---------------------------------------------------------------------------

test('B1 bulk two-key gate (positive, keyboard-only): create_cases + assign_case_phases reaches the board link and the wizard', async ({
  page,
}) => {
  const chefeToken = await getToken(page.request, 'chefe.ccih@test.local')
  await setCapabilities(page.request, chefeToken, UID_STAFF1, ['create_cases', 'assign_case_phases'])

  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`${BASE}/manage/cases`)
  await page.waitForURL(`${BASE}/manage/cases`)

  const bulkLink = page.getByRole('link', { name: /Múltiplos casos/i })
  await expect(bulkLink).toBeVisible({ timeout: 10_000 })

  // Keyboard-only activation (CLAUDE.md §8) — no `.click()`.
  await bulkLink.focus()
  await expect(bulkLink).toBeFocused()
  await page.keyboard.press('Enter')
  await page.waitForURL(`${BASE}/manage/cases/multiplos`, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /^Múltiplos casos$/i })).toBeVisible({
    timeout: 10_000,
  })

  await signOut(page)
})

test('B1 bulk two-key gate (negative 1/2): create_cases ALONE gets neither the board link nor the route', async ({
  page,
}) => {
  const chefeToken = await getToken(page.request, 'chefe.ccih@test.local')
  await setCapabilities(page.request, chefeToken, UID_STAFF1, ['create_cases'])

  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`${BASE}/manage/cases`)
  await page.waitForURL(`${BASE}/manage/cases`)
  // Positive checkpoint FIRST: the board itself must genuinely render for this
  // persona (create_cases alone satisfies the board's OWN gate) — otherwise the
  // link-absence check below would pass vacuously against a 404 and prove
  // nothing about the two-key predicate specifically.
  await expect(page.getByRole('heading', { name: /^Casos$/i })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: /Novo caso/i }).first()).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByRole('link', { name: /Múltiplos casos/i })).toHaveCount(0)

  // Direct navigation is refused too — the route's own gate, not just a hidden link.
  await page.goto(`${BASE}/manage/cases/multiplos`)
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })

  await signOut(page)
})

test('B1 bulk two-key gate (negative 2/2): assign_case_phases ALONE gets neither the board link nor the route', async ({
  page,
}) => {
  const chefeToken = await getToken(page.request, 'chefe.ccih@test.local')
  await setCapabilities(page.request, chefeToken, UID_STAFF1, ['assign_case_phases'])

  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`${BASE}/manage/cases`)
  await page.waitForURL(`${BASE}/manage/cases`)
  // assign_case_phases alone does not even satisfy the BOARD's own gate
  // (`canInCommission(access,'create_cases')`), so this persona 404s here too —
  // asserted as the boundary actually met, not assumed.
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })

  await page.goto(`${BASE}/manage/cases/multiplos`)
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })

  await signOut(page)
})

// ---------------------------------------------------------------------------
// B2 — `all_phases` is coordinator-only. Withheld from a two-key administrativo,
// offered to the coordinator (paired — the pairing is what makes the absence mean
// something, not a broken fixture).
// ---------------------------------------------------------------------------

test('B2 all_phases scope: withheld from a two-key administrativo, offered to the coordinator (paired)', async ({
  page,
}) => {
  const chefeToken = await getToken(page.request, 'chefe.ccih@test.local')
  await setCapabilities(page.request, chefeToken, UID_STAFF1, ['create_cases', 'assign_case_phases'])

  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/multiplos`)
  await page.waitForURL(`${BASE}/manage/cases/multiplos`)
  await expect(page.getByRole('heading', { name: /^Múltiplos casos$/i })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByRole('button', { name: /Todas as fases/i })).toHaveCount(0)
  // The positive statement of what's offered instead — not just an absence.
  await expect(page.getByText(/Fases atribuídas: apenas a primeira/i)).toBeVisible()
  await signOut(page)

  // Positive control: same route, same option, the coordinator (no appointment).
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/multiplos`)
  await page.waitForURL(`${BASE}/manage/cases/multiplos`)
  await expect(page.getByRole('heading', { name: /^Múltiplos casos$/i })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByRole('button', { name: /Todas as fases/i })).toBeVisible({
    timeout: 10_000,
  })
  await signOut(page)
})

// ---------------------------------------------------------------------------
// B3 — S8 at the UI. staff2 (seeded, create_cases + read_cases, untouched here)
// sees a commission case it holds no grant/authorship on. Neutralization: a
// create_cases-ONLY peer (no read_cases) does NOT see it. The read-only boundary
// is then pinned on a read_cases-ONLY administrativo (no create_cases, no
// assign_case_phases), isolated from staff2's other capabilities so nothing but
// read_cases can explain the result.
// ---------------------------------------------------------------------------

test('B3 S8 board-fill (staff2, neutralized) + the read-only boundary at a case detail (isolated persona, paired)', async ({
  page,
}) => {
  // Ground truth: staff2 holds no per-case grant on the custom-fields case and did
  // not create it — so any visibility below can only come from S8/read_cases.
  const grants = await dbQuery(page.request, 'case_access_grants', {
    case_id: `eq.${CF_CASE_ID}`,
    principal_id: `eq.${UID_STAFF2}`,
  })
  expect(grants.length).toBe(0)
  const [caseRow] = await dbQuery<{ created_by: string }>(page.request, 'cases', {
    id: `eq.${CF_CASE_ID}`,
  })
  expect(caseRow.created_by).not.toBe(UID_STAFF2)

  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`${BASE}/manage/cases`)
  await page.waitForURL(`${BASE}/manage/cases`)
  const table = page.getByRole('table')
  await expect(table).toBeVisible({ timeout: 10_000 })
  await expect(table.getByText(CF_CASE_LABEL)).toBeVisible({ timeout: 10_000 })
  await signOut(page)

  // ── Neutralization: same case, a create_cases-ONLY peer (read_cases explicitly
  // revoked) — the board must NOT include it, proving the visibility above is
  // read_cases, not "any create_cases holder sees the whole commission". ──
  const chefeToken = await getToken(page.request, 'chefe.ccih@test.local')
  await setCapabilities(page.request, chefeToken, UID_STAFF1, ['create_cases'])
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`${BASE}/manage/cases`)
  await page.waitForURL(`${BASE}/manage/cases`)
  // Positive checkpoint FIRST: the board must genuinely render for this peer
  // (create_cases alone satisfies the board's own gate) — otherwise the
  // CF_CASE_LABEL absence below would pass vacuously against a 404 and prove
  // nothing about read_cases specifically.
  const staff1Table = page.getByRole('table')
  await expect(staff1Table).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(CF_CASE_LABEL)).toHaveCount(0)
  await signOut(page)

  // ── Read-only boundary: read_cases ONLY (no create_cases, no assign_case_phases).
  // The board route itself refuses this persona (it gates on create_cases, not
  // read_cases) — asserted as the actual boundary met, not assumed — but the case
  // DETAIL is reached DIRECTLY: `canOpenCaseManagement`'s `isAdministrativo` arm is
  // capability-agnostic (any appointment), and `getCaseDetail`'s read gate is
  // satisfied by S8. No case-wide write affordance may render. ──
  await setCapabilities(page.request, chefeToken, UID_STAFF1, ['read_cases'])
  await signInAs(page, 'staff1.ccih@test.local')

  await page.goto(`${BASE}/manage/cases`)
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })

  await page.goto(`${BASE}/manage/cases/${CF_CASE_ID}`)
  await page.waitForURL(`${BASE}/manage/cases/${CF_CASE_ID}`)
  await expect(page.getByRole('heading', { name: /caso\s*\d+/i })).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('header').getByRole('button', { name: /^Editar$/ })).toHaveCount(0)
  const phase1 = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phase1).toBeVisible({ timeout: 10_000 })
  await expect(phase1.getByRole('button', { name: /Ativar e atribuir/i })).toHaveCount(0)
  await signOut(page)

  // Positive control — same case, same buttons, the coordinator: proves the
  // absences above are the read-only boundary, not the buttons being gone from
  // this case/page altogether.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${CF_CASE_ID}`)
  await page.waitForURL(`${BASE}/manage/cases/${CF_CASE_ID}`)
  await expect(page.locator('header').getByRole('button', { name: /^Editar$/ })).toBeVisible({
    timeout: 10_000,
  })
  const phase1Coord = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phase1Coord.getByRole('button', { name: /Ativar e atribuir/i })).toBeVisible({
    timeout: 10_000,
  })
  await signOut(page)

  await clearAppointment(page.request, UID_STAFF1)
})

// ---------------------------------------------------------------------------
// B4 — Amendment 4's ceiling: `explicit_grants_only` bounds S8 (`not v_eg`). The
// ethics case is invisible to a read_cases administrativo, paired against the
// coordinator who sees it — plus a positive control (a non-eg case DOES show) so
// the ethics absence cannot be misread as an empty/broken board.
// ---------------------------------------------------------------------------

test('B4 Amendment 4 ceiling: the explicit_grants_only ethics case is invisible to read_cases; visible to the coordinator (paired, no leakage)', async ({
  page,
}) => {
  const chefeToken = await getToken(page.request, 'chefe.ccih@test.local')
  await setCapabilities(page.request, chefeToken, UID_STAFF1, ['create_cases', 'read_cases'])

  await signInAs(page, 'staff1.ccih@test.local')

  // The board reaches AND is populated by S8 (the non-eg custom-fields case shows)
  // — so an absent ethics row cannot be misread as "the board is just empty".
  await page.goto(`${BASE}/manage/cases`)
  await page.waitForURL(`${BASE}/manage/cases`)
  const table = page.getByRole('table')
  await expect(table).toBeVisible({ timeout: 10_000 })
  await expect(table.getByText(CF_CASE_LABEL)).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(ETHICS_CASE_LABEL)).toHaveCount(0)

  // Direct nav — no data leakage, ever.
  await page.goto(`${BASE}/manage/cases/${ETHICS_CASE_ID}`)
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })
  const body = (await page.locator('body').textContent()) ?? ''
  expect(body).not.toContain('Denúncia Ética')
  expect(body).not.toContain('Dra. Denunciada')
  expect(body).not.toContain('CRM-9001')
  await signOut(page)

  // Positive control: the coordinator sees + reaches the SAME case.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases`)
  await page.waitForURL(`${BASE}/manage/cases`)
  await expect(page.getByRole('table').getByText(ETHICS_CASE_LABEL)).toBeVisible({
    timeout: 10_000,
  })
  await page.goto(`${BASE}/manage/cases/${ETHICS_CASE_ID}`)
  await page.waitForURL(`${BASE}/manage/cases/${ETHICS_CASE_ID}`)
  await expect(page.getByText(ETHICS_CASE_LABEL)).toBeVisible({ timeout: 10_000 })
  await signOut(page)

  await clearAppointment(page.request, UID_STAFF1)
})

// ---------------------------------------------------------------------------
// B5 — Amendment 5: appointing through the dialog grants read_cases, and the
// checklist renders it CHECKED with no separate click (checkboxes render SERVER
// state — D6's "default-checked" reading was rejected in favor of this: it is a
// grant, not a client-side default). Unchecking it narrows the board back down.
//
// ⛔ CURRENTLY RED — pins a live defect, filed by the tester 2026-08-22 (bug row
// owed by the lead, not this file): `MemberAdministrativoControls.toggleAppointment()`
// (src/components/members/member-administrativo-controls.tsx) calls `setAppointed(true)`
// on a successful appoint but never updates the `caps` state to include the
// auto-granted `read_cases` — the DB row lands correctly (verified directly:
// `commission_administrativo_capabilities` gets the row the instant
// `appoint_administrativo` returns), but the checkbox renders UNCHECKED until a
// full page reload re-derives `initialCapabilities` from fresh server props. Do
// NOT "fix" this test to tolerate the unchecked state — the contract under test
// (Amendment 5) is that the LIVE dialog reflects the grant with no extra click.
// ---------------------------------------------------------------------------

test('B5 Amendment 5: the appoint dialog renders read_cases CHECKED with no extra click; unchecking narrows the board', async ({
  page,
}) => {
  await clearAppointment(page.request, UID_STAFF1)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/members`)
  await page.waitForURL(`${BASE}/manage/members`)
  await expect(page.getByRole('heading', { name: /^Membros$/i })).toBeVisible({ timeout: 10_000 })

  const staff1Row = page.locator('li').filter({ hasText: /Enfermeiro CCIH Um/i })
  await expect(staff1Row).toBeVisible({ timeout: 10_000 })
  await expect(staff1Row.getByText('Administrativo', { exact: true })).toHaveCount(0)
  await staff1Row.getByRole('button', { name: /Tornar Administrativo/i }).click()

  await expect
    .poll(async () => {
      const rows = await dbQuery(page.request, 'commission_administrativos', {
        commission_id: `eq.${COMM_CCIH}`,
        user_id: `eq.${UID_STAFF1}`,
      })
      return rows.length
    }, { timeout: 10_000 })
    .toBe(1)

  // The checklist renders; read_cases is ALREADY checked (no click on it).
  const readCasesCheckbox = staff1Row.getByRole('checkbox', {
    name: /Visualizar os casos da comissão/i,
  })
  await expect(readCasesCheckbox).toBeVisible({ timeout: 10_000 })
  await expect(readCasesCheckbox).toBeChecked()

  // DB truth, same fact from the other side.
  const grantRowsAfterAppoint = await dbQuery(page.request, 'commission_administrativo_capabilities', {
    commission_id: `eq.${COMM_CCIH}`,
    user_id: `eq.${UID_STAFF1}`,
    capability: 'eq.read_cases',
  })
  expect(grantRowsAfterAppoint.length).toBe(1)

  // Also grant create_cases (via the SAME UI) so staff1 can reach the board at all
  // — its route gate is create_cases, not read_cases — which is what lets the
  // "narrows back down" half below be observed on the board rather than a 404.
  const createCasesCheckbox = staff1Row.getByRole('checkbox', { name: /Criar e editar casos/i })
  await createCasesCheckbox.click()
  await expect
    .poll(async () => {
      const rows = await dbQuery(page.request, 'commission_administrativo_capabilities', {
        commission_id: `eq.${COMM_CCIH}`,
        user_id: `eq.${UID_STAFF1}`,
        capability: 'eq.create_cases',
      })
      return rows.length
    }, { timeout: 10_000 })
    .toBe(1)
  await signOut(page)

  // With both capabilities, staff1's board includes the non-eg custom-fields case
  // — S8 widened it — though staff1 neither created nor is assigned to it.
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`${BASE}/manage/cases`)
  await page.waitForURL(`${BASE}/manage/cases`)
  await expect(page.getByRole('table')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(CF_CASE_LABEL)).toBeVisible({ timeout: 10_000 })
  await signOut(page)

  // ── Uncheck read_cases via the SAME UI → the board narrows back down. ──
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/members`)
  await page.waitForURL(`${BASE}/manage/members`)
  const staff1RowAgain = page.locator('li').filter({ hasText: /Enfermeiro CCIH Um/i })
  const readCasesCheckboxAgain = staff1RowAgain.getByRole('checkbox', {
    name: /Visualizar os casos da comissão/i,
  })
  await expect(readCasesCheckboxAgain).toBeChecked({ timeout: 10_000 })
  await readCasesCheckboxAgain.click()
  await expect
    .poll(async () => {
      const rows = await dbQuery(page.request, 'commission_administrativo_capabilities', {
        commission_id: `eq.${COMM_CCIH}`,
        user_id: `eq.${UID_STAFF1}`,
        capability: 'eq.read_cases',
      })
      return rows.length
    }, { timeout: 10_000 })
    .toBe(0)
  await expect(readCasesCheckboxAgain).not.toBeChecked({ timeout: 10_000 })
  await signOut(page)

  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`${BASE}/manage/cases`)
  await page.waitForURL(`${BASE}/manage/cases`)
  await expect(page.getByText(CF_CASE_LABEL)).toHaveCount(0)
  await signOut(page)

  // Cleanup — full un-appoint, regardless of what ran above.
  await clearAppointment(page.request, UID_STAFF1)
})
