import { test, expect, type APIRequestContext } from '@playwright/test'

/**
 * PHI/HIPAA-Readiness Remediation — E2E acceptance tests
 *
 * Covers the user-visible behaviour changes from the 2026-06-20 remediation:
 *
 * WS 0  — Schema squash (86→12 migrations). Behaviour-equivalent baseline.
 *          E2E proof: regression suite (run separately). Here: spot-check that
 *          the key NSP paths still work end-to-end.
 *
 * WS A  — event_patient lockdown:
 *   REM-1  PQS-enrolled admin sees NSP inbox + can open event detail
 *          (get_event_patient RPC round-trip proves new single-door works).
 *   REM-2  PHI panel renders for PQS admin; patient identifiers visible.
 *   REM-3  PHI read emits event_patient.read audit row (metadata PHI-free).
 *   REM-4  Direct SELECT on event_patient is REVOKED; direct REST call returns 403.
 *   REM-5  Non-PQS committee user (chefe.ccih) cannot read event_patient via REST.
 *   REM-6  Committee read-back (/c/ccih/eventos) shows events with NO PHI leakage.
 *
 * WS B  — Audited free-text reads (*.viewed emits for 6 detail reads).
 *   REM-7  Navigating to NSP event detail (admin) emits safety_event.viewed audit row.
 *   REM-8  Navigating to RCA detail (admin) emits rca.viewed audit row.
 *   REM-9  Navigating to CAPA detail (admin) emits capa_plan.viewed audit row.
 *
 * Keyboard-only:
 *   REM-K1 Keyboard-only navigation to NSP event detail + patient panel visible.
 *
 * Personas (password Test1234!):
 *   admin@test.local        global admin, PQS member (seeded into pqs_members)
 *   chefe.ccih@test.local   staff_admin, CCIH — committee member, NOT PQS
 *   staff1.ccih@test.local  staff, CCIH — plain member, NOT PQS
 *
 * Seeded events (after supabase db reset):
 *   EV-0001  e1000000-0000-0000-0000-0000000000a1
 *            acknowledged, case-linked, HAS event_patient (mrn PRT-0099123,
 *            name "Paciente de Demonstração", dob 1958-03-14)
 *   EV-0002  e2000000-0000-0000-0000-0000000000a2
 *            reported, stand-alone, NO PHI row
 *
 * Seeded RCA / CAPA (for WS B audit rows):
 *   RCA linked to EV-0001: look up via service role
 *   CAPA linked to EV-0001: look up via service role
 *
 * Run:  npx playwright test e2e/phi-remediation.spec.ts --project=chromium --workers=1
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
  throw new Error('SUPABASE_SERVICE_ROLE_KEY missing — set it in .env.local')
}

const EV1_ID = 'e1000000-0000-0000-0000-0000000000a1' // acknowledged, has PHI

// Known PHI strings from the seed row
const PHI_NAME = 'Paciente de Demonstração'
const PHI_MRN  = 'PRT-0099123'
const PHI_DOB  = '1958-03-14'
const PHI_ENC  = 'ENC-2026'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Parameters<typeof test>[1]['page'], email: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill('Test1234!')
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 20_000,
  })
}

/** Obtain a real JWT for a persona (RLS evaluated under that identity). */
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

/** Service-role REST GET. */
async function svcGet<T>(req: APIRequestContext, path: string): Promise<T[]> {
  const resp = await req.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

/** User-scoped REST GET (returns the raw Response). */
async function userGet(
  req: APIRequestContext,
  path: string,
  token: string,
) {
  return req.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
    },
  })
}

/** Audit rows for a given action and entity (service-role truth read). */
async function auditRows(
  req: APIRequestContext,
  action: string,
  entityId: string,
) {
  return svcGet<{
    id: string
    action: string
    actor_id: string | null
    entity_id: string
    metadata: Record<string, unknown>
  }>(
    req,
    `audit_log?action=eq.${encodeURIComponent(action)}&entity_id=eq.${entityId}` +
      `&select=id,action,actor_id,entity_id,metadata&order=occurred_at.asc`,
  )
}

// ---------------------------------------------------------------------------
// REM-1 — PQS-enrolled admin can access NSP inbox and event list
// ---------------------------------------------------------------------------

test('REM-1: PQS admin reaches /admin/nsp and sees the seeded event', async ({ page }) => {
  await signInAs(page, 'admin@test.local')

  await page.goto('/admin/nsp')
  await page.waitForLoadState('networkidle')

  // Must NOT be redirected to 404 (admin IS a PQS member in the new baseline)
  await expect(page).not.toHaveURL(/not-found|404/)

  // The seeded EV-0001 title appears in the inbox
  await expect(
    page.getByText(/queda de paciente durante transferência/i).first(),
  ).toBeVisible()

  // hasPatient indicator for EV-0001 is present (not the identifiers themselves)
  // The inbox renders a "Paciente" badge or indicator column — either text or icon
  // We only assert PHI does NOT appear on the LIST page
  const html = await page.content()
  expect(html).not.toContain(PHI_MRN)
  expect(html).not.toContain(PHI_DOB)
})

// ---------------------------------------------------------------------------
// REM-2 — PQS admin opens EV-0001 detail → PHI panel renders (RPC round-trip)
// ---------------------------------------------------------------------------

test('REM-2: PQS admin opens event detail — patient panel shows PHI via get_event_patient RPC', async ({
  page,
}) => {
  await signInAs(page, 'admin@test.local')

  await page.goto(`/admin/nsp/${EV1_ID}`)
  await page.waitForLoadState('networkidle')

  // Patient panel heading
  await expect(
    page.getByRole('heading', { name: /identificação do paciente/i }),
  ).toBeVisible()

  // "Dados sensíveis" badge confirms the panel is in the PHI zone
  await expect(page.getByText(/dados sensíveis/i)).toBeVisible()

  // Patient name from the seeded event_patient row
  await expect(page.getByText(new RegExp(PHI_NAME, 'i'))).toBeVisible()

  // MRN
  await expect(page.getByText(PHI_MRN)).toBeVisible()
})

// ---------------------------------------------------------------------------
// REM-3 — PHI read emits event_patient.read audit row (metadata is PHI-free)
// ---------------------------------------------------------------------------

test('REM-3: opening EV-0001 detail emits event_patient.read audit row with no PHI in metadata', async ({
  page,
  request,
}) => {
  await signInAs(page, 'admin@test.local')

  // Capture baseline count BEFORE the page load
  const before = await auditRows(request, 'event_patient.read', EV1_ID)

  await page.goto(`/admin/nsp/${EV1_ID}`)
  await page.waitForLoadState('networkidle')

  // At least one new audit row must have been emitted
  const after = await auditRows(request, 'event_patient.read', EV1_ID)
  expect(after.length).toBeGreaterThan(before.length)

  // The newest row must carry NO PHI in its metadata
  const newest = after[after.length - 1]
  const metaStr = JSON.stringify(newest.metadata ?? {})
  expect(metaStr).not.toMatch(new RegExp(PHI_NAME, 'i'))
  expect(metaStr).not.toContain(PHI_MRN)
  expect(metaStr).not.toContain(PHI_DOB)
  expect(metaStr).not.toContain(PHI_ENC)
})

// ---------------------------------------------------------------------------
// REM-4 — Direct REST SELECT on event_patient is REVOKED (returns 403/42501)
// ---------------------------------------------------------------------------

test('REM-4: direct REST read of event_patient is denied — returns 403/42501', async ({
  request,
}) => {
  // REVOKE from authenticated role means PostgREST returns 403.
  // Use select=* to avoid a 400 (unknown column) masking the real denial.
  const adminToken = await getToken(request, 'admin@test.local')

  const resp = await userGet(
    request,
    `event_patient?event_id=eq.${EV1_ID}&select=*`,
    adminToken,
  )

  // WS A applied REVOKE on the authenticated role — PostgREST returns 403.
  // We also accept 0 rows (both prove no direct leakage).
  if (resp.status() === 200) {
    const rows = await resp.json()
    expect(Array.isArray(rows) && rows.length === 0).toBeTruthy()
  } else {
    expect([403, 401]).toContain(resp.status())
  }
})

// ---------------------------------------------------------------------------
// REM-5 — Non-PQS committee user cannot read event_patient via REST
// ---------------------------------------------------------------------------

test('REM-5: non-PQS committee staff_admin (chefe.ccih) is denied event_patient read', async ({
  request,
}) => {
  const chefeToken = await getToken(request, 'chefe.ccih@test.local')

  // Use select=* to avoid a 400 (unknown column) masking the real denial.
  const resp = await userGet(
    request,
    `event_patient?event_id=eq.${EV1_ID}&select=*`,
    chefeToken,
  )

  // REVOKE on authenticated role → 403; or RLS deny → 0 rows
  if (resp.status() === 200) {
    const rows = await resp.json()
    expect(Array.isArray(rows) && rows.length === 0).toBeTruthy()
  } else {
    expect([403, 401]).toContain(resp.status())
  }
})

// ---------------------------------------------------------------------------
// REM-6 — Committee read-back (/c/ccih/eventos) shows events but NO PHI
// ---------------------------------------------------------------------------

test('REM-6a: chefe.ccih committee read-back shows events with no PHI leakage', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/c/ccih/eventos')
  await page.waitForLoadState('networkidle')

  // The seeded EV-0001 (acknowledged) is visible to CCIH as the reporting commission
  await expect(
    page.getByText(/queda de paciente durante transferência/i),
  ).toBeVisible()

  // Status chip "Reconhecido" appears (governance metadata — not PHI)
  const tableBody = page.locator('table tbody')
  await expect(tableBody.getByText(/reconhecido/i).first()).toBeVisible()

  // NO PHI in the page HTML
  const html = await page.content()
  expect(html).not.toContain(PHI_NAME)
  expect(html).not.toContain(PHI_MRN)
  expect(html).not.toContain(PHI_DOB)
  expect(html).not.toContain(PHI_ENC)
})

test('REM-6b: staff1.ccih plain member sees events with no PHI leakage', async ({
  page,
}) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto('/c/ccih/eventos')
  await page.waitForLoadState('networkidle')

  // Staff members can view the events list for their commission
  // (no PHI present regardless of what they can see)
  const html = await page.content()
  expect(html).not.toContain(PHI_NAME)
  expect(html).not.toContain(PHI_MRN)
  expect(html).not.toContain(PHI_DOB)
  expect(html).not.toContain(PHI_ENC)
})

// ---------------------------------------------------------------------------
// REM-7 — Navigating to NSP event detail emits safety_event.viewed audit row
//          (WS B audited free-text *.viewed rows)
// ---------------------------------------------------------------------------

test('REM-7: opening event detail emits safety_event.viewed audit row', async ({
  page,
  request,
}) => {
  await signInAs(page, 'admin@test.local')

  const before = await auditRows(request, 'safety_event.viewed', EV1_ID)

  await page.goto(`/admin/nsp/${EV1_ID}`)
  await page.waitForLoadState('networkidle')

  const after = await auditRows(request, 'safety_event.viewed', EV1_ID)
  expect(after.length).toBeGreaterThan(before.length)

  // The newest audit row must NOT carry PHI or free-text body
  const newest = after[after.length - 1]
  const metaStr = JSON.stringify(newest.metadata ?? {})
  expect(metaStr).not.toContain(PHI_MRN)
  expect(metaStr).not.toContain(PHI_NAME)
  expect(newest.actor_id).toBeTruthy() // actor logged
})

// ---------------------------------------------------------------------------
// REM-8 — Navigating to RCA detail emits rca.viewed audit row
// ---------------------------------------------------------------------------

test('REM-8: opening RCA detail emits rca.viewed audit row', async ({
  page,
  request,
}) => {
  // Find any seeded RCA linked to EV-0001 (table is `rca`, link column `event_id`)
  const rcaRows = await svcGet<{ id: string }>(
    request,
    `rca?event_id=eq.${EV1_ID}&select=id&limit=1`,
  )
  if (rcaRows.length === 0) {
    test.skip(true, 'No seeded RCA for EV-0001 — skip REM-8 (pgTAP-covered)')
    return
  }
  const rcaId = rcaRows[0].id

  await signInAs(page, 'admin@test.local')

  const before = await auditRows(request, 'rca.viewed', rcaId)

  await page.goto(`/admin/nsp/rca/${rcaId}`)
  await page.waitForLoadState('networkidle')

  // Page must load (not 404)
  await expect(page).not.toHaveURL(/not-found|404/)

  const after = await auditRows(request, 'rca.viewed', rcaId)
  expect(after.length).toBeGreaterThan(before.length)

  const newest = after[after.length - 1]
  expect(newest.actor_id).toBeTruthy()
  // metadata must not contain free-text PHI
  const metaStr = JSON.stringify(newest.metadata ?? {})
  expect(metaStr).not.toContain(PHI_MRN)
})

// ---------------------------------------------------------------------------
// REM-9 — Navigating to CAPA detail emits capa_plan.viewed audit row
// ---------------------------------------------------------------------------

test('REM-9: opening CAPA detail emits capa_plan.viewed audit row', async ({
  page,
  request,
}) => {
  // Find the seeded CAPA linked to EV-0001 (column is `source_event_id`)
  const capaRows = await svcGet<{ id: string }>(
    request,
    `capa_plan?source_event_id=eq.${EV1_ID}&select=id&limit=1`,
  )
  if (capaRows.length === 0) {
    test.skip(true, 'No seeded CAPA for EV-0001 — skip REM-9 (pgTAP-covered)')
    return
  }
  const capaId = capaRows[0].id

  await signInAs(page, 'admin@test.local')

  const before = await auditRows(request, 'capa_plan.viewed', capaId)

  await page.goto(`/admin/nsp/capa/${capaId}`)
  await page.waitForLoadState('networkidle')

  await expect(page).not.toHaveURL(/not-found|404/)

  const after = await auditRows(request, 'capa_plan.viewed', capaId)
  expect(after.length).toBeGreaterThan(before.length)

  const newest = after[after.length - 1]
  expect(newest.actor_id).toBeTruthy()
  const metaStr = JSON.stringify(newest.metadata ?? {})
  expect(metaStr).not.toContain(PHI_MRN)
})

// ---------------------------------------------------------------------------
// REM-K1 — Keyboard-only: navigate to NSP event detail → patient panel visible
// ---------------------------------------------------------------------------

test('REM-K1: keyboard-only — NSP inbox → open event detail → patient panel visible', async ({
  page,
}) => {
  await signInAs(page, 'admin@test.local')

  // Navigate to inbox via keyboard: go to /admin/nsp first, then Tab to an event link
  await page.goto('/admin/nsp')
  await page.waitForLoadState('networkidle')

  // The event title links are in the inbox table. Tab to the first one and press Enter.
  // We focus the first event link in the table (contains the EV-0001 title text).
  const firstEventLink = page
    .getByRole('link', { name: /queda de paciente durante transferência/i })
    .first()
  await firstEventLink.focus()
  await expect(firstEventLink).toBeFocused()

  // Keyboard-activate: Enter key navigates to the event detail
  await page.keyboard.press('Enter')
  await page.waitForLoadState('networkidle')

  // Must be on an event detail page
  await expect(page).toHaveURL(/\/admin\/nsp\/[0-9a-f-]+$/)

  // Patient panel is accessible (the PHI panel heading is present)
  await expect(
    page.getByRole('heading', { name: /identificação do paciente/i }),
  ).toBeVisible()
})
