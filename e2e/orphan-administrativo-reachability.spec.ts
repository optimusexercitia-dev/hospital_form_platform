import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { cachedSignIn } from './helpers/auth'
import { getAnyPublishedTemplateVersion } from './helpers/process-templates'

/**
 * ORPHANED ADMINISTRATIVO — reachability, pinned by construction.
 * Closes `FUP-ORPHAN-ADMINISTRATIVO-REACHABILITY-UNVERIFIED` (filed 2026-08-21,
 * from QA F-3's remediation; measured + fixed 2026-08-22).
 *
 * WHAT AN ORPHAN IS. Nothing revokes an Administrativo appointment or its
 * capability rows when a commission membership is deleted — no FK, no cascade
 * trigger. `commission_administrativo_capabilities_select`'s `user_id = auth.uid()`
 * arm is hat-BLIND, so the survivor still READS their own capability rows. The DB
 * refuses them anyway: `app.member_can` is
 * `feature_enabled('administrativo') ∧ is_active ∧ app.is_member_of ∧ ∃ capability row`
 * (measured from `pg_proc`, ADR 0134 Amdt 2 M8), and every gate consuming the five
 * capabilities is `is_staff_admin_of OR member_can(...)` — both arms membership-bound.
 *
 * ⛔ WHY THE FUP'S OWN CLOSE CONDITION WOULD HAVE CLOSED IT WRONG. It said
 * "construct an orphan and measure whether they reach the board". QA's review
 * (§7.8) sharpened it first, and the sharpening is the point of this spec: the
 * PLAIN orphan is the one composition that provably cannot reach, so testing only
 * that one returns a clean GREEN that means nothing. Measured, the plain orphan is
 * stopped even earlier than the shell gate the FUP predicted —
 * `commissions_select_member_or_admin` denies them the commission ROW, so
 * `getCommissionAccessByOrg` returns `null`. The COMPOSITES read that row on a
 * different policy arm (`is_org_admin_of` / `is_quality_reviewer_of`), arrive with
 * `role: null` and a full `capabilities` array, and — before the fix — were offered
 * "Novo caso" behind a door that answered "Você não tem permissão para esta ação."
 *
 * THE POSITIVE CONTROL IS LOAD-BEARING. Three of the four subjects assert an
 * ABSENCE (404 / no affordance). An absence assertion passes for free if the
 * feature flag is off, the fixture never took, or the persona failed to sign in.
 * C0 — a REAL member Administrativo — must reach the board, be offered "Novo caso",
 * and be SERVED by the door (a case is actually created, then torn down). Without
 * C0 going green this whole file is vacuous.
 *
 * ⛔ THE CONTROL MAP — stated in full, including what CANNOT fail. Neutralizing the
 * fix (`canInCommission` back to the membership-blind
 * `role === 'staff_admin' || capabilities.includes(cap)`), rebuilding the
 * standalone bundle and re-running:
 *
 *   C2 → RED · C3 → RED   (the two regression guards; C3 verified with `-g`, since
 *                          this file is `serial` and C2's failure aborts the rest —
 *                          "did not run" is not a verdict)
 *   C0 → GREEN · C1 → GREEN
 *
 * Only **2 of the 4** tests here guard the mirror. C0 guards the FIXTURE (flag on,
 * appointment took, persona signed in) and C1 guards a DIFFERENT mechanism
 * upstream of the mirror (RLS on `commissions`), so neither can flip on this fix
 * and neither should be counted as covering it. A control map listing only what
 * flipped reads as though everything did.
 *
 * FIXTURES ARE PURELY ADDITIVE — nothing seeded is mutated. C0 is the seed's own
 * appointment (`staff2.ccih`, all FIVE capabilities — ADR 0134 D6 added `read_cases`).
 * C1/C2/C3 are constructed by
 * APPOINTING three personas who already hold no CCIH membership, rather than by
 * deleting a seed persona's membership (`seed.sql` is a contract with ~900 tests).
 * Each added appointment is deleted in `afterAll`, which cascades its capability
 * rows; the created case is deleted by id.
 *
 * Runs against the LOCAL Supabase stack. Serial — the subjects share one CCIH board.
 */

test.describe.configure({ mode: 'serial' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — defina-o em .env.local.')
}

const PW = 'Test1234!'
const CCIH = 'a0000000-0000-0000-0000-0000000000a1'
const UID_CHEFE = '00000000-0000-0000-0000-000000000002'
const UID_STAFF2 = '00000000-0000-0000-0000-000000000004' // seed's own appointment — do NOT tear down; holds ALL FIVE capabilities (ADR 0134 D6 added read_cases)

const BOARD = '/o/rede-a/c/ccih/manage/cases'
const SHELL = '/o/rede-a/c/ccih'

/**
 * The three orphan compositions plus the control. `standing` names the OTHER arm
 * of `commissions_select_member_or_admin` each composite rides — it is what makes
 * the composite reach where the plain orphan cannot, so it is named per subject
 * rather than left implicit.
 */
const C0 = { email: 'staff2.ccih@test.local', uid: UID_STAFF2 }
const C1 = { email: 'staff2.farm@test.local', uid: '00000000-0000-0000-0000-000000000007' }
const C2 = { email: 'orgadmin.a@test.local', uid: '00000000-0000-0000-0000-0000000000b1' }
const C3 = { email: 'quality.a@test.local', uid: '00000000-0000-0000-0000-0000000000f3' }

/** The three appointments this spec ADDS (C0's is the seed's and is never touched). */
const ADDED = [C1, C2, C3]

const H = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

/** Service-role appointment + capability grant (bypasses the coordinator-only doors). */
async function appoint(req: APIRequestContext, uid: string, caps: string[]) {
  const a = await req.post(`${SUPABASE_URL}/rest/v1/commission_administrativos`, {
    headers: { ...H, Prefer: 'resolution=ignore-duplicates' },
    data: { commission_id: CCIH, user_id: uid, appointed_by: UID_CHEFE },
  })
  expect(a.ok(), `appoint ${uid}`).toBeTruthy()
  const c = await req.post(`${SUPABASE_URL}/rest/v1/commission_administrativo_capabilities`, {
    headers: { ...H, Prefer: 'resolution=ignore-duplicates' },
    data: caps.map((capability) => ({
      commission_id: CCIH,
      user_id: uid,
      capability,
      granted_by: UID_CHEFE,
    })),
  })
  expect(c.ok(), `grant ${uid}`).toBeTruthy()
}

/** Deleting the appointment cascades its capability rows in the DB. */
async function unappoint(req: APIRequestContext, uid: string) {
  await req.delete(
    `${SUPABASE_URL}/rest/v1/commission_administrativos?commission_id=eq.${CCIH}&user_id=eq.${uid}`,
    { headers: H },
  )
}

async function countRows(req: APIRequestContext, path: string): Promise<number> {
  const r = await req.get(`${SUPABASE_URL}/rest/v1/${path}`, { headers: H })
  if (!r.ok()) return -1
  return ((await r.json()) as unknown[]).length
}

/**
 * WHICH 404 rendered — and it is not cosmetic, it names the gate that fired.
 * `notFound()` streams as HTTP 200 on a standalone server, so the status line
 * cannot be keyed on; and the two boundaries carry DIFFERENT copy:
 *
 *   'root'       — `src/app/not-found.tsx`, "Não encontramos esta página."
 *                  A LAYOUT called `notFound()`, so it bubbled past
 *                  `c/[commission]/not-found.tsx` to the root boundary. For this
 *                  spec that means the commission shell itself refused ⇒ the
 *                  resolver returned `null` (no readable commission row).
 *   'commission' — `c/[commission]/not-found.tsx`, "Página não encontrada".
 *                  The shell RENDERED (its chrome is on the page) and the PAGE
 *                  called `notFound()` ⇒ the `canInCommission` gate refused.
 *
 * ⛔ An earlier draft of this file matched only the root copy and reported C2 as
 * "still reaching the board" when it was in fact correctly 404'd — a wrong
 * matcher reads exactly like a live defect. Assert the KIND, never a generic
 * "some 404 happened".
 */
async function notFoundKind(page: Page): Promise<'root' | 'commission' | null> {
  const text = await page.locator('body').innerText().catch(() => '')
  if (/Não encontramos esta página/i.test(text)) return 'root'
  if (/Página não encontrada/i.test(text)) return 'commission'
  return null
}

async function gotoSettled(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'load' })
  await page.waitForTimeout(1200)
}

const novoCaso = (page: Page) => page.getByRole('button', { name: /^novo caso$/i })

// ---------------------------------------------------------------------------

test.beforeAll(async ({ request }) => {
  // C1/C2/C3 hold NO CCIH membership already, so appointing them constructs the
  // orphan additively. Asserted rather than assumed: if a future seed gives any of
  // them a CCIH membership, this spec would silently start testing a MEMBER
  // administrativo on all four rows and every "orphan" assertion would be about
  // the wrong principal.
  for (const s of ADDED) {
    const held = await countRows(
      request,
      `memberships?principal_id=eq.${s.uid}&commission_id=eq.${CCIH}&select=id`,
    )
    expect(held, `${s.email} must hold NO CCIH membership for this fixture to be an orphan`).toBe(0)
    await appoint(request, s.uid, ['create_cases', 'assign_case_phases'])
  }
  // The control's standing is the seed's, and it is the opposite precondition.
  const c0Member = await countRows(
    request,
    `memberships?principal_id=eq.${UID_STAFF2}&commission_id=eq.${CCIH}&select=id`,
  )
  expect(c0Member, 'C0 control must BE a CCIH member').toBe(1)
})

test.afterAll(async ({ request }) => {
  for (const s of ADDED) await unappoint(request, s.uid)
  // Teardown proof — an appointment left behind widens three personas for every
  // later spec in the run.
  for (const s of ADDED) {
    const left = await countRows(
      request,
      `commission_administrativos?commission_id=eq.${CCIH}&user_id=eq.${s.uid}&select=user_id`,
    )
    expect(left, `teardown ${s.email}`).toBe(0)
  }
  const seedIntact = await countRows(
    request,
    `commission_administrativo_capabilities?commission_id=eq.${CCIH}&user_id=eq.${UID_STAFF2}&select=capability`,
  )
  // FIVE, not four (QA case-surface-split-increment-2-review.md B2): `e39ad3ac` added
  // `read_cases` to the seed's staff2.ccih grant nine commits after this file was
  // written, and this literal was not part of the sweep that updated it elsewhere
  // (205_administrativo.sql's two spots + the board re-anchor) — it lived in a
  // DIFFERENT file on the same branch, which is exactly the failure §A5.3 names:
  // enumerate by property, not by which file you're already editing.
  expect(seedIntact, "seed's own administrativo grants must survive").toBe(5)
})

test('C0 CONTROL — a MEMBER administrativo reaches the board and the door SERVES them', async ({
  page,
  request,
}) => {
  await cachedSignIn(page, C0.email, PW)
  await gotoSettled(page, BOARD)

  expect(await notFoundKind(page), 'C0 must not be 404d').toBeNull()
  await expect(page.getByRole('heading', { name: /^casos$/i }).first()).toBeVisible()
  await expect(novoCaso(page).first()).toBeEnabled()

  // The affordance is not the claim — being SERVED is. Drive it end to end.
  const before = await countRows(request, `cases?commission_id=eq.${CCIH}&select=id`)
  await novoCaso(page).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })
  const templateIds = await dialog
    .locator('select[name="templateId"] option')
    .evaluateAll((os) =>
      os.map((o) => (o as HTMLOptionElement).value).filter((v) => v && v !== 'PROCESSLESS'),
    )
  expect(templateIds.length, 'CCIH must carry a published template for the control').toBeGreaterThan(0)
  await dialog.locator('select[name="templateId"]').selectOption(templateIds[0])
  await dialog.getByRole('button', { name: /^criar caso$/i }).click()

  // Served ⇒ the dialog closes and we land on the new case's detail route.
  await page.waitForURL(/\/manage\/cases\/[0-9a-f-]{36}/, { timeout: 20_000 })
  const after = await countRows(request, `cases?commission_id=eq.${CCIH}&select=id`)
  expect(after, 'the control must actually create a case').toBe(before + 1)

  // Tear the created case down by ID (never positionally — a positional cleanup
  // eats seed rows).
  const createdId = new URL(page.url()).pathname.split('/').pop()!
  const del = await request.delete(`${SUPABASE_URL}/rest/v1/cases?id=eq.${createdId}`, { headers: H })
  expect(del.ok(), 'teardown of the created case').toBeTruthy()
  expect(await countRows(request, `cases?commission_id=eq.${CCIH}&select=id`)).toBe(before)
})

test('C1 plain orphan — 404 everywhere; stopped by the COMMISSION ROW, not the shell gate', async ({
  page,
  request,
}) => {
  // The mechanism is measured, not read off the guard it looks like it belongs to.
  // A plain orphan cannot SELECT the commission at all, so the resolver returns
  // `null` BEFORE the shell's `role === null && !isQualityViewer && !isTenancyAdmin`
  // test runs. Probing PostgREST under the persona's own JWT is what distinguishes
  // the two mechanisms — the rendered 404 looks identical either way.
  const tok = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
    data: { email: C1.email, password: PW },
  })
  expect(tok.ok()).toBeTruthy()
  const jwt = ((await tok.json()) as { access_token: string }).access_token
  const asSelf = await request.get(`${SUPABASE_URL}/rest/v1/commissions?id=eq.${CCIH}&select=id`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${jwt}` },
  })
  expect(((await asSelf.json()) as unknown[]).length, 'the commission row is INVISIBLE to a plain orphan').toBe(0)

  await cachedSignIn(page, C1.email, PW)
  for (const path of [SHELL, BOARD, `${SHELL}/casos`]) {
    await gotoSettled(page, path)
    // 'root', not merely "a 404": the ROOT boundary is what proves the LAYOUT
    // refused. A 'commission' 404 here would mean the shell rendered and only the
    // page refused — a different, weaker gate than the one this test claims.
    expect(await notFoundKind(page), `plain orphan must hit the ROOT 404 at ${path}`).toBe('root')
  }
})

for (const { name, subject, arm } of [
  { name: 'C2 orphan × tenancy-admin', subject: C2, arm: 'is_org_admin_of' },
  { name: 'C3 orphan × quality-reviewer', subject: C3, arm: 'is_quality_reviewer_of' },
]) {
  test(`${name} — reads the commission row on ${arm}, and is REFUSED the capability affordance`, async ({
    page,
    request,
  }) => {
    // Half of the composite is that this principal DOES reach the commission —
    // asserted, because if the other arm ever stopped admitting them the test
    // below would go green for the wrong reason (404 everywhere, like C1).
    const tok = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
      data: { email: subject.email, password: PW },
    })
    expect(tok.ok()).toBeTruthy()
    const jwt = ((await tok.json()) as { access_token: string }).access_token
    const hdr = { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${jwt}` }

    const row = await request.get(`${SUPABASE_URL}/rest/v1/commissions?id=eq.${CCIH}&select=id`, {
      headers: hdr,
    })
    expect(
      ((await row.json()) as unknown[]).length,
      `the composite must still READ the commission row via ${arm} — otherwise this is C1, not a composite`,
    ).toBe(1)

    // And their capability rows survive the missing membership (the hat-blind
    // `user_id = auth.uid()` self arm) — this is what made the TS mirror wider
    // than the door, so it is asserted rather than assumed.
    const caps = await request.get(
      `${SUPABASE_URL}/rest/v1/commission_administrativo_capabilities?commission_id=eq.${CCIH}&user_id=eq.${subject.uid}&select=capability`,
      { headers: hdr },
    )
    expect(
      ((await caps.json()) as unknown[]).length,
      'the orphan still READS their own surviving capability rows',
    ).toBe(2)

    // The door refuses them. Rewritten (QA case-surface-split-increment-2-review.md
    // B5a): this used to probe `rpc/member_can` guarded by `if (rpc.ok())`.
    // `member_can` exists ONLY as `app.member_can` — `supabase/config.toml` exposes
    // `public`/`graphql_public` only (verified by property:
    // `grep -rl "public\.member_can" supabase/migrations/` → exit 1, zero files) — so
    // that POST always 404s (PGRST202), `rpc.ok()` is always false, and the assertion
    // inside NEVER RAN. Probing a REACHABLE public door instead:
    // `create_case_from_template` gates on `is_staff_admin_of ∨
    // member_can(commission,'create_cases')`, and the orphan satisfies neither arm —
    // this is the SAME predicate, exercised through the public surface that actually
    // enforces it, which is what "the door refuses them" has to mean for an assertion
    // that can run at all.
    //
    // Proof this can fail, not just pass: C0 (above, same file) drives the identical
    // RPC as a genuine MEMBER administrativo and it SUCCEEDS (a case is created and
    // torn down) — so this call is capable of returning `ok()` true for a persona
    // that differs from this one only in holding a CCIH membership row. The
    // assertion below is not unfalsifiable by construction.
    const tpl = await getAnyPublishedTemplateVersion(
      request,
      { baseUrl: SUPABASE_URL, apikey: SUPABASE_SERVICE_KEY, bearerToken: SUPABASE_SERVICE_KEY },
      CCIH,
    )
    const rpc = await request.post(`${SUPABASE_URL}/rest/v1/rpc/create_case_from_template`, {
      headers: { ...hdr, 'Content-Type': 'application/json' },
      data: { p_template_id: tpl.templateId, p_label: `orphan-refusal-probe ${Date.now()}` },
    })
    expect(
      rpc.ok(),
      `create_case_from_template must REFUSE the orphan (reachable public door): ${await rpc.text()}`,
    ).toBeFalsy()

    // ⭐ THE REGRESSION THIS FILE EXISTS FOR. Before the mirror carried the
    // `role !== null` conjunct, this page rendered for both composites and offered
    // "Novo caso" behind that refusing door.
    await cachedSignIn(page, subject.email, PW)
    await gotoSettled(page, BOARD)
    // 'commission', not 'root' — and the distinction IS the claim. This principal
    // legitimately reaches the commission shell on their other standing (the shell
    // chrome is on the page); what must refuse them is the BOARD's own
    // `canInCommission` gate. A 'root' 404 here would mean the shell refused, which
    // would make this test pass for C1's reason and prove nothing about the mirror.
    expect(
      await notFoundKind(page),
      `${name} must be refused by the BOARD gate, inside a rendered shell`,
    ).toBe('commission')
    await expect(novoCaso(page)).toHaveCount(0)
  })
}
