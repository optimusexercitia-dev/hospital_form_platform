import { test, expect, type Page } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"

/**
 * SUP — Supersession correction engine + UX (docs/plans/supersession-correction.md §8).
 *
 * Test contract: translates the plan's E2E acceptance bullets into Playwright
 * assertions. Runs against the LOCAL Supabase stack (seeded personas). The
 * `response_correction` flag is seeded ON unconditionally
 * (`20260720000610_flag_response_correction_on.sql` + `seed.sql` L1945-1951) —
 * there is no per-request/per-session toggle in the app (it's a DB row read
 * via `app.feature_enabled`), so a mid-suite flag-OFF spec is not practical in
 * this harness. Per the spawn contract: the DATA-LAYER flag-OFF behavior (RPC
 * raises, aggregation predicate inert) is ALREADY locked by pgTAP `225` §13 —
 * not re-proven here. This spec instead asserts the flag-ON UI-affordance
 * behavior end-to-end, which is the portion only E2E can cover.
 *
 * Run `npx supabase db reset` before this run (fresh seed required — memory
 * `pgtap-needs-fresh-reset-vs-e2e-leftovers`); `--workers=1` (stateful).
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local    staff_admin, commission CCIH (Rede A)
 *   staff1.ccih@test.local   staff, commission CCIH (Rede A) — plain member, no admin
 *   staff2.ccih@test.local   staff, commission CCIH (Rede A)
 *
 * Seeded fixtures referenced (supabase/seed.sql):
 *   FORM A (CCIH) "Checklist de Higienização das Mãos" v1 = 50000000-0000-0000-0000-00000000a001
 *     6 standalone SUBMITTED responses (alternating staff1/staff2.ccih, i=1..6).
 *   Caso 0001 Phase 1 — a CASE-PHASE submitted response on Form A, staff1.ccih,
 *     `case_phase_id` set (seed.sql ~L762-772) — used for the "no control on
 *     case-wrapped" check.
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
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

const FORM_A_VERSION_ID = '50000000-0000-0000-0000-00000000a001'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, password)
}

/** Service-role REST query returning JSON rows (DB-truth reads only — never
 * used to mutate data under test; RLS/the RPC is always the authority). */
async function serviceQuery<T>(page: Page, path: string): Promise<T[]> {
  const resp = await page.request.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

async function openDashboard(page: Page, slug = 'ccih', org = 'rede-a') {
  // Deliberately UNFILTERED (no ?to= window): SUP-1 corrects a response
  // "now" (submitted_at = today), so any before/after headline comparison
  // must span both the seeded (i=1..6, days ago) AND the freshly-created
  // successor's submission timestamp. A `?to=yesterday` window (as
  // phase8-dashboard.spec.ts uses to isolate the seed from same-day Phase-5/6
  // fixtures) would exclude the successor and produce a spurious "before ≠
  // after" delta unrelated to the replace-not-add invariant under test.
  await page.goto(`/o/${org}/c/${slug}/dashboard`)
  await expect(page.getByRole('tablist', { name: /formulários/i })).toBeVisible({
    timeout: 15_000,
  })
}

async function readFormAHeadline(page: Page): Promise<number> {
  await openDashboard(page)
  const formATab = page.getByRole('tab', { name: /checklist.*higienização.*mãos/i })
  await expect(formATab).toBeVisible({ timeout: 10_000 })
  await formATab.click()
  const headline = page.locator('.font-display.text-4xl.tabular-nums')
  await expect(headline).toBeVisible({ timeout: 10_000 })
  const text = await headline.textContent()
  return parseInt(text?.trim() ?? '-1', 10)
}

/** Find a standalone (non-case-phase) SUBMITTED Form-A response with NO live
 * successor yet — i.e. eligible for `canCorrect` — via service-role read, and
 * return its id + creator. Used so tests don't collide on the same predecessor
 * across runs within a suite invocation. */
async function findCorrectableFormAResponse(
  page: Page,
): Promise<{ id: string; createdBy: string }> {
  const candidates = await serviceQuery<{ id: string; created_by: string }>(
    page,
    `responses?form_version_id=eq.${FORM_A_VERSION_ID}&status=eq.submitted&case_phase_id=is.null&select=id,created_by&order=submitted_at.desc`,
  )
  expect(candidates.length, 'precondition: at least one standalone submitted Form A response').toBeGreaterThan(0)

  for (const c of candidates) {
    const successors = await serviceQuery<{ id: string }>(
      page,
      `responses?supersedes_id=eq.${c.id}&select=id`,
    )
    if (successors.length === 0) {
      return { id: c.id, createdBy: c.created_by }
    }
  }
  throw new Error('No correctable (successor-free) Form A submitted response found — seed exhausted by prior tests')
}

// ---------------------------------------------------------------------------
// Check 1 — Correction replaces, not adds. Dashboard headline unchanged;
// corrected value reflected; predecessor "substituído", successor "atual"
// (list + detail header).
// ---------------------------------------------------------------------------

test('SUP-1: correcting a standalone submission replaces it — dashboard count unchanged, badges correct', async ({ page }) => {
  test.setTimeout(120_000)

  await signInAs(page, 'chefe.ccih@test.local')

  const before = await readFormAHeadline(page)
  expect(before).toBeGreaterThan(0)

  const predecessor = await findCorrectableFormAResponse(page)

  // Open the predecessor's detail.
  await page.goto(`/o/rede-a/c/ccih/dashboard/submissions/${predecessor.id}`)
  await expect(page.getByRole('heading', { name: /checklist.*higienização.*mãos/i })).toBeVisible({
    timeout: 15_000,
  })

  const correctBtn = page.getByRole('button', { name: /corrigir envio/i })
  await expect(correctBtn).toBeVisible({ timeout: 10_000 })
  await correctBtn.click()

  const dialog = page.getByRole('dialog', { name: /corrigir envio/i })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  const reasonField = dialog.getByLabel(/motivo da correção/i)
  await expect(reasonField).toBeFocused()
  await reasonField.fill('Resposta original registrada incorretamente — corrigindo o dispensador de álcool em gel.')

  await dialog.getByRole('button', { name: /iniciar correção/i }).click()

  // Lands in the successor wizard.
  await page.waitForURL(/\/responder\//, { timeout: 20_000 })
  await expect(
    page.getByText(/Há dispensador de álcool em gel disponível/i).first(),
  ).toBeVisible({ timeout: 15_000 })

  // The successor's radios must be PRE-POPULATED from the predecessor's
  // answers (plan §9 open-decision-1: pre-populate). Assert at least one
  // radio is pre-checked before we change it.
  const checkedRadio = page.getByRole('radio', { checked: true }).first()
  await expect(checkedRadio).toBeVisible({ timeout: 10_000 })

  // Change an answer: pick a DIFFERENT radio option in the first group than
  // whatever is currently checked.
  const radios = page.getByRole('radio')
  const radioCount = await radios.count()
  let changed = false
  for (let i = 0; i < radioCount; i++) {
    const r = radios.nth(i)
    const isChecked = await r.isChecked()
    if (!isChecked) {
      await r.click()
      changed = true
      break
    }
  }
  expect(changed).toBe(true)

  // Ensure the shift dropdown is set (required) if not already pre-filled.
  const turnoSelect = page.getByRole('combobox', { name: /Turno em que a auditoria/i })
  if ((await turnoSelect.inputValue()) === '') {
    await turnoSelect.selectOption({ index: 1 })
  }

  await page.getByRole('button', { name: /revisar/i }).click()
  await expect(page.getByRole('heading', { name: /Revise suas respostas/i })).toBeVisible({
    timeout: 15_000,
  })

  await page.getByRole('button', { name: /Enviar respostas/i }).click()
  await expect(page.getByRole('heading', { name: /Resposta enviada/i })).toBeVisible({
    timeout: 20_000,
  })

  // Dashboard headline must be UNCHANGED (replace, not add).
  const after = await readFormAHeadline(page)
  expect(after).toBe(before)

  // Predecessor now badged "substituído" in the detail header.
  await page.goto(`/o/rede-a/c/ccih/dashboard/submissions/${predecessor.id}`)
  await expect(page.getByText(/substituído/i).first()).toBeVisible({ timeout: 15_000 })
  // The "Corrigir envio" control must be GONE now (no live successor precondition violated).
  await expect(page.getByRole('button', { name: /corrigir envio/i })).not.toBeVisible()

  // Predecessor row in the submissions list also shows "substituído".
  await page.goto('/o/rede-a/c/ccih/dashboard/submissions')
  const responseList = page.getByRole('list', { name: /respostas/i })
  await expect(responseList).toBeVisible({ timeout: 10_000 })
  const predecessorLink = responseList.locator('li a').filter({ hasText: /substituído/i })
  await expect(predecessorLink.first()).toBeVisible({ timeout: 10_000 })

  // Find the successor via service-role and confirm it is badged "atual".
  const [successor] = await serviceQuery<{ id: string }>(
    page,
    `responses?supersedes_id=eq.${predecessor.id}&status=eq.submitted&select=id`,
  )
  expect(successor).toBeTruthy()
  await page.goto(`/o/rede-a/c/ccih/dashboard/submissions/${successor.id}`)
  await expect(page.getByText(/\batual\b/i).first()).toBeVisible({ timeout: 15_000 })
})

// ---------------------------------------------------------------------------
// Check 2 — Case-wrapped response detail shows NO "Corrigir envio" control.
// ---------------------------------------------------------------------------

test('SUP-2: case-wrapped response detail shows no "Corrigir envio" control', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')

  const [caseWrapped] = await serviceQuery<{ id: string }>(
    page,
    `responses?form_version_id=eq.${FORM_A_VERSION_ID}&status=eq.submitted&case_phase_id=not.is.null&select=id&limit=1`,
  )
  expect(caseWrapped, 'precondition: seeded case-phase submitted Form A response').toBeTruthy()

  await page.goto(`/o/rede-a/c/ccih/dashboard/submissions/${caseWrapped.id}`)
  await expect(page.getByRole('heading', { name: /checklist.*higienização.*mãos/i })).toBeVisible({
    timeout: 15_000,
  })
  // "Fase de caso" badge confirms we're on the right kind of row.
  await expect(page.getByText(/fase de caso/i).first()).toBeVisible()

  await expect(page.getByRole('button', { name: /corrigir envio/i })).not.toBeVisible()
})

// ---------------------------------------------------------------------------
// Check 3 — A plain staff (non-admin) member sees no affordance on a
// standalone submitted response detail. Plain staff cannot open the dashboard
// submissions detail route at all (staff_admin-gated), so the assertion is
// that the route 404s — no control, no leakage — mirroring AC-6 of Phase 8.
// ---------------------------------------------------------------------------

test('SUP-3: non-admin staff sees no "Corrigir envio" affordance (route is staff_admin-gated)', async ({ page }) => {
  await signInAs(page, 'staff1.ccih@test.local')

  const [standaloneResp] = await serviceQuery<{ id: string }>(
    page,
    `responses?form_version_id=eq.${FORM_A_VERSION_ID}&status=eq.submitted&case_phase_id=is.null&select=id&limit=1`,
  )
  expect(standaloneResp).toBeTruthy()

  await page.goto(`/o/rede-a/c/ccih/dashboard/submissions/${standaloneResp.id}`)

  // staff1.ccih is a plain `staff` member — the submissions detail route is
  // staff_admin-gated (SubmissionDetailPage: `access.role !== 'staff_admin'`
  // → notFound()). Friendly in-shell 404, no data, no control.
  await expect(
    page.getByRole('heading', { name: /encontramos esta página|Erro 404/i }),
  ).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: /corrigir envio/i })).not.toBeVisible()
  const body = await page.locator('body').textContent()
  expect(body).not.toMatch(/dispensador_disponivel|epis_observados/i)
})

// ---------------------------------------------------------------------------
// Check 4 — Keyboard-only correction flow (CLAUDE.md §8 requirement).
// Open dialog → type reason → submit — entirely via keyboard.
// ---------------------------------------------------------------------------

test('SUP-4: keyboard-only — open dialog, type reason, submit via keyboard, lands in successor draft', async ({ page }) => {
  test.setTimeout(120_000)

  await signInAs(page, 'chefe.ccih@test.local')

  const predecessor = await findCorrectableFormAResponse(page)
  await page.goto(`/o/rede-a/c/ccih/dashboard/submissions/${predecessor.id}`)
  await expect(page.getByRole('heading', { name: /checklist.*higienização.*mãos/i })).toBeVisible({
    timeout: 15_000,
  })

  const correctBtn = page.getByRole('button', { name: /corrigir envio/i })
  await expect(correctBtn).toBeVisible({ timeout: 10_000 })
  await correctBtn.focus()
  await expect(correctBtn).toBeFocused()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: /corrigir envio/i })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  // The dialog auto-focuses the reason textarea on open (component contract:
  // `onOpenAutoFocus` focuses the reason field for keyboard users).
  const reasonField = dialog.getByLabel(/motivo da correção/i)
  await expect(reasonField).toBeFocused()

  // Type the reason. Use ControlOrMeta+a for select-all if needed — NOT
  // Control+a, which is caret-to-line-start on macOS (repo memory
  // `e2e-macos-ctrl-a-not-select-all`). Here we simply type into the
  // empty, already-focused field, so no select-all is needed.
  await page.keyboard.type('Corrigindo via fluxo somente teclado — motivo obrigatório preenchido.')
  await expect(reasonField).toHaveValue(/Corrigindo via fluxo somente teclado/)

  // Tab from the textarea to "Cancelar" then to "Iniciar correção", and
  // activate the submit button with the keyboard (Enter/Space).
  let submitFocused = false
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab')
    const isSubmit = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null
      return a?.tagName === 'BUTTON' && /iniciar correção/i.test(a.textContent ?? '')
    })
    if (isSubmit) {
      submitFocused = true
      break
    }
  }
  expect(submitFocused).toBe(true)
  await page.keyboard.press('Enter')

  // Lands in the successor draft wizard.
  await page.waitForURL(/\/responder\//, { timeout: 20_000 })
  await expect(
    page.getByText(/Há dispensador de álcool em gel disponível/i).first(),
  ).toBeVisible({ timeout: 15_000 })

  // Confirm the successor is indeed linked to this predecessor (supersedes_id).
  const wizardUrl = page.url()
  const match = wizardUrl.match(/\/responder\/([0-9a-f-]{36})/)
  expect(match).toBeTruthy()
  const successorId = match![1]
  const [successorRow] = await serviceQuery<{ supersedes_id: string | null }>(
    page,
    `responses?id=eq.${successorId}&select=supersedes_id`,
  )
  expect(successorRow?.supersedes_id).toBe(predecessor.id)
})

// ---------------------------------------------------------------------------
// Check 5 — Flag-OFF (§8 "Flag-OFF spec"). See the file-header note: the
// `response_correction` flag is seeded ON unconditionally by
// `20260720000610_flag_response_correction_on.sql` + seed.sql, with no
// runtime/per-session toggle exposed to the app — there is no clean mechanism
// to flip it OFF mid-suite without a raw DB write that would itself violate
// "never mutate data under test outside the app's own RPCs/actions" AND would
// require a full re-seed afterward (the migration re-applies it ON on the
// next reset regardless). The DATA-LAYER flag-OFF behavior (RPC raises;
// `app.submitted_form_responses` predicate inert) is authoritatively covered
// by pgTAP `225` §13 per the plan. This spec instead documents the omission
// and, as a partial substitute, confirms the flag's DB state is what the app
// reads (so a future toggle mechanism can reuse this assertion).
// ---------------------------------------------------------------------------

test('SUP-5: flag-OFF is covered by pgTAP 225 §13 (data layer); this spec documents the E2E gap', async ({ page }) => {
  // Confirm the flag is indeed seeded ON (the precondition every other SUP
  // spec in this file relies on) via an OBSERVABLE UI effect rather than a
  // direct table read: `app.feature_flags` lives in the `app` schema, which
  // is NOT exposed over PostgREST (config.toml `db.schemas = ["public",
  // "graphql_public"]`) — so the flag can't be queried directly via the
  // service-role REST client used elsewhere in this file. Instead, assert the
  // "Corrigir envio" affordance DOES render for a staff_admin on a correctable
  // standalone submitted response — the flag is one of `canCorrect`'s AND-ed
  // preconditions (getSubmissionDetail), so this is a faithful, if indirect,
  // proof the flag reads ON.
  await signInAs(page, 'chefe.ccih@test.local')
  const predecessor = await findCorrectableFormAResponse(page)
  await page.goto(`/o/rede-a/c/ccih/dashboard/submissions/${predecessor.id}`)
  await expect(page.getByRole('button', { name: /corrigir envio/i })).toBeVisible({
    timeout: 15_000,
  })

  // NOTE (documented per spawn-prompt instruction, option (b)): flipping this
  // flag OFF mid-suite would require a direct UPDATE against
  // `app.feature_flags` via service-role — bypassing the app's own mutation
  // path entirely, and every OTHER spec in this file (and any parallel spec
  // run in the same DB) depends on it being ON. Doing so here would either
  // require this test to run in total isolation (defeating `--workers=1`
  // shared-DB economics) or leave the flag OFF for all subsequent specs in
  // the invocation. Given pgTAP 225 §13 already proves the RPC raises and the
  // aggregation predicate is inert when OFF, we do not duplicate that here.
  // If a future harness adds a per-request flag override, this test should be
  // extended to assert: (a) no "Corrigir envio" button renders on any
  // standalone submitted detail, and (b) the dashboard headline count for
  // Form A matches the pre-SUP baseline (6, per phase8-dashboard AC-1).
  test.info().annotations.push({
    type: 'coverage-note',
    description:
      'Flag-OFF data-layer behavior covered by pgTAP 225 §13; E2E flag-OFF UI-affordance-absence not exercised (flag is DB-seeded ON unconditionally, no runtime toggle available in this harness).',
  })
})
