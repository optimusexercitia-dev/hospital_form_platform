import { test, expect, type Page } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import {
  CHEFE_CCIH,
  COMMISSION_CCIH,
  ETHICS_CASE_ID,
  HOSPITAL_CENTRAL_A,
  ORG_A,
  CCIH_SLUG,
  PLATFORM,
  STAFF2_CCIH,
  createFrameworkRpc,
  getToken,
  hospitalReadinessRpc,
  linkEvidenceRpc,
  purgeFrameworks,
  readinessEvidenceRpc,
  readinessReportRpc,
  setFeatureFlag,
  sqlRows,
  upsertStandardRpc,
} from './helpers/accreditation'

/**
 * Phase 16 — Standards Crosswalk & Readiness/Gap Engine v2 (ADR 0093 D4/D6/D8).
 * Acceptance criteria (spec 4 of 5):
 *
 *   AC-1  the SAME restricted case linked as BOTH `case` and `ethics_procedure`
 *         coexist as two DISTINCT evidence_links rows (the deliberate
 *         double-link posture — `evidence_links_unique` is
 *         `(commission_id, standard_id, artifact_kind, artifact_id)`, kind
 *         included, so this is legal by construction; pinning it in E2E).
 *   AC-2  a non-ACL member of the linking commission sees "Evidência
 *         restrita" and NO payload (label masked, `note` forced null) for
 *         BOTH links.
 *   AC-3  the ACL member who linked them sees the real label + real note —
 *         the positive control that proves AC-2 is masking, not breakage.
 *   AC-4  `platform@test.local` — RPC probes to ALL THREE readiness doors
 *         (`readiness_report`, `readiness_evidence`, `hospital_readiness`)
 *         return ZERO rows (D6 — the BUG-AUTHZ-001 shape, tested a second,
 *         independent time at the E2E layer; pgTAP 283/284 already proves it
 *         at the DB layer).
 *
 * ## Why this file drives AC-2/AC-3 through DIRECT RPC calls, not the UI
 *
 * The ONLY seeded staff_admin of CCIH is `chefe.ccih` — who IS on the case's
 * ACL. There is no seeded persona that is simultaneously staff_admin-of-CCIH
 * (required to even REACH `/manage/acreditacao` — the whole route 404s for a
 * plain `staff`, spec 1 AC-2) and NOT on the ethics case's ACL. So the
 * "non-ACL member sees the masked row" claim cannot be exercised through the
 * UI with a seeded persona; `readiness_evidence`'s OWN gate is `is_member_of`
 * (not `is_staff_admin_of`), so a plain member (`staff2.ccih`, verified live:
 * `can_read_case` = false) CAN call the RPC directly — the canonical server
 * path this masking actually lives at. `chefe.ccih`'s UI view is the positive
 * control that the SAME door renders correctly for a reader who IS entitled.
 *
 * ## Fixture
 *
 * The ONE seeded `ethics_case_details` case in the whole DB
 * (`ca000000-…-e1`, CCIH, "Denúncia Ética (fixture E1)") — read-only, never
 * mutated; asserted to SURVIVE in `afterAll`. A fresh CCIH-owned custom
 * framework + one standard hold the two evidence links.
 */

// NOT `mode: 'serial'` — AC-1/AC-2/AC-3/AC-4 only READ the shared beforeAll
// fixture, none mutate it, so a failure in one does not need to skip the rest.
test.use({ viewport: { width: 1280, height: 1000 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

const SPEC_TAG = 'P16-4'
const FRAMEWORK_KEY = 'p16-restricted-spec-ccih'
const STD_CODE = 'P16-4-STD'
const STD_TITLE = 'Padrao evidencia restrita P16'
const CASE_NOTE = `${SPEC_TAG} nota interna do vinculo`
const ETHICS_CASE_LABEL = 'Denúncia Ética (fixture E1)'

let frameworkId: string
let standardId: string

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

  const std = await upsertStandardRpc(page, token, {
    framework: frameworkId,
    code: STD_CODE,
    title: STD_TITLE,
    position: 0,
  })
  expect(std.ok, `upsert_standard: ${std.text}`).toBeTruthy()
  standardId = std.json.id

  const caseLink = await linkEvidenceRpc(page, token, {
    commission: COMMISSION_CCIH,
    standard: standardId,
    kind: 'case',
    artifact: ETHICS_CASE_ID,
    note: CASE_NOTE,
  })
  expect(caseLink.ok, `link_evidence (case): ${caseLink.text}`).toBeTruthy()

  const ethicsLink = await linkEvidenceRpc(page, token, {
    commission: COMMISSION_CCIH,
    standard: standardId,
    kind: 'ethics_procedure',
    artifact: ETHICS_CASE_ID,
  })
  expect(ethicsLink.ok, `link_evidence (ethics_procedure): ${ethicsLink.text}`).toBeTruthy()

  await page.close()
})

test.afterAll(() => {
  purgeFrameworks([frameworkId])

  // Tripwire: the seed's single ethics-case fixture survives this file untouched.
  expect(
    sqlRows(`select label, confidentiality_level from public.cases where id = '${ETHICS_CASE_ID}';`),
  ).toEqual([[ETHICS_CASE_LABEL, 'ethics_investigation']])
  expect(sqlRows(`select count(*)::text from public.ethics_case_details where case_id = '${ETHICS_CASE_ID}';`)).toEqual(
    [['1']],
  )
})

// ===========================================================================
// AC-1 — case AND ethics_procedure coexist as two distinct links
// ===========================================================================

test('AC-1 the same case linked as both case and ethics_procedure coexists as two distinct evidence links', async () => {
  const rows = sqlRows(
    `select artifact_kind from public.evidence_links where commission_id = '${COMMISSION_CCIH}' and standard_id = '${standardId}' and artifact_id = '${ETHICS_CASE_ID}' order by artifact_kind;`,
  )
  expect(rows).toEqual([['case'], ['ethics_procedure']])
})

// ===========================================================================
// AC-2 — a non-ACL member sees "Evidência restrita" and no payload
// ===========================================================================

test('AC-2 a non-ACL member (staff2.ccih) sees both links masked: "Evidência restrita", note null', async ({
  page,
}) => {
  const token = await getToken(page, STAFF2_CCIH)
  const result = await readinessEvidenceRpc(page, token, COMMISSION_CCIH, standardId)
  expect(result.ok, `readiness_evidence as staff2.ccih: ${result.text}`).toBeTruthy()
  expect(result.json.length).toBe(2)

  for (const row of result.json) {
    expect(['case', 'ethics_procedure']).toContain(row.artifact_kind)
    expect(row.label).toBe('Evidência restrita')
    expect(row.note).toBeNull()
    expect(row.restricted).toBe(true)
    // Masking hides the LABEL/NOTE, not the freshness classification — a
    // case/ethics_procedure link always reads valida regardless of reader.
    expect(row.status).toBe('valida')
  }
})

// ===========================================================================
// AC-3 — the ACL member (chefe.ccih) sees the real label and note
// ===========================================================================

test('AC-3 the ACL member (chefe.ccih) sees the real case label and note — the positive control', async ({
  page,
}) => {
  const token = await getToken(page, CHEFE_CCIH)
  const result = await readinessEvidenceRpc(page, token, COMMISSION_CCIH, standardId)
  expect(result.ok, `readiness_evidence as chefe.ccih: ${result.text}`).toBeTruthy()
  expect(result.json.length).toBe(2)

  const caseRow = result.json.find((r) => r.artifact_kind === 'case')
  const ethicsRow = result.json.find((r) => r.artifact_kind === 'ethics_procedure')
  expect(caseRow?.label).toBe(ETHICS_CASE_LABEL)
  expect(caseRow?.note).toBe(CASE_NOTE)
  expect(caseRow?.restricted).toBe(false)
  expect(ethicsRow?.label).toBe(ETHICS_CASE_LABEL)
  expect(ethicsRow?.restricted).toBe(false)
})

// UI corollary, kept as its OWN test — the one persona who CAN reach the
// standard panel (`chefe.ccih`, staff_admin + ACL) sees the same unmasked
// label rendered for real. Split from AC-3's RPC-level assertion so a
// failure here (currently BUG-P16-004 — `[framework]/layout.tsx` crashes
// before this page ever renders) is reported on its own.
test('AC-3b UI corollary: the standard panel renders the real case label and note for the ACL member', async ({
  page,
}) => {
  await signInAs(page, CHEFE_CCIH)
  await page.goto(`/o/${ORG_A}/c/${CCIH_SLUG}/manage/acreditacao/${frameworkId}/padrao/${standardId}`)
  await expect(page.getByRole('heading', { level: 1, name: STD_TITLE })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(ETHICS_CASE_LABEL).first()).toBeVisible()
  await expect(page.getByText(CASE_NOTE)).toBeVisible()
  await expect(page.getByText('Evidência restrita')).toHaveCount(0)
})

// ===========================================================================
// AC-4 — platform_admin: zero rows from all three readiness doors (D6)
// ===========================================================================

test('AC-4 platform@test.local gets ZERO rows from readiness_report, readiness_evidence, and hospital_readiness', async ({
  page,
}) => {
  const token = await getToken(page, PLATFORM)

  const report = await readinessReportRpc(page, token, COMMISSION_CCIH, frameworkId)
  expect(report.ok, `readiness_report as platform: ${report.text}`).toBeTruthy()
  expect(report.json).toEqual([])

  const evidence = await readinessEvidenceRpc(page, token, COMMISSION_CCIH, standardId)
  expect(evidence.ok, `readiness_evidence as platform: ${evidence.text}`).toBeTruthy()
  expect(evidence.json).toEqual([])

  // frameworkId here is CCIH-owned (not global); hospital_readiness's own
  // reachability check would ALSO exclude it, but the is_hospital_admin_of /
  // is_org_admin_of gate fails for platform_admin before reachability is ever
  // evaluated — the zero-rows result is unconditional on framework choice.
  const hospital = await hospitalReadinessRpc(page, token, HOSPITAL_CENTRAL_A, frameworkId)
  expect(hospital.ok, `hospital_readiness as platform: ${hospital.text}`).toBeTruthy()
  expect(hospital.json).toEqual([])
})
