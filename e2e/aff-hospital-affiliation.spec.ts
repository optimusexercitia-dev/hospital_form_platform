import { test, expect } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import { uniqueCpf } from './helpers/cpf'

/**
 * AFF — Hospital affiliation, person identity & the org people directory (T3.6).
 *
 * ADR 0097 (+ ADR 0098's build-time amendments). Test contract: translate D2, D5, D7,
 * D8, D11, D12, D14 into Playwright assertions, per the T3.6 acceptance clauses:
 *
 *   1. The Dr. John path end to end: search by CPF → vincular → add to a committee at
 *      the SECOND hospital.
 *   2. Brand-new registration at a second hospital appearing in the roster with ZERO
 *      committees (D2's entire premise).
 *   3. The negative: one hospital's admin cannot see a person affiliated only to a
 *      sibling hospital.
 *   4. One keyboard-only pass over the identifier-first flow.
 *
 * Plus two backend-flagged risk checks that are not literal T3.6 clauses but are
 * exactly the defect classes ADR 0098 calls out as the ones a naive build gets wrong:
 * the deactivated-account guard (HC0R4) and `updateAffiliation` actually persisting
 * (not just toasting) a value change.
 *
 * ⚠ On using dr.john@test.local: the seed's `dr.john` persona is the schema's PINNED
 * END STATE of the ADR's own scenario — affiliated to BOTH Rede A hospitals, on a
 * committee at each (T3.5) — and is asserted against BY NUMBER in pgTAP `301`/`302`+.
 * Mutating it would repeat the "a shared fixture cannot satisfy two specs" lesson.
 * So clause 1 below builds a FRESH person through the exact scenario instead (create
 * at hospital 1 → discover + vincular at hospital 2 → seat on a committee there), which
 * is more faithful to the ADR's narrative than replaying an already-resolved fixture.
 * `dr.john`'s pinned state is used only where it is READ-ONLY-safe (clause 1's outcome-C
 * cross-check, clause 5's matrícula edit — reverted at the end).
 *
 * Seeded topology used here (password for ALL: Test1234!) — supabase/seed.sql:
 *   org rede-a (0c000000-…-00a): Hospital Central A (05000000-…-00a), Hospital
 *     Secundário A (05000000-…-0a2).
 *   orgadmin.a@test.local     — org_admin, rede-a.
 *   hospitaladmin.dual@test.local — hospital_admin of BOTH central-a and secundario-a
 *     (stands in for "Hospital Municipal's admin" — the hospital_admin actor the ADR's
 *     scenario names).
 *   hospitaladmin.a1@test.local   — hospital_admin of central-a ONLY (the sibling-
 *     hospital negative subject, clause 3).
 *   dr.john@test.local / CPF 11144477735 — the end-state fixture (read-only uses only).
 *   desativado.conta@test.local — the deactivated fixture (no seeded CPF; this file
 *     sets one via the service role for the HC0R4 test, then clears it — see AFF-4).
 */

const CENTRAL_A_ID = '05000000-0000-0000-0000-00000000000a'
const CENTRAL_A_NAME = 'Hospital Central A'
const SECUNDARIO_A_ID = '05000000-0000-0000-0000-0000000000a2'
const SECUNDARIO_A_NAME = 'Hospital Secundário A'
const ETICA_MEMBERS_URL = '/o/rede-a/c/etica/manage/members'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}
const DESATIVADO_UID = '00000000-0000-0000-0000-0000000000d4'
const DR_JOHN_UID = '00000000-0000-0000-0000-0000000000a1'

test.describe.configure({ mode: 'serial' })

async function signInAs(
  page: import('@playwright/test').Page,
  email: string,
  password = 'Test1234!',
) {
  await cachedSignIn(page, email, password)
}

/**
 * The CPF step (D12). `getByRole('textbox', { name: 'CPF' })`, not `getByLabel('CPF')`
 * — the latter also matches the "Comece pelo CPF" region's accessible name (two nodes,
 * strict-mode violation; frontend handoff, PROGRESS.md AFF).
 */
async function lookupByCpf(page: import('@playwright/test').Page, cpf: string) {
  await page.getByRole('textbox', { name: 'CPF' }).fill(cpf)
  await page.getByRole('button', { name: /buscar pessoa/i }).click()
}

/**
 * Add an already-registered org user to a commission via the coordinator's
 * `AddMemberPicker` (same contract as phase3-admin-members.spec.ts's helper of the
 * same shape). Caller must already be on the commission's members page, signed in as
 * one of its admins.
 */
async function addMemberViaPicker(
  page: import('@playwright/test').Page,
  candidateText: string,
) {
  await page.getByRole('button', { name: /adicionar membro/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  await dialog.getByLabel('Buscar pessoa').fill(candidateText)
  const candidateList = dialog.getByRole('list', {
    name: 'Pessoas cadastradas disponíveis',
  })
  const candidate = candidateList.getByRole('button').filter({ hasText: candidateText })
  await expect(candidate).toBeVisible({ timeout: 10_000 })
  await candidate.click()
  await expect(candidate).toHaveAttribute('aria-pressed', 'true')

  const addButton = dialog.getByRole('button', { name: /^adicionar$/i })
  await expect(addButton).toBeEnabled()
  await addButton.click()

  const banner = page.locator('[role="status"]')
  await expect(banner).toBeVisible({ timeout: 10_000 })
  await expect(banner).toContainText(/adicionad[ao] à comissão/i)

  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible({ timeout: 5_000 })
}

// Shared across the AFF-1 tests (serial mode) — the fresh person created in the first
// test is found, vinculado and seated on a committee by the following two.
let johnPathEmail = ''
let johnPathName = ''
let johnPathCpf = ''
let johnPathUserId = ''

// Shared across the AFF-2 / AFF-3 tests — the person registered directly at
// Secundário A with zero committees (D2), later used as the negative subject.
let secondaryOnlyEmail = ''
let secondaryOnlyName = ''
let secondaryOnlyUserId = ''

test.describe('AFF-1: the Dr. John path end to end — search by CPF, vincular, seat on a committee at the second hospital', () => {
  test('org_admin registers a fresh person at Hospital Central A (outcome A — not found)', async ({
    page,
  }) => {
    johnPathCpf = uniqueCpf()
    const ts = Date.now()
    johnPathEmail = `aff.john.${ts}@test.local`
    johnPathName = `AFF John ${ts}`

    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios/novo')
    await lookupByCpf(page, johnPathCpf)

    // Outcome A: nobody in the org holds this CPF — the create form appears, CPF
    // carried forward read-only (never re-typed).
    await expect(
      page.getByText(/nenhuma pessoa com este cpf/i),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByLabel('Nome completo')).toBeVisible()

    await page.getByLabel('Nome completo').fill(johnPathName)
    await page.getByLabel('E-mail').fill(johnPathEmail)
    await page.getByLabel('Senha inicial').fill('Test1234!')
    const categorySelect = page.getByLabel('Categoria profissional')
    const opts = await categorySelect.locator('option').all()
    const firstReal = await opts[1].getAttribute('value')
    if (firstReal) await categorySelect.selectOption(firstReal)

    // Employed at Hospital Central A ("hired at Hospital Regional") — the org_admin
    // create form's hospital picker is OPTIONAL ("Hospital (opcional)"), not locked.
    await page.getByLabel(/^hospital/i).selectOption({ label: CENTRAL_A_NAME })

    await page.getByRole('button', { name: /registrar pessoa/i }).click()
    await page.waitForURL('**/o/rede-a/manage/usuarios', { timeout: 15_000 })

    // Capture the userId and sanity-check the starting state: one affiliation
    // (Central A), zero committees.
    await page.goto(`/o/rede-a/manage/usuarios?search=${encodeURIComponent(johnPathEmail)}`)
    const card = page.locator('li').filter({ hasText: johnPathName })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(card.getByText('Sem comissão', { exact: true })).toBeVisible()
    await card.click()
    await page.waitForURL(/\/usuarios\/[^/]+$/, { timeout: 10_000 })
    johnPathUserId = page.url().match(/\/usuarios\/([^/?]+)/)?.[1] ?? ''
    expect(johnPathUserId).toBeTruthy()
    await expect(page.getByText(CENTRAL_A_NAME)).toBeVisible()
  })

  test('hospitaladmin.dual finds the same CPF at Hospital Secundário A and vincula (outcome B)', async ({
    page,
  }) => {
    test.skip(!johnPathCpf, 'depends on the previous test in this serial file')

    await signInAs(page, 'hospitaladmin.dual@test.local')
    await page.goto(
      `/o/rede-a/manage/usuarios/novo?hospital=${encodeURIComponent(SECUNDARIO_A_ID)}`,
    )
    await lookupByCpf(page, johnPathCpf)

    // Outcome B: registered in the org, not yet employed at THIS (locked) hospital.
    await expect(
      page.getByText(new RegExp(`já está cadastrado em.*${CENTRAL_A_NAME}`, 'i')),
    ).toBeVisible({ timeout: 10_000 })
    // The target hospital is LOCKED (hospital_admin) — a read-only display naming
    // Secundário A, never a chooser. `exact: true` — the outcome copy ("Vincular ao
    // Hospital Secundário A?") and the button both also contain the name as a substring.
    await expect(page.getByText(SECUNDARIO_A_NAME, { exact: true })).toBeVisible()

    // Privacy: the CPF travels via a server action POST, never a URL param, at any
    // point in this flow (ADR 0097 — a national ID must not land in history/logs).
    expect(page.url()).not.toContain(johnPathCpf)

    await page
      .getByRole('button', { name: new RegExp(`vincular ao ${SECUNDARIO_A_NAME}`, 'i') })
      .click()

    // Redirects to the person's page once vinculado.
    await page.waitForURL(new RegExp(`/usuarios/${johnPathUserId}$`), { timeout: 10_000 })
    expect(page.url()).not.toContain(johnPathCpf)

    // Assert the VALUE, not a toast: BOTH affiliations are now listed on the person's
    // own page (the exact class of bug ADR 0098 flags for the sibling `updateAffiliation`
    // door — a wired-to-the-wrong-door mutation silently no-ops and only a toast lies).
    await expect(page.getByText(CENTRAL_A_NAME)).toBeVisible()
    await expect(page.getByText(SECUNDARIO_A_NAME)).toBeVisible()
  })

  // BUG-AFF-1 (filed in PROGRESS.md; NOT an AFF regression — see the bug row for the
  // repro and the commit that shows this predates AFF entirely). `authorizeStaffOps`
  // (src/lib/members/actions.ts, backing the commission's own "Adicionar membro"
  // picker / `addStaff`) has only TWO arms — staff_admin of the commission, or
  // org_admin of its org — never a hospital_admin arm. The PAGE gate
  // (`getCommissionAccessByOrg`) and the CANDIDATE list (`list_addable_commission_members`,
  // ADR 0097 finding 1) both already admit hospital_admin via `is_commission_admin_of`'s
  // hospital leg, so a hospital_admin reaches the page, sees a populated picker, selects
  // a candidate — and is refused only at the final submit, with a generic "Você não tem
  // permissão para esta ação." This is asserted here as the CURRENT, documented behaviour
  // (green today); it must be INVERTED, not deleted, the day `authorizeStaffOps` gains the
  // missing arm (the "281 D1" convention already used elsewhere in this suite).
  test('BUG-AFF-1: hospitaladmin.dual\'s attempt via the commission\'s OWN member picker is refused (pre-existing addStaff gap)', async ({
    page,
  }) => {
    test.skip(!johnPathUserId, 'depends on the previous tests in this serial file')

    await signInAs(page, 'hospitaladmin.dual@test.local')
    await page.goto(ETICA_MEMBERS_URL)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Membros')

    await page.getByRole('button', { name: /adicionar membro/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    await dialog.getByLabel('Buscar pessoa').fill(johnPathEmail)
    const candidate = dialog
      .getByRole('list', { name: 'Pessoas cadastradas disponíveis' })
      .getByRole('button')
      .filter({ hasText: johnPathEmail })
    // The picker DOES offer the candidate — the read-side gate admits hospital_admin.
    await expect(candidate).toBeVisible({ timeout: 10_000 })
    await candidate.click()
    await dialog.getByRole('button', { name: /^adicionar$/i }).click()

    await expect(page.locator('[role="status"]')).toContainText(
      /não tem permissão/i,
      { timeout: 10_000 },
    )
    await page.keyboard.press('Escape')
  })

  test('hospitaladmin.dual\'s vincular stands; org_admin (a working authority for addStaff) completes the seat on the Secundário A committee', async ({
    page,
  }) => {
    test.skip(!johnPathUserId, 'depends on the previous tests in this serial file')

    // Routes around BUG-AFF-1 with a DIFFERENT, fully-authorized actor so the rest of
    // the Dr. John scenario (search → vincular → seat on a committee) is still
    // demonstrated end to end, rather than leaving T3.6's clause 1 unattempted.
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto(ETICA_MEMBERS_URL)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Membros')

    await addMemberViaPicker(page, johnPathEmail)
    await expect(page.getByText(johnPathName).first()).toBeVisible({ timeout: 10_000 })

    // Confirm from the person's own page too: value-based, not banner-based.
    await page.goto(`/o/rede-a/manage/usuarios/${johnPathUserId}`)
    await expect(page.getByText('Comissão de Ética')).toBeVisible({ timeout: 10_000 })
  })

  test('read-only cross-check: hospitaladmin.a1 (central-a) searching dr.john\'s real CPF resolves outcome C (already vinculado)', async ({
    page,
  }) => {
    // dr.john is pre-seeded, affiliated to BOTH Rede A hospitals (T3.5) — this is
    // purely a READ path (no vincular click), so it cannot disturb the pinned fixture
    // pgTAP `301`/`302`+ assert against.
    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto('/o/rede-a/manage/usuarios/novo')
    await lookupByCpf(page, '11144477735')

    await expect(
      page.getByText(/já está vinculado a Hospital Central A/i),
    ).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByRole('link', { name: /abrir a página de/i }),
    ).toBeVisible()
    // No vincular affordance offered — there is nothing to create.
    await expect(page.getByRole('button', { name: /^vincular/i })).toHaveCount(0)
  })
})

test.describe('AFF-2: brand-new registration at a second hospital appears in the roster with ZERO committees (D2)', () => {
  test('hospitaladmin.dual registers a person locked to Hospital Secundário A with no committees', async ({
    page,
  }) => {
    const ts = Date.now()
    secondaryOnlyEmail = `aff.secundario.${ts}@test.local`
    secondaryOnlyName = `AFF Secundário ${ts}`

    await signInAs(page, 'hospitaladmin.dual@test.local')
    await page.goto(
      `/o/rede-a/manage/usuarios/novo?hospital=${encodeURIComponent(SECUNDARIO_A_ID)}`,
    )
    await lookupByCpf(page, uniqueCpf())
    await expect(page.getByLabel('Nome completo')).toBeVisible({ timeout: 10_000 })

    // The hospital is LOCKED to Secundário A — no chooser rendered at all.
    await expect(
      page.getByRole('combobox', { name: /^hospital/i }),
    ).toHaveCount(0)
    await expect(page.getByText(SECUNDARIO_A_NAME)).toBeVisible()

    await page.getByLabel('Nome completo').fill(secondaryOnlyName)
    await page.getByLabel('E-mail').fill(secondaryOnlyEmail)
    await page.getByLabel('Senha inicial').fill('Test1234!')
    const categorySelect = page.getByLabel('Categoria profissional')
    const opts = await categorySelect.locator('option').all()
    const firstReal = await opts[1].getAttribute('value')
    if (firstReal) await categorySelect.selectOption(firstReal)
    // Deliberately assign NO committee — this is the exact D2 case.
    await page.getByRole('button', { name: /registrar pessoa/i }).click()
    await page.waitForURL('**/o/rede-a/manage/usuarios', { timeout: 15_000 })

    // The roster row is legible, not an empty cell: hospital name + "Sem comissão".
    // `?hospital=` is required — hospitaladmin.dual's directory defaults to their
    // FIRST administered hospital (unordered — session.ts's `hospitalAdminOf` carries
    // no `.sort()`, unlike `orgAdminOf`), which need not be Secundário A.
    await page.goto(
      `/o/rede-a/manage/usuarios?hospital=${encodeURIComponent(SECUNDARIO_A_ID)}` +
        `&search=${encodeURIComponent(secondaryOnlyEmail)}`,
    )
    const card = page.locator('li').filter({ hasText: secondaryOnlyName })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(card.getByText(SECUNDARIO_A_NAME)).toBeVisible()
    await expect(card.getByText('Sem comissão', { exact: true })).toBeVisible()

    await card.click()
    await page.waitForURL(/\/usuarios\/[^/]+$/, { timeout: 10_000 })
    secondaryOnlyUserId = page.url().match(/\/usuarios\/([^/?]+)/)?.[1] ?? ''
    expect(secondaryOnlyUserId).toBeTruthy()
  })
})

test.describe('AFF-3: the negative — a hospital admin cannot see a person affiliated only to a sibling hospital', () => {
  // ⚠ Per ADR 0097 D6 and the external audit's LOW-1, this pins the DEFAULT STATE,
  // NOT a hard tenant boundary. `list_org_people` (the CPF-search door, D10) already
  // discloses the whole ORG roster to any hospital admin in that org (finding 1 — the
  // over-disclosure this ADR ratifies, not introduces): a hospital_admin.a1 CAN find
  // this person by CPF search and self-serve an affiliation to central-a, after which
  // the affiliation leg admits them. The tenant boundary that actually holds is the
  // ORGANIZATION (a rede-b admin gets nothing at all — see user-registration.spec.ts's
  // cross-org tests). What this test asserts is the widened `profiles` SELECT policy
  // (T2.3) and the roster/detail-page READ surfaces: hospitaladmin.a1 must not see a
  // person who is affiliated ONLY to secundario-a and holds no membership under
  // central-a EITHER — i.e. before they self-serve anything.
  test('hospitaladmin.a1 (central-a only) does not see the Secundário-A-only person in its directory', async ({
    page,
  }) => {
    test.skip(!secondaryOnlyUserId, 'depends on AFF-2')

    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto('/o/rede-a/manage/usuarios')
    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText(secondaryOnlyName)).not.toBeVisible()

    await page.goto(
      `/o/rede-a/manage/usuarios?search=${encodeURIComponent(secondaryOnlyEmail)}`,
    )
    await expect(page.getByText(secondaryOnlyName)).not.toBeVisible()
    // Empty is rendered as "none found", never "not allowed" (D10/D11 — an empty
    // result must not double as a permission oracle).
    await expect(page.getByText(/você não tem permissão|acesso negado/i)).not.toBeVisible()
  })

  test('hospitaladmin.a1 gets a not-found boundary (no leakage) navigating directly to the person\'s detail page', async ({
    page,
  }) => {
    test.skip(!secondaryOnlyUserId, 'depends on AFF-2')

    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto(`/o/rede-a/manage/usuarios/${secondaryOnlyUserId}`)
    await expect(
      page.getByText(/Não encontramos esta página|Erro 404/i).first(),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(secondaryOnlyName)).not.toBeVisible()
    await expect(page.getByText(secondaryOnlyEmail)).not.toBeVisible()
  })
})

test.describe('AFF-4: a deactivated account cannot be affiliated (HC0R4)', () => {
  // `desativado.conta@test.local` carries NO seeded CPF (it predates the AFF
  // requirement). Set one via the service role for this test only, and clear it back
  // to null afterwards — mirrors the established pattern in this file for reversible
  // service-role fixture setup (hospital-admin-tier.spec.ts's HA-2 leak cleanup).
  const HC0R4_CPF = uniqueCpf()

  test.beforeAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext()
    try {
      const res = await ctx.patch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${DESATIVADO_UID}`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          data: { cpf: HC0R4_CPF },
        },
      )
      expect(res.ok()).toBeTruthy()
    } finally {
      await ctx.dispose()
    }
  })

  test.afterAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext()
    try {
      await ctx.patch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${DESATIVADO_UID}`, {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        data: { cpf: null },
      })
    } finally {
      await ctx.dispose()
    }
  })

  test('searching a deactivated account by CPF offers no vincular affordance', async ({
    page,
  }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios/novo')
    await lookupByCpf(page, HC0R4_CPF)

    await expect(page.getByText(/está desativada/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: /^vincular/i })).toHaveCount(0)
  })
})

test.describe('AFF-5: matrícula/start-date edits go through updateAffiliation and the VALUE persists (not just a toast)', () => {
  const NEW_MATRICULA = `E2E-AFF-${Date.now()}`

  test('hospitaladmin.a1 edits dr.john\'s Central A matrícula; a fresh reload shows the NEW value', async ({
    page,
  }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto(`/o/rede-a/manage/usuarios/${DR_JOHN_UID}`)

    const centralRow = page
      .locator('div')
      .filter({ has: page.getByText(CENTRAL_A_NAME, { exact: true }) })
      .filter({ has: page.getByRole('button', { name: /encerrar vínculo/i }) })
      .first()
    const employeeIdInput = centralRow.getByLabel('Matrícula')
    await expect(employeeIdInput).toBeVisible({ timeout: 10_000 })
    const original = await employeeIdInput.inputValue()

    await employeeIdInput.fill(NEW_MATRICULA)
    await centralRow.getByRole('button', { name: /salvar vínculo/i }).click()
    await expect(page.getByText(/vínculo atualizado|atualizado/i).first()).toBeVisible({
      timeout: 10_000,
    })

    // The rigor ADR 0098 asks for: reload from scratch and assert the STORED value —
    // a toast alone cannot distinguish a real write from `affiliatePerson`'s silent
    // no-op on an existing row (the exact bug class the `update_affiliation` door
    // exists to close).
    await page.reload()
    const reloadedRow = page
      .locator('div')
      .filter({ has: page.getByText(CENTRAL_A_NAME, { exact: true }) })
      .filter({ has: page.getByRole('button', { name: /encerrar vínculo/i }) })
      .first()
    await expect(reloadedRow.getByLabel('Matrícula')).toHaveValue(NEW_MATRICULA, {
      timeout: 10_000,
    })

    // Cleanup: restore the seeded value, and verify THAT persists too.
    await reloadedRow.getByLabel('Matrícula').fill(original)
    await reloadedRow.getByRole('button', { name: /salvar vínculo/i }).click()
    await expect(page.getByText(/vínculo atualizado|atualizado/i).first()).toBeVisible({
      timeout: 10_000,
    })
    await page.reload()
    const restoredRow = page
      .locator('div')
      .filter({ has: page.getByText(CENTRAL_A_NAME, { exact: true }) })
      .filter({ has: page.getByRole('button', { name: /encerrar vínculo/i }) })
      .first()
    await expect(restoredRow.getByLabel('Matrícula')).toHaveValue(original, {
      timeout: 10_000,
    })
  })
})

test.describe('AFF-K: keyboard-only pass over the identifier-first flow', () => {
  test('org_admin drives the CPF lookup and follows the resolved-person link using only the keyboard', async ({
    page,
  }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios/novo')

    // page.focus() is not auto-waiting (it races RSC streaming and can silently
    // no-op) — retry the focus assertion, the established pattern in this repo
    // (user-registration.spec.ts AC7).
    const cpfInput = page.getByRole('textbox', { name: 'CPF' })
    await expect(cpfInput).toBeEditable({ timeout: 10_000 })
    await expect(async () => {
      await cpfInput.focus()
      await expect(cpfInput).toBeFocused({ timeout: 1_000 })
    }).toPass({ timeout: 10_000 })
    // A known, harmless, real seeded CPF — read-only outcome (C), keyboard-safe.
    await page.keyboard.type('11144477735')

    const buscarButton = page.getByRole('button', { name: /buscar pessoa/i })
    await buscarButton.focus()
    await expect(buscarButton).toBeFocused()
    await page.keyboard.press('Enter')

    // Focus-management contract (register-person-flow.tsx): the outcome heading is
    // the focus target for the step change, tabIndex=-1, focused via a callback ref —
    // assert it lands there, not merely that the heading exists.
    const outcomeHeading = page.getByRole('heading', {
      name: /já está vinculado a hospital central a/i,
    })
    await expect(outcomeHeading).toBeVisible({ timeout: 10_000 })
    await expect(outcomeHeading).toBeFocused()

    // Tab from the focused heading to the "Abrir a página de …" link and activate it
    // with the keyboard.
    await page.keyboard.press('Tab')
    const openLink = page.getByRole('link', { name: /abrir a página de/i })
    await expect(openLink).toBeFocused()
    await page.keyboard.press('Enter')

    await page.waitForURL(/\/usuarios\/[^/]+$/, { timeout: 10_000 })
    await expect(
      page.getByRole('heading', { name: 'John Silva', exact: true }),
    ).toBeVisible({ timeout: 10_000 })
  })
})
