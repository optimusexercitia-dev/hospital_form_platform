# PROGRESS.md — Project Status Tracker

> Single source of truth for project status. Update IMMEDIATELY when state
> changes. The lead owns the Phase Status table; each teammate owns their own
> rows in the other sections. Never report status that isn't written here.

## Phase Status

| Phase | Name                          | Status | Build | Tests | QA | Human ✓ | Completed | Commit |
| ----- | ----------------------------- | ------ | ----- | ----- | -- | ------- | --------- | ------ |
| 0     | Scaffolding & Environment     | ✅ complete | ✅ | ✅ 5/5 | ✅ APPROVED | ✅ 2026-06-11 | 2026-06-11 | `d64281e` |
| 1     | Schema, Auth & RLS            | ✅ complete | ✅ | ✅ 88/88 | ✅ APPROVED | ✅ 2026-06-12 | 2026-06-12 | `691662f` |
| 2     | Authentication & App Shell    | ✅ complete | ✅ | ✅ 49/49 + load | ✅ APPROVED + re-review | ✅ 2026-06-12 | 2026-06-12 | `pending` |
| 3     | Admin Area & User Management  | 🔜 not started | – | – | – | – | – | – |
| 4     | Form Builder & Versioning     | 🔜 not started | – | – | – | – | – | – |
| 5     | Wizard Filling, Conditional Sections & Resume | 🔜 not started | – | – | – | – | – | – |
| 6     | Section Sign-offs & Submission Lifecycle | 🔜 not started | – | – | – | – | – | – |
| 7     | Dashboards & Submissions Browser | 🔜 not started | – | – | – | – | – | – |
| 8     | Deployment                    | 🔜 not started | – | – | – | – | – | – |

Status legend: 🔜 not started · 🏗️ in progress · 🧪 testing · 🔍 QA review · ⏸️ awaiting human approval · ✅ complete · ❌ blocked

## Current Phase Tasks

<!-- Lead recreates this table at the start of each phase -->

**Phase 2 — Authentication & App Shell** (started 2026-06-12)

| Task | Owner | Status | Depends on | Notes |
| ---- | ----- | ------ | ---------- | ----- |
| B1 · Middleware session client (`src/lib/supabase/middleware.ts` `updateSession`) | backend | done | – | `@supabase/ssr` cookie refresh; returns `{ response, user }`. Anon key only. typecheck+lint green. |
| B2 · `src/middleware.ts` — session refresh + auth gating + matcher | backend | done | B1 | Coarse gate (lead-approved). Unauth→`/login?redirect=<path>`; authed on `/login`,`/recuperar-senha`→`/`; `/redefinir-senha`,`/convite`,`/auth/*` public. Redirects copy refreshed cookies. typecheck+lint green. |
| B3 · Session/membership queries (`src/lib/queries/session.ts`) | backend | done | – | `getSessionContext()`, `requireUser()`, `getCommissionAccess(slug)`. Identity from `getUser()` (server-validated); `is_admin`/memberships from DB. typecheck+lint green. Signatures posted to frontend. |
| B4 · Auth server actions (`src/lib/auth/actions.ts`) | backend | done | B3 | `signIn`, `signOut`, `requestPasswordReset`, `updatePassword`; `useActionState`-shaped, pt-BR mapping, open-redirect guard, account-enumeration guard. typecheck+lint green. |
| B5 · Auth route handler (`src/app/auth/confirm/route.ts`) | backend | done | B4 | GET `verifyOtp({token_hash,type})`; recovery→`/redefinir-senha`, invite→`/convite`, else `/`; fail/missing→`/login?error=link_invalido`. config.toml `additional_redirect_urls` set (4 local origins); GoTrue picked it up after restart. |
| B6 · Seed/picker + config check; regenerate types | backend | done | B3 | Added `multi@test.local` (id `…0008`) staff of BOTH commissions (per lead). pgTAP hermetic → unaffected (re-ran: 65/65). Seed now 8 users / 8 memberships; multi signs in OK. forms/responses unchanged (2/2/10/1). Types regenerated → no drift. Decision logged. |
| F0 · `frontend-design` pass + layout cleanup (`lang="pt-BR"`, metadata, remove boilerplate) | frontend | done | – | Done 2026-06-12. "Calm clinical precision" system: petrol accent + warm-porcelain neutrals (oklch), Fraunces display / Spline Sans body. Motion tokens + CSS `rise-in`/`fade-in` utilities + `prefers-reduced-motion` guard in `globals.css`. `layout.tsx` → `lang="pt-BR"` + pt-BR metadata (clears QA Phase 0 MINOR-1). `page.tsx` is a temporary pt-BR placeholder (real role-landing = F5). lint+typecheck+home smoke green; dev boots, `/` → 200. GSAP/three are NOT yet installed — deferred to F1, pending lead approval of deps (see F1+F3 plan). |
| F1 · `(auth)/login` page + form | frontend | done | B4, F0 | Done 2026-06-12 (`7423046`). Lead-approved. `(auth)` group: split-canvas layout + lazy GSAP canvas mesh hero (aria-hidden, reduced-motion = static frame, off critical path). `login/page.tsx` reads `redirect`+`error` (link_invalido notice); `LoginForm` wires `signIn` via `useActionState` (pending + field/banner errors, hidden `redirect`). New a11y primitives: `Input`/`Label`(Radix)/`Field`(`useFieldIds`)/`FormBanner`. gsap 3.15.0 pinned. lint+typecheck green; `/login` → 200; keyboard focus + reduced-motion + mobile verified by screenshot. |
| F2 · Password reset request + set/reset-password + invite-acceptance pages | frontend | done | B4, B5, F1 | Done 2026-06-12 (`eea963a`). Reuse `(auth)` layout + field primitives. `/recuperar-senha` → `ResetRequestForm` (`requestPasswordReset`; neutral "se houver uma conta…" notice — enumeration guard). `/redefinir-senha` + `/convite` → `PasswordSetForm` (`updatePassword`, server redirects `/` on success) with live client length+match hints (server is authority). **Verified**: all 3 → 200; neutral notice shown; "as senhas não coincidem" hint + aria-invalid. lint+typecheck green. |
| F3 · Commission app shell (`c/[slug]/layout.tsx`) — nav, role-aware menu, commission switcher, user/logout, loading/error | frontend | done | B3, F0 | Done 2026-06-12 (`e3b6253`). Lead-approved. Server layout → `getCommissionAccess`/`notFound()` (unknown+inaccessible indistinguishable). `TopNav` (server, prop-driven): product mark, `CommissionSwitcher` (only when memberships>1), role-aware `NavMenu` (Phase 3–7 areas = "em breve", no dead links), `UserMenu` (logout `<form action={signOut}>`). `loading.tsx` skeleton + pt-BR `error.tsx`. New UI: dropdown-menu/avatar (Radix), skeleton. Global pt-BR `not-found.tsx` (Rule 10) replaces Next default. **Verified via real seeded logins**: staff → no switcher, no coordinator items; staff_admin → Gerenciar/Painel; foreign `/c/farmacia` → 404 no name leak; user menu opens by keyboard, logout → `/login`. lint+typecheck green. |
| F4 · Landing shells: `c/[slug]/page.tsx`, admin shell (`admin/layout.tsx`+`page.tsx`, admin-only) | frontend | done | B3, F3 | Done 2026-06-12 (`e3b6253` commission page, `f416b92` admin). Lead pre-approved. `c/[slug]/page.tsx`: role-aware greeting + "em breve" cards. `admin/layout.tsx`: **server-enforced** `requireUser()`+`isAdmin` → `notFound()` for non-admins (not menu-hiding). **Verified**: `admin@test.local` → `/admin` 200; non-admin → `/admin` **404**. lint+typecheck green. |
| F5 · Root `/` role landing + commission picker (`c/page.tsx`) | frontend | done | B3, F3 | Done 2026-06-12 (`f416b92`). `page.tsx` replaces F0 placeholder: `getSessionContext()` → admin→`/admin`, single→`/c/<slug>`, multi→`/c`, none&!admin→friendly pt-BR no-access. `/c` picker = commission cards (defensive 0/1 redirects). **Verified via seeded logins**: admin→/admin, staff1.ccih→/c/ccih, multi@test.local→/c picker (2 cards), card→/c/ccih. ⚠️ **Breaks Phase 0 home smoke test** `src/app/page.test.tsx` (tester-owned): it asserted a heading/link the role-landing intentionally no longer renders. Flagged to lead+tester for update/retire. |

<details><summary>Phase 1 tasks (completed 2026-06-12)</summary>

| Task | Owner | Status | Depends on | Notes |
| ---- | ----- | ------ | ---------- | ----- |
| Core schema migrations (profiles trigger, commissions, members, forms, versions, sections, items, admin claim) | backend | done | – | Migrations 100001–100003. Admin claim via custom access token hook (ADR 0002). |
| Response lifecycle migrations (responses, answers, signoffs, immutability triggers, display-item rejection) | backend | done | core schema | Migration 100004. Published + submitted immutability + display-item rejection triggers. |
| Condition evaluator + `submit_response` RPC + publish validation, with SQL unit tests | backend | done | lifecycle | Migration 100005. Sign-off check feature-flagged OFF (ADR 0004). pgTAP `20`/`30`/`50` green. |
| Full RLS policy set + `is_member_of`/`is_staff_admin_of` helpers + `form-assets` bucket policies | backend | done | lifecycle | Migrations 100006–100007. Deny-by-default; pgTAP `40` green. Fixed a profiles-policy RLS recursion (now a privileged-column trigger). |
| Seed: personas, 2 commissions, unsectioned + sectioned sample forms, ~10 responses | backend | done | RPC + RLS | `seed.sql`: 7 users, 2 commissions, 2 published forms, 10 submitted + 1 in_progress. Survives `db reset`. |
| RLS/RPC test suite (pgTAP or SQL) + regenerate types | backend | done | seed | pgTAP suite 56/56 via `npx supabase test db` (ADR 0003). Types regenerated; `typecheck` + Vitest evaluator (18/18) green. |
| QA Phase 1 loop-back: RLS hardening (MAJOR-1, MINOR-1/2/3) + signoff-immutability test (MAJOR-2) | backend | done | RLS/RPC suite | Migration 100008. staff_admin UPDATE role-restricted; eval_condition search_path pinned; profiles no-delete (policy + trigger); response version↔commission guard. pgTAP **65/65**; typecheck + Vitest green. INFO-1 deferred to Phase 8. |

</details>

<details><summary>Phase 0 tasks (completed 2026-06-11)</summary>

| Task | Owner | Status | Notes |
| ---- | ----- | ------ | ----- |
| Bootstrap scaffold + toolchain | lead | done | ADR 0001. |
| Agent definitions + settings | lead | done | 4 agents. |
| Empty initial migration + `supabase start` | backend | done | Stack boots; REST + Auth 200. |
| Type generation wired | backend | done | `gen:types` script. |
| Smoke tests (1 Vitest + 1 Playwright) | tester | done | jsdom pinned ^25. |
| Client factories `src/lib/supabase/{browser,server}` | backend | done | Typed, anon key only. |

</details>

## Bug Log

<!-- Filed by tester; status updated ONLY by tester after re-verification -->

| ID | Phase | Severity | Description / repro | Expected | Actual | Spec | Owner | Status |
| -- | ----- | -------- | ------------------- | -------- | ------ | ---- | ----- | ------ |
| P2-001 | 2 | MAJOR | Spec defect: bad-credentials test used `[role="alert"]` (no such element — `FormBanner` renders `role="status"`), so the locator silently matched nothing and the `not.toMatch(/e-mail\|senha/i)` assertion passed vacuously. Additionally the negative regex was semantically wrong: the correct enumeration-safe message IS "E-mail ou senha incorretos." (names both fields together), so the regex would fire on it. | Banner locator targets `[role="status"]`; test asserts the exact message `'E-mail ou senha incorretos.'` via positive `toBe` (sufficient proof of non-enumeration). | `[role="alert"]` matched nothing; test gave a false green without observing the actual banner. | `e2e/phase2-auth-shell.spec.ts` L261 — Phase 2 AC clause 7 (bad-creds, no field-specific leak) | tester | RESOLVED — fixed same session, re-verified 2026-06-12, 29/29 green |
| P2-002 | 2 | BLOCKER | Post-sign-in session race under parallel load. Repro: `npx playwright test --workers=5` — keyboard-only flow (~1 in 5 runs). After pressing Enter on the password field the sign-in action redirects to `/`; root `page.tsx` calls `getSessionContext()` and receives no session (or empty memberships), bouncing the user to `/login?redirect=%2Fc%2Fccih` instead of the authenticated shell. Occasionally surfaces as a 404 at `/c/ccih`. Navigation trace: `navigated to "/"` → `navigated to "/login?redirect=%2Fc%2Fccih"`. Intermittently violates Phase 2 primary acceptance criterion: "each persona logs in and lands on the correct area." | After sign-in, `waitForURL(/c/ccih)` succeeds and the authenticated shell renders. | `waitForURL(/c/ccih, 15s)` times out — browser bounced to `/login?redirect=/c/ccih`. | `e2e/phase2-auth-shell.spec.ts` L333 — keyboard-only flow; Phase 2 AC clause 1 (persona lands on correct area) | backend | RESOLVED — re-verified 2026-06-12: 430 sign-in/landing executions under --workers=5 (290 tests ×repeat-each=10 full suite + 140 tests ×repeat-each=20 targeted), 0 bounces. Fixes: c808f8d (signIn resolves landing directly, removes /hop) + 760d6a4 (middleware identity via local JWT getClaims(), no getUser() GoTrue round trip). |

## Test Run Summary

<!-- Tester appends one row per full-suite run -->

| Date | Phase | Specs | Passed | Failed | Notes |
| ---- | ----- | ----- | ------ | ------ | ----- |
| 2026-06-11 | 0 | Vitest: 1 file / 2 tests; Playwright: 1 file / 3 tests | 5 | 0 | First full run. jsdom downgraded ^27→^25 (ESM compat). |
| 2026-06-12 | 1 | Vitest: 2 files / 20 tests; Playwright: 1 file / 3 tests; pgTAP: 6 files / 56 tests (run twice: pre- and post-reset) | 79 | 0 | Phase 1 gate run. Seed verified: 7 auth users, 2 commissions, 6 members, 2 published versions, 10 submitted + 1 in_progress responses. Auth sanity: admin@test.local, chefe.ccih@test.local, staff1.ccih@test.local all return access_token. Reset+pgTAP cycle stable. |
| 2026-06-12 | 1 | Vitest: 2 files / 20 tests; Playwright: 1 file / 3 tests; pgTAP: 6 files / 65 tests | 88 | 0 | QA loop-back re-run after migration 100008 (RLS hardening). All suites green. Seed counts unchanged: 7 users, 2 commissions, 6 members, 2 published versions, 10 submitted + 1 in_progress. |
| 2026-06-12 | 2 | Vitest: 2 files / 20 tests; Playwright: 2 files / 29 tests | 49 | 0 | Phase 2 gate run. New spec: e2e/phase2-auth-shell.spec.ts (25 tests covering all 8 acceptance bullets). Retired obsolete home.spec.ts (old root assertions → /login public entry). Updated src/app/page.test.tsx (role-landing not unit-testable → LoginPage smoke). All 8 acceptance criteria covered: persona landing, auth boundary + redirect round-trip, foreign-commission 404 with no data leakage, server-side admin gating, role-aware shell (staff vs staff_admin menu, switcher), logout + session cleared, auth page UI behaviours, keyboard-only sign-in+logout flow. Seed: 8 users / 8 memberships (incl. multi@test.local). |
| 2026-06-12 | 2 | Playwright: 2 files / 29 tests | 29 | 0 | QA loop-back re-run. Fixed P2-001: bad-creds spec now targets `[role="status"]` and asserts exact message `'E-mail ou senha incorretos.'`. Full suite green. |
| 2026-06-12 | 2 | Playwright: 2 files / 29 tests (--workers=5) | 28 | 1 | Load run post shell-readiness hardening (commit 0f4f776). Keyboard-only flow fails intermittently: post-sign-in session race (P2-002, BLOCKER). Navigation trace: `/` → `/login?redirect=%2Fc%2Fccih`. Spec is a genuine detector — no masking applied. All other 28 tests stable. Holding gate for backend fix. |
| 2026-06-12 | 2 | Playwright: 2 files / 29 tests | 29 | 0 | P2-002 fix verification — baseline run (default workers). 29/29 green. |
| 2026-06-12 | 2 | Playwright: 2 files / 290 tests (--workers=5 --repeat-each=10) | 290 | 0 | P2-002 load stress run 1 — full suite under concurrency, 10× repeat. ~190 sign-in/landing executions. Zero post-login bounces. |
| 2026-06-12 | 2 | Playwright: 7 tests / 140 runs (--workers=5 --repeat-each=20 -g "lands on\|Keyboard-only") | 140 | 0 | P2-002 load stress run 2 — targeted sign-in/landing + keyboard-only tests, 20× repeat. 140 sign-in/landing executions. Zero post-login bounces. P2-002 RESOLVED. |

## QA Verdicts

| Phase | Verdict | Report | Blockers/Majors | Follow-ups carried |
| ----- | ------- | ------ | --------------- | ------------------ |
| 0 | APPROVED | [phase-0-review.md](docs/reviews/phase-0-review.md) | None | MINOR-1: set lang="pt-BR" in layout.tsx (Phase 2); MINOR-2: close stale supabase-start follow-up; INFO: update ADR 0001 to note --passWithNoTests removed |
| 1 | APPROVED (re-verified 2026-06-12) | [phase-1-review.md](docs/reviews/phase-1-review.md) | All resolved in M8: MAJOR-1 (USING clause fix + demotion test); MAJOR-2 (3 sign-off immutability tests added); MINOR-1 (eval_condition search_path); MINOR-2 (profiles never-deleted: policy split + trigger); MINOR-3 (version/commission guard trigger) | INFO-1: consider revoking anon DML/EXECUTE grants in Phase 8 hardening |
| 2 | APPROVED + RE-REVIEW APPROVED (2026-06-12) | [phase-2-review.md](docs/reviews/phase-2-review.md) | All resolved: MAJOR-1 (bad-creds selector, bug P2-001 → `f1c561f`); BLOCKER P2-002 (post-login race) fixed (`c808f8d`+`760d6a4`, ADR 0009) & load-verified 430/430. Re-review of the auth hot-path fix: APPROVED | INFO-1 (ADR 0007) done; INFO-2 (ADR 0008) done; carried: prod must use asymmetric JWT signing keys (Phase 8 deploy checklist) |

## Decisions

<!-- One line per decision; details in docs/decisions/ -->

| Date | Decision | ADR |
| ---- | -------- | --- |
| 2026-06-11 | Scaffolding & toolchain: Next 16/React 19, shadcn (radix/neutral), `vitest.config.mts` (ESM), Supabase CLI pinned as devDep, Chromium-only Playwright | [0001](docs/decisions/0001-scaffolding-and-toolchain.md) |
| 2026-06-11 | `jsdom` pinned to `^25` (jsdom@27 pulls an ESM-only transitive dep that crashes Vitest's forks pool on Node 20) — revisit when vitest/jsdom resolve the incompatibility | – |
| 2026-06-12 | Admin claim via a custom access token hook reading `profiles.is_admin` (not `app_metadata`); RLS helper falls back to a DB read so correctness never depends on the hook | [0002](docs/decisions/0002-admin-claim-access-token-hook.md) |
| 2026-06-12 | Database tests use pgTAP via `npx supabase test db` (richer assertions, native runner, per-file txn isolation) | [0003](docs/decisions/0003-pgtap-for-db-tests.md) |
| 2026-06-12 | Sign-off enforcement gated by an `app.feature_flags` row read by `submit_response`; OFF in Phase 1, flipped on by a one-line Phase 6 migration | [0004](docs/decisions/0004-signoff-feature-flag.md) |
| 2026-06-12 | `visible_when` v1 is a single condition (no AND/OR), CHECK-enforced shape + publish-time structural validation; documented extension point for AND/OR | [0005](docs/decisions/0005-visible-when-shape.md) |
| 2026-06-12 | Keep legacy env var names (`..._ANON_KEY`/`..._SERVICE_ROLE_KEY`) while accepting new-style publishable/secret CLI keys | [0006](docs/decisions/0006-supabase-api-key-naming.md) |
| 2026-06-12 | Phase 2: added `multi@test.local` (id `…0008`) as **staff of both** `ccih` and `farmacia` to make the commission picker E2E-testable; pgTAP unaffected (hermetic `test_helpers.bootstrap`, never reads seed). Seed now 8 users / 8 memberships. | – |
| 2026-06-12 | Middleware is a coarse auth gate (refresh + authenticated/unauthenticated boundary only); role-aware landing deferred to the root `/` Server Component to avoid per-request DB queries on the edge | [0007](docs/decisions/0007-middleware-coarse-gate-root-landing.md) |
| 2026-06-12 | GSAP 3.15.0 pinned as the auth-hero animation dependency (dynamic import, aria-hidden, reduced-motion guard) over a CSS-only approach | [0008](docs/decisions/0008-gsap-animation-dependency.md) |
| 2026-06-12 | Auth identity on the request hot path via LOCAL JWT verification (`getClaims()`, ES256 vs cached JWKS) instead of a per-request `getUser()` GoTrue round trip; `is_admin` strictly from the verified claim (fails closed), SQL `app.is_admin()` DB fallback kept as RLS defense-in-depth. Fixes P2-002. **Requires asymmetric signing keys in prod.** | [0009](docs/decisions/0009-jwt-local-verification-gate.md) |

## Follow-ups / Deferred Items

- [ ] (minor QA findings, nice-to-haves, tech debt — reviewed at each phase start)
- [ ] Choose the sanitizing Markdown renderer library (ARCHITECTURE.md Rule 7) — deferred from scaffold; needs its own ADR before Phase 4/5.
- [x] Fix bad-credentials E2E test selector/assertion (Phase 2 MAJOR-1 / bug P2-001) — Done 2026-06-12 (`f1c561f`): targets `[role="status"]`, asserts exact pt-BR message.
- [x] ADR 0007: middleware coarse-gate + root Server Component role-landing design (Phase 2 INFO-1) — Done 2026-06-12 (`d4d80dc`).
- [x] ADR 0008: GSAP 3.15.0 animation dependency — rationale, version pin, license (Phase 2 INFO-2) — Done 2026-06-12 (`409c24c`).
- [x] Run `supabase start` to confirm the local stack boots from a clean clone (Phase 0 acceptance). — Done 2026-06-11 (backend task #1; REST + Auth healthy).
- [x] Set `lang="pt-BR"` in `src/app/layout.tsx` (QA Phase 0 MINOR-1) — Done 2026-06-12 in F0 (`src/app/layout.tsx:47`).
- [x] ADR on the new Supabase CLI publishable/secret key scheme (env var names kept) — Done 2026-06-12, ADR 0006.
- [ ] **Phase 8 deploy checklist — production Supabase Cloud MUST use asymmetric (ES256/RS256) JWT signing keys** (Phase 2 QA re-review, ADR 0009). Otherwise `getClaims()` silently falls back to a per-request `getUser()` GoTrue round trip, re-introducing the P2-002 post-login race in production (behavioral regression, not a security hole — tampered tokens still fail closed). Add a testable verification step.
- [ ] Register the custom access token hook in the production Supabase dashboard (ADR 0002) — Phase 8 deploy checklist.
