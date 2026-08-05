import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"
import { createDraftTemplateDirect } from './helpers/process-templates'

/**
 * Case Custom Fields — template-defined, NON-PHI administrative descriptor
 * fields (ADR 0083). Flag `case_custom_fields` (confirmed ON for this run).
 *
 * Acceptance criteria under test (each an ADR decision):
 *   AC-1  D6  "Novo caso" reveals the custom-field block for a template that
 *             defines fields; values submit atomically with case creation and
 *             render on the new case's detail.
 *   AC-2  D6  A REQUIRED field left blank blocks the create submit; filling it
 *             unblocks/creates.
 *   AC-3  D4  The fill-time non-PHI/administrative warning is shown.
 *   AC-4  D8  Case detail displays the frozen values (declaration number +
 *             the dropdown's resolved option LABEL, not its code).
 *   AC-5  D7  staff_admin edits values from the case detail; changes persist
 *             after reload (own case — never mutates the shared seed AC-4
 *             reads, so the file stays rerun-safe under fullyParallel).
 *   AC-6  D8  `show_in_list` fields surface as a cases-list column + fold
 *             into search.
 *   AC-7  D9  A process-less case shows NO custom-field block.
 *   AC-8  D5  BEST EFFORT — a staff_admin can add a custom-field def to a
 *             DRAFT template in the builder (CustomFieldsCard + slot dialog).
 *
 * Seeded fixtures (supabase/seed.sql, commission A / CCIH, deterministic ids):
 *   Template  d0cf0000-…-f1  "Descritores de Óbito (Campos Personalizados)"
 *             (status=active) — a DEDICATED template kept separate from M&M
 *             so its REQUIRED field never affects other case-creation specs.
 *   Def 1     numero_declaracao_obito — short_text, REQUIRED, show_in_list.
 *   Def 2     turno_obito — dropdown [manha|tarde|noite], show_in_list.
 *   Case      d0cf0000-…-c1  "Óbito enfermaria leito 3" — values
 *             numero_declaracao_obito='DO-2026-0142', turno_obito='manha'.
 *             READ-ONLY in this file (AC-4/AC-6 only read it); AC-5 creates
 *             and mutates its OWN case instead.
 *
 * Persona (password Test1234!): chefe.ccih@test.local — staff_admin of CCIH,
 * owns the template + the seeded case; can create cases, view/edit detail,
 * and author template fields.
 *
 * fullyParallel is ON — every test here is self-contained (own case or
 * read-only) so no test.describe.serial is needed except AC-8's isolated
 * draft-template lifecycle (its own nested describe).
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

const CHEFE_CCIH = 'chefe.ccih@test.local'
const COMM_A = 'a0000000-0000-0000-0000-0000000000a1' // CCIH
const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002'

const TEMPLATE_CF_ID = 'd0cf0000-0000-0000-0000-0000000000f1'
const SEEDED_CASE_ID = 'd0cf0000-0000-0000-0000-0000000000c1'
const SEEDED_CASE_LABEL = 'Óbito enfermaria leito 3'
const SEEDED_DECL_NUMBER = 'DO-2026-0142'
const SEEDED_TURNO_LABEL = 'Manhã' // resolved option label for the frozen code 'manha'

const PROCESSLESS_SENTINEL = '__processless__'

const DECL_LABEL = 'Número da Declaração de Óbito'
const TURNO_LABEL = 'Turno do óbito'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, password)
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

/** Open "Novo caso" from the CCIH cases board. Template choice is the caller's job. */
async function openNovoCasoDialog(page: Page) {
  await page.goto('/o/rede-a/c/ccih/manage/cases')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/cases', { timeout: 15_000 })
  await page.waitForLoadState('networkidle', { timeout: 15_000 })

  const novoCasoBtn = page.getByRole('button', { name: /novo caso/i })
  await expect(novoCasoBtn).toBeVisible({ timeout: 15_000 })
  await novoCasoBtn.click()

  const dialog = page.getByRole('dialog').filter({ hasText: /Novo caso/i })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  return dialog
}

/** Region locator for the case-detail "Campos personalizados" panel. */
function customFieldsRegion(page: Page) {
  return page.getByRole('region', { name: /campos personalizados/i })
}

// ===========================================================================
// AC-1 — Create-dialog reveal + atomic capture (D6). Keyboard-only fill of
// the two new custom-field controls (the §8 per-feature keyboard mandate) —
// template selection via selectOption is scaffolding, same convention as
// phase7-cases.spec.ts's AC-Keyboard ("focus is the keyboard-accessible step
// for a native <select>; OS-level arrow semantics vary").
// ===========================================================================

test('AC-1: "Novo caso" reveals the custom-field block for the CF template; keyboard-filled values land on the new case detail', async ({
  page,
}) => {
  test.setTimeout(90_000)

  await signInAs(page, CHEFE_CCIH)
  const dialog = await openNovoCasoDialog(page)

  await dialog.locator('select[name="templateId"]').selectOption({ value: TEMPLATE_CF_ID })

  const declInput = dialog.locator('#create-case-custom-numero_declaracao_obito')
  const turnoSelect = dialog.locator('#create-case-custom-turno_obito')
  await expect(declInput).toBeVisible({ timeout: 8_000 })
  await expect(turnoSelect).toBeVisible({ timeout: 8_000 })
  await expect(dialog.getByText(DECL_LABEL)).toBeVisible()
  await expect(dialog.getByText(TURNO_LABEL)).toBeVisible()

  await dialog.getByLabel(/Rótulo/i).fill(`AC-1 custom fields ${Date.now()}`)

  const declValue = `DO-E2E-AC1-${Date.now()}`

  // Keyboard-only: focus + type into the required short_text control.
  await declInput.focus()
  await expect(declInput).toBeFocused()
  await page.keyboard.type(declValue)

  // Keyboard-only: focus the native select, then choose (focus is the
  // keyboard-accessible step for a native <select> — see helper doc above).
  await turnoSelect.focus()
  await expect(turnoSelect).toBeFocused()
  await turnoSelect.selectOption({ label: 'Tarde' })

  const submitBtn = dialog.getByRole('button', { name: /^Criar caso$/i })
  await expect(submitBtn).toBeEnabled({ timeout: 5_000 })
  await submitBtn.focus()
  await expect(submitBtn).toBeFocused()
  await page.keyboard.press('Enter')

  await page.waitForURL(/\/c\/ccih\/manage\/cases\/[0-9a-f-]{36}/i, { timeout: 20_000 })
  const caseId = caseIdFromUrl(page)

  const region = customFieldsRegion(page)
  await expect(region).toBeVisible({ timeout: 10_000 })
  await expect(region.getByText(declValue)).toBeVisible({ timeout: 10_000 })
  await expect(region.getByText('Tarde')).toBeVisible({ timeout: 5_000 })

  // DB truth — the frozen value rows hold the EXACT typed value (not merely
  // "something rendered"); the dropdown stores the option CODE, not its label.
  const rows = await restGet<{ key: string; value: unknown }>(
    page.request,
    `case_custom_field_values?case_id=eq.${caseId}&select=key,value&order=position.asc`,
  )
  expect(rows).toHaveLength(2)
  expect(rows.find((r) => r.key === 'numero_declaracao_obito')?.value).toBe(declValue)
  expect(rows.find((r) => r.key === 'turno_obito')?.value).toBe('tarde')
})

// ===========================================================================
// AC-2 — A required field left blank blocks creation; filling it unblocks
// and the case is created (D6, mirrors the outcomeBlocked submit gate).
// ===========================================================================

test('AC-2: required "Número da Declaração de Óbito" blocks case creation until filled', async ({
  page,
}) => {
  test.setTimeout(60_000)

  await signInAs(page, CHEFE_CCIH)
  const dialog = await openNovoCasoDialog(page)
  await dialog.locator('select[name="templateId"]').selectOption({ value: TEMPLATE_CF_ID })

  const declInput = dialog.locator('#create-case-custom-numero_declaracao_obito')
  await expect(declInput).toBeVisible({ timeout: 8_000 })
  await expect(declInput).toHaveValue('')

  const submitBtn = dialog.getByRole('button', { name: /^Criar caso$/i })
  await expect(submitBtn).toBeDisabled({ timeout: 5_000 })

  // Filling the (optional) label does NOT unblock — the custom field is the gate.
  await dialog.getByLabel(/Rótulo/i).fill(`AC-2 unblock ${Date.now()}`)
  await expect(submitBtn).toBeDisabled()

  await declInput.fill(`DO-E2E-AC2-${Date.now()}`)
  await expect(submitBtn).toBeEnabled({ timeout: 5_000 })

  await submitBtn.click()
  await page.waitForURL(/\/c\/ccih\/manage\/cases\/[0-9a-f-]{36}/i, { timeout: 20_000 })
  const region = customFieldsRegion(page)
  await expect(region).toBeVisible({ timeout: 10_000 })
})

// ===========================================================================
// AC-3 — The fill-time non-PHI/administrative warning (D4). Distinguished
// from the pre-existing free-text-label PII warning by its own copy
// ("...nos campos personalizados...").
// ===========================================================================

test('AC-3: the custom-fields block shows the non-PHI fill-time warning', async ({ page }) => {
  test.setTimeout(60_000)

  await signInAs(page, CHEFE_CCIH)
  const dialog = await openNovoCasoDialog(page)
  await dialog.locator('select[name="templateId"]').selectOption({ value: TEMPLATE_CF_ID })

  const warning = dialog
    .getByRole('note')
    .filter({ hasText: /não inclua dados de paciente nos campos personalizados/i })
  await expect(warning).toBeVisible({ timeout: 8_000 })
  await expect(warning).toContainText(/prontuário/i)
  await expect(warning).toContainText(/data de nascimento/i)

  await page.keyboard.press('Escape')
})

// ===========================================================================
// AC-4 — Case detail displays the frozen values (D8). READ-ONLY on the
// shared seeded case — never mutated by any test in this file (AC-5 creates
// its own case instead), so this assertion is safe under fullyParallel and
// stable across any number of reruns of this file.
// ===========================================================================

test('AC-4: seeded case detail shows the frozen custom-field values (declaration number + resolved dropdown label)', async ({
  page,
}) => {
  await signInAs(page, CHEFE_CCIH)
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${SEEDED_CASE_ID}`)
  await page.waitForURL(new RegExp(`/manage/cases/${SEEDED_CASE_ID}`), { timeout: 15_000 })

  const region = customFieldsRegion(page)
  await expect(region).toBeVisible({ timeout: 10_000 })
  await expect(region.getByText(DECL_LABEL)).toBeVisible()
  await expect(region.getByText(SEEDED_DECL_NUMBER)).toBeVisible()
  await expect(region.getByText(TURNO_LABEL)).toBeVisible()
  // The dropdown resolves its frozen CODE ('manha') to its option LABEL — the
  // raw code must never leak to the UI.
  await expect(region.getByText(SEEDED_TURNO_LABEL)).toBeVisible()
  await expect(region.getByText('manha', { exact: true })).toHaveCount(0)
})

// ===========================================================================
// AC-5 — Edit after creation persists (D7). Uses a DEDICATED case created
// inside this test — never touches the shared seeded fixture AC-4/AC-6 read,
// so it is safe under fullyParallel and rerun-safe (own case per run).
// ===========================================================================

test('AC-5: staff_admin edits a case\'s custom-field values from the detail page; changes persist after reload', async ({
  page,
}) => {
  test.setTimeout(90_000)

  await signInAs(page, CHEFE_CCIH)

  const dialog = await openNovoCasoDialog(page)
  await dialog.locator('select[name="templateId"]').selectOption({ value: TEMPLATE_CF_ID })
  await dialog.getByLabel(/Rótulo/i).fill(`AC-5 edit ${Date.now()}`)
  const initialDecl = `DO-E2E-AC5-INIT-${Date.now()}`
  await dialog.locator('#create-case-custom-numero_declaracao_obito').fill(initialDecl)
  await dialog.locator('#create-case-custom-turno_obito').selectOption({ label: 'Manhã' })
  await dialog.getByRole('button', { name: /^Criar caso$/i }).click()
  await page.waitForURL(/\/c\/ccih\/manage\/cases\/[0-9a-f-]{36}/i, { timeout: 20_000 })
  const caseId = caseIdFromUrl(page)

  const region = customFieldsRegion(page)
  await expect(region).toBeVisible({ timeout: 10_000 })
  await expect(region.getByText(initialDecl)).toBeVisible({ timeout: 10_000 })

  await region.getByRole('button', { name: /^Editar$/i }).click()
  const editDialog = page
    .getByRole('dialog', { name: /editar campos personalizados/i })
    .or(page.getByRole('dialog').filter({ hasText: /editar campos personalizados/i }))
  await expect(editDialog).toBeVisible({ timeout: 8_000 })

  const declField = editDialog.locator('#edit-case-custom-numero_declaracao_obito')
  await expect(declField).toHaveValue(initialDecl)

  const updatedDecl = `DO-E2E-AC5-EDITED-${Date.now()}`
  await declField.fill(updatedDecl)
  await editDialog.locator('#edit-case-custom-turno_obito').selectOption({ label: 'Noite' })

  await editDialog.getByRole('button', { name: /^Salvar$/i }).click()
  await expect(editDialog).toHaveCount(0, { timeout: 10_000 })

  // Reload — proves the value round-tripped through the server, not just
  // client state.
  await page.reload()
  await expect(region.getByText(updatedDecl)).toBeVisible({ timeout: 10_000 })
  await expect(region.getByText('Noite')).toBeVisible({ timeout: 5_000 })
  await expect(region.getByText(initialDecl)).toHaveCount(0)

  // DB truth.
  const rows = await restGet<{ key: string; value: unknown }>(
    page.request,
    `case_custom_field_values?case_id=eq.${caseId}&select=key,value`,
  )
  expect(rows.find((r) => r.key === 'numero_declaracao_obito')?.value).toBe(updatedDecl)
  expect(rows.find((r) => r.key === 'turno_obito')?.value).toBe('noite')
})

// ===========================================================================
// AC-6 — Opt-in list column + search fold (D8). READ-ONLY on the seeded case.
// ===========================================================================

test('AC-6: cases list shows the show_in_list custom-field column and folds values into search', async ({
  page,
}) => {
  test.setTimeout(60_000)

  await signInAs(page, CHEFE_CCIH)
  await page.goto('/o/rede-a/c/ccih/manage/cases')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/cases', { timeout: 15_000 })
  await page.waitForLoadState('networkidle', { timeout: 15_000 })

  // Force table view (the segmented toggle is a no-op if already active).
  await page.getByRole('button', { name: /^Tabela$/i }).click()

  await expect(
    page.getByRole('columnheader', { name: /campos personalizados/i }),
  ).toBeVisible({ timeout: 10_000 })

  const seededRow = page.getByRole('row').filter({ hasText: SEEDED_CASE_LABEL })
  await expect(seededRow).toBeVisible({ timeout: 10_000 })
  await expect(seededRow.getByText(SEEDED_DECL_NUMBER)).toBeVisible()

  // Search by the custom-field VALUE — the seeded row survives the filter.
  const search = page.getByLabel('Buscar caso ou rótulo')
  await search.fill(SEEDED_DECL_NUMBER)
  await expect(page.getByRole('row').filter({ hasText: SEEDED_CASE_LABEL })).toBeVisible({
    timeout: 10_000,
  })

  // A query matching no real case/label/custom-field value narrows to zero.
  await search.fill('no-such-value-zzz-e2e')
  await expect(page.getByText(/Nenhum caso corresponde aos filtros\./i)).toBeVisible({
    timeout: 10_000,
  })
})

// ===========================================================================
// AC-7 — Process-less cases get NO custom-field block (D9). First proves the
// block CAN appear in this dialog instance (CF template selected), then
// proves switching to "Sem processo" removes it — a true negative test of
// the exclusion, not merely "no template chosen yet".
// ===========================================================================

test('AC-7: process-less cases show NO custom-field block (D9)', async ({ page }) => {
  test.setTimeout(60_000)

  await signInAs(page, CHEFE_CCIH)
  const dialog = await openNovoCasoDialog(page)

  // Scoped to the fieldset's "group" role (accessible name from its <legend>) —
  // a bare getByText('Campos personalizados') is a strict-mode trap here: it
  // case-insensitively substring-matches the template <option> text
  // ("...Campos Personalizados)") AND the PII warning sentence too.
  const customFieldsGroup = dialog.getByRole('group', { name: /campos personalizados/i })

  await dialog.locator('select[name="templateId"]').selectOption({ value: TEMPLATE_CF_ID })
  await expect(customFieldsGroup).toBeVisible({ timeout: 8_000 })

  await dialog.locator('select[name="templateId"]').selectOption({ value: PROCESSLESS_SENTINEL })
  await expect(customFieldsGroup).toHaveCount(0, { timeout: 5_000 })
  await expect(dialog.locator('#create-case-custom-numero_declaracao_obito')).toHaveCount(0)

  await page.keyboard.press('Escape')
})

// ===========================================================================
// AC-8 (BEST EFFORT) — Draft-only authoring (D5). Own draft template created
// via service-role insert (mirrors case-patient.spec.ts's beforeAll pattern),
// scoped to this describe block so the lifecycle never touches other tests.
// ===========================================================================

test.describe('AC-8 (best effort) — draft-only authoring in the template builder', () => {
  // ADR 0096: a template is IDENTITY + versions. `draftTemplateId` is the
  // identity (used for the page URL — page resolution is draft-first, so no
  // `?v=` is needed); `draftVersionId` is its v1 draft (what
  // `process_template_custom_fields.template_version_id` actually points at).
  let draftTemplateId: string
  let draftVersionId: string

  test.beforeAll(async ({ request }) => {
    const draftTpl = await createDraftTemplateDirect(
      request,
      { baseUrl: SUPABASE_URL, apikey: SUPABASE_SERVICE_KEY, bearerToken: SUPABASE_SERVICE_KEY },
      {
        commissionId: COMM_A,
        title: `Campos Personalizados Draft E2E ${Date.now()}`,
        description: 'Template draft para testar autoria de campos personalizados (AC-8).',
        createdBy: UID_CHEFE_A,
      },
    )
    draftTemplateId = draftTpl.templateId
    draftVersionId = draftTpl.versionId
  })

  test.afterAll(async ({ request }) => {
    if (!draftTemplateId) return
    // Best-effort cleanup — never mask a real test failure.
    await request
      .delete(
        `${SUPABASE_URL}/rest/v1/process_template_custom_fields?template_version_id=eq.${draftVersionId}`,
        { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
      )
      .catch(() => {})
    await request
      .delete(`${SUPABASE_URL}/rest/v1/process_templates?id=eq.${draftTemplateId}`, {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      })
      .catch(() => {})
  })

  test('AC-8: staff_admin adds a custom-field definition to a DRAFT template via CustomFieldsCard + the slot dialog', async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000)

    await signInAs(page, CHEFE_CCIH)
    await page.goto(`/o/rede-a/c/ccih/manage/process-templates/${draftTemplateId}`)
    await page.waitForURL(new RegExp(`/manage/process-templates/${draftTemplateId}`), {
      timeout: 15_000,
    })

    const section = page.getByRole('region', { name: /campos personalizados/i })
    await expect(section).toBeVisible({ timeout: 10_000 })
    await expect(section.getByText(/nenhum campo personalizado ainda/i)).toBeVisible({
      timeout: 8_000,
    })

    await section.getByRole('button', { name: /adicionar campo/i }).click()
    const addDialog = page
      .getByRole('dialog', { name: /novo campo personalizado/i })
      .or(page.getByRole('dialog').filter({ hasText: /novo campo personalizado/i }))
    await expect(addDialog).toBeVisible({ timeout: 8_000 })

    const fieldLabel = `Campo Piloto E2E ${Date.now()}`
    await addDialog.getByLabel(/Rótulo/i).fill(fieldLabel)
    // Leave "Tipo" at its default (Resposta curta / short_text) — no options
    // editor needed, keeping this best-effort flow as low-risk as possible.
    await addDialog.getByRole('button', { name: /^Adicionar campo$/i }).click()
    await expect(addDialog).toHaveCount(0, { timeout: 10_000 })

    await expect(section.getByText(fieldLabel)).toBeVisible({ timeout: 10_000 })
    await expect(section.getByText('Resposta curta')).toBeVisible({ timeout: 5_000 })

    // DB truth. ADR 0096: custom-field defs are keyed on `template_version_id`.
    const rows = await restGet<{ label: string; field_type: string }>(
      request,
      `process_template_custom_fields?template_version_id=eq.${draftVersionId}&select=label,field_type`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].label).toBe(fieldLabel)
    expect(rows[0].field_type).toBe('short_text')
  })
})
