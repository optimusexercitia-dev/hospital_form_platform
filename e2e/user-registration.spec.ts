import { test, expect } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"
import { uniqueCpf } from "./helpers/cpf"
import { pickDate } from './helpers/date-pickers'
import { svcSelect } from './helpers/service-role'

/**
 * User Registration & Identity Management
 *
 * Test contract: translates the plan's decided design
 * (~/.claude/plans/i-would-like-to-sorted-fog.md) into Playwright assertions.
 *
 *   AC1 — org_admin registers a user (name/email/category + INITIAL PASSWORD +
 *         optional credentials/hospital/matrícula/committees); in password mode
 *         (the default) the account is created ACTIVE immediately and the new
 *         user shows ATIVO in the directory.
 *   AC2 — password-mode activation: the just-registered user can SIGN IN
 *         immediately with the admin-set initial password (no invite email /
 *         /convite step by default). The invite-email flow only runs when the
 *         server is started with AUTH_EMAIL_VERIFICATION=on — that variant is
 *         kept as a test.skip below (server-env-gated, not per-test toggleable).
 *   AC3 — deactivate → signIn refuses with a pt-BR message; a mid-session user
 *         is redirected to /conta-inativa.
 *   AC4 — suspend with a future suspended_until → blocked; past suspended_until
 *         → auto-reinstated (active again).
 *   AC5 — email collision → clear pt-BR error, no absorb/overwrite.
 *   AC6 — committee assignment with selectable role; searchable + paged directory.
 *   AC7 — keyboard-only flow.
 *
 * Seeded personas (org rede-a, password Test1234!):
 *   orgadmin.a@test.local / admin@test.local — org_admin of rede-a
 *   novato.pendente@test.local   (d1) — pending
 *   ativo.registro@test.local    (d2) — active (CRM verified credential, CCIH staff)
 *   suspenso.temp@test.local     (d3) — suspended (suspended_until +30d, COREN credential, CCIH staff)
 *   desativado.conta@test.local  (d4) — deactivated (is_active=false)
 *
 * Run-uniqueness + full-suite order-independence: registered emails/names embed
 * a per-test token = workerIndex + module-load epoch + a monotonic counter (see
 * `uniqueToken`), so no two registrations collide even within the same
 * millisecond, across parallel workers, or across a shared-reset serial suite.
 * Every "appears in the directory" assertion is scoped to the EXACT user just
 * created (navigate to `?search=<email>`), never to page-1/totals — the full
 * suite does one reset up front, so predecessor specs (e.g. phase3 invites) leave
 * many rede-a users in the directory that would otherwise push a fresh user off
 * page 1 (this was the AC1/AC7 full-suite-contamination cause).
 */

const MAILPIT_API = 'http://127.0.0.1:54324/api/v1'

// Collision-proof token. `Date.now()` alone repeats under parallel workers and
// fast back-to-back calls; combine the worker index, a module-load epoch, and a
// monotonic counter so every token in the whole run is unique.
const RUN_EPOCH = Date.now()
let uniqueCounter = 0
function uniqueToken(): string {
  const worker = test.info().workerIndex
  uniqueCounter += 1
  return `${worker}-${RUN_EPOCH}-${uniqueCounter}`
}

async function signInAs(
  page: import('@playwright/test').Page,
  email: string,
  password = 'Test1234!',
  actAs?: string,
) {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  // ACT (ADR 0106) — optional 4th param, additive: threads to cachedSignIn's own
  // actAs seam for orgadmin.b@test.local (org_admin + staff_admin — 2 role types),
  // which otherwise lands on /selecionar-perfil (BUG-ACT-PICKER-SEED-1).
  await cachedSignIn(page, email, password, actAs)
}

/**
 * AFF W3/T3.1 (ADR 0097 D12) — `/usuarios/novo` no longer renders the create form on
 * load; it starts on the CPF step, and the create form (outcome A) appears only after
 * a lookup for that CPF returns nothing. Every caller in this file wants a brand-new
 * person, so a fresh `uniqueCpf()` always resolves outcome A. `getByRole('textbox',
 * { name: 'CPF' })`, not `getByLabel('CPF')` — the latter also matches the "Comece
 * pelo CPF" region's accessible name (two nodes, strict-mode violation).
 */
async function beginRegistrationWithFreshCpf(
  page: import('@playwright/test').Page,
  cpf: string,
) {
  await page.getByRole('textbox', { name: 'CPF' }).fill(cpf)
  await page.getByRole('button', { name: /buscar pessoa/i }).click()
  await expect(page.getByLabel('Nome completo')).toBeVisible({ timeout: 10_000 })
}

async function waitForMailpitMessage(
  toAddress: string,
  timeoutMs = 20_000,
): Promise<{ ID: string; Subject: string; To: { Address: string }[] } | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_API}/messages?limit=50`)
    if (!res.ok) break
    const body = (await res.json()) as {
      messages: { ID: string; Subject: string; To: { Address: string }[] }[]
    }
    const match = body.messages.find((m) =>
      m.To.some((t) => t.Address.toLowerCase() === toAddress.toLowerCase()),
    )
    if (match) return match
    await new Promise((r) => setTimeout(r, 800))
  }
  return null
}

/**
 * Extracts the invite/confirm link from a Mailpit message's HTML/text body and
 * normalizes its host to the test's own origin.
 *
 * Local Supabase builds email links off `site_url` (`http://127.0.0.1:3000` in
 * config.toml), but this suite runs against `baseURL` (`http://localhost:3000`).
 * `127.0.0.1` and `localhost` are DIFFERENT cookie origins, so if we followed the
 * raw `127.0.0.1` link, `/auth/confirm` would set the session cookie on
 * `127.0.0.1`, then the `/convite` page (served on `localhost`) would read
 * `localhost` cookies, find none, and `updatePassword` would fail with the
 * generic error — an environment/origin split, not an app bug. Rewriting the host
 * to match `baseURL` keeps the whole activation flow on ONE origin so the auth
 * cookie is visible where the password is set. (In real deployment `site_url` and
 * the app origin are the same host, so this split does not occur.)
 */
async function extractInviteLink(messageId: string): Promise<string | null> {
  const res = await fetch(`${MAILPIT_API}/message/${messageId}`)
  if (!res.ok) return null
  const body = (await res.json()) as { HTML?: string; Text?: string }
  const source = body.HTML ?? body.Text ?? ''
  const match = source.match(/https?:\/\/[^\s"'<>]+/g)
  if (!match) return null
  // Prefer the confirm link over any other incidental URL.
  const confirmLink = match.find((u) => u.includes('/auth/confirm') || u.includes('token'))
  const chosen = confirmLink ?? match[0]
  // Normalize the app host to the test origin (127.0.0.1 → localhost), leaving
  // the query string (token_hash/type) untouched.
  return chosen.replace('127.0.0.1:3000', 'localhost:3000')
}

test.describe('AC1 — org_admin registers a user; appears ATIVO in the directory (password mode)', () => {
  test('registers a user with password + category + credential + hospital + committee; shows active', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios/novo')
    await page.waitForURL('**/o/rede-a/manage/usuarios/novo', { timeout: 10_000 })
    await beginRegistrationWithFreshCpf(page, uniqueCpf())

    const token = uniqueToken()
    const email = `registro.${token}@test.local`
    const fullName = `Pessoa Registrada ${token}`

    await page.getByLabel('Nome completo').fill(fullName)
    await page.getByLabel('E-mail').fill(email)
    // Password mode (default): "Senha inicial" is required; the account is created
    // ACTIVE (no invite/pending step).
    await page.getByLabel('Senha inicial').fill('Test1234!')
    await page.getByLabel('Categoria profissional').selectOption({ label: 'Médico(a)' }).catch(async () => {
      // Fall back to selecting the first non-placeholder option if the exact
      // pt-BR label differs from what's seeded.
      const select = page.getByLabel('Categoria profissional')
      const options = await select.locator('option').all()
      if (options.length > 1) {
        const value = await options[1].getAttribute('value')
        if (value) await select.selectOption(value)
      }
    })

    // Optional: fill the professional credential. Single-registry redesign:
    // the trio of fields (UF / órgão emissor / número) is ALWAYS inline under
    // "Registros profissionais" — there is no "Adicionar registro
    // profissional" reveal button nor an "Adicionar credencial" commit button
    // anymore; the draft bubbles up automatically once the trio is complete.
    await page.getByLabel('Estado (UF)').fill('SP')
    await page.getByLabel('Órgão emissor').fill('CRM')
    await page.getByLabel('Número de registro').fill(token)

    // AFF2 F3 (ADR 0133 D6-D8): step 1 ("Dados pessoais") no longer submits directly.
    // This test wants no hospital, so step 2 ("Vínculo hospitalar") is walked
    // untouched (skippable, no required fields) straight to step 3 ("Comissões"),
    // where the committee assignment below is unchanged — `CommitteeRoleAssigner`'s
    // `collect` mode renders the identical "Comissão"/"Papel"/"Adicionar comissão"
    // controls, only on a later step now.
    const continueButton = page.getByRole('button', { name: 'Continuar' })
    await continueButton.click()
    await continueButton.click()

    // Optional: assign a committee with a role. Commit button is now
    // "Adicionar comissão" (FIX-1).
    const committeeSelect = page.getByLabel('Comissão');
    await committeeSelect.selectOption({ label: 'Comissão de Farmácia e Terapêutica' })
    await page.getByLabel('Papel').selectOption('staff_admin')
    await page.getByRole('button', { name: /adicionar comissão/i }).click()

    await page.getByRole('button', { name: /registrar pessoa/i }).click()

    // AFF2 F3: a successful registerUser() now redirects straight to the created
    // person's own profile page, not the bare directory. ⚠ Must positively match a
    // UUID — the pre-submit URL is already "/usuarios/novo", which would trivially
    // satisfy a looser `[^/]+$` pattern with no navigation having happened at all.
    await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/i, { timeout: 15_000 })

    // The new user must appear, ATIVO (password mode → created active, not
    // pending). Scope to the EXACT user via the server-side directory filter
    // (?search=<email>) so predecessor specs that fill the rede-a directory (and
    // push a fresh user off page 1 in the shared full-suite reset) can't hide it.
    // Assert on the filtered card, not totals.
    await page.goto(`/o/rede-a/manage/usuarios?search=${encodeURIComponent(email)}`)
    const card = page.locator('li').filter({ hasText: fullName })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await expect(card.getByText('Ativo', { exact: true })).toBeVisible()

    // Open the per-user page and confirm the committee/role landed. Scope the role
    // label to the assignment row (the <li> holding the commission name), since the
    // role word also appears in the NSP nav link and the role <option> — assert on the
    // row's own pill.
    //
    // ⚠ SCOPED TO THE "Comissões" CARD as well as the row. The redesigned profile page
    // (`2f6b0635`) added a "Histórico da conta" timeline built from the same audit rows
    // that granted this seat, and its event details read "… na Comissão de Farmácia e
    // Terapêutica, por …" — so a page-wide `locator('li')` filter now matches the
    // membership row AND its own audit event. Both are `<li>`; only one is the seat.
    // Scoping to the card is also what keeps the assertion HONEST: an audit line saying
    // a role was granted is not evidence the membership still exists.
    await card.click()
    await page.waitForURL(/\/usuarios\/[^/]+$/, { timeout: 10_000 })
    const assignmentRow = page
      .getByRole('region', { name: 'Comissões' })
      .locator('li')
      .filter({ hasText: 'Comissão de Farmácia e Terapêutica' })
    await expect(assignmentRow).toBeVisible()
    // ⚠ The pill's wording changed with the redesign: the profile page now renders
    // `committeeRoleLabel` ("Coordenador(a)"), where the pre-redesign panel wrote
    // "Coordenação". The seat asserted is the same one; only the label moved.
    await expect(assignmentRow.getByText('Coordenador(a)', { exact: true })).toBeVisible()
    // Email renders in both the page header and the Perfil section — assert the
    // header instance (first) is present.
    await expect(page.getByText(email).first()).toBeVisible()
  })
})

test.describe('AC2 — password-mode activation: registered user can sign in immediately', () => {
  test('a freshly-registered user can sign in with the admin-set initial password', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios/novo')
    await page.waitForURL('**/o/rede-a/manage/usuarios/novo', { timeout: 10_000 })
    await beginRegistrationWithFreshCpf(page, uniqueCpf())

    const token = uniqueToken()
    const email = `ativar.${token}@test.local`
    const fullName = `Pessoa Ativar ${token}`
    const initialPassword = 'Inicial@123'

    await page.getByLabel('Nome completo').fill(fullName)
    await page.getByLabel('E-mail').fill(email)
    // Password mode (default): the admin sets the initial password; the account is
    // created ACTIVE, so the person can sign in right away with no invite step.
    await page.getByLabel('Senha inicial').fill(initialPassword)
    const categorySelect = page.getByLabel('Categoria profissional')
    const opts = await categorySelect.locator('option').all()
    if (opts.length > 1) {
      const value = await opts[1].getAttribute('value')
      if (value) await categorySelect.selectOption(value)
    }
    // AFF2 F3 (ADR 0133 D6-D8): step 1 no longer submits directly — walk the two
    // skippable steps (Vínculo hospitalar, Comissões) untouched; this test needs
    // neither.
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: /registrar pessoa/i }).click()
    // ⚠ Must positively match a UUID — the pre-submit URL is already
    // "/usuarios/novo", which would trivially satisfy a looser `[^/]+$` pattern
    // with no navigation having happened at all.
    await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/i, { timeout: 15_000 })

    // The person can sign in IMMEDIATELY with the admin-set password — no invite
    // email / /convite set-password round-trip.
    await page.context().clearCookies()
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(email)
    await page.locator('input[name="password"]').fill(initialPassword)
    await page.getByRole('button', { name: /entrar/i }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })

    // The directory must show this user as ACTIVE (created active in password mode).
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto(`/o/rede-a/manage/usuarios?search=${encodeURIComponent(email)}`)
    const card = page.locator('li').filter({ hasText: fullName })
    await expect(card.getByText('Ativo', { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  // Invite-mode activation (Mailpit → /auth/confirm → /convite set-password →
  // active) only runs when the dev server is started with AUTH_EMAIL_VERIFICATION=on.
  // That is a SERVER env, not per-test toggleable, and the default suite does not
  // set it, so the register form shows no "Senha inicial" field and no invite email
  // is sent. Kept (not deleted) so the coverage is recoverable: run the dev server
  // with AUTH_EMAIL_VERIFICATION=on to exercise it.
  test.skip('invite-mode: a freshly-registered user activates via the invite link and can sign in', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios/novo')
    await page.waitForURL('**/o/rede-a/manage/usuarios/novo', { timeout: 10_000 })
    await beginRegistrationWithFreshCpf(page, uniqueCpf())

    const token = uniqueToken()
    const email = `ativar.invite.${token}@test.local`
    const fullName = `Pessoa Ativar Invite ${token}`

    await page.getByLabel('Nome completo').fill(fullName)
    await page.getByLabel('E-mail').fill(email)
    const categorySelect = page.getByLabel('Categoria profissional')
    const opts = await categorySelect.locator('option').all()
    if (opts.length > 1) {
      const value = await opts[1].getAttribute('value')
      if (value) await categorySelect.selectOption(value)
    }
    // AFF2 F3 (ADR 0133 D6-D8): step 1 no longer submits directly — walk the two
    // skippable steps untouched; this test needs neither.
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: /registrar pessoa/i }).click()
    // ⚠ Must positively match a UUID — see the sibling non-skipped AC2 test's
    // comment on why a bare `[^/]+$` is unsafe from the "/usuarios/novo" form.
    await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/i, { timeout: 15_000 })

    // Fetch the invite email and follow its confirm link.
    const msg = await waitForMailpitMessage(email)
    expect(msg).not.toBeNull()
    const link = await extractInviteLink(msg!.ID)
    expect(link).not.toBeNull()

    await page.context().clearCookies()
    await page.goto(link!)

    // Should land on the /convite activation page (verify + set password).
    await page.waitForURL('**/convite**', { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /ativar sua conta/i })).toBeVisible()

    const newPassword = 'NovaSenh@123'
    await page.getByLabel('Nova senha', { exact: true }).fill(newPassword)
    await page.getByLabel('Confirme a nova senha').fill(newPassword)
    await page.getByRole('button', { name: /ativar conta/i }).click()

    await page.waitForURL((u) => !u.pathname.startsWith('/convite'), { timeout: 15_000 })

    await page.context().clearCookies()
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(email)
    await page.locator('input[name="password"]').fill(newPassword)
    await page.getByRole('button', { name: /entrar/i }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })

    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto(`/o/rede-a/manage/usuarios?search=${encodeURIComponent(email)}`)
    const card = page.locator('li').filter({ hasText: fullName })
    await expect(card.getByText('Ativo', { exact: true })).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('AC3 — deactivation enforcement', () => {
  test('signIn refuses a deactivated account with a pt-BR message', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('desativado.conta@test.local')
    await page.locator('input[name="password"]').fill('Test1234!')
    await page.getByRole('button', { name: /entrar/i }).click()

    // Must NOT navigate away from /login; must show the pt-BR inactive message.
    await expect(page.getByText(/suspensa\/desativada|conta está suspensa/i)).toBeVisible({
      timeout: 10_000,
    })
    await expect(page).toHaveURL(/\/login/)
  })

  test('org_admin deactivates an active user; that user is blocked mid-session and next sign-in redirects to /conta-inativa', async ({
    browser,
  }) => {
    // Register a fresh active-enough user via activation is expensive; instead
    // exercise the mid-session path on a freshly ACTIVATED user in this same
    // spec run is not guaranteed ordering-safe, so use two browser contexts:
    // one holds the target user's session (started BEFORE deactivation), the
    // other is the org_admin doing the deactivating.
    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()
    await signInAs(adminPage, 'orgadmin.a@test.local')

    // Reactivate ativo.registro@test.local first (defensive — in case a
    // previous run left it suspended) then use it as the mid-session target.
    await adminPage.goto('/o/rede-a/manage/usuarios?search=ativo.registro')
    const targetCard = adminPage.locator('li').filter({ hasText: 'Ativo Registrado' })
    await expect(targetCard).toBeVisible({ timeout: 10_000 })
    await targetCard.click()
    await adminPage.waitForURL(/\/usuarios\/[^/]+$/, { timeout: 10_000 })
    const userUrl = adminPage.url()

    // Start the target user's session in a second context BEFORE deactivating.
    const userContext = await browser.newContext()
    const userPage = await userContext.newPage()
    await signInAs(userPage, 'ativo.registro@test.local')
    await userPage.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })

    // Now the org_admin deactivates.
    const deactivateBtn = adminPage.getByRole('button', { name: /^desativar$/i })
    await deactivateBtn.click()
    const dialog = adminPage.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await dialog.getByRole('button', { name: /^desativar$/i }).click()
    await expect(dialog).not.toBeVisible({ timeout: 10_000 })
    await expect(adminPage.getByText('Desativado', { exact: true })).toBeVisible({ timeout: 10_000 })

    // The mid-session user, on their next navigation, is redirected to /conta-inativa.
    await userPage.goto('/')
    await expect(userPage).toHaveURL(/\/conta-inativa/, { timeout: 15_000 })
    await expect(userPage.getByRole('heading', { name: /conta inativa/i })).toBeVisible()

    // Reactivate for hygiene (other specs/re-runs rely on ativo.registro being active).
    await adminPage.goto(userUrl)
    await adminPage.getByRole('button', { name: /^reativar$/i }).click()
    const reactivateDialog = adminPage.getByRole('alertdialog')
    await expect(reactivateDialog).toBeVisible({ timeout: 5_000 })
    await reactivateDialog.getByRole('button', { name: /^reativar$/i }).click()
    await expect(reactivateDialog).not.toBeVisible({ timeout: 10_000 })

    await adminContext.close()
    await userContext.close()
  })
})

test.describe('AC4 — suspension: blocked while suspended_until is future; auto-reinstated once past', () => {
  test('signIn refuses the seeded suspended persona (suspended_until +30d)', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill('suspenso.temp@test.local')
    await page.locator('input[name="password"]').fill('Test1234!')
    await page.getByRole('button', { name: /entrar/i }).click()

    await expect(page.getByText(/suspensa\/desativada|conta está suspensa/i)).toBeVisible({
      timeout: 10_000,
    })
    await expect(page).toHaveURL(/\/login/)
  })

  test('org_admin suspends a user with a past date; the user is auto-reinstated (active) and can sign in', async ({
    page,
    request,
  }) => {
    await signInAs(page, 'orgadmin.a@test.local')

    // Use a fresh, previously-untouched active persona so this test is
    // independent of AC3's mid-session deactivate/reactivate flow. We reuse
    // ativo.registro but suspend-then-verify-active is destructive to that
    // shared fixture's status only transiently (auto-reinstate restores it).
    await page.goto('/o/rede-a/manage/usuarios?search=ativo.registro')
    const card = page.locator('li').filter({ hasText: 'Ativo Registrado' })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.click()
    await page.waitForURL(/\/usuarios\/[^/]+$/, { timeout: 10_000 })

    // Trigger stays "Suspender"; the dialog confirm is now "Confirmar
    // suspensão" (FIX-1), so /suspender/i on the trigger is unambiguous.
    await page.getByRole('button', { name: /^suspender$/i }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // FUP-AC4-SUSPEND-TEST-SUSPENDS-NOBODY: `input[type="date"],
    // input#suspend-until` matched nothing — DatePicker never renders a
    // native date input, its hidden input only exists when a `name` prop is
    // passed (this call site passes none), and the id it does carry sits on
    // the trigger <button>, not an <input>. The fill silently no-op'd, so
    // `suspendUser` ran with an empty value against an already-active user
    // and every downstream assertion was satisfied by a status that never
    // changed (measured before this fix: suspended_until stayed NULL).
    //
    // Drive the real control via the shared structural helper instead — it
    // locates by `button[aria-haspopup="dialog"]`, never by name, so it is
    // unaffected by F0's accessible-name change. This DatePicker instance has
    // no min/max, so every date is clickable including past ones (the old
    // comment claiming otherwise was itself measured false). `monthsBack: 1`
    // lands a full month back — unambiguously past on any run date, with
    // enough margin that the confirmed suspended_until display-timezone
    // defect (banner formats with no explicit timeZone) can never flip this
    // test's past/future boundary.
    await pickDate(dialog, page, { monthsBack: 1 })

    await dialog.getByRole('button', { name: /confirmar suspensão/i }).click()
    // The dialog closes on BOTH success and failure paths (`setOpenDialog(null)`
    // fires before the outcome is known) — not evidence of success by itself.
    await expect(dialog).not.toBeVisible({ timeout: 10_000 })

    // Suspension took effect: assert the WRITE on the table, not a screen
    // string — this is exactly the fact the original bug got wrong.
    const rows = await svcSelect<{ is_active: boolean; suspended_until: string | null }>(
      request,
      'profiles',
      'email=eq.ativo.registro@test.local&select=is_active,suspended_until',
    )
    expect(rows, 'exactly one profiles row for ativo.registro@test.local').toHaveLength(1)
    expect(
      rows[0].suspended_until,
      'suspended_until must have been written by the confirm, not left NULL',
    ).not.toBeNull()
    expect(new Date(rows[0].suspended_until as string).getTime()).toBeLessThanOrEqual(Date.now())

    // Auto-reinstatement works: assert the suspension-specific surface, not
    // the bare 'Ativo' text — FUP-AC4 measured that string satisfied by an
    // unrelated element. (Correcting the FUP's own attribution: for this
    // persona specifically it's the identity band's UserStatusBadge, not the
    // AffiliationStatusBadge the FUP named — this persona seeds with zero
    // hospital_affiliations rows. Same defect, different culprit component.)
    // AccountSituationBanner's copy is specific to the derived state.
    await expect(page.getByText(/situação:\s*ativa/i)).toBeVisible({ timeout: 10_000 })

    // Confirm the user can still sign in (not blocked).
    await signInAs(page, 'ativo.registro@test.local')
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 })
  })

  test('DatePicker trigger accessible name folds in label and value after a pick (F0 regression guard)', async ({
    page,
  }) => {
    // F0 (commit 5e7288b5) fixed a DatePicker accessible-name defect: the
    // trigger's name used to be JUST its label — the label-for relationship
    // wins over the button's own contents (where the picked value renders),
    // displacing it entirely (measured via Chromium CDP
    // Accessibility.getPartialAXTree; FUP-DATEPICKER-VALUE-ABSENT-FROM-ACCESSIBLE-NAME,
    // independently corroborated by a parallel session's own CDP probe on a
    // different call-site bucket).
    //
    // This discriminates fixed-from-broken by a BEFORE/AFTER transition
    // WITHIN THIS RUN: before picking, the name must not contain a date;
    // after picking the SAME control, it must contain both the label and a
    // date. On a pre-F0 build the AFTER check fails by construction — the
    // label mechanism displaces the value regardless of whether one was ever
    // picked. That is observed to discriminate by this within-run
    // transition, NOT by an actual pre-F0 build observation: date-picker.tsx
    // is never reverted (editing application code is out of tester scope,
    // and that file must stay byte-identical with a parallel branch that
    // cherry-picked it).
    //
    // Composition, not a hardcoded string: label and value are asserted
    // SEPARATELY, both unanchored; the value is checked as a generic
    // dd/mm/yyyy SHAPE, never the specific day picked or the concatenated
    // whole.
    //
    // Read-only: Escapes out without confirming, so it never writes
    // suspended_until — the picked value only ever lives in unsaved dialog
    // state.
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios?search=ativo.registro')
    const card = page.locator('li').filter({ hasText: 'Ativo Registrado' })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.click()
    await page.waitForURL(/\/usuarios\/[^/]+$/, { timeout: 10_000 })

    await page.getByRole('button', { name: /^suspender$/i }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    const trigger = dialog.locator('button[aria-haspopup="dialog"]').first()

    await expect(trigger).not.toHaveAccessibleName(/\d{1,2}\/\d{1,2}\/\d{4}/)

    await pickDate(dialog, page, { monthsBack: 1 })

    await expect(trigger).toHaveAccessibleName(/suspenso até/i)
    await expect(trigger).toHaveAccessibleName(/\d{1,2}\/\d{1,2}\/\d{4}/)

    // Dismiss without confirming. The calendar popover is a nested
    // dismissable layer; an Escape pressed while it is still unmounting can
    // be consumed by IT rather than the AlertDialog (observed flaky with a
    // single press), so wait for it to be gone first and fall back to a
    // second Escape if the dialog is still up.
    await expect(page.getByRole('grid')).not.toBeVisible({ timeout: 5_000 }).catch(() => {})
    await page.keyboard.press('Escape')
    if (await dialog.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape')
    }
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })
  })
})

test.describe('AC5 — email collision blocks with a clear pt-BR error', () => {
  test('registering an existing email is blocked, no absorb/overwrite', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios/novo')
    await page.waitForURL('**/o/rede-a/manage/usuarios/novo', { timeout: 10_000 })
    // A FRESH, never-used CPF — the collision under test is on EMAIL, not CPF. The CPF
    // lookup step (D12) resolves "not found" (this CPF belongs to nobody), landing on
    // the create form; the pre-existing EMAIL collision block then fires at submit,
    // unchanged (ADR 0097 D8 — registerUser's hard email-collision backstop).
    await beginRegistrationWithFreshCpf(page, uniqueCpf())

    await page.getByLabel('Nome completo').fill('Colisão De Teste')
    await page.getByLabel('E-mail').fill('ativo.registro@test.local') // already exists (d2)
    // Password mode: fill the required initial password so submission reaches the
    // server-side collision check (the form is noValidate, but mirror the real flow).
    await page.getByLabel('Senha inicial').fill('Test1234!')
    const categorySelect = page.getByLabel('Categoria profissional')
    const opts = await categorySelect.locator('option').all()
    if (opts.length > 1) {
      const value = await opts[1].getAttribute('value')
      if (value) await categorySelect.selectOption(value)
    }
    // AFF2 F3 (ADR 0133 D6-D8): step 1 no longer submits directly — walk the two
    // skippable steps untouched; the email collision this test wants fires at the
    // FINAL submit (step 3) regardless of hospital/committee state.
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.getByRole('button', { name: /registrar pessoa/i }).click()

    // Must stay on the register page with a clear pt-BR error — no navigation,
    // no silent overwrite of the existing user. FIX-1 surfaces the block via a
    // distinct assertive role="alert" region (not the ambiguous label text);
    // the specific collision message renders as the email field error.
    await expect(page).toHaveURL(/\/usuarios\/novo/)
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByText(/este e-mail já está cadastrado/i),
    ).toBeVisible({ timeout: 10_000 })

    // The existing user's name must remain unchanged (no absorb).
    await page.goto('/o/rede-a/manage/usuarios?search=ativo.registro')
    await expect(page.getByText('Ativo Registrado')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Colisão De Teste')).not.toBeVisible()
  })
})

test.describe('AC6 — committee assignment with role; searchable + paged directory', () => {
  test('directory search filters by name/email; pagination reflects total', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios')
    await page.waitForURL('**/o/rede-a/manage/usuarios', { timeout: 10_000 })

    // AFF2 Amdt 2 r4: the label now says only what the query searches (name/email —
    // never "categoria", which was never actually searched).
    await page.getByLabel('Buscar por nome ou e-mail').fill('novato.pendente')
    await page.getByRole('button', { name: /^buscar$/i }).click()
    await page.waitForURL(/search=novato/, { timeout: 10_000 })

    await expect(page.getByText('Novato Pendente')).toBeVisible({ timeout: 10_000 })
    // Other seeded personas should be filtered out.
    await expect(page.getByText('Ativo Registrado')).not.toBeVisible()
    await expect(page.getByText('Suspenso Temporário')).not.toBeVisible()
  })

  test('per-user page: assign a committee with staff role, then remove it', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios?search=novato.pendente')
    const card = page.locator('li').filter({ hasText: 'Novato Pendente' })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.click()
    await page.waitForURL(/\/usuarios\/[^/]+$/, { timeout: 10_000 })

    // The assignment form is dialog 3d now (`2f6b0635`) — opened from the "Comissões"
    // card, portaled to <body>, and submitted with a real `type="submit"` CTA.
    const comissoes = page.getByRole('region', { name: 'Comissões' })
    await comissoes.getByRole('button', { name: 'Adicionar a uma comissão' }).click()
    const addDialog = page.getByRole('dialog', { name: 'Adicionar a uma comissão' })
    await expect(addDialog).toBeVisible({ timeout: 10_000 })

    // ⚠ SELECTED BY VALUE, resolved from the option's own text. The options now read
    // "<Comissão> — <Hospital>", so the old exact-label match would break on any
    // hospital rename while telling us nothing about the seat under test.
    // `exact` — `getByLabel` is a case-insensitive SUBSTRING match, and both role
    // choice-cards describe themselves as "… da comissão.", so the loose form resolves
    // to the select plus both radios.
    const commissionSelect = addDialog.getByLabel('Comissão', { exact: true })
    const ccihOption = commissionSelect.locator('option', {
      hasText: 'Comissão de Controle de Infecção Hospitalar',
    })
    await expect(ccihOption).toHaveCount(1)
    const ccihValue = await ccihOption.getAttribute('value')
    expect(ccihValue, 'the CCIH option must carry a commission id').toBeTruthy()
    await commissionSelect.selectOption(ccihValue as string)

    // "Papel" is a real radio group now, not a <select>. Drive it as one — and drive it
    // BOTH WAYS: "Membro" is the default, so merely reading it back would pass on a
    // picker wired to nothing. Moving to Coordenador(a) and back is what proves the
    // control moves the value that then gets submitted as `staff`.
    //
    // ⚠ NOT `check()`. The inputs are `sr-only` and each sits beside the decorative
    // `aria-hidden` dot that paints the radio, so Playwright's hit test lands on the
    // span and the click is refused forever. That is not a defect — nobody operates
    // this control by aiming at a 1px input. The two paths a person actually has are
    // the CARD (which is the `<label>`) and the ARROW KEYS (which is what makes a
    // native radio group worth using at all, per `role-choice-cards.tsx`), so those are
    // the two paths asserted.
    const membro = addDialog.getByRole('radio', { name: /^Membro/ })
    const coordenador = addDialog.getByRole('radio', { name: /^Coordenador\(a\)/ })
    await expect(membro).toBeChecked()

    // Pointer path — the choice-card is the label, so clicking its title selects it.
    await addDialog.getByText('Coordenador(a)', { exact: true }).click()
    await expect(coordenador).toBeChecked()
    await expect(membro).not.toBeChecked()

    // Keyboard path — arrow keys move the selection within the group, the affordance a
    // set of click-handled <div>s would silently not have.
    await coordenador.focus()
    await expect(coordenador).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(membro).toBeChecked()
    await expect(coordenador).not.toBeChecked()

    await addDialog.getByRole('button', { name: 'Adicionar à comissão' }).click()
    await expect(addDialog).not.toBeVisible({ timeout: 10_000 })

    // Scope the row to the "Comissões" card: the page's "Histórico da conta" timeline
    // now carries the same commission name inside its own <li>, so an unscoped filter
    // matches the seat AND the audit line that recorded it — and only the seat is the
    // thing this test claims to have created.
    const committeeRow = comissoes
      .locator('li')
      .filter({ hasText: 'Comissão de Controle de Infecção Hospitalar' })
    await expect(committeeRow).toBeVisible({ timeout: 10_000 })
    await expect(committeeRow.getByText('Membro', { exact: true })).toBeVisible()

    // NEW SURFACE (redesign 2a): the "Histórico da conta" timeline must record the
    // grant that was just made. Architecture Rule 11 says every mutation emits an audit
    // row; this is the first assertion that the row also REACHES the admin looking at
    // the person, which is the whole point of putting a trail on the profile.
    //
    // Asserted against a seat created seconds ago by this very test rather than against
    // seeded history — a timeline that renders only pre-existing rows would satisfy a
    // "card is present" check while being disconnected from live writes.
    await page.reload()
    const historico = page.getByRole('region', { name: 'Histórico da conta' })
    const grantEvent = historico
      .locator('li')
      .filter({ hasText: 'Comissão de Controle de Infecção Hospitalar' })
      .first()
    await expect(grantEvent).toBeVisible({ timeout: 10_000 })
    // Title + detail together: WHAT changed, and WHERE. `platformRoleLabel` names the
    // seat ("Membro de comissão"), which is a different string from the row pill above
    // ("Membro") on purpose — asserting both is what keeps the two surfaces from
    // silently converging on one label source.
    await expect(grantEvent).toContainText('Membro de comissão')
    await expect(grantEvent).toContainText('na Comissão de Controle de Infecção Hospitalar')

    // Remove it again (AlertDialog confirm).
    await committeeRow
      .getByRole('button', { name: 'Remover de Comissão de Controle de Infecção Hospitalar' })
      .click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await dialog.getByRole('button', { name: /^remover$/i }).click()
    await expect(dialog).not.toBeVisible({ timeout: 10_000 })
    await expect(committeeRow).not.toBeVisible({ timeout: 10_000 })
  })
})

test.describe('AC7 — keyboard-only flow', () => {
  test('org_admin registers a user using only the keyboard', async ({ page }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios/novo')
    await page.waitForURL('**/o/rede-a/manage/usuarios/novo', { timeout: 10_000 })

    // Keyboard-only through the CPF step (D12's identifier-first flow) FIRST: the
    // create form does not exist until a lookup resolves "not found". Same
    // hydration-race guard as the name field below (page.focus() is not
    // auto-waiting — it races RSC streaming and can silently no-op).
    const cpfInput = page.getByRole('textbox', { name: 'CPF' })
    await expect(cpfInput).toBeEditable({ timeout: 10_000 })
    await expect(async () => {
      await cpfInput.focus()
      await expect(cpfInput).toBeFocused({ timeout: 1_000 })
    }).toPass({ timeout: 10_000 })
    await page.keyboard.type(uniqueCpf())
    const buscarButton = page.getByRole('button', { name: /buscar pessoa/i })
    await buscarButton.focus()
    await expect(buscarButton).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Nome completo')).toBeVisible({ timeout: 10_000 })

    const token = uniqueToken()
    const email = `teclado.${token}@test.local`
    const fullName = `Teclado Registro ${token}`

    // Keyboard-only: focus each control with the keyboard and enter data with
    // the keyboard. Name → Tab → E-mail (the two are DOM-adjacent).
    // The register form is a client component; wait for it to be editable
    // (hydrated) before focusing, else focus() can land before hydration and
    // read back as "inactive". Retry the focus assertion to absorb that race.
    const nameInput = page.getByLabel('Nome completo')
    await expect(nameInput).toBeEditable({ timeout: 10_000 })
    await expect(async () => {
      await nameInput.focus()
      await expect(nameInput).toBeFocused({ timeout: 1_000 })
    }).toPass({ timeout: 10_000 })
    await page.keyboard.type(fullName)

    await page.keyboard.press('Tab')
    const emailInput = page.getByLabel('E-mail')
    await expect(emailInput).toBeFocused()
    await page.keyboard.type(email)

    // Password mode: the next control after E-mail is the required "Senha inicial"
    // field (DOM-adjacent). Tab to it and type via the keyboard.
    await page.keyboard.press('Tab')
    const passwordInput = page.getByLabel('Senha inicial')
    await expect(passwordInput).toBeFocused()
    await page.keyboard.type('Test1234!')

    // Category is the required native <select>. Assert it is keyboard-focusable
    // (the a11y contract), then select an option. A native <select>'s option
    // menu is a browser-native popup that headless Chromium does not drive
    // reliably via ArrowDown, so we choose the option with selectOption — a
    // native select is inherently keyboard-operable by a real user; the flaky
    // part is only the headless popup, not the accessibility of the control.
    const categorySelect = page.getByLabel('Categoria profissional')
    await categorySelect.focus()
    await expect(categorySelect).toBeFocused()
    const catOpts = await categorySelect.locator('option').all()
    const firstReal = await catOpts[1].getAttribute('value')
    if (firstReal) await categorySelect.selectOption(firstReal)
    await expect(categorySelect).not.toHaveValue('')

    // AFF2 F3 (ADR 0133 D6-D8): step 1 no longer submits directly — walk the two
    // skippable steps via keyboard (focus + Enter) before the final submit. Retry
    // the focus assertion (the established pattern above): `.focus()` is not
    // auto-waiting and each step's heading swaps in via a fresh React render.
    const continueButton1 = page.getByRole('button', { name: 'Continuar' })
    await expect(async () => {
      await continueButton1.focus()
      await expect(continueButton1).toBeFocused({ timeout: 1_000 })
    }).toPass({ timeout: 10_000 })
    await page.keyboard.press('Enter')

    const continueButton2 = page.getByRole('button', { name: 'Continuar' })
    await expect(async () => {
      await continueButton2.focus()
      await expect(continueButton2).toBeFocused({ timeout: 1_000 })
    }).toPass({ timeout: 10_000 })
    await page.keyboard.press('Enter')

    // Submit via keyboard: focus the submit button and press Enter.
    const submitButton = page.getByRole('button', { name: /registrar pessoa/i })
    await submitButton.focus()
    await expect(submitButton).toBeFocused()
    await page.keyboard.press('Enter')

    // ⚠ Must positively match a UUID — the pre-submit URL is already
    // "/usuarios/novo", which would trivially satisfy a looser `[^/]+$` pattern
    // with no navigation having happened at all.
    await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/i, { timeout: 15_000 })

    // Scope to the EXACT keyboard-registered user via the directory filter so a
    // full-of-predecessors directory can't push it off page 1 (full-suite order
    // independence).
    await page.goto(`/o/rede-a/manage/usuarios?search=${encodeURIComponent(email)}`)
    const kbCard = page.locator('li').filter({ hasText: fullName })
    await expect(kbCard).toBeVisible({ timeout: 10_000 })
    // Password mode → created ACTIVE (not pending).
    await expect(kbCard.getByText('Ativo', { exact: true })).toBeVisible()
  })
})

test.describe('Security boundary — role restrictions', () => {
  test('a plain staff/staff_admin cannot reach the org user directory (404, no leakage)', async ({
    page,
  }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    const response = await page.request.get('/o/rede-a/manage/usuarios')
    expect(response.status()).toBe(404)

    await page.goto('/o/rede-a/manage/usuarios')
    // BUG-ACT-NOTFOUND-COPY-1: assert denial + no leak, not a specific
    // boundary's copy — ACT Stage 3 added a manage/not-found.tsx sibling
    // that catches a narrower page-level case with DIFFERENT text
    // ("Página não encontrada") than the global boundary this test hits
    // ("Erro 404" / "Não encontramos esta página."). Both share the pt-BR
    // "não encontr-" stem (house convention across every not-found copy in
    // this codebase); matching on that survives which boundary fires,
    // including a future one, rather than pinning one exact string.
    await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Novato Pendente')).not.toBeVisible()
    await expect(page.getByText('Ativo Registrado')).not.toBeVisible()
  })

  test('a foreign org_admin (rede-b) cannot open a rede-a user detail page (404, no leakage)', async ({
    page,
  }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto('/o/rede-a/manage/usuarios?search=ativo.registro')
    const card = page.locator('li').filter({ hasText: 'Ativo Registrado' })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.click()
    await page.waitForURL(/\/usuarios\/[^/]+$/, { timeout: 10_000 })
    const userDetailUrl = page.url()
    const userId = userDetailUrl.match(/\/usuarios\/([^/?]+)/)?.[1]
    expect(userId).toBeTruthy()

    // A foreign org_admin resolving a rede-a user id: `getOrgUser` is RLS-scoped
    // (org_admin of the user's home org only), returns null cross-org →
    // `notFound()`. In Next.js dev, `notFound()` renders the 404 boundary but the
    // HTTP response is 200 with the not-found RSC payload (documented in
    // phase3-admin-members), so the RENDERED page is the authoritative security
    // assertion — assert the pt-BR 404 boundary and NO leakage of the rede-a
    // user's identity, rather than the raw request status.
    await signInAs(page, 'orgadmin.b@test.local', undefined, 'org_admin')
    await page.goto(`/o/rede-b/manage/usuarios/${userId}`)
    // BUG-ACT-NOTFOUND-COPY-1 (fixed): this is a PAGE-level notFound() inside
    // an already-entered /o/rede-b/manage shell (she is genuinely org_admin
    // of rede-b), so ACT Stage 3's manage/not-found.tsx sibling boundary
    // catches it — "Página não encontrada", not the global "Erro 404" /
    // "Não encontramos esta página." this test used to pin. Both share the
    // pt-BR "não encontr-" stem; matching on that is the security assertion
    // that survives which boundary renders (denial + no leak), not the copy.
    await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('ativo.registro@test.local')).not.toBeVisible()
    await expect(page.getByText('Ativo Registrado')).not.toBeVisible()
  })
})
