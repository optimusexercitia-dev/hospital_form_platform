import { test, expect } from '@playwright/test'

import {
  signInAs,
  serviceQuery,
  commissionDocHref,
  pdfPayload,
  selectDocType,
  toggleReviewer,
  continuarButton,
  enviarButton,
} from './helpers/documents'

/**
 * `changes_requested` lifecycle (document-detail redesign, follow-up to Phase 17
 * v2 / ADR 0081) — a reviewer's rejection now produces a first-class
 * `changes_requested` version state (NOT a silent revert to `draft`), and the
 * coordinator revises the SAME version in place via the reused create/new-version
 * wizard (`mode="revise"`) rather than a version bump. Two surfaces under test:
 *
 *  - the create wizard's `Tipo` field is now a native `<select>` (was a Segmented
 *    radiogroup) — `selectDocType` (helpers/documents.ts) replaces `selectSegmented`
 *    for this field;
 *  - reject-with-reason -> `changes_requested` card (roster + verdict + reason,
 *    warning banner, "Enviar versão revisada") -> revise-in-place -> resubmit
 *    (back to `in_approval`, SAME v1, fresh all-pending roster).
 *
 * Same seed/personas as `phase17-documents.spec.ts` / `documents-redesign.spec.ts`
 * (see their headers); run on a FRESH `supabase db reset`, chromium, `--workers=1`.
 */

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ===========================================================================
// CR-0: Tipo is a native <select> (not the old Segmented radiogroup), offering
// the six pt-BR doc-type options in order. Keyboard-only: Arrow keys change the
// native select's value directly (no mouse).
// ===========================================================================

test('CR-0: Tipo renders as a native select dropdown with the six doc-type options (keyboard-operable)', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/documentos/novo')

  const tipoField = page.getByLabel('Tipo', { exact: true })
  await expect(tipoField).toHaveCount(1)
  expect(await tipoField.evaluate((el) => el.tagName)).toBe('SELECT')

  // NOT the old Segmented radiogroup — no radio/radiogroup on this step at all.
  await expect(page.getByRole('radiogroup')).toHaveCount(0)
  await expect(page.getByRole('radio')).toHaveCount(0)

  const optionLabels = await tipoField.locator('option').allTextContents()
  expect(optionLabels).toEqual(['Política', 'POP', 'Protocolo', 'Regimento', 'Manual', 'Outro'])

  // Keyboard-reachable: the select holds focus. Right after navigation the route's
  // entrance animation/hydration can transiently steal focus back to the document
  // (the same race `documents-redesign.spec.ts` RW-1b documents for the title
  // field) — retried rather than asserted once.
  await expect(async () => {
    await tipoField.focus()
    await expect(tipoField).toBeFocused({ timeout: 1_000 })
  }).toPass({ timeout: 10_000 })
  await expect(tipoField).toHaveValue('sop') // the wizard's default

  // The value is changed via `selectOption` (Playwright's canonical select API),
  // NOT a simulated ArrowDown/ArrowUp: on macOS a focused native <select> opens the
  // OS popup on Arrow keys instead of advancing the value in place, and Playwright
  // cannot drive that OS popup — so an arrow-key value assertion is not portable
  // across OSes (it silently no-ops on macOS, leaving the value at 'sop'). Keyboard
  // operability is already established: a focusable, semantic native <select>
  // (asserted `SELECT` above) is keyboard-operable by the platform's own contract.
  await tipoField.selectOption('protocol')
  await expect(tipoField).toHaveValue('protocol')
  await tipoField.selectOption('sop')
  await expect(tipoField).toHaveValue('sop')
})

// ===========================================================================
// CR-1: create -> submit (v1 in_approval) -> approver "Solicitar alterações"
// with a reason -> changes_requested card (roster/verdict/reason, warning
// banner, "Enviar versão revisada", old inline forms hidden) -> revise in place
// -> resubmit (back to in_approval, SAME v1, fresh all-pending roster).
// ===========================================================================

test('CR-1: reject with a reason produces changes_requested; revise-in-place resubmits the SAME version to a fresh in_approval round', async ({
  page,
}) => {
  // Deliberately does NOT contain "alterações"/"solicitadas" — the final assertion
  // checks that phrase is gone from the page post-resubmit, and `getByText` is a
  // case-insensitive substring match, so a title containing those words would
  // self-collide with that check.
  const title = `Doc Revisão CR ${Date.now()}`
  const reason = 'Faltou anexar o anexo com a referência técnica atualizada.'

  // --- Step 2: create + submit for approval via the wizard (one approver). ---
  await signInAs(page, 'chefe.ccih@test.local')
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
  const docId = page.url().split('/').pop()!.split('?')[0]

  const v1 = (
    await serviceQuery<{ id: string; status: string; version_number: number }>(
      page,
      `controlled_document_versions?document_id=eq.${docId}&select=id,status,version_number`,
    )
  )[0]
  expect(v1.status, 'lands in_approval at v1').toBe('in_approval')
  expect(v1.version_number).toBe(1)
  const versionId = v1.id

  // --- Step 3: approver rejects with a required reason via "Solicitar alterações". ---
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/documentos-pendentes/${docId}`)
  await page.getByRole('button', { name: /^solicitar alterações$/i }).click()
  await page.getByLabel(/motivo da solicitação de alterações/i).fill(reason)
  await page.getByRole('button', { name: /^solicitar alterações$/i }).click()

  await expect
    .poll(
      async () =>
        (await serviceQuery<{ status: string }>(page, `controlled_document_versions?id=eq.${versionId}&select=status`))[0]
          ?.status,
      { timeout: 15_000 },
    )
    .toBe('changes_requested')

  const approvalAfterReject = (
    await serviceQuery<{ decision: string | null; note: string | null }>(
      page,
      `document_approvals?document_version_id=eq.${versionId}&select=decision,note`,
    )
  )[0]
  expect(approvalAfterReject.decision).toBe('rejected')
  expect(approvalAfterReject.note).toBe(reason)

  // --- Step 4: coordinator detail — the changes_requested card. ---
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(commissionDocHref(docId))

  await expect(page.getByText('Alterações solicitadas', { exact: true }).first()).toBeVisible()

  // Scoped by the panel's OWN accessible name (`aria-labelledby="approvals-heading"`
  // -> implicit role="region") — NOT a coarse `section, hasText` filter: on this
  // redesigned detail page the panel is nested INSIDE the outer "Versões"
  // `<section>` (the `activeDraftSlot` pattern), which itself transitively
  // contains "Aprovadores" text, so a `hasText` filter's `.first()` resolves to
  // the wrong (outer) section — see the CR-1 bug note in PROGRESS.md.
  const approvalsSection = page.getByRole('region', { name: 'Aprovadores' })
  await expect(approvalsSection).toContainText('Enfermeiro CCIH Um')
  const approverRow = approvalsSection.locator('li').filter({ hasText: 'Enfermeiro CCIH Um' })
  await expect(approverRow).toContainText('Alterações solicitadas')
  await expect(approverRow).toContainText(reason)

  await expect(
    page.getByText('Esta versão recebeu solicitações de alteração de um ou mais aprovadores.'),
  ).toBeVisible()
  const reviseLink = page.getByRole('link', { name: /enviar versão revisada/i })
  await expect(reviseLink).toBeVisible()

  // The old inline "add file" / "submit for approval" forms are NOT shown here.
  await expect(page.getByRole('heading', { name: 'Arquivo da versão' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^enviar arquivo$/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /enviar para aprovação/i })).toHaveCount(0)

  // --- Step 5: revise in place -> resubmit. ---
  await reviseLink.click()
  await page.waitForURL(new RegExp(`/documentos/${docId}/revisar$`))

  // Identity is locked: no editable title/type fields; the frozen panel shows
  // the document's title/code.
  await expect(page.getByLabel('Título')).toHaveCount(0)
  await expect(page.getByLabel('Tipo', { exact: true })).toHaveCount(0)
  await expect(page.getByText(title)).toBeVisible()

  await continuarButton(page).click() // step 0 (locked identity) -> step 1 (document)
  await page.locator('#wizard-file').setInputFiles(pdfPayload)
  await page.getByLabel(/resumo das alterações/i).fill('Anexo técnico incluído — revisão E2E.')
  await continuarButton(page).click() // step 1 -> step 2 (reviewers)

  // The approver set is PRE-FILLED with the version's prior approver (no
  // re-toggle needed) — the step is already valid.
  await expect(page.getByRole('checkbox', { name: /Enfermeiro CCIH Um/i })).toHaveAttribute('aria-checked', 'true')

  await continuarButton(page).click() // step 2 -> step 3 (confirm)
  // Revise mode's terminal button reads "Enviar versão revisada" (not create's
  // "Enviar para aprovação" that `enviarButton` targets).
  await page.getByRole('button', { name: /enviar versão revisada/i }).click()

  await page.waitForURL(new RegExp(`/documentos/${docId}\\?aviso=enviado$`), { timeout: 20_000 })

  // DB-truth: NO version bump (still exactly one version, v1), back to
  // in_approval, and a FRESH all-pending approver roster (prior verdict cleared).
  await expect
    .poll(
      async () =>
        (
          await serviceQuery<{ status: string }>(
            page,
            `controlled_document_versions?id=eq.${versionId}&select=status`,
          )
        )[0]?.status,
      { timeout: 15_000 },
    )
    .toBe('in_approval')

  const versionsAfter = await serviceQuery<{ id: string; version_number: number }>(
    page,
    `controlled_document_versions?document_id=eq.${docId}&select=id,version_number`,
  )
  expect(versionsAfter.length, 'revise-in-place never bumps the version').toBe(1)
  expect(versionsAfter[0].id).toBe(versionId)
  expect(versionsAfter[0].version_number).toBe(1)

  const approvalsAfter = await serviceQuery<{ decision: string | null }>(
    page,
    `document_approvals?document_version_id=eq.${versionId}&select=decision`,
  )
  expect(approvalsAfter.length, 'fresh roster, same approver re-enqueued').toBe(1)
  expect(approvalsAfter.every((a) => a.decision === null), 'prior rejected verdict cleared').toBeTruthy()

  await page.reload()
  await expect(page.getByText('Em aprovação', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Alterações solicitadas')).toHaveCount(0)
})
