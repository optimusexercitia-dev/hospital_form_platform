import { test, expect, type Page } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"
import { getPublishedTemplateVersion } from './helpers/process-templates'

/**
 * Case data-model adjustments — Outcomes + Phase Blocking (D1–D4, D8–D15).
 *
 * Acceptance bullets (from the-current-case-data-bright-hartmanis.md):
 *
 * OUTCOMES (D8–D15):
 *   - Outcome vocabulary: create/edit in the Desfechos settings page.
 *   - Process builder: select which outcomes the process offers (draft-only).
 *   - Case conclude gate (D3): "Concluir" is blocked when outcome is required
 *     but not chosen (HC028 from server, pt-BR message in the dialog).
 *   - Conclude with outcome: dialog captures the outcome → case closes → outcome
 *     is stored on the case row.
 *   - Advisory markers: "Evento adverso" / "Requer plano de ação" visible on
 *     the case detail (advisory, do NOT block conclusion — D10).
 *   - Dashboard outcome breakdown (D14): the cases board shows a "Desfechos"
 *     panel with per-outcome counts + % adverse figure.
 *   - Seed fixture: Caso 0002 "Óbito UTI leito 3" is concluido with the adverse
 *     outcome "Óbito evitável" → the dashboard % adverse must reflect it.
 *
 * PHASE BLOCKING (D1/D4) — tested here via the API layer; the UI blocker flow
 * is covered in phase7-cases.spec.ts (AC-BlockerGuard).
 *
 * Seeded fixtures (commission A — CCIH, local Docker):
 *   Caso 0001 (d0000000-…-c1): pendente, 3 offered outcomes (none chosen yet).
 *   Caso 0002 (d0000000-…-c2): concluido + adverse outcome "Óbito evitável".
 *   Outcomes:
 *     e1000000-…-d1  Óbito evitável       (is_adverse=T, requires_action_plan=T)
 *     e1000000-…-d2  Óbito não evitável   (is_adverse=T, requires_action_plan=F)
 *     e1000000-…-d3  Alta sem intercorrências (is_adverse=F, requires_action_plan=F)
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin, commission CCIH (coordinator)
 *   staff1.ccih@test.local  staff, commission CCIH
 *
 * Run with --workers=1. Run `supabase db reset` before each full run.
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
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}

const COMM_CCIH_ID = 'a0000000-0000-0000-0000-0000000000a1'
const OUTCOME_EVITAVEL_ID = 'e1000000-0000-0000-0000-0000000000d1' // adverse + requires action plan
const STAFF1_CCIH_ID = '00000000-0000-0000-0000-000000000003'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, password)
}

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

async function getCaseRow(
  page: Page,
  caseId: string,
): Promise<{ status: string; outcome_id: string | null } | null> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/cases?id=eq.${caseId}&select=status,outcome_id`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const rows = (await resp.json()) as Array<{ status: string; outcome_id: string | null }>
  return rows[0] ?? null
}

async function getCasePhases(
  page: Page,
  caseId: string,
): Promise<Array<{ id: string; status: string; position: number }>> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/case_phases?case_id=eq.${caseId}&order=position.asc&select=id,status,position`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const data = await resp.json()
  return Array.isArray(data) ? data : []
}

async function createFreshCase(page: Page, ownerToken: string, label: string): Promise<string> {
  // ADR 0096: `process_templates.status` is dropped — resolve the published
  // version. `create_case_from_template` still takes the TEMPLATE identity id.
  // `title` is required: CCIH now carries several published templates.
  const tpl = await getPublishedTemplateVersion(
    page.request,
    { baseUrl: SUPABASE_URL, apikey: SUPABASE_SERVICE_KEY, bearerToken: ownerToken },
    COMM_CCIH_ID,
    'Investigação de Óbito (M&M)',
  )

  const createResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/create_case_from_template`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_template_id: tpl.templateId, p_label: label },
    },
  )
  expect(createResp.ok()).toBeTruthy()
  const caseObj = (await createResp.json()) as { id: string }
  return caseObj.id
}

// ---------------------------------------------------------------------------
// AC-OutcomeSettings: coordinator creates an outcome in the Desfechos settings
// page; it appears in the vocabulary.
// ---------------------------------------------------------------------------

test('AC-OutcomeSettings: coordinator creates an outcome in Desfechos settings; it appears in the vocabulary list', async ({
  page,
}) => {
  test.setTimeout(90_000)

  await signInAs(page, 'chefe.ccih@test.local')

  await page.goto('/o/rede-a/c/ccih/manage/settings/desfechos')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/settings/desfechos', { timeout: 15_000 })

  // The seeded outcomes should be visible (Óbito evitável etc.).
  await expect(page.getByText(/Óbito evitável/i)).toBeVisible({ timeout: 10_000 })

  // Create a new outcome.
  const newOutcomeLabel = `Complicação E2E ${Date.now()}`
  await page.getByRole('button', { name: /Novo desfecho/i }).click()
  const createDialog = page.getByRole('dialog').filter({ hasText: /Novo desfecho/i })
  await expect(createDialog).toBeVisible({ timeout: 10_000 })

  await createDialog.getByLabel(/Nome/i).fill(newOutcomeLabel)

  // Mark as adverse (optional — tests the toggle rendering).
  const adverseCheckbox = createDialog.getByRole('checkbox', { name: /Evento adverso/i })
  if (await adverseCheckbox.isVisible().catch(() => false)) {
    await adverseCheckbox.check()
  }

  await createDialog.getByRole('button', { name: /Criar/i }).click()
  await expect(createDialog).toHaveCount(0, { timeout: 15_000 })

  // The new outcome appears in the settings list.
  await expect(page.getByText(newOutcomeLabel)).toBeVisible({ timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// AC-OutcomeSelector: case detail shows the outcome selector for non-terminal
// cases; the selector displays only the case's offered outcomes (D15 frozen
// snapshot); picking one saves it; advisory markers show correctly.
// ---------------------------------------------------------------------------

test('AC-OutcomeSelector: case detail shows the offered outcome selector; pick one saves it; advisory markers display for adverse + action-plan outcomes', async ({
  page,
}) => {
  test.setTimeout(90_000)

  // Create a fresh non-terminal case (avoids depending on the seeded Caso 0001
  // being in a non-terminal state — AC-HappyPath in phase7-cases.spec.ts
  // concludes Caso 0001 when the full suite runs in order).
  const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const caseId = await createFreshCase(page, ownerToken, `OutcomeSelector ${Date.now()}`)

  await signInAs(page, 'chefe.ccih@test.local')

  await page.goto(`/o/rede-a/c/ccih/manage/cases/${caseId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${caseId}`), { timeout: 15_000 })
  await page.waitForLoadState('networkidle', { timeout: 15_000 })

  // CaseOutcomeSelector renders a <section aria-labelledby="case-outcome-heading">
  // with <h2>Desfecho do caso</h2> and <select aria-label="Desfecho do caso">.
  // The section renders only for non-terminal cases with offered outcomes (D15).
  // Use getByText to locate the heading (avoids strict-mode role+name collision).
  await expect(page.getByText('Desfecho do caso')).toBeVisible({ timeout: 15_000 })

  // The <select aria-label="Desfecho do caso"> is the offered-outcome picker.
  // Scope into the <section> (region labeled by the heading) to avoid strict mode
  // violation (both the section and the select share the accessible name).
  const outcomeSection = page.getByRole('region', { name: 'Desfecho do caso' })
  await expect(outcomeSection).toBeVisible({ timeout: 10_000 })
  const outcomeSelect = outcomeSection.locator('select')
  await expect(outcomeSelect).toBeVisible({ timeout: 10_000 })

  // The offered outcomes include the three seeded ones; verify they appear as options.
  const opts = await outcomeSelect.locator('option:not([value=""])').all()
  expect(opts.length).toBeGreaterThanOrEqual(3)

  // Pick "Óbito evitável" (is_adverse=T, requires_action_plan=T) — the advisory
  // markers (D10, informational only) must appear after selection.
  await outcomeSelect.selectOption({ value: OUTCOME_EVITAVEL_ID })

  // After picking the adverse outcome, the advisory markers become visible.
  // Both Requer plano de ação and Evento adverso render as inline spans when
  // selected.requiresActionPlan / selected.isAdverse are true (CaseOutcomeSelector).
  await expect(page.getByText('Requer plano de ação')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Evento adverso')).toBeVisible({ timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// AC-ConcludeGate: the "Concluir" dialog blocks conclusion when the outcome is
// required but not chosen (HC028 from the server, pt-BR error message in the
// dialog); D3.
// ---------------------------------------------------------------------------

test('AC-ConcludeGate: Concluir blocked (HC028 pt-BR) when offered-outcome case has no outcome; succeeds after outcome is chosen', async ({
  page,
}) => {
  test.setTimeout(120_000)

  // Create a fresh case and skip all phases so the HC031 (unsettled phases) gate passes.
  const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const caseId = await createFreshCase(page, ownerToken, `ConcludeGate ${Date.now()}`)

  const phases = await getCasePhases(page, caseId)
  for (const ph of phases) {
    await page.request.post(
      `${SUPABASE_URL}/rest/v1/rpc/skip_phase`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json',
        },
        data: { p_case_phase_id: ph.id },
      },
    )
  }

  // ── API layer: close_case with no outcome → HC028 ──
  const closeNoOutcomeResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/close_case`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_case_id: caseId },
    },
  )
  expect(closeNoOutcomeResp.ok()).toBeFalsy()
  const noOutcomeBody = (await closeNoOutcomeResp.json()) as { code?: string }
  expect(noOutcomeBody.code).toBe('HC028')

  // ── UI layer: "Concluir" dialog shows a pt-BR error when no outcome is chosen ──
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${caseId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${caseId}`), { timeout: 15_000 })

  // The lifecycle "Concluir" button lives in the page <header> (CaseLifecycleActions).
  // Scope to <header> to avoid strict-mode conflicts with narrative "Concluir" buttons
  // rendered in the page body (ConcludeNarrativeButton, one per narrative slot — the
  // case-access increment added narrative cards to the case detail page, ADR 0033).
  const concludeBtn = page.locator('header').getByRole('button', { name: /^Concluir$/i })
  await expect(concludeBtn).toBeVisible({ timeout: 10_000 })
  await concludeBtn.click()

  const concludeDialog = page.getByRole('dialog').filter({ hasText: /Concluir o caso/i })
  await expect(concludeDialog).toBeVisible({ timeout: 10_000 })

  // The outcome selector is present (case has offered outcomes).
  const outcomeSelect = concludeDialog.locator('select')
  await expect(outcomeSelect).toBeVisible({ timeout: 5_000 })

  // The "Concluir caso" confirm button is DISABLED when no outcome is selected
  // (the client-side gate mirrors the HC028 server gate, mirrored in ConcludeCaseDialog).
  const confirmBtn = concludeDialog.getByRole('button', { name: /Concluir caso/i })
  await expect(confirmBtn).toBeDisabled({ timeout: 5_000 })

  // ── Now pick an outcome in the dialog — the button becomes enabled ──
  const opts = await outcomeSelect.locator('option:not([value=""])').all()
  expect(opts.length).toBeGreaterThan(0)
  const firstVal = await opts[0].getAttribute('value') ?? ''
  await outcomeSelect.selectOption({ value: firstVal })

  await expect(confirmBtn).toBeEnabled({ timeout: 5_000 })
  await confirmBtn.click()
  await expect(concludeDialog).toHaveCount(0, { timeout: 15_000 })

  // ── DB truth: case is concluido + outcome_id is set ──
  await expect
    .poll(async () => (await getCaseRow(page, caseId))?.status, { timeout: 15_000 })
    .toBe('completed')

  const finalRow = await getCaseRow(page, caseId)
  expect(finalRow?.outcome_id).toBeTruthy()
})

// ---------------------------------------------------------------------------
// AC-OutcomeFlow: full end-to-end outcome flow.
// Creates a case from the seeded M&M template (offers 3 outcomes), skips phases,
// concludes with the adverse "Óbito evitável" outcome, then verifies:
//   1. The case has status=concluido + outcome_id set.
//   2. The board reflects the outcome (chip visible in the table row).
//   3. The dashboard "Desfechos" panel shows ≥1 adverse + a % adverse figure.
// ---------------------------------------------------------------------------

test('AC-OutcomeFlow: conclude with adverse outcome → case has outcome_id → dashboard shows % adverse', async ({
  page,
}) => {
  test.setTimeout(180_000)

  const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const caseId = await createFreshCase(page, ownerToken, `OutcomeFlow ${Date.now()}`)

  // Skip all phases.
  const phases = await getCasePhases(page, caseId)
  for (const ph of phases) {
    await page.request.post(
      `${SUPABASE_URL}/rest/v1/rpc/skip_phase`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json',
        },
        data: { p_case_phase_id: ph.id },
      },
    )
  }

  // Set the adverse outcome via the detail page.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${caseId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${caseId}`), { timeout: 15_000 })

  // ── Open "Concluir" dialog → pick the adverse outcome ──
  // Scope to <header> (CaseLifecycleActions) to avoid strict-mode conflict with
  // narrative Concluir buttons in the page body (case-access increment, ADR 0033).
  const concludeBtn = page.locator('header').getByRole('button', { name: /^Concluir$/i })
  await expect(concludeBtn).toBeVisible({ timeout: 10_000 })
  await concludeBtn.click()

  const concludeDialog = page.getByRole('dialog').filter({ hasText: /Concluir o caso/i })
  await expect(concludeDialog).toBeVisible({ timeout: 10_000 })

  const outcomeSelect = concludeDialog.locator('select')
  await expect(outcomeSelect).toBeVisible({ timeout: 5_000 })

  // Pick "Óbito evitável" (adverse + requires action plan).
  await outcomeSelect.selectOption({ value: OUTCOME_EVITAVEL_ID })

  // Advisory markers appear in the dialog.
  await expect(concludeDialog.getByText(/Requer plano de ação/i)).toBeVisible({ timeout: 5_000 })
  await expect(concludeDialog.getByText(/Evento adverso/i)).toBeVisible({ timeout: 5_000 })

  await concludeDialog.getByRole('button', { name: /Concluir caso/i }).click()
  await expect(concludeDialog).toHaveCount(0, { timeout: 15_000 })

  // ── DB truth: concluido + outcome_id = Óbito evitável ──
  await expect
    .poll(async () => (await getCaseRow(page, caseId))?.status, { timeout: 15_000 })
    .toBe('completed')

  const finalRow = await getCaseRow(page, caseId)
  expect(finalRow?.outcome_id).toBe(OUTCOME_EVITAVEL_ID)

  // ── Board: the concluded case row shows the outcome chip ──
  await page.goto('/o/rede-a/c/ccih/manage/cases')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/cases', { timeout: 15_000 })
  await page.waitForLoadState('networkidle', { timeout: 15_000 })

  // The "Desfecho" quick-filter chip is visible (at least one case has an outcome
  // — both the newly concluded case and the seeded Caso 0002 carry outcomes).
  // ⚠ It is a POPOVER TRIGGER now, not a <select>: the board redesign replaced the
  // native combobox with a drop-chip whose accessible name is "Desfecho" while unset
  // and "Desfecho: <label>" once a value is chosen.
  const quickFilters = page.getByRole('group', { name: 'Filtros rápidos' })
  await expect(
    quickFilters.getByRole('button', { name: /^Desfecho/ }),
  ).toBeVisible({ timeout: 15_000 })

  // ── Dashboard "Desfechos" outcome breakdown panel (D14) ──
  await page.goto('/o/rede-a/c/ccih/manage/cases')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/cases', { timeout: 15_000 })
  await page.waitForLoadState('networkidle', { timeout: 15_000 })

  // The breakdown section. ⚠ It is a COLLAPSIBLE ONE-LINE STRIP since the board
  // redesign, not a full panel: the header carries the mix bar + the adverse share,
  // and the per-outcome rows only exist in the DOM once it is expanded.
  const breakdownSection = page.getByRole('region', { name: /Desfechos/i })
  await expect(breakdownSection).toBeVisible({ timeout: 15_000 })

  // The header states the adverse share WITH its denominator — "NN% adversos (a/n)".
  // Asserted as one pattern rather than "some element ending in %", because the
  // percentage and the denominator now live in a single span.
  await expect(
    breakdownSection.getByText(/\d+% adversos \(\d+\/\d+\)/),
  ).toBeVisible({ timeout: 10_000 })

  // Expand it: the per-outcome rows (badge + "ADVERSO" marker) are behind the toggle.
  const breakdownToggle = breakdownSection.getByRole('button', { name: /Desfechos/i })
  await expect(breakdownToggle).toHaveAttribute('aria-expanded', 'false')
  await breakdownToggle.click()
  await expect(breakdownToggle).toHaveAttribute('aria-expanded', 'true', { timeout: 5_000 })

  // At least one expanded row carries the uppercase "ADVERSO" marker.
  await expect(
    breakdownSection.getByText('Adverso', { exact: true }).first(),
  ).toBeVisible({ timeout: 5_000 })
})

// ---------------------------------------------------------------------------
// AC-OutcomeFilter: the "Apenas desfechos adversos" switch filters the cases list
// to show only cases with adverse outcomes (D14). The "Desfecho" chip also filters.
//
// ⚠ REWRITTEN for the board redesign. Both controls moved:
//   - "Apenas adversos" is now the "Apenas desfechos adversos" SWITCH inside the
//     "Filtros avançados" sheet, which edits a DRAFT and commits on "Aplicar filtros".
//   - The outcome `<select>` is now a POPOVER drop-chip.
// The assertions are the same propositions, read off the new affordances.
// ---------------------------------------------------------------------------

test('AC-OutcomeFilter: the adverse-outcome switch shows only adverse cases; the Desfecho chip filters by a specific outcome', async ({
  page,
}) => {
  test.setTimeout(90_000)

  // The seeded Caso 0002 has an adverse outcome ("Óbito evitável"). The board
  // loads cases including Caso 0002 (concluido). With the adverse switch on,
  // only adverse-outcome cases appear.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/cases')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/cases', { timeout: 15_000 })
  await page.waitForLoadState('networkidle', { timeout: 15_000 })

  // The board's result count is a `role="status"` live region — the ONLY reliable
  // handle for it now that KPI sub-lines ("em 13 casos") also read as "N casos".
  const countText = page.getByRole('status').filter({ hasText: /casos?$/ })
  await expect(countText).toBeVisible({ timeout: 15_000 })
  const readCount = async () =>
    parseInt((await countText.textContent() ?? '').match(/(\d+)/)?.[1] ?? '0', 10)
  const unfilteredCount = await readCount()
  expect(unfilteredCount).toBeGreaterThan(0)

  const quickFilters = page.getByRole('group', { name: 'Filtros rápidos' })

  // ── The adverse switch, inside "Filtros avançados" ──
  await quickFilters.getByRole('button', { name: /Mais filtros/ }).click()
  const panel = page.getByRole('dialog', { name: /Filtros avançados/ })
  await expect(panel).toBeVisible({ timeout: 10_000 })

  const adverseSwitch = panel.getByRole('switch', { name: /Apenas desfechos adversos/i })
  await expect(adverseSwitch).toBeVisible({ timeout: 5_000 })
  await adverseSwitch.click()
  await expect(adverseSwitch).toBeChecked({ timeout: 5_000 })
  await panel.getByRole('button', { name: /Aplicar filtros/ }).click()
  await expect(panel).toHaveCount(0, { timeout: 10_000 })

  // After applying, count must be ≤ unfiltered count.
  const filteredCount = await readCount()
  expect(filteredCount).toBeLessThanOrEqual(unfilteredCount)

  // The seeded Caso 0002 (adverse outcome) must still be visible.
  await expect(page.getByText(/Óbito UTI leito 3/i)).toBeVisible({ timeout: 5_000 })

  // Clearing every filter restores the full board. The summary bar's "Limpar tudo" is
  // the affordance the redesign gives for that.
  await page.getByRole('button', { name: /Limpar tudo/ }).click()
  await expect
    .poll(readCount, { timeout: 10_000 })
    .toBe(unfilteredCount)

  // ── Outcome drop-chip filter ──
  // Unset, the chip's accessible name is bare "Desfecho"; it becomes
  // "Desfecho: <label>" once a value is chosen.
  const outcomeChip = quickFilters.getByRole('button', { name: /^Desfecho/ })
  await expect(outcomeChip).toBeVisible({ timeout: 5_000 })
  await outcomeChip.click()

  // Filter by "Sem desfecho" — cases without an outcome assigned.
  await page.getByRole('button', { name: 'Sem desfecho', exact: true }).click()
  await expect(
    quickFilters.getByRole('button', { name: 'Desfecho: Sem desfecho' }),
  ).toBeVisible({ timeout: 5_000 })

  // Caso 0002 has an outcome, so the sem-desfecho count must be less than total —
  // and, unlike the old assertion, STRICTLY less: at least one case is excluded.
  await expect.poll(readCount, { timeout: 10_000 }).toBeLessThan(unfilteredCount)
  await expect(page.getByText(/Óbito UTI leito 3/i)).toHaveCount(0, { timeout: 5_000 })
})

// ---------------------------------------------------------------------------
// AC-D15-NoOutcome: when a process offers NO outcomes, its cases can be
// concluded without an outcome (D15 optional). Verified via the API.
// ---------------------------------------------------------------------------

test('AC-D15-NoOutcome: a process offering no outcomes lets the case conclude without one (D15 optional)', async ({
  page,
}) => {
  test.setTimeout(90_000)

  // Build a minimal 1-phase template that offers NO outcomes.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/process-templates')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/process-templates', { timeout: 15_000 })

  const suffix = Date.now()
  const tplTitle = `Sem Desfecho E2E ${suffix}`

  await page.getByRole('button', { name: /Novo processo/i }).click()
  const createDialog = page.getByRole('dialog').filter({ hasText: /Novo processo/i })
  await expect(createDialog).toBeVisible({ timeout: 10_000 })
  await createDialog.getByLabel(/Título/i).fill(tplTitle)
  await createDialog.getByRole('button', { name: /Criar processo/i }).click()
  await page.waitForURL(/\/manage\/process-templates\/[0-9a-f-]{36}/, { timeout: 20_000 })

  // Add one phase.
  await page.getByRole('button', { name: /Adicionar fase/i }).first().click()
  const slotDialog = page.getByRole('dialog').filter({ hasText: /Nova fase/i })
  await expect(slotDialog).toBeVisible({ timeout: 10_000 })
  await slotDialog.locator('select[name="formId"]').selectOption({ label: 'Checklist de Higienização das Mãos' })
  await slotDialog.locator('input[name="title"]').fill('Fase Única')
  await slotDialog.getByRole('button', { name: /Adicionar fase/i }).click()
  await expect(slotDialog).toHaveCount(0, { timeout: 15_000 })

  // Do NOT set any offered outcomes (D15: optional) — the process picker is ignored.
  // Publish. ADR 0096 D2: trigger reads "Publicar versão 1"; the alertdialog's
  // confirm button is still bare "Publicar".
  await page.getByRole('button', { name: /^Publicar versão 1$/i }).click()
  const confirmPub = page.getByRole('alertdialog')
  await expect(confirmPub).toBeVisible({ timeout: 10_000 })
  await confirmPub.getByRole('button', { name: /^Publicar$/i }).click()
  await expect(page.getByText(/Versão 1 — em vigor/i).first()).toBeVisible({ timeout: 15_000 })

  const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')

  // Resolve the template id. `status`/`title` moved off `process_templates` onto
  // `process_template_versions` (ADR 0096 D1).
  const tpl = await getPublishedTemplateVersion(
    page.request,
    { baseUrl: SUPABASE_URL, apikey: SUPABASE_SERVICE_KEY, bearerToken: ownerToken },
    COMM_CCIH_ID,
    tplTitle,
  )

  const createCaseResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/create_case_from_template`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_template_id: tpl.templateId, p_label: `Sem Desfecho Case ${suffix}` },
    },
  )
  expect(createCaseResp.ok()).toBeTruthy()
  const newCaseId = ((await createCaseResp.json()) as { id: string }).id

  // Skip the single phase.
  const phases = await getCasePhases(page, newCaseId)
  for (const ph of phases) {
    await page.request.post(
      `${SUPABASE_URL}/rest/v1/rpc/skip_phase`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json',
        },
        data: { p_case_phase_id: ph.id },
      },
    )
  }

  // Close with no outcome → must succeed (D15).
  const closeResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/close_case`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_case_id: newCaseId },
    },
  )
  expect(closeResp.ok()).toBeTruthy()

  const finalRow = await getCaseRow(page, newCaseId)
  expect(finalRow?.status).toBe('completed')
  expect(finalRow?.outcome_id).toBeNull() // D15: no outcome required

  // ── UI layer: the conclude dialog for a no-outcome process has no selector ──
  // Create ANOTHER case from the same no-outcome template to test UI.
  const createCase2Resp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/create_case_from_template`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_template_id: tpl.templateId, p_label: `Sem Desfecho UI ${suffix}` },
    },
  )
  expect(createCase2Resp.ok()).toBeTruthy()
  const case2Id = ((await createCase2Resp.json()) as { id: string }).id

  // Skip phases on case 2.
  const phases2 = await getCasePhases(page, case2Id)
  for (const ph of phases2) {
    await page.request.post(
      `${SUPABASE_URL}/rest/v1/rpc/skip_phase`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json',
        },
        data: { p_case_phase_id: ph.id },
      },
    )
  }

  await page.goto(`/o/rede-a/c/ccih/manage/cases/${case2Id}`)
  await page.waitForURL(new RegExp(`/manage/cases/${case2Id}`), { timeout: 15_000 })

  // Scope to <header> (CaseLifecycleActions) to avoid strict-mode conflict with
  // narrative Concluir buttons in the page body (case-access increment, ADR 0033).
  const concludeBtn = page.locator('header').getByRole('button', { name: /^Concluir$/i })
  await expect(concludeBtn).toBeVisible({ timeout: 10_000 })
  await concludeBtn.click()

  const concludeDialog = page.getByRole('dialog').filter({ hasText: /Concluir o caso/i })
  await expect(concludeDialog).toBeVisible({ timeout: 10_000 })

  // No outcome selector (D15: the process offers none).
  // The dialog text should mention the plain-conclude path (no outcome picker).
  const outcomeSelect = concludeDialog.locator('select')
  await expect(outcomeSelect).toHaveCount(0, { timeout: 5_000 })

  // The confirm button is immediately enabled (no outcome required).
  const confirmBtn = concludeDialog.getByRole('button', { name: /Concluir caso/i })
  await expect(confirmBtn).toBeEnabled({ timeout: 5_000 })
  await confirmBtn.click()
  await expect(concludeDialog).toHaveCount(0, { timeout: 15_000 })

  await expect
    .poll(async () => (await getCaseRow(page, case2Id))?.status, { timeout: 15_000 })
    .toBe('completed')
})

// ---------------------------------------------------------------------------
// AC-CancelAnytime: "Cancelar" works regardless of phase state (D3 — Cancelar
// anytime; outcome not required). HC025 blocks all subsequent mutations.
// ---------------------------------------------------------------------------

test('AC-CancelAnytime: "Cancelar" works even when phases are unsettled (D3); case is terminal; HC025 thereafter', async ({
  page,
}) => {
  test.setTimeout(90_000)

  const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const caseId = await createFreshCase(page, ownerToken, `CancelAnytime ${Date.now()}`)

  // Do NOT skip phases — verify Cancelar works with open phases.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${caseId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${caseId}`), { timeout: 15_000 })

  // The "Cancelar" button must be visible.
  const cancelBtn = page.getByRole('button', { name: /^Cancelar$/i })
  await expect(cancelBtn).toBeVisible({ timeout: 10_000 })
  await cancelBtn.click()

  // The cancel confirm AlertDialog opens.
  const cancelConfirm = page.getByRole('alertdialog')
  await expect(cancelConfirm).toBeVisible({ timeout: 10_000 })
  await expect(cancelConfirm).toContainText(/Cancelado/i)

  await cancelConfirm.getByRole('button', { name: /Cancelar caso/i }).click()
  await expect(cancelConfirm).toHaveCount(0, { timeout: 15_000 })

  // DB truth: case is cancelado.
  await expect
    .poll(async () => (await getCaseRow(page, caseId))?.status, { timeout: 15_000 })
    .toBe('cancelled')

  // ── HC025: trying to activate a phase on the canceled case is rejected ──
  const phasesAfter = await getCasePhases(page, caseId)
  const activateResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/activate_phase`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_case_phase_id: phasesAfter[0].id, p_assigned_to: STAFF1_CCIH_ID },
    },
  )
  expect(activateResp.ok()).toBeFalsy()
  const body = (await activateResp.json()) as { code?: string }
  // activate_phase rejects terminal cases with HC020 ("case not open") — its own
  // early-exit guard fires before the generic HC025 trigger on the cases row.
  expect(body.code).toBe('HC020')

  // The case detail page shows "Cancelado" badge (fixed status label).
  await page.reload()
  await expect(page.getByText(/Cancelado/i).first()).toBeVisible({ timeout: 10_000 })

  // The "Concluir" and "Cancelar" lifecycle buttons are gone on a terminal case.
  await expect(page.getByRole('button', { name: /^Concluir$/i })).toHaveCount(0, { timeout: 5_000 })
  await expect(page.getByRole('button', { name: /^Cancelar$/i })).toHaveCount(0, { timeout: 5_000 })
})

// ---------------------------------------------------------------------------
// AC-SeedDashboard: the seeded Caso 0002 (concluido + adverse outcome) causes
// the "Desfechos" panel on the cases board to show ≥1 case + adversePercent > 0.
// This is derived from the seeded data alone (no new case created here).
// ---------------------------------------------------------------------------

test('AC-SeedDashboard: seeded Caso 0002 (adverse outcome) causes the Desfechos panel to show ≥1 adverse + % adverse > 0', async ({
  page,
}) => {
  test.setTimeout(60_000)

  // Verify the seed data is correct: Caso 0002 has an adverse outcome.
  const caseRow = await getCaseRow(page, 'd0000000-0000-0000-0000-0000000000c2')
  expect(caseRow?.status).toBe('completed')
  expect(caseRow?.outcome_id).toBe(OUTCOME_EVITAVEL_ID) // Óbito evitável (adverse)

  // Navigate to the cases board as coordinator.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/cases')
  await page.waitForURL('**/o/rede-a/c/ccih/manage/cases', { timeout: 15_000 })
  await page.waitForLoadState('networkidle', { timeout: 15_000 })

  // The "Desfechos" breakdown section must be visible (≥1 case has an outcome).
  const breakdownSection = page.getByRole('region', { name: /Desfechos/i })
  await expect(breakdownSection).toBeVisible({ timeout: 15_000 })

  // ⚠ REWRITTEN for the board redesign. The breakdown is a COLLAPSIBLE ONE-LINE
  // STRIP now: the adverse share lives in the header and the per-outcome rows only
  // exist in the DOM once it is expanded. The old locator keyed on the removed
  // panel's `p.text-[1.4rem]` class — a class-based hook that could not survive a
  // restyle — so it is replaced by the rendered SENTENCE.
  //
  // The header reads "NN% adversos (a/n)". NN must be non-zero (Caso 0002 is adverse)
  // AND the denominator must be there: a share alone never says what it is a share of.
  const adverseHeadline = breakdownSection.getByText(/\d+% adversos \(\d+\/\d+\)/)
  await expect(adverseHeadline).toBeVisible({ timeout: 10_000 })
  expect(await adverseHeadline.textContent() ?? '').toMatch(
    /[1-9]\d*% adversos \(\d+\/\d+\)/,
  )

  // Expand the strip — the per-outcome rows are behind the toggle.
  const breakdownToggle = breakdownSection.getByRole('button', { name: /Desfechos/i })
  await breakdownToggle.click()
  await expect(breakdownToggle).toHaveAttribute('aria-expanded', 'true', { timeout: 5_000 })

  // The seeded outcome label "Óbito evitável" must appear in the breakdown rows.
  await expect(breakdownSection.getByText(/Óbito evitável/i)).toBeVisible({ timeout: 5_000 })

  // …carrying the uppercase "ADVERSO" row marker. `exact: true` is what separates it
  // from the header's "adversos"; the old /Adverso/i + .first() could match either,
  // so it would have passed with the marker missing entirely.
  await expect(
    breakdownSection.getByText('Adverso', { exact: true }).first(),
  ).toBeVisible({ timeout: 5_000 })
})
