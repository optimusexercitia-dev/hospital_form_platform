import { test, expect, type Page, type Locator } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import {
  CHEFE_CCIH,
  CHEFE_FARM,
  COMMISSION_CCIH,
  COMMISSION_FARMACIA,
  HOSPITAL_CENTRAL_A,
  HOSPITALADMIN_A1,
  ORG_A,
  ORGADMIN_B,
  PLATFORM,
  createFrameworkRpc,
  getToken,
  hospitalReadinessRpc,
  purgeFrameworks,
  purgeStandardOwnerships,
  setAssessmentRpc,
  setFeatureFlag,
  upsertStandardRpc,
} from './helpers/accreditation'

/**
 * Phase 16 — Standards Crosswalk & Readiness/Gap Engine v2 (ADR 0093 D7/D8).
 * Acceptance criteria (spec 3 of 5):
 *
 *   AC-1  CCIH self-assesses `conforme`, Farmácia (SAME hospital, Hospital
 *         Central A) self-assesses `nao_conforme` on the SAME standard ->
 *         `hospitaladmin.a1` sees the WORST case (`nao_conforme`,
 *         `resolution: pior_caso`) on the hospital surface.
 *   AC-2  `hospitaladmin.a1` sets CCIH as the responsible commission ->
 *         resolution flips to `responsavel` and the consolidated status
 *         becomes CCIH's OWN answer (`conforme`), overriding the worst-wins
 *         rollup entirely (D7).
 *   AC-3  clearing the responsible commission reverts to `pior_caso` /
 *         `nao_conforme`.
 *   AC-4  `orgadmin.b` (a DIFFERENT org) sees zero: 404 at the route AND an
 *         empty array from a direct `hospital_readiness` RPC probe (the
 *         gate — `is_hospital_admin_of OR is_org_admin_of` — fails for a
 *         foreign org admin before the framework-reachability check ever runs).
 *   AC-5  a DOM-wide assertion that no assessment NOTE text appears anywhere
 *         on the hospital surface — `HospitalReadinessRow` carries no `note`
 *         field at all (D8: counts-only, PHI-free-by-construction), so this
 *         proves the omission, not just that a `note` column wasn't rendered.
 *   AC-6  a keyboard-only pass on the ownership editor (set, then clear).
 *
 * ## Fixture
 *
 * A GLOBAL framework (`create_framework` as `platform@test.local`) with ONE
 * standard, so CCIH's and Farmácia's assessments land on the exact SAME
 * `standard_id` — required for the worst-wins rollup to see them as the SAME
 * row at all (two independently-cloned copies would carry different standard
 * ids and never conflict). `hospitaladmin.a1` is `hospital_admin` of Hospital
 * Central A only (verified live) — exactly the persona both CCIH and
 * Farmácia's parent hospital.
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 1000 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

const SPEC_TAG = 'P16-3'
const FRAMEWORK_KEY = 'p16-hospital-spec-global'
const STD_CODE = 'P16-3-STD'
const STD_TITLE = 'Padrao consolidado hospital P16'
const NOTE_MARKER = 'NAOVAZARP163SEGREDOTESTE'

let frameworkId: string
let standardId: string

async function signInAs(page: Page, email: string, actAs?: string) {
  // ACT (ADR 0106) — optional 2nd/3rd param, additive: threads to
  // cachedSignIn's own actAs seam for ORGADMIN_B (org_admin + staff_admin, 2
  // role types), which otherwise lands on /selecionar-perfil
  // (BUG-ACT-PICKER-SEED-1).
  await cachedSignIn(page, email, 'Test1234!', actAs)
}

test.beforeAll(async ({ browser }) => {
  setFeatureFlag('accreditation', true)

  const page = await browser.newPage()
  const platformToken = await getToken(page, PLATFORM)
  const fw = await createFrameworkRpc(page, platformToken, {
    key: FRAMEWORK_KEY,
    name: `${SPEC_TAG} Framework Global`,
    ownerCommission: null,
  })
  expect(fw.ok, `create_framework: ${fw.text}`).toBeTruthy()
  frameworkId = fw.json.id

  const std = await upsertStandardRpc(page, platformToken, {
    framework: frameworkId,
    code: STD_CODE,
    title: STD_TITLE,
    position: 0,
  })
  expect(std.ok, `upsert_standard: ${std.text}`).toBeTruthy()
  standardId = std.json.id

  const ccihToken = await getToken(page, CHEFE_CCIH)
  const a1 = await setAssessmentRpc(page, ccihToken, {
    commission: COMMISSION_CCIH,
    standard: standardId,
    status: 'conforme',
    noteMd: `CCIH ${NOTE_MARKER} nota interna`,
  })
  expect(a1.ok, `set_standard_assessment CCIH: ${a1.text}`).toBeTruthy()

  const farmToken = await getToken(page, CHEFE_FARM)
  const a2 = await setAssessmentRpc(page, farmToken, {
    commission: COMMISSION_FARMACIA,
    standard: standardId,
    status: 'nao_conforme',
    noteMd: `Farmacia ${NOTE_MARKER} nota interna`,
  })
  expect(a2.ok, `set_standard_assessment Farmacia: ${a2.text}`).toBeTruthy()

  await page.close()
})

test.afterAll(() => {
  purgeStandardOwnerships(HOSPITAL_CENTRAL_A, [standardId])
  purgeFrameworks([frameworkId])
})

function hospitalSurfaceUrl() {
  return `/o/${ORG_A}/manage/acreditacao?framework=${frameworkId}`
}

function hospitalCard(page: Page): Locator {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: 'Hospital Central A' }) })
}

function standardRow(page: Page): Locator {
  return hospitalCard(page).locator('tr').filter({ hasText: STD_CODE })
}

/** Deterministic keyboard select on a native `<select>`: Home to index 0,
 *  then read the DOM's own option order and ArrowDown exactly enough times —
 *  never assumes a particular order (the codebase's own `arrowToOption`
 *  discipline, adapted for `<select>` value rather than combobox highlight). */
async function keyboardSelectByValue(select: Locator, targetValue: string) {
  await select.focus()
  await select.page().keyboard.press('Home')
  const values = await select.locator('option').evaluateAll((opts) =>
    (opts as HTMLOptionElement[]).map((o) => o.value),
  )
  const targetIndex = values.indexOf(targetValue)
  expect(targetIndex, `option value "${targetValue}" not found among [${values.join(', ')}]`).toBeGreaterThanOrEqual(0)
  for (let i = 0; i < targetIndex; i++) {
    await select.page().keyboard.press('ArrowDown')
  }
  await expect(select).toHaveValue(targetValue)
}

// ===========================================================================
// AC-1 — worst-wins across CCIH (conforme) vs Farmácia (nao_conforme)
// ===========================================================================

test('AC-1 hospitaladmin.a1 sees the worst case across CCIH and Farmácia (pior_caso)', async ({
  page,
}) => {
  await signInAs(page, HOSPITALADMIN_A1)
  await page.goto(hospitalSurfaceUrl())
  await expect(page.getByRole('heading', { level: 1, name: 'Acreditação' })).toBeVisible({
    timeout: 15_000,
  })

  const row = standardRow(page)
  await expect(row).toBeVisible({ timeout: 15_000 })
  await expect(row.getByText('Não conforme', { exact: true })).toBeVisible()
  // exact: true — "Pior caso" (case-insensitive substring, Playwright's
  // getByText default) also matches the ownership <select>'s OWN option
  // text "Nenhuma (pior caso)".
  await expect(row.getByText('Pior caso', { exact: true })).toBeVisible()
})

// ===========================================================================
// AC-2 — setting the responsible commission overrides the rollup
// ===========================================================================

test('AC-2 setting CCIH as the responsible commission flips the resolution and answer', async ({
  page,
}) => {
  await signInAs(page, HOSPITALADMIN_A1)
  await page.goto(hospitalSurfaceUrl())
  const row = standardRow(page)
  await expect(row).toBeVisible({ timeout: 15_000 })

  const select = row.getByLabel('Comissão responsável pelo padrão')
  await select.selectOption({ label: 'Comissão de Controle de Infecção Hospitalar' })
  await row.getByRole('button', { name: 'Salvar' }).click()

  await expect(row.getByText('Responsável designado')).toBeVisible({ timeout: 15_000 })
  await expect(row.getByText('Conforme', { exact: true })).toBeVisible()
  await expect(row.getByText('Não conforme', { exact: true })).toHaveCount(0)
})

// ===========================================================================
// AC-3 — clearing the responsible commission reverts to worst-wins
// ===========================================================================

test('AC-3 clearing the responsible commission reverts to pior_caso / nao_conforme', async ({
  page,
}) => {
  await signInAs(page, HOSPITALADMIN_A1)
  await page.goto(hospitalSurfaceUrl())
  const row = standardRow(page)
  await expect(row).toBeVisible({ timeout: 15_000 })
  // Precondition from AC-2 (serial mode — runs after it).
  await expect(row.getByText('Responsável designado')).toBeVisible({ timeout: 15_000 })

  const select = row.getByLabel('Comissão responsável pelo padrão')
  await select.selectOption({ label: 'Nenhuma (pior caso)' })
  await row.getByRole('button', { name: 'Salvar' }).click()

  await expect(row.getByText('Pior caso', { exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(row.getByText('Não conforme', { exact: true })).toBeVisible()
})

// ===========================================================================
// AC-4 — cross-org isolation: orgadmin.b sees zero, at the route AND the door
// ===========================================================================

test('AC-4 orgadmin.b (a different org) sees zero — 404 at the route, [] from the RPC directly', async ({
  page,
}) => {
  await signInAs(page, ORGADMIN_B, 'org_admin')
  await page.goto(hospitalSurfaceUrl())
  // Not `resp.status()` — this route streams behind `o/[org]/manage/loading.tsx`,
  // so the HTTP status commits to 200 before the async `notFound()` resolves
  // (see phase16-accreditation-core.spec.ts AC-0's comment for the full
  // mechanism, verified live there). The DOM is the only reliable signal.
  // BUG-ACT-NOTFOUND-COPY-1: currently passing with the OLD global copy (this
  // cross-org denial fires at a higher layout level than the flag-off case in
  // phase16-accreditation-core.spec.ts AC-0, which hits the new org-tier
  // boundary on the SAME route) — lower risk per the coordinator's
  // classification; widened to /não encontr/i defensively anyway.
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({
    timeout: 15_000,
  })

  const token = await getToken(page, ORGADMIN_B, undefined, 'org_admin')
  const probe = await hospitalReadinessRpc(page, token, HOSPITAL_CENTRAL_A, frameworkId)
  expect(probe.ok, `hospital_readiness as orgadmin.b: ${probe.text}`).toBeTruthy()
  expect(probe.json).toEqual([])
})

// ===========================================================================
// AC-5 — no note text anywhere on the hospital surface (D8)
// ===========================================================================

test('AC-5 no assessment note text appears anywhere on the hospital surface', async ({ page }) => {
  await signInAs(page, HOSPITALADMIN_A1)
  await page.goto(hospitalSurfaceUrl())
  await expect(page.getByRole('heading', { level: 1, name: 'Acreditação' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(standardRow(page)).toBeVisible({ timeout: 15_000 })

  const html = await page.content()
  expect(html).not.toContain(NOTE_MARKER)
  const bodyText = await page.locator('body').innerText()
  expect(bodyText).not.toContain(NOTE_MARKER)
})

// ===========================================================================
// AC-6 — keyboard-only pass on the ownership editor (set, then clear)
// ===========================================================================

test('AC-6 keyboard-only: set and clear the responsible commission via the ownership editor', async ({
  page,
}) => {
  await signInAs(page, HOSPITALADMIN_A1)
  await page.goto(hospitalSurfaceUrl())
  const row = standardRow(page)
  await expect(row).toBeVisible({ timeout: 15_000 })

  const select = row.getByLabel('Comissão responsável pelo padrão')
  await keyboardSelectByValue(select, COMMISSION_FARMACIA)

  const saveBtn = row.getByRole('button', { name: 'Salvar' })
  await saveBtn.focus()
  await expect(saveBtn).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(row.getByText('Responsável designado')).toBeVisible({ timeout: 15_000 })
  await expect(row.getByText('Não conforme', { exact: true })).toBeVisible() // Farmácia's own answer

  // Clear it back out, also by keyboard.
  await keyboardSelectByValue(select, '')
  const saveBtn2 = row.getByRole('button', { name: 'Salvar' })
  await saveBtn2.focus()
  await expect(saveBtn2).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(row.getByText('Pior caso', { exact: true })).toBeVisible({ timeout: 15_000 })
})
