import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"
import { getPublishedTemplateVersion } from './helpers/process-templates'

/**
 * "Administrativo" delegated-capability role — E2E spec (ADR 0061; handoff
 * docs/plans/administrativo-delegated-role.md §7). Translates the §2 locked behaviors
 * + §6 UI surfaces into Playwright assertions.
 *
 * FEATURE FLAG (production posture): the `administrativo` flag ships ON
 * (…20260715000300_enable_administrativo.sql, mirroring the controlled_docs /
 * quality_indicators go-live flips) — no per-spec toggle needed.
 *
 * Seeded personas (password Test1234!), all commission CCIH under org rede-a:
 *   chefe.ccih@test.local   staff_admin (coordinator)                 …02
 *   staff1.ccih@test.local  plain staff (NOT appointed)               …03
 *   staff2.ccih@test.local  Administrativo — ALL FIVE capabilities, incl.
 *                           `read_cases` (ADR 0134 S8)              …04
 *   staff4.ccih@test.local  plain staff (reassign target)             …0a
 * Farmácia (same org) — the seeded staff_admin signoff QUEUE fixture lives here (CCIH
 * has none), so the view_signoffs DRILL-IN is exercised by runtime-appointing
 * staff2.farm (…07) as a `view_signoffs` Administrativo of Farmácia and reading the
 * seeded e1 response read-only. That appointment is torn down in the same test.
 *
 * COVERAGE
 *   POS (staff2): schedule a meeting; create + edit-meta a case; activate + reassign a
 *     phase and assert the assignee gains case-level WRITE (the ADR-0061 behavior
 *     change); read the signoff queue; drill into a signoff row read-only (Farmácia).
 *   NEG (staff2): conclude/cancel/set-outcome RPCs rejected; coordinator surfaces 404;
 *     appoint/grant RPCs rejected (escalation guard); no sign action on the review
 *     screen. NEG (staff1 plain): no Administrativo affordances at all.
 *   Manager UI (chefe): badge; staff_admin note; PHI/minimum-necessary note; appoint +
 *     grant/revoke a capability.
 *   KEYBOARD: the edit-meta dialog fully keyboard-operable (CLAUDE.md §8).
 *
 * Runs against the LOCAL Supabase stack + a STANDALONE prod build. Serial — several
 * tests mutate shared DB state (create cases, appoint/revoke staff1). Run --workers=1.
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

const ORG = 'rede-a'
const BASE = `/o/${ORG}/c/ccih`
const FARM_BASE = `/o/${ORG}/c/farmacia`

const COMM_CCIH = 'a0000000-0000-0000-0000-0000000000a1'
const COMM_FARM = 'b0000000-0000-0000-0000-0000000000b1'
const CASE_0001 = 'd0000000-0000-0000-0000-0000000000c1'
const SEED_RESPONSE_E1 = 'e0000000-0000-0000-0000-0000000000e1'

const UID_STAFF1 = '00000000-0000-0000-0000-000000000003'
const UID_STAFF2 = '00000000-0000-0000-0000-000000000004'
const UID_STAFF4 = '00000000-0000-0000-0000-00000000000a'
const UID_CHEFE_FARM = '00000000-0000-0000-0000-000000000005'
const UID_STAFF2_FARM = '00000000-0000-0000-0000-000000000007'

const PW = 'Test1234!'

/** Service-role delete of an Administrativo appointment (cascades its capabilities). */
async function clearAppointment(req: APIRequestContext, commissionId: string, userId: string) {
  await req.delete(
    `${SUPABASE_URL}/rest/v1/commission_administrativos?commission_id=eq.${commissionId}&user_id=eq.${userId}`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, pw = PW) {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, pw)
}

async function signOut(page: Page, base = BASE) {
  await page.goto(`${base}/meus-casos`)
  await page.waitForURL(/meus-casos/)
  await page.getByRole('button', { name: /abrir menu da conta/i }).click()
  await page.getByRole('menuitem', { name: /sair/i }).click()
  await page.waitForURL(/\/login/)
}

/** A real JWT for a persona — RLS evaluates under this token. */
async function getToken(req: APIRequestContext, email: string): Promise<string> {
  const resp = await req.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password: PW },
  })
  expect(resp.ok(), `login ${email}`).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

/** Service-role SELECT (bypasses RLS) — inspect DB state in assertions. */
async function dbQuery<T = Record<string, unknown>>(
  req: APIRequestContext,
  table: string,
  params: Record<string, string>,
): Promise<T[]> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const res = await req.get(`${SUPABASE_URL}/rest/v1/${table}?${qs}&select=*`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  })
  if (!res.ok()) return []
  return (await res.json()) as T[]
}

/** Call an RPC as a given persona token. Returns the raw response for status checks. */
async function rpcAs(
  req: APIRequestContext,
  token: string,
  fn: string,
  body: Record<string, unknown>,
) {
  return req.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })
}

/** Create a fresh CCIH case from the active M&M template under `token`'s authority. */
async function createCaseAs(req: APIRequestContext, token: string, label: string): Promise<string> {
  // ADR 0096: `process_templates.status` is dropped — resolve the published
  // version. `create_case_from_template` still takes the TEMPLATE identity id.
  // `title` is required: CCIH now carries several published templates (other
  // TV specs publish into it too), so an untitled lookup is an ARBITRARY pick,
  // not "the" M&M template this helper's doc comment promises.
  const tpl = await getPublishedTemplateVersion(
    req,
    { baseUrl: SUPABASE_URL, apikey: SUPABASE_SERVICE_KEY, bearerToken: token },
    COMM_CCIH,
    'Investigação de Óbito (M&M)',
  )
  const createRes = await rpcAs(req, token, 'create_case_from_template', {
    p_template_id: tpl.templateId,
    p_label: label,
  })
  expect(createRes.ok(), `create_case_from_template as staff2: ${await createRes.text()}`).toBeTruthy()
  const obj = (await createRes.json()) as { id: string }
  expect(obj.id).toBeTruthy()
  return obj.id
}

/** The case_phase id for a given (case, position) via service role. */
async function phaseId(req: APIRequestContext, caseId: string, position: number): Promise<string> {
  const rows = await dbQuery<{ id: string; position: number }>(req, 'case_phases', {
    case_id: `eq.${caseId}`,
  })
  const p = rows.find((r) => r.position === position)
  if (!p) throw new Error(`phase ${position} not found for case ${caseId}`)
  return p.id
}

// ---------------------------------------------------------------------------
// POS-1 — schedule_meetings: staff2 sees "Nova reunião" and can create a meeting
// ---------------------------------------------------------------------------

test('POS-1 schedule_meetings: Administrativo sees "Nova reunião" and the create_meeting gate admits them', async ({
  page,
}) => {
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`${BASE}/meetings`)
  await page.waitForURL(`${BASE}/meetings`)

  // Frontend affordance: the schedule button is present for a schedule_meetings holder.
  await expect(page.getByRole('button', { name: /Nova reunião/i })).toBeVisible({ timeout: 10_000 })

  // Backend gate: staff2 (not a coordinator) may create a meeting via the widened
  // create_meeting RPC. Drive it under staff2's own JWT — the DateTimePicker makes the
  // dialog itself flaky, so this proves the security boundary directly (RLS is the
  // authority; the button above proves the UI gate).
  const token = await getToken(page.request, 'staff2.ccih@test.local')
  const title = `Reunião Administrativo ${Date.now()}`
  const res = await rpcAs(page.request, token, 'create_meeting', {
    p_commission_id: COMM_CCIH,
    p_title: title,
    p_scheduled_start: new Date(Date.now() + 86_400_000).toISOString(),
    p_modality: 'presencial',
  })
  expect(res.ok(), `create_meeting as staff2: ${await res.text()}`).toBeTruthy()

  // DB truth: the meeting exists in CCIH.
  const rows = await dbQuery<{ title: string }>(page.request, 'meetings', {
    commission_id: `eq.${COMM_CCIH}`,
    title: `eq.${title}`,
  })
  expect(rows.length).toBe(1)

  // And it surfaces in the list after a reload.
  await page.reload()
  await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 })

  await signOut(page)
})

// ---------------------------------------------------------------------------
// POS-2 — create_cases: staff2 reaches the board, creates a case, edits its meta
// ---------------------------------------------------------------------------

test('POS-2 create_cases: Administrativo reaches the cases board, creates a case, and edits its meta via "Editar"', async ({
  page,
}) => {
  // Board is reachable (not 404) and offers "Novo caso".
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`${BASE}/manage/cases`)
  await page.waitForURL(`${BASE}/manage/cases`)
  await expect(page.getByRole('heading', { name: /^Casos$/i })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: /Novo caso/i }).first()).toBeVisible({ timeout: 10_000 })

  // Create a case under staff2's own authority (widened create_case gate).
  const token = await getToken(page.request, 'staff2.ccih@test.local')
  const caseId = await createCaseAs(page.request, token, `Caso Admin ${Date.now()}`)

  // T6 (case-surface-split Increment 1, ADR 0134 D1/D3/D4): `/casos` is now a
  // reading surface for EVERYONE, administrativo included — the three
  // role/grant-implied props (incl. `canEditMeta`) are no longer passed on this
  // host at all (T2), so the header "Editar" trigger has moved to
  // `/manage/cases/[caseId]`, which staff2 now reaches DIRECTLY (D3 arm 2:
  // `access.isAdministrativo`). The escape hatch there is "Gerenciar caso" —
  // gated on the UN-narrowed `canOpenManagement` predicate, so it can never
  // strand a viewer the gate itself would admit. Asserted present here (counts
  // by both accessible name AND href — the T1 predicate's entire UI surface for
  // this class had ZERO coverage before this addition) as the positive half of
  // the pairing quality-oversight.spec.ts already carries the negative half of
  // (quality.a, same button, same structure, different persona).
  await page.goto(`${BASE}/casos/${caseId}`)
  await page.waitForURL(`${BASE}/casos/${caseId}`)
  await expect(page.getByRole('heading', { name: /caso\s*\d+/i })).toBeVisible({ timeout: 10_000 })

  const manageLink = page.getByRole('link', { name: 'Gerenciar caso' })
  await expect(manageLink).toBeVisible({ timeout: 10_000 })
  await expect(manageLink).toHaveAttribute('href', `${BASE}/manage/cases/${caseId}`)
  await manageLink.click()
  await page.waitForURL(`${BASE}/manage/cases/${caseId}`)

  // Scope to the header action cluster — narrative cards also carry an "Editar" button
  // (the SAME ambiguity that produced a false positive earlier this program — never
  // assert the bare, unscoped name).
  const editBtn = page.locator('header').getByRole('button', { name: /^Editar$/ })
  await expect(editBtn).toBeVisible({ timeout: 10_000 })
  await editBtn.click()

  const dialog = page.getByRole('dialog', { name: /Editar caso/i })
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  const newLabel = `Descrição editada ${Date.now()}`
  const labelInput = dialog.locator('#edit-case-label')
  await labelInput.fill(newLabel)
  await dialog.getByRole('button', { name: /^Salvar$/i }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })

  // DB truth: update_case_meta persisted the new label (never status/outcome/PHI).
  await expect
    .poll(async () => {
      const rows = await dbQuery<{ label: string }>(page.request, 'cases', { id: `eq.${caseId}` })
      return rows[0]?.label
    }, { timeout: 10_000 })
    .toBe(newLabel)

  await signOut(page)
})

// ---------------------------------------------------------------------------
// POS-2b — closes FUP-ADMINISTRATIVO-CUSTOM-FIELDS-ARM-NOT-E2E-VERIFIABLE
// (docs/progress/follow-ups.md). Filed because exactly ONE case platform-wide
// carried custom-field values and staff2 (the only non-coordinator create_cases
// holder) could not read it — `can_read_case` was false — so the
// `member_can('create_cases')` disjunct of `update_case_custom_field_values` had
// no reachable fixture. S8 (`read_cases`, seeded on staff2 — ADR 0134) now makes
// that SAME case reachable: verified live 2026-08-22 against the local stack —
// `case_viewer_capabilities` for staff2 on it flipped from unreachable to
// `{can_read:true, can_write_content:false, can_manage_lifecycle:false}`, and
// `update_case_custom_field_values` under staff2's own JWT returned 204 and the
// DB row changed. This test pins that measurement as a spec. ⛔ The case is a
// SHARED seed fixture other specs read verbatim (case-custom-fields.spec.ts
// AC-4/AC-6, "READ-ONLY … never mutates the shared seed") — the write below MUST
// leave `turno_obito` back at its contract value 'manha' even if an assertion
// throws, so the mutate+restore is wrapped and DB-verified both ways.
// ---------------------------------------------------------------------------

test('POS-2b create_cases: S8 makes the shared custom-fields case reachable, and the member_can(create_cases) write disjunct is now drivable end to end', async ({
  page,
}) => {
  const CF_CASE_ID = 'd0cf0000-0000-0000-0000-0000000000c1' // "Óbito enfermaria leito 3"

  // UI half — reachability. Before S8 this 404'd for staff2 (no grant/authorship);
  // it must now render, including the create_cases-gated edit affordance (D3's
  // `canEditCustomFields = canInCommission(access,'create_cases')` is commission-
  // wide and unaffected by S8 — the NEW thing S8 buys is getting PAST the read
  // gate at all).
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${CF_CASE_ID}`)
  await page.waitForURL(`${BASE}/manage/cases/${CF_CASE_ID}`)
  await expect(page.getByRole('heading', { name: /caso\s*\d+/i })).toBeVisible({ timeout: 10_000 })
  const panel = page.getByRole('region', { name: 'Campos personalizados' })
  await expect(panel).toBeVisible({ timeout: 10_000 })
  await expect(panel.getByText('Manhã', { exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: /^Editar$/ })).toBeVisible()

  // Backend gate half — drive the RPC directly under staff2's own JWT (mirrors
  // POS-1's "backend gate" pattern), tight mutate-then-restore window, DB-verified
  // both directions so the shared fixture is left exactly as found.
  const token = await getToken(page.request, 'staff2.ccih@test.local')
  async function turnoValue(): Promise<string | undefined> {
    const rows = await dbQuery<{ value: string }>(page.request, 'case_custom_field_values', {
      case_id: `eq.${CF_CASE_ID}`,
      key: 'eq.turno_obito',
    })
    return rows[0]?.value
  }
  try {
    const writeRes = await rpcAs(page.request, token, 'update_case_custom_field_values', {
      p_case_id: CF_CASE_ID,
      p_values: [{ key: 'turno_obito', value: 'tarde' }],
    })
    expect(
      writeRes.ok(),
      `update_case_custom_field_values as staff2 (member_can('create_cases') disjunct): ${await writeRes.text()}`,
    ).toBeTruthy()
    await expect.poll(turnoValue, { timeout: 10_000 }).toBe('tarde')
  } finally {
    const revertRes = await rpcAs(page.request, token, 'update_case_custom_field_values', {
      p_case_id: CF_CASE_ID,
      p_values: [{ key: 'turno_obito', value: 'manha' }],
    })
    expect(revertRes.ok(), `restore turno_obito to the seed contract value: ${await revertRes.text()}`).toBeTruthy()
    await expect.poll(turnoValue, { timeout: 10_000 }).toBe('manha')
  }

  await signOut(page)
})

// ---------------------------------------------------------------------------
// POS-3 — assign_case_phases: activate + reassign LAND, and the assignee gets case
// READ (via the can_read_case assignee arm) + phase-form write (via assigned_to) but
// NO case-content write. (Design revert 2026-07-08: assignment NO LONGER auto-grants
// case_access write; coordinator explicit grant stays the only path to content write.)
// ---------------------------------------------------------------------------

test('POS-3 assign_case_phases: activation + reassignment land; the assignee gets case READ but NO case-content write', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const token = await getToken(page.request, 'staff2.ccih@test.local')
  const caseId = await createCaseAs(page.request, token, `Caso Fase ${Date.now()}`)
  const p1 = await phaseId(page.request, caseId, 1)

  // The affordance IS rendered for an assign_case_phases holder (frontend gate), but
  // T6: not on `/casos` any more — the three role/grant-implied props (incl.
  // `canAssignPhases`) are no longer passed on that host (T2); it renders on
  // `/manage/cases/[caseId]`, which staff2 reaches directly (D3 arm 2). We exercise
  // the assign path through the RPCs under staff2's OWN authority (the widened gate
  // admits the capability holder); the UI-driven activation is covered by REG-ADM-001.
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${caseId}`)
  await page.waitForURL(`${BASE}/manage/cases/${caseId}`)
  const phase1 = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phase1).toBeVisible({ timeout: 10_000 })
  await expect(phase1.getByRole('button', { name: /Ativar e atribuir/i })).toBeVisible()

  // ── Activate Phase 1 → assign staff1 (staff2's own JWT; the widened RPC gate) ──
  const activateRes = await rpcAs(page.request, token, 'activate_phase', {
    p_case_phase_id: p1,
    p_assigned_to: UID_STAFF1,
  })
  expect(activateRes.ok(), `activate_phase as Administrativo: ${await activateRes.text()}`).toBeTruthy()

  // The assignment LANDS: phase → ativa, assigned to staff1.
  await expect
    .poll(async () => {
      const rows = await dbQuery<{ status: string; assigned_to: string | null }>(
        page.request,
        'case_phases',
        { id: `eq.${p1}` },
      )
      return `${rows[0]?.status}:${rows[0]?.assigned_to}`
    }, { timeout: 15_000 })
    .toBe(`active:${UID_STAFF1}`)

  // DB truth (design revert): assignment writes NO case_access_grants row for the
  // assignee. (ADR 0078 Stage B renamed case_access → case_access_grants,
  // user_id → principal_id; the invariant under test is unchanged.)
  await expect
    .poll(async () => {
      const rows = await dbQuery(page.request, 'case_access_grants', {
        case_id: `eq.${caseId}`,
        principal_id: `eq.${UID_STAFF1}`,
      })
      return rows.length
    }, { timeout: 15_000 })
    .toBe(0)

  await signOut(page)

  // ── The assignee can OPEN the case READ-ONLY (assignee-arm read), NOT as a writer ──
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`${BASE}/casos/${caseId}`)
  await page.waitForURL(`${BASE}/casos/${caseId}`)
  await expect(page.getByRole('heading', { name: /caso\s*\d+/i })).toBeVisible({ timeout: 10_000 })
  // Read-only role chip ("Leitura"), NOT the write "Colaboração".
  await expect(page.getByText('Leitura', { exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Colaboração', { exact: true })).toHaveCount(0)
  // No case-content write UI: the un-attributed narratives render with no "Editar".
  await expect(page.getByRole('button', { name: /^Editar$/ })).toHaveCount(0)
  await signOut(page)

  // ── Reassign to staff4 (no response filled yet, so HC019 does not bite) ──
  const reassignRes = await rpcAs(page.request, token, 'reassign_phase', {
    p_case_phase_id: p1,
    p_new_assignee: UID_STAFF4,
  })
  expect(reassignRes.ok(), `reassign_phase as Administrativo: ${await reassignRes.text()}`).toBeTruthy()

  // The reassignment LANDS (assigned_to → staff4) and STILL writes no
  // case_access_grants row.
  await expect
    .poll(async () => {
      const rows = await dbQuery<{ assigned_to: string | null }>(page.request, 'case_phases', {
        id: `eq.${p1}`,
      })
      return rows[0]?.assigned_to
    }, { timeout: 15_000 })
    .toBe(UID_STAFF4)
  await expect
    .poll(async () => {
      const rows = await dbQuery(page.request, 'case_access_grants', {
        case_id: `eq.${caseId}`,
        principal_id: `eq.${UID_STAFF4}`,
      })
      return rows.length
    }, { timeout: 15_000 })
    .toBe(0)
})

// ---------------------------------------------------------------------------
// POS-4 — view_signoffs: staff2 reads the queue READ-ONLY (observer copy, no signer copy)
// ---------------------------------------------------------------------------

test('POS-4 view_signoffs: Administrativo reads the signoff queue read-only (observer copy; no signer copy)', async ({
  page,
}) => {
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`${BASE}/manage/assinaturas`)
  await page.waitForURL(`${BASE}/manage/assinaturas`)

  // Reachable (not 404) — the route admits a view_signoffs holder.
  await expect(page.getByRole('heading', { name: /Assinaturas pendentes/i })).toBeVisible({ timeout: 10_000 })
  // Observer copy (a view_signoffs holder observes; only a coordinator signs).
  await expect(page.getByText(/a assinatura é feita pela coordenação/i)).toBeVisible()
  // Signer copy must be ABSENT (they never sign).
  await expect(page.getByText(/aguardam a sua assinatura/i)).toHaveCount(0)

  await signOut(page)
})

// ---------------------------------------------------------------------------
// POS-5 — view_signoffs drill-in: a view_signoffs holder opens a queued response
// READ-ONLY (no sign action). CCIH has no seeded signoff queue, so this exercises
// the Farmácia fixture via a RUNTIME appointment of staff2.farm (torn down here).
// ---------------------------------------------------------------------------

test('POS-5 view_signoffs drill-in: holder opens a queued response read-only — no "Assinar seção"', async ({
  page,
}) => {
  // Runtime-appoint staff2.farm as a view_signoffs Administrativo of Farmácia (service
  // role bypasses the DEFINER-only-door + RLS, exactly like the seed does for CCIH).
  const appt = await page.request.post(`${SUPABASE_URL}/rest/v1/commission_administrativos`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    data: { commission_id: COMM_FARM, user_id: UID_STAFF2_FARM, appointed_by: UID_CHEFE_FARM },
  })
  expect(appt.ok(), `appoint staff2.farm: ${await appt.text()}`).toBeTruthy()
  const cap = await page.request.post(`${SUPABASE_URL}/rest/v1/commission_administrativo_capabilities`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    data: {
      commission_id: COMM_FARM,
      user_id: UID_STAFF2_FARM,
      capability: 'view_signoffs',
      granted_by: UID_CHEFE_FARM,
    },
  })
  expect(cap.ok(), `grant view_signoffs to staff2.farm: ${await cap.text()}`).toBeTruthy()

  try {
    await signInAs(page, 'staff2.farm@test.local')

    // The queue lists the seeded e1 response (awaiting the staff_admin signature).
    await page.goto(`${FARM_BASE}/manage/assinaturas`)
    await page.waitForURL(`${FARM_BASE}/manage/assinaturas`)
    await expect(page.getByRole('heading', { name: /Assinaturas pendentes/i })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Inspeção de Armazenamento/i).first()).toBeVisible({ timeout: 10_000 })

    // Drill in to the response review screen (the widened get_response_for_signoff read).
    await page.goto(`${FARM_BASE}/manage/assinaturas/${SEED_RESPONSE_E1}`)
    await page.waitForURL(`${FARM_BASE}/manage/assinaturas/${SEED_RESPONSE_E1}`)
    // The form loads (not 404) — the response title renders (h1; scope by level to
    // avoid the section_text h2 "Inspeção de armazenamento").
    await expect(
      page.getByRole('heading', { level: 1, name: /Inspeção de Armazenamento de Medicamentos/i }),
    ).toBeVisible({ timeout: 10_000 })
    // READ-ONLY: no sign affordance for a view_signoffs holder.
    await expect(page.getByRole('button', { name: /Assinar seção/i })).toHaveCount(0)
    await expect(page.getByText(/Assinatura da chefia/i)).toHaveCount(0)
    // Observer copy present (drives the read-only branch).
    await expect(page.getByText(/A assinatura das seções é feita pela coordenação/i)).toBeVisible()

    await signOut(page, FARM_BASE)
  } finally {
    // Tear down the runtime appointment (cascades the capability).
    await page.request.delete(
      `${SUPABASE_URL}/rest/v1/commission_administrativos?commission_id=eq.${COMM_FARM}&user_id=eq.${UID_STAFF2_FARM}`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    )
  }
})

// ---------------------------------------------------------------------------
// NEG-1 — boundary: staff2 can NEVER conclude/cancel/set-outcome/appoint/grant, and
// the coordinator-only surfaces 404 for them.
// ---------------------------------------------------------------------------

test('NEG-1 boundary: Administrativo is rejected on conclude/cancel/set-outcome/appoint RPCs; 404s on tenancy surfaces (members); reaches case manage-detail (T6, D3 arm 2) but never sees lifecycle there or on /casos', async ({
  page,
}) => {
  const token = await getToken(page.request, 'staff2.ccih@test.local')

  // close_case / cancel_case / set_case_outcome on Caso 0001 — the coordinator-only
  // gate (defense-in-depth) rejects an Administrativo. NOTE: staff2 CAN read Caso 0001
  // (narrative assignee), so a rejection here is authority, not visibility.
  const close = await rpcAs(page.request, token, 'close_case', { p_case_id: CASE_0001 })
  expect(close.ok(), 'close_case must be rejected for Administrativo').toBeFalsy()
  const cancel = await rpcAs(page.request, token, 'cancel_case', { p_case_id: CASE_0001 })
  expect(cancel.ok(), 'cancel_case must be rejected for Administrativo').toBeFalsy()

  // set_case_outcome — conclude-adjacent, coordinator-only (needs a valid outcome id).
  const outcomes = await dbQuery<{ id: string }>(page.request, 'case_outcomes', {
    commission_id: `eq.${COMM_CCIH}`,
  })
  if (outcomes[0]) {
    const setOutcome = await rpcAs(page.request, token, 'set_case_outcome', {
      p_case_id: CASE_0001,
      p_outcome_id: outcomes[0].id,
    })
    expect(setOutcome.ok(), 'set_case_outcome must be rejected for Administrativo').toBeFalsy()
  }

  // Escalation guard: an Administrativo can NEVER appoint or grant (not even to self).
  const appoint = await rpcAs(page.request, token, 'appoint_administrativo', {
    p_commission_id: COMM_CCIH,
    p_user_id: UID_STAFF1,
  })
  expect(appoint.ok(), 'appoint_administrativo must be rejected for a non-coordinator').toBeFalsy()
  const grant = await rpcAs(page.request, token, 'grant_member_capability', {
    p_commission_id: COMM_CCIH,
    p_user_id: UID_STAFF2,
    p_capability: 'schedule_meetings',
  })
  expect(grant.ok(), 'grant_member_capability must be rejected for a non-coordinator').toBeFalsy()

  // Coordinator-only UI surfaces 404 for an Administrativo.
  await signInAs(page, 'staff2.ccih@test.local')

  await page.goto(`${BASE}/manage/members`)
  // BUG-ACT-NOTFOUND-COPY-1: /não encontr/i — every manage/** route in this
  // file hits the commission not-found boundary (ACT ADR 0106's sibling),
  // verified live across the QO·B CUT_ROUTES sample.
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })

  // T6 correction (found by EXECUTION, not by the static sweep — the opposite
  // direction of "moved to manage": a surface OPENED, not one that closed).
  // The coordinator case DETAIL route (/manage/cases/[id]) now ADMITS staff2 —
  // D3 arm 2 (`access.isAdministrativo`) is COMMISSION-WIDE, not per-case (the
  // Increment-2 `_case_caps` S8 arm is what would scope commission-wide case
  // READ; it has not landed — this route's entry gate was never per-case to
  // begin with). She also independently holds ordinary READ on THIS case as the
  // Resumo Clínico narrative assignee, so the read gate above D3 does not stop
  // her either. Verified live (2026-08-21): the page renders "Caso 0001" /
  // "Óbito UTI leito 7", not the not-found boundary. "Entering is not managing"
  // (layout.tsx's own doc comment, ADR 0134 D5/T3) is the property that now
  // needs asserting here instead: lifecycle stays coordinator-only ON THIS HOST
  // too, `isCoordinator = access.role === "staff_admin"` — a role check
  // independent of the entry gate she just cleared.
  await page.goto(`${BASE}/manage/cases/${CASE_0001}`)
  await page.waitForURL(`${BASE}/manage/cases/${CASE_0001}`)
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toBeVisible({ timeout: 10_000 })
  await expect(
    page.locator('header').getByRole('button', { name: /Concluir caso/i }),
  ).toHaveCount(0)
  await expect(
    page.locator('header').getByRole('button', { name: /Cancelar caso/i }),
  ).toHaveCount(0)

  // On the STAFF case route staff2 CAN read Caso 0001 but sees NO conclude/cancel/outcome
  // (the `/casos` reading surface — unaffected by the manage-entry gate above).
  await page.goto(`${BASE}/casos/${CASE_0001}`)
  await page.waitForURL(`${BASE}/casos/${CASE_0001}`)
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toBeVisible({ timeout: 10_000 })
  // Case LIFECYCLE (Concluir/Cancelar caso) is coordinator-only and never lived on
  // this route at all (case-detail-view.tsx does not import CaseLifecycleActions).
  // (A narrative "Concluir" IS present: staff2 is the Resumo Clínico narrative
  // assignee — that Q14 action is unrelated to concluding the CASE, so we assert
  // the case-specific labels only.)
  await expect(page.getByRole('button', { name: /Concluir caso/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Cancelar caso/i })).toHaveCount(0)
  // The outcome selector (conclude-adjacent) is coordinator-only — absent here.
  await expect(page.getByText(/Desfecho do caso/i)).toHaveCount(0)

  await signOut(page)
})

// ---------------------------------------------------------------------------
// NEG-2 — plain staff (staff1, NOT appointed) has NO Administrativo affordances.
// Runs BEFORE the manager-UI test appoints staff1.
// ---------------------------------------------------------------------------

test('NEG-2 plain staff: staff1 sees no Administrativo affordances anywhere', async ({ page }) => {
  // staff1 is the clean-slate plain-staff persona. Defensively drop any Administrativo
  // appointment (e.g. left by a re-run of the manager-UI test) so this assertion is
  // isolation-independent.
  await clearAppointment(page.request, COMM_CCIH, UID_STAFF1)

  await signInAs(page, 'staff1.ccih@test.local')

  // Meetings — no "Nova reunião".
  await page.goto(`${BASE}/meetings`)
  await page.waitForURL(`${BASE}/meetings`)
  await expect(page.getByRole('button', { name: /Nova reunião/i })).toHaveCount(0)

  // Cases board — 404 (no create_cases).
  await page.goto(`${BASE}/manage/cases`)
  // BUG-ACT-NOTFOUND-COPY-1: /não encontr/i — every manage/** route in this
  // file hits the commission not-found boundary (ACT ADR 0106's sibling),
  // verified live across the QO·B CUT_ROUTES sample.
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })

  // Signoff queue — 404 (no view_signoffs).
  await page.goto(`${BASE}/manage/assinaturas`)
  // BUG-ACT-NOTFOUND-COPY-1: /não encontr/i — every manage/** route in this
  // file hits the commission not-found boundary (ACT ADR 0106's sibling),
  // verified live across the QO·B CUT_ROUTES sample.
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })

  // Members manager — 404 (not a coordinator).
  await page.goto(`${BASE}/manage/members`)
  // BUG-ACT-NOTFOUND-COPY-1: /não encontr/i — every manage/** route in this
  // file hits the commission not-found boundary (ACT ADR 0106's sibling),
  // verified live across the QO·B CUT_ROUTES sample.
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })

  await signOut(page)
})

// ---------------------------------------------------------------------------
// MGR — Manager UI (chefe): badge, staff_admin note, PHI note, appoint + grant/revoke.
// ---------------------------------------------------------------------------

test('MGR manager UI: coordinator sees the badge + staff_admin note + PHI note, and appoints staff1 with a capability', async ({
  page,
}) => {
  // Start clean: staff1 must be un-appointed for the appoint-flow assertions.
  await clearAppointment(page.request, COMM_CCIH, UID_STAFF1)

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/members`)
  await page.waitForURL(`${BASE}/manage/members`)
  await expect(page.getByRole('heading', { name: /^Membros$/i })).toBeVisible({ timeout: 10_000 })

  // staff2 is a seeded Administrativo → the "Administrativo" badge shows on their row.
  const staff2Row = page.locator('li').filter({ hasText: /Enfermeira CCIH Dois/i })
  await expect(staff2Row).toBeVisible({ timeout: 10_000 })
  await expect(staff2Row.getByText('Administrativo', { exact: true })).toBeVisible()

  // PHI/minimum-necessary note under create_cases (case_patient is on for CCIH).
  // ⛔ CORRECTED (case-surface-split Increment 2, ADR 0134 §A2.4 option D): the OLD
  // copy claimed "inserir e visualizar dados de paciente" — that "visualizar" half
  // was measurably FALSE (the capability is creation-scoped WRITE only, never a
  // read path) and the live copy was fixed, not the assertion widened to match a
  // stale claim. Assert the CURRENT rendered copy: the permission lets the holder
  // type identifiers only while creating a case (single or bulk) and never read,
  // edit or dispose of them afterwards — not even the ones they typed themselves.
  await expect(
    page
      .getByText(/deixa a pessoa digitá-los apenas no momento de criar um caso/i)
      .first(),
  ).toBeVisible()
  await expect(
    page
      .getByText(/não pode consultar, editar nem excluir identificadores depois/i)
      .first(),
  ).toBeVisible()
  // The retired claim must be GONE, not merely unasserted — a rendered-output
  // check (never a source grep: the source still legitimately mentions
  // "visualizar" in unrelated prose, e.g. the read_cases hint below).
  await expect(page.getByText(/inserir e visualizar/i)).toHaveCount(0)

  // staff_admin rows show the "coordenador já possui estas permissões" note instead of
  // a checklist (chefe's own row is the staff_admin here).
  await expect(page.getByText(/já possui estas permissões/i).first()).toBeVisible()

  // ── Appoint staff1 (clean slate) ──
  const staff1Row = page.locator('li').filter({ hasText: /Enfermeiro CCIH Um/i })
  await expect(staff1Row).toBeVisible({ timeout: 10_000 })
  await expect(staff1Row.getByText('Administrativo', { exact: true })).toHaveCount(0)
  await staff1Row.getByRole('button', { name: /Tornar Administrativo/i }).click()

  // DB truth: staff1 is now appointed.
  await expect
    .poll(async () => {
      const rows = await dbQuery(page.request, 'commission_administrativos', {
        commission_id: `eq.${COMM_CCIH}`,
        user_id: `eq.${UID_STAFF1}`,
      })
      return rows.length
    }, { timeout: 10_000 })
    .toBe(1)

  // The badge + capability checklist now render on staff1's row.
  await expect(staff1Row.getByText('Administrativo', { exact: true })).toBeVisible({ timeout: 10_000 })
  const scheduleCheckbox = staff1Row.getByRole('checkbox', { name: /Agendar e gerenciar reuniões/i })
  await expect(scheduleCheckbox).toBeVisible({ timeout: 10_000 })
  await expect(scheduleCheckbox).not.toBeChecked()

  // ── Grant a capability ── (the checkbox is a CONTROLLED input flipped only after
  // the server-action transition resolves, so a plain click + DB/UI poll — not
  // Playwright's synchronous `.check()` — is the right assertion.)
  await scheduleCheckbox.click()
  await expect
    .poll(async () => {
      const rows = await dbQuery(page.request, 'commission_administrativo_capabilities', {
        commission_id: `eq.${COMM_CCIH}`,
        user_id: `eq.${UID_STAFF1}`,
        capability: 'eq.schedule_meetings',
      })
      return rows.length
    }, { timeout: 10_000 })
    .toBe(1)
  await expect(scheduleCheckbox).toBeChecked({ timeout: 10_000 })

  // ── Revoke it ──
  await scheduleCheckbox.click()
  await expect
    .poll(async () => {
      const rows = await dbQuery(page.request, 'commission_administrativo_capabilities', {
        commission_id: `eq.${COMM_CCIH}`,
        user_id: `eq.${UID_STAFF1}`,
        capability: 'eq.schedule_meetings',
      })
      return rows.length
    }, { timeout: 10_000 })
    .toBe(0)
  await expect(scheduleCheckbox).not.toBeChecked({ timeout: 10_000 })

  // ── Un-appoint staff1 via the UI (cascades any capability) ──
  await staff1Row.getByRole('button', { name: /Remover delegação/i }).click()
  await expect
    .poll(async () => {
      const rows = await dbQuery(page.request, 'commission_administrativos', {
        commission_id: `eq.${COMM_CCIH}`,
        user_id: `eq.${UID_STAFF1}`,
      })
      return rows.length
    }, { timeout: 10_000 })
    .toBe(0)

  // Guarantee the persona is clean even if an assertion above threw mid-flow.
  await clearAppointment(page.request, COMM_CCIH, UID_STAFF1)

  await signOut(page)
})

// ---------------------------------------------------------------------------
// KBD — Keyboard-only edit-meta dialog (CLAUDE.md §8): Administrativo edits a case's
// meta entirely by keyboard.
// ---------------------------------------------------------------------------

test('KBD keyboard-only: edit-meta dialog is fully keyboard-operable for an Administrativo', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const token = await getToken(page.request, 'staff2.ccih@test.local')
  const caseId = await createCaseAs(page.request, token, `Caso Teclado ${Date.now()}`)

  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`${BASE}/casos/${caseId}`)
  await page.waitForURL(`${BASE}/casos/${caseId}`)

  // T6: the "Editar" affordance moved to `/manage/cases/[caseId]` (POS-2's comment
  // has the full mechanism). This flow MUST stay keyboard-only end to end — CLAUDE.md
  // §8's obligation is on the FLOW, not on the one dialog, so the cross-surface hop
  // via "Gerenciar caso" is itself keyboard-driven, not a `page.goto` shortcut; a
  // silently-mouse escape hatch here would repair the assertions while quietly
  // dropping the standing keyboard-only requirement.
  const manageLink = page.getByRole('link', { name: 'Gerenciar caso' })
  await expect(manageLink).toBeVisible({ timeout: 10_000 })
  await manageLink.focus()
  await expect(manageLink).toBeFocused()
  await page.keyboard.press('Enter')
  await page.waitForURL(`${BASE}/manage/cases/${caseId}`)

  // Focus the header "Editar" button and open the dialog with Enter (narrative cards
  // also carry an "Editar" button — scope to the header action cluster).
  const editBtn = page.locator('header').getByRole('button', { name: /^Editar$/ })
  await expect(editBtn).toBeVisible({ timeout: 10_000 })
  await editBtn.focus()
  await expect(editBtn).toBeFocused()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: /Editar caso/i })
  await expect(dialog).toBeVisible({ timeout: 5_000 })

  // Focus the Descrição field, clear + type a new value (keyboard-only).
  // Use `ControlOrMeta` for select-all so this stays keyboard-only AND portable:
  // on macOS a bare `Control+a` is the OS "move caret to line start" binding (not
  // select-all), which left the old label partially intact; ControlOrMeta maps to
  // Meta (⌘A) on darwin and Control elsewhere.
  const labelInput = dialog.locator('#edit-case-label')
  await labelInput.focus()
  await expect(labelInput).toBeFocused()
  await labelInput.press('ControlOrMeta+a')
  await labelInput.press('Delete')
  const newLabel = `Editado por teclado ${Date.now()}`
  await page.keyboard.type(newLabel)

  // Focus the Salvar button and submit with Enter.
  const salvar = dialog.getByRole('button', { name: /^Salvar$/i })
  await salvar.focus()
  await expect(salvar).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })

  // DB truth.
  await expect
    .poll(async () => {
      const rows = await dbQuery<{ label: string }>(page.request, 'cases', { id: `eq.${caseId}` })
      return rows[0]?.label
    }, { timeout: 10_000 })
    .toBe(newLabel)

  await signOut(page)
})

// ---------------------------------------------------------------------------
// REG-ADM-001 (was BUG-ADM-001, RESOLVED) — the assign_case_phases capability works
// through the UI: an Administrativo drives the "Ativar e atribuir" dialog and the
// activation LANDS server-side. Regression guard for the fix that dropped the stale
// coordinator `authorizeCommission` pre-gate from `activatePhase` (src/lib/cases/
// actions.ts), letting the RPC's `member_can` be the authority.
//
// We assert SERVER-SIDE truth (phase → ativa, assigned to the member), NOT the dialog
// closing: `ActivatePhaseDialog` closes via `useActionState` on `state.ok`, which is
// subject to the pre-existing BUG-AIF-001 (Windows standalone prod build truncates the
// RSC action-response body → useActionState dialogs hang on success even though the
// mutation lands). The gate/authority is correct regardless of that artifact. NOTE
// (design revert 2026-07-08): assignment no longer grants case_access — so this guard
// asserts only that the assignment LANDED (no write-row check; POS-3 owns that).
// ---------------------------------------------------------------------------

test('REG-ADM-001: Administrativo activates a phase through the UI — the activation lands server-side (gate fix regression guard)', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const token = await getToken(page.request, 'staff2.ccih@test.local')
  const caseId = await createCaseAs(page.request, token, `Caso UI Fase ${Date.now()}`)
  const p1 = await phaseId(page.request, caseId, 1)

  // T6: "Ativar e atribuir" moved to `/manage/cases/[caseId]` (POS-3's comment has
  // the full mechanism) — staff2 reaches it directly (D3 arm 2).
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${caseId}`)
  await page.waitForURL(`${BASE}/manage/cases/${caseId}`)

  const phase1 = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phase1).toBeVisible({ timeout: 10_000 })
  await phase1.getByRole('button', { name: /Ativar e atribuir/i }).click()
  const activate = page.getByRole('dialog').filter({ hasText: /Ativar e atribuir fase/i })
  await expect(activate).toBeVisible({ timeout: 10_000 })
  await activate.locator('select[name="assignedTo"]').selectOption(UID_STAFF1)
  await activate.getByRole('button', { name: /Ativar fase/i }).click()

  // Server-side truth: the action reached the RPC and the mutation landed — the phase
  // is ativa, assigned to staff1.
  await expect
    .poll(async () => {
      const rows = await dbQuery<{ status: string; assigned_to: string | null }>(
        page.request,
        'case_phases',
        { id: `eq.${p1}` },
      )
      return `${rows[0]?.status}:${rows[0]?.assigned_to}`
    }, { timeout: 15_000 })
    .toBe(`active:${UID_STAFF1}`)

  await signOut(page)
})
