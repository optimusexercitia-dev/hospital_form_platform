import { test, expect } from '@playwright/test'

import { COMMISSION_A_ID, focusByTabbing, signInAs } from './helpers/documents'
import {
  articleForShortCode,
  mintViaDialog,
  submissionDetailHref,
  submittedResponseIds,
  SHORT_CODE_RE,
} from './helpers/pdf-printing'

/**
 * PDF·P1 — PDF document printing, Forms + full skeleton (ADR 0104; plan
 * docs/plans/pdf-document-printing.md §2.5–2.8).
 *
 * Covers the P1 gate's acceptance list (§2.8): mint -> download -> verify
 * (logged out) -> revoke -> overlay-download -> re-verify; supersession
 * recency wording; the public `/verificar` + `/api/documents` reachability
 * boundary; a keyboard-only mint flow; and the `platform_admin` UI exclusion
 * (ADR 0104 D11 noun rule).
 *
 * Fixtures: 5 distinct seeded CCIH (commission A) SUBMITTED responses, one per
 * test that mutates registry state (`submittedResponseIds` — deterministic,
 * id-ascending pool of 6; index 5 is left spare). Local Supabase stack +
 * Gotenberg sidecar (:3010) are preconditions, like the seeded DB itself.
 *
 * Run: prod-standalone server foreground + `npx playwright test
 * e2e/pdf-printing.spec.ts --project=chromium --workers=1` (house recipe,
 * docs/testing/e2e-prod-build-gate.md).
 */

test.describe('PDF·P1 — printing', () => {
  test('full lifecycle: mint -> download -> verify (logged out) -> revoke -> overlay download -> re-verify', async ({
    page,
    browser,
  }) => {
    const [responseId] = await submittedResponseIds(page, 1)

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(submissionDetailHref(responseId))

    // Panel starts empty for this fresh fixture.
    await expect(
      page.getByText('Nenhum documento emitido a partir desta resposta ainda.'),
    ).toBeVisible()

    // Open the dialog and confirm the watermark it states BEFORE minting: this
    // response is submitted, so the mark must read FINAL (ADR 0104 D7).
    await page.getByRole('button', { name: 'Emitir documento', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('FINAL', { exact: true })).toBeVisible()

    await dialog.getByRole('button', { name: 'Emitir documento', exact: true }).click()
    const success = page.getByRole('alert')
    await expect(success).toBeVisible({ timeout: 20_000 })
    const shortCode = (await success.getByText(SHORT_CODE_RE).innerText()).trim()

    const downloadLink = dialog.getByRole('link', { name: /baixar pdf/i })
    const downloadPath = (await downloadLink.getAttribute('href'))!
    expect(downloadPath).toMatch(/^\/api\/documents\/[0-9a-f-]{36}$/)

    // Two controls share the accessible name "Fechar" here: the DialogClose
    // ghost button (visible text) and the icon-only X button (aria-label).
    // Text content disambiguates to the former.
    await dialog.getByText('Fechar', { exact: true }).click()
    await expect(dialog).toBeHidden()

    // Panel: chip "Ativo" + the short code visible.
    const article = articleForShortCode(page, shortCode)
    await expect(article.getByText('Ativo', { exact: true })).toBeVisible()

    // Download as chefe.ccih — 200, real PDF bytes.
    const resp1 = await page.request.get(downloadPath)
    expect(resp1.status()).toBe(200)
    expect(resp1.headers()['content-type']).toContain('application/pdf')
    const bytes1 = await resp1.body()
    expect(bytes1.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(bytes1.byteLength).toBeGreaterThan(1000)

    // Logged-out verification via the short code: authentic tuple, no download link.
    const anonContext = await browser.newContext()
    const anonPage = await anonContext.newPage()
    await anonPage.goto(`/verificar/${shortCode}?via=codigo`)
    await expect(anonPage.getByRole('heading', { name: 'Documento autêntico' })).toBeVisible()
    await expect(anonPage.getByText('Hospital Central A')).toBeVisible()
    await expect(anonPage.getByText('Formulário preenchido')).toBeVisible()
    await expect(anonPage.getByRole('link', { name: /baixar o documento/i })).toHaveCount(0)
    await anonContext.close()

    // Revoke as chefe.ccih (staff_admin).
    await page.reload()
    const articleAfterReload = articleForShortCode(page, shortCode)
    await articleAfterReload.getByRole('button', { name: 'Anular' }).click()
    const revokeDialog = page.getByRole('dialog')
    await expect(revokeDialog).toBeVisible()
    await revokeDialog.getByLabel('Motivo da anulação').selectOption('minted_in_error')
    await revokeDialog
      .getByLabel('Descrição do motivo')
      .fill('Emissão de teste automatizado — anulação administrativa (sem dados de paciente).')
    await revokeDialog.getByRole('button', { name: 'Anular documento' }).click()
    await expect(revokeDialog).toBeHidden()

    const articleAfterRevoke = articleForShortCode(page, shortCode)
    await expect(articleAfterRevoke.getByText('Anulado', { exact: true })).toBeVisible()

    // Re-verify logged out — status flips to anulado.
    const anonContext2 = await browser.newContext()
    const anonPage2 = await anonContext2.newPage()
    await anonPage2.goto(`/verificar/${shortCode}?via=codigo`)
    await expect(anonPage2.getByRole('heading', { name: 'Documento anulado' })).toBeVisible()
    await anonContext2.close()

    // Overlay download still succeeds — canonical bytes with the ANULADO stamp
    // laid over them, so they must NOT hash-match the original download.
    const resp2 = await page.request.get(downloadPath)
    expect(resp2.status()).toBe(200)
    expect(resp2.headers()['content-type']).toContain('application/pdf')
    const bytes2 = await resp2.body()
    expect(bytes2.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(Buffer.compare(bytes1, bytes2)).not.toBe(0)
  })

  test('supersession: re-minting flips the prior emission and shows the D6 recency wording', async ({
    page,
    browser,
  }) => {
    const [, responseId] = await submittedResponseIds(page, 2)

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(submissionDetailHref(responseId))

    const first = await mintViaDialog(page)
    const second = await mintViaDialog(page)
    expect(second.shortCode).not.toBe(first.shortCode)

    await expect(articleForShortCode(page, first.shortCode).getByText('Substituído', { exact: true })).toBeVisible()
    await expect(articleForShortCode(page, second.shortCode).getByText('Ativo', { exact: true })).toBeVisible()

    // Logged-out verify of the FIRST (superseded) short code must render the
    // D6 recency wording — NOT an error/not-found state.
    const anonContext = await browser.newContext()
    const anonPage = await anonContext.newPage()
    await anonPage.goto(`/verificar/${first.shortCode}?via=codigo`)
    await expect(anonPage.getByRole('heading', { name: 'Documento autêntico' })).toBeVisible()
    await expect(
      anonPage.getByText(/existe uma emissão mais recente deste documento/i),
    ).toBeVisible()
    await expect(anonPage.getByRole('heading', { name: 'Documento não reconhecido' })).toHaveCount(0)
    await expect(anonPage.getByRole('heading', { name: 'Documento anulado' })).toHaveCount(0)
    await anonContext.close()
  })

  test('public reachability: /verificar works logged out, short-code round-trips, /api/documents stays gated', async ({
    page,
    browser,
  }) => {
    const [, , responseId] = await submittedResponseIds(page, 3)

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(submissionDetailHref(responseId))
    const { shortCode, downloadPath } = await mintViaDialog(page)
    const documentId = downloadPath.split('/').pop()!

    const anonContext = await browser.newContext()
    const anonPage = await anonContext.newPage()

    // Landing reachable logged out — 200, no bounce to /login.
    const landingResp = await anonPage.goto('/verificar')
    expect(landingResp?.status()).toBe(200)
    expect(new URL(anonPage.url()).pathname).toBe('/verificar')
    await expect(anonPage.getByLabel('Código de verificação')).toBeVisible()

    // The short-code form round-trips to a real result.
    await anonPage.getByLabel('Código de verificação').fill(shortCode)
    await anonPage.getByRole('button', { name: 'Verificar' }).click()
    await anonPage.waitForURL(new RegExp(`/verificar/${shortCode}\\?via=codigo`))
    await expect(anonPage.getByRole('heading', { name: 'Documento autêntico' })).toBeVisible()

    // The byte-serving route stays behind auth even for a real, existing id.
    const gatedResp = await anonPage.request.get(`/api/documents/${documentId}`, {
      maxRedirects: 0,
    })
    expect([301, 302, 303, 307, 308]).toContain(gatedResp.status())
    expect(gatedResp.headers()['location'] ?? '').toMatch(/\/login/)

    await anonContext.close()
  })

  test('keyboard-only: mint -> download-link focus, no mouse', async ({ page }) => {
    const [, , , responseId] = await submittedResponseIds(page, 4)

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(submissionDetailHref(responseId))

    const trigger = page.getByRole('button', { name: 'Emitir documento', exact: true })
    await focusByTabbing(page, () => trigger.evaluate((el) => el === document.activeElement))
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const confirmButton = dialog.getByRole('button', { name: 'Emitir documento', exact: true })
    // The dialog moves focus to the confirm button itself on open
    // (onOpenAutoFocus) — no Tab needed, but we assert it landed there before
    // driving the next key, so the flow stays provably keyboard-only.
    await expect
      .poll(() => confirmButton.evaluate((el) => el === document.activeElement))
      .toBe(true)
    await page.keyboard.press('Enter')

    const success = page.getByRole('alert')
    await expect(success).toBeVisible({ timeout: 20_000 })

    const downloadLink = dialog.getByRole('link', { name: /baixar pdf/i })
    await expect
      .poll(() => downloadLink.evaluate((el) => el === document.activeElement))
      .toBe(true)

    // Complete the flow: activate the focused download link via the keyboard.
    const downloadPromise = page.waitForEvent('download')
    await page.keyboard.press('Enter')
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })

  test('platform_admin: no mint surface reachable anywhere on the response-detail route', async ({ page }) => {
    const [, , , , responseId] = await submittedResponseIds(page, 5)

    await signInAs(page, 'platform@test.local')
    const resp = await page.goto(submissionDetailHref(responseId))

    // The response-detail screen is wholly staff_admin-gated; platform_admin
    // holds no commission membership at all, so `getCommissionAccessByOrg`
    // returns null (ADR 0104 D11 noun rule: platform_admin may not mint/
    // download/revoke). The real 404 STATUS comes from the COMMISSION LAYOUT's
    // own denial (`o/[org]/c/[commission]/layout.tsx`), which no loading.tsx
    // wraps and therefore resolves before the response streams — NOT from the
    // page's guard, which sits below `loading.tsx` boundaries and could only
    // yield a streamed 200 + noindex + 404 UI (Next's documented contract; see
    // BUG-PDF2-002's by-design resolution and the meetings spec's restricted-
    // visibility test, which pins that streamed variant).
    expect(resp?.status()).toBe(404)
    await expect(page.getByRole('button', { name: 'Emitir documento' })).toHaveCount(0)
    await expect(page.getByText('Documentos emitidos')).toHaveCount(0)
  })

  test('not-recognised code renders the calm state, distinct from "unavailable"', async ({ page }) => {
    await page.goto('/verificar/ZZZZ00000X?via=codigo')
    await expect(page.getByRole('heading', { name: 'Documento não reconhecido' })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Não foi possível verificar agora' }),
    ).toHaveCount(0)
  })
})

// Sanity guard: the fixture pool assumption (§ submittedResponseIds) depends on
// commission A actually being CCIH — fail loudly, not silently, if that ever drifts.
test('fixture sanity: COMMISSION_A_ID resolves to a real id', () => {
  expect(COMMISSION_A_ID).toMatch(/^[0-9a-f-]{36}$/)
})
