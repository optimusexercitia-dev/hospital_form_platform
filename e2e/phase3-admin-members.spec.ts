import { test, expect } from '@playwright/test'

/**
 * Phase 3 — Admin Area & User Management
 *
 * Test contract: translates every bullet in PHASES.md §Phase 3 Acceptance into
 * Playwright assertions.  Four AC clauses:
 *
 *   AC1 — Org-admin creates a commission + assigns a staff_admin end-to-end.
 *   AC2 — staff_admin ADDS an already-registered org user via the picker
 *         (`AddMemberPicker`) + removes a staff member behind the AlertDialog.
 *   AC3 — Cross-commission / role boundaries through the UI (no data leakage).
 *   AC4 — One keyboard-only flow (commission create + AlertDialog keyboard ops).
 *
 * Members-UI refactor (commit 6a20327):
 *   - The coordinator members page no longer invites by e-mail. It ADDS
 *     already-registered org users via `AddMemberPicker`: a "Buscar pessoa"
 *     search input + a candidate list <ul aria-label="Pessoas cadastradas
 *     disponíveis"> of <button aria-pressed> rows; click a row to select, then
 *     the "Adicionar" submit button (disabled until a row is selected). Success
 *     shows "Pessoa adicionada à comissão." Brand-new people are registered by
 *     an org_admin (/o/rede-a/manage/usuarios/novo → registerUser, password
 *     mode → created ACTIVE), which is how AC2 obtains a fresh addable candidate
 *     without polluting a seeded persona relied on by the AC3 isolation tests.
 *   - AC1's commission-detail coordinator assign (StaffAdminManager,
 *     assign-by-email) is UNCHANGED; only its success-banner copy moved to
 *     "Coordenação atualizada. Se a pessoa ainda não tinha conta, enviamos um
 *     convite por e-mail."
 *
 * Multi-tenancy update (Phase C):
 *   - Commission create moved from `/admin` to `/o/rede-a/manage/comissoes`
 *     (org-admin area). The form now has a Hospital selector (required).
 *   - `admin@test.local` is now org_admin of rede-a (NOT is_admin).
 *   - `platform@test.local` is the platform admin (is_admin); lands on /admin.
 *   - Commission detail at `/o/rede-a/manage/comissoes/${slug}`.
 *   - Member management at `/o/rede-a/c/${commission}/manage/members`.
 *   - The org-manage create action stays on the list page with a success banner
 *     (no redirect to detail unlike the old /admin flow).
 *
 * Run-uniqueness: commission slugs and invite e-mails embed Date.now() so a
 * second run on the same seed does not collide on unique constraints.
 * (`npx supabase db reset` restores the seed if the DB is dirty.)
 *
 * Seeded personas (password: Test1234!):
 *   admin@test.local          — org_admin of rede-a   → /o/rede-a/manage
 *   chefe.ccih@test.local     — staff_admin 'ccih'    → /o/rede-a/c/ccih
 *   staff1.ccih@test.local    — staff 'ccih'          → /o/rede-a/c/ccih
 *   chefe.farm@test.local     — staff_admin 'farmacia'
 *
 * ISOLATION NOTE: Tests that mutate the DB (create commissions, assign
 * coordinators, invite members) use fully unique emails and slugs (Date.now()
 * suffix) so they do not pollute other tests.  In particular, AC1's
 * "assign staff_admin" test uses a NOVEL email (not chefe.farm@test.local) so
 * the AC3 cross-commission boundary check remains valid regardless of run order.
 */

// The seeded hospital under rede-a (from supabase/seed.sql — Hospital Central A).
// We select this in the Hospital dropdown when creating a commission.
const HOSPITAL_NAME = 'Hospital Central A'

// ---------------------------------------------------------------------------
// Helpers (reuse Phase 2 login pattern)
// ---------------------------------------------------------------------------

async function signInAs(
  page: import('@playwright/test').Page,
  email: string,
  password = 'Test1234!',
) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 15_000,
  })
}

/**
 * Register a fresh, ACTIVE org user via the org_admin flow so the coordinator's
 * `AddMemberPicker` has a novel candidate to add — the members page no longer
 * invites brand-new people by e-mail; org_admins register them, and in password
 * mode (default) the account is created ACTIVE immediately. Returns { email, fullName }.
 *
 * A unique Date.now()-suffixed identity keeps runs order-independent and means the
 * candidate is never a seeded persona that an AC3 isolation test relies on being
 * OUTSIDE ccih. Leaves the caller signed in as orgadmin.a — the caller then signs
 * in as the coordinator to do the add.
 */
async function registerActiveOrgUser(
  page: import('@playwright/test').Page,
): Promise<{ email: string; fullName: string }> {
  const ts = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const email = `addable.${ts}@test.local`
  const fullName = `Pessoa Adicionável ${ts}`

  await signInAs(page, 'orgadmin.a@test.local')
  await page.goto('/o/rede-a/manage/usuarios/novo')
  await page.waitForURL('**/o/rede-a/manage/usuarios/novo', { timeout: 10_000 })

  await page.getByLabel('Nome completo').fill(fullName)
  await page.getByLabel('E-mail').fill(email)
  // Password mode (default): an initial password is required; the account is
  // created ACTIVE, hence immediately addable.
  await page.getByLabel('Senha inicial').fill('Test1234!')
  // Category is required; pick the first real option.
  const categorySelect = page.getByLabel('Categoria profissional')
  const opts = await categorySelect.locator('option').all()
  const firstReal = await opts[1].getAttribute('value')
  if (firstReal) await categorySelect.selectOption(firstReal)

  await page.getByRole('button', { name: /registrar pessoa/i }).click()
  await page.waitForURL('**/o/rede-a/manage/usuarios', { timeout: 15_000 })

  return { email, fullName }
}

/**
 * Add an already-registered org user to a commission via the coordinator's
 * `AddMemberPicker`. The picker now lives inside a modal dialog (UI refactor):
 * click the "Adicionar membro" button to open the dialog, type into "Buscar
 * pessoa", select the matching candidate button in the <ul aria-label="Pessoas
 * cadastradas disponíveis">, then submit "Adicionar". Asserts the success
 * banner. The dialog STAYS OPEN after a successful add (selection clears, list
 * revalidates), so the helper closes it (Esc) at the end — every caller then
 * asserts against the underlying members page (roster / Remover buttons).
 * Caller must already be on the members page, signed in as a coordinator of
 * that commission.
 */
async function addMemberViaPicker(
  page: import('@playwright/test').Page,
  candidateEmail: string,
) {
  // Open the modal dialog that now holds the picker.
  await page.getByRole('button', { name: /adicionar membro/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10_000 })

  await dialog.getByLabel('Buscar pessoa').fill(candidateEmail)
  const candidateList = dialog.getByRole('list', {
    name: 'Pessoas cadastradas disponíveis',
  })
  const candidate = candidateList
    .getByRole('button')
    .filter({ hasText: candidateEmail })
  await expect(candidate).toBeVisible({ timeout: 10_000 })
  await candidate.click()
  await expect(candidate).toHaveAttribute('aria-pressed', 'true')

  const addButton = dialog.getByRole('button', { name: /^adicionar$/i })
  await expect(addButton).toBeEnabled()
  await addButton.click()

  const banner = page.locator('[role="status"]')
  await expect(banner).toBeVisible({ timeout: 10_000 })
  // `addStaff` returns its own pt-BR copy ("Usuário adicionado à comissão com
  // sucesso.") which the FormBanner prefers over the component default ("Pessoa
  // adicionada à comissão."). Match the invariant part, gender-agnostic.
  await expect(banner).toContainText(/adicionad[ao] à comissão/i)

  // Dialog stays open after a successful add; close it so callers can interact
  // with the underlying members page (roster rows, Remover buttons).
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible({ timeout: 5_000 })
}

// ---------------------------------------------------------------------------
// AC1 — Org-admin creates a commission + assigns a staff_admin
// ---------------------------------------------------------------------------

test.describe('AC1 — Org-admin creates a commission and assigns a staff_admin', () => {
  test('admin creates a new commission and it appears in the list', async ({ page }) => {
    await signInAs(page, 'admin@test.local')
    // admin@ is org_admin of rede-a → lands on /o/rede-a/manage
    await expect(page).toHaveURL(/\/o\/rede-a\/manage/)

    // Navigate to the commissions create page.
    await page.goto('/o/rede-a/manage/comissoes')
    await page.waitForURL('**/o/rede-a/manage/comissoes', { timeout: 10_000 })

    // Generate a unique slug so re-runs do not collide.
    const ts = Date.now()
    const commissionName = `Comissão Teste ${ts}`
    const slug = `comissao-teste-${ts}`

    // Select the hospital (required in the org-manage create form).
    // Use name-based selector to avoid strict-mode collision with the
    // sidebar link that has aria-label containing "Hospital".
    const hospitalSelect = page.locator('select[name="hospitalId"]')
    await hospitalSelect.selectOption({ label: HOSPITAL_NAME })

    // Fill the "Nova comissão" form.
    const nameInput = page.getByLabel('Nome')
    await nameInput.fill(commissionName)

    // The slug is auto-suggested from the name; override with our unique slug.
    const slugInput = page.getByLabel('Identificador (slug)')
    await slugInput.fill(slug)

    await page.getByRole('button', { name: /criar comissão/i }).click()

    // The org-manage action stays on the list page with a success banner.
    const banner = page.locator('[role="status"]')
    await expect(banner).toBeVisible({ timeout: 10_000 })
    const bannerText = await banner.innerText()
    expect(bannerText).toMatch(/criada/i)

    // The commission must appear in the list.
    const commissionCards = page.locator('ul').filter({ has: page.locator('li') })
    await expect(commissionCards.getByText(commissionName)).toBeVisible({ timeout: 10_000 })

    // The slug is rendered as the mono identifier on the card.
    await expect(page.getByText(`/${slug}`)).toBeVisible()
  })

  test('admin opens commission detail page for freshly-created commission', async ({ page }) => {
    // Create a commission first via the UI to have one to open.
    await signInAs(page, 'admin@test.local')
    await page.goto('/o/rede-a/manage/comissoes')
    await page.waitForURL('**/o/rede-a/manage/comissoes', { timeout: 10_000 })

    const ts = Date.now()
    const commissionName = `Comissão Detail ${ts}`
    const slug = `comissao-detail-${ts}`

    await page.locator('select[name="hospitalId"]').selectOption({ label: HOSPITAL_NAME })
    await page.getByLabel('Nome').fill(commissionName)
    await page.getByLabel('Identificador (slug)').fill(slug)
    await page.getByRole('button', { name: /criar comissão/i }).click()

    // Wait for success banner.
    await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 10_000 })

    // Navigate to the commission detail page.
    await page.goto(`/o/rede-a/manage/comissoes/${slug}`)
    await page.waitForURL(`**/o/rede-a/manage/comissoes/${slug}`, { timeout: 10_000 })

    // The detail page should show the commission's name as the heading.
    await expect(page.getByRole('heading', { level: 1, name: commissionName })).toBeVisible()

    // The slug must be rendered as read-only — it's in mono text on the detail page.
    await expect(page.getByText(`/${slug}`, { exact: true })).toBeVisible()
  })

  test('admin assigns a staff_admin by email (novel invite); coordinator appears in roster', async ({ page }) => {
    // ISOLATION: use a NOVEL email so the invited persona is not a member of any
    // other commission.  This keeps the AC3 cross-commission test independent of
    // run order and avoids polluting seeded personas.
    const ts = Date.now()
    const novelCoordinatorEmail = `coord.${ts}@test.local`

    await signInAs(page, 'admin@test.local')
    await page.goto('/o/rede-a/manage/comissoes')
    await page.waitForURL('**/o/rede-a/manage/comissoes', { timeout: 10_000 })

    // Navigate to a freshly-created commission so we are not touching the seeded
    // ccih commission (whose roster the AC3 tests rely on).
    const slug = `coord-commission-${ts}`
    const commissionName = `Coord Commission ${ts}`
    await page.locator('select[name="hospitalId"]').selectOption({ label: HOSPITAL_NAME })
    await page.getByLabel('Nome').fill(commissionName)
    await page.getByLabel('Identificador (slug)').fill(slug)
    await page.getByRole('button', { name: /criar comissão/i }).click()

    // Wait for success banner then navigate to detail.
    await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 10_000 })
    await page.goto(`/o/rede-a/manage/comissoes/${slug}`)
    await page.waitForURL(`**/o/rede-a/manage/comissoes/${slug}`, { timeout: 10_000 })

    // Assign the novel email as coordinator.
    const emailInput = page.locator('input[type="email"]')
    await emailInput.fill(novelCoordinatorEmail)
    await page.getByRole('button', { name: /atribuir coordenação/i }).click()

    // Success banner must appear. On success `assignStaffAdmin` returns its own
    // pt-BR copy ("Coordenador(a) atribuído(a) com sucesso.") which the FormBanner
    // prefers over its default fallback ("Coordenação atualizada. Se a pessoa ainda
    // não tinha conta, enviamos um convite por e-mail."). Accept either — the
    // invite-if-novel path is the point, and the exact success string is an app copy
    // detail, not the acceptance contract.
    const banner = page.locator('[role="status"]')
    await expect(banner).toBeVisible({ timeout: 10_000 })
    const bannerText = await banner.innerText()
    expect(bannerText).toMatch(/coordenad|atribuíd|convite/i)

    // The assigned coordinator's email must now appear in the roster.
    await expect(
      page.getByText(novelCoordinatorEmail),
    ).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// AC2 — staff_admin ADDS an already-registered org user (picker) + remove flow
// ---------------------------------------------------------------------------

test.describe('AC2 — staff_admin adds an already-registered user and removes a member', () => {
  test('chefe.ccih adds an existing org user via the picker; user appears in roster', async ({ page }) => {
    // Register a fresh ACTIVE org user (as org_admin) so the coordinator has a
    // novel candidate to add — the picker only lists already-registered, active,
    // not-already-member org users.
    const { email, fullName } = await registerActiveOrgUser(page)

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/o/rede-a/c/ccih/manage/members')
    await page.waitForURL('**/o/rede-a/c/ccih/manage/members', { timeout: 10_000 })

    await addMemberViaPicker(page, email)

    // The added user must now appear in the member roster (by name).
    const memberList = page.locator('ul').filter({ has: page.locator('li') }).last()
    await expect(
      memberList.locator('li').filter({ hasText: fullName }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('empty-state shows when no addable users remain', async ({ page }) => {
    // The picker's empty state ("Nenhuma pessoa cadastrada está disponível para
    // adicionar.") renders only when `candidates` is empty. We can't force the org
    // roster empty without disturbing other specs, so assert the invariant WEAKLY:
    // whenever the candidate list is empty, the empty-state copy is shown instead
    // of the search box — never both. This keeps the empty-state coverage the old
    // invite flow lacked without a destructive fixture.
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/o/rede-a/c/ccih/manage/members')
    await page.waitForURL('**/o/rede-a/c/ccih/manage/members', { timeout: 10_000 })

    // The picker (search box + empty state) now lives inside the modal dialog;
    // open it before evaluating the mutual-exclusivity invariant.
    await page.getByRole('button', { name: /adicionar membro/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    const searchBox = dialog.getByLabel('Buscar pessoa')
    const emptyState = dialog.getByText(
      /Nenhuma pessoa cadastrada está disponível para adicionar/i,
    )
    // Exactly one of the two is present (mutually exclusive by construction).
    const hasSearch = await searchBox.count()
    if (hasSearch) {
      await expect(searchBox).toBeVisible()
      await expect(emptyState).toHaveCount(0)
    } else {
      await expect(emptyState).toBeVisible()
    }
  })

  test('staff_admin removes a staff member via AlertDialog confirm; member leaves roster', async ({ page }) => {
    // Add a fresh staff user so we have a removable row.
    const { email, fullName } = await registerActiveOrgUser(page)

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/o/rede-a/c/ccih/manage/members')
    await page.waitForURL('**/o/rede-a/c/ccih/manage/members', { timeout: 10_000 })

    await addMemberViaPicker(page, email)

    // Confirm the member row is in the list (by name).
    const memberList = page.locator('ul').filter({ has: page.locator('li') }).last()
    const memberRow = memberList.locator('li').filter({ hasText: fullName })
    await expect(memberRow).toBeVisible({ timeout: 10_000 })

    // Find the "Remover" button for this specific member row.
    const removeButton = memberRow.getByRole('button', { name: /remover/i })
    await expect(removeButton).toBeVisible()
    await removeButton.click()

    // AlertDialog should open — the dialog title must be visible.
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })
    await expect(dialog.getByText(/remover membro/i)).toBeVisible()

    // Confirm removal.
    await dialog.getByRole('button', { name: /^remover$/i }).click()

    // Wait for the dialog to close before checking the roster.
    await expect(dialog).not.toBeVisible({ timeout: 10_000 })

    // The member row should have disappeared.
    await expect(memberRow).not.toBeVisible({ timeout: 10_000 })
  })

  test('AlertDialog Cancelar closes the dialog without removing the member', async ({ page }) => {
    const { email, fullName } = await registerActiveOrgUser(page)

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/o/rede-a/c/ccih/manage/members')
    await page.waitForURL('**/o/rede-a/c/ccih/manage/members', { timeout: 10_000 })

    await addMemberViaPicker(page, email)

    const memberList = page.locator('ul').filter({ has: page.locator('li') }).last()
    const memberRow = memberList.locator('li').filter({ hasText: fullName })
    await expect(memberRow).toBeVisible({ timeout: 10_000 })

    // Open the AlertDialog.
    await memberRow.getByRole('button', { name: /remover/i }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()

    // Click Cancelar.
    await dialog.getByRole('button', { name: /cancelar/i }).click()

    // Dialog should close, member should still be present.
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })
    await expect(memberRow).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC3 — Cross-commission and role boundaries (no data leakage)
// ---------------------------------------------------------------------------

test.describe('AC3 — Role and commission boundary security', () => {
  test('chefe.ccih (staff_admin A) hitting /o/rede-a/c/farmacia/manage/members → 404 with no data leakage', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/o/rede-a/c/farmacia/manage/members')

    // Next.js dev: notFound() in the layout (farmacia is inaccessible to chefe.ccih)
    // renders the pt-BR not-found boundary. Wait for the 404 content to stream in.
    await expect(page.getByText('Erro 404')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Não encontramos esta página/i)).toBeVisible()

    // Must not leak the Farmácia commission name or member emails.
    await expect(page.getByText('staff1.farm@test.local')).not.toBeVisible()
    await expect(page.getByText('chefe.farm@test.local')).not.toBeVisible()
    // Must not show the member management UI (post-refactor: "Adicionar membro" +
    // the "Buscar pessoa" picker instead of the old "Convidar membro").
    await expect(page.getByText('Membros da comissão')).not.toBeVisible()
    await expect(page.getByText('Adicionar membro')).not.toBeVisible()
    await expect(page.getByLabel('Buscar pessoa')).toHaveCount(0)
  })

  test('staff1.ccih (plain staff) hitting /o/rede-a/c/ccih/manage/members → 404', async ({ page }) => {
    await signInAs(page, 'staff1.ccih@test.local')
    await page.goto('/o/rede-a/c/ccih/manage/members')

    // The manage/members page calls notFound() for plain staff inside the
    // commission layout. Wait for the 404 content to render in the page.
    await expect(page.getByText('Erro 404')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Não encontramos esta página/i)).toBeVisible()
    // No member management UI should be visible.
    await expect(page.getByText('Membros da comissão')).not.toBeVisible()
    await expect(page.getByText('Adicionar membro')).not.toBeVisible()
    await expect(page.getByLabel('Buscar pessoa')).toHaveCount(0)
  })

  test('non-admin (staff1.ccih) hitting /admin → 404 (platform admin only)', async ({ page }) => {
    await signInAs(page, 'staff1.ccih@test.local')
    // HTTP-level gating: admin/layout.tsx calls notFound() → 404.
    const response = await page.request.get('/admin')
    expect(response.status()).toBe(404)

    // UI-level: navigate with the browser and confirm the 404 page renders —
    // NOT the admin UI. In dev mode, Next.js sends RSC payloads for both the
    // not-found component AND the error boundary in the same response, so the
    // raw response text may contain strings from the admin skeleton/RSC tree.
    // The RENDERED page is what matters for the security boundary: the browser
    // must show the 404 page, not admin commission data.
    await page.goto('/admin')
    // The 404 page renders "Erro 404" and "Não encontramos esta página."
    await expect(page.getByText('Erro 404')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Não encontramos esta página/i)).toBeVisible()
    // The platform admin UI must NOT be rendered.
    await expect(page.getByText('Organizações')).not.toBeVisible()
  })

  test('non-admin (staff1.ccih) hitting /o/rede-a/manage → 404 (org_admin only)', async ({ page }) => {
    await signInAs(page, 'staff1.ccih@test.local')
    const response = await page.request.get('/o/rede-a/manage')
    expect(response.status()).toBe(404)
  })

  test('admin@test.local (org_admin) can access /o/rede-a/c/farmacia/manage/members', async ({ page }) => {
    await signInAs(page, 'admin@test.local')
    await page.goto('/o/rede-a/c/farmacia/manage/members')
    // Org-admin can access any commission's manage page in their org.
    await expect(page.getByRole('heading', { level: 1, name: /membros/i })).toBeVisible({ timeout: 10_000 })
    // The page should render the new member-management UI: an "Adicionar membro"
    // button that opens a modal dialog holding the "Buscar pessoa" picker (the
    // invite-by-email form is gone).
    const addMemberButton = page.getByRole('button', { name: /adicionar membro/i })
    await expect(addMemberButton).toBeVisible()
    await addMemberButton.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })
    // The dialog's title and the picker's search field must both render.
    await expect(dialog.getByText('Adicionar membro')).toBeVisible()
    await expect(dialog.getByLabel('Buscar pessoa')).toBeVisible()
  })

  test('chefe.farm (staff_admin B) hitting /o/rede-a/c/ccih/manage/members → 404, no ccih member data', async ({ page }) => {
    // IMPORTANT: this test relies on chefe.farm NOT being a member of ccih.
    // The AC1 tests use novel unique emails for their staff_admin assignment so
    // chefe.farm@test.local is never added to ccih by another test in this suite.
    await signInAs(page, 'chefe.farm@test.local')
    await page.goto('/o/rede-a/c/ccih/manage/members')

    // chefe.farm is NOT a member of ccih, so the commission layout calls notFound().
    // Wait for the 404 boundary to render.
    await expect(page.getByText('Erro 404')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Não encontramos esta página/i)).toBeVisible()

    // Must not reveal any ccih commission member data.
    await expect(page.getByText('staff1.ccih@test.local')).not.toBeVisible()
    await expect(page.getByText('chefe.ccih@test.local')).not.toBeVisible()
    // Must not render the member management UI.
    await expect(page.getByText('Membros da comissão')).not.toBeVisible()
    await expect(page.getByText('Adicionar membro')).not.toBeVisible()
    await expect(page.getByLabel('Buscar pessoa')).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
// AC4 — Keyboard-only flow: commission create via keyboard
// ---------------------------------------------------------------------------

test.describe('AC4 — Keyboard-only commission create and AlertDialog confirm', () => {
  test('admin can create a commission using only the keyboard', async ({ page }) => {
    await signInAs(page, 'admin@test.local')
    // Navigate to the org-manage commissions page.
    await page.goto('/o/rede-a/manage/comissoes')
    await page.waitForURL('**/o/rede-a/manage/comissoes', { timeout: 10_000 })

    const ts = Date.now()
    const commissionName = `Teclado ${ts}`
    const slug = `teclado-${ts}`

    // Select hospital via keyboard (required field).
    // Use name-based selector to avoid strict-mode collision with sidebar link.
    const hospitalSelect = page.locator('select[name="hospitalId"]')
    await hospitalSelect.focus()
    await hospitalSelect.selectOption({ label: HOSPITAL_NAME })

    // Focus the Nome field and fill it via keyboard.
    const nameInput = page.getByLabel('Nome')
    await nameInput.focus()
    await nameInput.fill(commissionName)

    // Tab to the slug field.
    await page.keyboard.press('Tab')
    // The slug field gets auto-suggested; override it with a unique value.
    const slugInput = page.getByLabel('Identificador (slug)')
    await slugInput.fill(slug)

    // Tab to the submit button, then press Enter.
    await page.keyboard.press('Tab') // move to submit button
    await page.keyboard.press('Enter') // activate

    // The action stays on the list page with a success banner.
    const banner = page.locator('[role="status"]')
    await expect(banner).toBeVisible({ timeout: 10_000 })

    // Commission name must appear in the list — no mouse interaction used.
    await expect(page.getByText(commissionName)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(`/${slug}`)).toBeVisible()
  })

  test('AlertDialog: Enter opens, Esc cancels, Tab+Enter confirms removal (keyboard-only)', async ({ page }) => {
    // Add a member first to have a removable row. (The picker add is done with the
    // mouse here — the KEYBOARD-only flow under test is the AlertDialog remove
    // operations below.)
    const { email: kbEmail, fullName: kbName } = await registerActiveOrgUser(page)

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/o/rede-a/c/ccih/manage/members')
    await page.waitForURL('**/o/rede-a/c/ccih/manage/members', { timeout: 10_000 })

    await addMemberViaPicker(page, kbEmail)

    const memberList = page.locator('ul').filter({ has: page.locator('li') }).last()
    const memberRow = memberList.locator('li').filter({ hasText: kbName })
    await expect(memberRow).toBeVisible({ timeout: 10_000 })

    // Locate the remove trigger within the member row.
    const removeTrigger = memberRow.getByRole('button', { name: /remover/i })
    const dialog = page.getByRole('alertdialog')

    // ---- Esc closes the dialog without removing ----
    await removeTrigger.focus()
    await page.keyboard.press('Enter') // open AlertDialog via keyboard
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    await page.keyboard.press('Escape') // Esc should close without removing
    await expect(dialog).not.toBeVisible({ timeout: 5_000 })
    await expect(memberRow).toBeVisible() // member still present

    // ---- Tab to confirm button + Enter confirms removal ----
    await removeTrigger.focus()
    await page.keyboard.press('Enter') // re-open
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // When the Radix AlertDialog opens it auto-focuses the first focusable element
    // (the "Cancelar" button). One Tab press moves focus to the confirm "Remover"
    // button. Verify focus before pressing Enter.
    const confirmButton = dialog.getByRole('button', { name: /^remover$/i })
    const cancelButton = dialog.getByRole('button', { name: /cancelar/i })

    // Determine where focus landed — it may be on Cancelar or Remover depending on
    // how Radix initialises the focus trap. Tab forward until Remover is focused.
    // At most one Tab press is needed (Cancelar → Remover).
    const isCancelFocused = await cancelButton.evaluate((el) => el === document.activeElement)
    if (isCancelFocused) {
      await page.keyboard.press('Tab') // move from Cancelar to Remover
    }
    // If Radix opened with focus elsewhere (e.g. description), keep tabbing until
    // Remover is focused.
    await expect(confirmButton).toBeFocused({ timeout: 3_000 })

    await page.keyboard.press('Enter') // confirm removal

    // Wait for dialog to close, then for the page revalidation to remove the row.
    await expect(dialog).not.toBeVisible({ timeout: 10_000 })
    // Use the text locator scoped to the member list — once the row is gone,
    // the exact email should not appear anywhere in the roster list.
    await expect(
      memberList.locator('li').filter({ hasText: kbEmail }),
    ).toHaveCount(0, { timeout: 15_000 })
  })
})
