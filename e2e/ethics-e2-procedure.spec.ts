import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn, accessToken } from "./helpers/auth"

/**
 * Ethics E2 — Procedure (ADR 0073; build plan docs/phases/ethics-e2-procedure.md
 * §4) — the disciplinary-lifecycle surface riding on top of ETH·E1's access
 * spine. Coordinator-gated "Processo ético" tab at
 * `/o/[org]/c/[commission]/manage/cases/[caseId]/etica`. This spec drives the
 * FULL admissibility → allegations/findings → decision → votes → issue →
 * hearing → notification → appeal lifecycle as REAL writes through the UI
 * (frontend could not verify this end-to-end in its preview environment — this
 * is the authoritative first pass), plus the 5 coordinator controls (Part 1),
 * the tab-gating rules, and one keyboard-only flow (embedded in the vote step).
 *
 * Fixture (supabase/seed.sql, "ETH·E1 (ADR 0072) — m2-gate E2E fixtures" +
 * "ETH·E2 (ADR 0073 D3)", CCIH / commission A, Rede A):
 *   CASE_ID   ca000000-0000-0000-0000-0000000000e1   case #9001, label
 *             "Denúncia Ética (fixture E1)", visibility_policy=
 *             explicit_grants_only, confidentiality_level=ethics_investigation.
 *             ethics_case_details already exists (admissibility_status=
 *             'pending', complaint_channel='internal', a summary) — the case is
 *             ethics-typed from the seed, so this spec starts at "decide
 *             admissibility", not at "mark ethics-typed".
 *   chefe.ccih@test.local   (…002) — COORDINATOR (staff_admin of CCIH).
 *   staff1.ccih@test.local  (…003) — SEEDED RECUSED (case_recusals fe000000-
 *             …-e1, LIVE, lifted_at null). Left untouched — only asserted.
 *   staff2.ccih@test.local  (…004) — plain CCIH staff; used as (a) the
 *             non-coordinator gating boundary AND (b) the dynamic
 *             record-recusal/lift-recusal target (restored to normal before
 *             the vote section runs).
 *   staff3.ccih@test.local  (…009), multi@test.local (…008) — plain CCIH
 *             staff; vote-casting candidates (direct RPC).
 *   staff4.ccih@test.local  (…00a) — RESPONDENT (professional_profiles
 *             fb000000-…-e1, case_participants fd000000-…-e1, role
 *             respondent_doctor). Retention-pin target (§D9).
 *   Non-ethics case (commission_default): d0000000-0000-0000-0000-0000000000c1
 *             ("Caso 0001" from case-access.spec.ts / ethics-e1-access-spine.spec.ts)
 *             — the "tab absent on a non-ethics case" cross-check.
 *   Allegation categories (org Rede A): ec000000-…-e1 "Conduta profissional
 *             inadequada", ec000000-…-e2 "Quebra de confidencialidade".
 *   Sanction types (org-wide catalog): "Advertência confidencial", "Censura
 *             confidencial", "Censura pública em publicação oficial",
 *             "Suspensão do exercício profissional", "Cassação do exercício
 *             profissional".
 *
 * Password for every persona: Test1234!
 *
 * Coverage map (tester's delegated scope — a curated subset of build-plan §4,
 * the pgTAP-covered items (audit exhaustiveness, flag-OFF, N-arm delivery)
 * being backend's; see PROGRESS.md BE-7/BE-9 "ethics 253–259" for those):
 *   1 Full procedure flow, REAL writes           → FLOW-1..FLOW-12
 *   2 Coordinator controls (Part 1)               → CTRL-1..CTRL-4
 *   3 Gating (tab visibility + Nova decisão)       → GATE-A..GATE-D
 *   4 Keyboard-only                                → embedded in FLOW-7 (chefe's own vote)
 *   5 Stage-E legal_privileged decision letter     → NOT exercised (unbuilt; ADR 0073
 *                                                     Amendment §3 / 0078 A19/B3)
 *
 * CAVEAT A (case-detail hydration under Playwright) is resolved by GATE-C/GATE-D:
 * both open a real dialog after navigation (proving the React tree hydrated and
 * attached handlers, not just server-rendered HTML) on the SAME `(detail)` route
 * group frontend reported stuck in its mcp-browser preview.
 *
 * Runs against a PROD-STANDALONE build (`node .next/standalone/server.js`), not
 * `next dev` — see docs/testing/e2e-prod-build-gate.md. No
 * `waitForLoadState('networkidle')` (purged repo-wide); web-first assertions only.
 * Serial: the procedure flow is inherently stateful (admissibility gates
 * allegations/decisions; a decision must exist before votes/details/issue/appeal).
 *
 * State hygiene: CTRL-3/CTRL-4 round-trip the case's confidentiality_level /
 * visibility_policy back to the seeded values via the SAME UI door that changed
 * them (a real regression test of the door, not just a one-way mutation), and a
 * file-level `afterAll` force-restores both via a direct service-role UPDATE as
 * a safety net — ethics-e1-access-spine.spec.ts's AC-2a/b depend on
 * `visibility_policy = explicit_grants_only` staying true on this same case for
 * every future full-suite run.
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
const MANAGE_BASE = `${BASE}/manage/cases`
const COMMISSION_A = 'a0000000-0000-0000-0000-0000000000a1'

const CASE_ID = 'ca000000-0000-0000-0000-0000000000e1'
const CASE_LABEL = 'Denúncia Ética (fixture E1)'
const CASE_URL = `${MANAGE_BASE}/${CASE_ID}`
const ETICA_URL = `${CASE_URL}/etica`

// Non-ethics case under the SAME commission (case-access.spec.ts / E1 spec's
// "Caso 0001") — the tab-absence + direct-hit cross-check.
const CASE_ID_NON_ETHICS = 'd0000000-0000-0000-0000-0000000000c1'

const UID_CHEFE = '00000000-0000-0000-0000-000000000002' // chefe.ccih — coordinator
const UID_STAFF1_RECUSED = '00000000-0000-0000-0000-000000000003' // staff1.ccih — seeded LIVE recusal
const UID_STAFF2 = '00000000-0000-0000-0000-000000000004' // staff2.ccih — non-coordinator boundary + dynamic recusal target
const UID_STAFF3 = '00000000-0000-0000-0000-000000000009' // staff3.ccih — plain member, GATE-C2's write-grantee
const UID_STAFF4_RESPONDENT = '00000000-0000-0000-0000-00000000000a' // staff4.ccih — respondent_doctor
const PROFESSIONAL_PROFILE_RESPONDENT = 'fb000000-0000-0000-0000-0000000000e1' // staff4's professional_profiles row

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

/**
 * Assert the route hits a notFound() boundary — no content leaks.
 *
 * BUG-ACT-NOTFOUND-COPY-1 (same class, this file): ACT Stage 3 added a
 * manage/not-found.tsx sibling boundary that catches a route's own
 * page-level notFound() with DIFFERENT copy ("Página não encontrada") than
 * the global boundary ("Não encontramos esta página."). Both share the
 * pt-BR "não encontr-" stem; matching on that is the security assertion
 * (denial + no leak) that survives which boundary renders, not one pinned
 * copy — found live: this exact helper 404'd correctly but with the OTHER
 * boundary's text, cascading test.describe.configure({mode:'serial'})
 * failures through the rest of the file.
 */
async function assertRouteDenied(page: Page, url: string) {
  await page.goto(url)
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })
}

/** `datetime-local` input value (local wall clock) N days from now. */
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function inDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toDatetimeLocal(d)
}

/**
 * Tab through the page (bounded) until `predicate` matches the focused
 * element, or give up. Mirrors ethics-e1-access-spine.spec.ts's `tabUntil` —
 * matches on tag/text/id only (ethics panels use `<li>`, not `<article>`, so
 * the E1 helper's `articleText` scoping doesn't apply here; uniqueness is
 * established at each call site instead, e.g. "only one decision card exists
 * yet" / "only one open dialog exists").
 */
async function tabUntil(
  page: Page,
  predicate: (info: { tag: string; text: string; id: string | null; ariaLabel: string | null }) => boolean,
  maxPresses = 200,
): Promise<boolean> {
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el) return null
      return {
        tag: el.tagName,
        text: (el.textContent ?? '').trim(),
        id: el.id || null,
        ariaLabel: el.getAttribute('aria-label'),
      }
    })
    if (info && predicate(info)) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Service-role + direct-authenticated-JWT helpers (mirrors
// ethics-e1-access-spine.spec.ts's established pattern)
// ---------------------------------------------------------------------------

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

/** Direct service-role UPDATE — used ONLY by the file-level safety-net `afterAll`. */
async function forceCaseFields(fields: Record<string, unknown>): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/cases?id=eq.${CASE_ID}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(fields),
  })
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
 * Upsert a `case_access_grants` row (delete-then-insert; mirrors
 * ethics-e1-access-spine.spec.ts). CASE_ID is `explicit_grants_only` — a plain
 * commission member reads NOTHING without one of these, independent of
 * recusal state, so CTRL-2 needs this to isolate "denied because recused"
 * from "denied because never granted".
 */
async function upsertCaseAccess(userId: string): Promise<void> {
  await dbDelete('case_access_grants', { case_id: `eq.${CASE_ID}`, principal_id: `eq.${userId}` })
  await fetch(`${SUPABASE_URL}/rest/v1/case_access_grants`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      case_id: CASE_ID,
      principal_id: userId,
      source: 'manual_grant',
      read_case_content: true,
      read_case_deliberation: true,
      reason_code: 'coordinator_grant',
      granted_by: UID_CHEFE,
    }),
  })
}

async function clearCaseAccess(userId: string): Promise<void> {
  await dbDelete('case_access_grants', { case_id: `eq.${CASE_ID}`, principal_id: `eq.${userId}` })
}

async function getOwnerToken(
  request: APIRequestContext,
  email: string,
  password = PW,
  actAs?: string,
): Promise<string> {
  // ACT (ADR 0106) — delegates to the shared, hat-aware accessToken
  // (BUG-ACT-RAWGRANT-HATLESS-1). Found via a DYNAMIC path, not a fixed
  // persona: `computeEligibleVoters()` below queries CCIH's real roster,
  // which includes pqsdual.a@test.local (staff + pqs_member, 2 role types)
  // as a genuine CCIH `staff` member — she otherwise comes back with no
  // active_role claim when this loop reaches her.
  return accessToken(request, email, password, actAs)
}

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

interface AuditRow {
  id: string
  action: string
  actor_id: string | null
  entity_type: string
  entity_id: string
  commission_id: string | null
  metadata: Record<string, unknown>
}

async function auditRowsFor(action: string, entityId: string): Promise<AuditRow[]> {
  return dbQuery<AuditRow>('audit_log', { action: `eq.${action}`, entity_id: `eq.${entityId}` })
}

/**
 * The case's LIVE eligible-voter roster, computed independently of
 * `app.eligible_voters` (schema-private, PostgREST-unreachable): CCIH
 * commission members (memberships), active, not currently recused
 * (case_recusals with lifted_at is null), minus the respondent. This is the
 * ADR 0073 §D4 definition applied over base tables via direct REST reads —
 * used so the vote-casting step covers whoever is ACTUALLY eligible (not a
 * hardcoded guess), guaranteeing 100% turnout regardless of the exact quorum
 * threshold `issue_decision` enforces (HC0J8).
 */
async function computeEligibleVoters(): Promise<
  { userId: string; email: string; role: string }[]
> {
  const memberships = await dbQuery<{ principal_id: string; role: string }>('memberships', {
    commission_id: `eq.${COMMISSION_A}`,
  })
  // ACT (ADR 0106): carry each voter's OWN commission role through — it
  // doubles as the `actAs` hat the vote-casting loop below needs. A
  // blanket 'staff' (or 'staff_admin') would be wrong for whichever half
  // of this roster doesn't hold that exact role; this membership row IS
  // the source of truth for which one each voter actually holds.
  const roleByPrincipal = new Map(
    memberships
      .filter((m) => m.role === 'staff' || m.role === 'staff_admin')
      .map((m) => [m.principal_id, m.role] as const),
  )
  const memberIds = [...roleByPrincipal.keys()]
  const profiles = await dbQuery<{
    id: string
    email: string
    is_active: boolean
    suspended_until: string | null
  }>('profiles', { id: `in.(${memberIds.join(',')})` })
  const liveRecusals = await dbQuery<{ user_id: string }>('case_recusals', {
    case_id: `eq.${CASE_ID}`,
    lifted_at: 'is.null',
  })
  const excluded = new Set([...liveRecusals.map((r) => r.user_id), UID_STAFF4_RESPONDENT])
  const now = Date.now()
  return profiles
    .filter((p) => p.is_active && !excluded.has(p.id))
    .filter((p) => !p.suspended_until || new Date(p.suspended_until).getTime() < now)
    .map((p) => ({ userId: p.id, email: p.email, role: roleByPrincipal.get(p.id)! }))
}

/** Parse "X de Y membro(s) apto(s) votaram" → [X, Y]. */
function parseVoteTally(text: string): [number, number] {
  const m = /(\d+)\s+de\s+(\d+)\s+membro/.exec(text)
  if (!m) throw new Error(`vote tally text did not match: "${text}"`)
  return [Number(m[1]), Number(m[2])]
}

// ===========================================================================
// GATE — tab visibility, coordinator-only, and the CAVEAT-A hydration proof
// ===========================================================================

test('GATE-A non-coordinator: staff2 (plain staff of CCIH) gets notFound() on the manage/cases route', async ({
  page,
}) => {
  await signInAs(page, 'staff2.ccih@test.local')
  await assertRouteDenied(page, CASE_URL)
  await signOut(page)
})

test('GATE-B non-ethics case: no "Processo ético" tab; a direct hit on its /etica route is notFound()', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`${MANAGE_BASE}/${CASE_ID_NON_ETHICS}`)
  await page.waitForURL(`${MANAGE_BASE}/${CASE_ID_NON_ETHICS}`)
  const tabs = page.getByRole('navigation', { name: 'Seções do caso' })
  await expect(tabs).toBeVisible({ timeout: 10_000 })
  await expect(tabs.getByRole('link', { name: 'Processo ético' })).toHaveCount(0)

  // Defense in depth: a direct hit on the ethics URL for a non-ethics case
  // resolves getEthicsCaseProcedure(...) === null → notFound() (etica/page.tsx).
  await assertRouteDenied(page, `${MANAGE_BASE}/${CASE_ID_NON_ETHICS}/etica`)
  await signOut(page)
})

test('GATE-C ethics case Detalhes tab: renders + HYDRATES (CAVEAT A #1) + tab bar shows "Processo ético"', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(CASE_URL)
  await page.waitForURL(CASE_URL)
  await expect(page.getByText(CASE_LABEL)).toBeVisible({ timeout: 10_000 })

  const tabs = page.getByRole('navigation', { name: 'Seções do caso' })
  await expect(tabs.getByRole('link', { name: 'Processo ético' })).toBeVisible()

  // CAVEAT-A hydration proof #1 (the plain "Detalhes" tab — frontend's own
  // report named this exact tab as stuck in its mcp-browser preview): a Radix
  // Dialog opening on click requires a live React tree with an attached click
  // handler + useState — server-rendered HTML alone cannot do this. If the
  // page were stuck in the $RC streaming-Suspense buffer, this click would be
  // inert and the dialog would never appear.
  await page.getByRole('button', { name: 'Editar', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Editar caso' })).toBeVisible({ timeout: 5_000 })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Editar caso' })).toHaveCount(0)
  await signOut(page)
})

// ---------------------------------------------------------------------------
// GATE-C2 — `showEthics && isCoordinator` (layout.tsx): a non-coordinator who
// newly reaches THIS host under ADR 0134 D3 must NOT see "Processo ético".
// Named by the lead as a gap `frontend` could not exercise for want of a
// fixture: a non-coordinator inside a READABLE ethics-typed case. Built here —
// a per-case WRITE grant for staff3 (a plain CCIH member with no other
// standing) satisfies D3 arm 3 (`canWriteContent`) so she reaches the manage
// host at all, and `isCoordinator` (`access.role === "staff_admin"`) is a
// role check independent of that arm, so entering does not imply the tab.
// GATE-C above is the paired positive control — same case, same host, same
// tab bar region — so this is not a bare absence: someone genuinely sees the
// tab here, and staff3 specifically does not.
// ---------------------------------------------------------------------------

test('GATE-C2 non-coordinator write-grantee (staff3) reaches the manage host (D3 arm 3) but does NOT see "Processo ético" (isCoordinator is a role check, not an entry check)', async ({
  page,
}) => {
  await dbDelete('case_access_grants', { case_id: `eq.${CASE_ID}`, principal_id: `eq.${UID_STAFF3}` })
  const grantRes = await fetch(`${SUPABASE_URL}/rest/v1/case_access_grants`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      case_id: CASE_ID,
      principal_id: UID_STAFF3,
      source: 'manual_grant',
      read_case_content: true,
      read_case_deliberation: true,
      write_case_content: true,
      reason_code: 'coordinator_grant',
      granted_by: UID_CHEFE,
    }),
  })
  expect(grantRes.ok, `write grant setup for staff3 on ${CASE_ID}: ${await grantRes.text()}`).toBeTruthy()

  try {
    await signInAs(page, 'staff3.ccih@test.local')
    // Positive control for THIS grant: staff3 genuinely reaches the manage
    // host at all (D3 arm 3 admitted her) — without this, an absent tab could
    // just mean the whole page 404'd, which would prove nothing about
    // `isCoordinator` specifically.
    await page.goto(CASE_URL)
    await page.waitForURL(CASE_URL)
    await expect(page.getByText(CASE_LABEL)).toBeVisible({ timeout: 10_000 })

    const tabs = page.getByRole('navigation', { name: 'Seções do caso' })
    await expect(tabs.getByRole('link', { name: 'Processo ético' })).toHaveCount(0)
    // Direct-nav to the etica subroute must ALSO deny her — the tab's absence
    // must not be a UI-only omission (`etica/page.tsx` keeps its own
    // `staff_admin` gate per the layout's own doc comment).
    await page.goto(`${CASE_URL}/etica`)
    await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })

    await signOut(page)
  } finally {
    await dbDelete('case_access_grants', { case_id: `eq.${CASE_ID}`, principal_id: `eq.${UID_STAFF3}` })
  }
})

test('GATE-D "Processo ético" tab: renders + HYDRATES (CAVEAT A #2) + "Nova decisão" disabled while admissibility is pending', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)

  // All 7 procedure sections + the coordinator-controls panel render (proves
  // getEthicsCaseProcedure resolved a non-null envelope and every panel got data).
  for (const title of [
    'Controles da coordenação',
    'Impedimentos do processo',
    'Admissibilidade e recebimento',
    'Alegações e conclusões',
    'Decisões e votação',
    'Audiências',
    'Notificações e prazos',
    'Recursos',
  ]) {
    await expect(page.getByRole('region', { name: title })).toBeVisible({ timeout: 10_000 })
  }

  // CAVEAT-A hydration proof #2, on THIS specific route (the one under test):
  // a real click opens a real dialog.
  await page.getByRole('button', { name: 'Declarar conflito' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Declarar conflito de interesse' }),
  ).toBeVisible({ timeout: 5_000 })
  await page.keyboard.press('Escape')

  // Gating requirement: "Nova decisão" stays disabled until admissibility is
  // decided (seed leaves admissibility_status = 'pending').
  await expect(page.getByRole('region', { name: 'Decisões e votação' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nova decisão' })).toBeDisabled()

  await signOut(page)
})

// ===========================================================================
// CTRL — coordinator controls (Part 1)
// ===========================================================================

test('CTRL-1 declare conflict (self-service): chefe declares a conflict on their own case', async ({
  page,
}) => {
  const before = await dbQuery('case_conflict_declarations', { case_id: `eq.${CASE_ID}` })

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)

  await page.getByRole('button', { name: 'Declarar conflito' }).click()
  const dialog = page.getByRole('dialog', { name: 'Declarar conflito de interesse' })
  await expect(dialog).toBeVisible()
  await dialog
    .getByLabel('Descrição')
    .fill('[E2E] autodeclaração de conflito de relação profissional com o denunciado.')
  await dialog.getByRole('button', { name: 'Registrar conflito' }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })

  const after = await dbQuery<{
    declarant_id: string
    conflict_type: string
    description_md: string
    status: string
  }>('case_conflict_declarations', { case_id: `eq.${CASE_ID}` })
  expect(after.length).toBe(before.length + 1)
  const row = after[after.length - 1]
  expect(row.declarant_id).toBe(UID_CHEFE)
  expect(row.conflict_type).toBe('professional_relationship') // the picker's default first option
  expect(row.status).toBe('declared')
  expect(row.description_md).toContain('autodeclaração de conflito')

  await signOut(page)
})

test('CTRL-2 record + lift recusal: the roster shows the NEW recusal alongside the SEEDED one; the target loses/regains case read', async ({
  page,
}) => {
  // CASE_ID is explicit_grants_only: a plain member reads nothing without a
  // grant, independent of recusal state (E1 AC-2a). Grant staff2 first so the
  // "loses/regains read" cross-check below isolates the RECUSAL effect from
  // the (unrelated) grant boundary — mirrors ethics-e1-access-spine.spec.ts's
  // AC-3b dynamic-persona pattern. Cleared at the end to restore staff2 as a
  // clean no-grant boundary persona for other specs / re-runs.
  await upsertCaseAccess(UID_STAFF2)
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`${BASE}/casos/${CASE_ID}`)
  await page.waitForURL(`${BASE}/casos/${CASE_ID}`)
  await expect(page.getByText(CASE_LABEL)).toBeVisible({ timeout: 10_000 }) // sanity: readable pre-recusal
  await signOut(page)

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)

  await page.getByRole('button', { name: 'Registrar impedimento' }).click()
  const recusalDialog = page.getByRole('dialog', { name: 'Registrar impedimento' })
  await expect(recusalDialog).toBeVisible()
  await recusalDialog.getByLabel('Membro').selectOption({ label: 'Enfermeira CCIH Dois' }) // staff2.ccih
  await recusalDialog
    .getByLabel('Motivo')
    .fill('[E2E] conflito de interesse identificado no exame do processo.')
  await recusalDialog.getByRole('button', { name: 'Registrar impedimento' }).click()
  await expect(recusalDialog).toHaveCount(0, { timeout: 10_000 })

  // The roster now lists BOTH the new (staff2, "Pela coordenação") AND the
  // seeded (staff1, live since the seed) recusal — proving listCaseRecusals
  // loads OTHER members' recusals, not just ones this session created.
  const roster = page.getByRole('region', { name: 'Impedimentos do processo' })
  const staff2Row = roster.locator('li').filter({ hasText: 'Enfermeira CCIH Dois' })
  await expect(staff2Row).toBeVisible()
  await expect(staff2Row.getByText('Ativo', { exact: true })).toBeVisible()
  await expect(staff2Row.getByText('Pela coordenação', { exact: true })).toBeVisible()
  const staff1Row = roster.locator('li').filter({ hasText: 'Enfermeiro CCIH Um' })
  await expect(staff1Row).toBeVisible()
  await expect(staff1Row.getByText('Ativo', { exact: true })).toBeVisible()

  await signOut(page)

  // Cross-check the DB effect: staff2 immediately loses ordinary case read
  // (the E1 can_read_case deny-term), mirroring ethics-e1-access-spine.spec.ts's
  // established pattern on the STAFF-facing route.
  await signInAs(page, 'staff2.ccih@test.local')
  await assertRouteDenied(page, `${BASE}/casos/${CASE_ID}`)
  await signOut(page)

  // Lift it back.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)
  const roster2 = page.getByRole('region', { name: 'Impedimentos do processo' })
  const staff2Row2 = roster2.locator('li').filter({ hasText: 'Enfermeira CCIH Dois' })
  await staff2Row2.getByRole('button', { name: 'Reverter' }).click()
  const liftDialog = page.getByRole('dialog', { name: 'Reverter impedimento' })
  await expect(liftDialog).toBeVisible()
  await liftDialog.getByLabel('Motivo da reversão').fill('[E2E] conflito resolvido.')
  await liftDialog.getByRole('button', { name: 'Reverter impedimento' }).click()
  await expect(liftDialog).toHaveCount(0, { timeout: 10_000 })
  await expect(staff2Row2.getByText('Revertido', { exact: true })).toBeVisible({ timeout: 10_000 })
  await signOut(page)

  // staff2 regains ordinary case read.
  await signInAs(page, 'staff2.ccih@test.local')
  await page.goto(`${BASE}/casos/${CASE_ID}`)
  await page.waitForURL(`${BASE}/casos/${CASE_ID}`)
  await expect(page.getByText(CASE_LABEL)).toBeVisible({ timeout: 10_000 })
  await signOut(page)

  // Cleanup: restore staff2 as the clean no-grant boundary persona (GATE-A
  // reused it as a plain non-coordinator; keep it grant-free for other specs).
  await clearCaseAccess(UID_STAFF2)
})

test('CTRL-3 set confidentiality: change away from ethics_investigation, then round-trip back', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)

  const panel = page.getByRole('region', { name: 'Controles da coordenação' })
  await expect(panel.getByText('Investigação ética')).toBeVisible()

  await panel.getByRole('button', { name: 'Alterar sigilo' }).click()
  let dialog = page.getByRole('dialog', { name: 'Alterar confidencialidade' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Nível de confidencialidade').selectOption({ label: 'Sigilo de revisão por pares' })
  await dialog.getByRole('button', { name: 'Aplicar sigilo' }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })
  await expect(panel.getByText('Sigilo de revisão por pares')).toBeVisible({ timeout: 10_000 })

  // Round-trip back to the seeded value (E1's document-confidentiality tests
  // are independent of this field, but restoring is good hygiene).
  await panel.getByRole('button', { name: 'Alterar sigilo' }).click()
  dialog = page.getByRole('dialog', { name: 'Alterar confidencialidade' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Nível de confidencialidade').selectOption({ label: 'Investigação ética' })
  await dialog.getByRole('button', { name: 'Aplicar sigilo' }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })
  await expect(panel.getByText('Investigação ética')).toBeVisible({ timeout: 10_000 })

  await signOut(page)

  const rows = await dbQuery<{ confidentiality_level: string }>('cases', { id: `eq.${CASE_ID}` })
  expect(rows[0]?.confidentiality_level).toBe('ethics_investigation')
})

test('CTRL-4 set visibility: change away from explicit_grants_only, then round-trip back (willRestrict banner both ways)', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)

  const panel = page.getByRole('region', { name: 'Controles da coordenação' })
  await expect(panel.getByText('Somente por concessão explícita')).toBeVisible()

  await panel.getByRole('button', { name: 'Alterar acesso' }).click()
  let dialog = page.getByRole('dialog', { name: 'Alterar modelo de acesso' })
  await expect(dialog).toBeVisible()
  // Going TO commission_default: no "will restrict" warning.
  await expect(dialog.getByText(/deixarão de ver este processo/i)).toHaveCount(0)
  await dialog
    .getByLabel('Modelo de acesso')
    .selectOption({ label: 'Padrão da comissão (todos os membros)' })
  await dialog.getByRole('button', { name: 'Aplicar acesso' }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })
  await expect(panel.getByText('Padrão da comissão (todos os membros)')).toBeVisible({
    timeout: 10_000,
  })

  // Round-trip back — going TO explicit_grants_only DOES warn.
  await panel.getByRole('button', { name: 'Alterar acesso' }).click()
  dialog = page.getByRole('dialog', { name: 'Alterar modelo de acesso' })
  await expect(dialog).toBeVisible()
  await dialog
    .getByLabel('Modelo de acesso')
    .selectOption({ label: 'Somente por concessão explícita' })
  await expect(dialog.getByText(/deixarão de ver este processo/i)).toBeVisible()
  await dialog.getByRole('button', { name: 'Aplicar acesso' }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })
  await expect(panel.getByText('Somente por concessão explícita')).toBeVisible({ timeout: 10_000 })

  await signOut(page)

  const rows = await dbQuery<{ visibility_policy: string }>('cases', { id: `eq.${CASE_ID}` })
  expect(rows[0]?.visibility_policy).toBe('explicit_grants_only')
})

// ===========================================================================
// FLOW — the full procedure lifecycle, REAL writes (PRIORITY 1)
// ===========================================================================

test('FLOW-1 decide admissibility: admissible → "Nova decisão" becomes enabled', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)

  const admissibility = page.getByRole('region', { name: 'Admissibilidade e recebimento' })
  await expect(admissibility.getByText('Pendente', { exact: true })).toBeVisible()

  await admissibility.getByRole('button', { name: 'Decidir admissibilidade' }).click()
  const dialog = page.getByRole('dialog', { name: 'Decidir admissibilidade' })
  await expect(dialog).toBeVisible()
  // The picker already defaults to "Admitida" when the current status is Pendente.
  await expect(dialog.getByLabel('Decisão')).toHaveValue('admissible')
  await dialog
    .getByLabel('Fundamentação')
    .fill('[E2E] há indícios suficientes para instrução do processo.')
  await dialog.getByRole('button', { name: 'Registrar decisão' }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })

  await expect(admissibility.getByText('Admitida', { exact: true })).toBeVisible({ timeout: 10_000 })

  const rows = await dbQuery<{ admissibility_status: string; admissibility_rationale_md: string }>(
    'ethics_case_details',
    { case_id: `eq.${CASE_ID}` },
  )
  expect(rows[0]?.admissibility_status).toBe('admissible')
  expect(rows[0]?.admissibility_rationale_md).toContain('indícios suficientes')

  // Gating requirement: now enabled.
  await expect(page.getByRole('button', { name: 'Nova decisão' })).toBeEnabled()

  await signOut(page)
})

test('FLOW-2 add two allegations (distinct categories)', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)

  const allegations = page.getByRole('region', { name: 'Alegações e conclusões' })

  async function addAllegation(category: string, description: string, severity?: string) {
    await allegations.getByRole('button', { name: 'Adicionar alegação' }).click()
    const dialog = page.getByRole('dialog', { name: 'Adicionar alegação' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Categoria').selectOption({ label: category })
    await dialog.getByLabel('Descrição').fill(description)
    if (severity) {
      await dialog.getByLabel('Gravidade (opcional)').selectOption({ label: severity })
    }
    await dialog.getByRole('button', { name: 'Adicionar alegação', exact: true }).click()
    await expect(dialog).toHaveCount(0, { timeout: 10_000 })
  }

  await addAllegation(
    'Conduta profissional inadequada',
    '[E2E] alegação de conduta inadequada durante o plantão.',
    'Alta',
  )
  await addAllegation(
    'Quebra de confidencialidade',
    '[E2E] alegação de quebra de sigilo em prontuário.',
  )

  const item1 = allegations.locator('li').filter({ hasText: 'conduta inadequada durante o plantão' })
  await expect(item1).toBeVisible({ timeout: 10_000 })
  await expect(item1.getByText('Conduta profissional inadequada')).toBeVisible()
  await expect(item1.getByText('Alta', { exact: true })).toBeVisible()
  await expect(item1.getByText('Em análise', { exact: true })).toBeVisible()

  const item2 = allegations.locator('li').filter({ hasText: 'quebra de sigilo em prontuário' })
  await expect(item2).toBeVisible()
  await expect(item2.getByText('Quebra de confidencialidade')).toBeVisible()

  const rows = await dbQuery('ethics_allegations', { case_id: `eq.${CASE_ID}` })
  expect(rows.length).toBe(2)

  await signOut(page)
})

test('FLOW-3 record a finding; a SECOND finding on the same allegation is refused (HC0J3)', async ({
  page,
  request,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)

  const allegations = page.getByRole('region', { name: 'Alegações e conclusões' })
  const item1 = allegations.locator('li').filter({ hasText: 'conduta inadequada durante o plantão' })
  await item1.getByRole('button', { name: 'Registrar conclusão' }).click()
  const dialog = page.getByRole('dialog', { name: 'Registrar conclusão da alegação' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Conclusão').selectOption({ label: 'Comprovada' })
  await dialog
    .getByLabel('Fundamentação (opcional)')
    .fill('[E2E] evidências testemunhais corroboram a alegação.')
  await dialog.getByRole('button', { name: 'Registrar conclusão', exact: true }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })

  await expect(item1.getByText('Conclusão')).toBeVisible({ timeout: 10_000 })
  await expect(item1.getByText('Comprovada', { exact: true })).toBeVisible()
  // The dialog trigger is gone now that a finding exists (the UI itself
  // cannot double-submit) — the negative path needs a direct RPC call.
  await expect(item1.getByRole('button', { name: 'Registrar conclusão' })).toHaveCount(0)

  await signOut(page)

  const allegRows = await dbQuery<{ id: string; description_md: string }>('ethics_allegations', {
    case_id: `eq.${CASE_ID}`,
  })
  const allegationId = allegRows.find((r) => r.description_md.includes('conduta inadequada durante o plantão'))
    ?.id
  expect(allegationId).toBeTruthy()

  const chefeToken = await getOwnerToken(request, 'chefe.ccih@test.local')
  const dupResp = await callRpc(request, 'record_ethics_finding', chefeToken, {
    p_allegation_id: allegationId,
    p_finding: 'substantiated',
  })
  expect(dupResp.ok()).toBeFalsy()
  expect(JSON.stringify(await dupResp.json())).toMatch(/HC0J3/)

  const findingRows = await dbQuery('ethics_findings', { allegation_id: `eq.${allegationId}` })
  expect(findingRows.length).toBe(1) // the duplicate did NOT land
})

test('FLOW-4 issue a notification with a due date; issue + cancel a second, throwaway notification', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)

  const notifications = page.getByRole('region', { name: 'Notificações e prazos' })
  const dueAt = inDays(15)

  await notifications.getByRole('button', { name: 'Emitir notificação' }).click()
  let dialog = page.getByRole('dialog', { name: 'Emitir notificação' })
  await expect(dialog).toBeVisible()
  // Type + Via default to "Notificação ao denunciado" / "Ofício / carta".
  await dialog.getByLabel('Prazo (opcional)').fill(dueAt)
  await dialog.getByLabel('Observações (opcional)').fill('[E2E] prazo de defesa do denunciado.')
  await dialog.getByRole('button', { name: 'Emitir notificação', exact: true }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })

  const mainRow = notifications.locator('li').filter({ hasText: 'prazo de defesa do denunciado' })
  await expect(mainRow).toBeVisible({ timeout: 10_000 })
  await expect(mainRow.getByText('Notificação ao denunciado')).toBeVisible()
  // issue_ethics_notification marks it 'sent' immediately (not the bare
  // table-default 'pending') — "Enviada", not "Pendente".
  await expect(mainRow.getByText('Enviada', { exact: true })).toBeVisible()
  await expect(mainRow.getByText('Prazo:')).toBeVisible()

  const rows = await dbQuery<{ due_at: string; notification_type: string }>('ethics_notifications', {
    case_id: `eq.${CASE_ID}`,
  })
  const mainDb = rows.find((r) => r.notification_type === 'respondent_notification')
  expect(mainDb).toBeTruthy()
  expect(new Date(mainDb!.due_at).toDateString()).toBe(new Date(dueAt).toDateString())

  // A second, throwaway notification to exercise cancel.
  await notifications.getByRole('button', { name: 'Emitir notificação' }).click()
  dialog = page.getByRole('dialog', { name: 'Emitir notificação' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Tipo').selectOption({ label: 'Notificação de audiência' })
  await dialog.getByLabel('Observações (opcional)').fill('[E2E] descartável, cancelamento de teste.')
  await dialog.getByRole('button', { name: 'Emitir notificação', exact: true }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })

  const throwawayRow = notifications.locator('li').filter({ hasText: 'descartável, cancelamento de teste' })
  await expect(throwawayRow).toBeVisible({ timeout: 10_000 })
  await throwawayRow.getByRole('button', { name: 'Cancelar' }).click()
  await expect(throwawayRow.getByText('Cancelada', { exact: true })).toBeVisible({ timeout: 10_000 })

  await signOut(page)
})

test('FLOW-5 create a case decision (draft)', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)

  const decisions = page.getByRole('region', { name: 'Decisões e votação' })
  await expect(decisions.getByRole('button', { name: 'Nova decisão' })).toBeEnabled()
  await decisions.getByRole('button', { name: 'Nova decisão' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nova decisão' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Tipo de decisão').fill('[E2E] Decisão de mérito')
  await dialog.getByLabel('Resumo').fill('[E2E] resumo da decisão de mérito do processo.')
  await dialog.getByRole('button', { name: 'Criar decisão' }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })

  const card = decisions.locator('li').filter({ hasText: '[E2E] Decisão de mérito' })
  await expect(card).toBeVisible({ timeout: 10_000 })
  await expect(card.getByText('Rascunho', { exact: true })).toBeVisible()

  const rows = await dbQuery('case_decisions', { case_id: `eq.${CASE_ID}` })
  expect(rows.length).toBe(1)

  await signOut(page)
})

test('FLOW-6 set decision details: sanction + remediation + external reporting (CFM) + appeal deadline', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)

  const decisions = page.getByRole('region', { name: 'Decisões e votação' })
  const card = decisions.locator('li').filter({ hasText: '[E2E] Decisão de mérito' })
  await card.getByRole('button', { name: 'Definir detalhes' }).click()
  const dialog = page.getByRole('dialog', { name: 'Definir detalhes da decisão' })
  await expect(dialog).toBeVisible()

  await dialog.getByLabel('Sanção', { exact: true }).selectOption({ label: 'Censura confidencial' })
  await dialog.getByLabel('Exigir remediação').click()
  await dialog
    .getByLabel('Descrição da remediação')
    .fill('[E2E] concluir treinamento de conduta profissional.')
  await dialog.getByLabel('Comunicar a órgão externo').click()
  await dialog.getByLabel('Destino').selectOption({ label: 'CFM' })
  const extDeadline = inDays(60)
  await dialog.getByLabel('Prazo', { exact: true }).fill(extDeadline)
  const appealDeadline = inDays(30)
  await dialog.getByLabel('Prazo de recurso').fill(appealDeadline)

  await dialog.getByRole('button', { name: 'Salvar detalhes' }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })

  await expect(card.getByText('Censura confidencial')).toBeVisible({ timeout: 10_000 })
  await expect(card.getByText('Exigida', { exact: true })).toBeVisible()
  await expect(card.getByText('CFM', { exact: true })).toBeVisible()
  await expect(
    card.getByText('concluir treinamento de conduta profissional'),
  ).toBeVisible()

  const rows = await dbQuery<{
    sanction_type_id: string
    remediation_required: boolean
    external_reporting_required: boolean
    external_reporting_target: string
    appeal_allowed: boolean
    appeal_deadline: string
  }>('ethics_decision_details', {})
  const detail = rows.find((r) => r.appeal_deadline !== null)
  expect(detail).toBeTruthy()
  expect(detail!.remediation_required).toBe(true)
  expect(detail!.external_reporting_required).toBe(true)
  expect(detail!.external_reporting_target).toBe('cfm')
  expect(detail!.appeal_allowed).toBe(true)
  expect(new Date(detail!.appeal_deadline).toDateString()).toBe(new Date(appealDeadline).toDateString())

  await signOut(page)
})

test('FLOW-7 cast votes: chefe votes via KEYBOARD-ONLY (the required keyboard flow); the rest cast via RPC; recused/respondent/duplicate all refused', async ({
  page,
  request,
}) => {
  const eligible = await computeEligibleVoters()
  expect(eligible.length).toBeGreaterThan(0)
  expect(eligible.some((v) => v.userId === UID_CHEFE)).toBe(true)
  expect(eligible.some((v) => v.userId === UID_STAFF1_RECUSED)).toBe(false)
  expect(eligible.some((v) => v.userId === UID_STAFF4_RESPONDENT)).toBe(false)

  // --- chefe's own vote, KEYBOARD-ONLY, visible focus throughout ---
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)
  await expect(page.getByRole('button', { name: 'Votar' })).toBeVisible({ timeout: 10_000 })

  const reachedVoteBtn = await tabUntil(
    page,
    (i) => i.tag === 'BUTTON' && /^votar$/i.test(i.text),
    200,
  )
  expect(reachedVoteBtn).toBe(true)
  // Visible focus: the platform's global focus-visible ring class is applied.
  const focusVisible = await page.evaluate(() =>
    document.activeElement instanceof HTMLElement
      ? document.activeElement.matches(':focus-visible')
      : false,
  )
  expect(focusVisible).toBe(true)
  await page.keyboard.press('Enter')

  const voteDialog = page.getByRole('dialog', { name: 'Registrar voto' })
  await expect(voteDialog).toBeVisible({ timeout: 5_000 })

  const reachedSelect = await tabUntil(page, (i) => i.id === 'ethics-vote-value', 20)
  expect(reachedSelect).toBe(true)
  // Keyboard-operate the native <select>: approve (default) → reject → abstain.
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  const selectValue = await page.evaluate(
    () => (document.activeElement as HTMLSelectElement).value,
  )
  expect(selectValue).toBe('abstain')

  const reachedSubmit = await tabUntil(
    page,
    (i) => i.tag === 'BUTTON' && /^registrar voto$/i.test(i.text),
    20,
  )
  expect(reachedSubmit).toBe(true)
  await page.keyboard.press('Enter')
  await expect(voteDialog).toHaveCount(0, { timeout: 10_000 })

  const decisions = page.getByRole('region', { name: 'Decisões e votação' })
  const card = decisions.locator('li').filter({ hasText: '[E2E] Decisão de mérito' })
  await expect(card.getByText('Seu voto:')).toBeVisible({ timeout: 10_000 })
  await expect(card.getByText('Abstenção', { exact: true })).toBeVisible()

  const decisionRows = await dbQuery<{ id: string }>('case_decisions', { case_id: `eq.${CASE_ID}` })
  const decisionId = decisionRows[0]?.id
  expect(decisionId).toBeTruthy()

  await signOut(page)

  // --- the rest of the eligible roster votes via direct RPC (a real login is
  //     impractical for N members; the RPC IS the canonical server path here) ---
  const others = eligible.filter((v) => v.userId !== UID_CHEFE)
  let rpcApprovals = 0
  for (const voter of others) {
    const token = await getOwnerToken(request, voter.email, undefined, voter.role)
    const resp = await callRpc(request, 'cast_case_vote', token, {
      p_decision_id: decisionId,
      p_vote: 'approve',
    })
    if (resp.ok()) rpcApprovals += 1
  }
  expect(rpcApprovals).toBe(others.length)

  // --- negative paths: canonical server rejection, not UI absence ---
  const staff1Token = await getOwnerToken(request, 'staff1.ccih@test.local')
  const staff1Resp = await callRpc(request, 'cast_case_vote', staff1Token, {
    p_decision_id: decisionId,
    p_vote: 'approve',
  })
  expect(staff1Resp.ok()).toBeFalsy()
  expect(JSON.stringify(await staff1Resp.json())).toMatch(/HC0J5/)

  const staff4Token = await getOwnerToken(request, 'staff4.ccih@test.local')
  const staff4Resp = await callRpc(request, 'cast_case_vote', staff4Token, {
    p_decision_id: decisionId,
    p_vote: 'approve',
  })
  expect(staff4Resp.ok()).toBeFalsy()
  expect(JSON.stringify(await staff4Resp.json())).toMatch(/HC0J5/)

  const chefeToken = await getOwnerToken(request, 'chefe.ccih@test.local')
  const dupResp = await callRpc(request, 'cast_case_vote', chefeToken, {
    p_decision_id: decisionId,
    p_vote: 'approve',
  })
  expect(dupResp.ok()).toBeFalsy()
  expect(JSON.stringify(await dupResp.json())).toMatch(/HC0J4/)

  // --- full turnout: cast === eligible ---
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)
  const card2 = page
    .getByRole('region', { name: 'Decisões e votação' })
    .locator('li')
    .filter({ hasText: '[E2E] Decisão de mérito' })
  const tallyText = (await card2.locator('text=/de\\s+\\d+\\s+membro/').first().textContent()) ?? ''
  const [cast, eligibleCount] = parseVoteTally(tallyText)
  expect(cast).toBe(eligible.length)
  expect(eligibleCount).toBe(eligible.length)

  const voteRows = await dbQuery('case_votes', { decision_id: `eq.${decisionId}` })
  expect(voteRows.length).toBe(eligible.length)

  await signOut(page)
})

test('FLOW-8 issue the decision (quorum met): status → Emitida; the M2 retention pin fires; redaction is barred while pinned', async ({
  page,
  request,
}) => {
  const decisionRows = await dbQuery<{ id: string }>('case_decisions', { case_id: `eq.${CASE_ID}` })
  const decisionId = decisionRows[0]?.id
  expect(decisionId).toBeTruthy()

  const beforePin = await dbQuery<{ retention_pinned_at: string | null }>('professional_profiles', {
    id: `eq.${PROFESSIONAL_PROFILE_RESPONDENT}`,
  })
  expect(beforePin[0]?.retention_pinned_at).toBeNull()
  // audit_write's entity anchor for this verb is the CASE (entity_type='case'),
  // not the decision — the decision id rides in metadata.decision_id instead.
  const auditBefore = await auditRowsFor('case.decision_issued', CASE_ID)

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)

  const decisions = page.getByRole('region', { name: 'Decisões e votação' })
  const card = decisions.locator('li').filter({ hasText: '[E2E] Decisão de mérito' })
  await card.getByRole('button', { name: 'Emitir decisão' }).click()
  const confirm = page.getByRole('alertdialog', { name: 'Emitir a decisão?' })
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Emitir decisão' }).click()
  await expect(confirm).toHaveCount(0, { timeout: 10_000 })

  await expect(card.getByText('Emitida', { exact: true })).toBeVisible({ timeout: 10_000 })

  const decisionAfter = await dbQuery<{ status: string; decided_at: string | null }>('case_decisions', {
    id: `eq.${decisionId}`,
  })
  expect(decisionAfter[0]?.status).toBe('issued')
  expect(decisionAfter[0]?.decided_at).toBeTruthy()

  // The M2 retention-pin trigger fired on the respondent's professional profile.
  const afterPin = await dbQuery<{ retention_pinned_at: string | null }>('professional_profiles', {
    id: `eq.${PROFESSIONAL_PROFILE_RESPONDENT}`,
  })
  expect(afterPin[0]?.retention_pinned_at).toBeTruthy()

  // PHI-free audit row for the issuance.
  const auditAfter = await auditRowsFor('case.decision_issued', CASE_ID)
  expect(auditAfter.length).toBe(auditBefore.length + 1)
  const newAuditRow = auditAfter.find(
    (r) => (r.metadata as { decision_id?: string }).decision_id === decisionId,
  )
  expect(newAuditRow).toBeTruthy()
  expect(JSON.stringify(newAuditRow!.metadata)).not.toMatch(/Denunciada|CRM-9001/)

  await signOut(page)

  // Bonus keystone: redact_professional_profile is now barred (HC0J7) — the
  // disciplinary record's 20-yr defensibility overrides erasure while pinned.
  const chefeToken = await getOwnerToken(request, 'chefe.ccih@test.local')
  const redactResp = await callRpc(request, 'redact_professional_profile', chefeToken, {
    p_profile_id: PROFESSIONAL_PROFILE_RESPONDENT,
    p_reason: '[E2E] tentativa de eliminação indevida.',
  })
  expect(redactResp.ok()).toBeFalsy()
  expect(JSON.stringify(await redactResp.json())).toMatch(/HC0J7/)
  const profileAfterRedactAttempt = await dbQuery<{ full_name: string }>('professional_profiles', {
    id: `eq.${PROFESSIONAL_PROFILE_RESPONDENT}`,
  })
  expect(profileAfterRedactAttempt[0]?.full_name).toBe('Dra. Denunciada') // unchanged
})

test('FLOW-9 schedule a hearing: rides a participants_only meeting', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)

  const hearings = page.getByRole('region', { name: 'Audiências' })
  await hearings.getByRole('button', { name: 'Agendar audiência' }).click()
  const dialog = page.getByRole('dialog', { name: 'Agendar audiência' })
  await expect(dialog).toBeVisible()
  // Type defaults to "Audiência inicial".
  await dialog.getByLabel('Data e hora (opcional)').fill(inDays(10))
  await dialog.getByRole('button', { name: 'Agendar audiência', exact: true }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })

  const row = hearings.locator('li').filter({ hasText: 'Audiência inicial' })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(row.getByText('Agendada', { exact: true })).toBeVisible()

  const rows = await dbQuery<{ id: string; meeting_id: string }>('ethics_hearings', {
    case_id: `eq.${CASE_ID}`,
  })
  expect(rows.length).toBe(1)
  expect(rows[0].meeting_id).toBeTruthy()
  const meetingRows = await dbQuery<{ visibility_policy: string }>('meetings', {
    id: `eq.${rows[0].meeting_id}`,
  })
  expect(meetingRows[0]?.visibility_policy).toBe('participants_only')

  await signOut(page)
})

test('FLOW-10 complete the hearing: presence flags + summary/outcome recorded', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)

  const hearings = page.getByRole('region', { name: 'Audiências' })
  const row = hearings.locator('li').filter({ hasText: 'Audiência inicial' })
  await row.getByRole('button', { name: 'Registrar resultado' }).click()
  const dialog = page.getByRole('dialog', { name: 'Registrar resultado da audiência' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Denunciado').selectOption({ label: 'Presente' })
  await dialog.getByLabel('Denunciante').selectOption({ label: 'Ausente' })
  // "Repr. legal" left "Não informado" on purpose (exercises the null branch).
  await dialog.getByLabel('Resumo').fill('[E2E] audiência realizada conforme previsto.')
  await dialog.getByLabel('Resultado').fill('[E2E] denunciado apresentou defesa oral.')
  await dialog.getByRole('button', { name: 'Registrar resultado', exact: true }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })

  await expect(row.getByText('Concluída', { exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(row.getByText('audiência realizada conforme previsto')).toBeVisible()

  const rows = await dbQuery<{
    respondent_present: boolean
    complainant_present: boolean
    legal_representative_present: boolean | null
    completed_at: string
  }>('ethics_hearings', { case_id: `eq.${CASE_ID}` })
  expect(rows[0]?.respondent_present).toBe(true)
  expect(rows[0]?.complainant_present).toBe(false)
  expect(rows[0]?.legal_representative_present).toBeNull()
  expect(rows[0]?.completed_at).toBeTruthy()

  await signOut(page)
})

test('FLOW-11 submit an appeal against the issued decision: decision status → Em recurso', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)

  const decisions = page.getByRole('region', { name: 'Decisões e votação' })
  const card = decisions.locator('li').filter({ hasText: '[E2E] Decisão de mérito' })
  await expect(card.getByText('Emitida', { exact: true })).toBeVisible()
  await card.getByRole('button', { name: 'Interpor recurso' }).click()
  const dialog = page.getByRole('dialog', { name: 'Interpor recurso' })
  await expect(dialog).toBeVisible()
  await dialog
    .getByLabel('Razões do recurso')
    .fill('[E2E] a sanção aplicada é desproporcional aos fatos apurados.')
  await dialog.getByRole('button', { name: 'Interpor recurso', exact: true }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })

  await expect(card.getByText('Em recurso', { exact: true })).toBeVisible({ timeout: 10_000 })

  const appeals = page.getByRole('region', { name: 'Recursos' })
  const appealRow = appeals.locator('li').filter({ hasText: 'desproporcional aos fatos' })
  await expect(appealRow).toBeVisible()
  await expect(appealRow.getByText('Interposto', { exact: true })).toBeVisible()

  const rows = await dbQuery('ethics_appeals', { case_id: `eq.${CASE_ID}` })
  expect(rows.length).toBe(1)
  const decisionRows = await dbQuery<{ status: string }>('case_decisions', { case_id: `eq.${CASE_ID}` })
  expect(decisionRows[0]?.status).toBe('appealed')

  await signOut(page)
})

test('FLOW-12 review the appeal: accepted, with an outcome + rationale', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(ETICA_URL)
  await page.waitForURL(ETICA_URL)

  const appeals = page.getByRole('region', { name: 'Recursos' })
  const appealRow = appeals.locator('li').filter({ hasText: 'desproporcional aos fatos' })
  await appealRow.getByRole('button', { name: 'Analisar recurso' }).click()
  const dialog = page.getByRole('dialog', { name: 'Analisar recurso' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Situação').selectOption({ label: 'Provido' })
  await dialog.getByLabel('Resultado (opcional)').fill('[E2E] sanção reduzida')
  await dialog
    .getByLabel('Fundamentação (opcional)')
    .fill('[E2E] a comissão revisora acolheu parcialmente os argumentos do recurso.')
  await dialog.getByRole('button', { name: 'Registrar análise' }).click()
  await expect(dialog).toHaveCount(0, { timeout: 10_000 })

  await expect(appealRow.getByText('Provido', { exact: true })).toBeVisible({ timeout: 10_000 })
  await expect(appealRow.getByText('[E2E] sanção reduzida')).toBeVisible()

  const rows = await dbQuery<{ status: string; outcome: string; reviewed_by: string }>('ethics_appeals', {
    case_id: `eq.${CASE_ID}`,
  })
  expect(rows[0]?.status).toBe('accepted')
  expect(rows[0]?.outcome).toBe('[E2E] sanção reduzida')
  expect(rows[0]?.reviewed_by).toBe(UID_CHEFE)

  await signOut(page)
})

// ===========================================================================
// Safety net — restore the case fields CTRL-3/CTRL-4 exercise, regardless of
// which test failed (Playwright serial mode skips downstream tests after a
// failure, so a UI-driven "restore" step could be skipped; this hook runs
// unconditionally). ethics-e1-access-spine.spec.ts's AC-2a/b depend on
// visibility_policy staying 'explicit_grants_only' on this case.
// ===========================================================================

test.afterAll(async () => {
  await forceCaseFields({
    confidentiality_level: 'ethics_investigation',
    visibility_policy: 'explicit_grants_only',
  })
})
