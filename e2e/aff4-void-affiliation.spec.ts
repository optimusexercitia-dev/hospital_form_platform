import { test, expect } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import { uniqueCpf } from './helpers/cpf'
import { pickDate } from './helpers/date-pickers'
import { svcSelect } from './helpers/service-role'

/**
 * AFF4 T3 — void E2E (ADR 0151 D7/D8, `voidAffiliation`,
 * `src/components/users/affiliations-panel.tsx`): create a mis-entry hospital
 * affiliation, void it with a reason, and confirm the UI reflects it — the badge,
 * the reason text, persistence across reload, and the hospital-scoped roster.
 *
 * ⛔ THE READ-REVOCATION DIFFERENTIAL IS PGTAP's JOB (suite `374`) — this file
 * never re-derives it. That differential is specifically: can a DIFFERENT
 * hospital admin still read this person's PHI/credentials before vs. after void
 * (an RLS/authorization question, answered with contrasting actors at the SQL
 * layer). What THIS file asserts under "roster reflects it" is a different,
 * UI-level claim: does the SAME admin's own filtered directory view stop
 * counting a voided affiliation as a live tie (a query-filter/UX correctness
 * question, not a security boundary) — checked with one actor, before vs. after,
 * never a second admin.
 *
 * Fixture: a freshly registered person + a freshly added hospital affiliation
 * (the "mis-entry"). Additive only — no seeded persona is ever mutated.
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

test.describe('AFF4-VOID: a mis-entered hospital affiliation, voided with a reason', () => {
  test('the row shows Anulado + the reason immediately and after reload; the hospital roster drops the person', async ({
    page,
    request,
  }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    const token = uniqueToken()
    const fullName = `AFF4 Void Misentry ${token}`
    const email = `aff4.void.misentry.${token}@test.local`

    // Register bare (no hospital, no committee), then add the "mis-entry"
    // hospital affiliation explicitly via the affiliations panel — this test
    // owns exactly what gets voided.
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
    const continueButton = page.getByRole('button', { name: 'Continuar' })
    await continueButton.click()
    await continueButton.click()
    await page.getByRole('button', { name: /registrar pessoa/i }).click()
    await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/i, { timeout: 15_000 })
    const userId = page.url().match(/\/usuarios\/([0-9a-f-]{36})$/i)?.[1] ?? ''
    expect(userId).toBeTruthy()

    const vinculos = page.getByRole('region', { name: 'Vínculos hospitalares' })
    await page.getByRole('button', { name: /adicionar vínculo/i }).click()
    const addDialog = page.getByRole('dialog', { name: /adicionar vínculo hospitalar/i })
    await expect(addDialog).toBeVisible({ timeout: 5_000 })
    await addDialog.getByLabel(/^hospital$/i).selectOption({ label: 'Hospital Secundário A' })

    // "Data de início" — one of the five date fields the plan names as having
    // ZERO E2E coverage (`aff-hospital-affiliation.spec.ts`'s own
    // `openAffiliationDialog()` opens this same dialog repeatedly but only ever
    // touches "Matrícula"). Set it explicitly here rather than accepting the
    // `todayIso()` default, so this test also closes that gap.
    const startField = addDialog
      .locator('label')
      .filter({ hasText: 'Data de início' })
      .first()
      .locator('xpath=..')
    const startTrigger = startField.locator('button[aria-haspopup="dialog"]').first()
    const now = new Date()
    const expectedStartedOn = (() => {
      const d = new Date(now.getFullYear(), now.getMonth() - 2, 15)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${dd}`
    })()
    await pickDate(startField, page, { trigger: startTrigger, monthsBack: 2, day: '15' })

    await addDialog.getByRole('button', { name: /^adicionar vínculo$/i }).click()
    await expect(addDialog).not.toBeVisible({ timeout: 10_000 })

    const row = vinculos.locator('li').filter({ hasText: 'Hospital Secundário A' })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row.getByText('Ativo', { exact: true })).toBeVisible()

    const createdRows = await svcSelect<{ started_on: string }>(
      request,
      'hospital_affiliations',
      `principal_id=eq.${userId}&hospital_id=eq.05000000-0000-0000-0000-0000000000a2&select=started_on`,
    )
    expect(createdRows).toHaveLength(1)
    expect(createdRows[0].started_on).toBe(expectedStartedOn)

    // Open "Anular". The submit stays disabled until a reason is typed —
    // confirmed here as a cheap bonus a11y/UX check.
    await row.getByRole('button', { name: /^Anular vínculo com/i }).click()
    const voidDialog = page.getByRole('alertdialog', { name: /Anular o vínculo de/ })
    await expect(voidDialog).toBeVisible({ timeout: 5_000 })
    const submitBtn = voidDialog.getByRole('button', { name: /^Anular vínculo$/i })
    await expect(submitBtn).toBeDisabled()

    const reason = `Vínculo cadastrado por engano — teste automatizado ${token}.`
    await voidDialog.getByLabel('Motivo da anulação').fill(reason)
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()
    await expect(voidDialog).not.toBeVisible({ timeout: 10_000 })

    // Live re-render (no reload yet): the badge flips and the reason renders.
    await expect(row.getByText('Anulado', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(row.getByText('Ativo', { exact: true })).toHaveCount(0)
    await expect(row).toContainText(`Motivo da anulação: ${reason}`)

    // Persistence: a fresh navigation must show the SAME state, not merely
    // optimistic client state that a reload would reveal was never written.
    await page.goto(page.url())
    const rowAfterReload = page
      .getByRole('region', { name: 'Vínculos hospitalares' })
      .locator('li')
      .filter({ hasText: 'Hospital Secundário A' })
    await expect(rowAfterReload).toBeVisible({ timeout: 10_000 })
    await expect(rowAfterReload.getByText('Anulado', { exact: true })).toBeVisible()
    await expect(rowAfterReload).toContainText(`Motivo da anulação: ${reason}`)

    // DB value, not just the screen.
    const dbRows = await svcSelect<{ voided_at: string | null; void_reason: string | null }>(
      request,
      'hospital_affiliations',
      `principal_id=eq.${userId}&select=voided_at,void_reason`,
    )
    expect(dbRows).toHaveLength(1)
    expect(dbRows[0].voided_at).not.toBeNull()
    expect(dbRows[0].void_reason).toBe(reason)

    // "Roster reflects it" — the QUERY FILTER's own UI-visible effect, same
    // admin, before vs. after (see the file header for why this is NOT the
    // pgTAP 374 differential). The person's only tie to Secundário A is now
    // voided, so the org_admin's hospital-filtered directory must drop them.
    await page.goto(
      `/o/rede-a/manage/usuarios?hospital=05000000-0000-0000-0000-0000000000a2` +
        `&search=${encodeURIComponent(email)}`,
    )
    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible({ timeout: 10_000 })
    await expect(
      page.locator('li').filter({ hasText: fullName }),
      'a voided-only hospital tie must not keep the person on that hospital\'s roster',
    ).toHaveCount(0)
  })
})
