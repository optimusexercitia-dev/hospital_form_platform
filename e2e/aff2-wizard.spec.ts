import { test, expect } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import { uniqueCpf } from './helpers/cpf'

/**
 * AFF2 T3 — the register wizard's two acceptance clauses NOT already exercised by the
 * (repaired) pre-existing suite:
 *
 *   1. ADR 0133 D8, the invariant the ADR cares most about: a hospital_admin's
 *      registration ALWAYS creates the affiliation, even when step 2 ("Vínculo
 *      hospitalar") is skipped via "Pular etapa" — only the matrícula is skipped.
 *      `frontend` verified this manually at build time; this is its first PERSISTED
 *      Playwright coverage.
 *   2. A foreign-org CPF collision hits the SAME block copy as an in-org one
 *      (`register-person-flow.tsx`'s own doc comment: "D has no branch of its own on
 *      purpose... a CPF held in another organization looks exactly like 'not found'
 *      here [at the lookup] ... registerUser refuses at submit, unchanged, as the
 *      backstop"). Not covered anywhere else in e2e/ — grepped for "foreign-org"/
 *      "cross-org" registration coverage first; every hit belongs to a different
 *      domain (cases, NSP, indicators, documents, referrals).
 *
 * The remaining T3 clauses are already covered, verified passing, elsewhere:
 *   - Full 3-step walk → Ativo profile: user-registration.spec.ts AC1/AC2 (T0-repaired).
 *   - Full 3-step walk → Pendente profile: the SAME file's invite-mode variant is
 *     `test.skip`'d — server-env-gated (AUTH_EMAIL_VERIFICATION), not per-test
 *     toggleable; kept recoverable rather than duplicated here.
 *   - CPF required, cannot proceed without one: form-name-attribute-invariant.spec.ts's
 *     "the CPF lookup never puts a national identity number in the URL" test already
 *     asserts the client validation message for an incomplete CPF.
 *   - In-org duplicate CPF → affiliate offer: aff-hospital-affiliation.spec.ts AFF-1
 *     (outcome B).
 *   - Invite email lands (Mailpit): the same env-gated skip as above.
 *
 * Fixture for the foreign-org case: `solo.c@test.local`, home_organization_id
 * `0c000000-0000-0000-0000-00000000000c` — a THIRD, unrelated org, CPF `52998224725`
 * (seed.sql). Chosen by querying the live catalog for a seeded CPF whose owner's
 * `home_organization_id` is NOT Rede A, rather than assuming a name.
 */

const FOREIGN_ORG_CPF = '52998224725'
const CENTRAL_A_ID = '05000000-0000-0000-0000-00000000000a'
const CENTRAL_A_NAME = 'Hospital Central A'

async function signInAs(page: import('@playwright/test').Page, email: string) {
  await cachedSignIn(page, email, 'Test1234!')
}

test.describe('AFF2-WIZARD: D8 — a hospital_admin\'s registration always yields the affiliation, even skipping step 2', () => {
  test('hospitaladmin.a1 skips "Vínculo hospitalar" entirely; the person still lands on Hospital Central A', async ({
    page,
    playwright,
  }) => {
    const ts = Date.now()
    const fullName = `AFF2 Wizard D8 ${ts}`
    const email = `aff2.wizard.d8.${ts}@test.local`

    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto('/o/rede-a/manage/usuarios/novo')
    await page.getByRole('textbox', { name: 'CPF' }).fill(uniqueCpf())
    await page.getByRole('button', { name: /buscar pessoa/i }).click()
    await expect(page.getByLabel('Nome completo')).toBeVisible({ timeout: 10_000 })

    await page.getByLabel('Nome completo').fill(fullName)
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('Senha inicial').fill('Test1234!')
    const categorySelect = page.getByLabel('Categoria profissional')
    const opts = await categorySelect.locator('option').all()
    const firstReal = await opts[1].getAttribute('value')
    if (firstReal) await categorySelect.selectOption(firstReal)
    await page.getByRole('button', { name: 'Continuar' }).click()

    // Step 2: the hospital is LOCKED (no chooser) — confirm the copy states the
    // invariant under test BEFORE skipping, so a future copy edit that silently
    // dropped the promise would also red this line.
    await expect(
      page.getByText(/o vínculo é criado de qualquer forma/i),
    ).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Pular etapa' }).click()

    // Step 3 — no committee.
    await page.getByRole('button', { name: /registrar pessoa/i }).click()
    await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/i, { timeout: 15_000 })
    const userId = page.url().match(/\/usuarios\/([0-9a-f-]{36})/i)?.[1] ?? ''
    expect(userId).toBeTruthy()

    // Assert the VALUE, not the copy's promise: the affiliation row really exists,
    // read via the service role (bypasses RLS entirely — the same "assert the value"
    // idiom aff-hospital-affiliation.spec.ts uses for memberships).
    const ctx = await playwright.request.newContext()
    try {
      const res = await ctx.get(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'}/rest/v1/hospital_affiliations` +
          `?principal_id=eq.${userId}&hospital_id=eq.${CENTRAL_A_ID}&ended_on=is.null&select=id,hospital_employee_id`,
        {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
          },
        },
      )
      expect(res.ok()).toBeTruthy()
      const rows = (await res.json()) as { id: string; hospital_employee_id: string | null }[]
      expect(rows.length, 'the affiliation must exist despite the step-2 skip').toBe(1)
      // The SKIP drops the matrícula, never the vínculo — that is the whole point of
      // D8's wording ("Pular esta etapa deixa a matrícula em branco").
      expect(rows[0].hospital_employee_id).toBeNull()
    } finally {
      await ctx.dispose()
    }

    // UI corroboration: the directory row names the hospital, and the profile page
    // shows it under "Vínculos hospitalares".
    await page.goto(`/o/rede-a/manage/usuarios?search=${encodeURIComponent(email)}`)
    const card = page.locator('li').filter({ hasText: fullName })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(card.getByText(CENTRAL_A_NAME)).toBeVisible()
  })
})

test.describe('AFF2-WIZARD: a foreign-org CPF collision hits the SAME block as an in-org one, with no tenant disclosure', () => {
  test('orgadmin.a: a CPF seeded in an unrelated organisation looks like "not found" at lookup, then blocks at submit with the generic collision copy', async ({
    page,
  }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios/novo')
    await page.getByRole('textbox', { name: 'CPF' }).fill(FOREIGN_ORG_CPF)
    await page.getByRole('button', { name: /buscar pessoa/i }).click()

    // D: no branch of its own. `list_org_people` never crosses the tenant anchor, so
    // this CPF — real, but registered in a DIFFERENT org — reads as outcome A
    // ("not found"), exactly like a genuinely fresh CPF. The disclosure this
    // assertion is FOR is the negative: no hint that the CPF belongs to someone,
    // anywhere.
    await expect(
      page.getByText(/nenhuma pessoa com este cpf/i),
    ).toBeVisible({ timeout: 10_000 })

    const ts = Date.now()
    await page.getByLabel('Nome completo').fill(`AFF2 Wizard Foreign ${ts}`)
    await page.getByLabel('E-mail').fill(`aff2.wizard.foreign.${ts}@test.local`)
    await page.getByLabel('Senha inicial').fill('Test1234!')
    const categorySelect = page.getByLabel('Categoria profissional')
    const opts = await categorySelect.locator('option').all()
    const firstReal = await opts[1].getAttribute('value')
    if (firstReal) await categorySelect.selectOption(firstReal)
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: /registrar pessoa/i }).click()

    // registerUser's OWN platform-wide uniqueness check is the backstop that fires at
    // submit — the block, not the lookup, is what actually stops this. No navigation,
    // no account created for a person who already exists somewhere the admin cannot
    // see.
    await expect(page).toHaveURL(/\/usuarios\/novo/)
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 })
    // The SAME copy as an in-org collision — never "já cadastrado em outra
    // organização" or any variant naming a tenant (D8's own enumeration-oracle
    // rationale).
    await expect(
      page.getByText('Este CPF já está cadastrado na plataforma.'),
    ).toBeVisible()
    await expect(page.getByText(/outra organização|outra organizacao/i)).toHaveCount(0)

    // Back on step 1, since the server-side field error belongs there — never left
    // stranded on step 3 where the fix is unreachable.
    await expect(
      page.getByRole('heading', { name: 'Dados pessoais', exact: true }),
    ).toBeVisible()
  })
})
