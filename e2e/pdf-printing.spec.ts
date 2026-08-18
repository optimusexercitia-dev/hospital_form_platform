import { test, expect } from '@playwright/test'

import { COMMISSION_A_ID, focusByTabbing, serviceQuery, signInAs } from './helpers/documents'
import {
  articleForShortCode,
  auditRowsFor,
  creatorMintFixture,
  keyboardActivateAndCapturePopup,
  listedResponseIds,
  mintViaDialog,
  myResponseDetailHref,
  myResponsesHref,
  ownInProgressResponseFixture,
  printedDocumentRowsFor,
  responseIdsAuthoredBy,
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

    // ADR 0125 D1 (case 2, two-sided pairing with the prévia test below): a
    // SUBMITTED response REGISTERS — "Emitir documento" is the only
    // affordance, never "Imprimir prévia" beside it. The user never chooses.
    await expect(page.getByRole('link', { name: 'Imprimir prévia', exact: true })).toHaveCount(0)

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

  // -------------------------------------------------------------------------
  // FUP-PDF-1 — the CREATOR's mint surface
  // -------------------------------------------------------------------------

  test('creator surface: a plain staff respondent mints their OWN submitted response from "Minhas respostas"', async ({
    page,
  }) => {
    /**
     * ADR 0104 D11 grants mint to anyone who can view the source, and
     * `app.can_view_printed_document`'s form_response arm has always opened on
     * `created_by = uid`. Until FUP-PDF-1 the ONLY response-detail screen was
     * staff_admin-gated, so that right was unreachable. This walks the whole
     * creator path: own history -> own submitted response -> mint -> download.
     *
     * `creatorMintFixture` subtracts the id.asc pool the five tests above claim
     * and asserts the author is a plain `staff` — see its doc for why picking a
     * persona's "highest id" is NOT a safe substitute.
     */
    const { responseId, email } = await creatorMintFixture(page)

    await signInAs(page, email)
    await page.goto(myResponsesHref())

    // The history lists the caller's OWN responses and nothing else. This
    // author is a plain `staff`, so RLS alone would already scope it — the
    // assertion that BITES is the staff_admin one below; this pins the happy
    // path and, with the id check, proves we are in the right session.
    const owned = await responseIdsAuthoredBy(page, email)
    await expect(page.getByRole('heading', { name: 'Minhas respostas' })).toBeVisible()
    const listed = await listedResponseIds(page)
    expect(listed.length).toBeGreaterThan(0)
    expect(listed.every((id) => owned.includes(id))).toBe(true)
    expect(listed).toContain(responseId)

    // A submitted row leads to the respondent's read-only viewer, NOT the wizard.
    await page.goto(myResponseDetailHref(responseId))
    await expect(page.getByRole('link', { name: 'Minhas respostas' }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Documentos emitidos' })).toBeVisible()

    // Mint as the creator — the door authorises on `created_by`, not on role.
    const { shortCode, downloadPath } = await mintViaDialog(page)
    expect(shortCode).toMatch(SHORT_CODE_RE)

    const article = articleForShortCode(page, shortCode)
    await expect(article.getByText('Ativo', { exact: true })).toBeVisible()

    // Download-time authority is the SAME predicate — the creator gets bytes.
    const resp = await page.request.get(downloadPath)
    expect(resp.status()).toBe(200)
    const bytes = await resp.body()
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')

    // D11: revocation is a governance act, not the minter's undo. The creator
    // holds no revoke affordance even over the document they just minted.
    await expect(article.getByRole('button', { name: /anular/i })).toHaveCount(0)
  })

  test('creator surface: "Minhas respostas" is OWN-only — a staff_admin sees no foreign row there', async ({
    page,
  }) => {
    /**
     * `listMyResponses` leaned entirely on RLS, and `responses_select` is WIDER
     * than this screen: it also grants a staff_admin every SUBMITTED row of the
     * commission. chefe.ccih (author of zero seeded responses) therefore saw the
     * whole commission's history on a page titled "Minhas respostas". Asserted
     * against DB truth rather than a count, so a spec that later submits a
     * response as chefe.ccih does not make this vacuous.
     */
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(myResponsesHref())
    await expect(page.getByRole('heading', { name: 'Minhas respostas' })).toBeVisible()

    const own = await responseIdsAuthoredBy(page, 'chefe.ccih@test.local')
    const listed = await listedResponseIds(page)
    expect(listed.every((id) => own.includes(id))).toBe(true)

    // And specifically: nothing authored by the two staff respondents leaks in.
    const foreign = [
      ...(await responseIdsAuthoredBy(page, 'staff1.ccih@test.local')),
      ...(await responseIdsAuthoredBy(page, 'staff2.ccih@test.local')),
    ]
    expect(foreign.length).toBeGreaterThan(0) // the check is not vacuous
    expect(listed.some((id) => foreign.includes(id))).toBe(false)
  })

  // -------------------------------------------------------------------------
  // ADR 0125/0126 print-source split — case 1: the EPHEMERAL prévia
  // -------------------------------------------------------------------------

  test('prévia (case 1): an in_progress response offers ONLY "Imprimir prévia" — streamed PDF, no registry row ever, its own audit event, keyboard-reachable', async ({
    page,
  }) => {
    /**
     * Fixture: chefe.ccih's OWN in_progress response, created fresh via the
     * real "Preencher" flow. NOT the seeded in_progress response (staff1.ccih's
     * draft) — that one belongs to a DIFFERENT member, and
     * `getSubmissionDetail` returns `null` for a foreign member's in_progress
     * response even to a `staff_admin` viewer, BY DESIGN, unrelated to this
     * ADR (see `ownInProgressResponseFixture`'s doc comment). Zero answers are
     * filled — nothing about the prévia derivation depends on content, only on
     * `status`, and the fixture is left `in_progress` on purpose.
     */
    await signInAs(page, 'chefe.ccih@test.local')
    const responseId = await ownInProgressResponseFixture(page)
    const [sanity] = await serviceQuery<{ status: string; commission_id: string }>(
      page,
      `responses?id=eq.${responseId}&select=status,commission_id`,
    )
    expect(sanity?.status, 'fixture sanity: freshly started, must be in_progress').toBe('in_progress')
    expect(sanity?.commission_id).toBe(COMMISSION_A_ID)

    await page.goto(submissionDetailHref(responseId))

    // Two-sided: the ephemeral affordance renders; the registered one never does.
    const previaLink = page.getByRole('link', { name: 'Imprimir prévia', exact: true })
    await expect(previaLink).toBeVisible()
    await expect(page.getByRole('button', { name: 'Emitir documento', exact: true })).toHaveCount(0)

    const href = await previaLink.getAttribute('href')
    expect(href).toBe(`/api/previa/form_response/${responseId}`)

    // DB truth, BEFORE: this source has never registered a print.
    expect(await printedDocumentRowsFor(page, 'form_response', responseId)).toHaveLength(0)
    const auditBefore = await auditRowsFor(page, 'document.previa_printed', 'form_response', responseId)

    // Keyboard-only: tab to the link and activate with Enter, no mouse — races
    // popup/download exactly like the house `clickAndCapturePopup` pattern,
    // because Chromium's handling of an INLINE pdf is not fixed across envs.
    await focusByTabbing(page, () => previaLink.evaluate((el) => el === document.activeElement))
    const openedUrl = await keyboardActivateAndCapturePopup(page)
    expect(openedUrl).toContain(`/api/previa/form_response/${responseId}`)

    // The keyboard hit is audited async relative to the popup/download race
    // settling, so poll rather than assert immediately (Gotenberg rendering
    // takes real seconds — matches the 20s budget used for mint elsewhere).
    await expect
      .poll(async () => (await auditRowsFor(page, 'document.previa_printed', 'form_response', responseId)).length, {
        timeout: 20_000,
        message: 'the keyboard-triggered prévia hit gets its own audit row (ADR 0125 D3)',
      })
      .toBe(auditBefore.length + 1)

    // Second hit via the request API (mouse-independent) — the byte-level
    // contract. By the time this resolves the server has DEFINITELY finished
    // (the route logs BEFORE streaming bytes back — "the log is a
    // PRECONDITION of delivery, not a side effect of it"), so no poll needed.
    const resp = await page.request.get(href!)
    expect(resp.status()).toBe(200)
    expect(resp.headers()['content-type']).toContain('application/pdf')
    expect(resp.headers()['content-disposition']).toContain('inline')
    const bytes = await resp.body()
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(bytes.byteLength).toBeGreaterThan(500)

    // DB truth, AFTER both hits: STILL nothing registered — a prévia is
    // repeatable and leaves no trace in the registry (ADR 0125 D3/D9).
    expect(await printedDocumentRowsFor(page, 'form_response', responseId)).toHaveLength(0)

    // But it IS audited — the one half D3 says cannot be added retroactively.
    // Assert the EXACT delta (two hits -> two rows), not just "some rows
    // exist", and pin the metadata shape while at it.
    const auditAfter = await auditRowsFor(page, 'document.previa_printed', 'form_response', responseId)
    expect(auditAfter.length - auditBefore.length).toBe(2)
    expect(auditAfter.at(-1)?.metadata).toMatchObject({
      registered: false,
      source_kind: 'form_response',
    })

    // ── Positive control for the two `toHaveLength(0)` checks above ─────────
    // A "stays empty" assertion passes just as well against a page that never
    // loaded or a query that silently no-ops — it needs proof the SAME query
    // shape can see a non-empty result. Mint a REAL document for a DIFFERENT,
    // currently-unclaimed fixture — index 5 of the pool, this file's own
    // documented "spare" (§ submittedResponseIds header: POOL_SIZE=6, five
    // slots claimed by the five tests above) — and confirm
    // `printedDocumentRowsFor` reports it. This is what makes the emptiness
    // above a finding rather than an artifact of a broken check.
    const [, , , , , controlResponseId] = await submittedResponseIds(page, 6)
    await page.goto(submissionDetailHref(controlResponseId))
    await mintViaDialog(page)
    expect(await printedDocumentRowsFor(page, 'form_response', controlResponseId)).toHaveLength(1)

    // ⚠ NOT asserted here, deliberately, and this is the one negative from
    // the ADR's case-1 wording that is NOT two-sided: the literal in-PDF
    // footer text ("PRÉVIA — sem valor de registro…"), the absence of the
    // verb "Emitido" INSIDE THE RENDERED BYTES, and the absence of a QR image
    // in those bytes. This repo has no PDF text-extraction dependency
    // (`pdf-lib` cannot read text — it is a creation/manipulation library),
    // and Chromium-rendered PDFs commonly encode content-stream text against
    // subset-font glyph indices rather than plain character codes, so a
    // hand-rolled extractor risks a false negative dressed as a red herring
    // (text present, "found" by a naive check as absent). That half of ADR
    // 0125 D5 is pinned at the unit level instead (`previa-footer.test.ts`,
    // `fingerprint.test.ts`) — a decision, not an oversight, and flagged to
    // `main` rather than silently claimed as covered. A DOM-level "Emitido"
    // text search on THIS page would also be UNSOUND on its own terms: this
    // fixture's registry list is empty, so "Documentos emitidos" (the panel's
    // own always-present heading) and "Nenhum documento emitido…" (the empty-
    // state copy) both legitimately contain the substring "emitido" — a naive
    // absence check would either false-red on those, or (if scoped to avoid
    // them) pass vacuously without ever having looked at the one place the
    // verb actually matters. What IS pinned above is the full
    // E2E-observable contract: the derived affordance (two-sided), the HTTP
    // shape a registered download does NOT have (`inline`, never
    // `attachment`), and — the strongest available proxy for "não
    // verificável" — that NOTHING ever enters the registry a verification
    // code could point at, now WITH a positive control proving that claim
    // could have gone the other way.
  })
})

// Sanity guard: the fixture pool assumption (§ submittedResponseIds) depends on
// commission A actually being CCIH — fail loudly, not silently, if that ever drifts.
test('fixture sanity: COMMISSION_A_ID resolves to a real id', () => {
  expect(COMMISSION_A_ID).toMatch(/^[0-9a-f-]{36}$/)
})
