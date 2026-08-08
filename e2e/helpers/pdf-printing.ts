import { expect, type Page } from '@playwright/test'

import { COMMISSION_A_ID, serviceQuery } from './documents'

/**
 * Shared scaffolding for the PDF·P1 E2E suite (ADR 0104; `docs/plans/pdf-document-printing.md`
 * §2.5–2.8). Reuses the generic REST/auth scaffolding already in `./documents`
 * (that file's helpers are not controlled-documents-specific despite its name —
 * `serviceQuery`/`signInAs`/`focusByTabbing`/`COMMISSION_A_ID` back four suites
 * already) rather than re-deriving them.
 *
 * Local Supabase stack only; a running Gotenberg sidecar on :3010 is a
 * precondition (docs/deployment/pdf-renderer.md), like Supabase itself.
 */

export const ORG = 'rede-a'
export const CCIH_SLUG = 'ccih'

export const submissionDetailHref = (responseId: string) =>
  `/o/${ORG}/c/${CCIH_SLUG}/dashboard/submissions/${responseId}`

/**
 * Deterministic pool of CCIH (commission A) SUBMITTED response ids, ordered by
 * id ascending so repeated calls within one run return the same assignment —
 * each test in the suite claims a distinct index so mint/revoke/supersession
 * state from one test can never contaminate another's fixture (memory:
 * a-shared-fixture-cannot-satisfy-two-specs). The seed ships 6 Form-A
 * submitted responses under commission A; `count` must not exceed that.
 */
export async function submittedResponseIds(page: Page, count: number): Promise<string[]> {
  const rows = await serviceQuery<{ id: string }>(
    page,
    `responses?commission_id=eq.${COMMISSION_A_ID}&status=eq.submitted&select=id&order=id.asc&limit=${count}`,
  )
  expect(rows.length, `at least ${count} seeded submitted CCIH responses`).toBeGreaterThanOrEqual(count)
  return rows.map((r) => r.id)
}

/** The mint short-code format the door mints (Crockford base32-ish, no ambiguous chars). */
export const SHORT_CODE_RE = /^[A-HJ-NP-Z2-9]{10}$/

/**
 * Drives the "Emitir documento" dialog to completion via mouse/role locators:
 * open -> confirm -> read the minted short code + download path -> close.
 * Leaves the panel closed and refreshed (the component's own `router.refresh()`
 * on success). Assumes the response-detail page is already loaded and the
 * document_printing flag is on (seed forces it ON locally).
 */
export async function mintViaDialog(page: Page): Promise<{ shortCode: string; downloadPath: string }> {
  await page.getByRole('button', { name: 'Emitir documento', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await dialog.getByRole('button', { name: 'Emitir documento', exact: true }).click()

  const success = page.getByRole('alert')
  await expect(success).toBeVisible({ timeout: 20_000 })

  const codeLocator = success.getByText(SHORT_CODE_RE)
  const shortCode = (await codeLocator.innerText()).trim()

  const downloadLink = dialog.getByRole('link', { name: /baixar pdf/i })
  const downloadPath = (await downloadLink.getAttribute('href'))!
  expect(downloadPath).toMatch(/^\/api\/documents\/[0-9a-f-]{36}$/)

  // Two controls share the accessible name "Fechar" here: the DialogClose
  // ghost button (visible text) and the icon-only X button (aria-label). Text
  // content disambiguates to the former.
  await dialog.getByText('Fechar', { exact: true }).click()
  await expect(dialog).toBeHidden()

  return { shortCode, downloadPath }
}

/** The "Documentos emitidos" panel row (article) for one minted document, found
 * by its verification short code (unique per mint). */
export function articleForShortCode(page: Page, shortCode: string) {
  return page.locator('article').filter({ hasText: shortCode })
}
