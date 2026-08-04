import { test, expect, type Page } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import {
  CHEFE_CCIH,
  COMMISSION_CCIH,
  ORG_A,
  CCIH_SLUG,
  UID_CHEFE_CCIH,
  createFrameworkRpc,
  getToken,
  insertArchivedFormVersion,
  insertEffectiveDocument,
  insertIndicatorMeasurement,
  linkEvidenceRpc,
  purgeControlledDocuments,
  purgeForms,
  purgeFrameworks,
  purgeIndicatorMeasurements,
  readinessReportRpc,
  setFeatureFlag,
  sqlRows,
  upsertStandardRpc,
} from './helpers/accreditation'

/**
 * Phase 16 — Standards Crosswalk & Readiness/Gap Engine v2 (ADR 0093 D5 /
 * Amendment 2 A2·2-3 / Amendment 3). Acceptance criteria (spec 2 of 5):
 *
 *   AC-1  a `vigente` (effective, review not due) document = válida; a
 *         BACKDATED `review_due_date` = vencida, and — on a standard that
 *         carries BOTH — the evidence count displays the SPLIT ("1 válida,
 *         1 vencida"), never a collapsed total. This is D5's whole point:
 *         "a link is a claim, not proof."
 *   AC-2  an indicator with no measurement inside its current frequency
 *         window = vencida.
 *   AC-3  an indicator whose latest in-window measurement is `off_target` =
 *         atenção.
 *   AC-4  an archived form version = vencida.
 *
 * Every date here is relative to the CURRENT test run (`now()` / `current_date
 * ± N`), never a hardcoded calendar literal — the BUG-P15-001 landmine (a
 * literal date silently drifts in/out of a rolling window as real time
 * passes). `app.evidence_status_of`'s exact matrix (read from the LIVE
 * catalog, not the plan doc's prose) is the authority these assertions are
 * built against:
 *   controlled_document: `effective` + due-date null-or-future -> valida;
 *     `in_approval` -> atencao; `changes_requested`/`draft`/`obsolete` or an
 *     overdue `effective` -> vencida.
 *   indicator: latest measurement with `coalesce(period_start,
 *     entered_at::date) >= current_date - <frequency window>` — `on_target`
 *     -> valida; `off_target`/`no_data` -> atencao; none in window -> vencida.
 *   form / form_version: a currently PUBLISHED version with due-date
 *     null-or-future -> valida; anything else (draft/archived, or overdue)
 *     -> vencida.
 *
 * ## Fixture
 *
 * A CCIH-owned CUSTOM framework (non-leveled — `level` stays null throughout;
 * freshness is orthogonal to the ONA level dimension, spec 1's job) with one
 * standard per scenario, so each test's evidence-count assertion is
 * unambiguous. `STD_DOC` alone carries TWO links (fresh + backdated) — the
 * one standard that has to prove the split. Every supporting artifact
 * (documents, indicator measurements, the archived form version) is a fresh
 * fixture, never a mutated seed row; identity-based cleanup throughout.
 *
 * Run together with the other 4 phase16 specs:
 * `npx playwright test e2e/phase16-*.spec.ts --project=chromium --workers=1`.
 */

// NOT `mode: 'serial'` — each AC targets its OWN standard, independent of the
// others, so a failure in one does not need to skip the rest.
test.use({ viewport: { width: 1280, height: 1000 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

const SPEC_TAG = 'P16-2'
const FRAMEWORK_KEY = 'p16-freshness-spec-ccih'

const STD_DOC_CODE = 'P16-2-DOC'
const STD_DOC_TITLE = 'Documentos padrao doc P16'
const STD_IND_ATENCAO_CODE = 'P16-2-IND-A'
const STD_IND_ATENCAO_TITLE = 'Indicador fora da meta padrao P16'
const STD_IND_VENCIDA_CODE = 'P16-2-IND-V'
const STD_IND_VENCIDA_TITLE = 'Indicador sem medicao padrao P16'
const STD_FORM_CODE = 'P16-2-FORM'
const STD_FORM_TITLE = 'Formulario arquivado padrao P16'

/** An existing CCIH indicator (mensal, active), otherwise untouched by the
 *  other 4 phase16 specs — spec 1 uses two different ones (see its header). */
const INDICATOR_ATENCAO = 'c349baed-1ed4-45c1-a66e-5d2194049705' // "Densidade de IRAS"
const INDICATOR_VENCIDA = '1a06ffec-055f-4748-9db7-af2262146366' // "Dispensadores de álcool disponíveis"

let frameworkId: string
let stdDocId: string
let stdIndAtencaoId: string
let stdIndVencidaId: string
let stdFormId: string

const documentIds: string[] = []
const measurementIds: string[] = []
let archivedFormId: string
let archivedVersionId: string

async function signInAs(page: Page, email: string) {
  await cachedSignIn(page, email, 'Test1234!')
}

test.beforeAll(async ({ browser }) => {
  setFeatureFlag('accreditation', true)

  const page = await browser.newPage()
  const token = await getToken(page, CHEFE_CCIH)

  const fw = await createFrameworkRpc(page, token, {
    key: FRAMEWORK_KEY,
    name: `${SPEC_TAG} Framework CCIH`,
    ownerCommission: COMMISSION_CCIH,
  })
  expect(fw.ok, `create_framework: ${fw.text}`).toBeTruthy()
  frameworkId = fw.json.id

  const std = async (code: string, title: string, position: number) => {
    const r = await upsertStandardRpc(page, token, { framework: frameworkId, code, title, position })
    expect(r.ok, `upsert_standard ${code}: ${r.text}`).toBeTruthy()
    return r.json.id
  }
  stdDocId = await std(STD_DOC_CODE, STD_DOC_TITLE, 0)
  stdIndAtencaoId = await std(STD_IND_ATENCAO_CODE, STD_IND_ATENCAO_TITLE, 1)
  stdIndVencidaId = await std(STD_IND_VENCIDA_CODE, STD_IND_VENCIDA_TITLE, 2)
  stdFormId = await std(STD_FORM_CODE, STD_FORM_TITLE, 3)

  // --- AC-1 fixtures: one vigente (valida) doc + one backdated (vencida) doc
  const fresh = insertEffectiveDocument({
    commissionId: COMMISSION_CCIH,
    title: `${SPEC_TAG} doc vigente`,
    createdBy: UID_CHEFE_CCIH,
    reviewDueExpr: 'current_date + 180',
  })
  const stale = insertEffectiveDocument({
    commissionId: COMMISSION_CCIH,
    title: `${SPEC_TAG} doc vencido`,
    createdBy: UID_CHEFE_CCIH,
    reviewDueExpr: 'current_date - 200',
  })
  documentIds.push(fresh.documentId, stale.documentId)

  const linkDoc = async (artifact: string) => {
    const r = await linkEvidenceRpc(page, token, {
      commission: COMMISSION_CCIH,
      standard: stdDocId,
      kind: 'controlled_document',
      artifact,
    })
    expect(r.ok, `link_evidence doc: ${r.text}`).toBeTruthy()
  }
  await linkDoc(fresh.documentId)
  await linkDoc(stale.documentId)

  // --- AC-2 fixture: off_target measurement INSIDE the current window
  measurementIds.push(
    insertIndicatorMeasurement({
      indicatorId: INDICATOR_ATENCAO,
      status: 'off_target',
      periodLabel: `${SPEC_TAG}-atencao`,
      dateExpr: 'now()',
      enteredBy: UID_CHEFE_CCIH,
    }),
  )
  let r = await linkEvidenceRpc(page, token, {
    commission: COMMISSION_CCIH,
    standard: stdIndAtencaoId,
    kind: 'indicator',
    artifact: INDICATOR_ATENCAO,
  })
  expect(r.ok, `link_evidence atencao indicator: ${r.text}`).toBeTruthy()

  // --- AC-3 fixture: the only measurement is OUTSIDE the mensal (1-month) window
  measurementIds.push(
    insertIndicatorMeasurement({
      indicatorId: INDICATOR_VENCIDA,
      status: 'on_target',
      periodLabel: `${SPEC_TAG}-vencida`,
      dateExpr: "now() - interval '45 days'",
      enteredBy: UID_CHEFE_CCIH,
    }),
  )
  r = await linkEvidenceRpc(page, token, {
    commission: COMMISSION_CCIH,
    standard: stdIndVencidaId,
    kind: 'indicator',
    artifact: INDICATOR_VENCIDA,
  })
  expect(r.ok, `link_evidence vencida indicator: ${r.text}`).toBeTruthy()

  // --- AC-4 fixture: an archived form version
  const archived = insertArchivedFormVersion(COMMISSION_CCIH, `${SPEC_TAG} form arquivado`, UID_CHEFE_CCIH)
  archivedFormId = archived.formId
  archivedVersionId = archived.versionId
  r = await linkEvidenceRpc(page, token, {
    commission: COMMISSION_CCIH,
    standard: stdFormId,
    kind: 'form_version',
    artifact: archivedVersionId,
  })
  expect(r.ok, `link_evidence archived form_version: ${r.text}`).toBeTruthy()

  await page.close()
})

test.afterAll(() => {
  purgeFrameworks([frameworkId])
  purgeControlledDocuments(documentIds)
  purgeIndicatorMeasurements(measurementIds)
  purgeForms([archivedFormId], [archivedVersionId])
})

function standardUrl(standardId: string) {
  return `/o/${ORG_A}/c/${CCIH_SLUG}/manage/acreditacao/${frameworkId}/padrao/${standardId}`
}

// Every "-ui" test below navigates to a `padrao/[standard]` detail page,
// wrapped by `[framework]/layout.tsx` — currently BUG-P16-004 (filed,
// PROGRESS.md Bug Log): that layout forwards a closure prop across a Server/
// Client boundary and crashes before any child page renders. Split from each
// AC's DB-truth assertion (the actual `evidence_status_of`/`readiness_report`
// claim under test) into its own test so the KNOWN-blocked UI failure never
// masks the already-passing door-level assertion.

// ===========================================================================
// AC-1 — vigente = válida, backdated = vencida, SPLIT never collapsed
// ===========================================================================

test('AC-1 a vigente document reads valida, a backdated one reads vencida, and the standard shows the split count (never collapsed)', async ({
  page,
}) => {
  const token = await getToken(page, CHEFE_CCIH)
  const report = await readinessReportRpc(page, token, COMMISSION_CCIH, frameworkId)
  const row = report.json.find((r) => r.standard_code === STD_DOC_CODE)
  expect(row).toBeTruthy()
  expect(row!.evidence_valida).toBe(1)
  expect(row!.evidence_atencao).toBe(0)
  expect(row!.evidence_vencida).toBe(1)
  expect(row!.evidence_restrita).toBe(0)
})

test('AC-1-ui the standard panel shows the split count, never collapsed', async ({ page }) => {
  await signInAs(page, CHEFE_CCIH)
  await page.goto(standardUrl(stdDocId))
  await expect(page.getByRole('heading', { level: 1, name: STD_DOC_TITLE })).toBeVisible({
    timeout: 15_000,
  })

  // Scoped to the evidence <section aria-labelledby="evidence-heading">
  // (an implicit ARIA `region`, named "Evidências") — NOT page-wide: the
  // sidebar tree renders alongside every standard page
  // (`[framework]/layout.tsx`), and this framework's OTHER standards are
  // ALSO vencida, so their tree rows' own sr-only accessible-name text
  // ("… — 1 vencida") would otherwise collide.
  const evidenceSection = page.getByRole('region', { name: 'Evidências' })
  await expect(evidenceSection.getByText('Válida')).toHaveCount(1)
  await expect(evidenceSection.getByText('Vencida')).toHaveCount(1)

  // The aggregate count badge itself only renders on the TREE ROW (per-
  // standard summary, `standards-tree.tsx`) — `StandardPanel`/`EvidenceList`
  // show each item's OWN chip, never a combined badge. Scoped to STD_DOC's
  // own row so its accessible summary states the split exactly — D5's
  // invariant, encoded as an exact string, not "some count > 0".
  const docRow = page.getByRole('navigation', { name: /^Padrões de/ }).getByRole('link', {
    name: new RegExp(STD_DOC_TITLE),
  })
  await expect(docRow.getByText('2 evidências — 1 válida, 1 vencida')).toBeVisible()
})

// ===========================================================================
// AC-2 — no measurement inside the window = vencida
// ===========================================================================

test('AC-2 an indicator unmeasured inside its current frequency window reads vencida', async () => {
  const status = sqlRows(`select app.evidence_status_of('indicator', '${INDICATOR_VENCIDA}');`)
  expect(status).toEqual([['vencida']])
})

test('AC-2-ui the standard panel shows Vencida', async ({ page }) => {
  await signInAs(page, CHEFE_CCIH)
  await page.goto(standardUrl(stdIndVencidaId))
  await expect(page.getByRole('heading', { level: 1, name: STD_IND_VENCIDA_TITLE })).toBeVisible({
    timeout: 15_000,
  })
  // Scoped to the evidence region — see AC-1-ui's comment (the sidebar tree
  // renders alongside every standard page, with its own colliding text).
  const evidenceSection = page.getByRole('region', { name: 'Evidências' })
  await expect(evidenceSection.getByText('Vencida')).toBeVisible()
  await expect(evidenceSection.getByText('Válida')).toHaveCount(0)
  await expect(evidenceSection.getByText('Atenção')).toHaveCount(0)
})

// ===========================================================================
// AC-3 — off_target inside the window = atenção
// ===========================================================================

test('AC-3 an indicator off_target inside its current window reads atencao', async () => {
  const status = sqlRows(`select app.evidence_status_of('indicator', '${INDICATOR_ATENCAO}');`)
  expect(status).toEqual([['atencao']])
})

test('AC-3-ui the standard panel shows Atenção', async ({ page }) => {
  await signInAs(page, CHEFE_CCIH)
  await page.goto(standardUrl(stdIndAtencaoId))
  await expect(page.getByRole('heading', { level: 1, name: STD_IND_ATENCAO_TITLE })).toBeVisible({
    timeout: 15_000,
  })
  // Scoped to the evidence region — see AC-1-ui's comment.
  const evidenceSection = page.getByRole('region', { name: 'Evidências' })
  await expect(evidenceSection.getByText('Atenção')).toBeVisible()
  await expect(evidenceSection.getByText('Válida')).toHaveCount(0)
  await expect(evidenceSection.getByText('Vencida')).toHaveCount(0)
})

// ===========================================================================
// AC-4 — an archived form version = vencida
// ===========================================================================

test('AC-4 an archived form version reads vencida', async () => {
  const status = sqlRows(`select app.evidence_status_of('form_version', '${archivedVersionId}');`)
  expect(status).toEqual([['vencida']])

  // Cross-check against the SIBLING kind ('form') resolving off the same
  // underlying form, which also reads vencida (no PUBLISHED version exists at
  // all for this fixture — the "form" arm looks for a published row, finds
  // none, and its own null-branch returns vencida too).
  const formStatus = sqlRows(`select app.evidence_status_of('form', '${archivedFormId}');`)
  expect(formStatus).toEqual([['vencida']])
})

test('AC-4-ui the standard panel shows Vencida', async ({ page }) => {
  await signInAs(page, CHEFE_CCIH)
  await page.goto(standardUrl(stdFormId))
  await expect(page.getByRole('heading', { level: 1, name: STD_FORM_TITLE })).toBeVisible({
    timeout: 15_000,
  })
  // Scoped to the evidence region — see AC-1-ui's comment.
  await expect(page.getByRole('region', { name: 'Evidências' }).getByText('Vencida')).toBeVisible()
})
