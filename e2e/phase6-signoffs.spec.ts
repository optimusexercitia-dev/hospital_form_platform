import { test, expect, type Page } from '@playwright/test'

/**
 * Phase 6 — Section Sign-offs & Submission Lifecycle
 *
 * Test contract: translates every bullet in PHASES.md §Phase 6 Acceptance into
 * Playwright assertions. Runs against the LOCAL Supabase stack (seeded personas).
 *
 * Seeded forms (from supabase/seed.sql):
 *   FORM B (farmacia, sectioned): "Inspeção de Armazenamento de Medicamentos"
 *     v1 = 50000000-…-b001. Sections:
 *       S0 (default intro): section_text only
 *       S1 "Armazenamento geral": organizacao_estoque (MC req),
 *            possui_termolabeis (MC req)
 *       S2 "Controle de temperatura" [CONDITIONAL when possui_termolabeis='Sim']
 *       S3 "Conformidade e validades" [requires_signoff = respondent]:
 *            section id c0000000-…-b003, sem_vencidos (MC req)
 *       S4 "Revisão da chefia" [requires_signoff = staff_admin]:
 *            section id c0000000-…-b004, parecer_chefia (free_text opt)
 *
 *   Seed in_progress fixture (the queue/end-to-end driver):
 *     response e0000000-…-e1, by staff1.farm@test.local, submit-ready,
 *     possui_termolabeis='Não' (S2 hidden), RESPONDENT section (b003) already
 *     SIGNED, staff_admin section (b004) UNSIGNED → sits in chefe.farm's queue.
 *
 * Personas (password Test1234!):
 *   chefe.farm@test.local  staff_admin of farmacia (the counter-signer)
 *   staff1.farm@test.local staff of farmacia (owner of the seeded e1 response)
 *   staff2.farm@test.local staff of farmacia (fresh respondent flows)
 *
 * CRITICAL: run `npx supabase db reset` before each full run — the seeded e1
 * staff_admin section gets signed by these specs (and during dev verification),
 * and several tests mutate state (signing, submitting). Reset restores the
 * unsigned fixture. Run with --workers=1 (DB-state contamination otherwise).
 */

test.use({ viewport: { width: 1280, height: 900 } })

// Disable CSS animations so section transitions (animate-fade-in) complete
// instantly — clicking a control immediately after a transition can otherwise
// race the animation (same hardening Phase 5 used).
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants — local Supabase
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'http://127.0.0.1:54321'
// Local Supabase service-role key, read from .env.local (loaded by the Playwright
// config via @next/env) — never hardcoded. Bypasses RLS; used only to inspect DB
// state in assertions, never to mutate application data under test.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

const SEED_RESPONSE_E1 = 'e0000000-0000-0000-0000-0000000000e1'
const SECTION_RESPONDENT = 'c0000000-0000-0000-0000-00000000b003' // "Conformidade e validades"
const SECTION_STAFF_ADMIN = 'c0000000-0000-0000-0000-00000000b004' // "Revisão da chefia"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 20_000,
  })
}

async function signOut(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0))
  const userMenu = page.getByRole('button', { name: /abrir menu da conta/i })
  await userMenu.click()
  const sairItem = page.getByRole('menuitem', { name: /sair/i })
  await expect(sairItem).toBeVisible({ timeout: 5_000 })
  await sairItem.click()
  await page.waitForURL('**/login', { timeout: 15_000 })
}

/** Service-role read of the sign-off rows for a response (assert on DB truth). */
async function signoffSections(page: Page, responseId: string): Promise<string[]> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/response_section_signoffs?response_id=eq.${responseId}&select=section_id`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const rows = (await resp.json()) as Array<{ section_id: string }>
  return rows.map((r) => r.section_id)
}

/** Service-role read of a response's status. */
async function responseStatus(page: Page, responseId: string): Promise<string | null> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/responses?id=eq.${responseId}&select=status`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const rows = (await resp.json()) as Array<{ status: string }>
  return rows[0]?.status ?? null
}

/**
 * Open Form B (farmacia, sectioned) in the wizard — starting fresh or resuming
 * the caller's existing draft — and reach the review screen, filling every
 * required answer (taking the 'Não' branch so the S2 conditional stays hidden).
 * Resume-safe: if the response resumes mid-wizard, it advances/fills as needed
 * until the review heading is reached. Leaves both sign-off sections UNSIGNED
 * (unless they were already signed on resume). Returns the wizard's responseId.
 */
async function fillFormBToReview(page: Page, slug = 'farmacia'): Promise<string> {
  await page.goto(`/c/${slug}/forms`)
  await page.waitForURL(`**/c/${slug}/forms`, { timeout: 15_000 })
  await expect(page.locator('article').first()).toBeVisible({ timeout: 15_000 })

  const card = page
    .locator('article')
    .filter({ hasText: /Inspeção de Armazenamento/i })
  const continuar = card.getByRole('link', { name: /continuar preenchimento/i })
  const preencher = card.getByRole('button', { name: /preencher/i })
  await expect(continuar.or(preencher).first()).toBeVisible({ timeout: 15_000 })
  if (await continuar.first().isVisible()) {
    await continuar.first().click()
  } else {
    await preencher.first().click()
  }
  await page.waitForURL(/\/responder\//, { timeout: 20_000 })

  const match = page.url().match(/\/responder\/([0-9a-f-]{36})/)
  expect(match).toBeTruthy()
  const responseId = match![1]

  // Drive the wizard to the review screen. The wizard may open on any section
  // (fresh → S0; resumed → last_section_id). We fill each section as it appears
  // and advance until "Revise suas respostas" is shown. To avoid racing section
  // transition reconciliation, after each advance we wait for the step label
  // ("Seção N de M") to change before the next iteration.
  const reviewHeading = page.getByRole('heading', { name: /Revise suas respostas/i })
  const stepLabel = page.getByText(/Seção \d+ de \d+/i).first()

  for (let step = 0; step < 8; step++) {
    if (await reviewHeading.isVisible().catch(() => false)) break

    // Remember the current step label so we can wait for it to change.
    const prevLabel = (await stepLabel.textContent().catch(() => null)) ?? ''

    // Fill S1 inputs if present.
    const armazenamento = page.getByText('Armazenamento geral').first()
    if (await armazenamento.isVisible().catch(() => false)) {
      const orgSim = page.getByRole('radio', { name: 'Sim' }).first()
      await orgSim.click()
      await expect(orgSim).toBeChecked({ timeout: 5_000 })
      const termoNao = page.getByRole('radio', { name: 'Não' }).nth(1)
      await termoNao.click()
      await expect(termoNao).toBeChecked({ timeout: 5_000 })
    }

    // Fill S3 (respondent sign-off section) input if present.
    const s3 = page.getByRole('region', { name: /Conformidade e validades/i })
    if (await s3.isVisible().catch(() => false)) {
      const s3Sim = s3.getByRole('radio', { name: 'Sim' }).first()
      await s3Sim.click()
      await expect(s3Sim).toBeChecked({ timeout: 5_000 })
    }

    // Advance: "Revisar" on the last section, else "Próximo".
    const revisar = page.getByRole('button', { name: /revisar/i })
    const proximo = page.getByRole('button', { name: /próximo/i })
    if (await revisar.isVisible().catch(() => false)) {
      await revisar.click()
      // After "Revisar" the review heading replaces the wizard — done.
      await expect(reviewHeading).toBeVisible({ timeout: 15_000 })
      break
    } else if (await proximo.isVisible().catch(() => false)) {
      await proximo.click()
      // Wait for the section transition: the step label must change (the save +
      // advance round-trips through the server action).
      await expect
        .poll(async () => (await stepLabel.textContent().catch(() => null)) ?? '', {
          timeout: 15_000,
        })
        .not.toBe(prevLabel)
    } else {
      break
    }
  }

  await expect(reviewHeading).toBeVisible({ timeout: 15_000 })
  return responseId
}

// ---------------------------------------------------------------------------
// AC1 — Respondent-signed flow + AC3 server-rejection (combined: same response)
//
// A staff member fills Form B, signs the respondent section inline in the
// review screen, and the submit affordance is GATED until the staff_admin
// section is also satisfied. We assert: the respondent sign records a row
// (DB truth + F4 badge), and the SERVER rejects an attempt to submit while the
// staff_admin sign-off is still missing (AC3, P0012 pt-BR message). The end of
// the lifecycle (submission succeeds once all sign-offs are satisfied) is
// proven in the dedicated end-to-end test below.
// ---------------------------------------------------------------------------

test('AC1/AC3 — respondent signs inline; submit stays blocked + server rejects missing staff_admin sign-off', async ({
  page,
}) => {
  test.setTimeout(150_000)

  await signInAs(page, 'staff2.farm@test.local')
  const responseId = await fillFormBToReview(page)

  // Both sign-off sections start unsigned.
  expect(await signoffSections(page, responseId)).toHaveLength(0)

  // The respondent sign-off section shows the inline "Assinar e confirmar esta
  // seção" affordance (respondent role).
  const signBtn = page.getByRole('button', { name: /Assinar e confirmar esta seção/i })
  await expect(signBtn).toBeVisible({ timeout: 10_000 })

  // Before signing, submit is gated client-side with the pt-BR reason.
  await expect(
    page.getByText(/Há seções pendentes de assinatura/i).first(),
  ).toBeVisible()

  // Sign the respondent section.
  await signBtn.click()

  // F4 badge appears: "Assinado por <name> em <DATA>" (AC6 metadata visible).
  await expect(
    page.getByText(/Assinado por .* em \d{2}\/\d{2}\/\d{4}/i).first(),
  ).toBeVisible({ timeout: 15_000 })

  // DB truth: exactly the respondent section is signed now.
  await expect
    .poll(async () => signoffSections(page, responseId), { timeout: 10_000 })
    .toEqual([SECTION_RESPONDENT])

  // Submit is STILL blocked — the staff_admin section is unsigned.
  await expect(
    page.getByText(/Há seções pendentes de assinatura/i).first(),
  ).toBeVisible()
  const submitBtn = page.getByRole('button', { name: /Enviar respostas/i })
  await expect(submitBtn).toBeDisabled()

  // AC3 — the SERVER is the authority. The client gate disables the button, so
  // we invoke `submit_response` directly AS THE RESPONSE OWNER (a real password
  // session, RLS evaluated under their JWT) — proving the server, not the
  // client, rejects a submit while the staff_admin sign-off is missing (P0012).
  const tokenResp = await page.request.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
      data: { email: 'staff2.farm@test.local', password: 'Test1234!' },
    },
  )
  expect(tokenResp.ok()).toBeTruthy()
  const ownerToken = (await tokenResp.json()).access_token as string
  expect(ownerToken).toBeTruthy()

  const rpc = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/submit_response`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_response_id: responseId },
    },
  )
  // submit_response raises HC012 (renamed from P0012 — P7-002 resolved).
  // PostgREST now returns structured JSON for HC-class codes, so the error
  // body contains the SQLSTATE code we can assert directly.
  expect(rpc.ok()).toBeFalsy()
  const body = await rpc.json()
  expect(JSON.stringify(body)).toMatch(/HC012/)

  // The response is still in_progress — not submitted.
  expect(await responseStatus(page, responseId)).toBe('in_progress')
})

// ---------------------------------------------------------------------------
// AC2 — staff_admin-signed flow end-to-end INCLUDING the pending queue
//
// The seeded e1 response (staff1.farm, respondent section already signed,
// staff_admin section unsigned) surfaces in chefe.farm's queue. The coordinator
// opens the review-and-sign screen, reviews read-only, signs with a note, and
// the response leaves the queue.
// ---------------------------------------------------------------------------

test('AC2/AC6/AC1 — staff_admin queue → review-and-sign (note) → response leaves queue → respondent submits', async ({
  page,
}) => {
  test.setTimeout(180_000)

  // Pre-state (post db reset): seeded e1 has the respondent sign-off only.
  expect(await signoffSections(page, SEED_RESPONSE_E1)).toEqual([SECTION_RESPONDENT])

  // ── AC2: chefe.farm opens the queue and finds the seeded e1 row ──
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto('/c/farmacia/manage/assinaturas')
  await page.waitForURL('**/c/farmacia/manage/assinaturas', { timeout: 15_000 })
  await expect(
    page.getByRole('heading', { name: /Assinaturas pendentes/i }),
  ).toBeVisible({ timeout: 10_000 })

  // Target the seeded e1 row SPECIFICALLY by href (other pending rows may exist
  // depending on run order). Its metadata: form title, pending section, respondent.
  const e1Link = page.locator(
    `a[href$="/manage/assinaturas/${SEED_RESPONSE_E1}"]`,
  )
  await expect(e1Link).toBeVisible({ timeout: 10_000 })
  await expect(e1Link).toContainText(/Inspeção de Armazenamento de Medicamentos/i)
  await expect(e1Link).toContainText(/Revisão da chefia/i)
  // The respondent's name is shown (not the coordinator's).
  await expect(e1Link).toContainText(/Farmacêutico Um/i)

  // Open the review-and-sign screen.
  await e1Link.click()
  await page.waitForURL(new RegExp(`/manage/assinaturas/${SEED_RESPONSE_E1}`), {
    timeout: 20_000,
  })

  // Read-only review: respondent context + the version-faithful answers render.
  await expect(
    page.getByRole('heading', { level: 1, name: /Inspeção de Armazenamento/i }),
  ).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Resposta de Farmacêutico Um/i)).toBeVisible()

  // AC6: the ALREADY-signed respondent section shows "Assinado por … em DATA".
  await expect(
    page.getByText(/Assinado por .* em \d{2}\/\d{2}\/\d{4}/i).first(),
  ).toBeVisible()

  // The staff_admin section ("Revisão da chefia") offers the sign affordance.
  await expect(
    page.getByRole('heading', { name: /Assinatura da chefia/i }),
  ).toBeVisible({ timeout: 10_000 })

  // Sign with an optional note.
  await page.getByLabel(/Observação/i).fill('Revisado e de acordo — teste E2E.')
  await page.getByRole('button', { name: /Assinar seção/i }).click()

  // DB truth: BOTH sections are now signed.
  await expect
    .poll(async () => (await signoffSections(page, SEED_RESPONSE_E1)).sort(), {
      timeout: 15_000,
    })
    .toEqual([SECTION_RESPONDENT, SECTION_STAFF_ADMIN].sort())

  // e1 has left the queue (its row is gone).
  await page.goto('/c/farmacia/manage/assinaturas')
  await page.waitForURL('**/c/farmacia/manage/assinaturas', { timeout: 15_000 })
  await expect(
    page.locator(`a[href$="/manage/assinaturas/${SEED_RESPONSE_E1}"]`),
  ).toHaveCount(0, { timeout: 10_000 })

  await signOut(page)

  // ── AC1 lifecycle close: the respondent resumes e1 and submits → success ──
  await signInAs(page, 'staff1.farm@test.local')
  const responseId = await fillFormBToReview(page)
  expect(responseId).toBe(SEED_RESPONSE_E1)

  // Both sign-off sections show signed metadata; no pending block.
  await expect(page.getByText(/Há seções pendentes de assinatura/i)).toHaveCount(0)

  // Submit succeeds → confirmation screen.
  const submitBtn = page.getByRole('button', { name: /Enviar respostas/i })
  await expect(submitBtn).toBeEnabled()
  await submitBtn.click()
  await expect(
    page.getByRole('heading', { name: /Resposta enviada/i }),
  ).toBeVisible({ timeout: 20_000 })

  // DB truth: the response is now submitted.
  await expect
    .poll(async () => responseStatus(page, SEED_RESPONSE_E1), { timeout: 10_000 })
    .toBe('submitted')
})

// ---------------------------------------------------------------------------
// AC4 — Sign-offs are immutable after submission (asserted through the UI).
//
// After a submitted response, no re-sign affordance is offered; the sign-off
// metadata is read-only. We use a fully-signed, submitted response and confirm
// the staff_admin review-and-sign screen no longer 404-resolves it into a
// signable queue item (it has left the queue and the RPC no longer returns it),
// and that the respondent's own view exposes no mutation path.
// ---------------------------------------------------------------------------

test('AC4 — submitted response exposes no re-sign affordance (sign-offs immutable post-submit)', async ({
  page,
}) => {
  test.setTimeout(150_000)

  // e1 was fully signed + submitted by the AC2/AC6/AC1 test (which runs before
  // this one under --workers=1). The narrow definer queue RPC only returns
  // in_progress responses with a pending staff_admin section, so once e1 is
  // submitted it must NOT surface — and there is no re-sign affordance.
  const status = await responseStatus(page, SEED_RESPONSE_E1)
  expect(status).toBe('submitted')

  await signInAs(page, 'chefe.farm@test.local')

  // e1's row is GONE from the queue (other unrelated pending rows may remain,
  // so we assert e1 specifically — not that the whole queue is empty).
  await page.goto('/c/farmacia/manage/assinaturas')
  await page.waitForURL('**/c/farmacia/manage/assinaturas', { timeout: 15_000 })
  await expect(
    page.locator(`a[href$="/manage/assinaturas/${SEED_RESPONSE_E1}"]`),
  ).toHaveCount(0, { timeout: 10_000 })

  // Direct navigation to the review-and-sign screen for the submitted response
  // yields the not-found boundary (no signable item) — no mutation path exposed.
  await page.goto(`/c/farmacia/manage/assinaturas/${SEED_RESPONSE_E1}`)
  await expect(
    page.getByRole('heading', { name: /Não encontramos esta página/i }),
  ).toBeVisible({ timeout: 15_000 })
  // No re-sign affordance anywhere.
  await expect(
    page.getByRole('button', { name: /Assinar seção/i }),
  ).toHaveCount(0)

  // The submitted response is also immutable from the respondent's side: opening
  // it in the wizard shows the read-only confirmation, never an editable form
  // or a sign affordance.
  await signOut(page)
  await signInAs(page, 'staff1.farm@test.local')
  await page.goto(
    `/c/farmacia/forms/f0000000-0000-0000-0000-00000000b001/responder/${SEED_RESPONSE_E1}`,
  )
  await page.waitForURL(/\/responder\//, { timeout: 20_000 })
  await expect(
    page.getByRole('heading', { name: /Resposta enviada/i }),
  ).toBeVisible({ timeout: 15_000 })
  await expect(
    page.getByRole('button', { name: /Assinar e confirmar esta seção/i }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: /Enviar respostas/i }),
  ).toHaveCount(0)
})

// ---------------------------------------------------------------------------
// AC5 — A staff member CANNOT sign a staff_admin section (RLS through the UI).
//
// staff1.farm (the respondent) has no sign affordance for the staff_admin
// section in the wizard (status-only), and a direct sign_section RPC call as a
// plain staff member is rejected by RLS (42501) → the action maps it to the
// pt-BR forbidden message.
// ---------------------------------------------------------------------------

test('AC5 — staff cannot sign a staff_admin section: no UI affordance + RLS 42501 forbidden', async ({
  page,
}) => {
  test.setTimeout(150_000)

  // 1) Through the wizard: a staff respondent fills Form B and reaches the
  //    review screen. The staff_admin section ("Revisão da chefia") shows the
  //    pending-chefia status, NOT a sign affordance the respondent can operate.
  await signInAs(page, 'staff2.farm@test.local')
  const responseId = await fillFormBToReview(page)

  // The respondent's review screen renders. The staff_admin section shows ONLY
  // the "Pendente — chefia" status: the chefia "Assinar seção" button NEVER
  // appears in the respondent wizard (that affordance lives in the queue, F2).
  await expect(page.getByText(/Pendente — chefia/i)).toBeVisible({ timeout: 10_000 })
  await expect(
    page.getByRole('button', { name: /^Assinar seção$/i }),
  ).toHaveCount(0)

  // 2) Through the API: the respondent obtains a real session token and calls
  //    sign_section for the staff_admin section directly. RLS (signoffs_insert
  //    signer-role rule) must reject with 42501 — the server is the authority.
  const tokenResp = await page.request.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      data: { email: 'staff2.farm@test.local', password: 'Test1234!' },
    },
  )
  expect(tokenResp.ok()).toBeTruthy()
  const accessToken = (await tokenResp.json()).access_token as string
  expect(accessToken).toBeTruthy()

  const signResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/sign_section`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        // Caller identity = the staff respondent (RLS evaluated under this JWT).
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        p_response_id: responseId,
        p_section_id: SECTION_STAFF_ADMIN,
        p_note: null,
      },
    },
  )
  // RLS rejects the respondent signing a staff_admin section → 42501.
  expect(signResp.ok()).toBeFalsy()
  const signBody = JSON.stringify(await signResp.json())
  expect(signBody).toMatch(/42501/)

  // DB truth: the staff_admin section is NOT signed.
  expect(await signoffSections(page, responseId)).not.toContain(SECTION_STAFF_ADMIN)
})

// ---------------------------------------------------------------------------
// AC7 — Keyboard-only flow (CLAUDE.md §8 mandate): keyboard-only staff_admin
// queue → review → sign. Asserts focus lands where expected at each step.
//
// Uses a fresh in_progress response so this test is independent of run order:
// a staff respondent fills + respondent-signs Form B (leaving a staff_admin
// section pending), then chefe.farm navigates the queue and signs by keyboard.
// ---------------------------------------------------------------------------

test('AC7 — keyboard-only: staff_admin opens the queue, reviews, and signs without a mouse', async ({
  page,
}) => {
  test.setTimeout(180_000)

  // ── Ensure a pending response exists for staff2.farm: respondent section
  //    signed, staff_admin section pending → it surfaces in chefe's queue.
  //    staff2's single draft may already be respondent-signed from an earlier
  //    test; the setup is idempotent (sign only if the affordance is present). ──
  await signInAs(page, 'staff2.farm@test.local')
  const responseId = await fillFormBToReview(page)
  const respondentSignBtn = page.getByRole('button', {
    name: /Assinar e confirmar esta seção/i,
  })
  if (await respondentSignBtn.isVisible().catch(() => false)) {
    await respondentSignBtn.click()
  }
  await expect
    .poll(async () => signoffSections(page, responseId), { timeout: 15_000 })
    .toContain(SECTION_RESPONDENT)
  // The staff_admin section must still be pending for the keyboard-sign below.
  expect(await signoffSections(page, responseId)).not.toContain(SECTION_STAFF_ADMIN)
  // Answers + the respondent sign-off are already persisted (saveSection on each
  // navigation, signSection on sign). The in_progress response is submit-ready
  // with only the staff_admin sign-off pending → it surfaces in the queue.
  await signOut(page)

  // ── Keyboard-only: chefe.farm queue → review → sign ──
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto('/c/farmacia/manage/assinaturas')
  await page.waitForURL('**/c/farmacia/manage/assinaturas', { timeout: 15_000 })

  // Focus the queue row for THIS response and activate by Enter.
  const queueLink = page.locator(
    `a[href$="/manage/assinaturas/${responseId}"]`,
  )
  await expect(queueLink).toBeVisible({ timeout: 10_000 })
  await queueLink.focus()
  await expect(queueLink).toBeFocused()
  await page.keyboard.press('Enter')
  await page.waitForURL(new RegExp(`/manage/assinaturas/${responseId}`), {
    timeout: 20_000,
  })

  // The review-and-sign screen renders.
  await expect(
    page.getByRole('heading', { name: /Assinatura da chefia/i }),
  ).toBeVisible({ timeout: 15_000 })

  // Keyboard: focus the note textarea, type a note.
  const noteField = page.getByLabel(/Observação/i)
  await noteField.focus()
  await expect(noteField).toBeFocused()
  await page.keyboard.type('Revisão por teclado — teste E2E.')

  // Keyboard: focus the "Assinar seção" button and activate by Enter.
  const signBtn = page.getByRole('button', { name: /Assinar seção/i })
  await signBtn.focus()
  await expect(signBtn).toBeFocused()
  await page.keyboard.press('Enter')

  // DB truth: the staff_admin section is now signed.
  await expect
    .poll(async () => signoffSections(page, responseId), { timeout: 15_000 })
    .toContain(SECTION_STAFF_ADMIN)
})

// ---------------------------------------------------------------------------
// Security boundary — a plain staff member cannot reach the staff_admin queue
// or the review-and-sign screen (404, no data leakage).
// ---------------------------------------------------------------------------

test('Security: staff cannot reach the sign-off queue or review-and-sign screen (404, no leak)', async ({
  page,
}) => {
  await signInAs(page, 'staff1.farm@test.local')

  // The queue route → not-found boundary for a plain staff member.
  await page.goto('/c/farmacia/manage/assinaturas')
  await expect(
    page.getByRole('heading', { name: /Não encontramos esta página/i }),
  ).toBeVisible({ timeout: 15_000 })

  // The review-and-sign route for the seeded response → not-found, no answers.
  await page.goto(`/c/farmacia/manage/assinaturas/${SEED_RESPONSE_E1}`)
  await expect(
    page.getByRole('heading', { name: /Não encontramos esta página/i }),
  ).toBeVisible({ timeout: 15_000 })
  // No respondent answers / sign affordance leak through.
  await expect(page.getByRole('button', { name: /Assinar seção/i })).toHaveCount(0)
  await expect(page.getByText(/Resposta de Farmacêutico/i)).toHaveCount(0)
})

// ---------------------------------------------------------------------------
// Security boundary — a foreign staff_admin (commission A) cannot reach
// commission B's queue (cross-commission 404).
// ---------------------------------------------------------------------------

test('Security: foreign-commission staff_admin cannot reach another commission queue (404)', async ({
  page,
}) => {
  // chefe.ccih is staff_admin of CCIH, not farmacia.
  await signInAs(page, 'chefe.ccih@test.local')

  await page.goto('/c/farmacia/manage/assinaturas')
  await expect(
    page.getByRole('heading', { name: /Não encontramos esta página/i }),
  ).toBeVisible({ timeout: 15_000 })

  await page.goto(`/c/farmacia/manage/assinaturas/${SEED_RESPONSE_E1}`)
  await expect(
    page.getByRole('heading', { name: /Não encontramos esta página/i }),
  ).toBeVisible({ timeout: 15_000 })
})
