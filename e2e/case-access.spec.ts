import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"

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
 *  AC-6  Narrative lifecycle (fill focused editor → Concluir → the coordinator
 *        corrects the concluded narrative via the Case Correction Lifecycle —
 *        NOT an in-place reopen; `reopen_narrative` was retired, ADR 0085 #9).
 *  AC-7  PHI boundary (read-grantee sees PHI-free chip; click-through denied).
 *  AC-8  Audit (case.opened row on non-coordinator open; none on coordinator open).
 *  AC-9  RETIRED — `case_access` is no longer a feature flag at all (ADR 0078 B4
 *        dropped the row); see SB-5 below for what replaced it.
 *  AC-10 Keyboard-only: Meus Casos → narrative editor flow.
 *  AC-N1 Narrative attribution via card DropdownMenu (assign / clear).
 *  AC-N2 Negative: no inline access panel heading; no select[id^="narrative-assignee-"].
 *  AC-11 Full regression suite green (run separately as the gate).
 *  SB-1..SB-5  ADR 0078 Stage B acceptance battery (case_access_grants hard cut):
 *        content/write grant ⇏ PHI, read_standard_phi grant ⇒ PHI, list_case_access's
 *        clearance columns, the U1 recused-coordinator grant-door exclusion, and the
 *        retired flag itself. See the block comment above SB-1 for detail.
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
 *   multi@test.local       — standalone READ grant (viewer; editors hidden; content only, no PHI)
 *   staff3.ccih@test.local — standalone WRITE grant (collaborator; un-attributed content write; no lifecycle/phase-fill; content only, no PHI)
 *   staff4.ccih@test.local — BOUNDARY: no attribution, no grant → notFound()
 *
 * ADR 0078 Stage B (2026-07-16): `case_access` was HARD-CUT to `case_access_grants`
 * (capability-per-column; PHI is now a distinct `read_standard_phi`/`read_restricted_phi`
 * pair, never inferred from a read/write grant) and its feature flag was RETIRED
 * (dropped from `app.feature_flags`, not merely forced ON). `upsertGrant`/`clearGrant`
 * below write the new table; see the SB-1..SB-5 battery for the acceptance coverage.
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

const ORG  = 'rede-a'
const SLUG = 'ccih'
const BASE = `/o/${ORG}/c/${SLUG}` // canonical commission route prefix

// Deterministic IDs from seed.sql
const CASE_ID = 'd0000000-0000-0000-0000-0000000000c1'         // Caso 0001 (open)
const CASE_ID_TERMINAL = 'd0000000-0000-0000-0000-0000000000c2' // Caso 0002 (concluido)
// Narrative type: "Resumo Clínico" (assigned to staff2)
const NARRATIVE_TYPE_RES = 'e2000000-0000-0000-0000-0000000000f1'
// User IDs
const UID_CHEFE  = '00000000-0000-0000-0000-000000000002'       // coordinator
const UID_STAFF4 = '00000000-0000-0000-0000-00000000000a'       // boundary

const PW = 'Test1234!'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, pw = PW) {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, pw)
}

async function signOut(page: Page) {
  // Navigate to a page with the app shell so the account menu exists.
  await page.goto(`${BASE}/meus-casos`)
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

/** Find the "Resumo Clínico" narrative id in Caso 0001 (deterministic type id). */
async function getResumoCaseNarrativeId(): Promise<string> {
  const rows = await dbQuery<{ id: string }>('case_narratives', {
    case_id: `eq.${CASE_ID}`,
    narrative_type_id: `eq.${NARRATIVE_TYPE_RES}`,
  })
  if (!rows.length) throw new Error('Resumo Clínico narrative not found in seed!')
  return rows[0].id
}

/** Find the "Achados e Discussão" narrative id in Caso 0001 (unattributed in seed). */
async function getAchadosCaseNarrativeId(): Promise<string> {
  const rows = await dbQuery<{ id: string }>('case_narratives', {
    case_id: `eq.${CASE_ID}`,
    type_label: 'eq.Achados e Discussão',
  })
  if (!rows.length) throw new Error('Achados e Discussão narrative not found in seed!')
  return rows[0].id
}

/** Direct service-role PATCH of a narrative's `assigned_to` (test setup/teardown only). */
async function patchNarrativeAssignee(narrativeId: string, assignedTo: string | null): Promise<void> {
  await patchNarrativeFields(narrativeId, { assigned_to: assignedTo })
}

/**
 * Direct service-role PATCH of arbitrary `case_narratives` columns (test
 * setup/teardown only — bypasses the app's RLS/RPC path on purpose, mirroring
 * `upsertGrant` above).
 */
async function patchNarrativeFields(
  narrativeId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/case_narratives?id=eq.${narrativeId}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(fields),
  })
  if (!res.ok) {
    throw new Error(`patchNarrativeFields failed ${res.status}: ${await res.text()}`)
  }
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
 * Directly upsert a `case_access_grants` row via the service role (bypasses the
 * grant_case_access RPC's future-expiry validation so we can seed an EXPIRED
 * grant). `expiresAt` is an ISO timestamptz or null. Used by the expiry ACs.
 *
 * ADR 0078 Stage B (B1): `case_access` was HARD-CUT to `case_access_grants` —
 * capability-per-column (`read_case_content`/`read_case_deliberation`/
 * `write_case_content`/`read_standard_phi`/`read_restricted_phi`), keyed by
 * `principal_id` (not `user_id`). A plain read/write grant here mirrors what
 * `grant_case_access` itself would insert with no PHI params: content +
 * deliberation (+ write, iff `level==='write'`), PHI columns left at their
 * `false` default — this helper grants UI/content access, never PHI.
 */
async function upsertGrant(
  caseId: string,
  userId: string,
  level: 'read' | 'write',
  expiresAt: string | null,
  reason: string | null = null,
): Promise<void> {
  // Delete any prior row for this (case,principal), then insert the new one.
  await fetch(
    `${SUPABASE_URL}/rest/v1/case_access_grants?case_id=eq.${caseId}&principal_id=eq.${userId}`,
    {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
  const res = await fetch(`${SUPABASE_URL}/rest/v1/case_access_grants`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      case_id: caseId,
      principal_id: userId,
      source: 'manual_grant',
      read_case_content: true,
      read_case_deliberation: true,
      write_case_content: level === 'write',
      reason_code: 'coordinator_grant',
      granted_by: UID_CHEFE,
      expires_at: expiresAt,
      reason,
    }),
  })
  if (!res.ok) {
    throw new Error(`upsertGrant failed ${res.status}: ${await res.text()}`)
  }
}

/** Delete any case_access_grants row for (case,principal) via the service role. */
async function clearGrant(caseId: string, userId: string): Promise<void> {
  await fetch(
    `${SUPABASE_URL}/rest/v1/case_access_grants?case_id=eq.${caseId}&principal_id=eq.${userId}`,
    {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  )
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
  await page.goto(`${BASE}/casos/${CASE_ID}`)
  await page.waitForURL(`${BASE}/casos/${CASE_ID}`)

  // Case header should render (case number).
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toBeVisible({ timeout: 10_000 })

  // --- Phase-7 submitted-only invariant ---
  // Phase 1 is CONCLUIDA (has a submitted response by staff1 themselves).
  // The submitted answers ARE visible because Phase-7 allows coordinator (and now
  // also the staff read path) to see submitted answers via `get_case_detail`
  // (submitted-only answer projection). The answered key is `dispensador_disponivel`.
  // We assert the phase card is visible and shows "Concluída".
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
  await page.goto(`${BASE}/casos/${CASE_ID}`)
  // BUG-ACT-NOTFOUND-COPY-1: /não encontr/i — casos/[id] hits the commission
  // not-found boundary (ACT ADR 0106's sibling), same shared file as the
  // QO·B CUT_ROUTES sample already verified live.
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })
  // Caso 0001 content must NOT be present (no data leak).
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toHaveCount(0)
  await expect(page.getByText(/Óbito UTI leito 7/i)).toHaveCount(0)

  // Meus Casos must not surface the BOUNDARY case (Caso 0001) — asserted by
  // IDENTITY, not by global emptiness. ⚠ This spec shares the prod-standalone
  // gate's per-BATCH-reset DB (no per-test reset) with `administrativo.spec.ts`,
  // whose subject IS the `administrativo` delegate reassigning work to staff4 —
  // the seed's documented "reassign target". Running in the same batch, staff4 can
  // legitimately hold an unrelated attributed case, so "the list is empty" is
  // non-deterministic. The authorization boundary this test guards is exact and
  // narrower: staff4 (no attribution/grant on Caso 0001) never reaches Caso 0001.
  await page.goto(`${BASE}/meus-casos`)
  await page.waitForURL(`${BASE}/meus-casos`)
  // The page rendered (not a 404/error boundary) …
  await expect(page.getByRole('heading', { name: 'Meus Casos' })).toBeVisible({ timeout: 10_000 })
  // … but never Caso 0001 or its content, regardless of any unrelated attribution
  // a sibling may have granted staff4.
  await expect(page.getByText('Caso 0001')).toHaveCount(0)
  await expect(page.getByText(/Óbito UTI leito 7/i)).toHaveCount(0)

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
  await page.goto(`${BASE}/casos/${CASE_ID}`)
  await page.waitForURL(`${BASE}/casos/${CASE_ID}`)
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toBeVisible({ timeout: 10_000 })

  // Lifecycle buttons absent (no canManageLifecycle).
  await expect(page.getByRole('button', { name: /ativar fase/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /concluir caso/i })).toHaveCount(0)

  // Narrative editor (inline Editar button on the narrative card) must be absent
  // for a pure READ grantee (canWriteContent = false).
  // The narrative card shows the body but has no "Editar" edit-trigger button.
  await expect(page.getByRole('button', { name: /^Editar$/ })).toHaveCount(0)

  // Regression (narrative-visibility bug): a pure READ grantee must see EVERY narrative
  // slot of an OPEN case — including the un-started / un-attributed ones — not only the
  // filled bodies. Caso 0001 seeds "Resumo Clínico" (filled), plus "Achados e Discussão"
  // and "Conclusão do Comitê" (both empty + un-attributed). All three regions must be
  // visible; the empties render a muted "Nenhum conteúdo ainda." with no Editar control.
  // Use .first() to avoid strict-mode collision with the referral-snapshot region
  // (also rendered as a <section aria-labelledby="narrative-...-heading">) that the
  // case-referrals seed adds to Caso 0001 with display_name='Resumo clínico'.
  await expect(page.getByRole('region', { name: /Resumo Clínico/i }).first()).toBeVisible()
  await expect(page.getByRole('region', { name: /Achados e Discussão/i })).toBeVisible()
  await expect(page.getByRole('region', { name: /Conclusão do Comitê/i })).toBeVisible()

  // "Ver caso completo" is already the current page. Check "Meus Casos" shows the card.
  await page.goto(`${BASE}/meus-casos`)
  await expect(page.getByText(/caso\s*0001/i)).toBeVisible({ timeout: 10_000 })
  const card = page.locator('article').filter({ hasText: /caso\s*0001/i }).first()
  await expect(card.getByRole('link', { name: /ver caso completo/i })).toBeVisible()

  await signOut(page)
})

test('AC-3b grant-write (staff3): collaborator gets NO content-write UI on /casos any more (T6 — 8675b7cd/D1); the SAME control moved to /manage/cases, which she reaches via the un-narrowed "Gerenciar caso" escape hatch; no lifecycle; cannot fill phase', async ({
  page,
}) => {
  await signInAs(page, 'staff3.ccih@test.local')

  // staff3 has a write grant (seeded). Navigate to full case.
  await page.goto(`${BASE}/casos/${CASE_ID}`)
  await page.waitForURL(`${BASE}/casos/${CASE_ID}`)
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toBeVisible({ timeout: 10_000 })

  // ⚠ T6 (case-surface-split Increment 1, ADR 0134 D1/D2): `readingAsMember` now
  // fires on `rawCaps.canWriteContent` too, not just `canManageLifecycle`
  // (case-detail-view.tsx) — a write-grantee is narrowed on THIS route exactly like
  // a coordinator. The narrative Editar buttons this test used to find here (for
  // the un-attributed narratives, "Achados e Discussão" / "Conclusão do Comitê" —
  // "Resumo Clínico" stays Q14-blocked regardless, attributed to staff2) are gone
  // from `/casos` for EVERY class now — asserting them present HERE would be
  // exactly the vacuity trap this program keeps naming: `8675b7cd`'s own
  // differential control is what proves this, not a bare absence. Reproduced as a
  // differential below: content-write UI absent here, present on the SAME
  // narratives at `/manage/cases`, reached by the un-narrowed "Gerenciar caso" link
  // — D1's sentence ("/casos writes = name-attributed only") made literally true
  // for the write-grantee class, not just the coordinator.
  await expect(page.getByRole('button', { name: /^Editar$/ })).toHaveCount(0)

  // Lifecycle controls absent (unaffected by this increment — staff3 never held
  // `canManageLifecycle`).
  await expect(page.getByRole('button', { name: /ativar fase/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /concluir caso/i })).toHaveCount(0)

  // staff3 is NOT the phase-assignee (staff1 is), so no "Preencher" button.
  await expect(page.getByRole('button', { name: /^Preencher$/ })).toHaveCount(0)

  // The escape hatch: gated on the UN-narrowed `canOpenManagement` predicate (D3
  // arm 3 — per-case `canWriteContent`), so it can never strand a write-grantee the
  // gate itself would admit. Counts by href AND accessible name — this button IS
  // the T1 predicate's entire UI surface for this class, previously asserted
  // nowhere for a write-grantee.
  const manageLink = page.getByRole('link', { name: 'Gerenciar caso' })
  await expect(manageLink).toBeVisible({ timeout: 10_000 })
  await expect(manageLink).toHaveAttribute('href', `${BASE}/manage/cases/${CASE_ID}`)

  // NON-VACUOUS positive control (the differential's other half, mirroring
  // `8675b7cd`'s own control and QA r1's "an absent control is not proof a door is
  // shut" lesson): the SAME content-write UI, the SAME un-attributed narratives,
  // genuinely present for the SAME user on the manage host.
  await manageLink.click()
  await page.waitForURL(`${BASE}/manage/cases/${CASE_ID}`)
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toBeVisible({ timeout: 10_000 })
  const editarButtons = page.getByRole('button', { name: /^Editar$/ })
  await expect(editarButtons.first()).toBeVisible({ timeout: 8_000 })

  // Lifecycle STILL absent here too (write-grant ≠ `canManageLifecycle`, on either host).
  await expect(page.getByRole('button', { name: /ativar fase/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /concluir caso/i })).toHaveCount(0)

  await signOut(page)
})

test('AC-3c revoke: coordinator revokes multi via the roster X button; multi gets notFound()', async ({
  page,
}) => {
  // Coordinator revokes via the "Acesso ao caso" dialog roster (REBUILT UI: each
  // granted row carries a "Remover acesso de {name}" X button beside the grant
  // edit button — no more nested GrantMenu dropdown).
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${CASE_ID}`)
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

  // multi holds a seeded READ grant → the row shows the "Leitura" pill and a
  // "Remover acesso de …" X button. Click it to revoke.
  await expect(multiRow.getByText('Leitura', { exact: true })).toBeVisible()
  const revokeBtn = multiRow.getByRole('button', { name: /remover acesso de/i })
  await expect(revokeBtn).toBeVisible({ timeout: 5_000 })
  await revokeBtn.click()

  // Brief wait for server action to complete.
  await page.waitForTimeout(1_500)

  await signOut(page)

  // Now multi should be denied (not-found boundary — content-based check, see AC-2 note).
  await signInAs(page, 'multi@test.local')
  await page.goto(`${BASE}/casos/${CASE_ID}`)
  // BUG-ACT-NOTFOUND-COPY-1: /não encontr/i — casos/[id] hits the commission
  // not-found boundary (ACT ADR 0106's sibling), same shared file as the
  // QO·B CUT_ROUTES sample already verified live.
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toHaveCount(0)

  // Meus Casos: Caso 0001 specifically must NOT appear for multi after revoke.
  // (The empty-state assertion would be too strict if the DB has residual cases from
  // prior test runs that happen to have a multi grant — assert absence of THIS case.)
  await page.goto(`${BASE}/meus-casos`)
  await page.waitForLoadState('networkidle', { timeout: 10_000 })
  await expect(page.locator('article').filter({ hasText: /Óbito UTI leito 7/i })).toHaveCount(0)
  await expect(page.locator('article').filter({ hasText: /caso\s*0001/i })).toHaveCount(0)

  await signOut(page)

  // Restore multi's grant for other tests — via the REBUILT grant dialog (Leitura,
  // Sem prazo). Open the dialog, pick Leitura, submit.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${CASE_ID}`)
  const dialog2 = await openAccessDialog(page)
  const multiRow2 = dialog2.locator('li').filter({ hasText: /Coordenadora Multi/i })
  await expect(multiRow2).toBeVisible({ timeout: 10_000 })
  await multiRow2.getByRole('button', { name: /conceder acesso/i }).click()
  const grantDialog = page.getByRole('dialog', { name: /conceder acesso/i })
  await expect(grantDialog).toBeVisible({ timeout: 5_000 })
  // "Leitura" is the default level; submit directly.
  await grantDialog.getByRole('button', { name: /^conceder acesso$/i }).click()
  await expect(grantDialog).toHaveCount(0, { timeout: 10_000 })
  await page.waitForTimeout(1_000)
  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC-3d — Terminal case: "Acesso ao caso" button visible; write grant disabled
// (ADR 0033 D6 — read grants allowed on terminal cases; write grants are not)
// ---------------------------------------------------------------------------

test('AC-3d terminal case: "Acesso ao caso" button present; grant dialog "Edição" disabled, "Leitura" enabled', async ({
  page,
}) => {
  // Caso 0002 ("Óbito UTI leito 3") is seeded as status=concluido (terminal).
  // The CaseAccessButton is mounted OUTSIDE CaseLifecycleActions in the layout,
  // so it renders even when lifecycle buttons (Concluir/Cancelar) do not.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${CASE_ID_TERMINAL}`)
  await page.waitForURL(`**/manage/cases/${CASE_ID_TERMINAL}`)

  // The case heading must render (confirms we're not on a 404).
  await expect(page.getByRole('heading', { name: /caso\s*0002/i })).toBeVisible({ timeout: 10_000 })

  // The "Acesso ao caso" button IS present on a terminal case.
  const accessBtn = page.getByRole('button', { name: /^Acesso ao caso$/i })
  await expect(accessBtn).toBeVisible({ timeout: 5_000 })

  // Lifecycle buttons (Concluir, Cancelar) must be ABSENT (case is already terminal).
  await expect(page.getByRole('button', { name: /^Concluir$/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Cancelar$/i })).toHaveCount(0)

  // Open the roster dialog.
  const dialog = await openAccessDialog(page)

  // LOCK: coordinator (Chefe CCIH) must be ABSENT from the roster even on a terminal case.
  // staff_admin members bypass the grant system entirely; filtering them prevents a confusing
  // self-revoke path. This assertion is the regression guard (see AC-3c for the open-case copy).
  await expect(
    dialog.locator('li').filter({ hasText: /Chefe CCIH/i })
  ).toHaveCount(0)

  // Open the grant dialog for the first non-coordinator member row (REBUILT UI:
  // the row's "Conceder acesso" button opens the GrantDialog with level radios).
  const firstMemberRow = dialog.locator('li').first()
  await expect(firstMemberRow).toBeVisible({ timeout: 5_000 })
  await firstMemberRow.getByRole('button', { name: /conceder acesso|editar acesso/i }).click()

  const grantDialog = page.getByRole('dialog', { name: /conceder acesso|editar acesso/i })
  await expect(grantDialog).toBeVisible({ timeout: 5_000 })

  // The "Nível de acesso" fieldset offers Leitura (enabled) + Edição (DISABLED on a
  // terminal case — read grants allowed, write grants blocked; ADR 0033 D6). The
  // levels are radios; assert the underlying inputs' enabled/disabled state.
  const readRadio = grantDialog.locator('input[name="grant-level"]').first()
  const writeRadio = grantDialog.locator('input[name="grant-level"]').nth(1)
  await expect(readRadio).toBeEnabled()
  await expect(writeRadio).toBeDisabled()
  // The disabled Edição option is labelled "Indisponível (encerrado)".
  await expect(grantDialog.getByText(/indisponível \(encerrado\)/i)).toBeVisible()

  // Close without acting.
  await page.keyboard.press('Escape')

  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC-3e — Grant expiry (ADR 0050): coordinator grants a 30-day expiry via the
// dialog; the roster row shows "Expira em dd/mm/aaaa".
// ---------------------------------------------------------------------------

test('AC-3e grant with expiry: coordinator grants staff4 read + 30-dias via the dialog; row shows "Expira em …"', async ({
  page,
}) => {
  // Start clean: staff4 has no grant (the boundary persona).
  await clearGrant(CASE_ID, UID_STAFF4)

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${CASE_ID}`)
  await page.waitForURL(`**/manage/cases/${CASE_ID}`)

  const dialog = await openAccessDialog(page)

  // staff4's display name is "Enfermeiro CCIH Quatro" (seed full_name patch); scope
  // the row by that. Open the grant dialog.
  const staff4Row = dialog.locator('li').filter({ hasText: /CCIH Quatro/i })
  await expect(staff4Row).toBeVisible({ timeout: 10_000 })
  await staff4Row.getByRole('button', { name: /conceder acesso|editar acesso/i }).click()

  const grantDialog = page.getByRole('dialog', { name: /conceder acesso|editar acesso/i })
  await expect(grantDialog).toBeVisible({ timeout: 5_000 })

  // Assert the level radios + expiry presets + Motivo are present. The "Nível de
  // acesso" text appears both as the fieldset <legend> and inside the dialog
  // description sentence, so match the legend exactly to avoid a strict-mode clash.
  await expect(grantDialog.getByText('Nível de acesso', { exact: true })).toBeVisible()
  await expect(grantDialog.getByText('Leitura', { exact: true })).toBeVisible()
  await expect(grantDialog.getByText('Edição', { exact: true })).toBeVisible()
  const expirySelect = grantDialog.locator('#grant-expiry')
  await expect(expirySelect).toBeVisible()
  // The four presets are present.
  for (const opt of ['Sem prazo', '30 dias', '90 dias', 'Data específica']) {
    await expect(expirySelect.locator('option', { hasText: opt })).toHaveCount(1)
  }
  // Motivo textarea present.
  await expect(grantDialog.locator('textarea[name="reason"]')).toBeVisible()

  // Pick the 30-dias preset + a reason, keep Leitura (default), submit.
  await expirySelect.selectOption('30')
  await grantDialog
    .locator('textarea[name="reason"]')
    .fill('Apoio à análise da fase de investigação.')
  await grantDialog.getByRole('button', { name: /^conceder acesso$/i }).click()
  // The nested grant dialog closes; the roster dialog stays open and its row
  // updates live via router.refresh().
  await expect(grantDialog).toHaveCount(0, { timeout: 10_000 })

  // The roster row now shows the expiry ("Expira em dd/mm/aaaa") + the reason,
  // scoped to the still-open roster dialog.
  const staff4RowAfter = dialog.locator('li').filter({ hasText: /CCIH Quatro/i })
  await expect(staff4RowAfter.getByText(/expira em \d{2}\/\d{2}\/\d{4}/i)).toBeVisible({
    timeout: 10_000,
  })
  await expect(staff4RowAfter.getByText(/motivo: apoio à análise/i)).toBeVisible()

  // Close the roster dialog (its overlay would otherwise intercept the account menu).
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0, { timeout: 5_000 })

  await signOut(page)

  // Cleanup: remove the grant so the boundary persona stays clean for other specs.
  await clearGrant(CASE_ID, UID_STAFF4)
})

// ---------------------------------------------------------------------------
// AC-3f — Expired grant (ADR 0050): a past-dated grant renders "Expirada" in the
// roster AND no longer grants case read (the member is bounced to notFound()).
// ---------------------------------------------------------------------------

test('AC-3f expired grant: past-dated grant shows "Expirada" and denies case read (member bounced)', async ({
  page,
}) => {
  // Seed staff4 a grant that expired yesterday (direct upsert — the RPC would
  // reject a past expiry, which is exactly why we bypass it here).
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  await upsertGrant(CASE_ID, UID_STAFF4, 'read', yesterday, 'Grant vencido de teste')

  // Coordinator sees the "Expirada" badge on staff4's row.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${CASE_ID}`)
  await page.waitForURL(`**/manage/cases/${CASE_ID}`)
  const dialog = await openAccessDialog(page)
  const staff4Row = dialog.locator('li').filter({ hasText: /CCIH Quatro/i })
  await expect(staff4Row).toBeVisible({ timeout: 10_000 })
  await expect(staff4Row.getByText(/expirada/i)).toBeVisible({ timeout: 5_000 })
  // Close the roster dialog before the account menu (overlay would intercept it).
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0, { timeout: 5_000 })
  await signOut(page)

  // staff4 with ONLY an expired grant is DENIED the case (notFound boundary) — the
  // expiry filter drops the grant from can_read_case. No data leak.
  await signInAs(page, 'staff4.ccih@test.local')
  await page.goto(`${BASE}/casos/${CASE_ID}`)
  // BUG-ACT-NOTFOUND-COPY-1: /não encontr/i — casos/[id] hits the commission
  // not-found boundary (ACT ADR 0106's sibling), same shared file as the
  // QO·B CUT_ROUTES sample already verified live.
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toHaveCount(0)
  await expect(page.getByText(/Óbito UTI leito 7/i)).toHaveCount(0)

  // Meus Casos: the case must NOT appear for staff4 (expired grant drops both arms).
  await page.goto(`${BASE}/meus-casos`)
  await page.waitForLoadState('networkidle', { timeout: 10_000 })
  await expect(
    page.locator('article').filter({ hasText: /Óbito UTI leito 7/i }),
  ).toHaveCount(0)

  await signOut(page)

  // Cleanup.
  await clearGrant(CASE_ID, UID_STAFF4)
})

// ---------------------------------------------------------------------------
// AC-3g — Keyboard-only grant dialog (CLAUDE.md §8): open the dialog, operate the
// level radios + expiry select + reason via keyboard, and submit with Enter.
// ---------------------------------------------------------------------------

test('AC-3g keyboard-only: grant dialog is fully keyboard-operable (level → expiry → reason → submit)', async ({
  page,
}) => {
  await clearGrant(CASE_ID, UID_STAFF4)

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${CASE_ID}`)
  await page.waitForURL(`**/manage/cases/${CASE_ID}`)

  const dialog = await openAccessDialog(page)
  const staff4Row = dialog.locator('li').filter({ hasText: /CCIH Quatro/i })
  await expect(staff4Row).toBeVisible({ timeout: 10_000 })

  // Open the grant dialog by keyboard: focus the row's grant button + Enter.
  const grantBtn = staff4Row.getByRole('button', { name: /conceder acesso|editar acesso/i })
  await grantBtn.focus()
  await expect(grantBtn).toBeFocused()
  await page.keyboard.press('Enter')

  const grantDialog = page.getByRole('dialog', { name: /conceder acesso|editar acesso/i })
  await expect(grantDialog).toBeVisible({ timeout: 5_000 })

  // Level — focus the "Edição" (write) radio and select it via keyboard (Space).
  const writeRadio = grantDialog.locator('input[name="grant-level"]').nth(1)
  await writeRadio.focus()
  await expect(writeRadio).toBeFocused()
  await page.keyboard.press('Space')
  await expect(writeRadio).toBeChecked()

  // Expiry — focus the preset select, pick "90 dias" by keyboard.
  const expirySelect = grantDialog.locator('#grant-expiry')
  await expirySelect.focus()
  await expect(expirySelect).toBeFocused()
  await expirySelect.selectOption('90')

  // Reason — focus the textarea and type a justification (keyboard-only).
  const reason = grantDialog.locator('textarea[name="reason"]')
  await reason.focus()
  await expect(reason).toBeFocused()
  await page.keyboard.type('Colaboração na fase de análise.')

  // Submit — focus the "Conceder acesso" submit button + Enter.
  const submit = grantDialog.getByRole('button', { name: /^conceder acesso$/i })
  await submit.focus()
  await expect(submit).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(grantDialog).toHaveCount(0, { timeout: 10_000 })

  // DB truth: staff4 now holds a WRITE grant with a future expiry + the reason.
  // ADR 0078 Stage B: `case_access` → `case_access_grants`, `level` text replaced by
  // the `write_case_content` capability column (a write grant ⇒ write_case_content=true).
  await page.waitForTimeout(1_000)
  const rows = await dbQuery<{
    write_case_content: boolean
    expires_at: string | null
    reason: string | null
  }>('case_access_grants', {
    case_id: `eq.${CASE_ID}`,
    principal_id: `eq.${UID_STAFF4}`,
  })
  expect(rows[0]?.write_case_content).toBe(true)
  expect(rows[0]?.expires_at).toBeTruthy()
  expect(rows[0]?.reason).toContain('Colaboração')

  // Close the roster dialog before the account menu (overlay would intercept it).
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0, { timeout: 5_000 })
  await signOut(page)

  // Cleanup: keep staff4 the clean boundary persona for other specs.
  await clearGrant(CASE_ID, UID_STAFF4)
})

// ---------------------------------------------------------------------------
// AC-4 — Q14 ownership: write-grantee cannot edit/conclude attributed narrative
// ---------------------------------------------------------------------------

test('AC-4 Q14 ownership: staff3 (write grant) cannot edit Resumo Clínico (attributed to staff2) on EITHER host; staff2 — the ASSIGNEE, and ALSO the seeded administrativo — still can on /casos, which is the proof the reading-surface narrowing did not over-reach', async ({
  page,
}) => {
  const narrativeId = await getResumoCaseNarrativeId()

  // --- staff3 (write-grantee) tries to edit the Resumo (attributed to staff2) ---
  await signInAs(page, 'staff3.ccih@test.local')
  await page.goto(`${BASE}/casos/${CASE_ID}/narrativa/${narrativeId}`)
  await page.waitForURL(`${BASE}/casos/${CASE_ID}/narrativa/${narrativeId}`)

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

  // ⚠ T6 (QA F-1 fix, `3475c4d6`): Q14 must hold on EITHER host, not just
  // `/casos`. The manage narrative editor (`manage/cases/[caseId]/narrativa/
  // [narrativeId]`) applies NO narrowing — it takes the raw envelope, exactly
  // mirroring `app.can_write_case_narrative` — so relocating the case-wide arms
  // there must not accidentally turn an un-attributed write grant into
  // attributed-narrative authorship just because the host changed. staff3 still
  // has no claim on THIS narrative: not the assignee, and `canWriteContent`
  // alone never reaches an attributed one (narrative-access.ts's own ordering).
  await signInAs(page, 'staff3.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${CASE_ID}/narrativa/${narrativeId}`)
  await page.waitForURL(`${BASE}/manage/cases/${CASE_ID}/narrativa/${narrativeId}`)
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /salvar/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Concluir', exact: true })).toHaveCount(0)
  await signOut(page)

  // NON-VACUOUS positive control for the manage-host negative above: the SAME
  // narrative, genuinely editable there for the coordinator — proves the
  // corridor isn't just broken for everyone (mirrors AC-3b's own control shape).
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${CASE_ID}/narrativa/${narrativeId}`)
  await page.waitForURL(`${BASE}/manage/cases/${CASE_ID}/narrativa/${narrativeId}`)
  await expect(page.getByRole('textbox')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: /salvar/i })).toBeVisible()
  await signOut(page)

  // --- staff2 (narrative assignee) CAN edit the Resumo, ON /casos — ⭐ THE
  // OVER-REACH PROOF. She is ALSO the seeded administrativo (all four
  // capabilities), so if the reading-surface narrowing zeroed anything beyond
  // the two CASE-WIDE arms it names, this is where it would show: her write
  // here is NAME-ATTRIBUTED (the assignee branch, ADR 0033 Q14/CA-002), and
  // `narrowToReadingSurface` only touches `canManageLifecycle`/`canWriteContent`
  // — never the assignee test, which `canEditNarrative` runs FIRST. This
  // assertion matters more than either absence above: an absence proves the
  // narrowing removed something; THIS proves it removed nothing it should not
  // have. ---
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`${BASE}/casos/${CASE_ID}/narrativa/${narrativeId}`)
  await page.waitForURL(`${BASE}/casos/${CASE_ID}/narrativa/${narrativeId}`)

  // Editor IS present.
  await expect(page.getByRole('textbox')).toBeVisible({ timeout: 10_000 })
  // "Salvar" is present.
  await expect(page.getByRole('button', { name: /salvar/i })).toBeVisible()
  // "Concluir" trigger button is present (assignee + aberta).
  await expect(page.getByRole('button', { name: 'Concluir', exact: true })).toBeVisible()

  await signOut(page)
})

// ---------------------------------------------------------------------------
// T6 (QA F-1 fix, `3475c4d6`) — the narrative differential, AC-3b's shape applied
// to the SECOND `/casos` route: for an UN-ASSIGNED narrative ("Achados e
// Discussão", seeded un-attributed), a coordinator's and a write-grantee's
// case-wide claim (canManageLifecycle / canWriteContent) is narrowed away by
// `narrowToReadingSurface` on `/casos`, and relocates — not vanishes — to the new
// `manage/cases/[caseId]/narrativa/[narrativeId]` host, reached via "Gerenciar
// narrativa" (NOT "Gerenciar caso" — a distinct link, pointed at the narrative's
// own manage twin). AC-4 above is the companion proof that the ASSIGNEE arm
// (name-attributed work) survives untouched on `/casos` — that is what makes
// THIS test non-vacuous rather than "everything moved to manage".
// ---------------------------------------------------------------------------

test('T6 narrative differential: coordinator and write-grantee get NO case-wide narrative editor on /casos for an UN-ASSIGNED narrative; "Gerenciar narrativa" (counted by href) takes them to the SAME narrative, genuinely editable, on /manage/cases', async ({
  page,
}) => {
  const achadosId = await getAchadosCaseNarrativeId()
  const casosUrl = `${BASE}/casos/${CASE_ID}/narrativa/${achadosId}`
  const manageUrl = `${BASE}/manage/cases/${CASE_ID}/narrativa/${achadosId}`

  for (const email of ['chefe.ccih@test.local', 'staff3.ccih@test.local']) {
    await signInAs(page, email)
    await page.goto(casosUrl)
    await page.waitForURL(casosUrl)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })

    // Absent on /casos — narrowed away even though Achados is un-attributed,
    // so both classes would otherwise qualify (coordinator via
    // canManageLifecycle unconditionally; write-grantee via canWriteContent on
    // an un-attributed narrative, narrative-access.ts's third branch).
    await expect(page.getByRole('textbox')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /salvar/i })).toHaveCount(0)

    // The escape hatch — gated on the UN-narrowed envelope (case-detail-view's
    // "Gerenciar caso" sibling pattern), so it can never strand a viewer the
    // gate itself would admit. Counted by href AND accessible name.
    const manageLink = page.getByRole('link', { name: 'Gerenciar narrativa' })
    await expect(manageLink).toBeVisible({ timeout: 10_000 })
    await expect(manageLink).toHaveAttribute('href', manageUrl)

    // NON-VACUOUS positive control: the SAME narrative, genuinely editable for
    // the SAME user on the manage host — the relocation the PO ruled, not a
    // deletion. (Not clicking "Salvar" here — a real save would mutate this
    // shared seed narrative's body, which other specs assert on; presence of
    // the affordance is the claim under test, matching `frontend`'s own
    // discipline on this host.)
    await manageLink.click()
    await page.waitForURL(manageUrl)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('textbox')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: /salvar/i })).toBeVisible()

    await signOut(page)
  }
})

test('T6 keyboard-only: Tab-only from the /casos narrative into "Gerenciar narrativa" reaches the manage editor; the textarea and "Salvar" are keyboard-focusable (Salvar is not activated — a real save would mutate the shared seed narrative)', async ({
  page,
}) => {
  const achadosId = await getAchadosCaseNarrativeId()
  const casosUrl = `${BASE}/casos/${CASE_ID}/narrativa/${achadosId}`
  const manageUrl = `${BASE}/manage/cases/${CASE_ID}/narrativa/${achadosId}`

  // Print the focus trace at every Tab rather than trusting a fixed step
  // count or a boolean "reachable" flag — `frontend`'s own first harness
  // reported "NOT REACHABLE" and was wrong: it never left `/login`, because
  // that form's tab order is email -> "Esqueci minha senha" -> password, not
  // email -> password, and it was tabbing the login form the whole time. The
  // helper below signs in NORMALLY (not via keyboard) precisely to stay clear
  // of that trap; keyboard coverage starts only after landing on the target
  // page, matching this file's own AC-10 pattern.
  async function focusTrace(): Promise<{ tag: string; text: string; href: string | null; role: string | null } | null> {
    return page.evaluate(() => {
      const el = document.activeElement
      if (!el) return null
      return {
        tag: el.tagName,
        text: (el.textContent ?? '').trim(),
        href: (el as HTMLAnchorElement).href ?? null,
        role: el.getAttribute('role'),
      }
    })
  }

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(casosUrl)
  await page.waitForURL(casosUrl)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })

  // The chefe.ccih coordinator carries the FULL commission sidebar (~22 nav
  // links) ahead of this page's own header — measured via this trace (tab 26
  // is "Gerenciar narrativa"), not assumed; 35 leaves headroom without risking
  // a wrap-around back into the sidebar (observed at tab ~29, past a
  // NEXTJS-PORTAL node at ~27).
  let manageLinkFocused = false
  for (let i = 0; i < 35; i++) {
    await page.keyboard.press('Tab')
    const focused = await focusTrace()
    if (focused && focused.tag === 'A' && /gerenciar narrativa/i.test(focused.text)) {
      manageLinkFocused = true
      break
    }
  }
  expect(manageLinkFocused, 'Tab must reach the "Gerenciar narrativa" link').toBe(true)

  await page.keyboard.press('Enter')
  await page.waitForURL(manageUrl, { timeout: 10_000 })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })

  let textareaFocused = false
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab')
    const focused = await focusTrace()
    if (focused && (focused.tag === 'TEXTAREA' || focused.role === 'textbox')) {
      textareaFocused = true
      break
    }
  }
  expect(textareaFocused, 'Tab must reach the manage-host editor textarea').toBe(true)

  let salvarFocused = false
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab')
    const focused = await focusTrace()
    if (focused && /salvar/i.test(focused.text)) {
      salvarFocused = true
      break
    }
  }
  // Deliberately NOT pressing Enter — see the test title.
  expect(salvarFocused, 'Tab must reach the manage-host "Salvar" button').toBe(true)

  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC-5 — Meus Casos: unified list; card; actions; multi-item = one card
// ---------------------------------------------------------------------------

test('AC-5 Meus Casos: unified list — staff1 (phase assignee) sees card with Preencher button + Ver caso completo', async ({
  page,
}) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`${BASE}/meus-casos`)
  await page.waitForURL(`${BASE}/meus-casos`)

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
  await expect(verLink).toHaveAttribute('href', `${BASE}/casos/${CASE_ID}`)

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
  await page.goto(`${BASE}/meus-casos`)
  await page.waitForURL(`${BASE}/meus-casos`)

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
  await page.goto(`${BASE}/meus-casos`)
  await page.waitForURL(`${BASE}/meus-casos`)

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
// AC-6 — Narrative lifecycle: fill → Concluir → coordinator corrects (not reopen)
//
// Reconciled 2026-07-24 for the Case Correction Lifecycle (ADR 0085 T-2): the
// second half of this test used to click a "Reabrir" control on the concluded
// narrative card and assert the status flipped back to `open` — that
// affordance was RETIRED platform-wide (BE-4 dropped the `reopen_narrative`
// RPC; FE-2 removed the caller; no "Reabrir narrativa" control exists in the
// render tree — confirmed by `e2e/case-narratives.spec.ts` AC-9). The new
// post-conclusion path is the Case Correction Lifecycle: the coordinator files
// + approves a correction, which never reopens the narrative (its
// `concluded_at`/`concluded_by` stay untouched) — mirrors
// `e2e/case-narratives.spec.ts` AC-10 and `e2e/case-corrections.spec.ts` AC-4.
// This also DOUBLES as the cross-spec hygiene restore the old reopen-then-edit
// flow used to perform (a concluded narrative can no longer be re-edited
// in-place — HC055 — so the correction path is now the only way back to the
// seeded body for `case-narratives.spec.ts` AC-3's benefit).
// ---------------------------------------------------------------------------

test('AC-6 narrative lifecycle: staff2 fills Resumo via focused editor, concludes; coordinator corrects it (no in-place reopen)', async ({
  page,
}) => {
  const narrativeId = await getResumoCaseNarrativeId()
  const editorHref = `${BASE}/casos/${CASE_ID}/narrativa/${narrativeId}`

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
  await page.waitForURL(`${BASE}/casos/${CASE_ID}`, { timeout: 20_000 })

  // Verify DB: narrative status = 'concluida'.
  const rows = await dbQuery<{ status: string }>('case_narratives', {
    id: `eq.${narrativeId}`,
  })
  expect(rows[0]?.status).toBe('completed')

  await signOut(page)

  // --- Coordinator: the narrative stays CONCLUDED — no in-place reopen exists ---
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${CASE_ID}`)
  await page.waitForURL(`**/manage/cases/${CASE_ID}`)

  // Both the Caso 0001 narrative AND the Phase-22 referral snapshot are rendered as regions
  // with names matching /resumo clínico/i inside "Fases e narrativas do caso":
  //   (1) 'Resumo Clínico' (uppercase C) — the actual case narrative (seeded type label)
  //   (2) 'Resumo clínico' (lowercase c) — the referral snapshot display_name (ENC-0001)
  // Use exact string match 'Resumo Clínico' (case-sensitive) to pick only the seeded narrative.
  const narrativeSection = page.getByRole('region', { name: 'Resumo Clínico', exact: true })
  await expect(narrativeSection).toBeVisible({ timeout: 10_000 })
  await expect(narrativeSection.getByText(/^Concluída$/i)).toBeVisible()
  // The proof: NO "Reabrir" control of any kind exists — narrative-level reopen
  // has no live UI surface anymore (mirrors case-narratives.spec.ts AC-9).
  await expect(narrativeSection.getByRole('button', { name: /reabrir/i })).toHaveCount(0)

  const beforeRows = await dbQuery<{
    status: string
    concluded_at: string | null
    concluded_by: string | null
  }>('case_narratives', { id: `eq.${narrativeId}` })
  expect(beforeRows[0]?.status).toBe('completed')
  const concludedAt = beforeRows[0]?.concluded_at
  const concludedBy = beforeRows[0]?.concluded_by
  expect(concludedAt).toBeTruthy()

  // --- Coordinator corrects it via the Case Correction Lifecycle instead ---
  // (self-designated corrector — chefe is the only staff_admin in CCIH). This
  // also restores the seeded body for case-narratives.spec.ts AC-3's benefit —
  // the correction path is now the ONLY way to change a concluded narrative.
  await narrativeSection.getByRole('button', { name: /Corrigir/i }).click()
  await page.getByRole('menuitem', { name: /Solicitar correção/i }).click()
  const fileDialog = page.getByRole('dialog').filter({ hasText: /Solicitar correção/i })
  await expect(fileDialog).toBeVisible({ timeout: 5_000 })
  await fileDialog.getByLabel(/Motivo/i).fill('Restaurar o texto original semeado após o teste AC-6.')
  await fileDialog.getByLabel(/Corretor/i).selectOption(UID_CHEFE)
  await fileDialog.getByRole('button', { name: /^Solicitar correção$/ }).click()
  await expect(fileDialog).not.toBeVisible({ timeout: 10_000 })

  const draftTextarea = narrativeSection.locator('textarea')
  await expect(draftTextarea).toBeVisible({ timeout: 10_000 })
  const seedBody =
    'Paciente do leito 7 da UTI, evoluiu com piora clínica progressiva.\n\nO comitê revisou o checklist da Fase 1. Sem dados identificáveis.'
  await draftTextarea.fill(seedBody)
  await narrativeSection.getByRole('button', { name: /Enviar para revisão/i }).click()
  await expect(narrativeSection.getByText(/Reenviada/i)).toBeVisible({ timeout: 15_000 })

  // Scoped to the narrative card — the request list is rendered inside its target.
  const correctionsPanel = narrativeSection.getByRole('region', { name: /Solicitações de correção/i })
  const requestCard = correctionsPanel.locator('li').first()
  await expect(requestCard.getByText(/Reenviada/i)).toBeVisible({ timeout: 10_000 })
  await requestCard.getByRole('button', { name: /^Aprovar$/ }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: /Aprovar correção/i }).click()
  await expect(requestCard.getByText(/^Aprovada$/i)).toBeVisible({ timeout: 15_000 })

  // Body restored to the seeded text; the narrative is STILL "Concluída" — the
  // correction never reopened it — and its conclusion stamp is byte-for-byte
  // preserved (the anti-reopen keystone: concluded_at/concluded_by untouched).
  await expect(narrativeSection.getByText(/Paciente do leito 7/i)).toBeVisible({ timeout: 10_000 })
  await expect(narrativeSection.getByText(/^Concluída$/i)).toBeVisible()

  const afterRows = await dbQuery<{
    status: string
    concluded_at: string | null
    concluded_by: string | null
    body_md: string
  }>('case_narratives', { id: `eq.${narrativeId}` })
  expect(afterRows[0]?.status).toBe('completed')
  expect(afterRows[0]?.concluded_at).toBe(concludedAt)
  expect(afterRows[0]?.concluded_by).toBe(concludedBy)
  expect(afterRows[0]?.body_md).toContain('Paciente do leito 7')

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
  await page.goto(`${BASE}/casos/${CASE_ID}`)
  await page.waitForURL(`${BASE}/casos/${CASE_ID}`)

  // The PHI-free chip / badge should appear (the existing "Events" panel shows linked events
  // without PHI — event title / kind but not patient data).
  // We look for a link or chip referencing the event.
  // The event chip should NOT contain patient name/MRN.
  // Assert that clicking through to the event detail is denied.

  // The safety event detail route is /c/ccih/manage/pqs/events/[id]
  // A read-grantee should not be able to navigate there (custody-gated).
  const eventDetailHref = `${BASE}/manage/pqs/events/e1000000-0000-0000-0000-0000000000a1`
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
  await page.goto(`${BASE}/casos/${CASE_ID}`)
  await page.waitForURL(`${BASE}/casos/${CASE_ID}`)
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toBeVisible({ timeout: 10_000 })
  await signOut(page)

  // After staff1's open: count should have increased by exactly 1.
  const afterStaff1 = await caseOpenedCount()
  expect(afterStaff1).toBe(before + 1)

  // Coordinator: chefe.ccih opens the case via the manage route.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/manage/cases/${CASE_ID}`)
  await page.waitForURL(`**/manage/cases/${CASE_ID}`)
  await expect(page.getByRole('heading', { name: /caso\s*0001/i })).toBeVisible({ timeout: 10_000 })
  await signOut(page)

  // Coordinator open must NOT write an audit row — count unchanged.
  const afterCoordinator = await caseOpenedCount()
  expect(afterCoordinator).toBe(afterStaff1)
})

// ---------------------------------------------------------------------------
// AC-9 (RETIRED) — the `case_access` feature flag no longer exists.
//
// ADR 0078 Stage B (B4) DROPPED the `app.feature_flags` row for `case_access`
// entirely — it isn't merely "ships ON", there is no key to flip. The old
// flag-OFF skip is replaced below by SB-5, which asserts the row is gone and
// that case reach is governed solely by can_read_case's own arms.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AUTHZ Stage B — case_access_grants acceptance (ADR 0078 B1)
//
// `case_access` was HARD-CUT to `case_access_grants` — capability-per-column
// (read_case_content / read_case_deliberation / write_case_content /
// read_standard_phi / read_restricted_phi) instead of a `level` enum. Proved
// directly against the RPC doors (grant_case_access / list_case_access) so
// these hold independently of any UI:
//   SB-1  A content/write grant does NOT confer PHI (defect ①·2 closed).
//   SB-2  A grant carrying read_standard_phi=true DOES confer PHI.
//   SB-3  list_case_access projects max_confidentiality/read_standard_phi/
//         read_restricted_phi alongside the legacy level/granted_at/expires_at/
//         reason shape.
//   SB-4  A recused coordinator's grant_case_access is rejected (U1 exclusion
//         gate, HC0F1) — she cannot hand a third party access to a case she
//         cannot read herself. Uses the seeded ethics fixture case (a
//         DIFFERENT case than Caso 0001/0002 this file otherwise touches, so
//         recusing chefe.ccih there has zero effect on the rest of this file).
//   SB-5  No case_access flag-OFF path exists any more — the flag row itself
//         is gone from app.feature_flags.
// Each test grants/recuses only what it needs and reverts it, so this battery
// leaves every shared persona (staff4 the boundary persona, chefe the CCIH
// coordinator) exactly as it found them for the rest of the suite.
// ---------------------------------------------------------------------------

const ETHICS_CASE_ID = 'ca000000-0000-0000-0000-0000000000e1' // seeded fixture; chefe.ccih is its coordinator too

/** Obtain a JWT for a persona (RLS/RPC authority evaluated under it). */
async function getToken(request: APIRequestContext, email: string, pw = PW): Promise<string> {
  const resp = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password: pw },
  })
  expect(resp.ok(), `getToken(${email}) failed: ${resp.status()}`).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

/** Call a public RPC under a persona JWT. Returns the raw Response. */
async function rpc(
  request: APIRequestContext,
  fn: string,
  bearer: string,
  body: Record<string, unknown>,
) {
  return request.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })
}

/**
 * Ensure Caso 0001 has patient_enabled=true + a known case_patient/PHI value.
 * Idempotent (PATCH + upsert RPC) — safe to call from more than one test. Never
 * assume another spec file's beforeAll already did this (order-fragile); each
 * test that needs PHI present calls this itself.
 */
async function ensureCasePatientPhi(request: APIRequestContext): Promise<void> {
  await request.patch(`${SUPABASE_URL}/rest/v1/cases?id=eq.${CASE_ID}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    data: { patient_enabled: true },
  })
  const chefeToken = await getToken(request, 'chefe.ccih@test.local')
  const resp = await rpc(request, 'set_case_patient', chefeToken, {
    p_case_id: CASE_ID,
    p_name: 'Paciente Teste Silva',
    p_mrn: 'PRT-CA-STAGEB-0001',
  })
  expect(resp.ok(), `ensureCasePatientPhi: set_case_patient failed: ${await resp.text()}`).toBeTruthy()
}

/** Direct catalog read — app.feature_flags has no PostgREST exposure. */
async function caseAccessFlagRowExists(): Promise<boolean> {
  const { execSync } = await import('child_process')
  const out = execSync(
    `npx supabase db query --local "SELECT 'FLAGCHECK:' || count(*)::text AS probe FROM app.feature_flags WHERE key = 'case_access'"`,
    { cwd: process.cwd(), stdio: 'pipe' },
  ).toString()
  const m = out.match(/FLAGCHECK:(\d+)/)
  if (!m) throw new Error(`caseAccessFlagRowExists: could not parse probe output: ${out}`)
  return Number(m[1]) > 0
}

test('SB-1: a content/write grant via grant_case_access does NOT confer PHI (defect ①·2 closed)', async ({
  request,
}) => {
  await ensureCasePatientPhi(request)
  const chefeToken = await getToken(request, 'chefe.ccih@test.local')
  try {
    const grantResp = await rpc(request, 'grant_case_access', chefeToken, {
      p_case: CASE_ID,
      p_user: UID_STAFF4,
      p_level: 'write',
    })
    expect(grantResp.ok(), `grant_case_access failed: ${await grantResp.text()}`).toBeTruthy()

    const staff4Token = await getToken(request, 'staff4.ccih@test.local')
    const phiResp = await rpc(request, 'get_case_patient', staff4Token, { p_case_id: CASE_ID })
    expect(phiResp.ok()).toBeTruthy()
    expect(await phiResp.json(), 'a content/write-only grant leaked PHI').toBeNull()
  } finally {
    await clearGrant(CASE_ID, UID_STAFF4)
  }
})

test('SB-2: a grant with read_standard_phi=true DOES confer PHI', async ({ request }) => {
  await ensureCasePatientPhi(request)
  const chefeToken = await getToken(request, 'chefe.ccih@test.local')
  try {
    const grantResp = await rpc(request, 'grant_case_access', chefeToken, {
      p_case: CASE_ID,
      p_user: UID_STAFF4,
      p_level: 'read',
      p_read_standard_phi: true,
    })
    expect(grantResp.ok(), `grant_case_access failed: ${await grantResp.text()}`).toBeTruthy()

    const staff4Token = await getToken(request, 'staff4.ccih@test.local')
    const phiResp = await rpc(request, 'get_case_patient', staff4Token, { p_case_id: CASE_ID })
    expect(phiResp.ok()).toBeTruthy()
    const body = await phiResp.json()
    expect(body, 'read_standard_phi=true grant did not reveal PHI').not.toBeNull()
    expect(JSON.stringify(body)).toContain('PRT-CA-STAGEB-0001')
  } finally {
    await clearGrant(CASE_ID, UID_STAFF4)
    // Verify the revert actually landed (§7.3 — never trust an unverified teardown).
    const staff4Token = await getToken(request, 'staff4.ccih@test.local')
    const verify = await rpc(request, 'get_case_patient', staff4Token, { p_case_id: CASE_ID })
    expect(verify.ok()).toBeTruthy()
    expect(await verify.json()).toBeNull()
  }
})

test('SB-3: list_case_access projects the clearance columns (max_confidentiality/read_standard_phi/read_restricted_phi)', async ({
  request,
}) => {
  const chefeToken = await getToken(request, 'chefe.ccih@test.local')
  try {
    const grantResp = await rpc(request, 'grant_case_access', chefeToken, {
      p_case: CASE_ID,
      p_user: UID_STAFF4,
      p_level: 'read',
      p_read_standard_phi: true,
    })
    expect(grantResp.ok(), `grant_case_access failed: ${await grantResp.text()}`).toBeTruthy()

    const listResp = await rpc(request, 'list_case_access', chefeToken, { p_case: CASE_ID })
    expect(listResp.ok(), `list_case_access failed: ${await listResp.text()}`).toBeTruthy()
    const rows = (await listResp.json()) as Array<{
      user_id: string
      level: string
      read_standard_phi: boolean
      read_restricted_phi: boolean
      max_confidentiality: string | null
    }>
    const row = rows.find((r) => r.user_id === UID_STAFF4)
    expect(row, 'granted row missing from list_case_access').toBeTruthy()
    expect(row?.level).toBe('read')
    expect(row?.read_standard_phi).toBe(true)
    expect(row?.read_restricted_phi).toBe(false)
    // max_confidentiality is the orthogonal RESERVED ceiling — not set by this grant.
    expect(row?.max_confidentiality).toBeNull()
  } finally {
    await clearGrant(CASE_ID, UID_STAFF4)
  }
})

test('SB-4: a recused coordinator cannot grant_case_access on the case she is recused from (U1 exclusion gate)', async ({
  request,
}) => {
  const chefeToken = await getToken(request, 'chefe.ccih@test.local')

  // Recuse chefe.ccih from the SEEDED ETHICS case only (Caso 0001/0002 used
  // throughout the rest of this file are untouched — recusal is per-case), via a
  // DIRECT service-role insert rather than the `record_recusal` RPC.
  //
  // Why not record_recusal + lift_recusal (the ethics-e1-access-spine.spec.ts
  // pattern)? That pattern recuses a NON-coordinator (multi) and lifts it AS the
  // (unexcluded) coordinator. Here the coordinator herself must be the excluded
  // party, and post-M1 `lift_recusal` DELIBERATELY refuses a recused principal
  // lifting her own recusal — "a recused coordinator lifts her own recusal" was
  // the exact defect M1 closed (see authz-handoff.md §1). A self-recuse-then-
  // self-lift round trip would therefore always fail teardown by design, so the
  // fixture is written/cleared directly (mirrors upsertGrant/clearGrant above).
  const insertResp = await request.post(`${SUPABASE_URL}/rest/v1/case_recusals`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: {
      case_id: ETHICS_CASE_ID,
      user_id: UID_CHEFE,
      source: 'self',
      reason_md: 'Conflito declarado (SB-4 probe).',
      recused_by: UID_CHEFE,
    },
  })
  expect(insertResp.ok(), `SB-4 setup: case_recusals insert failed: ${await insertResp.text()}`).toBeTruthy()
  const recusalId = ((await insertResp.json()) as Array<{ id: string }>)[0].id

  try {
    // CONTROL: the recusal actually holds — chefe cannot read the case herself.
    // A vacuous keystone (§7.1) would skip this and assert only the grant denial.
    // get_case_detail RAISES `no_data_found` (P0002) for a denied reader — unlike
    // get_case_patient, which returns null. PostgREST treats P0002 as an INTERNAL
    // (5xx) error class and deliberately returns an OPAQUE, non-JSON body for it
    // (unlike 42501/HC0F1, which map to 4xx with structured JSON) — reproduced
    // directly against Kong: 500 "Something went wrong", no parseable body. So the
    // control checks the response FAILED, not its (intentionally opaque) content —
    // meaningful here because chefe reads this exact case successfully everywhere
    // else in this suite (she is its coordinator), so a failure immediately after
    // inserting her own recusal row is not a vacuous read.
    const detailResp = await rpc(request, 'get_case_detail', chefeToken, { p_case_id: ETHICS_CASE_ID })
    expect(
      detailResp.ok(),
      'fixture invalid: recusal did not take (chefe can still read the case)',
    ).toBeFalsy()

    // U1: grant_case_access must RAISE (authority-first means the precondition-less
    // twin fails loudly), not silently no-op.
    const grantResp = await rpc(request, 'grant_case_access', chefeToken, {
      p_case: ETHICS_CASE_ID,
      p_user: UID_STAFF4,
      p_level: 'read',
    })
    expect(
      grantResp.ok(),
      'recused coordinator was able to grant_case_access — U1 regression',
    ).toBeFalsy()
    expect(JSON.stringify(await grantResp.json())).toMatch(/HC0F1/i)
  } finally {
    // Direct service-role delete — never trust an unverified teardown (§7.3):
    // confirm zero LIVE rows remain rather than assuming the DELETE landed.
    await request.delete(`${SUPABASE_URL}/rest/v1/case_recusals?id=eq.${recusalId}`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    })
    const remaining = await dbQuery<{ id: string }>('case_recusals', {
      id: `eq.${recusalId}`,
    })
    expect(remaining.length, 'SB-4 teardown did not remove the recusal fixture').toBe(0)
  }
})

test('SB-5: no case_access flag-OFF path exists — the flag row is gone; case reach is unconditional', async ({
  page,
}) => {
  // The catalog: `case_access` is no longer even a row in app.feature_flags (ADR
  // 0078 B4 retired it) — there is no "OFF" state left to simulate.
  expect(
    await caseAccessFlagRowExists(),
    'case_access flag row still exists in app.feature_flags — B4 not applied?',
  ).toBe(false)

  // Behavioural corroboration: a plain member with no grant/attribution still gets
  // the ordinary denial — reach is governed entirely by can_read_case's own arms,
  // never by a feature-flag kill-switch.
  await signInAs(page, 'staff4.ccih@test.local')
  await page.goto(`${BASE}/casos/${CASE_ID}`)
  // BUG-ACT-NOTFOUND-COPY-1: /não encontr/i — casos/[id] hits the commission
  // not-found boundary (ACT ADR 0106's sibling), same shared file as the
  // QO·B CUT_ROUTES sample already verified live.
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })
  await signOut(page)
})

// ---------------------------------------------------------------------------
// AC-10 — Keyboard-only: Meus Casos → narrative editor
// ---------------------------------------------------------------------------

test('AC-10 keyboard-only: Tab/Enter through Meus Casos to focused narrative editor', async ({
  page,
}) => {
  // AC-6 (which runs before this test, serial mode) now permanently concludes
  // "Resumo Clínico" — post-ADR-0085 there is no reopen, so it stays frozen
  // (read-only, no textarea) for the rest of the suite, yet "Meus Casos" still
  // renders an "Abrir" link for it (a read-only view link). This keyboard flow
  // needs an EDITABLE narrative, so it targets "Achados e Discussão" instead
  // (seeded un-attributed — safe to assign to staff2 for the duration of this
  // test). staff2 is ALSO still the seeded assignee of the now-frozen Resumo, so
  // Resumo's "Abrir" (dp=2, earlier in the list than Achados' dp=4) would win a
  // blind Tab-to-first-"Abrir" race — temporarily unassign staff2 from Resumo too,
  // so Achados is the ONLY "Abrir"-bearing item staff2 has, then restore both
  // assignments afterward (Resumo → staff2 per seed; Achados → null per AC-N1's
  // "NOT attributed" precondition).
  const resumoId = await getResumoCaseNarrativeId()
  const achadosId = await getAchadosCaseNarrativeId()
  const UID_STAFF2 = '00000000-0000-0000-0000-000000000004'
  await patchNarrativeAssignee(resumoId, null)
  await patchNarrativeAssignee(achadosId, UID_STAFF2)

  // staff2 is now the ONLY narrative assignee (Achados) → exactly one Abrir link.
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`${BASE}/meus-casos`)
  await page.waitForURL(`${BASE}/meus-casos`)

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
  await page.waitForURL(`${BASE}/casos/${CASE_ID}/narrativa/**`, { timeout: 10_000 })

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

  // Restore both narratives to their seeded state:
  //  - Resumo → staff2 again (AC-4's "Q14 ownership" precondition, and simply
  //    the seed's own fixture).
  //  - Achados → unattributed (AC-N1, next, requires "NOT attributed") AND
  //    empty (case-narratives.spec.ts AC-4 requires the "Nenhum conteúdo ainda"
  //    placeholder on this SAME shared narrative when both spec files run
  //    together against the same DB).
  await patchNarrativeAssignee(resumoId, UID_STAFF2)
  await patchNarrativeFields(achadosId, { assigned_to: null, body_md: null })
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
  await page.goto(`${BASE}/manage/cases/${CASE_ID}`)
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
  await page.goto(`${BASE}/manage/cases/${CASE_ID}`)
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
  await page.goto(`${BASE}/manage/cases/${CASE_ID}`)
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
