import { test, expect } from '@playwright/test'
import { cachedSignIn, DEFAULT_PASSWORD } from './helpers/auth'

/**
 * ACT (ADR 0106) — Stage 3 E2E: "act as" role assumption.
 *
 * Plan: docs/plans/act-as-role-assumption.md §4 Stage 3. Design note:
 * docs/design/act-role-picker.md. Buildnotes: docs/plans/act-as-buildnotes.md
 * (Stage 3 — backend half, frontend half, D11).
 *
 * A signed-in user carries exactly ONE active role ("hat") as a JWT claim
 * (`active_role`), and authorization binds to that hat, not the union of their
 * memberships. Multi-role principals choose at sign-in via the picker at
 * `/selecionar-perfil` (single-role principals never see it — the hook derives
 * their hat implicitly, D7/D11). No feature flag: the migration IS the cutover.
 *
 * Personas (password Test1234! for all):
 *   dualhat.a@test.local   TWO role types: org_admin (org-tier, Rede A) +
 *                          quality_reviewer (hospital-tier, Hospital Central A).
 *                          The D2 POSITIVE picker case.
 *   multi@test.local       ONE role type (staff) across TWO commissions (CCIH +
 *                          Farmácia, both Rede A). The D2 NEGATIVE case — must
 *                          never see the picker. Do not conflate with dualhat.a@.
 *   chefe.ccih@test.local  staff_admin of CCIH only — single-role baseline.
 *
 * Route/label facts verified against the live catalog + source before writing
 * assertions (never assumed from the plan's prose — CLAUDE.md's binding rule):
 *   - Rede A org slug: rede-a · CCIH commission slug: ccih.
 *   - `commissions_select_member_or_admin` (RLS, live pg_policies) admits via
 *     `is_org_admin_of`/`is_quality_reviewer_of`, both of which delegate to
 *     `has_role(..., auth.uid())` — a CALLER check, hat-gated post-Stage-3.
 *   - Rede A has exactly 4 commissions (CCIH, Farmácia, Ética, Segurança do
 *     Paciente A2) — dualhat.a@'s org_admin hat admits all 4; hatless, 0.
 *   - `org-manage-sidebar.tsx` passes UserMenu an EXPLICIT `roleLabel`
 *     ("Administração da organização" for org_admin) — the finer, pre-existing
 *     per-shell label, not the generic role-catalog string
 *     ("Administrador(a) da organização"); the qualidade/nsp shells pass none,
 *     so they DO show the generic catalog label ("Revisor(a) da qualidade").
 *   - `nsp/layout.tsx`'s own doc comment: "an unenrolled, non-coordinator
 *     org_admin" gets `notFound()` — org_admin does NOT imply NSP standing, and
 *     neither does quality_reviewer, so dualhat.a@ is denied at /nsp under
 *     EITHER hat (the D9 fixture below).
 */

const ORG_A = '0c000000-0000-0000-0000-00000000000a' // Rede A
// The 4 Rede A commission ids (verified live: `select id from commissions
// where organization_id = '<ORG_A>'`) — CCIH, Farmácia, Ética, Segurança do
// Paciente A2. Used only as a count/shape check in the D5 spec below.
const ORG_A_COMMISSION_COUNT = 4

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
if (!SUPABASE_ANON_KEY) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

/** Decode a JWT's payload without verifying its signature — good enough for a
 * test assertion on the `active_role` claim, never used for a trust decision. */
function decodeJwtClaims(token: string): Record<string, unknown> {
  const payload = token.split('.')[1]
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
}

// BUG-ACT-NOTFOUND-COPY-1: a RegExp stem, not the pinned old global string —
// Stage 3 added area boundaries with different wording ("...não encontrada")
// that share only this pt-BR stem. Verified passing (all 3 call sites) against
// the OLD global copy before this widening, so denial already held here; this
// change is defensive against the boundary shifting again, not a fix for a
// currently-failing assertion.
const NOT_FOUND_HEADING = /não encontr/i

test.describe('ACT — role assumption (ADR 0106)', () => {
  test.describe('Picker — positive (D2): dualhat.a@ holds two role types', () => {
    test('choosing org_admin lands on the org manage area with that hat active', async ({
      page,
    }) => {
      await cachedSignIn(page, 'dualhat.a@test.local', DEFAULT_PASSWORD, 'org_admin')

      await expect(page).toHaveURL(/\/o\/rede-a\/manage$/)
      await expect(
        page.getByRole('heading', { name: 'Rede Hospitalar A', level: 1 }),
      ).toBeVisible()
      // The indicator shows the chosen hat. This shell passes UserMenu its own
      // finer-grained explicit label (org-manage-sidebar.tsx) rather than the
      // generic role-catalog string — still correctly reflects the org_admin
      // hat, verified against the actual source, not assumed identical text.
      // Scoped to the menu TRIGGER specifically: "Administração da organização"
      // also appears as this page's own eyebrow heading and inside an
      // unrelated audit-trail nav description, so an unscoped getByText is
      // ambiguous (a real strict-mode violation hit while running this spec).
      await expect(
        page.getByRole('button', { name: /abrir menu da conta/i }),
      ).toContainText('Administração da organização')
    })

    test('choosing quality_reviewer lands on the quality office with that hat active', async ({
      page,
    }) => {
      await cachedSignIn(page, 'dualhat.a@test.local', DEFAULT_PASSWORD, 'quality_reviewer')

      await expect(page).toHaveURL(/\/o\/rede-a\/qualidade$/)
      await expect(
        page.getByRole('heading', { name: 'Casos sob supervisão', level: 1 }),
      ).toBeVisible()
      // qualidade/layout.tsx passes UserMenu no explicit roleLabel, so the
      // indicator defaults to the catalog label for the active hat.
      await expect(page.getByText('Revisor(a) da qualidade')).toBeVisible()
    })
  })

  test('Picker — negative (D2): multi@ holds one role type across two commissions and never sees the picker', async ({
    page,
  }) => {
    // No actAs argument: multi@ must never be routed through the picker at
    // all. If this ever regressed, loginFresh's own new guard (see
    // e2e/helpers/auth.ts) throws immediately rather than this test silently
    // hanging or mis-asserting the final URL for the wrong reason.
    await cachedSignIn(page, 'multi@test.local', DEFAULT_PASSWORD)
    await expect(page).toHaveURL(/\/c$/)

    // Direct probe of the picker's own self-guard (design note §3.4): a
    // single-role-TYPE principal hitting /selecionar-perfil directly must be
    // bounced immediately — never shown the picker markup, matching D2/D7.
    await page.goto('/selecionar-perfil')
    await expect(page).not.toHaveURL(/\/selecionar-perfil$/)
    await expect(page.getByRole('heading', { name: 'Escolha seu papel' })).toHaveCount(0)
  })

  test('Single-role: chefe.ccih@ never sees the picker and has no Trocar papel affordance', async ({
    page,
  }) => {
    await cachedSignIn(page, 'chefe.ccih@test.local', DEFAULT_PASSWORD)
    await expect(page).toHaveURL(/\/o\/rede-a\/c\/ccih$/)

    const menuTrigger = page.getByRole('button', { name: /abrir menu da conta/i })
    // Scoped to the menu trigger: the commission sidebar ALSO has a nav
    // section literally labeled "Coordenação", so an unscoped getByText is
    // ambiguous (a real strict-mode violation hit while running this spec).
    // Checked BEFORE opening: Radix's DropdownMenuTrigger stops resolving to
    // role "button" once its menu is open (its modal-content takes over the
    // accessible role in the tree — confirmed while running this spec: the
    // exact same locator that matches when closed reports "element(s) not
    // found" once open), so the caption must be read while still closed.
    await expect(menuTrigger).toContainText('Coordenação') // her existing per-shell roleLabel, unchanged

    await menuTrigger.click()
    await expect(page.getByText('Trocar papel')).toHaveCount(0)
    // The menu is otherwise fully functional (not a broken/empty dropdown).
    await expect(page.getByRole('menuitem', { name: /sair/i })).toBeVisible()

    await page.goto('/selecionar-perfil')
    await expect(page).not.toHaveURL(/\/selecionar-perfil$/)
    // Content-based, not just the URL redirect — mirrors the D2 test above (this
    // file's sibling case for multi@), which already asserts the picker's own
    // heading is absent. AE4.3 matrix §7.1 classification: this is NEITHER
    // cross-commission NOR cross-org — a single-role principal is bounced from
    // an in-session UI route, not a foreign tenant's data, so it needs no second
    // persona and the seed's missing cross-org fixture is not a constraint here.
    await expect(page.getByRole('heading', { name: 'Escolha seu papel' })).toHaveCount(0)
  })

  test('The switch: assuming a hat then switching changes the landing route AND real authorization', async ({
    page,
  }) => {
    await cachedSignIn(page, 'dualhat.a@test.local', DEFAULT_PASSWORD, 'org_admin')
    await expect(page).toHaveURL(/\/o\/rede-a\/manage$/)
    await expect(
      page.getByRole('heading', { name: 'Rede Hospitalar A', level: 1 }),
    ).toBeVisible()

    // Switch to the OTHER hat via the indicator dropdown ("Trocar papel").
    await page.getByRole('button', { name: /abrir menu da conta/i }).click()
    await page.getByRole('menuitem', { name: /revisor\(a\) da qualidade/i }).click()

    // Lands on quality_reviewer's own landing route (assume_role → refreshSession
    // → redirect) — a different area entirely, not a same-page label swap.
    await page.waitForURL(/\/o\/rede-a\/qualidade$/, { timeout: 20_000 })
    await expect(
      page.getByRole('heading', { name: 'Casos sob supervisão', level: 1 }),
    ).toBeVisible()
    await expect(page.getByText('Revisor(a) da qualidade')).toBeVisible()

    // Authorization actually changed, not just the label: the org manage area
    // that was reachable a moment ago under the OLD hat is now denied under
    // the new one — dualhat.a@ still structurally holds the org_admin
    // membership row, but it grants nothing while she is wearing a different
    // hat (D5/D12, the security claim of the whole program).
    await page.goto('/o/rede-a/manage')
    await expect(page.getByRole('heading', { name: NOT_FOUND_HEADING })).toBeVisible()
    // And the D9 hint correctly offers to switch BACK — proving the denial is
    // hat-scoped (a real, reversible access decision), not a broken route.
    await expect(page.getByText('Administração da organização')).toHaveCount(0) // shell-specific label, not shown on a 404
    await expect(page.getByText('Administrador(a) da organização')).toBeVisible() // catalog label, via the D9 hint
    await expect(page.getByRole('button', { name: /trocar agora/i })).toBeVisible()
  })

  test.describe('D9 hint on a denied area', () => {
    test('offers the OTHER held hat, and NEVER the currently active one', async ({ page }) => {
      await cachedSignIn(page, 'dualhat.a@test.local', DEFAULT_PASSWORD, 'org_admin')

      // Neither org_admin nor quality_reviewer grants NSP standing
      // (nsp/layout.tsx's own doc comment: an org_admin gets notFound() here).
      await page.goto('/o/rede-a/nsp')
      await expect(page.getByRole('heading', { name: NOT_FOUND_HEADING })).toBeVisible()

      // Offers the OTHER hat...
      await expect(page.getByText('Revisor(a) da qualidade')).toBeVisible()
      await expect(page.getByRole('button', { name: /trocar agora/i })).toHaveCount(1)
      // ...and NEVER the currently active hat — the live bug this exists to
      // pin (buildnotes, Stage 3 frontend half §3: a caller once saw their
      // OWN active hat suggested as the "fix" for their own 404).
      await expect(page.getByText('Administrador(a) da organização')).toHaveCount(0)

      // The hint is reversible and correct: following it actually restores
      // standing (closes the loop opened by the switch spec above).
      await page.getByRole('button', { name: /trocar agora/i }).click()
      await page.waitForURL(/\/o\/rede-a\/qualidade$/, { timeout: 20_000 })
      await expect(
        page.getByRole('heading', { name: 'Casos sob supervisão', level: 1 }),
      ).toBeVisible()
    })

    test('renders nothing for a single-role principal with no other standing', async ({
      page,
    }) => {
      await cachedSignIn(page, 'multi@test.local', DEFAULT_PASSWORD)
      await page.goto('/o/rede-a/nsp') // plain staff — no PQS/coordinator standing either
      await expect(page.getByRole('heading', { name: NOT_FOUND_HEADING })).toBeVisible()
      await expect(page.getByRole('button', { name: /trocar agora/i })).toHaveCount(0)
    })
  })

  test('D5: a hatless multi-role session is a stranger until it picks a hat', async ({
    request,
  }) => {
    // The E2E proxy for "a stale pre-cutover session": every pre-cutover
    // session carried no active_role claim, and post-cutover a fresh
    // password grant for a MULTI-role principal with no active_role_selections
    // row produces exactly that state (D5's own "no row + multi-role → NO
    // claim" — buildnotes Stage 1 tester-half §"Stage 3 carry-forward
    // obligation — accessToken"). dualhat.a@ is the only multi-role-TYPE
    // seed persona, so it is the only fixture that can prove this. A raw
    // password grant (not the cached browser-session helper) so the session's
    // own refresh_token is available for the "after assume_role" contrast
    // below — recording the choice per that same buildnotes obligation.
    const grant = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      data: { email: 'dualhat.a@test.local', password: DEFAULT_PASSWORD },
    })
    expect(grant.ok(), await grant.text()).toBeTruthy()
    const { access_token: hatlessToken, refresh_token: refreshToken } =
      (await grant.json()) as { access_token: string; refresh_token: string }

    // Sanity check on the mechanism itself, not just the outcome: this fresh
    // session's own JWT genuinely carries no active_role claim.
    expect(decodeJwtClaims(hatlessToken).active_role).toBeUndefined()

    // "Stranger-level nothing": dualhat.a@ genuinely holds org_admin on Rede A
    // (4 commissions would be visible under that hat — verified live against
    // pg_policies before writing this spec), yet the hatless session sees ZERO.
    const hatlessRead = await request.get(
      `${SUPABASE_URL}/rest/v1/commissions?organization_id=eq.${ORG_A}&select=id`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${hatlessToken}` } },
    )
    expect(hatlessRead.ok(), await hatlessRead.text()).toBeTruthy()
    expect(await hatlessRead.json()).toEqual([])

    // Non-vacuity control (a detector that finds nothing must be proven able
    // to find something): the SAME session, after assuming the SAME real hat
    // it already holds, sees its real data. This is not a different
    // principal or a different query — only the active_role claim changed.
    const assume = await request.post(`${SUPABASE_URL}/rest/v1/rpc/assume_role`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${hatlessToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_role: 'org_admin' },
    })
    expect(assume.ok(), await assume.text()).toBeTruthy()

    // assume_role only writes the selection row — the JWT already in hand was
    // minted before that write. A refresh re-mints it through
    // custom_access_token_hook, exactly as the app's own assumeRole action does.
    const refresh = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      data: { refresh_token: refreshToken },
    })
    expect(refresh.ok(), await refresh.text()).toBeTruthy()
    const { access_token: hattedToken } = (await refresh.json()) as { access_token: string }
    expect(decodeJwtClaims(hattedToken).active_role).toBe('org_admin')

    const hattedRead = await request.get(
      `${SUPABASE_URL}/rest/v1/commissions?organization_id=eq.${ORG_A}&select=id`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${hattedToken}` } },
    )
    expect(hattedRead.ok(), await hattedRead.text()).toBeTruthy()
    const rows = (await hattedRead.json()) as Array<{ id: string }>
    expect(rows).toHaveLength(ORG_A_COMMISSION_COUNT)
  })

  test('Keyboard-only: sign in and complete the picker with zero mouse input', async ({
    page,
  }) => {
    // Deliberately NOT using loginFresh/cachedSignIn here — this spec's whole
    // point is to prove real keyboard operation end to end, and the helper's
    // own picker step uses a label .click(). Every interaction below is a
    // real Playwright "action" (auto-waiting + a genuine focus/key dispatch —
    // .pressSequentially()/keyboard.press()), never a bare .focus() (which
    // does not auto-wait and can race RSC streaming — memory:
    // playwright-focus-is-not-auto-waiting) and never a .click()/.fill().
    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    const emailInput = page.getByLabel(/e-mail/i)
    await expect(emailInput).toBeVisible()
    await expect(emailInput).toBeFocused() // autoFocus on the field — verified, not assumed
    await emailInput.pressSequentially('dualhat.a@test.local')

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: /esqueci minha senha/i })).toBeFocused()

    await page.keyboard.press('Tab')
    const passwordInput = page.locator('input[name="password"]')
    await expect(passwordInput).toBeFocused()
    await passwordInput.pressSequentially(DEFAULT_PASSWORD)

    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: /mostrar senha/i })).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: /^entrar$/i })).toBeFocused()
    await page.keyboard.press('Enter')

    await page.waitForURL(/\/selecionar-perfil$/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: 'Escolha seu papel' })).toBeVisible()

    // Tab into the (native) radiogroup — lands on the first option
    // (alphabetical: org_admin before quality_reviewer, role-catalog.ts's own
    // sort) since neither is checked yet.
    await page.keyboard.press('Tab')
    const orgAdminRadio = page.getByRole('radio', {
      name: /administrador\(a\) da organização/i,
    })
    await expect(orgAdminRadio).toBeFocused()
    await expect(orgAdminRadio).not.toBeChecked()

    // Native radio-group keyboard semantics (no hand-rolled JS): ArrowDown
    // moves focus AND selection to the next radio in the same group.
    await page.keyboard.press('ArrowDown')
    const qualityRadio = page.getByRole('radio', { name: /revisor\(a\) da qualidade/i })
    await expect(qualityRadio).toBeFocused()
    await expect(qualityRadio).toBeChecked()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: /continuar/i })).toBeFocused()
    await page.keyboard.press('Enter')

    await page.waitForURL(/\/o\/rede-a\/qualidade$/, { timeout: 20_000 })
    await expect(
      page.getByRole('heading', { name: 'Casos sob supervisão', level: 1 }),
    ).toBeVisible()
  })
})
