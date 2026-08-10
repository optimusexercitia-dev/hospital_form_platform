import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"

/**
 * Ethics E1 — Access Spine (ADR 0072; build plan docs/phases/ethics-e1-access-spine.md
 * §4) — the m2-gate release. E1 is BACKEND-ONLY: no new ethics-specific screens ship
 * in this phase. This spec proves the acceptance criteria through the EXISTING
 * generic surfaces — the staff case-detail page (`/casos/[caseId]`), "Meus Casos"
 * (`/meus-casos`), and the existing case-documents panel/attachment-open door — plus
 * direct authenticated RPC/PostgREST calls where no UI exists yet (participant
 * writes, recusal/COI RPCs, and the document confidentiality ceiling), mirroring the
 * established "assert direct authenticated DML is RLS-denied" pattern (see
 * `test(action-items)` 89a4298 / phase13-audit.spec.ts `auditRowsFor` /
 * case-patient.spec.ts `rpc`).
 *
 * Fixture (supabase/seed.sql, "ETH·E1 (ADR 0072) — m2-gate E2E fixtures", CCIH /
 * commission A):
 *   CASE_ID   ca000000-0000-0000-0000-0000000000e1   label "Denúncia Ética (fixture E1)"
 *             visibility_policy=explicit_grants_only, confidentiality_level=ethics_investigation
 *   chefe.ccih@test.local   (…002) — COORDINATOR; case_access read grant WITH
 *                           max_confidentiality='legal_privileged' (seeded clearance).
 *   staff1.ccih@test.local  (…003) — SEEDED RECUSED: case_access read grant + a LIVE
 *                           case_recusals row (fe000000-…-e1). Left untouched (pristine
 *                           fixture) — only asserted, never mutated, so repeat runs stay
 *                           deterministic.
 *   staff3.ccih@test.local  (…009) — NO-GRANT CCIH member (the explicit_grants_only
 *                           boundary persona). Granted dynamically in AC-2b, cleared again
 *                           in the final cleanup step so the persona stays a clean boundary
 *                           for other specs / re-runs.
 *   staff4.ccih@test.local  (…00a) — RESPONDENT: bound via `professional_profiles.user_id`
 *                           as the case's `respondent_doctor` participant
 *                           (fd000000-…-e1). Also the established "no attribution, no
 *                           grant" boundary persona on Caso 0001 (case-access.spec.ts
 *                           AC-2) — reused here for the commission_default cross-check.
 *   multi@test.local        (…008) — fresh throwaway grantee for the dynamic
 *                           grant→recusal→lift arc, the document-ceiling checks, and the
 *                           participant-write-authority negative. Cleared at the end.
 *   Documents: a7000000-…-e1 "Parecer jurídico (privilegiado)" (legal_privileged, gated)
 *              a7000000-…-e2 "Nota do processo ético" (ethics_investigation, ordinary — O2).
 *   Participant registry: participant fa000000-…-e1 (Dra. Denunciada), role
 *              fc000000-…-e1 (respondent_doctor).
 *
 * Password for every persona: Test1234!
 *
 * Coverage map (criteria numbers = build plan §4):
 *   1 Respondent-exclusion         → AC-1a/b/c
 *   2 Explicit-grants-only         → AC-2a/b (+ AC-1c commission_default cross-check)
 *   3 Recusal                      → AC-3a (seeded, read-only) / AC-3b (dynamic record→lift)
 *   4 Document confidentiality     → AC-4a..d
 *   5 Participant write authority  → AC-5a..d
 *   6 Interview fold-in            → SKIPPED (see AC-6 test, reason inline)
 *   7 Flag-OFF byte-for-byte       → AC-7 (commission_default spot-check; full pgTAP is backend's)
 *   8 Audit                        → folded into AC-3b (record_recusal → exactly one row, PHI-free)
 *   9 Keyboard-only                → AC-9
 *
 * Runs against the LOCAL Supabase stack + the dev server (fast loop) — no
 * `waitForLoadState('networkidle')` (purged repo-wide; web-first assertions only).
 * Serial: several tests mutate shared `case_access_grants`/`case_recusals` fixture
 * state (ADR 0078 Stage B renamed `case_access` → `case_access_grants`).
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants (from supabase/seed.sql)
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY missing — set it in .env.local.')
}

const ORG = 'rede-a'
const SLUG = 'ccih'
const BASE = `/o/${ORG}/c/${SLUG}`
const ORG_A_ID = '0c000000-0000-0000-0000-00000000000a'
const COMMISSION_A = 'a0000000-0000-0000-0000-0000000000a1'

const CASE_ID = 'ca000000-0000-0000-0000-0000000000e1'
const CASE_LABEL = 'Denúncia Ética (fixture E1)'
// The pre-existing commission_default case (Caso 0001) from case-access.spec.ts —
// used only as the "unaffected non-ethics case" cross-check (AC-1c/AC-7).
const CASE_ID_COMMISSION_DEFAULT = 'd0000000-0000-0000-0000-0000000000c1'

const UID_CHEFE = '00000000-0000-0000-0000-000000000002' // chefe.ccih — coordinator + seeded clearance grant
const UID_STAFF1_RECUSED = '00000000-0000-0000-0000-000000000003' // staff1.ccih — seeded LIVE recusal
const UID_STAFF3_NOGRANT = '00000000-0000-0000-0000-000000000009' // staff3.ccih — no-grant boundary persona
const UID_STAFF4_RESPONDENT = '00000000-0000-0000-0000-00000000000a' // staff4.ccih — respondent_doctor
const UID_MULTI = '00000000-0000-0000-0000-000000000008' // multi — dynamic-grant persona

const RECUSAL_ID_SEEDED = 'fe000000-0000-0000-0000-0000000000e1'
const DOC_LEGAL_ID = 'a7000000-0000-0000-0000-0000000000e1' // legal_privileged
const DOC_LEGAL_TITLE = 'Parecer jurídico (privilegiado)'
const DOC_ETHICS_ID = 'a7000000-0000-0000-0000-0000000000e2' // ethics_investigation
const DOC_ETHICS_TITLE = 'Nota do processo ético'
const PARTICIPANT_RESPONDENT = 'fa000000-0000-0000-0000-0000000000e1'
const ROLE_RESPONDENT = 'fc000000-0000-0000-0000-0000000000e1'

const PW = 'Test1234!'

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, pw = PW) {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, pw)
}

async function signOut(page: Page) {
  await page.goto(`${BASE}/meus-casos`)
  await page.waitForURL(/meus-casos/)
  const menuBtn = page.getByRole('button', { name: /abrir menu da conta/i })
  await menuBtn.click()
  await page.getByRole('menuitem', { name: /sair/i }).click()
  await page.waitForURL(/\/login/)
}

/** Assert the case route hits the notFound() boundary — no case content leaks.
 * BUG-ACT-NOTFOUND-COPY-1: /não encontr/i — casos/[id] hits the commission
 * not-found boundary (ACT ADR 0106's sibling), same shared file as the QO·B
 * CUT_ROUTES sample already verified live. */
async function assertCaseDenied(page: Page, caseId: string, label: string) {
  await page.goto(`${BASE}/casos/${caseId}`)
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(label)).toHaveCount(0)
}

/** Assert the case route renders (the caller can read it). */
async function assertCaseReadable(page: Page, caseId: string, label: string) {
  await page.goto(`${BASE}/casos/${caseId}`)
  await page.waitForURL(`${BASE}/casos/${caseId}`)
  await expect(page.getByText(label)).toBeVisible({ timeout: 10_000 })
}

async function assertAbsentFromMeusCasos(page: Page, label: string) {
  await page.goto(`${BASE}/meus-casos`)
  await page.waitForURL(`${BASE}/meus-casos`)
  await expect(page.locator('article').filter({ hasText: label })).toHaveCount(0)
}

async function assertPresentInMeusCasos(page: Page, label: string) {
  await page.goto(`${BASE}/meus-casos`)
  await page.waitForURL(`${BASE}/meus-casos`)
  await expect(page.locator('article').filter({ hasText: label })).toHaveCount(1, {
    timeout: 10_000,
  })
}

/** Tab through the page until `predicate` matches the focused element, or give up. */
async function tabUntil(
  page: Page,
  predicate: (info: {
    tag: string
    text: string
    ariaLabel: string | null
    href: string | null
    articleText: string
  }) => boolean,
  maxPresses = 150,
): Promise<boolean> {
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el) return null
      const article = el.closest('article')
      return {
        tag: el.tagName,
        text: (el.textContent ?? '').trim(),
        ariaLabel: el.getAttribute('aria-label'),
        href: (el as HTMLAnchorElement).href ?? null,
        articleText: article ? (article.textContent ?? '') : '',
      }
    })
    if (info && predicate(info)) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Service-role + direct-authenticated-JWT helpers
// ---------------------------------------------------------------------------

interface AuditRow {
  id: string
  action: string
  actor_id: string | null
  entity_type: string
  entity_id: string
  commission_id: string | null
  summary: string
  metadata: Record<string, unknown>
}

/** Direct API call (service role) — bypasses RLS. */
async function dbQuery<T = Record<string, unknown>>(
  table: string,
  params: Record<string, string>,
): Promise<T[]> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}&select=*`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  })
  if (!res.ok) return []
  const data: unknown = await res.json()
  return Array.isArray(data) ? (data as T[]) : []
}

async function dbDelete(table: string, params: Record<string, string>): Promise<void> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  })
}

/**
 * Upsert a `case_access_grants` row (delete-then-insert; mirrors case-access.spec.ts).
 *
 * ADR 0078 Stage B (B1): `case_access` was HARD-CUT to `case_access_grants` —
 * capability-per-column, keyed by `principal_id` (not `user_id`). A plain
 * read/write `level` here maps to content + deliberation (+ write, iff level ===
 * 'write'); PHI columns are left at their `false` default — this helper is a
 * content/administrative grant, never a PHI grant. `maxConfidentiality` maps
 * straight onto the (unchanged) `max_confidentiality` column.
 */
async function upsertCaseAccess(opts: {
  caseId: string
  userId: string
  level: 'read' | 'write'
  maxConfidentiality?: string | null
  reason?: string | null
}): Promise<void> {
  await dbDelete('case_access_grants', { case_id: `eq.${opts.caseId}`, principal_id: `eq.${opts.userId}` })
  const res = await fetch(`${SUPABASE_URL}/rest/v1/case_access_grants`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      case_id: opts.caseId,
      principal_id: opts.userId,
      source: 'manual_grant',
      read_case_content: true,
      read_case_deliberation: true,
      write_case_content: opts.level === 'write',
      reason_code: 'coordinator_grant',
      granted_by: UID_CHEFE,
      max_confidentiality: opts.maxConfidentiality ?? null,
      reason: opts.reason ?? null,
    }),
  })
  if (!res.ok) throw new Error(`upsertCaseAccess failed ${res.status}: ${await res.text()}`)
}

async function clearCaseAccess(caseId: string, userId: string): Promise<void> {
  await dbDelete('case_access_grants', { case_id: `eq.${caseId}`, principal_id: `eq.${userId}` })
}

/** A real JWT for a persona (RLS is evaluated under it). */
async function getOwnerToken(
  request: APIRequestContext,
  email: string,
  password = PW,
): Promise<string> {
  const resp = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password },
  })
  expect(resp.ok()).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

/** Call an RPC under a persona JWT. Returns the raw Response for status/body checks. */
async function callRpc(
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

/** Direct PostgREST POST (INSERT) under a persona JWT. */
async function userInsert(
  request: APIRequestContext,
  table: string,
  bearer: string,
  data: Record<string, unknown>,
) {
  return request.post(`${SUPABASE_URL}/rest/v1/${table}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data,
  })
}

async function auditRowsFor(action: string, actorId: string, entityId: string): Promise<AuditRow[]> {
  return dbQuery<AuditRow>('audit_log', {
    action: `eq.${action}`,
    actor_id: `eq.${actorId}`,
    entity_id: `eq.${entityId}`,
  })
}

// ===========================================================================
// AC-1 — Respondent-exclusion (the m2 keystone)
// ===========================================================================

test('AC-1a respondent-exclusion: staff4 (respondent_doctor) gets notFound() at the case route; case absent from Meus Casos', async ({
  page,
}) => {
  await signInAs(page, 'staff4.ccih@test.local')
  await assertCaseDenied(page, CASE_ID, CASE_LABEL)
  await assertAbsentFromMeusCasos(page, CASE_LABEL)
  await signOut(page)
})

test('AC-1b hard-deny cannot be out-voted: staff4 STILL denied even with a positive case_access WRITE grant', async ({
  page,
}) => {
  // Prove the deny-term is evaluated FIRST and short-circuits every positive arm
  // (ADR 0072 D2): grant staff4 a write grant on their own case — if the deny-term
  // were bypassable, this grant would restore read. It must not.
  await upsertCaseAccess({ caseId: CASE_ID, userId: UID_STAFF4_RESPONDENT, level: 'write' })
  try {
    await signInAs(page, 'staff4.ccih@test.local')
    await assertCaseDenied(page, CASE_ID, CASE_LABEL)
    await assertAbsentFromMeusCasos(page, CASE_LABEL)
    await signOut(page)
  } finally {
    await clearCaseAccess(CASE_ID, UID_STAFF4_RESPONDENT)
  }
})

test('AC-1c commission_default cross-check: staff4 is STILL denied Caso 0001 (unaffected — the same denial as before E1, for the OLD reason)', async ({
  page,
}) => {
  // Caso 0001 is commission_default (not ethics-typed): staff4 has no attribution/grant
  // there either (case-access.spec.ts AC-2's own boundary persona). This is the E2E
  // spot-check that a non-ethics case's member-read behavior is byte-for-byte
  // unchanged now that case_participants/case_types are ON (AC-7).
  await signInAs(page, 'staff4.ccih@test.local')
  await page.goto(`${BASE}/casos/${CASE_ID_COMMISSION_DEFAULT}`)
  // BUG-ACT-NOTFOUND-COPY-1: /não encontr/i, the shared stem (see assertCaseDenied above).
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })
  await signOut(page)
})

// ===========================================================================
// AC-2 — Explicit-grants-only
// ===========================================================================

test('AC-2a explicit-grants-only: staff3 (plain CCIH member, no grant) gets notFound(); absent from Meus Casos', async ({
  page,
}) => {
  await signInAs(page, 'staff3.ccih@test.local')
  await assertCaseDenied(page, CASE_ID, CASE_LABEL)
  await assertAbsentFromMeusCasos(page, CASE_LABEL)
  await signOut(page)
})

test('AC-2b explicit-grants-only: after a coordinator grant, staff3 reads the case and it appears in Meus Casos', async ({
  page,
}) => {
  await upsertCaseAccess({ caseId: CASE_ID, userId: UID_STAFF3_NOGRANT, level: 'read' })
  await signInAs(page, 'staff3.ccih@test.local')
  await assertCaseReadable(page, CASE_ID, CASE_LABEL)
  await assertPresentInMeusCasos(page, CASE_LABEL)
  await signOut(page)
  // Cleanup: restore staff3 as the clean no-grant boundary persona.
  await clearCaseAccess(CASE_ID, UID_STAFF3_NOGRANT)
})

// ===========================================================================
// AC-3 — Recusal
// ===========================================================================

test('AC-3a seeded recusal: staff1 (granted, then recused) is denied despite holding a read grant', async ({
  page,
}) => {
  // Read-only assertion — the seeded recusal (fe000000-…-e1) is left untouched so
  // repeat runs stay deterministic.
  const recusals = await dbQuery<{ id: string; user_id: string; lifted_at: string | null }>(
    'case_recusals',
    { id: `eq.${RECUSAL_ID_SEEDED}` },
  )
  expect(recusals[0]?.lifted_at).toBeNull()
  expect(recusals[0]?.user_id).toBe(UID_STAFF1_RECUSED)

  await signInAs(page, 'staff1.ccih@test.local')
  await assertCaseDenied(page, CASE_ID, CASE_LABEL)
  await assertAbsentFromMeusCasos(page, CASE_LABEL)
  await signOut(page)
})

test('AC-3b + AC-8 dynamic recusal: record_recusal immediately revokes read + writes exactly one PHI-free audit row; lift_recusal restores it', async ({
  page,
  request,
}) => {
  // Start clean, then grant multi read access.
  await clearCaseAccess(CASE_ID, UID_MULTI)
  await upsertCaseAccess({ caseId: CASE_ID, userId: UID_MULTI, level: 'read' })

  await signInAs(page, 'multi@test.local')
  await assertCaseReadable(page, CASE_ID, CASE_LABEL)
  await assertPresentInMeusCasos(page, CASE_LABEL)
  await signOut(page)

  // --- AC-8: audit — exactly one PHI-free case.recusal_recorded row ---
  const before = await auditRowsFor('case.recusal_recorded', UID_CHEFE, CASE_ID)

  const chefeToken = await getOwnerToken(request, 'chefe.ccih@test.local')
  const recResp = await callRpc(request, 'record_recusal', chefeToken, {
    p_case_id: CASE_ID,
    p_user_id: UID_MULTI,
    p_reason_md: 'Conflito de interesse identificado (teste E2E).',
  })
  expect(recResp.ok()).toBeTruthy()
  const recusalId = (await recResp.json()) as string

  const after = await auditRowsFor('case.recusal_recorded', UID_CHEFE, CASE_ID)
  expect(after.length).toBe(before.length + 1)
  const newRow = after[after.length - 1]
  expect(newRow.entity_type).toBe('case')
  expect(newRow.commission_id).toBe(COMMISSION_A)
  // PHI-free (Rule 11): metadata carries only user_id + source — never the free-text
  // reason. `acting_as` is ACT ADR 0106 D8: audit_write stamps the caller's active
  // hat (a role label, not PHI) into every row's metadata.
  const metaKeys = Object.keys(newRow.metadata).sort()
  expect(metaKeys).toEqual(['acting_as', 'source', 'user_id'])
  expect(newRow.metadata.acting_as).toBe('staff_admin')
  expect(JSON.stringify(newRow.metadata)).not.toContain('Conflito de interesse identificado')

  // --- multi loses read THE MOMENT the recusal is live ---
  await signInAs(page, 'multi@test.local')
  await assertCaseDenied(page, CASE_ID, CASE_LABEL)
  await assertAbsentFromMeusCasos(page, CASE_LABEL)
  await signOut(page)

  // --- lift_recusal restores read ---
  const liftResp = await callRpc(request, 'lift_recusal', chefeToken, {
    p_recusal_id: recusalId,
    p_reason_md: 'Conflito resolvido (teste E2E).',
  })
  expect(liftResp.ok()).toBeTruthy()

  await signInAs(page, 'multi@test.local')
  await assertCaseReadable(page, CASE_ID, CASE_LABEL)
  await assertPresentInMeusCasos(page, CASE_LABEL)
  await signOut(page)

  // Cleanup: drop multi's grant (the lifted recusal row is harmless — it stays as an
  // audit-preserving artifact, per ADR 0072 D4's soft-lift design).
  await clearCaseAccess(CASE_ID, UID_MULTI)
})

// ===========================================================================
// AC-4 — Document confidentiality ceiling
// ===========================================================================

test('AC-4a/b ordinary reader: sees the ethics_investigation doc, NOT the legal_privileged doc (list + direct open both deny)', async ({
  page,
  request,
}) => {
  await upsertCaseAccess({ caseId: CASE_ID, userId: UID_MULTI, level: 'read' }) // no clearance
  const multiToken = await getOwnerToken(request, 'multi@test.local')

  await signInAs(page, 'multi@test.local')
  await page.goto(`${BASE}/casos/${CASE_ID}`)
  await page.waitForURL(`${BASE}/casos/${CASE_ID}`)
  const docsPanel = page.getByRole('region', { name: 'Documentos' })
  await expect(docsPanel).toBeVisible({ timeout: 10_000 })
  await expect(docsPanel.getByText(DOC_ETHICS_TITLE)).toBeVisible()
  await expect(docsPanel.getByText(DOC_LEGAL_TITLE)).toHaveCount(0) // O2: hidden from the LIST
  await signOut(page)

  // A known-id direct open is a distinct, explicit denial (HC0E6) — not just hidden.
  const openResp = await callRpc(request, 'open_attachment', multiToken, { p_id: DOC_LEGAL_ID })
  expect(openResp.ok()).toBeFalsy()
  expect(JSON.stringify(await openResp.json())).toMatch(/HC0E6/i)

  // The ordinary ethics_investigation doc opens fine for the same reader (O2).
  const openOk = await callRpc(request, 'open_attachment', multiToken, { p_id: DOC_ETHICS_ID })
  expect(openOk.ok()).toBeTruthy()

  await clearCaseAccess(CASE_ID, UID_MULTI)
})

test('AC-4c/d cleared reader (chefe): sees BOTH documents; direct open of the legal_privileged doc succeeds', async ({
  page,
  request,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/casos/${CASE_ID}`)
  await page.waitForURL(`${BASE}/casos/${CASE_ID}`)
  const docsPanel = page.getByRole('region', { name: 'Documentos' })
  await expect(docsPanel).toBeVisible({ timeout: 10_000 })
  await expect(docsPanel.getByText(DOC_ETHICS_TITLE)).toBeVisible()
  await expect(docsPanel.getByText(DOC_LEGAL_TITLE)).toBeVisible() // clearance covers it
  await signOut(page)

  const chefeToken = await getOwnerToken(request, 'chefe.ccih@test.local')
  const openResp = await callRpc(request, 'open_attachment', chefeToken, { p_id: DOC_LEGAL_ID })
  expect(openResp.ok()).toBeTruthy()
  const rows = (await openResp.json()) as { bucket: string; path: string }[]
  expect(rows[0]?.bucket).toBeTruthy()
  expect(rows[0]?.path).toBeTruthy()
})

// ===========================================================================
// AC-5 — Participant write authority
// ===========================================================================

test('AC-5a/b participant write authority: a non-coordinator case reader is denied (RPC + direct INSERT)', async ({
  request,
}) => {
  await upsertCaseAccess({ caseId: CASE_ID, userId: UID_MULTI, level: 'read' })
  const multiToken = await getOwnerToken(request, 'multi@test.local')

  // RPC denial (HC0E4 / 42501).
  const rpcResp = await callRpc(request, 'add_case_participant', multiToken, {
    p_case_id: CASE_ID,
    p_participant_id: PARTICIPANT_RESPONDENT,
    p_role_id: ROLE_RESPONDENT,
  })
  expect(rpcResp.ok()).toBeFalsy()
  expect(JSON.stringify(await rpcResp.json())).toMatch(/HC0E4|42501|permission denied/i)

  // Direct client INSERT on case_participants is RLS-denied (SELECT-only table —
  // same style as test(action-items) 89a4298's direct-DML-is-denied assertion).
  const insertResp = await userInsert(request, 'case_participants', multiToken, {
    case_id: CASE_ID,
    participant_id: PARTICIPANT_RESPONDENT,
    role_id: ROLE_RESPONDENT,
  })
  expect(insertResp.ok()).toBeFalsy()
  expect([401, 403]).toContain(insertResp.status())
  expect(JSON.stringify(await insertResp.json())).toMatch(/42501|permission denied|row-level security/i)

  await clearCaseAccess(CASE_ID, UID_MULTI)
})

test('AC-5c/d coordinator succeeds: add_case_participant writes a row + exactly one audit row; remove_case_participant cleans up', async ({
  request,
}) => {
  const throwawayId = '00000000-aaaa-0000-0000-0000000000e1'
  // Fresh throwaway registry participant (service role) — never touches the seeded
  // respondent participant.
  await dbDelete('participants', { id: `eq.${throwawayId}` })
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/participants`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      id: throwawayId,
      organization_id: ORG_A_ID,
      participant_type: 'professional',
      sensitivity_class: 'professional_identity',
      display_name: 'Participante Teste E1 (throwaway)',
      created_by: UID_CHEFE,
    }),
  })
  expect(insertRes.ok).toBeTruthy()

  const chefeToken = await getOwnerToken(request, 'chefe.ccih@test.local')
  const before = await auditRowsFor('case.participant_added', UID_CHEFE, CASE_ID)

  const addResp = await callRpc(request, 'add_case_participant', chefeToken, {
    p_case_id: CASE_ID,
    p_participant_id: throwawayId,
    p_role_id: ROLE_RESPONDENT,
    p_is_primary_subject: false,
  })
  expect(addResp.ok()).toBeTruthy()
  const caseParticipantId = (await addResp.json()) as string
  expect(caseParticipantId).toBeTruthy()

  const after = await auditRowsFor('case.participant_added', UID_CHEFE, CASE_ID)
  expect(after.length).toBe(before.length + 1)

  // Cleanup: soft-remove the case_participants link + delete the throwaway registry row.
  const removeResp = await callRpc(request, 'remove_case_participant', chefeToken, {
    p_case_participant_id: caseParticipantId,
  })
  expect(removeResp.ok()).toBeTruthy()
  await dbDelete('participants', { id: `eq.${throwawayId}` })
})

// ===========================================================================
// AC-6 — Interview fold-in (SKIPPED — documented reason)
// ===========================================================================

test.skip(
  'AC-6 interview fold-in: SKIPPED — no ethics-case interview fixture is seeded (Caso 9001 has no case_interviews rows), and the participant_id / enforcing-confidentiality UI wiring is explicitly deferred to E2/E3 surfacing (ADR 0072 D7 note: "The IV2 picker\'s helper text is replaced (FE, E2/E3 surfacing)"). E1 ships the schema + RPCs (set_interview_participant, set_interview_confidentiality) with no UI to drive them yet, and mutating the Caso 0001 interview fixture used by phase11-interviews.spec.ts to probe them directly risks cross-spec contamination for a criterion this phase does not surface. Backend\'s pgTAP (228_ethics_e1) is the authority for this criterion at E1.',
  async () => {},
)

// ===========================================================================
// AC-7 — Flag-OFF byte-for-byte (E2E spot-check; full truth-table is backend's pgTAP)
// ===========================================================================

test('AC-7 flag-ON regression spot-check: a granted READ member (multi) on this ethics case behaves like an ordinary case-access grantee — same shape as the pre-E1 case-access.spec.ts AC-3a', async ({
  page,
}) => {
  // With case_participants/case_types ON, an explicit_grants_only case with a plain
  // read grant and no respondent/recusal should read EXACTLY like a commission_default
  // grantee already covered by case-access.spec.ts AC-3a — proving the new deny-terms
  // are inert for a member with nothing to deny.
  await upsertCaseAccess({ caseId: CASE_ID, userId: UID_MULTI, level: 'read' })
  await signInAs(page, 'multi@test.local')
  await assertCaseReadable(page, CASE_ID, CASE_LABEL)
  // Lifecycle controls remain coordinator-only (unchanged from the pre-E1 shape).
  await expect(page.getByRole('button', { name: /ativar fase/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /concluir caso/i })).toHaveCount(0)
  await signOut(page)
  await clearCaseAccess(CASE_ID, UID_MULTI)
})

// ===========================================================================
// AC-9 — Keyboard-only: Meus Casos → case detail → the confidentiality-cleared document
// ===========================================================================

test('AC-9 keyboard-only: coordinator (chefe) tabs from Meus Casos into the case, then to the legal_privileged document link, and opens it', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${BASE}/meus-casos`)
  await page.waitForURL(`${BASE}/meus-casos`)
  await expect(page.getByRole('heading', { name: /meus casos/i })).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('article').filter({ hasText: CASE_LABEL })).toBeVisible({
    timeout: 10_000,
  })

  const reachedLink = await tabUntil(
    page,
    (i) => i.tag === 'A' && /ver caso completo/i.test(i.text) && i.articleText.includes(CASE_LABEL),
    60,
  )
  expect(reachedLink).toBe(true)
  await page.keyboard.press('Enter')
  await page.waitForURL(`${BASE}/casos/${CASE_ID}`)
  await expect(page.getByText(CASE_LABEL)).toBeVisible({ timeout: 10_000 })

  // The document control renders as either a plain <a href> (pre-signed) or the
  // audited OpenAttachmentButton <button> (click-time RPC signing) depending on
  // whether listCaseDocuments could batch-sign it — accept either element shape.
  // Plain substring match (not a RegExp built from the title): DOC_LEGAL_TITLE
  // contains literal parentheses, which `new RegExp(...)` would otherwise parse
  // as a capture group instead of literal characters.
  const wantedLabel = `baixar ${DOC_LEGAL_TITLE}`.toLowerCase()
  const reachedDoc = await tabUntil(
    page,
    (i) =>
      (i.tag === 'A' || i.tag === 'BUTTON') &&
      (i.ariaLabel ?? '').toLowerCase().includes(wantedLabel),
    200,
  )
  expect(reachedDoc).toBe(true)

  // Activate via keyboard alone. Seed-only documents have no real backing storage
  // bytes (established convention — e2e/phase-f2-attachments.spec.ts
  // `clickExpectingMintFailure`: a SQL seed cannot write real object bytes into the
  // storage-api file backend, so `createSignedUrl` legitimately 404s even though the
  // RPC authorizes the read — the confidentiality-ceiling authorization already
  // proven directly in AC-4c/d). So the button surfaces the inline pt-BR failure
  // message here rather than a popup; asserting it appears proves the keyboard
  // activation reached and operated the control.
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('alert').filter({ hasText: 'Não foi possível abrir o anexo.' }),
  ).toBeVisible({ timeout: 10_000 })

  await signOut(page)
})
