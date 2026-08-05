import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'

/**
 * Process-Template Versioning — E2E spec (ADR 0096 + Amendment 1).
 *
 * Test contract: translates the ADR's D2/D3 decisions into Playwright +
 * PostgREST assertions, on top of the flip-passed builder UI
 * (`TemplateBuilderShell` / `VersionWorkflowBanner` / `VersionHistoryPanel` /
 * `BeginTemplateEditButton` / `PublishTemplateVersionButton` /
 * `CaseTemplateProvenance`).
 *
 * ACCEPTANCE COVERED (this file's tests, in run order — `serial`, one shared
 * lifecycle template):
 *   AC-D2-Lifecycle    Publishing v1 leaves exactly one published version at
 *                      version_number 1; a published version's authoring RPCs
 *                      are server-refused (draft-only guard); editing v1
 *                      clones to a draft v2 WITHOUT touching v1 — a case
 *                      created before the edit, and another created AFTER the
 *                      edit but BEFORE v2 is published, both still pin v1
 *                      (D2's core promise: "new cases keep using the
 *                      published version until then"); a second "edit" click
 *                      returns the SAME v2 draft (idempotent — no v3 forms);
 *                      publishing v2 archives v1 atomically, leaving exactly
 *                      one published version again (now v2); a case created
 *                      afterwards pins v2.
 *   AC-VersionHistory  The history rail renders every version — number,
 *                      status, case count — newest first, and the counts
 *                      match the cases pinned to each version by AC-D2.
 *   AC-Provenance-*    The version a case ran under is shown on BOTH the
 *                      coordinator route and the staff route; a processless
 *                      case renders "Sem processo" as a plain fact, never an
 *                      error/empty state, on both routes.
 *   AC-Keyboard        A full "edit → publish" cycle (v2 → v3), driven
 *                      entirely by keyboard — Tab/Enter, no mouse — the
 *                      phase's mandatory keyboard-only flow (CLAUDE.md §8).
 *
 * Fixtures: this file builds and OWNS a single fresh template (never the
 * seeded M&M template other specs mutate), so it does not race
 * phase7-cases.spec.ts / cases-outcomes-blockers.spec.ts, which also publish
 * fresh templates but never touch this one's title.
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin of CCIH (Rede A) — the coordinator;
 *                           builds, publishes, edits and reads provenance
 *                           on both routes (staff_admin can read the staff
 *                           route too — it is capability-gated, not role-gated).
 *
 * Run with --workers=1 (serial; several tests share the one lifecycle template).
 * `npx supabase db reset` before a clean run.
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
const SLUG = 'ccih'
const BASE = `/o/${ORG}/c/${SLUG}`
const COMM_CCIH_ID = 'a0000000-0000-0000-0000-0000000000a1'
const FORM_TITLE = 'Checklist de Higienização das Mãos'

const PW = 'Test1234!'

// ---------------------------------------------------------------------------
// Shared state across this file's serial tests
// ---------------------------------------------------------------------------

let templateId: string
let v1Id: string
let v2Id: string
let v3Id: string | null = null // minted only by the keyboard test, at the end
let caseAId: string // created while v1 published, before any edit
let caseBId: string // created while v2 is an open draft — must still pin v1
let caseCId: string // created after v2 is published — must pin v2
let processlessCaseId: string

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = PW) {
  await cachedSignIn(page, email, password)
}

async function getOwnerToken(page: Page, email: string, password = PW): Promise<string> {
  const resp = await page.request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password },
  })
  expect(resp.ok()).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

async function rpc(
  request: APIRequestContext,
  fn: string,
  token: string,
  body: Record<string, unknown>,
) {
  return request.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })
}

/** Service-role SELECT — DB-truth assertions (RLS is bypassed deliberately). */
async function dbGet<T = Record<string, unknown>>(
  request: APIRequestContext,
  path: string,
): Promise<T[]> {
  const resp = await request.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  expect(resp.ok(), `dbGet(${path}) failed: ${await resp.text()}`).toBeTruthy()
  return (await resp.json()) as T[]
}

interface VersionRow {
  id: string
  status: 'draft' | 'published' | 'archived'
  version_number: number
  title: string
}

async function getVersions(request: APIRequestContext, tplId: string): Promise<VersionRow[]> {
  return dbGet<VersionRow>(
    request,
    `process_template_versions?template_id=eq.${tplId}&select=id,status,version_number,title&order=version_number.asc`,
  )
}

async function getCaseRow(
  request: APIRequestContext,
  caseId: string,
): Promise<{ template_version_id: string | null; template_id: string | null } | null> {
  const rows = await dbGet<{ template_version_id: string | null; template_id: string | null }>(
    request,
    `cases?id=eq.${caseId}&select=template_version_id,template_id`,
  )
  return rows[0] ?? null
}

async function getFormIdByTitle(request: APIRequestContext, title: string): Promise<string> {
  const rows = await dbGet<{ id: string }>(
    request,
    `forms?commission_id=eq.${COMM_CCIH_ID}&title=eq.${encodeURIComponent(title)}&select=id&limit=1`,
  )
  expect(rows.length, `form "${title}" not found in CCIH`).toBeGreaterThan(0)
  return rows[0].id
}

/** Create a case from `templateId` (the TEMPLATE identity — resolves the
 * published version internally). Returns the new case id. */
async function createCaseFromTemplate(
  page: Page,
  ownerToken: string,
  tplId: string,
  label: string,
): Promise<string> {
  const resp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/create_case_from_template`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${ownerToken}`,
      'Content-Type': 'application/json',
    },
    data: { p_template_id: tplId, p_label: label },
  })
  expect(resp.ok(), `create_case_from_template failed: ${await resp.text()}`).toBeTruthy()
  const body = (await resp.json()) as { id: string }
  expect(body.id).toBeTruthy()
  return body.id
}

/** Extract the `?v=<uuid>` query param from the current page URL. */
function versionIdFromUrl(page: Page): string {
  const url = new URL(page.url())
  const v = url.searchParams.get('v')
  expect(v, `no ?v= param in URL: ${page.url()}`).toBeTruthy()
  return v as string
}

// ===========================================================================
// AC-D2-Lifecycle
// ===========================================================================

test('AC-D2-Lifecycle: publish v1 (1 published, refused-while-published) → edit clones to v2 (v1 unchanged, new cases still pin v1) → idempotent edit (same v2) → publish v2 archives v1 (1 published again) → new case pins v2', async ({
  page,
}) => {
  test.setTimeout(300_000)

  await signInAs(page, 'chefe.ccih@test.local')

  // ── Build a fresh 1-phase template ──
  await page.goto(`${BASE}/manage/process-templates`)
  await page.waitForURL(`**${BASE}/manage/process-templates`, { timeout: 15_000 })

  const suffix = Date.now()
  const templateTitle = `TV Lifecycle E2E ${suffix}`

  await page.getByRole('button', { name: /Novo processo/i }).click()
  const createDialog = page.getByRole('dialog').filter({ hasText: /Novo processo/i })
  await expect(createDialog).toBeVisible({ timeout: 10_000 })
  await createDialog.getByLabel(/Título/i).fill(templateTitle)
  await createDialog.getByRole('button', { name: /Criar processo/i }).click()
  await page.waitForURL(/\/manage\/process-templates\/[0-9a-f-]{36}/, { timeout: 20_000 })

  const tplUrlMatch = page.url().match(/process-templates\/([0-9a-f-]{36})/)
  expect(tplUrlMatch).toBeTruthy()
  templateId = (tplUrlMatch as RegExpMatchArray)[1]

  // The freshly-created template is a v1 DRAFT — assert the badge before we
  // ever touch publish, so the rest of the test's "v1 was published" claims
  // rest on an observed baseline, not an assumption.
  await expect(page.getByText(/^Rascunho$/i).first()).toBeVisible({ timeout: 10_000 })

  await page.getByRole('button', { name: /Adicionar fase/i }).first().click()
  const slotDialog = page.getByRole('dialog').filter({ hasText: /Nova fase/i })
  await expect(slotDialog).toBeVisible({ timeout: 10_000 })
  await slotDialog.locator('select[name="formId"]').selectOption({ label: FORM_TITLE })
  await slotDialog.locator('input[name="title"]').fill('Fase 1')
  await slotDialog.getByRole('button', { name: /Adicionar fase/i }).click()
  await expect(slotDialog).toHaveCount(0, { timeout: 15_000 })

  // ── Publish v1 ──
  await page.getByRole('button', { name: /^Publicar versão 1$/i }).click()
  const confirmPub1 = page.getByRole('alertdialog')
  await expect(confirmPub1).toBeVisible({ timeout: 10_000 })
  await confirmPub1.getByRole('button', { name: /^Publicar$/i }).click()
  await expect(confirmPub1).toHaveCount(0, { timeout: 15_000 })
  await expect(page.getByText(/Versão 1 — em vigor/i).first()).toBeVisible({ timeout: 15_000 })

  // A published version has no phase-authoring affordance.
  await expect(page.getByRole('button', { name: /Adicionar fase/i })).toHaveCount(0)

  // DB truth: exactly ONE published version, and it is version_number 1.
  let versions = await getVersions(page.request, templateId)
  let published = versions.filter((v) => v.status === 'published')
  expect(published.length, 'exactly one published version after the first publish').toBe(1)
  expect(published[0].version_number).toBe(1)
  v1Id = published[0].id

  // ── Server-side proof: a published version's authoring RPCs are REFUSED ──
  // (D2 — "published versions are IMMUTABLE"). Uses the canonical server path
  // (`add_template_phase`), not a UI absence check alone.
  const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')
  const formId = await getFormIdByTitle(page.request, FORM_TITLE)
  const refusedResp = await rpc(page.request, 'add_template_phase', ownerToken, {
    p_template_version_id: v1Id,
    p_form_id: formId,
    p_title: 'Should be refused — v1 is published',
  })
  expect(
    refusedResp.ok(),
    'add_template_phase against a PUBLISHED version must be refused',
  ).toBe(false)
  // The row set is unaffected by the refused call.
  const phasesAfterRefusal = await dbGet(
    page.request,
    `process_template_phases?template_version_id=eq.${v1Id}&select=id`,
  )
  expect(phasesAfterRefusal.length).toBe(1) // still just "Fase 1"

  // ── Case A: created while v1 is the (only) published version ──
  caseAId = await createCaseFromTemplate(page, ownerToken, templateId, `TV Case A ${suffix}`)
  const caseA = await getCaseRow(page.request, caseAId)
  expect(caseA?.template_version_id).toBe(v1Id)

  // ── Edit v1 → clones to a draft v2. v1 itself must be UNTOUCHED. ──
  await page.reload()
  await page.getByRole('button', { name: /^Editar processo$/i }).click()
  const editConfirm = page.getByRole('dialog').filter({ hasText: /Editar este processo\?/i })
  await expect(editConfirm).toBeVisible({ timeout: 10_000 })
  await editConfirm.getByRole('button', { name: /Criar rascunho/i }).click()
  await page.waitForURL(/\?v=[0-9a-f-]{36}/, { timeout: 20_000 })
  v2Id = versionIdFromUrl(page)
  expect(v2Id).not.toBe(v1Id)

  // The draft banner names v2 AND states v1 remains in force.
  await expect(
    page.getByRole('heading', { name: /Você está editando o rascunho da versão 2/i }),
  ).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/versão 1/i).first()).toBeVisible()

  // DB truth: v1 is UNCHANGED (still published, still version_number 1, same
  // id, its phase untouched) — editing forked, it did not mutate in place.
  versions = await getVersions(page.request, templateId)
  const v1AfterEdit = versions.find((v) => v.id === v1Id)
  expect(v1AfterEdit?.status).toBe('published')
  expect(v1AfterEdit?.version_number).toBe(1)
  const v1PhasesAfterEdit = await dbGet(
    page.request,
    `process_template_phases?template_version_id=eq.${v1Id}&select=id,title`,
  )
  expect(v1PhasesAfterEdit.length).toBe(1)

  // ── Case B: created AFTER the edit, BEFORE v2 is published — MUST still
  // pin v1. This is the D2 promise the ADR names as the biggest UX risk. ──
  caseBId = await createCaseFromTemplate(page, ownerToken, templateId, `TV Case B ${suffix}`)
  const caseB = await getCaseRow(page.request, caseBId)
  expect(
    caseB?.template_version_id,
    'a case created while v2 is only a DRAFT must still pin the PUBLISHED v1',
  ).toBe(v1Id)

  // ── Idempotent second "edit": from the PUBLISHED v1 view, the button now
  // reads "Continuar rascunho (v2)" and navigates straight through — no
  // confirm dialog, and critically, no NEW draft (no v3). ──
  await page.goto(`${BASE}/manage/process-templates/${templateId}?v=${v1Id}`)
  await page.waitForURL(/\?v=/, { timeout: 15_000 })
  const resumeBtn = page.getByRole('button', { name: /^Continuar rascunho \(v2\)$/i })
  await expect(resumeBtn).toBeVisible({ timeout: 10_000 })
  await resumeBtn.click()
  await page.waitForURL(/\?v=[0-9a-f-]{36}/, { timeout: 15_000 })
  const secondEditVersionId = versionIdFromUrl(page)
  expect(secondEditVersionId, 'a second "edit" must return the SAME draft, not fork a new one').toBe(v2Id)

  versions = await getVersions(page.request, templateId)
  expect(versions.length, 'still exactly 2 versions after the idempotent second edit').toBe(2)

  // ── Publish v2 → archives v1 atomically; exactly one published again. ──
  await page.getByRole('button', { name: /^Publicar versão 2$/i }).click()
  const confirmPub2 = page.getByRole('alertdialog')
  await expect(confirmPub2).toBeVisible({ timeout: 10_000 })
  // The confirm copy names BOTH sides of the swap.
  await expect(confirmPub2).toContainText(/versão 2/i)
  await expect(confirmPub2).toContainText(/versão 1/i)
  await confirmPub2.getByRole('button', { name: /^Publicar$/i }).click()
  await expect(confirmPub2).toHaveCount(0, { timeout: 15_000 })
  await expect(page.getByText(/Versão 2 — em vigor/i).first()).toBeVisible({ timeout: 15_000 })

  versions = await getVersions(page.request, templateId)
  published = versions.filter((v) => v.status === 'published')
  expect(published.length, 'exactly one published version after publishing v2').toBe(1)
  expect(published[0].id).toBe(v2Id)
  const v1AfterV2Publish = versions.find((v) => v.id === v1Id)
  expect(v1AfterV2Publish?.status, 'v1 is ARCHIVED once v2 publishes').toBe('archived')

  // ── Case C: created after v2 is published — must now pin v2. ──
  caseCId = await createCaseFromTemplate(page, ownerToken, templateId, `TV Case C ${suffix}`)
  const caseC = await getCaseRow(page.request, caseCId)
  expect(caseC?.template_version_id).toBe(v2Id)

  // Case A and Case B, both pinned to the now-ARCHIVED v1, are untouched by
  // any of the above — a case is self-describing at creation (ADR 0096
  // Context), so archiving the version it ran under changes nothing about it.
  const caseAAfter = await getCaseRow(page.request, caseAId)
  const caseBAfter = await getCaseRow(page.request, caseBId)
  expect(caseAAfter?.template_version_id).toBe(v1Id)
  expect(caseBAfter?.template_version_id).toBe(v1Id)
})

// ===========================================================================
// AC-VersionHistory: number + status + case count, newest first
// ===========================================================================

test('AC-VersionHistory: the history rail lists v2 then v1, each with its status + case count, newest first', async ({
  page,
}) => {
  test.setTimeout(60_000)
  expect(templateId, 'AC-D2-Lifecycle must run first').toBeTruthy()

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/process-templates/${templateId}`)
  await page.waitForURL(/\/manage\/process-templates\//, { timeout: 15_000 })

  const rail = page.getByRole('complementary', { name: /Versões e dados do processo/i })
  await expect(rail).toBeVisible({ timeout: 10_000 })
  const history = rail.getByRole('navigation', { name: /Histórico de versões do processo/i })
  await expect(history).toBeVisible({ timeout: 10_000 })

  const rows = history.locator('li')
  await expect(rows).toHaveCount(2, { timeout: 10_000 })

  // Newest first: row 0 is Versão 2 (Publicada, 1 caso — Case C); row 1 is
  // Versão 1 (Arquivada, 2 casos — Case A + Case B).
  const row0 = rows.nth(0)
  await expect(row0.getByText(/^Versão 2$/i)).toBeVisible()
  await expect(row0.getByText(/^Publicada$/i)).toBeVisible()
  await expect(row0.getByText(/1 caso\b/i)).toBeVisible()

  const row1 = rows.nth(1)
  await expect(row1.getByText(/^Versão 1$/i)).toBeVisible()
  await expect(row1.getByText(/^Arquivada$/i)).toBeVisible()
  await expect(row1.getByText(/2 casos/i)).toBeVisible()
})

// ===========================================================================
// AC-Provenance-Coordinator: which version a case ran under; "Sem processo"
// is a plain fact, never an error, for a processless case.
// ===========================================================================

test('AC-Provenance-Coordinator: case detail shows the version a case ran under; a processless case shows "Sem processo" (not an error)', async ({
  page,
}) => {
  test.setTimeout(60_000)
  expect(caseAId, 'AC-D2-Lifecycle must run first').toBeTruthy()

  await signInAs(page, 'chefe.ccih@test.local')

  // ── Case A ran under v1 (now archived) ──
  await page.goto(`${BASE}/manage/cases/${caseAId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${caseAId}`), { timeout: 15_000 })
  const provenanceA = page.getByText(/versão 1/i).first()
  await expect(provenanceA).toBeVisible({ timeout: 10_000 })
  // v1 is no longer the published version — the status badge is shown
  // (VersionWorkflowBanner/CaseTemplateProvenance only hides it when current).
  await expect(page.getByText(/^Arquivada$/i).first()).toBeVisible({ timeout: 5_000 })
  // The provenance row links into the exact version in the builder.
  const provenanceLinkA = page.getByRole('link', { name: /versão 1/i })
  await expect(provenanceLinkA).toBeVisible({ timeout: 5_000 })
  await expect(provenanceLinkA).toHaveAttribute(
    'href',
    new RegExp(`process-templates/${templateId}\\?v=${v1Id}`),
  )

  // ── Case C ran under v2 (currently published) — no status badge, since
  // it IS the version in force (the badge would be noise there). ──
  await page.goto(`${BASE}/manage/cases/${caseCId}`)
  await page.waitForURL(new RegExp(`/manage/cases/${caseCId}`), { timeout: 15_000 })
  await expect(page.getByText(/versão 2/i).first()).toBeVisible({ timeout: 10_000 })

  // ── A PROCESSLESS case: "Sem processo" is a plain fact, not an error. ──
  await page.goto(`${BASE}/manage/cases`)
  await page.waitForURL(`**${BASE}/manage/cases`, { timeout: 15_000 })
  const novoCasoBtn = page.getByRole('button', { name: /novo caso/i })
  await expect(novoCasoBtn).toBeVisible({ timeout: 10_000 })
  await novoCasoBtn.click()
  const dialog = page.getByRole('dialog', { name: /novo caso/i })
    .or(page.getByRole('dialog').filter({ hasText: /novo caso/i }))
  await expect(dialog).toBeVisible({ timeout: 8_000 })
  const templateSelect = dialog.locator('select[name="templateId"]')
  const hasProcessless = await templateSelect
    .locator('option', { hasText: /Sem processo/i })
    .count()
  if (hasProcessless === 0) {
    // The `processless_cases` flag is off in this environment — nothing to
    // assert on this route; skip the negative half rather than fail on an
    // unrelated flag state.
    await page.keyboard.press('Escape')
    return
  }
  await templateSelect.selectOption({ label: 'Sem processo' })
  const suffix = Date.now()
  await dialog.getByLabel(/Rótulo/i).fill(`TV Processless ${suffix}`)
  await dialog.getByRole('button', { name: /criar caso/i }).click()
  await page.waitForURL(new RegExp(`${BASE}/manage/cases/[0-9a-f-]{36}`), { timeout: 20_000 })
  processlessCaseId = page.url().split('/').pop() as string

  // No error boundary, no crash — the page renders its normal header +
  // exactly ONE "Sem processo" occurrence (the provenance row).
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Sem processo/i)).toHaveCount(1)
  // It is never rendered as a link (there is no version to open).
  await expect(page.getByRole('link', { name: /Sem processo/i })).toHaveCount(0)
})

// ===========================================================================
// AC-Provenance-Staff: the same fact, on the staff route (`/casos/[caseId]`).
// ===========================================================================

test('AC-Provenance-Staff: the staff case route also shows the version provenance; "Sem processo" stays exactly one occurrence there', async ({
  page,
}) => {
  test.setTimeout(60_000)
  expect(caseCId, 'AC-D2-Lifecycle must run first').toBeTruthy()

  await signInAs(page, 'chefe.ccih@test.local')

  // ── A templated case: "{título} · versão {N}" appears; no link role (the
  // staff route has no builder to open, so no href is offered — by design). ──
  await page.goto(`${BASE}/casos/${caseCId}`)
  await page.waitForURL(new RegExp(`/casos/${caseCId}`), { timeout: 15_000 })
  await expect(page.getByText(/versão 2/i).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('link', { name: /versão 2/i })).toHaveCount(0)

  // ── The processless case, on the staff route: exactly one occurrence,
  // still not an error. ──
  test.skip(!processlessCaseId, 'AC-Provenance-Coordinator skipped the processless half (flag off)')
  await page.goto(`${BASE}/casos/${processlessCaseId}`)
  await page.waitForURL(new RegExp(`/casos/${processlessCaseId}`), { timeout: 15_000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Sem processo/i)).toHaveCount(1)
})

// ===========================================================================
// AC-Keyboard: a full edit → publish cycle (v2 → v3), keyboard-only.
// ===========================================================================

test('AC-Keyboard: edit v2 → draft v3 → publish v3, driven entirely by keyboard (no mouse)', async ({
  page,
}) => {
  test.setTimeout(90_000)
  expect(templateId, 'AC-D2-Lifecycle must run first').toBeTruthy()

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/process-templates/${templateId}`)
  await page.waitForURL(/\/manage\/process-templates\//, { timeout: 15_000 })
  // Lands on v2 (published; no open draft yet — AC-D2-Lifecycle left none).
  await expect(page.getByText(/Versão 2 — em vigor/i).first()).toBeVisible({ timeout: 10_000 })

  // ── Keyboard: focus "Editar processo", open with Enter ──
  const editBtn = page.getByRole('button', { name: /^Editar processo$/i })
  await editBtn.focus()
  await expect(editBtn).toBeFocused()
  await page.keyboard.press('Enter')

  const editConfirm = page.getByRole('dialog').filter({ hasText: /Editar este processo\?/i })
  await expect(editConfirm).toBeVisible({ timeout: 10_000 })

  // Tab to the "Criar rascunho" confirm button and activate with Enter.
  let confirmFocused = false
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    const isConfirm = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null
      return a?.tagName === 'BUTTON' && /^Criar rascunho$/.test(a.textContent?.trim() ?? '')
    })
    if (isConfirm) {
      confirmFocused = true
      break
    }
  }
  expect(confirmFocused, '"Criar rascunho" must be reachable by keyboard alone').toBe(true)
  await page.keyboard.press('Enter')

  await page.waitForURL(/\?v=[0-9a-f-]{36}/, { timeout: 20_000 })
  v3Id = versionIdFromUrl(page)
  expect(v3Id).not.toBe(v2Id)
  await expect(
    page.getByRole('heading', { name: /Você está editando o rascunho da versão 3/i }),
  ).toBeVisible({ timeout: 10_000 })

  // ── Keyboard: focus "Publicar versão 3", open with Enter ──
  const publishBtn = page.getByRole('button', { name: /^Publicar versão 3$/i })
  await publishBtn.focus()
  await expect(publishBtn).toBeFocused()
  await page.keyboard.press('Enter')

  const publishConfirm = page.getByRole('alertdialog')
  await expect(publishConfirm).toBeVisible({ timeout: 10_000 })

  let publishConfirmFocused = false
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    const isConfirm = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null
      return a?.tagName === 'BUTTON' && /^Publicar$/.test(a.textContent?.trim() ?? '')
    })
    if (isConfirm) {
      publishConfirmFocused = true
      break
    }
  }
  expect(publishConfirmFocused, '"Publicar" (confirm) must be reachable by keyboard alone').toBe(true)
  await page.keyboard.press('Enter')

  await expect(publishConfirm).toHaveCount(0, { timeout: 15_000 })
  await expect(page.getByText(/Versão 3 — em vigor/i).first()).toBeVisible({ timeout: 15_000 })

  // DB truth: v2 archived, v3 published, still exactly one published version.
  const versions = await getVersions(page.request, templateId)
  const published = versions.filter((v) => v.status === 'published')
  expect(published.length).toBe(1)
  expect(published[0].id).toBe(v3Id)
  expect(versions.find((v) => v.id === v2Id)?.status).toBe('archived')
})
