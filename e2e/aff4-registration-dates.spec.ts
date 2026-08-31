import { test, expect } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import { uniqueCpf } from './helpers/cpf'
import { pickDate } from './helpers/date-pickers'
import { svcSelect } from './helpers/service-role'

/**
 * AFF4 T5 — the two registration-flow date fields named in the plan's coverage-gap
 * list as having ZERO E2E coverage: `register-person-wizard.tsx`'s "Nascimento"
 * (brand-new person) and `register-person-flow.tsx`'s "Início do vínculo"
 * (existing person, new hospital affiliation).
 *
 * ⚠ THIS BLOCK ASSERTED A FALSEHOOD BETWEEN 2026-08-26 AND `bcf62723`, AND THE
 * ORIGINAL WORDING IS KEPT BELOW BECAUSE IT WAS COMMITTED AND MAY HAVE BEEN READ.
 * It said `RegisterUserInput.affiliationStartedOn` had "no UI control anywhere"
 * and that "no start-date field exists on any of its 3 steps", so the parameter
 * "CANNOT be exercised here — there is no field to fill". That was true when
 * written and false from `bcf62723` (F4), which added "Início do vínculo
 * (opcional)" to `RegisterPersonWizard` step 2.
 *
 * ⛔ It is the TRAPPING kind of stale comment, which is why it is corrected
 * rather than deleted: its specific effect was to tell the next reader NOT to
 * write the arm that is genuinely missing. That arm is still missing — see the
 * named absence below. `BUG-REGWIZARD-NO-ORG-STARTDATE-001` is CLOSED.
 *
 * ⭕ NAMED ABSENCE, not coverage: no single test drives the wizard's start-date
 * control and reads back BOTH persisted rows. One field feeds two doors
 * (`affiliate_new_person_for` and `affiliate_new_person_to_org_for` — the
 * CREATION doors `registerUser` calls, ADR 0168 Amdt 1/2, not the ordinary
 * `affiliate_person_for` / `affiliate_person_to_org_for`), each
 * `coalesce(p_started_on, current_date)`, so a composition arm is what would
 * catch one row silently defaulting while the other takes the typed value.
 * The four links are each witnessed — including a severance-proved component
 * seam in `register-person-wizard-start-date.test.tsx` — but the composition is
 * not. ⚠ Any such arm must use a fixed PAST date: an expected value equal to
 * today passes identically whether the wiring works or not.
 *
 * What IS reachable, real, and previously uncovered, and is what this file
 * asserts:
 *  - "Nascimento" (register-person-wizard.tsx, Step 0) -> `profiles.date_of_birth`.
 *  - "Início do vínculo" (register-person-flow.tsx, outcome B) -> the pre-existing
 *    (not D13) `hospital_affiliations.started_on`, via `affiliatePerson`.
 * Both assert the PERSISTED DB value exactly, never "the form submitted".
 */

const CENTRAL_A_ID = '05000000-0000-0000-0000-00000000000a'
const CENTRAL_A_NAME = 'Hospital Central A'

let uniqueCounter = 0
function uniqueToken(): string {
  const worker = test.info().workerIndex
  uniqueCounter += 1
  return `${worker}-${Date.now()}-${uniqueCounter}`
}

async function signInAs(page: import('@playwright/test').Page, email: string) {
  await cachedSignIn(page, email, 'Test1234!')
}

/** Local-calendar-parts ISO date N months before today, same day-of-month — the
 * exact arithmetic `pickDate`'s `monthsBack` navigation performs, so the value
 * this computes is what a click-through of that many "mês anterior" presses
 * followed by selecting `day` actually lands on. Local parts throughout (never
 * `toISOString()`), matching this codebase's own established date convention
 * (`affiliations-panel.tsx`'s `formatDate`/`todayIso` — UTC parsing shifts a DATE
 * column a day west).
 */
function isoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function monthsBackIso(monthsBack: number, day: number): string {
  const now = new Date()
  return isoLocal(new Date(now.getFullYear(), now.getMonth() - monthsBack, day))
}

test.describe('AFF4-REGDATES: "Nascimento" on the brand-new-person wizard round-trips to profiles.date_of_birth', () => {
  test('org_admin sets a specific date of birth while registering a new person; the exact value persists', async ({
    page,
    request,
  }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios/novo')
    await page.getByRole('textbox', { name: 'CPF' }).fill(uniqueCpf())
    await page.getByRole('button', { name: /buscar pessoa/i }).click()
    await expect(page.getByLabel('Nome completo')).toBeVisible({ timeout: 10_000 })

    const token = uniqueToken()
    const fullName = `AFF4 Regdate Nascimento ${token}`
    const email = `aff4.regdate.dob.${token}@test.local`
    await page.getByLabel('Nome completo').fill(fullName)
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('Senha inicial').fill('Test1234!')
    await page.getByLabel('Categoria profissional').selectOption({ label: 'Médico(a)' }).catch(async () => {
      const select = page.getByLabel('Categoria profissional')
      const options = await select.locator('option').all()
      if (options.length > 1) {
        const value = await options[1].getAttribute('value')
        if (value) await select.selectOption(value)
      }
    })

    // "Nascimento (opcional)" — Step 0, the ONE DatePicker present on this step.
    // Structural locator, not role+name: once a value is picked, the sibling
    // clear button's OWN accessible name also contains "Nascimento" (its
    // aria-labelledby folds in the field's label), so a name-based match on the
    // trigger becomes ambiguous the moment a date is set — the same shape
    // `date-pickers.ts`'s own helpers avoid by keying on `aria-haspopup="dialog"`.
    const dobField = page.locator('label').filter({ hasText: 'Nascimento' }).first().locator('xpath=..')
    const dobTrigger = dobField.locator('button[aria-haspopup="dialog"]').first()
    await expect(dobTrigger).toBeVisible({ timeout: 5_000 })
    const expectedDob = monthsBackIso(24, 10)
    await pickDate(page, page, { trigger: dobTrigger, monthsBack: 24, day: '10' })

    const continueButton = page.getByRole('button', { name: 'Continuar' })
    await continueButton.click()
    await continueButton.click()
    await page.getByRole('button', { name: /registrar pessoa/i }).click()
    await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/i, { timeout: 15_000 })
    const userId = page.url().match(/\/usuarios\/([0-9a-f-]{36})$/i)?.[1] ?? ''
    expect(userId).toBeTruthy()

    // ⭐ AE3 (ADR 0155 D4): `date_of_birth` left `profiles` for `profile_private_details`,
    // keyed on `profile_id`. The assertion below is unchanged — it is the WIZARD's
    // round-trip that is under test, not the storage location — but the read had to move
    // or it 42703s and the round-trip goes unmeasured.
    const rows = await svcSelect<{ date_of_birth: string | null }>(
      request,
      'profile_private_details',
      `profile_id=eq.${userId}&select=date_of_birth`,
    )
    expect(rows).toHaveLength(1)
    // The value, exactly — not merely "not null". A silently-dropped date would
    // leave this NULL; a silently-defaulted one would land on today, neither of
    // which equals `expectedDob`.
    expect(rows[0].date_of_birth).toBe(expectedDob)
  })
})

test.describe('AFF4-REGDATES: "Início do vínculo" on the existing-person affiliate flow round-trips to hospital_affiliations.started_on', () => {
  test('org_admin affiliates an already-registered (hospital-less) person with a specific start date; the exact value persists', async ({
    page,
    request,
  }) => {
    await signInAs(page, 'orgadmin.a@test.local')

    // Set up: a person who exists in the org but holds NO hospital affiliation
    // yet, so the next CPF search resolves outcome B (found, not-yet-affiliated
    // to the target hospital) rather than outcome C (already vinculado).
    const cpf = uniqueCpf()
    await page.goto('/o/rede-a/manage/usuarios/novo')
    await page.getByRole('textbox', { name: 'CPF' }).fill(cpf)
    await page.getByRole('button', { name: /buscar pessoa/i }).click()
    await expect(page.getByLabel('Nome completo')).toBeVisible({ timeout: 10_000 })
    const token = uniqueToken()
    const fullName = `AFF4 Regdate Vinculo ${token}`
    const email = `aff4.regdate.vinculo.${token}@test.local`
    await page.getByLabel('Nome completo').fill(fullName)
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('Senha inicial').fill('Test1234!')
    await page.getByLabel('Categoria profissional').selectOption({ label: 'Médico(a)' }).catch(async () => {
      const select = page.getByLabel('Categoria profissional')
      const options = await select.locator('option').all()
      if (options.length > 1) {
        const value = await options[1].getAttribute('value')
        if (value) await select.selectOption(value)
      }
    })
    const continueButton = page.getByRole('button', { name: 'Continuar' })
    await continueButton.click() // Step 1 (Vínculo hospitalar) — skip, no hospital.
    await continueButton.click() // Step 2 (Comissões) — skip.
    await page.getByRole('button', { name: /registrar pessoa/i }).click()
    await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/i, { timeout: 15_000 })
    const userId = page.url().match(/\/usuarios\/([0-9a-f-]{36})$/i)?.[1] ?? ''
    expect(userId).toBeTruthy()

    // Now re-search the SAME CPF, hospital locked via `?hospital=`, to reach
    // outcome B's "Vincular" sub-form (register-person-flow.tsx) with the
    // "Início do vínculo (opcional)" DatePicker — the field this test exists for.
    await page.goto(`/o/rede-a/manage/usuarios/novo?hospital=${encodeURIComponent(CENTRAL_A_ID)}`)
    await page.getByRole('textbox', { name: 'CPF' }).fill(cpf)
    await page.getByRole('button', { name: /buscar pessoa/i }).click()
    // Sync point first: wait for the "found" outcome region before inspecting
    // its contents — `.count()` does not auto-wait the way `expect(...).toBeVisible()`
    // does, and checking it too early is a real race (measured: it read 0 while
    // the outcome panel was still rendering, mis-selecting the "locked display"
    // branch below).
    await expect(
      page.getByRole('heading', { name: new RegExp(fullName) }).first(),
    ).toBeVisible({ timeout: 10_000 })
    // An org_admin (unlike a hospital-locked hospital_admin) still gets an
    // editable chooser here, accessible name exactly "Hospital" — `?hospital=`
    // does not preset it (confirmed: it opens on the disabled "Selecione um
    // hospital" placeholder), so this test selects explicitly rather than
    // trusting a locked display that does not exist for this actor.
    await page.getByRole('combobox', { name: 'Hospital' }).selectOption({ label: CENTRAL_A_NAME })

    const startField = page
      .locator('label')
      .filter({ hasText: 'Início do vínculo' })
      .first()
      .locator('xpath=..')
    const startTrigger = startField.locator('button[aria-haspopup="dialog"]').first()
    await expect(startTrigger).toBeVisible({ timeout: 5_000 })
    const expectedStart = monthsBackIso(1, 15)
    await pickDate(page, page, { trigger: startTrigger, monthsBack: 1, day: '15' })

    await page
      .getByRole('button', { name: new RegExp(`vincular ao ${CENTRAL_A_NAME}`, 'i') })
      .click()
    await page.waitForURL(new RegExp(`/usuarios/${userId}$`), { timeout: 10_000 })

    const rows = await svcSelect<{ started_on: string }>(
      request,
      'hospital_affiliations',
      `principal_id=eq.${userId}&hospital_id=eq.${CENTRAL_A_ID}&select=started_on`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].started_on).toBe(expectedStart)
  })
})
