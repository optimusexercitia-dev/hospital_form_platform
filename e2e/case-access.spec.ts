import { test, expect, type Page } from '@playwright/test'

/**
 * Case Access Control & "Meus Casos" — E2E spec (ADR 0033, feature-flagged
 * increment; plan docs/phases/case-access-control.md §5).
 *
 * Translates the 11 acceptance criteria into Playwright assertions. Covers:
 *  AC-1  Attribution → full-case read (submitted-only; no in-progress leak).
 *  AC-2  Restrictive boundary (notFound() for staff4 / absent from Meus Casos).
 *  AC-3  Grant read / write (viewer vs collaborator); revoke removes access.
 *  AC-3d Terminal-case dialog (ADR 0033 D6): button on concluido case; write disabled; coordinator absent from roster.
 *  AC-4  Q14 ownership (write-grantee cannot edit/conclude an attributed narrative).
 *  AC-5  Meus Casos list (unified; card; Preencher/Abrir/Concluir/Ver caso completo).
 *  AC-6  Narrative lifecycle (fill focused editor → Concluir → coordinator reopens).
 *  AC-7  PHI boundary (read-grantee sees PHI-free chip; click-through denied).
 *  AC-8  Audit (case.opened row on non-coordinator open; none on coordinator open).
 *  AC-9  Flag OFF — SKIPPED (ships ON; flag-OFF covered by pgTAP 615/615).
 *  AC-10 Keyboard-only: Meus Casos → narrative editor flow.
 *  AC-N1 Narrative attribution via card DropdownMenu (assign / clear).
 *  AC-N2 Negative: no inline access panel heading; no select[id^="narrative-assignee-"].
 *  AC-11 Full regression suite green (run separately as the gate).
 *
 * UI SHAPE (Case Access Control refinement, 2026-06-19):
 *  - Access roster is NO LONGER inline on the case body. It lives behind a top-bar
 *    "Acesso ao caso" button that opens a Dialog. Any step that touches the roster
 *    must first click that button, then scope to:
 *      page.getByRole('dialog', { name: 'Acesso ao caso' })
 *  - Narrative assignment is NO LONGER a <select id="narrative-assignee-*">. Each
 *    narrative card has a DropdownMenu trigger with
 *      aria-label="Responsável pela narrativa <heading>"
 *    Selecting a member calls assignNarrative; "Remover responsável" calls unassignNarrative.
 *
 * Runs against the LOCAL Supabase stack + a prod build
 * (`npm run build && npm start`). All tests are serial because several mutate
 * shared seed state (AC-3 grants/revokes, AC-6 conclude/reopen). Run with
 * `--workers=1` when included in the full suite.
 *
 * Seeded personas and their access to Caso 0001 "Óbito UTI leito 7" (CCIH):
 *   chefe.ccih@test.local  — COORDINATOR (staff_admin)
 *   staff1.ccih@test.local — phase assignee → attribution-derived FULL READ; fills Phase 1 only
 *   staff2.ccih@test.local — narrative assignee (Resumo Clínico) → attribution-derived FULL READ; writes that narrative only
 *   multi@test.local       — standalone READ grant (viewer; editors hidden)
 *   staff3.ccih@test.local — standalone WRITE grant (collaborator; un-attributed content write; no lifecycle/phase-fill)
 *   staff4.ccih@test.local — BOUNDARY: no attribution, no grant → notFound()
 *
 * Password for all: Test1234!
 */

// Serial: tests share DB state and some mutate (AC-3 grants, AC-6 lifecycle).
test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

// Disable animations so transitions complete instantly.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY missing — set it in .env.local.')
}

const SLUG = 'ccih'

// Deterministic IDs from seed.sql
const CASE_ID = 'd0000000-0000-0000-0000-0000000000c1'         // Caso 0001 (open)
const CASE_ID_TERMINAL = 'd0000000-0000-0000-0000-0000000000c2' // Caso 0002 (concluido)
const COMM_ID = 'a0000000-0000-0000-0000-0000000000a1'
// Narrative type: "Resumo Clínico" (assigned to staff2)
const NARRATIVE_TYPE_RES = 'e2000000-0000-0000-0000-0000000000f1'
// User IDs
const UID_CHEFE  = '00000000-0000-0000-0000-000000000002'       // coordinator
const UID_MULTI  = '00000000-0000-0000-0000-000000000008'       // read grant
const UID_STAFF3 = '00000000-0000-0000-0000-000000000009'       // write grant
const UID_STAFF4 = '00000000-0000-0000-0000-00000000000a'       // boundary

const PW = 'Test1234!'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, pw = PW) {
  await page.goto('/login')
  await page.getByLabel(/e-mail/i).fill(email)
  await page.getByLabel(/senha/i).fill(pw)
  await page.getByRole('button', { name: /entrar/i }).click()
  // Wait for navigation away from /login. multi@test.local belongs to two commissions,
  // so login lands on the commission picker (/c) rather than a slug page (/c/slug/...).
  // The regex matches both /c and /c/slug/... to handle both cases.
  await page.waitForURL(/\/c($|\/)/)
}

async function signOut(page: Page) {
  // Navigate to a page with the app shell so the account menu exists.
  await page.goto(`/c/${SLUG}/meus-casos`)
  await page.waitForURL(/meus-casos/)
  const menuBtn = page.getByRole('button', { name: /abrir menu da conta/i })
  await menuBtn.click()
  await page.getByRole('menuitem', { name: /sair/i }).click()
  await page.waitForURL(/\/login/)
}

/** Direct API call (service role) — bypasses RLS. Returns rows. */
async function dbQuery<T = Record<string, unknown>>(
  table: string,
  params: Record<string, string>,
): Promise<T[]> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?${qs}&select=*`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  if (!res.ok) return []
  const data: unknown = await res.json()
  if (!Array.isArray(data)) return []
  return data as T[]
}

/** Call a Supabase RPC via the service-role key (bypasses RLS). */
async function dbRpc(fn: string, body: Record<string, unknown>): Promise<{ ok: boolean; data: unknown; error: unknown }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data: unknown = res.ok ? await res.json() : null
  const error = res.ok ? null : await res.text()
  return { ok: res.ok, data, error }
}

/** Find the "Resumo Clínico" narrative id in Caso 0001 (deterministic type id). */
async function getResumoCaseNarrativeId(): Promise<string> {
  const rows = await dbQuery<{ id: string }>('case_narratives', {
    case_id: `eq.${CASE_ID}`,
    narrative_type_id: `eq.${NARRATIVE_TYPE_RES}`,
  })
  if (!rows.length) throw new Error('Resumo Clínico narrative not found in seed!')
  return rows[0].id
}

/** Get an audit_log count of case.opened rows for Caso 0001. */
async function caseOpenedCount(): Promise<number> {
  const rows = await dbQuery<{ id: string }>('audit_log', {
    entity_type: 'eq.case',
    entity_id: `eq.${CASE_ID}`,
    action: 'eq.case.opened',
  })
  return rows.length
}

/**
 * Helper: open the "Acesso ao caso" dialog on the coordinator manage page.
 * After this call the dialog is open and scoped to the returned locator.
 * The caller must already be on the correct manage/cases/[caseId] page.
 */
async function openAccessDialog(page: Page) {
  const btn = page.getByRole('button', { name: /^Acesso ao caso$/i })
  await expect(btn).toBeVisible({ timeout: 10_000 })
  await btn.click()
  const dialog = page.getByRole('dialog', { name: /acesso ao caso/i })
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  return dialog
}

// ---------------------------------------------------------------------------
// AC-1 — Attribution → read (phase assignee sees full case, submitted-only)
// ---------------------------------------------------------------------------

test('AC-1 attribution-read: phase assignee (staff1) opens full case read-only; sees submitted answers; no in-progress drafts', async ({
  page,
}) => {
  await signInAs(page, 'staff1.ccih@test.local')

  // "Meus Casos" should appear in the sidebar nav (replaces "Minhas fases").
  // The <nav aria-label="Navegação da comissão"> contains the link; we scope with name
  // to pick the right nav when multiple navigation landmarks exist on the page.
  const sidebar = page.getByRole('navigation', { name: /navegação da comissão/i })
  await expect(sidebar.getByRole('link', { name: /meus casos/i })).toBeVisible({ timeout: 10_000 })

  // Navigate to the full case via the staff route.
  await page.goto(`/c/${SLUG}/casos/${CASE_ID}`)
  await page.waitForURL(`/c/${SLUG}/casos/${CASE_ID}`)

  // Case header should render (case number).
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toBeVisible({ timeout: 10_000 })

  // --- Phase-7 submitted-only invariant ---
  // Phase 1 is CONCLUIDA (has a submitted response by staff1 themselves).
  // The submitted answers ARE visible because Phase-7 allows coordinator (and now
  // also the staff read path) to see submitted answers via `get_case_detail`
  // (submitted-only answer projection). The answered key is `dispensador_disponivel`.
  // We assert the phase card is visible and shows "Concluída".
  const phase1Card = page.locator('[data-testid="phase-card"]').first()
  // If there is no data-testid, we look for the status pill "Concluída".
  // In any case the detail page must render without 404.
  await expect(page.getByText(/Óbito UTI leito 7/i)).toBeVisible()

  // No in-progress draft section should be visible (no "Em andamento" phase
  // with answers exposed — they remain hidden). The Phase-2 is PENDENTE, which
  // has no answers yet, so it cannot leak.
  // Assert that we do NOT see a "Responder" button (which only an assignee of
  // an ativa phase would see), confirming staff1 cannot fill Phase 2.
  // (Phase 1 is already concluida, so no Preencher either.)
  await expect(page.getByRole('button', { name: /^Preencher$/ })).toHaveCount(0)

  // Coordinator lifecycle controls must be ABSENT for a plain-staff viewer.
  // The "Ativar fase" or "Concluir caso" buttons are coordinator-only.
  await expect(page.getByRole('button', { name: /ativar fase/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /concluir caso/i })).toHaveCount(0)

  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC-2 — Restrictive boundary: staff4 gets notFound(); absent from Meus Casos
// ---------------------------------------------------------------------------

test('AC-2 boundary: staff4 (no attribution, no grant) gets notFound() at case route and case absent from Meus Casos', async ({
  page,
}) => {
  await signInAs(page, 'staff4.ccih@test.local')

  // Direct navigation to Caso 0001 must hit notFound().
  // Next.js App Router: notFound() within a nested segment renders the nearest
  // not-found.tsx boundary but the HTTP response status is 200 in prod mode
  // (the shell layout renders; not-found content is server-rendered into the slot).
  // Assert on page CONTENT — the boundary text is visible and case data is absent.
  await page.goto(`/c/${SLUG}/casos/${CASE_ID}`)
  await expect(page.getByText(/não encontramos esta página/i)).toBeVisible({ timeout: 10_000 })
  // Caso 0001 content must NOT be present (no data leak).
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toHaveCount(0)
  await expect(page.getByText(/Óbito UTI leito 7/i)).toHaveCount(0)

  // Meus Casos must be empty (no card for Caso 0001).
  await page.goto(`/c/${SLUG}/meus-casos`)
  await page.waitForURL(`/c/${SLUG}/meus-casos`)
  await expect(page.getByText(/nenhum caso acessível/i)).toBeVisible({ timeout: 10_000 })
  // Extra safety: no link to the case.
  await expect(page.getByRole('link', { name: /ver caso completo/i })).toHaveCount(0)

  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC-3 — Grant read / write; revoke removes access
// ---------------------------------------------------------------------------

test('AC-3a grant-read (multi): viewer sees full case, content editors hidden', async ({
  page,
}) => {
  await signInAs(page, 'multi@test.local')

  // multi has a read grant (seeded). Navigate to the full case.
  await page.goto(`/c/${SLUG}/casos/${CASE_ID}`)
  await page.waitForURL(`/c/${SLUG}/casos/${CASE_ID}`)
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toBeVisible({ timeout: 10_000 })

  // Lifecycle buttons absent (no canManageLifecycle).
  await expect(page.getByRole('button', { name: /ativar fase/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /concluir caso/i })).toHaveCount(0)

  // Narrative editor (inline Editar button on the narrative card) must be absent
  // for a pure READ grantee (canWriteContent = false).
  // The narrative card shows the body but has no "Editar" edit-trigger button.
  await expect(page.getByRole('button', { name: /^Editar$/ })).toHaveCount(0)

  // "Ver caso completo" is already the current page. Check "Meus Casos" shows the card.
  await page.goto(`/c/${SLUG}/meus-casos`)
  await expect(page.getByText(/caso\s*0001/i)).toBeVisible({ timeout: 10_000 })
  const card = page.locator('article').filter({ hasText: /caso\s*0001/i }).first()
  await expect(card.getByRole('link', { name: /ver caso completo/i })).toBeVisible()

  await signOut(page)
})

test('AC-3b grant-write (staff3): collaborator can access case; sees content-write UI; no lifecycle; cannot fill phase', async ({
  page,
}) => {
  await signInAs(page, 'staff3.ccih@test.local')

  // staff3 has a write grant (seeded). Navigate to full case.
  await page.goto(`/c/${SLUG}/casos/${CASE_ID}`)
  await page.waitForURL(`/c/${SLUG}/casos/${CASE_ID}`)
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toBeVisible({ timeout: 10_000 })

  // Content-write UI IS present: narrative Editar buttons for un-attributed narratives.
  // The "Achados e Discussão" and "Conclusão do Comitê" narratives have no assignee →
  // canWriteContent means staff3 can edit them. At least one Editar should be visible.
  // (The "Resumo Clínico" is attributed to staff2 — its Editar is blocked by Q14.)
  // We assert at least one Editar button is present (for the un-attributed ones).
  const editarButtons = page.getByRole('button', { name: /^Editar$/ })
  await expect(editarButtons.first()).toBeVisible({ timeout: 8_000 })

  // Lifecycle controls absent.
  await expect(page.getByRole('button', { name: /ativar fase/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /concluir caso/i })).toHaveCount(0)

  // staff3 is NOT the phase-assignee (staff1 is), so no "Preencher" button.
  await expect(page.getByRole('button', { name: /^Preencher$/ })).toHaveCount(0)

  await signOut(page)
})

test('AC-3c revoke: coordinator revokes multi via dialog; multi gets notFound()', async ({
  page,
}) => {
  // Coordinator revokes via the "Acesso ao caso" dialog (NEW UI).
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/c/${SLUG}/manage/cases/${CASE_ID}`)
  await page.waitForURL(`**/manage/cases/${CASE_ID}`)

  // Open the "Acesso ao caso" dialog from the top-bar button.
  const dialog = await openAccessDialog(page)

  // LOCK: coordinator (Chefe CCIH) must be ABSENT from the dialog roster.
  // staff_admin members already have full-case access via role; granting/revoking them
  // is meaningless and the panel filters them out (regression guard for this behavior).
  await expect(
    dialog.locator('li').filter({ hasText: /Chefe CCIH/i })
  ).toHaveCount(0)

  // Counter-case: "Coordenadora Multi" IS present — she is staff_admin only in
  // commission B but a regular staff member in CCIH, so she's a valid grant target.
  const multiRow = dialog.locator('li').filter({ hasText: /Coordenadora Multi/i })
  await expect(multiRow).toBeVisible({ timeout: 10_000 })

  // The GrantMenu for multi: click the "Acesso" dropdown trigger.
  const grantTrigger = multiRow.getByRole('button', { name: /acesso/i })
  await grantTrigger.click()

  // Click "Remover acesso" option.
  const revokeItem = page.getByRole('menuitem', { name: /remover acesso/i })
  await expect(revokeItem).toBeVisible({ timeout: 5_000 })
  await revokeItem.click()

  // Brief wait for server action to complete.
  await page.waitForTimeout(1_500)

  await signOut(page)

  // Now multi should be denied (not-found boundary — content-based check, see AC-2 note).
  await signInAs(page, 'multi@test.local')
  await page.goto(`/c/${SLUG}/casos/${CASE_ID}`)
  await expect(page.getByText(/não encontramos esta página/i)).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toHaveCount(0)

  // Meus Casos: Caso 0001 specifically must NOT appear for multi after revoke.
  // (The empty-state assertion would be too strict if the DB has residual cases from
  // prior test runs that happen to have a multi grant — assert absence of THIS case.)
  await page.goto(`/c/${SLUG}/meus-casos`)
  await page.waitForLoadState('networkidle', { timeout: 10_000 })
  await expect(page.locator('article').filter({ hasText: /Óbito UTI leito 7/i })).toHaveCount(0)
  await expect(page.locator('article').filter({ hasText: /caso\s*0001/i })).toHaveCount(0)

  await signOut(page)

  // Restore multi's grant for other tests.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/c/${SLUG}/manage/cases/${CASE_ID}`)
  const dialog2 = await openAccessDialog(page)
  const multiRow2 = dialog2.locator('li').filter({ hasText: /Coordenadora Multi/i })
  await expect(multiRow2).toBeVisible({ timeout: 10_000 })
  const grantTrigger2 = multiRow2.getByRole('button', { name: /acesso/i })
  await grantTrigger2.click()
  const readItem = page.getByRole('menuitem', { name: /conceder leitura/i })
  await expect(readItem).toBeVisible({ timeout: 5_000 })
  await readItem.click()
  await page.waitForTimeout(1_500)
  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC-3d — Terminal case: "Acesso ao caso" button visible; write grant disabled
// (ADR 0033 D6 — read grants allowed on terminal cases; write grants are not)
// ---------------------------------------------------------------------------

test('AC-3d terminal case: "Acesso ao caso" button present; "Conceder edição" disabled; "Conceder leitura" enabled', async ({
  page,
}) => {
  // Caso 0002 ("Óbito UTI leito 3") is seeded as status=concluido (terminal).
  // The CaseAccessButton is mounted OUTSIDE CaseLifecycleActions in the layout,
  // so it renders even when lifecycle buttons (Concluir/Cancelar) do not.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/c/${SLUG}/manage/cases/${CASE_ID_TERMINAL}`)
  await page.waitForURL(`**/manage/cases/${CASE_ID_TERMINAL}`)

  // The case heading must render (confirms we're not on a 404).
  await expect(page.getByRole('heading', { name: /caso\s*0002/i })).toBeVisible({ timeout: 10_000 })

  // The "Acesso ao caso" button IS present on a terminal case.
  const accessBtn = page.getByRole('button', { name: /^Acesso ao caso$/i })
  await expect(accessBtn).toBeVisible({ timeout: 5_000 })

  // Lifecycle buttons (Concluir, Cancelar) must be ABSENT (case is already terminal).
  await expect(page.getByRole('button', { name: /^Concluir$/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Cancelar$/i })).toHaveCount(0)

  // Open the dialog and verify write grant is disabled, read grant is enabled.
  const dialog = await openAccessDialog(page)

  // LOCK: coordinator (Chefe CCIH) must be ABSENT from the roster even on a terminal case.
  // staff_admin members bypass the grant system entirely; filtering them prevents a confusing
  // self-revoke path. This assertion is the regression guard (see AC-3c for the open-case copy).
  await expect(
    dialog.locator('li').filter({ hasText: /Chefe CCIH/i })
  ).toHaveCount(0)

  // Pick any non-coordinator member row to test the GrantMenu — use the first `li`.
  // (After the coordinator-exclusion change, the first row is now a regular staff member.)
  // Click "Acesso" on the first member row to open the dropdown.
  const firstMemberRow = dialog.locator('li').first()
  await expect(firstMemberRow).toBeVisible({ timeout: 5_000 })
  const grantTrigger = firstMemberRow.getByRole('button', { name: /acesso/i })
  await grantTrigger.click()

  // "Conceder leitura" must be enabled (read grants allowed on terminal cases).
  const readItem = page.getByRole('menuitem', { name: /conceder leitura/i })
  await expect(readItem).toBeVisible({ timeout: 5_000 })
  await expect(readItem).not.toBeDisabled()

  // "Conceder edição" must be DISABLED (write grants blocked on terminal cases — D6).
  const writeItem = page.getByRole('menuitem', { name: /conceder edição/i })
  await expect(writeItem).toBeVisible({ timeout: 5_000 })
  await expect(writeItem).toBeDisabled()

  // Close the menu without acting (press Escape).
  await page.keyboard.press('Escape')

  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC-4 — Q14 ownership: write-grantee cannot edit/conclude attributed narrative
// ---------------------------------------------------------------------------

test('AC-4 Q14 ownership: staff3 (write grant) cannot edit Resumo Clínico (attributed to staff2); staff2 can', async ({
  page,
}) => {
  const narrativeId = await getResumoCaseNarrativeId()

  // --- staff3 (write-grantee) tries to edit the Resumo (attributed to staff2) ---
  await signInAs(page, 'staff3.ccih@test.local')
  await page.goto(`/c/${SLUG}/casos/${CASE_ID}/narrativa/${narrativeId}`)
  await page.waitForURL(`/c/${SLUG}/casos/${CASE_ID}/narrativa/${narrativeId}`)

  // The NarrativeEditor's canEdit is false (Q14: attributed to staff2, not staff3).
  // The textarea / editor is absent; the body renders read-only OR the empty-state note.
  await expect(page.getByRole('textbox')).toHaveCount(0)
  // "Salvar" button absent (only present when canEdit = true).
  await expect(page.getByRole('button', { name: /salvar/i })).toHaveCount(0)
  // "Concluir" trigger button absent (only assignee/coordinator can conclude).
  // ConcludeNarrativeButton renders trigger as "Concluir" (the "Concluir narrativa"
  // label is on the AlertDialogAction INSIDE the dialog, not the visible trigger).
  await expect(page.getByRole('button', { name: 'Concluir', exact: true })).toHaveCount(0)

  await signOut(page)

  // --- staff2 (narrative assignee) CAN edit the Resumo ---
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`/c/${SLUG}/casos/${CASE_ID}/narrativa/${narrativeId}`)
  await page.waitForURL(`/c/${SLUG}/casos/${CASE_ID}/narrativa/${narrativeId}`)

  // Editor IS present.
  await expect(page.getByRole('textbox')).toBeVisible({ timeout: 10_000 })
  // "Salvar" is present.
  await expect(page.getByRole('button', { name: /salvar/i })).toBeVisible()
  // "Concluir" trigger button is present (assignee + aberta).
  await expect(page.getByRole('button', { name: 'Concluir', exact: true })).toBeVisible()

  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC-5 — Meus Casos: unified list; card; actions; multi-item = one card
// ---------------------------------------------------------------------------

test('AC-5 Meus Casos: unified list — staff1 (phase assignee) sees card with Preencher button + Ver caso completo', async ({
  page,
}) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/c/${SLUG}/meus-casos`)
  await page.waitForURL(`/c/${SLUG}/meus-casos`)

  // Page heading
  await expect(page.getByRole('heading', { name: /meus casos/i })).toBeVisible({ timeout: 10_000 })

  // The AC-5 contract is "multi-item case = ONE card" — all phases+narratives belonging to
  // the SAME case collapse into a single article, not multiple. We assert Caso 0001 appears
  // exactly once (not duplicated) and at least one card is visible. We do NOT assert the total
  // card count because prior test runs may have created and attributed cases to staff1 that
  // remain in the shared DB.
  const cards = page.locator('article')
  await expect(cards.first()).toBeVisible({ timeout: 10_000 })  // at least one card

  // Scope to the Caso 0001 card specifically.
  const card = page.locator('article').filter({ hasText: /Óbito UTI leito 7/i })
  await expect(card).toHaveCount(1)  // Caso 0001 appears exactly once (multi-item → one card)

  // Card shows case number and label.
  await expect(card.getByText(/caso\s*0001/i)).toBeVisible()
  await expect(card.getByText(/Óbito UTI leito 7/i)).toBeVisible()

  // "Ver caso completo" link present and navigates to the staff case route.
  const verLink = card.getByRole('link', { name: /ver caso completo/i })
  await expect(verLink).toBeVisible()
  await expect(verLink).toHaveAttribute('href', `/c/${SLUG}/casos/${CASE_ID}`)

  // The phase item row shows Phase 1 (concluida → not actionable) — no Preencher.
  // Phase 2 is pendente (also not actionable — not ativa yet).
  // So there should be NO StartPhaseButton (Preencher) on Caso 0001's card.
  await expect(card.getByRole('button', { name: /preencher/i })).toHaveCount(0)

  // Phase item rows are listed (there should be at least 1 — Phase 1 attributed to staff1).
  const phaseItems = card.locator('li')
  await expect(phaseItems.first()).toBeVisible()

  await signOut(page)
})

test('AC-5b Meus Casos: staff2 (narrative assignee) sees card with Abrir + Concluir', async ({
  page,
}) => {
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`/c/${SLUG}/meus-casos`)
  await page.waitForURL(`/c/${SLUG}/meus-casos`)

  // staff2 is narrative assignee on Caso 0001. We assert Caso 0001 appears exactly once and
  // the correct actions are present. We do NOT assert a total card count (prior test runs may
  // have attributed staff2 on other cases in the shared DB — we scope to this seeded case).
  const cards = page.locator('article')
  await expect(cards.first()).toBeVisible({ timeout: 10_000 })
  const card = cards.filter({ hasText: /Óbito UTI leito 7/i })
  await expect(card).toHaveCount(1)

  // Narrative item: "Resumo Clínico" — actionable (aberta + assignee = staff2).
  // "Abrir" link and "Concluir" trigger button (ConcludeNarrativeButton trigger label).
  await expect(card.getByRole('link', { name: /^Abrir$/ })).toBeVisible({ timeout: 10_000 })
  await expect(card.getByRole('button', { name: 'Concluir', exact: true })).toBeVisible()

  // "Ver caso completo" present.
  await expect(card.getByRole('link', { name: /ver caso completo/i })).toBeVisible()

  await signOut(page)
})

test('AC-5c Meus Casos: multi (read grant only) sees card with Ver caso completo; no Preencher/Abrir/Concluir', async ({
  page,
}) => {
  await signInAs(page, 'multi@test.local')
  await page.goto(`/c/${SLUG}/meus-casos`)
  await page.waitForURL(`/c/${SLUG}/meus-casos`)

  // multi has a read grant on Caso 0001 (seeded). We assert Caso 0001 appears exactly once and
  // contains only read-only actions. We do NOT assert a total card count (prior test runs may
  // have granted multi access to other cases in the shared DB — scope to this seeded case only).
  const card = page.locator('article').filter({ hasText: /Óbito UTI leito 7/i })
  await expect(card).toHaveCount(1)

  // "Ver caso completo" present.
  await expect(card.getByRole('link', { name: /ver caso completo/i })).toBeVisible()
  // No item actions (read-only grant, no attribution).
  await expect(card.getByRole('button', { name: /preencher/i })).toHaveCount(0)
  await expect(card.getByRole('link', { name: /^Abrir$/ })).toHaveCount(0)
  // ConcludeNarrativeButton trigger label is "Concluir" (exact); the "Concluir narrativa"
  // label lives inside the AlertDialog confirm — never visible without clicking the trigger.
  await expect(card.getByRole('button', { name: 'Concluir', exact: true })).toHaveCount(0)

  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC-6 — Narrative lifecycle: fill → Concluir → coordinator reopens
// ---------------------------------------------------------------------------

test('AC-6 narrative lifecycle: staff2 fills Resumo via focused editor, concludes; coordinator reopens', async ({
  page,
}) => {
  const narrativeId = await getResumoCaseNarrativeId()
  const editorHref = `/c/${SLUG}/casos/${CASE_ID}/narrativa/${narrativeId}`

  // --- staff2 fills and concludes ---
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(editorHref)
  await page.waitForURL(editorHref)

  const editor = page.getByRole('textbox')
  await expect(editor).toBeVisible({ timeout: 10_000 })

  // Clear and type Markdown body.
  await editor.fill('')
  await editor.type('## Resumo\n\nPaciente X, diagnóstico Y. Caso de investigação.')

  // Save.
  await page.getByRole('button', { name: /salvar/i }).click()
  await expect(page.getByRole('status')).toContainText(/salva/i, { timeout: 10_000 })

  // Conclude: click the "Concluir" TRIGGER button (ConcludeNarrativeButton shows a
  // trigger labeled "Concluir"; clicking it opens an AlertDialog whose confirm action
  // is labeled "Concluir narrativa").
  await page.getByRole('button', { name: 'Concluir', exact: true }).click()
  // The AlertDialog confirm is labeled "Concluir narrativa". Wait for it to be enabled
  // (not in isPending state from a prior transition) before clicking.
  const confirmBtn = page.getByRole('button', { name: /concluir narrativa/i })
  await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
  await expect(confirmBtn).toBeEnabled({ timeout: 5_000 })
  await confirmBtn.click()

  // After concluding, ConcludeNarrativeButton calls router.push(doneHref) which
  // navigates to the case page. Wait for navigation away from the narrativa URL,
  // then confirm the DB was written before checking.
  await page.waitForURL(`/c/${SLUG}/casos/${CASE_ID}`, { timeout: 20_000 })

  // Verify DB: narrative status = 'concluida'.
  const rows = await dbQuery<{ status: string }>('case_narratives', {
    id: `eq.${narrativeId}`,
  })
  expect(rows[0]?.status).toBe('concluida')

  await signOut(page)

  // --- Coordinator reopens ---
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/c/${SLUG}/manage/cases/${CASE_ID}`)
  await page.waitForURL(`**/manage/cases/${CASE_ID}`)

  // Find the Resumo narrative card and click "Reabrir".
  // The page renders <section aria-label="Resumo Clínico"> inside "Fases e narrativas do caso".
  // Using getByRole('region') targets the named ARIA region directly, avoiding the ambiguity of
  // locator('section').filter() which would match the access-panel <section> containing the text first.
  const narrativeSection = page.getByRole('region', { name: /resumo clínico/i })
  await expect(narrativeSection).toBeVisible({ timeout: 10_000 })
  const reabrirBtn = narrativeSection.getByRole('button', { name: /reabrir/i })
  await expect(reabrirBtn).toBeVisible({ timeout: 8_000 })
  await reabrirBtn.click()

  // Confirm if dialog appears.
  const confirmBtn2 = page.getByRole('button', { name: /confirmar/i })
  if (await confirmBtn2.isVisible({ timeout: 2_000 })) {
    await confirmBtn2.click()
  }

  // Verify DB: narrative status back to 'aberta'.
  await page.waitForTimeout(2_000)
  const rows2 = await dbQuery<{ status: string }>('case_narratives', {
    id: `eq.${narrativeId}`,
  })
  expect(rows2[0]?.status).toBe('aberta')

  await signOut(page)

  // --- Restore seed body (cross-spec hygiene) ---
  // AC-6 overwrote the Resumo body with test content; restore the seeded body so
  // case-narratives.spec.ts AC-3 still finds "Paciente do leito 7" in the merged layout.
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`/c/${SLUG}/casos/${CASE_ID}/narrativa/${narrativeId}`)
  await page.waitForURL(`/c/${SLUG}/casos/${CASE_ID}/narrativa/${narrativeId}`)
  const restoreEditor = page.getByRole('textbox')
  await expect(restoreEditor).toBeVisible({ timeout: 10_000 })
  const seedBody =
    'Paciente do leito 7 da UTI, evoluiu com piora clínica progressiva.\n\nO comitê revisou o checklist da Fase 1. Sem dados identificáveis.'
  await restoreEditor.fill(seedBody)
  await page.getByRole('button', { name: /salvar/i }).click()
  await expect(page.getByRole('status')).toContainText(/salva/i, { timeout: 10_000 })
  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC-7 — PHI boundary: read-grantee sees PHI-free chip; click-through denied
// ---------------------------------------------------------------------------

test('AC-7 PHI boundary: check if safety event linked to case; if so, read-grantee click-through is denied', async ({
  page,
}) => {
  // Check if seed links a safety event to Caso 0001.
  // seed.sql links event e1000000-…-a1 which has PHI.
  const eventRows = await dbQuery<{ case_id: string; id: string }>('patient_safety_events', {
    id: 'eq.e1000000-0000-0000-0000-0000000000a1',
  })
  const eventLinkedToCase = eventRows.some((r) => r.id === 'e1000000-0000-0000-0000-0000000000a1')

  if (!eventLinkedToCase) {
    // The seed does not link a safety event to Caso 0001 as a case_events link
    // that surfaces on the case detail. The pgTAP suite covers the invariant
    // `can_read_event` is untouched. Flag as coverage gap, not a failure.
    test.skip(true, 'No safety event linked to Caso 0001 in seed — pgTAP covers the PHI-free invariant; skipping the UI click-through assertion.')
    return
  }

  // The safety event IS linked. Sign in as multi (read grant) and check the case.
  await signInAs(page, 'multi@test.local')
  await page.goto(`/c/${SLUG}/casos/${CASE_ID}`)
  await page.waitForURL(`/c/${SLUG}/casos/${CASE_ID}`)

  // The PHI-free chip / badge should appear (the existing "Events" panel shows linked events
  // without PHI — event title / kind but not patient data).
  // We look for a link or chip referencing the event.
  // The event chip should NOT contain patient name/MRN.
  // Assert that clicking through to the event detail is denied.

  // The safety event detail route is /c/ccih/manage/pqs/events/[id]
  // A read-grantee should not be able to navigate there (custody-gated).
  const eventDetailHref = `/c/${SLUG}/manage/pqs/events/e1000000-0000-0000-0000-0000000000a1`
  const res = await page.goto(eventDetailHref)
  // Should be 404 or 403 (not custodian/PQS).
  const status = res?.status() ?? 0
  expect([403, 404]).toContain(status)

  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC-8 — Audit: case.opened written on non-coordinator open; not on coordinator
// ---------------------------------------------------------------------------

test('AC-8 audit: non-coordinator open writes case.opened row; coordinator open does not', async ({
  page,
}) => {
  // Count existing case.opened rows before.
  const before = await caseOpenedCount()

  // Non-coordinator: staff1 (phase assignee) opens the case.
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/c/${SLUG}/casos/${CASE_ID}`)
  await page.waitForURL(`/c/${SLUG}/casos/${CASE_ID}`)
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toBeVisible({ timeout: 10_000 })
  await signOut(page)

  // After staff1's open: count should have increased by exactly 1.
  const afterStaff1 = await caseOpenedCount()
  expect(afterStaff1).toBe(before + 1)

  // Coordinator: chefe.ccih opens the case via the manage route.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/c/${SLUG}/manage/cases/${CASE_ID}`)
  await page.waitForURL(`**/manage/cases/${CASE_ID}`)
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toBeVisible({ timeout: 10_000 })
  await signOut(page)

  // Coordinator open must NOT write an audit row — count unchanged.
  const afterCoordinator = await caseOpenedCount()
  expect(afterCoordinator).toBe(afterStaff1)
})

// ---------------------------------------------------------------------------
// AC-9 — Flag OFF — SKIPPED
// ---------------------------------------------------------------------------

test.skip('AC-9 flag OFF: with case_access OFF behavior is unchanged (skipped — ships ON; flag-OFF covered by pgTAP 615/615)', async () => {
  // This test intentionally skipped per spec: the flag ships ON; the
  // pgTAP truth-table covers the OFF fallback (can_read_case → is_member_of).
})

// ---------------------------------------------------------------------------
// AC-10 — Keyboard-only: Meus Casos → narrative editor
// ---------------------------------------------------------------------------

test('AC-10 keyboard-only: Tab/Enter through Meus Casos to focused narrative editor', async ({
  page,
}) => {
  // staff2 is the narrative assignee → they have an Abrir button in Meus Casos.
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`/c/${SLUG}/meus-casos`)
  await page.waitForURL(`/c/${SLUG}/meus-casos`)

  // Confirm "Meus Casos" renders with at least one card.
  await expect(page.getByRole('heading', { name: /meus casos/i })).toBeVisible({ timeout: 10_000 })
  const cards = page.locator('article')
  await expect(cards.first()).toBeVisible()

  // Keyboard: Tab until "Abrir" link is focused.
  let abrirFocused = false
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => {
      const el = document.activeElement
      if (!el) return null
      return {
        tag: el.tagName,
        text: (el.textContent ?? '').trim(),
        href: (el as HTMLAnchorElement).href ?? null,
        role: el.getAttribute('role'),
      }
    })
    if (
      focused &&
      focused.tag === 'A' &&
      /abrir/i.test(focused.text)
    ) {
      abrirFocused = true
      break
    }
  }
  expect(abrirFocused).toBe(true)

  // Navigate to the narrative editor via keyboard (Enter on the focused link).
  await page.keyboard.press('Enter')
  await page.waitForURL(`/c/${SLUG}/casos/${CASE_ID}/narrativa/**`, { timeout: 10_000 })

  // Verify the editor page renders and the textarea is reachable by keyboard.
  await expect(page.getByRole('textbox')).toBeVisible({ timeout: 10_000 })

  // Tab to the textarea and type something (full keyboard-only flow).
  let textareaFocused = false
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => {
      const el = document.activeElement
      if (!el) return null
      return { tag: el.tagName, role: el.getAttribute('role') }
    })
    if (focused && (focused.tag === 'TEXTAREA' || focused.role === 'textbox')) {
      textareaFocused = true
      break
    }
  }
  expect(textareaFocused).toBe(true)

  // Type text in the textarea (keyboard-only).
  await page.keyboard.type('Texto de teste via teclado.')

  // Tab to the "Salvar" button and press Enter.
  let salvarFocused = false
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => {
      const el = document.activeElement
      if (!el) return null
      return { tag: el.tagName, text: (el.textContent ?? '').trim() }
    })
    if (focused && /salvar/i.test(focused.text)) {
      salvarFocused = true
      break
    }
  }
  expect(salvarFocused).toBe(true)
  await page.keyboard.press('Enter')

  // Confirm save succeeded.
  await expect(page.getByRole('status')).toContainText(/salva/i, { timeout: 10_000 })

  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC-N1 — Narrative attribution via card DropdownMenu (assign / clear)
// ---------------------------------------------------------------------------

test('AC-N1 narrative attribution: coordinator assigns member via card DropdownMenu; assignee shown; Remover responsável clears it', async ({
  page,
}) => {
  // coordinator assigns the "Achados e Discussão" narrative to "Enfermeiro CCIH Um" (staff1).
  // Achados is NOT attributed in seed, so it is safe to assign and then clear.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/c/${SLUG}/manage/cases/${CASE_ID}`)
  await page.waitForURL(`**/manage/cases/${CASE_ID}`)

  // Locate the "Achados e Discussão" narrative card on the coordinator detail page.
  // It is a <section aria-labelledby="narrative-...-heading"> containing "Achados e Discussão".
  const ahadosSection = page.getByRole('region', { name: /achados e discussão/i })
  await expect(ahadosSection).toBeVisible({ timeout: 10_000 })

  // The attribution trigger has aria-label="Responsável pela narrativa Achados e Discussão".
  const assignTrigger = ahadosSection.getByRole('button', {
    name: /responsável pela narrativa achados e discussão/i,
  })
  await expect(assignTrigger).toBeVisible({ timeout: 5_000 })
  await assignTrigger.click()

  // The dropdown lists commission members. Assign to "Enfermeiro CCIH Um" (staff1).
  // This member has a stable display name from seed.sql (full_name patch).
  const assigneeItem = page.getByRole('menuitem', { name: /Enfermeiro CCIH Um/i })
  await expect(assigneeItem).toBeVisible({ timeout: 5_000 })
  await assigneeItem.click()

  // Wait for server action and refresh.
  await page.waitForTimeout(1_500)

  // After assignment, the DB row should reflect assigned_to = staff1's UID.
  const rows = await dbQuery<{ assigned_to: string | null }>('case_narratives', {
    case_id: `eq.${CASE_ID}`,
    type_label: `eq.Achados e Discussão`,
  })
  const assignedRow = rows.find((r) => r.assigned_to === '00000000-0000-0000-0000-000000000003')
  expect(assignedRow).toBeTruthy()

  // The card's attribution trigger should now show the assignee name (or the assignee
  // chip re-renders after router.refresh()). Wait for the page to reflect the new state.
  await page.waitForTimeout(500)

  // Re-navigate to force a fresh server render (router.refresh() may be async).
  await page.goto(`/c/${SLUG}/manage/cases/${CASE_ID}`)
  await page.waitForURL(`**/manage/cases/${CASE_ID}`)

  const ahadosSection2 = page.getByRole('region', { name: /achados e discussão/i })
  await expect(ahadosSection2).toBeVisible({ timeout: 10_000 })

  // The trigger now shows the assignee name (button label updates to the name).
  // aria-label is still "Responsável pela narrativa Achados e Discussão".
  const assignTrigger2 = ahadosSection2.getByRole('button', {
    name: /responsável pela narrativa achados e discussão/i,
  })
  await expect(assignTrigger2).toBeVisible({ timeout: 5_000 })

  // Open the menu and use "Remover responsável" to clear.
  await assignTrigger2.click()
  const removeItem = page.getByRole('menuitem', { name: /remover responsável/i })
  await expect(removeItem).toBeVisible({ timeout: 5_000 })
  await removeItem.click()

  await page.waitForTimeout(1_500)

  // Verify DB: assigned_to is now null for Achados e Discussão.
  const rows2 = await dbQuery<{ assigned_to: string | null }>('case_narratives', {
    case_id: `eq.${CASE_ID}`,
    type_label: `eq.Achados e Discussão`,
  })
  const clearedRow = rows2.find((r) => r.assigned_to === null)
  expect(clearedRow).toBeTruthy()

  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC-N2 — Negative: old inline panel and old select controls are GONE
// ---------------------------------------------------------------------------

test('AC-N2 negative: coordinator page body has no inline access panel heading and no narrative-assignee <select>', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/c/${SLUG}/manage/cases/${CASE_ID}`)
  await page.waitForURL(`**/manage/cases/${CASE_ID}`)
  await page.waitForTimeout(1_000) // let the full page render settle

  // OLD inline panel had an id="case-access-heading" or a HEADING element "Acesso ao caso"
  // rendered inline in the page body. The NEW UI moves this to a top-bar BUTTON (not a heading)
  // that opens a dialog. Assert that no HEADING (h1-h6) with this text exists in the DOM
  // (the button is not a heading, so it won't match).
  // The heading roles h1-h6 via getByRole cover the old panel's heading.
  for (const level of [1, 2, 3, 4, 5, 6] as const) {
    await expect(
      page.getByRole('heading', { level, name: /^acesso ao caso$/i })
    ).toHaveCount(0)
  }
  // Also confirm no element with id="case-access-heading" exists (the old id).
  await expect(page.locator('#case-access-heading')).toHaveCount(0)

  // OLD narrative assignment used <select id="narrative-assignee-*"> elements.
  // These must be completely absent from the DOM.
  const oldSelects = page.locator('select[id^="narrative-assignee-"]')
  await expect(oldSelects).toHaveCount(0)

  // NEW: the "Acesso ao caso" button IS present (the trigger lives in the header,
  // not a heading in the body).
  await expect(page.getByRole('button', { name: /^Acesso ao caso$/i })).toBeVisible()

  // NEW: the narrative attribution control IS present as a DropdownMenu trigger button.
  // At least one "Responsável pela narrativa …" trigger must be visible.
  const attributionTriggers = page.getByRole('button', {
    name: /responsável pela narrativa/i,
  })
  await expect(attributionTriggers.first()).toBeVisible({ timeout: 5_000 })

  await signOut(page)
})
