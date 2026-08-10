import { test, expect, type Page } from '@playwright/test'
import { cachedSignIn, accessToken } from "./helpers/auth"

/**
 * Phase 15 — Quality Indicators (Indicadores de Qualidade)
 *
 * Test contract: translates the Acceptance paragraph of
 * docs/phases/accreditation-track.md §Phase 15 (~362–381) + ADR 0057 into
 * Playwright assertions. Runs against the LOCAL Supabase stack (seeded personas).
 * Run `supabase db reset --local` before a full run; `--workers=1`, chromium.
 *
 * Seeded Phase-15 dataset (supabase/seed.sql, commission A / CCIH, org rede-a,
 * hospital central-a). Values verified against the DB at authoring time:
 *
 *   IND-0001  "Adesão à higienização das mãos"  manual percentual, meta ≥ 90 %
 *     2026-03 = 84 % (fora), 2026-04 = 88 % (fora), 2026-05 = 91 % (na),
 *     2026-06 = 93 % (na).
 *   IND-0002  "Dispensadores de álcool disponíveis (%)"  derivado percentual, meta ≥ 95 %
 *     2026-06 = 2/6 = 33,33 % (fora) — EQUALS the Phase-8 dashboard aggregate
 *     (dispensador_disponivel Sim×2 over 6 submitted responses). Latest is
 *     off-target → exercises the two-tier CAPA affordance.
 *   IND-0003  "Densidade de IRAS (por 1000 pacientes-dia)"  hibrido taxa, meta ≤ 5
 *     2026-06 numerator derived ('nao'×2), denominator 900 manual → 2,22 (na).
 *   IND-0004  "Tempo médio de resposta a alertas de higienização"  manual tempo_medio, meta ≤ 24 h
 *     2026-05 = 30 h (fora), 2026-06 = 18 h (na).
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin of CCIH — authors/records; NON-operator
 *                           (not in central-a's NSP roster) → CAPA fallback only.
 *   staff1.ccih@test.local  plain staff of CCIH — RLS negative (cannot edit); also
 *                           a CCIH member, so it READS an indicator-sourced CAPA.
 *   chefe.farm@test.local   staff_admin of Farmácia (commission B, same org) —
 *                           foreign-commission read negative for CCIH indicators.
 *   admin@test.local        org_admin of rede-a (bare tenancy admin — QO·B
 *                           removed its former coercion to staff_admin, so it
 *                           now genuinely holds NO CCIH membership) AND
 *                           enrolled in central-a's PQS roster ⇒ PQS OPERATOR.
 *                           (QO·B, 2026-08-09: AC-5b no longer drives the CAPA
 *                           button through the UI — that region is WITHHELD
 *                           for a bare tenancy admin (ruling Q3), and no other
 *                           seed persona is both staff_admin/tenancy-admin of
 *                           CCIH AND a central-a PQS operator to substitute.
 *                           AC-5b now proves the UI withholding directly and
 *                           drives `open_capa_plan` through the real door
 *                           instead — see AC-5b's own header for detail.)
 *   hospitaladmin.a1@test.local  hospital_admin of central-a ONLY → rollup for
 *                           central-a's commissions; sees NOTHING of secundario-a.
 *   orgadmin.b@test.local   org_admin of rede-b → foreign rollup: no central-a rows.
 *
 * Route base: /o/{org}/c/{commission}/manage/indicadores(/{indicatorId}).
 * Hospital scorecard: /o/{org}/manage/indicadores.
 */

test.use({ viewport: { width: 1280, height: 900 } })

// These tests mutate shared indicator state (open a CAPA, record throwaway
// measurements) and assert on DB truth. They are authored to be order-independent
// (each uses unique throwaway periods + cleans up; CAPA assertions tolerate ≥1
// plan), so run them with the default isolation (NOT `serial`) — under the gate's
// `--workers=1` they still run sequentially, and one failure does not abort the
// rest (accurate per-AC pass/fail reporting).

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

const COMMISSION_A_ID = 'a0000000-0000-0000-0000-0000000000a1' // CCIH
const CENTRAL_A_HOSPITAL_ID = '05000000-0000-0000-0000-00000000000a'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!', actAs?: string) {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  // ACT (ADR 0106) — optional 4th param, additive: threads to cachedSignIn's own
  // actAs seam for admin@test.local (org_admin + pqs_member — 2 role types), which
  // otherwise lands on /selecionar-perfil (BUG-ACT-PICKER-SEED-1).
  await cachedSignIn(page, email, password, actAs)
}

/** Obtain a real JWT for a persona (owner token, RLS evaluated under it). */
async function getOwnerToken(
  page: Page,
  email: string,
  password = 'Test1234!',
  actAs?: string,
): Promise<string> {
  // ACT (ADR 0106) — delegates to the shared, hat-aware accessToken
  // (BUG-ACT-RAWGRANT-HATLESS-1). Left `actAs` UNTHREADED at AC-5b's own
  // call site deliberately — see that test's own comment: it is the
  // confirmed OR-gate finding, not a site to paper over with a hat.
  return accessToken(page, email, password, actAs)
}

/** Service-role REST query (DB-truth assertions only — never mutates data under test). */
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

/** Resolve a seeded indicator's uuid by its per-commission code (IND-000N). */
async function indicatorIdByCode(page: Page, code: string): Promise<string> {
  const rows = await serviceQuery<{ id: string }>(
    page,
    `indicators?commission_id=eq.${COMMISSION_A_ID}&code=eq.${code}&select=id`,
  )
  expect(rows.length, `indicator ${code} seeded`).toBe(1)
  return rows[0].id
}

const indicatorHref = (id: string) =>
  `/o/rede-a/c/ccih/manage/indicadores/${id}`

// ---------------------------------------------------------------------------
// AC-1: Manual indicator trend exactness — the run-chart data table classifies
//        every seeded month exactly (84/88 fora; 91/93 na) and shows the values.
// ---------------------------------------------------------------------------

test('AC-1: manual indicator (meta ≥90) run chart classifies each month exactly', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  const id = await indicatorIdByCode(page, 'IND-0001')
  await page.goto(indicatorHref(id))

  // Trend section renders with the target echoed.
  const trend = page.getByRole('region', { name: /tendência vs\. meta/i })
  await expect(trend).toBeVisible({ timeout: 15_000 })
  await expect(trend.getByText(/meta:/i)).toContainText('90')

  // The accessible data table (the SVG is aria-hidden) is the source of truth.
  const table = trend.locator('table')

  // Assert value + status per month row (period label rendered pt-BR "mmm. de aaaa").
  const rows: Array<[RegExp, string, RegExp]> = [
    [/mar\.?.*2026/i, '84 %', /fora da meta/i],
    [/abr\.?.*2026/i, '88 %', /fora da meta/i],
    [/mai\.?.*2026/i, '91 %', /na meta/i],
    [/jun\.?.*2026/i, '93 %', /na meta/i],
  ]
  for (const [period, value, status] of rows) {
    const row = table.locator('tr').filter({ has: page.locator('th', { hasText: period }) })
    await expect(row, `row for ${period}`).toHaveCount(1)
    await expect(row.locator('td').first()).toHaveText(value)
    await expect(row.getByText(status)).toBeVisible()
  }
})

// ---------------------------------------------------------------------------
// AC-2: Derived == dashboard — IND-0002 computed value equals the Phase-8
//        dashboard aggregate for the same window (2/6 = 33,33%). Asserted both
//        in the UI (measurement grid) AND via a live compute_derived_measurement
//        RPC parity check (equals the seeded value AND the raw dashboard count).
// ---------------------------------------------------------------------------

test('AC-2: derived measurement equals the dashboard aggregate (2/6 = 33,33%)', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  const id = await indicatorIdByCode(page, 'IND-0002')

  // --- DB-truth: the derived compute equals the canonical dashboard count. ---
  // Dashboard aggregate (Phase-8 spine): count of SUBMITTED, non-case-phase Form-A
  // responses whose dispensador_disponivel answer selected option code 'sim'. The
  // seed cycles sim×2 over 6 standalone submitted responses. Anchor on `answers`
  // (carries question_key) with single-level !inner embeds + dotted filters.
  const simRows = await serviceQuery<{ id: string }>(
    page,
    `answers?select=id,` +
      `selected:answer_selected_options!inner(option:form_item_options!inner(code)),` +
      `response:responses!inner(status,case_phase_id,form_version_id)` +
      `&question_key=eq.dispensador_disponivel` +
      `&selected.option.code=eq.sim` +
      `&response.status=eq.submitted` +
      `&response.case_phase_id=is.null` +
      `&response.form_version_id=eq.50000000-0000-0000-0000-00000000a001`,
  )
  expect(simRows.length, 'dashboard: dispensador=Sim over submitted Form A').toBe(2)

  // Live compute for a throwaway period → same numerator/denominator/value as the seed.
  const chefeTok = await getOwnerToken(page, 'chefe.ccih@test.local')
  const computeResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/compute_derived_measurement`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${chefeTok}`,
        'Content-Type': 'application/json',
      },
      data: { p_indicator: id, p_period_label: '2099-01' },
    },
  )
  expect(computeResp.ok()).toBeTruthy()
  const computed = (await computeResp.json()) as {
    numerator: number
    denominator: number
    value: number
  }
  expect(computed.numerator).toBe(2)
  expect(computed.denominator).toBe(6)
  expect(Number(computed.value)).toBeCloseTo(33.3333, 3)

  // Clean up the throwaway measurement (service role; not the row under UI test).
  await page.request.delete(
    `${SUPABASE_URL}/rest/v1/indicator_measurements?indicator_id=eq.${id}&period_label=eq.2099-01`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
    },
  )

  // --- UI: the measurement grid shows the seeded 33,33% row for jun. 2026. ---
  await page.goto(indicatorHref(id))
  const grid = page.getByRole('region', { name: /medições/i })
  await expect(grid).toBeVisible({ timeout: 15_000 })
  const junRow = grid
    .locator('table tr')
    .filter({ has: page.locator('th', { hasText: /jun\.?.*2026/i }) })
  await expect(junRow).toHaveCount(1)
  // Numerator 2, denominator 6, value 33,33 %.
  await expect(junRow.locator('td').nth(0)).toHaveText('2')
  await expect(junRow.locator('td').nth(1)).toHaveText('6')
  await expect(junRow.locator('td').nth(2)).toHaveText('33,33 %')
  await expect(junRow.getByText(/fora da meta/i)).toBeVisible()
})

// ---------------------------------------------------------------------------
// AC-3: tempo_medio — value equals the average of the seeded numeric answers.
//        Seeded manually: 2026-05 = 30 h (fora), 2026-06 = 18 h (na).
// ---------------------------------------------------------------------------

test('AC-3: tempo_medio values + classification match the seeded averages', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  const id = await indicatorIdByCode(page, 'IND-0004')
  await page.goto(indicatorHref(id))

  const grid = page.getByRole('region', { name: /medições/i })
  await expect(grid).toBeVisible({ timeout: 15_000 })

  const may = grid.locator('table tr').filter({ has: page.locator('th', { hasText: /mai\.?.*2026/i }) })
  await expect(may.locator('td').nth(2)).toHaveText('30 h')
  await expect(may.getByText(/fora da meta/i)).toBeVisible()

  const jun = grid.locator('table tr').filter({ has: page.locator('th', { hasText: /jun\.?.*2026/i }) })
  await expect(jun.locator('td').nth(2)).toHaveText('18 h')
  await expect(jun.getByText(/na meta/i)).toBeVisible()
})

// ---------------------------------------------------------------------------
// AC-4: Hybrid taxa one-step + preserve-on-recompute.
//        A fresh period computes in one step (derived numerator 2 + typed
//        denominator) → taxa; a recompute WITHOUT re-entering the denominator
//        preserves the stored denominator while re-deriving the numerator.
//        Driven through the UI hybrid dialog on IND-0003.
// ---------------------------------------------------------------------------

test('AC-4: hybrid taxa computes one-step and preserves the denominator on recompute', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  const id = await indicatorIdByCode(page, 'IND-0003')

  // Throwaway period LABEL = the current month. It is only an identifier here: there
  // is no seeded current-month measurement for IND-0003 (seed has 2026-06 only), so
  // this stays a clean throwaway.
  const now = new Date()
  const throwawayPeriod = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

  // BUG-P15-001 — the aggregation WINDOW is derived from the seeded data, not from
  // today's date.
  //
  // This test used to let the dialog auto-derive the window from the month label and
  // rely on "the seed's now()-relative responses are all in the current month". That
  // is false on the 1st-4th of EVERY month: the seed ages its Form-A responses by a
  // fixed `i days` (i = 1..6) and the two `dispensador_disponivel = 'nao'` rows the
  // derived numerator counts sit at i = 1 and i = 4. On the 3rd, i=4 is LAST month,
  // so a current-month window caught one of two and the test read
  // "Numerador derivado: 1" against an expected 2 — with the RPC, the seed and this
  // test's own logic all behaving correctly.
  //
  // Fixing it in `supabase/seed.sql` was tried and REVERTED: clamping the six
  // fixtures into the ~2.5 days of month available on the 3rd collapses the date
  // spread that `phase8-dashboard.spec.ts` asserts exact counts against (8 failures).
  // Near a month boundary the seed cannot satisfy both — there aren't enough days.
  // So the window is read off the actual rows instead, which is date-independent by
  // construction and touches no shared fixture.
  const sourceRows = await serviceQuery<{ submitted_at: string }>(
    page,
    'responses?status=eq.submitted' +
      '&select=submitted_at,answers!inner(question_key)' +
      '&answers.question_key=eq.dispensador_disponivel' +
      '&order=submitted_at.asc',
  )
  expect(
    sourceRows.length,
    'BUG-P15-001 guard: no submitted dispensador_disponivel responses found — the ' +
      'window below would be empty and the numerator assertion would pass vacuously',
  ).toBeGreaterThan(0)
  const windowStart = sourceRows[0].submitted_at.slice(0, 10)
  const windowEnd = sourceRows[sourceRows.length - 1].submitted_at.slice(0, 10)

  // Ensure a clean throwaway period (in case a prior partial run left it).
  await page.request.delete(
    `${SUPABASE_URL}/rest/v1/indicator_measurements?indicator_id=eq.${id}&period_label=eq.${throwawayPeriod}`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
    },
  )

  await page.goto(indicatorHref(id))
  const grid = page.getByRole('region', { name: /medições/i })
  await expect(grid).toBeVisible({ timeout: 15_000 })

  // --- ONE-STEP compute: open the top "Calcular período" dialog (hybrid). ---
  await grid.getByRole('button', { name: /calcular período/i }).first().click()
  const dialog = page.getByRole('dialog', { name: /calcular taxa/i })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  // Anchor on the month "Período" field ONLY — MINOR-1 added "Início do período"
  // / "Fim do período" date inputs that an unanchored /período/i would also match
  // (strict-mode violation). The date window auto-derives from this label.
  await dialog.getByLabel('Período', { exact: true }).fill(throwawayPeriod)
  // Override the label-derived month bounds with the real seeded span (BUG-P15-001).
  // `PeriodWindowFields` renders these as controlled inputs whose override sticks
  // once edited, so this must come AFTER the label is typed — the un-edited fields
  // track the label live, and filling them is exactly what makes them stop.
  // Nothing constrains the window to the label's month: `compute_derived_measurement`
  // uses `p_period_start`/`p_period_end` directly (`sr.submitted_at::date >= v_from`),
  // so a span crossing a month boundary is legal, which is the whole point here.
  await dialog.getByLabel('Início do período').fill(windowStart)
  await dialog.getByLabel('Fim do período').fill(windowEnd)
  // Manual denominator 1000 → taxa = 2/1000*1000 = 2 (numerator derived = 'nao'×2).
  await dialog.getByLabel(/pacientes-dia|denominador/i).fill('1000')
  await dialog.getByRole('button', { name: /^calcular$/i }).click()

  // The dialog echoes the derived numerator + computed value on success.
  await expect(dialog.getByRole('status')).toContainText(/taxa calculada/i, { timeout: 10_000 })
  await expect(dialog.getByRole('status')).toContainText('2')

  // DB truth after one-step compute: numerator derived = 2, denominator = 1000, value = 2.
  await expect
    .poll(
      async () =>
        (await serviceQuery<{ numerator: number; denominator: number; value: number }>(
          page,
          `indicator_measurements?indicator_id=eq.${id}&period_label=eq.${throwawayPeriod}&select=numerator,denominator,value`,
        ))[0],
      { timeout: 10_000 },
    )
    .toMatchObject({ numerator: 2, denominator: 1000 })

  // --- PRESERVE-ON-RECOMPUTE via the RPC without re-passing the denominator. ---
  // (The UI edit path leaves the denominator blank; assert the invariant directly.)
  const chefeTok = await getOwnerToken(page, 'chefe.ccih@test.local')
  const recompute = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/compute_derived_measurement`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${chefeTok}`,
        'Content-Type': 'application/json',
      },
      data: { p_indicator: id, p_period_label: throwawayPeriod }, // NO p_denominator
    },
  )
  expect(recompute.ok()).toBeTruthy()
  const after = (await recompute.json()) as { numerator: number; denominator: number; value: number }
  expect(after.numerator).toBe(2) // re-derived
  expect(Number(after.denominator)).toBe(1000) // PRESERVED
  expect(Number(after.value)).toBeCloseTo(2, 3)

  // Cleanup the throwaway period.
  await page.request.delete(
    `${SUPABASE_URL}/rest/v1/indicator_measurements?indicator_id=eq.${id}&period_label=eq.${throwawayPeriod}`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
    },
  )
})

// ---------------------------------------------------------------------------
// AC-5a: Two-tier CAPA — a NON-OPERATOR staff_admin sees ONLY the action-item
//         fallback (not the CAPA button) on the off-target IND-0002.
// ---------------------------------------------------------------------------

test('AC-5a: non-operator staff_admin sees only the action-item fallback (no CAPA button)', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  const id = await indicatorIdByCode(page, 'IND-0002')
  await page.goto(indicatorHref(id))

  const capa = page.getByRole('region', { name: /plano de ação/i })
  await expect(capa).toBeVisible({ timeout: 15_000 })
  // Off-target copy present.
  await expect(capa.getByText(/última medição está fora da meta/i)).toBeVisible()
  // The operator-only "Abrir plano de ação (CAPA)" button must be ABSENT.
  await expect(capa.getByRole('button', { name: /abrir plano de ação \(capa\)/i })).toHaveCount(0)
  // The fallback "Criar item de ação" affordance IS present.
  await expect(capa.getByRole('button', { name: /criar item de ação/i })).toBeVisible()
})

// ---------------------------------------------------------------------------
// AC-5b: Two-tier CAPA — a PQS OPERATOR (admin@test.local = org_admin of rede-a
//         AND central-a PQS roster member) opens a CAPA; the plan carries
//         source_indicator_id + the derived central-a hospital_id, and a CCIH
//         member (staff1.ccih) can READ it.
//
//         ⛔ QO·B, 2026-08-09 — REWRITTEN, not just re-personaed. The UI half of
//         this AC is now UNREACHABLE BY CONSTRUCTION and no seed persona can
//         restore it, which is worth spelling out because it looks at first
//         like a simple swap:
//           - The indicator detail page's OUTER gate is `canConfigureCommission`
//             (staff_admin OR tenancy admin) — a plain `staff` member never
//             passed it, QO·B or not (Phase 15 always scoped "Indicadores" to
//             staff_admin — app-sidebar.tsx NAV_GROUPS). Tried pqsdual.a (a
//             real CCIH `staff` + central-a PQS operator) first; it 404s here,
//             proving the point.
//           - The INNER gate for the measurement/CAPA half is `role !== null`
//             (ruling Q3) — admin@ passes the outer gate (isTenancyAdmin) but
//             now fails this one (role is genuinely null, the coercion is
//             gone), so the CAPA button never renders for it either.
//           - Central-a's PQS roster is {pqs.a, admin, pqsdual.a} (seed
//             header) — NONE of the other two hold staff_admin/tenancy-admin
//             standing on CCIH, so no combination of an existing persona
//             clears BOTH gates at once. This AC's UI path is provably
//             untestable with the current seed, not merely re-personaed.
//         So: the UI-reach assertion is REPLACED with the one this file can
//         actually prove today (the page renders, the CAPA region is
//         withheld — matching e2e/qob-org-admin-content-wall.spec.ts's own
//         Q3-split test), and the operator-tier AUTHORIZATION + DATA CONTRACT
//         (plan creation, hospital_id derivation, the commission-member READ
//         arm, the foreign-staff_admin DENIAL) is proven the same way AC-6
//         already proves loop closure: through the real `open_capa_plan` door,
//         whose SQL-level gate (`is_tenancy_admin_of` OR PQS-operator) was
//         never touched by QO·B and still authorizes admin@ end to end.
// ---------------------------------------------------------------------------

test('AC-5b: PQS operator opens a CAPA — plan carries indicator + derived hospital, readable by commission members', async ({ page }) => {
  // canConfigureCommission admits a tenancy admin (the test's own comment
  // below) — org_admin is the hat that makes that arm hold.
  await signInAs(page, 'admin@test.local', undefined, 'org_admin')
  const id = await indicatorIdByCode(page, 'IND-0002')
  await page.goto(indicatorHref(id))

  // The DEFINITION half renders (canConfigureCommission admits a tenancy
  // admin); the CAPA/measurement half is WITHHELD (role === null, ruling Q3) —
  // the button this AC used to click is provably gone, not merely hidden.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('region', { name: /plano de ação/i })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Medições', level: 2 })).toBeVisible()

  // The operator-tier AUTHORIZATION itself is unaffected by QO·B — proven
  // through the real door `open_capa_plan`, exactly as AC-6 below does for
  // loop closure. Its SQL gate is `is_tenancy_admin_of(source_commission)
  // OR is_pqs_operator_of(hospital)`, neither arm touched by the QO·B
  // migrations (M1–M6 never mention CAPA doors).
  //
  // ⛔ ACT (ADR 0106), BUG-ACT-RAWGRANT-HATLESS-1 finding, reported not
  // fixed (2026-08-10): this call is DELIBERATELY left hatless. Threading
  // EITHER hat would misrepresent what this test proves. This test's own
  // UI half (lines above) required 'org_admin' to pass canConfigureCommission
  // (a tenancy-admin gate); this RPC half is titled "PQS operator opens a
  // CAPA" and its comment above frames the claim as the PQS-OPERATOR arm
  // specifically — but that arm is `is_pqs_operator_of`, which 'org_admin'
  // does NOT satisfy. Pre-cutover, one hatless admin@ session carried the
  // UNION of both arms simultaneously (this is exactly the class of test
  // BUG-ACT-PICKER-SEED-1 was found investigating), so both halves passed
  // together without the test ever having to choose. Post-cutover, no
  // single hat serves both halves: 'org_admin' would pass the UI, fail the
  // RPC (confirmed live — see PROGRESS.md); 'pqs_member' would fail the UI
  // before ever reaching this line. This is a genuine structural
  // incompatibility in the test's own construction, not a missing actAs
  // pick — filed, not silently forced. Left RED.
  const adminTok = await getOwnerToken(page, 'admin@test.local')
  const openResp = await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/open_capa_plan`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${adminTok}`,
      'Content-Type': 'application/json',
    },
    data: { p_source: 'indicator', p_classification: 'corretiva', p_source_id: id },
  })
  expect(openResp.ok(), 'open_capa_plan still authorizes the PQS operator').toBeTruthy()

  await expect
    .poll(
      async () =>
        (
          await serviceQuery<{ id: string; hospital_id: string; source: string }>(
            page,
            `capa_plan?source=eq.indicator&source_indicator_id=eq.${id}&select=id,hospital_id,source`,
          )
        ).length,
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(1)

  const plans = await serviceQuery<{ id: string; hospital_id: string; source_indicator_id: string }>(
    page,
    `capa_plan?source=eq.indicator&source_indicator_id=eq.${id}&select=id,hospital_id,source_indicator_id`,
  )
  const plan = plans[0]
  expect(plan.source_indicator_id).toBe(id)
  // hospital_id derived from the indicator's commission → central-a.
  expect(plan.hospital_id).toBe(CENTRAL_A_HOSPITAL_ID)

  // Commission-member read arm: staff1.ccih (a plain CCIH member) can READ the plan
  // via can_read_capa's indicator arm — a JWT read returns the row.
  const staffTok = await getOwnerToken(page, 'staff1.ccih@test.local')
  const readResp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/capa_plan?id=eq.${plan.id}&select=id,source_indicator_id`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${staffTok}` } },
  )
  expect(readResp.ok()).toBeTruthy()
  const readRows = (await readResp.json()) as unknown[]
  expect(readRows.length, 'CCIH member reads the indicator-sourced CAPA').toBe(1)

  // A foreign-commission staff_admin (Farmácia B) must NOT read it.
  const farmTok = await getOwnerToken(page, 'chefe.farm@test.local')
  const farmResp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/capa_plan?id=eq.${plan.id}&select=id`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${farmTok}` } },
  )
  const farmRows = (await farmResp.json()) as unknown[]
  expect(farmRows.length, 'foreign staff_admin cannot read the CAPA').toBe(0)
})

// ---------------------------------------------------------------------------
// AC-6: Loop closure across Phases 14+15 — a CAPA effectiveness measure can cite
//        an indicator + a later (improved) measurement. Reachability note: the
//        effectiveness UI lives in the NSP console; here we assert the DB-level
//        linkage the schema provides (capa_measure.indicator_id FK resolves) end
//        to end from the indicator-sourced plan created in AC-5b.
// ---------------------------------------------------------------------------

test('AC-6: loop closure — a CAPA measure can cite the indicator (capa_measure.indicator_id FK resolves)', async ({ page }) => {
  const id = await indicatorIdByCode(page, 'IND-0002')

  // Open a plan as the operator (idempotent enough — asserts on the resulting row).
  // ACT (ADR 0106): 'pqs_member' — unlike AC-5b, this test has no earlier
  // UI-navigation half needing a different hat (indicatorIdByCode above
  // reads via the service role, not this page's own session), so the
  // operator arm alone is unambiguous here.
  const adminTok = await getOwnerToken(page, 'admin@test.local', undefined, 'pqs_member')
  await page.request.post(`${SUPABASE_URL}/rest/v1/rpc/open_capa_plan`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${adminTok}`,
      'Content-Type': 'application/json',
    },
    data: { p_source: 'indicator', p_classification: 'corretiva', p_source_id: id },
  })

  const plans = await serviceQuery<{ id: string }>(
    page,
    `capa_plan?source=eq.indicator&source_indicator_id=eq.${id}&select=id&order=created_at.desc&limit=1`,
  )
  expect(plans.length).toBeGreaterThanOrEqual(1)
  const capaId = plans[0].id

  // The later (improved) measurement to cite — the seeded 93% month on IND-0001
  // (an on-target value that documents improvement). Any measurement works to
  // prove the FK; we use the manual indicator's best month.
  const manualId = await indicatorIdByCode(page, 'IND-0001')
  const laterMeas = await serviceQuery<{ id: string }>(
    page,
    `indicator_measurements?indicator_id=eq.${manualId}&period_label=eq.2026-06&select=id`,
  )
  expect(laterMeas.length).toBe(1)

  // Insert a CAPA effectiveness measure citing the indicator (service role — the
  // effectiveness authoring UI is NSP-console; the FK linkage is what closes the
  // loop across Phases 14+15). Assert the FK resolves via an embed.
  const insertResp = await page.request.post(`${SUPABASE_URL}/rest/v1/capa_measure`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: {
      capa_id: capaId,
      indicator_id: manualId,
      name: 'Verificação de eficácia — melhoria sustentada do indicador',
      target: '≥ 90 %',
      definition: 'Adesão à higienização das mãos no período posterior à ação corretiva.',
      position: 99,
    },
  })
  // If capa_measure requires other NOT NULL columns, surface that as a finding
  // rather than a silent skip.
  expect(
    insertResp.ok(),
    `capa_measure insert citing indicator failed (${insertResp.status()}): ${await insertResp.text()}`,
  ).toBeTruthy()

  // The FK resolves: embed the indicator from the measure by its indicator_id.
  const linked = await serviceQuery<{ id: string; indicator_id: string; indicator: { code: string } | null }>(
    page,
    `capa_measure?capa_id=eq.${capaId}&indicator_id=eq.${manualId}` +
      `&select=id,indicator_id,indicator:indicators!capa_measure_indicator_id_fkey(code)`,
  )
  expect(linked.length).toBeGreaterThanOrEqual(1)
  expect(linked[0].indicator_id).toBe(manualId)
  expect(linked[0].indicator?.code).toBe('IND-0001')

  // Cleanup the effectiveness rows we inserted (keep the seed clean for reuse).
  await page.request.delete(
    `${SUPABASE_URL}/rest/v1/capa_measure?capa_id=eq.${capaId}&indicator_id=eq.${manualId}`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
    },
  )
})

// ---------------------------------------------------------------------------
// AC-7: Audited measurement edit — correcting a measurement writes an audit row
//        (Phase 13). The audit surface does not render indicator entities (the
//        entity/action slugs are outside the audit UI union), so we assert the
//        audit_log row directly (service-role DB truth) after a UI edit.
// ---------------------------------------------------------------------------

test('AC-7: editing a manual measurement writes an indicator_measurement.updated audit row', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  const id = await indicatorIdByCode(page, 'IND-0001')

  // Audit rows before the edit (for this measurement entity).
  const before = await serviceQuery<{ id: string }>(
    page,
    `audit_log?action=eq.indicator_measurement.updated&entity_type=eq.indicator_measurement&select=id`,
  )
  const beforeCount = before.length

  await page.goto(indicatorHref(id))
  const grid = page.getByRole('region', { name: /medições/i })
  await expect(grid).toBeVisible({ timeout: 15_000 })

  // Edit the 2026-03 row (currently 84). Open its "Editar" (ghost) dialog.
  const marRow = grid.locator('table tr').filter({ has: page.locator('th', { hasText: /mar\.?.*2026/i }) })
  await marRow.getByRole('button', { name: /^editar$/i }).click()
  const dialog = page.getByRole('dialog', { name: /corrigir medição/i })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  // Bump the numerator 84 → 85 (still off-target) and save.
  const numerator = dialog.getByLabel(/higienizações corretas|numerador/i)
  await numerator.fill('85')
  await dialog.getByRole('button', { name: /^salvar$/i }).click()
  await expect(dialog).toBeHidden({ timeout: 10_000 })

  // The value updated in the grid.
  await expect(marRow.locator('td').nth(0)).toHaveText('85', { timeout: 10_000 })

  // A new indicator_measurement.updated audit row exists (DB truth).
  await expect
    .poll(
      async () =>
        (
          await serviceQuery<{ id: string }>(
            page,
            `audit_log?action=eq.indicator_measurement.updated&entity_type=eq.indicator_measurement&select=id`,
          )
        ).length,
      { timeout: 10_000 },
    )
    .toBeGreaterThan(beforeCount)
})

// ---------------------------------------------------------------------------
// AC-8a: RLS — a plain `staff` cannot edit indicators (record_indicator_measurement
//         is rejected by the RPC), and cannot reach the coordinator indicator area.
// ---------------------------------------------------------------------------

test('AC-8a: plain staff cannot edit indicators (RPC rejects; area 404)', async ({ page }) => {
  // JWT: staff1.ccih attempts to record a measurement on IND-0001 → forbidden.
  const staffTok = await getOwnerToken(page, 'staff1.ccih@test.local')
  const id = (
    await serviceQuery<{ id: string }>(
      page,
      `indicators?commission_id=eq.${COMMISSION_A_ID}&code=eq.IND-0001&select=id`,
    )
  )[0].id
  const resp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/record_indicator_measurement`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${staffTok}`,
        'Content-Type': 'application/json',
      },
      data: { p_indicator: id, p_period_label: '2097-01', p_numerator: 1, p_denominator: 2 },
    },
  )
  // The RPC is is_staff_admin_of OR is_tenancy_admin_of gated → 42501 forbidden.
  expect(resp.status(), 'record_indicator_measurement forbidden for plain staff').toBe(403)

  // No row was written (RLS/RPC authority held).
  const written = await serviceQuery<{ id: string }>(
    page,
    `indicator_measurements?indicator_id=eq.${id}&period_label=eq.2097-01&select=id`,
  )
  expect(written.length).toBe(0)

  // UI: the coordinator indicator area 404s for plain staff.
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/indicadores')
  await expect(
    page.getByRole('heading', { name: /encontramos esta página|Erro 404/i }),
  ).toBeVisible({ timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// AC-8b: RLS — a foreign-commission user gets NO read of commission A's
//         indicators (JWT read returns empty; the detail URL 404s with no leak).
// ---------------------------------------------------------------------------

test('AC-8b: foreign-commission user cannot read commission A indicators', async ({ page }) => {
  const id = await indicatorIdByCode(page, 'IND-0001')

  // JWT read of CCIH indicators as chefe.farm (Farmácia, commission B) → empty.
  const farmTok = await getOwnerToken(page, 'chefe.farm@test.local')
  const readResp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/indicators?commission_id=eq.${COMMISSION_A_ID}&select=id,name`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${farmTok}` } },
  )
  expect(readResp.status()).toBe(200)
  expect(((await readResp.json()) as unknown[]).length, 'foreign read of CCIH indicators is empty').toBe(0)

  // UI: accessing CCIH's indicator detail through the Farmácia URL namespace 404s.
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/manage/indicadores/${id}`)
  await expect(
    page.getByRole('heading', { name: /encontramos esta página|Erro 404/i }),
  ).toBeVisible({ timeout: 10_000 })
  // No CCIH indicator content leaked.
  const body = await page.locator('body').textContent()
  expect(body).not.toMatch(/Adesão à higienização das mãos/i)
})

// ---------------------------------------------------------------------------
// AC-8c: RLS rollup — a hospital_admin of central-a sees the rollup across its
//         commissions (CCIH shows ≥1 indicator, with the seeded off-target count);
//         a foreign hospital_admin (org-b) sees NO central-a rows.
// ---------------------------------------------------------------------------

test('AC-8c: hospital_admin sees its rollup; a foreign hospital_admin sees nothing', async ({ page }) => {
  // DB truth: the rollup DEFINER for central-a, called as the hospital_admin, returns
  // CCIH with its indicator counts; called for the same hospital as a foreign admin
  // returns nothing.
  const hospAdminTok = await getOwnerToken(page, 'hospitaladmin.a1@test.local')
  const rollupResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/hospital_indicator_rollup`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${hospAdminTok}`,
        'Content-Type': 'application/json',
      },
      data: { p_hospital: CENTRAL_A_HOSPITAL_ID },
    },
  )
  expect(rollupResp.ok()).toBeTruthy()
  const rollup = (await rollupResp.json()) as Array<{
    commission_name: string
    total: number
    off_target: number
  }>
  const ccih = rollup.find((r) => /infecção|ccih/i.test(r.commission_name))
  expect(ccih, 'central-a rollup includes CCIH').toBeTruthy()
  expect(ccih!.total).toBeGreaterThanOrEqual(4) // 4 seeded active indicators
  // The seeded latest-measurement classification: 3 fora (IND-0001 latest is na,
  // but IND-0002 fora; the rollup counts by latest per indicator) — assert ≥1 fora.
  expect(ccih!.off_target).toBeGreaterThanOrEqual(1)

  // Foreign hospital_admin (org-b's org_admin has NO hospital_admin grant on central-a).
  const foreignTok = await getOwnerToken(page, 'orgadmin.b@test.local')
  const foreignResp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/hospital_indicator_rollup`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${foreignTok}`,
        'Content-Type': 'application/json',
      },
      data: { p_hospital: CENTRAL_A_HOSPITAL_ID },
    },
  )
  // The DEFINER re-gates per hospital → empty for a caller with no standing there.
  const foreignRollup = (await foreignResp.json()) as unknown[]
  expect(Array.isArray(foreignRollup) ? foreignRollup.length : 0, 'foreign admin sees no central-a rollup').toBe(0)

  // UI: the hospital_admin scorecard page renders central-a with its CCIH row.
  // (The scorecard <section> carries an aria-labelledby whose id contains spaces,
  // so it is not exposed as a named region — target the heading + table directly.)
  await signInAs(page, 'hospitaladmin.a1@test.local')
  await page.goto('/o/rede-a/manage/indicadores')
  await expect(
    page.getByRole('heading', { name: /hospital central a/i, level: 2 }),
  ).toBeVisible({ timeout: 15_000 })
  const scorecardTable = page.getByRole('table', { name: /situação dos indicadores.*hospital central a/i })
  await expect(scorecardTable).toBeVisible()
  // The CCIH row: rowheader + Total cell = 4.
  const ccihRow = scorecardTable
    .locator('tr')
    .filter({ has: page.getByRole('rowheader', { name: /infecção|ccih/i }) })
  await expect(ccihRow).toHaveCount(1)
  await expect(ccihRow.getByRole('cell').first()).toHaveText('4')
})

// ---------------------------------------------------------------------------
// AC-9: Keyboard-only flow — drive the MANUAL measurement dialog entirely by
//        keyboard (tab/enter/type), asserting focus at each step + completion.
// ---------------------------------------------------------------------------

test('AC-9: keyboard-only — record a manual measurement via the dialog', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  const id = await indicatorIdByCode(page, 'IND-0001')

  // Clean any prior throwaway period.
  await page.request.delete(
    `${SUPABASE_URL}/rest/v1/indicator_measurements?indicator_id=eq.${id}&period_label=eq.2096-02`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
    },
  )

  await page.goto(indicatorHref(id))
  const grid = page.getByRole('region', { name: /medições/i })
  await expect(grid).toBeVisible({ timeout: 15_000 })

  // Focus + activate the header "Registrar medição" trigger by keyboard.
  const trigger = grid.getByRole('button', { name: /registrar medição/i })
  await trigger.focus()
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: /registrar medição/i })
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  // Type into Período (radix moves focus into the dialog; Tab to reach fields).
  const period = dialog.getByLabel(/^período$/i)
  await period.focus()
  await expect(period).toBeFocused()
  await page.keyboard.type('2096-02')

  // MINOR-1 inserted the "Início do período" / "Fim do período" native date inputs
  // between Período and the numerator; typing a valid YYYY-MM label auto-populates
  // both (see PeriodWindowFields). Native type="date" inputs have internal segments,
  // so a tab-count-based crossing is flaky — land directly on the numerator by
  // focus (matches this test's .focus()-driven keyboard style for the trigger/Salvar).
  const numerator = dialog.getByLabel(/higienizações corretas|numerador/i)
  await numerator.focus()
  await expect(numerator).toBeFocused()
  await page.keyboard.type('95')

  await page.keyboard.press('Tab')
  const denominator = dialog.getByLabel(/oportunidades observadas|denominador/i)
  await expect(denominator).toBeFocused()
  await page.keyboard.type('100')

  // Submit by keyboard: focus the Salvar button and press Enter.
  const save = dialog.getByRole('button', { name: /^salvar$/i })
  await save.focus()
  await expect(save).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(dialog).toBeHidden({ timeout: 10_000 })

  // Completion: a new 2096-02 row = 95 % (na meta) appears.
  const newRow = grid.locator('table tr').filter({ has: page.locator('th', { hasText: /fev\.?.*2096/i }) })
  await expect(newRow).toHaveCount(1, { timeout: 10_000 })
  await expect(newRow.locator('td').nth(2)).toHaveText('95 %')

  // Cleanup.
  await page.request.delete(
    `${SUPABASE_URL}/rest/v1/indicator_measurements?indicator_id=eq.${id}&period_label=eq.2096-02`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
    },
  )
})
