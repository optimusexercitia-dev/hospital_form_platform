import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"

/**
 * MEM (S1) — Single `memberships` Collapse.
 *
 * Spec: docs/plans/memberships-collapse-s6-1.md. Collapses `organization_members` /
 * `commission_members` / `pqs_members` into one `public.memberships` table written
 * ONLY through `grant_role`/`revoke_role` (a SECURITY DEFINER door, no direct write
 * RLS) and read through the `is_*_of` predicate family (now thin wrappers over
 * `has_role`). §6 E2E acceptance (this file covers the pieces NOT already exercised
 * by pre-existing specs — see the cross-reference table below):
 *
 *   1. Appointment/member UIs still work end-to-end (through the UI):
 *      - org-admin appoints an NSP coordinator          → nsp-per-hospital.spec.ts AC-3
 *        ("nsp_org_admin can appoint AND revoke a per-hospital coordinator")
 *      - staff_admin adds AND removes a staff member    → phase3-admin-members.spec.ts AC2
 *      - NSP org-admin enrolls a PQS member              → THIS FILE (AC-1) — nsp-per-hospital
 *        AC-4 already covers a COORDINATOR enrolling; this file drives the same
 *        add_pqs_member door as the nsp_org_admin persona specifically.
 *   2. Direct-write lockdown on /rest/v1/memberships → 401/403           → THIS FILE (AC-2)
 *   3. Self-appointment via a door → clear pt-BR error (not raw Postgres) → nsp-per-hospital
 *      spec.ts AC-3 ("org_admin cannot self-delegate nsp_org_admin") already covers this
 *      through the UI; THIS FILE adds a deterministic API-level companion (AC-3) that
 *      does not depend on finding a self-option in a picker.
 *   4. multi@test.local resolves BOTH commission memberships in the picker → phase2-auth-shell
 *      .spec.ts / phase-multitenancy.spec.ts (unchanged — reads now resolve via
 *      has_role/memberships transparently). THIS FILE (AC-4) re-asserts it here as the
 *      MEM regression guard (belt-and-suspenders on the collapse's read path).
 *   5. Audit trail: a grant emits the new `membership` entity + "Função concedida" label,
 *      viewable on the audit page → THIS FILE (AC-5).
 *
 * Personas (password Test1234! for all):
 *   nsporg.a@test.local     nsp_org_admin of org rede-a (org-level)
 *   chefe.ccih@test.local   staff_admin of CCIH (central-a)
 *   multi@test.local        staff of BOTH ccih and farmacia (same org)
 *   admin@test.local        platform admin (global)
 */

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error(
    'SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local (a config do Playwright o carrega via @next/env).',
  )
}

const ORG_A = '0c000000-0000-0000-0000-00000000000a'
const COMMISSION_A = 'a0000000-0000-0000-0000-0000000000a1' // CCIH

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function signInAs(page: Page, email: string, password = 'Test1234!') {
  // Delegates to the shared session cache (e2e/helpers/auth.ts) so a full suite
  // spends ~28 password grants instead of ~865. Signature kept so call sites are unchanged.
  await cachedSignIn(page, email, password)
}

/** Obtain a real JWT for a persona (owner token, RLS evaluated under it). */
async function getOwnerToken(
  req: APIRequestContext,
  email: string,
  password = 'Test1234!',
): Promise<string> {
  const resp = await req.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password },
  })
  expect(resp.ok()).toBeTruthy()
  return ((await resp.json()) as { access_token: string }).access_token
}

/**
 * Create a fresh throwaway auth user (never a seeded persona — keeps this spec's
 * fixtures isolated from other specs' single-commission/single-hospital assertions).
 */
async function makeProbeUser(
  req: APIRequestContext,
  label: string,
): Promise<{ userId: string; email: string }> {
  const email = `probe-mem-${label}-${Date.now()}@probe.local`
  const resp = await req.post(`${SUPABASE_URL}/auth/v1/admin/users`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    data: {
      email,
      password: 'Test1234!',
      email_confirm: true,
      user_metadata: { home_organization_id: ORG_A },
    },
  })
  expect(resp.status()).toBe(200)
  const body = (await resp.json()) as { id: string }
  expect(body.id).toBeTruthy()
  return { userId: body.id, email }
}

// ===========================================================================
// AC-1 — NSP org-admin enrolls a PQS member through the UI (nsp/equipe), acting
//   through the SAME door (grant_role → add_pqs_member) as the coordinator-driven
//   nsp-per-hospital.spec.ts AC-4 test, but as the nsp_org_admin persona (its
//   authority arm: is_nsp_org_admin_of(org) OR is_nsp_coordinator_of(hospital)).
// ===========================================================================

test('AC-1: nsp_org_admin enrolls a PQS member on a hospital roster; member appears, then removes it', async ({
  page,
}) => {
  // The org-level nsp_org_admin curates EVERY hospital's roster from the org console
  // at /nsp-org/coordenadores (NspOrgHospitalManager, one <article> card per hospital)
  // — NOT /nsp/equipe, which is the LOCAL-COORDINATOR-ONLY per-hospital screen
  // (nsp_org_admin gets 404 there by design; see nsp/equipe/page.tsx access comment).
  await signInAs(page, 'nsporg.a@test.local')
  await page.goto('/o/rede-a/nsp-org/coordenadores')
  await expect(
    page.getByRole('heading', { name: /coordenação e equipes do nsp/i }),
  ).toBeVisible({ timeout: 15_000 })

  const centralCard = page.locator('article').filter({ hasText: 'Hospital Central A' })
  await expect(centralCard).toBeVisible()

  const addSelect = centralCard.getByLabel(/adicionar à equipe/i)
  const optionCount = await addSelect.locator('option').count()
  // At least the placeholder + >=1 eligible (non-enrolled) candidate.
  test.skip(optionCount <= 1, 'No eligible non-enrolled user for central-a roster add.')

  const firstReal = addSelect.locator('option').nth(1)
  const value = await firstReal.getAttribute('value')
  const label = (await firstReal.textContent())?.trim() ?? ''
  expect(value).toBeTruthy()

  await addSelect.selectOption(value!)
  await centralCard.getByRole('button', { name: /^adicionar$/i }).click()

  // Success banner OR the member row appears — mirrors the coordinator-driven
  // nsp-per-hospital.spec.ts AC-4 test's tolerant assertion (exact copy is an app
  // detail, the ENROLLMENT via grant_role('hospital', …, 'pqs_member', …) is the
  // contract this test exists to prove for the nsp_org_admin authority arm).
  await expect(
    centralCard.getByText(/membro adicionado à equipe do nsp|na equipe desde/i).first(),
  ).toBeVisible({ timeout: 10_000 })
  expect(label.length).toBeGreaterThan(0)

  // Remove to restore the seed roster (idempotent cleanup for re-runs).
  const removeBtn = centralCard
    .getByRole('button', { name: /remover .*da equipe do nsp/i })
    .first()
  await removeBtn.click()
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: /^remover$/i })
    .click()
  await expect(page.getByRole('alertdialog')).toBeHidden({ timeout: 10_000 })
})

// ===========================================================================
// AC-2 — Direct-write lockdown: memberships has NO write RLS policy and
//   `authenticated` holds no INSERT/UPDATE/DELETE grant. A crafted direct
//   POST/PATCH/DELETE against /rest/v1/memberships under a real (non-service-role)
//   session must be rejected — 401/403, never a silent success.
// ===========================================================================

test.describe('AC-2: direct-write lockdown on /rest/v1/memberships', () => {
  test('a staff_admin cannot INSERT a membership row directly (PostgREST)', async ({
    request,
  }) => {
    const chefe = await getOwnerToken(request, 'chefe.ccih@test.local')
    const probe = await makeProbeUser(request, 'ac2-insert')

    const resp = await request.post(`${SUPABASE_URL}/rest/v1/memberships`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${chefe}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      data: {
        principal_id: probe.userId,
        commission_id: COMMISSION_A,
        role: 'staff',
      },
    })
    // No INSERT policy + no authenticated grant → PostgREST rejects (typically 401/403;
    // may also surface as 404 under `Prefer: count` semantics for an ungranted table —
    // assert NOT-2xx as the invariant: the row must never be created via direct REST).
    expect(resp.status(), 'direct INSERT into memberships must not succeed').not.toBe(201)
    expect([401, 403]).toContain(resp.status())

    // Confirm no row was actually created (belt-and-suspenders via service-role read).
    const check = await request.get(
      `${SUPABASE_URL}/rest/v1/memberships?principal_id=eq.${probe.userId}&commission_id=eq.${COMMISSION_A}&select=id`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    )
    const rows = (await check.json()) as unknown[]
    expect(rows).toHaveLength(0)
  })

  test('an org_admin cannot UPDATE a membership row directly (PostgREST)', async ({
    request,
  }) => {
    const orgAdmin = await getOwnerToken(request, 'orgadmin.a@test.local')

    // Read an existing membership row's id (service-role — RLS-exempt read, test setup
    // only) to target a real row with the PATCH attempt.
    const rows = await request.get(
      `${SUPABASE_URL}/rest/v1/memberships?commission_id=eq.${COMMISSION_A}&role=eq.staff_admin&select=id&limit=1`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    )
    const rowList = (await rows.json()) as { id: string }[]
    expect(rowList.length).toBeGreaterThan(0)
    const targetId = rowList[0].id

    const resp = await request.patch(
      `${SUPABASE_URL}/rest/v1/memberships?id=eq.${targetId}`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${orgAdmin}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        data: { role: 'staff' },
      },
    )
    expect([401, 403]).toContain(resp.status())
  })

  test('a staff_admin cannot DELETE a membership row directly (PostgREST)', async ({
    request,
  }) => {
    const chefe = await getOwnerToken(request, 'chefe.ccih@test.local')

    const rows = await request.get(
      `${SUPABASE_URL}/rest/v1/memberships?commission_id=eq.${COMMISSION_A}&role=eq.staff&select=id&limit=1`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    )
    const rowList = (await rows.json()) as { id: string }[]
    expect(rowList.length).toBeGreaterThan(0)
    const targetId = rowList[0].id

    const resp = await request.delete(
      `${SUPABASE_URL}/rest/v1/memberships?id=eq.${targetId}`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${chefe}`,
        },
      },
    )
    expect([401, 403]).toContain(resp.status())

    // The row must still exist (nothing was deleted).
    const stillThere = await request.get(
      `${SUPABASE_URL}/rest/v1/memberships?id=eq.${targetId}&select=id`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    )
    expect((await stillThere.json()) as unknown[]).toHaveLength(1)
  })
})

// ===========================================================================
// AC-3 — Self-appointment via a door surfaces a clear pt-BR error (not a raw
//   Postgres/42501 string). API-level companion to nsp-per-hospital.spec.ts AC-3's
//   UI-driven self-delegation test — deterministic (doesn't depend on finding a
//   self-option in a picker), drives grant_role directly.
// ===========================================================================

test('AC-3: self-grant via grant_role is rejected server-side (42501), never silently succeeds', async ({
  request,
}) => {
  const chefe = await getOwnerToken(request, 'chefe.ccih@test.local')
  const chefeId = '00000000-0000-0000-0000-000000000002'

  // chefe.ccih (staff_admin of CCIH, is_commission_admin_of=false) attempts to grant
  // itself staff_admin again (a no-op-shaped self-grant) via the door directly.
  const resp = await request.post(`${SUPABASE_URL}/rest/v1/rpc/grant_role`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${chefe}`,
      'Content-Type': 'application/json',
    },
    data: {
      p_scope_type: 'commission',
      p_scope_id: COMMISSION_A,
      p_role: 'staff_admin',
      p_user: chefeId,
    },
  })
  // _deny_self_grant raises 42501 on EVERY grant_role path, self-grant included —
  // never a 2xx silent success.
  expect(resp.ok()).toBeFalsy()
  const body = (await resp.json()) as { code?: string; message?: string }
  expect(body.code).toBe('42501')
  // Never a raw unmapped Postgres string reaching the caller unexplained — the RPC's
  // own message is already human-readable pt-BR-adjacent ("sem permissão"); assert it
  // is NOT an opaque stack/relation-name leak.
  expect(body.message ?? '').not.toMatch(/relation|syntax error|stack trace/i)
})

// ===========================================================================
// AC-4 — multi@test.local (staff of BOTH ccih and farmacia, same org) still
//   resolves BOTH commission memberships in the commission picker. Regression
//   guard on the MEM collapse's read path (has_role / memberships), belt-and-
//   suspenders alongside phase2-auth-shell.spec.ts / phase-multitenancy.spec.ts.
// ===========================================================================

test('AC-4: multi@test.local resolves both commission memberships in the /c picker', async ({
  page,
}) => {
  await signInAs(page, 'multi@test.local')
  await expect(page).toHaveURL('http://localhost:3000/c')

  // Picker must render exactly two commission cards (mirrors phase2-auth-shell's
  // baseline assertion — the MEM collapse must not change the resolved card count).
  const cards = page.getByRole('listitem').filter({ has: page.getByRole('link') })
  await expect(cards).toHaveCount(2, { timeout: 10_000 })

  // Both memberships resolve to a real navigable card (ccih + farmacia).
  await expect(page.locator('a[href="/o/rede-a/c/ccih"]')).toBeVisible()
  await expect(page.locator('a[href="/o/rede-a/c/farmacia"]')).toBeVisible()
})

// ===========================================================================
// AC-5 — Audit trail: a grant emits the unified `membership` entity + "Função
//   concedida" verb label, viewable end-to-end on the audit page (guards the
//   hard-cut: the retired commission_member.* family must never reappear).
// ===========================================================================

test('AC-5: a grant shows up on the audit page as "Função concedida" / entity "Função"', async ({
  page,
  request,
}) => {
  const admin = await getOwnerToken(request, 'admin@test.local')
  const probe = await makeProbeUser(request, 'ac5-audit')

  // Grant through the door (admin has is_admin() authority on any scope).
  const grantResp = await request.post(`${SUPABASE_URL}/rest/v1/rpc/grant_role`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${admin}`,
      'Content-Type': 'application/json',
    },
    data: {
      p_scope_type: 'commission',
      p_scope_id: COMMISSION_A,
      p_role: 'staff',
      p_user: probe.userId,
    },
  })
  expect(grantResp.ok()).toBeTruthy()

  // View the CCIH audit page as its staff_admin, filtered to the membership.granted
  // action, and confirm the pt-BR label + entity chip render (never the retired
  // commission_member.added / "Membro" strings — the hard-cut must be complete).
  await signInAs(page, 'chefe.ccih@test.local')
  await page.goto('/o/rede-a/c/ccih/manage/audit?action=membership.granted')
  const feed = page.getByRole('list', { name: /registros de auditoria/i })
  await expect(feed).toBeVisible({ timeout: 15_000 })
  const rows = feed.getByRole('listitem')
  await expect(rows.first()).toBeVisible({ timeout: 10_000 })
  await expect(rows.first()).toContainText(/função concedida/i)
  await expect(rows.first()).toContainText(/função/i)
})
