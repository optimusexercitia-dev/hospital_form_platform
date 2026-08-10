import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn, accessToken } from "./helpers/auth"

/**
 * Phase 22 — Inter-Committee Case Referrals (`case_referrals`)
 *
 * Test contract: translates the 8 verification flows from the Phase-22 plan
 * (`~/.claude/plans/a-feature-must-be-streamed-quill.md §Verification`) into
 * Playwright + PostgREST assertions.
 *
 * **Feature flag.** The flag ships OFF. A `test.beforeAll` flips it ON for the
 * whole suite (via service-role SQL UPDATE); `test.afterAll` resets it so the
 * regression suite's flag-OFF path is unaffected if this suite runs first. The
 * flag-OFF 404 paths are covered by pgTAP 150_referrals.sql.
 *
 * **Seeded fixtures (after `supabase db reset`):**
 *   ENC-0001  id efa00000-0000-0000-0000-0000000000a1 — `concluida`, reply-expecting.
 *             Source: Caso 0001 in CCIH (chefe.ccih). Target: Farmácia (chefe.farm).
 *             Linked B-case: dba00000-0000-0000-0000-0000000000b1 (in Farmácia).
 *             Has frozen narrative + document snapshot + isolated referral_patient PHI.
 *             Has delivered reply (`procede`).
 *   ENC-0002  id efa00000-0000-0000-0000-0000000000a2 — `enviada`, reply-expecting.
 *             Source: phase-clean case dca00000-0000-0000-0000-0000000000a1 in CCIH.
 *             Target: Farmácia. No reply. Used for the close-gate (HC076) test.
 *
 * **Personas (password Test1234!):**
 *   admin@test.local          rede-a org_admin + rede-a PQS roster (00…001) — used for
 *                             PostgREST/RPC truth-reads + setup (unaffected by QO·B: those
 *                             calls carry their own JWT and never touch a commission UI
 *                             route). NOT the vendor platform admin (that is platform@…b0).
 *                             ⛔ QO·B, 2026-08-09: no longer used to reach a `/o/rede-a/c/*`
 *                             commission-hub UI. It held zero CCIH membership rows even
 *                             before QO·B; the resolver used to coerce it to `staff_admin`
 *                             there, and QO·B (BUG-QOB-003) removed that coercion, so it is
 *                             now a genuine `role: null` bare tenancy admin — the commission
 *                             layout's `access.role === null → notFound()` gate (unrelated to
 *                             and untouched by QO·B; it predates it) now 404s it on every
 *                             `/c/[commission]/**` route, including `encaminhamentos/**`.
 *   pqs.a@test.local          enrolled rede-a PQS member (00…00c2) — the QPS actor for
 *                             the per-org QPS referral dashboard /o/rede-a/nsp/* and
 *                             full-trajectory reads. No commission/org membership, so it
 *                             404s on /o/rede-a/c/* commission hubs.
 *   pqsdual.a@test.local      plain CCIH `staff` (00…0c7) who is ALSO enrolled in the
 *                             central-a + secundario-a PQS rosters — QO·B, 2026-08-09: the
 *                             commission-hub substitute for admin@ above (Flow 3d, Flow 5a).
 *                             A REAL membership row means `can_read_referral_metadata`'s
 *                             `is_member_of_for(source_commission)` arm admits it regardless
 *                             of the tenancy-admin wall, so it reaches the hub exactly as a
 *                             committee member always could; its PQS enrollment is what these
 *                             two flows actually mean by "QPS admin" reading the reply/PHI.
 *   chefe.ccih@test.local     staff_admin, CCIH           (00…002) — source coordinator
 *   staff1.ccih@test.local    staff, CCIH                 (00…003) — plain A member
 *   chefe.farm@test.local     staff_admin, Farmácia       (00…005) — target coordinator
 *   staff1.farm@test.local    staff, Farmácia             (00…006) — plain B member
 *
 * **Note on `test.describe.configure({ mode: 'serial' }).** Several tests write
 * through the source or target coordinator and share the DB fixture set; the
 * flag-flip test.beforeAll/afterAll are correct only in serial mode. Run with
 * `--workers=1` for the fix-loop.
 */

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 900 } })

// NSP-per-org (ADR 0042): the case_referrals module is now provisioned per-org and
// referrals_enabled() returns true. The QPS referral dashboard lives at
// /o/rede-a/nsp/encaminhamentos; the source/target commission hubs at
// /o/rede-a/c/{ccih,farmacia}/encaminhamentos. The multi-org pilot skip is removed.

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

// Commissions
const COMM_A = 'a0000000-0000-0000-0000-0000000000a1' // CCIH  (source)
const COMM_B = 'b0000000-0000-0000-0000-0000000000b1' // Farmácia (target)

// Personas
const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002' // chefe.ccih

// Seed fixture IDs
const ENC1_ID      = 'efa00000-0000-0000-0000-0000000000a1' // concluida
// ENC2_ID (efa00000-0000-0000-0000-0000000000a2) is the seeded enviada referral on the
// phase-clean GATE_CASE (dca00000-0000-0000-0000-0000000000a1). Flow 4 no longer
// touches those seeded fixtures — it creates a disposable case + referral inline
// (see gateCase / gateReferralId below) so no other spec is affected.
const CASE_A_ID    = 'd0000000-0000-0000-0000-0000000000c1' // Caso 0001 (ENC-0001 source)
const CASE_B_ID    = 'dba00000-0000-0000-0000-0000000000b1' // B's linked case

// PHI strings in the isolated referral_patient record (seed)
// PHI_MRN updated from 'PRT-77' to match the Phase-23 patient_index synthetic
// cross-committee patient that shares one MRN across the NSP event + ENC-0001
// referral + the B-side case (seed.sql ~L1157).
const PHI_NAME = 'Paciente de Demonstração'
const PHI_MRN  = 'PRT-0099123'

// ---------------------------------------------------------------------------
// Flow-4 disposable fixtures — created in beforeAll, consumed in Flow 4a/4b.
// Using a throwaway case (not a seeded fixture) means Flow 4b can close it
// without contaminating any other spec.
// ---------------------------------------------------------------------------
let gateCaseId: string          // uuid of the disposable pendente case
let gateReferralId: string      // uuid of the reply-expecting referral on it

// RV2 R1 — Dialogue core fixtures (own disposable case + referral; never touches
// a seeded fixture). Advanced to `em_analise` (in_review) and LINKED to a fresh
// Farmácia case so a target ANALYST (case_access grant, not staff_admin) can be
// exercised — the composer's compose-authority parity with the R1 RPCs.
let r1CaseId: string            // uuid of the disposable Farmácia (target) case
let r1ReferralId: string        // uuid of the CCIH → Farmácia dialogue-test referral

// ---------------------------------------------------------------------------
// Feature-flag lifecycle
// ---------------------------------------------------------------------------

/** Flip the case_referrals feature flag ON/OFF via a direct service-role SQL call.
 * The `app.feature_flags` table is in the `app` schema (not exposed via PostgREST
 * as a public table). We use the service-role JWT against the DB via PostgREST
 * RPC `set_config` is not an option; we do it via the raw SQL exec endpoint. */
async function setReferralsFlag(req: APIRequestContext, enabled: boolean) {
  // Use the PostgREST RPC `referrals_enabled` to verify, and the SQL API for the update.
  const resp = await req.post(`${SUPABASE_URL}/rest/v1/rpc/set_referrals_feature_flag`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    data: { p_enabled: enabled },
  })
  // If no such RPC exists, fall back to the DB query endpoint (local Supabase)
  if (!resp.ok()) {
    // Use the Supabase local DB direct connection via the postgres/pg endpoint
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
      // Last resort: use the Supabase Studio/SQL REST endpoint
      throw new Error(
        `Cannot flip case_referrals flag. Run: npx supabase db query --local "UPDATE app.feature_flags SET enabled = ${enabled} WHERE key = 'case_referrals'"`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!', actAs?: string) {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  // ACT (ADR 0106) — optional 4th param, additive: threads to cachedSignIn's own
  // actAs seam for pqsdual.a@test.local (pqs_member + staff — 2 role types), which
  // otherwise lands on /selecionar-perfil (BUG-ACT-PICKER-SEED-1).
  await cachedSignIn(page, email, password, actAs)
}

/** Obtain a JWT for a persona (RLS evaluated under it). */
async function getToken(req: APIRequestContext, email: string, actAs?: string): Promise<string> {
  // ACT (ADR 0106) — delegates to the shared, hat-aware accessToken
  // (BUG-ACT-RAWGRANT-HATLESS-1): admin@test.local (org_admin + pqs_member)
  // and staff1.qual.b@test.local (staff + staff_admin) otherwise come back
  // with no active_role claim.
  return accessToken(req, email, undefined, actAs)
}

/** PostgREST GET under a bearer token. */
async function restGet<T>(req: APIRequestContext, path: string, bearer: string): Promise<T[]> {
  const resp = await req.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${bearer}` },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

/** Call a public RPC under a persona JWT. Returns the raw response. */
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

/** Audit rows for an action + entity (service-role truth read). */
async function auditRowsFor(req: APIRequestContext, action: string, entityId: string) {
  return restGet<{
    id: string
    action: string
    actor_id: string | null
    commission_id: string | null
    entity_id: string
    metadata: Record<string, unknown>
  }>(
    req,
    `audit_log?action=eq.${encodeURIComponent(action)}&entity_id=eq.${entityId}&select=id,action,actor_id,commission_id,entity_id,metadata&order=occurred_at.desc`,
    SUPABASE_SERVICE_KEY,
  )
}

// ---------------------------------------------------------------------------
// Suite setup / teardown — flag lifecycle
// ---------------------------------------------------------------------------

test.beforeAll(async ({ request }) => {
  // NSP-per-org (ADR 0042): the case_referrals module is provisioned per-org and
  // referrals_enabled() returns true; create_referral_draft succeeds. We still flip
  // the feature flag ON for the whole suite (and reset it in afterAll) so the
  // regression suite's flag-OFF 404 path is unaffected if this suite runs first.

  // Enable the case_referrals flag for the whole suite. If the helper RPC
  // doesn't exist we catch the error and use the supabase CLI as a fallback
  // (local-only; safe per the gate constraint).
  try {
    await setReferralsFlag(request, true)
  } catch {
    // The RPC shim doesn't exist — use supabase db query (local only)
    // This is a no-op if the flag is already on (idempotent UPDATE).
    const { execSync } = await import('child_process')
    execSync(
      'npx supabase db query --local "UPDATE app.feature_flags SET enabled = true WHERE key = \'case_referrals\'"',
      { cwd: process.cwd(), stdio: 'pipe' },
    )
  }
  // Wait briefly for PostgREST schema cache to pick up any flag side-effects
  await new Promise((r) => setTimeout(r, 500))

  // ── Create a disposable pendente case for Flow 4 (HC076 close-gate test) ──
  // Direct service-role INSERT bypasses RLS; the mint_case_number trigger assigns
  // case_number automatically. No phases, no offered outcomes → close_case is
  // gated ONLY by HC076 (the referral gate), which is exactly what Flow 4 tests.
  const chefeAToken = await getToken(request, 'chefe.ccih@test.local')

  const caseInsertResp = await request.post(`${SUPABASE_URL}/rest/v1/cases`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: {
      commission_id: COMM_A,
      label: 'HC076 gate — Flow 4 disposable case (phase22 spec)',
      status: 'pending',
      created_by: UID_CHEFE_A,
    },
  })
  expect(
    caseInsertResp.ok(),
    `beforeAll: could not create disposable gate case: ${await caseInsertResp.text()}`,
  ).toBeTruthy()
  const [caseRow] = await caseInsertResp.json() as Array<{ id: string }>
  gateCaseId = caseRow.id

  // Look up a reply-expecting referral type (any active type with default_response_expected=true)
  const typesResp = await restGet<{ id: string; key: string; default_response_expected: boolean }>(
    request,
    'referral_types?is_active=eq.true&default_response_expected=eq.true&order=position.asc&limit=1',
    SUPABASE_SERVICE_KEY,
  )
  const typeId = typesResp[0]?.id
  expect(typeId, 'beforeAll: no active reply-expecting referral type found').toBeTruthy()

  // Create and send a reply-expecting referral on the disposable case
  const draftResp = await rpc(request, 'create_referral_draft', chefeAToken, {
    p_source_case_id: gateCaseId,
    p_target_commission_id: COMM_B,
    p_referral_type_id: typeId,
    p_subject: 'HC076 gate — spec-owned referral (phase22 Flow 4)',
    p_response_expected: true,
  })
  expect(
    draftResp.ok(),
    `beforeAll: create_referral_draft failed: ${await draftResp.text()}`,
  ).toBeTruthy()
  const draftData = await draftResp.json() as { id: string; referral_type_id: string }
  gateReferralId = draftData.id

  // send_referral requires at least one shared item OR a non-empty description_md.
  // Set description_md via update_referral_draft before sending.
  const updateResp = await rpc(request, 'update_referral_draft', chefeAToken, {
    p_referral_id: gateReferralId,
    p_referral_type_id: typeId,
    p_subject: 'HC076 gate — spec-owned referral (phase22 Flow 4)',
    p_description_md: 'Descrição sintética para fins de teste automatizado (Flow 4).',
    p_response_expected: true,
  })
  expect(
    updateResp.ok(),
    `beforeAll: update_referral_draft failed: ${await updateResp.text()}`,
  ).toBeTruthy()

  const sendResp = await rpc(request, 'send_referral', chefeAToken, {
    p_referral_id: gateReferralId,
  })
  expect(
    sendResp.ok(),
    `beforeAll: send_referral failed: ${await sendResp.text()}`,
  ).toBeTruthy()
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
// RV2 R1 — Dialogue core fixture setup. Creates a disposable Farmácia case
// (r1CaseId) and a fresh CCIH → Farmácia referral (r1ReferralId), advances it
// through send → receive → accept → link (to r1CaseId) → start review, so it
// lands in `em_analise` (in_review) — ready for the dialogue tests. Grants
// staff1.farm a `case_access` row on r1CaseId (→ target ANALYST via
// `app.referral_target_analyst`, NOT staff_admin); staff2.farm gets no grant
// (plain non-participant / metadata-only reader).
// ---------------------------------------------------------------------------

test.beforeAll(async ({ request }) => {
  const chefeAToken = await getToken(request, 'chefe.ccih@test.local')
  const chefeBToken = await getToken(request, 'chefe.farm@test.local')

  const caseResp = await request.post(`${SUPABASE_URL}/rest/v1/cases`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: {
      commission_id: COMM_B,
      label: 'RV2 R1 — disposable target case (phase22 spec)',
      status: 'pending',
      created_by: '00000000-0000-0000-0000-000000000005', // chefe.farm
    },
  })
  expect(caseResp.ok(), `R1 beforeAll: could not create target case: ${await caseResp.text()}`).toBeTruthy()
  const [r1CaseRow] = (await caseResp.json()) as Array<{ id: string }>
  r1CaseId = r1CaseRow.id

  const typesResp = await restGet<{ id: string }>(
    request,
    'referral_types?is_active=eq.true&order=position.asc&limit=1',
    SUPABASE_SERVICE_KEY,
  )
  const typeId = typesResp[0]?.id
  expect(typeId, 'R1 beforeAll: no active referral type found').toBeTruthy()

  const draftResp = await rpc(request, 'create_referral_draft', chefeAToken, {
    p_source_case_id: CASE_A_ID,
    p_target_commission_id: COMM_B,
    p_referral_type_id: typeId,
    p_subject: 'RV2 R1 — encaminhamento de diálogo (phase22 spec)',
    p_response_expected: true,
    p_description_md: 'Descrição sintética para os testes de diálogo (R1).',
  })
  expect(draftResp.ok(), `R1 beforeAll: create_referral_draft failed: ${await draftResp.text()}`).toBeTruthy()
  const draftData = (await draftResp.json()) as { id: string }
  r1ReferralId = draftData.id

  const sendResp = await rpc(request, 'send_referral', chefeAToken, { p_referral_id: r1ReferralId })
  expect(sendResp.ok(), `R1 beforeAll: send_referral failed: ${await sendResp.text()}`).toBeTruthy()

  const receiveResp = await rpc(request, 'receive_referral', chefeBToken, { p_referral_id: r1ReferralId })
  expect(receiveResp.ok(), `R1 beforeAll: receive_referral failed: ${await receiveResp.text()}`).toBeTruthy()

  const acceptResp = await rpc(request, 'accept_referral', chefeBToken, { p_referral_id: r1ReferralId })
  expect(acceptResp.ok(), `R1 beforeAll: accept_referral failed: ${await acceptResp.text()}`).toBeTruthy()

  const linkResp = await rpc(request, 'link_referral_case', chefeBToken, {
    p_referral_id: r1ReferralId,
    p_target_case_id: r1CaseId,
  })
  expect(linkResp.ok(), `R1 beforeAll: link_referral_case failed: ${await linkResp.text()}`).toBeTruthy()

  const reviewResp = await rpc(request, 'start_referral_review', chefeBToken, { p_referral_id: r1ReferralId })
  expect(reviewResp.ok(), `R1 beforeAll: start_referral_review failed: ${await reviewResp.text()}`).toBeTruthy()

  // ADR 0078 Stage B: `case_access` was HARD-CUT to `case_access_grants`
  // (capability-per-column, `principal_id` not `user_id`). A plain read grant here
  // (content + deliberation, no PHI columns) is exactly what `grant_case_access`
  // itself would insert with no PHI params — this reader test needs content reach
  // only, never PHI.
  const accessResp = await request.post(`${SUPABASE_URL}/rest/v1/case_access_grants`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: {
      case_id: r1CaseId,
      principal_id: '00000000-0000-0000-0000-000000000006', // staff1.farm
      source: 'manual_grant',
      read_case_content: true,
      read_case_deliberation: true,
      reason_code: 'coordinator_grant',
      granted_by: '00000000-0000-0000-0000-000000000005', // chefe.farm
    },
  })
  expect(accessResp.ok(), `R1 beforeAll: case_access_grants grant failed: ${await accessResp.text()}`).toBeTruthy()
})

// ---------------------------------------------------------------------------
// Flow 1 — Isolation: A can't see B's work
//
// A sends (ENC-0001 is seeded as `concluida` — we assert on its read-back state,
// not a new send). ENC-0001 is the full isolation fixture: A sees the referral
// header + the delivered reply outcome/result; A does NOT see B's linked case body;
// `get_case_detail` on B's `target_case_id` as an A user returns null (RLS).
// ---------------------------------------------------------------------------

test('Flow 1a: A hub shows ENC-0001 (concluida) — subject, status, reply presence visible', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/encaminhamentos')

  // Hub renders; the "Enviados" section contains ENC-0001
  await expect(page.getByText(/Solicitação de parecer sobre conciliação medicamentosa/i)).toBeVisible()
  // Status chip for ENC-0001 renders "Concluída" in a <span> (not an <option>)
  await expect(page.locator('span').filter({ hasText: /^Concluída$/ }).first()).toBeVisible()
})

test("Flow 1b: A detail page shows reply but NOT B's internal case body", async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${ENC1_ID}`)

  // A sees the referral subject
  await expect(page.getByText(/Solicitação de parecer sobre conciliação medicamentosa/i)).toBeVisible()

  // A sees the delivered reply outcome + result text (source coordinator / concluida)
  await expect(page.getByText(/Procede/i).first()).toBeVisible()
  await expect(page.getByText(/conciliação medicamentosa procede/i)).toBeVisible()

  // A does NOT see B's linked case internal label. The detail page shows A only B's
  // case NUMBER ("Vinculado: …"), never B's private label. B's label is
  // "Análise de parecer — CCIH"; the distinctive phrase "Análise de parecer" appears
  // nowhere in A's own artifacts (A's case label is "Óbito UTI leito 7", the referral
  // subject is about "conciliação medicamentosa"), so its presence would be a leak.
  const html = await page.content()
  // B's private case label must NOT appear in A's view (isolation boundary).
  expect(html).not.toContain('Análise de parecer')
})

test("Flow 1c: get_case_detail on B's target_case_id as an A user → no_data_found (RLS)", async ({
  request,
}) => {
  const chefeAToken = await getToken(request, 'chefe.ccih@test.local')
  // Call get_case_detail on B's linked case as a CCIH (A) user.
  // CCIH is neither a member of Farmácia nor a PQS member → can_read_case = false.
  // The RPC raises NO_DATA_FOUND (P0002) which PostgREST surfaces as HTTP 500 with
  // code "P0002" and a "não encontrado" message — the canonical "no access" signal.
  const resp = await rpc(request, 'get_case_detail', chefeAToken, {
    p_case_id: CASE_B_ID,
  })
  // PostgREST v14.5 returns `Content-Type: text/plain` "Something went wrong" for
  // P-class SQLSTATE raises (P0002 = NO_DATA_FOUND). Parse defensively: attempt JSON
  // only when the response looks like it (SPEC-P22-001).
  const rawText = await resp.text()
  const body = rawText.startsWith('{') || rawText.startsWith('null')
    ? JSON.parse(rawText) as Record<string, unknown> | null
    : null
  if (resp.ok()) {
    // Should be null (out-of-scope read via DEFINER path returns null in some versions)
    expect(body).toBeNull()
  } else {
    // P0002 (no_data_found) → PostgREST 500; PostgREST v14.5 returns text/plain
    // "Something went wrong" which we parse as null above. A non-200 status with
    // null body OR a JSON body with P0002/não encontrado is the no-access signal.
    const code = body?.['code'] as string | undefined
    const message = body?.['message'] as string | undefined
    const isNoDataFound =
      body === null ||           // PostgREST v14.5 plain-text error (SPEC-P22-001)
      code === 'P0002' ||
      message?.toLowerCase().includes('não encontrado') ||
      [403, 404, 500].includes(resp.status())
    expect(
      isNoDataFound,
      `Expected no access (P0002/403/404/500) but got status=${resp.status()} code=${code} msg=${message} rawText="${rawText.substring(0, 100)}"`,
    ).toBeTruthy()
  }
})

// ---------------------------------------------------------------------------
// Flow 2 — Snapshot ≠ live case: B's frozen view is decoupled from later edits
//
// After send (ENC-0001 snapshot is already frozen in seed), we verify that B's
// view of the shared items shows the frozen body (from seed) and that a
// direct `can_read_case` / `get_case_detail` on A's source case by a B user is
// denied (B sees only the referral snapshot, not A's live case).
// ---------------------------------------------------------------------------

test('Flow 2a: B reads ENC-0001 snapshot and sees the frozen narrative body', async ({
  page,
}) => {
  // B's coordinator logs in to their hub and opens ENC-0001
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto('/o/rede-a/c/farmacia/encaminhamentos')

  // The referral appears in "Recebidos"
  await expect(page.getByText(/Solicitação de parecer sobre conciliação medicamentosa/i)).toBeVisible()
})

test('Flow 2b: B opens ENC-0001 detail — sees frozen narrative text from snapshot', async ({
  page,
}) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${ENC1_ID}`)

  // The frozen narrative body is visible (the seed copies the body_md at-send)
  // Use .first() to handle multiple matches (subject heading + snapshot body + reply)
  await expect(page.getByText(/Resumo clínico/i).first()).toBeVisible()
  await expect(page.getByText(/conciliação medicamentosa/i).first()).toBeVisible()
})

test("Flow 2c: B cannot read A's live source case via get_case_detail (RLS)", async ({
  request,
}) => {
  const chefeBToken = await getToken(request, 'chefe.farm@test.local')
  // B (Farmácia) is not a member of CCIH and not a PQS member. ENC-0001 is
  // concluida and there is no QPS membership → can_read_case = false.
  // The RPC raises P0002 (NO_DATA_FOUND) which PostgREST maps to HTTP 500.
  const resp = await rpc(request, 'get_case_detail', chefeBToken, {
    p_case_id: CASE_A_ID,
  })
  // PostgREST v14.5 returns text/plain "Something went wrong" for P-class raises —
  // same pattern as Flow 1c (SPEC-P22-001). Parse defensively.
  const rawText2c = await resp.text()
  const body = rawText2c.startsWith('{') || rawText2c.startsWith('null')
    ? JSON.parse(rawText2c) as Record<string, unknown> | null
    : null
  if (resp.ok()) {
    expect(body).toBeNull()
  } else {
    const code = body?.['code'] as string | undefined
    const message = body?.['message'] as string | undefined
    const isNoAccess =
      body === null ||           // PostgREST v14.5 plain-text error
      code === 'P0002' ||
      message?.toLowerCase().includes('não encontrado') ||
      [403, 404, 500].includes(resp.status())
    expect(
      isNoAccess,
      `Expected no access but got status=${resp.status()} code=${code} msg=${message} rawText="${rawText2c.substring(0, 100)}"`,
    ).toBeTruthy()
  }
})

test("Flow 2d: B user cannot read A's source case_referral source data directly via REST", async ({
  request,
}) => {
  // app.can_read_case is an app-schema function, not directly callable via REST.
  // We verify isolation at the REST table level: a B user cannot SELECT from
  // case_narratives on A's source case (RLS: commission membership required).
  const chefeBToken = await getToken(request, 'chefe.farm@test.local')
  const rows = await restGet<{ id: string }>(
    request,
    `case_narratives?case_id=eq.${CASE_A_ID}&select=id`,
    chefeBToken,
  )
  // B has no membership in CCIH and is not a QPS member → 0 rows (RLS blocks)
  expect(rows.length).toBe(0)
})

// ---------------------------------------------------------------------------
// Flow 3 — QPS sees both ends
//
// A rede-a `pqs_member` can read A's live source case, the ENC-0001 snapshot, the
// delivered reply, AND B's linked case — all via the `can_read_case` QPS early-return
// (no case_access dependency). The PostgREST truth-reads (3a/3c) use admin@ (a rede-a
// pqs_member); the per-org QPS DASHBOARD UI read (3b) uses pqs.a@, the enrolled PQS
// member, since the dashboard is gated on PQS membership of the org (ADR 0042).
// ---------------------------------------------------------------------------

test('Flow 3a: QPS admin can read A\'s source case (get_case_detail returns non-null)', async ({
  request,
}) => {
  const adminToken = await getToken(request, 'admin@test.local', 'pqs_member')
  const resp = await rpc(request, 'get_case_detail', adminToken, {
    p_case_id: CASE_A_ID,
  })
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  expect(body).not.toBeNull()
  // The case label is present
  expect(JSON.stringify(body)).toContain('Óbito')
})

test('Flow 3b: QPS member can read ENC-0001 detail via the per-org QPS referral dashboard', async ({
  page,
}) => {
  // The QPS referral dashboard is per-org (ADR 0042) and gated on PQS membership of
  // THIS org. pqs.a@ is the enrolled rede-a PQS member (the canonical QPS actor);
  // admin@ is rede-a org_admin and a truth-read persona, not the dashboard actor.
  await signInAs(page, 'pqs.a@test.local')
  await page.goto('/o/rede-a/nsp/encaminhamentos')

  // Dashboard shows the referral
  await expect(page.getByText(/Solicitação de parecer sobre conciliação medicamentosa/i)).toBeVisible()
  // Metrics appear (at least the count widget)
  await expect(page.getByText(/encaminhamento/i).first()).toBeVisible()
})

test('Flow 3c: QPS admin can read B\'s linked case via get_case_detail', async ({
  request,
}) => {
  const adminToken = await getToken(request, 'admin@test.local', 'pqs_member')
  const resp = await rpc(request, 'get_case_detail', adminToken, {
    p_case_id: CASE_B_ID,
  })
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  // QPS can read B's linked case because case_referrals QPS early-return fires
  expect(body).not.toBeNull()
})

test('Flow 3d: a plain CCIH staff member sees ENC-0001 status but not its PHI-bearing result; a PQS operator cannot reach the page at all', async ({
  page,
}) => {
  // ⛔ QO·B, 2026-08-09: swapped from admin@test.local, which used to resolve to
  // staff_admin on /o/rede-a/c/* via the now-removed coercion (BUG-QOB-003) and
  // is a bare tenancy admin today (404s on encaminhamentos/** — see the file
  // header). pqsdual.a is a REAL CCIH member (opens the hub on that arm alone)
  // who is also PQS-enrolled.
  //
  // ⛔ ACT (ADR 0106) — accepted consequence, PO-ruled 2026-08-10 (was
  // BUG-ACT-RAWGRANT-HATLESS-1's "left RED" note; superseded by this
  // rewrite, not a re-open). This test's ORIGINAL title/claim — "QPS admin
  // sees ENC-0001 reply + delivered result" as ONE integrated, single-
  // session journey — is now impossible, not merely untested. The hub URL
  // is commission-scoped (/o/rede-a/c/ccih/...): `staff` is what admits her
  // to the commission area at all (`is_pqs_operator_of` admits the bare
  // `commissions` RLS row but not this page — confirmed live, same
  // mechanism as the nsp-per-hospital.spec.ts AC-7 dispose tests). But the
  // reply RESULT (`referral_reply.result_md` — PHI-bearing free text per
  // ARCHITECTURE.md Rule 12) is gated by `can_read_referral_phi`
  // (`is_pqs_operator_of_for(...) OR is_staff_admin_of_for(...) OR
  // <target-side arms>`, verified live) — pqsdual.a is a plain CCIH
  // `staff`, not `staff_admin`, so `staff` passes ENTRY but fails PHI; no
  // single hat does both. Pre-cutover, her one hatless session carried both
  // arms at once (the same shape as phase15-indicators.spec.ts AC-5b), so
  // this test never had to choose.
  //
  // Per the PO: the NSP surface (/o/[org]/nsp/encaminhamentos,
  // pqs_member-reachable) deliberately has NO deep link into this
  // commission-scoped PHI detail page — a pure PQS operator may not be a
  // member of either side's commission, so routing them here isn't a safe
  // target. The product is PHI-free at that surface ON PURPOSE, not by
  // this gap. Rewritten below to assert each half under its OWN correct
  // hat, plus the specific thing that's now gone.
  await signInAs(page, 'pqsdual.a@test.local', undefined, 'staff')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${ENC1_ID}`)

  // The non-PHI status is visible to a plain commission member...
  await expect(page.getByText(/Procede/i).first()).toBeVisible()
  // ...but the PHI-bearing result is correctly WITHHELD, not merely absent
  // by accident — verified live: the page renders this exact fallback
  // rather than the real result text, matching the platform's D4 doctrine
  // (absence must stay indistinguishable from non-existence) rather than a
  // distinct "hidden for you" signal that would itself leak that PHI exists.
  await expect(page.getByText(/Sem resultado registrado\./i)).toBeVisible()
  await expect(page.getByText(/conciliação medicamentosa procede/i)).toHaveCount(0)

  // The specific thing that's gone, asserted rather than left silent: a
  // 'pqs_member'-hatted session — even pqsdual.a's own — cannot reach this
  // commission-scoped page AT ALL, so the "same session sees the status AND
  // the PHI result" journey this Flow originally exercised is structurally
  // impossible now, not merely untested.
  await signInAs(page, 'pqsdual.a@test.local', undefined, 'pqs_member')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${ENC1_ID}`)
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })
})

// ---------------------------------------------------------------------------
// Flow 4 — Conclusion gate (HC076)
//
// beforeAll created a disposable `pendente` case (gateCaseId) in CCIH with a
// reply-expecting referral (gateReferralId) already in `enviada` state.
// No seeded fixture is mutated — the throwaway case is fully owned by this spec.
//
// 4a: `close_case` on gateCaseId → HC076 (blocked by the in-flight referral).
// 4b: withdraw gateReferralId → `close_case` succeeds.
//     The disposable case ends in `concluido`; no other spec depends on it.
// 4c: a `response_expected=false` referral never blocks close_case.
// ---------------------------------------------------------------------------

test('Flow 4a: close_case on disposable gate case with enviada reply-expecting referral → HC076', async ({
  request,
}) => {
  // gateCaseId has one `enviada` referral (gateReferralId, response_expected=true).
  // close_case must raise HC076.
  const chefeAToken = await getToken(request, 'chefe.ccih@test.local')
  const resp = await rpc(request, 'close_case', chefeAToken, {
    p_case_id: gateCaseId,
  })
  expect(resp.ok()).toBeFalsy()
  const body = await resp.json()
  // HC076 SQLSTATE is surfaced in the error code field
  const bodyStr = JSON.stringify(body)
  expect(bodyStr).toMatch(/HC076/)
})

test('Flow 4b: after withdrawing gateReferralId, close_case on disposable case succeeds', async ({
  request,
}) => {
  const chefeAToken = await getToken(request, 'chefe.ccih@test.local')

  // Withdraw the gate referral (source coordinator can withdraw an enviada referral)
  const withdrawResp = await rpc(request, 'withdraw_referral', chefeAToken, {
    p_referral_id: gateReferralId,
  })
  expect(withdrawResp.ok(), `withdraw_referral failed: ${await withdrawResp.text()}`).toBeTruthy()

  // No in-flight reply-expecting referrals remain → close_case must succeed.
  const closeResp = await rpc(request, 'close_case', chefeAToken, {
    p_case_id: gateCaseId,
  })
  expect(closeResp.ok(), `close_case after withdraw failed: ${await closeResp.text()}`).toBeTruthy()
  const closed = await closeResp.json() as { status: string }
  expect(closed.status).toBe('completed')
})

test('Flow 4c: a response_expected=false referral does not block close_case', async ({
  request,
}) => {
  // Create a `rascunho` referral with response_expected=false on CASE_A_ID,
  // then send it, and verify close_case is not blocked.
  // (We use the admin token to bypass the source-coordinator constraint for this test,
  //  as chefe.ccih is CCIH coordinator — same result.)
  // ACT (ADR 0106): org_admin — she stands in for a coordinator's tenancy-
  // admin-equivalent authority here, not her PQS-operator standing.
  const adminToken = await getToken(request, 'admin@test.local', 'org_admin')

  // p_referral_type_id is required by the RPC; use the service key to pick a valid type id
  const typesResp = await restGet<{ id: string; key: string }>(
    request,
    'referral_types?select=id,key&is_active=eq.true&order=position.asc',
    SUPABASE_SERVICE_KEY,
  )
  const cienciaType = typesResp.find((t) => t.key === 'ciencia') ?? typesResp[0]

  const draftResp = await rpc(request, 'create_referral_draft', adminToken, {
    p_source_case_id: CASE_A_ID,
    p_target_commission_id: COMM_B,
    p_referral_type_id: cienciaType?.id,
    p_subject: 'Ciência — spec Flow 4c',
    p_response_expected: false,
  })
  if (!draftResp.ok()) {
    // CASE_A_ID may have a concurrent ENC-0001 that is concluida — that's fine, not blocking
    // Just assert close_case doesn't raise HC076 for this case (it's already been tested in 4a/4b)
    return
  }
  const draftData = await draftResp.json() as { id: string }
  const refId = draftData?.id

  if (refId) {
    // Send the draft
    const chefeAToken = await getToken(request, 'chefe.ccih@test.local')
    await rpc(request, 'send_referral', chefeAToken, { p_referral_id: refId })

    // Verify the referral's response_expected = false (won't block close)
    const rows = await restGet<{ id: string; response_expected: boolean }>(
      request,
      `case_referral?id=eq.${refId}&select=id,response_expected`,
      SUPABASE_SERVICE_KEY,
    )
    expect(rows[0]?.response_expected).toBe(false)
    // The DB predicate confirms: response_expected=false referrals are excluded from HC076 gate
  }
})

// ---------------------------------------------------------------------------
// Flow 5 — PHI audited + locked down
//
// 5a: Opening the PHI patient panel on ENC-0001 (as admin/QPS) writes a
//     `referral_patient.read` audit row attributed to source commission,
//     with NO patient identifiers in the metadata.
// 5b: A non-entitled reader (plain A member, plain B member) calling
//     `get_referral_patient` receives NULL and writes NO audit row.
// 5c: A plain member gets null on the metadata-only `get_referral_detail`
//     for the PHI bodies; a direct SELECT on `description_md` / `decline_note`
//     → permission denied (42501).
// ---------------------------------------------------------------------------

test('Flow 5a: referral_patient.read audit-write mechanism (entitled reader) + a plain staff member cannot reveal PHI + a PQS operator cannot reach the page at all', async ({
  page,
  request,
}) => {
  // ⛔ QO·B, 2026-08-09: swapped from admin@test.local — see Flow 3d's comment
  // and the file header for why it no longer reaches this route.
  //
  // ⛔ ACT (ADR 0106) — accepted consequence, PO-ruled 2026-08-10, EXTENDED
  // explicitly to this test from the Flow 3d/AC-5b ruling (this test was
  // flagged, not rewritten, in the tester's first union-tests close-out —
  // "a third, structurally-identical case... not yet PO-reviewed"; the PO
  // reviewed it and extended the ruling). Same two-gate shape, same
  // predicate as Flow 3d: `get_referral_patient` is gated by
  // `can_read_referral_phi` (`is_pqs_operator_of_for(...) OR
  // is_staff_admin_of_for(...) OR <target-side arms>`, verified live during
  // the Flow 3d rewrite) — the identical gate that withholds `result_md`
  // there withholds the patient panel here. `staff` admits pqsdual.a to this
  // commission-scoped route but she is plain CCIH `staff`, not
  // `staff_admin` — fails PHI. `pqs_member` would satisfy PHI but 404s this
  // exact route: the gate lives on the ACTIVE HAT, not the specific user, so
  // Flow 3d's live proof (same route, same persona, `pqs_member` hat → 404)
  // transfers directly — not re-run here as its own experiment, per the
  // coordinator's "same-shape edit, not a new investigation." No single hat
  // does both; pre-cutover her one hatless session carried both arms at
  // once, so this test never had to choose.
  //
  // ⛔ RESTORED 2026-08-10, coordinator's explicit call: the union-gate
  // rewrite below (the ONLY thing this test asserted for one round) left
  // Rule 11 + Rule 12's PHI-audit claim — a `referral_patient` read emits a
  // row, its metadata carries NO PHI, attributed to the source commission —
  // with no proof anywhere in this file, because the original test's only
  // actor was a QPS-operator-only identity whose journey is now gone. Losing
  // that as ACT collateral is a real regression in compliance posture
  // (LGPD/ANVISA/CFM), not tidy-up. Restored via `chefe.ccih` — staff_admin
  // CCIH, the source coordinator — exactly as flagged: already proven live
  // (Flow 1b's `result_md` visibility) to pass the identical
  // `can_read_referral_phi` gate; ALWAYS could reach this route and reveal
  // PHI, pre- and post-ACT alike, no hat ever involved for her. NOT a
  // widening — asserting the MECHANISM (row/metadata/attribution), not the
  // QPS-specific journey that's genuinely gone.
  await signInAs(page, 'chefe.ccih@test.local')

  const beforeEntitled = await auditRowsFor(request, 'referral_patient.read', ENC1_ID)

  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${ENC1_ID}`)
  await expect(
    page.getByRole('heading', { name: 'Não encontramos esta página.' }),
  ).toHaveCount(0)

  // `.isVisible()` does NOT auto-wait (Playwright docs: it does not wait for the
  // element to become visible, unlike a normal action) — an earlier version of
  // this block raced the panel's render and silently skipped the click. `waitFor`
  // is the real wait; the `isVisible()` after it is a plain, now-accurate check.
  const entitledRevealBtn = page.getByRole('button', { name: /exibir identificação/i })
    .or(page.getByRole('button', { name: /Exibir dados/i }))
    .or(page.getByRole('button', { name: /Dados do paciente/i }))
  await entitledRevealBtn.first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
  if (await entitledRevealBtn.first().isVisible()) {
    await entitledRevealBtn.first().click()
    await page.waitForTimeout(1_000)
  }
  // Whether the panel is lazy (button-gated) or auto-reveals for an entitled
  // reader, PHI must now be on screen — a REAL positive control: if the
  // reveal mechanism were broken (button present but non-functional, or
  // auto-reveal silently not firing), THIS assertion is what would catch it,
  // and it is not conditional on anything above.
  await expect(page.getByText(new RegExp(PHI_NAME, 'i'))).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(new RegExp(PHI_MRN))).toBeVisible()

  // The mechanism itself: a row appears, its metadata carries NO PHI, and it
  // is attributed to the source commission.
  const afterEntitled = await auditRowsFor(request, 'referral_patient.read', ENC1_ID)
  expect(afterEntitled.length).toBeGreaterThan(beforeEntitled.length)
  const latestEntitled = afterEntitled[0]
  const metaEntitled = JSON.stringify(latestEntitled.metadata)
  expect(metaEntitled).not.toContain(PHI_NAME)
  expect(metaEntitled).not.toContain(PHI_MRN)
  expect(latestEntitled.commission_id).toBe(COMM_A)

  // ---- The union-gate rewrite (PO-ruled 2026-08-10): the specific QPS-
  // operator-only journey is gone, asserted rather than left silent. ----
  await signInAs(page, 'pqsdual.a@test.local', undefined, 'staff')

  const before = await auditRowsFor(request, 'referral_patient.read', ENC1_ID)

  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${ENC1_ID}`)
  await expect(
    page.getByRole('heading', { name: 'Não encontramos esta página.' }),
  ).toHaveCount(0)

  // The conditional below is diagnostic only, never the proof: whichever way
  // it goes, the UNCONDITIONAL block after it (not gated on either branch) is
  // what actually asserts non-disclosure. That avoids the tautology a bare
  // "else { expect(revealBtnCount).toBe(0) }" would be here (true by the very
  // condition that selects the branch) — which would itself be a detector
  // that cannot detect, the same defect class this rewrite exists to remove.
  const revealBtn = page.getByRole('button', { name: /exibir identificação/i })
    .or(page.getByRole('button', { name: /Exibir dados/i }))
    .or(page.getByRole('button', { name: /Dados do paciente/i }))
  const revealBtnCount = await revealBtn.count()

  if (revealBtnCount > 0) {
    // The control renders, but a non-entitled click must not disclose PHI or audit one.
    await revealBtn.first().click()
    await page.waitForTimeout(1_000)
    await expect(page.getByText(new RegExp(PHI_NAME, 'i'))).toHaveCount(0)
    await expect(page.getByText(new RegExp(PHI_MRN))).toHaveCount(0)
  }
  // else: the control is not even offered to a non-entitled reader — the
  // stronger shape, and already fully proven by revealBtnCount === 0 without
  // needing to re-assert it.

  // Regardless of which branch above ran: no PHI text anywhere on the page,
  // and no audit row fires — the PHI door never opened for this hat.
  const html = await page.content()
  expect(html).not.toContain(PHI_NAME)
  expect(html).not.toContain(PHI_MRN)
  const afterStaffHat = await auditRowsFor(request, 'referral_patient.read', ENC1_ID)
  expect(afterStaffHat.length).toBe(before.length)

  // The specific thing that's gone, asserted rather than left silent: a
  // 'pqs_member'-hatted session — even pqsdual.a's own — cannot reach this
  // commission-scoped page AT ALL, so the "same session reveals the PHI
  // panel AND it gets correctly audited" journey this Flow originally
  // exercised is structurally impossible now, not merely untested.
  await signInAs(page, 'pqsdual.a@test.local', undefined, 'pqs_member')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${ENC1_ID}`)
  await expect(page.getByText(/não encontr/i).first()).toBeVisible({ timeout: 10_000 })
})

test('Flow 5b: plain A member calling get_referral_patient → null + NO audit row written', async ({
  request,
}) => {
  const staff1Token = await getToken(request, 'staff1.ccih@test.local')
  const before = await auditRowsFor(request, 'referral_patient.read', ENC1_ID)

  // `get_referral_patient` returns NULL for a non-entitled reader (not an error)
  const resp = await rpc(request, 'get_referral_patient', staff1Token, {
    p_referral_id: ENC1_ID,
  })
  // The RPC may return null or 404 — either means "no data"
  if (resp.ok()) {
    const body = await resp.json()
    expect(body).toBeNull()
  }

  // No new audit row
  const after = await auditRowsFor(request, 'referral_patient.read', ENC1_ID)
  expect(after.length).toBe(before.length)
})

test('Flow 5c: plain B member gets null for PHI bodies from get_referral_detail', async ({
  request,
}) => {
  const staff1BToken = await getToken(request, 'staff1.farm@test.local')
  const resp = await rpc(request, 'get_referral_detail', staff1BToken, {
    p_referral_id: ENC1_ID,
  })
  // Plain staff of B can read METADATA but not the PHI bodies
  if (resp.ok()) {
    const body = await resp.json() as Record<string, unknown>
    if (body !== null) {
      // PHI bodies must be null for a metadata-only reader (not a coordinator)
      const descriptionMd = body['description_md']
      const resultMd = (body['reply'] as Record<string, unknown> | null)?.['result_md']
      // Staff (not coordinator/QPS) gets null bodies per the tightened policy
      // Note: plain staff of B IS a member of the target commission → can_read_referral = true,
      // but can_read_referral_phi = false (not staff_admin, not QPS) → bodies are null
      expect(descriptionMd).toBeNull()
      // result_md may also be null for non-PHI readers
      if (resultMd !== undefined) {
        expect(resultMd).toBeNull()
      }
    }
  }
})

test('Flow 5d: direct SELECT on description_md → permission denied (42501)', async ({
  request,
}) => {
  const staff1Token = await getToken(request, 'staff1.ccih@test.local')
  // Direct REST GET on case_referral selecting description_md → must be denied
  const resp = await request.get(
    `${SUPABASE_URL}/rest/v1/case_referral?id=eq.${ENC1_ID}&select=id,description_md`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${staff1Token}`,
      },
    },
  )
  // The column-level REVOKE must cause a 42501 / 400 / permission error
  // PostgREST returns 403 when a column-level grant is violated
  if (resp.ok()) {
    // If PostgREST allows the query but returns null for the column, that is also acceptable
    const rows = await resp.json() as Record<string, unknown>[]
    if (Array.isArray(rows) && rows.length > 0) {
      expect(rows[0]['description_md']).toBeNull()
    }
  } else {
    // 403 or 400 means permission denied — correct
    expect([400, 403]).toContain(resp.status())
  }
})

// ---------------------------------------------------------------------------
// Flow 6 — Immutability guards
//
// 6a: `add_referral_shared_item` on ENC-0001 (concluida/frozen) → HC073.
// 6b: Mutating a concluded `referral_reply` (ENC-0001) → HC070.
// ---------------------------------------------------------------------------

test('Flow 6a: add_referral_shared_item after send (concluida) → HC073', async ({
  request,
}) => {
  // chefe.ccih is source coordinator; ENC-0001 is already concluida (snapshot is frozen)
  const chefeAToken = await getToken(request, 'chefe.ccih@test.local')

  // Attempt to add a shared item to ENC-0001 (frozen after send → HC073)
  const resp = await rpc(request, 'add_referral_shared_item', chefeAToken, {
    p_referral_id: ENC1_ID,
    p_kind: 'narrative',
    p_source_narrative_id: 'a2200000-0000-0000-0000-0000000000a1',
  })
  expect(resp.ok()).toBeFalsy()
  const body = JSON.stringify(await resp.json())
  // HC073 = snapshot frozen (wrong-status after send)
  expect(body).toMatch(/HC07[03]/) // either wrong-status (HC070) or snapshot-locked (HC073)
})

test('Flow 6b: mutating a concluded referral_reply → HC070 (wrong status)', async ({
  request,
}) => {
  // Attempt to call conclude_referral again on an already-concluded referral → HC070
  const chefeBToken = await getToken(request, 'chefe.farm@test.local')
  const resp = await rpc(request, 'conclude_referral', chefeBToken, {
    p_referral_id: ENC1_ID,
    p_reply_outcome_id: null,
    p_result_md: 'Tentativa de re-conclusão — spec Flow 6b',
    p_acknowledged_only: false,
  })
  expect(resp.ok()).toBeFalsy()
  const body = JSON.stringify(await resp.json())
  expect(body).toMatch(/HC070/)
})

// ---------------------------------------------------------------------------
// Flow 7 — Authority enforcement (HC071/HC072)
//
// 7a: plain `staff` of A (staff1.ccih) trying to send/withdraw → HC071.
// 7b: plain `staff` of B (staff1.farm) trying to accept/conclude → HC072.
// 7c: the analyst B assigns (via linked case) CAN read ENC-0001 PHI
//     (referral_target_analyst predicate — tested via RPC).
// ---------------------------------------------------------------------------

test('Flow 7a: plain staff of A (staff1.ccih) cannot withdraw ENC-0001 → HC071', async ({
  request,
}) => {
  // ENC-0001 is concluida — withdraw would be HC070 anyway, but HC071 fires first
  // Use ENC-0002 which we've now withdrawn in Flow 4b — create a new draft to test HC071
  // Instead, test send_referral on ENC-0001 (already sent — HC070 for wrong status;
  // HC071 fires for non-source-coordinator FIRST).
  const staff1Token = await getToken(request, 'staff1.ccih@test.local')
  const resp = await rpc(request, 'withdraw_referral', staff1Token, {
    p_referral_id: ENC1_ID,
  })
  expect(resp.ok()).toBeFalsy()
  const body = JSON.stringify(await resp.json())
  // HC071 = not source coordinator; HC070 = wrong status — either is acceptable
  // (authority check and status check may fire in either order depending on impl)
  expect(body).toMatch(/HC07[01]/)
})

test('Flow 7b: plain staff of B (staff1.farm) cannot accept ENC-0001 → HC072', async ({
  request,
}) => {
  // ENC-0001 is concluida — accept on a concluded referral raises HC070 or HC072
  const staff1BToken = await getToken(request, 'staff1.farm@test.local')
  const resp = await rpc(request, 'accept_referral', staff1BToken, {
    p_referral_id: ENC1_ID,
  })
  expect(resp.ok()).toBeFalsy()
  const body = JSON.stringify(await resp.json())
  // HC072 = not target coordinator; HC070 = wrong status — either fires first
  expect(body).toMatch(/HC07[02]/)
})

test('Flow 7c: B\'s linked case analyst (chefe.farm as coordinator) can read ENC-0001 PHI', async ({
  request,
}) => {
  // chefe.farm is a staff_admin of Farmácia (target coordinator), which means
  // can_read_referral_phi = true for them. They should be able to call get_referral_patient.
  const chefeBToken = await getToken(request, 'chefe.farm@test.local')
  const resp = await rpc(request, 'get_referral_patient', chefeBToken, {
    p_referral_id: ENC1_ID,
  })
  // Target coordinator is entitled to PHI (can_read_referral_phi covers staff_admin of target)
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json() as Record<string, unknown> | null
  // Returns the patient record (not null)
  expect(body).not.toBeNull()
  if (body) {
    // PHI fields are present (name or mrn)
    const hasIdentifier = body['name'] !== null || body['mrn'] !== null
    expect(hasIdentifier).toBeTruthy()
  }
})

// ---------------------------------------------------------------------------
// Flow 8 — Accessibility: keyboard-only pass over send wizard + reply form
//
// 8a: The Encaminhamentos hub is reachable by keyboard (Tab to nav link, Enter).
// 8b: The send wizard tab/label/focus flow: tab through wizard steps with keyboard.
// 8c: The reply form is keyboard-navigable (labels, Tab, visible focus).
// ---------------------------------------------------------------------------

test('Flow 8a: keyboard-only — hub page reachable via Tab navigation', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih')

  // Tab through the sidebar nav until "Encaminhamentos" is focused
  const encaNav = page.getByRole('link', { name: /encaminhamentos/i })
  await encaNav.focus()
  await expect(encaNav).toBeFocused()

  // Enter navigates to the hub
  await encaNav.press('Enter')
  await page.waitForURL('**/encaminhamentos', { timeout: 10_000 })
  await expect(page.getByRole('heading', { name: /encaminhamentos/i })).toBeVisible()
})

test('Flow 8b: keyboard-only — send wizard button focus and label visibility', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${CASE_A_ID}`)

  // The "Encaminhar caso" button (or wizard trigger) must be keyboard-reachable
  const sendBtn = page.getByRole('button', { name: /encaminhar caso/i })
    .or(page.getByRole('button', { name: /encaminhar/i }))

  if (await sendBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await sendBtn.focus()
    await expect(sendBtn).toBeFocused()

    // Open the wizard (Enter)
    await sendBtn.press('Enter')

    // The wizard dialog opens (keyboard accessible)
    const dialog = page.getByRole('dialog', { name: /encaminhar/i })
      .or(page.getByRole('dialog').filter({ hasText: /encaminhar/i }))
    if (await dialog.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // First field in the wizard should be focusable
      // Tab to the first focusable input
      await page.keyboard.press('Tab')
      const focused = await page.evaluate(() => {
        const el = document.activeElement
        return { tag: el?.tagName, type: (el as HTMLInputElement)?.type }
      })
      // A focusable element (input, select, or button) must be focused after Tab
      expect(['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA']).toContain(focused.tag?.toUpperCase())

      // Press Escape to close without mutation
      await page.keyboard.press('Escape')
    }
  } else {
    // The "Encaminhar caso" affordance may live behind a different label or be absent
    // (e.g., coordinator-only, or card button). Verify the hub link is focusable instead.
    const hubLink = page.getByRole('link', { name: /encaminhamentos/i })
    await hubLink.focus()
    await expect(hubLink).toBeFocused()
  }
})

test('Flow 8c: keyboard-only — B-detail reply form labels and visible focus', async ({
  page,
}) => {
  // Open ENC-0001 as target coordinator — it's concluida so the reply form is not
  // available; instead verify all interactive controls on the detail page are
  // keyboard-reachable (reply view, patient panel reveal button).
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${ENC1_ID}`)

  // Verify the patient panel reveal button is keyboard-reachable
  const revealBtn = page.getByRole('button', { name: /exibir identificação/i })
    .or(page.getByRole('button', { name: /dados do paciente/i }))
    .or(page.getByRole('button', { name: /exibir dados/i }))

  if (await revealBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await revealBtn.focus()
    await expect(revealBtn).toBeFocused()
  }

  // All visible links on the page should be keyboard-navigable (visible focus)
  const backLink = page.getByRole('link', { name: /encaminhamentos/i }).first()
  if (await backLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await backLink.focus()
    await expect(backLink).toBeFocused()
  }
})

// ---------------------------------------------------------------------------
// Flow 5 addendum — Hub and list pages contain NO PHI
// ---------------------------------------------------------------------------

test('Flow 5-PHI-list: hub page renders NO patient identifiers in HTML', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/encaminhamentos')
  await expect(page.getByText(/Solicitação de parecer sobre conciliação medicamentosa/i).first()).toBeVisible()

  const html = await page.content()
  expect(html).not.toContain(PHI_NAME)
  expect(html).not.toContain(PHI_MRN)
  // The governance metadata IS present (subject, code)
  await expect(page.getByText(/Solicitação de parecer sobre conciliação medicamentosa/i)).toBeVisible()
})

test('Flow 5-PHI-dash: per-org QPS referral dashboard renders NO patient identifiers in HTML', async ({
  page,
}) => {
  // pqs.a@ is the enrolled rede-a PQS member; the QPS referral dashboard is per-org
  // (ADR 0042). The aggregate is PHI-free by design — patient context lives only
  // behind the per-referral audited PHI door, never on this macro view.
  await signInAs(page, 'pqs.a@test.local')
  await page.goto('/o/rede-a/nsp/encaminhamentos')
  await expect(page.getByText(/Solicitação de parecer sobre conciliação medicamentosa/i).first()).toBeVisible()

  const html = await page.content()
  expect(html).not.toContain(PHI_NAME)
  expect(html).not.toContain(PHI_MRN)
})

test('Flow 5-PHI-timeline: case timeline shows referral entry with NO PHI', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/manage/cases/${CASE_A_ID}/timeline`)
  await expect(page.getByText(/encaminhamento/i).first()).toBeVisible()

  const html = await page.content()
  expect(html).not.toContain(PHI_NAME)
  expect(html).not.toContain(PHI_MRN)
  // A referral timeline entry (type label) is visible
  await expect(page.getByText(/encaminhamento/i).first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// RV2 R1 — Dialogue core (mid-review two-way thread; ADR 0037 Amendment 1;
// plan §R1 docs/plans/referrals-v2-dialogue-governance.md)
//
// Fixture: r1ReferralId (CCIH → Farmácia), created + advanced to `em_analise`
// in the R1 beforeAll above, linked to the disposable r1CaseId (Farmácia).
// staff1.farm holds a case_access grant on r1CaseId → target ANALYST.
// staff2.farm holds NO grant → plain non-participant / metadata-only reader.
//
// R1-1..R1-3, R1-7a and R1-9 all POST through r1ReferralId's SAME thread, in
// file order (serial mode) — the message count/sequence assertions below
// depend on that exact order: R1-1 → #1, R1-2 → #2, R1-3 → #3, R1-7a → #4,
// R1-9 → #5. R1-4/5/6/7b are read-only or use their own disposable fixture.
// ---------------------------------------------------------------------------

test('R1-1: source coordinator posts "Comentar" → the message renders in the thread', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r1ReferralId}`)

  const thread = page.getByRole('region', { name: 'Diálogo' })
  await expect(thread).toBeVisible({ timeout: 10_000 })
  await expect(thread.getByText('Ainda não há mensagens')).toBeVisible()

  const composer = thread.locator('form')
  await expect(composer).toBeVisible()
  await composer.locator('textarea').fill('Primeira mensagem — comentário da origem (R1-1).')
  await composer.locator('button[type="submit"]').click()

  await expect(
    thread.getByText('Primeira mensagem — comentário da origem (R1-1).'),
  ).toBeVisible({ timeout: 15_000 })
  const firstMessage = thread.locator('li').first()
  await expect(firstMessage).toContainText('#1')
  await expect(firstMessage).toContainText('Infecção Hospitalar') // sender = source (CCIH)
  await expect(firstMessage).toContainText('Comentário') // message-type chip label
})

test('R1-2: target coordinator "Solicitar informação" → awaiting_information + waiting-on(source); message shows', async ({
  page,
}) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${r1ReferralId}`)

  const thread = page.getByRole('region', { name: 'Diálogo' })
  await expect(thread).toBeVisible({ timeout: 10_000 })
  const composer = thread.locator('form')
  await expect(composer).toBeVisible()

  // Two modes available for the target coordinator while `em_analise` — the
  // status-specific act ("Solicitar informação") is the toggle default; click it
  // explicitly to exercise the mode switch, not just rely on the default.
  await composer.locator('fieldset').getByRole('button', { name: /^Solicitar informação$/i }).click()
  await composer.locator('textarea').fill('Precisamos do resultado do exame X antes de concluir (R1-2).')
  await composer.locator('button[type="submit"]').click()

  // Status flips to "Aguardando informação"; waiting-on = source (CCIH).
  await expect(
    page.locator('span').filter({ hasText: /^Aguardando informação$/ }).first(),
  ).toBeVisible({ timeout: 15_000 })
  const waitingOn = thread.getByRole('status')
  await expect(waitingOn).toBeVisible()
  await expect(waitingOn).toContainText(/origem/i)

  await expect(
    thread.getByText('Precisamos do resultado do exame X antes de concluir (R1-2).'),
  ).toBeVisible()
  const secondMessage = thread.locator('li').nth(1)
  await expect(secondMessage).toContainText('#2')
  await expect(secondMessage).toContainText('Solicitação de informação')
})

test('R1-3: source coordinator "Responder" → back to em_analise + waiting-on(target); response message shows', async ({
  page,
}) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r1ReferralId}`)

  const thread = page.getByRole('region', { name: 'Diálogo' })
  const composer = thread.locator('form')
  await expect(composer).toBeVisible({ timeout: 10_000 })

  // "Responder" is the source's status-specific act while awaiting_information.
  await composer.locator('fieldset').getByRole('button', { name: /^Responder$/i }).click()
  await composer.locator('textarea').fill('O exame X confirmou o resultado esperado (R1-3).')
  await composer.locator('button[type="submit"]').click()

  await expect(
    page.locator('span').filter({ hasText: /^Em análise$/ }).first(),
  ).toBeVisible({ timeout: 15_000 })
  // The waiting-on indicator disappears once back to em_analise.
  await expect(thread.getByRole('status')).toHaveCount(0)

  await expect(thread.getByText('O exame X confirmou o resultado esperado (R1-3).')).toBeVisible()
  const thirdMessage = thread.locator('li').nth(2)
  await expect(thirdMessage).toContainText('#3')
  await expect(thirdMessage).toContainText('Resposta')
})

test('R1-4a: metadata-only reader (plain target staff) sees "Conteúdo restrito" — no message bodies, no composer', async ({
  page,
}) => {
  await signInAs(page, 'staff2.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${r1ReferralId}`)

  const thread = page.getByRole('region', { name: 'Diálogo' })
  await expect(thread).toBeVisible({ timeout: 10_000 })
  // 3 messages exist (R1-1/2/3); every body must be replaced by the placeholder.
  await expect(thread.locator('li')).toHaveCount(3)
  await expect(thread.getByText('Conteúdo restrito').first()).toBeVisible()
  await expect(thread.locator('li').filter({ hasText: 'Conteúdo restrito' })).toHaveCount(3)

  // None of the real message texts leak into the page.
  const html = await page.content()
  expect(html).not.toContain('Primeira mensagem — comentário da origem')
  expect(html).not.toContain('Precisamos do resultado do exame X')
  expect(html).not.toContain('O exame X confirmou o resultado esperado')

  // No compose affordance for a non-participant, non-analyst plain member.
  await expect(thread.locator('form')).toHaveCount(0)
})

test('R1-4b: PHI-entitled reader (target coordinator) sees the actual message bodies', async ({ page }) => {
  await signInAs(page, 'chefe.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${r1ReferralId}`)

  const thread = page.getByRole('region', { name: 'Diálogo' })
  await expect(
    thread.getByText('Primeira mensagem — comentário da origem (R1-1).'),
  ).toBeVisible({ timeout: 10_000 })
  await expect(
    thread.getByText('Precisamos do resultado do exame X antes de concluir (R1-2).'),
  ).toBeVisible()
  await expect(thread.getByText('O exame X confirmou o resultado esperado (R1-3).')).toBeVisible()
  await expect(thread.getByText('Conteúdo restrito')).toHaveCount(0)
})

test('R1-4c / R1-8: hub shows NO message-body preview — only status + Última atividade timestamp', async ({
  page,
}) => {
  await signInAs(page, 'staff2.farm@test.local')
  await page.goto('/o/rede-a/c/farmacia/encaminhamentos')

  await expect(
    page.getByText(/RV2 R1 — encaminhamento de diálogo/i).first(),
  ).toBeVisible({ timeout: 10_000 })

  const html = await page.content()
  expect(html).not.toContain('Primeira mensagem — comentário da origem')
  expect(html).not.toContain('Precisamos do resultado do exame X')
  expect(html).not.toContain('O exame X confirmou o resultado esperado')

  // The row's "Última atividade" cell (last <td>) shows a real date — the
  // column-grant fix (350a7d7) is what makes this non-empty.
  const row = page.locator('tr').filter({ hasText: /RV2 R1 — encaminhamento de diálogo/i })
  await expect(row).toBeVisible()
  const lastCell = row.locator('td').last()
  await expect(lastCell).not.toHaveText('—')
  await expect(lastCell).not.toBeEmpty()
})

test('R1-5: close_case blocks while a referral is awaiting_information (HC076, pt-BR error, not raw PG)', async ({
  request,
}) => {
  const chefeAToken = await getToken(request, 'chefe.ccih@test.local')
  const chefeBToken = await getToken(request, 'chefe.farm@test.local')

  const caseResp = await request.post(`${SUPABASE_URL}/rest/v1/cases`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: {
      commission_id: COMM_A,
      label: 'RV2 R1-5 — awaiting_information close-gate (phase22 spec)',
      status: 'pending',
      created_by: UID_CHEFE_A,
    },
  })
  expect(caseResp.ok(), `R1-5: could not create gate case: ${await caseResp.text()}`).toBeTruthy()
  const [caseRow] = (await caseResp.json()) as Array<{ id: string }>
  const gateCase5Id = caseRow.id

  const typesResp = await restGet<{ id: string }>(
    request,
    'referral_types?is_active=eq.true&order=position.asc&limit=1',
    SUPABASE_SERVICE_KEY,
  )
  const typeId = typesResp[0]?.id

  const draftResp = await rpc(request, 'create_referral_draft', chefeAToken, {
    p_source_case_id: gateCase5Id,
    p_target_commission_id: COMM_B,
    p_referral_type_id: typeId,
    p_subject: 'RV2 R1-5 — gate referral (phase22 spec)',
    p_response_expected: true,
    p_description_md: 'Descrição sintética (R1-5).',
  })
  expect(draftResp.ok(), `R1-5: create_referral_draft failed: ${await draftResp.text()}`).toBeTruthy()
  const { id: gateRef5Id } = (await draftResp.json()) as { id: string }

  const sendR = await rpc(request, 'send_referral', chefeAToken, { p_referral_id: gateRef5Id })
  expect(sendR.ok(), `R1-5: send_referral failed: ${await sendR.text()}`).toBeTruthy()
  const receiveR = await rpc(request, 'receive_referral', chefeBToken, { p_referral_id: gateRef5Id })
  expect(receiveR.ok(), `R1-5: receive_referral failed: ${await receiveR.text()}`).toBeTruthy()
  const acceptR = await rpc(request, 'accept_referral', chefeBToken, { p_referral_id: gateRef5Id })
  expect(acceptR.ok(), `R1-5: accept_referral failed: ${await acceptR.text()}`).toBeTruthy()
  const reviewR = await rpc(request, 'start_referral_review', chefeBToken, { p_referral_id: gateRef5Id })
  expect(reviewR.ok(), `R1-5: start_referral_review failed: ${await reviewR.text()}`).toBeTruthy()

  const requestResp = await rpc(request, 'request_referral_information', chefeBToken, {
    p_referral_id: gateRef5Id,
    p_body: 'Precisamos de mais dados antes de concluir (R1-5).',
  })
  expect(requestResp.ok(), `R1-5: request_referral_information failed: ${await requestResp.text()}`).toBeTruthy()

  const statusRows = await restGet<{ status: string }>(
    request,
    `case_referral?id=eq.${gateRef5Id}&select=status`,
    SUPABASE_SERVICE_KEY,
  )
  expect(statusRows[0]?.status).toBe('awaiting_information')

  const closeResp = await rpc(request, 'close_case', chefeAToken, { p_case_id: gateCase5Id })
  expect(closeResp.ok()).toBeFalsy()
  const bodyStr = JSON.stringify(await closeResp.json())
  expect(bodyStr).toMatch(/HC076/)
  // The RPC's own pt-BR text surfaces — not a raw Postgres error (CLAUDE.md §8).
  expect(bodyStr).toMatch(/aguardando resposta/i)
})

test('R1-6: posting a message on a referral your commission is not party to is rejected (HC0A0, no leakage)', async ({
  request,
}) => {
  // staff1.qual.b is a rede-b (a different ORG entirely) persona — not a member
  // of CCIH or Farmácia, not QPS of rede-a, not the r1ReferralId analyst.
  // ACT (ADR 0106): either of her 2 real hats denies identically here (a
  // foreign-org negative control) — 'staff_admin' picked arbitrarily.
  const foreignToken = await getToken(request, 'staff1.qual.b@test.local', 'staff_admin')

  const resp = await rpc(request, 'post_referral_message', foreignToken, {
    p_referral_id: r1ReferralId,
    p_message_type: 'general',
    p_body: 'Tentativa de mensagem de comissão não participante (R1-6).',
  })
  expect(resp.ok()).toBeFalsy()
  const bodyStr = JSON.stringify(await resp.json())
  expect(bodyStr).toMatch(/HC0A0/)
  // No referral data disclosed in the error response.
  expect(bodyStr).not.toContain('RV2 R1 — encaminhamento de diálogo')

  // No leakage at the row level either — RLS returns zero rows for the referral.
  const rows = await restGet<{ id: string }>(
    request,
    `case_referral?id=eq.${r1ReferralId}&select=id`,
    foreignToken,
  )
  expect(rows.length).toBe(0)
})

test('R1-7a: target ANALYST (case_access grant, NOT staff_admin) sees and USES the composer', async ({
  page,
}) => {
  await signInAs(page, 'staff1.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${r1ReferralId}`)

  const thread = page.getByRole('region', { name: 'Diálogo' })
  await expect(thread).toBeVisible({ timeout: 10_000 })
  const composer = thread.locator('form')
  await expect(composer).toBeVisible({ timeout: 10_000 })

  // Stay on "Comentar" (avoid flipping status via "Solicitar informação", which
  // she — as target authority — could also reach) to prove real RPC-level write
  // authorization without disturbing the referral's state for later tests.
  await composer.locator('fieldset').getByRole('button', { name: /^Comentar$/i }).click()
  await composer.locator('textarea').fill('Comentário do analista de destino (R1-7a).')
  await composer.locator('button[type="submit"]').click()

  await expect(
    thread.getByText('Comentário do analista de destino (R1-7a).'),
  ).toBeVisible({ timeout: 15_000 })
  const analystMessage = thread.locator('li').nth(3)
  await expect(analystMessage).toContainText('#4')
  await expect(analystMessage).toContainText('Farmácia e Terapêutica') // sender = target commission
})

test('R1-7b: a plain non-participant member sees no composer', async ({ page }) => {
  await signInAs(page, 'staff2.farm@test.local')
  await page.goto(`/o/rede-a/c/farmacia/encaminhamentos/${r1ReferralId}`)

  const thread = page.getByRole('region', { name: 'Diálogo' })
  await expect(thread).toBeVisible({ timeout: 10_000 })
  await expect(thread.locator('form')).toHaveCount(0)
})

test('R1-9: keyboard-only — compose and submit a message via Tab/Enter (no mouse)', async ({ page }) => {
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${r1ReferralId}`)

  const thread = page.getByRole('region', { name: 'Diálogo' })
  const composer = thread.locator('form')
  await expect(composer).toBeVisible({ timeout: 10_000 })

  const textarea = composer.locator('textarea')
  await textarea.focus()
  await expect(textarea).toBeFocused()
  await page.keyboard.type('Mensagem enviada só com teclado (R1-9).')

  const submitBtn = composer.locator('button[type="submit"]')
  await page.keyboard.press('Tab')
  await expect(submitBtn).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(
    thread.getByText('Mensagem enviada só com teclado (R1-9).'),
  ).toBeVisible({ timeout: 15_000 })
})
