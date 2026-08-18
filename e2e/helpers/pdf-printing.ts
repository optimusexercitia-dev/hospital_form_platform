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

// ---------------------------------------------------------------------------
// ADR 0125/0126 print-source split — prévia (ephemeral) vs. Emitir (registered)
// ---------------------------------------------------------------------------

/** DB-truth: `printed_documents` rows for one source (id.asc) — a prévia must
 * leave this EMPTY, repeated hits included (ADR 0125 D3/D9: no bytes, no
 * registry row, ever, ANY number of times). Kind-agnostic — reused for both
 * `form_response` and `meeting` sources. */
export async function printedDocumentRowsFor(
  page: Page,
  sourceKind: string,
  sourceId: string,
): Promise<Array<{ id: string; status: string }>> {
  return serviceQuery<{ id: string; status: string }>(
    page,
    `printed_documents?source_kind=eq.${sourceKind}&source_id=eq.${sourceId}&select=id,status&order=id.asc`,
  )
}

/** DB-truth: `audit_log` rows for one (action, entity_type, entity_id), oldest
 * first — used to pin the prévia's OWN audit event (ADR 0125 D3: the one half
 * of the split that cannot be added retroactively — an unlogged event is
 * gone, unlike unstored bytes, which can be re-rendered from the source). */
export async function auditRowsFor(
  page: Page,
  action: string,
  entityType: string,
  entityId: string,
): Promise<
  Array<{ id: string; actor_id: string | null; occurred_at: string; metadata: Record<string, unknown> | null }>
> {
  return serviceQuery<{
    id: string
    actor_id: string | null
    occurred_at: string
    metadata: Record<string, unknown> | null
  }>(
    page,
    `audit_log?action=eq.${encodeURIComponent(action)}&entity_type=eq.${entityType}` +
      `&entity_id=eq.${entityId}&select=id,actor_id,occurred_at,metadata&order=occurred_at.asc`,
  )
}

/**
 * Ensures the CALLER'S already-signed-in user has their OWN in_progress CCIH
 * response, creating one via the real "Preencher" flow if none exists yet
 * (idempotent server-side — `startOrResumeResponse`'s one-draft-per-user/
 * version unique index means a re-run resumes rather than duplicating).
 * Returns the new/resumed response id. Leaves the caller on the wizard route.
 *
 * ⚠ Needed because the ONLY seeded in_progress CCIH response belongs to
 * staff1.ccih, and `getSubmissionDetail` (`src/lib/queries/submissions.ts`)
 * returns `null` — BY DESIGN, the pre-existing "Phase-7 invariant", its own
 * comment: *"No row leaks for in_progress foreign responses"* — for a
 * FOREIGN member's in_progress response even to a `staff_admin` viewing via
 * the dashboard. That is unrelated to ADR 0125/0126; a prévia fixture must
 * therefore be the VIEWER'S OWN draft, never a borrowed one.
 */
export async function ownInProgressResponseFixture(page: Page): Promise<string> {
  await page.goto(`/o/${ORG}/c/${CCIH_SLUG}/forms`)
  const card = page.locator('article').filter({ hasText: 'Checklist de Higienização das Mãos' })
  await card
    .getByRole('button', { name: /^preencher$/i })
    .or(card.getByRole('link', { name: /continuar preenchimento/i }))
    .click()
  await page.waitForURL(/\/forms\/[0-9a-f-]{36}\/responder\/[0-9a-f-]{36}/)
  return page.url().split('/').pop()!.split('?')[0]
}

/**
 * Keyboard-only activation of a FOCUSED `target="_blank"` link (the
 * `PreviaLink`, ADR 0125 D4) — races 'popup' against 'download', the same
 * pattern `e2e/helpers/document-model.ts`'s `clickAndCapturePopup` uses for a
 * click, because Chromium's handling of a `Content-Disposition: inline` PDF
 * (native-viewer popup vs. a plain download) is not fixed across environments.
 * Assumes the target link ALREADY has focus (drive it there with
 * `focusByTabbing` first) — this only does the "press Enter" half.
 */
export async function keyboardActivateAndCapturePopup(page: Page): Promise<string> {
  const context = page.context()
  const downloadPromise = context.waitForEvent('download', { timeout: 8_000 }).catch(() => null)
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 8_000 }),
    page.keyboard.press('Enter'),
  ])
  const download = await downloadPromise
  const url = download ? download.url() : popup.url()
  await popup.close().catch(() => {})
  return url
}
