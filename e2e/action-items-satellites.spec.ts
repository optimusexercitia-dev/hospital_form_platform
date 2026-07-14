import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

/**
 * AI track — Action-Items Satellites + Cross-Link UI (pre-pilot release, S2).
 *
 * Plan: docs/plans/action-items-satellites.md §7 (acceptance criteria 1-8 + 11).
 * ADR 0050 (visibility_scope + can_read_action_item). SQLSTATE block HC0I0-HC0I2
 * (+ HC000 flag-off, reused from the hub).
 *
 * Covers, per the plan's acceptance numbering:
 *   §7.1  case_restricted invisibility — REGRESSION-GUARD (title/detail, existing)
 *         + NEW: the three satellite tables close the same leak (direct REST probe
 *         under a non-case-reader's own JWT vs. a case-reader's).
 *   §7.2  coordinator toggles committee <-> case_restricted on a meeting-sourced
 *         item via the new form control; edit-mode case link renders read-only.
 *   §7.3  assignees_only reachability (assignee + staff_admin yes; plain member no).
 *   §7.4  reminder RULE CRUD (staff_admin/org_admin only, HC0I0) + the on_due/
 *         offset_days XOR CHECK constraint (both directions).
 *   §7.5  updates-feed CRUD, stakeholder-gated (HC0I1), append-only (no edit/delete).
 *   §7.6  checklist CRUD, stakeholder-gated (HC0I2), full CRUD as the stakeholder.
 *   §7.7  visibility_scope badge on "Meus itens de ação" (committee -> none,
 *         case_restricted -> "Restrito ao caso", assignees_only -> "Somente
 *         responsáveis").
 *   §7.8  flag-OFF fallback -> HC000 on every satellite write RPC.
 *   §7.11 one keyboard-only pass through the reminder/checklist/update panel.
 *
 * pgTAP `227_action_item_satellites.sql` (64/64, the RLS truth-table + HC0I0-2
 * negatives) is backend-owned and already re-verified on this fresh reset via
 * `npx supabase test db` (see the tester's report) — NOT re-derived here.
 *
 * Fixture strategy: a dedicated meeting (tagged title) hosts every meeting-sourced
 * fixture item this spec creates/mutates, so it never touches the seeded meeting's
 * action items. A single case-sourced item on the seeded Caso 0001 is inserted
 * directly (service-role REST, mirroring `member-action-items-overview.spec.ts`)
 * for the §7.1 satellite-leak probe. Everything is deleted in `afterAll` via the
 * TAG match (satellites cascade with their parent `action_items` row).
 *
 * Serial mode: several tests build on state a prior test left behind (the toggle
 * test's item is reused by nothing else, but the reminder/updates/checklist tests
 * share one item across §7.5 -> §7.6, and §7.7 depends on §7.3's fixture existing).
 * Run with --project=chromium --workers=1 against a freshly `supabase db reset`
 * stack (flags `action_items` + `cases_extras` + `case_access` all ON per seed).
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY missing — set it in .env.local (Playwright loads it via @next/env).',
  )
}

const ORG_A = 'rede-a'
const COMM_CCIH = 'ccih'
const COMM_CCIH_ID = 'a0000000-0000-0000-0000-0000000000a1'

// Personas (seed.sql), password Test1234! for all.
const CHEFE_CCIH_EMAIL = 'chefe.ccih@test.local' // staff_admin
const STAFF1_CCIH_EMAIL = 'staff1.ccih@test.local' // phase-1 assignee of Caso 0001 -> can_read_case
const STAFF4_CCIH_EMAIL = 'staff4.ccih@test.local' // BOUNDARY: plain member, no attribution, no case grant
const STAFF1_NAME = 'Enfermeiro CCIH Um'

const SEEDED_CASE_ID = 'd0000000-0000-0000-0000-0000000000c1' // Caso 0001 (CCIH)

const TAG = 'AISAT-E2E'

// Fixture titles (unique per test, all TAG-prefixed for cleanup).
const T_CASE_PROBE = `${TAG} Caso vinculado — probe satélites`
const T_TOGGLE = `${TAG} Alternância comitê/restrito`
const T_ASSIGNEES_ONLY = `${TAG} Somente responsáveis`
const T_REMINDER = `${TAG} Item de lembretes`
const T_STAKE = `${TAG} Atualizações e checklist`
const T_BADGE_COMMITTEE = `${TAG} Badge comitê`
const T_BADGE_RESTRICTED = `${TAG} Badge restrito`
const T_KEYBOARD = `${TAG} Painel via teclado`

let meetingId: string

// ---------------------------------------------------------------------------
// Auth + navigation helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.locator('input[name="password"]').fill(password)
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

function meetingUrl(): string {
  return `/o/${ORG_A}/c/${COMM_CCIH}/meetings/${meetingId}`
}

// ---------------------------------------------------------------------------
// Service-role REST + persona-JWT REST helpers (RLS/RPC probes)
// ---------------------------------------------------------------------------

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
  const rows = (await resp.json()) as T[]
  return rows[0]
}

async function svcSelect<T>(
  req: APIRequestContext,
  table: string,
  filter: string,
): Promise<T[]> {
  const resp = await req.get(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  expect(
    resp.ok(),
    `svcSelect(${table}) failed ${resp.status()}: ${await resp.text()}`,
  ).toBeTruthy()
  return (await resp.json()) as T[]
}

async function svcDelete(
  req: APIRequestContext,
  table: string,
  filter: string,
): Promise<void> {
  const resp = await req.delete(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  expect([200, 204].includes(resp.status())).toBeTruthy()
}

/** Obtain a JWT for a persona (RLS/RPC authority evaluated under it). */
async function getToken(req: APIRequestContext, email: string): Promise<string> {
  const resp = await req.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password: 'Test1234!' },
  })
  expect(resp.ok(), `getToken(${email}) failed: ${resp.status()}`).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

/** PostgREST GET under a bearer token (RLS-scoped read probe). */
async function restGet<T>(req: APIRequestContext, path: string, bearer: string): Promise<T[]> {
  const resp = await req.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${bearer}` },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

/** Call a public RPC under a persona JWT (authority probe). */
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

async function actionItemIdByTitle(req: APIRequestContext, title: string): Promise<string> {
  const rows = await svcSelect<{ id: string }>(
    req,
    'action_items',
    `title=eq.${encodeURIComponent(title)}&select=id`,
  )
  expect(rows.length, `action item "${title}" should exist (exactly 1)`).toBe(1)
  return rows[0].id
}

async function globalStatusId(req: APIRequestContext, key: string): Promise<string> {
  const rows = await svcSelect<{ id: string }>(
    req,
    'action_item_statuses',
    `key=eq.${key}&commission_id=is.null&select=id`,
  )
  expect(rows.length, `global status "${key}" must be seeded`).toBe(1)
  return rows[0].id
}

/** Flip a feature flag ON/OFF via the local supabase CLI (mirrors the sibling spec). */
async function setFeatureFlag(flagKey: string, enabled: boolean) {
  const { execSync } = await import('child_process')
  execSync(
    `npx supabase db query --local "UPDATE app.feature_flags SET enabled = ${enabled} WHERE key = '${flagKey}'"`,
    { cwd: process.cwd(), stdio: 'pipe' },
  )
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/**
 * The "Itens de ação" panel — scoped explicitly because the AgendaPanel ("Pauta")
 * on the same meeting page reuses the exact same "Novo item" button text; without
 * this scope every "Novo item" lookup strict-mode-violates (2 matches).
 */
function actionItemsSection(page: Page) {
  return page.getByRole('region', { name: 'Itens de ação' })
}

function itemRow(page: Page, title: string) {
  return actionItemsSection(page).getByRole('listitem').filter({ hasText: title })
}

/** Create a meeting-sourced action item via the "Novo item" dialog. */
async function createMeetingActionItemUI(
  page: Page,
  opts: {
    title: string
    assigneeName?: string
    caseTextIncludes?: string
    visibilityLabel?: 'Comitê' | 'Restrito ao caso' | 'Somente responsáveis'
  },
) {
  await actionItemsSection(page).getByRole('button', { name: 'Novo item' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Novo item de ação' })).toBeVisible()
  await dialog.getByLabel('Título').fill(opts.title)

  if (opts.assigneeName) {
    await dialog.getByLabel(/Responsável/).selectOption({ label: opts.assigneeName })
  }

  if (opts.caseTextIncludes) {
    const caseSelect = dialog.getByLabel(/Vínculo com caso/i)
    const optTexts = await caseSelect.locator('option').allTextContents()
    const idx = optTexts.findIndex((t) => t.includes(opts.caseTextIncludes!))
    expect(idx, `case option containing "${opts.caseTextIncludes}" not found`).toBeGreaterThan(-1)
    await caseSelect.selectOption({ index: idx })
  }

  if (opts.visibilityLabel) {
    await dialog.getByLabel('Visibilidade').selectOption({ label: opts.visibilityLabel })
  }

  await dialog.getByRole('button', { name: 'Criar item' }).click()
  await expect(dialog).toBeHidden()
}

/** Open the row's edit dialog. */
async function openEditDialog(page: Page, title: string) {
  await itemRow(page, title).getByRole('button', { name: `Editar ${title}` }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Editar item de ação' })).toBeVisible()
  return dialog
}

/** Expand (if needed) a row's "Acompanhamento" satellite disclosure; returns the row locator. */
async function openSatellites(page: Page, title: string) {
  const row = itemRow(page, title)
  const btn = row.getByRole('button', { name: `Acompanhamento de ${title}` })
  if ((await btn.getAttribute('aria-expanded')) !== 'true') {
    await btn.click()
  }
  await expect(row.getByRole('region', { name: 'Lembretes' })).toBeVisible({ timeout: 10_000 })
  return row
}

/**
 * Reload the meeting page and re-expand a row's satellite disclosure. REQUIRED
 * between successive satellite mutations on the prod-standalone build: each
 * satellite section shares ONE `isPending` (from `useSatelliteAction`), and every
 * composer input/select/button/switch/checkbox in that section is
 * `disabled={isPending}`. `useSatelliteAction.run()` calls `router.refresh()`
 * inside the same transition right after its own mutation succeeds — on prod
 * (under the `c/[commission]/loading.tsx` ancestor boundary) that refresh can
 * stall indefinitely, so `isPending` never clears and the WHOLE section's
 * controls stay disabled until a fresh navigation. Confirmed via manual repro:
 * the mutation itself always persists correctly (DB truth-read + reload both
 * show it), no console/page error fires — this is the display/interactivity
 * layer only. A pure content read (text/count) right after a mutation is safe
 * in place (it doesn't depend on the element being enabled); only the NEXT
 * interaction needs this reload first. See §7.4 for the fullest example.
 */
async function reopenSatellites(page: Page, title: string) {
  await page.goto(meetingUrl())
  return openSatellites(page, title)
}

/**
 * Like {@link reopenSatellites}, but the re-expand is keyboard-driven (focus +
 * Enter) rather than a click — used by the keyboard-only test (§7.11) so every
 * touch point, including the reload scaffolding between sub-sections, stays
 * mouse-free.
 */
async function reopenSatellitesByKeyboard(page: Page, title: string) {
  await page.goto(meetingUrl())
  const row = itemRow(page, title)
  const disclosureBtn = row.getByRole('button', { name: `Acompanhamento de ${title}` })
  await disclosureBtn.focus()
  await page.keyboard.press('Enter')
  await expect(row.getByRole('region', { name: 'Lembretes' })).toBeVisible({ timeout: 10_000 })
  return row
}

// ---------------------------------------------------------------------------
// Fixture setup / teardown
// ---------------------------------------------------------------------------

test.beforeAll(async ({ request }) => {
  await setFeatureFlag('action_items', true)
  await setFeatureFlag('cases_extras', true)
  await setFeatureFlag('case_access', true)

  await teardownFixtures(request)

  const meeting = await svcInsert<{ id: string }>(request, 'meetings', {
    commission_id: COMM_CCIH_ID,
    title: `${TAG} Reunião de apoio`,
    status: 'scheduled',
    scheduled_start: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
    modality: 'presencial',
    created_by: '00000000-0000-0000-0000-000000000002', // chefe.ccih
  })
  meetingId = meeting.id
})

test.afterAll(async ({ request }) => {
  await teardownFixtures(request)
  await setFeatureFlag('action_items', true)
  await setFeatureFlag('cases_extras', true)
  await setFeatureFlag('case_access', true)
})

async function teardownFixtures(request: APIRequestContext) {
  // action_items cascades to its 3 satellites + status history + assignments.
  await svcDelete(request, 'action_items', `title=like.*${TAG}*`)
  await svcDelete(request, 'meetings', `title=like.*${TAG}*`)
}

// ===========================================================================
// §7.1 — case_restricted invisibility, incl. the NEW satellite-row leak guard
// ===========================================================================

test('§7.1: a case_restricted item\'s satellite rows are invisible to a non-case-reader, visible to a case-reader', async ({
  request,
}) => {
  const openId = await globalStatusId(request, 'open')

  const item = await svcInsert<{ id: string; visibility_scope: string }>(
    request,
    'action_items',
    {
      commission_id: COMM_CCIH_ID,
      source_type: 'case',
      source_case_id: SEEDED_CASE_ID,
      title: T_CASE_PROBE,
      status_id: openId,
      created_by: '00000000-0000-0000-0000-000000000002',
    },
  )

  // The guard trigger hard-forces case_restricted on every case-sourced row —
  // confirm before trusting the rest of the probe.
  expect(item.visibility_scope).toBe('case_restricted')

  const reminder = await svcInsert<{ id: string }>(request, 'action_item_reminders', {
    action_item_id: item.id,
    reminder_type: 'before_due',
    offset_days: 2,
  })
  const update = await svcInsert<{ id: string }>(request, 'action_item_updates', {
    action_item_id: item.id,
    author_id: '00000000-0000-0000-0000-000000000002',
    update_type: 'note',
    body: 'Nota de teste — probe de satélites restritos.',
  })
  const checklist = await svcInsert<{ id: string }>(request, 'action_item_checklists', {
    action_item_id: item.id,
    title: 'Subtarefa de teste — probe',
  })

  const staff4Token = await getToken(request, STAFF4_CCIH_EMAIL) // no attribution, no case_access grant
  const staff1Token = await getToken(request, STAFF1_CCIH_EMAIL) // phase-1 assignee -> can_read_case

  // NON-case-reader: every satellite table returns nothing for this item — the
  // row's mere existence must not leak, matching the hub's own invisibility.
  expect(
    await restGet(request, `action_item_reminders?action_item_id=eq.${item.id}`, staff4Token),
  ).toEqual([])
  expect(
    await restGet(request, `action_item_updates?action_item_id=eq.${item.id}`, staff4Token),
  ).toEqual([])
  expect(
    await restGet(request, `action_item_checklists?action_item_id=eq.${item.id}`, staff4Token),
  ).toEqual([])

  // Case-reader (attribution-derived can_read_case): can read all three rows.
  const reminderRead = await restGet<{ id: string }>(
    request,
    `action_item_reminders?action_item_id=eq.${item.id}`,
    staff1Token,
  )
  expect(reminderRead.map((r) => r.id)).toContain(reminder.id)
  const updateRead = await restGet<{ id: string }>(
    request,
    `action_item_updates?action_item_id=eq.${item.id}`,
    staff1Token,
  )
  expect(updateRead.map((r) => r.id)).toContain(update.id)
  const checklistRead = await restGet<{ id: string }>(
    request,
    `action_item_checklists?action_item_id=eq.${item.id}`,
    staff1Token,
  )
  expect(checklistRead.map((r) => r.id)).toContain(checklist.id)

  // The regression-guard half of §7.1 (title/detail invisibility, pre-existing
  // behavior) is re-verified via the UI in the §7.2 test below, which navigates
  // the same non-case-reader persona to the linked case's detail route.
})

// ===========================================================================
// §7.2 — coordinator toggles committee <-> case_restricted; edit read-only link
// ===========================================================================

test('§7.2: coordinator links a case (defaults to case_restricted); a plain member loses visibility; toggling back to committee restores it; edit shows the link read-only', async ({
  page,
}) => {
  await signInAs(page, CHEFE_CCIH_EMAIL)
  await page.goto(meetingUrl())

  await actionItemsSection(page).getByRole('button', { name: 'Novo item' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Título').fill(T_TOGGLE)

  const caseSelect = dialog.getByLabel(/Vínculo com caso/i)
  const optTexts = await caseSelect.locator('option').allTextContents()
  const idx = optTexts.findIndex((t) => t.includes('Caso 0001'))
  expect(idx, 'Caso 0001 option not found in the cross-link picker').toBeGreaterThan(-1)
  await caseSelect.selectOption({ index: idx })

  // Picking a case defaults the visibility select to case_restricted (no extra
  // interaction needed) — confirm the default before submitting.
  const visSelect = dialog.getByLabel('Visibilidade')
  await expect(visSelect).toHaveValue('case_restricted')

  await dialog.getByRole('button', { name: 'Criar item' }).click()
  await expect(dialog).toBeHidden()
  // A fresh navigation, not an in-place wait — on the prod-standalone build the
  // create action's `router.refresh()` can stall indefinitely under the ancestor
  // `c/[commission]/loading.tsx` boundary (the documented deferred-flush class,
  // BUG-AIF-001 / memory `case-dialog-prod-refresh-layout-revalidate`; confirmed
  // via manual repro: the row never appears in-place even after 20s, but is
  // immediately present on a fresh `goto` — the write itself is not delayed,
  // only this page's in-place re-render is). Matches this spec's own pattern at
  // the sign-out/sign-in re-navigations below.
  await page.goto(meetingUrl())
  await expect(itemRow(page, T_TOGGLE)).toBeVisible()

  // A plain committee member with NO case access loses visibility of the item —
  // it must not appear in the meeting's action-item list at all.
  await signOut(page)
  await signInAs(page, STAFF4_CCIH_EMAIL)
  await page.goto(meetingUrl())
  await expect(page.getByText(T_TOGGLE)).toHaveCount(0)

  // Regression-guard (§7.1 wording): the same non-case-reader also cannot open
  // the linked case's detail.
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}/casos/${SEEDED_CASE_ID}`)
  await expect(page.getByText(/404|não encontrad/i)).toBeVisible()

  // Coordinator edits the item: the case link now renders READ-ONLY ("definido
  // na criação"), the visibility select stays editable — toggle back to Comitê.
  await signOut(page)
  await signInAs(page, CHEFE_CCIH_EMAIL)
  await page.goto(meetingUrl())
  const editDialog = await openEditDialog(page, T_TOGGLE)
  await expect(editDialog.getByText(/definido na criação/i)).toBeVisible()
  // No editable case-link control on edit (only a picker on create).
  await expect(editDialog.getByLabel(/Vínculo com caso/i)).toHaveCount(0)
  const editVisSelect = editDialog.getByLabel('Visibilidade')
  await expect(editVisSelect).toBeEnabled()
  await expect(editVisSelect).toHaveValue('case_restricted')
  await editVisSelect.selectOption({ label: 'Comitê' })
  await editDialog.getByRole('button', { name: 'Salvar' }).click()
  await expect(editDialog).toBeHidden()

  // Visibility restored for the plain member.
  await signOut(page)
  await signInAs(page, STAFF4_CCIH_EMAIL)
  await page.goto(meetingUrl())
  await expect(itemRow(page, T_TOGGLE)).toBeVisible()
})

// ===========================================================================
// §7.3 — assignees_only reachability
// ===========================================================================

test('§7.3: assignees_only is visible to the assignee + staff_admin, invisible to a plain member', async ({
  page,
}) => {
  await signInAs(page, CHEFE_CCIH_EMAIL)
  await page.goto(meetingUrl())
  await createMeetingActionItemUI(page, {
    title: T_ASSIGNEES_ONLY,
    assigneeName: STAFF1_NAME,
    visibilityLabel: 'Somente responsáveis',
  })
  // staff_admin (coordinator) always sees it. Fresh navigation, not an in-place
  // wait — see the §7.2 comment on the prod-standalone deferred-flush class.
  await page.goto(meetingUrl())
  await expect(itemRow(page, T_ASSIGNEES_ONLY)).toBeVisible()

  // The assignee sees it.
  await signOut(page)
  await signInAs(page, STAFF1_CCIH_EMAIL)
  await page.goto(meetingUrl())
  await expect(itemRow(page, T_ASSIGNEES_ONLY)).toBeVisible()

  // A plain member who is neither the assignee nor staff_admin/org_admin does not.
  await signOut(page)
  await signInAs(page, STAFF4_CCIH_EMAIL)
  await page.goto(meetingUrl())
  await expect(page.getByText(T_ASSIGNEES_ONLY)).toHaveCount(0)
})

// ===========================================================================
// §7.4 — reminder RULE CRUD (staff_admin/org_admin only) + HC0I0 + XOR CHECK
// ===========================================================================

test('§7.4: reminder CRUD as staff_admin; HC0I0 for a plain member; on_due/offset_days CHECK both directions', async ({
  page,
  request,
}) => {
  await signInAs(page, CHEFE_CCIH_EMAIL)
  await page.goto(meetingUrl())
  await createMeetingActionItemUI(page, { title: T_REMINDER }) // committee scope (default)
  // Fresh navigation before touching the row — see the §7.2 comment on the
  // prod-standalone deferred-flush class (`openSatellites` below needs the row
  // actually attached to the DOM).
  await page.goto(meetingUrl())

  const row = await openSatellites(page, T_REMINDER)
  const reminders = row.getByRole('region', { name: 'Lembretes' })
  // Scoped to the `<ul>` of reminder ROWS — the composer's "Quando avisar"
  // <select> renders an option with the SAME text as the on_due row
  // ("No dia do prazo"), so text lookups must exclude the select to stay
  // strict-mode-safe (an unscoped `reminders.getByText(...)` would match both).
  const reminderList = reminders.locator('ul')

  // Default composer state = before_due, 3 dias — just submit. A pure content
  // read right after a mutation is safe in place (it doesn't require the
  // element to be enabled) — only the NEXT interaction needs a reload.
  await reminders.getByRole('button', { name: 'Adicionar' }).click()
  await expect(reminderList.getByText('3 dias antes do prazo')).toBeVisible()

  // Toggle the rule inactive. Reload first — see `reopenSatellites`: the ADD
  // above leaves this section's `isPending` stuck true on prod (its own
  // `router.refresh()` never flushes there), which would leave the switch
  // (and every other composer control below) permanently disabled otherwise.
  await reopenSatellites(page, T_REMINDER)
  await reminders
    .getByRole('switch', { name: /Desativar lembrete: 3 dias antes do prazo/ })
    .click()
  await expect(reminderList.getByText('Inativo')).toBeVisible()

  // Add a second rule: on_due (offset field disappears) — reload again, same
  // reason. `exact: true` on "Dias" matters — without it, "Dias"
  // substring-matches the switch's aria-label above ("Ativar lembrete: 3 dias
  // antes do prazo"), which always resolves to 1 and masks the offset field's
  // real presence/absence.
  await reopenSatellites(page, T_REMINDER)
  await reminders.getByLabel('Quando avisar').selectOption({ label: 'No dia do prazo' })
  await expect(reminders.getByLabel('Dias', { exact: true })).toHaveCount(0)
  await reminders.getByRole('button', { name: 'Adicionar' }).click()
  await expect(reminderList.getByText('No dia do prazo', { exact: true })).toBeVisible()

  // Delete the on_due rule — reload again.
  await reopenSatellites(page, T_REMINDER)
  await reminders
    .getByRole('button', { name: 'Remover lembrete de "' + T_REMINDER + '"' })
    .last()
    .click()
  const confirmDialog = page.getByRole('alertdialog')
  await expect(confirmDialog).toBeVisible()
  await confirmDialog.getByRole('button', { name: 'Remover' }).click()
  await expect(confirmDialog).toBeHidden()
  await expect(reminderList.getByText('No dia do prazo', { exact: true })).toHaveCount(0)
  await expect(reminderList.getByText('3 dias antes do prazo')).toBeVisible()

  const itemId = await actionItemIdByTitle(request, T_REMINDER)

  // A plain member CAN read the committee-scope item (so the rule text shows)
  // but the write composer must not render — canManage is staff_admin/org_admin
  // only, not the assignee.
  await signOut(page)
  await signInAs(page, STAFF4_CCIH_EMAIL)
  await page.goto(meetingUrl())
  const staff4Row = await openSatellites(page, T_REMINDER)
  const staff4Reminders = staff4Row.getByRole('region', { name: 'Lembretes' })
  await expect(staff4Reminders.getByText('3 dias antes do prazo')).toBeVisible()
  await expect(staff4Reminders.getByLabel('Quando avisar')).toHaveCount(0)
  await expect(staff4Reminders.getByRole('button', { name: 'Adicionar' })).toHaveCount(0)

  // Defense-in-depth: the RPC itself rejects a plain member with HC0I0 (the FE
  // hiding the control is not the security boundary — the RPC is).
  const staff4Token = await getToken(request, STAFF4_CCIH_EMAIL)
  const deniedResp = await rpc(request, 'create_committee_action_item_reminder', staff4Token, {
    p_action_item_id: itemId,
    p_reminder_type: 'before_due',
    p_offset_days: 1,
  })
  expect(deniedResp.ok()).toBeFalsy()
  expect(JSON.stringify(await deniedResp.json())).toMatch(/HC0I0/)

  // CHECK constraint, both directions, via a legitimate staff_admin call.
  const chefeToken = await getToken(request, CHEFE_CCIH_EMAIL)
  const onDueWithOffset = await rpc(request, 'create_committee_action_item_reminder', chefeToken, {
    p_action_item_id: itemId,
    p_reminder_type: 'on_due',
    p_offset_days: 5,
  })
  expect(onDueWithOffset.ok()).toBeFalsy()
  expect(JSON.stringify(await onDueWithOffset.json())).toMatch(/23514|check_violation/i)

  const beforeDueNoOffset = await rpc(request, 'create_committee_action_item_reminder', chefeToken, {
    p_action_item_id: itemId,
    p_reminder_type: 'before_due',
  })
  expect(beforeDueNoOffset.ok()).toBeFalsy()
  expect(JSON.stringify(await beforeDueNoOffset.json())).toMatch(/23514|check_violation/i)
})

// ===========================================================================
// §7.5 + §7.6 — updates-feed + checklist CRUD, stakeholder-gated (HC0I1/HC0I2)
// ===========================================================================

test('§7.5: updates feed — assignee posts (stakeholder), append-only, no edit/delete; stakeless member rejected (HC0I1)', async ({
  page,
  request,
}) => {
  await signInAs(page, CHEFE_CCIH_EMAIL)
  await page.goto(meetingUrl())
  await createMeetingActionItemUI(page, { title: T_STAKE, assigneeName: STAFF1_NAME })

  // The assignee (a stakeholder via active assignment) posts a progress note.
  await signOut(page)
  await signInAs(page, STAFF1_CCIH_EMAIL)
  await page.goto(meetingUrl())
  const row = await openSatellites(page, T_STAKE)
  const updates = row.getByRole('region', { name: 'Atualizações' })
  // Scoped to the `<ol>` feed — the composer's "Tipo de atualização" <select>
  // renders an option with the same text as the posted chip ("Progresso"), so
  // text lookups must exclude the select to stay strict-mode-safe.
  const updatesList = updates.locator('ol')
  await updates.getByLabel('Mensagem').fill('Atualização via E2E — progresso registrado.')
  await updates.getByRole('button', { name: 'Registrar atualização' }).click()
  await expect(updatesList.getByText('Atualização via E2E — progresso registrado.')).toBeVisible()
  await expect(updatesList.getByText(STAFF1_NAME)).toBeVisible()
  await expect(updatesList.getByText(/\d{2}\/\d{2}\/\d{4}/)).toBeVisible()
  // exact: true — the body text itself contains "progresso" as a substring
  // ("...progresso registrado."), which would otherwise also match the chip.
  await expect(updatesList.getByText('Progresso', { exact: true })).toBeVisible()

  // Append-only: the posted update's own list item carries no button (no
  // edit/delete affordance).
  const postedUpdate = updatesList
    .locator('li')
    .filter({ hasText: 'Atualização via E2E — progresso registrado.' })
  await expect(postedUpdate.getByRole('button')).toHaveCount(0)

  // A stakeless committee member (committee-scope read only, no assignment, not
  // staff_admin) can READ the feed but the composer must not render.
  await signOut(page)
  await signInAs(page, STAFF4_CCIH_EMAIL)
  await page.goto(meetingUrl())
  const staff4Row = await openSatellites(page, T_STAKE)
  const staff4Updates = staff4Row.getByRole('region', { name: 'Atualizações' })
  await expect(
    staff4Updates.getByText('Atualização via E2E — progresso registrado.'),
  ).toBeVisible()
  await expect(staff4Updates.getByLabel('Mensagem')).toHaveCount(0)

  const itemId = await actionItemIdByTitle(request, T_STAKE)
  const staff4Token = await getToken(request, STAFF4_CCIH_EMAIL)
  const denied = await rpc(request, 'create_committee_action_item_update', staff4Token, {
    p_action_item_id: itemId,
    p_update_type: 'note',
    p_body: 'Tentativa não autorizada.',
  })
  expect(denied.ok()).toBeFalsy()
  expect(JSON.stringify(await denied.json())).toMatch(/HC0I1/)
})

test('§7.6: checklist — assignee create/toggle/edit/delete (stakeholder); stakeless member rejected (HC0I2)', async ({
  page,
  request,
}) => {
  await signInAs(page, STAFF1_CCIH_EMAIL) // reuses T_STAKE from the previous test (same assignee)
  await page.goto(meetingUrl())
  const row = await openSatellites(page, T_STAKE)
  const checklist = row.getByRole('region', { name: 'Checklist' })

  await checklist.getByLabel('Título da nova subtarefa').fill('Etapa via E2E')
  await checklist.getByRole('button', { name: 'Adicionar' }).click()
  await expect(checklist.getByText('Etapa via E2E')).toBeVisible()
  await expect(checklist.getByText('0/1 concluído')).toBeVisible()

  // Toggle done — stamps the completer. Reload first — see `reopenSatellites`
  // (the create above can leave a control's `isPending` stuck true on prod;
  // reload conservatively before every interaction that follows a prior
  // mutation, not just same-hook-instance ones — cheap insurance).
  await reopenSatellites(page, T_STAKE)
  await checklist.getByRole('checkbox', { name: 'Concluir subtarefa: Etapa via E2E' }).click()
  await expect(checklist.getByText('1/1 concluído')).toBeVisible()
  await expect(checklist.getByText(new RegExp(`Concluído por ${STAFF1_NAME}`))).toBeVisible()

  // Inline edit — reload again.
  await reopenSatellites(page, T_STAKE)
  await checklist.getByRole('button', { name: 'Editar subtarefa: Etapa via E2E' }).click()
  const editInput = checklist.getByRole('textbox', { name: 'Editar subtarefa: Etapa via E2E' })
  await editInput.fill('Etapa via E2E (editada)')
  await checklist.getByRole('button', { name: 'Salvar subtarefa' }).click()
  await expect(checklist.getByText('Etapa via E2E (editada)')).toBeVisible()

  // Delete — reload again.
  await reopenSatellites(page, T_STAKE)
  await checklist
    .getByRole('button', { name: 'Remover subtarefa "Etapa via E2E (editada)" de "' + T_STAKE + '"' })
    .click()
  const confirmDialog = page.getByRole('alertdialog')
  await confirmDialog.getByRole('button', { name: 'Remover' }).click()
  await expect(confirmDialog).toBeHidden()
  await expect(checklist.getByText('Nenhuma subtarefa. Divida esta ação em passos verificáveis.')).toBeVisible()

  // Stakeless member: read-only list (no add input), RPC rejects with HC0I2.
  await signOut(page)
  await signInAs(page, STAFF4_CCIH_EMAIL)
  await page.goto(meetingUrl())
  const staff4Row = await openSatellites(page, T_STAKE)
  const staff4Checklist = staff4Row.getByRole('region', { name: 'Checklist' })
  await expect(staff4Checklist.getByLabel('Título da nova subtarefa')).toHaveCount(0)

  const itemId = await actionItemIdByTitle(request, T_STAKE)
  const staff4Token = await getToken(request, STAFF4_CCIH_EMAIL)
  const denied = await rpc(request, 'create_committee_action_item_checklist', staff4Token, {
    p_action_item_id: itemId,
    p_title: 'Tentativa não autorizada',
  })
  expect(denied.ok()).toBeFalsy()
  expect(JSON.stringify(await denied.json())).toMatch(/HC0I2/)
})

// ===========================================================================
// §7.7 — visibility_scope badge on "Meus itens de ação"
// ===========================================================================

test('§7.7: "Meus itens de ação" shows the correct visibility badge per scope', async ({
  page,
}) => {
  await signInAs(page, CHEFE_CCIH_EMAIL)
  await page.goto(meetingUrl())
  await createMeetingActionItemUI(page, {
    title: T_BADGE_COMMITTEE,
    assigneeName: STAFF1_NAME,
  })
  await createMeetingActionItemUI(page, {
    title: T_BADGE_RESTRICTED,
    assigneeName: STAFF1_NAME,
    caseTextIncludes: 'Caso 0001',
  })

  await signOut(page)
  await signInAs(page, STAFF1_CCIH_EMAIL)
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}/meus-itens-de-acao`)

  // committee -> no badge.
  const committeeRow = page.getByRole('row').filter({ hasText: T_BADGE_COMMITTEE })
  await expect(committeeRow).toBeVisible()
  await expect(
    committeeRow.getByText(/Restrito ao caso|Somente responsáveis/),
  ).toHaveCount(0)

  // case_restricted -> "Restrito ao caso".
  const restrictedRow = page.getByRole('row').filter({ hasText: T_BADGE_RESTRICTED })
  await expect(restrictedRow).toBeVisible()
  await expect(restrictedRow.getByText('Restrito ao caso', { exact: true })).toBeVisible()

  // assignees_only -> "Somente responsáveis" (from §7.3's fixture, same assignee).
  // exact: true — T_ASSIGNEES_ONLY's own title contains "Somente responsáveis"
  // as a substring, which would otherwise also match the title cell itself.
  const assigneesOnlyRow = page.getByRole('row').filter({ hasText: T_ASSIGNEES_ONLY })
  await expect(assigneesOnlyRow).toBeVisible()
  await expect(
    assigneesOnlyRow.getByText('Somente responsáveis', { exact: true }),
  ).toBeVisible()
})

// ===========================================================================
// §7.8 — flag-OFF fallback -> HC000 on every satellite write RPC
// ===========================================================================

test('§7.8: action_items OFF -> every satellite write RPC raises HC000', async ({ request }) => {
  const itemId = await actionItemIdByTitle(request, T_STAKE)
  const chefeToken = await getToken(request, CHEFE_CCIH_EMAIL)

  await setFeatureFlag('action_items', false)
  try {
    const reminderResp = await rpc(request, 'create_committee_action_item_reminder', chefeToken, {
      p_action_item_id: itemId,
      p_reminder_type: 'before_due',
      p_offset_days: 1,
    })
    expect(reminderResp.ok()).toBeFalsy()
    expect(JSON.stringify(await reminderResp.json())).toMatch(/HC000/)

    const updateResp = await rpc(request, 'create_committee_action_item_update', chefeToken, {
      p_action_item_id: itemId,
      p_update_type: 'note',
      p_body: 'Flag OFF probe.',
    })
    expect(updateResp.ok()).toBeFalsy()
    expect(JSON.stringify(await updateResp.json())).toMatch(/HC000/)

    const checklistResp = await rpc(request, 'create_committee_action_item_checklist', chefeToken, {
      p_action_item_id: itemId,
      p_title: 'Flag OFF probe',
    })
    expect(checklistResp.ok()).toBeFalsy()
    expect(JSON.stringify(await checklistResp.json())).toMatch(/HC000/)
  } finally {
    await setFeatureFlag('action_items', true)
  }
})

// ===========================================================================
// §7.11 — keyboard-only pass through the reminder/checklist/update panel
// ===========================================================================

test('§7.11: keyboard-only — open the panel, operate a control in each sub-section without the mouse', async ({
  page,
}) => {
  await signInAs(page, CHEFE_CCIH_EMAIL)
  await page.goto(meetingUrl())
  await createMeetingActionItemUI(page, { title: T_KEYBOARD }) // staff_admin -> full write access
  // Fresh navigation before touching the row — see the §7.2 comment on the
  // prod-standalone deferred-flush class. This is plain test setup (not part of
  // the keyboard-only claim below, which starts from here with real key events).
  await page.goto(meetingUrl())

  const row = itemRow(page, T_KEYBOARD)
  const disclosureBtn = row.getByRole('button', { name: `Acompanhamento de ${T_KEYBOARD}` })

  // Reach + operate the disclosure by keyboard.
  await disclosureBtn.focus()
  await expect(disclosureBtn).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(disclosureBtn).toHaveAttribute('aria-expanded', 'true')
  await expect(row.getByRole('region', { name: 'Lembretes' })).toBeVisible({ timeout: 10_000 })

  // Tab order sanity: the very next Tab from the disclosure lands on the first
  // focusable control inside the now-expanded region (the reminder type select).
  await page.keyboard.press('Tab')
  const reminderSelect = row.getByLabel('Quando avisar')
  await expect(reminderSelect).toBeFocused()

  // Operate the reminder select by keyboard (a focused native <select> jumps to
  // the option matching a typed letter — standard type-ahead, and the only
  // option starting with "N") and submit — a control fully driven without the
  // mouse.
  await page.keyboard.press('n') // "No dia do prazo"
  await expect(reminderSelect).toHaveValue('on_due')
  const reminders = row.getByRole('region', { name: 'Lembretes' })
  await reminders.getByRole('button', { name: 'Adicionar' }).focus()
  await expect(reminders.getByRole('button', { name: 'Adicionar' })).toBeFocused()
  await page.keyboard.press('Enter')
  // Scoped to the row `<ul>` — the composer's own <select> still carries an
  // option with this same text, which would otherwise strict-mode-violate.
  await expect(
    reminders.locator('ul').getByText('No dia do prazo', { exact: true }),
  ).toBeVisible()

  // Updates section: reload + re-open (keyboard-driven — see `reopenSatellites`
  // on why: the reminder mutation above can leave a control's `isPending` stuck
  // true on prod) before reaching the Mensagem field, then type + submit.
  const rowAfterReminder = await reopenSatellitesByKeyboard(page, T_KEYBOARD)
  const updates = rowAfterReminder.getByRole('region', { name: 'Atualizações' })
  const messageField = updates.getByLabel('Mensagem')
  await messageField.focus()
  await expect(messageField).toBeFocused()
  await page.keyboard.type('Nota via teclado — sem uso do mouse.')
  const postButton = updates.getByRole('button', { name: 'Registrar atualização' })
  await postButton.focus()
  await expect(postButton).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(updates.getByText('Nota via teclado — sem uso do mouse.')).toBeVisible()

  // Checklist: reload + re-open again, then reach the new-subtask input by
  // keyboard, type, submit with Enter (the input's own onKeyDown handler — a
  // keyboard-native submit path).
  const rowAfterUpdate = await reopenSatellitesByKeyboard(page, T_KEYBOARD)
  const checklist = rowAfterUpdate.getByRole('region', { name: 'Checklist' })
  const newSubtaskInput = checklist.getByLabel('Título da nova subtarefa')
  await newSubtaskInput.focus()
  await expect(newSubtaskInput).toBeFocused()
  await page.keyboard.type('Subtarefa via teclado')
  await page.keyboard.press('Enter')
  await expect(checklist.getByText('Subtarefa via teclado')).toBeVisible()
})
