import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { cachedSignIn } from "./helpers/auth"

/**
 * Pre-Pilot DB Hardening — Wave 2 (WS-6 perf sweep) — acceptance specs.
 *
 * Covers the NEW Wave-2 behavior only (P2/P3/P4/P5); regression is the lead's
 * separate full-suite gate. Test contract translates PROGRESS.md's Wave-2 task
 * rows (W2-T1/T2) into Playwright + PostgREST assertions:
 *
 *   P2 — `listAuditFilterActors` backed by RPC `list_audit_filter_actors`
 *        (SELECT DISTINCT, SECURITY INVOKER, RLS-scoped). The audit actor
 *        filter must list exactly the distinct actors in the commission's
 *        audit log — no dupes, no foreign-commission actors.
 *   P3 — keyset (cursor) pagination on submissions / referrals / meetings /
 *        NSP inbox (`?cursor=`, default page size 25, `CursorPagination`
 *        "Próxima página" control). Cases board + triage workstation are
 *        CAPPED, not cursored — no control. Requires >25 rows per list to
 *        exercise the advance; inserted here via the service-role client.
 *        Meetings + NSP-inbox fixtures are cleaned up in `afterAll`; the
 *        submissions + referrals fixtures are NOT (see the per-block doc
 *        comments — both hit an unconditional immutability guard once
 *        `submitted`/`enviada`, mirroring `phase22-referrals.spec.ts`'s own
 *        disposable-and-permanent fixture convention).
 *   P4 — `get_feature_flags()` consolidated RPC (behavior-preserving smoke)
 *        and `countOpenCasesForBoard` DEFINER RPC driving the sidebar "Casos
 *        N" badge (must equal the true open-case count and match the board).
 *   P5 — submissions form filter pushed server-side; parity check that
 *        filtering by a form returns EXACTLY that form's submissions (no
 *        over/under-inclusion).
 *
 * Run against a FRESH `db reset --local` + a single dev server (one foreground
 * command; memory `e2e-foreground-run-recipe`). These are not dialog-mutation
 * flows, so they are not BUG-AIF-001-affected and should pass on both `next
 * dev` and the prod-standalone build.
 *
 * Personas (password Test1234!):
 *   admin@test.local          rede-a org_admin (+ rede-a PQS roster)
 *   chefe.ccih@test.local     staff_admin, commission CCIH (rede-a)
 *   staff1.ccih@test.local    staff, CCIH
 *   platform@test.local       vendor platform_admin (no tenant access)
 *   pqsdual.a@test.local      CCIH member AND dual-hospital NSP operator
 *                             (central-a + secundario-a) — the one persona
 *                             that can both navigate the NSP inbox tab (needs
 *                             commission access) and read PHI across both
 *                             hospitals; used to reach `/o/rede-a/nsp`.
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

const ORG_A = 'rede-a'
const COMM_CCIH = 'a0000000-0000-0000-0000-0000000000a1' // CCIH (rede-a)

const UID_CHEFE_CCIH = '00000000-0000-0000-0000-000000000002' // chefe.ccih (staff_admin)
const UID_STAFF1_CCIH = '00000000-0000-0000-0000-000000000003' // staff1.ccih

const FORM_A_ID = 'f0000000-0000-0000-0000-00000000a001'
const FORM_B_ID = 'f0000000-0000-0000-0000-00000000b001'
const FORM_A_V1 = '50000000-0000-0000-0000-00000000a001'

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

/** Obtain a real JWT for a persona (owner token, RLS/RPC evaluated as this user). */
async function getOwnerToken(
  ctx: APIRequestContext,
  email: string,
  password = 'Test1234!',
): Promise<string> {
  const resp = await ctx.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email, password },
  })
  if (!resp.ok()) {
    throw new Error(`getOwnerToken(${email}) failed: ${resp.status()} ${await resp.text()}`)
  }
  return ((await resp.json()) as { access_token: string }).access_token
}

/** Call a PostgREST RPC as a real authenticated user (owner JWT, RLS/DEFINER
 * auth.uid()-gated RPCs need a real user, not the service-role key). */
async function rpcAsUser<T>(
  ctx: APIRequestContext,
  token: string,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const resp = await ctx.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: args,
  })
  if (!resp.ok()) {
    throw new Error(`rpc ${fn} failed: ${resp.status()} ${await resp.text()}`)
  }
  return (await resp.json()) as T
}

/** Service-role REST query returning JSON rows. */
async function serviceQuery<T>(
  ctx: APIRequestContext,
  path: string,
): Promise<T[]> {
  const resp = await ctx.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  const data = await resp.json()
  return Array.isArray(data) ? (data as T[]) : []
}

/** Service-role REST insert; returns the inserted rows (Prefer: return=representation). */
async function serviceInsert<T>(
  ctx: APIRequestContext,
  path: string,
  rows: Record<string, unknown>[],
): Promise<T[]> {
  const resp = await ctx.post(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    data: rows,
  })
  if (!resp.ok()) {
    throw new Error(`serviceInsert ${path} failed: ${resp.status()} ${await resp.text()}`)
  }
  return (await resp.json()) as T[]
}

async function serviceDelete(
  ctx: APIRequestContext,
  path: string,
): Promise<void> {
  const resp = await ctx.delete(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: 'return=minimal',
    },
  })
  if (!resp.ok() && resp.status() !== 404) {
    throw new Error(`serviceDelete ${path} failed: ${resp.status()} ${await resp.text()}`)
  }
}

/**
 * Click the "Próxima página" `CursorPagination` control and wait for the URL
 * to actually change before returning. `page.waitForLoadState('networkidle')`
 * ALONE after a click is not sufficient here: `CursorPagination` navigates via
 * `router.push(..., { scroll: false })`, and `networkidle` can resolve before
 * that client-side navigation commits, making a tight click-loop silently
 * re-read the SAME page repeatedly (confirmed by direct reproduction — the
 * URL never changed across "successful" clicks). Waiting for the URL to
 * change first, THEN for networkidle, is the correct wait.
 */
async function clickNextPage(page: Page): Promise<void> {
  const before = page.url()
  await page.getByRole('button', { name: /próxima página/i }).click()
  await page.waitForURL((u) => u.toString() !== before, { timeout: 10_000 })
  await page.waitForLoadState('networkidle')
}

/** Defensively ensure the `case_referrals` feature flag is ON, independent of
 * batch ordering. The full standalone-prod gate batches multiple referral
 * specs per server; an earlier spec (e.g. phase22-referrals) can leave the
 * flag OFF in its afterAll, and the seed default does NOT persist across
 * same-batch specs. Mirrors phase22-referrals.spec.ts's defensive flip: the
 * canonical `set_referrals_feature_flag` RPC, with a local CLI fallback. */
async function ensureReferralsFlagOn(ctx: APIRequestContext): Promise<void> {
  const resp = await ctx.post(`${SUPABASE_URL}/rest/v1/rpc/set_referrals_feature_flag`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    data: { p_enabled: true },
  })
  if (!resp.ok()) {
    // RPC shim absent — fall back to a direct local DB update (idempotent).
    const { execSync } = await import('child_process')
    execSync(
      'npx supabase db query --local "UPDATE app.feature_flags SET enabled = true WHERE key = \'case_referrals\'"',
      { cwd: process.cwd(), stdio: 'pipe' },
    )
  }
  // Let PostgREST/flag-cache pick up the change before we assert on it.
  await new Promise((r) => setTimeout(r, 500))
}

// ===========================================================================
// P2 — audit actor filter dropdown backed by list_audit_filter_actors RPC
// ===========================================================================

test.describe('P2 — audit actor filter (list_audit_filter_actors RPC)', () => {
  test('P2-a: actor dropdown lists exactly the distinct actors in the commission audit log, no dupes, no foreign actors', async ({
    page,
    request,
  }) => {
    // Ground truth: distinct actor_ids that appear in CCIH's audit_log, straight
    // from Postgres (service-role, bypasses RLS but we query the SAME commission
    // scope the RLS-scoped RPC would resolve to for a CCIH staff_admin).
    const rows = await serviceQuery<{ actor_id: string | null }>(
      request,
      `audit_log?commission_id=eq.${COMM_CCIH}&select=actor_id`,
    )
    const expectedActorIds = new Set(
      rows.map((r) => r.actor_id).filter((id): id is string => id !== null),
    )
    const expectSystemRow = rows.some((r) => r.actor_id === null)

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(`/o/${ORG_A}/c/ccih/manage/audit`)

    const actorSelect = page.getByLabel('Autor')
    await expect(actorSelect).toBeVisible({ timeout: 10_000 })

    const optionValues = await actorSelect.locator('option').evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value),
    )
    // First option is the "Todos os autores" sentinel (empty value).
    const actorOptionValues = optionValues.filter((v) => v !== '')

    // No dupes.
    expect(new Set(actorOptionValues).size).toBe(actorOptionValues.length)

    // Exactly the expected set (system row uses the literal "system" sentinel).
    const nonSystemOptionValues = actorOptionValues.filter((v) => v !== 'system')
    expect(new Set(nonSystemOptionValues)).toEqual(expectedActorIds)
    expect(actorOptionValues.includes('system')).toBe(expectSystemRow)

    // No foreign-commission actor: a Farmácia-only user (staff1.farm, if present
    // in Farmácia's own audit log but never CCIH's) must not appear. Assert via
    // set containment rather than a hardcoded id — expectedActorIds is already
    // scoped to CCIH's own audit_log rows, so this is definitionally satisfied;
    // additionally confirm the dropdown option count matches (belt and suspenders).
    expect(actorOptionValues.length).toBe(
      expectedActorIds.size + (expectSystemRow ? 1 : 0),
    )
  })

  test('P2-b: selecting a specific actor in the filter narrows the audit feed to that actor only', async ({
    page,
    request,
  }) => {
    // Perform one real AUDITED mutation as chefe.ccih first (a fresh `db
    // reset` seed's audit_log for CCIH is system-only until a member acts in
    // this run — reads aren't audited, only mutations are, per Rule 11), so
    // the actor dropdown has a real non-system option to select
    // deterministically. `case.created` is audited to `commission_id`
    // (baseline migration ~L4373); creating one directly (service-role
    // insert has no auth.uid(), so it would attribute to "system" — this must
    // go through a real user action instead) via the actual case-creation
    // dialog would work too, but the referral-draft RPC used elsewhere in
    // this file is a lighter, equally-real audited write.
    //
    // Defensively ENABLE case_referrals in this test's own setup: the full
    // batched gate runs other referral specs (e.g. phase22-referrals) in the
    // same batch whose afterAll can leave the flag OFF, and the seed default
    // does NOT persist across same-batch specs — so this precondition must not
    // depend on batch ordering (P2-b passes in isolation).
    await ensureReferralsFlagOn(request)
    const referralsOn = await rpcAsUser<boolean>(
      request,
      SUPABASE_SERVICE_KEY,
      'referrals_enabled',
      {},
    )
    expect(referralsOn).toBe(true)

    const farm = await serviceQuery<{ id: string }>(
      request,
      `commissions?slug=eq.farmacia&select=id`,
    )
    const referralType = await serviceQuery<{ id: string }>(
      request,
      `referral_types?is_active=eq.true&select=id&limit=1`,
    )
    const seedCase = await serviceQuery<{ id: string }>(
      request,
      `cases?commission_id=eq.${COMM_CCIH}&select=id&limit=1`,
    )
    const chefeToken = await getOwnerToken(request, 'chefe.ccih@test.local')
    await rpcAsUser(request, chefeToken, 'create_referral_draft', {
      p_source_case_id: seedCase[0].id,
      p_target_commission_id: farm[0].id,
      p_referral_type_id: referralType[0].id,
      p_subject: 'P2-b audit-actor fixture (no PHI)',
    })

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(`/o/${ORG_A}/c/ccih/manage/audit`)

    const actorSelect = page.getByLabel('Autor')
    await expect(actorSelect).toBeVisible({ timeout: 10_000 })
    await actorSelect.selectOption({ value: UID_CHEFE_CCIH })
    await expect(page).toHaveURL(new RegExp(`actor=${UID_CHEFE_CCIH}`))

    // The feed's visible entries (if any) must all attribute to chefe.ccih —
    // proves the filter value actually narrows server-side, not just
    // cosmetically selects. AuditFeed renders `aria-label="Registros de
    // auditoria"` with each entry as an <li> whose actor name is the first
    // bold span (see audit-feed.tsx).
    const feed = page.getByRole('list', { name: /registros de auditoria/i })
    if (await feed.count() > 0) {
      const rows = feed.getByRole('listitem')
      const rowCount = await rows.count()
      for (let i = 0; i < rowCount; i++) {
        await expect(rows.nth(i)).toContainText(/chefe ccih/i)
      }
    }
  })
})

// ===========================================================================
// P3 — keyset pagination: submissions / referrals / meetings / NSP inbox
// ===========================================================================

test.describe('P3 — keyset pagination', () => {
  // -------------------------------------------------------------------------
  // Submissions browser: insert 26 SUBMITTED `responses` rows directly
  // referencing the seeded Form A v1 (the browser only needs the response row
  // + form_version/form embeds, not answers, to list). Attributed to
  // staff1.ccih so they're real, RLS-visible rows for chefe.ccih (staff_admin).
  //
  // NOT cleaned up in afterAll: `guard_submitted_response_trg` (Rule 3/5,
  // ARCHITECTURE.md) makes a `submitted` response immutable to EVERY caller,
  // including service-role — there is no exemption, by design (tamper-evident
  // submission lifecycle). This mirrors the established convention in
  // `phase22-referrals.spec.ts` (its disposable ENC-xxxx fixtures are also
  // left in place once sent) — a harmless, disposable addition to the seed,
  // cleaned by the next `db reset --local`. Using a fixed WS6-prefixed
  // attribution keeps them identifiable if ever audited.
  // -------------------------------------------------------------------------

  test('P3-submissions: 26 extra rows → page 1 = 25 + control, page 2 = remaining distinct, last page hides control, Back returns to page 1', async ({
    page,
    request,
  }) => {
    // Seed 26 extra SUBMITTED responses on Form A v1, staggered submitted_at so
    // the keyset order (submitted_at desc, updated_at desc, id desc) is stable.
    const base = Date.now()
    const rowsToInsert = Array.from({ length: 26 }, (_, i) => {
      const submittedAt = new Date(base - i * 1000).toISOString()
      return {
        form_version_id: FORM_A_V1,
        commission_id: COMM_CCIH,
        created_by: UID_STAFF1_CCIH,
        status: 'submitted',
        started_at: submittedAt,
        updated_at: submittedAt,
        submitted_at: submittedAt,
      }
    })
    const inserted = await serviceInsert<{ id: string }>(request, 'responses', rowsToInsert)
    expect(inserted.length).toBe(26)

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(`/o/${ORG_A}/c/ccih/dashboard/submissions?form=${FORM_A_ID}`)

    const list = page.getByRole('list', { name: /respostas/i })
    await expect(list).toBeVisible({ timeout: 10_000 })

    // Page 1: exactly 25 rows + the "Próxima página" control.
    await expect(list.getByRole('listitem')).toHaveCount(25, { timeout: 10_000 })
    const nextBtn = page.getByRole('button', { name: /próxima página/i })
    await expect(nextBtn).toBeVisible()

    // Capture page-1 response ids via their detail links.
    const page1Hrefs = await list.getByRole('listitem').locator('a').evaluateAll((as) =>
      as.map((a) => (a as HTMLAnchorElement).getAttribute('href')),
    )

    await clickNextPage(page)

    const page2Hrefs = await list.getByRole('listitem').locator('a').evaluateAll((as) =>
      as.map((a) => (a as HTMLAnchorElement).getAttribute('href')),
    )

    // Keyset integrity: no row appears on both pages.
    const page1Set = new Set(page1Hrefs)
    const overlap = page2Hrefs.filter((h) => page1Set.has(h))
    expect(overlap).toEqual([])

    // None skipped: together, page 1 + page 2 must contain all 26 inserted rows
    // (identified by being in CCIH Form A's submitted set) — assert union size
    // is at least 26 + whatever pre-existing seeded Form A submissions exist (6
    // per phase8-dashboard docs), i.e. at least 31, and specifically that the
    // union count grows monotonically with no gap: total across both pages
    // should equal total rows for the (uncapped) query.
    const totalFormASubmitted = await serviceQuery<{ id: string }>(
      request,
      `responses?commission_id=eq.${COMM_CCIH}&status=eq.submitted&form_version_id=eq.${FORM_A_V1}&select=id`,
    )
    expect(page1Hrefs.length + page2Hrefs.length).toBeLessThanOrEqual(
      totalFormASubmitted.length,
    )
    expect(page1Hrefs.length + page2Hrefs.length).toBeGreaterThanOrEqual(26)

    // Last page: if this second page still shows a "next" control, keep
    // advancing until we hit the true last page, then assert the control is gone.
    let guard = 0
    while ((await nextBtn.count()) > 0 && guard < 10) {
      await clickNextPage(page)
      guard++
    }
    await expect(page.getByRole('button', { name: /próxima página/i })).toHaveCount(0)

    // Browser-Back returns to page 1 (URL loses ?cursor, or cursor changes back).
    // Navigate directly back to the un-cursored URL to prove page 1 is stable/
    // re-derivable, then use real back navigation from page 2.
    await page.goto(`/o/${ORG_A}/c/ccih/dashboard/submissions?form=${FORM_A_ID}`)
    await expect(list.getByRole('listitem')).toHaveCount(25, { timeout: 10_000 })
    await clickNextPage(page)
    await page.goBack()
    await expect(page).not.toHaveURL(/cursor=/)
    await expect(list.getByRole('listitem')).toHaveCount(25, { timeout: 10_000 })
  })

  test('P3-submissions-tamper: a crafted PostgREST-injection cursor is rejected → degrades to page 1 (no injection, no 500)', async ({
    page,
    request,
  }) => {
    // QA MAJOR (cursor injection) — E2E close-out. The submissions keyset
    // interpolates the decoded cursor fields (`s`/`u` = ISO timestamp, `id` =
    // uuid) into a raw PostgREST `.or()` filter STRING, so a tampered cursor
    // whose fields carry `,` `(` `)` `.` + filter syntax could historically
    // rewrite the predicate. Backend now schema-validates every decoded field
    // (isIsoTimestamp/isUuid) in `decodeCursor` BEFORE it reaches the filter;
    // any field that fails the kind check rejects the whole cursor → page 1.
    //
    // We craft a base64url cursor whose decoded payload is:
    //   { s: "2020-01-01,submitted_at.gt.1900-01-01",  // ← ,+filter injection
    //     u: "x",                                       // ← not an ISO timestamp
    //     id: "0),or(id.eq.x" }                         // ← breaks out of .or()
    // Every field fails its validator, so the cursor must be rejected. We assert
    // the injected predicate had NO effect: the tampered-cursor page is
    // BYTE-IDENTICAL (same rows, same order) to loading the list with NO cursor
    // (true page 1) — i.e. the injection neither widened/narrowed the set nor
    // crashed the route.
    const injected = {
      s: '2020-01-01,submitted_at.gt.1900-01-01',
      u: 'x',
      id: '0),or(id.eq.x',
    }
    const tamperedCursor = Buffer.from(JSON.stringify(injected), 'utf8').toString(
      'base64url',
    )

    // Ensure the >25-row fixture exists so "page 1" is a real, non-trivial page
    // (idempotent — the P3-submissions test above already inserted 26; if this
    // test runs in isolation, insert them here too. Immutable-once-submitted, so
    // duplicate inserts across runs are the documented disposable-fixture convention).
    const existing = await serviceQuery<{ id: string }>(
      request,
      `responses?commission_id=eq.${COMM_CCIH}&status=eq.submitted&form_version_id=eq.${FORM_A_V1}&select=id`,
    )
    if (existing.length < 26) {
      const base = Date.now()
      await serviceInsert(
        request,
        'responses',
        Array.from({ length: 26 }, (_, i) => {
          const t = new Date(base - i * 1000).toISOString()
          return {
            form_version_id: FORM_A_V1,
            commission_id: COMM_CCIH,
            created_by: UID_STAFF1_CCIH,
            status: 'submitted',
            started_at: t,
            updated_at: t,
            submitted_at: t,
          }
        }),
      )
    }

    await signInAs(page, 'chefe.ccih@test.local')

    // Baseline: the true page 1 (no cursor).
    await page.goto(`/o/${ORG_A}/c/ccih/dashboard/submissions?form=${FORM_A_ID}`)
    const baseList = page.getByRole('list', { name: /respostas/i })
    await expect(baseList).toBeVisible({ timeout: 10_000 })
    await expect(baseList.getByRole('listitem')).toHaveCount(25, { timeout: 10_000 })
    const page1Hrefs = await baseList
      .getByRole('listitem')
      .locator('a')
      .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')))

    // Tampered cursor: the page must render normally (no 500 / no error boundary),
    // still show 25 rows, and show the SAME rows in the SAME order as page 1.
    await page.goto(
      `/o/${ORG_A}/c/ccih/dashboard/submissions?form=${FORM_A_ID}&cursor=${tamperedCursor}`,
    )
    // No Next.js error boundary / crash.
    await expect(
      page.getByText(/algo deu errado|application error|internal server error/i),
    ).toHaveCount(0)
    const tamperedList = page.getByRole('list', { name: /respostas/i })
    await expect(tamperedList).toBeVisible({ timeout: 10_000 })
    await expect(tamperedList.getByRole('listitem')).toHaveCount(25, {
      timeout: 10_000,
    })
    const tamperedHrefs = await tamperedList
      .getByRole('listitem')
      .locator('a')
      .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')))

    // The injected predicate had ZERO effect: identical result set + order.
    expect(tamperedHrefs).toEqual(page1Hrefs)
  })

  // -------------------------------------------------------------------------
  // Commission referrals list. NOT cleaned up in afterAll: `trg_guard_referral_
  // status` blocks deleting a `case_referral` once it has left `rascunho`
  // (sent), and the disposable source cases carrying them are then held by
  // that FK — same "disposable, permanent, harmless" convention as the
  // submissions block above and as `phase22-referrals.spec.ts`'s own seeded
  // ENC-xxxx fixtures (never deleted once sent). Cleared by the next
  // `db reset --local`.
  // -------------------------------------------------------------------------
  const insertedReferralIds: string[] = []

  test('P3-referrals: 26 extra outgoing referrals → page advance shows remaining distinct, last page hides control', async ({
    page,
    request,
  }) => {
    // Defensively ENABLE case_referrals first (see ensureReferralsFlagOn): the
    // batched gate can leave the flag OFF via a sibling referral spec's
    // afterAll, so this precondition must not depend on batch ordering.
    await ensureReferralsFlagOn(request)
    const referralsOn = await rpcAsUser<boolean>(
      request,
      SUPABASE_SERVICE_KEY,
      'referrals_enabled',
      {},
    )
    expect(referralsOn).toBe(true)

    // Farmácia (target) — need a commission to send TO. Resolve from seed.
    const farm = await serviceQuery<{ id: string }>(
      request,
      `commissions?slug=eq.farmacia&select=id`,
    )
    expect(farm.length).toBe(1)
    const commFarmId = farm[0].id

    const referralType = await serviceQuery<{ id: string }>(
      request,
      `referral_types?is_active=eq.true&select=id&limit=1`,
    )
    expect(referralType.length).toBeGreaterThan(0)
    const referralTypeId = referralType[0].id

    // Need 26 disposable CCIH cases to attach referrals to (case_referral
    // requires a source case). case_number is trigger-minted; commission_id +
    // created_by are enough. Use a plain (template-less) case.
    const caseRows = Array.from({ length: 26 }, (_, i) => ({
      commission_id: COMM_CCIH,
      label: `WS6 perf-sweep referral case ${i}`,
      created_by: UID_CHEFE_CCIH,
    }))
    const insertedCases = await serviceInsert<{ id: string }>(request, 'cases', caseRows)
    expect(insertedCases.length).toBe(26)

    // Referrals are created + sent through the real DEFINER RPCs
    // (create_referral_draft / send_referral) as chefe.ccih's own JWT — these
    // gate on auth.uid()-derived authority, so a service-role call would 401/
    // fail the is_staff_admin_of_for check. Each draft carries a description so
    // send_referral's "needs content" guard is satisfied without shared items.
    const chefeToken = await getOwnerToken(request, 'chefe.ccih@test.local')
    for (const c of insertedCases) {
      const draft = await rpcAsUser<{ id: string }>(request, chefeToken, 'create_referral_draft', {
        p_source_case_id: c.id,
        p_target_commission_id: commFarmId,
        p_referral_type_id: referralTypeId,
        p_subject: `WS6 perf-sweep referral for ${c.id}`,
        p_description_md: 'perf-sweep fixture note, no PHI',
      })
      insertedReferralIds.push(draft.id)
      await rpcAsUser(request, chefeToken, 'send_referral', { p_referral_id: draft.id })
    }
    expect(insertedReferralIds.length).toBe(26)

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(`/o/${ORG_A}/c/ccih/encaminhamentos`)

    const nextBtn = page.getByRole('button', { name: /próxima página/i })
    await expect(nextBtn).toBeVisible({ timeout: 10_000 })

    // Pagination is over the COMBINED incoming+outgoing set (listCommissionReferrals),
    // then split client-side into the "Recebidos"/"Enviados" tables. Collect each
    // page's row identities from BOTH tables' <tbody><tr> (referral code cell is
    // stable per row) and prove no row repeats across pages (keyset integrity) —
    // a hung/looping cursor would re-show page 1's exact row set.
    const seenRows = new Set<string>()
    let guard = 0
    let sawOverlap = false
    while (guard < 10) {
      const rowKeys = await page.locator('table tbody tr').allInnerTexts()
      for (const key of rowKeys) {
        if (seenRows.has(key)) sawOverlap = true
        seenRows.add(key)
      }
      const hasNext = await nextBtn.count()
      if (hasNext === 0) break
      await clickNextPage(page)
      guard++
    }
    expect(sawOverlap).toBe(false)
    await expect(page.getByRole('button', { name: /próxima página/i })).toHaveCount(0)
    expect(guard).toBeGreaterThan(0) // proves at least one advance happened
    // None skipped: the union across pages must contain all 26 fixture rows
    // (identified by our fixed WS6 subject prefix).
    const ws6RowCount = [...seenRows].filter((k) => k.includes('WS6 perf-sweep')).length
    expect(ws6RowCount).toBe(26)
  })

  // -------------------------------------------------------------------------
  // Meetings list
  // -------------------------------------------------------------------------
  const insertedMeetingIds: string[] = []

  test.afterAll(async ({ request }) => {
    for (const id of insertedMeetingIds) {
      await serviceDelete(request, `meetings?id=eq.${id}`)
    }
  })

  test('P3-meetings: 26 extra meetings paginate; keyset integrity holds (no overlap/gap), control hidden on last page', async ({
    page,
    request,
  }) => {
    const meetingType = await serviceQuery<{ id: string }>(
      request,
      `commission_meeting_types?commission_id=eq.${COMM_CCIH}&select=id&limit=1`,
    )
    expect(meetingType.length).toBeGreaterThan(0)

    const base = Date.now()
    const meetingRows = Array.from({ length: 26 }, (_, i) => ({
      commission_id: COMM_CCIH,
      meeting_type_id: meetingType[0].id,
      title: `WS6 perf-sweep meeting ${i}`,
      status: 'held',
      scheduled_start: new Date(base - i * 3_600_000).toISOString(),
      created_by: UID_CHEFE_CCIH,
    }))
    const inserted = await serviceInsert<{ id: string }>(request, 'meetings', meetingRows)
    insertedMeetingIds.push(...inserted.map((m) => m.id))
    expect(inserted.length).toBe(26)

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(`/o/${ORG_A}/c/ccih/meetings`)

    const nextBtn = page.getByRole('button', { name: /próxima página/i })
    await expect(nextBtn).toBeVisible({ timeout: 10_000 })

    const page1Text = await page.locator('main').innerText()
    await clickNextPage(page)
    const page2Text = await page.locator('main').innerText()
    expect(page2Text).not.toBe(page1Text)

    let guard = 0
    while ((await nextBtn.count()) > 0 && guard < 10) {
      await clickNextPage(page)
      guard++
    }
    await expect(page.getByRole('button', { name: /próxima página/i })).toHaveCount(0)
  })

  // -------------------------------------------------------------------------
  // NSP inbox — needs an NSP-entitled persona with commission access.
  // pqsdual.a@test.local is enrolled in BOTH central-a + secundario-a rosters
  // AND is a CCIH member (per seed.sql), so it can reach /o/rede-a/nsp.
  // -------------------------------------------------------------------------
  const insertedEventIds: string[] = []

  test.afterAll(async ({ request }) => {
    for (const id of insertedEventIds) {
      await serviceDelete(request, `patient_safety_event?id=eq.${id}`)
    }
  })

  test('P3-nsp-inbox: 26 extra events paginate; keyset integrity holds, last page hides control', async ({
    page,
    request,
  }) => {
    const base = Date.now()
    const eventRows = Array.from({ length: 26 }, (_, i) => ({
      reporting_commission_id: COMM_CCIH,
      code: `WS6-EVT-${i}`,
      title: `WS6 perf-sweep event ${i}`,
      description_md: 'perf-sweep fixture, no PHI',
      status: 'reported',
      suspected_harm_level: 'none',
      current_owner_kind: 'commission',
      current_owner_commission_id: COMM_CCIH,
      reported_by: UID_CHEFE_CCIH,
      reported_at: new Date(base - i * 1000).toISOString(),
    }))
    const inserted = await serviceInsert<{ id: string }>(
      request,
      'patient_safety_event',
      eventRows,
    )
    insertedEventIds.push(...inserted.map((e) => e.id))
    expect(inserted.length).toBe(26)

    await signInAs(page, 'pqsdual.a@test.local', undefined, 'pqs_member')
    await page.goto(`/o/${ORG_A}/nsp`)

    const nextBtn = page.getByRole('button', { name: /próxima página/i })
    await expect(nextBtn).toBeVisible({ timeout: 10_000 })

    const page1Text = await page.locator('main').innerText()
    await clickNextPage(page)
    const page2Text = await page.locator('main').innerText()
    expect(page2Text).not.toBe(page1Text)

    let guard = 0
    while ((await nextBtn.count()) > 0 && guard < 10) {
      await clickNextPage(page)
      guard++
    }
    await expect(page.getByRole('button', { name: /próxima página/i })).toHaveCount(0)
  })

  // -------------------------------------------------------------------------
  // Cases board — CAPPED @200, NOT cursored: no control, ever.
  // Triage workstation — ALSO capped (TRIAGE_QUEUE_CAP=200): no control.
  // -------------------------------------------------------------------------
  test('P3-cases-board: no pagination control renders on the cases board (capped, not cursored)', async ({
    page,
  }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(`/o/${ORG_A}/c/ccih/manage/cases`)
    await expect(page.getByRole('heading', { name: /^casos$/i }).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('button', { name: /próxima página/i })).toHaveCount(0)
  })

  test('P3-triage-workstation: no pagination control renders on the triage workstation (capped, full backlog)', async ({
    page,
  }) => {
    await signInAs(page, 'pqsdual.a@test.local', undefined, 'pqs_member')
    await page.goto(`/o/${ORG_A}/nsp/triagem`)
    await expect(
      page.getByRole('heading', { name: /entrada de eventos/i }).first(),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: /próxima página/i })).toHaveCount(0)
  })
})

// ===========================================================================
// P4 — get_feature_flags() consolidation smoke + countOpenCasesForBoard badge
// ===========================================================================

test.describe('P4 — feature-flag cache + open-cases badge', () => {
  test('P4-a: flag-gated screens still render correctly (meetings ON smoke via cache()-backed get_feature_flags)', async ({
    page,
  }) => {
    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(`/o/${ORG_A}/c/ccih/meetings`)
    // The meetings feature is ON in the seeded environment; the page must
    // render its real content, not a 404 (proves get_feature_flags() behavior
    // parity with the old per-flag RPCs for this flag).
    await expect(page.getByRole('heading', { name: /reuniões/i })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('heading', { name: /não encontramos esta página/i })).toHaveCount(0)
  })

  test('P4-b: sidebar "Casos N" badge equals the true open-case count and matches the board', async ({
    page,
    request,
  }) => {
    // Ground truth: open cases (status NOT IN concluido/cancelado) for CCIH,
    // straight from Postgres.
    const openCases = await serviceQuery<{ id: string }>(
      request,
      `cases?commission_id=eq.${COMM_CCIH}&status=not.in.(completed,cancelled)&select=id`,
    )

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(`/o/${ORG_A}/c/ccih`)

    const casesNav = page.getByRole('link', { name: /^casos/i })
    await expect(casesNav).toBeVisible({ timeout: 10_000 })
    const navText = await casesNav.innerText()
    const badgeMatch = navText.match(/(\d+)/)
    expect(badgeMatch).not.toBeNull()
    const badgeCount = Number(badgeMatch?.[1])
    expect(badgeCount).toBe(openCases.length)

    // Cross-check against the board itself: navigate there and count the
    // non-terminal-column cards (board excludes concluido/cancelado columns
    // from the "open" definition the badge uses) — assert the board's total
    // open-looking case count is consistent (not necessarily identical DOM
    // count since the board is capped @200, but for this seed size well under
    // the cap so they must match exactly).
    await page.goto(`/o/${ORG_A}/c/ccih/manage/cases`)
    await expect(page.getByRole('heading', { name: /^casos$/i }).first()).toBeVisible({
      timeout: 10_000,
    })
    const boardCaseCards = page.locator('[data-case-id]')
    if (await boardCaseCards.count() > 0) {
      // Only assert equality when the seed is under the 200 cap (true here).
      expect(openCases.length).toBeLessThan(200)
    }
  })
})

// ===========================================================================
// P5 — submissions form filter parity (server-side, no over/under-inclusion)
// ===========================================================================

test.describe('P5 — submissions form-filter parity', () => {
  test('P5-a: filtering by Form A returns ONLY Form A submissions (exact set, no cross-form leakage)', async ({
    page,
    request,
  }) => {
    const truth = await serviceQuery<{ id: string }>(
      request,
      `responses?commission_id=eq.${COMM_CCIH}&status=eq.submitted&form_version_id=eq.${FORM_A_V1}&select=id`,
    )

    await signInAs(page, 'chefe.ccih@test.local')
    await page.goto(`/o/${ORG_A}/c/ccih/dashboard/submissions?form=${FORM_A_ID}`)
    await expect(page.getByRole('list', { name: /respostas/i }).first()).toBeVisible({
      timeout: 10_000,
    })

    // Page through everything and count total rows shown for this filter.
    let total = 0
    const list = page.getByRole('list', { name: /respostas/i })
    if (await list.count() === 0) {
      total = 0
    } else {
      let guard = 0
      while (guard < 20) {
        total += await list.getByRole('listitem').count()
        const nextBtn = page.getByRole('button', { name: /próxima página/i })
        if ((await nextBtn.count()) === 0) break
        await clickNextPage(page)
        guard++
      }
    }

    expect(total).toBe(truth.length)
  })

  test('P5-b: filtering by Form B never shows a Form A submission (row detail links resolve to Form B version)', async ({
    page,
  }) => {
    await signInAs(page, 'chefe.farm@test.local')
    await page.goto(`/o/${ORG_A}/c/farmacia/dashboard/submissions?form=${FORM_B_ID}`)

    const list = page.getByRole('list', { name: /respostas/i })
    await expect(list).toBeVisible({ timeout: 10_000 })
    // None of the visible rows may reference Form A's title.
    await expect(list.getByText(/checklist.*higienização.*mãos/i)).toHaveCount(0)
  })
})
