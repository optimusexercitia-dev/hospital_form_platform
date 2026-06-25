import { test, expect, type Page } from '@playwright/test'

/**
 * NSP-per-org cross-org isolation (the UI analog of the `173` pgTAP gate).
 *
 * The per-org NSP console lives at `/o/[org]/nsp/**` (ADR 0042). A rede-a NSP user
 * (enrolled PQS member of rede-a) must be UNABLE to reach rede-b's NSP console or
 * PHI, and vice versa — the same cross-org wall `173_nsp_per_org_isolation.sql`
 * proves in SQL, now exercised end-to-end through the UI.
 *
 * Run against the LOCAL seeded stack. `npx supabase db reset --local` first;
 * `--project=chromium --workers=1`. These are READ-ONLY (no mutations).
 *
 * Personas (password Test1234!):
 *   pqs.a@test.local       enrolled PQS member of rede-a   (00…c2)
 *   pqs.b@test.local       enrolled PQS member of rede-b   (00…c4)
 *   nspcoord.a@test.local  nsp_coordinator of rede-a       (00…c1)
 *   chefe.ccih@test.local  staff_admin CCIH (rede-a)       (00…002) — non-PQS
 *
 * Seeded NSP/PHI entities (codes verified against the live seed):
 *   rede-a event  code EV-0001  id e1000000-…-a1  title "Queda de paciente durante transferência"  (event_patient PRT-0099123)
 *   rede-b event  code EV-0001  id e4000000-…-b1  title "Erro de identificação de paciente (Rede B)" (event_patient PRT-B-0001)
 *     NOTE: event codes are PER-ORG and COLLIDE — BOTH orgs have an EV-0001 (per-org
 *     UNIQUE(reporting_commission_id, code)). So cross-org assertions key on the
 *     unique event TITLE / patient MRN, never the (shared) event code.
 *   rede-a referrals ENC-0001 / ENC-0002 ; rede-b referral ENC-0003 (ENC is a GLOBAL
 *     sequence → referral codes ARE unique cross-org and safe to assert on).
 */

const TITLE_A = 'Queda de paciente durante transferência' // rede-a event title
const TITLE_B = 'Erro de identificação de paciente (Rede B)' // rede-b event title

test.use({ viewport: { width: 1280, height: 900 } })

const BASE = 'http://localhost:3000'

const EV_A = 'e1000000-0000-0000-0000-0000000000a1' // rede-a event (has PHI)
const EV_B = 'e4000000-0000-0000-0000-0000000000b1' // rede-b event (has PHI)

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 15_000,
  })
}

// The cross-committee patient index + referral surfaces are flag-gated and ship OFF
// in the seed (the specs that own them flip them per-suite). Enable the two flags the
// cross-org X-5 / referral checks exercise so they run the on-path deterministically,
// regardless of prior specs' afterAll state. Uses the local `supabase db query`
// shell-out (the working pattern; the in-DB RPC shims do not exist locally).
test.beforeAll(async () => {
  const { execSync } = await import('child_process')
  for (const key of ['patient_index', 'case_referrals']) {
    try {
      execSync(
        `npx supabase db query --local "UPDATE app.feature_flags SET enabled = true WHERE key = '${key}'"`,
        { stdio: 'ignore' },
      )
    } catch {
      // Best-effort: X-5 stays correct even if the page 404s (flag off).
    }
  }
})

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// X-1 — A rede-a PQS member reaches their OWN org's NSP console.
// ---------------------------------------------------------------------------
test.describe('X-1: own-org NSP console access', () => {
  test('pqs.a reaches /o/rede-a/nsp (the inbox renders)', async ({ page }) => {
    await signInAs(page, 'pqs.a@test.local')
    const res = await page.goto('/o/rede-a/nsp')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: /fila de eventos/i })).toBeVisible()
  })

  test('pqs.b reaches /o/rede-b/nsp (the inbox renders)', async ({ page }) => {
    await signInAs(page, 'pqs.b@test.local')
    const res = await page.goto('/o/rede-b/nsp')
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: /fila de eventos/i })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// X-2 — Cross-org NSP console is 404 (the wall). No PHI leaks in the body.
// ---------------------------------------------------------------------------
test.describe('X-2: cross-org NSP console is 404', () => {
  test('pqs.a gets 404 on rede-b NSP console /o/rede-b/nsp', async ({ page }) => {
    await signInAs(page, 'pqs.a@test.local')
    const res = await page.goto('/o/rede-b/nsp')
    expect(res?.status()).toBe(404)
    // No rede-b PHI/identifier or rede-b event title leaks onto the 404 page.
    const body = (await page.locator('body').textContent()) ?? ''
    expect(body).not.toContain('PRT-B-0001')
    expect(body).not.toContain(TITLE_B)
  })

  test('pqs.a gets 404 on each rede-b NSP sub-route', async ({ page }) => {
    await signInAs(page, 'pqs.a@test.local')
    for (const sub of [
      '/o/rede-b/nsp/triagem',
      '/o/rede-b/nsp/pacientes',
      '/o/rede-b/nsp/encaminhamentos',
      '/o/rede-b/nsp/configuracoes',
      '/o/rede-b/nsp/equipe',
      `/o/rede-b/nsp/${EV_B}`,
    ]) {
      const res = await page.goto(sub)
      expect(res?.status(), `expected 404 on ${sub}`).toBe(404)
    }
  })

  test('pqs.b gets 404 on rede-a NSP console /o/rede-a/nsp (the inverse)', async ({ page }) => {
    await signInAs(page, 'pqs.b@test.local')
    const res = await page.goto('/o/rede-a/nsp')
    expect(res?.status()).toBe(404)
    const body = (await page.locator('body').textContent()) ?? ''
    expect(body).not.toContain('PRT-0099123')
    expect(body).not.toContain(TITLE_A)
  })
})

// ---------------------------------------------------------------------------
// X-3 — A non-PQS rede-a user (staff_admin) cannot reach the NSP console at all
//        (duty separation: console requires PQS enrollment or the coordinator role).
// ---------------------------------------------------------------------------
test.describe('X-3: non-PQS users cannot reach the NSP console', () => {
  test('chefe.ccih (staff_admin, not PQS) gets 404 on /o/rede-a/nsp', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    const res = await page.goto('/o/rede-a/nsp')
    expect(res?.status()).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// X-4 — The rede-a inbox shows ONLY rede-a events; the rede-b event is absent.
// ---------------------------------------------------------------------------
test.describe('X-4: the inbox is org-scoped (no cross-org events)', () => {
  test('pqs.a inbox shows the rede-a event and NOT the rede-b event (by unique title)', async ({ page }) => {
    await signInAs(page, 'pqs.a@test.local')
    await page.goto('/o/rede-a/nsp')
    await expect(page.getByRole('heading', { name: /fila de eventos/i })).toBeVisible()
    await page.waitForLoadState('networkidle')

    const body = (await page.locator('body').textContent()) ?? ''
    // The rede-a event title IS present; the rede-b event's unique title is ABSENT.
    // (Event codes are per-org and collide — both orgs have EV-0001 — so we key on
    // the unique title, not the code.) The rede-b MRN is never on a PHI-free inbox.
    expect(body).toContain(TITLE_A)
    expect(body).not.toContain(TITLE_B)
    expect(body).not.toContain('PRT-B-0001')
  })

  test('pqs.b inbox shows the rede-b event and NOT the rede-a event (by unique title)', async ({ page }) => {
    await signInAs(page, 'pqs.b@test.local')
    await page.goto('/o/rede-b/nsp')
    await expect(page.getByRole('heading', { name: /fila de eventos/i })).toBeVisible()
    await page.waitForLoadState('networkidle')

    const body = (await page.locator('body').textContent()) ?? ''
    expect(body).toContain(TITLE_B)
    expect(body).not.toContain(TITLE_A)
    expect(body).not.toContain('PRT-0099123') // rede-a MRN
  })
})

// ---------------------------------------------------------------------------
// X-5 — The cross-committee patient index is org-scoped: a rede-a PQS member
//        searching the rede-b MRN gets zero matches (the UI analog of the
//        173 §8 search_patient_xref org-scope proof).
// ---------------------------------------------------------------------------
test.describe('X-5: patient index is org-scoped', () => {
  test('pqs.a searching the rede-b MRN (PRT-B-0001) on the rede-a index gets no rede-b trajectory', async ({
    page,
  }) => {
    await signInAs(page, 'pqs.a@test.local')
    await page.goto('/o/rede-a/nsp/pacientes')
    await page.waitForLoadState('networkidle')

    // The cross-committee patient index is `patient_index`-flag-gated. When ON, the
    // search UI renders; when OFF, the page is notFound() (also a valid "no cross-org
    // access"). Drive the search only if the UI is present; either way, assert that NO
    // rede-b trajectory entity surfaces for a rede-a PQS member.
    const mrnInput = page.getByPlaceholder('Número do prontuário')
    if (await mrnInput.isVisible().catch(() => false)) {
      const searchBtn = page.getByRole('button', { name: /pesquisar/i })
      await mrnInput.click()
      await mrnInput.fill('PRT-B-0001')
      await searchBtn.click()
      // Org-scoped server-action round-trip (search_patient_xref is fail-closed for a
      // foreign org → empty bundle).
      await page.waitForTimeout(5_000)
    }

    // The rede-b trajectory must NOT surface for pqs.a. Key on the rede-b referral code
    // ENC-0003 (ENC is a GLOBAL sequence → unique cross-org) and the rede-b event's
    // unique TITLE. (The rede-b event code EV-0001 collides with rede-a's, and the MRN
    // would be echoed in the input value, so neither is a valid result signal.)
    const body = (await page.locator('body').textContent()) ?? ''
    expect(body).not.toContain('ENC-0003') // rede-b referral code (unique cross-org signal)
    expect(body).not.toContain('Erro de identificação de paciente (Rede B)') // rede-b event title
    expect(body).not.toContain('Parecer sobre conduta medicamentosa — Rede B') // rede-b referral subject
  })
})

// ---------------------------------------------------------------------------
// X-6 — Keyboard-only flow: tab to the inbox filters on the own-org console
//        (per-phase keyboard requirement).
// ---------------------------------------------------------------------------
test.describe('X-6: keyboard-only flow on the own-org console', () => {
  test('pqs.a can keyboard-navigate the rede-a inbox', async ({ page }) => {
    await signInAs(page, 'pqs.a@test.local')
    await page.goto('/o/rede-a/nsp')
    await expect(page.getByRole('heading', { name: /fila de eventos/i })).toBeVisible()

    // Tab from the top; an interactive control (link or filter) must receive focus.
    await page.keyboard.press('Tab')
    const active = await page.evaluate(() => {
      const el = document.activeElement
      return el ? { tag: el.tagName, role: el.getAttribute('role') } : null
    })
    expect(active).not.toBeNull()
    expect(['A', 'BUTTON', 'INPUT', 'SELECT']).toContain(active!.tag)
  })
})
