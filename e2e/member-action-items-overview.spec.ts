import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

/**
 * "Meus itens de ação" (unified member action-item list) + member "Visão Geral"
 * (5-card overview) — Playwright E2E spec.
 *
 * Two additive, current-commission-scoped UI features backed by two self-scoped
 * SECURITY DEFINER RPCs (`list_my_action_items`, `get_member_overview`;
 * migration 20260704000000):
 *
 *   Feature 1 — "Meus itens de ação" (`/o/{org}/c/{comm}/meus-itens-de-acao`):
 *     a read-only list of action items ASSIGNED TO the current user across the
 *     case + meeting sources for THIS commission (NOT CAPA). Columns Título ·
 *     Gerado de · Criado em · Prazo · Status · Atribuído por + description
 *     preview + overdue flag; default active-only with a toggle; source-type
 *     filter; links out to the member-reachable source detail.
 *
 *   Feature 2 — "Visão Geral" (the commission root page):
 *     a per-member 5-card overview (Casos não concluídos · Itens de ação
 *     pendentes · Reuniões não concluídas · Assinaturas pendentes · Respostas em
 *     andamento), same for staff + staff_admin, each clickable to the relevant
 *     member surface, plus two secondary hints (n em atraso / próxima em {date}).
 *
 * Acceptance criteria 1–16 from the task brief are annotated inline (AC-N).
 *
 * Fixture strategy: the tester OWNS these fixtures. The seed already gives
 * `staff1.ccih` exactly ONE action item (a meeting item, open, not overdue), one
 * in-progress response, one attributed non-concluded case (Caso 0001 phase 1),
 * and one attended non-concluded meeting (past, so no upcoming hint). To exercise
 * the isolation / mixed-source / overdue / done+cancelled / upcoming-meeting /
 * counts criteria the seed lacks, this spec INSERTS its own rows via the
 * service-role REST endpoint (bypassing RLS, mirroring the cases-extras /
 * case-phase-result specs) under a deterministic title tag, and DELETES them in
 * afterAll. No app code, migrations, or seed are touched.
 *
 * All feature flags default ON in the seed baseline (cases_extras / meetings /
 * case_access); one test flips `case_access` OFF to prove the case link degrades
 * to plain text, and restores it.
 *
 * Persona passwords: Test1234!  ·  Run with --project=chromium --workers=1
 * against a freshly `supabase db reset`-seeded stack.
 */

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}

// Org + commission slugs (seed.sql).
const ORG_A = 'rede-a'
const COMM_CCIH = 'ccih'

// Commission ids (seed.sql).
const COMM_CCIH_ID = 'a0000000-0000-0000-0000-0000000000a1'
const COMM_FARM_ID = 'b0000000-0000-0000-0000-0000000000b1'

// Persona ids (seed.sql).
const STAFF1_CCIH = '00000000-0000-0000-0000-000000000003' // staff, commission A
const STAFF2_CCIH = '00000000-0000-0000-0000-000000000004' // staff, commission A
const STAFF4_CCIH = '00000000-0000-0000-0000-00000000000a' // staff, commission A (boundary persona: no items)
const CHEFE_CCIH = '00000000-0000-0000-0000-000000000002' // staff_admin, commission A

// Seeded fixtures (seed.sql).
const SEEDED_CASE_ID = 'd0000000-0000-0000-0000-0000000000c1' // Caso 0001, pendente
const SEEDED_MEETING_ID = 'f1000000-0000-0000-0000-0000000000e1' // Reunião ... realizada

// Deterministic tag so our inserted rows are recognizable + cleanable.
const TAG = 'MAIO-E2E' // "Meus itens de Ação / Overview E2E"

// ---------------------------------------------------------------------------
// Auth + navigation helpers (mirror the existing specs)
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

// ---------------------------------------------------------------------------
// Service-role REST helpers (fixture setup / teardown; bypasses RLS)
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

/** GET rows matching a PostgREST filter (service-role; bypasses RLS). */
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

/**
 * The GLOBAL (commission_id NULL) shared-hub status id for a lifecycle key
 * (open/in_progress/done/cancelled) — the shared `action_items` hub keys status
 * by id, so meeting/manual fixture rows must carry a `status_id`, not a text
 * `status`. Resolved once per beforeAll via the service REST endpoint.
 */
async function globalStatusId(
  req: APIRequestContext,
  key: string,
): Promise<string> {
  const rows = await svcSelect<{ id: string }>(
    req,
    'action_item_statuses',
    `key=eq.${key}&commission_id=is.null&select=id`,
  )
  expect(rows.length, `global status "${key}" must be seeded`).toBe(1)
  return rows[0].id
}

/** DELETE rows matching a PostgREST filter (e.g. `title=like.*${TAG}*`). */
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
  // 200/204 both acceptable; do not fail teardown on "nothing to delete".
  expect([200, 204].includes(resp.status())).toBeTruthy()
}

/** Flip a feature flag ON/OFF via the local supabase CLI. */
async function setFeatureFlag(flagKey: string, enabled: boolean) {
  const { execSync } = await import('child_process')
  execSync(
    `npx supabase db query --local "UPDATE app.feature_flags SET enabled = ${enabled} WHERE key = '${flagKey}'"`,
    { cwd: process.cwd(), stdio: 'pipe' },
  )
}

/** Local YYYY-MM-DD offset by `days` from today (for due_date fixtures). */
function isoDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Fixture rows (created once, torn down once). Deterministic titles carry TAG.
// ---------------------------------------------------------------------------

// Titles — unique per fixture so we can target exact rows.
const T_CASE_OVERDUE = `${TAG} Caso vencido (staff1)`
const T_CASE_ACTIVE = `${TAG} Caso ativo sem prazo (staff1)`
const T_CASE_DONE = `${TAG} Caso concluído (staff1)`
const T_MEETING_ACTIVE = `${TAG} Reunião com prazo (staff1)`
const T_MEETING_CANCELLED = `${TAG} Reunião cancelada (staff1)`
const T_MANUAL_ACTIVE = `${TAG} Avulso ativo (staff1)`
const T_OTHER_ASSIGNEE = `${TAG} Item de outro usuário (staff2)`
const T_OTHER_COMMISSION = `${TAG} Item de outra comissão (staff1 Farmácia)`

test.beforeAll(async ({ request }) => {
  // Ensure the three flags are ON (seed default; defensive against a prior
  // aborted run that flipped case_access OFF and failed to restore).
  await setFeatureFlag('cases_extras', true)
  await setFeatureFlag('meetings', true)
  await setFeatureFlag('case_access', true)

  // Idempotent cleanup of any leftover rows from a prior aborted run.
  await teardownFixtures(request)

  // Global hub status ids (the hub keys status by id, not text). Case action
  // items were folded into the shared action_items hub (migration 20260707;
  // source_type='case', linked via source_case_id, hard-forced case_restricted by
  // the guard). All three sources now live on public.action_items with a status_id.
  const openId = await globalStatusId(request, 'open')
  const inProgressId = await globalStatusId(request, 'in_progress')
  const doneId = await globalStatusId(request, 'done')
  const cancelledId = await globalStatusId(request, 'cancelled')

  // --- CASE action items on Caso 0001 (commission A) assigned to staff1, now on
  // the shared hub (source_type='case', source_case_id) ---
  // (a) overdue + active → shows the overdue flag, sorts first.
  await svcInsert(request, 'action_items', {
    commission_id: COMM_CCIH_ID,
    source_type: 'case',
    source_case_id: SEEDED_CASE_ID,
    title: T_CASE_OVERDUE,
    description: 'Prévia da descrição do item vencido.',
    status_id: openId,
    assigned_to: STAFF1_CCIH,
    due_date: isoDate(-3),
    created_by: CHEFE_CCIH,
  })
  // (b) active, NO deadline → sorts last among active.
  await svcInsert(request, 'action_items', {
    commission_id: COMM_CCIH_ID,
    source_type: 'case',
    source_case_id: SEEDED_CASE_ID,
    title: T_CASE_ACTIVE,
    description: null,
    status_id: inProgressId,
    assigned_to: STAFF1_CCIH,
    due_date: null,
    created_by: CHEFE_CCIH,
  })
  // (c) done → hidden by default, revealed by the toggle.
  await svcInsert(request, 'action_items', {
    commission_id: COMM_CCIH_ID,
    source_type: 'case',
    source_case_id: SEEDED_CASE_ID,
    title: T_CASE_DONE,
    status_id: doneId,
    assigned_to: STAFF1_CCIH,
    due_date: isoDate(-10),
    created_by: CHEFE_CCIH,
  })

  // (d) MEETING-source, active, future deadline (not overdue) — mixes case +
  // meeting sources. Guard requires source_meeting_id in the same commission.
  await svcInsert(request, 'action_items', {
    commission_id: COMM_CCIH_ID,
    source_type: 'meeting',
    source_meeting_id: SEEDED_MEETING_ID,
    title: T_MEETING_ACTIVE,
    description: 'Prévia da descrição do item de reunião.',
    status_id: openId,
    assigned_to: STAFF1_CCIH,
    due_date: isoDate(20),
    created_by: CHEFE_CCIH,
  })
  // (e) MEETING-source, cancelled → hidden by default, revealed by the toggle.
  await svcInsert(request, 'action_items', {
    commission_id: COMM_CCIH_ID,
    source_type: 'meeting',
    source_meeting_id: SEEDED_MEETING_ID,
    title: T_MEETING_CANCELLED,
    status_id: cancelledId,
    assigned_to: STAFF1_CCIH,
    due_date: null,
    created_by: CHEFE_CCIH,
  })
  // (f) MANUAL-source, active, future deadline — a standalone committee task with
  // NO parent meeting/case: renders the "Avulso" badge with no source link.
  await svcInsert(request, 'action_items', {
    commission_id: COMM_CCIH_ID,
    source_type: 'manual',
    title: T_MANUAL_ACTIVE,
    description: 'Tarefa autônoma da comissão.',
    status_id: openId,
    assigned_to: STAFF1_CCIH,
    due_date: isoDate(12),
    created_by: CHEFE_CCIH,
  })

  // --- ISOLATION: item assigned to a DIFFERENT user (staff2) same commission --
  await svcInsert(request, 'action_items', {
    commission_id: COMM_CCIH_ID,
    source_type: 'meeting',
    source_meeting_id: SEEDED_MEETING_ID,
    title: T_OTHER_ASSIGNEE,
    status_id: openId,
    assigned_to: STAFF2_CCIH,
    due_date: isoDate(5),
    created_by: CHEFE_CCIH,
  })

  // --- ISOLATION: item assigned to staff1 but in ANOTHER commission (Farmácia).
  // Modeled as a case-sourced hub row on a TAG-named Farmácia case. The row's
  // commission_id must match the case's commission (guard: HC032), so use
  // COMM_FARM_ID. The reader RPC scopes by commission_id = p_commission, so this
  // row must NOT appear on the CCIH page. (A meeting-source row can't stand in
  // here — its guard ties source_meeting_id to its own commission.)
  const farmCase = await svcInsert<{ id: string }>(request, 'cases', {
    commission_id: COMM_FARM_ID,
    label: `${TAG} Caso Farmácia (isolamento)`,
    status: 'pendente',
    created_by: CHEFE_CCIH,
  })
  await svcInsert(request, 'action_items', {
    commission_id: COMM_FARM_ID,
    source_type: 'case',
    source_case_id: farmCase.id,
    title: T_OTHER_COMMISSION,
    status_id: openId,
    assigned_to: STAFF1_CCIH,
    due_date: isoDate(5),
    created_by: CHEFE_CCIH,
  })

  // --- UPCOMING MEETING for the next-meeting hint: an `agendada` meeting in the
  // future with staff1 as a present attendee. Gives the overview a non-null
  // nextMeetingStart + bumps meetingsNotConcluded. ---
  const nextMeeting = await svcInsert<{ id: string }>(request, 'meetings', {
    commission_id: COMM_CCIH_ID,
    title: `${TAG} Reunião futura`,
    status: 'agendada',
    scheduled_start: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    modality: 'presencial',
    created_by: CHEFE_CCIH,
  })
  await svcInsert(request, 'meeting_attendees', {
    meeting_id: nextMeeting.id,
    user_id: STAFF1_CCIH,
    role: 'membro',
    attendance: 'presente',
  })
})

test.afterAll(async ({ request }) => {
  await teardownFixtures(request)
  // Always restore case_access ON (seed default) in case a test flipped it.
  await setFeatureFlag('case_access', true)
})

async function teardownFixtures(request: APIRequestContext) {
  // Action items first (children), then their parents. ALL action items (case +
  // meeting + manual sources) now live on the shared public.action_items hub and
  // match by title; the isolation item's parent Farmácia case matches by label.
  await svcDelete(request, 'action_items', `title=like.*${TAG}*`)
  // The TAG-named Farmácia case created for the cross-commission isolation row.
  await svcDelete(request, 'cases', `label=like.*${TAG}*`)
  // Attendees on our future meeting cascade with the meeting; delete the meeting
  // by title. (meeting_attendees FK is ON DELETE CASCADE per the schema.)
  await svcDelete(request, 'meetings', `title=like.*${TAG}*`)
}

// ===========================================================================
// FEATURE 1 — "Meus itens de ação"
// ===========================================================================

// AC-1: the nav item shows in MEU TRABALHO for both roles and navigates.
test('AC-1: nav "Meus itens de ação" shows for staff + staff_admin and navigates', async ({
  page,
}) => {
  // staff
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}`)
  const navStaff = page.getByRole('link', { name: 'Meus itens de ação' })
  await expect(navStaff).toBeVisible()
  await navStaff.click()
  await page.waitForURL(`**/o/${ORG_A}/c/${COMM_CCIH}/meus-itens-de-acao`)
  await expect(
    page.getByRole('heading', { name: 'Meus itens de ação', level: 1 }),
  ).toBeVisible()
  await signOut(page)

  // staff_admin
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}`)
  await expect(
    page.getByRole('link', { name: 'Meus itens de ação' }),
  ).toBeVisible()
})

// AC-2 + AC-3: the page lists ONLY the caller's items in THIS commission (isolation),
//              and renders the documented columns / mixed sources.
test('AC-2/3: lists only own items in this commission, mixed case+meeting sources, correct columns', async ({
  page,
}) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}/meus-itens-de-acao`)

  const table = page.getByRole('table')
  await expect(table).toBeVisible()

  // Column headers (pt-BR).
  for (const col of [
    'Título',
    'Gerado de',
    'Criado em',
    'Prazo',
    'Status',
    'Atribuído por',
  ]) {
    await expect(
      page.getByRole('columnheader', { name: col }),
    ).toBeVisible()
  }

  // Own active items are present (case + meeting + manual → three sources).
  await expect(page.getByRole('cell', { name: T_CASE_OVERDUE })).toBeVisible()
  await expect(page.getByRole('cell', { name: T_CASE_ACTIVE })).toBeVisible()
  await expect(page.getByRole('cell', { name: T_MEETING_ACTIVE })).toBeVisible()
  await expect(page.getByRole('cell', { name: T_MANUAL_ACTIVE })).toBeVisible()

  // All three source badges appear (Caso + Reunião + Avulso).
  await expect(
    page.getByRole('cell').filter({ hasText: 'Caso' }).first(),
  ).toBeVisible()
  await expect(
    page.getByRole('cell').filter({ hasText: 'Reunião' }).first(),
  ).toBeVisible()
  // The manual item renders the "Avulso" badge and — being a standalone task —
  // carries NO source link in its "Gerado de" cell.
  const manualRow = page.getByRole('row').filter({ hasText: T_MANUAL_ACTIVE })
  await expect(manualRow).toContainText('Avulso')
  await expect(manualRow.getByRole('link')).toHaveCount(0)

  // "Atribuído por" resolves the creator display name (Chefe CCIH).
  const overdueRow = page.getByRole('row').filter({ hasText: T_CASE_OVERDUE })
  await expect(overdueRow).toContainText('Chefe CCIH')
  // Description preview shows.
  await expect(overdueRow).toContainText('Prévia da descrição do item vencido')

  // ISOLATION — an item assigned to someone else must NOT appear.
  await expect(
    page.getByRole('cell', { name: T_OTHER_ASSIGNEE }),
  ).toHaveCount(0)
  // ISOLATION — an item in another commission must NOT appear.
  await expect(
    page.getByRole('cell', { name: T_OTHER_COMMISSION }),
  ).toHaveCount(0)
})

// AC-4: default view = active only (Aberto + Em andamento); the toggle reveals
//       Concluído + Cancelado.
test('AC-4: default shows active only; toggle reveals resolved', async ({
  page,
}) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}/meus-itens-de-acao`)

  // Resolved rows hidden by default.
  await expect(page.getByRole('cell', { name: T_CASE_DONE })).toHaveCount(0)
  await expect(
    page.getByRole('cell', { name: T_MEETING_CANCELLED }),
  ).toHaveCount(0)
  // Active rows shown.
  await expect(page.getByRole('cell', { name: T_CASE_OVERDUE })).toBeVisible()

  // Flip the toggle.
  const toggle = page.getByRole('checkbox', {
    name: /mostrar concluídos e cancelados/i,
  })
  await toggle.check()

  // Resolved rows now visible, with their status pills.
  const doneRow = page.getByRole('row').filter({ hasText: T_CASE_DONE })
  await expect(doneRow).toBeVisible()
  await expect(doneRow).toContainText('Concluído')
  const cancelledRow = page
    .getByRole('row')
    .filter({ hasText: T_MEETING_CANCELLED })
  await expect(cancelledRow).toBeVisible()
  await expect(cancelledRow).toContainText('Cancelado')

  // Active rows still visible.
  await expect(page.getByRole('cell', { name: T_CASE_OVERDUE })).toBeVisible()
})

// AC-5: source-type filter (Todos / Caso / Reunião / Avulso).
test('AC-5: source-type filter restricts rows to the chosen source', async ({
  page,
}) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}/meus-itens-de-acao`)

  const group = page.getByRole('radiogroup', { name: /filtrar por origem/i })

  // Filter to Caso: meeting + manual items disappear, case items remain.
  await group.getByRole('radio', { name: 'Caso' }).click()
  await expect(page.getByRole('cell', { name: T_CASE_OVERDUE })).toBeVisible()
  await expect(page.getByRole('cell', { name: T_CASE_ACTIVE })).toBeVisible()
  await expect(
    page.getByRole('cell', { name: T_MEETING_ACTIVE }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('cell', { name: T_MANUAL_ACTIVE }),
  ).toHaveCount(0)

  // Filter to Reunião: case + manual items disappear, meeting item remains.
  await group.getByRole('radio', { name: 'Reunião' }).click()
  await expect(page.getByRole('cell', { name: T_MEETING_ACTIVE })).toBeVisible()
  await expect(page.getByRole('cell', { name: T_CASE_OVERDUE })).toHaveCount(0)
  await expect(page.getByRole('cell', { name: T_MANUAL_ACTIVE })).toHaveCount(0)

  // Filter to Avulso: only the standalone manual item remains.
  await group.getByRole('radio', { name: 'Avulso' }).click()
  await expect(page.getByRole('cell', { name: T_MANUAL_ACTIVE })).toBeVisible()
  await expect(page.getByRole('cell', { name: T_MEETING_ACTIVE })).toHaveCount(0)
  await expect(page.getByRole('cell', { name: T_CASE_OVERDUE })).toHaveCount(0)

  // Back to Todos: all three sources return.
  await group.getByRole('radio', { name: 'Todos' }).click()
  await expect(page.getByRole('cell', { name: T_CASE_OVERDUE })).toBeVisible()
  await expect(page.getByRole('cell', { name: T_MEETING_ACTIVE })).toBeVisible()
  await expect(page.getByRole('cell', { name: T_MANUAL_ACTIVE })).toBeVisible()
})

// AC-6: sort = overdue-first then earliest Prazo; a past-due active item shows
//       the overdue flag; a no-deadline item sorts last.
test('AC-6: sort order (overdue first, earliest due, no-deadline last) + overdue flag', async ({
  page,
}) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}/meus-itens-de-acao`)

  // The overdue active item renders the overdue flag ("em atraso" sr-only text).
  const overdueRow = page.getByRole('row').filter({ hasText: T_CASE_OVERDUE })
  await expect(overdueRow).toContainText('em atraso')

  // Collect the ordered visible titles among OUR fixtures (active view).
  // Expected order for the three active items:
  //   1. T_CASE_OVERDUE   (overdue, due -3)         → first
  //   2. T_MEETING_ACTIVE (dated, due +20, future)  → next (earliest future due)
  //   3. T_CASE_ACTIVE    (no deadline)             → last
  const orderedTitles = await page
    .getByRole('row')
    .filter({ hasText: TAG })
    .evaluateAll((rows) =>
      rows
        .map((r) => r.querySelector('td')?.textContent ?? '')
        .filter((t) => t.includes('MAIO-E2E')),
    )

  const idxOverdue = orderedTitles.findIndex((t) =>
    t.includes('Caso vencido'),
  )
  const idxMeeting = orderedTitles.findIndex((t) =>
    t.includes('Reunião com prazo'),
  )
  const idxNoDue = orderedTitles.findIndex((t) =>
    t.includes('Caso ativo sem prazo'),
  )

  expect(idxOverdue).toBeGreaterThanOrEqual(0)
  expect(idxMeeting).toBeGreaterThan(idxOverdue)
  expect(idxNoDue).toBeGreaterThan(idxMeeting)
})

// AC-7: "Gerado de" link — case item → member-reachable case route (NOT 404) for
//       a plain staff assignee; meeting item → meetings/{id}; and (below, AC-7b)
//       the case link degrades to plain text when case_access is OFF.
test('AC-7: case link → member case route; meeting link → meetings/{id}', async ({
  page,
}) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}/meus-itens-de-acao`)

  // Meeting link target.
  const meetingRow = page
    .getByRole('row')
    .filter({ hasText: T_MEETING_ACTIVE })
  const meetingLink = meetingRow.getByRole('link').first()
  await expect(meetingLink).toHaveAttribute(
    'href',
    new RegExp(`/o/${ORG_A}/c/${COMM_CCIH}/meetings/[0-9a-f-]+$`),
  )

  // Case link target — the MEMBER route casos/{id} (not manage/cases).
  const caseRow = page.getByRole('row').filter({ hasText: T_CASE_OVERDUE })
  const caseLink = caseRow.getByRole('link').first()
  await expect(caseLink).toHaveAttribute(
    'href',
    new RegExp(`/o/${ORG_A}/c/${COMM_CCIH}/casos/${SEEDED_CASE_ID}$`),
  )

  // Follow the case link — a plain staff assignee reaches it (NOT a 404).
  await caseLink.click()
  await page.waitForURL(
    `**/o/${ORG_A}/c/${COMM_CCIH}/casos/${SEEDED_CASE_ID}`,
  )
  // The member case page loads (heading present, no 404 chrome).
  await expect(page.locator('body')).not.toContainText(
    /404|não encontrad|page not found/i,
  )
  // The self-contained member case header renders the case number as the page
  // <h1> (CaseDetailView withHeader). Target the heading role (not bare text,
  // which also matches the breadcrumb/phase-card copy → strict-mode violation).
  await expect(
    page.getByRole('heading', { name: /Caso 0001/, level: 1 }),
  ).toBeVisible()
})

// AC-7b: case link degrades to plain (non-link) text when case_access is OFF.
test('AC-7b: case link degrades to plain text when case_access is OFF', async ({
  page,
  request,
}) => {
  await setFeatureFlag('case_access', false)
  try {
    await signInAs(page, 'staff1.ccih@test.local')
    await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}/meus-itens-de-acao`)

    // The case row still shows its number/label, but with NO link.
    const caseRow = page.getByRole('row').filter({ hasText: T_CASE_OVERDUE })
    await expect(caseRow).toBeVisible()
    await expect(caseRow).toContainText('Caso')
    await expect(caseRow.getByRole('link')).toHaveCount(0)

    // The meeting row's link is unaffected by case_access.
    const meetingRow = page
      .getByRole('row')
      .filter({ hasText: T_MEETING_ACTIVE })
    await expect(meetingRow.getByRole('link')).toHaveCount(1)
  } finally {
    await setFeatureFlag('case_access', true)
    // Best-effort: touch request so lint doesn't flag the unused fixture.
    void request
  }
})

// AC-8: read-only — no status-change controls on this page.
test('AC-8: page is read-only (no status-change controls)', async ({ page }) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}/meus-itens-de-acao`)

  const table = page.getByRole('table')
  await expect(table).toBeVisible()

  // No action buttons / status pickers inside the table rows. The only
  // interactive controls on the page are the source filter + resolved toggle
  // (both OUTSIDE the table) and the source links.
  await expect(table.getByRole('button')).toHaveCount(0)
  await expect(table.getByRole('combobox')).toHaveCount(0)
  // No "concluir" / "cancelar" / "iniciar" style controls anywhere.
  await expect(
    page.getByRole('button', { name: /concluir|cancelar item|iniciar|alterar status/i }),
  ).toHaveCount(0)
})

// AC-9: empty state for a persona with no assigned items.
test('AC-9: empty state renders for a persona with no assigned items', async ({
  page,
}) => {
  // staff4.ccih is the boundary persona — no attribution, no assigned items.
  await signInAs(page, 'staff4.ccih@test.local')
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}/meus-itens-de-acao`)

  await expect(
    page.getByRole('heading', { name: /você não tem itens de ação atribuídos/i }),
  ).toBeVisible()
  // No data table rendered.
  await expect(page.getByRole('table')).toHaveCount(0)
})

// ===========================================================================
// FEATURE 2 — "Visão Geral"
// ===========================================================================

// AC-10: root page shows the 5 cards for both roles; greeting remains; old
//        placeholder area tiles are gone.
test('AC-10: overview shows 5 cards + greeting for staff and staff_admin', async ({
  page,
}) => {
  const CARD_TITLES = [
    'Casos não concluídos',
    'Itens de ação pendentes',
    'Reuniões não concluídas',
    'Assinaturas pendentes',
    'Respostas em andamento',
  ]

  // staff
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}`)
  await expect(
    page.getByRole('heading', { name: /^Olá, /i, level: 1 }),
  ).toBeVisible()
  for (const t of CARD_TITLES) {
    await expect(page.getByRole('heading', { name: t, level: 2 })).toBeVisible()
  }
  await signOut(page)

  // staff_admin sees the same 5 cards + greeting.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}`)
  await expect(
    page.getByRole('heading', { name: /^Olá, /i, level: 1 }),
  ).toBeVisible()
  for (const t of CARD_TITLES) {
    await expect(page.getByRole('heading', { name: t, level: 2 })).toBeVisible()
  }
})

// AC-11: each card links to the right member destination.
test('AC-11: cards link to the correct member destinations', async ({ page }) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}`)

  const base = `/o/${ORG_A}/c/${COMM_CCIH}`
  const expected: [string, string][] = [
    // case_access ON → "Meus Casos" (meus-casos).
    ['Casos não concluídos', `${base}/meus-casos`],
    ['Itens de ação pendentes', `${base}/meus-itens-de-acao`],
    ['Reuniões não concluídas', `${base}/meetings`],
    ['Assinaturas pendentes', `${base}/meetings`],
    ['Respostas em andamento', `${base}/respostas`],
  ]

  for (const [title, href] of expected) {
    const card = page
      .getByRole('link')
      .filter({ has: page.getByRole('heading', { name: title, level: 2 }) })
    await expect(card).toHaveAttribute('href', href)
  }
})

// AC-12: cards reflect real data, verified against KNOWN fixtures. Asserted as
//        lower bounds + a fixture-specific overdue hint rather than exact
//        equality — other specs run earlier in the full suite can only ADD to the
//        shared `staff1.ccih` counts (extra cases/meetings/responses), never
//        remove this spec's fixtures, so exact equality is contamination-prone
//        but the guaranteed floor is stable. Every card is also asserted to
//        render a valid non-negative integer (calm rendering) for both an
//        item-holding persona and a near-empty boundary persona.
test('AC-12: cards reflect the known fixture data (contamination-safe bounds)', async ({
  page,
}) => {
  // Read the count rendered on a given card (first tabular number in the card).
  const cardValue = async (title: string): Promise<number> => {
    const card = page
      .getByRole('link')
      .filter({ has: page.getByRole('heading', { name: title, level: 2 }) })
    await expect(card).toBeVisible()
    const text = (await card.innerText()).trim()
    const m = text.match(/\d+/)
    return m ? Number(m[0]) : NaN
  }

  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}`)

  // Pending action items: this spec assigns staff1 FOUR active items (open case
  // [overdue], in_progress case, open meeting [future], open manual [future]) on
  // top of the seed's one meeting item — so the active count is at least 5.
  // done/cancelled are excluded (proven by the exact-active behaviour in AC-4),
  // so extra resolved items never inflate this. Lower bound is contamination-immune.
  const staff1Pending = await cardValue('Itens de ação pendentes')
  expect(staff1Pending).toBeGreaterThanOrEqual(5)

  // Respostas em andamento: the seeded Form-A draft guarantees at least 1.
  expect(await cardValue('Respostas em andamento')).toBeGreaterThanOrEqual(1)

  // Casos não concluídos: staff1 is phase-1 assignee of Caso 0001 (pendente) →
  // at least 1 attributed non-terminal case.
  expect(await cardValue('Casos não concluídos')).toBeGreaterThanOrEqual(1)

  // Reuniões não concluídas: seed's realizada meeting + this spec's future
  // agendada meeting, both attended + non-terminal → at least 2.
  expect(await cardValue('Reuniões não concluídas')).toBeGreaterThanOrEqual(2)

  // DATA-DRIVEN, not hardcoded: the overdue-hint on the action-items card is
  // driven by staff1's overdue items. This spec contributes exactly one overdue
  // active item (T_CASE_OVERDUE, due -3); assert the hint shows a positive count
  // (≥1) — a value that only appears because real overdue data exists.
  const actionCard = page
    .getByRole('link')
    .filter({
      has: page.getByRole('heading', {
        name: 'Itens de ação pendentes',
        level: 2,
      }),
    })
  const overdueMatch = (await actionCard.innerText()).match(/(\d+)\s+em atraso/i)
  expect(overdueMatch, 'overdue hint should render with a count').not.toBeNull()
  expect(Number(overdueMatch![1])).toBeGreaterThanOrEqual(1)

  // Every card renders a valid non-negative integer for staff1 (calm rendering,
  // no NaN / error state) — a per-card sanity check independent of contamination.
  for (const title of [
    'Casos não concluídos',
    'Itens de ação pendentes',
    'Reuniões não concluídas',
    'Assinaturas pendentes',
    'Respostas em andamento',
  ]) {
    const v = await cardValue(title)
    expect(Number.isInteger(v) && v >= 0, `${title} renders a count`).toBeTruthy()
  }

  // A persona whose fixtures don't apply still renders every card CALMLY as a
  // valid non-negative integer (no error, no NaN). staff4.ccih holds no items of
  // this spec's making; even if an unrelated spec touches it, the card must still
  // render a clean count — that's the invariant under test here (not an exact 0,
  // which shared state can perturb).
  await signOut(page)
  await signInAs(page, 'staff4.ccih@test.local')
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}`)
  for (const title of [
    'Itens de ação pendentes',
    'Casos não concluídos',
    'Respostas em andamento',
  ]) {
    const v = await cardValue(title)
    expect(Number.isInteger(v) && v >= 0, `${title} renders a count`).toBeTruthy()
  }
})

// AC-13: secondary hints — "n em atraso" on the action-items card; "próxima em
//        {date}" on the meetings card.
test('AC-13: secondary hints (overdue count + next-meeting date)', async ({
  page,
}) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}`)

  // This spec contributes one overdue active item (T_CASE_OVERDUE, due -3), so the
  // overdue hint renders with a positive count. Asserted as "{n} em atraso" with
  // n ≥ 1 (not exactly 1) so an earlier spec leaving another overdue item for
  // staff1 can't perturb it — the hint being present + positive is the point.
  const actionCard = page
    .getByRole('link')
    .filter({
      has: page.getByRole('heading', {
        name: 'Itens de ação pendentes',
        level: 2,
      }),
    })
  await expect(actionCard).toContainText(/\d+ em atraso/i)
  const overdueHint = (await actionCard.innerText()).match(/(\d+)\s+em atraso/i)
  expect(overdueHint).not.toBeNull()
  expect(Number(overdueHint![1])).toBeGreaterThanOrEqual(1)

  // staff1 attends a future agendada meeting → "próxima em {date}".
  const meetingCard = page
    .getByRole('link')
    .filter({
      has: page.getByRole('heading', {
        name: 'Reuniões não concluídas',
        level: 2,
      }),
    })
  await expect(meetingCard).toContainText(/próxima em \d{2}\/\d{2}\/\d{4}/i)
})

// AC-14: the coordinator Painel (/dashboard) is unaffected — smoke check it loads.
test('AC-14: coordinator Painel still loads for staff_admin', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}/dashboard`)
  await page.waitForURL(`**/o/${ORG_A}/c/${COMM_CCIH}/dashboard`)
  // The dashboard renders (no error boundary / 404).
  await expect(page.locator('body')).not.toContainText(
    /404|não encontrad|algo deu errado/i,
  )
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

// ===========================================================================
// CROSS-CUTTING
// ===========================================================================

// AC-15: keyboard-only flow — tab to the active-only toggle + source filter,
//        operate them via keyboard, and tab to a source link. Visible focus.
test('AC-15: keyboard-only — operate the toggle + source filter + reach a link', async ({
  page,
}) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}/meus-itens-de-acao`)
  await expect(page.getByRole('table')).toBeVisible()

  // Operate the SOURCE FILTER by keyboard: focus the "Caso" radio, activate it.
  const casoRadio = page.getByRole('radio', { name: 'Caso' })
  await casoRadio.focus()
  await expect(casoRadio).toBeFocused()
  await page.keyboard.press('Enter')
  // Case items remain, meeting + manual items filtered out.
  await expect(page.getByRole('cell', { name: T_CASE_OVERDUE })).toBeVisible()
  await expect(
    page.getByRole('cell', { name: T_MEETING_ACTIVE }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('cell', { name: T_MANUAL_ACTIVE }),
  ).toHaveCount(0)
  // Focus + activate the new "Avulso" (manual) radio by keyboard: only the
  // standalone manual item remains.
  const avulsoRadio = page.getByRole('radio', { name: 'Avulso' })
  await avulsoRadio.focus()
  await expect(avulsoRadio).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('cell', { name: T_MANUAL_ACTIVE })).toBeVisible()
  await expect(page.getByRole('cell', { name: T_CASE_OVERDUE })).toHaveCount(0)
  // Reset to Todos by keyboard.
  const todosRadio = page.getByRole('radio', { name: 'Todos' })
  await todosRadio.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('cell', { name: T_MEETING_ACTIVE })).toBeVisible()

  // Operate the RESOLVED TOGGLE by keyboard: focus the checkbox, toggle with Space.
  const toggle = page.getByRole('checkbox', {
    name: /mostrar concluídos e cancelados/i,
  })
  await toggle.focus()
  await expect(toggle).toBeFocused()
  await page.keyboard.press('Space')
  await expect(toggle).toBeChecked()
  // Resolved items now visible.
  await expect(page.getByRole('cell', { name: T_CASE_DONE })).toBeVisible()

  // Tab to a source link and confirm it receives focus (keyboard-reachable).
  const meetingLink = page
    .getByRole('row')
    .filter({ hasText: T_MEETING_ACTIVE })
    .getByRole('link')
    .first()
  await meetingLink.focus()
  await expect(meetingLink).toBeFocused()
})

// AC-16: pt-BR copy + no raw Supabase/Postgres errors surface.
test('AC-16: pt-BR copy throughout; no raw DB errors surface', async ({
  page,
}) => {
  await signInAs(page, 'staff1.ccih@test.local')

  // Action-items page.
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}/meus-itens-de-acao`)
  await expect(
    page.getByText(/as tarefas atribuídas a você/i),
  ).toBeVisible()
  const aiBody = await page.locator('body').innerText()
  expect(aiBody).not.toMatch(/PGRST|permission denied|violates|null value|SQLSTATE|relation .* does not exist/i)

  // Overview page.
  await page.goto(`/o/${ORG_A}/c/${COMM_CCIH}`)
  await expect(
    page.getByText(/este é o seu panorama da comissão/i),
  ).toBeVisible()
  const ovBody = await page.locator('body').innerText()
  expect(ovBody).not.toMatch(/PGRST|permission denied|violates|null value|SQLSTATE|relation .* does not exist/i)
})
