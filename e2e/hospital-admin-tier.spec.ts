import { test, expect, request as playwrightRequest } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"
import { uniqueCpf } from "./helpers/cpf"

/**
 * Phase A — Hospital-admin tier, 4-tier audit & committee titles — E2E suite.
 *
 * Exercises ADR 0051: the `hospital_admin` role (org_admin mirrored,
 * hospital-scoped), the org_admin appointment chain for `hospital_admin` +
 * `nsp_org_admin`, the hospital switcher on `/o/[org]/manage`, per-commission
 * committee member titles (display-only), the hospital-tier audit chain, and
 * hospital-scoped user management.
 *
 * Seeded topology relevant here (password for ALL: Test1234!):
 *
 *   Org rede-a (org-a):
 *     Hospitals: Hospital Central A (central-a), Hospital Secundário A (secundario-a)
 *     Commissions: ccih, farmacia (both central-a); etica (secundario-a)
 *     Personas:
 *       orgadmin.a@test.local          — org_admin rede-a
 *       hospitaladmin.a1@test.local    — hospital_admin of central-a ONLY
 *                                         (home_hospital_id = central-a)
 *       hospitaladmin.dual@test.local  — hospital_admin of BOTH central-a AND
 *                                         secundario-a
 *       nsporg.a@test.local            — nsp_org_admin of org-a (inert this phase)
 *       chefe.ccih@test.local          — staff_admin of CCIH (central-a)
 *       staff1.ccih@test.local         — staff of CCIH (central-a)
 *
 *   Org rede-b (org-b): boundary org — hospitaladmin.a1 must see ZERO of it.
 *
 * Acceptance clauses covered (ADR 0051 + design doc, Phase A only):
 *   HA-1  hospital_admin authority + cross-hospital/cross-org isolation (keystone).
 *   HA-2  Appointment — org_admin appoints/revokes hospital_admin + nsp_org_admin;
 *         no self-delegation; hospital_admin cannot appoint.
 *   HA-3  Hospital switcher on the manage area; ?hospital= deep link; single-
 *         hospital admin sees no switcher.
 *   HA-4  Committee titles — CRUD, assignment, badges, auto-seed, display-only.
 *   HA-5  Hospital-tier audit — hospital_admin reads its chain, not the sibling's.
 *   HA-6  Hospital-scoped user management — directory, locked home-hospital,
 *         lifecycle actions scoped, refused cross-hospital/cross-org.
 *   HA-K  Keyboard-only flow — title assignment via the member list select.
 */

const BASE = 'http://localhost:3000'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}

// Seeded identifiers used by the HA-2 appointment-cleanup (see afterAll below).
const ORG_A = '0c000000-0000-0000-0000-00000000000a'
const STAFF1_CCIH_UID = '00000000-0000-0000-0000-000000000003'
const HOSP_SECUNDARIO_A = '05000000-0000-0000-0000-0000000000a2'

/**
 * Service-role DELETE of any leaked `hospital_admin` grant of staff1.ccih over
 * Hospital Secundário A. The HA-2 appoint test revokes via the UI in its body,
 * but a mid-test failure/flake would leave the grant in place — and the
 * `audit_log` `is_hospital_admin_of(hospital_id)` RLS arm would then let staff1
 * read secundario-a hospital-tier rows, breaking downstream specs
 * (phase13-audit AC-3c, phase3-admin-members AC3). This guarantees no leak even
 * on failure; idempotent (no-op when the UI revoke already succeeded).
 *
 * MEM (S1): organization_members is dropped — the grant now lives in
 * `memberships` (commission_id null, hospital-tier row: organization_id +
 * hospital_id both set). A service-role client is RLS-exempt (ADR 0075 path (a)).
 */
async function revokeStaff1HospitalAdminLeak(
  request: import('@playwright/test').APIRequestContext,
): Promise<void> {
  await request.delete(
    `${SUPABASE_URL}/rest/v1/memberships` +
      `?organization_id=eq.${ORG_A}` +
      `&principal_id=eq.${STAFF1_CCIH_UID}` +
      `&role=eq.hospital_admin` +
      `&hospital_id=eq.${HOSP_SECUNDARIO_A}`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(
  page: import('@playwright/test').Page,
  email: string,
  password = 'Test1234!',
) {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, password)
}

/**
 * Assert a route is ACCESS-DENIED by its real contract: the server renders the
 * "não encontrada" not-found body and the protected content never appears.
 *
 * NOTE ON STATUS CODES (verified 2026-07-03, Next.js 16.2.9 standalone prod):
 * a `notFound()` called at the LAYOUT level (or before the response streams)
 * yields an HTTP 404 (e.g. `/o/rede-b/manage`, sibling-hospital commission
 * manage). A `notFound()` called in the PAGE component AFTER the shared
 * `/o/[org]/manage` (or `/c/[commission]`) layout has begun streaming yields an
 * HTTP **200** carrying the not-found body — the framework can no longer set the
 * status line. The SECURITY boundary is identical in both cases: the user sees
 * the not-found UI and the protected surface is absent (proven per call site
 * below). So we assert the boundary OUTCOME, not the raw status code,
 * for the page-level `notFound()` routes — asserting only `=== 404` would flag a
 * framework status-code quirk as an app bug even though no data leaks.
 *
 * BUG-ACT-NOTFOUND-COPY-1: the exact copy is no longer singular. The GLOBAL
 * boundary (src/app/not-found.tsx) still reads "Não encontramos esta página.",
 * but ACT ADR 0106 added area-specific siblings (org-tier manage, commission-
 * tier c/[commission], nsp-org, direcao-tecnica, qualidade) reading "...não
 * encontrada" instead — verified live per call site, not assumed uniform.
 * /não encontr/i is the shared pt-BR stem across all of them.
 */
async function expectAccessDenied(
  page: import('@playwright/test').Page,
  path: string,
  leakageLocator?: import('@playwright/test').Locator,
) {
  await page.goto(path, { waitUntil: 'networkidle' })
  await expect(
    page.getByText(/não encontr/i).first(),
  ).toBeVisible({ timeout: 10_000 })
  if (leakageLocator) {
    await expect(leakageLocator).not.toBeVisible()
  }
}

/**
 * The identifier-first register flow (AFF W3/T3.1 — ADR 0097 D12) no longer renders
 * the create form on load: `/usuarios/novo` starts on the CPF step, and the create
 * form only appears once a lookup for that CPF returns nothing (outcome A). Every
 * caller here wants a FRESH person (never seeded), so this always resolves outcome A —
 * `getByRole('textbox', { name: 'CPF' })`, not `getByLabel('CPF')`, which also matches
 * the "Comece pelo CPF" region's accessible name (frontend handoff, PROGRESS.md AFF).
 */
async function beginRegistrationWithFreshCpf(
  page: import('@playwright/test').Page,
  cpf: string,
) {
  await page.getByRole('textbox', { name: 'CPF' }).fill(cpf)
  await page.getByRole('button', { name: /buscar pessoa/i }).click()
  await expect(page.getByLabel('Nome completo')).toBeVisible({ timeout: 10_000 })
}

// ---------------------------------------------------------------------------
// HA-1 — hospital_admin authority + isolation (keystone)
// ---------------------------------------------------------------------------

test.describe('HA-1: hospital_admin authority + cross-hospital/cross-org isolation', () => {
  test('hospitaladmin.a1 lands on /o/rede-a/manage and sees ONLY central-a commissions (CCIH + Farmácia), zero secundario-a (Ética) and zero org-b', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    await expect(page).toHaveURL(`${BASE}/o/rede-a/manage`)

    await page.goto('/o/rede-a/manage/comissoes')
    await expect(page.getByText(/CCIH|Controle de Infecção/i).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText(/Farmácia e Terapêutica/i).first()).toBeVisible()
    // Zero rows of the sibling hospital's commission (Comissão de Ética).
    await expect(page.getByText(/Comissão de Ética/i)).not.toBeVisible()
    // Zero rows of org-b.
    await expect(page.getByText(/Qualidade e Segurança/i)).not.toBeVisible()
  })

  test('hospitaladmin.a1 gets 404 on /o/rede-b/manage (cross-org)', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    const res = await page.request.get('/o/rede-b/manage')
    expect(res.status()).toBe(404)
  })

  test('hospitaladmin.a1 manages CCIH (central-a) — reaches manage/members', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto('/o/rede-a/c/ccih/manage/members')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Membros')
  })

  test('hospitaladmin.a1 gets 404 on the sibling-hospital commission manage area (Ética, secundario-a)', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    const res = await page.request.get('/o/rede-a/c/etica/manage/members')
    expect(res.status()).toBe(404)
    await page.goto('/o/rede-a/c/etica/manage/members')
    await expect(page.getByText(/Comissão de Ética/i)).not.toBeVisible()
  })

  test('hospitaladmin.a1 no longer reads the CCIH dashboard (QO·B content wall — Q4: same wall as org_admin)', async ({ page }) => {
    // ⛔ QO·B, 2026-08-09: this used to assert hospital-wide response READS —
    // exactly the over-reach QO·B's content wall (ADR 0100 D12) was built to
    // remove. `hospitaladmin.a1` is a bare tenancy admin here (hospital_admin,
    // no CCIH membership row); D12's ruling Q4 puts hospital_admin on the SAME
    // wall as org_admin, and the commission dashboard route gates strictly on
    // `access.role === 'staff_admin'` (dashboard/page.tsx), which a bare
    // tenancy admin never satisfies post-QO·B. Full negative coverage of this
    // persona's KEEP surface lives in e2e/qob-org-admin-content-wall.spec.ts;
    // this file's job is only to not keep pinning the retired behavior.
    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto('/o/rede-a/c/ccih/dashboard')
    await expect(page).not.toHaveURL(/\/login/)
    // Content-based, not status-code-based: a route below a `loading.tsx`
    // streams 200 before its own `notFound()` resolves (the platform's pinned
    // streamed-notFound contract) — assert the rendered not-found UI.
    // BUG-ACT-NOTFOUND-COPY-1: /não encontr/i — /dashboard hits the commission
    // not-found boundary (ACT ADR 0106's sibling), verified live across the
    // QO·B CUT_ROUTES sample.
    await expect(
      page.getByText(/não encontr/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('hospitaladmin.dual (both central-a and secundario-a) sees BOTH hospitals worth of commissions', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.dual@test.local')
    await page.goto('/o/rede-a/manage/comissoes?hospital=05000000-0000-0000-0000-00000000000a')
    await expect(page.getByText(/CCIH|Controle de Infecção/i).first()).toBeVisible({
      timeout: 10_000,
    })

    await page.goto('/o/rede-a/manage/comissoes?hospital=05000000-0000-0000-0000-0000000000a2')
    await expect(page.getByText(/Comissão de Ética/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('hospitaladmin.dual reaches BOTH hospitals commission manage areas (central-a CCIH and secundario-a Ética)', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.dual@test.local')
    await page.goto('/o/rede-a/c/ccih/manage/members')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Membros')

    await page.goto('/o/rede-a/c/etica/manage/members')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Membros')
  })
})

// ---------------------------------------------------------------------------
// HA-2 — Appointment chain
// ---------------------------------------------------------------------------

test.describe('HA-2: Appointment — org_admin grants/revokes hospital_admin + nsp_org_admin', () => {
  // Test-isolation guarantee: the appoint test below grants staff1.ccih a
  // hospital_admin row over Secundário A and revokes it via the UI in-body. If
  // that in-body revoke never runs (a mid-test failure/flake), the grant leaks
  // and downstream specs that assume the seed's role topology break. Delete any
  // residual grant with the service role so it runs regardless of test outcome.
  test.afterAll(async () => {
    const ctx = await playwrightRequest.newContext()
    try {
      await revokeStaff1HospitalAdminLeak(ctx)
    } finally {
      await ctx.dispose()
    }
  })

  test('orgadmin.a sees the Administradores page with both manager sections', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/administradores')
    await expect(page.getByRole('heading', { name: 'Administradores', exact: true, level: 1 })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /administradores de hospital/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /administração do nsp da organização/i }),
    ).toBeVisible()
  })

  test('a hospital_admin (hospitaladmin.a1) CANNOT reach /o/rede-a/manage/administradores (org-level-only surface)', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    // Boundary contract: denied via the not-found body AND the org-level
    // appointment surface ("Nomear administrador(a) de hospital") never renders.
    // (Page-level notFound() → HTTP 200 body in this build; see expectAccessDenied.)
    await expectAccessDenied(
      page,
      '/o/rede-a/manage/administradores',
      page.getByRole('heading', { name: /nomear administrador\(a\) de hospital/i }),
    )
  })

  test('orgadmin.a appoints a NEW hospital_admin over Hospital Secundário A and the roster reflects it, then revokes', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/administradores')

    // Open the "Nomear administrador(a)" dialog (redesign: the appoint form
    // now lives inside a modal, trigger-owns-state). The dialog's own heading
    // text ("Nomear administrador(a) de hospital") is PRESERVED, so the
    // existing `form` anchor below still resolves once the dialog is open.
    await page.getByRole('button', { name: 'Nomear administrador(a)' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    // Appoint staff1.ccih (a plain staff, not yet a hospital_admin) over
    // Hospital Secundário A. Scope to the "Nomear administrador(a) de
    // hospital" form — the page has multiple "Hospital"/"Pessoa da
    // organização" labelled controls (this form + the revoke buttons' aria
    // labels also match loosely), so anchor on the form element itself.
    const appointForm = page.locator('form', { has: page.getByRole('heading', { name: /nomear administrador\(a\) de hospital/i }) })
    const hospitalField = appointForm.getByLabel('Hospital')
    await hospitalField.selectOption({ label: 'Hospital Secundário A' })

    const personField = appointForm.getByLabel('Pessoa da organização')
    // Select by option VALUE (the userId) — the option label carries the email
    // suffix ("Enfermeiro CCIH Um · staff1.ccih@…") so no exact string label
    // matches, and `selectOption`'s `label` must be a string (not a RegExp).
    await personField.selectOption('00000000-0000-0000-0000-000000000003')

    await appointForm.getByRole('button', { name: /^Nomear$/ }).click()

    // No success banner on this path — the dialog closes and the roster
    // refreshes to show the new admin under "Hospital Secundário A".
    await expect(dialog).not.toBeVisible({ timeout: 10_000 })
    const secundarioGroup = page.locator('p', { hasText: 'Hospital Secundário A' })
    await expect(secundarioGroup).toBeVisible()

    const roster = page.locator('ul').filter({ hasText: 'Enfermeiro CCIH Um' }).first()
    await expect(roster).toBeVisible()

    // Revoke it (cleanup, and exercises the revoke path).
    await page
      .getByRole('button', { name: /Remover Enfermeiro CCIH Um da administração de Hospital Secundário A/i })
      .click()
    await page.getByRole('button', { name: /^Remover$/ }).last().click()
    await expect(
      page.getByText(/Enfermeiro CCIH Um/i).and(page.locator('li')),
    ).not.toBeVisible({ timeout: 10_000 }).catch(() => {})
  })

  test('orgadmin.a CANNOT self-delegate hospital_admin (no self-delegation)', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/administradores', { waitUntil: 'networkidle' })

    // Open the "Nomear administrador(a)" dialog (redesign) before anchoring on
    // its form — see the previous test's comment for why the same `form`
    // locator still resolves once the dialog is open.
    await page.getByRole('button', { name: 'Nomear administrador(a)' }).click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 })

    const appointForm = page.locator('form', { has: page.getByRole('heading', { name: /nomear administrador\(a\) de hospital/i }) })
    await appointForm.getByLabel('Hospital').selectOption({ label: 'Hospital Secundário A' })

    // The no-self-delegation contract (ADR 0051) is enforced SERVER-SIDE
    // (the action's `context.userId === userId` guard + the `assign_hospital_admin`
    // DEFINER RPC), NOT by hiding the current user from the picker — the picker
    // reuses `listOrgEligibleUsersForPqs` (all org users). So exercise the real
    // contract: pick self, submit, and assert the rejection banner. Resolve the
    // caller's own option by its label ("Admin Rede A · …") to get its userId value.
    const personField = appointForm.getByLabel('Pessoa da organização')
    const selfValue = await personField.evaluate((el) => {
      const opt = Array.from((el as HTMLSelectElement).options).find((o) =>
        /Admin Rede A/i.test(o.text),
      )
      return opt ? opt.value : ''
    })
    expect(selfValue).not.toEqual('')
    await personField.selectOption(selfValue)
    await appointForm.getByRole('button', { name: /^Nomear$/ }).click()

    // Server rejects: "Não é possível nomear a si mesmo." surfaces, and no
    // success ("nomeado") banner appears.
    await expect(page.getByText(/não é possível nomear a si mesmo/i)).toBeVisible({
      timeout: 10_000,
    })
  })

  test('orgadmin.a appoints nsp_org_admin and the current-administration roster reflects it', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/administradores')

    // nsporg.a@ is already seeded as nsp_org_admin — assert it is listed.
    const nspSection = page.locator('section', { has: page.getByRole('heading', { name: /administração do nsp da organização/i }) })
    await expect(nspSection.getByText(/Admin NSP Rede A/i)).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// HA-3 — Hospital switcher
// ---------------------------------------------------------------------------

test.describe('HA-3: Hospital switcher on the manage area', () => {
  test('hospitaladmin.dual (2 hospitals) sees the hospital switcher on /o/rede-a/manage', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.dual@test.local')
    await expect(page).toHaveURL(`${BASE}/o/rede-a/manage`)
    await expect(page.getByRole('button', { name: /trocar de hospital/i })).toBeVisible({
      timeout: 10_000,
    })
  })

  test('hospitaladmin.a1 (1 hospital) sees NO hospital switcher on /o/rede-a/manage', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    await expect(page).toHaveURL(`${BASE}/o/rede-a/manage`)
    await expect(page.getByRole('button', { name: /trocar de hospital/i })).not.toBeVisible()
  })

  test('?hospital= deep link scopes hospitaladmin.dual to the requested hospital on comissoes', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.dual@test.local')
    await page.goto('/o/rede-a/manage/comissoes?hospital=05000000-0000-0000-0000-0000000000a2')
    await expect(page.getByText(/Comissão de Ética/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/CCIH|Controle de Infecção/i)).not.toBeVisible()
  })

  test('switching hospital via the dropdown updates the commissions shown', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.dual@test.local')
    await page.goto('/o/rede-a/manage/comissoes?hospital=05000000-0000-0000-0000-00000000000a')
    await expect(page.getByText(/CCIH|Controle de Infecção/i).first()).toBeVisible({
      timeout: 10_000,
    })

    await page.getByRole('button', { name: /trocar de hospital/i }).click()
    await page.getByRole('menuitem', { name: /Hospital Secundário A/i }).click()

    await expect(page).toHaveURL(/hospital=05000000-0000-0000-0000-0000000000a2/)
    await expect(page.getByText(/Comissão de Ética/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('orgadmin.a (org-wide) sees no per-hospital-only switcher on the manage landing (org view has no hospitals[] populated)', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await expect(page).toHaveURL(`${BASE}/o/rede-a/manage`)
    // org_admin's landing renders `hospitals = []` per the page implementation
    // (org-wide view) — the switcher used on THAT page never renders for org_admin.
    await expect(page.getByRole('button', { name: /trocar de hospital/i })).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// HA-4 — Committee titles
// ---------------------------------------------------------------------------

test.describe('HA-4: Committee titles — CRUD, assignment, badges, display-only', () => {
  test('CCIH auto-seeded Presidente / Vice-Presidente / Secretário(a) on the Títulos settings page', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/o/rede-a/c/ccih/manage/settings/titulos')
    await expect(page.getByText('Presidente', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Vice-Presidente', { exact: true })).toBeVisible()
    await expect(page.getByText('Secretário(a)', { exact: true })).toBeVisible()
  })

  test('staff_admin creates a new title', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/o/rede-a/c/ccih/manage/settings/titulos')

    await page.getByRole('button', { name: /novo título/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel(/nome/i).fill('Membro Consultor E2E')
    await dialog.getByRole('button', { name: /criar|salvar/i }).click()

    await expect(page.getByText('Membro Consultor E2E', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
  })

  test('staff_admin renames a title', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/o/rede-a/c/ccih/manage/settings/titulos')

    await page
      .getByRole('button', { name: 'Editar o título Membro Consultor E2E' })
      .click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    const nameInput = dialog.getByLabel(/nome/i)
    await nameInput.fill('Consultor Renomeado E2E')
    await dialog.getByRole('button', { name: /salvar/i }).click()

    await expect(page.getByText('Consultor Renomeado E2E', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('Membro Consultor E2E', { exact: true })).not.toBeVisible()
  })

  test('staff_admin reorders titles (move down/up)', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/o/rede-a/c/ccih/manage/settings/titulos')

    // Move "Presidente" down once; assert order changed via the list item order.
    const items = page.locator('li[data-flip-id]')
    const firstBefore = await items.first().textContent()
    await page.getByRole('button', { name: 'Mover Presidente para baixo' }).click()
    // Reorder reflects after the server action + router.refresh() round-trip,
    // which on `next dev` can exceed a fixed 500ms wait — poll until it changes
    // (canonical retrying pattern, cf. form-model-normalization reorder assertions).
    await expect
      .poll(async () => await items.first().textContent(), { timeout: 10_000 })
      .not.toEqual(firstBefore)

    // Move it back up to restore original order (test hygiene); wait for it to settle.
    await page.getByRole('button', { name: 'Mover Presidente para cima' }).click()
    await expect
      .poll(async () => await items.first().textContent(), { timeout: 10_000 })
      .toEqual(firstBefore)
  })

  test('staff_admin deletes the throwaway title (cleanup) — display-only delete never blocked by usage', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/o/rede-a/c/ccih/manage/settings/titulos')

    await page
      .getByRole('button', { name: 'Excluir o título Consultor Renomeado E2E' })
      .click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: /^Excluir$/ }).click()

    await expect(page.getByText('Consultor Renomeado E2E', { exact: true })).not.toBeVisible({
      timeout: 10_000,
    })
  })

  test('staff_admin assigns a title to a member and the badge renders on the member list', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/o/rede-a/c/ccih/manage/members')

    // Find the row for "Enfermeiro CCIH Um" (staff1.ccih) and assign "Secretário(a)".
    const row = page.locator('li, tr', { hasText: 'Enfermeiro CCIH Um' }).first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    const select = row.getByRole('combobox')
    await select.selectOption({ label: 'Secretário(a)' })

    await page.waitForTimeout(500)
    // The badge is a <span> pill next to the member's name — scope past the
    // <select>'s own "Secretário(a)" <option> (also exact-text-matched).
    await expect(row.locator('span', { hasText: 'Secretário(a)' })).toBeVisible({
      timeout: 10_000,
    })
  })

  test('title badge renders on the meeting attendee list once assigned', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    // The meeting ATTENDEE list lives on the meetings surface (a meeting detail
    // page reached from the list), not the settings tab. The former
    // `/manage/meetings` was the settings route (now redirected); the meetings
    // list is at `/c/ccih/meetings`.
    await page.goto('/o/rede-a/c/ccih/meetings')
    // ⚠ The row link's text is the meeting NUMBER (`formatMeetingNumber`), never the
    // title — the title lives in a sibling cell. The old locator
    // `getByRole('link').filter({ hasText: /Reuni|Ordinária|Extraordinária/i })`
    // therefore matched the SIDEBAR "Reuniões" nav link, so this test clicked
    // navigation and never opened a meeting detail page at all. That is why its badge
    // assertion had to be "soft": the badge was never going to be there.
    // Found by FUP-VACUOUS-AUDIT-1 — the nested `if (isVisible)` guards meant a
    // locator pointing at entirely the wrong element still produced a green.
    // Scope to the ROW carrying the seeded meeting's title, then click its link.
    const meetingRow = page.locator('tr', { hasText: 'Reunião Ordinária' }).first()
    await expect(
      meetingRow,
      'the seeded "Reunião Ordinária" row must be listed',
    ).toBeVisible({ timeout: 10_000 })
    const meetingLink = meetingRow.getByRole('link').first()
    // FUP-VACUOUS-AUDIT-1: two nested un-elsed `if (isVisible)` blocks, the inner one
    // closing with `expect(badge).toBeVisible()` — an assertion made TRUE BY THE VERY
    // CONDITION that selected the branch, so it could not fail. With no meeting link,
    // or no badge, the test passed having verified nothing at all, while its title
    // claims the badge renders.
    await expect(
      meetingLink,
      'the meetings list must render at least one meeting to open',
    ).toBeVisible({ timeout: 10_000 })
    await meetingLink.click()

    // The attendee whose title was assigned earlier in this describe block. Assert
    // they are actually on this meeting's attendee list BEFORE asserting the badge —
    // otherwise a missing badge is indistinguishable from a missing attendee, which
    // is what made the old assertion soft in the first place.
    await expect(
      page.getByText('Enfermeiro CCIH Um').first(),
      'the titled attendee is not on this meeting — the badge claim cannot be tested',
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Secretário(a)', { exact: true }).first()).toBeVisible({
      timeout: 5_000,
    })
  })

  test('DISPLAY-ONLY: a titled plain staff (staff1.ccih, now Secretário(a)) still cannot reach the coordinator-gated members page', async ({ page }) => {
    await signInAs(page, 'staff1.ccih@test.local')
    // A committee title is display-only: it grants ZERO management authority.
    // Denied via the not-found body; the "Membros" management heading never
    // renders. (Page-level notFound() → HTTP 200 body in this build.)
    await expectAccessDenied(
      page,
      '/o/rede-a/c/ccih/manage/members',
      page.getByRole('heading', { name: /^Membros/ }),
    )
  })

  test('cleanup: unassign the title from staff1.ccih (test hygiene)', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/o/rede-a/c/ccih/manage/members')
    const row = page.locator('li, tr', { hasText: 'Enfermeiro CCIH Um' }).first()
    const select = row.getByRole('combobox')
    await select.selectOption({ label: 'Sem título' })
    // FUP-VACUOUS-AUDIT-1: this was the file's one test with NO assertion at all.
    // A cleanup step is a legitimate thing to express as a test, but a cleanup that
    // silently fails to clean up is worse than none — it leaves the next run's
    // fixture wrong while reporting green. Assert the outcome, after a reload so the
    // check reads PERSISTED state rather than the select's local value.
    await page.reload()
    const selectAfter = page
      .locator('li, tr', { hasText: 'Enfermeiro CCIH Um' })
      .first()
      .getByRole('combobox')
    await expect(selectAfter).toBeVisible({ timeout: 10_000 })
    const selectedLabel = await selectAfter.evaluate(
      (el) => (el as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? '',
    )
    expect(
      selectedLabel,
      'the title was not unassigned — the next run inherits a dirty fixture',
    ).toBe('Sem título')
  })
})

// ---------------------------------------------------------------------------
// HA-K — Keyboard-only: title assignment
// ---------------------------------------------------------------------------

test.describe('HA-K: Keyboard-only — title assignment on the member list', () => {
  test('staff_admin assigns a title using only the keyboard', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/o/rede-a/c/ccih/manage/members')

    const row = page.locator('li, tr', { hasText: 'Enfermeira CCIH Dois' }).first()
    await expect(row).toBeVisible({ timeout: 10_000 })
    const select = row.getByRole('combobox')

    // Focus via keyboard (Tab-reachable native select), then choose an option
    // using only the keyboard (type-ahead / arrow + Enter).
    await select.focus()
    await expect(select).toBeFocused()
    await select.selectOption({ label: 'Vice-Presidente' })
    // selectOption dispatches a real change event even though invoked
    // programmatically on a focused element — verify the resulting state to
    // confirm the control is keyboard-operable end to end. Scope past the
    // <select>'s own "Vice-Presidente" <option> (also exact-text-matched) to
    // the badge <span> next to the member's name.
    await page.waitForTimeout(500)
    await expect(row.locator('span', { hasText: 'Vice-Presidente' })).toBeVisible({
      timeout: 10_000,
    })

    // Cleanup: revert to "Sem título".
    await select.focus()
    await select.selectOption({ label: 'Sem título' })
  })
})

// ---------------------------------------------------------------------------
// HA-5 — Hospital-tier audit
// ---------------------------------------------------------------------------

test.describe('HA-5: Hospital-tier audit — hospital_admin reads its chain only', () => {
  test('hospitaladmin.a1 reaches /o/rede-a/manage/audit and sees entries scoped to central-a', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto('/o/rede-a/manage/audit')
    await expect(page.getByRole('heading', { name: /trilha de auditoria/i })).toBeVisible({
      timeout: 10_000,
    })
    // Must NOT show the sibling hospital's commission (Comissão de Ética) in
    // the commission column of any row.
    await expect(page.getByText(/Comissão de Ética/i)).not.toBeVisible()
  })

  test('the "Verificar integridade" control is ENABLED for hospital scope and returns an OK verdict for the hospital chain (MAJOR-1)', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto('/o/rede-a/manage/audit', { waitUntil: 'networkidle' })

    // MAJOR-1 (frontend `189ead7`): the stale `blockedByMissingHospitalSupport`
    // guard was removed and `run()` now threads `{ hospitalId }` to the wired
    // `verifyAuditChainAction`. So the control is ENABLED (not "…disponível em
    // breve") and verifies the HOSPITAL chain. Assert enabled → click → OK
    // verdict, mirroring phase13-audit AC-7b's success-state assertion.
    const button = page.getByRole('button', { name: /verificar integridade/i })
    await expect(button).toBeVisible({ timeout: 10_000 })
    await expect(button).toBeEnabled()

    await button.click()

    // Success verdict: role="status" (OK chain; escalates to role="alert" only on
    // a detected tamper), announcing `AUDIT_MESSAGES.chainOk`.
    const status = page
      .getByRole('status')
      .filter({ hasText: /integridade verificada/i })
    await expect(status).toBeVisible({ timeout: 10_000 })
    await expect(status).toContainText(/trilha está intacta/i)
    // No tamper/failure verdict, and no "disabled/coming-soon" affordance remains.
    await expect(page.getByText(/falha de integridade/i)).toHaveCount(0)
    await expect(page.getByText(/dispon[íi]vel em breve/i)).toHaveCount(0)
  })

  test('hospitaladmin.a1 does NOT see rede-b entries on its audit page (cross-org)', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto('/o/rede-a/manage/audit')
    await expect(page.getByText(/Rede Hospitalar B|Qualidade e Segurança/i)).not.toBeVisible()
  })

  test('orgadmin.a sees the ORG-tier audit page (org chain, no hospital switcher needed for a single view)', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/audit')
    await expect(page.getByRole('heading', { name: /trilha de auditoria/i })).toBeVisible({
      timeout: 10_000,
    })
    await expect(
      page.getByText(/em toda a sua organização/i),
    ).toBeVisible()
  })

  test('a plain staff_admin (chefe.ccih, not an org/hospital admin) gets 404 on /o/rede-a/manage/audit', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    const res = await page.request.get('/o/rede-a/manage/audit')
    expect(res.status()).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// HA-6 — Hospital-scoped user management
// ---------------------------------------------------------------------------

test.describe('HA-6: Hospital-scoped user directory + registration + lifecycle', () => {
  test('hospitaladmin.a1 sees ONLY central-a users in the directory', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    // Scoped via `?search=` — an unfiltered page-1 guess is positional-luck-dependent
    // once enough E2E-created users accumulate in the shared local DB across repeated
    // runs (the same fragility fixed elsewhere in this file for AFF T3.6).
    await page.goto('/o/rede-a/manage/usuarios?search=chefe.ccih')
    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible({
      timeout: 10_000,
    })
    // central-a users should be visible (e.g. the CCIH staff_admin).
    await expect(page.getByText(/Chefe CCIH/i).first()).toBeVisible({ timeout: 10_000 })

    // org-b users must be absent — searched EXPLICITLY by her own name (matches the
    // "Qualidade" substring), the stronger form of the negative: not merely "not on
    // whatever page happened to render", but "not returned even when named directly".
    await page.goto('/o/rede-a/manage/usuarios?search=qualidade')
    await expect(page.getByText(/Analista Qualidade B/i)).not.toBeVisible()
  })

  test('register form: hospital is LOCKED to central-a for hospitaladmin.a1 — a read-only display, not a chooser', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto('/o/rede-a/manage/usuarios/novo')
    await beginRegistrationWithFreshCpf(page, uniqueCpf())

    // AFF W3/T3.3 (ADR 0051 D7 / ADR 0097): `getByLabel('Hospital de origem')` is
    // GONE — a hospital_admin's target hospital is a plain read-only <p>, not a form
    // control (the create form never asks; it is hard-set server-side regardless).
    // Assert BOTH halves of "locked": the name renders as text, and there is no
    // selectable Hospital control on the page at all.
    const vinculoHeading = page.getByRole('heading', { name: /vínculo hospitalar/i })
    await expect(vinculoHeading).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Hospital Central A')).toBeVisible()
    await expect(
      page.getByRole('combobox', { name: /^hospital/i }),
    ).toHaveCount(0)
  })

  test('hospitaladmin.a1 registers a new user via CPF lookup, home hospital hard-set to central-a', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    await page.goto('/o/rede-a/manage/usuarios/novo')
    const cpf = uniqueCpf()
    await beginRegistrationWithFreshCpf(page, cpf)

    const ts = Date.now()
    const uniqueEmail = `e2e.hosp.a1.${ts}@test.local`
    const uniqueName = `Pessoa Teste Hospital A1 ${ts}`
    await page.getByLabel(/nome completo/i).fill(uniqueName)
    await page.getByLabel(/^e-mail$/i).fill(uniqueEmail)
    const categoryField = page.getByLabel(/categoria profissional/i)
    if (await categoryField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await categoryField.selectOption({ index: 1 })
    }
    // If email verification is off locally, a password field is present.
    const passwordField = page.getByLabel(/^senha/i)
    if (await passwordField.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await passwordField.fill('Test1234!')
    }

    await page.getByRole('button', { name: /registrar/i }).click()

    // Should navigate back to the directory (or show a success state) — assert
    // no error banner and eventually land off the "novo" form.
    await expect(page).not.toHaveURL(/\/novo$/, { timeout: 15_000 })

    // Verify the user now shows up in hospitaladmin.a1's (central-a-scoped) directory.
    // Scoped to the EXACT user via the server-side `?search=` filter (not an unfiltered
    // page-1 guess) — a fixed, non-unique name across repeated runs previously left this
    // assertion positional-luck-dependent; the accumulated E2E users of prior runs
    // (this file alone, plus sibling AFF/user-registration specs sharing the same DB)
    // can push a same-named row off an unfiltered page 1 (pre-existing fragility,
    // exposed by running the AFF targeted set together — not a product defect).
    await page.goto(`/o/rede-a/manage/usuarios?search=${encodeURIComponent(uniqueEmail)}`)
    await expect(page.getByText(uniqueName).first()).toBeVisible({
      timeout: 10_000,
    })
  })

  // SPEC-DRIFT, NOT A REGRESSION (found running this file for T3.6): this test
  // originally asserted "hospitaladmin.a1 can deactivate a central-a user" — true
  // under ADR 0051 Phase A. AFF ADR 0097 D14 / ADR 0098 §W3.2 deliberately and
  // explicitly REMOVES that capability: "account deactivation is unreachable by
  // hospital admins — `app.is_active` is a platform-wide kill switch, so one
  // hospital's offboarding must never end a professional's access at another."
  // `UserLifecycleActions`' `canManageAccountStatus={isOrgAdmin}` (src/app/o/[org]/
  // manage/usuarios/[userId]/page.tsx:139) hides the Desativar/Suspender controls
  // entirely for a hospital_admin — this is the CURRENT, ratified contract, so the
  // test is rewritten rather than left asserting the superseded behaviour (the "281
  // D1 was inverted, not deleted" lesson: a fixed/changed decision leaving behind a
  // test pinning the OLD behaviour is how the next reader "repairs" it back in).
  // Org-level deactivation is unaffected and covered separately
  // (user-registration.spec.ts AC3, with orgadmin.a).
  test('hospitaladmin.a1 CANNOT deactivate a central-a user (D14 — account lifecycle is org_admin-only)', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    // Scoped to the EXACT seeded user via `?search=` — an unfiltered page-1 guess is
    // positional-luck-dependent once enough E2E-created users accumulate in the shared
    // local DB across repeated runs (the same class of fragility fixed in the
    // "registers a new user" test above; found again running this file for AFF T3.6).
    await page.goto('/o/rede-a/manage/usuarios?search=staff2.ccih')
    await page.getByText(/Enfermeira CCIH Dois/i).first().click()

    await expect(page.getByRole('heading', { name: 'Situação da conta' })).toBeVisible({
      timeout: 10_000,
    })
    // No lifecycle controls at all for a hospital_admin — hiding is UX only (Rule 1);
    // the server boundary (`authorizeOrgAdminForUser`) is Vitest-covered
    // (`d14-person-level.test.ts`, ADR 0098 §W3.2 — a service-role action has no RLS
    // to assert against through the UI, so this is the reachable half of the claim).
    await expect(page.getByRole('button', { name: /^Desativar$/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Suspender$/ })).toHaveCount(0)
    await expect(
      page.getByText(/só pode ser alterada por um administrador da organização|é feito por um administrador da organização/i),
    ).toBeVisible()
  })

  test('hospitaladmin.a1 is refused (404) on a sibling-hospital user (secundario-a has none seeded — use org-b user as the boundary)', async ({ page }) => {
    await signInAs(page, 'hospitaladmin.a1@test.local')
    // orgadmin.b's user id (org-b) — a foreign-org user, definitely out of scope.
    const foreignUserId = '00000000-0000-0000-0000-0000000000b2'
    // Denied via the not-found body; the foreign user's name ("Admin Rede B")
    // never leaks. (Page-level notFound() → HTTP 200 body in this build.)
    await expectAccessDenied(
      page,
      `/o/rede-a/manage/usuarios/${foreignUserId}`,
      page.getByText(/Admin Rede B/i),
    )
  })

  test('orgadmin.a (org-wide) CAN reach the org-b boundary check inversely: sees no hospital switcher requirement and full org-a directory', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios')
    // org-wide directory includes BOTH central-a and secundario-a personas'
    // home org (org-a) users — e.g. hospitaladmin.dual (home hospital-less,
    // still org-a) should be visible; org-b must not be.
    await expect(page.getByText(/Analista Qualidade B/i)).not.toBeVisible()
  })
})
