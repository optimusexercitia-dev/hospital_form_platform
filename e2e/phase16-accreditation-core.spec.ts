import { test, expect, type Page, type Locator } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import {
  CCIH_FORM_HIGIENE,
  CHEFE_CCIH,
  CHEFE_FARM,
  COMMISSION_CCIH,
  COMMISSION_FARMACIA,
  HOSPITALADMIN_A1,
  ORG_A,
  CCIH_SLUG,
  FARM_SLUG,
  PLATFORM,
  STAFF1_CCIH,
  UID_CHEFE_CCIH,
  createFrameworkRpc,
  getToken,
  insertIndicatorMeasurement,
  insertSignedMeeting,
  linkEvidenceRpc,
  lookupIndicatorId,
  purgeFrameworks,
  purgeIndicatorMeasurements,
  purgeMeetings,
  readFeatureFlag,
  readinessReportRpc,
  setAssessmentRpc,
  setFeatureFlag,
  sqlOne,
  sqlRows,
  upsertStandardRpc,
} from './helpers/accreditation'

/**
 * Phase 16 — Standards Crosswalk & Readiness/Gap Engine v2 (ADR 0093).
 * Acceptance criteria covered (docs/plans/phase-16-standards-crosswalk-program.md,
 * Wave 3 Tester block, spec 1 of 5):
 *
 *   AC-0  the flag harness itself: OFF → the route 404s; ON → it renders. Run
 *         FIRST, with the flag under this test's own explicit control both
 *         ways — BUG-P16-002's lesson ("a suite that runs with the flag off
 *         passes by certifying 404s") is the one thing this whole file must
 *         not be blind to.
 *   AC-1  the standards tree renders Nível badges; linking a form + meeting +
 *         indicator as evidence, then assessing `conforme`, leaves the
 *         standard evidenced and OUT of the gap list; assessing a sibling
 *         standard `nao_conforme` puts IT in the gap list — asserted against
 *         the exact hand-computed `computeReadinessRollups()` numbers
 *         (`src/lib/accreditation/rollups.ts`), not mere presence.
 *   AC-2  `staff1.ccih` (plain staff) has no edit affordance (the WHOLE
 *         `manage/acreditacao` route is staff_admin-gated at the layout — a
 *         plain staff 404s before any UI renders) AND a forced direct RPC
 *         attempt is rejected server-side (42501).
 *   AC-3  `chefe.farm` (staff_admin of a DIFFERENT commission) cannot link a
 *         CCIH-owned artifact as evidence for Farmácia — HC0QA. The evidence
 *         picker's own candidate search is commission-scoped, so this is
 *         necessarily a forced direct-RPC probe, not a UI click-through (the
 *         foreign form never appears as a pickable candidate in the first
 *         place, which is itself part of what makes HC0QA correct).
 *   AC-4  every accreditation write above emitted an `audit_log` row (Rule
 *         11) — `evidence_link.created` × 3, `standard_assessment.created` × 2.
 *   AC-5  keyboard-only: tree (expand/collapse a branch, navigate to a leaf)
 *         → assessment form (native-select + textarea + save, all by
 *         keyboard) → evidence picker (kind select, debounced ARIA combobox,
 *         arrow + Enter to commit) → link.
 *
 * ## Fixture
 *
 * A dedicated GLOBAL framework (`create_framework` as `platform@test.local` —
 * D6's one legitimate `is_admin()` arm, the vocabulary/catalog CRUD), so BOTH
 * CCIH and Farmácia can reach its standards — required for AC-3's
 * cross-commission HC0QA (a commission-owned framework is readable ONLY by
 * its own commission's members per Amendment 1 A1·2, which would make AC-3
 * untestable). Standards: STD_A/STD_B (level 1, AC-1's rollup pair) + STD_C/
 * STD_C1 (level 1 + a level-1 CHILD, minted fresh inside AC-5 so the earlier
 * rollup numbers in AC-1 stay exactly "1 of 2" — adding a third level-1
 * standard before AC-1 runs would change that arithmetic).
 *
 * Supporting artifacts (raw SQL, NOT under test — only their READ-SIDE
 * freshness classification, `app.evidence_status_of`, is; see
 * `helpers/accreditation.ts`'s header): a `signed` CCIH meeting + a
 * same-day `on_target` measurement on two DIFFERENT existing CCIH indicators
 * (one per evidence-linking test, so AC-1 and AC-5 never contend over which
 * measurement is "latest" on a shared indicator). The evidenced form is the
 * SEEDED, already-published "Checklist de Higienização das Mãos" — read-only,
 * never mutated.
 *
 * Self-fixtures; identity-based cleanup (never positional — the seed row
 * this file borrows, `CCIH_FORM_HIGIENE`, is asserted to SURVIVE in
 * `afterAll`). Personas password `Test1234!`.
 *
 * Run together with the other 4 phase16 specs via
 * `npx playwright test e2e/phase16-*.spec.ts --project=chromium --workers=1`
 * (see `helpers/accreditation.ts`'s header — `fullyParallel: true` would
 * otherwise let spec FILES race the shared `app.feature_flags` row).
 */

// NOT `mode: 'serial'` — every test in this file is independent (each mints
// its own standard(s) and/or seeds its own precondition via RPC rather than
// depending on an earlier test's side effect), so with `--workers=1` a
// failure in one test (e.g. AC-1/AC-5, currently blocked by BUG-P16-004)
// does not skip the rest — every test reports its own real status in one run.
test.use({ viewport: { width: 1280, height: 1000 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

const SPEC_TAG = 'P16-1'
const FRAMEWORK_KEY = 'p16-core-spec-global'
const STD_A_CODE = 'P16-1-A'
const STD_A_TITLE = 'Higiene das maos padrao alfa P16'
const STD_B_CODE = 'P16-1-B'
const STD_B_TITLE = 'Vigilancia epidemiologica padrao beta P16'
const STD_C_CODE = 'P16-1-C'
const STD_C_TITLE = 'Governanca clinica padrao gama P16'
const STD_C1_CODE = 'P16-1-C1'
const STD_C1_TITLE = 'Subpadrao delta teclado P16'

/** Two DIFFERENT existing CCIH indicators (mensal, active) — one per test that
 *  links indicator evidence, so no two tests fight over which measurement is
 *  "latest" on one indicator (evidence_status_of takes the single latest row
 *  inside the window). Verified live: both otherwise carry only a stale
 *  (2026-06, outside-window) seeded measurement.
 *
 *  Resolved by NATURAL KEY in `beforeAll`, never hardcoded — seed.sql's CCIH
 *  indicator block has no explicit `id` column, so `gen_random_uuid()`
 *  assigns a fresh id on every `supabase db reset` (BUG-P16-006). */
let INDICATOR_AC1: string // "Adesão à higienização das mãos"
let INDICATOR_AC5: string // "Tempo médio de resposta a alertas de higienização"

let frameworkId: string
let stdAId: string
let stdBId: string
let meetingId: string
const measurementIds: string[] = []

async function signInAs(page: Page, email: string) {
  await cachedSignIn(page, email, 'Test1234!')
}

test.beforeAll(async ({ browser }) => {
  setFeatureFlag('accreditation', true)

  INDICATOR_AC1 = lookupIndicatorId(COMMISSION_CCIH, 'Adesão à higienização das mãos')
  INDICATOR_AC5 = lookupIndicatorId(COMMISSION_CCIH, 'Tempo médio de resposta a alertas de higienização')

  const page = await browser.newPage()
  const platformToken = await getToken(page, PLATFORM)

  const fw = await createFrameworkRpc(page, platformToken, {
    key: FRAMEWORK_KEY,
    name: `${SPEC_TAG} Framework Global`,
    ownerCommission: null,
  })
  expect(fw.ok, `create_framework: ${fw.text}`).toBeTruthy()
  frameworkId = fw.json.id

  const a = await upsertStandardRpc(page, platformToken, {
    framework: frameworkId,
    code: STD_A_CODE,
    title: STD_A_TITLE,
    level: 1,
    position: 0,
  })
  expect(a.ok, `upsert_standard A: ${a.text}`).toBeTruthy()
  stdAId = a.json.id

  const b = await upsertStandardRpc(page, platformToken, {
    framework: frameworkId,
    code: STD_B_CODE,
    title: STD_B_TITLE,
    level: 1,
    position: 1,
  })
  expect(b.ok, `upsert_standard B: ${b.text}`).toBeTruthy()
  stdBId = b.json.id

  meetingId = insertSignedMeeting(COMMISSION_CCIH, `${SPEC_TAG} reuniao evidencia`, UID_CHEFE_CCIH)
  measurementIds.push(
    insertIndicatorMeasurement({
      indicatorId: INDICATOR_AC1,
      status: 'on_target',
      periodLabel: `${SPEC_TAG}-ac1`,
      enteredBy: UID_CHEFE_CCIH,
    }),
  )

  await page.close()
})

test.afterAll(() => {
  purgeFrameworks([frameworkId])
  purgeMeetings([meetingId])
  purgeIndicatorMeasurements(measurementIds)

  // Tripwire: the seeded, read-only-borrowed form survives this file untouched.
  expect(sqlOne(`select title from public.forms where id = '${CCIH_FORM_HIGIENE.id}';`)).toBe(
    CCIH_FORM_HIGIENE.title,
  )
})

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function frameworkListUrl() {
  return `/o/${ORG_A}/c/${CCIH_SLUG}/manage/acreditacao`
}
function frameworkUrl() {
  return `/o/${ORG_A}/c/${CCIH_SLUG}/manage/acreditacao/${frameworkId}`
}
function standardUrl(standardId: string) {
  return `/o/${ORG_A}/c/${CCIH_SLUG}/manage/acreditacao/${frameworkId}/padrao/${standardId}`
}

function treeNav(page: Page): Locator {
  return page.getByRole('navigation', { name: /^Padrões de/ })
}

async function openLinkDialog(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Vincular evidência' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  return dialog
}

/** Every non-charter kind uses the debounced ARIA combobox (EvidenceCombobox). */
async function pickEvidenceViaCombobox(
  dialog: Locator,
  kind: string,
  kindLabel: string,
  query: string,
  optionMatch: RegExp,
) {
  await dialog.getByLabel('Tipo de evidência').selectOption(kind)
  const input = dialog.getByRole('combobox', { name: kindLabel })
  await input.click()
  await input.fill(query)
  await dialog.getByRole('option', { name: optionMatch }).first().click()
}

async function submitLinkDialog(dialog: Locator) {
  await dialog.getByRole('button', { name: 'Vincular', exact: true }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })
}

/**
 * Keyboard-only combobox selection: press ArrowDown until the highlighted
 * option's OWN text contains `matchText`, then Enter. A single blind
 * ArrowDown assumes the wanted candidate is at a known index — unsafe here,
 * since the combobox auto-highlights index 0 the moment ANY result set
 * resolves, including a stale/unfiltered baseline fetch that can still be
 * in flight when the debounced, query-filtered result lands (the
 * `ff5-references.spec.ts` `arrowToOption` lesson — reproduced live: a bare
 * single ArrowDown committed "Densidade de IRAS" instead of "Tempo médio de
 * resposta"). Walking until the highlighted TEXT matches proves the same
 * "arrow moves the highlight" contract without assuming an ordering.
 */
async function arrowToOption(page: Page, input: Locator, matchText: string, maxSteps = 8): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    const activeId = await input.getAttribute('aria-activedescendant')
    if (activeId) {
      const text = await page.locator(`#${activeId}`).textContent()
      if (text?.includes(matchText)) return
    }
    await page.keyboard.press('ArrowDown')
  }
  throw new Error(`arrowToOption: never highlighted an option containing "${matchText}"`)
}

async function setAssessmentViaUI(page: Page, status: string, note?: string) {
  const select = page.getByLabel('Status de conformidade')
  await select.selectOption(status)
  if (note) await page.getByLabel(/^Observações/).fill(note)
  await page.getByRole('button', { name: 'Salvar autoavaliação' }).click()
  await expect(page.getByText('Autoavaliação salva.')).toBeVisible({ timeout: 15_000 })
}

// ===========================================================================
// AC-0 — the flag harness self-test (run first; proves the harness CAN fail)
// ===========================================================================

test('AC-0 flag harness: OFF renders 404 on the route, ON renders real content', async ({
  page,
}) => {
  // NOT `resp.status()`: this route (and every `manage/acreditacao/**` route)
  // has a sibling `loading.tsx`, so Next.js wraps the segment in a Suspense
  // boundary and commits the HTTP response (200, the loading skeleton) BEFORE
  // the async `notFound()` check inside the page/layout resolves — an HTTP
  // status, once sent, cannot retroactively become 404. Verified live: with
  // the flag OFF, `page.goto()` returns status 200 every time. The 404 is real
  // but only observable in the eventually-resolved DOM, so that is what this
  // harness proof asserts on.
  //
  // Targets the HOSPITAL surface (`hospitaladmin.a1`), not the commission
  // framework list/tree — BOTH of those currently crash for a Server
  // Component forwarding a closure prop across a Client Component boundary
  // (BUG-P16-003 on the list, BUG-P16-004 on the framework/standard layout —
  // filed; unrelated to the flag mechanism itself). The hospital surface sits
  // behind the exact same `accreditationEnabled()` gate and has no such prop
  // crossing, so it proves exactly what AC-0 needs to prove without routing
  // through pages that are independently broken for a different reason. It
  // needs no fixture data — the empty state still renders the real H1.
  await signInAs(page, HOSPITALADMIN_A1)
  const hospitalUrl = `/o/${ORG_A}/manage/acreditacao`

  // BUG-ACT-NOTFOUND-COPY-1: this ORG-tier route hits src/app/o/[org]/manage/
  // not-found.tsx (a DIFFERENT ACT ADR 0106 sibling boundary than the
  // commission-tier one — its own body text is "...não tem acesso à
  // administração desta organização", not the commission wording) — verified
  // live via this exact test's own error-context snapshot before widening.
  // /não encontr/i is the shared pt-BR stem across old and both new boundaries.
  setFeatureFlag('accreditation', false)
  expect(readFeatureFlag('accreditation'), 'flag did not actually flip to false').toBe(false)
  await page.goto(hospitalUrl)
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByRole('heading', { level: 1, name: 'Acreditação' })).toHaveCount(0)

  setFeatureFlag('accreditation', true)
  expect(readFeatureFlag('accreditation'), 'flag did not actually flip to true').toBe(true)
  await page.goto(hospitalUrl)
  await expect(page.getByRole('heading', { level: 1, name: 'Acreditação' })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText(/não encontr/i)).toHaveCount(0)
})

// ===========================================================================
// AC-1 — tree Nível badges; evidence + assessment; the computed rollup
// ===========================================================================

test('AC-1 the tree shows Nível badges; evidencing+assessing conforme clears the gap, nao_conforme enters it, with the exact computed rollup', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await signInAs(page, CHEFE_CCIH)

  // --- tree renders Nível badges for both standards -------------------------
  await page.goto(frameworkUrl())
  const tree = treeNav(page)
  await expect(tree.getByRole('link', { name: new RegExp(STD_A_TITLE) })).toBeVisible({
    timeout: 15_000,
  })
  const rowA = tree.getByRole('link', { name: new RegExp(STD_A_TITLE) })
  const rowB = tree.getByRole('link', { name: new RegExp(STD_B_TITLE) })
  await expect(rowA.getByText('Nível 1 · Segurança')).toBeVisible()
  await expect(rowB.getByText('Nível 1 · Segurança')).toBeVisible()
  // Neither has been assessed yet — both read "Não avaliado" going in.
  await expect(rowA.getByText('Não avaliado')).toBeVisible()
  await expect(rowB.getByText('Não avaliado')).toBeVisible()

  // --- STD_A: link form + meeting + indicator (all fresh -> valida) --------
  await page.goto(standardUrl(stdAId))
  await expect(page.getByRole('heading', { level: 1, name: STD_A_TITLE })).toBeVisible({
    timeout: 15_000,
  })

  let dialog = await openLinkDialog(page)
  await pickEvidenceViaCombobox(dialog, 'form', 'Formulário', 'Higien', new RegExp(CCIH_FORM_HIGIENE.title))
  await submitLinkDialog(dialog)
  await expect(page.getByText(CCIH_FORM_HIGIENE.title)).toBeVisible({ timeout: 10_000 })

  dialog = await openLinkDialog(page)
  await pickEvidenceViaCombobox(dialog, 'meeting', 'Reunião', 'reuniao evidencia', /reuniao evidencia/)
  await submitLinkDialog(dialog)

  dialog = await openLinkDialog(page)
  await pickEvidenceViaCombobox(dialog, 'indicator', 'Indicador', 'higieniza', /Adesão à higienização/)
  await submitLinkDialog(dialog)

  // Evidenced: 3 links, all "Válida".
  const evidenceSection = page.getByRole('region').filter({ hasText: 'Evidências' }).first()
    .or(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Evidências' }) }))
  await expect(evidenceSection.getByText('Válida')).toHaveCount(3, { timeout: 15_000 })

  // Still unassessed => still a gap by rollup rules (null is not clean).
  // Scoped to STD_A's OWN tree row (`rowA`) — the sidebar tree renders
  // alongside every standard-detail page (`[framework]/layout.tsx`), and
  // STD_B's row ALSO reads "Não avaliado" at this point, so a bare
  // page-wide `getByText` is a strict-mode violation (2 matches).
  await expect(rowA.getByText('Não avaliado')).toBeVisible()

  // Assess conforme — this is what actually removes it from the gap list.
  // Checked on the TREE's row (`rowA`), not page-wide: a bare page-wide
  // `getByText('Conforme')` also matches the STILL-OPEN NativeSelect's own
  // `<option value="conforme">Conforme</option>` (canEdit=true here, so the
  // edit form — not the read-only chip — is what's on screen), a second,
  // meaningless match that trips strict mode.
  await setAssessmentViaUI(page, 'conforme')
  await expect(rowA.getByText('Conforme', { exact: true })).toBeVisible()

  // --- STD_B: assess nao_conforme, no evidence ------------------------------
  await page.goto(standardUrl(stdBId))
  await expect(page.getByRole('heading', { level: 1, name: STD_B_TITLE })).toBeVisible({
    timeout: 15_000,
  })
  await setAssessmentViaUI(page, 'nao_conforme')
  // Scoped to the tree row — see the identical AC-1 note above (the
  // NativeSelect's own <option> text also matches page-wide).
  await expect(rowB.getByText('Não conforme', { exact: true })).toBeVisible()

  // --- Tree reflects both: STD_A evidenced+conforme, STD_B gap -------------
  await page.goto(frameworkUrl())
  await expect(tree.getByRole('link', { name: new RegExp(STD_A_TITLE) })).toBeVisible({
    timeout: 15_000,
  })
  await expect(rowA.getByText('Conforme', { exact: true })).toBeVisible()
  await expect(rowA.getByText('3 válidas')).toBeVisible()
  await expect(rowB.getByText('Não conforme', { exact: true })).toBeVisible()
  await expect(rowB.getByText('Sem evidências')).toBeVisible()

  // --- DB truth: readiness_report carries the split counts, never collapsed.
  // Via the REST RPC endpoint under chefe.ccih's OWN JWT, not raw SQL as the
  // `postgres` superuser — `readiness_report`'s gate reads `auth.uid()`
  // (`app.is_member_of`), which is NULL under a bare `docker exec psql`
  // session (no Supabase auth context), so a raw-SQL call returns an empty
  // result unconditionally regardless of the report's real content — caught
  // live (an unexpected `[]` here, not a wrong-but-present value).
  const chefeToken = await getToken(page, CHEFE_CCIH)
  const report = await readinessReportRpc(page, chefeToken, COMMISSION_CCIH, frameworkId)
  expect(report.ok, `readiness_report: ${report.text}`).toBeTruthy()
  const byCode = Object.fromEntries(report.json.map((r) => [r.standard_code, r]))
  expect(byCode[STD_A_CODE]).toMatchObject({
    assessment_status: 'conforme',
    evidence_valida: 3,
    evidence_atencao: 0,
    evidence_vencida: 0,
    evidence_restrita: 0,
  })
  expect(byCode[STD_B_CODE]).toMatchObject({
    assessment_status: 'nao_conforme',
    evidence_valida: 0,
    evidence_atencao: 0,
    evidence_vencida: 0,
    evidence_restrita: 0,
  })

  // --- The readiness DASHBOARD: exact hand-computed rollup (rollups.ts) ----
  // Level 1: 2 standards, 1 clean (A) -> 50% own-level, blocked by B (not
  // certifiable). Levels 2/3: 0 standards of their own -> 100% (vacuous), but
  // STILL blocked — B's gap carries forward cumulatively (D3). This is the
  // exact subtlety rollups.ts's own doc comment calls out: "a level can read
  // 100% on its own standards while a lower level's gap still blocks it."
  await page.goto(frameworkUrl())
  const level1Card = page.locator('div').filter({ hasText: 'Nível 1' }).filter({ hasText: 'próprio nível' }).last()
  const level2Card = page.locator('div').filter({ hasText: 'Nível 2' }).filter({ hasText: 'próprio nível' }).last()
  const level3Card = page.locator('div').filter({ hasText: 'Nível 3' }).filter({ hasText: 'próprio nível' }).last()

  // The clean/total count text: exact literal, PO-ruled (BUG-P16-005,
  // closed) — "{clean} de {total} {padrão|padrões} {está conforme|estão
  // conformes} (não cumulativo)": the noun agrees with `total`, the
  // verb+adjective agrees with `clean` (a verb makes explicit that the
  // COUNT conforms, removing a "3 de 5 padrões conformes" reading that
  // could imply all five conform). A tolerant pattern was deliberate while
  // the wording was still open — asserting the exact string now is what
  // actually guards it: this phase shipped TWO separate irregular -ão ->
  // -ões pluralization bugs invisible to lint/typecheck/vitest ("padrãoes",
  // and evidence-count-badge.tsx's "em atençãos"), so a loose matcher would
  // let either regress silently.
  await expect(level1Card.getByText('50%')).toBeVisible({ timeout: 15_000 })
  await expect(level1Card.getByText('1 de 2 padrões está conforme (não cumulativo)', { exact: true })).toBeVisible()
  await expect(level1Card.getByText('Bloqueado')).toBeVisible()
  await expect(level1Card.getByText('Pronto')).toHaveCount(0)

  await expect(level2Card.getByText('100%')).toBeVisible()
  await expect(
    level2Card.getByText('0 de 0 padrões estão conformes (não cumulativo)', { exact: true }),
  ).toBeVisible()
  await expect(level2Card.getByText('Bloqueado')).toBeVisible()

  await expect(level3Card.getByText('100%')).toBeVisible()
  await expect(level3Card.getByText('Bloqueado')).toBeVisible()

  // Cumulative gap lists: STD_B blocks Nível 1 AND every level above it.
  const gap1 = page.getByRole('region', { name: /gap-O que bloqueia o Nível 1\?/ })
    .or(page.locator('section').filter({ has: page.getByRole('heading', { name: 'O que bloqueia o Nível 1?' }) }))
  const gap2 = page.locator('section').filter({ has: page.getByRole('heading', { name: 'O que bloqueia o Nível 2?' }) })
  const gap3 = page.locator('section').filter({ has: page.getByRole('heading', { name: 'O que bloqueia o Nível 3?' }) })
  await expect(gap1.getByText(STD_B_TITLE)).toBeVisible({ timeout: 15_000 })
  await expect(gap1.getByText(STD_A_TITLE)).toHaveCount(0)
  await expect(gap2.getByText(STD_B_TITLE)).toBeVisible()
  await expect(gap3.getByText(STD_B_TITLE)).toBeVisible()
})

// ===========================================================================
// AC-2 — staff1.ccih: no edit affordance (404) + a forced RPC is rejected
// ===========================================================================

test('AC-2 staff1.ccih (plain staff) gets 404 on the whole route, and a forced assessment RPC is rejected server-side', async ({
  page,
}) => {
  await signInAs(page, STAFF1_CCIH)
  await page.goto(frameworkListUrl())
  // Not `resp.status()` — see AC-0's comment (this route streams behind
  // `loading.tsx`, so the HTTP status commits to 200 before `notFound()`
  // resolves; the DOM is the only place the 404 is observable).
  // BUG-ACT-NOTFOUND-COPY-1: /não encontr/i — this route (commission-tier
  // manage/acreditacao) hits the commission not-found boundary, verified
  // live across the QO·B CUT_ROUTES sample (incl. this exact route).
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({
    timeout: 15_000,
  })

  // Establish a known precondition via RPC (chefe.ccih, the legitimate
  // staff_admin) rather than depending on AC-1's UI flow having already set
  // one — AC-1 is currently blocked by BUG-P16-004, so this keeps AC-2
  // verifiable on its own regardless of AC-1's UI-layer status.
  const chefeToken = await getToken(page, CHEFE_CCIH)
  const seed = await setAssessmentRpc(page, chefeToken, {
    commission: COMMISSION_CCIH,
    standard: stdAId,
    status: 'conforme',
  })
  expect(seed.ok, `precondition set_standard_assessment: ${seed.text}`).toBeTruthy()

  const token = await getToken(page, STAFF1_CCIH)
  const forced = await setAssessmentRpc(page, token, {
    commission: COMMISSION_CCIH,
    standard: stdAId,
    status: 'nao_conforme',
  })
  expect(forced.ok, 'a plain staff must not be able to write an assessment').toBeFalsy()
  expect((forced.json as { code?: string })?.code).toBe('42501')

  // DB truth: STD_A's assessment is still the precondition (chefe.ccih's
  // conforme) — the forced attempt did not touch it.
  const row = sqlRows(
    `select status, assessed_by from public.standard_assessments where commission_id = '${COMMISSION_CCIH}' and standard_id = '${stdAId}';`,
  )
  expect(row).toEqual([['conforme', UID_CHEFE_CCIH]])
})

// ===========================================================================
// AC-3 — chefe.farm cannot link a CCIH-owned artifact as Farmácia evidence
// ===========================================================================

test('AC-3 chefe.farm linking a CCIH-owned form as Farmácia evidence is rejected — HC0QA', async ({
  page,
}) => {
  const token = await getToken(page, CHEFE_FARM)
  const forced = await linkEvidenceRpc(page, token, {
    commission: COMMISSION_FARMACIA,
    standard: stdAId, // global standard, reachable by Farmácia too
    kind: 'form',
    artifact: CCIH_FORM_HIGIENE.id, // owned by CCIH, not Farmácia
  })
  expect(forced.ok, 'a foreign-commission artifact must not be linkable').toBeFalsy()
  expect((forced.json as { code?: string; message?: string })?.code).toBe('HC0QA')
  expect((forced.json as { message?: string })?.message).toMatch(/não pertence a esta comissão/i)

  const row = sqlRows(
    `select count(*)::text from public.evidence_links where commission_id = '${COMMISSION_FARMACIA}' and standard_id = '${stdAId}' and artifact_kind = 'form' and artifact_id = '${CCIH_FORM_HIGIENE.id}';`,
  )
  expect(row).toEqual([['0']])
})

// Sanity/UI corollary, kept as its OWN test: the picker never even OFFERS the
// foreign form to Farmácia in the first place (evidence_candidates is
// commission-scoped), which is why AC-3's rejection has to be a forced RPC,
// not a click-through. Split out from AC-3 so its failure (currently
// BUG-P16-004 — `[framework]/layout.tsx` crashes before this page ever
// renders) is reported on its own, distinct from AC-3's already-passing
// RPC-level assertion.
test('AC-3b UI corollary: the evidence picker never offers a foreign-commission form as a candidate', async ({
  page,
}) => {
  await cachedSignIn(page, CHEFE_FARM, 'Test1234!')
  await page.goto(`/o/${ORG_A}/c/${FARM_SLUG}/manage/acreditacao/${frameworkId}/padrao/${stdAId}`)
  await expect(page.getByRole('heading', { level: 1, name: STD_A_TITLE })).toBeVisible({
    timeout: 15_000,
  })
  await page.getByRole('button', { name: 'Vincular evidência' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Tipo de evidência').selectOption('form')
  const input = dialog.getByRole('combobox', { name: 'Formulário' })
  await input.click()
  await input.fill('Higien')
  await expect(dialog.getByRole('option', { name: new RegExp(CCIH_FORM_HIGIENE.title) })).toHaveCount(0)
})

// ===========================================================================
// AC-4 — audit rows
// ===========================================================================

test('AC-4 evidence-link and assessment writes each emit an audit_log row', async ({ page }) => {
  // Self-contained: mints its OWN standard and does its OWN mutations via RPC
  // rather than relying on AC-1's UI flow (currently blocked by BUG-P16-004)
  // — and a DEDICATED standard rather than reusing STD_A/STD_B, so this is
  // unaffected by run order EITHER way (whether it runs before AC-1, or after
  // AC-1 succeeds once the bug is fixed and STD_B already carries its own
  // assessment/evidence).
  const token = await getToken(page, CHEFE_CCIH)
  const platformToken = await getToken(page, PLATFORM)
  const std = await upsertStandardRpc(page, platformToken, {
    framework: frameworkId,
    code: 'P16-1-D',
    title: 'Auditoria padrao delta P16',
    position: 3,
  })
  expect(std.ok, `upsert_standard D: ${std.text}`).toBeTruthy()
  const stdDId = std.json.id

  // DB-clock marker, not a host (node) one — `occurred_at` is written by the SAME
  // database this compares it against, and under full-gate load the container clock
  // can sit momentarily behind the host's. A host-minted marker then filters the row
  // straight back out of its own scoping predicate, which reads as "the audit row was
  // never emitted" (a false product-defect signature) when it is a cross-clock
  // comparison. One clock, both sides.
  const markerT0 = sqlOne('select clock_timestamp()::text;')

  const link = await linkEvidenceRpc(page, token, {
    commission: COMMISSION_CCIH,
    standard: stdDId,
    kind: 'meeting',
    artifact: meetingId,
  })
  expect(link.ok, `link_evidence: ${link.text}`).toBeTruthy()

  const assess = await setAssessmentRpc(page, token, {
    commission: COMMISSION_CCIH,
    standard: stdDId,
    status: 'parcial',
  })
  expect(assess.ok, `set_standard_assessment: ${assess.text}`).toBeTruthy()

  const evidenceRows = sqlRows(
    `select entity_id, actor_id, summary from public.audit_log where commission_id = '${COMMISSION_CCIH}' and action = 'evidence_link.created' and occurred_at >= '${markerT0}';`,
  )
  expect(evidenceRows).toEqual([[link.json.id, UID_CHEFE_CCIH, 'Evidência vinculada: meeting']])

  const assessmentRows = sqlRows(
    `select entity_id, actor_id, summary from public.audit_log where commission_id = '${COMMISSION_CCIH}' and action = 'standard_assessment.created' and occurred_at >= '${markerT0}';`,
  )
  expect(assessmentRows).toEqual([[assess.json.id, UID_CHEFE_CCIH, 'Autoavaliação registrada: parcial']])
})

// ===========================================================================
// AC-5 — keyboard-only: tree -> assess -> picker -> link
// ===========================================================================

test('AC-5 keyboard-only: expand the tree, open a standard, assess it, link evidence via the picker', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await signInAs(page, CHEFE_CCIH)
  const token = await getToken(page, PLATFORM)

  // Fresh standards for this test only — a parent (level 1) + one child — so
  // AC-1's rollup arithmetic (computed before this test ever runs) is untouched.
  const c = await upsertStandardRpc(page, token, {
    framework: frameworkId,
    code: STD_C_CODE,
    title: STD_C_TITLE,
    level: 1,
    position: 2,
  })
  expect(c.ok, `upsert_standard C: ${c.text}`).toBeTruthy()
  const c1 = await upsertStandardRpc(page, token, {
    framework: frameworkId,
    code: STD_C1_CODE,
    title: STD_C1_TITLE,
    level: 1,
    parent: c.json.id,
    position: 0,
  })
  expect(c1.ok, `upsert_standard C1: ${c1.text}`).toBeTruthy()

  measurementIds.push(
    insertIndicatorMeasurement({
      indicatorId: INDICATOR_AC5,
      status: 'on_target',
      periodLabel: `${SPEC_TAG}-ac5`,
      enteredBy: UID_CHEFE_CCIH,
    }),
  )

  await page.goto(frameworkUrl())
  const tree = treeNav(page)
  const branchRow = tree.locator('li').filter({ hasText: STD_C_TITLE }).first()
  const expandBtn = branchRow.getByRole('button').first()
  await expandBtn.focus()
  await expect(expandBtn).toBeFocused()
  await expect(expandBtn).toHaveAttribute('aria-expanded', 'true') // starts expanded (depth 0)

  // Collapse, then re-expand, by keyboard — proves the control really drives disclosure.
  await page.keyboard.press('Enter')
  await expect(expandBtn).toHaveAttribute('aria-expanded', 'false')
  await expect(tree.getByRole('link', { name: new RegExp(STD_C1_TITLE) })).toHaveCount(0)
  await page.keyboard.press('Enter')
  await expect(expandBtn).toHaveAttribute('aria-expanded', 'true')

  const childLink = tree.getByRole('link', { name: new RegExp(STD_C1_TITLE) })
  await childLink.focus()
  await expect(childLink).toBeFocused()
  await page.keyboard.press('Enter')
  await page.waitForURL(new RegExp(`padrao/${c1.json.id}`), { timeout: 15_000 })
  await expect(page.getByRole('heading', { level: 1, name: STD_C1_TITLE })).toBeVisible({
    timeout: 15_000,
  })

  // --- Assessment form, entirely by keyboard --------------------------------
  const statusSelect = page.getByLabel('Status de conformidade')
  await statusSelect.focus()
  await expect(statusSelect).toBeFocused()
  await page.keyboard.press('C') // native <select> type-ahead -> "Conforme" (only option starting with C)
  await expect(statusSelect).toHaveValue('conforme')

  const noteField = page.getByLabel(/^Observações/)
  await noteField.focus()
  await page.keyboard.type(`${SPEC_TAG} nota via teclado`)

  const saveBtn = page.getByRole('button', { name: 'Salvar autoavaliação' })
  await saveBtn.focus()
  await expect(saveBtn).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Autoavaliação salva.')).toBeVisible({ timeout: 15_000 })

  // --- Evidence picker, entirely by keyboard --------------------------------
  const linkBtn = page.getByRole('button', { name: 'Vincular evidência' })
  await linkBtn.focus()
  await expect(linkBtn).toBeFocused()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  const kindSelect = dialog.getByLabel('Tipo de evidência')
  await kindSelect.focus()
  await expect(kindSelect).toBeFocused()
  await page.keyboard.press('I') // type-ahead -> "Indicador" (only option starting with I)
  await expect(kindSelect).toHaveValue('indicator')

  const combo = dialog.getByRole('combobox', { name: 'Indicador' })
  await combo.focus()
  await expect(combo).toBeFocused()
  // The seeded indicator's real name carries an accent ("Tempo MÉDIO…"),
  // which a plain ILIKE substring match does not fold — "Tempo medio" (no
  // accent) matches nothing server-side. Search on an accent-free substring
  // of the SAME name instead ("resposta a alertas").
  await page.keyboard.type('resposta a alertas')
  const option = dialog.getByRole('option', { name: /Tempo médio de resposta/ })
  await expect(option).toBeVisible({ timeout: 10_000 })
  await arrowToOption(page, combo, 'Tempo médio de resposta')
  await page.keyboard.press('Enter')
  await expect(combo).toHaveValue(/Tempo médio de resposta/)

  const submitBtn = dialog.getByRole('button', { name: 'Vincular', exact: true })
  await submitBtn.focus()
  await expect(submitBtn).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden({ timeout: 15_000 })

  await expect(page.getByText(/Tempo médio de resposta/)).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Válida').first()).toBeVisible()
})
