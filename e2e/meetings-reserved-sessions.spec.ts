import { test, expect, type Page } from '@playwright/test'

/**
 * ADR 0078 Gate 2 — Stage C: meeting confidentiality (reserved sessions).
 *
 * Covers the three Stage-C UI deliverables (PROGRESS.md "AUTHZ · Gate 2" row;
 * plan: docs/progress/authz-gate2-stagec-plan.md):
 *   1. Reserved-session authoring (coordinator-only): open a reserved session
 *      + add a reserved item, case-linked and case-less-with-readers. A
 *      non-coordinator sees no authoring controls.
 *   2. Composed-ata tiered rendering (the confidentiality money-shot): on a
 *      reserved item linked to an `explicit_grants_only` case, the
 *      coordinator reads full substância/decisão; a plain member with no
 *      grant on that case reads only the non-identifying stub — PLUS the
 *      member-wide propriety number and decision (ADR 0078 A26, PO-affirmed
 *      2026-07-17 as INTENDED, uniform regardless of `visibility_policy` —
 *      NOT a bug; only substance + withdrawal NAMES are deliberation-gated).
 *   3. Org-User meetings hiding (C7): an org_admin without a commission
 *      membership loses the "Reuniões" nav item and 404s on /meetings and
 *      /meetings/[id], but keeps manage/settings/reunioes (A10).
 * Plus one keyboard-only flow (Gate requirement).
 *
 * The server-side tiering (`get_reserved_session_items` DEFINER RPC, ADR 0078
 * C5) is pgTAP-covered (keystones 239-245, mutation-proven — see the plan).
 * This file proves the SAME tiering end-to-end through real logins and the
 * real UI, and that the UI never tries to work around a masked (null) field
 * — it renders exactly what the server projects.
 *
 * Fixtures: every case used here is created FRESH via `create_case_from_template`
 * (never the seeded Caso 0001, which other specs mutate) so this file owns an
 * isolated slice of state. The meeting is the seeded CCIH
 * "Reunião Ordinária — Junho/2026" (f1000000-…-e1, status `held` — still
 * EDITABLE per `isEditableStatus` in meeting-labels.ts, same meeting
 * case-meetings-panel.spec.ts writes `meeting_cases` links to).
 *
 * Personas (password Test1234!):
 *   chefe.ccih@test.local   staff_admin of CCIH (Rede A) — the coordinator;
 *                           opens/authors reserved sessions + items.
 *   multi@test.local        plain staff of CCIH (Rede A), full_name
 *                           "Coordenadora Multi" — a commission member with no
 *                           case involvement; the "no deliberation reach"
 *                           viewer for the tiering assertions.
 *   orgadmin.a@test.local   org_admin of Rede A. Resolves a commission
 *                           "staff_admin" role via `is_commission_admin_of`
 *                           (session.ts `memberRole ?? (isCommAdmin ? …)`)
 *                           WITHOUT holding a CCIH membership row — the exact
 *                           "commission-admin without membership" shape C7
 *                           targets.
 *
 * This file mutates ONE shared meeting row across its tests (adds several
 * reserved sessions to it) and reads later tests' rows in earlier-authored
 * state, so it declares itself fully `serial` regardless of the Playwright
 * `workers` setting.
 *
 * Reset with `npx supabase db reset --local` before a clean run.
 */

test.describe.configure({ mode: 'serial' })

test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

const ORG = 'rede-a'
const SLUG = 'ccih'
const BASE = `/o/${ORG}/c/${SLUG}`

const SEEDED_MEETING_ID = 'f1000000-0000-0000-0000-0000000000e1' // "Reunião Ordinária — Junho/2026" (held, still editable)
const SEEDED_MEETING_TITLE = 'Reunião Ordinária — Junho/2026'
const COMM_CCIH_ID = 'a0000000-0000-0000-0000-0000000000a1'

const MULTI_NAME = 'Coordenadora Multi' // seed.sql profile display name for multi@test.local

const PW = 'Test1234!'

// ---------------------------------------------------------------------------
// Helpers (mirror case-meetings-panel.spec.ts / phase10-meetings.spec.ts)
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = PW) {
  await page.goto('/login')
  await page.getByLabel(/e-mail/i).fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 20_000,
  })
}

/**
 * Sign the current session out. REQUIRED before calling `signInAs` a second
 * time for a DIFFERENT persona within one test — `/login` 307-redirects an
 * already-authenticated session straight back to its commission home
 * (confirmed live: GET /login → 307 / → 307 /o/…/c/…), so a bare second
 * `signInAs` hangs forever on `getByLabel(/e-mail/i)`, which never renders.
 * Mirrors `signOut` in phase10-meetings.spec.ts / case-access.spec.ts.
 */
async function signOut(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0))
  const userMenu = page.getByRole('button', { name: /abrir menu da conta/i })
  await userMenu.click()
  const sairItem = page.getByRole('menuitem', { name: /sair/i })
  await expect(sairItem).toBeVisible({ timeout: 5_000 })
  await sairItem.click()
  await page.waitForURL('**/login', { timeout: 15_000 })
}

/** Obtain a real RLS-scoped JWT for a persona (for fixture setup / raw REST probes). */
async function getOwnerToken(
  page: Page,
  email: string,
  password = PW,
): Promise<string> {
  const resp = await page.request.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      data: { email, password },
    },
  )
  expect(resp.ok()).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

async function callRPC(
  page: Page,
  token: string,
  rpcName: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  const resp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/${rpcName}`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      data: body,
    },
  )
  const text = await resp.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = text
  }
  return { status: resp.status(), body: parsed }
}

/**
 * Create a fresh templated case in CCIH (mirrors `createFreshCase` in
 * case-meetings-panel.spec.ts / phase7-cases.spec.ts). Returns the new case id.
 *
 * The template is looked up at RUN TIME, not hardcoded — `process_templates.id`
 * defaults to `gen_random_uuid()` in the seed (unlike the deterministic
 * `a0000000-…`/`f1000000-…` fixture ids elsewhere in this file), so it is a
 * DIFFERENT id on every `db reset`. A hardcoded id here 500s with "processo …
 * não encontrado" the moment the DB is reset again (caught live: the id
 * captured at exploration time no longer resolved after a routine re-reset).
 */
async function createFreshCase(
  page: Page,
  ownerToken: string,
  label: string,
): Promise<string> {
  const tplResp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/process_templates?commission_id=eq.${COMM_CCIH_ID}&status=eq.active&select=id&limit=1`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
      },
    },
  )
  expect(tplResp.ok()).toBeTruthy()
  const tpls = (await tplResp.json()) as Array<{ id: string }>
  expect(tpls.length).toBeGreaterThan(0)

  const resp = await page.request.post(
    `${SUPABASE_URL}/rest/v1/rpc/create_case_from_template`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      data: { p_template_id: tpls[0].id, p_label: label },
    },
  )
  expect(resp.ok()).toBeTruthy()
  const body = (await resp.json()) as { case_id?: string; id?: string }
  const caseId = body.case_id ?? body.id
  expect(caseId).toBeTruthy()
  return caseId as string
}

/** Set a case's confidentiality tier via the audited coordinator-only door (ADR 0078 M6). */
async function setCaseVisibility(
  page: Page,
  ownerToken: string,
  caseId: string,
  policy: 'commission_default' | 'explicit_grants_only',
): Promise<void> {
  const { status, body } = await callRPC(page, ownerToken, 'set_case_visibility', {
    p_case_id: caseId,
    p_policy: policy,
  })
  // `set_case_visibility` returns void — PostgREST replies 204 No Content on
  // success for a void-returning RPC (not 200; there is no body to send).
  expect(status, `set_case_visibility failed: ${JSON.stringify(body)}`).toBe(204)
}

/** Read a case's auto-minted `case_number` (the propriety-tier "Processo: nº …" value). */
async function getCaseNumber(
  page: Page,
  ownerToken: string,
  caseId: string,
): Promise<number> {
  const resp = await page.request.get(
    `${SUPABASE_URL}/rest/v1/cases?id=eq.${caseId}&select=case_number`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${ownerToken}`,
      },
    },
  )
  expect(resp.ok()).toBeTruthy()
  const rows = (await resp.json()) as { case_number: number }[]
  expect(rows.length).toBe(1)
  return rows[0].case_number
}

/** Navigate to the seeded meeting detail as the current session's signed-in user. */
async function gotoMeeting(page: Page) {
  await page.goto(`${BASE}/meetings/${SEEDED_MEETING_ID}`)
  await page.waitForURL(`**/c/${SLUG}/meetings/${SEEDED_MEETING_ID}`, {
    timeout: 15_000,
  })
}

const reservedSessionsRegion = (page: Page) =>
  page.getByRole('region', { name: 'Sessão reservada' })

/**
 * Click "Abrir sessão reservada" and return the NEW session's "Adicionar item"
 * button. A bare `.last()` right after the click races a pre-existing session's
 * ALREADY-visible button — `toBeVisible()` is satisfied trivially by the OLD
 * button before the new session even renders, so the click silently lands on
 * the wrong session. Wait for the button COUNT to increase instead (a metric
 * that reads the same before and after measures nothing — the fix is to prove
 * it moved).
 */
async function openFreshReservedSession(page: Page) {
  const panel = reservedSessionsRegion(page)
  // `.count()` is a one-shot read, NOT an auto-retrying assertion — calling it
  // before the panel has streamed in reads 0 regardless of how many sessions
  // actually exist server-side, poisoning the "+1" baseline below. Wait for the
  // panel (and its open button) to be genuinely present first.
  const openBtn = panel.getByRole('button', { name: /Abrir sessão reservada/i })
  await expect(openBtn).toBeVisible({ timeout: 10_000 })

  const addItemButtons = page.getByRole('button', { name: 'Adicionar item' })
  const countBefore = await addItemButtons.count()
  await openBtn.click()
  // 25s matches the suite-wide convention for a post-mutation `router.refresh()`
  // wait on this heavy page (phase10-meetings.spec.ts uses 20_000-25_000 for every
  // such wait; the page re-fetches a dozen-plus parallel queries).
  // NOTE (2026-07-17): an earlier version of this comment attributed an observed 10s
  // failure to that query load. That "deterministic prod-standalone timeout" was in
  // fact BUG-AIF-001 — Next 16.2.9's deferred `router.refresh()` never committing on
  // the standalone build — reproduced only because the local `node_modules` had
  // drifted to 16.2.9. It is FIXED in 16.3.0-preview.5 (this branch's declared
  // version). The generous timeout is kept purely as house-standard headroom, NOT to
  // mask a hang (25s would not reliably clear a 21-31s hang anyway).
  await expect(addItemButtons).toHaveCount(countBefore + 1, { timeout: 25_000 })
  return addItemButtons.last()
}

// ===========================================================================
// Deliverable 1 — Reserved-session authoring (coordinator-only)
// ===========================================================================

test.describe('Deliverable 1: reserved-session authoring', () => {
  test('chefe.ccih opens a reserved session and adds a case-linked reserved item — persists with pt-BR content', async ({
    page,
  }) => {
    test.setTimeout(90_000)

    const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')
    const caseId = await createFreshCase(
      page,
      ownerToken,
      `Sessão reservada — caso vinculado ${Date.now()}`,
    )
    const caseNumber = await getCaseNumber(page, ownerToken, caseId)

    const SUBSTANCE = `Substância confidencial E2E ${Date.now()}`
    const DECISION = `Decisão confidencial E2E ${Date.now()}`
    const WITHDRAWALS = `Dr. Fulano se declarou impedido ${Date.now()}`

    await signInAs(page, 'chefe.ccih@test.local')
    await gotoMeeting(page)

    const panel = reservedSessionsRegion(page)
    await expect(panel).toBeVisible({ timeout: 10_000 })
    await expect(
      panel.getByRole('button', { name: /Abrir sessão reservada/i }),
    ).toBeVisible()

    // --- Open a reserved session + add a case-linked item ---
    const addItemBtn = await openFreshReservedSession(page)
    await addItemBtn.click()
    const dialog = page.getByRole('dialog', { name: /Adicionar item reservado/i })
    await expect(dialog).toBeVisible({ timeout: 8_000 })

    // "Vinculado a um caso" is the default mode (cases.length > 0) — the select
    // is already interactable.
    await dialog.locator('select').selectOption(caseId)
    await dialog.getByLabel(/^Substância/i).fill(SUBSTANCE)
    await dialog.getByLabel(/^Decisão/i).fill(DECISION)
    await dialog.getByLabel(/Impedimentos declarados/i).fill(WITHDRAWALS)
    // Quorum checkbox defaults checked — leave it ("Quórum mantido" expected below).

    await dialog.getByRole('button', { name: 'Adicionar item' }).click()
    // 20-25s throughout this file for post-mutation waits on the meeting detail
    // page — see openFreshReservedSession's comment.
    await expect(dialog).not.toBeVisible({ timeout: 20_000 })

    // --- Persistence + pt-BR content: every tier visible to the authoring coordinator ---
    const row = page.locator('li').filter({ hasText: DECISION })
    await expect(row).toBeVisible({ timeout: 20_000 })
    await expect(row.getByText('Item reservado')).toBeVisible()
    await expect(row.getByText('Quórum mantido')).toBeVisible()
    await expect(row.getByText(new RegExp(`nº ${caseNumber}(?!\\d)`))).toBeVisible()
    await expect(row.getByText(WITHDRAWALS)).toBeVisible()
    await expect(row.getByText(SUBSTANCE)).toBeVisible()
    await expect(row.getByText(DECISION)).toBeVisible()

    // Reload proves this is server-persisted state, not client-only optimism.
    await page.reload()
    const rowAfterReload = page.locator('li').filter({ hasText: DECISION })
    await expect(rowAfterReload).toBeVisible({ timeout: 20_000 })
    await expect(rowAfterReload.getByText(SUBSTANCE)).toBeVisible()
  })

  test('chefe.ccih adds a case-less reserved item with an explicit reader list — the named reader can read it, persists with pt-BR content', async ({
    page,
  }) => {
    test.setTimeout(90_000)

    const SUBSTANCE = `Substância sem caso E2E ${Date.now()}`
    const DECISION = `Decisão sem caso E2E ${Date.now()}`

    await signInAs(page, 'chefe.ccih@test.local')
    await gotoMeeting(page)

    const addItemBtn = await openFreshReservedSession(page)
    await addItemBtn.click()

    const dialog = page.getByRole('dialog', { name: /Adicionar item reservado/i })
    await expect(dialog).toBeVisible({ timeout: 8_000 })

    await dialog.getByLabel(/Sem caso \(lista de leitores\)/i).check()
    // Reader list gates case-less content (BUG-STAGEC-READER below: there is no
    // separate coordinator bypass — the author must add herself explicitly to
    // read her own item back), so include BOTH chefe.ccih and multi to prove
    // the mechanism for two independent readers in one write.
    await dialog.getByRole('checkbox', { name: 'Chefe CCIH' }).check()
    await dialog.getByRole('checkbox', { name: MULTI_NAME }).check()
    await dialog.getByLabel(/^Substância/i).fill(SUBSTANCE)
    await dialog.getByLabel(/^Decisão/i).fill(DECISION)
    // Case-less mode has no "Impedimentos declarados" field (component only
    // renders it when mode === 'case').
    await expect(dialog.getByLabel(/Impedimentos declarados/i)).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Adicionar item' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 20_000 })

    // Author's own view (as a named reader): full content, no case → no
    // "Processo:" line renders.
    const authorRow = page.locator('li').filter({ hasText: DECISION })
    await expect(authorRow).toBeVisible({ timeout: 20_000 })
    await expect(authorRow.getByText('Item reservado')).toBeVisible()
    await expect(authorRow.getByText(SUBSTANCE)).toBeVisible()
    await expect(authorRow.getByText(/^Processo:/)).toHaveCount(0)

    // The named reader (multi) can also read the case-less item's substance —
    // the case-less tier follows the reader list (meeting_closed_session_item_readers),
    // not case deliberation reach (there is no case to have reach on).
    await signOut(page)
    await signInAs(page, 'multi@test.local')
    await gotoMeeting(page)
    const readerRow = page.locator('li').filter({ hasText: DECISION })
    await expect(readerRow).toBeVisible({ timeout: 20_000 })
    await expect(readerRow.getByText(SUBSTANCE)).toBeVisible()
  })

  test('BUG-STAGEC-READER repro: a case-less item is hidden even from the coordinator who authored it, when she omits herself from the reader list', async ({
    page,
  }) => {
    // Filed as BUG-STAGEC-READER in PROGRESS.md — a real, reproducible product
    // discrepancy (see the comment below), not a test bug. `test.fail()` marks
    // this as an EXPECTED failure: the suite reports it as passing precisely
    // because the assertion fails as documented, and (unlike a skip) Playwright
    // flips it to a hard failure the moment the underlying bug is fixed and this
    // test starts passing unexpectedly — so it can't silently go stale. It does
    // not gate the rest of this `serial` file (a `test.fail()` test that fails
    // as expected does not abort the describe/file the way a bare failure does).
    test.fail()
    test.setTimeout(90_000)

    const SUBSTANCE = `Substância sem leitor E2E ${Date.now()}`
    const DECISION = `Decisão sem leitor E2E ${Date.now()}`

    await signInAs(page, 'chefe.ccih@test.local')
    await gotoMeeting(page)

    const addItemBtn = await openFreshReservedSession(page)
    await addItemBtn.click()

    const dialog = page.getByRole('dialog', { name: /Adicionar item reservado/i })
    await expect(dialog).toBeVisible({ timeout: 8_000 })
    await dialog.getByLabel(/Sem caso \(lista de leitores\)/i).check()
    // Only multi as reader — chefe.ccih (author + coordinator) is NOT checked.
    await dialog.getByRole('checkbox', { name: MULTI_NAME }).check()
    await dialog.getByLabel(/^Substância/i).fill(SUBSTANCE)
    await dialog.getByLabel(/^Decisão/i).fill(DECISION)

    // Neither substance nor decision is a unique anchor here (that's the point
    // under test — they may render as nothing), so capture the row via a
    // COUNT increase, not `.last()` + `toBeVisible()` (which would be satisfied
    // trivially by an already-visible OLDER "Item reservado" row before this
    // one renders — the exact race `openFreshReservedSession` guards against).
    const items = page.locator('li').filter({ hasText: 'Item reservado' })
    const countBefore = await items.count()
    await dialog.getByRole('button', { name: 'Adicionar item' }).click()
    // 20-25s so this test's failure mode stays precise: it must fail at the
    // CONTENT check below (the documented bug), never at a spurious dialog-close
    // timeout that would masquerade as the same red for the wrong reason.
    await expect(dialog).not.toBeVisible({ timeout: 20_000 })
    await expect(items).toHaveCount(countBefore + 1, { timeout: 25_000 })
    const row = items.last()

    // The panel's own copy (reserved-sessions-panel.tsx) promises: "itens sem
    // caso, apenas os leitores indicados e a coordenação" — readers AND the
    // coordination. The coordinator who just authored this item is neither a
    // participant on a case (there is none) nor in the reader list, so per that
    // promise she should still see it. She does not — the RPC projects null for
    // both fields to her, same as any other non-reader.
    await expect(row.getByText(SUBSTANCE)).toBeVisible()
    await expect(row.getByText(DECISION)).toBeVisible()
  })

  test('multi (non-coordinator) sees no authoring controls, but keeps read access to the reserved-sessions panel', async ({
    page,
  }) => {
    await signInAs(page, 'multi@test.local')
    await gotoMeeting(page)

    const panel = reservedSessionsRegion(page)
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // Read access preserved — the prior tests' items are visible to her too
    // (she IS a commission member; this is the coordinator-vs-member split,
    // a DIFFERENT axis from Deliverable 3's membership split).
    await expect(panel.getByText('Item reservado').first()).toBeVisible({
      timeout: 10_000,
    })

    // No authoring controls anywhere on the page for a non-coordinator.
    await expect(
      page.getByRole('button', { name: /Abrir sessão reservada/i }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Adicionar item' }),
    ).toHaveCount(0)
  })
})

// ===========================================================================
// Deliverable 2 — Composed-ata tiered rendering (confidentiality money-shot)
// ===========================================================================

test.describe('Deliverable 2: composed-ata tiered rendering', () => {
  test('coordinator reads full substância/decisão on an explicit_grants_only case; a member without deliberation reach reads only the non-identifying stub', async ({
    page,
  }) => {
    test.setTimeout(90_000)

    const ownerToken = await getOwnerToken(page, 'chefe.ccih@test.local')
    const caseId = await createFreshCase(
      page,
      ownerToken,
      `Sessão reservada — sub-grupo ${Date.now()}`,
    )
    await setCaseVisibility(page, ownerToken, caseId, 'explicit_grants_only')
    const caseNumber = await getCaseNumber(page, ownerToken, caseId)

    const SUBSTANCE = `Substância sub-grupo E2E ${Date.now()}`
    const DECISION = `Decisão sub-grupo E2E ${Date.now()}`
    const WITHDRAWALS = `Impedimento sub-grupo E2E ${Date.now()}`

    // --- Author the item as the coordinator ---
    await signInAs(page, 'chefe.ccih@test.local')
    await gotoMeeting(page)
    const addItemBtn = await openFreshReservedSession(page)
    await addItemBtn.click()

    const dialog = page.getByRole('dialog', { name: /Adicionar item reservado/i })
    await expect(dialog).toBeVisible({ timeout: 8_000 })
    await dialog.locator('select').selectOption(caseId)
    await dialog.getByLabel(/^Substância/i).fill(SUBSTANCE)
    await dialog.getByLabel(/^Decisão/i).fill(DECISION)
    await dialog.getByLabel(/Impedimentos declarados/i).fill(WITHDRAWALS)
    await dialog.getByRole('button', { name: 'Adicionar item' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 20_000 })

    // --- No-regression twin: the coordinator (full reach + read_case_deliberation
    // via the coordinator arm — confirmed live: app.has_case_capability = true,
    // is_case_excluded = false, is_case_respondent = false for this fixture)
    // sees every tier on her own explicit_grants_only case. ---
    const coordRow = page.locator('li').filter({ hasText: DECISION })
    await expect(coordRow).toBeVisible({ timeout: 20_000 })
    await expect(coordRow.getByText(new RegExp(`nº ${caseNumber}(?!\\d)`))).toBeVisible()
    await expect(coordRow.getByText(WITHDRAWALS)).toBeVisible()
    await expect(coordRow.getByText(SUBSTANCE)).toBeVisible()

    // --- The money-shot: a plain commission member with NO grant on this case
    // (no coordinator role, no assignment, no case_access_grants row — confirmed
    // live: has_case_capability('read_case_deliberation') = false, is_case_excluded
    // = false, is_case_respondent = false) reads the member-wide propriety number
    // and decision (ADR 0078 A26 — PO-affirmed intended, uniform regardless of
    // visibility_policy) but NOT the deliberation-gated substance or withdrawal
    // names. The tiering is server-enforced (get_reserved_session_items); this
    // proves the UI faithfully renders exactly what the RPC projected — it never
    // shows a blank placeholder or tries to resolve a masked field client-side. ---
    await signOut(page)
    await signInAs(page, 'multi@test.local')
    await gotoMeeting(page)
    const memberRow = page.locator('li').filter({ hasText: DECISION })
    await expect(memberRow).toBeVisible({ timeout: 20_000 })

    // Positive control: still genuinely the same row (stub + member-wide tiers) —
    // proves the row IS found and rendered for her, not merely absent.
    await expect(memberRow.getByText('Item reservado')).toBeVisible()
    await expect(memberRow.getByText(new RegExp(`nº ${caseNumber}(?!\\d)`))).toBeVisible()
    await expect(memberRow.getByText(DECISION)).toBeVisible()

    // The over-grant assertion: substance + withdrawal names are MASKED for her.
    await expect(memberRow.getByText(SUBSTANCE)).toHaveCount(0)
    await expect(memberRow.getByText(WITHDRAWALS)).toHaveCount(0)

    // --- Defense-in-depth: the base table has NO authenticated SELECT at all
    // (ADR 0078 C4 — RLS-enabled, 0 policies, 0 grant) — a raw PostgREST read
    // is walled off entirely, not merely masked at the RPC projection layer. ---
    const multiToken = await getOwnerToken(page, 'multi@test.local')
    const rawResp = await page.request.get(
      `${SUPABASE_URL}/rest/v1/meeting_closed_session_items?select=id&limit=1`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${multiToken}`,
        },
      },
    )
    expect(rawResp.status()).toBe(403)
  })
})

// ===========================================================================
// Deliverable 3 — Org-User meetings hiding (ADR 0078 C7)
// ===========================================================================

test.describe('Deliverable 3: Org-User meetings hiding (C7)', () => {
  test('orgadmin.a (org_admin, non-member of CCIH) has no Reuniões nav item, 404s on /meetings and /meetings/[id], but reaches manage/settings/reunioes', async ({
    page,
  }) => {
    await signInAs(page, 'orgadmin.a@test.local')
    await page.goto(BASE)

    // She resolves a commission-admin "staff_admin" role via `is_commission_admin_of`
    // (session.ts: `memberRole ?? (isCommAdmin ? 'staff_admin' : null)`) WITHOUT a
    // membership row — the commission layout renders for her (role !== null).
    const nav = page.getByRole('navigation', { name: /navegação da comissão/i })
    await expect(nav).toBeVisible({ timeout: 10_000 })
    await expect(nav.getByRole('link', { name: 'Reuniões' })).toHaveCount(0)
    // Positive control: her resolved authority elsewhere in the nav is intact —
    // this is a targeted membership gate, not a broken/empty nav for her.
    await expect(nav.getByRole('link', { name: 'Configurações' })).toBeVisible()

    // Content-based, not status-code-based: `meetings/page.tsx` calls `notFound()`
    // from deep inside the async PAGE component (after two awaits), under the
    // commission LAYOUT's already-streaming shell — confirmed live (network trace:
    // the layout's shell + sidebar ship at 200 before the page boundary resolves
    // and swaps in the not-found UI), so `page.goto()` reports the shell's 200,
    // never 404, even though the not-found UI genuinely renders and no meeting
    // data ever reaches the client. This is a documented distinction in this
    // codebase — nsp-per-hospital.spec.ts: "the nsp-org layout notFound()s at the
    // LAYOUT level … a real HTTP 404 (unlike page-level)" — and case-access.spec.ts
    // already asserts its own page-level notFound() by content
    // (`getByText(/não encontramos esta página/i)`), not status, for the same
    // reason. Asserting `.status()` here would be asserting a value this specific
    // notFound() call site cannot reliably produce, not a security property.
    await page.goto(`${BASE}/meetings`)
    await expect(
      page.getByRole('heading', { name: 'Não encontramos esta página.' }),
    ).toBeVisible({ timeout: 10_000 })
    const listBody = (await page.locator('body').textContent()) ?? ''
    expect(listBody).not.toContain(SEEDED_MEETING_TITLE)

    await page.goto(`${BASE}/meetings/${SEEDED_MEETING_ID}`)
    await expect(
      page.getByRole('heading', { name: 'Não encontramos esta página.' }),
    ).toBeVisible({ timeout: 10_000 })
    const detailBody = (await page.locator('body').textContent()) ?? ''
    expect(detailBody).not.toContain(SEEDED_MEETING_TITLE)

    // A10: the meeting-TYPE/quorum CONFIGURATION screen stays reachable for her —
    // that's authority (staff_admin-resolved), not the member-participation surface.
    const settingsRes = await page.goto(`${BASE}/manage/settings/reunioes`)
    expect(settingsRes?.status()).toBe(200)
    await expect(
      page.getByRole('heading', { name: 'Configurações' }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('a real member/coordinator (chefe.ccih) still sees Reuniões nav and reaches /meetings', async ({
    page,
  }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(BASE)

    const nav = page.getByRole('navigation', { name: /navegação da comissão/i })
    const reunioesLink = nav.getByRole('link', { name: 'Reuniões' })
    await expect(reunioesLink).toBeVisible({ timeout: 10_000 })
    await reunioesLink.click()

    await page.waitForURL(`**${BASE}/meetings`, { timeout: 15_000 })
    await expect(
      page.getByRole('heading', { name: /^Reuniões$/ }).first(),
    ).toBeVisible({ timeout: 10_000 })
  })
})

// ===========================================================================
// Keyboard-only flow (Gate requirement)
// ===========================================================================

test.describe('Keyboard-only: reserved-session authoring', () => {
  test('keyboard-only: coordinator opens a reserved session and adds a case-less reserved item via keyboard navigation', async ({
    page,
  }) => {
    test.setTimeout(90_000)

    const SUBSTANCE = `Substância teclado E2E ${Date.now()}`
    const DECISION = `Decisão teclado E2E ${Date.now()}`

    await signInAs(page, 'chefe.ccih@test.local')
    await gotoMeeting(page)

    const panel = reservedSessionsRegion(page)
    await expect(panel).toBeVisible({ timeout: 10_000 })

    // Open a reserved session via keyboard only (focus + Enter — native <button>
    // Enter triggers its click handler). Wait for the "Adicionar item" button
    // COUNT to increase (not `.last()` + `toBeVisible()`, which an already-visible
    // OLDER session's button would satisfy before this new one renders — the
    // same race `openFreshReservedSession` guards against for the click-driven
    // tests).
    const addItemButtons = page.getByRole('button', { name: 'Adicionar item' })
    const countBefore = await addItemButtons.count()
    const openBtn = panel.getByRole('button', { name: /Abrir sessão reservada/i })
    await openBtn.focus()
    await page.keyboard.press('Enter')
    // 25s — see openFreshReservedSession's comment.
    await expect(addItemButtons).toHaveCount(countBefore + 1, { timeout: 25_000 })

    const addItemBtn = addItemButtons.last()
    await addItemBtn.focus()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog', { name: /Adicionar item reservado/i })
    await expect(dialog).toBeVisible({ timeout: 8_000 })

    // Switch to "Sem caso" via keyboard (native radio: focus + Space checks it).
    const readersRadio = dialog.getByLabel(/Sem caso \(lista de leitores\)/i)
    await readersRadio.focus()
    await page.keyboard.press('Space')
    await expect(readersRadio).toBeChecked()

    // Check the readers via keyboard (Radix checkbox: focus + Space toggles it).
    // Include chefe.ccih herself — per BUG-STAGEC-READER (filed in PROGRESS.md),
    // a case-less item's substance/decision follows the reader list with NO
    // separate coordinator bypass, so the author must add herself to read her
    // own item back in the assertion below.
    const readerCheckbox = dialog.getByRole('checkbox', { name: MULTI_NAME })
    await readerCheckbox.focus()
    await page.keyboard.press('Space')
    await expect(readerCheckbox).toBeChecked()

    const selfReaderCheckbox = dialog.getByRole('checkbox', { name: 'Chefe CCIH' })
    await selfReaderCheckbox.focus()
    await page.keyboard.press('Space')
    await expect(selfReaderCheckbox).toBeChecked()

    // Tab-equivalent: focus each field directly and type (mirrors the
    // AC6 keyboard-only convention in phase10-meetings.spec.ts).
    const substanciaField = dialog.getByLabel(/^Substância/i)
    await substanciaField.focus()
    await page.keyboard.type(SUBSTANCE)
    const decisaoField = dialog.getByLabel(/^Decisão/i)
    await decisaoField.focus()
    await page.keyboard.type(DECISION)

    // Submit: focus the button then .click() — mirrors the documented
    // phase10-meetings.spec.ts AC6 mitigation ("keyboards Submit may not fire
    // the React button's onClick — use .click() for cross-browser reliability"),
    // the identical Dialog+form+submit shape as this form.
    const submitBtn = dialog.getByRole('button', { name: 'Adicionar item' })
    await submitBtn.focus()
    await submitBtn.click()

    await expect(dialog).not.toBeVisible({ timeout: 20_000 })

    const row = page.locator('li').filter({ hasText: DECISION })
    await expect(row).toBeVisible({ timeout: 20_000 })
    await expect(row.getByText(SUBSTANCE)).toBeVisible()
  })
})
