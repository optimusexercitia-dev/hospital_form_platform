import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

/**
 * Phase 14a — Patient-Safety Event Intake & Hand-off (NSP Foundation)
 *
 * Test contract: every bullet in accreditation-track.md §14a Acceptance is
 * translated into assertions here. Runs against the LOCAL Supabase stack (seeded
 * personas + seed events).
 * Run `npx supabase db reset` before running; `--workers=1` required (mutation
 * tests are stateful — filing a new event changes the inbox count).
 *
 * Acceptance criteria (accreditation-track.md lines 164–171):
 *   AC-1  Committee member files event via the case-detail dialog →
 *         event lands in NSP inbox + case timeline shows it.
 *   AC-2  NSP acknowledges → status flips to `acknowledged`; reporting
 *         commission read-back list shows updated status; foreign commission
 *         sees nothing (0 rows — RLS, not UI hiding).
 *   AC-3  Custody transfer (via direct RPC since no UI in 14a) gives new
 *         holder access; reporting commission (provenance) keeps access.
 *   AC-4  PHI reads (getEventPatient) are in-scope for PQS/admin; each read
 *         writes an `event_patient.read` audit row with NO patient identifiers.
 *   AC-5  Stand-alone (case-less) event filing via `/c/[slug]/eventos/novo`
 *         works; event appears in NSP inbox and in reporter's read-back list.
 *   AC-6  PHI NEVER appears on the inbox / committee read-back list /
 *         case-timeline event cards; only the `hasPatient` indicator is present.
 *   AC-7  At least one keyboard-only flow (committee read-back → filter select).
 *
 * Fixture isolation:
 *   AC-1/5 filing tests use `staff1.ccih@test.local` (just-culture — plain staff
 *   may file) or `chefe.ccih@test.local` for the case-linked dialog (staff_admin
 *   sees the case detail). The seeded commission CCIH and case Caso 0001 are used
 *   READ-ONLY for AC-2/4/6; AC-1 and AC-5 create NEW events (additive, no
 *   mutation of existing rows).
 *   The `admin@test.local` persona is the NSP actor (is_pqs_member = is_admin).
 *
 * Seeded events (after `supabase db reset`):
 *   EV-0001  id e1000000-0000-0000-0000-0000000000a1
 *            case-linked to Caso 0001 (case_number=1), status `acknowledged`,
 *            has event_patient PHI row (mrn PRT-0099123).
 *   EV-0002  id e2000000-0000-0000-0000-0000000000a2
 *            stand-alone (no case), status `reported`, no PHI.
 *
 * Personas (password Test1234!):
 *   admin@test.local        global admin / PQS member  (00…001)
 *   chefe.ccih@test.local   staff_admin, CCIH          (00…002)
 *   staff1.ccih@test.local  staff, CCIH                (00…003)
 *   chefe.farm@test.local   staff_admin, Farmácia      (00…005) — foreign
 */

test.use({ viewport: { width: 1280, height: 900 } })

// SKIP(multi-org pilot): NSP/patient_safety module disabled when >1 org is
// provisioned (2-org seed, multi-tenancy Phase E). Re-enable when NSP-per-org
// lands and patient_safety_enabled() returns true for commission-scoped users.
const MULTI_ORG_PILOT_SKIP =
  'NSP/referral modules disabled in the 2-org multi-tenancy pilot seed — re-enable when NSP-per-org lands'

test.beforeEach(async ({ page }, testInfo) => {
  testInfo.skip(true, MULTI_ORG_PILOT_SKIP)
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.',
  )
}

// Commissions
const COMMISSION_A = 'a0000000-0000-0000-0000-0000000000a1' // CCIH
const COMMISSION_B = 'b0000000-0000-0000-0000-0000000000b1' // Farmácia

// Personas
const ADMIN_ID    = '00000000-0000-0000-0000-000000000001'
const CHEFE_CCIH  = '00000000-0000-0000-0000-000000000002'
const STAFF1_CCIH = '00000000-0000-0000-0000-000000000003'

// Seeded events
const EV1_ID = 'e1000000-0000-0000-0000-0000000000a1'  // acknowledged, case-linked, has PHI
const EV2_ID = 'e2000000-0000-0000-0000-0000000000a2'  // reported, stand-alone, no PHI

// Caso 0001
const CASE1_ID = 'd0000000-0000-0000-0000-0000000000c1'

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

/** Obtain a real JWT for a persona (RLS evaluated under it). */
async function getOwnerToken(
  req: APIRequestContext,
  email: string,
  password = 'Test1234!',
): Promise<string> {
  const resp = await req.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password },
  })
  expect(resp.ok()).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

/** PostgREST GET under a bearer token (persona JWT or service key). */
async function restGet<T>(
  req: APIRequestContext,
  path: string,
  bearer: string,
): Promise<T[]> {
  const resp = await req.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${bearer}` },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

/** Call an RPC under a persona JWT. Returns the raw Response. */
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

/** PQS inbox rows (service-role, all rows). */
async function pqsInbox(req: APIRequestContext) {
  return restGet<{ id: string; code: string; status: string; title: string }>(
    req,
    'patient_safety_event?select=id,code,status,title&order=reported_at.desc',
    SUPABASE_SERVICE_KEY,
  )
}

/** Commission events readable by a persona (RLS-scoped). */
async function commissionEvents(
  req: APIRequestContext,
  commissionId: string,
  bearer: string,
) {
  return restGet<{ id: string; code: string; status: string; title: string }>(
    req,
    `patient_safety_event?select=id,code,status,title` +
      `&reporting_commission_id=eq.${commissionId}` +
      `&order=reported_at.desc`,
    bearer,
  )
}

/** Audit rows for an action + entity (service-role truth read). */
async function auditRowsFor(
  req: APIRequestContext,
  action: string,
  entityId: string,
) {
  return restGet<{
    id: string
    action: string
    actor_id: string | null
    entity_id: string
    metadata: Record<string, unknown>
  }>(
    req,
    `audit_log?action=eq.${encodeURIComponent(action)}&entity_id=eq.${entityId}&select=id,action,actor_id,entity_id,metadata`,
    SUPABASE_SERVICE_KEY,
  )
}

// ---------------------------------------------------------------------------
// AC-1 — Committee member files event via case-detail dialog →
//         NSP inbox + case timeline
// ---------------------------------------------------------------------------

test('AC-1: chefe.ccih files event via case-detail dialog → NSP inbox + case timeline', async ({
  page,
  request,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')

  // Navigate to Caso 0001 detail
  await page.goto('/o/rede-a/c/ccih/manage/cases/d0000000-0000-0000-0000-0000000000c1')
  await page.waitForLoadState('networkidle')

  // The "Notificar evento ao NSP" button triggers the dialog
  const notifyBtn = page.getByRole('button', { name: /notificar evento ao nsp/i })
  await expect(notifyBtn).toBeVisible()
  await notifyBtn.click()

  // Dialog appears
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(/notificar evento ao nsp/i)

  // Fill the form — title and suspected-harm are the required fields
  const titleField = dialog.getByLabel(/título/i)
  await titleField.fill('Queda de paciente AC-1 spec')

  // Description: find the Markdown textarea
  const descField = dialog.getByRole('textbox', { name: /descrição/i })
  await descField.fill('Evento de teste do spec AC-1.')

  // Suspected harm — "Dano suspeito" select
  const harmSelect = dialog.getByLabel(/dano suspeito/i)
  await harmSelect.selectOption('mild')

  // Submit
  const submitBtn = dialog.getByRole('button', { name: /notificar evento/i })
  await submitBtn.click()

  // Dialog closes on success
  await expect(dialog).not.toBeVisible({ timeout: 10_000 })

  // Verify the event was created in the DB (service-role truth read)
  const inbox = await pqsInbox(request)
  const created = inbox.find((e) => e.title === 'Queda de paciente AC-1 spec')
  expect(created).toBeDefined()
  expect(created!.status).toBe('reported')

  // Case timeline includes a safety_event entry for Caso 0001
  await page.goto('/o/rede-a/c/ccih/manage/cases/d0000000-0000-0000-0000-0000000000c1/timeline')
  await page.waitForLoadState('networkidle')
  // The timeline feed renders an event card with the type label "Evento de segurança"
  await expect(page.getByText(/evento de segurança/i).first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// AC-2 — NSP acknowledges → status flips; CCIH read-back shows it;
//         foreign commission (Farmácia) sees nothing
// ---------------------------------------------------------------------------

test('AC-2a: admin acknowledges EV-0002 → status becomes acknowledged', async ({
  request,
}) => {
  // EV-0002 is seeded as `reported`; admin = PQS member
  const adminToken = await getOwnerToken(request, 'admin@test.local')

  // Verify initial state
  const before = await restGet<{ status: string }>(
    request,
    `patient_safety_event?id=eq.${EV2_ID}&select=status`,
    SUPABASE_SERVICE_KEY,
  )
  expect(before[0]?.status).toBe('reported')

  // Acknowledge via RPC under admin JWT
  const resp = await rpc(request, 'acknowledge_event', adminToken, {
    p_event_id: EV2_ID,
  })
  expect(resp.ok()).toBeTruthy()

  // Status should now be `acknowledged`
  const after = await restGet<{ status: string }>(
    request,
    `patient_safety_event?id=eq.${EV2_ID}&select=status`,
    SUPABASE_SERVICE_KEY,
  )
  expect(after[0]?.status).toBe('acknowledged')
})

test('AC-2b: reporting commission (CCIH) read-back shows acknowledged status', async ({
  page,
}) => {
  // EV-0001 is already `acknowledged` in seed — CCIH can see it on their list
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/eventos')
  await page.waitForLoadState('networkidle')

  // The event card list shows "Reconhecido" status chip. Scope to `table tbody` so
  // we don't accidentally match the status-filter `<option value="acknowledged">
  // Reconhecido</option>` (same class of false-match as SPEC-P13-001).
  // The EventsList component renders a <table>, not a ul.grid.
  const tableBody = page.locator('table tbody')
  await expect(tableBody.getByText(/reconhecido/i).first()).toBeVisible()
  // The seeded EV-0001 title
  await expect(page.getByText(/queda de paciente durante transferência/i)).toBeVisible()
})

test('AC-2c: foreign commission (Farmácia) sees 0 events via RLS', async ({
  request,
}) => {
  const farmToken = await getOwnerToken(request, 'chefe.farm@test.local')
  // Farmácia is neither the reporting commission nor the current custodian of any seeded event
  const rows = await restGet<{ id: string }>(
    request,
    `patient_safety_event?select=id`,
    farmToken,
  )
  expect(rows.length).toBe(0)
})

// ---------------------------------------------------------------------------
// AC-3 — Custody transfer (RPC) gives new holder access;
//         reporting commission keeps access (provenance)
// ---------------------------------------------------------------------------

test('AC-3: custody transfer gives new holder access; reporting commission keeps access', async ({
  request,
}) => {
  const adminToken = await getOwnerToken(request, 'admin@test.local')
  const chefeCcihToken = await getOwnerToken(request, 'chefe.ccih@test.local')

  // Pre-condition: EV-1 is currently with NSP (`pqs`). CCIH is reporting commission.
  // Transfer custody to COMMISSION_B (Farmácia) via the admin RPC.
  // RPC signature: transfer_event_custody(p_event_id, p_to_owner_kind, p_to_commission_id, p_note)
  const transferResp = await rpc(request, 'transfer_event_custody', adminToken, {
    p_event_id: EV1_ID,
    p_to_owner_kind: 'commission',
    p_to_commission_id: COMMISSION_B,
    p_note: 'Transferido para Farmácia — spec AC-3',
  })
  expect(transferResp.ok()).toBeTruthy()

  // New holder (Farmácia / chefe.farm) should now see the event
  const farmToken = await getOwnerToken(request, 'chefe.farm@test.local')
  const farmRows = await restGet<{ id: string; current_owner_kind: string }>(
    request,
    `patient_safety_event?id=eq.${EV1_ID}&select=id,current_owner_kind`,
    farmToken,
  )
  expect(farmRows.length).toBe(1)
  expect(farmRows[0].current_owner_kind).toBe('commission')

  // Reporting commission (CCIH) still sees the event (provenance)
  const ccihRows = await restGet<{ id: string }>(
    request,
    `patient_safety_event?id=eq.${EV1_ID}&select=id`,
    chefeCcihToken,
  )
  expect(ccihRows.length).toBe(1)

  // Custody ledger has 2 rows (initial NSP + the new Farmácia entry)
  const custody = await restGet<{ id: string; owner_kind: string }>(
    request,
    `event_custody?event_id=eq.${EV1_ID}&select=id,owner_kind&order=held_from.asc`,
    SUPABASE_SERVICE_KEY,
  )
  expect(custody.length).toBeGreaterThanOrEqual(2)
  expect(custody[custody.length - 1].owner_kind).toBe('commission')
})

// ---------------------------------------------------------------------------
// AC-4 — PHI reads are in-scope for PQS/admin; each read writes
//         `event_patient.read` audit row with NO patient identifiers in metadata
// ---------------------------------------------------------------------------

test('AC-4a: admin navigates to EV-0001 detail → PHI panel renders with patient data', async ({
  page,
}) => {
  await signInAs(page, 'admin@test.local')
  await page.goto(`/admin/nsp/${EV1_ID}`)
  await page.waitForLoadState('networkidle')

  // The patient panel heading is present (the section is rendered for in-scope PHI)
  await expect(page.getByRole('heading', { name: /identificação do paciente/i })).toBeVisible()
  // "Dados sensíveis" badge inside the panel
  await expect(page.getByText(/dados sensíveis/i)).toBeVisible()
  // Patient name from seed
  await expect(page.getByText(/paciente de demonstração/i)).toBeVisible()
  // MRN
  await expect(page.getByText(/PRT-0099123/)).toBeVisible()
})

test('AC-4b: PHI read writes event_patient.read audit row with no identifiers in metadata', async ({
  page,
  request,
}) => {
  // Trigger a page load of EV-1 as admin (which fires the audited read server-side)
  await signInAs(page, 'admin@test.local')

  // Capture audit rows BEFORE the visit to measure the delta
  const before = await auditRowsFor(request, 'event_patient.read', EV1_ID)

  await page.goto(`/admin/nsp/${EV1_ID}`)
  await page.waitForLoadState('networkidle')

  // One new audit row must have been added
  const after = await auditRowsFor(request, 'event_patient.read', EV1_ID)
  expect(after.length).toBeGreaterThan(before.length)

  // The most recent row's metadata must contain NO patient identifiers —
  // no name, no mrn, no date_of_birth, no encounter_ref
  const latest = after[after.length - 1]
  const meta = JSON.stringify(latest.metadata)
  expect(meta).not.toMatch(/paciente de demonstração/i)
  expect(meta).not.toMatch(/PRT-0099123/)
  expect(meta).not.toMatch(/1958-03-14/)
  expect(meta).not.toMatch(/ENC-2026/)
})

// ---------------------------------------------------------------------------
// AC-5 — Stand-alone (case-less) event filing via `/o/rede-a/c/ccih/eventos/novo`
//         works; event appears in NSP inbox and CCIH read-back list
// ---------------------------------------------------------------------------

test('AC-5: stand-alone event filing via /c/ccih/eventos/novo → inbox + read-back', async ({
  page,
  request,
}) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/eventos')
  await page.waitForLoadState('networkidle')

  // "Notificar evento" link button navigates to the stand-alone form
  const notifyLink = page.getByRole('link', { name: /notificar evento/i })
  await expect(notifyLink).toBeVisible()
  await notifyLink.click()
  await page.waitForURL('**/eventos/novo')

  // Stand-alone notify page title
  await expect(page.getByRole('heading', { name: /notificar evento ao nsp/i })).toBeVisible()

  // Fill required fields
  await page.getByLabel(/título/i).fill('Evento stand-alone AC-5 spec')
  const descField = page.getByRole('textbox', { name: /descrição/i })
  await descField.fill('Evento sem caso vinculado para teste AC-5.')
  await page.getByLabel(/dano suspeito/i).selectOption('none')

  // Submit
  await page.getByRole('button', { name: /notificar evento/i }).click()

  // Success navigates back to the events list
  await page.waitForURL('**/eventos', { timeout: 15_000 })

  // Verify the event is in the DB (NSP inbox — service-role truth)
  const inbox = await pqsInbox(request)
  const created = inbox.find((e) => e.title === 'Evento stand-alone AC-5 spec')
  expect(created).toBeDefined()
  expect(created!.status).toBe('reported')

  // Verify CCIH read-back list shows it (CCIH token — RLS-scoped)
  const ccihToken = await getOwnerToken(request, 'staff1.ccih@test.local')
  const ccihEvents = await commissionEvents(request, COMMISSION_A, ccihToken)
  const found = ccihEvents.find((e) => e.title === 'Evento stand-alone AC-5 spec')
  expect(found).toBeDefined()
})

// ---------------------------------------------------------------------------
// AC-6 — PHI NEVER appears on inbox list / committee read-back / case timeline
//         (minimum-necessary: only governance columns + hasPatient indicator)
// ---------------------------------------------------------------------------

test('AC-6: NSP inbox page renders NO PHI (name, mrn, dob absent from HTML)', async ({
  page,
}) => {
  await signInAs(page, 'admin@test.local')
  await page.goto('/admin/nsp')
  await page.waitForLoadState('networkidle')

  const html = await page.content()
  // The seed PHI row for EV-0001
  expect(html).not.toContain('Paciente de Demonstração')
  expect(html).not.toContain('PRT-0099123')
  expect(html).not.toContain('1958-03-14')
  expect(html).not.toContain('ENC-2026')
  // Governance metadata IS present — event title and code are fine
  await expect(page.getByText(/queda de paciente durante transferência/i)).toBeVisible()
})

test('AC-6: CCIH eventos list renders NO PHI', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/eventos')
  await page.waitForLoadState('networkidle')

  const html = await page.content()
  expect(html).not.toContain('Paciente de Demonstração')
  expect(html).not.toContain('PRT-0099123')
  expect(html).not.toContain('1958-03-14')
})

test('AC-6: case timeline renders NO PHI for safety event cards', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/cases/d0000000-0000-0000-0000-0000000000c1/timeline')
  await page.waitForLoadState('networkidle')

  const html = await page.content()
  expect(html).not.toContain('Paciente de Demonstração')
  expect(html).not.toContain('PRT-0099123')
  expect(html).not.toContain('1958-03-14')
  // The timeline type label IS present (safe governance metadata)
  await expect(page.getByText(/evento de segurança/i).first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// AC-7 — Keyboard-only: CCIH eventos list → status filter with keyboard
// ---------------------------------------------------------------------------

test('AC-7: keyboard-only — navigate to eventos list and filter by status', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/eventos')
  await page.waitForLoadState('networkidle')

  // Tab until the "Filtrar por estado" select is focused
  // The select is inside a label with that aria-label
  const filterSelect = page.getByLabel(/filtrar por estado/i)
  await filterSelect.focus()

  // Confirm it is focused (keyboard-reachable)
  await expect(filterSelect).toBeFocused()

  // Select "Reconhecido" (acknowledged) via keyboard
  await filterSelect.selectOption('acknowledged')

  // Filtered list should show at least EV-0001 (seeded, acknowledged)
  await expect(page.getByText(/queda de paciente durante transferência/i)).toBeVisible()

  // Count badge confirms filter is active
  const countBadge = page.locator('span').filter({ hasText: /^\d+ eventos?$/ })
  await expect(countBadge).toBeVisible()

  // Switch back to "Todos" via keyboard
  await filterSelect.selectOption('all')
  // More events visible again (seeded + any filed in this run).
  // EventsList renders a <table>, not a ul.grid — count <tbody tr> rows.
  const allCount = await page.locator('table tbody tr').count()
  expect(allCount).toBeGreaterThanOrEqual(1)
})

// ---------------------------------------------------------------------------
// AC-8 — Event detail page (NSP workspace): acknowledge button visible for
//         `reported` events; absent for `acknowledged`
// ---------------------------------------------------------------------------

test('AC-8a: event detail shows Reconhecer button when status is reported', async ({
  page,
}) => {
  // EV-0002 is seeded as `reported` (though AC-2a may have flipped it — use a
  // fresh event filed in AC-5 or just assert on the DB state first)
  const adminToken = await (async () => {
    // We need EV-0002 to be reported; if AC-2a ran first it is now acknowledged.
    // Either way, we verify: if `reported` → button visible; if `acknowledged` → button absent.
    const rows = await fetch(
      `${SUPABASE_URL}/rest/v1/patient_safety_event?id=eq.${EV2_ID}&select=status`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      },
    ).then((r) => r.json() as Promise<{ status: string }[]>)
    return rows[0]?.status
  })()

  await signInAs(page, 'admin@test.local')
  await page.goto(`/admin/nsp/${EV2_ID}`)
  await page.waitForLoadState('networkidle')

  const acknowledgeBtn = page.getByRole('button', { name: /reconhecer evento/i })
  if (adminToken === 'reported') {
    await expect(acknowledgeBtn).toBeVisible()
  } else {
    // Already acknowledged by AC-2a — button should not be present
    await expect(acknowledgeBtn).not.toBeVisible()
  }
})

test('AC-8b: event detail shows NO Reconhecer button when status is acknowledged', async ({
  page,
}) => {
  // EV-0001 is seeded as `acknowledged`
  await signInAs(page, 'admin@test.local')
  await page.goto(`/admin/nsp/${EV1_ID}`)
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('button', { name: /reconhecer evento/i })).not.toBeVisible()
  // Acknowledged timestamp appears in the header
  await expect(page.getByText(/reconhecido em/i)).toBeVisible()
})

// ---------------------------------------------------------------------------
// AC-9 — Foreign commission detail access returns 404 (RLS boundary)
// ---------------------------------------------------------------------------

test('AC-9: foreign commission member cannot access NSP event detail (redirects/404)', async ({
  page,
}) => {
  // chefe.farm is not a PQS member (not admin) → /admin/nsp is admin-only
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/admin/nsp/${EV1_ID}`)
  // The admin layout gates on isAdmin → notFound() → Next.js 404 page
  // (URL stays at the 404 path or redirects; we just assert no event data leaked)
  const html = await page.content()
  expect(html).not.toContain('Queda de paciente durante transferência')
  expect(html).not.toContain('PRT-0099123')
})

// ---------------------------------------------------------------------------
// AC-10 — Custody history on event detail renders the append-only ledger
// ---------------------------------------------------------------------------

test('AC-10: NSP event detail shows custody history with at least one entry', async ({
  page,
}) => {
  await signInAs(page, 'admin@test.local')
  await page.goto(`/admin/nsp/${EV1_ID}`)
  await page.waitForLoadState('networkidle')

  // "Histórico de custódia" section heading
  await expect(page.getByRole('heading', { name: /histórico de custódia/i })).toBeVisible()

  // At least one custody entry row (the seeded initial NSP custody)
  const entries = page.locator('ol li')
  expect(await entries.count()).toBeGreaterThanOrEqual(1)

  // "Custódia atual" badge on the current (open-ended) entry
  await expect(page.getByText(/custódia atual/i)).toBeVisible()
})
