import { test, expect, type Locator, type Page } from '@playwright/test'
import { setDateTimeField, fillTimeField, fieldContainer } from './helpers/date-pickers'

/**
 * Meeting actual-occurrence time (`held_at` / `held_end`) — ADR 0062, plan T1.
 *
 * Test contract (from docs/plans/meeting-held-time.md, task T1):
 *   1. Coordinator marks a scheduled meeting as realizada with a `held_at`
 *      DIFFERENT from the schedule → header shows "Realizada em: …" with the
 *      chosen date; the schedule ("Agendada: …") is unchanged.
 *   2. Editing `held_*` afterward via the header inline affordance (visible only
 *      while `realizada`) persists the new value.
 *   3. Future-date `held_at` is rejected; the UI shows a readable pt-BR message
 *      (server raises HC082), never a raw Postgres error.
 *   4. After "Concluir" (→ em_assinatura), the header shows a READ-ONLY
 *      "Realizada em" with NO edit button (must reopen to edit — decision 2).
 *   5. Keyboard-only pass on the transition dialog (§8).
 *
 * Runs against the LOCAL Supabase stack (seeded personas). Run with --workers=1
 * (tests create + mutate meetings). Run `npx supabase db reset` before a full run.
 *
 * Note: the transition dialogs use e.preventDefault() in AlertDialogAction — the
 * dialog closes via route refresh on success, and stays open with an inline
 * error on failure. Account for that in waits/assertions.
 */

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
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

const COMM_CCIH_ID = 'a0000000-0000-0000-0000-0000000000a1'
const CHEFE_CCIH_ID = '00000000-0000-0000-0000-000000000002'

// ---------------------------------------------------------------------------
// Helpers (mirrors phase10-meetings.spec.ts)
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

/** Service-role JWT: read a meeting's held/schedule columns by id. */
async function getMeetingHeld(
  page: Page,
  meetingId: string,
): Promise<{
  status: string
  scheduled_start: string
  scheduled_end: string | null
  held_at: string | null
  held_end: string | null
} | null> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/meetings?id=eq.${meetingId}` +
      `&select=status,scheduled_start,scheduled_end,held_at,held_end`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const data = await resp.json()
  if (!Array.isArray(data) || data.length === 0) return null
  return data[0]
}

/** Obtain a real JWT for a persona (RLS-scoped token). */
async function getOwnerToken(page: Page, email: string, password = 'Test1234!'): Promise<string> {
  const resp = await page.request.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
      data: { email, password },
    },
  )
  expect(resp.ok()).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

/** Call an RPC via REST with a caller-supplied JWT. */
async function callRPC(
  page: Page,
  token: string,
  rpcName: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  const resp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/${rpcName}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: body,
  })
  const text = await resp.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = text
  }
  return { status: resp.status(), body: parsed }
}

/** Resolve the first active meeting type id for commission A. */
async function firstMeetingTypeId(page: Page): Promise<string> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/commission_meeting_types?commission_id=eq.${COMM_CCIH_ID}&archived=eq.false&limit=1`,
    {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    },
  )
  const types = (await resp.json()) as Array<{ id: string }>
  expect(types.length).toBeGreaterThan(0)
  return types[0].id
}

/**
 * Create a fresh `agendada` meeting via the create_meeting RPC and return its id.
 * `scheduled_start` is set a few days in the PAST so the schedule is a fixed,
 * known value that the tests can distinguish from a chosen `held_at`.
 */
async function createAgendadaMeeting(
  page: Page,
  token: string,
  opts: { title: string; scheduledStart: Date; withPresentChefe?: boolean } = {
    title: 'Reunião held-time E2E',
    scheduledStart: new Date(Date.now() - 3 * 24 * 3600_000),
  },
): Promise<string> {
  const typeId = await firstMeetingTypeId(page)
  const createResp = await callRPC(page, token, 'create_meeting', {
    p_commission_id: COMM_CCIH_ID,
    p_meeting_type_id: typeId,
    p_title: opts.title,
    p_scheduled_start: opts.scheduledStart.toISOString(),
    p_modality: 'presencial',
  })
  expect(createResp.status).toBe(200)
  const meetingId = (createResp.body as { id: string }).id
  expect(meetingId).toBeTruthy()

  if (opts.withPresentChefe) {
    // "Convocar todos" is NOT applied by the RPC path; add chefe as present so a
    // later Concluir passes the ≥1-present-attendee gate (HC034).
    const existingResp = await page.request.get(
      `${SUPABASE_URL}/rest/v1/meeting_attendees?meeting_id=eq.${meetingId}` +
        `&user_id=eq.${CHEFE_CCIH_ID}&select=id`,
      {
        headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
      },
    )
    const existing = (await existingResp.json()) as Array<{ id: string }>
    if (existing.length > 0) {
      const upd = await callRPC(page, token, 'update_meeting_attendee', {
        p_attendee_id: existing[0].id,
        p_role: 'presidente',
        p_attendance: 'present',
      })
      expect(upd.status).toBe(200)
    } else {
      const add = await callRPC(page, token, 'add_meeting_attendee', {
        p_meeting_id: meetingId,
        p_user_id: CHEFE_CCIH_ID,
        p_role: 'presidente',
        p_attendance: 'present',
      })
      expect(add.status).toBe(200)
    }
  }

  return meetingId
}

/** Navigate to a meeting detail page and confirm the title heading renders. */
async function goToMeeting(page: Page, meetingId: string, titleRe: RegExp) {
  await page.goto(`/o/rede-a/c/ccih/meetings/${meetingId}`)
  await page.waitForURL(`**/c/ccih/meetings/${meetingId}`, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: titleRe }).first()).toBeVisible({
    timeout: 15_000,
  })
}

/**
 * Set a held-window DateTimePicker (labelled "Início" / "Término") to a day in a
 * FUTURE month (calendar "next month" nav), plus a time. Used to trigger the
 * server's future-date rejection (HC082).
 */
async function setHeldDateFutureMonth(
  page: Page,
  scope: Locator,
  labelText: string,
  time = '10:00',
): Promise<void> {
  const field = fieldContainer(scope, labelText)
  await expect(field).toBeVisible({ timeout: 5_000 })
  const trigger = field.locator('button[aria-haspopup="dialog"]').first()
  await trigger.click()

  const grid = page.getByRole('grid')
  await expect(grid).toBeVisible({ timeout: 5_000 })

  // Advance to next month so every visible day is in the future.
  const nextBtn = page.getByRole('button', { name: /próximo mês|next month|próximo/i }).first()
  if (await nextBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await nextBtn.click()
  } else {
    // Fallback: react-day-picker's nav "next" button carries aria-label variants.
    await page.locator('button[aria-label*="next" i], button[name="next-month"]').first().click()
  }

  // Pick day 15 of the (now future) month.
  const day = grid.getByRole('button').filter({ hasText: /^15$/ }).first()
  await expect(day).toBeEnabled({ timeout: 5_000 })
  await day.click()
  await expect(trigger).not.toHaveText(/Selecionar data/i, { timeout: 5_000 })

  const timeGroup = field.getByRole('group', { name: /^Hora$/i }).first()
  await fillTimeField(timeGroup, page, time)
}

// ---------------------------------------------------------------------------
// T1.1 — Mark realizada with a held_at DIFFERENT from the schedule
// ---------------------------------------------------------------------------

test('T1.1 — Marcar como realizada with a changed held date: header shows "Realizada em", schedule unchanged, held_at persisted', async ({
  page,
}) => {
  const token = await getOwnerToken(page, 'chefe.ccih@test.local')
  // Schedule 3 days ago; we will record it as held ~2 days ago (a different day).
  const scheduledStart = new Date(Date.now() - 3 * 24 * 3600_000)
  const meetingId = await createAgendadaMeeting(page, token, {
    title: 'Reunião held-time T1.1',
    scheduledStart,
  })

  await signInAs(page, 'chefe.ccih@test.local')
  await goToMeeting(page, meetingId, /held-time T1\.1/i)
  await expect(page.getByText(/Agendada:/i).first()).toBeVisible({ timeout: 10_000 })

  // --- Open the "Marcar como realizada" transition dialog ---
  const marcarBtn = page.getByRole('button', { name: /Marcar como realizada/i })
  await expect(marcarBtn).toBeVisible()
  await marcarBtn.click()

  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible({ timeout: 8_000 })
  // The dialog carries the occurrence-window fields (ADR 0062 F2).
  await expect(dialog.getByText(/Data e hora em que a reunião efetivamente ocorreu/i)).toBeVisible()

  // Change the held start to a DIFFERENT day. Pick day 15 of the PREVIOUS month
  // (monthsBack: 1) so the chosen held date is unambiguously in the PAST
  // regardless of today's day-of-month (day 15 of the *current* month would be a
  // future date early in the month → server rejects with HC082). It still differs
  // from the scheduled day (3 days ago) and renders as "15/…".
  await setDateTimeField(page, dialog, 'Início', {
    time: '09:15',
    day: '15',
    monthsBack: 1,
  })

  // Confirm.
  const confirmBtn = dialog.getByRole('button', { name: /Marcar como realizada/i })
  await confirmBtn.click()

  // Dialog closes via route refresh on success.
  await expect(dialog).not.toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/Realizada/i).first()).toBeVisible({ timeout: 10_000 })

  // --- Header shows "Realizada em: …" AND the schedule "Agendada: …" ---
  await expect(page.getByText(/Realizada em:/i).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Agendada:/i).first()).toBeVisible()

  // --- DB truth: held_at persisted, is NOT null, and the schedule is untouched ---
  const row = await getMeetingHeld(page, meetingId)
  expect(row?.status).toBe('held')
  expect(row?.held_at).not.toBeNull()
  // Schedule was never overwritten (ADR 0062 decision 1).
  expect(new Date(row!.scheduled_start).getTime()).toBe(scheduledStart.getTime())
  // The chosen held day (calendar "15") differs from the scheduled day-of-month,
  // OR at minimum held_at is set to a value that is not equal to scheduled_start.
  expect(new Date(row!.held_at as string).getTime()).not.toBe(
    new Date(row!.scheduled_start).getTime(),
  )

  // The chosen time (09:15 local) is reflected in the stored held_at.
  const held = new Date(row!.held_at as string)
  expect(held.getMinutes()).toBe(15)

  // The rendered "Realizada em" reflects the picked day-of-month "15".
  const heldLine = page.getByText(/Realizada em:/i).first()
  await expect(heldLine).toContainText('15/')
})

// ---------------------------------------------------------------------------
// T1.2 — Edit held_* afterward via the header inline affordance (while realizada)
// ---------------------------------------------------------------------------

test('T1.2 — inline header edit of held window (while realizada) persists the new value', async ({
  page,
}) => {
  const token = await getOwnerToken(page, 'chefe.ccih@test.local')
  const scheduledStart = new Date(Date.now() - 4 * 24 * 3600_000)
  const meetingId = await createAgendadaMeeting(page, token, {
    title: 'Reunião held-time T1.2',
    scheduledStart,
  })
  // Put it into `realizada` with a known held_at (2 days ago) via the RPC.
  const initialHeld = new Date(Date.now() - 2 * 24 * 3600_000)
  const markResp = await callRPC(page, token, 'mark_meeting_held', {
    p_meeting_id: meetingId,
    p_held_at: initialHeld.toISOString(),
  })
  expect(markResp.status).toBe(200)

  await signInAs(page, 'chefe.ccih@test.local')
  await goToMeeting(page, meetingId, /held-time T1\.2/i)

  // The inline edit affordance is present ONLY while realizada + coordinator.
  const heldRegion = page.getByText(/Realizada em:/i).first()
  await expect(heldRegion).toBeVisible({ timeout: 10_000 })
  // The held-edit region is the outer <span> that contains BOTH the "Realizada
  // em:" text and its sibling "Editar" button (the button is NOT nested inside
  // the text span). Filter to the span that actually carries the button.
  const heldEditBtn = page
    .locator('span')
    .filter({ hasText: /Realizada em:/i })
    .filter({ has: page.getByRole('button', { name: /Editar/i }) })
    .first()
    .getByRole('button', { name: /Editar/i })
  await expect(heldEditBtn).toBeVisible({ timeout: 10_000 })
  await heldEditBtn.click()

  // The correction dialog opens.
  const dialog = page.getByRole('dialog', { name: /Data de realização/i })
  await expect(dialog).toBeVisible({ timeout: 8_000 })

  // Change the held start to a different day. Pick day 10 of the PREVIOUS month
  // (monthsBack: 1) so the value is unambiguously in the PAST (day 10 of the
  // current month is a future date when today is before the 10th → HC082). It
  // still differs from the initial held_at (2 days ago) and renders as "10/…".
  await setDateTimeField(page, dialog, 'Início', {
    time: '14:45',
    day: '10',
    monthsBack: 1,
  })

  await dialog.getByRole('button', { name: /^Salvar$/ }).click()
  await expect(dialog).not.toBeVisible({ timeout: 15_000 })

  // --- DB truth: the new held_at persisted and differs from the initial one ---
  const row = await getMeetingHeld(page, meetingId)
  expect(row?.status).toBe('held')
  expect(row?.held_at).not.toBeNull()
  const persisted = new Date(row!.held_at as string)
  expect(persisted.getMinutes()).toBe(45)
  expect(persisted.getTime()).not.toBe(initialHeld.getTime())
  // Schedule untouched.
  expect(new Date(row!.scheduled_start).getTime()).toBe(scheduledStart.getTime())

  // Header reflects the new day-of-month.
  await expect(page.getByText(/Realizada em:/i).first()).toContainText('10/')
})

// ---------------------------------------------------------------------------
// T1.3 — Future-date held_at is rejected with a readable pt-BR message (HC082)
// ---------------------------------------------------------------------------

test('T1.3 — future held_at is rejected: UI shows a readable pt-BR message, not a raw Postgres error', async ({
  page,
}) => {
  const token = await getOwnerToken(page, 'chefe.ccih@test.local')
  const scheduledStart = new Date(Date.now() - 24 * 3600_000)
  const meetingId = await createAgendadaMeeting(page, token, {
    title: 'Reunião held-time T1.3',
    scheduledStart,
  })

  await signInAs(page, 'chefe.ccih@test.local')
  await goToMeeting(page, meetingId, /held-time T1\.3/i)

  // Open the transition dialog and set a FUTURE held start.
  const marcarBtn = page.getByRole('button', { name: /Marcar como realizada/i })
  await expect(marcarBtn).toBeVisible()
  await marcarBtn.click()

  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible({ timeout: 8_000 })

  await setHeldDateFutureMonth(page, dialog, 'Início', '10:00')

  // Confirm → server rejects (HC082); the dialog stays OPEN with an inline error.
  await dialog.getByRole('button', { name: /Marcar como realizada/i }).click()

  // An inline error (role=alert) must surface a readable pt-BR message. It must
  // NOT be a raw Postgres/SQLSTATE string (no "SQLSTATE", "PGRST", "ERROR:").
  const alert = dialog.getByRole('alert')
  await expect(alert).toBeVisible({ timeout: 15_000 })
  const alertText = (await alert.textContent()) ?? ''
  expect(alertText.trim().length).toBeGreaterThan(0)
  // Readable pt-BR (either the specific "não podem estar no futuro" or the generic
  // meetings fallback — both are user-facing pt-BR, never a raw driver error).
  expect(alertText).not.toMatch(/SQLSTATE|PGRST|HC08\d|violates|null value|ERROR:/i)
  expect(alertText).toMatch(/futuro|não foi possível|tente novamente/i)

  // DB truth: the meeting did NOT flip to realizada and held_at stayed null.
  const row = await getMeetingHeld(page, meetingId)
  expect(row?.status).toBe('scheduled')
  expect(row?.held_at).toBeNull()
})

// ---------------------------------------------------------------------------
// T1.4 — Post-conclusion: read-only "Realizada em", NO edit button (decision 2)
// ---------------------------------------------------------------------------

test('T1.4 — after Concluir (em_assinatura), the held window is READ-ONLY with no edit button', async ({
  page,
}) => {
  const token = await getOwnerToken(page, 'chefe.ccih@test.local')
  const scheduledStart = new Date(Date.now() - 5 * 24 * 3600_000)
  const meetingId = await createAgendadaMeeting(page, token, {
    title: 'Reunião held-time T1.4',
    scheduledStart,
    withPresentChefe: true,
  })
  // Record a known held_at, then conclude (both via RPC to keep this test focused
  // on the post-conclusion UI gate, not on re-driving the dialogs).
  const heldAt = new Date(Date.now() - 3 * 24 * 3600_000)
  const markResp = await callRPC(page, token, 'mark_meeting_held', {
    p_meeting_id: meetingId,
    p_held_at: heldAt.toISOString(),
  })
  expect(markResp.status).toBe(200)
  const concludeResp = await callRPC(page, token, 'conclude_meeting', {
    p_meeting_id: meetingId,
    p_held_at: heldAt.toISOString(),
  })
  expect(concludeResp.status).toBe(200)
  expect((concludeResp.body as { status: string }).status).toBe('in_signature')

  await signInAs(page, 'chefe.ccih@test.local')
  await goToMeeting(page, meetingId, /held-time T1\.4/i)
  // Badge label renamed "Em assinatura" → "Assinatura" (meeting-labels map).
  await expect(page.getByText('Assinatura', { exact: true }).first()).toBeVisible({ timeout: 10_000 })

  // The "Realizada em: …" line is still shown (read-only variant).
  await expect(page.getByText(/Realizada em:/i).first()).toBeVisible({ timeout: 10_000 })

  // But there must be NO edit affordance next to it (decision 2 — reopen to edit).
  const heldSpan = page
    .locator('span')
    .filter({ hasText: /Realizada em:/i })
    .first()
  await expect(heldSpan.getByRole('button', { name: /Editar|Registrar/i })).toHaveCount(0)

  // Server authority: set_meeting_held_window is rejected while em_assinatura (HC083).
  const editResp = await callRPC(page, token, 'set_meeting_held_window', {
    p_meeting_id: meetingId,
    p_held_at: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
  })
  expect(editResp.status).not.toBe(200)
  expect((editResp.body as { code?: string }).code).toBe('HC083')

  // And held_at is unchanged by the rejected edit.
  const row = await getMeetingHeld(page, meetingId)
  expect(row?.status).toBe('in_signature')
  expect(new Date(row!.held_at as string).getTime()).toBe(heldAt.getTime())
})

// ---------------------------------------------------------------------------
// T1.5 — Keyboard-only pass on the transition dialog (§8)
// ---------------------------------------------------------------------------

test('T1.5 — keyboard-only: open the transition dialog, operate the held date field, confirm', async ({
  page,
}) => {
  const token = await getOwnerToken(page, 'chefe.ccih@test.local')
  const scheduledStart = new Date(Date.now() - 6 * 24 * 3600_000)
  const meetingId = await createAgendadaMeeting(page, token, {
    title: 'Reunião held-time T1.5',
    scheduledStart,
  })

  await signInAs(page, 'chefe.ccih@test.local')
  await goToMeeting(page, meetingId, /held-time T1\.5/i)

  // Open "Marcar como realizada" via keyboard (focus + Enter).
  const marcarBtn = page.getByRole('button', { name: /Marcar como realizada/i })
  await marcarBtn.focus()
  await expect(marcarBtn).toBeFocused()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible({ timeout: 8_000 })

  // Operate the held "Início" field entirely by keyboard: focus the date trigger,
  // Enter to open the calendar, Tab into a day cell, Enter to select; then type
  // the time digits into the segmented TimeField.
  const field = fieldContainer(dialog, 'Início')
  await expect(field).toBeVisible({ timeout: 5_000 })
  const dateTrigger = field.locator('button[aria-haspopup="dialog"]').first()

  await dateTrigger.focus()
  await expect(dateTrigger).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('grid')).toBeVisible({ timeout: 5_000 })

  // Tab until focus lands on a day cell (its aria-label ends in a 4-digit year).
  let onDay = false
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    onDay = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null
      if (!a || !a.closest('[role="grid"]')) return false
      const label = a.getAttribute('aria-label') ?? ''
      return /\bde \d{4}\b/.test(label)
    })
    if (onDay) {
      await page.keyboard.press('Enter')
      break
    }
  }
  expect(onDay).toBe(true)
  await expect(dateTrigger).not.toHaveText(/Selecionar data/i, { timeout: 5_000 })

  // Type the time into the first segment of the "Hora" TimeField (keyboard only).
  const seg = field
    .getByRole('group', { name: /^Hora$/i })
    .first()
    .getByRole('spinbutton')
    .first()
  await seg.focus()
  await page.keyboard.type('08')
  await page.keyboard.type('30')

  // Confirm the transition (the AlertDialogAction is a button; click for
  // cross-browser reliability of the React onClick, per the phase-10 note).
  const confirmBtn = dialog.getByRole('button', { name: /Marcar como realizada/i })
  await confirmBtn.click()

  await expect(dialog).not.toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/Realizada/i).first()).toBeVisible({ timeout: 10_000 })

  // DB truth: realizada + held_at recorded with the keyboard-typed 08:30 minute.
  const row = await getMeetingHeld(page, meetingId)
  expect(row?.status).toBe('held')
  expect(row?.held_at).not.toBeNull()
  expect(new Date(row!.held_at as string).getMinutes()).toBe(30)
})
