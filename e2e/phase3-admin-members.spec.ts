import { test, expect } from '@playwright/test'

/**
 * Phase 3 — Admin Area & User Management
 *
 * Test contract: translates every bullet in PHASES.md §Phase 3 Acceptance into
 * Playwright assertions.  Four AC clauses:
 *
 *   AC1 — Admin creates a commission + assigns a staff_admin end-to-end.
 *   AC2 — staff_admin invites a novel staff user (Mailpit intercept + roster check)
 *         and removes a staff member behind the AlertDialog.
 *   AC3 — Cross-commission / role boundaries through the UI (no data leakage).
 *   AC4 — One keyboard-only flow (commission create + AlertDialog keyboard ops).
 *
 * Run-uniqueness: commission slugs and invite e-mails embed Date.now() so a
 * second run on the same seed does not collide on unique constraints.
 * (`npx supabase db reset` restores the seed if the DB is dirty.)
 *
 * Seeded personas (password: Test1234!):
 *   admin@test.local          — global admin        → /admin
 *   chefe.ccih@test.local     — staff_admin 'ccih'  → /c/ccih
 *   staff1.ccih@test.local    — staff 'ccih'        → /c/ccih
 *   chefe.farm@test.local     — staff_admin 'farmacia'
 *
 * ISOLATION NOTE: Tests that mutate the DB (create commissions, assign
 * coordinators, invite members) use fully unique emails and slugs (Date.now()
 * suffix) so they do not pollute other tests.  In particular, AC1's
 * "assign staff_admin" test uses a NOVEL email (not chefe.farm@test.local) so
 * the AC3 cross-commission boundary check remains valid regardless of run order.
 */

const MAILPIT_API = 'http://127.0.0.1:54324/api/v1'

// ---------------------------------------------------------------------------
// Helpers (reuse Phase 2 login pattern)
// ---------------------------------------------------------------------------

async function signInAs(
  page: import('@playwright/test').Page,
  email: string,
  password = 'Test1234!',
) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 15_000,
  })
}

/**
 * Poll Mailpit for a message to `toAddress` that arrived after `afterMs`.
 * Returns the first matching message object or null after `timeoutMs`.
 */
async function waitForMailpitMessage(
  toAddress: string,
  afterMs: number,
  timeoutMs = 20_000,
): Promise<{ Subject: string; To: { Address: string }[] } | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_API}/messages?limit=50`)
    if (!res.ok) break
    const body = (await res.json()) as {
      messages: { Subject: string; To: { Address: string }[]; Created: string }[]
    }
    const match = body.messages.find(
      (m) =>
        m.To.some(
          (t) => t.Address.toLowerCase() === toAddress.toLowerCase(),
        ) && new Date(m.Created).getTime() > afterMs,
    )
    if (match) return match
    await new Promise((r) => setTimeout(r, 800))
  }
  return null
}

// ---------------------------------------------------------------------------
// AC1 — Admin creates a commission + assigns a staff_admin
// ---------------------------------------------------------------------------

test.describe('AC1 — Admin creates a commission and assigns a staff_admin', () => {
  test('admin creates a new commission and it appears in the list', async ({ page }) => {
    await signInAs(page, 'admin@test.local')
    await expect(page).toHaveURL(/\/admin/)

    // Generate a unique slug so re-runs do not collide.
    const ts = Date.now()
    const commissionName = `Comissão Teste ${ts}`
    const slug = `comissao-teste-${ts}`

    // Fill the "Nova comissão" form.
    const nameInput = page.getByLabel('Nome')
    await nameInput.fill(commissionName)

    // The slug is auto-suggested from the name; override with our unique slug.
    const slugInput = page.getByLabel('Identificador (slug)')
    await slugInput.fill(slug)

    await page.getByRole('button', { name: /criar comissão/i }).click()

    // The action revalidates /admin; wait for the new commission card to appear.
    await expect(page.getByText(commissionName)).toBeVisible({ timeout: 10_000 })

    // Assert the commission appears with the EXACT name in the list.
    const commissionCards = page.locator('ul').filter({ has: page.locator('li') })
    await expect(commissionCards.getByText(commissionName)).toBeVisible()

    // The slug is rendered as the mono identifier on the card.
    await expect(page.getByText(`/${slug}`)).toBeVisible()
  })

  test('admin opens commission detail page for freshly-created commission', async ({ page }) => {
    // Create a commission first via the UI to have one to open.
    await signInAs(page, 'admin@test.local')
    await expect(page).toHaveURL(/\/admin/)

    const ts = Date.now()
    const commissionName = `Comissão Detail ${ts}`
    const slug = `comissao-detail-${ts}`

    await page.getByLabel('Nome').fill(commissionName)
    await page.getByLabel('Identificador (slug)').fill(slug)
    await page.getByRole('button', { name: /criar comissão/i }).click()

    // Wait for the new card link to appear in the list, then click it.
    const newCard = page.locator(`a[href="/admin/comissoes/${slug}"]`)
    await expect(newCard).toBeVisible({ timeout: 10_000 })
    await newCard.click()

    // The detail page should show the commission's name as the heading.
    await page.waitForURL(`**/admin/comissoes/${slug}`, { timeout: 10_000 })
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

    // Navigate to a freshly-created commission so we are not touching the seeded
    // ccih commission (whose roster the AC3 tests rely on).
    const slug = `coord-commission-${ts}`
    const commissionName = `Coord Commission ${ts}`
    await page.getByLabel('Nome').fill(commissionName)
    await page.getByLabel('Identificador (slug)').fill(slug)
    await page.getByRole('button', { name: /criar comissão/i }).click()
    const newCard = page.locator(`a[href="/admin/comissoes/${slug}"]`)
    await expect(newCard).toBeVisible({ timeout: 10_000 })
    await newCard.click()
    await page.waitForURL(`**/admin/comissoes/${slug}`, { timeout: 10_000 })

    // Assign the novel email as coordinator.
    const emailInput = page.locator('input[type="email"]')
    await emailInput.fill(novelCoordinatorEmail)
    await page.getByRole('button', { name: /atribuir coordenação/i }).click()

    // Success banner must appear.
    const banner = page.locator('[role="status"]')
    await expect(banner).toBeVisible({ timeout: 10_000 })
    const bannerText = await banner.innerText()
    expect(bannerText).toMatch(/coordenador|atribuído/i)

    // The assigned coordinator's email must now appear in the roster.
    await expect(
      page.getByText(novelCoordinatorEmail),
    ).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// AC2 — staff_admin invites a novel staff user (Mailpit) + remove flow
// ---------------------------------------------------------------------------

test.describe('AC2 — staff_admin invites a novel staff user and removes a member', () => {
  test('chefe.ccih invites a new email: Mailpit receives the invite + user appears in roster', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/c/ccih/manage/members')
    await page.waitForURL('**/c/ccih/manage/members', { timeout: 10_000 })

    const inviteEmail = `novo.staff.${Date.now()}@test.local`
    const sentAt = Date.now()

    const emailInput = page.locator('input[type="email"]')
    await emailInput.fill(inviteEmail)
    await page.getByRole('button', { name: /convidar membro/i }).click()

    // Success banner confirming the invite was sent.
    const banner = page.locator('[role="status"]')
    await expect(banner).toBeVisible({ timeout: 10_000 })
    const bannerText = await banner.innerText()
    expect(bannerText).toMatch(/convite|usuário/i)

    // Verify via Mailpit REST API that an invite email landed for this address.
    const msg = await waitForMailpitMessage(inviteEmail, sentAt)
    expect(msg).not.toBeNull()
    // The Supabase invite email is sent to the invited address.
    expect(msg!.To.some((t) => t.Address.toLowerCase() === inviteEmail.toLowerCase())).toBe(true)

    // The invited user must now appear in the member roster.
    // Their name is not set (invite-only), so the email itself shows.
    // Scope to the member list <ul> to avoid strict-mode ambiguity.
    const memberList = page.locator('ul').filter({ has: page.locator('li') }).last()
    await expect(memberList.getByText(inviteEmail, { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  test('staff_admin removes a staff member via AlertDialog confirm; member leaves roster', async ({ page }) => {
    // Invite a fresh staff user so we have a removable row.
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/c/ccih/manage/members')
    await page.waitForURL('**/c/ccih/manage/members', { timeout: 10_000 })

    const removeEmail = `remover.staff.${Date.now()}@test.local`

    // Invite first.
    await page.locator('input[type="email"]').fill(removeEmail)
    await page.getByRole('button', { name: /convidar membro/i }).click()
    await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 10_000 })

    // Confirm the member row is in the list.
    const memberList = page.locator('ul').filter({ has: page.locator('li') }).last()
    const memberRow = memberList.locator('li').filter({ hasText: removeEmail })
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
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/c/ccih/manage/members')
    await page.waitForURL('**/c/ccih/manage/members', { timeout: 10_000 })

    // Invite a user to have a removable row.
    const cancelEmail = `cancel.staff.${Date.now()}@test.local`
    await page.locator('input[type="email"]').fill(cancelEmail)
    await page.getByRole('button', { name: /convidar membro/i }).click()

    const memberList = page.locator('ul').filter({ has: page.locator('li') }).last()
    const memberRow = memberList.locator('li').filter({ hasText: cancelEmail })
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
  test('chefe.ccih (staff_admin A) hitting /c/farmacia/manage/members → 404 with no data leakage', async ({ page }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/c/farmacia/manage/members')

    // Next.js dev: notFound() in the layout (farmacia is inaccessible to chefe.ccih)
    // renders the pt-BR not-found boundary. Wait for the 404 content to stream in.
    await expect(page.getByText('Erro 404')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Não encontramos esta página/i)).toBeVisible()

    // Must not leak the Farmácia commission name or member emails.
    await expect(page.getByText('staff1.farm@test.local')).not.toBeVisible()
    await expect(page.getByText('chefe.farm@test.local')).not.toBeVisible()
    // Must not show the member management UI.
    await expect(page.getByText('Membros da comissão')).not.toBeVisible()
    await expect(page.getByText('Convidar membro')).not.toBeVisible()
  })

  test('staff1.ccih (plain staff) hitting /c/ccih/manage/members → 404', async ({ page }) => {
    await signInAs(page, 'staff1.ccih@test.local')
    await page.goto('/c/ccih/manage/members')

    // The manage/members page calls notFound() for plain staff inside the
    // commission layout. Wait for the 404 content to render in the page.
    await expect(page.getByText('Erro 404')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Não encontramos esta página/i)).toBeVisible()
    // No member management UI should be visible.
    await expect(page.getByText('Membros da comissão')).not.toBeVisible()
    await expect(page.getByText('Convidar membro')).not.toBeVisible()
  })

  test('non-admin (staff1.ccih) hitting /admin → 404', async ({ page }) => {
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
    // The admin commission management UI must NOT be rendered.
    await expect(page.getByText('Nova comissão')).not.toBeVisible()
    await expect(page.getByText('Todas as comissões')).not.toBeVisible()
  })

  test('non-admin (staff1.ccih) hitting /admin/comissoes/ccih → 404', async ({ page }) => {
    await signInAs(page, 'staff1.ccih@test.local')
    const response = await page.request.get('/admin/comissoes/ccih')
    expect(response.status()).toBe(404)
  })

  test('admin@test.local can access /c/farmacia/manage/members (admin override → 200)', async ({ page }) => {
    await signInAs(page, 'admin@test.local')
    await page.goto('/c/farmacia/manage/members')
    // Admin can access any commission's manage page.
    await expect(page.getByRole('heading', { level: 1, name: /membros/i })).toBeVisible({ timeout: 10_000 })
    // The page should render the member management UI.
    await expect(page.getByRole('button', { name: /convidar membro/i })).toBeVisible()
  })

  test('chefe.farm (staff_admin B) hitting /c/ccih/manage/members → 404, no ccih member data', async ({ page }) => {
    // IMPORTANT: this test relies on chefe.farm NOT being a member of ccih.
    // The AC1 tests use novel unique emails for their staff_admin assignment so
    // chefe.farm@test.local is never added to ccih by another test in this suite.
    await signInAs(page, 'chefe.farm@test.local')
    await page.goto('/c/ccih/manage/members')

    // chefe.farm is NOT a member of ccih, so the commission layout calls notFound().
    // Wait for the 404 boundary to render.
    await expect(page.getByText('Erro 404')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Não encontramos esta página/i)).toBeVisible()

    // Must not reveal any ccih commission member data.
    await expect(page.getByText('staff1.ccih@test.local')).not.toBeVisible()
    await expect(page.getByText('chefe.ccih@test.local')).not.toBeVisible()
    // Must not render the member management UI.
    await expect(page.getByText('Membros da comissão')).not.toBeVisible()
    await expect(page.getByText('Convidar membro')).not.toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC4 — Keyboard-only flow: commission create via keyboard
// ---------------------------------------------------------------------------

test.describe('AC4 — Keyboard-only commission create and AlertDialog confirm', () => {
  test('admin can create a commission using only the keyboard', async ({ page }) => {
    await signInAs(page, 'admin@test.local')
    await expect(page).toHaveURL(/\/admin/)

    const ts = Date.now()
    const commissionName = `Teclado ${ts}`
    const slug = `teclado-${ts}`

    // Focus the Nome field and fill it via keyboard.
    const nameInput = page.getByLabel('Nome')
    await nameInput.focus()
    await nameInput.fill(commissionName)

    // Tab to the slug field.
    await page.keyboard.press('Tab')
    // The slug field gets auto-suggested; override it with a unique value.
    const slugInput = page.getByLabel('Identificador (slug)')
    await slugInput.fill(slug)

    // Tab past the description text to the submit button, then press Enter.
    await page.keyboard.press('Tab') // move to submit button
    await page.keyboard.press('Enter') // activate

    // The new commission should appear in the list without any mouse interaction.
    await expect(page.getByText(commissionName)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(`/${slug}`)).toBeVisible()
  })

  test('AlertDialog: Enter opens, Esc cancels, Tab+Enter confirms removal (keyboard-only)', async ({ page }) => {
    // Invite a member first to have a removable row.
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto('/c/ccih/manage/members')
    await page.waitForURL('**/c/ccih/manage/members', { timeout: 10_000 })

    const kbEmail = `keyboard.staff.${Date.now()}@test.local`
    await page.locator('input[type="email"]').fill(kbEmail)
    await page.getByRole('button', { name: /convidar membro/i }).click()

    const memberList = page.locator('ul').filter({ has: page.locator('li') }).last()
    const memberRow = memberList.locator('li').filter({ hasText: kbEmail })
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
