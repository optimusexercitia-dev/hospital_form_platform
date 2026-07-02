# User Registration & Identity Management — phase record (archived)

> Rotated out of `PROGRESS.md` at the §6.5 record step (CLAUDE.md §7). Append-only; not
> loaded by spawns. ✅ **COMPLETE 2026-07-02**, QA APPROVED. Branch `feat/user-registration`
> (off `main` @ `9fdd111`); feature commit `117319d`, hash-record `a3c1a5f`.
> ADR [0048](../decisions/0048-user-registration-identity.md) ·
> QA review [user-registration-review.md](../reviews/user-registration-review.md) ·
> Plan `~/.claude/plans/i-would-like-to-sorted-fog.md`.

## Summary

An org-scoped user-registration + identity-management system. `org_admin` registers users
(name, email, professional category, optional council credentials, optional home hospital +
matrícula) → invite email → verify + set password (existing `/auth/confirm`→`/convite` flow) →
active. Searchable org user directory + full per-user management page (edit profile/credentials,
assign committees with `staff`/`staff_admin` roles, deactivate / suspend / reactivate / resend
invite). Makes `is_active` a **real enforcement boundary**: `app.is_active()` folded into every
membership RLS helper (excluding `is_admin*` — vendor must not self-lock) + a `signIn` gate +
`getSessionContext().isInactive` → `/conta-inativa` (loop-free). Adds `suspended_until`
(temporary, auto-reinstating). LGPD-minimized (no `date_of_birth`).

New schema: `professional_categories` lookup, `professional_credentials` table, `profiles`
columns (`home_organization_id`, `home_hospital_id`, `hospital_employee_id`,
`professional_category_id`, `email_confirmed_at` denorm, `suspended_until`), `email_confirmed_at`
denorm trigger, and a **deferred `profiles_tenant_has_org_trg`** anchor invariant (non-admin ⇒
`home_organization_id` NOT NULL; org-less vendor via `bootstrap_admin` app_metadata). Design
decisions in ADR 0048.

## Final gate result (§6.2 / §6.3)

- **Feature E2E** `e2e/user-registration.spec.ts`: **12/12** in isolation + **26/26** predecessor-sim (order-independent).
- **pgTAP**: **1257/1257** (incl. the `is_active` fold across all helpers + the functional "active caller sees a PENDING co-member" case; `180_user_registration.sql` plan 38).
- **Full E2E suite** (post-M4-fix, templates reloaded): **467 passed / 10 failed** — all 10 = pre-existing serial-suite contamination (7 stable: `phase8`×5, `phase5`×2; 3 run-to-run shifters), each **green in isolation** (33/33). **0 real regressions.** Same green bar as answer-model-v2 / ad-hoc-narratives.
- typecheck + lint clean.
- **QA: APPROVED** (one CHANGES-REQUESTED cycle — B1 RLS gap — fixed + re-verified; ADR + backend-state written).

## Task detail

Branch `feat/user-registration`. Contract-first (backend posted typed stubs → frontend built against them in parallel).

| ID | Owner | Task | Status |
| -- | ----- | ---- | ------ |
| BE-0 | backend | Contract stubs (queries/actions/types) + migration & RLS plan | ✅ plan approved w/ rulings (R1 CHECK-not-NOT-NULL → deferred trigger · R2 widen guard · R3 exclude is_admin · inactive no-loop gate) |
| BE-1 | backend | Migration: profiles cols; `professional_categories`(+seed); `professional_credentials`; `email_confirmed_at` denorm trigger; anchor invariant via **deferred constraint trigger** | ✅ |
| BE-2a | backend | `app.is_active()` folded into all membership SD-helpers (excl. `is_admin*`) | ✅ |
| BE-2b | backend | `signIn` gate + `getSessionContext()` `isInactive` signal + `requireUser`→`/conta-inativa` + middleware allowlist/redirect-away exclusion | ✅ loop-freedom traced |
| BE-3 | backend | RLS: org-directory profiles SELECT (org_admin-only); credentials; categories; `guard_profile_privileged_columns` widened | ✅ |
| BE-4 | backend | Actions: `registerUser` (atomic invite+write via user_metadata, collision block), update/credential/committee-role/lifecycle/`resendInvite` | ✅ (BUG-UREG-001: bodies were stubs at first, then really implemented + self-verified) |
| BE-5 | backend | Queries `listOrgUsers`/`getOrgUser`; regen `database.ts`; status-vector parity test (Vitest) | ✅ |
| FE-1 | frontend | Org-scoped searchable user directory (`usuarios/`, URL search+paging, status badges) | ✅ |
| FE-2 | frontend | Register page `usuarios/novo/` (category, credentials sub-form, hospital/matrícula, CommitteeRoleAssigner `collect`) | ✅ |
| FE-3 | frontend | Per-user page `usuarios/[userId]/` (profile edit, credentials editor, CommitteeRoleAssigner `live`, lifecycle) | ✅ |
| FE-4 | frontend | Relabel `/convite` activation copy + "Usuários" nav entry | ✅ |
| FE-5 | frontend | `/conta-inativa` public page (pt-BR inactive message + sign-out) | ✅ |
| FIX-1 | frontend | AC3 `page.tsx` `isInactive`→`/conta-inativa` gate; `[userId]` notFound; "Suspender" name; disambiguate "Adicionar" buttons ("Adicionar credencial"/"Adicionar comissão"); `role="alert"` collision error | ✅ |
| FIX-2 | tester | Diagnose AC2 → BUG-UREG-002 (invite token_hash) | ✅ |
| BE-7 | backend | BUG-UREG-002 fix — token_hash pt-BR email templates (invite + recovery) | ✅ |
| FIX-3 | tester | Re-run feature spec after FIX-1 → 12/12 (incl. AC2); + AC2 host-normalization harness fix | ✅ |
| FIX-4 | tester | Triage 18 full-suite reds → 8 contamination / 5 phase13-helper-drift (fixed) / 5 BUG-UREG-003 | ✅ |
| BE-8 | backend | BUG-UREG-003 — thread `home_organization_id` through `resolveOrInviteUser` + 3 callers | ✅ (lead-verified phase3-admin-members 14/14) |
| FIX-5 | tester | Harden `user-registration.spec.ts` for full-suite ordering (uniqueToken + `?search=`-scoped assertions); confirm 2 unknown reds pre-existing | ✅ 12/12 iso + 26/26 predecessor-sim |
| BE-9 | backend | QA fix batch (B1 + M1–M4) | ⚠️ M1–M4 done; M4 introduced BUG-UREG-004 (see BE-10); B1 was correct |
| BE-10 | backend | BUG-UREG-004 fix — root cause was **M4, NOT B1**; template rewording → invalid Go `html/template` → GoTrue 500 on every invite | ✅ combo 26/26, pgTAP 1257, invite smoke→200 |
| T-1 | tester | pgTAP + feature E2E + seed personas (pending/active/suspended/deactivated) + `00_setup.sql` sign-off | ✅ feature 12/12; pgTAP 1257 |
| QA-1 | qa | Requirements + RLS/security review; ADR 0048 | ✅ CHANGES→APPROVED (B1 gap fixed; BUG-UREG-004 attributed to M4, not B1) |
| GATE | lead | Full E2E suite (chromium, `--workers=1`, fresh reset) | ✅ 467p/10-contamination, 0 real regressions; 3 shifters 33/33 in isolation |

## Bug trail (all resolved)

- **BUG-UREG-001** (BLOCKER, backend) — the query/action layer was still the contract-first stub (`throw new Error('not implemented')`) though marked done; runtime E2E caught what typecheck couldn't (9/12 fail). RESOLVED: backend really implemented + self-verified via DB probes.
- **BUG-UREG-002** (BLOCKER, backend) — *pre-existing* broken activation flow: GoTrue invite link used the implicit flow (session in URL fragment) that the server `/auth/confirm` handler (expecting `token_hash` query) can't read → `/login?error=link_invalido`; recovery affected too. First spec to ever *follow* an invite link. RESOLVED: pt-BR `token_hash` email templates (invite+recovery) + tester `extractInviteLink` host-normalization (env-only, `site_url` 127.0.0.1 vs baseURL localhost cookie-origin).
- **BUG-UREG-003** (BLOCKER, backend) — the new deferred anchor invariant broke EVERY pre-existing member invite: `resolveOrInviteUser` called `inviteUserByEmail` without `home_organization_id` → org-less profile → `23514` at commit. RESOLVED: threaded `homeOrganizationId` through the helper + all 3 callers (`inviteStaff`, assign staff_admin, `assignOrgAdmin`).
- **BUG-UREG-004** (BLOCKER, backend) — the M4 template rewording put `{{ }}` actions inside HTML comments + left `recovery.html` ending in a non-text context → Go `html/template` parse error → GoTrue 500 on every invite/register → "member not visible in roster". (`db reset` doesn't reload templates, so pgTAP stayed green; only live E2E caught it — the earlier 462p/18f full-suite run was polluted by this, not B1 or contamination.) RESOLVED: removed actions from comments, both templates end text-context, token_hash shape preserved.
- **phase13-audit helper drift** (tester-owned, fixed) — `makeProbeUser` created org-less profiles the intended anchor invariant now rejects (`23514`); tester threaded the org into the helper (mirrors the real path), re-verified 5/5.

## QA verdict history

- **CHANGES REQUESTED** (2026-07-01) — 1 BLOCKER (B1: `profiles_select_self_or_admin` peer self-join bypassed the `app.is_active()` fold — a suspended caller could still read commission peers' profiles within the ADR-0009 JWT residual) + 4 MINORs (nsp_coordinator directory-exclusion untested; false SQL-parity comment; generic credential-collision error; invite-copy/otp_expiry coupling).
- **APPROVED** (re-re-review, 2026-07-01, verdict holds) — all 5 resolved + independently re-verified vs source. B1 gate correct (peer branch `app.is_active(auth.uid())`; `profiles_admin_select` has no raw peer branch; active-user visibility unchanged). BUG-UREG-004 attributed to M4, not B1. Functional pgTAP case (active sees pending peer) added. plan(38) consistent w/ 1257/1257.

## Test-run log (rotated from Test Run Summary)

- **2026-07-01 · new-spec run** — pgTAP 1252/1252 green; feature E2E 3/12 (9 fail = BUG-UREG-001 stubs); `00_setup.sql` one-line anchor edit signed off.
- **2026-07-01 · FIX-1/FIX-2 re-run** — feature E2E **12/12** (incl. AC2). Spec-side locator updates for FIX-1 button renames + `role="alert"`; 3 genuine spec fixes (app correct each time); AC2 host-normalization harness fix.
- **2026-07-01 · regression triage of the 18 full-suite reds** — scoped re-run 82p/10f → 8 pre-existing contamination (no action), 5 phase13-helper drift (fixed), 5 = BUG-UREG-003 (real, backend).
- **2026-07-01 · full-suite hardening pass** — user-reg 12/12 isolation + 26/26 predecessor-sim; the 2 unknowns (`case-access:751`, `cases-outcomes:194`) confirmed pre-existing contamination, NOT seed-caused. Feature spec no longer contributes reds.
- **2026-07-02 · final full-suite (lead)** — 467p/10, all contamination (3 shifters 33/33 in isolation), 0 real regressions → §6.2 GREEN.

## Open follow-up (deploy)

- ⚠️ **Phase-9 deploy dependency:** the pt-BR invite + recovery email templates (`supabase/templates/{invite,recovery}.html`) must be pasted into the Supabase **Dashboard → Auth → Email Templates** for Cloud (self-hosted `config.toml` templates don't auto-apply), preserving the `{{ .TokenHash }}` + `?type=invite|recovery` link shape — alongside the already-flagged custom SMTP. Not a code blocker. Recorded in `docs/backend-state.md`.
- Accepted residual (ADR 0009): a just-deactivated user with a still-valid JWT retains ≤~1h access to their OWN `created_by` rows via direct API — consistent with the platform's revocation-latency stance; not chased into every self-scoped policy.
