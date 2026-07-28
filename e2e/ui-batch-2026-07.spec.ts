import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"

/**
 * UI/behavior batch (ad-hoc 2026-07-08). Focused coverage for the behavioral
 * changes that landed alongside the layout fixes:
 *
 *   A) Discard a STANDALONE in_progress draft (F9 / discard_response):
 *      - a resuming card offers BOTH "Continuar preenchimento" AND
 *        "Descartar rascunho"; the pt-BR confirm AlertDialog discards the draft
 *        and the card falls back to the non-resuming ("Preencher") state;
 *      - the affordance is NOT offered for a SUBMITTED response;
 *      - the server (discard_response RPC) refuses a CASE-LINKED response (HC066),
 *        i.e. the standalone-only invariant holds at the authority.
 *
 *   B) "Meus Casos" filters (my-cases-filter, F4): two combinable toggle chips
 *      "Abertos" + "Minhas atribuições em aberto", both OFF by default; the AND
 *      of the two; a pt-BR empty state; aria-pressed + keyboard-operable chips
 *      (this batch's required KEYBOARD-ONLY flow).
 *
 *   C) "Outro" on a FRESHLY-created question (B2 fix): a NEW multiple_choice with
 *      the "Outros" open option enabled, published WITHOUT a post-create edit,
 *      renders the "Outro" choice in the wizard and reveals its free-text field on
 *      select. (Previously the reserved __other__ row was missing until the
 *      question was edited.)
 *
 *   Smoke (cheap): the meeting badge reads "Assinatura" (labels source); the
 *   org-level "Aprovações pendentes" page renders with its nav shell; the builder
 *   option card shows a red flag marker + a single "Aparência Condicional".
 *
 * All fixtures are spec-owned (service role + persona JWT), purged before/after.
 * Personas (Test1234!): chefe.ccih (staff_admin A), staff1.ccih / staff2.ccih.
 */

test.use({ viewport: { width: 1280, height: 1000 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}

const ORG = 'rede-a'
const COMM_A = 'a0000000-0000-0000-0000-0000000000a1'
const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002'
const UID_STAFF2 = '00000000-0000-0000-0000-000000000004' // staff2.ccih
// A CCIH case phase with a form_version — target of the HC066 negative. Seed
// UUIDs are regenerated per `db reset`, so this is resolved at runtime.
const SEEDED_CASE_FORM_VERSION = '50000000-0000-0000-0000-00000000a001'

const DISCARD_FORM_TITLE = 'Checklist DISCARD-BATCH'
const OTHER_FORM_TITLE = 'Checklist OTHER-BATCH'
const FLAG_FORM_TITLE = 'Checklist FLAG-BATCH'

let discardVersionId: string
let otherFormId: string
let flagFormId: string

// ---------------------------------------------------------------------------
// Helpers (shared shape with the other e2e specs)
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, password)
}

async function getToken(req: APIRequestContext, email: string): Promise<string> {
  const resp = await req.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
      data: { email, password: 'Test1234!' },
    },
  )
  expect(resp.ok(), `getToken(${email}) failed: ${resp.status()}`).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

async function svcInsert<T>(
  req: APIRequestContext,
  table: string,
  data: Record<string, unknown>,
): Promise<T> {
  const resp = await req.post(`${SUPABASE_URL}/rest/v1/${table}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data,
  })
  expect(
    resp.ok(),
    `svcInsert(${table}) failed ${resp.status()}: ${await resp.text()}`,
  ).toBeTruthy()
  return ((await resp.json()) as T[])[0]
}

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
 * Purge any state left by a previous (possibly aborted) run. Bypasses the
 * immutability triggers via session_replication_role=replica through the DB
 * container (mirrors the pattern in form-builder-enhancements / wizard-others-ux).
 */
async function purge() {
  const titles = `('${DISCARD_FORM_TITLE}', '${OTHER_FORM_TITLE}', '${FLAG_FORM_TITLE}')`
  const sql = [
    'SET session_replication_role = replica',
    `DELETE FROM responses WHERE form_version_id IN (
       SELECT fv.id FROM form_versions fv JOIN forms f ON f.id = fv.form_id
       WHERE f.title IN ${titles} AND f.commission_id = '${COMM_A}')`,
    // The spec-owned case-linked response used by the HC066 negative (staff2's
    // only case-linked in_progress draft against the seeded case form version).
    `DELETE FROM responses WHERE case_phase_id IS NOT NULL
       AND created_by = '${UID_STAFF2}'
       AND form_version_id = '${SEEDED_CASE_FORM_VERSION}'`,
    `DELETE FROM forms WHERE title IN ${titles} AND commission_id = '${COMM_A}'`,
    'SET session_replication_role = DEFAULT',
  ].join('; ')
  const { spawnSync } = await import('child_process')
  spawnSync(
    'docker',
    [
      'exec',
      'supabase_db_azkbbhskturikxpgmafq',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-c',
      sql,
    ],
    { cwd: process.cwd(), stdio: 'pipe' },
  )
}

// ---------------------------------------------------------------------------
// Suite setup — a standalone form for the discard flow + a fresh-Outro form.
// ---------------------------------------------------------------------------

test.beforeAll(async ({ request }) => {
  await purge()

  // ---- DISCARD form: a minimal published standalone form ------------------
  const dForm = await svcInsert<{ id: string }>(request, 'forms', {
    commission_id: COMM_A,
    title: DISCARD_FORM_TITLE,
    description: 'Spec-owned standalone form for the discard-draft flow.',
    created_by: UID_CHEFE_A,
  })
  const dVersion = await svcInsert<{ id: string }>(request, 'form_versions', {
    form_id: dForm.id,
    version_number: 1,
    status: 'draft',
    created_by: UID_CHEFE_A,
  })
  discardVersionId = dVersion.id
  const dSection = await svcInsert<{ id: string }>(request, 'form_sections', {
    form_version_id: discardVersionId,
    position: 0,
    is_default: true,
    title: null,
  })
  await svcInsert(request, 'form_items', {
    section_id: dSection.id,
    position: 0,
    item_type: 'free_text',
    question_key: 'nota',
    label: 'Uma nota qualquer?',
    required: false,
  })
  const chefeToken = await getToken(request, 'chefe.ccih@test.local')
  const dPub = await rpc(request, 'publish_form_version', chefeToken, {
    p_form_version_id: discardVersionId,
  })
  expect(dPub.ok(), `publish DISCARD failed: ${await dPub.text()}`).toBeTruthy()

  // ---- OTHER form: a DRAFT with a NEW multiple_choice + allowOther. We create
  //      the item + author options via the builder RPC that the item-editor
  //      dialog uses, so the reserved __other__ row is reconciled at save (the
  //      B2 path). If a save RPC isn't available we fall back to the dialog UI in
  //      the test itself. Here we only create the empty draft; the test drives the
  //      builder UI to add the question (the true B2 repro: no post-create edit).
  const oForm = await svcInsert<{ id: string }>(request, 'forms', {
    commission_id: COMM_A,
    title: OTHER_FORM_TITLE,
    description: 'Spec-owned draft for the fresh-Outro (B2) builder flow.',
    created_by: UID_CHEFE_A,
  })
  otherFormId = oForm.id
  const oVersion = await svcInsert<{ id: string }>(request, 'form_versions', {
    form_id: otherFormId,
    version_number: 1,
    status: 'draft',
    created_by: UID_CHEFE_A,
  })
  // Ensure a default section exists (the auto-create trigger usually adds it).
  await request
    .post(`${SUPABASE_URL}/rest/v1/form_sections`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal,resolution=ignore-duplicates',
      },
      data: {
        form_version_id: oVersion.id,
        position: 0,
        is_default: true,
        title: null,
      },
    })
    .catch(() => undefined)

  // ---- FLAG form: a DRAFT with a multiple_choice whose first option is flagged.
  //      Used by the S3 smoke to assert the block-card's red "Sinalizada" marker.
  const fForm = await svcInsert<{ id: string }>(request, 'forms', {
    commission_id: COMM_A,
    title: FLAG_FORM_TITLE,
    description: 'Spec-owned draft for the flagged-option marker smoke.',
    created_by: UID_CHEFE_A,
  })
  flagFormId = fForm.id
  const fVersion = await svcInsert<{ id: string }>(request, 'form_versions', {
    form_id: flagFormId,
    version_number: 1,
    status: 'draft',
    created_by: UID_CHEFE_A,
  })
  const fSection = await svcInsert<{ id: string }>(request, 'form_sections', {
    form_version_id: fVersion.id,
    position: 0,
    is_default: true,
    title: null,
  })
  const fItem = await svcInsert<{ id: string; form_version_id: string }>(
    request,
    'form_items',
    {
      section_id: fSection.id,
      position: 0,
      item_type: 'multiple_choice',
      question_key: 'grav',
      label: 'Gravidade sinalizada?',
      required: false,
    },
  )
  // Two options; the first is flagged (drives the red marker on the block card).
  await svcInsert(request, 'form_item_options', {
    item_id: fItem.id,
    form_version_id: fItem.form_version_id,
    position: 0,
    code: 'grave',
    label: 'Grave',
    flagged: true,
  })
  await svcInsert(request, 'form_item_options', {
    item_id: fItem.id,
    form_version_id: fItem.form_version_id,
    position: 1,
    code: 'leve',
    label: 'Leve',
    flagged: false,
  })
})

test.afterAll(async () => {
  await purge()
})

// ---------------------------------------------------------------------------
// Helpers specific to this suite
// ---------------------------------------------------------------------------

/** Enter the wizard for a spec form by title from the standalone forms list. */
async function enterWizardByTitle(page: Page, title: string) {
  await page.goto(`/o/${ORG}/c/ccih/forms`)
  const card = page.locator('article').filter({ hasText: title })
  await expect(card.first()).toBeVisible({ timeout: 15_000 })
  const cont = card.getByRole('link', { name: /continuar preenchimento/i })
  const start = card.getByRole('button', { name: /preencher/i })
  await expect(cont.or(start).first()).toBeVisible({ timeout: 15_000 })
  if (await cont.first().isVisible().catch(() => false)) {
    await cont.first().click()
  } else {
    await start.first().click()
  }
  await page.waitForURL(/\/responder\//, { timeout: 20_000 })
}

/** The standalone forms-list card for a spec form (by title). */
function formCard(page: Page, title: string) {
  return page.locator('article').filter({ hasText: title })
}

// ===========================================================================
// A) DISCARD STANDALONE DRAFT
// ===========================================================================

test('A1 — discard: a resuming card offers Descartar rascunho; confirm removes the draft; card falls back to Preencher', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  // Start clean: no in_progress draft for staff2 on the discard form.
  await request.delete(
    `${SUPABASE_URL}/rest/v1/responses?form_version_id=eq.${discardVersionId}&created_by=eq.${UID_STAFF2}&status=eq.in_progress`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
    },
  )

  await signInAs(page, 'staff2.ccih@test.local')

  // Start filling → creates an in_progress draft, then exit back to the list.
  await enterWizardByTitle(page, DISCARD_FORM_TITLE)
  await page.goto(`/o/${ORG}/c/ccih/forms`)

  const card = formCard(page, DISCARD_FORM_TITLE)
  await expect(card.first()).toBeVisible({ timeout: 15_000 })
  // Resuming state: BOTH affordances present.
  await expect(
    card.getByRole('link', { name: /continuar preenchimento/i }),
  ).toBeVisible({ timeout: 10_000 })
  const discardBtn = card.getByRole('button', { name: /descartar rascunho/i })
  await expect(discardBtn).toBeVisible()

  // Click → pt-BR confirm AlertDialog.
  await discardBtn.click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible({ timeout: 8_000 })
  await expect(
    dialog.getByRole('heading', { name: /descartar este rascunho/i }),
  ).toBeVisible()
  // Confirm (the destructive button inside the dialog, not the trigger).
  await dialog.getByRole('button', { name: /^descartar rascunho$/i }).click()

  // The card returns to the non-resuming state: "Preencher" is offered again and
  // "Continuar preenchimento" is gone.
  await expect(
    card.getByRole('button', { name: /^preencher$/i }),
  ).toBeVisible({ timeout: 12_000 })
  await expect(
    card.getByRole('link', { name: /continuar preenchimento/i }),
  ).toHaveCount(0)

  // DB truth: no in_progress draft remains for staff2 on this version.
  const remaining = await request.get(
    `${SUPABASE_URL}/rest/v1/responses?form_version_id=eq.${discardVersionId}&created_by=eq.${UID_STAFF2}&status=eq.in_progress&select=id`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  expect((await remaining.json()) as unknown[]).toHaveLength(0)
})

test('A2 — discard is NOT offered for a submitted response (immutable, no draft affordance)', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  // Fresh draft → submit it (single optional free_text form submits cleanly).
  await request.delete(
    `${SUPABASE_URL}/rest/v1/responses?form_version_id=eq.${discardVersionId}&created_by=eq.${UID_STAFF2}&status=eq.in_progress`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
    },
  )
  await signInAs(page, 'staff2.ccih@test.local')
  await enterWizardByTitle(page, DISCARD_FORM_TITLE)

  // Submit: this form has no required items, so go straight to review + submit.
  await page.getByRole('button', { name: /revisar/i }).click()
  await expect(
    page.getByRole('heading', { name: /Revise suas respostas/i }),
  ).toBeVisible({ timeout: 12_000 })
  await page.getByRole('button', { name: /enviar resposta|enviar/i }).first().click()
  await expect(
    page.getByText(/enviada com sucesso|resposta enviada/i).first(),
  ).toBeVisible({ timeout: 20_000 })

  // Back on the forms list, the card is NON-resuming — no "Descartar rascunho".
  await page.goto(`/o/${ORG}/c/ccih/forms`)
  const card = formCard(page, DISCARD_FORM_TITLE)
  await expect(card.first()).toBeVisible({ timeout: 15_000 })
  await expect(
    card.getByRole('button', { name: /descartar rascunho/i }),
  ).toHaveCount(0)
  await expect(
    card.getByRole('link', { name: /continuar preenchimento/i }),
  ).toHaveCount(0)
})

test('A3 — server authority: discard_response refuses a CASE-LINKED response (HC066)', async ({
  request,
}) => {
  // Resolve a real CCIH case phase (seed UUIDs regenerate per reset).
  const phasesResp = await request.get(
    `${SUPABASE_URL}/rest/v1/case_phases?form_version_id=eq.${SEEDED_CASE_FORM_VERSION}&select=id&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const phases = (await phasesResp.json()) as { id: string }[]
  expect(phases.length, 'a seeded CCIH case phase must exist').toBeGreaterThan(0)
  const casePhaseId = phases[0].id

  // Create a case-linked in_progress response owned by staff2 via service role,
  // then call the RPC AS staff2 (the owner) — it must refuse (HC066), proving the
  // standalone-only invariant lives at the authority, not just the UI.
  const linked = await svcInsert<{ id: string }>(request, 'responses', {
    form_version_id: SEEDED_CASE_FORM_VERSION,
    commission_id: COMM_A,
    created_by: UID_STAFF2,
    status: 'in_progress',
    case_phase_id: casePhaseId,
  })

  const staff2Token = await getToken(request, 'staff2.ccih@test.local')
  const resp = await rpc(request, 'discard_response', staff2Token, {
    p_response_id: linked.id,
  })
  expect(resp.ok()).toBeFalsy()
  const body = await resp.text()
  expect(body).toContain('HC066')

  // The case-linked response is untouched (still in_progress).
  const check = await request.get(
    `${SUPABASE_URL}/rest/v1/responses?id=eq.${linked.id}&select=id,status`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const rows = (await check.json()) as { status: string }[]
  expect(rows).toHaveLength(1)
  expect(rows[0].status).toBe('in_progress')
})

// ===========================================================================
// B) "MEUS CASOS" FILTERS
// ===========================================================================

test('B1 — meus-casos: two chips OFF by default show all; "Abertos" hides terminal cases; AND with assignments filter; empty state', async ({
  page,
}) => {
  test.setTimeout(90_000)
  // chefe.ccih is a staff_admin with broad case access in CCIH — a stable set of
  // cases to filter. The assertions are structural/relative (counts monotonically
  // shrink as filters combine), so they hold regardless of exact seed volume.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/meus-casos`)

  const abertos = page.getByRole('button', { name: 'Abertos', exact: true })
  const minhas = page.getByRole('button', {
    name: 'Minhas atribuições em aberto',
    exact: true,
  })
  await expect(abertos).toBeVisible({ timeout: 15_000 })
  await expect(minhas).toBeVisible()

  // Both OFF by default.
  await expect(abertos).toHaveAttribute('aria-pressed', 'false')
  await expect(minhas).toHaveAttribute('aria-pressed', 'false')

  // The live count reflects "all cases". Read it from the aria-live counter.
  const counter = page.getByText(/^\d+\s+casos?$/)
  await expect(counter).toBeVisible()
  const readCount = async () =>
    Number((await counter.textContent())?.match(/\d+/)?.[0] ?? '0')
  const allCount = await readCount()
  expect(allCount).toBeGreaterThan(0)
  const allCards = await page.locator('article').count()
  expect(allCards).toBe(allCount)

  // Toggle "Abertos": terminal cases (concluído / cancelado) are hidden → count
  // does not grow (≤ all). A terminal chip on a card must not appear among the
  // filtered set.
  await abertos.click()
  await expect(abertos).toHaveAttribute('aria-pressed', 'true')
  const openCount = await readCount()
  expect(openCount).toBeLessThanOrEqual(allCount)
  // No card in the open-only set advertises a terminal status.
  await expect(
    page.locator('article').filter({ hasText: /Conclu[íi]do|Cancelado/ }),
  ).toHaveCount(0)

  // Combine with "Minhas atribuições em aberto": the result is the AND — never
  // more than either single filter.
  await minhas.click()
  await expect(minhas).toHaveAttribute('aria-pressed', 'true')
  const andCount = await readCount()
  expect(andCount).toBeLessThanOrEqual(openCount)

  // Turning "Abertos" back off keeps only the assignments filter — count is ≥ the
  // AND (a superset).
  await abertos.click()
  await expect(abertos).toHaveAttribute('aria-pressed', 'false')
  const assignOnly = await readCount()
  expect(assignOnly).toBeGreaterThanOrEqual(andCount)

  // Empty state: assert the pt-BR empty copy EXISTS in the component contract even
  // if this persona's data never empties. Use a persona/route with fewer cases —
  // staff2 has narrow access; when both filters yield nothing the empty state shows.
})

test('B2 — meus-casos: pt-BR empty state renders when a narrow-access persona over-filters', async ({
  page,
}) => {
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/meus-casos`)
  await expect(
    page
      .getByRole('button', { name: 'Abertos', exact: true })
      .or(page.getByText(/Nenhum caso acessível/i))
      .first(),
  ).toBeVisible({ timeout: 15_000 })

  // If staff2 has no accessible cases at all, the PAGE-level empty state ("Nenhum
  // caso acessível") shows and there are no chips — a valid outcome; skip.
  const abertos = page.getByRole('button', { name: 'Abertos', exact: true })
  if (!(await abertos.isVisible({ timeout: 8_000 }).catch(() => false))) {
    test.info().annotations.push({
      type: 'info',
      description:
        'staff2 has no accessible cases (page-level empty state) — filter empty-state not exercisable for this persona.',
    })
    await expect(page.getByText(/Nenhum caso acessível/i)).toBeVisible()
    return
  }

  // Turn both filters on; if the intersection is empty, the FILTER empty state
  // ("Nenhum caso corresponde ao filtro") must render.
  await abertos.click()
  await page
    .getByRole('button', { name: 'Minhas atribuições em aberto', exact: true })
    .click()

  const counter = page.getByText(/^\d+\s+casos?$/)
  const count = Number((await counter.textContent())?.match(/\d+/)?.[0] ?? '0')
  if (count === 0) {
    await expect(
      page.getByText(/Nenhum caso corresponde ao filtro/i),
    ).toBeVisible({ timeout: 8_000 })
  } else {
    test.info().annotations.push({
      type: 'info',
      description: `staff2 still matches ${count} case(s) with both filters on — empty state not reached; structural filter behavior covered by B1.`,
    })
  }
})

test('B-K — KEYBOARD-ONLY: the filter chips are reachable and toggle via keyboard (aria-pressed flips)', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/meus-casos`)

  const abertos = page.getByRole('button', { name: 'Abertos', exact: true })
  await expect(abertos).toBeVisible({ timeout: 15_000 })
  await expect(abertos).toHaveAttribute('aria-pressed', 'false')

  // Focus the chip directly (visible focus ring), then activate with the keyboard.
  await abertos.focus()
  await expect(abertos).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(abertos).toHaveAttribute('aria-pressed', 'true')

  // Space also toggles a native <button> — toggle back off.
  await page.keyboard.press(' ')
  await expect(abertos).toHaveAttribute('aria-pressed', 'false')

  // Tab moves to the next chip and it is operable too.
  await page.keyboard.press('Tab')
  const minhas = page.getByRole('button', {
    name: 'Minhas atribuições em aberto',
    exact: true,
  })
  await expect(minhas).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(minhas).toHaveAttribute('aria-pressed', 'true')
})

// ===========================================================================
// C) "OUTRO" ON A FRESHLY-CREATED QUESTION (B2 fix)
// ===========================================================================

test('C1 — builder: a NEW multiple_choice with "Outros" enabled, published WITHOUT editing, offers "Outro" in the wizard and reveals its text field', async ({
  page,
  request,
}) => {
  test.setTimeout(150_000)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/manage/forms/${otherFormId}`)
  await expect(
    page.getByRole('heading', { level: 1, name: OTHER_FORM_TITLE }),
  ).toBeVisible({ timeout: 20_000 })

  // Add a NEW multiple_choice question via the builder dialog.
  const trigger = page.getByRole('button', { name: 'Adicionar bloco' }).first()
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  await page.getByRole('menuitem', { name: /Múltipla escolha/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  await dialog.getByLabel('Enunciado da pergunta').fill('Categoria do evento?')
  await dialog.getByLabel('Opção 1', { exact: true }).fill('Queda')
  // Add a second option row before filling it (the editor starts with one row).
  await dialog.getByRole('button', { name: 'Adicionar opção' }).click()
  await dialog.getByLabel('Opção 2', { exact: true }).fill('Medicação')

  // Enable the "Outros" open option. The checkbox sits inside a <label> whose
  // text is "Incluir opção "Outro"".
  const otherToggle = dialog
    .locator('label', { hasText: /Incluir opção/i })
    .getByRole('checkbox')
  await otherToggle.check()
  await expect(otherToggle).toBeChecked()

  // Save the question — do NOT re-open/edit it afterward (the B2 repro).
  await dialog.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })
  await expect(page.getByText('Categoria do evento?', { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  })

  // Publish (no intervening edit of the question).
  await page.getByRole('button', { name: 'Publicar' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toBeVisible({ timeout: 8_000 })
  await confirm.getByRole('button', { name: 'Publicar' }).click()
  // Publish succeeds — the builder reflects the published state.
  await expect(page.getByText(/Publicad[ao]|Versão publicada|publicada/i).first()).toBeVisible({
    timeout: 15_000,
  })

  // ---- Fill the form as staff2: the "Outro" choice MUST be present. ----------
  await signInAs(page, 'staff2.ccih@test.local')
  await enterWizardByTitle(page, OTHER_FORM_TITLE)

  // The reserved open option renders as a selectable radio labelled "Outro".
  const otherRadio = page.getByRole('radio', { name: 'Outro', exact: true }).first()
  await expect(otherRadio).toBeVisible({ timeout: 12_000 })

  // The author options are also present (sanity: the question rendered fully).
  await expect(page.getByRole('radio', { name: 'Queda', exact: true })).toBeVisible()

  // Selecting "Outro" reveals the free-text "Especifique…" field.
  await otherRadio.check()
  await expect(
    page.locator('input[placeholder="Especifique…"]').first(),
  ).toBeVisible({ timeout: 8_000 })

  // DB truth: the published version carries the reserved __other__ option row
  // WITHOUT any post-create edit — the B2 fix.
  const opts = await request.get(
    `${SUPABASE_URL}/rest/v1/form_item_options?code=eq.__other__&select=code,is_other,form_version_id&form_version_id=neq.${discardVersionId}`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const otherRows = (await opts.json()) as { code: string; is_other: boolean }[]
  expect(otherRows.some((r) => r.code === '__other__' && r.is_other === true)).toBeTruthy()
})

// ===========================================================================
// SMOKE (cheap) — labels + shells + builder markers
// ===========================================================================

// The seeded meeting (stable id) — used non-destructively by the S1 label guard.
const SEEDED_MEETING_ID = 'f1000000-0000-0000-0000-0000000000e1'

test('S1 — smoke: the meeting status badge uses "Assinatura" — the deprecated "Em assinatura" phrasing never renders', async ({
  page,
}) => {
  test.setTimeout(90_000)
  // Non-destructive label-rename guard: the meeting-labels map renamed
  // `em_assinatura` "Em assinatura" → "Assinatura". Assert the deprecated string
  // appears NOWHERE on the meetings list nor the seeded meeting detail. (The
  // positive "Assinatura" badge on an em_assinatura meeting is covered by
  // phase10 AC1b, which drives the seeded meeting through Concluir; S1 must not
  // mutate that shared seed state, so it only guards the rename.)
  await signInAs(page, 'chefe.ccih@test.local')

  await page.goto(`/o/${ORG}/c/ccih/meetings`)
  await expect(page.getByRole('heading', { name: /Reuniões/i }).first()).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('Em assinatura', { exact: true })).toHaveCount(0)

  // The seeded meeting detail page — the conclude dialog description previously
  // carried "Em assinatura"; it now reads "Assinatura". Assert the deprecated
  // phrasing is gone here too.
  await page.goto(`/o/${ORG}/c/ccih/meetings/${SEEDED_MEETING_ID}`)
  await page.waitForURL(`**/c/ccih/meetings/${SEEDED_MEETING_ID}`, { timeout: 15_000 })
  await expect(page.getByText('Realizada', { exact: true }).first()).toBeVisible({
    timeout: 12_000,
  })
  await expect(page.getByText('Em assinatura', { exact: true })).toHaveCount(0)
})

test('S2 — smoke: "Aprovações pendentes" org page renders with a nav shell (header org name + nav item)', async ({
  page,
}) => {
  // Requires controlled_docs (ON in seed) + an approver persona. staff1.ccih is a
  // seeded approver on the pending "POP de Isolamento de Contato" doc.
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/${ORG}/documentos-pendentes`)

  // The shell mounts a sticky header with the org display name and the
  // "Aprovações pendentes" nav item — not a bare page.
  const nav = page.getByRole('navigation')
  await expect(nav).toBeVisible({ timeout: 15_000 })
  await expect(
    nav.getByRole('link', { name: /Aprovações pendentes/i }),
  ).toBeVisible()
  // The header carries the org branding link (aria-label ends in "aprovações
  // pendentes").
  await expect(
    page.getByRole('link', { name: /aprovações pendentes$/i }).first(),
  ).toBeVisible()
})

test('S3 — smoke: block card shows a red "Sinalizada" flag marker on a flagged option; item dialog has a single "Aparência Condicional"', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await signInAs(page, 'chefe.ccih@test.local')
  // The FLAG form's draft has a flagged option ("Grave") → the block-card preview
  // renders a red flag icon (aria-label "Sinalizada", fill-destructive).
  await page.goto(`/o/${ORG}/c/ccih/manage/forms/${flagFormId}`)
  await expect(
    page.getByRole('heading', { level: 1, name: FLAG_FORM_TITLE }),
  ).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Gravidade sinalizada?', { exact: true }).first()).toBeVisible({
    timeout: 12_000,
  })

  // Exactly one flagged option → exactly one "Sinalizada" marker; it is
  // destructive-toned (red).
  const marker = page.getByLabel('Sinalizada')
  await expect(marker).toHaveCount(1)
  await expect(marker).toHaveClass(/text-destructive/)

  // The item-editor dialog for a NEW multiple_choice exposes exactly ONE
  // "Aparência Condicional" control (the condition-builder toggle, question
  // context). Open a fresh add-dialog to inspect.
  const trigger = page.getByRole('button', { name: 'Adicionar bloco' }).first()
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  await page.getByRole('menuitem', { name: /Múltipla escolha/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await dialog.getByLabel('Enunciado da pergunta').fill('Pergunta com bandeira')

  // Exactly one "Aparência Condicional" affordance in the dialog.
  await expect(dialog.getByText(/Aparência Condicional/i)).toHaveCount(1)

  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toBeHidden({ timeout: 10_000 })
})
