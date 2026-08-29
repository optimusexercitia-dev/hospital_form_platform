import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn, accessToken } from './helpers/auth'
import { SUPABASE_URL, svcHeaders } from './helpers/service-role'
import {
  createDraftTemplateDirect,
  getPublishedTemplateVersion,
} from './helpers/process-templates'

/**
 * ADR 0137 — Case & Referral usability batch. New E2E coverage for the
 * acceptance criteria the plan (docs/plans/case-referral-usability-batch.md)
 * assigns to the tester, beyond the rename/removal sweep already applied to
 * the pre-existing specs (hospital-departments / case-patient:1357 /
 * ethics-e3a-surfacing / cases-extras / cases-meetings-minor /
 * helpers/case-affordance-class.ts).
 *
 * Sections, each translating one decision into assertions:
 *   D8   — attributed work is actionable ("Preencher" on an assigned ACTIVE
 *          phase, for a staff_admin, an administrativo AND a plain member,
 *          on the /casos reading surface where the defect lived).
 *   D4/D5/D6/D7 — the referral wizard rewrite: deferred creation (a
 *          "Continuar" click must NOT mint a draft), Salvar rascunho, the
 *          pick/un-pick/resume/send outcome (the batch's highest-value new
 *          spec — asserts what the RECEIVING committee sees, never the
 *          mechanism), the read-only destination on resume, and the MRN
 *          refusal at send (with the draft-save floor staying open).
 *   D12  — the Atividade card: the Tudo/Atualizações/Sistema partition, and
 *          edit/delete suppressed on a procedural (Sistema) row — framed as
 *          the UI-only control BUG-CASEEVT-KIND-001 names it as, never as a
 *          security boundary.
 *   D13/D14 — the Process detail page's "Trabalho do processo" shell, and
 *          "Tipo de caso" read-only on a published version / editable on a
 *          draft.
 *
 * Personas (password Test1234!), all commission A / CCIH unless noted:
 *   chefe.ccih@test.local   staff_admin (coordinator) — 00…002
 *   staff1.ccih@test.local  plain staff, no case tie — 00…003
 *   staff2.ccih@test.local  plain staff, ALSO the seeded administrativo — 00…004
 *   chefe.farm@test.local   staff_admin, Farmácia (the referral's receiving
 *                           committee) — 00…005
 *
 * Fixtures reused rather than rebuilt (measured live before writing this
 * file, never assumed):
 *   - Caso 0001 (d0000000-…-c1) already carries TWO narratives with body
 *     content ("Resumo Clínico", "Resumo do caso") — exactly what the
 *     referral wizard's pick/un-pick flow needs, and one procedural
 *     `case_events` row (kind='safety_event') — exactly what the D12
 *     Sistema-partition assertions need. No fixture-building RPCs required
 *     for either.
 *   - The seeded "Investigação de Óbito (M&M)" template (CCIH, published,
 *     2 phases) is used for D8's three fresh single-phase-active cases.
 *
 * Run with --workers=1 (serial; several tests write through shared personas
 * and the shared Caso 0001 fixture). `npx supabase db reset` before a clean
 * run — NOT run by this file; the tester coordinates resets separately.
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}

const ORG = 'rede-a'
const COMM_CCIH_ID = 'a0000000-0000-0000-0000-0000000000a1'
const CASE_A_ID = 'd0000000-0000-0000-0000-0000000000c1' // Caso 0001

const CHEFE_CCIH_ID = '00000000-0000-0000-0000-000000000002'
const STAFF1_CCIH_ID = '00000000-0000-0000-0000-000000000003' // plain member
const STAFF2_CCIH_ID = '00000000-0000-0000-0000-000000000004' // administrativo

const TAG = `URB-${Date.now()}`

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await cachedSignIn(page, email, password)
}

/** Service-role GET, asserting success (never turns a failed read into "empty"). */
async function restGet<T>(req: APIRequestContext, path: string): Promise<T[]> {
  const resp = await req.get(`${SUPABASE_URL}/rest/v1/${path}`, { headers: svcHeaders() })
  expect(resp.ok(), `GET ${path}: ${await resp.text()}`).toBeTruthy()
  return (await resp.json()) as T[]
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

// ===========================================================================
// D8 — attributed work is actionable: "Preencher" on an assigned ACTIVE phase,
// on the /casos READING SURFACE, for a staff_admin, an administrativo and a
// plain member alike. Before this fix `CoordinatorPhaseActions` returned null
// on that host for anyone who was neither coordinator nor `assign_case_phases`
// — the affordance is gated on `assignedTo === viewerId` and NOTHING else, so
// this is exactly the case identity-attributed work must survive
// `narrowToReadingSurface` (ADR 0134 F-1).
// ===========================================================================

/**
 * Create a fresh case from the seeded M&M template, activate Phase 1 and
 * assign it to `assigneeId`, all as the coordinator. Returns the case id.
 */
async function createCaseWithActiveAssignedPhase(
  page: Page,
  request: APIRequestContext,
  label: string,
  assigneeId: string,
): Promise<string> {
  const tpl = await getPublishedTemplateVersion(
    request,
    { baseUrl: SUPABASE_URL, apikey: SUPABASE_SERVICE_KEY, bearerToken: SUPABASE_SERVICE_KEY },
    COMM_CCIH_ID,
    'Investigação de Óbito (M&M)',
  )
  const ownerToken = await accessToken(request, 'chefe.ccih@test.local')
  const createResp = await rpc(request, 'create_case_from_template', ownerToken, {
    p_template_id: tpl.templateId,
    p_label: label,
  })
  expect(createResp.ok(), `create_case_from_template failed: ${await createResp.text()}`).toBeTruthy()
  const created = (await createResp.json()) as { id: string }
  const caseId = created.id

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/manage/cases/${caseId}`)
  await page.waitForURL(new RegExp(`manage/cases/${caseId}`), { timeout: 15_000 })

  const phase1Row = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phase1Row).toBeVisible({ timeout: 10_000 })
  await phase1Row.getByRole('button', { name: /Ativar e atribuir/i }).click()
  const activateDialog = page.getByRole('dialog').filter({ hasText: /Ativar e atribuir fase/i })
  await expect(activateDialog).toBeVisible({ timeout: 10_000 })
  await activateDialog.locator('select[name="assignedTo"]').selectOption(assigneeId)
  await activateDialog.getByRole('button', { name: /Ativar fase/i }).click()
  await expect(activateDialog).toHaveCount(0, { timeout: 15_000 })

  // DB truth: Phase 1 is now active and assigned before any persona check runs.
  await expect
    .poll(async () => {
      const phases = await restGet<{ status: string; assigned_to: string | null; position: number }>(
        request,
        `case_phases?case_id=eq.${caseId}&position=eq.1&select=status,assigned_to,position`,
      )
      return phases[0]
    }, { timeout: 15_000 })
    .toMatchObject({ status: 'active', assigned_to: assigneeId })

  return caseId
}

test('D8-1: an assigned staff_admin sees "Preencher" for an active phase on /casos', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  const caseId = await createCaseWithActiveAssignedPhase(
    page,
    request,
    `Caso ${TAG} D8 staff_admin`,
    CHEFE_CCIH_ID,
  )

  // chefe.ccih is a staff_admin — but on /casos (the reading surface) she is
  // narrowed exactly like everyone else. Before D8 she would have seen
  // NOTHING actionable for her own assigned phase on this host.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/casos/${caseId}`)
  await page.waitForURL(new RegExp(`casos/${caseId}`), { timeout: 15_000 })

  const phase1Row = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phase1Row).toBeVisible({ timeout: 10_000 })
  await expect(phase1Row.getByRole('button', { name: /^Preencher$/i })).toBeVisible({
    timeout: 10_000,
  })
})

test('D8-2: an assigned administrativo sees "Preencher" for an active phase on /casos', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  const caseId = await createCaseWithActiveAssignedPhase(
    page,
    request,
    `Caso ${TAG} D8 administrativo`,
    STAFF2_CCIH_ID,
  )

  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/casos/${caseId}`)
  await page.waitForURL(new RegExp(`casos/${caseId}`), { timeout: 15_000 })

  const phase1Row = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phase1Row).toBeVisible({ timeout: 10_000 })
  await expect(phase1Row.getByRole('button', { name: /^Preencher$/i })).toBeVisible({
    timeout: 10_000,
  })
})

test('D8-3: an assigned plain member sees "Preencher" for an active phase on /casos', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  const caseId = await createCaseWithActiveAssignedPhase(
    page,
    request,
    `Caso ${TAG} D8 plain member`,
    STAFF1_CCIH_ID,
  )

  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/casos/${caseId}`)
  await page.waitForURL(new RegExp(`casos/${caseId}`), { timeout: 15_000 })

  const phase1Row = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phase1Row).toBeVisible({ timeout: 10_000 })
  await expect(phase1Row.getByRole('button', { name: /^Preencher$/i })).toBeVisible({
    timeout: 10_000,
  })
})

test('D8-4: no competing primary on the MANAGE host when the coordinator is also the assignee', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  const caseId = await createCaseWithActiveAssignedPhase(
    page,
    request,
    `Caso ${TAG} D8 no-competing-primary`,
    CHEFE_CCIH_ID,
  )

  // Already signed in as chefe.ccih (the helper leaves the session that way).
  await page.goto(`/o/${ORG}/c/ccih/manage/cases/${caseId}`)
  await page.waitForURL(new RegExp(`manage/cases/${caseId}`), { timeout: 15_000 })

  const phase1Row = page.getByRole('article').filter({ hasText: /Fase 1/i }).first()
  await expect(phase1Row).toBeVisible({ timeout: 10_000 })
  await expect(phase1Row.getByRole('button', { name: /^Preencher$/i })).toBeVisible({
    timeout: 10_000,
  })
  // The coordinator cluster's own default-variant buttons must NOT ALSO
  // render here — an active phase offers only "Alterar responsável"
  // (outline) from that cluster; "Ativar e atribuir" belongs to a pending
  // phase only. Exactly one default-variant primary action in the row.
  await expect(
    phase1Row.getByRole('button', { name: /^Ativar e atribuir$/i }),
  ).toHaveCount(0)
  await expect(phase1Row.getByRole('button', { name: /^Alterar responsável$/i })).toBeVisible({
    timeout: 5_000,
  })
})

// ===========================================================================
// D12 — the Atividade card: the Tudo/Atualizações/Sistema partition, and
// edit/delete suppressed on a procedural (Sistema) row.
//
// ⚠ Load-bearing framing, not incidental: the suppression asserted below is
// currently the ONLY control (BUG-CASEEVT-KIND-001). The asymmetry is exactly
// why: INSERT is kind-gated (`case_events_writer_insert` /
// `…_staff_admin_insert` carry `app.is_manual_case_event_kind(kind)` in their
// `WITH CHECK`, so an authenticated principal can only ever CREATE one of the
// six manual kinds) but UPDATE and DELETE carry NO kind gate at all — a
// coordinator cannot mint a procedural row, but can silently re-kind or
// delete an existing one. This spec is what keeps the UI suppression from
// regressing; it is NOT evidence of a security boundary and must never be
// cited as one.
//
// Fixture note: the procedural row used below (Caso 0001, kind='safety_event')
// is SEEDED (`supabase/seed.sql`), not test residue — verified against the
// seed file before writing this spec, so it survives a fresh `db reset` and
// this is safe to run in the gate. Do NOT substitute a richer procedural set
// from another case without re-verifying it is seeded, never assumed —
// several other case_events rows observed live (e.g. `admissibility_decided`
// on Caso 14) are E2E run residue that a fresh reset does not reproduce.
// ===========================================================================

/**
 * Author a manual record through the "Adicionar registro" DIALOG.
 *
 * ⛔ THIS IS THE ONLY AUTHORING PATH since 2026-08-24, when the Atividade card's
 * inline composer was removed (superseding half of ADR 0137 D12). The specs here used
 * to fill the card's own textarea and click "Registrar"; neither control exists.
 * ⚠ `exact: true` on both queries is load-bearing — Playwright's `name` matches a
 * SUBSTRING by default, so a bare 'Adicionar' would also match the trigger button
 * behind the overlay, and the dialog's own title.
 */
async function addAtividadeRecord(page: Page, body: string) {
  const atividade = page.getByRole('region', { name: 'Atividade' })
  await expect(atividade).toBeVisible({ timeout: 10_000 })
  await atividade.getByRole('button', { name: 'Adicionar registro' }).click()

  const dialog = page.getByRole('dialog', { name: 'Adicionar registro' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await dialog.getByRole('textbox', { name: 'Descrição', exact: true }).fill(body)
  await dialog.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(dialog).toBeHidden({ timeout: 10_000 })
}

test('D12-1: the Atividade filter pills partition Tudo/Atualizações/Sistema correctly; edit/delete are absent on a Sistema (procedural) row and present on an Atualizações (manual) row', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/manage/cases/${CASE_A_ID}`)
  await page.waitForURL(new RegExp(`manage/cases/${CASE_A_ID}`), { timeout: 15_000 })

  // Add a uniquely-tagged manual record, so the Atualizações-only membership
  // check below is anchored on IDENTITY (this exact row), never on a count —
  // Caso 0001 is a shared fixture other specs also write to.
  const MANUAL_BODY = `[E2E ${TAG}] nota manual do teste de partição D12.`
  const atividade = page.getByRole('region', { name: 'Atividade' })
  await expect(atividade).toBeVisible({ timeout: 10_000 })
  await addAtividadeRecord(page, MANUAL_BODY)
  await expect(atividade.locator('li').filter({ hasText: MANUAL_BODY })).toBeVisible({
    timeout: 10_000,
  })

  const manualRow = () => atividade.locator('li').filter({ hasText: MANUAL_BODY })
  // The seeded procedural row (kind='safety_event') — verified live on Caso
  // 0001 before writing this spec, not assumed.
  const proceduralRow = () =>
    atividade.locator('li').filter({ hasText: 'Evento de segurança EV-0001' })

  // ── Tudo: both kinds visible ──
  await expect(atividade.getByRole('group', { name: 'Filtrar atividade' }).getByRole('button', { name: 'Tudo' })).toHaveAttribute('aria-pressed', 'true')
  await expect(manualRow()).toBeVisible({ timeout: 10_000 })
  await expect(proceduralRow()).toBeVisible({ timeout: 10_000 })

  // ── Atualizações: manual only ──
  const updatesBtn = atividade.getByRole('group', { name: 'Filtrar atividade' }).getByRole('button', { name: 'Atualizações' })
  await updatesBtn.click()
  await expect(updatesBtn).toHaveAttribute('aria-pressed', 'true')
  await expect(manualRow()).toBeVisible({ timeout: 10_000 })
  await expect(proceduralRow()).toHaveCount(0)
  // Manual row: canWrite (coordinator) → edit + delete affordances present.
  await expect(
    manualRow().getByRole('button', { name: new RegExp(`^Editar registro`) }),
  ).toBeVisible({ timeout: 5_000 })
  await expect(
    manualRow().getByRole('button', { name: new RegExp(`^Remover registro`) }),
  ).toBeVisible({ timeout: 5_000 })

  // ── Sistema: procedural only ──
  const systemBtn = atividade.getByRole('group', { name: 'Filtrar atividade' }).getByRole('button', { name: 'Sistema' })
  await systemBtn.click()
  await expect(systemBtn).toHaveAttribute('aria-pressed', 'true')
  await expect(proceduralRow()).toBeVisible({ timeout: 10_000 })
  await expect(manualRow()).toHaveCount(0)
  // Procedural row: NO edit/delete, regardless of canWrite — the D12
  // suppression this test exists to guard (BUG-CASEEVT-KIND-001).
  await expect(proceduralRow().getByRole('button', { name: /^Editar registro/ })).toHaveCount(0)
  await expect(proceduralRow().getByRole('button', { name: /^Remover registro/ })).toHaveCount(0)

  // DB truth (defence in depth against the UI-only control being trusted):
  // the procedural row's kind really is outside the manual vocabulary.
  const rows = await restGet<{ kind: string }>(
    request,
    `case_events?case_id=eq.${CASE_A_ID}&title=eq.${encodeURIComponent('Evento de segurança EV-0001')}&select=kind`,
  )
  expect(rows[0]?.kind).toBe('safety_event')
})

test('D12-2: filtering to a kind the case has none of shows "Nada por aqui com este filtro." (not the zero-events empty state)', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  // A FRESH case with exactly one MANUAL event and zero procedural ones, so
  // filtering to Sistema is genuinely a "no match", never "no data at all".
  const ownerToken = await accessToken(request, 'chefe.ccih@test.local')
  const tpl = await getPublishedTemplateVersion(
    request,
    { baseUrl: SUPABASE_URL, apikey: SUPABASE_SERVICE_KEY, bearerToken: SUPABASE_SERVICE_KEY },
    COMM_CCIH_ID,
    'Investigação de Óbito (M&M)',
  )
  const createResp = await rpc(request, 'create_case_from_template', ownerToken, {
    p_template_id: tpl.templateId,
    p_label: `Caso ${TAG} D12 empty-filter`,
  })
  expect(createResp.ok(), `create_case_from_template failed: ${await createResp.text()}`).toBeTruthy()
  const caseId = ((await createResp.json()) as { id: string }).id

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/manage/cases/${caseId}`)
  await page.waitForURL(new RegExp(`manage/cases/${caseId}`), { timeout: 15_000 })

  const atividade = page.getByRole('region', { name: 'Atividade' })
  await expect(atividade).toBeVisible({ timeout: 10_000 })
  await addAtividadeRecord(page, 'Nota única deste caso — sem eventos de sistema.')
  await expect(atividade.getByText('Nada por aqui com este filtro.')).toHaveCount(0)

  await atividade.getByRole('group', { name: 'Filtrar atividade' }).getByRole('button', { name: 'Sistema' }).click()
  await expect(atividade.getByText('Nada por aqui com este filtro.')).toBeVisible({ timeout: 10_000 })
})

test('D12-K: keyboard-only — the Atividade card authors a record without a mouse (open the dialog, pick a Tipo, type, submit)', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  const ownerToken = await accessToken(request, 'chefe.ccih@test.local')
  const tpl = await getPublishedTemplateVersion(
    request,
    { baseUrl: SUPABASE_URL, apikey: SUPABASE_SERVICE_KEY, bearerToken: SUPABASE_SERVICE_KEY },
    COMM_CCIH_ID,
    'Investigação de Óbito (M&M)',
  )
  const createResp = await rpc(request, 'create_case_from_template', ownerToken, {
    p_template_id: tpl.templateId,
    p_label: `Caso ${TAG} D12 keyboard`,
  })
  expect(createResp.ok(), `create_case_from_template failed: ${await createResp.text()}`).toBeTruthy()
  const caseId = ((await createResp.json()) as { id: string }).id

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/manage/cases/${caseId}`)
  await page.waitForURL(new RegExp(`manage/cases/${caseId}`), { timeout: 15_000 })

  const atividade = page.getByRole('region', { name: 'Atividade' })
  await expect(atividade).toBeVisible({ timeout: 10_000 })

  // Open the authoring dialog with Enter — never a click. This step is NEW to the
  // flow: before 2026-08-24 the composer was already on the page, so the keyboard
  // path started at a field. The trigger is now the first thing a keyboard user has
  // to reach, which makes it the first thing worth asserting.
  const addBtn = atividade.getByRole('button', { name: 'Adicionar registro' })
  await addBtn.focus()
  await expect(addBtn).toBeFocused()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'Adicionar registro' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  // Select "Decisão" in the Tipo <select> with arrow keys. The picker order is
  // `CASE_EVENT_KINDS` — note, meeting, decision — so two ArrowDowns from the
  // default. ⚠ Asserted by VALUE afterwards rather than trusted: if the picker order
  // ever changes, this reds here instead of silently filing the wrong kind.
  const tipo = dialog.getByRole('combobox', { name: 'Tipo' })
  await tipo.focus()
  await expect(tipo).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(tipo).toHaveValue('decision')

  // Focus the description textarea and type — never a click.
  const KEYBOARD_BODY = `[E2E ${TAG}] registro criado inteiramente por teclado.`
  const descField = dialog.getByRole('textbox', { name: 'Descrição', exact: true })
  await descField.focus()
  await expect(descField).toBeFocused()
  await page.keyboard.type(KEYBOARD_BODY)

  // Focus + activate the submit with Enter (never a click).
  const submitBtn = dialog.getByRole('button', { name: 'Adicionar', exact: true })
  await submitBtn.focus()
  await expect(submitBtn).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(dialog).toBeHidden({ timeout: 10_000 })
  const newRow = atividade.locator('li').filter({ hasText: KEYBOARD_BODY })
  await expect(newRow).toBeVisible({ timeout: 10_000 })
  await expect(newRow.getByText('Decisão', { exact: true })).toBeVisible()
})

// ===========================================================================
// D4/D5/D6/D7 — the referral wizard rewrite.
// ===========================================================================

const REFERRAL_SUBJECT = `[E2E ${TAG}] assunto do encaminhamento`

test('D5-1: step 1 "Continuar" does NOT create a referral draft (deferred creation); "Salvar rascunho" does', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/manage/cases/${CASE_A_ID}`)
  await page.waitForURL(new RegExp(`manage/cases/${CASE_A_ID}`), { timeout: 15_000 })

  await page.getByRole('button', { name: /^Encaminhar caso$/i }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: /Encaminhar/i })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  // "Salvar rascunho" starts DISABLED — the required step-1 fields are empty.
  const saveDraftBtn = dialog.getByRole('button', { name: /^Salvar rascunho$/i })
  await expect(saveDraftBtn).toBeDisabled()

  await fillWizardStep1(dialog, REFERRAL_SUBJECT)
  await expect(saveDraftBtn).toBeEnabled({ timeout: 5_000 })

  // Advance with "Continuar" — this must NOT persist anything (D5).
  await dialog.getByRole('button', { name: /^Continuar$/i }).click()
  await expect(dialog.getByRole('heading', { name: 'Narrativas' })).toBeVisible({ timeout: 10_000 })

  const afterContinuar = await restGet<{ id: string }>(
    request,
    `case_referral?subject=eq.${encodeURIComponent(REFERRAL_SUBJECT)}&select=id`,
  )
  expect(afterContinuar.length, '"Continuar" must not mint a draft (ADR 0137 D5)').toBe(0)

  // "Salvar rascunho" from step 2 DOES persist — exactly one row.
  await dialog.getByRole('button', { name: /^Salvar rascunho$/i }).click()
  await expect(dialog).toHaveCount(0, { timeout: 15_000 })

  const afterSave = await restGet<{ id: string; status: string }>(
    request,
    `case_referral?subject=eq.${encodeURIComponent(REFERRAL_SUBJECT)}&select=id,status`,
  )
  expect(afterSave.length, 'exactly one draft after "Salvar rascunho"').toBe(1)
  expect(afterSave[0].status).toBe('draft')
})

/** Fill step 1 (Detalhes): first real type, "Outra comissão" → Farmácia, subject. */
async function fillWizardStep1(dialog: import('@playwright/test').Locator, subject: string) {
  const typeSelect = dialog.locator('label').filter({ hasText: 'Tipo de encaminhamento' }).locator('select')
  const firstRealOption = await typeSelect.locator('option').nth(1).getAttribute('value')
  await typeSelect.selectOption(firstRealOption!)

  // "Outra comissão" vs "Direção técnica" only renders when the technical
  // direction arm is reachable; pick "Outra comissão" explicitly when it does.
  const commissionRadio = dialog.getByRole('radio', { name: /Outra comissão/i })
  if (await commissionRadio.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await commissionRadio.check()
  }
  const targetSelect = dialog.locator('label').filter({ hasText: 'Comissão de destino' }).locator('select')
  await targetSelect.selectOption({ label: 'Comissão de Farmácia e Terapêutica' })

  await dialog.getByLabel(/^Assunto$/i).fill(subject)
}

test('D5-2/D6/D7/D4: pick two narratives, un-pick one, save + resume the draft, send without an MRN (refused) then with one (sent) — the receiving committee sees EXACTLY ONE shared item', async ({
  page,
  request,
}) => {
  test.setTimeout(150_000)
  const subject = `[E2E ${TAG}] pick-unpick-resume-send`
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/manage/cases/${CASE_A_ID}`)
  await page.waitForURL(new RegExp(`manage/cases/${CASE_A_ID}`), { timeout: 15_000 })

  await page.getByRole('button', { name: /^Encaminhar caso$/i }).click()
  let dialog = page.getByRole('dialog').filter({ hasText: /Encaminhar/i })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  await fillWizardStep1(dialog, subject)
  await dialog.getByRole('button', { name: /^Continuar$/i }).click()

  // Pick BOTH pre-existing narratives with body content.
  //
  // ⚠ MEASURED, not assumed, TWICE over:
  //  1. The wizard's picker label is `title ?? displayLabel`
  //     (`build-case-referrals-module.ts`), so the "Resumo do caso" narrative
  //     (its `display_label`) renders here under its PER-INSTANCE `title`
  //     override, "Resumo clínico" (lowercase c) — one letter away from the
  //     OTHER narrative's own label, "Resumo Clínico" (its `display_label`,
  //     no title override). A case-insensitive substring filter
  //     (Playwright's default for a string `hasText`) matches BOTH and
  //     throws a strict-mode violation.
  //  2. `.locator('li').filter({ hasText: /^…\b/ })` uses raw `textContent`,
  //     which FUSES the adjacent title/body `<span>`s with NO separator
  //     ("Resumo ClínicoPaciente…") — so a `\b`-anchored regex silently
  //     never matches at that seam. The accessible NAME (what `getByRole`
  //     matches against) inserts a real space between them, so scoping
  //     directly on the checkbox's role+name — never the `<li>`'s text — is
  //     what makes the anchored regex work at all.
  await expect(dialog.getByRole('heading', { name: 'Narrativas' })).toBeVisible({ timeout: 10_000 })
  const narrativeACheckbox = dialog.getByRole('checkbox', { name: /^Resumo Clínico\b/ })
  const narrativeBCheckbox = dialog.getByRole('checkbox', { name: /^Resumo clínico\b/ })
  await expect(narrativeACheckbox).toHaveCount(1)
  await expect(narrativeBCheckbox).toHaveCount(1)
  await narrativeACheckbox.check()
  await narrativeBCheckbox.check()

  // Save as a draft with BOTH picked (D5 flush persists what is buffered).
  await dialog.getByRole('button', { name: /^Salvar rascunho$/i }).click()
  await expect(dialog).toHaveCount(0, { timeout: 15_000 })

  const draftRows = await restGet<{ id: string }>(
    request,
    `case_referral?subject=eq.${encodeURIComponent(subject)}&select=id`,
  )
  expect(draftRows.length).toBe(1)
  const referralId = draftRows[0].id
  const itemsAfterSave = await restGet<{ id: string; source_narrative_id: string | null }>(
    request,
    `referral_shared_item?referral_id=eq.${referralId}&select=id,source_narrative_id`,
  )
  expect(itemsAfterSave.length, 'both picks landed on the draft').toBe(2)

  // ── D6: resume the draft — click its row (a BUTTON, not a link) ──
  await page.reload()
  await page.waitForLoadState('networkidle', { timeout: 15_000 })
  const draftRowBtn = page.getByRole('button', { name: subject })
  await expect(draftRowBtn).toBeVisible({ timeout: 10_000 })
  await draftRowBtn.click()
  dialog = page.getByRole('dialog').filter({ hasText: /Encaminhar/i })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  // ── D7: destination renders READ-ONLY with the discard-and-restart note ──
  await expect(dialog.getByText('Comissão de Farmácia e Terapêutica')).toBeVisible({
    timeout: 10_000,
  })
  await expect(
    dialog.getByText(/O destino não pode ser alterado depois que o rascunho é criado/i),
  ).toBeVisible()
  await expect(dialog.locator('select[name="targetCommissionId"]' as never)).toHaveCount(0)

  // ── D6: picks rehydrated from server truth ──
  await dialog.getByRole('button', { name: /^Continuar$/i }).click()
  await expect(dialog.getByRole('heading', { name: 'Narrativas' })).toBeVisible({ timeout: 10_000 })
  const narrativeACheckboxResumed = dialog.getByRole('checkbox', { name: /^Resumo Clínico\b/ })
  const narrativeBCheckboxResumed = dialog.getByRole('checkbox', { name: /^Resumo clínico\b/ })
  await expect(narrativeACheckboxResumed).toBeChecked()
  await expect(narrativeBCheckboxResumed).toBeChecked()

  // ── The un-pick, on RESUME — the exact path the D5 amendment says is the
  //    dangerous one (a fresh-send un-pick "dies structurally"; a RESUMED
  //    un-pick needs the flush to diff against server truth and REMOVE).
  //    Un-picking narrative A ("Resumo Clínico") — narrative B ("Resumo
  //    clínico", the "Resumo do caso" row under its title override) stays
  //    picked and must be the ONLY one the receiving committee ends up seeing. ──
  await narrativeACheckboxResumed.uncheck()
  await dialog.getByRole('button', { name: /^Continuar$/i }).click()

  // ── Patient step: name only, no MRN — send must be refused (D4), draft
  //    save must have already succeeded without it (floor unchanged). ──
  await expect(dialog.getByLabel(/^Nome$/i)).toBeVisible({ timeout: 10_000 })
  await dialog.getByLabel(/^Nome$/i).fill('Paciente Teste Encaminhamento')
  await dialog.getByRole('button', { name: /^Continuar$/i }).click()

  await expect(dialog.getByRole('button', { name: /Enviar encaminhamento/i })).toBeVisible({
    timeout: 10_000,
  })
  await dialog.getByRole('button', { name: /Enviar encaminhamento/i }).click()
  await expect(
    dialog.getByText('Informe o prontuário do paciente antes de enviar o encaminhamento.'),
  ).toBeVisible({ timeout: 10_000 })
  // The dialog stays open on refusal — never silently closes on a failed send.
  await expect(dialog).toBeVisible()

  // Go back, fill the MRN, forward again, send — now it succeeds.
  await dialog.getByRole('button', { name: /^Voltar$/i }).click()
  await expect(dialog.getByLabel(/^Prontuário/i)).toBeVisible({ timeout: 10_000 })
  await dialog.getByLabel(/^Prontuário/i).fill(`PRT-${TAG}`)
  await dialog.getByRole('button', { name: /^Continuar$/i }).click()
  await dialog.getByRole('button', { name: /Enviar encaminhamento/i }).click()
  await expect(dialog).toHaveCount(0, { timeout: 15_000 })

  // ── DB truth: sent, and the un-picked item is GONE, not merely hidden ──
  await expect
    .poll(async () => {
      const rows = await restGet<{ sent_at: string | null }>(
        request,
        `case_referral?id=eq.${referralId}&select=sent_at`,
      )
      // ⛔ FUP-E2E-ABSENT-ROW-ASSERTIONS. Returning `rows[0]?.sent_at` was worse than
      // vacuous inside a poll: on an ABSENT row it yields `undefined`, `.not.toBeNull()`
      // ACCEPTS `undefined`, so the poll SUCCEEDS ON ITS FIRST TICK and the 15 s wait it
      // was written to perform never happens. Collapse both facts into one boolean and
      // match with `.toBe(true)`, which throws on `undefined` as well as on `false`.
      return rows.length === 1 && rows[0].sent_at !== null
    }, { timeout: 15_000 })
    .toBe(true)

  const itemsAfterSend = await restGet<{ source_narrative_id: string | null }>(
    request,
    `referral_shared_item?referral_id=eq.${referralId}&select=source_narrative_id`,
  )
  expect(itemsAfterSend.length, 'the un-picked item was REMOVED server-side, not just hidden').toBe(1)
  // The SURVIVING item is narrative B ("Resumo do caso", id a2200000-…-a1 —
  // rendered "Resumo clínico" per its title override); narrative A
  // ("Resumo Clínico", id a188d549-…) is the one that was un-picked.
  expect(itemsAfterSend[0]?.source_narrative_id).toBe('a2200000-0000-0000-0000-0000000000a1')

  // ── The outcome, from the RECEIVING committee's own screen — never the
  //    mechanism. This is the assertion the plan calls the highest-value new
  //    spec in the batch: the old bug shipped content the coordinator had
  //    de-selected; only checking what the target actually SEES would catch it.
  //    `frozen_title = coalesce(narrative.title, narrative.display_label)`
  //    (measured from `add_referral_shared_item`'s source), so the surviving
  //    item's frozen title is "Resumo clínico" (the title override) — never
  //    "Resumo Clínico" (narrative A's own label, which must NOT appear at all). ──
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/${ORG}/c/farmacia/encaminhamentos/${referralId}`)
  await page.waitForURL(new RegExp(`encaminhamentos/${referralId}`), { timeout: 15_000 })

  const snapshot = page.getByRole('region', { name: /Conteúdo compartilhado/i })
  await expect(snapshot).toBeVisible({ timeout: 10_000 })
  // The REAL guard: exactly one article, and it is the right one (`aria-label`
  // is a plain attribute — an exact match, no fusion risk).
  await expect(snapshot.getByRole('article')).toHaveCount(1)
  await expect(snapshot.getByRole('article', { name: 'Resumo clínico' })).toBeVisible()
  // Belt-and-suspenders only — NOT load-bearing on its own; `toHaveCount(1)`
  // above is what actually bounds the claim, do not delete it and keep only
  // this line. Scoped on the ARTICLE's accessible name (a plain `aria-label`
  // attribute), never `getByText` over serialized DOM text — the same
  // fusion hazard the checkbox locators hit above applies here too, and for
  // an ABSENCE check a matcher that can silently fail to match makes the
  // assertion pass too easily, which is the wrong direction to be wrong in.
  await expect(snapshot.getByRole('article', { name: 'Resumo Clínico', exact: true })).toHaveCount(0)
})

// ===========================================================================
// D13/D14 — the Process detail page's "Trabalho do processo" shell, and
// "Tipo de caso" read-only on a published version / editable on a draft.
// ===========================================================================

test('D13/D14: "Trabalho do processo" shell renders; "Tipo de caso" is editable on a draft and read-only (dt/dd, no <select>) once published', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000)
  const chefeAToken = await accessToken(request, 'chefe.ccih@test.local')

  const draft = await createDraftTemplateDirect(
    request,
    { baseUrl: SUPABASE_URL, apikey: SUPABASE_SERVICE_KEY, bearerToken: SUPABASE_SERVICE_KEY },
    {
      commissionId: COMM_CCIH_ID,
      title: `Processo ${TAG} D13-D14`,
      createdBy: CHEFE_CCIH_ID,
    },
  )

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/${ORG}/c/ccih/manage/process-templates/${draft.templateId}`)
  await page.waitForURL(new RegExp(`process-templates/${draft.templateId}`), { timeout: 15_000 })

  // D13 — the shell: heading + subtitle, SHELL ONLY (no progress meter).
  const workSection = page.getByRole('region', { name: 'Trabalho do processo' })
  await expect(workSection).toBeVisible({ timeout: 10_000 })
  await expect(workSection.getByText('Fases e narrativas que cada caso deste processo receberá')).toBeVisible()
  await expect(workSection.getByRole('progressbar')).toHaveCount(0)

  // D14 — draft: "Tipo de caso deste processo" is a real <select>, editable.
  const caseTypeSection = page.getByRole('region', { name: 'Tipo de caso' })
  await expect(caseTypeSection).toBeVisible({ timeout: 10_000 })
  const typeLabel = caseTypeSection.getByText('Tipo de caso deste processo')
  await expect(typeLabel).toBeVisible()
  const typeSelect = caseTypeSection.locator('select')
  await expect(typeSelect).toBeVisible({ timeout: 5_000 })
  await typeSelect.selectOption({ label: 'Ética' })
  await expect
    .poll(async () => {
      const rows = await restGet<{ case_type_id: string | null }>(
        request,
        `process_template_versions?id=eq.${draft.versionId}&select=case_type_id`,
      )
      // ⛔ Same shape as the `sent_at` poll above (FUP-E2E-ABSENT-ROW-ASSERTIONS): an
      // absent row made this poll succeed immediately instead of waiting.
      return rows.length === 1 && rows[0].case_type_id !== null
    }, { timeout: 10_000 })
    .toBe(true)

  // Publish needs ≥1 phase.
  const [form] = await restGet<{ id: string }>(
    request,
    `forms?commission_id=eq.${COMM_CCIH_ID}&title=eq.${encodeURIComponent('Checklist de Higienização das Mãos')}&select=id&limit=1`,
  )
  expect(form, 'seeded form not found').toBeTruthy()
  const addPhaseResp = await rpc(request, 'add_template_phase', chefeAToken, {
    p_template_version_id: draft.versionId,
    p_form_id: form.id,
    p_title: `Fase única ${TAG}`,
  })
  expect(addPhaseResp.ok(), `add_template_phase failed: ${await addPhaseResp.text()}`).toBeTruthy()
  const publishResp = await rpc(request, 'publish_process_template', chefeAToken, {
    p_template_id: draft.templateId,
  })
  expect(publishResp.ok(), `publish_process_template failed: ${await publishResp.text()}`).toBeTruthy()

  // D14 — published: read-only dt/dd, NO <select> for the case type anywhere
  // in that section; the chosen type is still shown.
  await page.reload()
  await page.waitForLoadState('networkidle', { timeout: 15_000 })
  const caseTypeSectionPublished = page.getByRole('region', { name: 'Tipo de caso' })
  await expect(caseTypeSectionPublished).toBeVisible({ timeout: 10_000 })
  await expect(caseTypeSectionPublished.locator('select')).toHaveCount(0)
  await expect(caseTypeSectionPublished.getByText('Tipo de caso deste processo')).toBeVisible()
  await expect(caseTypeSectionPublished.getByText('Ética', { exact: true })).toBeVisible()

  // The work shell footer's authoring buttons are also gone on a published version.
  const workSectionPublished = page.getByRole('region', { name: 'Trabalho do processo' })
  await expect(workSectionPublished.getByRole('button', { name: /Adicionar fase/i })).toHaveCount(0)
})
