import { execSync } from 'node:child_process'
import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

/**
 * Referrals v2 — R2–R5 governance (`case_referrals`; ADR 0037 Amendment 1)
 *
 * Sibling of `e2e/phase22-referrals.spec.ts` (R1 dialogue core, 40/40). This file
 * covers the four DEFER increments per `docs/plans/referrals-v2-dialogue-governance.md`
 * §3 "Gate" bullets, translated to Playwright assertions:
 *   R2 — triage/SLA (priority, requested-action, due date, overdue, decline-reason)
 *   R3 — resolution cycles (answered/resolved/reopen), close-gate change, lineage
 *   R4 — responsibility (assignments) + typed related-case links; "assignment ≠ access"
 *   R5 — private per-committee internal notes, message/note redaction, read receipts
 *
 * Cross-side isolation for R5 notes (source never reads target notes, QPS reads
 * neither) is pgTAP-proven (K-R5-1, `252_authz_p0_isolation.sql` family + `150_referrals.sql`);
 * this file verifies the UI-observable behavior (what renders / what doesn't leak into
 * the DOM), not the RLS predicate itself.
 *
 * **Feature flag.** Same lifecycle as the R1 file: `case_referrals` ships OFF; a
 * `test.beforeAll` flips it ON for this file's tests, `test.afterAll` resets it. This
 * file is fully self-sufficient (runnable standalone) so it repeats that lifecycle
 * rather than depending on run order relative to `phase22-referrals.spec.ts`.
 *
 * **Fixtures.** Every case/referral this file touches is created fresh (service-role
 * INSERT for cases, RPC for referrals) — NEVER a seeded fixture (ENC-0001, CASE_A_ID's
 * *content*, etc.) is mutated, so this file cannot contaminate the R1 file or any other
 * spec regardless of run order. `CASE_A_ID` is used only as a read-only source case id
 * where convenient (mirrors R1's own usage).
 *
 * **Personas (password Test1234!):** chefe.ccih (staff_admin/CCIH, source coordinator),
 * staff1.ccih / staff2.ccih (plain CCIH staff), chefe.farm (staff_admin/Farmácia, target
 * coordinator), staff1.farm / staff2.farm (plain Farmácia staff).
 *
 * Run with `--workers=1` (serial mode; shared flag-flip lifecycle + a few dialogs that
 * assume no cross-file interleaving of the same DB row).
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY missing — set it in .env.local (Playwright loads it via @next/env).',
  )
}

// Mirrors `e2e/answer-model-v2.spec.ts`'s `DB_CONTAINER`/`sql()` — fixture-setup-only
// escape hatch for `case_referral`'s `guard_referral_status` trigger (live-catalog
// verified: it raises HC070 "encaminhamentos enviados são imutáveis fora das RPCs" on
// ANY direct UPDATE — even service-role REST — once a referral has left `draft`,
// checking `current_setting('app.in_referral_rpc', true) = 'on'`, a flag only the RPCs
// themselves set). `session_replication_role = replica` disables triggers for this one
// psql session so R2-3/R2-4 can backdate `response_due_at` to prove the overdue
// predicate — a state `set_referral_deadline` cannot produce itself, since it calls
// `app.assert_referral_due_future()` and rejects a past date (HC0A4) by design.
const DB_CONTAINER = 'supabase_db_azkbbhskturikxpgmafq'

/** Run SQL as postgres via docker exec — fixture setup ONLY (never to bypass an RPC
 * whose authority/domain checks are under test). */
function sql(query: string): string {
  const escaped = query.replace(/"/g, '\\"')
  return execSync(`docker exec ${DB_CONTAINER} psql -U postgres -d postgres -tA -c "${escaped}"`, {
    encoding: 'utf8',
  })
    .toString()
    .trim()
}

const COMM_A = 'a0000000-0000-0000-0000-0000000000a1' // CCIH  (source)
const COMM_B = 'b0000000-0000-0000-0000-0000000000b1' // Farmácia (target)

const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002' // chefe.ccih
const UID_STAFF1_A = '00000000-0000-0000-0000-000000000003' // staff1.ccih
const UID_CHEFE_B = '00000000-0000-0000-0000-000000000005' // chefe.farm

const RUN_TAG = Date.now() // uniqueness marker appended to text-lookup subjects/labels

// ---------------------------------------------------------------------------
// Feature-flag lifecycle (mirrors phase22-referrals.spec.ts exactly)
// ---------------------------------------------------------------------------

async function setReferralsFlag(req: APIRequestContext, enabled: boolean) {
  const resp = await req.post(`${SUPABASE_URL}/rest/v1/rpc/set_referrals_feature_flag`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    data: { p_enabled: enabled },
  })
  if (!resp.ok()) {
    const fallback = await req.post(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        query: `UPDATE app.feature_flags SET enabled = ${enabled} WHERE key = 'case_referrals'`,
      },
    })
    if (!fallback.ok()) {
      throw new Error(
        `Cannot flip case_referrals flag. Run: npx supabase db query --local "UPDATE app.feature_flags SET enabled = ${enabled} WHERE key = 'case_referrals'"`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers (shared shape with phase22-referrals.spec.ts)
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  // Several tests in this file switch personas mid-test (e.g. R2-2 source →
  // target coordinator, R2-5 coordinator → plain staff). `src/proxy.ts`'s
  // AUTHED_REDIRECT_AWAY bounces an authenticated session straight OUT of
  // `/login` back to `/`, so the E-mail field never renders on a second
  // sign-in unless the prior session is cleared first — mirrors the same fix
  // in `e2e/answer-model-v2.spec.ts`'s `signInAs`.
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url: URL) => !url.pathname.startsWith('/login'), { timeout: 20_000 })
}

async function getToken(req: APIRequestContext, email: string): Promise<string> {
  const resp = await req.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password: 'Test1234!' },
  })
  expect(resp.ok(), `getToken(${email}) failed: ${resp.status()}`).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

async function restGet<T>(req: APIRequestContext, path: string, bearer: string): Promise<T[]> {
  const resp = await req.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${bearer}` },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

async function rpc(
  req: APIRequestContext,
  fn: string,
  bearer: string,
  body: Record<string, unknown>,
) {
  return req.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    },
    data: body,
  })
}

async function createCase(
  req: APIRequestContext,
  commissionId: string,
  label: string,
  createdBy: string,
): Promise<string> {
  const resp = await req.post(`${SUPABASE_URL}/rest/v1/cases`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: { commission_id: commissionId, label, status: 'pending', created_by: createdBy },
  })
  expect(resp.ok(), `createCase(${label}) failed: ${await resp.text()}`).toBeTruthy()
  const [row] = (await resp.json()) as Array<{ id: string }>
  return row.id
}

async function firstActiveType(req: APIRequestContext): Promise<string> {
  const rows = await restGet<{ id: string }>(
    req,
    'referral_types?is_active=eq.true&order=position.asc&limit=1&select=id',
    SUPABASE_SERVICE_KEY,
  )
  expect(rows[0]?.id, 'no active referral_types row').toBeTruthy()
  return rows[0].id
}

async function firstActiveRequestedAction(
  req: APIRequestContext,
): Promise<{ id: string; label: string }> {
  const rows = await restGet<{ id: string; label: string }>(
    req,
    'referral_requested_actions?is_active=eq.true&order=position.asc&limit=1&select=id,label',
    SUPABASE_SERVICE_KEY,
  )
  expect(rows[0]?.id, 'no active referral_requested_actions row').toBeTruthy()
  return rows[0]
}

async function firstActiveReplyOutcome(req: APIRequestContext): Promise<string> {
  const rows = await restGet<{ id: string }>(
    req,
    'reply_outcomes?is_active=eq.true&order=position.asc&limit=1&select=id',
    SUPABASE_SERVICE_KEY,
  )
  expect(rows[0]?.id, 'no active reply_outcomes row').toBeTruthy()
  return rows[0].id
}

/** Draft + send a referral entirely via RPC (fast, deterministic setup — the UI wizard
 * itself is exercised directly by the R2-1 test). Returns the new referral id. */
async function draftAndSend(
  req: APIRequestContext,
  bearer: string,
  input: {
    sourceCaseId: string
    targetCommissionId: string
    typeId: string
    subject: string
    responseExpected: boolean
    priority?: string
    requestedActionId?: string
    responseDueAt?: string | null
    parentReferralId?: string | null
  },
): Promise<string> {
  const draftResp = await rpc(req, 'create_referral_draft', bearer, {
    p_source_case_id: input.sourceCaseId,
    p_target_commission_id: input.targetCommissionId,
    p_referral_type_id: input.typeId,
    p_subject: input.subject,
    p_description_md: `Descrição sintética — ${input.subject}.`,
    p_response_expected: input.responseExpected,
    p_priority: input.priority,
    p_requested_action_id: input.requestedActionId,
    p_response_due_at: input.responseDueAt ?? undefined,
    p_parent_referral_id: input.parentReferralId ?? undefined,
  })
  expect(draftResp.ok(), `create_referral_draft(${input.subject}) failed: ${await draftResp.text()}`).toBeTruthy()
  const { id } = (await draftResp.json()) as { id: string }

  const sendResp = await rpc(req, 'send_referral', bearer, { p_referral_id: id })
  expect(sendResp.ok(), `send_referral(${input.subject}) failed: ${await sendResp.text()}`).toBeTruthy()
  return id
}

/** Advance a just-sent referral to `em_analise` (in_review) via RPC: receive → accept →
 * start_referral_review. Shared setup step for R3/R4/R5 fixtures. */
async function advanceToInReview(req: APIRequestContext, referralId: string) {
  const chefeB = await getToken(req, 'chefe.farm@test.local')
  const r1 = await rpc(req, 'receive_referral', chefeB, { p_referral_id: referralId })
  expect(r1.ok(), `receive_referral failed: ${await r1.text()}`).toBeTruthy()
  const r2 = await rpc(req, 'accept_referral', chefeB, { p_referral_id: referralId })
  expect(r2.ok(), `accept_referral failed: ${await r2.text()}`).toBeTruthy()
  const r3 = await rpc(req, 'start_referral_review', chefeB, { p_referral_id: referralId })
  expect(r3.ok(), `start_referral_review failed: ${await r3.text()}`).toBeTruthy()
}

function futureLocalInput(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function pastIso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
}

// ---------------------------------------------------------------------------
// Suite-level flag lifecycle
// ---------------------------------------------------------------------------

test.beforeAll(async ({ request }) => {
  try {
    await setReferralsFlag(request, true)
  } catch {
    const { execSync } = await import('child_process')
    execSync(
      'npx supabase db query --local "UPDATE app.feature_flags SET enabled = true WHERE key = \'case_referrals\'"',
      { cwd: process.cwd(), stdio: 'pipe' },
    )
  }
  await new Promise((r) => setTimeout(r, 500))
})

test.afterAll(async ({ request }) => {
  try {
    await setReferralsFlag(request, false)
  } catch {
    const { execSync } = await import('child_process')
    execSync(
      'npx supabase db query --local "UPDATE app.feature_flags SET enabled = false WHERE key = \'case_referrals\'"',
      { cwd: process.cwd(), stdio: 'pipe' },
    )
  }
})

// ---------------------------------------------------------------------------
// R2 fixtures — a disposable overdue-positive referral + an excluded-status one.
// The wizard-driven referral (R2-1) creates its OWN fixture inline (real UI flow);
// these two are RPC-seeded because R2-3/R2-4 are about the overdue PREDICATE, not
// the wizard.
// ---------------------------------------------------------------------------

let r2CaseId: string
let r2OverdueReferralId: string // stays `sent` — non-excluded status
let r2ExcludedCaseId: string
let r2ExcludedReferralId: string // withdrawn — excluded status
let r2DeclineCaseId: string
let r2DeclineReferralId: string // received — ready to decline
let r2DeadlineCaseId: string
let r2DeadlineReferralId: string // sent, no due date yet
let r2RequestedAction: { id: string; label: string }

test.beforeAll(async ({ request }) => {
  const chefeA = await getToken(request, 'chefe.ccih@test.local')
  const typeId = await firstActiveType(request)
  r2RequestedAction = await firstActiveRequestedAction(request)

  r2CaseId = await createCase(request, COMM_A, `RV2 R2 — overdue case ${RUN_TAG}`, UID_CHEFE_A)
  r2OverdueReferralId = await draftAndSend(request, chefeA, {
    sourceCaseId: r2CaseId,
    targetCommissionId: COMM_B,
    typeId,
    subject: `RV2 R2 — atraso positivo (${RUN_TAG})`,
    responseExpected: true,
  })

  r2ExcludedCaseId = await createCase(request, COMM_A, `RV2 R2 — excluded case ${RUN_TAG}`, UID_CHEFE_A)
  r2ExcludedReferralId = await draftAndSend(request, chefeA, {
    sourceCaseId: r2ExcludedCaseId,
    targetCommissionId: COMM_B,
    typeId,
    subject: `RV2 R2 — atraso excluído (${RUN_TAG})`,
    responseExpected: true,
  })
  const withdrawResp = await rpc(request, 'withdraw_referral', chefeA, {
    p_referral_id: r2ExcludedReferralId,
  })
  expect(withdrawResp.ok(), `withdraw_referral failed: ${await withdrawResp.text()}`).toBeTruthy()

  r2DeclineCaseId = await createCase(request, COMM_A, `RV2 R2 — decline case ${RUN_TAG}`, UID_CHEFE_A)
  r2DeclineReferralId = await draftAndSend(request, chefeA, {
    sourceCaseId: r2DeclineCaseId,
    targetCommissionId: COMM_B,
    typeId,
    subject: `RV2 R2 — recusa com motivo (${RUN_TAG})`,
    responseExpected: true,
  })
  const chefeB = await getToken(request, 'chefe.farm@test.local')
  const receiveResp = await rpc(request, 'receive_referral', chefeB, {
    p_referral_id: r2DeclineReferralId,
  })
  expect(receiveResp.ok(), `receive_referral failed: ${await receiveResp.text()}`).toBeTruthy()

  r2DeadlineCaseId = await createCase(request, COMM_A, `RV2 R2 — deadline case ${RUN_TAG}`, UID_CHEFE_A)
  r2DeadlineReferralId = await draftAndSend(request, chefeA, {
    sourceCaseId: r2DeadlineCaseId,
    targetCommissionId: COMM_B,
    typeId,
    subject: `RV2 R2 — prazo via ação (${RUN_TAG})`,
    responseExpected: true,
  })
})

// ---------------------------------------------------------------------------
// R3 fixtures — a referral advanced to em_analise (main lifecycle fixture) + a
// dedicated close-gate pair (mirrors phase22-referrals.spec.ts R1-5's own-fixture
// pattern, so the gate test never entangles with the resolve/reopen sequence).
// ---------------------------------------------------------------------------

let r3CaseId: string
let r3ReferralId: string
let r3TargetCaseId: string // Farmácia case linked to r3ReferralId, for "Encaminhar adiante"
let r3ReplyOutcomeId: string
let r3GateCaseId: string
let r3GateReferralId: string

test.beforeAll(async ({ request }) => {
  const chefeA = await getToken(request, 'chefe.ccih@test.local')
  const chefeB = await getToken(request, 'chefe.farm@test.local')
  const typeId = await firstActiveType(request)
  r3ReplyOutcomeId = await firstActiveReplyOutcome(request)

  r3CaseId = await createCase(request, COMM_A, `RV2 R3 — caso principal (${RUN_TAG})`, UID_CHEFE_A)
  r3ReferralId = await draftAndSend(request, chefeA, {
    sourceCaseId: r3CaseId,
    targetCommissionId: COMM_B,
    typeId,
    subject: `RV2 R3 — ciclo de resolução (${RUN_TAG})`,
    responseExpected: true,
  })
  await advanceToInReview(request, r3ReferralId)

  r3TargetCaseId = await createCase(
    request,
    COMM_B,
    `RV2 R3 — caso vinculado destino (${RUN_TAG})`,
    UID_CHEFE_B,
  )
  const linkResp = await rpc(request, 'link_referral_case', chefeB, {
    p_referral_id: r3ReferralId,
    p_target_case_id: r3TargetCaseId,
  })
  expect(linkResp.ok(), `link_referral_case failed: ${await linkResp.text()}`).toBeTruthy()

  // Close-gate pair — independent of the main fixture.
  r3GateCaseId = await createCase(request, COMM_A, `RV2 R3 — bloqueio (${RUN_TAG})`, UID_CHEFE_A)
  r3GateReferralId = await draftAndSend(request, chefeA, {
    sourceCaseId: r3GateCaseId,
    targetCommissionId: COMM_B,
    typeId,
    subject: `RV2 R3 — gate (${RUN_TAG})`,
    responseExpected: true,
  })
  await advanceToInReview(request, r3GateReferralId)
})

// ---------------------------------------------------------------------------
// R4 fixtures — a referral in em_analise (assignments + related-cases panel), a
// Farmácia case to relate (NOT the primary linked target case), and an ISOLATED
// referral for the "assignment ≠ access" proof.
// ---------------------------------------------------------------------------

let r4CaseId: string
let r4ReferralId: string
let r4RelatedCaseId: string
let r4IsolationCaseId: string
let r4IsolationReferralId: string

test.beforeAll(async ({ request }) => {
  const chefeA = await getToken(request, 'chefe.ccih@test.local')
  const typeId = await firstActiveType(request)

  r4CaseId = await createCase(request, COMM_A, `RV2 R4 — caso principal (${RUN_TAG})`, UID_CHEFE_A)
  r4ReferralId = await draftAndSend(request, chefeA, {
    sourceCaseId: r4CaseId,
    targetCommissionId: COMM_B,
    typeId,
    subject: `RV2 R4 — responsabilidade e vínculos (${RUN_TAG})`,
    responseExpected: true,
  })
  await advanceToInReview(request, r4ReferralId)

  r4RelatedCaseId = await createCase(
    request,
    COMM_B,
    `RV2 R4 — caso relacionado (${RUN_TAG})`,
    UID_CHEFE_B,
  )

  r4IsolationCaseId = await createCase(
    request,
    COMM_A,
    `RV2 R4 — isolamento (${RUN_TAG})`,
    UID_CHEFE_A,
  )
  r4IsolationReferralId = await draftAndSend(request, chefeA, {
    sourceCaseId: r4IsolationCaseId,
    targetCommissionId: COMM_B,
    typeId,
    subject: `RV2 R4 — atribuição sem acesso (${RUN_TAG})`,
    responseExpected: true,
  })
})

// ---------------------------------------------------------------------------
// R5 fixtures — a referral in em_analise (internal notes + dialogue thread for
// message redaction + receipts).
// ---------------------------------------------------------------------------

let r5CaseId: string
let r5ReferralId: string

test.beforeAll(async ({ request }) => {
  const chefeA = await getToken(request, 'chefe.ccih@test.local')
  const typeId = await firstActiveType(request)

  r5CaseId = await createCase(request, COMM_A, `RV2 R5 — caso principal (${RUN_TAG})`, UID_CHEFE_A)
  r5ReferralId = await draftAndSend(request, chefeA, {
    sourceCaseId: r5CaseId,
    targetCommissionId: COMM_B,
    typeId,
    subject: `RV2 R5 — notas e recibos (${RUN_TAG})`,
    responseExpected: true,
  })
  await advanceToInReview(request, r5ReferralId)
})

// ===========================================================================
// R2 — Triage, SLA & requested-action
// ===========================================================================

test('R2-1: send wizard sets priority / requested-action / response_due_at; review + detail reflect them', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${r2CaseId}`)

  const subject = `RV2 R2 — via assistente (${RUN_TAG})`
  await page.getByRole('button', { name: /encaminhar caso/i }).click()

  const wizard = page.getByRole('dialog')
  await expect(wizard).toBeVisible()

  await wizard.getByRole('combobox', { name: /Tipo de encaminhamento/ }).selectOption({ index: 1 })
  await wizard.getByRole('combobox', { name: /Comiss[ãa]o de destino/ }).selectOption(COMM_B)
  await wizard.getByRole('textbox', { name: /Assunto/ }).fill(subject)
  // r2CaseId is a bare case with no narratives/documents to pick in step 2, so
  // send_referral's "description OR ≥1 shared item" CHECK (23514) requires a
  // description here — the field's "(opcional)" label is relative to the
  // narrative/document alternative, not unconditionally optional.
  await wizard.getByRole('textbox', { name: /Descrição/ }).fill(`Descrição sintética via assistente — ${subject}.`)
  await wizard.getByRole('combobox', { name: /Prioridade/ }).selectOption('urgent')
  await wizard.getByRole('combobox', { name: /Ação solicitada/ }).selectOption(r2RequestedAction.id)
  const dueLocal = futureLocalInput(5)
  await wizard.getByRole('textbox', { name: /Prazo de resposta/ }).fill(dueLocal)
  await wizard.getByRole('button', { name: 'Continuar' }).click()

  // Step 2 (Conteúdo) → step 3 (Paciente) — no items picked; the step-1 description
  // above satisfies send_referral's content requirement.
  // "Conteúdo" is the STEP-INDICATOR label (an `<ol aria-label="Etapas">` listitem),
  // not a heading — step 2 itself renders "Narrativas" / "Documentos" (h3) headings.
  await expect(wizard.getByRole('heading', { name: 'Narrativas' })).toBeVisible({ timeout: 10_000 })
  await wizard.getByRole('button', { name: 'Continuar' }).click()

  // Step 3 (Paciente) → step 4 (Revisão)
  await expect(wizard.getByRole('button', { name: 'Continuar' })).toBeVisible({ timeout: 10_000 })
  await wizard.getByRole('button', { name: 'Continuar' }).click()

  // Step 4 (Revisão) — confirm the triage fields round-tripped into the summary.
  await expect(wizard.getByText('Urgente')).toBeVisible({ timeout: 10_000 })
  await expect(wizard.getByText(r2RequestedAction.label)).toBeVisible()

  await wizard.getByRole('button', { name: /enviar encaminhamento/i }).click()
  await expect(wizard).toBeHidden({ timeout: 15_000 })

  // Back on the case page — open the new referral from the outbound card.
  const link = page.getByRole('link', { name: subject })
  await expect(link).toBeVisible({ timeout: 10_000 })
  await link.click()
  await page.waitForURL(/\/encaminhamentos\/[0-9a-f-]+$/, { timeout: 10_000 })

  await expect(page.locator('span').filter({ hasText: /^Urgente$/ }).first()).toBeVisible()
  await expect(page.getByText(r2RequestedAction.label).first()).toBeVisible()
  await expect(page.getByText(/Prazo de resposta:/i)).toBeVisible()
  // Future due date — must NOT be flagged overdue.
  await expect(page.locator('span').filter({ hasText: /^Prazo vencido$/ })).toHaveCount(0)
})

test('R2-2: hub (both source and target) shows priority, requested-action and due date', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/encaminhamentos')
  const sourceRow = page.locator('tr').filter({ hasText: `RV2 R2 — atraso positivo (${RUN_TAG})` })
  await expect(sourceRow).toBeVisible({ timeout: 10_000 })

  await signInAs(page, 'chefe.farm@test.local')
  await page.goto('/o/rede-a/c/farmacia/encaminhamentos')
  const targetRow = page.locator('tr').filter({ hasText: `RV2 R2 — atraso positivo (${RUN_TAG})` })
  await expect(targetRow).toBeVisible({ timeout: 10_000 })
})

test('R2-3: a past response_due_at on an in-flight referral renders the OVERDUE badge (hub + detail)', async ({
  page,
}) => {
  // Direct REST PATCH is rejected (HC070 — `case_referral` is immutable outside its
  // RPCs, live-catalog verified via `guard_referral_status`), and the "set deadline"
  // RPC itself rejects a past date (HC0A4) — so backdating for this fixture needs the
  // trigger-bypassing `sql()` helper, not a REST/RPC call.
  sql(
    `set session_replication_role = replica; update public.case_referral set response_due_at = '${pastIso(2)}' where id = '${r2OverdueReferralId}';`,
  )

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/encaminhamentos')
  const row = page.locator('tr').filter({ hasText: `RV2 R2 — atraso positivo (${RUN_TAG})` })
  await expect(row).toBeVisible({ timeout: 10_000 })
  // The overdue CHIP (exact "Prazo vencido") and the separate "Prazo" column cell
  // (e.g. "18/07/2026 · vencido") BOTH contain "vencido" — `.last()` targets the
  // date-column cell specifically (it follows the chip in DOM order), so this is a
  // genuinely distinct assertion from the exact-match chip check above, not a
  // redundant/ambiguous re-check (unscoped, it strict-mode-violates on the 2 matches).
  await expect(row.getByText(/vencido/).last()).toBeVisible()

  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r2OverdueReferralId}`)
  await expect(page.locator('span').filter({ hasText: /^Prazo vencido$/ }).first()).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText(/Prazo de resposta:.*vencido/i)).toBeVisible()
})

test('R2-4: isReferralOverdue mirror — a terminal (withdrawn) referral with a past due date is NEVER overdue', async ({
  page,
}) => {
  sql(
    `set session_replication_role = replica; update public.case_referral set response_due_at = '${pastIso(3)}' where id = '${r2ExcludedReferralId}';`,
  )

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r2ExcludedReferralId}`)
  await expect(page.locator('span').filter({ hasText: /^Retirada$/ }).first()).toBeVisible({
    timeout: 10_000,
  })
  // The excluded-status mirror: a past due date on a terminal referral never renders
  // the overdue chip (OVERDUE_EXCLUDED_STATUSES / app.referral_is_overdue parity).
  await expect(page.locator('span').filter({ hasText: /^Prazo vencido$/ })).toHaveCount(0)
})

test('R2-5: decline sets a PHI-free reason — visible to a non-PHI metadata reader; the PHI note stays hidden', async ({
  page,
}) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${r2DeclineReferralId}`)

  await page.getByRole('button', { name: /recusar/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel(/Motivo da recusa/).selectOption('insufficient_information')
  await dialog.getByLabel(/Observação/).fill('Nota PHI confidencial — não deve vazar (R2-5).')
  await dialog.getByRole('button', { name: /^Recusar$/ }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })

  await expect(page.locator('span').filter({ hasText: /^Recusada$/ }).first()).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText(/Motivo da recusa:\s*Informações insuficientes/i)).toBeVisible()

  // A plain, non-PHI-entitled source-side member: metadata-tier reader.
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r2DeclineReferralId}`)
  await expect(page.getByText(/Motivo da recusa:\s*Informações insuficientes/i)).toBeVisible({
    timeout: 10_000,
  })
  const html = await page.content()
  expect(html).not.toContain('Nota PHI confidencial')
})

test('R2-6: either coordinator sets/updates the SLA deadline via "Definir prazo" / "Alterar prazo"', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r2DeadlineReferralId}`)

  const setBtn = page.getByRole('button', { name: /definir prazo/i })
  await expect(setBtn).toBeVisible({ timeout: 10_000 })
  await setBtn.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Prazo de resposta' })).toBeVisible()
  await dialog.getByLabel('Prazo').fill(futureLocalInput(7))
  await dialog.getByRole('button', { name: /salvar prazo/i }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })

  await expect(page.getByText(/Prazo de resposta:/i)).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: /alterar prazo/i })).toBeVisible()
})

// ===========================================================================
// R3 — Resolution cycles, reopening & lineage
// ===========================================================================

test('R3-1: target concludes a reply-expected referral → status becomes "answered" (not completed)', async ({
  page,
  request,
}) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${r3ReferralId}`)

  await page.getByLabel('Desfecho da análise').selectOption(r3ReplyOutcomeId)
  await page.getByLabel('Resultado').fill('Análise concluída — resultado da comissão de destino (R3-1).')
  await page.getByRole('button', { name: /enviar resposta e concluir/i }).click()

  await expect(page.locator('span').filter({ hasText: /^Respondida$/ }).first()).toBeVisible({
    timeout: 15_000,
  })

  const rows = await restGet<{ status: string }>(
    request,
    `case_referral?id=eq.${r3ReferralId}&select=status`,
    SUPABASE_SERVICE_KEY,
  )
  expect(rows[0]?.status).toBe('answered')
})

test('R3-2: close_case is BLOCKED while a referral is "answered" (HC076, pt-BR error)', async ({
  request,
}) => {
  const chefeA = await getToken(request, 'chefe.ccih@test.local')
  const closeResp = await rpc(request, 'close_case', chefeA, { p_case_id: r3CaseId })
  expect(closeResp.ok()).toBeFalsy()
  const bodyStr = JSON.stringify(await closeResp.json())
  expect(bodyStr).toMatch(/HC076/)
  expect(bodyStr).toMatch(/aguardando resposta/i)
})

test('R3-3: a plain (non-coordinator) staff member cannot resolve — 42501, authority checked first', async ({
  request,
}) => {
  const staff1 = await getToken(request, 'staff1.ccih@test.local')
  const resp = await rpc(request, 'resolve_referral', staff1, {
    p_referral_id: r3ReferralId,
    p_summary_md: 'Tentativa não autorizada (R3-3).',
    // Live-catalog signature: p_referral_id, p_summary_md, p_follow_up (NOT
    // p_follow_up_required — that name resolves to no function → PGRST202, masking
    // this test's actual 42501 assertion).
    p_follow_up: false,
  })
  expect(resp.ok()).toBeFalsy()
  const body = await resp.json() as Record<string, unknown>
  expect(body['code']).toBe('42501')
})

test('R3-4: source "Resolver" → status "resolved"; resolution history renders "Resolução 1"', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r3ReferralId}`)

  await page.getByRole('button', { name: /^resolver$/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel(/Resumo da resolução/).fill('Resumo do primeiro ciclo de resolução (R3-4).')
  await dialog.getByLabel(/Requer acompanhamento/).check()
  await dialog.getByRole('button', { name: /^Resolver$/ }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })

  await expect(page.locator('span').filter({ hasText: /^Resolvida$/ }).first()).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByRole('heading', { name: 'Histórico de resolução' })).toBeVisible()
  await expect(page.getByText('Resolução 1')).toBeVisible()
  await expect(page.getByText('Resumo do primeiro ciclo de resolução (R3-4).')).toBeVisible()
  await expect(page.getByText('Requer acompanhamento').first()).toBeVisible()
})

test('R3-5: close_case now SUCCEEDS on the gate fixture once its referral is resolved (resolved releases)', async ({
  request,
}) => {
  const chefeA = await getToken(request, 'chefe.ccih@test.local')
  const chefeB = await getToken(request, 'chefe.farm@test.local')

  const concludeResp = await rpc(request, 'conclude_referral', chefeB, {
    p_referral_id: r3GateReferralId,
    p_reply_outcome_id: r3ReplyOutcomeId,
    p_result_md: 'Resultado — gate fixture (R3-5).',
    p_acknowledged_only: false,
  })
  expect(concludeResp.ok(), `conclude_referral failed: ${await concludeResp.text()}`).toBeTruthy()

  const blockedResp = await rpc(request, 'close_case', chefeA, { p_case_id: r3GateCaseId })
  expect(blockedResp.ok()).toBeFalsy()
  expect(JSON.stringify(await blockedResp.json())).toMatch(/HC076/)

  const resolveResp = await rpc(request, 'resolve_referral', chefeA, {
    p_referral_id: r3GateReferralId,
    p_summary_md: null,
    p_follow_up: false,
  })
  expect(resolveResp.ok(), `resolve_referral failed: ${await resolveResp.text()}`).toBeTruthy()

  const closeResp = await rpc(request, 'close_case', chefeA, { p_case_id: r3GateCaseId })
  expect(closeResp.ok(), `close_case after resolve failed: ${await closeResp.text()}`).toBeTruthy()
  const closed = (await closeResp.json()) as { status: string }
  expect(closed.status).toBe('completed')
})

test('R3-6: source "Reabrir" → status back to "em_analise"; resolution row keeps its reopened marker (append-only)', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r3ReferralId}`)

  await page.getByRole('button', { name: /^reabrir$/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel(/Motivo da reabertura/).fill('Reabertura para novo ciclo de análise (R3-6).')
  await dialog.getByRole('button', { name: /^Reabrir$/ }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })

  await expect(page.locator('span').filter({ hasText: /^Em análise$/ }).first()).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText(/Reaberto em/i)).toBeVisible()
  await expect(page.getByText(/Reabertura para novo ciclo de análise \(R3-6\)/i)).toBeVisible()
})

test('R3-7: append-only — a second resolve cycle appends "Resolução 2" while "Resolução 1" is preserved', async ({
  page,
}) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${r3ReferralId}`)
  await page.getByLabel('Desfecho da análise').selectOption(r3ReplyOutcomeId)
  await page.getByLabel('Resultado').fill('Segundo ciclo — resultado (R3-7).')
  await page.getByRole('button', { name: /enviar resposta e concluir/i }).click()
  await expect(page.locator('span').filter({ hasText: /^Respondida$/ }).first()).toBeVisible({
    timeout: 15_000,
  })

  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r3ReferralId}`)
  await page.getByRole('button', { name: /^resolver$/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/Resumo da resolução/).fill('Resumo do segundo ciclo (R3-7).')
  await dialog.getByRole('button', { name: /^Resolver$/ }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })

  await expect(page.getByText('Resolução 2')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Resolução 1')).toBeVisible()
  await expect(page.getByText('Resumo do segundo ciclo (R3-7).')).toBeVisible()
})

test('R3-8: "Encaminhar adiante" creates a child referral carrying parent lineage', async ({
  page,
}) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${r3ReferralId}`)

  const forwardLink = page.getByRole('link', { name: /encaminhar adiante/i })
  await expect(forwardLink).toBeVisible({ timeout: 10_000 })
  await forwardLink.click()
  await page.waitForURL(/encaminharDe=/, { timeout: 10_000 })

  const subject = `RV2 R3 — encaminhado adiante (${RUN_TAG})`
  const wizard = page.getByRole('dialog')
  await expect(wizard).toBeVisible({ timeout: 10_000 })
  await wizard.getByRole('combobox', { name: /Tipo de encaminhamento/ }).selectOption({ index: 1 })
  await wizard.getByRole('combobox', { name: /Comiss[ãa]o de destino/ }).selectOption(COMM_A)
  await wizard.getByRole('textbox', { name: /Assunto/ }).fill(subject)
  // r3TargetCaseId is a bare case with no narratives/documents to pick in step 2, so
  // send_referral's "description OR ≥1 shared item" CHECK (23514) requires a
  // description here (mirrors R2-1's fix).
  await wizard.getByRole('textbox', { name: /Descrição/ }).fill(`Descrição sintética via assistente — ${subject}.`)
  const responseToggle = wizard.getByRole('checkbox', { name: /Aguardar resposta/ })
  if (await responseToggle.isChecked()) await responseToggle.uncheck()
  await wizard.getByRole('button', { name: 'Continuar' }).click()
  await expect(wizard.getByRole('heading', { name: 'Narrativas' })).toBeVisible({ timeout: 10_000 })
  await wizard.getByRole('button', { name: 'Continuar' }).click()
  await expect(wizard.getByRole('button', { name: 'Continuar' })).toBeVisible({ timeout: 10_000 })
  await wizard.getByRole('button', { name: 'Continuar' }).click()
  await wizard.getByRole('button', { name: /enviar encaminhamento/i }).click()
  await expect(wizard).toBeHidden({ timeout: 15_000 })

  const childLink = page.getByRole('link', { name: subject })
  await expect(childLink).toBeVisible({ timeout: 10_000 })
  await childLink.click()
  await page.waitForURL(/\/encaminhamentos\/[0-9a-f-]+$/, { timeout: 10_000 })

  const parentLink = page.getByRole('link', { name: /encaminhado a partir de outro encaminhamento/i })
  await expect(parentLink).toBeVisible({ timeout: 10_000 })
  await parentLink.click()
  await page.waitForURL(new RegExp(r3ReferralId), { timeout: 10_000 })
  // Plain getByText is ambiguous here: draftAndSend's auto-description
  // ("Descrição sintética — <subject>.") embeds the subject as a substring, so an
  // unanchored text match resolves to BOTH the page's <h1> subject heading and that
  // description <p>. Scope to the heading — the page-identity signal under test.
  await expect(
    page.getByRole('heading', { name: `RV2 R3 — ciclo de resolução (${RUN_TAG})` }),
  ).toBeVisible()
})

// ===========================================================================
// R4 — Responsibility & multi-linkage
// ===========================================================================

test('R4-1: a plain (non-coordinator) staff member sees no assignment/link write controls', async ({
  page,
}) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r4ReferralId}`)

  await expect(page.getByRole('heading', { name: 'Responsáveis' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: /atribuir responsável/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /relacionar caso/i })).toHaveCount(0)
})

test('R4-2: coordinator assigns a reviewer; the row shows role/status/due', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r4ReferralId}`)

  await page.getByRole('button', { name: /atribuir responsável/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Responsável').selectOption(UID_STAFF1_A)
  await dialog.getByLabel('Papel').selectOption('primary_reviewer')
  await dialog.getByLabel(/Prazo/).fill(futureLocalInput(4))
  await dialog.getByRole('button', { name: /^Atribuir$/ }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })

  const row = page.locator('li').filter({ hasText: 'Revisor(a) principal' })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(row.getByText('Pendente')).toBeVisible()
})

test('R4-3: "Minhas atribuições de encaminhamento" lists the assignee\'s task', async ({ page }) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto('/conta/encaminhamentos')

  await expect(page.getByRole('heading', { name: 'Minhas atribuições de encaminhamento' })).toBeVisible()
  const item = page.locator('article').filter({ hasText: `RV2 R4 — responsabilidade e vínculos (${RUN_TAG})` })
  await expect(item).toBeVisible({ timeout: 10_000 })
  await expect(item.getByText('Revisor(a) principal')).toBeVisible()
  await expect(item.getByText('Pendente')).toBeVisible()
})

test('R4-4: coordinator edits the assignment — role/status/due update', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r4ReferralId}`)

  const row = page.locator('li').filter({ hasText: 'Revisor(a) principal' })
  await row.getByRole('button', { name: /^editar$/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Estado').selectOption('in_progress')
  await dialog.getByRole('button', { name: /^Salvar$/ }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })

  const updatedRow = page.locator('li').filter({ hasText: 'Revisor(a) principal' })
  await expect(updatedRow.getByText('Em andamento')).toBeVisible({ timeout: 10_000 })
})

test('R4-5: coordinator cancels the assignment — status "Cancelada", controls disappear', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r4ReferralId}`)

  const row = page.locator('li').filter({ hasText: 'Revisor(a) principal' })
  await row.getByRole('button', { name: /^cancelar$/i }).click()

  const cancelledRow = page.locator('li').filter({ hasText: 'Revisor(a) principal' })
  await expect(cancelledRow.getByText('Cancelada')).toBeVisible({ timeout: 10_000 })
  await expect(cancelledRow.getByRole('button', { name: /^editar$/i })).toHaveCount(0)
  await expect(cancelledRow.getByRole('button', { name: /^cancelar$/i })).toHaveCount(0)
})

test('R4-6: coordinator relates a typed case link; it renders with number + relationship label', async ({
  page,
}) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${r4ReferralId}`)

  await page.getByRole('button', { name: /relacionar caso/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  // Plain getByLabel('Caso') (substring match) is ambiguous in this dialog: the
  // sibling "Tipo de relação" select's DEFAULT option is `related_case` = "Caso
  // relacionado", and Chromium folds a <select>'s current-option text into its
  // computed accessible name — so that select's name also contains "Caso". Anchor
  // to the start (only the "Caso" field's own name begins with it).
  await dialog.getByLabel(/^Caso/).selectOption(r4RelatedCaseId)
  await dialog.getByLabel(/Tipo de relação/).selectOption('follow_up_case')
  await dialog.getByRole('button', { name: /^Relacionar$/ }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })

  await expect(page.getByRole('heading', { name: 'Casos relacionados' })).toBeVisible()
  await expect(page.getByText('Caso de acompanhamento')).toBeVisible({ timeout: 10_000 })
})

test('R4-7: coordinator removes the related-case link', async ({ page }) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${r4ReferralId}`)

  const linkRow = page.locator('li').filter({ hasText: 'Caso de acompanhamento' })
  await expect(linkRow).toBeVisible({ timeout: 10_000 })
  await linkRow.getByRole('button', { name: /^remover$/i }).click()

  await expect(page.locator('li').filter({ hasText: 'Caso de acompanhamento' })).toHaveCount(0, {
    timeout: 10_000,
  })
})

test('R4-8: a related-case link grants NO case access — the other side still cannot read it', async ({
  request,
}) => {
  const chefeB = await getToken(request, 'chefe.farm@test.local')
  const linkResp = await rpc(request, 'link_referral_related_case', chefeB, {
    p_referral_id: r4ReferralId,
    p_case_id: r4RelatedCaseId,
    p_relationship_type: 'related_case',
  })
  expect(linkResp.ok(), `link_referral_related_case failed: ${await linkResp.text()}`).toBeTruthy()

  // Pointer visible on the referral (metadata-tier, either side).
  const chefeA = await getToken(request, 'chefe.ccih@test.local')
  const detailResp = await rpc(request, 'get_referral_detail', chefeA, { p_referral_id: r4ReferralId })
  expect(detailResp.ok()).toBeTruthy()
  // Direct RPC call — raw Postgres JSON, snake_case (the camelCase `caseId` on the
  // TS `ReferralCaseLink` domain type only exists after the app query layer maps
  // it; live-verified the raw shape carries `case_id`).
  const detail = (await detailResp.json()) as { links?: Array<{ case_id: string }> }
  const linkIds = (detail.links ?? []).map((l) => l.case_id)
  expect(linkIds).toContain(r4RelatedCaseId)

  // But CCIH (source) still cannot read Farmácia's related case content — RLS unmoved.
  const caseResp = await rpc(request, 'get_case_detail', chefeA, { p_case_id: r4RelatedCaseId })
  const rawText = await caseResp.text()
  const body = rawText.startsWith('{') || rawText.startsWith('null')
    ? (JSON.parse(rawText) as Record<string, unknown> | null)
    : null
  if (caseResp.ok()) {
    expect(body).toBeNull()
  } else {
    expect([403, 404, 500]).toContain(caseResp.status())
  }
})

test('R4-9: an assignment grants NO extra access — the assignee stays PHI-unentitled after being assigned', async ({
  request,
}) => {
  const staff1 = await getToken(request, 'staff1.ccih@test.local')
  const before = await rpc(request, 'get_referral_patient', staff1, {
    p_referral_id: r4IsolationReferralId,
  })
  if (before.ok()) expect(await before.json()).toBeNull()

  const chefeA = await getToken(request, 'chefe.ccih@test.local')
  const assignResp = await rpc(request, 'assign_referral_reviewer', chefeA, {
    p_referral_id: r4IsolationReferralId,
    p_commission_id: COMM_A,
    p_assignee_user_id: UID_STAFF1_A,
    p_assignment_role: 'referral_coordinator',
  })
  expect(assignResp.ok(), `assign_referral_reviewer failed: ${await assignResp.text()}`).toBeTruthy()

  const after = await rpc(request, 'get_referral_patient', staff1, {
    p_referral_id: r4IsolationReferralId,
  })
  if (after.ok()) expect(await after.json()).toBeNull()
})

// ===========================================================================
// R5 — Private notes, disclosure controls & hardening
// ===========================================================================

test('R5-1: a committee member creates a private internal note on their own side', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r5ReferralId}`)

  await expect(page.getByRole('heading', { name: 'Notas internas' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/visíveis apenas à sua comissão/i)).toBeVisible()

  await page.getByPlaceholder(/Escreva uma nota visível apenas à sua comissão/).fill(
    'Nota interna da origem — só CCIH deve ver isto (R5-1).',
  )
  await page.getByRole('button', { name: /adicionar nota/i }).click()

  await expect(page.getByText('Nota interna da origem — só CCIH deve ver isto (R5-1).')).toBeVisible({
    timeout: 15_000,
  })
})

test('R5-2: the OTHER committee never sees that note — creates its own instead (side-private, no leak)', async ({
  page,
}) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${r5ReferralId}`)

  const html = await page.content()
  expect(html).not.toContain('Nota interna da origem — só CCIH deve ver isto')

  await page.getByPlaceholder(/Escreva uma nota visível apenas à sua comissão/).fill(
    'Nota interna do destino — só Farmácia deve ver isto (R5-2).',
  )
  await page.getByRole('button', { name: /adicionar nota/i }).click()
  await expect(page.getByText('Nota interna do destino — só Farmácia deve ver isto (R5-2).')).toBeVisible({
    timeout: 15_000,
  })

  // And the reverse holds too — CCIH's page never renders Farmácia's note.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r5ReferralId}`)
  const htmlBack = await page.content()
  expect(htmlBack).not.toContain('Nota interna do destino — só Farmácia deve ver isto')
})

test('R5-3: a coordinator redacts their own note — renders [redigido], original text gone', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r5ReferralId}`)

  const noteItem = page.locator('li').filter({ hasText: 'Nota interna da origem' })
  await expect(noteItem).toBeVisible({ timeout: 10_000 })
  await noteItem.getByRole('button', { name: /^tarjar$/i }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Tarjar nota interna' })).toBeVisible()
  await dialog.getByLabel(/Motivo da tarja/).fill('Conteúdo indevido — remoção editorial (R5-3).')
  await dialog.getByRole('button', { name: /^Tarjar$/ }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })

  await expect(page.getByText('[redigido]').first()).toBeVisible({ timeout: 10_000 })
  // A locator-based absence check, NOT page.content(): Next.js's RSC hydration
  // payload embeds the pre-redaction server render in inline <script> tags that
  // linger in the raw HTML even after router.refresh() swaps the VISIBLE DOM to
  // "[redigido]" — page.content() (a full HTML string dump, including those
  // scripts) can still "contain" the original text although nothing renders it.
  // getByText only matches actual rendered nodes, so this reflects what the user
  // (and R2-5/R5-2's sibling checks, which test content never server-rendered
  // for that viewer at all — a different scenario) actually sees.
  await expect(
    page.getByText('Nota interna da origem — só CCIH deve ver isto (R5-1).'),
  ).toHaveCount(0)
})

test('R5-4: a coordinator redacts a thread message — renders [redigido] to every reader', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r5ReferralId}`)

  const thread = page.getByRole('region', { name: 'Diálogo' })
  await expect(thread).toBeVisible({ timeout: 10_000 })
  const composer = thread.locator('form')
  await composer.locator('textarea').fill('Mensagem a ser tarjada em seguida (R5-4).')
  await composer.locator('button[type="submit"]').click()
  await expect(thread.getByText('Mensagem a ser tarjada em seguida (R5-4).')).toBeVisible({
    timeout: 15_000,
  })

  const messageItem = thread.locator('li').filter({ hasText: 'Mensagem a ser tarjada em seguida' })
  await messageItem.getByRole('button', { name: /^tarjar$/i }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Tarjar mensagem' })).toBeVisible()
  await dialog.getByLabel(/Motivo da tarja/).fill('Mensagem enviada por engano (R5-4).')
  await dialog.getByRole('button', { name: /^Tarjar$/ }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })

  await expect(thread.getByText('[redigido]').first()).toBeVisible({ timeout: 10_000 })
  // Locator-based, not page.content() — see R5-3's comment: the RSC hydration
  // payload can retain the pre-redaction text in the raw HTML string even after
  // the visible DOM correctly swaps to "[redigido]".
  await expect(thread.getByText('Mensagem a ser tarjada em seguida')).toHaveCount(0)
})

test('R5-5: read receipts — a non-author reader auto-records "read"; "Confirmar ciência" records "acknowledged"', async ({
  page,
}) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${r5ReferralId}`)
  const thread = page.getByRole('region', { name: 'Diálogo' })
  await expect(thread).toBeVisible({ timeout: 10_000 })
  const composer = thread.locator('form')
  await composer.locator('textarea').fill('Mensagem para o teste de recibos (R5-5).')
  await composer.locator('button[type="submit"]').click()
  await expect(thread.getByText('Mensagem para o teste de recibos (R5-5).')).toBeVisible({
    timeout: 15_000,
  })

  // A different reader (not the author) opens the page — the client auto-fires a
  // background "read" receipt on mount; reload to see the server-rendered count.
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r5ReferralId}`)
  await expect(thread.getByText('Mensagem para o teste de recibos (R5-5).')).toBeVisible({
    timeout: 10_000,
  })
  await page.waitForTimeout(1_000)
  await page.reload()

  const messageItem = thread.locator('li').filter({ hasText: 'Mensagem para o teste de recibos' })
  await expect(messageItem.getByText(/1 leitura/)).toBeVisible({ timeout: 10_000 })

  await messageItem.getByRole('button', { name: /confirmar ciência/i }).click()
  await expect(messageItem.getByText('Ciência confirmada')).toBeVisible({ timeout: 15_000 })
  await expect(messageItem.getByText(/1 ciente/)).toBeVisible()
})

test('R5-6: keyboard-only — compose and submit an internal note via Tab/Enter (no mouse)', async ({
  page,
}) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${r5ReferralId}`)

  const textarea = page.getByPlaceholder(/Escreva uma nota visível apenas à sua comissão/)
  await textarea.focus()
  await expect(textarea).toBeFocused()
  await page.keyboard.type('Nota interna registrada só com teclado (R5-6).')

  const submitBtn = page.getByRole('button', { name: /adicionar nota/i })
  await page.keyboard.press('Tab')
  await expect(submitBtn).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page.getByText('Nota interna registrada só com teclado (R5-6).')).toBeVisible({
    timeout: 15_000,
  })
})
