import { test, expect } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import { uniqueCpf } from './helpers/cpf'
import { svcSelect } from './helpers/service-role'

/**
 * AFF4 — AC3's missing witness (`docs/reviews/aff4-review.md` § AC3 / item R3).
 *
 * The plan's AC3, verbatim: "a rehire at a hospital of the same org is one action by
 * THAT HOSPITAL'S ADMIN." QA measured the MECHANISM correct — live in
 * `app.affiliate_person_impl`, one door call auto-ensures the org parent
 * (`organization_affiliations`) in the SAME transaction as the hospital affiliation,
 * `created_by = p_actor` — but every existing witness drives it with the WRONG actor:
 *
 *   - pgTAP `378` §1 (the real D5 test) pins the rehire with an `org_admin`.
 *   - pgTAP `302` §2.1 uses a `hospital_admin`, but on a person who is NOT
 *     org-offboarded, and asserts nothing about the org parent.
 *   - No `e2e/aff4-*.spec.ts` file signed in as a `hospital_admin` AT ALL.
 *
 * So the criterion's distinguishing clause — "by THAT HOSPITAL'S ADMIN" — had no
 * witness anywhere. An org_admin-pinned rehire is exactly what a reader mistakes for
 * coverage of a hospital_admin rehire (that is the point of this file existing). The
 * pgTAP-layer twin (adding a `hospital_admin` arm to `378` §1) is `backend`'s, not
 * this file's — this is the E2E witness, driven through the real UI.
 *
 * The assertion that actually distinguishes this from the mis-pinned coverage is
 * `organization_affiliations.created_by` on the row D5 auto-ensures: it must be the
 * HOSPITAL_ADMIN's id, never the org_admin's who performed the original offboarding.
 *
 * `hospitaladmin.a1@test.local` is deliberately the persona used: per `seed.sql`, it
 * administers Hospital Central A ONLY, and it never held any affiliation with this
 * test's fixture person before the rehire — so a pass here (once the bug below is
 * fixed) cannot be explained by "the same hospital_admin happened to already have a
 * relationship with this person."
 *
 * ⛔ THIS TEST IS `test.fail()`-PINNED — running it is exactly how AC3's missing
 * witness earns its keep. First run reproduced a NEW, 100%-deterministic (not flaky)
 * defect: `BUG-D5-REHIRE-HOSPADMIN-001`. See the comment at the `test.fail()` call
 * below for the full root-cause chain (confirmed against the live catalog, not
 * inferred). Summary: the click fails with "Não foi possível concluir. Tente
 * novamente." — `app.affiliate_person_impl` DOES correctly auto-ensure the org
 * parent (confirmed live: a superuser-level call inserts the new
 * `organization_affiliations` row, `created_by` = the hospital_admin, exactly as
 * D5 specifies), but the DEFERRED constraint trigger that then verifies D4
 * (`app.assert_hospital_affiliation_has_org`) is `SECURITY INVOKER`
 * (`pg_proc.prosecdef = false`, live-measured) — so its own existence check runs
 * under the CALLING SESSION's RLS. `organization_affiliations_select` has no
 * hospital_admin arm (by design, D1) — confirmed live via two REAL password-granted
 * JWTs hitting PostgREST directly: `hospitaladmin.a1` reads `[]` for the very row
 * `orgadmin.a` reads fine. So the trigger cannot see the row the SECURITY DEFINER
 * door just correctly wrote, raises a false-positive `23514`, and the WHOLE
 * transaction rolls back — for every hospital_admin, unconditionally. This is why
 * the org_admin-pinned pgTAP `378` §1 has always passed while the mechanism was
 * broken for the one actor AC3 is actually about.
 *
 * Fixtures are additive-only (a freshly registered person, never a seeded persona) —
 * `seed.sql` is a contract with ~900 tests and this file never mutates it.
 */

const ORG_A_ID = '0c000000-0000-0000-0000-00000000000a'
const CENTRAL_A_ID = '05000000-0000-0000-0000-00000000000a'
const CENTRAL_A_NAME = 'Hospital Central A'
const ORG_ADMIN_A_ID = '00000000-0000-0000-0000-0000000000b1' // orgadmin.a@test.local
const HOSPITAL_ADMIN_A1_ID = '00000000-0000-0000-0000-0000000000e1' // hospitaladmin.a1@test.local

let uniqueCounter = 0
function uniqueToken(): string {
  const worker = test.info().workerIndex
  uniqueCounter += 1
  return `${worker}-${Date.now()}-${uniqueCounter}`
}

async function signInAs(page: import('@playwright/test').Page, email: string) {
  await cachedSignIn(page, email, 'Test1234!')
}

/** Registers a brand-new person with no hospital and no committee, at a CALLER-SUPPLIED
 * CPF (so it can be re-searched later) — the D2/D12 "affiliated to the org only"
 * starting state the org-offboard needs. Same shape as
 * `aff4-org-offboarding.spec.ts`'s helper of the same name, parameterised on `cpf`
 * instead of minting its own, mirroring that file's OWN "clean path" test (which
 * inlines registration for exactly this reason). Duplicated rather than imported —
 * `e2e/**` files stay self-contained by this repo's established convention (see
 * `aff4-registration-dates.spec.ts`'s own local `signInAs`/`uniqueToken`). */
async function registerBareOrgPerson(
  page: import('@playwright/test').Page,
  fullName: string,
  email: string,
  cpf: string,
): Promise<string> {
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

  // Step 2 ("Vínculo hospitalar") and step 3 ("Comissões") both skippable —
  // deliberately: this person must start with ZERO hospital affiliations so the
  // org-offboard has no blockers, and so the later CPF search resolves outcome B
  // ("sem vínculo hospitalar ativo"), not outcome C.
  const continueButton = page.getByRole('button', { name: 'Continuar' })
  await continueButton.click()
  await continueButton.click()
  await page.getByRole('button', { name: /registrar pessoa/i }).click()

  await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/i, { timeout: 15_000 })
  return page.url().match(/\/usuarios\/([0-9a-f-]{36})$/i)?.[1] ?? ''
}

/** Ends the org affiliation via the wizard, DECLINING deactivation — the account must
 * stay active, or the later rehire hits `register-person-flow.tsx`'s "conta
 * desativada" outcome instead of outcome B and this test exercises the wrong branch
 * entirely. Same flow as `aff4-org-offboarding.spec.ts`'s "no blockers" test. */
async function offboardKeepingAccountActive(
  page: import('@playwright/test').Page,
  fullName: string,
) {
  await page.getByRole('button', { name: 'Desligar da organização' }).click()
  const wizard = page.getByRole('dialog', { name: new RegExp(`Desligar ${fullName} de`) })
  await expect(wizard).toBeVisible({ timeout: 5_000 })
  await wizard.getByRole('button', { name: 'Desligar da organização' }).click()

  const resolved = page.getByRole('dialog', { name: 'Desligamento registrado' })
  await expect(resolved).toBeVisible({ timeout: 10_000 })
  const keepActiveBtn = resolved.getByRole('button', { name: /^manter conta ativa$/i })
  await expect(keepActiveBtn, 'the empty-footprint offer must appear').toBeVisible({
    timeout: 5_000,
  })
  await keepActiveBtn.click()
  await expect(resolved).not.toBeVisible({ timeout: 5_000 })
}

test.describe('AC3: a hospital_admin rehires an org-offboarded person at a hospital of the same org, in one action', () => {
  test('hospitaladmin.a1 (administers Central A only) finds the org-offboarded person by CPF and completes the rehire with a single click, attributed to THEM', async ({
    page,
    request,
  }) => {
    // BUG-D5-REHIRE-HOSPADMIN-001 (filed by `tester`, AFF4 AC3 — report this to the
    // lead for the Bug Log; PROGRESS.md is out of `tester`'s scope in this task).
    // Root cause, live-catalog-confirmed (see the file header for the full chain):
    // the DEFERRED constraint trigger enforcing D4
    // (`app.assert_hospital_affiliation_has_org`) is SECURITY INVOKER, so it checks
    // `organization_affiliations` under the CALLING hospital_admin's own RLS —
    // which has no hospital-tier read arm on that table BY DESIGN (D1). The trigger
    // therefore cannot see the row `affiliate_person_impl` (SECURITY DEFINER) just
    // correctly auto-ensured, raises a false-positive `23514`, and the transaction
    // rolls back. 100% reproducible: identical failure via the real UI (this test)
    // AND via a raw `affiliate_person` RPC call with a real hospitaladmin.a1 JWT —
    // not a flake, not a fixture mistake.
    // ⛔ Pinned `test.fail()`, NOT weakened: every assertion below states what AC3
    // actually requires. Do not remove this annotation without re-verifying the fix
    // (that is `tester`'s call to make, once `backend` marks the door
    // SECURITY DEFINER — or applies whatever fix is ruled — and the rehire
    // succeeds end to end). Once fixed, this file IS AC3's E2E witness.
    test.fail(true, 'BUG-D5-REHIRE-HOSPADMIN-001 — see comment above and file header')

    // --- Setup: org_admin registers a bare-org person, then org-offboards them ---
    await signInAs(page, 'orgadmin.a@test.local')
    const token = uniqueToken()
    const fullName = `AFF4 Rehire HospAdmin ${token}`
    const email = `aff4.rehire.hospadmin.${token}@test.local`
    const cpf = uniqueCpf()
    const userId = await registerBareOrgPerson(page, fullName, email, cpf)
    expect(userId).toBeTruthy()

    await offboardKeepingAccountActive(page, fullName)

    // Pre-state, by value: account still active, exactly one ENDED org affiliation,
    // zero hospital affiliations (the D2/D5 starting shape this test needs).
    const profileBefore = await svcSelect<{ is_active: boolean }>(
      request,
      'profiles',
      `id=eq.${userId}&select=is_active`,
    )
    expect(profileBefore).toHaveLength(1)
    expect(profileBefore[0].is_active, 'the decline arm must keep the account active').toBe(
      true,
    )

    const orgAffBefore = await svcSelect<{ id: string; ended_on: string | null }>(
      request,
      'organization_affiliations',
      `principal_id=eq.${userId}&organization_id=eq.${ORG_A_ID}&select=id,ended_on`,
    )
    expect(orgAffBefore).toHaveLength(1)
    expect(
      orgAffBefore[0].ended_on,
      'the org-end must have landed before the rehire',
    ).not.toBeNull()

    const hospBefore = await svcSelect(
      request,
      'hospital_affiliations',
      `principal_id=eq.${userId}&select=id`,
    )
    expect(
      hospBefore,
      'this person must start with ZERO hospital affiliations',
    ).toHaveLength(0)

    // --- The rehire: hospitaladmin.a1, a hospital_admin of Central A ONLY, who has
    //     never administered this person before ---
    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto('/o/rede-a/manage/usuarios/novo')
    await page.getByRole('textbox', { name: 'CPF' }).fill(cpf)
    await page.getByRole('button', { name: /buscar pessoa/i }).click()

    await expect(
      page.getByRole('heading', { name: new RegExp(fullName) }).first(),
      'lookupOrgPeople must surface the org-offboarded person to a hospital_admin by CPF (D5 rehire dependency)',
    ).toBeVisible({ timeout: 10_000 })

    // The hospital is LOCKED for a hospital_admin — no chooser at all. This is part of
    // "one action": there is no second (hospital-picking) step hiding behind the click.
    await expect(page.getByRole('combobox', { name: /hospital/i })).toHaveCount(0)

    // THE one action. No matrícula, no start date — both optional, left untouched, so
    // this is exactly one click from "found" to "rehired".
    const vincularBtn = page.getByRole('button', { name: `Vincular ao ${CENTRAL_A_NAME}` })
    await expect(vincularBtn).toBeVisible({ timeout: 5_000 })
    await vincularBtn.click()
    await page.waitForURL(new RegExp(`/usuarios/${userId}$`), { timeout: 10_000 })

    // --- Value, not a toast ---

    // 1) The hospital-tier effect of the one click.
    const hospAfter = await svcSelect<{ ended_on: string | null; voided_at: string | null }>(
      request,
      'hospital_affiliations',
      `principal_id=eq.${userId}&hospital_id=eq.${CENTRAL_A_ID}&select=ended_on,voided_at`,
    )
    expect(hospAfter).toHaveLength(1)
    expect(hospAfter[0].ended_on).toBeNull()
    expect(hospAfter[0].voided_at).toBeNull()

    // 2) D5's org-parent auto-ensure: the ORIGINAL ended row must survive untouched,
    //    and a SECOND, active row must now exist.
    const orgAffAfter = await svcSelect<{
      id: string
      ended_on: string | null
      created_by: string | null
    }>(
      request,
      'organization_affiliations',
      `principal_id=eq.${userId}&organization_id=eq.${ORG_A_ID}&select=id,ended_on,created_by`,
    )
    expect(
      orgAffAfter,
      'the old ended row must survive AND a new active row must be auto-ensured',
    ).toHaveLength(2)
    const stillEnded = orgAffAfter.find((r) => r.id === orgAffBefore[0].id)
    expect(
      stillEnded?.ended_on,
      'the ORIGINAL org-offboard row must not be reopened by the rehire',
    ).not.toBeNull()
    const newActive = orgAffAfter.find((r) => r.id !== orgAffBefore[0].id)
    expect(newActive, 'a new organization_affiliations row must have been created').toBeTruthy()
    expect(newActive?.ended_on, 'the new row must be active (not ended)').toBeNull()

    // 3) THE assertion AC3 is actually about: the auto-ensured row is attributed to
    //    the HOSPITAL_ADMIN who clicked the button — never to the org_admin who
    //    performed the original offboarding. This is what a org_admin-pinned test
    //    (pgTAP `378` §1) cannot distinguish, and exactly why R3 flagged it.
    expect(
      newActive?.created_by,
      "AC3: the rehire must be attributed to THAT HOSPITAL'S ADMIN",
    ).toBe(HOSPITAL_ADMIN_A1_ID)
    expect(
      newActive?.created_by,
      'and specifically NOT to the org_admin who ran the original offboarding',
    ).not.toBe(ORG_ADMIN_A_ID)
  })
})
