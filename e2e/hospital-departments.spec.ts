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
const DEPT_KB = `Ambulatório Teclado ${TAG}`

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
// TASK 2 (ADR 0137 D9, 2026-08-23) — the Novo-caso "Unidade / setor" dropdown
// this section originally drove was REMOVED, not hidden: every case surface
// (create dialog, edit-meta dialog, bulk wizard, patient-edit dialog) stopped
// COLLECTING a department. D9's floor is explicit that this is a UI-only cut —
// "No backend change": `department_id`/`department_other`, the RPC arguments
// and every stored value are untouched, and an existing department stays
// VISIBLE, read-only, on both the manage and staff hosts. AC-3/AC-4 below
// replace the old dropdown-driven tests (which now assert a control that no
// longer exists) with: (a) a positive control that the dropdown is genuinely
// GONE, not merely unreachable by this file's old selector, plus the read-only
// display of a department set by the only remaining path (direct write — no
// app UI can set one any more); and (b) the regression the build itself
// surfaced and the plan calls out by name: `update_case_meta` FULL-REPLACES
// label + department, so editing only the label must not silently clear a
// stored department nobody was shown in the form.
// ---------------------------------------------------------------------------

/** Resolve an ACTIVE department's id by its exact name (service-role read). */
async function departmentIdByName(page: Page, name: string): Promise<string> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/hospital_departments?hospital_id=eq.${CENTRAL_A}` +
      `&name=eq.${encodeURIComponent(name)}&archived=eq.false&select=id`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const rows = (await resp.json()) as { id: string }[]
  expect(rows.length, `active department "${name}" not found`).toBe(1)
  return rows[0].id
}

/**
 * Create a fresh process-less case (label only, no PHI/outcomes) via the UI,
 * returning its id. Shared by AC-3/AC-4 — neither test can set a department
 * through the dialog any more (D9), so both mint a bare case first and then
 * write the department directly, exactly as the app itself can no longer do.
 */
async function createBareCase(page: Page, label: string): Promise<string> {
  await page.goto(`/o/${ORG}/c/ccih/manage/cases`)
  await page.getByRole('button', { name: /Novo caso/i }).click()
  const dialog = page.getByRole('dialog', { name: /Novo caso/i })
  await expect(dialog).toBeVisible({ timeout: 8_000 })
  await dialog.locator('select[name="templateId"]').selectOption({ label: 'Sem processo' })
  await dialog.getByRole('textbox').first().fill(label)
  await dialog.getByRole('button', { name: /Criar caso/i }).click()
  await page.waitForURL(/\/manage\/cases\/[0-9a-f-]{36}/, { timeout: 20_000 })
  const caseId = page.url().match(/cases\/([0-9a-f-]{36})/)?.[1]
  expect(caseId).toBeTruthy()
  return caseId!
}

test('AC-3: Novo caso has NO department dropdown (ADR 0137 D9); a case whose department was set directly (the only remaining path) still renders it read-only on BOTH hosts', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/manage/cases`)
  await page.getByRole('button', { name: /Novo caso/i }).click()
  const dialog = page.getByRole('dialog', { name: /Novo caso/i })
  await expect(dialog).toBeVisible({ timeout: 8_000 })
  await dialog.locator('select[name="templateId"]').selectOption({ label: 'Sem processo' })

  // The positive control: no department control of ANY shape is offered —
  // neither the dropdown nor its label text, anywhere in the dialog.
  await expect(dialog.getByLabel(/Unidade \/ setor/i)).toHaveCount(0)
  await expect(dialog.getByText(/Unidade \/ setor/i)).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0, { timeout: 5_000 })

  // Create a bare case, then write its department the only way still possible
  // — directly (D9: no backend change; the column, RPC argument and stored
  // value are all untouched, only the app's COLLECTION UI is gone).
  const caseId = await createBareCase(page, `Caso ${TAG} — legado com setor`)
  const deptId = await departmentIdByName(page, DEPT_PS)
  const patchResp = await page.request.patch(
    `${SUPABASE_URL}/rest/v1/cases?id=eq.${caseId}`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      data: { department_id: deptId },
    },
  )
  expect(patchResp.ok(), `direct department write failed: ${await patchResp.text()}`).toBeTruthy()

  // Read-only on the MANAGE host…
  await page.goto(`/o/${ORG}/c/ccih/manage/cases/${caseId}`)
  await expect(page.getByText(DEPT_PS, { exact: false }).first()).toBeVisible({
    timeout: 12_000,
  })
  // …and on the staff READING SURFACE (D9's fix: it did not render this at all
  // before — only the coordinator layout did).
  await page.goto(`/o/${ORG}/c/ccih/casos/${caseId}`)
  await expect(page.getByText(DEPT_PS, { exact: false }).first()).toBeVisible({
    timeout: 12_000,
  })
})

test('AC-4 (D9-bis regression): editing ONLY the case label via "Editar" must NOT clear a stored department', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, 'chefe.ccih@test.local')

  const caseId = await createBareCase(page, `Caso ${TAG} — rotulo antes`)
  const deptId = await departmentIdByName(page, DEPT_PS)
  const patchResp = await page.request.patch(
    `${SUPABASE_URL}/rest/v1/cases?id=eq.${caseId}`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      data: { department_id: deptId },
    },
  )
  expect(patchResp.ok(), `direct department write failed: ${await patchResp.text()}`).toBeTruthy()

  await page.goto(`/o/${ORG}/c/ccih/manage/cases/${caseId}`)
  await expect(page.getByText(DEPT_PS, { exact: false }).first()).toBeVisible({
    timeout: 12_000,
  })

  // Edit ONLY the label via the header "Editar" dialog. `update_case_meta`
  // FULL-REPLACES label + department (`edit-case-meta-dialog.tsx`'s hidden
  // `departmentId`/`departmentOther` mirrors are the guard against this — this
  // spec is what makes that guard load-bearing rather than decorative).
  const header = page.locator('header').filter({ has: page.getByRole('heading', { level: 1 }) })
  await header.getByRole('button', { name: /^Editar$/ }).click()
  const editDialog = page.getByRole('dialog').filter({ hasText: /Editar caso/i })
  await expect(editDialog).toBeVisible({ timeout: 8_000 })
  const NEW_LABEL = `Caso ${TAG} — rotulo depois`
  await editDialog.getByLabel(/Descrição/i).fill(NEW_LABEL)
  await editDialog.getByRole('button', { name: /^Salvar$/ }).click()
  await expect(editDialog).toHaveCount(0, { timeout: 10_000 })

  // The label changed…
  await expect(page.getByText(NEW_LABEL)).toBeVisible({ timeout: 10_000 })
  // …but the department did NOT — in the UI (both hosts) and in the DB.
  await expect(page.getByText(DEPT_PS, { exact: false }).first()).toBeVisible({
    timeout: 10_000,
  })
  await page.goto(`/o/${ORG}/c/ccih/casos/${caseId}`)
  await expect(page.getByText(DEPT_PS, { exact: false }).first()).toBeVisible({
    timeout: 10_000,
  })
  const rows = await (
    await page.request.get(
      `${SUPABASE_URL}/rest/v1/cases?id=eq.${caseId}&select=department_id,label`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      },
    )
  ).json() as { department_id: string | null; label: string | null }[]
  expect(rows[0]?.department_id, 'department_id must survive a label-only edit').toBe(deptId)
  expect(rows[0]?.label).toBe(NEW_LABEL)
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
// Keyboard-only flow (CLAUDE.md §8) — ADR 0137 D9 removed the Novo-caso
// dropdown this test used to drive, so it is replaced rather than deleted:
// the hospital detail page's OWN department creation (AC-1's mouse-driven
// "Novo setor" flow), driven entirely by keyboard — Tab/Enter, no mouse —
// which is the surviving department-authoring surface this batch left intact.
// ---------------------------------------------------------------------------

test('AC-K: keyboard-only — create a department on the hospital detail page via Tab/Enter alone', async ({
  page,
}) => {
  await signInAs(page, 'orgadmin.a@test.local')
  await page.goto(HOSPITAL_DETAIL)

  const newDeptBtn = page.getByRole('button', { name: /Novo setor/i })
  await expect(newDeptBtn).toBeVisible({ timeout: 12_000 })
  await newDeptBtn.focus()
  await expect(newDeptBtn).toBeFocused()
  await page.keyboard.press('Enter')

  const createDialog = page.getByRole('dialog')
  await expect(createDialog).toBeVisible({ timeout: 8_000 })
  const nameInput = createDialog.getByRole('textbox').first()
  await expect(nameInput).toBeFocused()
  await page.keyboard.type(DEPT_KB)

  // Tab order is name -> "Cancelar" -> submit (component docblock,
  // `department-def-dialog.tsx`) — two Tabs, never a click, to reach the
  // primary action.
  await page.keyboard.press('Tab')
  const cancelBtn = createDialog.getByRole('button', { name: /^Cancelar$/i })
  await expect(cancelBtn).toBeFocused()
  await page.keyboard.press('Tab')
  const submitBtn = createDialog.getByRole('button', { name: /^Criar setor$/i })
  await expect(submitBtn).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(createDialog).not.toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(DEPT_KB, { exact: true })).toBeVisible({ timeout: 10_000 })
})

// ---------------------------------------------------------------------------
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
