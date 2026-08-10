import { test, expect, type Page } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import {
  CCIH_SLUG,
  CHEFE_CCIH,
  COMMISSION_CCIH,
  ORG_A,
  PLATFORM,
  STAFF1_QUAL_B,
  cloneFrameworkRpc,
  createFrameworkRpc,
  getToken,
  purgeFrameworks,
  selectAs,
  setFeatureFlag,
  sqlOne,
  sqlRows,
  updateFrameworkRpc,
  upsertStandardRpc,
} from './helpers/accreditation'

/**
 * Phase 16 — Standards Crosswalk & Readiness/Gap Engine v2 (ADR 0093 D2/D9;
 * Amendment 1 A1·2). Acceptance criteria (spec 5 of 5):
 *
 *   AC-1  cloning a global pack (`clone_framework`) produces a commission-
 *         owned copy whose standards carry the SAME codes/titles/levels but
 *         fresh ids, `owner_commission_id` set, `cloned_from_framework_id`
 *         pointing back at the source.
 *   AC-2  pasting `description_md` into the CLONE's standard
 *         (`upsert_standard`) succeeds and is visible — this is the whole
 *         point of cloning (D2: global packs never carry licensed manual
 *         text; a clone is where a commission pastes its own).
 *   AC-3  editing the GLOBAL pack directly (as a staff_admin who is not
 *         platform_admin) fails — HC0QD, "clone o framework para editá-lo" —
 *         on BOTH `upsert_standard` (pasting text onto the shared row, the
 *         literal leak `upsert_standard` guards against) and
 *         `update_framework` (the framework-level sibling of the same guard
 *         shape).
 *   AC-4  a user from ANOTHER ORG cannot see the clone at all — PO ruling 2 /
 *         Amendment 1 A1·2's licensed-text isolation — proven as a DIRECT
 *         RLS read (a plain REST SELECT under the foreign persona's own JWT),
 *         independent of any route-level access gate, so this is specifically
 *         a POLICY claim, not "the nav never links there."
 *
 * ## Why AC-3 is RPC-only, not a UI click-through
 *
 * Per `frontend`'s own Wave 2/3 scope note (`docs/plans/phase-16-standards-
 * crosswalk-program.md`): standard/framework CRUD (create/update/upsert a
 * standard's title or description) has NO wired UI in this phase — the
 * standard panel only offers the self-assessment form and the evidence
 * picker; `upsert_standard`/`update_framework` are reachable only via direct
 * RPC today. There is consequently no button to click that would even
 * ATTEMPT to edit a global standard's text — the RPC probe is not a
 * workaround, it is the only way this acceptance criterion is exercisable at
 * all right now. Recorded here rather than silently worked around, per the
 * tester's "loudly flag anything that turned out untestable as written" brief.
 *
 * ## Fixture
 *
 * A GLOBAL framework (`platform@test.local`) with one skeleton-only standard
 * (`description_md: null`, D2), cloned by `chefe.ccih` into CCIH.
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 1000 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

const SPEC_TAG = 'P16-5'
const FRAMEWORK_KEY = 'p16-clone-spec-global'
const STD_CODE = 'P16-5-STD'
const STD_TITLE = 'Padrao clonavel P16'
const PASTED_DESCRIPTION = `${SPEC_TAG} texto completo colado apos o clone, sob a licenca da comissao.`

let globalFrameworkId: string
let globalStandardId: string
let cloneFrameworkId: string
let cloneStandardId: string

async function signInAs(page: Page, email: string) {
  await cachedSignIn(page, email, 'Test1234!')
}

test.beforeAll(async ({ browser }) => {
  setFeatureFlag('accreditation', true)

  const page = await browser.newPage()
  const platformToken = await getToken(page, PLATFORM)

  const fw = await createFrameworkRpc(page, platformToken, {
    key: FRAMEWORK_KEY,
    name: `${SPEC_TAG} Framework Global`,
    ownerCommission: null,
  })
  expect(fw.ok, `create_framework: ${fw.text}`).toBeTruthy()
  globalFrameworkId = fw.json.id

  const std = await upsertStandardRpc(page, platformToken, {
    framework: globalFrameworkId,
    code: STD_CODE,
    title: STD_TITLE,
    position: 0,
  })
  expect(std.ok, `upsert_standard: ${std.text}`).toBeTruthy()
  globalStandardId = std.json.id
  expect(std.json.description_md).toBeNull() // skeleton-only, D2

  await page.close()
})

test.afterAll(() => {
  purgeFrameworks([cloneFrameworkId, globalFrameworkId])
})

// ===========================================================================
// AC-1 — clone fidelity
// ===========================================================================

test('AC-1 clone_framework copies the skeleton (code/title) with fresh ids and provenance', async ({
  page,
}) => {
  const token = await getToken(page, CHEFE_CCIH)
  const clone = await cloneFrameworkRpc(page, token, { framework: globalFrameworkId, commission: COMMISSION_CCIH })
  expect(clone.ok, `clone_framework: ${clone.text}`).toBeTruthy()
  cloneFrameworkId = clone.json.id

  expect(cloneFrameworkId).not.toBe(globalFrameworkId)
  expect(clone.json.owner_commission_id).toBe(COMMISSION_CCIH)
  expect(clone.json.cloned_from_framework_id).toBe(globalFrameworkId)
  expect(clone.json.key).toBe(FRAMEWORK_KEY) // key/name/version copied verbatim

  const clonedStd = sqlRows(
    `select id, code, title, description_md from public.accreditation_standards where framework_id = '${cloneFrameworkId}';`,
  )
  expect(clonedStd.length).toBe(1)
  expect(clonedStd[0][0]).not.toBe(globalStandardId) // fresh id
  expect(clonedStd[0][1]).toBe(STD_CODE)
  expect(clonedStd[0][2]).toBe(STD_TITLE)
  expect(clonedStd[0][3]).toBe('') // NULL renders as '' through the psql -tA pipe
  cloneStandardId = clonedStd[0][0]

  // The original global standard is untouched by the clone.
  expect(
    sqlOne(`select description_md is null from public.accreditation_standards where id = '${globalStandardId}';`),
  ).toBe('t')
})

// ===========================================================================
// AC-2 — pasting description_md into the CLONE succeeds and is visible
// ===========================================================================

test('AC-2 pasting description_md into the clone standard succeeds and renders', async ({ page }) => {
  const token = await getToken(page, CHEFE_CCIH)
  const edit = await upsertStandardRpc(page, token, {
    framework: cloneFrameworkId,
    id: cloneStandardId,
    code: STD_CODE,
    title: STD_TITLE,
    descriptionMd: PASTED_DESCRIPTION,
  })
  expect(edit.ok, `upsert_standard (paste into clone): ${edit.text}`).toBeTruthy()
  expect(edit.json.description_md).toBe(PASTED_DESCRIPTION)

  await signInAs(page, CHEFE_CCIH)
  await page.goto(`/o/${ORG_A}/c/${CCIH_SLUG}/manage/acreditacao/${cloneFrameworkId}/padrao/${cloneStandardId}`)
  await expect(page.getByRole('heading', { level: 1, name: STD_TITLE })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(PASTED_DESCRIPTION)).toBeVisible()
  await expect(
    page.getByText('pacotes globais trazem apenas código, título e hierarquia', { exact: false }),
  ).toHaveCount(0)
})

// ===========================================================================
// AC-3 — editing the GLOBAL pack fails (HC0QD) on both RPCs
// ===========================================================================

test('AC-3 editing the global pack directly fails — HC0QD — on upsert_standard and update_framework', async ({
  page,
}) => {
  const token = await getToken(page, CHEFE_CCIH)

  const editStandard = await upsertStandardRpc(page, token, {
    framework: globalFrameworkId,
    id: globalStandardId,
    code: STD_CODE,
    title: STD_TITLE,
    descriptionMd: 'tentativa de colar texto licenciado no pacote global',
  })
  expect(editStandard.ok, 'a non-admin must not edit a global standard').toBeFalsy()
  expect((editStandard.json as { code?: string })?.code).toBe('HC0QD')
  expect((editStandard.json as { message?: string })?.message).toMatch(/clone o framework para editá-lo/i)

  const editFramework = await updateFrameworkRpc(page, token, {
    framework: globalFrameworkId,
    name: 'Nome adulterado',
  })
  expect(editFramework.ok, 'a non-admin must not edit a global framework').toBeFalsy()
  expect((editFramework.json as { code?: string })?.code).toBe('HC0QD')

  // DB truth: neither write landed.
  expect(sqlOne(`select description_md is null from public.accreditation_standards where id = '${globalStandardId}';`)).toBe(
    't',
  )
  const fwRow = sqlRows(`select key, name from public.accreditation_frameworks where id = '${globalFrameworkId}';`)
  expect(fwRow).toEqual([[FRAMEWORK_KEY, `${SPEC_TAG} Framework Global`]])

  // platform_admin, by contrast, CAN — the one legitimate is_admin() arm (D6).
  const platformToken = await getToken(page, PLATFORM)
  const asAdmin = await updateFrameworkRpc(page, platformToken, {
    framework: globalFrameworkId,
    name: `${SPEC_TAG} Framework Global (renomeado)`,
  })
  expect(asAdmin.ok, `update_framework as platform_admin: ${asAdmin.text}`).toBeTruthy()
  // Restore the name so AC-1/AC-2's assertions (already run, in serial order)
  // are not retroactively affected, and so re-running this file idempotently
  // finds the name it expects.
  const restore = await updateFrameworkRpc(page, platformToken, {
    framework: globalFrameworkId,
    name: `${SPEC_TAG} Framework Global`,
  })
  expect(restore.ok).toBeTruthy()
})

// ===========================================================================
// AC-4 — another org's user cannot see the clone (RLS, not just nav)
// ===========================================================================

test('AC-4 a user from another org cannot see the clone via a direct RLS read', async ({ page }) => {
  // ACT (ADR 0106): either of her 2 real hats denies identically here (a
  // foreign-org negative control) — 'staff_admin' picked arbitrarily.
  const token = await getToken(page, STAFF1_QUAL_B, undefined, 'staff_admin')

  const frameworks = await selectAs<{ id: string }>(
    page,
    token,
    `accreditation_frameworks?id=eq.${cloneFrameworkId}&select=id`,
  )
  expect(frameworks.ok, `select accreditation_frameworks as staff1.qual.b: status ${frameworks.status}`).toBeTruthy()
  expect(frameworks.rows).toEqual([])

  const standards = await selectAs<{ id: string }>(
    page,
    token,
    `accreditation_standards?framework_id=eq.${cloneFrameworkId}&select=id`,
  )
  expect(standards.ok, `select accreditation_standards as staff1.qual.b: status ${standards.status}`).toBeTruthy()
  expect(standards.rows).toEqual([])

  // Positive control: the SAME org-B persona CAN see the global pack (it is
  // SELECT-able by every authenticated user) — proves the emptiness above is
  // the clone's commission-scoping specifically, not a broken token/probe.
  const globalRow = await selectAs<{ id: string }>(
    page,
    token,
    `accreditation_frameworks?id=eq.${globalFrameworkId}&select=id`,
  )
  expect(globalRow.rows).toEqual([{ id: globalFrameworkId }])
})
