import { test, expect, type Page } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"

/**
 * ADR 0078 Gate 2 — cases board REACH gate (`fix(cases): 404 the cases board
 * for administration-only principals`, commit cf93a15).
 *
 * Gate-2 removed `list_cases_board`'s coordinator fast-path (the "Gate-1
 * escape" closed in the same fix wave — PROGRESS.md AUTHZ Gate-2 row), so the
 * board now filters every row through `app.can_read_case` with no
 * short-circuit. A principal whose ONLY standing in the commission is
 * ADMINISTRATION — an org_admin/hospital_admin, whom `getCommissionAccessByOrg`
 * resolves to the coordinator `staff_admin` role via `is_commission_admin_of`
 * WITHOUT a membership row — now gets exactly zero rows back from that RPC.
 * An empty board reads as "this commission has no cases"; the fix 404s that
 * principal instead, mirroring the meetings route's C7 gate.
 *
 * ⚠ THE DISCRIMINATOR IS THE PRINCIPAL'S REACH, NEVER THE ROW COUNT. A spec
 * that merely checked "the board is empty for X" would pass unchanged even if
 * the coordinator fast-path bug were reintroduced tomorrow and the commission
 * genuinely had zero cases — that proves nothing about authorization. This
 * file avoids that trap on both sides: the negative case asserts the actual
 * Next.js not-found UI (never a row count), and the positive/no-lockout
 * control asserts SPECIFIC, non-zero seeded case rows — including the
 * `explicit_grants_only` ethics fixture (case_number 5), which independently
 * proves the SAME commission genuinely has cases a real coordinator reads, so
 * the org_admin's 404 cannot be an artifact of an empty board.
 *
 * Ground truth (live-probed against a fresh `db reset` via
 * `rpc/list_cases_board`, 2026-07-17): CCIH has 5 cases for chefe.ccih
 * (case_number 1 "Óbito UTI leito 7" … 5 "Denúncia Ética (fixture E1)"), of
 * which 1 (case_number 2, status `completed`) is terminal — so the "Em
 * aberto" KPI (non-terminal count, `computeCaseKpis`) is 4. `orgadmin.a`'s own
 * `list_cases_board` call against the identical commission returns `[]`.
 *
 * Personas (password Test1234!):
 *   orgadmin.a@test.local   org_admin of Rede A. Resolves a commission
 *                           "staff_admin" role via `is_commission_admin_of`
 *                           WITHOUT holding a CCIH membership row — the exact
 *                           "administration, not case standing" shape this
 *                           fix targets. Has `create_cases` (passes the FIRST
 *                           page gate) but no membership/Administrativo
 *                           standing (fails the NEW second gate).
 *   chefe.ccih@test.local   staff_admin of CCIH (Rede A) — a REAL membership
 *                           holder and the commission's coordinator. The
 *                           no-lockout control: the fix must not touch her.
 *
 * Reset with `npx supabase db reset --local` before a clean run (the case
 * count above is only exact against the seeded fixture).
 */

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

const ORG = 'rede-a'
const SLUG = 'ccih'
const BASE = `/o/${ORG}/c/${SLUG}`

const PW = 'Test1234!'

async function signInAs(page: Page, email: string, password = PW) {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, password)
}

test.describe('Cases board REACH gate (ADR 0078 Gate 2)', () => {
  test('orgadmin.a (org_admin, no CCIH membership) 404s on the cases board, has no Casos nav item, but keeps the rest of Coordenação', async ({
    page,
  }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto(BASE)

    // She resolves a commission-admin "staff_admin" role WITHOUT a membership
    // row — the commission layout renders for her (role !== null), same shape
    // as the meetings-route C7 gate (meetings-reserved-sessions.spec.ts).
    // Anchored regex, not a bare string: the sidebar also renders "Meus Casos"
    // (a DIFFERENT feature, case_access) for a staff_admin-resolved principal,
    // which Playwright's default substring name-match would conflate with
    // "Casos" — and the count badge appends " N" to the accessible name when
    // > 0 (`{count > 0 ? <span>{count}</span> : null}`), so an exact match
    // would break too. `/^Casos(\s|$)/` matches "Casos" / "Casos 4" only.
    const nav = page.getByRole('navigation', { name: /navegação da comissão/i })
    await expect(nav).toBeVisible({ timeout: 10_000 })
    await expect(nav.getByRole('link', { name: /^Casos(\s|$)/ })).toHaveCount(0)
    // Positive control: this is a TARGETED gate on case standing, not a
    // broken/empty nav or a wholesale loss of her administration authority —
    // "keeping every other manage/ item (scoping intact)" per cf93a15.
    await expect(nav.getByRole('link', { name: 'Configurações' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Gerenciar' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Construtor' })).toBeVisible()

    // Content-based, not status-code-based (the commission LAYOUT's shell
    // streams at 200 before the PAGE-level notFound() resolves — the same
    // documented distinction meetings-reserved-sessions.spec.ts and
    // case-access.spec.ts already rely on for this exact route family).
    await page.goto(`${BASE}/manage/cases`)
    await expect(
      page.getByRole('heading', { name: 'Não encontramos esta página.' }),
    ).toBeVisible({ timeout: 10_000 })

    // NO DATA LEAKAGE: the 404 must not have rendered any board content first.
    // Check the single most sensitive string (the ethics fixture's label) and
    // the plain seeded case's formatted number — neither may reach her DOM.
    const body = (await page.locator('body').textContent()) ?? ''
    expect(body).not.toContain('Denúncia Ética')
    expect(body).not.toContain('Caso 0001')
  })

  test('chefe.ccih (real staff_admin/coordinator) still reaches the full 5-case board via keyboard only, incl. the ethics fixture', async ({
    page,
  }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(BASE)

    const nav = page.getByRole('navigation', { name: /navegação da comissão/i })
    // Same anchored regex as the negative test — distinguishes "Casos"/"Casos
    // N" (the count badge) from the unrelated "Meus Casos" item.
    const casosLink = nav.getByRole('link', { name: /^Casos(\s|$)/ })
    await expect(casosLink).toBeVisible({ timeout: 10_000 })

    // KEYBOARD-ONLY (gate requirement): focus the nav link and activate it
    // with Enter — no .click() anywhere in this test.
    await casosLink.focus()
    await page.keyboard.press('Enter')
    await page.waitForURL(`**${BASE}/manage/cases`, { timeout: 15_000 })

    await expect(page.getByRole('heading', { name: 'Casos' })).toBeVisible({
      timeout: 10_000,
    })

    // REACH by case IDENTITY — never a global `tbody tr` COUNT. ⚠ This spec runs
    // in the shared prod-standalone gate, whose DB resets per BATCH, not per test,
    // and sibling specs in the same batch (case-narratives, case-phase-result,
    // cases-extras, case-meetings-panel) actively `create_case_from_template` in
    // THIS commission (rede-a/ccih). So under parallel batching the board
    // legitimately holds MORE than the 5 seeded cases — a bare row count is
    // non-deterministic and, as this file's own header warns, "proves nothing
    // about authorization … assert SPECIFIC seeded case rows, never the
    // row-count-only assertion." Case numbers mint sequentially per commission, so
    // the 5 SEEDED cases keep numbers 1-5 (any sibling case is 0006+); asserting
    // all five specific <Link>s are present proves the coordinator reaches the full
    // seeded set (no lockout, no truncated subset), incl. the explicit_grants_only
    // ethics fixture (case 5) that A4's org-arm removal must not have touched.
    const table = page.getByRole('table')
    await expect(table).toBeVisible({ timeout: 10_000 })
    for (const n of ['0001', '0002', '0003', '0004', '0005']) {
      await expect(
        table.getByRole('link', { name: `Caso ${n}` }),
      ).toBeVisible({ timeout: 10_000 })
    }
    await expect(table.getByText('Denúncia Ética (fixture E1)')).toBeVisible()

    // The "Em aberto" KPI CARD renders (the board computes its indicators). The
    // exact value ("4 of 5 seeded non-terminal") is a commission-wide AGGREGATE
    // that the same sibling case-creation perturbs, so assert the card is present,
    // not its count — the count's ground truth holds only under an isolated fresh
    // reset (see the file header), which the batched gate does not provide.
    const kpiRegion = page.getByRole('region', { name: 'Indicadores dos casos' })
    await expect(kpiRegion.getByText('Em aberto', { exact: true })).toBeVisible()
  })
})
