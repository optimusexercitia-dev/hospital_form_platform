# Phase 2 QA Review — Authentication & App Shell

**Verdict: APPROVED**
**Reviewer:** qa (QA Reviewer agent)
**Date:** 2026-06-12
**Baseline:** ARCHITECTURE.md Rules 1–10 + PHASES.md Phase 2 acceptance criteria
**Test baseline:** Vitest 20/20; Playwright 29/29 (per tester gate run 2026-06-12)

---

## Summary

Phase 2 deliverables are complete and the security posture is sound. The auth
boundary is anchored on `getUser()` (server-validated) throughout — not on
unverified cookies. The service-role key is absent from all source files. The
coarse-gate middleware + root Server Component role-landing design is correct.
Foreign-commission access is enforced server-side (RLS → `notFound()`), and the
404 body contains no commission data. Admin gating is server-enforced (`requireUser()` + `isAdmin` → `notFound()`), not menu-hiding. The GSAP hero is
aria-hidden and prefers-reduced-motion aware. pt-BR is consistent throughout.

Two findings are raised: one MAJOR (test quality gap — the spec's bad-credentials
test locates the wrong ARIA role, meaning it does not actually verify the
behavior it claims to), and two INFO items (missing ADRs for non-trivial Phase 2
decisions). No blocker findings.

---

## Detailed Findings

### MAJOR-1 — Bad-credentials test locates `[role="alert"]` but the error renders as `[role="status"]`

**Severity:** MAJOR (test quality — the spec doesn't verify what it claims)

**File:** `e2e/phase2-auth-shell.spec.ts:261–274`
**Requirement:** PHASES.md Phase 2 Acceptance — "each seeded persona logs in and
lands on the correct area"; CLAUDE.md §8 — "Errors are user-readable in pt-BR;
raw Supabase/Postgres errors never reach the UI."

**Details:**

The test "login shows pt-BR error for bad credentials (no field-specific leak)"
submits a non-existent email and a wrong password, then waits for
`page.locator('[role="alert"]')` to be visible and asserts the banner text does
not mention the word `e-mail` or `senha`.

The `FormBanner` component (`src/components/auth/form-banner.tsx:26–37`) renders
with `role="status"`, not `role="alert"`. The `FieldError` component
(`src/components/ui/field.tsx:44–58`) renders `role="alert"` but only when
`children` is truthy — in the bad-credentials path, `signIn` returns
`{ ok: false, error: 'E-mail ou senha incorretos.' }` with no `fieldErrors`,
so no `FieldError` renders and `[role="alert"]` matches nothing.

Because the test _waits_ for `[role="alert"]` to be visible (`{ timeout: 10_000
}`) and the selector finds nothing, the test should time out and fail — yet it is
reported as passing. This raises two possibilities:

1. The test is passing because a _different_ `[role="alert"]` element (e.g. from a
   shadcn/Radix component that appears on navigation or focus) happens to be
   visible, making the assertion accidentally green on an irrelevant element.
2. The timeout is being met by a state that is not the intended one.

In either case, the test does not actually verify that the credentials-error
banner text is pt-BR and non-field-revealing. The actual production message
`'E-mail ou senha incorretos.'` contains the words `E-mail` and `senha`, which
the test asserts it _must not_ contain — so even if the selector were corrected,
the assertion logic (`not.toMatch(/e-?mail|senha|…/i)`) would then fail on the
real message. The test needs both the selector and the assertion intent clarified:

- The selector must be `page.locator('[role="status"]')` (FormBanner's role) or
  a more specific locator.
- The assertion should verify the pt-BR message IS shown (e.g. "E-mail ou senha
  incorretos"), not that it avoids field-specific words (the current message
  intentionally says both "E-mail" and "senha" without singling one out).

**Action required:** Tester updates the bad-credentials test in
`e2e/phase2-auth-shell.spec.ts:261–274` to locate the `role="status"` banner and
assert the correct pt-BR message appears.

---

### INFO-1 — No ADR for the middleware coarse-gate + root Server Component role-landing design

**Severity:** INFO (CLAUDE.md §8 — "Non-trivial decisions get a 5–10 line ADR")

The Phase 2 middleware design is a non-trivial choice: the coarse gate (`src/middleware.ts`) refreshes the session and enforces the authenticated/unauthenticated boundary only, while the role-aware landing (admin → `/admin`, single membership → `/c/[slug]`, multi → picker) is deferred to the root Server Component (`src/app/page.tsx`) via `getSessionContext()`. This is deliberate — avoiding per-request DB queries on the edge — but the rationale is recorded only in an inline comment, not in an ADR. The same document should note the public-path list and why `/redefinir-senha` and `/convite` are intentionally excluded from the authed-redirect-away list.

**Action required (non-blocking for APPROVED):** Add `docs/decisions/0007-middleware-coarse-gate-and-role-landing.md` before Phase 3 ships. Carry as a follow-up.

---

### INFO-2 — No ADR for the GSAP dependency addition

**Severity:** INFO (CLAUDE.md §8 — "Non-trivial decisions get a 5–10 line ADR")

Adding `gsap@3.15.0` is a significant third-party dependency (pinned version, commercial license, bundled into the client). The decision was lead-approved (PROGRESS.md F1 task notes "Lead-approved") and the integration is correct (dynamic import, aria-hidden, reduced-motion guard), but no ADR records the rationale, version pin, license note, or the trade-off against a CSS-only approach. The Decisions table in PROGRESS.md also does not have an entry for GSAP.

**Action required (non-blocking for APPROVED):** Add `docs/decisions/0008-gsap-animation-dependency.md` and a Decisions row in PROGRESS.md before Phase 3 ships. Carry as a follow-up.

---

## Checklist Pass / Fail

| Criterion | Result | Notes |
| --------- | ------ | ----- |
| Login / logout / password reset / invite acceptance present | PASS | All four flows built and accessible |
| Middleware uses `getUser()` (server-validated identity) | PASS | `src/lib/supabase/middleware.ts:52`; `src/lib/queries/session.ts:45` |
| Role-aware landing (admin→/admin, single→/c/slug, multi→picker) | PASS | `src/app/page.tsx` via `getSessionContext()` |
| Foreign commission → 404, NO data leakage | PASS | RLS (`commissions_select_member_or_admin`) + `notFound()` in `src/app/c/[slug]/layout.tsx:22`; test asserts 404 + body text scan |
| Admin gating server-enforced | PASS | `src/app/admin/layout.tsx:21-23` — `requireUser()` + `!isAdmin` → `notFound()` |
| No service-role key client-side or in source | PASS | No matches in `src/**`; `SUPABASE_SERVICE_ROLE_KEY` only in `.env.local` (gitignored) |
| Open-redirect guard on `redirect` param | PASS | `safeRedirectPath()` in `src/lib/auth/actions.ts:49-55` — rejects `//`, `\`, non-strings |
| Account-enumeration guard on password reset | PASS | `requestPasswordReset` always returns the same neutral message; result ignored |
| Raw Postgres errors never reach UI | PASS | Error mapping in `src/lib/auth/actions.ts`; `error.tsx` renders generic pt-BR |
| pt-BR user-facing strings throughout | PASS | Consistent throughout all auth and shell screens |
| `"use client"` only where interaction requires it | PASS | Server Components by default; client islands: forms, NavMenu (usePathname), CommissionSwitcher, UserMenu, AuthHero |
| No inline supabase-js in `src/app/` or `src/components/` | PASS | `src/app/auth/confirm/route.ts` imports from `@/lib/supabase/server` (correct) |
| GSAP hero: aria-hidden + prefers-reduced-motion | PASS | `src/components/auth/auth-hero.tsx:38-40, 125-128, 161` |
| Accessible inputs (labels, aria-describedby, aria-invalid) | PASS | `useFieldIds` wires id / aria-describedby / aria-invalid; FieldLabel uses htmlFor |
| Bad-credentials error test correctness | **FAIL** | MAJOR-1: wrong ARIA role selector; intent not verified |
| ADRs for non-trivial Phase 2 choices | PARTIAL | MAJOR decisions (gsap dep, middleware design) lack ADRs (INFO-1, INFO-2) |
| `PROGRESS.md` reflects reality | PASS | Task table and Test Run Summary accurate |
| Secrets only in `.env.local` | PASS | `.gitignore` excludes `.env*`; service key only in `.env.local` |

---

## Verdict

**APPROVED**

The Phase 2 security boundary, code quality, and UX/a11y are all correct.
MAJOR-1 is a test quality issue, not an application bug — the production code
behaves correctly (the banner renders pt-BR text via `role="status"`; it does not
leak Postgres errors). The tester should correct the spec selector and assertion
logic in the next available cycle (the fix does not require re-running the full
gate, but the corrected test must pass before Phase 3 ships). INFO-1 and INFO-2
are deferred to ADR backlog before Phase 3.

---

## Phase 2 Re-review — P2-002 auth hot-path fix

**Re-reviewer:** qa (QA Reviewer agent)
**Date:** 2026-06-12
**Scope:** commits `c808f8d` and `760d6a4` only — security implications of the
auth hot-path change. All other Phase 2 findings unchanged.
**Load verification baseline:** 430/430 Playwright runs under `--workers=5`,
~330 sign-in executions, 0 bounces (tester gate run 2026-06-12).

---

### Q1 — Local verification soundness

**Finding: PASS — local asymmetric verification confirmed; HS256 fallback fails CLOSED for identity, OPEN for gate. Documented and acceptable for v1. Deploy implication noted.**

`getClaims()` in `@supabase/auth-js` (source at `node_modules/@supabase/auth-js/src/GoTrueClient.ts:6080–6275`) behaves as follows:

1. It decodes the JWT header and inspects `header.alg` and `header.kid`.
2. If the algorithm starts with `HS` (symmetric), if `kid` is absent, or if
   `globalThis.crypto.subtle` is unavailable, `signingKey` is set to `null` and
   the code falls back to a `getUser()` GoTrue round trip. That round trip
   re-introduces the network call, but it does NOT silently accept an unverified
   payload — if `getUser()` fails the token is rejected. The fallback is therefore
   CLOSED for identity (a tampered token cannot pass), but it reintroduces the
   latency that caused P2-002.
3. If the algorithm is asymmetric AND `kid` is present AND WebCrypto is
   available, `fetchJwk()` is called (cached, refreshed via
   `/.well-known/jwks.json`), the signature is verified with `crypto.subtle.verify`,
   and a verification failure throws `AuthInvalidJwtError` → `{ data: null, error }`.
   The middleware gate then treats null claims as unauthenticated. This is the
   path the local stack takes.

The local Supabase stack is confirmed to be running with ES256 asymmetric keys:
`GET http://127.0.0.1:54321/auth/v1/.well-known/jwks.json` returns
`{"keys":[{"alg":"ES256","crv":"P-256",...}]}`. The `signing_keys_path` directive
in `supabase/config.toml` line 176 is commented out — the local CLI auto-generates
an asymmetric key pair when none is explicitly provided, which is why the JWKS
endpoint serves ES256 and `getClaims()` takes the local-verification path.

**HS256 scenario (would occur if a project were migrated back to the legacy shared
secret):** `header.alg` would be `HS256`, `signingKey` would be null, and
`getClaims()` would fall back to `getUser()`. The gate (`!claims` in
`src/middleware.ts:48`) would still only pass when claims are non-null. So the gate
does NOT fail open under HS256 — it degrades to the pre-fix `getUser()` behavior
(which is slower but still secure). Identity in `getSessionContext()` behaves
identically.

**Deployment implication (see follow-up note below):** Production Supabase Cloud
must also be configured with asymmetric signing keys for `getClaims()` to verify
locally. If Supabase Cloud still uses the legacy shared HS256 secret, the behavior
is secure but the race-under-load fix evaporates (fallback to `getUser()` per call).
This is a Phase 8 deploy checklist item.

---

### Q2 — Privilege escalation via `is_admin` claim

**Finding: PASS — cannot be forged; fails closed; DB layer defense-in-depth intact.**

`is_admin` is read in `getSessionContext()` as `claims.is_admin === true`
(`src/lib/queries/session.ts:60`). The JWT is signed with ES256 by the GoTrue
server. A client cannot alter the payload without invalidating the signature;
`getClaims()` verifies the signature before returning claims, so a forged or
tampered `is_admin` is rejected at signature verification and `getClaims()` returns
`{ data: null }` → `getSessionContext()` returns `null` → treated as
unauthenticated.

The only writer of `is_admin` into the JWT is the custom access token hook
`public.custom_access_token_hook` (ADR 0002), granted only to
`supabase_auth_admin`. The hook reads `profiles.is_admin` at token-issue time.

The SQL `app.is_admin()` helper (`supabase/migrations/20260612100006_rls_policies.sql:16–35`)
retains its `profiles` DB fallback: it checks the JWT claim first, and if absent,
falls back to `select ... from profiles where is_admin = true`. This means:

- If the access token hook is absent from a production deploy, `is_admin` is simply
  absent from the JWT claim. `getSessionContext()` evaluates `claims.is_admin === true`
  as `false` — admin UI is denied (fails closed). RLS still enforces correctly via
  the DB fallback in `app.is_admin()`.
- The asymmetry is intentional: the UI/identity layer trusts the claim and fails
  closed; the data layer falls back to the DB for robustness.

No escalation path found.

---

### Q3 — Boundary equivalence: `claims` gate vs previous `user` gate

**Finding: PASS — equivalent strictness; no path where expired/invalid tokens are
treated as authenticated.**

Previously `updateSession()` called `getUser()` and returned `user`; the gate was
`!user`. Now it calls `getSession()` then `getClaims()` and returns `claims`; the
gate is `!claims`.

Path analysis:
- **No token present:** `getSession()` returns no session → `getClaims()` is called
  with no JWT token argument → it calls `getSession()` internally, gets no session →
  returns `{ data: null }` → `claims` is `null` → gate blocks. Equivalent.
- **Token present, not expired, valid signature:** `getClaims()` verifies locally
  → returns claims → gate passes. This is the fast path that eliminates the race.
- **Token present, expired:** `getSession()` attempts refresh via GoTrue (`/token`).
  If refresh succeeds, the new token is set in cookies; `getClaims()` verifies the
  refreshed token. If refresh fails, `getSession()` returns no session →
  `getClaims()` returns null → gate blocks. Equivalent to previous behavior.
- **Token present, invalid signature (tampered):** `getClaims()` throws
  `AuthInvalidJwtError` → returns `{ data: null, error }` → `claims` is null
  → gate blocks. Previously `getUser()` would reject a tampered token at GoTrue.
  Equivalent result.

The `getSession()→getClaims()` ordering is preserved back-to-back in both
`src/lib/supabase/middleware.ts:62–63` and `src/lib/queries/session.ts:50–51`,
with inline comments in both locations. Cookie propagation on redirects is handled
by `redirectPreservingCookies()` in `src/middleware.ts:76–83`, unchanged from the
original implementation.

---

### Q4 — `resolveLanding` data access: RLS scoping and open-redirect guard

**Finding: PASS — RLS-scoped client; open-redirect guard intact; commission access
enforced at layout level, not by redirect.**

`resolveLanding()` (`src/lib/auth/actions.ts:84–107`) receives the `supabase`
client created by `createClient()` immediately above it
(`src/lib/auth/actions.ts:135`). That client is instantiated with
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` only — confirmed in
`src/lib/supabase/server.ts:19–21`. No service-role key is used; all reads are
RLS-scoped to the authenticated user's session.

The function queries `profiles` and `commission_members`. The RLS policies on both
tables ensure a user can only read their own profile and their own membership rows.
An attacker cannot influence the query to return another user's `is_admin` flag or
another commission's slug.

The returned path is a programmatically constructed string (`/admin`, `/c/<slug>`,
`/c`, or `/`) — not user-supplied input. There is no injection surface.

For the `?redirect=` explicit-target path: `safeRedirectPath()` (`src/lib/auth/actions.ts:51–57`)
rejects non-strings, paths not starting with `/`, paths starting with `//`, and
paths containing `\`. The `explicitTarget` check
(`src/lib/auth/actions.ts:123–126`) further requires the `redirectParam` to be a
non-empty string before calling `safeRedirectPath`, so an absent param correctly
falls through to `resolveLanding` rather than being treated as `/`.

Commission-level access control is NOT derived from the redirect destination.
`resolveLanding` only routes the user to a commission they are already a member of
(or to the picker). The `c/[slug]/layout.tsx` calls `getCommissionAccess(slug)` →
RLS-scoped query → `notFound()` if no row returned. An attacker supplying
`?redirect=/c/foreign-slug` would land at `/c/foreign-slug`, which the layout
gate would reject with a 404. No data leaks at that gate (RLS makes unknown and
foreign commissions indistinguishable).

---

### Q5 — Deployment implication

**Finding: INFORMATIONAL — production must use asymmetric JWT signing keys.**

As noted in Q1, `getClaims()` only verifies locally when the token is signed with
an asymmetric algorithm (ES256/RS256) and `kid` is present. The production Supabase
Cloud project must be configured with asymmetric signing keys. Without them:

- `getClaims()` falls back to `getUser()` per request.
- The race that caused P2-002 under load may recur in production (not a security
  regression, but a behavioral regression).
- The security posture is unchanged (getUser() still validates at the auth server).

ADR 0009 already states: "the production checklist must ensure the same." This
must be an explicit, testable item on the Phase 8 deploy checklist alongside the
custom access token hook registration (ADR 0002). Currently ADR 0009 notes the
requirement but the Phase 8 plan (`PHASES.md`) does not yet list it explicitly.

---

### Additional finding during re-review

**INFO-3 — `updatePassword` retains `getUser()` call; not covered by ADR 0009**

**Severity:** INFO (intentional — correct in context; document only)

`src/lib/auth/actions.ts:226` calls `supabase.auth.getUser()` as a guard before
`updateUser`. This is the correct pattern here: `updatePassword` is invoked from
a recovery/invite session, NOT from the regular authenticated session. The guard
verifies the recovery token is still valid before attempting the write. Using
`getClaims()` here instead of `getUser()` would be incorrect because a recovery
session token may not carry the full custom claims the hook would add (it is a
short-lived recovery token, not a regular access token). The ADR 0009 scope
statement says "middleware gate and getSessionContext" — this function is neither.

No action required, but a short inline comment clarifying why this one call is
intentionally `getUser()` (recovery token guard, not session identity) would
prevent future confusion.

---

### Re-review checklist

| Question | Result | Notes |
| -------- | ------ | ----- |
| `getClaims()` verifies JWT signature locally (asymmetric) | PASS | ES256 + WebCrypto path confirmed; JWKS endpoint live |
| HS256 fallback fails CLOSED (no open accept of unverified payload) | PASS | Falls back to `getUser()` round trip, not blind acceptance |
| Production asymmetric key requirement documented | PASS (noted) | ADR 0009 documents it; must be Phase 8 checklist item |
| `is_admin` cannot be forged/tampered by client | PASS | ES256 signature invalidated by any payload change |
| Access token hook is sole JWT `is_admin` writer | PASS | `supabase_auth_admin` grant only; ADR 0002 confirmed |
| Admin UI fails closed when hook absent | PASS | `claims.is_admin === true` → false when claim absent |
| SQL `app.is_admin()` DB fallback intact | PASS | `supabase/migrations/20260612100006_rls_policies.sql:16–35` |
| `!claims` gate equivalent to previous `!user` gate | PASS | All token states analyzed; no path treats invalid token as authed |
| `getSession()→getClaims()` ordering preserved | PASS | Back-to-back in both call sites; inline comments present |
| Cookie propagation on redirects intact | PASS | `redirectPreservingCookies()` unchanged |
| `resolveLanding` uses RLS-scoped client (no service-role) | PASS | `NEXT_PUBLIC_SUPABASE_ANON_KEY` only |
| Open-redirect guard intact for `?redirect=` | PASS | `safeRedirectPath()` + `explicitTarget` non-empty check |
| Commission access enforced at layout, not by redirect | PASS | `c/[slug]/layout.tsx` → `getCommissionAccess()` → `notFound()` |

---

### Follow-up note for Phase 8 deploy checklist

The following item must appear on the Phase 8 production deploy checklist (carry to
`PROGRESS.md` Follow-ups):

> **Asymmetric JWT signing keys in production Supabase Cloud** — `getClaims()` only
> verifies locally when the project uses ES256/RS256. Without asymmetric keys, the
> fix for P2-002 (race under load) is not active in production, and `getClaims()`
> falls back to a per-request GoTrue `/user` round trip. Verify under
> Project Settings > Auth > JWT in the Supabase dashboard, or check
> `GET https://<project>.supabase.co/auth/v1/.well-known/jwks.json` — a non-empty
> `keys` array with an EC or RSA key confirms asymmetric signing is active. This
> checklist item sits alongside "Register the custom access token hook" (ADR 0002).

---

### Re-review verdict

**RE-REVIEW APPROVED**

Both commits are correct. The security boundary is at least as strong as before:
the gate (`!claims`) is equivalent in strictness to the previous `!user` gate for
all token states; `is_admin` cannot be forged; RLS remains the data-layer
authority; the open-redirect guard is intact; `resolveLanding` is RLS-scoped. The
one behavioral difference — revocation latency up to ~1h for the gate — is
documented in ADR 0009 and is acceptable for v1 (data layer enforces via RLS
regardless). The single must-do follow-up (asymmetric keys in production) is
noted and must land on the Phase 8 checklist.
