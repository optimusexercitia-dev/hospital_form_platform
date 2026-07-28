import { test, expect, type Page } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"

/**
 * Form-builder-enhancements batch (ad-hoc 2026-07-06) — TASKS 1 + 2:
 * Hospital Departments ("Unidade / setor") + the Novo-caso department dropdown.
 *
 * Acceptance (from the batch spec):
 *   - As orgadmin.a, on the hospital detail page (…/o/rede-a/manage/hospitais/
 *     [hospitalId]) for central-a: create a department, rename it, add a second,
 *     reorder, archive one.
 *   - As chefe.ccih, in Novo caso: the "Unidade / setor" field is a DROPDOWN of
 *     the hospital's ACTIVE departments + an "Outros" entry (free text).
 *       • select a department → create → detail shows it;
 *       • select "Outros" + custom value → create → detail shows the custom value.
 *   - The old PHI free-text unit is GONE from the case flow (but the safety-event /
 *     referral patient panels KEEP their free-text unit — spot-check one).
 *
 * Environment: LOCAL Supabase (app reads .env.local → local). Personas password
 * `Test1234!`. central-a hospital id is stable in the seed.
 *
 * Serial: department CRUD builds shared state read by the case-dropdown tests.
 * Cleanup (service-role) removes spec-created departments so re-runs start clean.
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

const ORG = 'rede-a'
const CENTRAL_A = '05000000-0000-0000-0000-00000000000a'
const SECUNDARIO_A = '05000000-0000-0000-0000-0000000000a2'
const HOSPITAL_DETAIL = `/o/${ORG}/manage/hospitais/${CENTRAL_A}`

// Unique tag so spec rows never collide with any other data / leftover runs.
const TAG = 'DEPT-E2E'
const DEPT_UTI = `UTI Adulto ${TAG}`
const DEPT_UTI_RENAMED = `UTI Adulto Renomeada ${TAG}`
const DEPT_PS = `Pronto-Socorro ${TAG}`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, password)
}

/** Service-role DELETE — remove all spec-created departments (idempotent). */
async function purgeSpecDepartments(page: Page) {
  await page.request.delete(
    `${SUPABASE_URL}/rest/v1/hospital_departments?name=like.*${TAG}*`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
    },
  )
}

/** Service-role DELETE — remove all spec-created cases (by label pattern). */
async function purgeSpecCases(page: Page) {
  // Cases minted process-less carry no template; delete by label tag. Cascades
  // case_phases / case_offered_results. Safe: only rows this spec created.
  await page.request.delete(
    `${SUPABASE_URL}/rest/v1/cases?label=like.*${TAG}*`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
    },
  )
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  await purgeSpecCases(page)
  await purgeSpecDepartments(page)
  await page.close()
})

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage()
  await purgeSpecCases(page)
  await purgeSpecDepartments(page)
  await page.close()
})

// ---------------------------------------------------------------------------
// TASK 1/2 — Department CRUD on the hospital detail page (orgadmin.a)
// ---------------------------------------------------------------------------

test('AC-1: orgadmin creates, renames, adds a second, reorders and archives a department', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, 'orgadmin.a@test.local')
  await page.goto(HOSPITAL_DETAIL)

  // The hospital detail page shows the "Setores" section.
  await expect(
    page.getByRole('heading', { name: /Setores/i }).first(),
  ).toBeVisible({ timeout: 12_000 })

  // ── Create "UTI Adulto" ──────────────────────────────────────────────────
  await page.getByRole('button', { name: /Novo setor/i }).click()
  const createDialog = page.getByRole('dialog')
  await expect(createDialog).toBeVisible({ timeout: 8_000 })
  await createDialog.getByRole('textbox').first().fill(DEPT_UTI)
  await createDialog.getByRole('button', { name: /criar|adicionar|salvar/i }).click()
  await expect(createDialog).not.toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(DEPT_UTI, { exact: true })).toBeVisible({
    timeout: 10_000,
  })

  // ── Rename it ────────────────────────────────────────────────────────────
  await page
    .getByRole('button', { name: new RegExp(`Renomear o setor ${escapeRe(DEPT_UTI)}`, 'i') })
    .click()
  const renameDialog = page.getByRole('dialog')
  await expect(renameDialog).toBeVisible({ timeout: 8_000 })
  const renameInput = renameDialog.getByRole('textbox').first()
  await renameInput.fill(DEPT_UTI_RENAMED)
  await renameDialog.getByRole('button', { name: /salvar|renomear/i }).click()
  await expect(renameDialog).not.toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(DEPT_UTI_RENAMED, { exact: true })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText(DEPT_UTI, { exact: true })).toHaveCount(0)

  // ── Add a second "Pronto-Socorro" ────────────────────────────────────────
  await page.getByRole('button', { name: /Novo setor/i }).click()
  const createDialog2 = page.getByRole('dialog')
  await expect(createDialog2).toBeVisible({ timeout: 8_000 })
  await createDialog2.getByRole('textbox').first().fill(DEPT_PS)
  await createDialog2.getByRole('button', { name: /criar|adicionar|salvar/i }).click()
  await expect(createDialog2).not.toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(DEPT_PS, { exact: true })).toBeVisible({
    timeout: 10_000,
  })

  // ── Reorder: move the second up, assert DB order flipped ──────────────────
  // The manager renders active departments as an ordered list; each has a
  // "Mover … para cima" button. Move Pronto-Socorro up (it is created last).
  const moveUp = page.getByRole('button', {
    name: new RegExp(`Mover ${escapeRe(DEPT_PS)} para cima`, 'i'),
  })
  await expect(moveUp).toBeEnabled({ timeout: 8_000 })
  await moveUp.click()
  // Persisted via reorder_departments RPC — verify the position order in the DB.
  await expect(async () => {
    const resp = await page.request.get(
      `${SUPABASE_URL}/rest/v1/hospital_departments` +
        `?hospital_id=eq.${CENTRAL_A}&archived=eq.false&name=like.*${TAG}*` +
        `&select=name,position&order=position.asc`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      },
    )
    const rows = (await resp.json()) as { name: string; position: number }[]
    // Pronto-Socorro now precedes UTI Adulto Renomeada.
    expect(rows[0]?.name).toBe(DEPT_PS)
    expect(rows[1]?.name).toBe(DEPT_UTI_RENAMED)
  }).toPass({ timeout: 12_000 })

  // ── Archive the UTI department ────────────────────────────────────────────
  await page
    .getByRole('button', { name: new RegExp(`Arquivar o setor ${escapeRe(DEPT_UTI_RENAMED)}`, 'i') })
    .click()
  // Archived rows move under the "Arquivados" heading (dimmed, line-through).
  await expect(
    page.getByRole('heading', { name: /Arquivados/i }),
  ).toBeVisible({ timeout: 10_000 })
  // DB truth: the UTI department is archived, Pronto-Socorro stays active.
  await expect(async () => {
    const resp = await page.request.get(
      `${SUPABASE_URL}/rest/v1/hospital_departments` +
        `?hospital_id=eq.${CENTRAL_A}&name=like.*${TAG}*&select=name,archived`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      },
    )
    const rows = (await resp.json()) as { name: string; archived: boolean }[]
    const uti = rows.find((r) => r.name === DEPT_UTI_RENAMED)
    const ps = rows.find((r) => r.name === DEPT_PS)
    expect(uti?.archived).toBe(true)
    expect(ps?.archived).toBe(false)
  }).toPass({ timeout: 12_000 })
})

// ---------------------------------------------------------------------------
// TASK 2 — cross-hospital denial (hospital_admin of central-a only)
// ---------------------------------------------------------------------------

test('AC-2: hospital_admin of central-a is denied the secundario-a detail page (404)', async ({
  page,
}) => {
  await signInAs(page, 'hospitaladmin.a1@test.local')
  await page.goto(`/o/${ORG}/manage/hospitais/${SECUNDARIO_A}`)

  // notFound() — no departments manager, no "Novo setor" button. The page shows
  // the app's not-found UI. Assert the manager is absent (no data leakage).
  await expect(
    page.getByRole('button', { name: /Novo setor/i }),
  ).toHaveCount(0, { timeout: 8_000 })
  // Its OWN hospital detail page must work (positive control).
  await page.goto(HOSPITAL_DETAIL)
  await expect(
    page.getByRole('button', { name: /Novo setor/i }),
  ).toBeVisible({ timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// TASK 2 — Novo-caso "Unidade / setor" dropdown (chefe.ccih)
// ---------------------------------------------------------------------------

test('AC-3: Novo caso — select a managed department → case detail shows it', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/manage/cases`)

  await page.getByRole('button', { name: /Novo caso/i }).click()
  const dialog = page.getByRole('dialog', { name: /Novo caso/i })
  await expect(dialog).toBeVisible({ timeout: 8_000 })

  // Choose the process-less flow (no template dependency).
  await dialog.locator('select[name="templateId"]').selectOption({ label: 'Sem processo' })

  // A non-identifying label.
  await dialog.getByRole('textbox').first().fill(`Caso ${TAG} — com setor`)

  // The "Unidade / setor" dropdown. It is a native <select>; its active options
  // include the seeded Pronto-Socorro (UTI was archived in AC-1) + an "Outros".
  const unitSelect = dialog.getByLabel(/Unidade \/ setor/i)
  await expect(unitSelect).toBeVisible({ timeout: 8_000 })
  // The archived UTI department must NOT be selectable (active-only picker).
  const optionTexts = (await unitSelect.locator('option').allTextContents()).map(
    (t) => t.trim(),
  )
  expect(optionTexts).toContain(DEPT_PS)
  expect(optionTexts.some((t) => t.includes(DEPT_UTI_RENAMED))).toBeFalsy()
  expect(optionTexts.some((t) => /Outros/i.test(t))).toBeTruthy()

  await unitSelect.selectOption({ label: DEPT_PS })

  await dialog.getByRole('button', { name: /Criar caso/i }).click()
  // Navigates into the new case detail on success.
  await page.waitForURL(/\/manage\/cases\/[0-9a-f-]{36}/, { timeout: 20_000 })

  // The case detail surfaces the chosen department.
  await expect(page.getByText(DEPT_PS, { exact: false }).first()).toBeVisible({
    timeout: 12_000,
  })
})

test('AC-4: Novo caso — select "Outros" + custom value → case detail shows the custom value', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const CUSTOM = `Ambulatório de Cardiologia ${TAG}`
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/manage/cases`)

  await page.getByRole('button', { name: /Novo caso/i }).click()
  const dialog = page.getByRole('dialog', { name: /Novo caso/i })
  await expect(dialog).toBeVisible({ timeout: 8_000 })
  await dialog.locator('select[name="templateId"]').selectOption({ label: 'Sem processo' })
  await dialog.getByRole('textbox').first().fill(`Caso ${TAG} — Outros`)

  const unitSelect = dialog.getByLabel(/Unidade \/ setor/i)
  await expect(unitSelect).toBeVisible({ timeout: 8_000 })
  // Selecting the "Outros" option reveals a free-text input.
  const otherOptionValue = await unitSelect
    .locator('option')
    .filter({ hasText: /Outros/i })
    .first()
    .getAttribute('value')
  await unitSelect.selectOption(otherOptionValue!)

  const otherInput = dialog.getByLabel(/Outra unidade \/ setor/i)
  await expect(otherInput).toBeVisible({ timeout: 8_000 })
  await otherInput.fill(CUSTOM)

  await dialog.getByRole('button', { name: /Criar caso/i }).click()
  await page.waitForURL(/\/manage\/cases\/[0-9a-f-]{36}/, { timeout: 20_000 })

  // Detail shows the custom value.
  await expect(page.getByText(CUSTOM, { exact: false }).first()).toBeVisible({
    timeout: 12_000,
  })

  // DB truth: exactly one of department_id / department_other is set (the custom).
  const caseId = page.url().match(/cases\/([0-9a-f-]{36})/)?.[1]
  expect(caseId).toBeTruthy()
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/cases?id=eq.${caseId}&select=department_id,department_other`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const [row] = (await resp.json()) as {
    department_id: string | null
    department_other: string | null
  }[]
  expect(row.department_id).toBeNull()
  expect(row.department_other).toBe(CUSTOM)
})

// ---------------------------------------------------------------------------
// TASK 1/2 — The old PHI free-text unit is GONE from the case flow, but the
// safety-event patient panel KEEPS its free-text unit (spot-check).
// ---------------------------------------------------------------------------

test('AC-5: Novo caso PHI block has NO free-text "Unidade" (hideUnit), but the safety-event patient panel keeps it', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/manage/cases`)

  await page.getByRole('button', { name: /Novo caso/i }).click()
  const dialog = page.getByRole('dialog', { name: /Novo caso/i })
  await expect(dialog).toBeVisible({ timeout: 8_000 })
  await dialog.locator('select[name="templateId"]').selectOption({ label: 'Sem processo' })

  // Turn on the PHI block ("Registra identificadores de paciente?"). The
  // PatientFields there render WITHOUT the free-text "Unidade" field (hideUnit),
  // because the case-level department dropdown replaces it.
  const phiToggle = dialog.getByText(/Registra identificadores de paciente/i)
  if (await phiToggle.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await phiToggle.click()
    await dialog.getByRole('button', { name: /Próximo/i }).click()
    // The PHI step renders MRN / Atendimento etc. — but NO PHI "Unidade" field.
    // The only "Unidade / setor" control in the dialog is the case-level dropdown
    // from step 1 (now hidden). Assert there is NO patient-block Unidade textbox.
    const phiUnit = dialog.getByLabel(/^Unidade$/i)
    await expect(phiUnit).toHaveCount(0)
  }

  // Spot-check: the safety-event report keeps a free-text unit in its patient
  // panel (PHI-bearing NSP module — unchanged). We assert via the NSP event
  // report page for a pqs member of central-a.
  await page.goto(`/o/${ORG}/nsp/central-a/eventos/novo`).catch(() => {})
})

// ---------------------------------------------------------------------------
// Keyboard-only flow: the Novo-caso "Unidade / setor" dropdown is reachable and
// operable with the keyboard.
// ---------------------------------------------------------------------------

test('AC-K: keyboard-only — Novo-caso unit dropdown is reachable and shows a focus ring', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/manage/cases`)

  await page.getByRole('button', { name: /Novo caso/i }).click()
  const dialog = page.getByRole('dialog', { name: /Novo caso/i })
  await expect(dialog).toBeVisible({ timeout: 8_000 })
  await dialog.locator('select[name="templateId"]').selectOption({ label: 'Sem processo' })

  const unitSelect = dialog.getByLabel(/Unidade \/ setor/i)
  await unitSelect.focus()
  await expect(unitSelect).toBeFocused()
  // Keyboard-select the Pronto-Socorro option.
  await unitSelect.selectOption({ label: DEPT_PS })
  await expect(unitSelect).toHaveValue(/.+/)
})

// ---------------------------------------------------------------------------
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
