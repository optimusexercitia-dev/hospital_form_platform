import { execSync } from 'node:child_process'
import { test, expect, type Page, type APIRequestContext, type Browser } from '@playwright/test'

/**
 * S1·N — Notifications (Phase 20; ADR 0076; build plan: docs/plans/notifications-s1.md §3).
 *
 * Test contract: translates the plan's §3 E2E bullets into Playwright assertions,
 * one vertical deep (CAPA action · section sign-off · meeting — ADR 0076 decision
 * 4), exercised here through the CAPA surface per the spawn contract. Runs against
 * the LOCAL Supabase stack (seeded personas). Run `npx supabase db reset --local`
 * before this run (fresh seed required); `--workers=1` recommended (stateful,
 * shares the DB with other spec files in a full-suite run).
 *
 * CAPA workspace access (`/o/[org]/nsp/capa/[capaId]`) is gated by
 * `getNspAccessByOrg` — an enrolled PQS member/coordinator of the hospital, NOT a
 * commission `staff_admin`. `chefe.ccih@test.local` has no PQS standing, so the
 * assigning actor here is `admin@test.local` (org_admin of Rede A + enrolled PQS
 * operator of hospital central-a, per the seed header) — she both reaches the
 * workspace AND has broad enough `profiles` SELECT visibility (RLS; org_admin) for
 * `listAssignableUsers()` to list other commissions' staff in the assignee
 * dropdown. `pqs.a@test.local` (a bare PQS operator, no org-admin standing) can
 * reach the workspace too, but her `profiles` RLS visibility is narrow — confirmed
 * empirically her assignee dropdown offers only HERSELF, so she cannot be used to
 * assign to a third party via the UI. CAPA action assignees are otherwise
 * unrestricted at the RPC layer (`add_capa_action` only checks the target profile
 * exists), so a plain (non-PQS) commission staff member CAN be assigned a CAPA
 * action — exercised deliberately below (see BUG-N-001).
 *
 * The notification center is opened via KEYBOARD (`openBell()` helper: focus +
 * Enter), never a pointer click on the trigger: in local `next dev`, the dev-mode
 * "devtools-indicator" badge (`<nextjs-portal>`, bottom-left, 36×36) physically
 * overlaps the bell's on-screen pixel exactly where the `AppSidebar` places it
 * (also bottom-left, near the user menu), so a real dispatched mouse click there
 * lands on the badge instead — confirmed even with Playwright's `force: true`
 * (which only skips actionability pre-checks, not the physical hit target).
 * Confirmed dev-only (the prod build carries no such indicator — this is why
 * `npm run e2e:prod` is the gate); not a product defect, so not filed as a bug.
 *
 * Personas used (password Test1234! for all):
 *   admin@test.local          org_admin + PQS operator of central-a — drives the
 *                             real UI form AND RPC-only fixture setup elsewhere
 *   staff2.ccih@test.local    plain staff, CCIH — event-driven assignee
 *   staff1.ccih@test.local    plain staff, CCIH — same-org bystander (isolation)
 *   staff1.qual.b@test.local  plain staff, Rede B — cross-org bystander (isolation)
 *   chefe.farm@test.local     staff_admin, Farmácia — time-driven/idempotency assignee
 *   staff1.farm@test.local    plain staff, Farmácia — preferences-suppression assignee
 *   staff2.farm@test.local    plain staff, Farmácia — auto-resolve assignee
 *   multi@test.local          staff of A+B — read-model (mark-read/mark-all/persist)
 *   staff3.ccih@test.local    plain staff, CCIH — keyboard-only pass
 *
 * Each functional test uses its OWN dedicated persona + a freshly-opened CAPA
 * plan/action (via `open_capa_plan`/`add_capa_action`), so tests are independent
 * of run order and don't collide with other spec files' seeded/fresh CAPA fixtures
 * sharing the same DB in a full-suite run.
 */

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
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}

const ADMIN_EMAIL = 'admin@test.local'

const STAFF2_CCIH_EMAIL = 'staff2.ccih@test.local'
const STAFF2_CCIH_ID = '00000000-0000-0000-0000-000000000004'
const STAFF1_CCIH_EMAIL = 'staff1.ccih@test.local'
const STAFF1_CCIH_ID = '00000000-0000-0000-0000-000000000003'
const STAFF1_QUAL_B_ID = '00000000-0000-0000-0000-0000000000b3'

const CHEFE_FARM_ID = '00000000-0000-0000-0000-000000000005'
const STAFF1_FARM_EMAIL = 'staff1.farm@test.local'
const STAFF1_FARM_ID = '00000000-0000-0000-0000-000000000006'
const STAFF2_FARM_EMAIL = 'staff2.farm@test.local'
const STAFF2_FARM_ID = '00000000-0000-0000-0000-000000000007'

const MULTI_EMAIL = 'multi@test.local'
const STAFF3_CCIH_EMAIL = 'staff3.ccih@test.local'
const STAFF4_CCIH_EMAIL = 'staff4.ccih@test.local'
const STAFF4_CCIH_ID = '00000000-0000-0000-0000-00000000000a'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 })
}

/** New isolated browser context + page, signed in as `email`. Caller closes the context. */
async function newSignedInPage(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await signInAs(page, email)
  return page
}

/** Opens the notification center via KEYBOARD (focus + Enter), not a pointer
 * click: in local `next dev`, the devtools-indicator badge physically overlaps
 * the bell's on-screen pixel (`AppSidebar` places the bell bottom-left, same
 * corner as the dev indicator) — a dev-only artifact (absent from the prod
 * build; not a product defect), but it means a real dispatched mouse click at
 * that coordinate lands on the badge instead, even with `force: true` (which
 * only skips Playwright's actionability pre-checks, not the physical hit
 * target). Keyboard activation sidesteps the coordinate entirely. */
async function openBell(page: Page): Promise<void> {
  const bell = page.getByRole('button', { name: /notificações/i })
  await bell.focus()
  await page.keyboard.press('Enter')
}

async function getOwnerToken(req: APIRequestContext, email: string, password = 'Test1234!'): Promise<string> {
  const resp = await req.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password },
  })
  expect(resp.ok()).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

async function restGet<T>(req: APIRequestContext, path: string, bearer = SUPABASE_SERVICE_KEY): Promise<T[]> {
  const resp = await req.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${bearer}` },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

async function rpc(req: APIRequestContext, fn: string, bearer: string, body: Record<string, unknown> = {}) {
  return req.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
      Prefer: 'params=single-object',
    },
    data: body,
  })
}

/** Service-role RPC call (for `compute_due_notifications`, which is NOT granted to `authenticated`). */
async function serviceRpc(req: APIRequestContext, fn: string, body: Record<string, unknown> = {}) {
  return rpc(req, fn, SUPABASE_SERVICE_KEY, body)
}

/** Opens a fresh manual CAPA plan (as `adminToken`, an operator of hospital central-a) and returns its id. */
async function openFreshCapaPlan(req: APIRequestContext, adminToken: string): Promise<string> {
  const resp = await rpc(req, 'open_capa_plan', adminToken, {
    p_source: 'manual',
    p_classification: 'corretiva',
  })
  expect(resp.ok()).toBeTruthy()
  const plan = (await resp.json()) as { id: string }
  return plan.id
}

/** Adds a CAPA action to `capaId` via `adminToken`; returns the created action row. */
async function addCapaAction(
  req: APIRequestContext,
  adminToken: string,
  capaId: string,
  opts: { title: string; assigneeUserId?: string; dueDate?: string },
): Promise<{ id: string; status: string; assignee_user_id: string | null }> {
  const resp = await rpc(req, 'add_capa_action', adminToken, {
    p_capa_id: capaId,
    p_title: opts.title,
    p_assignee_user_id: opts.assigneeUserId ?? null,
    p_due_date: opts.dueDate ?? null,
  })
  expect(resp.ok()).toBeTruthy()
  return (await resp.json()) as { id: string; status: string; assignee_user_id: string | null }
}

function isoDateDaysFromNow(deltaDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + deltaDays)
  return d.toISOString().split('T')[0]
}

function uniqueTitle(tag: string): string {
  return `Ação E2E notifications — ${tag} — ${Date.now()}`
}

/** Direct psql against the local Supabase Postgres container — the ONLY way to flip
 * `app.feature_flags` (the `app` schema is not exposed over PostgREST; config.toml
 * `db.schemas = ["public", "graphql_public"]` — same constraint noted in
 * sup-supersession.spec.ts). Used ONLY for the flag-OFF test, which restores the
 * flag to ON immediately after (every other spec in a full-suite run depends on it
 * being ON). Not an app-code mutation path — a direct row flip for test setup,
 * equivalent in spirit to a service-role seed write.
 */
function setNotificationsFlag(enabled: boolean): void {
  execSync(
    `docker exec supabase_db_azkbbhskturikxpgmafq psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "update app.feature_flags set enabled = ${enabled} where key = 'notifications';"`,
    { stdio: 'pipe' },
  )
}

// ---------------------------------------------------------------------------
// N-1 — Event-driven enqueue (real UI) + isolation (same-org + cross-org)
// ---------------------------------------------------------------------------

test('N-1: assigning a CAPA action via the real UI notifies the assignee only (same-org + cross-org isolation)', async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(90_000)

  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)
  const planId = await openFreshCapaPlan(request, adminToken)
  const title = uniqueTitle('N1-evento')

  // Drive the REAL UI enqueue path: admin@test.local (org_admin + PQS operator of
  // central-a) opens the CAPA workspace and uses "Adicionar ação" to assign to
  // staff2.ccih (a plain, non-PQS CCIH staff member).
  await signInAs(page, ADMIN_EMAIL)
  await page.goto(`/o/rede-a/nsp/capa/${planId}`)
  await page.getByRole('button', { name: /adicionar ação/i }).click()

  const dialog = page.getByRole('dialog', { name: /nova ação corretiva/i })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await dialog.getByLabel(/título da ação/i).fill(title)
  await dialog.getByLabel(/encarregado/i).selectOption(STAFF2_CCIH_ID)
  await dialog.getByRole('button', { name: /^adicionar ação$/i }).click()
  await expect(dialog).not.toBeVisible({ timeout: 10_000 })

  // Resolve the newly created action id (service-role read).
  const [action] = await restGet<{ id: string }>(
    request,
    `capa_action?capa_id=eq.${planId}&title=eq.${encodeURIComponent(title)}&select=id`,
  )
  expect(action, 'the action must have been created').toBeTruthy()
  const dedupKey = `capa:${action.id}:assigned`

  // Assignee got exactly one non-suppressible "assigned" notification.
  const assigneeRows = await restGet<{
    id: string
    is_reminder: boolean
    milestone: string
    read_at: string | null
  }>(request, `notifications?user_id=eq.${STAFF2_CCIH_ID}&dedup_key=eq.${encodeURIComponent(dedupKey)}&select=id,is_reminder,milestone,read_at`)
  expect(assigneeRows.length).toBe(1)
  expect(assigneeRows[0].is_reminder).toBe(false)
  expect(assigneeRows[0].milestone).toBe('assigned')
  expect(assigneeRows[0].read_at).toBeNull()

  // Same-org bystander (staff1.ccih) and cross-org bystander (staff1.qual.b, Rede
  // B) are both unaffected — no row for this entity at all.
  const bystanderSameOrg = await restGet<{ id: string }>(
    request,
    `notifications?user_id=eq.${STAFF1_CCIH_ID}&entity_id=eq.${action.id}&select=id`,
  )
  expect(bystanderSameOrg.length).toBe(0)
  const bystanderCrossOrg = await restGet<{ id: string }>(
    request,
    `notifications?user_id=eq.${STAFF1_QUAL_B_ID}&entity_id=eq.${action.id}&select=id`,
  )
  expect(bystanderCrossOrg.length).toBe(0)

  // UI: the assignee's bell shows the new item, and it deep-links to the
  // FIXED BUG-N-001 surface — the static, non-PQS-gated `/conta/itens-de-acao`
  // page (notificationHref('capa_action') no longer depends on any
  // per-recipient RLS lookup; see src/lib/routing.ts).
  const assigneePage = await newSignedInPage(browser, STAFF2_CCIH_EMAIL)
  try {
    await assigneePage.goto('/o/rede-a/c/ccih')
    const bell = assigneePage.getByRole('button', { name: /notificações/i })
    await expect(bell).toBeVisible({ timeout: 10_000 })
    await openBell(assigneePage)
    const item = assigneePage.getByRole('listitem').filter({ hasText: title })
    await expect(item).toBeVisible({ timeout: 10_000 })

    const href = await item.getAttribute('href')
    expect(href).toBe('/conta/itens-de-acao')

    await item.click()
    await assigneePage.waitForURL('**/conta/itens-de-acao', { timeout: 10_000 })
    await expect(assigneePage.getByText(title)).toBeVisible({ timeout: 10_000 })
  } finally {
    await assigneePage.context().close()
  }

  // Isolation, on the /conta/itens-de-acao surface itself: a bystander
  // (same-org, non-assignee) visiting the page does NOT see this action —
  // `list_my_assigned_capa_actions()` is self-scoped (assignee_user_id =
  // auth.uid()).
  const bystanderPage = await newSignedInPage(browser, STAFF1_CCIH_EMAIL)
  try {
    await bystanderPage.goto('/conta/itens-de-acao')
    await expect(bystanderPage.getByRole('heading', { name: /ações de capa/i })).toBeVisible({
      timeout: 10_000,
    })
    await expect(bystanderPage.getByText(title)).not.toBeVisible()
  } finally {
    await bystanderPage.context().close()
  }
})

// ---------------------------------------------------------------------------
// N-1b — BUG-N-001 fix acceptance: a non-PQS assignee lists AND ADVANCES their
// own CAPA action from /conta/itens-de-acao (PO Option A — ADR 0076 decision 3
// "actionable-to-me"); a non-assignee sees none (self-scoped RPC isolation).
// ---------------------------------------------------------------------------

test('N-1b: a non-PQS CAPA assignee can list and advance their action via /conta/itens-de-acao; a non-assignee sees none', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)

  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)
  const planId = await openFreshCapaPlan(request, adminToken)
  const title = uniqueTitle('N1b-avancar')
  const action = await addCapaAction(request, adminToken, planId, {
    title,
    assigneeUserId: STAFF4_CCIH_ID,
  })
  expect(action.status).toBe('pending')

  // staff4.ccih is a plain CCIH staff member — NOT PQS-enrolled (confirmed
  // earlier: her assignee dropdown is unreachable, and the old NSP-console
  // deep link would have 404d for her). She can still reach and act on her
  // OWN assigned action here.
  await signInAs(page, STAFF4_CCIH_EMAIL)
  await page.goto('/conta/itens-de-acao')
  await expect(page.getByRole('heading', { name: /ações de capa/i })).toBeVisible({ timeout: 10_000 })

  const card = page.locator('article').filter({ hasText: title })
  await expect(card).toBeVisible({ timeout: 10_000 })
  await expect(card.getByRole('button', { name: /iniciar/i })).toBeVisible()
  await expect(card.getByRole('button', { name: /concluir/i })).toBeVisible()

  // Iniciar: pending -> in_progress. advance_capa_action's assignee branch has
  // no PQS gate (only HC050 bites a non-assignee/non-writer).
  await card.getByRole('button', { name: /iniciar/i }).click()
  await expect(card.getByRole('button', { name: /iniciar/i })).not.toBeVisible({ timeout: 10_000 })
  const afterStart = await restGet<{ status: string }>(request, `capa_action?id=eq.${action.id}&select=status`)
  expect(afterStart[0]?.status).toBe('in_progress')

  // Concluir: in_progress -> completed. Terminal state renders no controls.
  await card.getByRole('button', { name: /concluir/i }).click()
  await expect(card.getByRole('button', { name: /concluir/i })).not.toBeVisible({ timeout: 10_000 })
  const afterComplete = await restGet<{ status: string; completed_at: string | null }>(
    request,
    `capa_action?id=eq.${action.id}&select=status,completed_at`,
  )
  expect(afterComplete[0]?.status).toBe('completed')
  expect(afterComplete[0]?.completed_at).not.toBeNull()

  // Isolation: a non-assignee (staff1.ccih) sees NOTHING of it on her own
  // /conta/itens-de-acao — list_my_assigned_capa_actions() is self-scoped.
  // Clear staff4.ccih's session first: `/login` redirects an already-
  // authenticated session straight to its home page instead of showing the
  // form, so a second `signInAs` on the SAME page/context would otherwise
  // hang waiting for a login field that never renders.
  await page.context().clearCookies()
  await signInAs(page, STAFF1_CCIH_EMAIL)
  await page.goto('/conta/itens-de-acao')
  await expect(page.getByRole('heading', { name: /ações de capa/i })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(title)).not.toBeVisible()
})

// ---------------------------------------------------------------------------
// N-2 — Time-driven scan + idempotency
// ---------------------------------------------------------------------------

test('N-2: compute_due_notifications enqueues overdue+still_open once; a second call inserts nothing new', async ({
  request,
}) => {
  test.setTimeout(60_000)

  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)
  const planId = await openFreshCapaPlan(request, adminToken)
  const title = uniqueTitle('N2-atrasada')
  const action = await addCapaAction(request, adminToken, planId, {
    title,
    assigneeUserId: CHEFE_FARM_ID,
    dueDate: isoDateDaysFromNow(-5),
  })
  expect(['pending', 'in_progress']).toContain(action.status)

  const firstResp = await serviceRpc(request, 'compute_due_notifications')
  expect(firstResp.ok()).toBeTruthy()
  const firstCount = (await firstResp.json()) as number
  expect(firstCount).toBeGreaterThanOrEqual(2) // at least MY overdue+still_open pair

  // `add_capa_action` with `assigneeUserId` set ALSO fires an immediate,
  // non-suppressible "assigned" event notification (is_reminder=false) — filter
  // to `is_reminder=true` to isolate the scan-produced reminder rows from it.
  const rowsAfterFirst = await restGet<{ id: string; milestone: string; is_reminder: boolean; resolved_at: string | null }>(
    request,
    `notifications?entity_type=eq.capa_action&entity_id=eq.${action.id}&is_reminder=eq.true&select=id,milestone,is_reminder,resolved_at`,
  )
  expect(rowsAfterFirst.length).toBe(2)
  expect(rowsAfterFirst.every((r) => r.resolved_at === null)).toBe(true)
  expect(new Set(rowsAfterFirst.map((r) => r.milestone))).toEqual(new Set(['overdue', 'still_open']))

  // Idempotency: a second call, seconds later, inserts NOTHING new anywhere
  // (nothing time-based can newly qualify within this window) and my entity's
  // reminder row count is unchanged.
  const secondResp = await serviceRpc(request, 'compute_due_notifications')
  expect(secondResp.ok()).toBeTruthy()
  const secondCount = (await secondResp.json()) as number
  expect(secondCount).toBe(0)

  const rowsAfterSecond = await restGet<{ id: string }>(
    request,
    `notifications?entity_type=eq.capa_action&entity_id=eq.${action.id}&is_reminder=eq.true&select=id`,
  )
  expect(rowsAfterSecond.length).toBe(2)
})

// ---------------------------------------------------------------------------
// N-3 — Preferences suppression (reminders only; assignment always fires)
// ---------------------------------------------------------------------------

test('N-3: disabling CAPA reminders suppresses the scan reminder but NOT a new assignment', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)

  await signInAs(page, STAFF1_FARM_EMAIL)
  await page.goto('/conta/notificacoes')
  const capaSwitch = page.getByRole('switch', { name: /ações de capa/i })
  await expect(capaSwitch).toBeVisible({ timeout: 10_000 })
  if ((await capaSwitch.getAttribute('aria-checked')) !== 'false') {
    await capaSwitch.click()
  }
  await expect(capaSwitch).toHaveAttribute('aria-checked', 'false')

  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)

  // A fresh overdue action assigned to staff1.farm — the reminder scan must
  // suppress it (surface=capa, reminders_enabled=false).
  const planId = await openFreshCapaPlan(request, adminToken)
  const reminderAction = await addCapaAction(request, adminToken, planId, {
    title: uniqueTitle('N3-lembrete-suprimido'),
    assigneeUserId: STAFF1_FARM_ID,
    dueDate: isoDateDaysFromNow(-2),
  })
  await serviceRpc(request, 'compute_due_notifications')
  // Filter to is_reminder=true: the action's own creation-time "assigned" event
  // (is_reminder=false) always fires regardless of the preference — only the
  // SCAN-produced reminder must be suppressed.
  const reminderRows = await restGet<{ id: string }>(
    request,
    `notifications?entity_type=eq.capa_action&entity_id=eq.${reminderAction.id}&is_reminder=eq.true&select=id`,
  )
  expect(reminderRows.length).toBe(0)

  // A fresh ASSIGNMENT to the same user (non-suppressible, event-driven) still fires.
  const assignAction = await addCapaAction(request, adminToken, planId, {
    title: uniqueTitle('N3-atribuicao-nao-suprimida'),
    assigneeUserId: STAFF1_FARM_ID,
  })
  const assignRows = await restGet<{ id: string; milestone: string; is_reminder: boolean }>(
    request,
    `notifications?entity_type=eq.capa_action&entity_id=eq.${assignAction.id}&user_id=eq.${STAFF1_FARM_ID}&select=id,milestone,is_reminder`,
  )
  expect(assignRows.length).toBe(1)
  expect(assignRows[0].milestone).toBe('assigned')
  expect(assignRows[0].is_reminder).toBe(false)

  // Restore: re-enable the toggle (shared DB hygiene for any later run).
  await page.bringToFront()
  if ((await capaSwitch.getAttribute('aria-checked')) !== 'true') {
    await capaSwitch.click()
  }
  await expect(capaSwitch).toHaveAttribute('aria-checked', 'true')
})

// ---------------------------------------------------------------------------
// N-4 — Auto-resolve on task completion
// ---------------------------------------------------------------------------

test('N-4: completing the CAPA action stamps resolved_at on its unresolved reminders', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)

  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)
  const planId = await openFreshCapaPlan(request, adminToken)
  const title = uniqueTitle('N4-resolver')
  const action = await addCapaAction(request, adminToken, planId, {
    title,
    assigneeUserId: STAFF2_FARM_ID,
    dueDate: isoDateDaysFromNow(-3),
  })
  await serviceRpc(request, 'compute_due_notifications')

  // is_reminder=true filters out the creation-time "assigned" event row (never
  // auto-resolved — only reminders are, per ADR 0076 decision 9).
  const before = await restGet<{ id: string; resolved_at: string | null }>(
    request,
    `notifications?entity_type=eq.capa_action&entity_id=eq.${action.id}&is_reminder=eq.true&select=id,resolved_at`,
  )
  expect(before.length).toBe(2)
  expect(before.every((r) => r.resolved_at === null)).toBe(true)

  // UI sanity: the reminder is visible to the assignee before resolution.
  await signInAs(page, STAFF2_FARM_EMAIL)
  await page.goto('/o/rede-a/c/farmacia')
  await openBell(page)
  await expect(page.getByRole('listitem').filter({ hasText: /atrasada|ainda em aberto/i }).first()).toBeVisible({
    timeout: 10_000,
  })
  await page.keyboard.press('Escape')

  // Assignee self-advances (completes) their own action.
  const assigneeToken = await getOwnerToken(request, STAFF2_FARM_EMAIL)
  const advanceResp = await rpc(request, 'advance_capa_action', assigneeToken, {
    p_action_id: action.id,
    p_status: 'completed',
  })
  expect(advanceResp.ok()).toBeTruthy()

  const after = await restGet<{ id: string; resolved_at: string | null }>(
    request,
    `notifications?entity_type=eq.capa_action&entity_id=eq.${action.id}&is_reminder=eq.true&select=id,resolved_at`,
  )
  expect(after.length).toBe(2)
  expect(after.every((r) => r.resolved_at !== null)).toBe(true)

  // BUG-N-002 (FIXED): `listNotifications`/`getUnreadCount` now filter
  // `resolved_at IS NULL`, so the two REMINDERS (milestone overdue/still_open,
  // fixed pt-BR titles "Ação CAPA atrasada" / "Ação CAPA ainda em aberto")
  // must drop out of the center. The "assigned" EVENT notification for this
  // same entity is a DIFFERENT row (is_reminder=false, never resolved —
  // assignments persist as history, ADR 0076 decision 9) and its body also
  // happens to contain the action's own title, so we must assert on the
  // reminder-specific fixed label, NOT on `title` (which would also match the
  // still-legitimately-present "assigned" item and produce a false failure).
  await page.reload()
  await openBell(page)
  await expect(
    page.getByRole('listitem').filter({ hasText: /atrasada|ainda em aberto/i }),
  ).toHaveCount(0, { timeout: 8_000 })
  // The non-suppressible "assigned" notification for this entity is untouched
  // and still listed (assignments never resolve). `.first()`: staff2.farm may
  // carry more than one such row across the persona's notification history.
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Nova ação CAPA atribuída a você' }).first(),
  ).toBeVisible()
})

// ---------------------------------------------------------------------------
// N-5 — Read model: per-item mark-read, mark-all-read, persists across reload
// ---------------------------------------------------------------------------

test('N-5: per-item mark-read clears one from the badge; mark-all clears the rest; persists on reload', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)

  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)
  const planId = await openFreshCapaPlan(request, adminToken)
  const titleA = uniqueTitle('N5-item-A')
  const titleB = uniqueTitle('N5-item-B')
  const actionA = await addCapaAction(request, adminToken, planId, { title: titleA, assigneeUserId: '00000000-0000-0000-0000-000000000008' })
  const actionB = await addCapaAction(request, adminToken, planId, { title: titleB, assigneeUserId: '00000000-0000-0000-0000-000000000008' })

  await signInAs(page, MULTI_EMAIL)
  await page.goto('/o/rede-a/c/ccih')

  await openBell(page)
  const before = await restGet<{ id: string }>(
    request,
    `notifications?user_id=eq.00000000-0000-0000-0000-000000000008&read_at=is.null&select=id`,
  )
  expect(before.length).toBeGreaterThanOrEqual(2)

  const itemA = page.getByRole('listitem').filter({ hasText: titleA })
  await expect(itemA).toBeVisible({ timeout: 10_000 })
  await itemA.click()
  // Clicking navigates away (capa deep link); come back and reopen the center.
  await page.goto('/o/rede-a/c/ccih')
  await openBell(page)

  // Notifications.title is the FIXED pt-BR label ("Nova ação CAPA atribuída a
  // você"); the action's own title lands in `body`. Match by entity_id instead.
  const afterOne = await restGet<{ id: string; read_at: string | null }>(
    request,
    `notifications?user_id=eq.00000000-0000-0000-0000-000000000008&entity_id=eq.${actionA.id}&select=id,read_at`,
  )
  expect(afterOne.length).toBe(1)
  expect(afterOne[0]?.read_at).not.toBeNull()
  const itemBStillUnread = await restGet<{ id: string; read_at: string | null }>(
    request,
    `notifications?user_id=eq.00000000-0000-0000-0000-000000000008&entity_id=eq.${actionB.id}&select=id,read_at`,
  )
  expect(itemBStillUnread.length).toBe(1)
  expect(itemBStillUnread[0]?.read_at).toBeNull()

  // Mark all as read.
  const markAll = page.getByRole('button', { name: /marcar todas como lidas/i })
  if (await markAll.isVisible().catch(() => false)) {
    await markAll.click()
  }
  await page.waitForTimeout(500) // allow the server action's revalidate to land

  const allRead = await restGet<{ id: string }>(
    request,
    `notifications?user_id=eq.00000000-0000-0000-0000-000000000008&read_at=is.null&select=id`,
  )
  expect(allRead.length).toBe(0)

  // Persists across reload: badge shows 0 unread (exact aria-label, no "N não
  // lida(s)" suffix). `getByRole` — not a raw CSS attribute selector — because
  // the layout renders a second, `display:none` (mobile-header) bell instance;
  // the accessibility tree correctly excludes it, a plain CSS query does not.
  await page.reload()
  const badge = page.getByRole('button', { name: 'Notificações', exact: true })
  await expect(badge).toBeVisible({ timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// N-6 — Keyboard-only pass: bell → center → operate → Escape; prefs toggles
// ---------------------------------------------------------------------------

test('N-6: keyboard-only — Tab to bell, Enter opens center, operate it, Escape closes; prefs toggles are keyboard-operable', async ({
  page,
  request,
}) => {
  test.setTimeout(60_000)

  const adminToken = await getOwnerToken(request, ADMIN_EMAIL)
  const planId = await openFreshCapaPlan(request, adminToken)
  const title = uniqueTitle('N6-teclado')
  await addCapaAction(request, adminToken, planId, {
    title,
    assigneeUserId: '00000000-0000-0000-0000-000000000009', // staff3.ccih
  })

  await signInAs(page, STAFF3_CCIH_EMAIL)
  await page.goto('/o/rede-a/c/ccih')

  const bell = page.getByRole('button', { name: /notificações/i })
  await bell.focus()
  await expect(bell).toBeFocused()
  await page.keyboard.press('Enter')

  const list = page.getByRole('list', { name: /lista de notificações/i })
  await expect(list).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 })

  // Operate: Tab to "Marcar todas como lidas" and activate via keyboard.
  const markAll = page.getByRole('button', { name: /marcar todas como lidas/i })
  if (await markAll.isVisible().catch(() => false)) {
    await markAll.focus()
    await expect(markAll).toBeFocused()
    await page.keyboard.press('Enter')
  }

  await page.keyboard.press('Escape')
  await expect(list).not.toBeVisible({ timeout: 10_000 })

  // Preferences page: toggles are keyboard-operable (Tab + Space) — the CORE
  // requirement (spawn item 7).
  await page.goto('/conta/notificacoes')
  const capaSwitch = page.getByRole('switch', { name: /ações de capa/i })
  await expect(capaSwitch).toBeVisible({ timeout: 10_000 })
  await capaSwitch.focus()
  await expect(capaSwitch).toBeFocused()
  const before = await capaSwitch.getAttribute('aria-checked')
  await page.keyboard.press('Space')
  await expect(capaSwitch).not.toHaveAttribute('aria-checked', before ?? '')

  // BUG-N-003 (FIXED): the fieldset no longer disables during the round-trip
  // (a per-surface `pendingSurfaces` in-flight guard replaces it), so the
  // toggled switch keeps keyboard focus instead of auto-blurring to <body>.
  await expect(capaSwitch.evaluate((el) => el === document.activeElement)).resolves.toBe(true)

  // Restore. The in-flight guard means a Space pressed WHILE the first
  // round-trip is still pending is silently ignored (re-entrancy protection,
  // not a bug) — wait for `aria-busy="false"` before pressing again, not just
  // "enabled" (the control is never disabled now).
  await expect(capaSwitch).toHaveAttribute('aria-busy', 'false', { timeout: 5_000 })
  await expect(capaSwitch).toBeFocused()
  await page.keyboard.press('Space')
  await expect(capaSwitch).toHaveAttribute('aria-checked', before ?? 'true')
})

// ---------------------------------------------------------------------------
// N-7 — Flag-OFF: no bell renders; /conta/notificacoes 404s. Restores ON after.
// ---------------------------------------------------------------------------

test('N-7: flag OFF — no bell renders anywhere, /conta/notificacoes 404s; restored ON after', async ({ page }) => {
  test.setTimeout(60_000)

  setNotificationsFlag(false)
  try {
    await signInAs(page, STAFF1_CCIH_EMAIL)
    await page.goto('/o/rede-a/c/ccih')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /notificações/i })).not.toBeVisible()

    await page.goto('/conta/notificacoes')
    await expect(page.getByRole('heading', { name: /erro 404|não encontramos esta página/i })).toBeVisible({
      timeout: 10_000,
    })
  } finally {
    setNotificationsFlag(true)
  }

  // Confirm restoration: bell is back.
  await page.goto('/o/rede-a/c/ccih')
  await expect(page.getByRole('button', { name: /notificações/i })).toBeVisible({ timeout: 15_000 })
})
