import { test, expect, type Page, type Locator, type APIRequestContext } from '@playwright/test'

import { pasteText, toTsv } from './helpers/clipboard'
import { cachedSignIn } from "./helpers/auth"

/**
 * "Múltiplos casos" — bulk case creation wizard (ADR 0084; plan
 * `~/.claude/plans/task-notification-task-id-af04525c590b8-merry-canyon.md`).
 *
 * A `staff_admin` picks one ACTIVE, ≥1-phase process template, fills a grid of
 * cases (typed or pasted from a spreadsheet), previews a balanced deal across
 * chosen commission members, and commits — one atomic `bulk_create_cases` RPC
 * that composes `create_case_from_template` + `activate_phase` per row, with
 * optional per-row PHI (E1: individually-selectable identifier columns).
 *
 * Acceptance criteria under test (spawn prompt numbering, so failures map
 * straight back to it):
 *   AC1  Access gate — staff_admin sees the button + opens the wizard; a plain
 *        staff member does not, and 404s on the route directly.
 *   AC2  Happy path — Step 1 (fields/deadline/scope/prefix) → Step 2 (members)
 *        → Step 3 grid (≥2 rows, exercised via PASTE) → Step 4 deal preview →
 *        commit → the batch appears on the board.
 *   AC3  `first_only` vs `all_phases` yield the right assignment shape (first
 *        phase active+assigned always; downstream phase + every narrative
 *        unassigned vs pre-assigned to the same owner).
 *   AC4  The deadline rides the FIRST phase's due_date only, in both scopes.
 *   AC5  E1 — the Step 1 PHI column picker (default Nome+Prontuário), the
 *        name-or-MRN floor gate, and that PHI is actually written.
 *   AC6  Balanced deal: N cases across M members, max gap ≤1; re-shuffle keeps
 *        the invariant; a manual per-case override is honored VERBATIM by the
 *        server (no server-side re-randomization).
 *   AC7  >200 rows is blocked client-side; exactly 200 is not.
 *   AC8  One keyboard-only pass over the grid (row removal + every cell type).
 *
 * Seeded fixtures used (supabase/seed.sql, commission A / CCIH):
 *   "Investigação de Óbito (M&M)"  — active, collects_patient=true, 2 phases
 *     (no custom fields). Its id is `gen_random_uuid()` in the seed (NOT
 *     deterministic across resets), so this file always selects it by its
 *     visible template-select LABEL, never a hardcoded id.
 *   "Descritores de Óbito (Campos Personalizados)" — id d0cf0000-…-f1
 *     (deterministic), active, collects_patient=false, 1 phase, one REQUIRED
 *     short_text field (numero_declaracao_obito) + one optional dropdown
 *     (turno_obito, manha/tarde/noite).
 * Both templates are ACTIVE with ≥1 phase, so both are bulk-eligible — see
 * the fixture-gap note at the bottom of this header.
 *
 * Flags (all confirmed ON against the local stack — `cases_bulk_create`,
 * `cases_multi_phase`, `case_patient`, `case_custom_fields`, `case_narratives`):
 * `cases_bulk_create` defaults OFF in its migration and is forced ON by
 * seed.sql for local/E2E; the other four default ON in baseline.
 *
 * Personas (password Test1234!): chefe.ccih@test.local (staff_admin, CCIH,
 * uid …002) creates every batch in this file; staff1.ccih@test.local (plain
 * staff, uid …003, no Administrativo standing under any flag state) is the
 * negative persona for AC1.
 *
 * Every test uses its OWN unique label prefix (`E2EBulk<tag><timestamp>`) and
 * looks its cases up by that EXACT label — never a global board row count —
 * so the file is safe under `fullyParallel` and under the shared prod-build
 * gate's per-BATCH (not per-test) reset (cases-board-access.spec.ts's header
 * documents why a bare row count is not a valid authorization/identity proof
 * in that environment; the same reasoning applies to "did my batch land").
 *
 * FIXTURE GAP (flagged per the spawn brief, not invented): no seeded template
 * has BOTH collects_patient=true AND custom fields, so AC2/AC5's PHI-write
 * coverage (M&M) and AC8's custom-field-grid coverage (Descritores) run
 * against different templates rather than one combined row. This does not
 * weaken either assertion (each column family is independently exercised end
 * to end), but a single combined-fixture template would let one test cover
 * both in the same row.
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

const PW = 'Test1234!'
const ORG = 'rede-a'
const SLUG = 'ccih'
const BASE = `/o/${ORG}/c/${SLUG}`
const WIZARD_URL = `${BASE}/manage/cases/multiplos`
const BOARD_URL = `${BASE}/manage/cases`

const CHEFE_CCIH = 'chefe.ccih@test.local'
const STAFF1_CCIH = 'staff1.ccih@test.local'

const COMM_A = 'a0000000-0000-0000-0000-0000000000a1' // CCIH
const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002' // chefe.ccih (staff_admin)
const UID_STAFF1_CCIH = '00000000-0000-0000-0000-000000000003' // staff1.ccih (plain staff)

const MM_TEMPLATE_TITLE = 'Investigação de Óbito (M&M)' // id is gen_random_uuid() in the seed
const TEMPLATE_CF_ID = 'd0cf0000-0000-0000-0000-0000000000f1' // "Descritores de Óbito (Campos Personalizados)"
const CF_REQUIRED_LABEL = 'Número da Declaração de Óbito'
const CF_OPTIONAL_LABEL = 'Turno do óbito'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---------------------------------------------------------------------------
// Auth + REST helpers (mirrors case-custom-fields.spec.ts / case-patient.spec.ts)
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = PW) {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, password)
}

/** Service-role GET against PostgREST. */
async function restGet<T>(req: APIRequestContext, path: string): Promise<T[]> {
  const resp = await req.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  expect(resp.ok(), `restGet(${path}) failed: ${await resp.text()}`).toBeTruthy()
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

interface CaseRow {
  id: string
  status: string
  patient_enabled: boolean
  case_number: number
}

/** Resolve a bulk-created case by its EXACT label (never a global count). */
async function caseByLabel(req: APIRequestContext, label: string): Promise<CaseRow> {
  const rows = await restGet<CaseRow>(
    req,
    `cases?commission_id=eq.${COMM_A}&label=eq.${encodeURIComponent(label)}&select=id,status,patient_enabled,case_number`,
  )
  expect(rows, `no case found with label "${label}"`).toHaveLength(1)
  return rows[0]
}

interface PhaseRow {
  id: string
  position: number
  status: string
  assigned_to: string | null
  due_date: string | null
}

/** A case's phases, ordered by position (1 = first). */
async function phasesFor(req: APIRequestContext, caseId: string): Promise<PhaseRow[]> {
  return restGet<PhaseRow>(
    req,
    `case_phases?case_id=eq.${caseId}&select=id,position,status,assigned_to,due_date&order=position.asc`,
  )
}

interface NarrativeRow {
  id: string
  assigned_to: string | null
}

async function narrativesFor(req: APIRequestContext, caseId: string): Promise<NarrativeRow[]> {
  return restGet<NarrativeRow>(
    req,
    `case_narratives?case_id=eq.${caseId}&select=id,assigned_to`,
  )
}

interface IdentifiersRow {
  name: string | null
  mrn: string | null
}

/**
 * Resolve a case's patient identifiers via the participant layer (ADR
 * 0064/0066): case_participants (case_id → participant_id) → the participant
 * that owns a patient_identifiers row. Service-role read bypasses the Class-1
 * REVOKE (same pattern as case-patient.spec.ts). Returns `null` if the case
 * carries no identifiers.
 */
async function identifiersFor(
  req: APIRequestContext,
  caseId: string,
): Promise<IdentifiersRow | null> {
  const links = await restGet<{ participant_id: string }>(
    req,
    `case_participants?case_id=eq.${caseId}&removed_at=is.null&select=participant_id`,
  )
  if (links.length === 0) return null
  const ids = links.map((l) => l.participant_id)
  const rows = await restGet<IdentifiersRow>(
    req,
    `patient_identifiers?participant_id=in.(${ids.join(',')})&select=name,mrn`,
  )
  return rows[0] ?? null
}

/** A fresh, ilike-safe label prefix scoping this test's cases (never collides). */
function uniquePrefix(tag: string): string {
  return `E2EBulk${tag}${Date.now()}`
}

/** `YYYY-MM-DD` `daysFromNow` days out — always future-safe, never hardcoded. */
function futureDateIso(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Wizard UI helpers
// ---------------------------------------------------------------------------

function continuarButton(page: Page): Locator {
  return page.getByRole('button', { name: /^Continuar$/ })
}

function templateSelect(page: Page): Locator {
  return page.locator('#bulk-template')
}

function phiGroup(page: Page): Locator {
  return page.getByRole('group', { name: /identificadores do paciente/i })
}

function customFieldsGroup(page: Page): Locator {
  return page.getByRole('group', { name: /campos personalizados \(colunas da grade\)/i })
}

function gridRows(page: Page): Locator {
  return page.locator('table tbody tr')
}

async function gotoWizard(page: Page) {
  await page.goto(WIZARD_URL)
  await page.waitForURL('**/manage/cases/multiplos', { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Processo e configuração' })).toBeVisible({
    timeout: 10_000,
  })
}

/**
 * Read a Step-4 per-member preview card's case count ("N casos"/"1 caso").
 *
 * The card (`bulk-step-deal.tsx`) renders the count TWICE by design — the
 * descriptive "N caso(s)" sub-span AND a separate prominent number badge —
 * alongside the avatar initials and the name, with NO whitespace between
 * sibling spans in the compiled JSX. So the `<li>`'s own aggregate text for a
 * count of 2 is `"CC" + "Chefe CCIH" + "2 casos" + "2"` = "CCChefe
 * CCIH2 casos2": a whole-card scrape is genuinely unparseable by a regex
 * expecting a trailing word boundary after "casos" (a digit immediately
 * follows "s", and both are \w — no boundary exists there to match).
 *
 * Fix: target the descriptive sub-span PRECISELY via an ANCHORED `getByText`
 * (`^…$`) scoped to the card. Only the element whose OWN full text equals
 * "N caso(s)" satisfies both anchors — the number badge (text is just
 * digits, fails the trailing "casos") and every wrapping span (text starts
 * with the name, fails the leading `\d`) are excluded — so this resolves to
 * exactly one element regardless of the surrounding concatenation.
 */
async function memberCaseCount(dealPerMemberRegion: Locator, memberName: string): Promise<number> {
  const li = dealPerMemberRegion.getByRole('listitem').filter({ hasText: memberName })
  const countSpan = li.getByText(/^\d+\s+casos?$/)
  const text = ((await countSpan.textContent()) ?? '').trim()
  const m = /^(\d+)\s+casos?$/.exec(text)
  if (!m) throw new Error(`memberCaseCount("${memberName}"): could not parse "${text}"`)
  return Number.parseInt(m[1], 10)
}

// ===========================================================================
// AC1 — Access gate: staff_admin only (Design #9)
// ===========================================================================

test.describe('AC1 — access gate', () => {
  test('AC1a: staff_admin sees "Múltiplos casos" on the board and opens the wizard', async ({
    page,
  }) => {
    await signInAs(page, CHEFE_CCIH)
    await page.goto(BOARD_URL)
    await page.waitForURL('**/manage/cases', { timeout: 15_000 })

    const link = page.getByRole('link', { name: /múltiplos casos/i })
    await expect(link).toBeVisible({ timeout: 10_000 })
    await link.click()

    await page.waitForURL('**/manage/cases/multiplos', { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Múltiplos casos' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('heading', { name: 'Processo e configuração' })).toBeVisible()
    await expect(templateSelect(page)).toBeVisible()
  })

  test('AC1b: plain staff (staff1.ccih) gets 404 on the bulk route directly, with no wizard content leaked', async ({
    page,
  }) => {
    // staff1.ccih holds a plain 'staff' membership and no Administrativo grant
    // under any flag state, so — per the board's OWN gate
    // (`canInCommission(access, 'create_cases')`, src/app/…/manage/cases/page.tsx)
    // — she 404s on `/manage/cases` itself, not merely on the bulk sub-route.
    // Asserted on BOTH routes: the coordinator board's gate is the same root
    // cause the bulk route's stricter staff_admin-only gate sits behind, and
    // this proves the button is unreachable, not merely unclicked.
    await signInAs(page, STAFF1_CCIH)

    await page.goto(BOARD_URL)
    // BUG-ACT-NOTFOUND-COPY-1: /não encontr/i, the shared pt-BR stem — both
    // routes hit the commission not-found boundary (ACT ADR 0106's sibling),
    // verified live across the QO·B CUT_ROUTES sample (incl. manage/cases).
    await expect(
      page.getByText(/não encontr/i).first(),
    ).toBeVisible({ timeout: 10_000 })

    await page.goto(WIZARD_URL)
    // BUG-ACT-NOTFOUND-COPY-1: /não encontr/i, the shared pt-BR stem — both
    // routes hit the commission not-found boundary (ACT ADR 0106's sibling),
    // verified live across the QO·B CUT_ROUTES sample (incl. manage/cases).
    await expect(
      page.getByText(/não encontr/i).first(),
    ).toBeVisible({ timeout: 10_000 })

    // No data leakage: neither the wizard's own content nor either eligible
    // template's title may reach her DOM.
    const body = (await page.locator('body').textContent()) ?? ''
    expect(body).not.toContain('Processo e configuração')
    expect(body).not.toContain(MM_TEMPLATE_TITLE)
    expect(body).not.toContain('Descritores de Óbito')
  })
})

// ===========================================================================
// AC2 + AC3(first_only) + AC4 + AC5(write) — happy path
//
// One flow covers: Step 1→4 incl. a spreadsheet PASTE (≥2 rows), the default
// PHI columns (Nome+Prontuário), an absolute deadline, the DEFAULT
// `first_only` scope, commit, the board banner + rows, and the full DB-truth
// chain (case status, phase shape, narrative shape, and the PHI actually
// written) — see AC3's companion `all_phases` test below for the contrast.
// ===========================================================================

test('AC2+AC3(first_only)+AC4+AC5(write): paste 2 rows with PHI, a deadline, default scope — first phase active+assigned+due-dated, downstream phase+narratives unassigned, PHI persisted, batch on the board', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)

  const prefix = uniquePrefix('Happy')
  const deadline = futureDateIso(45)

  await signInAs(page, CHEFE_CCIH)
  await gotoWizard(page)

  // --- Step 1: process + config ---
  await templateSelect(page).selectOption({ label: MM_TEMPLATE_TITLE })
  await page.locator('#bulk-prefix').fill(prefix)

  // PHI picker defaults to Nome+Prontuário (E1).
  const phi = phiGroup(page)
  await expect(phi).toBeVisible({ timeout: 8_000 })
  await expect(phi.getByRole('checkbox', { name: 'Nome', exact: true })).toBeChecked()
  await expect(phi.getByRole('checkbox', { name: 'Prontuário', exact: true })).toBeChecked()
  await expect(phi.getByRole('checkbox', { name: 'Sexo', exact: true })).not.toBeChecked()

  await page.locator('#bulk-deadline').fill(deadline)

  // Scope defaults to "Apenas a primeira fase" (first_only).
  const firstOnlyBtn = page.getByRole('button', { name: /^Apenas a primeira fase/ })
  await expect(firstOnlyBtn).toHaveAttribute('aria-pressed', 'true')

  await expect(continuarButton(page)).toBeEnabled()
  await continuarButton(page).click()

  // --- Step 2: members (leave default = all) ---
  await expect(page.getByRole('heading', { name: 'Responsáveis' })).toBeVisible({
    timeout: 8_000,
  })
  await continuarButton(page).click()

  // --- Step 3: grid — paste 2 rows (Nome + Prontuário; Título stays AUTO) ---
  await expect(page.getByRole('heading', { name: 'Casos do lote' })).toBeVisible({
    timeout: 8_000,
  })
  await expect(gridRows(page)).toHaveCount(3) // 3 seeded empty rows

  const mrnTag = `PRTE2E${Date.now()}`
  const pasteBlock = toTsv([
    ['Paciente Um E2E', `${mrnTag}A`],
    ['Paciente Dois E2E', `${mrnTag}B`],
  ])
  const row1Title = page.getByRole('textbox', { name: 'Título, linha 1' })
  await pasteText(row1Title, pasteBlock)

  const mappingPanel = page.getByRole('region', { name: /mapeamento de colunas coladas/i })
  await expect(mappingPanel).toBeVisible({ timeout: 8_000 })
  await expect(mappingPanel.getByText(/2 linhas/i)).toBeVisible()
  await mappingPanel.getByRole('button', { name: /^Substituir linhas$/ }).click()
  await expect(mappingPanel).toHaveCount(0)

  await expect(gridRows(page)).toHaveCount(2)
  await expect(page.getByRole('textbox', { name: 'Nome, linha 1' })).toHaveValue(
    'Paciente Um E2E',
  )
  await expect(page.getByRole('textbox', { name: 'Prontuário, linha 1' })).toHaveValue(
    `${mrnTag}A`,
  )
  await expect(page.getByRole('textbox', { name: 'Nome, linha 2' })).toHaveValue(
    'Paciente Dois E2E',
  )
  await expect(page.getByRole('textbox', { name: 'Prontuário, linha 2' })).toHaveValue(
    `${mrnTag}B`,
  )

  await expect(continuarButton(page)).toBeEnabled()
  await continuarButton(page).click()

  // --- Step 4: deal preview → commit ---
  await expect(page.getByRole('heading', { name: 'Distribuição e confirmação' })).toBeVisible({
    timeout: 8_000,
  })
  const commitBtn = page.getByRole('button', { name: /^Criar 2 casos$/ })
  await expect(commitBtn).toBeEnabled({ timeout: 5_000 })
  await commitBtn.click()

  await page.waitForURL(/\/manage\/cases\?criados=2\b/, { timeout: 30_000 })
  await expect(
    page.getByRole('status').filter({ hasText: '2 casos criados com sucesso.' }),
  ).toBeVisible({ timeout: 10_000 })

  const label1 = `${prefix} #1`
  const label2 = `${prefix} #2`
  await expect(page.getByRole('row').filter({ hasText: label1 })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('row').filter({ hasText: label2 })).toBeVisible()

  // --- DB truth ---
  const case1 = await caseByLabel(request, label1)
  const case2 = await caseByLabel(request, label2)
  for (const c of [case1, case2]) {
    expect(c.status).toBe('in_review')
    expect(c.patient_enabled).toBe(true)
  }

  for (const c of [case1, case2]) {
    const phases = await phasesFor(request, c.id)
    expect(phases).toHaveLength(2)
    expect(phases[0].status).toBe('active')
    expect(phases[0].assigned_to).toMatch(UUID_RE)
    expect(phases[0].due_date).toBe(deadline)
    // first_only: downstream phase stays pending, unassigned, no due date.
    expect(phases[1].status).toBe('pending')
    expect(phases[1].assigned_to).toBeNull()
    expect(phases[1].due_date).toBeNull()

    // first_only: every narrative stays unassigned (Design #3).
    const narratives = await narrativesFor(request, c.id)
    expect(narratives).toHaveLength(3)
    for (const n of narratives) expect(n.assigned_to).toBeNull()
  }

  // PHI (E1): the pasted Nome/Prontuário landed on the RIGHT case each.
  const identifiers1 = await identifiersFor(request, case1.id)
  expect(identifiers1?.name).toBe('Paciente Um E2E')
  expect(identifiers1?.mrn).toBe(`${mrnTag}A`)
  const identifiers2 = await identifiersFor(request, case2.id)
  expect(identifiers2?.name).toBe('Paciente Dois E2E')
  expect(identifiers2?.mrn).toBe(`${mrnTag}B`)
})

// ===========================================================================
// AC3 (all_phases) — the contrast half: every downstream phase AND every
// narrative pre-assigned to the case's single owner; the phase itself stays
// `pending` (pre-assigned ≠ activated); the deadline still rides ONLY the
// first phase.
// ===========================================================================

test('AC3(all_phases)+AC4: all_phases pre-assigns the downstream phase and every narrative to the owner, but only the first phase is due-dated', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)

  const prefix = uniquePrefix('AllPh')
  const deadline = futureDateIso(30)

  await signInAs(page, CHEFE_CCIH)
  await gotoWizard(page)

  await templateSelect(page).selectOption({ label: MM_TEMPLATE_TITLE })
  await page.locator('#bulk-prefix').fill(prefix)
  await page.locator('#bulk-deadline').fill(deadline)

  const allPhasesBtn = page.getByRole('button', { name: /^Todas as fases/ })
  await allPhasesBtn.click()
  await expect(allPhasesBtn).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /^Apenas a primeira fase/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  await continuarButton(page).click()

  // Step 2: narrow to exactly chefe.ccih so the owner is deterministic.
  await expect(page.getByRole('heading', { name: 'Responsáveis' })).toBeVisible({
    timeout: 8_000,
  })
  await page.getByRole('button', { name: /^Limpar$/ }).click()
  await page.getByRole('checkbox', { name: /Chefe CCIH/i }).check()
  await continuarButton(page).click()

  // Step 3: reduce the 3 default (blank-valid) rows down to exactly 1.
  await expect(gridRows(page)).toHaveCount(3)
  await page.getByRole('button', { name: 'Remover linha 2' }).click()
  await expect(gridRows(page)).toHaveCount(2)
  await page.getByRole('button', { name: 'Remover linha 2' }).click()
  await expect(gridRows(page)).toHaveCount(1)
  await continuarButton(page).click()

  // Step 4: single member → trivial owner. Commit.
  await expect(page.getByRole('heading', { name: 'Distribuição e confirmação' })).toBeVisible({
    timeout: 8_000,
  })
  const commitBtn = page.getByRole('button', { name: /^Criar 1 casos$/ })
  await expect(commitBtn).toBeEnabled({ timeout: 5_000 })
  await commitBtn.click()
  await page.waitForURL(/\/manage\/cases\?criados=1\b/, { timeout: 20_000 })

  const label = `${prefix} #1`
  const kase = await caseByLabel(request, label)
  expect(kase.status).toBe('in_review')

  const phases = await phasesFor(request, kase.id)
  expect(phases).toHaveLength(2)
  expect(phases[0].status).toBe('active')
  expect(phases[0].assigned_to).toBe(UID_CHEFE_A)
  expect(phases[0].due_date).toBe(deadline)
  // all_phases: downstream phase is PRE-ASSIGNED but NOT activated, and the
  // deadline does not ride it.
  expect(phases[1].status).toBe('pending')
  expect(phases[1].assigned_to).toBe(UID_CHEFE_A)
  expect(phases[1].due_date).toBeNull()

  const narratives = await narrativesFor(request, kase.id)
  expect(narratives).toHaveLength(3)
  for (const n of narratives) expect(n.assigned_to).toBe(UID_CHEFE_A)
})

// ===========================================================================
// AC5 (gate) — Step 1 PHI column picker: name-or-MRN floor blocks Continuar;
// zero PHI columns selected is explicitly VALID (no identifiers collected).
// ===========================================================================

test('AC5(gate): the PHI column picker enforces name-or-MRN once any column is selected, but zero columns stays valid', async ({
  page,
}) => {
  await signInAs(page, CHEFE_CCIH)
  await gotoWizard(page)
  await templateSelect(page).selectOption({ label: MM_TEMPLATE_TITLE })

  const phi = phiGroup(page)
  await expect(phi).toBeVisible({ timeout: 8_000 })
  const nome = phi.getByRole('checkbox', { name: 'Nome', exact: true })
  const prontuario = phi.getByRole('checkbox', { name: 'Prontuário', exact: true })
  const nascimento = phi.getByRole('checkbox', { name: 'Nascimento', exact: true })
  const floorAlert = page.getByText(
    'Selecione ao menos Nome ou Prontuário para coletar identificadores de paciente.',
  )

  // Default: Nome + Prontuário checked, valid.
  await expect(nome).toBeChecked()
  await expect(prontuario).toBeChecked()
  await expect(floorAlert).toHaveCount(0)
  await expect(continuarButton(page)).toBeEnabled()

  // Select a THIRD column so unchecking Nome/Prontuário leaves >0 selected.
  await nascimento.check()
  await nome.uncheck()
  await prontuario.uncheck()
  await expect(floorAlert).toBeVisible({ timeout: 5_000 })
  await expect(continuarButton(page)).toBeDisabled()

  // Re-checking either one clears the floor violation.
  await prontuario.check()
  await expect(floorAlert).toHaveCount(0)
  await expect(continuarButton(page)).toBeEnabled()

  // Zero PHI columns selected is explicitly valid (no identifiers collected).
  await prontuario.uncheck()
  await nascimento.uncheck()
  await expect(floorAlert).toHaveCount(0)
  await expect(continuarButton(page)).toBeEnabled()
})

// ===========================================================================
// AC6 — Balanced deal: preview counts (sum = N, max gap ≤1), re-shuffle keeps
// the invariant, and a manual per-case override is honored VERBATIM by the
// server (the final DB tally matches the preview adjusted for the override,
// proving the server executes exactly what was previewed — Design #1/#8).
// ===========================================================================

test('AC6: balanced deal across 2 members (sum=5, gap≤1), re-shuffle, and a manual override lands exactly as previewed', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000)

  const prefix = uniquePrefix('Deal')

  await signInAs(page, CHEFE_CCIH)
  await gotoWizard(page)
  await templateSelect(page).selectOption({ label: MM_TEMPLATE_TITLE })
  await page.locator('#bulk-prefix').fill(prefix)
  await continuarButton(page).click()

  // Step 2: exactly 2 members.
  await expect(page.getByRole('heading', { name: 'Responsáveis' })).toBeVisible({
    timeout: 8_000,
  })
  await page.getByRole('button', { name: /^Limpar$/ }).click()
  await page.getByRole('checkbox', { name: /Chefe CCIH/i }).check()
  await page.getByRole('checkbox', { name: /Enfermeiro CCIH Um/i }).check()
  await continuarButton(page).click()

  // Step 3: 5 blank-valid rows (M&M has no required custom fields; blank PHI
  // trivially satisfies the floor) — 3 seeded + 2 added.
  await expect(gridRows(page)).toHaveCount(3)
  const addBtn = page.getByRole('button', { name: /^Adicionar caso$/ })
  await addBtn.click()
  await addBtn.click()
  await expect(gridRows(page)).toHaveCount(5)
  await continuarButton(page).click()

  // --- Step 4: read the preview, re-shuffle, read again (invariant holds) ---
  await expect(page.getByRole('heading', { name: 'Distribuição e confirmação' })).toBeVisible({
    timeout: 8_000,
  })
  const dealRegion = page.getByRole('region', { name: 'Carga por responsável' })
  await expect(dealRegion).toBeVisible({ timeout: 8_000 })

  function assertBalanced(a: number, b: number) {
    expect(a + b).toBe(5)
    expect(Math.abs(a - b)).toBeLessThanOrEqual(1)
  }

  const before = {
    chefe: await memberCaseCount(dealRegion, 'Chefe CCIH'),
    staff1: await memberCaseCount(dealRegion, 'Enfermeiro CCIH Um'),
  }
  assertBalanced(before.chefe, before.staff1)

  await dealRegion.getByRole('button', { name: /redistribuir/i }).click()
  const afterReshuffle = {
    chefe: await memberCaseCount(dealRegion, 'Chefe CCIH'),
    staff1: await memberCaseCount(dealRegion, 'Enfermeiro CCIH Um'),
  }
  assertBalanced(afterReshuffle.chefe, afterReshuffle.staff1)

  // --- Manual override on case #1: force it to the OTHER member ---
  const select1 = page.locator('select[aria-label="Responsável do caso 1"]')
  await expect(select1).toBeVisible({ timeout: 5_000 })
  const owner1Before = await select1.inputValue()
  const otherOwner = owner1Before === UID_CHEFE_A ? UID_STAFF1_CCIH : UID_CHEFE_A
  await select1.selectOption({ value: otherOwner })
  await expect(select1).toHaveValue(otherOwner)

  // Expected FINAL tally = the post-reshuffle preview, with case #1 moved
  // from its original owner to the override target.
  const expectedTally = new Map<string, number>([
    [UID_CHEFE_A, afterReshuffle.chefe],
    [UID_STAFF1_CCIH, afterReshuffle.staff1],
  ])
  expectedTally.set(owner1Before, (expectedTally.get(owner1Before) ?? 0) - 1)
  expectedTally.set(otherOwner, (expectedTally.get(otherOwner) ?? 0) + 1)

  const commitBtn = page.getByRole('button', { name: /^Criar 5 casos$/ })
  await expect(commitBtn).toBeEnabled({ timeout: 5_000 })
  await commitBtn.click()
  await page.waitForURL(/\/manage\/cases\?criados=5\b/, { timeout: 30_000 })

  // --- DB truth: exact per-member tally across all 5 cases, plus case #1's
  //     owner specifically (proves the override landed on the RIGHT row). ---
  const tally = new Map<string, number>([
    [UID_CHEFE_A, 0],
    [UID_STAFF1_CCIH, 0],
  ])
  let case1Owner: string | null = null
  for (let i = 1; i <= 5; i += 1) {
    const kase = await caseByLabel(request, `${prefix} #${i}`)
    const phases = await phasesFor(request, kase.id)
    expect(phases[0].status).toBe('active')
    const owner = phases[0].assigned_to
    expect(owner).not.toBeNull()
    tally.set(owner as string, (tally.get(owner as string) ?? 0) + 1)
    if (i === 1) case1Owner = owner
  }

  expect(case1Owner).toBe(otherOwner)
  expect(tally.get(UID_CHEFE_A)).toBe(expectedTally.get(UID_CHEFE_A))
  expect(tally.get(UID_STAFF1_CCIH)).toBe(expectedTally.get(UID_STAFF1_CCIH))
})

// ===========================================================================
// AC7 — >200 rows is capped client-side; exactly 200 is NOT blocked. Never
// committed (the plan explicitly accepts the client gate as sufficient).
// ===========================================================================

test('AC7: pasting 201 rows caps the grid at 200 and disables "Adicionar caso"; exactly 200 stays valid', async ({
  page,
}) => {
  await signInAs(page, CHEFE_CCIH)
  await gotoWizard(page)
  await templateSelect(page).selectOption({ value: TEMPLATE_CF_ID })
  await continuarButton(page).click() // Step 2, defaults are fine
  await continuarButton(page).click()

  await expect(gridRows(page)).toHaveCount(3)
  const lines: string[] = []
  for (let i = 1; i <= 201; i += 1) lines.push(`Linha ${i}`)
  const row1Title = page.getByRole('textbox', { name: 'Título, linha 1' })
  await pasteText(row1Title, lines.join('\n'))

  const mappingPanel = page.getByRole('region', { name: /mapeamento de colunas coladas/i })
  await expect(mappingPanel).toBeVisible({ timeout: 8_000 })
  await expect(mappingPanel.getByText(/201 linhas/i)).toBeVisible()
  await mappingPanel.getByRole('button', { name: /^Substituir linhas$/ }).click()

  await expect(gridRows(page)).toHaveCount(200)
  await expect(
    page.getByRole('status').filter({ hasText: 'Limite de 200 casos por lote atingido.' }),
  ).toBeVisible({ timeout: 8_000 })
  await expect(page.getByRole('button', { name: /^Adicionar caso$/ })).toBeDisabled()

  // The boundary: exactly 200 rows is NOT over cap — Continuar stays enabled
  // (this file never commits a 200-row batch; the client gate is the point).
  await expect(continuarButton(page)).toBeEnabled()
})

// ===========================================================================
// AC8 — keyboard-only pass over the grid (custom-fields template): row
// removal, a required text cell, and an optional native-select cell, all via
// `.focus()` + `toBeFocused()` + a real key press/type — the same
// "focus is the keyboard-accessible step for a native <select>" convention
// case-custom-fields.spec.ts's AC-1 already established for this codebase
// (raw Tab-counting through a native <select>'s OS popup is not portable).
// Also exercises the custom-field picker (required forced-on, optional
// toggle) that AC2's happy path does not, since M&M carries no custom fields.
// ===========================================================================

test('AC8 (keyboard-only grid): custom-fields template — remove rows, fill required text + optional dropdown, commit, entirely via keyboard', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)

  const prefix = uniquePrefix('Kbd')
  const declValue = `DO-E2E-KBD-${Date.now()}`

  await signInAs(page, CHEFE_CCIH)
  await gotoWizard(page)

  // --- Step 1 (keyboard) ---
  const template = templateSelect(page)
  await template.focus()
  await expect(template).toBeFocused()
  await template.selectOption({ value: TEMPLATE_CF_ID })

  const cfGroup = customFieldsGroup(page)
  await expect(cfGroup).toBeVisible({ timeout: 8_000 })
  const requiredCb = cfGroup.getByRole('checkbox', { name: new RegExp(CF_REQUIRED_LABEL) })
  const optionalCb = cfGroup.getByRole('checkbox', { name: new RegExp(CF_OPTIONAL_LABEL) })
  await expect(requiredCb).toBeChecked()
  await expect(requiredCb).toBeDisabled() // required — always included, can't be toggled
  await expect(optionalCb).not.toBeChecked()

  await optionalCb.focus()
  await expect(optionalCb).toBeFocused()
  await page.keyboard.press('Space')
  await expect(optionalCb).toBeChecked()

  const prefixInput = page.locator('#bulk-prefix')
  await prefixInput.focus()
  await expect(prefixInput).toBeFocused()
  await page.keyboard.type(prefix)

  const continuar1 = continuarButton(page)
  await continuar1.focus()
  await expect(continuar1).toBeFocused()
  await page.keyboard.press('Enter')

  // --- Step 2 (keyboard): clear, then select only chefe.ccih ---
  await expect(page.getByRole('heading', { name: 'Responsáveis' })).toBeVisible({
    timeout: 8_000,
  })
  const limparBtn = page.getByRole('button', { name: /^Limpar$/ })
  await limparBtn.focus()
  await expect(limparBtn).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Selecione ao menos um responsável.')).toBeVisible({
    timeout: 5_000,
  })

  const chefeCheckbox = page.getByRole('checkbox', { name: /Chefe CCIH/i })
  await chefeCheckbox.focus()
  await expect(chefeCheckbox).toBeFocused()
  await page.keyboard.press('Space')
  await expect(chefeCheckbox).toBeChecked()

  const continuar2 = continuarButton(page)
  await continuar2.focus()
  await expect(continuar2).toBeFocused()
  await page.keyboard.press('Enter')

  // --- Step 3 (keyboard): remove 2 of the 3 default rows, fill row 1 ---
  await expect(page.getByRole('heading', { name: 'Casos do lote' })).toBeVisible({
    timeout: 8_000,
  })
  await expect(gridRows(page)).toHaveCount(3)

  const removeRow2 = () => page.getByRole('button', { name: 'Remover linha 2' })
  await removeRow2().focus()
  await expect(removeRow2()).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(gridRows(page)).toHaveCount(2)

  await removeRow2().focus()
  await expect(removeRow2()).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(gridRows(page)).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Remover linha 1' })).toBeDisabled()

  const titleCell = page.getByRole('textbox', { name: 'Título, linha 1' })
  await titleCell.focus()
  await expect(titleCell).toBeFocused()
  await page.keyboard.type(`${prefix} teclado`)

  const requiredCell = page.getByRole('textbox', {
    name: `${CF_REQUIRED_LABEL}, linha 1`,
  })
  await requiredCell.focus()
  await expect(requiredCell).toBeFocused()
  await page.keyboard.type(declValue)

  // Native <select>: focus is the keyboard-accessible step (see file header).
  const optionalCell = page.locator(`select[aria-label="${CF_OPTIONAL_LABEL}, linha 1"]`)
  await optionalCell.focus()
  await expect(optionalCell).toBeFocused()
  await optionalCell.selectOption({ label: 'Noite' })

  const continuar3 = continuarButton(page)
  await continuar3.focus()
  await expect(continuar3).toBeFocused()
  await page.keyboard.press('Enter')

  // --- Step 4 (keyboard): single member → trivial owner. Commit. ---
  await expect(page.getByRole('heading', { name: 'Distribuição e confirmação' })).toBeVisible({
    timeout: 8_000,
  })
  const commitBtn = page.getByRole('button', { name: /^Criar 1 casos$/ })
  await expect(commitBtn).toBeEnabled({ timeout: 5_000 })
  await commitBtn.focus()
  await expect(commitBtn).toBeFocused()
  await page.keyboard.press('Enter')

  await page.waitForURL(/\/manage\/cases\?criados=1\b/, { timeout: 20_000 })
  const label = `${prefix} teclado`
  await expect(page.getByRole('row').filter({ hasText: label })).toBeVisible({ timeout: 10_000 })

  // --- DB truth ---
  const kase = await caseByLabel(request, label)
  const phases = await phasesFor(request, kase.id)
  expect(phases).toHaveLength(1)
  expect(phases[0].status).toBe('active')
  expect(phases[0].assigned_to).toBe(UID_CHEFE_A)

  const values = await restGet<{ key: string; value: unknown }>(
    request,
    `case_custom_field_values?case_id=eq.${kase.id}&select=key,value`,
  )
  expect(values.find((v) => v.key === 'numero_declaracao_obito')?.value).toBe(declValue)
  expect(values.find((v) => v.key === 'turno_obito')?.value).toBe('noite')
})
