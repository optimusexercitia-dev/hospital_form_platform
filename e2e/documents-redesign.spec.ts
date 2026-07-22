import { test, expect, type Page } from '@playwright/test'

import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  COMMISSION_A_ID,
  signInAs,
  serviceQuery,
  commissionDocHref,
  newVersionHref,
  pdfPayload,
  publishViaDialog,
  ownerToken,
  focusByTabbing,
  selectDocType,
  toggleReviewer,
  continuarButton,
  enviarButton,
  salvarRascunhoButton,
  buildPublishedDocViaWizard,
} from './helpers/documents'

/**
 * Controlled-Document Redesign (Phase 17 v2 — ADR 0081) — coverage for the
 * REDESIGNED surfaces + 4 functional gaps that `phase17-documents.spec.ts`
 * (the ported lifecycle/regression suite) does not exercise:
 *
 *  - the all-in-one create wizard (4-step, validity gating, keyboard-only pass)
 *  - the new-version wizard (locked identity, HC089 precondition)
 *  - the register's KPI strip + filter chips (incl. derived "Em revisão") + search
 *    + category filter + the in_approval approval mini-bar
 *  - version compare (focus-trapped modal, Esc/click-out close)
 *  - Remind (+ same-day dedupe)
 *  - approver notifications deep-linking to the sign page
 *  - retired vs superseded (`obsolete_kind`)
 *  - the new `description` field round-trip
 *  - the B0 enum-key anglicization (`doc_type`/`decision` — English keys, pt-BR labels)
 *
 * Same seed/personas as `phase17-documents.spec.ts` (see its header); run on a
 * FRESH `supabase db reset`, chromium, `--workers=1`.
 */

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Register-truth helpers (mirror the app's OWN derivation so KPI/chip
// assertions are exact regardless of what earlier tests in this file/run
// created — never a hardcoded absolute count).
// ---------------------------------------------------------------------------

interface RegisterTruthRow {
  id: string
  code: string
  title: string
  doc_type: string
  category: string | null
  tags: string[] | null
  status: string
  review_due_date: string | null
  obsolete_kind: string | null
  has_open_revision: boolean
  approvals_signed_count: number
  approvals_total_count: number
}

async function fetchRegisterTruth(page: Page, commissionId = COMMISSION_A_ID): Promise<RegisterTruthRow[]> {
  const token = await ownerToken(page, 'chefe.ccih@test.local')
  const resp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/list_commission_documents`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { p_commission: commissionId },
  })
  expect(resp.ok(), 'list_commission_documents RPC').toBeTruthy()
  return resp.json()
}

function isOverdueIso(d: string | null): boolean {
  if (!d) return false
  return d < new Date().toISOString().slice(0, 10)
}

function derivedStatus(r: RegisterTruthRow): string {
  if (r.status === 'effective' && r.has_open_revision) return 'revision'
  return r.status
}

function computeKpis(rows: RegisterTruthRow[]) {
  return {
    total: rows.length,
    awaitingApproval: rows.filter((r) => r.status === 'in_approval').length,
    effective: rows.filter((r) => derivedStatus(r) === 'effective').length,
    draftOrRevision: rows.filter((r) => r.status === 'draft' || derivedStatus(r) === 'revision').length,
    reviewOverdue: rows.filter((r) => isOverdueIso(r.review_due_date)).length,
  }
}

/** Read a KPI card's numeric value by its exact pt-BR label (document-kpi-strip.tsx). */
async function kpiValue(page: Page, label: string): Promise<number> {
  const dt = page.getByText(label, { exact: true })
  const card = dt.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")]').first()
  const text = await card.locator('dd span').first().innerText()
  return Number(text.trim())
}

// ===========================================================================
// RW-1a: Create wizard — per-step validity gating; submit persists
// category/tags/description/≥1 approver, lands in_approval.
// ===========================================================================

test('RW-1a: create wizard — step validity gating; submit persists category/tags/description/approvers', async ({
  page,
}) => {
  const title = `Wizard Completo ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')

  // --- Step 1 (Detalhes): Continuar disabled until a title exists. ---
  await expect(continuarButton(page)).toBeDisabled()
  await page.getByLabel('Título').fill(title)
  await expect(continuarButton(page)).toBeEnabled()

  await selectDocType(page, 'Protocolo')
  await page.getByLabel('Categoria').fill('Prevenção de Infecção E2E')
  await page.getByLabel('Descrição').fill('Diretrizes de teste E2E para o wizard completo.')
  await page.getByLabel('Ciclo de revisão (meses)').fill('12')
  const tagsInput = page.getByLabel('Etiquetas')
  await tagsInput.fill('e2e')
  await tagsInput.press('Enter')
  await tagsInput.fill('wizard')
  await tagsInput.press('Enter')
  await expect(page.getByText('e2e', { exact: true })).toBeVisible()
  await expect(page.getByText('wizard', { exact: true })).toBeVisible()

  await continuarButton(page).click()
  await expect(page.getByRole('heading', { name: 'Arquivo da versão' })).toBeVisible()

  // --- Step 2 (Documento): Continuar disabled until a file is attached. ---
  await expect(continuarButton(page)).toBeDisabled()
  await page.locator('#wizard-file').setInputFiles(pdfPayload)
  await expect(continuarButton(page)).toBeEnabled()
  await continuarButton(page).click()
  await expect(page.getByRole('heading', { name: 'Aprovadores' })).toBeVisible()

  // --- Step 3 (Aprovadores): Continuar disabled until ≥1 approver chosen. ---
  await expect(continuarButton(page)).toBeDisabled()
  await toggleReviewer(page, 'Enfermeiro CCIH Um')
  await toggleReviewer(page, 'Enfermeira CCIH Dois')
  await expect(continuarButton(page)).toBeEnabled()
  await continuarButton(page).click()
  await expect(page.getByRole('heading', { name: 'Confirmação' })).toBeVisible()

  // --- Step 4 (Confirmação): summary reflects the chosen values. ---
  await expect(page.getByText('Prevenção de Infecção E2E')).toBeVisible()
  await expect(page.getByText('Enfermeiro CCIH Um')).toBeVisible()
  await expect(page.getByText('Enfermeira CCIH Dois')).toBeVisible()

  await enviarButton(page).click()
  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}\?aviso=enviado$/, { timeout: 20_000 })
  const docId = page.url().split('/').pop()!.split('?')[0]

  // DB-truth: category/tags/description/status/approver count all persisted exactly.
  const rows = await serviceQuery<{
    status: string
    category: string | null
    tags: string[] | null
    description: string | null
  }>(page, `controlled_documents?id=eq.${docId}&select=status,category,tags,description`)
  expect(rows[0]).toMatchObject({
    status: 'in_approval',
    category: 'Prevenção de Infecção E2E',
    description: 'Diretrizes de teste E2E para o wizard completo.',
  })
  expect(new Set(rows[0].tags ?? [])).toEqual(new Set(['e2e', 'wizard']))

  const versionId = (
    await serviceQuery<{ id: string }>(page, `controlled_document_versions?document_id=eq.${docId}&select=id`)
  )[0].id
  const approvals = await serviceQuery<{ approver_id: string; decision: string | null }>(
    page,
    `document_approvals?document_version_id=eq.${versionId}&select=approver_id,decision`,
  )
  expect(approvals.length, 'both named approvers persisted, pending').toBe(2)
  expect(approvals.every((a) => a.decision === null)).toBeTruthy()
})

// ===========================================================================
// RW-1b: Create wizard — dedicated keyboard-only pass. Tab/Enter through all 4
// steps; `aria-current="step"` tracks the stepper; focus moves to each new
// step's heading. File selection uses the file-input API directly (no OS
// dialog automation is possible from Playwright) — every OTHER interaction is
// keyboard-only (no `.click()`).
// ===========================================================================

test('RW-1b: create wizard keyboard-only — Tab/Enter through all steps; aria-current + heading focus', async ({
  page,
}) => {
  const title = `Wizard Teclado ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')

  // Step 1 — focus the title field (not a click) and type. Retried: right after
  // navigation the route's entrance animation/hydration can transiently steal
  // focus back to the document, so the focus+assert pair is wrapped in a retry
  // rather than asserted once (a timing race, not an app defect).
  const titleField = page.getByLabel('Título')
  await expect(async () => {
    await titleField.focus()
    await expect(titleField).toBeFocused({ timeout: 1_000 })
  }).toPass({ timeout: 10_000 })
  await page.keyboard.type(title)

  // Tab onto the Tipo native <select> and change the selection via arrow keys —
  // proves the doc-type control is keyboard-operable (BUG-DDR-001: was a
  // Segmented radiogroup + ArrowRight/aria-checked; now a native select whose
  // value changes directly on ArrowDown/ArrowUp — see CR-0 in
  // documents-changes-requested.spec.ts for the same pattern).
  await page.keyboard.press('Tab')
  const tipoField = page.getByLabel('Tipo', { exact: true })
  await expect(tipoField).toBeFocused()
  await expect(tipoField).toHaveValue('sop') // the wizard's default
  await page.keyboard.press('ArrowDown')
  await expect(tipoField).toHaveValue('protocol')

  await focusByTabbing(page, async () => {
    const el = await page.evaluateHandle(() => document.activeElement)
    const tag = await el.evaluate((n) => (n as HTMLElement).tagName)
    const text = await el.evaluate((n) => (n as HTMLElement).textContent ?? '')
    return tag === 'BUTTON' && /^continuar$/i.test(text.trim())
  })
  await page.keyboard.press('Enter')

  // Step 2 heading receives focus; aria-current moved to step index 1.
  await expect(page.getByRole('heading', { name: 'Arquivo da versão' })).toBeFocused()
  const currentStep = page.locator('[aria-current="step"]')
  await expect(currentStep).toContainText('Documento')

  await page.locator('#wizard-file').setInputFiles(pdfPayload)
  await focusByTabbing(page, async () => {
    const el = await page.evaluateHandle(() => document.activeElement)
    const tag = await el.evaluate((n) => (n as HTMLElement).tagName)
    const text = await el.evaluate((n) => (n as HTMLElement).textContent ?? '')
    return tag === 'BUTTON' && /^continuar$/i.test(text.trim())
  })
  await page.keyboard.press('Enter')

  // Step 3 heading receives focus; aria-current moved to step index 2.
  await expect(page.getByRole('heading', { name: 'Aprovadores' })).toBeFocused()
  await expect(page.locator('[aria-current="step"]')).toContainText('Aprovadores')

  await focusByTabbing(page, async () => {
    return page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      return (
        el?.tagName === 'BUTTON' &&
        el.getAttribute('role') === 'checkbox' &&
        (el.textContent ?? '').includes('Enfermeiro CCIH Um')
      )
    })
  })
  await page.keyboard.press('Enter')
  await expect(page.getByRole('checkbox', { name: /Enfermeiro CCIH Um/i })).toHaveAttribute('aria-checked', 'true')

  await focusByTabbing(page, async () => {
    const el = await page.evaluateHandle(() => document.activeElement)
    const tag = await el.evaluate((n) => (n as HTMLElement).tagName)
    const text = await el.evaluate((n) => (n as HTMLElement).textContent ?? '')
    return tag === 'BUTTON' && /^continuar$/i.test(text.trim())
  })
  await page.keyboard.press('Enter')

  // Step 4 heading receives focus; aria-current moved to step index 3.
  await expect(page.getByRole('heading', { name: 'Confirmação' })).toBeFocused()
  await expect(page.locator('[aria-current="step"]')).toContainText('Confirmação')

  await focusByTabbing(page, async () => {
    const el = await page.evaluateHandle(() => document.activeElement)
    const tag = await el.evaluate((n) => (n as HTMLElement).tagName)
    const text = await el.evaluate((n) => (n as HTMLElement).textContent ?? '')
    return tag === 'BUTTON' && /enviar para aprovação/i.test(text.trim())
  })
  await page.keyboard.press('Enter')

  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}\?aviso=enviado$/, { timeout: 20_000 })
  const docId = page.url().split('/').pop()!.split('?')[0]
  const rows = await serviceQuery<{ status: string; doc_type: string }>(
    page,
    `controlled_documents?id=eq.${docId}&select=status,doc_type`,
  )
  expect(rows[0]).toMatchObject({ status: 'in_approval', doc_type: 'protocol' })
})

// ===========================================================================
// RW-2: "Salvar rascunho" exits at Rascunho from step 0 (no file/approvers).
// ===========================================================================

test('RW-2: "Salvar rascunho" saves a draft with only a title, no submission', async ({ page }) => {
  const title = `Wizard Rascunho ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')

  await expect(salvarRascunhoButton(page)).toBeDisabled()
  await page.getByLabel('Título').fill(title)
  await expect(salvarRascunhoButton(page)).toBeEnabled()
  await salvarRascunhoButton(page).click()

  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}\?aviso=rascunho$/, { timeout: 20_000 })
  const docId = page.url().split('/').pop()!.split('?')[0]

  await expect(page.getByRole('status')).toContainText('Rascunho salvo.')
  const rows = await serviceQuery<{ status: string }>(page, `controlled_documents?id=eq.${docId}&select=status`)
  expect(rows[0].status).toBe('draft')

  const versions = await serviceQuery<{ storage_path: string | null }>(
    page,
    `controlled_document_versions?document_id=eq.${docId}&select=storage_path`,
  )
  expect(versions.length, 'one draft version, no file attached').toBe(1)
  expect(versions[0].storage_path).toBeNull()
})

// ===========================================================================
// RW-3: New-version wizard — locked identity + read-only next version + the
// "criando v{next}…substitui v{current}" callout; the HC089 precondition
// (can't start ANOTHER new-version wizard while one is already open) redirects
// to the detail page; submit → derived "Em revisão"; approve+publish → prior
// version shows "Substituído" and remains retained/downloadable.
// ===========================================================================

test('RW-3: new-version wizard — locked identity, HC089 redirect, Em revisão, publish → Substituído', async ({
  page,
}) => {
  const title = `Nova Versão Wizard ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const docId = await buildPublishedDocViaWizard(page, title)

  await page.goto(commissionDocHref(docId))
  await page.getByRole('link', { name: /criar nova versão/i }).click()
  await page.waitForURL(new RegExp(`/documentos/${docId}/nova-versao$`))

  // Locked identity: no editable title field; the frozen panel shows the
  // callout with next/current version numbers.
  await expect(page.getByLabel('Título')).toHaveCount(0)
  await expect(page.getByText(title)).toBeVisible()
  await expect(page.getByText(/você está criando a/i)).toContainText('v2')
  await expect(page.getByText(/você está criando a/i)).toContainText('v1')

  await continuarButton(page).click()
  // Step 2: the read-only "Versão a criar" shows v2; the change summary is
  // REQUIRED in new-version mode (Continuar stays disabled without it).
  await expect(page.getByText('Versão a criar')).toBeVisible()
  await expect(page.getByText('v2', { exact: true })).toBeVisible()
  await page.locator('#wizard-file').setInputFiles(pdfPayload)
  await expect(continuarButton(page)).toBeDisabled()
  await page.getByLabel(/resumo das alterações/i).fill('Atualização de teste E2E para a nova versão.')
  await expect(continuarButton(page)).toBeEnabled()
  await continuarButton(page).click()

  await toggleReviewer(page, 'Enfermeiro CCIH Um')
  await continuarButton(page).click()
  await enviarButton(page).click()

  await page.waitForURL(new RegExp(`/documentos/${docId}\\?aviso=enviado$`), { timeout: 20_000 })

  // DB-truth: a second version now exists, in_approval; v1 is still effective.
  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ version_number: number; status: string }>(
        page,
        `controlled_document_versions?document_id=eq.${docId}&select=version_number,status&order=version_number`,
      )
      return rows.map((r) => `${r.version_number}:${r.status}`).join(',')
    })
    .toBe('1:effective,2:in_approval')

  // The header now shows the DERIVED "Em revisão" state.
  await page.reload()
  await expect(page.getByText('Em revisão', { exact: true })).toBeVisible()

  // HC089 precondition: a SECOND attempt to open the new-version wizard while
  // v2 is already open redirects straight to the detail page (no second wizard).
  await page.goto(newVersionHref(docId))
  await page.waitForURL(new RegExp(`/documentos/${docId}$`))
  await expect(page.getByRole('heading', { name: 'Nova versão do documento' })).toHaveCount(0)

  // Approve v2 + publish — v1 retires to obsolete/superseded, v2 becomes effective.
  const v2Id = (
    await serviceQuery<{ id: string }>(
      page,
      `controlled_document_versions?document_id=eq.${docId}&version_number=eq.2&select=id`,
    )
  )[0].id
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/documentos-pendentes/${docId}`)
  await page.getByRole('button', { name: /^aprovar$/i }).click()
  await page.getByRole('button', { name: /confirmar aprovação/i }).click()
  await expect
    .poll(
      async () =>
        (
          await serviceQuery<{ decision: string | null }>(
            page,
            `document_approvals?document_version_id=eq.${v2Id}&select=decision`,
          )
        )[0]?.decision,
    )
    .toBe('approved')

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(commissionDocHref(docId))
  await publishViaDialog(page)

  await expect
    .poll(async () => {
      const rows = await serviceQuery<{ version_number: number; status: string; obsolete_kind: string | null }>(
        page,
        `controlled_document_versions?document_id=eq.${docId}&select=version_number,status,obsolete_kind&order=version_number`,
      )
      const v1 = rows.find((r) => r.version_number === 1)
      const v2 = rows.find((r) => r.version_number === 2)
      return `${v1?.status}/${v1?.obsolete_kind}/${v2?.status}`
    })
    .toBe('obsolete/superseded/effective')

  await page.reload()
  const versionsSection = page.locator('section').filter({ hasText: 'Versões' })
  await expect(versionsSection.getByText('Substituído', { exact: true })).toBeVisible()
  // Both versions retained + downloadable.
  await expect(versionsSection.getByRole('link', { name: /baixar/i })).toHaveCount(2)
})

// ===========================================================================
// RW-4: Register — KPI strip matches DB-truth; filter chips (incl. derived
// "Em revisão"); search; category filter; category/tags + approval mini-bar
// shown on rows.
// ===========================================================================

test('RW-4: register — KPI strip, filter chips (incl. Em revisão), search, category filter, mini-bar', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')

  // A dedicated "in revision" fixture: publish a doc, then submit a second
  // version WITHOUT publishing it — the doc now has an open revision above its
  // effective version, driving the derived "Em revisão" chip deterministically.
  const revisionTitle = `Registro Em Revisão ${Date.now()}`
  const revisionDocId = await buildPublishedDocViaWizard(page, revisionTitle)
  await page.goto(commissionDocHref(revisionDocId))
  await page.getByRole('link', { name: /criar nova versão/i }).click()
  await continuarButton(page).click()
  await page.locator('#wizard-file').setInputFiles(pdfPayload)
  await page.getByLabel(/resumo das alterações/i).fill('Revisão em andamento — fixture E2E.')
  await continuarButton(page).click()
  await toggleReviewer(page, 'Enfermeiro CCIH Um')
  await continuarButton(page).click()
  await enviarButton(page).click()
  await page.waitForURL(new RegExp(`/documentos/${revisionDocId}\\?aviso=enviado$`), { timeout: 20_000 })

  // KPI strip must equal the CURRENT full-commission truth (order-independent —
  // never a hardcoded absolute count).
  await page.goto('/o/rede-a/c/ccih/manage/documentos')
  const truth = await fetchRegisterTruth(page)
  const expected = computeKpis(truth)
  expect(await kpiValue(page, 'Documentos controlados')).toBe(expected.total)
  expect(await kpiValue(page, 'Aguardando aprovação')).toBe(expected.awaitingApproval)
  expect(await kpiValue(page, 'Vigentes')).toBe(expected.effective)
  expect(await kpiValue(page, 'Em revisão / rascunho')).toBe(expected.draftOrRevision)

  // Filter chip: "Em revisão" + search narrows to exactly the fixture above.
  await page.getByRole('button', { name: 'Em revisão' }).click();
  await page.getByLabel('Buscar').fill(revisionTitle)
  await page.waitForURL(/view=revision/)
  await expect(page.getByText(revisionTitle)).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('link').filter({ hasText: revisionTitle })).toHaveCount(1)

  // Filter chip: "Aguardando aprovação" shows the em_aprovação approval mini-bar
  // matching the truth (0 signed of 2 for the seeded DOC-0002).
  await page.getByLabel('Buscar').fill('')
  await page.getByRole('button', { name: 'Aguardando aprovação' }).click()
  await page.waitForURL(/view=awaiting/)
  const doc0002Row = page.locator('li').filter({ hasText: 'DOC-0002' })
  await expect(doc0002Row).toBeVisible()
  const doc0002Truth = truth.find((r) => r.code === 'DOC-0002')!
  await expect(doc0002Row).toContainText(`${doc0002Truth.approvals_signed_count}/${doc0002Truth.approvals_total_count} aprovados`)

  // Category filter: the fixture has no category, so filtering to an
  // unmatched category clears the table (empty-filtered state).
  await page.goto('/o/rede-a/c/ccih/manage/documentos?category=Categoria-Inexistente-E2E')
  await expect(page.getByText('Nenhum documento encontrado')).toBeVisible()
})

// ===========================================================================
// RW-5: Detail — Compare exactly two versions → focus-trapped modal with a
// side-by-side diff (changed "Depois" cells flagged "alterado"); Esc closes;
// click-outside closes.
// ===========================================================================

test('RW-5: version compare — select two, diff highlighting, Esc + click-out close', async ({ page }) => {
  const title = `Comparar Versões ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const docId = await buildPublishedDocViaWizard(page, title)

  // Create a second version (in_approval) so there are two versions to compare,
  // whose "Situação" differs (Vigente vs Em aprovação) — a guaranteed diff row.
  await page.goto(commissionDocHref(docId))
  await page.getByRole('link', { name: /criar nova versão/i }).click()
  await continuarButton(page).click()
  await page.locator('#wizard-file').setInputFiles(pdfPayload)
  await page.getByLabel(/resumo das alterações/i).fill('Resumo v2 — comparação E2E.')
  await continuarButton(page).click()
  await toggleReviewer(page, 'Enfermeiro CCIH Um')
  await continuarButton(page).click()
  await enviarButton(page).click()
  await page.waitForURL(new RegExp(`/documentos/${docId}\\?aviso=enviado$`), { timeout: 20_000 })
  await page.reload()

  const versionsSection = page.locator('section').filter({ hasText: 'Versões' })
  const checkboxes = versionsSection.getByRole('checkbox', { name: /selecionar v/i })
  await expect(checkboxes).toHaveCount(2)
  await checkboxes.nth(0).click()
  await checkboxes.nth(1).click()

  const compareButton = page.getByRole('button', { name: /^comparar \(2\/2\)$/i })
  await expect(compareButton).toBeEnabled()
  await compareButton.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: /comparar v1 → v2/i })).toBeVisible()
  // "Situação" differs between the two versions (Vigente vs Em aprovação) —
  // its "Depois" cell is flagged "alterado".
  const situacaoRow = dialog.locator('tr').filter({ hasText: 'Situação' })
  await expect(situacaoRow.getByText('alterado')).toBeVisible()
  await expect(situacaoRow).toContainText('Em aprovação')

  // Escape closes the focus-trapped dialog.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  // Re-open, then click outside (the overlay) to close.
  await compareButton.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.mouse.click(10, 10)
  await expect(page.getByRole('dialog')).toBeHidden()
})

// ===========================================================================
// RW-6: Remind — sends a lembrete to a still-pending approver; an IMMEDIATE
// second click is deduped (same-day rate limit → the "skip" message).
// ===========================================================================

test('RW-6: Remind sends a lembrete; an immediate second click is deduped', async ({ page }) => {
  const title = `Doc Remind ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')

  // A FRESH fixture (not the shared seeded DOC-0002) with exactly one named
  // approver — self-contained and immune to same-day rate-limit state a prior
  // test/run may have already left on a shared seeded document.
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')
  await page.getByLabel('Título').fill(title)
  await selectDocType(page, 'Protocolo')
  await continuarButton(page).click()
  await page.locator('#wizard-file').setInputFiles(pdfPayload)
  await continuarButton(page).click()
  await toggleReviewer(page, 'Enfermeiro CCIH Um')
  await continuarButton(page).click()
  await enviarButton(page).click()
  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}\?aviso=enviado$/, { timeout: 20_000 })

  // Scoped by the panel's OWN accessible name (aria-labelledby="approvals-heading"
  // -> implicit role="region") — NOT a coarse `section, hasText` filter: the
  // ApprovalsPanel is nested INSIDE the outer "Versões" section (the doc-detail
  // redesign's `activeDraftSlot` pattern), which itself transitively contains
  // "Aprovadores" text, so `.first()` on a `hasText` filter resolved to the wrong
  // (outer) section (BUG-DDR-002).
  const approvalsSection = page.getByRole('region', { name: 'Aprovadores' })
  const approverRow = approvalsSection.locator('li').filter({ hasText: 'Enfermeiro CCIH Um' })
  const remindButton = approverRow.getByRole('button', { name: /^lembrar$/i })
  await expect(remindButton).toBeVisible()

  await remindButton.click()
  await expect(approverRow.getByRole('status')).toHaveText('Lembrete enviado.', { timeout: 10_000 })

  // Immediate second click on the SAME approver → deduped (rate-limited).
  await remindButton.click()
  await expect(approverRow.getByRole('status')).toContainText(/lembrete já enviado/i, { timeout: 10_000 })
})

// ===========================================================================
// RW-7: Notifications — after submit, the named approver's bell shows a
// notification that deep-links to the sign page (`documentos-pendentes/[id]`),
// which renders + is signable.
// ===========================================================================

test('RW-7: approver notification deep-links to the sign page and is signable', async ({ page }) => {
  const title = `Notificação Aprovador ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')
  await page.getByLabel('Título').fill(title)
  await selectDocType(page, 'Manual')
  await continuarButton(page).click()
  await page.locator('#wizard-file').setInputFiles(pdfPayload)
  await continuarButton(page).click()
  await toggleReviewer(page, 'Enfermeira CCIH Dois')
  await continuarButton(page).click()
  await enviarButton(page).click()
  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}\?aviso=enviado$/, { timeout: 20_000 })
  const docId = page.url().split('/').pop()!.split('?')[0]

  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto('/o/rede-a/documentos-pendentes')

  const bell = page.getByRole('button', { name: /notificações/i })
  await expect(bell).toBeVisible({ timeout: 15_000 })
  await bell.click()

  // Scope to the POPOVER's notification list — staff2.ccih is ALSO a pending
  // approver on this doc, so the underlying `/documentos-pendentes` page
  // renders the SAME title in its own list; an unscoped listitem search
  // matches both.
  const notifPanel = page.getByRole('list', { name: /lista de notificações/i })
  const item = notifPanel.getByRole('listitem').filter({ hasText: title })
  await expect(item).toBeVisible({ timeout: 10_000 })
  await expect(item).toHaveAttribute('href', `/o/rede-a/documentos-pendentes/${docId}`)
  await item.click()

  await page.waitForURL(new RegExp(`/documentos-pendentes/${docId}$`))
  await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /^aprovar$/i }).click()
  await page.getByRole('button', { name: /confirmar aprovação/i }).click()

  const versionId = (
    await serviceQuery<{ id: string }>(page, `controlled_document_versions?document_id=eq.${docId}&select=id`)
  )[0].id
  await expect
    .poll(
      async () =>
        (
          await serviceQuery<{ decision: string | null }>(
            page,
            `document_approvals?document_version_id=eq.${versionId}&select=decision`,
          )
        )[0]?.decision,
    )
    .toBe('approved')
})

// ===========================================================================
// RW-8: Mark obsolete (retire, no replacement) shows "Descontinuado" —
// distinguishing it from the "Substituído" (superseded) chip proven in RW-3.
// ===========================================================================

test('RW-8: mark obsolete (retire) shows "Descontinuado"', async ({ page }) => {
  const title = `Doc Retirado ${Date.now()}`
  await signInAs(page, 'chefe.ccih@test.local')
  const docId = await buildPublishedDocViaWizard(page, title)

  await page.goto(commissionDocHref(docId))
  await page.getByRole('button', { name: /tornar obsoleto/i }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /^tornar obsoleto$/i }).click()

  // `obsolete_kind` lives on `controlled_document_versions`, not the header.
  await expect
    .poll(
      async () =>
        (await serviceQuery<{ status: string }>(page, `controlled_documents?id=eq.${docId}&select=status`))[0]
          ?.status,
      { timeout: 15_000 },
    )
    .toBe('obsolete')

  const versionRow = (
    await serviceQuery<{ obsolete_kind: string | null }>(
      page,
      `controlled_document_versions?document_id=eq.${docId}&select=obsolete_kind`,
    )
  )[0]
  expect(versionRow.obsolete_kind, 'retired, not superseded').toBe('retired')

  await page.reload()
  const versionsSection = page.locator('section').filter({ hasText: 'Versões' })
  await expect(versionsSection.getByText('Descontinuado', { exact: true })).toBeVisible()
  await expect(versionsSection.getByText('Substituído', { exact: true })).toHaveCount(0)
})

// ===========================================================================
// RW-9: Description round-trip — create-with-description renders in the
// detail header; editing changes it.
// ===========================================================================

test('RW-9: description persists at create and round-trips through edit', async ({ page }) => {
  const title = `Doc Descrição ${Date.now()}`
  const original = 'Descrição original — criada pelo wizard E2E.'
  const updated = 'Descrição atualizada — editada pelo teste E2E.'

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')
  await page.getByLabel('Título').fill(title)
  await page.getByLabel('Descrição').fill(original)
  await salvarRascunhoButton(page).click()
  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}\?aviso=rascunho$/, { timeout: 20_000 })
  const docId = page.url().split('/').pop()!.split('?')[0]

  await expect(page.getByText(original)).toBeVisible()

  await page.getByRole('link', { name: /^editar$/i }).click()
  await page.waitForURL(new RegExp(`/documentos/${docId}/editar$`))
  const descriptionField = page.getByLabel('Descrição')
  await expect(descriptionField).toHaveValue(original)
  await descriptionField.fill(updated)
  await page.getByRole('button', { name: /salvar alterações/i }).click()

  await page.waitForURL(new RegExp(`/documentos/${docId}$`))
  await expect(page.getByText(updated)).toBeVisible()
  await expect(page.getByText(original)).toHaveCount(0)

  const rows = await serviceQuery<{ description: string | null }>(
    page,
    `controlled_documents?id=eq.${docId}&select=description`,
  )
  expect(rows[0].description).toBe(updated)
})

// ===========================================================================
// RW-10: Anglicization surface (ADR 0081 B0) — a `bylaws` doc renders
// "Regimento"; an `approved` decision renders "Aprovado"; the charter
// `?docType=bylaws` prefill preselects Regimento in the wizard. Assert the
// LABEL, never the storage key.
// ===========================================================================

test('RW-10: anglicized enum keys render pt-BR labels (bylaws→Regimento, approved→Aprovado)', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')

  // Charter prefill lands on the wizard with Regimento preselected.
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo?docType=bylaws')
  await expect(page.getByLabel('Tipo', { exact: true })).toHaveValue('bylaws')

  const title = `Regimento Anglicização ${Date.now()}`
  await page.getByLabel('Título').fill(title)
  await continuarButton(page).click()
  await page.locator('#wizard-file').setInputFiles(pdfPayload)
  await continuarButton(page).click()
  await toggleReviewer(page, 'Enfermeiro CCIH Um')
  await continuarButton(page).click()
  await enviarButton(page).click()
  await page.waitForURL(/\/manage\/documentos\/[0-9a-f-]{36}\?aviso=enviado$/, { timeout: 20_000 })
  const docId = page.url().split('/').pop()!.split('?')[0]

  // DB-truth: the storage key is the anglicized "bylaws", never the pt-BR word.
  const docRow = await serviceQuery<{ doc_type: string }>(page, `controlled_documents?id=eq.${docId}&select=doc_type`)
  expect(docRow[0].doc_type).toBe('bylaws')

  // UI renders the pt-BR label, on the detail header AND the register.
  await expect(page.getByText('Regimento', { exact: true }).first()).toBeVisible()
  await page.goto('/o/rede-a/c/ccih/manage/documentos')
  const row = page.getByRole('link').filter({ hasText: title })
  await expect(row.getByText('Regimento', { exact: true })).toBeVisible()

  // Approve as the named approver — the decision persists as the anglicized
  // "approved" key, but the coordinator's ApprovalsPanel renders "Aprovado".
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/documentos-pendentes/${docId}`)
  await page.getByRole('button', { name: /^aprovar$/i }).click()
  await page.getByRole('button', { name: /confirmar aprovação/i }).click()

  const versionId = (
    await serviceQuery<{ id: string }>(page, `controlled_document_versions?document_id=eq.${docId}&select=id`)
  )[0].id
  await expect
    .poll(
      async () =>
        (
          await serviceQuery<{ decision: string | null }>(
            page,
            `document_approvals?document_version_id=eq.${versionId}&select=decision`,
          )
        )[0]?.decision,
    )
    .toBe('approved')

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(commissionDocHref(docId))
  // Scoped by the panel's OWN accessible name (aria-labelledby="approvals-heading"
  // -> implicit role="region") — NOT a coarse `section, hasText` filter: the
  // ApprovalsPanel is nested INSIDE the outer "Versões" section (the doc-detail
  // redesign's `activeDraftSlot` pattern), which itself transitively contains
  // "Aprovadores" text, so `.first()` on a `hasText` filter resolved to the wrong
  // (outer) section (BUG-DDR-002).
  const approvalsSection = page.getByRole('region', { name: 'Aprovadores' })
  // The decision badge's text ("Aprovado" + "· <date>") is JSX-adjacent with no
  // inserted space, so match a plain substring — scoped to this ONE approver's
  // `<li>` (which does not include the "Aprovadores" heading/paragraph outside
  // the list, so "Aprovado" is unambiguous here).
  const approverRow = approvalsSection.locator('li').filter({ hasText: 'Enfermeiro CCIH Um' })
  await expect(approverRow).toContainText('Aprovado')
  await expect(approverRow).not.toContainText('approved')
})
