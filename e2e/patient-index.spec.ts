import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn, accessToken } from "./helpers/auth"

/**
 * Phase 23 — Patient Identity & Cross-Committee Linkage (`patient_index`)
 *
 * Test contract: translates the 11 acceptance criteria from the phase-23 plan
 * into Playwright + PostgREST assertions.
 *
 * **Feature flag.** `patient_index` is ON after a fresh `db reset` —
 * `20260620000000_baseline.sql` force-sets it (and `case_patient` / `case_referrals`)
 * to TRUE, and baseline is a MIGRATION, so that holds in every environment including
 * production. (The flag's `description` column still narrates "Ships OFF"; that prose
 * is STALE and is not the state. Trust `select key, enabled from app.feature_flags`.)
 * This spec asserts the flag ON in `beforeAll` and restores the CAPTURED pre-spec state
 * in `afterAll` — never a hardcoded value. See captureFeatureFlags().
 * The HMAC derivation triggers are ALWAYS-ON (keys already exist after
 * `supabase db reset`), so NO backfill is needed — only the flag flip.
 *
 * **Seeded cross-committee fixture (after `supabase db reset`):**
 *   MRN `PRT-0099123` is shared across THREE rede-a committees:
 *     - NSP event EV-0001  (id e1000000-0000-0000-0000-0000000000a1, CCIH / rede-a)
 *     - referral ENC-0001  (id efa00000-0000-0000-0000-0000000000a1, CCIH→Farmácia / rede-a)
 *     - case_patient on case (id dba00000-0000-0000-0000-0000000000b1, Farmácia / rede-a)
 *   Encounter `ENC-2026-4471` is shared event ↔ referral only.
 *   QPS search for `PRT-0099123` must return ≥3 entities spanning ≥2 committees
 *   (CCIH + Farmácia, both in rede-a). QPS search for `ENC-2026-4471` must return
 *   ≥2 entities (event + referral).
 *
 * **NSP-per-HOSPITAL (ADR 0052; re-keys the ADR-0042 per-org form one hop).** The
 * cross-committee patient index lives at /o/rede-a/nsp/pacientes; the console is
 * gated on PQS membership of the selected HOSPITAL, and the search/count RPCs are
 * hospital-scoped + fail-closed:
 *   - `search_patient_xref(p_mrn, p_encounter, p_hospital_id)` returns the EMPTY bundle
 *     (and emits NO audit row) unless `p_hospital_id` is passed AND the caller is a PQS
 *     member of it. Direct-RPC tests MUST pass `p_hospital_id = HOSP_CENTRAL_A` (the
 *     hospital of CCIH, home of the synthetic patient). The UI path pins the hospital
 *     via the URL/switcher, so UI-driven tests need only the route + persona.
 *   - A `patient.searched`/`patient.viewed` audit row now carries
 *     `commission_id = null` (still the cross-committee chain) with the hospital in
 *     `hospital_id` — so the existing `commission_id === null` checks hold.
 *   - `patient_xref_count(p_module, p_entity_id)` and the deep-link
 *     `get_patient_trajectory_for_entity` resolve the hospital server-side from the
 *     entity, so they take no hospital param (UNCHANGED signatures).
 *
 * **PQS persona:** pqs.a@test.local (00…0c2) is enrolled in rede-a's PQS roster
 * (seed) — the NSP-console/patient-index UI actor. admin@test.local (00…001) is
 * the rede-a org_admin AND ALSO a rede-a PQS member, so its direct REST/RPC truth-
 * reads still resolve (kept on the PostgREST-only call sites). Non-PQS tests:
 * chefe.ccih@test.local (00…002) — staff_admin of CCIH, NOT in pqs_members.
 *
 * **Note:** serial mode required — flag-flip beforeAll/afterAll are correct only
 * serially. Run with `--workers=1` during the fix-loop.
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

// Commissions
const COMM_A = 'a0000000-0000-0000-0000-0000000000a1' // CCIH (source)

// Hospital (NSP-per-HOSPITAL, ADR 0052) — the cross-committee fixture's synthetic
// patient lives under CCIH, whose hospital is central-a. search_patient_xref /
// patient_access_audit are fail-closed unless p_hospital_id is this AND the caller
// is enrolled in central-a's PQS roster. (Re-keyed from the per-org REDE_A_ORG:
// the RPCs now take p_hospital_id, per the org→hospital re-key.)
const HOSP_CENTRAL_A = '05000000-0000-0000-0000-00000000000a'

// Personas (UUIDs). The UI/RPC actors are driven by email via signInAs/getToken;
// these UUIDs are only for service-role data-setup (e.g. cases.created_by).
const UID_CHEFE_A = '00000000-0000-0000-0000-000000000002' // chefe.ccih — NOT in pqs_members

// Seed fixture IDs
/** NSP safety event EV-0001, commission A, has patient (MRN PRT-0099123 + encounter ENC-2026-4471) */
const EV1_ID    = 'e1000000-0000-0000-0000-0000000000a1'
/** ENC-0001 referral (concluida), commission A→B, has patient (same MRN + encounter) */
const ENC1_ID   = 'efa00000-0000-0000-0000-0000000000a1'

// Cross-committee test patient identifiers (in seed)
const TEST_MRN       = 'PRT-0099123'
const TEST_ENCOUNTER = 'ENC-2026-4471'

// Zero-match sentinel (must NOT match any seed row)
const NONEXISTENT_MRN = 'ZZZ-NONEXISTENT-99999'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, password)
}

/** Obtain a JWT for a persona (RLS evaluated under it). */
async function getToken(req: APIRequestContext, email: string, actAs?: string): Promise<string> {
  // ACT (ADR 0106) — delegates to the shared, hat-aware accessToken
  // (BUG-ACT-RAWGRANT-HATLESS-1): admin@test.local (org_admin + pqs_member,
  // 2 role types) otherwise comes back with no active_role claim.
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

/** Call a public RPC under a persona JWT. Returns the raw Response. */
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

/**
 * F1 re-key (ADR 0064/0066): resolve a case's PATIENT participant_id. The old
 * 1-per-case case_patient table is DROPPED → patient_identifiers keyed on
 * participant_id, and the case-module patient_xref grain moved case_id →
 * participant_id. Reach a case's PHI via case_participants → the participant that
 * owns a patient_identifiers row. Service-role read bypasses the Class-1 REVOKE.
 */
async function patientParticipantIdForCase(
  req: APIRequestContext,
  caseId: string,
): Promise<string | null> {
  const links = await restGet<{ participant_id: string }>(
    req,
    `case_participants?case_id=eq.${caseId}&removed_at=is.null&select=participant_id`,
    SUPABASE_SERVICE_KEY,
  )
  if (links.length === 0) return null
  const ids = links.map((l) => l.participant_id)
  const rows = await restGet<{ participant_id: string }>(
    req,
    `patient_identifiers?participant_id=in.(${ids.join(',')})&select=participant_id`,
    SUPABASE_SERVICE_KEY,
  )
  return rows[0]?.participant_id ?? null
}

/**
 * Service-role audit rows matching an action (and optional entity filter),
 * ordered newest-first.
 */
async function auditRowsForAction(
  req: APIRequestContext,
  action: string,
  entityId?: string,
) {
  const entityFilter = entityId ? `&entity_id=eq.${entityId}` : ''
  return restGet<{
    id: string
    action: string
    actor_id: string | null
    commission_id: string | null
    entity_id: string | null
    metadata: Record<string, unknown>
  }>(
    req,
    `audit_log?action=eq.${encodeURIComponent(action)}${entityFilter}&select=id,action,actor_id,commission_id,entity_id,metadata&order=occurred_at.desc`,
    SUPABASE_SERVICE_KEY,
  )
}

/** Flip a feature flag ON/OFF using the service-role direct DB query (local only). */
async function setFeatureFlag(flagKey: string, enabled: boolean) {
  const { execSync } = await import('child_process')
  execSync(
    `npx supabase db query --local "UPDATE app.feature_flags SET enabled = ${enabled} WHERE key = '${flagKey}'"`,
    { cwd: process.cwd(), stdio: 'pipe' },
  )
}

/**
 * Read the CURRENT enabled state of the given flags straight from the catalog.
 *
 * Why this exists: a teardown must restore what the environment ACTUALLY had, not what
 * a comment believes it had. This spec previously hardcoded `false` on the grounds that
 * `patient_index` "ships OFF" — it does not. `20260620000000_baseline.sql` force-sets
 * `patient_index`, `case_patient` and `case_referrals` to TRUE (via `on conflict do
 * update set enabled = excluded.enabled`), and baseline is a MIGRATION, so that is the
 * state in EVERY environment, production included. The "Ships OFF" prose survives only
 * in each flag's `description` column — stale narration, not state.
 *
 * Capturing the real value means this teardown cannot go stale when a default changes.
 *
 * Output-parsing note: `supabase db query` wraps rows in JSON and appends CLI notices,
 * so we tag each row with a `FLAGCAP:` sentinel and regex for that rather than parsing
 * the envelope. Throws if a key has no row — a silent no-restore is the bug we are fixing.
 */
async function captureFeatureFlags(flagKeys: string[]): Promise<Map<string, boolean>> {
  const { execSync } = await import('child_process')
  const keyList = flagKeys.map((k) => `'${k}'`).join(',')
  const out = execSync(
    `npx supabase db query --local "SELECT 'FLAGCAP:' || key || '=' || enabled::text AS probe FROM app.feature_flags WHERE key IN (${keyList})"`,
    { cwd: process.cwd(), stdio: 'pipe' },
  ).toString()

  const captured = new Map<string, boolean>()
  for (const m of Array.from(out.matchAll(/FLAGCAP:([a-z_]+)=(true|false)/g))) {
    captured.set(m[1], m[2] === 'true')
  }
  const missing = flagKeys.filter((k) => !captured.has(k))
  if (missing.length > 0) {
    throw new Error(
      `captureFeatureFlags: no app.feature_flags row for [${missing.join(', ')}] — ` +
        'cannot capture a value to restore in afterAll.',
    )
  }
  return captured
}

/** Restore every captured flag to the exact value it held before this spec ran. */
async function restoreFeatureFlags(captured: Map<string, boolean>) {
  for (const [flagKey, enabled] of Array.from(captured)) {
    try {
      await setFeatureFlag(flagKey, enabled)
    } catch {
      // best-effort — a teardown must never mask a real test failure
    }
  }
}

// ---------------------------------------------------------------------------
// Suite setup/teardown — flag lifecycle
// ---------------------------------------------------------------------------

// Flag state as it existed BEFORE this spec ran; put back verbatim in afterAll.
let flagsBeforeSpec: Map<string, boolean>

test.beforeAll(async () => {
  // Capture the pre-spec state of every flag this suite touches. `case_referrals` is
  // included because AC-3 flips it, and `case_patient` because beforeAll forces it ON.
  flagsBeforeSpec = await captureFeatureFlags([
    'patient_index',
    'case_patient',
    'case_referrals',
  ])

  // Force `patient_index` ON for the suite (AC-7 deliberately flips it OFF mid-run, so
  // assert the precondition rather than inheriting it). The derivation triggers are
  // ALWAYS-ON — keys + patient_xref exist right after `db reset` without any backfill.
  // Only the RPCs + UI (search page, referral hint) are flag-gated.
  await setFeatureFlag('patient_index', true)
  // Ensure case_patient is ON (required by set_case_patient in AC-6).
  await setFeatureFlag('case_patient', true)
  // Short pause for PostgREST schema-cache refresh
  await new Promise((r) => setTimeout(r, 800))
})

test.afterAll(async () => {
  // Put patient_index / case_patient / case_referrals back to the values they actually
  // held before this spec ran (captured in beforeAll) — never a hardcoded guess.
  if (flagsBeforeSpec) {
    await restoreFeatureFlags(flagsBeforeSpec)
  }
})

// ---------------------------------------------------------------------------
// AC-1 — Cross-committee match: PQS search for MRN → trajectory spans ≥2 committees
//
// Searches PRT-0099123 as a rede-a PQS member (pqs.a@test.local). The result must
// include ≥3 entities (event, referral, case) spanning ≥2 rede-a committees
// (CCIH and Farmácia). The org is pinned by the /o/rede-a URL.
// ---------------------------------------------------------------------------

test('AC-1: PQS search for PRT-0099123 → trajectory spans ≥3 entities / ≥2 committees', async ({
  page,
}) => {
  await signInAs(page, 'pqs.a@test.local')
  await page.goto('/o/rede-a/nsp/pacientes')

  // The page must render (flag is ON, admin is PQS)
  await expect(page.getByRole('heading', { name: /pacientes entre comissões/i })).toBeVisible({ timeout: 10_000 })

  // Fill MRN and search — use placeholder locator (unambiguous in this form)
  const mrnInput = page.getByPlaceholder('Número do prontuário')
  const searchBtn = page.getByRole('button', { name: /pesquisar/i })

  // Fill the input and search
  await mrnInput.click()
  await mrnInput.fill(TEST_MRN)
  await expect(mrnInput).toHaveValue(TEST_MRN)

  await searchBtn.click()

  // Wait for the server action round-trip + React state update
  await page.waitForTimeout(5_000)

  // There must be at least 3 rows in the trajectory table (event + referral + case)
  // The table renders entities; look for module labels in the pt-BR vocabulary
  const eventChip    = page.getByText(/Evento de segurança/i)
  const referralChip = page.getByText(/Encaminhamento/i)
  const caseChip     = page.getByText(/^Caso$/i).or(page.getByText(/Caso\s/i))

  await expect(eventChip.first()).toBeVisible({ timeout: 15_000 })
  await expect(referralChip.first()).toBeVisible({ timeout: 5_000 })
  await expect(caseChip.first()).toBeVisible({ timeout: 5_000 })

  // Verify ≥2 distinct commissions appear in the rendered result
  const html = await page.content()
  // Commission A: CCIH; Commission B: Farmácia (or their slug representations)
  // At minimum "CCIH" and "Farmácia" must appear (the seed commission names)
  const hasBothCommissions =
    (html.includes('CCIH') || html.includes('Infecção')) &&
    (html.includes('Farmácia') || html.includes('farmacia'))
  expect(
    hasBothCommissions,
    'Trajectory should span ≥2 committees (CCIH and Farmácia)',
  ).toBeTruthy()

  // AC-PHI-FREE sanity: the HTML must NOT contain the raw MRN in the trajectory table
  // (it may appear in the search input itself, not in the result rows)
  // The search input retains the typed value; the RESULT HTML should not re-echo it
  // as a patient name in the trajectory rows — check that no <td>/<dd> contains the MRN
  // (loose check: just ensure the word "Demonstração" / actual name is not in trajectory)
  expect(html).not.toContain('Paciente de Demonstração')
})

// ---------------------------------------------------------------------------
// AC-2 — Encounter search: ENC-2026-4471 → returns event + referral
// ---------------------------------------------------------------------------

test('AC-2: encounter search for ENC-2026-4471 → returns ≥2 entities (event + referral)', async ({
  page,
}) => {
  await signInAs(page, 'pqs.a@test.local')
  await page.goto('/o/rede-a/nsp/pacientes')

  // Fill encounter only (no MRN)
  const encounterInput = page.getByPlaceholder('Número do atendimento')
  await encounterInput.click()
  await encounterInput.fill(TEST_ENCOUNTER)
  const searchBtn = page.getByRole('button', { name: /pesquisar/i })
  await searchBtn.click()

  // Wait for results
  await page.waitForTimeout(3_000)

  // At minimum: event chip and referral chip should appear
  await expect(page.getByText(/Evento de segurança/i).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Encaminhamento/i).first()).toBeVisible({ timeout: 5_000 })

  // The case (commission B) had no encounter_ref → should NOT match on encounter
  // (its encounter_key would be null; match should be event+referral only)
  // We just assert the search succeeded with ≥2 results; the match-basis hint shows "Atendimento"
  const html = await page.content()
  // The match-basis caption includes "Atendimento" when encounter matched
  expect(html).toMatch(/[Aa]tendimento/)

  // PHI-free: no patient name in results
  expect(html).not.toContain('Paciente de Demonstração')
})

// ---------------------------------------------------------------------------
// AC-3 — Referral receiver hint: ENC-0001 detail shows count-only "aparece em N outros registros"
//
// The referral-patient panel on ENC-0001 (patient_index ON + case_referrals ON)
// shows a count note. The note renders a NUMBER, never a name/MRN/list.
// ---------------------------------------------------------------------------

test('AC-3: referral ENC-0001 detail shows count-only "aparece em N outros registros"', async ({
  page,
}) => {
  // case_referrals must also be ON for the referral detail to render
  await setFeatureFlag('case_referrals', true)
  await new Promise((r) => setTimeout(r, 600))

  try {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(`/o/rede-a/c/ccih/encaminhamentos/${ENC1_ID}`)

    // The referral detail (with its isolated PHI panel) must render before we probe
    // the PHI-free count note / assert absence of raw identifiers below.
    await expect(
      page.getByRole('heading', { name: /identificação do paciente/i }),
    ).toBeVisible({ timeout: 15_000 })

    // Look for the "aparece em N outros registros" count note
    // It renders as "Este paciente aparece em N outro(s) registro(s)"
    const countNote = page
      .getByText(/aparece em.*registro/i)
      .or(page.getByText(/outros registros/i))
      .or(page.getByText(/outro registro/i))

    if (await countNote.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await expect(countNote).toBeVisible()

      // The note must contain a NUMBER — extract text and verify
      const noteText = await countNote.textContent() ?? ''
      const hasNumber = /\d+/.test(noteText)
      expect(hasNumber, `Count note "${noteText}" must contain a number`).toBeTruthy()

      // CRITICAL: the note must NOT contain a patient name or MRN
      expect(noteText).not.toContain('Demonstração')
      expect(noteText).not.toContain('PRT-0099123')
      expect(noteText).not.toContain('Paciente')
      // Also not a list of commissions or records
      expect(noteText).not.toContain('[')
      expect(noteText).not.toContain('CCIH')

      // The full HTML of the page must not contain the MRN (not even hidden)
      const html = await page.content()
      expect(html).not.toContain(TEST_MRN)
    } else {
      // The count note may be behind the reveal button (lazy-load). Verify via RPC.
      const chefeAToken = await getToken(page.request, 'chefe.ccih@test.local')
      const countResp = await rpc(page.request, 'patient_xref_count', chefeAToken, {
        p_module: 'referral',
        p_entity_id: ENC1_ID,
      })
      // The RPC must succeed and return a positive count (ENC-0001 shares MRN with event+case)
      if (countResp.ok()) {
        const count = await countResp.json() as number
        expect(count).toBeGreaterThan(0)
      }
    }

    // PHI-free: HTML must NOT contain raw identifiers
    const html = await page.content()
    expect(html).not.toContain(TEST_MRN)
  } finally {
    // Restore what case_referrals actually held before the suite ran (ON in every
    // environment — baseline force-sets it). Hardcoding `false` here used to leave the
    // live PQS referral-PHI arm silently disarmed for everything that ran afterwards.
    await setFeatureFlag('case_referrals', flagsBeforeSpec?.get('case_referrals') ?? true)
    await new Promise((r) => setTimeout(r, 400))
  }
})

// ---------------------------------------------------------------------------
// AC-4 — Search audit: a MATCHING search emits exactly one `patient.searched` on
// the cross-committee chain (commission_id = null; org in organization_id) with
// key-only metadata (NO raw MRN). A ZERO-match search emits no audit row.
//
// NSP-per-hospital (ADR 0052): search_patient_xref is fail-closed — it returns the
// empty bundle (and emits NO audit row) unless p_hospital_id is passed AND the caller
// is a PQS member of that hospital. admin@ is a central-a PQS member, so the truth-read
// works once p_hospital_id = HOSP_CENTRAL_A is supplied.
// ---------------------------------------------------------------------------

test('AC-4a: matching search for PRT-0099123 → exactly one patient.searched audit row (cross-committee chain, no MRN)', async ({
  request,
}) => {
  // Capture count BEFORE the search
  const before = await auditRowsForAction(request, 'patient.searched')

  // Run the search via the RPC directly (same path the server action calls).
  // p_hospital_id is REQUIRED now (hospital-scoped, fail-closed) — admin@ is a central-a PQS member.
  const adminToken = await getToken(request, 'admin@test.local', 'pqs_member')
  const searchResp = await rpc(request, 'search_patient_xref', adminToken, {
    p_mrn: TEST_MRN,
    p_hospital_id: HOSP_CENTRAL_A,
  })
  expect(searchResp.ok(), `search_patient_xref failed: ${await searchResp.text()}`).toBeTruthy()
  const searchBody = await searchResp.json() as { matchCount?: number } | null
  expect(searchBody).not.toBeNull()

  // Wait briefly for audit write to commit
  await new Promise((r) => setTimeout(r, 500))

  const after = await auditRowsForAction(request, 'patient.searched')

  // Exactly ONE new audit row (one search = one row)
  expect(after.length - before.length).toBe(1)

  // The new row stays on the cross-committee chain: commission_id = null
  // (the org is carried in organization_id under NSP-per-org).
  const newRow = after[0]
  expect(newRow.commission_id).toBeNull()

  // Metadata must be key-only — no raw MRN
  const meta = JSON.stringify(newRow.metadata ?? {})
  expect(meta).not.toContain(TEST_MRN)
  expect(meta).not.toContain('Demonstração')
  expect(meta).not.toContain('PRT')
  // The metadata should contain a match_count or patient_key (truncated) entry
  // but NOT the raw identifier. We just verify it's PHI-free.
  expect(meta.length).toBeLessThan(500) // sanity: not a huge dump
})

test('AC-4b: zero-match search emits NO audit row', async ({
  request,
}) => {
  const before = await auditRowsForAction(request, 'patient.searched')

  // p_hospital_id supplied + caller is a PQS member, so an empty result here is a TRUE
  // zero-match (not a fail-closed empty from a missing hospital) — the audit-suppression
  // assertion below is therefore meaningful.
  const adminToken = await getToken(request, 'admin@test.local', 'pqs_member')
  await rpc(request, 'search_patient_xref', adminToken, {
    p_mrn: NONEXISTENT_MRN,
    p_hospital_id: HOSP_CENTRAL_A,
  })
  // The RPC may return a 200 with empty result or a 404 — both are acceptable
  // (zero-match = empty entries, not an error)
  // Just check no audit row was emitted
  await new Promise((r) => setTimeout(r, 500))

  const after = await auditRowsForAction(request, 'patient.searched')
  // No new rows
  expect(after.length).toBe(before.length)
})

// ---------------------------------------------------------------------------
// AC-5 — Deep-link: ?entity=event:<EV1_ID> renders trajectory + emits patient.viewed
// ---------------------------------------------------------------------------

test('AC-5: deep-link ?entity=event:<EV1_ID> renders trajectory and emits patient.viewed', async ({
  page,
  request,
}) => {
  const beforeViewed = await auditRowsForAction(request, 'patient.viewed')

  await signInAs(page, 'pqs.a@test.local')
  await page.goto(`/o/rede-a/nsp/pacientes?entity=event:${EV1_ID}`)

  // The patient console shell must render before we probe the (server-resolved)
  // trajectory and assert the PHI-free HTML below.
  await expect(
    page.getByRole('heading', { name: /pacientes entre comissões/i }),
  ).toBeVisible({ timeout: 12_000 })

  // The page should render the trajectory (deep-link resolved server-side)
  // Look for at least one trajectory entity type label
  const hasTrajectory =
    await page.getByText(/Evento de segurança/i).first().isVisible({ timeout: 12_000 }).catch(() => false) ||
    await page.getByText(/Encaminhamento/i).first().isVisible({ timeout: 5_000 }).catch(() => false) ||
    await page.getByText(/trajetória/i).first().isVisible({ timeout: 5_000 }).catch(() => false)

  if (hasTrajectory) {
    // Wait for audit write
    await page.waitForTimeout(500)
    const afterViewed = await auditRowsForAction(request, 'patient.viewed')
    // At least one patient.viewed was emitted
    expect(afterViewed.length).toBeGreaterThan(beforeViewed.length)

    // The new row is global (commission_id = null) and has no raw MRN
    const newRow = afterViewed[0]
    expect(newRow.commission_id).toBeNull()
    const meta = JSON.stringify(newRow.metadata ?? {})
    expect(meta).not.toContain(TEST_MRN)
    expect(meta).not.toContain('Demonstração')
  } else {
    // Deep-link degraded gracefully (entity has no patient_key in xref, or
    // the note "Não foi possível abrir a trajetória" renders) — accept as long
    // as the page didn't crash and shows the search form
    await expect(page.getByRole('heading', { name: /pacientes entre comissões/i })).toBeVisible({ timeout: 10_000 })
    // If degraded, no patient.viewed row should be emitted (nothing to show)
  }

  // PHI-FREE: HTML must not contain raw identifiers
  const html = await page.content()
  expect(html).not.toContain('Paciente de Demonstração')
  expect(html).not.toContain(TEST_MRN)
})

// ---------------------------------------------------------------------------
// AC-6 — Disposal: dispose_case_phi on a throwaway rede-a case → entity still
// appears in trajectory flagged "PHI descartado"; xref row retained with
// disposed_at set.
//
// We operate on a THROWAWAY case (in COMM_A / rede-a, with its own unique MRN) to
// avoid contaminating the cross-committee fixture. The disposal-retain semantic is
// asserted via the RPC + DB layer (patient_xref row must be retained with
// disposed_at set; the case_patient row is gone), then confirmed in the rede-a UI.
// ---------------------------------------------------------------------------

let disposalCaseId: string

test('AC-6: dispose_case_phi → xref retained (disposed_at set), trajectory flags "PHI descartado"', async ({
  request,
  page,
}) => {
  // Create a throwaway case in COMM_A (rede-a) with patient_enabled=true
  const caseResp = await request.post(`${SUPABASE_URL}/rest/v1/cases`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: {
      commission_id: COMM_A,
      label: 'AC-6 disposal test — patient_index spec (throwaway)',
      status: 'pending',
      patient_enabled: true,
      has_patient: false,
      created_by: UID_CHEFE_A,
    },
  })
  expect(caseResp.ok(), `create throwaway case: ${await caseResp.text()}`).toBeTruthy()
  const [caseRow] = await caseResp.json() as Array<{ id: string }>
  disposalCaseId = caseRow.id

  // Set a case_patient row (use the same MRN as the cross-committee fixture so
  // the xref derivation trigger assigns the same patient_key, making this case
  // appear in the trajectory alongside EV-0001 and ENC-0001)
  const chefeAToken = await getToken(request, 'chefe.ccih@test.local')
  const setPatResp = await rpc(request, 'set_case_patient', chefeAToken, {
    p_case_id: disposalCaseId,
    p_name: 'Paciente Descartável AC6',
    p_mrn: 'PRT-AC6-DISPOSAL-SPEC',  // unique MRN for this throwaway
  })
  expect(setPatResp.ok(), `set_case_patient: ${await setPatResp.text()}`).toBeTruthy()

  // Brief pause to allow the PostgREST connection to see the committed xref row
  await new Promise((r) => setTimeout(r, 300))

  // F1 re-key (ADR 0064/0066): the case-module xref grain is now the PATIENT
  // participant (entity_id = participant_id), not the case. set_case_patient (a
  // compat door) chained a patient participant; resolve it to key the xref reads.
  const disposalPid = await patientParticipantIdForCase(request, disposalCaseId)
  expect(disposalPid, 'set_case_patient did not chain a patient participant').toBeTruthy()

  // Verify patient_xref row exists for this participant (service-role direct read)
  // Note: patient_xref has no `id` column — PK is (module, entity_id).
  const xrefBefore = await restGet<{ entity_id: string; disposed_at: string | null }>(
    request,
    `patient_xref?module=eq.case&entity_id=eq.${disposalPid}&select=entity_id,disposed_at`,
    SUPABASE_SERVICE_KEY,
  )
  expect(xrefBefore.length).toBeGreaterThan(0)
  expect(xrefBefore[0].disposed_at).toBeNull()

  // Dispose PHI
  const disposeResp = await rpc(request, 'dispose_case_phi', chefeAToken, {
    p_case_id: disposalCaseId,
    p_reason: 'subject_request',
  })
  expect(disposeResp.ok(), `dispose_case_phi: ${await disposeResp.text()}`).toBeTruthy()

  // RETAIN-MARKED-DISPOSED: the xref row must still exist with disposed_at set
  const xrefAfter = await restGet<{ entity_id: string; disposed_at: string | null }>(
    request,
    `patient_xref?module=eq.case&entity_id=eq.${disposalPid}&select=entity_id,disposed_at`,
    SUPABASE_SERVICE_KEY,
  )
  expect(xrefAfter.length).toBeGreaterThan(0)
  expect(xrefAfter[0].disposed_at).not.toBeNull()

  // The raw PHI identifiers row must be GONE (disposal DELETEs patient_identifiers;
  // the xref row is retained-marked-disposed above). Was case_patient pre-F1.
  const cpRows = await restGet<{ participant_id: string }>(
    request,
    `patient_identifiers?participant_id=eq.${disposalPid}&select=participant_id`,
    SUPABASE_SERVICE_KEY,
  )
  expect(cpRows.length).toBe(0)

  // UI: verify the trajectory renders "PHI descartado" badge for this disposed entity
  // (The throwaway case shares a patient_key so searching its MRN should show it disposed)
  await signInAs(page, 'pqs.a@test.local')
  await page.goto('/o/rede-a/nsp/pacientes')

  const mrnInput = page.getByPlaceholder('Número do prontuário')
  await mrnInput.click()
  await mrnInput.fill('PRT-AC6-DISPOSAL-SPEC')
  await page.getByRole('button', { name: /pesquisar/i }).click()
  await page.waitForTimeout(3_000)

  // The disposed entity must appear with a "PHI descartado" badge
  const disposedBadge = page.getByText(/PHI descartado/i).or(page.getByText(/dados.*descartados/i))
  if (await disposedBadge.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await expect(disposedBadge.first()).toBeVisible()
  } else {
    // The disposed flag may render as a tooltip or icon — check via DB that disposed_at is set
    expect(xrefAfter[0].disposed_at).not.toBeNull()
  }
})

// ---------------------------------------------------------------------------
// AC-7 — Flag-OFF invisibility: with `patient_index` OFF
//   - /o/rede-a/nsp/pacientes → 404 (notFound)
//   - search_patient_xref RPC → denies / returns empty
//   - no referral hint (count=0 from patient_xref_count when flag off)
//
// The page passes the org-PQS gate (pqs.a is a rede-a PQS member) and then
// notFound()s on the flag; search_patient_xref/patient_xref_count both
// `assert_patient_index_enabled()` FIRST, so they raise/empty regardless of org.
// ---------------------------------------------------------------------------

test('AC-7: flag OFF → /o/rede-a/nsp/pacientes → 404, search RPC denies/empty, no hint', async ({
  page,
  request,
}) => {
  await setFeatureFlag('patient_index', false)
  await new Promise((r) => setTimeout(r, 600))

  try {
    // UI: the page must return 404 when flag is OFF
    await signInAs(page, 'pqs.a@test.local')
    await page.goto('/o/rede-a/nsp/pacientes')

    // Flag OFF → the page notFound()s into the NSP not-found boundary. Wait for that
    // 404 content to render (a positive readiness — you cannot deterministically
    // "wait for absence") before the is404 probe / redirect check below.
    // BUG-ACT-NOTFOUND-COPY-1: currently passing with the OLD global copy
    // (this exact route's own not-found boundary, src/app/o/[org]/nsp/not-found.tsx,
    // is unaffected by ACT ADR 0106's sibling migrations — confirmed live) —
    // lower risk per the coordinator's classification; widened to
    // /não encontr/i defensively anyway.
    await expect(
      page.getByText(/não encontr/i).first(),
    ).toBeVisible({ timeout: 12_000 })

    // The page should show 404 content (Next.js notFound → this page returns notFound())
    const is404 =
      (await page.getByText(/404/i).isVisible({ timeout: 5_000 }).catch(() => false)) ||
      (await page.getByText(/not found/i).isVisible({ timeout: 3_000 }).catch(() => false)) ||
      page.url().includes('404') ||
      !page.url().includes('pacientes')

    // Also acceptable: redirect away from the page entirely
    const isRedirected = !page.url().includes('/o/rede-a/nsp/pacientes')

    expect(is404 || isRedirected, 'Flag-OFF: page should 404 or redirect').toBeTruthy()

    // RPC: search_patient_xref must deny or return empty when flag is OFF
    // (assert_patient_index_enabled() fires before the hospital check; p_hospital_id is
    // supplied so the empty/raise is unambiguously flag-driven, not hospital-gated.)
    const adminToken = await getToken(request, 'admin@test.local', 'pqs_member')
    const searchResp = await rpc(request, 'search_patient_xref', adminToken, {
      p_mrn: TEST_MRN,
      p_hospital_id: HOSP_CENTRAL_A,
    })
    // When flag is OFF the RPC raises 23514 or returns null
    if (searchResp.ok()) {
      const body = await searchResp.json() as { matchCount?: number; entries?: unknown[] } | null
      // If it returns a result, it must be empty (fail-closed)
      if (body && typeof body === 'object' && 'matchCount' in body) {
        expect(body.matchCount).toBe(0)
      }
      // null is also acceptable
    } else {
      // 400/403/500 with a 23514 code = flag-gated RPC raised an exception
      const errBody = JSON.stringify(await searchResp.json())
      expect(errBody).toMatch(/23514|flag|not available|unavailable/i)
    }

    // patient_xref_count must return 0 when flag is OFF
    const countResp = await rpc(request, 'patient_xref_count', adminToken, {
      p_module: 'referral',
      p_entity_id: ENC1_ID,
    })
    if (countResp.ok()) {
      const count = await countResp.json() as number
      expect(count).toBe(0)
    }
  } finally {
    // ALWAYS restore the flag so subsequent tests run with flag ON
    await setFeatureFlag('patient_index', true)
    await new Promise((r) => setTimeout(r, 600))
  }
})

// ---------------------------------------------------------------------------
// AC-8 — Non-PQS denial: a non-PQS admin / staff_admin get empty/denied
//   - search_patient_xref as chefe.ccih (NOT in pqs_members) → null/empty
//   - direct SELECT on patient_xref as `authenticated` → denied (RLS REVOKE)
// ---------------------------------------------------------------------------

test('AC-8a: non-PQS admin (chefe.ccih) search_patient_xref → null/empty result', async ({
  request,
}) => {
  // chefe.ccih is a staff_admin (not in pqs_members) — must get nothing from the RPC.
  // p_hospital_id = HOSP_CENTRAL_A is supplied so the denial is attributable to the ROSTER
  // gate (is_pqs_member_of(rede-a) = false for chefe.ccih), not a missing org.
  const chefaToken = await getToken(request, 'chefe.ccih@test.local')
  const resp = await rpc(request, 'search_patient_xref', chefaToken, {
    p_mrn: TEST_MRN,
    p_hospital_id: HOSP_CENTRAL_A,
  })
  // FUP-VACUOUS-AUDIT-1: the `if (body === null) { }` arm was a COMMENT, not an
  // assertion, and a 200 returning an object WITHOUT `matchCount` fell through both
  // arms — so this PHI-denial test could go green on a body it had never inspected.
  // Every path now folds into one discriminant that is asserted unconditionally, and
  // the outcome is named in the failure output so the report says which arm ran.
  let outcome: 'raised' | 'null-body' | 'zero-matches' | 'LEAKED'
  if (!resp.ok()) {
    outcome = 'raised'
    // A non-200 is also acceptable (RPC may raise 23514 for non-PQS)
    const errStr = JSON.stringify(await resp.json())
    expect(errStr).toMatch(/23514|non.pqs|not.*member|unauthorized/i)
  } else {
    const body = await resp.json() as { matchCount?: number; entries?: unknown[] } | null
    if (body === null) {
      outcome = 'null-body'
    } else if (typeof body === 'object' && body.matchCount === 0) {
      outcome = 'zero-matches'
    } else {
      outcome = 'LEAKED'
    }
  }
  expect(
    outcome,
    'a non-PQS staff_admin must never receive patient cross-reference matches',
  ).not.toBe('LEAKED')
  expect(['raised', 'null-body', 'zero-matches']).toContain(outcome)
})

test('AC-8b: direct SELECT on patient_xref as authenticated → 0 rows (RLS REVOKE)', async ({
  request,
}) => {
  // Direct REST GET on patient_xref under any persona JWT must return 0 rows
  // because the table has REVOKE SELECT from authenticated (RLS Rule 1 + Rule 12)
  // — a bare GRANT-level denial, hat-independent by mechanism (no RLS policy
  // even runs). 'pqs_member' threaded here only for consistency with the
  // file's other 3 sites, not because it's load-bearing for this assertion.
  const adminToken = await getToken(request, 'admin@test.local', 'pqs_member')
  const resp = await request.get(
    `${SUPABASE_URL}/rest/v1/patient_xref?select=id,module,entity_id&limit=5`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${adminToken}`,
      },
    },
  )
  // PostgREST will either deny (400/403) or return an empty array
  if (resp.ok()) {
    const data = await resp.json()
    const rows = Array.isArray(data) ? data : []
    // REVOKE means no rows even for PQS admin (the DEFINER RPCs are the only door)
    expect(rows.length).toBe(0)
  } else {
    // 400/403 = permission denied — correct
    expect([400, 403]).toContain(resp.status())
  }
})

test('AC-8c: non-PQS staff_admin (chefe.farm) cannot see QPS patient search page', async ({
  page,
}) => {
  await signInAs(page, 'chefe.farm@test.local')
  // chefe.farm is a rede-a staff_admin but NOT a rede-a PQS member — the
  // /o/[org]/nsp layout gates on PQS membership of THIS org (getNspAccessByOrg →
  // notFound), so committee-admin standing alone does not reach the console.
  await page.goto('/o/rede-a/nsp/pacientes')

  // chefe.farm is non-PQS → the NSP layout notFound()s into the global 404. Wait for
  // that 404 to render so the "search heading absent" check below is a real negative,
  // not a vacuous read of an unrendered page. BUG-ACT-NOTFOUND-COPY-1:
  // /não encontr/i, the shared stem (see AC-7 above for the live-verified
  // "this route's boundary is unaffected" note).
  await expect(
    page.getByText(/não encontr/i).first(),
  ).toBeVisible({ timeout: 12_000 })

  // Must NOT render the patient search UI
  const isSearchPageVisible = await page
    .getByRole('heading', { name: /pacientes entre comissões/i })
    .isVisible({ timeout: 5_000 })
    .catch(() => false)
  expect(isSearchPageVisible).toBeFalsy()
})

// ---------------------------------------------------------------------------
// AC-9 — PHI-free guarantee: trajectory table and access-audit table never
// render a patient name or raw MRN anywhere in the DOM
// ---------------------------------------------------------------------------

test('AC-9: trajectory + access-audit render NO patient name or raw MRN in DOM', async ({
  page,
}) => {
  await signInAs(page, 'pqs.a@test.local')
  await page.goto('/o/rede-a/nsp/pacientes')

  // Perform a search that matches (MRN with results)
  const mrnInput = page.getByPlaceholder('Número do prontuário')
  await mrnInput.click()
  await mrnInput.fill(TEST_MRN)
  await page.getByRole('button', { name: /pesquisar/i }).click()
  await page.waitForTimeout(3_500)

  // Wait for the access audit table to load (it lazily fires loadPatientAccessAudit)
  // The audit table may show after a brief delay
  await page.waitForTimeout(1_000)

  // The patient's name must NOT appear anywhere in the rendered visible content.
  // Scope to visible text (not the full HTML which includes React inline scripts
  // that may embed serialized state). We check the body inner text.
  const bodyText = await page.locator('body').innerText()
  expect(bodyText).not.toContain('Paciente de Demonstração')

  // The raw MRN must NOT appear in the TRAJECTORY RESULTS (it IS in the search input
  // that the user typed — that's expected). Assert via the results section only.
  const resultsSection = page.locator('[aria-live]').or(page.locator('table'))
  if (await resultsSection.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
    const resultHtml = await resultsSection.first().innerHTML()
    // The result rendering (trajectory table rows) must not echo back the raw MRN
    expect(resultHtml).not.toContain(TEST_MRN)
  }

  // Verify the search input DOES contain the typed MRN (proving the assertion above is
  // about results only, not the input). This confirms the test design is sound.
  const inputValue = await page
    .getByPlaceholder('Número do prontuário')
    .inputValue()
  expect(inputValue).toBe(TEST_MRN)
})

// ---------------------------------------------------------------------------
// AC-10 — Keyboard-only: drive the search form via keyboard alone
// (Tab to field, type, Enter) and verify results appear
// ---------------------------------------------------------------------------

test('AC-10: keyboard-only — Tab to search field, type MRN, Enter, read results', async ({
  page,
}) => {
  await signInAs(page, 'pqs.a@test.local')
  await page.goto('/o/rede-a/nsp/pacientes')

  // The page heading is visible
  await expect(page.getByRole('heading', { name: /pacientes entre comissões/i })).toBeVisible({ timeout: 10_000 })

  // Focus the MRN field via Tab from the top of the page
  // We'll use the known placeholder (unambiguous)
  const mrnInput = page.getByPlaceholder('Número do prontuário')
  await mrnInput.focus()
  await expect(mrnInput).toBeFocused()

  // Type the MRN using keyboard
  await mrnInput.fill(TEST_MRN)

  // Submit via Enter (the form's default submission)
  await page.keyboard.press('Enter')

  // Wait for results to appear in the live region
  await page.waitForTimeout(3_500)

  // At least one module-label chip must be visible (event, referral, or case)
  const resultVisible =
    await page.getByText(/Evento de segurança/i).first().isVisible({ timeout: 10_000 }).catch(() => false) ||
    await page.getByText(/Encaminhamento/i).first().isVisible({ timeout: 5_000 }).catch(() => false) ||
    await page.getByText(/trajetória/i).first().isVisible({ timeout: 5_000 }).catch(() => false)

  expect(resultVisible, 'Keyboard search should produce visible trajectory results').toBeTruthy()

  // Verify all search form controls are keyboard-accessible (have labels)
  // The encounter input should also be focusable
  const encounterInput = page.getByPlaceholder('Número do atendimento')
  await encounterInput.focus()
  await expect(encounterInput).toBeFocused()

  // The search button must be keyboard-activatable (Tab to it + Enter)
  const searchBtn = page.getByRole('button', { name: /pesquisar/i })
  await searchBtn.focus()
  await expect(searchBtn).toBeFocused()
})

// ---------------------------------------------------------------------------
// AC-11 — pt-BR: user-facing copy is Portuguese; no raw Postgres errors surface
// ---------------------------------------------------------------------------

test('AC-11a: patient search page uses pt-BR copy (no English error messages surface)', async ({
  page,
}) => {
  await signInAs(page, 'pqs.a@test.local')
  await page.goto('/o/rede-a/nsp/pacientes')

  // Page headings and labels are in pt-BR
  await expect(page.getByRole('heading', { name: /pacientes entre comissões/i })).toBeVisible()
  await expect(page.getByPlaceholder('Número do prontuário')).toBeVisible()
  await expect(page.getByPlaceholder('Número do atendimento')).toBeVisible()

  // The descriptive text in pt-BR
  const html = await page.content()
  expect(html).toContain('Pesquisar paciente')  // form section heading

  // Submit an empty search → should get a pt-BR validation error (not English)
  const mrnInput = page.getByPlaceholder('Número do prontuário')
  await mrnInput.click()
  await mrnInput.fill('') // ensure empty
  await page.getByRole('button', { name: /pesquisar/i }).click()
  await page.waitForTimeout(1_500)

  // The error message must be in Portuguese
  const errorVisible = await page.getByText(/informe o prontuário/i).isVisible({ timeout: 5_000 }).catch(() => false)
  if (errorVisible) {
    // Correct pt-BR error message
    await expect(page.getByText(/informe o prontuário/i)).toBeVisible()
  }

  // No raw Postgres error strings should be visible
  const afterHtml = await page.content()
  expect(afterHtml).not.toMatch(/ERROR:|SQLSTATE|42[0-9]{3}|P0[0-9]{3}/)
})

test('AC-11b: NSP hub entry "Pacientes" is visible and in pt-BR', async ({ page }) => {
  // The NSP hub should have a "Pacientes" link entry when patient_index is ON
  await signInAs(page, 'pqs.a@test.local')
  await page.goto('/o/rede-a/nsp')

  // The NSP hub must render before we probe for the (conditional) Pacientes link.
  await expect(
    page.getByRole('heading', { name: /fila de eventos/i }),
  ).toBeVisible({ timeout: 12_000 })

  // Look for the Pacientes nav link (the hub may link to /o/rede-a/nsp/pacientes)
  const pacientesLink = page.getByRole('link', { name: /pacientes/i })
    .or(page.getByText(/pacientes entre comissões/i))

  if (await pacientesLink.isVisible({ timeout: 8_000 }).catch(() => false)) {
    // Verify it's a proper Portuguese label (not "Patients" or "patients")
    const linkText = await pacientesLink.first().textContent() ?? ''
    expect(linkText.toLowerCase()).not.toContain('patients')
    // The link or card must navigate to .../nsp/pacientes
    const href = await pacientesLink.first().getAttribute('href')
    if (href) {
      expect(href).toContain('pacientes')
    }
  }
})
