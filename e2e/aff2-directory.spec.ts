import { test, expect } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'

/**
 * AFF2 T1 — the user directory's status pills, hospital filter (B8), and the
 * "Sem comissão" / "Sem vínculo hospitalar" render states.
 *
 * ⚠ NO HARDCODED COUNTS. The workstream's own record pins "30 / 27 / 2 / 1" and
 * "30 → 15 at Hospital Central A" as the numbers measured AT ONE POINT DURING THE
 * BUILD — this suite's own earlier runs (T0's fix loop, T2, T3) have since added
 * dozens of `aff.*`/`aff2.*`/`e2e.*` people to this same shared local DB, and
 * `e2e:prod` does not reset it. A hardcoded count here would be wrong the moment
 * after it was measured and increasingly wrong on every later run — the general
 * "counts drift" lesson this codebase is built around. Every count assertion below
 * is therefore either a PARTITION property (the three buckets sum to the total,
 * whatever the total currently is) or a computed BEFORE/AFTER comparison read from
 * the page itself, never a number typed into this file.
 */

const CENTRAL_A_ID = '05000000-0000-0000-0000-00000000000a'

async function signInAs(page: import('@playwright/test').Page, email: string) {
  await cachedSignIn(page, email, 'Test1234!')
}

/** Extracts the leading digit run from a pill's rendered text ("Ativos·27 pessoas" →
 * 27). The pill renders its label alone (no "· 0") whenever `counts` is absent, which
 * would make this throw — a deliberate signal that the caller navigated to a state
 * where the count truly is not being measured, never a fabricated zero. */
async function pillCount(
  page: import('@playwright/test').Page,
  linkName: RegExp,
): Promise<number> {
  const text = await page.getByRole('link', { name: linkName }).textContent()
  const match = text?.match(/(\d+)/)
  if (!match) {
    throw new Error(`pill "${linkName}" rendered no count: "${text}"`)
  }
  return Number(match[1])
}

test.describe('AFF2-DIRECTORY: status pills partition the roster and each one actually filters', () => {
  test('orgadmin.a: Ativos + Atenção + Desativados sum to Todos, and each pill narrows to only its own statuses', async ({
    page,
  }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios')
    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible({
      timeout: 10_000,
    })

    const [all, active, attention, deactivated] = await Promise.all([
      pillCount(page, /^Todos\b/),
      pillCount(page, /^Ativos\b/),
      pillCount(page, /^Atenção\b/),
      pillCount(page, /^Desativados\b/),
    ])
    // The partition property — computed against WHATEVER the live total is, never a
    // fixed number.
    expect(active + attention + deactivated, 'the three buckets must partition Todos').toBe(all)
    expect(all).toBeGreaterThan(0)

    // Each pill genuinely filters — not merely `aria-current` cosmetics. Checked on
    // page 1 only (pagination correctness is a different clause); a wrong status
    // leaking onto page 1 is exactly what this catches.
    await page.getByRole('link', { name: /^Ativos\b/ }).click()
    await page.waitForURL(/status=active/, { timeout: 10_000 })
    await expect(page.getByText('Ativo', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('Desativado', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Suspenso', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Pendente', { exact: true })).toHaveCount(0)

    await page.getByRole('link', { name: /^Desativados\b/ }).click()
    await page.waitForURL(/status=deactivated/, { timeout: 10_000 })
    if (deactivated > 0) {
      await expect(page.getByText('Desativado', { exact: true }).first()).toBeVisible({
        timeout: 10_000,
      })
    }
    await expect(page.getByText('Ativo', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Suspenso', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Pendente', { exact: true })).toHaveCount(0)

    await page.getByRole('link', { name: /^Atenção\b/ }).click()
    await page.waitForURL(/status=attention/, { timeout: 10_000 })
    await expect(page.getByText('Ativo', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Desativado', { exact: true })).toHaveCount(0)

    // "Todos" clears the filter and keeps the count identical to the FIRST measurement
    // — filtering and clearing must be a round trip, not a one-way narrowing.
    await page.getByRole('link', { name: /^Todos\b/ }).click()
    await page.waitForURL((url) => !url.search.includes('status='), { timeout: 10_000 })
    expect(await pillCount(page, /^Todos\b/)).toBe(all)
  })

  test('a deactivated row navigates to its profile, badged Desativado there too', async ({
    page,
  }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios?status=deactivated')
    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible({
      timeout: 10_000,
    })
    // `desativado.conta@test.local` is a permanent seed fixture — always deactivated,
    // never mutated by any spec (aff-hospital-affiliation.spec.ts's own AFF-4 only
    // ever touches its `cpf`, restored in `afterAll`) — so this bucket is never empty.
    const row = page.locator('li').filter({ hasText: 'Desativado' }).first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    // The name cell is `<span class="block truncate text-sm font-semibold">` — the
    // full class combination, since `PersonAvatar`'s initials ALSO carry a bare
    // `font-semibold` and a loose selector grabs those two letters instead ("DC" for
    // "Desativado Conta", measured). Read before navigating so the profile page's H1
    // can be checked against the SAME row, not merely "a row went somewhere".
    const rowName = await row.locator('span.truncate.text-sm.font-semibold').first().textContent()
    expect(rowName).toBeTruthy()
    await row.click()
    await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/i, { timeout: 10_000 })
    await expect(page.getByText('Desativado', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('heading', { level: 1 })).toContainText(rowName!.trim())
  })
})

test.describe('AFF2-DIRECTORY: empty-state cells never render blank', () => {
  test('"Sem comissão" and "Sem vínculo hospitalar" both render for at least one row', async ({
    page,
  }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios')
    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible({
      timeout: 10_000,
    })
    // Not an empty cell, and not "0" either — the dashed placeholder string, present
    // at least once on an unfiltered page-1 view (dt.a and every fresh AFF2 fixture
    // this file's own sibling specs created are committee-less).
    await expect(page.getByText('Sem comissão', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(
      page.getByText('Sem vínculo hospitalar', { exact: true }).first(),
    ).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('AFF2-DIRECTORY: the org_admin hospital filter (B8) narrows the roster', () => {
  test('?hospital= strictly narrows Todos and composes with ?search=', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios')
    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible({
      timeout: 10_000,
    })
    const orgWide = await pillCount(page, /^Todos\b/)

    await page.goto(`/o/rede-a/manage/usuarios?hospital=${encodeURIComponent(CENTRAL_A_ID)}`)
    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible({
      timeout: 10_000,
    })
    const centralA = await pillCount(page, /^Todos\b/)
    // Strict narrowing: Secundário A has its own people (the AFF-2/AFF-K fixtures and
    // seed's own roster), so filtering to Central A alone must exclude at least one.
    expect(centralA).toBeLessThan(orgWide)
    expect(centralA).toBeGreaterThan(0)

    // Composes with search: a known Central-A person is findable under the filter.
    await page.goto(
      `/o/rede-a/manage/usuarios?hospital=${encodeURIComponent(CENTRAL_A_ID)}&search=chefe.ccih`,
    )
    await expect(page.getByText(/Chefe CCIH/i).first()).toBeVisible({ timeout: 10_000 })
  })
})
