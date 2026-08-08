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

/** The staff_admin dashboard's response detail (the `staff_admin`-gated screen). */
export const submissionDetailHref = (responseId: string) =>
  `/o/${ORG}/c/${CCIH_SLUG}/dashboard/submissions/${responseId}`

/** The RESPONDENT's own read-only view of a submitted response — the creator-side
 * mint surface added for FUP-PDF-1. Reached from "Minhas respostas". */
export const myResponseDetailHref = (responseId: string) =>
  `/o/${ORG}/c/${CCIH_SLUG}/respostas/${responseId}`

/** "Minhas respostas" — the respondent's own history. */
export const myResponsesHref = () => `/o/${ORG}/c/${CCIH_SLUG}/respostas`

/** How many pool fixtures {@link submittedResponseIds} may hand out. Kept here
 * so {@link creatorMintFixture} excludes exactly that prefix rather than a
 * hand-copied number that drifts when a test is added. */
const POOL_SIZE = 6

/**
 * Every CCIH response id AUTHORED by one persona — DB truth for the "Minhas
 * respostas" scoping assertions.
 */
export async function responseIdsAuthoredBy(
  page: Page,
  email: string,
): Promise<string[]> {
  const uid = await profileIdByEmail(page, email)
  const rows = await serviceQuery<{ id: string }>(
    page,
    `responses?commission_id=eq.${COMMISSION_A_ID}&created_by=eq.${uid}&select=id`,
  )
  return rows.map((r) => r.id)
}

/**
 * A submitted CCIH response whose author is a plain `staff` member, chosen so it
 * can NEVER collide with a pool fixture — the mint registry is per-source state,
 * and two tests minting the same source silently supersede each other.
 *
 * The seed mints response ids with `gen_random_uuid()`, so which rows land in
 * the `id.asc` pool changes on every `db reset`. Anything that reasons about the
 * pool must therefore RECOMPUTE it, never assume a persona sits outside it:
 * picking staff2's highest id looked safe and collided on the very first run
 * (memory: a-shared-fixture-cannot-satisfy-two-specs). Here the pool prefix is
 * computed and subtracted, and the ten seeded submitted CCIH responses are all
 * authored by the two `staff` respondents, so four always survive the cut.
 */
export async function creatorMintFixture(
  page: Page,
): Promise<{ responseId: string; email: string }> {
  const rows = await serviceQuery<{ id: string; created_by: string }>(
    page,
    `responses?commission_id=eq.${COMMISSION_A_ID}&status=eq.submitted` +
      `&select=id,created_by&order=id.asc`,
  )
  const outsidePool = rows.slice(POOL_SIZE)
  expect(
    outsidePool.length,
    `a submitted CCIH response outside the ${POOL_SIZE}-wide mint pool`,
  ).toBeGreaterThan(0)

  const pick = outsidePool[0]
  const [profile] = await serviceQuery<{ email: string }>(
    page,
    `profiles?id=eq.${pick.created_by}&select=email`,
  )
  expect(profile?.email, 'the fixture response has an author profile').toBeTruthy()

  // Guard the property the test is actually about: if this author were ever a
  // staff_admin, the mint would prove nothing about the CREATOR arm of D11.
  const memberships = await serviceQuery<{ role: string }>(
    page,
    `memberships?principal_id=eq.${pick.created_by}` +
      `&commission_id=eq.${COMMISSION_A_ID}&select=role`,
  )
  expect(
    memberships.map((m) => m.role),
    'the creator fixture must be a PLAIN staff member',
  ).toEqual(['staff'])

  return { responseId: pick.id, email: profile.email }
}

async function profileIdByEmail(page: Page, email: string): Promise<string> {
  const profiles = await serviceQuery<{ id: string }>(
    page,
    `profiles?email=eq.${encodeURIComponent(email)}&select=id`,
  )
  expect(profiles.length, `seeded profile for ${email}`).toBe(1)
  return profiles[0].id
}

/** The response ids the rendered "Minhas respostas" list links to (in DOM order),
 * recovered from each row's href — both the submitted (`/respostas/<id>`) and the
 * in_progress (`/forms/<formId>/responder/<id>`) shapes end in the response id. */
export async function listedResponseIds(page: Page): Promise<string[]> {
  const hrefs = await page
    .getByRole('list', { name: 'Histórico de respostas' })
    .getByRole('listitem')
    .locator('a')
    .evaluateAll((links) =>
      links.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''),
    )
  return hrefs.map((href) => href.split('/').pop() ?? '')
}

/**
 * Deterministic pool of CCIH (commission A) SUBMITTED response ids, ordered by
 * id ascending so repeated calls within one run return the same assignment —
 * each test in the suite claims a distinct index so mint/revoke/supersession
 * state from one test can never contaminate another's fixture (memory:
 * a-shared-fixture-cannot-satisfy-two-specs). `count` must not exceed
 * {@link POOL_SIZE}; anything beyond that prefix belongs to
 * {@link creatorMintFixture} and must stay unclaimed here.
 */
export async function submittedResponseIds(page: Page, count: number): Promise<string[]> {
  expect(count, `the mint pool is ${POOL_SIZE} wide`).toBeLessThanOrEqual(POOL_SIZE)
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
