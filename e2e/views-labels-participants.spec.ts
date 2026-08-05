import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { setDateTimeField, fillTimeField, pickDate, fieldContainer } from './helpers/date-pickers'
import { cachedSignIn } from "./helpers/auth"
import { createDraftTemplateDirect } from './helpers/process-templates'

/**
 * Form-builder-enhancements batch (ad-hoc 2026-07-06) — TASKS 8 + 9 + 10:
 * Views & labels + meeting participants + openNarrativeCount.
 *
 * Acceptance:
 *   8(a) A published/active/archived process template shows a read-only
 *        "Desfechos disponíveis" card listing offered outcomes.
 *   8(b) A phase configured to emit a result shows an "Emite resultado" badge.
 *   8(c) The cases-KPI strip label reads "Etapas pendentes" and its count
 *        INCLUDES open narratives (status aberta) — adding an open narrative
 *        raises the board's openNarrativeCount by 1 (task 10).
 *   8(d) The encounter-date label reads "Atendimento" (NOT "Atendimento /
 *        internação"); no spec/UI carries the old string.
 *   9    Nova reunião — a "Participantes" section below "Modalidade" with a
 *        "Convocar todos os membros" toggle ON by default; toggling OFF reveals a
 *        keyboard-navigable member checklist + a live "N membros convocados"
 *        count; a chosen subset → the meeting lists exactly those Convocados; the
 *        default-ON path convokes all members.
 *
 * Fixtures built via service role + persona JWT; asserted through the UI.
 * Personas (Test1234!): chefe.ccih (staff_admin CCIH).
 * Serial — shared template + case fixtures.
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
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}

const ORG = 'rede-a'
const COMM_A = 'a0000000-0000-0000-0000-0000000000a1'
const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002'
const SEED_FORM_ID = 'f0000000-0000-0000-0000-00000000a001' // Checklist Higienização (published)

const TAG = 'VIEWS-E2E'
const TEMPLATE_TITLE = `Template ${TAG}`
const OUTCOME_A = `Desfecho A ${TAG}`
const OUTCOME_B = `Desfecho B ${TAG}`
const R_EMITE_1 = `Resultado 1 ${TAG}`
const R_EMITE_2 = `Resultado 2 ${TAG}`

let templateId: string
let templateVersionId: string
let caseWithNarrative: string

// ---------------------------------------------------------------------------
// Helpers
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

/** Read a commission's board openNarrativeCount sum (as staff_admin via RPC). */
async function boardOpenNarrativeSum(
  req: APIRequestContext,
  token: string,
): Promise<number> {
  const r = await rpc(req, 'list_cases_board', token, {
    p_commission_id: COMM_A,
    p_limit: 500,
  })
  expect(r.ok(), `list_cases_board failed: ${await r.text()}`).toBeTruthy()
  const rows = (await r.json()) as { open_narrative_count: number }[]
  return rows.reduce((acc, x) => acc + (x.open_narrative_count ?? 0), 0)
}

async function purge() {
  const { spawnSync } = await import('child_process')
  const sql = [
    'SET session_replication_role = replica',
    `DELETE FROM cases WHERE label LIKE 'Caso ${TAG}%'`,
    `DELETE FROM process_templates WHERE title LIKE 'Template ${TAG}%' AND commission_id = '${COMM_A}'`,
    `DELETE FROM case_outcomes WHERE commission_id = '${COMM_A}' AND label LIKE '%${TAG}'`,
    `DELETE FROM phase_results WHERE commission_id = '${COMM_A}' AND label LIKE '%${TAG}'`,
    `DELETE FROM meetings WHERE title LIKE '%${TAG}%'`,
    'SET session_replication_role = DEFAULT',
  ].join('; ')
  spawnSync(
    'docker',
    ['exec', 'supabase_db_azkbbhskturikxpgmafq', 'psql', '-U', 'postgres', '-d', 'postgres', '-c', sql],
    { cwd: process.cwd(), stdio: 'pipe' },
  )
}

// ---------------------------------------------------------------------------
// Suite setup — an emitting template with offered outcomes, and a case with an
// open narrative.
// ---------------------------------------------------------------------------

test.beforeAll(async ({ request }) => {
  await purge()
  const chefeToken = await getToken(request, 'chefe.ccih@test.local')

  // Offered-outcome vocabulary.
  async function createOutcome(label: string, color: string): Promise<string> {
    const r = await rpc(request, 'create_case_outcome', chefeToken, {
      p_commission_id: COMM_A,
      p_label: label,
      p_color_token: color,
    })
    expect(r.ok(), `create_case_outcome(${label}) failed: ${await r.text()}`).toBeTruthy()
    return ((await r.json()) as { id: string }).id
  }
  const outAId = await createOutcome(OUTCOME_A, 'green')
  const outBId = await createOutcome(OUTCOME_B, 'red')

  // Result vocabulary (for the emitting phase).
  async function createResult(label: string, color: string): Promise<string> {
    const r = await rpc(request, 'create_phase_result', chefeToken, {
      p_commission_id: COMM_A,
      p_label: label,
      p_color_token: color,
      p_is_adverse: false,
    })
    expect(r.ok(), `create_phase_result(${label}) failed: ${await r.text()}`).toBeTruthy()
    return ((await r.json()) as { id: string }).id
  }
  const res1 = await createResult(R_EMITE_1, 'green')
  const res2 = await createResult(R_EMITE_2, 'amber')

  // A draft template offering the two outcomes, with one EMITTING phase.
  // ADR 0096: identity + v1 draft; outcome/phase authoring is version-grained.
  const draftTpl = await createDraftTemplateDirect(
    request,
    { baseUrl: SUPABASE_URL, apikey: SUPABASE_SERVICE_KEY, bearerToken: SUPABASE_SERVICE_KEY },
    {
      commissionId: COMM_A,
      title: TEMPLATE_TITLE,
      description: 'Spec-owned views/labels template.',
      createdBy: UID_CHEFE_A,
    },
  )
  templateId = draftTpl.templateId
  templateVersionId = draftTpl.versionId

  // Offer the outcomes on the template (via the outcomes RPC).
  const setOutcomes = await rpc(request, 'set_process_outcomes', chefeToken, {
    p_template_version_id: templateVersionId,
    p_outcome_ids: [outAId, outBId],
  })
  expect(setOutcomes.ok(), `set_process_outcomes failed: ${await setOutcomes.text()}`).toBeTruthy()

  // A phase that EMITS a result (manual mode: emits_result + allowed subset, no ruleset).
  const phaseResp = await rpc(request, 'add_template_phase', chefeToken, {
    p_template_version_id: templateVersionId,
    p_form_id: SEED_FORM_ID,
    p_title: 'Fase — Emite resultado',
    p_recommend_when: null,
    p_default_due_days: null,
    p_blocks: [],
    p_result_ruleset: null,
    p_emits_result: true,
    p_allowed_result_ids: [res1, res2],
  })
  expect(phaseResp.ok(), `add_template_phase failed: ${await phaseResp.text()}`).toBeTruthy()

  // Publish the template → its outcomes card renders (active) + phase badge.
  const pub = await rpc(request, 'publish_process_template', chefeToken, {
    p_template_id: templateId,
  })
  expect(pub.ok(), `publish_process_template failed: ${await pub.text()}`).toBeTruthy()

  // A process-less case + an OPEN ad-hoc narrative (status aberta) for task 8(c)/10.
  const caseResp = await rpc(request, 'create_case', chefeToken, {
    p_commission_id: COMM_A,
    p_label: `Caso ${TAG} — com narrativa`,
  })
  expect(caseResp.ok(), `create_case failed: ${await caseResp.text()}`).toBeTruthy()
  caseWithNarrative = ((await caseResp.json()) as { id: string }).id

  const narrResp = await rpc(request, 'add_ad_hoc_narrative', chefeToken, {
    p_case_id: caseWithNarrative,
    p_new_type_label: `Narrativa ${TAG}`,
    p_title: `Narrativa aberta ${TAG}`,
    p_instructions: 'Narrativa E2E para o contador de etapas pendentes.',
  })
  expect(narrResp.ok(), `add_ad_hoc_narrative failed: ${await narrResp.text()}`).toBeTruthy()
})

test.afterAll(async () => {
  await purge()
})

// ---------------------------------------------------------------------------
// TASK 8(a) + 8(b): published template — "Desfechos disponíveis" card + "Emite
// resultado" badge.
// ---------------------------------------------------------------------------

test('AC-1: published template shows the "Desfechos disponíveis" card + the "Emite resultado" phase badge', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/manage/process-templates/${templateId}`)

  // 8(a): the read-only outcomes card lists the offered outcomes.
  await expect(
    page.getByRole('heading', { name: /Desfechos disponíveis/i }),
  ).toBeVisible({ timeout: 12_000 })
  await expect(page.getByText(OUTCOME_A, { exact: false }).first()).toBeVisible()
  await expect(page.getByText(OUTCOME_B, { exact: false }).first()).toBeVisible()

  // 8(b): the emitting phase carries the "Emite resultado" badge.
  await expect(page.getByText(/Emite resultado/i).first()).toBeVisible({
    timeout: 8_000,
  })
})

// ---------------------------------------------------------------------------
// TASK 8(c) + 10: cases-KPI strip "Etapas pendentes" INCLUDES open narratives.
// ---------------------------------------------------------------------------

test('AC-2: KPI label reads "Etapas pendentes"; the board count INCLUDES open narratives (RPC delta = +1 per open narrative)', async ({
  page,
  request,
}) => {
  const token = await getToken(request, 'chefe.ccih@test.local')

  // 8(c)/10 — VALUE assertion on the actual data path: adding one more OPEN
  // narrative raises the board's summed openNarrativeCount by EXACTLY 1. This
  // proves the count feeds "Etapas pendentes" (computeCaseKpis folds
  // openNarrativeCount into fasesPendentes) without racing the animated DOM number.
  const before = await boardOpenNarrativeSum(request, token)
  expect(before).toBeGreaterThanOrEqual(1) // our seeded open narrative
  const narrResp = await rpc(request, 'add_ad_hoc_narrative', token, {
    p_case_id: caseWithNarrative,
    p_new_type_label: `Narrativa extra ${TAG}`,
    p_title: `Narrativa aberta extra ${TAG}`,
    p_instructions: 'Segunda narrativa aberta E2E.',
  })
  expect(narrResp.ok(), `add_ad_hoc_narrative failed: ${await narrResp.text()}`).toBeTruthy()
  const after = await boardOpenNarrativeSum(request, token)
  expect(after).toBe(before + 1)

  // Label + sub-line copy (the relabel acceptance).
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/manage/cases`)
  await expect(page.getByText('Etapas pendentes', { exact: true })).toBeVisible({
    timeout: 12_000,
  })
  await expect(page.getByText(/Fases e narrativas em aberto/i)).toBeVisible()

  // The "Etapas pendentes" KPI card's OWN rendered value ≥ the openNarrativeCount
  // sum (it also folds pending phases). Scope to the card that CONTAINS the exact
  // label, then read its value paragraph once the count-up animation settles.
  const card = page
    .locator('div.rounded-xl')
    .filter({ hasText: 'Etapas pendentes' })
    .filter({ hasText: 'Fases e narrativas em aberto' })
    .first()
  await expect(card).toBeVisible({ timeout: 8_000 })
  // The value <p> is the bold tabular-nums line; poll until it settles ≥ after.
  await expect(async () => {
    const txt = await card.locator('p.font-bold').first().textContent()
    const rendered = Number((txt ?? '').replace(/\D/g, ''))
    expect(rendered).toBeGreaterThanOrEqual(after)
  }).toPass({ timeout: 8_000 })
})

// ---------------------------------------------------------------------------
// TASK 8(d): the encounter-date label reads "Atendimento" (no "internação").
// ---------------------------------------------------------------------------

test('AC-3: the create-case PHI block encounter label reads "Atendimento" (not "Atendimento / internação")', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/manage/cases`)

  await page.getByRole('button', { name: /Novo caso/i }).click()
  const dialog = page.getByRole('dialog', { name: /Novo caso/i })
  await expect(dialog).toBeVisible({ timeout: 8_000 })
  await dialog.locator('select[name="templateId"]').selectOption({ label: 'Sem processo' })

  // Turn on the PHI block → the identifier fields include an "Atendimento" field.
  const phiToggle = dialog.getByText(/Registra identificadores de paciente/i)
  if (await phiToggle.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await phiToggle.click()
    await dialog.getByRole('button', { name: /Próximo/i }).click()
    // The encounter field is labelled "Atendimento" (short form).
    await expect(dialog.getByLabel(/Atendimento/i).first()).toBeVisible({
      timeout: 8_000,
    })
    // The old "Atendimento / internação" string must NOT be present anywhere.
    await expect(dialog.getByText(/Atendimento\s*\/\s*interna/i)).toHaveCount(0)
  }
})

// ---------------------------------------------------------------------------
// TASK 9: Nova reunião — Participantes section, default-ON convocar todos, and
// a subset selection → the meeting lists exactly those Convocados.
// ---------------------------------------------------------------------------

test('AC-4: Nova reunião — "Participantes" section defaults to "Convocar todos" ON; the meeting convokes all members', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/meetings`)

  await page.getByRole('button', { name: /Nova reunião/i }).click()
  const dialog = page.getByRole('dialog', { name: /Nova reunião/i })
  await expect(dialog).toBeVisible({ timeout: 8_000 })

  // Participantes section present; "Convocar todos os membros" checked by default.
  await expect(dialog.getByText(/Participantes/i).first()).toBeVisible()
  const convocarTodos = dialog.getByRole('checkbox', {
    name: /Convocar todos os membros/i,
  })
  await expect(convocarTodos).toBeChecked()
  // With "todos" ON, the member checklist is hidden.
  await expect(dialog.getByText(/membros? convocados?/i)).toHaveCount(0)

  // Fill the required header + create.
  await dialog.getByRole('textbox').first().fill(`Reunião ${TAG} — Todos`)
  // Início (DateTimePicker: date first, then the segmented time).
  await setDateTimeField(page, dialog, 'Início', { time: '10:00' })

  await dialog.getByRole('button', { name: /Agendar reunião/i }).click()
  await page.waitForURL(/\/meetings\/[0-9a-f-]{36}$/, { timeout: 30_000 })

  // The detail page's "Participantes e quórum" panel lists the convoked members
  // (each row carries a "Convocado" attendance badge).
  await expect(
    page.getByRole('heading', { name: /Participantes e quórum/i }).first(),
  ).toBeVisible({ timeout: 12_000 })
  await expect(page.getByText('Convocado', { exact: true }).first()).toBeVisible({
    timeout: 8_000,
  })
  const meetingId = page.url().match(/meetings\/([0-9a-f-]{36})/)?.[1]
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/meeting_attendees?meeting_id=eq.${meetingId}&select=user_id`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const rows = (await resp.json()) as { user_id: string }[]
  // "Convocar todos" convokes EVERY member of the commission. The
  // `seed_expected_meeting_attendees` RPC inserts one attendee per `memberships`
  // row where `commission_id = <this commission>` (using `principal_id`, deduped
  // by user). Assert the convoked set equals that membership set by IDENTITY
  // rather than a hardcoded count: sibling specs sharing the batch-reset DB
  // (user-registration, hospital-admin) can add CCIH members, so `== 9` is
  // order-dependent (BUG-F3E2E-002). Deriving the expected set from the live
  // catalog keeps the invariant ("all members are convoked") exact regardless of
  // how many members currently exist.
  const membersResp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/memberships?commission_id=eq.${COMM_A}&select=principal_id`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const memberRows = (await membersResp.json()) as { principal_id: string }[]
  const expectedUserIds = new Set(memberRows.map((m) => m.principal_id))
  const convokedUserIds = new Set(rows.map((r) => r.user_id))
  expect(convokedUserIds).toEqual(expectedUserIds)
  // Sanity floor: the seed baseline has 9 CCIH members, so an isolated run is
  // exactly 9; a shared-batch run may be higher — never fewer.
  expect(convokedUserIds.size).toBeGreaterThanOrEqual(9)
})

test('AC-5: Nova reunião — toggle OFF reveals a member checklist + live count; a chosen subset → exactly those Convocados', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/meetings`)

  await page.getByRole('button', { name: /Nova reunião/i }).click()
  const dialog = page.getByRole('dialog', { name: /Nova reunião/i })
  await expect(dialog).toBeVisible({ timeout: 8_000 })

  await dialog.getByRole('textbox').first().fill(`Reunião ${TAG} — Subconjunto`)
  await setDateTimeField(page, dialog, 'Início', { time: '11:00' })

  // Toggle OFF "Convocar todos" → the checklist appears with a live count.
  const convocarTodos = dialog.getByRole('checkbox', {
    name: /Convocar todos os membros/i,
  })
  await convocarTodos.uncheck()

  // The count starts at 9 (all pre-selected), then we reduce it to a subset.
  await expect(dialog.getByText(/\d+\s+membros? convocados?/i)).toBeVisible({
    timeout: 8_000,
  })

  // Deselect all but two members. The member checkboxes are the non-"todos"
  // checkboxes inside the Participantes fieldset.
  const memberChecks = dialog
    .locator('fieldset')
    .filter({ hasText: /Participantes/i })
    .getByRole('checkbox')
  const total = await memberChecks.count()
  // Uncheck from the top until only 2 remain checked (skip the "todos" toggle,
  // which is already off). memberChecks[0] is "Convocar todos" (now unchecked).
  // Members are indices 1..total-1. Uncheck all but the last two members.
  for (let i = 1; i < total - 2; i++) {
    const cb = memberChecks.nth(i)
    if (await cb.isChecked()) await cb.uncheck()
  }
  // Ensure the final two are checked.
  await expect(dialog.getByText(/2\s+membros convocados/i)).toBeVisible({
    timeout: 8_000,
  })

  await dialog.getByRole('button', { name: /Agendar reunião/i }).click()
  await page.waitForURL(/\/meetings\/[0-9a-f-]{36}$/, { timeout: 30_000 })

  await expect(
    page.getByRole('heading', { name: /Participantes e quórum/i }).first(),
  ).toBeVisible({ timeout: 12_000 })
  const meetingId = page.url().match(/meetings\/([0-9a-f-]{36})/)?.[1]
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/meeting_attendees?meeting_id=eq.${meetingId}&select=user_id`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const rows = (await resp.json()) as { user_id: string }[]
  // Exactly the chosen subset (2) is convoked — NOT all 9.
  expect(rows.length).toBe(2)
})

// ---------------------------------------------------------------------------
// KEYBOARD-ONLY (task 9): Tab reaches the "Convocar todos" toggle and every
// member checkbox in the Participantes checklist.
// ---------------------------------------------------------------------------

test('AC-K: keyboard-only — the Participantes toggle + member checklist are reachable by Tab', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/meetings`)

  await page.getByRole('button', { name: /Nova reunião/i }).click()
  const dialog = page.getByRole('dialog', { name: /Nova reunião/i })
  await expect(dialog).toBeVisible({ timeout: 8_000 })

  const convocarTodos = dialog.getByRole('checkbox', {
    name: /Convocar todos os membros/i,
  })
  // Focus + toggle OFF via keyboard (Space) to reveal the checklist.
  await convocarTodos.focus()
  await expect(convocarTodos).toBeFocused()
  await page.keyboard.press('Space')

  // The checklist appears; at least one member checkbox is now focusable via Tab.
  const memberChecks = dialog
    .locator('fieldset')
    .filter({ hasText: /Participantes/i })
    .getByRole('checkbox')
  await expect(memberChecks.nth(1)).toBeVisible({ timeout: 8_000 })
  await memberChecks.nth(1).focus()
  await expect(memberChecks.nth(1)).toBeFocused()
  // Toggling it with the keyboard updates the live count (Space).
  await page.keyboard.press('Space')
  await expect(dialog.getByText(/\d+\s+membros? convocados?/i)).toBeVisible()
})

// ---------------------------------------------------------------------------
// TASK 7 (segmented time in meeting-create) — the "Início" time is the segmented
// react-aria TimeField. Proves the TimeField replaces the native control here.
// ---------------------------------------------------------------------------

test('AC-6a: the meeting-create "Início" time is the segmented TimeField (not native <input type=time> nor a masked text field); a 4-digit entry commits', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/meetings`)

  await page.getByRole('button', { name: /Nova reunião/i }).click()
  const dialog = page.getByRole('dialog', { name: /Nova reunião/i })
  await expect(dialog).toBeVisible({ timeout: 8_000 })

  // No native time input exists (the whole app moved off <input type=time>).
  await expect(dialog.locator('input[type="time"]')).toHaveCount(0)

  // The Início time control is the segmented "Hora" group (hour/minute spinbuttons).
  // Since `ce4744e` ("fix(datetime): don't wrap DateTimePicker in a native label")
  // the "Início" <label> is a SIBLING of the DateTimePicker (wired via htmlFor to
  // the date button, not wrapping it — a native <label> would forward a tap to its
  // first labelable control, stealing focus from the non-labelable time segments).
  // `fieldContainer` resolves the shared parent so the lookup doesn't require the
  // label to be an ancestor of the TimeField (mirrors `setDateTimeField`'s own use
  // of this helper).
  const inicioField = fieldContainer(dialog, 'Início')
  const timeGroup = inicioField.getByRole('group', { name: /^Hora$/i })
  await expect(timeGroup).toBeVisible({ timeout: 8_000 })
  await expect(timeGroup.getByRole('spinbutton')).toHaveCount(2)

  // Controlled DateTimePicker: pick the date first, then fill the segmented time.
  await pickDate(inicioField, page)
  await fillTimeField(timeGroup, page, '09:30')
  await expect(timeGroup).toContainText('09')
  await expect(timeGroup).toContainText('30')
})

// The DateTimePicker helper (date via calendar, time via the segmented TimeField)
// is shared from ./helpers/date-pickers (`setDateTimeField`).
