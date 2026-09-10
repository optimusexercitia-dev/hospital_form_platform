import { test, expect } from '@playwright/test'
import { loginFresh, DEFAULT_PASSWORD, accessToken } from './helpers/auth'
import { svcSelect, svcUpdate, SUPABASE_URL } from './helpers/service-role'

/**
 * Pre-AE5 Batch 10 (ADMIN-ARM-IS-ACTIVE) — E2E for the admin arm following the
 * subject's `is_active` state (deactivated/suspended) at `public.assume_role`,
 * `app.is_admin()` and its TS mirror `src/lib/queries/session.ts` (`deriveIsAdmin`,
 * PO ruling R3). Hub: `docs/features/admin-arm-is-active.md`. Rulings:
 * `batch10-rulings.md` (R1 door-wide `assume_role` gate, R3 the TS mirror).
 *
 * ⚠ DEVIATION FROM THE TESTER BRIEF'S S1/S2 FRAMING, MEASURED BEFORE WRITING THESE
 * SPECS (CLAUDE.md "verify against the live app, never assume from the plan's
 * prose"): `platform@test.local` (id `00000000-0000-0000-0000-0000000000b0`) is
 * `is_admin = true` with ZERO memberships (seed.sql: "walled off — holds NO
 * commission/org membership"). `session.ts`'s `needsRoleSelection` is `activeRole
 * === null && distinctRoleTypes.size > 1` over `memberships ∪ grants` — a set that
 * NEVER includes the bare `is_admin` flag — so this persona is single-role-TYPE and
 * `custom_access_token_hook` seats `active_role = 'platform_admin'` implicitly at
 * every token mint (D11), with NO picker and NO client-side `assume_role` call ever
 * in its ordinary login path (confirmed: `selecionar-perfil/page.tsx` redirects any
 * caller whose `needsRoleSelection` is false before the picker form ever mounts).
 * There is consequently no "toast on the picker" surface for this persona to hit.
 *
 * What DOES fire, verified EMPIRICALLY (a first draft of S1 assumed a
 * `/conta-inativa` redirect on fresh sign-in and was measurably wrong — the actual
 * run stayed on `/login`): `src/lib/auth/actions.ts`'s sign-in action (pre-existing,
 * BE-6) reads `profiles.is_active`/`suspended_until` right after
 * `signInWithPassword` succeeds, and for a suspended/deactivated account calls
 * `supabase.auth.signOut()` **before returning** — no session is ever established —
 * and renders `MESSAGES.accountInactive` ("Sua conta está suspensa/desativada.
 * Contate o administrador da sua organização.") inline on `/login` itself.
 * `/conta-inativa` (`src/app/page.tsx`'s `context.isInactive` gate) is the sibling
 * check for a session that WAS active and went stale mid-session, re-evaluated on
 * the next full navigation — exactly the shape S3 below exercises without a
 * navigation at all (a Server Action). S1/S2 assert the sign-in-time banner, the
 * actually-observed mechanism, never established, never a stale claim; the NEW
 * Batch 10 door (`public.assume_role`'s door-wide `app.is_active` gate, R1) is
 * additionally exercised directly against the RPC, because no UI path calls it for
 * this walled-off persona — asserting only the login banner would leave
 * `assume_role`'s own refusal completely unproven (a UI-only pass, DB-door blind).
 */

const PLATFORM_ADMIN_ID = '00000000-0000-0000-0000-0000000000b0'
const PLATFORM_ADMIN_EMAIL = 'platform@test.local'

const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
if (!ANON_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY ausente — defina-o em .env.local.')
}

interface ProfileState {
  is_active: boolean
  suspended_until: string | null
}

async function readAccountState(request: import('@playwright/test').APIRequestContext) {
  const [row] = await svcSelect<ProfileState>(
    request,
    'profiles',
    `id=eq.${PLATFORM_ADMIN_ID}&select=is_active,suspended_until`,
  )
  return row
}

async function setAccountState(
  request: import('@playwright/test').APIRequestContext,
  patch: Partial<ProfileState>,
) {
  await svcUpdate(request, 'profiles', `id=eq.${PLATFORM_ADMIN_ID}`, patch)
}

/** Raw `assume_role` RPC attempt, bypassing every UI layer — the exact door R1
 * widened. `accessToken` (no `actAs`) is a plain password grant: GoTrue itself
 * never reads `profiles.is_active` (no `banned_until` sync exists — measured,
 * zero migrations couple the two), so this succeeds regardless of account state
 * and hands back a token whose `active_role` claim is already 'platform_admin'
 * (the hook's implicit single-role derive, unconditioned on `is_active` — that
 * asymmetry is exactly why the RPC-level door-wide gate (R1) is load-bearing
 * independent of the hook and independent of the page-level `isInactive` redirect). */
async function attemptAssumePlatformAdmin(
  request: import('@playwright/test').APIRequestContext,
) {
  const token = await accessToken(request, PLATFORM_ADMIN_EMAIL, DEFAULT_PASSWORD)
  return request.post(`${SUPABASE_URL}/rest/v1/rpc/assume_role`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: { p_role: 'platform_admin' },
  })
}

// All tests here mutate the SAME `platform@test.local` profile row — never
// parallelized, or two workers racing the same fixture corrupt each other
// (the idiom every other lifecycle-mutating spec file in e2e/ already uses).
test.describe.configure({ mode: 'serial' })

test.describe('ADMIN-ARM-IS-ACTIVE — the admin arm follows account state', () => {
  test('S1 — deactivated platform_admin: /conta-inativa gate holds, and assume_role itself refuses (keyboard-only login)', async ({
    page,
    request,
  }) => {
    const original = await readAccountState(request)
    expect(original.is_active, 'fixture precondition: platform@test.local starts active').toBe(
      true,
    )

    try {
      await setAccountState(request, { is_active: false })

      // Part A — real sign-in, KEYBOARD-ONLY (CLAUDE.md §8: one keyboard-only flow
      // per phase). Tab order verified against e2e/act-role-assumption.spec.ts's
      // own keyboard-only case: email (autofocus) → forgot-password link →
      // password → show-password toggle → Entrar.
      await page.goto('/login', { waitUntil: 'domcontentloaded' })
      const emailInput = page.getByLabel(/e-mail/i)
      await expect(emailInput).toBeVisible()
      await expect(emailInput).toBeFocused()
      await emailInput.pressSequentially(PLATFORM_ADMIN_EMAIL)

      await page.keyboard.press('Tab')
      await expect(page.getByRole('link', { name: /esqueci minha senha/i })).toBeFocused()

      await page.keyboard.press('Tab')
      const passwordInput = page.locator('input[name="password"]')
      await expect(passwordInput).toBeFocused()
      await passwordInput.pressSequentially(DEFAULT_PASSWORD)

      await page.keyboard.press('Tab')
      await expect(page.getByRole('button', { name: /mostrar senha/i })).toBeFocused()

      await page.keyboard.press('Tab')
      await expect(page.getByRole('button', { name: /^entrar$/i })).toBeFocused()
      await page.keyboard.press('Enter')

      // GoTrue accepts the credentials (they are correct); the sign-in ACTION
      // itself then reads is_active, signs the fresh session back out, and stays
      // on /login with the inline pt-BR notice — never establishing a session at
      // all (measured: this is NOT a redirect to /conta-inativa, which is the
      // sibling gate for a session that goes stale mid-session, not at sign-in).
      await expect(page.getByRole('status')).toContainText(
        'Sua conta está suspensa/desativada',
      )
      await expect(page).toHaveURL(/\/login$/)
      // Discrimination: never reaches the platform-admin registry — asserting the
      // ROUTED STATE, not a fleeting toast.
      await expect(page.getByRole('heading', { name: 'Organizações' })).toHaveCount(0)

      // Part B — the door R1 actually widened: public.assume_role, direct.
      const assumeResp = await attemptAssumePlatformAdmin(request)
      expect(assumeResp.ok(), 'assume_role must refuse a deactivated platform_admin').toBeFalsy()
      const assumeBody = JSON.stringify(await assumeResp.json())
      expect(assumeBody).toMatch(/42501/)
      expect(assumeBody).toMatch(/papel não disponível para este usuário/)
    } finally {
      await setAccountState(request, { is_active: original.is_active })
    }

    // Control (discrimination half, green before AND after Batch 10): the SAME
    // persona, restored ACTIVE, seats the hat and reaches the registry.
    await loginFresh(page, PLATFORM_ADMIN_EMAIL, DEFAULT_PASSWORD)
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { name: 'Organizações', level: 1 })).toBeVisible()
  })

  test('S2 — suspended platform_admin (suspended_until in the future): the same fold applies', async ({
    page,
    request,
  }) => {
    const original = await readAccountState(request)
    expect(
      original.suspended_until,
      'fixture precondition: platform@test.local starts unsuspended',
    ).toBeNull()

    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    try {
      await setAccountState(request, { suspended_until: future })

      // Same sign-in-time mechanism as S1 (src/lib/auth/actions.ts): a valid
      // password never reaches a session while suspended_until is in the future.
      await page.goto('/login', { waitUntil: 'domcontentloaded' })
      await page.getByLabel(/e-mail/i).fill(PLATFORM_ADMIN_EMAIL)
      await page.locator('input[name="password"]').fill(DEFAULT_PASSWORD)
      await page.getByRole('button', { name: /^entrar$/i }).click()
      await expect(page.getByRole('status')).toContainText(
        'Sua conta está suspensa/desativada',
      )
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.getByRole('heading', { name: 'Organizações' })).toHaveCount(0)

      // app.is_active FOLDS suspension the same way as deactivation — same door,
      // same message (assume_role's is_active gate does not distinguish the two
      // states, by design: R1's whole point is one predicate for both).
      const assumeResp = await attemptAssumePlatformAdmin(request)
      expect(assumeResp.ok(), 'assume_role must refuse a suspended platform_admin').toBeFalsy()
      const assumeBody = JSON.stringify(await assumeResp.json())
      expect(assumeBody).toMatch(/42501/)
      expect(assumeBody).toMatch(/papel não disponível para este usuário/)
    } finally {
      await setAccountState(request, { suspended_until: original.suspended_until })
    }

    await loginFresh(page, PLATFORM_ADMIN_EMAIL, DEFAULT_PASSWORD)
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { name: 'Organizações', level: 1 })).toBeVisible()
  })

  /**
   * S3 — the service-role mirror (PO ruling R3, `src/lib/queries/session.ts:270`
   * `deriveIsAdmin`). "Sign in first, then deactivate" — the fixture the brief
   * asks for, proving a MID-SESSION deactivation is caught by a mutating Server
   * Action's OWN fresh `getSessionContext()` read, independent of any full page
   * navigation (the `/conta-inativa` gate in S1/S2 only re-evaluates on
   * navigation; a Server Action POST against an already-rendered page is a
   * DIFFERENT request path and does not go through it).
   *
   * ⚠ DEVIATION FROM THE BRIEF'S NAMED FILES, MEASURED: `src/lib/admin/actions.ts`'s
   * `requireAdmin()`-gated actions (`createCommission`, `updateCommission`) have
   * NO reachable UI caller for `platform_admin` — `createCommission` has zero UI
   * callers at all (grep confirmed), and `updateCommission`/`assignStaffAdmin` are
   * wired only into `/o/[org]/manage/comissoes/[slug]`, the ORG-admin surface a
   * walled-off platform_admin cannot reach. `src/lib/users/actions.ts` never
   * checks `context.isAdmin` at all (its own header: "the platform_admin isAdmin
   * short-circuit is DELIBERATELY ABSENT"). The one action ACTUALLY reachable by
   * platform_admin, gated by the identical `requireAdmin()` → `context.isAdmin`
   * predicate the brief describes, is `createOrganization` in
   * `src/lib/platform/actions.ts` (wired to `OrganizationCreateForm` on `/admin`,
   * the platform_admin's own landing page) — used here instead, same mechanism
   * this unit's R3 mirror protects.
   */
  test('S3 — deactivated mid-session: createOrganization (context.isAdmin) refuses without a crash', async ({
    page,
    request,
  }) => {
    const original = await readAccountState(request)
    expect(original.is_active, 'fixture precondition: platform@test.local starts active').toBe(
      true,
    )

    try {
      // Sign in WHILE active — the page renders with a valid admin session.
      await loginFresh(page, PLATFORM_ADMIN_EMAIL, DEFAULT_PASSWORD)
      await expect(page).toHaveURL(/\/admin$/)
      await expect(page.getByRole('heading', { name: 'Organizações', level: 1 })).toBeVisible()

      // Deactivate OUT OF BAND — this browser page is never reloaded, so its own
      // render already passed admin/layout.tsx's gate under the OLD (active) state.
      await setAccountState(request, { is_active: false })

      // `<form noValidate>` — submitting empty fields still POSTs to the Server
      // Action; requireAdmin() runs BEFORE any field validation, so an empty form
      // reaching "forbidden" (not "informe o nome") proves the auth check fired
      // first, on a FRESH context read, with no crash.
      await page.getByRole('button', { name: 'Criar organização' }).click()
      await expect(page.getByRole('status').filter({ hasText: 'Você não tem permissão' })).toBeVisible()
      await expect(page.getByText('Informe o nome.')).toHaveCount(0)
    } finally {
      await setAccountState(request, { is_active: original.is_active })
    }
  })
})

/**
 * S4 — Class-2 professional-profile write by an ACTIVE platform_admin
 * (ADR 0201 D5; `update_professional_profile` / `create_professional_profile`
 * refuse `platform_admin` with 42501 at the DB door, already pgTAP-proven per the
 * hub). VERIFIED HERE, not trusted from the plan: `create_professional_profile` /
 * `update_professional_profile` (`src/lib/participants/actions.ts`) are called
 * from exactly ONE component in the whole tree —
 * `src/components/cases/add-participant-dialog.tsx` — grep-confirmed (no other
 * `.tsx` imports either wrapper). That dialog mounts only inside case-scoped
 * pages under `/o/[org]/c/[commission]/casos/**`, which require a live
 * commission/case membership to reach at all. `platform@test.local` holds ZERO
 * memberships anywhere (seed.sql: "walled off from tenant data... holds no
 * commission/org membership" — the architectural "noun rule": platform_admin may
 * not touch commission content). So no navigation, however constructed, lands an
 * active platform_admin on a page that renders this dialog — confirming Batch 9's
 * R6 finding independently rather than inheriting it. Recorded here, `test.skip`,
 * so the day a UI path is added this fires instead of staying silently absent.
 */
test.skip(
  'S4 — active platform_admin attempts a Class-2 professional-profile write through the UI',
  () => {
    // No reachable UI path exists (measured 2026-09-10): the only caller of
    // create_professional_profile/update_professional_profile is
    // add-participant-dialog.tsx, mounted only on commission/case-scoped pages
    // platform_admin cannot navigate to (zero memberships, by design). The DB-door
    // refusal itself is pgTAP-proven (hub `docs/features/admin-arm-is-active.md`,
    // ADR 0201 D5) — this skip records the UI absence, not a gap in coverage.
  },
)
