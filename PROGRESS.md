# PROGRESS.md — Project Status Tracker

> Single source of truth for project status. Update IMMEDIATELY when state
> changes. The lead owns the Phase Status table; each teammate owns their own
> rows in the other sections. Never report status that isn't written here.

## Phase Status

| Phase | Name                          | Status | Build | Tests | QA | Human ✓ | Completed | Commit |
| ----- | ----------------------------- | ------ | ----- | ----- | -- | ------- | --------- | ------ |
| 0     | Scaffolding & Environment     | ✅ complete | ✅ | ✅ 5/5 | ✅ APPROVED | ✅ 2026-06-11 | 2026-06-11 | `d64281e` |
| 1     | Schema, Auth & RLS            | ✅ complete | ✅ | ✅ 88/88 | ✅ APPROVED | ✅ 2026-06-12 | 2026-06-12 | `691662f` |
| 2     | Authentication & App Shell    | ✅ complete | ✅ | ✅ 49/49 + load | ✅ APPROVED + re-review | ✅ 2026-06-12 | 2026-06-12 | `5773b4a` |
| 3     | Admin Area & User Management  | ✅ complete | ✅ | ✅ 43/43 | ✅ APPROVED | ✅ 2026-06-12 | 2026-06-12 | `cb28ef3` |
| 4     | Form Builder & Versioning     | 🔜 not started | – | – | – | – | – | – |
| 5     | Wizard Filling, Conditional Sections & Resume | 🔜 not started | – | – | – | – | – | – |
| 6     | Section Sign-offs & Submission Lifecycle | 🔜 not started | – | – | – | – | – | – |
| 7     | Dashboards & Submissions Browser | 🔜 not started | – | – | – | – | – | – |
| 8     | Deployment                    | 🔜 not started | – | – | – | – | – | – |

Status legend: 🔜 not started · 🏗️ in progress · 🧪 testing · 🔍 QA review · ⏸️ awaiting human approval · ✅ complete · ❌ blocked

## Current Phase Tasks

<!-- Lead recreates this table at the start of each phase -->

**Phase 3 — Admin Area & User Management** (started 2026-06-12)

Scope (PHASES.md §Phase 3): `/admin` commission CRUD + assign/remove
staff_admins; `/c/[slug]/manage/members` staff_admin invites staff by email
(service-role server route), removes staff, sees member list. Acceptance: admin
creates a commission + assigns a staff_admin; staff_admin invites a staff user
(invite intercepted in tests); staff_admin of A cannot manage B.

Lead notes carried into this phase:
- Existing RLS (M6) already authorizes the full model: admin → commissions +
  commission_members ALL; staff_admin → insert/update/delete `staff` of own
  commission with an escalation guard (cannot create/promote staff_admin).
  Backend verifies this holds; a new migration is expected ONLY for member-email
  display (profiles has `full_name`, not email).
- staff_admin assignment is **by email** (assign existing user, or invite a new
  one) to mirror the staff invite flow. Service role required for invite +
  existing-user lookup; authorization re-checked server-side, never trusted from
  the client. Invite email is intercepted in E2E (Inbucket locally).

| Task | Owner | Status | Depends on | Notes |
| ---- | ----- | ------ | ---------- | ----- |
| B1 · Plan: RLS coverage audit + member-email display decision (migration if needed) + type regen | backend | done | – | Lead-approved. RLS audit confirmed M6/M8 cover all Phase 3 authorization (no auth migration). Migration `20260612100009_profiles_email.sql`: `profiles.email citext` + backfill + signup-trigger update + email-change sync trigger (`on_auth_user_email_changed`) + partial unique index. ADR 0010. Types regenerated → `email: string \| null`. Backfill verified (8/8 personas). |
| B2 · Service-role server client factory (`src/lib/supabase/admin.ts`) | backend | done | – | `createAdminClient()`; `import 'server-only'` first line (build-time client-bundle guard); `SUPABASE_SERVICE_ROLE_KEY` + URL; `persistSession:false, autoRefreshToken:false`. `server-only@^0.0.1` pinned (lead-approved). |
| B3 · Admin queries (`src/lib/queries/commissions.ts`) | backend | done | B1 | `listCommissionsForAdmin()` → {id,name,slug,createdAt,memberCount,staffAdmins[]}; `getCommissionForAdmin(slug)` → detail + roster \| null. RLS-scoped cookie client; pt-BR sort. Signatures posted to lead/frontend. |
| B4 · Member queries (`src/lib/queries/members.ts`) | backend | done | B1 | `listMembers(commissionId)` → {userId,fullName,email,role,joinedAt}[]; staff_admin-first then name (pt-BR). Exported `sortMembers` helper. Canonical for member page + admin detail. |
| B5 · Server actions: commission CRUD + staff_admin assign/remove (admin); invite/remove staff (staff_admin\|admin) | backend | done | B2, B3, B4 | `src/lib/admin/actions.ts` (createCommission, updateCommission [name-only], assignStaffAdmin, removeStaffAdmin) + `src/lib/members/actions.ts` (inviteStaff, removeStaff) + shared `src/lib/members/invite.ts` (`resolveOrInviteUser`). `useActionState`-shaped, pt-BR, no raw PG errors. **Role hard-coded per action; authz re-verified server-side, commission-scoped, BEFORE any service-role write.** DB upsert behaviors verified via SQL. **QA MINOR-1 resolved:** `assignStaffAdmin`/`removeStaffAdmin` now also revalidate `/admin/comissoes/[slug]` (slug resolved from commissionId via the client already held) so the StaffAdminManager roster refreshes without navigation. Single-file change; no DB impact. lint + typecheck green (full project). |
| B6 · Seed touch-ups (if needed) + type regen + pgTAP regression check | backend | done | B1, B5 | No seed change needed (personas cover E2E; tests invite a novel address → Mailpit). New `45_email_denorm.sql` (5 tests: signup-sets-email, email-change-sync, co-member-reads-email, foreign-cannot). pgTAP **70/70** (was 65). Types regenerated, no drift. Backend-owned files typecheck+lint clean. |
| F1 · Admin commissions list + create (`/admin` real + create flow) | frontend | done | B3, B5 | Done 2026-06-12. Lead-approved. `frontend-design` applied (read SKILL.md from plugin dir — not invocable in runtime). `admin/page.tsx` replaces the "em breve" placeholder: `listCommissionsForAdmin()` → commission cards (name, mono slug, member count w/ GSAP count-up `StatCount`, coordinators) + "Nova comissão" `CommissionCreateForm` (name + auto-suggested slug). Verified: admin sees both seeded commissions; create action works end-to-end (then `db reset` to clean). lint+typecheck green. |
| F2 · Admin commission detail — edit + manage staff_admins (`/admin/comissoes/[slug]`) | frontend | done | B3, B5, F1 | Done 2026-06-12. Lead-approved. New route `admin/comissoes/[slug]/page.tsx`: `getCommissionForAdmin(slug)` → `notFound()` on null; `CommissionEditForm` (name editable, slug read-only/disabled — `updateCommission` is name-only); `StaffAdminManager` (assign-by-email `assignStaffAdmin` invite-if-new + roster + `removeStaffAdmin` behind `AlertDialog` confirm). Mutate actions key on hidden `commissionId` (per B5 impl) — wired accordingly. Verified: detail renders; assign works; unknown slug → 404 UI; AlertDialog keyboard-operable. |
| F3 · Commission member management (`/c/[slug]/manage/members`) | frontend | done | B4, B5 | Done 2026-06-12. Lead-approved. New `manage/members` route under `c/[slug]`: server-gated via `getCommissionAccess` → `notFound()` unless `staff_admin` of the commission OR admin (lead chose 404, no 403); `listMembers(commissionId)` roster (name/email/`RoleBadge`), `InviteStaffForm` (`inviteStaff`), `removeStaff` per staff row behind `AlertDialog` (own row + coordinators excluded). Verified per persona: chefe.ccih → 200 + list/invite; staff1.ccih → 404; cross-commission farmacia → 404; admin override → 200. |
| F4 · Wire nav + landing affordances | frontend | done | F1, F2, F3 | Done 2026-06-12. `nav-menu.tsx`: "Gerenciar" → real Link `manage/members` (staff_admin) — verified active/highlighted. `c/[slug]/page.tsx`: card model gained optional `path`; "Gerenciar membros" coordinator card now live (arrow affordance, no "em breve"); unshipped areas keep the tag. `/admin` placeholder fully replaced by F1. |
| F5 · Loading/error states + a11y + pt-BR polish for new screens | frontend | done | F1, F2, F3 | Done 2026-06-12. `loading.tsx`+`error.tsx` for `/admin`, `/admin/comissoes/[slug]`, `/c/[slug]/manage/members` (skeletons mirror each layout; pt-BR error boundaries, no raw PG errors — all surfaced via action state). a11y: every input has `<label>` via `Field`/`useFieldIds`; AlertDialog Enter-opens/Esc-closes (verified keyboard); `StatCount` respects `prefers-reduced-motion`. New primitive `ui/alert-dialog.tsx` (Radix). |

Phase 3 frontend notes:
- Adopted nullable `email: string \| null` (per B1/100009 — denormalized `profiles.email`, backfilled but nullable) by importing backend interfaces directly (`AdminCommissionListItem`, `StaffAdminSummary`, `MemberListItem`) so UI shapes can't drift; display falls back name→email→"Sem identificação".
- Mutation actions key on hidden `commissionId` (per B5 impl: `updateCommission`/`assignStaffAdmin`/`removeStaffAdmin`/`inviteStaff`/`removeStaff`); only `createCommission` reads `name`+`slug`. Forms send `commissionId` from the server-loaded id.
- Components added: `ui/alert-dialog.tsx`, `admin/{stat-count,commission-list,commission-create-form,commission-edit-form,staff-admin-manager,confirm-remove-button}.tsx`, `members/{role-badge,member-list,invite-staff-form}.tsx`.
- Success convention: actions return `{ ok:true, error:<pt-BR success copy> }`; banners now prefer the action's returned message (fallback to a default). `ConfirmRemoveButton` shows its error banner only when `!ok` so the success-copy-in-`error` never flashes as an error during the dialog's success-close. Re-verified 2026-06-12 against final backend modules: lint+typecheck green; 11/11 manual checks (gating matrix all personas + create→assign→remove lifecycle; success banner renders backend copy "Coordenador(a) atribuído(a) com sucesso."); DB reset to leave seed pristine.
- QA MINOR-2 resolved 2026-06-12: `ConfirmRemoveButton` now types its `action` prop against `ActionState` from `@/lib/admin/actions` (was incidentally `AuthState` from `@/lib/auth/actions`); structurally identical, so `removeStaff` stays assignable. lint+typecheck green, no behavior change.

<details><summary>Phase 2 tasks (completed 2026-06-12)</summary>

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

</details>

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
| 2026-06-12 | 3 | Playwright: 3 files / 43 tests (--workers=1, fresh seed) | 43 | 0 | Phase 3 gate run. New spec: `e2e/phase3-admin-members.spec.ts` (14 tests covering all 4 AC clauses: AC1 commission create + staff_admin assignment, AC2 invite-staff Mailpit intercept + remove via AlertDialog, AC3 cross-commission boundary (6 personas/paths), AC4 keyboard-only commission create + AlertDialog keyboard ops). Regression suite (home.spec.ts + phase2-auth-shell.spec.ts, 29 tests) clean. No bugs found in Phase 3 application code — all test failures during authoring were spec isolation issues (DB mutation between tests, RSC dev-mode response format, Radix AlertDialog tab-order). Isolation resolved by using novel Date.now() emails/slugs in AC1/AC2; 404 assertions switched from innerText() to locator-based waits. Suite also verified green under default parallel workers (24.8s). Note: `npx supabase db reset` required before each run (AC2 invite tests mutate DB). |

## QA Verdicts

| Phase | Verdict | Report | Blockers/Majors | Follow-ups carried |
| ----- | ------- | ------ | --------------- | ------------------ |
| 0 | APPROVED | [phase-0-review.md](docs/reviews/phase-0-review.md) | None | MINOR-1: set lang="pt-BR" in layout.tsx (Phase 2); MINOR-2: close stale supabase-start follow-up; INFO: update ADR 0001 to note --passWithNoTests removed |
| 1 | APPROVED (re-verified 2026-06-12) | [phase-1-review.md](docs/reviews/phase-1-review.md) | All resolved in M8: MAJOR-1 (USING clause fix + demotion test); MAJOR-2 (3 sign-off immutability tests added); MINOR-1 (eval_condition search_path); MINOR-2 (profiles never-deleted: policy split + trigger); MINOR-3 (version/commission guard trigger) | INFO-1: consider revoking anon DML/EXECUTE grants in Phase 8 hardening |
| 2 | APPROVED + RE-REVIEW APPROVED (2026-06-12) | [phase-2-review.md](docs/reviews/phase-2-review.md) | All resolved: MAJOR-1 (bad-creds selector, bug P2-001 → `f1c561f`); BLOCKER P2-002 (post-login race) fixed (`c808f8d`+`760d6a4`, ADR 0009) & load-verified 430/430. Re-review of the auth hot-path fix: APPROVED | INFO-1 (ADR 0007) done; INFO-2 (ADR 0008) done; carried: prod must use asymmetric JWT signing keys (Phase 8 deploy checklist) |
| 3 | APPROVED (2026-06-12) | (inline in QA message) | None | MINOR-1 ✅ RESOLVED 2026-06-12 (backend, `revalidateCommissionPages` — assign/remove now revalidate `/admin/comissoes/[slug]` too); MINOR-2 ✅ RESOLVED 2026-06-12 (frontend, `ConfirmRemoveButton` now types against `ActionState` from `@/lib/admin/actions`); both pre-record per human request. **Carried:** INFO-1 — AC1 E2E asserts the coordinator email appears in the roster but not that the "Coordenação" RoleBadge renders (add to Phase 4 test-hardening). Post-fix verification: lint + typecheck + unit (20/20) green; full E2E NOT re-run (both fixes provably non-runtime — a `revalidatePath` cache hint can't regress a passing nav-fresh test, and a type-only import swap has no runtime effect), so the 43/43 run stands. |

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
| 2026-06-12 | Phase 3: denormalize `email` (nullable citext) onto `public.profiles` — populated by the signup trigger, backfilled from `auth.users`, kept fresh by an `auth.users` email-change sync trigger, partial-unique-indexed. Member/admin lists resolve emails via the existing `profiles_select` RLS policy with no service-role read on the display path. Slug immutable after create (name-only edit). | [0010](docs/decisions/0010-denormalize-email-on-profiles.md) |

## Follow-ups / Deferred Items

- [ ] (minor QA findings, nice-to-haves, tech debt — reviewed at each phase start)
- [ ] Choose the sanitizing Markdown renderer library (ARCHITECTURE.md Rule 7) — deferred from scaffold; needs its own ADR before Phase 4/5.
- [x] Phase 3 QA MINOR-1 — `assignStaffAdmin`/`removeStaffAdmin` revalidate the `/admin/comissoes/[slug]` detail page (helper `revalidateCommissionPages`, slug resolved from `commissionId`) so the roster refreshes without navigation — Done 2026-06-12 (backend).
- [x] Phase 3 QA MINOR-2 — `ConfirmRemoveButton` types its `action` prop against `ActionState` from `@/lib/admin/actions` (was `AuthState` from `@/lib/auth/actions`); structurally identical, `removeStaff` still assignable — Done 2026-06-12 (frontend).
- [ ] Phase 3 QA INFO-1 — extend Phase 3 E2E (AC1) to assert the "Coordenação" `RoleBadge` renders for the assigned coordinator (not just that the email appears) — Phase 4 test-hardening.
- [x] Fix bad-credentials E2E test selector/assertion (Phase 2 MAJOR-1 / bug P2-001) — Done 2026-06-12 (`f1c561f`): targets `[role="status"]`, asserts exact pt-BR message.
- [x] ADR 0007: middleware coarse-gate + root Server Component role-landing design (Phase 2 INFO-1) — Done 2026-06-12 (`d4d80dc`).
- [x] ADR 0008: GSAP 3.15.0 animation dependency — rationale, version pin, license (Phase 2 INFO-2) — Done 2026-06-12 (`409c24c`).
- [x] Run `supabase start` to confirm the local stack boots from a clean clone (Phase 0 acceptance). — Done 2026-06-11 (backend task #1; REST + Auth healthy).
- [x] Set `lang="pt-BR"` in `src/app/layout.tsx` (QA Phase 0 MINOR-1) — Done 2026-06-12 in F0 (`src/app/layout.tsx:47`).
- [x] ADR on the new Supabase CLI publishable/secret key scheme (env var names kept) — Done 2026-06-12, ADR 0006.
- [ ] **Phase 8 deploy checklist — production Supabase Cloud MUST use asymmetric (ES256/RS256) JWT signing keys** (Phase 2 QA re-review, ADR 0009). Otherwise `getClaims()` silently falls back to a per-request `getUser()` GoTrue round trip, re-introducing the P2-002 post-login race in production (behavioral regression, not a security hole — tampered tokens still fail closed). Add a testable verification step.
- [ ] Register the custom access token hook in the production Supabase dashboard (ADR 0002) — Phase 8 deploy checklist.
