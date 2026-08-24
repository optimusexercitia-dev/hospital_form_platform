import { execSync } from 'node:child_process'
import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

import { cachedSignIn, accessToken } from './helpers/auth'
import { saveMinimalReferralPatientForSend } from './helpers/referrals'

/**
 * Referral detail redesign (RDR / ADR 0109) — Phase 4 E2E.
 *
 * Covers the surfaces the redesign ADDED, which no existing spec reaches:
 *   REG-*   "Registros internos": vocabulary → typed+assigned registro → assignee
 *           edit → conclude (frozen) → redact → `[redigido]`, and the K-R5-1
 *           side-privacy proof that the OTHER committee sees none of it.
 *   DET-*   the rail "Detalhes" card (D1 + A10): rows render with real values, a
 *           rejected referral carries "Motivo da recusa", a technical-direction
 *           referral composes "Para", and BOTH sides render side-correct content.
 *   CASE-*  the side case card's TWO states (A12): a reader gets the
 *           "Abrir registro do caso" LINK; a non-reader gets the muted refusal plus
 *           "Quem tem acesso?" → the five-group roster dialog (A7).
 *   EVT-*   D7 — synthesized lifecycle rows interleave with message bubbles in the
 *           Diálogo, in one time-ordered timeline.
 *   KB-*    keyboard-only: the composer's Ctrl+Enter accelerator, and the access
 *           dialog's focus trap / Esc restore.
 *
 * **Fixtures.** Every referral this file MUTATES is created fresh through the real
 * RPCs; the only seeded rows used are read-only (ENC-0001 and its two cases), because
 * `supabase/seed.sql` is a contract shared with ~900 tests and adjusting it to suit
 * one spec has regressed unrelated ones before. Phase 3 flagged that no seeded
 * referral is `rejected` — DET-2 therefore builds one here rather than touching the
 * seed.
 *
 * **Feature flag.** `case_referrals` ships OFF; this file flips it ON in `beforeAll`
 * and back OFF in `afterAll`, exactly as `phase22-referrals*.spec.ts` do, so it is
 * runnable standalone and independent of run order.
 *
 * Run with `--workers=1` (serial mode; a shared flag lifecycle and a registro
 * lifecycle whose steps are ordered).
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

const COMM_A = 'a0000000-0000-0000-0000-0000000000a1' // CCIH     (source)
const COMM_B = 'b0000000-0000-0000-0000-0000000000b1' // Farmácia (target)
const COMM_A_NAME = 'Infecção Hospitalar'
const COMM_B_NAME = 'Farmácia e Terapêutica'

const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002' // chefe.ccih
const UID_STAFF1_A = '00000000-0000-0000-0000-000000000003' // staff1.ccih
const UID_CHEFE_B = '00000000-0000-0000-0000-000000000005' // chefe.farm

const HOSPITAL_CENTRAL_A = '05000000-0000-0000-0000-00000000000a'

// Seeded, READ-ONLY. ENC-0001 is CCIH → Farmácia, `completed`, with a linked target
// case (Caso 0001 of Farmácia) — the only fixture where one side can read the case
// and another member of that same side cannot, which is what the A12 two-state card
// needs.
const ENC1_ID = 'efa00000-0000-0000-0000-0000000000a1'
const ENC1_TARGET_CASE_ID = 'dba00000-0000-0000-0000-0000000000b1'
const ENC1_CASE_LABEL = 'Caso 0001'

const RUN_TAG = Date.now()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DB_CONTAINER = 'supabase_db_azkbbhskturikxpgmafq'

/** Run SQL as postgres via docker exec — FIXTURE SETUP ONLY (never to bypass an RPC
 * whose authority/domain checks are under test). Same escape hatch the sibling
 * referral specs use. */
function sql(query: string): string {
  const escaped = query.replace(/"/g, '\\"')
  return execSync(`docker exec ${DB_CONTAINER} psql -U postgres -d postgres -tA -c "${escaped}"`, {
    encoding: 'utf8',
  })
    .toString()
    .trim()
}

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  await cachedSignIn(page, email, password)
}

/** A JWT for a persona. Delegates to the hat-aware shared helper (ADR 0106): a token
 * minted without an `active_role` claim fails every `is_member_of_for` gate. */
async function getToken(req: APIRequestContext, email: string): Promise<string> {
  return accessToken(req, email)
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

async function restGet<T>(req: APIRequestContext, path: string, bearer: string): Promise<T[]> {
  const resp = await req.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${bearer}` },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

/** The stored `case_referrals` value, so teardown can put back what it found. */
function readReferralsFlag(): boolean {
  return sql(`select enabled from app.feature_flags where key = 'case_referrals';`) === 't'
}

/**
 * Flip the `case_referrals` feature flag, then READ IT BACK.
 *
 * ⚠ The sibling specs post to a `set_referrals_feature_flag` RPC first — that
 * function does not exist in the live catalog (PostgREST 404s), so they have always
 * fallen through to their CLI escape hatch. This goes straight to the same psql door
 * the referral fixtures already use for `session_replication_role`, and then asserts
 * the stored value: a flag helper that fails silently would leave every test below it
 * asserting against a 404 page.
 */
function setReferralsFlag(enabled: boolean) {
  sql(`update app.feature_flags set enabled = ${enabled} where key = 'case_referrals';`)
  const readBack = sql(`select enabled from app.feature_flags where key = 'case_referrals';`)
  expect(readBack, 'case_referrals flag did not take the requested value').toBe(
    enabled ? 't' : 'f',
  )
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

async function draftAndSend(
  req: APIRequestContext,
  bearer: string,
  input: {
    sourceCaseId: string
    targetCommissionId: string | null
    targetHospitalId?: string
    typeId: string
    subject: string
    requestedActionId?: string
  },
): Promise<string> {
  const draftResp = await rpc(req, 'create_referral_draft', bearer, {
    p_source_case_id: input.sourceCaseId,
    p_target_commission_id: input.targetCommissionId,
    p_target_hospital_id: input.targetHospitalId,
    p_referral_type_id: input.typeId,
    p_subject: input.subject,
    p_description_md: `Descrição sintética — ${input.subject}.`,
    p_response_expected: true,
    p_requested_action_id: input.requestedActionId,
  })
  expect(
    draftResp.ok(),
    `create_referral_draft(${input.subject}) failed: ${await draftResp.text()}`,
  ).toBeTruthy()
  const { id } = (await draftResp.json()) as { id: string }

  // ADR 0137 D4 — send_referral now refuses without an MRN (HC0T4). Fixture
  // setup, not the subject under test.
  await saveMinimalReferralPatientForSend(req, bearer, id)
  const sendResp = await rpc(req, 'send_referral', bearer, { p_referral_id: id })
  expect(sendResp.ok(), `send_referral(${input.subject}) failed: ${await sendResp.text()}`).toBeTruthy()
  return id
}

/** receive → accept → start_referral_review, as the target coordinator. */
async function advanceToInReview(req: APIRequestContext, referralId: string) {
  const chefeB = await getToken(req, 'chefe.farm@test.local')
  for (const fn of ['receive_referral', 'accept_referral', 'start_referral_review']) {
    const resp = await rpc(req, fn, chefeB, { p_referral_id: referralId })
    expect(resp.ok(), `${fn} failed: ${await resp.text()}`).toBeTruthy()
  }
}

/** The rail "Detalhes" card — `<section aria-labelledby>` → role `region`. */
function detailsCard(page: Page) {
  return page.getByRole('region', { name: 'Detalhes' })
}

/**
 * One `dt`/`dd` row of the Detalhes card, addressed by its LABEL.
 *
 * The card renders label and value as SEPARATE elements on purpose, so no assertion
 * may span both in one regex. Scoping is not optional either: "Prazo de resposta"
 * also titles `referral-actions.tsx`'s SLA dialog on this same page, and "Motivo da
 * recusa" also labels the decline dialog's select.
 */
function detailsRow(page: Page, label: string) {
  return detailsCard(page)
    .locator('div')
    .filter({ has: page.getByText(label, { exact: true }) })
}

/** The registros panel — heading "Registros internos" (RDR D6). */
function registrosPanel(page: Page) {
  return page.getByRole('region', { name: 'Registros internos' })
}

/**
 * The registro composer/editor form.
 *
 * ⚠ 87cd1ddb ("simplify the detail layout") promoted the composer from an inline
 * panel form into `ReferralRegistroDialog` — one DIALOG serving both create AND
 * edit — and renamed its body field's label from "Registro" to "Descrição". Scoping
 * this by that label (as the pre-87cd1ddb helper did) turned out UNSAFE: every
 * fixture referral here carries a `description_md` (`draftAndSend` always sets one),
 * which the page renders as its own `<section aria-labelledby="referral-description-
 * heading">` — and empirically `getByLabel('Descrição', { exact: true })` matches
 * THAT section too (not just the dialog's textarea), a live strict-mode collision
 * proven by a real run, not a theoretical one. Scoping to `page.getByRole('dialog')`
 * first sidesteps it entirely: the dialog is the only `<form>` on this page, and the
 * description section lives outside its portalled subtree.
 */
function registroForm(page: Page) {
  return page.getByRole('dialog').locator('form')
}

// ---------------------------------------------------------------------------
// Flag lifecycle + fixtures
// ---------------------------------------------------------------------------

let regReferralId: string // in_review — registros lifecycle, Detalhes, keyboard
let rejectedReferralId: string // rejected with a structured reason — DET-2
let evtReferralId: string // full lifecycle + one message — EVT-1
let dtReferralId: string // technical-direction target — DET-4
let requestedAction: { id: string; label: string }
let replyOutcomeId: string
/** What `case_referrals` held BEFORE this file ran — restored verbatim in afterAll. */
let referralsFlagBefore: boolean

/**
 * ⚠ Fixture subjects must NOT contain "registros internos": the subject renders as
 * the page `<h1>` and `getByRole('heading', { name })` substring-matches, so such a
 * subject collides with the panel's own `<h2>` and strict-mode-violates every
 * heading assertion in this file.
 */
const REG_SUBJECT = `RDR — ciclo do registro (${RUN_TAG})`

/**
 * The registro kind this spec files under. NOT run-tagged and NOT per-commission:
 * the vocabulary is the FIXED six-value case-Registro list shared with the case
 * timeline (`CASE_EVENT_KIND_LABELS`), so it is the same on both sides and on every
 * run. That is exactly why cross-side assertions here key on RUN_TAG'd title/body
 * text and never on the kind label — 'Reunião' legitimately appears in the other
 * side's own picker.
 */
const KIND_VALUE = 'meeting'
const KIND_LABEL = 'Reunião'
const REG_TITLE = `Contato com a farmácia (${RUN_TAG})`
const REG_BODY = `Corpo **markdown** do registro (${RUN_TAG}).`
const REG_BODY_EDITED = `Corpo revisado pela responsável (${RUN_TAG}).`

test.beforeAll(async ({ request }) => {
  referralsFlagBefore = readReferralsFlag()
  setReferralsFlag(true)
  await new Promise((r) => setTimeout(r, 500))

  const chefeA = await getToken(request, 'chefe.ccih@test.local')
  const chefeB = await getToken(request, 'chefe.farm@test.local')
  const typeId = await firstActiveType(request)
  requestedAction = await firstActiveRequestedAction(request)
  replyOutcomeId = await firstActiveReplyOutcome(request)

  // --- registros / Detalhes fixture -----------------------------------------
  const regCaseId = await createCase(request, COMM_A, `RDR — caso registros ${RUN_TAG}`, UID_CHEFE_A)
  regReferralId = await draftAndSend(request, chefeA, {
    sourceCaseId: regCaseId,
    targetCommissionId: COMM_B,
    typeId,
    subject: REG_SUBJECT,
    requestedActionId: requestedAction.id,
  })
  await advanceToInReview(request, regReferralId)

  // --- rejected fixture (Phase 3: no seeded referral is `rejected`) ----------
  const rejCaseId = await createCase(request, COMM_A, `RDR — caso recusa ${RUN_TAG}`, UID_CHEFE_A)
  rejectedReferralId = await draftAndSend(request, chefeA, {
    sourceCaseId: rejCaseId,
    targetCommissionId: COMM_B,
    typeId,
    subject: `RDR — recusa com motivo (${RUN_TAG})`,
  })
  const recv = await rpc(request, 'receive_referral', chefeB, { p_referral_id: rejectedReferralId })
  expect(recv.ok(), `receive_referral failed: ${await recv.text()}`).toBeTruthy()
  const decline = await rpc(request, 'decline_referral', chefeB, {
    p_referral_id: rejectedReferralId,
    p_decline_reason_code: 'insufficient_information',
    p_note: 'Observação PHI-gated da recusa (RDR).',
  })
  expect(decline.ok(), `decline_referral failed: ${await decline.text()}`).toBeTruthy()

  // --- thread-events fixture: every event kind the lifecycle can emit, with a
  //     message posted BETWEEN two of them so interleaving is provable ---------
  const evtCaseId = await createCase(request, COMM_A, `RDR — caso eventos ${RUN_TAG}`, UID_CHEFE_A)
  evtReferralId = await draftAndSend(request, chefeA, {
    sourceCaseId: evtCaseId,
    targetCommissionId: COMM_B,
    typeId,
    subject: `RDR — eventos do diálogo (${RUN_TAG})`,
  })
  await advanceToInReview(request, evtReferralId)

  const evtTargetCaseId = await createCase(
    request,
    COMM_B,
    `RDR — caso vinculado destino ${RUN_TAG}`,
    UID_CHEFE_B,
  )
  const link = await rpc(request, 'link_referral_case', chefeB, {
    p_referral_id: evtReferralId,
    p_target_case_id: evtTargetCaseId,
  })
  expect(link.ok(), `link_referral_case failed: ${await link.text()}`).toBeTruthy()

  const msg = await rpc(request, 'post_referral_message', chefeA, {
    p_referral_id: evtReferralId,
    p_message_type: 'general',
    p_body: `Mensagem entre eventos do ciclo (${RUN_TAG}).`,
  })
  expect(msg.ok(), `post_referral_message failed: ${await msg.text()}`).toBeTruthy()

  const assign = await rpc(request, 'assign_referral_reviewer', chefeA, {
    p_referral_id: evtReferralId,
    p_commission_id: COMM_A,
    p_assignee_user_id: UID_STAFF1_A,
    p_assignment_role: 'primary_reviewer',
  })
  expect(assign.ok(), `assign_referral_reviewer failed: ${await assign.text()}`).toBeTruthy()

  const conclude = await rpc(request, 'conclude_referral', chefeB, {
    p_referral_id: evtReferralId,
    p_reply_outcome_id: replyOutcomeId,
    p_result_md: 'Resultado da análise (RDR eventos).',
    p_acknowledged_only: false,
  })
  expect(conclude.ok(), `conclude_referral failed: ${await conclude.text()}`).toBeTruthy()

  const resolve = await rpc(request, 'resolve_referral', chefeA, {
    p_referral_id: evtReferralId,
    p_summary_md: 'Resumo da resolução (RDR eventos).',
    p_follow_up: false,
  })
  expect(resolve.ok(), `resolve_referral failed: ${await resolve.text()}`).toBeTruthy()

  // --- technical-direction fixture (null target commission) ------------------
  const dtCaseId = await createCase(request, COMM_A, `RDR — caso direção técnica ${RUN_TAG}`, UID_CHEFE_A)
  dtReferralId = await draftAndSend(request, chefeA, {
    sourceCaseId: dtCaseId,
    targetCommissionId: null,
    targetHospitalId: HOSPITAL_CENTRAL_A,
    typeId,
    subject: `RDR — direção técnica (${RUN_TAG})`,
  })
})

test.afterAll(() => {
  // Remove ONLY the referrals this file created, BY SUBJECT PREFIX — never
  // positionally, and never a bulk delete of the family.
  //
  // Why cleanup at all, when the sibling referral specs leave theirs behind: the
  // commission hub paginates at 25 rows ordered by recency, so every referral a spec
  // leaks pushes the SEEDED ENC-0001 further down. Past that cliff
  // `phase22-referrals.spec.ts` Flow 1a ("A hub shows ENC-0001") stops finding it and
  // reports a hub regression that is really just accumulated fixture debt — observed
  // on this branch at 45 CCIH-sourced referrals. This file adds four per run and
  // takes them back out.
  //
  // `guard_referral_status` refuses a non-draft delete outside the referral RPCs;
  // `app.in_referral_rpc` is the same deliberate-maintenance escape the RPCs use and
  // is unreachable by `authenticated`.
  sql(
    `begin; set local app.in_referral_rpc = 'on'; ` +
      `delete from public.case_referral where subject like 'RDR %'; commit;`,
  )
  // The seeded fixtures ~900 other tests depend on must SURVIVE that delete — a
  // cleanup that eats a seed row reads as 140 unrelated failures elsewhere.
  expect(
    sql(`select count(*) from public.case_referral where code in ('ENC-0001','ENC-0002');`),
    'the RDR cleanup must not touch the seeded ENC-0001/ENC-0002 fixtures',
  ).toBe('2')

  // RESTORE the flag to what this file FOUND — never force it OFF.
  //
  // ⚠ This is the teardown half of a real gate failure, not hygiene. `case_referrals`
  // is GLOBAL shared state, the prod gate batches many referral specs onto one server,
  // and the seed default (ON) does not reappear between specs of the same batch. An
  // afterAll that forces OFF silently changes the world for every later file in the
  // batch: it took out `technical-direction-referrals.spec.ts` DT-1 in batch 17 and
  // cost 4 did-not-run. `case-patient.spec.ts` and `patient-index.spec.ts` already
  // restore-what-they-found; this now matches them.
  setReferralsFlag(referralsFlagBefore)
})

// ===========================================================================
// REG — "Registros internos" (RDR D6 / ADR 0109), end to end
// ===========================================================================

test('REG-1: the registro kind picker offers the SHARED case vocabulary, with nothing to configure', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${regReferralId}`)

  // KEEP the heading role scope. The disclaimer paragraph directly below also opens
  // with "Registros internos", so a bare getByText would keep passing while anchored
  // on the wrong element — the false-positive-passing rewrite the locator survey §4
  // warns about.
  await expect(page.getByRole('heading', { name: 'Registros internos' })).toBeVisible({
    timeout: 15_000,
  })

  // The per-commission vocabulary (and the dialog that maintained it) is GONE: the
  // kinds are fixed platform-wide, so there is nothing for a coordinator to manage.
  // Asserted for a COORDINATOR — the one viewer the old dialog was ever shown to —
  // so its absence is attributable to the removal and not to a permission gate.
  await expect(page.getByRole('button', { name: 'Tipos de registro' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Adicionar registro' }).click()
  // ⚠ `exact: true` never matches here: `NativeSelect` wraps its `<select>` inside a
  // `<div>` under an IMPLICIT (wrapping, no htmlFor/id) `<label>` — so the label's
  // computed accessible name is its FULL text content, which includes every
  // `<option>`'s text folded in ("TipoNotaReuniãoDecisão…", proven live). The
  // pre-87cd1ddb inline form used explicit `htmlFor`/`id` and never hit this; the same
  // fold already bit `technical-direction-referrals.spec.ts` DT-1 and R4-6's "Tipo de
  // relação" select for the identical reason. `/^Tipo/` anchors on the one field this
  // scope actually has.
  const tipo = registroForm(page).getByLabel(/^Tipo/)
  await expect(tipo).toBeVisible()

  // The exact six manual kinds of the case timeline's "Registros", in picker order —
  // an EXACT list, not a contains: the whole point of this change is that the two
  // surfaces offer the identical vocabulary, which a subset assertion would not catch
  // drifting. `update`/`follow_up` are the two added alongside this change.
  await expect(tipo.getByRole('option')).toHaveText([
    'Nota',
    'Reunião',
    'Decisão',
    'Atualização',
    'Acompanhamento',
    'Outro',
  ])
  // Required, never untyped: there is no empty option and the default is Nota.
  await expect(tipo).toHaveValue('note')
})

test('REG-2: the coordinator files a TYPED registro with an assignee', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${regReferralId}`)

  const panel = registrosPanel(page)
  await expect(panel).toBeVisible({ timeout: 15_000 })
  await expect(panel.getByText('Nenhum registro interno ainda.')).toBeVisible()

  // The composer is behind a toggle — it is not in the DOM until this is clicked.
  await page.getByRole('button', { name: 'Adicionar registro' }).click()
  const form = registroForm(page)
  await expect(form).toBeVisible()

  await form.getByLabel(/^Título/).fill(REG_TITLE)
  // ⚠ `{ exact: true }` never matches "Tipo" here — see REG-1's comment: the wrapping
  // `<label>`'s computed accessible name folds in every `<option>` text of the nested
  // `NativeSelect`. `/^Tipo/` is the anchored, non-exact fix already used for the
  // other selects in this same form.
  await form.getByLabel(/^Tipo/).selectOption(KIND_VALUE)
  await form.getByLabel(/^Responsável/).selectOption(UID_STAFF1_A)
  // ⚠ 87cd1ddb renamed the body field's label "Registro" → "Descrição" and its
  // submit button "Registrar" → "Adicionar" (the DIALOG's create-mode label,
  // `ReferralRegistroDialog`). `exact: true` — not scoping to `form` — is what keeps
  // this from also matching the panel's "Adicionar registro" TRIGGER button, which
  // stays mounted (behind the overlay) while the dialog is open and contains
  // "Adicionar" as a substring.
  await form.getByLabel('Descrição', { exact: true }).fill(REG_BODY)
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()

  const card = panel.locator('li').filter({ hasText: REG_TITLE })
  await expect(card).toBeVisible({ timeout: 15_000 })
  await expect(card.getByRole('heading', { name: REG_TITLE })).toBeVisible()
  await expect(card.getByText(KIND_LABEL)).toBeVisible()
  await expect(card.getByText('Aberto')).toBeVisible()
  // Author + assignee ride the card's meta line. Scoped to it deliberately: the
  // assignee's name ALSO appears on the AssignMenu trigger's label and face, so an
  // unscoped name query strict-mode-violates on 2 elements.
  const meta = card.locator('p').filter({ hasText: 'Chefe CCIH' })
  await expect(meta).toContainText('Chefe CCIH') // author
  await expect(meta).toContainText('Enfermeiro CCIH Um') // assignee
  // The coordinator's assign control reflects the current holder, not "Atribuir".
  await expect(
    card.getByRole('button', { name: `Responsável pelo registro ${REG_TITLE}` }),
  ).toContainText('Enfermeiro CCIH Um')
  // ⚠ 87cd1ddb REVERSED this claim, deliberately (commit bullet 1): "Registros
  // internos" is now PLAIN TEXT end to end — the Markdown editor and
  // MarkdownRenderer are GONE from this surface. The body is interpolated as a React
  // text child with `whitespace-pre-wrap`, which ESCAPES it, so `**markdown**` must
  // now arrive LITERALLY (asterisks and all) rather than parsed into a `<strong>`.
  // Rule 7 (stored-XSS) is satisfied by a DIFFERENT mechanism than before — nothing
  // on this path parses the body as markup at all, which the render-path proof below
  // now inverts to match: the literal syntax stays inert text, and no `<strong>`
  // element is ever created from it.
  await expect(card.getByText(REG_BODY)).toBeVisible()
  await expect(card.locator('strong')).toHaveCount(0)
})

test('REG-3: the ASSIGNEE (not a coordinator) may edit the registro body', async ({ page }) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${regReferralId}`)

  const card = registrosPanel(page).locator('li').filter({ hasText: REG_TITLE })
  await expect(card).toBeVisible({ timeout: 15_000 })
  // A plain member holds no coordinator controls on this registro…
  await expect(card.getByRole('button', { name: /^Tarjar$/ })).toHaveCount(0)
  await expect(card.getByRole('button', { name: /^Atribuir$/ })).toHaveCount(0)
  // …but the assignee arm of the edit gate is hers.
  await card.getByRole('button', { name: `Editar o registro ${REG_TITLE}` }).click()
  // ⚠ 87cd1ddb: "Editar" no longer expands an inline form inside the card's own `<li>`
  // — it opens `ReferralRegistroDialog` (mode="edit"), which Radix renders through a
  // PORTAL appended outside this subtree. A `card`-scoped locator for the form fields
  // or the "Salvar" button now matches ZERO elements; both must be scoped to the
  // dialog instead. The body label is "Descrição" (renamed from "Registro" in the
  // same commit); "Salvar" (edit mode) is unchanged.
  //
  // ⚠ `{ exact: true }` fails here specifically (though it works for the CREATE-mode
  // composer elsewhere in this file) — proven live: the EDIT dialog pre-fills the
  // textarea with the registro's EXISTING body, and a wrapping `<label>`'s computed
  // accessible name folds in that pre-filled text too (the same class of issue as the
  // `NativeSelect` option-folding above, but keyed on the field being non-empty, not
  // on the element type). `/^Descrição/` anchors on the one field this scope has,
  // regardless of what its current value folds in.
  const editDialog = page.getByRole('dialog')
  await expect(editDialog).toBeVisible()
  await expect(editDialog.getByRole('heading', { name: 'Editar registro' })).toBeVisible()
  await editDialog.getByLabel(/^Descrição/).fill(REG_BODY_EDITED)
  await editDialog.getByRole('button', { name: 'Salvar' }).click()
  await expect(editDialog).toBeHidden({ timeout: 15_000 })

  await expect(card.getByText(REG_BODY_EDITED)).toBeVisible({ timeout: 15_000 })
  await expect(card.getByText(REG_BODY)).toHaveCount(0)
})

test('REG-4: the assignee concludes it — the registro FREEZES (no edit, no conclude)', async ({
  page,
}) => {
  await signInAs(page, 'staff1.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${regReferralId}`)

  const panel = registrosPanel(page)
  const card = panel.locator('li').filter({ hasText: REG_TITLE })
  await expect(card).toBeVisible({ timeout: 15_000 })
  await card.getByRole('button', { name: 'Concluir' }).click()

  await expect(card.getByText('Concluído')).toBeVisible({ timeout: 15_000 })
  // Frozen: the one-way lifecycle has no reopen (D10), so both write affordances go.
  await expect(card.getByRole('button', { name: `Editar o registro ${REG_TITLE}` })).toHaveCount(0)
  await expect(card.getByRole('button', { name: 'Concluir' })).toHaveCount(0)
  // …and it moves under the "Concluídos" group the panel partitions by status.
  await expect(panel.getByRole('heading', { name: 'Concluídos' })).toBeVisible()
})

test('REG-5: the side coordinator REDACTS the concluded registro → [redigido]', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${regReferralId}`)

  const card = registrosPanel(page).locator('li').filter({ hasText: REG_TITLE })
  await expect(card).toBeVisible({ timeout: 15_000 })
  // D10: redaction stays available on a CONCLUDED registro — on a frozen record it is
  // the only correction mechanism left (the LGPD escape hatch).
  await card.getByRole('button', { name: /^Tarjar$/ }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Tarjar nota interna' })).toBeVisible()
  await dialog.getByLabel(/Motivo da tarja/).fill('Conteúdo indevido — remoção editorial (RDR).')
  await dialog.getByRole('button', { name: /^Tarjar$/ }).click()
  await expect(dialog).toBeHidden({ timeout: 15_000 })

  await expect(card.getByText('[redigido]')).toBeVisible({ timeout: 15_000 })
  await expect(card.getByText('Tarjado')).toBeVisible()
  // Locator-based absence, not page.content(): the RSC payload can retain the
  // pre-redaction render in inline <script> tags after router.refresh() has already
  // swapped the visible DOM.
  await expect(page.getByText(REG_BODY_EDITED)).toHaveCount(0)
})

test('REG-6: K-R5-1 — the OTHER committee sees none of it (title, body or type)', async ({
  page,
}) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${regReferralId}`)

  const panel = registrosPanel(page)
  await expect(panel).toBeVisible({ timeout: 15_000 })
  // The target side has its OWN (empty) registros surface — not a view of the source's.
  await expect(panel.getByText('Nenhum registro interno ainda.')).toBeVisible()
  await expect(panel.locator('li')).toHaveCount(0)

  // Never server-rendered for this viewer at all, so the raw HTML is the right probe
  // here (unlike a post-redaction check, where the RSC payload lingers).
  const html = await page.content()
  expect(html).not.toContain(REG_TITLE)
  expect(html).not.toContain(REG_BODY_EDITED)
  // ⚠ NOT asserted: the absence of KIND_LABEL. The vocabulary is now shared and
  // fixed, so 'Reunião' is a legitimate option in THIS side's own picker — a
  // not-toContain here would fail on the picker's own markup, not on a leak. The
  // RUN_TAG'd title/body above are what carry the cross-side keystone.

  // The kinds are platform-wide, so the other side's picker offers the SAME six —
  // the mirror of REG-1, proving the vocabulary does not vary by commission.
  await page.getByRole('button', { name: 'Adicionar registro' }).click()
  // Same `{ exact: true }` fold as REG-1 — see its comment.
  const tipo = registroForm(page).getByLabel(/^Tipo/)
  await expect(tipo).toBeVisible()
  await expect(tipo.getByRole('option')).toHaveText([
    'Nota',
    'Reunião',
    'Decisão',
    'Atualização',
    'Acompanhamento',
    'Outro',
  ])
})

// ===========================================================================
// DET — the rail "Detalhes" card (RDR D1 + A10)
// ===========================================================================

test('DET-1: the Detalhes card carries every fact the header shed, with real values', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${regReferralId}`)

  const details = detailsCard(page)
  await expect(details).toBeVisible({ timeout: 15_000 })

  await expect(detailsRow(page, 'De')).toContainText(COMM_A_NAME)
  // A10 — the requested action kept a home here after the header chip tail was cut.
  await expect(detailsRow(page, 'Ação solicitada')).toContainText(requestedAction.label)
  await expect(detailsRow(page, 'Status')).toContainText('Em análise')
  await expect(detailsRow(page, 'Criado')).toContainText('por Chefe CCIH')
  await expect(detailsRow(page, 'Criado')).toContainText(/\d{2}\/\d{2}\/\d{4}/)
  // ⚠ 87cd1ddb trimmed this card to EXACTLY De / Ação solicitada / Prioridade /
  // Criado / Prazo de resposta / Status — "Para" and the Enviado/Recebido/Decidido/
  // Concluído/Retirado timestamp rows are GONE from the component entirely (not
  // conditionally hidden for THIS referral; the card no longer renders them for ANY
  // referral). Every one of those moments is now narrated instead by the Diálogo's
  // synthesized system rows (EVT-1 proves that surface), so this card-focused test no
  // longer asserts on them here.

  // Null rows are HIDDEN outright rather than rendered as an em dash: this referral
  // was never concluded/withdrawn/declined or declined.
  await expect(details.getByText('Motivo da recusa', { exact: true })).toHaveCount(0)

  // ⚠ 87cd1ddb: the deadline row now survives an EMPTY deadline whenever the VIEWER
  // may set one — "otherwise 'Definir prazo' would have nowhere to live for the
  // referral that most needs it" (`referral-details-card.tsx`). chefe.ccih is the
  // SOURCE coordinator and regReferralId is `in_review` (a deadline-editable status
  // — `deadline-gate.ts`), so `canSetDeadline` is true here: the row renders with
  // "Sem prazo definido" plus the "Definir prazo" control, rather than being hidden.
  // The pre-87cd1ddb "hidden because no value" premise only held when the row was
  // keyed on the value alone.
  await expect(details.getByText('Prazo de resposta', { exact: true })).toBeVisible()
  await expect(detailsRow(page, 'Prazo de resposta')).toContainText('Sem prazo definido')
  await expect(details.getByRole('button', { name: /definir prazo/i })).toBeVisible()

  // D1: the header keeps ONLY the code, subject and the Status + Type chips — the
  // facts above must NOT be duplicated back into it.
  const header = page.locator('header').first()
  await expect(header.getByRole('heading', { level: 1 })).toContainText(REG_SUBJECT)
  await expect(header.getByText('Ação solicitada')).toHaveCount(0)
  await expect(header.getByText(COMM_B_NAME)).toHaveCount(0)
})

test('DET-2: a REJECTED referral shows "Motivo da recusa" in the card, PHI note withheld', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${rejectedReferralId}`)

  const details = detailsCard(page)
  await expect(details).toBeVisible({ timeout: 15_000 })
  await expect(detailsRow(page, 'Status')).toContainText('Recusada')
  // Label and value are separate elements now — the pre-RDR single-regex
  // "Motivo da recusa: <value>" shape cannot be reused.
  await expect(details.getByText('Motivo da recusa', { exact: true })).toBeVisible()
  await expect(detailsRow(page, 'Motivo da recusa')).toContainText('Informações insuficientes')
  // ⚠ 87cd1ddb removed the "Decidido" row from this card along with the rest of the
  // lifecycle-timestamp ledger (see DET-1) — the decline's timestamp is now carried
  // only by the Diálogo's synthesized "decided_declined" event row, not here.

  // The structured reason is PHI-free and travels; the decline NOTE does not.
  expect(await page.content()).not.toContain('Observação PHI-gated da recusa')
})

test('DET-3: BOTH sides render side-correct content (the side-derivation regression)', async ({
  page,
}) => {
  // --- SOURCE side (CCIH) ---------------------------------------------------
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${regReferralId}`)
  await expect(detailsCard(page)).toBeVisible({ timeout: 15_000 })

  // "De" is an ABSOLUTE fact — identical on both sides, never relative to the viewer.
  // ⚠ 87cd1ddb removed "Para" from this card entirely (see DET-1) — it is no longer
  // assertable here on either side; the destination now surfaces only via the
  // Diálogo's "Encaminhado para" event row (EVT-1 covers that surface).
  await expect(detailsRow(page, 'De')).toContainText(COMM_A_NAME)

  // The CASE CARD is what is side-derived (A12): the sending side is not "reviewing"
  // its own case, so it reads "Caso de origem" and shows its originating case.
  await expect(page.getByRole('region', { name: 'Caso de origem' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Caso em análise' })).toHaveCount(0)

  // --- TARGET side (Farmácia) ----------------------------------------------
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${regReferralId}`)
  await expect(detailsCard(page)).toBeVisible({ timeout: 15_000 })

  await expect(detailsRow(page, 'De')).toContainText(COMM_A_NAME)

  const targetCard = page.getByRole('region', { name: 'Caso em análise' })
  await expect(targetCard).toBeVisible()
  await expect(page.getByRole('region', { name: 'Caso de origem' })).toHaveCount(0)
  // No case linked yet → the empty state points at the real control instead of
  // duplicating it.
  await expect(targetCard.getByText('Nenhum caso vinculado ainda.')).toBeVisible()
  // ⚠ 87cd1ddb moved "Vincular caso" FROM "Ações" INTO this very card's header (so the
  // act of linking sits on the card that shows the link). The empty-state hint text
  // below ALSO says '...Use "Vincular caso" para associar...', so a bare
  // `getByText(/Vincular caso/)` now strict-mode-violates on 2 matches (the hint
  // paragraph AND the button) — a collision this refactor introduced by putting the
  // control where the hint used to stand alone. Scope to the BUTTON role, which the
  // hint paragraph's `<p>` does not carry.
  await expect(targetCard.getByRole('button', { name: 'Vincular caso' })).toBeVisible()
  await expect(targetCard.getByRole('link', { name: 'Abrir registro do caso' })).toHaveCount(0)
})

test('DET-4: a technical-direction referral composes its destination and shows no target case card', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${dtReferralId}`)

  const details = detailsCard(page)
  await expect(details).toBeVisible({ timeout: 15_000 })
  await expect(detailsRow(page, 'De')).toContainText(COMM_A_NAME)
  // ⚠ 87cd1ddb removed "Para" from the Detalhes card entirely (see DET-1).
  // `target_commission_id` is NULL on an ADR 0094 W4 referral; the query layer's
  // composed Diretor Técnico name (never a dereference of the null id — see
  // `src/lib/queries/referrals.ts`) now surfaces only through the Diálogo's
  // synthesized "sent" event ("Encaminhado para …" — `thread-events.ts`'s
  // `targetName` ← `targetCommissionName`, `referral-thread-event.tsx`'s `describe`).
  const thread = page.getByRole('region', { name: 'Diálogo' })
  await expect(thread).toBeVisible({ timeout: 15_000 })
  await expect(thread.locator('li[data-thread-event="sent"]')).toContainText(/Direção Técnica/)

  await expect(page.getByRole('region', { name: 'Caso de origem' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Caso em análise' })).toHaveCount(0)
})

// ===========================================================================
// CASE — the side case card's TWO states (RDR D3 as amended by A12) + the
// five-group access roster (A7)
// ===========================================================================

test('CASE-1: a member WITHOUT case access gets the refusal + the grouped roster dialog', async ({
  page,
}) => {
  // staff2.farm is a plain Farmácia member: on the target side of ENC-0001 she can
  // read the REFERRAL but not the linked CASE — a referral case link is a POINTER and
  // grants nothing (A7: plain membership does not confer `read_case_content`).
  await signInAs(page, 'staff2.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${ENC1_ID}`)

  const card = page.getByRole('region', { name: 'Caso em análise' })
  await expect(card).toBeVisible({ timeout: 15_000 })
  await expect(card.getByText(ENC1_CASE_LABEL)).toBeVisible()

  // A12 — two STATES, not one button that lies about what it opens.
  await expect(card.getByText('Você não tem acesso a este caso.')).toBeVisible()
  await expect(card.getByRole('link', { name: 'Abrir registro do caso' })).toHaveCount(0)

  await card.getByRole('button', { name: 'Quem tem acesso?' }).click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByRole('heading', { name: `Quem tem acesso a ${ENC1_CASE_LABEL}` }),
  ).toBeVisible()

  // The two groups this fixture genuinely populates, with the exact names the audited
  // door returns — not merely "a dialog opened".
  await expect(dialog.getByRole('heading', { name: 'Coordenadores' })).toBeVisible()
  await expect(
    dialog.locator('section').filter({ hasText: 'Coordenadores' }).getByRole('listitem'),
  ).toHaveText(['Chefe Farmácia'])
  await expect(dialog.getByRole('heading', { name: 'Segurança do paciente' })).toBeVisible()
  await expect(
    dialog.locator('section').filter({ hasText: 'Segurança do paciente' }).getByRole('listitem'),
  ).toHaveText(['Administradora Geral', 'Coordenador NSP A1', 'NSP Central A', 'NSP Dual A'])

  // Empty groups are HIDDEN — an empty heading would assert "nobody here has access",
  // which the door never claims.
  await expect(dialog.getByRole('heading', { name: 'Acesso concedido' })).toHaveCount(0)
  await expect(dialog.getByRole('heading', { name: 'Atribuídos' })).toHaveCount(0)
  await expect(dialog.getByRole('heading', { name: 'Qualidade' })).toHaveCount(0)

  // Names only — no reason, no expiry, no patient identifier (PHI-free by contract).
  expect(await page.content()).not.toContain('PRT-0099123')
})

test('CASE-2: a member WITH case access gets a link that lands on /casos/{caseId}', async ({
  page,
}) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${ENC1_ID}`)

  const card = page.getByRole('region', { name: 'Caso em análise' })
  await expect(card).toBeVisible({ timeout: 15_000 })
  // The other A12 state: a real link, and NOT the roster affordance.
  await expect(card.getByText('Você não tem acesso a este caso.')).toHaveCount(0)
  await expect(card.getByRole('button', { name: 'Quem tem acesso?' })).toHaveCount(0)

  const open = card.getByRole('link', { name: 'Abrir registro do caso' })
  await expect(open).toHaveAttribute(
    'href',
    `/o/rede-a/c/farmacia/casos/${ENC1_TARGET_CASE_ID}`,
  )
  await open.click()
  await page.waitForURL(`**/o/rede-a/c/farmacia/casos/${ENC1_TARGET_CASE_ID}`, {
    timeout: 15_000,
  })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })
})

// ===========================================================================
// EVT — D7: synthesized lifecycle rows interleave with the message bubbles
// ===========================================================================

test('EVT-1: system rows interleave with messages in ONE time-ordered Diálogo', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${evtReferralId}`)

  const thread = page.getByRole('region', { name: 'Diálogo' })
  await expect(thread).toBeVisible({ timeout: 15_000 })

  // Both row kinds are `<li>`s; only `data-thread-row` tells them apart.
  const rows = thread.locator('li[data-thread-row]')
  const sequence = await rows.evaluateAll((els) =>
    els.map((el) =>
      el.getAttribute('data-thread-row') === 'event'
        ? `event:${el.getAttribute('data-thread-event')}`
        : 'message',
    ),
  )

  // The lifecycle order the fixture drove, with the message landing between the
  // case link and the assignment — that ordering IS the interleaving claim.
  expect(sequence).toEqual([
    'event:sent',
    'event:received',
    'event:decided_accepted',
    'event:case_linked',
    'message',
    'event:assignment',
    'event:concluded',
    'event:resolution',
  ])

  // The rows say what happened, in pt-BR, without inventing a body.
  const eventRows = thread.locator('li[data-thread-row="event"]')
  await expect(eventRows.filter({ hasText: 'Encaminhado para' })).toContainText(COMM_B_NAME)
  await expect(
    thread.locator('li[data-thread-event="decided_accepted"]'),
  ).toContainText('Aceito pela comissão de destino')
  await expect(thread.locator('li[data-thread-event="assignment"]')).toContainText(
    'Enfermeiro CCIH Um designado como Revisor(a) principal',
  )
  await expect(thread.locator('li[data-thread-event="resolution"]')).toContainText(
    'Resolução 1 registrada por Chefe CCIH',
  )
  // The case-link row has no stored timestamp — the UI states the approximation
  // rather than implying a precise moment.
  await expect(thread.locator('li[data-thread-event="case_linked"]')).toContainText('· após ')

  // The message bubble is still a message: sender committee + sequence number.
  const message = thread.locator('li[data-thread-row="message"]')
  await expect(message).toHaveCount(1)
  await expect(message).toContainText('#1')
  await expect(message).toContainText(COMM_A_NAME)
})

// ===========================================================================
// KB — keyboard-only paths (repo a11y rule, at least one per phase)
// ===========================================================================

test('KB-1: keyboard-only — the Diálogo composer sends with Ctrl+Enter (D8)', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${regReferralId}`)

  const thread = page.getByRole('region', { name: 'Diálogo' })
  const composer = thread.locator('form')
  // BUG-P22-002: `.focus()` is NOT auto-waiting — gate on visibility first, or it
  // silently no-ops against RSC streaming and reads like a focus-management defect.
  await expect(composer).toBeVisible({ timeout: 15_000 })

  const textarea = composer.locator('textarea')
  await textarea.focus()
  await expect(textarea).toBeFocused()
  await page.keyboard.type(`Mensagem enviada com Ctrl+Enter (${RUN_TAG}).`)
  await page.keyboard.press('Control+Enter')

  await expect(thread.getByText(`Mensagem enviada com Ctrl+Enter (${RUN_TAG}).`)).toBeVisible({
    timeout: 15_000,
  })
  // The accelerator SENDS; it must not also leave the typed text behind in the box.
  await expect(textarea).toHaveValue('')
})

test('KB-2: keyboard-only — the access dialog opens on Enter, traps focus, closes on Esc', async ({
  page,
}) => {
  await signInAs(page, 'staff2.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${ENC1_ID}`)

  const trigger = page
    .getByRole('region', { name: 'Caso em análise' })
    .getByRole('button', { name: 'Quem tem acesso?' })
  await expect(trigger).toBeVisible({ timeout: 15_000 })

  await trigger.focus()
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  // The trap: focus moved INTO the dialog, and tabbing never leaves it.
  await expect(dialog.locator(':focus')).toHaveCount(1)
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab')
  await expect(dialog.locator(':focus')).toHaveCount(1)
  // The roster is reachable without a mouse — the names, not just the shell.
  await expect(dialog.getByText('Chefe Farmácia')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden({ timeout: 10_000 })

  // BUG-RDR-001 (fixed) — closing a controlled dialog must return focus to its
  // trigger, not drop it to `<body>`. Formerly pinned as a separate `test.fail()`
  // spec (KB-3) while the defect was open platform-wide (Radix's `onCloseAutoFocus`
  // + `preventDefault()` combo only restores to a `DialogPrimitive.Trigger`, and
  // this dialog — like 20+ others — drives `<Dialog open onOpenChange>` from its own
  // `<Button onClick>` instead); folded back into KB-2 per that test's own
  // instruction now that the shared fix (`src/components/ui/dialog.tsx`) lands.
  await expect(trigger).toBeFocused()
})
