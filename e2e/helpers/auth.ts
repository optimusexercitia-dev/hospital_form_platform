/**
 * Canonical E2E sign-in — session cache instead of ~865 real password grants.
 *
 * WHY: 67 of 72 spec files each defined their own `signInAs` that drove the real
 * /login form. A full suite made ~865 UI logins + ~54 direct token grants against
 * only **28 distinct personas** (610 of them `chefe.ccih@test.local`). That is ~40
 * minutes of pure login wall-clock, and it is the direct cause of the local-GoTrue
 * exhaustion that produced ~50 attributed failures across 10 separate gate runs
 * (memory: e2e-local-auth-ratelimit-on-repeated-resets).
 *
 * HOW: log each persona in **once per worker process**, keep its cookies in memory, and
 * inject them into the current context on every later switch. The pattern is not new
 * here — e2e/helpers/documents.ts already did exactly this for 4 files, with the comment
 * "a fresh /login on every switch exhausts the local GoTrue rate-limit". This generalises
 * it; documents.ts and ff2-matrix.ts now delegate here.
 *
 * IN-PROCESS ONLY — a disk tier was prototyped on 2026-07-28 and NOT adopted. The reason
 * is a risk, not a measured failure: Supabase session cookies carry a refresh token that
 * rotates and is single-use, and @supabase/ssr consumes it on refresh. Replaying a
 * persisted cookie set from another process could re-submit an already-consumed token and
 * trip GoTrue's reuse-detection. Confining the cache to one worker process keeps a single
 * owner for each token's lifecycle, which is why documents.ts scoped it that way too.
 * Honest footnote: the 3 failures that first prompted this were later shown to be
 * PRE-EXISTING (identical 77/3 on unmodified code), so the disk tier stands untested
 * rather than disproven — measure before adopting it.
 *
 * SELF-HEALING: after injecting cookies we navigate and check we did not land on /login;
 * if we did, we fall back to a real login. A stale cache costs one login, never a failure.
 */
import type { Cookie, Page } from '@playwright/test'

export const DEFAULT_PASSWORD = 'Test1234!'

const memo = new Map<string, Cookie[]>()

/** Drop every cached session (e.g. after a test mutates a persona's own memberships). */
export function clearAuthCache(): void {
  memo.clear()
}

const onLoginPage = (page: Page): boolean => {
  try {
    return new URL(page.url()).pathname.startsWith('/login')
  } catch {
    return true // about:blank etc. — treat as "not signed in"
  }
}

/**
 * A real UI login. The only path that spends a GoTrue password grant.
 *
 * @param _actAs — ACT (ADR 0106) Stage 1 harness seam (plan §4 Stage 1: "loginFresh
 *   … gains an actAs seam — a no-op until the picker exists, flipped in ONE place at
 *   Stage 3"). `_` -prefixed on purpose (house convention for an intentionally-unused
 *   binding, CLAUDE.md §8) — this is NOT dead code to clean up. Once Stage 3 ships the
 *   post-login role picker (multi-role principals land there before their final
 *   destination), this function is the ONE place that drives it: after the
 *   `waitForURL` below, branch on whether the picker rendered and, if so, select the
 *   role matching this parameter (dropping the leading underscore at that point).
 *   Every other function in this module funnels through here, so no other call site
 *   needs to change when that lands. Left untyped against the generated
 *   `Database['public']['Enums']['platform_role']` union deliberately — Stage 3 picks
 *   the type once something actually consumes the value; coupling it now would be a
 *   second thing Stage 3 has to touch.
 */
export async function loginFresh(
  page: Page,
  email: string,
  password: string = DEFAULT_PASSWORD,
  _actAs?: string,
): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByLabel(/e-mail/i).waitFor({ state: 'visible', timeout: 30_000 })
  await page.getByLabel(/e-mail/i).fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 })
  // Stage 3 inserts the picker-interaction block here (see the `_actAs` doc above).
}

/**
 * Sign `page` in as `email`, reusing a cached session when one is available.
 *
 * Post-condition matches a real login exactly: cookies set AND the page has landed on
 * the post-login destination (never /login). Every local `signInAs` in e2e/ delegates
 * here, so that contract must not weaken — specs rely on being "somewhere authenticated"
 * when this resolves.
 *
 * @param actAs — ACT (ADR 0106) Stage 1 harness seam (plan §4 Stage 1: "…and any
 *   storage-state reuse path in the same module — gains an actAs seam"). This IS the
 *   storage-state reuse path the plan means. Still UI-wise a no-op today (threaded
 *   straight through to `loginFresh`'s own no-op parameter, see its doc), but the
 *   cache key is partitioned by it starting now, deliberately: once Stage 3 makes the
 *   active hat part of what a login produces, the SAME persona signed in under two
 *   different hats is two different sessions, and a cache keyed on email alone would
 *   silently hand back the wrong hat's cookies to a test that asked for the other one.
 *   No existing call site passes `actAs`, so `cacheKey` collapses to plain `email` and
 *   today's behavior is byte-identical — this is why Stage 3 does not need to revisit
 *   the caching logic itself, only `loginFresh`'s body.
 */
export async function cachedSignIn(
  page: Page,
  email: string,
  password: string = DEFAULT_PASSWORD,
  actAs?: string,
): Promise<void> {
  // Always clear first: navigating to /login while still authenticated redirects to the
  // PREVIOUS user's home and no login form ever appears.
  await page.context().clearCookies()

  const cacheKey = actAs ? `${email}::${actAs}` : email

  const cached = memo.get(cacheKey)
  if (cached && cached.length > 0) {
    await page.context().addCookies(cached)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    if (!onLoginPage(page)) {
      // Re-capture: @supabase/ssr may have rotated the refresh token during that
      // navigation. Storing the post-navigation set keeps this worker's copy current
      // instead of replaying a token the server has already consumed.
      memo.set(cacheKey, await page.context().cookies())
      return
    }
    memo.delete(cacheKey) // session rejected — fall through to a real login
  }

  await loginFresh(page, email, password, actAs)
  memo.set(cacheKey, await page.context().cookies())
}

/** Back-compat alias — the name 67 spec files already use. */
export const signInAs = cachedSignIn

/**
 * Direct password grant for RLS probes that need a raw JWT rather than a browser
 * session. Cached per persona for the same reason as above.
 */
const tokenMemo = new Map<string, string>()
export async function accessToken(
  page: Page,
  email: string,
  password: string = DEFAULT_PASSWORD,
): Promise<string> {
  const hit = tokenMemo.get(email)
  if (hit) return hit
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL/ANON_KEY missing from env')
  const resp = await page.request.post(`${url}/auth/v1/token?grant_type=password`, {
    headers: { apikey: key, 'Content-Type': 'application/json' },
    data: { email, password },
  })
  if (!resp.ok()) throw new Error(`token for ${email}: ${resp.status()} ${await resp.text()}`)
  const token = ((await resp.json()) as { access_token: string }).access_token
  tokenMemo.set(email, token)
  return token
}
