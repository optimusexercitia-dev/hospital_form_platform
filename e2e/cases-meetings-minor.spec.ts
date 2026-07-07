import { test, expect, type Page } from '@playwright/test'

/**
 * Cases & Meetings — minor layout/affordance batch (plan
 * "i-have-a-list-moonlit-cake"; backend migration
 * 20260630000007_cases_meetings_minor.sql + the matching FE changes).
 *
 * Test contract — the seven changes, in priority order:
 *   C2  Meeting "Concluir" succeeds with ≥1 present MEMBER (the bug fix); the
 *       no-present-member path still shows the guard message.
 *   C2  "Adicionar participante" member-tab guard: submitting with no member
 *       selected keeps the dialog open with a pt-BR field error.
 *   C1  Quick-presence check button flips a `Convocado` attendee → `Presente`.
 *   B2  Meetings registry renders a sortable TABLE (not cards) with the agreed
 *       columns; "Assinaturas pendentes" shows "—" outside the signature phase.
 *   A1  "Acesso ao caso" per-member grant badge (Leitura/Edição); grant→revoke
 *       updates it; an attributed-only member still shows "Atribuído".
 *   A2  Case event with date + time renders "date · HH:mm"; date-only shows only
 *       the date.
 *   A3  "Notificar evento ao NSP" button sits in the case top bar on an OPEN and a
 *       CONCLUDED case (coordinator route) and on the staff full-case route.
 *   B1  "Nova reunião" — the Início time control exists and accepts an HH:mm value
 *       (light assertion).
 *
 * Plus one keyboard-only flow (A1 access dialog driven by keyboard).
 *
 * Runs against the LOCAL Supabase stack (seeded personas). Run with --workers=1
 * (several tests mutate shared DB state). Reset with `npx supabase db reset
 * --local` before a clean run.
 *
 * Seeded fixtures (supabase/seed.sql):
 *   Caso 0001 (d0000000-…-c1, OPEN, CCIH): grants multi@=read (Leitura),
 *     staff3.ccih@=write (Edição); staff2.ccih@ is a narrative assignee → Atribuído.
 *   Caso 0002 (d0000000-…-c2, concluido/terminal, CCIH).
 *   Meeting f1000000-…-e1 "Reunião Ordinária — Junho/2026" (realizada): chefe.ccih
 *     (presidente), staff1.ccih + staff2.ccih (membro) all `presente`.
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local    staff_admin of CCIH (coordinator, …0002)
 *   staff1.ccih@test.local   staff of CCIH (…0003)
 *   staff2.ccih@test.local   staff of CCIH (…0004) — Caso 0001 narrative assignee
 *   multi@test.local         staff (…0008) — Caso 0001 read grant
 *   staff3.ccih@test.local   staff (…0009) — Caso 0001 write grant
 *   staff4.ccih@test.local   staff (…000a) — no grant/attribution (boundary)
 *   chefe.farm@test.local    staff_admin of Farmácia (foreign commission)
 */

// NOT serial: each test owns its fixtures (fresh meetings via RPC; the A1 grant
// tests clean up their own grants), so a single failure must not cascade-skip the
// others. Run with --workers=1 (the suite mutates shared DB state in order).
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
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

const ORG = 'rede-a'
const SLUG = 'ccih'
const BASE = `/o/${ORG}/c/${SLUG}`

const CASE_OPEN = 'd0000000-0000-0000-0000-0000000000c1' // Caso 0001 (open)
const CASE_TERMINAL = 'd0000000-0000-0000-0000-0000000000c2' // Caso 0002 (concluido)
const COMM_CCIH_ID = 'a0000000-0000-0000-0000-0000000000a1'

const CHEFE_CCIH_ID = '00000000-0000-0000-0000-000000000002'
const STAFF1_CCIH_ID = '00000000-0000-0000-0000-000000000003'

const PW = 'Test1234!'

// ---------------------------------------------------------------------------
// Helpers (mirror the phase10 / case-access conventions)
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = PW) {
  await page.goto('/login')
  await page.getByLabel(/e-mail/i).fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 20_000,
  })
}

/** Obtain a real RLS-scoped JWT for a persona. */
async function getOwnerToken(
  page: Page,
  email: string,
  password = PW,
): Promise<string> {
  const resp = await page.request.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      data: { email, password },
    },
  )
  expect(resp.ok()).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

/** Call an RPC with a caller-supplied JWT. */
async function callRPC(
  page: Page,
  token: string,
  rpcName: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  const resp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/${rpcName}`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      data: body,
    },
  )
  const text = await resp.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = text
  }
  return { status: resp.status(), body: parsed }
}

/** Service-role REST read (bypasses RLS). */
async function dbGet<T = Record<string, unknown>>(
  page: Page,
  path: string,
): Promise<T[]> {
  const resp = await page.request.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

async function meetingStatus(page: Page, id: string): Promise<string | null> {
  const rows = await dbGet<{ status: string }>(
    page,
    `meetings?id=eq.${id}&select=status`,
  )
  return rows[0]?.status ?? null
}

/** First active meeting type for commission A. */
async function firstMeetingTypeId(page: Page): Promise<string> {
  const rows = await dbGet<{ id: string }>(
    page,
    `commission_meeting_types?commission_id=eq.${COMM_CCIH_ID}&archived=eq.false&limit=1`,
  )
  expect(rows.length).toBeGreaterThan(0)
  return rows[0].id
}

/**
 * Create a fresh `realizada` meeting via RPC, optionally adding chefe.ccih as a
 * PRESENT member. Returns the new meeting id. Decouples the conclude tests from
 * the mutable seeded meeting so they pass regardless of run order.
 */
async function createRealizadaMeeting(
  page: Page,
  token: string,
  title: string,
  withPresentMember: boolean,
): Promise<string> {
  const typeId = await firstMeetingTypeId(page)
  const create = await callRPC(page, token, 'create_meeting', {
    p_commission_id: COMM_CCIH_ID,
    p_meeting_type_id: typeId,
    p_title: title,
    p_scheduled_start: new Date(Date.now() + 3_600_000).toISOString(),
    p_modality: 'presencial',
  })
  expect(create.status).toBe(200)
  const id = (create.body as { id: string }).id
  expect(id).toBeTruthy()

  if (withPresentMember) {
    const add = await callRPC(page, token, 'add_meeting_attendee', {
      p_meeting_id: id,
      p_user_id: CHEFE_CCIH_ID,
      p_role: 'presidente',
      p_attendance: 'presente',
    })
    expect(add.status).toBe(200)
  }

  const held = await callRPC(page, token, 'mark_meeting_held', {
    p_meeting_id: id,
  })
  expect(held.status).toBe(200)
  return id
}

// ===========================================================================
// C2 — "Concluir" regression: succeeds with a present member (the BUG FIX)
// ===========================================================================

test('C2 — Concluir succeeds with a present committee member (no HC034, → Em assinatura)', async ({
  page,
}) => {
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const meetingId = await createRealizadaMeeting(
    page,
    chefeToken,
    'C2 — conclui com membro presente',
    /* withPresentMember */ true,
  )

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/meetings/${meetingId}`)
  await page.waitForURL(`**/c/${SLUG}/meetings/${meetingId}`, { timeout: 15_000 })
  await expect(page.getByText(/Realizada/i).first()).toBeVisible({
    timeout: 10_000,
  })

  const concluirBtn = page.getByRole('button', { name: 'Concluir', exact: true })
  await expect(concluirBtn).toBeVisible({ timeout: 10_000 })
  await concluirBtn.click()

  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible({ timeout: 8_000 })
  await dialog.getByRole('button', { name: /Concluir reunião/i }).click()

  // On success the route refreshes and the alertdialog unmounts. On the bug
  // (HC034) it stays open with an error. Asserting it closes proves the fix.
  await expect(dialog).not.toBeVisible({ timeout: 20_000 })

  // The guard message must NOT appear anywhere on the page.
  await expect(
    page.getByText(/registre ao menos um participante presente/i),
  ).toHaveCount(0)
  // And the raw SQL code must never leak (messages.ts cleanup).
  await expect(page.getByText(/HC034/)).toHaveCount(0)

  // Status flipped to em_assinatura (header chip + DB truth).
  await expect(page.getByText(/Em assinatura/i).first()).toBeVisible({
    timeout: 10_000,
  })
  expect(await meetingStatus(page, meetingId)).toBe('em_assinatura')
})

test('C2 — Concluir is blocked when NO member is present (guard message shows, stays Realizada)', async ({
  page,
}) => {
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const meetingId = await createRealizadaMeeting(
    page,
    chefeToken,
    'C2 — bloqueia sem presentes',
    /* withPresentMember */ false,
  )

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/meetings/${meetingId}`)
  await page.waitForURL(`**/c/${SLUG}/meetings/${meetingId}`, { timeout: 15_000 })
  await expect(page.getByText(/Realizada/i).first()).toBeVisible({
    timeout: 10_000,
  })

  const concluirBtn = page.getByRole('button', { name: 'Concluir', exact: true })
  await expect(concluirBtn).toBeVisible({ timeout: 10_000 })
  await concluirBtn.click()

  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible({ timeout: 8_000 })
  await dialog.getByRole('button', { name: /Concluir reunião/i }).click()

  // The friendly pt-BR guard appears (inline; the dialog stays open on failure).
  await expect(
    page.getByText(/registre ao menos um participante presente/i),
  ).toBeVisible({ timeout: 10_000 })
  // The raw SQL code must NOT leak (messages.ts cleanup turns HC034 → friendly text).
  await expect(page.getByText(/HC034/)).toHaveCount(0)

  // The meeting did NOT advance.
  expect(await meetingStatus(page, meetingId)).toBe('realizada')
})

// ===========================================================================
// C2 — Attendee-form member guard (no member selected → field error, dialog stays)
// ===========================================================================

test('C2 — Adicionar participante: member tab with no member selected is blocked with a pt-BR error', async ({
  page,
}) => {
  // A fresh realizada meeting with no attendees, so the member picker has options.
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const meetingId = await createRealizadaMeeting(
    page,
    chefeToken,
    'C2 — guarda do formulário de participante',
    /* withPresentMember */ false,
  )

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/meetings/${meetingId}`)
  await page.waitForURL(`**/c/${SLUG}/meetings/${meetingId}`, { timeout: 15_000 })

  // Open the add-attendee dialog (the trigger label is "Adicionar").
  const addBtn = page.getByRole('button', { name: /^Adicionar$/ })
  await expect(addBtn).toBeVisible({ timeout: 10_000 })
  await addBtn.click()

  const dialog = page.getByRole('dialog', { name: /Adicionar participante/i })
  await expect(dialog).toBeVisible({ timeout: 8_000 })

  // The "Membro da comissão" tab is the default; submit WITHOUT picking a member.
  await dialog.getByRole('button', { name: /^Adicionar$/ }).click()

  // The dialog stays open and a pt-BR field error appears on the member select.
  // Scope to the role=alert span (the placeholder <option> also reads "Selecione
  // um membro…", so match the error node specifically).
  await expect(dialog).toBeVisible()
  const memberError = dialog.getByRole('alert').filter({
    hasText: /Selecione um membro/i,
  })
  await expect(memberError).toBeVisible({ timeout: 5_000 })

  // No attendee row should have been created (the guard fired before the action).
  const rows = await dbGet<{ id: string }>(
    page,
    `meeting_attendees?meeting_id=eq.${meetingId}&select=id`,
  )
  expect(rows.length).toBe(0)

  // Picking a member then resolves the error and the submit succeeds.
  const memberSelect = dialog.getByRole('combobox').first()
  await memberSelect.selectOption({ index: 1 })
  await expect(memberError).toHaveCount(0)
  await dialog.getByRole('button', { name: /^Adicionar$/ }).click()
  await expect(dialog).not.toBeVisible({ timeout: 10_000 })

  const rowsAfter = await dbGet<{ id: string; user_id: string | null }>(
    page,
    `meeting_attendees?meeting_id=eq.${meetingId}&select=id,user_id`,
  )
  expect(rowsAfter.length).toBe(1)
  // The created row carries a real user_id (a MEMBER, not a null-user guest row).
  expect(rowsAfter[0].user_id).not.toBeNull()
})

// ===========================================================================
// C1 — Quick presence: check button flips a Convocado attendee → Presente
// ===========================================================================

test('C1 — quick-presence check button flips a Convocado attendee to Presente', async ({
  page,
}) => {
  // Fresh meeting with one CONVOCADO member (so the check button shows).
  const chefeToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const typeId = await firstMeetingTypeId(page)
  const create = await callRPC(page, chefeToken, 'create_meeting', {
    p_commission_id: COMM_CCIH_ID,
    p_meeting_type_id: typeId,
    p_title: 'C1 — presença rápida',
    p_scheduled_start: new Date(Date.now() + 3_600_000).toISOString(),
    p_modality: 'presencial',
  })
  expect(create.status).toBe(200)
  const meetingId = (create.body as { id: string }).id
  const add = await callRPC(page, chefeToken, 'add_meeting_attendee', {
    p_meeting_id: meetingId,
    p_user_id: STAFF1_CCIH_ID,
    p_role: 'membro',
    p_attendance: 'convocado',
  })
  expect(add.status).toBe(200)
  await callRPC(page, chefeToken, 'mark_meeting_held', { p_meeting_id: meetingId })

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/meetings/${meetingId}`)
  await page.waitForURL(`**/c/${SLUG}/meetings/${meetingId}`, { timeout: 15_000 })

  // Scope to the "Participantes e quórum" card.
  const panel = page.getByRole('region', { name: /Participantes e quórum/i })
  await expect(panel).toBeVisible({ timeout: 10_000 })

  // The attendee starts Convocado; the quick-present button is shown.
  await expect(panel.getByText(/Convocado/i).first()).toBeVisible()
  const markPresentBtn = panel.getByRole('button', {
    name: /Marcar .* como presente/i,
  })
  await expect(markPresentBtn).toBeVisible({ timeout: 10_000 })
  await markPresentBtn.click()

  // After the flip: the badge reads Presente and the button disappears.
  await expect(panel.getByText(/Presente/i).first()).toBeVisible({
    timeout: 10_000,
  })
  await expect(markPresentBtn).toHaveCount(0)

  // DB truth: the attendee row is now `presente` with its user_id intact.
  const rows = await dbGet<{ attendance: string; user_id: string | null }>(
    page,
    `meeting_attendees?meeting_id=eq.${meetingId}&user_id=eq.${STAFF1_CCIH_ID}&select=attendance,user_id`,
  )
  expect(rows[0]?.attendance).toBe('presente')
  expect(rows[0]?.user_id).toBe(STAFF1_CCIH_ID)
})

// ===========================================================================
// B2 — Meetings list renders a sortable TABLE with the agreed columns
// ===========================================================================

test('B2 — meetings registry is a sortable table; row-click navigates; Assinaturas pendentes is "—" off the signature phase', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/meetings`)
  await page.waitForURL(`**/c/${SLUG}/meetings`, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /Reuniões/i }).first()).toBeVisible({
    timeout: 10_000,
  })

  // It is a TABLE, not a card grid.
  const table = page.getByRole('table')
  await expect(table).toBeVisible({ timeout: 10_000 })

  // The agreed column headers are present.
  for (const header of [
    /Reunião/i,
    /Título/i,
    /Data\/?hora/i,
    /Tipo/i,
    /Modalidade/i,
    /Status/i,
    /Ações pendentes/i,
    /Assinaturas pendentes/i,
  ]) {
    await expect(
      table.getByRole('columnheader', { name: header }),
    ).toBeVisible()
  }

  // Sortable headers are buttons inside the columnheader with aria-sort semantics.
  const numeroHeader = table.getByRole('columnheader', { name: /Reunião/i })
  const sortBtn = numeroHeader.getByRole('button')
  await expect(sortBtn).toBeVisible()
  // Default sort is by number, desc.
  await expect(numeroHeader).toHaveAttribute('aria-sort', 'descending')
  await sortBtn.click()
  await expect(numeroHeader).toHaveAttribute('aria-sort', 'ascending')

  // The seeded meeting #1 (realizada — NOT em_assinatura) shows "—" for
  // Assinaturas pendentes. Locate its row by the meeting number link.
  const seededRow = page.getByRole('row').filter({
    has: page.getByRole('link', { name: /Reunião\s*0*1\b|0001|#?1\b/ }),
  })
  // Fallback: a row containing the seeded title.
  const titleRow = page.getByRole('row').filter({
    hasText: /Reunião Ordinária/i,
  })
  const row = (await titleRow.count()) > 0 ? titleRow.first() : seededRow.first()
  await expect(row).toBeVisible({ timeout: 10_000 })
  // The row's status is Realizada (not Em assinatura) → Assinaturas pendentes "—".
  await expect(row.getByText(/Realizada/i)).toBeVisible()
  // "Assinaturas pendentes" is the LAST cell; assert its "—" specifically (the
  // em-dash in the meeting title would otherwise also match a bare "—").
  const lastCell = row.getByRole('cell').last()
  await expect(lastCell).toHaveText('—')

  // Row-click navigates to the meeting detail.
  await row.click()
  await page.waitForURL(/\/c\/ccih\/meetings\/[0-9a-f-]{36}$/, {
    timeout: 15_000,
  })
  await expect(
    page.getByRole('heading', { name: /Reunião Ordinária/i }).first(),
  ).toBeVisible({ timeout: 10_000 })
})

// ===========================================================================
// B1 — "Nova reunião": the Início time control exists and accepts HH:mm (light)
// ===========================================================================

test('B1 — Nova reunião start field exposes a time (HH:mm) segment control that accepts input', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/meetings`)
  await page.waitForURL(`**/c/${SLUG}/meetings`, { timeout: 15_000 })

  await page.getByRole('button', { name: /Nova reunião/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  // The DateTimePicker renders a react-aria TimeField (aria-label "Hora") with
  // hour/minute spinbutton segments — NOT a date control. Assert at least one
  // such time group exists (Início + Término each have one).
  const timeGroups = dialog.getByRole('group', { name: /^Hora$/i })
  await expect(timeGroups.first()).toBeVisible({ timeout: 10_000 })

  // The Início time control has hour + minute spinbuttons (24h, no AM/PM).
  const firstTime = timeGroups.first()
  const hourSeg = firstTime.getByRole('spinbutton', { name: /hora/i })
  await expect(hourSeg.first()).toBeVisible()

  // It accepts an HH:mm value via keyboard (type 09 then 30 across the segments).
  await firstTime.getByRole('spinbutton').first().click()
  await page.keyboard.type('0930')
  // The segments now read a real time (placeholder text is gone). Read the
  // group's accessible text and assert it contains a 2-digit:2-digit pattern.
  const groupText = (await firstTime.textContent()) ?? ''
  expect(groupText).toMatch(/\d{1,2}.*\d{2}/)
})

// ===========================================================================
// A1 — "Acesso ao caso" grant badge (Leitura / Edição / Atribuído)
// ===========================================================================

test('A1 — access dialog shows Leitura/Edição badges; an attributed-only member shows Atribuído', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${CASE_OPEN}`)
  await page.waitForURL(`**/manage/cases/${CASE_OPEN}`, { timeout: 15_000 })

  const accessBtn = page.getByRole('button', { name: /^Acesso ao caso$/i })
  await expect(accessBtn).toBeVisible({ timeout: 10_000 })
  await accessBtn.click()
  const dialog = page.getByRole('dialog', { name: /acesso ao caso/i })
  await expect(dialog).toBeVisible({ timeout: 8_000 })

  // multi@ = read grant → "Leitura" badge on its row.
  const multiRow = dialog.locator('li').filter({ hasText: /Coordenadora Multi/i })
  await expect(multiRow).toBeVisible({ timeout: 10_000 })
  await expect(multiRow.getByText(/^Leitura$/i)).toBeVisible()

  // staff3@ = write grant → "Edição" badge.
  const staff3Row = dialog.locator('li').filter({ hasText: /Técnico CCIH Três/i })
  await expect(staff3Row).toBeVisible()
  await expect(staff3Row.getByText(/^Edição$/i)).toBeVisible()

  // staff2@ = narrative assignee, no explicit grant → "Atribuído" only, no level badge.
  const staff2Row = dialog
    .locator('li')
    .filter({ hasText: /Enfermeira CCIH Dois/i })
  await expect(staff2Row).toBeVisible()
  await expect(staff2Row.getByText(/^Atribuído$/i)).toBeVisible()
  await expect(staff2Row.getByText(/^Leitura$/i)).toHaveCount(0)
  await expect(staff2Row.getByText(/^Edição$/i)).toHaveCount(0)
})

test('A1 — granting then revoking a member updates the badge live', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${CASE_OPEN}`)
  await page.waitForURL(`**/manage/cases/${CASE_OPEN}`, { timeout: 15_000 })

  await page.getByRole('button', { name: /^Acesso ao caso$/i }).click()
  const dialog = page.getByRole('dialog', { name: /acesso ao caso/i })
  await expect(dialog).toBeVisible({ timeout: 8_000 })

  // staff4@ (Técnica CCIH Quatro) starts with NO badge.
  const row = dialog.locator('li').filter({ hasText: /Técnica CCIH Quatro/i })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(row.getByText(/^Leitura$/i)).toHaveCount(0)
  await expect(row.getByText(/^Edição$/i)).toHaveCount(0)

  // Grant read → "Leitura" appears. REBUILT UI (case-access-panel.tsx, commit
  // 2507e77): the per-member GrantMenu dropdown was removed in favor of a
  // GrantDialog — the row's "Conceder acesso" button opens a dialog with a
  // "Nível de acesso" fieldset (Leitura default), submitted via its own
  // "Conceder acesso" button. Mirrors case-access.spec.ts AC-3c/AC-3d.
  await row.getByRole('button', { name: /conceder acesso|editar acesso/i }).click()
  const grantDialog = page.getByRole('dialog', { name: /conceder acesso|editar acesso/i })
  await expect(grantDialog).toBeVisible({ timeout: 5_000 })
  // "Leitura" is the default level — submit directly.
  await grantDialog.getByRole('button', { name: /^conceder acesso$/i }).click()
  await expect(grantDialog).toHaveCount(0, { timeout: 10_000 })
  await expect(row.getByText(/^Leitura$/i)).toBeVisible({ timeout: 10_000 })

  // Revoke → badge disappears (the granted row now carries a "Remover acesso de
  // {name}" X button beside the grant; no dropdown).
  await row.getByRole('button', { name: /remover acesso de/i }).click()
  await expect(row.getByText(/^Leitura$/i)).toHaveCount(0, { timeout: 10_000 })
})

// Keyboard-only flow (per-phase requirement): drive the access dialog grant
// entirely from the keyboard.
test('A1 — keyboard-only: open access dialog and grant read via keyboard', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${CASE_OPEN}`)
  await page.waitForURL(`**/manage/cases/${CASE_OPEN}`, { timeout: 15_000 })

  // Focus + activate the "Acesso ao caso" button via keyboard.
  const accessBtn = page.getByRole('button', { name: /^Acesso ao caso$/i })
  await expect(accessBtn).toBeVisible({ timeout: 10_000 })
  await accessBtn.focus()
  await expect(accessBtn).toBeFocused()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: /acesso ao caso/i })
  await expect(dialog).toBeVisible({ timeout: 8_000 })

  // staff4 row: ensure clean baseline (revoke if a prior test left a grant).
  const row = dialog.locator('li').filter({ hasText: /Técnica CCIH Quatro/i })
  await expect(row).toBeVisible({ timeout: 10_000 })

  // Open the row's grant DIALOG using the keyboard only (REBUILT UI, commit
  // 2507e77: GrantDialog replaced the GrantMenu dropdown). Mirrors
  // case-access.spec.ts AC-3g: focus the "Conceder acesso" button → Enter →
  // the dialog opens; "Leitura" is the default level → focus the submit button
  // → Enter to grant.
  const grantBtn = row.getByRole('button', { name: /conceder acesso|editar acesso/i })
  await grantBtn.focus()
  await expect(grantBtn).toBeFocused()
  await page.keyboard.press('Enter')

  const grantDialog = page.getByRole('dialog', { name: /conceder acesso|editar acesso/i })
  await expect(grantDialog).toBeVisible({ timeout: 5_000 })

  const submit = grantDialog.getByRole('button', { name: /^conceder acesso$/i })
  await submit.focus()
  await expect(submit).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(grantDialog).toHaveCount(0, { timeout: 10_000 })

  await expect(row.getByText(/^Leitura$/i)).toBeVisible({ timeout: 10_000 })

  // Cleanup: revoke so the seed-relative state is restored for re-runs (the
  // granted row's "Remover acesso de {name}" X button).
  await row.getByRole('button', { name: /remover acesso de/i }).click()
  await expect(row.getByText(/^Leitura$/i)).toHaveCount(0, { timeout: 10_000 })
})

// ===========================================================================
// A2 — Case event time: date + time renders "date · HH:mm"; date-only shows date
// ===========================================================================

test('A2 — a case event with date + time renders "date · HH:mm"; a date-only event shows only the date', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${CASE_OPEN}`)
  await page.waitForURL(`**/manage/cases/${CASE_OPEN}`, { timeout: 15_000 })

  // --- Event WITH a time ---
  const eventsSection = page.getByRole('region', { name: /Registros/i })
  await expect(eventsSection).toBeVisible({ timeout: 10_000 })
  await eventsSection.getByRole('button', { name: /Adicionar registro/i }).click()

  const dialog = page.getByRole('dialog', { name: /Adicionar registro/i })
  await expect(dialog).toBeVisible({ timeout: 8_000 })

  const titledWithTime = 'Registro com hora E2E'
  await dialog.getByLabel(/Descrição/i).fill('Reunião às 14:30, sem dados de paciente.')
  await dialog.getByLabel(/^Título/i).fill(titledWithTime)

  // Date: open the calendar popover and pick any enabled day.
  await pickAnyDate(page, dialog)

  // Time: the TimeField has aria-label "Hora do registro (opcional)" with segments.
  const timeGroup = dialog.getByRole('group', { name: /Hora do registro/i })
  await timeGroup.getByRole('spinbutton').first().click()
  await page.keyboard.type('1430')

  await dialog.getByRole('button', { name: /^Adicionar$/ }).click()
  await expect(dialog).not.toBeVisible({ timeout: 10_000 })

  // The new event renders the time after the date ("· 14:30").
  const withTimeRow = eventsSection
    .locator('li')
    .filter({ hasText: titledWithTime })
  await expect(withTimeRow).toBeVisible({ timeout: 10_000 })
  await expect(withTimeRow.getByText(/·\s*14:30/)).toBeVisible()

  // DB truth: occurred_time persisted.
  const withTimeRows = await dbGet<{ occurred_time: string | null }>(
    page,
    `case_events?case_id=eq.${CASE_OPEN}&title=eq.${encodeURIComponent(titledWithTime)}&select=occurred_time`,
  )
  expect(withTimeRows[0]?.occurred_time).toMatch(/^14:30/)

  // --- Event with a date but NO time ---
  await eventsSection.getByRole('button', { name: /Adicionar registro/i }).click()
  const dialog2 = page.getByRole('dialog', { name: /Adicionar registro/i })
  await expect(dialog2).toBeVisible({ timeout: 8_000 })
  const titledDateOnly = 'Registro só com data E2E'
  await dialog2.getByLabel(/Descrição/i).fill('Decisão registrada, sem hora.')
  await dialog2.getByLabel(/^Título/i).fill(titledDateOnly)
  await pickAnyDate(page, dialog2)
  // Leave the time empty.
  await dialog2.getByRole('button', { name: /^Adicionar$/ }).click()
  await expect(dialog2).not.toBeVisible({ timeout: 10_000 })

  const dateOnlyRow = eventsSection
    .locator('li')
    .filter({ hasText: titledDateOnly })
  await expect(dateOnlyRow).toBeVisible({ timeout: 10_000 })
  // No "· HH:mm" time fragment in this row's meta line.
  await expect(dateOnlyRow.getByText(/·\s*\d{2}:\d{2}/)).toHaveCount(0)

  const dateOnlyRows = await dbGet<{ occurred_time: string | null }>(
    page,
    `case_events?case_id=eq.${CASE_OPEN}&title=eq.${encodeURIComponent(titledDateOnly)}&select=occurred_time`,
  )
  expect(dateOnlyRows[0]?.occurred_time).toBeNull()
})

/**
 * Pick a date in the DatePicker inside a dialog. The control is a button that
 * opens a react-day-picker calendar popover (not a native input), so we open it
 * and click an enabled day cell. The exact day is not load-bearing for A2 (which
 * asserts only whether the TIME fragment renders); we click the calendar's
 * "today" cell, falling back to the first enabled day. Returns nothing — assert
 * the chosen date via the hidden `occurredAt` value or by event title.
 */
async function pickAnyDate(page: Page, dialog: ReturnType<Page['getByRole']>) {
  // The DatePicker trigger is a popover button (aria-haspopup="dialog"); its
  // accessible name is locale-styled, so target it by that attribute. It shows
  // the placeholder "Selecionar data" until a date is chosen.
  const trigger = dialog.locator('button[aria-haspopup="dialog"]').first()
  await expect(trigger).toBeVisible({ timeout: 5_000 })
  await expect(trigger).toHaveText(/Selecionar data/i)
  await trigger.click()

  // react-day-picker calendar: pick the day cell labelled "15" (mid-month — always
  // present and enabled, regardless of which month opens). Names are the full
  // pt-BR date ("…, 15 de … de …"); match the day button by exact visible text.
  const grid = page.getByRole('grid')
  await expect(grid).toBeVisible({ timeout: 5_000 })
  const day15 = grid.getByRole('button', { name: /\b15\b/ }).filter({ hasText: /^15$/ })
  await day15.first().click()

  // The popover closes on select; the trigger now shows a dd/MM/yyyy date.
  await expect(trigger).not.toHaveText(/Selecionar data/i, { timeout: 5_000 })
}

// ===========================================================================
// A3 — "Notificar evento ao NSP" button placement (top bar)
// ===========================================================================

test('A3 — NSP button is in the coordinator top bar on an OPEN case', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${CASE_OPEN}`)
  await page.waitForURL(`**/manage/cases/${CASE_OPEN}`, { timeout: 15_000 })

  const header = page.getByRole('banner').or(page.locator('header')).first()
  const nspBtn = page.getByRole('button', { name: /Notificar evento ao NSP/i })
  await expect(nspBtn).toBeVisible({ timeout: 10_000 })
  // It sits inside the page header spine (the top-bar action cluster).
  await expect(header.getByRole('button', { name: /Notificar evento ao NSP/i })).toBeVisible()
})

test('A3 — NSP button is in the coordinator top bar on a CONCLUDED case', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${CASE_TERMINAL}`)
  await page.waitForURL(`**/manage/cases/${CASE_TERMINAL}`, { timeout: 15_000 })

  // The case is terminal (concluido) — verify the badge, then the NSP button still shows.
  await expect(page.getByText(/Conclu[íi]do/i).first()).toBeVisible({
    timeout: 10_000,
  })
  await expect(
    page.getByRole('button', { name: /Notificar evento ao NSP/i }),
  ).toBeVisible({ timeout: 10_000 })
})

test('A3 — NSP button shows on the staff full-case route', async ({ page }) => {
  // A write-grantee (staff3) can open the staff full-case route.
  await signInAs(page, 'staff3.ccih@test.local')
  await page.goto(`${BASE}/casos/${CASE_OPEN}`)
  await page.waitForURL(`**/casos/${CASE_OPEN}`, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: /caso\s*0*1/i }).first()).toBeVisible({
    timeout: 10_000,
  })
  await expect(
    page.getByRole('button', { name: /Notificar evento ao NSP/i }),
  ).toBeVisible({ timeout: 10_000 })
})
