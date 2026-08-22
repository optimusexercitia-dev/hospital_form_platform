import { test, expect, type Page } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'

/**
 * `/manage/cases/[caseId]` entry gate — ADR 0134 D3 (case-surface-split
 * Increment 1, `01b41c87`). The predicate is `staff_admin ∨ isAdministrativo ∨
 * per-case canWriteContent` ({@link canOpenCaseManagement},
 * `src/lib/queries/cases.ts`), enforced by `(detail)/layout.tsx` ABOVE any
 * content is fetched — a fail-closed helper that returns `false` on every
 * non-answer (RPC error, unknown case, thrown client).
 *
 * Six classes attempt direct navigation; all six must 404 with no data
 * leakage. They do NOT all fail for the SAME reason, and that distinction is
 * the point of this file: `getCaseDetail` (the ordinary can-read-this-case
 * check, RLS-backed) runs FIRST and independently 404s anyone who cannot read
 * the case at all — only a caller who clears THAT gate ever reaches D3. So a
 * caller who was already unable to read the case proves nothing about D3
 * specifically: removing D3 would not change their outcome. Only a caller who
 * CAN read the case but lacks all three D3 arms is genuine evidence the
 * predicate itself is doing work.
 *
 *   PROVES D3 (can read the case; D3's arms are what stop them):
 *     - read-grantee (multi@test.local — a seeded READ-only case_access grant
 *       on CASE_ID; passes RLS, fails all three D3 arms)
 *     - quality.a@test.local (the S7 oversight-reviewer read arm; passes RLS,
 *       fails all three D3 arms — she is not `staff_admin`, not an
 *       administrativo of CCIH, and holds no per-case write grant)
 *
 *   Does NOT prove D3 (never reaches it — blocked earlier, same outcome with
 *   or without D3):
 *     - staff4.ccih@test.local (no attribution, no grant — fails the ordinary
 *       read check on this case)
 *     - orgadmin.a@test.local / hospitaladmin.a1@test.local (tenancy admins —
 *       `access.role` is membership-only since BUG-QOB-003/ADR 0100 D12, so
 *       neither is `staff_admin`, and their `_case_caps` arm carries no
 *       ordinary case-content read — QO·B's content wall)
 *     - chefe.farm@test.local against a CCIH case (real `staff_admin`, wrong
 *       commission — the layout's own `detail.case.commissionId !==
 *       access.commission.id` check 404s before D3 is reached)
 *
 * The CONTROL proving this split (run manually against the local stack, NOT
 * shipped as an executable step — there is no in-repo mechanism to mutate
 * Next.js source mid-suite the way the pgTAP neutralization harness mutates
 * SQL): temporarily short-circuit `canOpenCaseManagement` to always return
 * `true` in `src/lib/queries/cases.ts`, re-run this file. Measured 2026-08-21:
 * exactly the two PROVES-D3 tests flip RED (the page loads instead of 404),
 * the four DOES-NOT-PROVE tests stay GREEN (still 404, for their own
 * independent reason). Reverted immediately after measuring; `git diff` was
 * empty before continuing. See the tester's report for the exact commands.
 */

const ORG = 'rede-a'
const CCIH = `/o/${ORG}/c/ccih`
const FARMACIA = `/o/${ORG}/c/farmacia`
const CASE_ID = 'd0000000-0000-0000-0000-0000000000c1' // "Óbito UTI leito 7" — multi's seeded read grant lives here too (case-access.spec.ts AC-3a)
const CASE_LABEL = 'Óbito UTI leito 7'

async function signIn(page: Page, email: string) {
  await cachedSignIn(page, email, 'Test1234!')
}

/** 404 + no leaked case content, either as visible text or in the raw HTML
 * (a leaked label rendered `display:none` would pass a `toBeVisible` check
 * but still be a disclosure). */
async function assertManageDenied(page: Page, url: string) {
  await page.goto(url)
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toHaveCount(0)
  const html = await page.content()
  expect(html).not.toContain(CASE_LABEL)
}

test.describe('Manage-cases entry gate (ADR 0134 D3) — fail-closed set', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  test('PROVES D3 — read-grantee (multi): can read the case, still 404s the manage host', async ({
    page,
  }) => {
    await signIn(page, 'multi@test.local')
    // Positive control first — the SAME user, SAME case, proven readable on the
    // reading surface, so the manage-host denial below cannot be a broken
    // fixture or a blanket "multi can't reach CCIH at all" failure.
    await page.goto(`${CCIH}/casos/${CASE_ID}`)
    await expect(page.getByText(CASE_LABEL)).toBeVisible({ timeout: 10_000 })

    await assertManageDenied(page, `${CCIH}/manage/cases/${CASE_ID}`)
  })

  test('PROVES D3 — quality.a: can read the case (S7 oversight arm), still 404s the manage host', async ({
    page,
  }) => {
    await signIn(page, 'quality.a@test.local')
    await page.goto(`${CCIH}/casos/${CASE_ID}`)
    await expect(page.getByText(CASE_LABEL)).toBeVisible({ timeout: 10_000 })

    await assertManageDenied(page, `${CCIH}/manage/cases/${CASE_ID}`)
  })

  test('does not prove D3 — plain member (staff4, no attribution/grant): denied at the ordinary read check, before D3', async ({
    page,
  }) => {
    await signIn(page, 'staff4.ccih@test.local')
    // Positive control: staff4's own session works fine on a surface she IS
    // entitled to — the manage-host denial below is not a broken login/fixture.
    await page.goto(`${CCIH}/meus-casos`)
    await expect(page.getByRole('heading', { name: /meus casos/i })).toBeVisible({ timeout: 10_000 })

    await assertManageDenied(page, `${CCIH}/manage/cases/${CASE_ID}`)
  })

  test('does not prove D3 — org_admin: no membership role, no ordinary case-content read (QO·B content wall)', async ({
    page,
  }) => {
    await signIn(page, 'orgadmin.a@test.local')
    // Positive control: org_admin's own tenancy surface works fine — the
    // manage-host denial below is not a blanket "orgadmin.a is broken" failure.
    await page.goto(`/o/${ORG}/manage/comissoes`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })

    await assertManageDenied(page, `${CCIH}/manage/cases/${CASE_ID}`)
  })

  test('does not prove D3 — hospital_admin: same tenancy-admin boundary as org_admin', async ({
    page,
  }) => {
    await signIn(page, 'hospitaladmin.a1@test.local')
    // Positive control: hospitaladmin.a1's own tenancy surface works fine.
    await page.goto(`/o/${ORG}/manage/comissoes`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })

    await assertManageDenied(page, `${CCIH}/manage/cases/${CASE_ID}`)
  })

  test('does not prove D3 — cross-commission (chefe.farm, a REAL staff_admin of the WRONG commission): denied by the commission-mismatch check, before D3', async ({
    page,
  }) => {
    await signIn(page, 'chefe.farm@test.local')
    // Positive control: chefe.farm's own commission's manage host works fine —
    // this is not a blanket "chefe.farm can't reach any manage host" failure.
    await page.goto(`${FARMACIA}/manage/cases`)
    await expect(page.getByRole('heading', { name: /^Casos$/i })).toBeVisible({ timeout: 10_000 })

    await assertManageDenied(page, `${CCIH}/manage/cases/${CASE_ID}`)
  })
})
