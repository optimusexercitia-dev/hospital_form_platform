import { test, expect, type Page } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"

/**
 * Case-detail "Reuniões" rail card (`CaseMeetingsPanel`,
 * src/components/cases/case-meetings-panel.tsx) — the READ-ONLY reverse of a
 * meeting's "Casos discutidos" panel (`CaseLinker`,
 * src/components/meetings/case-linker.tsx, which writes `meeting_cases`).
 *
 * Covers:
 *   1. Reverse link appears — link a fresh case to the seeded meeting via the
 *      real `CaseLinker` UI ("Vincular caso"), then the case's Detalhes tab
 *      shows a "Reuniões" card row with the meeting title, number, status
 *      badge, and the Resumo:/Decisão: text just entered.
 *   2. The row links out to the meeting detail page.
 *   3. Empty state — a case with no linked meeting shows the empty-state text.
 *
 * State is built through the real write→read path: a fresh case is minted via
 * `create_case_from_template` (mirrors the `createFreshCase` helper in
 * e2e/phase7-cases.spec.ts) so the test does not depend on the seed's Caso
 * 0001, which already carries a seeded `meeting_cases` link (seed.sql "One
 * case discussed (Caso 0001), attached to the first agenda item") — reusing
 * it would pollute both the "link appears" assertions (extra pre-existing
 * rows) and the "empty state" case (already linked). The meeting itself is
 * the seeded `f1000000-…-e1` "Reunião Ordinária — Junho/2026" (held/Realizada,
 * CCIH) — scheduling a fresh meeting through the full "Nova reunião" dialog
 * (react-aria segmented time input) is exercised by phase10/cases-meetings-minor
 * specs already and is not the surface under test here.
 *
 * Runs against the LOCAL Supabase stack (seeded personas). Reset with
 * `npx supabase db reset --local` before a clean run.
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin of CCIH (Rede A) — links the case,
 *                           then reads the case-detail rail.
 */

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

const ORG = 'rede-a'
const SLUG = 'ccih'
const BASE = `/o/${ORG}/c/${SLUG}`

const COMM_CCIH_ID = 'a0000000-0000-0000-0000-0000000000a1'
const SEEDED_MEETING_ID = 'f1000000-0000-0000-0000-0000000000e1' // "Reunião Ordinária — Junho/2026" (held)
const SEEDED_MEETING_TITLE = 'Reunião Ordinária — Junho/2026'

const PW = 'Test1234!'

// ---------------------------------------------------------------------------
// Helpers (mirror the phase7-cases / cases-meetings-minor conventions)
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = PW) {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, password)
}

/** Obtain a real RLS-scoped JWT for a persona. */
async function getOwnerToken(
  page: Page,
  email: string,
  password = PW,
): Promise<string> {
  const resp = await page.request.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      data: { email, password },
    },
  )
  expect(resp.ok()).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

/**
 * Create a fresh templated case in CCIH (mirrors `createFreshCase` in
 * e2e/phase7-cases.spec.ts). Returns the new case id. Used so each test owns
 * an isolated case with a known (empty) set of `meeting_cases` links.
 */
async function createFreshCase(
  page: Page,
  ownerToken: string,
  label: string,
): Promise<string> {
  const tplResp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/process_templates?commission_id=eq.${COMM_CCIH_ID}&status=eq.active&select=id&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
      },
    },
  )
  expect(tplResp.ok()).toBeTruthy()
  const tpls = (await tplResp.json()) as Array<{ id: string }>
  expect(tpls.length).toBeGreaterThan(0)

  const createResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/create_case_from_template`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_template_id: tpls[0].id, p_label: label },
    },
  )
  expect(createResp.ok()).toBeTruthy()
  const body = (await createResp.json()) as { case_id?: string; id?: string }
  const caseId = body.case_id ?? body.id
  expect(caseId).toBeTruthy()
  return caseId as string
}

// ===========================================================================
// 1 + 2 — Reverse link appears on the case Detalhes tab; row links to the meeting
// ===========================================================================

test('Reuniões card shows the linked meeting with title/number/status/Resumo/Decisão, and the row navigates to the meeting', async ({
  page,
}) => {
  test.setTimeout(90_000)

  const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const caseId = await createFreshCase(
    page,
    ownerToken,
    `Reuniões painel — vinculado ${Date.now()}`,
  )

  const SUMMARY_TEXT = 'Discussão do caso E2E na reunião ordinária.'
  const DECISION_TEXT = 'Encaminhar para acompanhamento na próxima reunião.'

  // --- Write side: link the fresh case to the seeded meeting via the real
  // CaseLinker UI ("Casos discutidos" → "Vincular caso"). ---
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/meetings/${SEEDED_MEETING_ID}`)
  await page.waitForURL(`**/c/${SLUG}/meetings/${SEEDED_MEETING_ID}`, {
    timeout: 15_000,
  })

  const casesSection = page.getByRole('region', { name: /Casos discutidos/i })
  await expect(casesSection).toBeVisible({ timeout: 10_000 })

  const vincularBtn = casesSection.getByRole('button', { name: /Vincular caso/i })
  await expect(vincularBtn).toBeVisible({ timeout: 10_000 })
  await vincularBtn.click()

  const linkDialog = page.getByRole('dialog', { name: /Vincular caso/i })
  await expect(linkDialog).toBeVisible({ timeout: 8_000 })

  // Select the fresh case by its id (option value = case id).
  const caseSelect = linkDialog.getByRole('combobox').first()
  await caseSelect.selectOption(caseId)

  await linkDialog.getByLabel(/Resumo/i).fill(SUMMARY_TEXT)
  await linkDialog.getByLabel(/Decisão/i).fill(DECISION_TEXT)

  await linkDialog.getByRole('button', { name: /^Vincular caso$/ }).click()
  await expect(linkDialog).not.toBeVisible({ timeout: 10_000 })

  // The link now shows in "Casos discutidos" (write-side sanity check before
  // moving to the reverse read).
  await expect(
    casesSection.getByText(SUMMARY_TEXT, { exact: false }),
  ).toBeVisible({ timeout: 10_000 })

  // --- Read side: the case's Detalhes tab shows the reverse "Reuniões" card. ---
  await page.goto(`${BASE}/manage/cases/${caseId}`)
  await page.waitForURL(`**/manage/cases/${caseId}`, { timeout: 15_000 })

  const meetingsCard = page.getByRole('region', {
    name: /^Reuniões$/i,
  })
  await expect(meetingsCard).toBeVisible({ timeout: 10_000 })

  // Row content: meeting title, meeting number, a status badge, Resumo:, Decisão:.
  const row = meetingsCard.locator('li').filter({ hasText: SEEDED_MEETING_TITLE })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(row.getByText(/Reunião\s*0*1\b/)).toBeVisible() // formatMeetingNumber("Reunião 0001")
  await expect(row.getByText(/Realizada/i)).toBeVisible() // MeetingStatusBadge label for `held`
  await expect(row.getByText(/Resumo:/)).toBeVisible()
  await expect(row.getByText(SUMMARY_TEXT, { exact: false })).toBeVisible()
  await expect(row.getByText(/Decisão:/)).toBeVisible()
  await expect(row.getByText(DECISION_TEXT, { exact: false })).toBeVisible()

  // The card's count badge reads 1 (only one meeting linked to this fresh case).
  await expect(
    meetingsCard.locator('span').filter({ hasText: /^1$/ }).first(),
  ).toBeVisible()

  // --- Proof screenshot: the populated Detalhes tab with the Reuniões card. ---
  await meetingsCard.scrollIntoViewIfNeeded()
  await page.screenshot({
    path: '/private/tmp/claude-501/-Users-mike-Projects-claude-hospital-form-platform/e4aaa15b-6f2e-4eb6-9c3d-7213a4fc5e5c/scratchpad/case-meetings-panel-populated.png',
    fullPage: true,
  })

  // --- Assertion 2: the row navigates to the meeting detail page. ---
  await row.click()
  await page.waitForURL(new RegExp(`/c/${SLUG}/meetings/${SEEDED_MEETING_ID}$`), {
    timeout: 15_000,
  })
  await expect(
    page.getByRole('heading', { name: new RegExp(SEEDED_MEETING_TITLE) }).first(),
  ).toBeVisible({ timeout: 10_000 })
})

// ===========================================================================
// 3 — Empty state: a case with no linked meeting shows the empty-state text
// ===========================================================================

test('Reuniões card shows the empty-state text for a case discussed in no meeting', async ({
  page,
}) => {
  const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const caseId = await createFreshCase(
    page,
    ownerToken,
    `Reuniões painel — sem vínculo ${Date.now()}`,
  )

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${caseId}`)
  await page.waitForURL(`**/manage/cases/${caseId}`, { timeout: 15_000 })

  const meetingsCard = page.getByRole('region', { name: /^Reuniões$/i })
  await expect(meetingsCard).toBeVisible({ timeout: 10_000 })

  await expect(
    meetingsCard.getByText(
      'Este caso ainda não foi discutido em nenhuma reunião.',
      { exact: true },
    ),
  ).toBeVisible({ timeout: 10_000 })

  // Count badge reads 0, and no row is rendered.
  await expect(
    meetingsCard.locator('span').filter({ hasText: /^0$/ }).first(),
  ).toBeVisible()
  await expect(meetingsCard.locator('li')).toHaveCount(0)
})
