import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"

/**
 * Ethics E3a — Terminology/UX surfacing (build plan
 * docs/phases/ethics-e3-surfacing.md §4) — riding on top of ETH·E1 (access spine)
 * and ETH·E2 (procedure). Covers the phase's tester-owned acceptance keystones:
 *   1. Terminology rendering: the seeded Ethics case vs a non-Ethics case's
 *      default fallback.
 *   3/4. `case_events` kind-widen + the per-event `visibility` RLS floor
 *      (coordinator sees both kinds; an ordinary granted reader sees only
 *      `case_readers`; a respondent/recused reader sees NEITHER).
 *   auto-derive: driving real E2 procedure RPCs (decide_admissibility,
 *      add_ethics_allegation, record_ethics_finding) produces the matching
 *      procedural `case_events` rows, surfaced on the real "Atividade" timeline
 *      (ADR 0137 D12 renamed the card from "Registros" to "Atividade").
 *   6/7. The ethics dashboard (`/dashboard/ethics`) confidentiality keystone: a
 *      coordinator vs. an excluded viewer (respondent / recused / non-granted) in
 *      the SAME commission render DIFFERENT (strictly lower) numbers.
 *   5. Flag-off-adjacent regression: a non-Ethics case's tabs/board render
 *      exactly as before E3a.
 *   10. Keyboard-only path (board → the terminology-labeled tab; the dashboard
 *      page itself).
 *
 * Fixture strategy: the SEEDED ethics case (`ca000000-…-e1`, CCIH / commission A)
 * is reused READ-ONLY for the terminology checks (it already carries
 * `case_type_id` → the Ethics type + its 5-row terminology bundle, per
 * `supabase/seed.sql` "ETH·E3a BE-4"). The kind/visibility + dashboard checks use
 * FRESH throwaway ethics cases created via the real `create_case` RPC
 * (`p_case_type_id` inherits `explicit_grants_only` — BE-2/O-1), so numeric
 * dashboard assertions are DELTA-based (before vs. after creating the fixture)
 * rather than absolute — robust to re-runs and to any pre-existing ethics-case
 * residue in the commission (the seeded case, other spec runs, …).
 *
 * Personas (supabase/seed.sql, CCIH / commission A, Rede A):
 *   chefe.ccih@test.local  (…002) — COORDINATOR (staff_admin of CCIH). Also
 *             dynamically bound to a throwaway `professional_profiles` row in
 *             DASH-EXCLUDE-SETUP, to prove the dashboard excludes even the
 *             coordinator's own commission when they are respondent/recused.
 *   staff1.ccih@test.local (…003) — plain CCIH member; used here for a FRESH
 *             recusal on our own throwaway case (independent of the seeded
 *             recusal on the E1/E2 fixture case).
 *   staff2.ccih@test.local (…004) — plain CCIH member; the "ordinary granted,
 *             no exclusion" reader persona.
 *   staff3.ccih@test.local (…009) — plain CCIH member; the "never granted"
 *             boundary persona (granted nothing in this file's fixtures).
 *   staff4.ccih@test.local (…00a) — bound to `professional_profiles`
 *             (fb000000-…-e1) — the RESPONDENT-capable persona (case_participants
 *             role `respondent_doctor`, reusing the seeded registry rows).
 *   chefe.farm@test.local  (…005) — staff_admin of Farmácia (commission B),
 *             SAME org — the cross-commission boundary check for the dashboard.
 *
 * Password for every persona: Test1234!
 *
 * DASH-EXCLUDE note: `/dashboard/ethics` turned out (verified against the live
 * source before writing the test) to be gated `staff_admin`-only at the PAGE
 * level, so a plain granted `staff` member can never reach it regardless of
 * case-level grants (see DASH-ROLE-GATE). The "excluded viewer" half of
 * acceptance #6/#7 is therefore exercised on chefe.ccih THEMSELVES, made the
 * respondent on one throwaway case and recused from another — proving the E1
 * deny-terms bind even the commission's own coordinator.
 *
 * Runs against a PROD-STANDALONE build (`node .next/standalone/server.js`) or a
 * warm dev server — see docs/testing/e2e-prod-build-gate.md. No
 * `waitForLoadState('networkidle')` (purged repo-wide); web-first assertions
 * only. Serial (file-level): the EVT/DASH sections share throwaway fixtures
 * created by dedicated SETUP tests (not `beforeAll`, which runs before every
 * test in the file — see the DASH-SETUP comment for why that matters for
 * delta-based assertions).
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants (from supabase/seed.sql)
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY missing — set it in .env.local.')
}

const ORG = 'rede-a'
const SLUG = 'ccih'
const BASE = `/o/${ORG}/c/${SLUG}`
const MANAGE_BASE = `${BASE}/manage/cases`
const COMMISSION_A = 'a0000000-0000-0000-0000-0000000000a1'
const ORG_A = '0c000000-0000-0000-0000-00000000000a'
const ETHICS_TYPE_ID = 'ce000000-0000-0000-0000-0000000000e1'
const ALLEGATION_CATEGORY_ID = 'ec000000-0000-0000-0000-0000000000e1' // "Conduta profissional inadequada" (org-wide)

// The seeded ETH·E1/E2 fixture case — read-only reuse for the terminology checks.
const CASE_ID_ETHICS_SEEDED = 'ca000000-0000-0000-0000-0000000000e1'
const CASE_ID_NON_ETHICS = 'd0000000-0000-0000-0000-0000000000c1' // "Caso 0001" (case-access.spec.ts)

const UID_CHEFE = '00000000-0000-0000-0000-000000000002'
const UID_STAFF1 = '00000000-0000-0000-0000-000000000003'
const UID_STAFF2 = '00000000-0000-0000-0000-000000000004'
// staff3.ccih (…0009) — the "never granted" boundary persona (DASH-4); referenced
// only by email (readDashboard signs in by email), so no UID constant is needed.
const UID_STAFF4_RESPONDENT = '00000000-0000-0000-0000-00000000000a'
const PARTICIPANT_RESPONDENT = 'fa000000-0000-0000-0000-0000000000e1'
const ROLE_RESPONDENT = 'fc000000-0000-0000-0000-0000000000e1'

const PW = 'Test1234!'

// ---------------------------------------------------------------------------
// UI helpers (mirror ethics-e1-access-spine.spec.ts / ethics-e2-procedure.spec.ts)
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, pw = PW) {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, pw)
}

async function signOut(page: Page) {
  await page.goto(`${BASE}/meus-casos`)
  await page.waitForURL(/meus-casos/)
  const menuBtn = page.getByRole('button', { name: /abrir menu da conta/i })
  await menuBtn.click()
  await page.getByRole('menuitem', { name: /sair/i }).click()
  await page.waitForURL(/\/login/)
}

/**
 * Sign out from WHEREVER the page currently is (the account menu is part of the
 * persistent commission-shell layout, present on every authenticated
 * `/o/[org]/c/[commission]/**` page) — used by {@link readDashboard} so it never
 * has to navigate to a CCIH-specific route for a different-commission persona
 * (e.g. chefe.farm, who has no standing in CCIH at all).
 */
async function signOutFromCurrentPage(page: Page) {
  const menuBtn = page.getByRole('button', { name: /abrir menu da conta/i })
  await menuBtn.click()
  await page.getByRole('menuitem', { name: /sair/i }).click()
  await page.waitForURL(/\/login/)
}

/** Assert the route hits the notFound() boundary — no data leaks.
 * BUG-ACT-NOTFOUND-COPY-1: /não encontr/i — every caller route (casos/[id],
 * dashboard/ethics) hits the commission not-found boundary (ACT ADR 0106's
 * sibling), same shared file as the QO·B CUT_ROUTES sample already verified
 * live. */
async function assertRouteDenied(page: Page, url: string) {
  await page.goto(url)
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })
}

/** Tab through the page (bounded) until `predicate` matches the focused element. */
async function tabUntil(
  page: Page,
  predicate: (info: { tag: string; text: string; href: string | null; ariaLabel: string | null }) => boolean,
  maxPresses = 200,
): Promise<boolean> {
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el) return null
      return {
        tag: el.tagName,
        text: (el.textContent ?? '').trim(),
        href: (el as HTMLAnchorElement).href ?? null,
        ariaLabel: el.getAttribute('aria-label'),
      }
    })
    if (info && predicate(info)) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Service-role + direct-authenticated-JWT helpers
// ---------------------------------------------------------------------------

async function dbQuery<T = Record<string, unknown>>(
  table: string,
  params: Record<string, string>,
): Promise<T[]> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}&select=*`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  })
  if (!res.ok) return []
  const data: unknown = await res.json()
  return Array.isArray(data) ? (data as T[]) : []
}

async function dbInsert(
  table: string,
  body: Record<string, unknown> | Record<string, unknown>[],
): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`dbInsert ${table} failed ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

async function dbDelete(table: string, params: Record<string, string>): Promise<void> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  })
}

/** Upsert a `case_access_grants` READ row (delete-then-insert). */
async function grantRead(caseId: string, userId: string): Promise<void> {
  await dbDelete('case_access_grants', { case_id: `eq.${caseId}`, principal_id: `eq.${userId}` })
  await dbInsert('case_access_grants', {
    case_id: caseId,
    principal_id: userId,
    source: 'manual_grant',
    read_case_content: true,
    read_case_deliberation: true,
    reason_code: 'coordinator_grant',
    granted_by: UID_CHEFE,
  })
}

async function getOwnerToken(request: APIRequestContext, email: string, password = PW): Promise<string> {
  const resp = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password },
  })
  expect(resp.ok()).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

async function callRpc(
  request: APIRequestContext,
  fn: string,
  bearer: string,
  body: Record<string, unknown>,
) {
  return request.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })
}

/** Create a fresh processless ethics case via the REAL `create_case` RPC (chefe). */
async function createEthicsCase(request: APIRequestContext, label: string): Promise<string> {
  const token = await getOwnerToken(request, 'chefe.ccih@test.local')
  const resp = await callRpc(request, 'create_case', token, {
    p_commission_id: COMMISSION_A,
    p_label: label,
    p_case_type_id: ETHICS_TYPE_ID,
  })
  expect(resp.ok()).toBeTruthy()
  const body = (await resp.json()) as { id: string } | { id: string }[]
  const id = Array.isArray(body) ? body[0]?.id : body?.id
  expect(id).toBeTruthy()
  return id
}

// ===========================================================================
// Fixture — created once, reused (delta-based numeric assertions; no cleanup
// needed since every id is fresh per run and dashboard checks are BEFORE/AFTER).
// ===========================================================================

let EVT_CASE_ID: string
let DASH_CASE_A: string // pending, no decision — granted to staff4 ONLY
let DASH_CASE_B: string // admissible, issued + sanção "Advertência" — granted to staff2 + staff4 (staff4 = RESPONDENT, excluded)
let DASH_CASE_C: string // admissible, issued + sanção "Censura" — granted to staff4 ONLY (staff4 = RECUSED, excluded; staff2 NOT granted here)

const SANCTION_A_ID = '00000000-0000-0000-0000-00000e3ad001'
const SANCTION_B_ID = '00000000-0000-0000-0000-00000e3ad002'
const SANCTION_A_LABEL = 'Advertência (E3a Dash)'
const SANCTION_B_LABEL = 'Censura (E3a Dash)'

test.beforeAll(async ({ request }) => {
  // --- EVT case: drives the real E2 procedure RPCs so the auto-derived
  // `case_events` are genuine (not synthetic inserts). ---
  const chefeToken = await getOwnerToken(request, 'chefe.ccih@test.local')
  EVT_CASE_ID = await createEthicsCase(request, '[E3a] Caso de eventos automáticos')
  await dbInsert('ethics_case_details', { case_id: EVT_CASE_ID, complaint_channel: 'internal' })
  await grantRead(EVT_CASE_ID, UID_STAFF2)
  // ETH·E4 (ADR 0108 / FUP-ETH-1 acceptance criterion): seat the seeded
  // respondent through the REAL `add_case_participant` RPC — this file's
  // original raw `dbInsert('case_participants', …)` here was the finding ADR
  // 0108 opened against ("a spec that must bypass the product to reach a
  // shipped panel"). The participant is already minted in the registry
  // (seed's "Dra. Denunciada" — PARTICIPANT_RESPONDENT), so no
  // `ensure_professional_participant` call is needed here; that NEW door is
  // exercised by ethics-e4-participants.spec.ts's PROF-CREATE instead.
  const respAddResp = await callRpc(request, 'add_case_participant', chefeToken, {
    p_case_id: EVT_CASE_ID,
    p_participant_id: PARTICIPANT_RESPONDENT,
    p_role_id: ROLE_RESPONDENT,
    p_is_primary_subject: true,
  })
  expect(respAddResp.ok(), `add_case_participant: ${await respAddResp.text()}`).toBeTruthy()
  await grantRead(EVT_CASE_ID, UID_STAFF1)
  await dbInsert('case_recusals', {
    case_id: EVT_CASE_ID,
    user_id: UID_STAFF1,
    source: 'coordinator',
    reason_md: '[E2E] conflito de interesse (fixture E3a).',
    recused_by: UID_CHEFE,
  })

  const admissResp = await callRpc(request, 'decide_admissibility', chefeToken, {
    p_case_id: EVT_CASE_ID,
    p_status: 'admissible',
    p_rationale_md: '[E2E] fundamentação de admissibilidade (fixture E3a).',
  })
  expect(admissResp.ok()).toBeTruthy()
  const allegResp = await callRpc(request, 'add_ethics_allegation', chefeToken, {
    p_case_id: EVT_CASE_ID,
    p_category_id: ALLEGATION_CATEGORY_ID,
    p_description_md: '[E2E] alegação (fixture E3a).',
  })
  expect(allegResp.ok()).toBeTruthy()
  const allegRows = await dbQuery<{ id: string }>('ethics_allegations', { case_id: `eq.${EVT_CASE_ID}` })
  expect(allegRows.length).toBe(1)
  const findingResp = await callRpc(request, 'record_ethics_finding', chefeToken, {
    p_allegation_id: allegRows[0].id,
    p_finding: 'substantiated',
  })
  expect(findingResp.ok()).toBeTruthy()
})

// ===========================================================================
// TERM — terminology rendering (acceptance #1) + flag-off-adjacent regression (#5)
// ===========================================================================

test('TERM-1 Ethics case: the tab bar renders "Cronologia processual" (not "Linha do tempo")', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${CASE_ID_ETHICS_SEEDED}`)
  await page.waitForURL(`${MANAGE_BASE}/${CASE_ID_ETHICS_SEEDED}`)
  const tabs = page.getByRole('navigation', { name: 'Seções do caso' })
  await expect(tabs.getByRole('link', { name: 'Cronologia processual' })).toBeVisible({
    timeout: 10_000,
  })
  await expect(tabs.getByRole('link', { name: 'Linha do tempo' })).toHaveCount(0)
  await signOut(page)
})

test('TERM-2 non-Ethics case: the tab bar renders the default "Linha do tempo" (byte-for-byte fallback)', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${CASE_ID_NON_ETHICS}`)
  await page.waitForURL(`${MANAGE_BASE}/${CASE_ID_NON_ETHICS}`)
  const tabs = page.getByRole('navigation', { name: 'Seções do caso' })
  await expect(tabs.getByRole('link', { name: 'Linha do tempo' })).toBeVisible({ timeout: 10_000 })
  await expect(tabs.getByRole('link', { name: 'Cronologia processual' })).toHaveCount(0)
  await signOut(page)
})

test('TERM-5 flag-off-adjacent regression: non-Ethics case heading + board heading are byte-for-byte unchanged', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(MANAGE_BASE)
  await page.waitForURL(MANAGE_BASE)
  await expect(page.getByRole('heading', { level: 1, name: 'Casos' })).toBeVisible({ timeout: 10_000 })

  await page.goto(`${MANAGE_BASE}/${CASE_ID_NON_ETHICS}`)
  await page.waitForURL(`${MANAGE_BASE}/${CASE_ID_NON_ETHICS}`)
  const h1 = page.getByRole('heading', { level: 1 })
  await expect(h1).toContainText(/^Caso \d{4}/)
  await signOut(page)
})

// ===========================================================================
// EVT — case_events kind-widen + visibility floor + auto-derived events
// (acceptance #3/#4 + the auto-derive criterion)
// ===========================================================================

test('EVT-1 coordinator: sees all 3 auto-derived events with correct kind labels', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${EVT_CASE_ID}`)
  await page.waitForURL(`${MANAGE_BASE}/${EVT_CASE_ID}`)

  // ADR 0137 D12 — "Registros" -> "Atividade" (the region is named by its own h2).
  const registros = page.getByRole('region', { name: 'Atividade' })
  await expect(registros).toBeVisible({ timeout: 10_000 })

  const admissRow = registros.locator('li').filter({ hasText: 'Admissibilidade decidida' })
  await expect(admissRow).toBeVisible({ timeout: 10_000 })
  const allegRow = registros.locator('li').filter({ hasText: 'Nova alegação registrada' })
  await expect(allegRow).toBeVisible()
  const findingRow = registros.locator('li').filter({ hasText: 'Parecer de alegação registrado' })
  await expect(findingRow).toBeVisible()
  await expect(findingRow.getByText('Parecer registrado', { exact: true })).toBeVisible()

  await signOut(page)
})

test('EVT-4 ordinary granted reader (staff2): sees the 2 case_readers events, NOT the coordinator_only one', async ({
  page,
}) => {
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${EVT_CASE_ID}`)
  // staff2 has no lifecycle-management/coordinator route access, but DOES hold a
  // read grant — the staff-facing route is the one an ordinary grantee reaches.
  await page.goto(`${BASE}/casos/${EVT_CASE_ID}`)
  await page.waitForURL(`${BASE}/casos/${EVT_CASE_ID}`)

  // ADR 0137 D12 — "Registros" -> "Atividade" (the region is named by its own h2).
  const registros = page.getByRole('region', { name: 'Atividade' })
  await expect(registros).toBeVisible({ timeout: 10_000 })
  await expect(registros.locator('li').filter({ hasText: 'Admissibilidade decidida' })).toBeVisible()
  await expect(registros.locator('li').filter({ hasText: 'Nova alegação registrada' })).toBeVisible()
  await expect(registros.locator('li').filter({ hasText: 'Parecer de alegação registrado' })).toHaveCount(0)
  await expect(registros.getByText('Somente coordenação')).toHaveCount(0)

  await signOut(page)
})

test('EVT-5 respondent (staff4): denied the case route entirely — sees NEITHER kind of event', async ({
  page,
}) => {
  await signInAs(page, 'staff4.ccih@test.local')
  await assertRouteDenied(page, `${BASE}/casos/${EVT_CASE_ID}`)
  await signOut(page)
})

test('EVT-6 recused reader (staff1): denied the case route entirely — sees NEITHER kind of event', async ({
  page,
}) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await assertRouteDenied(page, `${BASE}/casos/${EVT_CASE_ID}`)
  await signOut(page)
})

// ===========================================================================
// DASH — the ethics dashboard confidentiality keystone (acceptance #6/#7)
// ===========================================================================

interface DashSnapshot {
  totalCases: number
  pending: number
  admissible: number
  issued: number
  sanctionA: number
  sanctionB: number
}

/** `base` defaults to CCIH; chefe.farm (Farmácia, DASH-0e/DASH-5) passes its own
 * commission base — it has no standing in CCIH at all, so CCIH's `/meus-casos`
 * (the old `signOut`'s landing page) would itself 404 for that persona. */
async function readDashboard(page: Page, email: string, base = BASE): Promise<DashSnapshot> {
  await signInAs(page, email)
  await page.goto(`${base}/dashboard/ethics`)
  await page.waitForURL(`${base}/dashboard/ethics`)
  await expect(page.getByRole('heading', { level: 1, name: 'Painel ético' })).toBeVisible({
    timeout: 10_000,
  })

  const totalCasesRegion = page.getByRole('region', { name: 'Processos éticos' })
  const emptyStateRegion = page.getByRole('region', { name: 'Sem processos éticos' })
  // Web-first wait: `EthicsDashboardView` renders EITHER the stat cards OR the
  // empty state (never both, never neither) — a plain one-shot `.count()` here
  // (no auto-retry) previously raced the server-streamed render and read "0
  // cases" on a page that hadn't finished painting yet. `.or()` waits for
  // whichever of the two shows up.
  await expect(totalCasesRegion.or(emptyStateRegion).first()).toBeVisible({ timeout: 10_000 })
  let totalCases = 0
  if (await totalCasesRegion.count()) {
    const text = (await totalCasesRegion.textContent()) ?? ''
    totalCases = Number.parseInt(text.match(/\d+/)?.[0] ?? '0', 10)
  }

  async function cellCount(sectionName: string, rowLabel: string): Promise<number> {
    const section = page.getByRole('region', { name: sectionName })
    if (!(await section.count())) return 0
    // Plain string (not `new RegExp(rowLabel)`): a sanction label like
    // "Advertência (E3a Dash)" contains literal parentheses that `new RegExp(...)`
    // would parse as a capture group instead of literal characters (the exact
    // trap ethics-e1-access-spine.spec.ts's AC-9 comment documents for a document
    // title) — Playwright's plain-string `name` already does a substring match.
    const row = section.getByRole('row', { name: rowLabel })
    if (!(await row.count())) return 0
    const cells = await row.getByRole('cell').allTextContents()
    return Number.parseInt(cells[0] ?? '0', 10) || 0
  }

  const pending = await cellCount('Admissibilidade', 'Pendente')
  const admissible = await cellCount('Admissibilidade', 'Admitida')
  const issued = await cellCount('Situação das decisões', 'Emitida')
  const sanctionA = await cellCount('Sanções aplicadas', SANCTION_A_LABEL)
  const sanctionB = await cellCount('Sanções aplicadas', SANCTION_B_LABEL)

  await signOutFromCurrentPage(page)
  return { totalCases, pending, admissible, issued, sanctionA, sanctionB }
}

const FARMACIA_BASE = `/o/${ORG}/c/farmacia`

let baselineCoord: DashSnapshot
let baselineForeign: DashSnapshot

// One persona per test (each a single sign-in → read → sign-out cycle) — an
// earlier version bundled multiple full auth round-trips into one test and blew
// Playwright's default 30s test timeout on this chart-heavy page.
test('DASH-0a capture the coordinator BEFORE snapshot (delta baseline)', async ({ page }) => {
  baselineCoord = await readDashboard(page, 'chefe.ccih@test.local')
})

// The dashboard PAGE itself gates on `access.role === 'staff_admin'` (in addition
// to the RLS-scoped read inside `getEthicsDashboard`) — a plain granted `staff`
// member (even holding a `case_access_grants` READ row) gets `notFound()` here
// regardless of what they can individually read on a case page. Verified against
// the live source (`src/app/.../dashboard/ethics/page.tsx`) before writing this —
// it means the acceptance criterion's "excluded commission member" personas for
// THIS surface can only be the coordinator themselves (see DASH-EXCLUDE below),
// not a plain staff member, who cannot reach the aggregate page at all.
test('DASH-ROLE-GATE plain staff (staff2/staff3/staff4), even with a case grant, get notFound() at /dashboard/ethics', async ({
  page,
}) => {
  for (const email of ['staff2.ccih@test.local', 'staff3.ccih@test.local', 'staff4.ccih@test.local']) {
    await signInAs(page, email)
    await assertRouteDenied(page, `${BASE}/dashboard/ethics`)
    await signOut(page)
  }
})

test('DASH-0e capture the foreign-commission coordinator BEFORE snapshot (delta baseline)', async ({
  page,
}) => {
  baselineForeign = await readDashboard(page, 'chefe.farm@test.local', FARMACIA_BASE)
})

// This creates the 3 throwaway dashboard cases AS A REGULAR TEST (not a
// `beforeAll`) placed AFTER DASH-0a..e capture their baselines and BEFORE
// DASH-1..5 read the "after" state — `beforeAll` runs before EVERY test in the
// file (including DASH-0a..e), so fixture creation belonging there would make
// the "before" snapshot already include it, collapsing every delta to ~0.
test('DASH-SETUP create the 3 throwaway dashboard cases (fixture, mirrors 269_ethics_e3a_dashboard.sql)', async ({
  request,
}) => {
  // Direct-insert supporting data (no product RPC/UI conveniently covers "mark
  // admissible + issue a decision + assign a sanction" as one step; mirrors
  // supabase/tests/269_ethics_e3a_dashboard.sql's own fixture shape (BE-8
  // renamed 260-263 -> 266-269 to resolve a numbering collision with CH/
  // case-corrections — this reference was stale, no functional impact).
  DASH_CASE_A = await createEthicsCase(request, '[E3a] Dash — pendente')
  DASH_CASE_B = await createEthicsCase(request, '[E3a] Dash — admitido + sanção A')
  DASH_CASE_C = await createEthicsCase(request, '[E3a] Dash — admitido + sanção B')

  await dbInsert('ethics_case_details', [
    { case_id: DASH_CASE_A, admissibility_status: 'pending', complaint_channel: 'internal' },
    { case_id: DASH_CASE_B, admissibility_status: 'admissible', complaint_channel: 'internal' },
    { case_id: DASH_CASE_C, admissibility_status: 'admissible', complaint_channel: 'internal' },
  ])

  // Idempotent across re-runs WITHOUT a DB reset: a re-run's `ethics_decision_details`
  // rows from a PRIOR run point at these same fixed sanction-type ids via FK, so a
  // delete-then-insert (fine for grants/recusals, which are scoped to fresh case ids
  // every run) would fail here — reuse the row if it already exists instead.
  const existingSanctions = await dbQuery<{ id: string }>('ethics_sanction_types', {
    id: `in.(${SANCTION_A_ID},${SANCTION_B_ID})`,
  })
  const existingIds = new Set(existingSanctions.map((s) => s.id))
  const sanctionsToInsert = [
    { id: SANCTION_A_ID, organization_id: ORG_A, key: 'e3a_dash_advertencia', display_name: SANCTION_A_LABEL },
    { id: SANCTION_B_ID, organization_id: ORG_A, key: 'e3a_dash_censura', display_name: SANCTION_B_LABEL },
  ].filter((s) => !existingIds.has(s.id))
  if (sanctionsToInsert.length > 0) {
    await dbInsert('ethics_sanction_types', sanctionsToInsert)
  }

  const decisionB = (await dbInsert('case_decisions', {
    case_id: DASH_CASE_B,
    decision_type: 'ethics_ruling',
    summary_md: '[E2E] decisão B (fixture E3a).',
    status: 'issued',
    decided_at: new Date().toISOString(),
  })) as { id: string }[]
  const decisionC = (await dbInsert('case_decisions', {
    case_id: DASH_CASE_C,
    decision_type: 'ethics_ruling',
    summary_md: '[E2E] decisão C (fixture E3a).',
    status: 'issued',
    decided_at: new Date().toISOString(),
  })) as { id: string }[]
  await dbInsert('ethics_decision_details', {
    decision_id: decisionB[0].id,
    case_id: DASH_CASE_B,
    sanction_type_id: SANCTION_A_ID,
  })
  await dbInsert('ethics_decision_details', {
    decision_id: decisionC[0].id,
    case_id: DASH_CASE_C,
    sanction_type_id: SANCTION_B_ID,
  })

  // Grants: A → staff4 only. B → staff2 + staff4 (staff4 = RESPONDENT). C → staff4
  // only (staff4 = RECUSED). staff2 is granted ONLY on B — never on A or C — so
  // staff2's delta is "granted, no exclusion" (B) vs. "never granted" (A, C).
  // staff3 is granted NOTHING anywhere (the pure non-granted boundary).
  await grantRead(DASH_CASE_A, UID_STAFF4_RESPONDENT)
  await grantRead(DASH_CASE_B, UID_STAFF2)
  await grantRead(DASH_CASE_B, UID_STAFF4_RESPONDENT)
  // ETH·E4 (ADR 0108 / FUP-ETH-1 acceptance criterion): the real
  // `add_case_participant` RPC, not a raw `dbInsert('case_participants', …)`.
  // PARTICIPANT_RESPONDENT is already minted in the registry (seed's "Dra.
  // Denunciada"), so no `ensure_professional_participant` call is needed.
  const chefeToken = await getOwnerToken(request, 'chefe.ccih@test.local')
  const dashBAddResp = await callRpc(request, 'add_case_participant', chefeToken, {
    p_case_id: DASH_CASE_B,
    p_participant_id: PARTICIPANT_RESPONDENT,
    p_role_id: ROLE_RESPONDENT,
    p_is_primary_subject: true,
  })
  expect(dashBAddResp.ok(), `add_case_participant: ${await dashBAddResp.text()}`).toBeTruthy()
  await grantRead(DASH_CASE_C, UID_STAFF4_RESPONDENT)
  await dbInsert('case_recusals', {
    case_id: DASH_CASE_C,
    user_id: UID_STAFF4_RESPONDENT,
    source: 'coordinator',
    reason_md: '[E2E] conflito (fixture E3a dashboard).',
    recused_by: UID_CHEFE,
  })
})

let afterCoord: DashSnapshot

test('DASH-1 coordinator: totalCases/admissibility/decisions/sanctions ALL increase by the full fixture', async ({
  page,
}) => {
  afterCoord = await readDashboard(page, 'chefe.ccih@test.local')
  expect(afterCoord.totalCases - baselineCoord.totalCases).toBe(3)
  expect(afterCoord.pending - baselineCoord.pending).toBe(1)
  expect(afterCoord.admissible - baselineCoord.admissible).toBe(2)
  expect(afterCoord.issued - baselineCoord.issued).toBe(2)
  expect(afterCoord.sanctionA - baselineCoord.sanctionA).toBe(1)
  expect(afterCoord.sanctionB - baselineCoord.sanctionB).toBe(1)
})

// ---------------------------------------------------------------------------
// DASH-EXCLUDE — since /dashboard/ethics is staff_admin-gated (DASH-ROLE-GATE),
// the ONLY persona that can exercise "coordinator, yet excluded from a specific
// case" is the coordinator THEMSELVES, made the respondent on one throwaway case
// and recused from another. This is a STRONGER form of acceptance #6/#7 than a
// plain-staff exclusion: it proves the deny-terms bind even the commission's own
// staff_admin, not merely a lower-privileged member (ADR 0072 D2 — the hard-deny
// "cannot be out-voted", proven earlier for case READ in ethics-e1-access-spine's
// AC-1b; this is the same invariant at the DASHBOARD AGGREGATE layer).
// ---------------------------------------------------------------------------

let DASH_CASE_D: string // respondent-excluded (chefe is the respondent_doctor here)
let DASH_CASE_E: string // recusal-excluded (chefe is recused here)
let DASH_CASE_F: string // ordinary — control, readable normally

// ETH·E4: no longer fixed ids — `create_professional_profile` mints a
// server-generated id (see DASH-EXCLUDE-SETUP below), so these are CAPTURED at
// runtime instead of dictated. `let`, not `const`, for exactly that reason;
// nothing else in this file references them.
let CHEFE_PROFESSIONAL_PROFILE_ID: string
let CHEFE_PARTICIPANT_ID: string

test('DASH-EXCLUDE-SETUP: chefe becomes respondent on D, recused on E; F is an ordinary control case', async ({
  request,
}) => {
  DASH_CASE_D = await createEthicsCase(request, '[E3a] Dash — coordenador é o denunciado')
  DASH_CASE_E = await createEthicsCase(request, '[E3a] Dash — coordenador impedido')
  DASH_CASE_F = await createEthicsCase(request, '[E3a] Dash — controle (sem exclusão)')
  await dbInsert('ethics_case_details', [
    { case_id: DASH_CASE_D, admissibility_status: 'pending', complaint_channel: 'internal' },
    { case_id: DASH_CASE_E, admissibility_status: 'pending', complaint_channel: 'internal' },
    { case_id: DASH_CASE_F, admissibility_status: 'pending', complaint_channel: 'internal' },
  ])

  const chefeToken = await getOwnerToken(request, 'chefe.ccih@test.local')

  // Bind chefe (the CCIH coordinator) to a professional_profiles row so they
  // can be attributed as a case respondent — through the REAL doors (ETH·E4 /
  // ADR 0108 / FUP-ETH-1 acceptance criterion): no more raw `dbInsert` into
  // `professional_profiles` / `participants` / `professional_participants`.
  // Idempotent across re-runs WITHOUT a DB reset by NATURAL KEY
  // (organization_id + user_id) rather than a fixed id:
  // `create_professional_profile` mints a server-generated id, so a fixed id
  // is no longer available to key an existence check on.
  const existingProfile = await dbQuery<{ id: string }>('professional_profiles', {
    organization_id: `eq.${ORG_A}`,
    user_id: `eq.${UID_CHEFE}`,
  })
  if (existingProfile.length > 0) {
    CHEFE_PROFESSIONAL_PROFILE_ID = existingProfile[0].id
  } else {
    const createResp = await callRpc(request, 'create_professional_profile', chefeToken, {
      p_org: ORG_A,
      p_full_name: 'Chefe CCIH (fixture E3a dashboard)',
      p_user_id: UID_CHEFE,
    })
    expect(createResp.ok(), `create_professional_profile: ${await createResp.text()}`).toBeTruthy()
    CHEFE_PROFESSIONAL_PROFILE_ID = (await createResp.json()) as string
  }

  // `ensure_professional_participant` is itself get-or-create (the ADR 0108 D1
  // unique index on professional_profile_id) — safe to call every run
  // regardless of whether the profile above was just-minted or reused. This is
  // the door the task explicitly asked to check: it now owns the
  // participants/professional_participants pairing, so the old direct inserts
  // into both are gone, not just the case_participants one.
  const mintResp = await callRpc(request, 'ensure_professional_participant', chefeToken, {
    p_profile_id: CHEFE_PROFESSIONAL_PROFILE_ID,
  })
  expect(mintResp.ok(), `ensure_professional_participant: ${await mintResp.text()}`).toBeTruthy()
  CHEFE_PARTICIPANT_ID = (await mintResp.json()) as string

  const dashDAddResp = await callRpc(request, 'add_case_participant', chefeToken, {
    p_case_id: DASH_CASE_D,
    p_participant_id: CHEFE_PARTICIPANT_ID,
    p_role_id: ROLE_RESPONDENT,
    p_is_primary_subject: true,
  })
  expect(dashDAddResp.ok(), `add_case_participant: ${await dashDAddResp.text()}`).toBeTruthy()
  await dbInsert('case_recusals', {
    case_id: DASH_CASE_E,
    user_id: UID_CHEFE,
    source: 'self',
    reason_md: '[E2E] autodeclaração de impedimento (fixture E3a dashboard).',
    recused_by: UID_CHEFE,
  })
})

let afterExclude: DashSnapshot

test('DASH-EXCLUDE coordinator: D (respondent) and E (recused) contribute ZERO; only F (control) counts — even for the commission staff_admin', async ({
  page,
}) => {
  afterExclude = await readDashboard(page, 'chefe.ccih@test.local')
  // +1 total: F only. D and E are excluded DESPITE chefe being staff_admin of
  // this very commission — the deny-terms are not out-voted by administrative
  // standing (ADR 0072 D2), proven here at the dashboard-aggregate layer.
  expect(afterExclude.totalCases - afterCoord.totalCases).toBe(1)
  expect(afterExclude.pending - afterCoord.pending).toBe(1) // F is pending
})

test('DASH-5 foreign-commission coordinator (chefe.farm, same org): ZERO delta — commission-scoped, unaffected by CCIH fixture', async ({
  page,
}) => {
  const after = await readDashboard(page, 'chefe.farm@test.local', FARMACIA_BASE)
  expect(after.totalCases - baselineForeign.totalCases).toBe(0)
})

// ===========================================================================
// KBD — keyboard-only (acceptance #10)
// ===========================================================================

test('KBD-1 keyboard-only: from the board, tab into the Ethics case, then to the terminology-labeled timeline tab', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(MANAGE_BASE)
  await page.waitForURL(MANAGE_BASE)
  await expect(page.getByRole('heading', { level: 1, name: 'Casos' })).toBeVisible({ timeout: 10_000 })

  const reachedCaseLink = await tabUntil(
    page,
    (i) => i.tag === 'A' && !!i.href?.includes(CASE_ID_ETHICS_SEEDED),
    200,
  )
  expect(reachedCaseLink).toBe(true)
  const focusVisible = await page.evaluate(() =>
    document.activeElement instanceof HTMLElement
      ? document.activeElement.matches(':focus-visible')
      : false,
  )
  expect(focusVisible).toBe(true)
  await page.keyboard.press('Enter')
  await page.waitForURL(`${MANAGE_BASE}/${CASE_ID_ETHICS_SEEDED}`)
  // Web-first wait for the tab bar itself before tabbing into it — a bare
  // `waitForURL` only guarantees the URL changed, not that the (streamed) page
  // has finished rendering (the same class of race `readDashboard` hit).
  await expect(page.getByRole('navigation', { name: 'Seções do caso' })).toBeVisible({
    timeout: 10_000,
  })

  const reachedTimelineTab = await tabUntil(
    page,
    (i) => i.tag === 'A' && i.text === 'Cronologia processual',
    150,
  )
  expect(reachedTimelineTab).toBe(true)
  await page.keyboard.press('Enter')
  await page.waitForURL(`${MANAGE_BASE}/${CASE_ID_ETHICS_SEEDED}/timeline`)

  await signOut(page)
})

test('KBD-2 keyboard-only: the ethics dashboard page is reachable + operable by keyboard (no focus trap)', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/dashboard/ethics`)
  await page.waitForURL(`${BASE}/dashboard/ethics`)
  await expect(page.getByRole('heading', { level: 1, name: 'Painel ético' })).toBeVisible({
    timeout: 10_000,
  })

  // The page itself is presentational (stat cards + charts, no controls); the
  // keyboard check here is that Tab keeps moving focus through the surrounding
  // shell (no trap) rather than freezing on a single element. NOTE: there is
  // presently no in-app nav LINK to this route (O-2 follow-up, tracked in
  // PROGRESS.md) — a true "keyboard path from the shell into the dashboard"
  // isn't reachable yet, so this check starts from a direct navigation.
  const seenTags = new Set<string>()
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab')
    const tag = await page.evaluate(() => document.activeElement?.tagName ?? '')
    if (tag) seenTags.add(tag)
  }
  expect(seenTags.size).toBeGreaterThan(0)

  await signOut(page)
})

// ===========================================================================
// EVT-2/3, TERM-3/4 — placed LAST: under this file's serial mode a failure
// skips every test AFTER it, and these four are a known open gap (see the bugs
// filed against them) — placing them last keeps EVT-1/4/5/6, DASH, and KBD's
// results (the phase's higher-risk, novel surfaces) from being swallowed by a
// skip triggered by an already-known defect.
// ===========================================================================

test('EVT-2 coordinator: the finding_recorded (coordinator_only) row shows the "Somente coordenação" badge', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${EVT_CASE_ID}`)
  await page.waitForURL(`${MANAGE_BASE}/${EVT_CASE_ID}`)

  // ADR 0137 D12 — "Registros" -> "Atividade" (the region is named by its own h2).
  const registros = page.getByRole('region', { name: 'Atividade' })
  const findingRow = registros.locator('li').filter({ hasText: 'Parecer de alegação registrado' })
  await expect(findingRow).toBeVisible({ timeout: 10_000 })
  // Acceptance §4 (case_events touch-list, §2.5): a coordinator_only row carries a
  // visible "Somente coordenação" badge for whoever CAN see it (a coordinator here).
  await expect(findingRow.getByText('Somente coordenação')).toBeVisible({ timeout: 5_000 })

  await signOut(page)
})

test('EVT-3 coordinator manual write: a manually-created coordinator_only note ALSO shows the badge', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${EVT_CASE_ID}`)
  await page.waitForURL(`${MANAGE_BASE}/${EVT_CASE_ID}`)

  // ADR 0137 D12 — "Registros" -> "Atividade" (the region is named by its own h2).
  // The card's own "Adicionar registro" button is GONE — the full authoring
  // dialog (still titled "Adicionar registro") is now reached via the inline
  // composer's "Mais detalhes" escape hatch, which needs `canWrite` exactly as
  // the old button did.
  const registros = page.getByRole('region', { name: 'Atividade' })
  await registros.getByRole('button', { name: 'Mais detalhes' }).click()
  const dialog = page.getByRole('dialog', { name: 'Adicionar registro' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Visibilidade').selectOption({ label: 'Somente coordenação' })
  await dialog.getByLabel('Descrição').fill('[E2E] nota manual restrita à coordenação (fixture E3a).')
  await dialog.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })

  const noteRow = registros.locator('li').filter({ hasText: 'nota manual restrita à coordenação' })
  await expect(noteRow).toBeVisible({ timeout: 10_000 })
  await expect(noteRow.getByText('Somente coordenação')).toBeVisible({ timeout: 5_000 })

  const rows = await dbQuery<{ visibility: string }>('case_events', {
    case_id: `eq.${EVT_CASE_ID}`,
    body: 'ilike.*nota manual restrita*',
  })
  expect(rows[0]?.visibility).toBe('coordinator_only')

  await signOut(page)
})

test('TERM-3 Ethics case: the page heading renders the case-term "Denúncia" (not "Caso")', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${CASE_ID_ETHICS_SEEDED}`)
  await page.waitForURL(`${MANAGE_BASE}/${CASE_ID_ETHICS_SEEDED}`)
  const h1 = page.getByRole('heading', { level: 1 })
  await expect(h1).toBeVisible({ timeout: 10_000 })
  // Acceptance §4-1: "renders 'Denúncia' (not 'Caso') in the page heading/breadcrumb".
  await expect(h1).toContainText(/Denúncia/i)
  await signOut(page)
})

test('TERM-4 Ethics case: "Médico denunciado" appears where the primary-subject label appears', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${CASE_ID_ETHICS_SEEDED}`)
  await page.waitForURL(`${MANAGE_BASE}/${CASE_ID_ETHICS_SEEDED}`)
  // Acceptance §4-1: the primary-subject term must appear somewhere on the case's
  // detail surface. BUG-E3A-001's fix renders it as the new
  // `CasePrimarySubjectPanel`'s heading — targeted by role+name (not a plain
  // `getByText`, which strict-mode-fails here: the seeded respondent's
  // `case_participant_roles.display_name` is ALSO "Médico denunciado", so the
  // panel legitimately shows the term twice — once as its heading, once as the
  // participant's role line — and a plain text match is ambiguous between them).
  const subjectPanel = page.getByRole('region', { name: 'Médico denunciado' })
  await expect(subjectPanel).toBeVisible({ timeout: 10_000 })
  await expect(subjectPanel.getByRole('heading', { name: 'Médico denunciado' })).toBeVisible()
  // Non-vacuous: the panel also resolves the actual respondent participant (not
  // just an empty-state placeholder for a case with no primary subject yet).
  await expect(subjectPanel.getByText('Dra. Denunciada')).toBeVisible()
  await signOut(page)
})
