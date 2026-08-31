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
const ETICA_COMMISSION_ID = 'e0000000-0000-0000-0000-0000000000e1'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}
const DESATIVADO_UID = '00000000-0000-0000-0000-0000000000d4'
const DR_JOHN_UID = '00000000-0000-0000-0000-0000000000a1'
const HOSPITALADMIN_A1_UID = '00000000-0000-0000-0000-0000000000e1'
const CCIH_NAME = 'Comissão de Controle de Infecção Hospitalar'

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

/**
 * ONE affiliation row on the person-detail page, addressed through the "Vínculos
 * hospitalares" card rather than the page.
 *
 * ⛔ NOT A TIDINESS HELPER — it is what keeps these assertions MEANING what they say.
 * The redesigned profile page (`2f6b0635`) added a "Histórico da conta" timeline whose
 * event details are composed as "… no <Hospital>, por <Nome>", so a hospital name is no
 * longer unique on the page: an unscoped `getByText(name)` matches the affiliation row
 * AND its own audit trail. Two failure modes follow, and both are silent — strict mode
 * reds on a page where the asserted row is present, and (worse) a `.first()` patch would
 * make "the affiliation exists" pass on an audit line describing an affiliation that had
 * since been ENDED. The card is where the fact lives, so the card is what gets asked.
 *
 * `<ul> → <li>` per affiliation (`affiliations-panel.tsx`), each `<li>` holding the
 * hospital name in its own `<p>` — hence `exact: true`, which also keeps "Hospital
 * Central A" from matching a longer sibling name.
 */
function affiliationRow(page: import('@playwright/test').Page, hospitalName: string) {
  return page
    .getByRole('region', { name: 'Vínculos hospitalares' })
    .locator('li')
    .filter({ has: page.getByText(hospitalName, { exact: true }) })
}

/**
 * Service-role REST read — the strongest available "assert the value, not the toast"
 * check: a raw row in `memberships`, bypassing RLS entirely. Used to confirm a seat
 * really exists (ALLOW arm) and that a sibling-hospital admin's refusal left the row
 * count exactly as it was (DENY arm) — a mirror bug in the OTHER direction (the fix
 * over-widens instead of correcting) produces a silent extra row, and only counting
 * rows tells that apart from "the button did nothing".
 */
async function countCommissionMembership(
  apiRequest: import('@playwright/test').APIRequest,
  commissionId: string,
  principalId: string,
): Promise<number> {
  const ctx = await apiRequest.newContext()
  try {
    const res = await ctx.get(
      `${SUPABASE_URL}/rest/v1/memberships` +
        `?commission_id=eq.${commissionId}&principal_id=eq.${principalId}&select=id`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      },
    )
    expect(res.ok()).toBeTruthy()
    const rows = (await res.json()) as unknown[]
    return rows.length
  } finally {
    await ctx.dispose()
  }
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

    // AFF2 F3 (ADR 0133 D6-D8): step 1 ("Dados pessoais") no longer submits directly —
    // advance to step 2 ("Vínculo hospitalar"), where the hospital picker now lives.
    await page.getByRole('button', { name: 'Continuar' }).click()

    // Employed at Hospital Central A ("hired at Hospital Regional") — the org_admin
    // create form's hospital picker is OPTIONAL ("Hospital (opcional)"), not locked.
    await page.getByLabel(/^hospital/i).selectOption({ label: CENTRAL_A_NAME })

    // Step 3 ("Comissões") — deliberately assign none for this basic path.
    await page.getByRole('button', { name: 'Continuar' }).click()

    await page.getByRole('button', { name: /registrar pessoa/i }).click()
    // AFF2 F3: a successful registerUser() now redirects straight to the created
    // person's own profile page, not the bare directory. ⚠ Must positively match a
    // UUID, not merely "/usuarios/<anything>" — the pre-submit URL is already
    // "/usuarios/novo", which trivially satisfies a bare `[^/]+$` with no navigation
    // having happened at all, silently masking a submission failure.
    await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/i, { timeout: 15_000 })

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
    await expect(affiliationRow(page, CENTRAL_A_NAME)).toBeVisible()
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
    //
    // ⚠ SCOPED TO THE CARD, and that is not cosmetic tidying. The profile page now also
    // renders a "Histórico da conta" timeline whose event details read "no Hospital
    // Central A, por …", so a page-wide `getByText(CENTRAL_A_NAME)` matches the
    // affiliation row AND its audit event — a strict-mode violation that reads as a
    // regression while the row it is asserting is right there. Naming the card also
    // says what the assertion MEANS: the affiliation exists, not merely that the
    // hospital's name appears somewhere on the page (which an audit line alone would
    // satisfy, and which is exactly the silent no-op this assertion exists to catch).
    await expect(affiliationRow(page, CENTRAL_A_NAME)).toBeVisible()
    await expect(affiliationRow(page, SECUNDARIO_A_NAME)).toBeVisible()
  })

  // BUG-AFF-1 — FIXED, `8155be2` (`authorizeStaffOps` now mirrors
  // `is_tenancy_admin_of`'s hospital leg, same as its sibling `authorizeForCommission`).
  // ⚠ The fix was a MIRROR-DRIFT CORRECTION, not a capability widening: every door
  // `authorizeStaffOps` fronts (`grant_role`/`grant_role_impl`'s commission-tier arms,
  // `appoint_administrativo`, `grant_member_capability`, …) already resolved
  // `is_tenancy_admin_of[_for]`, which has always admitted a hospital_admin of the
  // commission's hospital — the TS pre-check was simply STRICTER than every door behind
  // it, and failed closed, which is why nothing caught it. `hospital_admin` gained
  // NOTHING new here; the record row above must not be misread as a security change.
  //
  // The repro is now INVERTED (not deleted — the "281 D1" convention this suite already
  // uses): hospitaladmin.dual completes the seat AS THEMSELVES, and this asserts the
  // SEAT EXISTS — a real `memberships` row read via the service role, bypassing RLS —
  // not merely that the error toast is gone. A mirror bug in the OTHER direction (the
  // fix over-widens instead of correcting) produces a SILENT SUCCESS from an
  // unauthorized caller; only a state assertion, not an absence-of-error assertion,
  // tells the two apart.
  test('hospitaladmin.dual seats the person on Comissão de Ética AS THEMSELVES — the seat exists afterward (BUG-AFF-1 fixed)', async ({
    page,
    playwright,
  }) => {
    test.skip(!johnPathUserId, 'depends on the previous tests in this serial file')

    await signInAs(page, 'hospitaladmin.dual@test.local')
    await page.goto(ETICA_MEMBERS_URL)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Membros')

    const before = await countCommissionMembership(
      playwright.request,
      ETICA_COMMISSION_ID,
      johnPathUserId,
    )
    expect(before).toBe(0)

    await addMemberViaPicker(page, johnPathEmail)

    // UI state: the roster AND the person's own page both show the seat.
    //
    // ⚠ THE SEAT, NOT ITS AUDIT LINE. The profile's "Histórico da conta" timeline
    // renders the very grant this test just made as "… na Comissão de Ética, por …", so
    // an unscoped name match now finds the membership row AND the event describing it.
    // Those are not interchangeable evidence: BUG-AFF-1 was a door that REFUSED while
    // the UI looked fine, and a trail entry can outlive the seat it recorded. The
    // "Comissões" card is the only one of the two that answers "is this person seated".
    await expect(page.getByText(johnPathName).first()).toBeVisible({ timeout: 10_000 })
    await page.goto(`/o/rede-a/manage/usuarios/${johnPathUserId}`)
    await expect(
      page
        .getByRole('region', { name: 'Comissões' })
        .locator('li')
        .filter({ hasText: 'Comissão de Ética' }),
    ).toBeVisible({ timeout: 10_000 })

    // DB state, RLS-bypassed: exactly one membership row, never zero (a no-op refusal
    // dressed as success) and never more than one (a duplicate from a retried/racing
    // write).
    const after = await countCommissionMembership(
      playwright.request,
      ETICA_COMMISSION_ID,
      johnPathUserId,
    )
    expect(after).toBe(1)

    // The fix must not have touched anything on the OTHER hospital — the person's
    // Central A affiliation (created in the first test of this file) is untouched.
    const centralCtx = await playwright.request.newContext()
    try {
      const res = await centralCtx.get(
        `${SUPABASE_URL}/rest/v1/hospital_affiliations` +
          `?principal_id=eq.${johnPathUserId}&hospital_id=eq.${CENTRAL_A_ID}&ended_on=is.null&select=id`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        },
      )
      expect(res.ok()).toBeTruthy()
      expect(((await res.json()) as unknown[]).length).toBe(1)
    } finally {
      await centralCtx.dispose()
    }
  })

  // DENY arm, same shape, same commission: a hospital admin of a SIBLING hospital in
  // the same org (hospitaladmin.a1 administers central-a only; Comissão de Ética lives
  // under secundario-a) must still be refused. `authorizeStaffOps`'s fixed hospital leg
  // is `is_hospital_admin_of(commission's hospital)` — narrow to THAT hospital, not
  // "any hospital in the org" — so a blanket widening of the arm would pass this ALLOW
  // above but also wrongly pass this DENY (`backend`'s unit keystone proves the same
  // shape at the TS-function level; this proves it survives through the real page/RLS
  // stack a future refactor of the helper could otherwise silently bypass). Today this
  // manifests as the page's own not-found boundary — `getCommissionAccessByOrg` gates on
  // the identical hospital-scoped authority — so the picker is never reached at all;
  // asserted here (not left to HA-1's general-purpose cross-hospital test alone) because
  // it is the SAME commission and the SAME persona as the ALLOW arm above, so a
  // regression in either direction shows up together.
  test('hospitaladmin.a1 (sibling hospital — central-a only) is still refused for Comissão de Ética (secundario-a)', async ({
    page,
    playwright,
  }) => {
    test.skip(!johnPathUserId, 'depends on the previous tests in this serial file')

    const before = await countCommissionMembership(
      playwright.request,
      ETICA_COMMISSION_ID,
      johnPathUserId,
    )

    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto(ETICA_MEMBERS_URL)
    // BUG-ACT-NOTFOUND-COPY-1: /não encontr/i — this commission-tier manage/members
    // route hits the commission not-found boundary (ACT ADR 0106's sibling;
    // "Erro 404" is not part of its copy), verified live across the QO·B
    // CUT_ROUTES sample.
    await expect(page.getByText(/não encontr/i).first()).toBeVisible({
      timeout: 10_000,
    })
    // No leakage: neither the picker nor any member/candidate name ever renders.
    await expect(page.getByRole('button', { name: /adicionar membro/i })).toHaveCount(0)
    await expect(page.getByText(johnPathName)).not.toBeVisible()

    // State, not just the boundary screen: the row count is UNCHANGED by the attempt.
    const after = await countCommissionMembership(
      playwright.request,
      ETICA_COMMISSION_ID,
      johnPathUserId,
    )
    expect(after).toBe(before)
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

    await page.getByLabel('Nome completo').fill(secondaryOnlyName)
    await page.getByLabel('E-mail').fill(secondaryOnlyEmail)
    await page.getByLabel('Senha inicial').fill('Test1234!')
    const categorySelect = page.getByLabel('Categoria profissional')
    const opts = await categorySelect.locator('option').all()
    const firstReal = await opts[1].getAttribute('value')
    if (firstReal) await categorySelect.selectOption(firstReal)

    // AFF2 F3 (ADR 0133 D6-D8): the locked-hospital display used to be step-1
    // content; it now lives on step 2 ("Vínculo hospitalar").
    await page.getByRole('button', { name: 'Continuar' }).click()

    // The hospital is LOCKED to Secundário A — no chooser rendered at all.
    await expect(
      page.getByRole('combobox', { name: /^hospital/i }),
    ).toHaveCount(0)
    // exact: true — the step's own description paragraph ("A pessoa será vinculada
    // ao Hospital Secundário A. Pular esta etapa...") also contains this substring.
    await expect(page.getByText(SECUNDARIO_A_NAME, { exact: true })).toBeVisible()

    // Step 3 ("Comissões") — deliberately assign NO committee, the exact D2 case.
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: /registrar pessoa/i }).click()
    // AFF2 F3: redirects straight to the created person's own profile page. ⚠ Must
    // positively match a UUID — see the sibling comment above on why a bare
    // `[^/]+$` is unsafe here specifically (the pre-submit URL is already
    // "/usuarios/novo").
    await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/i, { timeout: 15_000 })

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
    // BUG-ACT-NOTFOUND-COPY-1: /não encontr/i — this ORG-tier manage/usuarios
    // route hits src/app/o/[org]/manage/not-found.tsx (ACT ADR 0106's org-tier
    // sibling boundary; "Erro 404" is not part of its copy), verified live via
    // this exact test's own error-context snapshot before widening.
    await expect(
      page.getByText(/não encontr/i).first(),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(secondaryOnlyName)).not.toBeVisible()
    await expect(page.getByText(secondaryOnlyEmail)).not.toBeVisible()
  })
})

test.describe('AFF-4: a deactivated account cannot be affiliated (HC0R4)', () => {
  // `desativado.conta@test.local` carries NO seeded CPF (it predates the AFF
  // requirement). Set one via the service role for this test only, and remove it
  // afterwards — mirrors the established pattern in this file for reversible
  // service-role fixture setup (hospital-admin-tier.spec.ts's HA-2 leak cleanup).
  //
  // ⛔ AE3 (ADR 0155 D4) MADE THIS A POST-UPSERT, NOT A PATCH, AND THAT IS THE WHOLE
  // POINT OF THE EDIT. The CPF moved to `profile_private_details`, and this persona has
  // no row there — the comment directly above says so. A re-pointed PATCH matches ZERO
  // rows, writes nothing, and PostgREST answers 204: `res.ok()` stays true, the fixture
  // reports success, and the test then fails downstream looking like a product defect.
  // `Prefer: resolution=merge-duplicates` makes it an upsert, which is correct whether or
  // not a row exists.
  const HC0R4_CPF = uniqueCpf()

  test.beforeAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext()
    try {
      const res = await ctx.post(`${SUPABASE_URL}/rest/v1/profile_private_details`, {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal,resolution=merge-duplicates',
        },
        data: { profile_id: DESATIVADO_UID, cpf: HC0R4_CPF },
      })
      expect(res.ok(), `seeding the HC0R4 CPF failed: ${await res.text()}`).toBeTruthy()
    } finally {
      await ctx.dispose()
    }
  })

  test.afterAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext()
    try {
      // ⭐ DELETE the row rather than nulling its `cpf`. The persona had NO row here
      // before this block ran, so deleting restores the exact prior state; leaving an
      // all-null row behind would newly assert "this person HAS restricted details on
      // file", which is what a row in this table means for a data-subject request.
      // ⚠ Deleted BY IDENTITY (`profile_id=eq.…`), never positionally.
      await ctx.delete(
        `${SUPABASE_URL}/rest/v1/profile_private_details?profile_id=eq.${DESATIVADO_UID}`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            Prefer: 'return=minimal',
          },
        },
      )
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

    // ⚠ THE EDITOR IS A MODAL NOW (redesign 3c, `2f6b0635`) — the inline per-row
    // matrícula field is gone and `updateAffiliation` is reached through the row's
    // "Editar vínculo com <hospital>" trigger. What this test EXISTS to prove is
    // unchanged and is not negotiable: the door actually writes. Nothing below is
    // allowed to soften into "a dialog closed".
    const centralRow = affiliationRow(page, CENTRAL_A_NAME)
    await expect(centralRow).toBeVisible({ timeout: 10_000 })

    const original = await readMatricula(page, CENTRAL_A_NAME)
    await setMatricula(page, CENTRAL_A_NAME, NEW_MATRICULA)

    // ⛔ THE TOAST IS GONE, AND ITS REPLACEMENT IS STRICTLY STRONGER. 3c closes on
    // success and lets the server action's revalidation repaint the card, so what is
    // asserted here is the ROW as the server re-rendered it — not a client-side claim
    // that a write happened. `affiliatePerson`'s silent no-op on an existing row (the
    // bug class `update_affiliation` exists to close) leaves the old matrícula in this
    // very string.
    await expect(centralRow).toContainText(`Matrícula ${NEW_MATRICULA}`, {
      timeout: 10_000,
    })

    // The rigor ADR 0098 asks for: reload from scratch and assert the STORED value. A
    // repaint driven by `revalidatePath` still reads the database, but only a fresh
    // navigation rules out a cached client tree entirely.
    await page.reload()
    await expect(affiliationRow(page, CENTRAL_A_NAME)).toContainText(
      `Matrícula ${NEW_MATRICULA}`,
      { timeout: 10_000 },
    )
    expect(await readMatricula(page, CENTRAL_A_NAME)).toBe(NEW_MATRICULA)

    // Cleanup: restore the seeded value, and verify THAT persists too — asserted on the
    // form control rather than the row text, because the seeded original may be empty
    // and an empty matrícula renders no "Matrícula …" segment at all.
    await setMatricula(page, CENTRAL_A_NAME, original)
    await page.reload()
    expect(await readMatricula(page, CENTRAL_A_NAME)).toBe(original)
  })
})

/** Opens 3c's edit mode over one affiliation row and returns the dialog. */
async function openAffiliationDialog(
  page: import('@playwright/test').Page,
  hospitalName: string,
) {
  await affiliationRow(page, hospitalName)
    .getByRole('button', { name: `Editar vínculo com ${hospitalName}` })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Editar vínculo hospitalar' })
  await expect(dialog).toBeVisible({ timeout: 10_000 })
  // The hospital is read-only in edit mode — confirming it here is what makes the
  // matrícula assertions below about THIS affiliation rather than whichever row the
  // trigger happened to belong to.
  await expect(dialog.getByText(hospitalName, { exact: true })).toBeVisible()
  return dialog
}

/** The matrícula currently STORED for an affiliation, read back through 3c. */
async function readMatricula(
  page: import('@playwright/test').Page,
  hospitalName: string,
): Promise<string> {
  const dialog = await openAffiliationDialog(page, hospitalName)
  const value = await dialog.getByLabel('Matrícula').inputValue()
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).not.toBeVisible({ timeout: 10_000 })
  return value
}

/** Writes a matrícula through 3c and waits for the dialog to close on success. */
async function setMatricula(
  page: import('@playwright/test').Page,
  hospitalName: string,
  value: string,
) {
  const dialog = await openAffiliationDialog(page, hospitalName)
  await dialog.getByLabel('Matrícula').fill(value)
  await dialog.getByRole('button', { name: 'Salvar vínculo' }).click()
  // 3c closes ONLY after the server action resolves ok — a refusal keeps it open and
  // renders a FormBanner, so "closed" is a real (if weak) success signal. The value
  // assertions at the call site are what make it a proof.
  await expect(dialog).not.toBeVisible({ timeout: 15_000 })
}

test.describe('AFF-6: endAffiliation blockers name the actual seats (D5, HC0R1)', () => {
  // QA pass 1 found English text (" — no hospital") rendered inside this pt-BR alert.
  // It survived every prior gate because NO E2E exercised the blockers list at all —
  // and specifically not its HOSPITAL-TIER arm, the one the external audit's MEDIUM-3
  // added so that ending an affiliation cannot orphan a sitting technical director's
  // seat. `frontend` fixed the string (" — cargo do hospital") AND a second, deeper
  // defect underneath it: the confirm `AlertDialog` closed ONLY on success, so a
  // refusal rendered BEHIND the still-open dialog — dimmed and `aria-hidden`, since
  // Radix hides everything outside an open dialog. The blockers list was therefore
  // INERT to assistive technology (and looked like the button did nothing to a sighted
  // admin). Both dialogs (this one and `user-lifecycle-actions.tsx`'s D14 refusal, the
  // identical shape) now close on either outcome.
  //
  // ⚠ Assert via `getByRole('alert')`, NOT `getByText` — that is what actually pins the
  // dialog-closing fix. A text locator would pass even if the alert went back behind an
  // `aria-hidden` wrapper; a role-based locator times out on text that is plainly
  // visible in a screenshot specifically WHEN it is `aria-hidden`, which is the
  // accessibility bug itself, not a bad selector.
  //
  // The two tests assert DIFFERENT rendered text (a committee name vs. "cargo do
  // hospital") so that a spec passing on either arm alone could not have caught this —
  // exactly how the hospital-tier arm went unseen: every hand check used a committee
  // seat.

  test('commission-tier blocker: ending dr.john\'s Central A affiliation is refused and names his CCIH seat', async ({
    page,
  }) => {
    // dr.john holds an active `staff` membership of CCIH (central-a) — READ-ONLY safe:
    // the door refuses the end, so nothing about the pinned T3.5 fixture changes.
    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto(`/o/rede-a/manage/usuarios/${DR_JOHN_UID}`)

    const centralRow = page
      .locator('div')
      .filter({ has: page.getByText(CENTRAL_A_NAME, { exact: true }) })
      .filter({ has: page.getByRole('button', { name: /encerrar vínculo/i }) })
      .first()
    await centralRow.getByRole('button', { name: /encerrar vínculo/i }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await dialog.getByRole('button', { name: /^encerrar vínculo$/i }).click()

    // The dialog must close on refusal too (the fixed bug) — the alert is otherwise
    // unreachable to a role-based query, `aria-hidden` behind it.
    await expect(dialog).not.toBeVisible({ timeout: 10_000 })
    const alert = page.getByRole('region', { name: 'Vínculos hospitalares' }).getByRole('alert')
    await expect(alert).toBeVisible({ timeout: 10_000 })
    await expect(alert).toContainText('Remova estas funções antes de encerrar o vínculo')
    // The rendered blocker names the ROLE and the COMMITTEE — not a generic refusal,
    // and never the raw English fallback (" — no hospital") QA caught.
    await expect(alert).toContainText(`Membro — ${CCIH_NAME}`)
    await expect(alert).not.toContainText('no hospital')
  })

  test('hospital-tier blocker (never rendered before this spec): ending hospitaladmin.a1\'s OWN affiliation is refused and names their Administração do hospital seat', async ({
    page,
  }) => {
    // CORRECTED FIXTURE (the lead's first pointer, dt.a, was verified against the live
    // catalog and does NOT work — 0 active affiliations, so there is nothing to end and
    // the refusal never fires). `hospitaladmin.a1@test.local` is the one seed persona
    // both affiliated to a hospital (central-a, 1 active row) AND holding a hospital-
    // tier seat there (`hospital_admin`, no commission membership at all — verified
    // live) — exactly the shape D5's hospital-tier arm exists for. READ-ONLY safe, same
    // as the commission-tier test: the door refuses the end, so nothing in the seed
    // changes and no cleanup is needed.
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto(`/o/rede-a/manage/usuarios/${HOSPITALADMIN_A1_UID}`)

    const centralRow = page
      .locator('div')
      .filter({ has: page.getByText(CENTRAL_A_NAME, { exact: true }) })
      .filter({ has: page.getByRole('button', { name: /encerrar vínculo/i }) })
      .first()
    await centralRow.getByRole('button', { name: /encerrar vínculo/i }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await dialog.getByRole('button', { name: /^encerrar vínculo$/i }).click()

    await expect(dialog).not.toBeVisible({ timeout: 10_000 })
    const alert = page.getByRole('region', { name: 'Vínculos hospitalares' }).getByRole('alert')
    await expect(alert).toBeVisible({ timeout: 10_000 })
    await expect(alert).toContainText('Remova estas funções antes de encerrar o vínculo')
    // The hospital-tier arm: no committee to name, so the seat is identified by role
    // alone plus the settled pt-BR "cargo do hospital" qualifier — never the English
    // fallback QA caught, and never a bare, unqualified role with no seat description.
    await expect(alert).toContainText('Administração do hospital — cargo do hospital')
    await expect(alert).not.toContainText('no hospital')
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
