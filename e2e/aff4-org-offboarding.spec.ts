import { test, expect } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import { uniqueCpf } from './helpers/cpf'
import { svcSelect } from './helpers/service-role'

/**
 * AFF4 T2 — the org offboarding wizard (`OrgOffboardingWizard`,
 * `src/components/users/org-offboarding-wizard.tsx`) end to end, plus the
 * cross-runtime parity gate ADR 0151 D10 (as amended by ADR 0154) depends on.
 *
 * ⛔ SCOPED TO THE ORG DIRECTORY (`listOrgUsers`), DELIBERATELY. This is the only
 * gate that exercises the SQL door (`app.affiliate_new_person_to_org_for` —
 * the CREATION door, ADR 0168 Amdt 1/2; `registerBareOrgPerson` below goes
 * through `registerUser`, which calls the creation door, never the ordinary
 * `affiliate_person_to_org_for` — / `end_org_affiliation` / `list_org_people`)
 * and the TS queries
 * (`listOrgUsers`/`lookupOrgPeople`) in ONE process, so it is what catches either
 * surface changing its default alone — two independently-green unit tests never
 * would (plan §Track T, T2). `listHospitalUsers` deliberately does NOT carry the
 * org-affiliation predicate (PO-ruled 2026-08-26): a `hospital_admin` cannot read
 * `organization_affiliations` at all (ADR 0151 D1; pgTAP `375` §4.1 pins that
 * absence). A parity gate spanning both surfaces would red on CORRECT code — this
 * file therefore never asserts `orgAffiliationStatus`/`includeEnded` against the
 * hospital-scoped view, only against `listOrgUsers` (an org_admin's own directory).
 *
 * Fixtures are additive-only (freshly registered people, never a seeded persona) —
 * `seed.sql` is a contract with ~900 tests and this file never mutates it.
 */

let uniqueCounter = 0
function uniqueToken(): string {
  const worker = test.info().workerIndex
  uniqueCounter += 1
  return `${worker}-${Date.now()}-${uniqueCounter}`
}

async function signInAs(page: import('@playwright/test').Page, email: string) {
  await cachedSignIn(page, email, 'Test1234!')
}

/** Registers a brand-new person with no hospital and no committee — the D2/D12
 * "affiliated to the org only" starting state every test in this file needs. */
async function registerBareOrgPerson(
  page: import('@playwright/test').Page,
  fullName: string,
  email: string,
): Promise<string> {
  await page.goto('/o/rede-a/manage/usuarios/novo')
  await page.getByRole('textbox', { name: 'CPF' }).fill(uniqueCpf())
  await page.getByRole('button', { name: /buscar pessoa/i }).click()
  await expect(page.getByLabel('Nome completo')).toBeVisible({ timeout: 10_000 })

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

  // Step 2 ("Vínculo hospitalar") and step 3 ("Comissões") both skippable —
  // deliberately: this person must start with ZERO hospital affiliations and
  // ZERO memberships so the org-offboard has no blockers (or, for the blocked
  // test, so the ONE blocker added afterward via the affiliations panel is the
  // only one).
  const continueButton = page.getByRole('button', { name: 'Continuar' })
  await continueButton.click()
  await continueButton.click()
  await page.getByRole('button', { name: /registrar pessoa/i }).click()

  await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/i, { timeout: 15_000 })
  return page.url().match(/\/usuarios\/([0-9a-f-]{36})$/i)?.[1] ?? ''
}

test.describe('AFF4-OFFBOARD: blocked path -> guided completion (fix outside the wizard) -> retry succeeds -> deactivation ACCEPT arm', () => {
  test('org_admin is refused with the active hospital affiliation named, ends it via the affiliations panel, retries, and accepts the deactivation offer', async ({
    page,
    request,
  }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    const token = uniqueToken()
    const fullName = `AFF4 Offboard Blocked ${token}`
    const email = `aff4.offboard.blocked.${token}@test.local`
    const userId = await registerBareOrgPerson(page, fullName, email)
    expect(userId).toBeTruthy()

    // Give this person exactly one active tie: a hospital affiliation at
    // Secundário A, added through the affiliations panel (never the registration
    // wizard's own hospital step) so this test owns the whole shape explicitly.
    const vinculos = page.getByRole('region', { name: 'Vínculos hospitalares' })
    await expect(vinculos).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /adicionar vínculo/i }).click()
    const addDialog = page.getByRole('dialog', { name: /adicionar vínculo hospitalar/i })
    await expect(addDialog).toBeVisible({ timeout: 5_000 })
    await addDialog.getByLabel(/^hospital$/i).selectOption({ label: 'Hospital Secundário A' })
    await addDialog.getByRole('button', { name: /^adicionar vínculo$/i }).click()
    await expect(addDialog).not.toBeVisible({ timeout: 10_000 })
    const hospitalRow = vinculos.locator('li').filter({ hasText: 'Hospital Secundário A' })
    await expect(hospitalRow).toBeVisible({ timeout: 10_000 })

    // Open the offboarding wizard and attempt immediately — the door has no
    // pre-check, it refuses on attempt (actions.ts `end_org_affiliation` ->
    // HC0R6), and the refusal is what names the blocker.
    await page.getByRole('button', { name: 'Desligar da organização' }).click()
    const wizard = page.getByRole('dialog', { name: new RegExp(`Desligar ${fullName} de`) })
    await expect(wizard).toBeVisible({ timeout: 5_000 })
    await wizard.getByRole('button', { name: 'Desligar da organização' }).click()

    const refusal = wizard.getByRole('alert')
    await expect(refusal).toBeVisible({ timeout: 10_000 })
    await expect(refusal).toContainText(
      'Não é possível desligar da organização: a pessoa ainda possui vínculos ativos.',
    )
    // At least one blocker line rendered — this person's only tie is the hospital
    // affiliation just added, so the refusal must name something.
    await expect(refusal.locator('li')).not.toHaveCount(0)

    // Close without forcing anything (the wizard offers no "remove blockers from
    // here" control by design — the guidance links point at the page's own
    // cards). Fix the blocker the same way an admin would: end the hospital
    // affiliation via the affiliations panel.
    await wizard.getByRole('button', { name: 'Cancelar' }).click()
    await expect(wizard).not.toBeVisible({ timeout: 5_000 })

    await hospitalRow.getByRole('button', { name: /^Encerrar vínculo com/i }).click()
    const endConfirm = page.getByRole('alertdialog', { name: /Encerrar o vínculo de/ })
    await expect(endConfirm).toBeVisible({ timeout: 5_000 })
    await endConfirm.getByRole('button', { name: /^Encerrar vínculo$/i }).click()
    await expect(endConfirm).not.toBeVisible({ timeout: 10_000 })

    // Retry — now blocker-free, so the wizard advances straight to the offer.
    await page.getByRole('button', { name: 'Desligar da organização' }).click()
    const wizard2 = page.getByRole('dialog', { name: new RegExp(`Desligar ${fullName} de`) })
    await expect(wizard2).toBeVisible({ timeout: 5_000 })
    await wizard2.getByRole('button', { name: 'Desligar da organização' }).click()

    const resolved = page.getByRole('dialog', { name: 'Desligamento registrado' })
    await expect(resolved).toBeVisible({ timeout: 10_000 })
    const deactivateBtn = resolved.getByRole('button', { name: /^desativar conta$/i })
    await expect(deactivateBtn, 'the empty-footprint offer must appear').toBeVisible({
      timeout: 5_000,
    })

    // ACCEPT arm.
    await deactivateBtn.click()
    const done = page.getByRole('dialog', { name: 'Conta desativada' })
    await expect(done).toBeVisible({ timeout: 10_000 })
    await done.getByRole('button', { name: /^concluir$/i }).click()
    await expect(done).not.toBeVisible({ timeout: 5_000 })

    // Value, not a toast: the DB actually flipped.
    const rows = await svcSelect<{ is_active: boolean }>(
      request,
      'profiles',
      `id=eq.${userId}&select=is_active`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].is_active, 'accept arm must deactivate the account').toBe(false)

    const orgAff = await svcSelect<{ ended_on: string | null }>(
      request,
      'organization_affiliations',
      `principal_id=eq.${userId}&select=ended_on`,
    )
    expect(orgAff).toHaveLength(1)
    expect(orgAff[0].ended_on, 'the org affiliation itself must be ended').not.toBeNull()
  })
})

test.describe('AFF4-OFFBOARD: no blockers -> DECLINE arm keeps the account active; the org-directory parity gate (listOrgUsers only)', () => {
  test('offboarding a blocker-free person: decline the deactivation offer, then the org directory drops them by default, the CPF search still finds them, and "incluir desligados" restores them', async ({
    page,
    request,
  }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    const token = uniqueToken()
    const fullName = `AFF4 Offboard Clean ${token}`
    const email = `aff4.offboard.clean.${token}@test.local`
    const cpf = uniqueCpf()

    // Register directly with this CPF so it can be re-searched later (the CPF
    // never travels via the wizard's own registration path a second time — it is
    // typed once here and again in the parity check below).
    await page.goto('/o/rede-a/manage/usuarios/novo')
    await page.getByRole('textbox', { name: 'CPF' }).fill(cpf)
    await page.getByRole('button', { name: /buscar pessoa/i }).click()
    await expect(page.getByLabel('Nome completo')).toBeVisible({ timeout: 10_000 })
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
    await continueButton.click()
    await continueButton.click()
    await page.getByRole('button', { name: /registrar pessoa/i }).click()
    await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/i, { timeout: 15_000 })
    const userId = page.url().match(/\/usuarios\/([0-9a-f-]{36})$/i)?.[1] ?? ''
    expect(userId).toBeTruthy()

    // Offboard: zero hospital affiliations, zero memberships -> no refusal at
    // all, straight to the offer.
    await page.getByRole('button', { name: 'Desligar da organização' }).click()
    const wizard = page.getByRole('dialog', { name: new RegExp(`Desligar ${fullName} de`) })
    await expect(wizard).toBeVisible({ timeout: 5_000 })
    await wizard.getByRole('button', { name: 'Desligar da organização' }).click()

    const resolved = page.getByRole('dialog', { name: 'Desligamento registrado' })
    await expect(resolved).toBeVisible({ timeout: 10_000 })
    const keepActiveBtn = resolved.getByRole('button', { name: /^manter conta ativa$/i })
    await expect(keepActiveBtn, 'the empty-footprint offer must appear here too').toBeVisible({
      timeout: 5_000,
    })

    // DECLINE arm.
    await keepActiveBtn.click()
    await expect(resolved).not.toBeVisible({ timeout: 5_000 })

    // Value: the org affiliation ended, but the account itself was NEVER touched.
    const profileRows = await svcSelect<{ is_active: boolean }>(
      request,
      'profiles',
      `id=eq.${userId}&select=is_active`,
    )
    expect(profileRows).toHaveLength(1)
    expect(profileRows[0].is_active, 'decline arm must never deactivate the account').toBe(true)
    const orgAff = await svcSelect<{ ended_on: string | null }>(
      request,
      'organization_affiliations',
      `principal_id=eq.${userId}&select=ended_on`,
    )
    expect(orgAff).toHaveLength(1)
    expect(orgAff[0].ended_on, 'the org-end itself must still have landed').not.toBeNull()

    // --- The parity gate (T2's core obligation) ---

    // 1) The org directory DROPS the person by default (no ?includeEnded=).
    await page.goto(`/o/rede-a/manage/usuarios?search=${encodeURIComponent(email)}`)
    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible({ timeout: 10_000 })
    await expect(
      page.locator('li').filter({ hasText: fullName }),
      'the default (active-only) org directory must not list an org-offboarded person',
    ).toHaveCount(0)

    // 2) The add-a-person CPF search (`lookupOrgPeople`, the single explicit
    // widener) still finds them — D5's one-step rehire depends on this.
    await page.goto('/o/rede-a/manage/usuarios/novo')
    await page.getByRole('textbox', { name: 'CPF' }).fill(cpf)
    await page.getByRole('button', { name: /buscar pessoa/i }).click()
    // NOT outcome A (not-found) — the fresh-person create form must not appear.
    await expect(page.getByLabel('Nome completo')).not.toBeVisible({ timeout: 10_000 })
    // Found: the outcome screen renders more than one heading naming this person
    // (a summary heading plus the "já está cadastrado" sentence) — `.first()`
    // sidesteps the strict-mode ambiguity; either one alone is proof of a find.
    await expect(
      page.getByRole('heading', { name: new RegExp(fullName) }).first(),
      'lookupOrgPeople must still surface an org-offboarded person by CPF (D5 rehire)',
    ).toBeVisible({ timeout: 10_000 })

    // 3) The "Incluir desligados" toggle (org-directory-only) restores them, with
    // the "Encerrado" org-affiliation chip — driven via the real control, not the
    // URL, so the SWITCH itself is under test too.
    await page.goto(`/o/rede-a/manage/usuarios?search=${encodeURIComponent(email)}`)
    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible({ timeout: 10_000 })
    const toggle = page.getByRole('switch', { name: 'Incluir desligados' })
    await expect(toggle).toBeVisible({ timeout: 10_000 })
    await expect(toggle).not.toBeChecked()
    await toggle.click()
    await page.waitForURL(/includeEnded=1/, { timeout: 10_000 })
    const restoredRow = page.locator('li').filter({ hasText: fullName })
    await expect(restoredRow).toBeVisible({ timeout: 10_000 })
    await expect(restoredRow.getByText('Encerrado', { exact: true })).toBeVisible()
  })
})

test.describe('AFF4-OFFBOARD: keyboard-only pass over the whole wizard', () => {
  test('org_admin opens, confirms, and finishes the offboarding wizard using only the keyboard', async ({
    page,
    request,
  }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    const token = uniqueToken()
    const fullName = `AFF4 Offboard Keyboard ${token}`
    const email = `aff4.offboard.keyboard.${token}@test.local`
    const userId = await registerBareOrgPerson(page, fullName, email)
    expect(userId).toBeTruthy()

    const trigger = page.getByRole('button', { name: 'Desligar da organização' })
    await expect(async () => {
      await trigger.focus()
      await expect(trigger).toBeFocused({ timeout: 1_000 })
    }).toPass({ timeout: 10_000 })
    await page.keyboard.press('Enter')

    const wizard = page.getByRole('dialog', { name: new RegExp(`Desligar ${fullName} de`) })
    await expect(wizard).toBeVisible({ timeout: 5_000 })

    // Bounded search for the confirm button, the same resilient pattern
    // `pickDateKeyboard` uses — never a hardcoded tab count.
    const confirmBtn = wizard.getByRole('button', { name: 'Desligar da organização' })
    let reached = false
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      if (await confirmBtn.evaluate((el) => el === document.activeElement).catch(() => false)) {
        reached = true
        break
      }
    }
    expect(reached, 'keyboard must be able to reach the confirm button').toBe(true)
    await page.keyboard.press('Enter')

    const resolved = page.getByRole('dialog', { name: 'Desligamento registrado' })
    await expect(resolved).toBeVisible({ timeout: 10_000 })

    const keepActiveBtn = resolved.getByRole('button', { name: /^manter conta ativa$/i })
    let reachedKeep = false
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      if (await keepActiveBtn.evaluate((el) => el === document.activeElement).catch(() => false)) {
        reachedKeep = true
        break
      }
    }
    expect(reachedKeep, 'keyboard must be able to reach "Manter conta ativa"').toBe(true)
    await page.keyboard.press('Enter')
    await expect(resolved).not.toBeVisible({ timeout: 5_000 })

    const profileRows = await svcSelect<{ is_active: boolean }>(
      request,
      'profiles',
      `id=eq.${userId}&select=is_active`,
    )
    expect(profileRows).toHaveLength(1)
    expect(profileRows[0].is_active, 'the keyboard-only decline must not deactivate').toBe(true)
  })
})
