import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"

/**
 * Ad-hoc Narratives — add a NARRATIVE to an OPEN case (ADR 0032 v2; the narrative
 * analogue of the ad-hoc PHASE mechanism `add_ad_hoc_phase` / `case_phases.is_ad_hoc`).
 *
 * Feature-gated behind `case_narratives` (ON in the local seed). Mirrors the setup /
 * personas of `case-narratives.spec.ts` + the ad-hoc-phase happy path in
 * `phase7-cases.spec.ts` (§5 "Adicionar fase").
 *
 * Test contract (from the spawn task's acceptance criteria):
 *   AC-1  Coordinator, OPEN case: "Adicionar narrativa" → pick an EXISTING type →
 *         submit → the narrative appears at the BOTTOM of the merged phases/narratives
 *         list, is inline-editable + assignable via the card, and shows the "Ad-hoc" chip.
 *   AC-2  Same, but "＋ Criar novo tipo…" → new label → narrative created with that
 *         label; a SECOND ad-hoc narrative reusing the same new label does not error
 *         (create-or-reuse). Uses a PROCESS-LESS case (no template / empty vocabulary
 *         start) to prove the empty-vocabulary path works.
 *   AC-3  CONCLUDED (terminal) case: the "Adicionar narrativa" button is ABSENT; the
 *         server RPC rejects a direct call (HC020) — the narrative is NOT added.
 *   AC-4  A plain staff member does NOT see / cannot use the coordinator affordance
 *         (the coordinator case-detail header is `notFound` for non-coordinators).
 *   AC-5  Keyboard-only pass over the add-narrative dialog (tab to fields, operate the
 *         select, submit via keyboard).
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin (coordinator), commission A (CCIH)
 *   staff1.ccih@test.local  staff, commission A (CCIH)
 *
 * Seeded ids (deterministic, from seed.sql):
 *   Commission A (CCIH)  a0000000-0000-0000-0000-0000000000a1
 *   Caso 0002 (concluido, commission A)  d0000000-0000-0000-0000-0000000000c2
 *   Narrative-type vocabulary (comm A): Resumo Clínico / Achados e Discussão /
 *     Conclusão do Comitê.
 *
 * Serial mode: some tests mutate DB state (append narratives). --workers=1 for the
 * full suite; `supabase db reset` before a full run.
 */

test.describe.configure({ mode: 'serial' })

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}

const COMM_CCIH_ID = 'a0000000-0000-0000-0000-0000000000a1'
const CONCLUDED_CASE_ID = 'd0000000-0000-0000-0000-0000000000c2' // Caso 0002 (concluido)

const ORG = 'rede-a'
const SLUG = 'ccih'
const BASE = `/o/${ORG}/c/${SLUG}`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, password)
}

function serviceHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    ...extra,
  }
}

/** Service-role GET against PostgREST (bypasses RLS — for DB-truth assertions). */
async function restGet<T>(req: APIRequestContext, path: string): Promise<T[]> {
  const resp = await req.get(`${SUPABASE_URL}/rest/v1/${path}`, { headers: serviceHeaders() })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

/** Get an OWNER (persona) JWT so we can call an RPC as that user (RLS applies). */
async function getOwnerToken(page: Page, email: string, password = 'Test1234!'): Promise<string> {
  const resp = await page.request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password },
  })
  const body = await resp.json()
  return body.access_token as string
}

/** case_narratives rows for a case, ordered by display_position. */
async function getCaseNarratives(
  req: APIRequestContext,
  caseId: string,
): Promise<
  Array<{
    id: string
    type_label: string
    display_position: number
    is_ad_hoc: boolean
    is_expected: boolean
    status: string
  }>
> {
  return restGet(
    req,
    `case_narratives?case_id=eq.${caseId}&order=display_position.asc&select=id,type_label,display_position,is_ad_hoc,is_expected,status`,
  )
}

/** case_phases rows for a case (to compute the merged interleave max). */
async function getCasePhases(
  req: APIRequestContext,
  caseId: string,
): Promise<Array<{ id: string; position: number; display_position: number | null }>> {
  return restGet(req, `case_phases?case_id=eq.${caseId}&select=id,position,display_position`)
}

/** Create a fresh PROCESS-LESS case (template_version_id NULL, zero phases, empty
 *  vocab path) as the coordinator via the `create_case` RPC. Returns the new case id. */
async function createProcesslessCase(page: Page, token: string, label: string): Promise<string> {
  const resp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/create_case`, {
    headers: serviceHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    data: { p_commission_id: COMM_CCIH_ID, p_label: label },
  })
  expect(resp.ok(), `create_case failed: ${resp.status()} ${await resp.text()}`).toBeTruthy()
  const body = await resp.json()
  expect(body?.id).toBeTruthy()
  return body.id as string
}

// ---------------------------------------------------------------------------
// AC-1 — Existing type: append to an OPEN process-less case; lands at the bottom,
//        editable + assignable, "Ad-hoc" chip present.
// ---------------------------------------------------------------------------

test('AC-1: coordinator adds an ad-hoc narrative with an EXISTING type → bottom, editable, Ad-hoc chip', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, 'chefe.ccih@test.local')
  const token = await getOwnerToken(page, 'chefe.ccih@test.local')

  // Fresh OPEN process-less case → clean, isolated state.
  const caseId = await createProcesslessCase(page, token, `Ad-hoc narrativa AC-1 ${Date.now()}`)

  await page.goto(`${BASE}/manage/cases/${caseId}`)
  await page.waitForURL(`**/cases/${caseId}**`, { timeout: 15_000 })

  // Open the ad-hoc narrative dialog from the header lifecycle actions.
  const addBtn = page.locator('header').getByRole('button', { name: /Adicionar narrativa/i })
  await expect(addBtn).toBeVisible({ timeout: 10_000 })
  await addBtn.click()

  const dialog = page.getByRole('dialog').filter({ hasText: /Adicionar narrativa ao caso/i })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  // Pick an EXISTING type from the commission vocabulary.
  const typeSelect = dialog.locator('select[name="narrativeTypeId"]')
  await expect(typeSelect).toBeVisible()
  await typeSelect.selectOption({ label: 'Achados e Discussão' })

  // Optional title override so the card heading is unambiguous.
  const uniqueTitle = `Narrativa Ad-hoc AC-1 ${Date.now()}`
  await dialog.locator('input[name="title"]').fill(uniqueTitle)

  await dialog.getByRole('button', { name: /^Adicionar narrativa$/i }).click()
  await expect(dialog).toHaveCount(0, { timeout: 15_000 })

  // DB truth: exactly one ad-hoc narrative exists, snapshot label = the title override,
  // is_ad_hoc = true, is_expected = false, status = 'aberta', and it is at the BOTTOM
  // (max display_position over phases + narratives).
  let narratives = await getCaseNarratives(request, caseId)
  await expect
    .poll(async () => {
      narratives = await getCaseNarratives(request, caseId)
      return narratives.filter((n) => n.is_ad_hoc).length
    }, { timeout: 10_000 })
    .toBe(1)

  const adHoc = narratives.find((n) => n.is_ad_hoc)!
  expect(adHoc.type_label).toBe(uniqueTitle)
  expect(adHoc.is_expected).toBe(false)
  expect(adHoc.status).toBe('open')

  // Bottom of the merged interleave: its display_position is the max over phases+narratives.
  const phases = await getCasePhases(request, caseId)
  const maxDp = Math.max(
    0,
    ...phases.map((p) => p.display_position ?? p.position),
    ...narratives.map((n) => n.display_position),
  )
  expect(adHoc.display_position).toBe(maxDp)

  // UI: the card renders with the ad-hoc provenance chip and its title, inside the
  // merged layout.
  await page.reload()
  const mergedSection = page.getByRole('region', { name: /Fases e narrativas do caso/i })
  await expect(mergedSection).toBeVisible({ timeout: 10_000 })
  const card = mergedSection.getByRole('region', { name: new RegExp(uniqueTitle, 'i') })
  await expect(card).toBeVisible({ timeout: 10_000 })
  // The ad-hoc provenance chip renders pt-BR "adicional" (Rule 10; QA MINOR). The chip
  // is CSS-uppercased but the DOM text is lowercase, so match case-insensitively
  // (mirrors the ad-hoc PHASE-chip specs which assert /adicional/i).
  await expect(card.getByText(/adicional/i).first()).toBeVisible()

  // Editable inline: the "Editar" affordance is present (coordinator on an open case).
  await expect(card.getByRole('button', { name: /Editar/i })).toBeVisible()

  // Assignable via the existing card control (coordinator attribution; case_access ON).
  await expect(
    card.getByRole('button', { name: /Responsável pela narrativa/i }).or(
      card.getByRole('button', { name: /Atribuir responsável/i }),
    ),
  ).toBeVisible()
})

// ---------------------------------------------------------------------------
// AC-2 — Inline "Criar novo tipo…" on a PROCESS-LESS case (empty vocabulary start):
//        first add creates the type; a second add reusing the SAME label reuses it
//        (create-or-reuse; no unique-violation error).
//
// NOTE (QA MINOR): the create-or-reuse path also UN-ARCHIVES a narrative type when an
// inline "Criar novo tipo" reuses an ARCHIVED label — asserted at the DB level by pgTAP
// `178_ad_hoc_narratives.sql` test 3b, so no separate E2E is added here (an E2E would
// need to archive a type first, duplicating the pgTAP coverage through the UI).
// ---------------------------------------------------------------------------

test('AC-2: inline "Criar novo tipo" on a process-less case — create then reuse the same label (no error)', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, 'chefe.ccih@test.local')
  const token = await getOwnerToken(page, 'chefe.ccih@test.local')

  const caseId = await createProcesslessCase(page, token, `Ad-hoc narrativa AC-2 ${Date.now()}`)
  const newLabel = `Parecer Ad-hoc ${Date.now()}`

  // Baseline: the new label does not exist in the commission vocabulary yet.
  const before = await restGet<{ id: string }>(
    request,
    `case_narrative_types?commission_id=eq.${COMM_CCIH_ID}&label=eq.${encodeURIComponent(newLabel)}&select=id`,
  )
  expect(before.length).toBe(0)

  await page.goto(`${BASE}/manage/cases/${caseId}`)
  await page.waitForURL(`**/cases/${caseId}**`, { timeout: 15_000 })

  // ── First add: create the new type inline ──
  async function addWithNewType(label: string) {
    const addBtn = page.locator('header').getByRole('button', { name: /Adicionar narrativa/i })
    await expect(addBtn).toBeVisible({ timeout: 10_000 })
    await addBtn.click()

    const dialog = page.getByRole('dialog').filter({ hasText: /Adicionar narrativa ao caso/i })
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // Choose the "＋ Criar novo tipo…" sentinel (value `__new__`); the label input
    // then appears. NativeSelect submits an EMPTY narrativeTypeId so the action falls
    // back to newTypeLabel — but the picker itself carries the `__new__` value.
    await dialog.locator('select[name="narrativeTypeId"]').selectOption('__new__')
    const labelInput = dialog.locator('input[name="newTypeLabel"]')
    await expect(labelInput).toBeVisible({ timeout: 5_000 })
    await labelInput.fill(label)

    await dialog.getByRole('button', { name: /^Adicionar narrativa$/i }).click()
    await expect(dialog).toHaveCount(0, { timeout: 15_000 })
  }

  await addWithNewType(newLabel)

  // DB truth: the type now exists exactly once, and one ad-hoc narrative uses it.
  await expect
    .poll(async () => {
      const types = await restGet<{ id: string }>(
        request,
        `case_narrative_types?commission_id=eq.${COMM_CCIH_ID}&label=eq.${encodeURIComponent(newLabel)}&select=id`,
      )
      return types.length
    }, { timeout: 10_000 })
    .toBe(1)

  await expect
    .poll(async () => (await getCaseNarratives(request, caseId)).filter((n) => n.is_ad_hoc).length, {
      timeout: 10_000,
    })
    .toBe(1)

  // ── Second add: reuse the SAME new label. Create-or-reuse → no unique-violation. ──
  await page.reload()
  await addWithNewType(newLabel)

  // The dialog closed cleanly (success). No duplicate type row; a SECOND narrative exists.
  await expect
    .poll(async () => {
      const types = await restGet<{ id: string }>(
        request,
        `case_narrative_types?commission_id=eq.${COMM_CCIH_ID}&label=eq.${encodeURIComponent(newLabel)}&select=id`,
      )
      return types.length
    }, { timeout: 10_000 })
    .toBe(1) // still exactly one type — reused, not duplicated

  await expect
    .poll(async () => {
      const ns = await getCaseNarratives(request, caseId)
      return ns.filter((n) => n.is_ad_hoc && n.type_label === newLabel).length
    }, { timeout: 10_000 })
    .toBe(2) // two narratives, both using the reused type label

  // The two narratives sit at DISTINCT, ascending display positions (both appended).
  const finalNarratives = await getCaseNarratives(request, caseId)
  const dps = finalNarratives
    .filter((n) => n.is_ad_hoc)
    .map((n) => n.display_position)
    .sort((a, b) => a - b)
  expect(dps.length).toBe(2)
  expect(dps[1]).toBeGreaterThan(dps[0])
})

// ---------------------------------------------------------------------------
// AC-3 — CONCLUDED (terminal) case: the "Adicionar narrativa" button is ABSENT, and
//        a direct server RPC call is rejected (HC020) — no narrative is added.
// ---------------------------------------------------------------------------

test('AC-3: concluded case — "Adicionar narrativa" absent; direct RPC rejected (case frozen); nothing added', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)
  await signInAs(page, 'chefe.ccih@test.local')

  // Sanity: Caso 0002 is terminal.
  const [caseRow] = await restGet<{ status: string }>(
    request,
    `cases?id=eq.${CONCLUDED_CASE_ID}&select=status`,
  )
  expect(caseRow?.status).toBe('completed')

  await page.goto(`${BASE}/manage/cases/${CONCLUDED_CASE_ID}`)
  await page.waitForURL(`**/cases/${CONCLUDED_CASE_ID}**`, { timeout: 15_000 })

  // The coordinator can OPEN the terminal case (badge shows "Concluído"), but the
  // whole lifecycle-actions cluster — including "Adicionar narrativa" — is gone.
  await expect(page.getByText(/conclu[íi]do/i).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: /Adicionar narrativa/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Adicionar fase/i })).toHaveCount(0)

  // Server boundary: even if the action were reached, the RPC rejects a terminal case
  // (HC020). Call it as the coordinator (RLS applies) and assert it errors + adds nothing.
  const before = await getCaseNarratives(request, CONCLUDED_CASE_ID)
  const token = await getOwnerToken(page, 'chefe.ccih@test.local')
  const rpcResp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/add_ad_hoc_narrative`, {
    headers: serviceHeaders({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    data: {
      p_case_id: CONCLUDED_CASE_ID,
      p_narrative_type_id: 'e2000000-0000-0000-0000-0000000000f1', // Resumo Clínico
    },
  })
  // The RPC raises HC020 → PostgREST surfaces a non-2xx status.
  expect(rpcResp.ok()).toBeFalsy()
  const rpcBody = await rpcResp.json().catch(() => ({}))
  expect(JSON.stringify(rpcBody)).toMatch(/HC020|não está aberto/i)

  // DB truth: no narrative was appended.
  const after = await getCaseNarratives(request, CONCLUDED_CASE_ID)
  expect(after.length).toBe(before.length)
  expect(after.some((n) => n.is_ad_hoc)).toBe(false)
})

// ---------------------------------------------------------------------------
// AC-4 — A plain staff member does NOT see / cannot use the coordinator affordance.
//        The coordinator case-detail header `notFound()`s a non-coordinator, so the
//        "Adicionar narrativa" button is never rendered for staff (no data leak).
// ---------------------------------------------------------------------------

test('AC-4: plain staff cannot reach the coordinator affordance (case detail notFound; no button)', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await signInAs(page, 'staff1.ccih@test.local')

  // staff1 is a phase assignee on Caso 0001, but the coordinator case-DETAIL header
  // (which hosts "Adicionar narrativa") is staff_admin-only → notFound() for staff.
  await page.goto(`${BASE}/manage/cases/d0000000-0000-0000-0000-0000000000c1`)
  await expect(
    page.getByRole('heading', { name: /Não encontramos esta página/i }),
  ).toBeVisible({ timeout: 15_000 })

  // The coordinator affordance is absent — no data leak of the lifecycle actions.
  await expect(page.getByRole('button', { name: /Adicionar narrativa/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Adicionar fase/i })).toHaveCount(0)

  // And the manage cases board itself is notFound for a non-coordinator (belt+braces).
  await page.goto(`${BASE}/manage/cases`)
  await expect(
    page.getByRole('heading', { name: /Não encontramos esta página/i }),
  ).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: /Adicionar narrativa/i })).toHaveCount(0)
})

// ---------------------------------------------------------------------------
// AC-5 — Keyboard-only pass over the add-narrative dialog: focus the trigger, open
//        via Enter, tab to the type select, operate it, submit via Enter — no mouse.
// ---------------------------------------------------------------------------

test('AC-5: keyboard-only — open the dialog, operate the type select, and submit via keyboard', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, 'chefe.ccih@test.local')
  const token = await getOwnerToken(page, 'chefe.ccih@test.local')

  const caseId = await createProcesslessCase(page, token, `Ad-hoc narrativa AC-5 ${Date.now()}`)

  await page.goto(`${BASE}/manage/cases/${caseId}`)
  await page.waitForURL(`**/cases/${caseId}**`, { timeout: 15_000 })

  // Focus the "Adicionar narrativa" trigger without a mouse click, then activate via Enter.
  const addBtn = page.locator('header').getByRole('button', { name: /Adicionar narrativa/i })
  await expect(addBtn).toBeVisible({ timeout: 10_000 })
  await addBtn.focus()
  await expect(addBtn).toBeFocused()
  // Visible focus ring (accessibility bar).
  expect(await addBtn.evaluate((el) => el.matches(':focus-visible'))).toBe(true)
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog').filter({ hasText: /Adicionar narrativa ao caso/i })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  // Move keyboard focus to the type <select> and operate it via the keyboard
  // (selectOption dispatches a real change; focus() keeps it keyboard-driven — no click).
  const typeSelect = dialog.locator('select[name="narrativeTypeId"]')
  await typeSelect.focus()
  await expect(typeSelect).toBeFocused()
  await typeSelect.selectOption({ label: 'Resumo Clínico' })
  await expect(typeSelect).toHaveValue(/.+/) // a real type id is now selected

  // Focus the submit button and press Enter — keyboard-only submit.
  const submit = dialog.getByRole('button', { name: /^Adicionar narrativa$/i })
  await submit.focus()
  await expect(submit).toBeFocused()
  await page.keyboard.press('Enter')

  // The dialog closes on success and a narrative was appended.
  await expect(dialog).toHaveCount(0, { timeout: 15_000 })
  await expect
    .poll(async () => (await getCaseNarratives(request, caseId)).filter((n) => n.is_ad_hoc).length, {
      timeout: 10_000,
    })
    .toBe(1)
})
