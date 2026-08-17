import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { createHash } from 'node:crypto'

import { cachedSignIn, accessToken } from './helpers/auth'
import { focusByTabbing } from './helpers/documents'
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  putBytesServiceRole,
  finalizeUpload,
  verifyUploadServiceRole,
  svcGet,
  clickAndCapturePopup,
  type BeginUploadResult,
} from './helpers/document-model'

/**
 * DM5 S2 — NSP RCA/CAPA evidence on the document substrate (ADR 0120, under ADR
 * 0114 D8/D9). Test contract: the four gate-step-2 items in the DM5 S2 tester
 * brief — (1) the upload-kind E2E the suite has never had, (2) a keyboard-only
 * begin→PUT→finalize flow, (3) the `pending`/`failed`/`disposed` availability
 * states, (4) link/citation regression.
 *
 * ⚠ AS OF THIS WRITING, EVERY TEST BELOW IS EXPECTED RED. Three independent,
 * catalog/source-verified defects block the whole surface (PROGRESS.md Bug Log):
 *   - BUG-DM5-S2-STUB-1: `listRcaEvidenceViews` / `listCapaActionEvidenceViews`
 *     and every S2 write action still `throw new Error('not implemented — DM5
 *     S2')`, so the RCA/CAPA workspace PAGE cannot render for anyone.
 *   - BUG-DM5-S2-WRITE-ARM-1: `app.can_write_document` has no `rca`/`capa_action`
 *     case, so `begin_document_upload` refuses EVERY caller with P0002 on these
 *     home types — independent of the stub bug, one layer deeper (SQL, not TS).
 *   - BUG-DM5-S2-CITATION-TARGETS-1: `listRcaCitationTargets` was never extended
 *     to offer a `document` candidate, so the citation picker can never show one
 *     even once the other two are fixed (confirmed by source read, not
 *     UI-tested here — see the file-level comment before the citation section).
 * These specs are written against the REAL, shipped component contracts
 * (locators/labels verified against `src/components/safety/**`, RPC shapes
 * verified against the live catalog via `pg_get_functiondef` — never migration
 * text) so they are ready to validate the moment backend wires the three fixes.
 * Tester does not fix app code — see PROGRESS.md Bug Log for full repro detail.
 */

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants (seeded, cross-checked against the live catalog 2026-08-14).
// ---------------------------------------------------------------------------

const ORG = 'rede-a'
const RCA_ID = 'f3000000-0000-0000-0000-0000000000a3'
const RCA_ACTOR_EMAIL = 'pqs.a@test.local' // pqs_member @ hospital central-a — can_write_rca via app.is_pqs_operator_of_for
const RCA_PATH = `/o/${ORG}/nsp/rca/${RCA_ID}`

function capaPath(capaId: string) {
  return `/o/${ORG}/nsp/capa/${capaId}`
}

// ---------------------------------------------------------------------------
// RPC / REST plumbing (mirrors dm4-referral-documents.spec.ts / phase14c/14d).
// ---------------------------------------------------------------------------

async function rpc(
  req: APIRequestContext,
  fn: string,
  bearer: string,
  body: Record<string, unknown>,
) {
  return req.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })
}

/**
 * `begin_document_upload` for the two NEW DM5 home types. `rca` / `capa_action`
 * are deliberately NOT in `e2e/helpers/document-model.ts`'s
 * `DocumentHomeResourceType` union (that module is the pre-DM5 corridor's own
 * mirror) — this is the S2-specific extension, kept local to this file so it
 * never widens a shared type other specs rely on.
 */
async function beginEvidenceUpload(
  request: APIRequestContext,
  token: string,
  input: {
    resourceType: 'rca' | 'capa_action'
    resourceId: string
    title: string
    declaredFileName?: string
    declaredMime?: string
    declaredSize?: number
  },
): Promise<{ ok: boolean; status: number; body: BeginUploadResult | { code?: string; message?: string } }> {
  const resp = await rpc(request, 'begin_document_upload', token, {
    p_resource_type: input.resourceType,
    p_resource_id: input.resourceId,
    p_title: input.title,
    p_declared_file_name: input.declaredFileName ?? 'fixture.pdf',
    p_declared_mime: input.declaredMime ?? 'application/pdf',
    p_declared_size: input.declaredSize ?? 128,
  })
  const body = await resp.json()
  return { ok: resp.ok(), status: resp.status(), body }
}

/** A distinctive, per-test PDF payload — unique bytes so a mix-up between two
 *  fixtures cannot pass as a match (mirrors dm4-referral-documents.spec.ts). */
function uniquePdf(marker: string): { name: string; mimeType: string; buffer: Buffer } {
  const body =
    `%PDF-1.4\n% DM5 S2 evidence marker: ${marker}\n` +
    `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n` +
    `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
    `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n` +
    `trailer<</Root 1 0 R>>\n%%EOF\n`
  return { name: `dm5-${marker}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from(body, 'utf8') }
}

const sha256Hex = (b: Buffer) => createHash('sha256').update(b).digest('hex')

/** Fetch the bytes behind a signed download URL (mirrors dm4-referral-documents.spec.ts). */
async function fetchBytes(page: Page, url: string): Promise<Buffer> {
  const resp = await page.request.get(url)
  expect(resp.status(), `signed download URL served (${url.split('?')[0]})`).toBe(200)
  return await resp.body()
}

/** Open a fresh, disposable CAPA plan + one action under the actor's own
 *  token — the established phase14d pattern (`open_capa_plan` source=manual),
 *  so CAPA tests never depend on the shared seeded CAPA-0001 row. */
async function openFreshCapaAction(
  request: APIRequestContext,
  token: string,
  marker: string,
): Promise<{ capaId: string; actionId: string }> {
  const openResp = await rpc(request, 'open_capa_plan', token, {
    p_source: 'manual',
    p_classification: 'corretiva',
  })
  expect(openResp.ok(), `open_capa_plan: ${await openResp.text()}`).toBeTruthy()
  const plan = (await openResp.json()) as { id: string }

  const actResp = await rpc(request, 'add_capa_action', token, {
    p_capa_id: plan.id,
    p_title: `Ação evidência DM5 ${marker}`,
  })
  expect(actResp.ok(), `add_capa_action: ${await actResp.text()}`).toBeTruthy()
  const action = (await actResp.json()) as { id: string }

  return { capaId: plan.id, actionId: action.id }
}

/**
 * Drive the shared seeded RCA back to `in_progress` before a test needs to
 * write to it (mirrors `ensureRcaStatus` in `phase14c-rca.spec.ts`, kept local
 * rather than imported — specs do not import each other in this repo).
 * ⚠ RCA_ID is the ONLY seeded RCA and `phase14c-rca.spec.ts` also mutates its
 * status serially; running both files' RCA tests concurrently across workers
 * is a known shared-fixture risk this file does not attempt to solve, only to
 * not make worse (this file's own RCA tests do not depend on serial ordering
 * WITHIN itself the way phase14c's R6/R9/R10/R11 chain does).
 */
async function ensureRcaWritable(request: APIRequestContext, token: string): Promise<void> {
  for (let hop = 0; hop < 4; hop += 1) {
    const rows = await svcGet<{ status: string }>(request, `rca?id=eq.${RCA_ID}&select=status`)
    const status = rows[0]?.status
    if (status === 'in_progress') return
    if (status === 'completed') {
      await rpc(request, 'reopen_rca', token, { p_rca_id: RCA_ID })
    } else if (status === 'in_review') {
      await rpc(request, 'complete_rca', token, { p_rca_id: RCA_ID })
    } else if (status === 'draft') {
      await rpc(request, 'update_rca', token, {
        p_rca_id: RCA_ID,
        p_what_md: 'DM5 evidence spec setup',
        p_scope: 'DM5',
      })
    } else {
      break
    }
  }
}

/** Waits for the RCA workspace to render REAL content, distinguishing the
 *  three ways "the page did not show what we wanted" can happen — the
 *  top-level error boundary (BUG-DM5-S2-STUB-1), a genuine 404/access denial,
 *  or something else — instead of a bare timeout that reads as "flaky".
 *
 *  ⚠ BUG-DM5-S6-EVID-KBD-1 root cause, fixed here: `main` alone is NOT proof
 *  of real content. `<main>` is rendered by the ANCESTOR layout
 *  (`src/app/o/[org]/nsp/layout.tsx`), which persists across the Next.js
 *  `loading.tsx` → `page.tsx` Suspense swap for this route — so `main` is
 *  already visible while `NspRcaLoading`'s bare `<Skeleton>` placeholders
 *  (no text, almost nothing focusable) are still showing, before
 *  `RcaWorkspace`'s real content — a `Promise.all` of ~10 server-side
 *  queries, one of them a dependent second wave over `capaPlans` — has
 *  streamed in. A caller that starts counting keyboard Tabs the instant this
 *  resolved could burn its whole fixed budget racing the skeleton instead of
 *  the real page: composition/load-dependent, because the race is only lost
 *  when the data fetch is slow enough to still be pending (measured: green
 *  alone and paired with one other file, red once four more files joined the
 *  same run — the DOM this function must wait for never changed, only the
 *  ambient load that determines whether it has arrived yet). Mouse-driven
 *  tests never hit this because `.click()` auto-retries until its target is
 *  actionable; `focusByTabbing` has no such retry — it is a fixed count of
 *  blind Tab presses, so its precondition must be honest. Wait for a signal
 *  the skeleton cannot produce — the evidence panel's own heading — racing
 *  it against the error boundary so a genuine stub/error regression still
 *  fails fast with the message below instead of a generic timeout. */
async function expectRcaWorkspaceRendered(page: Page): Promise<void> {
  const errorBoundary = page.getByText('Não foi possível carregar a análise de causa raiz')
  const main = page.getByRole('main')
  await expect(main, 'the RCA workspace main region mounts').toBeVisible({ timeout: 15_000 })
  const evidenceHeading = page.getByRole('heading', { name: /Evidências/ }).first()
  await expect(
    evidenceHeading.or(errorBoundary),
    'real content — the evidence panel — has replaced the loading skeleton (a visible <main> alone proves only that the ANCESTOR layout mounted, not this route\'s Suspense content)',
  ).toBeVisible({ timeout: 15_000 })
  if (await errorBoundary.isVisible().catch(() => false)) {
    throw new Error(
      'RCA workspace rendered the top-level error boundary instead of content — ' +
        'this is BUG-DM5-S2-STUB-1 (listRcaEvidenceViews throws), not a spec defect.',
    )
  }
}

/** CAPA counterpart — identical loading.tsx/ancestor-`<main>` race as
 *  `expectRcaWorkspaceRendered` above (same layout, same Suspense boundary
 *  shape at `src/app/o/[org]/nsp/capa/[capaId]/loading.tsx`), fixed the same
 *  way. Not the test that reproduced BUG-DM5-S6-EVID-KBD-1 (no CAPA keyboard
 *  test exists yet — every current CAPA caller is mouse-driven and so was
 *  masked by `.click()`'s auto-retry, same as this file's own RCA mouse
 *  tests were), but the identical mechanism, fixed alongside it rather than
 *  left as a landmine for the next keyboard test. `.first()`: a CAPA plan
 *  can have more than one action, each with its own "Evidências" heading. */
async function expectCapaWorkspaceRendered(page: Page): Promise<void> {
  const errorBoundary = page.getByText('Não foi possível carregar o plano de ação')
  const main = page.getByRole('main')
  await expect(main, 'the CAPA workspace main region mounts').toBeVisible({ timeout: 15_000 })
  const evidenceHeading = page.getByRole('heading', { name: /Evidências/ }).first()
  await expect(
    evidenceHeading.or(errorBoundary),
    "real content — an action's evidence list — has replaced the loading skeleton (a visible <main> alone proves only that the ANCESTOR layout mounted, not this route's Suspense content)",
  ).toBeVisible({ timeout: 15_000 })
  if (await errorBoundary.isVisible().catch(() => false)) {
    throw new Error(
      'CAPA workspace rendered the top-level error boundary instead of content — ' +
        'this is BUG-DM5-S2-STUB-1 (listCapaActionEvidenceViews throws), not a spec defect.',
    )
  }
}

// ===========================================================================
// 1 — THE UPLOAD-KIND E2E THE SUITE HAS NEVER HAD (RCA)
// ===========================================================================

test('EVID-RCA-UPLOAD-1: an RCA evidence file makes the full round trip through the real browser corridor — begin → PUT → finalize → click-time audited door returns byte-identical content', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  const marker = `rca-up-${Date.now()}`
  const payload = uniquePdf(marker)
  const title = `Evidência Upload ${marker}`

  const actorToken = await accessToken(request, RCA_ACTOR_EMAIL)
  await ensureRcaWritable(request, actorToken)

  await cachedSignIn(page, RCA_ACTOR_EMAIL)
  await page.goto(RCA_PATH)
  await expectRcaWorkspaceRendered(page)

  await page.getByRole('button', { name: 'Enviar arquivo' }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  await dialog.getByLabel('Arquivo').setInputFiles(payload)
  await dialog.getByLabel('Título').fill(title)
  await dialog.getByRole('button', { name: /^enviar arquivo$/i }).click()

  await expect(dialog, 'the dialog closes once begin→PUT→finalize completes').toBeHidden({ timeout: 30_000 })
  // Scoped to `li.animate-rise-in` — the evidence-row's OWN class, both homes
  // (rca-evidence-panel.tsx / capa-evidence-list.tsx) — never bare `li`: a CAPA
  // action is itself an `<li>` in the actions list, and its accumulated text
  // content includes every nested evidence row's title, so a bare `li` filter
  // resolves to BOTH the action card and the evidence row (a strict-mode
  // violation caught by running this, not assumed away).
  const row = page.locator('li.animate-rise-in').filter({ hasText: title })
  await expect(row, 'the uploaded evidence row appears in the panel').toBeVisible({ timeout: 15_000 })

  // DB truth: a real rca_evidence row, kind=document, referencing a verified file.
  const [ev] = await svcGet<{ id: string; kind: string; document_id: string; rca_id: string }>(
    request,
    `rca_evidence?rca_id=eq.${RCA_ID}&title=eq.${encodeURIComponent(title)}&select=id,kind,document_id,rca_id`,
  )
  expect(ev, 'the evidence row was created').toBeTruthy()
  expect(ev.kind).toBe('document')
  const [dv] = await svcGet<{ id: string }>(
    request,
    `document_versions?document_id=eq.${ev.document_id}&select=id&order=version_number.desc&limit=1`,
  )
  const [vf] = await svcGet<{ file_object_id: string }>(
    request,
    `document_version_files?document_version_id=eq.${dv.id}&rendition_kind=eq.source&select=file_object_id`,
  )
  const [fo] = await svcGet<{ size_bytes: number; sha256: string | null; upload_state: string }>(
    request,
    `file_objects?id=eq.${vf.file_object_id}&select=size_bytes,sha256,upload_state`,
  )
  expect(fo.upload_state, 'the real PUT was verified').toBe('unscanned_accepted')
  expect(Number(fo.size_bytes)).toBe(payload.buffer.length)
  expect(fo.sha256).toBe(sha256Hex(payload.buffer))

  // Byte round trip through the click-time audited door (openRcaEvidence).
  const openButton = row.getByRole('button', { name: `Abrir ${title}` })
  await expect(openButton).toBeVisible()
  const signedUrl = await clickAndCapturePopup(page, openButton)
  expect(signedUrl).toMatch(/\/storage\/v1\/object\/sign\//)
  const bytes = await fetchBytes(page, signedUrl)
  expect(Buffer.compare(bytes, payload.buffer), 'byte-for-byte identical').toBe(0)
})

// ===========================================================================
// 2 — THE UPLOAD-KIND E2E THE SUITE HAS NEVER HAD (CAPA) — also the UI-level
// validation that BUG-DM5-CAPA-1's fix works end to end, not merely via RPC.
// ===========================================================================

test('EVID-CAPA-UPLOAD-1: a CAPA implementation-evidence file makes the full round trip through the real browser corridor — validates BUG-DM5-CAPA-1 through the UI, not only the RPC', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  const marker = `capa-up-${Date.now()}`
  const payload = uniquePdf(marker)
  const title = `Evidência Upload ${marker}`

  const actorToken = await accessToken(request, RCA_ACTOR_EMAIL)
  const { capaId } = await openFreshCapaAction(request, actorToken, marker)

  await cachedSignIn(page, RCA_ACTOR_EMAIL)
  await page.goto(capaPath(capaId))
  await expectCapaWorkspaceRendered(page)

  await page.getByRole('button', { name: 'Enviar arquivo' }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  await dialog.getByLabel('Arquivo').setInputFiles(payload)
  await dialog.getByLabel('Título').fill(title)
  await dialog.getByRole('button', { name: /^enviar arquivo$/i }).click()

  await expect(dialog).toBeHidden({ timeout: 30_000 })
  // Scoped to `li.animate-rise-in` — the evidence-row's OWN class, both homes
  // (rca-evidence-panel.tsx / capa-evidence-list.tsx) — never bare `li`: a CAPA
  // action is itself an `<li>` in the actions list, and its accumulated text
  // content includes every nested evidence row's title, so a bare `li` filter
  // resolves to BOTH the action card and the evidence row (a strict-mode
  // violation caught by running this, not assumed away).
  const row = page.locator('li.animate-rise-in').filter({ hasText: title })
  await expect(row, 'the uploaded evidence row appears — proving the CAPA upload policy pair now agrees (BUG-DM5-CAPA-1)').toBeVisible({
    timeout: 15_000,
  })

  const [ev] = await svcGet<{ id: string; kind: string; document_id: string }>(
    request,
    `capa_action_evidence?title=eq.${encodeURIComponent(title)}&select=id,kind,document_id`,
  )
  expect(ev, 'the evidence row was created').toBeTruthy()
  expect(ev.kind).toBe('document')

  const openButton = row.getByRole('button', { name: `Abrir ${title}` })
  await expect(openButton).toBeVisible()
  const signedUrl = await clickAndCapturePopup(page, openButton)
  const bytes = await fetchBytes(page, signedUrl)
  expect(Buffer.compare(bytes, payload.buffer), 'byte-for-byte identical').toBe(0)
})

// ===========================================================================
// 3 — KEYBOARD-ONLY begin → PUT → finalize (CLAUDE.md §8's per-phase requirement)
// ===========================================================================

test('EVID-KBD-1: keyboard-only — Tab to "Enviar arquivo", fill the dialog by keyboard, submit with Enter, and Tab+Enter to open the result, receiving byte-identical content', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  const marker = `kbd-${Date.now()}`
  const payload = uniquePdf(marker)
  const title = `Evidência Teclado ${marker}`

  const actorToken = await accessToken(request, RCA_ACTOR_EMAIL)
  await ensureRcaWritable(request, actorToken)

  await cachedSignIn(page, RCA_ACTOR_EMAIL)
  await page.goto(RCA_PATH)
  await expectRcaWorkspaceRendered(page)

  // Keyboard-navigate to the "Enviar arquivo" trigger (never `.focus()` —
  // races RSC streaming, memory `playwright-focus-is-not-auto-waiting`).
  await page.locator('body').click({ position: { x: 2, y: 2 } })
  await focusByTabbing(page, async () => {
    const focused = page.locator(':focus')
    if ((await focused.count()) === 0) return false
    const text = (await focused.textContent().catch(() => '')) ?? ''
    return text.trim() === 'Enviar arquivo'
  })
  await expect(page.locator(':focus'), 'a visible focus ring is part of the contract (CLAUDE.md §8)').toBeFocused()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  // The OS file picker itself cannot be driven by keyboard input from
  // Playwright — `setInputFiles` is the accepted substitute (same convention
  // as every upload spec in this suite); everything AROUND it is keyboard-only.
  await dialog.getByLabel('Arquivo').setInputFiles(payload)

  await focusByTabbing(page, async () => {
    const focused = page.locator(':focus')
    if ((await focused.count()) === 0) return false
    const id = await focused.getAttribute('id')
    return id === (await dialog.getByLabel('Título').getAttribute('id'))
  })
  await page.keyboard.type(title)

  await focusByTabbing(page, async () => {
    const focused = page.locator(':focus')
    if ((await focused.count()) === 0) return false
    const text = (await focused.textContent().catch(() => '')) ?? ''
    return text.trim() === 'Enviar arquivo'
  })
  await page.keyboard.press('Enter')

  await expect(dialog, 'the dialog closes once the keyboard-driven begin→PUT→finalize completes').toBeHidden({
    timeout: 30_000,
  })
  // Scoped to `li.animate-rise-in` — the evidence-row's OWN class, both homes
  // (rca-evidence-panel.tsx / capa-evidence-list.tsx) — never bare `li`: a CAPA
  // action is itself an `<li>` in the actions list, and its accumulated text
  // content includes every nested evidence row's title, so a bare `li` filter
  // resolves to BOTH the action card and the evidence row (a strict-mode
  // violation caught by running this, not assumed away).
  const row = page.locator('li.animate-rise-in').filter({ hasText: title })
  await expect(row).toBeVisible({ timeout: 15_000 })

  const openButton = row.getByRole('button', { name: `Abrir ${title}` })
  await page.locator('body').click({ position: { x: 2, y: 2 } })
  await focusByTabbing(page, async () => {
    const focused = page.locator(':focus')
    if ((await focused.count()) === 0) return false
    return (await focused.getAttribute('aria-label')) === `Abrir ${title}`
  })
  await expect(openButton).toBeFocused()

  const downloadPromise = page.context().waitForEvent('download', { timeout: 8_000 }).catch(() => null)
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.keyboard.press('Enter')])
  const download = await downloadPromise
  const url = download ? download.url() : popup.url()
  await popup.close().catch(() => {})

  const bytes = await fetchBytes(page, url)
  expect(
    Buffer.compare(bytes, payload.buffer),
    'a keyboard-only user received the exact bytes through the audited door',
  ).toBe(0)
})

// ===========================================================================
// 4 — REGRESSION: link kind still works, RCA + CAPA
// ===========================================================================

test('EVID-RCA-LINK-1: adding an external link as RCA evidence via the UI still works', async ({ page, request }) => {
  test.setTimeout(60_000)
  const marker = `rca-link-${Date.now()}`
  const title = `Link ${marker}`
  const url = `https://example.com/evidencia-${marker}`

  const actorToken = await accessToken(request, RCA_ACTOR_EMAIL)
  await ensureRcaWritable(request, actorToken)

  await cachedSignIn(page, RCA_ACTOR_EMAIL)
  await page.goto(RCA_PATH)
  await expectRcaWorkspaceRendered(page)

  await page.getByRole('button', { name: 'Adicionar link' }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await dialog.getByLabel('Título').fill(title)
  await dialog.getByLabel('URL').fill(url)
  await dialog.getByRole('button', { name: /^adicionar link$/i }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })

  // Scoped to `li.animate-rise-in` — the evidence-row's OWN class, both homes
  // (rca-evidence-panel.tsx / capa-evidence-list.tsx) — never bare `li`: a CAPA
  // action is itself an `<li>` in the actions list, and its accumulated text
  // content includes every nested evidence row's title, so a bare `li` filter
  // resolves to BOTH the action card and the evidence row (a strict-mode
  // violation caught by running this, not assumed away).
  const row = page.locator('li.animate-rise-in').filter({ hasText: title })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(row.getByRole('link', { name: `Abrir ${title}` })).toHaveAttribute('href', url)

  const [ev] = await svcGet<{ kind: string; external_url: string }>(
    request,
    `rca_evidence?rca_id=eq.${RCA_ID}&title=eq.${encodeURIComponent(title)}&select=kind,external_url`,
  )
  expect(ev.kind).toBe('link')
  expect(ev.external_url).toBe(url)
})

test('EVID-CAPA-LINK-1: adding an external link as CAPA implementation evidence via the UI still works', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)
  const marker = `capa-link-${Date.now()}`
  const title = `Link ${marker}`
  const url = `https://example.com/evidencia-${marker}`

  const actorToken = await accessToken(request, RCA_ACTOR_EMAIL)
  const { capaId } = await openFreshCapaAction(request, actorToken, marker)

  await cachedSignIn(page, RCA_ACTOR_EMAIL)
  await page.goto(capaPath(capaId))
  await expectCapaWorkspaceRendered(page)

  await page.getByRole('button', { name: 'Adicionar link' }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await dialog.getByLabel('Título').fill(title)
  await dialog.getByLabel('URL').fill(url)
  await dialog.getByRole('button', { name: /^adicionar link$/i }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })

  // Scoped to `li.animate-rise-in` — the evidence-row's OWN class, both homes
  // (rca-evidence-panel.tsx / capa-evidence-list.tsx) — never bare `li`: a CAPA
  // action is itself an `<li>` in the actions list, and its accumulated text
  // content includes every nested evidence row's title, so a bare `li` filter
  // resolves to BOTH the action card and the evidence row (a strict-mode
  // violation caught by running this, not assumed away).
  const row = page.locator('li.animate-rise-in').filter({ hasText: title })
  await expect(row).toBeVisible({ timeout: 10_000 })

  const [ev] = await svcGet<{ kind: string; external_url: string }>(
    request,
    `capa_action_evidence?title=eq.${encodeURIComponent(title)}&select=kind,external_url`,
  )
  expect(ev.kind).toBe('link')
  expect(ev.external_url).toBe(url)
})

// ---------------------------------------------------------------------------
// Citation regression — NOTE on scope (re-verified after BUG-DM5-S2-CITATION-
// TARGETS-1 landed, `e307a979`).
//
// The RCA citation form's INTERVIEW/MEETING targets (the pre-existing kinds)
// are RPC-proven already by `phase14c-rca.spec.ts` R8 — not duplicated here.
//
// BUG-DM5-S2-CITATION-TARGETS-1 is FIXED: `listRcaCitationTargets`
// (src/lib/queries/rca.ts) now queries `documents` — scoped to the event's
// case, `securable_resources.resource_type = 'case'`, `status = 'active'`,
// RLS-bounded rather than hand-filtered (verified by reading the landed
// function, not assumed from the commit message). The document target is a
// real, offerable citation candidate as of this fix.
//
// A UI-driven citation test (any kind, including the new document target) is
// STILL not written in this file, for a reason that is now ENTIRELY
// orthogonal to DM5: `listRcaCitationTargets` early-returns `[]` whenever the
// event carries no `case_id` (`if (!caseId) return []`), and the ONLY seeded
// RCA (RCA_ID, event EV-0003) has `patient_safety_event.case_id = NULL` —
// verified against the live catalog: of the five seeded events, only EV-0001
// carries a case_id, and no RCA is seeded against EV-0001. No RPC exists to
// backfill an event's case_id after creation. So the citation picker's
// "Citar registro" control cannot be made non-empty for any seeded RCA through
// a legitimate product path, for ANY of the three targets — a PRE-EXISTING
// fixture limitation that predates DM5 and would need a new RCA-with-case
// fixture (or a triage-pathway RPC this suite does not have) to close, not a
// spec change here.
// ---------------------------------------------------------------------------

// ===========================================================================
// 5 — AVAILABILITY STATES the UI has never had to render, because a
// caller-minted path could never be non-servable (ADR 0120 / S2 contract).
// Fixtures built via the REAL RPCs (never a raw table write for anything
// RLS/RPC-gated); only the ASSERTION is UI-driven.
// ===========================================================================

// ---------------------------------------------------------------------------
// `pending` — RETIRED as an E2E claim, deliberately, not merely removed.
//
// `pending` is NOT reachable through the real corridor: `finalizeRcaEvidenceUpload`
// / `finalizeCapaEvidenceUpload` create the evidence row only AFTER
// `finalizeDocumentUpload` (service-role download + sha256 +
// `complete_document_upload_verification`) has already resolved the file to
// `unscanned_accepted` or `failed` — verified by reading the landed action
// bodies, not inferred. There is no window in which a reader can observe a
// live evidence row whose file is still `reserved`/`uploaded`/`verifying`/
// `scan_pending`; an E2E fixture that inserted the evidence row before
// finalize (an earlier draft of this file did exactly that) was asserting a
// state the product cannot produce — dead vocabulary that reads as live
// behaviour, the same shape as the `unavailable`/`HC0DM` near-misses this
// phase already hit twice.
//
// The mapping itself is real and load-bearing (ADR 0114 O2's scanner is an
// OPEN PO item; the day it lands, `finalize` stops collapsing and `pending`
// becomes observable), so the claim belongs where it can be made honestly:
// `nspEvidenceAvailability` in `src/lib/safety/evidence-contract.ts` is a
// PURE, TOTAL function, and `evidence-contract.test.ts` pins it exhaustively
// — all 10 `upload_state` values (confirmed: `reserved`/`uploaded`/
// `verifying`/`scan_pending` → `pending`), the disposal-outranks-upload
// precedence in both directions, the document-status arm, and the
// conservative unknown-state fallback. Read, not merely trusted: verified
// line-by-line against the file this comment sits beside. Nothing belongs in
// `e2e/**` for this state — an E2E replaying what a unit test already proves
// would only reintroduce the corridor-claim risk this retirement exists to end.
// ---------------------------------------------------------------------------

test('EVID-RCA-AVAIL-UNAVAILABLE-1: evidence whose backing document was soft-deleted renders as "unavailable" — distinct from "disposed": remove IS offered, record survives', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)
  const marker = `unavailable-${Date.now()}`
  const title = `Evidência Removida ${marker}`
  const payload = uniquePdf(marker)

  const actorToken = await accessToken(request, RCA_ACTOR_EMAIL)
  await ensureRcaWritable(request, actorToken)

  // Drive the full real round trip to `available` first — the same discipline
  // as the disposed fixture, and for the same reason: whatever order
  // `finalizeRcaEvidenceUpload` creates the row in, a document that has
  // GENUINELY resolved to available before its soft-delete is the state a real
  // user's document would have been in.
  const begun = await beginEvidenceUpload(request, actorToken, {
    resourceType: 'rca',
    resourceId: RCA_ID,
    title,
    declaredSize: payload.buffer.length,
  })
  expect(begun.ok, `begin_document_upload(rca): ${JSON.stringify(begun.body)}`).toBeTruthy()
  const reservation = begun.body as BeginUploadResult

  await putBytesServiceRole(request, reservation.file_object_id, payload.buffer, 'application/pdf')
  const finalized = await finalizeUpload(request, actorToken, reservation.upload_session_id)
  expect(finalized.ok, `finalize_document_upload: ${JSON.stringify(finalized.body)}`).toBeTruthy()
  const verified = await verifyUploadServiceRole(request, reservation.upload_session_id, sha256Hex(payload.buffer), true)
  expect(verified.ok, `complete_document_upload_verification: ${JSON.stringify(verified.body)}`).toBeTruthy()

  const evResp = await rpc(request, 'add_rca_evidence', actorToken, {
    p_rca_id: RCA_ID,
    p_kind: 'document',
    p_title: title,
    p_document_id: reservation.document_id,
  })
  expect(evResp.ok(), `add_rca_evidence(document): ${await evResp.text()}`).toBeTruthy()

  // The state-producing action: NOT disposal (`request_document_disposition`,
  // a retention/governance action) but a plain soft-delete of the SOURCE
  // document — a different RPC, a different cause, and per the contract's own
  // precedence rules this must project as `unavailable`, never `disposed` or
  // `failed`.
  const softDelResp = await rpc(request, 'soft_delete_document', actorToken, {
    p_document_id: reservation.document_id,
  })
  expect(softDelResp.ok(), `soft_delete_document: ${await softDelResp.text()}`).toBeTruthy()

  await cachedSignIn(page, RCA_ACTOR_EMAIL)
  await page.goto(RCA_PATH)
  await expectRcaWorkspaceRendered(page)

  // Scoped to `li.animate-rise-in` — the evidence-row's OWN class, both homes
  // (rca-evidence-panel.tsx / capa-evidence-list.tsx) — never bare `li`: a CAPA
  // action is itself an `<li>` in the actions list, and its accumulated text
  // content includes every nested evidence row's title, so a bare `li` filter
  // resolves to BOTH the action card and the evidence row (a strict-mode
  // violation caught by running this, not assumed away).
  const row = page.locator('li.animate-rise-in').filter({ hasText: title })
  await expect(row, 'the evidence RECORD survives the document soft-delete').toBeVisible({ timeout: 10_000 })
  await expect(
    row.getByText('O documento desta evidência foi removido e não pode mais ser aberto'),
    'the unavailable-specific sentence, never the failed or disposed wording',
  ).toBeVisible()
  await expect(row.getByRole('button', { name: `Abrir ${title}` }), 'no open control — nothing to open').toHaveCount(0)
  await expect(
    row.getByRole('button', { name: `Remover ${title}` }),
    'remove IS offered for unavailable — unlike disposed, the evidence row itself is still a legitimate tidy-up target, not a tombstone',
  ).toBeVisible()
})

test('EVID-CAPA-AVAIL-FAILED-1: an upload that failed byte verification renders as "failed" — remove offered, no open control', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)
  const marker = `failed-${Date.now()}`
  const title = `Evidência Falhou ${marker}`
  const payload = uniquePdf(marker)

  const actorToken = await accessToken(request, RCA_ACTOR_EMAIL)
  const { capaId, actionId } = await openFreshCapaAction(request, actorToken, marker)

  const begun = await beginEvidenceUpload(request, actorToken, {
    resourceType: 'capa_action',
    resourceId: actionId,
    title,
    declaredSize: payload.buffer.length,
  })
  expect(begun.ok, `begin_document_upload(capa_action): ${JSON.stringify(begun.body)}`).toBeTruthy()
  const reservation = begun.body as BeginUploadResult

  const evResp = await rpc(request, 'add_capa_action_evidence', actorToken, {
    p_action_id: actionId,
    p_kind: 'document',
    p_title: title,
    p_document_id: reservation.document_id,
  })
  expect(evResp.ok(), `add_capa_action_evidence(document, failed): ${await evResp.text()}`).toBeTruthy()

  await putBytesServiceRole(request, reservation.file_object_id, payload.buffer, 'application/pdf')
  const finalized = await finalizeUpload(request, actorToken, reservation.upload_session_id)
  expect(finalized.ok, `finalize_document_upload: ${JSON.stringify(finalized.body)}`).toBeTruthy()
  // verified=false — the byte-landed-but-failed-verification path (DM2 QA r1 MAJOR-3).
  const verified = await verifyUploadServiceRole(request, reservation.upload_session_id, sha256Hex(payload.buffer), false)
  expect(verified.ok, `complete_document_upload_verification(verified=false): ${JSON.stringify(verified.body)}`).toBeTruthy()

  await cachedSignIn(page, RCA_ACTOR_EMAIL)
  await page.goto(capaPath(capaId))
  await expectCapaWorkspaceRendered(page)

  // Scoped to `li.animate-rise-in` — the evidence-row's OWN class, both homes
  // (rca-evidence-panel.tsx / capa-evidence-list.tsx) — never bare `li`: a CAPA
  // action is itself an `<li>` in the actions list, and its accumulated text
  // content includes every nested evidence row's title, so a bare `li` filter
  // resolves to BOTH the action card and the evidence row (a strict-mode
  // violation caught by running this, not assumed away).
  const row = page.locator('li.animate-rise-in').filter({ hasText: title })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(row.getByText('O envio deste arquivo não foi concluído')).toBeVisible()
  await expect(row.getByRole('button', { name: `Abrir ${title}` }), 'no open control for a failed upload').toHaveCount(0)
  await expect(row.getByRole('button', { name: `Remover ${title}` }), 'remove IS offered — the recovery path').toBeVisible()
})

// ===========================================================================
// The `failed` companion this file does NOT build, and the reason is now
// MEASURED, not a shrug: the exact terminal-verification-failure branch
// (bytes genuinely LANDED, then failed a SEPARATE, later verification step)
// requires a fault-injection point this test harness cannot reach.
//
// Two real attempts, each diagnosed against the landed code, not guessed:
//
// 1. Fake the PUT response with a 200 WITHOUT forwarding to real Storage.
//    Result: the dialog showed "O arquivo não chegou por completo" —
//    NON-terminal. Reading `finalize_document_upload` explains why: it
//    queries `storage.objects` for the object BEFORE anything else
//    (`select … from storage.objects o where o.bucket_id = … and o.name = …`)
//    and raises `HC0D9` (→ `upload_incomplete`, no `terminal` flag) if it is
//    absent. A never-forwarded PUT never creates that row, so the RPC refuses
//    at its FIRST check — the ordinary "nothing was ever uploaded" path.
//
// 2. Let the PUT land for REAL against Storage (`route.fetch()`), then delete
//    the object via service role BEFORE returning the response to the
//    browser — deterministic (the delete completes before the browser's
//    fetch can resolve; verified live: PUT 200, regex match on the signed
//    URL, delete 200 "Successfully deleted", all logged). Result: STILL
//    NON-terminal, same message. The reason is the same catalog read: my
//    delete lands before `finalize()` (the server action) ever calls
//    `finalize_document_upload`, so the RPC's `storage.objects` check STILL
//    finds nothing and STILL raises the non-terminal `HC0D9` — deleting
//    early only reproduces attempt 1 by a different route.
//
// The terminal branch needs the OPPOSITE ordering: the object must EXIST when
// `finalize_document_upload` runs (so it transitions the file to `verifying`
// and returns normally), and then become unreadable strictly AFTER that RPC
// call returns but BEFORE the SEPARATE, LATER call in
// `finalizeDocumentUpload` (`src/lib/documents/actions.ts`) —
// `admin.storage.download(...)` — runs. Both calls happen INSIDE ONE Next.js
// server action, server-to-Supabase, and NEITHER crosses the browser's
// network stack at any point `page.route()` can see. There is no seam here
// for a browser-side interception to land in between — not a timing problem
// a longer wait or a retry would fix, a genuine absence of an interceptable
// boundary. Deliberately not attempting a timing race to force it: that is
// the exact "simulates rather than exercises" failure mode already ruled out
// for `pending`, and it would be no more honest here.
//
// So, same discipline applied symmetrically: the LIST-rendering `failed` test
// above (`EVID-CAPA-AVAIL-FAILED-1`) stays as the coverage for this state —
// it is real, RPC-built, and passing. The LIVE in-dialog terminal UX
// (`EvidenceUploadDialog`'s `terminal` branch: no retry, "Remover e enviar
// novamente") remains UNEXERCISED by any test in this repo, and that is
// reported as a gap, not quietly closed by something that only looks like a
// browser-driven proof. A future path if this needs to be closed: a
// test-only server hook that lets a spec force `finalizeDocumentUpload`'s
// verification outcome directly — out of scope for `tester` to build (it
// would be application code), and worth a deliberate call by backend/PO on
// whether the coverage gap is worth that surface area.
// ===========================================================================

test('EVID-RCA-AVAIL-DISPOSED-1: evidence whose backing document has been disposed renders as "disposed" — no open, no remove, record survives', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)
  const marker = `disposed-${Date.now()}`
  const title = `Evidência Eliminada ${marker}`
  const payload = uniquePdf(marker)

  const actorToken = await accessToken(request, RCA_ACTOR_EMAIL)
  await ensureRcaWritable(request, actorToken)

  const begun = await beginEvidenceUpload(request, actorToken, {
    resourceType: 'rca',
    resourceId: RCA_ID,
    title,
    declaredSize: payload.buffer.length,
  })
  expect(begun.ok, `begin_document_upload(rca): ${JSON.stringify(begun.body)}`).toBeTruthy()
  const reservation = begun.body as BeginUploadResult

  const evResp = await rpc(request, 'add_rca_evidence', actorToken, {
    p_rca_id: RCA_ID,
    p_kind: 'document',
    p_title: title,
    p_document_id: reservation.document_id,
  })
  expect(evResp.ok(), `add_rca_evidence(document, disposed): ${await evResp.text()}`).toBeTruthy()

  await putBytesServiceRole(request, reservation.file_object_id, payload.buffer, 'application/pdf')
  const finalized = await finalizeUpload(request, actorToken, reservation.upload_session_id)
  expect(finalized.ok, `finalize_document_upload: ${JSON.stringify(finalized.body)}`).toBeTruthy()
  const verified = await verifyUploadServiceRole(request, reservation.upload_session_id, sha256Hex(payload.buffer), true)
  expect(verified.ok, `complete_document_upload_verification: ${JSON.stringify(verified.body)}`).toBeTruthy()

  const disposeResp = await rpc(request, 'request_document_disposition', actorToken, {
    p_document_id: reservation.document_id,
    p_reason: 'entered_in_error',
  })
  expect(disposeResp.ok(), `request_document_disposition: ${await disposeResp.text()}`).toBeTruthy()

  await cachedSignIn(page, RCA_ACTOR_EMAIL)
  await page.goto(RCA_PATH)
  await expectRcaWorkspaceRendered(page)

  // Scoped to `li.animate-rise-in` — the evidence-row's OWN class, both homes
  // (rca-evidence-panel.tsx / capa-evidence-list.tsx) — never bare `li`: a CAPA
  // action is itself an `<li>` in the actions list, and its accumulated text
  // content includes every nested evidence row's title, so a bare `li` filter
  // resolves to BOTH the action card and the evidence row (a strict-mode
  // violation caught by running this, not assumed away).
  const row = page.locator('li.animate-rise-in').filter({ hasText: title })
  await expect(row, 'the evidence RECORD survives disposal — only the bytes are gone').toBeVisible({ timeout: 10_000 })
  await expect(row.getByText('O arquivo foi eliminado conforme a política de retenção')).toBeVisible()
  await expect(row.getByRole('button', { name: `Abrir ${title}` }), 'no open control for disposed evidence').toHaveCount(0)
  await expect(
    row.getByRole('button', { name: `Remover ${title}` }),
    'no remove control either — a disposed row is terminal, not offering to delete a tombstone',
  ).toHaveCount(0)
})
