import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { createHash } from 'node:crypto'
import { cachedSignIn, accessToken } from "./helpers/auth"
import { putBytesServiceRole, finalizeUpload, verifyUploadServiceRole } from './helpers/document-model'

/**
 * Phase 14c — RCA Workspace (Análise de Causa Raiz)
 *
 * Test contract: every bullet in the phase 14c Acceptance criteria.
 * Runs against LOCAL Supabase stack (seeded personas + seed RCA).
 * Run `npx supabase db reset` before; `--workers=1` required.
 *
 * Acceptance criteria covered:
 *   R1  RCA page loads for a sentinel-triaged event (seeded EV-0003 → RCA f3000000…a3).
 *   R2  Assign Lead + Facilitator + external SME members.
 *   R3  Write the problem statement (update_rca); bumps draft → in_progress.
 *   R4  Add a fishbone factor, flag as key (set_rca_factor_key).
 *   R5  Drill 5-Whys to a root text (set_rca_why_step + set_rca_why_root).
 *   R6  Add a root cause (add_rca_root_cause); classify it.
 *   R7  Add a timeline entry (add_rca_timeline_entry).
 *   R8  Add evidence: link citation to an existing interview.
 *   R9  Submit for review (submit_rca_for_review: in_progress → in_review).
 *   R10 Complete (complete_rca: in_review → completed, frozen).
 *   R11 Reopen (reopen_rca: completed → in_progress; audit row written).
 *
 * Security (RLS layer — no admin UI for plain staff):
 *   R12 Assigned non-observer staff SME CAN write the RCA (update_rca succeeds).
 *   R13 Observer member CANNOT write the RCA (HC048).
 *   R14 Non-team non-PQS user gets 0 rows on SELECT from rca table (RLS isolates).
 *   R15 RCA evidence bytes on the document substrate (documents-standard/-phi)
 *       reject DELETE from an authenticated actor (Rule 6 immutability, HTTP layer).
 *       Re-pointed 2026-08-17 (DM5·S4 QA finding B2): the ORIGINAL R15 targeted
 *       the now-retired `nsp-evidence` bucket with a DELETE on a NONEXISTENT
 *       object — QA proved live that a retired bucket and a surviving one are
 *       indistinguishable under that request (both return the identical
 *       `HTTP 400 {"statusCode":"404"}`), so the pin could not fail. The
 *       property moved onto the core substrate; see the test body for the
 *       corrected proof shape (existing object, survival re-checked after).
 *
 * Keyboard-only (R16): add factor → flag key → add a 5-Why step (RPC path).
 *
 * Seeded state:
 *   RCA_ID  f3000000-0000-0000-0000-0000000000a3  (EV-0003, in_progress)
 *     - Team: chefe.ccih (lead) + staff1.ccih (sme, non-observer, CAN write)
 *     - Factor fac00000…a1 (key, process)  + its why chain
 *     - 1 root cause
 *   CAPA_ID ca000000-0000-0000-0000-0000000000a3  (em_execucao)
 *
 * Personas (password Test1234!):
 *   admin@test.local       global admin / PQS member          (00…001)
 *   chefe.ccih@test.local  staff_admin, CCIH; RCA Lead        (00…002)
 *   staff1.ccih@test.local  staff, CCIH; assigned RCA SME     (00…003)
 *   chefe.farm@test.local  staff_admin, Farmácia (no access)  (00…005)
 */

// R6/R9/R10/R11 walk ONE shared RCA row through its status machine, and their own
// comments have always assumed sequential execution ("from R10 in a prior run",
// "R10 should have done this"). With the project's `fullyParallel: true` that
// ordering was never actually guaranteed — the tests coped by silently `return`ing
// when the row wasn't in the state they wanted, which is exactly how they passed
// while asserting nothing (FUP-VACUOUS-AUDIT-1). Declare the ordering they rely on.
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
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}

const RCA_ID  = 'f3000000-0000-0000-0000-0000000000a3'

const ADMIN_EMAIL   = 'admin@test.local'
const STAFF1_EMAIL  = 'staff1.ccih@test.local'
const FARM_EMAIL    = 'chefe.farm@test.local'
// NSP console actor for rede-a (enrolled PQS reader; ADR 0042 per-org NSP).
// Drives the /o/rede-a/nsp/** console UI; admin@ stays for RPC data-setup.
const PQS_A_EMAIL   = 'pqs.a@test.local'

const ADMIN_ID  = '00000000-0000-0000-0000-000000000001'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, password)
}

async function getOwnerToken(
  req: APIRequestContext,
  email: string,
  password = 'Test1234!',
  actAs?: string,
): Promise<string> {
  // ACT (ADR 0106) — delegates to the shared, hat-aware accessToken
  // (BUG-ACT-RAWGRANT-HATLESS-1): ADMIN_EMAIL/admin@test.local (org_admin +
  // pqs_member, 2 role types) otherwise comes back with no active_role claim.
  return accessToken(req, email, password, actAs)
}

async function restGet<T>(
  req: APIRequestContext,
  path: string,
  bearer: string,
): Promise<T[]> {
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

async function auditRowsFor(
  req: APIRequestContext,
  action: string,
  entityId: string,
) {
  return restGet<{ id: string; action: string; actor_id: string | null }>(
    req,
    `audit_log?action=eq.${encodeURIComponent(action)}&entity_id=eq.${entityId}&select=id,action,actor_id`,
    SUPABASE_SERVICE_KEY,
  )
}

async function rcaStatus(req: APIRequestContext): Promise<string> {
  const rows = await restGet<{ status: string }>(
    req,
    `rca?id=eq.${RCA_ID}&select=status`,
    SUPABASE_SERVICE_KEY,
  )
  expect(rows, `RCA ${RCA_ID} not found — the seed did not apply`).toHaveLength(1)
  return rows[0].status
}

/**
 * FUP-VACUOUS-AUDIT-1 — ESTABLISH the precondition instead of hoping for it.
 *
 * R6/R9/R10/R11 share one RCA row and walk it through
 * `in_progress → in_review → completed → (reopen) → in_progress`. Each of them used
 * to READ the status and, if it wasn't what the test needed, `return` — so on any
 * ordering but the happy one the test passed having asserted nothing, and nothing
 * recorded that it had skipped. This drives the row to the wanted state and asserts
 * every transition, so a broken transition reds here instead of silently disarming
 * the test that depended on it.
 *
 * `in_review` cannot go back directly (only `completed → reopen` is a valid
 * transition), so normalising from there goes forward through `complete` first.
 */
async function ensureRcaStatus(
  req: APIRequestContext,
  token: string,
  target: 'in_progress' | 'in_review',
): Promise<void> {
  // Bounded: each hop advances the machine, and 4 covers the longest path
  // (in_review → completed → in_progress → in_review).
  for (let hop = 0; hop < 4; hop += 1) {
    const status = await rcaStatus(req)
    if (status === target) return

    if (status === 'completed') {
      const r = await rpc(req, 'reopen_rca', token, { p_rca_id: RCA_ID })
      expect(r.ok(), `reopen_rca failed: ${r.status()} ${await r.text()}`).toBe(true)
    } else if (status === 'in_review') {
      // Forward, not back — see the note above.
      const r = await rpc(req, 'complete_rca', token, { p_rca_id: RCA_ID })
      expect(r.ok(), `complete_rca failed: ${r.status()} ${await r.text()}`).toBe(true)
    } else if (status === 'in_progress') {
      const r = await rpc(req, 'submit_rca_for_review', token, { p_rca_id: RCA_ID })
      expect(r.ok(), `submit_rca_for_review failed: ${r.status()} ${await r.text()}`).toBe(true)
    } else {
      throw new Error(`unexpected RCA status "${status}"`)
    }
  }
  expect(await rcaStatus(req), `could not drive the RCA to ${target}`).toBe(target)
}

/**
 * `begin_document_upload` for the `rca` home type — mirrors
 * `beginEvidenceUpload` in `dm5-nsp-evidence.spec.ts`, kept LOCAL rather than
 * imported (specs do not import each other in this repo). Only what R15
 * needs: a real reservation on the actual product corridor, so the bytes it
 * proves-immutable land exactly where a genuine RCA evidence upload would.
 */
async function beginRcaEvidenceUpload(
  req: APIRequestContext,
  token: string,
  input: { title: string; declaredFileName?: string; declaredMime?: string; declaredSize?: number },
): Promise<{ ok: boolean; status: number; body: { file_object_id: string; upload_session_id: string; document_id: string } | { code?: string; message?: string } }> {
  const resp = await rpc(req, 'begin_document_upload', token, {
    p_resource_type: 'rca',
    p_resource_id: RCA_ID,
    p_title: input.title,
    p_declared_file_name: input.declaredFileName ?? 'evidencia.pdf',
    p_declared_mime: input.declaredMime ?? 'application/pdf',
    p_declared_size: input.declaredSize ?? 256,
  })
  const body = await resp.json()
  return { ok: resp.ok(), status: resp.status(), body }
}

// ---------------------------------------------------------------------------
// R1 — RCA workspace loads for EV-0003's RCA
// ---------------------------------------------------------------------------

test('R1: RCA workspace page loads for a sentinel-triaged event', async ({ page, request }) => {
  // First ensure the what_md has known content (R12 may have overwritten it in a prior run)
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL, undefined, 'pqs_member')
  const setResp = await rpc(request, 'update_rca', adminToken, {
    p_rca_id: RCA_ID,
    p_what_md: 'Compressa cirúrgica retida — conteúdo restablecido pelo spec R1',
    p_scope: 'Perioperatório',
  })
  expect(setResp.ok()).toBeTruthy()

  await signInAs(page, PQS_A_EMAIL)
  await page.goto(`/o/rede-a/nsp/rca/${RCA_ID}`)
  // Readiness before the one-shot content() snapshot: wait for the problem statement
  // (set above) to render, proving the workspace loaded its content.
  await expect(page.getByText(/compressa cirúrgica retida/i).first()).toBeVisible()

  // Page heading / breadcrumb
  const html = await page.content()
  expect(html.toLowerCase()).toMatch(/análise de causa raiz|rca/i)

  // The problem statement is rendered (the text we just set)
  await expect(page.getByText(/compressa cirúrgica retida/i).first()).toBeVisible()
})

// ---------------------------------------------------------------------------
// R2 — Assign Lead + Facilitator + external SME members
// ---------------------------------------------------------------------------

test('R2: add_rca_member — add a Facilitator (admin) and an external SME', async ({
  request,
}) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL, undefined, 'pqs_member')

  // Check if admin is already a member (idempotency guard for multi-run scenarios)
  const existingMembers = await restGet<{ user_id: string | null; role: string }>(
    request,
    `rca_members?rca_id=eq.${RCA_ID}&select=user_id,role`,
    SUPABASE_SERVICE_KEY,
  )
  const adminAlreadyMember = existingMembers.some((m) => m.user_id === ADMIN_ID)

  if (!adminAlreadyMember) {
    // Add admin as Facilitator (admin is already PQS — bootstrap branch)
    const addFacResp = await rpc(request, 'add_rca_member', adminToken, {
      p_rca_id: RCA_ID,
      p_role: 'facilitator',
      p_user_id: ADMIN_ID,
    })
    expect(addFacResp.ok()).toBeTruthy()
    const fac = await addFacResp.json() as { role: string; user_id: string }
    expect(fac.role).toBe('facilitator')
    expect(fac.user_id).toBe(ADMIN_ID)
  }

  // Add an external SME (no platform user_id) — always add new (external_name allows repeat)
  const extName = `Dra. Ana Cardoso E2E-${Date.now()}`
  const addExtResp = await rpc(request, 'add_rca_member', adminToken, {
    p_rca_id: RCA_ID,
    p_role: 'sme',
    p_external_name: extName,
  })
  expect(addExtResp.ok()).toBeTruthy()
  const ext = await addExtResp.json() as { role: string; external_name: string; user_id: string | null }
  expect(ext.role).toBe('sme')
  expect(ext.user_id).toBeNull()
  expect(ext.external_name).toMatch(/Ana Cardoso/i)

  // Verify via service-role read
  const members = await restGet<{ role: string; user_id: string | null; external_name: string | null }>(
    request,
    `rca_members?rca_id=eq.${RCA_ID}&select=role,user_id,external_name`,
    SUPABASE_SERVICE_KEY,
  )
  const roles = members.map((m) => m.role)
  expect(roles).toContain('lead')
  expect(roles.filter((r) => r === 'sme').length).toBeGreaterThanOrEqual(1)
})

// ---------------------------------------------------------------------------
// R3 — Write / update the problem statement (update_rca)
// ---------------------------------------------------------------------------

test('R3: update_rca writes problem statement and bumps status to in_progress', async ({
  request,
}) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL, undefined, 'pqs_member')

  const resp = await rpc(request, 'update_rca', adminToken, {
    p_rca_id: RCA_ID,
    p_what_md: 'Compressa cirúrgica retida após colectomia — spec E2E R3.',
    p_expected_md: 'A contagem de compressas deve ser conciliada antes do fechamento.',
    p_detected: 'Centro cirúrgico ao final do procedimento',
    p_impact: 'Evento sentinela',
    p_scope: 'Perioperatório',
  })
  expect(resp.ok()).toBeTruthy()
  const rca = await resp.json() as { status: string; what_md: string }
  // Status should be in_progress (bumped if it was draft; stays in_progress if already there)
  expect(['in_progress', 'in_review'].includes(rca.status)).toBe(true)
  expect(rca.what_md).toMatch(/compressa cirúrgica|E2E R3/i)
})

// ---------------------------------------------------------------------------
// R4 — Add a fishbone factor, flag as key
// ---------------------------------------------------------------------------

test('R4: add_rca_factor + set_rca_factor_key', async ({ request }) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL, undefined, 'pqs_member')

  // Add a new factor (people category)
  const addResp = await rpc(request, 'add_rca_factor', adminToken, {
    p_rca_id: RCA_ID,
    p_category: 'people',
    p_text: 'Fator de spec E2E R4 — falta de treinamento da equipe cirúrgica',
  })
  expect(addResp.ok()).toBeTruthy()
  const factor = await addResp.json() as { id: string; category: string; is_key: boolean }
  expect(factor.category).toBe('people')
  expect(factor.is_key).toBe(false)

  const factorId = factor.id

  // Flag as key
  const keyResp = await rpc(request, 'set_rca_factor_key', adminToken, {
    p_factor_id: factorId,
    p_is_key: true,
  })
  expect(keyResp.ok()).toBeTruthy()
  const keyed = await keyResp.json() as { is_key: boolean }
  expect(keyed.is_key).toBe(true)

  // Verify DB
  const factors = await restGet<{ id: string; is_key: boolean; text: string }>(
    request,
    `rca_factors?id=eq.${factorId}&select=id,is_key,text`,
    SUPABASE_SERVICE_KEY,
  )
  expect(factors.length).toBe(1)
  expect(factors[0].is_key).toBe(true)
})

// ---------------------------------------------------------------------------
// R5 — 5-Whys drill: set step + root text
// ---------------------------------------------------------------------------

test('R5: set_rca_why_step and set_rca_why_root on seeded key factor', async ({
  request,
}) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL, undefined, 'pqs_member')
  const FACTOR_ID = 'fac00000-0000-0000-0000-0000000000a1'  // seeded key factor

  // Add a new why step (index 3 — after the seeded 3 steps)
  const stepResp = await rpc(request, 'set_rca_why_step', adminToken, {
    p_factor_id: FACTOR_ID,
    p_index: 3,
    p_text: 'Etapa 4 adicionada pelo spec E2E R5',
  })
  expect(stepResp.ok()).toBeTruthy()
  const chain = await stepResp.json() as { steps: string[] }
  expect(chain.steps.length).toBeGreaterThanOrEqual(4)
  expect(chain.steps[3]).toBe('Etapa 4 adicionada pelo spec E2E R5')

  // Set the root text
  const rootResp = await rpc(request, 'set_rca_why_root', adminToken, {
    p_factor_id: FACTOR_ID,
    p_root_text: 'Ausência de verificação padronizada — texto raiz spec E2E R5',
  })
  expect(rootResp.ok()).toBeTruthy()
  const rootChain = await rootResp.json() as { root_text: string }
  expect(rootChain.root_text).toMatch(/Ausência de verificação padronizada/)
})

// ---------------------------------------------------------------------------
// R6 — Add and classify a root cause
// ---------------------------------------------------------------------------

test('R6: add_rca_root_cause adds a classified root cause', async ({ request }) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL, undefined, 'pqs_member')

  // Root causes can only be added while in_progress. This used to try a reopen and
  // `return` silently if it failed — the whole test then asserted nothing.
  await ensureRcaStatus(request, adminToken, 'in_progress')

  const resp = await rpc(request, 'add_rca_root_cause', adminToken, {
    p_rca_id: RCA_ID,
    p_text: 'Causa raiz E2E R6: ausência de protocolo de dupla checagem',
    p_category: 'process',
    p_classification: 'system',
    p_type: 'root',
  })
  expect(resp.ok()).toBeTruthy()
  const rc = await resp.json() as {
    text: string; category: string; classification: string; type: string
  }
  expect(rc.category).toBe('process')
  expect(rc.classification).toBe('system')
  expect(rc.type).toBe('root')
  expect(rc.text).toMatch(/E2E R6/)

  // Verify in DB (check by unique pattern in text)
  const rows = await restGet<{ text: string; classification: string }>(
    request,
    `rca_root_causes?rca_id=eq.${RCA_ID}&select=text,classification`,
    SUPABASE_SERVICE_KEY,
  )
  const r6rows = rows.filter((r) => r.text.includes('E2E R6'))
  expect(r6rows.length).toBeGreaterThanOrEqual(1)
  expect(r6rows[0].classification).toBe('system')
})

// ---------------------------------------------------------------------------
// R7 — Add a timeline entry
// ---------------------------------------------------------------------------

test('R7: add_rca_timeline_entry adds a chronological entry', async ({ request }) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL, undefined, 'pqs_member')

  const occurred = new Date()
  occurred.setDate(occurred.getDate() - 7)

  const resp = await rpc(request, 'add_rca_timeline_entry', adminToken, {
    p_rca_id: RCA_ID,
    p_occurred_at: occurred.toISOString(),
    p_description: 'Entrada da linha do tempo adicionada pelo spec E2E R7',
  })
  expect(resp.ok()).toBeTruthy()
  const entry = await resp.json() as { description: string; rca_id: string }
  expect(entry.rca_id).toBe(RCA_ID)
  expect(entry.description).toMatch(/E2E R7/)
})

// ---------------------------------------------------------------------------
// R8 — Evidence: link citation to an existing interview
// ---------------------------------------------------------------------------

test('R8: add_rca_evidence with citation type (interview target)', async ({ request }) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL, undefined, 'pqs_member')

  // Find an existing interview in the seeded data to cite.
  // ⚠ The relation is `case_interviews`. This read `interviews`, which DOES NOT
  // EXIST (catalog-verified — `interviews` is the feature-flag key, the table is
  // `case_interviews`), so the probe always came back empty and this test always
  // took the link fallback below. The CITATION arm its title names had therefore
  // never executed once. Found by FUP-VACUOUS-AUDIT-1, not by a red — a wrong
  // relation name in a REST probe is invisible when the only thing downstream of it
  // is a fallback branch.
  const interviews = await restGet<{ id: string; title: string }>(
    request,
    `case_interviews?select=id,title&limit=1`,
    SUPABASE_SERVICE_KEY,
  )

  // FUP-VACUOUS-AUDIT-1: writing evidence requires an unfrozen RCA, so establish it
  // rather than depending on whatever the previous test left behind.
  await ensureRcaStatus(request, adminToken, 'in_progress')

  // The link fallback that used to sit here is GONE, not repaired: it was the arm
  // this test actually ran for its whole life, it tests a different RPC shape than
  // the title claims, and keeping it would preserve the escape hatch that hid the
  // wrong relation name. A missing interview is now a red with a legible reason.
  expect(
    interviews.length,
    'no seeded interview to cite — the CITATION arm this test is named for cannot run',
  ).toBeGreaterThan(0)

  const interviewId = interviews[0].id
  const resp = await rpc(request, 'add_rca_evidence', adminToken, {
    p_rca_id: RCA_ID,
    p_kind: 'citation',
    p_title: 'Citação de entrevista — spec E2E R8',
    p_citation_target: 'interview',
    p_cited_entity_id: interviewId,
    p_citation_label: 'Entrevista sobre protocolo cirúrgico',
  })
  expect(resp.ok(), `add_rca_evidence failed: ${resp.status()}`).toBe(true)
  const ev = await resp.json() as {
    kind: string; title: string; cited_interview_id: string; citation_label: string
  }
  expect(ev.kind).toBe('citation')
  expect(ev.cited_interview_id).toBe(interviewId)
  expect(ev.citation_label).toMatch(/protocolo cirúrgico/)
})

// ---------------------------------------------------------------------------
// R9 — Submit for review: in_progress → in_review
// ---------------------------------------------------------------------------

test('R9: submit_rca_for_review transitions in_progress → in_review', async ({
  request,
}) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL, undefined, 'pqs_member')

  // The transition under test starts from in_progress. This used to `return` when
  // the row was already in_review/completed, so on any ordering but the happy one
  // the test verified nothing at all.
  await ensureRcaStatus(request, adminToken, 'in_progress')

  const resp = await rpc(request, 'submit_rca_for_review', adminToken, {
    p_rca_id: RCA_ID,
  })
  expect(resp.ok()).toBeTruthy()
  const rca = await resp.json() as { status: string; submitted_at: string }
  expect(rca.status).toBe('in_review')
  expect(rca.submitted_at).toBeTruthy()
})

// ---------------------------------------------------------------------------
// R10 — Complete: in_review → completed (frozen); requires ≥1 root cause (HC047)
// ---------------------------------------------------------------------------

test('R10: complete_rca freezes the RCA; rejects if no root cause exists', async ({
  request,
}) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL, undefined, 'pqs_member')

  // complete_rca runs from in_review. The `completed` case used to `return`, which
  // skipped BOTH the completion assertions and the frozen-write check below — the
  // freeze is the security-relevant half of this test.
  await ensureRcaStatus(request, adminToken, 'in_review')

  // complete_rca from in_review; there are seeded + R6-added root causes → should succeed
  const completeResp = await rpc(request, 'complete_rca', adminToken, { p_rca_id: RCA_ID })
  expect(completeResp.ok()).toBeTruthy()
  const completed = await completeResp.json() as { status: string; completed_at: string }
  expect(completed.status).toBe('completed')
  expect(completed.completed_at).toBeTruthy()

  // Frozen: any write should be rejected (child-lock on factors)
  const writeResp = await rpc(request, 'add_rca_factor', adminToken, {
    p_rca_id: RCA_ID,
    p_category: 'policy',
    p_text: 'Fator tentativa — RCA congelada',
  })
  expect(writeResp.status()).not.toBe(200)
  const body = await writeResp.json() as { code?: string; message?: string }
  expect(body.code ?? body.message ?? '').toMatch(/HC047|concluid|frozen|completed/i)
})

// ---------------------------------------------------------------------------
// R11 — Reopen: completed → in_progress; audit row written
// ---------------------------------------------------------------------------

test('R11: reopen_rca transitions completed → in_progress and writes audit row', async ({
  request,
}) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL, undefined, 'pqs_member')

  // reopen runs from completed. This used to `return` when "state not as expected
  // from prior test" — i.e. precisely when R10 had failed to complete the RCA, so
  // one broken test silently disarmed the next.
  await ensureRcaStatus(request, adminToken, 'in_review')
  const completeResp = await rpc(request, 'complete_rca', adminToken, { p_rca_id: RCA_ID })
  expect(
    completeResp.ok(),
    `complete_rca failed while setting up reopen: ${completeResp.status()}`,
  ).toBe(true)
  expect(await rcaStatus(request)).toBe('completed')

  const before = await auditRowsFor(request, 'rca.reopened', RCA_ID)

  const resp = await rpc(request, 'reopen_rca', adminToken, { p_rca_id: RCA_ID })
  expect(resp.ok()).toBeTruthy()
  const rca = await resp.json() as { status: string; completed_at: string | null }
  expect(rca.status).toBe('in_progress')
  expect(rca.completed_at).toBeNull()

  const after = await auditRowsFor(request, 'rca.reopened', RCA_ID)
  expect(after.length).toBeGreaterThan(before.length)
})

// ---------------------------------------------------------------------------
// R12 — Assigned non-observer staff SME CAN write the RCA
// ---------------------------------------------------------------------------

test('R12: assigned plain-staff SME can write the RCA (update_rca succeeds)', async ({
  request,
}) => {
  // staff1.ccih (STAFF1_ID) is seeded as 'sme' (non-observer) on RCA_ID.
  // They are NOT a PQS member — can_write_rca must grant them write access.
  const staffToken = await getOwnerToken(request, STAFF1_EMAIL)

  const resp = await rpc(request, 'update_rca', staffToken, {
    p_rca_id: RCA_ID,
    p_what_md: 'Edição pelo SME atribuído — spec E2E R12',
    p_scope: 'Perioperatório',
  })
  // Should succeed (200) because staff1 is a non-observer assigned SME
  expect(resp.ok()).toBeTruthy()
  const rca = await resp.json() as { what_md: string }
  expect(rca.what_md).toMatch(/E2E R12/)
})

// ---------------------------------------------------------------------------
// R13 — Observer member CANNOT write the RCA (HC048)
// ---------------------------------------------------------------------------

test('R13: observer member gets HC048 on any write', async ({ request }) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL, undefined, 'pqs_member')

  // Add chefe.farm as an observer on the RCA
  const FARM_ID = '00000000-0000-0000-0000-000000000005'
  const addResp = await rpc(request, 'add_rca_member', adminToken, {
    p_rca_id: RCA_ID,
    p_role: 'observer',
    p_user_id: FARM_ID,
  })
  expect(addResp.ok()).toBeTruthy()

  // Now chefe.farm tries to write — must be rejected with HC048
  const farmToken = await getOwnerToken(request, FARM_EMAIL)
  const writeResp = await rpc(request, 'update_rca', farmToken, {
    p_rca_id: RCA_ID,
    p_what_md: 'Tentativa de escrita pelo observador — deve ser rejeitada',
  })
  expect(writeResp.status()).not.toBe(200)
  const body = await writeResp.json() as { code?: string; message?: string }
  expect(body.code ?? body.message ?? '').toMatch(/HC048|observer|não pode/i)

  // Clean up: remove the observer so it does not affect other tests
  const members = await restGet<{ id: string; user_id: string }>(
    request,
    `rca_members?rca_id=eq.${RCA_ID}&user_id=eq.${FARM_ID}&select=id,user_id`,
    SUPABASE_SERVICE_KEY,
  )
  if (members.length > 0) {
    await rpc(request, 'remove_rca_member', adminToken, { p_member_id: members[0].id })
  }
})

// ---------------------------------------------------------------------------
// R14 — Non-team non-PQS user gets 0 rows on SELECT (RLS isolates)
// ---------------------------------------------------------------------------

test('R14: non-team non-PQS user (chefe.farm, no observer membership) gets 0 rows on rca', async ({
  request,
}) => {
  // chefe.farm is not in the RCA team and not a PQS member.
  // After R13's cleanup the observer membership is removed.
  const farmToken = await getOwnerToken(request, FARM_EMAIL)
  const rows = await restGet<{ id: string }>(
    request,
    `rca?id=eq.${RCA_ID}&select=id`,
    farmToken,
  )
  expect(rows.length).toBe(0)
})

// ---------------------------------------------------------------------------
// R15 — RCA evidence bytes on the document substrate reject DELETE from an
// authenticated actor (Rule 6 immutability, HTTP layer)
// ---------------------------------------------------------------------------
//
// DM5·S4 retired `nsp-evidence` — the bucket row AND every policy naming it
// are gone. The ORIGINAL R15 issued a DELETE for a NONEXISTENT object on that
// (now-absent) bucket and asserted only "not 200/204". QA (dm5-s4-review.md
// finding B2) probed live with the real service key: a retired bucket, and
// the SURVIVING `documents-phi` / `form-assets` buckets, all return the
// IDENTICAL `HTTP 400 {"statusCode":"404"}` for that same request shape — the
// assertion could not tell "refused" from "absent", and it stayed green
// through the whole retirement.
//
// The property did not disappear: RCA/CAPA evidence bytes now land on the
// core document substrate. Verified live against `begin_document_upload`
// (2026-08-17): `rca`/`capa_action` resolve to tier='standard' →
// `documents-standard`, which — per the live catalog, re-checked in this same
// run — carries exactly ONE policy (`documents_std_obj_insert_reserved`,
// INSERT-only) and NO SELECT/UPDATE/DELETE policy at all.
//
// A DELETE against a REAL, EXISTING object on that bucket is STILL
// response-ambiguous for the same reason B2 named — the status code alone
// cannot be trusted — so the discriminating fact is never the DELETE's own
// status; it is what happens to the OBJECT. This test creates a real
// evidence file through the actual product corridor (begin → PUT → finalize
// → verify, the same path `dm5-nsp-evidence.spec.ts`'s EVID-RCA-UPLOAD-1
// exercises), attempts the DELETE as an ordinary authenticated actor, and
// then re-fetches the SAME object via the SERVICE ROLE (RLS bypassed) to
// prove the exact bytes are still there — the one fact no ambiguous status
// code can fake.
//
// ⛔ WHAT GUARDS THE BYTES — RE-CORRECTED 2026-08-17 (QA r2 MAJOR-3).
// A note here previously claimed the missing RLS policy was NOT the operative
// guard and that `storage.protect_objects_delete` was. **That is inverted on
// the path this test actually attacks.** The absent policies ARE the lock.
//
// `storage.protect_delete()` (body read from `pg_proc`) tests exactly one
// thing and is entirely ROLE-AGNOSTIC — whether
// `storage.allow_delete_query = 'true'`. ⭐ Its own HINT reads "Use the
// Storage API instead": the API sets that GUC on its own connection, so the
// trigger NEVER FIRES on an HTTP delete, for ANY caller. It guards direct SQL
// DML only — which is the context the DM5·S4 migration needs it for.
//
// The operative locks on the HTTP path are TWO absent policies, both ours:
// no SELECT policy (Postgres needs the row visible for the DELETE's WHERE)
// and no DELETE policy. Opening BOTH on `documents-standard` made the same
// authenticated HTTP DELETE this test issues return
// `200 {"message":"Successfully deleted"}` — the object was destroyed.
//
// ⭐ Why the earlier note went wrong, and it is worth reading before writing
// the next such experiment. It opened ONE of the two locks (delete policy, no
// select policy) AND probed at the raw-SQL layer — the one path where the
// trigger IS unconditional, hence the only path that CANNOT observe the RLS
// lock. It then read the survival as proof of the trigger. It even had the
// decisive datum below (the API sets the GUC) and scoped it to the service
// role, from a guard that does not look at roles at all.
//
// ⚠ So this test's protection is exactly ONE permissive policy wide, and
// `storage.objects` grants `arwdDxtm` to `authenticated` AND `anon` — there is
// no grant-level fallback. If anyone ever adds a read policy to
// `documents-standard` (a natural request: "let members download their own
// documents"), they must add no DELETE policy with it, and this test is what
// notices. Domain: LOCAL stack, both paths; NOT verified against Cloud.
//
// Proven able to FAIL, not merely written to pass — this exact test,
// unmodified except for the one line naming the attacker's bearer token,
// swapped to the SERVICE ROLE key (verified live via curl: PUT 200 → DELETE
// 200 "Successfully deleted" → GET 400). Run that way, R15 went RED —
// `expect(attackResp.status()).not.toBe(200)` failed with `Expected: not 200`,
// before the discriminating GET/byte-compare even ran. Reverted immediately
// back to the real actor token afterward and re-run to confirm GREEN.
//
// ⚠ CORRECTED 2026-08-17 (QA r2): this note used to explain the service role's
// success as it being "the one caller for whom the Storage API sets the bypass
// GUC". Wrong mechanism. The API sets that GUC for EVERY caller (the guard
// does not look at roles). The service role succeeds because it **bypasses
// RLS**, and RLS is the only thing refusing the others. Same observation,
// right red, wrong cause — and the wrong cause is what made the note above
// invert the guard.
//
// ⚠ NOTE (QA r2 INFO-7): the GET/byte-compare is a BELT, not a second
// independent lock. If the DELETE ever succeeds, R15 reds at `not.toBe(200)`
// first, so the byte compare would only become the failing assertion if a
// delete succeeded while returning a non-2xx status — no such combination is
// known to be reachable. Keep it (it is cheap and it is the fact no status
// code can fake), but do not count it as independent coverage.
test('R15: RCA evidence bytes on the document substrate reject DELETE from an authenticated actor — the object survives the attempt', async ({
  request,
}) => {
  const adminToken = await getOwnerToken(request, ADMIN_EMAIL, undefined, 'pqs_member')
  await ensureRcaStatus(request, adminToken, 'in_progress')

  const marker = `r15-immutability-${Date.now()}`
  const bytes = Buffer.from(`%PDF-1.4\n% R15 immutability marker ${marker}\n%%EOF\n`)
  const sha256 = createHash('sha256').update(bytes).digest('hex')

  // Real corridor: begin -> PUT (service role, planting the bytes) -> finalize
  // -> verify. Lands a genuine `file_objects` row on the substrate, exactly as
  // a real RCA evidence upload would.
  const begun = await beginRcaEvidenceUpload(request, adminToken, {
    title: `Evidência imutabilidade ${marker}`,
    declaredSize: bytes.length,
  })
  expect(begun.ok, `begin_document_upload(rca): ${JSON.stringify(begun.body)}`).toBeTruthy()
  const reservation = begun.body as { file_object_id: string; upload_session_id: string; document_id: string }

  await putBytesServiceRole(request, reservation.file_object_id, bytes, 'application/pdf')
  const finalized = await finalizeUpload(request, adminToken, reservation.upload_session_id)
  expect(finalized.ok, `finalize_document_upload: ${JSON.stringify(finalized.body)}`).toBeTruthy()
  const verified = await verifyUploadServiceRole(request, reservation.upload_session_id, sha256, true)
  expect(verified.ok, `complete_document_upload_verification: ${JSON.stringify(verified.body)}`).toBeTruthy()

  // Close the loop as genuine RCA evidence (not merely "a document") —
  // matches the property's own name.
  const evResp = await rpc(request, 'add_rca_evidence', adminToken, {
    p_rca_id: RCA_ID,
    p_kind: 'document',
    p_title: `Evidência imutabilidade ${marker}`,
    p_document_id: reservation.document_id,
  })
  expect(evResp.ok(), `add_rca_evidence: ${await evResp.text()}`).toBeTruthy()

  // Ground truth BEFORE the attack — service-role read (RLS bypassed): the
  // object is real, verified, and on one of the two buckets the property
  // moved to (never the retired one).
  const [fo] = await restGet<{ storage_bucket: string; storage_path: string; upload_state: string }>(
    request,
    `file_objects?id=eq.${reservation.file_object_id}&select=storage_bucket,storage_path,upload_state`,
    SUPABASE_SERVICE_KEY,
  )
  expect(fo, 'the evidence file_objects row exists').toBeTruthy()
  expect(fo.upload_state, 'the real PUT was verified before the attack').toBe('unscanned_accepted')
  expect(['documents-standard', 'documents-phi']).toContain(fo.storage_bucket)

  const objectPath = `${SUPABASE_URL}/storage/v1/object/${fo.storage_bucket}/${encodeURI(fo.storage_path)}`

  // The attack: an ordinary authenticated actor (never service role) attempts
  // to DELETE a real, existing evidence object.
  const attackResp = await request.delete(objectPath, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${adminToken}` },
  })
  // Weak signal only — recorded for context, never the sole proof (this is
  // exactly the status shape B2 showed is ambiguous between "refused" and
  // "absent"). What must not happen is a bare success.
  expect(attackResp.status(), 'a DELETE must never report bare success').not.toBe(200)
  expect(attackResp.status()).not.toBe(204)

  // The DISCRIMINATING fact: fetch the SAME object back via SERVICE ROLE
  // (RLS bypassed) and prove the exact bytes are still sitting at that path.
  // If the DELETE above had actually succeeded, this returns 404 and the
  // byte comparison below never runs.
  const afterResp = await request.get(objectPath, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  })
  expect(afterResp.status(), 'the object must still be downloadable after the attack (service role, RLS bypassed)').toBe(200)
  const afterBytes = await afterResp.body()
  expect(Buffer.compare(afterBytes, bytes), 'byte-for-byte unchanged — the attempted DELETE altered nothing').toBe(0)
})

// ---------------------------------------------------------------------------
// R16 — Keyboard-only: the RCA workspace page is keyboard reachable
// ---------------------------------------------------------------------------

test('R16: keyboard-only — RCA workspace loads and content is keyboard reachable', async ({
  page,
}) => {
  await signInAs(page, PQS_A_EMAIL)
  await page.goto(`/o/rede-a/nsp/rca/${RCA_ID}`)

  // Verify the page loaded the RCA workspace
  await expect(page.getByRole('main')).toBeVisible()

  // The RCA workspace has stable heading/breadcrumb text regardless of what_md content
  const html = await page.content()
  expect(html.toLowerCase()).toMatch(/análise de causa raiz|rca|workspace/i)

  // Tab multiple times until something focusable is reached
  let focused = 'BODY'
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab')
    focused = await page.evaluate(() => document.activeElement?.tagName ?? 'BODY')
    if (focused !== 'BODY') break
  }
  // At least one focusable element must exist (a link or button in the layout)
  expect(focused).not.toBe('BODY')
})

// ---------------------------------------------------------------------------
// R17 — RCA page is PHI-free (no patient identifiers appear)
// ---------------------------------------------------------------------------

test('R17: RCA workspace page contains NO patient PHI', async ({ page }) => {
  await signInAs(page, PQS_A_EMAIL)
  await page.goto(`/o/rede-a/nsp/rca/${RCA_ID}`)
  // Readiness before the PHI-absence snapshot: prove the workspace rendered.
  await expect(page.getByRole('main')).toBeVisible()

  const html = await page.content()
  // PHI from the seeded patient row (EV-0001's event_patient)
  expect(html).not.toContain('Paciente de Demonstração')
  expect(html).not.toContain('PRT-0099123')
  expect(html).not.toContain('1958-03-14')
})
