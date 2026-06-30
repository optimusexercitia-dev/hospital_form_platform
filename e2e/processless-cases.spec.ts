import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

/**
 * "Sem processo" (process-less) case creation — flag `processless_cases`.
 *
 * Test contract (from the approved plan
 * `~/.claude/plans/buzzing-wandering-hedgehog.md §Verification` + the locked
 * decisions). A coordinator (staff_admin) can open a template-less case via the
 * existing "Novo caso" dialog by picking the top "Sem processo" option, which
 * switches the dialog into a two-step wizard:
 *
 *   1. Sem processo → label only, PHI off, no outcomes → "Criar caso" → lands on
 *      the detail page with the muted "Sem processo" badge and zero phases.
 *   2. "Emite desfecho?" ON → multiselect (incl. inline "Criar novo desfecho") →
 *      conclude blocked (HC028) until an outcome is chosen, then concludes.
 *   3. PHI ON → "Próximo" → step 2 shows the PHI fields + warning + "Voltar" →
 *      fill name/MRN → "Criar caso" → the patient panel reveals the identifiers.
 *   4. PHI ON, step-2 left blank → "Criar caso" succeeds, the case is PHI-capable
 *      (panel present), but NO case_patient row until added later.
 *   5. Detail offered-outcomes editor: removing the currently-assigned outcome is
 *      rejected with the pt-BR HC029 message; a normal edit succeeds.
 *   6. Add an ad-hoc phase to a process-less case, then conclude it.
 *   7. A plain staff user cannot reach the process-less create flow (the manage
 *      board is `notFound` for non-coordinators).
 *   + a keyboard-only flow (the §6 per-phase requirement).
 *
 * Backend RPCs under test: create_case(commission, label, patient_enabled,
 * outcome_ids[]) + set_case_offered_outcomes(case, outcome_ids[]). Error codes:
 * HC028 (offered set non-empty + no outcome chosen at close), HC029 (cannot drop
 * the assigned outcome), HC030 (cross-commission/archived), HC025 (terminal),
 * 42501 (non-coordinator), check_violation (flag off / set_case_patient when
 * patient_enabled=false).
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin, commission CCIH (coordinator)
 *   staff1.ccih@test.local  staff, commission CCIH
 *
 * Flags `processless_cases` / `cases_extras` / `case_patient` ship ON in the
 * local seed (migration 20260624130000 + 20260630000006). Run with --workers=1
 * after `supabase db reset --local`.
 */

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

const COMM_CCIH_ID = 'a0000000-0000-0000-0000-0000000000a1'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 })
}

/** Service-role GET against PostgREST. */
async function restGet<T>(req: APIRequestContext, path: string): Promise<T[]> {
  const resp = await req.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

/** The case id from the post-create navigation target (.../manage/cases/<uuid>). */
function caseIdFromUrl(page: Page): string {
  const id = page.url().split('?')[0].split('/').pop() ?? ''
  expect(id).toMatch(/^[0-9a-f-]{36}$/i)
  return id
}

/** Open the "Novo caso" dialog and select the "Sem processo" sentinel option. */
async function openProcesslessDialog(page: Page) {
  await page.goto('/o/rede-a/c/ccih/manage/cases')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/cases', { timeout: 15_000 })
  await page.waitForLoadState('networkidle', { timeout: 15_000 })

  const novoCasoBtn = page.getByRole('button', { name: /novo caso/i })
  await expect(novoCasoBtn).toBeVisible({ timeout: 15_000 })
  await novoCasoBtn.click()

  const dialog = page.getByRole('dialog').filter({ hasText: /Novo caso/i })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  // The top sentinel option switches the dialog into the process-less wizard.
  await dialog.locator('select[name="templateId"]').selectOption({ value: '__processless__' })
  return dialog
}

// ===========================================================================
// Scenario 1 — Sem processo, label only, PHI off, no outcomes → "Criar caso"
// → detail page with the "Sem processo" badge and zero phases.
// ===========================================================================

test('S1: Sem processo label-only → creates a template-less case with the "Sem processo" badge and zero phases', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)

  await signInAs(page, 'chefe.ccih@test.local')
  const dialog = await openProcesslessDialog(page)

  const label = `Sem processo S1 ${Date.now()}`
  await dialog.getByLabel(/Rótulo/i).fill(label)

  // PHI off + no outcomes → the primary submits directly ("Criar caso").
  await dialog.getByRole('button', { name: /^Criar caso$/i }).click()

  // Lands on the case detail page.
  await page.waitForURL(/\/c\/ccih\/manage\/cases\/[0-9a-f-]{36}/i, { timeout: 20_000 })
  const caseId = caseIdFromUrl(page)
  await page.waitForLoadState('networkidle', { timeout: 15_000 })

  // The muted "Sem processo" badge is shown in the header.
  await expect(page.getByText('Sem processo').first()).toBeVisible({ timeout: 10_000 })

  // DB truth: template_id NULL, status nao_iniciado, zero phases.
  const caseRows = await restGet<{ template_id: string | null; status: string }>(
    request,
    `cases?id=eq.${caseId}&select=template_id,status`,
  )
  expect(caseRows[0]?.template_id).toBeNull()
  expect(caseRows[0]?.status).toBe('nao_iniciado')

  const phaseRows = await restGet<{ id: string }>(
    request,
    `case_phases?case_id=eq.${caseId}&select=id`,
  )
  expect(phaseRows.length).toBe(0)
})

// ===========================================================================
// Scenario 2 — "Emite desfecho?" ON → multiselect (incl. inline "Criar novo
// desfecho") → conclude blocked (HC028) until an outcome is chosen, then
// concludes.
// ===========================================================================

test('S2: emite desfecho ON (with inline new outcome) → conclude blocked until an outcome is chosen, then concludes', async ({
  page,
  request,
}) => {
  test.setTimeout(150_000)

  await signInAs(page, 'chefe.ccih@test.local')
  const dialog = await openProcesslessDialog(page)

  await dialog.getByLabel(/Rótulo/i).fill(`Sem processo S2 ${Date.now()}`)

  // Turn on the outcome sub-step.
  await dialog.getByRole('checkbox', { name: /Emite desfecho\?/i }).click()

  // Inline "Criar novo desfecho" → OutcomeDefDialog → create a fresh outcome.
  const newOutcome = `Desfecho S2 ${Date.now()}`
  await dialog.getByRole('button', { name: /Criar novo desfecho/i }).click()
  // Scope to the INNER OutcomeDefDialog by its exact heading. A `hasText`
  // substring filter is ambiguous: the outer "Novo caso" dialog also contains the
  // text "Criar novo desfecho" (the trigger button), so it matches /Novo desfecho/
  // and `toHaveCount(0)` could never fire while the outer dialog stays open. The
  // outer dialog's title is "Novo caso" and has no "Novo desfecho" HEADING.
  const outcomeDialog = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('heading', { name: 'Novo desfecho' }) })
  await expect(outcomeDialog).toBeVisible({ timeout: 10_000 })
  await outcomeDialog.getByLabel(/Nome/i).fill(newOutcome)
  await outcomeDialog.getByRole('button', { name: /^Criar desfecho$/i }).click()
  await expect(outcomeDialog).toHaveCount(0, { timeout: 15_000 })

  // The new outcome appears in the multiselect — check it. (A route refresh on
  // close re-fetches the vocabulary, so the row is present.)
  const outcomeRow = dialog.getByText(newOutcome, { exact: true })
  await expect(outcomeRow).toBeVisible({ timeout: 10_000 })
  await dialog.locator('label').filter({ hasText: newOutcome }).getByRole('checkbox').check()

  await dialog.getByRole('button', { name: /^Criar caso$/i }).click()
  await page.waitForURL(/\/c\/ccih\/manage\/cases\/[0-9a-f-]{36}/i, { timeout: 20_000 })
  const caseId = caseIdFromUrl(page)
  await page.waitForLoadState('networkidle', { timeout: 15_000 })

  // The offered set landed (one row) — a non-empty set means an outcome is
  // required at conclusion.
  const offered = await restGet<{ outcome_id: string }>(
    request,
    `case_offered_outcomes?case_id=eq.${caseId}&select=outcome_id`,
  )
  expect(offered.length).toBe(1)

  // Open the "Concluir" dialog (header lifecycle button). The confirm is disabled
  // with no outcome chosen (the client gate mirrors the HC028 server gate).
  const concludeBtn = page.locator('header').getByRole('button', { name: /^Concluir$/i })
  await expect(concludeBtn).toBeVisible({ timeout: 10_000 })
  await concludeBtn.click()

  const concludeDialog = page.getByRole('dialog').filter({ hasText: /Concluir o caso/i })
  await expect(concludeDialog).toBeVisible({ timeout: 10_000 })
  const confirmBtn = concludeDialog.getByRole('button', { name: /Concluir caso/i })
  await expect(confirmBtn).toBeDisabled({ timeout: 5_000 })

  // Pick the outcome → the confirm enables → conclude.
  const outcomeSelect = concludeDialog.locator('select')
  await expect(outcomeSelect).toBeVisible({ timeout: 5_000 })
  await outcomeSelect.selectOption({ value: offered[0].outcome_id })
  await expect(confirmBtn).toBeEnabled({ timeout: 5_000 })
  await confirmBtn.click()
  await expect(concludeDialog).toHaveCount(0, { timeout: 15_000 })

  // DB truth: concluido + the chosen outcome stored.
  await expect
    .poll(
      async () =>
        (await restGet<{ status: string }>(request, `cases?id=eq.${caseId}&select=status`))[0]
          ?.status,
      { timeout: 15_000 },
    )
    .toBe('concluido')
  const finalRow = (
    await restGet<{ outcome_id: string | null }>(request, `cases?id=eq.${caseId}&select=outcome_id`)
  )[0]
  expect(finalRow?.outcome_id).toBe(offered[0].outcome_id)
})

// ===========================================================================
// Scenario 3 — PHI ON → "Próximo" → step 2 shows the PHI fields + warning +
// "Voltar" → fill name/MRN → "Criar caso" → the patient panel reveals the
// identifiers.
//
// NOTE: this is the regression coverage for BUG-PL-001 — "Próximo" currently
// submits the form (mints the case) and navigates instead of advancing to
// step 2, so the step-2 PHI fields are never reachable through the UI and the
// PHI the coordinator intended to type is silently lost. This test asserts the
// locked-decision contract (step 2 must appear) and FAILS until the dialog is
// fixed.
// ===========================================================================

test('S3: PHI ON → Próximo → step 2 PHI fields + warning + Voltar → fill name/MRN → panel reveals them', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000)

  const PHI_NAME = `Paciente PL S3 ${Date.now()}`
  const PHI_MRN = `PRT-PL-S3-${Date.now()}`

  await signInAs(page, 'chefe.ccih@test.local')
  const dialog = await openProcesslessDialog(page)

  await dialog.getByLabel(/Rótulo/i).fill(`Sem processo S3 ${Date.now()}`)

  // Turn on the PHI toggle → the primary becomes "Próximo".
  await dialog.getByRole('checkbox', { name: /Registra identificadores de paciente\?/i }).click()
  const nextBtn = dialog.getByRole('button', { name: /^Próximo$/i })
  await expect(nextBtn).toBeVisible({ timeout: 5_000 })
  await nextBtn.click()

  // Step 2: the prominent PHI warning + the 8-field block + "Voltar" are present.
  await expect(dialog.getByText(/Dados sensíveis de paciente \(PHI\)/i)).toBeVisible({
    timeout: 10_000,
  })
  await expect(dialog.getByRole('button', { name: /^Voltar$/i })).toBeVisible({ timeout: 5_000 })
  const phiBlock = dialog.locator('[id^="create-case-processless-patient"]').first()
  await expect(phiBlock).toBeVisible({ timeout: 5_000 })

  // "Voltar" returns to step 1 (the toggle + label are visible again), then forward.
  await dialog.getByRole('button', { name: /^Voltar$/i }).click()
  await expect(dialog.getByLabel(/Rótulo/i)).toBeVisible({ timeout: 5_000 })
  await dialog.getByRole('button', { name: /^Próximo$/i }).click()

  // Fill name + MRN on step 2.
  await dialog.getByLabel(/^Nome$/i).fill(PHI_NAME)
  await dialog.getByLabel(/^Prontuário$/i).fill(PHI_MRN)

  await dialog.getByRole('button', { name: /^Criar caso$/i }).click()
  await page.waitForURL(/\/c\/ccih\/manage\/cases\/[0-9a-f-]{36}/i, { timeout: 20_000 })
  const caseId = caseIdFromUrl(page)
  await page.waitForLoadState('networkidle', { timeout: 15_000 })

  // The patient panel is in its PROTECTED (has_patient=true) state, not the empty
  // placeholder; reveal shows the entered identifiers.
  await expect(
    page.getByRole('heading', { name: /Identificação do paciente/i }),
  ).toBeVisible({ timeout: 10_000 })
  await expect(
    page.getByText(/Nenhum dado de paciente registrado neste caso/i),
  ).toHaveCount(0)

  const revealBtn = page.getByRole('button', { name: /exibir identificação/i })
  await expect(revealBtn).toBeVisible({ timeout: 10_000 })
  await revealBtn.click()
  await expect(page.getByText(PHI_NAME)).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(PHI_MRN)).toBeVisible({ timeout: 8_000 })

  // DB truth: PHI landed atomically with creation.
  const caseRows = await restGet<{ has_patient: boolean; patient_enabled: boolean }>(
    request,
    `cases?id=eq.${caseId}&select=has_patient,patient_enabled`,
  )
  expect(caseRows[0]?.patient_enabled).toBe(true)
  expect(caseRows[0]?.has_patient).toBe(true)
  const cpRows = await restGet<{ mrn: string | null }>(
    request,
    `case_patient?case_id=eq.${caseId}&select=mrn`,
  )
  expect(cpRows.length).toBe(1)
  expect(cpRows[0]?.mrn).toBe(PHI_MRN)
})

// ===========================================================================
// Scenario 4 — PHI ON, step-2 left blank → "Criar caso" succeeds; the case is
// PHI-capable (panel present), but NO case_patient row until added later.
//
// NOTE: also blocked by BUG-PL-001 — reaching step 2 to press "Criar caso"
// there requires the "Próximo" advance that is currently broken. The DB-truth
// assertions (patient_enabled true / has_patient false / no case_patient row)
// are the contract this should satisfy once step 2 is reachable.
// ===========================================================================

test('S4: PHI ON + step-2 blank → case is PHI-capable (panel present) with NO case_patient row', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)

  await signInAs(page, 'chefe.ccih@test.local')
  const dialog = await openProcesslessDialog(page)

  await dialog.getByLabel(/Rótulo/i).fill(`Sem processo S4 ${Date.now()}`)
  await dialog.getByRole('checkbox', { name: /Registra identificadores de paciente\?/i }).click()
  await dialog.getByRole('button', { name: /^Próximo$/i }).click()

  // Leave the PHI block blank → "Criar caso".
  await expect(dialog.locator('[id^="create-case-processless-patient"]').first()).toBeVisible({
    timeout: 10_000,
  })
  await dialog.getByRole('button', { name: /^Criar caso$/i }).click()

  await page.waitForURL(/\/c\/ccih\/manage\/cases\/[0-9a-f-]{36}/i, { timeout: 20_000 })
  const caseId = caseIdFromUrl(page)
  await page.waitForLoadState('networkidle', { timeout: 15_000 })

  // The panel renders (PHI-capable) but in its EMPTY state (no identifiers yet).
  await expect(
    page.getByRole('heading', { name: /Identificação do paciente/i }),
  ).toBeVisible({ timeout: 10_000 })

  // DB truth: patient_enabled true, has_patient false, NO case_patient row.
  const caseRows = await restGet<{ has_patient: boolean; patient_enabled: boolean }>(
    request,
    `cases?id=eq.${caseId}&select=has_patient,patient_enabled`,
  )
  expect(caseRows[0]?.patient_enabled).toBe(true)
  expect(caseRows[0]?.has_patient).toBe(false)
  const cpRows = await restGet<{ case_id: string }>(
    request,
    `case_patient?case_id=eq.${caseId}&select=case_id`,
  )
  expect(cpRows.length).toBe(0)
})

// ===========================================================================
// Scenario 5 — Detail offered-outcomes editor: removing the currently-assigned
// outcome is rejected with the pt-BR HC029 message; a normal edit succeeds.
// ===========================================================================

test('S5: offered-outcomes editor — dropping the assigned outcome shows the HC029 pt-BR message; a normal edit saves', async ({
  page,
  request,
}) => {
  test.setTimeout(150_000)

  // Build a process-less case offering TWO outcomes via the create dialog, so the
  // detail editor has a real offered set + a vocabulary with ≥2 entries to toggle.
  await signInAs(page, 'chefe.ccih@test.local')
  const dialog = await openProcesslessDialog(page)
  await dialog.getByLabel(/Rótulo/i).fill(`Sem processo S5 ${Date.now()}`)
  await dialog.getByRole('checkbox', { name: /Emite desfecho\?/i }).click()

  // Pick the first TWO outcomes from the commission vocabulary (seeded CCIH has ≥3).
  const checkboxes = dialog.locator('label').filter({ has: page.getByRole('checkbox') })
  // The "Emite desfecho?" toggle is itself a checkbox-label; scope to the
  // multiselect list rows (they carry an outcome badge). Use the OutcomeMultiselect
  // rows: each <li><label><checkbox/><badge/></label>.
  const optionLabels = dialog.locator('ul li label')
  await expect(optionLabels.first()).toBeVisible({ timeout: 10_000 })
  const optCount = await optionLabels.count()
  expect(optCount).toBeGreaterThanOrEqual(2)
  await optionLabels.nth(0).getByRole('checkbox').check()
  await optionLabels.nth(1).getByRole('checkbox').check()

  await dialog.getByRole('button', { name: /^Criar caso$/i }).click()
  await page.waitForURL(/\/c\/ccih\/manage\/cases\/[0-9a-f-]{36}/i, { timeout: 20_000 })
  const caseId = caseIdFromUrl(page)
  await page.waitForLoadState('networkidle', { timeout: 15_000 })

  // The case offers two outcomes; resolve them + assign the FIRST one via the
  // detail outcome selector so the HC029 edge has an assigned outcome to protect.
  const offered = await restGet<{ outcome_id: string }>(
    request,
    `case_offered_outcomes?case_id=eq.${caseId}&select=outcome_id`,
  )
  expect(offered.length).toBe(2)

  // Resolve the assigned outcome's exact label from the DB (deterministic) — the
  // multiselect row's innerText also carries per-row advisory markers ("Plano de
  // ação" / "Adverso"), so scraping the row would not match the detail <select>
  // option label.
  const assignedId = offered[0].outcome_id
  const assignedLabel = (
    await restGet<{ label: string }>(
      request,
      `case_outcomes?id=eq.${assignedId}&select=label`,
    )
  )[0]?.label
  expect(assignedLabel).toBeTruthy()
  if (!assignedLabel) throw new Error('assigned outcome label not resolved')

  // Assign an outcome via the detail "Desfecho do caso" selector. The <select>
  // options carry the outcome UUID as their value, so select by VALUE.
  const outcomeSection = page.getByRole('region', { name: 'Desfecho do caso' })
  await expect(outcomeSection).toBeVisible({ timeout: 10_000 })
  const selector = outcomeSection.locator('select')
  await selector.selectOption(assignedId)
  await expect
    .poll(
      async () =>
        (await restGet<{ outcome_id: string | null }>(
          request,
          `cases?id=eq.${caseId}&select=outcome_id`,
        ))[0]?.outcome_id,
      { timeout: 15_000 },
    )
    .toBe(assignedId)

  // ── Open the offered-outcomes editor → uncheck the ASSIGNED outcome → save →
  //    HC029 pt-BR message surfaces inline (no removal). ──
  await page.getByRole('button', { name: /Editar desfechos disponíveis/i }).click()
  const editorDialog = page.getByRole('dialog').filter({ hasText: /Desfechos disponíveis/i })
  await expect(editorDialog).toBeVisible({ timeout: 10_000 })

  // Uncheck the row whose label matches the assigned (first) outcome. The row's
  // checkbox carries the full row text as its ACCESSIBLE NAME (label + the per-row
  // "Plano de ação"/"Adverso" markers), e.g. "Óbito evitável Plano de ação
  // Adverso". The seeded CCIH vocabulary has a substring collision
  // ("Óbito evitável" ⊂ "Óbito não evitável"), so anchor the name at the START and
  // require a word boundary after the label (`^label(\s|$)`): "Óbito não evitável
  // Adverso" does NOT start with "Óbito evitável", so the match is unambiguous.
  const assignedCheckbox = editorDialog.getByRole('checkbox', {
    name: new RegExp(`^${assignedLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`),
  })
  await assignedCheckbox.uncheck()
  await editorDialog.getByRole('button', { name: /^Salvar$/i }).click()

  // The HC029 pt-BR message: "…altere o desfecho do caso antes…".
  await expect(editorDialog.getByText(/altere o desfecho do caso antes/i)).toBeVisible({
    timeout: 10_000,
  })

  // DB truth: nothing was removed (still two offered rows).
  expect(
    (await restGet<{ outcome_id: string }>(
      request,
      `case_offered_outcomes?case_id=eq.${caseId}&select=outcome_id`,
    )).length,
  ).toBe(2)

  // ── A NORMAL edit succeeds: re-check the assigned row (restore), add nothing to
  //    remove the conflict, then SAVE the SAME set → saves cleanly. ──
  await assignedCheckbox.check()
  await editorDialog.getByRole('button', { name: /^Salvar$/i }).click()
  await expect(editorDialog).toHaveCount(0, { timeout: 15_000 })

  // Still two offered rows (a clean, valid save).
  expect(
    (await restGet<{ outcome_id: string }>(
      request,
      `case_offered_outcomes?case_id=eq.${caseId}&select=outcome_id`,
    )).length,
  ).toBe(2)
})

// ===========================================================================
// Scenario 6 — Add an ad-hoc phase to a process-less case, then conclude it.
// ===========================================================================

test('S6: add an ad-hoc phase to a process-less case, then conclude it', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000)

  await signInAs(page, 'chefe.ccih@test.local')
  const dialog = await openProcesslessDialog(page)
  await dialog.getByLabel(/Rótulo/i).fill(`Sem processo S6 ${Date.now()}`)
  await dialog.getByRole('button', { name: /^Criar caso$/i }).click()
  await page.waitForURL(/\/c\/ccih\/manage\/cases\/[0-9a-f-]{36}/i, { timeout: 20_000 })
  const caseId = caseIdFromUrl(page)
  await page.waitForLoadState('networkidle', { timeout: 15_000 })

  // Add an ad-hoc phase via the header "Adicionar fase" action.
  const addPhaseBtn = page.locator('header').getByRole('button', { name: /Adicionar fase/i })
  await expect(addPhaseBtn).toBeVisible({ timeout: 10_000 })
  await addPhaseBtn.click()

  const addPhaseDialog = page.getByRole('dialog').filter({ hasText: /Adicionar fase ao caso/i })
  await expect(addPhaseDialog).toBeVisible({ timeout: 10_000 })
  await addPhaseDialog
    .locator('select[name="formId"]')
    .selectOption({ label: 'Checklist de Higienização das Mãos' })
  await addPhaseDialog.locator('input[name="title"]').fill('Fase avulsa S6')
  await addPhaseDialog.getByRole('button', { name: /^Adicionar fase$/i }).click()
  await expect(addPhaseDialog).toHaveCount(0, { timeout: 15_000 })

  // DB truth: exactly one phase now exists.
  await expect
    .poll(
      async () =>
        (await restGet<{ id: string }>(request, `case_phases?case_id=eq.${caseId}&select=id`))
          .length,
      { timeout: 15_000 },
    )
    .toBe(1)

  // Settle the phase via the service-role skip_phase so the close gate (HC031)
  // passes, then conclude through the UI (the case offers no outcomes → no HC028).
  const phase = (
    await restGet<{ id: string }>(request, `case_phases?case_id=eq.${caseId}&select=id`)
  )[0]
  const skipResp = await request.post(`${SUPABASE_URL}/rest/v1/rpc/skip_phase`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    data: { p_case_phase_id: phase.id },
  })
  expect(skipResp.ok()).toBeTruthy()

  await page.reload()
  await page.waitForLoadState('networkidle', { timeout: 15_000 })

  const concludeBtn = page.locator('header').getByRole('button', { name: /^Concluir$/i })
  await expect(concludeBtn).toBeVisible({ timeout: 10_000 })
  await concludeBtn.click()
  const concludeDialog = page.getByRole('dialog').filter({ hasText: /Concluir o caso/i })
  await expect(concludeDialog).toBeVisible({ timeout: 10_000 })
  // No offered outcomes → no selector → confirm immediately enabled.
  const confirmBtn = concludeDialog.getByRole('button', { name: /Concluir caso/i })
  await expect(confirmBtn).toBeEnabled({ timeout: 5_000 })
  await confirmBtn.click()
  await expect(concludeDialog).toHaveCount(0, { timeout: 15_000 })

  await expect
    .poll(
      async () =>
        (await restGet<{ status: string }>(request, `cases?id=eq.${caseId}&select=status`))[0]
          ?.status,
      { timeout: 15_000 },
    )
    .toBe('concluido')
})

// ===========================================================================
// Scenario 7 — A plain staff user cannot reach the process-less create flow
// (the manage board is `notFound` for non-coordinators).
// ===========================================================================

test('S7: a plain staff user gets notFound on the manage cases board (no process-less create flow)', async ({
  page,
}) => {
  test.setTimeout(60_000)

  await signInAs(page, 'staff1.ccih@test.local')

  // Next.js notFound() renders the not-found UI (HTTP 200, server-rendered), so
  // assert on the not-found heading, not the status code.
  await page.goto('/o/rede-a/c/ccih/manage/cases')
  await expect(
    page.getByRole('heading', { name: /Não encontramos esta página/i }),
  ).toBeVisible({ timeout: 15_000 })

  // The coordinator board chrome (and the "Novo caso" create button) is never
  // shown to a plain staff member — no data leak.
  await expect(page.getByRole('button', { name: /novo caso/i })).toHaveCount(0)
  await expect(page.getByText(/Caso 0001/i)).toHaveCount(0)
})

// ===========================================================================
// Keyboard-only flow (§6 per-phase requirement) — drive the process-less wizard
// with the keyboard only: focus + type the label, focus + Space the PHI toggle,
// focus + Enter "Próximo", then assert step 2 (the PHI fields) appears.
//
// NOTE: the step-2 assertion is also the keyboard regression for BUG-PL-001 —
// the keyboard "Próximo" submits-and-navigates today, so step 2 never shows.
// The keyboard reachability + activation of the controls (label, toggle,
// "Próximo") is exercised up to that point.
// ===========================================================================

test('S-K: keyboard-only — type the label, toggle PHI, and advance to step 2 via the keyboard', async ({
  page,
}) => {
  test.setTimeout(90_000)

  await signInAs(page, 'chefe.ccih@test.local')
  const dialog = await openProcesslessDialog(page)

  // Type the label by focusing the field via the keyboard.
  const labelInput = dialog.getByLabel(/Rótulo/i)
  await labelInput.focus()
  await expect(labelInput).toBeFocused()
  await page.keyboard.type(`Sem processo SK ${Date.now()}`)

  // Focus + activate the PHI toggle with the keyboard (Space toggles a checkbox).
  const phiToggle = dialog.getByRole('checkbox', {
    name: /Registra identificadores de paciente\?/i,
  })
  await phiToggle.focus()
  await expect(phiToggle).toBeFocused()
  await page.keyboard.press('Space')

  // The primary becomes "Próximo" once PHI is on; focus + activate it with Enter.
  const nextBtn = dialog.getByRole('button', { name: /^Próximo$/i })
  await expect(nextBtn).toBeVisible({ timeout: 5_000 })
  await nextBtn.focus()
  await expect(nextBtn).toBeFocused()
  await page.keyboard.press('Enter')

  // Step 2: the PHI block + the prominent PHI warning are reachable (the locked
  // two-step wizard). Blocked by BUG-PL-001 today.
  await expect(dialog.getByText(/Dados sensíveis de paciente \(PHI\)/i)).toBeVisible({
    timeout: 10_000,
  })
})
