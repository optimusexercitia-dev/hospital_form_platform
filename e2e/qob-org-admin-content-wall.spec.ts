import { test, expect } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'

/**
 * QO·B — the org_admin / hospital_admin CONTENT WALL, end to end.
 * ADR 0100 D12; PO rulings Q1–Q9 (2026-08-08); migrations 20260915000000..000300.
 *
 * WHAT THIS FILE PINS, and what it deliberately does not.
 *
 * It pins the settled half: through the real UI, a tenancy admin reaches NO row-level
 * committee content, while the committee's own coordinator reaches it unchanged and the
 * tenancy admin's ADMINISTRATION surfaces keep working. Those three together are the
 * wall — a spec that only proved the denial would pass just as happily if QO·B had
 * broken the product for everyone, or if the admin had been locked out of their own job.
 *
 * ⚠ IT DELIBERATELY DOES NOT PIN THE COORDINATOR-AFFORDANCE BEHAVIOUR, because that is
 * an OPEN QUESTION, filed as BUG-QOB-003. src/lib/queries/session.ts resolves a tenancy
 * admin holding no membership row to `role: 'staff_admin'`, and `canUseCapability` opens
 * on exactly that — so after QO·B the UI still renders coordinator affordances that the
 * DB now refuses. Whether the fix is a flag (Phase A's answer for quality_reviewer), a
 * 404 (the cases-board precedent), or acceptance is a PO ruling. Asserting today's
 * behaviour here would PIN A DEFECT and make the fix look like a regression, so this
 * file asserts only what is settled and names the gap instead.
 *
 * ⚠ REACH, NEVER ROW COUNT (the cases-board-access.spec.ts discipline). "The list is
 * empty for org_admin" proves nothing — it would pass if the commission simply had no
 * responses. Every denial below is paired with the SAME surface, SAME commission, read
 * by a principal who genuinely sees content, so an empty screen can never be mistaken
 * for a wall.
 *
 * Personas (password Test1234!): orgadmin.a@test.local (org_admin Rede A, no CCIH
 * membership) · chefe.ccih@test.local (staff_admin of CCIH — the control) ·
 * hospitaladmin.a1@test.local (hospital_admin — Q4 says the SAME wall applies).
 */

const ORG = 'rede-a'
const COMMISSION = 'ccih'

test.describe('QO·B — org_admin/hospital_admin content wall', () => {
  // ⚠ SURFACE CORRECTED AFTER THE FIRST E2E RUN WENT RED, and the red was RIGHT.
  // These three originally pointed at /respostas — which is "Minhas respostas", the
  // caller's OWN responses. That surface is empty for a tenancy admin REGARDLESS of
  // QO·B, because they never created any: precisely the reach-not-row-count trap this
  // file's own header warns about, walked into anyway. It also matched a nav link
  // rather than a row, which is how it surfaced. The wall can only be observed on a
  // surface that shows OTHER people's responses, so they now target the commission
  // submissions browser, whose list is `ul[aria-label="Respostas"]`.
  const SUBMISSIONS = `/o/${ORG}/c/${COMMISSION}/dashboard/submissions`

  test('CONTROL: the committee coordinator reads the commission submissions', async ({ page }) => {
    // Runs FIRST on purpose. If this fails, every denial below is meaningless — they
    // would be denials of content that is not there.
    await cachedSignIn(page, 'chefe.ccih@test.local')
    await page.goto(SUBMISSIONS)

    const list = page.getByRole('list', { name: 'Respostas' })
    await expect(list).toBeVisible()
    expect(await list.getByRole('listitem').count()).toBeGreaterThan(0)
  })

  test('WALL: org_admin reads no commission submissions on the same surface', async ({ page }) => {
    await cachedSignIn(page, 'orgadmin.a@test.local')
    await page.goto(SUBMISSIONS)

    // ⚠ ASSERTED UNCONDITIONALLY. An earlier draft wrapped this in
    // `if (refused === 0)`, so a 404 branch would have made the test assert NOTHING and
    // still pass — a test that cannot fail. The wall may legitimately express itself
    // either way (the route refuses the tenancy admin, or it renders with an empty
    // list), and the list's ABSENCE is true in both, so no branch is needed.
    // What must never appear is a readable submission row belonging to a committee
    // member — the SAME rows the control just read.
    await expect(page.getByRole('list', { name: 'Respostas' })).toHaveCount(0)
  })

  test('WALL (Q4): hospital_admin gets the same treatment as org_admin', async ({ page }) => {
    await cachedSignIn(page, 'hospitaladmin.a1@test.local')
    await page.goto(SUBMISSIONS)

    await expect(page.getByRole('list', { name: 'Respostas' })).toHaveCount(0)
  })

  test('KEEP: org_admin retains its administration surface', async ({ page }) => {
    // The wall subtracts CONTENT, never the admin's nouns. Without this assertion the
    // suite would be equally green if QO·B had walled the org_admin out of the product
    // altogether — the over-cut failure, which no "did we remove enough?" check sees.
    await cachedSignIn(page, 'orgadmin.a@test.local')
    await page.goto(`/o/${ORG}/manage/comissoes`)

    await expect(page).toHaveURL(new RegExp(`/o/${ORG}/manage/comissoes`))
    await expect(page.getByText(/não encontrad/i)).toHaveCount(0)
    // A commission the admin administers is listed by name — the admin nouns survive.
    await expect(page.getByText(/infecção hospitalar/i).first()).toBeVisible()
  })

  test('KEEP: org_admin still reaches the PHI-free aggregate dashboard', async ({ page }) => {
    // D12 ⑥ keeps the aggregates explicitly. This is the other half of the over-cut
    // guard: the wall must not have taken the dashboards with it.
    await cachedSignIn(page, 'orgadmin.a@test.local')
    await page.goto(`/o/${ORG}/c/${COMMISSION}/dashboard`)

    await expect(page).toHaveURL(new RegExp(`/o/${ORG}/c/${COMMISSION}/dashboard`))
  })

  test('keyboard-only: the admin surface is reachable without a mouse', async ({ page }) => {
    // House rule: at least one keyboard-only flow per phase.
    await cachedSignIn(page, 'orgadmin.a@test.local')
    await page.goto(`/o/${ORG}/manage/comissoes`)
    await page.keyboard.press('Tab')
    const focused = page.locator(':focus')
    await expect(focused).toBeVisible()
  })
})
