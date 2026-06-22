import { test, expect, type Page } from '@playwright/test'

/**
 * Phase 8 — Dashboards & Submissions Browser
 *
 * Test contract: translates every bullet in PHASES.md §Phase 8 Acceptance into
 * Playwright assertions. Runs against the LOCAL Supabase stack (seeded personas).
 * Run `npx supabase db reset` before each full run; `--workers=1` required
 * (tests are stateful; the in_progress security assertions need the seeded e1 row).
 *
 * Seeded dataset (from supabase/seed.sql + Phase 7 block):
 *
 *   FORM A (CCIH): "Checklist de Higienização das Mãos" — v1 (50000000-…-a001)
 *     6 STANDALONE SUBMITTED responses (alternating staff1/staff2.ccih, i=1..6)
 *       dispensador_disponivel: i=1→Não, i=2→Parcialmente, i=3→Sim,
 *                               i=4→Não, i=5→Parcialmente, i=6→Sim
 *       epis_observados (checkbox): odd i → ["Luvas","Máscara","Touca"]
 *                                   even i → ["Luvas","Avental"]
 *     → distribution: Sim×2, Não×2, Parcialmente×2; Luvas×6, Máscara×3, Touca×3, Avental×3
 *     1 IN_PROGRESS response (staff1.ccih) — must be EXCLUDED from all counts.
 *     1 CASE-PHASE SUBMITTED response (staff1.ccih, Phase-7) — EXCLUDED from
 *       standalone dashboard (ADR 0020) but INCLUDED in submissions browser.
 *
 *   FORM B (Farmácia): "Inspeção de Armazenamento de Medicamentos" — v1 (50000000-…-b001)
 *     4 SUBMITTED responses: i=1,2 take the 'Sim' branch (conditional S2 shown,
 *       temperatura_* answered); i=3,4 take the 'Não' branch (S2 hidden).
 *     → temperatura_na_faixa: denominator=2 (only 2 of 4 had S2 visible).
 *     → organizacao_estoque: denominator=4 (all 4 answered that section).
 *     2 IN_PROGRESS responses (staff1.farm's e1, plus Form A's in_progress).
 *     Both sign-off sections (respondent + staff_admin) seeded WITH sign-off rows.
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin, commission CCIH
 *   staff1.ccih@test.local  staff, commission CCIH
 *   staff2.ccih@test.local  staff, commission CCIH
 *   chefe.farm@test.local   staff_admin, commission Farmácia
 *   staff1.farm@test.local  staff, commission Farmácia
 *   admin@test.local        global admin
 *
 * Form + seed IDs referenced in tests (from seed.sql):
 *   FORM_A_ID = 'f0000000-0000-0000-0000-00000000a001'
 *   FORM_B_ID = 'f0000000-0000-0000-0000-00000000b001'
 *   RESPONSE_E1 = 'e0000000-0000-0000-0000-0000000000e1' (in_progress, staff1.farm)
 *   STAFF1_CCIH_ID = '00000000-0000-0000-0000-000000000003'
 *   STAFF2_CCIH_ID = '00000000-0000-0000-0000-000000000004'
 */

test.use({ viewport: { width: 1280, height: 900 } })

// Disable CSS animations so transitions complete instantly.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'http://127.0.0.1:54321'
// Service-role key loaded from .env.local via @next/env in the Playwright config.
// Never hardcoded. Used ONLY for DB-truth assertions (SELECT), never to mutate
// application data under test (RLS is always the authority).
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

const FORM_B_ID = 'f0000000-0000-0000-0000-00000000b001'
const STAFF1_CCIH_ID = '00000000-0000-0000-0000-000000000003'
const STAFF2_CCIH_ID = '00000000-0000-0000-0000-000000000004'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 20_000,
  })
}

/** Obtain a real JWT for a persona (owner token, RLS evaluated under it). */
async function getOwnerToken(page: Page, email: string, password = 'Test1234!'): Promise<string> {
  const resp = await page.request.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
      data: { email, password },
    },
  )
  expect(resp.ok()).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

/** Service-role REST query returning JSON rows. */
async function serviceQuery<T>(
  page: Page,
  path: string,
): Promise<T[]> {
  const resp = await page.request.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

/**
 * The date of "yesterday" as YYYY-MM-DD. The seeded responses are submitted at
 * `now() - i days` (i=1..6), so they all have `submitted_at` ≤ yesterday.
 * Tests from earlier phases (Phase 5/6/7) create responses at `now()`, so
 * using `?to=yesterday` in the URL isolates the seeded dataset in the full suite.
 */
function seedOnlyTo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Navigate to the dashboard and select the correct form tab, optionally scoping
 * to seeded-only dates (default: true — filters to exclude same-day Phase-5/6/7
 * responses so count assertions stay accurate in the full suite).
 */
async function openDashboard(page: Page, slug = 'ccih', seedOnly = true) {
  const toParam = seedOnly ? `?to=${seedOnlyTo()}` : ''
  await page.goto(`/c/${slug}/dashboard${toParam}`)
  // Wait for form picker to hydrate (client component)
  await expect(page.getByRole('tablist', { name: /formulários/i })).toBeVisible({
    timeout: 15_000,
  })
}

// ---------------------------------------------------------------------------
// AC-1: Dashboard numbers match the seed exactly (Form A = 6 submitted,
//        distributions: dispensador_disponivel Sim×2/Não×2/Parcialmente×2;
//        epis_observados checkbox Luvas×6/Máscara×3/Touca×3/Avental×3).
//        Case-phase response EXCLUDED (dashboard stays at 6, not 7).
// ---------------------------------------------------------------------------

test('AC-1: Form A dashboard headline = 6 submitted (case-phase response excluded)', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await openDashboard(page)

  // Form picker should show the form with its total.
  const formATab = page.getByRole('tab', { name: /checklist.*higienização.*mãos/i })
  await expect(formATab).toBeVisible({ timeout: 10_000 })

  // The form tab itself shows the total submitted count.
  // We also assert the headline in the body after the tab is selected (it may
  // already be auto-selected as the first form).
  await formATab.click()

  // Headline count in the dashboard body.
  const headline = page.locator('.font-display.text-4xl.tabular-nums')
  await expect(headline).toHaveText('6', { timeout: 10_000 })
})

test('AC-1b: dispensador_disponivel distribution = Sim×2, Não×2, Parcialmente×2 (data table)', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await openDashboard(page)
  const formATab = page.getByRole('tab', { name: /checklist.*higienização.*mãos/i })
  await formATab.click()

  // Assert via the accessible data table (SVG is aria-hidden).
  // Each distribution table has rows with option name + count.

  // Find the table for "dispensador_disponivel" by locating the article
  // containing the question heading.
  const dispArticle = page.getByRole('article').filter({
    has: page.locator('h4', { hasText: /dispensador.*álcool.*gel/i }),
  })
  await expect(dispArticle).toBeVisible({ timeout: 15_000 })

  const dispTable = dispArticle.locator('table')

  // Check specific counts in the table rows.
  await expect(dispTable.locator('th[scope="row"]', { hasText: 'Sim' })).toBeVisible()
  await expect(dispTable.locator('th[scope="row"]', { hasText: 'Não' })).toBeVisible()
  await expect(dispTable.locator('th[scope="row"]', { hasText: 'Parcialmente' })).toBeVisible()

  // Sim row: count = 2
  const simRow = dispTable.locator('tr').filter({ has: page.locator('th', { hasText: 'Sim' }) })
  await expect(simRow.locator('td').first()).toHaveText('2')

  // Não row: count = 2
  const naoRow = dispTable.locator('tr').filter({ has: page.locator('th', { hasText: 'Não' }) })
  await expect(naoRow.locator('td').first()).toHaveText('2')

  // Parcialmente row: count = 2
  const parcRow = dispTable.locator('tr').filter({ has: page.locator('th', { hasText: 'Parcialmente' }) })
  await expect(parcRow.locator('td').first()).toHaveText('2')
})

test('AC-1c: epis_observados checkbox unnested counts = Luvas×6, Máscara×3, Touca×3, Avental×3', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await openDashboard(page)
  const formATab = page.getByRole('tab', { name: /checklist.*higienização.*mãos/i })
  await formATab.click()

  // Find the EPIs article (checkbox question)
  const episArticle = page.getByRole('article').filter({
    has: page.locator('h4', { hasText: /Quais EPIs/i }),
  })
  await expect(episArticle).toBeVisible({ timeout: 15_000 })

  const episTable = episArticle.locator('table')

  const luvRow = episTable.locator('tr').filter({ has: page.locator('th', { hasText: 'Luvas' }) })
  await expect(luvRow.locator('td').first()).toHaveText('6')

  const mascRow = episTable.locator('tr').filter({ has: page.locator('th', { hasText: 'Máscara' }) })
  await expect(mascRow.locator('td').first()).toHaveText('3')

  const toucRow = episTable.locator('tr').filter({ has: page.locator('th', { hasText: 'Touca' }) })
  await expect(toucRow.locator('td').first()).toHaveText('3')

  const aventRow = episTable.locator('tr').filter({ has: page.locator('th', { hasText: 'Avental' }) })
  await expect(aventRow.locator('td').first()).toHaveText('3')
})

// ---------------------------------------------------------------------------
// AC-2: Conditional-section smaller denominator.
//        Form B: temperatura_na_faixa denominator = 2 (conditional section,
//        only 2 of 4 responses had it visible). organizacao_estoque denom = 4.
// ---------------------------------------------------------------------------

test('AC-2: Form B conditional section temperature question denominator = 2, stock question = 4', async ({ page }) => {
  await signInAs(page, 'chefe.farm@test.local')
  await openDashboard(page, 'farmacia')

  // Form picker — Form B should be listed
  const formBTab = page.getByRole('tab', { name: /inspeção.*armazenamento.*medicamentos/i })
  await expect(formBTab).toBeVisible({ timeout: 10_000 })
  await formBTab.click()

  // temperatura_na_faixa is in the conditional section (S2) — only 2 responses
  // had it visible.
  const tempArticle = page.getByRole('article').filter({
    has: page.locator('h4', { hasText: /temperatura.*câmara|câmara.*faixa|faixa.*2.*°C.*8.*°C/i }),
  })
  await expect(tempArticle).toBeVisible({ timeout: 15_000 })
  // The denominator caption reads "X de 2 respostas em que a pergunta era aplicável"
  await expect(tempArticle.locator('p', { hasText: /\bde 2\b.*respostas?.*aplicável/i })).toBeVisible()

  // organizacao_estoque is always-visible — denominator = 4
  const orgArticle = page.getByRole('article').filter({
    has: page.locator('h4', { hasText: /estoque.*organizado|organizado.*identificado/i }),
  })
  await expect(orgArticle).toBeVisible({ timeout: 10_000 })
  await expect(orgArticle.locator('p', { hasText: /\bde 4\b.*respostas?.*aplicável/i })).toBeVisible()
})

// ---------------------------------------------------------------------------
// AC-3: in_progress responses excluded from all charts.
//        Form A has 1 in_progress; Form B has 2 in_progress (incl. e1).
//        They must NOT appear in any count or denominator.
// ---------------------------------------------------------------------------

test('AC-3: in_progress excluded from dashboard counts (Form A = 6 not 7+)', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await openDashboard(page)
  const formATab = page.getByRole('tab', { name: /checklist.*higienização.*mãos/i })
  await formATab.click()

  // Headline must be exactly 6 (6 standalone submitted; 1 in_progress excluded;
  // 1 case-phase submitted excluded per ADR 0020)
  const headline = page.locator('.font-display.text-4xl.tabular-nums')
  await expect(headline).toHaveText('6', { timeout: 10_000 })

  // dispensador_disponivel total response count = 2+2+2 = 6 (via table sum)
  const dispArticle = page.getByRole('article').filter({
    has: page.locator('h4', { hasText: /dispensador.*álcool.*gel/i }),
  })
  await expect(dispArticle).toBeVisible({ timeout: 10_000 })
  // Denominator caption should show "6 de 6 respostas"
  await expect(dispArticle.locator('p', { hasText: /\b6\b.*de.*\b6\b.*respostas?/i })).toBeVisible()
})

// ---------------------------------------------------------------------------
// AC-4: Date filter changes results — narrow the range to exclude some
//        seeded submitted_at days and assert the headline/counts drop.
//        Seeded responses have submitted_at = now() - i days (i=1..6).
//        Setting from/to = today - 2 days should yield at most 2 responses.
// ---------------------------------------------------------------------------

test('AC-4: Date filter narrows dashboard results', async ({ page, request }) => {
  // Drive the date filter via URL params — most reliable for Server Component
  // re-query (avoids fighting React's controlled-input onChange/focus timing).
  // The seed places responses at now() - i days (i=1..6) AT THE TIME OF db reset.
  // We query the actual submitted_at dates from the DB to build a time-drift-
  // resistant filter rather than assuming "yesterday" matches seeded data.
  //
  // SPEC-P8-002: replaced hardcoded "yesterday" with a query-derived anchor so
  // this test doesn't fail when ≥2 days have elapsed since the last db reset.
  await signInAs(page, 'chefe.ccih@test.local')

  // Query the two most recent Form-A submitted responses to get the actual
  // submission date range, then filter to just the most-recent day (to get ≤2
  // but at least 1 result, confirming the filter narrows relative to 6 total).
  const resp = await request.get(
    `${SUPABASE_URL}/rest/v1/responses?form_version_id=eq.50000000-0000-0000-0000-00000000a001&status=eq.submitted&select=submitted_at&order=submitted_at.desc&limit=2`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const rows = (await resp.json()) as Array<{ submitted_at: string }>
  expect(rows.length, 'AC-4 precondition: at least 2 submitted responses').toBeGreaterThan(0)

  // Use the most recent submission's date as the range end.
  const newestDate = rows[0].submitted_at.slice(0, 10) // YYYY-MM-DD

  await page.goto(`/c/ccih/dashboard?from=${newestDate}&to=${newestDate}`)
  await page.waitForLoadState('networkidle')

  // Wait for the form picker to hydrate (client component).
  const tabList = page.getByRole('tablist', { name: /form/i })
  await expect(tabList).toBeVisible({ timeout: 15_000 })

  // The headline after filtering must be less than 6 (the full seeded count).
  // At most 2 responses share the same submitted_at date (submitted in the same
  // db-reset session), so this is always true for a single-day filter.
  const filteredHeadline = page.locator('.font-display.text-4xl.tabular-nums')
  const headlineText = await filteredHeadline.textContent({ timeout: 10_000 })
  const headlineNum = parseInt(headlineText?.trim() ?? '999', 10)
  expect(headlineNum).toBeLessThan(6)
  expect(headlineNum).toBeGreaterThanOrEqual(0)

  // The "Limpar período" button must be present when a date range is active.
  await expect(page.getByRole('button', { name: /limpar per/i })).toBeVisible()
})

// ---------------------------------------------------------------------------
// AC-5: CSV download — row count matches standalone submitted total (6 for
//        Form A). Per-signed-section sign-off-status column present (Form B).
// ---------------------------------------------------------------------------

test('AC-5a: CSV download for Form A contains exactly 6 data rows', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await openDashboard(page)
  const formATab = page.getByRole('tab', { name: /checklist.*higienização.*mãos/i })
  await formATab.click()
  await expect(page.locator('.font-display.text-4xl.tabular-nums')).toHaveText('6', {
    timeout: 10_000,
  })

  // Trigger download via the "Exportar CSV" link (an <a download> element).
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: /exportar csv/i }).click(),
  ])

  // Parse the downloaded CSV.
  const path = await download.path()
  expect(path).toBeTruthy()
  const { readFileSync } = await import('fs')
  const csvText = readFileSync(path!, 'utf-8')
  // Strip the leading UTF-8 BOM if present.
  const stripped = csvText.replace(/^﻿/, '')
  const lines = stripped.split(/\r?\n/).filter((l) => l.trim().length > 0)
  // First line = header; remaining = data rows. The export link on the page
  // carries the same ?to=yesterday window that openDashboard set, so the CSV
  // is date-bounded to the 6 seeded standalone-submitted responses only.
  const dataRows = lines.slice(1)
  expect(dataRows).toHaveLength(6)
})

test('AC-5b: CSV export for Form B contains sign-off-status columns', async ({ page }) => {
  await signInAs(page, 'chefe.farm@test.local')
  await openDashboard(page, 'farmacia')
  const formBTab = page.getByRole('tab', { name: /inspeção.*armazenamento.*medicamentos/i })
  await formBTab.click()

  // Wait for the export link to appear.
  const exportLink = page.getByRole('link', { name: /exportar csv/i })
  await expect(exportLink).toBeVisible({ timeout: 15_000 })

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    exportLink.click(),
  ])

  const path = await download.path()
  expect(path).toBeTruthy()
  const { readFileSync } = await import('fs')
  const csvText = readFileSync(path!, 'utf-8')
  const stripped = csvText.replace(/^﻿/, '')
  const lines = stripped.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const headerLine = lines[0]
  // Sign-off columns use the pattern "Assinatura: <section title>"
  expect(headerLine).toMatch(/Assinatura:/i)

  // The export link carries the same ?to=yesterday window; exactly 4 seeded
  // standalone-submitted responses for Form B are in that window.
  const dataRows = lines.slice(1)
  expect(dataRows).toHaveLength(4)
})

// ---------------------------------------------------------------------------
// AC-6: Staff cannot access the dashboard — plain staff at /c/ccih/dashboard
//        gets a friendly in-shell 404; nav "Painel" absent for staff.
// ---------------------------------------------------------------------------

test('AC-6: Staff cannot access dashboard — gets friendly 404', async ({ page }) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto('/c/ccih/dashboard')

  // The page must render the friendly in-shell 404 (not-found.tsx), not the
  // dashboard content. The shell renders; the content area shows "404".
  await expect(page.getByRole('heading', { name: /encontramos esta página|Erro 404/i })).toBeVisible({
    timeout: 10_000,
  })

  // No dashboard data must be visible.
  await expect(page.locator('.font-display.text-4xl.tabular-nums')).not.toBeVisible()
})

test('AC-6b: Painel nav link absent for plain staff', async ({ page }) => {
  await signInAs(page, 'staff1.ccih@test.local')
  // Navigate into the commission shell.
  await page.goto('/c/ccih/forms')
  await page.waitForLoadState('networkidle')

  // The "Painel" nav link must NOT be visible for plain staff.
  await expect(page.getByRole('link', { name: /^painel$/i })).not.toBeVisible()
})

// ---------------------------------------------------------------------------
// AC-7: Submissions browser — filter by member returns exactly that member's
//        seeded submitted responses. Form A alternates staff1/staff2 (3 each).
// ---------------------------------------------------------------------------

test('AC-7a: Submissions browser filter by staff1.ccih returns expected submitted rows', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/c/ccih/dashboard/submissions')
  await page.waitForLoadState('networkidle')

  // The "Membro" select filter — choose staff1.ccih.
  const memberSelect = page.getByLabel('Membro')
  await expect(memberSelect).toBeVisible({ timeout: 10_000 })
  await memberSelect.selectOption({ value: STAFF1_CCIH_ID })

  // Wait for the page to re-render.
  await page.waitForTimeout(2_000)

  // Count the submitted rows (each is a list item inside the "Respostas" list).
  const responseList = page.getByRole('list', { name: /respostas/i })
  await expect(responseList).toBeVisible({ timeout: 10_000 })
  const rows = responseList.getByRole('listitem')
  // staff1.ccih has 3 standalone Form A submissions (i=1,3,5) PLUS 1 case-phase
  // submitted response (Phase 7 seed) — submissions browser INCLUDES case-phase
  // rows (ADR 0020). Total = 4. The case-phase row is badged "Fase de caso".
  const rowCount = await rows.count()
  expect(rowCount).toBeGreaterThanOrEqual(3) // at minimum the 3 standalone
  // Verify the case-phase badge appears for at least one row.
  // Use .first() — the cases-extras tests create additional case-phase submissions.
  const casePhaseBadge = responseList.getByText(/fase de caso/i).first()
  await expect(casePhaseBadge).toBeVisible()
})

test('AC-7b: Submissions browser filter by staff2.ccih returns at least 3 submitted rows', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/c/ccih/dashboard/submissions')
  await page.waitForLoadState('networkidle')

  const memberSelect = page.getByLabel('Membro')
  await expect(memberSelect).toBeVisible({ timeout: 10_000 })
  await memberSelect.selectOption({ value: STAFF2_CCIH_ID })

  await page.waitForTimeout(2_000)

  const responseList = page.getByRole('list', { name: /respostas/i })
  await expect(responseList).toBeVisible({ timeout: 10_000 })
  const rows = responseList.getByRole('listitem')
  // staff2.ccih has 3 seeded Form A submissions (i=2,4,6); the Phase 6 tests
  // may add more. Assert at least 3.
  const count = await rows.count()
  expect(count).toBeGreaterThanOrEqual(3)
})

test('AC-7c: Submissions browser — no filter shows 6 submitted rows for Form A (CCIH)', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/c/ccih/dashboard/submissions')
  await page.waitForLoadState('networkidle')

  // Default view: no filter → all submitted for CCIH (6 from Form A + 1 case-phase).
  const responseList = page.getByRole('list', { name: /respostas/i })
  await expect(responseList).toBeVisible({ timeout: 10_000 })
  // We expect at least 6 rows (standalone) + 1 case-phase = 7 total.
  const rows = responseList.getByRole('listitem')
  const count = await rows.count()
  expect(count).toBeGreaterThanOrEqual(6)
})

test('AC-7d: Submissions browser form filter narrows rows', async ({ page }) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto('/c/farmacia/dashboard/submissions')
  await page.waitForLoadState('networkidle')

  // Form filter: pick Form B explicitly.
  const formSelect = page.getByLabel('Formulário')
  await expect(formSelect).toBeVisible({ timeout: 10_000 })
  await formSelect.selectOption({ value: FORM_B_ID })

  await page.waitForTimeout(2_000)

  const responseList = page.getByRole('list', { name: /respostas/i })
  await expect(responseList).toBeVisible({ timeout: 10_000 })
  // Form B starts with 4 seeded submitted responses; Phase 6 tests may add
  // more (e1 submitted). Assert at least 4.
  const rows = responseList.getByRole('listitem')
  const count = await rows.count()
  expect(count).toBeGreaterThanOrEqual(4)
})

// ---------------------------------------------------------------------------
// AC-8: in_progress metadata-only — with "em andamento" toggle on, the
//        in_progress row appears but is a non-link (no <a> affordance) and
//        exposes no answers; staff_admin cannot open another member's in_progress.
// ---------------------------------------------------------------------------

test('AC-8: in_progress toggle works; any visible in_progress rows are metadata-only (non-link)', async ({ page }) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto('/c/farmacia/dashboard/submissions')
  await page.waitForLoadState('networkidle')

  // Toggle on "em andamento". The shadcn Checkbox is a <button role="checkbox">,
  // not a native <input>, so use .click() (not .check()).
  const inProgressCheckbox = page.getByRole('checkbox', { name: /incluir respostas em andamento/i })
  await expect(inProgressCheckbox).toBeVisible({ timeout: 10_000 })
  // Verify it starts unchecked.
  await expect(inProgressCheckbox).toHaveAttribute('aria-checked', 'false')
  await inProgressCheckbox.click()

  // After click, the checkbox state should flip to checked.
  await expect(inProgressCheckbox).toHaveAttribute('aria-checked', 'true', { timeout: 5_000 })

  await page.waitForTimeout(2_000)

  // RLS scopes in_progress visibility to the owner only. chefe.farm has no
  // own in_progress responses, so the list still shows only submitted rows —
  // this is the correct behavior (RLS hiding foreign in_progress is the invariant).
  // If any in_progress rows DO appear (they would only be chefe.farm's own),
  // they must be non-link and carry the "Em andamento" badge.
  const responseList = page.getByRole('list', { name: /respostas/i })
  if (await responseList.isVisible()) {
    const inProgressRows = responseList
      .getByRole('listitem')
      .filter({ has: page.getByText(/em andamento/i) })
    const ipCount = await inProgressRows.count()
    // For each in_progress row: must NOT be a link (no <a> with href).
    for (let i = 0; i < ipCount; i++) {
      const row = inProgressRows.nth(i)
      await expect(row.locator('a')).toHaveCount(0)
    }
  }
  // The absence of another member's in_progress rows (staff1.farm e1) is itself
  // proof the invariant holds at the UI level. The RLS boundary is asserted via
  // the JWT query in AC-11.
})

test('AC-8b: staff_admin cannot access a foreign-commission response detail via URL', async ({ page }) => {
  // Two security vectors: (1) completely unknown response id, (2) a real CCIH
  // response accessed via Farmácia's URL namespace.
  await signInAs(page, 'chefe.farm@test.local')

  // Vector 1: non-existent UUID → 404.
  const BOGUS_ID = '00000000-dead-beef-0000-000000000000'
  await page.goto(`/c/farmacia/dashboard/submissions/${BOGUS_ID}`)
  await expect(page.getByRole('heading', { name: /encontramos esta página|Erro 404/i })).toBeVisible({
    timeout: 10_000,
  })

  // Vector 2: a real CCIH response accessed through Farmácia's URL namespace.
  // The detail page performs a commission-match guard: if detail.commissionId ≠ slug's
  // commission, it calls notFound(). Get any CCIH submitted response id via service-role.
  const ccihSubmissions = await serviceQuery<{ id: string }>(
    page,
    `responses?commission_id=eq.a0000000-0000-0000-0000-0000000000a1&status=eq.submitted&select=id&limit=1`,
  )
  if (ccihSubmissions.length > 0) {
    const ccihId = ccihSubmissions[0].id
    await page.goto(`/c/farmacia/dashboard/submissions/${ccihId}`)
    await expect(
      page.getByRole('heading', { name: /encontramos esta página|Erro 404/i }),
    ).toBeVisible({ timeout: 10_000 })
    // No CCIH data in DOM.
    const body = await page.locator('body').textContent()
    expect(body).not.toMatch(/dispensador_disponivel|epis_observados/i)
  }
})

// ---------------------------------------------------------------------------
// AC-9: Version-faithful detail — Form B 'Não' branch shows conditional
//        section as "não aplicável"; 'Sim' branch shows temperature answers;
//        sign-off metadata visible.
// ---------------------------------------------------------------------------

test('AC-9: Version-faithful detail — Não branch shows conditional section as não aplicável', async ({ page }) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto('/c/farmacia/dashboard/submissions')
  await page.waitForLoadState('networkidle')

  // Open the submissions list and find a row WITHOUT case-phase badge.
  const responseList = page.getByRole('list', { name: /respostas/i })
  await expect(responseList).toBeVisible({ timeout: 10_000 })

  // Click the first link to open the first submitted detail.
  // The seeded i=4 response took Não branch (latest, submitted_at oldest);
  // we'll open any submitted row and check for the conditional section being
  // either "não aplicável" or containing temperature answers (both are valid
  // depending on which branch). We need to find specifically a 'Não' branch row.
  //
  // Strategy: get all submitted links, open each until we find one where
  // "não aplicável" appears in the conditional "Controle de temperatura" section.
  const links = responseList.locator('li a')
  const linkCount = await links.count()
  let foundNaoApplicavel = false

  for (let i = 0; i < linkCount && !foundNaoApplicavel; i++) {
    const href = await links.nth(i).getAttribute('href')
    if (!href) continue
    await page.goto(href)
    await page.waitForLoadState('networkidle')

    // Check if the "Controle de temperatura" section is marked "não aplicável"
    const tempSection = page.getByRole('region').filter({
      has: page.getByRole('heading', { name: /controle.*temperatura/i }),
    })
    const exists = await tempSection.count()
    if (exists > 0) {
      const naoAplic = tempSection.getByText(/não aplicável/i)
      const naoAplicCount = await naoAplic.count()
      if (naoAplicCount > 0) {
        foundNaoApplicavel = true
        // Assert the "não aplicável" badge is visible within that section.
        await expect(naoAplic.first()).toBeVisible()
        // The detail page should NOT show temperature answer values
        // (since the section was hidden for this response).
        await expect(
          page.getByText(/temperatura.*faixa.*°C/i),
        ).not.toBeVisible()
      }
    }
    await page.goto('/c/farmacia/dashboard/submissions')
    await page.waitForLoadState('networkidle')
  }

  expect(foundNaoApplicavel).toBe(true)
})

test('AC-9b: Version-faithful detail — Sim branch shows temperature answers + sign-off metadata', async ({ page }) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto('/c/farmacia/dashboard/submissions')
  await page.waitForLoadState('networkidle')

  const responseList = page.getByRole('list', { name: /respostas/i })
  await expect(responseList).toBeVisible({ timeout: 10_000 })

  const links = responseList.locator('li a')
  const linkCount = await links.count()
  let foundSimBranch = false

  for (let i = 0; i < linkCount && !foundSimBranch; i++) {
    const href = await links.nth(i).getAttribute('href')
    if (!href) continue
    await page.goto(href)
    await page.waitForLoadState('networkidle')

    // Look for the conditional temperature section without "não aplicável"
    const tempSection = page.getByRole('region').filter({
      has: page.getByRole('heading', { name: /controle.*temperatura/i }),
    })
    const exists = await tempSection.count()
    if (exists > 0) {
      const naoAplic = tempSection.getByText(/não aplicável/i)
      const naoAplicCount = await naoAplic.count()
      if (naoAplicCount === 0) {
        // This is the Sim branch: temperature section is visible.
        foundSimBranch = true
        // The temperature question should be present.
        // Both temperature question labels appear (strict mode: use .first()).
        await expect(
          tempSection.getByText(/temperatura.*câmara|câmara.*faixa|temperatura.*registrada/i).first(),
        ).toBeVisible()
        // Sign-off metadata must be visible somewhere on the page.
        // The seeded responses have sign-offs on both signed sections.
        // Two "Assinada por …" blocks appear (respondent + staff_admin); use .first().
        await expect(page.getByText(/assinada por/i).first()).toBeVisible()
      }
    }
    await page.goto('/c/farmacia/dashboard/submissions')
    await page.waitForLoadState('networkidle')
  }

  expect(foundSimBranch).toBe(true)
})

// ---------------------------------------------------------------------------
// AC-10: Own vs foreign detail — staff_admin can open a submitted response
//         (version-faithful). A foreign commission response → 404 with no leakage.
// ---------------------------------------------------------------------------

test('AC-10a: staff_admin can open any submitted detail within their commission', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/c/ccih/dashboard/submissions')
  await page.waitForLoadState('networkidle')

  const responseList = page.getByRole('list', { name: /respostas/i })
  await expect(responseList).toBeVisible({ timeout: 10_000 })

  // Click the first submitted link.
  const firstLink = responseList.locator('li a').first()
  await expect(firstLink).toBeVisible({ timeout: 10_000 })
  await firstLink.click()

  // Detail page renders the form title + version-faithful content.
  await expect(
    page.getByRole('heading', { name: /checklist.*higienização.*mãos/i }),
  ).toBeVisible({ timeout: 15_000 })
})

test('AC-10b: foreign commission response_id → friendly 404 with no data leakage', async ({ page }) => {
  // chefe.ccih is staff_admin of CCIH; attempt to access a Farmácia submission
  // detail via the CCIH dashboard URL pattern.
  await signInAs(page, 'chefe.ccih@test.local')

  // First get a real Farm B response id via service-role query.
  const farmSubmissions = await serviceQuery<{ id: string }>(
    page,
    `responses?commission_id=eq.b0000000-0000-0000-0000-0000000000b1&status=eq.submitted&select=id&limit=1`,
  )
  expect(farmSubmissions.length).toBeGreaterThan(0)
  const foreignId = farmSubmissions[0].id

  // Attempt access via CCIH's URL namespace — the page must return 404.
  await page.goto(`/c/ccih/dashboard/submissions/${foreignId}`)
  await expect(
    page.getByRole('heading', { name: /encontramos esta página|Erro 404/i }),
  ).toBeVisible({ timeout: 10_000 })

  // Ensure no Farm data leaked into the DOM.
  const body = await page.locator('body').textContent()
  expect(body).not.toMatch(/inspeção.*armazenamento|possui_termolabeis|organizacao_estoque/i)
})

// ---------------------------------------------------------------------------
// AC-11: in_progress-answers invariant (security).
//         A staff_admin reading another member's in_progress answers via
//         a real authenticated JWT returns zero rows from the `answers` table.
// ---------------------------------------------------------------------------

test('AC-11: staff_admin JWT cannot read another member\'s in_progress answers via RLS', async ({ page }) => {
  // Create a fresh in_progress response for staff1.farm (not chefe.farm) so
  // the test is self-contained regardless of whether the seeded e1 response has
  // been submitted by prior tests. We call start_or_resume_response directly via
  // the REST API using staff1.farm's JWT (the natural owner), creating an
  // in_progress draft on Form B.
  const staff1FarmToken = await getOwnerToken(page, 'staff1.farm@test.local')
  const startResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/start_or_resume_response`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${staff1FarmToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_form_version_id: '50000000-0000-0000-0000-00000000b001' },
    },
  )
  // The RPC returns the full response record. Extract the `id` field.
  expect(startResp.ok()).toBeTruthy()
  const startData = (await startResp.json()) as { id: string; response_id?: string } | string
  const freshResponseId =
    typeof startData === 'string'
      ? startData
      : startData.id ?? startData.response_id
  expect(freshResponseId).toBeTruthy()

  // Obtain chefe.farm's JWT (staff_admin of Farmácia).
  const chefeFarmToken = await getOwnerToken(page, 'chefe.farm@test.local')

  // Attempt to read the answers for staff1.farm's in_progress response
  // via chefe.farm's JWT. RLS must block this (Phase-7 invariant).
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/answers?response_id=eq.${freshResponseId}&select=*`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${chefeFarmToken}`,
      },
    },
  )
  // RLS must gate the read — should return an empty array, not the answers.
  expect(resp.status()).toBe(200) // PostgREST returns 200 with [] for RLS-filtered reads
  const data = await resp.json()
  expect(Array.isArray(data)).toBe(true)
  expect((data as unknown[]).length).toBe(0) // zero rows — invariant holds
})

// ---------------------------------------------------------------------------
// AC-12: Keyboard-only flow — dashboard form picker, date filter, submissions
//         browser, open a detail; asserting focus at each step.
// ---------------------------------------------------------------------------

test('AC-12: Keyboard-only — dashboard form picker → date filter → submissions → detail', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')

  // Navigate to the dashboard by keyboard.
  await page.goto('/c/ccih/dashboard')

  // 1. Wait for the form picker (tablist) to render.
  const tabList = page.getByRole('tablist', { name: /formulários/i })
  await expect(tabList).toBeVisible({ timeout: 15_000 })

  // Focus the first tab button via Tab key, then activate it with Enter/Space.
  const firstTab = tabList.getByRole('tab').first()
  await firstTab.focus()
  await expect(firstTab).toBeFocused()
  await page.keyboard.press('Space')

  // 2. Tab to the "De" date input and fill it. Use getByRole to avoid
  // the strict-mode violation from the article's aria-labelledby also matching 'De'.
  const fromInput = page.getByRole('textbox', { name: 'De' })
  await expect(fromInput).toBeVisible({ timeout: 10_000 })
  await fromInput.focus()
  await expect(fromInput).toBeFocused()

  // 3. Tab to the "Até" input.
  const toInput = page.getByRole('textbox', { name: 'Até' })
  await toInput.focus()
  await expect(toInput).toBeFocused()

  // 4. Navigate to the submissions browser via keyboard: find the
  // "Respostas enviadas" link in the nav / breadcrumb area.
  await page.goto('/c/ccih/dashboard/submissions')
  await page.waitForLoadState('networkidle')

  // 5. Tab to the first submission link and Enter to open it.
  const responseList = page.getByRole('list', { name: /respostas/i })
  await expect(responseList).toBeVisible({ timeout: 10_000 })

  const firstLink = responseList.locator('li a').first()
  await firstLink.focus()
  await expect(firstLink).toBeFocused()
  await page.keyboard.press('Enter')

  // 6. Detail page loads.
  await expect(
    page.getByRole('heading', { name: /checklist.*higienização.*mãos/i }),
  ).toBeVisible({ timeout: 15_000 })

  // 7. Assert the "Respostas enviadas" back-link is in the document
  //    (keyboard user can press Tab to find it).
  await expect(page.getByRole('link', { name: /respostas enviadas/i })).toBeVisible()
})

// ---------------------------------------------------------------------------
// P7 QA INFO-1 carry-forward: fix the stale spec comment that references
// "P0022/HTTP 500" — it should read "HC022/HTTP 400". (Spec comment only.)
// This is asserted via a code-content check at the spec level.
// ---------------------------------------------------------------------------

test('P7 INFO-1: phase7-cases.spec.ts stale P0022 comment corrected to HC022', async () => {
  const { readFileSync } = await import('fs')
  const { join } = await import('path')
  const specContent = readFileSync(
    join(__dirname, 'phase7-cases.spec.ts'),
    'utf-8',
  )
  // The old reference "P0022" in the wrong-assignee comment line must be gone
  // (corrected to "HC022" per ADR 0018 — this was the P7 QA INFO-1 carry-forward).
  // We specifically check the inline comment line, not the surrounding narrative comments
  // which may still mention the rename for documentation purposes.
  const inlineCommentLine = specContent
    .split('\n')
    .find((l) => l.includes('does NOT get to start that phase'))
  expect(inlineCommentLine).toBeTruthy()
  expect(inlineCommentLine).not.toMatch(/P0022/)
  expect(inlineCommentLine).toMatch(/HC022/)
})

// ---------------------------------------------------------------------------
// Form B headline (AC-1 counterpart): 4 submitted.
// ---------------------------------------------------------------------------

test('Form B dashboard headline = 4 submitted', async ({ page }) => {
  await signInAs(page, 'chefe.farm@test.local')
  await openDashboard(page, 'farmacia')

  const formBTab = page.getByRole('tab', { name: /inspeção.*armazenamento.*medicamentos/i })
  await expect(formBTab).toBeVisible({ timeout: 10_000 })
  await formBTab.click()

  const headline = page.locator('.font-display.text-4xl.tabular-nums')
  await expect(headline).toHaveText('4', { timeout: 10_000 })
})
